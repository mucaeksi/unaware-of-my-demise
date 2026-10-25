using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core.Vfx;

namespace Uomd.Scenes
{
    /// <summary>
    /// Draws data-driven VFX presets (content vfx/vfx_presets.json) on UI Toolkit layers, so effects sit between and above
    /// the battle's UI Toolkit units like the PIXI layers did (ground under units, fx over them, overlay above the HUD).
    /// VfxTimeline compiles each preset into nodes with closed-form states; this class only creates, updates and removes
    /// their elements. Time advances only through Tick, so hit-stop slows the effects like the rest of the battle.
    /// shortcut: UI Toolkit has no additive blending; "add"/"screen" elements draw with normal alpha (bright cores on a dark
    /// stage read close to the PIXI look). A RenderTexture/URP pass can restore additive light later.
    /// </summary>
    public sealed class UomdVfxPlayer
    {
        private static readonly Dictionary<string, Texture2D> Textures = new Dictionary<string, Texture2D>(StringComparer.Ordinal);

        private readonly Dictionary<string, VisualElement> _layers;
        private readonly Func<VfxEnvironment> _environment;
        private readonly List<Active> _active = new List<Active>();
        private readonly System.Random _random = new System.Random();

        private sealed class Active
        {
            public VfxPlayback Playback;
            public double TimeMs;
            public int NextCue;
            public VisualElement[] Elements;
            public AwaitableCompletionSource Done;
            public Action<string, double, double> OnCue;
        }

        public UomdVfxPlayer(VisualElement ground, VisualElement fx, VisualElement overlay, Func<VfxEnvironment> environment)
        {
            _layers = new Dictionary<string, VisualElement>(StringComparer.Ordinal) { ["ground"] = ground, ["fx"] = fx, ["overlay"] = overlay };
            _environment = environment;
        }

        public VfxPack Pack { get; set; }
        /// <summary>Multiplies elapsed time (hit-stop sets it near zero for a few real-time frames).</summary>
        public float TimeScale { get; set; } = 1f;
        public int ActiveCount => _active.Count;

        public bool Has(string id) => Pack != null && Pack.Has(id);
        public string PresetForSkill(string skillId) => Pack?.PresetForSkill(skillId);
        public bool HasProjectile(string id) => Pack != null && Pack.Presets.TryGetValue(id, out var p) && p.HasProjectile;

        /// <summary>
        /// Starts a preset. The returned awaitable completes when the projectile lands, or when the last element finishes when
        /// there is none (VfxStage.play); a missing preset or reduced motion completes at once.
        /// </summary>
        public Awaitable Play(string id, VfxPlayOptions options, Action<string, double, double> onCue = null)
        {
            var done = new AwaitableCompletionSource();
            var playback = VfxTimeline.Compile(Pack, id, options, _environment(), _random);
            if (playback.Nodes.Count == 0 && playback.Cues.Count == 0)
            {
                done.SetResult();
                return done.Awaitable;
            }
            _active.Add(new Active { Playback = playback, Elements = new VisualElement[playback.Nodes.Count], Done = done, OnCue = onCue });
            return done.Awaitable;
        }

        public void Tick(float deltaSeconds)
        {
            if (_active.Count == 0) return;
            double step = deltaSeconds * 1000.0 * TimeScale;
            for (int i = _active.Count - 1; i >= 0; i--)
            {
                var a = _active[i];
                a.TimeMs += step;
                var cues = a.Playback.Cues;
                while (a.NextCue < cues.Count && cues[a.NextCue].AtMs <= a.TimeMs)
                {
                    var cue = cues[a.NextCue++];
                    a.OnCue?.Invoke(cue.Cue, cue.DurationMs, cue.Intensity);
                }
                var nodes = a.Playback.Nodes;
                for (int n = 0; n < nodes.Count; n++)
                {
                    var node = nodes[n];
                    var element = a.Elements[n];
                    if (a.TimeMs < node.StartMs) continue;
                    if (a.TimeMs >= node.EndMs)
                    {
                        if (element != null)
                        {
                            element.RemoveFromHierarchy();
                            a.Elements[n] = null;
                        }
                        continue;
                    }
                    if (element == null) a.Elements[n] = element = Create(node);
                    Apply(element, node.Evaluate(a.TimeMs));
                }
                if (a.TimeMs >= a.Playback.CompletionMs) a.Done.TrySetResult();
                if (a.TimeMs >= a.Playback.LastNodeMs && a.NextCue >= cues.Count)
                {
                    a.Done.TrySetResult();
                    _active.RemoveAt(i);
                }
            }
        }

        /// <summary>Removes every effect (screen exit, a new battle).</summary>
        public void Clear()
        {
            foreach (var a in _active)
            {
                foreach (var e in a.Elements) e?.RemoveFromHierarchy();
                a.Done.TrySetResult();
            }
            _active.Clear();
        }

        private static void Apply(VisualElement e, VfxState s)
        {
            e.style.translate = new Translate((float)s.X, (float)s.Y);
            e.style.scale = new Scale(new Vector3((float)s.ScaleX, (float)s.ScaleY, 1f));
            e.style.rotate = new Rotate((float)s.Angle);
            e.style.opacity = (float)s.Alpha;
        }

        private VisualElement Create(VfxNode node)
        {
            var root = new VisualElement { pickingMode = PickingMode.Ignore, userData = node.Depth };
            root.style.position = Position.Absolute;
            root.style.left = 0;
            root.style.top = 0;
            root.style.width = 0;
            root.style.height = 0;
            root.style.transformOrigin = new TransformOrigin(0, 0, 0);
            if (node.Texture != null)
            {
                var texture = TextureFor(node.Texture);
                var image = new VisualElement { pickingMode = PickingMode.Ignore };
                image.style.position = Position.Absolute;
                image.style.width = texture.width;
                image.style.height = texture.height;
                image.style.left = -texture.width / 2f;
                image.style.top = -texture.height / 2f;
                image.style.backgroundImage = new StyleBackground(texture);
                image.style.unityBackgroundImageTintColor = ToColor(node.Color, 1f);
                root.Add(image);
            }
            else if (node.Shape != null)
            {
                root.Add(new VfxShapeElement(node.Shape, ToColor(node.Color, 1f), ToColor(node.Color2, 1f), ToColor(node.Secondary, 1f)));
            }
            Insert(_layers.TryGetValue(node.Layer, out var layer) ? layer : _layers["fx"], root, node.Depth);
            return root;
        }

        /// <summary>Keeps a layer's children ordered by depth (PIXI zIndex), later inserts on top within a depth.</summary>
        private static void Insert(VisualElement layer, VisualElement child, int depth)
        {
            int index = layer.childCount;
            for (int i = 0; i < layer.childCount; i++)
            {
                if (layer[i].userData is int d && d > depth)
                {
                    index = i;
                    break;
                }
            }
            layer.Insert(index, child);
        }

        public static Color ToColor(int rgb, float alpha) => new Color(((rgb >> 16) & 0xff) / 255f, ((rgb >> 8) & 0xff) / 255f, (rgb & 0xff) / 255f, alpha);

        /// <summary>The white procedural sprite for a texture name, rasterised once per app (VfxTextureArt).</summary>
        public static Texture2D TextureFor(string name)
        {
            if (Textures.TryGetValue(name, out var cached) && cached != null) return cached;
            var canvas = VfxTextureArt.Draw(name);
            var texture = new Texture2D(canvas.Width, canvas.Height, TextureFormat.RGBA32, false)
            {
                name = $"vfx_{name}",
                wrapMode = TextureWrapMode.Clamp,
                filterMode = FilterMode.Bilinear,
                hideFlags = HideFlags.DontSave
            };
            var pixels = new Color32[canvas.Width * canvas.Height];
            for (int y = 0; y < canvas.Height; y++)
            {
                int row = (canvas.Height - 1 - y) * canvas.Width; // canvas row 0 is the top, Unity's is the bottom
                for (int x = 0; x < canvas.Width; x++) pixels[row + x] = new Color32(255, 255, 255, (byte)Mathf.RoundToInt(canvas.AlphaAt(x, y) * 255f));
            }
            texture.SetPixels32(pixels);
            texture.Apply(false, true);
            Textures[name] = texture;
            return texture;
        }
    }
}
