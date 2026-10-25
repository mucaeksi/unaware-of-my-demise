using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core.Vfx;

namespace Uomd.Scenes
{
    /// <summary>
    /// The ten VFX vector shapes of apps/game/src/vfx/VfxStage.ts shape(), drawn with Painter2D around the element's centre
    /// (same geometry, colours and alphas as the PIXI Graphics calls). The element is centred on its parent's origin so the
    /// parent's translate/scale/rotate behave like the PIXI node transform.
    /// </summary>
    public sealed class VfxShapeElement : VisualElement
    {
        private const uint Void = 0x090512;
        private readonly VfxElement _el;
        private readonly Color _tint, _tint2, _secondary;
        private readonly float _r;
        private readonly float _half;

        public VfxShapeElement(VfxElement el, Color tint, Color tint2, Color secondary)
        {
            _el = el;
            _tint = tint;
            _tint2 = tint2;
            _secondary = secondary;
            _r = (float)el.Size;
            // generous bounds: corona spokes reach 1.18 r, crescent bows and bars rise further
            _half = _r * 1.3f + (float)Math.Abs(el.Bow) + (float)el.Thickness + 40f;
            pickingMode = PickingMode.Ignore;
            style.position = Position.Absolute;
            style.width = _half * 2f;
            style.height = _half * 2f;
            style.left = -_half;
            style.top = -_half;
            generateVisualContent += Draw;
        }

        private Vector2 V(double x, double y) => new Vector2(_half + (float)x, _half + (float)y);
        private static Color A(Color c, double alpha) => new Color(c.r, c.g, c.b, (float)alpha);

        private void Poly(Painter2D p, IReadOnlyList<Vector2> pts, Color fill)
        {
            p.BeginPath();
            p.MoveTo(pts[0]);
            for (int i = 1; i < pts.Count; i++) p.LineTo(pts[i]);
            p.ClosePath();
            p.fillColor = fill;
            p.Fill();
        }

        private void Circle(Painter2D p, double r, Color? fill, double strokeWidth = 0, Color? stroke = null)
        {
            p.BeginPath();
            p.Arc(V(0, 0), (float)r, 0f, 360f);
            p.ClosePath();
            if (fill.HasValue)
            {
                p.fillColor = fill.Value;
                p.Fill();
            }
            if (stroke.HasValue && strokeWidth > 0)
            {
                p.lineWidth = (float)strokeWidth;
                p.strokeColor = stroke.Value;
                p.Stroke();
            }
        }

        private static void StrokeWith(Painter2D p, double width, Color color)
        {
            if (width <= 0) return;
            p.lineWidth = (float)width;
            p.strokeColor = color;
            p.Stroke();
        }

        private void Draw(MeshGenerationContext context)
        {
            var p = context.painter2D;
            p.lineJoin = LineJoin.Round;
            double r = _r, t = _el.Thickness;
            int count = _el.Count;
            switch (_el.Shape)
            {
                case "crescent":
                {
                    // two filled crescents (outer colour + bright core) bowed toward the attack direction; dir comes from scale
                    int steps = Math.Max(4, count);
                    void Band(double span, double edge, double bowOuter, double bowInner, Color color)
                    {
                        double Curve(double bow, double u) => edge * (1 - u) * (1 - u) + 2 * (1 - u) * u * bow + edge * u * u;
                        var pts = new List<Vector2>();
                        for (int s = 0; s <= steps; s++) pts.Add(V(-span + (double)s / steps * span * 2, Curve(bowOuter, (double)s / steps)));
                        for (int s = steps; s >= 0; s--) pts.Add(V(-span + (double)s / steps * span * 2, Curve(bowInner, (double)s / steps)));
                        Poly(p, pts, color);
                    }
                    Band(r, 24, _el.Bow, _el.Bow * 0.42, A(_tint, _el.FillAlpha));
                    Band(r * 0.84, 18, _el.Bow * 0.82, _el.Bow * 0.52, A(_tint2, 0.98));
                    break;
                }
                case "star_flare":
                {
                    Circle(p, t, A(_tint, 0.85));
                    for (int i = 0; i < 4; i++)
                    {
                        double a = i * Math.PI / 2, len = i % 2 == 0 ? r : r * 0.78;
                        Poly(p, new[]
                        {
                            V(Math.Cos(a) * len, Math.Sin(a) * len), V(Math.Cos(a + Math.PI / 2) * 10, Math.Sin(a + Math.PI / 2) * 10),
                            V(-Math.Cos(a) * len, -Math.Sin(a) * len), V(Math.Cos(a - Math.PI / 2) * 10, Math.Sin(a - Math.PI / 2) * 10)
                        }, A(_tint2, 0.98));
                    }
                    break;
                }
                case "spikes":
                {
                    for (int i = 0; i < count; i++)
                    {
                        double a = i * Math.PI * 2 / count + (i % 2 == 0 ? 0.12 : -0.08), r0 = 22;
                        // dense crit bursts alternate long and short spikes
                        double r1 = count >= 12 && i % 2 == 1 ? r * 0.65 : r;
                        Poly(p, new[]
                        {
                            V(Math.Cos(a) * r0, Math.Sin(a) * r0), V(Math.Cos(a - 0.07) * (r0 + 28), Math.Sin(a - 0.07) * (r0 + 28)),
                            V(Math.Cos(a) * r1, Math.Sin(a) * r1), V(Math.Cos(a + 0.07) * (r0 + 28), Math.Sin(a + 0.07) * (r0 + 28))
                        }, A(i % 2 == 0 ? _tint : _tint2, 0.95));
                    }
                    break;
                }
                case "crest":
                {
                    Circle(p, r * 0.737, null, t + 2, A(_tint2, 0.95));
                    p.BeginPath();
                    for (int k = 0; k < count; k++)
                    {
                        double a = k * Math.PI * 2 / count;
                        p.MoveTo(V(Math.Cos(a) * r * 0.342, Math.Sin(a) * r * 0.342));
                        p.LineTo(V(Math.Cos(a) * r, Math.Sin(a) * r));
                    }
                    StrokeWith(p, t, A(_tint, 0.88));
                    break;
                }
                case "rings":
                    Circle(p, r, null, t, A(_tint, 0.95));
                    Circle(p, r * 0.722, null, Math.Max(1, t * 0.6), A(_tint2, 0.85));
                    break;
                case "bars":
                {
                    // vertical energy column rising from the anchor: widest/softest first, brightest core last
                    for (int i = 0; i < count; i++)
                    {
                        double w = t * (1 - (double)i / count * 0.75);
                        var color = i == 0 ? _tint : i == count - 1 ? _tint2 : _secondary;
                        Poly(p, new[] { V(-w / 2, -r), V(w / 2, -r), V(w / 2, 0), V(-w / 2, 0) }, A(color, 0.55 + 0.4 * i / Math.Max(1, count - 1)));
                    }
                    break;
                }
                case "bell_arch":
                {
                    // Gothic ogive sanctuary arch + inner tracery + suspended clapper lance
                    double w = r * 0.72, h = r;
                    p.BeginPath();
                    p.MoveTo(V(-w, h * 0.45));
                    p.LineTo(V(-w, -h * 0.15));
                    p.QuadraticCurveTo(V(-w * 0.85, -h * 0.78), V(0, -h));
                    p.QuadraticCurveTo(V(w * 0.85, -h * 0.78), V(w, -h * 0.15));
                    p.LineTo(V(w, h * 0.45));
                    p.ClosePath();
                    p.fillColor = A(_tint, _el.FillAlpha * 0.28);
                    p.Fill();
                    StrokeWith(p, t, A(_tint2, 0.95));
                    double iw = w * 0.76, ih = h * 0.82;
                    p.BeginPath();
                    p.MoveTo(V(-iw, h * 0.38));
                    p.LineTo(V(-iw, -ih * 0.12));
                    p.QuadraticCurveTo(V(-iw * 0.8, -ih * 0.76), V(0, -ih));
                    p.QuadraticCurveTo(V(iw * 0.8, -ih * 0.76), V(iw, -ih * 0.12));
                    p.LineTo(V(iw, h * 0.38));
                    StrokeWith(p, Math.Max(1.5, t * 0.6), A(_tint, 0.85));
                    p.BeginPath();
                    p.Arc(V(0, -h * 0.52), (float)(r * 0.18), 0f, 360f);
                    StrokeWith(p, Math.Max(1.5, t * 0.6), A(_tint2, 0.92));
                    p.BeginPath();
                    p.MoveTo(V(0, -h * 0.7));
                    p.LineTo(V(0, h * 0.32));
                    StrokeWith(p, Math.Max(2, t * 0.75), A(_tint2, 0.95));
                    break;
                }
                case "shield_wall":
                {
                    // faceted heater/kite bastion shield with broken-crown top notch and chevron ribs
                    double w = r * 0.82, h = r;
                    var outline = new[]
                    {
                        V(-w, -h * 0.62), V(-w * 0.32, -h * 0.76), V(0, -h * 0.58), V(w * 0.32, -h * 0.76),
                        V(w, -h * 0.62), V(w * 0.88, h * 0.12), V(0, h * 0.88), V(-w * 0.88, h * 0.12)
                    };
                    Poly(p, outline, A(_tint, _el.FillAlpha * 0.34));
                    StrokeWith(p, t + 1, A(_tint2, 0.96));
                    int ribs = Math.Max(1, Math.Min(6, count));
                    p.BeginPath();
                    for (int i = 0; i < ribs; i++)
                    {
                        double y = -h * 0.32 + i * h * 0.72 / Math.Max(1, ribs), span = w * (0.72 - i * 0.08);
                        p.MoveTo(V(-span, y - 14));
                        p.LineTo(V(0, y + 14));
                        p.LineTo(V(span, y - 14));
                    }
                    StrokeWith(p, Math.Max(1.5, t * 0.65), A(_tint, 0.88));
                    break;
                }
                case "eclipse_corona":
                {
                    // dark void core ringed by blazing corona spokes and twin lunar rims
                    int spokes = Math.Max(6, count);
                    for (int i = 0; i < spokes; i++)
                    {
                        double a = i * Math.PI * 2 / spokes, rOuter = i % 2 == 0 ? r * 1.18 : r * 0.92, rInner = r * 0.56;
                        Poly(p, new[] { V(Math.Cos(a - 0.09) * rInner, Math.Sin(a - 0.09) * rInner), V(Math.Cos(a) * rOuter, Math.Sin(a) * rOuter), V(Math.Cos(a + 0.09) * rInner, Math.Sin(a + 0.09) * rInner) },
                            A(i % 2 == 0 ? _tint2 : _tint, 0.92));
                    }
                    Circle(p, r * 0.58, UomdVfxPlayer.ToColor((int)Void, (float)_el.FillAlpha));
                    Circle(p, r * 0.6, null, t + 1.5, A(_tint2, 0.98));
                    Circle(p, r * 0.74, null, Math.Max(1.5, t * 0.6), A(_tint, 0.82));
                    break;
                }
                case "crosshair":
                {
                    // tactical marksman reticle with diamond sight and radial tick blades
                    Circle(p, r, null, t, A(_tint, 0.92));
                    Circle(p, r * 0.58, null, Math.Max(1.5, t * 0.65), A(_tint2, 0.88));
                    double d = r * 0.34;
                    p.BeginPath();
                    p.MoveTo(V(0, -d));
                    p.LineTo(V(d, 0));
                    p.LineTo(V(0, d));
                    p.LineTo(V(-d, 0));
                    p.ClosePath();
                    StrokeWith(p, Math.Max(1.5, t * 0.65), A(_tint2, 0.95));
                    int ticks = Math.Max(4, count);
                    p.BeginPath();
                    for (int i = 0; i < ticks; i++)
                    {
                        double a = i * Math.PI * 2 / ticks, r0 = i % 2 == 0 ? r * 0.42 : r * 0.72, r1 = i % 2 == 0 ? r * 1.16 : r * 1.04;
                        p.MoveTo(V(Math.Cos(a) * r0, Math.Sin(a) * r0));
                        p.LineTo(V(Math.Cos(a) * r1, Math.Sin(a) * r1));
                    }
                    StrokeWith(p, t, A(_tint2, 0.94));
                    break;
                }
            }
        }
    }
}
