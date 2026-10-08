# Project map

Current local organization: 2026-10-08. Start here before opening large folders. Current authority is root `AGENTS.md` and `.codex/standards/authority.md`. Preserve the working tree; do not publish until the owner requests it.

| Work or question | First place to open | Related files |
|---|---|---|
| Codex art / Claude code ownership | `docs/ART_AND_CODE_HANDOFF.md` | Root `AGENTS.md`, `CLAUDE.md` |
| New character/environment design work | `narrative/15_Art_Workbench/README.md` | Existing `narrative/06_Characters/`, `08_Locations/` and current visual canon |
| Prepared workspace copy | `docs/release/WORKSPACE_COPY_2026-10-08_TR.md` | Ignored `.local/migration-20261008/` byte-verification evidence |
| Latest test AAB | `release/current/artifacts/game.aab` | `release/current/release.json`, `FILE_INDEX.json`, `docs/build-report.json` |
| Refresh that AAB | `tools/Update-CurrentAAB.ps1` | `tools/materialize_aab.py`, `docs/release/CURRENT_AAB.md` |
| Godot project | `game/project.godot` | `game/GODOT_VERSION`, `game/export_presets.cfg` |
| Entry ordering | `game/scripts/ui/story_director.gd` | `game/scripts/ui/entry/entry_onboarding.gd` |
| Prologue shots, grounding, writing | `game/scripts/ui/entry/` | `game/data/entry/`, `game/assets/ui/narrative/prologue_v002/` |
| Three tutorial episodes | `game/data/entry/tutorial_v001.json` | `game/scripts/ui/entry/tutorial_battle.gd` |
| English dialogue, Auto, typewriter | `game/scripts/ui/vn/vn_screen.gd` | `game/assets/ui/narrative/tutorial_v002/` |
| Character states, icons, ultimates | `game/data/presentation/battle_art_v001.json` | `game/scripts/ui/battle/battle_art.gd`, `game/assets/characters/` |
| Side-by-side battle presentation | `game/scripts/ui/battle/battle_field.gd` | `battle_actor.gd`, `battle_skill_tray.gd`, `ultimate_presentation.gd` in that folder |
| Live combat model | `game/scripts/core/battle/live_battle.gd` | `game/scripts/services/`, `game/scripts/core/battle/` |
| Shared UI | `game/theme/`, `game/scripts/ui/common/` | `game/scripts/ui/app_shell.gd` |
| Native preview | `game/scripts/art_review/preview_session.gd` | `fadyme_pilot.gd`, `game/scenes/art_review/entry_preview.tscn` |
| Session and release state | `game/scripts/app/game.gd`, `game_flow.gd` | `online.gd`, `installed_content.gd`, `entry_restart.gd` in that folder |
| Registry and content hashes | `game/data/content/MANIFEST.json` | `game/scripts/core/content/` |
| API, online rules | `server/src/` | `server/test/`, `server/wrangler.toml` |
| Database | `database/migrations/` | `database/README.md` |
| Admin | `admin/` | Separate Worker and static Next.js export |
| Current creative direction | `narrative/00_Canon/Owner_Current_Direction/CREATIVE_RESTART_PROMPT.md` | `narrative/FADYME_MEDIA_ALL/00_APPROVED_VISUAL_CANON_FADYME_MAHMUT_v001.json` |
| Recent approved implementation | `docs/design/OPENING_TUTORIAL_REVISION_v006_2026-10-08.md` | `docs/DECISIONS.md`, `docs/CURRENT_STATE.md` |
| Local asset audit | `build/project-organization-20261008/ASSET_AUDIT.md` | `asset-classification-evidence.json` in that folder |
| Active skills/agents/workflows | `.codex/` | `.agents/skills/` discovery links; `.agents/library/` provenance/deferred index |
| Historical tooling and documents | `.agents/archive/`, `.archive/` | Former `.claude/` and `CLAUDE.md` sources are preserved in the archive; root `CLAUDE.md` now contains the current coding handoff |

## Fast lookup

Run `python tools/project_catalog.py build` after organization changes. The ignored `.local/project-index.json` catalogues Git-visible authored files, byte counts, hashes, feature tags and membership in the current AAB source. It does not read private key contents. Runtime files keep their paths and UIDs; generated release files point back to their source.

```powershell
python tools/project_catalog.py find fadyme --scope aab
python tools/project_catalog.py find patch --scope active
python tools/project_catalog.py find tutorial --category client_source
python tools/project_catalog.py check
graphify query "Entry tutorial patch restart"
```

Use Graphify queries first for code relationships, then `path`/`explain` for a selected boundary. `graphify-out/wiki/index.md` is broad navigation. After code changes run `graphify update .` and the project refresh helper as required by `AGENTS.md`. The graph's semantic coverage flags remain explicit; a directory catalogue is not a claim that every historical document is semantically reviewed.

`game/` remains the editable development source. `release/current/` is generated and contains one sealed test version. `build/` keeps ignored build evidence; `.local/` keeps ignored working indexes. Reference collections stay local with provenance and licenses and enter exports only when selected. The secondary Production folder and LEGACY originals remain read-only. Moving Godot resource trees just to tidy folders would break paths and UIDs; this organization uses explicit boundaries and indexed navigation.
