#nullable enable
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace Uomd.Narrative
{
    public readonly struct CharacterStature
    {
        public CharacterStature(int heightCm, float vnTargetHeight, float vnBaseY, string nativeFacing)
        {
            HeightCm = heightCm;
            VnTargetHeight = vnTargetHeight;
            VnBaseY = vnBaseY;
            NativeFacing = nativeFacing;
        }

        /// <summary>Canonical physical height in centimetres.</summary>
        public int HeightCm { get; }
        /// <summary>Portrait height in the 1920×1080 story scene.</summary>
        public float VnTargetHeight { get; }
        /// <summary>Y of the bottom edge of the knee-up portrait in the 1920×1080 story scene.</summary>
        public float VnBaseY { get; }
        /// <summary>Direction the portrait art faces ("left" | "right").</summary>
        public string NativeFacing { get; }
    }

    /// <summary>
    /// Canonical stature table (port of apps/game/src/content/characterStature.ts): tall vanguards visibly tower over petite
    /// characters in every story scene. Unknown ids get the same deterministic fallback as the TypeScript client.
    /// </summary>
    public static class UomdCharacterStature
    {
        private const float RefHeight = 1080f;
        private static readonly Regex TallRole = new Regex("knight|guard|vanguard|templar|captain|warden|pilgrim|construct|boss", RegexOptions.CultureInvariant);

        private static readonly Dictionary<string, CharacterStature> Table = new Dictionary<string, CharacterStature>(StringComparer.Ordinal)
        {
            ["garrick_cinder"] = new CharacterStature(195, 1255, RefHeight + 8, "right"),
            ["corbin_locke"] = new CharacterStature(191, 1235, RefHeight + 10, "right"),
            ["mahmut"] = new CharacterStature(190, 1185, RefHeight + 10, "right"),
            ["cassian_thorne"] = new CharacterStature(188, 1210, RefHeight + 12, "right"),
            ["marek_vane"] = new CharacterStature(185, 1190, RefHeight + 14, "right"),
            ["brin_alder"] = new CharacterStature(184, 1180, RefHeight + 14, "right"),
            ["jori_flint"] = new CharacterStature(182, 1168, RefHeight + 16, "right"),
            ["dorian_kesk"] = new CharacterStature(181, 1160, RefHeight + 16, "right"),
            ["nara_vell"] = new CharacterStature(178, 1138, RefHeight + 18, "left"),
            ["rowan_reed"] = new CharacterStature(174, 1110, RefHeight + 20, "right"),
            ["odelia_pike"] = new CharacterStature(173, 1102, RefHeight + 20, "left"),
            ["sister_aveline"] = new CharacterStature(171, 1088, RefHeight + 22, "left"),
            ["mirel_quill"] = new CharacterStature(170, 1080, RefHeight + 22, "left"),
            ["vespera_wisp"] = new CharacterStature(169, 1072, RefHeight + 22, "left"),
            ["kera_voss"] = new CharacterStature(168, 1064, RefHeight + 24, "left"),
            ["tilda_fen"] = new CharacterStature(167, 1056, RefHeight + 24, "left"),
            ["iona_mist"] = new CharacterStature(166, 1048, RefHeight + 24, "left"),
            ["iona"] = new CharacterStature(166, 1048, RefHeight + 24, "left"),
            ["sable_wren"] = new CharacterStature(165, 1040, RefHeight + 25, "left"),
            ["clem_marr"] = new CharacterStature(162, 1015, RefHeight + 26, "left"),
            ["fadyme"] = new CharacterStature(161, 1095, RefHeight + 18, "left"),
            ["thistle_roe"] = new CharacterStature(160, 990, RefHeight + 28, "left"),
            ["nixie_vale"] = new CharacterStature(159, 982, RefHeight + 30, "left"),
            ["hana_birch"] = new CharacterStature(158, 974, RefHeight + 30, "left"),
            ["rikka_ember"] = new CharacterStature(156, 960, RefHeight + 32, "left"),
            ["pippa_bell"] = new CharacterStature(154, 944, RefHeight + 34, "left"),
        };

        public static CharacterStature Get(string characterId)
        {
            string key = (characterId ?? "").Trim().ToLowerInvariant();
            if (Table.TryGetValue(key, out var known)) return known;
            if (TallRole.IsMatch(key)) return new CharacterStature(186, 1195, RefHeight + 12, "right");
            return new CharacterStature(168, 1064, RefHeight + 24, "left");
        }
    }

    /// <summary>
    /// Cutscene timing rules of the opening tutorials (port of apps/game/src/entry/cutscene.ts, revision v006, binding):
    /// fixed reveal pace, minimum holds, speaker-change pauses.
    /// </summary>
    public static class UomdCutscene
    {
        public const float Cps = 26f;
        public const float MinShortLineSeconds = 5.5f;
        public const float MinAfterRevealSeconds = 3.2f;
        public const float SameSpeakerPauseSeconds = 0.65f;
        public const float DissolveSeconds = 0.8f;

        /// <summary>Seconds Auto waits after a line is fully shown.</summary>
        public static float HoldSeconds(int chars, float? holdSeconds, bool last, float? closingHoldSeconds)
        {
            float reveal = chars / Cps;
            float hold = Math.Max(MinAfterRevealSeconds, Math.Max(holdSeconds ?? 0f, MinShortLineSeconds - reveal));
            return last ? Math.Max(hold, closingHoldSeconds ?? 0f) : hold;
        }

        /// <summary>Pause before a line: none first, the scene's speaker pause on a change, 0.65 s for the same speaker.</summary>
        public static float PauseSeconds(string? previousSpeaker, string nextSpeaker, float speakerPause)
        {
            if (previousSpeaker == null) return 0f;
            return previousSpeaker == nextSpeaker ? SameSpeakerPauseSeconds : speakerPause;
        }
    }
}
