// Uomd.Scenes: the battle screen (port of apps/game/src/scenes/BattleScene.ts).

using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Combat;
using Uomd.Contracts;
using Uomd.Core;
using Uomd.Core.Patching;
using Uomd.Narrative;
using Uomd.Platform;
using Uomd.UI;

namespace Uomd.Scenes
{
    /// <summary>
    /// Battle screen on the real deterministic engine (Uomd.Combat.Battle, a bit-exact port of @uomd/combat), presented like
    /// apps/game/src/scenes/BattleScene.ts: the location backdrop, the afk_faithful formation, SD chibi frame animation,
    /// plates with HP/Focus, the turn marker, skill cards (first tap selects, a second tap or a target confirms), event playback
    /// (strikes, floating numbers, heals, shields, defeats, waves) and the result. The recorded actions replay to the same
    /// logHash the server re-simulates.
    /// </summary>
    public sealed class BattleScreenController : IUomdScreenController
    {
        private const float CardWidth = 286f, CardHeight = 88f, CardGap = 36f;

        private readonly UomdSceneRouter _router;
        private readonly List<PlayerAction> _actions = new List<PlayerAction>();
        private readonly Dictionary<string, BattleUnitView> _views = new Dictionary<string, BattleUnitView>(StringComparer.Ordinal);
        private readonly Dictionary<string, Dictionary<string, Sprite>> _sprites = new Dictionary<string, Dictionary<string, Sprite>>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _skillText = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _roles = new Dictionary<string, string>(StringComparer.Ordinal);
        private Uomd.Combat.Battle _battle;
        private VisualElement _root;
        private VisualElement _world;
        private VisualElement _unitLayer;
        private VisualElement _plateLayer;
        private VisualElement _fxLayer;
        private VisualElement _dock;
        private VisualElement _turnBar;
        private Label _hint;
        private Label _desc;
        private Button _autoButton;
        private AwaitableCompletionSource<PlayerAction> _pending;
        private SkillOption _selected;
        private TurnPrompt _prompt;
        private readonly List<BattleUnitView> _lunged = new List<BattleUnitView>();
        private bool _auto;
        private int _generation;

        public UomdScreenId ScreenId => UomdScreenId.Battle;

        public BattleScreenController(UomdSceneRouter router) => _router = router;

        private bool Calm => _router.Session.ReducedMotion;

        public async Awaitable OnEnterAsync(VisualElement screenRoot)
        {
            int generation = ++_generation;
            _root = screenRoot;
            _views.Clear();
            _actions.Clear();
            _lunged.Clear();
            _auto = false;
            _pending = null;
            string encounterId = _router.Session.ActiveBattleEncounterId;
            _router.Audio.PlayBgmCue(AudioDirector.ResolveBattleMusicCue(encounterId, false));

            Dictionary<string, object> raw;
            try
            {
                string packJson = await _router.Patch.ReadTextAsync("units/unit_pack.json");
                string encounterJson = await _router.Patch.ReadTextAsync($"encounters/{encounterId}.json");
                raw = UomdJson.ParseObject(encounterJson);
                ReadSkillText(packJson);
                _battle = Uomd.Combat.Battle.Create(UnitPackDef.FromJson(packJson), EncounterDef.FromJson(encounterJson));
            }
            catch (Exception e)
            {
                Debug.LogError($"[Battle] encounter {encounterId} could not start: {e}");
                UomdUiKit.ShowToast(screenRoot, $"The battle could not start: {e.Message}");
                return;
            }

            BuildStage(raw);
            await LoadUnitArtAsync();
            if (generation != _generation) return;
            SyncViews();
            _ = RunAsync(generation);
        }

        private void ReadSkillText(string packJson)
        {
            _skillText.Clear();
            _roles.Clear();
            var pack = UomdJson.ParseObject(packJson);
            if (!(pack.TryGetValue("units", out object units) && units is List<object> list)) return;
            foreach (var u in list)
            {
                if (!(u is Dictionary<string, object> unit)) continue;
                _roles[Str(unit, "unit_id")] = Str(unit, "role");
                if (!(unit.TryGetValue("skills", out object skills) && skills is List<object> sk)) continue;
                foreach (var s in sk)
                {
                    if (s is Dictionary<string, object> skill && skill.TryGetValue("skill_id", out object id) && id is string sid
                        && skill.TryGetValue("description_en", out object d) && d is string text)
                    {
                        _skillText[sid] = text;
                    }
                }
            }
        }

        private static string Str(Dictionary<string, object> node, string key) => node.TryGetValue(key, out object v) && v is string s ? s : "";

        private void BuildStage(Dictionary<string, object> raw)
        {
            var stage = UomdScreenKit.Layer(_root, UomdThemeTokens.Void);
            stage.pickingMode = PickingMode.Position;
            var bg = UomdScreenKit.Backdrop(stage, _router.Media, _router.Media.Catalog.Background(Str(raw, "location_id")));
            bg.style.scale = new Scale(new Vector3(1.04f, 1.04f, 1f));
            UomdScreenKit.VerticalShade(stage, 0, 260, UomdThemeTokens.Void, 0f, 0.78f, fromBottom: true);
            UomdScreenKit.VerticalShade(stage, 0, 190, UomdThemeTokens.Void, 0.55f, 0f);

            // the formation lives in the 1920-wide reference band, centred on wider screens
            _world = new VisualElement { pickingMode = PickingMode.Ignore };
            _world.style.position = Position.Absolute;
            _world.style.left = new Length(50, LengthUnit.Percent);
            _world.style.marginLeft = -UomdScreenKit.RefWidth / 2f;
            _world.style.top = 0;
            _world.style.width = UomdScreenKit.RefWidth;
            _world.style.height = UomdScreenKit.RefHeight;
            stage.Add(_world);
            _unitLayer = UomdScreenKit.Layer(_world);
            _unitLayer.pickingMode = PickingMode.Ignore;
            _plateLayer = UomdScreenKit.Layer(_world);
            _fxLayer = UomdScreenKit.Layer(_world);

            string stageId = Str(raw, "stage_id"), title = Str(raw, "title_en");
            var head = UomdScreenKit.Text(stage, string.IsNullOrEmpty(stageId) ? title : $"{stageId}  ·  {title}", 32, UomdThemeTokens.GoldHi, 2f);
            head.AddToClassList("uomd-display");
            head.style.position = Position.Absolute;
            head.style.left = 60;
            head.style.top = 34;

            bool autoAllowed = !(raw.TryGetValue("ui", out object ui) && ui is Dictionary<string, object> u && u.TryGetValue("auto", out object a) && a is bool b && !b);
            if (autoAllowed) _autoButton = UomdScreenKit.AtRight(UomdScreenKit.MenuButton(stage, "AUTO", null, 176, 72, 24, false, ToggleAuto), 140, 66);

            _turnBar = new VisualElement { pickingMode = PickingMode.Ignore };
            _turnBar.style.position = Position.Absolute;
            _turnBar.style.left = 60;
            _turnBar.style.top = 128 - 27;
            _turnBar.style.height = 54;
            _turnBar.style.flexDirection = FlexDirection.Row;
            _turnBar.style.alignItems = Align.Center;
            stage.Add(_turnBar);
            _hint = UomdScreenKit.Centered(UomdScreenKit.Text(stage, "", 24, UomdThemeTokens.GoldHi, 2f), 0, 54);
            _hint.AddToClassList("uomd-display");
            _desc = UomdScreenKit.Centered(UomdScreenKit.Text(stage, "", 20, new Color(0.875f, 0.839f, 0.925f)), 0, 866);
            _desc.style.whiteSpace = WhiteSpace.Normal;
            _desc.style.width = 1360;
            _dock = UomdScreenKit.Layer(stage);
            _dock.pickingMode = PickingMode.Ignore;
        }

        private async Awaitable LoadUnitArtAsync()
        {
            var catalog = _router.Media.Catalog;
            foreach (var c in _battle.Combatants)
            {
                string unitId = c.Def.UnitId;
                if (_sprites.ContainsKey(unitId) || !catalog.TryGetUnitArt(unitId, out var art)) continue;
                var texture = await _router.Media.TextureAsync(art.AtlasPath);
                var frames = new Dictionary<string, Sprite>(StringComparer.Ordinal);
                if (texture != null)
                {
                    foreach (var kv in art.Frames)
                    {
                        var (x, y, w, h) = kv.Value;
                        // atlas frames are top-left [x, y, w, h]; Unity sprite rects are bottom-left
                        frames[kv.Key] = Sprite.Create(texture, new Rect(x, texture.height - (y + h), w, h), new Vector2(0.5f, 0f), 100f);
                    }
                }
                _sprites[unitId] = frames;
            }
        }

        /// <summary>Creates views for combatants that have none (start, reinforcements) and lays both sides out again.</summary>
        private void SyncViews()
        {
            foreach (string side in new[] { "player", "enemy" })
            {
                foreach (var (c, row, index, count) in VisualFormation(side))
                {
                    if (_views.ContainsKey(c.Id) || !_router.Media.Catalog.TryGetUnitArt(c.Def.UnitId, out var art)) continue;
                    var spot = UomdBattleFormation.SpotFor(side, row, index, count, _router.Session.BattleHudLayout);
                    var view = new BattleUnitView(_unitLayer, _plateLayer, c.Id, c.Def.NameEn, side, art,
                        _sprites.TryGetValue(c.Def.UnitId, out var frames) ? frames : new Dictionary<string, Sprite>(), spot, OnUnitTapped);
                    _views[c.Id] = view;
                }
            }
            // draw lower units in front
            foreach (var v in _views.Values.OrderBy(v => v.Y)) v.Root.BringToFront();
            Refresh();
        }

        /// <summary>
        /// BattleScene.visualFormationForSide: a side always reads as 2-front / 3-rear. An all-front wave keeps one unit in front
        /// (two when there are more than three) and moves the rest back; extra front units overflow to the rear, tanks first.
        /// </summary>
        private List<(Combatant c, string row, int index, int count)> VisualFormation(string side)
        {
            var list = _battle.Combatants.Where(c => c.Side == side && c.Objective == null && c.Alive).OrderBy(c => c.Slot).ToList();
            var rawFront = list.Where(c => c.Row == "front").ToList();
            var rawRear = list.Where(c => c.Row == "rear").ToList();
            var tank = new System.Text.RegularExpressions.Regex("pilgrim|knight|tank|guard|bulwark", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            List<Combatant> TanksFirst(List<Combatant> cs) => cs
                .Select((c, i) => (c, i))
                .OrderBy(x => tank.IsMatch(x.c.Def.UnitId + " " + (_roles.TryGetValue(x.c.Def.UnitId, out string role) ? role : "")) ? 0 : 1)
                .ThenBy(x => x.c.Slot).ThenBy(x => x.i).Select(x => x.c).ToList();
            List<Combatant> front, rear;
            if (rawFront.Count >= 2 && rawRear.Count == 0)
            {
                var sorted = TanksFirst(rawFront);
                int cap = rawFront.Count <= 3 ? 1 : 2;
                front = sorted.Take(cap).ToList();
                rear = sorted.Skip(cap).ToList();
            }
            else if (rawFront.Count > 2 && rawRear.Count < 3)
            {
                var sorted = TanksFirst(rawFront);
                front = sorted.Take(2).ToList();
                rear = sorted.Skip(2).Concat(rawRear).ToList();
            }
            else
            {
                front = rawFront;
                rear = rawRear;
            }
            return front.Select((c, i) => (c, "front", i, front.Count)).Concat(rear.Select((c, i) => (c, "rear", i, rear.Count))).ToList();
        }

        private void Refresh()
        {
            foreach (var c in _battle.Combatants)
            {
                if (!_views.TryGetValue(c.Id, out var v)) continue;
                v.SetHp(c.Hp, c.MaxHp);
                double ultimateCost = c.Def.Skills.Where(s => s.Type == "ultimate").Select(s => s.FocusCost).DefaultIfEmpty(0).Max();
                v.SetFocus(c.Focus, ultimateCost);
                if (c.Side == "enemy")
                {
                    var intent = c.Alive && _battle.Result == null ? _battle.IntentFor(c.Id) : null;
                    string target = intent?.TargetId != null ? _battle.Unit(intent.Value.TargetId).Def.NameEn.ToUpperInvariant() : null;
                    v.SetIntent(intent == null ? null : $"{(intent.Value.Announced ? "⚠ " : "")}{intent.Value.SkillName.ToUpperInvariant()}{(target != null ? $" → {target}" : "")}");
                }
            }
            RefreshTurnBar();
        }

        /// <summary>The next eight turns as medallions under the stage title (BattleScene.refreshHud).</summary>
        private void RefreshTurnBar()
        {
            _turnBar.Clear();
            var order = _battle.Result == null ? _battle.PreviewOrder(8) : new List<string>();
            if (order.Count == 0)
            {
                _turnBar.style.display = DisplayStyle.None;
                return;
            }
            _turnBar.style.display = DisplayStyle.Flex;
            _turnBar.style.backgroundColor = new Color(0.047f, 0.027f, 0.078f, 0.82f);
            _turnBar.style.borderTopLeftRadius = _turnBar.style.borderTopRightRadius = _turnBar.style.borderBottomLeftRadius = _turnBar.style.borderBottomRightRadius = 12;
            var rim = new Color(UomdThemeTokens.Gold.r, UomdThemeTokens.Gold.g, UomdThemeTokens.Gold.b, 0.52f);
            _turnBar.style.borderTopColor = _turnBar.style.borderBottomColor = _turnBar.style.borderLeftColor = _turnBar.style.borderRightColor = rim;
            _turnBar.style.borderTopWidth = _turnBar.style.borderBottomWidth = _turnBar.style.borderLeftWidth = _turnBar.style.borderRightWidth = 1.5f;
            _turnBar.style.paddingLeft = 16;
            _turnBar.style.paddingRight = 12;
            var label = UomdScreenKit.Text(_turnBar, "TURN", 14, UomdThemeTokens.GoldHi, 1f, bold: true);
            label.AddToClassList("uomd-display");
            label.style.marginRight = 14;
            for (int i = 0; i < order.Count; i++)
            {
                bool current = i == 0;
                var c = _battle.Unit(order[i]);
                float size = current ? 48f : 40f;
                var chip = new VisualElement { pickingMode = PickingMode.Ignore };
                chip.style.width = chip.style.height = size;
                chip.style.marginRight = 54 - size;
                chip.style.overflow = Overflow.Hidden;
                chip.style.borderTopLeftRadius = chip.style.borderTopRightRadius = chip.style.borderBottomLeftRadius = chip.style.borderBottomRightRadius = size / 2f;
                var ring = current ? UomdThemeTokens.GoldHi : c.Side == "player" ? UomdThemeTokens.PlayerSide : UomdThemeTokens.EnemySide;
                chip.style.borderTopColor = chip.style.borderBottomColor = chip.style.borderLeftColor = chip.style.borderRightColor = ring;
                chip.style.borderTopWidth = chip.style.borderBottomWidth = chip.style.borderLeftWidth = chip.style.borderRightWidth = current ? 2.5f : 1.5f;
                chip.style.backgroundColor = new Color(0.071f, 0.039f, 0.094f, 1f);
                if (_views.TryGetValue(c.Id, out var view) && view.IdleSprite != null)
                {
                    // the head: the idle frame scaled up and anchored at the top
                    var face = new VisualElement { pickingMode = PickingMode.Ignore };
                    face.style.position = Position.Absolute;
                    face.style.width = size * 1.9f;
                    face.style.height = size * 1.9f * view.IdleSprite.rect.height / Mathf.Max(1f, view.IdleSprite.rect.width);
                    face.style.left = -size * 0.45f;
                    face.style.top = -size * 0.12f;
                    face.style.backgroundImage = new StyleBackground(view.IdleSprite);
                    face.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
                    chip.Add(face);
                }
                _turnBar.Add(chip);
            }
        }

        private async Awaitable RunAsync(int generation)
        {
            var step = _battle.Advance();
            await PlayEventsAsync(step.Events, generation);
            while (generation == _generation && _battle.Result == null)
            {
                PlayerAction action;
                if (_auto)
                {
                    await Awaitable.WaitForSecondsAsync(0.38f);
                    if (generation != _generation) return;
                    action = _battle.AutoAction();
                }
                else
                {
                    action = await AwaitPlayerActionAsync(_battle.Prompt());
                    if (generation != _generation) return;
                }
                _actions.Add(action);
                try
                {
                    step = _battle.Act(action);
                }
                catch (IllegalActionException e)
                {
                    _actions.RemoveAt(_actions.Count - 1);
                    UomdUiKit.ShowToast(_root, e.Message);
                    continue;
                }
                await PlayEventsAsync(step.Events, generation);
            }
            if (generation == _generation && _battle.Result != null) ShowResult(_battle.Result);
        }

        private Awaitable<PlayerAction> AwaitPlayerActionAsync(TurnPrompt prompt)
        {
            _pending = new AwaitableCompletionSource<PlayerAction>();
            _prompt = prompt;
            BuildSkillDock(prompt);
            return _pending.Awaitable;
        }

        private void Submit(PlayerAction action)
        {
            var pending = _pending;
            if (pending == null) return;
            _pending = null;
            ClearSkillDock();
            _router.Audio.PlaySfx("sfx_ui_confirm");
            pending.SetResult(action);
        }

        private void BuildSkillDock(TurnPrompt prompt)
        {
            ClearSkillDock();
            var actor = _battle.Unit(prompt.Actor);
            if (_views.TryGetValue(prompt.Actor, out var view)) view.SetActive(true);
            _hint.text = $"{actor.Def.NameEn.ToUpperInvariant()}'S TURN";
            var passive = actor.Def.Skills.FirstOrDefault(s => s.Type == "passive");
            _desc.text = passive != null ? $"Passive — {passive.NameEn}: {SkillText(passive.SkillId)}" : "";
            int n = prompt.Options.Count;
            float x0 = -((n - 1) * (CardWidth + CardGap)) / 2f;
            for (int i = 0; i < n; i++)
            {
                var o = prompt.Options[i];
                bool ultimate = o.Type == "ultimate";
                string kind = ultimate ? "★ ULTIMATE" : o.Type == "basic" ? "BASIC" : "SKILL";
                string sub = o.Available ? kind : o.Reason == "cooldown" ? $"CD {o.CooldownLeft}T" : $"FOCUS {actor.Focus}/{o.Def.FocusCost}";
                var card = UomdScreenKit.MenuButton(_dock, o.Name.ToUpperInvariant(), sub, CardWidth, CardHeight, 22, ultimate, () => OnSkillTapped(o));
                UomdScreenKit.Centered(card, x0 + i * (CardWidth + CardGap), 964);
                card.SetEnabled(o.Available);
                card.style.opacity = o.Available ? 1f : 0.44f;
                card.userData = o.SkillId;
            }
        }

        private string SkillText(string skillId) => _skillText.TryGetValue(skillId, out string text) ? text : "";

        private void ClearSkillDock()
        {
            _dock.Clear();
            _selected = null;
            _hint.text = "";
            _desc.text = "";
            foreach (var v in _views.Values)
            {
                v.SetSelectable(false);
                v.SetActive(false);
            }
        }

        private void OnSkillTapped(SkillOption o)
        {
            if (!o.Available || _pending == null) return;
            if (_selected != null && _selected.SkillId == o.SkillId)
            {
                // a second tap confirms when the skill needs no target or has a single legal one
                if (!o.NeedsTarget) Submit(new PlayerAction(o.SkillId));
                else if (o.LegalTargets.Count == 1) Submit(new PlayerAction(o.SkillId, o.LegalTargets[0]));
                return;
            }
            _selected = o;
            _router.Audio.PlaySfx("sfx_ui_tap");
            foreach (var card in _dock.Children())
            {
                bool selected = (card.userData as string) == o.SkillId;
                card.style.marginTop = selected ? -8 : 0;
                if (selected) card.AddToClassList("uomd-btn-primary");
                else if (!(_prompt?.Options.FirstOrDefault(x => x.SkillId == (card.userData as string))?.Type == "ultimate")) card.RemoveFromClassList("uomd-btn-primary");
            }
            foreach (var v in _views.Values) v.SetSelectable(false);
            _desc.text = SkillText(o.SkillId);
            if (o.NeedsTarget)
            {
                _hint.text = o.LegalTargets.Count == 1 ? "TAP THE SKILL AGAIN OR THE TARGET" : "CHOOSE A TARGET";
                foreach (string id in o.LegalTargets) if (_views.TryGetValue(id, out var v)) v.SetSelectable(true);
            }
            else
            {
                _hint.text = "TAP AGAIN TO CAST";
            }
        }

        private void OnUnitTapped(BattleUnitView view)
        {
            var o = _selected;
            if (o == null || !o.NeedsTarget || !o.LegalTargets.Contains(view.Id)) return;
            Submit(new PlayerAction(o.SkillId, view.Id));
        }

        /// <summary>True once the engine has a result (the capture pipeline waits for it).</summary>
        public bool Finished => _battle?.Result != null;

        /// <summary>Turns AUTO on (capture pipeline QA; the player uses the AUTO button).</summary>
        public void EnableAuto()
        {
            if (!_auto) ToggleAuto();
        }

        private void ToggleAuto()
        {
            _auto = !_auto;
            if (_auto) _autoButton?.AddToClassList("uomd-btn-primary");
            else _autoButton?.RemoveFromClassList("uomd-btn-primary");
            if (_auto && _pending != null && _battle.Result == null) Submit(_battle.AutoAction());
        }

        private async Awaitable PlayEventsAsync(List<Dictionary<string, object>> events, int generation)
        {
            foreach (var e in events)
            {
                if (generation != _generation) return;
                float wait = Present(e);
                if (wait > 0f) await Awaitable.WaitForSecondsAsync(Calm ? wait * 0.6f : wait);
            }
            if (generation != _generation) return;
            await SettleAsync();
            Refresh();
        }

        private static string S(Dictionary<string, object> e, string key) => e.TryGetValue(key, out object v) && v != null ? Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture) : "";
        private static double N(Dictionary<string, object> e, string key) => e.TryGetValue(key, out object v) && v != null ? Convert.ToDouble(v, System.Globalization.CultureInfo.InvariantCulture) : 0;
        private static bool B(Dictionary<string, object> e, string key) => e.TryGetValue(key, out object v) && v is bool b && b;

        /// <summary>Shows one engine event and returns how long to hold before the next (BattleScene.present timings).</summary>
        private float Present(Dictionary<string, object> e)
        {
            string type = S(e, "type");
            switch (type)
            {
                case "turn_start":
                {
                    foreach (var v in _views.Values) v.SetActive(false);
                    if (_views.TryGetValue(S(e, "actor"), out var actor))
                    {
                        actor.SetActive(true);
                        return actor.Side == "enemy" ? 0.22f : 0f;
                    }
                    return 0f;
                }
                case "skill_used":
                {
                    if (!_views.TryGetValue(S(e, "actor"), out var actor)) return 0.2f;
                    string skillType = S(e, "skillType");
                    var def = _battle.Unit(actor.Id).Def.Skills.FirstOrDefault(s => s.SkillId == S(e, "skill"));
                    if (skillType == "ultimate" || skillType == "active") Banner(def?.NameEn ?? S(e, "skill"), skillType == "ultimate");
                    var targets = e.TryGetValue("targets", out object t) && t is IEnumerable<object> list ? list.Select(x => x as string).Where(x => x != null).ToList() : new List<string>();
                    string state = skillType == "ultimate" ? "ultimate" : skillType == "active" ? "active" : "basic";
                    // a basic strike on one opponent closes the distance first
                    if (skillType == "basic" && targets.Count == 1 && _views.TryGetValue(targets[0], out var opp) && opp.Side != actor.Side && !Calm)
                    {
                        actor.Play("walk");
                        actor.MoveTo(opp.X + (actor.Side == "player" ? -135f : 135f), opp.Y, 240, Calm);
                        if (!_lunged.Contains(actor)) _lunged.Add(actor);
                        UomdScreenKit.After(actor.Root, 240, () => actor.Play(state));
                        return 0.5f;
                    }
                    actor.Play(state);
                    _router.Audio.PlaySfx(skillType == "ultimate" ? "sfx_blade_heavy" : "sfx_blade_slash");
                    return skillType == "basic" ? 0.28f : 0.36f;
                }
                case "damage":
                {
                    if (!_views.TryGetValue(S(e, "target"), out var target)) return 0.2f;
                    bool crit = B(e, "crit");
                    double amount = N(e, "amount"), absorbed = N(e, "absorbed");
                    target.Play("hit");
                    if (amount > 0) Float(target, crit ? $"-{amount}!" : $"-{amount}", crit ? new Color(1f, 0.847f, 0.420f) : Color.white, crit ? 64 : 46);
                    if (absorbed > 0) Float(target, amount == 0 ? "⛨ BLOCKED" : $"({absorbed} absorbed)", UomdThemeTokens.Shield, 30, amount == 0 ? 0 : 80);
                    var c = _battle.Unit(target.Id);
                    target.SetHp(N(e, "hpAfter"), c.MaxHp);
                    return crit ? 0.36f : 0.27f;
                }
                case "heal":
                {
                    if (!_views.TryGetValue(S(e, "target"), out var target)) return 0.1f;
                    Float(target, $"+{N(e, "amount")}", new Color(0.561f, 0.890f, 0.627f), 44);
                    target.SetHp(N(e, "hpAfter"), _battle.Unit(target.Id).MaxHp);
                    return 0.26f;
                }
                case "shield":
                    if (_views.TryGetValue(S(e, "target"), out var shielded)) Float(shielded, $"⛨ +{N(e, "amount")} SHIELD", UomdThemeTokens.Shield, 34);
                    return 0.2f;
                case "status_applied":
                    if (_views.TryGetValue(S(e, "target"), out var affected)) Float(affected, S(e, "status").Replace('_', ' ').ToUpperInvariant(), new Color(1f, 0.478f, 0.588f), 32);
                    return 0.19f;
                case "focus":
                {
                    if (!_views.TryGetValue(S(e, "unit"), out var v)) return 0f;
                    var c = _battle.Unit(v.Id);
                    double cost = c.Def.Skills.Where(s => s.Type == "ultimate").Select(s => s.FocusCost).DefaultIfEmpty(0).Max();
                    v.SetFocus(N(e, "total"), cost);
                    if (cost > 0 && N(e, "total") >= cost && N(e, "total") - N(e, "delta") < cost) Float(v, "ULTIMATE READY", UomdThemeTokens.GoldHi, 30);
                    return 0f;
                }
                case "turn_skipped":
                    if (_views.TryGetValue(S(e, "actor"), out var skipped)) Float(skipped, "◆ STAGGERED", new Color(1f, 0.478f, 0.588f), 34);
                    return 0.4f;
                case "defeat":
                    if (_views.TryGetValue(S(e, "unit"), out var fallen)) fallen.Defeat(Calm);
                    return 0.56f;
                case "wave_start":
                    _ = AddWaveAsync();
                    Banner($"WAVE {N(e, "wave")}", false);
                    return 0.6f;
                default:
                    return 0f;
            }
        }

        private async Awaitable AddWaveAsync()
        {
            await LoadUnitArtAsync();
            SyncViews();
        }

        /// <summary>Every unit that closed in during this step walks back to its spot (several can, with follow-ups).</summary>
        private async Awaitable SettleAsync()
        {
            if (_lunged.Count == 0) return;
            var moved = _lunged.ToList();
            _lunged.Clear();
            foreach (var unit in moved)
            {
                if (unit.Alive) unit.Play("walk");
                unit.MoveTo(unit.X, unit.Y, 220, Calm);
            }
            await Awaitable.WaitForSecondsAsync(0.24f);
            foreach (var unit in moved) if (unit.Alive) unit.Play("idle");
        }

        private void Float(BattleUnitView v, string text, Color color, float size, float dx = 0f)
        {
            var label = UomdScreenKit.Text(_fxLayer, text, size, color, 1f, bold: true);
            label.AddToClassList("uomd-display");
            label.style.position = Position.Absolute;
            label.style.left = v.X + dx - 200f;
            label.style.width = 400f;
            label.style.top = v.HeadY + 30f;
            UomdScreenKit.Move(label, 0, -115, 1100, 0, Calm, EasingMode.EaseOutCubic);
            UomdScreenKit.Fade(label, 0f, 580, 520, Calm);
            UomdScreenKit.After(_fxLayer, 1200, () => label.RemoveFromHierarchy());
        }

        private void Banner(string text, bool ultimate)
        {
            var box = new VisualElement { pickingMode = PickingMode.Ignore };
            box.AddToClassList("uomd-panel");
            box.style.paddingLeft = box.style.paddingRight = 60;
            box.style.paddingTop = box.style.paddingBottom = 14;
            if (ultimate) box.style.backgroundColor = new Color(UomdThemeTokens.Crimson.r, UomdThemeTokens.Crimson.g, UomdThemeTokens.Crimson.b, 0.9f);
            var label = UomdScreenKit.Text(box, text.ToUpperInvariant(), ultimate ? 52 : 40, UomdThemeTokens.GoldHi, 3f);
            label.AddToClassList("uomd-display");
            _fxLayer.Add(box);
            UomdScreenKit.Centered(box, 0, 282);
            box.style.opacity = 0f;
            UomdScreenKit.Fade(box, 1f, 190, 0, Calm);
            UomdScreenKit.Fade(box, 0f, 240, ultimate ? 900 : 640, Calm);
            UomdScreenKit.After(_fxLayer, (ultimate ? 900 : 640) + 300, () => box.RemoveFromHierarchy());
        }

        private void ShowResult(BattleResult result)
        {
            ClearSkillDock();
            bool won = result.Winner == "player";
            foreach (var v in _views.Values) if (v.Alive && v.Side == (won ? "player" : "enemy")) v.Play("victory");
            _router.Audio.PlaySfx(won ? "sfx_bell_sanctuary" : "sfx_bell_silver");
            var veil = UomdScreenKit.Layer(_root, new Color(0.020f, 0.012f, 0.039f, 0.72f));
            veil.pickingMode = PickingMode.Position;
            var title = UomdScreenKit.Centered(UomdScreenKit.Text(veil, won ? "VICTORY" : "DEFEAT", 96, won ? UomdThemeTokens.GoldHi : new Color(1f, 0.478f, 0.588f), 8f), 0, 360);
            title.AddToClassList("uomd-display");
            var stars = UomdScreenKit.Centered(UomdScreenKit.Text(veil, new string('★', result.Stars) + new string('☆', Math.Max(0, 3 - result.Stars)), 72, UomdThemeTokens.GoldHi, 12f), 0, 470);
            string hash = BattleReplay.LogHash(_battle);
            UomdScreenKit.Centered(UomdScreenKit.Text(veil, $"{result.Turns} turns  ·  {_actions.Count} actions  ·  logHash {hash.Substring(0, 12)}", 24, UomdThemeTokens.TextDim), 0, 550);
            Action next = _router.EntryFlow.InEntryBattle
                ? () => _ = _router.EntryFlow.BattleFinishedAsync(won)
                : () => _ = _router.NavigateToAsync(UomdScreenId.Home);
            string label = _router.EntryFlow.InEntryBattle && !won ? "TRY AGAIN" : "CONTINUE";
            UomdScreenKit.Centered(UomdScreenKit.MenuButton(veil, label, null, 500, 104, 34, true, next), 0, 680);
            veil.style.opacity = 0f;
            UomdScreenKit.Fade(veil, 1f, 600, 400, Calm);
            stars.style.scale = new Scale(new Vector3(1.3f, 1.3f, 1f));
            UomdScreenKit.ScaleTo(stars, 1f, 420, 600, Calm, EasingMode.EaseOutBack);
        }

        public void OnTick(float deltaTime)
        {
            foreach (var v in _views.Values) v.Tick(deltaTime);
        }

        public void OnExit()
        {
            _generation++;
            _pending = null;
            foreach (var frames in _sprites.Values)
            {
                foreach (var sprite in frames.Values) if (sprite != null) UnityEngine.Object.Destroy(sprite);
            }
            _sprites.Clear();
            _views.Clear();
        }
    }
}
