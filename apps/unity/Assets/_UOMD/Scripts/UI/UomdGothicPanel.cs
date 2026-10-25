using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace Uomd.UI
{
    public enum UomdPanelVariant { Normal, Hot, Active, Dim, Danger }

    /// <summary>
    /// The gothic glass plaque of the TypeScript UI kit (apps/game/src/ui/pixiKit.ts panelCanvas) drawn by UI Toolkit:
    /// chamfered octagon with a vertical smoked-glass gradient, an upper sheen band, a radial glow on hot/active, the gold
    /// outer frame and silver inner hairline, active indicator bars and diamond filigree. Gradients are vertex colours
    /// (Painter2D in 6000.0 has no gradient fill); strokes and diamonds use Painter2D. It fills its parent by default.
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
            [UomdPanelVariant.Normal] = new Palette { Top = 0x22132e, Bottom = 0x0d0713, Edge = 0xb8975a, Inner = 0xc9b6e4, EdgeA = 0.76f },
            [UomdPanelVariant.Hot] = new Palette { Top = 0x3e1a44, Bottom = 0x18091f, Edge = 0xe3c37d, Inner = 0xffe8a3, EdgeA = 0.96f },
            [UomdPanelVariant.Active] = new Palette { Top = 0x541b31, Bottom = 0x220915, Edge = 0xffea9f, Inner = 0xe3c37d, EdgeA = 1f },
            [UomdPanelVariant.Dim] = new Palette { Top = 0x16101c, Bottom = 0x09060d, Edge = 0xc9b6e4, Inner = 0xb8975a, EdgeA = 0.26f },
            [UomdPanelVariant.Danger] = new Palette { Top = 0x421020, Bottom = 0x17060c, Edge = 0xd4325c, Inner = 0xb8975a, EdgeA = 0.88f }
        };

        private UomdPanelVariant _variant;

        public UomdGothicPanel(UomdPanelVariant variant = UomdPanelVariant.Normal)
        {
            _variant = variant;
            pickingMode = PickingMode.Ignore;
            style.position = Position.Absolute;
            style.left = style.top = style.right = style.bottom = 0;
            generateVisualContent += Draw;
        }

        public UomdPanelVariant Variant
        {
            get => _variant;
            set
            {
                if (_variant == value) return;
                _variant = value;
                MarkDirtyRepaint();
            }
        }

        private static Color Rgba(int rgb, float a) => new Color(((rgb >> 16) & 0xff) / 255f, ((rgb >> 8) & 0xff) / 255f, (rgb & 0xff) / 255f, a);

        /// <summary>chamferRect of pixiKit.ts: an octagon with 45° cuts, clamped to the box.</summary>
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
            bool isButton = h <= 140f && w >= h * 1.15f;
            float outerCut = isButton ? Mathf.Min(18f, Mathf.Max(8f, Mathf.Floor(h * 0.22f))) : Mathf.Min(24f, Mathf.Max(12f, Mathf.Floor(Mathf.Min(w, h) * 0.055f)));
            float innerInset = isButton ? 6f : 8f;
            float innerCut = Mathf.Max(4f, outerCut - 3f);
            float baseAlpha = _variant switch { UomdPanelVariant.Dim => 0.56f, UomdPanelVariant.Active => 0.92f, UomdPanelVariant.Hot => 0.88f, UomdPanelVariant.Danger => 0.86f, _ => 0.84f };
            float sheenAlpha = _variant switch { UomdPanelVariant.Dim => 0.12f, UomdPanelVariant.Active => 0.38f, UomdPanelVariant.Hot => 0.32f, _ => 0.22f };

            // 1. smoked obsidian-violet glass: top → bottom (52 %) → near black
            var outer = Chamfer(2f, 2f, w - 4f, h - 4f, outerCut);
            Color top = Rgba(p.Top, Mathf.Min(0.98f, baseAlpha + 0.08f)), mid = Rgba(p.Bottom, baseAlpha), bottom = Rgba(0x050209, Mathf.Min(0.99f, baseAlpha + 0.12f));
            FillVertical(context, outer, 2f, h - 2f, t => t < 0.52f ? Color.Lerp(top, mid, t / 0.52f) : Color.Lerp(mid, bottom, (t - 0.52f) / 0.48f));

            // 2. upper glass reflection band
            float sheenH = Mathf.Max(8f, Mathf.Floor((h - innerInset * 2f) * 0.44f));
            var sheen = Chamfer(innerInset, innerInset, w - innerInset * 2f, sheenH, innerCut);
            Color sheenTop = Rgba(0xffffff, sheenAlpha * 0.42f), sheenEnd = Rgba(p.Top, 0f);
            FillVertical(context, sheen, innerInset, innerInset + sheenH, t => Color.Lerp(sheenTop, sheenEnd, t));

            var inner = Chamfer(innerInset, innerInset, w - innerInset * 2f, h - innerInset * 2f, innerCut);
            // 3. inner radial sanctum glow on hot and active
            if (_variant == UomdPanelVariant.Hot || _variant == UomdPanelVariant.Active)
            {
                Color c0 = _variant == UomdPanelVariant.Active ? new Color(1f, 222f / 255f, 130f / 255f, 0.34f) : new Color(227f / 255f, 195f / 255f, 125f / 255f, 0.22f);
                Color c1 = _variant == UomdPanelVariant.Active ? new Color(212f / 255f, 50f / 255f, 92f / 255f, 0.18f) : new Color(180f / 255f, 140f / 255f, 1f, 0.08f);
                FillRadial(context, inner, new Vector2(w / 2f, h / 2f), c0, c1, new Color(212f / 255f, 50f / 255f, 92f / 255f, 0f));
            }

            var painter = context.painter2D;
            painter.lineJoin = LineJoin.Miter;
            // 4. outer antique-gold frame, 5. inset hairline
            Stroke(painter, outer, _variant == UomdPanelVariant.Active ? 2.8f : _variant == UomdPanelVariant.Hot ? 2.4f : 1.9f, Rgba(p.Edge, p.EdgeA));
            Stroke(painter, inner, _variant == UomdPanelVariant.Active ? 1.5f : 1.1f, Rgba(p.Inner, _variant == UomdPanelVariant.Active ? 0.78f : _variant == UomdPanelVariant.Hot ? 0.58f : 0.36f));

            // 6. active indicator bars
            if (_variant == UomdPanelVariant.Active)
            {
                float barW = Mathf.Max(24f, Mathf.Min(w * 0.46f, w - outerCut * 3f));
                var bar = Rgba(0xffea9f, 0.95f);
                Rect(painter, (w - barW) / 2f, 2f, barW, 3f, bar);
                Rect(painter, (w - barW) / 2f, h - 5f, barW, 3f, bar);
            }

            // 7. diamond filigree
            if (isButton)
            {
                float dx = Mathf.Min(20f, Mathf.Max(12f, outerCut + 4f)), r = Mathf.Min(4.8f, Mathf.Max(3f, h * 0.048f));
                var color = Rgba(_variant == UomdPanelVariant.Active ? 0xfff2ba : p.Edge, _variant == UomdPanelVariant.Dim ? 0.35f : 0.88f);
                foreach (float cx in new[] { dx, w - dx })
                {
                    Diamond(painter, cx, h / 2f, r, color);
                    if ((_variant == UomdPanelVariant.Hot || _variant == UomdPanelVariant.Active) && w >= 180f) Diamond(painter, cx + (cx < w / 2f ? 8f : -8f), h / 2f, r * 0.55f, color);
                }
            }
            else
            {
                float c = Mathf.Max(14f, innerInset + 4f);
                var color = Rgba(p.Edge, 0.82f);
                Diamond(painter, c, c, 4.5f, color);
                Diamond(painter, w - c, c, 4.5f, color);
                Diamond(painter, c, h - c, 4.5f, color);
                Diamond(painter, w - c, h - c, 4.5f, color);
                if (w >= 320f && h >= 150f)
                {
                    Diamond(painter, w / 2f, innerInset, 5.5f, color);
                    Diamond(painter, w / 2f, h - innerInset, 5f, color);
                }
            }
        }

        /// <summary>A convex polygon as a triangle fan whose vertex colours follow a vertical gradient between y0 and y1.</summary>
        private static void FillVertical(MeshGenerationContext context, Vector2[] poly, float y0, float y1, Func<float, Color> gradient)
        {
            var centre = Vector2.zero;
            foreach (var v in poly) centre += v;
            centre /= poly.Length;
            float span = Mathf.Max(1f, y1 - y0);
            Color At(Vector2 v) => gradient(Mathf.Clamp01((v.y - y0) / span));
            Fan(context, centre, At(centre), poly, At);
        }

        /// <summary>Radial glow: centre colour → mid ring (65 %) → transparent rim, as two fans.</summary>
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
