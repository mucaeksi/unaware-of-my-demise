---
name: security-audit
description: "Codex/UOMD adaptation. Security guidance and vulnerability review for codebases, APIs, services, CLI tools, libraries, and daemons. Use for security questions, focused reviews, vulnerability research, security audits, or pen tests. Run the complete workflow only for explicit codebase audit or pen-test requests, full/comprehensive/end-to-end reviews, or requested report artifacts."
---
# security-audit — Codex adaptation

Read the [canonical skill](../../../.claude/skills/security-audit/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/security-audit/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Preserve the canonical guidance/full-audit distinction, scope, independent review boundaries and OS-enforced audit sandbox requirements. Reading this adapter does not start a comprehensive audit.
- Map generic Task/research/general roles to available Codex capabilities only when delegation is authorized and isolation is possible. Otherwise perform bounded guidance inline; do not invent independent review evidence.
- Missing audit isolation is a real runtime limitation: continue permitted read-only guidance and report the limit rather than replacing the sandbox with a working directory or environment flags.
- Replace upstream home-directory output defaults with authorized scratch/report paths outside the target. Do not rewrite host HOME/CODEX_HOME or global configuration to simulate isolation.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
