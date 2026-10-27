using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering.Universal;
using UnityEngine.UIElements;
using Uomd.Core;

namespace Uomd.Scenes
{
    /// <summary>Owned, transient URP 2D stage. At most two plates coexist; UI and scene state are restored on exit.</summary>
    public sealed class RebuildCinematicStage : IDisposable
    {
        private readonly GameObject _root;
        private readonly Camera _camera;
        private readonly Camera _previousCamera;
        private readonly bool _previousCameraEnabled;
        private readonly List<(Light2D Light, bool Enabled)> _previousLights = new List<(Light2D, bool)>();
        private readonly List<(VisualElement Element, StyleColor Color)> _backgrounds = new List<(VisualElement, StyleColor)>();
        private readonly UomdMediaLoader _media;
        private readonly Material _dustMaterial;
        private readonly ParticleSystem _dust;
        private readonly Light2D _accent;
        private SpriteRenderer _current;
        private SpriteRenderer _previous;
        private string _currentPath;
        private string _previousPath;
        private float _fade;
        private float _time;
        private bool _disposed;
        private readonly bool _studio;
        private RebuildShotSettings _settings = new RebuildShotSettings();
        private readonly Light2D _ambient;

        public void ApplySettings(RebuildShotSettings settings) { settings.Validate(); _settings = settings; }

        public RebuildCinematicStage(VisualElement host, UomdMediaLoader media, bool studio, bool calm)
        {
            _media = media;
            _studio = studio;
            for (var element = host; element != null; element = element.parent)
            {
                _backgrounds.Add((element, element.style.backgroundColor));
                element.style.backgroundColor = Color.clear;
            }
            _previousCamera = Camera.main;
            if (_previousCamera != null)
            {
                _previousCameraEnabled = _previousCamera.enabled;
                _previousCamera.enabled = false;
            }
            foreach (var light in UnityEngine.Object.FindObjectsByType<Light2D>(FindObjectsSortMode.None))
            {
                _previousLights.Add((light, light.enabled));
                light.enabled = false;
            }
            _root = new GameObject("SolCinematicStage");
            _camera = Child("CinematicCamera").AddComponent<Camera>();
            _camera.orthographic = true;
            _camera.orthographicSize = 5.4f;
            _camera.transform.localPosition = new Vector3(0, 0, -10);
            _camera.clearFlags = CameraClearFlags.SolidColor;
            _camera.backgroundColor = new Color(0.018f, 0.014f, 0.028f);
            _camera.nearClipPlane = 0.1f;
            _camera.farClipPlane = 30f;
            var ambient = _ambient = Child("CinematicAmbient").AddComponent<Light2D>();
            ambient.lightType = Light2D.LightType.Global;
            ambient.color = Color.white;
            ambient.intensity = studio ? 0.62f : 1f;
            _accent = Child("CinematicPractical").AddComponent<Light2D>();
            _accent.lightType = Light2D.LightType.Point;
            _accent.color = new Color(1f, 0.78f, 0.56f);
            _accent.pointLightInnerRadius = 0.4f;
            _accent.pointLightOuterRadius = studio ? 5f : 9f;
            _accent.intensity = studio ? 0.7f : 0.035f;
            _accent.transform.localPosition = new Vector3(-3, 2, -1);

            _dustMaterial = new Material(Resources.Load<Shader>("Rebuild/CinematicDust"));
            _dust = Child("CinematicDust").AddComponent<ParticleSystem>();
            _dust.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = _dust.main;
            main.playOnAwake = false;
            main.maxParticles = 64;
            main.startLifetime = new ParticleSystem.MinMaxCurve(9f, 15f);
            main.startSpeed = new ParticleSystem.MinMaxCurve(0.025f, 0.07f);
            main.startSize = new ParticleSystem.MinMaxCurve(0.012f, 0.035f);
            main.startColor = new Color(0.88f, 0.81f, 0.69f, 0.22f);
            main.simulationSpace = ParticleSystemSimulationSpace.Local;
            var shape = _dust.shape;
            shape.shapeType = ParticleSystemShapeType.Box;
            shape.scale = new Vector3(22, 12, 0.2f);
            var emission = _dust.emission;
            emission.rateOverTime = 3f;
            var renderer = _dust.GetComponent<ParticleSystemRenderer>();
            renderer.sharedMaterial = _dustMaterial;
            renderer.sortingOrder = 30;
            _dust.transform.localPosition = new Vector3(0, 0, -2);
            if (!calm) _dust.Simulate(8f, true, true, false);
            _dust.Pause();
        }

        private GameObject Child(string name)
        {
            var go = new GameObject(name);
            go.transform.SetParent(_root.transform, false);
            return go;
        }

        public void Show(Texture2D texture, string path, bool calm)
        {
            ReleasePrevious();
            _previous = _current;
            _previousPath = _currentPath;
            _currentPath = path;
            _current = Child("Plate_" + texture.name).AddComponent<SpriteRenderer>();
            _current.sprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(0.5f, 0.5f), 100f);
            _current.sharedMaterial = Resources.Load<Material>("Rebuild/CinematicLit");
            _current.sortingOrder = 10;
            if (_previous != null) _previous.sortingOrder = 0;
            _fade = calm ? 1f : 0f;
#if UNITY_EDITOR
            // A directly selected review shot starts settled, including when initially paused.
            if (UomdEditorPreviewIsolation.Active) _fade = 1f;
#endif
            Tick(0, 0, calm);
        }

        public void Tick(float delta, float progress, bool calm)
        {
            if (_disposed) return;
            _time += delta;
            _fade = Mathf.Min(1f, _fade + delta / 0.9f);
            if (_current != null)
            {
                // Contain the complete composition on wide/4:3 screens; only a 2% authored camera move crops the margin.
                var size = _current.sprite.bounds.size;
                float fit = _studio ? 5.5f / size.y : Mathf.Min(10.8f / size.y, 10.8f * _camera.aspect / size.x);
                float zoom = calm || _studio ? 1f : Mathf.Lerp(1f, 1.022f, Mathf.SmoothStep(0, 1, progress));
                _camera.orthographicSize = 5.4f / (zoom * _settings.framing);
                _current.transform.localScale = Vector3.one * fit;
                _current.transform.localPosition = _studio ? new Vector3(0, 1.15f, 0) : Vector3.zero;
                _current.color = new Color(1, 1, 1, Mathf.SmoothStep(0, 1, _fade));
            }
            if (_previous != null && _fade >= 1f) ReleasePrevious();
            _accent.intensity = _studio ? 0.7f + (calm ? 0 : Mathf.Sin(_time * 0.8f) * 0.035f) : 0.035f;
            _ambient.intensity = (_studio ? 0.62f : 1f) * _settings.light;
            _accent.intensity *= _settings.light;
            if (!calm && _settings.particles && delta > 0) { _dust.Simulate(delta, true, false, false); _dust.Pause(); }
            if (calm || !_settings.particles) _dust.Clear();
        }

        private void ReleasePrevious()
        {
            if (_previous == null) return;
            UnityEngine.Object.Destroy(_previous.sprite);
            UnityEngine.Object.Destroy(_previous.gameObject);
            if (_previousPath != _currentPath) _media.ReleaseTexture(_previousPath);
            _previous = null;
            _previousPath = null;
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            ReleasePrevious();
            if (_current != null) UnityEngine.Object.Destroy(_current.sprite);
            _media.ReleaseTexture(_currentPath);
            if (_root != null)
            {
                _root.SetActive(false);
                UnityEngine.Object.Destroy(_root);
            }
            UnityEngine.Object.Destroy(_dustMaterial);
            if (_previousCamera != null) _previousCamera.enabled = _previousCameraEnabled;
            foreach (var item in _previousLights) if (item.Light != null) item.Light.enabled = item.Enabled;
            foreach (var item in _backgrounds) item.Element.style.backgroundColor = item.Color;
            _backgrounds.Clear();
        }
    }
}
