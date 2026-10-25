#nullable enable
using System.Collections.Generic;
using NUnit.Framework;
using Uomd.Core.Growth;

namespace Uomd.Tests.EditMode
{
    /// <summary>C# mirror of apps/game/src/ui/growth.test.ts (R10 pre-action planner).</summary>
    public sealed class GrowthTests
    {
        private const string Currency = "Bell's Remains";

        private static CharacterView BaseChar(int level = 1) => new CharacterView
        {
            Id = "mira", Level = level, Xp = 0, XpToNext = 100, Ascension = 0, Cap = 5,
            NextAscension = new AscensionStep
            {
                Cap = 10, AccountLevel = 5, Fee = 20, RequiresNode = "ch1_node_5",
                Items = new List<ItemQuantity> { new ItemQuantity("ember_sigil", 2) }
            },
            Skills = new List<SkillView>
            {
                new SkillView
                {
                    SkillId = "mira_basic", Type = "basic", Name = "Ash Strike", Rank = 1, MaxRank = 3,
                    Next = new SkillNext { Rank = 2, UnlockLevel = 3, ItemId = "tome_basic", Quantity = 2, Fee = 15 }
                }
            }
        };

        private static readonly (string, int)[] Codex = { ("xp_codex", 250) };

        [Test]
        public void LevelUpComputesFeeLevelWalletAndWaste()
        {
            var plan = UomdGrowth.PlanLevelUp(BaseChar(), 5, 50, new Dictionary<string, int> { ["xp_codex"] = 3 }, Codex, null, Currency, _ => "Tactical Field Manual");
            Assert.IsTrue(plan.CanExecute);
            Assert.AreEqual("ready", plan.Gate);
            // Lv1->2 needs 100 XP (fee 2), Lv2->3 needs 150 XP (fee 3): 250 XP reaches Lv 3 with 0 XP left, fee 5
            Assert.AreEqual(3, plan.ToLevel);
            Assert.AreEqual(0, plan.ToXp);
            Assert.AreEqual(5, plan.Fee);
            Assert.AreEqual(45, plan.BalanceAfter);
            Assert.AreEqual(0, plan.WastedXp);
        }

        [Test]
        public void DetectsFundsAndAscensionGates()
        {
            var noFunds = UomdGrowth.PlanLevelUp(BaseChar(), 5, 1, new Dictionary<string, int> { ["xp_codex"] = 3 }, Codex, null, Currency, _ => "Tactical Field Manual");
            Assert.IsFalse(noFunds.CanExecute);
            Assert.AreEqual("insufficient_funds", noFunds.Gate);
            StringAssert.Contains("need 5 Bell's Remains", noFunds.Reason);

            var sigils = new Dictionary<string, int> { ["ember_sigil"] = 2 };
            var notAtCap = UomdGrowth.PlanAscension(BaseChar(), 5, 100, sigils, null, Currency, _ => "Ember Sigil");
            Assert.IsFalse(notAtCap.CanExecute);
            Assert.AreEqual("not_at_cap", notAtCap.Gate);

            var storyGate = UomdGrowth.PlanAscension(BaseChar(5), 5, 100, sigils, new HashSet<string> { "ch1_node_1" }, Currency, _ => "Ember Sigil");
            Assert.IsFalse(storyGate.CanExecute);
            Assert.AreEqual("story_gate", storyGate.Gate);
            StringAssert.Contains("ch1_node_5", storyGate.Reason);
        }

        [Test]
        public void SkillUpgradeCostsRanksAndUnlockGates()
        {
            var skill = BaseChar().Skills[0];
            var tomes = new Dictionary<string, int> { ["tome_basic"] = 5 };
            var locked = UomdGrowth.PlanSkillUpgrade(skill, 1, 100, tomes, Currency, _ => "Basic Tome");
            Assert.IsFalse(locked.CanExecute);
            Assert.AreEqual("level_too_low", locked.Gate);

            var ready = UomdGrowth.PlanSkillUpgrade(skill, 3, 100, tomes, Currency, _ => "Basic Tome");
            Assert.IsTrue(ready.CanExecute);
            Assert.AreEqual("ready", ready.Gate);
            Assert.AreEqual(1, ready.FromRank);
            Assert.AreEqual(2, ready.ToRank);
            Assert.AreEqual(15, ready.Fee);
            Assert.AreEqual(85, ready.BalanceAfter);
        }

        [Test]
        public void AtCapTheLevelUpWaitsForAscension()
        {
            var plan = UomdGrowth.PlanLevelUp(BaseChar(5), 5, 50, new Dictionary<string, int> { ["xp_codex"] = 3 }, Codex, null, Currency, _ => "Tactical Field Manual");
            Assert.IsFalse(plan.CanExecute);
            Assert.AreEqual("ascension_cap", plan.Gate);
            Assert.AreEqual(0, plan.Fee);
            Assert.AreEqual(5, plan.ToLevel);
        }

        [Test]
        public void ReadsTheServerCharacterShape()
        {
            var c = CharacterView.From(Uomd.Core.UomdJson.ParseObject(
                "{\"id\":\"fadyme\",\"level\":3,\"xp\":40,\"xpToNext\":null,\"ascension\":1,\"cap\":10,\"shards\":4," +
                "\"resonance\":{\"tier\":1,\"maxTier\":5,\"nextShardCost\":null,\"bonusPct\":2,\"excessShards\":0,\"excessItemId\":\"x\"}," +
                "\"nextAscension\":null,\"skills\":[{\"skillId\":\"s\",\"type\":\"basic\",\"name\":\"N\",\"rank\":1,\"maxRank\":3,\"next\":null}]}"));
            Assert.AreEqual("fadyme", c.Id);
            Assert.IsNull(c.XpToNext);
            Assert.IsNull(c.NextAscension);
            Assert.IsNull(c.Resonance!.NextShardCost);
            Assert.AreEqual(1, c.Skills.Count);
            Assert.IsNull(c.Skills[0].Next);
        }
    }
}
