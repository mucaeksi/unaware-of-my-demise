# MCP / CLI Tooling

Phase 2. Verified 2026-10-03 in Claude Code Cloud. MCP servers are configured
at the Claude Code Cloud environment / account level (connectors), not in this
repository. Tool counts are as exposed to the session (deferred tools are
loaded on demand, which keeps the active tool surface small).

| MCP | Purpose | Status | Cloud compat | Tools (approx.) | Security notes | Recommendation |
|---|---|---|---|---|---|---|
| GitHub (`mcp__github__*`) | PRs, Actions, files, reviews | VERIFIED (repo search, actions list) | yes | ~45, deferred | scoped to `mucaeksi/unaware-of-my-demise` | KEEP |
| Cloudflare Developer Platform (`mcp__Cloudflare_Developer_Platform__*`) | Workers, Hyperdrive, R2, D1, KV | VERIFIED (read Workers/Hyperdrive/R2) | yes | ~25, deferred | OAuth; includes delete tools — never used autonomously | KEEP (curated reads) |
| Cloudflare API (`mcp__cloudflare__search/execute/docs`) | full Cloudflare REST API (Builds, settings, deployments) | VERIFIED (Workers Builds triggers/builds, script settings) | yes | 3 | can mutate anything in the account; use read calls unless a change is authorized | KEEP (needed for Builds/settings not covered above) |
| Neon (`mcp__Neon__*`) | project/branch/schema inspection, SQL | VERIFIED (describe project, branches, tables, read-only SQL) | yes | ~110, deferred | write mode active, destructive tools exposed → never run destructive tools autonomously; prefer read-only on `production` | KEEP |
| Google Drive (`mcp__Google_Drive__*`) | LEGACY archive read | VERIFIED (see `docs/DRIVE_LEGACY_ACCESS.md`) | yes | 11, deferred | has trash/update/share tools → never used on LEGACY | KEEP (read-only usage) |
| claude-code-remote | session mgmt, PR subscriptions, triggers | VERIFIED | yes | ~25 | — | KEEP |
| Claude Docs | living documents | not used | yes | — | — | NOT_APPLICABLE |
| Playwright MCP | browser automation | not present as MCP; Playwright CLI 1.56.1 + Chromium installed | yes (CLI) | — | — | NOT_APPLICABLE for now (use `@playwright/test` in `admin/`); ADD only if interactive browsing is needed |
| Godot MCP | editor/scene/script operations | not installed | see below | — | — | UNKNOWN → evaluation below |

## Godot MCP evaluation

Requirement: must work in Claude Code Cloud without a local Godot Editor.

Verified facts:
- The official Godot 4.7.2 Linux binary runs headless in this container
  (`--headless --import`, `--check-only --script`, `--quit-after`,
  `-s <script>` all exercised).
- No Godot MCP is configured in this environment.

Assessment:
- MCPs that work by talking to a running editor plugin (WebSocket bridge to an
  open editor) are **CLOUD_INCOMPATIBLE** as a default: there is no GUI editor
  in the container.
- MCPs that merely wrap the Godot CLI add no capability beyond the headless
  CLI already available, while adding a dependency and tool surface.

Decision: do not install a Godot MCP. Use headless Godot CLI in-session
(downloaded and SHA-512 verified per session) and in GitHub Actions for
import, script parse checks, gdUnit/GUT tests, PCK and AAB export. Revisit
only if a concrete capability (e.g. scene screenshots) is missing — headless
screenshots can also be produced via a `--rendering-driver opengl3` run under
`xvfb-run` in CI.

## CLI tooling

| Tool | Status | Notes |
|---|---|---|
| `npx wrangler` | available via npm (not globally installed) | pin as `server/` devDependency; deploy needs `CLOUDFLARE_API_TOKEN` (not present in session) |
| Neon CLI | not installed | Neon MCP covers inspection; migrations run from CI with `psql`/node |
| `psql` 16 | installed | client only (Neon runs PG 18; protocol compatible) |
| Godot 4.7.2 | per-session download + SHA-512 verify | `CLOUD_DEPENDENCY_GAP` mitigated; candidate for an environment setup script |
| Playwright 1.56.1 | installed, browsers at `/opt/pw-browsers` | do not run `playwright install` |
