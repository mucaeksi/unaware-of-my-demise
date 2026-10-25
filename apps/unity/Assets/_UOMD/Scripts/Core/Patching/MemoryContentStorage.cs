#nullable enable
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Uomd.Core.Patching
{
    /// <summary>In-memory IContentStorage (port of packages/patch/src/memory.ts) for tests and as a no-disk fallback.</summary>
    public sealed class MemoryContentStorage : IContentStorage
    {
        private readonly object _gate = new object();
        private readonly Dictionary<string, byte[]> _objects = new Dictionary<string, byte[]>(StringComparer.Ordinal);
        private readonly Dictionary<string, GenerationMark> _highWater = new Dictionary<string, GenerationMark>(StringComparer.Ordinal);
        private IReadOnlyDictionary<string, DownloadReservation> _downloads = new Dictionary<string, DownloadReservation>(StringComparer.Ordinal);
        private string? _state;

        /// <summary>The stored state record (tests replace it to simulate loss or tampering).</summary>
        public string? State
        {
            get { lock (_gate) return _state; }
            set { lock (_gate) _state = value; }
        }

        public void SetHighWater(string channel, GenerationMark? mark)
        {
            lock (_gate)
            {
                if (mark == null) _highWater.Remove(channel);
                else _highWater[channel] = mark;
            }
        }

        public void ClearHighWater()
        {
            lock (_gate) _highWater.Clear();
        }

        public Task<byte[]?> GetObjectAsync(string key)
        {
            lock (_gate) return Task.FromResult(_objects.TryGetValue(key, out byte[]? b) ? (byte[]?)(byte[])b.Clone() : null);
        }

        public Task PutObjectAsync(string key, byte[] bytes, string? reservation = null)
        {
            lock (_gate)
            {
                if (reservation != null)
                {
                    string hash = key.StartsWith("partial:", StringComparison.Ordinal) ? key.Substring(8) : key;
                    if (!_downloads.TryGetValue(reservation, out var entry) || entry.ExpiresAtMs <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() ||
                        !entry.Files.TryGetValue(hash, out long limit) || bytes.LongLength > limit)
                    {
                        throw new InvalidOperationException("content reservation expired or exceeded");
                    }
                    if (hash == key) _objects.Remove("partial:" + key);
                }
                _objects[key] = (byte[])bytes.Clone();
            }
            return Task.CompletedTask;
        }

        public Task<bool> HasObjectAsync(string key)
        {
            lock (_gate) return Task.FromResult(_objects.ContainsKey(key));
        }

        public Task<IReadOnlyList<string>> ListObjectsAsync()
        {
            lock (_gate) return Task.FromResult<IReadOnlyList<string>>(new List<string>(_objects.Keys));
        }

        public Task DeleteObjectAsync(string key)
        {
            lock (_gate) _objects.Remove(key);
            return Task.CompletedTask;
        }

        public Task<string?> GetStateAsync()
        {
            lock (_gate) return Task.FromResult(_state);
        }

        public Task<GenerationMark?> GetHighWaterAsync(string channel)
        {
            lock (_gate) return Task.FromResult(_highWater.TryGetValue(channel, out var m) ? m : null);
        }

        public Task<bool> UpdateStateAsync(string channel, Func<StorageSnapshot, StorageSnapshot?> change)
        {
            lock (_gate)
            {
                // read, change and write under one lock: competing clients cannot commit over one another
                var inventory = new Dictionary<string, long>(StringComparer.Ordinal);
                foreach (var kv in _objects) inventory[kv.Key] = kv.Value.LongLength;
                var current = new StorageSnapshot(_state, _highWater.TryGetValue(channel, out var mark) ? mark : null, inventory, _downloads);
                var next = change(current);
                if (next == null) return Task.FromResult(false);
                _state = next.State;
                if (next.Downloads != null) _downloads = new Dictionary<string, DownloadReservation>(ToDictionary(next.Downloads), StringComparer.Ordinal);
                if (next.RemoveObjects != null) foreach (string key in next.RemoveObjects) _objects.Remove(key);
                if (next.HighWater != null) _highWater[channel] = next.HighWater;
                return Task.FromResult(true);
            }
        }

        private static Dictionary<string, DownloadReservation> ToDictionary(IReadOnlyDictionary<string, DownloadReservation> source)
        {
            var d = new Dictionary<string, DownloadReservation>(StringComparer.Ordinal);
            foreach (var kv in source) d[kv.Key] = kv.Value;
            return d;
        }
    }
}
