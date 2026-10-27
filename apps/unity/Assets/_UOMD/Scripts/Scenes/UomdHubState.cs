using System;
using System.Collections.Generic;
using System.Threading;
using UnityEngine;
using Uomd.Core;

namespace Uomd.Scenes
{
    public sealed partial class UomdSceneRouter
    {
        private UomdHubState _hubState;
        public UomdHubState HubState => _hubState ??= new UomdHubState(this);
    }
    /// <summary>Memory-only, account/release-bound reads. A partial refresh never replaces the last complete snapshot.</summary>
    public sealed class UomdHubState : IDisposable
    {
        private readonly UomdSceneRouter _router;
        private CancellationTokenSource _cancel;
        private int _generation, _revision;
        private string _release, _detailCharacter;
        private UomdScreenId _detailScreen;
        private bool _signedIn;
        public UomdHubSnapshot Snapshot { get; private set; }
        public bool Loading { get; private set; }
        public string Notice { get; private set; } = "";
        public int Version { get; private set; }
        public DateTimeOffset LoadedAtUtc { get; private set; }
        public string SelectedChapter = "", SelectedNode = "";
        public bool Hard;
        private UomdScreenId DetailScreen => _router.ActiveScreenId == UomdScreenId.Character || _router.ActiveScreenId == UomdScreenId.Gear || _router.ActiveScreenId == UomdScreenId.Library ? _router.ActiveScreenId : UomdScreenId.Home;
        public bool ContextCurrent => _router != null && _revision == _router.Api.AuthRevision && _signedIn == _router.Api.IsSignedIn && _release == _router.Patch.ActiveReleaseId && _detailScreen == DetailScreen && (_detailScreen != UomdScreenId.Character || _detailCharacter == _router.Session.SelectedUnitId);
        public bool Fresh => ContextCurrent && Snapshot != null && !Loading && Notice.Length == 0;
#if UNITY_EDITOR
        public Func<string, Awaitable<Dictionary<string, object>>> ReviewRead;
        public Func<Awaitable<string>> ReviewIndex;
#endif
        public UomdHubState(UomdSceneRouter router) { _router = router; }
        public void Touch() { ++Version; }
        public void Invalidate() { Notice = "Refresh account data before changing it again."; ++Version; }
        public void Cancel()
        {
            ++_generation; _cancel?.Cancel(); _cancel?.Dispose(); _cancel = null; Loading = false; ++Version;
        }
        public void Dispose() { Cancel(); Snapshot = null; }
        public async Awaitable RefreshAsync()
        {
            Cancel(); int generation = _generation;
            bool same = ContextCurrent;
            bool sameAccount = _revision == _router.Api.AuthRevision && _signedIn == _router.Api.IsSignedIn && _release == _router.Patch.ActiveReleaseId;
            _revision = _router.Api.AuthRevision; _signedIn = _router.Api.IsSignedIn; _release = _router.Patch.ActiveReleaseId; _detailScreen = DetailScreen; _detailCharacter = _router.Session.SelectedUnitId;
            if (!same) Snapshot = null;
            if (!sameAccount) { SelectedChapter = SelectedNode = ""; Hard = false; }
            _cancel = CancellationTokenSource.CreateLinkedTokenSource(_router.destroyCancellationToken);
            CancellationToken token = _cancel.Token;
            Loading = true; Notice = ""; ++Version;
            bool Current() => generation == _generation && ContextCurrent && !token.IsCancellationRequested;
            void Check() { if (!Current()) throw new OperationCanceledException(); }
            async Awaitable<Dictionary<string, object>> Read(string path)
            {
                Check(); Dictionary<string, object> response;
#if UNITY_EDITOR
                if (ReviewRead != null) response = await ReviewRead(path); else
#endif
                response = await _router.Api.GetJsonAsync(path, ct: token);
                Check(); return response;
            }
            try
            {
                string index;
#if UNITY_EDITOR
                if (ReviewIndex != null) index = await ReviewIndex(); else
#endif
                index = await _router.Patch.ReadTextAsync("chapters/chapter_index.json");
                Check(); var next = UomdHubSnapshot.Published(_release, UomdJson.ParseObject(index));
                if (_signedIn)
                {
                    var me = await Read("/api/v1/me");
                    string expected = _router.Api.GetCurrentSessionSnapshot()?.playerId;
                    if (!string.IsNullOrEmpty(expected) && JsonRead.Str(me, "id") != expected) throw new InvalidOperationException("Account identity mismatch.");
                    if (string.IsNullOrEmpty(expected))
                    {
                        var session = _router.Api.GetCurrentSessionSnapshot();
                        string player = UomdBattleWire.RequiredString(me, "id");
                        if (session == null || player.Length == 0) throw new InvalidOperationException("Account identity is unavailable.");
                        _router.Api.AdoptSession(new Uomd.Contracts.SessionDto { token = session.token, expiresAt = session.expiresAt, playerId = player });
                        throw new OperationCanceledException("Stable account identity resolved; refresh under its new auth revision.");
                    }
                    var wallet = await Read("/api/v1/wallet");
                    var mine = await Read("/api/v1/characters/mine?releaseId=" + Uri.EscapeDataString(_release));
                    var roster = await Read("/api/v1/characters?releaseId=" + Uri.EscapeDataString(_release));
                    var teams = await Read("/api/v1/teams");
                    var progress = await Read("/api/v1/progress");
                    var flags = await Read("/api/v1/flags");
                    next.Account(me, wallet, mine, roster, teams, progress, flags);
                    if (_detailScreen == UomdScreenId.Library)
                        next.Library = UomdLibrary.Parse(await Read("/api/v1/library?releaseId=" + Uri.EscapeDataString(_release)), _release);
                    if (_detailScreen == UomdScreenId.Character || _detailScreen == UomdScreenId.Gear)
                    {
                        var catalog = await Read("/api/v1/catalog?releaseId=" + Uri.EscapeDataString(_release));
                        var stacks = await Read("/api/v1/stacks");
                        var gear = await Read("/api/v1/gear?releaseId=" + Uri.EscapeDataString(_release));
                        Dictionary<string, object> stats = null;
                        if (_detailScreen == UomdScreenId.Character && next.Companions.Exists(c => c.Id == _detailCharacter && c.Available))
                        {
                            try { stats = await Read("/api/v1/characters/" + Uri.EscapeDataString(_router.Session.SelectedUnitId) + "/stats?releaseId=" + Uri.EscapeDataString(_release)); }
                            catch (UomdApiException) { Check(); } // Stats unavailable is displayed explicitly; no fabricated zero stats.
                        }
                        next.Details(catalog, stacks, gear, stats);
                    }
                }
                Check(); Snapshot = next; LoadedAtUtc = DateTimeOffset.UtcNow;
            }
            catch (OperationCanceledException) { }
            catch (Exception)
            {
                if (Current()) Notice = Snapshot == null ? "Account data could not be loaded. Retry when connected." : "Refresh failed. Previously loaded account data is shown; stage entry is paused until refresh succeeds.";
            }
            finally { if (generation == _generation) { Loading = false; ++Version; } }
        }
    }
}
