using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace Uomd.UI
{
    public enum UomdPanelVariant { Normal, Hot, Active, Dim, Danger }

    /// <summary>
    /// Layered Dark Gothic Anime UI plaque combining the procedural smoked-glass &amp; radial sanctum glow of pixiKit.ts
    /// with the chroma-keyed RGBA 9-slice Gothic Cathedral frames and 4-state bevel buttons from
    /// narrative/15_Art_Workbench/ui_screens/production_v001/ui_kit/.
    /// </summary>
    public sealed class UomdGothicPanel : VisualElement
    {
        private struct Palette
        {
            public int Top, Bottom, Edge, Inner;
            public float EdgeA;
        }

        private static readonly Dictionary<UomdPanelVariant, Palette> Palettes = new Dictionary<UomdPanelVariant, Palette>
        {
            [UomdPanelVariant.Normal] = new Palette { Top = 0x221432, Bottom = 0x0b0612, Edge = 0xc8a464, Inner = 0xd2c0ec, EdgeA = 0.86f },
            [UomdPanelVariant.Hot] = new Palette { Top = 0x561a38, Bottom = 0x1e0818, Edge = 0xf5d48a, Inner = 0xffefa8, EdgeA = 0.98f },
            [UomdPanelVariant.Active] = new Palette { Top = 0x641f36, Bottom = 0x260916, Edge = 0xfff0b2, Inner = 0xf0d28c, EdgeA = 1f },
            [UomdPanelVariant.Dim] = new Palette { Top = 0x140e1a, Bottom = 0x08050b, Edge = 0x9c8eb2, Inner = 0x8a7550, EdgeA = 0.35f },
            [UomdPanelVariant.Danger] = new Palette { Top = 0x521224, Bottom = 0x1c060e, Edge = 0xe84268, Inner = 0xd4a868, EdgeA = 0.94f }
        };

        private UomdPanelVariant _variant;
        private bool _hovered;
        private bool _pressed;
        private readonly VisualElement _plateTexLayer;
        private readonly VisualElement _frameTexLayer;

        public UomdGothicPanel(UomdPanelVariant variant = UomdPanelVariant.Normal)
        {
            _variant = variant;
            pickingMode = PickingMode.Ignore;
            style.position = Position.Absolute;
            style.left = style.top = style.right = style.bottom = 0;

            _plateTexLayer = new VisualElement { name = "uikit-plate-tex", pickingMode = PickingMode.Ignore };
            _plateTexLayer.style.position = Position.Absolute;
            _plateTexLayer.style.left = _plateTexLayer.style.top = _plateTexLayer.style.right = _plateTexLayer.style.bottom = 4;
            _plateTexLayer.style.backgroundPositionX = new BackgroundPosition(BackgroundPositionKeyword.Center);
            _plateTexLayer.style.backgroundPositionY = new BackgroundPosition(BackgroundPositionKeyword.Center);
            _plateTexLayer.style.backgroundRepeat = new BackgroundRepeat(Repeat.NoRepeat, Repeat.NoRepeat);
            _plateTexLayer.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            Add(_plateTexLayer);

            _frameTexLayer = new VisualElement { name = "uikit-frame-tex", pickingMode = PickingMode.Ignore };
            _frameTexLayer.style.position = Position.Absolute;
            _frameTexLayer.style.left = _frameTexLayer.style.top = _frameTexLayer.style.right = _frameTexLayer.style.bottom = 0;
            _frameTexLayer.style.backgroundPositionX = new BackgroundPosition(BackgroundPositionKeyword.Center);
            _frameTexLayer.style.backgroundPositionY = new BackgroundPosition(BackgroundPositionKeyword.Center);
            _frameTexLayer.style.backgroundRepeat = new BackgroundRepeat(Repeat.NoRepeat, Repeat.NoRepeat);
            _frameTexLayer.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            Add(_frameTexLayer);

            generateVisualContent += Draw;
            RegisterCallback<GeometryChangedEvent>(_ => SyncKitTextures());
        }

        public UomdPanelVariant Variant
        {
            get => _variant;
            set
            {
                if (_variant == value) return;
                _variant = value;
                SyncKitTextures();
                MarkDirtyRepaint();
            }
        }

        public void SetHovered(bool hovered)
        {
            if (_hovered == hovered) return;
            _hovered = hovered;
            SyncKitTextures();
            MarkDirtyRepaint();
        }

        public void SetPressed(bool pressed)
        {
            if (_pressed == pressed) return;
            _pressed = pressed;
            SyncKitTextures();
            MarkDirtyRepaint();
        }

        private void SyncKitTextures()
        {
            float w = contentRect.width, h = contentRect.height;
            if (w < 8f || h < 8f) return;

            bool isButton = h <= 145f && w >= h * 1.12f;
            if (isButton)
            {
                _plateTexLayer.style.display = DisplayStyle.None;

                string btnKey;
                if (_variant == UomdPanelVariant.Dim) btnKey = "uikit_btn_disabled";
                else if (_pressed) btnKey = "uikit_btn_pressed";
                else if (_hovered || _variant == UomdPanelVariant.Hot || _variant == UomdPanelVariant.Active) btnKey = "uikit_btn_hover";
                else btnKey = "uikit_btn_normal";

                var btnTex = UomdGothicVfx.LoadUiTexture(btnKey);
                if (btnTex != null)
                {
                    _frameTexLayer.style.display = DisplayStyle.Flex;
                    _frameTexLayer.style.backgroundImage = new StyleBackground(btnTex);
                    _frameTexLayer.style.unitySliceLeft = 92;
                    _frameTexLayer.style.unitySliceRight = 92;
                    _frameTexLayer.style.unitySliceTop = 52;
                    _frameTexLayer.style.unitySliceBottom = 52;
                    float scale = Mathf.Clamp(h / 185f, 0.28f, 0.72f);
                    _frameTexLayer.style.unitySliceScale = scale;

                    Color tint = _variant switch
                    {
                        UomdPanelVariant.Hot => new Color(1f, 0.88f, 0.82f, 0.94f),
                        UomdPanelVariant.Active => new Color(1f, 0.96f, 0.84f, 0.98f),
                        UomdPanelVariant.Danger => new Color(1f, 0.65f, 0.72f, 0.94f),
                        UomdPanelVariant.Dim => new Color(0.65f, 0.62f, 0.70f, 0.68f),
                        _ => new Color(0.95f, 0.92f, 0.88f, 0.90f)
                    };
                    _frameTexLayer.style.unityBackgroundImageTintColor = tint;
                }
                else
                {
                    _frameTexLayer.style.display = DisplayStyle.None;
                }
            }
            else
            {
                // Large Gothic card, reader box, or modal
                var plateTex = UomdGothicVfx.LoadUiTexture("uikit_panel_plate");
                if (plateTex != null)
                {
                    _plateTexLayer.style.display = DisplayStyle.Flex;
                    _plateTexLayer.style.backgroundImage = new StyleBackground(plateTex);
                    float inset = Mathf.Clamp(Mathf.Min(w, h) * 0.035f, 6f, 18f);
                    _plateTexLayer.style.left = _plateTexLayer.style.right = _plateTexLayer.style.top = _plateTexLayer.style.bottom = inset;
                    Color plateTint = _variant switch
                    {
                        UomdPanelVariant.Hot => new Color(0.92f, 0.68f, 0.76f, 0.42f),
                        UomdPanelVariant.Active => new Color(1f, 0.86f, 0.72f, 0.46f),
                        UomdPanelVariant.Danger => new Color(0.95f, 0.52f, 0.60f, 0.44f),
                        UomdPanelVariant.Dim => new Color(0.55f, 0.50f, 0.62f, 0.25f),
                        _ => new Color(0.82f, 0.76f, 0.90f, 0.38f)
                    };
                    _plateTexLayer.style.unityBackgroundImageTintColor = plateTint;
                }
                else
                {
                    _plateTexLayer.style.display = DisplayStyle.None;
                }

                bool isGrandModal = w >= 1180f && h >= 460f;
                string frameKey = isGrandModal ? "uikit_panel_double" : "uikit_panel_primary";
                int slice = isGrandModal ? 224 : 148;
                var frameTex = UomdGothicVfx.LoadUiTexture(frameKey);
                if (frameTex != null)
                {
                    _frameTexLayer.style.display = DisplayStyle.Flex;
                    _frameTexLayer.style.backgroundImage = new StyleBackground(frameTex);
                    _frameTexLayer.style.unitySliceLeft = slice;
                    _frameTexLayer.style.unitySliceRight = slice;
                    _frameTexLayer.style.unitySliceTop = slice;
                    _frameTexLayer.style.unitySliceBottom = slice;
                    float minDim = Mathf.Min(w, h);
                    float sliceScale = isGrandModal
                        ? Mathf.Clamp(minDim / 1150f, 0.34f, 0.68f)
                        : Mathf.Clamp(minDim / 560f, 0.20f, 0.62f);
                    _frameTexLayer.style.unitySliceScale = sliceScale;

                    Color frameTint = _variant switch
                    {
                        UomdPanelVariant.Hot => new Color(1f, 0.92f, 0.78f, 0.96f),
                        UomdPanelVariant.Active => new Color(1f, 0.96f, 0.84f, 1f),
                        UomdPanelVariant.Danger => new Color(1f, 0.68f, 0.74f, 0.95f),
                        UomdPanelVariant.Dim => new Color(0.68f, 0.64f, 0.74f, 0.52f),
                        _ => new Color(0.96f, 0.92f, 0.86f, 0.92f)
                    };
                    _frameTexLayer.style.unityBackgroundImageTintColor = frameTint;
                }
                else
                {
                    _frameTexLayer.style.display = DisplayStyle.None;
                }
            }
        }

        private static Color Rgba(int rgb, float a) => new Color(((rgb >> 16) & 0xff) / 255f, ((rgb >> 8) & 0xff) / 255f, (rgb & 0xff) / 255f, a);

        private static Vector2[] Chamfer(float x, float y, float w, float h, float cut)
        {
            float c = Mathf.Max(2f, Mathf.Min(cut, Mathf.Min(w * 0.28f, h * 0.34f)));
            return new[]
            {
                new Vector2(x + c, y), new Vector2(x + w - c, y), new Vector2(x + w, y + c), new Vector2(x + w, y + h - c),
                new Vector2(x + w - c, y + h), new Vector2(x + c, y + h), new Vector2(x, y + h - c), new Vector2(x, y + c)
            };
        }

        private void Draw(MeshGenerationContext context)
        {
            float w = contentRect.width, h = contentRect.height;
            if (w < 8f || h < 8f) return;
            var p = Palettes[_variant];
            bool isButton = h <= 145f && w >= h * 1.12f;
            float outerCut = isButton ? Mathf.Min(14f, Mathf.Max(6f, Mathf.Floor(h * 0.16f))) : Mathf.Min(18f, Mathf.Max(8f, Mathf.Floor(Mathf.Min(w, h) * 0.035f)));
            float innerInset = isButton ? 6f : 8f;
            float innerCut = Mathf.Max(4f, outerCut - 3f);
            float baseAlpha = _variant switch { UomdPanelVariant.Dim => 0.68f, UomdPanelVariant.Active => 0.96f, UomdPanelVariant.Hot => 0.94f, UomdPanelVariant.Danger => 0.92f, _ => 0.90f };
            float sheenAlpha = _variant switch { UomdPanelVariant.Dim => 0.12f, UomdPanelVariant.Active => 0.42f, UomdPanelVariant.Hot => 0.36f, _ => 0.24f };

            // 0. outer obsidian drop-shadow silhouette
            var shadowPoly = Chamfer(0f, 2f, w, h - 2f, outerCut + 1.5f);
            Color shadowCol = Rgba(0x020105, _variant == UomdPanelVariant.Dim ? 0.40f : 0.74f);
            FillVertical(context, shadowPoly, 0f, h, _ => shadowCol);

            // 1. smoked obsidian-violet glass core
            var outer = Chamfer(3f, 3f, w - 6f, h - 6f, outerCut);
            Color top = Rgba(p.Top, Mathf.Min(0.98f, baseAlpha + 0.06f)), mid = Rgba(p.Bottom, baseAlpha), bottom = Rgba(0x050209, Mathf.Min(0.99f, baseAlpha + 0.10f));
            FillVertical(context, outer, 3f, h - 3f, t => t < 0.52f ? Color.Lerp(top, mid, t / 0.52f) : Color.Lerp(mid, bottom, (t - 0.52f) / 0.48f));

            // 2. upper glass reflection band
            float sheenH = Mathf.Max(8f, Mathf.Floor((h - innerInset * 2f) * 0.42f));
            var sheen = Chamfer(innerInset, innerInset, w - innerInset * 2f, sheenH, innerCut);
            Color sheenTop = Rgba(0xffffff, sheenAlpha * 0.38f), sheenEnd = Rgba(p.Top, 0f);
            FillVertical(context, sheen, innerInset, innerInset + sheenH, t => Color.Lerp(sheenTop, sheenEnd, t));

            var inner = Chamfer(innerInset, innerInset, w - innerInset * 2f, h - innerInset * 2f, innerCut);
            // 3. inner radial sanctum glow on hot, active, or hovered buttons
            if (_variant == UomdPanelVariant.Hot || _variant == UomdPanelVariant.Active || _hovered)
            {
                Color c0 = _variant == UomdPanelVariant.Active
                    ? new Color(1f, 0.88f, 0.52f, 0.36f)
                    : _variant == UomdPanelVariant.Hot
                        ? new Color(0.88f, 0.24f, 0.42f, 0.32f)
                        : new Color(0.89f, 0.76f, 0.49f, 0.20f);
                Color c1 = _variant == UomdPanelVariant.Active
                    ? new Color(0.83f, 0.20f, 0.36f, 0.18f)
                    : new Color(0.70f, 0.55f, 1f, 0.10f);
                FillRadial(context, inner, new Vector2(w / 2f, h / 2f), c0, c1, new Color(0.83f, 0.20f, 0.36f, 0f));
            }

            var painter = context.painter2D;
            painter.lineJoin = LineJoin.Miter;
            Stroke(painter, outer, _variant == UomdPanelVariant.Active ? 2.4f : _variant == UomdPanelVariant.Hot ? 2.2f : 1.6f, Rgba(p.Edge, p.EdgeA * 0.78f));
            Stroke(painter, inner, _variant == UomdPanelVariant.Active ? 1.4f : 1.0f, Rgba(p.Inner, _variant == UomdPanelVariant.Active ? 0.72f : _variant == UomdPanelVariant.Hot ? 0.55f : 0.32f));

            // 4. active indicator bars & diamond filigree
            if (_variant == UomdPanelVariant.Active || (_variant == UomdPanelVariant.Hot && isButton))
            {
                float barW = Mathf.Max(28f, Mathf.Min(w * 0.44f, w - outerCut * 3f));
                var bar = Rgba(_variant == UomdPanelVariant.Active ? 0xffea9f : 0xf2c97d, 0.92f);
                Rect(painter, (w - barW) / 2f, 3f, barW, 2.5f, bar);
                Rect(painter, (w - barW) / 2f, h - 5.5f, barW, 2.5f, bar);
            }

            if (isButton)
            {
                float dx = Mathf.Min(22f, Mathf.Max(14f, outerCut + 5f)), r = Mathf.Min(4.5f, Mathf.Max(3f, h * 0.046f));
                var color = Rgba(_variant == UomdPanelVariant.Active ? 0xfff2ba : p.Edge, _variant == UomdPanelVariant.Dim ? 0.32f : 0.86f);
                foreach (float cx in new[] { dx, w - dx })
                {
                    Diamond(painter, cx, h / 2f, r, color);
                }
            }
        }

        private static void FillVertical(MeshGenerationContext context, Vector2[] poly, float y0, float y1, Func<float, Color> gradient)
        {
            var centre = Vector2.zero;
            foreach (var v in poly) centre += v;
            centre /= poly.Length;
            float span = Mathf.Max(1f, y1 - y0);
            Color At(Vector2 v) => gradient(Mathf.Clamp01((v.y - y0) / span));
            Fan(context, centre, At(centre), poly, At);
        }

        private static void FillRadial(MeshGenerationContext context, Vector2[] poly, Vector2 centre, Color c0, Color c1, Color c2)
        {
            var ring = new Vector2[poly.Length];
            for (int i = 0; i < poly.Length; i++) ring[i] = centre + (poly[i] - centre) * 0.65f;
            Fan(context, centre, c0, ring, _ => c1);
            int n = poly.Length;
            var mesh = context.Allocate(n * 2, n * 6);
            for (int i = 0; i < n; i++)
            {
                mesh.SetNextVertex(new Vertex { position = new Vector3(ring[i].x, ring[i].y, Vertex.nearZ), tint = c1 });
                mesh.SetNextVertex(new Vertex { position = new Vector3(poly[i].x, poly[i].y, Vertex.nearZ), tint = c2 });
            }
            for (int i = 0; i < n; i++)
            {
                ushort a = (ushort)(i * 2), b = (ushort)(i * 2 + 1), c = (ushort)((i + 1) % n * 2), d = (ushort)((i + 1) % n * 2 + 1);
                mesh.SetNextIndex(a); mesh.SetNextIndex(b); mesh.SetNextIndex(d);
                mesh.SetNextIndex(a); mesh.SetNextIndex(d); mesh.SetNextIndex(c);
            }
        }

        private static void Fan(MeshGenerationContext context, Vector2 centre, Color centreColor, Vector2[] poly, Func<Vector2, Color> color)
        {
            int n = poly.Length;
            var mesh = context.Allocate(n + 1, n * 3);
            mesh.SetNextVertex(new Vertex { position = new Vector3(centre.x, centre.y, Vertex.nearZ), tint = centreColor });
            foreach (var v in poly) mesh.SetNextVertex(new Vertex { position = new Vector3(v.x, v.y, Vertex.nearZ), tint = color(v) });
            for (int i = 0; i < n; i++)
            {
                mesh.SetNextIndex(0);
                mesh.SetNextIndex((ushort)(i + 1));
                mesh.SetNextIndex((ushort)((i + 1) % n + 1));
            }
        }

        private static void Stroke(Painter2D painter, Vector2[] poly, float width, Color color)
        {
            painter.BeginPath();
            painter.MoveTo(poly[0]);
            for (int i = 1; i < poly.Length; i++) painter.LineTo(poly[i]);
            painter.ClosePath();
            painter.lineWidth = width;
            painter.strokeColor = color;
            painter.Stroke();
        }

        private static void Rect(Painter2D painter, float x, float y, float w, float h, Color color)
        {
            painter.BeginPath();
            painter.MoveTo(new Vector2(x, y));
            painter.LineTo(new Vector2(x + w, y));
            painter.LineTo(new Vector2(x + w, y + h));
            painter.LineTo(new Vector2(x, y + h));
            painter.ClosePath();
            painter.fillColor = color;
            painter.Fill();
        }

        private static void Diamond(Painter2D painter, float cx, float cy, float r, Color color)
        {
            painter.BeginPath();
            painter.MoveTo(new Vector2(cx, cy - r));
            painter.LineTo(new Vector2(cx + r, cy));
            painter.LineTo(new Vector2(cx, cy + r));
            painter.LineTo(new Vector2(cx - r, cy));
            painter.ClosePath();
            painter.fillColor = color;
            painter.Fill();
        }
    }
}
