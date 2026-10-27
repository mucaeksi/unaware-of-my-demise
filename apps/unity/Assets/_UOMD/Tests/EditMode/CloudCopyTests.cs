using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using NUnit.Framework;
using Uomd.Core;

namespace Uomd.Tests
{
    public sealed class CloudCopyTests
    {
        private static UomdCloudCopy Copy(string data, long version = 3) => UomdCloudCopy.Parse(UomdJson.ParseObject("{\"version\":" + version + ",\"updatedAt\":\"2026-10-27T20:00:00Z\",\"data\":" + data + "}"));
        [Test]
        public void UploadPreservesForeignKeysAndBestStarsWithoutMutatingTheApprovedCopy()
        {
            var copy = Copy("{\"prefs\":{\"language\":\"en\"},\"entry\":{\"phase\":\"home\"},\"progress\":{\"t1\":{\"stars\":3,\"note\":\"keep\"},\"t2\":{\"stars\":2}}}");
            string before = CanonicalJson.Serialize(copy.Data);
            var body = copy.Upload(new Dictionary<string, int> { ["t1"] = 1, ["t3"] = 3 });
            Assert.That(body.Count, Is.EqualTo(2)); Assert.That(JsonRead.Int(body, "expectedVersion"), Is.EqualTo(3));
            var data = JsonRead.Obj(body, "data"); var progress = JsonRead.Obj(data, "progress");
            Assert.That(JsonRead.Int(JsonRead.Get(progress, "t1"), "stars"), Is.EqualTo(3));
            Assert.That(JsonRead.Str(JsonRead.Get(progress, "t1"), "note"), Is.EqualTo("keep"));
            Assert.That(JsonRead.Int(JsonRead.Get(progress, "t2"), "stars"), Is.EqualTo(2));
            Assert.That(JsonRead.Int(JsonRead.Get(progress, "t3"), "stars"), Is.EqualTo(3));
            Assert.That(JsonRead.Str(JsonRead.Get(data, "entry"), "phase"), Is.EqualTo("home"));
            Assert.That(JsonRead.Str(JsonRead.Get(data, "prefs"), "language"), Is.EqualTo("en"));
            Assert.That(CanonicalJson.Serialize(copy.Data), Is.EqualTo(before));
        }
        [TestCase("{\"progress\":[]}")]
        [TestCase("{\"progress\":{\"t1\":{\"stars\":4}}}")]
        [TestCase("{\"progress\":{\"bad/id\":{\"stars\":3}}}")]
        public void MalformedCloudProgressCannotBeMergedOrOverwritten(string data) => Assert.Throws<InvalidDataException>(() => Copy(data));
        [Test]
        public void EmptyCloudIsExplicitAndLargeOrInvalidLocalCopiesCannotBeSent()
        {
            var empty = UomdCloudCopy.Parse(UomdJson.ParseObject("{\"version\":0,\"updatedAt\":null,\"data\":{}}"));
            Assert.That(empty.Progress(), Is.Empty); Assert.That(empty.Version, Is.Zero);
            Assert.Throws<InvalidDataException>(() => empty.Upload(new Dictionary<string, int> { ["t1"] = -1 }));
            Assert.Throws<InvalidDataException>(() => Copy("{\"notes\":\"" + new string('x', 65536) + "\"}").Upload(new Dictionary<string, int>()));
        }
        [TestCase(-1L)]
        [TestCase(9007199254740992L)]
        public void CompareAndSetVersionMustStayInTheProviderRange(long version) => Assert.Throws<InvalidDataException>(() => Copy("{}", version));
        [Test]
        public void ExportMustConfirmTheOriginalPlayerBeforeAFileCanBeWritten()
        {
            var data = UomdJson.ParseObject("{\"profile\":{\"id\":\"player_a\"},\"exportedAt\":\"2026-10-27T20:00:00Z\"}");
            UomdCloudCopy.VerifyExport(data, "player_a");
            Assert.Throws<InvalidDataException>(() => UomdCloudCopy.VerifyExport(data, "player_b"));
        }
        [TestCase("file:///private")]
        [TestCase("javascript:alert(1)")]
        [TestCase("http://example.com")]
        [TestCase("https://user:secret@example.com")]
        public void PrivacyLinksCannotOpenLocalOrCredentialBearingUrls(string url) => Assert.Throws<InvalidDataException>(() => UomdCloudCopy.PrivacyUrl(url));
        [Test]
        public void PrivacyLinksUseOnlyTheConfiguredOriginAndExistingRoutes()
        {
            Assert.That(UomdCloudCopy.PrivacyUrl("https://api.example.com/base"), Is.EqualTo("https://api.example.com/privacy"));
            Assert.That(UomdCloudCopy.PrivacyUrl("http://127.0.0.1:1", true), Is.EqualTo("http://127.0.0.1:1/account/delete-request"));
        }
        [Test]
        public void AtomicExportKeepsTheOldFileIfTheAccountChangesBeforePromotion()
        {
            // Match the engine-free PatchClient test harness; file IO does not need the Editor synchronization context.
            Task.Run(async () =>
            {
            string root = Path.Combine(Path.GetTempPath(), "uomd_export_test_" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(root);
            string target = "";
            try
            {
                string name = await UomdCloudCopy.StoreExportAsync(root, "player:player_a", "original", () => { }); target = Path.Combine(root, name);
                Assert.That(name, Does.Not.Contain("player_a")); int checks = 0;
                bool canceled = false;
                try { await UomdCloudCopy.StoreExportAsync(root, "player:player_a", "must not appear", () => { if (++checks == 2) throw new OperationCanceledException(); }); }
                catch (OperationCanceledException) { canceled = true; }
                Assert.That(canceled, Is.True);
                Assert.That(File.ReadAllText(target), Is.EqualTo("original")); Assert.That(Directory.GetFiles(root), Has.Length.EqualTo(1));
                await UomdCloudCopy.StoreExportAsync(root, "player:player_a", "replacement", () => { }); Assert.That(File.ReadAllText(target), Is.EqualTo("replacement"));
            }
            finally { if (File.Exists(target)) File.Delete(target); Directory.Delete(root); }
            }).GetAwaiter().GetResult();
        }
        [Test]
        public void CanceledExportCannotCreateAFile()
        {
            string root = Path.Combine(Path.GetTempPath(), "uomd_export_test_" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(root);
            try
            {
                using var token = new CancellationTokenSource(); token.Cancel(); bool canceled = false;
                try { UomdCloudCopy.StoreExportAsync(root, "player:player_a", "never written", () => { }, token.Token).GetAwaiter().GetResult(); }
                catch (OperationCanceledException) { canceled = true; }
                Assert.That(canceled, Is.True); Assert.That(Directory.GetFiles(root), Is.Empty);
            }
            finally { Directory.Delete(root); }
        }
    }
}
