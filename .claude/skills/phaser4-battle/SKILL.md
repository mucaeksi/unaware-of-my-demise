---
name: phaser4-battle
description: Design or implement the Unaware of My Demise five-versus-five tactical turn-based battle engine, chibi combat presentation, auto battle and data-driven skills.
---
# Turn-based battle engine
- Battle simulation must be framework-agnostic: pure deterministic TypeScript state transitions with explicit seeds and action logs.
- Phaser presents state; it must not determine trusted economy rewards. Backend validates authoritative actions and payouts.
- Five playable slots, target selection, turn priority, modifiers, status effects, cooldowns, ultimates, boss phases and scripted environmental targets.
- Design effect registries that interpret validated, versioned JSON, not arbitrary downloaded JavaScript.
- Character skills are derived from approved `narrative/` canon where relevant; gameplay details absent from canon require owner approval.
- Build Auto, Sweep and AFK claims as server-checked mechanisms; never trust the device clock for reward accumulation.
- Test determinism, invalid targets, simultaneous effects, reconnect/resume, slow devices, buff expiration and zero-health edge cases.
- Include visually legible chibi animation synchronization and caption/feedback accessibility.
