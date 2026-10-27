#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using Uomd.Core;

namespace Uomd.Tests
{
    public sealed class RewardActionsTests
    {
        private static Dictionary<string, object?> Parse(string json) => UomdJson.ParseObject(json);
        private const string Release = "rel_0001", Request = "11111111111111111111111111111111";
        private static UomdSavedAction Action(string path, string fields)
        {
            var body = Parse("{\"releaseId\":\"rel_0001\",\"requestId\":\"" + Request + "\"" + fields + "}");
            return new UomdSavedAction { Scope = UomdSavedAction.ScopeFor("player:reward_account"), Path = path, Payload = CanonicalJson.Serialize(body), Summary = "Original fixture reward plan" };
        }
        private static Dictionary<string, object?> Result(string fields) => Parse("{\"releaseId\":\"rel_0001\",\"requestId\":\"" + Request + "\",\"replayed\":false," + fields + "}");
        [Test] public void InvitationAcceptsOnlyTheSelectedCharacterAndOriginalGrantClassification()
        {
            var action = Action("/api/v1/recruitment/first_oath_invitation", ",\"characterId\":\"tilda_fen\""); action.Validate();
            var result = Result("\"itemId\":\"first_oath_invitation\",\"characterId\":\"tilda_fen\",\"characterName\":\"Tilda\",\"consumed\":1,\"grant\":{\"copiesAdded\":1,\"copiesAfter\":1,\"shardsAdded\":0,\"shardsAfter\":0}");
            action.ValidateReceipt(result); result["characterId"] = "another_companion"; Assert.Throws<InvalidDataException>(() => action.ValidateReceipt(result));
            result["characterId"] = "tilda_fen"; JsonRead.Obj(result, "grant")["shardsAdded"] = 5L;
            Assert.Throws<InvalidDataException>(() => action.ValidateReceipt(result));
            JsonRead.Obj(result, "grant")["copiesAfter"] = 2L; JsonRead.Obj(result, "grant")["shardsAfter"] = 5L; action.ValidateReceipt(result);
        }
        [Test] public void TaskReceiptCannotSettleAnotherWindowOrMissingFrozenTerms()
        {
            var action = Action(UomdSavedAction.TaskPath, ",\"periodKey\":\"d:2026-10-27T12\",\"taskId\":\"win_two\""); action.Validate();
            var result = Result("\"periodKey\":\"d:2026-10-27T12\",\"taskId\":\"win_two\",\"taskRulesSha256\":\"" + new string('a', 64) + "\",\"rewards\":[{\"type\":\"currency\",\"currency\":\"eclipse_token\",\"amount\":10}]");
            action.ValidateReceipt(result); result["periodKey"] = "d:2026-10-28T00"; Assert.Throws<InvalidDataException>(() => action.ValidateReceipt(result));
            result["periodKey"] = "d:2026-10-27T12"; result.Remove("taskRulesSha256"); Assert.Throws<InvalidDataException>(() => action.ValidateReceipt(result));
        }
        [Test] public void SuppliesRequireAnExplicitRealUtcDayAndMatchingReceipt()
        {
            var action = Action(UomdSavedAction.SuppliesPath, ",\"periodKey\":\"supply:2026-10-27\""); action.Validate();
            Assert.Throws<InvalidDataException>(() => Action(UomdSavedAction.SuppliesPath, "").Validate());
            Assert.Throws<InvalidDataException>(() => Action(UomdSavedAction.SuppliesPath, ",\"periodKey\":\"supply:2026-02-30\"").Validate());
            var result = Result("\"periodKey\":\"supply:2026-10-27\",\"taskId\":\"_daily_supplies\",\"amount\":80,\"endsAtMs\":" + UomdErrandsSnapshot.SupplyEnd("supply:2026-10-27") + ",\"rewards\":[{\"type\":\"currency\",\"currency\":\"eclipse_token\",\"amount\":80}]");
            action.ValidateReceipt(result); result["periodKey"] = "supply:2026-10-28"; Assert.Throws<InvalidDataException>(() => action.ValidateReceipt(result));
        }
        [Test] public void PatrolRequiresAnActualNonzeroServerSettlement()
        {
            var action = Action(UomdSavedAction.PatrolPath, ""); action.Validate();
            var result = Result("\"previousCheckpointMs\":100000,\"checkpointMs\":160000,\"elapsedSeconds\":60,\"minutesAccrued\":1,\"capped\":false,\"rewards\":[{\"type\":\"account_xp\",\"amount\":3}]");
            action.ValidateReceipt(result); result["minutesAccrued"] = 2L; Assert.Throws<InvalidDataException>(() => action.ValidateReceipt(result));
        }
        [TestCase("d:2026-13-01T00")]
        [TestCase("d:2026-10-27T25")]
        [TestCase("d:2026-10-27")]
        public void MalformedPeriodsCannotEnterTheJournal(string period)
        { Assert.Throws<InvalidDataException>(() => Action(UomdSavedAction.TaskPath, ",\"taskId\":\"win_two\",\"periodKey\":\"" + period + "\"").Validate()); }
        [Test] public void RewardListsRejectAnotherCurrencyAndFabricatedZeroAmounts()
        {
            Assert.Throws<InvalidDataException>(() => UomdErrandsSnapshot.Rewards(Parse("{\"rewards\":[{\"type\":\"currency\",\"currency\":\"premium_coin\",\"amount\":1}]}")));
            Assert.Throws<InvalidDataException>(() => UomdErrandsSnapshot.Rewards(Parse("{\"rewards\":[{\"type\":\"item\",\"itemId\":\"fixture_item\",\"quantity\":0}]}")));
        }
        [Test] public void AnOldSuppliesServiceIsVisibleButCannotCreateUnboundIntent()
        {
            string json = "{\"serverTimeMs\":1,\"daily\":null,\"weekly\":[],\"supplies\":{\"periodKey\":\"supply:2026-10-27\",\"endsAtMs\":" + UomdErrandsSnapshot.SupplyEnd("supply:2026-10-27") + ",\"amount\":80,\"claimed\":false}}";
            var data = UomdErrandsSnapshot.Parse(Parse(json), Release); Assert.False(data.SupplyReady(1));
            var raw = Parse(json); JsonRead.Obj(raw, "supplies")["periodBound"] = true;
            data = UomdErrandsSnapshot.Parse(raw, Release); Assert.True(data.SupplyReady(1)); Assert.False(data.SupplyReady(data.SupplyEnds));
        }
        [Test] public void DailyExpiryDoesNotInventTheEndOfAListedWeeklyClaimGrace()
        {
            var row = new UomdErrandsSnapshot.Row { Done = true, End = 10 };
            Assert.False(row.CanClaim(11)); row.Weekly = true; Assert.True(row.CanClaim(11)); row.Claimed = true; Assert.False(row.CanClaim(11));
        }
        [Test] public void InvitationListingNeverFallsBackToUnlistedChoices()
        {
            Assert.IsEmpty(UomdInvitation.Parse(Parse("{\"releaseId\":\"rel_0001\",\"selectors\":[]}"), Release));
            Assert.Throws<InvalidDataException>(() => UomdInvitation.Parse(Parse("{\"releaseId\":\"rel_other\",\"selectors\":[]}"), Release));
            Assert.Throws<InvalidDataException>(() => UomdInvitation.Parse(Parse("{\"releaseId\":\"rel_0001\",\"selectors\":[{\"itemId\":\"bad_selector\"}]}"), Release));
        }
        [Test] public void FreshJournalPreservesOriginalPeriodAndCannotReplaceItAtRollover()
        {
            string root = Path.Combine(Path.GetTempPath(), "uomd_rewards_" + Guid.NewGuid().ToString("N"));
            try
            {
                var original = Action(UomdSavedAction.SuppliesPath, ",\"periodKey\":\"supply:2026-10-27\""); var store = new UomdActionJournal(root); store.Save(original);
                var restored = new UomdActionJournal(root).Load(original.Scope)!; Assert.AreEqual(original.Payload, restored.Payload); Assert.AreEqual(original.InputHash, restored.InputHash);
                var replacement = Action(UomdSavedAction.SuppliesPath, ",\"periodKey\":\"supply:2026-10-28\"");
                Assert.Throws<InvalidOperationException>(() => store.Save(replacement)); Assert.AreEqual(original.Summary, store.Load(original.Scope)!.Summary);
            }
            finally { if (Directory.Exists(root)) { foreach (string file in Directory.GetFiles(root)) File.Delete(file); Directory.Delete(root); } }
        }
    }
}
