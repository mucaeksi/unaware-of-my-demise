#nullable enable
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
using Uomd.Core;

namespace Uomd.Tests
{
    /// <summary>UomdMediaCatalog against the real base release in content/base (the source of StreamingAssets/uomd_base).</summary>
    public sealed class MediaCatalogTests
    {
        private static string ContentBase => Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", "..", "content", "base"));

        private static UomdMediaCatalog Load() => UomdMediaCatalog.Parse(
            File.ReadAllText(Path.Combine(ContentBase, "art", "art_manifest.json")),
            File.ReadAllText(Path.Combine(ContentBase, "presentation", "presentation.json")));

        [Test]
        public void ResolvesEveryMediaKindOfTheBaseRelease()
        {
            var catalog = Load();
            Assert.IsTrue(catalog.TryGetMusic("bgm_main_theme", out var theme));
            Assert.AreEqual("audio/bgm_main_theme.ogg", theme.File);
            Assert.Greater(theme.DurationSeconds, theme.LoopStartSeconds);
            Assert.AreEqual("art/ui_studio_mark.webp", catalog.Ui("studio_mark"));
            Assert.AreEqual("art/still_prologue_hours.webp", catalog.Still("prologue_hours"));
            Assert.AreEqual("art/bg_forest_whispering_ash.webp", catalog.Background("forest_whispering_ash"));
            Assert.AreEqual("art/atlas_fadyme.webp", catalog.Atlas("atlas_fadyme"));
            Assert.IsTrue(catalog.TryGetVoice("entry_past_001", out var voice));
            Assert.AreEqual("voices/entry_past_001.ogg", voice.File);
            Assert.IsTrue(catalog.TryGetSound("sfx_ui_tap", out var tap));
            Assert.That(tap.Volume, Is.InRange(0.01f, 1f));
        }

        [Test]
        public void PortraitEmotionAliasesAndFallbacks()
        {
            var catalog = Load();
            Assert.AreEqual("art/portrait_fadyme_composed.webp", catalog.Portrait("fadyme", "calm"));
            Assert.AreEqual("art/portrait_fadyme_warm.webp", catalog.Portrait("fadyme", "soft_smile"));
            Assert.AreEqual("art/portrait_fadyme_composed.webp", catalog.Portrait("fadyme", "not_an_emotion"));
            Assert.IsNull(catalog.Portrait("nobody", "calm"));
        }

        [Test]
        public void EveryCatalogFileExistsInTheRelease()
        {
            var catalog = Load();
            foreach (string id in catalog.MusicIds)
            {
                catalog.TryGetMusic(id, out var track);
                Assert.IsTrue(File.Exists(Path.Combine(ContentBase, track.File)), track.File);
            }
            foreach (string id in catalog.VoiceIds.Take(20))
            {
                catalog.TryGetVoice(id, out var cue);
                Assert.IsTrue(File.Exists(Path.Combine(ContentBase, cue.File)), cue.File);
            }
        }

        [Test]
        public void MissingOrEmptyManifestsGiveAnEmptyCatalog()
        {
            var catalog = UomdMediaCatalog.Parse(null, "");
            Assert.IsFalse(catalog.TryGetMusic("bgm_main_theme", out _));
            Assert.IsNull(catalog.Ui("logo"));
        }
    }
}
