#if UNITY_EDITOR
using System;
using UnityEditor;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Contracts;
using Uomd.Core;
using Uomd.Platform;

namespace Uomd.Scenes
{
    [Serializable]
    public sealed class ProductionPreviewRequest
    {
        public const string RequestKey = "Uomd.ProductionReview.Request";
        public string scenario = "title";
        public int shot;
        public bool paused, muted = true, reducedMotion, reduceFlash, subtitles = true, safeArea;
        public RebuildShotSettings presentation = new RebuildShotSettings();
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
                default:
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
                ProductionPreview = request;
                Session.IsReplayingIntro = true;
                Session.ReducedMotion = request.reducedMotion;
                Session.ReduceFlash = request.reduceFlash;
                Audio.SetPaused(false);
                Audio.Muted = request.muted;
                await NavigateToAsync(screen);
                if (this == null) return;
                if (screen == UomdScreenId.Title)
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
            if (_previewSafeRoot == null) return;
            // Representative landscape cutout + gesture inset, in authored panel coordinates; not device evidence.
            _previewSafeRoot.style.marginLeft = _previewSafeRoot.style.marginRight = ProductionPreview.safeArea ? 96 : 0;
            _previewSafeRoot.style.marginTop = ProductionPreview.safeArea ? 28 : 0;
            _previewSafeRoot.style.marginBottom = ProductionPreview.safeArea ? 48 : 0;
        }
    }
}
#endif
