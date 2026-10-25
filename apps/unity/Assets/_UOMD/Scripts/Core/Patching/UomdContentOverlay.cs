#nullable enable
using System;
using System.Collections.Generic;
using System.Text;

namespace Uomd.Core.Patching
{
    /// <summary>Which layer serves a content path, and the SHA-256 of the bytes it serves.</summary>
    public readonly struct OverlayEntry
    {
        public OverlayEntry(bool fromPatch, string sha256)
        {
            FromPatch = fromPatch;
            Sha256 = sha256;
        }

        public bool FromPatch { get; }
        public string Sha256 { get; }
    }

    /// <summary>
    /// Path resolution over the active release (port of the overlay rules in apps/game/src/content/ContentService.ts):
    /// a self-contained snapshot serves only what it declares; a legacy dependent overlay inherits the embedded base; a
    /// snapshot composed on an older embedded base (stale-base.ts) yields to the base for every path the base declares.
    /// </summary>
    public static class UomdContentOverlay
    {
        /// <summary>
        /// True when a self-contained snapshot omits paths the current base declares, i.e. it was composed on an older base.
        /// shortcut: a base update that only rewrites existing paths is invisible here (same limit as stale-base.ts).
        /// </summary>
        public static bool BuiltOnOlderBase(ContentManifest manifest, IReadOnlyDictionary<string, string> baseFiles)
        {
            if (manifest.DependsOn != null) return false;
            var declared = new HashSet<string>(StringComparer.Ordinal);
            foreach (var f in manifest.Files) declared.Add(f.Path);
            foreach (string path in baseFiles.Keys) if (!declared.Contains(path)) return true;
            return false;
        }

        /// <summary>The serving layer for a path, or null when no layer serves it.</summary>
        public static OverlayEntry? Resolve(PatchState state, IReadOnlyDictionary<string, string> baseFiles, string path)
        {
            var active = state.Active?.Manifest;
            if (active != null && !(baseFiles.ContainsKey(path) && BuiltOnOlderBase(active, baseFiles)))
            {
                var f = active.FindFile(path);
                if (f != null) return new OverlayEntry(!(baseFiles.TryGetValue(path, out string? same) && same == f.Sha256), f.Sha256);
                if (active.DependsOn == null) return null;
            }
            return baseFiles.TryGetValue(path, out string? h) ? new OverlayEntry(false, h) : (OverlayEntry?)null;
        }

        /// <summary>
        /// Device-side checks before a release may activate (Unity's PatchEnv.Validate): every JSON file is strict UTF-8 JSON
        /// and the effective set keeps the indexes the client reads first. The publisher runs the full content-schema
        /// validateContentSet before signing; porting it to C# is tracked as U-2b.
        /// </summary>
        public static void ValidateRelease(IReadOnlyDictionary<string, byte[]> files, ContentManifest manifest, IBaseContent baseContent)
        {
            var strict = new UTF8Encoding(false, true);
            foreach (var kv in files)
            {
                if (!kv.Key.EndsWith(".json", StringComparison.Ordinal)) continue;
                try { UomdJson.Parse(strict.GetString(kv.Value)); }
                catch (Exception e) when (e is FormatException || e is DecoderFallbackException || e is ArgumentException)
                {
                    throw new FormatException($"{kv.Key} is not valid JSON: {e.Message}");
                }
            }
            foreach (string required in RequiredIndexes)
            {
                bool present = files.ContainsKey(required) || (manifest.DependsOn != null && baseContent.Files.ContainsKey(required));
                if (!present) throw new FormatException($"release has no {required}");
            }
        }

        public static readonly string[] RequiredIndexes = { "chapters/chapter_index.json", "units/unit_pack.json", "art/art_manifest.json" };
    }
}
