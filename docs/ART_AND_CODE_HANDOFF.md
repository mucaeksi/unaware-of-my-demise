# Art and code handoff

Owner direction, 2026-10-08: Codex produces character and environment designs; Claude handles coding/integration. Updated 2026-10-09: the owner authorized completed, validated cloud changes to be committed/pushed to `main`, then pulled with GitHub Desktop for local Godot play. Store/app publication remains owner-controlled. See [cloud/main sync](coder/CLOUD_MAIN_SYNC.md). `AGENTS.md` and `.codex/standards/authority.md` govern both roles.

| Area | Owner | Working location |
|---|---|---|
| Character/environment briefs, prompts, candidate images and art metadata | Codex | `narrative/15_Art_Workbench/characters/`, `locations/` |
| Existing canon/reference originals | Read-only inputs for both roles | Existing `narrative/00_Canon/`, `06_Characters/`, `08_Locations/`, `14_References/`, `FADYME_MEDIA_ALL/`, `character_reference/` |
| Runtime source, scenes, shaders, UI integration, server and tests | Claude | Existing `game/`, `server/`, `database/`, `admin/`, `tools/` |
| Validated runtime asset derivatives | Explicit handoff between both roles | Existing `game/assets/characters/`, `backgrounds/`, UI/VFX folders; stable IDs retained |
| AAB/content builds and release evidence | Claude prepares; owner accepts/publishes | `release/current/`, `release/support/`, build tools and CI |

The workbench is creative staging outside `game/`; its contents are not automatically exported or approved. Use the current owner direction and actual available references, not stale historical reference paths. New art does not silently replace locked originals or select a new gameplay screen. Current implemented presentation remains Entry.

For each handoff record the existing/owner-confirmed IDs, version, purpose and requested screen; reference/source hashes; actual tool/prompt; candidate/approval status; dimensions/alpha/silhouette/anchors/atlas regions/mobile scale; license; runtime path and dependencies; base AAB/content patch/reference-only inclusion; import/test results and actual preview screenshots. Never record credentials or personal client paths. Use the workbench handoff template and preserve approved versions.

The owner disabled ignore rules and tracks project files. Git stores source, notices, provenance, prompts and design outputs; current AAB/base PCK use Git LFS. Select deliverables explicitly and keep credentials and generated dependency/cache folders outside that selection. Edit upstream `game/` and rebuild the sealed `release/current/`.

After a clone run `.codex/scripts/bootstrap_skills.ps1` with PowerShell 7 (or create the equivalent relative Linux discovery link), then the existing system validators. Cloud installs Godot/templates 4.7.2, JDK 17, SDK 36/build-tools 36.1.0, Gradle 8.11.1, Node 22 and rebuilds UomdNative AARs before Android export. Current CI scripts and `GAME_TOOLCHAIN.md` are the build reference. Historical `project.yaml` renderer/test command mismatches are not permission to replace the renderer or GUT harness.

For desktop review open root `game/project.godot`, keep the existing Godot AI plugin and use `preview_session.gd` with local sample data. Cloud has its own graphical Godot 4.7.2 / Godot AI 4.3.0 session, verified through authenticated attach. No remote desktop connection is required for the selected workflow: the owner pulls `main` and runs the same source locally. Private cloud capabilities and environment settings stay outside Git.

Pushing `main` starts CI; restored workflows can automatically deploy the Worker/admin after successful CI when their configuration is ready. Android release and content publishing remain manual workflows requiring signing/configuration secrets.

Final AAB exception, owner update 2026-10-09: the prepared review fixes/dialogue restoration and build evidence close Codex's AAB responsibility. Future fixes, runtime integration and AAB work belong to Claude. Codex's ongoing role is game/script inspection and asset/design production, stored on `main`. Fadyme is the selected first character across the opening, seven chapters, companion stories, events, voice bank, combat and UI. See [Fadyme audit and design scope](../narrative/15_Art_Workbench/characters/fadyme/audit_v001/README.md) and [FIRST_AAB_PLAN.md](release/FIRST_AAB_PLAN.md).
