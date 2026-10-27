using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Combat;
using Uomd.Core;
using Uomd.Core.Vfx;

namespace Uomd.Scenes
{
    /// <summary>Native tutorial presentation over the unchanged deterministic Battle/PlayerAction contract.</summary>
    public sealed partial class BattleScreenController
    {
        private bool _native, _nativeReady, _nativePaused;
        private string _nativeState = "inactive", _chosenTarget;
        private VisualElement _nativeRoot, _nativeLoad, _nativePausePanel, _nativeResult, _nativeTargets;
        private Button _nativePauseButton, _nativeResume, _nativeRetry, _nativeCast, _nativeContinue;
        private readonly HashSet<string> _nativePaths = new HashSet<string>(StringComparer.Ordinal);
        private readonly Dictionary<string, Button> _nativeSkills = new Dictionary<string, Button>(StringComparer.Ordinal);
        private readonly Dictionary<string, Button> _nativeTargetButtons = new Dictionary<string, Button>(StringComparer.Ordinal);

        public static bool IsRebuiltTutorialEncounter(string id) => id == "tutorial_t1" || id == "tutorial_t2" || id == "tutorial_t3";
        private bool BattleReview
        {
            get
            {
#if UNITY_EDITOR
                return UomdEditorPreviewIsolation.Active && _router.ProductionPreview?.scenario.StartsWith("battle/", StringComparison.Ordinal) == true;
#else
                return false;
#endif
            }
        }
        private bool BattlePaused
        {
            get
            {
#if UNITY_EDITOR
                if ((BattleReview || UomdEditorPreviewIsolation.Active && (_router.ProductionPreview?.scenario == "entry" || _router.ProductionPreview?.scenario == "campaign")) && _router.ProductionPreview.paused) return true;
#endif
                return _nativePaused;
            }
        }
#if UNITY_EDITOR
        public bool ReviewPaused => BattlePaused;
        public bool AwaitingPlayer => _nativeReady && _pending != null && _battle?.Result == null;
        public TurnPrompt ReviewPrompt => _pending != null ? _prompt : null;
        public PlayerAction[] ReviewActions => _actions.ToArray();
        public string ReviewLogHash => _battle == null ? "" : BattleReplay.LogHash(_battle);
        public string ReviewPresentationState => _nativeState;
        public string[] ReviewImagePaths => _nativePaths.OrderBy(p => p, StringComparer.Ordinal).ToArray();
        public BattleResult ReviewResult => _battle?.Result;
#endif

        private bool TryUnitArt(string unit, out UnitArt art) => _router.Media.Catalog.TryGetUnitArt(_native ? "sol_" + unit : unit, out art);

        private void BuildNativeRoot()
        {
            var tree = Resources.Load<VisualTreeAsset>("Rebuild/Battle");
            if (tree == null) throw new InvalidOperationException("Rebuild/Battle.uxml is missing.");
            tree.CloneTree(_root);
            _nativeRoot = _root.Q("rebuildBattle");
            _world = _nativeRoot.Q("battleWorld");
            _unitLayer = _nativeRoot.Q("battleUnits");
            _plateLayer = _nativeRoot.Q("battlePlates");
            _vfxGround = _nativeRoot.Q("battleGroundFx");
            _vfxFx = _nativeRoot.Q("battleFrontFx");
            _fxLayer = _nativeRoot.Q("battleNumbers");
            _vfxOverlay = _nativeRoot.Q("battleOverlayFx");
            _turnBar = _nativeRoot.Q("battleTurns");
            _dock = _nativeRoot.Q("battleSkills");
            _hint = _nativeRoot.Q<Label>("battleHint");
            _desc = _nativeRoot.Q<Label>("battleDescription");
            _nativeTargets = _nativeRoot.Q("battleTargets");
            _nativeLoad = _nativeRoot.Q("battleLoad");
            _nativePausePanel = _nativeRoot.Q("battlePaused");
            _nativeResult = _nativeRoot.Q("battleResult");
            _nativePauseButton = _nativeRoot.Q<Button>("battlePause");
            _nativeResume = _nativeRoot.Q<Button>("battleResume");
            _nativeRetry = _nativeRoot.Q<Button>("battleRetry");
            _nativeCast = _nativeRoot.Q<Button>("battleCast");
            _nativeContinue = _nativeRoot.Q<Button>("battleContinue");
            _nativePauseButton.clicked += ToggleNativePause;
            _nativeResume.clicked += ToggleNativePause;
            _nativeRetry.clicked += RestartNativeBattle;
            _nativeCast.clicked += CastNativeSkill;
            _nativeRoot.RegisterCallback<GeometryChangedEvent>(OnNativeGeometry);
            _nativeRoot.RegisterCallback<KeyDownEvent>(OnNativeKey);
            _nativeRetry.style.display = DisplayStyle.None;
            _nativePauseButton.SetEnabled(false);
            _nativeCast.SetEnabled(false);
            _nativeState = "loading";
            _vfx = new UomdVfxPlayer(_vfxGround, _vfxFx, _vfxOverlay, () => new VfxEnvironment
            { Particles = true, ParticleDensity = 1, ReducedMotion = Calm, ReduceFlash = _router.Session.ReduceFlash });
            _hitStopLeft = _shakeLeft = 0f;
        }

        private void ConfigureNativeStage(Dictionary<string, object> raw)
        {
            _nativeRoot.Q<Label>("battleTitle").text = Str(raw, "stage_id") + " · " + Str(raw, "title_en");
        }

        private async Awaitable LoadNativeBackgroundAsync(Dictionary<string, object> raw, int generation)
        {
            string path = _router.Media.Catalog.Background("sol_" + Str(raw, "location_id"));
            if (path == null) throw new InvalidOperationException("Rebuilt tutorial stage is missing.");
            var texture = await _router.Media.TextureAsync(path);
            if (generation != _generation) return;
            if (texture == null) throw new InvalidOperationException("Rebuilt tutorial stage could not load.");
            _nativePaths.Add(path);
            _nativeRoot.Q("battleBackground").style.backgroundImage = new StyleBackground(texture);
        }

        private void NativeAssetsReady()
        {
            _nativeReady = true;
            _nativeState = "presenting";
            _nativeLoad.style.display = DisplayStyle.None;
            _nativePauseButton.SetEnabled(true);
            _nativeRoot.Focus();
            LayoutNativeWorld();
        }

        private void ShowNativeFailure(string message)
        {
            _nativeReady = false;
            _nativeState = "error";
            _nativeLoad.style.display = DisplayStyle.Flex;
            _nativeRoot.Q<Label>("battleLoadTitle").text = "THE BATTLE COULD NOT BE LOADED";
            _nativeRoot.Q<Label>("battleLoadText").text = message + " Your progress has not changed.";
            _nativeRetry.style.display = DisplayStyle.Flex;
            _nativePauseButton.SetEnabled(false);
            _router.Audio.StopBgm(0.01f);
            _nativeRetry.Focus();
        }

        private void RestartNativeBattle() => _ = _router.NavigateToAsync(UomdScreenId.Battle);
        private void OnNativeGeometry(GeometryChangedEvent evt) => LayoutNativeWorld();
        private void LayoutNativeWorld()
        {
            float height = _nativeRoot.resolvedStyle.height, width = _nativeRoot.resolvedStyle.width;
            if (float.IsNaN(height) || float.IsNaN(width)) return;
            _world.style.top = Mathf.Max(0, (height - 1080f) * 0.4f);
            _nativeRoot.EnableInClassList("battle-compact", width < 1700);
        }

        public static BattleSpot NativeSpot(string side, string row, int index, int count)
        {
            double y = row == "rear" && count > 1 ? 455 : count <= 1 ? row == "front" ? 585 : 490 : 455 + 135.0 * index / Math.Max(1, count - 1);
            // Tutorial T3 has two rear enemies. Spread their bodies and plates horizontally rather than stacking them.
            double x = row == "front" ? 650 : count == 2 ? 140 + 270 * index : count > 2 ? 100 + 250 * index : 350;
            return new BattleSpot(side == "player" ? x : 1920 - x, y, 1);
        }

        private void RefreshNativeTurnBar()
        {
            _turnBar.Clear();
            if (_battle.Result != null) return;
            int i = 0;
            foreach (string id in _battle.PreviewOrder(8))
            {
                var label = new Label(_battle.Unit(id).Def.NameEn.ToUpperInvariant()) { pickingMode = PickingMode.Ignore };
                label.AddToClassList("battle-chip");
                label.EnableInClassList("is-current", i++ == 0);
                _turnBar.Add(label);
            }
        }

        private void BuildNativeSkillDock(TurnPrompt prompt)
        {
            ClearNativeDock();
            _nativeState = "awaiting_action";
            var actor = _battle.Unit(prompt.Actor);
            if (_views.TryGetValue(prompt.Actor, out var view)) view.SetActive(true);
            _hint.text = actor.Def.NameEn.ToUpperInvariant() + " · CHOOSE A SKILL";
            var passive = actor.Def.Skills.FirstOrDefault(s => s.Type == "passive");
            _desc.text = passive == null ? "Choose a skill, choose its target, then confirm." : "Passive — " + passive.NameEn + ": " + SkillText(passive.SkillId);
            foreach (var option in prompt.Options)
            {
                var selected = option;
                var button = new Button(() => SelectNativeSkill(selected)) { name = "battleSkill_" + option.SkillId, tooltip = SkillText(option.SkillId), userData = option.SkillId };
                button.AddToClassList("battle-button"); button.AddToClassList("battle-skill");
                var title = new Label(option.Name) { pickingMode = PickingMode.Ignore };
                title.AddToClassList("battle-skill-name"); button.Add(title);
                string detail = option.Type.ToUpperInvariant();
                if (!option.Available) detail = option.Reason == "cooldown" ? "COOLDOWN · " + option.CooldownLeft + " TURNS" : "FOCUS · " + actor.Focus + "/" + option.Def.FocusCost;
                var kind = new Label(detail) { pickingMode = PickingMode.Ignore }; kind.AddToClassList("battle-skill-kind"); button.Add(kind);
                button.SetEnabled(option.Available);
                _nativeSkills[option.SkillId] = button;
                _dock.Add(button);
            }
        }

        private void ClearNativeDock()
        {
            _dock.Clear(); _nativeTargets.Clear(); _nativeSkills.Clear(); _nativeTargetButtons.Clear();
            _selected = null; _chosenTarget = null;
            _nativeCast.SetEnabled(false); _nativeCast.text = "CONFIRM";
            _hint.text = "RESOLVING THE TURN"; _desc.text = "";
            _nativeState = "presenting";
            foreach (var view in _views.Values) { view.SetSelectable(false); view.SetActive(false); }
        }

        private void SelectNativeSkill(SkillOption option)
        {
            if (!option.Available || _pending == null || BattlePaused || _prompt == null || !_prompt.Options.Contains(option)) return;
            _selected = option; _chosenTarget = null;
            _nativeTargets.Clear(); _nativeTargetButtons.Clear();
            _router.Audio.PlaySfx("sfx_ui_tap");
            foreach (var pair in _nativeSkills) pair.Value.EnableInClassList("is-selected", pair.Key == option.SkillId);
            foreach (var view in _views.Values) view.SetSelectable(false);
            _desc.text = SkillText(option.SkillId);
            if (!option.NeedsTarget)
            {
                _hint.text = option.Name.ToUpperInvariant() + " · READY";
                _nativeCast.SetEnabled(true);
                _nativeCast.text = "USE SKILL";
                return;
            }
            _hint.text = option.Name.ToUpperInvariant() + " · CHOOSE A TARGET";
            foreach (string id in option.LegalTargets)
            {
                string target = id;
                var combatant = _battle.Unit(id);
                var button = new Button(() => SelectNativeTarget(target)) { name = "battleTarget_" + id, text = combatant.Def.NameEn + " · " + (combatant.Slot + 1) };
                button.AddToClassList("battle-button"); button.AddToClassList("battle-target");
                _nativeTargets.Add(button); _nativeTargetButtons[id] = button;
                if (_views.TryGetValue(id, out var view)) view.SetSelectable(true);
            }
            _nativeCast.SetEnabled(false);
            if (option.LegalTargets.Count == 1) SelectNativeTarget(option.LegalTargets[0]);
        }

        private void SelectNativeTarget(string id)
        {
            if (_selected == null || _pending == null || BattlePaused || !_selected.NeedsTarget || !_selected.LegalTargets.Contains(id)) return;
            _chosenTarget = id;
            foreach (var pair in _nativeTargetButtons) pair.Value.EnableInClassList("is-selected", pair.Key == id);
            _hint.text = _selected.Name.ToUpperInvariant() + " → " + _battle.Unit(id).Def.NameEn.ToUpperInvariant();
            _nativeCast.text = "CONFIRM"; _nativeCast.SetEnabled(true);
        }

        private void CastNativeSkill()
        {
            if (_pending == null || _selected == null || BattlePaused) return;
            if (_selected.NeedsTarget && (_chosenTarget == null || !_selected.LegalTargets.Contains(_chosenTarget))) return;
            Submit(new PlayerAction(_selected.SkillId, _selected.NeedsTarget ? _chosenTarget : null));
        }

        private void ToggleNativePause()
        {
            if (!_nativeReady) return;
            _nativePaused = !_nativePaused;
            _nativePausePanel.EnableInClassList("is-hidden", !_nativePaused);
            _router.Audio.SetPaused(BattlePaused);
            if (_nativePaused) _nativeResume.Focus(); else _nativePauseButton.Focus();
        }
        private void OnNativeKey(KeyDownEvent evt)
        {
            if (evt.keyCode != KeyCode.Escape) return;
            ToggleNativePause(); evt.StopPropagation();
        }

        private async Awaitable WaitForBattleAsync(float seconds)
        {
            if (!_native) { await Awaitable.WaitForSecondsAsync(seconds); return; }
            int generation = _generation;
            while (seconds > 0)
            {
                await Awaitable.NextFrameAsync();
                if (generation != _generation) throw new OperationCanceledException();
                if (!BattlePaused) seconds -= Time.deltaTime;
            }
        }

        private void ShowNativeResult(BattleResult result)
        {
            ClearNativeDock(); _nativeState = "result";
            bool won = result.Winner == "player";
            if (won && !BattleReview) _router.EntryFlow?.BattleWon(_entryScope);
            foreach (var view in _views.Values) if (view.Alive && view.Side == (won ? "player" : "enemy")) view.Play("victory");
            _router.Audio.PlaySfx(won ? "sfx_bell_sanctuary" : "sfx_bell_silver");
            _nativeRoot.Q<Label>("battleOutcome").text = won ? "VICTORY" : "DEFEAT";
            _nativeRoot.Q<Label>("battleStars").text = new string('★', result.Stars) + new string('☆', Math.Max(0, 3 - result.Stars));
            _nativeRoot.Q<Label>("battleSummary").text = result.Turns + " turns · " + _actions.Count + " actions" + (BattleReview ? "\nLocal review · progress untouched" : "");
            _nativeContinue.text = BattleReview ? "RESTART REVIEW" : won ? "CONTINUE" : "TRY AGAIN";
            _nativeContinue.clicked += ContinueNativeResult;
            _nativeResult.RemoveFromClassList("is-hidden");
            _nativeContinue.Focus();
        }

        private void ContinueNativeResult()
        {
            if (BattlePaused || _battle?.Result == null) return;
            if (BattleReview) { RestartNativeBattle(); return; }
            var result = _battle.Result;
            var flow = _router.EntryFlow;
            _nativeContinue.SetEnabled(false);
            if (flow.InEntryBattle || flow.InCampaignBattle) _ = flow.BattleFinishedAsync(result.Winner == "player", result.Stars, _entryScope);
            else if (result.Winner != "player") RestartNativeBattle();
            else _ = _router.NavigateToAsync(UomdScreenId.Home);
        }

        private void UnbindNative()
        {
            _nativeRoot.UnregisterCallback<GeometryChangedEvent>(OnNativeGeometry);
            _nativeRoot.UnregisterCallback<KeyDownEvent>(OnNativeKey);
            _nativePauseButton.clicked -= ToggleNativePause; _nativeResume.clicked -= ToggleNativePause;
            _nativeRetry.clicked -= RestartNativeBattle; _nativeCast.clicked -= CastNativeSkill;
            _nativeContinue.clicked -= ContinueNativeResult;
            _nativeReady = false; _nativeState = "inactive";
            _router.Audio.SetPaused(false);
        }
    }
}
