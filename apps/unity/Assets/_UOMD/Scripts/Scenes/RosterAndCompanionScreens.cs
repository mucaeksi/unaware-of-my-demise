#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.Core.Growth;
using Uomd.UI;

namespace Uomd.Scenes
{
    /// <summary>Shared reads of the account-backed screens (api.ts endpoints over the JSON client).</summary>
    internal static class HubData
    {
        public static string Release(UomdSceneRouter router) => Uri.EscapeDataString(router.Patch.ActiveReleaseId);

        /// <summary>GET /api/v1/characters: the public roster of the release (id, name_en, rarity, element, role).</summary>
        public static async Awaitable<Dictionary<string, Dictionary<string, object?>>> RosterAsync(UomdSceneRouter router)
        {
            var data = await router.Api.GetJsonAsync($"/api/v1/characters?releaseId={Release(router)}", requireAuth: false);
            var byId = new Dictionary<string, Dictionary<string, object?>>(StringComparer.Ordinal);
            foreach (var c in JsonRead.Objects(data, "characters")) byId[JsonRead.Str(c, "id")] = c;
            return byId;
        }

        /// <summary>GET /api/v1/catalog: item and gear names; fills the character-XP items and the progression curve.</summary>
        public static async Awaitable<Catalog> CatalogAsync(UomdSceneRouter router)
        {
            var data = await router.Api.GetJsonAsync($"/api/v1/catalog?releaseId={Release(router)}", requireAuth: false);
            var catalog = new Catalog();
            foreach (var i in JsonRead.Objects(data, "items"))
            {
                string id = JsonRead.Str(i, "item_id");
                catalog.Names[id] = JsonRead.Str(i, "name_en", id);
                if (JsonRead.Str(i, "kind") == "character_xp" && JsonRead.Int(i, "xp_value") > 0) catalog.XpItems.Add((id, (int)JsonRead.Int(i, "xp_value")));
            }
            foreach (var g in JsonRead.Objects(data, "gear")) catalog.Names[JsonRead.Str(g, "gear_id")] = JsonRead.Str(g, "name_en");
            catalog.XpItems.Sort((a, b) => a.Xp.CompareTo(b.Xp));
            catalog.Progression = ProgressionConfig.From(JsonRead.Get(JsonRead.Obj(JsonRead.Obj(data, "config"), "progression"), "character"));
            return catalog;
        }

        /// <summary>GET /api/v1/stacks: owned material quantities.</summary>
        public static async Awaitable<Dictionary<string, int>> StacksAsync(UomdSceneRouter router)
        {
            var data = await router.Api.GetJsonAsync("/api/v1/stacks");
            var have = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var s in JsonRead.Objects(data, "stacks")) have[JsonRead.Str(s, "item_id")] = (int)JsonRead.Int(s, "qty");
            return have;
        }

        /// <summary>GET /api/v1/gear: owned gear pieces.</summary>
        public static async Awaitable<List<Dictionary<string, object?>>> GearAsync(UomdSceneRouter router) =>
            JsonRead.Objects(await router.Api.GetJsonAsync($"/api/v1/gear?releaseId={Release(router)}"), "gear").ToList();

        public sealed class Catalog
        {
            public readonly Dictionary<string, string> Names = new Dictionary<string, string>(StringComparer.Ordinal);
            public readonly List<(string ItemId, int Xp)> XpItems = new List<(string ItemId, int Xp)>();
            public ProgressionConfig Progression = ProgressionConfig.Default;
            public string Name(string id) => Names.TryGetValue(id, out string n) && n.Length > 0 ? n : id;
        }

        public static string Stars(long n) => new string('★', (int)Math.Max(0, n));
    }

    public sealed class RosterScreen : RebuildHubScreen
    {
        public RosterScreen(UomdSceneRouter router) : base(router) { }
        public override UomdScreenId ScreenId => UomdScreenId.Roster;
    }

    public sealed class CompanionScreen : RebuildCompanyScreen
    {
        public CompanionScreen(UomdSceneRouter router) : base(router) { }
        public override UomdScreenId ScreenId => UomdScreenId.Character;
    }
}
