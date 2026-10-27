using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;
using Uomd.Contracts;
using Uomd.Core;
using Uomd.UI;

namespace Uomd.Scenes
{
    public sealed partial class BattleScreenController
    {
        private void ShowCampaignResult()
        {
            if (_native) ClearNativeDock(); else ClearSkillDock();
            int generation = _generation;
            var campaign = _router.EntryFlow.Campaign;
            if (!campaign.IsCurrent || _entryScope != campaign.CallbackScope) return;
            var veil = UomdScreenKit.Layer(_root, new Color(0.020f, 0.012f, 0.039f, 0.95f));
            veil.name = "campaign-result"; veil.pickingMode = PickingMode.Position;
            UomdScreenKit.Centered(UomdScreenKit.Text(veil, "BATTLE WON", 76, UomdThemeTokens.GoldHi), 0, 300);
            var status = UomdScreenKit.Centered(UomdScreenKit.Text(veil, "Saving your original battle result…", 29, UomdThemeTokens.TextPrimary), 0, 455);
            status.name = "campaign-status"; status.style.width = 1200; status.style.whiteSpace = WhiteSpace.Normal;
            status.style.unityTextAlign = TextAnchor.MiddleCenter;
            Button retry = null, next = null, saved = null;
            retry = UomdScreenKit.MenuButton(veil, "RETRY CONFIRMATION", null, 610, 104, 30, true, () => _ = Confirm());
            retry.name = "campaign-retry"; UomdScreenKit.Centered(retry, 0, 640);
            next = UomdScreenKit.MenuButton(veil, "CONTINUE", null, 610, 104, 30, true, () =>
            {
                if (generation != _generation || _entryScope != campaign.CallbackScope || !_router.EntryFlow.CampaignIsCurrent || !campaign.Confirmed || !campaign.Refreshed) return;
                next.SetEnabled(false); _ = _router.EntryFlow.BattleFinishedAsync(true);
            });
            next.name = "campaign-continue"; UomdScreenKit.Centered(next, 0, 640); next.style.display = DisplayStyle.None;
            saved = UomdScreenKit.MenuButton(veil, "SAVED ACTIONS", null, 460, 80, 26, false, () => _ = _router.NavigateToAsync(UomdScreenId.Operations));
            saved.name = "campaign-saved-actions"; UomdScreenKit.Centered(saved, 0, 790);
            _ = Confirm();
            async Awaitable Confirm()
            {
                if (generation != _generation || campaign.Busy || _entryScope != campaign.CallbackScope || !campaign.IsCurrent) return;
                retry.SetEnabled(false); saved.SetEnabled(false);
                bool confirmed = await campaign.SubmitVictoryAsync(_actions.Select(a => new BattleActionInputDto { skillId = a.SkillId, targetId = a.TargetId }).ToArray());
                if (generation != _generation || !campaign.IsCurrent || _root == null) return;
                status.text = (campaign.MemoryOnly ? "REVIEW FIXTURE · " : "") + campaign.Notice;
                if (confirmed)
                {
                    var receipt = BattleReceipt.Parse(campaign.Operation.ReceiptJson);
                    status.text += "\n" + receipt.Stars + " stars confirmed by your account.";
                    retry.style.display = DisplayStyle.None; next.style.display = DisplayStyle.Flex; next.Focus();
                }
                else retry.SetEnabled(true);
                // Leaving before a failed disk write would discard an unjournaled victory.
                saved.SetEnabled(campaign.Operation?.State != "fighting");
            }
        }
    }
}
