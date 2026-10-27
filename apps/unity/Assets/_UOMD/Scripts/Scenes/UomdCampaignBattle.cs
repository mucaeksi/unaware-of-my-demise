using System;
using System.IO;
using System.Linq;
using UnityEngine;
using Uomd.Combat;
using Uomd.Contracts;
using Uomd.Core;

namespace Uomd.Scenes
{
    /// <summary>Server-authoritative campaign boundary. The journal is committed before any claim leaves the device.</summary>
    public sealed class UomdCampaignBattle
    {
        private readonly UomdSceneRouter _router;
        private readonly UomdBattleJournal _journal;
        private string _key;
        private int _revision;
        private bool _busy;
        public bool MemoryOnly { get; }
        public UomdBattleOperation Operation { get; private set; }
        public string Notice { get; private set; } = "";
        public bool Busy => _busy;
        public bool IsCurrent => _router != null && _key == _router.Api.AccountKey && _revision == _router.Api.AuthRevision;
        public bool Confirmed => IsCurrent && Operation?.State == "confirmed";
        public bool Refreshed { get; private set; }
#if UNITY_EDITOR
        public Func<string, string, Awaitable<BattleStartReceipt>> ReviewStart;
        public Func<string, Awaitable<BattleReceipt>> ReviewSubmit;
        public Func<string, string, Awaitable<BattleOperationStatus>> ReviewStatus;
        public Func<Awaitable> ReviewRefresh;
        public Func<string, Awaitable<string>> ReviewContent;
#endif
        public UomdCampaignBattle(UomdSceneRouter router, bool memoryOnly)
        {
            _router = router; MemoryOnly = memoryOnly;
            _journal = new UomdBattleJournal(Path.Combine(Application.persistentDataPath, "uomd_battles", "v1"), memoryOnly);
        }
        public async Awaitable BindAsync()
        {
            if (!_router.Api.IsSignedIn) throw new InvalidOperationException("Sign in to play campaign stages and recover saved battles.");
            if (string.IsNullOrEmpty(_router.Api.GetCurrentSessionSnapshot()?.playerId))
            {
                int revision = _router.Api.AuthRevision;
                var me = await _router.Api.GetMeAsync(_router.destroyCancellationToken);
                if (revision != _router.Api.AuthRevision) throw new OperationCanceledException("Account changed.");
                var session = _router.Api.GetCurrentSessionSnapshot();
                if (session == null || string.IsNullOrEmpty(me.id)) throw new InvalidOperationException("Account identity is unavailable.");
                _router.Api.AdoptSession(new SessionDto { token = session.token, playerId = me.id, expiresAt = session.expiresAt });
            }
            string key = _router.Api.AccountKey;
            if (_key != key || _revision != _router.Api.AuthRevision)
            {
                var loaded = _journal.Load(UomdBattleOperation.ScopeFor(key));
                _key = key; _revision = _router.Api.AuthRevision; Operation = loaded; Refreshed = false;
                Notice = loaded?.Pending == true ? "Your battle result is saved. Account confirmation is pending."
                    : loaded?.State == "fighting" ? "Your previous battle was interrupted. Start the stage again when connected." : "";
            }
        }
        public string CallbackScope => (_key == null ? "unbound" : UomdBattleOperation.ScopeFor(_key)) + ":" + _revision + ":" + Operation?.RequestId;
        private void CheckScope(string key, int revision) { if (key != _key || revision != _revision || !IsCurrent) throw new OperationCanceledException("Account changed."); }
        private void CheckCurrent() { if (!IsCurrent) throw new OperationCanceledException("Account changed. The original saved battle has been preserved."); }
        public async Awaitable<bool> StartAsync(string node, string encounter)
        {
            if (_busy) return false;
            _busy = true;
            try
            {
                await BindAsync(); CheckCurrent();
                string key = _key; int revision = _revision;
                if (Operation?.Pending == true) throw new InvalidOperationException("Confirm your saved battle in Saved Actions before starting another stage.");
                if (Operation?.State == "rejected")
                {
                    var previous = Operation; var status = await StatusAsync(previous, revision); CheckScope(key, revision);
                    if (status.Confirmed)
                    {
                        var confirmed = UomdBattleOperation.Decode(previous.Encode(), previous.Scope); confirmed.Confirm(status.Result); _journal.Save(confirmed); Operation = confirmed;
                        Notice = "Your previous battle was confirmed. Refresh it in Saved Actions before starting again."; return false;
                    }
                }
                if (Operation?.State == "confirmed" && !Refreshed) await RefreshAccountAsync(key, revision);
                string release = _router.Patch.ActiveReleaseId;
                string pack = await ReadContentAsync("units/unit_pack.json"); CheckScope(key, revision);
                string data = await ReadContentAsync("encounters/" + encounter + ".json"); CheckScope(key, revision);
                BattleStartReceipt start;
#if UNITY_EDITOR
                if (ReviewStart != null) start = await ReviewStart(release, node); else
#endif
                start = await _router.Api.StartBattleAsync(release, node, revision, _router.destroyCancellationToken);
                CheckScope(key, revision);
                if (_router.Patch.ActiveReleaseId != release) throw new InvalidOperationException("Content changed while the battle was starting. Start the stage again.");
                bool owned = JsonRead.Str(UomdJson.ParseObject(data), "party_mode", "fixed") == "owned";
                if (owned && (start.PartyJson == "null" || start.SessionId == null)) throw new InvalidDataException("The server did not return the required frozen party.");
                // Verify the frozen party can construct this engine before allowing the scene to open.
                Uomd.Combat.Battle.Create(UnitPackDef.FromJson(pack), EncounterDef.FromJson(data), start.PartyJson == "null" ? null : CombatJson.Party(start.PartyJson));
                var operation = new UomdBattleOperation { Scope = UomdBattleOperation.ScopeFor(_key), Release = release, Node = node, Encounter = encounter,
                    RequestId = UomdApiClient.NewRequestId(), StartJson = CanonicalJson.Serialize(new System.Collections.Generic.Dictionary<string, object> {
                        ["sessionId"] = start.SessionId, ["party"] = UomdJson.Parse(start.PartyJson), ["expiresAt"] = start.ExpiresAt, ["catalogSha256"] = start.CatalogHash }),
                    PackHash = UomdBattleWire.Hash(pack), EncounterHash = UomdBattleWire.Hash(data) };
                _journal.Save(operation); Operation = operation; Refreshed = false;
                Notice = "Battle session saved. Rewards require account confirmation.";
                return true;
            }
            catch (Exception e) { if (IsCurrent || e is InvalidOperationException) Notice = Message(e); return false; }
            finally { _busy = false; }
        }
        public System.Collections.Generic.List<PartyMemberDef> PartyFor(string pack, string encounter)
        {
            CheckCurrent();
            if (Operation == null || Operation.State != "fighting" || !Operation.ContentMatches(_router.Patch.ActiveReleaseId, pack, encounter)) throw new InvalidOperationException("The battle content changed. Return to Chapters and start the stage again.");
            var start = Operation.Start;
            if (start.ExpiresAt != null && DateTimeOffset.Parse(start.ExpiresAt, System.Globalization.CultureInfo.InvariantCulture) <= DateTimeOffset.UtcNow) throw new InvalidOperationException("The battle session expired. Return to Chapters and start the stage again.");
            return start.PartyJson == "null" ? null : CombatJson.Party(start.PartyJson);
        }
        public async Awaitable<bool> SubmitVictoryAsync(BattleActionInputDto[] actions)
        {
            if (_busy) return false;
            try
            {
                CheckCurrent();
                if (Operation == null) throw new InvalidOperationException("No campaign battle session.");
                if (Operation.State == "fighting")
                {
                    var prepared = UomdBattleOperation.Decode(Operation.Encode(), Operation.Scope); prepared.Prepare(actions);
                    _journal.Save(prepared); Operation = prepared;
                }
            }
            catch (Exception e) { Notice = Message(e); return false; }
            return await RecoverAsync();
        }
        public async Awaitable<bool> RecoverAsync()
        {
            if (_busy) return false;
            _busy = true;
            UomdBattleOperation operation = null;
            try
            {
                await BindAsync(); CheckCurrent(); operation = Operation;
                string key = _key; int revision = _revision;
                if (operation == null || operation.State == "fighting") return false;
                if (operation.Pending || operation.State == "rejected")
                {
                    Notice = "Checking your saved battle…";
                    var status = await StatusAsync(operation, revision); CheckScope(key, revision);
                    BattleReceipt receipt = status.Result;
                    if (!status.Confirmed)
                    {
                        Notice = "Sending the original saved result…";
                        try
                        {
#if UNITY_EDITOR
                            if (ReviewSubmit != null) receipt = await ReviewSubmit(operation.Payload); else
#endif
                            receipt = await _router.Api.SubmitBattleAsync(operation.Payload, revision, _router.destroyCancellationToken);
                        }
                        catch (Exception submitError)
                        {
                            CheckScope(key, revision);
                            // A refused/expired response can follow a committed request whose first response was lost.
                            var final = await StatusAsync(operation, revision); CheckScope(key, revision);
                            if (!final.Confirmed)
                            {
                                if (submitError is UomdApiException rejection && (rejection.Code == "session_expired" || rejection.Code == "battle_not_won"))
                                {
                                    var refused = UomdBattleOperation.Decode(operation.Encode(), operation.Scope); refused.State = "rejected"; refused.RejectionCode = rejection.Code;
                                    _journal.Save(refused); Operation = operation = refused;
                                }
                                throw;
                            }
                            receipt = final.Result;
                        }
                    }
                    CheckScope(key, revision);
                    var confirmed = UomdBattleOperation.Decode(operation.Encode(), operation.Scope); confirmed.Confirm(receipt);
                    _journal.Save(confirmed); Operation = operation = confirmed;
                }
                await RefreshAccountAsync(key, revision);
                return true;
            }
            catch (Exception e)
            {
                if (IsCurrent) Notice = operation?.State == "confirmed" ? "Battle confirmed. Account refresh is pending; retry when connected."
                    : Message(e) + " Your original saved result is retained. Unknown status does not mean the battle failed.";
                return false;
            }
            finally { _busy = false; }
        }
        private async Awaitable RefreshAccountAsync(string key, int revision)
        {
            Notice = "Battle confirmed. Refreshing account progress and wallet…";
#if UNITY_EDITOR
            if (ReviewRefresh != null) await ReviewRefresh(); else
#endif
            {
                await _router.Api.GetJsonAsync("/api/v1/progress", ct: _router.destroyCancellationToken); CheckScope(key, revision);
                await _router.Api.GetWalletAsync(_router.destroyCancellationToken);
            }
            CheckScope(key, revision); Refreshed = true; Notice = "Battle confirmed. Account progress and wallet refreshed.";
        }
        public async Awaitable<string> ReadContentAsync(string path)
        {
#if UNITY_EDITOR
            if (ReviewContent != null) return await ReviewContent(path);
#endif
            return await _router.Patch.ReadTextAsync(path);
        }
        private async Awaitable<BattleOperationStatus> StatusAsync(UomdBattleOperation operation, int revision)
        {
#if UNITY_EDITOR
            if (ReviewStatus != null) return await ReviewStatus(operation.RequestId, operation.InputHash);
#endif
            return await _router.Api.BattleStatusAsync(operation.RequestId, operation.InputHash, revision, _router.destroyCancellationToken);
        }
        private static string Message(Exception e) => e is UomdApiException api
            ? api.Code == "session_expired" || api.Code == "session_used" || api.Code == "unknown_session" ? "The battle session cannot currently be accepted. Check the saved result again before starting over."
            : api.Code == "release_not_economic" || api.Code == "unknown_release" ? "This content release is currently unavailable. Retry the saved result after the release is restored."
            : api.Status == 401 || api.Code == "auth_changed" ? "Sign in to the original account to confirm this battle."
            : "Battle confirmation is unavailable. Retry when connected."
            : e is IOException || e is UnauthorizedAccessException ? "This device could not save the battle safely. Free storage and retry before leaving."
            : e.Message;
    }
}
