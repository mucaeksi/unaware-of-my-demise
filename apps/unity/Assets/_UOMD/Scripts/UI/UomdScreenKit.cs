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
        public static Button MenuButton(VisualElement parent, string label, string sub, float width, float height, float fontSize, bool hot, System.Action onClick)
        {
            var button = new Button(onClick) { text = "" };
            button.AddToClassList("uomd-btn");
            if (hot) button.AddToClassList("uomd-btn-primary");
            button.style.width = width;
            button.style.height = height;
            button.style.flexDirection = FlexDirection.Column;
            button.style.justifyContent = Justify.Center;
            button.style.alignItems = Align.Center;
            var main = new Label(label) { pickingMode = PickingMode.Ignore };
            main.AddToClassList("uomd-display");
            main.style.fontSize = fontSize;
            main.style.unityTextAlign = TextAnchor.MiddleCenter;
            button.Add(main);
            if (!string.IsNullOrEmpty(sub))
            {
                var second = new Label(sub) { pickingMode = PickingMode.Ignore };
                second.AddToClassList("uomd-serif"); // body face; the button's Cinzel is capitals only
                second.style.fontSize = Mathf.Round(fontSize * 0.72f);
                second.style.color = UomdThemeTokens.TextDim;
                second.style.unityFontStyleAndWeight = FontStyle.Italic;
                second.style.unityTextAlign = TextAnchor.MiddleCenter;
                button.Add(second);
            }
            parent.Add(button);
            return button;
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
            if (texture != null) image.style.backgroundImage = new StyleBackground(texture);
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
