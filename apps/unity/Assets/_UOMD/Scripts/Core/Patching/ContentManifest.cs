#nullable enable
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace Uomd.Core.Patching
{
    public sealed class ManifestFile
    {
        internal ManifestFile(string path, string sha256, long bytes, string mediaType, string kind)
        {
            Path = path;
            Sha256 = sha256;
            Bytes = bytes;
            MediaType = mediaType;
            Kind = kind;
        }

        public string Path { get; }
        public string Sha256 { get; }
        public long Bytes { get; }
        public string MediaType { get; }
        public string Kind { get; }
        public bool IsJson => Path.EndsWith(".json", StringComparison.Ordinal);
    }

    public sealed class ReleaseRef
    {
        internal ReleaseRef(string releaseId, long generation)
        {
            ReleaseId = releaseId;
            Generation = generation;
        }

        public string ReleaseId { get; }
        public long Generation { get; }
    }

    /// <summary>Thrown by ContentManifest.Parse; the client reports it as malformed_manifest.</summary>
    public sealed class ManifestFormatException : Exception
    {
        public ManifestFormatException(string message) : base(message) { }
    }

    /// <summary>
    /// A strictly validated content release manifest (C# port of packages/content-schema/src/manifest.ts ContentManifest,
    /// including SafeAssetPath and the release resource budgets). Raw keeps the exact parsed object graph: the signature
    /// is verified over it and it is what the patch state persists.
    /// </summary>
    public sealed class ContentManifest
    {
        public const int CurrentContentSchema = 1;
        public const long MaxReleaseBytes = 200L * 1024 * 1024;
        public const int MaxReleaseFiles = 1536;
        public const long MaxJsonFileBytes = 1024 * 1024;
        public const long MaxJsonTotalBytes = 8L * 1024 * 1024;
        public const long MaxFileBytes = 25L * 1024 * 1024;

        private const RegexOptions Strict = RegexOptions.CultureInvariant;
        private static readonly Regex IdPattern = new Regex(@"^[a-z][a-z0-9_]{1,79}\z", Strict);
        private static readonly Regex ShaPattern = new Regex(@"^[0-9a-f]{64}\z", Strict);
        private static readonly Regex SemverPattern = new Regex(@"^[0-9]{1,6}\.[0-9]{1,6}\.[0-9]{1,6}\z", Strict);
        private static readonly Regex CapabilityPattern = new Regex(@"^[a-z][a-z0-9_]{1,63}\z", Strict);
        private static readonly Regex PathPattern = new Regex(@"^[A-Za-z0-9_\-./]+\z", Strict);
        // zod 4 z.iso.datetime(): UTC "Z" only, seconds and fraction optional
        private static readonly Regex DateTimePattern = new Regex(@"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?Z\z", Strict);

        private static readonly Dictionary<string, string> MediaTypeByExtension = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["json"] = "application/json",
            ["webp"] = "image/webp",
            ["png"] = "image/png",
            ["ogg"] = "audio/ogg",
            ["mp3"] = "audio/mpeg",
            ["m4a"] = "audio/mp4",
            ["webm"] = "video/webm",
            ["txt"] = "text/plain"
        };

        private static readonly HashSet<string> FileKinds = new HashSet<string>(StringComparer.Ordinal)
        {
            "story_scene", "encounter", "unit_pack", "chapter_index", "art_manifest", "atlas_image", "portrait", "background", "audio", "other_data"
        };

        private static readonly HashSet<string> Channels = new HashSet<string>(StringComparer.Ordinal) { "dev", "staging", "production" };

        private ContentManifest(IReadOnlyDictionary<string, object?> raw) => Raw = raw;

        public IReadOnlyDictionary<string, object?> Raw { get; }
        public string ReleaseId { get; private set; } = "";
        public long Generation { get; private set; }
        public string Channel { get; private set; } = "";
        public string CreatedAt { get; private set; } = "";
        public string Notes { get; private set; } = "";
        public string MinClient { get; private set; } = "";
        public string? MaxClient { get; private set; }
        public IReadOnlyList<string> RequiredCapabilities { get; private set; } = Array.Empty<string>();
        public long ContentSchema { get; private set; }
        public ReleaseRef? DependsOn { get; private set; }
        public ReleaseRef? RollbackTo { get; private set; }
        public long RolloutPercent { get; private set; }
        public bool KillSwitch { get; private set; }
        public IReadOnlyList<ManifestFile> Files { get; private set; } = Array.Empty<ManifestFile>();
        public string? SignatureKid { get; private set; }
        public string? SignatureAlg { get; private set; }
        public string? SignatureValue { get; private set; }

        public ManifestFile? FindFile(string path)
        {
            foreach (var f in Files) if (string.Equals(f.Path, path, StringComparison.Ordinal)) return f;
            return null;
        }

        /// <summary>Validates a parsed JSON object graph; throws ManifestFormatException with the first problem found.</summary>
        public static ContentManifest Parse(object? raw)
        {
            var root = Obj(raw, "manifest", "schema_version", "release", "compat", "depends_on", "rollback_to", "rollout", "files", "signature");
            var m = new ContentManifest(new Dictionary<string, object?>(root, StringComparer.Ordinal));
            if (Int(root, "schema_version", 1) != CurrentContentSchema) throw Fail("schema_version", "must be 1");

            var release = Obj(Req(root, "release"), "release", "id", "generation", "channel", "created_at", "notes");
            m.ReleaseId = Pattern(release, "id", IdPattern, "release.id");
            m.Generation = Int(release, "generation", 1);
            m.Channel = Str(release, "channel", 1, 64);
            if (!Channels.Contains(m.Channel)) throw Fail("release.channel", "unknown channel");
            m.CreatedAt = Pattern(release, "created_at", DateTimePattern, "release.created_at");
            if (!DateTimeOffset.TryParse(m.CreatedAt, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal, out _))
                throw Fail("release.created_at", "invalid date");
            m.Notes = Str(release, "notes", 0, 400);

            var compat = Obj(Req(root, "compat"), "compat", "min_client", "required_capabilities", "max_client", "content_schema");
            m.MinClient = Pattern(compat, "min_client", SemverPattern, "compat.min_client");
            if (compat.ContainsKey("max_client")) m.MaxClient = Pattern(compat, "max_client", SemverPattern, "compat.max_client");
            m.ContentSchema = Int(compat, "content_schema", 1);
            if (compat.ContainsKey("required_capabilities"))
            {
                if (!(compat["required_capabilities"] is List<object?> caps) || caps.Count > 32) throw Fail("compat.required_capabilities", "expected at most 32 capabilities");
                var list = new List<string>();
                foreach (var c in caps)
                {
                    if (!(c is string s) || !CapabilityPattern.IsMatch(s)) throw Fail("compat.required_capabilities", "invalid capability");
                    if (list.Contains(s)) throw Fail("compat", "duplicate required capability");
                    list.Add(s);
                }
                m.RequiredCapabilities = list;
            }
            if (m.MaxClient != null && CompareSemver(m.MinClient, m.MaxClient) > 0) throw Fail("compat", "client compatibility range is empty");

            if (root.ContainsKey("depends_on")) m.DependsOn = Ref(root["depends_on"], "depends_on");
            if (root.ContainsKey("rollback_to")) m.RollbackTo = Ref(root["rollback_to"], "rollback_to");

            var rollout = Obj(Req(root, "rollout"), "rollout", "percent", "kill_switch");
            m.RolloutPercent = Int(rollout, "percent", 0, 100);
            m.KillSwitch = rollout.TryGetValue("kill_switch", out object? kill) && kill is bool b ? b : throw Fail("rollout.kill_switch", "expected boolean");

            m.Files = ParseFiles(Req(root, "files"));

            if (root.ContainsKey("signature"))
            {
                var sig = Obj(root["signature"], "signature", "kid", "alg", "value");
                m.SignatureKid = Str(sig, "kid", 1, 64);
                m.SignatureAlg = Str(sig, "alg", 1, 16);
                if (m.SignatureAlg != "ES256") throw Fail("signature.alg", "must be ES256");
                m.SignatureValue = Str(sig, "value", 40, 200);
            }

            if (m.DependsOn != null && m.DependsOn.ReleaseId == m.ReleaseId) throw Fail("depends_on", "release cannot depend on itself");
            if (m.DependsOn != null && m.DependsOn.Generation >= m.Generation) throw Fail("depends_on", "dependency generation must be lower than this release");
            return m;
        }

        private static List<ManifestFile> ParseFiles(object? value)
        {
            if (!(value is List<object?> items) || items.Count < 1 || items.Count > MaxReleaseFiles) throw Fail("files", $"expected 1..{MaxReleaseFiles} files");
            var files = new List<ManifestFile>(items.Count);
            var paths = new HashSet<string>(StringComparer.Ordinal);
            var sizes = new Dictionary<string, long>(StringComparer.Ordinal);
            long total = 0, jsonTotal = 0;
            for (int i = 0; i < items.Count; i++)
            {
                string at = $"files.{i}";
                var f = Obj(items[i], at, "path", "sha256", "bytes", "media_type", "kind");
                string path = Str(f, "path", 3, 200);
                CheckSafePath(path, at + ".path");
                string sha = Pattern(f, "sha256", ShaPattern, at + ".sha256");
                long bytes = Int(f, "bytes", 1, MaxFileBytes);
                string mediaType = Str(f, "media_type", 1, 64);
                string ext = Extension(path);
                if (!MediaTypeByExtension.TryGetValue(ext, out string? expected) || expected != mediaType) throw Fail(at + ".media_type", $"media_type {mediaType} does not match extension .{ext}");
                string kind = Str(f, "kind", 1, 32);
                if (!FileKinds.Contains(kind)) throw Fail(at + ".kind", "unknown kind");
                if (!paths.Add(path)) throw Fail(at + ".path", $"duplicate path {path}");
                if (sizes.TryGetValue(sha, out long known) && known != bytes) throw Fail("files", "one object hash has conflicting sizes");
                sizes[sha] = bytes;
                total += bytes;
                if (ext == "json")
                {
                    if (bytes > MaxJsonFileBytes) throw Fail("files", "JSON resource budget exceeded");
                    jsonTotal += bytes;
                }
                files.Add(new ManifestFile(path, sha, bytes, mediaType, kind));
            }
            if (total > MaxReleaseBytes) throw Fail("files", "release exceeds the 200 MiB resource budget");
            if (jsonTotal > MaxJsonTotalBytes) throw Fail("files", "JSON resource budget exceeded");
            return files;
        }

        /// <summary>SafeAssetPath: relative forward-slash path of safe segments, no traversal/hidden segment, allowlisted extension.</summary>
        public static bool IsSafePath(string? path)
        {
            if (path == null || path.Length < 3 || path.Length > 200 || !PathPattern.IsMatch(path)) return false;
            if (path.StartsWith("/", StringComparison.Ordinal) || path.EndsWith("/", StringComparison.Ordinal)) return false;
            foreach (string seg in path.Split('/'))
            {
                if (seg.Length == 0 || seg == "." || seg == ".." || seg.StartsWith(".", StringComparison.Ordinal)) return false;
            }
            return MediaTypeByExtension.ContainsKey(Extension(path));
        }

        private static void CheckSafePath(string path, string at)
        {
            if (!IsSafePath(path)) throw Fail(at, "unsafe or disallowed path");
        }

        private static string Extension(string path)
        {
            int slash = path.LastIndexOf('/');
            string name = path.Substring(slash + 1);
            int dot = name.LastIndexOf('.');
            return (dot < 0 ? name : name.Substring(dot + 1)).ToLowerInvariant();
        }

        public static int CompareSemver(string a, string b)
        {
            string[] pa = a.Split('.'), pb = b.Split('.');
            for (int i = 0; i < 3; i++)
            {
                long da = long.Parse(pa[i], System.Globalization.CultureInfo.InvariantCulture), db = long.Parse(pb[i], System.Globalization.CultureInfo.InvariantCulture);
                if (da != db) return da < db ? -1 : 1;
            }
            return 0;
        }

        private static ReleaseRef Ref(object? value, string at)
        {
            var o = Obj(value, at, "release_id", "generation");
            return new ReleaseRef(Pattern(o, "release_id", IdPattern, at + ".release_id"), Int(o, "generation", 1));
        }

        private static Dictionary<string, object?> Obj(object? value, string at, params string[] allowed)
        {
            if (!(value is Dictionary<string, object?> o)) throw Fail(at, "expected object");
            foreach (string key in o.Keys)
            {
                if (Array.IndexOf(allowed, key) < 0) throw Fail(at, $"unrecognized key '{key}'");
            }
            return o;
        }

        private static object? Req(Dictionary<string, object?> o, string key) =>
            o.TryGetValue(key, out object? v) ? v : throw Fail(key, "required");

        private static string Str(Dictionary<string, object?> o, string key, int min, int max)
        {
            if (!o.TryGetValue(key, out object? v) || !(v is string s)) throw Fail(key, "expected string");
            if (s.Length < min || s.Length > max) throw Fail(key, $"length must be {min}..{max}");
            return s;
        }

        private static string Pattern(Dictionary<string, object?> o, string key, Regex pattern, string at)
        {
            if (!o.TryGetValue(key, out object? v) || !(v is string s) || !pattern.IsMatch(s)) throw Fail(at, "invalid format");
            return s;
        }

        /// <summary>A JSON safe integer (zod int): long, or a double holding an integral value.</summary>
        private static long Int(Dictionary<string, object?> o, string key, long min, long max = 9007199254740991L)
        {
            if (!o.TryGetValue(key, out object? v)) throw Fail(key, "required");
            long n;
            switch (v)
            {
                case long l: n = l; break;
                case double d when Math.Floor(d) == d && Math.Abs(d) <= 9007199254740991.0: n = (long)d; break;
                default: throw Fail(key, "expected integer");
            }
            if (n < min || n > max) throw Fail(key, $"must be {min}..{max}");
            return n;
        }

        private static ManifestFormatException Fail(string at, string message) => new ManifestFormatException($"{at}: {message}");
    }
}
