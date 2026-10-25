#nullable enable
using System;
using System.Collections.Generic;

namespace Uomd.Core.Vfx
{
    /// <summary>
    /// A minimal alpha-only software canvas with the subset of the HTML canvas 2D API that apps/game/src/vfx/textures.ts uses:
    /// paths (lines, quadratic/cubic curves, arcs, rounded rects), translate/rotate/save/restore, fill (non-zero winding) and
    /// stroke, solid/linear/radial alpha paints, source-over and destination-in. Coverage is 4×4 supersampled. Row 0 is the
    /// top, as on a canvas. Engine-free so the textures are tested headlessly; Unity uploads the result once.
    /// </summary>
    public sealed class VfxCanvas
    {
        private const int Samples = 4;
        private const double CurveStep = 1.5;

        public enum Composite { SourceOver, DestinationIn }

        public abstract class Paint
        {
            public abstract double AlphaAt(double x, double y);
        }

        public sealed class Solid : Paint
        {
            private readonly double _alpha;
            public Solid(double alpha) => _alpha = alpha;
            public override double AlphaAt(double x, double y) => _alpha;
        }

        public abstract class Gradient : Paint
        {
            private readonly List<(double Offset, double Alpha)> _stops = new List<(double, double)>();

            public Gradient Stop(double offset, double alpha)
            {
                _stops.Add((offset, alpha));
                _stops.Sort((a, b) => a.Offset.CompareTo(b.Offset));
                return this;
            }

            protected double At(double t)
            {
                if (_stops.Count == 0) return 0;
                if (t <= _stops[0].Offset) return _stops[0].Alpha;
                for (int i = 1; i < _stops.Count; i++)
                {
                    if (t <= _stops[i].Offset)
                    {
                        var a = _stops[i - 1];
                        var b = _stops[i];
                        double span = b.Offset - a.Offset;
                        return span <= 0 ? b.Alpha : a.Alpha + (b.Alpha - a.Alpha) * (t - a.Offset) / span;
                    }
                }
                return _stops[_stops.Count - 1].Alpha;
            }
        }

        public sealed class Radial : Gradient
        {
            private readonly double _cx, _cy, _r;
            public Radial(double cx, double cy, double r) { _cx = cx; _cy = cy; _r = r; }
            public override double AlphaAt(double x, double y)
            {
                double dx = x - _cx, dy = y - _cy;
                return At(Math.Sqrt(dx * dx + dy * dy) / _r);
            }
        }

        public sealed class Linear : Gradient
        {
            private readonly double _x0, _y0, _dx, _dy, _len2;
            public Linear(double x0, double y0, double x1, double y1)
            {
                _x0 = x0; _y0 = y0; _dx = x1 - x0; _dy = y1 - y0; _len2 = _dx * _dx + _dy * _dy;
            }
            public override double AlphaAt(double x, double y) => At(_len2 <= 0 ? 0 : ((x - _x0) * _dx + (y - _y0) * _dy) / _len2);
        }

        private readonly struct Matrix
        {
            public Matrix(double a, double b, double c, double d, double e, double f) { A = a; B = b; C = c; D = d; E = e; F = f; }
            public double A { get; }
            public double B { get; }
            public double C { get; }
            public double D { get; }
            public double E { get; }
            public double F { get; }
            public static readonly Matrix Identity = new Matrix(1, 0, 0, 1, 0, 0);
            public (double X, double Y) Apply(double x, double y) => (A * x + C * y + E, B * x + D * y + F);
            public Matrix Then(Matrix m) => new Matrix(A * m.A + C * m.B, B * m.A + D * m.B, A * m.C + C * m.D, B * m.C + D * m.D, A * m.E + C * m.F + E, B * m.E + D * m.F + F);
            public (double X, double Y) Inverse(double x, double y)
            {
                double det = A * D - B * C;
                double ix = x - E, iy = y - F;
                return ((D * ix - C * iy) / det, (-B * ix + A * iy) / det);
            }
        }

        private readonly float[] _alpha;
        private readonly Stack<Matrix> _saved = new Stack<Matrix>();
        private readonly List<List<(double X, double Y)>> _path = new List<List<(double, double)>>();
        private List<(double X, double Y)>? _current;
        private (double X, double Y) _cursor;
        private Matrix _m = Matrix.Identity;
        private bool _reopen;

        public VfxCanvas(int width, int height)
        {
            Width = width;
            Height = height;
            _alpha = new float[width * height];
        }

        public int Width { get; }
        public int Height { get; }
        public Paint FillStyle { get; set; } = new Solid(1);
        public Paint StrokeStyle { get; set; } = new Solid(1);
        public double LineWidth { get; set; } = 1;
        public Composite Operation { get; set; } = Composite.SourceOver;

        /// <summary>Alpha at a pixel (row 0 = top).</summary>
        public float AlphaAt(int x, int y) => _alpha[y * Width + x];
        public float[] Pixels => _alpha;

        public void Save() => _saved.Push(_m);
        public void Restore() { if (_saved.Count > 0) _m = _saved.Pop(); }
        public void Translate(double x, double y) => _m = _m.Then(new Matrix(1, 0, 0, 1, x, y));
        public void Rotate(double angle) => _m = _m.Then(new Matrix(Math.Cos(angle), Math.Sin(angle), -Math.Sin(angle), Math.Cos(angle), 0, 0));

        public void BeginPath()
        {
            _path.Clear();
            _current = null;
            _reopen = false;
        }

        public void MoveTo(double x, double y)
        {
            _reopen = false;
            _current = new List<(double, double)> { _m.Apply(x, y) };
            _path.Add(_current);
            _cursor = (x, y);
        }

        public void LineTo(double x, double y)
        {
            if (_current == null && _reopen) MoveTo(_cursor.X, _cursor.Y);
            if (_current == null) { MoveTo(x, y); return; }
            _current.Add(_m.Apply(x, y));
            _cursor = (x, y);
        }

        public void QuadraticCurveTo(double cx, double cy, double x, double y)
        {
            var p0 = _cursor;
            int steps = CurveSteps(Dist(p0.X, p0.Y, cx, cy) + Dist(cx, cy, x, y));
            for (int i = 1; i <= steps; i++)
            {
                double t = (double)i / steps, u = 1 - t;
                LineTo(u * u * p0.X + 2 * u * t * cx + t * t * x, u * u * p0.Y + 2 * u * t * cy + t * t * y);
            }
        }

        public void BezierCurveTo(double c1x, double c1y, double c2x, double c2y, double x, double y)
        {
            var p0 = _cursor;
            int steps = CurveSteps(Dist(p0.X, p0.Y, c1x, c1y) + Dist(c1x, c1y, c2x, c2y) + Dist(c2x, c2y, x, y));
            for (int i = 1; i <= steps; i++)
            {
                double t = (double)i / steps, u = 1 - t;
                LineTo(u * u * u * p0.X + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x,
                    u * u * u * p0.Y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y);
            }
        }

        /// <summary>canvas arc(): a line from the current point to the arc start, then the arc (clockwise unless ccw).</summary>
        public void Arc(double cx, double cy, double r, double a0, double a1, bool ccw = false)
        {
            double sweep = a1 - a0;
            if (!ccw && sweep < 0) sweep = sweep % (2 * Math.PI) + 2 * Math.PI;
            if (ccw && sweep > 0) sweep = sweep % (2 * Math.PI) - 2 * Math.PI;
            if (Math.Abs(a1 - a0) >= 2 * Math.PI) sweep = ccw ? -2 * Math.PI : 2 * Math.PI;
            int steps = CurveSteps(Math.Abs(sweep) * r);
            double sx = cx + Math.Cos(a0) * r, sy = cy + Math.Sin(a0) * r;
            if (_current == null) MoveTo(sx, sy); else LineTo(sx, sy);
            for (int i = 1; i <= steps; i++)
            {
                double a = a0 + sweep * i / steps;
                LineTo(cx + Math.Cos(a) * r, cy + Math.Sin(a) * r);
            }
        }

        /// <summary>Closes the subpath; a following lineTo starts a new subpath at the closed subpath's first point.</summary>
        public void ClosePath()
        {
            if (_current == null || _current.Count == 0) return;
            var first = _current[0];
            _current.Add(first);
            _current = null;
            _cursor = _m.Inverse(first.X, first.Y);
            _reopen = true;
        }

        public void Rect(double x, double y, double w, double h)
        {
            MoveTo(x, y);
            LineTo(x + w, y);
            LineTo(x + w, y + h);
            LineTo(x, y + h);
            ClosePath();
        }

        public void RoundRect(double x, double y, double w, double h, double r)
        {
            r = Math.Min(r, Math.Min(w, h) / 2);
            MoveTo(x + r, y);
            LineTo(x + w - r, y);
            Arc(x + w - r, y + r, r, -Math.PI / 2, 0);
            LineTo(x + w, y + h - r);
            Arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
            LineTo(x + r, y + h);
            Arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
            LineTo(x, y + r);
            Arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
            ClosePath();
        }

        public void FillRect(double x, double y, double w, double h)
        {
            var saved = new List<List<(double, double)>>(_path);
            var current = _current;
            BeginPath();
            Rect(x, y, w, h);
            Fill();
            _path.Clear();
            _path.AddRange(saved);
            _current = current;
        }

        public void StrokeRect(double x, double y, double w, double h)
        {
            var saved = new List<List<(double, double)>>(_path);
            var current = _current;
            BeginPath();
            Rect(x, y, w, h);
            Stroke();
            _path.Clear();
            _path.AddRange(saved);
            _current = current;
        }

        public void Fill() => Rasterize(_path, FillStyle);

        /// <summary>Strokes every subpath with butt caps and round joins (the shapes here are thin, so joins hardly show).</summary>
        public void Stroke()
        {
            double half = LineWidth / 2;
            var pieces = new List<List<(double, double)>>();
            foreach (var sub in _path)
            {
                for (int i = 1; i < sub.Count; i++)
                {
                    var a = sub[i - 1];
                    var b = sub[i];
                    double dx = b.X - a.X, dy = b.Y - a.Y, len = Math.Sqrt(dx * dx + dy * dy);
                    if (len < 1e-9) continue;
                    double nx = -dy / len * half, ny = dx / len * half;
                    pieces.Add(Oriented(new List<(double, double)> { (a.X + nx, a.Y + ny), (b.X + nx, b.Y + ny), (b.X - nx, b.Y - ny), (a.X - nx, a.Y - ny), (a.X + nx, a.Y + ny) }));
                    if (i < sub.Count - 1 || (sub.Count > 2 && Same(sub[0], sub[sub.Count - 1]))) pieces.Add(Circle(b.X, b.Y, half));
                }
            }
            Rasterize(pieces, StrokeStyle);
        }

        private static bool Same((double X, double Y) a, (double X, double Y) b) => Math.Abs(a.X - b.X) < 1e-6 && Math.Abs(a.Y - b.Y) < 1e-6;

        private static List<(double, double)> Oriented(List<(double X, double Y)> poly)
        {
            double area = 0;
            for (int i = 1; i < poly.Count; i++) area += poly[i - 1].X * poly[i].Y - poly[i].X * poly[i - 1].Y;
            if (area < 0) poly.Reverse();
            var result = new List<(double, double)>(poly.Count);
            foreach (var p in poly) result.Add((p.X, p.Y));
            return result;
        }

        private static List<(double, double)> Circle(double cx, double cy, double r)
        {
            int steps = Math.Max(8, (int)Math.Ceiling(r * 2));
            var pts = new List<(double, double)>(steps + 1);
            for (int i = 0; i <= steps; i++)
            {
                double a = 2 * Math.PI * i / steps;
                pts.Add((cx + Math.Cos(a) * r, cy + Math.Sin(a) * r));
            }
            return Oriented(pts);
        }

        private static double Dist(double ax, double ay, double bx, double by) => Math.Sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by));
        private static int CurveSteps(double length) => Math.Max(4, Math.Min(256, (int)Math.Ceiling(length / CurveStep)));

        /// <summary>Non-zero winding scanline fill of the subpaths (implicitly closed) with the paint and composite mode.</summary>
        private void Rasterize(List<List<(double X, double Y)>> subpaths, Paint paint)
        {
            var edges = new List<(double X0, double Y0, double X1, double Y1, int Dir)>();
            double minY = double.MaxValue, maxY = double.MinValue;
            foreach (var sub in subpaths)
            {
                if (sub.Count < 2) continue;
                for (int i = 0; i < sub.Count; i++)
                {
                    var a = sub[i];
                    var b = sub[(i + 1) % sub.Count];
                    if (a.Y == b.Y) continue;
                    edges.Add(a.Y < b.Y ? (a.X, a.Y, b.X, b.Y, 1) : (b.X, b.Y, a.X, a.Y, -1));
                    minY = Math.Min(minY, Math.Min(a.Y, b.Y));
                    maxY = Math.Max(maxY, Math.Max(a.Y, b.Y));
                }
            }
            var coverage = new float[Width * Height];
            if (edges.Count > 0)
            {
                int rowFrom = Math.Max(0, (int)Math.Floor(minY * Samples)), rowTo = Math.Min(Height * Samples - 1, (int)Math.Ceiling(maxY * Samples));
                var crossings = new List<(double X, int Dir)>();
                const float weight = 1f / (Samples * Samples);
                for (int row = rowFrom; row <= rowTo; row++)
                {
                    double sy = (row + 0.5) / Samples;
                    crossings.Clear();
                    foreach (var e in edges)
                    {
                        if (sy < e.Y0 || sy >= e.Y1) continue;
                        crossings.Add((e.X0 + (sy - e.Y0) * (e.X1 - e.X0) / (e.Y1 - e.Y0), e.Dir));
                    }
                    if (crossings.Count < 2) continue;
                    crossings.Sort((a, b) => a.X.CompareTo(b.X));
                    int winding = 0, py = row / Samples;
                    for (int i = 0; i < crossings.Count - 1; i++)
                    {
                        winding += crossings[i].Dir;
                        if (winding == 0) continue;
                        double xa = crossings[i].X, xb = crossings[i + 1].X;
                        int colFrom = Math.Max(0, (int)Math.Ceiling(xa * Samples - 0.5)), colTo = Math.Min(Width * Samples - 1, (int)Math.Ceiling(xb * Samples - 0.5) - 1);
                        for (int col = colFrom; col <= colTo; col++) coverage[py * Width + col / Samples] += weight;
                    }
                }
            }
            for (int y = 0; y < Height; y++)
            {
                for (int x = 0; x < Width; x++)
                {
                    int i = y * Width + x;
                    float c = Math.Min(1f, coverage[i]);
                    if (Operation == Composite.DestinationIn)
                    {
                        var u = _m.Inverse(x + 0.5, y + 0.5);
                        _alpha[i] *= c * (float)Clamp01(paint.AlphaAt(u.X, u.Y));
                        continue;
                    }
                    if (c <= 0) continue;
                    var p = _m.Inverse(x + 0.5, y + 0.5);
                    float src = c * (float)Clamp01(paint.AlphaAt(p.X, p.Y));
                    _alpha[i] = src + _alpha[i] * (1 - src);
                }
            }
        }

        private static double Clamp01(double v) => v < 0 ? 0 : v > 1 ? 1 : v;
    }
}
