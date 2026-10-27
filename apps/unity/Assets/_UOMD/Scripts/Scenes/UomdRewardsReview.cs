#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using Uomd.Core;

namespace Uomd.Scenes
{
    /// <summary>Canonical invitation choices with synthetic account/clock/reward fixtures. No HTTP or device writes.</summary>
    public sealed partial class UomdHubReview
    {
        public const string RewardsSource = "content/patches/rel_0003_part1_campaign/chapters/chapter_index.json";
        public const string RewardsRosterSource = "narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content/characters_part1.json";
        public string RewardsMode = "ready";
        public long RewardsTime = DateTimeOffset.Parse("2026-10-27T20:00:00Z").ToUnixTimeMilliseconds();
        public bool RewardsLoseResponse;
        private Dictionary<string, object> _selector;
        private List<Dictionary<string, object>> _rewardCharacters;
        private readonly Dictionary<string, int> _inviteSpent = new Dictionary<string, int>(), _recruitCopies = new Dictionary<string, int>(), _recruitShards = new Dictionary<string, int>();
        private readonly Dictionary<string, long> _patrolCheckpoints = new Dictionary<string, long>();
        private readonly HashSet<string> _rewardClaims = new HashSet<string>();
        private readonly long _patrolInitial = DateTimeOffset.Parse("2026-10-27T19:00:00Z").ToUnixTimeMilliseconds();
        private void InitializeRewards()
        {
            string root = Path.GetFullPath(Path.Combine(Application.dataPath, "../../.."));
            _selector = JsonRead.Objects(UomdJson.ParseObject(File.ReadAllText(Path.Combine(root, RewardsSource))), "recruit_selectors").First();
            _rewardCharacters = JsonRead.Objects(UomdJson.ParseObject(File.ReadAllText(Path.Combine(root, RewardsRosterSource))), "characters").ToList();
        }
        private static bool RewardsPath(string path) => UomdSavedAction.InvitationPath(path) || path == UomdSavedAction.TaskPath || path == UomdSavedAction.SuppliesPath || path == UomdSavedAction.PatrolPath;
        private string SupplyPeriod => "supply:" + DateTimeOffset.FromUnixTimeMilliseconds(RewardsTime).ToString("yyyy-MM-dd");
        private string WindowPeriod => "d:" + DateTimeOffset.FromUnixTimeMilliseconds(RewardsTime).ToString("yyyy-MM-dd") + "T" + (DateTimeOffset.FromUnixTimeMilliseconds(RewardsTime).Hour < 12 ? "00" : "12");
        private long WindowEnd => DateTimeOffset.FromUnixTimeMilliseconds(RewardsTime).UtcDateTime.Date.AddHours(DateTimeOffset.FromUnixTimeMilliseconds(RewardsTime).Hour < 12 ? 12 : 24).Subtract(DateTime.UnixEpoch).Ticks / TimeSpan.TicksPerMillisecond;
        private int Copies(string player, string id) => _recruitCopies.TryGetValue(player + ":" + id, out int copies) ? copies : RewardsMode == "duplicate" && id == JsonRead.Arr(_selector, "choices").First().ToString() ? 1 : 0;
        private Dictionary<string, object> RewardChoice(string player, string id)
        {
            var c = _rewardCharacters.First(c => JsonRead.Str(c, "character_id") == id);
            return Graph(new { id, name_en = JsonRead.Str(c, "name_en"), rarity = 4, element = JsonRead.Str(c, "element"), role = JsonRead.Str(c, "combat_role"), copies = Copies(player, id) });
        }
        private void AddRewardMembers(List<object> roster, List<object> members, string player)
        {
            foreach (string id in JsonRead.Arr(_selector, "choices").Cast<string>())
            {
                int copies = Copies(player, id); if (copies < 1) continue;
                roster.Add(RewardChoice(player, id)); members.Add(Graph(new { id, level = 1, copies, shards = _recruitShards.TryGetValue(player + ":" + id, out int shards) ? shards : 0 }));
            }
        }
        private object RewardRow(string player, string id, string title, string period, bool done, bool weekly = false, bool running = true)
        {
            var row = Graph(new { id, title, progress = done ? 2 : 1, objective = new { type = "eligible_wins", count = 2 }, done, claimed = _rewardClaims.Contains(player + ":" + period + ":" + id), rewards = new[] { new { type = "currency", currency = "eclipse_token", amount = 10 } }, rewardNames = new Dictionary<string, object>() });
            if (weekly) { row["periodKey"] = period; row["startsAtMs"] = RewardsTime - 86400000L; row["endsAtMs"] = running ? RewardsTime + 86400000L : RewardsTime - 86400000L; row["running"] = running; }
            return row;
        }
        private Dictionary<string, object> RewardsRead(string path, string player)
        {
            if (RewardsMode == "offline") throw new UomdApiException(0, "fixture_offline", "Isolated reward fixture.");
            string release = RewardsMode == "wrong_release" ? "rel_other" : _router.Patch.ActiveReleaseId;
            if (path.StartsWith("/api/v1/recruitment/selectors", StringComparison.Ordinal))
            {
                int quantity = Math.Max(0, 1 - (_inviteSpent.TryGetValue(player, out int spent) ? spent : 0));
                var selectors = new List<object>();
                if (quantity > 0 && RewardsMode != "empty" && RewardsMode != "locked")
                    selectors.Add(new { itemId = JsonRead.Str(_selector, "item_id"), title = JsonRead.Str(_selector, "title_en"), quantity, duplicateShards = 5, choices = JsonRead.Arr(_selector, "choices").Cast<string>().Select(id => RewardChoice(player, id)).ToArray() });
                if (RewardsMode == "malformed") selectors.Add(new { itemId = "invalid_selector" });
                return Graph(new { releaseId = release, selectors });
            }
            if (path.StartsWith("/api/v1/afk?", StringComparison.Ordinal))
            {
                if (RewardsMode == "patrol_offline") throw new UomdApiException(503, "fixture_unavailable", "Isolated patrol read failure.");
                long previous = _patrolCheckpoints.TryGetValue(player, out long checkpoint) ? checkpoint : _patrolInitial;
                int elapsed = (int)Math.Min(43200, Math.Max(0, (RewardsTime - previous) / 1000)), minutes = elapsed / 60;
                bool unlocked = RewardsMode != "locked", claimable = unlocked && elapsed >= 60;
                return Graph(new { unlocked, claimable, elapsedSeconds = elapsed, capSeconds = 43200, minClaimSeconds = 60, serverTimeMs = RewardsTime, checkpointMs = previous, rewards = claimable ? PatrolRewards(minutes) : new object[0] });
            }
            var daily = new List<object>(); var weekly = new List<object>(); bool complete = RewardsMode == "complete";
            if (RewardsMode != "empty")
            {
                daily.Add(RewardRow(player, "win_two", "Win two eligible battles", WindowPeriod, true)); daily.Add(RewardRow(player, "improve", "Improve one companion", WindowPeriod, complete));
                if (RewardsMode == "long") for (int i = 0; i < 24; ++i) daily.Add(RewardRow(player, "fixture_task_" + i, "Long errand title for native scroll verification " + i, WindowPeriod, true));
                weekly.Add(RewardRow(player, "all_week", "This week's verified battles", "w:2026-10-26:all_week", true, true));
                weekly.Add(RewardRow(player, "past_week", "Earlier weekly reward terms", "w:2026-10-19:past_week", true, true, false));
            }
            return Graph(new { releaseId = release, serverTimeMs = RewardsTime, windowHours = 12, supplies = new { periodKey = SupplyPeriod, endsAtMs = UomdErrandsSnapshot.SupplyEnd(SupplyPeriod), amount = 80, claimed = _rewardClaims.Contains(player + ":" + SupplyPeriod + ":_daily_supplies"), periodBound = RewardsMode != "legacy_service" }, daily = daily.Count == 0 ? null : new { periodKey = WindowPeriod, endsAtMs = RewardsMode == "expired" ? RewardsTime - 1 : WindowEnd, tasks = daily, completion = new { requires = new[] { "win_two", "improve" }, ready = complete, claimed = _rewardClaims.Contains(player + ":" + WindowPeriod + ":_window_complete"), rewards = new[] { new { type = "account_xp", amount = 400 } } } }, weekly });
        }
        private static object[] PatrolRewards(int minutes) => new object[] { new { type = "account_xp", amount = minutes * 5 }, new { type = "item", itemId = "torn_chronicle_page", quantity = Math.Max(1, minutes * 2 / 15) } };
        private Dictionary<string, object> RewardsApply(string path, Dictionary<string, object> input, string player)
        {
            string request = JsonRead.Str(input, "requestId"), release = JsonRead.Str(input, "releaseId");
            if (UomdSavedAction.InvitationPath(path))
            {
                string id = JsonRead.Str(input, "characterId"), item = path.Split('/')[4];
                if (item != JsonRead.Str(_selector, "item_id") || !JsonRead.Arr(_selector, "choices").Contains(id)) throw new UomdApiException(422, "invalid_choice", "Isolated selection.");
                if (RewardsMode == "locked") throw new UomdApiException(403, "story_gate", "Isolated story gate.");
                if (_inviteSpent.TryGetValue(player, out int used) && used >= 1) throw new UomdApiException(402, "insufficient_items", "Isolated invitation balance.");
                int copies = Copies(player, id) + 1, added = copies > 1 ? 5 : 0; string key = player + ":" + id;
                _recruitCopies[key] = copies; _recruitShards[key] = (_recruitShards.TryGetValue(key, out int shards) ? shards : 0) + added; _inviteSpent[player] = 1;
                return Graph(new { requestId = request, releaseId = release, itemId = item, characterId = id, characterName = JsonRead.Str(RewardChoice(player, id), "name_en"), consumed = 1, grant = new { copiesAdded = 1, copiesAfter = copies, shardsAdded = added, shardsAfter = _recruitShards[key] }, replayed = false });
            }
            if (path == UomdSavedAction.PatrolPath)
            {
                long previous = _patrolCheckpoints.TryGetValue(player, out long checkpoint) ? checkpoint : _patrolInitial;
                int elapsed = (int)Math.Min(43200, Math.Max(0, (RewardsTime - previous) / 1000)), minutes = elapsed / 60;
                if (RewardsMode == "locked") throw new UomdApiException(403, "mode_locked", "Isolated patrol gate.");
                if (minutes < 1) throw new UomdApiException(409, "afk_nothing_to_claim", "Isolated minimum patrol time.");
                _patrolCheckpoints[player] = RewardsTime;
                return Graph(new { requestId = request, releaseId = release, previousCheckpointMs = previous, checkpointMs = RewardsTime, elapsedSeconds = elapsed, minutesAccrued = minutes, capped = elapsed == 43200, rewards = PatrolRewards(minutes), replayed = false });
            }
            bool supplies = path == UomdSavedAction.SuppliesPath; string period = JsonRead.Str(input, "periodKey"), task = supplies ? "_daily_supplies" : JsonRead.Str(input, "taskId");
            if (supplies ? period != SupplyPeriod : period != WindowPeriod && !period.StartsWith("w:", StringComparison.Ordinal)) throw new UomdApiException(409, "period_closed", "Isolated expired period.");
            if (!supplies && task == "improve" && RewardsMode != "complete" || task == "_window_complete" && RewardsMode != "complete") throw new UomdApiException(409, "not_done", "Isolated incomplete task.");
            string claim = player + ":" + period + ":" + task; if (!_rewardClaims.Add(claim)) throw new UomdApiException(409, "already_claimed", "Isolated previous claim.");
            int amount = supplies ? 80 : 10; if (task != "_window_complete") _walletDelta[player] = (_walletDelta.TryGetValue(player, out int balance) ? balance : 0) + amount;
            var result = Graph(new { requestId = request, releaseId = release, periodKey = period, taskId = task, rewards = task == "_window_complete" ? new object[] { new { type = "account_xp", amount = 400 } } : new object[] { new { type = "currency", currency = "eclipse_token", amount } }, replayed = false });
            if (supplies) { result["amount"] = (long)amount; result["endsAtMs"] = UomdErrandsSnapshot.SupplyEnd(period); } else result["taskRulesSha256"] = new string('a', 64);
            return result;
        }
    }
}
#endif
