---
name: cloudflare-d1-liveops
description: Architect, implement and audit the Cloudflare-only production backend for Unaware of My Demise: Workers, D1 SQLite, R2, Queues, Cron, Access, admin, game economy, events, patch manifests and Google identity/payment integrations. Use whenever backend, SQL, storage, monetization, patch or LiveOps work is requested.
license: MIT
---
# Cloudflare D1 LiveOps — UOMD

**ALWAYS read root README.md before making changes.** Approved sole game database: **Cloudflare D1, SQLite**, accessed through a Worker binding `DB`. Do not provision Neon, PostgreSQL, Hyperdrive, Firebase or another game database. Use Workers/Hono, R2, Queues/Cron and Cloudflare Access as needed. Google identity, Play Billing, AdMob, UMP, Chirp, Lyria and Veo are external service integrations, not database providers.

## Core D1 model
- Define Drizzle/SQLite schema or equivalent typed migrations and `wrangler d1` isolated development, staging and production bindings.
- Use parameterized statements, indices, request quotas, scheduled backups/export, Point-in-Time recovery practice, cost alerting.
- Model accounts by verified Google subject ID linked to a stable internal player ID; profile, story flags, roster, inventory, currency ledger, pity/gacha, subscriptions, purchase token, ad rewards, event/quest progress, entitlement, audit log.
- Keep premium currency **integer-based** with append-only durable ledger; enforce nonnegative balance, idempotent transaction uniqueness, replay protection and transactional or conditional mutation semantics.
- Use D1 batch transaction behavior where appropriate, but ensure correctness under concurrent API requests with real tests. Avoid fragile read-then-write flows. Never trust the client for rewards or premium economy.
- Test simultaneous summon, duplicate reward claim, RTDN reordered notifications, refund, broken connection and D1 free quota exhaustion.

## Cloudflare services
- Workers API (Hono, validation, authentication, rate limiting, logging).
- D1 SQLite relational state, distinct isolated environment instances.
- R2 signed/authenticated content assets and atomically versioned patch manifests.
- Queues for media jobs, purchases/webhooks/retries with dead-letter and idempotency.
- Cron Triggers for season events, resets, daily/weekly rewards and announcements.
- Cloudflare Access + MFA/RBAC admin UI, immutable audit, Cloudflare WAF/Turnstile where useful.
- Analytics Engine/Workers Logs for metrics. Do not leak player data or secret values.

## Google operations
- Google Sign-In / Credential Manager ID token validated in Worker; stable `sub` identity.
- Google Play Billing and Developer API verification; recurring subscriptions, pending, grace/hold, refund, restore, acknowledgment; verified RTDN events from Google Pub/Sub delivered to Worker.
- Google AdMob reward verification, UMP consent, idempotent ad reward grants, frequency/age restrictions.
- AI media generators called from backend only, with budgets and approvals, R2 storage and versioned provenance.

## LiveOps and patch-first
- Extend approved declarative schemas for new bosses, characters, story and events WITHOUT downloading arbitrary JS/native code.
- Use signed/hashed R2 manifests, schema compatibility, atomic activation, rollback/canary/kill switch, storage and quota checks.
- Admin publishes scheduled content with preview and audit. Simulate a full event patch on an unchanged initial AAB/client.

## Definition of done
Report exact files, commands, D1 binding/migration status, test assertions and Cloudflare preview URL. "It is configured" is not proof: establish real Workers, D1 and R2 calls with safe test data. Ask user for missing *secret names and permission scopes* privately added to GitHub/Cloudflare, never values. Follow root README for owner release/cost approvals and security guardrails.
