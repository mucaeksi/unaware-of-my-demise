#nullable enable
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;
using Uomd.Core;

namespace Uomd.EditorTools
{
    /// <summary>
    /// Project-specific Editor automation and inspection entry points for IvanMurzak/Unity-MCP
    /// (<c>com.ivanmurzak.unity.mcp</c>) and CLI batchmode verification.
    /// Callable via the Unity Editor menu (<c>UOMD/MCP/*</c>), <c>script-execute</c>, or custom MCP reflection tools.
    /// </summary>
    public static class UomdMcpEditorTools
    {
        public const string DefaultScreenshotRelativePath = "../../.cache/screenshots/unity_gameview.png";

        [MenuItem("UOMD/MCP/Verify StreamingAssets Bundle & Deterministic Math")]
        [Description("Verifies StreamingAssets/uomd_base/release.json presence and runs a deterministic Mulberry32Rng + UomdStatMath sanity check.")]
        public static string VerifyBundleAndParity()
        {
            string releasePath = Path.Combine(Application.streamingAssetsPath, "uomd_base/release.json");
            bool bundlePresent = File.Exists(releasePath);
            int fileCount = 0;
            string releaseId = "missing";

            if (bundlePresent)
            {
                var manifest = UomdJson.ParseObject(File.ReadAllText(releasePath));
                if (manifest.TryGetValue("release", out object? relObj) && relObj is Dictionary<string, object?> relDict)
                {
                    if (relDict.TryGetValue("id", out object? idVal) && idVal != null)
                    {
                        releaseId = idVal.ToString() ?? "unknown";
                    }
                }
                if (manifest.TryGetValue("files", out object? filesObj) && filesObj is List<object?> filesList)
                {
                    fileCount = filesList.Count;
                }
            }

            var rng = new Mulberry32Rng(42);
            double firstSample = rng.Next();
            uint rngSnapshot = rng.Snapshot();
            int sampleStars = UomdStatMath.ComputeVictoryStars(5, 0);

            var report = new Dictionary<string, object?>
            {
                ["ok"] = bundlePresent && sampleStars == 3,
                ["ivanMurzakMcpInstalled"] = IsIvanMurzakMcpActive(),
                ["bundlePresent"] = bundlePresent,
                ["releaseId"] = releaseId,
                ["manifestFileCount"] = fileCount,
                ["mulberry32Seed42First"] = firstSample,
                ["mulberry32Seed42Snapshot"] = (long)rngSnapshot,
                ["victoryStars5Alive"] = sampleStars
            };

            string json = CanonicalJson.Serialize(report);
            Debug.Log($"[UOMD MCP] VerifyBundleAndParity: {json}");
            return json;
        }

        [MenuItem("UOMD/MCP/Inspect Active Scene & URP 2D Status")]
        [Description("Returns a canonical JSON summary of the active Unity scene, root GameObjects, UIDocuments, SpriteRenderers, and URP 2D pipeline status.")]
        public static string InspectActiveSceneJson()
        {
            Scene activeScene = SceneManager.GetActiveScene();
            GameObject[] roots = activeScene.IsValid() ? activeScene.GetRootGameObjects() : Array.Empty<GameObject>();
            var rootNames = new List<object?>(roots.Length);
            for (int i = 0; i < roots.Length; i++)
            {
                rootNames.Add(roots[i].name);
            }

            int uiDocumentCount = UnityEngine.Object.FindObjectsByType<UIDocument>(FindObjectsSortMode.None).Length;
            int spriteRendererCount = UnityEngine.Object.FindObjectsByType<SpriteRenderer>(FindObjectsSortMode.None).Length;
            RenderPipelineAsset? pipeline = GraphicsSettings.defaultRenderPipeline;

            var summary = new Dictionary<string, object?>
            {
                ["sceneName"] = activeScene.name,
                ["scenePath"] = activeScene.path,
                ["isPlaying"] = EditorApplication.isPlaying,
                ["rootCount"] = roots.Length,
                ["roots"] = rootNames,
                ["uiDocumentCount"] = uiDocumentCount,
                ["spriteRendererCount"] = spriteRendererCount,
                ["renderPipelineAsset"] = pipeline != null ? pipeline.name : "none"
            };

            string json = CanonicalJson.Serialize(summary);
            Debug.Log($"[UOMD MCP] InspectActiveSceneJson: {json}");
            return json;
        }

        [MenuItem("UOMD/MCP/Capture GameView Screenshot")]
        [Description("Captures the active GameView to .cache/screenshots/unity_gameview.png for visual regression verification.")]
        public static string CaptureGameViewScreenshot()
        {
            return CaptureGameViewScreenshotToPath(DefaultScreenshotRelativePath);
        }

        public static string CaptureGameViewScreenshotToPath(string relativeOrFullPath)
        {
            string targetPath = string.IsNullOrWhiteSpace(relativeOrFullPath)
                ? DefaultScreenshotRelativePath
                : relativeOrFullPath;
            string fullPath = Path.GetFullPath(Path.Combine(Application.dataPath, targetPath));
            string? dir = Path.GetDirectoryName(fullPath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }

            ScreenCapture.CaptureScreenshot(fullPath);
            Debug.Log($"[UOMD MCP] Queued GameView screenshot capture to: {fullPath}");
            return fullPath;
        }

        public static bool IsIvanMurzakMcpActive()
        {
#if UOMD_IVANMURZAK_MCP
            return true;
#else
            return false;
#endif
        }
    }
}
