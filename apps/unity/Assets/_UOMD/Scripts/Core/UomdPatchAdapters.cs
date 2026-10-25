#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using Uomd.Core.Patching;

namespace Uomd.Core
{
    /// <summary>UnityWebRequest as a Task with cancellation, byte progress and stall detection (main thread only).</summary>
    internal static class UomdWeb
    {
        private const float StallSeconds = 30f;

        public static async Task SendAsync(UnityWebRequest request, CancellationToken cancellation, Action<long>? onBytes = null)
        {
            var op = request.SendWebRequest();
            ulong last = 0;
            float lastChange = Time.realtimeSinceStartup;
            while (!op.isDone)
            {
                if (cancellation.IsCancellationRequested)
                {
                    request.Abort();
                    throw new OperationCanceledException(cancellation);
                }
                ulong received = request.downloadedBytes;
                if (received != last)
                {
                    last = received;
                    lastChange = Time.realtimeSinceStartup;
                    onBytes?.Invoke((long)received);
                }
                else if (Time.realtimeSinceStartup - lastChange > StallSeconds)
                {
                    request.Abort();
                    throw new IOException($"no data for {StallSeconds:0} s");
                }
                await Awaitable.NextFrameAsync();
            }
            if (request.downloadedBytes != last) onBytes?.Invoke((long)request.downloadedBytes);
        }

        public static async Task<byte[]> ReadStreamingAsync(string path, CancellationToken cancellation = default)
        {
            if (!path.Contains("://")) return await Task.Run(() => File.ReadAllBytes(path), cancellation);
            using var request = UnityWebRequest.Get(path);
            await SendAsync(request, cancellation);
            if (request.result != UnityWebRequest.Result.Success) throw new FileNotFoundException($"{path}: {request.error}");
            return request.downloadHandler.data;
        }
    }

    /// <summary>
    /// The release shipped in StreamingAssets/uomd_base (tools/export_unity_bundle.ts): release.json names every file and
    /// its SHA-256. Base WebP files are not shipped (their JPG/PNG siblings are), so only JSON and audio are read here.
    /// </summary>
    public sealed class UomdStreamingBase : IBaseContent
    {
        private readonly string _root;

        private UomdStreamingBase(string root, ContentManifest manifest)
        {
            _root = root;
            ReleaseId = manifest.ReleaseId;
            Generation = manifest.Generation;
            var files = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var f in manifest.Files) files[f.Path] = f.Sha256;
            Files = files;
        }

        public string ReleaseId { get; }
        public long Generation { get; }
        public IReadOnlyDictionary<string, string> Files { get; }

        public static async Task<UomdStreamingBase> LoadAsync(string root)
        {
            byte[] bytes = await UomdWeb.ReadStreamingAsync(Path.Combine(root, "release.json"));
            var manifest = ContentManifest.Parse(UomdJson.Parse(System.Text.Encoding.UTF8.GetString(bytes)));
            return new UomdStreamingBase(root, manifest);
        }

        public string PathOf(string relativePath) => Path.Combine(_root, relativePath);

        public async Task<byte[]> ReadAsync(string path)
        {
            if (!Files.TryGetValue(path, out string? expected)) throw new FileNotFoundException($"base content has no {path}");
            byte[] bytes = await UomdWeb.ReadStreamingAsync(PathOf(path));
            if (Sha256Hash.ComputeHex(bytes) != expected) throw new InvalidDataException($"base file {path} failed its integrity check");
            return bytes;
        }
    }

    /// <summary>
    /// The Cloudflare content API (apps/api gameApp.ts): GET /api/v1/content/channels/{channel}/manifest (404 = nothing
    /// published) and GET /api/v1/content/objects/{sha256} with byte-range resume (port of apps/game/src/content/remote.ts).
    /// </summary>
    public sealed class UomdApiRemote : IRemoteSource
    {
        private const int PartialStepBytes = 1024 * 1024;
        private readonly string _baseUrl;

        public UomdApiRemote(string baseUrl) => _baseUrl = baseUrl.TrimEnd('/');

        public async Task<object?> FetchManifestAsync(string channel, CancellationToken cancellation)
        {
            using var request = UnityWebRequest.Get($"{_baseUrl}/api/v1/content/channels/{Uri.EscapeDataString(channel)}/manifest");
            request.timeout = 30;
            request.SetRequestHeader("Cache-Control", "no-cache");
            await UomdWeb.SendAsync(request, cancellation);
            if (request.responseCode == 404) return null;
            if (request.result != UnityWebRequest.Result.Success) throw new IOException($"manifest request failed: {request.error} (HTTP {request.responseCode})");
            return UomdJson.Parse(request.downloadHandler.text);
        }

        public async Task<byte[]> FetchObjectAsync(string sha256, ManifestFile file, Action<long>? onBytes, byte[]? partial,
            Func<byte[], Task>? onPartial, CancellationToken cancellation)
        {
            long offset = partial?.LongLength ?? 0;
            using var request = new UnityWebRequest($"{_baseUrl}/api/v1/content/objects/{sha256}", UnityWebRequest.kHttpVerbGET, new DownloadHandlerBuffer(), null);
            if (offset > 0) request.SetRequestHeader("Range", $"bytes={offset}-");
            try
            {
                await UomdWeb.SendAsync(request, cancellation, received => onBytes?.Invoke(Math.Min(file.Bytes, offset + received)));
            }
            catch (IOException)
            {
                await SavePrefixAsync(request, partial, offset, file, onPartial);
                throw;
            }
            if (request.result != UnityWebRequest.Result.Success)
            {
                await SavePrefixAsync(request, partial, offset, file, onPartial);
                throw new IOException($"object {sha256.Substring(0, 8)} failed: {request.error} (HTTP {request.responseCode})");
            }
            byte[] body = request.downloadHandler.data ?? Array.Empty<byte>();
            if (request.responseCode == 206)
            {
                string? range = request.GetResponseHeader("Content-Range");
                if (offset == 0 || range != $"bytes {offset}-{file.Bytes - 1}/{file.Bytes}") throw new IOException("object range differs from its signed size");
                if (offset + body.LongLength > file.Bytes) throw new IOException($"object {sha256.Substring(0, 8)} is larger than its manifest says");
                var whole = new byte[offset + body.LongLength];
                Buffer.BlockCopy(partial!, 0, whole, 0, (int)offset);
                Buffer.BlockCopy(body, 0, whole, (int)offset, body.Length);
                return whole;
            }
            if (body.LongLength > file.Bytes) throw new IOException($"object {sha256.Substring(0, 8)} is larger than its manifest says");
            return body;
        }

        /// <summary>Keeps the received prefix of a broken transfer (at least 1 MiB) so the next attempt resumes with a Range request.</summary>
        private static async Task SavePrefixAsync(UnityWebRequest request, byte[]? partial, long offset, ManifestFile file, Func<byte[], Task>? onPartial)
        {
            if (onPartial == null) return;
            byte[]? received;
            try { received = request.downloadHandler?.data; }
            catch (Exception) { return; }
            if (received == null || received.Length < PartialStepBytes) return;
            bool resumed = request.responseCode == 206 && offset > 0;
            if (!resumed && request.responseCode != 200) return;
            long total = (resumed ? offset : 0) + received.LongLength;
            if (total >= file.Bytes) return;
            var prefix = new byte[total];
            if (resumed) Buffer.BlockCopy(partial!, 0, prefix, 0, (int)offset);
            Buffer.BlockCopy(received, 0, prefix, resumed ? (int)offset : 0, received.Length);
            try { await onPartial(prefix); }
            catch (Exception e) when (!(e is OperationCanceledException)) { Debug.LogWarning($"[UomdPatch] could not keep a partial download: {e.Message}"); }
        }
    }
}
