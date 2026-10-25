# UOMD USS tokens (as implemented)

Source: `apps/unity/Assets/_UOMD/UI/USS/uomd-tokens.uss` (ported from `apps/game/src/ui/theme.ts`), mirrored in C# by
`Uomd.UI.UomdThemeTokens`. Read the file itself before editing; this page only orients.

| Variable | Value | C# |
| --- | --- | --- |
| `--color-void` | `#0a0610` | `UomdThemeTokens.Void` |
| `--color-ink` | `#120a18` | `Ink` |
| `--color-ink-panel` | `rgba(18,10,24,0.94)` | — |
| `--color-plum` / `--color-plum-hi` | `#2a1530` / `#4a2548` | `Plum` / `PlumHi` |
| `--color-silver` | `#c9b6e4` | `Silver` |
| `--color-bone` | `#e9e2d4` | `Bone` |
| `--color-text` / `--color-dim` | `#efe8f5` / `#a99bb8` | `TextPrimary` / `TextDim` |
| `--color-gold` / `--color-gold-hi` | `#b8975a` / `#e3c37d` | `Gold` / `GoldHi` |
| `--color-crimson` / `--color-crimson-hi` | `#8f1d3a` / `#d4325c` | `Crimson` / `CrimsonHi` |
| `--color-veil` | `#b48cff` | `Veil` |
| HP / focus / shield | `#6fbf73` `#d9a441` `#c8324a` / `#8fb8ff` / `#9fd0ff` | `HpGood` `HpMid` `HpLow` / `Focus` / `Shield` |

Classes the C# screens use: `.uomd-screen-root`, `.uomd-panel`, `.uomd-display` (Cinzel), `.uomd-serif` (Cormorant),
`.uomd-btn`, `.uomd-btn-primary`, `.uomd-title-*`, `.uomd-body`, `.uomd-caption`, `.uomd-card`, `.uomd-modal-*`.
Fonts need both `-unity-font: url("project://database/Assets/_UOMD/UI/Fonts/<file>.ttf")` and
`-unity-font-definition: initial`.

Safe area: `Uomd.UI.SafeAreaBinder` converts `Screen.safeArea` to panel units with `RuntimePanelUtils.ScreenToPanel` and pads
the element named `safe-area-root` (or the document root).
