#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Linq;
using Uomd.Core;

namespace Uomd.Scenes
{
    public sealed partial class UomdHubReview
    {
        public string GearMode = "ready";
        public bool GearLoseResponse;
        private readonly Dictionary<string, List<Dictionary<string, object>>> _gearRows = new Dictionary<string, List<Dictionary<string, object>>>();
        private readonly Dictionary<string, Dictionary<string, long>> _gearStocks = new Dictionary<string, Dictionary<string, long>>();
        private static readonly string GearHash = UomdBattleWire.Hash("isolated armory review catalog v1");
        private string GearKey(string player) => player + ":" + GearMode;
        private List<Dictionary<string, object>> GearRows(string player)
        {
            string key = GearKey(player); if (_gearRows.TryGetValue(key, out var saved)) return saved;
            var rows = new List<Dictionary<string, object>>();
            int count = GearMode == "empty" ? 0 : GearMode == "long" ? 35 : 4;
            for (int i = 1; i <= count; ++i)
            {
                string slot = i == 1 ? "weapon" : i == 2 ? "armor" : i == 3 ? "ring" : "necklace";
                bool retired = GearMode == "retired" && i == 1;
                var row = Graph(new { id = i, version = 0, gearId = retired ? "fixture_retired" : "fixture_gear_" + (i > 4 ? 4 : i), slot, name = GearMode == "long" ? "Deliberately long equipment name for native layout verification " + i : "Equipment fixture " + i,
                    rarity = retired ? 0 : 4, level = i == 2 || GearMode == "at_cap" && i == 1 ? 5 : 1, levelCap = slot == "weapon" || slot == "armor" ? 5 : 1, xp = 0, ascension = 0,
                    locked = GearMode == "locked" && i == 1, equippedBy = GearMode == "equipped" && i == 1 ? "mahmut" : null,
                    unavailableReason = retired ? "Retired fixture" : "", passive = GearMode == "unsupported" && i == 1 ? new { name = "Unsupported fixture", supported = false } : null,
                    canDismantle = !retired, stats = slot == "weapon" || slot == "armor" ? null : new { main = new { stat = "vit_flat", value = 2 }, subs = new[] { new { stat = "heal_bonus_pct", value = 0.05 }, new { stat = "atk_flat", value = 3.0 } } } });
                if (GearMode == "maximum" && i == 1) { row["level"] = 20L; row["levelCap"] = 20L; row["ascension"] = 3L; }
                if (retired) row["levelCap"] = row["level"];
                rows.Add(row);
            }
            _gearRows[key] = rows; _gearStocks[key] = new Dictionary<string, long> { ["fixture_tempering"] = GearMode == "low_items" ? 0 : 2000, ["fixture_rivet"] = GearMode == "low_items" ? 0 : 10, ["fixture_cinder"] = GearMode == "low_items" ? 0 : 20, ["fixture_dust"] = 0 };
            return rows;
        }
        private Dictionary<string, object> GearRead(string path, string player)
        {
            var rows = GearRows(player); string release = _router.Patch.ActiveReleaseId;
            if (path == "/api/v1/stacks") return Graph(new { stacks = _gearStocks[GearKey(player)].Select(p => new { item_id = p.Key, qty = p.Value }).ToArray() });
            if (path.StartsWith("/api/v1/gear?", StringComparison.Ordinal))
            {
                var result = Graph(new { gear = rows, versionBound = GearMode != "old_service", releaseId = release, catalogSha256 = GearHash });
                if (GearMode == "malformed") ((Dictionary<string, object>)JsonRead.Arr(result, "gear")[0])["version"] = -1L;
                return result;
            }
            return Graph(new { releaseId = release, catalogSha256 = GearHash,
                items = new[] { new { item_id = "fixture_tempering", name_en = "Tempering XP fixture" }, new { item_id = "fixture_rivet", name_en = "Rivet fixture" }, new { item_id = "fixture_cinder", name_en = "Cinder fixture" }, new { item_id = "fixture_dust", name_en = "Dust fixture" } },
                gear = Enumerable.Range(1, 4).Select(i => new { gear_id = "fixture_gear_" + i, slot = i == 1 ? "weapon" : i == 2 ? "armor" : i == 3 ? "ring" : "necklace", level_cap = i < 3 ? 20 : 1, dismantle_allowed = 1, dismantle_xp = 10, dismantle_json = "[{\"item_id\":\"fixture_dust\",\"quantity\":2}]" }).ToArray(),
                config = new { progression = new { character = new { }, equipment = new { levelCap = 20, xpItemId = "fixture_tempering", milestoneItemId = "fixture_rivet", xp = new { @base = 20, increment = 5 }, fee = new { @base = 2, increment = 1 }, milestones = new[] { new { fromLevel = 5, rivets = 1 }, new { fromLevel = 10, rivets = 2 }, new { fromLevel = 15, rivets = 3 } } } }, gear = new { rerollCost = new { itemId = "fixture_cinder", quantityByRarity = new Dictionary<string, object> { ["4"] = 2, ["5"] = 3 } } } } });
        }
        public void ChangeGearVersion(long id)
        {
            string player = _router.Api.GetCurrentSessionSnapshot()?.playerId ?? "hub_review";
            var row = GearRows(player).First(g => JsonRead.Int(g, "id") == id); row["version"] = JsonRead.Int(row, "version") + 1;
        }
        private Dictionary<string, object> GearApply(string path, Dictionary<string, object> input, string player)
        {
            long id = UomdGearProgression.InstanceId(path.Split('/')[4]); var rows = GearRows(player); var row = rows.FirstOrDefault(g => JsonRead.Int(g, "id") == id);
            if (row == null) throw new UomdApiException(404, "no_such_gear", "Missing isolated gear.");
            if (!UomdGearProgression.ActionPath(path))
            {
                if (input.ContainsKey("requestId")) throw new InvalidOperationException("Plain gear write cannot add requestId.");
                if (path.EndsWith("/lock", StringComparison.Ordinal)) row["locked"] = JsonRead.Bool(input, "locked");
                else
                {
                    string target = path.EndsWith("/unequip", StringComparison.Ordinal) ? "" : JsonRead.Str(input, "characterId");
                    foreach (var other in rows.Where(g => g != row && JsonRead.Str(g, "slot") == JsonRead.Str(row, "slot") && target.Length > 0 && JsonRead.Str(g, "equippedBy") == target)) { other["equippedBy"] = null; other["version"] = JsonRead.Int(other, "version") + 1; }
                    row["equippedBy"] = target.Length == 0 ? null : target;
                }
                row["version"] = JsonRead.Int(row, "version") + 1; return Graph(new { id, ok = true });
            }
            if (JsonRead.Int(input, "expectedVersion") != JsonRead.Int(row, "version")) throw new UomdApiException(409, "gear_changed", "Item changed before isolated spend.");
            var model = UomdGearProgression.Parse(GearRead("/api/v1/catalog?", player), GearRead("/api/v1/stacks", player), GearRead("/api/v1/gear?", player), JsonRead.Str(input, "releaseId"));
            var item = model.Items.First(g => g.Id == id); string kind = path.Split('/').Last();
            var plan = model.Preview(item, kind, 1650 + (_walletDelta.TryGetValue(player, out int current) ? current : 0), JsonRead.Int(input, "xp"));
            if (!plan.Ready) throw new UomdApiException(402, "insufficient_items", plan.Reason);
            var result = Graph(new { id, releaseId = JsonRead.Str(input, "releaseId"), expectedVersion = item.Version, catalogSha256 = GearHash });
            foreach (var cost in plan.Costs) _gearStocks[GearKey(player)][cost.Id] -= cost.Quantity;
            _walletDelta[player] = (_walletDelta.TryGetValue(player, out int delta) ? delta : 0) - (int)plan.Fee;
            row["version"] = item.Version + 1;
            if (kind == "level-up") { row["level"] = (long)plan.Level; row["xp"] = plan.Xp; result["level"] = (long)plan.Level; result["xp"] = plan.Xp; result["cap"] = (long)item.Cap; result["spentXp"] = plan.UsedXp; result["fee"] = plan.Fee; }
            else if (kind == "ascend") { row["ascension"] = (long)item.Ascension + 1; row["levelCap"] = (long)plan.NextCap; result["ascension"] = row["ascension"]; result["newCap"] = (long)plan.NextCap; result["spentRivets"] = plan.Costs[0].Quantity; }
            else if (kind == "reroll") { row["stats"] = Graph(new { main = JsonRead.Obj(row["stats"], "main"), subs = new[] { new { stat = "def_flat", value = 4.0 }, new { stat = "spd_pct", value = 0.01 } } }); result["stats"] = row["stats"]; result["spent"] = Graph(new { itemId = plan.Costs[0].Id, quantity = plan.Costs[0].Quantity }); }
            else { rows.Remove(row); foreach (var gain in plan.Returns) _gearStocks[GearKey(player)][gain.Id] += gain.Quantity; result["gained"] = plan.Returns.Select(g => (object)Graph(new { itemId = g.Id, quantity = g.Quantity })).ToArray(); }
            return Graph(result);
        }
    }
}
#endif
