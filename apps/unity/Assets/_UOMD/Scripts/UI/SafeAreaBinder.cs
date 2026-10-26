#nullable enable
using UnityEngine;
using UnityEngine.UIElements;

namespace Uomd.UI
{
    /// <summary>
    /// Zero-GC Screen.safeArea adapter for Unity 6 Runtime UI Toolkit (UIDocument).
    /// Converts physical cutout / gesture bar insets into 1920x1080 panel coordinates only when
    /// screen dimensions or safe-area rects change.
    /// </summary>
    [RequireComponent(typeof(UIDocument))]
    public sealed class SafeAreaBinder : MonoBehaviour
    {
        [SerializeField] private string _safeAreaElementName = "safe-area-root";
        [SerializeField] private bool _applyPaddingToRoot;

        private UIDocument? _document;
        private VisualElement? _safeRoot;
        private Rect _lastSafeArea;
        private Vector2Int _lastScreenSize;

        public Vector4 BandInsets { get; private set; }

        private void Awake()
        {
            TryGetComponent(out _document);
        }

        private void OnEnable()
        {
            if (_document != null && _document.rootVisualElement != null)
            {
                _safeRoot = _document.rootVisualElement.Q<VisualElement>(_safeAreaElementName)
                            ?? _document.rootVisualElement;
                _lastSafeArea = Rect.zero;
                RefreshIfNeeded(force: true);
            }
        }

        private void Update()
        {
            RefreshIfNeeded(force: false);
        }

        private void RefreshIfNeeded(bool force)
        {
            if (_safeRoot == null || _safeRoot.panel == null) return;
            Rect safe = Screen.safeArea;
            var screenSize = new Vector2Int(Screen.width, Screen.height);
            if (!force && safe == _lastSafeArea && screenSize == _lastScreenSize) return;

            _lastSafeArea = safe;
            _lastScreenSize = screenSize;
            BandInsets = ComputeBandInsets(safe, screenSize.x, screenSize.y);
            if (_applyPaddingToRoot)
            {
                ApplySafeArea(_safeRoot, _safeRoot.panel, safe, screenSize.x, screenSize.y);
            }
        }

        public static Vector4 ReadBandInsets(float refW = 1920f, float refH = 1080f, float maxInsetX = 220f, float maxInsetY = 120f)
        {
            return ComputeBandInsets(Screen.safeArea, Screen.width, Screen.height, refW, refH, maxInsetX, maxInsetY);
        }

        public static Vector4 ComputeBandInsets(Rect safe, int screenW, int screenH, float refW = 1920f, float refH = 1080f, float maxInsetX = 220f, float maxInsetY = 120f)
        {
            if (screenW <= 0 || screenH <= 0) return Vector4.zero;
            float scale = Mathf.Max(refW / screenW, refH / screenH);
            float panelW = screenW * scale;
            float panelH = screenH * scale;
            float bandX = (panelW - refW) * 0.5f;
            float bandY = (panelH - refH) * 0.5f;
            float left = Mathf.Clamp(safe.xMin * scale - bandX, 0f, maxInsetX);
            float right = Mathf.Clamp((screenW - safe.xMax) * scale - bandX, 0f, maxInsetX);
            float top = Mathf.Clamp((screenH - safe.yMax) * scale - bandY, 0f, maxInsetY);
            float bottom = Mathf.Clamp(safe.yMin * scale - bandY, 0f, maxInsetY);
            return new Vector4(left, top, right, bottom);
        }

        public static void ApplySafeArea(VisualElement safeRoot, IPanel panel, Rect safe, int screenW, int screenH)
        {
            if (screenW <= 0 || screenH <= 0) return;

            Vector2 topLeft = RuntimePanelUtils.ScreenToPanel(
                panel,
                new Vector2(safe.xMin, screenH - safe.yMax)
            );
            Vector2 bottomRight = RuntimePanelUtils.ScreenToPanel(
                panel,
                new Vector2(screenW - safe.xMax, safe.yMin)
            );

            safeRoot.style.paddingLeft = Mathf.Max(0f, topLeft.x);
            safeRoot.style.paddingTop = Mathf.Max(0f, topLeft.y);
            safeRoot.style.paddingRight = Mathf.Max(0f, bottomRight.x);
            safeRoot.style.paddingBottom = Mathf.Max(0f, bottomRight.y);
        }
    }
}
