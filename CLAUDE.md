# Unaware of My Demise — Claude coding handoff

Owner direction, 2026-10-08: Codex produces character/environment designs and creative assets; Claude handles coding and integration; the owner handles GitHub pushes and publication. This supersedes the old takeover prompt retained under `.agents/archive/20261008/sources/CLAUDE.md`.

Owner update, 2026-10-09: continue validated work in cloud and commit/push to
`main`; desktop review uses GitHub Desktop fetch/pull and local Godot. This
updates the push responsibility above. See `docs/coder/CLOUD_MAIN_SYNC.md`.
Store/app publication and paid Google audio batches remain separate decisions.

Read `AGENTS.md`, `.codex/standards/authority.md`, `docs/ART_AND_CODE_HANDOFF.md`, `docs/PROJECT_MAP.md`, `docs/ARCHITECTURE.md` and `GAME_TOOLCHAIN.md`. Current owner instructions take precedence. Archived hooks and deployment permissions are inert.

Claude owns Godot code/scenes/UI integration, Android native code, server/database/admin, tests and build tooling within the owner's requested scope. Preserve Godot 4.7.2, GDScript, Android portrait 1080x1920, actual `gl_compatibility`, strict typing, current controllers/autoloads/plugins and the GUT harness. Historical `project.yaml` mismatches do not authorize retargeting.

Codex stages briefs, prompts, candidates, approved designs and provenance in `narrative/15_Art_Workbench/`. Integrate only explicit handoffs with existing stable IDs, version, purpose, approval evidence, source/license metadata, dimensions/anchors, runtime destination and base/patch inclusion. Preserve reference masters, `.uid` and `.import`. Neither role invents missing canon. New character/environment artwork does not select a new gameplay screen; current implemented presentation remains Entry, with deferred systems unchanged.

Edit `game/`. `release/current/` is generated, sealed local review output; refresh it through the current-AAB workflow after accepted changes. Content patches carry only allowed data/imported assets; code, scenes, script-bearing resources and project settings require a new AAB.

Cloud coding uses a GitHub checkout and the pinned Linux/Android toolchain. Rebuild native AARs and import Godot resources; use existing lockfiles, CI scripts and tests. Windows executable paths, private credentials and generated caches are not cloud inputs. Run relevant GUT/parity/content/native/build checks. Meaningful visual changes require actual Godot runtime inspection and native screenshots; headless success does not establish visual or Android-device acceptance.

Use official Godot AI 4.3.0 and `preview_session.gd` with local sample data. Cloud now has its own verified graphical editor/runtime and authenticated attach session; private capabilities stay in its account-local config. The owner reviews pulled source in desktop Godot; no cloud-to-desktop bridge is required for that workflow. Keep the editor/runtime/preview open when available. Without a live GUI/MCP connection, record native review as pending.

Query Graphify first for code relationships when available. After code changes run `graphify update .`, then `tools/graphify_project.py --refresh` using the configured Graphify Python interpreter.

The owner intends to push this prepared workspace. Do not independently push, deploy, publish patches, upload to Play, replace signing keys, invoke paid creative APIs or message another chat without explicit task authorization. Restored `main` workflows may automatically deploy production after successful CI; publication intent must be explicit.

Keep API credentials, signing keys, personal client settings and MCP capability records out of Git. Production and Drive LEGACY originals are read-only. UI/subtitles stay English; voice stays Japanese.
