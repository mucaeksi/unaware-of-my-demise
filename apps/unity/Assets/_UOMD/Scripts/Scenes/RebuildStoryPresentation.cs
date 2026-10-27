using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Narrative;

namespace Uomd.Scenes
{
    /// <summary>Native tutorial view over the canonical StoryRunner and existing entry flow.</summary>
    public sealed partial class StoryScreenController
    {
        private bool _rebuilt, _assetsReady, _imagesDisabled, _reviewSeekComplete;
        private bool _voiceClockPending, _voiceClockStarted;
        private float _voiceWait;
        private VisualElement _storyView, _loadPanel;
        private Label _storyHint;
        private Button _nextButton, _retryButton, _textOnlyButton;
        private string _presentationState = "inactive";
        private readonly Dictionary<string, Texture2D> _rebuildTextures = new Dictionary<string, Texture2D>(StringComparer.Ordinal);

        public static bool IsRebuiltStory(string id) => id == "tutorial_t1_before" || id == "tutorial_t1_after"
            || id == "tutorial_t2_before" || id == "tutorial_t2_after" || id == "tutorial_t3_before" || id == "tutorial_t3_after";

        private bool StoryReview
        {
            get
            {
#if UNITY_EDITOR
                return Uomd.Core.UomdEditorPreviewIsolation.Active && _router.ProductionPreview?.scenario.StartsWith("story/", StringComparison.Ordinal) == true;
#else
                return false;
#endif
            }
        }

        private bool PreviewPaused
        {
            get
            {
#if UNITY_EDITOR
                return (PortraitReview || StoryReview || Uomd.Core.UomdEditorPreviewIsolation.Active && _router.ProductionPreview?.scenario == "entry") && _router.ProductionPreview.paused;
#else
                return false;
#endif
            }
        }

#if UNITY_EDITOR
        public string PresentationState => _presentationState;
#endif

        private void BuildRebuilt(VisualElement root)
        {
            _assetsReady = _imagesDisabled = false;
            _rebuildTextures.Clear();
            _presentationState = "loading";
            var layout = Resources.Load<VisualTreeAsset>("Rebuild/Story");
            if (layout == null) throw new InvalidOperationException("Rebuild/Story.uxml is missing.");
            layout.CloneTree(root);
            _stage = _storyView = root.Q("rebuildStory");
            _background = _storyView.Q("storyBackground");
            _actorLayer = _storyView.Q("storyActors");
            _fadeVeil = _storyView.Q("storyFade");
            _namePlate = _storyView.Q("storySpeaker");
            _nameText = _storyView.Q<Label>("storyName");
            _body = _storyView.Q<Label>("storyBody");
            _caret = _storyView.Q<Label>("storyCaret");
            _syncFill = _storyView.Q("storySync");
            _autoButton = _storyView.Q<Button>("storyAuto");
            _voiceButton = _storyView.Q<Button>("storyVoice");
            _nextButton = _storyView.Q<Button>("storyNext");
            _storyHint = _storyView.Q<Label>("storyHint");
            _choiceLayer = _storyView.Q("storyChoices");
            _loadPanel = _storyView.Q("storyLoadPanel");
            _retryButton = _storyView.Q<Button>("storyRetry");
            _textOnlyButton = _storyView.Q<Button>("storyTextOnly");
            _storyView.Q<Label>("storyTitle").text = _scene?.title_en ?? "The road to shelter";
            _autoButton.text = _auto ? "AUTO · ON" : "AUTO · OFF";
            SetActive(_autoButton, _auto);
            _autoButton.clicked += ToggleAuto;
            _voiceButton.clicked += ReplayVoice;
            _nextButton.clicked += Advance;
            _retryButton.clicked += RetryRebuilt;
            _textOnlyButton.clicked += ContinueWithoutImages;
            _retryButton.style.display = _textOnlyButton.style.display = DisplayStyle.None;
            _nextButton.SetEnabled(false);
            _storyView.RegisterCallback<ClickEvent>(OnStoryClick);
            _storyView.RegisterCallback<KeyDownEvent>(OnStoryKey);
            _storyView.RegisterCallback<GeometryChangedEvent>(OnStoryGeometry);
            _router.Audio.StopBgm(0.01f); // All six canonical tutorial scripts explicitly stop music.
        }

        private async Awaitable LoadRebuiltImagesAsync(int generation)
        {
            try
            {
                var paths = new HashSet<string>(StringComparer.Ordinal);
                string background = _router.Media.Catalog.Background("sol_" + _scene.location_id);
                if (background == null) throw new InvalidOperationException("Rebuilt tutorial background is missing.");
                paths.Add(background);
                foreach (var command in _scene.commands)
                {
                    string character = command.op == "show" ? command.character : command.speaker;
                    if (character != "fadyme" && character != "mahmut") continue;
                    paths.Add(PortraitPath(character, command.op == "show" ? "composed" : command.emotion));
                }
                foreach (string path in paths)
                {
                    var texture = await _router.Media.TextureAsync(path);
                    if (generation != _generation) return;
                    if (texture == null) throw new InvalidOperationException("Scene illustration could not load: " + path);
                    _rebuildTextures[path] = texture;
                }
                if (generation != _generation) return;
                BeginRebuiltReading();
            }
            catch (Exception e)
            {
                if (generation != _generation) return;
                Debug.LogWarning("[Story] Illustrations unavailable: " + e.Message);
                ShowLoadFailure(true);
            }
        }

        private void ShowLoadFailure(bool canRead)
        {
            _presentationState = "error";
            _storyView.Q<Label>("storyLoadTitle").text = "THE ROAD COULD NOT BE LOADED";
            _storyView.Q<Label>("storyLoadMessage").text = canRead
                ? "The illustrations are unavailable. Try again, or read this scene without images. Your place has not changed."
                : "The story text is unavailable. Try again to return to this scene. Your place has not changed.";
            _retryButton.style.display = DisplayStyle.Flex;
            _textOnlyButton.style.display = canRead ? DisplayStyle.Flex : DisplayStyle.None;
            _retryButton.Focus();
        }

        private void RetryRebuilt()
        {
            UnbindRebuilt();
            _root.Clear();
            _ = OnEnterAsync(_root);
        }

        private void ContinueWithoutImages()
        {
            if (_presentationState != "error" || _scene == null) return;
            _imagesDisabled = true;
            BeginRebuiltReading();
        }

        private void BeginRebuiltReading()
        {
            _assetsReady = true;
            _presentationState = _imagesDisabled ? "reading_without_images" : "reading";
            _loadPanel.style.display = DisplayStyle.None;
            _nextButton.SetEnabled(!PortraitReview);
            if (_imagesDisabled) _storyHint.text = "Illustrations unavailable · tap to read";
            SetRebuiltBackground(_scene.location_id);
            foreach (var actor in _runner.Restored.actors) ShowActor(actor.Key, actor.Value.side, actor.Value.emotion);
            _prevSpeaker = _runner.Restored.prevSpeaker;
            string restoredMusic = _runner.Restored.musicCueId;
            if (restoredMusic == "stop") _router.Audio.StopBgm();
            else if (!string.IsNullOrEmpty(restoredMusic)) _router.Audio.PlayBgmCue(restoredMusic);
            Pump();
            _storyView.Focus();
        }

        private void SetRebuiltBackground(string location)
        {
            if (_imagesDisabled) { _backgroundPath = null; return; }
            _backgroundPath = _router.Media.Catalog.Background("sol_" + location);
            if (_backgroundPath != null && _rebuildTextures.TryGetValue(_backgroundPath, out var texture))
                _background.style.backgroundImage = new StyleBackground(texture);
        }

        private void OnStoryGeometry(GeometryChangedEvent evt) => LayoutRebuiltActors();

        private void LayoutRebuiltActors()
        {
            float width = _storyView.resolvedStyle.width, height = _storyView.resolvedStyle.height;
            if (float.IsNaN(width) || float.IsNaN(height) || width <= 0 || height <= 0) return;
            _storyView.EnableInClassList("story-compact", width < 1600);
            float separation = Mathf.Min(width * 0.25f, 560f);
            foreach (var pair in _actors)
            {
                var actor = pair.Value;
                float h = height * 0.91f * UomdCharacterStature.Get(pair.Key).VnTargetHeight / UomdCharacterStature.Get("mahmut").VnTargetHeight;
                float w = h * 2f / 3f;
                actor.Image.style.width = w;
                actor.Image.style.height = h;
                actor.Image.style.left = width * 0.5f + (actor.Side == "left" ? -separation : separation) - w * 0.5f;
                actor.Image.style.marginLeft = 0;
                actor.Image.style.top = height - h;
            }
        }

        // Toolbar and Next clicks bubble through the stage. Only the stage/dialogue itself advances here.
        private void OnStoryClick(ClickEvent evt)
        {
            if (HasButtonAncestor(evt.target as VisualElement)) return;
            Advance();
        }

        private bool HasButtonAncestor(VisualElement target)
        {
            for (var current = target; current != null && current != _storyView; current = current.parent)
                if (current is Button) return true;
            return false;
        }

        private void OnStoryKey(KeyDownEvent evt)
        {
            if (HasButtonAncestor(evt.target as VisualElement)) return;
            if (evt.keyCode != KeyCode.Space && evt.keyCode != KeyCode.Return && evt.keyCode != KeyCode.KeypadEnter) return;
            Advance();
            evt.StopPropagation();
        }

        private void SetRevealProgress(float fraction) => _syncFill.style.width = _rebuilt
            ? new Length(fraction * 100f, LengthUnit.Percent) : new Length(fraction * 760f);

        private string TickRebuiltSubtitles(float deltaTime)
        {
            var audio = _router.Audio;
            if (_voiceClockPending)
            {
                if (audio.VoiceReady)
                {
                    _voiceClockPending = false;
                    _voiceClockStarted = true;
                    _voiceSeconds = audio.VoiceDuration;
                    _subtitles.BeginLine(_line.text, Mathf.Max(0.26f, _voiceSeconds * 0.92f), Calm);
                }
                else
                {
                    _voiceWait += deltaTime;
                    if (_voiceWait < 2f) { _typingElapsed = 0f; return _subtitles.AtTime(0f); }
                    audio.StopVoiceLine(); // Invalidate a delayed load before falling back to the text clock.
                    _voiceClockPending = false;
                    _voiceSeconds = 0f;
                    _typingElapsed = 0f;
                    _subtitles.BeginLine(_line.text, Mathf.Max(0.26f, _line.text.Length / NormalCps), Calm);
                }
            }
            if (!_voiceClockStarted) return _subtitles.Tick(deltaTime);
            _typingElapsed = audio.VoicePlaying ? audio.VoiceTime : _voiceSeconds;
            return _subtitles.AtTime(_typingElapsed);
        }

        private void UnbindRebuilt()
        {
            _storyView.UnregisterCallback<ClickEvent>(OnStoryClick);
            _storyView.UnregisterCallback<KeyDownEvent>(OnStoryKey);
            _storyView.UnregisterCallback<GeometryChangedEvent>(OnStoryGeometry);
            _autoButton.clicked -= ToggleAuto;
            _voiceButton.clicked -= ReplayVoice;
            _nextButton.clicked -= Advance;
            _retryButton.clicked -= RetryRebuilt;
            _textOnlyButton.clicked -= ContinueWithoutImages;
            _presentationState = "inactive";
            _rebuildTextures.Clear();
        }
    }
}
