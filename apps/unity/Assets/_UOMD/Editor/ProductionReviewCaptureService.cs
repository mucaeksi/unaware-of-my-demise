using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.Scenes;

namespace Uomd.EditorTools
{
    [Serializable]
    public sealed class ProductionReviewCaptureMetadata
    {
        public int schema = 1;
        public string id, capturedAt, sourceCommit, workingTreeScope, contentRelease, scenario, lineId, assetId, sourceSha, entrySha;
        public int assetRevision, shot, width, height, errorsObserved;
        public double shotElapsed;
        public bool simulatedSafeArea, editorOnly = true;
        public string safeAreaDescription, imageSha, selectedAssetIdentity;
        public ProductionPreviewRequest settings;
        public Rect subtitleBounds, titleBounds, safeAreaBounds;
        public int stageCameras, stageLights, stageParticles;
        public string[] imagePaths = Array.Empty<string>();
        public string[] relatedAssetIdentities = Array.Empty<string>();
        public float bgmVolume, effectsVolume, voiceVolume;
        public bool actualMuted;
    }

    [InitializeOnLoad]
    public static class ProductionReviewCaptureService
    {
        public static bool Busy { get; private set; }
        public static int ErrorsObserved { get; private set; }
        public static string LastCapture { get; private set; }
        public static string LastError { get; private set; }

        static ProductionReviewCaptureService()
        {
            Application.logMessageReceived += (_, __, type) =>
            {
                if (ProductionReviewSession.Active && (type == LogType.Error || type == LogType.Exception || type == LogType.Assert)) ErrorsObserved++;
            };
            EditorApplication.playModeStateChanged += state => { if (state == PlayModeStateChange.EnteredPlayMode) ErrorsObserved = 0; };
        }

        public static async void Capture(ProductionReviewAsset selected, ProductionReviewStore store)
        {
            if (Busy) throw new InvalidOperationException("A capture is already in progress.");
            var router = ProductionReviewSession.Router;
            if (router == null || !router.ProductionPreviewReady) throw new InvalidOperationException("The real preview must finish loading first.");
            var opening = router.Controller<RebuildPrologueScreen>();
            if (router.ActiveScreenId == UomdScreenId.Prologue && opening.Loading) throw new InvalidOperationException("Wait for the selected opening plate.");
            Busy = true;
            LastError = "";
            bool paused = router.ProductionPreview.paused;
            Texture2D image = null;
            try
            {
                router.ProductionPreview.paused = true;
                router.ApplyPreviewControls();
                ProductionReviewViewport.Focus();
                await Awaitable.NextFrameAsync(router.destroyCancellationToken);
                await Awaitable.NextFrameAsync(router.destroyCancellationToken);
                await Awaitable.EndOfFrameAsync(router.destroyCancellationToken);
                var settings = JsonUtility.FromJson<ProductionPreviewRequest>(JsonUtility.ToJson(router.ProductionPreview));
                var catalog = ProductionReviewCatalog.Load(store.Root);
                var asset = catalog.FirstOrDefault(a => a.Scenario == settings.scenario);
                if (asset != null) ProductionReviewCatalog.VerifyTarget(store.Root, asset);
                string id = DateTime.UtcNow.ToString("yyyyMMddTHHmmssfff") + "_" + Guid.NewGuid().ToString("N").Substring(0, 8);
                string relative = "captures/" + id;
                image = ScreenCapture.CaptureScreenshotAsTexture();
                if (image == null || image.width < 1) throw new IOException("Game-view capture returned no pixels.");
                byte[] bytes = image.EncodeToPNG();
                string imagePath = ProductionReviewCatalog.Resolve(store.Root, "docs/review/" + relative + ".png");
                Directory.CreateDirectory(Path.GetDirectoryName(imagePath));
                File.WriteAllBytes(imagePath, bytes);
                var root = router.GetComponent<UIDocument>().rootVisualElement;
                var metadata = new ProductionReviewCaptureMetadata
                {
                    id = id, capturedAt = DateTime.UtcNow.ToString("o"), scenario = settings.scenario, contentRelease = router.Patch.ActiveReleaseId,
                    sourceCommit = Git(store.Root, "rev-parse HEAD"), workingTreeScope = Git(store.Root, "status --short"),
                    settings = settings, width = image.width, height = image.height, imageSha = Sha256Hash.ComputeHex(bytes), errorsObserved = ErrorsObserved,
                    selectedAssetIdentity = selected?.Identity, assetId = asset?.Id, assetRevision = asset?.Revision ?? 0, sourceSha = asset?.SourceSha, entrySha = asset?.EntrySha,
                    shot = router.ActiveScreenId == UomdScreenId.Prologue ? opening.CurrentShot : -1,
                    shotElapsed = router.ActiveScreenId == UomdScreenId.Prologue ? opening.ShotElapsed : 0,
                    simulatedSafeArea = settings.safeArea, safeAreaDescription = settings.safeArea ? "96 left/right, 28 top, 48 bottom authored panel px; representative only" : "none",
                    safeAreaBounds = root.Q<VisualElement>("screen-host").worldBound,
                    subtitleBounds = root.Q<Label>("shotBody")?.worldBound ?? root.Q<Label>("storyBody")?.worldBound ?? Rect.zero,
                    titleBounds = root.Q<VisualElement>("rebuildTitle")?.worldBound ?? Rect.zero,
                    bgmVolume = router.Audio.BgmVolume, effectsVolume = router.Audio.SfxVolume, voiceVolume = router.Audio.VoiceVolume, actualMuted = router.Audio.Muted
                };
                if (metadata.shot >= 0) metadata.lineId = router.Session.PrologueConfig.scenes[metadata.shot].line_id;
                if (router.ActiveScreenId == UomdScreenId.Story)
                {
                    var story = router.Controller<StoryScreenController>();
                    metadata.lineId = story.CurrentLineId;
                    metadata.imagePaths = story.ReviewImagePaths;
                    metadata.relatedAssetIdentities = catalog.Where(a => JsonRead.Arr(a.Entry, "outputs").Any(o => metadata.imagePaths.Contains(JsonRead.Str(o, "path"))))
                        .Select(a => a.Identity).ToArray();
                }
                var stage = GameObject.Find("SolCinematicStage");
                if (stage != null)
                {
                    metadata.stageCameras = stage.GetComponentsInChildren<Camera>().Length;
                    metadata.stageLights = stage.GetComponentsInChildren<UnityEngine.Rendering.Universal.Light2D>().Length;
                    foreach (var particles in stage.GetComponentsInChildren<ParticleSystem>()) metadata.stageParticles += particles.particleCount;
                }
                ProductionReviewStore.AtomicWrite(ProductionReviewCatalog.Resolve(store.Root, "docs/review/" + relative + ".json"), JsonUtility.ToJson(metadata, true) + "\n");
                var index = store.Read();
                index.captures.Add(new ProductionReviewCapture { id = id, scenario = settings.scenario, lineId = metadata.lineId, image = relative + ".png", metadata = relative + ".json", sha256 = metadata.imageSha });
                store.Write(index);
                LastCapture = imagePath;
                UnityEngine.Debug.Log("[Production Review] Saved Game view and source-bound metadata: " + relative);
            }
            catch (OperationCanceledException) { LastError = "Capture cancelled because the preview closed."; }
            catch (Exception e) { LastError = e.Message; UnityEngine.Debug.LogException(e); }
            finally
            {
                if (image != null) UnityEngine.Object.DestroyImmediate(image);
                if (router != null && router.ProductionPreview != null) { router.ProductionPreview.paused = paused; router.ApplyPreviewControls(); }
                Busy = false;
            }
        }

        private static string Git(string root, string arguments)
        {
            using var process = Process.Start(new ProcessStartInfo("git", arguments) { WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true });
            string result = process.StandardOutput.ReadToEnd();
            if (!process.WaitForExit(5000) || process.ExitCode != 0) throw new IOException("Could not establish source provenance with git.");
            return result.Trim();
        }
    }
}
