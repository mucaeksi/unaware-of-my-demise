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
    /// Story invitations (port of RecruitScene.ts): choose one companion from the open selectors, review, then spend one
    /// invitation. A duplicate grants character-bound Memory Shards.
    /// </summary>
    public sealed class InvitationsScreen : UomdHubScreen
    {
        private readonly List<(Dictionary<string, object?> Selector, Dictionary<string, object?> Choice)> _choices =
            new List<(Dictionary<string, object?>, Dictionary<string, object?>)>();
        private (Dictionary<string, object?> Selector, Dictionary<string, object?> Choice)? _selected;
        private int _page;
        private bool _confirming;

        public InvitationsScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Recruit;
        protected override string Heading => "INVITATIONS";
        protected override bool UsesWallet => false;
        protected override UomdScreenId BackTo => Router.Session.RecruitReturnTo == UomdScreenId.Chapters ? UomdScreenId.Chapters : UomdScreenId.Roster;

        protected override async Awaitable BuildAsync(int generation)
        {
            _selected = null;
            _confirming = false;
            var result = await Router.Api.GetJsonAsync($"/api/v1/recruitment/selectors?releaseId={HubData.Release(Router)}");
            if (!IsCurrent(generation)) return;
            _choices.Clear();
            foreach (var selector in JsonRead.Objects(result, "selectors"))
                foreach (var choice in JsonRead.Objects(selector, "choices")) _choices.Add((selector, choice));
            Draw();
        }

        private void Line(float y, string value, float size = 34, Color? color = null)
        {
            var label = Text(RefW / 2f, y, value, size, color ?? UomdThemeTokens.TextPrimary, 0.5f, 0.5f, wrapWidth: 1450f);
            label.style.unityTextAlign = TextAnchor.MiddleCenter;
        }

        private void Draw()
        {
            Body.Clear();
            if (_selected is { } picked)
            {
                var (selector, choice) = picked;
                Line(255f, JsonRead.Str(selector, "title"), 44, UomdThemeTokens.Gold);
                Line(390f, $"Choose {JsonRead.Str(choice, "name_en")}?", 48);
                Line(495f, $"Uses 1 invitation. If already owned, this grants {JsonRead.Int(selector, "duplicateShards")} character-bound Memory Shards.", 32, UomdThemeTokens.TextDim);
                var confirm = Button(RefW / 2f, 680f, _confirming ? "CONFIRMING…" : "USE 1 INVITATION", null, 700, 110, 32, UomdPanelVariant.Normal, () => _ = ConfirmAsync());
                UomdScreenKit.SetEnabled(confirm, !_confirming);
                var change = Button(RefW / 2f, 830f, "CHANGE CHOICE", null, 620, 110, 32, UomdPanelVariant.Normal, () => { _selected = null; Draw(); });
                UomdScreenKit.SetEnabled(change, !_confirming);
                return;
            }
            if (_choices.Count == 0)
            {
                Line(430f, "No invitation is ready. Continue the main story.");
                return;
            }
            Line(170f, "Choose one companion. Review your choice before using an invitation.", 32, UomdThemeTokens.TextDim);
            int pages = (int)Math.Ceiling(_choices.Count / 8.0);
            _page = Math.Min(_page, pages - 1);
            var slice = _choices.Skip(_page * 8).Take(8).ToList();
            for (int i = 0; i < slice.Count; i++)
            {
                var selection = slice[i];
                float x = 340f + (i % 4) * 415f, y = 340f + (i / 4) * 235f;
                Button(x, y, JsonRead.Str(selection.Choice, "name_en"), null, 390, 165, 31, UomdPanelVariant.Normal, () => { _selected = selection; Draw(); });
                string under = JsonRead.Int(selection.Choice, "copies") > 0
                    ? $"Owned · +{JsonRead.Int(selection.Selector, "duplicateShards")} Memory Shards"
                    : $"{JsonRead.Str(selection.Choice, "element")} · {JsonRead.Str(selection.Choice, "role").Replace('_', ' ')}";
                Fit(Text(x, y + 115f, under, 25, UomdThemeTokens.TextDim, 0.5f, 0.5f), 400f);
            }
            if (pages > 1)
            {
                Button(RefW / 2f - 250f, 875f, "PREVIOUS", null, 380, 110, 32, UomdPanelVariant.Normal, () => { _page = (_page + pages - 1) % pages; Draw(); });
                Button(RefW / 2f + 250f, 875f, "NEXT", null, 380, 110, 32, UomdPanelVariant.Normal, () => { _page = (_page + 1) % pages; Draw(); });
            }
        }

        private async Awaitable ConfirmAsync()
        {
            if (_confirming || _selected == null) return;
            var (selector, choice) = _selected.Value;
            int generation = Generation;
            _confirming = true;
            Draw();
            try
            {
                var result = await Router.Api.SendJsonAsync("POST", $"/api/v1/recruitment/{Uri.EscapeDataString(JsonRead.Str(selector, "itemId"))}", new Dictionary<string, object?>
                {
                    ["releaseId"] = Router.Patch.ActiveReleaseId, ["characterId"] = JsonRead.Str(choice, "id")
                });
                if (!IsCurrent(generation)) return;
                Body.Clear();
                long shards = JsonRead.Int(JsonRead.Obj(result, "grant"), "shardsAdded");
                string name = JsonRead.Str(result, "characterName", JsonRead.Str(choice, "name_en"));
                Line(350f, shards > 0 ? $"{name} · +{shards} Memory Shards" : $"{name} joined your company.", 44, UomdThemeTokens.Gold);
                Line(470f, "1 invitation used. Your company is saved.");
                Button(RefW / 2f, 660f, "CONTINUE", null, 600, 110, 32, UomdPanelVariant.Normal, GoBack);
            }
            catch (Exception e)
            {
                if (!IsCurrent(generation)) return;
                Say($"The choice is not confirmed. {ErrText(e)}");
                await RefreshAsync();
            }
            finally
            {
                _confirming = false;
            }
        }
    }

    /// <summary>
    /// Offers and rewarded ads (port of ShopScene.ts layout). The offers and the ad window come from the server; Google Play
    /// checkout (purchase, server verification with retry, restore) and rewarded ads are not wired in the Unity client yet,
    /// so BUY and WATCH stay disabled rather than taking a payment the client could not confirm.
    /// </summary>
    public sealed class ShopScreen : UomdHubScreen
    {
        public ShopScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Shop;
        protected override string Heading => "SHOP";

        protected override async Awaitable BuildAsync(int generation)
        {
            var products = JsonRead.Objects(await Router.Api.GetJsonAsync($"/api/v1/shop/products?releaseId={HubData.Release(Router)}", requireAuth: false), "products").ToList();
            Dictionary<string, object?>? ads = null;
            try { ads = await Router.Api.GetJsonAsync("/api/v1/ads/status"); }
            catch (Exception) { /* the ad window is optional */ }
            if (!IsCurrent(generation)) return;
            Text(RefW / 2f, 160f, "Purchases and rewarded ads are not enabled in this build yet.", 28, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            if (products.Count == 0) Text(RefW / 2f, 420f, "No offers are on sale yet.", 44, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
            for (int i = 0; i < Math.Min(4, products.Count); i++) Row(products[i], 290f + i * 150f);
            if (ads == null) return;
            long reward = JsonRead.Int(ads, "reward"), per = JsonRead.Int(ads, "perWindow"), views = JsonRead.Int(ads, "windowViews");
            Card(RefW / 2f, 940f, 1400f, 130f);
            Text(300f, 915f, "Watch a memory", 34, UomdThemeTokens.TextPrimary, 0f, 0.5f, display: true);
            Text(300f, 965f, $"{reward} {CurrencyName} per view · {per - views} of {per} left in the last 12 hours", 26, UomdThemeTokens.TextDim, 0f, 0.5f);
            UomdScreenKit.SetEnabled(Button(RefW - 330f, 940f, "WATCH", null, 300, 100, 32, UomdPanelVariant.Hot, () => { }), false);
        }

        private void Row(Dictionary<string, object?> p, float y)
        {
            bool subscription = JsonRead.Str(p, "kind") == "subscription";
            Card(RefW / 2f, y, 1400f, 136f);
            Fit(Text(290f, y - 34f, $"{JsonRead.Str(p, "title")}  ·  {(subscription ? "See price in Google Play" : "Price in Google Play")}", 30, UomdThemeTokens.TextPrimary, 0f, 0.5f, display: true), 1000f);
            string what = subscription
                ? $"{JsonRead.Int(JsonRead.Obj(p, "subscription"), "duration_days", 30)}-day blessing"
                : string.Join(" · ", JsonRead.Objects(p, "grants").Select(g => JsonRead.Str(g, "type") == "currency" ? $"{JsonRead.Int(g, "amount")} {CurrencyName}" : JsonRead.Str(g, "itemId")));
            Fit(Text(290f, y + 6f, what, 22, UomdThemeTokens.TextDim, 0f, 0.5f), 1000f);
            Text(290f, y + 38f, subscription ? "Subscriptions auto-renew until cancelled in Google Play." : "One-time purchase · Server-verified grant", 18, UomdThemeTokens.TextDim, 0f, 0.5f);
            UomdScreenKit.SetEnabled(Button(RefW - 330f, y, "BUY", null, 300, 100, 28, UomdPanelVariant.Hot, () => { }), false);
        }
    }

    /// <summary>Recorded deliveries and the last observed payment state (port of PurchasesScene.ts).</summary>
    public sealed class PurchaseHistoryScreen : UomdHubScreen
    {
        private List<Dictionary<string, object?>> _records = new List<Dictionary<string, object?>>();
        private bool _truncated;
        private int _page;

        public PurchaseHistoryScreen(UomdSceneRouter router) : base(router) { }

        public override UomdScreenId ScreenId => UomdScreenId.Purchases;
        protected override string Heading => "PURCHASE HISTORY";
        protected override bool UsesWallet => false;

        protected override async Awaitable BuildAsync(int generation)
        {
            var history = await Router.Api.GetJsonAsync("/api/v1/shop/history");
            if (!IsCurrent(generation)) return;
            _records = JsonRead.Objects(history, "records").Take(30).ToList();
            _truncated = JsonRead.Bool(history, "truncated");
            Draw();
        }

        private void Draw()
        {
            Body.Clear();
            Text(RefW / 2f, 180f, "Recorded deliveries and last observed payment state.", 32, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            int pages = Math.Max(1, (int)Math.Ceiling(_records.Count / 4.0));
            _page = Math.Min(_page, pages - 1);
            if (_records.Count == 0) Text(RefW / 2f, 500f, "No server purchase records yet.", 40, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
            var slice = _records.Skip(_page * 4).Take(4).ToList();
            for (int i = 0; i < slice.Count; i++)
            {
                var record = slice[i];
                float y = 330f + i * 150f;
                string delivery = JsonRead.Str(record, "deliveryState");
                Card(RefW / 2f, y, 1540f, 132f, delivery == "unconfirmed" ? UomdPanelVariant.Normal : UomdPanelVariant.Dim);
                string title = JsonRead.Str(record, "title");
                Text(255f, y - 30f, title.Length > 55 ? title.Substring(0, 55) : title, 34, UomdThemeTokens.TextPrimary, 0f, 0.5f);
                string state = delivery == "granted" ? "Delivery recorded" : delivery == "refunded" ? "Refund recorded"
                    : JsonRead.Str(record, "recoveryState") == "review" ? "Needs payment review" : "Awaiting server confirmation";
                string providerState = JsonRead.Str(record, "providerState");
                string provider = JsonRead.Str(record, "kind") == "subscription" && providerState.Length > 0 ? $" · Last observed: {providerState}" : "";
                Text(255f, y + 22f, state + provider, 28, UomdThemeTokens.TextDim, 0f, 0.5f);
                string at = DateTime.TryParse(JsonRead.Str(record, "recordedAt"), CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var when)
                    ? when.ToLocalTime().ToString("dd/MM/yyyy, HH:mm", CultureInfo.InvariantCulture) : "";
                Text(RefW - 255f, y - 28f, at, 26, UomdThemeTokens.TextDim, 1f, 0.5f);
                string order = JsonRead.Str(record, "orderId");
                if (order.Length > 0) Text(RefW - 255f, y + 22f, $"Order …{(order.Length > 12 ? order.Substring(order.Length - 12) : order)}", 26, UomdThemeTokens.TextDim, 1f, 0.5f);
            }
            if (_truncated) Text(RefW / 2f, 905f, "Showing the latest 30 records.", 28, UomdThemeTokens.TextDim, 0.5f, 0.5f);
            Button(RefW - 260f, 980f, "REFRESH", null, 340, 100, 32, UomdPanelVariant.Normal, () => _ = RefreshAsync());
            if (pages > 1)
            {
                Button(740f, 980f, "‹", null, 160, 100, 56, UomdPanelVariant.Normal, () => { _page = (_page + pages - 1) % pages; Draw(); });
                Text(960f, 980f, $"{_page + 1} / {pages}", 36, UomdThemeTokens.TextPrimary, 0.5f, 0.5f);
                Button(1180f, 980f, "›", null, 160, 100, 56, UomdPanelVariant.Normal, () => { _page = (_page + 1) % pages; Draw(); });
            }
        }
    }
}
