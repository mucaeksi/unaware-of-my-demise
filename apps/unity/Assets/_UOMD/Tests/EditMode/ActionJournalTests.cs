#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using Uomd.Core;

namespace Uomd.Tests
{
    public sealed class ActionJournalTests
    {
        private const string Request = "0123456789abcdef0123456789abcdef";
        private static UomdSavedAction Sweep(string account = "player:fixture") => new UomdSavedAction {
            Scope = UomdSavedAction.ScopeFor(account), Path = UomdSavedAction.SweepPath,
            Payload = CanonicalJson.Serialize(new Dictionary<string, object?> { ["releaseId"] = "rel_0001", ["nodeId"] = "stage_1_2", ["count"] = 5, ["requestId"] = Request }) };
        private static Dictionary<string, object?> Receipt() => UomdJson.ParseObject("{\"requestId\":\"" + Request + "\",\"nodeId\":\"stage_1_2\",\"count\":5,\"dailyUsed\":5,\"dailyLimit\":20,\"ration\":{\"spent\":30},\"rewards\":[]}");
        private static Dictionary<string, object?> Status(UomdSavedAction action, bool confirmed) => new Dictionary<string, object?> {
            ["requestId"] = action.RequestId, ["path"] = action.Path, ["state"] = confirmed ? "confirmed" : "unknown", ["binding"] = confirmed ? "exact" : null,
            ["inputHash"] = confirmed ? action.InputHash : null, ["result"] = confirmed ? Receipt() : null };
        [Test] public void SweepStatusHashIncludesProviderSweepDiscriminatorAndExactCount()
        {
            var action = Sweep(); action.Validate(); var body = action.Body; body["sweep"] = true;
            Assert.AreEqual(UomdBattleWire.Hash(CanonicalJson.Serialize(body)), action.InputHash);
            Assert.AreNotEqual(UomdBattleWire.Hash(action.Payload), action.InputHash);
            Assert.NotNull(action.ConfirmedStatus(Status(action, true)));
        }
        [Test] public void UnknownStatusDoesNotBecomeSuccessOrLoseTheOriginalIntent()
        {
            var action = Sweep(); string original = action.Encode();
            Assert.IsNull(action.ConfirmedStatus(Status(action, false))); Assert.AreEqual(original, action.Encode());
            var status = Status(action, false); status["result"] = Receipt(); Assert.Throws<InvalidDataException>(() => action.ConfirmedStatus(status));
        }
        [TestCase("path", "/api/v1/progress/battle")]
        [TestCase("requestId", "different_request")]
        [TestCase("inputHash", "incorrect")]
        [TestCase("binding", "legacy")]
        public void WrongOperationOrUnboundStatusIsRejected(string field, string value)
        { var action = Sweep(); var status = Status(action, true); status[field] = value; Assert.Throws<InvalidDataException>(() => action.ConfirmedStatus(status)); }
        [Test] public void SweepReceiptMustMatchOriginalStageCountAndRequest()
        {
            var action = Sweep(); foreach (string field in new[] { "requestId", "nodeId", "count" })
            { var receipt = Receipt(); receipt[field] = field == "count" ? (object)1L : "wrong"; Assert.Throws<InvalidDataException>(() => action.ValidateReceipt(receipt)); }
        }
        [Test] public void UnsupportedPathsExtraFieldsAndOutOfRangeSweepAreRejected()
        {
            var action = Sweep(); action.Path = "/api/v1/teams/1"; Assert.Throws<InvalidDataException>(() => action.Validate());
            action = Sweep(); var body = action.Body; body["count"] = 11L; action.Payload = CanonicalJson.Serialize(body); Assert.Throws<InvalidDataException>(() => action.Validate());
            body["count"] = 1L; body["rewards"] = new object[0]; action.Payload = CanonicalJson.Serialize(body); Assert.Throws<InvalidDataException>(() => action.Validate());
        }
        [Test] public void CompanionGrowthPreservesItsOriginalXpItemAndRejectsAnotherCompanionReceipt()
        {
            var action = Sweep(); action.Path = "/api/v1/characters/fadyme/level-up";
            action.Payload = CanonicalJson.Serialize(new Dictionary<string, object?> { ["releaseId"] = "rel_0001", ["requestId"] = Request, ["items"] = new object[] { new Dictionary<string, object?> { ["itemId"] = "xp_page", ["quantity"] = 1L } } });
            action.Validate(); Assert.AreEqual(UomdBattleWire.Hash(action.Payload), action.InputHash);
            action.ValidateReceipt(UomdJson.ParseObject("{\"character\":\"fadyme\",\"level\":13,\"gainedXp\":100,\"wastedXp\":0}"));
            Assert.Throws<InvalidDataException>(() => action.ValidateReceipt(UomdJson.ParseObject("{\"character\":\"fadyme\"}")));
            Assert.Throws<InvalidDataException>(() => action.ValidateReceipt(UomdJson.ParseObject("{\"character\":\"mahmut\"}")));
        }
        [Test] public void RejectedStateRequiresAnExplicitProviderRejectionRatherThanTimeoutOrBusy()
        {
            var action = Sweep(); action.State = "rejected"; action.RejectionCode = "busy"; Assert.Throws<InvalidDataException>(() => action.Validate());
            action.RejectionCode = "not_enough_ration"; action.Validate();
            Assert.False(UomdSavedAction.DefinitiveRejection("request_id_reused")); Assert.False(UomdSavedAction.DefinitiveRejection("unauthenticated"));
        }
        [Test] public void JournalSurvivesAFreshStoreAndDoesNotAdoptAnotherAccountOrUnpromotedTemp()
        {
            string root = Path.Combine(Path.GetTempPath(), "uomd-action-" + Guid.NewGuid().ToString("N"));
            try
            {
                var action = Sweep(); new UomdActionJournal(root).Save(action);
                string path = Path.Combine(root, action.Scope + ".json"); File.WriteAllText(path + ".tmp", "unpromoted next intent");
                Assert.AreEqual(action.Payload, new UomdActionJournal(root).Load(action.Scope)!.Payload);
                Assert.IsNull(new UomdActionJournal(root).Load(UomdSavedAction.ScopeFor("player:other")));
                Assert.Throws<InvalidDataException>(() => UomdSavedAction.Decode(action.Encode(), UomdSavedAction.ScopeFor("player:other")));
                string original = File.ReadAllText(path); File.WriteAllText(path, original.Replace("rel_0001", "rel_0002"));
                Assert.Throws<InvalidDataException>(() => new UomdActionJournal(root).Load(action.Scope));
            }
            finally { if (Directory.Exists(root)) Directory.Delete(root, true); }
        }
        [Test] public void ConfirmedReceiptAndExactInputPersistWithoutCredentials()
        {
            var action = Sweep(); action.Summary = "Sweep ×5 · 30 Ration"; action.State = "confirmed"; action.Receipt = CanonicalJson.Serialize(Receipt());
            var journal = new UomdActionJournal("unused", true); journal.Save(action);
            var read = journal.Load(action.Scope)!; Assert.AreEqual("confirmed", read.State); Assert.AreEqual(action.Payload, read.Payload); Assert.AreEqual(action.Receipt, read.Receipt);
            Assert.AreEqual(action.Summary, read.Summary);
            Assert.False(read.Encode().Contains("token"));
        }
        [Test] public void UnresolvedOriginalIntentCannotBeReplacedByANewRequest()
        {
            var journal = new UomdActionJournal("unused", true); var original = Sweep(); journal.Save(original);
            var next = Sweep(); var body = next.Body; body["requestId"] = "abcdef0123456789abcdef0123456789"; next.Payload = CanonicalJson.Serialize(body);
            Assert.Throws<InvalidOperationException>(() => journal.Save(next)); Assert.AreEqual(original.Payload, journal.Load(original.Scope)!.Payload);
        }
    }
}
