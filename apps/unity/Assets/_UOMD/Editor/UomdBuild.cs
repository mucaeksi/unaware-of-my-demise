using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Uomd.EditorTools
{
    /// <summary>
    /// Batch Android build. Env: UOMD_BUILD_OUTPUT (default Builds/Android/uomd.aab), UOMD_BUILD_APK=1 for an APK,
    /// UOMD_KEYSTORE_FILE / UOMD_KEYSTORE_PASSWORD / UOMD_KEY_ALIAS / UOMD_KEY_PASSWORD for release signing,
    /// UOMD_VERSION_CODE / UOMD_VERSION_NAME (applied by UomdProjectSetup).
    /// Unity -batchmode -quit -projectPath apps/unity -buildTarget Android -executeMethod Uomd.EditorTools.UomdBuild.BuildAndroidBatch
    /// </summary>
    public static class UomdBuild
    {
        public static void BuildAndroidBatch()
        {
            try
            {
                UomdProjectSetup.Apply();
                bool apk = Environment.GetEnvironmentVariable("UOMD_BUILD_APK") == "1";
                string output = Environment.GetEnvironmentVariable("UOMD_BUILD_OUTPUT");
                if (string.IsNullOrEmpty(output)) output = apk ? "Builds/Android/uomd.apk" : "Builds/Android/uomd.aab";
                Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output)));

                EditorUserBuildSettings.buildAppBundle = !apk;
                ConfigureSigning();

                var options = new BuildPlayerOptions
                {
                    scenes = new[] { UomdProjectSetup.MainScenePath },
                    locationPathName = output,
                    target = BuildTarget.Android,
                    options = BuildOptions.None
                };
                BuildReport report = BuildPipeline.BuildPlayer(options);
                Debug.Log($"[UOMD] Android build {report.summary.result}: {output} ({report.summary.totalSize} bytes, {report.summary.totalErrors} errors)");
                EditorApplication.Exit(report.summary.result == BuildResult.Succeeded ? 0 : 1);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                EditorApplication.Exit(1);
            }
        }

        /// <summary>Development Linux player used only by the cloud screenshot pipeline (unity_ci.sh capture).</summary>
        public static void BuildLinuxCaptureBatch()
        {
            try
            {
                var options = new BuildPlayerOptions
                {
                    scenes = new[] { UomdProjectSetup.MainScenePath },
                    locationPathName = "Builds/LinuxCapture/uomd.x86_64",
                    target = BuildTarget.StandaloneLinux64,
                    options = BuildOptions.Development
                };
                BuildReport report = BuildPipeline.BuildPlayer(options);
                Debug.Log($"[UOMD] Linux capture build {report.summary.result} ({report.summary.totalErrors} errors)");
                EditorApplication.Exit(report.summary.result == BuildResult.Succeeded ? 0 : 1);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                EditorApplication.Exit(1);
            }
        }

        private static void ConfigureSigning()
        {
            string keystore = Environment.GetEnvironmentVariable("UOMD_KEYSTORE_FILE");
            if (string.IsNullOrEmpty(keystore) || !File.Exists(keystore))
            {
                PlayerSettings.Android.useCustomKeystore = false; // debug-signed; not uploadable to Play
                Debug.LogWarning("[UOMD] UOMD_KEYSTORE_FILE not set: building debug-signed output.");
                return;
            }

            PlayerSettings.Android.useCustomKeystore = true;
            PlayerSettings.Android.keystoreName = keystore;
            PlayerSettings.Android.keystorePass = Environment.GetEnvironmentVariable("UOMD_KEYSTORE_PASSWORD");
            PlayerSettings.Android.keyaliasName = Environment.GetEnvironmentVariable("UOMD_KEY_ALIAS");
            PlayerSettings.Android.keyaliasPass = Environment.GetEnvironmentVariable("UOMD_KEY_PASSWORD")
                ?? Environment.GetEnvironmentVariable("UOMD_KEYSTORE_PASSWORD");
        }
    }
}
