#nullable enable
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace Uomd.Core.Vfx
{
    /// <summary>Thrown by VfxPack.Parse with the first problem found.</summary>
    public sealed class VfxFormatException : Exception
    {
        public VfxFormatException(string message) : base(message) { }
    }

    public enum VfxKind { Sprite, Shape, Burst, Projectile, Cue }

    /// <summary>Optional transform props (content-schema VfxProps); null = not given.</summary>
    public sealed class VfxProps
    {
        public double? X, Y, Scale, ScaleX, ScaleY, Alpha, Angle;

        /// <summary>{ ...this, ...over } as the TS player builds the `to` state.</summary>
        public VfxProps MergedWith(VfxProps over) => new VfxProps
        {
            X = over.X ?? X,
            Y = over.Y ?? Y,
            Scale = over.Scale ?? Scale,
            ScaleX = over.ScaleX ?? ScaleX,
            ScaleY = over.ScaleY ?? ScaleY,
            Alpha = over.Alpha ?? Alpha,
            Angle = over.Angle ?? Angle
        };
    }

    public sealed class VfxFade
    {
        public int DelayMs, DurationMs;
        public string Ease = "quad.in";
    }

    public sealed class VfxRepeat
    {
        public int Count, EveryMs;
        public double ScaleStep;
        public bool MirrorAngle;
        public IReadOnlyList<string>? Tints;
    }

    public sealed class VfxTrail
    {
        public string Texture = "spark";
        public int EveryMs, LifespanMs;
        public double Scale;
        public IReadOnlyList<string> Tints = Array.Empty<string>();
    }

    /// <summary>
    /// One element of a preset timeline with the content-schema defaults applied (packages/content-schema/src/vfx.ts).
    /// Fields that do not belong to the element's kind keep their defaults and are ignored.
    /// </summary>
    public sealed class VfxElement
    {
        public VfxKind Kind;
        // sprite / shape (tweened)
        public string Texture = "spark";
        public string Shape = "";
        public double Size;
        public int Count = 8;
        public double Thickness = 4;
        public double Bow = -50;
        public string Tint = "core";
        public string Tint2 = "core";
        public double FillAlpha = 0.92;
        public VfxProps From = new VfxProps();
        public VfxProps To = new VfxProps();
        public string Ease = "cubic.out";
        public int DelayMs;
        public int DurationMs;
        public VfxFade? Fade;
        public VfxRepeat? Repeat;
        public string Layer = "fx";
        public int Depth;
        public string Blend = "normal";
        // burst
        public double[] Speed = { 0, 0 };
        public double[] AngleRange = { 0, 360 };
        public double[] OffsetX = { 0, 0 };
        public double[] OffsetY = { 0, 0 };
        public double ScaleStart, ScaleEnd;
        public double AlphaStart = 1, AlphaEnd;
        public bool Spin;
        public int LifespanMs;
        public double GravityY;
        public IReadOnlyList<string> Tints = Array.Empty<string>();
        // projectile
        public string? Halo;
        public string HaloTint = "primary";
        public double ProjectileScale = 0.65;
        public double ArcHeight = 65;
        public double SpinTurns = 1.5;
        public VfxTrail? Trail;
        // cue
        public string Cue = "";
        public double Intensity = 0.5;
    }

    public sealed class VfxPreset
    {
        public VfxPreset(IReadOnlyList<VfxElement> elements) => Elements = elements;
        public IReadOnlyList<VfxElement> Elements { get; }

        public bool HasProjectile
        {
            get
            {
                foreach (var e in Elements) if (e.Kind == VfxKind.Projectile) return true;
                return false;
            }
        }
    }

    public readonly struct VfxPalette
    {
        public VfxPalette(int primary, int secondary, int core)
        {
            Primary = primary;
            Secondary = secondary;
            Core = core;
        }

        public int Primary { get; }
        public int Secondary { get; }
        public int Core { get; }
    }

    /// <summary>
    /// Data-driven combat VFX (D-25, content/base/vfx/vfx_presets.json): a strict C# reader of content-schema VfxPack with its
    /// defaults. A preset is a short timeline over a closed set of primitives (procedural textures, vector shapes, particle
    /// bursts, one projectile, camera cues) — no code, so new effects ship in signed data patches.
    /// </summary>
    public sealed class VfxPack
    {
        public const string Path = "vfx/vfx_presets.json";
        public const int CritGold = 0xffe48f;
        public static readonly VfxPalette Fallback = new VfxPalette(0xb98eff, 0xe55b8a, 0xf4e8ff);

        private static readonly Regex IdPattern = new Regex(@"^[a-z][a-z0-9_]{1,79}\z", RegexOptions.CultureInvariant);
        private static readonly Regex PaletteName = new Regex(@"^[A-Z][A-Za-z]{1,23}\z", RegexOptions.CultureInvariant);
        private static readonly Regex HexColor = new Regex(@"^#[0-9a-fA-F]{6}\z", RegexOptions.CultureInvariant);
        public static readonly string[] Textures = { "spark", "star", "slash", "ring", "pillar", "shard", "bell", "chain", "seal", "droplet", "feather" };
        public static readonly string[] Shapes = { "crescent", "star_flare", "spikes", "crest", "rings", "bars", "bell_arch", "shield_wall", "eclipse_corona", "crosshair" };
        public static readonly string[] Eases = { "linear", "quad.in", "quad.out", "cubic.out", "back.out", "sine.inout" };
        private static readonly string[] Blends = { "normal", "add", "screen" };
        private static readonly string[] Layers = { "ground", "fx", "overlay" };
        private static readonly string[] Cues = { "hit_stop", "shake", "flash" };

        private VfxPack(Dictionary<string, VfxPalette> palettes, Dictionary<string, VfxPreset> presets, Dictionary<string, string> skills)
        {
            Palettes = palettes;
            Presets = presets;
            Skills = skills;
        }

        public IReadOnlyDictionary<string, VfxPalette> Palettes { get; }
        public IReadOnlyDictionary<string, VfxPreset> Presets { get; }
        /// <summary>skill_id → preset id overrides.</summary>
        public IReadOnlyDictionary<string, string> Skills { get; }

        public bool Has(string id) => Presets.ContainsKey(id);

        /// <summary>The preset the pack assigns to a skill, if any (VfxStage.presetForSkill).</summary>
        public string? PresetForSkill(string skillId) =>
            Skills.TryGetValue(skillId, out string? id) && Presets.ContainsKey(id) ? id : null;

        /// <summary>The element's palette, Veil when unknown, the built-in fallback when the pack has none.</summary>
        public VfxPalette PaletteFor(string? element)
        {
            if (element != null && Palettes.TryGetValue(element, out var p)) return p;
            return Palettes.TryGetValue("Veil", out var veil) ? veil : Fallback;
        }

        /// <summary>A colour slot (primary/secondary/core/crit) or #rrggbb as 0xRRGGBB.</summary>
        public static int ResolveColor(string color, VfxPalette palette) => color switch
        {
            "primary" => palette.Primary,
            "secondary" => palette.Secondary,
            "core" => palette.Core,
            "crit" => CritGold,
            _ => Convert.ToInt32(color.Substring(1), 16)
        };

        public static VfxPack Parse(string json) => Parse(UomdJson.Parse(json));

        public static VfxPack Parse(object? raw)
        {
            var root = Obj(raw, "pack", "schema_version", "palettes", "presets", "skills");
            if (Int(root, "schema_version", "schema_version", 1, 1, null) != 1) throw Fail("schema_version", "must be 1");
            var palettes = new Dictionary<string, VfxPalette>(StringComparer.Ordinal);
            if (root.TryGetValue("palettes", out object? rawPalettes))
            {
                foreach (var kv in Obj(rawPalettes, "palettes"))
                {
                    if (!PaletteName.IsMatch(kv.Key)) throw Fail("palettes", $"bad palette name {kv.Key}");
                    var p = Obj(kv.Value, $"palettes.{kv.Key}", "primary", "secondary", "core");
                    string at = $"palettes.{kv.Key}";
                    palettes[kv.Key] = new VfxPalette((int)Int(p, "primary", at, 0, 0xffffff, null), (int)Int(p, "secondary", at, 0, 0xffffff, null), (int)Int(p, "core", at, 0, 0xffffff, null));
                }
            }
            var presets = new Dictionary<string, VfxPreset>(StringComparer.Ordinal);
            foreach (var kv in Obj(Req(root, "presets", "pack"), "presets"))
            {
                if (!IdPattern.IsMatch(kv.Key)) throw Fail("presets", $"bad preset id {kv.Key}");
                presets[kv.Key] = ParsePreset(kv.Value, $"presets.{kv.Key}");
            }
            if (presets.Count > 256) throw Fail("presets", "presets exceed their entry budget");
            var skills = new Dictionary<string, string>(StringComparer.Ordinal);
            if (root.TryGetValue("skills", out object? rawSkills))
            {
                foreach (var kv in Obj(rawSkills, "skills"))
                {
                    if (!IdPattern.IsMatch(kv.Key) || !(kv.Value is string preset) || !IdPattern.IsMatch(preset)) throw Fail("skills", $"bad mapping {kv.Key}");
                    if (!presets.ContainsKey(preset)) throw Fail("skills", $"skill {kv.Key}: unknown preset {preset}");
                    skills[kv.Key] = preset;
                }
            }
            if (skills.Count > 1024) throw Fail("skills", "skill mappings exceed their entry budget");
            return new VfxPack(palettes, presets, skills);
        }

        private static VfxPreset ParsePreset(object? raw, string at)
        {
            var o = Obj(raw, at, "elements");
            if (!(Req(o, "elements", at) is List<object?> items) || items.Count < 1 || items.Count > 24) throw Fail(at, "expected 1..24 elements");
            var elements = new List<VfxElement>(items.Count);
            int projectiles = 0;
            for (int i = 0; i < items.Count; i++)
            {
                var e = ParseElement(items[i], $"{at}.elements.{i}");
                if (e.Kind == VfxKind.Projectile && ++projectiles > 1) throw Fail(at, "at most one projectile");
                elements.Add(e);
            }
            return new VfxPreset(elements);
        }

        private static readonly string[] TweenKeys = { "from", "to", "ease", "delay_ms", "duration_ms", "fade", "repeat", "layer", "depth", "blend" };

        private static VfxElement ParseElement(object? raw, string at)
        {
            if (!(raw is Dictionary<string, object?> peek) || !(peek.TryGetValue("kind", out object? k) && k is string kind)) throw Fail(at, "expected an element with a kind");
            var e = new VfxElement();
            switch (kind)
            {
                case "sprite":
                {
                    var o = Obj(raw, at, Concat(TweenKeys, "kind", "texture", "tint"));
                    e.Kind = VfxKind.Sprite;
                    e.Texture = Enum(o, "texture", at, Textures, null);
                    e.Tint = Color(o, "tint", at, "core");
                    ReadTween(o, at, e);
                    break;
                }
                case "shape":
                {
                    var o = Obj(raw, at, Concat(TweenKeys, "kind", "shape", "size", "count", "thickness", "bow", "tint", "tint2", "fill_alpha"));
                    e.Kind = VfxKind.Shape;
                    e.Shape = Enum(o, "shape", at, Shapes, null);
                    e.Size = Num(o, "size", at, 1, 2000, null);
                    e.Count = (int)Int(o, "count", at, 1, 32, 8);
                    e.Thickness = Num(o, "thickness", at, 0, 400, 4);
                    e.Bow = Num(o, "bow", at, -400, 400, -50);
                    e.Tint = Color(o, "tint", at, "primary");
                    e.Tint2 = Color(o, "tint2", at, "core");
                    e.FillAlpha = Num(o, "fill_alpha", at, 0, 1, 0.92);
                    ReadTween(o, at, e);
                    break;
                }
                case "burst":
                {
                    var o = Obj(raw, at, "kind", "texture", "count", "speed", "angle", "offset_x", "offset_y", "scale", "alpha", "spin", "lifespan_ms", "gravity_y", "tints", "delay_ms", "layer", "depth", "blend");
                    e.Kind = VfxKind.Burst;
                    e.Texture = Enum(o, "texture", at, Textures, null);
                    e.Count = (int)Int(o, "count", at, 1, 64, null);
                    e.Speed = Range(o, "speed", at, 0, 3000, null);
                    e.AngleRange = Range(o, "angle", at, -720, 720, new double[] { 0, 360 });
                    e.OffsetX = Range(o, "offset_x", at, -600, 600, new double[] { 0, 0 });
                    e.OffsetY = Range(o, "offset_y", at, -600, 600, new double[] { 0, 0 });
                    var scale = Obj(Req(o, "scale", at), at + ".scale", "start", "end");
                    e.ScaleStart = Num(scale, "start", at + ".scale", 0, 8, null);
                    e.ScaleEnd = Num(scale, "end", at + ".scale", 0, 8, null);
                    if (o.TryGetValue("alpha", out object? alphaRaw))
                    {
                        var alpha = Obj(alphaRaw, at + ".alpha", "start", "end");
                        e.AlphaStart = Num(alpha, "start", at + ".alpha", 0, 1, null);
                        e.AlphaEnd = Num(alpha, "end", at + ".alpha", 0, 1, null);
                    }
                    e.Spin = Bool(o, "spin", at, false);
                    e.LifespanMs = (int)Int(o, "lifespan_ms", at, 16, 5000, null);
                    e.GravityY = Num(o, "gravity_y", at, -3000, 3000, 0);
                    e.Tints = Colors(o, "tints", at);
                    e.DelayMs = (int)Int(o, "delay_ms", at, 0, 5000, 0);
                    e.Layer = Enum(o, "layer", at, Layers, "fx");
                    e.Depth = (int)Int(o, "depth", at, 0, 40, 0);
                    e.Blend = Enum(o, "blend", at, Blends, "add");
                    break;
                }
                case "projectile":
                {
                    var o = Obj(raw, at, "kind", "texture", "halo", "tint", "halo_tint", "scale", "arc_height", "spin_turns", "duration_ms", "ease", "trail", "layer", "depth", "blend");
                    e.Kind = VfxKind.Projectile;
                    e.Texture = Enum(o, "texture", at, Textures, null);
                    e.Halo = o.ContainsKey("halo") ? Enum(o, "halo", at, Textures, null) : null;
                    e.Tint = Color(o, "tint", at, "core");
                    e.HaloTint = Color(o, "halo_tint", at, "primary");
                    e.ProjectileScale = Num(o, "scale", at, 0, 8, 0.65);
                    e.ArcHeight = Num(o, "arc_height", at, 0, 800, 65);
                    e.SpinTurns = Num(o, "spin_turns", at, 0, 8, 1.5);
                    e.DurationMs = (int)Int(o, "duration_ms", at, 16, 3000, null);
                    e.Ease = Enum(o, "ease", at, Eases, "quad.in");
                    if (o.TryGetValue("trail", out object? trailRaw))
                    {
                        string t = at + ".trail";
                        var tr = Obj(trailRaw, t, "texture", "every_ms", "lifespan_ms", "scale", "tints");
                        e.Trail = new VfxTrail
                        {
                            Texture = Enum(tr, "texture", t, Textures, null),
                            EveryMs = (int)Int(tr, "every_ms", t, 8, 500, null),
                            LifespanMs = (int)Int(tr, "lifespan_ms", t, 16, 2000, null),
                            Scale = Num(tr, "scale", t, 0, 8, null),
                            Tints = Colors(tr, "tints", t)
                        };
                    }
                    e.Layer = Enum(o, "layer", at, Layers, "fx");
                    e.Depth = (int)Int(o, "depth", at, 0, 40, 20);
                    e.Blend = Enum(o, "blend", at, Blends, "add");
                    break;
                }
                case "cue":
                {
                    var o = Obj(raw, at, "kind", "cue", "delay_ms", "duration_ms", "intensity");
                    e.Kind = VfxKind.Cue;
                    e.Cue = Enum(o, "cue", at, Cues, null);
                    e.DelayMs = (int)Int(o, "delay_ms", at, 0, 5000, 0);
                    e.DurationMs = (int)Int(o, "duration_ms", at, 1, 1500, null);
                    e.Intensity = Num(o, "intensity", at, 0, 1, 0.5);
                    break;
                }
                default:
                    throw Fail(at, $"unknown kind {kind}");
            }
            return e;
        }

        private static void ReadTween(Dictionary<string, object?> o, string at, VfxElement e)
        {
            e.From = o.ContainsKey("from") ? Props(o["from"], at + ".from") : new VfxProps();
            e.To = o.ContainsKey("to") ? Props(o["to"], at + ".to") : new VfxProps();
            e.Ease = Enum(o, "ease", at, Eases, "cubic.out");
            e.DelayMs = (int)Int(o, "delay_ms", at, 0, 5000, 0);
            e.DurationMs = (int)Int(o, "duration_ms", at, 1, 5000, null);
            if (o.TryGetValue("fade", out object? fadeRaw))
            {
                string f = at + ".fade";
                var fade = Obj(fadeRaw, f, "delay_ms", "duration_ms", "ease");
                e.Fade = new VfxFade { DelayMs = (int)Int(fade, "delay_ms", f, 0, 5000, null), DurationMs = (int)Int(fade, "duration_ms", f, 1, 5000, null), Ease = Enum(fade, "ease", f, Eases, "quad.in") };
            }
            if (o.TryGetValue("repeat", out object? repeatRaw))
            {
                string r = at + ".repeat";
                var rep = Obj(repeatRaw, r, "count", "every_ms", "scale_step", "mirror_angle", "tints");
                e.Repeat = new VfxRepeat
                {
                    Count = (int)Int(rep, "count", r, 1, 8, null),
                    EveryMs = (int)Int(rep, "every_ms", r, 0, 5000, null),
                    ScaleStep = Num(rep, "scale_step", r, 0, 2, 0),
                    MirrorAngle = Bool(rep, "mirror_angle", r, false),
                    Tints = rep.ContainsKey("tints") ? Colors(rep, "tints", r) : null
                };
            }
            e.Layer = Enum(o, "layer", at, Layers, "fx");
            e.Depth = (int)Int(o, "depth", at, 0, 40, 0);
            e.Blend = Enum(o, "blend", at, Blends, "normal");
        }

        private static VfxProps Props(object? raw, string at)
        {
            var o = Obj(raw, at, "x", "y", "scale", "scale_x", "scale_y", "alpha", "angle");
            double? Opt(string key, double min, double max) => o.ContainsKey(key) ? Num(o, key, at, min, max, null) : (double?)null;
            return new VfxProps
            {
                X = Opt("x", -1200, 1200),
                Y = Opt("y", -1200, 1200),
                Scale = Opt("scale", 0, 8),
                ScaleX = Opt("scale_x", 0, 8),
                ScaleY = Opt("scale_y", 0, 8),
                Alpha = Opt("alpha", 0, 1),
                Angle = Opt("angle", -1440, 1440)
            };
        }

        // ------------------------------------------------------------------------------------------- readers

        private static string[] Concat(string[] a, params string[] b)
        {
            var all = new string[a.Length + b.Length];
            a.CopyTo(all, 0);
            b.CopyTo(all, a.Length);
            return all;
        }

        private static Dictionary<string, object?> Obj(object? value, string at, params string[] allowed)
        {
            if (!(value is Dictionary<string, object?> o)) throw Fail(at, "expected object");
            if (allowed.Length > 0)
            {
                foreach (string key in o.Keys) if (Array.IndexOf(allowed, key) < 0) throw Fail(at, $"unrecognized key '{key}'");
            }
            return o;
        }

        private static object? Req(Dictionary<string, object?> o, string key, string at) =>
            o.TryGetValue(key, out object? v) ? v : throw Fail(at, $"{key} is required");

        private static double Num(Dictionary<string, object?> o, string key, string at, double min, double max, double? fallback)
        {
            if (!o.TryGetValue(key, out object? v))
            {
                if (fallback.HasValue) return fallback.Value;
                throw Fail(at, $"{key} is required");
            }
            double n = v switch { long l => l, double d => d, _ => throw Fail(at, $"{key} must be a number") };
            if (double.IsNaN(n) || n < min || n > max) throw Fail(at, $"{key} must be {min}..{max}");
            return n;
        }

        private static long Int(Dictionary<string, object?> o, string key, string at, long min, long max, long? fallback)
        {
            double n = Num(o, key, at, min, max, fallback);
            if (Math.Floor(n) != n) throw Fail(at, $"{key} must be an integer");
            return (long)n;
        }

        private static bool Bool(Dictionary<string, object?> o, string key, string at, bool fallback)
        {
            if (!o.TryGetValue(key, out object? v)) return fallback;
            return v is bool b ? b : throw Fail(at, $"{key} must be a boolean");
        }

        private static string Enum(Dictionary<string, object?> o, string key, string at, string[] allowed, string? fallback)
        {
            if (!o.TryGetValue(key, out object? v))
            {
                if (fallback != null) return fallback;
                throw Fail(at, $"{key} is required");
            }
            if (!(v is string s) || Array.IndexOf(allowed, s) < 0) throw Fail(at, $"{key} must be one of {string.Join(", ", allowed)}");
            return s;
        }

        private static bool IsColor(object? v) => v is string s && (s == "primary" || s == "secondary" || s == "core" || s == "crit" || HexColor.IsMatch(s));

        private static string Color(Dictionary<string, object?> o, string key, string at, string fallback)
        {
            if (!o.TryGetValue(key, out object? v)) return fallback;
            return IsColor(v) ? (string)v! : throw Fail(at, $"{key} is not a colour");
        }

        private static IReadOnlyList<string> Colors(Dictionary<string, object?> o, string key, string at)
        {
            if (!(Req(o, key, at) is List<object?> list) || list.Count < 1 || list.Count > 4) throw Fail(at, $"{key} must hold 1..4 colours");
            var colors = new List<string>(list.Count);
            foreach (var c in list) colors.Add(IsColor(c) ? (string)c! : throw Fail(at, $"{key} holds a bad colour"));
            return colors;
        }

        private static double[] Range(Dictionary<string, object?> o, string key, string at, double min, double max, double[]? fallback)
        {
            if (!o.TryGetValue(key, out object? v))
            {
                if (fallback != null) return fallback;
                throw Fail(at, $"{key} is required");
            }
            if (!(v is List<object?> pair) || pair.Count != 2) throw Fail(at, $"{key} must be [min, max]");
            var tmp = new Dictionary<string, object?> { ["a"] = pair[0], ["b"] = pair[1] };
            double a = Num(tmp, "a", at + "." + key, min, max, null), b = Num(tmp, "b", at + "." + key, min, max, null);
            if (a > b) throw Fail(at, $"{key} range must be [min, max]");
            return new[] { a, b };
        }

        private static VfxFormatException Fail(string at, string message) => new VfxFormatException($"{at}: {message}");
    }
}
