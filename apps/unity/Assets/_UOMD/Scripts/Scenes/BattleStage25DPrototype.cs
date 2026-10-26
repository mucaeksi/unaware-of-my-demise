using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.UI;

namespace Uomd.Scenes
{
    /// <summary>
    /// UI v2 / D-34 phase B1 prototype (not in the player flow): the existing chibi atlases staged in 2.5D — painted depth
    /// planes, a perspective camera with drift, push-ins and a counter cut-in — playing a scripted exchange on a loop.
    /// Presentation only; no combat rules run here. Reach it with NavigateToAsync(UomdScreenId.BattlePrototype).
    /// </summary>
    public sealed class BattleStage25DPrototype : IUomdScreenController
    {
        private const float Fov = 28f;
        private static readonly Vector3 WideCam = new Vector3(0f, 1.9f, -11f);

        private readonly UomdSceneRouter _router;
        private readonly List<Unit> _units = new List<Unit>();
        private GameObject _root;
        private Camera _camera;
        private Camera _mainCamera;
        private VisualElement _hud;
        private int _generation;
        private float _time;
        private Vector3 _camTarget = WideCam;
        private float _fovTarget = Fov;
        private float _shake;

        public BattleStage25DPrototype(UomdSceneRouter router) => _router = router;

        public UomdScreenId ScreenId => UomdScreenId.BattlePrototype;
        private bool Calm => _router.Session.ReducedMotion;

        private sealed class Unit
        {
            public string Name = "";
            public SpriteRenderer Body;
            public Transform Root;
            public UnitArt Art;
            public Dictionary<string, Sprite> Frames = new Dictionary<string, Sprite>(StringComparer.Ordinal);
            public UnitArtState State;
            public float Clock;
            public Vector3 Home;
            public float Flash;
            public bool Down;
        }

        public async Awaitable OnEnterAsync(VisualElement screenRoot)
        {
            int generation = ++_generation;
            _router.Audio.PlayBgmCue("bgm_battle_field");
            BuildCamera();
            BuildHud(screenRoot);
            BuildStage();
            await AddUnitAsync("mahmut", "MAHMUT", new Vector3(-2.4f, 0f, 2.0f), true);
            await AddUnitAsync("fadyme", "FADYME", new Vector3(-4.0f, 0f, 4.4f), true);
            await AddUnitAsync("bellbound_dead", "BELLBOUND DEAD", new Vector3(2.5f, 0f, 2.8f), false);
            await AddUnitAsync("bellbound_dead", "BELLBOUND DEAD", new Vector3(4.2f, 0f, 5.2f), false);
            if (generation != _generation) return;
            _ = LoopAsync(generation);
        }

        public void OnExit()
        {
            _generation++;
            if (_root != null) UnityEngine.Object.Destroy(_root);
            if (_mainCamera != null) _mainCamera.enabled = true;
            RestoreUiBackgrounds();
            _units.Clear();
            _root = null;
            _hud = null;
        }

        public void OnTick(float deltaTime)
        {
            if (_camera == null) return;
            _time += deltaTime;
            foreach (var u in _units) Animate(u, deltaTime);
            // camera: ease toward the shot target, add a slow drift and decaying shake
            Vector3 drift = Calm ? Vector3.zero : new Vector3(Mathf.Sin(_time * 0.21f) * 0.25f, Mathf.Sin(_time * 0.17f) * 0.08f, 0f);
            Vector3 shake = _shake > 0f && !Calm ? (Vector3)UnityEngine.Random.insideUnitCircle * 0.06f * _shake : Vector3.zero;
            _shake = Mathf.Max(0f, _shake - deltaTime * 4f);
            var t = _camera.transform;
            t.position = Vector3.Lerp(t.position, _camTarget + drift, 1f - Mathf.Exp(-deltaTime * 4f)) + shake;
            _camera.fieldOfView = Mathf.Lerp(_camera.fieldOfView, _fovTarget, 1f - Mathf.Exp(-deltaTime * 4f));
        }

        // ---- scene ---------------------------------------------------------------------------------------------------

        private void BuildCamera()
        {
            _root = new GameObject("Stage25D_Prototype");
            _mainCamera = Camera.main;
            if (_mainCamera != null) _mainCamera.enabled = false;
            var go = new GameObject("Stage25D_Camera");
            go.transform.SetParent(_root.transform, false);
            _camera = go.AddComponent<Camera>();
            _camera.orthographic = false;
            _camera.fieldOfView = Fov;
            _camera.nearClipPlane = 0.3f;
            _camera.farClipPlane = 200f;
            _camera.clearFlags = CameraClearFlags.SolidColor;
            _camera.backgroundColor = UomdThemeTokens.Void;
            _camera.transform.position = WideCam;
            _camera.transform.rotation = Quaternion.Euler(4f, 0f, 0f);
        }

        /// <summary>Back to front: sky, far silhouettes, near tree line, ground, foreground branches.</summary>
        private void BuildStage()
        {
            Plane("uiv2_stage_forest_layer1_sky_v001.png", 70f, -100, keyed: false, cutBelow: 0f, lift: 0.18f);
            Plane("uiv2_stage_forest_layer2_far_v001.png", 48f, -90, keyed: true, cutBelow: 0f, lift: 0.02f);
            Plane("uiv2_stage_forest_layer2_far_v002.png", 30f, -80, keyed: true, cutBelow: 0f, lift: 0.05f);
            Plane("uiv2_stage_forest_layer3_mid_v001.png", 16f, -70, keyed: true, cutBelow: 0f, lift: 0.0f);
            Plane("uiv2_stage_forest_layer4_foreground_v001.png", -1.5f, 200, keyed: true, cutBelow: 0f, lift: 0.0f);
        }

        /// <summary>A painted plane at depth <paramref name="z"/>, sized to fill the frustum there with room for camera moves.</summary>
        private void Plane(string file, float z, int order, bool keyed, float cutBelow, float lift)
        {
            var texture = LoadWorkbenchTexture(file, keyed, cutBelow);
            if (texture == null) return;
            var sprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(0.5f, 0.5f), 100f);
            var go = new GameObject("Plane_" + Path.GetFileNameWithoutExtension(file));
            go.transform.SetParent(_root.transform, false);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = order;
            float distance = z - WideCam.z;
            float viewH = 2f * distance * Mathf.Tan(Fov * 0.5f * Mathf.Deg2Rad) * 1.25f;
            float scale = viewH / (texture.height / 100f);
            go.transform.localScale = new Vector3(scale, scale, 1f);
            go.transform.position = new Vector3(0f, WideCam.y + viewH * lift, z);
        }

        private async Awaitable AddUnitAsync(string unitId, string name, Vector3 home, bool player)
        {
            if (!_router.Media.Catalog.TryGetUnitArt(unitId, out var art)) return;
            var texture = await _router.Media.TextureAsync(art.AtlasPath);
            if (texture == null || _root == null) return;
            var unit = new Unit { Name = name, Art = art, Home = home };
            foreach (var kv in art.Frames)
            {
                var (x, y, w, h) = kv.Value;
                unit.Frames[kv.Key] = Sprite.Create(texture, new Rect(x, texture.height - (y + h), w, h), new Vector2(0.5f, 0f), 100f);
            }
            var rootGo = new GameObject("Unit_" + name);
            rootGo.transform.SetParent(_root.transform, false);
            rootGo.transform.position = home;
            unit.Root = rootGo.transform;

            var shadow = new GameObject("Shadow").AddComponent<SpriteRenderer>();
            shadow.transform.SetParent(rootGo.transform, false);
            shadow.sprite = ShadowSprite();
            shadow.sortingOrder = 10 - Mathf.RoundToInt(home.z * 10f) - 1;
            shadow.transform.localScale = new Vector3(1.5f, 0.42f, 1f);
            shadow.transform.localPosition = new Vector3(0f, 0.02f, 0f);

            var body = new GameObject("Body").AddComponent<SpriteRenderer>();
            body.transform.SetParent(rootGo.transform, false);
            body.sortingOrder = 10 - Mathf.RoundToInt(home.z * 10f);
            body.flipX = player != (art.Facing == "right");
            int idleH = art.Frames.TryGetValue(art.State("idle").Frame, out var f) ? f.H : 250;
            float s = 2.3f / (idleH / 100f); // every chibi ~2.3 world units tall (about a third of the wide shot)
            body.transform.localScale = new Vector3(s, s, 1f);
            unit.Body = body;
            Play(unit, "idle");
            _units.Add(unit);
        }

        private static void Play(Unit u, string state)
        {
            u.State = u.Art.State(state);
            u.Clock = 0f;
            SetFrame(u, u.State.Frames.Length > 0 ? u.State.Frames[0] : u.State.Frame);
        }

        private static void SetFrame(Unit u, string frame)
        {
            if (u.Frames.TryGetValue(frame, out var sprite)) u.Body.sprite = sprite;
        }

        private static void Animate(Unit u, float dt)
        {
            if (u.State == null || u.Body == null) return;
            u.Clock += dt;
            int count = u.State.Frames.Length;
            if (count > 0)
            {
                int index = (int)(u.Clock * u.State.Fps);
                if (u.State.Loop) SetFrame(u, u.State.Frames[index % count]);
                else if (index < count) SetFrame(u, u.State.Frames[index]);
                else if (!u.Down) Play(u, "idle"); // a defeated unit holds its last frame while it fades
            }
            u.Flash = Mathf.Max(0f, u.Flash - dt * 5f);
            var c = Color.Lerp(Color.white, new Color(1f, 0.55f, 0.6f), u.Flash);
            if (u.Down) c.a = Mathf.Max(0f, 1f - u.Clock * 0.8f);
            u.Body.color = c;
        }

        // ---- the scripted exchange -----------------------------------------------------------------------------------

        private async Awaitable LoopAsync(int generation)
        {
            if (_units.Count == 0) { Debug.LogWarning("[Stage25D] no unit art loaded"); return; }
            while (generation == _generation)
            {
                var mahmut = _units[0];
                var fadyme = _units.Count > 1 ? _units[1] : mahmut;
                var foeA = _units.Count > 2 ? _units[2] : mahmut;
                var foeB = _units.Count > 3 ? _units[3] : foeA;
                foreach (var u in _units) { u.Down = false; u.Root.position = u.Home; Play(u, "idle"); }
                Shot(WideCam, Fov);
                if (!await Wait(generation, 1.6f)) return;

                // 1. Mahmut strikes: push in, lunge, hit
                Shot(Mid(mahmut, foeA) + new Vector3(0f, 1.6f, -8.5f), 24f);
                _router.Audio.PlaySfx("sfx_footstep_march");
                await Move(generation, mahmut, foeA.Home + new Vector3(-1.3f, 0f, -0.2f), 0.28f);
                Play(mahmut, "basic");
                if (!await Wait(generation, 0.22f)) return;
                Hit(foeA, "-12", false);
                _router.Audio.PlaySfx("sfx_blade_heavy");
                if (!await Wait(generation, 0.5f)) return;
                await Move(generation, mahmut, mahmut.Home, 0.3f);

                // 2. the dead answer; Mahmut counters (cut-in)
                Shot(WideCam + new Vector3(0.6f, 0f, 2f), 26f);
                if (!await Wait(generation, 0.4f)) return;
                await Move(generation, foeA, mahmut.Home + new Vector3(1.3f, 0f, 0.2f), 0.35f);
                Play(foeA, "basic");
                if (!await Wait(generation, 0.2f)) return;
                _router.Audio.PlaySfx("sfx_shield_guard");
                CutIn("COUNTER", "-18");
                if (!await Wait(generation, 0.75f)) return;
                Play(mahmut, "active");
                Hit(foeA, "-18", true);
                _router.Audio.PlaySfx("sfx_shield_bash");
                if (!await Wait(generation, 0.35f)) return;
                await Move(generation, foeA, foeA.Home, 0.35f);

                // 3. Fadyme's ultimate on both
                Shot(fadyme.Home + new Vector3(1.2f, 1.5f, -7f), 22f);
                _router.Audio.PlaySfx("sfx_ultimate_cast");
                Play(fadyme, "ultimate");
                if (!await Wait(generation, 0.8f)) return;
                Shot(Mid(foeA, foeB) + new Vector3(0f, 1.7f, -9.5f), 26f);
                _router.Audio.PlaySfx("sfx_ultimate_release");
                FlashScreen(UomdThemeTokens.Veil);
                Hit(foeA, "-24", true);
                Hit(foeB, "-31", true);
                if (!await Wait(generation, 0.45f)) return;
                foeB.Down = true;
                Play(foeB, "defeat");
                if (!await Wait(generation, 1.6f)) return;
                Play(mahmut, "victory");
                Play(fadyme, "victory");
                Shot(WideCam, Fov);
                if (!await Wait(generation, 2.2f)) return;
            }
        }

        private static Vector3 Mid(Unit a, Unit b) => (a.Home + b.Home) * 0.5f;

        private void Shot(Vector3 position, float fov)
        {
            _camTarget = position;
            _fovTarget = fov;
        }

        private void Hit(Unit u, string amount, bool heavy)
        {
            if (!u.Down) Play(u, "hit");
            u.Flash = 1f;
            _shake = heavy ? 1f : 0.6f;
            FloatNumber(u, amount, heavy);
        }

        private async Awaitable Move(int generation, Unit u, Vector3 to, float seconds)
        {
            Vector3 from = u.Root.position;
            Play(u, "walk");
            for (float t = 0f; t < seconds; t += Time.deltaTime)
            {
                if (generation != _generation || u.Root == null) return;
                float k = Mathf.SmoothStep(0f, 1f, t / seconds);
                u.Root.position = Vector3.Lerp(from, to, k);
                await Awaitable.NextFrameAsync();
            }
            if (u.Root != null) u.Root.position = to;
            Play(u, "idle");
        }

        private async Awaitable<bool> Wait(int generation, float seconds)
        {
            await Awaitable.WaitForSecondsAsync(seconds);
            return generation == _generation;
        }

        // ---- HUD (UI Toolkit overlay) ----------------------------------------------------------------------------------

        private readonly List<(VisualElement Element, StyleColor Previous)> _clearedBackgrounds = new List<(VisualElement, StyleColor)>();

        /// <summary>The UI root paints an opaque void (letterbox); the world camera must show through while this screen is up.</summary>
        private void ClearUiBackgrounds(VisualElement screenRoot)
        {
            for (var e = screenRoot; e != null; e = e.parent)
            {
                _clearedBackgrounds.Add((e, e.style.backgroundColor));
                e.style.backgroundColor = new StyleColor(Color.clear);
            }
        }

        private void RestoreUiBackgrounds()
        {
            foreach (var (element, previous) in _clearedBackgrounds) element.style.backgroundColor = previous;
            _clearedBackgrounds.Clear();
        }

        private void BuildHud(VisualElement screenRoot)
        {
            ClearUiBackgrounds(screenRoot);
            _hud = UomdScreenKit.Layer(screenRoot);
            _hud.pickingMode = PickingMode.Ignore;
            var tag = UomdScreenKit.Text(_hud, "2.5D STAGE  ·  PROTOTYPE B1", 20, UomdThemeTokens.GoldHi, 5f);
            tag.style.position = Position.Absolute;
            tag.style.left = 60;
            tag.style.top = 40;
            tag.AddToClassList("uomd-display");
            var round = UomdScreenKit.Centered(UomdScreenKit.Text(_hud, "ROUND 2", 26, UomdThemeTokens.Bone, 10f), 0, 40);
            round.AddToClassList("uomd-display");
            var back = UomdScreenKit.AtRight(UomdScreenKit.MenuButton(_hud, "BACK", null, 180, 64, 20, false, () => _ = _router.NavigateToAsync(UomdScreenId.Home)), 60, 30);
            back.pickingMode = PickingMode.Position;
        }

        /// <summary>A short full-screen wash for ultimates; skipped when the player asked for reduced flashing.</summary>
        private void FlashScreen(Color color)
        {
            if (_hud == null || _router.Session.ReduceFlash) return;
            var wash = UomdScreenKit.Layer(_hud, new Color(color.r, color.g, color.b, 0.45f));
            wash.pickingMode = PickingMode.Ignore;
            UomdScreenKit.Fade(wash, 0f, 350, 60, Calm);
            UomdScreenKit.After(wash, 500, () => wash.RemoveFromHierarchy());
        }

        private void FloatNumber(Unit u, string text, bool heavy)
        {
            if (_hud == null || _camera == null || _hud.panel == null) return;
            Vector3 screen = _camera.WorldToScreenPoint(u.Root.position + Vector3.up * 2.2f);
            Vector2 panelPos = RuntimePanelUtils.ScreenToPanel(_hud.panel, new Vector2(screen.x, Screen.height - screen.y));
            Vector2 local = _hud.WorldToLocal(panelPos);
            var label = UomdScreenKit.Text(_hud, text, heavy ? 64 : 48, heavy ? UomdThemeTokens.TextCrit : UomdThemeTokens.Bone);
            label.AddToClassList("uomd-display");
            label.style.position = Position.Absolute;
            label.style.left = local.x - 60f;
            label.style.top = local.y - 40f;
            label.style.unityTextOutlineWidth = 1.5f;
            label.style.unityTextOutlineColor = UomdThemeTokens.Void;
            UomdScreenKit.Move(label, 0, -50, 700, 0, Calm);
            UomdScreenKit.Fade(label, 0f, 400, 450, Calm);
            UomdScreenKit.After(label, 1000, () => label.RemoveFromHierarchy());
        }

        /// <summary>Counter cut-in after the approved uiv2_battle_cutin_v002: two crimson slashes, the word and the number.</summary>
        private void CutIn(string word, string amount)
        {
            if (_hud == null) return;
            var layer = UomdScreenKit.Layer(_hud, new Color(0.02f, 0.01f, 0.04f, 0.55f));
            layer.pickingMode = PickingMode.Ignore;
            foreach (float y in new[] { 380f, 600f })
            {
                var slash = new VisualElement { pickingMode = PickingMode.Ignore };
                slash.style.position = Position.Absolute;
                slash.style.left = -400f;
                slash.style.top = y;
                slash.style.width = 3000f;
                slash.style.height = y < 500f ? 30f : 120f;
                slash.style.backgroundColor = y < 500f ? UomdThemeTokens.CrimsonHi : UomdThemeTokens.Crimson;
                slash.style.rotate = new Rotate(-14f);
                layer.Add(slash);
            }
            var label = UomdScreenKit.Centered(UomdScreenKit.Text(layer, word, 110, UomdThemeTokens.Bone, 14f), -120, 560);
            label.AddToClassList("uomd-display");
            label.style.rotate = new Rotate(-14f);
            var num = UomdScreenKit.Centered(UomdScreenKit.Text(layer, amount, 120, UomdThemeTokens.GoldHi, 2f), 420, 640);
            num.AddToClassList("uomd-display");
            layer.style.opacity = 0f;
            UomdScreenKit.Fade(layer, 1f, 90, 0, Calm);
            UomdScreenKit.Fade(layer, 0f, 160, 620, Calm);
            UomdScreenKit.After(layer, 820, () => layer.RemoveFromHierarchy());
            _router.Audio.PlaySfx("sfx_ultimate_cutin");
        }

        // ---- textures --------------------------------------------------------------------------------------------------

        private static Sprite _shadowSprite;

        private static Sprite ShadowSprite()
        {
            if (_shadowSprite != null) return _shadowSprite;
            const int size = 64;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            var px = new Color32[size * size];
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float dx = (x + 0.5f) / size * 2f - 1f, dy = (y + 0.5f) / size * 2f - 1f;
                float a = Mathf.Clamp01(1f - Mathf.Sqrt(dx * dx + dy * dy));
                px[y * size + x] = new Color32(6, 2, 10, (byte)(a * a * 200));
            }
            tex.SetPixels32(px);
            tex.Apply();
            _shadowSprite = Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 64f);
            return _shadowSprite;
        }

        /// <summary>
        /// shortcut: reads the owner's stage-1 PNGs straight from the art workbench (Editor only) and keys them on load;
        /// the shipped planes will come through ingest_art + content like every other asset.
        /// </summary>
        private static Texture2D LoadWorkbenchTexture(string file, bool keyed, float cutBelow)
        {
            string path = Path.Combine(Application.dataPath, "../../../narrative/15_Art_Workbench/ui_v2/mockups", file);
            if (!File.Exists(path)) { Debug.LogWarning($"[Stage25D] missing {path}"); return null; }
            var tex = new Texture2D(2, 2, TextureFormat.RGBA32, false);
            if (!tex.LoadImage(File.ReadAllBytes(path))) return null;
            if (!keyed && cutBelow <= 0f) return tex;
            var px = tex.GetPixels32();
            int w = tex.width, h = tex.height;
            int horizon = Mathf.RoundToInt(h * (1f - cutBelow)), feather = Mathf.Max(1, h / 18);
            for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                int i = y * w + x;
                var c = px[i];
                float alpha = 1f;
                if (keyed)
                {
                    int d = c.g - Math.Max(c.r, c.b); // ART_BIBLE §3.0 ramp 40 → 130
                    alpha = 1f - Mathf.Clamp01((d - 40f) / 90f);
                    if (d > 0) c.g = Math.Max(c.r, c.b); // despill
                }
                if (cutBelow > 0f) alpha *= Mathf.Clamp01((horizon - y) / (float)feather); // y grows upward
                c.a = (byte)(alpha * 255f);
                px[i] = c;
            }
            tex.SetPixels32(px);
            tex.Apply();
            return tex;
        }
    }
}
