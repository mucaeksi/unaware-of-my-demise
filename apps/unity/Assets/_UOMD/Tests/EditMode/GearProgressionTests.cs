#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using NUnit.Framework;
using Uomd.Core;

namespace Uomd.Tests
{
    public sealed class GearProgressionTests
    {
        private const string Request = "0123456789abcdef0123456789abcdef";
        private static Dictionary<string, object?> Catalog() => UomdJson.ParseObject("{\"releaseId\":\"rel_0001\",\"catalogSha256\":\"" + new string('a', 64) + "\",\"items\":[{\"item_id\":\"tempering\",\"name_en\":\"Tempering XP\"},{\"item_id\":\"rivet\",\"name_en\":\"Rivet\"},{\"item_id\":\"cinder\",\"name_en\":\"Cinder\"},{\"item_id\":\"dust\",\"name_en\":\"Dust\"}],\"gear\":[{\"gear_id\":\"test_sword\",\"slot\":\"weapon\",\"level_cap\":20,\"dismantle_allowed\":1,\"dismantle_xp\":80,\"dismantle_json\":\"[{\\\"item_id\\\":\\\"dust\\\",\\\"quantity\\\":3}]\"},{\"gear_id\":\"test_ring\",\"slot\":\"ring\",\"level_cap\":1,\"dismantle_allowed\":1,\"dismantle_xp\":0,\"dismantle_json\":\"[]\"}],\"config\":{\"progression\":{\"equipment\":{\"levelCap\":20,\"xpItemId\":\"tempering\",\"milestoneItemId\":\"rivet\",\"xp\":{\"base\":20,\"increment\":5},\"fee\":{\"base\":2,\"increment\":1},\"milestones\":[{\"fromLevel\":5,\"rivets\":1},{\"fromLevel\":10,\"rivets\":2},{\"fromLevel\":15,\"rivets\":3}]}},\"gear\":{\"rerollCost\":{\"itemId\":\"cinder\",\"quantityByRarity\":{\"4\":2,\"5\":3}}}}}");
        private static Dictionary<string, object?> Owned(bool ring = false) => UomdJson.ParseObject("{\"releaseId\":\"rel_0001\",\"catalogSha256\":\"" + new string('a',64) + "\",\"versionBound\":true,\"gear\":[{\"id\":9007199254740991,\"version\":7,\"gearId\":\"" + (ring ? "test_ring" : "test_sword") + "\",\"name\":\"Test equipment\",\"slot\":\"" + (ring ? "ring" : "weapon") + "\",\"rarity\":4,\"level\":1,\"levelCap\":" + (ring ? "1" : "5") + ",\"xp\":0,\"ascension\":0,\"locked\":false,\"canDismantle\":true,\"equippedBy\":null,\"unavailableReason\":\"\",\"passive\":null,\"stats\":" + (ring ? "{\"main\":{\"stat\":\"vit_flat\",\"value\":2},\"subs\":[{\"stat\":\"atk_pct\",\"value\":0.05}]}" : "null") + "}]}");
        private static Dictionary<string, object?> Stacks(long xp = 2000, long rivets = 10, long cinders = 20) => UomdJson.ParseObject("{\"stacks\":[{\"item_id\":\"tempering\",\"qty\":" + xp + "},{\"item_id\":\"rivet\",\"qty\":" + rivets + "},{\"item_id\":\"cinder\",\"qty\":" + cinders + "}]}");
        private static UomdGearProgression Model(bool ring = false) => UomdGearProgression.Parse(Catalog(), Stacks(), Owned(ring), "rel_0001");
        [Test] public void TemperingAtMilestoneConsumesOnlyNeededXpAndCrossedLevelFees()
        {
            var m = Model(); var p = m.Preview(m.Items[0], "level-up", 100, 1000);
            Assert.True(p.Ready); Assert.AreEqual(5, p.Level); Assert.AreEqual(0, p.Xp); Assert.AreEqual(130, p.UsedXp); Assert.AreEqual(18, p.Fee);
            Assert.AreEqual(1000, p.Fields["xp"]); Assert.AreEqual(7, p.Fields["expectedVersion"]);
        }
        [Test] public void DefaultTemperingCompletesOneLevelAndPartialXpDoesNotChargeALevelFee()
        {
            var m = Model(); var item = m.Items[0]; item.Xp = 20;
            var p = m.Preview(item, "level-up", 3); Assert.True(p.Ready); Assert.AreEqual(5, p.RequestXp); Assert.AreEqual(2, p.Level); Assert.AreEqual(3, p.Fee);
            m.Stocks["tempering"] = 2; p = m.Preview(item, "level-up", 0); Assert.True(p.Ready); Assert.AreEqual(1, p.Level); Assert.AreEqual(22, p.Xp); Assert.AreEqual(0, p.Fee);
        }
        [Test] public void ExactCurrencyAndMaterialsAreRequiredWithoutInventingAnAlternateCost()
        {
            var m = Model(); Assert.False(m.Preview(m.Items[0], "level-up", 2).Ready);
            m.Stocks["tempering"] = 0; Assert.False(m.Preview(m.Items[0], "level-up", 100).Ready);
            m = Model(true); m.Stocks["cinder"] = 1; Assert.False(m.Preview(m.Items[0], "reroll", 100).Ready);
        }
        [Test] public void AscensionRequiresCapAndDoesNotOfferBeyondDefinitionMaximum()
        {
            var m = Model(); var item = m.Items[0]; Assert.False(m.Preview(item, "ascend", 100).Ready);
            item.Level = 5; var p = m.Preview(item, "ascend", 0); Assert.True(p.Ready); Assert.AreEqual(10, p.NextCap); Assert.AreEqual(1, p.Costs[0].Quantity);
            item.Definition!.MaxLevel = 5; Assert.False(m.Preview(item, "ascend", 100).Ready);
            item.Level = item.Cap = 20; item.Ascension = 3; Assert.False(m.Preview(item, "level-up", 100).Ready); Assert.False(m.Preview(item, "ascend", 100).Ready);
        }
        [Test] public void RerollCostComesFromRarityAndDoesNotForecastRandomStats()
        {
            var m = Model(true); var item = m.Items[0]; var p = m.Preview(item, "reroll", 0);
            Assert.True(p.Ready); Assert.AreEqual("cinder", p.Costs[0].Id); Assert.AreEqual(2, p.Costs[0].Quantity); Assert.AreEqual(0, p.Fee); Assert.False(m.Preview(item, "level-up", 100).Ready);
            item.Rarity = 3; Assert.False(m.Preview(item, "reroll", 100).Ready);
        }
        [Test] public void DismantleUsesNominalCatalogReturnAndRequiresFreeUnlockedInstance()
        {
            var m = Model(); var item = m.Items[0]; var p = m.Preview(item, "dismantle", 0);
            Assert.True(p.Ready); Assert.AreEqual(80, p.Returns[0].Quantity); Assert.AreEqual("dust", p.Returns[1].Id); Assert.AreEqual(3, p.Returns[1].Quantity);
            item.Locked = true; Assert.False(m.Preview(item, "dismantle", 100).Ready); item.Locked = false; item.EquippedBy = "mahmut"; Assert.False(m.Preview(item, "dismantle", 100).Ready);
        }
        [Test] public void MissingDismantleProjectionDisablesOnlyThatActionAndEmptyPayoutIsValid()
        {
            var c = Catalog(); var def = JsonRead.Objects(c, "gear").GetEnumerator(); def.MoveNext(); foreach (string k in new[] { "dismantle_xp", "dismantle_json", "dismantle_allowed" }) def.Current.Remove(k);
            var m = UomdGearProgression.Parse(c, Stacks(), Owned(), "rel_0001"); Assert.False(m.Preview(m.Items[0], "dismantle", 100).Ready); Assert.True(m.Preview(m.Items[0], "level-up", 100).Ready);
            m = Model(true); Assert.True(m.Preview(m.Items[0], "dismantle", 0).Ready); Assert.IsEmpty(m.Preview(m.Items[0], "dismantle", 0).Returns);
        }
        [Test] public void OldServiceAndMutableLegacyCatalogRemainReadableButCannotStartNewSpending()
        {
            var owned = Owned(); owned.Remove("versionBound"); foreach (var item in JsonRead.Objects(owned,"gear")) item.Remove("version");
            var m = UomdGearProgression.Parse(Catalog(), Stacks(), owned, "rel_0001"); Assert.AreEqual(1,m.Items.Count); Assert.False(m.Bound); Assert.False(m.Preview(m.Items[0],"level-up",100).Ready);
            var c = Catalog(); c.Remove("releaseId"); c.Remove("catalogSha256"); owned.Remove("releaseId"); owned.Remove("catalogSha256"); m = UomdGearProgression.Parse(c,Stacks(),owned,"rel_0001"); Assert.False(m.Bound);
        }
        [TestCase("version", -1L)] [TestCase("levelCap", 6L)] [TestCase("xp", 9007199254740992L)]
        public void MalformedOwnedNumbersFailClosed(string field, long value)
        { var owned = Owned(); foreach(var item in JsonRead.Objects(owned,"gear")) item[field] = value; Assert.Throws<InvalidDataException>(() => UomdGearProgression.Parse(Catalog(),Stacks(),owned,"rel_0001")); }
        [Test] public void CrossReleaseHashAndDuplicateAccessoryStatsAreRejected()
        {
            var owned = Owned(); owned["catalogSha256"] = new string('b',64); Assert.Throws<InvalidDataException>(() => UomdGearProgression.Parse(Catalog(),Stacks(),owned,"rel_0001"));
            owned = Owned(true); foreach(var item in JsonRead.Objects(owned,"gear")) foreach(var sub in JsonRead.Objects(item["stats"],"subs")) sub["stat"]="vit_flat";
            Assert.Throws<InvalidDataException>(() => UomdGearProgression.Parse(Catalog(),Stacks(),owned,"rel_0001"));
        }
        [TestCase("0")] [TestCase("01")] [TestCase("9007199254740992")] [TestCase("+1")] [TestCase("1/../2")]
        public void UnsafeOrNoncanonicalInstanceIdsAreRejected(string id) => Assert.Throws<InvalidDataException>(() => UomdGearProgression.InstanceId(id));
        private static UomdSavedAction Action(string kind = "level-up")
        {
            var body = new Dictionary<string,object?> { ["releaseId"]="rel_0001",["requestId"]=Request,["expectedVersion"]=7L }; if(kind=="level-up")body["xp"]=1000L;
            return new UomdSavedAction { Scope=UomdSavedAction.ScopeFor("player:gear_fixture"),Path="/api/v1/gear/9007199254740991/"+kind,Payload=CanonicalJson.Serialize(body),Summary="Original gear approval" };
        }
        private static Dictionary<string, object?> Receipt(string kind)
        {
            var r = UomdJson.ParseObject("{\"id\":9007199254740991,\"releaseId\":\"rel_0001\",\"expectedVersion\":7}");
            var data = UomdJson.ParseObject(kind=="level-up" ? "{\"level\":5,\"xp\":0,\"cap\":5,\"spentXp\":130,\"fee\":18}" : kind=="ascend" ? "{\"ascension\":1,\"newCap\":10,\"spentRivets\":1}" : kind=="reroll" ? "{\"stats\":{\"main\":{\"stat\":\"vit_flat\",\"value\":2},\"subs\":[]},\"spent\":{\"itemId\":\"cinder\",\"quantity\":2}}" : "{\"gained\":[]}"); foreach(var p in data)r[p.Key]=p.Value; return r;
        }
        [TestCase("level-up")] [TestCase("ascend")] [TestCase("reroll")] [TestCase("dismantle")]
        public void StoredGearReceiptNeedsNoRequestIdBalanceOrReplayedAndSurvivesDiskReload(string kind)
        {
            var action=Action(kind); action.Validate(); var receipt=Receipt(kind); action.ValidateReceipt(receipt);
            var status=new Dictionary<string,object?> { ["requestId"]=action.RequestId,["path"]=action.Path,["state"]="confirmed",["binding"]="exact",["inputHash"]=action.InputHash,["result"]=receipt };
            Assert.NotNull(action.ConfirmedStatus(status)); status["inputHash"]=new string('b',64); Assert.Throws<InvalidDataException>(()=>action.ConfirmedStatus(status));
            string root=Path.Combine(Path.GetTempPath(),"uomd-gear-"+Guid.NewGuid().ToString("N"));
            try { var journal=new UomdActionJournal(root); journal.Save(action); var loaded=new UomdActionJournal(root).Load(action.Scope)!; Assert.AreEqual(action.Payload,loaded.Payload); loaded.State="confirmed";loaded.Receipt=CanonicalJson.Serialize(receipt);journal.Save(loaded);Assert.AreEqual("confirmed",new UomdActionJournal(root).Load(action.Scope)!.State); }
            finally { if(Directory.Exists(root))Directory.Delete(root,true); }
        }
        [Test] public void OriginalVersionCannotBeOmittedChangedOrMisidentifiedByAReceipt()
        {
            var action=Action();var body=action.Body;body.Remove("expectedVersion");action.Payload=CanonicalJson.Serialize(body);Assert.Throws<InvalidDataException>(()=>action.Validate());
            action=Action(); var receipt=Receipt("level-up");foreach(string key in new[]{"id","expectedVersion","releaseId"}){var bad=UomdJson.ParseObject(CanonicalJson.Serialize(receipt));bad[key]=key=="releaseId"?(object)"rel_other":1L;Assert.Throws<InvalidDataException>(()=>action.ValidateReceipt(bad));}
            receipt["spentXp"]=1001L;Assert.Throws<InvalidDataException>(()=>action.ValidateReceipt(receipt));
            Assert.True(UomdSavedAction.DefinitiveRejection("gear_changed"));Assert.False(UomdSavedAction.DefinitiveRejection("busy"));
        }
    }
}
