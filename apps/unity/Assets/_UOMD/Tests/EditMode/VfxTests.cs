#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
using Uomd.Core;
using Uomd.Core.Vfx;

namespace Uomd.Tests.EditMode
{
    /// <summary>
    /// C# mirror of apps/game/src/vfx/VfxStage.test.ts over content/base/vfx/vfx_presets.json, plus the pack reader and the
    /// procedural textures (apps/game/src/vfx/textures.ts).
    /// </summary>
    public sealed class VfxTests
    {
        private static string RepoRoot => Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", ".."));
        private static VfxPack? _pack;
        private static VfxPack Pack => _pack ??= VfxPack.Parse(File.ReadAllText(Path.Combine(RepoRoot, "content/base/vfx/vfx_presets.json")));

        private static VfxEnvironment Env(bool particles = true, bool reducedMotion = false, bool reduceFlash = false) =>
            new VfxEnvironment { Particles = particles, ParticleDensity = 1, ReducedMotion = reducedMotion, ReduceFlash = reduceFlash };

        private static VfxPlayback Play(string id, VfxPlayOptions? o = null, VfxEnvironment? env = null) =>
            VfxTimeline.Compile(Pack, id, o ?? new VfxPlayOptions(), env ?? Env(), new System.Random(7));

        /// <summary>Nodes on stage after the host advanced `t` ms (created once their start passed, gone at their end).</summary>
        private static int Alive(VfxPlayback p, double t, string? layer = null) =>
            p.Nodes.Count(n => n.StartMs <= t && n.EndMs > t && (layer == null || n.Layer == layer));

        [Test]
        public void ReadsTheWholeContentPack()
        {
            Assert.AreEqual(115, Pack.Presets.Count);
            Assert.AreEqual(133, Pack.Skills.Count);
            foreach (var skill in Pack.Skills) Assert.IsTrue(Pack.Has(skill.Value), skill.Key);
            Assert.AreEqual(0xb98eff, Pack.PaletteFor("Veil").Primary);
            Assert.AreEqual(Pack.PaletteFor("Veil").Core, Pack.PaletteFor("Unknown").Core, "unknown elements use Veil");
        }

        [Test]
        public void CompilesAPresetOntoTheRightLayersAndCleansUp()
        {
            var p = Play("cast_sigil", new VfxPlayOptions { X = 100, Y = 200, Element = "Ember" });
            Assert.AreEqual(2, Alive(p, 32, "ground"));
            Assert.AreEqual(14, Alive(p, 32, "fx"));
            Assert.LessOrEqual(p.LastNodeMs, 1232, "everything is gone after the TS test's 1.2 s");
            Assert.AreEqual(0, Alive(p, 1232));
            var ember = Pack.PaletteFor("Ember");
            Assert.IsTrue(p.Nodes.Any(n => n.Color == ember.Primary), "palette slots resolve against the action's element");
        }

        [Test]
        public void MirrorsDirectionalPresetsAndLandsProjectiles()
        {
            var slash = Play("slash_single", new VfxPlayOptions { Dir = -1 });
            var crescent = slash.Nodes.First(n => n.Layer == "fx" && n.StartMs <= 16);
            Assert.Less(crescent.Evaluate(16).ScaleX, 0);
            var shot = Play("projectile", new VfxPlayOptions { TargetX = 400, TargetY = 0 });
            Assert.IsNotNull(shot.LandingMs);
            Assert.Greater(shot.CompletionMs, 160);
            Assert.LessOrEqual(shot.CompletionMs, 260);
            var orb = shot.Nodes.First(n => !n.IsParticle);
            Assert.AreEqual(400, orb.Evaluate(shot.LandingMs!.Value).X, 1e-6, "the orb lands on the target");
            Assert.Less(orb.Evaluate(shot.LandingMs.Value / 2).Y, 0, "it travels on an arc above the line");
        }

        [Test]
        public void PlaysNothingForReducedMotionAndNoFlashOrParticlesWhenOff()
        {
            var quiet = Play("hit_crit", env: Env(reducedMotion: true));
            Assert.AreEqual(0, quiet.Nodes.Count);
            Assert.AreEqual(0, quiet.CompletionMs);
            var lowTier = Play("hit_impact", env: Env(particles: false));
            Assert.AreEqual(1, Alive(lowTier, 16, "fx"), "the ring shape, no sparks or shards");
            var noFlash = Play("hit_crit", env: Env(reduceFlash: true));
            Assert.AreEqual(0, noFlash.Nodes.Count);
        }

        [Test]
        public void HonoursSkillOverridesAndStretchesTimingWithPace()
        {
            string skill = Pack.Skills.Keys.First();
            Assert.AreEqual(Pack.Skills[skill], Pack.PresetForSkill(skill));
            Assert.IsNull(Pack.PresetForSkill("unknown"));
            var paced = Play("iron_bulwark_wave", new VfxPlayOptions { Pace = 2 });
            Assert.AreEqual(1, Alive(paced, 480, "fx"), "authored 460 ms, paced to 920");
            Assert.AreEqual(0, Alive(paced, 980, "fx"));
        }

        [Test]
        public void CompilesSignaturePresetsWithShapesProjectilesAndCues()
        {
            Assert.IsTrue(Pack.Presets["kera_flask_flick"].HasProjectile);
            Assert.IsFalse(Pack.Presets["fadyme_bell_that_forgets"].HasProjectile);
            var bell = Play("fadyme_bell_that_forgets", new VfxPlayOptions { X = 320, Y = 240, TargetX = 640, TargetY = 240, Element = "Veil" });
            CollectionAssert.IsSupersetOf(bell.Cues.Select(c => c.Cue).ToList(), new[] { "hit_stop", "shake", "flash" });
            Assert.LessOrEqual(bell.LastNodeMs, 950);
            var eclipse = Play("boss_construct_eclipse_pulse", new VfxPlayOptions { X = 640, Y = 240, Element = "Veil" });
            Assert.LessOrEqual(eclipse.LastNodeMs, 1100);
            var shapes = Pack.Presets.Values.SelectMany(p => p.Elements).Where(e => e.Kind == VfxKind.Shape).Select(e => e.Shape).Distinct().ToList();
            CollectionAssert.IsSubsetOf(shapes, VfxPack.Shapes);
        }

        [Test]
        public void EveryPresetCompilesWithinItsBudgets()
        {
            foreach (var id in Pack.Presets.Keys)
            {
                var p = Play(id, new VfxPlayOptions { X = 900, Y = 500, TargetX = 1300, TargetY = 520, Element = "Tide" });
                Assert.Greater(p.Nodes.Count + p.Cues.Count, 0, id);
                Assert.LessOrEqual(p.LastNodeMs, 6000, id);
                foreach (var n in p.Nodes)
                {
                    var mid = n.Evaluate((n.StartMs + n.EndMs) / 2);
                    Assert.IsFalse(double.IsNaN(mid.X) || double.IsNaN(mid.Alpha), id);
                    Assert.That(mid.Alpha, Is.InRange(-1e-9, 1 + 1e-9), id);
                }
            }
        }

        [Test]
        public void TweenedNodesFadeOnTheirOwnCurve()
        {
            // the fade starts from the `from` alpha and reaches zero exactly at its end
            var preset = Pack.Presets.First(kv => kv.Value.Elements.Any(e => e.Kind == VfxKind.Shape && e.Fade != null));
            var p = Play(preset.Key);
            var element = preset.Value.Elements.First(e => e.Kind == VfxKind.Shape && e.Fade != null);
            var node = p.Nodes.First(n => n.Shape == element);
            Assert.AreEqual(0, node.Evaluate(node.EndMs).Alpha, 1e-9);
            Assert.AreEqual(element.DelayMs + element.Fade!.DelayMs + element.Fade.DurationMs, node.EndMs, 1e-9);
        }

        [Test]
        public void BurstParticleCountFollowsDensityWithAFloor()
        {
            var burst = Pack.Presets.SelectMany(kv => kv.Value.Elements.Select(e => (kv.Key, e))).First(x => x.e.Kind == VfxKind.Burst && x.e.Count >= 10);
            int Count(double density) => VfxTimeline.Compile(Pack, burst.Key, new VfxPlayOptions(), new VfxEnvironment { ParticleDensity = density }, new System.Random(1))
                .Nodes.Count(n => n.IsParticle && n.Texture == burst.e.Texture && n.StartMs == burst.e.DelayMs);
            Assert.GreaterOrEqual(Count(1), burst.e.Count);
            Assert.Less(Count(0.25), Count(1));
            Assert.GreaterOrEqual(Count(0.01), 4, "at least four particles (or the authored count when smaller)");
        }

        [Test]
        public void ReaderRejectsWhatTheSchemaRejects()
        {
            string good = "{\"schema_version\":1,\"presets\":{\"p_one\":{\"elements\":[{\"kind\":\"cue\",\"cue\":\"shake\",\"duration_ms\":100}]}}}";
            Assert.DoesNotThrow(() => VfxPack.Parse(good));
            Assert.AreEqual(0.5, VfxPack.Parse(good).Presets["p_one"].Elements[0].Intensity, "defaults are applied");
            foreach (string bad in new[]
            {
                good.Replace("\"cue\":\"shake\"", "\"cue\":\"boom\""),
                good.Replace("\"duration_ms\":100", "\"duration_ms\":100,\"extra\":1"),
                good.Replace("\"schema_version\":1", "\"schema_version\":2"),
                good.Replace("\"p_one\"", "\"P-One\""),
                "{\"schema_version\":1,\"presets\":{\"p\":{\"elements\":[{\"kind\":\"sprite\",\"texture\":\"spark\",\"tint\":\"#12345\",\"duration_ms\":10}]}}}",
                "{\"schema_version\":1,\"presets\":{\"pp\":{\"elements\":[{\"kind\":\"projectile\",\"texture\":\"spark\",\"duration_ms\":100},{\"kind\":\"projectile\",\"texture\":\"spark\",\"duration_ms\":100}]}}}",
                "{\"schema_version\":1,\"presets\":{\"pp\":{\"elements\":[{\"kind\":\"cue\",\"cue\":\"shake\",\"duration_ms\":100}]}},\"skills\":{\"strike\":\"missing\"}}"
            })
            {
                Assert.Throws<VfxFormatException>(() => VfxPack.Parse(bad), bad);
            }
        }

        [Test]
        public void EasesMatchTheReferenceCurves()
        {
            foreach (string ease in VfxPack.Eases)
            {
                Assert.AreEqual(0, VfxEase.Apply(ease, 0), 1e-12, ease);
                Assert.AreEqual(1, VfxEase.Apply(ease, 1), 1e-12, ease);
            }
            Assert.AreEqual(0.25, VfxEase.Apply("quad.in", 0.5), 1e-12);
            Assert.AreEqual(0.875, VfxEase.Apply("cubic.out", 0.5), 1e-12);
            Assert.AreEqual(0.5, VfxEase.Apply("sine.inout", 0.5), 1e-12);
            Assert.Greater(VfxEase.Apply("back.out", 0.7), 1, "back.out overshoots");
        }

        [Test]
        public void ProceduralTexturesMatchTheCanvasArt()
        {
            var sizes = new Dictionary<string, (int W, int H)>
            {
                ["spark"] = (64, 64), ["star"] = (96, 96), ["slash"] = (256, 128), ["ring"] = (256, 256), ["pillar"] = (128, 512), ["shard"] = (48, 48),
                ["bell"] = (96, 96), ["chain"] = (96, 96), ["seal"] = (96, 96), ["droplet"] = (64, 64), ["feather"] = (96, 48)
            };
            CollectionAssert.AreEquivalent(VfxPack.Textures, sizes.Keys);
            foreach (var kv in sizes)
            {
                var canvas = VfxTextureArt.Draw(kv.Key);
                Assert.AreEqual(kv.Value, (canvas.Width, canvas.Height), kv.Key);
                Assert.Greater(canvas.Pixels.Max(), 0.5f, kv.Key);
                Assert.IsTrue(canvas.Pixels.All(a => a >= 0 && a <= 1), kv.Key);
            }
            var spark = VfxTextureArt.Draw("spark");
            Assert.Greater(spark.AlphaAt(32, 32), 0.95f);
            Assert.Less(spark.AlphaAt(0, 0), 0.01f);
            var shard = VfxTextureArt.Draw("shard");
            Assert.AreEqual(0.95f, shard.AlphaAt(24, 24), 0.01f);
            Assert.AreEqual(0f, shard.AlphaAt(2, 2), 0.001f);
            var pillar = VfxTextureArt.Draw("pillar");
            Assert.Greater(pillar.AlphaAt(64, 256), 0.9f);
            Assert.Less(pillar.AlphaAt(2, 256), 0.05f);
            Assert.Less(pillar.AlphaAt(64, 1), 0.05f, "destination-in fades the ends");
            var ring = VfxTextureArt.Draw("ring");
            Assert.Greater(ring.AlphaAt(128 + 114, 128), 0.8f, "outer circle at r=114");
            Assert.Less(ring.AlphaAt(128, 128), 0.01f, "hollow centre");
            var feather = VfxTextureArt.Draw("feather");
            Assert.Greater(feather.AlphaAt(48, 24), 0.99f, "the spine is opaque");
            Assert.Less(feather.AlphaAt(48, 2), 0.01f);
            var droplet = VfxTextureArt.Draw("droplet");
            Assert.Greater(droplet.AlphaAt(32, 50), 0.9f, "the round bottom of the drop");
        }
    }
}
