# godot-nodes-scenes

Status: ACTIVE: `uomd-godot-nodes-scenes`.

Purpose: Structure a Godot 4.7 project with the scene tree and node composition: build reusable scenes, instance PackedScenes at runtime, navigate the tree safely, and register autoload singletons. Use when designing .tscn scenes, deciding how to split nodes, spawning instances with instantiate(), wiring autoloads, or fixing "node not found"/freed-node errors in a Godot project.

Original workflow coverage (the source retains the full procedures and examples):

- When to use
- Core workflow
- Patterns
- 1. Instance a scene at runtime
- 2. Safe node access: $, get_node_or_null, and unique names
- 3. An autoload singleton (global game state)
- 4. Change the running scene
- Pitfalls
- References
- Related skills

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.agents/skills/godot-nodes-scenes/SKILL.md` — SHA-256 `c086047a31b88c58b35af5591f363a5b99cb87f817825f3161b6ba6e8209fea8`
