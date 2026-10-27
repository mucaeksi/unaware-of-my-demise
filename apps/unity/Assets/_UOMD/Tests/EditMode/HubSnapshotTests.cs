#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using Uomd.Core;

namespace Uomd.Tests
{
    public sealed class HubSnapshotTests
    {
        [Test] public void SweepRequiresPublishedEligibilityExplicitFlagUsageAndEnoughRation()
        {
            var s = Published(); Account(s); var node = s.Nodes.Single(n => n.Kind == "battle");
            s.Progress[node.Id] = (3,1); Assert.False(s.CanSweep(node,1));
            s.SweepEnabled = true; s.SweepDailyLimit = 20; s.SweepMaxBatch = 10;
            Assert.True(s.CanSweep(node,10)); s.SweepUsage[node.Id] = 19; Assert.False(s.CanSweep(node,5)); Assert.True(s.CanSweep(node,1));
            s.Ration = 0; Assert.False(s.CanSweep(node,1)); s.Ration = 114;
            s.Progress[node.Id] = (2,1); Assert.False(s.CanSweep(node,1));
            s.Progress[node.Id] = (3,1); node.Cost = 0; Assert.False(s.CanSweep(node,1));
        }
        private const string Index = "{\"chapters\":[{\"chapter_id\":\"chapter_one\",\"title_en\":\"Before the Road\",\"nodes\":[{\"node_id\":\"story_one\",\"title_en\":\"Story\",\"kind\":\"story\",\"story\":\"story/one.json\"},{\"node_id\":\"battle_one\",\"title_en\":\"Battle\",\"kind\":\"battle\",\"encounter\":\"encounters/one.json\",\"requires\":\"story_one\",\"ration_class\":\"campaign\"},{\"node_id\":\"story_two\",\"title_en\":\"After\",\"kind\":\"story\",\"story\":\"story/two.json\",\"requires\":\"battle_one\"}]}]}";
        private static Dictionary<string, object?> Parse(string json) => UomdJson.ParseObject(json);
        private static UomdHubSnapshot Published() => UomdHubSnapshot.Published("rel_0001", Parse(Index));
        private static void Account(UomdHubSnapshot s, string wallet = "{\"wallets\":{\"eclipse_token\":1234}}", string progress = "{\"nodes\":[{\"node_id\":\"story_one\",\"stars\":0,\"clears\":1}],\"ration\":{\"value\":114,\"cap\":120}}", bool maintenance = false)
        {
            s.Account(Parse("{\"id\":\"fixture_player\",\"displayName\":\"Fixture\"}"), Parse(wallet),
                Parse("{\"account\":{\"level\":12},\"characters\":[{\"id\":\"fadyme\",\"level\":10,\"copies\":1,\"shards\":4}],\"unavailable\":[{\"id\":\"retired_hero\",\"reason\":\"retired\"}]}"),
                Parse("{\"characters\":[{\"id\":\"fadyme\",\"name_en\":\"Fadyme\",\"rarity\":5,\"element\":\"Dawn\",\"role\":\"healer\"}]}"),
                Parse("{\"teams\":[{\"slot\":1,\"active\":true,\"name\":\"The Company\",\"members\":[{\"characterId\":\"fadyme\",\"slot\":3,\"row\":\"rear\"}]}]}"), Parse(progress),
                Parse("{\"flags\":{\"maintenance.read_only\":{\"enabled\":" + (maintenance ? "true" : "false") + "}}}"));
        }
        [Test] public void PublishedGuestNeverInventsAccountBalanceOrClears()
        {
            var s = Published(); Assert.IsNull(s.Balance); Assert.False(s.SignedIn); Assert.IsEmpty(s.Progress); Assert.IsEmpty(s.Companions);
            Assert.False(s.CanStart(s.Nodes.First()));
        }
        [Test] public void ProviderRepliesSupplySingleCurrencyOwnedCharactersAndActiveTeam()
        {
            var s = Published(); Account(s);
            Assert.True(s.SignedIn); Assert.AreEqual(1234, s.Balance); Assert.AreEqual(12, s.AccountLevel);
            Assert.AreEqual("Fadyme", s.Companions[0].Name); Assert.AreEqual(10, s.Companions[0].Level); Assert.AreEqual("fadyme", s.Team.Single());
            Assert.False(s.Companions.Single(c => c.Id == "retired_hero").Available);
            Assert.AreEqual("battle_one", s.NextNode?.Id);
        }
        [Test] public void EmptyWalletMeansZeroButMissingWalletEnvelopeFailsClosed()
        {
            var s = Published(); Account(s, "{\"wallets\":{}}"); Assert.AreEqual(0, s.Balance);
            Assert.Throws<InvalidDataException>(() => Account(Published(), "{}"));
            Assert.Throws<InvalidDataException>(() => Account(Published(), "{\"wallets\":{\"eclipse_token\":-1}}"));
            Assert.Throws<InvalidDataException>(() => Account(Published(), "{\"wallets\":{\"eclipse_token\":\"1234\"}}"));
        }
        [Test] public void PrerequisitesMatchProviderStoryClearAndBattleStarRules()
        {
            var s = Published(); Account(s);
            HubNode battle = s.Nodes.Single(n => n.Id == "battle_one"), after = s.Nodes.Single(n => n.Id == "story_two");
            Assert.True(s.Unlocked(battle)); Assert.False(s.Unlocked(after));
            s.Progress["battle_one"] = (0, 1); Assert.False(s.Unlocked(after));
            s.Progress["battle_one"] = (1, 1); Assert.True(s.Unlocked(after));
            battle.Requires = "not_in_release"; Assert.False(s.Unlocked(battle));
        }
        [Test] public void RationMaintenanceAndUnknownCostsNeverPermitAFreeFallback()
        {
            var s = Published(); Account(s); var battle = s.Nodes.Single(n => n.Kind == "battle");
            Assert.AreEqual(6, battle.Cost); Assert.True(s.CanStart(battle));
            s.Ration = 0; Assert.False(s.CanStart(battle)); s.Ration = 114;
            s.Maintenance = true; Assert.False(s.CanStart(battle)); s.Maintenance = false;
            var unknown = UomdHubSnapshot.Published("rel_0001", Parse(Index.Replace("campaign", "unknown_cost")));
            Account(unknown); Assert.AreEqual(-1, unknown.Nodes.Single(n => n.Kind == "battle").Cost); Assert.False(unknown.CanStart(unknown.Nodes.Single(n => n.Kind == "battle")));
        }
        [Test] public void MalformedProgressAndDuplicatePublishedIdsAreRejected()
        {
            Assert.Throws<InvalidDataException>(() => Account(Published(), progress: "{\"nodes\":[],\"ration\":{\"value\":114}}"));
            Assert.Throws<InvalidDataException>(() => Account(Published(), progress: "{\"nodes\":[{\"node_id\":\"battle_one\",\"stars\":4,\"clears\":1}],\"ration\":{\"value\":114,\"cap\":120}}"));
            Assert.Throws<InvalidDataException>(() => UomdHubSnapshot.Published("rel_0001", Parse(Index.Replace("story_two", "story_one"))));
            Assert.Throws<InvalidDataException>(() => UomdHubSnapshot.Published("rel_0001", Parse("{\"chapters\":[null]}")));
            Assert.Throws<InvalidDataException>(() => Account(Published(), progress: "{\"nodes\":[null],\"ration\":{\"value\":114,\"cap\":120}}"));
        }
    }
}
