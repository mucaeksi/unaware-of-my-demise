# Migration Ledger

Every item migrated from the Google Drive LEGACY archive into this repository.
Format (CLAUDE.md): GOOGLE DRIVE SOURCE → GITHUB TARGET → ACTION →
TRANSFORMATION → VALIDATION → STATUS. LEGACY originals are never modified.

Transfer method: Drive MCP `download_file_content`; results larger than the
tool-output limit are written by the harness to a file in the session, from
which they are base64-decoded in the sandbox (no bytes pass through the model
context). Every file is checked against the Drive file id and Drive
`fileSize`; sha256 is recorded at import.

## BATCH-0001 — Canonical reference set (2026-10-03)

Scope: owner-confirmed reference set (DEC-0010). Lock file:
`narrative/references/REFERENCE_SET.lock.json`. Rollback point: the commit
before this batch (files are additive).

| ID | Google Drive source | GitHub target | Action | Transformation | Validation | Status |
|---|---|---|---|---|---|---|
| MIG-0001 | `LEGACY:narrative/prompts/reference_set/REFERENCE_SET_PART1.md` (`1j6jV2PIdOwd6ap1oEK6zsUhII2IhN1_D`) | `narrative/prompts/reference_set/REFERENCE_SET_PART1.md` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `0f49b137580d…` | MIGRATED |
| MIG-0002 | `LEGACY:narrative/art/production/fadyme/battle_pose_fadyme_attack_v003.png` (`1RtHwJb3Nur0EZx73DM0RS5UYr3gOzy0V`) | `narrative/references/fadyme/battle_pose/battle_pose_fadyme_attack_v003.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `6e9c3a257159…` + ffmpeg decode | MIGRATED |
| MIG-0003 | `LEGACY:narrative/art/production/fadyme/battle_pose_fadyme_guard_v003.png` (`1xxJZIQlyD5dJPY8ekaKHHWkBTmQ4PPN_`) | `narrative/references/fadyme/battle_pose/battle_pose_fadyme_guard_v003.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `65b72c2f8adc…` + ffmpeg decode | MIGRATED |
| MIG-0004 | `LEGACY:narrative/art/production/fadyme/battle_pose_fadyme_hit_v003.png` (`1A4qCHU3aqXjgpZ0h0NPsLrLC7JbfQ1La`) | `narrative/references/fadyme/battle_pose/battle_pose_fadyme_hit_v003.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `8cd175b73bcc…` + ffmpeg decode | MIGRATED |
| MIG-0005 | `LEGACY:narrative/art/production/fadyme/battle_pose_fadyme_idle_v002.png` (`1c4Yq4PLjkkTjuT-LjhexH2Itrx8z1D_p`) | `narrative/references/fadyme/battle_pose/battle_pose_fadyme_idle_v002.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `bacb6e29f847…` + ffmpeg decode | MIGRATED |
| MIG-0006 | `LEGACY:narrative/art/production/fadyme/battle_pose_fadyme_skill_v002.png` (`1QPGTHMAsJojBTyvbbyQsp9wcjooo8HDj`) | `narrative/references/fadyme/battle_pose/battle_pose_fadyme_skill_v002.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `3e4944b9df0f…` + ffmpeg decode | MIGRATED |
| MIG-0007 | `LEGACY:narrative/art/production/fadyme/battle_pose_fadyme_victory_v002.png` (`1q3bLMC_pdI7S8HxQlRM1yqjEextyGEl8`) | `narrative/references/fadyme/battle_pose/battle_pose_fadyme_victory_v002.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `3b2ee80f646e…` + ffmpeg decode | MIGRATED |
| MIG-0008 | `LEGACY:narrative/art/production/fadyme/cut_in_fadyme_ultimate_v002.png` (`1ZNfUhDU-5j43c5hqP-uJE0keXJWmmaU4`) | `narrative/references/fadyme/cut_in/cut_in_fadyme_ultimate_v002.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `aa4bbf559b09…` + ffmpeg decode | MIGRATED |
| MIG-0009 | `LEGACY:narrative/art/sheets/char-fadyme-uomd.png` (`1rXqDLWSLq7Q8PgCnG6TYTL_RQAx1abmJ`) | `narrative/references/fadyme/sheet/char-fadyme-uomd.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `22a6010ac296…` + ffmpeg decode | MIGRATED |
| MIG-0010 | `LEGACY:narrative/art/sheets/chibi_ref/chibi_ref_fadyme.png` (`1_Pjtop-gsZ-jLakFzng8LI6K2RlbI-co`) | `narrative/references/fadyme/sheet/chibi_ref_fadyme.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `88d0aeb43470…` + ffmpeg decode | MIGRATED |
| MIG-0011 | `LEGACY:narrative/audio/music/bgm_fadyme_theme/bgm_fadyme_theme_v001_loop.json` (`12ileqJtzmJIRNn5ih1qrgtH9nuJM29SY`) | `narrative/references/fadyme/theme/bgm_fadyme_theme_v001_loop.json` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `fb7a2dcb0e60…` | MIGRATED |
| MIG-0012 | `LEGACY:narrative/audio/music/bgm_fadyme_theme/bgm_fadyme_theme_v001_loop.ogg` (`1Swq44OXLvN9Yod-nQbWAWbkfU9Amlpek`) | `narrative/references/fadyme/theme/bgm_fadyme_theme_v001_loop.ogg` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `bc2c230cf1cd…` + ffprobe | MIGRATED |
| MIG-0013 | `LEGACY:narrative/audio/music/bgm_fadyme_theme/bgm_fadyme_theme_v001_original.json` (`1943Nb7sf00qQUmVFKeVU-FujmgpnMZBK`) | `narrative/references/fadyme/theme/bgm_fadyme_theme_v001_original.json` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `f0639c152c2e…` | MIGRATED |
| MIG-0014 | `LEGACY:narrative/audio/music/bgm_fadyme_theme/bgm_fadyme_theme_v001_original.mp3` (`1YQ_RzsJax3SEhbBHrAI9KyW23sZJVClT`) | `narrative/references/fadyme/theme/bgm_fadyme_theme_v001_original.mp3` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `ff469fd0001d…` + ffprobe | MIGRATED |
| MIG-0015 | `LEGACY:narrative/art/production/fadyme/vn_bust_fadyme_composed_v001.png` (`1nx56V6Wy88STlQCaAJ5Tw9y5fJ_yrjoH`) | `narrative/references/fadyme/vn_bust/vn_bust_fadyme_composed_v001.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `62b11e5bacdd…` + ffmpeg decode | MIGRATED |
| MIG-0016 | `LEGACY:narrative/art/production/fadyme/vn_bust_fadyme_honest_fear_v001.png` (`1bHWCoBZv4KokPDoZp0Du4dypvStSnLLS`) | `narrative/references/fadyme/vn_bust/vn_bust_fadyme_honest_fear_v001.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `3ceef4b10a58…` + ffmpeg decode | MIGRATED |
| MIG-0017 | `LEGACY:narrative/art/production/fadyme/vn_bust_fadyme_quiet_pain_v002.png` (`1qDWeV9Dc6M2Bid2gDzKJXO8NmfS0g-Vn`) | `narrative/references/fadyme/vn_bust/vn_bust_fadyme_quiet_pain_v002.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `435e343c18be…` + ffmpeg decode | MIGRATED |
| MIG-0018 | `LEGACY:narrative/art/production/fadyme/vn_bust_fadyme_warm_v001.png` (`1oCUA_cVMDsZP2yJZtTlXs9Oq5LKBK0y6`) | `narrative/references/fadyme/vn_bust/vn_bust_fadyme_warm_v001.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `9fcd8d2706b1…` + ffmpeg decode | MIGRATED |
| MIG-0019 | `LEGACY:narrative/audio/voice/fadyme/reference/Fadyme_Sulafat_11_satir.mp3` (`1uDH2QxEeFkZDKWC-H8g8U8LMCjkE83mu`) | `narrative/references/fadyme/voice/Fadyme_Sulafat_11_satir.mp3` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `9286d062ba53…` + ffprobe | MIGRATED |
| MIG-0020 | `LEGACY:narrative/audio/voice/casting.json` (`1ZcAmWa0r4TFwZXUhVpQQTam9EgrOCcXz`) | `narrative/references/fadyme/voice/casting.json` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `4f0d5fb0c928…` | MIGRATED |
| MIG-0021 | `LEGACY:narrative/art/production/icons/icons_pilot_mixed_16_mixed_v001.png` (`1lr7SnFml7qK3pBGGQztgeJXqSZIRvoUi`) | `narrative/references/icons/icons_pilot_mixed_16_mixed_v001.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `39139c22ced1…` + ffmpeg decode | MIGRATED |
| MIG-0022 | `LEGACY:narrative/art/brand/brand_key_art_portrait_r2_v003.png` (`145lX-SDPa2khqwN_u-MNiEDdqc1KAbT6`) | `narrative/references/key_art/brand_key_art_portrait_r2_v003.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `58c54af2d268…` + ffmpeg decode | MIGRATED |
| MIG-0023 | `LEGACY:narrative/art/brand/brand_key_art_portrait_r2_v003_with_logo.png` (`1LaQSrk9tqrom5nXkO21Aq3QQoccCCT_z`) | `narrative/references/key_art/brand_key_art_portrait_r2_v003_with_logo.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `896f77249416…` + ffmpeg decode | MIGRATED |
| MIG-0024 | `LEGACY:narrative/art/production/locations/forest_whispering_ash/bg_forest_whispering_ash_battle_plate_ordered_v002.png` (`1p0gRxxw4k125u8VctUOXAYk45EhkB3D4`) | `narrative/references/locations/forest_whispering_ash/bg_forest_whispering_ash_battle_plate_ordered_v002.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `0ca976584f87…` + ffmpeg decode | MIGRATED |
| MIG-0025 | `LEGACY:narrative/art/production/locations/forest_whispering_ash/bg_forest_whispering_ash_ordered_v001.png` (`1tB3fOYMpDGfZce-VLokBZL5YsMY1tIKT`) | `narrative/references/locations/forest_whispering_ash/bg_forest_whispering_ash_ordered_v001.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `02751e68cc92…` + ffmpeg decode | MIGRATED |
| MIG-0026 | `LEGACY:narrative/art/brand/brand_logo_wordmark_r2_v003.png` (`1OgjZojEqPdfjcRjpzOhmswvNGbKqvNJ2`) | `narrative/references/logo/brand_logo_wordmark_r2_v003.png` | MIGRATE | none (byte-exact) | size + Drive id + sha256 `c4a87503d53d…` + ffmpeg decode | MIGRATED |

Not migrated in this batch (reason): rejected/superseded/review images
(`LEGACY:narrative/art/_rejected/`, `_review/`, `brand/superseded/`) —
LEAVE_IN_DRIVE, history only; voice auditions and takes — next batches with the
audio pipeline; R19–R22 music — production assets, next batches;
`LEGACY:narrative/art/MANIFEST.md` (`1xy6ugTNUGaG6Ys9KQCeU9oHXoOx_QSjf`) —
superseded by the lock file for this set, regenerated by the migrated
`art_manifest.py` later.

## BATCH-0002 — LEGACY Godot client, no SQLite, server snapshot (2026-10-04)

Scope: the LEGACY Godot client (`LEGACY:game/`) and the parity fixtures its
tests read (`LEGACY:parity/`), migrated selectively under DEC-0012. The client
holds no game database: the player state is a server snapshot
(`PlayerState`), and every change goes through `GameBackend`. The starter
`game/` placeholder (api_client.gd, main.gd, patch_manager.gd, main.tscn) is
replaced. Rollback point: the commit before this batch.

Machine-readable per-file provenance (path, Drive id, LEGACY git blob sha1 and
size, current sha256, action) is in
[`docs/migration/BATCH-0002.manifest.json`](migration/BATCH-0002.manifest.json).
Transfer check: at download, every file was compared with the LEGACY git
index by blob sha1 and size. All 456 transferred files (20.5 MB) matched.

| ID | Google Drive source | GitHub target | Action | Transformation | Validation | Status |
|---|---|---|---|---|---|---|
| MIG-0027 | `LEGACY:game/` core domain, content, UI screens, scenes, theme, unit/parity/ui tests (manifest `MIGRATE` rows) | same paths under `game/` | MIGRATE | none (byte-exact; 240 files) | git blob sha1 = LEGACY index; headless import; GUT | MIGRATED |
| MIG-0028 | `LEGACY:parity/` (fixtures, MANIFEST, README; part of the 240 above) | `parity/` | MIGRATE | none (byte-exact) | git blob sha1; parity suites pass | MIGRATED |
| MIG-0029 | `LEGACY:game/scripts/app/{game,game_flow,online,device_smoke}.gd`, `scripts/ui/{story_director,app_shell,boot}.gd`, `scripts/services/outcome.gd`, `project.godot`, `addons/README.md`, `tests/ui/test_screens.gd`, `tests/unit/{test_device_smoke,test_engine_and_project}.gd` | same paths | ADAPT | Save/SQLite calls replaced by `GameBackend` coroutines and `PlayerState` reads. Async boot shows "Server unreachable" with a retry. No save-recovery notice. Save autoload and the uomd_native plugin removed. SQLite, persistence and save-key smoke checks dropped. Doc comments updated. | GUT 219/219 | MIGRATED |
| MIG-0030 | — | `game/scripts/app/{game_backend,player_state}.gd`, `game/tests/unit/test_player_state.gd` | NEW | DEC-0012 client boundary and its tests | GUT 8/8 | DONE |
| MIG-0031 | bitwes/Gut tag `v9.7.1` (not Drive; same version the LEGACY build pinned) | `game/addons/gut/` | VENDOR | none | `git archive v9.7.1`; suite runs | DONE |
| MIG-0032 | 33 LEGACY `*.gd.uid` files | same paths | UID_REGENERATED | Not transferred; regenerated by headless import. Nothing references script UIDs (no `uid://` in any scene, resource or project file). | import clean | DONE |

Excluded (LEAVE_IN_DRIVE, reason):

- `LEGACY:game/scripts/persistence/` (19), `game/scripts/app/save.gd` and `game/scripts/services/{tx,battle_reward_service,equipment_service,progression_service,quest_service,reward_claims,story_service,victory_service}.gd`: the local SQLite save and the services that changed it on the client. Under DEC-0012 these state changes belong to the server. The rules they implemented remain in `scripts/core/`, and they are the reference for the Worker API.
- `LEGACY:game/addons/godot-sqlite/` (12), `game/addons/uomd_native/` (7), `game/android/plugins/` (9), `game/tools/build_uomd_native.sh`, `game/tools/export_fernet_vectors.gd`: SQLite is not used, and no save key needs protecting.
- `LEGACY:game/tests/persistence/` (14), `parity/fixtures/{fernet,recovery,saves}.json`, `parity/godot_vectors/fernet_godot.json`: these test the excluded persistence layer.
- `LEGACY:game/tools/*.ps1`: Windows-local scripts (`CLOUD_DEPENDENCY_GAP`; the `.sh` equivalents are migrated).
- `.gitkeep` placeholders (26): not needed, because the directories hold files.

Deferred until a server or fake backend exists. These were copied byte-exact, then removed from the tree because they drive the SQLite `Save`:

- `LEGACY:game/tests/e2e/test_game_flow.gd` (`1WRZmQHxqVTAjGMisVg-Z0TYhSvlPg2e_`)
- `test_game_menus.gd` (`1-rVLNPC0Nwsbv8Y2ouTsxYpUoc2wo2zc`)
- `test_story_e2e.gd` (`1Szqcebf9Z8rmlV7Gm7EMBN2stpofgDlE`)
- `game/tests/ui/test_app_flow.gd` (`1WrwK-h7cA2_QPOQJpoMoUoGulhUxZCvS`)
- `game/tools/ui_preview.gd` (`1zAGbGCkNllHqyFdreC9yqcOI6w_8sy_k`) and `ui_preview.tscn` (`1chCMSNuLlUc_ZNn8RZ1TgqhD8dBwhtn1`)

They return when they can be ported onto a `GameBackend` test double.
