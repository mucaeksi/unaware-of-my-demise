using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using Uomd.Core;

namespace Uomd.Scenes
{
    public sealed partial class UomdSceneRouter
    {
        private UomdAccountActions _accountActions;
        public UomdAccountActions AccountActions
        {
            get
            {
                bool memoryOnly = false;
#if UNITY_EDITOR
                memoryOnly = UomdEditorPreviewIsolation.Active;
#endif
                return _accountActions ??= new UomdAccountActions(this, memoryOnly);
            }
        }
    }
    /// <summary>One saved economic intent per account; plain team/equip writes are read back rather than blindly retried.</summary>
    public sealed class UomdAccountActions
    {
        private readonly UomdSceneRouter _router;
        private readonly UomdActionJournal _journal;
        private string _account;
        private int _revision;
        public UomdSavedAction Action { get; private set; }
        public bool Busy { get; private set; }
        public bool Refreshed { get; private set; }
        public string Notice { get; private set; } = "";
        public bool Current => _account == _router.Api.AccountKey && _revision == _router.Api.AuthRevision && _router.Api.IsSignedIn;
        public bool Blocked => Busy || Current && (Action?.State == "pending" || Action?.State == "confirmed" && !Refreshed);
#if UNITY_EDITOR
        public Func<string, string, Dictionary<string, object>, Awaitable<Dictionary<string, object>>> ReviewSend;
        public Func<string, Awaitable<Dictionary<string, object>>> ReviewRead;
#endif
        public UomdAccountActions(UomdSceneRouter router, bool memoryOnly)
        { _router = router; _journal = new UomdActionJournal(Path.Combine(Application.persistentDataPath, "uomd_actions", "v1"), memoryOnly); }
        public void Bind()
        {
            if (Current) return;
            Action = null; Notice = ""; Refreshed = false; _account = null;
            if (!_router.Api.IsSignedIn) return;
            string account = _router.Api.AccountKey; var loaded = _journal.Load(UomdSavedAction.ScopeFor(account));
            _account = account; _revision = _router.Api.AuthRevision; Action = loaded;
            if (loaded != null) Notice = loaded.State == "pending" ? "An original action is saved. Check / retry it before spending again." : "Last action confirmed. Refresh your account before spending again.";
        }
        private void Check(string account, int revision)
        { if (!Current || account != _account || revision != _revision) throw new OperationCanceledException("Account changed. Your original action is preserved."); }
        private void Changed() => _router.HubState.Touch();
        public async Awaitable<bool> ExecuteAsync(string path, Dictionary<string, object> body, string summary)
        {
            if (Busy) return false;
            string callbackAccount = _router.Api.AccountKey; int callbackRevision = _router.Api.AuthRevision;
            string approvedRelease = _router.Patch.ActiveReleaseId;
            Busy = true; Changed();
            try
            {
                Bind(); if (!Current || Action?.State == "pending" || Action?.State == "confirmed" && !Refreshed || !_router.HubState.Fresh || _router.HubState.Snapshot.Maintenance) return false;
                if (string.IsNullOrWhiteSpace(summary)) throw new InvalidDataException("Original cost details are required.");
                string payload = CanonicalJson.Serialize(new Dictionary<string, object>(body) { ["releaseId"] = approvedRelease, ["requestId"] = UomdApiClient.NewRequestId() });
                if (Action?.State == "rejected")
                {
                    string account = _account; int revision = _revision;
                    var status = await Read("/api/v1/operations/" + Action.RequestId + "?path=" + Uri.EscapeDataString(Action.Path)); Check(account, revision);
                    var result = Action.ConfirmedStatus(status);
                    if (result != null)
                    {
                        var confirmed = UomdSavedAction.Decode(Action.Encode(), Action.Scope); confirmed.State = "confirmed"; confirmed.Receipt = CanonicalJson.Serialize(result); _journal.Save(confirmed); Action = confirmed; Refreshed = false;
                        Notice = "The previous action was confirmed. Refresh it before spending again."; return false;
                    }
                }
                if (!_router.HubState.Fresh || _router.Patch.ActiveReleaseId != approvedRelease || _router.HubState.Snapshot.Release != approvedRelease) { Notice = "Content changed. Refresh and choose the action again."; return false; }
                var saved = new UomdSavedAction { Scope = UomdSavedAction.ScopeFor(_account), Path = path, Payload = payload, Summary = summary };
                saved.Validate(); _journal.Save(saved); Action = saved; Refreshed = false;
            }
            catch (Exception) { if (Current && _account == callbackAccount && _revision == callbackRevision) Notice = "The new action could not be saved or the previous outcome could not be checked. No new action was sent."; Changed(); return false; }
            finally { Busy = false; Changed(); }
            return await RecoverAsync();
        }
        public async Awaitable<bool> RecoverAsync()
        {
            if (Busy) return false;
            string callbackAccount = _router.Api.AccountKey; int callbackRevision = _router.Api.AuthRevision;
            Busy = true; Changed();
            try
            {
                Bind(); string account = _account; int revision = _revision; Check(account, revision);
                var action = Action; if (action == null) return false;
                if (action.State == "pending" || action.State == "rejected")
                {
                    Notice = "Checking the original saved action…"; Changed();
                    var status = await Read("/api/v1/operations/" + action.RequestId + "?path=" + Uri.EscapeDataString(action.Path)); Check(account, revision);
                    var result = action.ConfirmedStatus(status);
                    if (result == null)
                    {
                        if (action.Summary.Length == 0) throw new InvalidDataException("Original cost details are unavailable; only status recovery is safe.");
                        // Keep the original release even after a content cutover. Never manufacture replacement intent.
                        Notice = "Sending the original saved action…"; Changed();
                        try { result = await Send("POST", action.Path, action.Body); Check(account, revision); action.ValidateReceipt(result); }
                        catch (Exception sendError)
                        {
                            Check(account, revision);
                            status = await Read("/api/v1/operations/" + action.RequestId + "?path=" + Uri.EscapeDataString(action.Path)); Check(account, revision);
                            result = action.ConfirmedStatus(status);
                            if (result == null)
                            {
                                if (sendError is UomdApiException api && UomdSavedAction.DefinitiveRejection(api.Code))
                                {
                                    var rejected = UomdSavedAction.Decode(action.Encode(), action.Scope); rejected.State = "rejected"; rejected.RejectionCode = api.Code; _journal.Save(rejected); Action = rejected;
                                }
                                throw;
                            }
                        }
                    }
                    var confirmed = UomdSavedAction.Decode(action.Encode(), action.Scope); confirmed.State = "confirmed"; confirmed.Receipt = CanonicalJson.Serialize(result);
                    _journal.Save(confirmed); Action = confirmed;
                }
                Notice = "Action confirmed. Refreshing account…"; Changed();
                await _router.HubState.RefreshAsync(); Check(account, revision);
                if (!_router.HubState.Fresh) throw new IOException("Account refresh pending.");
                Refreshed = true; Notice = "Action confirmed. Account data refreshed."; return true;
            }
            catch (Exception)
            {
                if (Current && _account == callbackAccount && _revision == callbackRevision)
                {
                    Notice = Action?.State == "confirmed" ? "Action confirmed. Refresh is pending; check the saved action again." : Action?.State == "rejected" ? "The server declined this action (" + Action.RejectionCode.Replace('_', ' ') + "). Refresh your account before choosing a new action." : "Confirmation is pending. Your original action is retained; unknown status does not mean failure. Check / retry when connected.";
                    if (Action?.State == "rejected") _router.HubState.Invalidate();
                }
                return false;
            }
            finally { Busy = false; Changed(); }
        }
        public async Awaitable<bool> PlainAsync(string method, string path, Dictionary<string, object> body)
        {
            if (Busy) return false;
            string callbackAccount = _router.Api.AccountKey; int callbackRevision = _router.Api.AuthRevision;
            Busy = true; Changed();
            try
            {
                Bind(); string account = _account, release = _router.Patch.ActiveReleaseId; int revision = _revision;
                Check(account, revision);
                bool teamPath = System.Text.RegularExpressions.Regex.IsMatch(path, "^/api/v1/teams/[1-5](/activate|\\?releaseId=[a-z][a-z0-9_]{1,47})?$");
                bool equipment = System.Text.RegularExpressions.Regex.IsMatch(path, "^/api/v1/gear/[1-9][0-9]{0,15}/(equip|unequip)$");
                if ((!teamPath && !equipment) || (body != null && body.ContainsKey("requestId"))) throw new InvalidOperationException("Unsupported plain write.");
                if (!_router.HubState.Fresh || _router.HubState.Snapshot.Maintenance || Action?.State == "pending" || Action?.State == "confirmed" && !Refreshed) return false;
                Notice = "Saving account changes…"; Changed();
                await Send(method, path, body); Check(account, revision);
                if (release != _router.Patch.ActiveReleaseId) throw new OperationCanceledException();
                await _router.HubState.RefreshAsync(); Check(account, revision);
                if (!_router.HubState.Fresh) throw new IOException();
                var snapshot = _router.HubState.Snapshot;
                if (path.StartsWith("/api/v1/teams/", StringComparison.Ordinal))
                {
                    string slot = path.Substring("/api/v1/teams/".Length).Split('/', '?')[0];
                    var team = System.Linq.Enumerable.FirstOrDefault(JsonRead.Objects(snapshot.Teams, "teams"), t => JsonRead.Int(t, "slot").ToString(System.Globalization.CultureInfo.InvariantCulture) == slot);
                    bool matches = method == "DELETE" ? team == null : team != null;
                    if (method == "PUT") matches &= team != null && JsonRead.Str(team, "name") == JsonRead.Str(body, "name") && CanonicalJson.Serialize(JsonRead.Get(team, "members")) == CanonicalJson.Serialize(JsonRead.Get(body, "members"));
                    if (path.EndsWith("/activate", StringComparison.Ordinal)) matches &= team != null && JsonRead.Bool(team, "active");
                    if (!matches) throw new IOException();
                }
                else if (path.StartsWith("/api/v1/gear/", StringComparison.Ordinal))
                {
                    string id = path.Split('/')[4]; var gear = System.Linq.Enumerable.FirstOrDefault(JsonRead.Objects(snapshot.Gear, "gear"), g => JsonRead.Int(g, "id").ToString(System.Globalization.CultureInfo.InvariantCulture) == id);
                    if (gear == null || JsonRead.Str(gear, "equippedBy") != (path.EndsWith("/unequip", StringComparison.Ordinal) ? "" : JsonRead.Str(body, "characterId"))) throw new IOException();
                }
                Notice = "Changes saved. Account data refreshed."; return true;
            }
            catch (Exception)
            {
                if (Current && _account == callbackAccount && _revision == callbackRevision) { Notice = "The outcome could not be confirmed. Refresh your account and inspect the saved team or equipment before changing it again."; _router.HubState.Invalidate(); }
                return false;
            }
            finally { Busy = false; Changed(); }
        }
        private async Awaitable<Dictionary<string, object>> Read(string path)
        {
#if UNITY_EDITOR
            if (ReviewRead != null) return await ReviewRead(path);
#endif
            return await _router.Api.GetJsonAsync(path, ct: _router.destroyCancellationToken);
        }
        private async Awaitable<Dictionary<string, object>> Send(string method, string path, Dictionary<string, object> body)
        {
#if UNITY_EDITOR
            if (ReviewSend != null) return await ReviewSend(method, path, body);
#endif
            return await _router.Api.SendJsonAsync(method, path, body, idempotent: false, ct: _router.destroyCancellationToken);
        }
    }
}
