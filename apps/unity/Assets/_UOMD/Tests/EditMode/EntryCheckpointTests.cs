#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using NUnit.Framework;
using Uomd.Core;
using Uomd.Narrative;

namespace Uomd.Tests.EditMode
{
    public sealed class EntryCheckpointTests
    {
        private string _root = "";
        private static string Scope => UomdEntryCheckpoint.ScopeFor("player:fixture-a");
        [SetUp] public void CreateRoot() { _root = Path.Combine(Path.GetTempPath(), "uomd-entry-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(_root); }
        [TearDown] public void RemoveFixtureFiles()
        {
            Assert.IsTrue(Path.GetFullPath(_root).StartsWith(Path.Combine(Path.GetTempPath(), "uomd-entry-"), StringComparison.OrdinalIgnoreCase));
            foreach (string file in Directory.GetFiles(_root)) File.Delete(file);
            Directory.Delete(_root);
        }
        private static UomdEntryCheckpoint Fixture() => new UomdEntryCheckpoint
        {
            Scope = Scope, Release = "rel_0001", PrologueDone = true, Tutorials = 1, Stage = 2, Phase = "pre_story",
            StoryPath = "story/tutorial_t2_before.json", SceneId = "tutorial_t2_before", ContentHash = new string('a', 64), StoryIndex = 7,
            Choices = new[] { "stay" }, Flags = new Dictionary<string, bool> { ["stayed"] = true }, RequestId = new string('a', 32), Sequence = 10, AutoRead = true
        };
        [Test] public void NewStoreRestoresAccountReleaseSceneChoiceAndSequenceFromDisk()
        {
            var expected = Fixture(); new UomdEntryCheckpointStore(_root).Save(expected);
            var actual = new UomdEntryCheckpointStore(_root).Load(Scope);
            Assert.AreEqual(expected.Encode(), actual.Encode());
            Assert.IsFalse(File.ReadAllText(Path.Combine(_root, Scope + ".json")).Contains("fixture-a"), "Only the scope hash belongs in a checkpoint.");
        }
        [Test] public void CorruptLatestFileRecoversPreviousAtomicCopy()
        {
            var store = new UomdEntryCheckpointStore(_root); var c = Fixture(); store.Save(c);
            c.Sequence++; c.StoryIndex++; store.Save(c);
            File.WriteAllText(Path.Combine(_root, Scope + ".json"), "interrupted write");
            var restored = new UomdEntryCheckpointStore(_root); var previous = restored.Load(Scope);
            Assert.AreEqual(10, previous.Sequence); Assert.AreEqual(7, previous.StoryIndex); StringAssert.Contains("Recovered", restored.ReadIssue);
            previous.Sequence++; restored.Save(previous);
            File.WriteAllText(Path.Combine(_root, Scope + ".json"), "second interruption");
            Assert.AreEqual(10, new UomdEntryCheckpointStore(_root).Load(Scope).Sequence, "Saving a recovered copy must not back up the corrupt primary over the good backup.");
        }
        [Test] public void UncommittedTemporaryFileCannotReplaceTheLastGoodCheckpoint()
        {
            var c = Fixture(); new UomdEntryCheckpointStore(_root).Save(c);
            File.WriteAllText(Path.Combine(_root, Scope + ".json.tmp"), "unfinished");
            Assert.AreEqual(10, new UomdEntryCheckpointStore(_root).Load(Scope).Sequence);
        }
        [Test] public void AnotherAccountAndGuestDoNotInheritTheSavedProgress()
        {
            var store = new UomdEntryCheckpointStore(_root); store.Save(Fixture());
            Assert.AreEqual(0, store.Load(UomdEntryCheckpoint.ScopeFor("guest")).Tutorials);
            string other = UomdEntryCheckpoint.ScopeFor("player:fixture-b");
            File.Copy(Path.Combine(_root, Scope + ".json"), Path.Combine(_root, other + ".json"));
            Assert.IsFalse(store.Load(other).PrologueDone); Assert.IsNotEmpty(store.ReadIssue);
        }
        [Test] public void NewerVersionIsPreservedInsteadOfBeingDowngradedToTheBackup()
        {
            var store = new UomdEntryCheckpointStore(_root); store.Save(Fixture()); store.Save(Fixture());
            string payload = Fixture().Encode().Replace("\"version\":1", "\"version\":2");
            string envelope = CanonicalJson.Serialize(new Dictionary<string, object?> { ["payload"] = payload, ["sha256"] = Sha256Hash.ComputeHex(Encoding.UTF8.GetBytes(payload)) });
            string file = Path.Combine(_root, Scope + ".json"); File.WriteAllText(file, envelope);
            Assert.Throws<NotSupportedException>(() => new UomdEntryCheckpointStore(_root).Load(Scope)); Assert.AreEqual(envelope, File.ReadAllText(file));
        }
        [Test] public void ImpossibleCompletionAndUnboundedStoryDataAreRejected()
        {
            var c = Fixture(); c.Completed = true;
            Assert.Throws<InvalidDataException>(() => new UomdEntryCheckpointStore(_root).Save(c));
            c.Completed = false; c.Flags[new string('x', 129)] = true;
            Assert.Throws<InvalidDataException>(() => new UomdEntryCheckpointStore(_root).Save(c));
            Assert.Throws<ArgumentException>(() => new UomdEntryCheckpointStore(_root).Load("../other"));
        }
        [Test] public void DiskFailureIsReportedAndMemoryOnlyReviewCreatesNoFile()
        {
            File.WriteAllText(Path.Combine(_root, "blocked"), "fixture");
            Assert.Throws<IOException>(() => new UomdEntryCheckpointStore(Path.Combine(_root, "blocked", "child")).Save(Fixture()));
            var memory = new UomdEntryCheckpointStore(_root, true); memory.Save(Fixture());
            Assert.AreEqual(7, memory.Load(Scope).StoryIndex); Assert.IsFalse(File.Exists(Path.Combine(_root, Scope + ".json")));
        }
        [Test] public void RestoredReaderReconstructsCompanionsPriorEmotionAtTheCurrentLine()
        {
            var scene = new StorySceneDto { scene_id = "fixture", commands = new[]
            {
                new StoryCommandDto { op = "show", character = "fadyme", side = "left" },
                new StoryCommandDto { op = "show", character = "mahmut", side = "right" },
                new StoryCommandDto { op = "say", line_id = "one", speaker = "fadyme", emotion = "warm", text = "First." },
                new StoryCommandDto { op = "say", line_id = "two", speaker = "mahmut", emotion = "watchful", text = "Second." }
            } };
            var runner = new StoryRunner(scene); while (runner.Next()?.lineId != "two") { }
            var restored = new StoryRunner(scene, runner.SaveAtCurrentEvent());
            Assert.AreEqual("warm", restored.Restored.actors["fadyme"].emotion);
            Assert.AreEqual("two", restored.Next().lineId, "The current blocking line is replayed, not silently skipped.");
        }
    }
}
