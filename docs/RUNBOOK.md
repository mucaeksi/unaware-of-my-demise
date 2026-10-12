# UOMD staging operations runbook

Source revision `5c83e3d1`, 2026-10-11. Documentation only: no remote rollback, backup restore, key rotation, player reset or financial adjustment was executed. Sources: `docs/BUILD_STATE.md` (latest Deploy path supersedes historical Actions notes), `docs/AAB_ACCESS_PLAN.md`, `apps/api/src/ops/*`, `apps/api/src/{ops,adminApp,admin/ops,billing/service,billing/rtdn}.ts`, `apps/api/wrangler.*.jsonc`, `tools/gen_signing_key.ts`, `docs/PATCHING.md`. Commands below are operator procedures using installed/pinned Wrangler and existing authorized credentials; never print/export tokens or key values.

## Resources, ownership and deployment

| Resource | Staging name / fact |
|---|---|
| Game | `uomd-game-staging`; `https://uomd-game-staging.muratcaneksiii.workers.dev` |
| Control Center | `uomd-admin-staging`; `https://uomd-admin-staging.muratcaneksiii.workers.dev`; Cloudflare Access + app RBAC |
| Cron | `uomd-ops-staging`; no HTTP routes/worker.dev, `fetch` returns 404 |
| D1 | `uomd-staging`, id `687f9735-ee4c-4611-aa16-2fae99e51911`, all Workers share DB binding |
| Content R2 | `uomd-content-staging`, bound as CONTENT |
| Backup R2 | `uomd-db-backups`, bound as BACKUPS |
| Cron times | backup `17 3 * * *` = daily 03:17 UTC / 06:17 Istanbul; health `*/15 * * * *` |
| Budget | Google generation 1000 TL/month, tracked $20/month, $3/batch, max 3 paid attempts/asset; runbook does not authorize calls |
| Deploy authority | Cloudflare Workers Builds from GitHub main; GitHub Actions is not the current deployment/test platform |

One Workers Build must deploy **its own Worker only**: the latest source fix explicitly prevents the ops deploy overwriting the game Worker. Inspect Cloudflare build settings rather than assuming a script in GitHub controls them. `docs/BUILD_STATE.md` has historical green tests/old migration counts and older missing-service statements; use current code, deployment logs and health for actual state. Docs-only changes skip the game build; admin may rebuild because its Development page consumes docs. Do not migrate a database merely to roll back a Worker. There is no configured production environment to operate here.

## Diagnose logs and health

1. Cloudflare Dashboard → Workers & Pages → specific staging Worker → Observability/logs and Builds → most recent deployment. Match Worker name, commit SHA, version/deployment ID and bindings. Correlate UTC incident times and sanitized request IDs across game/admin/ops. A 404 on ops is expected, not a health endpoint.
2. At repository root, authenticated read-only live tails (select the Worker required, not all production traffic):

```sh
npx wrangler tail --config apps/api/wrangler.game.jsonc --env staging --format pretty
npx wrangler tail --config apps/api/wrangler.admin.jsonc --env staging --format pretty
npx wrangler tail --config apps/api/wrangler.ops.jsonc --env staging --format pretty
```

Run each in its own terminal and stop after collecting the relevant event. Do not capture raw Authorization/ID/purchase tokens or SSV query values. SSV `ssv_rejected` logs reason/keyId/adUnit/parameter names/query length, not the callback signature. Private developer logs and account exports must stay out of Git.

3. GET game `/api/v1/health` expects HTTP 200/ok=true. Anonymous GET admin `/admin/api/system` expects Access redirect/401/403, never admin JSON. Logged-in viewer GET `/admin/api/ops` shows latest 40 `ops_runs`, counts and last good backup. On D1 Console use this read-only query:

```sql
SELECT id, at, kind, ok, detail_json FROM ops_runs ORDER BY id DESC LIMIT 40;
```

Health check names: `game`, `admin_protected`, `backup_fresh`. A backup older than 36 h (or none at all) is unhealthy, **and the next 15-minute health tick then takes a catch-up backup itself** (when the newest good backup is older than 30 h or absent, and no backup attempt happened in the last 90 minutes), so a missed nightly cron heals within a quarter of an hour; the first backup of the environment was produced exactly this way at 14:00 UTC on 2026-10-11. Ops rows older than 30 days are deleted by the recorder. `ok=true` health is not proof of purchase/VO/physical-device correctness. A failed backup row records an error; subsequent Cron retries follow schedule, not a documented retry queue.

## Worker code rollback and content rollback are separate

**Code:** diagnose regression → identify last known-good deployment for the same Worker and compatible D1 schema → in Dashboard Deployments select that version and Rollback. Alternatively inspect pinned Wrangler `deployments list --help` / `rollback --help` and use:

```sh
npx wrangler deployments list --config apps/api/wrangler.game.jsonc --env staging
npx wrangler rollback <known-good-version-id> --config apps/api/wrangler.game.jsonc --env staging --message 'Incident ID: restore known-good staging game'
```

Use actual version ID, not commit SHA; use admin config for admin incident, ops config for Cron incident. Pause/resolve the faulty Workers Build path before another main push redeploys the regression. Confirm Access, bindings/secret names, health, logs, native staging CORS and a real read-only account request. Preserve incident IDs/commit/version IDs and failure evidence. Worker rollback does not undo migrations, content pointer, player transactions or newer data shape. UNKNOWN R01: deployed version inventory and rollback compatibility must be read during incident; no version ID is invented here.

**Content:** authenticated operator in Control Center chooses a known published staging release; POST `/admin/api/channels/staging/rollback` with JSON `{"releaseId":"<known-good-release-id>"}`. Emergency kill uses `/admin/api/channels/staging/kill` with the same body. The server signs a **new higher generation** (`rb_staging_g…` / `kill_staging_g…`), updates `channel_pointers` and appends `audit_log`. It does not lower the existing generation or edit a published manifest. Confirm returned release ID/generation, device update + hash validation, embedded fallback under kill, reload and server replay. Do not manually change channel_pointers or delete bad manifests. UNKNOWN R02: current published IDs/generation are environment facts; inspect GET `/admin/api/releases` first.

## Encrypted D1 backup and offline restore rehearsal

`runBackup` obtains all table rows/counts in a single D1 batch, builds schema → rows → indexes/triggers (so append-only triggers do not block inserts), rejects >200000 rows, checks wallet/ledger reconciliation, then age-encrypts to **AGE_RECIPIENT public key**. No private age key exists in Worker configuration. R2 path:

`d1/staging/d1-staging-<YYYYMMDDTHHMMSSZ>.sql.age` and adjacent `.manifest.json` with sha256Plain, table counts, atomic/reconciled flags. Backups contain sensitive identities/transactions even when encrypted; access stays private.

**Restore evidence (2026-10-11, resolves finding R03).** A temporary `BACKUP_PROBE` setting had written one plaintext copy (`probe/staging-20261011T140009Z.sql`) next to the encrypted backup of the same run. It was used once for a **restore drill inside Cloudflare** and then removed: a throw-away Worker (R2 read binding + a new empty scratch D1) split the dump into statements, applied tables + rows in one batch with deferred foreign keys, then indexes and triggers, and compared the result with the backup manifest. Result: SHA-256 of the dump recorded, **49 tables / 18 indexes / 16 triggers restored; every table's row count equals the manifest** (e.g. `characters` 20, `character_skills` 80, `gear_defs` 258, `banners` 12, `d1_migrations` 16). D1 refuses `PRAGMA integrity_check` (SQLITE_AUTH), and a Worker has a 50-subrequest limit, so the counts must be read with one `batch`. The drill Worker, the scratch D1 and the plaintext object were deleted; the probe feature itself was removed from the code and config, so **no plaintext dump is ever written** and every backup object is age-encrypted. The restore rehearsal with the owner's private age key (below) is still the only proof that the *encrypted* file decrypts.

Offline rehearsal (owner has supplied private age identity through an approved secure file, **never chat/Git**):

1. Choose last **good** encrypted backup/manifest by ops row, not filename alone; current environment access and restore authorization required. At root `umask 077`, make `work/restore-<incident>` on encrypted/private storage and ensure it is untracked. Download actual keys with Wrangler:

```sh
umask 077
mkdir -p work/restore-incident
npx wrangler r2 object get 'uomd-db-backups/d1/staging/<actual-backup-name>.sql.age' --remote --file work/restore-incident/dump.sql.age
npx wrangler r2 object get 'uomd-db-backups/d1/staging/<actual-backup-name>.sql.age.manifest.json' --remote --file work/restore-incident/manifest.json
age --decrypt --identity /secure/owner-backup-identity.txt --output work/restore-incident/dump.sql work/restore-incident/dump.sql.age
```

`/secure/owner-backup-identity.txt` is an example private file selector, not a key value. If no owner-held identity is available, restoration is BLOCKED; do not invent a replacement key. Inspect CLI help if pinned flags differ.

2. In a local-only script compute SHA-256 of dump bytes and compare to manifest.sha256Plain, check atomic=true/reconciled=true where ledger exists. Compare file/manifest date to desired recovery point. Do not print SQL rows. SQL is an internally generated artifact; accept only the verified trusted backup.
3. Import into a **new empty disposable** local database (not the live DB, and not an existing DB with same table names):

```sh
sqlite3 -bail work/restore-incident/restore.db < work/restore-incident/dump.sql
sqlite3 work/restore-incident/restore.db 'PRAGMA integrity_check; PRAGMA foreign_key_check;'
```

Expected integrity `ok`; no foreign-key violations. Manifest table counts must match every restored table; compare locally without exporting rows. Reconcile each restored wallet against SUM(ledger.delta), check immutable triggers exist and reject ledger/audit deletes, inspect migration/version table presence. Record counts/hash/pass only, no account data. Source dump disables foreign_keys during import; explicitly verify relationships afterward. UNKNOWN R04: R2 backup retention/lifecycle and measured restore time/RPO are not defined by this source.
4. Keep artifacts only in protected storage for approved incident retention; securely dispose according to owner data-handling policy. This runbook has not run age/sqlite restore and provides no invented restore success.

**Remote recovery:** freeze writes on affected staging clients/features before restore; collect a fresh encrypted snapshot and deployment/binding IDs; choose a **new isolated D1** restoration target. Creating/binding a new DB or overwriting live data requires the owner/lead’s concrete recovery authorization. Restore reviewed SQL with `wrangler d1 execute <recovery-database> --remote --file … --config <reviewed-recovery-config>` only after local rehearsal and schema review; original tables make importing into existing DB fail, so do not drop them to “make it work.” Validate foreign keys/counts/ledger, revoke stale restored sessions as part of approved plan, replay/reconcile post-backup payments and RTDN/ad events without duplicate rewards. Switch each game/admin/ops binding deliberately together via reviewed code/deploy, verify health and keep old DB for rollback. Time Travel may be another D1 recovery route; inspect actual available bookmarks/retention in Dashboard before choosing, no assumed guaranteed retention.

## Content-signing key rotation

1. Inventory trusted `kid`s in `content/keys/trusted_public_keys.json`, client/AAB versions and current manifest signatures. Store CONTENT_SIGNING_KEY only in admin Worker secrets; CONTENT_SIGNING_KID is public config. Require a lead-owned reviewed key-rotation change; Sol does not touch content or secrets.
2. The tool `npx tsx tools/gen_signing_key.ts --kid <new-unique-kid> --out /secure/uomd-signing` creates mode-0600 private JWK **outside repo** and appends only its public P-256 JWK to the content trusted key list. Output path is not a key. Do not cat/echo/log the private file. Commit public key only; check there is no private `d` member in Git.
3. Ship a client/AAB trusting **both old and new keys** before using the new signer. Current trust list is compiled into the client: no authenticated remote trust-update mechanism is shown. A new kid cannot reach an unchanged original AAB that knows only the old key. **UNKNOWN R05:** planned long-lived rotation/root trust design; absent this, key rotation may require a new AAB, and the README permits it for security.
4. After trusted-client rollout, in a private terminal use pinned Wrangler `secret put CONTENT_SIGNING_KEY --config apps/api/wrangler.admin.jsonc --env staging < /secure/uomd-signing/<new-kid>.private.jwk.json`; set matching CONTENT_SIGNING_KID by reviewed admin config/deploy, preserving other secret bindings and Access. Use secure redirected input, no inline value/command history.
5. Publish isolated signed staging test release, verify accepted new signature on upgraded devices and rejection on untrusted devices, semantic validation/rollback and signing audit. Retain old signer securely for agreed rollback window; retire old public trust only in a later client update. A compromised old key requires explicit emergency release/deny strategy, not pretending removing a server secret revokes device trust.

## Refund / RTDN / acknowledgement incident

1. Identify product/order and affected internal player privately from `/admin/api/purchases` and player detail; inspect Play Console/API authoritative purchase state. Do not read/publish raw purchase token, service-account JSON or billing tags. Confirm staging package, active shop mapping and Google Play service-account permissions.
2. Check secret-name availability of GOOGLE_PLAY_SERVICE_ACCOUNT on game Worker, public PLAY_PACKAGE_NAME, RTDN_AUDIENCE (endpoint URL) and RTDN_PUSH_SERVICE_ACCOUNT. Pub/Sub push uses Google-signed OIDC and exact audience/identity; `rtdn_not_configured`/401 is configuration/auth, not a reason to disable checks. Use Pub/Sub delivery logs, game logs and purchase_events; test notification should produce `test`, duplicate message → `duplicate`.
3. Read rtdn_seen and purchase_events for delivery IDs/order. Transient handling failure removes message ID so retry can process; duplicate already processed IDs must not be deleted manually just to force more grants. Granting subscription types 1/2/4/7 requery Play; revoked=12 and voided order invoke refund. One-time RTDN only records event; client restore/verify completes a pending consumable. Unmatched subscription waits for initial client verification.
4. Check purchases.state, period_end, acknowledged, unrecovered and immutable ledger reasons/idempotency. `refundPurchase` marks order then debits available configured currency up to balance and records remainder; it does **not** claw back noncurrency goods or already-claimed periodic mail. It reads current shop grant config, not an immutable purchased reward snapshot. It has multiple batches, so incident reconciliation must examine partial failure, configuration drift and retry behavior. Do not describe refund as one fully atomic grant reversal.
5. `consume_failed`/`ack_failed` events require review before Play’s acknowledgement deadline. Duplicate consumable verify can retry consume; duplicate subscription-period path returns early and does not demonstrate a retry of failed acknowledgement. No dedicated reconciliation/ack job or operator refund-replay endpoint is shown. Claude must implement a reviewed idempotent recovery path; never manufacture client receipts, delete purchase rows or change ledger triggers.
6. Freeze shop with authenticated operator flag update only if authorized incident response; GET `/admin/api/flags`, then PUT `/admin/api/flags/shop.enabled` with enabled=false, note and exact expectedVersion. Missing flags count ON; verify change/audit. For ads use `ads.rewarded.enabled`, gacha `gacha.enabled`; these do not pause all existing state writes or replace a maintenance mode. Preserve Google notification ingestion so incident evidence is not lost. Financial compensation/real-price changes require owner authorization.

## Player reset, ban and compensation

There is **no admin reset-player endpoint** in source. Do not invent one or delete rows/ledger via SQL. Owner-authorized player status endpoint POST `/admin/api/players/:id/status` accepts active/banned + reason, revokes sessions on ban and writes audit; unban is not a progression reset. An audited owner currency adjustment POST `/admin/api/players/:id/adjust` requires eclipse_token, bounded nonzero delta, reason and 8..64-character requestId; preserves nonnegative balance/idempotency. It is compensation, not reset, and is never routine test setup on real players.

For a designated disposable QA player who chooses deletion: export through GET `/api/v1/account/export` to private storage, then user-authenticated DELETE `/api/v1/account` body `{"confirm":"DELETE"}`. `deleteAccount` tombstones identity, drops all sessions/mutable progress and retains immutable ledger/pull/purchases/mail plus other audit records. New Google login creates a new player; old subscriptions/order bindings are not migrated, and Play billing cancellation is separate. Only perform this with explicit test-user/owner reset authorization, not as a repair tactic. For progression reset without deletion, **UNKNOWN R06:** lead must specify/implement an audited server operation and retained financial/identity semantics.

## Incident closure record

Record scope/environment, incident times, failing/known-good commits + Worker versions, affected order/transaction IDs in private evidence, actual mitigation, before/after health, ledger reconciliation, device validation, owner approval for sensitive action, remaining gaps and next owner. Never call a backup good from an R2 object’s existence alone, or a purchase fixed from an HTTP 200 alone. Routine logs/read-only diagnosis can continue; this documentation task authorizes no incident mutations.

## RTDN processing recovery (R02-D)

Authenticated deliveries acquire a 60-second ownership lease. In-flight concurrent deliveries return HTTP 503; completed identical deliveries return duplicate. Crashed/expired and legacy unknown markers are reconciled on the next authentic redelivery. Ten failed attempts retain dead_letter with a fixed safe failure code; original payloads and purchase tokens are not stored here. Delivery-specific journal events are unique by message ID/type.

Viewer investigation: GET `/admin/api/billing/notifications?state=dead_letter` (50 records, opaque nextCursor for `before`). After correcting the cause, an operator may POST `/admin/api/billing/notifications/<messageId>/retry` with `expectedAttempts` from the record and a reason. CAS reset/audit share a batch; stale, done or unexpired processing records reject. This reset permits retry; it does not execute a job or prove Pub/Sub replay. Request a subsequent original authenticated push through the existing authorized Pub/Sub replay/redelivery path. Validate actual retry retention, dead-letter topic and seek permissions in the target project before claiming remote recovery; do not create roles or paste original tokens into investigation logs. Scheduled encrypted-token reconciliation remains separate open R02 work.
