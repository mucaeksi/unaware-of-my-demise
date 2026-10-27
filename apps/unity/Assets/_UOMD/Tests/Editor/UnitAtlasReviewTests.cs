using System;
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.EditorTools;
using Uomd.Scenes;

namespace Uomd.Tests
{
    public sealed class UnitAtlasReviewTests
    {
        [Test]
        public void TwoPageFadymeAssemblyIsNotPresentedAsANativeTallGeneration()
        {
            var asset = ProductionReviewCatalog.Load(ProductionReviewCatalog.RepositoryRoot).Find(a => a.Id == "sol_fadyme_chibi_sheet");
            StringAssert.Contains("Derived source assembly: 1536 × 2048", asset.Details);
            StringAssert.DoesNotContain("Native source: 1536 × 2048", asset.Details);
        }

        [Test]
        public void FourRebuiltVariantsHaveSixteenPosesAndEightExplicitStatesWithoutReplacingLegacyUnits()
        {
            string root = ProductionReviewCatalog.RepositoryRoot;
            var catalog = UomdMediaCatalog.Parse(File.ReadAllText(Path.Combine(root, "content/base/art/art_manifest.json")), null);
            foreach (string unit in RebuildUnitReviewScreen.Units)
            {
                Assert.IsTrue(catalog.TryGetUnitArt(unit, out var legacy));
                Assert.IsTrue(catalog.TryGetUnitArt("sol_" + unit, out var rebuilt));
                Assert.AreNotEqual(legacy.AtlasPath, rebuilt.AtlasPath);
                Assert.AreEqual(16, rebuilt.Frames.Count, unit);
                Assert.AreEqual(8, rebuilt.States.Count, unit);
                foreach (string stateName in RebuildUnitReviewScreen.States)
                {
                    Assert.IsTrue(rebuilt.States.TryGetValue(stateName, out var state));
                    Assert.Greater(state.Frames.Length, 0, unit + "/" + stateName);
                    Assert.IsTrue(rebuilt.Frames.ContainsKey(state.Frame));
                    foreach (string frame in state.Frames) Assert.IsTrue(rebuilt.Frames.ContainsKey(frame));
                    Assert.That(state.FootY, Is.InRange(0.9, 1.0));
                    Assert.That(state.PivotX, Is.InRange(0.0, 1.0));
                }
            }
        }

        private static BattleUnitView View()
        {
            var art = new UnitArt { HeightPx = 100 };
            foreach (string frame in new[] { "idle", "hit", "fallen", "strike" }) art.Frames[frame] = (0, 0, 10, 10);
            art.States["idle"] = new UnitArtState { Frame = "idle", Frames = new[] { "idle" }, Fps = 6, Loop = true };
            art.States["defeat"] = new UnitArtState { Frame = "hit", Frames = new[] { "hit", "fallen" }, Fps = 6, Loop = false };
            art.States["basic"] = new UnitArtState { Frame = "strike", Frames = new[] { "strike" }, Fps = 9, Loop = false };
            return new BattleUnitView(new VisualElement(), new VisualElement(), "fixture", "Fixture", "player", art,
                new Dictionary<string, Sprite>(), new BattleSpot(400, 600, 1), _ => { });
        }

        [Test]
        public void DefeatClampsTheActualLastPoseWhenOneTickSkipsPastTheWholeAnimation()
        {
            var view = View();
            view.Defeat(true);
            view.Tick(1f);
            Assert.AreEqual("fallen", view.CurrentFrame);
            view.Tick(1f);
            Assert.AreEqual("fallen", view.CurrentFrame);
        }

        [Test]
        public void CompletedAttackReturnsToIdleInsteadOfHoldingItsImpactPose()
        {
            var view = View();
            view.Play("basic");
            view.Tick(1f);
            Assert.AreEqual("idle", view.CurrentFrame);
            Assert.AreEqual("idle", view.CurrentAnimationState);
        }
    }
}
