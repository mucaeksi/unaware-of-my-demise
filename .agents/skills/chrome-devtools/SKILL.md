---
name: chrome-devtools
description: "Codex/UOMD adaptation. Uses Chrome DevTools via MCP for efficient debugging, troubleshooting and browser automation. Use when debugging web pages, automating browser interactions, analyzing performance, or inspecting network requests. This skill does not apply to `--slim` mode (MCP configuration)."
---
# chrome-devtools — Codex adaptation

Read the [canonical skill](../../../.claude/skills/chrome-devtools/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/chrome-devtools/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Use the pinned `tools/mcp_chrome_devtools.sh` launcher (chrome-devtools-mcp@1.10.1), not upstream @latest examples.
- Inspect the live tool schemas: optional pageId/extension tools in newer documentation may be absent in the pinned runtime. Use only callable tools and actual parameters.
- When no DevTools MCP is connected, use the existing Playwright tests/browser tooling if available and name the fallback. A config file is not a successful browser call.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
