---
name: uomd-battle
description: Design or implement the Unaware of My Demise 5v5 tactical turn-based battle — deterministic @uomd/combat rules, BattleScene/UnitView/BattleVfx presentation on the PixiJS v8 stage, battle HUD, Auto/Sweep/AFK foundations and server verification.
---
# 5v5 turn-based battle

- Rules live in `packages/combat` as pure deterministic TypeScript (explicit seeds, action logs, replay). The PIXI presentation (`apps/game/src/battle`, `scenes/BattleScene.ts`) only visualises state; the server re-simulates (`/api/v1/battles/verify`) and owns rewards.
- Five slots per side, manual skills/targets, Focus ultimates, status effects, cooldowns, boss phases/objectives; effects are interpreted from validated versioned JSON, never downloaded code.
- Unresolved semantics are listed in README R06 and `docs/combat/OPS_SPEC.md` (proposals, not decisions). Never retune numbers to hide a semantic bug.
- VFX: `battle/BattleVfx.ts` on the PIXI stage — slash arcs, bell ripples, hit-stop, directional shake, damage text. For new effects prefer core PIXI filters plus `pixi-filters` v6 (glow, bloom, shockwave, god rays, motion blur) and atlas particles; respect the quality tier (`qualityProfile().particles/particleDensity/vignette`) and the reduced-motion preference.
- Chibi units: 2-head SD sprites at the battle scale used by `battle/formation.ts`; pivots/foot points come from the art manifest.
- Test: `npm test -w @uomd/combat`, determinism/replay vectors, invalid targets, zero-HP and expiry edges, reconnect/resume; browser smoke `?preview_scene=battle_t1`.
