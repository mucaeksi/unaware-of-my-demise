using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;

namespace Uomd.UI
{
    /// <summary>
    /// Building blocks for the ported screens. Coordinates are the TypeScript client's 1920×1080 reference space
    /// (REF_W × REF_H); PanelSettings scales by height, so y and sizes match and x is measured from the horizontal centre.
    /// Motion uses USS transitions; with reduced motion every animation completes immediately.
    /// </summary>
    public static class UomdScreenKit
    {
        public const float RefWidth = 1920f;
        public const float RefHeight = 1080f;

        /// <summary>Full-screen layer that does not take part in flex layout.</summary>
        public static VisualElement Layer(VisualElement parent, Color? background = null)
        {
            var layer = new VisualElement { pickingMode = PickingMode.Ignore };
            layer.style.position = Position.Absolute;
            layer.style.left = layer.style.right = layer.style.top = layer.style.bottom = 0;
            if (background.HasValue) layer.style.backgroundColor = background.Value;
            parent.Add(layer);
            return layer;
        }

        /// <summary>Places an element so its centre sits at (x from screen centre, y from top) in reference units.</summary>
        public static T Centered<T>(T element, float offsetX, float y) where T : VisualElement
        {
            element.style.position = Position.Absolute;
            element.style.left = new Length(50, LengthUnit.Percent);
            element.style.top = y;
            element.style.translate = new Translate(new Length(-50, LengthUnit.Percent), new Length(-50, LengthUnit.Percent));
            element.style.marginLeft = offsetX;
            return element;
        }

        /// <summary>Centre at x reference units from the left edge (TypeScript `500 + insets.left` placements).</summary>
        public static T AtLeft<T>(T element, float x, float y) where T : VisualElement
        {
            element.style.position = Position.Absolute;
            element.style.left = x;
            element.style.top = y;
            element.style.translate = new Translate(new Length(-50, LengthUnit.Percent), new Length(-50, LengthUnit.Percent));
            return element;
        }

        /// <summary>Centre at x reference units from the right edge (TypeScript `REF_W - x - insets.right`).</summary>
        public static T AtRight<T>(T element, float x, float y) where T : VisualElement
        {
            element.style.position = Position.Absolute;
            element.style.right = x;
            element.style.top = y;
            element.style.translate = new Translate(new Length(50, LengthUnit.Percent), new Length(-50, LengthUnit.Percent));
            return element;
        }

        /// <summary>Centre at y reference units above the bottom edge.</summary>
        public static T FromBottom<T>(T element, float offsetX, float yFromBottom) where T : VisualElement
        {
            Centered(element, offsetX, 0);
            element.style.top = StyleKeyword.Auto;
            element.style.bottom = yFromBottom;
            element.style.translate = new Translate(new Length(-50, LengthUnit.Percent), new Length(50, LengthUnit.Percent));
            return element;
        }

        /// <summary>Vertical gradient band (UI Toolkit has no gradient fill, so it stacks thin strips).</summary>
        public static VisualElement VerticalShade(VisualElement parent, float top, float height, Color color, float alphaTop, float alphaBottom, bool fromBottom = false)
        {
            const int strips = 16;
            var band = new VisualElement { pickingMode = PickingMode.Ignore };
            band.style.position = Position.Absolute;
            band.style.left = band.style.right = 0;
            if (fromBottom) band.style.bottom = top; else band.style.top = top;
            band.style.height = height;
            for (int i = 0; i < strips; i++)
            {
                float t = (i + 0.5f) / strips;
                var strip = new VisualElement { pickingMode = PickingMode.Ignore };
                strip.style.flexGrow = 1;
                strip.style.backgroundColor = new Color(color.r, color.g, color.b, Mathf.Lerp(alphaTop, alphaBottom, t));
                band.Add(strip);
            }
            parent.Add(band);
            return band;
        }

        /// <summary>A menu button with an optional second line (TypeScript DomStage.button label + sub).</summary>
        public static Button MenuButton(VisualElement parent, string label, string sub, float width, float height, float fontSize, bool hot, System.Action onClick, string iconResource = null) =>
            MenuButton(parent, label, sub, width, height, fontSize, hot ? UomdPanelVariant.Hot : UomdPanelVariant.Normal, onClick, iconResource);

        /// <summary>
        /// The TS kit button (domKit.ts DomButton): a gothic plaque of the given variant with a Cinzel label and an optional
        /// body-face sub line, labels shrunk to fit the plaque, a press squash. Update it with <see cref="SetVariant"/>,
        /// <see cref="SetLabel"/>, <see cref="SetSub"/> and <see cref="SetEnabled"/>.
        /// </summary>
        public static Button MenuButton(VisualElement parent, string label, string sub, float width, float height, float fontSize, UomdPanelVariant variant, System.Action onClick, string iconResource = null)
        {
            var button = new Button(onClick) { text = "" };
            button.AddToClassList("uomd-kit-btn");
            button.style.width = width;
            button.style.height = height;
            button.style.flexDirection = FlexDirection.Column;
            button.style.justifyContent = Justify.Center;
            button.style.alignItems = Align.Center;
            button.style.backgroundColor = Color.clear;
            button.style.borderTopWidth = button.style.borderBottomWidth = button.style.borderLeftWidth = button.style.borderRightWidth = 0;
            button.style.paddingLeft = button.style.paddingRight = button.style.paddingTop = button.style.paddingBottom = 0;
            button.style.marginLeft = button.style.marginRight = button.style.marginTop = button.style.marginBottom = 0;
            button.style.overflow = Overflow.Visible;
            var plaque = new UomdGothicPanel(variant) { name = "plaque" };
            button.Add(plaque);

            var topRow = new VisualElement { name = "top-row", pickingMode = PickingMode.Ignore };
            topRow.style.flexDirection = FlexDirection.Row;
            topRow.style.alignItems = Align.Center;
            topRow.style.justifyContent = Justify.Center;
            button.Add(topRow);

            if (!string.IsNullOrEmpty(iconResource))
            {
                bool fullCol = UomdGothicVfx.IsFullColorIcon(iconResource);
                float iconSz = Mathf.Clamp(Mathf.Round(fontSize * (fullCol ? 1.28f : 0.96f)), 20f, 42f);
                var icon = UomdGothicVfx.CreateTintedSprite(iconResource, iconSz, iconSz, fullCol ? Color.white : UomdThemeTokens.GoldHi);
                icon.name = "icon";
                icon.userData = fullCol ? "full" : "mono";
                icon.style.marginRight = 10f;
                topRow.Add(icon);
            }

            var main = new Label(label) { name = "label", pickingMode = PickingMode.Ignore };
            main.AddToClassList("uomd-display");
            main.style.fontSize = fontSize;
            main.style.unityFontStyleAndWeight = FontStyle.Bold;
            main.style.unityTextAlign = TextAnchor.MiddleCenter;
            main.style.unityTextOutlineWidth = 0.7f;
            main.style.unityTextOutlineColor = new Color(0.027f, 0.016f, 0.047f);
            main.style.whiteSpace = WhiteSpace.NoWrap;
            topRow.Add(main);

            var second = new Label(sub ?? "") { name = "sub", pickingMode = PickingMode.Ignore };
            second.AddToClassList("uomd-serif"); // body face; the button's Cinzel is capitals only
            second.style.fontSize = Mathf.Max(15f, Mathf.Round(fontSize * 0.66f));
            second.style.unityTextAlign = TextAnchor.MiddleCenter;
            second.style.whiteSpace = WhiteSpace.NoWrap;
            second.style.marginTop = 2f;
            second.style.display = string.IsNullOrEmpty(sub) ? DisplayStyle.None : DisplayStyle.Flex;
            button.Add(second);
            ApplyVariantColors(button, variant);
            // labels never overflow the plaque (domKit fitLabels: max width = plaque width - 48)
            float maxW = width - (string.IsNullOrEmpty(iconResource) ? 48f : 82f);
            void Fit(Label l)
            {
                float w = l.resolvedStyle.width;
                float k = w > maxW && w > 0f ? maxW / w : 1f;
                l.style.scale = new Scale(new Vector3(k, k, 1f));
            }
            main.RegisterCallback<GeometryChangedEvent>(_ => Fit(main));
            second.RegisterCallback<GeometryChangedEvent>(_ => Fit(second));
            button.RegisterCallback<ClickEvent>(e => e.StopPropagation());
            button.RegisterCallback<PointerEnterEvent>(_ => { if (button.enabledSelf) plaque.SetHovered(true); });
            button.RegisterCallback<PointerDownEvent>(_ => { if (button.enabledSelf) { plaque.SetPressed(true); button.style.scale = new Scale(new Vector3(0.955f, 0.955f, 1f)); } }, TrickleDown.TrickleDown);
            button.RegisterCallback<PointerUpEvent>(_ => { plaque.SetPressed(false); button.style.scale = new Scale(Vector3.one); }, TrickleDown.TrickleDown);
            button.RegisterCallback<PointerLeaveEvent>(_ => { plaque.SetHovered(false); plaque.SetPressed(false); button.style.scale = new Scale(Vector3.one); });
            parent.Add(button);
            return button;
        }

        private static void ApplyVariantColors(Button button, UomdPanelVariant variant)
        {
            bool lit = variant == UomdPanelVariant.Active || variant == UomdPanelVariant.Hot;
            float labelAlpha = variant == UomdPanelVariant.Dim ? 0.45f : 1f;
            if (button.Q<Label>("label") is Label main)
            {
                main.style.color = lit ? new Color(1f, 0.953f, 0.769f) : new Color(0.965f, 0.937f, 0.894f);
                main.style.opacity = labelAlpha;
            }
            if (button.Q<Label>("sub") is Label sub)
            {
                sub.style.color = variant == UomdPanelVariant.Active ? new Color(1f, 0.851f, 0.541f) : new Color(0.839f, 0.784f, 0.902f);
                sub.style.opacity = labelAlpha;
            }
            if (button.Q<VisualElement>("icon") is VisualElement icon)
            {
                bool isFull = (icon.userData as string) == "full";
                icon.style.unityBackgroundImageTintColor = isFull ? Color.white : (lit ? new Color(1f, 0.953f, 0.769f) : UomdThemeTokens.GoldHi);
                icon.style.opacity = labelAlpha;
            }
        }

        public static void SetVariant(Button button, UomdPanelVariant variant)
        {
            if (button.Q<UomdGothicPanel>("plaque") is UomdGothicPanel plaque) plaque.Variant = variant;
            ApplyVariantColors(button, variant);
        }

        public static void SetLabel(Button button, string text)
        {
            if (button.Q<Label>("label") is Label l) l.text = text;
        }

        public static void SetSub(Button button, string text)
        {
            if (!(button.Q<Label>("sub") is Label l)) return;
            l.text = text ?? "";
            l.style.display = string.IsNullOrEmpty(text) ? DisplayStyle.None : DisplayStyle.Flex;
        }

        /// <summary>The TS default art scrim: dark on the label side, clearing towards the art's focal right edge.</summary>
        public static readonly (float, Color)[] ArtScrim =
        {
            (0f, new Color(0.031f, 0.020f, 0.055f, 0.92f)), (0.52f, new Color(0.031f, 0.020f, 0.055f, 0.78f)),
            (0.82f, new Color(0.031f, 0.020f, 0.055f, 0.22f)), (1f, new Color(0.031f, 0.020f, 0.055f, 0.52f))
        };

        /// <summary>
        /// Key art inside a plaque (domKit setArtBackdrop): inset 7 px, rounded, cover-fitted to the right edge, under a
        /// horizontal scrim so the labels stay readable. Calling it again swaps the image.
        /// </summary>
        public static void SetArtBackdrop(VisualElement host, UomdMediaLoader media, string contentPath, (float, Color)[] scrim = null)
        {
            host.Q<VisualElement>("panel-art")?.RemoveFromHierarchy();
            if (media == null || string.IsNullOrEmpty(contentPath)) return;
            var wrap = new VisualElement { name = "panel-art", pickingMode = PickingMode.Ignore };
            wrap.style.position = Position.Absolute;
            wrap.style.left = wrap.style.right = wrap.style.top = wrap.style.bottom = 7;
            wrap.style.borderTopLeftRadius = wrap.style.borderTopRightRadius = wrap.style.borderBottomLeftRadius = wrap.style.borderBottomRightRadius = 10;
            wrap.style.overflow = Overflow.Hidden;
            wrap.style.borderTopWidth = wrap.style.borderBottomWidth = wrap.style.borderLeftWidth = wrap.style.borderRightWidth = 1;
            var edge = new Color(0.890f, 0.765f, 0.490f, 0.28f);
            wrap.style.borderTopColor = wrap.style.borderBottomColor = wrap.style.borderLeftColor = wrap.style.borderRightColor = edge;
            var image = Backdrop(wrap, media, contentPath);
            image.style.backgroundPositionX = new BackgroundPosition(BackgroundPositionKeyword.Right);
            wrap.Add(new UomdGradient(true, scrim ?? ArtScrim));
            int plaque = host.IndexOf(host.Q<UomdGothicPanel>("plaque"));
            host.Insert(plaque + 1, wrap);
        }

        /// <summary>Enables or disables a kit button; a disabled one shows the dim plaque.</summary>
        public static void SetEnabled(Button button, bool on, UomdPanelVariant variant = UomdPanelVariant.Normal)
        {
            button.SetEnabled(on);
            SetVariant(button, on ? variant : UomdPanelVariant.Dim);
        }

        /// <summary>Slow opacity pulse between 1 and <paramref name="low"/> (the TypeScript `uomd-blink` class).</summary>
        public static void Pulse(VisualElement element, float low, int periodMs, bool reducedMotion)
        {
            if (reducedMotion) return;
            bool dim = false;
            element.schedule.Execute(() =>
            {
                dim = !dim;
                Fade(element, dim ? low : 1f, periodMs / 2);
            }).Every(periodMs / 2).StartingIn(periodMs / 2);
        }

        public static Label Text(VisualElement parent, string text, float size, Color color, float letterSpacing = 0f, bool bold = false, bool italic = false)
        {
            var label = new Label(text) { pickingMode = PickingMode.Ignore };
            label.style.fontSize = size;
            label.style.color = color;
            label.style.letterSpacing = letterSpacing;
            label.style.unityTextAlign = TextAnchor.MiddleCenter;
            label.style.whiteSpace = WhiteSpace.NoWrap;
            label.style.unityFontStyleAndWeight = bold && italic ? FontStyle.BoldAndItalic : bold ? FontStyle.Bold : italic ? FontStyle.Italic : FontStyle.Normal;
            parent.Add(label);
            return label;
        }

        /// <summary>
        /// An element whose background is the content image at <paramref name="contentPath"/>; it fills its box with
        /// <paramref name="scale"/>. The image appears when loaded; a missing file leaves the element empty.
        /// </summary>
        public static VisualElement Image(VisualElement parent, UomdMediaLoader media, string contentPath, float width, float height, ScaleMode scale = ScaleMode.ScaleToFit)
        {
            var image = new VisualElement { pickingMode = PickingMode.Ignore };
            image.style.width = width;
            image.style.height = height;
            image.style.backgroundPositionX = new BackgroundPosition(BackgroundPositionKeyword.Center);
            image.style.backgroundPositionY = new BackgroundPosition(BackgroundPositionKeyword.Center);
            image.style.backgroundRepeat = new BackgroundRepeat(Repeat.NoRepeat, Repeat.NoRepeat);
            image.style.backgroundSize = scale switch
            {
                ScaleMode.ScaleAndCrop => new BackgroundSize(BackgroundSizeType.Cover),
                ScaleMode.StretchToFill => new BackgroundSize(Length.Percent(100), Length.Percent(100)),
                _ => new BackgroundSize(BackgroundSizeType.Contain)
            };
            parent.Add(image);
            if (media != null && !string.IsNullOrEmpty(contentPath)) _ = Assign(image, media, contentPath);
            return image;
        }

        /// <summary>Full-bleed cover image (backgrounds, key art, stills).</summary>
        public static VisualElement Backdrop(VisualElement parent, UomdMediaLoader media, string contentPath)
        {
            var image = Image(parent, media, contentPath, 0, 0, ScaleMode.ScaleAndCrop);
            image.style.position = Position.Absolute;
            image.style.width = StyleKeyword.Auto;
            image.style.height = StyleKeyword.Auto;
            image.style.left = image.style.right = image.style.top = image.style.bottom = 0;
            return image;
        }

        private static async Awaitable Assign(VisualElement image, UomdMediaLoader media, string contentPath)
        {
            var texture = await media.TextureAsync(contentPath);
            if (texture != null && image?.panel != null) image.style.backgroundImage = new StyleBackground(texture);
        }

        /// <summary>Animates opacity to <paramref name="to"/> after <paramref name="delayMs"/>.</summary>
        public static void Fade(VisualElement element, float to, int durationMs, int delayMs = 0, bool reducedMotion = false, EasingMode easing = EasingMode.EaseInOutSine)
        {
            Animate(element, "opacity", durationMs, delayMs, reducedMotion, easing, () => element.style.opacity = to);
        }

        /// <summary>Animates the translate offset (reference units) after <paramref name="delayMs"/>; keeps any centring percent.</summary>
        public static void Move(VisualElement element, float dx, float dy, int durationMs, int delayMs = 0, bool reducedMotion = false, EasingMode easing = EasingMode.EaseOutCubic)
        {
            Animate(element, "margin-top", durationMs, delayMs, reducedMotion, easing, () => element.style.marginTop = dy);
            if (dx != 0f) Animate(element, "margin-left", durationMs, delayMs, reducedMotion, easing, () => element.style.marginLeft = dx);
        }

        /// <summary>Animates the uniform scale (transform origin: centre) after <paramref name="delayMs"/>.</summary>
        public static void ScaleTo(VisualElement element, float scale, int durationMs, int delayMs = 0, bool reducedMotion = false, EasingMode easing = EasingMode.EaseInOutSine)
        {
            Animate(element, "scale", durationMs, delayMs, reducedMotion, easing, () => element.style.scale = new Scale(new Vector3(scale, scale, 1f)));
        }

        /// <summary>Runs <paramref name="action"/> after <paramref name="delayMs"/> while <paramref name="owner"/> is on screen.</summary>
        public static void After(VisualElement owner, int delayMs, System.Action action)
        {
            owner.schedule.Execute(action).StartingIn(delayMs);
        }

        private static void Animate(VisualElement element, string property, int durationMs, int delayMs, bool reducedMotion, EasingMode easing, System.Action apply)
        {
            if (reducedMotion || durationMs <= 0)
            {
                if (delayMs <= 0 || reducedMotion) apply();
                else After(element, delayMs, apply);
                return;
            }
            var properties = new List<StylePropertyName>(element.style.transitionProperty.value ?? new List<StylePropertyName>());
            var durations = new List<TimeValue>(element.style.transitionDuration.value ?? new List<TimeValue>());
            var easings = new List<EasingFunction>(element.style.transitionTimingFunction.value ?? new List<EasingFunction>());
            int index = properties.FindIndex(p => p == new StylePropertyName(property));
            if (index < 0)
            {
                properties.Add(new StylePropertyName(property));
                durations.Add(new TimeValue(durationMs, TimeUnit.Millisecond));
                easings.Add(new EasingFunction(easing));
            }
            else
            {
                while (durations.Count <= index) durations.Add(new TimeValue(durationMs, TimeUnit.Millisecond));
                while (easings.Count <= index) easings.Add(new EasingFunction(easing));
                durations[index] = new TimeValue(durationMs, TimeUnit.Millisecond);
                easings[index] = new EasingFunction(easing);
            }
            element.style.transitionProperty = properties;
            element.style.transitionDuration = durations;
            element.style.transitionTimingFunction = easings;
            // A transition starts only when the value changes after the element has been laid out once.
            After(element, Mathf.Max(16, delayMs), apply);
        }
    }
}
