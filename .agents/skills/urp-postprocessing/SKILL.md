---
name: urp-postprocessing
description: "Codex/UOMD adaptation. Sets up, configures, and debugs URP post-processing with the Volume framework. Use for bloom, tonemapping, color adjustments, depth of field, vignette, or other Volume overrides."
---
# urp-postprocessing — Codex adaptation

Read the [canonical skill](../../../.claude/skills/urp-postprocessing/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/urp-postprocessing/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Preserve the canonical workflow and resolve its resources against the source directory. Review new source/version changes before using new runtimes or instructions.
- Use current project constraints and actual host capabilities; do not infer permission to install, delegate, spend or deploy from generic examples.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
