#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
using Uomd.Combat;
using Uomd.Contracts;
using Uomd.Core;

namespace Uomd.Tests
{
    public sealed class BattleOperationTests
    {
        private static string Root => Path.GetFullPath(Path.Combine(Application.dataPath, "..", "..", ".."));
        private static Dictionary<string, object?> Fixture => UomdJson.ParseObject(File.ReadAllText(Path.Combine(Application.dataPath, "_UOMD/Tests/EditMode/battle_contract_vectors.json")));
        private static string Json(string key) => CanonicalJson.Serialize(Fixture[key]);
        private static BattleActionInputDto[] ReadActions() => JsonRead.Objects(Fixture["submit"], "actions").Select(a => new BattleActionInputDto { skillId = JsonRead.Str(a, "skillId"), targetId = JsonRead.Get(a, "targetId") as string }).ToArray();
        private static UomdBattleOperation NewOperation()
        {
            var f = Fixture; var combat = f["combat"];
            return new UomdBattleOperation { Scope = UomdBattleOperation.ScopeFor("player:fixture_a"), Release = JsonRead.Str(f["submit"], "releaseId"), Node = JsonRead.Str(f["submit"], "nodeId"),
                Encounter = Path.GetFileNameWithoutExtension(JsonRead.Str(combat, "encounter")), RequestId = JsonRead.Str(f["submit"], "requestId"), StartJson = Json("start"),
                PackHash = UomdBattleWire.Hash(File.ReadAllText(Path.Combine(Root, JsonRead.Str(combat, "pack")))), EncounterHash = UomdBattleWire.Hash(File.ReadAllText(Path.Combine(Root, JsonRead.Str(combat, "encounter")))) };
        }
        [Test] public void ProviderFixturesPreserveExactPayloadHashAndOmissions()
        {
            var f = Fixture; var op = NewOperation(); op.Prepare(ReadActions());
            Assert.AreEqual(JsonRead.Str(f, "payload"), op.Payload); Assert.AreEqual(JsonRead.Str(f, "inputHash"), op.InputHash);
            Assert.AreEqual(JsonRead.Str(f, "startCanonical"), UomdBattleWire.Start(op.Release, op.Node));
            var noTarget = new BattleSubmitRequestDto { releaseId = op.Release, nodeId = op.Node, requestId = op.RequestId, actions = new[] { new BattleActionInputDto { skillId = "skill_one" } } };
            string json = UomdBattleWire.Submit(noTarget);
            Assert.False(json.Contains("targetId")); Assert.False(json.Contains("sessionId"));
            Assert.IsNull(BattleStartReceipt.Parse(Json("nullableStart")).SessionId);
            Assert.AreEqual("null", BattleStartReceipt.Parse(Json("nullableStart")).PartyJson);
            noTarget.actions = new BattleActionInputDto[601]; Assert.Throws<InvalidDataException>(() => UomdBattleWire.Submit(noTarget));
        }
        [Test] public void ServerFrozenPartyReplaysAuthoritativeGoldenResult()
        {
            var f = Fixture; var c = f["combat"]; var op = NewOperation();
            var pack = UnitPackDef.FromJson(File.ReadAllText(Path.Combine(Root, JsonRead.Str(c, "pack"))));
            var encounter = EncounterDef.FromJson(File.ReadAllText(Path.Combine(Root, JsonRead.Str(c, "encounter"))));
            var actions = ReadActions().Select(a => new PlayerAction(a.skillId, a.targetId)).ToList();
            var replay = BattleReplay.Replay(pack, encounter, actions, CombatJson.Party(op.Start.PartyJson));
            Assert.True(replay.Valid); Assert.True(replay.Complete); Assert.AreEqual("player", replay.Result?.Winner);
            Assert.AreEqual(JsonRead.Str(c, "logHash"), replay.LogHash);
        }
        [Test] public void UnknownKeepsTheSameRequestAndCannotGrantCompletion()
        {
            var op = NewOperation(); op.Prepare(ReadActions()); string original = op.Encode();
            Assert.False(BattleOperationStatus.Parse(Json("unknown"), op.RequestId, op.InputHash).Confirmed);
            op.Prepare(ReadActions()); Assert.AreEqual(original, op.Encode()); Assert.True(op.Pending);
            Assert.Throws<InvalidOperationException>(() => op.Prepare(new[] { new BattleActionInputDto { skillId = "changed" } }));
            Assert.AreEqual(original, op.Encode());
        }
        [Test] public void LostResponseCanBeConfirmedOnlyByExactBoundProof()
        {
            var op = NewOperation(); op.Prepare(ReadActions());
            var status = BattleOperationStatus.Parse(Json("status"), op.RequestId, op.InputHash);
            Assert.True(status.Confirmed); op.Confirm(status.Result!); Assert.AreEqual("confirmed", op.State);
            Assert.AreEqual(3, BattleReceipt.Parse(op.ReceiptJson).Stars);
            foreach (string field in new[] { "requestId", "path", "inputHash", "binding" })
            {
                var invalid = UomdJson.ParseObject(Json("status")); invalid[field] = field == "binding" ? "legacy" : "wrong";
                Assert.Throws<InvalidDataException>(() => BattleOperationStatus.Parse(CanonicalJson.Serialize(invalid), op.RequestId, op.InputHash), field);
            }
        }
        [Test] public void ReleaseCutoverAndRollbackNeverRewritePendingProof()
        {
            var op = NewOperation(); var c = Fixture["combat"];
            string pack = File.ReadAllText(Path.Combine(Root, JsonRead.Str(c, "pack"))), encounter = File.ReadAllText(Path.Combine(Root, JsonRead.Str(c, "encounter")));
            Assert.True(op.ContentMatches(op.Release, pack, encounter)); Assert.False(op.ContentMatches("rel_cutover", pack, encounter)); Assert.False(op.ContentMatches(op.Release, pack, encounter + " "));
            op.Prepare(ReadActions()); string payload = op.Payload;
            Assert.True(op.ContentMatches(op.Release, pack, encounter)); Assert.AreEqual(payload, op.Payload);
        }
        [Test] public void ExplicitRejectionRetainsOriginalProofAndCanStillReconcileALateReceipt()
        {
            var op = NewOperation(); op.Prepare(ReadActions()); string payload = op.Payload;
            op.State = "rejected"; op.RejectionCode = "session_expired";
            var restored = UomdBattleOperation.Decode(op.Encode(), op.Scope);
            Assert.AreEqual(payload, restored.Payload); Assert.False(restored.Pending);
            restored.Confirm(BattleOperationStatus.Parse(Json("status"), restored.RequestId, restored.InputHash).Result!);
            Assert.AreEqual("confirmed", restored.State);
            op.RejectionCode = "connection_lost";
            Assert.Throws<InvalidDataException>(() => UomdBattleOperation.Decode(op.Encode(), op.Scope));
        }
        [Test] public void JournalPathAndCatalogBindingCannotBeChangedByAReceipt()
        {
            var op = NewOperation(); op.Prepare(ReadActions());
            var start = UomdJson.ParseObject(op.StartJson); start["catalogSha256"] = new string('c', 64); op.StartJson = CanonicalJson.Serialize(start);
            Assert.Throws<InvalidDataException>(() => op.Confirm(BattleReceipt.Parse(Json("result"))));
            Assert.True(op.Pending);
            var encoded = UomdJson.ParseObject(op.Encode()); encoded["path"] = "/api/v1/progress/sweep";
            Assert.Throws<InvalidDataException>(() => UomdBattleOperation.Decode(CanonicalJson.Serialize(encoded), op.Scope));
        }
        [Test] public void AtomicJournalSurvivesRestartAndIgnoresUnpromotedTemp()
        {
            string dir = Path.Combine(Path.GetTempPath(), "uomd-battle-test-" + Guid.NewGuid().ToString("N"));
            Assert.That(Path.GetFullPath(dir), Does.StartWith(Path.GetFullPath(Path.GetTempPath()) + (Path.GetTempPath().EndsWith(Path.DirectorySeparatorChar.ToString()) ? "" : Path.DirectorySeparatorChar.ToString())));
            try
            {
                var op = NewOperation(); var store = new UomdBattleJournal(dir); store.Save(op); op.Prepare(ReadActions()); store.Save(op);
                File.WriteAllText(Path.Combine(dir, op.Scope + ".json.tmp"), "interrupted write");
                var restarted = new UomdBattleJournal(dir).Load(op.Scope)!; Assert.AreEqual(op.Payload, restarted.Payload); Assert.True(restarted.Pending);
                Assert.IsNull(store.Load(UomdBattleOperation.ScopeFor("player:fixture_b")));
                Assert.Throws<InvalidDataException>(() => UomdBattleOperation.Decode(op.Encode(), UomdBattleOperation.ScopeFor("player:fixture_b")));
                restarted.Confirm(BattleReceipt.Parse(Json("result"))); store.Save(restarted);
                Assert.AreEqual("confirmed", new UomdBattleJournal(dir).Load(op.Scope)!.State);
                // A valid older backup must never silently erase a possibly sent claim.
                File.WriteAllText(Path.Combine(dir, op.Scope + ".json"), "{}"); Assert.Throws<InvalidDataException>(() => store.Load(op.Scope));
            }
            finally { if (Directory.Exists(dir)) Directory.Delete(dir, true); }
        }
        [Test] public void InvalidOrNewerJournalsFailClosedAndGuestsCannotOwnClaims()
        {
            var op = NewOperation(); string encoded = op.Encode();
            Assert.Throws<NotSupportedException>(() => UomdBattleOperation.Decode(encoded.Replace("\"version\":1", "\"version\":2"), op.Scope));
            Assert.Throws<InvalidOperationException>(() => UomdBattleOperation.ScopeFor("guest"));
            Assert.Throws<InvalidOperationException>(() => UomdBattleOperation.ScopeFor("token:secret"));
            string file = Path.GetTempFileName();
            try { Assert.Throws<IOException>(() => new UomdBattleJournal(file).Save(op)); }
            finally { File.Delete(file); }
        }
    }
}
