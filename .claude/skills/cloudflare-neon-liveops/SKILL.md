---
name: cloudflare-neon-liveops
description: Design or implement Cloudflare Workers, R2, Neon PostgreSQL, secure game APIs, game economy, admin control center, patch releases and observability.
---
# Cloud backend & content operations
- Validate Cloudflare Workers runtime and Drizzle/Neon driver compatibility before writing database code.
- Prefer Hono typed routes; use Hyperdrive for pooled Neon access where supported.
- Segregate preview, staging, prod databases, R2 buckets and secrets; never put credentials or sensitive keys into game bundles.
- Implement server-authoritative gacha, pity, rewards, premium currency and transactions with idempotency and immutable audit log.
- Admin has MFA, least-privilege RBAC, approvals, audit records, content diff/publish/rollback and Google generation budget controls.
- R2 patches contain validated declarative content/media only: signed/authenticated versioned manifest, integrity checks and atomic switching.
- Add unit/integration tests for race conditions, double claims, transaction rollback, invalid config and patch incompatibility.
