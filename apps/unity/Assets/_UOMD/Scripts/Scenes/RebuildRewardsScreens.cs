using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using Uomd.Core;

namespace Uomd.Scenes
{
    public class RebuildInvitationsScreen : RebuildHubScreen
    {
        private string _item = "", _choice = "", _account, _seenReceipt;
        private bool _review;
        public RebuildInvitationsScreen(UomdSceneRouter router) : base(router) { }
        public override UomdScreenId ScreenId => UomdScreenId.Recruit;
        protected override string Heading => "INVITATIONS";
        protected override void Entered() { _review = false; }
        protected override void Back()
        { if (OverlayOpen) base.Back(); else Navigate(Router.Session.RecruitReturnTo == UomdScreenId.Chapters ? UomdScreenId.Chapters : UomdScreenId.Roster); }
        protected override void DrawContent(UomdHubSnapshot snapshot)
        {
            if (_account != Router.Api.AccountKey) { _account = Router.Api.AccountKey; _item = _choice = ""; _review = false; _seenReceipt = null; }
            var aside = Panel(Body, "hub-aside"); Text(aside, "INVITATIONS", "hub-card-title");
            Text(aside, "Choose one companion. Review your choice before using an invitation.", "hub-copy");
            var list = Scroll(aside);
            foreach (var invitation in snapshot.Invitations ?? new List<UomdInvitation>())
            {
                string id = invitation.Id;
                var tab = Button(list, invitation.Title + " · ×" + invitation.Quantity, "invitation_" + id, () => { _item = id; _choice = ""; _review = false; Draw(); });
                tab.SetEnabled(!Actions.Busy); if (_item == id) tab.AddToClassList("hub-selected");
            }
            var main = Panel(Body, "hub-main");
            if (!snapshot.SignedIn) { Text(main, "Sign in to load your invitations.", "hub-copy"); Button(main, "SIGN IN", "invitationsSignIn", () => Navigate(UomdScreenId.Account)); return; }
            var action = Actions.Current ? Actions.Action : null;
            if (action?.State == "confirmed" && UomdSavedAction.InvitationPath(action.Path))
            {
                if (_seenReceipt != action.RequestId) { _seenReceipt = action.RequestId; _review = false; }
                var result = UomdJson.ParseObject(action.Receipt); long shards = JsonRead.Int(JsonRead.Obj(result, "grant"), "shardsAdded");
                Text(main, "LAST CONFIRMED INVITATION", "hub-small");
                Text(main, JsonRead.Str(result, "characterName") + (shards > 0 ? " · +" + shards + " Memory Shards" : " joined your company."), "hub-card-title");
                Text(main, Actions.Refreshed ? "1 invitation used. Account data refreshed." : "1 invitation used. Account refresh is pending.", "hub-copy");
            }
            var selected = snapshot.Invitations?.FirstOrDefault(i => i.Id == _item) ?? (!_review ? snapshot.Invitations?.FirstOrDefault() : null);
            if (selected == null) { Text(main, _review ? "This choice is no longer available. Refresh your invitations before choosing again." : "No invitation is ready. Continue the main story.", "hub-copy"); if (_review) Button(main, "CHANGE CHOICE", "invitationChange", () => { _review = false; Draw(); }); return; }
            _item = selected.Id;
            if (_review)
            {
                var choice = selected.Choices.FirstOrDefault(c => c.Id == _choice);
                if (choice == null) { Text(main, "This companion is no longer eligible. Change your choice.", "hub-copy"); }
                else
                {
                    Text(main, "CHOOSE " + choice.Name.ToUpperInvariant() + "?", "hub-card-title");
                    Text(main, selected.Title + " · " + selected.Quantity + " available", "hub-copy");
                    Text(main, "Uses 1 invitation. If already owned when confirmed, this grants " + selected.DuplicateShards + " character-bound Memory Shards.", "hub-copy");
                    string id = choice.Id, item = selected.Id, summary = selected.Title + " · " + choice.Name + " · uses 1 invitation · duplicate: " + selected.DuplicateShards + " Memory Shards";
                    var confirm = Button(main, "USE 1 INVITATION", "invitationConfirm", () => _ = Actions.ExecuteAsync("/api/v1/recruitment/" + item, new Dictionary<string, object> { ["characterId"] = id }, summary), "hub-primary");
                    confirm.SetEnabled(CanWrite);
                }
                var change = Button(main, "CHANGE CHOICE", "invitationChange", () => { _review = false; Draw(); }); change.SetEnabled(!Actions.Busy);
                return;
            }
            Text(main, selected.Title, "hub-card-title");
            var choices = Scroll(main);
            foreach (var choice in selected.Choices)
            {
                string id = choice.Id;
                var row = Button(choices, "", "invitationChoice_" + id, () => { _choice = id; _review = true; Draw(); }, "hub-row");
                Text(row, choice.Name, "hub-card-title"); Text(row, new string('★', choice.Rarity) + " · " + choice.Element + " · " + choice.Role.Replace('_', ' '), "hub-copy");
                Text(row, choice.Copies > 0 ? "Owned · duplicate grants " + selected.DuplicateShards + " Memory Shards" : "New companion", "hub-small");
                row.SetEnabled(Data.Fresh && !Actions.Busy);
            }
        }
    }
    public class RebuildErrandsScreen : RebuildHubScreen
    {
        private string _view = "supplies", _account;
        private UomdErrandsSnapshot _clock;
        private int _expired;
        public RebuildErrandsScreen(UomdSceneRouter router) : base(router) { }
        public override UomdScreenId ScreenId => UomdScreenId.Tasks;
        protected override string Heading => "ERRANDS";
        protected override void Entered() { _clock = null; }
        public override void OnTick(float dt)
        {
            base.OnTick(dt); var snapshot = Data.Snapshot?.Errands;
            if (!Data.Fresh || snapshot == null) return;
            double now = Data.ErrandsNowMs;
            if (_clock != snapshot) { _clock = snapshot; _expired = 0; }
            int expired = (now >= snapshot.SupplyEnds ? 1 : 0) | (snapshot.WindowEnds > 0 && now >= snapshot.WindowEnds ? 2 : 0);
            if (expired != _expired) { _expired = expired; Data.Touch(); }
        }
        protected override void DrawContent(UomdHubSnapshot snapshot)
        {
            if (_account != Router.Api.AccountKey) { _account = Router.Api.AccountKey; _view = "supplies"; }
            var aside = Panel(Body, "hub-aside"); Text(aside, "ERRANDS", "hub-card-title");
            foreach (var tab in new[] { (Id: "supplies", Name: "DAILY SUPPLIES"), (Id: "patrol", Name: "AFK PATROL"), (Id: "daily", Name: "THIS WINDOW"), (Id: "weekly", Name: "THIS WEEK") })
            { string id = tab.Id; var button = Button(aside, tab.Name, "errandsView_" + id, () => { _view = id; Draw(); }); if (_view == id) button.AddToClassList("hub-selected"); button.SetEnabled(!Actions.Busy); }
            Text(aside, "Rewards and progress are confirmed by your account. Refresh to update.", "hub-copy");
            Button(aside, "SAVED ACTIONS", "errandsSaved", () => Navigate(UomdScreenId.Operations));
            var main = Panel(Body, "hub-main");
            if (!snapshot.SignedIn) { Text(main, "Sign in to load your errands and supplies.", "hub-copy"); Button(main, "SIGN IN", "errandsSignIn", () => Navigate(UomdScreenId.Account)); return; }
            var data = snapshot.Errands;
            if (data == null) { Text(main, "Errands are unavailable. Refresh to retry.", "hub-copy"); return; }
            var list = Scroll(main); double now = Data.ErrandsNowMs;
            if (_view == "supplies")
            {
                Text(list, "DAILY SUPPLIES (RECOVERY FLOOR)", "hub-card-title");
                Text(list, "+" + data.SupplyAmount + " Bell's Remains · Unconditional daily recovery floor", "hub-copy");
                Text(list, data.SupplyClaimed ? "Claimed for today." : now >= data.SupplyEnds ? "This supply day ended. Refresh for the new day." : "Ends " + EndsUtc(data.SupplyEnds), "hub-copy");
                string period = data.SupplyPeriod, summary = "Daily supplies · " + data.SupplyAmount + " Bell's Remains · " + period.Substring(7) + " UTC";
                var claim = Button(list, data.SupplyClaimed ? "CLAIMED" : "SUPPLIES", "errandsSupplies", () => _ = Actions.ExecuteAsync(UomdSavedAction.SuppliesPath, new Dictionary<string, object> { ["periodKey"] = period }, summary), "hub-primary");
                claim.SetEnabled(CanWrite && data.SupplyReady(now));
                if (!data.SupplyPeriodBound) Text(list, "Supplies are temporarily unavailable. Refresh to check again.", "hub-copy");
            }
            else if (_view == "patrol")
            {
                Text(list, "AFK PATROL", "hub-card-title"); var patrol = data.Afk;
                if (patrol == null) { Text(list, "Patrol is unavailable. Refresh to retry.", "hub-copy"); return; }
                Text(list, patrol.Unlocked ? patrol.Elapsed / 60 + "m / " + patrol.Cap / 60 + "m cap" : "Clear a battle stage to unlock AFK Patrol.", "hub-copy");
                Text(list, "Preview: " + RewardPlan(patrol.Rewards, null), "hub-copy");
                Text(list, "Actual settlement uses server time. Inventory caps apply.", "hub-small");
                var claim = Button(list, "COLLECT", "errandsPatrol", () => _ = Actions.ExecuteAsync(UomdSavedAction.PatrolPath, new Dictionary<string, object>(), "Collect accrued AFK Patrol · preview " + patrol.Elapsed / 60 + "m; actual settlement uses server time"), "hub-primary");
                claim.SetEnabled(CanWrite && patrol.Claimable);
            }
            else
            {
                bool weekly = _view == "weekly"; Text(list, weekly ? "THIS WEEK" : "THIS WINDOW", "hub-card-title");
                if (!weekly) Text(list, data.WindowEnds == 0 ? "No window errands right now." : now >= data.WindowEnds ? "This window ended. Refresh for the new window." : "Ends " + EndsUtc(data.WindowEnds), "hub-copy");
                var rows = data.Rows.Where(r => r.Weekly == weekly).ToList();
                if (rows.Count == 0) Text(list, "No errands right now.", "hub-copy");
                foreach (var row in rows)
                {
                    var card = Panel(list, "system-card"); Text(card, row.Title, "hub-card-title");
                    Text(card, row.Progress + "/" + row.Target + " · " + (row.Claimed ? "Claimed" : row.Done ? "Ready" : "In progress"), "hub-copy");
                    Text(card, "Rewards: " + RewardPlan(row.Rewards, row.Names), "hub-copy");
                    if (weekly) Text(card, row.Running && now < row.End ? "Ends " + EndsUtc(row.End) : "Claim before it expires.", "hub-small");
                    string period = row.Period, task = row.Id, summary = row.Title + " · " + (weekly ? "weekly" : "window") + " · " + DateTimeOffset.FromUnixTimeMilliseconds(row.End).UtcDateTime.ToString("yyyy-MM-dd HH:mm", System.Globalization.CultureInfo.InvariantCulture) + " UTC · " + RewardPlan(row.Rewards, row.Names);
                    var claim = Button(card, row.Claimed ? "CLAIMED" : "CLAIM", "errandClaim_" + task + "_" + UomdBattleWire.Hash(period).Substring(0, 8), () => _ = Actions.ExecuteAsync(UomdSavedAction.TaskPath, new Dictionary<string, object> { ["periodKey"] = period, ["taskId"] = task }, summary), "hub-primary");
                    claim.SetEnabled(CanWrite && row.CanClaim(now));
                }
            }
        }
        private static string EndsUtc(long milliseconds) => DateTimeOffset.FromUnixTimeMilliseconds(milliseconds).UtcDateTime.ToString("yyyy-MM-dd HH:mm", System.Globalization.CultureInfo.InvariantCulture) + " UTC";
        internal static string RewardPlan(IEnumerable<object> rewards, Dictionary<string, object> names)
        {
            var parts = rewards.Select(reward =>
            {
                string type = JsonRead.Str(reward, "type"); if (type == "currency" || type == "account_xp") return RewardText(reward);
                string id = JsonRead.Str(reward, type == "gear" ? "gearId" : "itemId");
                string name = names != null && names.TryGetValue(id, out var value) && value is string text ? text : HubText.IdLabel(id);
                return type == "item" ? name + " ×" + JsonRead.Int(reward, "quantity") : name;
            }).ToList();
            return parts.Count == 0 ? "No attachment" : string.Join(" · ", parts);
        }
    }
}
