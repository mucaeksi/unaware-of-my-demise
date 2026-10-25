#nullable enable
using System;

namespace Uomd.Core.Vfx
{
    /// <summary>
    /// The white procedural VFX sprites of apps/game/src/vfx/textures.ts, drawn with the same canvas calls on VfxCanvas and
    /// tinted per element at draw time. Sizes are the canvas sizes of the TS client, so preset scales match.
    /// </summary>
    public static class VfxTextureArt
    {
        public static VfxCanvas Draw(string name) => name switch
        {
            "spark" => Spark(),
            "star" => Star(),
            "slash" => Slash(),
            "ring" => Ring(),
            "pillar" => Pillar(),
            "shard" => Shard(),
            "bell" => Bell(),
            "chain" => Chain(),
            "seal" => Seal(),
            "droplet" => Droplet(),
            "feather" => Feather(),
            _ => throw new ArgumentException($"unknown VFX texture {name}")
        };

        private static void RadialFill(VfxCanvas ctx, double c, double r, params (double Offset, double Alpha)[] stops)
        {
            var g = new VfxCanvas.Radial(c, c, r);
            foreach (var (o, a) in stops) g.Stop(o, a);
            ctx.FillStyle = g;
            ctx.FillRect(0, 0, c * 2, c * 2);
        }

        private static VfxCanvas Spark()
        {
            var ctx = new VfxCanvas(64, 64);
            RadialFill(ctx, 32, 32, (0, 1), (0.35, 0.65), (1, 0));
            return ctx;
        }

        private static VfxCanvas Star()
        {
            var ctx = new VfxCanvas(96, 96);
            RadialFill(ctx, 48, 44, (0, 1), (0.25, 0.75), (1, 0));
            ctx.FillStyle = new VfxCanvas.Solid(0.95);
            foreach (double rot in new[] { 0, Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4 })
            {
                ctx.Save();
                ctx.Translate(48, 48);
                ctx.Rotate(rot);
                bool axis = rot % (Math.PI / 2) == 0;
                double len = axis ? 46 : 26, thick = axis ? 5.5 : 3;
                ctx.BeginPath();
                ctx.MoveTo(0, -len);
                ctx.QuadraticCurveTo(thick, 0, 0, len);
                ctx.QuadraticCurveTo(-thick, 0, 0, -len);
                ctx.ClosePath();
                ctx.Fill();
                ctx.Restore();
            }
            return ctx;
        }

        private static VfxCanvas Slash()
        {
            var ctx = new VfxCanvas(256, 128);
            var grad = new VfxCanvas.Linear(16, 64, 240, 64);
            grad.Stop(0, 0).Stop(0.2, 0.75).Stop(0.55, 1).Stop(0.85, 0.8).Stop(1, 0);
            ctx.FillStyle = grad;
            ctx.BeginPath();
            ctx.MoveTo(12, 96);
            ctx.QuadraticCurveTo(128, 4, 244, 88);
            ctx.QuadraticCurveTo(132, 46, 12, 96);
            ctx.ClosePath();
            ctx.Fill();
            ctx.FillStyle = new VfxCanvas.Solid(0.98);
            ctx.BeginPath();
            ctx.MoveTo(36, 86);
            ctx.QuadraticCurveTo(128, 18, 224, 80);
            ctx.QuadraticCurveTo(130, 36, 36, 86);
            ctx.ClosePath();
            ctx.Fill();
            return ctx;
        }

        private static VfxCanvas Ring()
        {
            var ctx = new VfxCanvas(256, 256);
            ctx.Translate(128, 128);
            ctx.StrokeStyle = new VfxCanvas.Solid(0.92);
            ctx.LineWidth = 4;
            ctx.BeginPath();
            ctx.Arc(0, 0, 114, 0, Math.PI * 2);
            ctx.Stroke();
            ctx.StrokeStyle = new VfxCanvas.Solid(0.55);
            ctx.LineWidth = 2;
            ctx.BeginPath();
            ctx.Arc(0, 0, 96, 0, Math.PI * 2);
            ctx.Stroke();
            ctx.StrokeStyle = new VfxCanvas.Solid(0.48);
            for (int k = 0; k < 2; k++)
            {
                ctx.Save();
                ctx.Rotate(k * Math.PI / 4);
                ctx.StrokeRect(-68, -68, 136, 136);
                ctx.Restore();
            }
            ctx.FillStyle = new VfxCanvas.Solid(0.85);
            for (int i = 0; i < 16; i++)
            {
                ctx.Save();
                ctx.Rotate(i * Math.PI / 8);
                ctx.FillRect(-2, -112, 4, i % 2 == 0 ? 14 : 8);
                ctx.Restore();
            }
            return ctx;
        }

        private static VfxCanvas Pillar()
        {
            var ctx = new VfxCanvas(128, 512);
            var hg = new VfxCanvas.Linear(0, 0, 128, 0);
            hg.Stop(0, 0).Stop(0.28, 0.55).Stop(0.5, 1).Stop(0.72, 0.55).Stop(1, 0);
            ctx.FillStyle = hg;
            ctx.FillRect(0, 0, 128, 512);
            ctx.Operation = VfxCanvas.Composite.DestinationIn;
            var vg = new VfxCanvas.Linear(0, 0, 0, 512);
            vg.Stop(0, 0).Stop(0.18, 0.9).Stop(0.88, 1).Stop(1, 0);
            ctx.FillStyle = vg;
            ctx.FillRect(0, 0, 128, 512);
            ctx.Operation = VfxCanvas.Composite.SourceOver;
            return ctx;
        }

        private static VfxCanvas Shard()
        {
            var ctx = new VfxCanvas(48, 48);
            ctx.FillStyle = new VfxCanvas.Solid(0.95);
            ctx.BeginPath();
            ctx.MoveTo(24, 2);
            ctx.LineTo(38, 24);
            ctx.LineTo(24, 46);
            ctx.LineTo(10, 24);
            ctx.ClosePath();
            ctx.Fill();
            return ctx;
        }

        private static VfxCanvas Bell()
        {
            var ctx = new VfxCanvas(96, 96);
            RadialFill(ctx, 48, 44, (0, 0.55), (0.55, 0.22), (1, 0));
            ctx.StrokeStyle = new VfxCanvas.Solid(0.95);
            ctx.LineWidth = 3.5;
            ctx.BeginPath();
            ctx.Arc(48, 16, 7, 0, Math.PI * 2);
            ctx.Stroke();
            ctx.FillStyle = new VfxCanvas.Solid(0.92);
            ctx.BeginPath();
            ctx.MoveTo(48, 22);
            ctx.BezierCurveTo(30, 22, 24, 42, 16, 66);
            ctx.LineTo(80, 66);
            ctx.BezierCurveTo(72, 42, 66, 22, 48, 22);
            ctx.ClosePath();
            ctx.Fill();
            // thorn clapper
            ctx.BeginPath();
            ctx.MoveTo(44, 66);
            ctx.LineTo(48, 88);
            ctx.LineTo(52, 66);
            ctx.ClosePath();
            ctx.Fill();
            return ctx;
        }

        private static VfxCanvas Chain()
        {
            var ctx = new VfxCanvas(96, 96);
            ctx.Translate(48, 48);
            ctx.Rotate(-Math.PI / 4);
            ctx.StrokeStyle = new VfxCanvas.Solid(0.95);
            ctx.LineWidth = 6;
            ctx.BeginPath();
            ctx.RoundRect(-34, -13, 42, 26, 12);
            ctx.Stroke();
            ctx.BeginPath();
            ctx.RoundRect(-8, -13, 42, 26, 12);
            ctx.Stroke();
            return ctx;
        }

        private static VfxCanvas Seal()
        {
            var ctx = new VfxCanvas(96, 96);
            RadialFill(ctx, 48, 44, (0, 0.75), (0.6, 0.35), (1, 0));
            ctx.Translate(48, 48);
            ctx.StrokeStyle = new VfxCanvas.Solid(0.95);
            ctx.LineWidth = 3.5;
            ctx.BeginPath();
            for (int i = 0; i < 8; i++)
            {
                double a = i * Math.PI / 4 + Math.PI / 8;
                double x = Math.Cos(a) * 36, y = Math.Sin(a) * 36;
                if (i == 0) ctx.MoveTo(x, y);
                else ctx.LineTo(x, y);
            }
            ctx.ClosePath();
            ctx.Stroke();
            ctx.LineWidth = 2;
            ctx.BeginPath();
            ctx.Arc(0, 0, 22, 0, Math.PI * 2);
            ctx.MoveTo(-16, 0);
            ctx.LineTo(16, 0);
            ctx.MoveTo(0, -16);
            ctx.LineTo(0, 16);
            ctx.Stroke();
            return ctx;
        }

        private static VfxCanvas Droplet()
        {
            var ctx = new VfxCanvas(64, 64);
            RadialFill(ctx, 32, 28, (0, 0.55), (0.65, 0.2), (1, 0));
            ctx.FillStyle = new VfxCanvas.Solid(0.95);
            ctx.BeginPath();
            ctx.MoveTo(32, 6);
            ctx.BezierCurveTo(48, 26, 52, 40, 52, 44);
            ctx.Arc(32, 44, 20, 0, Math.PI, false);
            ctx.BezierCurveTo(12, 40, 16, 26, 32, 6);
            ctx.ClosePath();
            ctx.Fill();
            return ctx;
        }

        private static VfxCanvas Feather()
        {
            var ctx = new VfxCanvas(96, 48);
            ctx.FillStyle = new VfxCanvas.Solid(0.94);
            ctx.BeginPath();
            ctx.MoveTo(8, 24);
            ctx.QuadraticCurveTo(48, 4, 90, 24);
            ctx.QuadraticCurveTo(48, 44, 8, 24);
            ctx.ClosePath();
            ctx.Fill();
            ctx.StrokeStyle = new VfxCanvas.Solid(1);
            ctx.LineWidth = 2.5;
            ctx.BeginPath();
            ctx.MoveTo(4, 24);
            ctx.LineTo(92, 24);
            ctx.Stroke();
            return ctx;
        }
    }
}
