using NUnit.Framework;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Scenes;

namespace Uomd.Tests
{
    public sealed class NativeHubPresentationTests
    {
        [Test] public void NativeHubHasReachableRefreshAccountNavigationAndClosableRoutes()
        {
            var root = Resources.Load<VisualTreeAsset>("Rebuild/Hub").CloneTree();
            foreach (string id in new[] { "hubHome", "hubCompany", "hubChapters", "hubAccount", "hubRefresh", "hubBack", "hubMore", "hubClose" }) Assert.NotNull(root.Q<Button>(id), id);
            Assert.NotNull(root.Q<ScrollView>("hubRoutes")); Assert.True(root.Q("hubOverlay").ClassListContains("is-hidden"));
            Assert.NotNull(root.Q<Label>("hubWallet")); Assert.NotNull(root.Q<Label>("hubStatus"));
        }
    }
}
