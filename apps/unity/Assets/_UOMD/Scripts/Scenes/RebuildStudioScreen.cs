using System;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;

namespace Uomd.Scenes
{
    public sealed class RebuildStudioScreen : IUomdScreenController
    {
        private readonly UomdSceneRouter _router;
        private RebuildCinematicStage _stage;
        private VisualElement _copy;
        private Label _status;
        private int _generation;
        private float _elapsed;
        private bool _ready;
        public UomdScreenId ScreenId => UomdScreenId.Studio;
        public RebuildStudioScreen(UomdSceneRouter router) => _router = router;

        public async Awaitable OnEnterAsync(VisualElement root)
        {
            int generation = ++_generation;
            _elapsed = 0;
            _ready = false;
            Resources.Load<VisualTreeAsset>("Rebuild/Studio").CloneTree(root);
            _copy = root.Q<VisualElement>("studioCopy");
            _status = root.Q<Label>("studioStatus");
            _stage = new RebuildCinematicStage(root, _router.Media, true, _router.Session.ReducedMotion);
            _router.Audio.PlayBgmCue("bgm_main_theme");
            string path = _router.Media.Catalog.Ui("sol_studio_mark");
            var texture = await _router.Media.TextureAsync(path);
            if (generation != _generation) return;
            if (texture != null) _stage.Show(texture, path, _router.Session.ReducedMotion);
            else _status.text = ""; // Studio credit remains readable if the optional emblem cannot load.
            _ready = true;
            _router.Audio.PlaySfx("sfx_bell_sanctuary");
        }

        public void OnTick(float deltaTime)
        {
            if (!_ready) return;
            deltaTime = Time.unscaledDeltaTime;
            _elapsed += deltaTime;
            _stage?.Tick(deltaTime, 0, _router.Session.ReducedMotion);
            float visible = _router.Session.ReducedMotion ? 1 : Mathf.SmoothStep(0, 1, (_elapsed - 0.5f) / 1.3f);
            _copy.style.opacity = visible;
            if (_elapsed < 6.2f) return;
            _ready = false;
            _ = _router.NavigateToAsync(UomdScreenId.Title);
        }

        public void OnExit()
        {
            ++_generation;
            _ready = false;
            _stage?.Dispose();
            _stage = null;
        }
    }
}
