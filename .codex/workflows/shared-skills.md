# Shared skill installation and review

Canonical source: .codex/skills. Codex discovers .agents/skills; Claude Code discovers one relative link per skill under .claude/skills. These expose identical source files and references; they do not activate archived hooks or alter role ownership.

Linux/macOS: `python3 .codex/scripts/bootstrap_skills.py`. Windows: `powershell -NoProfile -ExecutionPolicy Bypass -File .codex/scripts/bootstrap_skills.ps1`. The bootstrap refuses user folders/conflicting links. A Git symlink checked out as exact target text can be reconstructed on Windows; junction fallback stays local. Run after clone/move or new skills. Existing junctions to another location are a reported conflict; safely remove only the verified link node before repeating.

Run `python3 .codex/scripts/validate_system.py` and `python3 .codex/scripts/validate_shared_skills.py`. The latter verifies both resolved loaders, every shared file hash and upstream notices/snapshot hashes. Compare native client's discovered names after refreshing its session. Filesystem equivalence is not a native-loader success claim.

Godot AI remains 4.3.0. Use its official dock-generated authenticated attach configuration separately in each client's private settings. Verify actual schema inventory, project root, 4.7.2, gl_compatibility, scene tree and error logs. Do not write tokens/config into this repository or install a second editor-control addon.

The initial three studies live under references/shared_godot, outside game/. No study plugin is registered in the game and no study file enters its exports. Promotion needs a specific reviewed handoff to Claude; isolated tests are not gameplay/Android acceptance.
