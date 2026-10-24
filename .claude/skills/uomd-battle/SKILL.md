---
name: uomd-battle
description: Design or implement the Unaware of My Demise 5v5 tactical turn-based battle — deterministic Uomd.Combat C# rules (matching @uomd/combat), Unity 6 URP 2D BattleStageController/ChibiUnitView/BattleVfxStage presentation, UI Toolkit battle HUD, Auto/Sweep/AFK foundations, and server verification.
---
# 5v5 turn-based battle (`Uomd.Combat` & `Uomd.Battle`)

> **Reality check (2026-10-24):** project class names in this skill that are not listed in `uomd-unity-engine` → *Verified assembly and type inventory* are planned designs, not existing code. Verify with `rg` before referencing them.

- Reference combat rules live in `packages/combat` (used by the Cloudflare Worker `/api/v1/battles/verify`) and are executed identically on the Unity 6 LTS client in `Uomd.Combat` (`apps/unity/Assets/_UOMD/Scripts/Combat/`) using `UomdCorePrimitives.g.cs` (`Mulberry32Rng`, IEEE-754 `double` math, `RoundHalfUp`). The URP 2D stage (`Uomd.Battle` — `BattleStageController`, `ChibiUnitView`, `BattleVfxStage`) only visualises state; the server re-simulates (`/api/v1/battles/verify`) and owns rewards.
- Five slots per side, manual skills/targets, Focus ultimates, status effects, cooldowns, boss phases/objectives; effects are interpreted from validated versioned JSON in `StreamingAssets/uomd_base/combat/`, never downloaded code.
- Unresolved semantics are listed in README R06 and `docs/combat/OPS_SPEC.md` (proposals, not decisions). Never retune numbers to hide a semantic bug.
- VFX: `BattleVfxStage` on the Unity 6 URP 2D stage (`SortingLayer: VfxBehind` / `VfxFront`) — slash arcs, bell ripples, hit-stop (`BattleClock`), directional camera shake, and pooled damage popups driven by `content/base/vfx/vfx_presets.json`. Respect the quality tier (`QualityTierService`) and `ReducedMotion` accessibility setting.
- Chibi units: 2-head SD sprites sliced at runtime via `Sprite.Create` (`PixelsPerUnit = 100f`, `SpriteMeshType.FullRect`) using the precomputed Unity bottom-left foot pivot (`unity_pivot: { x, y }`) from `StreamingAssets/uomd_metadata/unity_*_art_slices.json` (`ChibiAtlasSlicer`).
- Test: `npm test -w @uomd/combat`, `npx vitest run tools/export_unity_bundle.test.ts`, `npm run test:unity-logic`, and (to be written) a C# combat replay parity suite covering determinism/replay `log_hash`, invalid targets, zero-HP and expiry edges, and reconnect/resume.
