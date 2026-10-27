using System;
using System.Collections.Generic;
using UnityEngine;
using Uomd.Core;

namespace Uomd.Scenes
{
    /// <summary>Archive scenes and original non-reward completion, separate from entry and campaign checkpoints.</summary>
    public sealed partial class UomdEntryFlow
    {
        private string _readingAccount, _readingRelease, _readingTitle;
        private int _readingRevision;
        private bool _readingReplay;
        private UomdStoryCompletion _readingCompletion;
        public bool InReading => _readingEntry.Length > 0;
        public bool ReadingAtEnd { get; private set; }
        public bool ReadingBusy { get; private set; }
        public string ReadingNotice { get; private set; } = "";
        public string ReadingTitle => InReading ? _readingTitle : "";
        public bool ReadingIsReplay => InReading && _readingReplay;
        public string ReadingRequest => InReading ? _readingCompletion.Request : "";
        public string ReadingInputHash => InReading ? _readingCompletion.InputHash : "";
        public string ReadingScope => InReading ? _readingCompletion.Request + ":" + _readingIndex : null;
        public bool ReadingIsCurrent => InReading && _router.Api.IsSignedIn && _readingAccount == _router.Api.AccountKey
            && _readingRevision == _router.Api.AuthRevision && _readingRelease == _router.Patch.ActiveReleaseId;

        internal async Awaitable<Dictionary<string, object>> ReadArchiveAsync(string path)
        {
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active && _router.HubReview != null) return await _router.HubReview.ReadLibraryAsync(path);
#endif
            return await _router.Api.GetJsonAsync(path);
        }
        public async Awaitable PlayReadingAsync(UomdLibrary.Card card, List<string> scenes, string release)
        {
            if (!_router.Api.IsSignedIn || release != _router.Patch.ActiveReleaseId || InReading && ReadingAtEnd) return;
            _readingCompletion = new UomdStoryCompletion(release, card.Id, UomdApiClient.NewRequestId());
            StageIndex = 0; _campaignNode = ""; _campaignScope = "";
            _readingEntry = card.Id; _readingScenes = scenes; _readingIndex = 0; _readingReplay = card.Completed;
            _readingAccount = _router.Api.AccountKey; _readingRevision = _router.Api.AuthRevision;
            _readingRelease = release; _readingTitle = card.Title; ReadingAtEnd = ReadingBusy = false; ReadingNotice = "";
            await ShowReadingSceneAsync();
        }
        private async Awaitable ShowReadingSceneAsync()
        {
            if (!ReadingIsCurrent) return;
            Current = Phase.PostStory;
            _router.Session.ActiveStoryJson = _readingScenes[_readingIndex];
            _router.Session.ActiveStoryPath = _readingEntry;
            await _router.NavigateToAsync(UomdScreenId.Story);
        }
        private async Awaitable FinishReadingAsync()
        {
            if (!ReadingIsCurrent || ReadingBusy) return;
            if (_readingIndex + 1 < _readingScenes.Count)
            { ++_readingIndex; await ShowReadingSceneAsync(); return; }
            ReadingAtEnd = true;
            await RetryReadingCompletionAsync();
        }
        public async Awaitable RetryReadingCompletionAsync()
        {
            if (!ReadingAtEnd || !ReadingIsCurrent || ReadingBusy) return;
            string scope = ReadingScope; var completion = _readingCompletion;
            if (_readingReplay) { await CloseConfirmedReadingAsync(); return; }
            bool Current() => ReadingIsCurrent && ReadingScope == scope;
            ReadingBusy = true; ReadingNotice = "Checking the original reading completion…"; _router.HubState.Touch();
            try
            {
                var status = await ReadArchiveAsync("/api/v1/operations/" + completion.Request + "?path=" + Uri.EscapeDataString(UomdStoryCompletion.Path));
                if (!Current()) return;
                if (!completion.Status(status))
                {
                    var body = UomdJson.ParseObject(completion.Payload);
                    Dictionary<string, object> response;
#if UNITY_EDITOR
                    if (UomdEditorPreviewIsolation.Active && _router.HubReview != null) response = await _router.HubReview.CompleteLibraryAsync(body); else
#endif
                    response = await _router.Api.SendJsonAsync("POST", UomdStoryCompletion.Path, body, idempotent: false);
                    if (!Current()) return;
                    completion.Confirm(response);
                }
                if (!Current()) return;
                await CloseConfirmedReadingAsync();
            }
            catch (Exception)
            {
                if (Current()) ReadingNotice = "Reading completion is not confirmed yet. Check / retry the original reading when connected. No rewards are granted by reading.";
            }
            finally { if (Current()) { ReadingBusy = false; _router.HubState.Touch(); } }
        }
        private async Awaitable CloseConfirmedReadingAsync()
        { ClearReading(); Current = Phase.None; _router.HubState.Touch(); await _router.NavigateToAsync(UomdScreenId.Library); }
        public async Awaitable LeaveReadingAsync()
        {
            if (!InReading || ReadingBusy) return;
            if (!ReadingAtEnd) ClearReading();
            _router.Session.ActiveStoryJson = null; Current = Phase.None;
            await _router.NavigateToAsync(UomdScreenId.Library);
        }
        public async Awaitable AbortReadingAsync()
        { ClearReading(); Current = Phase.None; await _router.NavigateToAsync(UomdScreenId.Library); }
        private void ClearReading()
        {
            _readingEntry = ""; _readingScenes.Clear(); _readingIndex = 0;
            _readingCompletion = null; _readingAccount = _readingRelease = _readingTitle = null;
            ReadingAtEnd = ReadingBusy = _readingReplay = false; ReadingNotice = "";
            if (_router.Session != null) _router.Session.ActiveStoryJson = null;
        }
    }
}
