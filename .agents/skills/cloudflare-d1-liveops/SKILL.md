---
name: cloudflare-d1-liveops
description: "Codex/UOMD adaptation. Architect, implement and audit the Cloudflare-only production backend for Unaware of My Demise: Workers, D1 SQLite, R2, Queues, Cron, Access, admin, game economy, events, patch manifests and Goog …"
license: "MIT"
---
# cloudflare-d1-liveops — Codex adaptation

Read the [canonical skill](../../../.claude/skills/cloudflare-d1-liveops/SKILL.md) in full before applying its workflow. Its source directory is `.claude/skills/cloudflare-d1-liveops/`: resolve every relative reference, script and data path against that directory. This adapter deliberately reuses the pinned content instead of making another drifting copy.

Read root README and AGENTS.md. User/session instructions and runtime permissions take precedence. Treat Bash/Read/Write/Task names as generic capabilities and use actual Codex shell, file, connector and delegation tools; never assume Claude's MCP names, environment variables, hooks or authentication exist here.

Write reports in the user's language, adapting source-specific English labels when helpful without changing the requested review structure.

## Host adaptations

- Prefer available Cloudflare connector/plugin tools and current official docs. CLI credential availability and connector access are separate; verify the specific capability instead of asking for secret values.
- Staging deploys only through Cloudflare Workers Builds when the owner pushes GitHub `main` (D-28): one build per Worker, the game build gates on `npm run verify` and runs tools/deploy_staging.sh game (game owns D1 migrations/seeds). Agents never push or deploy; GitHub Actions stays unused. Keep the existing server-authoritative economy and Access/RBAC checks.
- Use uomd-monitoring for safe operational data and uomd-monetization for SSV/Play/RTDN changes. Do not interpret a skill's general infrastructure recipes as authorization to provision production or paid services.

If a source instruction conflicts with these host adaptations, use the adaptation for Codex while retaining the source's technical/safety constraints. Do not rewrite the canonical Claude skill. See [Codex setup and catalog](../../../docs/CODEX_SKILLS.md) for runtime verification and refresh instructions.
