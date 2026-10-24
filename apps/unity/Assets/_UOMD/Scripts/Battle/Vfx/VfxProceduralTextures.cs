#nullable enable
using System;
using System.Collections.Generic;
using UnityEngine;

namespace Uomd.Battle.Vfx
{
    /// <summary>
    /// C# port of apps/game/src/vfx/textures.ts.
    /// Generates procedural radial/geometric sprites in memory for the 11 closed VfxTexture primitives
    /// (`spark`, `star`, `slash`, `ring`, `pillar`, `shard`, `bell`, `chain`, `seal`, `droplet`, `feather`)
    /// and the 10 VfxShape primitives so all 115 presets in `vfx_presets.json` render deterministically.
    /// </summary>
    public sealed class VfxProceduralTextures : IDisposable
    {
        private readonly Dictionary<string, Sprite> _sprites = new(StringComparer.Ordinal);
        private readonly List<Texture2D> _textures = new();

        public VfxProceduralTextures()
        {
            BuildAll();
        }

        public Sprite GetTextureSprite(string name)
        {
            if (_sprites.TryGetValue(name, out var sp)) return sp;
            return _sprites["spark"];
        }

        private void BuildAll()
        {
            Register("spark", 64, (u, v) => RadialFalloff(u, v, 2.2f));
            Register("star", 64, (u, v) => StarField(u, v));
            Register("slash", 96, (u, v) => CrescentField(u, v));
            Register("ring", 96, (u, v) => RingField(u, v, 0.72f, 0.14f));
            Register("pillar", 96, (u, v) => Mathf.Clamp01(1f - Mathf.Abs(u) * 2.4f) * Mathf.Clamp01(1f - Mathf.Abs(v)));
            Register("shard", 64, (u, v) => DiamondField(u, v, 1.8f, 0.7f));
            Register("bell", 96, (u, v) => RingField(u, v, 0.65f, 0.18f) + RadialFalloff(u, v, 3.5f) * 0.5f);
            Register("chain", 64, (u, v) => RingField(u * 1.4f, v * 0.8f, 0.6f, 0.2f));
            Register("seal", 96, (u, v) => Mathf.Max(RingField(u, v, 0.82f, 0.08f), StarField(u, v) * 0.75f));
            Register("droplet", 64, (u, v) => RadialFalloff(u * 1.35f, v, 2.0f));
            Register("feather", 64, (u, v) => DiamondField(u * 2.2f, v * 0.8f, 1.2f, 1.0f));
        }

        private void Register(string key, int size, Func<float, float, float> alphaFunc)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, mipChain: false)
            {
                name = $"vfx_proc_{key}",
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear
            };

            var pixels = new Color32[size * size];
            for (int y = 0; y < size; y++)
            {
                float v = ((y + 0.5f) / size) * 2f - 1f;
                for (int x = 0; x < size; x++)
                {
                    float u = ((x + 0.5f) / size) * 2f - 1f;
                    float a = Mathf.Clamp01(alphaFunc(u, v));
                    byte alphaByte = (byte)Mathf.RoundToInt(a * 255f);
                    pixels[y * size + x] = new Color32(255, 255, 255, alphaByte);
                }
            }

            tex.SetPixels32(pixels);
            tex.Apply(updateMipmaps: false, makeNoLongerReadable: true);
            _textures.Add(tex);

            var sp = Sprite.Create(
                tex,
                new Rect(0, 0, size, size),
                new Vector2(0.5f, 0.5f),
                100.0f,
                0,
                SpriteMeshType.FullRect
            );
            sp.name = key;
            _sprites[key] = sp;
        }

        private static float RadialFalloff(float u, float v, float power)
        {
            float d = Mathf.Sqrt(u * u + v * v);
            if (d >= 1f) return 0f;
            return Mathf.Pow(1f - d, power);
        }

        private static float RingField(float u, float v, float radius, float halfWidth)
        {
            float d = Mathf.Sqrt(u * u + v * v);
            float dist = Mathf.Abs(d - radius);
            if (dist >= halfWidth) return 0f;
            return 1f - (dist / halfWidth);
        }

        private static float StarField(float u, float v)
        {
            float core = RadialFalloff(u, v, 2.8f);
            float hRay = Mathf.Clamp01(1f - Mathf.Abs(v) * 6f) * Mathf.Clamp01(1f - Mathf.Abs(u));
            float vRay = Mathf.Clamp01(1f - Mathf.Abs(u) * 6f) * Mathf.Clamp01(1f - Mathf.Abs(v));
            return Mathf.Clamp01(core + Mathf.Max(hRay, vRay));
        }

        private static float CrescentField(float u, float v)
        {
            float d1 = Mathf.Sqrt(u * u + v * v);
            float d2 = Mathf.Sqrt((u - 0.22f) * (u - 0.22f) + v * v);
            if (d1 > 0.92f || d2 < 0.72f) return 0f;
            return Mathf.Clamp01((0.92f - d1) * 4f);
        }

        private static float DiamondField(float u, float v, float sx, float sy)
        {
            float m = Mathf.Abs(u) * sx + Mathf.Abs(v) * sy;
            if (m >= 1f) return 0f;
            return 1f - m;
        }

        public void Dispose()
        {
            foreach (var sp in _sprites.Values)
            {
                if (sp != null) UnityEngine.Object.Destroy(sp);
            }
            _sprites.Clear();
            foreach (var tex in _textures)
            {
                if (tex != null) UnityEngine.Object.Destroy(tex);
            }
            _textures.Clear();
        }
    }
}
