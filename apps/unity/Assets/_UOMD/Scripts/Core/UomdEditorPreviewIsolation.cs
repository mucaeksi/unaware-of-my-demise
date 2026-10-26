#if UNITY_EDITOR
namespace Uomd.Core
{
    /// <summary>Editor review sessions never inherit accounts, persist preferences or contact the API.</summary>
    public static class UomdEditorPreviewIsolation
    {
        public const string ActiveKey = "Uomd.ProductionReview.Active";
        public static bool Active => UnityEditor.SessionState.GetBool(ActiveKey, false);
    }
}
#endif
