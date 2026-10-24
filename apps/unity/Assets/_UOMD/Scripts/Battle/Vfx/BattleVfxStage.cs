#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using UnityEngine;
using UnityEngine.Pool;
using Uomd.Contracts;

namespace Uomd.Battle.Vfx
{
    public struct VfxPlayOptions
    {
        public Vector2 OriginWorld;
        public Vector2? TargetWorld;
        public string? Element;
        public float Scale;
        public int Direction; // 1 = left->right, -1 = mirrored
        public float Pace;
        public Action<string, float, float>? OnCue; // (cue, durationMs, intensity)
    }

    public struct VfxEnvironmentState
    {
        public bool ParticlesEnabled;
        public float ParticleDensity;
        public bool ReducedMotion;
        public bool ReduceFlash;
    }

    /// <summary>
    /// Unity 6 URP 2D port of apps/game/src/vfx/VfxStage.ts.
    /// Executes data-driven combat VFX presets (`content/base/vfx/vfx_presets.json`, capability `vfx_v1`)
    /// across three sorting layers (`ground` -> VfxBehind, `fx` -> VfxFront, `overlay` -> CutIn) with
    /// pooled SpriteRenderers and zero-GC update loops.
    /// </summary>
    public sealed class BattleVfxStage : MonoBehaviour
    {
        private const float PixelsPerUnit = 100.0f;
        private const int CritGoldHex = 0xffe48f;
        private static readonly VfxPaletteDto FallbackPalette = new()
        {
            primary = 0xb98eff,
            secondary = 0xe55b8a,
            core = 0xf4e8ff
        };

        private struct ActiveParticle
        {
            public SpriteRenderer Renderer;
            public Vector2 VelocityWorld;
            public float GravityWorldY;
            public float SpinDegPerSec;
            public float AgeMs;
            public float LifeMs;
            public float ScaleStart;
            public float ScaleEnd;
            public float AlphaStart;
            public float AlphaEnd;
            public Color BaseColor;
        }

        private readonly List<ActiveParticle> _particles = new(128);
        private ObjectPool<SpriteRenderer>? _rendererPool;
        private VfxProceduralTextures? _proceduralTextures;
        private VfxPackDto? _pack;
        private float _timeScale = 1.0f;

        public VfxEnvironmentState Environment { get; set; } = new()
        {
            ParticlesEnabled = true,
            ParticleDensity = 1.0f,
            ReducedMotion = false,
            ReduceFlash = false
        };

        public float TimeScale
        {
            get => _timeScale;
            set => _timeScale = Mathf.Clamp(value, 0f, 4f);
        }

        public int ActiveParticleCount => _particles.Count;

        private void Awake()
        {
            _proceduralTextures = new VfxProceduralTextures();
            _rendererPool = new ObjectPool<SpriteRenderer>(
                createFunc: CreatePooledRenderer,
                actionOnGet: r => r.gameObject.SetActive(true),
                actionOnRelease: r => r.gameObject.SetActive(false),
                actionOnDestroy: r => { if (r != null) Destroy(r.gameObject); },
                collectionCheck: false,
                defaultCapacity: 64,
                maxSize: 256
            );
        }

        private void OnDestroy()
        {
            _particles.Clear();
            _rendererPool?.Dispose();
            _proceduralTextures?.Dispose();
        }

        public void SetPack(VfxPackDto? pack) => _pack = pack;
        public void LoadPresets(VfxPackDto? pack) => SetPack(pack);

        public void PlayPreset(string presetId, Vector3 origin, Vector3? target = null, bool reducedMotion = false, bool reduceFlash = false)
        {
            var opts = new VfxPlayOptions
            {
                OriginWorld = origin,
                TargetWorld = target.HasValue ? (Vector2)target.Value : null
            };
            _ = PlayAsync(presetId, opts);
        }

        public bool HasPreset(string presetId) =>
            _pack is not null && _pack.presets.ContainsKey(presetId);

        public string? PresetForSkill(string skillId)
        {
            if (_pack is not null && _pack.skills.TryGetValue(skillId, out string? presetId) && HasPreset(presetId))
            {
                return presetId;
            }
            return null;
        }

        private void Update()
        {
            float dtSec = Time.deltaTime * _timeScale;
            if (dtSec <= 0f || _particles.Count == 0 || _rendererPool is null) return;
            float dtMs = dtSec * 1000f;

            for (int i = _particles.Count - 1; i >= 0; i--)
            {
                ActiveParticle p = _particles[i];
                p.AgeMs += dtMs;
                if (p.AgeMs >= p.LifeMs || p.Renderer == null)
                {
                    if (p.Renderer != null) _rendererPool.Release(p.Renderer);
                    int lastIdx = _particles.Count - 1;
                    _particles[i] = _particles[lastIdx];
                    _particles.RemoveAt(lastIdx);
                    continue;
                }

                p.VelocityWorld.y += p.GravityWorldY * dtSec;
                Transform tr = p.Renderer.transform;
                Vector3 pos = tr.position;
                pos.x += p.VelocityWorld.x * dtSec;
                pos.y += p.VelocityWorld.y * dtSec;
                tr.position = pos;

                if (Mathf.Abs(p.SpinDegPerSec) > 0.01f)
                {
                    tr.Rotate(0f, 0f, p.SpinDegPerSec * dtSec);
                }

                float k = Mathf.Clamp01(p.AgeMs / p.LifeMs);
                float s = Mathf.Lerp(p.ScaleStart, p.ScaleEnd, k);
                tr.localScale = new Vector3(s, s, 1f);

                Color c = p.BaseColor;
                c.a = Mathf.Lerp(p.AlphaStart, p.AlphaEnd, k);
                p.Renderer.color = c;

                _particles[i] = p;
            }
        }

        public async Awaitable PlayAsync(string presetId, VfxPlayOptions options, CancellationToken ct = default)
        {
            if (_pack is null || !_pack.presets.TryGetValue(presetId, out VfxPresetDto? preset) || Environment.ReducedMotion)
            {
                return;
            }

            VfxPaletteDto pal = ResolvePalette(options.Element);
            float scale = options.Scale > 0f ? options.Scale : 1f;
            int dir = options.Direction == -1 ? -1 : 1;
            float pace = Mathf.Max(0.1f, options.Pace > 0f ? options.Pace : 1f);

            float maxEndMs = 0f;
            for (int i = 0; i < preset.elements.Count; i++)
            {
                VfxElementDto el = preset.elements[i];
                switch (el.kind)
                {
                    case "burst":
                        if (!Environment.ReduceFlash && Environment.ParticlesEnabled && Environment.ParticleDensity > 0f)
                        {
                            SpawnBurst(el, options, pal, scale, dir, pace);
                            maxEndMs = Mathf.Max(maxEndMs, (el.delay_ms + el.lifespan_ms) * pace);
                        }
                        break;
                    case "projectile":
                        await PlayProjectileAsync(el, options, pal, scale, pace, ct);
                        return;
                    case "cue":
                        if (options.OnCue is not null)
                        {
                            _ = InvokeCueAfterDelayAsync(el.delay_ms * pace, el.cue, el.duration_ms * pace, el.intensity, options.OnCue, ct);
                        }
                        break;
                    default:
                        if (!Environment.ReduceFlash)
                        {
                            maxEndMs = Mathf.Max(maxEndMs, (el.delay_ms + el.duration_ms) * pace);
                            _ = PlayTweenedElementAsync(el, options, pal, scale, dir, pace, ct);
                        }
                        break;
                }
            }

            if (maxEndMs > 0f)
            {
                await WaitBattleMillisecondsAsync(maxEndMs, ct);
            }
        }

        private async Awaitable InvokeCueAfterDelayAsync(
            float delayMs,
            string cue,
            float durationMs,
            float intensity,
            Action<string, float, float> callback,
            CancellationToken ct)
        {
            if (delayMs > 0f) await WaitBattleMillisecondsAsync(delayMs, ct);
            callback(cue, durationMs, intensity);
        }

        private async Awaitable PlayTweenedElementAsync(
            VfxElementDto el,
            VfxPlayOptions options,
            VfxPaletteDto pal,
            float scale,
            int dir,
            float pace,
            CancellationToken ct)
        {
            if (_rendererPool is null || _proceduralTextures is null) return;
            float delayMs = el.delay_ms * pace;
            if (delayMs > 0f) await WaitBattleMillisecondsAsync(delayMs, ct);

            SpriteRenderer sr = _rendererPool.Get();
            try
            {
                sr.sprite = _proceduralTextures.GetTextureSprite(el.kind == "shape" ? "ring" : el.texture);
                ConfigureSorting(sr, el.layer, el.depth);
                Color baseColor = ResolveColor(el.tint, pal);

                Vector2 startPos = options.OriginWorld + new Vector2(el.from.x * scale * dir, -el.from.y * scale) / PixelsPerUnit;
                Vector2 endPos = options.OriginWorld + new Vector2(el.to.x * scale * dir, -el.to.y * scale) / PixelsPerUnit;
                float startScale = (el.from.scale > 0f ? el.from.scale : 1f) * scale;
                float endScale = (el.to.scale > 0f ? el.to.scale : startScale) * scale;

                float durationMs = Mathf.Max(16f, el.duration_ms * pace);
                float elapsedMs = 0f;
                while (elapsedMs < durationMs)
                {
                    ct.ThrowIfCancellationRequested();
                    elapsedMs += Time.deltaTime * _timeScale * 1000f;
                    float k = EvaluateEase(el.ease, Mathf.Clamp01(elapsedMs / durationMs));
                    sr.transform.position = Vector2.Lerp(startPos, endPos, k);
                    float s = Mathf.Lerp(startScale, endScale, k);
                    sr.transform.localScale = new Vector3(s * dir, s, 1f);
                    Color c = baseColor;
                    c.a = Mathf.Lerp(el.from.alpha, el.to.alpha, k);
                    sr.color = c;
                    await Awaitable.NextFrameAsync(ct);
                }
            }
            finally
            {
                if (sr != null) _rendererPool.Release(sr);
            }
        }

        private void SpawnBurst(
            VfxElementDto el,
            VfxPlayOptions options,
            VfxPaletteDto pal,
            float scale,
            int dir,
            float pace)
        {
            if (_rendererPool is null || _proceduralTextures is null) return;
            int count = Mathf.Max(Mathf.Min(4, el.count), Mathf.RoundToInt(el.count * Environment.ParticleDensity));
            Sprite sp = _proceduralTextures.GetTextureSprite(el.texture);

            for (int i = 0; i < count; i++)
            {
                SpriteRenderer sr = _rendererPool.Get();
                sr.sprite = sp;
                ConfigureSorting(sr, el.layer, el.depth);

                string tintKey = (el.tints.Length > 0) ? el.tints[i % el.tints.Length] : "primary";
                Color col = ResolveColor(tintKey, pal);
                col.a = el.alpha_range.start;
                sr.color = col;

                float ox = RandomRange(el.offset_x) * scale * dir / PixelsPerUnit;
                float oy = -RandomRange(el.offset_y) * scale / PixelsPerUnit;
                sr.transform.position = options.OriginWorld + new Vector2(ox, oy);

                float angleRad = RandomRange(el.angle) * Mathf.Deg2Rad;
                float speedWorld = (RandomRange(el.speed) * scale) / PixelsPerUnit;
                // Note: Top-left +Y is down, Unity +Y is up -> negate sin(angle) and gravity_y
                Vector2 vel = new(Mathf.Cos(angleRad) * speedWorld * dir, -Mathf.Sin(angleRad) * speedWorld);

                float s0 = el.scale_range.start * scale;
                float s1 = el.scale_range.end * scale;
                sr.transform.localScale = new Vector3(s0, s0, 1f);

                _particles.Add(new ActiveParticle
                {
                    Renderer = sr,
                    VelocityWorld = vel,
                    GravityWorldY = -el.gravity_y / PixelsPerUnit,
                    SpinDegPerSec = el.spin ? UnityEngine.Random.Range(-680f, 680f) : 0f,
                    AgeMs = 0f,
                    LifeMs = Mathf.Max(16f, el.lifespan_ms * pace),
                    ScaleStart = s0,
                    ScaleEnd = s1,
                    AlphaStart = el.alpha_range.start,
                    AlphaEnd = el.alpha_range.end,
                    BaseColor = col
                });
            }
        }

        private async Awaitable PlayProjectileAsync(
            VfxElementDto el,
            VfxPlayOptions options,
            VfxPaletteDto pal,
            float scale,
            float pace,
            CancellationToken ct)
        {
            if (_rendererPool is null || _proceduralTextures is null) return;
            Vector2 from = options.OriginWorld;
            Vector2 to = options.TargetWorld ?? options.OriginWorld;
            // In Unity +Y is up, so an upward arc adds +arc_height / PixelsPerUnit
            Vector2 mid = new((from.x + to.x) * 0.5f, Mathf.Max(from.y, to.y) + (el.arc_height / PixelsPerUnit));

            SpriteRenderer orb = _rendererPool.Get();
            try
            {
                orb.sprite = _proceduralTextures.GetTextureSprite(el.texture);
                ConfigureSorting(orb, el.layer, el.depth);
                orb.color = ResolveColor(el.tint, pal);
                float s = el.projectile_scale * scale;
                orb.transform.localScale = new Vector3(s, s, 1f);

                float durationMs = Mathf.Max(16f, el.duration_ms * pace);
                float elapsedMs = 0f;
                while (elapsedMs < durationMs)
                {
                    ct.ThrowIfCancellationRequested();
                    elapsedMs += Time.deltaTime * _timeScale * 1000f;
                    float k = EvaluateEase(el.ease, Mathf.Clamp01(elapsedMs / durationMs));
                    float u = 1f - k;
                    Vector2 pos = (u * u * from) + (2f * u * k * mid) + (k * k * to);
                    orb.transform.position = pos;
                    orb.transform.rotation = Quaternion.Euler(0f, 0f, -k * 360f * el.spin_turns);
                    await Awaitable.NextFrameAsync(ct);
                }
            }
            finally
            {
                if (orb != null) _rendererPool.Release(orb);
            }
        }

        private async Awaitable WaitBattleMillisecondsAsync(float ms, CancellationToken ct)
        {
            float remaining = ms;
            while (remaining > 0f)
            {
                ct.ThrowIfCancellationRequested();
                remaining -= Time.deltaTime * _timeScale * 1000f;
                await Awaitable.NextFrameAsync(ct);
            }
        }

        private SpriteRenderer CreatePooledRenderer()
        {
            var go = new GameObject("VfxSprite");
            go.transform.SetParent(transform, worldPositionStays: false);
            return go.AddComponent<SpriteRenderer>();
        }

        private static void ConfigureSorting(SpriteRenderer sr, string layer, int depth)
        {
            sr.sortingLayerName = layer switch
            {
                "ground" => "VfxBehind",
                "overlay" => "CutIn",
                _ => "VfxFront"
            };
            sr.sortingOrder = depth;
        }

        private VfxPaletteDto ResolvePalette(string? element)
        {
            if (_pack is not null)
            {
                if (!string.IsNullOrEmpty(element) && _pack.palettes.TryGetValue(element!, out var pal))
                    return pal;
                if (_pack.palettes.TryGetValue("Veil", out var veilPal))
                    return veilPal;
            }
            return FallbackPalette;
        }

        private static Color ResolveColor(string key, VfxPaletteDto pal)
        {
            int rgb = key switch
            {
                "primary" => pal.primary,
                "secondary" => pal.secondary,
                "core" => pal.core,
                "crit" => CritGoldHex,
                _ when key.StartsWith("#", StringComparison.Ordinal) && key.Length == 7 =>
                    Convert.ToInt32(key.Substring(1), 16),
                _ => pal.primary
            };
            float r = ((rgb >> 16) & 0xFF) / 255f;
            float g = ((rgb >> 8) & 0xFF) / 255f;
            float b = (rgb & 0xFF) / 255f;
            return new Color(r, g, b, 1f);
        }

        private static float RandomRange(float[] range)
        {
            if (range == null || range.Length == 0) return 0f;
            if (range.Length == 1) return range[0];
            return UnityEngine.Random.Range(range[0], range[1]);
        }

        public static float EvaluateEase(string ease, float t)
        {
            t = Mathf.Clamp01(t);
            return ease switch
            {
                "quad.in" => t * t,
                "quad.out" => 1f - (1f - t) * (1f - t),
                "cubic.out" => 1f - Mathf.Pow(1f - t, 3f),
                "back.out" => 1f + 2.70158f * Mathf.Pow(t - 1f, 3f) + 1.70158f * Mathf.Pow(t - 1f, 2f),
                "sine.inout" => -(Mathf.Cos(Mathf.PI * t) - 1f) * 0.5f,
                _ => t
            };
        }
    }
}
