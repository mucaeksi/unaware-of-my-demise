#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UIElements;

namespace Uomd.UI
{
    /// <summary>
    /// Unity 6 Runtime UI Toolkit port of apps/game/src/ui/domKit.ts and UomdUiKit.cs.
    /// Provides reusable Gothic buttons, HP/Focus bars, economy cost-gate modals (R10/R15),
    /// inert background focus trapping, and toast notifications.
    /// </summary>
    public static class UomdUiKit
    {
        public static Button CreateButton(string text, Action onClick, bool primary = false, bool danger = false)
        {
            var btn = new Button(onClick) { text = text };
            btn.AddToClassList("uomd-btn");
            if (primary) btn.AddToClassList("uomd-btn-primary");
            if (danger) btn.AddToClassList("uomd-btn-danger");
            return btn;
        }

        public static VisualElement CreateProgressBar(float initialRatio = 1f, bool isFocusBar = false)
        {
            var track = new VisualElement();
            track.AddToClassList("uomd-bar-track");

            var fill = new VisualElement();
            fill.AddToClassList(isFocusBar ? "uomd-focus-fill" : "uomd-bar-fill");
            UpdateProgressBar(fill, initialRatio, isHpBar: !isFocusBar);

            track.Add(fill);
            return track;
        }

        public static void UpdateProgressBar(VisualElement fill, float ratio, bool isHpBar = true)
        {
            float clamped = Mathf.Clamp01(ratio);
            fill.style.width = Length.Percent(clamped * 100f);
            if (isHpBar)
            {
                fill.style.backgroundColor = UomdThemeTokens.HpBarColor(clamped);
            }
        }

        /// <summary>
        /// Displays an accessible, focus-trapped Gothic confirmation modal with explicit cost/gate disclosure (R10).
        /// Marks sibling content disabled (inert) while open and binds Escape / Android Back to Cancel.
        /// </summary>
        public static async Awaitable<bool> ShowConfirmModalAsync(
            VisualElement rootDocumentElement,
            string title,
            string bodyText,
            string? costDisclosureText = null,
            string confirmLabel = "CONFIRM",
            string cancelLabel = "CANCEL",
            CancellationToken ct = default)
        {
            VisualElement modalHost = rootDocumentElement.Q<VisualElement>("modal-layer") ?? rootDocumentElement;
            VisualElement? safeContent = rootDocumentElement.Q<VisualElement>("safe-area-root");
            safeContent?.SetEnabled(false);

            var backdrop = new VisualElement { name = "modal-backdrop" };
            backdrop.AddToClassList("uomd-modal-backdrop");
            backdrop.pickingMode = PickingMode.Position;

            var card = new VisualElement { name = "modal-card" };
            card.AddToClassList("uomd-modal-card");

            var titleLabel = new Label(title);
            titleLabel.AddToClassList("uomd-title-h2");
            card.Add(titleLabel);

            var bodyLabel = new Label(bodyText);
            bodyLabel.AddToClassList("uomd-body-text");
            bodyLabel.style.marginTop = 16;
            card.Add(bodyLabel);

            if (!string.IsNullOrEmpty(costDisclosureText))
            {
                var costLabel = new Label(costDisclosureText);
                costLabel.AddToClassList("uomd-small-text");
                costLabel.style.color = UomdThemeTokens.GoldHi;
                costLabel.style.marginTop = 14;
                card.Add(costLabel);
            }

            var actionsRow = new VisualElement();
            actionsRow.style.flexDirection = FlexDirection.Row;
            actionsRow.style.justifyContent = Justify.FlexEnd;
            actionsRow.style.marginTop = 28;

            var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

            var cancelBtn = CreateButton(cancelLabel, () => tcs.TrySetResult(false), primary: false);
            cancelBtn.style.marginRight = 20;
            var confirmBtn = CreateButton(confirmLabel, () => tcs.TrySetResult(true), primary: true);

            actionsRow.Add(cancelBtn);
            actionsRow.Add(confirmBtn);
            card.Add(actionsRow);
            backdrop.Add(card);

            void OnKeyDown(KeyDownEvent evt)
            {
                if (evt.keyCode == KeyCode.Escape)
                {
                    evt.StopPropagation();
                    tcs.TrySetResult(false);
                }
            }

            backdrop.RegisterCallback<KeyDownEvent>(OnKeyDown);
            modalHost.Add(backdrop);
            confirmBtn.Focus();

            try
            {
                using var reg = ct.Register(() => tcs.TrySetCanceled(ct));
                return await tcs.Task;
            }
            finally
            {
                await Awaitable.MainThreadAsync();
                backdrop.UnregisterCallback<KeyDownEvent>(OnKeyDown);
                backdrop.RemoveFromHierarchy();
                safeContent?.SetEnabled(true);
            }
        }

        public static void ShowToast(VisualElement rootDocumentElement, string message, float durationSeconds = 2.4f)
        {
            _ = ShowToastAsync(rootDocumentElement, message, durationSeconds);
        }

        public static async Awaitable ShowToastAsync(
            VisualElement rootDocumentElement,
            string message,
            float durationSeconds = 2.4f,
            CancellationToken ct = default)
        {
            VisualElement toastHost = rootDocumentElement.Q<VisualElement>("toast-layer") ?? rootDocumentElement;
            var toast = new VisualElement();
            toast.AddToClassList("uomd-toast");

            var label = new Label(message);
            label.AddToClassList("uomd-small-text");
            label.style.color = UomdThemeTokens.GoldHi;
            toast.Add(label);

            toastHost.Add(toast);
            try
            {
                await Awaitable.WaitForSecondsAsync(durationSeconds, ct);
            }
            catch (OperationCanceledException)
            {
                // Clean exit on scene unload
            }
            finally
            {
                toast.RemoveFromHierarchy();
            }
        }
    }
}
