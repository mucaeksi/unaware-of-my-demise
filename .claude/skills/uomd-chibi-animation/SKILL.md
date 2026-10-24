---
name: uomd-chibi-animation
description: Produce or integrate Unaware of My Demise character media — 2-head SD chibi battle atlases, knee-up (boydan) Light Novel portraits, cut-ins, and their Unity 6 LTS URP 2D animation (16-cell 8-state frame loops, bottom-left foot pivots, procedural portrait rigs) with locked identity and provenance.
---
# Character media and Unity 6 2D animation

- Identity authority: `narrative/` and `content/specs/character_locks/`; every asset has a stable character ID, reference set, and provenance (Gemini/Imagen model, prompt hash, cost, licence, sha256).
- Generated art enters through `tools/ingest_art.ts` → `content/approved_art/`; `tools/build_content.ts` assembles `content/base/`, and `npm run export:unity` (`tools/export_unity_bundle.ts`) exports `StreamingAssets/uomd_base/` with precomputed `unity_pivot` (`(pivot_x, 1 - foot_y)`) in `unity_export_manifest.json`. Paid Gemini API generation must go through the media budget guard (`tools/media_budget.ts`, `tools/lib/media_budget.py`).
- A generated still is not a rig. In Unity 6 (`Uomd.Battle` & `Uomd.Narrative`), animate characters via `ChibiAtlasSlicer` (`Sprite.Create` with `SpriteMeshType.FullRect` across the 8 state sheets: `idle`, `walk`, `basic`, `active`, `ultimate`, `hit`, `defeat`, `victory`) and procedural `PortraitRigView` transforms (sine breathing, active speaker emphasis, emotion cross-fade, impact squash/stretch). Pair with `unity-2d-animation` and `unity-urp-2d`.
- Acceptance: consistent face/costume/silhouette, clean alpha edges, exact bottom-left `unity_pivot` foot grounding on formation slots, readable silhouette at battle scale, and texture memory within the mobile budgets in `docs/PATCHING.md`.
