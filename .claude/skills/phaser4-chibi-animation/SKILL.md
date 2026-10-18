---
name: phaser4-chibi-animation
description: Produce or integrate anime chibi characters, knee-up boydan Light Novel portraits, skill cut-ins and GPU combat VFX for the PixiJS v8 stage engine (D-23).
---
# Character Media & PixiJS v8 Animation Pipeline
- Canon character identity is defined in `narrative/` and `content/specs/character_locks/`. Every asset has a stable character ID and visual reference manifest.
- Google AI generates drawings, multi-expression knee-up (`boydan`) portraits, and 2-head SD Chibi sprite sheets; a flat PNG is not an automatically rigged Spine or Live2D model.
- Use PixiJS v8 `Container`, `Sprite`, `Graphics`, texture frame swaps, procedural breathing/speaking tweens, and multi-layer GPU VFX (`BattleVfx`) for responsive 60fps mobile playback.
- Prefer atlases and sprite sheets where they meet quality/performance targets; avoid requiring Spine or Live2D unless explicitly reviewed and licensed.
- Standard chibi states: `idle`, `attack`, `skill`, `hit`, `defeat`, `victory` and narrative `boydan` expression transitions (`neutral`, `warm`, `sorrow`, `determined`, `alert`, `stern`, `weary`).
- Asset acceptance: consistent face, costume, 2-head SD Chibi proportions (`0.72x` battle scale), clean alpha edges, accurate pivot positions, and deterministic tween/frame timing.
