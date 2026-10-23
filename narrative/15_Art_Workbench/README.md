> **Archived 2026-10-11:** historical prototype images/audio were moved out of `main` (branch `archive/pre-cleanup-2026-10-10`; index: `narrative/ARCHIVE.md`, locked visual references: `reference/` and `narrative/14_References/recovered_locked_v001/`).

# Character, environment, UI and media art workbench (D-30)

This directory is the canonical creative staging area owned by the **Art Director** (`argon:art-director`, owner decision **D-30**; see [`docs/handoff/ARGON_ART_DIRECTOR.md`](../../docs/handoff/ARGON_ART_DIRECTOR.md)). The Art Director owns both creative production inside `narrative/` and full runtime integration/verification in the game (`apps/game/`, `apps/admin/`, `content/`).

| Folder | Purpose |
|---|---|
| `banners/` | Summon & LiveOps banner key art masters (`banner_standard_hall_of_armaments`, 5 Oath character banners, 5 weapon banners) |
| `cg/` | Full-bleed 16:9 narrative event CGs (`roadside_rest`, `shelter_evening`, prologue and chapter stills) |
| `characters/` | Per-character briefs, prompts, candidate turnarounds, expressions, chibi sheets and provenance (`<id>/production_v001/`, `design_v001/`) |
| `enemies/` | Part I enemy concept boards (`enemies/design_v001/`), design cards (`design_cards.json`) and boss/objective handoffs |
| `handoff/` | Art-to-runtime specifications, source/hash metadata and QC records |
| `icons/` | Chroma-keyed `#00FF00` -> RGBA 256×256 icon sheets (`icons/production_v001/`, 96 icons across 6 sheets + 16 core UI icons) |
| `locations/` | Location briefs, atmospheric background plates and lighting passes per canonical location ID |
| `ui_animations/` | Control Center Animation Studio GIF previews (`ui_animations/gifs/`) and interactive stage specs |
| `ui_screens/` | Gothic UI kit 9-slice frames, 4-state buttons, summon banner staging and store/brand masters |

## Canonical inputs & identity locks

1. Always start from [`content/specs/character_locks/CHARACTER_LOCKS.md`](../../content/specs/character_locks/CHARACTER_LOCKS.md), [`docs/media/ART_BIBLE.md`](../../docs/media/ART_BIBLE.md), [`docs/media/EXPORT_PIPELINE.md`](../../docs/media/EXPORT_PIPELINE.md), and the canonical character/location/story sheets in `../00_Canon/`, `../06_Characters/`, `../08_Locations/`, and `../09_Story_Scenes/`.
2. Locked visual references live in `reference/` and `../14_References/recovered_locked_v001/` (verified by gate `A31` in `tools/ingest_art.ts`).
3. Do not invent an unapproved identity when `CHARACTER_LOCKS.md` or `docs/media/QUEUE_DATA.json` marks an entity as needing a lock; write the visual lock proposal first.

## Promotion & runtime integration pipeline

Runtime assets do **not** live in legacy `game/assets/` paths:
- **Approved art store:** `content/approved_art/art/*.webp` + `content/approved_art/entries/*.json` (ingested, keyed, sliced, packed, and QC-gated by `npx tsx tools/ingest_art.ts` and approved with `--by argon:art-director`).
- **Embedded First-AAB base bundle (`rel_0001`):** `content/base/` built deterministically by `npm run build:content` (`tools/build_content.ts`) and drift-checked by `npm run check:content`.
- **Full Part I campaign patch (`rel_0003_part1_campaign`):** `content/patches/rel_0003_part1_campaign/` built deterministically by `npm run build:campaign` (`tools/build_campaign.ts`).
- **Control Center review studio:** `apps/admin/src/pages/Animations.tsx` + `apps/admin/public/dev/animations/`.
- **Language:** Player-facing UI, subtitles, docs and metadata are **English**; spoken voiceover is reviewed **Japanese**.
