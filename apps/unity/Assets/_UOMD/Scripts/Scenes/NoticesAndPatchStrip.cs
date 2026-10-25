#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.Core.Patching;
using Uomd.UI;

namespace Uomd.Scenes
{
    /// <summary>
    /// The notice reader (port of ContentPanelScene.ts): panels of the content's presentation pack that the server admits
    /// (GET /api/v1/presentation/panels). Downloaded data can only open compiled screens and other admitted notices.
    /// </summary>
    public sealed class NoticesScreen : UomdHubScreen
    {
        private const int LinesPerPage = 8;
        private string? _selected;
        private int _page, _listPage;

        public NoticesScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.ContentPanel;
        protected override string Heading => "NOTICES";
        protected override bool UsesWallet => false;

        public override void OnExit()
        {
            base.OnExit();
            _selected = null;
            _page = _listPage = 0;
        }

        protected override async Awaitable BuildAsync(int generation)
        {
            string release = Router.Patch.ActiveReleaseId;
            var pack = UomdJson.ParseObject(await Router.Patch.ReadTextAsync("presentation/presentation.json"));
            var admission = await Router.Api.GetJsonAsync($"/api/v1/presentation/panels?releaseId={Uri.EscapeDataString(release)}");
            if (!IsCurrent(generation) || Router.Patch.ActiveReleaseId != release) return;
            var allowed = new HashSet<string>(JsonRead.Strings(admission, "panelIds").Take(64), StringComparer.Ordinal);
            var panels = JsonRead.Obj(pack, "panels");
            if (_selected == null)
            {
                var rows = panels.Where(p => allowed.Contains(p.Key) && p.Value is Dictionary<string, object?>).ToList();
                if (rows.Count == 0) Text(RefW / 2f, 420f, "No notices are available.", 44, UomdThemeTokens.TextDim, 0.5f, 0.5f);
                var slice = rows.Skip(_listPage * 4).Take(4).ToList();
                for (int i = 0; i < slice.Count; i++)
                {
                    string id = slice[i].Key;
                    Button(RefW / 2f, 270f + i * 165f, Label(JsonRead.Obj(slice[i].Value, "title")), null, 1400, 140, 36, UomdPanelVariant.Normal, () => { _selected = id; _page = 0; _ = RefreshAsync(); });
                }
                Pager(_listPage, (int)Math.Ceiling(rows.Count / 4.0), n => { _listPage = n; _ = RefreshAsync(); });
                return;
            }
            if (!(JsonRead.Get(panels, _selected) is Dictionary<string, object?> panel) || !allowed.Contains(_selected))
            {
                Text(RefW / 2f, 420f, "This notice is not available.", 44, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
                return;
            }
            var title = Text(RefW / 2f, 195f, Label(JsonRead.Obj(panel, "title")), 44, UomdThemeTokens.Gold, 0.5f, 0.5f, wrapWidth: 1600f);
            title.style.unityTextAlign = TextAnchor.MiddleCenter;
            string imageId = JsonRead.Str(panel, "image_id");
            string? still = imageId.Length > 0 ? Router.Media.Catalog.Still(imageId) : null;
            if (still != null)
            {
                var image = UomdScreenKit.Image(Body, Router.Media, still, 540f, 480f, ScaleMode.ScaleToFit);
                Place(image, 420f, 510f, 0.5f, 0.5f);
            }
            float width = still != null ? 950f : 1500f, x = still != null ? 760f : 210f;
            var pages = Paginate(JsonRead.Objects(panel, "body").Select(Label), width);
            _page = Math.Min(_page, Math.Max(0, pages.Count - 1));
            var body = Text(x, 320f, pages.Count > 0 ? pages[_page] : "", 32, UomdThemeTokens.TextPrimary, wrapWidth: width);
            body.style.unityTextAlign = TextAnchor.UpperLeft;
            var buttons = JsonRead.Objects(panel, "buttons").Take(4).ToList();
            for (int i = 0; i < buttons.Count; i++)
            {
                var action = JsonRead.Obj(buttons[i], "action");
                Button(RefW / 2f + (i - (buttons.Count - 1) / 2f) * 420f, 820f, Label(JsonRead.Obj(buttons[i], "label")), null, 400, 110, 28, UomdPanelVariant.Normal, () => Act(action));
            }
            Pager(_page, pages.Count, n => { _page = n; _ = RefreshAsync(); });
        }

        /// <summary>The English text (the Unity client has no locale switch yet).</summary>
        private static string Label(Dictionary<string, object?> label) => JsonRead.Str(label, "text_en");

        /// <summary>Pages of up to eight wrapped lines, estimated from the body face's average advance at 32 px.</summary>
        private static List<string> Paginate(IEnumerable<string> paragraphs, float width)
        {
            int perLine = Mathf.Max(20, Mathf.FloorToInt(width / 15f));
            var pages = new List<string>();
            foreach (string paragraph in paragraphs)
            {
                var lines = new List<string>();
                var line = new StringBuilder();
                foreach (string word in paragraph.Split(' '))
                {
                    if (line.Length > 0 && line.Length + 1 + word.Length > perLine)
                    {
                        lines.Add(line.ToString());
                        line.Clear();
                    }
                    if (line.Length > 0) line.Append(' ');
                    line.Append(word);
                }
                if (line.Length > 0) lines.Add(line.ToString());
                for (int at = 0; at < lines.Count; at += LinesPerPage) pages.Add(string.Join(" ", lines.Skip(at).Take(LinesPerPage)));
            }
            return pages;
        }

        private void Pager(int page, int count, Action<int> change)
        {
            if (count <= 1) return;
            UomdScreenKit.SetEnabled(Button(650f, 990f, "PREVIOUS", null, 330, 110, 32, UomdPanelVariant.Normal, () => change(page - 1)), page > 0);
            Text(RefW / 2f, 990f, $"{page + 1} / {count}", 32, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
            UomdScreenKit.SetEnabled(Button(1270f, 990f, "NEXT", null, 330, 110, 32, UomdPanelVariant.Normal, () => change(page + 1)), page + 1 < count);
        }

        private void Act(Dictionary<string, object?> action)
        {
            switch (JsonRead.Str(action, "type"))
            {
                case "close":
                    GoBack();
                    break;
                case "panel":
                    _selected = JsonRead.Str(action, "panel_id");
                    _page = 0;
                    _ = RefreshAsync();
                    break;
                case "screen":
                    // the content validator admits only compiled TS screen names; they match the Unity screen ids
                    if (Enum.TryParse(JsonRead.Str(action, "screen"), false, out UomdScreenId screen) && screen >= UomdScreenId.Home) _ = Router.NavigateToAsync(screen);
                    break;
            }
        }
    }

    /// <summary>
    /// The download strip along the bottom edge of every screen while the first-install patch downloads (port of
    /// PatchBarScene.ts): pause, retry, or restart into staged content. Hidden when idle, on the Finish page and while the
    /// Title shows its own progress; it never takes taps on gameplay screens.
    /// </summary>
    public sealed class UomdPatchStrip
    {
        private const float BarH = 10f, StripH = 110f;
        private static readonly UomdScreenId[] Gameplay = { UomdScreenId.Battle, UomdScreenId.Story, UomdScreenId.Prologue };

        private readonly UomdSceneRouter _router;
        private readonly VisualElement _strip, _fill;
        private readonly Label _left, _right;
        private readonly Button _action;
        private PatchServiceStatus? _rendered;
        private bool _shown, _wantAction, _restarting;

        public UomdPatchStrip(UomdSceneRouter router, VisualElement host)
        {
            _router = router;
            _strip = new VisualElement { name = "patch-strip", pickingMode = PickingMode.Ignore };
            _strip.style.position = Position.Absolute;
            _strip.style.left = new Length(50, LengthUnit.Percent);
            _strip.style.marginLeft = -UomdScreenKit.RefWidth / 2f;
            _strip.style.width = UomdScreenKit.RefWidth;
            _strip.style.bottom = 0;
            _strip.style.height = StripH;
            _strip.style.opacity = 0f;
            _strip.style.display = DisplayStyle.None;
            _strip.Add(new UomdGradient(false, (0f, new Color(0.020f, 0.012f, 0.039f, 0f)), (1f, new Color(0.020f, 0.012f, 0.039f, 0.82f))));
            var track = new VisualElement { pickingMode = PickingMode.Ignore };
            track.style.position = Position.Absolute;
            track.style.left = track.style.right = track.style.bottom = 0;
            track.style.height = BarH;
            track.style.backgroundColor = new Color(0.027f, 0.016f, 0.047f, 0.9f);
            _strip.Add(track);
            _fill = new VisualElement { pickingMode = PickingMode.Ignore };
            _fill.style.position = Position.Absolute;
            _fill.style.left = _fill.style.bottom = 0;
            _fill.style.height = BarH;
            _fill.style.width = 0;
            _fill.style.backgroundColor = UomdThemeTokens.GoldHi;
            _strip.Add(_fill);
            _left = UomdScreenKit.Text(_strip, "", 28, UomdThemeTokens.TextDim);
            _left.AddToClassList("uomd-serif");
            _left.style.position = Position.Absolute;
            _left.style.top = StripH - 55f - 20f;
            _right = UomdScreenKit.Text(_strip, "", 28, UomdThemeTokens.TextDim);
            _right.AddToClassList("uomd-serif");
            _right.style.position = Position.Absolute;
            _right.style.right = 44f;
            _right.style.top = StripH - 55f - 20f;
            // the strip itself is the button
            _action = new Button(Act) { text = "" };
            _action.style.position = Position.Absolute;
            _action.style.left = _action.style.right = _action.style.top = _action.style.bottom = 0;
            _action.style.backgroundColor = Color.clear;
            _action.style.borderTopWidth = _action.style.borderBottomWidth = _action.style.borderLeftWidth = _action.style.borderRightWidth = 0;
            _action.style.marginLeft = _action.style.marginRight = _action.style.marginTop = _action.style.marginBottom = 0;
            _action.style.display = DisplayStyle.None;
            _strip.Add(_action);
            host.Add(_strip);
        }

        private bool OnGameplay => Gameplay.Contains(_router.ActiveScreenId);

        /// <summary>Called every frame by the router; renders only when the service status changed.</summary>
        public void Tick()
        {
            var service = _router.Patch?.Service;
            if (service == null) return;
            var status = service.Status;
            if (!ReferenceEquals(status, _rendered))
            {
                _rendered = status;
                Render(status);
            }
            bool dedicated = _router.ActiveScreenId == UomdScreenId.Finish || (_router.ActiveScreenId == UomdScreenId.Title && status.Kind == PatchServiceKind.Running);
            if (dedicated && _shown) Show(false);
            else if (!dedicated && !_shown && Wanted(status)) Show(true);
            _action.style.display = _wantAction && !dedicated && !OnGameplay ? DisplayStyle.Flex : DisplayStyle.None;
        }

        private bool StagedAndDone(PatchServiceStatus s) =>
            s.Kind == PatchServiceKind.Ready && s.Outcome?.Status == PatchStatus.Staged && _router.Patch.EntryCompleted;

        private bool Wanted(PatchServiceStatus s) => s.Kind == PatchServiceKind.Running || s.Kind == PatchServiceKind.Failed || StagedAndDone(s);

        private void Act()
        {
            if (OnGameplay) return;
            var service = _router.Patch.Service;
            var s = service.Status;
            if (StagedAndDone(s) && !_restarting)
            {
                _restarting = true;
                _router.PlatformBridge.RestartApplication();
            }
            else if (s.Kind == PatchServiceKind.Running) service.Cancel();
            else if (s.Kind == PatchServiceKind.Failed) _ = service.RetryAsync(s.RequiresNetworkApproval ? true : (bool?)null);
        }

        private void Show(bool on)
        {
            if (_shown == on) return;
            _shown = on;
            if (on) _strip.style.display = DisplayStyle.Flex;
            UomdScreenKit.Fade(_strip, on ? 1f : 0f, on ? 350 : 700, 0, _router.Session.ReducedMotion);
            if (!on) UomdScreenKit.After(_strip, _router.Session.ReducedMotion ? 0 : 720, () => { if (!_shown) _strip.style.display = DisplayStyle.None; });
        }

        private void Say(string left, Color color, bool centered, string right = "", bool action = false)
        {
            _left.text = left;
            _left.style.color = color;
            _left.style.left = centered ? UomdScreenKit.RefWidth / 2f : 44f;
            _left.style.translate = new Translate(new Length(centered ? -50 : 0, LengthUnit.Percent), 0);
            _right.text = right;
            _wantAction = action;
        }

        private void Render(PatchServiceStatus s)
        {
            if (StagedAndDone(s))
            {
                Show(true);
                _fill.style.width = UomdScreenKit.RefWidth;
                Say("Content ready · tap to restart and apply", UomdThemeTokens.Gold, true, "", true);
                return;
            }
            if (s.Kind == PatchServiceKind.Idle || s.Kind == PatchServiceKind.Ready)
            {
                _wantAction = false;
                Show(false);
                return;
            }
            Show(true);
            if (s.Kind == PatchServiceKind.Failed)
            {
                _fill.style.width = UomdScreenKit.RefWidth;
                _fill.style.backgroundColor = UomdThemeTokens.Crimson;
                string text = s.UpdateRequired ? "This version of the game is too old for the road ahead. Please update the app."
                    : s.RequiresNetworkApproval ? "Downloads paused · tap to use mobile data" : "The download was interrupted. Tap to try again.";
                Say(text, UomdThemeTokens.Crimson, true, "", !s.UpdateRequired);
                return;
            }
            _fill.style.backgroundColor = UomdThemeTokens.GoldHi;
            var p = s.Progress;
            float? frac = s.BarFill;
            _fill.style.width = frac == null ? 0f : Mathf.Round(UomdScreenKit.RefWidth * frac.Value);
            string phase = p?.Phase switch
            {
                PatchPhase.Downloading => "Downloading game patch…",
                PatchPhase.Verifying => "Verifying signed manifest…",
                PatchPhase.Activating => "Applying update…",
                _ => "Checking for patches…"
            };
            string figures = p != null && p.BytesTotal > 0 && p.Phase == PatchPhase.Downloading
                ? $"{Mathf.FloorToInt((frac ?? 0f) * 100f)} %   ·   {FinishScreenController.FormatBytes(p.BytesDone)} / {FinishScreenController.FormatBytes(p.BytesTotal)}" : "";
            Say($"{phase} · tap to pause", UomdThemeTokens.TextDim, false, figures, true);
        }
    }
}
