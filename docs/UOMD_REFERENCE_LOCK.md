# UOMD — Canonical Reference Lock

## Status

Initial reference set: **APPROVED / LOCKED**

- Approved by: project owner
- Owner approval of each item: 2026-09-30 (recorded in the LEGACY archive,
  `docs/LEGACY_AUDIT.md` §4)
- Owner confirmation that this set is canonical for this repository:
  2026-10-03 ("Referans setini onaylıyorum, kilitle")
- Decision record: DEC-0010 (`docs/DECISIONS.md`)
- Machine-readable lock (sha256, Drive source id, LEGACY path, size,
  embedded `uomd_*` metadata for every file):
  `narrative/references/REFERENCE_SET.lock.json`

## Locked set

| Ref | Item | Repository file | Native size |
|---|---|---|---|
| R01 | Logo (wordmark r2 v003) | `narrative/references/logo/brand_logo_wordmark_r2_v003.png` | 2752×1536 |
| R02 | Key art (portrait r2 v003) | `narrative/references/key_art/brand_key_art_portrait_r2_v003.png` | 1536×2752 |
| R02+R01 | Key art with logo (title screen / store composite) | `narrative/references/key_art/brand_key_art_portrait_r2_v003_with_logo.png` | 1536×2752 |
| R03 | Fadyme character sheet r2 | `narrative/references/fadyme/sheet/char-fadyme-uomd.png` | 1696×2528 |
| (R08 input) | Fadyme chibi crop reference | `narrative/references/fadyme/sheet/chibi_ref_fadyme.png` | 612×702 |
| R04 | VN bust — composed | `narrative/references/fadyme/vn_bust/vn_bust_fadyme_composed_v001.png` | 1024×1536 |
| R05 | VN bust — quiet pain | `narrative/references/fadyme/vn_bust/vn_bust_fadyme_quiet_pain_v002.png` | 1024×1536 |
| R06 | VN bust — honest fear | `narrative/references/fadyme/vn_bust/vn_bust_fadyme_honest_fear_v001.png` | 1024×1536 |
| R07 | VN bust — warm | `narrative/references/fadyme/vn_bust/vn_bust_fadyme_warm_v001.png` | 1024×1536 |
| R08 | Battle pose — idle (chibi style base for the roster) | `narrative/references/fadyme/battle_pose/battle_pose_fadyme_idle_v002.png` | 1696×2528 |
| R09 | Battle pose — attack | `…/battle_pose/battle_pose_fadyme_attack_v003.png` | 1696×2528 |
| R10 | Battle pose — hit | `…/battle_pose/battle_pose_fadyme_hit_v003.png` | 1696×2528 |
| R11 | Battle pose — skill | `…/battle_pose/battle_pose_fadyme_skill_v002.png` | 1696×2528 |
| R12 | Battle pose — guard | `…/battle_pose/battle_pose_fadyme_guard_v003.png` | 1696×2528 |
| R13 | Battle pose — victory | `…/battle_pose/battle_pose_fadyme_victory_v002.png` | 1696×2528 |
| R14 | Ultimate cut-in | `narrative/references/fadyme/cut_in/cut_in_fadyme_ultimate_v002.png` | 1696×2528 |
| R15 | Ch1 background — ordered | `narrative/references/locations/forest_whispering_ash/bg_forest_whispering_ash_ordered_v001.png` | 1696×2528 |
| R16 | Ch1 battle plate — ordered | `…/forest_whispering_ash/bg_forest_whispering_ash_battle_plate_ordered_v002.png` | 1696×2528 |
| R17 | Pilot icon set (16 mixed) | `narrative/references/icons/icons_pilot_mixed_16_mixed_v001.png` | 2048×2048 |
| R18 | Fadyme theme (in-game loop) | `narrative/references/fadyme/theme/bgm_fadyme_theme_v001_loop.ogg` + `.json` | Vorbis 44.1 kHz stereo, 86.05 s, loop offset 25.232 s |
| R18 | Fadyme theme (untouched Lyria take) | `narrative/references/fadyme/theme/bgm_fadyme_theme_v001_original.mp3` + `.json` | MP3 44.1 kHz stereo, 121.6 s |
| R23 | Fadyme voice — casting (Gemini TTS prebuilt voice **Sulafat**, style, reference pitch 197 Hz) | `narrative/references/fadyme/voice/casting.json` | — |
| R23 | Fadyme voice — reference recording (11 lines) | `narrative/references/fadyme/voice/Fadyme_Sulafat_11_satir.mp3` | MP3 24 kHz mono, 62.0 s |
| — | Generation prompts for R01–R23 | `narrative/prompts/reference_set/REFERENCE_SET_PART1.md` | — |

R19–R22 (chapter 1 / battle BGM) and the full Fadyme line recordings are not
part of the locked reference set; they are production assets and migrate
through the normal pipeline.

## Models (C44)

Images `gemini-3.1-flash-image` (Nano Banana 2) at 2K · music `lyria-3.5` ·
voice `gemini-3.8-flash-tts`. Subsequent assets must use the same models so
they match the references.

## Lock rule

- These files are consistency anchors for everything generated after them.
- Never overwrite, re-encode, crop or regenerate a locked file in place.
  Runtime/optimized derivatives (WebP, atlases, OGG re-encodes) are produced
  as new files elsewhere and record the locked file as their reference.
- Routine subsequent assets are generated and validated autonomously against
  this set (C41 approval protocol); finished groups are shown to the owner.
- Conflicts with the set or with canon are logged as `DECISION_REQUIRED`.
- The main theme is owner-controlled and is not part of this set.

## Known minor issues accepted at approval (from LEGACY metadata)

- R01: circlet fragment drawn too whole.
- R02: crown fragment reads as a small tiara (fixed from R03 onward).
- R04: bell pin reads as small bells at the temples.
- R05: crown fragment drawn larger; silhouette overlap with R04 = 0.90.
- R06: both hands on the chain (base has one).

## Verification (2026-10-03)

Every file was transferred from Google Drive through the Drive MCP
(`download_file_content`), checked against the Drive file id and Drive
`fileSize`, sha256 recorded in the lock file, PNGs fully decoded with ffmpeg,
audio probed with ffprobe (theme loop length 86.05 s equals the sidecar's
`file_length_s`). Embedded `uomd_*` PNG metadata (status APPROVED, prompt
asset R-number, model `gemini-3.1-flash-image`) is preserved byte for byte.

## Change control

Changing the locked logo, key art, Fadyme sheet, Fadyme voice identity, or
Fadyme theme is a creative/canon change and must be documented: new revision
file, owner decision in `docs/DECISIONS.md`, updated lock file. The superseded
file stays in history.
