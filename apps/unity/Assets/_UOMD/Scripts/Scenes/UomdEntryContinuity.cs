using System;
using System.IO;
using System.Text;
using UnityEngine;
using Uomd.Contracts;
using Uomd.Core;
using Uomd.Narrative;

namespace Uomd.Scenes
{
    /// <summary>Account-scoped entry cursor and local-first coarse checkpoint sync. No economy/campaign authority.</summary>
    public sealed class UomdEntryContinuity
    {
        private readonly UomdSceneRouter _router;
        private readonly UomdEntryCheckpointStore _store;
        private string _key;
        private bool _writeBlocked, _syncing;
        public UomdEntryCheckpoint State { get; private set; }
        public bool MemoryOnly { get; }
        public bool LocalSaved { get; private set; }
        public string Notice { get; private set; } = "";
        public bool IsCurrent => _router != null && State != null && _key == _router.Api.AccountKey;
        public bool HasDeviceCheckpoint
        {
            get
            {
                try { var state = IsCurrent ? State : _store.Load(UomdEntryCheckpoint.ScopeFor(_router.Api.AccountKey)); return state.Sequence > 0; }
                catch (Exception) { return false; }
            }
        }
        public string SaveText => (MemoryOnly ? "REVIEW FIXTURE · " : "") + SaveStatusText;
        private string SaveStatusText => !IsCurrent ? "Your account changed. Return to the title to continue."
            : !LocalSaved ? "This device could not save your place. Try saving again before leaving."
            : !_router.Api.IsSignedIn ? "Progress saved on this device. Sign in to save future progress to your account."
            : State.CloudConfirmed ? "Progress saved on this device and confirmed by your account."
            : _syncing ? "Progress saved on this device. Saving to your account…"
            : "Progress saved on this device. Account confirmation is pending; retry when connected.";
#if UNITY_EDITOR
        public Func<Awaitable<EntryCheckpointDto>> ReviewRead;
        public Func<EntryUpdateRequestDto, Awaitable<EntryCheckpointDto>> ReviewWrite;
#endif
        public UomdEntryContinuity(UomdSceneRouter router, bool memoryOnly)
        {
            _router = router; MemoryOnly = memoryOnly;
            _store = new UomdEntryCheckpointStore(Path.Combine(Application.persistentDataPath, "uomd_entry", "v1"), memoryOnly);
        }
        public async Awaitable PrepareAsync()
        {
            if (_router.Api.IsSignedIn && string.IsNullOrEmpty(_router.Api.GetCurrentSessionSnapshot()?.playerId))
            {
                string before = _router.Api.AccountKey;
                var me = await _router.Api.GetMeAsync(_router.destroyCancellationToken);
                if (before != _router.Api.AccountKey) throw new OperationCanceledException("Account changed.");
                var session = _router.Api.GetCurrentSessionSnapshot();
                if (session == null || string.IsNullOrEmpty(me.id)) throw new InvalidOperationException("Account identity is unavailable.");
                _router.Api.AdoptSession(new SessionDto { token = session.token, expiresAt = session.expiresAt, playerId = me.id });
            }
            string key = _router.Api.AccountKey;
            if (State == null || key != _key)
            {
                bool changed = State != null;
                _key = key; _writeBlocked = false; LocalSaved = false;
                try { State = _store.Load(UomdEntryCheckpoint.ScopeFor(key)); LocalSaved = true; Notice = _store.ReadIssue; }
                catch (NotSupportedException) { _writeBlocked = true; State = new UomdEntryCheckpoint { Scope = UomdEntryCheckpoint.ScopeFor(key) }; Notice = "This checkpoint needs a newer app. Its saved file has been preserved."; }
                catch (Exception e) when (e is IOException || e is UnauthorizedAccessException) { State = new UomdEntryCheckpoint { Scope = UomdEntryCheckpoint.ScopeFor(key) }; Notice = "The local checkpoint is unavailable."; }
                _router.Session.Account = new AccountPayloadDto { playerId = _router.Api.GetCurrentSessionSnapshot()?.playerId ?? "" };
                _router.EntryFlow.ResetForIdentity();
                if (changed && (_router.ActiveScreenId == UomdScreenId.Prologue || _router.ActiveScreenId == UomdScreenId.Story
                    || _router.ActiveScreenId == UomdScreenId.Battle || _router.ActiveScreenId == UomdScreenId.Finish))
                    await _router.NavigateToAsync(UomdScreenId.Title);
            }
            if (_writeBlocked) throw new InvalidOperationException(Notice);
            if (_router.Api.IsSignedIn)
            {
                try
                {
                    EntryCheckpointDto record;
#if UNITY_EDITOR
                    if (ReviewRead != null) record = await ReviewRead(); else
#endif
                    record = await _router.Api.GetEntryAsync(_router.destroyCancellationToken);
                    if (!IsCurrent || key != _key) throw new OperationCanceledException("Account changed.");
                    MergeConfirmed(record, true);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception) { Notice = "Account confirmation is unavailable. Your local entry checkpoint is retained."; }
            }
            if (!IsCurrent || key != _key) throw new OperationCanceledException("Account changed.");
            if (State.Release != _router.Patch.ActiveReleaseId)
            {
                State.Release = _router.Patch.ActiveReleaseId; State.ClearCursor(); State.Shot = 0; State.AutoRead = false;
                State.Phase = State.Completed ? "complete" : !State.PrologueDone ? "prologue" : State.Tutorials < 3 ? "pre_story" : "finish";
                State.Stage = State.Tutorials < 3 && State.PrologueDone ? State.Tutorials + 1 : 0;
            }
            ApplyAccount(); Save();
        }
        private void ApplyAccount()
        {
            var account = _router.Session.Account;
            account.storyProgress.prologueDone = State.PrologueDone; account.tutorialStep = State.Tutorials;
        }
        public bool Save()
        {
            if (!IsCurrent || _writeBlocked) { LocalSaved = false; return false; }
            try { State.Sequence++; _store.Save(State); LocalSaved = true; return true; }
            catch (Exception e) when (e is IOException || e is InvalidDataException || e is UnauthorizedAccessException || e is NotSupportedException)
            { LocalSaved = false; Notice = "The device could not save the entry checkpoint."; Debug.LogWarning("[Entry] Local save unavailable: " + e.GetType().Name); return false; }
        }
        public void Phase(string phase, int stage, string path = "")
        {
            if (!IsCurrent) return;
            if (State.Phase != phase || State.Stage != stage || State.StoryPath != path) State.ClearCursor();
            State.Phase = phase; State.Stage = stage; State.StoryPath = path; Save();
        }
        public int PrologueShot(string json)
        {
            if (!IsCurrent) return 0;
            string hash = Hash(json);
            if (State.ContentHash != hash || State.Phase != "prologue") State.Shot = 0;
            State.Phase = "prologue"; State.ContentHash = hash; Save(); return State.Shot;
        }
        public void SaveShot(int shot)
        {
            if (!IsCurrent || _router.Session.IsReplayingIntro || shot < 0 || shot > 63) return;
            State.Shot = shot; Save();
        }
        public void PrologueFinished()
        {
            if (!IsCurrent) return;
            State.PrologueDone = true; State.ClearCursor(); State.Phase = "pre_story"; State.Stage = State.Tutorials + 1;
            if (State.Stage > 3) { State.Stage = 0; State.Phase = "finish"; }
            State.RequestId = UomdApiClient.NewRequestId(); ApplyAccount(); Save();
        }
        public StorySaveDto RestoreStory(string path, string json, StorySceneDto scene)
        {
            if (!IsCurrent || State.StoryPath != path || State.Phase != "pre_story" && State.Phase != "post_story") return null;
            string hash = Hash(json);
            if (State.ContentHash == hash && State.SceneId == scene.scene_id && State.StoryIndex < scene.commands.Length)
                return new StorySaveDto { sceneId = scene.scene_id, index = State.StoryIndex, choices = State.Choices, flags = new System.Collections.Generic.Dictionary<string, bool>(State.Flags, StringComparer.Ordinal) };
            State.ClearCursor(); State.StoryPath = path; State.ContentHash = hash; State.SceneId = scene.scene_id; Save(); return null;
        }
        public void SaveStory(StorySaveDto save)
        {
            if (!IsCurrent || State.SceneId != save.sceneId) return;
            State.StoryIndex = save.index; State.Choices = save.choices; State.Flags = new System.Collections.Generic.Dictionary<string, bool>(save.flags, StringComparer.Ordinal); Save();
        }
        public void SetAutoRead(bool enabled) { if (IsCurrent) { State.AutoRead = enabled; Save(); } }
        public void TutorialFinished(int index)
        {
            if (!IsCurrent || index < 1 || index > 3) return;
            State.PrologueDone = true; State.Tutorials = Math.Max(State.Tutorials, index); State.ClearCursor();
            State.Stage = index < 3 ? index + 1 : 0; State.Phase = index < 3 ? "pre_story" : "finish";
            State.RequestId = UomdApiClient.NewRequestId(); ApplyAccount(); Save();
        }
        public bool RequestCompletion()
        {
            if (!IsCurrent || !State.PrologueDone || State.Tutorials != 3) return false;
            if (!State.Completed) State.RequestId = UomdApiClient.NewRequestId();
            State.Completed = true; State.Phase = "finish"; return Save();
        }
        public bool Restarted() { if (!IsCurrent) return false; State.Phase = "complete"; State.ClearCursor(); return Save(); }
        public async Awaitable<bool> SyncAsync()
        {
            while (_syncing) { await Awaitable.NextFrameAsync(); if (!IsCurrent) return false; }
            if (!IsCurrent || !LocalSaved) return false;
            if (!_router.Api.IsSignedIn || State.CloudConfirmed) return true;
            string key = _key; string scope = State.Scope;
            if (State.RequestId.Length == 0) { State.RequestId = UomdApiClient.NewRequestId(); if (!Save()) return false; }
            var payload = new EntryUpdateRequestDto { prologue = State.PrologueDone, tutorials = State.Tutorials, completed = State.Completed, requestId = State.RequestId };
            _syncing = true;
            try
            {
                EntryCheckpointDto result;
#if UNITY_EDITOR
                if (ReviewWrite != null) result = await ReviewWrite(payload); else
#endif
                result = await _router.Api.PutEntryAsync(payload, _router.destroyCancellationToken);
                if (!IsCurrent || key != _key || scope != State.Scope) return false;
                MergeConfirmed(result, false); return Save() && State.CloudConfirmed;
            }
            catch (Exception) { if (IsCurrent) Notice = "Account confirmation is pending. The same checkpoint can be retried."; return false; }
            finally { _syncing = false; }
        }
        private void MergeConfirmed(EntryCheckpointDto record, bool restore)
        {
            if (record == null || record.tutorials < 0 || record.tutorials > 3 || record.tutorials > 0 && !record.prologue ||
                record.phase != "not_started" && record.phase != "in_progress" && record.phase != "completed" ||
                record.phase == "completed" && (!record.prologue || record.tutorials != 3)) throw new InvalidDataException("Invalid account checkpoint.");
            State.CloudPrologue |= record.prologue; State.CloudTutorials = Math.Max(State.CloudTutorials, record.tutorials); State.CloudCompleted |= record.phase == "completed";
            if (restore && (record.tutorials > State.Tutorials || record.prologue && !State.PrologueDone || State.CloudCompleted && !State.Completed))
            {
                State.PrologueDone |= record.prologue; State.Tutorials = Math.Max(State.Tutorials, record.tutorials); State.Completed |= State.CloudCompleted;
                State.ClearCursor(); State.Stage = State.Tutorials < 3 ? State.Tutorials + 1 : 0;
                State.Phase = State.Completed ? "complete" : State.Tutorials == 3 ? "finish" : State.PrologueDone ? "pre_story" : "prologue";
            }
        }
        private static string Hash(string text) => Sha256Hash.ComputeHex(Encoding.UTF8.GetBytes(text));
    }
}
