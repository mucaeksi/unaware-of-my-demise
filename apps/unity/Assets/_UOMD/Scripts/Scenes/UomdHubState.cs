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
        private string _release;
        private bool _signedIn;
        public UomdHubSnapshot Snapshot { get; private set; }
        public bool Loading { get; private set; }
        public string Notice { get; private set; } = "";
        public int Version { get; private set; }
        public DateTimeOffset LoadedAtUtc { get; private set; }
        public string SelectedChapter = "", SelectedNode = "";
        public bool Hard;
        public bool ContextCurrent => _router != null && _revision == _router.Api.AuthRevision && _signedIn == _router.Api.IsSignedIn && _release == _router.Patch.ActiveReleaseId;
        public bool Fresh => ContextCurrent && Snapshot != null && !Loading && Notice.Length == 0;
#if UNITY_EDITOR
        public Func<string, Awaitable<Dictionary<string, object>>> ReviewRead;
        public Func<Awaitable<string>> ReviewIndex;
#endif
        public UomdHubState(UomdSceneRouter router) { _router = router; }
        public void Cancel()
        {
            ++_generation; _cancel?.Cancel(); _cancel?.Dispose(); _cancel = null; Loading = false; ++Version;
        }
        public void Dispose() { Cancel(); Snapshot = null; }
        public async Awaitable RefreshAsync()
        {
            Cancel(); int generation = _generation;
            bool same = ContextCurrent;
            _revision = _router.Api.AuthRevision; _signedIn = _router.Api.IsSignedIn; _release = _router.Patch.ActiveReleaseId;
            if (!same) { Snapshot = null; SelectedChapter = SelectedNode = ""; Hard = false; }
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
                    var wallet = await Read("/api/v1/wallet");
                    var mine = await Read("/api/v1/characters/mine?releaseId=" + Uri.EscapeDataString(_release));
                    var roster = await Read("/api/v1/characters?releaseId=" + Uri.EscapeDataString(_release));
                    var teams = await Read("/api/v1/teams");
                    var progress = await Read("/api/v1/progress");
                    var flags = await Read("/api/v1/flags");
                    next.Account(me, wallet, mine, roster, teams, progress, flags);
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
