---
name: unity-ui-toolkit
description: Design, build, and audit Gothic Dark Anime interfaces in Unity 6 LTS using Runtime UI Toolkit (UIDocument, PanelSettings, UXML, USS) and TextMeshPro SDF fonts (Cinzel, Cormorant Garamond) with safe-area adaptation, 48dp touch targets, and zero-GC query caching.
license: MIT
---
# Unity 6 Runtime UI Toolkit & Gothic Dark Anime UI

Use this skill when building or reviewing any screen, modal, HUD, or typography in `apps/unity/Assets/_UOMD/UI/` (`Uomd.UI`, `Uomd.Battle`, `Uomd.Narrative`).

## 1. PanelSettings & Reference Viewport
- **Reference Resolution**: `1920×1080` landscape (`Scale Mode = Scale With Screen Size`, `Screen Match Mode = Match Width Or Height`, `Match = 0.5`).
- **Sorting Order**:
  - `BattleHudPanel.asset` / `NarrativeHudPanel.asset`: `Sort Order = 10` (renders above URP 2D stage, below modals).
  - `HubMenuPanel.asset`: `Sort Order = 20` (Sanctum, Summon, Roster, Character, Team, Gear, Chapters, Modes).
  - `ModalOverlayPanel.asset`: `Sort Order = 50` (Reward popups, Purchase/Gacha confirmation gates, Settings, Error/Reconnect dialogs).
  - `PatchBarOverlayPanel.asset`: `Sort Order = 90` (Top-level non-blocking patch status indicator).

## 2. Gothic Visual Tokens (USS Variables)
Define all shared visual tokens in `Assets/_UOMD/UI/USS/uomd-tokens.uss` on `:root`:
- **Palette**:
  - `--color-obsidian: #07050c;` (deep background abyss)
  - `--color-obsidian-panel: rgba(14, 11, 22, 0.92);` (translucent gothic slate surface)
  - `--color-parchment: #f2e9dc;` (primary readable body text)
  - `--color-parchment-muted: #b5a99a;` (secondary metadata & labels)
  - `--color-gold: #d6b36a;` (antique gold borders, active accents, 5★ highlights)
  - `--color-crimson: #b84a59;` (danger, HP loss, primary oath action accents)
- **Typography**:
  - Display headings & uppercase buttons: `Cinzel` (`Assets/_UOMD/UI/Fonts/Cinzel-Regular SDF.asset`, `Cinzel-Bold SDF.asset`), `letter-spacing: 2px`.
  - Narrative dialogue, lore, and body copy: `Cormorant Garamond` (`CormorantGaramond-Regular SDF.asset`, `CormorantGaramond-SemiBold SDF.asset`).
  - Numeric combat readouts / timers: tabular spacing so digits never jitter during countdowns.

## 3. UI Toolkit Performance & Interaction Rules
1. **Cache Queries in `OnEnable()`**:
   - Call `rootVisualElement.Q<Button>("summon-ten-btn")` once inside `OnEnable()` and store the reference in a private field. Never call `Q<T>()` or `Query<T>()` per frame.
2. **`picking-mode: ignore` on Decorative Layers**:
   - Every non-interactive container, vignette border, filigree corner ornament, or background overlay in UXML must set `picking-mode="Ignore"` (or `picking-mode: ignore;` in USS) so pointer events reach underlying buttons and stage targets without raycast traps.
3. **Physical Touch Targets & Safe Areas**:
   - Interactive buttons must be at least `48×48 dp` (`>= 64×64 px` at `1920×1080` reference resolution).
   - `SafeAreaMonitor` converts `Screen.safeArea` into normalized panel insets and applies `padding-left`, `padding-right`, `padding-top`, and `padding-bottom` to `.safe-area-root` so camera cutouts and Android gesture bars never clip HUD controls.
4. **Economy & Gacha Transparency (R10/R15)**:
   - Before any `eclipse_token` spend, display exact cost, current balance, and gate reason.
   - Keep Gacha drop rates, pity counter (`80` hard pity / `50%` featured), and pull history accessible within 1 tap on the Summon screen.
5. **Modal Focus & Escape/Back Handling**:
   - Opening a modal marks background views `SetEnabled(false)` / `focusable = false`, focuses the primary modal control, and binds Android hardware Back (`KeyCode.Escape` / Input System `Cancel`) to close or cancel safely.

## Reference Guides
- [Gothic USS Tokens & Safe Area Adapter](references/uss-gothic-tokens.md)
