# Codex entry point

Read the root [README.md](README.md) completely before substantial work. It remains the sole engineering master prompt; `narrative/` remains the fiction/canon source. This file adapts the host, not the game specification.

The owner has authorized Codex to develop alongside Claude. Follow the current task assignment and README. The older Claude-exclusive ownership table in `docs/AGENT_RULES.md` does not restrict work explicitly assigned to Codex. Coordinate through isolated worktrees and reviewable commits; never overwrite another agent's working tree or force-push shared history.

For Codex, discover project skills under `.agents/skills/`. Read the relevant `SKILL.md`, then its linked canonical source and only the needed references. The shared, pinned skill content stays in `.claude/skills/`; do not modify `.claude/`, `CLAUDE.md`, `.mcp.json` or the Claude bootstrap while maintaining the Codex adapters. Validate them with `python3 tools/sync_codex_skills.py --check`.

Use [uomd-codex-workflow](.agents/skills/uomd-codex-workflow/SKILL.md) for repository coordination and validation. Use [docs/CODEX_SKILLS.md](docs/CODEX_SKILLS.md) for the complete catalog, invocation examples, runtime status and optional MCP setup. Native Codex calls use `$<skill-name>`; Claude slash commands and plugin-qualified names are not assumed to exist here.

Session/user authorization and available tools govern execution. A skill file or MCP declaration alone does not prove a live connection. Keep the current host's permissions, credentials and tool schemas; do not install upstream hooks, start paid generation, change global configuration or grant permissions through a skill adaptation.
