using System;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.UI;

namespace Uomd.Scenes
{
    /// <summary>
    /// Design prototype (not wired into the player flow): an editorial Home in the spirit of the Reverse: 1999 reference
    /// (README: principles only) — character on stage, four numbered primary paths, everything else secondary. The
    /// classic <see cref="HomeScreen"/> is untouched; reach this one with NavigateToAsync(UomdScreenId.HomePrototype).
    /// Copy reuses existing Home/Title strings; no new canon.
    /// </summary>
    public sealed class HomePrototypeScreen : IUomdScreenController
    {
        private const float RefW = UomdScreenKit.RefWidth, RefH = UomdScreenKit.RefHeight;
        private const float ColumnX = 1170f, ColumnW = 660f;

        private readonly UomdSceneRouter _router;
        private VisualElement _band;
        private float _insetL, _insetT, _insetR, _insetB;

        public HomePrototypeScreen(UomdSceneRouter router) => _router = router;

        public UomdScreenId ScreenId => UomdScreenId.HomePrototype;
        private bool Calm => _router.Session.ReducedMotion;

        public Awaitable OnEnterAsync(VisualElement screenRoot)
        {
            _router.Audio.PlayBgmCue("bgm_main_theme");
            Vector4 insets = SafeAreaBinder.ReadBandInsets(RefW, RefH, 220f, 120f);
            (_insetL, _insetT, _insetR, _insetB) = (insets.x, insets.y, insets.z, insets.w);

            var catalog = _router.Media.Catalog;
            var stage = UomdScreenKit.Layer(screenRoot, UomdThemeTokens.Void);
            stage.style.overflow = Overflow.Hidden; // the bled-out portrait must not spill into 4:3 letterbox bands
            UomdScreenKit.Backdrop(stage, _router.Media, catalog.Background("shelter_courtyard_dusk") ?? catalog.Background("forest_whispering_ash"));
            var v = UomdThemeTokens.Void;
            UomdScreenKit.Layer(stage, new Color(v.r, v.g, v.b, 0.30f));
            stage.Add(new UomdGradient(true, (0f, new Color(v.r, v.g, v.b, 0.05f)), (0.42f, new Color(v.r, v.g, v.b, 0.18f)),
                (0.62f, new Color(v.r, v.g, v.b, 0.78f)), (1f, new Color(v.r, v.g, v.b, 0.94f))));
            UomdScreenKit.VerticalShade(stage, 0, 320, v, 0f, 0.85f, fromBottom: true);

            _band = new VisualElement { pickingMode = PickingMode.Ignore };
            _band.style.position = Position.Absolute;
            _band.style.left = new Length(50, LengthUnit.Percent);
            _band.style.marginLeft = -RefW / 2f;
            _band.style.width = RefW;
            _band.style.height = RefH;
            stage.Add(_band);

            BuildWatermark();
            BuildCharacter(catalog);
            BuildDateline();
            BuildPrimaryColumn();
            BuildSecondaryLinks();
            BuildUtilityStrip();
            BuildCornerLinks();
            return UomdAwaitables.Completed();
        }

        public void OnTick(float deltaTime) { }

        public void OnExit() => _band = null;

        private void BuildWatermark()
        {
            var g = UomdThemeTokens.GoldHi;
            var mark = At(Display("I", 760, new Color(g.r, g.g, g.b, 0.035f)), ColumnX + 330f, -60f);
            mark.style.unityTextAlign = TextAnchor.UpperLeft;
        }

        private void BuildCharacter(UomdMediaCatalog catalog)
        {
            // oversized and bled past the bottom edge so the figure, not the frame, owns the left half
            var portrait = UomdScreenKit.Image(_band, _router.Media, catalog.Portrait("fadyme", "composed"), 1180, 1500);
            At(portrait, -60f + _insetL * 0.5f, -150f);
            portrait.style.opacity = 0f;
            portrait.style.marginTop = 24f;
            UomdScreenKit.Fade(portrait, 1f, 900, 100, Calm, EasingMode.EaseOutCubic);
            UomdScreenKit.Move(portrait, 0, 0, 900, 100, Calm);
        }

        private void BuildDateline()
        {
            float x = 72f + _insetL, y = 54f + _insetT;
            var rule = At(new VisualElement { pickingMode = PickingMode.Ignore }, x, y + 4f);
            rule.style.width = 3f;
            rule.style.height = 64f;
            rule.style.backgroundColor = UomdThemeTokens.Crimson;
            Left(At(Display("PART I  ·  UNAWARE, I FADE", 22, UomdThemeTokens.GoldHi, 4f), x + 20f, y));
            Left(At(Serif("The shelter courtyard, at dusk", 28, UomdThemeTokens.TextDim, italic: true), x + 20f, y + 34f));
        }

        private void BuildPrimaryColumn()
        {
            Left(At(Display("THE COMPANY", 20, UomdThemeTokens.TextDim, 8f), ColumnX, 172f));
            var entries = new (string Numeral, string Label, string Sub, UomdScreenId Screen, float Size)[]
            {
                ("I", "CHAPTERS", "Campaign and star rewards", UomdScreenId.Chapters, 72f),
                ("II", "SUMMON", "Banners, rates, pity", UomdScreenId.Summon, 46f),
                ("III", "ROSTER", "Your company", UomdScreenId.Roster, 46f),
                ("IV", "TEAM", "Formation and presets", UomdScreenId.Team, 46f)
            };
            // a flex column: the font's real line heights set the spacing, not hand-tuned coordinates
            _column = At(new VisualElement { pickingMode = PickingMode.Ignore }, ColumnX, 206f);
            _column.style.width = ColumnW;
            for (int i = 0; i < entries.Length; i++)
            {
                var e = entries[i];
                bool primary = i == 0;
                var row = PrimaryRow(e.Numeral, e.Label, e.Sub, e.Size, primary, () => Go(e.Screen));
                _column.Add(row);
                row.style.opacity = 0f;
                UomdScreenKit.Fade(row, 1f, 520, 180 + i * 90, Calm, EasingMode.EaseOutCubic);
                Rule(primary ? 0.55f : 0.28f);
            }
        }

        private VisualElement _column;

        private void Rule(float alpha)
        {
            var g = UomdThemeTokens.Gold;
            var line = new VisualElement { pickingMode = PickingMode.Ignore };
            line.style.height = 1f;
            line.style.marginTop = line.style.marginBottom = 10f;
            line.style.backgroundColor = new Color(g.r, g.g, g.b, alpha);
            _column.Add(line);
        }

        private VisualElement PrimaryRow(string numeral, string label, string sub, float size, bool primary, Action onClick)
        {
            var row = new VisualElement { pickingMode = PickingMode.Position, focusable = true };
            row.style.flexDirection = FlexDirection.Row;
            row.style.alignItems = Align.FlexStart;
            row.style.width = ColumnW;
            row.style.minHeight = 96f; // touch target

            var num = Display(numeral, primary ? 30 : 24, primary ? UomdThemeTokens.CrimsonHi : UomdThemeTokens.Gold, 2f, row);
            num.style.width = 74f;
            num.style.marginTop = primary ? 30f : 16f;
            num.style.unityTextAlign = TextAnchor.UpperLeft;

            var stack = new VisualElement { pickingMode = PickingMode.Ignore };
            row.Add(stack);
            var title = Left(Display(label, size, UomdThemeTokens.TextPrimary, primary ? 6f : 4f, stack));
            var caption = Left(Serif(sub, primary ? 30 : 26, UomdThemeTokens.TextDim, italic: true, parent: stack));
            if (primary)
            {
                var cta = Left(Display("CONTINUE  →", 20, UomdThemeTokens.GoldHi, 5f, stack));
                cta.style.marginTop = 4f;
            }

            row.RegisterCallback<PointerEnterEvent>(_ => title.style.color = UomdThemeTokens.GoldHi);
            row.RegisterCallback<PointerLeaveEvent>(_ => title.style.color = UomdThemeTokens.TextPrimary);
            row.RegisterCallback<ClickEvent>(_ => onClick());
            return row;
        }

        private void BuildSecondaryLinks()
        {
            var links = new (string Label, UomdScreenId Screen)[]
            {
                ("ERRANDS", UomdScreenId.Tasks), ("DEEDS", UomdScreenId.Deeds), ("TRIALS", UomdScreenId.Trials),
                ("ARMORY", UomdScreenId.Gear), ("SHOP", UomdScreenId.Shop), ("MAIL", UomdScreenId.Mail), ("ACTIONS", UomdScreenId.Operations)
            };
            var wrap = new VisualElement { pickingMode = PickingMode.Ignore };
            _column.Add(wrap);
            wrap.style.flexDirection = FlexDirection.Row;
            wrap.style.flexWrap = Wrap.Wrap;
            foreach (var link in links)
            {
                var item = Display(link.Label, 22, UomdThemeTokens.Bone, 4f, wrap);
                item.pickingMode = PickingMode.Position;
                item.style.height = 56f; // with the row gap this stays a comfortable touch target
                item.style.marginRight = 34f;
                item.style.unityTextAlign = TextAnchor.MiddleLeft;
                var target = link.Screen;
                item.RegisterCallback<PointerEnterEvent>(_ => item.style.color = UomdThemeTokens.GoldHi);
                item.RegisterCallback<PointerLeaveEvent>(_ => item.style.color = UomdThemeTokens.Bone);
                item.RegisterCallback<ClickEvent>(_ => Go(target));
            }
        }

        private void BuildUtilityStrip()
        {
            var tools = new (string Icon, string Label, UomdScreenId Screen)[]
            {
                ("icon_nav_settings_seal", "OPTIONS", UomdScreenId.Account), ("icon_ui_bell", "NOTICES", UomdScreenId.ContentPanel),
                ("icon_book", "ARCHIVE", UomdScreenId.Library), ("icon_crown", "PROFILE", UomdScreenId.Profile)
            };
            var strip = new VisualElement { pickingMode = PickingMode.Ignore };
            strip.style.position = Position.Absolute;
            strip.style.left = 56f + _insetL;
            strip.style.bottom = 32f + _insetB;
            strip.style.flexDirection = FlexDirection.Row;
            // an ink plate keeps the icons legible over the character art
            var ink = UomdThemeTokens.Ink;
            strip.style.backgroundColor = new Color(ink.r, ink.g, ink.b, 0.82f);
            strip.style.paddingLeft = strip.style.paddingRight = 12f;
            strip.style.borderTopLeftRadius = strip.style.borderTopRightRadius = 6f;
            strip.style.borderBottomLeftRadius = strip.style.borderBottomRightRadius = 6f;
            var g = UomdThemeTokens.Gold;
            strip.style.borderTopWidth = 1f;
            strip.style.borderTopColor = new Color(g.r, g.g, g.b, 0.45f);
            _band.Add(strip);
            foreach (var tool in tools)
            {
                var cell = new VisualElement { pickingMode = PickingMode.Position };
                cell.style.width = 112f;
                cell.style.height = 112f; // touch target
                cell.style.alignItems = Align.Center;
                cell.style.justifyContent = Justify.Center;
                cell.Add(UomdGothicVfx.CreateTintedSprite(tool.Icon, 56f, 56f, UomdThemeTokens.GoldHi));
                var caption = Display(tool.Label, 16, UomdThemeTokens.TextDim, 3f, cell);
                caption.style.marginTop = 6f;
                var target = tool.Screen;
                cell.RegisterCallback<ClickEvent>(_ => Go(target));
                strip.Add(cell);
            }
        }

        private void BuildCornerLinks()
        {
            var account = Display(_router.Api.IsSignedIn ? "SIGNED IN" : "SIGN IN", 20, UomdThemeTokens.GoldHi, 5f);
            account.pickingMode = PickingMode.Position;
            account.style.position = Position.Absolute;
            account.style.right = 72f + _insetR;
            account.style.top = 56f + _insetT;
            account.style.height = 64f;
            account.RegisterCallback<ClickEvent>(_ => Go(UomdScreenId.Account));

            var classic = Display("PROTOTYPE  ·  OPEN CLASSIC HOME", 16, UomdThemeTokens.TextDim, 3f);
            classic.pickingMode = PickingMode.Position;
            classic.style.position = Position.Absolute;
            classic.style.right = 72f + _insetR;
            classic.style.bottom = 48f + _insetB;
            classic.style.height = 64f;
            classic.RegisterCallback<ClickEvent>(_ => Go(UomdScreenId.Home));
        }

        private void Go(UomdScreenId screen)
        {
            _router.Audio.PlaySfx("sfx_ui_confirm");
            _ = _router.NavigateToAsync(screen);
        }

        private Label Display(string text, float size, Color color, float spacing = 0f, VisualElement parent = null)
        {
            var label = UomdScreenKit.Text(parent ?? _band, text, size, color, spacing);
            label.AddToClassList("uomd-display");
            return label;
        }

        private Label Serif(string text, float size, Color color, bool italic = false, VisualElement parent = null) =>
            UomdScreenKit.Text(parent ?? _band, text, size, color, 0f, italic: italic);

        private static T Left<T>(T label) where T : Label
        {
            label.style.unityTextAlign = TextAnchor.MiddleLeft;
            return label;
        }

        /// <summary>Absolute position in the band; adds the element to the band when it has no parent yet.</summary>
        private T At<T>(T element, float x, float y) where T : VisualElement
        {
            if (element.parent == null) _band.Add(element);
            element.style.position = Position.Absolute;
            element.style.left = x;
            element.style.top = y;
            return element;
        }
    }
}
