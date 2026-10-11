---
name: uomd-wrangler
description: Use UOMD's pinned Wrangler CLI and existing Cloudflare build pipelines with explicit environment/config selection, separate access checks and safe D1 migration ownership.
---
# UOMD Wrangler operations

Read README/AGENTS.md and the installed Cloudflare plugin's `wrangler` skill before CLI work when available. Retrieve current [Wrangler docs](https://developers.cloudflare.com/workers/wrangler/) and inspect the project's actual CLI help/schema. This project-authored entry point preserves repository-specific constraints; it does not install or upgrade Wrangler.

Use the locked local CLI from `apps/api`, for example `npx --no-install wrangler --version`. Check current package.json/package-lock.json rather than hardcoding the previously observed 4.149.0 version. Do not substitute upstream `wrangler@latest`, deprecated test-plugin examples or a global CLI without reviewing compatibility. Existing API tests use the configuration actually checked into the repository.

For every command:

1. Choose game/admin/ops, the exact `wrangler.*.jsonc`, and dev/staging environment deliberately. Local simulation, remote bindings and remote D1 are different targets; inspect config and flags rather than relying on defaults. Retain existing resource IDs and bindings; do not trigger automatic provisioning from a generic example.
2. Verify the relevant authorization without reading secret values. Working Cloudflare connector access does not imply Wrangler credentials. Missing CLI authorization is reported with the required capability; do not initiate login, replace injected credentials, or collect tokens in chat merely to inspect the project.
3. Separate read-only information/list/SELECT operations, local checks, and mutations. Match the current user scope. Do not apply migrations, seed live data, put secrets, deploy or create/delete resources during a read-only review.
4. Use `tools/deploy_staging.sh game|admin|ops` through the existing Workers Builds pipeline for authorized staging delivery. A build deploys one Worker only. Game owns D1 migrations/seed; admin and ops do not apply the same migrations concurrently. Do not add GitHub Actions or manually overwrite an active build's deployment without a task-specific need.
5. Generate/validate binding types and use dry-run/local checks where relevant and authorized. Preserve inherited network policy, proxy/CA and credential selectors. Local tooling is not a route around external network restrictions.
6. After delivery compare actual Worker version/tag to the intended commit and capture safe result evidence. Never label a dry run, queued build or version upload as a live deployment.

Use uomd-cloudflare-platform for architecture and uomd-workers-review for code/config review. Secret, production, permissions and spending restrictions remain those of README and the current task.
