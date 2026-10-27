#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Uomd.Combat;
using Uomd.Contracts;
using Uomd.Core;

namespace Uomd.Scenes
{
    public sealed partial class UomdSceneRouter
    {
        public UomdCampaignReview CampaignReview { get; private set; }
        private async Awaitable OpenCampaignReviewAsync()
        {
            Api.AdoptSession(new SessionDto { token = "isolated-fixture-no-network", playerId = "campaign_review", expiresAt = "2099-01-01T00:00:00Z" });
            EntryFlow = new UomdEntryFlow(this);
            CampaignReview = new UomdCampaignReview(this);
            await CampaignReview.InitializeAsync();
            await EntryFlow.PlayNodeAsync("t1", "battle", "", "encounters/tutorial_t1.json");
            // This scenario isolates battle settlement; canonical pre/post-story remain available in the entry scenario.
            await EntryFlow.StoryFinishedAsync(EntryFlow.CallbackScope);
        }
    }

    /// <summary>Explicit memory-only server fixture; the API client's Production Review network block remains in force.</summary>
    public sealed class UomdCampaignReview
    {
        private readonly UomdSceneRouter _router;
        private string _pack, _encounter, _party, _committedPayload;
        private BattleReceipt _receipt;
        public string Mode = "offline";
        public int StartCalls, SubmitCalls, StatusCalls, RefreshCalls;
        public readonly List<string> SubmittedPayloads = new List<string>();
        public AwaitableCompletionSource<bool> StatusGate;
        public UomdCampaignReview(UomdSceneRouter router) { _router = router; }
        public async Awaitable InitializeAsync()
        {
            if (!UomdEditorPreviewIsolation.Active || !_router.EntryFlow.Campaign.MemoryOnly) throw new InvalidOperationException("Campaign fixtures require isolated Production Review.");
            _pack = await _router.Patch.ReadTextAsync("units/unit_pack.json");
            var encounter = UomdJson.ParseObject(await _router.Patch.ReadTextAsync("encounters/tutorial_t1.json"));
            _party = CanonicalJson.Serialize(encounter["party"]);
            encounter["party_mode"] = "owned"; encounter["party"] = Array.Empty<object>(); _encounter = CanonicalJson.Serialize(encounter);
            var campaign = _router.EntryFlow.Campaign;
            campaign.ReviewContent = ReadContent; campaign.ReviewStart = Start; campaign.ReviewSubmit = Submit; campaign.ReviewStatus = Status; campaign.ReviewRefresh = Refresh;
        }
        private async Awaitable<string> ReadContent(string path)
        {
            await Awaitable.NextFrameAsync();
            return path == "units/unit_pack.json" ? _pack : path == "encounters/tutorial_t1.json" ? _encounter : throw new InvalidOperationException("Unknown campaign fixture content.");
        }
        private async Awaitable<BattleStartReceipt> Start(string release, string node)
        {
            StartCalls++; await Awaitable.NextFrameAsync();
            return BattleStartReceipt.Parse(CanonicalJson.Serialize(new Dictionary<string, object> { ["sessionId"] = new string('a', 32), ["party"] = UomdJson.Parse(_party), ["expiresAt"] = "2099-01-01T00:00:00Z" }));
        }
        private async Awaitable<BattleReceipt> Submit(string payload)
        {
            SubmitCalls++; SubmittedPayloads.Add(payload); await Awaitable.NextFrameAsync();
            if (Mode == "offline") throw new UomdApiException(0, "fixture_offline", "Fixture connection unavailable.");
            if (Mode == "expired") throw new UomdApiException(409, "session_expired", "Fixture expired.");
            if (Mode == "release") throw new UomdApiException(409, "release_not_economic", "Fixture cutover.");
            var body = UomdJson.ParseObject(payload);
            var actions = JsonRead.Objects(body, "actions").Select(a => new PlayerAction(JsonRead.Str(a, "skillId"), JsonRead.Get(a, "targetId") as string)).ToList();
            var replay = BattleReplay.Replay(UnitPackDef.FromJson(_pack), EncounterDef.FromJson(_encounter), actions, CombatJson.Party(_party));
            if (!replay.Valid || !replay.Complete || replay.Result?.Winner != "player") throw new InvalidOperationException("Fixture replay did not win.");
            _committedPayload = payload;
            _receipt = BattleReceipt.Parse(CanonicalJson.Serialize(new Dictionary<string, object> { ["requestId"] = JsonRead.Str(body, "requestId"), ["nodeId"] = JsonRead.Str(body, "nodeId"),
                ["stars"] = replay.Result.Stars, ["bestStars"] = replay.Result.Stars, ["turns"] = replay.Result.Turns, ["firstClear"] = true, ["newThreeStar"] = replay.Result.Stars == 3,
                ["rewards"] = Array.Empty<object>(), ["ration"] = new Dictionary<string, object> { ["spent"] = 0, ["value"] = 120, ["cap"] = 120, ["nextMs"] = 0 }, ["replayed"] = false }));
            if (Mode == "lost") throw new UomdApiException(0, "fixture_response_lost", "Fixture response lost after commit.");
            return _receipt;
        }
        private async Awaitable<BattleOperationStatus> Status(string requestId, string hash)
        {
            StatusCalls++; if (StatusGate != null) await StatusGate.Awaitable; else await Awaitable.NextFrameAsync();
            bool found = _receipt != null && _receipt.RequestId == requestId && Mode != "lost";
            return BattleOperationStatus.Parse(CanonicalJson.Serialize(new Dictionary<string, object> { ["requestId"] = requestId, ["path"] = UomdBattleWire.Path,
                ["state"] = found ? "confirmed" : "unknown", ["binding"] = found ? "exact" : null, ["inputHash"] = found ? UomdBattleWire.Hash(_committedPayload) : null,
                ["result"] = found ? UomdJson.Parse(_receipt.Json) : null }), requestId, hash);
        }
        private async Awaitable Refresh() { RefreshCalls++; await Awaitable.NextFrameAsync(); }
    }
}
#endif
