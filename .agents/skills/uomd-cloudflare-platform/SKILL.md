---
name: uomd-cloudflare-platform
description: Use official Cloudflare platform guidance for UOMD Workers, D1, R2, Queues, Cron, Access and observability while preserving the approved architecture and verified access.
---
# UOMD Cloudflare platform

Read README and AGENTS.md. This is a project-authored entry point to the installed Cloudflare plugin's `cloudflare` skill, not a vendored plugin or new connection. Load that skill through the current host's skill tools when available; follow its resource links through the same provider. Otherwise retrieve the relevant current [official documentation](https://developers.cloudflare.com/) and state the missing plugin capability. See [source and verification notes](../../../docs/CODEX_SKILLS.md).

1. Inspect current Worker configs, bindings, code, deployment pipeline and environment before selecting a service. Keep D1/SQLite as the sole SQL database, R2 for approved assets/patches, server-authoritative financial journals and the separate Access/RBAC-protected Control Center. Do not introduce another SQL provider, Hyperdrive or a different AI media vendor from a generic decision tree.
2. Retrieve current documentation for the exact API, quota, pricing or compatibility claim. Record source/date. Distinguish current provider guidance from the project's installed types and pinned versions; researching new APIs does not upgrade packages or compatibility dates automatically.
3. Verify the specific read capability first. Connector authorization and local CLI credentials are separate. Use available plugin/connector tools instead of asking the owner to reveal tokens. A configured binding or a past successful request is not proof of present access.
4. Use internal/service bindings for runtime access where supported. Check parameterized/bounded D1 queries, ledger/idempotency rules, signed data-only R2 patches, Access/MFA/RBAC, background task durability and safe observability with the corresponding project skills.
5. For live claims match request time, actual runtime version/tag and recorded result. Use uomd-monitoring for provenance/freshness and uomd-monetization for ads/Play/RTDN. Workers Builds deploy one Worker per job; only the game job owns D1 migrations.

Honor the current task's scope. A read-only project review stays read-only even though README authorizes ordinary staging engineering. Provisioning, production, prices, permission changes and cloud/media spending follow the owner's applicable authorization. Do not request credentials in chat or print secret values.
