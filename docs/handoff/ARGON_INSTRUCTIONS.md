# Instructions for Argon — 2026-10-20

Short, binding rules for working in this repository alongside Claude. They come from incidents in the last two days; each rule says why. The full brief is the [README](../../README.md); the current gap list is [REVIEW_2026-10-20](../REVIEW_2026-10-20.md).

## 1. Where to work

- **Work in `E:\unaware-of-my-demise` (local disk).** `G:\Drive'ım\unaware-of-my-demise` is only a mirror of built output. Never commit, merge or run `git` write commands in the Drive copy: Drive served git a stale read during a commit (the 25-hero `characters_part1.json` was stored truncated in `7a640663`) and locked files halfway through a checkout.
- Claude and you share one working copy. **Commit only the files you changed** (`git add <paths>`, never `git add -A` over someone else's edits), and commit finished steps promptly: uncommitted work in shared files blocks the other agent's merges and deploys.
- For larger parallel work, use a git worktree on the local disk (`git worktree add C:\Users\PC\uomd-<task> -b <branch>`).

## 2. Before every commit

1. `npm run verify` (lint, typecheck, all tests, content check). Do not commit red.
2. If you changed narrative/content JSON, check it parses: `node -e "JSON.parse(require('fs').readFileSync('<file>'))"`. After committing large files, confirm git stored the full content: `git show HEAD:<file> | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>JSON.parse(s))"`.
3. If counts change (heroes, weapons, units), update the tests that assert them in the same commit (search for the old number).

## 3. Deploying

- **Only** `npm run deploy:cloudflare` (or `npm run deploy:drive`, which runs it and then mirrors to Drive). It runs verify, applies remote D1 migrations and seeds, then deploys game/admin/ops with a version tag.
- **Never** run `wrangler deploy` by hand or ship Workers without their migrations. On 2026-10-19 a direct deploy put the D-27 server on a D1 without migration 0029 and staging answered 500.
- Deploy from a clean tree. If the shared working copy has uncommitted work, commit it first or deploy from a clean worktree of `HEAD`. On 2026-10-20 a deploy was started from the shared tree with uncommitted scene changes; it would have shipped them under a `-dirty` tag.
- One deploy at a time (the script holds a lock in `%TEMP%\uomd-deploy.lock`). The same deploy waited 40+ minutes on wrangler's y/N migration prompt in a terminal while holding that lock; since `fccda5da` wrangler runs non-interactively. If a deploy looks stuck, check its terminal instead of starting another.
- Never edit a migration that may already be applied remotely. New D1 data for new rows goes into the seeds (`tools/seed_*.ts`, `INSERT OR IGNORE`); a one-time rewrite of existing rows needs a new numbered migration.

## 4. Adding or changing a hero, enemy or weapon

1. Narrative data in `narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content/` (canon: names, skills, rarity, banner, weapon type).
2. **Stats are not in the narrative any more** (D-27, [STAT_MATH](../combat/STAT_MATH.md)). Add the unit to `content/balance/attributes.json` with an archetype (`tank`, `bruiser`, `striker`, `caster`, `healer`, `support`; enemies `e_*`). A unit missing there keeps its old HP/ATK block and the seed refuses heroes without an entry.
3. Make it obtainable: a story recruit, a banner pool entry, or a selector. A `banner_id` must exist in the banner data — Garrick Cinder (`oath_06_garrick`) and Corbin Locke (`oath_07_corbin`) currently point at banners that do not exist, so they cannot be obtained.
4. Rebuild: `npm run build:content`, `npx tsx tools/build_campaign.ts`, `npx tsx tools/seed_characters.ts`, `npx tsx tools/seed_catalog.ts`. Read `docs/combat/CAMPAIGN_BALANCE.md`: with starter gear every stage should still be won.
5. Art through `tools/ingest_art.ts` (portrait, chibi sheet, summon art), then `npm run verify`.
6. The skill grammar is closed. `npx tsx tools/combat_coverage.ts` must stay at full coverage; an op the engine does not know (e.g. the earlier `cleanse`) breaks the roster test. Ask Claude for a new op instead of inventing one in data.

## 5. Open items that belong to Argon

| Item | What is needed |
|---|---|
| Banners for Garrick Cinder and Corbin Locke | Create `oath_06_garrick` / `oath_07_corbin` (or move them into an existing pool) in the narrative banner data. |
| Signature weapon effects (25) | Each signature weapon has prose but no executable effect; they cannot be equipped in battle. Write each effect as a finite rule (trigger, target, magnitude, duration, limit) using the existing op list in [COMBAT_RULES](../COMBAT_RULES.md); Claude turns approved designs into data and tests. |
| Art pilot | Kera Voss end to end through `tools/ingest_art.ts`, checked in game, then the remaining heroes. Delivery rules: the Argon brief (https://claude.ai/artifact/Qobho5vJKwE9gYA5ra2Wqx). |
| Control Center default page | Confirm the signed-out Animations studio is wanted on staging/production; if not, gate it to local dev. |

## 6. Claude's current queue (do not duplicate)

AFK patrol screen, then progression simulator and XP/AFK tuning, then the Achievements, Profile/Leaderboard, Arena and Endless screens; extra enemy waves in the campaign builder; paged screens keeping their page. If you need one of these sooner, say so instead of building a parallel version.
