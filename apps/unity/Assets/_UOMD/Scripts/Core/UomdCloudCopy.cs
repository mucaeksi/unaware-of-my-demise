#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Uomd.Core
{
    /// <summary>A provider cloud blob is continuity data, never authority for account rewards or battle gates.</summary>
    public sealed class UomdCloudCopy
    {
        public long Version;
        public string UpdatedAt = "";
        public Dictionary<string, object?> Data = new Dictionary<string, object?>();
        public static UomdCloudCopy Parse(object raw)
        {
            if (!(JsonRead.Get(raw, "version") is long version) || version < 0 || version > 9007199254740991L || !(JsonRead.Get(raw, "data") is Dictionary<string, object?> data)) throw new InvalidDataException("Invalid cloud copy.");
            string updated = JsonRead.Str(raw, "updatedAt");
            if (version > 0 && !DateTimeOffset.TryParse(updated, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out _)) throw new InvalidDataException("Invalid cloud timestamp.");
            var copy = new UomdCloudCopy { Version = version, UpdatedAt = updated, Data = UomdJson.ParseObject(CanonicalJson.Serialize(data)) };
            copy.Progress(); return copy;
        }
        public Dictionary<string, int> Progress()
        {
            var result = new Dictionary<string, int>(StringComparer.Ordinal);
            if (!Data.TryGetValue("progress", out var value)) return result;
            if (!(value is Dictionary<string, object?> progress)) throw new InvalidDataException("Invalid cloud progress.");
            foreach (var node in progress)
            {
                if (!UomdBattleWire.Id(node.Key, 80)) throw new InvalidDataException("Invalid saved stage.");
                result[node.Key] = UomdBattleWire.RequiredInt(node.Value!, "stars", 0, 3);
            }
            return result;
        }
        public Dictionary<string, object?> Upload(Dictionary<string, int> local)
        {
            if (Version >= 9007199254740991L) throw new InvalidDataException("Cloud version limit reached.");
            var data = UomdJson.ParseObject(CanonicalJson.Serialize(Data));
            var progress = data.TryGetValue("progress", out var value) ? (Dictionary<string, object?>)value! : new Dictionary<string, object?>();
            var old = Progress();
            foreach (var node in local)
            {
                if (!UomdBattleWire.Id(node.Key, 80) || node.Value < 0 || node.Value > 3) throw new InvalidDataException("Invalid local stage.");
                var entry = progress.ContainsKey(node.Key) ? JsonRead.Obj(progress, node.Key) : new Dictionary<string, object?>();
                entry["stars"] = (long)Math.Max(old.TryGetValue(node.Key, out int stars) ? stars : 0, node.Value); progress[node.Key] = entry;
            }
            data["progress"] = progress;
            if (Encoding.UTF8.GetByteCount(CanonicalJson.Serialize(data)) > 65536) throw new InvalidDataException("Cloud copy is too large.");
            return new Dictionary<string, object?> { ["expectedVersion"] = Version, ["data"] = data };
        }
        public static void VerifyExport(object data, string player)
        {
            if (JsonRead.Str(JsonRead.Get(data, "profile"), "id") != player || !DateTimeOffset.TryParse(JsonRead.Str(data, "exportedAt"), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out _)) throw new InvalidDataException("Export belongs to another account.");
        }
        public static async Task<string> StoreExportAsync(string directory, string account, string json, Action check, CancellationToken token = default)
        {
            check(); token.ThrowIfCancellationRequested();
            string name = "unaware-of-my-demise-data-" + UomdSavedAction.ScopeFor(account).Substring(0, 16) + ".json", target = Path.Combine(directory, name), temporary = target + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try { await File.WriteAllTextAsync(temporary, json, token); check(); token.ThrowIfCancellationRequested(); if (File.Exists(target)) File.Replace(temporary, target, null); else File.Move(temporary, target); }
            finally { if (File.Exists(temporary)) File.Delete(temporary); }
            return name;
        }
        public static string PrivacyUrl(string baseUrl, bool deletion = false)
        {
            if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) || uri.Scheme != "https" && !(uri.Scheme == "http" && uri.IsLoopback) || uri.UserInfo.Length > 0) throw new InvalidDataException("Privacy page is unavailable.");
            return new Uri(uri, deletion ? "/account/delete-request" : "/privacy").AbsoluteUri;
        }
    }
}
