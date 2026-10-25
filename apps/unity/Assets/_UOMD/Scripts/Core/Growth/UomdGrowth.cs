#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;

namespace Uomd.Core.Growth
{
    /// <summary>One skill of a character as GET /api/v1/characters/mine returns it.</summary>
    public sealed class SkillView
    {
        public string SkillId = "", Type = "", Name = "";
        public int Rank, MaxRank;
        public SkillNext? Next;

        public static SkillView From(Dictionary<string, object?> o)
        {
            var next = JsonRead.Get(o, "next") as Dictionary<string, object?>;
            return new SkillView
            {
                SkillId = JsonRead.Str(o, "skillId"), Type = JsonRead.Str(o, "type"), Name = JsonRead.Str(o, "name"),
                Rank = (int)JsonRead.Int(o, "rank"), MaxRank = (int)JsonRead.Int(o, "maxRank"),
                Next = next == null ? null : new SkillNext
                {
                    Rank = (int)JsonRead.Int(next, "rank"), UnlockLevel = (int)JsonRead.Int(next, "unlockLevel"),
                    ItemId = JsonRead.Str(next, "itemId"), Quantity = (int)JsonRead.Int(next, "quantity"), Fee = JsonRead.Num(next, "fee")
                }
            };
        }
    }

    public sealed class SkillNext
    {
        public int Rank, UnlockLevel, Quantity;
        public string ItemId = "";
        public double Fee;
    }

    public readonly struct ItemQuantity
    {
        public readonly string ItemId;
        public readonly int Quantity;
        public ItemQuantity(string itemId, int quantity) { ItemId = itemId; Quantity = quantity; }
    }

    public sealed class AscensionStep
    {
        public int Cap, AccountLevel;
        public List<ItemQuantity> Items = new List<ItemQuantity>();
        public double Fee;
        public string? RequiresNode;

        public static AscensionStep From(Dictionary<string, object?> o) => new AscensionStep
        {
            Cap = (int)JsonRead.Int(o, "cap"), AccountLevel = (int)JsonRead.Int(o, "accountLevel"), Fee = JsonRead.Num(o, "fee"),
            Items = JsonRead.Objects(o, "items").Select(i => new ItemQuantity(JsonRead.Str(i, "itemId"), (int)JsonRead.Int(i, "quantity"))).ToList(),
            RequiresNode = JsonRead.Get(o, "requiresNode") as string
        };
    }

    public sealed class Resonance
    {
        public int Tier, MaxTier, ExcessShards;
        public int? NextShardCost;
        public double BonusPct;
        public string ExcessItemId = "";
    }

    /// <summary>A character as GET /api/v1/characters/mine returns it (api.ts CharacterView).</summary>
    public sealed class CharacterView
    {
        public string Id = "";
        public int Level, Xp, Ascension, Cap, Copies, Shards;
        public int? XpToNext;
        public Resonance? Resonance;
        public AscensionStep? NextAscension;
        public List<SkillView> Skills = new List<SkillView>();

        public static CharacterView From(Dictionary<string, object?> o)
        {
            var res = JsonRead.Get(o, "resonance") as Dictionary<string, object?>;
            var next = JsonRead.Get(o, "nextAscension") as Dictionary<string, object?>;
            return new CharacterView
            {
                Id = JsonRead.Str(o, "id"), Level = (int)JsonRead.Int(o, "level"), Xp = (int)JsonRead.Int(o, "xp"),
                XpToNext = JsonRead.Get(o, "xpToNext") == null ? (int?)null : (int)JsonRead.Int(o, "xpToNext"),
                Ascension = (int)JsonRead.Int(o, "ascension"), Cap = (int)JsonRead.Int(o, "cap"),
                Copies = (int)JsonRead.Int(o, "copies"), Shards = (int)JsonRead.Int(o, "shards"),
                Resonance = res == null ? null : new Resonance
                {
                    Tier = (int)JsonRead.Int(res, "tier"), MaxTier = (int)JsonRead.Int(res, "maxTier"),
                    NextShardCost = JsonRead.Get(res, "nextShardCost") == null ? (int?)null : (int)JsonRead.Int(res, "nextShardCost"),
                    BonusPct = JsonRead.Num(res, "bonusPct"), ExcessShards = (int)JsonRead.Int(res, "excessShards"),
                    ExcessItemId = JsonRead.Str(res, "excessItemId")
                },
                NextAscension = next == null ? null : AscensionStep.From(next),
                Skills = JsonRead.Objects(o, "skills").Select(SkillView.From).ToList()
            };
        }
    }

    /// <summary>The catalog's character progression curve (GET /api/v1/catalog config.progression.character).</summary>
    public sealed class ProgressionConfig
    {
        public int LevelCap = 20;
        public double XpA = 60, XpB = 35, XpC = 5;
        public double FeeBase = 1, FeeIncrement = 1;
        public List<AscensionStep> Ascension = new List<AscensionStep>
        {
            new AscensionStep { Cap = 5, AccountLevel = 1, Fee = 0 },
            new AscensionStep { Cap = 10, AccountLevel = 5, Fee = 20 },
            new AscensionStep { Cap = 15, AccountLevel = 10, Fee = 55 },
            new AscensionStep { Cap = 20, AccountLevel = 15, Fee = 120 }
        };

        public static readonly ProgressionConfig Default = new ProgressionConfig();

        /// <summary>Reads `config.progression.character`; anything missing keeps the default (growth.ts DEFAULT_PROGRESSION).</summary>
        public static ProgressionConfig From(object? character)
        {
            if (!(character is Dictionary<string, object?> c)) return Default;
            var xp = JsonRead.Obj(c, "xp");
            var fee = JsonRead.Obj(c, "fee");
            var steps = JsonRead.Objects(c, "ascension").Select(AscensionStep.From).ToList();
            return new ProgressionConfig
            {
                LevelCap = (int)JsonRead.Int(c, "levelCap", 20),
                XpA = JsonRead.Num(xp, "a", 60), XpB = JsonRead.Num(xp, "b", 35), XpC = JsonRead.Num(xp, "c", 5),
                FeeBase = JsonRead.Num(fee, "base", 1), FeeIncrement = JsonRead.Num(fee, "increment", 1),
                Ascension = steps.Count > 0 ? steps : Default.Ascension
            };
        }
    }

    public sealed class LevelUpPlan
    {
        public bool CanExecute;
        public string Gate = "";
        public (string ItemId, int Xp, int Have, string Name)? XpItem;
        public int Fee, BalanceAfter, FromLevel, ToLevel, LevelsGained, FromXp, ToXp, WastedXp;
        public int? ToXpNext;
        public string CostSummary = "", ResultSummary = "", Reason = "";
    }

    public sealed class AscensionPlan
    {
        public bool CanExecute;
        public string Gate = "";
        public int Fee, BalanceAfter, FromAscension, ToAscension, FromCap, ToCap;
        public string CostSummary = "", ResultSummary = "", Reason = "";
    }

    public sealed class SkillUpgradePlan
    {
        public bool CanExecute;
        public string Gate = "";
        public int Fee, BalanceAfter, FromRank, ToRank;
        public string CostSummary = "", ResultSummary = "", Reason = "";
    }

    /// <summary>
    /// Pre-action growth planner (port of apps/game/src/ui/growth.ts, R10): what one level-up, ascension or skill rank would
    /// cost and give, and why it is blocked. Display only — the server prices and applies every action.
    /// </summary>
    public static class UomdGrowth
    {
        private static int JsRound(double v) => (int)Math.Floor(v + 0.5);

        public static int XpForNextLevel(ProgressionConfig? cfg, int level)
        {
            var c = cfg ?? ProgressionConfig.Default;
            return JsRound(c.XpA + c.XpB * level + c.XpC * level * level);
        }

        public static int FeeForSingleLevel(ProgressionConfig? cfg, int level)
        {
            var c = cfg ?? ProgressionConfig.Default;
            return Math.Max(1, (int)Math.Ceiling(c.FeeBase + level * c.FeeIncrement));
        }

        private static int Have(IReadOnlyDictionary<string, int> have, string id) => have.TryGetValue(id, out int n) ? n : 0;

        public static LevelUpPlan PlanLevelUp(CharacterView c, int accountLevel, int balance, IReadOnlyDictionary<string, int> have,
            IReadOnlyList<(string ItemId, int Xp)> xpItems, ProgressionConfig? cfg, string currencyName, Func<string, string> itemName)
        {
            (string ItemId, int Xp)? chosen = xpItems.Where(i => Have(have, i.ItemId) > 0).Select(i => ((string, int)?)i).FirstOrDefault()
                ?? (xpItems.Count > 0 ? xpItems[0] : ((string, int)?)null);
            (string ItemId, int Xp, int Have, string Name)? xpItem = chosen == null
                ? ((string, int, int, string)?)null
                : (chosen.Value.ItemId, chosen.Value.Xp, Have(have, chosen.Value.ItemId), itemName(chosen.Value.ItemId));

            int level = c.Level, xp = c.Xp + (xpItem?.Xp ?? 0), fee = 0;
            while (level < c.Cap && xp >= XpForNextLevel(cfg, level))
            {
                xp -= XpForNextLevel(cfg, level);
                fee += FeeForSingleLevel(cfg, level);
                level++;
            }
            int wasted = 0;
            if (level >= c.Cap)
            {
                wasted = Math.Max(0, xp);
                xp = 0;
            }
            var config = cfg ?? ProgressionConfig.Default;
            int maxCap = config.LevelCap;
            int? toXpNext = level >= maxCap ? (int?)null : XpForNextLevel(cfg, level);
            int balanceAfter = balance - fee;
            int neededToCap = -c.Xp;
            for (int l = c.Level; l < c.Cap; l++) neededToCap += XpForNextLevel(cfg, l);
            neededToCap = Math.Max(0, neededToCap);

            LevelUpPlan Plan(bool can, string gate, string cost, string result, string reason, bool simulated = true) => new LevelUpPlan
            {
                CanExecute = can, Gate = gate, XpItem = xpItem,
                Fee = simulated ? fee : 0, BalanceAfter = simulated ? balanceAfter : balance,
                FromLevel = c.Level, ToLevel = simulated ? level : c.Level, LevelsGained = simulated ? level - c.Level : 0,
                FromXp = c.Xp, ToXp = simulated ? xp : c.Xp, ToXpNext = simulated ? toXpNext : c.XpToNext, WastedXp = simulated ? wasted : 0,
                CostSummary = cost, ResultSummary = result, Reason = reason
            };

            if (c.Level >= c.Cap)
            {
                var steps = config.Ascension;
                int rawStepCap = c.Ascension <= 0
                    ? (steps.Count > 0 ? steps[0].Cap : maxCap)
                    : (steps.Count > 0 ? steps[Math.Min(c.Ascension, steps.Count - 1)].Cap : maxCap);
                string gate = c.Level < rawStepCap && accountLevel <= c.Level ? "account_level" : c.NextAscension != null ? "ascension_cap" : "max_level";
                string reason = gate == "account_level" ? $"Blocked: requires Account Lv {c.Level + 1} (now Lv {accountLevel})"
                    : gate == "ascension_cap" ? $"Blocked: at Lv {c.Cap} cap — ascend first" : $"Max level ({c.Cap}) reached";
                return Plan(false, gate, xpItem != null ? $"{xpItem.Value.Name} ({xpItem.Value.Have} owned)" : "No XP items", $"Lv {c.Level}/{c.Cap}", reason, simulated: false);
            }
            string waste = $"Lv {c.Level} → {level} · Waste {wasted} XP";
            if (xpItem == null || xpItem.Value.Have < 1)
            {
                string label = xpItem != null ? $"Need 1 {xpItem.Value.Name} (0 owned)" : "No XP items owned";
                return Plan(false, "missing_xp_item", label, waste, $"Blocked: {label}");
            }
            var it = xpItem.Value;
            if (it.Xp - neededToCap >= it.Xp)
                return Plan(false, "xp_overflow", $"1 {it.Name} ({it.Have}/1) · {fee} {currencyName}", waste, $"Blocked: {it.Xp} XP overflows remaining {neededToCap} XP to cap");
            if (balance < fee)
                return Plan(false, "insufficient_funds", $"1 {it.Name} ({it.Have}/1) · Fee {fee} {currencyName}", waste, $"Blocked: need {fee} {currencyName} (wallet {balance})");
            string next = toXpNext?.ToString() ?? "MAX";
            return Plan(true, "ready", $"1 {it.Name} ({it.Have}/1) · Fee {fee} {currencyName}",
                $"Lv {c.Level} → {level} (XP {xp}/{next}) · Wallet → {balanceAfter} · Waste {wasted} XP", "Ready");
        }

        public static AscensionPlan PlanAscension(CharacterView c, int accountLevel, int balance, IReadOnlyDictionary<string, int> have,
            ISet<string>? clearedNodes, string currencyName, Func<string, string> itemName)
        {
            var asc = c.NextAscension;
            if (asc == null)
                return new AscensionPlan
                {
                    Gate = "max_ascension", BalanceAfter = balance, FromAscension = c.Ascension, ToAscension = c.Ascension, FromCap = c.Cap, ToCap = c.Cap,
                    CostSummary = "No further ascension cost", ResultSummary = $"Ascension {c.Ascension} (Max) · Cap Lv {c.Cap}", Reason = "Maximum ascension reached"
                };
            int fee = (int)Math.Ceiling(asc.Fee);
            int balanceAfter = balance - fee;
            string itemsText = string.Join(" · ", asc.Items.Select(i => $"{itemName(i.ItemId)} {Have(have, i.ItemId)}/{i.Quantity}"));
            string cost = $"{(itemsText.Length > 0 ? itemsText + " · " : "")}Fee {fee} {currencyName}";
            string result = $"Asc {c.Ascension} → {c.Ascension + 1} · Cap Lv {c.Cap} → {asc.Cap} · Wallet → {balanceAfter}";
            AscensionPlan Plan(bool can, string gate, string reason) => new AscensionPlan
            {
                CanExecute = can, Gate = gate, Fee = fee, BalanceAfter = balanceAfter, FromAscension = c.Ascension, ToAscension = c.Ascension + 1,
                FromCap = c.Cap, ToCap = asc.Cap, CostSummary = cost, ResultSummary = result, Reason = reason
            };
            if (c.Level < c.Cap) return Plan(false, "not_at_cap", $"Blocked: reach Lv {c.Cap} first (now Lv {c.Level})");
            if (accountLevel < asc.AccountLevel) return Plan(false, "account_level_too_low", $"Blocked: requires Account Lv {asc.AccountLevel} (now Lv {accountLevel})");
            if (!string.IsNullOrEmpty(asc.RequiresNode) && clearedNodes != null && !clearedNodes.Contains(asc.RequiresNode!))
                return Plan(false, "story_gate", $"Blocked: clear stage {asc.RequiresNode} first");
            var missing = asc.Items.Where(i => Have(have, i.ItemId) < i.Quantity).ToList();
            if (missing.Count > 0)
                return Plan(false, "insufficient_items", $"Blocked: missing {string.Join(", ", missing.Select(i => $"{itemName(i.ItemId)} ({Have(have, i.ItemId)}/{i.Quantity})"))}");
            if (balance < fee) return Plan(false, "insufficient_funds", $"Blocked: need {fee} {currencyName} (wallet {balance})");
            return Plan(true, "ready", "Ready");
        }

        public static SkillUpgradePlan PlanSkillUpgrade(SkillView skill, int characterLevel, int balance, IReadOnlyDictionary<string, int> have,
            string currencyName, Func<string, string> itemName)
        {
            var n = skill.Next;
            if (n == null)
                return new SkillUpgradePlan
                {
                    Gate = "max_rank", BalanceAfter = balance, FromRank = skill.Rank, ToRank = skill.Rank,
                    CostSummary = "Max rank reached", ResultSummary = $"Rank {skill.Rank}/{skill.MaxRank}", Reason = "Max rank"
                };
            int haveQty = Have(have, n.ItemId);
            int fee = (int)Math.Ceiling(n.Fee);
            int balanceAfter = balance - fee;
            string mat = itemName(n.ItemId);
            SkillUpgradePlan Plan(bool can, string gate, string reason) => new SkillUpgradePlan
            {
                CanExecute = can, Gate = gate, Fee = fee, BalanceAfter = balanceAfter, FromRank = skill.Rank, ToRank = n.Rank,
                CostSummary = $"{mat} {haveQty}/{n.Quantity} · Fee {fee} {currencyName}",
                ResultSummary = $"Rank {skill.Rank} → {n.Rank}/{skill.MaxRank} · Wallet → {balanceAfter}", Reason = reason
            };
            if (characterLevel < n.UnlockLevel) return Plan(false, "level_too_low", $"Requires Lv {n.UnlockLevel} (now Lv {characterLevel})");
            if (haveQty < n.Quantity) return Plan(false, "insufficient_items", $"Need {mat} {haveQty}/{n.Quantity}");
            if (balance < fee) return Plan(false, "insufficient_funds", $"Need {fee} {currencyName} (wallet {balance})");
            return Plan(true, "ready", "Ready");
        }
    }
}
