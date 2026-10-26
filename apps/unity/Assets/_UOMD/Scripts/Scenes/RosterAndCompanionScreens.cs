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

    /// <summary>The owned companions, 12 per page (port of RosterScene.ts).</summary>
    public sealed class RosterScreen : UomdHubScreen
    {
        private const int PerPage = 12;
        private static int _lastPage;
        private readonly List<(string Id, string Name, int Rarity, string Element, string Role, int Copies, int Shards)> _list =
            new List<(string, string, int, string, string, int, int)>();
        private int _total;

        public RosterScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Roster;
        protected override string Heading => "ROSTER";

        protected override async Awaitable BuildAsync(int generation)
        {
            var inventory = await Router.Api.GetJsonAsync("/api/v1/inventory");
            var roster = await HubData.RosterAsync(Router);
            if (!IsCurrent(generation)) return;
            _list.Clear();
            foreach (var item in JsonRead.Objects(inventory, "items"))
            {
                if (JsonRead.Str(item, "item_type") != "character") continue;
                string id = JsonRead.Str(item, "item_id");
                roster.TryGetValue(id, out var meta);
                _list.Add((id, meta != null ? JsonRead.Str(meta, "name_en", id) : id, (int)JsonRead.Int(meta, "rarity"), JsonRead.Str(meta, "element"),
                    JsonRead.Str(meta, "role"), (int)JsonRead.Int(item, "copies"), (int)JsonRead.Int(item, "shards")));
            }
            _list.Sort((a, b) => b.Rarity != a.Rarity ? b.Rarity.CompareTo(a.Rarity) : string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));
            _total = roster.Count;
            Draw();
        }

        private void Draw()
        {
            Body.Clear();
            Button(RefW - 300f, 170f, "INVITATIONS", null, 420, 90, 30, UomdPanelVariant.Normal, () =>
            {
                Router.Session.RecruitReturnTo = UomdScreenId.Roster;
                _ = Router.NavigateToAsync(UomdScreenId.Recruit);
            });
            Text(RefW / 2f, 160f, $"{_list.Count} of {_total} companions", 36, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            int pages = Math.Max(1, (int)Math.Ceiling(_list.Count / (double)PerPage));
            _lastPage = Math.Min(_lastPage, pages - 1);
            if (_list.Count == 0)
            {
                Text(RefW / 2f, 480f, "No companions yet. Invitations and the altar bring them to the company.", 34, UomdThemeTokens.TextDim, 0.5f, 0.5f, wrapWidth: 1200f).style.unityTextAlign = TextAnchor.MiddleCenter;
                return;
            }
            var slice = _list.Skip(_lastPage * PerPage).Take(PerPage).ToList();
            for (int i = 0; i < slice.Count; i++)
            {
                var c = slice[i];
                float x = 340f + (i % 4) * 415f, y = 330f + (i / 4) * 215f;
                var attach = UomdCompanionAttachment.Describe(c.Id, c.Element, c.Role);
                string id = c.Id;
                Card(x, y, 390f, 190f, c.Rarity == 5 ? UomdPanelVariant.Hot : UomdPanelVariant.Normal, onTap: () =>
                {
                    Router.Session.SelectedUnitId = id;
                    _ = Router.NavigateToAsync(UomdScreenId.Character);
                });
                var gold = new Color(1f, 0.847f, 0.420f);
                Fit(Text(x, y - 56f, c.Name, 32, c.Rarity == 5 ? gold : UomdThemeTokens.TextPrimary, 0.5f, 0.5f, display: true), 350f);
                Text(x, y - 16f, HubData.Stars(c.Rarity), 30, gold, 0.5f, 0.5f);
                Fit(Text(x, y + 18f, c.Rarity > 0 ? $"{c.Element} · {c.Role.Replace('_', ' ')} ({attach.FormationSlot})" : "Unavailable in this version", 21, UomdThemeTokens.TextDim, 0.5f, 0.5f), 360f);
                Fit(Text(x, y + 48f, attach.BondTitle, 18, UomdThemeTokens.Gold, 0.5f, 0.5f), 360f);
                Text(x, y + 74f, c.Copies > 1 || c.Shards > 0 ? $"copies {c.Copies} · shards {c.Shards}" : "tap for details", 20, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            }
            if (pages > 1)
            {
                Button(RefW / 2f - 220f, 960f, "‹", null, 160, 100, 56, UomdPanelVariant.Normal, () => { _lastPage = (_lastPage + pages - 1) % pages; Draw(); });
                Text(RefW / 2f, 960f, $"{_lastPage + 1} / {pages}", 36, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
                Button(RefW / 2f + 220f, 960f, "›", null, 160, 100, 56, UomdPanelVariant.Normal, () => { _lastPage = (_lastPage + 1) % pages; Draw(); });
            }
        }
    }

    /// <summary>
    /// One companion (port of CharacterScene.ts): level and ascension with the pre-action planner, memory resonance, skill
    /// ranks, final stats and the four gear slots. The portrait stands behind the card; the chibi pose preview is not ported.
    /// </summary>
    public sealed class CompanionScreen : UomdHubScreen
    {
        private static readonly string[] Slots = { "weapon", "armor", "necklace", "ring" };
        private string _id = "";
        private string _expression = "composed";
        private string _lastOutcome = "";

        public CompanionScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Character;
        protected override string Heading => "COMPANION";
        protected override UomdScreenId BackTo => UomdScreenId.Roster;

        protected override async Awaitable BuildAsync(int generation)
        {
            string id = Router.Session.SelectedUnitId ?? "";
            if (id != _id)
            {
                _id = id;
                _lastOutcome = "";
                _expression = "composed";
            }
            var api = Router.Api;
            string release = HubData.Release(Router);
            var mine = await api.GetJsonAsync($"/api/v1/characters/mine?releaseId={release}");
            var roster = await HubData.RosterAsync(Router);
            var catalog = await HubData.CatalogAsync(Router);
            var have = await HubData.StacksAsync(Router);
            var gear = await HubData.GearAsync(Router);
            Dictionary<string, object?>? stats = null;
            try { stats = await api.GetJsonAsync($"/api/v1/characters/{Uri.EscapeDataString(_id)}/stats?releaseId={release}"); }
            catch (Exception) { /* stats are optional */ }
            if (!IsCurrent(generation)) return;

            var raw = JsonRead.Objects(mine, "characters").FirstOrDefault(x => JsonRead.Str(x, "id") == _id);
            if (raw == null || !roster.TryGetValue(_id, out var meta))
            {
                bool unavailable = JsonRead.Objects(mine, "unavailable").Any(x => JsonRead.Str(x, "id") == _id);
                Text(RefW / 2f, 400f, unavailable ? "This companion is unavailable in this content version. Your ownership is preserved." : "You do not own this companion.",
                    40, UomdThemeTokens.TextPrimary, 0.5f, 0.5f, wrapWidth: 1400f).style.unityTextAlign = TextAnchor.MiddleCenter;
                return;
            }
            var c = CharacterView.From(raw);
            int rarity = (int)JsonRead.Int(meta, "rarity");
            int accountLevel = (int)JsonRead.Int(JsonRead.Obj(mine, "account"), "level", 1);
            var attach = UomdCompanionAttachment.Describe(_id, JsonRead.Str(meta, "element"), JsonRead.Str(meta, "role"));
            string currency = CurrencyName;
            var gold = new Color(1f, 0.847f, 0.420f);
            var heal = new Color(0.494f, 0.851f, 0.596f);

            Portrait();
            if (_lastOutcome.Length > 0) Text(RefW / 2f, 134f, _lastOutcome, 22, heal, 0.5f, 0.5f, wrapWidth: 1560f).style.unityTextAlign = TextAnchor.MiddleCenter;
            Card(520f, 442f, 880f, 548f, rarity == 5 ? UomdPanelVariant.Hot : UomdPanelVariant.Normal);
            Fit(Text(520f, 206f, JsonRead.Str(meta, "name_en", _id), 48, rarity == 5 ? gold : UomdThemeTokens.TextPrimary, 0.5f, 0.5f, display: true), 560f);
            Fit(Text(520f, 254f, $"{HubData.Stars(rarity)}   {attach.TacticalBadge}   ·   Account Lv {accountLevel}", 23, UomdThemeTokens.TextDim, 0.5f, 0.5f), 840f);
            Centered(Text(520f, 288f, $"{attach.BondTitle}: {attach.BondLine}", 19, UomdThemeTokens.Gold, 0.5f, 0.5f, wrapWidth: 840f));
            if (attach.Expressions.Length > 1)
                Button(850f, 206f, $"EXPR: {_expression.ToUpperInvariant()}", null, 196, 44, 16, UomdPanelVariant.Normal, () =>
                {
                    _expression = UomdCompanionAttachment.NextExpression(_id, _expression);
                    _ = RefreshAsync();
                });
            Text(520f, 330f, $"Level {c.Level} / {c.Cap}    Ascension {c.Ascension}", 36, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
            Text(520f, 372f, c.XpToNext == null ? "Maximum level" : $"XP {c.Xp} / {c.XpToNext}", 25, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            StatLines(stats);

            var lv = UomdGrowth.PlanLevelUp(c, accountLevel, Balance, have, catalog.XpItems, catalog.Progression, currency, catalog.Name);
            var asc = UomdGrowth.PlanAscension(c, accountLevel, Balance, have, null, currency, catalog.Name);
            Centered(Text(520f, 474f, $"Level-Up Plan: {lv.CostSummary}  ·  {(lv.CanExecute ? lv.ResultSummary : lv.Reason)}", 20, lv.CanExecute ? UomdThemeTokens.TextPrimary : UomdThemeTokens.TextDim, 0.5f, 0.5f, wrapWidth: 840f));
            Centered(Text(520f, 514f, $"Ascend Plan: {asc.CostSummary}  ·  {(asc.CanExecute ? asc.ResultSummary : asc.Reason)}", 20, asc.CanExecute ? UomdThemeTokens.TextPrimary : UomdThemeTokens.TextDim, 0.5f, 0.5f, wrapWidth: 840f));

            var levelUp = Button(340f, 600f, "LEVEL UP", lv.CanExecute ? $"Lv {lv.FromLevel}→{lv.ToLevel} · {lv.Fee} {currency}" : StripBlocked(lv.Reason), 400, 120, 30, UomdPanelVariant.Hot, () => _ = ActAsync(async () =>
            {
                if (lv.XpItem == null) return;
                var item = lv.XpItem.Value;
                var r = await api.SendJsonAsync("POST", $"/api/v1/characters/{Uri.EscapeDataString(_id)}/level-up", new Dictionary<string, object?>
                {
                    ["items"] = new List<object?> { new Dictionary<string, object?> { ["itemId"] = item.ItemId, ["quantity"] = 1L } },
                    ["releaseId"] = Router.Patch.ActiveReleaseId
                });
                long level = JsonRead.Int(r, "level", lv.ToLevel);
                _lastOutcome = $"Last Action: Level {lv.FromLevel} → {level} (+{JsonRead.Int(r, "gainedXp", item.Xp)} XP, waste {JsonRead.Int(r, "wastedXp", lv.WastedXp)} XP) · Spent 1 {item.Name} & {JsonRead.Int(JsonRead.Obj(r, "spent"), "fee", lv.Fee)} {currency} · Wallet {JsonRead.Int(r, "balance", lv.BalanceAfter)}";
                Say($"Level {lv.FromLevel} → {level}");
            }));
            UomdScreenKit.SetEnabled(levelUp, lv.CanExecute, UomdPanelVariant.Hot);
            var ascend = Button(700f, 600f, "ASCEND", asc.CanExecute ? $"Cap {asc.FromCap}→{asc.ToCap} · {asc.Fee} {currency}" : StripBlocked(asc.Reason), 400, 120, 30, UomdPanelVariant.Normal, () => _ = ActAsync(async () =>
            {
                var r = await api.SendJsonAsync("POST", $"/api/v1/characters/{Uri.EscapeDataString(_id)}/ascend", new Dictionary<string, object?> { ["releaseId"] = Router.Patch.ActiveReleaseId });
                _lastOutcome = $"Last Action: Ascension {asc.FromAscension} → {JsonRead.Int(r, "ascension", asc.ToAscension)} (Cap Lv {asc.FromCap} → {JsonRead.Int(r, "newCap", asc.ToCap)}) · Fee {JsonRead.Int(JsonRead.Obj(r, "spent"), "fee", asc.Fee)} {currency} · Wallet {JsonRead.Int(r, "balance", asc.BalanceAfter)}";
                Say("Ascended");
            }));
            UomdScreenKit.SetEnabled(ascend, asc.CanExecute);
            if (c.NextAscension != null)
            {
                string items = string.Join("  ·  ", c.NextAscension.Items.Select(i => $"{catalog.Name(i.ItemId)} {(have.TryGetValue(i.ItemId, out int q) ? q : 0)}/{i.Quantity}"));
                Fit(Text(520f, 676f, $"{(items.Length > 0 ? items + "  ·  " : "")}{Math.Ceiling(c.NextAscension.Fee)} {currency}", 20, UomdThemeTokens.TextDim, 0.5f, 0.5f), 860f);
            }
            Resonance(c, stats, catalog);
            Skills(c, have, catalog, currency, heal);
            GearSlots(gear);
        }

        private static string StripBlocked(string reason) => reason.StartsWith("Blocked:", StringComparison.OrdinalIgnoreCase) ? reason.Substring(8).TrimStart() : reason;

        private static Label Centered(Label label)
        {
            label.style.unityTextAlign = TextAnchor.MiddleCenter;
            return label;
        }

        private void Portrait()
        {
            string? path = Router.Media.Catalog.Portrait(_id, _expression) ?? Router.Media.Catalog.Portrait(_id, "composed");
            if (path == null) return;
            var image = UomdScreenKit.Image(Body, Router.Media, path, 587f, 880f, ScaleMode.ScaleToFit);
            image.style.opacity = 0.42f;
            Place(image, 170f, RefH + 20f, 0.5f, 1f);
        }

        private void StatLines(Dictionary<string, object?>? st)
        {
            var s = JsonRead.Obj(st, "stats");
            var derived = new[] { "hp", "atk", "def", "spd" }.Select(k => $"{k.ToUpperInvariant()} {Math.Round(JsonRead.Num(s, k))}").ToList();
            if (JsonRead.Get(st, "attributes") is Dictionary<string, object?> a)
            {
                // D-27: the four attributes, the power one marked, then what they make
                string power = JsonRead.Str(st, "power");
                string attrs = string.Join("    ", new[] { "str", "int", "vit", "agi" }.Select(k => $"{k.ToUpperInvariant()} {JsonRead.Int(a, k)}{(k == power ? " ◆" : "")}"));
                Text(520f, 414f, attrs, 30, UomdThemeTokens.Gold, 0.5f, 0.5f);
                derived.Add($"CRIT {Math.Round(JsonRead.Num(s, "crit_rate") * 100)}%");
                Text(520f, 448f, string.Join("   ", derived), 21, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            }
            else Text(520f, 424f, string.Join("    ", derived), 32, UomdThemeTokens.Gold, 0.5f, 0.5f);
        }

        private void Resonance(CharacterView c, Dictionary<string, object?>? st, HubData.Catalog catalog)
        {
            var res = c.Resonance;
            if (res == null) return;
            bool attributes = JsonRead.Get(st, "attributes") != null;
            string bonus = ResonanceText(res.Tier, res.BonusPct, attributes);
            Fit(Text(520f, 710f, $"Memory Shards: {c.Shards}  ·  Resonance {res.Tier}/{res.MaxTier} ({bonus}, optional keepsake)", 19, UomdThemeTokens.Gold, 0.5f, 0.5f), 860f);
            bool canAttune = res.NextShardCost != null && c.Shards >= res.NextShardCost;
            if (canAttune)
                Button(360f, 750f, $"ATTUNE ({res.NextShardCost})", null, 280, 52, 20, UomdPanelVariant.Normal, () => _ = ActAsync(async () =>
                {
                    var r = await Router.Api.SendJsonAsync("POST", $"/api/v1/characters/{Uri.EscapeDataString(_id)}/shards/attune", new Dictionary<string, object?> { ["releaseId"] = Router.Patch.ActiveReleaseId });
                    var after = JsonRead.Obj(r, "resonance");
                    long tier = JsonRead.Int(after, "tier");
                    _lastOutcome = $"Last Action: Memory Resonance Tier {tier}/{JsonRead.Int(after, "maxTier")} ({ResonanceText((int)tier, JsonRead.Num(after, "bonusPct"), attributes)}) · Spent {JsonRead.Int(r, "spentShards")} Memory Shards";
                    Say($"Resonance Tier {tier}");
                }));
            if (res.ExcessShards > 0)
                Button(canAttune ? 680f : 520f, 750f, $"EXCHANGE {res.ExcessShards} EXCESS", null, 300, 52, 20, UomdPanelVariant.Normal, () => _ = ActAsync(async () =>
                {
                    var r = await Router.Api.SendJsonAsync("POST", $"/api/v1/characters/{Uri.EscapeDataString(_id)}/shards/convert", new Dictionary<string, object?>
                    {
                        ["shards"] = (long)res.ExcessShards, ["releaseId"] = Router.Patch.ActiveReleaseId
                    });
                    long converted = JsonRead.Int(r, "convertedShards");
                    _lastOutcome = $"Last Action: Converted {converted} excess Memory Shards into {converted} {catalog.Name(res.ExcessItemId)}";
                    Say("Excess shards exchanged");
                }));
        }

        /// <summary>D-27 heroes resonate in whole points (@uomd/economy resonancePoints), legacy catalogs in percent.</summary>
        private static string ResonanceText(int tier, double bonusPct, bool attributes)
        {
            if (!attributes) return $"+{bonusPct.ToString(CultureInfo.InvariantCulture)}% HP/ATK/DEF";
            int t = Math.Max(0, tier);
            return $"+{(t + 1) / 2} VIT, +{t / 2} POWER"; // packages/economy attributes.ts: vit ceil(t/2), power floor(t/2)
        }

        private void Skills(CharacterView c, IReadOnlyDictionary<string, int> have, HubData.Catalog catalog, string currency, Color heal)
        {
            Text(1380f, 175f, "SKILLS", 34, UomdThemeTokens.Gold, 0.5f, 0.5f, display: true);
            for (int i = 0; i < c.Skills.Count; i++)
            {
                var sk = c.Skills[i];
                float y = 248f + i * 116f;
                var plan = UomdGrowth.PlanSkillUpgrade(sk, c.Level, Balance, have, currency, catalog.Name);
                Card(1380f, y, 820f, 104f, UomdPanelVariant.Dim);
                Fit(Text(995f, y - 24f, $"{sk.Name}  ({sk.Type} · Rank {sk.Rank}/{sk.MaxRank})", 25, UomdThemeTokens.TextPrimary, 0f, 0.5f), 520f);
                Fit(Text(995f, y + 6f, plan.CostSummary, 19, UomdThemeTokens.TextDim, 0f, 0.5f), 520f);
                Fit(Text(995f, y + 31f, plan.CanExecute ? plan.ResultSummary : plan.Reason, 19, plan.CanExecute ? heal : UomdThemeTokens.Crimson, 0f, 0.5f), 520f);
                var skill = sk;
                var rank = Button(1655f, y, sk.Next != null ? "RANK UP" : "MAX", sk.Next != null ? $"Rank {sk.Rank}→{sk.Next.Rank}" : null, 220, 84, 24, UomdPanelVariant.Normal, () => _ = ActAsync(async () =>
                {
                    var r = await Router.Api.SendJsonAsync("POST", $"/api/v1/characters/{Uri.EscapeDataString(_id)}/skills/{Uri.EscapeDataString(skill.SkillId)}/upgrade", new Dictionary<string, object?> { ["releaseId"] = Router.Patch.ActiveReleaseId });
                    _lastOutcome = $"Last Action: {skill.Name} Rank {plan.FromRank} → {JsonRead.Int(r, "rank", plan.ToRank)}/{skill.MaxRank} · Fee {JsonRead.Int(JsonRead.Obj(r, "spent"), "fee", plan.Fee)} {currency} · Wallet {JsonRead.Int(r, "balance", plan.BalanceAfter)}";
                    Say($"{skill.Name} improved");
                }));
                UomdScreenKit.SetEnabled(rank, plan.CanExecute);
            }
        }

        private void GearSlots(List<Dictionary<string, object?>> gear)
        {
            for (int i = 0; i < Slots.Length; i++)
            {
                string slot = Slots[i];
                float x = 330f + i * 330f;
                var g = gear.FirstOrDefault(p => JsonRead.Str(p, "slot") == slot && JsonRead.Str(p, "equippedBy") == _id);
                Card(x, 855f, 310f, 150f, g != null ? UomdPanelVariant.Normal : UomdPanelVariant.Dim);
                Text(x, 808f, slot.ToUpperInvariant(), 22, UomdThemeTokens.TextDim, 0.5f, 0.5f);
                Fit(Text(x, 852f, g != null ? $"{JsonRead.Str(g, "name")} (Lv {JsonRead.Int(g, "level")}/{JsonRead.Int(g, "levelCap")})" : "— empty —", 24, g != null ? UomdThemeTokens.TextPrimary : UomdThemeTokens.TextDim, 0.5f, 0.5f), 280f);
                Button(x, 926f, "CHANGE", null, 200, 56, 22, UomdPanelVariant.Normal, () =>
                {
                    Router.Session.GearCharacterId = _id;
                    Router.Session.GearSlot = slot;
                    _ = Router.NavigateToAsync(UomdScreenId.Gear);
                });
            }
        }
    }
}
