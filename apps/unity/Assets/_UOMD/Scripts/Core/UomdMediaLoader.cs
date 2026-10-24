using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

namespace Uomd.Core
{
    /// <summary>
    /// Loads content media (textures and Ogg Vorbis clips) through PatchManager, so a verified patch overrides the base
    /// release file. Textures are cached until ReleaseTextures (the router calls it between screens); clips stay cached
    /// because music and short cues repeat across screens.
    /// </summary>
    public sealed class UomdMediaLoader
    {
        private readonly PatchManager _patch;
        private readonly Dictionary<string, Texture2D> _textures = new Dictionary<string, Texture2D>(StringComparer.Ordinal);
        private readonly Dictionary<string, AudioClip> _clips = new Dictionary<string, AudioClip>(StringComparer.Ordinal);

        public UomdMediaLoader(PatchManager patch) => _patch = patch;

        public UomdMediaCatalog Catalog { get; private set; } = UomdMediaCatalog.Empty;

        /// <summary>Reads art/art_manifest.json and presentation/presentation.json. A missing file leaves those lookups empty.</summary>
        public async Awaitable LoadCatalogAsync()
        {
            string art = await TryReadTextAsync("art/art_manifest.json");
            string presentation = await TryReadTextAsync("presentation/presentation.json");
            Catalog = UomdMediaCatalog.Parse(art, presentation);
        }

        /// <summary>The texture for a content path (".webp" resolves to its PNG sibling), or null when it cannot be loaded.</summary>
        public async Awaitable<Texture2D> TextureAsync(string relativePath)
        {
            if (string.IsNullOrEmpty(relativePath)) return null;
            if (_textures.TryGetValue(relativePath, out var cached) && cached != null) return cached;
            try
            {
                var texture = await UomdTextureLoader.LoadAsync(_patch, relativePath);
                _textures[relativePath] = texture;
                return texture;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[UomdMedia] texture '{relativePath}' unavailable: {e.Message}");
                return null;
            }
        }

        /// <summary>The decoded clip for a content-relative .ogg path, or null when it cannot be loaded.</summary>
        public async Awaitable<AudioClip> ClipAsync(string relativePath, bool streamLong = false)
        {
            if (string.IsNullOrEmpty(relativePath)) return null;
            if (_clips.TryGetValue(relativePath, out var cached) && cached != null) return cached;
            string path = _patch.ResolveContentPath(relativePath);
            string url = path.Contains("://") ? path : new Uri(path).AbsoluteUri;
            using var request = UnityWebRequestMultimedia.GetAudioClip(url, AudioType.OGGVORBIS);
            if (request.downloadHandler is DownloadHandlerAudioClip handler)
            {
                // Music stays Vorbis-compressed in memory; short cues are decoded once for latency.
                handler.compressed = streamLong;
            }
            await request.SendWebRequest();
            if (request.result != UnityWebRequest.Result.Success)
            {
                Debug.LogWarning($"[UomdMedia] clip '{relativePath}' unavailable: {request.error}");
                return null;
            }
            var clip = DownloadHandlerAudioClip.GetContent(request);
            clip.name = relativePath;
            _clips[relativePath] = clip;
            return clip;
        }

        public void ReleaseTextures()
        {
            foreach (var texture in _textures.Values)
            {
                if (texture != null) UnityEngine.Object.Destroy(texture);
            }
            _textures.Clear();
        }

        private async Awaitable<string> TryReadTextAsync(string relativePath)
        {
            try
            {
                return await _patch.ReadTextAsync(relativePath);
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[UomdMedia] '{relativePath}' unavailable: {e.Message}");
                return null;
            }
        }
    }
}
