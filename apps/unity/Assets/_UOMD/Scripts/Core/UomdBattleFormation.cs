#nullable enable
using System;

namespace Uomd.Core
{
    public readonly struct BattleSpot
    {
        public BattleSpot(double x, double y, double depthScale)
        {
            X = x;
            Y = y;
            DepthScale = depthScale;
        }

        public double X { get; }
        public double Y { get; }
        /// <summary>Perspective scale: units lower on screen are slightly larger.</summary>
        public double DepthScale { get; }
    }

    public sealed class BattleLayoutSpec
    {
        public string Id = "";
        public double GroundTop, GroundBottom, FrontX, RearX, JitterX;
        /// <summary>A 2-unit front row sits between a 3-unit rear row's Y bands so 5v5 plates never collide.</summary>
        public bool InterleaveFrontTwo;
        public double TurnOrderY, SkillBarY, DescY, PlateOffsetY, ScaleMin, ScaleSpan;
    }

    /// <summary>
    /// Battle formation (port of apps/game/src/battle/formation.ts): 3-rear + 2-front spots on the battlefield floor in the
    /// 1920×1080 reference space, mirrored for the enemy side. "afk_faithful" is the selected layout (R10, code C).
    /// </summary>
    public static class UomdBattleFormation
    {
        public const double RefWidth = 1920;

        public static readonly BattleLayoutSpec Current = new BattleLayoutSpec
        {
            Id = "current", GroundTop = 565, GroundBottom = 780, FrontX = 620, RearX = 360, JitterX = 24, InterleaveFrontTwo = false,
            TurnOrderY = 132, SkillBarY = 964, DescY = 868, PlateOffsetY = 22, ScaleMin = 0.56, ScaleSpan = 0.08
        };

        public static readonly BattleLayoutSpec ArenaLite = new BattleLayoutSpec
        {
            Id = "arena_lite", GroundTop = 568, GroundBottom = 788, FrontX = 640, RearX = 340, JitterX = 24, InterleaveFrontTwo = false,
            TurnOrderY = 132, SkillBarY = 968, DescY = 874, PlateOffsetY = 18, ScaleMin = 0.55, ScaleSpan = 0.08
        };

        public static readonly BattleLayoutSpec AfkFaithful = new BattleLayoutSpec
        {
            Id = "afk_faithful", GroundTop = 568, GroundBottom = 788, FrontX = 590, RearX = 346, JitterX = 28, InterleaveFrontTwo = true,
            TurnOrderY = 128, SkillBarY = 964, DescY = 872, PlateOffsetY = 18, ScaleMin = 0.53, ScaleSpan = 0.07
        };

        public static BattleLayoutSpec Spec(string? preset) => preset switch
        {
            "current" => Current,
            "arena_lite" => ArenaLite,
            _ => AfkFaithful
        };

        /// <summary>Screen position of a unit (spotFor): rear column at 0/50/100 % of the ground band, front interleaved at 25/75 %.</summary>
        public static BattleSpot SpotFor(string side, string row, int index, int count, string? preset = null, double safeInsetX = 0)
        {
            var spec = Spec(preset);
            double span = spec.GroundBottom - spec.GroundTop;
            double y;
            if (count <= 1)
            {
                y = spec.InterleaveFrontTwo
                    ? JsRound(spec.GroundTop + span * (row == "front" ? 0.62 : 0.36))
                    : (spec.GroundTop + spec.GroundBottom) / 2;
            }
            else if (spec.InterleaveFrontTwo && row == "front" && count == 2)
            {
                y = JsRound(spec.GroundTop + span * (index == 0 ? 0.25 : 0.75));
            }
            else if (spec.InterleaveFrontTwo && row == "rear" && count == 2)
            {
                y = JsRound(spec.GroundTop + span * (index == 0 ? 0.14 : 0.86));
            }
            else
            {
                y = JsRound(spec.GroundTop + span * index / (count - 1));
            }
            double jitter = count <= 1 ? 0
                : count == 3 ? index == 0 ? -spec.JitterX : index == 1 ? JsRound(spec.JitterX * 0.85) : -JsRound(spec.JitterX * 0.45)
                : index % 2 == 0 ? -spec.JitterX : spec.JitterX;
            double basePlayerX = row == "front" ? spec.FrontX : spec.RearX;
            double minX = Math.Max(220, safeInsetX + 160);
            double clamped = Math.Max(minX, basePlayerX + jitter);
            double x = side == "player" ? clamped : RefWidth - clamped;
            double depth = Math.Round(spec.ScaleMin + spec.ScaleSpan * ((y - spec.GroundTop) / span), 4, MidpointRounding.AwayFromZero);
            return new BattleSpot(x, y, depth);
        }

        /// <summary>JavaScript Math.round (halves towards +∞).</summary>
        private static double JsRound(double v) => Math.Floor(v + 0.5);
    }
}
