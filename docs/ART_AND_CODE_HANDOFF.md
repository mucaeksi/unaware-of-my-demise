# Art and code handoff

Owner direction, 2026-10-08: Codex produces character and environment designs; Claude handles coding/integration. The owner handles GitHub pushes and publication. `AGENTS.md` and `.codex/standards/authority.md` govern both roles.

| Area | Owner | Working location |
|---|---|---|
| Character/environment briefs, prompts, candidate images and art metadata | Codex | `narrative/15_Art_Workbench/characters/`, `locations/` |
| Existing canon/reference originals | Read-only inputs for both roles | Existing `narrative/00_Canon/`, `06_Characters/`, `08_Locations/`, `14_References/`, `FADYME_MEDIA_ALL/`, `character_reference/` |
| Runtime source, scenes, shaders, UI integration, server and tests | Claude | Existing `game/`, `server/`, `database/`, `admin/`, `tools/` |
| Validated runtime asset derivatives | Explicit handoff between both roles | Existing `game/assets/characters/`, `backgrounds/`, UI/VFX folders; stable IDs retained |
| AAB/content builds and release evidence | Claude prepares; owner accepts/publishes | `release/current/`, ignored `release/support/`, build tools and CI |

The workbench is creative staging outside `game/`; its contents are not automatically exported or approved. Use the current owner direction and actual available references, not stale historical reference paths. New art does not silently replace locked originals or select a new gameplay screen. Current implemented presentation remains Entry.

For each handoff record the existing/owner-confirmed IDs, version, purpose and requested screen; reference/source hashes; actual tool/prompt; candidate/approval status; dimensions/alpha/silhouette/anchors/atlas regions/mobile scale; license; runtime path and dependencies; base AAB/content patch/reference-only inclusion; import/test results and actual preview screenshots. Never record credentials or personal client paths. Use the workbench handoff template and preserve approved versions.

Git stores source, notices, provenance, prompts and design outputs within size limits. Generated AAB/PCK/AAR files, caches, credentials and native preview evidence stay ignored locally or go to owner-authorized artifact storage. Edit upstream `game/` and rebuild the sealed `release/current/`.

After a clone run `.codex/scripts/bootstrap_skills.ps1` with PowerShell 7 (or create the equivalent relative Linux discovery link), then the existing system validators. Cloud installs Godot/templates 4.7.2, JDK 17, SDK 36/build-tools 36.1.0, Gradle 8.11.1, Node 22 and rebuilds UomdNative AARs before Android export. Current CI scripts and `GAME_TOOLCHAIN.md` are the build reference. Historical `project.yaml` renderer/test command mismatches are not permission to replace the renderer or GUT harness.

For desktop review open root `game/project.godot`, keep the existing Godot AI plugin and use `preview_session.gd` with local sample data. Cloud MCP attachment runs authenticated `godot-ai attach` on the desktop user account over authorized SSH; private capabilities stay there. This copy does not install SSH access or assert a cloud connection exists.

Before the owner pushes `main`, note that restored workflows can automatically deploy production after successful CI. Android release and content publishing are manual workflows requiring signing/configuration secrets. Copying the repository does not invoke them.
