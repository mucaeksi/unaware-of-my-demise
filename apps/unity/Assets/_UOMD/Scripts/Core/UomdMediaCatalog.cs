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

        public static UomdMediaCatalog Empty => new UomdMediaCatalog();

        /// <summary>Builds the catalog. Either JSON may be null or empty (missing file); unknown keys are ignored.</summary>
        public static UomdMediaCatalog Parse(string? artManifestJson, string? presentationJson)
        {
            var catalog = new UomdMediaCatalog();
            if (!string.IsNullOrWhiteSpace(artManifestJson)) catalog.ReadArt(UomdJson.ParseObject(artManifestJson!));
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
