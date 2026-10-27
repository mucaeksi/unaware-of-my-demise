#if UNITY_EDITOR
using System;
using UnityEditor;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Contracts;
using Uomd.Core;
using Uomd.Platform;
using Uomd.Narrative;

namespace Uomd.Scenes
{
    [Serializable]
    public sealed class ProductionPreviewRequest
    {
        public const string RequestKey = "Uomd.ProductionReview.Request";
        public string scenario = "title";
        public int shot;
        public string lineId = "";
        public string unitState = "idle";
        public int unitFrame;
        public bool paused, muted = true, reducedMotion, reduceFlash, subtitles = true, safeArea;
        public RebuildShotSettings presentation = new RebuildShotSettings();

        public string PortraitCharacter => PortraitParts.Length >= 2 ? PortraitParts[1] : "";
        public string PortraitVariant => PortraitParts.Length == 2 ? "composed" : PortraitParts.Length == 3 ? PortraitParts[2] : "";
        private string[] PortraitParts => scenario.StartsWith("portrait/", StringComparison.Ordinal) ? scenario.Split('/') : Array.Empty<string>();

        public string PortraitPath(UomdMediaCatalog catalog, string character, string emotion) =>
            PortraitVariant == "authored" ? catalog.SolPortrait(character, emotion)
            : catalog.PortraitImage(character, "sol_" + (character == PortraitCharacter ? PortraitVariant : "composed"));
    }

    public sealed partial class UomdSceneRouter
    {
        public ProductionPreviewRequest ProductionPreview { get; private set; }
        public bool ProductionPreviewReady { get; private set; }
        private VisualElement _previewSafeRoot;
        private bool _previewNavigation;

        private async Awaitable StartProductionPreviewAsync()
        {
            Session = new GameSessionState { IsReplayingIntro = true };
            Patch = new PatchManager();
            await Patch.InitializeAsync("http://127.0.0.1:1", memoryOnly: true);
            if (this == null) return;
            Api = new UomdApiClient("http://127.0.0.1:1");
            PlatformBridge = UomdPlatformBridgeFactory.Create();
            Audio = gameObject.AddComponent<AudioDirector>();
            Media = new UomdMediaLoader(Patch);
            EntryFlow = new UomdEntryFlow(this);
            await Media.LoadCatalogAsync();
            if (this == null) return;
            Audio.Media = Media;
            Session.PrologueConfig = JsonUtility.FromJson<PrologueConfigDto>(await Patch.ReadTextAsync("entry/prologue.json"));
            if (this == null) return;
            _uiDocument = GetComponent<UIDocument>();
            BuildRootVisualTree();
            RegisterAll28Screens();
            var request = JsonUtility.FromJson<ProductionPreviewRequest>(SessionState.GetString(ProductionPreviewRequest.RequestKey, "{}"));
            await PreviewAsync(request);
        }

        public async Awaitable PreviewAsync(ProductionPreviewRequest request)
        {
            if (!UomdEditorPreviewIsolation.Active) throw new InvalidOperationException("Production Review is not active.");
            if (_previewNavigation) throw new InvalidOperationException("Wait for the current preview to finish loading.");
            UomdScreenId screen;
            switch (request.scenario)
            {
                case "boot": screen = UomdScreenId.Boot; break;
                case "studio": screen = UomdScreenId.Studio; break;
                case "title": screen = UomdScreenId.Title; break;
                case "entry": screen = UomdScreenId.Title; break;
                case "finish": screen = UomdScreenId.Finish; break;
                default:
                    if (request.scenario.StartsWith("battle/", StringComparison.Ordinal))
                    {
                        string encounter = request.scenario.Substring(7);
                        if (!BattleScreenController.IsRebuiltTutorialEncounter(encounter)) throw new ArgumentException("Unknown rebuilt tutorial battle.");
                        Session.ActiveBattleEncounterId = encounter;
                        Register(new BattleScreenController(this));
                        screen = UomdScreenId.Battle;
                        break;
                    }
                    if (request.scenario.StartsWith("unit/", StringComparison.Ordinal))
                    {
                        string unit = request.scenario.Substring(5);
                        if (Array.IndexOf(RebuildUnitReviewScreen.Units, unit) < 0 || !Media.Catalog.TryGetUnitArt("sol_" + unit, out _))
                            throw new ArgumentException("Unknown rebuilt unit.");
                        if (Array.IndexOf(RebuildUnitReviewScreen.States, request.unitState) < 0)
                            throw new ArgumentException("Unknown unit animation state.");
                        Register(new RebuildUnitReviewScreen(this));
                        screen = UomdScreenId.Battle;
                        break;
                    }
                    if (request.scenario.StartsWith("story/", StringComparison.Ordinal))
                    {
                        if (!StoryScreenController.IsRebuiltStory(request.scenario.Substring(6))) throw new ArgumentException("Unknown rebuilt tutorial scene.");
                        screen = UomdScreenId.Story;
                        break;
                    }
                    if (request.scenario.StartsWith("portrait/", StringComparison.Ordinal))
                    {
                        if ((request.PortraitCharacter != "fadyme" && request.PortraitCharacter != "mahmut") ||
                            (request.PortraitVariant != "authored" && Media.Catalog.PortraitImage(request.PortraitCharacter, "sol_" + request.PortraitVariant) == null))
                            throw new ArgumentException("Unknown rebuilt portrait scenario.");
                        screen = UomdScreenId.Story;
                        if (string.IsNullOrEmpty(request.lineId)) request.lineId = request.PortraitCharacter == "fadyme" ? "tutorial_t1_before_003" : "tutorial_t1_before_002";
                        break;
                    }
                    if (!request.scenario.StartsWith("prologue/", StringComparison.Ordinal)) throw new ArgumentException("This scenario is not rebuilt yet.");
                    var shots = Session.PrologueConfig.scenes;
                    request.shot = Array.FindIndex(shots, s => "prologue/" + s.id == request.scenario);
                    if (request.shot < 0) throw new ArgumentException("Unknown canonical opening shot.");
                    screen = UomdScreenId.Prologue;
                    break;
            }
            request.presentation.Validate();
            ProductionPreviewReady = false;
            _previewNavigation = true;
            try
            {
                if ((request.scenario == "entry" || request.scenario == "finish") && request.scenario != ProductionPreview?.scenario)
                    EntryFlow = new UomdEntryFlow(this); // Dedicated memory fixtures must not become another rehearsal's progress.
                ProductionPreview = request;
                Session.IsReplayingIntro = request.scenario != "entry";
                Session.ReducedMotion = request.reducedMotion;
                Session.ReduceFlash = request.reduceFlash;
                Audio.SetPaused(false);
                Audio.Muted = request.muted;
                if (screen == UomdScreenId.Finish)
                {
                    await EntryFlow.Continuity.PrepareAsync();
                    EntryFlow.Continuity.PrologueFinished(); EntryFlow.Continuity.TutorialFinished(3);
                }
                if (screen == UomdScreenId.Story)
                {
                    Session.ActiveStoryPath = request.scenario.StartsWith("story/", StringComparison.Ordinal)
                        ? request.scenario + ".json" : "story/tutorial_t1_before.json";
                    Session.ActiveStoryJson = await Patch.ReadTextAsync(Session.ActiveStoryPath);
                    if (this == null) return;
                    var scene = JsonUtility.FromJson<StorySceneDto>(Session.ActiveStoryJson);
                    if (string.IsNullOrEmpty(request.lineId))
                        request.lineId = Array.Find(scene.commands, c => c.op == "say" || c.op == "narrate")?.line_id ?? "";
                    if (Array.FindIndex(scene.commands, c => c.line_id == request.lineId && (c.op == "say" || c.op == "narrate")) < 0)
                        throw new ArgumentException("Unknown canonical tutorial line.");
                    Audio.StopBgm(0.01f);
                }
                await NavigateToAsync(screen);
                if (this == null) return;
                if (screen == UomdScreenId.Title && request.scenario != "entry")
                {
                    _screenHost.Q<Button>("startButton").SetEnabled(false);
                    _screenHost.Q<Button>("replayButton").SetEnabled(false);
                    _screenHost.Q<Label>("statusText").text = "Production Review — account actions disabled";
                }
                _previewSafeRoot = _screenHost;
                ApplyPreviewControls();
                ProductionPreviewReady = true;
            }
            finally { _previewNavigation = false; }
        }

        public void ApplyPreviewControls()
        {
            if (ProductionPreview == null || Audio == null) return;
            Session.ReducedMotion = ProductionPreview.reducedMotion;
            Session.ReduceFlash = ProductionPreview.reduceFlash;
            Audio.Muted = ProductionPreview.muted;
            Audio.SetPaused(ProductionPreview.paused);
            if (ActiveScreenId == UomdScreenId.Battle && (ProductionPreview.scenario.StartsWith("battle/", StringComparison.Ordinal) || ProductionPreview.scenario == "entry"))
                Audio.SetPaused(Controller<BattleScreenController>().ReviewPaused);
            if (ActiveScreenId == UomdScreenId.Battle && ProductionPreview.scenario.StartsWith("unit/", StringComparison.Ordinal))
                Controller<RebuildUnitReviewScreen>()?.ApplyRequest();
            if (_previewSafeRoot == null) return;
            var dialogue = _previewSafeRoot.Q("storyDialogue");
            if (dialogue != null) dialogue.style.display = ProductionPreview.subtitles ? DisplayStyle.Flex : DisplayStyle.None;
            // Representative landscape cutout + gesture inset, in authored panel coordinates; not device evidence.
            _previewSafeRoot.style.marginLeft = _previewSafeRoot.style.marginRight = ProductionPreview.safeArea ? 96 : 0;
            _previewSafeRoot.style.marginTop = ProductionPreview.safeArea ? 28 : 0;
            _previewSafeRoot.style.marginBottom = ProductionPreview.safeArea ? 48 : 0;
        }
    }
}
#endif
