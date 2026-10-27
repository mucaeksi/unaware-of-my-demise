using System;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.Platform;

namespace Uomd.Scenes
{
    /// <summary>D-35 title: new art and editable layout, backed by the existing identity and entry contracts.</summary>
    public sealed class RebuildTitleScreen : IUomdScreenController
    {
        private readonly UomdSceneRouter _router;
        private VisualElement _root;
        private VisualElement _settings;
        private Button _primary;
        private Button _settingsButton;
        private Button _replay;
        private Label _status;
        private int _generation;
        private bool _busy;
        private bool _privacyBusy;

        public RebuildTitleScreen(UomdSceneRouter router) => _router = router;
        public UomdScreenId ScreenId => UomdScreenId.Title;

        public async Awaitable OnEnterAsync(VisualElement screenRoot)
        {
            int generation = ++_generation;
            _busy = false;
            _privacyBusy = false;
            var layout = Resources.Load<VisualTreeAsset>("Rebuild/Title");
            if (layout == null) throw new InvalidOperationException("Rebuild/Title.uxml is missing.");
            layout.CloneTree(screenRoot);
            _root = screenRoot.Q<VisualElement>("rebuildTitle");
            _settings = _root.Q<VisualElement>("settingsDialog");
            _primary = _root.Q<Button>("startButton");
            _settingsButton = _root.Q<Button>("settingsButton");
            _replay = _root.Q<Button>("replayButton");
            _status = _root.Q<Label>("statusText");
            _primary.text = _router.Api.IsSignedIn ? "CONTINUE" : _router.PlatformBridge.IsNativeAndroid ? "SIGN IN WITH GOOGLE"
                : _router.EntryFlow.Continuity.HasDeviceCheckpoint ? "CONTINUE" : "TAP TO START";
            _root.Q<Label>("versionText").text = "v" + Application.version;
            _primary.clicked += Start;
            _settingsButton.clicked += OpenSettings;
            _replay.clicked += Replay;
            _root.Q<Button>("closeSettingsButton").clicked += CloseSettings;
            _root.Q<Button>("privacyButton").clicked += () => _ = PrivacyAsync();
            _root.Q<Button>("privacyButton").SetEnabled(_router.PlatformBridge.IsNativeAndroid);
            if (!_router.PlatformBridge.IsNativeAndroid)
                _root.Q<Button>("privacyButton").tooltip = "Privacy options require the Android app.";
            BindSettings();
            _root.RegisterCallback<KeyDownEvent>(OnKeyDown, TrickleDown.TrickleDown);
            _router.Audio.PlayBgmCue("bgm_main_theme");

            string artPath = _router.Media.Catalog.Ui("sol_title_bg");
            var texture = await _router.Media.TextureAsync(artPath);
            if (generation != _generation) return;
            if (texture != null) _root.Q<VisualElement>("titleArt").style.backgroundImage = new StyleBackground(texture);
            else _status.text = "The title illustration could not be loaded.";
        }

        private void BindSettings()
        {
            var audio = _router.Audio;
            BindVolume("musicVolume", audio.BgmVolume, value => audio.BgmVolume = value);
            BindVolume("effectsVolume", audio.SfxVolume, value => audio.SfxVolume = value);
            BindVolume("voiceVolume", audio.VoiceVolume, value => audio.VoiceVolume = value);
            BindToggle("reducedMotion", _router.Session.ReducedMotion, value => _router.Session.ReducedMotion = value);
            BindToggle("reduceFlash", _router.Session.ReduceFlash, value => _router.Session.ReduceFlash = value);
            BindToggle("muteAudio", audio.Muted, value => audio.Muted = value);
        }

        private void BindVolume(string name, float initial, Action<float> change)
        {
            var slider = _root.Q<Slider>(name);
            slider.SetValueWithoutNotify(initial * 100f);
            slider.RegisterValueChangedCallback(evt =>
            {
                change(Mathf.Clamp01(evt.newValue / 100f));
                UomdPrefs.Save(_router.Session, _router.Audio);
            });
        }

        private void BindToggle(string name, bool initial, Action<bool> change)
        {
            var toggle = _root.Q<Toggle>(name);
            toggle.SetValueWithoutNotify(initial);
            toggle.RegisterValueChangedCallback(evt =>
            {
                change(evt.newValue);
                UomdPrefs.Save(_router.Session, _router.Audio);
            });
        }

        private void Start()
        {
            if (_busy || SettingsOpen) return;
            _ = StartAsync();
        }

        private async Awaitable StartAsync()
        {
            int generation = _generation;
            SetBusy(true);
            _status.text = "";
            bool signingIn = _router.PlatformBridge.IsNativeAndroid && !_router.Api.IsSignedIn;
            try
            {
                if (signingIn)
                {
                    string idToken = await _router.PlatformBridge.SignInWithGoogleAsync(UomdPlatformBridgeFactory.GoogleWebClientId);
                    if (generation != _generation) return;
                    await _router.Api.SignInWithGoogleIdTokenAsync(idToken);
                    if (generation != _generation) return;
                }
                signingIn = false;
                _router.Audio.PlaySfx("sfx_ui_confirm");
                await _router.EntryFlow.ContinueAsync();
            }
            catch (Exception e)
            {
                if (generation != _generation) return;
                Debug.LogWarning($"[RebuildTitle] entry unavailable: {e.GetType().Name}");
                _status.text = signingIn ? "Sign-in did not complete. Nothing was changed." : _router.EntryFlow.Continuity.Notice.Length > 0
                    ? _router.EntryFlow.Continuity.Notice : "The story could not be loaded. Try again.";
            }
            finally
            {
                if (generation == _generation) SetBusy(false);
            }
        }

        private void SetBusy(bool busy)
        {
            _busy = busy;
            _primary.SetEnabled(!busy);
            _settingsButton.SetEnabled(!busy);
            _replay.SetEnabled(!busy);
        }

        private void Replay()
        {
            if (_busy || SettingsOpen) return;
            SetBusy(true);
            _router.Session.IsReplayingIntro = true;
            _ = ReplayAsync();
        }

        private async Awaitable ReplayAsync()
        {
            int generation = _generation;
            try { await _router.NavigateToAsync(UomdScreenId.Prologue); }
            catch (Exception e)
            {
                if (generation != _generation) return;
                Debug.LogWarning($"[RebuildTitle] replay unavailable: {e.GetType().Name}");
                _status.text = "The opening could not be loaded.";
                SetBusy(false);
            }
        }

        private bool SettingsOpen => _settings != null && !_settings.ClassListContains("is-hidden");

        private void OpenSettings()
        {
            if (_busy || SettingsOpen) return;
            _settings.RemoveFromClassList("is-hidden");
            _root.Q<Slider>("musicVolume").Focus();
        }

        private void CloseSettings()
        {
            _settings.AddToClassList("is-hidden");
            _settingsButton.Focus();
        }

        private void OnKeyDown(KeyDownEvent evt)
        {
            if (!SettingsOpen) return;
            if (evt.keyCode == KeyCode.Escape)
            {
                CloseSettings();
                evt.StopPropagation();
            }
            else if (evt.keyCode == KeyCode.Tab)
            {
                var controls = new VisualElement[] {
                    _root.Q<Slider>("musicVolume"), _root.Q<Slider>("effectsVolume"), _root.Q<Slider>("voiceVolume"),
                    _root.Q<Toggle>("reducedMotion"), _root.Q<Toggle>("reduceFlash"), _root.Q<Toggle>("muteAudio"),
                    _root.Q<Button>("privacyButton"), _root.Q<Button>("closeSettingsButton")
                };
                var focused = _root.focusController.focusedElement as VisualElement;
                int current = Array.FindIndex(controls, control => control == focused || (focused != null && control.Contains(focused)));
                int step = evt.shiftKey ? -1 : 1;
                for (int i = 0; i < controls.Length; i++)
                {
                    current = (current + step + controls.Length) % controls.Length;
                    if (!controls[current].enabledInHierarchy) continue;
                    controls[current].Focus();
                    break;
                }
                evt.StopPropagation();
                _root.focusController.IgnoreEvent(evt);
            }
        }

        private async Awaitable PrivacyAsync()
        {
            if (_privacyBusy) return;
            int generation = _generation;
            _privacyBusy = true;
            var button = _root.Q<Button>("privacyButton");
            var result = _root.Q<Label>("privacyStatus");
            button.SetEnabled(false);
            try
            {
                await _router.PlatformBridge.ShowPrivacyOptionsFormAsync();
                if (generation == _generation) result.text = "Privacy choice updated";
            }
            catch (Exception)
            {
                if (generation == _generation) result.text = "Privacy options could not be loaded. Try again.";
            }
            finally
            {
                if (generation == _generation) { _privacyBusy = false; button.SetEnabled(true); }
            }
        }

        public void OnTick(float deltaTime) { }

        public void OnExit()
        {
            _generation++;
            _root = null;
            _settings = null;
            _primary = _settingsButton = _replay = null;
            _status = null;
        }
    }
}
