using System;
using System.IO;
using System.Reflection;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using Uomd.Core;
using Uomd.Scenes;

namespace Uomd.EditorTools
{
    /// <summary>Owns a rehearsal Play session and restores editor state across domain reloads.</summary>
    [InitializeOnLoad]
    public static class ProductionReviewSession
    {
        public const string ScenePath = "Assets/_UOMD/Editor/ProductionReviewPreview.unity";
        private const string Prefix = "Uomd.ProductionReview.";
        public static string Status { get; private set; } = "Select a rebuilt scenario and open its isolated Game view.";
        public static bool Active => UomdEditorPreviewIsolation.Active;
        public static UomdSceneRouter Router => Active && EditorApplication.isPlaying ? UnityEngine.Object.FindFirstObjectByType<UomdSceneRouter>() : null;

        static ProductionReviewSession()
        {
            EditorApplication.playModeStateChanged += OnPlayState;
            EditorApplication.quitting += Restore;
        }

        public static void EnsureScene()
        {
            if (AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath) != null) return;
            var prior = SceneManager.GetActiveScene();
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Additive);
            try
            {
                var camera = new GameObject("ReviewCamera", typeof(Camera));
                camera.tag = "MainCamera";
                camera.transform.position = new Vector3(0, 0, -10);
                camera.GetComponent<Camera>().orthographic = true;
                camera.GetComponent<Camera>().orthographicSize = 5.4f;
                SceneManager.MoveGameObjectToScene(camera, scene);
                var light = new GameObject("ReviewLight", typeof(Light));
                light.GetComponent<Light>().type = LightType.Directional;
                SceneManager.MoveGameObjectToScene(light, scene);
                if (!EditorSceneManager.SaveScene(scene, ScenePath)) throw new IOException("Could not author the isolated review scene.");
            }
            finally
            {
                EditorSceneManager.CloseScene(scene, true);
                if (prior.IsValid()) SceneManager.SetActiveScene(prior);
            }
        }

        public static void Start(ProductionPreviewRequest request, int width, int height)
        {
            if (EditorApplication.isCompiling || EditorApplication.isPlayingOrWillChangePlaymode)
                throw new InvalidOperationException("Stop normal Play Mode / wait for compilation before opening Production Review.");
            for (int i = 0; i < SceneManager.sceneCount; i++)
                if (SceneManager.GetSceneAt(i).isDirty) throw new InvalidOperationException("Save or discard your scene edits explicitly before previewing. Production Review never saves unrelated dirty scenes.");
            EnsureScene();
            SessionState.SetString(Prefix + "PreviousStartScene", AssetDatabase.GetAssetPath(EditorSceneManager.playModeStartScene));
            SessionState.SetBool(Prefix + "RunInBackground", Application.runInBackground);
            SessionState.SetString(ProductionPreviewRequest.RequestKey, JsonUtility.ToJson(request));
            SessionState.SetBool(UomdEditorPreviewIsolation.ActiveKey, true);
            try
            {
                ProductionReviewViewport.Begin(width, height);
                EditorSceneManager.playModeStartScene = AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath);
                Status = "Loading isolated base-content preview…";
                EditorApplication.isPlaying = true;
            }
            catch { Restore(); throw; }
        }

        public static async void Show(ProductionPreviewRequest request)
        {
            var router = Router;
            if (router == null || !router.ProductionPreviewReady) { Status = "Wait for preview initialization."; return; }
            try
            {
                await router.PreviewAsync(request);
                Status = "Preview: " + request.scenario;
                ProductionReviewViewport.Focus();
            }
            catch (Exception e) { Status = e.Message; Debug.LogException(e); Stop(); }
        }

        public static void Stop()
        {
            if (!Active) return;
            if (EditorApplication.isPlayingOrWillChangePlaymode) EditorApplication.isPlaying = false;
            else Restore();
        }

        private static void OnPlayState(PlayModeStateChange state)
        {
            if (!Active) return;
            if (state == PlayModeStateChange.EnteredPlayMode) Status = "Production Review — isolated, base content, API disabled";
            if (state == PlayModeStateChange.EnteredEditMode) Restore();
        }

        public static void Restore()
        {
            if (!Active) return;
            try
            {
                EditorSceneManager.playModeStartScene = AssetDatabase.LoadAssetAtPath<SceneAsset>(SessionState.GetString(Prefix + "PreviousStartScene", ""));
                Application.runInBackground = SessionState.GetBool(Prefix + "RunInBackground", true);
                ProductionReviewViewport.Restore();
            }
            finally
            {
                SessionState.SetBool(UomdEditorPreviewIsolation.ActiveKey, false);
                SessionState.EraseString(ProductionPreviewRequest.RequestKey);
                Status = "Preview closed. Original scene, viewport, audio and preferences restored.";
            }
        }
    }

    /// <summary>Unity exposes Game-view sizing internally; contain the reflected Editor API here, never runtime controllers.</summary>
    public static class ProductionReviewViewport
    {
        private const BindingFlags Flags = BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static;
        private const string Prefix = "Uomd.ProductionReview.Viewport.";
        private static Type GameViewType => typeof(Editor).Assembly.GetType("UnityEditor.GameView", true);
        private static EditorWindow Window => EditorWindow.GetWindow(GameViewType);
        private static PropertyInfo SizeProperty => GameViewType.GetProperty("selectedSizeIndex", Flags);
        private static object Group()
        {
            var type = typeof(Editor).Assembly.GetType("UnityEditor.GameViewSizes", true);
            object instance = type.GetProperty("instance", Flags | BindingFlags.FlattenHierarchy).GetValue(null);
            return type.GetProperty("currentGroup", Flags).GetValue(instance);
        }

        public static void Begin(int width, int height)
        {
            SessionState.SetInt(Prefix + "TemporaryIndex", -1);
            var window = Window;
            SessionState.SetInt(Prefix + "Index", (int)SizeProperty.GetValue(window));
            var gizmos = GameViewType.GetProperty("drawGizmos", Flags);
            SessionState.SetBool(Prefix + "Gizmos", gizmos != null && (bool)gizmos.GetValue(window));
            gizmos?.SetValue(window, false);
            Set(width, height);
        }

        public static void Set(int width, int height)
        {
            if (!ProductionReviewSession.Active) throw new InvalidOperationException("Viewport changes belong to an active review session.");
            if (!((width == 1920 && height == 1080) || (width == 2400 && height == 1080) || (width == 1600 && height == 1200)))
                throw new ArgumentException("Unsupported review viewport.");
            var group = Group();
            var type = group.GetType();
            int count = (int)type.GetMethod("GetTotalCount", Flags).Invoke(group, null);
            int index = -1;
            for (int i = 0; i < count; i++)
            {
                var size = type.GetMethod("GetGameViewSize", Flags).Invoke(group, new object[] { i });
                if ((string)size.GetType().GetProperty("baseText", Flags).GetValue(size) == "UOMD Review") { index = i; break; }
            }
            var sizeType = typeof(Editor).Assembly.GetType("UnityEditor.GameViewSize", true);
            if (index < 0)
            {
                var enumType = typeof(Editor).Assembly.GetType("UnityEditor.GameViewSizeType", true);
                object size = Activator.CreateInstance(sizeType, Flags, null, new object[] { Enum.Parse(enumType, "FixedResolution"), width, height, "UOMD Review" }, null);
                type.GetMethod("AddCustomSize", Flags).Invoke(group, new[] { size });
                index = count;
            }
            else
            {
                var size = type.GetMethod("GetGameViewSize", Flags).Invoke(group, new object[] { index });
                sizeType.GetProperty("width", Flags).SetValue(size, width);
                sizeType.GetProperty("height", Flags).SetValue(size, height);
            }
            SessionState.SetInt(Prefix + "TemporaryIndex", index);
            SizeProperty.SetValue(Window, index);
            Window.Repaint();
            Focus();
        }

        public static void Focus() { Window.Show(); Window.Focus(); Window.Repaint(); }

        public static void Restore()
        {
            var window = Window;
            SizeProperty.SetValue(window, SessionState.GetInt(Prefix + "Index", 0));
            var group = Group();
            int index = SessionState.GetInt(Prefix + "TemporaryIndex", -1);
            int builtins = (int)group.GetType().GetMethod("GetBuiltinCount", Flags).Invoke(group, null);
            // UnityCsReference 6000.3: RemoveCustomSize takes the total menu index, including built-ins.
            if (index >= builtins) group.GetType().GetMethod("RemoveCustomSize", Flags).Invoke(group, new object[] { index });
            GameViewType.GetProperty("drawGizmos", Flags)?.SetValue(window, SessionState.GetBool(Prefix + "Gizmos", false));
            window.Repaint();
        }
    }
}
