using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Core;

namespace Uomd.Scenes
{
    public sealed class SavedActionsScreen : RebuildHubScreen
    {
        private string _loadedScope;
        public SavedActionsScreen(UomdSceneRouter router) : base(router) { }
        public override UomdScreenId ScreenId => UomdScreenId.Operations;
        protected override string Heading => "SAVED ACTIONS";
        protected override void DrawContent(UomdHubSnapshot snapshot)
        {
            var main = Panel(Body, "hub-main"); var list = Scroll(main);
            if (!snapshot.SignedIn) { Text(list, "Sign in to recover this account's saved actions.", "hub-copy"); return; }
            var action = Actions.Current ? Actions.Action : null;
            Text(list, "COMPANION GROWTH & SWEEP", "hub-card-title");
            Text(list, action == null ? "No saved companion or Sweep action." : action.State == "confirmed" ? "CONFIRMED" : action.State == "rejected" ? "DECLINED" : "CONFIRMATION PENDING", "hub-copy");
            if (action != null)
            {
                var body = action.Body;
                string character = action.Path.Split('/')[4];
                string companion = snapshot.Companions.FirstOrDefault(c => c.Id == character)?.Name ?? "Saved companion";
                string stage = snapshot.Nodes.FirstOrDefault(n => n.Id == JsonRead.Str(body, "nodeId"))?.Title ?? "Saved stage";
                Text(list, action.Path == UomdSavedAction.SweepPath ? stage + " · Sweep ×" + JsonRead.Int(body, "count") : companion + " · " + action.Path.Split('/').Last().Replace('-', ' '), "hub-copy");
                if (action.Release != snapshot.Release) Text(list, "This saved action uses earlier content. Recovery checks its original result.", "hub-small");
                Text(list, Actions.Notice, "hub-small");
                Text(list, action.Summary.Length > 0 ? "Original plan: " + action.Summary : "Original cost details are unavailable. Only the saved result can be checked safely.", "hub-copy");
                if (action.State == "confirmed" && action.Path == UomdSavedAction.SweepPath)
                    Text(list, "Confirmed rewards: " + string.Join(" · ", JsonRead.Arr(UomdJson.ParseObject(action.Receipt), "rewards").Select(RewardText)), "hub-copy");
                var retry = Button(list, action.State != "confirmed" && action.Summary.Length > 0 ? "CHECK / RETRY ORIGINAL ACTION" : "CHECK ORIGINAL ACTION & REFRESH", "savedActionRetry", () => _ = Actions.RecoverAsync(), "hub-primary"); retry.SetEnabled(!Actions.Busy);
            }
            var campaign = Router.EntryFlow.Campaign;
            string scope = Router.Api.AccountKey + ":" + Router.Api.AuthRevision;
            if (_loadedScope != scope) { _loadedScope = scope; _ = LoadBattle(scope); }
            var battle = campaign.IsCurrent ? campaign.Operation : null;
            Text(list, "CAMPAIGN BATTLE", "hub-card-title");
            Text(list, battle == null ? "No saved campaign battles." : (snapshot.Nodes.FirstOrDefault(n => n.Id == battle.Node)?.Title ?? "Saved battle") + " · " + battle.State.ToUpperInvariant(), "hub-copy");
            Text(list, campaign.Notice, "hub-small");
            if (battle?.State == "confirmed") Text(list, BattleReceipt.Parse(battle.ReceiptJson).Stars + " stars confirmed. Your rewards and progress are saved to your account.", "hub-copy");
            if (battle != null && battle.State != "fighting")
            {
                var retry = Button(list, battle.Pending ? "CHECK / RETRY ORIGINAL RESULT" : "REFRESH BATTLE ACCOUNT", "saved-battle-retry", () => _ = RecoverBattle(), "hub-primary"); retry.SetEnabled(!campaign.Busy && !Actions.Busy);
            }
            if (battle?.Pending != true)
            {
                bool resume = Router.EntryFlow.CanResumeCampaignStory;
                Button(list, resume ? "CONTINUE STORY" : "CHAPTERS", resume ? "saved-battle-story" : "saved-battle-chapters", () => { if (resume) _ = Router.EntryFlow.ResumeCampaignStoryAsync(); else Navigate(UomdScreenId.Chapters); });
            }
        }
        private async Awaitable LoadBattle(string scope)
        {
            try { await Router.EntryFlow.Campaign.BindAsync(); }
            catch (Exception) { }
            if (Router.ActiveScreenId == ScreenId && _loadedScope == scope) Draw();
        }
        private async Awaitable RecoverBattle()
        {
            if (Actions.Busy || Router.EntryFlow.Campaign.Busy) return;
            await Router.EntryFlow.Campaign.RecoverAsync();
            if (Router.ActiveScreenId == ScreenId) { await Data.RefreshAsync(); if (Router.ActiveScreenId == ScreenId) Draw(); }
        }
    }
}
