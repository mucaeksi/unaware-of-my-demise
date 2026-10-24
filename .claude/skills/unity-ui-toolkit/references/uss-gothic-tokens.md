# UOMD Gothic USS Tokens & Safe Area Binding

## `Assets/_UOMD/UI/USS/uomd-tokens.uss`

```css
:root {
    --color-obsidian: #07050c;
    --color-obsidian-panel: rgba(14, 11, 22, 0.92);
    --color-parchment: #f2e9dc;
    --color-parchment-muted: #b5a99a;
    --color-gold: #d6b36a;
    --color-gold-dim: rgba(214, 179, 106, 0.38);
    --color-crimson: #b84a59;
    --font-display: url("project://database/Assets/_UOMD/UI/Fonts/Cinzel-Bold%20SDF.asset");
    --font-body: url("project://database/Assets/_UOMD/UI/Fonts/CormorantGaramond-Regular%20SDF.asset");
}

.uomd-panel {
    background-color: var(--color-obsidian-panel);
    border-width: 1px;
    border-color: var(--color-gold-dim);
    border-radius: 4px;
    padding: 16px;
}

.uomd-btn-primary {
    min-height: 64px;
    min-width: 180px;
    background-color: rgba(184, 74, 89, 0.25);
    border-width: 1px;
    border-color: var(--color-gold);
    color: var(--color-parchment);
    -unity-font-definition: var(--font-display);
    font-size: 20px;
    letter-spacing: 2px;
    -unity-text-align: middle-center;
    transition-property: scale, background-color;
    transition-duration: 0.12s;
}

.uomd-btn-primary:hover,
.uomd-btn-primary:focus {
    background-color: rgba(184, 74, 89, 0.48);
    scale: 1.02 1.02;
}

.uomd-btn-primary:active {
    scale: 0.97 0.97;
}

.decorative-overlay {
    picking-mode: ignore;
}
```

## Applying `Screen.safeArea` to a Runtime `UIDocument`

```csharp
using UnityEngine;
using UnityEngine.UIElements;

namespace Uomd.UI
{
    public static class SafeAreaBinder
    {
        public static void ApplySafeArea(VisualElement safeRoot, IPanel panel)
        {
            if (safeRoot == null || panel == null || Screen.width <= 0 || Screen.height <= 0) return;

            Rect safe = Screen.safeArea;
            Vector2 topLeft = RuntimePanelUtils.ScreenToPanel(panel, new Vector2(safe.xMin, Screen.height - safe.yMax));
            Vector2 bottomRight = RuntimePanelUtils.ScreenToPanel(panel, new Vector2(Screen.width - safe.xMax, safe.yMin));

            safeRoot.style.paddingLeft = Mathf.Max(0f, topLeft.x);
            safeRoot.style.paddingTop = Mathf.Max(0f, topLeft.y);
            safeRoot.style.paddingRight = Mathf.Max(0f, bottomRight.x);
            safeRoot.style.paddingBottom = Mathf.Max(0f, bottomRight.y);
        }
    }
}
```
