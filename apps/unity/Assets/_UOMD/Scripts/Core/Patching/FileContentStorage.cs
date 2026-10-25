#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;

namespace Uomd.Core.Patching
{
    /// <summary>
    /// Persistent IContentStorage on the device file system (Application.persistentDataPath on Android), engine-free.
    /// Layout under the root:
    ///   objects/&lt;sha256&gt;          verified content objects (content addressed; "partial:" keys become "partial-&lt;sha&gt;")
    ///   state.json                     { state, high_water: { channel: mark }, downloads } — ONE file, replaced atomically
    /// Every write goes to a temporary file first and is renamed into place, so a crash leaves the old or the new version,
    /// never a torn one. One process-wide lock per root serialises transactions (the game is the only writer).
    /// A state file that exists but cannot be read fails closed: every channel reports an invalid generation mark, so no
    /// patch is admitted until the app data is cleared (the embedded base keeps working).
    /// </summary>
    public sealed class FileContentStorage : IContentStorage
    {
        private const string StateFile = "state.json";
        private const string PartialKey = "partial:";
        private const string PartialFile = "partial-";
        private static readonly Dictionary<string, object> Locks = new Dictionary<string, object>(StringComparer.Ordinal);

        private readonly string _root;
        private readonly string _objects;
        private readonly object _gate;

        public FileContentStorage(string root)
        {
            _root = Path.GetFullPath(root);
            _objects = Path.Combine(_root, "objects");
            Directory.CreateDirectory(_objects);
            lock (Locks)
            {
                if (!Locks.TryGetValue(_root, out var gate)) Locks[_root] = gate = new object();
                _gate = gate;
            }
            foreach (string tmp in Directory.GetFiles(_root, "*.tmp")) TryDelete(tmp);
            foreach (string tmp in Directory.GetFiles(_objects, "*.tmp")) TryDelete(tmp);
        }

        /// <summary>The on-disk file for a verified object; null when it is not stored.</summary>
        public string? ObjectPath(string sha256)
        {
            string path = FileFor(sha256);
            return File.Exists(path) ? path : null;
        }

        public Task<byte[]?> GetObjectAsync(string key)
        {
            string path = FileFor(key);
            return Task.Run(() =>
            {
                try { return File.Exists(path) ? File.ReadAllBytes(path) : null; }
                catch (FileNotFoundException) { return (byte[]?)null; }
                catch (DirectoryNotFoundException) { return (byte[]?)null; }
            });
        }

        public Task PutObjectAsync(string key, byte[] bytes, string? reservation = null)
        {
            string path = FileFor(key);
            return Task.Run(() =>
            {
                lock (_gate)
                {
                    if (reservation != null)
                    {
                        string hash = key.StartsWith(PartialKey, StringComparison.Ordinal) ? key.Substring(PartialKey.Length) : key;
                        var record = Load();
                        if (!record.Downloads.TryGetValue(reservation, out var entry) || entry.ExpiresAtMs <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() ||
                            !entry.Files.TryGetValue(hash, out long limit) || bytes.LongLength > limit)
                        {
                            throw new InvalidOperationException("content reservation expired or exceeded");
                        }
                        if (hash == key) TryDelete(FileFor(PartialKey + key));
                    }
                    WriteAtomic(path, bytes);
                }
            });
        }

        public Task<bool> HasObjectAsync(string key) => Task.FromResult(File.Exists(FileFor(key)));

        public Task<IReadOnlyList<string>> ListObjectsAsync()
        {
            lock (_gate) return Task.FromResult<IReadOnlyList<string>>(new List<string>(Inventory().Keys));
        }

        public Task DeleteObjectAsync(string key)
        {
            lock (_gate) TryDelete(FileFor(key));
            return Task.CompletedTask;
        }

        public Task<string?> GetStateAsync()
        {
            lock (_gate) return Task.FromResult(Load().State);
        }

        public Task<GenerationMark?> GetHighWaterAsync(string channel)
        {
            lock (_gate) return Task.FromResult(Load().Mark(channel));
        }

        public Task<bool> UpdateStateAsync(string channel, Func<StorageSnapshot, StorageSnapshot?> change)
        {
            lock (_gate)
            {
                var record = Load();
                var next = change(new StorageSnapshot(record.State, record.Mark(channel), Inventory(), record.Downloads));
                if (next == null) return Task.FromResult(false);
                var downloads = record.Downloads;
                if (next.Downloads != null)
                {
                    downloads = new Dictionary<string, DownloadReservation>(StringComparer.Ordinal);
                    foreach (var kv in next.Downloads) downloads[kv.Key] = kv.Value;
                }
                var marks = new Dictionary<string, object?>(record.Marks, StringComparer.Ordinal);
                if (next.HighWater != null) marks[channel] = MarkJson(next.HighWater);
                if (!record.Corrupt) Save(next.State, marks, downloads);
                else if (next.HighWater != null) throw new PatchRejectException(PatchRejectReason.StorageStateInvalid, "patch storage record is unreadable");
                if (next.RemoveObjects != null) foreach (string key in next.RemoveObjects) TryDelete(FileFor(key));
                return Task.FromResult(true);
            }
        }

        // ------------------------------------------------------------------------------------------- record

        private sealed class Record
        {
            public string? State;
            public Dictionary<string, object?> Marks = new Dictionary<string, object?>(StringComparer.Ordinal);
            public Dictionary<string, DownloadReservation> Downloads = new Dictionary<string, DownloadReservation>(StringComparer.Ordinal);
            public bool Corrupt;

            public GenerationMark? Mark(string channel)
            {
                if (Corrupt) return new GenerationMark(0, "unreadable", false);
                if (!Marks.TryGetValue(channel, out object? raw) || raw == null) return null;
                if (raw is Dictionary<string, object?> m && m.TryGetValue("generation", out object? g) && g is long generation &&
                    m.TryGetValue("releaseId", out object? r) && r is string releaseId && m.TryGetValue("killed", out object? k) && k is bool killed)
                {
                    return new GenerationMark(generation, releaseId, killed);
                }
                return new GenerationMark(0, "damaged", false);
            }
        }

        private Record Load()
        {
            string path = Path.Combine(_root, StateFile);
            var record = new Record();
            if (!File.Exists(path)) return record;
            try
            {
                var root = UomdJson.ParseObject(File.ReadAllText(path, Encoding.UTF8));
                record.State = root.TryGetValue("state", out object? s) ? s as string : null;
                if (root.TryGetValue("high_water", out object? hw) && hw is Dictionary<string, object?> marks) record.Marks = marks;
                if (root.TryGetValue("downloads", out object? dl) && dl is Dictionary<string, object?> downloads)
                {
                    foreach (var kv in downloads)
                    {
                        if (!(kv.Value is Dictionary<string, object?> d) || !(d.TryGetValue("expiresAt", out object? e) && e is long expires) ||
                            !(d.TryGetValue("files", out object? f) && f is Dictionary<string, object?> files)) continue;
                        var limits = new Dictionary<string, long>(StringComparer.Ordinal);
                        foreach (var file in files) if (file.Value is long n) limits[file.Key] = n;
                        record.Downloads[kv.Key] = new DownloadReservation(limits, expires);
                    }
                }
            }
            catch (Exception e) when (e is FormatException || e is IOException)
            {
                record = new Record { Corrupt = true };
            }
            return record;
        }

        private void Save(string? state, Dictionary<string, object?> marks, Dictionary<string, DownloadReservation> downloads)
        {
            var dl = new Dictionary<string, object?>(StringComparer.Ordinal);
            foreach (var kv in downloads)
            {
                var files = new Dictionary<string, object?>(StringComparer.Ordinal);
                foreach (var f in kv.Value.Files) files[f.Key] = f.Value;
                dl[kv.Key] = new Dictionary<string, object?>(StringComparer.Ordinal) { ["files"] = files, ["expiresAt"] = kv.Value.ExpiresAtMs };
            }
            string json = CanonicalJson.Serialize(new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                ["state"] = state,
                ["high_water"] = marks,
                ["downloads"] = dl
            });
            WriteAtomic(Path.Combine(_root, StateFile), Encoding.UTF8.GetBytes(json));
        }

        private static Dictionary<string, object?> MarkJson(GenerationMark mark) => new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["generation"] = mark.Generation,
            ["releaseId"] = mark.ReleaseId,
            ["killed"] = mark.Killed
        };

        private Dictionary<string, long> Inventory()
        {
            var inventory = new Dictionary<string, long>(StringComparer.Ordinal);
            foreach (string file in Directory.GetFiles(_objects))
            {
                string name = Path.GetFileName(file);
                if (name.EndsWith(".tmp", StringComparison.Ordinal)) continue;
                string key = name.StartsWith(PartialFile, StringComparison.Ordinal) ? PartialKey + name.Substring(PartialFile.Length) : name;
                try { inventory[key] = new FileInfo(file).Length; }
                catch (FileNotFoundException) { }
            }
            return inventory;
        }

        private string FileFor(string key)
        {
            bool partial = key.StartsWith(PartialKey, StringComparison.Ordinal);
            string hash = partial ? key.Substring(PartialKey.Length) : key;
            if (hash.Length != 64 || !IsLowerHex(hash)) throw new ArgumentException($"invalid object key '{key}'");
            return Path.Combine(_objects, partial ? PartialFile + hash : hash);
        }

        private static bool IsLowerHex(string s)
        {
            foreach (char c in s) if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
            return true;
        }

        private static void WriteAtomic(string path, byte[] bytes)
        {
            string tmp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                using (var stream = new FileStream(tmp, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    stream.Write(bytes, 0, bytes.Length);
                    stream.Flush(true);
                }
                if (File.Exists(path)) File.Replace(tmp, path, null);
                else File.Move(tmp, path);
            }
            catch (IOException e) when (IsDiskFull(e))
            {
                TryDelete(tmp);
                throw new StorageQuotaException("device storage is full", e);
            }
            catch
            {
                TryDelete(tmp);
                throw;
            }
        }

        private static bool IsDiskFull(IOException e)
        {
            int code = e.HResult & 0xFFFF;
            return code == 0x70 || code == 0x27 || code == 28 /* ENOSPC */ ||
                   e.Message.IndexOf("No space left", StringComparison.OrdinalIgnoreCase) >= 0 ||
                   e.Message.IndexOf("disk full", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static void TryDelete(string path)
        {
            try { if (File.Exists(path)) File.Delete(path); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
    }
}
