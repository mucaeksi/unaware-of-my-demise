---
name: ui-ux-pro-max
description: "Codex/UOMD adaptation. UI/UX design intelligence for web, mobile, and desktop. This skill should be used when designing, building, reviewing, or fixing interfaces, including pages, components, design systems, accessibi …"
---
# ui-ux-pro-max — Codex adaptation

Read the [canonical skill](../../../.claude/skills/ui-ux-pro-max/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/ui-ux-pro-max/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Replace `${CLAUDE_SKILL_DIR}` with the absolute canonical directory `.claude/skills/ui-ux-pro-max/`; resolve scripts/data there, not beside this adapter.
- Local example from repository root: `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "analytics dashboard accessibility" --stack react`.
- Use the established Gothic tokens and Unity 6 LTS (URP 2D + Runtime UI Toolkit + TextMeshPro in `apps/unity/`) and React (`apps/admin`) architecture. Database/search recommendations do not authorize new dependencies or a different art direction. Do not persist a replacement design system unless the task calls for it.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
