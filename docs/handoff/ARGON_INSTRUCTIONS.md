# Instructions for Argon — 2026-10-20

Short, binding rules for working in this repository. **Start with [ARGON_HANDOFF_2026-10-21](ARGON_HANDOFF_2026-10-21.md)** (Argon owns the whole project from 2026-10-21) **and [ARGON_ART_DIRECTOR](ARGON_ART_DIRECTOR.md)** (D-30: Argon is the Art Director and owns `narrative/` and all art, animation, VFX, banner, video and audio work). They come from incidents in the last two days; each rule says why. The full brief is the [README](../../README.md); the current gap list is [REVIEW_2026-10-20](../REVIEW_2026-10-20.md).

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
4. If you touch battle, story or menu UI code (`apps/game/src`), also run the matching e2e before committing, at least `npx playwright test -c tests/e2e/playwright.config.ts game.spec.ts --project landscape-desktop`. Only one e2e run on the machine at a time: the stack stops every `workerd` process when it starts, so two runs (yours and Claude's) break each other with "Network connection lost" / 500 errors; check that no `playwright`/`wrangler` process is running first. `npm run verify` does not run the browser tests, and `aa3a6743` froze the tutorial battle without any unit test noticing (#20 in the review). Also: a release with art animations requires `sprite_animation_v1`; when your Kera Voss animation lands, add it to the expected list in `tests/e2e/catalog-snapshot.spec.ts`.

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
- Since D-30 (2026-10-23) Argon approves as Art Director after looking at the unit in game: `npx tsx tools/ingest_art.ts approve <asset_id> --by argon:art-director --note "<what was checked>"`. The owner keeps a veto. `ingest_art.ts verify` and `report` show what is still a candidate. The full creative mandate is [ARGON_ART_DIRECTOR](ARGON_ART_DIRECTOR.md).
- Identity from canon only: [ART_BIBLE](../media/ART_BIBLE.md) §3.1/§3.2 conventions and §4 identity anchors; add an anchor section for each new character from `narrative/06_Characters` before generating. Anything not in canon stays UNKNOWN, not invented.
- Budget: `content/budget/media_budget.json` — 1000 TL (20 USD) per month, at most 3 USD per batch and 3 paid attempts per asset. Steps 1–2 fit one month; log every paid call.
- Verify before each commit: `npm run verify`; open the unit in the Animations studio and in battle on desktop and in the phone-landscape viewport; check alpha edges, foot line on the shadow, facing, frame alignment and readability at battle size.
- Commit per unit (or per step) with only your files; never push. Tell the owner which commits are ready.

**Other Argon items.**

| Item | What is needed |
|---|---|
| Control Center default page | Confirm the signed-out Animations studio is wanted on staging/production; if not, gate it to local dev. |
| Music (later) | Chapters 2–7 and the boss fights have no own themes (7 tracks today). After ART-1, within the budget. |

**Release visuals (D-29, [RELEASE_ROADMAP](../RELEASE_ROADMAP.md)): all visual work is Argon's.** Order: ART-1 pilot first, then these in this order.

| Task | What the code expects | Deliverable |
|---|---|---|
| ART-2 World map | The hub draws the map from `world/world_map.json` (built by `tools/build_world_map.ts`): 7 chapter regions on the west→east Bell Road and 4 side-road landmarks, at fixed 1920×1080 coordinates (see the tool). The hub buttons occupy x < 250, x > 1670 and y > 950, so the painting's important parts must sit inside the middle. Set `background_id` to the new background once it is ingested. | One painted Part I map of Veyrhold (16:9, ingest class `background`, exported 1920×1080) that matches canon ([WORLD_ATLAS §2](../../narrative/08_Locations/WORLD_ATLAS_AND_GENIE_BIBLE_TR.md)); no Part II/III names (spoilers). Optional later: a fog/locked overlay style and node icons. |
| ART-3 Store listing | Play Console specs in RELEASE_ROADMAP §2. | App icon 512×512 (32-bit PNG, alpha, ≤ 1 MB, full square, no text claims); feature graphic 1024×500 (no alpha); 4–8 landscape phone screenshots from real builds (Claude can script captures from the e2e stack on request). |
| In-game videos (when a scene needs one) | Presentation `videos` registry; validation enforces it. | WebM (VP9 + Opus), 1280×720, ≤ 300 s, ≤ 20 MiB each, a poster still, captions keyed to the scene's stable line ids; Japanese voice only with a reviewed transcript. |
| ART-4 Teaser video | YouTube URL in the listing; ~1:30, no later-chapter spoilers. Owner direction: mostly in-game capture, few generated shots (the media budget does not cover a generated 1:30). | Storyboard first (for the owner's approval), then the edit. |

Done since the morning: Garrick/Corbin banners (`67b1c969`); the 25 signature weapon designs ([SIGNATURE_WEAPONS_SPEC](../combat/SIGNATURE_WEAPONS_SPEC.md)), approved by the owner and now live in battle data.

## 6. Handoff (2026-10-21)

From 2026-10-21 Argon carries the whole project, engineering included. The ordered work list, the state at handoff (staging game build failing since 2026-10-20) and where each mechanism lives are in [ARGON_HANDOFF_2026-10-21](ARGON_HANDOFF_2026-10-21.md).
