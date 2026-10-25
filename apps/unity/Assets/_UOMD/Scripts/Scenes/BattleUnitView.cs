using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.UI;

namespace Uomd.Scenes
{
    /// <summary>
    /// One combatant on the battle stage (port of the essentials of apps/game/src/battle/UnitView.ts): the SD chibi frame
    /// animation from its atlas, a ground shadow, the active-unit marker and the translucent plate (name, HP, Focus) under the
    /// feet. Units face the opponent; positions are the formation spot (feet) in the 1920×1080 reference space.
    /// </summary>
    public sealed class BattleUnitView
    {
        private const float PlateWidthPlayer = 178f, PlateWidthEnemy = 196f;

        private readonly UnitArt _art;
        private readonly Dictionary<string, Sprite> _sprites;
        private readonly VisualElement _image;
        private readonly VisualElement _shadow;
        private readonly VisualElement _ring;
        private readonly Label _marker;
        private readonly Label _intent;
        private readonly VisualElement _hpFill;
        private readonly VisualElement _focusFill;
        private readonly bool _flip;
        private readonly float _baseScale;
        private readonly float _depth;
        private UnitArtState _state;
        private string _stateName = "idle";
        private float _frameClock;
        private Action _onStateDone;

        public BattleUnitView(VisualElement unitLayer, VisualElement plateLayer, string id, string name, string side, UnitArt art,
            Dictionary<string, Sprite> sprites, BattleSpot spot, Action<BattleUnitView> onTap)
        {
            Id = id;
            Side = side;
            _art = art;
            _sprites = sprites;
            X = (float)spot.X;
            Y = (float)spot.Y;
            float depth = (float)spot.DepthScale;
            _depth = depth;
            // player units face right, enemies face left
            _flip = (side == "player") != (art.Facing == "right");
            int idleHeight = art.Frames.TryGetValue(art.State("idle").Frame, out var f) ? f.H : (int)art.HeightPx;
            _baseScale = (float)art.HeightPx / Mathf.Max(1, idleHeight) * depth;

            Root = new VisualElement { pickingMode = PickingMode.Position };
            Root.style.position = Position.Absolute;
            Root.style.left = 0;
            Root.style.top = 0;
            unitLayer.Add(Root);
            Root.RegisterCallback<ClickEvent>(e =>
            {
                onTap(this);
                e.StopPropagation();
            });

            float shadowW = (float)art.HeightPx * 0.62f * depth, shadowH = (float)art.HeightPx * 0.14f * depth;
            _shadow = Ellipse(Root, shadowW, shadowH, new Color(0.020f, 0.008f, 0.031f, 0.74f));
            _ring = Ellipse(Root, (float)art.HeightPx * 0.74f * depth, (float)art.HeightPx * 0.16f * depth, new Color(0, 0, 0, 0));
            _ring.style.borderTopWidth = _ring.style.borderBottomWidth = _ring.style.borderLeftWidth = _ring.style.borderRightWidth = 4;
            SetRingColor(new Color(0, 0, 0, 0));

            _image = new VisualElement { pickingMode = PickingMode.Ignore };
            _image.style.position = Position.Absolute;
            _image.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            if (_flip) _image.style.scale = new Scale(new Vector3(-1f, 1f, 1f));
            Root.Add(_image);

            _marker = UomdScreenKit.Text(Root, "▼", 34, UomdThemeTokens.GoldHi);
            _marker.style.position = Position.Absolute;
            _marker.style.left = -20;
            _marker.style.width = 40;
            _marker.style.top = -(float)art.HeightPx * depth - 52;
            _marker.style.visibility = Visibility.Hidden;

            // the plate lives on its own layer above every unit so a front unit never hides a rear unit's bars
            bool player = side == "player";
            float plateW = player ? PlateWidthPlayer : PlateWidthEnemy, plateH = player ? 50f : 52f;
            Plate = new VisualElement { pickingMode = PickingMode.Ignore };
            Plate.style.position = Position.Absolute;
            Plate.style.width = plateW;
            Plate.style.height = plateH;
            Plate.style.left = X - plateW / 2f;
            Plate.style.top = Y + 18f - plateH / 2f + (player ? 0 : 1);
            Plate.style.backgroundColor = new Color(0.039f, 0.024f, 0.063f, player ? 0.54f : 0.68f);
            Round(Plate, plateH / 2f);
            var rim = player ? UomdThemeTokens.PlayerSide : UomdThemeTokens.EnemySide;
            Border(Plate, new Color(rim.r, rim.g, rim.b, 0.58f), 1.4f);
            Plate.style.alignItems = Align.Center;
            Plate.style.paddingTop = 3;
            plateLayer.Add(Plate);
            var nameLabel = UomdScreenKit.Text(Plate, name.ToUpperInvariant(), 16, player ? new Color(0.812f, 0.878f, 1f) : new Color(1f, 0.702f, 0.769f));
            nameLabel.AddToClassList("uomd-display");
            nameLabel.style.height = 18;
            _hpFill = Bar(Plate, 154, 10, UomdThemeTokens.HpGood);
            // enemy intent under the plate (BattleScene.refreshHud: the skill an enemy will use, ⚠ when announced)
            _intent = UomdScreenKit.Text(plateLayer, "", 13, new Color(1f, 0.702f, 0.769f), 1f);
            _intent.AddToClassList("uomd-display");
            _intent.style.position = Position.Absolute;
            _intent.style.left = X - 150f;
            _intent.style.width = 300f;
            _intent.style.top = Y + 18f + (player ? 40f : 30f);
            _intent.style.display = DisplayStyle.None;
            _focusFill = player ? Bar(Plate, 154, 6, UomdThemeTokens.Focus) : null;
            if (_focusFill != null) _focusFill.style.width = Length.Percent(0);

            PlaceAtSpot();
            Play("idle");
        }

        public string Id { get; }
        public string Side { get; }
        public VisualElement Root { get; }
        public VisualElement Plate { get; }
        public float X { get; private set; }
        public float Y { get; private set; }
        public bool Alive { get; private set; } = true;
        /// <summary>Top of the chibi in reference units (floating numbers start here).</summary>
        public float HeadY => Y - (float)_art.HeightPx * _depth;

        /// <summary>Plays a state (idle, walk, basic, active, ultimate, hit, defeat, victory); a non-looping state returns to idle.</summary>
        public void Play(string state, Action onDone = null)
        {
            if (!Alive && state != "defeat") return;
            _stateName = state;
            _state = _art.State(state);
            _frameClock = 0f;
            _onStateDone = onDone;
            ShowFrame(_state.Frames.Length > 0 ? _state.Frames[0] : _state.Frame);
        }

        public void Tick(float deltaTime)
        {
            if (_state == null || _state.Frames.Length == 0) return;
            _frameClock += deltaTime;
            float duration = _state.Frames.Length / (float)Math.Max(1.0, _state.Fps);
            if (!_state.Loop && _frameClock >= duration)
            {
                var done = _onStateDone;
                _onStateDone = null;
                if (_stateName != "defeat" && Alive) Play("idle");
                done?.Invoke();
                return;
            }
            int index = (int)(_frameClock * _state.Fps) % _state.Frames.Length;
            ShowFrame(_state.Frames[index]);
        }

        private void ShowFrame(string frame)
        {
            if (!_art.Frames.TryGetValue(frame, out var rect)) return;
            if (_sprites.TryGetValue(frame, out var sprite) && sprite != null) _image.style.backgroundImage = new StyleBackground(sprite);
            float scale = _baseScale * (float)_state.Scale;
            float w = rect.W * scale, h = rect.H * scale;
            float pivotX = _flip ? 1f - (float)_state.PivotX : (float)_state.PivotX;
            _image.style.width = w;
            _image.style.height = h;
            _image.style.left = -pivotX * w;
            _image.style.top = -(float)_state.FootY * h;
        }

        public void SetHp(double hp, double maxHp)
        {
            float ratio = maxHp > 0 ? Mathf.Clamp01((float)(hp / maxHp)) : 0f;
            _hpFill.style.width = Length.Percent(ratio * 100f);
            _hpFill.style.backgroundColor = UomdThemeTokens.HpBarColor(ratio);
        }

        public void SetFocus(double focus, double max)
        {
            if (_focusFill == null) return;
            _focusFill.style.width = Length.Percent(max > 0 ? Mathf.Clamp01((float)(focus / max)) * 100f : 0f);
        }

        /// <summary>Shows what an enemy will do next; null hides it.</summary>
        public void SetIntent(string text)
        {
            _intent.text = text ?? "";
            _intent.style.display = string.IsNullOrEmpty(text) || !Alive ? DisplayStyle.None : DisplayStyle.Flex;
        }

        /// <summary>The idle key frame, for the turn-order medallions.</summary>
        public Sprite IdleSprite => _sprites.TryGetValue(_art.State("idle").Frame, out var sprite) ? sprite : null;

        public void SetActive(bool active) => _marker.style.visibility = active ? Visibility.Visible : Visibility.Hidden;

        public void SetSelectable(bool selectable) => SetRingColor(selectable ? new Color(UomdThemeTokens.GoldHi.r, UomdThemeTokens.GoldHi.g, UomdThemeTokens.GoldHi.b, 0.9f) : new Color(0, 0, 0, 0));

        public void Defeat(bool reducedMotion)
        {
            Play("defeat");
            Alive = false;
            UomdScreenKit.Fade(Root, 0.25f, 900, 300, reducedMotion);
            UomdScreenKit.Fade(Plate, 0f, 600, 300, reducedMotion);
            _intent.style.display = DisplayStyle.None;
        }

        /// <summary>Moves the unit (feet) towards a point, for the lunge before a melee strike.</summary>
        public void MoveTo(float x, float y, int durationMs, bool reducedMotion)
        {
            Root.style.transitionProperty = new List<StylePropertyName> { new StylePropertyName("translate") };
            Root.style.transitionDuration = new List<TimeValue> { new TimeValue(reducedMotion ? 0 : durationMs, TimeUnit.Millisecond) };
            Root.style.transitionTimingFunction = new List<EasingFunction> { new EasingFunction(EasingMode.EaseInOut) };
            Root.style.translate = new Translate(x, y);
        }

        public void PlaceAtSpot() => Root.style.translate = new Translate(X, Y);

        private void SetRingColor(Color color)
        {
            _ring.style.borderTopColor = _ring.style.borderBottomColor = _ring.style.borderLeftColor = _ring.style.borderRightColor = color;
        }

        private static VisualElement Ellipse(VisualElement parent, float w, float h, Color color)
        {
            var e = new VisualElement { pickingMode = PickingMode.Ignore };
            e.style.position = Position.Absolute;
            e.style.width = w;
            e.style.height = h;
            e.style.left = -w / 2f;
            e.style.top = -h / 2f - 3f;
            e.style.backgroundColor = color;
            Round(e, h / 2f);
            parent.Add(e);
            return e;
        }

        private static VisualElement Bar(VisualElement parent, float w, float h, Color color)
        {
            var track = new VisualElement { pickingMode = PickingMode.Ignore };
            track.style.width = w;
            track.style.height = h;
            track.style.marginTop = 2;
            track.style.backgroundColor = new Color(0.035f, 0.020f, 0.055f, 0.95f);
            Round(track, h / 2f);
            parent.Add(track);
            var fill = new VisualElement { pickingMode = PickingMode.Ignore };
            fill.style.width = Length.Percent(100);
            fill.style.height = Length.Percent(100);
            fill.style.backgroundColor = color;
            Round(fill, h / 2f);
            track.Add(fill);
            return fill;
        }

        private static void Round(VisualElement e, float r)
        {
            e.style.borderTopLeftRadius = e.style.borderTopRightRadius = e.style.borderBottomLeftRadius = e.style.borderBottomRightRadius = r;
        }

        private static void Border(VisualElement e, Color c, float w)
        {
            e.style.borderTopColor = e.style.borderBottomColor = e.style.borderLeftColor = e.style.borderRightColor = c;
            e.style.borderTopWidth = e.style.borderBottomWidth = e.style.borderLeftWidth = e.style.borderRightWidth = w;
        }
    }
}
