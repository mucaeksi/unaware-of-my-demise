#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.UI;

namespace Uomd.Scenes
{
    /// <summary>Editor-only motion audition using the actual battle sprite/frame/pivot presenter. No combat or entry writes.</summary>
    public sealed class RebuildUnitReviewScreen : IUomdScreenController
    {
        public static readonly string[] Units = { "mahmut", "fadyme", "bellbound_dead", "hollow_pilgrim" };
        public static readonly string[] States = { "idle", "walk", "basic", "active", "ultimate", "hit", "defeat", "victory" };
        private readonly UomdSceneRouter _router;
        private readonly Dictionary<string, Sprite> _sprites = new Dictionary<string, Sprite>(StringComparer.Ordinal);
        private BattleUnitView _view, _mirrored;
        private UnitArt _art;
        private Label _status;
        private string _state;
        private int _frame = -1, _generation;
        public UomdScreenId ScreenId => UomdScreenId.Battle;
        public string CurrentFrame => _view?.CurrentFrame ?? "";
        public string CurrentState => _view?.CurrentAnimationState ?? "";
        public Rect FrameBounds => _view?.RenderedFrameBounds ?? Rect.zero;
        public Rect MirroredFrameBounds => _mirrored?.RenderedFrameBounds ?? Rect.zero;
        public float FootScreenY => _view == null ? 0f : _view.Root.LocalToWorld(Vector2.zero).y;
        public string[] ImagePaths { get; private set; } = Array.Empty<string>();
        public bool Ready { get; private set; }
        public RebuildUnitReviewScreen(UomdSceneRouter router) => _router = router;

        public async Awaitable OnEnterAsync(VisualElement root)
        {
            if (!UomdEditorPreviewIsolation.Active) throw new InvalidOperationException("Unit audition is Editor review only.");
            int generation = ++_generation;
            Ready = false;
            string unit = _router.ProductionPreview.scenario.Substring(5);
            if (Array.IndexOf(Units, unit) < 0 || !_router.Media.Catalog.TryGetUnitArt("sol_" + unit, out _art))
                throw new ArgumentException("Unknown rebuilt unit.");
            _router.Audio.StopBgm(0.01f);
            _router.Audio.StopVoiceLine();
            var stage = UomdScreenKit.Layer(root, UomdThemeTokens.Void);
            string background = _router.Media.Catalog.Background("sol_" + (unit == "hollow_pilgrim" ? "forgotten_stone_crossing" : "forest_whispering_ash"));
            var bg = await _router.Media.TextureAsync(background);
            if (generation != _generation) return;
            if (bg == null) throw new InvalidOperationException("Review background unavailable.");
            stage.style.backgroundImage = new StyleBackground(bg);
            stage.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Cover);
            UomdScreenKit.Layer(stage, new Color(0.04f, 0.02f, 0.07f, 0.55f));
            var atlas = await _router.Media.TextureAsync(_art.AtlasPath);
            if (generation != _generation) return;
            if (atlas == null) throw new InvalidOperationException("Rebuilt atlas unavailable.");
            ImagePaths = new[] { background, _art.AtlasPath };
            foreach (var state in _art.States.Values)
            {
                var names = new HashSet<string>(state.Frames, StringComparer.Ordinal) { state.Frame };
                foreach (string frame in names)
                {
                    if (_sprites.ContainsKey(frame)) continue;
                    var rect = _art.Frames[frame];
                    _sprites.Add(frame, Uomd.Battle.ChibiAtlasSlicer.CreateFromTopLeftRect(atlas, frame, rect.X, rect.Y, rect.W, rect.H, (float)state.PivotX, (float)state.FootY));
                }
            }
            var world = UomdScreenKit.Layer(stage);
            world.style.width = 1920;
            world.style.left = Length.Percent(50);
            world.style.marginLeft = -960;
            world.style.right = StyleKeyword.Auto;
            var plates = UomdScreenKit.Layer(stage);
            string side = _art.Facing == "right" ? "player" : "enemy";
            _view = new BattleUnitView(world, plates, unit, unit.Replace('_', ' '), side, _art, _sprites, new BattleSpot(650, 720, 1), _ => { });
            _mirrored = new BattleUnitView(world, plates, unit + "_mirror", "MIRRORED FACING", side == "player" ? "enemy" : "player", _art, _sprites, new BattleSpot(1270, 720, 1), _ => { });
            _view.Plate.style.display = _mirrored.Plate.style.display = DisplayStyle.None;
            var baseline = UomdScreenKit.Layer(world, new Color(0.8f, 0.65f, 0.42f, 0.65f));
            baseline.style.top = 720;
            baseline.style.height = 1;
            baseline.style.bottom = StyleKeyword.Auto;
            var heading = UomdScreenKit.Text(stage, "UNIT MOTION REVIEW · " + unit.ToUpperInvariant().Replace('_', ' '), 32, UomdThemeTokens.TextPrimary);
            heading.style.position = Position.Absolute;
            heading.style.left = heading.style.top = 56;
            var note = UomdScreenKit.Text(stage, "Authored runtime scale · original / mirrored facing · foot baseline · candidate, human QC pending", 24, UomdThemeTokens.TextDim);
            note.style.position = Position.Absolute;
            note.style.left = 56;
            note.style.top = 108;
            _status = UomdScreenKit.Text(stage, "", 30, UomdThemeTokens.GoldHi);
            _status.style.position = Position.Absolute;
            _status.style.left = 56;
            _status.style.bottom = 74;
            _state = null;
            _frame = -1;
            Ready = true;
            ApplyRequest();
        }

        public void ApplyRequest()
        {
            if (!Ready) return;
            var request = _router.ProductionPreview;
            string state = request.unitState;
            if (Array.IndexOf(States, state) < 0) throw new ArgumentException("Unknown animation state.");
            var data = _art.State(state);
            int frame = Mathf.Clamp(request.unitFrame, 0, Math.Max(0, data.Frames.Length - 1));
            request.unitFrame = frame;
            if (state != _state || frame != _frame)
            {
                _view.Play(state); _mirrored.Play(state);
                float time = frame / (float)Math.Max(1, data.Fps) + 0.0001f;
                _view.Tick(time); _mirrored.Tick(time);
                _state = state; _frame = frame;
            }
            _status.text = state.ToUpperInvariant() + " · " + CurrentFrame + " · " + data.Fps + " FPS · " + _art.Frames.Count + " source poses";
        }

        public void OnTick(float deltaTime)
        {
            ApplyRequest();
            if (!Ready || _router.ProductionPreview.paused || _router.ProductionPreview.reducedMotion) return;
            _view.Tick(deltaTime); _mirrored.Tick(deltaTime);
        }

        public void OnExit()
        {
            ++_generation;
            Ready = false;
            foreach (var sprite in _sprites.Values) UnityEngine.Object.Destroy(sprite);
            _sprites.Clear();
            _view = _mirrored = null;
            ImagePaths = Array.Empty<string>();
        }
    }
}
#endif
