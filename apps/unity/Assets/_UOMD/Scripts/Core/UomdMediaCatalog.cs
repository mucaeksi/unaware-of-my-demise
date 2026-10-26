#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;

namespace Uomd.Core
{
    public readonly struct MusicTrack
    {
        public MusicTrack(string file, double loopStartSeconds, double durationSeconds)
        {
            File = file;
            LoopStartSeconds = loopStartSeconds;
            DurationSeconds = durationSeconds;
        }

        public string File { get; }
        public double LoopStartSeconds { get; }
        public double DurationSeconds { get; }
    }

    public readonly struct SoundCue
    {
        public SoundCue(string file, double durationSeconds, float volume, bool loop)
        {
            File = file;
            DurationSeconds = durationSeconds;
            Volume = volume;
            Loop = loop;
        }

        public string File { get; }
        public double DurationSeconds { get; }
        public float Volume { get; }
        public bool Loop { get; }
    }

    /// <summary>One state of a chibi unit: its key frame, frame loop and pivot (art_manifest "units".states).</summary>
    public sealed class UnitArtState
    {
        public string Frame = "";
        public double Scale = 1;
        /// <summary>Foot line from the top of the frame (0..1).</summary>
        public double FootY = 1;
        public double PivotX = 0.5;
        public string[] Frames = Array.Empty<string>();
        public double Fps = 6;
        public bool Loop;
    }

    /// <summary>Chibi battle art for one unit: atlas image, frame rects (top-left [x, y, w, h]) and states.</summary>
    public sealed class UnitArt
    {
        public string AtlasPath = "";
        public int AtlasWidth;
        public int AtlasHeight;
        /// <summary>"left" | "right": the way the art faces.</summary>
        public string Facing = "right";
        public double HeightPx = 220;
        public readonly Dictionary<string, (int X, int Y, int W, int H)> Frames = new Dictionary<string, (int, int, int, int)>(StringComparer.Ordinal);
        public readonly Dictionary<string, UnitArtState> States = new Dictionary<string, UnitArtState>(StringComparer.Ordinal);

        /// <summary>The state, falling back to idle (every unit has one) when the requested state is missing.</summary>
        public UnitArtState State(string name) =>
            States.TryGetValue(name ?? "", out var state) ? state : States.TryGetValue("idle", out var idle) ? idle : new UnitArtState();
    }

    /// <summary>
    /// Media lookups for the base release and active patches: art/art_manifest.json (music, ui, stills, backgrounds,
    /// portraits, atlases) and presentation/presentation.json (voices, sounds). Engine-free so the headless harness can
    /// test it against content/base. Paths are content-relative, as PatchManager.ResolveContentPath expects.
    /// </summary>
    public sealed class UomdMediaCatalog
    {
        private readonly Dictionary<string, MusicTrack> _music = new Dictionary<string, MusicTrack>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _ui = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _stills = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _backgrounds = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _atlases = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, Dictionary<string, string>> _portraitImages = new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal);
        private readonly Dictionary<string, Dictionary<string, string>> _portraitEmotions = new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal);
        private readonly Dictionary<string, SoundCue> _voices = new Dictionary<string, SoundCue>(StringComparer.Ordinal);
        private readonly Dictionary<string, SoundCue> _sounds = new Dictionary<string, SoundCue>(StringComparer.Ordinal);
        private readonly Dictionary<string, UnitArt> _units = new Dictionary<string, UnitArt>(StringComparer.Ordinal);

        public static UomdMediaCatalog Empty => new UomdMediaCatalog();

        /// <summary>Builds the catalog. Either JSON may be null or empty (missing file); unknown keys are ignored.</summary>
        public static UomdMediaCatalog Parse(string? artManifestJson, string? presentationJson)
        {
            var catalog = new UomdMediaCatalog();
            if (!string.IsNullOrWhiteSpace(artManifestJson))
            {
                var art = UomdJson.ParseObject(artManifestJson!);
                catalog.ReadArt(art);
                catalog.ReadUnits(art);
            }
            if (!string.IsNullOrWhiteSpace(presentationJson)) catalog.ReadPresentation(UomdJson.ParseObject(presentationJson!));
            return catalog;
        }

        public bool TryGetMusic(string id, out MusicTrack track) => _music.TryGetValue(id ?? "", out track);
        public bool TryGetVoice(string lineId, out SoundCue cue) => _voices.TryGetValue(lineId ?? "", out cue);
        public bool TryGetSound(string id, out SoundCue cue) => _sounds.TryGetValue(id ?? "", out cue);
        public string? Ui(string key) => _ui.TryGetValue(key ?? "", out string path) ? path : null;
        public string? Still(string key) => _stills.TryGetValue(key ?? "", out string path) ? path : null;
        public string? Background(string key) => _backgrounds.TryGetValue(key ?? "", out string path) ? path : null;
        public string? Atlas(string key) => _atlases.TryGetValue(key ?? "", out string path) ? path : null;
        public bool TryGetUnitArt(string unitId, out UnitArt art) => _units.TryGetValue(unitId ?? "", out art!);
        public IEnumerable<string> UnitIds => _units.Keys;

        /// <summary>
        /// Portrait for a speaker and emotion tag. Emotion tags resolve through the manifest's alias map ("calm" →
        /// "composed"); an unknown emotion falls back to "composed", then to any image of that speaker.
        /// </summary>
        public string? Portrait(string speaker, string? emotion)
        {
            if (!_portraitImages.TryGetValue(speaker ?? "", out var images) || images.Count == 0) return null;
            string key = emotion ?? "";
            if (_portraitEmotions.TryGetValue(speaker!, out var aliases) && aliases.TryGetValue(key, out string alias)) key = alias;
            if (images.TryGetValue(key, out string path)) return path;
            if (images.TryGetValue("composed", out path)) return path;
            foreach (var any in images.Values) return any;
            return null;
        }

        /// <summary>An explicit image variant; unlike an emotion lookup, missing images never fall back.</summary>
        public string? PortraitImage(string speaker, string imageKey) =>
            _portraitImages.TryGetValue(speaker ?? "", out var images) && images.TryGetValue(imageKey ?? "", out var path) ? path : null;

        /// <summary>The rebuilt portrait set follows canonical emotion aliases without substituting historical artwork.</summary>
        public string? SolPortrait(string speaker, string? emotion)
        {
            string character = speaker ?? "";
            string key = string.IsNullOrEmpty(emotion) ? "composed" : emotion!;
            if (_portraitEmotions.TryGetValue(character, out var aliases) && aliases.TryGetValue(key, out string alias)) key = alias;
            return PortraitImage(character, "sol_" + key);
        }

        public IEnumerable<string> MusicIds => _music.Keys;
        public IEnumerable<string> VoiceIds => _voices.Keys;

        private void ReadArt(Dictionary<string, object?> root)
        {
            foreach (var (id, value) in Entries(root, "music"))
            {
                if (value is Dictionary<string, object?> m && m.TryGetValue("file", out object? file) && file is string f)
                {
                    _music[id] = new MusicTrack(f, Num(m, "loop_start_s"), Num(m, "duration_s"));
                }
            }
            CopyStrings(root, "ui", _ui);
            CopyStrings(root, "stills", _stills);
            CopyStrings(root, "backgrounds", _backgrounds);
            foreach (var (id, value) in Entries(root, "atlases"))
            {
                if (value is string path) _atlases[id] = path;
                else if (value is Dictionary<string, object?> a && a.TryGetValue("image", out object? image) && image is string f) _atlases[id] = f;
            }
            foreach (var (speaker, value) in Entries(root, "portraits"))
            {
                if (!(value is Dictionary<string, object?> p)) continue;
                var images = new Dictionary<string, string>(StringComparer.Ordinal);
                var emotions = new Dictionary<string, string>(StringComparer.Ordinal);
                if (p.TryGetValue("images", out object? imgs) && imgs is Dictionary<string, object?> im)
                {
                    foreach (var kv in im) if (kv.Value is string path) images[kv.Key] = path;
                }
                if (p.TryGetValue("emotions", out object? emo) && emo is Dictionary<string, object?> em)
                {
                    foreach (var kv in em) if (kv.Value is string target) emotions[kv.Key] = target;
                }
                _portraitImages[speaker] = images;
                _portraitEmotions[speaker] = emotions;
            }
        }

        private void ReadUnits(Dictionary<string, object?> root)
        {
            var atlasNodes = new Dictionary<string, Dictionary<string, object?>>(StringComparer.Ordinal);
            foreach (var (id, value) in Entries(root, "atlases")) if (value is Dictionary<string, object?> a) atlasNodes[id] = a;
            foreach (var (unitId, value) in Entries(root, "units"))
            {
                if (!(value is Dictionary<string, object?> u) || !(u.TryGetValue("atlas", out object? atlasKey) && atlasKey is string key)) continue;
                if (!atlasNodes.TryGetValue(key, out var atlas) || !(atlas.TryGetValue("image", out object? image) && image is string imagePath)) continue;
                var art = new UnitArt
                {
                    AtlasPath = imagePath,
                    AtlasWidth = (int)Num(atlas, "width"),
                    AtlasHeight = (int)Num(atlas, "height"),
                    Facing = u.TryGetValue("facing", out object? facing) && facing is string f ? f : "right",
                    HeightPx = u.ContainsKey("height_px") ? Num(u, "height_px") : 220
                };
                if (atlas.TryGetValue("frames", out object? frames) && frames is Dictionary<string, object?> fr)
                {
                    foreach (var kv in fr)
                    {
                        if (kv.Value is List<object?> r && r.Count == 4)
                        {
                            int At(int i) => Convert.ToInt32(r[i], CultureInfo.InvariantCulture);
                            art.Frames[kv.Key] = (At(0), At(1), At(2), At(3));
                        }
                    }
                }
                if (u.TryGetValue("states", out object? states) && states is Dictionary<string, object?> st)
                {
                    foreach (var kv in st)
                    {
                        if (!(kv.Value is Dictionary<string, object?> sn)) continue;
                        var state = new UnitArtState
                        {
                            Frame = sn.TryGetValue("frame", out object? fname) && fname is string fn ? fn : kv.Key,
                            Scale = sn.ContainsKey("scale") ? Num(sn, "scale") : 1,
                            FootY = sn.ContainsKey("foot_y") ? Num(sn, "foot_y") : 1,
                            PivotX = sn.ContainsKey("pivot_x") ? Num(sn, "pivot_x") : 0.5
                        };
                        if (sn.TryGetValue("animation", out object? anim) && anim is Dictionary<string, object?> an)
                        {
                            if (an.TryGetValue("frames", out object? list) && list is List<object?> names)
                            {
                                var ids = new List<string>();
                                foreach (var n in names) if (n is string name) ids.Add(name);
                                state.Frames = ids.ToArray();
                            }
                            state.Fps = an.ContainsKey("fps") ? Num(an, "fps") : 6;
                            state.Loop = an.TryGetValue("loop", out object? loop) && loop is bool b && b;
                        }
                        if (state.Frames.Length == 0) state.Frames = new[] { state.Frame };
                        art.States[kv.Key] = state;
                    }
                }
                _units[unitId] = art;
            }
        }

        private void ReadPresentation(Dictionary<string, object?> root)
        {
            foreach (var (id, value) in Entries(root, "voices"))
            {
                if (value is Dictionary<string, object?> v && v.TryGetValue("file", out object? file) && file is string f)
                {
                    _voices[id] = new SoundCue(f, Num(v, "duration_s"), 1f, false);
                }
            }
            foreach (var (id, value) in Entries(root, "sounds"))
            {
                if (value is Dictionary<string, object?> s && s.TryGetValue("file", out object? file) && file is string f)
                {
                    double volume = s.ContainsKey("volume") ? Num(s, "volume") : 1.0;
                    bool loop = s.TryGetValue("loop", out object? l) && l is bool b && b;
                    _sounds[id] = new SoundCue(f, Num(s, "duration_s"), (float)volume, loop);
                }
            }
        }

        private static IEnumerable<(string, object?)> Entries(Dictionary<string, object?> root, string section)
        {
            if (!root.TryGetValue(section, out object? node) || !(node is Dictionary<string, object?> dict)) yield break;
            foreach (var kv in dict) yield return (kv.Key, kv.Value);
        }

        private static void CopyStrings(Dictionary<string, object?> root, string section, Dictionary<string, string> into)
        {
            foreach (var (id, value) in Entries(root, section)) if (value is string path) into[id] = path;
        }

        private static double Num(Dictionary<string, object?> node, string key) =>
            node.TryGetValue(key, out object? value) && value != null ? Convert.ToDouble(value, CultureInfo.InvariantCulture) : 0.0;
    }
}
