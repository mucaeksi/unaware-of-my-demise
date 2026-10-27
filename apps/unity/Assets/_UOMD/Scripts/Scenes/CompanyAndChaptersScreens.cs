#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.UI;

namespace Uomd.Scenes
{
    /// <summary>
    /// The hub of the account-backed features (port of HomeScene.ts, base-content grid). Before the first chapter patch
    /// ships a world map (D-29) the hub is a 4×3 grid of feature tiles; SUMMON carries the featured banner's key art.
    /// The world-map hub variant is ported with the first chapter patch that ships world/world_map.json.
    /// </summary>
    public sealed class HomeScreen : UomdHubScreen
    {
        private static readonly (float, Color)[] TileScrim =
        {
            (0f, new Color(0.031f, 0.020f, 0.055f, 0.88f)), (0.54f, new Color(0.031f, 0.020f, 0.055f, 0.68f)),
            (1f, new Color(0.031f, 0.020f, 0.055f, 0.28f))
        };

        private readonly struct Tile
        {
            public readonly string Label, Sub;
            public readonly UomdScreenId Screen;
            public Tile(string label, string sub, UomdScreenId screen) { Label = label; Sub = sub; Screen = screen; }
        }

        public HomeScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Home;
        protected override string Heading => "THE COMPANY";
        protected override bool NeedsSignIn => false;
        protected override UomdScreenId BackTo => UomdScreenId.Title;

        protected override async Awaitable BuildAsync(int generation)
        {
            Router.Audio.PlayBgmCue("bgm_main_theme");
            var api = Router.Api;
            var tiles = new[]
            {
                new Tile("SUMMON", "Banners, rates, pity", UomdScreenId.Summon),
                new Tile("ROSTER", "Your company", UomdScreenId.Roster),
                new Tile("TEAM", "Formation and presets", UomdScreenId.Team),
                new Tile("ERRANDS", "Daily and weekly", UomdScreenId.Tasks),
                new Tile("DEEDS", "Achievements and events", UomdScreenId.Deeds),
                new Tile("TRIALS", "Arena and endless corridor", UomdScreenId.Trials),
                new Tile("ARMORY", "Weapons and relics", UomdScreenId.Gear),
                new Tile("MAIL", "Rewards and notices", UomdScreenId.Mail),
                new Tile("SHOP", "Offers and ads", UomdScreenId.Shop),
                new Tile("PROFILE", "Title and leaderboards", UomdScreenId.Profile),
                new Tile("ACCOUNT", api.IsSignedIn ? "Signed in" : "Sign in", UomdScreenId.Account),
                new Tile("ACTIONS", "Pending results and history", UomdScreenId.Operations)
            };
            Button? summon = null;
            for (int i = 0; i < tiles.Length; i++)
            {
                var tile = tiles[i];
                float tx = RefW / 2f - 690f + (i % 4) * 460f;
                float ty = 290f + (i / 4) * 215f;
                var button = Button(tx, ty, tile.Label, tile.Sub, 430, 190, 40, i == 0 ? UomdPanelVariant.Hot : UomdPanelVariant.Normal, () => _ = Router.NavigateToAsync(tile.Screen));
                if (i == 0) summon = button;
            }
            if (summon != null) UomdScreenKit.SetArtBackdrop(summon, Router.Media, Router.Media.Catalog.Ui("banner_hall_of_ancestors"), TileScrim);
            Button(RefW / 2f, 1000f, "NOTICES", null, 440, 110, 32, UomdPanelVariant.Normal, () => _ = Router.NavigateToAsync(UomdScreenId.ContentPanel));
            Button(RefW - 330f, 1000f, "ARCHIVE", null, 440, 110, 32, UomdPanelVariant.Normal, () => _ = Router.NavigateToAsync(UomdScreenId.Library));
            Text(RefW / 2f, 866f, api.IsSignedIn ? "Your progress, wallet and rolls are kept on the server." : "Sign in to keep your progress, wallet and rolls on the server.", 34, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            if (summon != null) _ = SyncBannerSpotlightAsync(generation, summon);
            try
            {
                var flags = JsonRead.Obj(await api.GetJsonAsync("/api/v1/flags", requireAuth: false), "flags");
                if (!IsCurrent(generation)) return;
                if (JsonRead.Bool(JsonRead.Get(flags, "maintenance.read_only"), "enabled"))
                    Notice("The servers are in maintenance: some actions may be refused.", UomdThemeTokens.Crimson);
            }
            catch (Exception)
            {
                if (IsCurrent(generation)) Notice("Offline: server features are unavailable.", UomdThemeTokens.TextDim);
            }
        }

        private void Notice(string text, Color color) => Text(RefW / 2f, 914f, text, 34, color, 0.5f, 0.5f);

        /// <summary>The live featured banner's key art on the SUMMON tile; offline it keeps the Hall of Ancestors plate.</summary>
        private async Awaitable SyncBannerSpotlightAsync(int generation, Button summon)
        {
            try
            {
                var banners = await Router.Api.GetBannersAsync(Router.Patch.ActiveReleaseId);
                if (!IsCurrent(generation) || banners == null || banners.Length == 0) return;
                // JsonUtility fills an absent `featured` with a default object, so a real rule also has a chance
                bool Fixed(Uomd.Contracts.BannerInfoDto b) => b.featured != null && b.featured.chance > 0 && b.featured.targetMode != "selectable";
                var featured = banners.FirstOrDefault(b => b.kind == "character" && Fixed(b)) ?? banners.FirstOrDefault(Fixed) ?? banners[0];
                var catalog = Router.Media.Catalog;
                string? path = (string.IsNullOrEmpty(featured.artKey) ? null : catalog.Ui(featured.artKey!)) ?? catalog.Ui($"banner_{featured.id}");
                if (path != null) UomdScreenKit.SetArtBackdrop(summon, Router.Media, path, TileScrim);
            }
            catch (Exception)
            {
                // offline or not signed in: the default plate stays
            }
        }
    }

    /// <summary>
    /// The campaign list (port of ChaptersScene.ts): chapters, their nodes, stars and the chapter star track. Scrolls
    /// natively. A signed-in player's progress comes from GET /api/v1/progress; a signed-out one sees the device's.
    /// </summary>
    public sealed class ChaptersScreen : UomdHubScreen
    {
        private const float Top = 140f;
        private static readonly Dictionary<string, int> RationCost = new Dictionary<string, int>(StringComparer.Ordinal)
        {
            ["tutorial"] = 0, ["campaign"] = 6, ["material_hunt"] = 8, ["gear_dungeon"] = 10, ["special_boss"] = 10
        };
        /// <summary>D-29 Hard mode: the variant the list shows, kept for the session; offered only when the content has Hard stages.</summary>
        private static bool _hard;

        public ChaptersScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Chapters;
        protected override string Heading => "CHAPTERS & STAR REWARDS";
        protected override bool NeedsSignIn => false;
        protected override bool UsesWallet => false;
        protected override UomdScreenId BackTo => UomdScreenId.Title;

        protected override async Awaitable BuildAsync(int generation)
        {
            var api = Router.Api;
            string account = api.AccountKey;
            var index = UomdJson.ParseObject(await Router.Patch.ReadTextAsync("chapters/chapter_index.json"));
            var baseNodes = new HashSet<string>(StringComparer.Ordinal);
            try
            {
                var baseIndex = UomdJson.ParseObject(await Router.Patch.ReadBaseTextAsync("chapters/chapter_index.json"));
                foreach (var ch in JsonRead.Objects(baseIndex, "chapters"))
                    foreach (var n in JsonRead.Objects(ch, "nodes")) baseNodes.Add(JsonRead.Str(n, "node_id"));
            }
            catch (Exception)
            {
                // no base index to compare against: nothing is marked NEW
            }
            var progress = UomdLocalProgress.Load();
            if (api.IsSignedIn)
            {
                try
                {
                    var server = await api.GetJsonAsync("/api/v1/progress");
                    progress = new Dictionary<string, int>(StringComparer.Ordinal);
                    foreach (var n in JsonRead.Objects(server, "nodes"))
                        if (JsonRead.Int(n, "clears") > 0) progress[JsonRead.Str(n, "node_id")] = (int)JsonRead.Int(n, "stars");
                }
                catch (Exception)
                {
                    if (!IsCurrent(generation)) return;
                    Text(RefW / 2f, RefH / 2f, "Story progress could not be loaded", 44, UomdThemeTokens.Crimson, 0.5f, 0.5f, display: true);
                    Button(RefW / 2f, RefH / 2f + 180f, "RETRY", null, 520, 120, 32, UomdPanelVariant.Normal, () => _ = RefreshAsync());
                    return;
                }
            }
            if (!IsCurrent(generation) || account != api.AccountKey) return;
            string active = Router.Patch.ActiveReleaseId;
            var chapters = JsonRead.Objects(index, "chapters").ToList();
            bool hasHard = chapters.Any(ch => JsonRead.Objects(ch, "nodes").Any(n => JsonRead.Str(n, "difficulty") == "hard"));
            if (!hasHard) _hard = false;
            else
            {
                Button(RefW - 420f, HeadY, "NORMAL", null, 200, 64, 24, _hard ? UomdPanelVariant.Dim : UomdPanelVariant.Hot, () => { _hard = false; _ = RefreshAsync(); });
                Button(RefW - 200f, HeadY, "HARD", null, 200, 64, 24, _hard ? UomdPanelVariant.Hot : UomdPanelVariant.Dim, () => { _hard = true; _ = RefreshAsync(); });
            }

            bool entryDone = Router.Patch.EntryCompleted;
            bool hasCampaign = chapters.Any(ch => JsonRead.Str(ch, "chapter_id") != "tutorial");
            var rows = new List<Action<VisualElement>>();
            float y = 240f, firstOpen = -1f;
            foreach (var ch in chapters)
            {
                var nodes = JsonRead.Objects(ch, "nodes").Where(n => (JsonRead.Str(n, "difficulty") == "hard") == _hard).ToList();
                if (nodes.Count == 0) continue;
                bool isTutorial = JsonRead.Str(ch, "chapter_id") == "tutorial";
                bool revealed = (isTutorial && entryDone) || nodes.Any(n => progress.ContainsKey(JsonRead.Str(n, "node_id")) || JsonRead.Str(n, "requires") == "" || progress.ContainsKey(JsonRead.Str(n, "requires")));
                string title = JsonRead.Str(ch, "title_en");
                string heading = isTutorial && entryDone ? $"{title} · Replay" : revealed ? title : "Locked chapter";
                var battleNodes = nodes.Where(n => JsonRead.Str(n, "kind") == "battle").ToList();
                int maxStars = Math.Max(3, battleNodes.Count * 3);
                int earned = battleNodes.Sum(n => progress.TryGetValue(JsonRead.Str(n, "node_id"), out int s) ? s : 0);
                float headY = y - 16f - Top;
                rows.Add(sc =>
                {
                    Fit(Text(310f, headY, heading.ToUpperInvariant(), 32, UomdThemeTokens.Gold, 0f, 0.5f, display: true, into: sc), 560f);
                    if (revealed && battleNodes.Count > 0) StarBar(sc, headY, earned, maxStars);
                });
                y += 82f;
                foreach (var node in nodes)
                {
                    bool replay = isTutorial && entryDone;
                    string id = JsonRead.Str(node, "node_id"), requires = JsonRead.Str(node, "requires");
                    if ((!isTutorial || !hasCampaign) && firstOpen < 0f && !progress.ContainsKey(id) && !(requires != "" && !progress.ContainsKey(requires))) firstOpen = y;
                    float rowY = y - Top;
                    string? patchedBy = baseNodes.Count == 0 || baseNodes.Contains(id) ? null : active;
                    rows.Add(sc => Row(sc, node, rowY, progress, patchedBy, replay));
                    y += 160f;
                }
                y += 24f;
            }
            var content = Scroll(0f, Top, RefW, RefH - Top, y + 160f - Top);
            foreach (var row in rows) row(content);
            float scrollTo = Mathf.Max(0f, (firstOpen < 0f ? 0f : firstOpen) - 420f);
            if (content.GetFirstAncestorOfType<ScrollView>() is ScrollView view) view.schedule.Execute(() => view.scrollOffset = new Vector2(0f, scrollTo)).StartingIn(1);
        }

        private void StarBar(VisualElement sc, float y, int earned, int max)
        {
            int t1 = Math.Max(1, (int)Math.Ceiling(max / 3.0));
            int t2 = Math.Max(2, (int)Math.Ceiling(max * 2 / 3.0));
            var tiers = new[] { (t1, "150 Silver"), (t2, "300 Silver"), (max, "1 Calling Ember") };
            float x = RefW / 2f + 230f;
            var pill = Box(x - 370f, y - 25f, 740f, 50f, new Color(0.078f, 0.043f, 0.118f, 0.52f), sc);
            pill.style.borderTopLeftRadius = pill.style.borderTopRightRadius = pill.style.borderBottomLeftRadius = pill.style.borderBottomRightRadius = 25;
            pill.style.borderTopWidth = pill.style.borderBottomWidth = pill.style.borderLeftWidth = pill.style.borderRightWidth = 1.5f;
            var edge = new Color(0.722f, 0.592f, 0.353f, 0.48f);
            pill.style.borderTopColor = pill.style.borderBottomColor = pill.style.borderLeftColor = pill.style.borderRightColor = edge;
            string tierText = string.Join("   ·   ", tiers.Select((t, i) => $"{(earned >= t.Item1 ? "★" : "☆")}{t.Item1} Tier {i + 1} ({t.Item2})"));
            Fit(Text(x, y, $"CHAPTER STARS: {earned}/{max}★   |   {tierText}", 16, earned > 0 ? UomdThemeTokens.Gold : UomdThemeTokens.TextDim, 0.5f, 0.5f, display: true, into: sc), 720f);
        }

        private void Row(VisualElement sc, Dictionary<string, object?> node, float y, Dictionary<string, int> progress, string? patchedBy, bool tutorialReplay)
        {
            string id = JsonRead.Str(node, "node_id"), kind = JsonRead.Str(node, "kind"), requires = JsonRead.Str(node, "requires");
            bool done = progress.TryGetValue(id, out int stars);
            bool locked = !tutorialReplay && requires != "" && !progress.ContainsKey(requires);
            string label = locked ? (kind == "story" ? "Locked story" : "Locked battle") : JsonRead.Str(node, "title_en");
            int cost = RationCost.TryGetValue(JsonRead.Str(node, "ration_class"), out int c) ? c : 0;
            string battleLabel = cost == 0 ? "Free practice · one-time rewards only" : $"Story and battle · {cost} Ration";
            string sub = locked ? "Finish the previous story step first" : kind == "battle" ? battleLabel : "Story";
            Action? tap = locked ? null : () => _ = PlayAsync(node);
            Card(RefW / 2f, y, 1300f, 138f, locked ? UomdPanelVariant.Dim : UomdPanelVariant.Normal, sc, tap);
            Fit(Text(RefW / 2f - 600f, y - 20f, label.ToUpperInvariant(), 38, locked ? UomdThemeTokens.TextDim : UomdThemeTokens.TextPrimary, 0f, 0.5f, display: true, into: sc), 900f);
            Text(RefW / 2f - 600f, y + 28f, sub, 28, UomdThemeTokens.TextDim, 0f, 0.5f, into: sc);
            if (patchedBy != null)
            {
                Card(RefW / 2f + 330f, y - 28f, 250f, 52f, UomdPanelVariant.Hot, sc);
                Fit(Text(RefW / 2f + 330f, y - 28f, $"NEW · {patchedBy}", 20, UomdThemeTokens.Gold, 0.5f, 0.5f, display: true, into: sc), 230f);
            }
            var starText = Text(RefW / 2f + 493f, y + 22f, new string('★', stars) + new string('☆', 3 - Mathf.Clamp(stars, 0, 3)), 38, stars > 0 ? UomdThemeTokens.Gold : new Color(0.353f, 0.290f, 0.400f), 0.5f, 0.5f, into: sc);
            starText.style.letterSpacing = 6;
            if (!locked && !tutorialReplay && kind == "battle" && cost > 0 && done && stars >= 3 && Router.Api.IsSignedIn)
                Button(RefW / 2f + 220f, y + 24f, $"SWEEP ({cost}R)", null, 210, 56, 21, UomdPanelVariant.Normal, () => _ = SweepAsync(id), sc);
        }

        private async Awaitable PlayAsync(Dictionary<string, object?> node)
        {
            bool started = await Router.EntryFlow.PlayNodeAsync(JsonRead.Str(node, "node_id"), JsonRead.Str(node, "kind"), JsonRead.Str(node, "story"), JsonRead.Str(node, "encounter"));
            if (!started) Say("This stage could not be loaded.");
        }

        private async Awaitable SweepAsync(string nodeId)
        {
            try
            {
                await Router.Api.SendJsonAsync("POST", "/api/v1/progress/sweep", new Dictionary<string, object?>
                {
                    ["releaseId"] = Router.Patch.ActiveReleaseId, ["nodeId"] = nodeId, ["count"] = 1L
                });
            }
            catch (Exception e)
            {
                Say(ErrText(e));
            }
            await RefreshAsync();
        }
    }
}
