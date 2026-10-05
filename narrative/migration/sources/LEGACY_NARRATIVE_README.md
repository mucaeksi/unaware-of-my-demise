# Narrative Workspace — Unaware of My Demise

Owned by the Narrative & Visual Director. **Since 2026-09-29 this folder is the single home for everything narrative, visual and audio direction: world, lore, characters, story, chapters, companion stories, events, dialogue, art direction, sheets, prompts, generated images, music and voice.** The Director works only inside this folder. The technical team reads from here and copies files into runtime paths; it does not edit this folder.

## Why this folder exists

The code team edits the rest of the repository. To avoid overwriting each other, narrative and visual work lives only here. Root duplicates (`lore/`, the narrative files in `docs/`) were moved or archived on 2026-09-29; see `archive/README.md`.

## Contents

| Path | What | Runtime destination (code team syncs) |
|---|---|---|
| `content/story_script_ch01.json`–`ch07.json` | Main VN script, 419 lines | `content/` (same file names) |
| `content/story_script_part1_manifest.json` | Story order (51 entries), recruit beats | `content/` |
| `content/character_stories_part1.json` | 76 companion story parts | `content/` (new) |
| `content/events_part1.json` | 4 canon events | `content/` (new) |
| `content/lore_text_part1.json` | Weapon, enemy, item lore, codex, banner copy, chapter cards | `content/` (new) |
| `content/character_voice_lines_part1.json` | 220 character voice lines | `content/` (new) |
| `content/character_visuals_part1.json` | Character appearance source (shared with art) | `content/` |
| `docs/` | Story Bible, Villain Bible, costume guide, full script, technical handoff, narrative baseline and audit | Read from here (no runtime copy) |
| `docs/ART_BIBLE.md`, `ASSET_CATALOG.md`, `BRAND_MARKS_AND_ICON_GUIDE.md` | Art direction, asset status, brand marks (moved from root `docs/` on 2026-09-29) | Read from here |
| `archive/` | Retired narrative files with a manifest | — |
| `lore/` | Canon ledger, glossary, timeline, world rules, world, factions, history, locations, 22 character models, voice and visual matrices, visual reference | Read from here (not read at runtime; the root `lore/` copy is retired) |
| `tools/compile.py` | Rebuilds `docs/PART1_FULL_SCRIPT.md` from `content/` here | — |
| `tools/gen_image.py`, `gen_batch.py`, `gen_audio.py` | Gemini image (one-by-one and batch), Lyria music and Gemini TTS voice generation; key in `.secrets/` | — |
| `tools/build_asset_plan.py`, `art_manifest.py` | Asset plan (`art/asset_plan_part1.json`, `docs/ASSET_PLAN_PART1.md`); art metadata index (`art/MANIFEST.md`) | — |
| `tools/art_review.py`, `voice_audition.py`, `music_loop.py`, `music_loop_intro.py`, `build_jp_script_<character>.py`, `record_fadyme_vo.py`, `split_select_vo.py` | Review moves; voice auditions; music loops (intro + loop offset); JP script build; grouped VO recording, Whisper-checked split and take selection | — |
| `tools/archive/` | One-off generators used to author the current content. **Do not run**: they would overwrite later edits. | — |
| `art/` | `sheets/` (approved; `pending/`, `chibi_ref/`), `production/` (approved generated images), `brand/` (approved r2 logo and key art; `concepts/` references and mockups; `superseded/` off-model or replaced brand art), `_review/` (awaiting review), `_rejected/`; metadata inside each PNG, index `art/MANIFEST.md` | Source for asset exports |
| `audio/` | `music/<track_id>/` (approved: `*_loop.ogg` for the game with loop offset in the sidecar, `*_original.mp3` raw take), `music/motifs/` (composed leitmotifs, MIDI + preview), `music/_listening_demos/`; `voice/casting.json` (one exclusive voice per character), `voice/jp_script_<character>.json` (JP recording scripts), `voice/<character>/<speaker_id>/<line_id>.ogg` (approved lines, same layout the engine resolves), `voice/<character>/reference/`, `voice/<character>/_takes/` (raw grouped takes); `_review/`, `_rejected/` | Source for audio exports (`assets/voice/<speaker_id>/<line_id>.ogg`) |
| `prompts/` | `sheets/` (character sheet prompts), `asset_pipeline/` (production prompts, rules, briefs), `brand/`, `music/` | — |
| `.secrets/` | API key file (git-ignored, never committed) | — |
| `CHANGELOG_NARRATIVE.md` | Narrative change history | Summarized into `docs/CHANGELOG.md` by the code team |

Approved reference art lives in `art/` inside this folder (moved from the repository root, reorganized 2026-09-30) and is described in `lore/visual_reference.md`. It is the reference library for every new sheet or asset; see `art/README.md`.

## Reference set — Part I (closed 2026-09-30)

Owner-approved references every later asset is generated and judged against (prompts: `prompts/reference_set/REFERENCE_SET_PART1.md`):

| Area | Approved files |
|---|---|
| Brand | `art/brand/brand_logo_wordmark_r2_v003.png`, `brand_key_art_portrait_r2_v003.png` (+ `_with_logo`) |
| Fadyme sheet | `art/sheets/char-fadyme-uomd.png`, chibi crop `art/sheets/chibi_ref/chibi_ref_fadyme.png` |
| Fadyme art | `art/production/fadyme/`: 4 VN busts, 6 battle poses, ultimate cut-in |
| Ch1 location | `art/production/locations/forest_whispering_ash/`: background + battle plate |
| Icons | `art/production/icons/icons_pilot_mixed_16_mixed_v001.png` (style pilot) |
| Music | `audio/music/bgm_fadyme_theme/`, `bgm_ch1_ash_forest/` (calm/uneasy/chaotic), `bgm_battle_field/`; motifs in `audio/music/motifs/` |
| Voice | Fadyme = Sulafat (`audio/voice/casting.json`), reference `audio/voice/fadyme/reference/`; JP script `audio/voice/jp_script_fadyme.json` (201 lines); recorded lines `audio/voice/fadyme/` (25/201 on 2026-09-30; the rest after the TTS daily quota resets) |

Style rules proven by the set: dark, semi-realistic painterly block + old key art as style-only reference; dynamic-pose instruction for poses; chibi = sheet chibi crop + ink block; music loops built as intro + loop offset; voices recorded one scene/chapter per call with one fixed style, Whisper-checked, level-matched.

## Rules

1. The narrative copy is the source of truth for the files listed above. If the runtime copy differs, the narrative copy wins unless the code team changed a **technical field** (IDs used by code, schema keys); in that case the code team documents it in `docs/NARRATIVE_TECH_HANDOFF_PART1.md` and the narrative side merges it.
2. Stable IDs (`line_id`, `scene_id`, `story_id`, character IDs) never change silently. Removed or renamed IDs are listed in `CHANGELOG_NARRATIVE.md`.
3. Narrative never edits code, tests or tools outside this folder. When a narrative change needs a code-side change (new speaker in the validator allowlist, new expected line count, a new save field), it is written as a request in `docs/NARRATIVE_TECH_HANDOFF_PART1.md` §9.
4. Shared design files outside this folder (the GDD, `chapters_part1.json`) are changed only through a request to the code team, with the exact text.
5. After any script change, run `python narrative/tools/compile.py` to refresh the full script.

## Pending code-side sync (as of 2026-09-29)

- Runtime `content/` copies: `character_stories_part1.json` has two text fixes not yet synced (Nixie "eighteen winters", Vespera "fifteen years"). All other narrative packs are identical.
- Script sync: `story_script_ch03.json`, `story_script_ch07.json` and ch04–07, character stories, voice lines, lore text (409 → 419 lines; unlock fields per `docs/SPOILER_UNLOCK_POLICY.md`).
- GDD wording request (W1) and the path-change notice: `docs/NARRATIVE_TECH_HANDOFF_PART1.md` §9.
