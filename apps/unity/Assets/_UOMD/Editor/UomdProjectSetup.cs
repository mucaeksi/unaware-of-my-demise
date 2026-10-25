using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Uomd.EditorTools
{
    /// <summary>
    /// Idempotent project configuration so a fresh clone (no ProjectSettings assets, no .meta files) becomes the
    /// UOMD Android/URP 2D project. Menu: UOMD/Apply Project Setup.
    /// Batch: Unity -batchmode -quit -projectPath apps/unity -executeMethod Uomd.EditorTools.UomdProjectSetup.ApplyBatch
    /// </summary>
    [InitializeOnLoad]
    public static class UomdProjectSetup
    {
        public const string MainScenePath = "Assets/_UOMD/Scenes/UomdMain.unity";
        public const string SettingsDir = "Assets/_UOMD/Settings";
        public const string RendererPath = SettingsDir + "/UomdRenderer2D.asset";
        public const string PipelinePath = SettingsDir + "/UomdURP2D.asset";
        public const string ApplicationId = "io.github.mucaeksi.unawareofmydemise";
        public const string IconPath = "Assets/_UOMD/Branding/app_icon_512.png";

        static UomdProjectSetup()
        {
            // First interactive open of a fresh clone: configure once, after the asset database settles.
            if (Application.isBatchMode) return;
            EditorApplication.delayCall += () =>
            {
                if (GraphicsSettings.defaultRenderPipeline == null) Apply();
            };
        }

        [MenuItem("UOMD/Apply Project Setup")]
        public static void Apply()
        {
            EditorSettings.serializationMode = SerializationMode.ForceText;
            VersionControlSettings.mode = "Visible Meta Files";

            ConfigureRenderPipeline();
            ConfigurePlayer();
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(MainScenePath, true) };

            AssetDatabase.SaveAssets();
            Debug.Log("[UOMD] Project setup applied (URP 2D, Android IL2CPP ARM64 landscape, build scenes).");
        }

        public static void ApplyBatch()
        {
            try
            {
                Apply();
                EditorApplication.Exit(0);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                EditorApplication.Exit(1);
            }
        }

        private static void ConfigureRenderPipeline()
        {
            Directory.CreateDirectory(SettingsDir);
            AssetDatabase.Refresh();

            var renderer = AssetDatabase.LoadAssetAtPath<Renderer2DData>(RendererPath);
            if (renderer == null)
            {
                renderer = ScriptableObject.CreateInstance<Renderer2DData>();
                AssetDatabase.CreateAsset(renderer, RendererPath);
            }

            var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(PipelinePath);
            if (pipeline == null)
            {
                pipeline = UniversalRenderPipelineAsset.Create(renderer);
                AssetDatabase.CreateAsset(pipeline, PipelinePath);
            }

            GraphicsSettings.defaultRenderPipeline = pipeline;
            int current = QualitySettings.GetQualityLevel();
            for (int i = 0; i < QualitySettings.names.Length; i++)
            {
                QualitySettings.SetQualityLevel(i, false);
                QualitySettings.renderPipeline = pipeline;
            }
            QualitySettings.SetQualityLevel(current, false);
        }

        private static void ConfigurePlayer()
        {
            var android = NamedBuildTarget.Android;
            PlayerSettings.companyName = "mucaeksi";
            PlayerSettings.productName = "Unaware of My Demise";
            PlayerSettings.SetApplicationIdentifier(android, ApplicationId);
            PlayerSettings.SetScriptingBackend(android, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetApiCompatibilityLevel(android, ApiCompatibilityLevel.NET_Standard);
            PlayerSettings.SetManagedStrippingLevel(android, ManagedStrippingLevel.Low);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel25; // Unity 6.3 minimum
            // Credential Manager 1.5, Billing 8 and Ads 24 require compileSdk/targetSdk 35.
            PlayerSettings.Android.targetSdkVersion = (AndroidSdkVersions)35;

            PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;

            string versionName = Environment.GetEnvironmentVariable("UOMD_VERSION_NAME");
            if (!string.IsNullOrEmpty(versionName)) PlayerSettings.bundleVersion = versionName;
            string versionCode = Environment.GetEnvironmentVariable("UOMD_VERSION_CODE");
            if (int.TryParse(versionCode, out int code) && code > 0) PlayerSettings.Android.bundleVersionCode = code;

            var icon = AssetDatabase.LoadAssetAtPath<Texture2D>(IconPath);
            if (icon != null)
            {
                PlayerSettings.SetIcons(NamedBuildTarget.Unknown, new[] { icon }, IconKind.Any);
            }
            else
            {
                Debug.LogWarning($"[UOMD] App icon not found at {IconPath}.");
            }

            // Studio/Title screens are the brand intro; keep Unity's splash minimal and on-palette.
            PlayerSettings.SplashScreen.backgroundColor = new Color(0.039f, 0.024f, 0.063f, 1f); // #0a0610
            PlayerSettings.SplashScreen.unityLogoStyle = PlayerSettings.SplashScreen.UnityLogoStyle.LightOnDark;
        }
    }
}
