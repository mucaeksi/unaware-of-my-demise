#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Uomd.Core;

namespace Uomd.Scenes
{
    public sealed partial class UomdHubReview
    {
        public string AccountMode = "ready", AccountOpenedUrl = "", AccountLastPath = "", AccountLastBody = "", AccountExportHash = "";
        public int AccountWrites, AccountApplied, AccountExports, AccountNativeCalls, AccountExchanges;
        public AwaitableCompletionSource<bool> AccountReadGate, AccountWriteGate, AccountNativeGate, AccountExchangeGate;
        public readonly Dictionary<string, int> AccountLocal = new Dictionary<string, int> { ["t1"] = 1, ["t3"] = 3 };
        private readonly Dictionary<string, Dictionary<string, object>> _accountSaves = new Dictionary<string, Dictionary<string, object>>();
        public readonly HashSet<string> AccountDeleted = new HashSet<string>();
        private Dictionary<string, object> AccountSave(string player)
        {
            if (!_accountSaves.TryGetValue(player, out var save)) _accountSaves[player] = save = Graph(new { version = 3L, updatedAt = "2026-10-27T20:00:00Z", data = new { progress = new { t1 = new { stars = 3L }, t2 = new { stars = 2L } }, prefs = new { language = "en" }, continuityFixture = "preserve" } });
            return save;
        }
        public async Awaitable<Dictionary<string, object>> AccountRead(string path)
        {
            if (!UomdEditorPreviewIsolation.Active) throw new InvalidOperationException("Account fixtures require isolation.");
            string player = _router.Api.GetCurrentSessionSnapshot()?.playerId ?? "guest", mode = AccountMode;
            var gate = AccountReadGate; AccountReadGate = null; if (gate != null) await gate.Awaitable; else await Awaitable.NextFrameAsync();
            if (mode == "offline") throw new UomdApiException(0, "fixture_offline", "Isolated account read failure.");
            if (path == "/api/v1/me") return Graph(new { id = player, displayName = "Traveler fixture" });
            if (path == "/api/v1/account/export")
            {
                if (mode == "export_error") throw new UomdApiException(503, "fixture_export", "Isolated export failure.");
                return Graph(new { exportedAt = "2026-10-27T20:00:00Z", profile = new { id = mode == "wrong_export" ? "other_player" : player, display_name = "Traveler fixture" }, truncated = new { ledger = false }, cloudSave = new[] { AccountSave(player) } });
            }
            if (mode == "malformed") return Graph(new { version = -1, data = new object[0], updatedAt = "invalid" });
            if (mode == "empty" && !_accountSaves.ContainsKey(player)) _accountSaves[player] = Graph(new { version = 0L, data = new Dictionary<string, object>(), updatedAt = (string)null });
            return Graph(AccountSave(player));
        }
        public async Awaitable<Dictionary<string, object>> AccountSend(string method, string path, Dictionary<string, object> body)
        {
            if (!UomdEditorPreviewIsolation.Active) throw new InvalidOperationException("Account fixtures require isolation.");
            string player = _router.Api.GetCurrentSessionSnapshot()?.playerId ?? "guest", mode = AccountMode; ++AccountWrites; AccountLastPath = path; AccountLastBody = CanonicalJson.Serialize(body);
            if (body.ContainsKey("requestId") || body.ContainsKey("releaseId")) throw new InvalidOperationException("Plain account write must preserve the strict provider schema.");
            var gate = AccountWriteGate; AccountWriteGate = null; if (gate != null) await gate.Awaitable; else await Awaitable.NextFrameAsync();
            if (mode == "write_offline") throw new UomdApiException(0, "fixture_write", "Isolated account write failure.");
            if (path == "/api/v1/save")
            {
                var original = AccountSave(player);
                if (mode == "save_conflict" || JsonRead.Int(body, "expectedVersion") != JsonRead.Int(original, "version")) throw new UomdApiException(409, "save_conflict", "Isolated conflict.");
                if (method != "PUT" || body.Count != 2) throw new InvalidOperationException("Invalid cloud fixture body.");
                _accountSaves[player] = Graph(new { version = JsonRead.Int(original, "version") + 1, data = body["data"], updatedAt = "2026-10-27T21:00:00Z" }); ++AccountApplied;
                if (mode == "lose_upload") throw new UomdApiException(0, "fixture_response_lost", "Applied cloud response lost.");
                return Graph(new { version = JsonRead.Int(original, "version") + 1 });
            }
            if (path == "/api/v1/account/delete")
            {
                if (method != "POST" || body.Count != 1 || JsonRead.Str(body, "confirm") != "DELETE") throw new InvalidOperationException("Invalid deletion body.");
                AccountDeleted.Add(player); ++AccountApplied;
                if (mode == "lose_delete") throw new UomdApiException(0, "fixture_response_lost", "Applied deletion response lost.");
                return Graph(new { deleted = true, playerId = player });
            }
            if (path != "/api/v1/auth/logout" || method != "POST" || body.Count != 0) throw new InvalidOperationException("Invalid logout body.");
            ++AccountApplied; return Graph(new { ok = true });
        }
        public async Awaitable AccountNative(string kind)
        {
            if (!UomdEditorPreviewIsolation.Active) throw new InvalidOperationException("Native account fixtures require isolation.");
            string mode = AccountMode; ++AccountNativeCalls;
            var gate = AccountNativeGate; AccountNativeGate = null; if (gate != null) await gate.Awaitable; else await Awaitable.NextFrameAsync();
            if (mode == "native_error") throw new InvalidOperationException("Isolated native failure.");
        }
        public void AccountExport(string json)
        { if (!UomdEditorPreviewIsolation.Active) throw new InvalidOperationException("Export fixture requires isolation."); if (AccountMode == "storage_error") throw new System.IO.IOException("Isolated storage failure."); ++AccountExports; AccountExportHash = UomdBattleWire.Hash(json); }
        public async Awaitable AccountExchange()
        {
            if (!UomdEditorPreviewIsolation.Active) throw new InvalidOperationException("Sign-in fixtures require isolation.");
            string mode = AccountMode; ++AccountExchanges;
            _router.Api.AdoptSession(null); int attempt = _router.Api.AuthRevision;
            var gate = AccountExchangeGate; AccountExchangeGate = null; if (gate != null) await gate.Awaitable; else await Awaitable.NextFrameAsync();
            if (_router.Api.AuthRevision != attempt) throw new OperationCanceledException();
            if (mode == "sign_in_api_error") throw new UomdApiException(503, "fixture_auth_exchange", "Isolated account exchange failure.");
            _router.Api.AdoptSession(new Uomd.Contracts.SessionDto { token = "isolated-account-sign-in", playerId = "hub_review_signin", expiresAt = "2099-01-01T00:00:00Z" });
        }
    }
}
#endif
