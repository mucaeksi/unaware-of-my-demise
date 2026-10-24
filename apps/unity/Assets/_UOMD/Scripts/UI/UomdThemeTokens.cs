#nullable enable
using UnityEngine;

namespace Uomd.UI
{
    /// <summary>
    /// Exact C# port of apps/game/src/ui/theme.ts.
    /// Provides Gothic-Anime color palette, typography sizes (in 1920x1080 reference pixels),
    /// and sorting layer depths.
    /// </summary>
    public static class UomdThemeTokens
    {
        public static readonly Color Void = FromHex(0x0a0610);
        public static readonly Color Ink = FromHex(0x120a18);
        public static readonly Color Plum = FromHex(0x2a1530);
        public static readonly Color PlumHi = FromHex(0x4a2548);
        public static readonly Color Silver = FromHex(0xc9b6e4);
        public static readonly Color Bone = FromHex(0xe9e2d4);
        public static readonly Color Gold = FromHex(0xb8975a);
        public static readonly Color GoldHi = FromHex(0xe3c37d);
        public static readonly Color Crimson = FromHex(0x8f1d3a);
        public static readonly Color CrimsonHi = FromHex(0xd4325c);
        public static readonly Color Veil = FromHex(0xb48cff);
        public static readonly Color HpGood = FromHex(0x6fbf73);
        public static readonly Color HpMid = FromHex(0xd9a441);
        public static readonly Color HpLow = FromHex(0xc8324a);
        public static readonly Color Focus = FromHex(0x8fb8ff);
        public static readonly Color Shield = FromHex(0x9fd0ff);
        public static readonly Color PlayerSide = FromHex(0x7fb2ff);
        public static readonly Color EnemySide = FromHex(0xd4325c);

        public static readonly Color TextPrimary = FromHex(0xefe8f5);
        public static readonly Color TextDim = FromHex(0xa99bb8);
        public static readonly Color TextCrit = FromHex(0xffd86b);

        public const int FontSizeTitle = 96;
        public const int FontSizeH1 = 56;
        public const int FontSizeH2 = 40;
        public const int FontSizeBody = 38;
        public const int FontSizeSmall = 30;
        public const int MinTouchTargetPx = 120; // ~48dp on a 1080p phone

        public const int DepthBg = 0;
        public const int DepthWorld = 100;
        public const int DepthUnits = 200;
        public const int DepthFx = 1400;
        public const int DepthHud = 1600;
        public const int DepthModal = 2000;
        public const int DepthToast = 2200;

        public static Color FromHex(int rgb)
        {
            float r = ((rgb >> 16) & 0xFF) / 255f;
            float g = ((rgb >> 8) & 0xFF) / 255f;
            float b = (rgb & 0xFF) / 255f;
            return new Color(r, g, b, 1f);
        }

        public static Color HpBarColor(float normalizedRatio)
        {
            if (normalizedRatio <= 0.28f) return HpLow;
            if (normalizedRatio <= 0.58f) return HpMid;
            return HpGood;
        }
    }
}
