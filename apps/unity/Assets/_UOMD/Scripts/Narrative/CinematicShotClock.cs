using System;

namespace Uomd.Narrative
{
    /// <summary>One normal-speed shot. Loading, pause and manual-read holds never consume its authored duration.</summary>
    public sealed class CinematicShotClock
    {
        public double Duration { get; private set; } = 1;
        public double Elapsed { get; private set; }
        public double Progress => Elapsed / Duration;
        public bool Complete => Elapsed >= Duration;

        public void Reset(double duration)
        {
            if (double.IsNaN(duration) || double.IsInfinity(duration) || duration <= 0) throw new ArgumentOutOfRangeException(nameof(duration));
            Duration = duration;
            Elapsed = 0;
        }

        public void Advance(double delta, bool held)
        {
            if (held || double.IsNaN(delta) || double.IsInfinity(delta) || delta <= 0) return;
            Elapsed = Math.Min(Duration, Elapsed + delta);
        }
    }
}
