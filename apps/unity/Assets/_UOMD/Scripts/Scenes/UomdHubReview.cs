#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using Uomd.Contracts;
using Uomd.Core;

namespace Uomd.Scenes
{
    public sealed partial class UomdSceneRouter
    {
        public UomdHubReview HubReview { get; private set; }
        private async Awaitable OpenHubReviewAsync()
        {
            Api.AdoptSession(new SessionDto { token = "isolated-hub-fixture", playerId = "hub_review", expiresAt = "2099-01-01T00:00:00Z" });
            _hubState?.Dispose(); _hubState = new UomdHubState(this);
            _accountActions = new UomdAccountActions(this, true);
            EntryFlow = new UomdEntryFlow(this);
            CampaignReview = new UomdCampaignReview(this); await CampaignReview.InitializeAsync();
            HubReview = new UomdHubReview(this); await HubReview.InitializeAsync();
        }
    }
    /// <summary>Explicit fake account reads over real published local content. No HTTP, credentials or device writes.</summary>
    public sealed partial class UomdHubReview
    {
        private readonly UomdSceneRouter _router;
        private List<object> _roster;
        public string Mode = "ready", LastRoute = "";
        public int Reads;
        public AwaitableCompletionSource<bool> Gate;
        public UomdHubReview(UomdSceneRouter router) { _router = router; }
        public async Awaitable InitializeAsync()
        {
            if (!UomdEditorPreviewIsolation.Active) throw new InvalidOperationException("Hub fixtures require isolated review.");
            var pack = UomdJson.ParseObject(await _router.Patch.ReadTextAsync("units/unit_pack.json"));
            _roster = JsonRead.Objects(pack, "units").Where(u => JsonRead.Str(u, "unit_id") == "fadyme" || JsonRead.Str(u, "unit_id") == "mahmut")
                .Select(u => (object)new Dictionary<string, object> { ["id"] = JsonRead.Str(u, "unit_id"), ["name_en"] = JsonRead.Str(u, "name_en"), ["rarity"] = 5,
                    ["element"] = JsonRead.Str(u, "element", "Dawn"), ["role"] = JsonRead.Str(u, "role", "guard") }).ToList();
            _router.HubState.ReviewRead = Read; _router.HubState.ReviewIndex = Index;
            _router.AccountActions.ReviewSend = Send; _router.AccountActions.ReviewRead = Status;
            await InitializeLibraryAsync();
        }
        private async Awaitable<string> Index()
        {
            await Awaitable.NextFrameAsync();
            if (Mode == "campaign" || Mode == "long" || Mode == "low_ration")
                return File.ReadAllText(Path.GetFullPath(Path.Combine(Application.dataPath, "../../..", "content/patches/rel_0003_part1_campaign/chapters/chapter_index.json")));
            return await _router.Patch.ReadTextAsync("chapters/chapter_index.json");
        }
        private async Awaitable<Dictionary<string, object>> Read(string path)
        {
            ++Reads; string mode = Mode, player = _router.Api.GetCurrentSessionSnapshot()?.playerId ?? "hub_review";
            var gate = Gate; Gate = null; if (gate != null) await gate.Awaitable; else await Awaitable.NextFrameAsync();
            if (mode == "offline") throw new UomdApiException(0, "fixture_offline", "Isolated fixture.");
            if (path.StartsWith("/api/v1/library", StringComparison.Ordinal)) return await ReadLibraryAsync(path);
            if (path == "/api/v1/stacks" || path.StartsWith("/api/v1/catalog?", StringComparison.Ordinal) || path.StartsWith("/api/v1/gear?", StringComparison.Ordinal) || path.Contains("/stats?")) return SystemRead(path, player, mode);
            var roster = new List<object>(_roster); var members = new List<object>();
            if (mode != "empty")
                foreach (var c in _roster) members.Add(new Dictionary<string, object> { ["id"] = JsonRead.Str(c, "id"), ["level"] = 12, ["copies"] = 1, ["shards"] = 4 });
            if (mode == "long")
                for (int i = 0; i < 24; i++)
                {
                    string id = "fixture_" + i;
                    roster.Add(new Dictionary<string, object> { ["id"] = id, ["name_en"] = "Long companion display name for layout verification " + i, ["rarity"] = 4, ["element"] = "Dawn", ["role"] = "support" });
                    members.Add(new Dictionary<string, object> { ["id"] = id, ["level"] = 20, ["copies"] = 2, ["shards"] = 45 });
                }
            foreach (var member in members) EnrichCharacter((Dictionary<string, object>)member, player, mode);
            var teams = mode == "empty" ? new object[0] : new object[] { new Dictionary<string, object> { ["slot"] = 1, ["name"] = "The Company", ["active"] = true,
                ["members"] = new object[] { new Dictionary<string, object> { ["characterId"] = "mahmut", ["slot"] = 0, ["row"] = "front" }, new Dictionary<string, object> { ["characterId"] = "fadyme", ["slot"] = 3, ["row"] = "rear" } } } };
            var progress = mode == "empty" ? new object[0] : new object[] { new Dictionary<string, object> { ["node_id"] = "t1", ["stars"] = 3, ["clears"] = 1 } };
            if (mode == "campaign" || mode == "low_ration")
            {
                var index = UomdJson.ParseObject(File.ReadAllText(Path.GetFullPath(Path.Combine(Application.dataPath, "../../..", "content/patches/rel_0003_part1_campaign/chapters/chapter_index.json"))));
                progress = JsonRead.Objects(index, "chapters").SelectMany(c => JsonRead.Objects(c, "nodes"))
                    .Select(n => (object)new Dictionary<string, object> { ["node_id"] = JsonRead.Str(n, "node_id"), ["stars"] = JsonRead.Str(n, "kind") == "battle" ? 3 : 0, ["clears"] = 1 }).ToArray();
            }
            object result;
            if (path == "/api/v1/me") result = new Dictionary<string, object> { ["id"] = player, ["displayName"] = player.EndsWith("_b", StringComparison.Ordinal) ? "Second account fixture" : mode == "long" ? "A deliberately long display name for the native hub account header" : "Traveler fixture" };
            else if (path == "/api/v1/wallet") result = new Dictionary<string, object> { ["wallets"] = new Dictionary<string, object> { ["eclipse_token"] = (player.EndsWith("_b", StringComparison.Ordinal) ? 730 : 1650) + (_walletDelta.TryGetValue(player,out int delta) ? delta : 0) } };
            else if (path.StartsWith("/api/v1/characters/mine", StringComparison.Ordinal)) result = new Dictionary<string, object> { ["account"] = new Dictionary<string, object> { ["level"] = mode == "ascend" ? 30 : 12 }, ["characters"] = members, ["unavailable"] = new object[0] };
            else if (path.StartsWith("/api/v1/characters?", StringComparison.Ordinal)) result = new Dictionary<string, object> { ["characters"] = roster };
            else if (path == "/api/v1/teams") result = new Dictionary<string, object> { ["teams"] = _savedTeams.TryGetValue(player, out var savedTeams) ? UomdJson.Parse(savedTeams) : teams };
            else if (path == "/api/v1/progress") result = new Dictionary<string, object> { ["nodes"] = progress, ["ration"] = new Dictionary<string, object> { ["value"] = mode == "low_ration" ? 0 : 114 - (_spentRation.TryGetValue(player, out int spent) ? spent : 0), ["cap"] = 120 }, ["sweep"] = new Dictionary<string, object> { ["periodKey"] = "d:2026-10-27", ["dailyLimit"] = 20, ["maxBatch"] = 10, ["usageByNode"] = SweepUsage(player) } };
            else if (path == "/api/v1/flags") result = new Dictionary<string, object> { ["flags"] = new Dictionary<string, object> { ["maintenance.read_only"] = new Dictionary<string, object> { ["enabled"] = mode == "maintenance" }, ["sweep.enabled"] = new Dictionary<string, object> { ["enabled"] = mode != "no_sweep" } } };
            else throw new InvalidOperationException("Unknown hub fixture endpoint: " + path);
            // Match the plain JSON graph of the real API (safe integer values are long, not CLR int).
            return UomdJson.ParseObject(CanonicalJson.Serialize(result));
        }
    }
}
#endif
