---
name: uomd-workers-review
description: Review UOMD Worker code and configuration using current official Workers best practices, installed types, binding schemas and concrete source evidence.
---
# UOMD Worker review

Read README/AGENTS.md and use the installed Cloudflare plugin's `workers-best-practices` skill and needed references when available. This project-authored entry point maps that guidance to UOMD; it does not install a plugin. Retrieve the [current best-practices page](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) before relying on platform-specific claims. If retrieval fails, state the evidence limit and inspect local types/schema rather than guessing.

Read complete affected files and current `apps/api/wrangler.*.jsonc`, package versions and `node_modules/wrangler/config-schema.json`. Check current provider types alongside the project's installed types; verify compilation against the version actually used. Retrieve newer reference packages only into authorized scratch when necessary, without replacing the project's dependency lock or running package hooks.

Review these concrete behaviors:

- Request/body/response size bounds and streaming of large data; matched-route error handling and safe structured logs.
- Awaited work and `ctx.waitUntil` for appropriate post-response work; request-specific state isolation; retries and durable Queues/Cron work where the behavior needs it.
- Module handlers' `env` versus platform classes' `this.env`; handler/base-class signatures, binding names, generated/config-consistent Env types and unsupported casts.
- D1 statements/batches, nonnegative balances, immutable journals and unique idempotency keys. Keep D1-only architecture; a generic Hyperdrive recommendation does not apply here.
- Authentication, Access/RBAC, webhook/SSV verification, cryptographic randomness and supported cryptographic comparison APIs. Check actual types/API and a real affected path before reporting a finding.
- Compatibility flags/dates, secrets versus public vars, service binding isolation, observability and serialization requirements of the exact queue/workflow/storage API in use. Age of a compatibility date or absence of nodejs_compat alone is not a confirmed defect; show the actual incompatible behavior.

Return findings with severity, trigger, source location, observed impact and the smallest fix. Distinguish confirmed defects, missing tests and unverified live behavior. Do not auto-fix a review-only request or run a comprehensive security audit by loading this skill. Formal security-audit execution retains that skill's isolation/evidence requirements.

For authorized changes, run relevant regressions and repository checks; verify the affected deployed version before claiming live resolution. Use uomd-wrangler for CLI/config tasks and uomd-monitoring for panel/incident evidence.
