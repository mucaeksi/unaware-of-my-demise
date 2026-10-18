---
name: uomd-chibi-animation
description: Produce or integrate Unaware of My Demise character media — 2-head SD chibi battle atlases, knee-up (boydan) Light Novel portraits, cut-ins and their PixiJS v8 animation (frame swaps, procedural tweens) with locked identity, pivots and provenance.
---
# Character media and animation

- Identity authority: `narrative/` and `content/specs/character_locks/`; every asset has a stable character ID, reference set and provenance (model, prompt hash, cost, licence, sha256).
- Generated art enters through `tools/ingest_art.ts` → `content/approved_art/`; `tools/build_content.ts` assembles the base release. Paid generation must go through the media budget (`tools/media_budget.ts`, `tools/lib/media_budget.py`).
- A generated still is not a rig. Animate with PIXI sprite frame swaps (atlas states: idle, walk, basic, active, ultimate, hit, defeat, victory) and procedural tweens (breathing, speaking, impact squash). Spine (`@esotericsoftware/spine-pixi-v8`) or Live2D only after an approved licence/runtime/mobile review.
- Acceptance: consistent face/costume/silhouette, clean alpha edges, correct pivot/foot_y, frame alignment, readable at battle scale, memory within the limits in `docs/PATCHING.md`.
