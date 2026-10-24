# [SUPERSEDED BY DECISION D-31 (2026-10-24)] Historical Handoff to Argon — 2026-10-21

> **SUPERSEDED BY DECISION D-31 (2026-10-24):** Argon 4 / Antigravity is retired from active ownership. **100% of project operations, Unity 6 LTS (`apps/unity/`) migration, and Google Gemini API asset production are handed over exclusively to Claude Opus 5.5 (`claude-opus-5-5`).** Read [CLAUDE_OPUS_UNITY_HANDOFF.md](CLAUDE_OPUS_UNITY_HANDOFF.md) and [NEXT_STEPS.md](../NEXT_STEPS.md). All items in §1 and §2 (1.1 Linux clean-clone fix `fe67fae3`, 1.2 Prologue no-skip `7207dae1`, ART-1..ART-4, Phase E Hard mode `5a2a0e86`, and D-30 §4.1–§4.7) were completed and handed over on `main`.

## 0. State at handoff

- Repository `F:\unaware-of-my-demise`, GitHub `main` = `e656a808` (pushed by the owner). Working tree clean.
- Local checks at `e656a808`: `npm run verify` passes (1,089 unit/integration tests and the content check); the e2e suite passes on desktop and in the phone viewport except prologue timing (see 1.2).
- **Staging game is stale.** `uomd-game-staging` still runs `gdrive-6a327c19` from 2026-10-20 05:45. Every game Workers Build since then failed; admin and ops deployed normally (latest `e656a808`). None of the world map, mode screens, battle freeze fix or signature weapons is on staging yet.

## 1. First, in this order

### 1.1 Fix the failing game Workers Build (P0)
1. Read the log: Cloudflare dashboard → Workers & Pages → `uomd-game-staging` → Builds → latest build. The build command is `npm run verify && VITE_CONTENT_CHANNEL=staging npm run build -w @uomd/game` on Linux (Node 22, clean clone).
2. It passes on Windows, so look for Linux/clean-clone differences. Already ruled out: letter-case mismatches in imports and content paths, files missing from git under `content/`. Remaining suspects: a test that depends on Windows paths, timing or machine speed; the game build step (`apps/game/scripts/sync-content.mjs`, vite) rather than verify; the 20-minute build limit (the API suite is the slow part).
3. Fix it, push through the owner, and confirm `https://uomd-game-staging.muratcaneksiii.workers.dev/api/v1/health` shows the new commit as `version.tag` and `world_map_v1` among `runtime.capabilities`.

### 1.2 Owner decision pending: prologue SKIP on first viewing (#23)
`aa3a6743` made SKIP always visible; the entry contract and `tests/e2e/zzz-entry-flow.spec.ts` (prologue timing) say no skip on first viewing. Ask the owner; then either hide SKIP on first viewing (contract) or change the contract text and that test. Until then that one e2e test fails by design.

## 2. Then the D-29 release route

| Step | What | Notes |
|---|---|---|
| ART-1 rest | Wave-2 heroes (the remaining 15 by line count), Mahmut/Fadyme frame loops + defeat/victory | Through `tools/ingest_art.ts`; owner approves with `approve --by`. |
| ART-2 | World map painting | `world/world_map.json` is built by `tools/build_world_map.ts` (regions, roads, 1920×1080 coordinates). Keep x < 250, x > 1670, y > 950 free for hub buttons; after ingest set `background_id` in the tool and rebuild. No Part II/III names (spoilers). |
| ART-3 / ART-4 | Store icon, feature graphic, screenshots; ~1:30 teaser (storyboard first) | Specs in RELEASE_ROADMAP §2. Listing copy: `docs/store/PLAY_LISTING_EN.md`. |
| A6 | Physical phones | Browser phone-viewport e2e is done. On devices: sign-in, purchases, rewarded ads, patch download/resume, lifecycle, webm video playback. |
| A7 | Release mechanics | versionCode, Play App Signing, production API base, internal track — owner steps in `docs/AAB_ACCESS_PLAN.md`. Production deploys and public release are owner decisions. |
| Phase C | Publish patch 1 | `npx tsx tools/build_campaign.ts` (full Part I), then `npx tsx tools/make_chapter_patch.ts --chapters 1`, then `npx tsx tools/publish_release.ts --admin "$UOMD_ADMIN_URL" --dir .cache/patches/part1_ch1 --id rel_part1_ch1 --channel staging --depends rel_0001`. Check the map shows Chapter 1 open and 2–7 "coming soon". |
| Phase D | Patches 2–7 | Same command with `--chapters N` (each patch is the cumulative chapters 1..N snapshot). Cadence: owner decision. |
| Phase E | Hard mode content | The code is in (`difficulty: hard` battle nodes, `hard_mode_v1`, NORMAL/HARD switch). **Not built yet:** a builder step that emits the hard nodes — one per normal battle stage, `requires` chained (the first requires the last Chapter 7 node), stronger enemy levels/attributes, own first-clear rewards. Add it to the campaign build with a test (validation over the base must pass). |

## 3. Open engineering items (from the review)

| # | Item | Notes |
|---|---|---|
| 3, 6, 7 | Progression pace, economy numbers, combat semantics C01–C39 | Owner sets the targets; the pace probe is `tools/progression_probe.ts` → `docs/combat/PROGRESSION_PACE.md`. Signature weapon magnitudes are retuned here too (`content/balance/gear_passives.json`). |
| 18 | Music for chapters 2–7 and bosses | Within the media budget (`content/budget/media_budget.json`). |
| 19 | Achievements, seasonal events and arena opponents are hardcoded in `apps/api/src/modes/service.ts` | Move to content data when live-ops starts; real async PvP needs other players' defense snapshots. |

## 4. How the pieces work (where to change what)

- **Main menu = world map** (`apps/game/src/scenes/HomeScene.ts`, `ui/worldMap.ts`). With `world/world_map.json` in the active content the hub is the map; without it (base content) it is the 4×3 grid. Region states come from the chapter index gates and cleared nodes; Hard nodes never decide them.
- **Per-chapter patches**: `tools/lib/chapter-patch.ts` trims the chapter index, story coverage, recruit selectors and library, and drops later chapters' encounters/scenes. Its test validates N = 1..7 over the base.
- **Signature weapons**: a passive runs in battle only if its `passive_effect_id` has an EventHook in `content/balance/gear_passives.json` (all 25 are in). The hook is frozen into the battle party (`equipment_effects.hooks`). Test: `tools/lib/signature-passives.test.ts`.
- **Mode screens**: DEEDS (`DeedsScene`), TRIALS (`TrialsScene`), PROFILE (`ProfileScene`). Every new client mutation must be accepted by the operation journal (`apps/game/src/net/operations.ts`); `net/api.test.ts` fails if one is missing.
- **Capabilities** (`packages/content-schema/src/presentation.ts`): a release requires `world_map_v1` with a map, `hard_mode_v1` with hard nodes, `sprite_animation_v1` with frame animations. When the set changes, update the expected lists in `tests/e2e/catalog-snapshot.spec.ts` and `tests/e2e/r08-complete.spec.ts`.
- **Videos**: WebM (VP9 + Opus), 1280×720, ≤ 300 s, ≤ 20 MiB each (validated).
- **Animation engine** (`apps/game/src/core/anim.ts`): a tween on a destroyed object ends, a throwing tween is dropped alone. Still: stop tweens (`anim.killOf`) before destroying their objects — `aa3a6743` froze the tutorial battle this way.
- **Patch strip** (`PatchBarScene`): takes no input while Battle, Story or Prologue is up, so bottom-edge controls stay safe.

## 5. Checks before every commit (in addition to ARGON_INSTRUCTIONS §2)

1. `npm run verify`.
2. Changed game UI (battle, story, menus)? Run the matching e2e, at least `npx playwright test -c tests/e2e/playwright.config.ts game.spec.ts world-map.spec.ts --project landscape-desktop`, and for layout also `--project phone-landscape` (20:9 phones letterbox; desktop 16:9 does not).
3. One e2e run on the machine at a time (the stack stops every `workerd`). The phone viewport is about twice as slow; long scenarios run on desktop only by design.
4. Commit only your files (`git add <paths>`, never `git add -A`). Never push; the owner pushes `main` with GitHub Desktop, which deploys staging through Workers Builds. Afterwards check the health endpoint's `version.tag`.
