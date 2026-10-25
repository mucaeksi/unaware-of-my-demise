#nullable enable
using System.Linq;
using NUnit.Framework;
using Uomd.Core;

namespace Uomd.Tests
{
    /// <summary>Same cases as apps/game/src/battle/formation.test.ts.</summary>
    public sealed class BattleFormationTests
    {
        private static readonly string[] Presets = { "current", "arena_lite", "afk_faithful" };

        [Test]
        public void MirrorsSidesAndKeepsTheFrontRowCloserToTheCentre()
        {
            foreach (string preset in Presets)
            {
                var pf = UomdBattleFormation.SpotFor("player", "front", 0, 1, preset);
                var pr = UomdBattleFormation.SpotFor("player", "rear", 0, 1, preset);
                var ef = UomdBattleFormation.SpotFor("enemy", "front", 0, 1, preset);
                Assert.Greater(pf.X, pr.X, preset);
                Assert.Less(ef.X, UomdBattleFormation.SpotFor("enemy", "rear", 0, 1, preset).X, preset);
                Assert.AreEqual(1920, pf.X + ef.X, preset);
            }
        }

        [Test]
        public void SpreadsFiveRowsOverTheGroundBandWithoutOverlap()
        {
            foreach (string preset in Presets)
            {
                var ys = Enumerable.Range(0, 5).Select(i => UomdBattleFormation.SpotFor("player", "front", i, 5, preset).Y).ToList();
                Assert.AreEqual(5, ys.Distinct().Count(), preset);
                Assert.GreaterOrEqual(ys.Min(), 555, preset);
                Assert.LessOrEqual(ys.Max(), 790, preset);
            }
        }

        [Test]
        public void DeeperUnitsAreScaledUpSlightly()
        {
            foreach (string preset in Presets)
            {
                Assert.Greater(UomdBattleFormation.SpotFor("enemy", "front", 1, 2, preset).DepthScale, UomdBattleFormation.SpotFor("enemy", "front", 0, 2, preset).DepthScale, preset);
            }
        }

        [Test]
        public void AfkFaithfulInterleavesTwoFrontAndThreeRearWithAtLeast55pxBands()
        {
            var ys = Enumerable.Range(0, 2).Select(i => UomdBattleFormation.SpotFor("player", "front", i, 2, "afk_faithful").Y)
                .Concat(Enumerable.Range(0, 3).Select(i => UomdBattleFormation.SpotFor("player", "rear", i, 3, "afk_faithful").Y))
                .OrderBy(y => y).ToList();
            Assert.AreEqual(5, ys.Distinct().Count());
            for (int i = 1; i < ys.Count; i++) Assert.GreaterOrEqual(ys[i] - ys[i - 1], 55);
        }

        [Test]
        public void ClampsRearUnitsInsideNotchedSafeAreaWhileKeepingSymmetry()
        {
            var pr = UomdBattleFormation.SpotFor("player", "rear", 0, 3, "arena_lite", 160);
            var er = UomdBattleFormation.SpotFor("enemy", "rear", 0, 3, "arena_lite", 160);
            Assert.GreaterOrEqual(pr.X, 320);
            Assert.AreEqual(1920, pr.X + er.X);
        }
    }
}
