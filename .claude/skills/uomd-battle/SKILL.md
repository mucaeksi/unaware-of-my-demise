---
name: uomd-battle
description: Design or implement the Unaware of My Demise 5v5 tactical turn-based battle — deterministic Uomd.Combat C# rules (matching @uomd/combat), UI Toolkit presentation (BattleScreenController, BattleUnitView, UomdVfxPlayer), Auto/Sweep/AFK foundations, and server verification.
---
# 5v5 turn-based battle (`Uomd.Combat` & `BattleScreenController`)

- Reference combat rules live in `packages/combat` (used by the Cloudflare Worker `/api/v1/battles/verify`) and are executed identically on the Unity 6 LTS client in `Uomd.Combat` (`apps/unity/Assets/_UOMD/Scripts/Combat/`) using `UomdCorePrimitives.g.cs` (`Mulberry32Rng`, IEEE-754 `double` math, `RoundHalfUp`). The battle screen (`Uomd.Scenes.BattleScreenController` with `BattleUnitView` chibis on UI Toolkit layers, ported from `BattleScene.ts`/`UnitView.ts`) only visualises engine events; the server re-simulates (`/api/v1/battles/verify`) and owns rewards. Formation spots come from `UomdBattleFormation` (tests from `formation.test.ts`).
- Five slots per side, manual skills/targets, Focus ultimates, status effects, cooldowns, boss phases/objectives; effects are interpreted from validated JSON (`units/unit_pack.json`, `encounters/*.json` through `PatchManager`), never downloaded code.
- Unresolved semantics are listed in README R06 and `docs/combat/OPS_SPEC.md` (proposals, not decisions). Never retune numbers to hide a semantic bug.
- VFX: `content/base/vfx/vfx_presets.json` played by `Uomd.Core.Vfx.VfxTimeline` (engine-free) and `Uomd.Scenes.UomdVfxPlayer` on UI Toolkit layers (ground under units, fx over them, overlay above the HUD): slash arcs, bell ripples, projectiles, pillars, camera cues (hit-stop, shake, flash). Respect `ReducedMotion` and `ReduceFlash`.
- Chibi units: `BattleUnitView` plays the atlas frame animation (states idle/walk/basic/active/ultimate/hit/defeat/victory from `art/art_manifest.json` via `UomdMediaCatalog`) as UI Toolkit background sprites cut with `Sprite.Create`; feet sit on the formation spot (`pivot_x`, `foot_y`).
- Test: `npm test -w @uomd/combat`, `npx vitest run tools/export_unity_bundle.test.ts`, `npm run test:unity-logic`, and `CombatParityTests` (171 golden replays from `tools/export_unity_combat_vectors.ts`). Capture QA plays T-1 on AUTO and saves `05-battle-vfx` / `05-battle-result`.
