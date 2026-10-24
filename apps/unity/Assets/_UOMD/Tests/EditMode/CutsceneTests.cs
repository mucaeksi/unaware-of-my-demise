#nullable enable
using NUnit.Framework;
using Uomd.Narrative;

namespace Uomd.Tests
{
    /// <summary>Same cases as apps/game/src/entry/cutscene.test.ts (opening tutorial revision v006).</summary>
    public sealed class CutsceneTests
    {
        [Test]
        public void AShortLineStaysAtLeastFiveAndAHalfSecondsInTotal()
        {
            const int chars = 26; // reveals in exactly 1 s
            Assert.GreaterOrEqual(UomdCutscene.HoldSeconds(chars, null, false, null) + chars / UomdCutscene.Cps, 5.5f);
            Assert.AreEqual(5.5f - 5f / 26f, UomdCutscene.HoldSeconds(5, null, false, null), 1e-5f);
        }

        [Test]
        public void AfterTheFullRevealAutoAlwaysWaitsAtLeast3Point2Seconds()
        {
            Assert.AreEqual(3.2f, UomdCutscene.HoldSeconds(400, null, false, null));
            Assert.AreEqual(3.2f, UomdCutscene.HoldSeconds(100, 3f, false, null));
        }

        [Test]
        public void TheDataHoldWinsWhenLongerThanTheFloor()
        {
            Assert.AreEqual(4f, UomdCutscene.HoldSeconds(120, 4f, false, null));
        }

        [Test]
        public void TheClosingLineHoldsForTheSceneClosingTimeWhenLonger()
        {
            Assert.AreEqual(5f, UomdCutscene.HoldSeconds(120, null, true, 5f));
            Assert.AreEqual(3.2f, UomdCutscene.HoldSeconds(120, null, true, 1f));
            Assert.AreEqual(3.2f, UomdCutscene.HoldSeconds(120, null, false, 5f));
        }

        [Test]
        public void SpeakerPauseNoneFirstOneSecondOnChangeSameSpeakerShorter()
        {
            Assert.AreEqual(0f, UomdCutscene.PauseSeconds(null, "mahmut", 1f));
            Assert.AreEqual(1f, UomdCutscene.PauseSeconds("mahmut", "fadyme", 1f));
            Assert.AreEqual(1f, UomdCutscene.PauseSeconds("narration", "mahmut", 1f));
            Assert.AreEqual(0.65f, UomdCutscene.PauseSeconds("mahmut", "mahmut", 1f));
            Assert.AreEqual(0.8f, UomdCutscene.DissolveSeconds);
        }

        [Test]
        public void StatureKeepsMahmutTallerThanFadymeAndFallsBackDeterministically()
        {
            Assert.Greater(UomdCharacterStature.Get("mahmut").HeightCm, UomdCharacterStature.Get("fadyme").HeightCm);
            Assert.AreEqual("left", UomdCharacterStature.Get("Fadyme ").NativeFacing);
            Assert.AreEqual(186, UomdCharacterStature.Get("ash_knight_new").HeightCm);
            Assert.AreEqual(168, UomdCharacterStature.Get("someone").HeightCm);
        }
    }
}
