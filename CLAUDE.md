# Claude Code entry point (Claude Opus 5.5 — Decision D-31)

Read the root [README.md](README.md) completely before coding. It is the sole authoritative engineering master prompt. Use `narrative/` for fiction/canon and [docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md](docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md) for the Unity 6 LTS (`apps/unity/`) migration blueprint.

Under Decision D-31 (2026-10-24), **Claude Opus 5.5** (`claude-opus-5-5` / Claude Code) owns 100% of repository engineering, the Unity 6 LTS client (`apps/unity/`), Cloudflare Workers + D1 backend (`apps/api/`), React Control Center (`apps/admin/`), and Google Gemini API creative asset production.

Use project skills under `.claude/skills/` (`uomd-unity-engine`, `unity-6-core`, `unity-urp-2d`, `unity-ui-toolkit`, `unity-2d-animation`, `unity-deterministic-combat`, `unity-android-il2cpp`, `unity-mcp-workflow`), Unity specialist subagents under `.claude/agents/` (`unity-architect`, `unity-csharp-reviewer`, `unity-build-resolver`), and project MCPs from `.mcp.json` (`uomd-unity-live`, `graphify`, `chrome-devtools`). Follow the verified skill lock and `tools/bootstrap_skills.py`.

Do not create a second competing master prompt. Never silently rewrite narrative canon; the Godot-era (`archive/godot-era`) and PixiJS/Capacitor-era (`apps/game/`, `apps/android/`) runtimes are retired.
