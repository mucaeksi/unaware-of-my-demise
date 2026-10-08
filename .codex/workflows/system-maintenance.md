# Unified system maintenance

Edit active skills only in `.codex/skills/`. Maintain the capability/source/alias index in `.agents/library/` when adding, renaming or retiring a skill. Retain inactive original procedures under `.agents/archive/`; do not activate deferred AI/economy/progression/release workflows without owner scope.

Run `.codex/scripts/validate_system.py` after changes. Run `.codex/scripts/bootstrap_skills.ps1` after cloning or moving the checkout; it verifies or recreates the discovery bridge without replacing a normal populated folder. Junctions are local Windows metadata and are not Git-portable. `.agents/skills/` is ignored; the bootstrap and canonical targets are portable. On platforms permitting it, the bootstrap creates a relative symbolic link instead.

Run `.codex/scripts/verify_codex.py` to start a fresh installed Codex app-server and request `skills/list` with forceReload. It checks real parser/discovery results, duplicate names and expected project skills without creating a sidebar chat, restarting the owner app or changing personal configuration. A separate ephemeral Codex session can test actual skill invocation when needed.

Custom subagents are standalone TOML files with name, description and developer_instructions; inherit model/effort. Do not register legacy Markdown roles as working Codex agents or add unsupported config tables. Keep existing personal config, MCP connections, plugins and hooks unchanged.
