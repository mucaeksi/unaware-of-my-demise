# R10 — Layout Review, Safe Areas, Accessibility & Chibi Production Contract

## 1. Battle Layout Candidates & Locked Selection

All three battle layout candidates specified in `README.md` (`R10`, `D-40`, `D-33`) are implemented in [`apps/game/src/battle/formation.ts`](../apps/game/src/battle/formation.ts) and selectable at runtime via `?battleLayout=A|B|C` (`current|arena_lite|afk_faithful`) or the `LAYOUT` toggle in **Settings**:

| Code | Candidate ID | Description | Status |
|---|---|---|---|
| **A** | `current` | Compact 2-front / 3-rear formation with wider horizontal spread (`frontX = 590`, `rearX = 330`). | Available via `?battleLayout=A` or Settings |
| **B** | `arena_lite` | Open center arena with deeper flank columns (`frontX = 640`, `rearX = 360`) and tighter vertical band (`285..655`). | Available via `?battleLayout=B` or Settings |
| **C** | `afk_faithful` | **Selected Default (`D-40`)**: AFK Journey–inspired 2-front / 3-rear staggered columns (`frontX = 690`, `rearX = 390`) with interleaved vertical bands (`[260, 455, 650]` rear / `[355, 550]` front) guaranteeing `>= 95 px` vertical separation across all 5 slots per side so HP/Energy bars, status badges, and turn indicators never collide on 5v5 boards. | **Default (`afk_faithful`)** |

## 2. Locked Chibi Production Contract (`LOCKED_CHIBI_CONTRACT`)

Before R11 generates final character chibis, [`LOCKED_CHIBI_CONTRACT`](../apps/game/src/battle/formation.ts) locks the exact geometry, anchor, and status/HUD budgets:

| Property | Locked Value | Rationale |
|---|---|---|
| `canvasWidthPx` × `canvasHeightPx` | `512 × 512` | Square atlas cell for consistent scaling and GPU packing |
| `standingHeightPx` | `250` | Reference height in the `1920 × 1080` virtual frame (`scale = 250 / heightPx`) |
| `pivotX` / `footY` | `0.5` / `0.92` | Foot-planted origin (`setOrigin(pivotX, footY)`) on the ground shadow ellipse |
| `headToBodyRatio` | `'1:2.2'` | Gothic anime tactical chibi proportions |
| `minInterSlotVerticalPx` | `85` | Minimum Y gap between any two slots on a side (`afk_faithful` achieves `95 px`) |
| `hudOffsetAboveFootPx` | `-272` | Nameplate, HP/Energy bars, and status shape+text badges sit clear of the head silhouette |
| `allyFacing` / `enemyFacing` | `'right'` / `'left'` | Allies face right (`+X`); enemies face left (`-X`) |

## 3. Companion Growth Screen Pre-Action & Post-Action Legibility

Implemented in [`apps/game/src/ui/growth.ts`](../apps/game/src/ui/growth.ts) and [`apps/game/src/scenes/CharacterScene.ts`](../apps/game/src/scenes/CharacterScene.ts):

- **Pre-Action Plan (`planLevelUp`, `planAscension`, `planSkillUpgrade`):**
  - Material costs (`have/need`) and main currency fee (`Bell's Remains`).
  - Resulting companion level, XP (`toXp / toXpNext`), level cap, and skill rank (`Rank x → y/max`).
  - Remaining wallet after the action (`balance - fee`) and exact wasted XP at cap (`wastedXp`).
  - Explicit gate reason when disabled (`account_level`, `ascension_cap`, `not_at_cap`, `story_gate`, `level_too_low`, `missing_xp_item`, `xp_overflow`, `insufficient_items`, `insufficient_funds`).
- **Post-Action Outcome Banner (`lastOutcome`):**
  - Persists across `CharacterScene.refresh()` after Level Up, Ascension, or Skill Rank Up so the player can read the exact level/cap/rank transition, materials and currency spent, wasted XP, and new wallet balance.

## 4. Safe Areas, Display Tiers, WebGL Recovery & Accessibility

- **Safe-Area Reflow ([`apps/game/src/platform/safeArea.ts`](../apps/game/src/platform/safeArea.ts)):**
  - Reads CSS `env(safe-area-inset-*)` and supports `?safeInsets=top,right,bottom,left` / `window.__UOMD_SAFE_INSETS__` for automated notched-device verification across `TitleScene`, `HubScene`, `BattleScene`, `PrologueScene`, and `StoryScene`.
- **Accessibility & Non-Color Cues ([`apps/game/src/platform/a11y.ts`](../apps/game/src/platform/a11y.ts), [`apps/game/src/ui/kit.ts`](../apps/game/src/ui/kit.ts), [`apps/game/src/battle/UnitView.ts`](../apps/game/src/battle/UnitView.ts)):**
  - Hidden DOM `<button>` proxies (`#a11y-layer`, `pointer-events: none`) and `aria-live="polite"` announcer (`#a11y-live`) for TalkBack / screen readers and `Tab` / `Enter` / `Space` keyboard focus navigation with visible gold focus rings.
  - Preferences in [`apps/game/src/platform/prefs.ts`](../apps/game/src/platform/prefs.ts): `textSize` (`normal` | `large`), `highContrast`, `reduceFlash`, `reducedMotion`, `qualityTier` (`auto` | `low` | `medium` | `high`), and `battleLayout`.
  - Non-color combat status cues: `▲` buff, `▼` debuff, `◆` control/stagger, `⛨` shield.
- **Checkpoint-Safe WebGL Context Recovery ([`apps/game/src/platform/graphics.ts`](../apps/game/src/platform/graphics.ts)):**
  - Emits `webgl:contextlost` so `PrologueScene` and `StoryScene` flush durable checkpoints immediately, displays a recovery overlay (`#context-recovery`) with `RECOVER FROM CHECKPOINT`, refreshes textures on `webglcontextrestored`, and restarts the interrupted scene cleanly.
