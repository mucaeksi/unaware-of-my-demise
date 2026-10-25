using System;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.UI;

namespace Uomd.Scenes
{
    /// <summary>
    /// Shared frame of the account-backed screens (port of apps/game/src/ui/hubScreen.ts HubScreen): location backdrop with a
    /// 62 % void scrim, the heading, OPTIONS, BACK, the main-currency wallet and a clearable body. A signed-out player sees a
    /// sign-in prompt instead of broken data. Like the TS client, the body lays out in the 1920×1080 reference frame, here a
    /// centred 1920-wide band (the TS stage was letterboxed), with the safe-area insets of the band.
    /// Subclasses implement <see cref="BuildAsync"/> with the TS helpers: <see cref="Text"/>, <see cref="Button"/>,
    /// <see cref="Card"/>, <see cref="Box"/>, <see cref="Bar"/>, <see cref="Scroll"/>.
    /// </summary>
    public abstract class UomdHubScreen : IUomdScreenController
    {
        /// <summary>The single main currency (D-17); the API can rename it (`GET /api/v1/currency`).</summary>
        public static string CurrencyName = "Bell's Remains";
        private const float MaxInsetX = 220f, MaxInsetY = 120f;

        protected readonly UomdSceneRouter Router;
        private Label _wallet;
        private VisualElement _modal;
        private int _generation;

        protected UomdHubScreen(UomdSceneRouter router) => Router = router;

        public abstract UomdScreenId ScreenId { get; }
        protected abstract string Heading { get; }
        protected virtual bool NeedsSignIn => true;
        protected virtual bool UsesWallet => true;
        protected virtual UomdScreenId BackTo => UomdScreenId.Home;

        protected VisualElement Stage { get; private set; }
        /// <summary>The 1920×1080 reference band (TS stage coordinates).</summary>
        protected VisualElement Band { get; private set; }
        protected VisualElement Body { get; private set; }
        /// <summary>Last known balance of the main currency.</summary>
        protected int Balance { get; private set; }
        protected float InsetLeft { get; private set; }
        protected float InsetRight { get; private set; }
        protected float InsetTop { get; private set; }
        protected float InsetBottom { get; private set; }
        protected float HeadY => 70f + Mathf.Round(InsetTop * 0.5f);
        protected bool Calm => Router.Session.ReducedMotion;
        protected const float RefW = UomdScreenKit.RefWidth, RefH = UomdScreenKit.RefHeight;

        public Awaitable OnEnterAsync(VisualElement screenRoot)
        {
            _generation++;
            _modal = null;
            ReadInsets();
            Stage = UomdScreenKit.Layer(screenRoot, UomdThemeTokens.Void);
            string location = BackdropFor(Heading);
            var bg = UomdScreenKit.Backdrop(Stage, Router.Media, Router.Media.Catalog.Background(location) ?? Router.Media.Catalog.Background("forest_whispering_ash"));
            bg.style.opacity = 1f;
            UomdScreenKit.Layer(Stage, new Color(UomdThemeTokens.Void.r, UomdThemeTokens.Void.g, UomdThemeTokens.Void.b, 0.62f));
            Band = new VisualElement { pickingMode = PickingMode.Ignore };
            Band.style.position = Position.Absolute;
            Band.style.left = new Length(50, LengthUnit.Percent);
            Band.style.marginLeft = -RefW / 2f;
            Band.style.top = 0;
            Band.style.width = RefW;
            Band.style.height = RefH;
            Stage.Add(Band);
            BeforeFrame();
            var heading = Place(UomdScreenKit.Text(Band, Heading, 60, UomdThemeTokens.GoldHi, 2f), RefW / 2f, HeadY, 0.5f, 0.5f);
            heading.AddToClassList("uomd-display");
            heading.style.unityTextOutlineWidth = 1f;
            heading.style.unityTextOutlineColor = UomdThemeTokens.Void;
            Body = UomdScreenKit.Layer(Band);
            Body.pickingMode = PickingMode.Ignore;
            Place(UomdScreenKit.MenuButton(Band, "BACK", null, 300, 110, 32, UomdPanelVariant.Normal, GoBack), 190f + InsetLeft, RefH - 80f - InsetBottom, 0.5f, 0.5f);
            Place(UomdScreenKit.MenuButton(Band, "OPTIONS", null, 180, 64, 20, UomdPanelVariant.Normal, () => _ = Router.NavigateToAsync(UomdScreenId.Account)), 150f + InsetLeft, HeadY, 0.5f, 0.5f);
            _wallet = Place(UomdScreenKit.Text(Band, "", 30, UomdThemeTokens.TextPrimary), RefW - 60f - InsetRight, HeadY, 1f, 0.5f);
            _ = RefreshAsync();
            return UomdAwaitables.Completed();
        }

        /// <summary>Optional layers between the scrim and the frame (Home's map roads).</summary>
        protected virtual void BeforeFrame() { }

        public virtual void OnTick(float deltaTime) { }

        public virtual void OnExit()
        {
            _generation++;
            _modal = null;
        }

        protected virtual void GoBack() => _ = Router.NavigateToAsync(BackTo);

        /// <summary>hubScreen.ts resolveHubBackdrop: the location art behind a screen, by its heading.</summary>
        private static string BackdropFor(string heading)
        {
            string h = heading.ToUpperInvariant();
            if (h.Contains("SUMMON")) return "altar_first_eclipse";
            if (h.Contains("ARMORY") || h.Contains("GEAR")) return "oakhaven_forge";
            if (h.Contains("TRIALS") || h.Contains("ARENA")) return "bridge_forsaken";
            if (h.Contains("ARCHIVE") || h.Contains("LIBRARY")) return "undercity_archive_room";
            if (h.Contains("SHOP") || h.Contains("PURCHASES")) return "oakhaven_inn";
            if (h.Contains("DEEDS") || h.Contains("ERRANDS")) return "cathedral_saint_luthos";
            if (h.Contains("ROSTER") || h.Contains("COMPANION") || h.Contains("TEAM") || h.Contains("INVITATIONS")) return "shelter_courtyard_dusk";
            return "forest_whispering_ash";
        }

        /// <summary>Screen.safeArea in reference units of the band, clamped like platform/safeArea.ts.</summary>
        private void ReadInsets()
        {
            if (Screen.height <= 0) return;
            float scale = RefH / Screen.height; // PanelSettings matches height
            float panelW = Screen.width * scale, band = (panelW - RefW) / 2f;
            Rect safe = Screen.safeArea;
            InsetLeft = Mathf.Clamp(safe.xMin * scale - band, 0f, MaxInsetX);
            InsetRight = Mathf.Clamp((Screen.width - safe.xMax) * scale - band, 0f, MaxInsetX);
            InsetTop = Mathf.Clamp((Screen.height - safe.yMax) * scale, 0f, MaxInsetY);
            InsetBottom = Mathf.Clamp(safe.yMin * scale, 0f, MaxInsetY);
        }

        /// <summary>True while the render that started at <paramref name="generation"/> is still the screen's current one.</summary>
        protected bool IsCurrent(int generation) => generation == _generation && Body != null;
        protected int Generation => _generation;

        /// <summary>Re-renders the body and the wallet strip (account switch, after an action).</summary>
        protected async Awaitable RefreshAsync()
        {
            int generation = ++_generation;
            CloseModal();
            Body.Clear();
            var api = Router.Api;
            if (NeedsSignIn && !api.IsSignedIn)
            {
                _wallet.text = "";
                Text(RefW / 2f, 400f, "Sign in to use this screen.", 44, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
                Button(RefW / 2f, 560f, "ACCOUNT", null, 520, 120, 32, UomdPanelVariant.Normal, () => _ = Router.NavigateToAsync(UomdScreenId.Account));
                return;
            }
            try
            {
                if (api.IsSignedIn && UsesWallet)
                {
                    var wallet = await api.GetWalletAsync();
                    if (!IsCurrent(generation)) return;
                    ShowWallet(wallet?.eclipse_token ?? 0);
                }
                else _wallet.text = "";
                await BuildAsync(generation);
            }
            catch (Exception e)
            {
                if (IsCurrent(generation)) Say(ErrText(e));
            }
        }

        private void ShowWallet(int balance)
        {
            Balance = balance;
            _wallet.text = $"{CurrencyName} {balance.ToString("N0", System.Globalization.CultureInfo.InvariantCulture)}";
        }

        /// <summary>Cheap wallet refresh after an action.</summary>
        protected async Awaitable UpdateWalletAsync()
        {
            if (!Router.Api.IsSignedIn) return;
            int generation = _generation;
            try
            {
                var wallet = await Router.Api.GetWalletAsync();
                if (IsCurrent(generation)) ShowWallet(wallet?.eclipse_token ?? 0);
            }
            catch (Exception)
            {
                // the strip keeps the last known balance
            }
        }

        /// <summary>Builds the body; check <see cref="IsCurrent"/> after every await.</summary>
        protected abstract Awaitable BuildAsync(int generation);

        public static string ErrText(Exception e) => e is UomdApiException api
            ? api.Code == "feature_disabled" ? "This feature is switched off for now." : $"{api.Message} ({api.Code})"
            : e.Message;

        protected void Say(string message) => UomdUiKit.ShowToast(Stage, message, 3.4f);

        private bool _busy;

        /// <summary>Runs one server action at a time, then re-renders; a failure becomes a toast (TS `act`).</summary>
        protected async Awaitable ActAsync(Func<Awaitable> action)
        {
            if (_busy) return;
            _busy = true;
            try
            {
                await action();
                await RefreshAsync();
            }
            catch (Exception e)
            {
                Say(ErrText(e));
            }
            finally
            {
                _busy = false;
            }
        }

        // ------------------------------------------------------------------------------- TS layout helpers

        /// <summary>Positions an element at (x, y) of the band with an origin (0..1 of its own box), like DomNode.setOrigin.</summary>
        protected static T Place<T>(T element, float x, float y, float originX = 0f, float originY = 0f) where T : VisualElement
        {
            element.style.position = Position.Absolute;
            element.style.left = x;
            element.style.top = y;
            element.style.translate = new Translate(new Length(-originX * 100f, LengthUnit.Percent), new Length(-originY * 100f, LengthUnit.Percent));
            return element;
        }

        /// <summary>Body text (Cormorant unless <paramref name="display"/>); wrapWidth &gt; 0 wraps like TS wordWrap.</summary>
        protected Label Text(float x, float y, string text, float size, Color color, float originX = 0f, float originY = 0f, bool display = false, float wrapWidth = 0f, VisualElement into = null)
        {
            var label = UomdScreenKit.Text(into ?? Body, text, size, color);
            label.AddToClassList(display ? "uomd-display" : "uomd-serif");
            if (wrapWidth > 0f)
            {
                label.style.whiteSpace = WhiteSpace.Normal;
                label.style.width = wrapWidth;
            }
            return Place(label, x, y, originX, originY);
        }

        /// <summary>Shrinks a label to fit <paramref name="maxWidth"/> reference px (DomText.fit).</summary>
        protected static Label Fit(Label label, float maxWidth)
        {
            // shrink towards the placement origin so a left-anchored label keeps its left edge
            var translate = label.style.translate.value;
            float originX = translate.x.unit == LengthUnit.Percent ? -translate.x.value / 100f : 0.5f;
            label.style.transformOrigin = new TransformOrigin(Length.Percent(originX * 100f), Length.Percent(50f));
            label.RegisterCallback<GeometryChangedEvent>(_ =>
            {
                float w = label.resolvedStyle.width;
                float k = w > maxWidth && w > 0f ? maxWidth / w : 1f;
                label.style.scale = new Scale(new Vector3(k, k, 1f));
            });
            return label;
        }

        /// <summary>A kit button centred on (x, y).</summary>
        protected Button Button(float x, float y, string label, string sub, float width, float height, float fontSize, UomdPanelVariant variant, Action onClick, VisualElement into = null) =>
            Place(UomdScreenKit.MenuButton(into ?? Body, label, sub, width, height, fontSize, variant, onClick), x, y, 0.5f, 0.5f);

        /// <summary>A gothic card centred on (x, y); children use coordinates inside it.</summary>
        protected VisualElement Card(float x, float y, float width, float height, UomdPanelVariant variant = UomdPanelVariant.Normal, VisualElement into = null, Action onTap = null)
        {
            var card = new VisualElement { pickingMode = onTap != null ? PickingMode.Position : PickingMode.Ignore };
            card.style.width = width;
            card.style.height = height;
            card.Add(new UomdGothicPanel(variant) { name = "plaque" });
            if (onTap != null) card.RegisterCallback<ClickEvent>(_ => onTap());
            (into ?? Body).Add(card);
            return Place(card, x, y, 0.5f, 0.5f);
        }

        /// <summary>A flat colour box with its top-left at (x, y).</summary>
        protected VisualElement Box(float x, float y, float width, float height, Color color, VisualElement into = null)
        {
            var box = new VisualElement { pickingMode = PickingMode.Ignore };
            box.style.width = width;
            box.style.height = height;
            box.style.backgroundColor = color;
            (into ?? Body).Add(box);
            return Place(box, x, y);
        }

        /// <summary>A slim value bar centred on (x, y) (DomBar); returns the fill to update with <see cref="SetBar"/>.</summary>
        protected VisualElement Bar(float x, float y, float width, float height, float ratio, Color color, VisualElement into = null)
        {
            var track = new VisualElement { pickingMode = PickingMode.Ignore };
            track.style.width = width;
            track.style.height = height;
            track.style.backgroundColor = new Color(0.027f, 0.016f, 0.039f, 0.85f);
            float r = height / 2f;
            track.style.borderTopLeftRadius = track.style.borderTopRightRadius = track.style.borderBottomLeftRadius = track.style.borderBottomRightRadius = r;
            track.style.borderTopWidth = track.style.borderBottomWidth = track.style.borderLeftWidth = track.style.borderRightWidth = 1.5f;
            var edge = new Color(0.788f, 0.714f, 0.894f, 0.45f);
            track.style.borderTopColor = track.style.borderBottomColor = track.style.borderLeftColor = track.style.borderRightColor = edge;
            track.style.overflow = Overflow.Hidden;
            var fill = new VisualElement { pickingMode = PickingMode.Ignore };
            fill.style.height = Length.Percent(100);
            fill.style.borderTopLeftRadius = fill.style.borderTopRightRadius = fill.style.borderBottomLeftRadius = fill.style.borderBottomRightRadius = r;
            track.Add(fill);
            (into ?? Body).Add(track);
            Place(track, x, y, 0.5f, 0.5f);
            SetBar(fill, ratio, color);
            return fill;
        }

        protected static void SetBar(VisualElement fill, float ratio, Color color)
        {
            fill.style.width = Length.Percent(Mathf.Clamp01(ratio) * 100f);
            fill.style.backgroundColor = color;
        }

        /// <summary>A vertically scrolling area with its top-left at (x, y); add children to the returned content (own coordinates).</summary>
        protected VisualElement Scroll(float x, float y, float width, float height, float contentHeight)
        {
            var view = new ScrollView(ScrollViewMode.Vertical) { horizontalScrollerVisibility = ScrollerVisibility.Hidden };
            view.style.width = width;
            view.style.height = height;
            view.verticalScrollerVisibility = ScrollerVisibility.Auto;
            view.touchScrollBehavior = ScrollView.TouchScrollBehavior.Clamped;
            Body.Add(view);
            Place(view, x, y);
            var content = new VisualElement { pickingMode = PickingMode.Ignore };
            content.style.width = width - 16f;
            content.style.height = contentHeight;
            view.Add(content);
            return content;
        }

        /// <summary>A dimmed layer above the screen that swallows taps; build the modal into it.</summary>
        protected VisualElement OpenModal(float alpha = 0.86f)
        {
            CloseModal();
            var layer = UomdScreenKit.Layer(Band, new Color(0.027f, 0.016f, 0.047f, alpha));
            layer.pickingMode = PickingMode.Position;
            layer.style.left = -2000; // cover the whole screen beyond the band
            layer.style.right = -2000;
            var content = UomdScreenKit.Layer(layer);
            content.style.left = 2000;
            content.style.right = 2000;
            content.pickingMode = PickingMode.Ignore;
            _modal = layer;
            if (!Calm)
            {
                layer.style.opacity = 0f;
                UomdScreenKit.Fade(layer, 1f, 180, 0, false, EasingMode.EaseOutCubic);
            }
            return content;
        }

        protected void CloseModal()
        {
            _modal?.RemoveFromHierarchy();
            _modal = null;
        }
    }
}
