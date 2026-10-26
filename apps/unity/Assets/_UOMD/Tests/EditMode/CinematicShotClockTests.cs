using NUnit.Framework;
using Uomd.Narrative;

namespace Uomd.Tests
{
    public sealed class CinematicShotClockTests
    {
        [Test]
        public void CanonicalOpeningHoldsConsume120SecondsExcludingPauses()
        {
            var clock = new CinematicShotClock();
            double authored = 0;
            foreach (int duration in new[] { 12, 14, 12, 12, 16, 16, 14, 12, 12 })
            {
                clock.Reset(duration);
                clock.Advance(900, true); // loading/pause/manual hold must not spend narrative time
                Assert.AreEqual(0, clock.Elapsed);
                clock.Advance(duration / 2.0, false);
                clock.Advance(900, true);
                Assert.AreEqual(0.5, clock.Progress);
                clock.Advance(duration / 2.0, false);
                Assert.IsTrue(clock.Complete);
                authored += clock.Elapsed;
            }
            Assert.AreEqual(120, authored);
        }

        [Test]
        public void FrameHitchClampsAtShotEndAndResetStartsFresh()
        {
            var clock = new CinematicShotClock();
            clock.Reset(12);
            clock.Advance(50, false);
            Assert.AreEqual(12, clock.Elapsed);
            Assert.AreEqual(1, clock.Progress);
            clock.Reset(14);
            Assert.IsFalse(clock.Complete);
            Assert.AreEqual(0, clock.Elapsed);
        }

        [Test]
        public void InvalidDeltasCannotPoisonTimeline()
        {
            var clock = new CinematicShotClock();
            clock.Reset(12);
            foreach (double delta in new[] { -1.0, double.NaN, double.PositiveInfinity }) clock.Advance(delta, false);
            Assert.AreEqual(0, clock.Elapsed);
            Assert.Throws<System.ArgumentOutOfRangeException>(() => clock.Reset(double.NaN));
            Assert.Throws<System.ArgumentOutOfRangeException>(() => clock.Reset(0));
        }
    }
}
