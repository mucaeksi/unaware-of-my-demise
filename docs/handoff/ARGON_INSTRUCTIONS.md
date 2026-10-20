# Instructions for Argon — 2026-10-20

Short, binding rules for working in this repository alongside Claude. They come from incidents in the last two days; each rule says why. The full brief is the [README](../../README.md); the current gap list is [REVIEW_2026-10-20](../REVIEW_2026-10-20.md).

## 1. Where to work (D-28, from 2026-10-20)

- **`E:\unaware-of-my-demise` is the owner's `main` checkout for GitHub Desktop.** Do not edit or commit there. The owner merges branches into `main` there and pushes; the push deploys staging.
- **Work on your own branch, in your own worktree on the local disk:** run `git -C E:\unaware-of-my-demise worktree add C:\Users\PC\uomd-argon -b argon/<task> main`, then open `C:\Users\PC\uomd-argon` and run `npm ci` once. Claude works the same way in `C:\Users\PC\uomd-claude` on `claude/*` branches. Before starting a new task, bring your branch up to date with `git merge main`.
- **Never push, never commit to `main` and never merge into `main`.** When a step is done and verified, tell the owner the branch name and what it contains.
- Work that is still uncommitted in `E:` moves to your branch without loss. In `E:` run `git switch -c argon/<task>`, commit your files, then run `git switch main`. Then add the worktree for that branch: `git worktree add C:\Users\PC\uomd-argon argon/<task>`.
- Google Drive is no longer part of the workflow. Never run `git` write commands in the old `G:\Drive'ım\unaware-of-my-demise` copy: Drive once served git a stale read during a commit (the 25-hero `characters_part1.json` was stored truncated in `7a640663`) and locked files halfway through a checkout.
- **Commit only the files you changed** (`git add <paths>`, never `git add -A`).

## 2. Before every commit

1. `npm run verify` (lint, typecheck, all tests, content check). Do not commit red.
2. If you changed narrative/content JSON, check it parses: `node -e "JSON.parse(require('fs').readFileSync('<file>'))"`. After committing large files, confirm git stored the full content: `git show HEAD:<file> | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>JSON.parse(s))"`.
3. If counts change (heroes, weapons, units), update the tests that assert them in the same commit (search for the old number).

## 3. Deploying

- **Agents do not deploy.** The owner's push to GitHub `main` starts Cloudflare Workers Builds. The game build runs `npm run verify`, then [tools/deploy_staging.sh](../../tools/deploy_staging.sh) applies the D1 migrations and seeds and deploys; admin and ops each deploy only themselves. Settings are in the [RUNBOOK](../RUNBOOK.md#workers-builds). Build results appear as GitHub check runs on the commit.
- The build deploys exactly what is committed, so every generated file must be committed up to date. `npm run build:content` now also regenerates `apps/api/seed/assets.sql`, and `npm run verify` fails when that file is stale. The other seeds (`characters`, `catalog`, `banners`) are regenerated with the commands in section 4.
- **Never** run `wrangler deploy` by hand. On 2026-10-19 a Worker deployed without migration 0029 answered 500. The local Drive/Wrangler deploy scripts were removed; there is no local deploy path.
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

progression tuning once the owner sets a target pace (the pace probe is done: `docs/combat/PROGRESSION_PACE.md`), then the Achievements, Events, Profile/Leaderboard, Arena and Endless screens (AFK patrol already lives in Errands); extra enemy waves in the campaign builder; paged screens keeping their page. If you need one of these sooner, say so instead of building a parallel version.
