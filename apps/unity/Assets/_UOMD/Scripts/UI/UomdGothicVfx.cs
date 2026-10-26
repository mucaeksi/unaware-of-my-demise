using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace Uomd.UI
{
    /// <summary>
    /// Unity 6 Runtime UI Toolkit port of apps/game/src/vfx/gothicUiVfx.ts and apps/game/src/vfx/livingBackdrop.ts.
    /// Provides real-time 60 FPS atmospheric Living Backdrops (camera breathing, swaying light shafts, drifting mist
    /// veils, rising ash/ember motes) and the 4 Approved Gothic UI VFX (Rotating Black-Sun Eclipse Corona &amp; Rune Ring,
    /// Swinging Fractured Sanctuary Bell, Wax-Seal Ignition Burst, and Cracked Pocket Watch Spinner).
    /// </summary>
    public static class UomdGothicVfx
    {
        private static readonly Dictionary<string, Texture2D> CachedResources = new Dictionary<string, Texture2D>(StringComparer.Ordinal);

        public static Texture2D LoadUiTexture(string resourceName)
        {
            if (string.IsNullOrEmpty(resourceName)) return null;
            if (CachedResources.TryGetValue(resourceName, out var tex) && tex != null) return tex;
            tex = Resources.Load<Texture2D>("UomdUI/" + resourceName);
            if (tex != null) CachedResources[resourceName] = tex;
            return tex;
        }

        public static bool IsFullColorIcon(string resourceName)
        {
            if (string.IsNullOrEmpty(resourceName)) return false;
            return resourceName.StartsWith("icon_nav_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_ui_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_curr_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_el_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_skill_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_st_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_status_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_seal_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_relic_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_fates_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_first_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_silver_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_ration", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_illuminated_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("icon_bound_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("uikit_", StringComparison.Ordinal) ||
                   resourceName.StartsWith("anim_", StringComparison.Ordinal);
        }

        public static VisualElement CreateTintedSprite(string resourceName, float width, float height, Color tint)
        {
            var el = new VisualElement { pickingMode = PickingMode.Ignore };
            el.style.width = width;
            el.style.height = height;
            el.style.backgroundPositionX = new BackgroundPosition(BackgroundPositionKeyword.Center);
            el.style.backgroundPositionY = new BackgroundPosition(BackgroundPositionKeyword.Center);
            el.style.backgroundRepeat = new BackgroundRepeat(Repeat.NoRepeat, Repeat.NoRepeat);
            el.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            el.style.unityBackgroundImageTintColor = IsFullColorIcon(resourceName) ? Color.white : tint;
            var tex = LoadUiTexture(resourceName);
            if (tex != null) el.style.backgroundImage = new StyleBackground(tex);
            return el;
        }

        /// <summary>
        /// Plays an 8-frame Whisk / Imagen sprite-sheet loop (e.g. anim_corona_01..08, anim_bell_01..08, anim_cta_seal_01..08, anim_watch_01..08).
        /// </summary>
        public static VisualElement CreateSpriteSheetLoop(
            VisualElement parent,
            string prefix,
            int frameCount,
            float width,
            float height,
            float fps,
            bool reducedMotion)
        {
            var el = new VisualElement { name = prefix + "-loop", pickingMode = PickingMode.Ignore };
            el.style.width = width;
            el.style.height = height;
            el.style.backgroundPositionX = new BackgroundPosition(BackgroundPositionKeyword.Center);
            el.style.backgroundPositionY = new BackgroundPosition(BackgroundPositionKeyword.Center);
            el.style.backgroundRepeat = new BackgroundRepeat(Repeat.NoRepeat, Repeat.NoRepeat);
            el.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            if (parent != null) parent.Add(el);

            var frames = new Texture2D[Mathf.Max(1, frameCount)];
            int validCount = 0;
            for (int i = 0; i < frames.Length; i++)
            {
                var tex = LoadUiTexture($"{prefix}_{i + 1:D2}");
                if (tex != null) frames[validCount++] = tex;
            }

            if (validCount > 0)
            {
                el.style.backgroundImage = new StyleBackground(frames[0]);
                if (!reducedMotion && validCount > 1)
                {
                    int idx = 0;
                    long intervalMs = Mathf.Clamp(Mathf.RoundToInt(1000f / Mathf.Max(1f, fps)), 33, 500);
                    el.schedule.Execute(() =>
                    {
                        if (el.panel == null) return;
                        idx = (idx + 1) % validCount;
                        el.style.backgroundImage = new StyleBackground(frames[idx]);
                    }).Every(intervalMs);
                }
            }

            return el;
        }

        /// <summary>
        /// Applies Whisk Animate 4-second seamless character portrait loop (idle breathing chest rise, subtle wind sway,
        /// and flickering sanctuary lantern rim-light pulse) to VN and Hub character portraits.
        /// </summary>
        public static void AttachWhiskAnimatePortrait(
            VisualElement actorImage,
            string characterId,
            bool isLeft,
            bool reducedMotion)
        {
            if (actorImage == null || reducedMotion) return;

            float seedOffset = 0f;
            if (!string.IsNullOrEmpty(characterId))
            {
                for (int i = 0; i < characterId.Length; i++)
                    seedOffset += characterId[i] * 0.17f;
            }

            float elapsed = seedOffset;
            float baseSign = isLeft ? 1f : -1f;
            actorImage.style.transformOrigin = new TransformOrigin(Length.Percent(50), Length.Percent(95));

            actorImage.schedule.Execute(() =>
            {
                if (actorImage.panel == null) return;
                elapsed += 0.033f;
                // 4.0s Whisk Animate breathing cycle (omega = 2*pi / 4.0 = 1.5708)
                float breath = Mathf.Sin(elapsed * 1.5708f);
                float sway = Mathf.Sin(elapsed * 0.95f + 0.7f);
                float scaleX = (1f + 0.012f * breath) * baseSign;
                float scaleY = 1f + 0.022f * (0.5f + 0.5f * breath);
                float dx = sway * 5.5f;
                float dy = -Mathf.Abs(breath) * 4.5f;
                float tilt = sway * 0.85f;

                actorImage.style.scale = new Scale(new Vector3(scaleX, scaleY, 1f));
                actorImage.style.translate = new Translate(dx, dy);
                actorImage.style.rotate = new Rotate(tilt);
            }).Every(33);
        }

        /// <summary>
        /// Builds an ornate Gothic gauge bar using uikit_bar_frame + uikit_bar_hp / uikit_bar_focus.
        /// </summary>
        public static VisualElement CreateGothicGaugeBar(
            VisualElement parent,
            float width,
            float height,
            float ratio,
            bool isFocusBar,
            out VisualElement fillElement)
        {
            var container = new VisualElement { name = "gothic-gauge-bar", pickingMode = PickingMode.Ignore };
            container.style.width = width;
            container.style.height = height;
            container.style.position = Position.Relative;
            if (parent != null) parent.Add(container);

            var trackBg = new VisualElement { pickingMode = PickingMode.Ignore };
            trackBg.style.position = Position.Absolute;
            trackBg.style.left = 6f;
            trackBg.style.right = 6f;
            trackBg.style.top = 3f;
            trackBg.style.bottom = 3f;
            trackBg.style.backgroundColor = new Color(0.03f, 0.015f, 0.055f, 0.92f);
            trackBg.style.borderTopLeftRadius = trackBg.style.borderTopRightRadius = trackBg.style.borderBottomLeftRadius = trackBg.style.borderBottomRightRadius = 4f;
            trackBg.style.overflow = Overflow.Hidden;
            container.Add(trackBg);

            fillElement = new VisualElement { name = "gothic-gauge-fill", pickingMode = PickingMode.Ignore };
            fillElement.style.position = Position.Absolute;
            fillElement.style.left = 0;
            fillElement.style.top = 0;
            fillElement.style.bottom = 0;
            fillElement.style.width = Length.Percent(Mathf.Clamp01(ratio) * 100f);
            var fillTex = LoadUiTexture(isFocusBar ? "uikit_bar_focus" : "uikit_bar_hp");
            if (fillTex != null)
            {
                fillElement.style.backgroundImage = new StyleBackground(fillTex);
                fillElement.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            }
            else
            {
                fillElement.style.backgroundColor = isFocusBar ? UomdThemeTokens.GoldHi : UomdThemeTokens.CrimsonHi;
            }
            trackBg.Add(fillElement);

            var frameTex = LoadUiTexture("uikit_bar_frame");
            if (frameTex != null)
            {
                var frameOverlay = new VisualElement { pickingMode = PickingMode.Ignore };
                frameOverlay.style.position = Position.Absolute;
                frameOverlay.style.left = 0;
                frameOverlay.style.right = 0;
                frameOverlay.style.top = -2f;
                frameOverlay.style.bottom = -2f;
                frameOverlay.style.backgroundImage = new StyleBackground(frameTex);
                frameOverlay.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
                container.Add(frameOverlay);
            }

            return container;
        }

        /// <summary>
        /// Attaches hanging Sanctuary Bell &amp; chain corner ornaments (uikit_corner_bell_chain) to major modals.
        /// </summary>
        public static void AttachCornerBellChains(VisualElement card, bool reducedMotion)
        {
            if (card == null) return;
            var chainTex = LoadUiTexture("uikit_corner_bell_chain");
            if (chainTex == null) return;

            var leftBell = new VisualElement { name = "corner-bell-left", pickingMode = PickingMode.Ignore };
            leftBell.style.position = Position.Absolute;
            leftBell.style.left = -26f;
            leftBell.style.top = -18f;
            leftBell.style.width = 96f;
            leftBell.style.height = 128f;
            leftBell.style.backgroundImage = new StyleBackground(chainTex);
            leftBell.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            leftBell.style.transformOrigin = new TransformOrigin(Length.Percent(50), Length.Percent(8));
            card.Add(leftBell);

            var rightBell = new VisualElement { name = "corner-bell-right", pickingMode = PickingMode.Ignore };
            rightBell.style.position = Position.Absolute;
            rightBell.style.right = -26f;
            rightBell.style.top = -18f;
            rightBell.style.width = 96f;
            rightBell.style.height = 128f;
            rightBell.style.backgroundImage = new StyleBackground(chainTex);
            rightBell.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            rightBell.style.scale = new Scale(new Vector3(-1f, 1f, 1f));
            rightBell.style.transformOrigin = new TransformOrigin(Length.Percent(50), Length.Percent(8));
            card.Add(rightBell);

            if (!reducedMotion)
            {
                float t = 0f;
                card.schedule.Execute(() =>
                {
                    if (card.panel == null) return;
                    t += 0.033f;
                    float swing = Mathf.Sin(t * 1.8f) * 3.5f;
                    leftBell.style.rotate = new Rotate(swing);
                    rightBell.style.rotate = new Rotate(-swing);
                }).Every(33);
            }
        }

        private struct BiomePalette
        {
            public Color RayTint;
            public Color MistTint;
            public Color[] SparkTints;
            public Vector2 VxRange;
            public Vector2 VyRange;
            public int RayCount;
            public int MistCount;
        }

        private static BiomePalette ResolveBiomePalette(string locationOrMood)
        {
            string key = (locationOrMood ?? "").ToLowerInvariant();
            if (key.Contains("eclipse") || key.Contains("altar") || key.Contains("title"))
            {
                return new BiomePalette
                {
                    RayTint = new Color(1f, 0.45f, 0.56f, 0.14f),
                    MistTint = new Color(0.85f, 0.60f, 0.78f, 0.13f),
                    SparkTints = new[]
                    {
                        new Color(1f, 0.36f, 0.51f, 0.85f),
                        new Color(0.89f, 0.76f, 0.49f, 0.90f),
                        new Color(0.85f, 0.53f, 0.94f, 0.78f),
                        new Color(1f, 0.72f, 0.42f, 0.85f)
                    },
                    VxRange = new Vector2(-24f, 24f),
                    VyRange = new Vector2(-88f, -34f),
                    RayCount = 4,
                    MistCount = 3
                };
            }

            if (key.Contains("cathedral") || key.Contains("sanctuary") || key.Contains("shelter") || key.Contains("home"))
            {
                return new BiomePalette
                {
                    RayTint = new Color(1f, 0.87f, 0.60f, 0.13f),
                    MistTint = new Color(0.90f, 0.82f, 0.71f, 0.12f),
                    SparkTints = new[]
                    {
                        new Color(1f, 0.91f, 0.66f, 0.88f),
                        new Color(0.89f, 0.76f, 0.49f, 0.85f),
                        new Color(0.85f, 0.76f, 0.94f, 0.78f),
                        new Color(1f, 0.96f, 0.83f, 0.90f)
                    },
                    VxRange = new Vector2(-16f, 16f),
                    VyRange = new Vector2(-42f, -14f),
                    RayCount = 4,
                    MistCount = 3
                };
            }

            if (key.Contains("bridge") || key.Contains("crossing") || key.Contains("mountain"))
            {
                return new BiomePalette
                {
                    RayTint = new Color(0.78f, 0.72f, 0.91f, 0.12f),
                    MistTint = new Color(0.72f, 0.66f, 0.85f, 0.14f),
                    SparkTints = new[]
                    {
                        new Color(0.85f, 0.80f, 0.94f, 0.85f),
                        new Color(0.89f, 0.76f, 0.49f, 0.85f),
                        new Color(1f, 0.54f, 0.40f, 0.80f),
                        new Color(1f, 1f, 1f, 0.80f)
                    },
                    VxRange = new Vector2(28f, 82f),
                    VyRange = new Vector2(-54f, -18f),
                    RayCount = 3,
                    MistCount = 4
                };
            }

            // Default: forest_whispering_ash
            return new BiomePalette
            {
                RayTint = new Color(0.91f, 0.85f, 0.71f, 0.12f),
                MistTint = new Color(0.79f, 0.71f, 0.89f, 0.13f),
                SparkTints = new[]
                {
                    new Color(0.90f, 0.87f, 0.96f, 0.84f),
                    new Color(0.79f, 0.71f, 0.89f, 0.80f),
                    new Color(0.95f, 0.87f, 0.68f, 0.88f),
                    new Color(0.61f, 0.91f, 0.76f, 0.76f)
                },
                VxRange = new Vector2(-24f, 20f),
                VyRange = new Vector2(-46f, -14f),
                RayCount = 4,
                MistCount = 3
            };
        }

        private struct ParticleState
        {
            public VisualElement Element;
            public float X;
            public float Y;
            public float Vx;
            public float Vy;
            public float Age;
            public float Lifespan;
            public float BaseScale;
            public float MaxAlpha;
            public float Phase;
        }

        private struct RayState
        {
            public VisualElement Element;
            public float BaseX;
            public float BaseAngle;
            public float BaseAlpha;
            public float Speed;
            public float Phase;
            public float Dir;
        }

        private struct MistState
        {
            public VisualElement Element;
            public float BaseY;
            public float BaseAlpha;
            public float BaseScaleX;
            public float BaseScaleY;
            public float Speed;
            public float Phase;
            public float Dir;
        }

        /// <summary>
        /// Brings any background plate, story location, battlefield, or hub screen to life with multi-axis camera
        /// breathing, swaying atmospheric light shafts, drifting Gothic mist veils, and rising ash/ember motes.
        /// </summary>
        public static VisualElement AttachLivingBackdrop(
            VisualElement parent,
            VisualElement bgImage,
            string locationOrMood,
            bool reducedMotion,
            float intensity = 1f)
        {
            var fxLayer = new VisualElement { name = "living-backdrop-fx", pickingMode = PickingMode.Ignore };
            fxLayer.style.position = Position.Absolute;
            fxLayer.style.left = fxLayer.style.right = fxLayer.style.top = fxLayer.style.bottom = 0;
            fxLayer.style.overflow = Overflow.Hidden;
            parent.Add(fxLayer);

            if (bgImage != null)
            {
                bgImage.style.scale = new Scale(new Vector3(1.05f, 1.05f, 1f));
            }

            if (reducedMotion) return fxLayer;

            var palette = ResolveBiomePalette(locationOrMood);
            float mult = Mathf.Clamp(intensity, 0.4f, 1.6f);

            // 1. Swaying atmospheric light shafts
            var rays = new RayState[palette.RayCount];
            for (int i = 0; i < rays.Length; i++)
            {
                float spacing = UomdScreenKit.RefWidth / Mathf.Max(1, rays.Length);
                float bx = spacing * (i + 0.5f);
                float w = 340f + (i % 2) * 80f;
                float h = 1220f;
                var ray = CreateTintedSprite("vfx_aura_soft", w, h, palette.RayTint);
                ray.style.position = Position.Absolute;
                ray.style.left = bx - w * 0.5f;
                ray.style.top = -140f;
                float baseAngle = -14f + i * 7f;
                float baseAlpha = palette.RayTint.a + (i % 2) * 0.04f;
                ray.style.rotate = new Rotate(baseAngle);
                ray.style.opacity = baseAlpha;
                fxLayer.Add(ray);
                rays[i] = new RayState
                {
                    Element = ray,
                    BaseX = bx - w * 0.5f,
                    BaseAngle = baseAngle,
                    BaseAlpha = baseAlpha,
                    Speed = 0.55f + i * 0.14f,
                    Phase = i * 1.3f,
                    Dir = i % 2 == 0 ? 1f : -1f
                };
            }

            // 2. Multi-layered drifting Gothic mist veils
            var mists = new MistState[palette.MistCount];
            for (int i = 0; i < mists.Length; i++)
            {
                float mw = 1100f + i * 180f;
                float mh = 360f + i * 60f;
                float by = 420f + i * 165f;
                var mist = CreateTintedSprite("vfx_mist_cloud", mw, mh, palette.MistTint);
                mist.style.position = Position.Absolute;
                mist.style.left = (UomdScreenKit.RefWidth - mw) * 0.5f;
                mist.style.top = by - mh * 0.5f;
                float baseAlpha = palette.MistTint.a + (i % 2) * 0.04f;
                mist.style.opacity = baseAlpha;
                fxLayer.Add(mist);
                mists[i] = new MistState
                {
                    Element = mist,
                    BaseY = by - mh * 0.5f,
                    BaseAlpha = baseAlpha,
                    BaseScaleX = 1.35f + i * 0.15f,
                    BaseScaleY = 0.85f + i * 0.1f,
                    Speed = 0.36f + i * 0.09f,
                    Phase = i * 2.1f,
                    Dir = i % 2 == 0 ? 1f : -1f
                };
            }

            // 3. Continuous rising ash motes & golden/crimson embers
            const int particleCount = 22;
            var particles = new ParticleState[particleCount];
            uint seed = 0x9E3779B9u;
            float NextRand()
            {
                seed ^= seed << 13;
                seed ^= seed >> 17;
                seed ^= seed << 5;
                return (seed & 0x00FFFFFF) / (float)0x01000000;
            }

            void ResetParticle(ref ParticleState p, bool randomY)
            {
                p.X = NextRand() * UomdScreenKit.RefWidth;
                p.Y = randomY ? (160f + NextRand() * (UomdScreenKit.RefHeight - 140f)) : (UomdScreenKit.RefHeight + 24f + NextRand() * 60f);
                p.Vx = Mathf.Lerp(palette.VxRange.x, palette.VxRange.y, NextRand()) * mult;
                p.Vy = Mathf.Lerp(palette.VyRange.x, palette.VyRange.y, NextRand()) * mult;
                p.Lifespan = 5.2f + NextRand() * 4.4f;
                p.Age = randomY ? NextRand() * p.Lifespan : 0f;
                p.BaseScale = 0.45f + NextRand() * 0.85f;
                p.MaxAlpha = 0.38f + NextRand() * 0.42f;
                p.Phase = NextRand() * Mathf.PI * 2f;
            }

            for (int i = 0; i < particleCount; i++)
            {
                Color tint = palette.SparkTints[i % palette.SparkTints.Length];
                string spriteName = (i % 3 == 0) ? "vfx_star_spark" : (i % 3 == 1 ? "vfx_diamond_glow" : "vfx_flare");
                float sz = (i % 3 == 0) ? 28f : 22f;
                var el = CreateTintedSprite(spriteName, sz, sz, tint);
                el.style.position = Position.Absolute;
                fxLayer.Add(el);
                var st = new ParticleState { Element = el };
                ResetParticle(ref st, randomY: true);
                particles[i] = st;
            }

            float elapsed = 0f;
            const float dt = 0.033f; // ~30 Hz UI visual update keeps CPU/GPU overhead tiny while looking smooth
            fxLayer.schedule.Execute(() =>
            {
                if (fxLayer.panel == null) return;
                elapsed += dt;

                // Camera breathing on background plate
                if (bgImage != null)
                {
                    float camPhase = elapsed * 0.36f;
                    float s = 1.055f + 0.032f * mult * (0.5f + 0.5f * Mathf.Sin(camPhase));
                    float dx = Mathf.Sin(camPhase * 0.85f) * 22f * mult;
                    float dy = Mathf.Cos(camPhase * 0.65f) * 10f * mult;
                    bgImage.style.scale = new Scale(new Vector3(s, s, 1f));
                    bgImage.style.translate = new Translate(dx, dy);
                }

                // Update rays
                for (int i = 0; i < rays.Length; i++)
                {
                    var r = rays[i];
                    float w = Mathf.Sin(elapsed * r.Speed + r.Phase);
                    r.Element.style.left = r.BaseX + w * 48f * r.Dir;
                    r.Element.style.rotate = new Rotate(r.BaseAngle + w * 5.5f * r.Dir);
                    r.Element.style.opacity = Mathf.Clamp01(r.BaseAlpha + (0.5f + 0.5f * w) * 0.08f);
                }

                // Update mists
                for (int i = 0; i < mists.Length; i++)
                {
                    var m = mists[i];
                    float w = Mathf.Sin(elapsed * m.Speed + m.Phase);
                    m.Element.style.translate = new Translate(w * 210f * m.Dir, Mathf.Cos(elapsed * m.Speed * 0.7f + m.Phase) * 12f);
                    m.Element.style.scale = new Scale(new Vector3(m.BaseScaleX * (1f + 0.07f * w), m.BaseScaleY, 1f));
                    m.Element.style.opacity = Mathf.Clamp01(m.BaseAlpha + (0.5f + 0.5f * w) * 0.06f);
                }

                // Update rising ash/ember motes
                for (int i = 0; i < particles.Length; i++)
                {
                    var p = particles[i];
                    p.Age += dt;
                    if (p.Age >= p.Lifespan || p.Y < -30f)
                    {
                        ResetParticle(ref p, randomY: false);
                    }
                    else
                    {
                        p.X += (p.Vx + Mathf.Sin(elapsed * 1.6f + p.Phase) * 14f) * dt;
                        p.Y += p.Vy * dt;
                    }

                    float lifeRatio = Mathf.Clamp01(p.Age / p.Lifespan);
                    float fade = lifeRatio < 0.2f ? (lifeRatio / 0.2f) : (1f - (lifeRatio - 0.2f) / 0.8f);
                    float twinkle = 0.75f + 0.25f * Mathf.Sin(elapsed * 4.2f + p.Phase);
                    p.Element.style.left = p.X;
                    p.Element.style.top = p.Y;
                    p.Element.style.opacity = Mathf.Clamp01(p.MaxAlpha * fade * twinkle);
                    float sc = p.BaseScale * (1f - lifeRatio * 0.35f);
                    p.Element.style.scale = new Scale(new Vector3(sc, sc, 1f));
                    particles[i] = p;
                }
            }).Every(33);

            return fxLayer;
        }

        /// <summary>
        /// #1 Approved UI Animation: Rotating Black-Sun Eclipse Corona &amp; Counter-Rotating Astronomical Rune Ring.
        /// </summary>
        public static VisualElement CreateEclipseCorona(
            VisualElement parent,
            float centerX,
            float centerY,
            float radius,
            bool reducedMotion,
            bool includeDisc = false,
            bool leftAnchored = false)
        {
            float boxSize = radius * 3.0f;
            var root = new VisualElement { name = "eclipse-corona", pickingMode = PickingMode.Ignore };
            root.style.width = boxSize;
            root.style.height = boxSize;
            if (leftAnchored) UomdScreenKit.AtLeft(root, centerX, centerY);
            else UomdScreenKit.Centered(root, centerX, centerY);
            parent.Add(root);

            // 1. Soft breathing radial aura + bespoke Whisk/Production v001 corona ring + 8-frame sprite loop
            var aura = CreateTintedSprite("uikit_vfx_corona_ring", radius * 2.55f, radius * 2.55f, Color.white);
            aura.style.opacity = 0.72f;
            UomdScreenKit.Centered(aura, 0f, boxSize * 0.5f);
            root.Add(aura);

            var coronaFrames = CreateSpriteSheetLoop(root, "anim_corona", 8, radius * 2.4f, radius * 2.4f, 8f, reducedMotion);
            coronaFrames.style.opacity = 0.78f;
            UomdScreenKit.Centered(coronaFrames, 0f, boxSize * 0.5f);

            var runeTex = CreateTintedSprite("vfx_rune_ring", radius * 2.35f, radius * 2.35f, new Color(0.79f, 0.71f, 0.89f, 0.28f));
            UomdScreenKit.Centered(runeTex, 0f, boxSize * 0.5f);
            root.Add(runeTex);

            // 2. Clockwise rotating 24-ray solar corona wheel
            var rayWheel = new VisualElement { pickingMode = PickingMode.Ignore };
            rayWheel.style.width = boxSize;
            rayWheel.style.height = boxSize;
            rayWheel.style.position = Position.Absolute;
            rayWheel.style.left = rayWheel.style.top = 0;
            rayWheel.generateVisualContent += ctx =>
            {
                var p = ctx.painter2D;
                float cx = boxSize * 0.5f, cy = boxSize * 0.5f;
                const int rayCount = 24;
                for (int i = 0; i < rayCount; i++)
                {
                    float a = (i * Mathf.PI * 2f) / rayCount;
                    bool isMajor = (i % 2) == 0;
                    float rInner = radius * 0.86f;
                    float rOuter = radius * (isMajor ? 1.32f : 1.14f);
                    float spread = isMajor ? 0.052f : 0.030f;
                    p.BeginPath();
                    p.MoveTo(new Vector2(cx + Mathf.Cos(a - spread) * rInner, cy + Mathf.Sin(a - spread) * rInner));
                    p.LineTo(new Vector2(cx + Mathf.Cos(a) * rOuter, cy + Mathf.Sin(a) * rOuter));
                    p.LineTo(new Vector2(cx + Mathf.Cos(a + spread) * rInner, cy + Mathf.Sin(a + spread) * rInner));
                    p.ClosePath();
                    p.fillColor = isMajor
                        ? new Color(UomdThemeTokens.GoldHi.r, UomdThemeTokens.GoldHi.g, UomdThemeTokens.GoldHi.b, 0.32f)
                        : new Color(UomdThemeTokens.Gold.r, UomdThemeTokens.Gold.g, UomdThemeTokens.Gold.b, 0.18f);
                    p.Fill();
                }

                p.BeginPath();
                p.Arc(new Vector2(cx, cy), radius * 0.94f, 0f, 360f);
                p.lineWidth = 2.4f;
                p.strokeColor = new Color(UomdThemeTokens.GoldHi.r, UomdThemeTokens.GoldHi.g, UomdThemeTokens.GoldHi.b, 0.68f);
                p.Stroke();
            };
            root.Add(rayWheel);

            // 3. Counter-rotating outer 16-tick astronomical rune ring
            var runeRing = new VisualElement { pickingMode = PickingMode.Ignore };
            runeRing.style.width = boxSize;
            runeRing.style.height = boxSize;
            runeRing.style.position = Position.Absolute;
            runeRing.style.left = runeRing.style.top = 0;
            runeRing.generateVisualContent += ctx =>
            {
                var p = ctx.painter2D;
                float cx = boxSize * 0.5f, cy = boxSize * 0.5f;
                float outerR = radius * 1.18f;

                p.BeginPath();
                p.Arc(new Vector2(cx, cy), outerR, 0f, 360f);
                p.lineWidth = 1.5f;
                p.strokeColor = new Color(UomdThemeTokens.Silver.r, UomdThemeTokens.Silver.g, UomdThemeTokens.Silver.b, 0.40f);
                p.Stroke();

                p.BeginPath();
                p.Arc(new Vector2(cx, cy), outerR + 10f, 0f, 360f);
                p.lineWidth = 1f;
                p.strokeColor = new Color(UomdThemeTokens.Gold.r, UomdThemeTokens.Gold.g, UomdThemeTokens.Gold.b, 0.26f);
                p.Stroke();

                for (int i = 0; i < 16; i++)
                {
                    float a = (i * Mathf.PI * 2f) / 16f;
                    bool cardinal = (i % 4) == 0;
                    float r0 = outerR - (cardinal ? 12f : 5f);
                    float r1 = outerR + (cardinal ? 12f : 5f);
                    p.BeginPath();
                    p.MoveTo(new Vector2(cx + Mathf.Cos(a) * r0, cy + Mathf.Sin(a) * r0));
                    p.LineTo(new Vector2(cx + Mathf.Cos(a) * r1, cy + Mathf.Sin(a) * r1));
                    p.lineWidth = cardinal ? 2.2f : 1.2f;
                    p.strokeColor = cardinal
                        ? new Color(UomdThemeTokens.GoldHi.r, UomdThemeTokens.GoldHi.g, UomdThemeTokens.GoldHi.b, 0.86f)
                        : new Color(UomdThemeTokens.Silver.r, UomdThemeTokens.Silver.g, UomdThemeTokens.Silver.b, 0.42f);
                    p.Stroke();

                    if (cardinal)
                    {
                        float dx = cx + Mathf.Cos(a) * (outerR + 18f);
                        float dy = cy + Mathf.Sin(a) * (outerR + 18f);
                        p.BeginPath();
                        p.MoveTo(new Vector2(dx, dy - 5f));
                        p.LineTo(new Vector2(dx + 5f, dy));
                        p.LineTo(new Vector2(dx, dy + 5f));
                        p.LineTo(new Vector2(dx - 5f, dy));
                        p.ClosePath();
                        p.fillColor = new Color(UomdThemeTokens.GoldHi.r, UomdThemeTokens.GoldHi.g, UomdThemeTokens.GoldHi.b, 0.92f);
                        p.Fill();
                    }
                }
            };
            root.Add(runeRing);

            if (includeDisc)
            {
                var disc = new VisualElement { pickingMode = PickingMode.Ignore };
                disc.style.width = boxSize;
                disc.style.height = boxSize;
                disc.style.position = Position.Absolute;
                disc.style.left = disc.style.top = 0;
                disc.generateVisualContent += ctx =>
                {
                    var p = ctx.painter2D;
                    float cx = boxSize * 0.5f, cy = boxSize * 0.5f;
                    p.BeginPath();
                    p.Arc(new Vector2(cx, cy), radius * 0.85f, 0f, 360f);
                    p.fillColor = new Color(0.024f, 0.012f, 0.043f, 0.94f);
                    p.Fill();
                    p.lineWidth = 3f;
                    p.strokeColor = new Color(UomdThemeTokens.GoldHi.r, UomdThemeTokens.GoldHi.g, UomdThemeTokens.GoldHi.b, 0.88f);
                    p.Stroke();
                };
                root.Add(disc);
            }

            if (!reducedMotion)
            {
                float t = 0f;
                root.schedule.Execute(() =>
                {
                    if (root.panel == null) return;
                    t += 0.033f;
                    rayWheel.style.rotate = new Rotate(t * 10.5f);
                    runeRing.style.rotate = new Rotate(-t * 7.2f);
                    runeTex.style.rotate = new Rotate(-t * 4.5f);
                    float pulse = 1f + 0.12f * (0.5f + 0.5f * Mathf.Sin(t * 2.2f));
                    aura.style.scale = new Scale(new Vector3(pulse, pulse, 1f));
                }).Every(33);
            }

            return root;
        }

        /// <summary>
        /// Astronomical degree ring with cardinal ticks around the studio emblem (StudioScene.celestialRing).
        /// </summary>
        public static VisualElement CreateCelestialRing(
            VisualElement parent,
            float centerX,
            float centerY,
            float radius,
            Color color,
            int ticks,
            float rotateSpeedDegPerSec,
            bool reducedMotion)
        {
            float size = (radius + 20f) * 2f;
            var ring = new VisualElement { pickingMode = PickingMode.Ignore };
            ring.style.width = size;
            ring.style.height = size;
            UomdScreenKit.Centered(ring, centerX, centerY);
            parent.Add(ring);

            ring.generateVisualContent += ctx =>
            {
                var p = ctx.painter2D;
                float cx = size * 0.5f, cy = size * 0.5f;
                p.BeginPath();
                p.Arc(new Vector2(cx, cy), radius, 0f, 360f);
                p.lineWidth = 1.6f;
                p.strokeColor = new Color(color.r, color.g, color.b, 0.38f);
                p.Stroke();

                for (int i = 0; i < ticks; i++)
                {
                    float rad = (i * Mathf.PI * 2f) / ticks;
                    bool major = (i % 3) == 0;
                    float r0 = major ? radius - 12f : radius - 6f;
                    float r1 = major ? radius + 12f : radius + 6f;
                    p.BeginPath();
                    p.MoveTo(new Vector2(cx + Mathf.Cos(rad) * r0, cy + Mathf.Sin(rad) * r0));
                    p.LineTo(new Vector2(cx + Mathf.Cos(rad) * r1, cy + Mathf.Sin(rad) * r1));
                    p.lineWidth = major ? 2.1f : 1.2f;
                    p.strokeColor = major
                        ? new Color(UomdThemeTokens.GoldHi.r, UomdThemeTokens.GoldHi.g, UomdThemeTokens.GoldHi.b, 0.78f)
                        : new Color(color.r, color.g, color.b, 0.44f);
                    p.Stroke();
                }
            };

            if (!reducedMotion && Mathf.Abs(rotateSpeedDegPerSec) > 0.01f)
            {
                float angle = 0f;
                ring.schedule.Execute(() =>
                {
                    if (ring.panel == null) return;
                    angle += rotateSpeedDegPerSec * 0.033f;
                    ring.style.rotate = new Rotate(angle);
                }).Every(33);
            }

            return ring;
        }

        /// <summary>
        /// #2 Approved UI Animation: Swinging Fractured Sanctuary Bell Pendulum &amp; Acoustic Shockwave Rings.
        /// </summary>
        public static VisualElement CreateSwingingBell(
            VisualElement parent,
            float centerX,
            float centerY,
            float scale,
            bool reducedMotion,
            bool leftAnchored = false)
        {
            const float boxW = 140f, boxH = 120f;
            var root = new VisualElement { name = "swinging-bell", pickingMode = PickingMode.Ignore };
            root.style.width = boxW;
            root.style.height = boxH;
            if (leftAnchored) UomdScreenKit.AtLeft(root, centerX, centerY);
            else UomdScreenKit.Centered(root, centerX, centerY);
            root.style.scale = new Scale(new Vector3(scale, scale, 1f));
            parent.Add(root);

            // Shockwave ring sprite behind the bell
            var wave = CreateTintedSprite("vfx_ring_sharp", 84f, 54f, new Color(UomdThemeTokens.GoldHi.r, UomdThemeTokens.GoldHi.g, UomdThemeTokens.GoldHi.b, 0f));
            UomdScreenKit.Centered(wave, 0f, 64f);
            root.Add(wave);

            // 8-frame Whisk / Imagen Sanctuary Bell & Acoustic Shockwave sprite-sheet loop
            var bellAnim = CreateSpriteSheetLoop(root, "anim_bell", 8, 96f, 96f, 8f, reducedMotion);
            bellAnim.style.opacity = 0.88f;
            UomdScreenKit.Centered(bellAnim, 0f, 52f);

            // Top suspension bracket
            var bracket = new VisualElement { pickingMode = PickingMode.Ignore };
            bracket.style.width = boxW;
            bracket.style.height = boxH;
            bracket.style.position = Position.Absolute;
            bracket.generateVisualContent += ctx =>
            {
                var p = ctx.painter2D;
                float cx = boxW * 0.5f, topY = 34f;
                p.BeginPath();
                p.MoveTo(new Vector2(cx - 18f, topY));
                p.LineTo(new Vector2(cx + 18f, topY));
                p.lineWidth = 2.5f;
                p.strokeColor = new Color(UomdThemeTokens.Gold.r, UomdThemeTokens.Gold.g, UomdThemeTokens.Gold.b, 0.82f);
                p.Stroke();

                p.BeginPath();
                p.Arc(new Vector2(cx, topY - 9f), 5f, 0f, 360f);
                p.lineWidth = 2f;
                p.strokeColor = new Color(UomdThemeTokens.GoldHi.r, UomdThemeTokens.GoldHi.g, UomdThemeTokens.GoldHi.b, 0.88f);
                p.Stroke();
            };
            root.Add(bracket);

            // Swinging bell body
            var pendulum = new VisualElement { pickingMode = PickingMode.Ignore };
            pendulum.style.width = boxW;
            pendulum.style.height = boxH;
            pendulum.style.position = Position.Absolute;
            pendulum.style.transformOrigin = new TransformOrigin(Length.Percent(50), new Length(34f, LengthUnit.Pixel));
            pendulum.generateVisualContent += ctx =>
            {
                var p = ctx.painter2D;
                float cx = boxW * 0.5f, py = 34f;
                p.BeginPath();
                p.MoveTo(new Vector2(cx - 14f, py + 4f));
                p.LineTo(new Vector2(cx + 14f, py + 4f));
                p.LineTo(new Vector2(cx + 20f, py + 26f));
                p.LineTo(new Vector2(cx + 28f, py + 38f));
                p.LineTo(new Vector2(cx - 28f, py + 38f));
                p.LineTo(new Vector2(cx - 20f, py + 26f));
                p.ClosePath();
                p.fillColor = new Color(0.15f, 0.10f, 0.08f, 0.96f);
                p.Fill();
                p.lineWidth = 2.2f;
                p.strokeColor = new Color(UomdThemeTokens.GoldHi.r, UomdThemeTokens.GoldHi.g, UomdThemeTokens.GoldHi.b, 0.92f);
                p.Stroke();

                // Clapper
                p.BeginPath();
                p.Arc(new Vector2(cx, py + 42f), 5.2f, 0f, 360f);
                p.fillColor = new Color(UomdThemeTokens.GoldHi.r, UomdThemeTokens.GoldHi.g, UomdThemeTokens.GoldHi.b, 0.96f);
                p.Fill();

                // Glowing amber fracture fissure inside the bell
                p.BeginPath();
                p.MoveTo(new Vector2(cx + 4f, py + 10f));
                p.LineTo(new Vector2(cx - 3f, py + 21f));
                p.LineTo(new Vector2(cx + 5f, py + 28f));
                p.LineTo(new Vector2(cx - 1f, py + 36f));
                p.lineWidth = 2.2f;
                p.strokeColor = new Color(1f, 0.62f, 0.26f, 0.92f);
                p.Stroke();
            };
            root.Add(pendulum);

            if (!reducedMotion)
            {
                float t = 0f;
                root.schedule.Execute(() =>
                {
                    if (root.panel == null) return;
                    t += 0.033f;
                    float swing = Mathf.Sin(t * 2.0f) * 6.5f;
                    pendulum.style.rotate = new Rotate(swing);

                    // Shockwave ring expands every 2.8 seconds
                    float cycle = (t % 2.8f) / 1.35f;
                    if (cycle <= 1f)
                    {
                        float s = Mathf.Lerp(0.6f, 3.2f, cycle);
                        wave.style.scale = new Scale(new Vector3(s, s * 0.65f, 1f));
                        wave.style.opacity = (1f - cycle) * 0.65f;
                    }
                    else
                    {
                        wave.style.opacity = 0f;
                    }
                }).Every(33);
            }

            return root;
        }

        /// <summary>
        /// Builds a symmetrical Gothic ornamental divider using the bespoke Whisk / Production v001 divider_bell_ornate
        /// (uikit_divider_bell), Kenney fantasy fade-dividers, central diamond filigree, and an optional sweeping golden shimmer glint.
        /// </summary>
        public static VisualElement CreateOrnateDivider(
            VisualElement parent,
            float width,
            Color tint,
            bool withShimmer = false,
            bool reducedMotion = false)
        {
            var root = new VisualElement { name = "ornate-divider", pickingMode = PickingMode.Ignore };
            root.style.width = width;
            root.style.height = 44f;
            parent.Add(root);

            var bellDivTex = LoadUiTexture("uikit_divider_bell");
            if (bellDivTex != null)
            {
                var bellDiv = new VisualElement { pickingMode = PickingMode.Ignore };
                bellDiv.style.width = Mathf.Min(width, 620f);
                bellDiv.style.height = 42f;
                UomdScreenKit.Centered(bellDiv, 0f, 22f);
                bellDiv.style.backgroundImage = new StyleBackground(bellDivTex);
                bellDiv.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
                bellDiv.style.opacity = 0.92f;
                root.Add(bellDiv);
            }
            else
            {
                float wingW = Mathf.Max(80f, (width - 44f) * 0.5f);
                var leftWing = CreateTintedSprite("divider_fade_03", wingW, 24f, tint);
                leftWing.style.position = Position.Absolute;
                leftWing.style.left = 0;
                leftWing.style.top = 10f;
                root.Add(leftWing);

                var rightWing = CreateTintedSprite("divider_fade_03", wingW, 24f, tint);
                rightWing.style.position = Position.Absolute;
                rightWing.style.right = 0;
                rightWing.style.top = 10f;
                rightWing.style.scale = new Scale(new Vector3(-1f, 1f, 1f));
                root.Add(rightWing);

                var centerGem = CreateTintedSprite("vfx_compass_star", 34f, 34f, UomdThemeTokens.GoldHi);
                UomdScreenKit.Centered(centerGem, 0f, 22f);
                root.Add(centerGem);
            }

            if (withShimmer && !reducedMotion)
            {
                var glint = CreateTintedSprite("vfx_flare", 140f, 22f, new Color(1f, 0.95f, 0.78f, 0.85f));
                glint.style.position = Position.Absolute;
                glint.style.top = 11f;
                glint.style.left = 0f;
                root.Add(glint);

                float t = 0f;
                root.schedule.Execute(() =>
                {
                    if (root.panel == null) return;
                    t += 0.033f;
                    float u = 0.5f + 0.5f * Mathf.Sin(t * 1.4f);
                    glint.style.left = Mathf.Lerp(10f, width - 150f, u);
                }).Every(33);
            }

            return root;
        }

        /// <summary>
        /// #3 Approved UI Animation: Wax-Seal CTA Ignition Burst on tap.
        /// </summary>
        public static void TriggerWaxSealBurst(VisualElement parent, float x, float y, bool reducedMotion)
        {
            if (reducedMotion || parent == null) return;
            var burst = new VisualElement { pickingMode = PickingMode.Ignore };
            burst.style.position = Position.Absolute;
            burst.style.left = x;
            burst.style.top = y;
            burst.style.width = 0;
            burst.style.height = 0;
            parent.Add(burst);

            var ring = CreateTintedSprite("vfx_ring_sharp", 96f, 96f, UomdThemeTokens.GoldHi);
            ring.style.position = Position.Absolute;
            ring.style.left = -48f;
            ring.style.top = -48f;
            burst.Add(ring);

            const int sparkCount = 10;
            var sparks = new VisualElement[sparkCount];
            var dirs = new Vector2[sparkCount];
            for (int i = 0; i < sparkCount; i++)
            {
                float a = (i * Mathf.PI * 2f) / sparkCount;
                dirs[i] = new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * (85f + (i % 3) * 28f);
                Color c = (i % 2 == 0) ? UomdThemeTokens.GoldHi : UomdThemeTokens.CrimsonHi;
                var sp = CreateTintedSprite("vfx_star_spark", 28f, 28f, c);
                sp.style.position = Position.Absolute;
                sp.style.left = -14f;
                sp.style.top = -14f;
                burst.Add(sp);
                sparks[i] = sp;
            }

            float t = 0f;
            burst.schedule.Execute(() =>
            {
                if (burst.panel == null) return;
                t += 0.033f;
                float u = Mathf.Clamp01(t / 0.62f);
                float ease = 1f - Mathf.Pow(1f - u, 3f);
                ring.style.scale = new Scale(new Vector3(0.6f + ease * 3.2f, 0.6f + ease * 1.8f, 1f));
                ring.style.opacity = 1f - ease;
                for (int i = 0; i < sparkCount; i++)
                {
                    sparks[i].style.translate = new Translate(dirs[i].x * ease, dirs[i].y * ease - 14f * ease);
                    sparks[i].style.opacity = 1f - u;
                    float sc = Mathf.Max(0.1f, 1f - u * 0.8f);
                    sparks[i].style.scale = new Scale(new Vector3(sc, sc, 1f));
                }

                if (u >= 1f) burst.RemoveFromHierarchy();
            }).Every(33);
        }

        /// <summary>
        /// #4 Approved UI Animation: Cracked Pocket Watch &amp; Sanctuary Bell Loading Spinner.
        /// </summary>
        public static VisualElement CreateCrackedWatchSpinner(
            VisualElement parent,
            float centerX,
            float centerY,
            float scale,
            bool reducedMotion)
        {
            const float size = 180f;
            var root = new VisualElement { name = "cracked-watch-spinner", pickingMode = PickingMode.Ignore };
            root.style.width = size;
            root.style.height = size;
            UomdScreenKit.Centered(root, centerX, centerY);
            root.style.scale = new Scale(new Vector3(scale, scale, 1f));
            parent.Add(root);

            var glow = CreateTintedSprite("vfx_aura_soft", 170f, 170f, new Color(UomdThemeTokens.Gold.r, UomdThemeTokens.Gold.g, UomdThemeTokens.Gold.b, 0.35f));
            UomdScreenKit.Centered(glow, 0f, size * 0.5f);
            root.Add(glow);

            var outerRune = CreateTintedSprite("vfx_rune_ring", 156f, 156f, new Color(UomdThemeTokens.GoldHi.r, UomdThemeTokens.GoldHi.g, UomdThemeTokens.GoldHi.b, 0.55f));
            UomdScreenKit.Centered(outerRune, 0f, size * 0.5f);
            root.Add(outerRune);

            var watchAnim = CreateSpriteSheetLoop(root, "anim_watch", 8, 148f, 148f, 8f, reducedMotion);
            watchAnim.style.opacity = 0.85f;
            UomdScreenKit.Centered(watchAnim, 0f, size * 0.5f);

            float watchAngle = 0f;
            var dial = new VisualElement { pickingMode = PickingMode.Ignore };
            dial.style.width = size;
            dial.style.height = size;
            dial.style.position = Position.Absolute;
            dial.generateVisualContent += ctx =>
            {
                var p = ctx.painter2D;
                float cx = size * 0.5f, cy = size * 0.5f;

                // Watch bezel & obsidian face
                p.BeginPath();
                p.Arc(new Vector2(cx, cy), 50f, 0f, 360f);
                p.fillColor = new Color(0.047f, 0.027f, 0.078f, 0.95f);
                p.Fill();
                p.lineWidth = 3.8f;
                p.strokeColor = new Color(UomdThemeTokens.GoldHi.r, UomdThemeTokens.GoldHi.g, UomdThemeTokens.GoldHi.b, 0.92f);
                p.Stroke();

                // Glowing amber fracture lines across watch glass
                p.BeginPath();
                p.MoveTo(new Vector2(cx - 18f, cy - 34f));
                p.LineTo(new Vector2(cx + 4f, cy - 8f));
                p.LineTo(new Vector2(cx + 26f, cy - 20f));
                p.MoveTo(new Vector2(cx + 4f, cy - 8f));
                p.LineTo(new Vector2(cx - 12f, cy + 24f));
                p.LineTo(new Vector2(cx + 15f, cy + 36f));
                p.lineWidth = 1.8f;
                p.strokeColor = new Color(1f, 0.64f, 0.28f, 0.85f);
                p.Stroke();

                // Rotating minute & hour hands
                float minRad = watchAngle * Mathf.Deg2Rad;
                float hrRad = (watchAngle * 0.16f) * Mathf.Deg2Rad;

                p.BeginPath();
                p.MoveTo(new Vector2(cx, cy));
                p.LineTo(new Vector2(cx + Mathf.Sin(hrRad) * 26f, cy - Mathf.Cos(hrRad) * 26f));
                p.lineWidth = 3.4f;
                p.strokeColor = UomdThemeTokens.Gold;
                p.Stroke();

                p.BeginPath();
                p.MoveTo(new Vector2(cx, cy));
                p.LineTo(new Vector2(cx + Mathf.Sin(minRad) * 38f, cy - Mathf.Cos(minRad) * 38f));
                p.lineWidth = 2.4f;
                p.strokeColor = new Color(1f, 0.94f, 0.77f, 0.98f);
                p.Stroke();

                p.BeginPath();
                p.Arc(new Vector2(cx, cy), 4.5f, 0f, 360f);
                p.fillColor = UomdThemeTokens.GoldHi;
                p.Fill();
            };
            root.Add(dial);

            if (!reducedMotion)
            {
                root.schedule.Execute(() =>
                {
                    if (root.panel == null) return;
                    watchAngle += 5.4f;
                    outerRune.style.rotate = new Rotate(-watchAngle * 0.22f);
                    dial.MarkDirtyRepaint();
                }).Every(33);
            }

            return root;
        }
    }
}
