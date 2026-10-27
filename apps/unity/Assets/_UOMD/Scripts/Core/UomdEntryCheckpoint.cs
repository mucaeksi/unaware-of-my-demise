#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace Uomd.Core
{
    /// <summary>Local narrative continuity only. Never grants balances, rewards or campaign completion.</summary>
    public sealed class UomdEntryCheckpoint
    {
        public const int Version = 1;
        public string Scope = "", Release = "", Phase = "prologue", ContentHash = "", StoryPath = "", SceneId = "";
        public bool PrologueDone, Completed, CloudPrologue, CloudCompleted, AutoRead;
        public int Tutorials, Stage, Shot, StoryIndex, CloudTutorials;
        public long Sequence;
        public string RequestId = "";
        public string[] Choices = Array.Empty<string>();
        public Dictionary<string, bool> Flags = new Dictionary<string, bool>(StringComparer.Ordinal);
        public bool CloudConfirmed => (!PrologueDone || CloudPrologue) && CloudTutorials >= Tutorials && (!Completed || CloudCompleted);
        public void ClearCursor()
        {
            ContentHash = StoryPath = SceneId = ""; StoryIndex = 0; Choices = Array.Empty<string>(); Flags.Clear();
        }
        public string Encode()
        {
            var flags = Flags.ToDictionary(p => p.Key, p => (object?)p.Value, StringComparer.Ordinal);
            return CanonicalJson.Serialize(new Dictionary<string, object?>
            {
                ["version"] = Version, ["scope"] = Scope, ["release"] = Release, ["phase"] = Phase,
                ["contentHash"] = ContentHash, ["storyPath"] = StoryPath, ["sceneId"] = SceneId,
                ["prologue"] = PrologueDone, ["tutorials"] = Tutorials, ["completed"] = Completed, ["autoRead"] = AutoRead,
                ["stage"] = Stage, ["shot"] = Shot, ["storyIndex"] = StoryIndex, ["choices"] = Choices, ["flags"] = flags,
                ["sequence"] = Sequence, ["requestId"] = RequestId,
                ["cloudPrologue"] = CloudPrologue, ["cloudTutorials"] = CloudTutorials, ["cloudCompleted"] = CloudCompleted
            });
        }
        public static UomdEntryCheckpoint Decode(string json, string expectedScope)
        {
            var d = UomdJson.ParseObject(json);
            if (JsonRead.Int(d, "version") != Version) throw new NotSupportedException("Unsupported entry checkpoint version.");
            var c = new UomdEntryCheckpoint
            {
                Scope = JsonRead.Str(d, "scope"), Release = JsonRead.Str(d, "release"), Phase = JsonRead.Str(d, "phase"),
                ContentHash = JsonRead.Str(d, "contentHash"), StoryPath = JsonRead.Str(d, "storyPath"), SceneId = JsonRead.Str(d, "sceneId"),
                PrologueDone = JsonRead.Bool(d, "prologue"), Tutorials = (int)JsonRead.Int(d, "tutorials", -1), Completed = JsonRead.Bool(d, "completed"), AutoRead = JsonRead.Bool(d, "autoRead"),
                Stage = (int)JsonRead.Int(d, "stage"), Shot = (int)JsonRead.Int(d, "shot"), StoryIndex = (int)JsonRead.Int(d, "storyIndex"),
                Choices = JsonRead.Strings(d, "choices").ToArray(), Sequence = JsonRead.Int(d, "sequence"), RequestId = JsonRead.Str(d, "requestId"),
                CloudPrologue = JsonRead.Bool(d, "cloudPrologue"), CloudTutorials = (int)JsonRead.Int(d, "cloudTutorials"), CloudCompleted = JsonRead.Bool(d, "cloudCompleted")
            };
            foreach (var pair in JsonRead.Obj(d, "flags")) { if (!(pair.Value is bool value)) throw new InvalidDataException("Invalid story flag."); c.Flags[pair.Key] = value; }
            if (c.Scope != expectedScope || !IsHash(c.Scope) || c.Release.Length > 128 || c.SceneId.Length > 128 ||
                c.Tutorials < 0 || c.Tutorials > 3 || c.CloudTutorials < 0 || c.CloudTutorials > 3 || c.Stage < 0 || c.Stage > 3 ||
                c.Shot < 0 || c.Shot > 63 || c.StoryIndex < 0 || c.StoryIndex > 4096 || c.Sequence < 0 ||
                (c.Completed && (!c.PrologueDone || c.Tutorials != 3)) || (c.Tutorials > 0 && !c.PrologueDone) ||
                !new[] { "prologue", "pre_story", "battle", "post_story", "finish", "complete" }.Contains(c.Phase) ||
                (c.ContentHash.Length > 0 && !IsHash(c.ContentHash)) || c.Choices.Length > 128 || c.Flags.Count > 128 ||
                c.Choices.Any(s => s.Length > 128) || c.Flags.Keys.Any(s => s.Length > 128) ||
                (c.StoryPath.Length > 0 && !System.Text.RegularExpressions.Regex.IsMatch(c.StoryPath, @"^story/tutorial_t[123]_(before|after)\.json$")) ||
                (c.RequestId.Length > 0 && !System.Text.RegularExpressions.Regex.IsMatch(c.RequestId, @"^[a-f0-9]{32}$")))
                throw new InvalidDataException("Invalid entry checkpoint.");
            return c;
        }
        public static bool IsHash(string value) => value.Length == 64 && value.All(c => c >= '0' && c <= '9' || c >= 'a' && c <= 'f');
        public static string ScopeFor(string accountKey) => Sha256Hash.ComputeHex(Encoding.UTF8.GetBytes("uomd-entry-v1:" + accountKey));
    }

    /// <summary>Bounded atomic files, checksum and previous-copy recovery; memory-only during isolated Editor review.</summary>
    public sealed class UomdEntryCheckpointStore
    {
        private const int MaxBytes = 64 * 1024;
        private readonly string _root;
        private readonly bool _memoryOnly;
        private readonly Dictionary<string, string> _memory = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly HashSet<string> _preserveBackup = new HashSet<string>(StringComparer.Ordinal);
        public string ReadIssue { get; private set; } = "";
        public UomdEntryCheckpointStore(string root, bool memoryOnly = false) { _root = root; _memoryOnly = memoryOnly; }
        public UomdEntryCheckpoint Load(string scope)
        {
            string path = FileFor(scope); ReadIssue = "";
            if (_memoryOnly) return _memory.TryGetValue(scope, out var json) ? Unwrap(json, scope) : new UomdEntryCheckpoint { Scope = scope };
            foreach (string candidate in new[] { path, path + ".bak" })
            {
                if (!File.Exists(candidate)) continue;
                try
                {
                    if (new FileInfo(candidate).Length > MaxBytes) throw new InvalidDataException("Oversized entry checkpoint.");
                    var result = Unwrap(File.ReadAllText(candidate), scope);
                    if (candidate != path) { ReadIssue = "Recovered the previous local checkpoint."; _preserveBackup.Add(scope); }
                    return result;
                }
                catch (NotSupportedException) { throw; } // Never replace a newer save with an older format/backup.
                catch (Exception e) when (e is IOException || e is InvalidDataException || e is ArgumentException || e is FormatException || e is System.Security.Cryptography.CryptographicException)
                { ReadIssue = "Local checkpoint could not be read. Using the last confirmed entry step."; }
            }
            return new UomdEntryCheckpoint { Scope = scope };
        }
        public void Save(UomdEntryCheckpoint checkpoint)
        {
            string path = FileFor(checkpoint.Scope), payload = checkpoint.Encode();
            UomdEntryCheckpoint.Decode(payload, checkpoint.Scope);
            string json = CanonicalJson.Serialize(new Dictionary<string, object?> { ["payload"] = payload, ["sha256"] = Sha256Hash.ComputeHex(Encoding.UTF8.GetBytes(payload)) });
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            if (bytes.Length > MaxBytes) throw new InvalidDataException("Oversized entry checkpoint.");
            if (_memoryOnly) { _memory[checkpoint.Scope] = json; return; }
            Directory.CreateDirectory(_root);
            string temp = path + ".tmp";
            try
            {
                using (var stream = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None)) { stream.Write(bytes, 0, bytes.Length); stream.Flush(true); }
                if (File.Exists(path)) File.Replace(temp, path, _preserveBackup.Contains(checkpoint.Scope) ? null : path + ".bak"); else File.Move(temp, path);
                _preserveBackup.Remove(checkpoint.Scope);
            }
            finally { if (File.Exists(temp)) File.Delete(temp); }
        }
        private string FileFor(string scope)
        {
            if (!UomdEntryCheckpoint.IsHash(scope)) throw new ArgumentException("Invalid checkpoint scope.");
            return Path.Combine(_root, scope + ".json");
        }
        private static UomdEntryCheckpoint Unwrap(string json, string scope)
        {
            var envelope = UomdJson.ParseObject(json); string payload = JsonRead.Str(envelope, "payload");
            if (Sha256Hash.ComputeHex(Encoding.UTF8.GetBytes(payload)) != JsonRead.Str(envelope, "sha256")) throw new InvalidDataException("Entry checksum mismatch.");
            return UomdEntryCheckpoint.Decode(payload, scope);
        }
    }
}
