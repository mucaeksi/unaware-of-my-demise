---
name: v3-to-v4-migration
description: "Codex/UOMD adaptation. Use this skill when migrating a Phaser 3 project to Phaser 4, or when a user asks about breaking changes, API differences, or how to update their v3 code. Covers renderer changes (pipelines to render nodes), FX/masks to filters, tint system, camera matrix, texture coordinates, DynamicTexture, shaders, lighting, removed game objects, and a full migration checklist. Triggers on: migrate, upgrade, v3 to v4, breaking changes, Phaser 3 to 4, migration guide, update from v3."
---
# v3-to-v4-migration — Codex adaptation

Read the [canonical skill](../../../.claude/skills/v3-to-v4-migration/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/v3-to-v4-migration/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Treat the canonical Phaser guidance as topic documentation. Verify API examples against the installed Phaser types and package version before changes.
- Keep project architecture and Android-first constraints from README. This topic does not authorize a Phaser upgrade, another engine, production rollout or new dependency by itself.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
