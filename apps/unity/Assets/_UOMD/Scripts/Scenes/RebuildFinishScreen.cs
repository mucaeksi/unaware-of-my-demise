using System;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.Core.Patching;

namespace Uomd.Scenes
{
    /// <summary>Native Finish UI over the existing signed patch service and durable entry checkpoint.</summary>
    public sealed class FinishScreenController : IUomdScreenController
    {
        private readonly UomdSceneRouter _router;
        private VisualElement _root, _track, _fill;
        private Label _title, _body, _progress, _save, _notice;
        private Button _action, _retrySave;
        private IDisposable _subscription;
        private PatchServiceStatus _pending, _status;
        private int _generation;
        private bool _busy, _eligible;
        private string _backgroundPath;
        public UomdScreenId ScreenId => UomdScreenId.Finish;
        private UomdEntryContinuity Continuity => _router.EntryFlow.Continuity;
#if UNITY_EDITOR
        public string[] ReviewImagePaths => _backgroundPath == null ? Array.Empty<string>() : new[] { _backgroundPath };
        public Func<Awaitable<PatchOutcome>> ReviewActivation;
        public void SetReviewPatchStatus(PatchServiceStatus status)
        {
            if (!UomdEditorPreviewIsolation.Active || !Continuity.MemoryOnly) throw new InvalidOperationException("Review session required.");
            _pending = status;
        }
#endif
        public FinishScreenController(UomdSceneRouter router) => _router = router;
        public async Awaitable OnEnterAsync(VisualElement host)
        {
            int generation = ++_generation; _busy = false; _backgroundPath = null;
            Resources.Load<VisualTreeAsset>("Rebuild/Finish").CloneTree(host);
            _root = host.Q("rebuildFinish"); _title = _root.Q<Label>("finishTitle"); _body = _root.Q<Label>("finishBody");
            _progress = _root.Q<Label>("finishProgress"); _save = _root.Q<Label>("finishSaveStatus"); _notice = _root.Q<Label>("finishNotice");
            _track = _root.Q("finishTrack"); _fill = _root.Q("finishFill");
            _action = _root.Q<Button>("finishAction"); _retrySave = _root.Q<Button>("finishSave");
            _action.clicked += Act; _retrySave.clicked += RetrySave;
            if (!Continuity.IsCurrent) await Continuity.PrepareAsync();
            if (generation != _generation) return;
            _eligible = Continuity.State.PrologueDone && Continuity.State.Tutorials == 3;
            _router.Audio.PlayBgmCue("bgm_main_theme");
            _notice.text = Continuity.Notice;
            if (!_eligible)
            {
                _title.text = "THE STORY IS STILL WAITING"; _body.text = "Complete the opening and three tutorial stages before preparing the next road.";
                _action.text = "RETURN TO TITLE"; _track.style.display = DisplayStyle.None;
            }
            else
            {
#if UNITY_EDITOR
                if (UomdEditorPreviewIsolation.Active)
                {
                    _pending = PatchServiceStatus.Failed("Local review uses embedded content. Remote download and installation are unverified.");
                }
                else
#endif
                {
                    _subscription = _router.Patch.Service.Subscribe(s => _pending = s);
                    if (_router.Patch.Service.Status.Kind == PatchServiceKind.Idle) _ = _router.Patch.Service.StartAsync();
                }
                _ = Continuity.SyncAsync();
            }
            RenderSave();
            string path = _router.Media.Catalog.Background("sol_shelter_courtyard_dusk");
            var image = await _router.Media.TextureAsync(path);
            if (generation != _generation) return;
            if (image != null) { _root.Q("finishBackground").style.backgroundImage = new StyleBackground(image); _backgroundPath = path; }
        }
        private void Render(PatchServiceStatus status)
        {
            _status = status;
            _track.style.display = DisplayStyle.Flex;
            _fill.style.width = Length.Percent((status.BarFill ?? 0) * 100);
            if (status.Kind == PatchServiceKind.Ready)
            {
                _title.text = "THE ROAD IS READY";
                _body.text = status.Outcome?.Status == PatchStatus.Staged ? "The signed update is downloaded and verified. Save your progress, then reload to activate it."
                    : "Your content is up to date. Save your progress, then reload to continue.";
                _progress.text = "100% · READY"; _action.text = "SAVE, RELOAD & CONTINUE"; _action.SetEnabled(!_busy);
            }
            else if (status.Kind == PatchServiceKind.Failed)
            {
                _title.text = status.UpdateRequired ? "AN APP UPDATE IS REQUIRED" : "THE ROAD IS WAITING";
                _body.text = status.UpdateRequired ? "Install the current app version before continuing. Your entry progress is retained."
                    : status.RequiresNetworkApproval ? "The download is paused on this data-saving connection. You can approve mobile data below."
                    : "The download could not finish. Retry when connected; verified downloaded data is retained.";
                _notice.text = status.RequiresNetworkApproval ? "Downloads wait for your approval." : "Your story checkpoint is retained. Content activates only after verification succeeds.";
#if UNITY_EDITOR
                if (UomdEditorPreviewIsolation.Active) _notice.text = status.Detail;
#endif
                _progress.text = ""; _action.text = status.RequiresNetworkApproval ? "USE MOBILE DATA" : "TRY AGAIN";
                _action.SetEnabled(!_busy && !status.UpdateRequired);
            }
            else
            {
                _title.text = "PREPARING THE NEXT ROAD"; _body.text = "Downloading and verifying the next signed content update. You can pause the download and resume it later.";
                var p = status.Progress;
                _progress.text = p != null && p.BytesTotal > 0 ? FormatBytes(p.BytesDone) + " / " + FormatBytes(p.BytesTotal) : "Checking signed content…";
                _action.text = "PAUSE DOWNLOAD"; _action.SetEnabled(!_busy);
            }
        }
        private void RenderSave()
        {
            _save.text = Continuity.SaveText;
            _retrySave.style.display = !Continuity.LocalSaved || _router.Api.IsSignedIn && !Continuity.State.CloudConfirmed ? DisplayStyle.Flex : DisplayStyle.None;
            _retrySave.SetEnabled(!_busy);
        }
        private void RetrySave() { if (!_busy) _ = SaveAgainAsync(); }
        private async Awaitable SaveAgainAsync()
        {
            _busy = true; int generation = _generation;
            try { if (Continuity.Save()) await Continuity.SyncAsync(); }
            finally { if (generation == _generation) { _busy = false; RenderSave(); if (_status != null) Render(_status); } }
        }
        private void Act()
        {
            if (_busy) return;
            if (!_eligible) { _ = _router.NavigateToAsync(UomdScreenId.Title); return; }
            if (_status?.Kind == PatchServiceKind.Ready) { _ = RestartAsync(); return; }
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active) { _notice.text = "Remote operations are disabled in Production Review. Inject a scoped patch fixture to inspect its states."; return; }
#endif
            if (_status?.Kind == PatchServiceKind.Failed) _ = _router.Patch.Service.RetryAsync(_status.RequiresNetworkApproval ? true : (bool?)null);
            else _router.Patch.Service.Cancel();
        }
        private async Awaitable RestartAsync()
        {
            _busy = true; int generation = _generation; _action.SetEnabled(false); _retrySave.SetEnabled(false);
            try
            {
                if (!Continuity.RequestCompletion()) throw new InvalidOperationException("Your place could not be saved on this device. Retry saving before reloading.");
                _action.text = "SAVING…";
                if (!await Continuity.SyncAsync()) throw new InvalidOperationException("Account confirmation is pending. Your local checkpoint is retained; retry save and reload when connected.");
                if (generation != _generation) return;
                string expected = _router.Patch.StagedReleaseId;
                PatchOutcome outcome;
#if UNITY_EDITOR
                if (UomdEditorPreviewIsolation.Active && ReviewActivation != null) outcome = await ReviewActivation(); else
#endif
                outcome = await _router.Patch.ActivateStagedAsync();
                if (generation != _generation) return;
                if (outcome != null && (outcome.Status == PatchStatus.Rejected || outcome.Status == PatchStatus.Offline || outcome.Status == PatchStatus.RevertedToBase)
                    || expected != null && (_router.Patch.ActiveReleaseId != expected || _router.Patch.StagedReleaseId != null || outcome?.Status != PatchStatus.Applied))
                    throw new InvalidOperationException("The verified update could not be activated. Your checkpoint is saved. Retry reloading.");
                if (!Continuity.Restarted()) throw new InvalidOperationException("Content is ready, but this device could not save the reload checkpoint. Try again.");
                if (!Continuity.MemoryOnly) _router.Patch.EntryCompleted = true;
                await _router.NavigateToAsync(UomdScreenId.Studio);
            }
            catch (Exception e)
            {
                if (generation != _generation) return;
                _notice.text = e is InvalidOperationException ? e.Message : "Reload could not finish. Your entry checkpoint is retained. Try again.";
                _busy = false; _action.text = "RETRY SAVE & RELOAD"; _action.SetEnabled(true); RenderSave();
            }
        }
        public void OnTick(float deltaTime)
        {
            if (_pending != null) { var next = _pending; _pending = null; Render(next); }
            RenderSave();
        }
        public void OnExit()
        {
            ++_generation; _subscription?.Dispose(); _subscription = null; _pending = null;
            if (_action != null) _action.clicked -= Act;
            if (_retrySave != null) _retrySave.clicked -= RetrySave;
        }
        public static string FormatBytes(long n) => n < 1024 * 1024 ? Math.Max(0, (long)Math.Round(n / 1024.0)) + " KB"
            : (n / (1024.0 * 1024.0)).ToString("0.0", System.Globalization.CultureInfo.InvariantCulture) + " MB";
    }
}
