# Content patching

Current R08 contract: [R08_CONTENT_RUNTIME.md](R08_CONTENT_RUNTIME.md). It supersedes historical limitations below: catalog activation requires 0.1.2/capabilities; complete JSON validation, static-root lifecycle, IDB v2 byte accounting/reservations, quota, cancel/deadlines/range resume and owned bounded media caches are implemented. Native/deployed measurements remain explicit R18/R17 gates.

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

## Staged releases (first install)
`PatchManager.checkAndApply({ activate: false, onProgress })` downloads, verifies and validates a release and then **parks it as `state.staged`**
instead of switching it on. The objects stay in storage (GC keeps active, previous and staged). The next start calls `activateStaged()`:
it needs **no network**, re-checks every stored object's hash, re-runs the semantic validation over the exact file set, and activates
atomically (a damaged stage is dropped, never half applied). Used by the first-install flow (`docs/GAME_FLOW.md`): the story and the three
tutorials keep running on the content they started with while the rest of the game downloads; "Restart & Enter Game" is what activates it.
`onProgress` reports `checking -> downloading (files/bytes, streamed) -> verifying -> activating`; `ApiRemote.fetchObject` streams the body so a
single big object still moves the bar.

## Content split (what ships in the app vs. what is a patch)
- **Base release `rel_0001` (embedded in the app)**: the first-install flow only — `entry/entry_index.json`, `entry/prologue.json` (the 120 s
  interlude, copied verbatim from the narrative), tutorials T-1..T-3 (stories, encounters with the `ui` block that hides speed/Auto), the four
  units (Mahmut, Fadyme, Bellbound Dead, Hollow Pilgrim), their art, the tutorial chapter.
- **Patches (everything after the first restart)**: `content/patches/rel_0003_part1_campaign` (35 stages, the full cast, balance, chapter index).
  Built by `tools/build_campaign.ts` over the base; run `npm run build:content` first, then `npm run build:campaign`.
- The former `rel_0002_road_forgotten` demo patch is retired: T-2 is part of the base now, and the campaign patch is the multi-file fixture
  for the patch manager, publisher and e2e tests.

## Demonstrated (automated, local stack — `tests/e2e/zz-campaign.spec.ts`, `tests/e2e/zzz-entry-flow.spec.ts`)
Installed client (base: tutorial T-1..T-3 only) → operator publishes the campaign patch → "Check now" in the content-updates panel →
the chapter list shows the whole campaign and units that do not exist in the app build → owned-hero battles verified by the server against
the patched release → reload keeps the patch (IndexedDB) → rollback to base. First install: sign-in gate → patch downloads in the background
(slowed on purpose) while the prologue and tutorials play → download page or confirmation → one restart activates the staged release.
Unit tests cover bad signature, tampered manifest, hostile paths, hash mismatch, flaky/interrupted downloads, client/channel/schema/dependency
incompatibility, downgrade, storage budget, semantic validation failure, offline, rollout buckets, kill switch, on-disk corruption, progress
events, staged activation (offline), damaged stage, GC of staged objects.

## Compatibility matrix (current)

| Client | Content schema | Notes |
| --- | --- | --- |
| 0.1.0 | 1 | Historical base/legacy interpreter. Cannot receive the corrected snapshot/catalog/presentation reader through data. |
| 0.1.1 | 1 | Complete signed snapshot reader; new publication enforces at least this floor. |
| 0.1.2 | 1 + signed capabilities | Effective catalog, calendar, presentation, locale, sprite animation and story flags. Capability requirements are derived/unioned and compatibility intersected; normal publish/rollback also requires a compatible bound backend. |

New primitives/native integrations/trust-root additions or removal require a new reviewed binary; older binaries may reject the extended manifest before their minimum-version UX. Native old-AAB/update behavior remains R18. See the runtime contract for exact resource and key lifecycle limits.
