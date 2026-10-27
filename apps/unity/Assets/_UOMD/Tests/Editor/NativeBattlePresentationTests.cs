using System;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.Scenes;

namespace Uomd.Tests
{
    public sealed class NativeBattlePresentationTests
    {
        [Test]
        public void FirstViewBattleHasSeparateConfirmPauseAndRecoveryWithoutAutoOrSpeedControls()
        {
            var root = Resources.Load<VisualTreeAsset>("Rebuild/Battle").CloneTree();
            foreach (string name in new[] { "battleCast", "battlePause", "battleResume", "battleRetry", "battleContinue" })
                Assert.IsNotNull(root.Q<Button>(name));
            Assert.IsNotNull(root.Q("battleSkills"));
            Assert.IsNotNull(root.Q("battleTargets"));
            Assert.IsNull(root.Q<Button>("battleAuto"));
            Assert.IsNull(root.Q<Button>("battleSpeed"));
        }

        [Test]
        public void NativeMovementUsesItsOwnTickSoAStoppedPresenterHoldsItsPosition()
        {
            var art = new UnitArt { HeightPx = 100 };
            art.Frames["idle"] = (0, 0, 10, 10);
            art.States["idle"] = new UnitArtState { Frame = "idle", Frames = new[] { "idle" }, Fps = 6, Loop = true };
            var view = new BattleUnitView(new VisualElement(), new VisualElement(), "fixture", "Fixture", "player", art,
                new System.Collections.Generic.Dictionary<string, Sprite>(), new BattleSpot(400, 600, 1), _ => { }, true);
            view.MoveTo(700, 650, 1000, false);
            view.Tick(0.5f);
            Assert.AreEqual(550, view.Root.style.translate.value.x.value, 0.01);
            Assert.AreEqual(625, view.Root.style.translate.value.y.value, 0.01);
            view.Tick(0);
            Assert.AreEqual(550, view.Root.style.translate.value.x.value, 0.01);
            view.Tick(0.5f);
            Assert.AreEqual(700, view.Root.style.translate.value.x.value, 0.01);
            Assert.AreEqual(650, view.Root.style.translate.value.y.value, 0.01);
        }

        [Test]
        public void TutorialFormationMirrorsSidesAndLeavesSpaceForNativeDockAndHeader()
        {
            foreach (string row in new[] { "front", "rear" })
            for (int count = 1; count <= 3; count++)
            for (int index = 0; index < count; index++)
            {
                var a = BattleScreenController.NativeSpot("player", row, index, count);
                var b = BattleScreenController.NativeSpot("enemy", row, index, count);
                Assert.AreEqual(1920, a.X + b.X);
                Assert.AreEqual(a.Y, b.Y);
                Assert.That(a.Y, Is.InRange(455, 590));
                Assert.Less(a.Y + 140, 756, "Enemy plate and intent must finish above the dock.");
                Assert.Greater(a.Y - 236, 210, "The standing figure must stay below the turn row.");
            }
        }

        [Test]
        public void T3RearPairHasSeparateBodyPlateAndIntentColumns()
        {
            var a = BattleScreenController.NativeSpot("enemy", "rear", 0, 2);
            var b = BattleScreenController.NativeSpot("enemy", "rear", 1, 2);
            var front = BattleScreenController.NativeSpot("enemy", "front", 0, 1);
            Assert.GreaterOrEqual(Math.Abs(a.X - b.X), 260, "Rear plates and wrapped intents must not overlap.");
            Assert.GreaterOrEqual(Math.Min(a.X, b.X) - front.X, 230, "The near rear body must clear the front body.");
            Assert.AreEqual(a.Y, b.Y);
        }
    }
}
