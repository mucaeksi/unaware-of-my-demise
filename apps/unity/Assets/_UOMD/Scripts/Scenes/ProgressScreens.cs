#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;
using Uomd.UI;

namespace Uomd.Scenes
{
    /// <summary>Reward and id text shared by the progress screens (format.ts).</summary>
    internal static class HubText
    {
        private static readonly HashSet<string> SmallWords = new HashSet<string>(StringComparer.Ordinal) { "of", "the", "and", "a", "in" };

        /// <summary>format.ts describeAttachments: "No attachment" or the rewards joined by " · ".</summary>
        public static string Attachments(IEnumerable<Dictionary<string, object?>> list, IReadOnlyDictionary<string, string> names, IReadOnlyDictionary<string, object?>? extra = null)
        {
            string Name(string id) => extra != null && extra.TryGetValue(id, out object? n) && n is string s && s.Length > 0 ? s
                : names.TryGetValue(id, out string? m) && m.Length > 0 ? m : id;
            var parts = list.Select(a => JsonRead.Str(a, "type") switch
            {
                "currency" => $"{JsonRead.Int(a, "amount").ToString("N0", CultureInfo.InvariantCulture)} {UomdHubScreen.CurrencyName}",
                "character" => Name(JsonRead.Str(a, "itemId")),
                "item" => $"{Name(JsonRead.Str(a, "itemId"))} ×{JsonRead.Int(a, "quantity")}",
                "gear" => Name(JsonRead.Str(a, "gearId")),
                "account_xp" => $"{JsonRead.Int(a, "amount")} account XP",
                _ => ""
            }).Where(p => p.Length > 0).ToList();
            return parts.Count == 0 ? "No attachment" : string.Join(" · ", parts);
        }

        /// <summary>format.ts idLabel: `wayfarer_of_ash` → `Wayfarer of Ash`.</summary>
        public static string IdLabel(string id) => string.Join(" ", (id ?? "").Split('_').Select((w, i) =>
            i > 0 && SmallWords.Contains(w) ? w : w.Length == 0 ? w : char.ToUpperInvariant(w[0]) + w.Substring(1)));

        /// <summary>TasksScene left(): "3h 12m" or "2d 5h".</summary>
        public static string Left(double ms)
        {
            long m = Math.Max(0, (long)Math.Floor(ms / 60000));
            return m >= 60 * 24 ? $"{m / 1440}d {(m % 1440) / 60}h" : $"{m / 60}h {m % 60}m";
        }

        public static string Day(double ms) => DateTimeOffset.FromUnixTimeMilliseconds((long)ms).UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    public sealed class ErrandsScreen : RebuildErrandsScreen
    { public ErrandsScreen(UomdSceneRouter router) : base(router) { } }

    /// <summary>Seasonal event objectives and one-time achievements (port of DeedsScene.ts).</summary>
    public sealed class DeedsScreen : UomdHubScreen
    {
        private const float Top = 130f;
        private float _scrollTop;

        public DeedsScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Deeds;
        protected override string Heading => "DEEDS";

        protected override async Awaitable BuildAsync(int generation)
        {
            string release = HubData.Release(Router);
            var ach = await Router.Api.GetJsonAsync($"/api/v1/achievements?releaseId={release}");
            var ev = await Router.Api.GetJsonAsync($"/api/v1/events?releaseId={release}");
            var catalog = await HubData.CatalogAsync(Router);
            if (!IsCurrent(generation)) return;
            var rows = new List<Action<VisualElement>>();
            float y = 50f;
            void Heading(string s)
            {
                float at = y;
                rows.Add(sc => Text(190f, at, s, 28, UomdThemeTokens.Gold, 0f, 0.5f, display: true, into: sc));
                y += 80f;
            }
            void Row(string title, string detail, long progress, long target, bool done, bool claimed, List<Dictionary<string, object?>> rewards, string path, Dictionary<string, object?> body)
            {
                float at = y;
                rows.Add(sc =>
                {
                    Card(RefW / 2f - 100f, at, 1500f, 108f, claimed ? UomdPanelVariant.Dim : done ? UomdPanelVariant.Hot : UomdPanelVariant.Normal, sc);
                    Fit(Text(190f, at - 24f, $"{title}   {progress}/{target}", 28, claimed ? UomdThemeTokens.TextDim : UomdThemeTokens.TextPrimary, 0f, 0.5f, display: true, into: sc), 1200f);
                    Fit(Text(190f, at + 22f, $"{detail}{(detail.Length > 0 ? "   ·   " : "")}{HubText.Attachments(rewards, catalog.Names)}", 22, UomdThemeTokens.TextDim, 0f, 0.5f, into: sc), 1200f);
                    var b = Button(RefW - 250f, at, claimed ? "CLAIMED" : "CLAIM", null, 280, 90, 28, done && !claimed ? UomdPanelVariant.Hot : UomdPanelVariant.Dim, () =>
                    {
                        _scrollTop = sc.GetFirstAncestorOfType<ScrollView>()?.scrollOffset.y ?? 0f;
                        _ = ActAsync(async () =>
                        {
                            await Router.Api.SendJsonAsync("POST", path, body);
                            Say($"Claimed: {title}");
                            await UpdateWalletAsync();
                        });
                    }, sc);
                    UomdScreenKit.SetEnabled(b, done && !claimed, UomdPanelVariant.Hot);
                });
                y += 120f;
            }
            foreach (var e in JsonRead.Objects(ev, "events").Where(x => JsonRead.Str(x, "state") != "ended"))
            {
                string state = JsonRead.Str(e, "state"), eventId = JsonRead.Str(e, "eventId");
                string when = state == "scheduled" ? $"starts {HubText.Day(JsonRead.Num(e, "startsAtMs"))}" : state == "active" ? $"ends {HubText.Day(JsonRead.Num(e, "endsAtMs"))}" : $"claim before {HubText.Day(JsonRead.Num(e, "claimEndsAtMs"))}";
                Heading($"{JsonRead.Str(e, "title").ToUpperInvariant()}   ·   {when}");
                foreach (var o in JsonRead.Objects(e, "objectives"))
                    Row(JsonRead.Str(o, "title"), "", JsonRead.Int(o, "progress"), JsonRead.Int(o, "target"), JsonRead.Bool(o, "done") && state != "scheduled", JsonRead.Bool(o, "claimed"),
                        JsonRead.Objects(o, "rewards").ToList(), $"/api/v1/events/{Uri.EscapeDataString(eventId)}/claim",
                        new Dictionary<string, object?> { ["objectiveId"] = JsonRead.Str(o, "id"), ["releaseId"] = Router.Patch.ActiveReleaseId });
                y += 20f;
            }
            Heading("ACHIEVEMENTS");
            foreach (var a in JsonRead.Objects(ach, "achievements"))
                Row(JsonRead.Str(a, "title"), $"{JsonRead.Str(a, "description")} Title: {HubText.IdLabel(JsonRead.Str(a, "badgeTitle"))}", JsonRead.Int(a, "progress"), JsonRead.Int(a, "target"),
                    JsonRead.Bool(a, "done"), JsonRead.Bool(a, "claimed"), JsonRead.Objects(a, "rewards").ToList(), "/api/v1/achievements/claim",
                    new Dictionary<string, object?> { ["achievementId"] = JsonRead.Str(a, "id"), ["releaseId"] = Router.Patch.ActiveReleaseId });
            var content = Scroll(0f, Top, RefW, RefH - Top - 170f, y + 20f);
            foreach (var row in rows) row(content);
            float keep = _scrollTop;
            if (content.GetFirstAncestorOfType<ScrollView>() is ScrollView view) view.schedule.Execute(() => view.scrollOffset = new Vector2(0f, keep)).StartingIn(1);
        }
    }

    /// <summary>Rewards and notices (port of MailScene.ts).</summary>
    public sealed class MailScreen : UomdHubScreen
    {
        private const int PerPage = 5;
        private List<Dictionary<string, object?>> _mail = new List<Dictionary<string, object?>>();
        private readonly Dictionary<string, string> _names = new Dictionary<string, string>(StringComparer.Ordinal);
        private readonly HashSet<long> _claimedNow = new HashSet<long>();
        private int _page;
        private bool _claiming;

        public MailScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Mail;
        protected override string Heading => "MAIL";

        protected override async Awaitable BuildAsync(int generation)
        {
            var mail = await Router.Api.GetJsonAsync("/api/v1/mail");
            var roster = await HubData.RosterAsync(Router);
            var catalog = await HubData.CatalogAsync(Router);
            if (!IsCurrent(generation)) return;
            _mail = JsonRead.Objects(mail, "mail").ToList();
            _claimedNow.Clear();
            _names.Clear();
            foreach (var n in catalog.Names) _names[n.Key] = n.Value;
            foreach (var c in roster) _names[c.Key] = JsonRead.Str(c.Value, "name_en", c.Key);
            Draw();
        }

        private bool Claimed(Dictionary<string, object?> m) => JsonRead.Str(m, "claimed_at").Length > 0 || _claimedNow.Contains(JsonRead.Int(m, "id"));
        private string Rewards(Dictionary<string, object?> m) => HubText.Attachments(JsonRead.Objects(m, "attachments"), _names, JsonRead.Obj(m, "names"));

        private void Draw()
        {
            Body.Clear();
            var open = _mail.Where(m => !Claimed(m)).ToList();
            Text(RefW / 2f, 160f, open.Count > 0 ? $"{open.Count} waiting" : "Nothing is waiting for you.", 36, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            var slice = _mail.Skip(_page * PerPage).Take(PerPage).ToList();
            for (int i = 0; i < slice.Count; i++)
            {
                var m = slice[i];
                float y = 290f + i * 135f;
                bool done = Claimed(m);
                Card(RefW / 2f - 100f, y, 1400f, 120f, done ? UomdPanelVariant.Dim : UomdPanelVariant.Normal);
                Fit(Text(280f, y - 28f, JsonRead.Str(m, "title"), 32, done ? UomdThemeTokens.TextDim : UomdThemeTokens.TextPrimary, 0f, 0.5f, display: true), 1100f);
                string expires = JsonRead.Str(m, "expires_at");
                Fit(Text(280f, y + 22f, $"{Rewards(m)}   ·   {(done ? "claimed" : $"expires {(expires.Length >= 10 ? expires.Substring(0, 10) : expires)}")}", 26, UomdThemeTokens.TextDim, 0f, 0.5f), 1100f);
                var b = Button(RefW - 250f, y, done ? "CLAIMED" : "CLAIM", null, 280, 100, 30, done ? UomdPanelVariant.Dim : UomdPanelVariant.Hot, () => _ = ClaimAsync(m));
                UomdScreenKit.SetEnabled(b, !done, UomdPanelVariant.Hot);
            }
            int pages = Math.Max(1, (int)Math.Ceiling(_mail.Count / (double)PerPage));
            if (pages > 1)
            {
                Button(RefW / 2f - 220f, 980f, "‹", null, 160, 100, 56, UomdPanelVariant.Normal, () => { _page = (_page + pages - 1) % pages; Draw(); });
                Text(RefW / 2f, 980f, $"{_page + 1} / {pages}", 36, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
                Button(RefW / 2f + 220f, 980f, "›", null, 160, 100, 56, UomdPanelVariant.Normal, () => { _page = (_page + 1) % pages; Draw(); });
            }
            if (open.Count > 1) Button(RefW - 330f, 980f, "CLAIM ALL", null, 380, 100, 30, UomdPanelVariant.Hot, () => _ = ClaimAllAsync());
        }

        private async Awaitable<bool> ClaimAsync(Dictionary<string, object?> m)
        {
            if (_claiming) return false;
            _claiming = true;
            int generation = Generation;
            try
            {
                long id = JsonRead.Int(m, "id");
                await Router.Api.SendJsonAsync("POST", $"/api/v1/mail/{id}/claim", new Dictionary<string, object?>());
                if (!IsCurrent(generation)) return false;
                _claimedNow.Add(id);
                Say($"Claimed: {Rewards(m)}");
                await UpdateWalletAsync();
                if (IsCurrent(generation)) Draw();
                return true;
            }
            catch (Exception e)
            {
                if (IsCurrent(generation)) Say(ErrText(e));
                _claiming = false;
                await RefreshAsync();
                return false;
            }
            finally
            {
                _claiming = false;
            }
        }

        private async Awaitable ClaimAllAsync()
        {
            foreach (var m in _mail.Where(x => !Claimed(x)).ToList())
                if (!await ClaimAsync(m)) return;
        }
    }

    /// <summary>The player's card, title badge and the three leaderboards (port of ProfileScene.ts).</summary>
    public sealed class ProfileScreen : UomdHubScreen
    {
        private static readonly (string Id, string Label, string Unit)[] Boards = { ("campaign_stars", "STARS", "★"), ("arena", "ARENA", "rating"), ("endless", "ENDLESS", "waves") };
        private static readonly (string Key, string Label)[] Summary =
        {
            ("accountLevel", "Account level"), ("totalStars", "Campaign stars"), ("totalClears", "Stage victories"),
            ("ownedCharacters", "Companions"), ("arenaRating", "Arena rating"), ("endlessBestWave", "Endless best wave")
        };
        private string _board = "campaign_stars";

        public ProfileScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Profile;
        protected override string Heading => "PROFILE";

        protected override async Awaitable BuildAsync(int generation)
        {
            var p = await Router.Api.GetJsonAsync($"/api/v1/profile?releaseId={HubData.Release(Router)}");
            var lb = await Router.Api.GetJsonAsync($"/api/v1/leaderboard?board={_board}&limit=10");
            if (!IsCurrent(generation)) return;
            Card(500f, 540f, 760f, 700f);
            Fit(Text(500f, 250f, JsonRead.Str(p, "displayName"), 44, UomdThemeTokens.TextPrimary, 0.5f, 0.5f, display: true), 700f);
            string badge = JsonRead.Str(p, "titleBadge");
            Text(500f, 310f, HubText.IdLabel(badge), 30, UomdThemeTokens.Gold, 0.5f, 0.5f);
            var summary = JsonRead.Obj(p, "summary");
            for (int i = 0; i < Summary.Length; i++)
            {
                float y = 400f + i * 62f;
                Text(200f, y, Summary[i].Label, 28, UomdThemeTokens.TextDim, 0f, 0.5f);
                Text(800f, y, JsonRead.Int(summary, Summary[i].Key).ToString(CultureInfo.InvariantCulture), 30, UomdThemeTokens.TextPrimary, 1f, 0.5f, display: true);
            }
            var badges = JsonRead.Strings(p, "unlockedBadges").ToList();
            string next = badges.Count > 0 ? badges[(badges.IndexOf(badge) + 1) % badges.Count] : badge;
            var change = Button(500f, 820f, "CHANGE TITLE", badges.Count > 1 ? $"Next: {HubText.IdLabel(next)}" : "Claim achievements for more titles", 560, 110, 28, UomdPanelVariant.Normal, () => _ = ActAsync(async () =>
            {
                await Router.Api.SendJsonAsync("PUT", "/api/v1/profile", new Dictionary<string, object?> { ["titleBadge"] = next });
                Say($"Title: {HubText.IdLabel(next)}");
            }));
            UomdScreenKit.SetEnabled(change, badges.Count > 1);
            for (int i = 0; i < Boards.Length; i++)
            {
                var b = Boards[i];
                Button(1080f + i * 230f, 230f, b.Label, null, 210, 80, 24, b.Id == _board ? UomdPanelVariant.Hot : UomdPanelVariant.Dim, () => { _board = b.Id; _ = RefreshAsync(); });
            }
            string unit = Boards.First(b => b.Id == _board).Unit;
            var entries = JsonRead.Objects(lb, "entries").ToList();
            if (entries.Count == 0) Text(1310f, 500f, "No entries yet.", 32, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            for (int i = 0; i < entries.Count; i++)
            {
                var e = entries[i];
                float y = 340f + i * 58f;
                var color = JsonRead.Bool(e, "isMe") ? UomdThemeTokens.Gold : UomdThemeTokens.TextPrimary;
                Text(990f, y, $"#{JsonRead.Int(e, "rank")}", 26, color, 0f, 0.5f, display: true);
                Fit(Text(1090f, y, $"{JsonRead.Str(e, "displayName")}  ·  {JsonRead.Str(e, "playerTag")}", 26, color, 0f, 0.5f), 500f);
                Text(1760f, y, $"{JsonRead.Int(e, "score").ToString("N0", CultureInfo.InvariantCulture)} {unit}", 26, color, 1f, 0.5f);
            }
        }
    }

}
