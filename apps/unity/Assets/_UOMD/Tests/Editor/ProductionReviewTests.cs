using System;
using System.IO;
using System.Linq;
using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEditor;
using Uomd.Core;
using Uomd.EditorTools;
using Uomd.Scenes;

namespace Uomd.Tests
{
    public sealed class ProductionReviewTests
    {
        private string _fixture;
        private bool _previousActive;
        [SetUp]
        public void Setup()
        {
            _fixture = Path.Combine(Path.GetTempPath(), "uomd-review-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(_fixture);
            _previousActive = UomdEditorPreviewIsolation.Active;
        }
        [TearDown]
        public void Teardown()
        {
            SessionState.SetBool(UomdEditorPreviewIsolation.ActiveKey, _previousActive);
            Directory.Delete(_fixture, true);
        }

        [Test]
        public void CurrentCandidatesHaveExactSourcesAndActualConsumers()
        {
            string root = ProductionReviewCatalog.RepositoryRoot;
            var assets = ProductionReviewCatalog.Load(root);
            Assert.AreEqual(26, assets.Count(a => a.Candidate));
            Assert.GreaterOrEqual(assets.Count, 460);
            foreach (var asset in assets.Where(a => a.Candidate))
            {
                ProductionReviewCatalog.VerifyTarget(root, asset);
                Assert.IsNotEmpty(asset.Scenario);
                StringAssert.Contains("Actual manifest consumers", asset.Details);
                Assert.IsTrue(File.Exists(ProductionReviewCatalog.Resolve(root, asset.PromptPath)));
            }
        }

        [Test]
        public void RevisionRequestReopensWithExactRevisionHashesAndCaptureLinksWithoutApprovingArt()
        {
            string source = Path.Combine(_fixture, "source.png"), entry = Path.Combine(_fixture, "entry.json");
            File.WriteAllText(source, "fixture source"); File.WriteAllText(entry, "{\"qc\":{\"human\":{\"status\":\"pending\"}}}");
            string before = File.ReadAllText(entry);
            var asset = new ProductionReviewAsset { Id = "fixture", Revision = 2, SourcePath = "source.png", SourceSha = Sha256Hash.ComputeFileHex(source), EntryPath = "entry.json", EntrySha = Sha256Hash.ComputeFileHex(entry) };
            var store = new ProductionReviewStore(_fixture);
            var index = store.Read();
            index.captures.Add(new ProductionReviewCapture { id = "before", scenario = "prologue/reunion", lineId = "entry_past_008", sha256 = "capture-hash" });
            index.captures.Add(new ProductionReviewCapture { id = "different-line", scenario = "prologue/reunion", lineId = "other-line", sha256 = "unrelated-hash" });
            store.Write(index);
            store.AddRequest(asset, "prologue/reunion", "entry_past_008", "Pull the camera back; preserve both faces.", "revision_requested", new RebuildShotSettings());
            var saved = new ProductionReviewStore(_fixture).Read().requests.Single();
            Assert.AreEqual(2, saved.revision);
            Assert.AreEqual(asset.SourceSha, saved.sourceSha);
            Assert.AreEqual(asset.EntrySha, saved.entrySha);
            Assert.AreEqual("entry_past_008", saved.lineId);
            CollectionAssert.Contains(saved.captures, "before:capture-hash");
            CollectionAssert.DoesNotContain(saved.captures, "different-line:unrelated-hash");
            Assert.AreEqual(before, File.ReadAllText(entry));
            Assert.Throws<ArgumentException>(() => store.AddRequest(asset, "title", "", "approve", "owner_approved", new RebuildShotSettings()));
            File.WriteAllText(source, "changed");
            Assert.Throws<InvalidOperationException>(() => store.AddRequest(asset, "title", "", "stale", "revision_requested", new RebuildShotSettings()));
        }

        [Test]
        public void EveryRebuiltPortraitHasItsOwnScenarioAndResolvesTheSelectedIngestOutput()
        {
            string root = ProductionReviewCatalog.RepositoryRoot;
            var portraits = ProductionReviewCatalog.Load(root).Where(a => a.Candidate && a.Class == "portrait").ToArray();
            Assert.AreEqual(8, portraits.Length);
            CollectionAssert.AllItemsAreUnique(portraits.Select(a => a.Scenario).ToArray());
            var catalog = UomdMediaCatalog.Parse(File.ReadAllText(Path.Combine(root, "content/base/art/art_manifest.json")), null);
            foreach (var asset in portraits)
            {
                var request = new ProductionPreviewRequest { scenario = asset.Scenario };
                string expected = JsonRead.Str(JsonRead.Arr(asset.Entry, "outputs").First(), "path");
                Assert.AreEqual(expected, request.PortraitPath(catalog, request.PortraitCharacter, "composed"), asset.Id);
                string companion = request.PortraitCharacter == "fadyme" ? "mahmut" : "fadyme";
                Assert.AreEqual(catalog.PortraitImage(companion, "sol_composed"), request.PortraitPath(catalog, companion, "watchful"));
            }
        }

        [Test]
        public void UnitRevisionRequestsBindTheActualPoseAndOnlyMatchingPoseCaptureHashes()
        {
            File.WriteAllText(Path.Combine(_fixture, "source.png"), "unit fixture");
            File.WriteAllText(Path.Combine(_fixture, "entry.json"), "{}");
            var asset = new ProductionReviewAsset { Id = "sol_fixture", Revision = 1, SourcePath = "source.png", SourceSha = Sha256Hash.ComputeFileHex(Path.Combine(_fixture, "source.png")), EntryPath = "entry.json", EntrySha = Sha256Hash.ComputeFileHex(Path.Combine(_fixture, "entry.json")) };
            var store = new ProductionReviewStore(_fixture);
            var index = store.Read();
            index.captures.Add(new ProductionReviewCapture { id = "matching", scenario = "unit/mahmut", unitState = "basic", unitFrame = "basic_2", sha256 = "match" });
            index.captures.Add(new ProductionReviewCapture { id = "other-frame", scenario = "unit/mahmut", unitState = "basic", unitFrame = "basic_3", sha256 = "different" });
            index.captures.Add(new ProductionReviewCapture { id = "other-state", scenario = "unit/mahmut", unitState = "active", unitFrame = "basic_2", sha256 = "different-state" });
            store.Write(index);
            store.AddRequest(asset, "unit/mahmut", "", "Check the shield rim in this impact pose.", "revision_requested", new RebuildShotSettings(), "basic", "basic_2");
            var saved = new ProductionReviewStore(_fixture).Read().requests.Single();
            Assert.AreEqual("basic", saved.unitState);
            Assert.AreEqual("basic_2", saved.unitFrame);
            CollectionAssert.AreEqual(new[] { "matching:match" }, saved.captures);
            Assert.AreEqual(asset.SourceSha, saved.sourceSha);
            Assert.AreEqual("{}", File.ReadAllText(Path.Combine(_fixture, "entry.json")));
        }

        [Test]
        public void AuthoredReviewCoversAllTutorialStoryEmotionsWithoutRewritingCanonicalData()
        {
            string root = ProductionReviewCatalog.RepositoryRoot;
            var catalog = UomdMediaCatalog.Parse(File.ReadAllText(Path.Combine(root, "content/base/art/art_manifest.json")), null);
            var request = new ProductionPreviewRequest { scenario = "portrait/fadyme/authored" };
            int lines = 0;
            foreach (string file in Directory.GetFiles(Path.Combine(root, "content/base/story"), "tutorial_t*.json"))
            {
                foreach (var command in JsonRead.Arr(UomdJson.ParseObject(File.ReadAllText(file)), "commands"))
                {
                    string character = JsonRead.Str(command, "op") == "show" ? JsonRead.Str(command, "character") : JsonRead.Str(command, "speaker");
                    if (character != "fadyme" && character != "mahmut") continue;
                    string path = request.PortraitPath(catalog, character, JsonRead.Str(command, "emotion"));
                    Assert.IsNotNull(path, file + ": " + JsonRead.Str(command, "line_id"));
                    StringAssert.Contains("_sol_", path);
                    lines++;
                }
            }
            Assert.Greater(lines, 50);
        }

        [Test]
        public void TutorialStagesResolveNewIngestOutputsWhileLegacyConsumersRemainSeparate()
        {
            string root = ProductionReviewCatalog.RepositoryRoot;
            var catalog = UomdMediaCatalog.Parse(File.ReadAllText(Path.Combine(root, "content/base/art/art_manifest.json")), null);
            var assets = ProductionReviewCatalog.Load(root);
            var locations = new System.Collections.Generic.HashSet<string>();
            foreach (string file in Directory.GetFiles(Path.Combine(root, "content/base/story"), "tutorial_t*.json"))
            {
                string id = Path.GetFileNameWithoutExtension(file);
                Assert.IsTrue(StoryScreenController.IsRebuiltStory(id));
                var story = UomdJson.ParseObject(File.ReadAllText(file));
                string location = JsonRead.Str(story, "location_id");
                string rebuilt = catalog.Background("sol_" + location);
                Assert.IsNotNull(rebuilt, id);
                Assert.AreNotEqual(catalog.Background(location), rebuilt, "Legacy battle consumers must keep their own migration scope.");
                Assert.IsTrue(assets.Any(a => a.Candidate && JsonRead.Arr(a.Entry, "outputs").Any(o => JsonRead.Str(o, "path") == rebuilt)), id);
                locations.Add(location);
            }
            Assert.AreEqual(3, locations.Count);
            Assert.IsFalse(StoryScreenController.IsRebuiltStory("chapter_1"));
            Assert.IsFalse(StoryScreenController.IsRebuiltStory("../tutorial_t1_before"));
        }

        [Test]
        public void NativeStoryLayoutProvidesReadingAndRecoveryActionsWithoutFirstViewSkip()
        {
            var tree = Resources.Load<UnityEngine.UIElements.VisualTreeAsset>("Rebuild/Story").CloneTree();
            foreach (string action in new[] { "storyNext", "storyAuto", "storyVoice", "storyRetry", "storyTextOnly" })
                Assert.IsNotNull(UnityEngine.UIElements.UQueryExtensions.Q<UnityEngine.UIElements.Button>(tree, action));
            Assert.IsNull(UnityEngine.UIElements.UQueryExtensions.Q<UnityEngine.UIElements.Button>(tree, "storySkip"));
            Assert.IsNotNull(UnityEngine.UIElements.UQueryExtensions.Q<UnityEngine.UIElements.Label>(tree, "storyBody"));
        }

        [Test]
        public void DraftApplicationPreservesPriorConfigAndSurvivesReopen()
        {
            string path = ProductionReviewCatalog.Resolve(_fixture, "apps/unity/Assets/_UOMD/Resources/Rebuild/Presentation.json");
            ProductionReviewStore.AtomicWrite(path, "{\"shots\":[]}");
            var store = new ProductionReviewStore(_fixture);
            var settings = new RebuildShotSettings { scenario = "prologue/reunion", framing = 0.94f, subtitleBottom = 164, light = 0.9f };
            store.SaveDraft(settings);
            Assert.AreEqual(0.94f, new ProductionReviewStore(_fixture).LoadDraft("prologue/reunion").framing);
            Assert.AreEqual("{\"shots\":[]}", File.ReadAllText(path));
            store.ApplyDraft(settings);
            var saved = JsonUtility.FromJson<RebuildPresentationConfig>(File.ReadAllText(path)).shots.Single();
            Assert.AreEqual(settings.framing, saved.framing);
            Assert.AreEqual(settings.subtitleBottom, saved.subtitleBottom);
            Assert.AreEqual("{\"shots\":[]}", File.ReadAllText(Directory.GetFiles(Path.Combine(_fixture, "docs/review/drafts/history")).Single()));
            settings.framing = float.NaN;
            Assert.Throws<ArgumentException>(() => store.ApplyDraft(settings));
        }

        [Test]
        public void ExistingCaptureIndexesRecoverCanonicalLineFromTheirMetadata()
        {
            var store = new ProductionReviewStore(_fixture);
            string path = ProductionReviewCatalog.Resolve(_fixture, "docs/review/captures/prior.json");
            ProductionReviewStore.AtomicWrite(path, "{\"lineId\":\"entry_past_008\"}");
            var index = new ProductionReviewIndex();
            index.captures.Add(new ProductionReviewCapture { id = "prior", scenario = "prologue/reunion", metadata = "captures/prior.json" });
            store.Write(index);
            Assert.AreEqual("entry_past_008", new ProductionReviewStore(_fixture).Read().captures.Single().lineId);
        }

        [TestCase("../outside.json")]
        [TestCase("..\\outside.json")]
        [TestCase("C:/outside.json")]
        [TestCase("\\\\server\\share\\outside.json")]
        public void ReviewPathsCannotLeaveRepository(string path) => Assert.Throws<ArgumentException>(() => ProductionReviewCatalog.Resolve(_fixture, path));

        [Test]
        public void PreviewPreferenceChangesDoNotWriteRealPlayerPrefs()
        {
            int oldMotion = PlayerPrefs.GetInt("uomd.prefs.reducedMotion", -1);
            int oldMuted = PlayerPrefs.GetInt("uomd.prefs.muted", -1);
            SessionState.SetBool(UomdEditorPreviewIsolation.ActiveKey, true);
            UomdPrefs.Save(new GameSessionState { ReducedMotion = oldMotion != 1 }, null);
            Assert.AreEqual(oldMotion, PlayerPrefs.GetInt("uomd.prefs.reducedMotion", -1));
            Assert.AreEqual(oldMuted, PlayerPrefs.GetInt("uomd.prefs.muted", -1));
        }

        [UnityTest]
        public IEnumerator PreviewBlocksApiBeforeSendingAnyRequest()
        {
            SessionState.SetBool(UomdEditorPreviewIsolation.ActiveKey, true);
            Exception failure = null;
            bool done = false;
            async void Attempt()
            {
                try { await new UomdApiClient("https://must-never-be-contacted.invalid").CallAsync<string>("POST", "/api/v1/test", "{}", false); }
                catch (Exception e) { failure = e; }
                finally { done = true; }
            }
            Attempt();
            while (!done) yield return null;
            Assert.IsInstanceOf<UomdApiException>(failure);
            Assert.AreEqual("editor_preview", ((UomdApiException)failure).Code);
        }

        [Test]
        public void WindowOpensAndReopensWithoutGrantingApprovalOrStartingPlay()
        {
            ProductionReviewWindow.Open();
            var window = EditorWindow.GetWindow<ProductionReviewWindow>();
            window.SelectAsset("sol_prologue_reunion");
            window.Close();
            ProductionReviewWindow.Open();
            Assert.IsFalse(EditorApplication.isPlaying);
            EditorWindow.GetWindow<ProductionReviewWindow>().Close();
        }

        [Test]
        public void ViewportRestoresOriginalSelectionAndRemovesItsTemporarySize()
        {
            var flags = System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static;
            var type = typeof(Editor).Assembly.GetType("UnityEditor.GameView");
            var window = EditorWindow.GetWindow(type);
            var property = type.GetProperty("selectedSizeIndex", flags);
            int before = (int)property.GetValue(window);
            var gizmos = type.GetProperty("drawGizmos", flags);
            bool gizmosBefore = (bool)gizmos.GetValue(window);
            var sizesType = typeof(Editor).Assembly.GetType("UnityEditor.GameViewSizes");
            var sizes = sizesType.GetProperty("instance", flags | System.Reflection.BindingFlags.FlattenHierarchy).GetValue(null);
            var group = sizesType.GetProperty("currentGroup", flags).GetValue(sizes);
            var count = group.GetType().GetMethod("GetTotalCount", flags);
            int countBefore = (int)count.Invoke(group, null);
            SessionState.SetBool(UomdEditorPreviewIsolation.ActiveKey, true);
            try
            {
                ProductionReviewViewport.Begin(1920, 1080);
                ProductionReviewViewport.Set(2400, 1080);
                ProductionReviewViewport.Set(1600, 1200);
                Assert.IsFalse((bool)gizmos.GetValue(window));
            }
            finally { ProductionReviewViewport.Restore(); }
            Assert.AreEqual(before, (int)property.GetValue(window));
            Assert.AreEqual(gizmosBefore, (bool)gizmos.GetValue(window));
            Assert.AreEqual(countBefore, (int)count.Invoke(group, null));
        }
    }
}
