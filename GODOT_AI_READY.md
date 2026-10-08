# Godot AI — current workspace

Verified on 2026-10-08 after the selective workspace copy. Current project: `F:/unaware-of-my-demise/game/project.godot`.

| Check | Result |
|---|---|
| Engine / actual renderer | Godot 4.7.2 stable official / Compatibility OpenGL |
| Plugin / backend | Official Godot AI 4.3.0; plugin bytes unchanged |
| Transport | Official authenticated `godot-ai attach`, STDIO; telemetry disabled |
| Connected project | `F:/unaware-of-my-demise/game/`, confirmed by live session metadata |
| Desktop preview | Entry sample scene and native `LocalUiPreview`, visible at 540×960 |
| Final liveness | Game helper live; `game_capture_ready=true` |
| Final logs | Editor errors 0, existing warnings 103; current game errors 0 |
| Fresh import / GUT | Clean import exit 0; 509/509 tests passed |
| Remote cloud-to-desktop access | Not configured or validated by this copy |

The personal Codex MCP configuration already points at this destination. No personal capability record, API key or client configuration was copied into Git. The authenticated backend listens on loopback ports 8000 and 9500.

This chat's native tool catalogue does not expose Godot AI tools. Live verification used the installed official attach CLI with the MCP SDK. A first attach attempt arrived during backend startup and returned HTTP 401; the next authenticated probe succeeded. An initial temporary game-eval command lacked an explicit variable type and stopped in the debugger. The preview was stopped and relaunched with the typed command; project source and strict-typing settings were unchanged. The successful final run remains open with the editor and native preview.

The native preview screenshot was captured through its actual Window viewport and visually inspected. A separate `editor_screenshot(source="game")` attempt returned `TRANSPORT_OUTCOME_UNKNOWN`; that tool is not counted as a successful screenshot. Successful native capture and final liveness/log replies are local evidence in ignored `.local/migration-20261008/`.

For daily use open `game/project.godot`. Prefer Godot AI for editor-aware inspection and complex scene/resource operations. Run `res://scenes/art_review/entry_preview.tscn` with local sample data and reuse `game/scripts/art_review/preview_session.gd`; refresh after validated changes. Keep the editor, game and native preview open. Codex produces character/environment designs in the workbench; Claude owns runtime code and integration under the [handoff](docs/ART_AND_CODE_HANDOFF.md).

For cloud work, clone the GitHub repository and rebuild caches/dependencies from committed sources. Cloud does not automatically see desktop windows. Desktop viewing/control requires an owner-configured authenticated SSH route running official `godot-ai attach` on the desktop account. Keep capability records on that account; do not expose backend ports publicly or put credentials in Git. This migration does not install SSH or prove a remote route.

Historical installation provenance: [GODOT_AI_LOCAL.md](docs/GODOT_AI_LOCAL.md). Its 2026-10-06/07 paths, test counts and stopped-editor notes are historical. Current build/copy boundaries: [workspace copy report](docs/release/WORKSPACE_COPY_2026-10-08_TR.md).
