# Content patching

**Rule:** a patch may contain only declarative data and media (`json, webp, png, ogg, mp3, m4a, webm, txt`). Scripts, WASM,
HTML, SVG and native code are rejected by the schema (`SafeAssetPath`) and by media-type allowlists in the admin API.
New *mechanics* (new effect ops, statuses, selectors, UI components, native SDKs) still require a new binary.

## Manifest (`packages/content-schema/src/manifest.ts`)
release id + monotonically increasing `generation` per channel, `compat` (min/max client semver, content schema), optional
`depends_on` (base release), `rollback_to`, `rollout {percent, kill_switch}`, files `{path, sha256, bytes, media_type, kind}`,
detached **ES256** signature over canonical JSON (P-256 chosen because WebCrypto supports it on every Android WebView).

## Device flow (`packages/patch/src/manager.ts`)
fetch manifest → schema → signature (trusted keys compiled into the app) → channel/client/schema/dependency checks →
generation must increase → deny-list → rollout bucket (hash of install id) → storage budget → download only missing,
non-base objects (size + SHA-256 verified, retries with backoff, completed objects survive interruptions = resume) →
semantic validation of the **effective** content set (patch over base: every schema + cross reference) → one atomic state write
→ GC → previous release kept for rollback. A stored object that fails its hash later triggers automatic rollback + deny.
Kill switch returns the device to the embedded base. Offline start never blocks (4 s timeout).

## Publisher flow (`apps/api/src/content/store.ts`)
`PUT /admin/api/objects/:sha256` (hash-verified) → `POST /releases` (all objects present, effective-set validation, generation
assigned) → `POST /releases/:id/publish` (re-validate, sign with the Worker secret, atomic conditional pointer update, audit).
Rollback and kill switch create a **new higher generation** pointing at older files, so no device ever moves backwards.
Production publish/rollback require the `owner` role.

## Demonstrated (automated, local stack — `tests/e2e/game.spec.ts`)
Installed client (base rel_0001: only tutorial T-1, no Hollow Pilgrim unit) → operator publishes `rel_0002` → "Check now" →
chapter list shows **T-2** and a unit that does not exist in the app build → battle verified by the server against `rel_0002` →
reload keeps the patch (IndexedDB) → rollback to base. Unit tests cover bad signature, tampered manifest, hostile paths,
hash mismatch, flaky/interrupted downloads, client/channel/schema/dependency incompatibility, downgrade, storage budget,
semantic validation failure, offline, rollout buckets, kill switch, on-disk corruption.

## Compatibility matrix (current)
| Client | Content schema | Notes |
|---|---|---|
| 0.1.x | 1 | first runtime; effect grammar v2 (all 34 narrative ops, 15 statuses, boss phases/objectives/telegraphs, owned-hero parties). No store build has shipped with grammar v1, so no compatibility break exists yet. |
Future rows are added whenever the grammar/schema gains capabilities (older clients ignore releases with a higher `content_schema`).
