# Local game toolchain

Current authority: `AGENTS.md` and `.codex/standards/authority.md`. Godot 4.7.2 with matching export templates; root `game/`, GDScript, Android portrait at 1080 x 1920, actual `gl_compatibility` renderer, strict untyped-declaration warnings. Do not retarget the renderer from historical `project.yaml` settings.

Keep the existing Editor, game and native Local UI Preview open. Use Godot AI MCP for editor-aware changes and `game/scripts/art_review/preview_session.gd` for local sample review. Hot reload where possible; restart only for a concrete parse, debugger or lifecycle problem. Meaningful presentation changes require actual runtime evidence as well as headless checks.

Headless opening builds: `tools/Build-OpeningBundle.ps1`. Verified current-folder update: `tools/Update-CurrentAAB.ps1`. Standalone extracted-source build: `tools/Build-CurrentAAB.ps1`. Required Python has only standard-library dependencies for inventory/materialization. See `docs/release/CURRENT_AAB.md` for commands.

Android: JDK 17, SDK platform 36/build-tools 36.1.0, Gradle 8.11.1; the native plugin pins Android Gradle Plugin 8.6.1. The project exports arm64. Use `game/tools/build_uomd_native.sh` to rebuild native AARs and legal notices. Signing keys stay external; current artifacts use the local debug identity. No key or personal tool settings are copied into release/current.

Use the existing GUT and parity/UI harness in `game/tests/`, existing scripts and Godot AI MCP. Do not install a replacement harness. Graph maintenance uses `graphify update .` followed by `tools/graphify_project.py --refresh` through the interpreter recorded in `graphify-out/.graphify_python`.

Current skills/agents/workflows are under `.codex/`. After cloning/moving, run `.codex/scripts/bootstrap_skills.ps1` for the discovery links. Source editor tooling remains in the development project and is excluded from exported/current source. Old cloud-only toolchain instructions are archived under `.archive/project-docs-20261008/`.
