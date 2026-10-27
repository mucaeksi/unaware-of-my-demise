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
        public string safeAreaDescription, imageSha, selectedAssetIdentity, presentationState;
        public string unitState, unitFrame;
        public Rect unitBounds;
        public float unitFootY;
        public string battleLogHash;
        public int battleActionCount;
        public string campaignState, campaignRequestId, campaignInputHash, campaignNotice;
        public bool campaignMemoryOnly, campaignRefreshed;
        public string hubState, hubNotice, hubRelease, hubFixtureMode, hubIndexSource;
        public string accountActionState, accountActionPath, accountActionRequestId, accountActionInputHash;
        public bool accountActionRefreshed;
        public bool hubFixture;
        public bool awaitingPlayerAction;
        public string entryPhase, entryScreen;
        public int entryStage, entryTutorials;
        public long entrySequence;
        public bool entryLocalSaved, entryCloudConfirmed, entryPaused, entryMemoryOnly;
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
                if (settings.scenario.StartsWith("battle/", StringComparison.Ordinal))
                {
                    var paths = router.Controller<BattleScreenController>().ReviewImagePaths;
                    asset = catalog.FirstOrDefault(a => a.Class == "background" && JsonRead.Arr(a.Entry, "outputs").Any(o => paths.Contains(JsonRead.Str(o, "path"))));
                }
                var entryPaths = settings.scenario == "entry" || settings.scenario == "finish" ? EntryPaths(router) : Array.Empty<string>();
                if (entryPaths.Length > 0)
                    asset = catalog.OrderBy(a => a.Class == "background" ? 0 : 1).FirstOrDefault(a => JsonRead.Arr(a.Entry, "outputs").Any(o => entryPaths.Contains(JsonRead.Str(o, "path"))));
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
                if (metadata.shot >= 0 && metadata.shot < router.Session.PrologueConfig.scenes.Length) metadata.lineId = router.Session.PrologueConfig.scenes[metadata.shot].line_id;
                if (router.ActiveScreenId == UomdScreenId.Story)
                {
                    var story = router.Controller<StoryScreenController>();
                    metadata.lineId = story.CurrentLineId;
                    metadata.presentationState = story.PresentationState;
                    metadata.imagePaths = story.ReviewImagePaths;
                    metadata.relatedAssetIdentities = catalog.Where(a => JsonRead.Arr(a.Entry, "outputs").Any(o => metadata.imagePaths.Contains(JsonRead.Str(o, "path"))))
                        .Select(a => a.Identity).ToArray();
                }
                if (settings.scenario.StartsWith("unit/", StringComparison.Ordinal))
                {
                    var review = router.Controller<RebuildUnitReviewScreen>();
                    metadata.unitState = review.CurrentState;
                    metadata.unitFrame = review.CurrentFrame;
                    metadata.unitBounds = review.FrameBounds;
                    metadata.unitFootY = review.FootScreenY;
                    metadata.imagePaths = review.ImagePaths;
                    metadata.presentationState = review.Ready ? "unit_review" : "loading";
                    metadata.relatedAssetIdentities = catalog.Where(a => JsonRead.Arr(a.Entry, "outputs").Any(o => metadata.imagePaths.Contains(JsonRead.Str(o, "path"))))
                        .Select(a => a.Identity).ToArray();
                }
                if (settings.scenario.StartsWith("battle/", StringComparison.Ordinal) || (settings.scenario == "entry" || settings.scenario == "campaign") && router.ActiveScreenId == UomdScreenId.Battle)
                {
                    var battle = router.Controller<BattleScreenController>();
                    metadata.battleLogHash = battle.ReviewLogHash;
                    metadata.battleActionCount = battle.ReviewActions.Length;
                    metadata.awaitingPlayerAction = battle.AwaitingPlayer;
                    metadata.presentationState = battle.ReviewPresentationState;
                    metadata.imagePaths = battle.ReviewImagePaths;
                    metadata.relatedAssetIdentities = catalog.Where(a => JsonRead.Arr(a.Entry, "outputs").Any(o => metadata.imagePaths.Contains(JsonRead.Str(o, "path"))))
                        .Select(a => a.Identity).ToArray();
                }
                if (settings.scenario == "entry" || settings.scenario == "finish")
                {
                    var continuity = router.EntryFlow.Continuity; var checkpoint = continuity.State;
                    metadata.entryScreen = router.ActiveScreenId.ToString(); metadata.entryPhase = checkpoint?.Phase ?? "unstarted";
                    metadata.entryStage = checkpoint?.Stage ?? 0; metadata.entryTutorials = checkpoint?.Tutorials ?? 0;
                    metadata.entrySequence = checkpoint?.Sequence ?? 0; metadata.entryLocalSaved = continuity.LocalSaved;
                    metadata.entryMemoryOnly = continuity.MemoryOnly;
                    metadata.entryCloudConfirmed = checkpoint?.CloudConfirmed ?? false;
                    metadata.entryPaused = router.ActiveScreenId == UomdScreenId.Prologue ? opening.Paused || settings.paused
                        : router.ActiveScreenId == UomdScreenId.Battle && router.Controller<BattleScreenController>().ReviewPaused;
                    metadata.imagePaths = entryPaths;
                    metadata.relatedAssetIdentities = catalog.Where(a => JsonRead.Arr(a.Entry, "outputs").Any(o => entryPaths.Contains(JsonRead.Str(o, "path")))).Select(a => a.Identity).ToArray();
                }
                if (settings.scenario == "campaign")
                {
                    var campaign = router.EntryFlow.Campaign;
                    metadata.entryScreen = router.ActiveScreenId.ToString(); metadata.entryPhase = router.EntryFlow.Current.ToString();
                    metadata.campaignState = campaign.Operation?.State; metadata.campaignRequestId = campaign.Operation?.RequestId;
                    metadata.campaignInputHash = campaign.Operation?.InputHash; metadata.campaignNotice = campaign.Notice;
                    metadata.campaignMemoryOnly = campaign.MemoryOnly; metadata.campaignRefreshed = campaign.Refreshed;
                }
                if (settings.scenario.StartsWith("hub/", StringComparison.Ordinal))
                {
                    RebuildHubScreen hub = null;
                    if (router.ActiveScreenId == UomdScreenId.Home) hub = router.Controller<HomeScreen>();
                    else if (router.ActiveScreenId == UomdScreenId.Roster) hub = router.Controller<RosterScreen>();
                    else if (router.ActiveScreenId == UomdScreenId.Chapters) hub = router.Controller<ChaptersScreen>();
                    else if (router.ActiveScreenId == UomdScreenId.Character) hub = router.Controller<CompanionScreen>();
                    else if (router.ActiveScreenId == UomdScreenId.Team) hub = router.Controller<TeamScreen>();
                    else if (router.ActiveScreenId == UomdScreenId.Gear) hub = router.Controller<ArmoryScreen>();
                    else if (router.ActiveScreenId == UomdScreenId.Operations) hub = router.Controller<SavedActionsScreen>();
                    if (hub != null)
                    {
                        metadata.imagePaths = hub.ReviewImagePaths; metadata.hubState = hub.ReviewState;
                        metadata.relatedAssetIdentities = catalog.Where(a => JsonRead.Arr(a.Entry, "outputs").Any(o => metadata.imagePaths.Contains(JsonRead.Str(o, "path")))).Select(a => a.Identity).ToArray();
                    }
                    if (hub == null)
                    {
                        metadata.imagePaths = EntryPaths(router);
                        metadata.relatedAssetIdentities = catalog.Where(a => JsonRead.Arr(a.Entry, "outputs").Any(o => metadata.imagePaths.Contains(JsonRead.Str(o, "path")))).Select(a => a.Identity).ToArray();
                    }
                    metadata.entryPhase = hub == null ? router.EntryFlow.Current.ToString() : metadata.hubState;
                    metadata.entryScreen = router.ActiveScreenId.ToString(); metadata.hubNotice = router.HubState.Notice;
                    metadata.hubRelease = router.HubState.Snapshot?.Release; metadata.hubFixture = true;
                    metadata.hubFixtureMode = router.HubReview?.Mode;
                    if (router.AccountActions.Current && router.AccountActions.Action != null)
                    {
                        metadata.accountActionState = router.AccountActions.Action.State; metadata.accountActionPath = router.AccountActions.Action.Path;
                        metadata.accountActionRequestId = router.AccountActions.Action.RequestId; metadata.accountActionInputHash = router.AccountActions.Action.InputHash;
                        metadata.accountActionRefreshed = router.AccountActions.Refreshed;
                    }
                    metadata.hubIndexSource = metadata.hubFixtureMode == "campaign" || metadata.hubFixtureMode == "long" || metadata.hubFixtureMode == "low_ration"
                        ? "content/patches/rel_0003_part1_campaign/chapters/chapter_index.json" : "embedded:chapters/chapter_index.json";
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
                index.captures.Add(new ProductionReviewCapture { id = id, scenario = settings.scenario, lineId = metadata.lineId, unitState = metadata.unitState, unitFrame = metadata.unitFrame,
                    entryScreen = metadata.entryScreen, entryPhase = metadata.entryPhase, entryStage = metadata.entryStage, sourceIdentities = metadata.relatedAssetIdentities,
                    image = relative + ".png", metadata = relative + ".json", sha256 = metadata.imageSha });
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

        private static string[] EntryPaths(UomdSceneRouter router)
        {
            switch (router.ActiveScreenId)
            {
                case UomdScreenId.Story: return router.Controller<StoryScreenController>().ReviewImagePaths;
                case UomdScreenId.Battle: return router.Controller<BattleScreenController>().ReviewImagePaths;
                case UomdScreenId.Finish: return router.Controller<FinishScreenController>().ReviewImagePaths;
                case UomdScreenId.Title: return new[] { router.Media.Catalog.Ui("sol_title_bg") };
                case UomdScreenId.Prologue:
                    int shot = router.Controller<RebuildPrologueScreen>().CurrentShot;
                    var scenes = router.Session.PrologueConfig.scenes;
                    return shot >= 0 && shot < scenes.Length ? new[] { router.Media.Catalog.Still("sol_prologue_" + scenes[shot].id) } : Array.Empty<string>();
                default: return Array.Empty<string>();
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
