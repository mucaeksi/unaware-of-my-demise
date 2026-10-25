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
    /// <summary>
    /// The altar (port of SummonScene.ts): the open banners with their key art, published rates and the account's pity,
    /// ×1 / ×10 pulls in the main currency, a staggered result reveal, pools and pull history.
    /// </summary>
    public sealed class SummonScreen : UomdHubScreen
    {
        private static readonly Dictionary<long, Color> RarityColor = new Dictionary<long, Color>
        {
            [5] = new Color(1f, 0.847f, 0.420f), [4] = new Color(0.788f, 0.714f, 0.894f), [3] = new Color(0.663f, 0.608f, 0.722f)
        };
        private static readonly (float, Color)[] BannerScrim =
        {
            (0f, new Color(0.031f, 0.020f, 0.055f, 0.92f)), (0.54f, new Color(0.031f, 0.020f, 0.055f, 0.82f)),
            (0.82f, new Color(0.031f, 0.020f, 0.055f, 0.18f)), (1f, new Color(0.031f, 0.020f, 0.055f, 0.48f))
        };
        private static readonly Color Heal = new Color(0.494f, 0.851f, 0.596f);

        private List<Dictionary<string, object?>> _banners = new List<Dictionary<string, object?>>();
        private readonly Dictionary<string, Dictionary<string, object?>> _pity = new Dictionary<string, Dictionary<string, object?>>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> _names = new Dictionary<string, string>(StringComparer.Ordinal);
        private int _index;
        private string? _target;
        private bool _pulling;

        public SummonScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Summon;
        protected override string Heading => "SUMMON";

        protected override async Awaitable BuildAsync(int generation)
        {
            var api = Router.Api;
            string release = HubData.Release(Router);
            var banners = await api.GetJsonAsync($"/api/v1/banners?releaseId={release}", requireAuth: false);
            var state = await api.GetJsonAsync("/api/v1/gacha/state");
            var roster = await HubData.RosterAsync(Router);
            var catalog = await HubData.CatalogAsync(Router);
            if (!IsCurrent(generation)) return;
            _banners = JsonRead.Objects(banners, "banners").ToList();
            ReadPity(state);
            _names.Clear();
            foreach (var n in catalog.Names) _names[n.Key] = n.Value;
            foreach (var c in roster) _names[c.Key] = JsonRead.Str(c.Value, "name_en", c.Key);
            if (_index >= _banners.Count) _index = 0;
            Draw();
        }

        private void ReadPity(Dictionary<string, object?> state)
        {
            _pity.Clear();
            foreach (var p in JsonRead.Objects(state, "pity")) _pity[JsonRead.Str(p, "pity_group")] = p;
        }

        private string Name(string id) => _names.TryGetValue(id, out string n) && n.Length > 0 ? n : id;
        private static string N0(long v) => v.ToString("N0", CultureInfo.InvariantCulture);

        /// <summary>format.ts pct: "2 %", "0.6 %".</summary>
        private static string Pct(double x, int digits = 1)
        {
            string s = (x * 100).ToString("F" + digits, CultureInfo.InvariantCulture);
            if (s.Contains('.')) s = s.TrimEnd('0').TrimEnd('.');
            return s + " %";
        }

        private List<string> Pool(Dictionary<string, object?> b, string key) => JsonRead.Strings(JsonRead.Obj(b, "pools"), key).ToList();

        private void Draw()
        {
            CloseModal();
            Body.Clear();
            if (_banners.Count == 0)
            {
                Text(RefW / 2f, 480f, "No banner is open right now.", 46, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
                return;
            }
            var b = _banners[_index];
            var p = _pity.TryGetValue(JsonRead.Str(b, "pityGroup"), out var found) ? found : null;
            long pity5 = JsonRead.Int(p, "pity5"), pity4 = JsonRead.Int(p, "pity4"), lost = JsonRead.Int(p, "lost");
            long next = pity5 + 1;
            var featured = JsonRead.Get(b, "featured") as Dictionary<string, object?>;
            var fiveFeatured = Pool(b, "fiveFeatured");
            bool selectable = JsonRead.Str(featured, "targetMode") == "selectable";
            _target = selectable ? (_target != null && fiveFeatured.Contains(_target) ? _target : fiveFeatured.FirstOrDefault()) : null;

            Fit(Text(RefW / 2f, 175f, JsonRead.Str(b, "title").ToUpperInvariant(), 54, UomdThemeTokens.TextPrimary, 0.5f, 0.5f, display: true), 1100f);
            string ends = JsonRead.Str(b, "endsAt");
            Text(RefW / 2f, 235f, $"{_index + 1} / {_banners.Count}{(ends.Length >= 10 ? $"   ·   ends {ends.Substring(0, 10)}" : "")}", 28, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            if (_banners.Count > 1)
            {
                Button(330f, 190f, "‹", null, 140, 130, 64, UomdPanelVariant.Normal, () => { _index = (_index + _banners.Count - 1) % _banners.Count; Draw(); });
                Button(RefW - 330f, 190f, "›", null, 140, 130, 64, UomdPanelVariant.Normal, () => { _index = (_index + 1) % _banners.Count; Draw(); });
            }

            var showcase = Card(560f, 520f, 940f, 440f);
            string id = JsonRead.Str(b, "id");
            string artKey = JsonRead.Str(b, "artKey");
            string? art = (artKey.Length > 0 ? Router.Media.Catalog.Ui(artKey) : null) ?? Router.Media.Catalog.Ui($"banner_{id}");
            if (art != null) UomdScreenKit.SetArtBackdrop(showcase, Router.Media, art, BannerScrim);
            Rates(b, featured, fiveFeatured);
            PityCard(b, featured, fiveFeatured, pity5, pity4, lost, next, selectable);

            long one = JsonRead.Int(JsonRead.Obj(b, "cost"), "perPull");
            var pull1 = Button(760f, 850f, "PULL ×1", $"{N0(one)} {CurrencyName}", 400, 130, 42, UomdPanelVariant.Hot, () => _ = PullAsync(id, 1));
            UomdScreenKit.SetEnabled(pull1, Balance >= one, UomdPanelVariant.Hot);
            var pull10 = Button(1180f, 850f, "PULL ×10", $"{N0(one * 10)} {CurrencyName}", 400, 130, 42, UomdPanelVariant.Hot, () => _ = PullAsync(id, 10));
            UomdScreenKit.SetEnabled(pull10, Balance >= one * 10, UomdPanelVariant.Hot);
            // the same currency pays for upgrades and shop items: show what a pull leaves behind
            Fit(Text(970f, 952f, $"You have {N0(Balance)} {CurrencyName}. The same currency pays for upgrades and the shop: after ×10 you keep {N0(Math.Max(0, Balance - one * 10))}.", 27, UomdThemeTokens.TextDim, 0.5f, 0.5f), 1500f);
            Button(760f, 1026f, "POOLS", null, 300, 84, 28, UomdPanelVariant.Normal, () => ShowPools(b));
            Button(1180f, 1026f, "HISTORY", null, 300, 84, 28, UomdPanelVariant.Normal, () => _ = ShowHistoryAsync());
        }

        private void Rates(Dictionary<string, object?> b, Dictionary<string, object?>? featured, List<string> fiveFeatured)
        {
            var soft = JsonRead.Get(b, "softPity") as Dictionary<string, object?>;
            string feat;
            if (featured != null)
            {
                long losses = JsonRead.Int(featured, "lossesToGuarantee");
                feat = $"Featured: {string.Join(", ", fiveFeatured.Select(Name))} — {Pct(JsonRead.Num(featured, "chance"), 0)} on a 5★{(losses == 1 ? ", guaranteed after a miss" : $", guaranteed after {losses} misses")}";
            }
            else
            {
                var pool = fiveFeatured.Count > 0 ? fiveFeatured : Pool(b, "fiveOther");
                feat = $"5★ pool: {string.Join(", ", pool.Select(Name))}";
            }
            var analysis = JsonRead.Obj(b, "analysis");
            double perTarget = JsonRead.Num(analysis, "expectedPullsPerTarget");
            var lines = new[]
            {
                $"5★ rate {Pct(JsonRead.Num(b, "baseFiveStarRate"))}{(soft != null ? $", rising {Pct(JsonRead.Num(soft, "increment"), 0)} per pull from pull {JsonRead.Int(soft, "startPull")}" : "")}, guaranteed by pull {JsonRead.Int(b, "hardPity")}",
                feat,
                $"A 4★ or better at least every {JsonRead.Int(b, "minFourStarEvery")} pulls. A 10-pull has no bonus rate.",
                $"Average {JsonRead.Num(analysis, "expectedPullsPerFiveStar").ToString("F1", CultureInfo.InvariantCulture)} pulls per 5★" +
                    (perTarget > 0 ? $", {perTarget.ToString("F1", CultureInfo.InvariantCulture)} per featured (at most {JsonRead.Int(analysis, "worstCasePullsForTarget")})" : "")
            };
            var text = Text(120f, 326f, string.Join("\n\n", lines), 26, UomdThemeTokens.TextPrimary, wrapWidth: 570f);
            text.style.unityTextAlign = TextAnchor.UpperLeft;
            text.style.unityTextOutlineWidth = 1f;
            text.style.unityTextOutlineColor = UomdThemeTokens.Void;
        }

        private void PityCard(Dictionary<string, object?> b, Dictionary<string, object?>? featured, List<string> fiveFeatured, long pity5, long pity4, long lost, long next, bool selectable)
        {
            long hard = Math.Max(1, JsonRead.Int(b, "hardPity", 80));
            Card(1400f, 520f, 760f, 440f, UomdPanelVariant.Hot);
            Text(1400f, 350f, "PITY", 34, UomdThemeTokens.Gold, 0.5f, 0.5f, display: true);
            Text(1400f, 410f, $"Pull {next} of {hard}", 52, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
            Bar(1400f, 480f, 600f, 26f, Mathf.Min(1f, pity5 / (float)hard), UomdThemeTokens.GoldHi);
            var soft = JsonRead.Get(b, "softPity") as Dictionary<string, object?>;
            double baseRate = JsonRead.Num(b, "baseFiveStarRate");
            long softStart = JsonRead.Int(soft, "startPull");
            double rateNow = Math.Min(1, next >= hard ? 1 : soft != null && next >= softStart ? baseRate + JsonRead.Num(soft, "increment") * (next - (softStart - 1)) : baseRate);
            Text(1400f, 545f, $"5★ chance on the next pull: {Pct(rateNow)}", 30, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
            long losses = JsonRead.Int(featured, "lossesToGuarantee");
            bool guaranteed = featured != null && lost >= losses;
            Text(1400f, 600f, guaranteed ? "The next 5★ is the featured one." : featured != null ? $"Misses so far: {lost} / {losses}" : "", 30, guaranteed ? Heal : UomdThemeTokens.TextDim, 0.5f, 0.5f);
            Text(1400f, 655f, $"4★ guaranteed in {Math.Max(1, JsonRead.Int(b, "minFourStarEvery") - pity4)} pull(s)", 28, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            if (selectable && fiveFeatured.Count > 0)
                Button(1400f, 725f, $"TARGET: {Name(_target ?? "")}", null, 640, 90, 28, UomdPanelVariant.Normal, () =>
                {
                    _target = fiveFeatured[(fiveFeatured.IndexOf(_target ?? "") + 1) % fiveFeatured.Count];
                    Draw();
                });
        }

        private async Awaitable PullAsync(string bannerId, int count)
        {
            if (_pulling) return;
            _pulling = true;
            int generation = Generation;
            try
            {
                var body = new Dictionary<string, object?> { ["bannerId"] = bannerId, ["count"] = (long)count, ["releaseId"] = Router.Patch.ActiveReleaseId };
                if (_target != null) body["target"] = _target;
                var result = await Router.Api.SendJsonAsync("POST", "/api/v1/gacha/pull", body);
                var state = await Router.Api.GetJsonAsync("/api/v1/gacha/state");
                if (!IsCurrent(generation)) return;
                ReadPity(state);
                await UpdateWalletAsync();
                if (!IsCurrent(generation)) return;
                Draw();
                ShowResults(result);
            }
            catch (Exception e)
            {
                if (IsCurrent(generation)) Say(ErrText(e));
            }
            finally
            {
                _pulling = false;
            }
        }

        /// <summary>A dimmed window with a heading and a CLOSE button.</summary>
        private VisualElement Window(string heading, float w, float h, float closeY)
        {
            var m = OpenModal(0.8f);
            Card(RefW / 2f, RefH / 2f, w, h, UomdPanelVariant.Normal, m);
            Text(RefW / 2f, RefH / 2f - h / 2f + 64f, heading, 44, UomdThemeTokens.Gold, 0.5f, 0.5f, display: true, into: m);
            Button(RefW / 2f, RefH / 2f + closeY, "CLOSE", null, 420, 110, 32, UomdPanelVariant.Normal, CloseModal, m);
            return m;
        }

        private void ShowResults(Dictionary<string, object?> r)
        {
            var pulls = JsonRead.Objects(r, "pulls").ToList();
            var m = Window(JsonRead.Bool(r, "replayed") ? "RESULT (already rolled)" : "THE THREAD PULLS TIGHT", 1760f, 860f, 340f);
            float cx = RefW / 2f, cy = RefH / 2f;
            int cols = Math.Min(5, pulls.Count);
            const float cw = 300f, ch = 200f;
            for (int i = 0; i < pulls.Count; i++)
            {
                var p = pulls[i];
                long rarity = JsonRead.Int(p, "rarity");
                string itemId = JsonRead.Str(p, "itemId");
                float x = cx - (cols - 1) * (cw + 20f) / 2f + (i % cols) * (cw + 20f);
                float y = cy - 100f + (i / cols) * (ch + 24f) - (pulls.Count > 5 ? 20f : -90f);
                var color = RarityColor.TryGetValue(rarity, out var c) ? c : UomdThemeTokens.TextPrimary;
                var group = new VisualElement { pickingMode = PickingMode.Ignore };
                group.style.position = Position.Absolute;
                group.style.left = group.style.top = 0;
                group.style.width = RefW;
                group.style.height = RefH;
                m.Add(group);
                Card(x, y, cw, ch, rarity == 5 ? UomdPanelVariant.Hot : rarity == 4 ? UomdPanelVariant.Normal : UomdPanelVariant.Dim, group);
                Fit(Text(x, y - 48f, Name(itemId), 28, color, 0.5f, 0.5f, display: true, into: group), cw - 30f);
                Text(x, y - 8f, HubData.Stars(rarity), 32, color, 0.5f, 0.5f, into: group);
                Text(x, y + 28f, UomdCompanionAttachment.Describe(itemId).FormationSlot.ToUpperInvariant(), 18, UomdThemeTokens.Gold, 0.5f, 0.5f, into: group);
                bool duplicate = JsonRead.Bool(p, "duplicate");
                Text(x, y + 62f, duplicate ? $"+{JsonRead.Int(p, "shards")} shards" : JsonRead.Str(p, "outcome") == "guaranteed" ? "NEW · guaranteed" : "NEW", 24, duplicate ? UomdThemeTokens.TextDim : Heal, 0.5f, 0.5f, into: group);
                if (Calm) continue;
                // staggered reveal: each card fades and scales in, the bell rings by rarity
                group.style.opacity = 0f;
                group.style.transformOrigin = new TransformOrigin(new Length(x, LengthUnit.Pixel), new Length(y, LengthUnit.Pixel));
                group.style.scale = new Scale(new Vector3(0.85f, 0.85f, 1f));
                int delay = 110 * i;
                UomdScreenKit.Fade(group, 1f, 240, delay, false, EasingMode.EaseOutCubic);
                UomdScreenKit.ScaleTo(group, 1f, 240, delay, false, rarity == 5 ? EasingMode.EaseOutBack : EasingMode.EaseOutCubic);
                if (rarity >= 4)
                {
                    string cue = rarity == 5 ? "sfx_bell_sanctuary" : "sfx_bell_silver";
                    UomdScreenKit.After(group, delay, () => Router.Audio.PlaySfx(cue));
                }
            }
        }

        private void ShowPools(Dictionary<string, object?> b)
        {
            var m = Window("POOLS & RATES", 1500f, 840f, 340f);
            string List(string key) { var ids = Pool(b, key); return ids.Count > 0 ? string.Join(", ", ids.Select(Name)) : "—"; }
            var shards = JsonRead.Obj(b, "duplicateShards");
            var body = new[]
            {
                $"5★ featured: {List("fiveFeatured")}", $"5★ other: {List("fiveOther")}", $"4★: {List("four")}", $"3★: {List("three")}", "",
                $"Duplicates become character-bound Memory Shards: 5★ {JsonRead.Int(shards, "5")}, 4★ {JsonRead.Int(shards, "4")}, 3★ {JsonRead.Int(shards, "3")}.",
                "Pity is kept per account and shared between banners of the same kind."
            };
            var text = Text(RefW / 2f - 680f, RefH / 2f - 270f, string.Join("\n", body), 29, UomdThemeTokens.TextPrimary, wrapWidth: 1360f, into: m);
            text.style.unityTextAlign = TextAnchor.UpperLeft;
        }

        private async Awaitable ShowHistoryAsync()
        {
            int generation = Generation;
            try
            {
                var rows = JsonRead.Objects(await Router.Api.GetJsonAsync("/api/v1/gacha/history?limit=40"), "pulls").Take(14).ToList();
                if (!IsCurrent(generation)) return;
                var m = Window("YOUR LAST PULLS", 1500f, 860f, 350f);
                string text = rows.Count == 0 ? "Nothing yet." : string.Join("\n", rows.Select(r =>
                    $"{HubData.Stars(JsonRead.Int(r, "rarity")).PadRight(5, ' ')}  {Name(JsonRead.Str(r, "item_id"))}  ·  {JsonRead.Str(r, "banner_id")}  ·  pull {JsonRead.Int(r, "pull_number")}{(JsonRead.Int(r, "duplicate") != 0 ? "  (duplicate)" : "")}"));
                var label = Text(RefW / 2f - 680f, RefH / 2f - 290f, text, 28, UomdThemeTokens.TextPrimary, into: m);
                label.style.unityTextAlign = TextAnchor.UpperLeft;
            }
            catch (Exception e)
            {
                if (IsCurrent(generation)) Say(ErrText(e));
            }
        }
    }
}
