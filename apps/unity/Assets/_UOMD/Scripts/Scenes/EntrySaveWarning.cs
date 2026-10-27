using System;
using UnityEngine;
using UnityEngine.UIElements;

namespace Uomd.Scenes
{
    /// <summary>A failed local write must remain visible before the player reaches Finish or leaves the story.</summary>
    internal sealed class EntrySaveWarning : VisualElement
    {
        private readonly Label _message;
        private readonly Button _retry;
        public EntrySaveWarning(Action retry)
        {
            name = "entrySaveWarning";
            style.position = Position.Absolute;
            style.top = 12;
            style.left = style.right = Length.Percent(22);
            style.flexDirection = FlexDirection.Row;
            style.alignItems = Align.Center;
            style.paddingLeft = style.paddingRight = 18;
            style.paddingTop = style.paddingBottom = 12;
            style.backgroundColor = new Color(0.23f, 0.08f, 0.15f, 0.98f);
            style.borderLeftWidth = style.borderRightWidth = style.borderTopWidth = style.borderBottomWidth = 1;
            style.borderLeftColor = style.borderRightColor = style.borderTopColor = style.borderBottomColor = new Color(0.85f, 0.48f, 0.58f);
            _message = new Label { name = "entrySaveWarningText", pickingMode = PickingMode.Ignore };
            _message.style.flexGrow = 1; _message.style.flexShrink = 1;
            _message.style.whiteSpace = WhiteSpace.Normal; _message.style.fontSize = 24;
            _message.style.color = new Color(1f, 0.9f, 0.92f);
            _retry = new Button(retry) { name = "entryRetrySave", text = "RETRY SAVE" };
            _retry.style.minWidth = 180; _retry.style.minHeight = 68; _retry.style.marginLeft = 18;
            _retry.style.fontSize = 22; _retry.style.color = new Color(1f, 0.93f, 0.84f);
            _retry.style.backgroundColor = new Color(0.33f, 0.14f, 0.24f);
            Add(_message); Add(_retry);
            style.display = DisplayStyle.None;
        }
        public void Refresh(UomdEntryContinuity continuity, bool entryScreen)
        {
            bool failed = entryScreen && continuity != null && continuity.IsCurrent && !continuity.LocalSaved;
            style.display = failed ? DisplayStyle.Flex : DisplayStyle.None;
            if (!failed) return;
            _message.text = (continuity.MemoryOnly ? "REVIEW FIXTURE · " : "") + "Your latest place is not saved on this device. Retry before leaving.";
        }
    }
}
