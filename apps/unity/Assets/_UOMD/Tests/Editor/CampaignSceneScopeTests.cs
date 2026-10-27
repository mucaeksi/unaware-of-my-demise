using System;
using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using Uomd.Contracts;
using Uomd.Core;
using Uomd.Scenes;

namespace Uomd.Tests
{
    public sealed class CampaignSceneScopeTests
    {
        [TestCase(false)]
        [TestCase(true)]
        public void RebindingCoordinatorCannotMakeAnOlderSceneCurrent(bool anotherAccount)
        {
            var host = new GameObject("Campaign scope fixture");
            try
            {
                var router = host.AddComponent<UomdSceneRouter>();
                var api = new UomdApiClient("http://127.0.0.1:1");
                typeof(UomdSceneRouter).GetProperty("Api").SetValue(router, api);
                string player = "scope_fixture_" + Guid.NewGuid().ToString("N");
                api.AdoptSession(new SessionDto { token = "isolated-fixture", playerId = player, expiresAt = "2099-01-01T00:00:00Z" });
                var flow = new UomdEntryFlow(router);
                flow.Campaign.BindAsync().GetAwaiter().GetResult(); // Stable identity: no await/network/storage write.
                typeof(UomdEntryFlow).GetField("_campaignNode", BindingFlags.Instance | BindingFlags.NonPublic).SetValue(flow, "t1");
                typeof(UomdEntryFlow).GetField("_campaignScope", BindingFlags.Instance | BindingFlags.NonPublic).SetValue(flow, flow.Campaign.CallbackScope);
                string original = flow.CallbackScope;
                Assert.True(flow.CampaignIsCurrent);
                api.AdoptSession(new SessionDto { token = "isolated-new-revision", playerId = anotherAccount ? player + "_b" : player, expiresAt = "2099-01-01T00:00:00Z" });
                flow.Campaign.BindAsync().GetAwaiter().GetResult();
                Assert.True(flow.Campaign.IsCurrent, "The coordinator can serve its newly bound account.");
                Assert.False(flow.CampaignIsCurrent, "The old scene must keep its captured account/revision.");
                Assert.AreEqual(original, flow.CallbackScope);
            }
            finally { UnityEngine.Object.DestroyImmediate(host); }
        }
    }
}
