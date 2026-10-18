---
name: phaser4-battle
description: Design or implement the Unaware of My Demise five-versus-five tactical turn-based battle engine, PixiJS v8 SD Chibi combat presentation, Gothic DOM battle HUD, auto battle and data-driven skills.
---
# Turn-based 5v5 Battle Engine (PixiJS v8 Stage + DOM HUD)
- Battle simulation must be framework-agnostic: pure deterministic TypeScript state transitions (`@uomd/combat`) with explicit seeds and action logs.
- PixiJS v8 + DOM HUD presents state (`BattleScene`, `UnitView`, `BattleVfx`); it must not determine trusted economy rewards. Backend validates authoritative actions and payouts.
- Five playable slots, target selection, turn priority, modifiers, status effects, cooldowns, Focus ultimates, boss phases and scripted environmental targets.
- Design effect registries that interpret validated, versioned JSON, not arbitrary downloaded JavaScript.
- Character skills are derived from approved `narrative/` canon where relevant; gameplay details absent from canon require owner approval.
- Build Auto, Sweep and AFK claims as server-checked mechanisms; never trust the device clock for reward accumulation.
- Test determinism, invalid targets, simultaneous effects, reconnect/resume, slow devices, buff expiration and zero-health edge cases.
- Include visually legible 0.72x 2-head SD Chibi animation synchronization, GPU slash/bell VFX (`BattleVfx`), hit-stop freeze frames, directional camera shake, and caption/feedback accessibility.
