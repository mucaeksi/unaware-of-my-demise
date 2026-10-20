# Instructions for Argon — 2026-10-20

Short, binding rules for working in this repository alongside Claude. They come from incidents in the last two days; each rule says why. The full brief is the [README](../../README.md); the current gap list is [REVIEW_2026-10-20](../REVIEW_2026-10-20.md).

## 1. Where to work (D-28, from 2026-10-20)

- **The repository is `F:\unaware-of-my-demise` (owner, 2026-10-20).** Open and edit only that folder. `E:\unaware-of-my-demise` and the `C:\Users\PC\uomd-*` worktrees are retired; do not edit or commit there.
- **Never push.** Commit your own verified steps locally on `main` in F:. The owner pushes with GitHub Desktop when the work is done, and that push deploys staging.
- Claude works in the same folder. Commit finished steps promptly, so neither agent's uncommitted work sits in files the other one is changing.
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
3. Make it obtainable: a story recruit, a banner pool entry, or a selector. A `banner_id` must exist in the banner data. **Counts are asserted in tests:** when the number of banners, heroes, weapons or units changes, search the tests for the old number and update them in the same commit (`apps/api/test/catalog-snapshot.test.ts` missed the 12 → 16 banners in `67b1c969` and stopped three staging deploys).
4. Rebuild: `npm run build:content`, `npx tsx tools/build_campaign.ts`, `npx tsx tools/seed_characters.ts`, `npx tsx tools/seed_catalog.ts`. Read `docs/combat/CAMPAIGN_BALANCE.md`: with starter gear every stage should still be won.
5. Art through `tools/ingest_art.ts` (portrait, chibi sheet, summon art), then `npm run verify`.
6. The skill grammar is closed. `npx tsx tools/combat_coverage.ts` must stay at full coverage; an ## 5. Current task for Argon: ART-1 — hero, boss and animation art, wave 1

**Why.** The re-review ([REVIEW_2026-10-20 §7](../REVIEW_2026-10-20.md), #15–#17) found that 23 of 25 heroes borrow another unit's sheet (8 use Mahmut's, 15 the "arcanist" placeholder), only Mahmut and Fadyme have VN portraits, all 7 bosses share the generic knight sheet, and no sheet uses frame animation. Backgrounds are in good shape (44 distinct).

**What the engine accepts** (`packages/content-schema/src/art.ts`, `UnitArt`): per unit an atlas (≤ 4096 × 4096), `facing`, `height_px` and up to 8 states — `idle, walk, basic, active, ultimate, hit, defeat, victory`. Each state has a still `frame` and an optional `animation: { frames (1–60), fps (1–30), loop }`. `idle` is required. With reduced motion the still frame is shown, so the still frame of each state must read well on its own. Portraits: `portraits.<character>.emotions → images`.

**Order** (story line counts and battle appearances measured from the Part I patch):

| Step | Units | Deliverable per unit |
|---|---|---|
| 1. Pilot | `kera_voss` (48 lines, 3rd speaker) | Chibi sheet with all 8 states (idle as a 4–6 frame loop, basic/active/ultimate as 4–8 frame one-shots, hit/defeat/victory), facing right; VN portrait with at least 4 emotions used by her lines; summon/recruit art if the Recruit screen needs it. Checked in the Control Center **Animations** studio and in a real battle and story scene before step 2. |
| 2. Heroes, wave 1 | `nixie_vale` (34), `sister_aveline` (31), `mirel_quill` (31), `jori_flint` (27), `clem_marr` (25) | Same kit as the pilot. |
| 3. Bosses | `boss_ash_maw`, `boss_bell_widow`, `boss_captain_rusk`, `boss_red_vial_matron`, `boss_marshal_oren`, `boss_ashen_lord_wraith`, `boss_eclipse_construct` | Own sheet each, facing left, with idle loop, basic, active, ultimate, hit, defeat. Bosses are larger (`height_px`), and their fresh-bar phases may want a phase-2 idle. |
| 4. Frequent enemies | `inkbound_dead` (10 battles), `ash_wolf` (8), `corrupted_mercenary` (8), `red_vial_alchemist`, `corrupted_crown_guard`, `estate_wraith`, `eclipse_sentinel` (6 each) | Own sheet each: idle loop, basic, hit, defeat. |
| 5. Upgrade the two leads | `mahmut`, `fadyme` | Add frame loops to the existing sheets plus the missing `defeat` and `victory` poses (identity unchanged). |
| 6. Heroes, wave 2 | the remaining 15 heroes, by line count (`tilda_fen`, `iona_mist`, `brin_alder`, `marek_vane`, `sable_wren`, …) | Same kit as the pilot. |

**Rules.**
- Through `tools/ingest_art.ts` only (`init --class unit_sheet|portrait`, then ingest), so every image gets an `content/approved_art/entries/*.json` record with source, model, cost, licence, hashes and the human QC status. Then point the unit at its own atlas in the campaign `art/art_manifest.json` (replacing the borrowed `atlas_mahmut` / `atlas_hero_arcanist` / `atlas_enemy_knight` entry) and run `npm run build:content` (it also regenerates `apps/api/seed/assets.sql`).
- Argon delivers candidates; `npx tsx tools/ingest_art.ts approve <asset_id> --by <owner>` is the owner's step after looking at the unit in game. `ingest_art.ts verify` and `report` show what is still a candidate.
- Identity from canon only: [ART_BIBLE](../media/ART_BIBLE.md) §3.1/§3.2 conventions and §4 identity anchors; add an anchor section for each new character from `narrative/06_Characters` before generating. Anything not in canon stays UNKNOWN, not invented.
- Budget: `content/budget/media_budget.json` — 1000 TL (20 USD) per month, at most 3 USD per batch and 3 paid attempts per asset. Steps 1–2 fit one month; log every paid call.
- Verify before each commit: `npm run verify`; open the unit in the Animations studio and in battle on desktop and in the phone-landscape viewport; check alpha edges, foot line on the shadow, facing, frame alignment and readability at battle size.
- Commit per unit (or per step) with only your files; never push. Tell the owner which commits are ready.

**Other Argon items.**

| Item | What is needed |
|---|---|
| Control Center default page | Confirm the signed-out Animations studio is wanted on staging/production; if not, gate it to local dev. |
| Music (later) | Chapters 2–7 and the boss fights have no own themes (7 tracks today). After ART-1, within the budget. |

Done since the morning: Garrick/Corbin banners (`67b1c969`); the 25 signature weapon designs ([SIGNATURE_WEAPONS_SPEC](../combat/SIGNATURE_WEAPONS_SPEC.md)), approved by the owner and now live in battle data.

## 6. Claude's current queue (do not duplicate)

Extra enemy waves in `tools/build_campaign.ts` once your current edit of that file is committed (tell the owner when it is); progression/economy tuning once the owner sets a target pace. Done today: DEEDS / TRIALS / PROFILE screens, the journal fix for daily supplies, sweep, AFK and memory shards, Roster keeping its page, and your 25 signature weapon effects in battle (owner-approved; `content/balance/gear_passives.json`). If you need something from this queue sooner, say so instead of building a parallel version.
