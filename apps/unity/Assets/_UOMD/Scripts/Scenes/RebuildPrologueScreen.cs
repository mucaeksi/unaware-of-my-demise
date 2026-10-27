using System;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Contracts;
using Uomd.Core;
using Uomd.Narrative;
using Uomd.UI;

namespace Uomd.Scenes
{
    /// <summary>D-35 opening: individually authored plates, native URP stage, audio-clock captions and durable entry flow.</summary>
    public sealed class RebuildPrologueScreen : IUomdScreenController
    {
        private readonly UomdSceneRouter _router;
        private readonly CinematicShotClock _clock = new CinematicShotClock();
        private readonly SubtitleSynchronizer _subtitles = new SubtitleSynchronizer();
        private PrologueSceneDto[] _scenes = Array.Empty<PrologueSceneDto>();
        private RebuildCinematicStage _stage;
        private VisualElement _root, _end, _fill;
        private Label _caption, _body, _number, _status, _endTitle, _endBody;
        private Button _pause, _mute, _next, _retry, _continue;
        private Toggle _auto;
        private int _generation, _index;
        private bool _paused, _loading, _done, _finishing, _voiceSeen, _canFinish;
        private float _subtitleElapsed;
        private string _fullText, _lastVisible;
        private string _entryScope;
        public UomdScreenId ScreenId => UomdScreenId.Prologue;
        public int CurrentShot => _index;
        public double ShotElapsed => _clock.Elapsed;
        public bool Paused => _paused;
        public bool Loading => _loading;
        public bool Finished => _done;
        private bool Calm => _router.Session.ReducedMotion;
        public RebuildPrologueScreen(UomdSceneRouter router) => _router = router;

        public async Awaitable OnEnterAsync(VisualElement host)
        {
            int generation = ++_generation;
            _paused = _done = _finishing = _canFinish = false;
            _loading = true;
            _scenes = _router.Session.PrologueConfig?.scenes ?? Array.Empty<PrologueSceneDto>();
            Resources.Load<VisualTreeAsset>("Rebuild/Prologue").CloneTree(host);
            _root = host.Q<VisualElement>("rebuildPrologue");
            var gradient = new UomdGradient(false, (0f, new Color(0.02f, 0.015f, 0.03f, 0.25f)),
                (0.18f, Color.clear), (0.51f, Color.clear), (0.77f, new Color(0.02f, 0.015f, 0.03f, 0.76f)),
                (1f, new Color(0.02f, 0.015f, 0.03f, 0.96f)));
            _root.Insert(0, gradient);
            _caption = _root.Q<Label>("shotCaption");
            _body = _root.Q<Label>("shotBody");
            _number = _root.Q<Label>("shotNumber");
            _status = _root.Q<Label>("openingStatus");
            _endTitle = _root.Q<Label>("openingEndTitle");
            _endBody = _root.Q<Label>("openingEndBody");
            _fill = _root.Q<VisualElement>("openingProgress");
            _end = _root.Q<VisualElement>("openingEnd");
            _pause = _root.Q<Button>("pauseOpening");
            _mute = _root.Q<Button>("muteOpening");
            _next = _root.Q<Button>("nextShot");
            _retry = _root.Q<Button>("retryOpening");
            _continue = _root.Q<Button>("continueOpening");
            _auto = _root.Q<Toggle>("autoOpening");
            _auto.SetValueWithoutNotify(true);
            _auto.RegisterValueChangedCallback(_ => UpdateNext());
            _pause.clicked += TogglePause;
            _mute.clicked += ToggleMute;
            _next.clicked += () => { if (!_loading && !_paused && _clock.Complete) _ = LoadShotAsync(_index + 1); };
            _retry.clicked += () => _ = LoadShotAsync(_index);
            _continue.clicked += Finish;
            var skip = _root.Q<Button>("skipOpening");
            skip.style.display = _router.Session.CanSkipPrologue ? DisplayStyle.Flex : DisplayStyle.None;
            skip.clicked += Finish;
            _mute.text = _router.Audio.Muted ? "UNMUTE" : "MUTE";
            _root.RegisterCallback<KeyDownEvent>(OnKeyDown);
            _stage = new RebuildCinematicStage(host, _router.Media, false, Calm);
            _router.Audio.SetPaused(false);
            _router.Audio.PlayBgmCue("bgm_prologue_before_the_road");
            int saved = 0;
            _entryScope = null;
            if (!_router.Session.IsReplayingIntro)
            {
                var continuity = _router.EntryFlow.Continuity;
                if (!continuity.IsCurrent) await continuity.PrepareAsync();
                if (generation != _generation) return;
                string source = await _router.Patch.ReadTextAsync("entry/prologue.json");
                if (generation != _generation) return;
                saved = continuity.PrologueShot(source);
                _entryScope = continuity.State.Scope;
            }
            int first = !_router.Session.CanSkipPrologue && saved >= 0 && saved < _scenes.Length ? saved : 0;
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active && _router.ProductionPreview.scenario != "entry") first = _router.ProductionPreview.shot;
#endif
            if (generation != _generation) return;
            await LoadShotAsync(first);
        }

        private async Awaitable LoadShotAsync(int index)
        {
            if (_finishing) return;
            int generation = ++_generation;
            _index = Mathf.Clamp(index, 0, Mathf.Max(0, _scenes.Length - 1));
            _loading = true;
            _router.Audio.StopVoiceLine();
            if (_scenes.Length == 0) { Unavailable(); return; }
            if (index >= _scenes.Length) { End(); return; }
            _done = false;
            _root.Q<VisualElement>("openingHeader").SetEnabled(true);
            _end.style.display = DisplayStyle.None;
            _status.text = "Loading the next scene…";
            _pause.SetEnabled(false);
            _next.SetEnabled(false);
            var scene = _scenes[index] ?? new PrologueSceneDto();
            string path = _router.Media.Catalog.Still("sol_prologue_" + scene.id);
            var texture = await _router.Media.TextureAsync(path);
            if (generation != _generation) return;
            if (texture == null) { Unavailable(); return; }
            _stage.Show(texture, path, Calm);
            ApplyPresentation(RebuildPresentationConfig.For("prologue/" + scene.id));
            _caption.text = scene.caption_en ?? "";
            _fullText = scene.text_en ?? "";
            _lastVisible = null;
            _body.text = "";
            _number.text = (index + 1).ToString("00") + " / " + _scenes.Length.ToString("00");
            _clock.Reset(Math.Max(0.5, scene.duration_seconds));
            _subtitleElapsed = 0;
            _voiceSeen = false;
            _subtitles.BeginLine(_fullText, Mathf.Min(scene.duration_seconds - 1, 9f), Calm);
            _router.Audio.PlayVoiceLine(scene.line_id);
            // A replay never writes over an unfinished first-viewing checkpoint.
            if (!_router.Session.IsReplayingIntro) _router.EntryFlow.Continuity.SaveShot(index);
            _loading = false;
            _status.text = "";
            _pause.SetEnabled(true);
            _auto.SetEnabled(true);
            UpdateNext();
        }

        public void OnTick(float deltaTime)
        {
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active && _router.ProductionPreview.scenario != "entry")
            {
                _paused = _router.ProductionPreview.paused;
                _pause.text = _paused ? "RESUME" : "PAUSE";
                _mute.text = _router.Audio.Muted ? "UNMUTE" : "MUTE";
                ApplyPresentation(_router.ProductionPreview.presentation);
                _caption.parent.style.display = _router.ProductionPreview.subtitles ? DisplayStyle.Flex : DisplayStyle.None;
            }
#endif
            bool captureHold = false;
#if UNITY_EDITOR
            captureHold = UomdEditorPreviewIsolation.Active && _router.ProductionPreview?.scenario == "entry" && _router.ProductionPreview.paused;
#endif
            if (_done || _loading || _paused || captureHold)
            {
                // Window/orientation changes still fit the composition while the narrative and motion remain frozen.
                _stage?.Tick(0, (float)_clock.Progress, Calm);
                return;
            }
            deltaTime = Time.unscaledDeltaTime;
            _clock.Advance(deltaTime, false);
            _stage?.Tick(deltaTime, (float)_clock.Progress, Calm);
            _subtitleElapsed += deltaTime;
            var audio = _router.Audio;
            if (audio.VoicePlaying) _voiceSeen = true;
            string visible;
            if (audio.VoiceReady)
            {
                if (_voiceSeen && !audio.VoicePlaying) visible = _fullText;
                else
                {
                    if (_subtitles.TotalDuration != audio.VoiceDuration) _subtitles.BeginLine(_fullText, audio.VoiceDuration, Calm);
                    visible = _subtitles.AtTime(audio.VoiceTime);
                }
            }
            else visible = _subtitles.AtTime(Mathf.Max(0, _subtitleElapsed - 0.5f));
            // Reserve the full paragraph's line breaks while revealing its spoken prefix.
            if (visible != _lastVisible)
            {
                _lastVisible = visible;
                _body.text = visible.Length >= _fullText.Length ? Escape(_fullText) : Escape(visible) + "<alpha=#00>" + Escape(_fullText.Substring(visible.Length)) + "</alpha>";
            }
            _fill.style.width = Length.Percent(100f * (_index + (float)_clock.Progress) / _scenes.Length);
            UpdateNext();
            if (_clock.Complete && _auto.value)
            {
#if UNITY_EDITOR
                if (UomdEditorPreviewIsolation.Active && _router.ProductionPreview.scenario != "entry") return;
#endif
                _ = LoadShotAsync(_index + 1);
            }
        }

        private void ApplyPresentation(RebuildShotSettings settings)
        {
            _stage.ApplySettings(settings);
            _caption.parent.style.bottom = settings.subtitleBottom;
        }


        private static string Escape(string text) => text.Replace("<", "<noparse><</noparse>");
        private void UpdateNext()
        {
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active && _router.ProductionPreview.scenario != "entry") { _next.style.display = DisplayStyle.None; return; }
#endif
            _next.style.display = _auto.value ? DisplayStyle.None : DisplayStyle.Flex;
            _next.SetEnabled(!_loading && !_paused && _clock.Complete);
        }
        private void TogglePause()
        {
            if (_done || _loading) return;
            _paused = !_paused;
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active) _router.ProductionPreview.paused = _paused;
#endif
            _router.Audio.SetPaused(_paused);
            _pause.text = _paused ? "RESUME" : "PAUSE";
            _status.text = _paused ? "Paused" : "";
            UpdateNext();
        }
        private void ToggleMute()
        {
            _router.Audio.Muted = !_router.Audio.Muted;
            _mute.text = _router.Audio.Muted ? "UNMUTE" : "MUTE";
            UomdPrefs.Save(_router.Session, _router.Audio);
        }
        private void OnKeyDown(KeyDownEvent evt)
        {
            if (evt.keyCode != KeyCode.Escape) return;
            TogglePause();
            evt.StopPropagation();
        }
        private void End()
        {
            _root.Q<VisualElement>("openingHeader").SetEnabled(false);
            _done = true;
            _canFinish = true;
            _loading = false;
            _end.style.display = DisplayStyle.Flex;
            _endTitle.text = "Before the Road";
            _endBody.text = "";
            _continue.text = _router.Session.IsReplayingIntro ? "RETURN TO TITLE" : "CONTINUE";
            _continue.style.display = DisplayStyle.Flex;
            _retry.style.display = DisplayStyle.None;
            _status.text = "";
            _pause.SetEnabled(false);
            _auto.SetEnabled(false);
            _next.style.display = DisplayStyle.None;
            _continue.Focus();
        }
        private void Unavailable()
        {
            _root.Q<VisualElement>("openingHeader").SetEnabled(false);
            _done = true;
            _canFinish = false;
            _loading = false;
            _end.style.display = DisplayStyle.Flex;
            _endTitle.text = "This scene could not be loaded";
            _endBody.text = "The opening has not finished. Retry to continue from this scene. Your place is retained.";
            _continue.text = "RETURN TO TITLE";
            _continue.style.display = _router.Session.IsReplayingIntro ? DisplayStyle.Flex : DisplayStyle.None;
            _retry.style.display = DisplayStyle.Flex;
            _status.text = "";
            _pause.SetEnabled(false);
            _auto.SetEnabled(false);
            _next.style.display = DisplayStyle.None;
            _retry.Focus();
        }
        private void Finish()
        {
#if UNITY_EDITOR
            if (UomdEditorPreviewIsolation.Active && _router.ProductionPreview?.scenario != "entry") return;
#endif
            if (_finishing) return;
            if (!_canFinish && !_router.Session.IsReplayingIntro && !_router.Session.CanSkipPrologue) return;
            _root.Q<VisualElement>("openingHeader").SetEnabled(false);
            _finishing = _done = true;
            _continue.SetEnabled(false);
            _router.Audio.SetPaused(false);
            _router.Audio.StopVoiceLine();
            if (_router.Session.IsReplayingIntro)
            {
                _router.Session.IsReplayingIntro = false;
                _ = _router.NavigateToAsync(UomdScreenId.Title);
                return;
            }
            _ = FinishEntryAsync();
        }
        private async Awaitable FinishEntryAsync()
        {
            int generation = _generation;
            if (generation != _generation) return;
            try { await _router.EntryFlow.PrologueFinishedAsync(_entryScope); }
            catch (Exception e)
            {
                if (generation != _generation) return;
                Debug.LogWarning("[RebuildPrologue] continue unavailable: " + e.GetType().Name);
                _finishing = false;
                _end.style.display = DisplayStyle.Flex;
                _endTitle.text = "The story could not continue";
                _endBody.text = "Your place is saved. Try again.";
                _continue.text = "TRY AGAIN";
                _continue.SetEnabled(true);
                _retry.style.display = DisplayStyle.None;
            }
        }
        public void OnExit()
        {
            if (_continue != null) _continue.clicked -= Finish;
            if (_root != null) _root.Q<Button>("skipOpening").clicked -= Finish;
            ++_generation;
            _loading = false;
            _done = true;
            _router.Audio.SetPaused(false);
            _router.Audio.StopVoiceLine();
            _stage?.Dispose();
            _stage = null;
        }
    }
}
