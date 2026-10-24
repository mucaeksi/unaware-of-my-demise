using UnityEngine;
using UnityEngine.UIElements;

namespace Uomd.Scenes
{
    /// <summary>
    /// Code-only entry point: builds the UIDocument + UomdSceneRouter at runtime so the scene file never
    /// needs script GUID references (the project ships without generated .meta files until first import).
    /// </summary>
    public static class UomdBootstrap
    {
        public const string ThemeResourcePath = "UI/UomdRuntimeTheme";

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (Object.FindFirstObjectByType<UomdSceneRouter>() != null) return;
            // The capture player runs under Xvfb with no window manager, so its window never gets focus and a desktop
            // player pauses its frame loop without this.
            if (UomdCaptureRunner.Requested(out _)) Application.runInBackground = true;

            var go = new GameObject("UomdBootstrapper");
            go.SetActive(false); // defer Awake until UIDocument has its PanelSettings
            var document = go.AddComponent<UIDocument>();
            document.panelSettings = CreatePanelSettings();
            go.AddComponent<UomdSceneRouter>();
            Object.DontDestroyOnLoad(go);
            go.SetActive(true);
        }

        public static PanelSettings CreatePanelSettings()
        {
            var settings = ScriptableObject.CreateInstance<PanelSettings>();
            settings.name = "UomdRuntimePanelSettings";
            settings.themeStyleSheet = Resources.Load<ThemeStyleSheet>(ThemeResourcePath);
            if (settings.themeStyleSheet == null)
            {
                Debug.LogError($"[UomdBootstrap] Missing Resources/{ThemeResourcePath}.tss; UI will render unstyled.");
            }
            settings.scaleMode = PanelScaleMode.ScaleWithScreenSize;
            settings.referenceResolution = new Vector2Int(1920, 1080);
            settings.screenMatchMode = PanelScreenMatchMode.MatchWidthOrHeight;
            settings.match = 1f; // landscape: keep vertical layout stable across aspect ratios
            settings.clearColor = false;
            return settings;
        }
    }
}
