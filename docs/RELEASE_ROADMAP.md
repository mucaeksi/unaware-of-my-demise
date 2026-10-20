# Release roadmap — first AAB, store listing, chapter patches, Hard mode (D-29)

Owner direction 2026-10-20: perfect the first AAB (D-22 scope), give the Play listing a ~1:30 teaser video plus logo/banners/screenshots, then ship everything else as patches. Patch 1 is Part I Chapter 1 **with the whole game around it**: the world map as the main menu, with events, modes, options and banners placed around the map. Patches 2–7 add one chapter each. After Chapter 7, the Hard mode of all chapters. This file is the plan; [REVIEW_2026-10-20](REVIEW_2026-10-20.md) is the gap list it draws from.

## 0. The rule that shapes everything: code ships in the AAB, data ships in patches

Patches are signed, closed **data** snapshots ([CONTENT_RELEASE_CONTRACT](CONTENT_RELEASE_CONTRACT.md), [PATCHING](PATCHING.md)). They cannot add code, and Play policy forbids downloading executable code anyway. So:

- **Every screen, mode and toggle that any later patch will use must already be in the first AAB as code**, switched off (or showing "coming soon") until a patch brings its data. The owner's "patch 1 contains the main menu and world map" means: the AAB carries the world-map code; patch 1 brings the map data, the Chapter 1 content and turns the hub on.
- **Every data field a later patch will use must already be in the AAB's schema.** The schemas are strict: an old AAB rejects a patch with an unknown field. New features are therefore declared as **capabilities** (the client advertises which it supports; a release that needs an unknown capability is refused cleanly instead of breaking). Planned for the first AAB: `world_map_v1`, `hard_mode_v1` (plus the existing `attributes_v1`, `presentation_v1`, `vfx_v1`).
- **Server code ships separately** through Workers Builds (D-28), not through patches. Hard mode rewards, events and modes are server code + patch data.
- **Size limits per release:** 512 files and 200 MiB per signed snapshot. Each chapter patch is cumulative (a device only downloads files it lacks). In-game videos must stay short and small (webm, ~720p), a handful per Part. The store teaser lives on YouTube, not in a patch.

## 1. Phase A — the first AAB, "perfect"

Scope stays D-22: logos (PixiJS + ŞovTaym), Tap-to-Start title, Google sign-in + background patch download, 9-shot prologue, tutorial T-1..T-3, patch wait, restart into the hub. "Perfect" means that flow is flawless on real phones and that the AAB carries **all future code**.

| # | Work | Owner | State |
|---|---|---|---|
| A1 | **World map hub** (`WorldMapScene`): the Part I Bell Road from canon ([WORLD_ATLAS §2](../narrative/08_Locations/WORLD_ATLAS_AND_GENIE_BIBLE_TR.md): Chapter 1–7 west→east, one bell each, side roads, later Part II north / Part III south). Chapter nodes open their stages; unreleased chapters show "coming soon"; the hub buttons (Summon, Roster, Team, Errands, Deeds, Trials, Mail, Shop, Profile, Options, Notices, events, banner spotlight) sit around the map. Map layout is **data** (`world/world_map.json`, built by `tools/build_world_map.ts`), so patches move/reveal regions without code; without a map (base content) Home stays the grid. | C (code + schema), A (map painting ART-2) | **Done** (`4e8bccf3`, e2e `world-map.spec`); map painting pending |
| A2 | **Hard mode code** in the AAB: `difficulty` on stage nodes + `hard_mode_v1`; a Hard stage is its own node (own progress/stars/rewards, unchanged server checks); the unlock rule is the requires-chain (first Hard node requires the end of Chapter 7); NORMAL/HARD switch in Chapters only when Hard stages exist. | C | **Done** (`c3b5ada4`); exercised when the Hard patch exists |
| A3 | **Per-chapter patch build**: `tools/make_chapter_patch.ts --chapters N` derives the "Part I chapters 1..N" snapshot from the full campaign build (`tools/lib/chapter-patch.ts`): chapter index, story coverage and recruit selectors trimmed, library entries behind later chapters dropped, encounters/scenes of later chapters left out; units, art and the world map stay whole (the map shows the rest as "coming soon"). Patch 1 = 75 files, 1.4 MB. Publish: `npx tsx tools/publish_release.ts --admin "$UOMD_ADMIN_URL" --dir .cache/patches/part1_chN --id rel_part1_chN --channel <channel> --depends rel_0001`. | C | **Done**: every N validates over the base (unit tests), e2e `world-map.spec` publishes patch 1 and sees chapters 2–7 as coming soon |
| A4 | In-game video: playback exists (`NarrativeStage` `video` command, skippable, captions). Format: WebM (VP9 + Opus), 1280×720, ≤ 300 s, ≤ 20 MiB per video (validated), captions on stable line ids, Japanese audio only with a reviewed transcript. Device playback check is part of A6. | C (check), A (videos) | **Done** in code; device check in A6 |
| A5 | Known P0/P1 fixes before freezing the AAB: everything in REVIEW §7 that is code (journal fix done, signature passives done, builder waves). | C | Mostly done |
| A6 | Native QA on physical phones ([QA_ANDROID](QA_ANDROID.md)): sign-in, purchase restore, rewarded ads, patch download/resume, lifecycle, phone-landscape layout. First phone-viewport e2e run (2026-10-20): 31/42 passed; it found the canvas/HTML split on 20:9 screens (`9faa09fb`) and the tutorial battle freeze after a quick skill pick (`5a137363`, regression from `aa3a6743`). Physical phones not run. | C (automation), O (devices) | In progress |
| A7 | Release mechanics: versionCode, Play App Signing, production API base, test → internal track ([AAB_ACCESS_PLAN](AAB_ACCESS_PLAN.md)). | O + C | Prepared, not run |

**Order:** A3 and A1 first (they define what patch 1 is), then A2, then A6/A7. A1's map art can be produced by Argon in parallel with the code (placeholder map until then).

## 2. Phase B — store listing

| # | Asset | Spec (Play Console help, checked 2026-10-20) | Owner |
|---|---|---|---|
| B1 | App icon | 512 × 512, 32-bit PNG with alpha, ≤ 1 MB; full square (Play applies the mask); no rank/price text | A (art), O (approve) |
| B2 | Feature graphic (store banner) | 1024 × 500, JPEG or 24-bit PNG, no alpha; the play button of the video sits over it | A |
| B3 | Screenshots | ≥ 2 (more recommended for games), JPEG/24-bit PNG, 320–3840 px, longest side ≤ 2× shortest; landscape phone captures from real builds | A + C (capture script from the e2e stack) |
| B4 | **Preview video (~1:30 teaser)** | A YouTube URL in the listing (recommended for games; plays before the screenshots). Play's help does not state a length limit; confirm in the Console before editing to length. Storyboard from the Part I opening without later spoilers: the broken oath, the bells, Mahmut and Fadyme, the company forming, battles, the logo. Sources: in-game captures + a few generated cinematic shots. | A (storyboard, shots, edit), O (approve, YouTube channel, budget) |
| B5 | Copy, data safety, content rating, privacy/terms/deletion URLs, website for `app-ads.txt` | Drafts exist in [docs/store](store/README.md); website/support email/URLs are still UNKNOWN | O + C |

Budget note: generated video costs far more than images. The current media budget (20 USD/month, 3 USD/batch) does not cover a 1:30 teaser of generated shots. Either the teaser is mostly in-game capture, or the owner sets a separate one-off video budget.

## 3. Phase C — Patch 1: Part I Chapter 1 + the whole game around it

Contents: world map data (Part I road, Chapter 1 open, 2–7 "coming soon"), Chapter 1 (8 nodes: stages 1-1..1-5 with story), Chapter 1 art/music/video, the hub buttons live (modes, events, banners, shop), first event season and banners. Server side (Workers Builds): mode/event data for the season. Acceptance: a fresh install goes AAB → tutorial → patch → map hub → Chapter 1 to the end on a real phone; every hub button works.

## 4. Phase D — Patches 2–7: one chapter each

Each patch: that chapter's stages, story, encounters, art (new heroes/bosses from ART-1), music, map reveal of the next bell, its banners. Built cumulatively (A3), published through the Control Center, rolled back by publishing the previous snapshot at a higher generation. Cadence: owner decision.

## 5. Phase E — Hard mode (after Chapter 7)

One patch adds hard variants of all 35 stages (data: `difficulty: hard` nodes with stronger enemy levels/attributes and their own first-clear rewards), using the A2 code already in the AAB and server rules already deployed. Proposed unlock rule: a stage's Hard opens when its Normal is cleared **and** Chapter 7 is finished (owner decision).

## 6. Owner decisions this plan needs

1. Teaser video: mostly in-game capture, or a separate generated-video budget (amount)?
2. Patch cadence for chapters 2–7 (e.g. every N weeks).
3. Hard mode unlock rule and whether Hard has its own stamina/rewards.
4. Website/support email/privacy URL for the listing (needed before any public track).
5. Whether the world map replaces the Home grid outright (proposed) or the grid stays reachable as a list view.
