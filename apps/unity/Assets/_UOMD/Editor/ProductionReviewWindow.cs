using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Uomd.Core;
using Uomd.Scenes;

namespace Uomd.EditorTools
{
    public sealed class ProductionReviewWindow : EditorWindow
    {
        private static readonly string[] Viewports = { "1920 × 1080 · 16:9", "2400 × 1080 · 20:9", "1600 × 1200 · 4:3" };
        private static readonly Vector2Int[] Sizes = { new Vector2Int(1920, 1080), new Vector2Int(2400, 1080), new Vector2Int(1600, 1200) };
        [SerializeField] private string _selectedId = "sol_title_key_art_01", _filter = "", _note = "", _message = "", _comparePath = "";
        [SerializeField] private bool _candidatesOnly = true, _promptOpen, _guides = true;
        [SerializeField] private float _zoom = 1;
        [SerializeField] private int _tab, _viewport;
        [SerializeField] private ProductionPreviewRequest _request = new ProductionPreviewRequest();
        private List<ProductionReviewAsset> _assets;
        private ProductionReviewAsset _selected;
        private ProductionReviewStore _store;
        private ProductionReviewIndex _index;
        private Texture2D _texture, _compare, _atlasTexture;
        private object _atlas, _unit;
        private string[] _states = Array.Empty<string>();
        private int _stateIndex, _frameIndex;
        private bool _playFrames;
        private double _lastFrameAt;
        private string _alpha = "", _compareSha = "";
        private Vector2 _listScroll, _detailScroll, _imageScroll;

        [MenuItem("Window/UOMD/Production Review")]
        public static void Open()
        {
            var window = GetWindow<ProductionReviewWindow>("Production Review");
            window.minSize = new Vector2(960, 620);
            window.Show();
        }

        private void OnEnable() => Run(Reload);
        private void OnDisable() => ReleaseImages();
        private void OnDestroy() => ProductionReviewSession.Stop();
        private void OnInspectorUpdate()
        {
            if (_playFrames && _states.Length > 0)
            {
                var animation = JsonRead.Get(CurrentState(), "animation");
                double fps = JsonRead.Num(animation, "fps", 6);
                var frames = JsonRead.Arr(animation, "frames");
                if (frames.Count > 1 && EditorApplication.timeSinceStartup - _lastFrameAt >= 1 / Math.Max(1, fps))
                {
                    _lastFrameAt = EditorApplication.timeSinceStartup;
                    if (_frameIndex + 1 < frames.Count) _frameIndex++;
                    else if (JsonRead.Bool(animation, "loop")) _frameIndex = 0;
                    else _playFrames = false;
                }
            }
            Repaint();
        }
        private void Run(Action action)
        {
            try { action(); }
            catch (Exception e) { _message = e.Message; }
            Repaint();
        }

        public void Reload()
        {
            _store = new ProductionReviewStore(ProductionReviewCatalog.RepositoryRoot);
            _assets = ProductionReviewCatalog.Load(_store.Root);
            _index = _store.Read();
            SelectAsset(_selectedId);
        }

        public void SelectAsset(string id)
        {
            ReleaseImages();
            _selected = _assets.FirstOrDefault(a => a.Id == id) ?? _assets.FirstOrDefault();
            if (_selected == null) return;
            _selectedId = _selected.Id;
            if (_selected.Scenario.Length > 0)
            {
                if (_request.scenario != _selected.Scenario) _request.lineId = "";
                _request.scenario = _selected.Scenario;
                _request.presentation = RebuildPresentationConfig.For(_request.scenario);
            }
            _texture = LoadImage(_selected.PreviewPath);
            _atlasTexture = LoadImage(_selected.OutputPreviewPath);
            _atlas = JsonRead.Obj(JsonRead.Get(_selected.Entry, "targets"), "atlases").Values.FirstOrDefault();
            _unit = JsonRead.Obj(JsonRead.Get(_selected.Entry, "targets"), "units").Values.FirstOrDefault();
            _states = JsonRead.Obj(_unit, "states").Keys.ToArray();
            _stateIndex = _frameIndex = 0;
            _playFrames = false;
            if (_texture != null)
            {
                bool alpha = _texture.GetPixels32().Any(p => p.a < 255);
                _alpha = alpha ? "Alpha present (decoded preview pixels)" : "Opaque (decoded preview pixels)";
            }
            else _alpha = "Preview / alpha unavailable locally";
            _comparePath = "";
            _compareSha = "";
        }

        private Texture2D LoadImage(string relative)
        {
            if (string.IsNullOrWhiteSpace(relative)) return null;
            string path = ProductionReviewCatalog.Resolve(_store.Root, relative);
            if (!File.Exists(path)) return null;
            var texture = new Texture2D(2, 2) { hideFlags = HideFlags.HideAndDontSave };
            if (texture.LoadImage(File.ReadAllBytes(path))) return texture;
            DestroyImmediate(texture);
            return null;
        }

        private void ReleaseImages()
        {
            if (_texture != null) DestroyImmediate(_texture);
            if (_compare != null) DestroyImmediate(_compare);
            if (_atlasTexture != null) DestroyImmediate(_atlasTexture);
            _texture = _compare = _atlasTexture = null;
        }

        private void OnGUI()
        {
            EditorGUILayout.Space(8);
            EditorGUILayout.LabelField("UOMD  /  PRODUCTION REVIEW", EditorStyles.boldLabel);
            EditorGUILayout.LabelField("Editor rehearsal · base content · no account mutations · ingest remains the art approval authority", EditorStyles.miniLabel);
            if (_assets == null) { EditorGUILayout.HelpBox(_message, MessageType.Error); if (GUILayout.Button("Reload")) Run(Reload); return; }
            using (new EditorGUILayout.HorizontalScope(EditorStyles.toolbar))
            {
                _candidatesOnly = GUILayout.Toggle(_candidatesOnly, "OpenAI candidates (" + _assets.Count(a => a.Candidate) + ")", EditorStyles.toolbarButton);
                _filter = GUILayout.TextField(_filter, EditorStyles.toolbarSearchField, GUILayout.MinWidth(180));
                if (GUILayout.Button("Reload", EditorStyles.toolbarButton, GUILayout.Width(70))) Run(Reload);
                if (GUILayout.Button("Review gallery", EditorStyles.toolbarButton, GUILayout.Width(100))) Run(() => EditorUtility.RevealInFinder(_store.IndexPath));
            }
            using (new EditorGUILayout.HorizontalScope())
            {
                using (new EditorGUILayout.VerticalScope(GUILayout.Width(262)))
                {
                    _listScroll = EditorGUILayout.BeginScrollView(_listScroll);
                    foreach (var asset in _assets)
                    {
                        if (_candidatesOnly && !asset.Candidate) continue;
                        if (!string.IsNullOrWhiteSpace(_filter) && (asset.Id + " " + asset.Class + " " + asset.Provider).IndexOf(_filter, StringComparison.OrdinalIgnoreCase) < 0) continue;
                        using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox))
                        {
                            if (GUILayout.Toggle(_selected == asset, asset.Id, EditorStyles.miniButton))
                                if (_selected != asset) Run(() => SelectAsset(asset.Id));
                            GUILayout.Label(asset.Class + " · r" + asset.Revision + " · " + asset.Width + "×" + asset.Height, EditorStyles.miniLabel);
                            GUILayout.Label(asset.Candidate ? "OpenAI · " + asset.HumanState : "Historical reference only", EditorStyles.miniLabel);
                        }
                    }
                    EditorGUILayout.EndScrollView();
                }
                using (new EditorGUILayout.VerticalScope())
                {
                    _tab = GUILayout.Toolbar(_tab, new[] { "Asset / provenance", "Real scene / directing", "Requests / evidence" });
                    _detailScroll = EditorGUILayout.BeginScrollView(_detailScroll);
                    if (_selected != null)
                    {
                        if (_tab == 0) AssetInspector();
                        if (_tab == 1) SceneInspector();
                        if (_tab == 2) ReviewInspector();
                    }
                    EditorGUILayout.EndScrollView();
                }
            }
            EditorGUILayout.HelpBox(string.IsNullOrEmpty(_message) ? ProductionReviewSession.Status : _message, MessageType.Info);
        }

        private void AssetInspector()
        {
            EditorGUILayout.LabelField(_selected.Id + " · revision " + _selected.Revision, EditorStyles.boldLabel);
            EditorGUILayout.LabelField(_alpha, EditorStyles.miniLabel);
            _zoom = EditorGUILayout.Slider("Image zoom", _zoom, 0.25f, 3f);
            _guides = EditorGUILayout.Toggle("Center / composition guides", _guides);
            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Compare retained source…")) Run(() =>
                {
                    string full = EditorUtility.OpenFilePanel("Compare a retained revision (repository PNG/JPG)", Path.GetDirectoryName(ProductionReviewCatalog.Resolve(_store.Root, _selected.PreviewPath)), "png,jpg,jpeg");
                    if (string.IsNullOrEmpty(full)) return;
                    string relative = Path.GetRelativePath(_store.Root, full).Replace('\\', '/');
                    ProductionReviewCatalog.Resolve(_store.Root, relative);
                    if (_compare != null) DestroyImmediate(_compare);
                    _compare = LoadImage(relative);
                    _comparePath = relative;
                    _compareSha = Sha256Hash.ComputeFileHex(full);
                });
                if (GUILayout.Button("Reveal exact source")) Run(() => EditorUtility.RevealInFinder(ProductionReviewCatalog.Resolve(_store.Root, _selected.SourcePath)));
            }
            _imageScroll = EditorGUILayout.BeginScrollView(_imageScroll, GUILayout.Height(340));
            using (new EditorGUILayout.HorizontalScope())
            {
                DrawImage(_texture, "A · " + _selected.PreviewPath);
                if (_compare != null) DrawImage(_compare, "B · " + _comparePath + "\nSHA-256 " + _compareSha);
            }
            EditorGUILayout.EndScrollView();
            FrameInspector();
            EditorGUILayout.TextArea(_selected.Details, EditorStyles.wordWrappedLabel, GUILayout.MinHeight(410));
            _promptOpen = EditorGUILayout.Foldout(_promptOpen, "Exact prompt / provider record");
            if (_promptOpen)
            {
                string path = _selected.PromptPath;
                if (!string.IsNullOrEmpty(path) && File.Exists(ProductionReviewCatalog.Resolve(_store.Root, path)))
                    EditorGUILayout.TextArea(File.ReadAllText(ProductionReviewCatalog.Resolve(_store.Root, path)), GUILayout.MinHeight(220));
                else EditorGUILayout.LabelField("Exact prompt unavailable locally. Inspect the retained provenance record.");
            }
        }

        private object CurrentState() => _states.Length == 0 ? null : JsonRead.Get(JsonRead.Get(_unit, "states"), _states[_stateIndex]);

        private void FrameInspector()
        {
            if (_states.Length == 0 || _atlas == null) return;
            EditorGUILayout.LabelField("Runtime atlas · authored frames and grounded pivot", EditorStyles.boldLabel);
            int state = EditorGUILayout.Popup("State", _stateIndex, _states);
            if (state != _stateIndex) { _stateIndex = state; _frameIndex = 0; }
            var current = CurrentState();
            var animation = JsonRead.Get(current, "animation");
            var frames = JsonRead.Arr(animation, "frames");
            string frame = JsonRead.Str(current, "frame");
            if (frames.Count > 0)
            {
                _frameIndex = EditorGUILayout.IntSlider("Selected frame", _frameIndex, 0, frames.Count - 1);
                frame = frames[_frameIndex] as string ?? frame;
                _playFrames = EditorGUILayout.Toggle("Play authored loop / one-shot", _playFrames);
            }
            EditorGUILayout.LabelField(frame + " · " + JsonRead.Num(animation, "fps", 0) + " FPS · loop " + JsonRead.Bool(animation, "loop"), EditorStyles.miniLabel);
            var rect = JsonRead.Get(JsonRead.Get(_atlas, "frames"), frame) as List<object>;
            if (_atlasTexture == null || rect == null || rect.Count < 4)
            {
                EditorGUILayout.HelpBox("Authored metadata is available, but this historical atlas is not decoded in the initial Unity bundle. Source remains a reference.", MessageType.Info);
                return;
            }
            float x = Convert.ToSingle(rect[0]), y = Convert.ToSingle(rect[1]), w = Convert.ToSingle(rect[2]), h = Convert.ToSingle(rect[3]);
            Rect display = GUILayoutUtility.GetRect(280, 280, GUILayout.Width(280), GUILayout.Height(280));
            float scale = Math.Min(display.width / w, display.height / h);
            var fit = new Rect(display.center.x - w * scale / 2, display.yMax - h * scale, w * scale, h * scale);
            EditorGUI.DrawRect(display, new Color(0.13f, 0.11f, 0.17f));
            GUI.DrawTextureWithTexCoords(fit, _atlasTexture, new Rect(x / _atlasTexture.width, 1 - (y + h) / _atlasTexture.height, w / _atlasTexture.width, h / _atlasTexture.height));
            float pivot = (float)JsonRead.Num(current, "pivot_x", 0.5), foot = (float)JsonRead.Num(current, "foot_y", 1);
            Vector2 point = new Vector2(fit.x + fit.width * pivot, fit.y + fit.height * foot);
            Handles.BeginGUI(); Handles.color = Color.yellow;
            Handles.DrawLine(new Vector3(fit.x, point.y), new Vector3(fit.xMax, point.y));
            Handles.DrawLine(new Vector3(point.x - 8, point.y), new Vector3(point.x + 8, point.y));
            Handles.DrawLine(new Vector3(point.x, point.y - 8), new Vector3(point.x, point.y + 8));
            Handles.EndGUI();
        }

        private void DrawImage(Texture2D texture, string caption)
        {
            using (new EditorGUILayout.VerticalScope())
            {
                GUILayout.Label(caption, EditorStyles.wordWrappedMiniLabel);
                if (texture == null) { EditorGUILayout.HelpBox("Source preview unavailable. Historical WebP-only assets may not be exported in the initial bundle.", MessageType.Info); return; }
                float width = 560 * _zoom, height = width * texture.height / texture.width;
                Rect rect = GUILayoutUtility.GetRect(width, height, GUILayout.Width(width), GUILayout.Height(height));
                EditorGUI.DrawTextureTransparent(rect, texture, ScaleMode.ScaleToFit);
                if (!_guides) return;
                Handles.BeginGUI();
                Handles.color = new Color(0.9f, 0.75f, 0.45f, 0.7f);
                Handles.DrawLine(new Vector3(rect.center.x, rect.y), new Vector3(rect.center.x, rect.yMax));
                Handles.DrawLine(new Vector3(rect.x, rect.center.y), new Vector3(rect.xMax, rect.center.y));
                Handles.DrawWireCube(rect.center, rect.size * 0.8f);
                Handles.EndGUI();
            }
        }

        private ProductionPreviewRequest CopyRequest() => JsonUtility.FromJson<ProductionPreviewRequest>(JsonUtility.ToJson(_request));

        private void SceneInspector()
        {
            EditorGUILayout.LabelField("Real runtime controllers", EditorStyles.boldLabel);
            var scenarios = new List<string> { "boot", "studio", "title", "portrait/fadyme", "portrait/mahmut" };
            scenarios.AddRange(_assets.Select(a => a.Scenario).Where(s => s.StartsWith("portrait/", StringComparison.Ordinal) && !scenarios.Contains(s)).Distinct());
            scenarios.AddRange(new[] { "portrait/fadyme/authored", "portrait/mahmut/authored" });
            for (int tutorial = 1; tutorial <= 3; tutorial++)
                scenarios.AddRange(new[] { "story/tutorial_t" + tutorial + "_before", "story/tutorial_t" + tutorial + "_after" });
            var prologue = UomdJson.ParseObject(File.ReadAllText(ProductionReviewCatalog.Resolve(_store.Root, "content/base/entry/prologue.json")));
            scenarios.AddRange(JsonRead.Arr(prologue, "scenes").Select(s => "prologue/" + JsonRead.Str(s, "id")));
            int current = Math.Max(0, scenarios.IndexOf(_request.scenario));
            int next = EditorGUILayout.Popup("Scenario / canonical shot", current, scenarios.ToArray());
            if (next != current)
            {
                _request.scenario = scenarios[next];
                _request.lineId = "";
                _request.presentation = RebuildPresentationConfig.For(_request.scenario);
                var asset = _assets.FirstOrDefault(a => a.Scenario == _request.scenario);
                if (asset != null) SelectAsset(asset.Id);
            }
            EditorGUILayout.HelpBox("Tutorial previews use the native story view and rebuilt stage/portrait candidates. Portrait variants isolate one pose; /authored follows canonical emotions. Story previews can read through locally without saving progress.", MessageType.None);
            if (_request.scenario.StartsWith("portrait/", StringComparison.Ordinal) || _request.scenario.StartsWith("story/", StringComparison.Ordinal))
            {
                string storyPath = _request.scenario.StartsWith("story/", StringComparison.Ordinal) ? _request.scenario : "story/tutorial_t1_before";
                var story = UomdJson.ParseObject(File.ReadAllText(ProductionReviewCatalog.Resolve(_store.Root, "content/base/" + storyPath + ".json")));
                var lines = JsonRead.Arr(story, "commands").Where(c => JsonRead.Str(c, "op") == "say" || JsonRead.Str(c, "op") == "narrate").Select(c => JsonRead.Str(c, "line_id")).ToArray();
                string defaultLine = _request.scenario.StartsWith("story/", StringComparison.Ordinal) ? lines[0]
                    : _request.PortraitCharacter == "fadyme" ? "tutorial_t1_before_003" : "tutorial_t1_before_002";
                if (!lines.Contains(_request.lineId)) _request.lineId = defaultLine;
                _request.lineId = lines[EditorGUILayout.Popup("Canonical line (restart to show)", Array.IndexOf(lines, _request.lineId), lines)];
            }
            using (new EditorGUILayout.HorizontalScope())
            {
                using (new EditorGUI.DisabledScope(EditorApplication.isPlayingOrWillChangePlaymode))
                    if (GUILayout.Button("Open isolated preview")) Run(() => { var size = Sizes[_viewport]; ProductionReviewSession.Start(CopyRequest(), size.x, size.y); });
                using (new EditorGUI.DisabledScope(!ProductionReviewSession.Active))
                {
                    if (GUILayout.Button("Restart / show selected")) Run(() => ProductionReviewSession.Show(CopyRequest()));
                    if (GUILayout.Button("Stop & restore")) Run(ProductionReviewSession.Stop);
                }
            }
            int viewport = EditorGUILayout.Popup("Game-view pixels", _viewport, Viewports);
            if (viewport != _viewport)
            {
                _viewport = viewport;
                if (ProductionReviewSession.Active) Run(() => ProductionReviewViewport.Set(Sizes[viewport].x, Sizes[viewport].y));
            }
            EditorGUI.BeginChangeCheck();
            var activeRouter = ProductionReviewSession.Router;
            if (activeRouter != null && activeRouter.ProductionPreviewReady && activeRouter.ProductionPreview.scenario == _request.scenario)
            {
                _request.paused = activeRouter.ProductionPreview.paused;
                _request.muted = activeRouter.Audio.Muted;
            }
            _request.paused = EditorGUILayout.Toggle("Pause scene / voice / music", _request.paused);
            _request.muted = EditorGUILayout.Toggle("Mute audition (temporary)", _request.muted);
            _request.reducedMotion = EditorGUILayout.Toggle("Reduced motion", _request.reducedMotion);
            _request.reduceFlash = EditorGUILayout.Toggle("Reduced flash", _request.reduceFlash);
            _request.subtitles = EditorGUILayout.Toggle("Subtitle block visible", _request.subtitles);
            _request.safeArea = EditorGUILayout.Toggle("Simulated cutout / gesture insets", _request.safeArea);
            bool stageAuthoring = _request.scenario == "studio" || _request.scenario.StartsWith("prologue/", StringComparison.Ordinal);
            using (new EditorGUI.DisabledScope(!stageAuthoring))
            {
                _request.presentation.framing = EditorGUILayout.Slider("Camera framing", _request.presentation.framing, 0.8f, 1.2f);
                _request.presentation.subtitleBottom = EditorGUILayout.Slider("Subtitle bottom (authored px)", _request.presentation.subtitleBottom, 80, 320);
                _request.presentation.light = EditorGUILayout.Slider("Stage light multiplier", _request.presentation.light, 0.2f, 2);
                _request.presentation.particles = EditorGUILayout.Toggle("Stage particles", _request.presentation.particles);
            }
            if (EditorGUI.EndChangeCheck()) Run(() =>
            {
                var router = ProductionReviewSession.Router;
                if (router == null || !router.ProductionPreviewReady || router.ProductionPreview.scenario != _request.scenario) return;
                var active = router.ProductionPreview;
                active.paused = _request.paused; active.muted = _request.muted; active.subtitles = _request.subtitles;
                active.reducedMotion = _request.reducedMotion; active.reduceFlash = _request.reduceFlash; active.safeArea = _request.safeArea;
                active.presentation = CopyRequest().presentation;
                router.ApplyPreviewControls();
            });
            EditorGUILayout.HelpBox("Framing, subtitle and light controls apply to Studio / opening stages. Title uses its native UXML/USS framing. Seeking audio is not supported; restart the selected shot to audition from its beginning. Aspect changes also work while paused. Safe areas here are simulated, not physical-device proof.", MessageType.Info);
            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Save Draft")) Run(() => { _store.SaveDraft(_request.presentation); _message = "Draft saved; runtime authoring unchanged."; });
                if (GUILayout.Button("Load Draft")) Run(() => _request.presentation = _store.LoadDraft(_request.scenario));
                using (new EditorGUI.DisabledScope(!stageAuthoring))
                if (GUILayout.Button("Apply reviewed presentation")) Run(() =>
                {
                    if (_request.scenario != "studio" && !_request.scenario.StartsWith("prologue/", StringComparison.Ordinal)) throw new InvalidOperationException("Stage authoring applies to Studio / opening shots. Portrait masters are temporary review variants.");
                    _store.ApplyDraft(_request.presentation);
                    AssetDatabase.ImportAsset("Assets/_UOMD/Resources/Rebuild/Presentation.json");
                    _message = "Presentation saved to runtime authoring; prior config retained. Restart preview to verify. Art approval unchanged.";
                });
                if (GUILayout.Button("Load saved authoring")) Run(() => _request.presentation = RebuildPresentationConfig.For(_request.scenario));
            }
            using (new EditorGUI.DisabledScope(!ProductionReviewSession.Active))
                if (GUILayout.Button("Capture settled Game view + metadata")) Run(() => ProductionReviewCaptureService.Capture(_selected, _store));
            var live = ProductionReviewSession.Router;
            if (live != null)
            {
                EditorGUILayout.LabelField("Live: " + live.ActiveScreenId + " / " + (live.ProductionPreviewReady ? "ready" : "loading"));
                var opening = live.Controller<RebuildPrologueScreen>();
                if (live.ActiveScreenId == UomdScreenId.Prologue && opening != null)
                    EditorGUILayout.LabelField("Canonical shot " + (opening.CurrentShot + 1) + " · " + opening.ShotElapsed.ToString("F2") + " seconds · normal speed");
                if (GUILayout.Button("Inspect owned stage in Hierarchy")) Selection.activeGameObject = GameObject.Find("SolCinematicStage");
            }
        }

        private void ReviewInspector()
        {
            EditorGUILayout.HelpBox("Requests bind the selected ID + ingest revision + exact source hash. Agent QC, requested revision, owner art acceptance and device/release gates remain separate. Human art acceptance uses tools/ingest_art.ts; this window does not approve images.", MessageType.Info);
            EditorGUILayout.LabelField(_selected.Identity, EditorStyles.wordWrappedMiniLabel);
            _note = EditorGUILayout.TextArea(_note, GUILayout.MinHeight(100));
            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Record revision request")) Run(() => Record("revision_requested"));
                if (GUILayout.Button("Record agent QC note")) Run(() => Record("agent_qc_note"));
            }
            if (GUILayout.Button("Refresh saved requests / captures")) _index = _store.Read();
            foreach (var record in _index.requests.Where(r => r.assetId == _selected.Id).Reverse())
            {
                using (new EditorGUILayout.VerticalScope(EditorStyles.helpBox))
                {
                    EditorGUILayout.LabelField(record.kind + " · r" + record.revision + " · " + record.createdAt, EditorStyles.miniLabel);
                    EditorGUILayout.LabelField(record.scenario + " · " + record.lineId, EditorStyles.miniLabel);
                    EditorGUILayout.LabelField(record.request, EditorStyles.wordWrappedLabel);
                    EditorGUILayout.SelectableLabel("Source SHA-256 " + record.sourceSha, EditorStyles.miniLabel, GUILayout.Height(30));
                    record.outcome = EditorGUILayout.TextField("Outcome / follow-up", record.outcome);
                    if (GUILayout.Button("Save outcome")) Run(() =>
                    {
                        var latest = _store.Read();
                        latest.requests.Single(r => r.id == record.id).outcome = record.outcome;
                        _store.Write(latest);
                        _index = latest;
                        _message = "Outcome saved against the original revision.";
                    });
                }
            }
            foreach (var capture in _index.captures.Where(c => c.scenario == _request.scenario).Reverse())
                if (GUILayout.Button(capture.scenario + " · " + capture.id)) Run(() => EditorUtility.RevealInFinder(ProductionReviewCatalog.Resolve(_store.Root, "docs/review/" + capture.image)));
        }

        public void Record(string kind)
        {
            string line = "";
            var prologue = UomdJson.ParseObject(File.ReadAllText(ProductionReviewCatalog.Resolve(_store.Root, "content/base/entry/prologue.json")));
            var shot = JsonRead.Arr(prologue, "scenes").FirstOrDefault(s => "prologue/" + JsonRead.Str(s, "id") == _request.scenario);
            if (shot != null) line = JsonRead.Str(shot, "line_id");
            if (_request.scenario.StartsWith("portrait/", StringComparison.Ordinal) || _request.scenario.StartsWith("story/", StringComparison.Ordinal))
                line = _request.lineId;
            _store.AddRequest(_selected, _selected.Scenario.Length > 0 ? _request.scenario : "asset", line, _note, kind, _request.presentation);
            _index = _store.Read();
            _message = "Saved to docs/review/PRODUCTION_REVIEW.json. Ingest approval unchanged.";
        }
    }
}
