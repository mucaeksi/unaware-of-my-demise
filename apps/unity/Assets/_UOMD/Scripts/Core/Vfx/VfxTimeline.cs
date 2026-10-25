#nullable enable
using System;
using System.Collections.Generic;

namespace Uomd.Core.Vfx
{
    /// <summary>The easing curves of apps/game/src/core/anim.ts (the VFX grammar names a subset).</summary>
    public static class VfxEase
    {
        private const double S = 1.70158;

        public static double Apply(string name, double t) => name switch
        {
            "linear" => t,
            "quad.in" => t * t,
            "quad.out" => 1 - (1 - t) * (1 - t),
            "cubic.out" => 1 - (1 - t) * (1 - t) * (1 - t),
            "back.out" => 1 - Back(1 - t),
            "sine.inout" => t < 0.5 ? Sine(2 * t) / 2 : 1 - Sine(2 - 2 * t) / 2,
            _ => t
        };

        private static double Back(double t) => (S + 1) * t * t * t - S * t * t;
        private static double Sine(double t) => 1 - Math.Cos(t * Math.PI / 2);
    }

    public sealed class VfxPlayOptions
    {
        public double X, Y;
        public string? Element;
        /// <summary>Uniform size multiplier (offsets, scales and speeds).</summary>
        public double Scale = 1;
        /// <summary>1 = the attack travels left→right; -1 mirrors offsets, angles and crescent bows.</summary>
        public int Dir = 1;
        /// <summary>Timing multiplier for the whole preset (2 = twice as long).</summary>
        public double Pace = 1;
        /// <summary>Landing point of a projectile element.</summary>
        public double? TargetX, TargetY;
    }

    public sealed class VfxEnvironment
    {
        public bool Particles = true;
        public double ParticleDensity = 1;
        public bool ReducedMotion;
        public bool ReduceFlash;
    }

    /// <summary>Transform of a node at one moment, relative to the stage (reference pixels, degrees).</summary>
    public readonly struct VfxState
    {
        public VfxState(double x, double y, double scaleX, double scaleY, double angle, double alpha)
        {
            X = x;
            Y = y;
            ScaleX = scaleX;
            ScaleY = scaleY;
            Angle = angle;
            Alpha = alpha;
        }

        public double X { get; }
        public double Y { get; }
        public double ScaleX { get; }
        public double ScaleY { get; }
        public double Angle { get; }
        public double Alpha { get; }
    }

    /// <summary>One drawable of a playing preset: a tinted procedural texture or a vector shape, alive in [StartMs, EndMs).</summary>
    public sealed class VfxNode
    {
        private readonly Func<double, VfxState> _evaluate;

        internal VfxNode(string layer, int depth, string blend, double startMs, double endMs, int color, Func<double, VfxState> evaluate)
        {
            Layer = layer;
            Depth = depth;
            Blend = blend;
            StartMs = startMs;
            EndMs = endMs;
            Color = color;
            _evaluate = evaluate;
        }

        /// <summary>Texture name for a sprite/particle/projectile; null for a shape.</summary>
        public string? Texture { get; internal set; }
        /// <summary>The shape element (geometry, counts) for a vector shape.</summary>
        public VfxElement? Shape { get; internal set; }
        public int Color { get; }
        public int Color2 { get; internal set; }
        public int Secondary { get; internal set; }
        public string Layer { get; }
        public int Depth { get; }
        public string Blend { get; }
        public double StartMs { get; }
        public double EndMs { get; }
        public bool IsParticle { get; internal set; }

        /// <summary>State at a time since the preset started (only meaningful within [StartMs, EndMs)).</summary>
        public VfxState Evaluate(double tMs) => _evaluate(tMs);
    }

    public readonly struct VfxCueEvent
    {
        public VfxCueEvent(double atMs, string cue, double durationMs, double intensity)
        {
            AtMs = atMs;
            Cue = cue;
            DurationMs = durationMs;
            Intensity = intensity;
        }

        public double AtMs { get; }
        public string Cue { get; }
        public double DurationMs { get; }
        public double Intensity { get; }
    }

    /// <summary>A compiled preset: every node with its lifetime, the camera cues and when the caller may continue.</summary>
    public sealed class VfxPlayback
    {
        public static readonly VfxPlayback Empty = new VfxPlayback(new List<VfxNode>(), new List<VfxCueEvent>(), 0, null);

        internal VfxPlayback(List<VfxNode> nodes, List<VfxCueEvent> cues, double endMs, double? landingMs)
        {
            Nodes = nodes;
            Cues = cues;
            EndMs = endMs;
            LandingMs = landingMs;
        }

        public IReadOnlyList<VfxNode> Nodes { get; }
        public IReadOnlyList<VfxCueEvent> Cues { get; }
        /// <summary>When the last sprite, shape or burst finishes.</summary>
        public double EndMs { get; }
        /// <summary>When the projectile lands, if the preset has one.</summary>
        public double? LandingMs { get; }
        /// <summary>VfxStage.play resolves here: at the landing, or when the last element finishes.</summary>
        public double CompletionMs => LandingMs ?? EndMs;
        /// <summary>When every node (trail particles included) is gone.</summary>
        public double LastNodeMs
        {
            get
            {
                double last = 0;
                foreach (var n in Nodes) last = Math.Max(last, n.EndMs);
                return last;
            }
        }
    }

    /// <summary>
    /// Compiles a preset into a deterministic timeline (port of apps/game/src/vfx/VfxStage.ts play()). The TS player
    /// integrated particles per frame; here every node has a closed-form state, so the result does not depend on the frame
    /// rate and can be tested headlessly. The Unity layer only draws what Evaluate returns.
    /// </summary>
    public static class VfxTimeline
    {
        public static VfxPlayback Compile(VfxPack? pack, string presetId, VfxPlayOptions o, VfxEnvironment env, Random random)
        {
            if (pack == null || env.ReducedMotion || !pack.Presets.TryGetValue(presetId, out var preset)) return VfxPlayback.Empty;
            var pal = pack.PaletteFor(o.Element);
            double s = o.Scale, pace = Math.Max(0.1, o.Pace);
            int dir = o.Dir < 0 ? -1 : 1;
            var nodes = new List<VfxNode>();
            var cues = new List<VfxCueEvent>();
            double end = 0;
            double? landing = null;
            foreach (var el in preset.Elements)
            {
                switch (el.Kind)
                {
                    case VfxKind.Sprite:
                    case VfxKind.Shape:
                        if (env.ReduceFlash) break;
                        end = Math.Max(end, Tweened(el, o, pal, s, dir, pace, nodes));
                        break;
                    case VfxKind.Burst:
                        if (env.ReduceFlash || !env.Particles || env.ParticleDensity <= 0) break;
                        end = Math.Max(end, Burst(el, o, pal, s, dir, pace, env, random, nodes));
                        break;
                    case VfxKind.Projectile:
                        landing = Projectile(el, o, pal, s, pace, env, random, nodes);
                        break;
                    case VfxKind.Cue:
                        cues.Add(new VfxCueEvent(el.DelayMs * pace, el.Cue, el.DurationMs * pace, el.Intensity));
                        break;
                }
            }
            return new VfxPlayback(nodes, cues, end, landing);
        }

        private readonly struct Resolved
        {
            public Resolved(double x, double y, double sx, double sy, double alpha, double angle)
            {
                X = x; Y = y; Sx = sx; Sy = sy; Alpha = alpha; Angle = angle;
            }
            public double X { get; }
            public double Y { get; }
            public double Sx { get; }
            public double Sy { get; }
            public double Alpha { get; }
            public double Angle { get; }
        }

        /// <summary>Offsets and scales follow the play scale; dir mirrors horizontally (negative x scale, negated angle).</summary>
        private static Resolved Resolve(VfxProps p, double s, int dir, int mirror, double step)
        {
            double Base(double? v) => ((v ?? 1) + step) * s;
            return new Resolved((p.X ?? 0) * s * dir, (p.Y ?? 0) * s, Base(p.ScaleX ?? p.Scale) * dir, Base(p.ScaleY ?? p.Scale), p.Alpha ?? 1, (p.Angle ?? 0) * mirror * dir);
        }

        private static double Lerp(double a, double b, double k) => a + (b - a) * k;

        private static double Tweened(VfxElement el, VfxPlayOptions o, VfxPalette pal, double s, int dir, double pace, List<VfxNode> nodes)
        {
            int reps = el.Repeat?.Count ?? 1;
            double end = 0;
            for (int i = 0; i < reps; i++)
            {
                double start = (el.DelayMs + i * (el.Repeat?.EveryMs ?? 0)) * pace;
                double duration = el.DurationMs * pace;
                int mirror = el.Repeat != null && el.Repeat.MirrorAngle && i % 2 == 1 ? -1 : 1;
                string tint = el.Repeat?.Tints != null ? el.Repeat.Tints[i % el.Repeat.Tints.Count] : el.Tint;
                double step = (el.Repeat?.ScaleStep ?? 0) * i;
                double fadeDelay = el.Fade != null ? el.Fade.DelayMs * pace : 0, fadeDuration = el.Fade != null ? el.Fade.DurationMs * pace : 0;
                double fadeEnd = el.Fade != null ? fadeDelay + fadeDuration : 0;
                end = Math.Max(end, start + Math.Max(duration, fadeEnd));
                var from = Resolve(el.From, s, dir, mirror, 0);
                var to = Resolve(el.From.MergedWith(el.To), s, dir, mirror, step);
                bool alphaTweens = to.Alpha != from.Alpha;
                var fade = el.Fade;
                double ox = o.X, oy = o.Y;
                VfxState Evaluate(double t)
                {
                    double local = t - start;
                    double k = VfxEase.Apply(el.Ease, Math.Min(1, Math.Max(0, local / duration)));
                    double alpha = from.Alpha;
                    if (fade != null && local >= fadeDelay) alpha = from.Alpha * (1 - VfxEase.Apply(fade.Ease, Math.Min(1, (local - fadeDelay) / fadeDuration)));
                    else if (alphaTweens) alpha = Lerp(from.Alpha, to.Alpha, k);
                    // back.out overshoots alpha past its target; the renderer clamps it like PIXI does
                    return new VfxState(ox + Lerp(from.X, to.X, k), oy + Lerp(from.Y, to.Y, k), Lerp(from.Sx, to.Sx, k), Lerp(from.Sy, to.Sy, k), Lerp(from.Angle, to.Angle, k), Math.Min(1, Math.Max(0, alpha)));
                }
                // without a fade the node goes when its tween completes; with one, when the fade completes
                double nodeEnd = start + (fade != null ? fadeEnd : duration);
                var node = new VfxNode(el.Layer, el.Depth + i, el.Blend, start, nodeEnd, VfxPack.ResolveColor(tint, pal), Evaluate);
                if (el.Kind == VfxKind.Sprite) node.Texture = el.Texture;
                else
                {
                    node.Shape = el;
                    node.Color2 = VfxPack.ResolveColor(el.Tint2, pal);
                    node.Secondary = pal.Secondary;
                }
                nodes.Add(node);
            }
            return end;
        }

        private static double Rand(Random random, double[] range) => range[0] + random.NextDouble() * (range[1] - range[0]);

        private static double Burst(VfxElement el, VfxPlayOptions o, VfxPalette pal, double s, int dir, double pace, VfxEnvironment env, Random random, List<VfxNode> nodes)
        {
            int count = (int)Math.Max(Math.Min(4, el.Count), Math.Floor(el.Count * env.ParticleDensity + 0.5));
            double start = el.DelayMs * pace, life = el.LifespanMs * pace;
            for (int i = 0; i < count; i++)
            {
                double x0 = o.X + Rand(random, el.OffsetX) * s * dir, y0 = o.Y + Rand(random, el.OffsetY) * s;
                double a = Rand(random, el.AngleRange) * Math.PI / 180, speed = Rand(random, el.Speed) * s;
                double vx = Math.Cos(a) * speed * dir, vy = Math.Sin(a) * speed, gy = el.GravityY;
                double spin = el.Spin ? (random.NextDouble() * 2 - 1) * 12 : 0, rot0 = el.Spin ? random.NextDouble() * Math.PI * 2 : 0;
                double s0 = el.ScaleStart * s, s1 = el.ScaleEnd * s;
                double a0 = el.AlphaStart, a1 = el.AlphaEnd;
                VfxState Evaluate(double t)
                {
                    double age = Math.Max(0, t - start) / 1000.0, k = Math.Min(1, (t - start) / life);
                    double scale = Lerp(s0, s1, k);
                    return new VfxState(x0 + vx * age, y0 + vy * age + 0.5 * gy * age * age, scale, scale, (rot0 + spin * age) * 180 / Math.PI, Lerp(a0, a1, k));
                }
                var tint = el.Tints[i % el.Tints.Count];
                nodes.Add(new VfxNode(el.Layer, el.Depth, el.Blend, start, start + life, VfxPack.ResolveColor(tint, pal), Evaluate) { Texture = el.Texture, IsParticle = true });
            }
            return start + life;
        }

        private static double Projectile(VfxElement el, VfxPlayOptions o, VfxPalette pal, double s, double pace, VfxEnvironment env, Random random, List<VfxNode> nodes)
        {
            double fx = o.X, fy = o.Y, tx = o.TargetX ?? o.X, ty = o.TargetY ?? o.Y;
            double mx = (fx + tx) / 2, my = Math.Min(fy, ty) - el.ArcHeight;
            double duration = el.DurationMs * pace;
            double Progress(double t) => VfxEase.Apply(el.Ease, Math.Min(1, Math.Max(0, t / duration)));
            (double X, double Y) At(double k)
            {
                double u = 1 - k;
                return (u * u * fx + 2 * u * k * mx + k * k * tx, u * u * fy + 2 * u * k * my + k * k * ty);
            }
            double orbScale = el.ProjectileScale * s;
            nodes.Add(new VfxNode(el.Layer, el.Depth, el.Blend, 0, duration, VfxPack.ResolveColor(el.Tint, pal), t =>
            {
                double k = Progress(t);
                var p = At(k);
                return new VfxState(p.X, p.Y, orbScale, orbScale, k * 360 * el.SpinTurns, 1);
            }) { Texture = el.Texture });
            if (el.Halo != null)
            {
                double haloScale = el.ProjectileScale * 2.2 * s;
                nodes.Add(new VfxNode(el.Layer, el.Depth - 1, el.Blend, 0, duration, VfxPack.ResolveColor(el.HaloTint, pal), t =>
                {
                    var p = At(Progress(t));
                    return new VfxState(p.X, p.Y, haloScale, haloScale, 0, 1);
                }) { Texture = el.Halo });
            }
            var trail = el.Trail != null && env.Particles && env.ParticleDensity > 0 ? el.Trail : null;
            if (trail != null)
            {
                // the TS player drops a trail sprite every `every_ms` of eased travel; spawn times are found once here
                for (int n = 1; n * trail.EveryMs <= duration; n++)
                {
                    double target = n * trail.EveryMs / duration;
                    double lo = 0, hi = duration;
                    for (int it = 0; it < 30; it++)
                    {
                        double mid = (lo + hi) / 2;
                        if (Progress(mid) < target) lo = mid; else hi = mid;
                    }
                    double spawn = hi;
                    var p0 = At(Progress(spawn));
                    double a = random.NextDouble() * Math.PI * 2, speed = 20 + random.NextDouble() * 60;
                    double vx = Math.Cos(a) * speed, vy = Math.Sin(a) * speed, life = trail.LifespanMs, s0 = trail.Scale * s;
                    var tint = trail.Tints[random.Next(trail.Tints.Count)];
                    nodes.Add(new VfxNode(el.Layer, el.Depth - 2, el.Blend, spawn, spawn + life, VfxPack.ResolveColor(tint, pal), t =>
                    {
                        double age = (t - spawn) / 1000.0, k = Math.Min(1, Math.Max(0, (t - spawn) / life));
                        double scale = s0 * (1 - k);
                        return new VfxState(p0.X + vx * age, p0.Y + vy * age, scale, scale, age * 6 * 180 / Math.PI, 0.85 * (1 - k));
                    }) { Texture = trail.Texture, IsParticle = true });
                }
            }
            return duration;
        }
    }
}
