# Release roadmap — first AAB (Unity 6 LTS, D-31), store listing, chapter patches, Hard mode (D-29)

Owner direction 2026-10-20 (D-29) & 2026-10-24 (**Decision D-31**): **Claude Opus 5.5** (`claude-opus-5-5`) owns 100% of engineering, the **Unity 6 LTS (`apps/unity/`, C#, URP 2D)** client migration ([CLAUDE_OPUS_UNITY_HANDOFF](handoff/CLAUDE_OPUS_UNITY_HANDOFF.md)), and all **Google Gemini API** creative asset production. Perfect the first AAB (D-22 scope on Unity 6 LTS), give the Play listing a ~1:30 teaser video plus logo/banners/screenshots, then ship everything else as signed data patches. Patch 1 is Part I Chapter 1 **with the whole game around it**: the world map as the main menu, with events, modes, options and banners placed around the map. Patches 2–7 add one chapter each. After Chapter 7, the Hard mode of all chapters.

## 0. The rule that shapes everything: code ships in the AAB, data ships in patches

Patches are signed, closed **data** snapshots ([CONTENT_RELEASE_CONTRACT](CONTENT_RELEASE_CONTRACT.md), [PATCHING](PATCHING.md)). They cannot add C# DLLs or executable code, and Play policy forbids downloading executable code anyway. So:

- **Every screen, mode and toggle that any later patch will use must already be in the first Unity AAB as C# code**, switched off (or showing "coming soon") until a patch brings its data. The owner's "patch 1 contains the main menu and world map" means: the AAB carries the world-map code; patch 1 brings the map data, the Chapter 1 content and turns the hub on.
- **Every data field a later patch will use must already be in the AAB's schema.** The schemas are strict: an old AAB rejects a patch with an unknown field. New features are therefore declared as **capabilities** (the client advertises which it supports; a release that needs an unknown capability is refused cleanly instead of breaking). Compiled into the first AAB (`UomdCorePrimitives.g.cs`): `world_map_v1`, `hard_mode_v1`, `sprite_animation_v1`, `attributes_v1`, `presentation_v1`, `vfx_v1`.
- **Server code ships separately** through Workers Builds (D-28), not through patches. Hard mode rewards, events and modes are server code + patch data.
- **Size limits per release:** 768 files and 200 MiB per signed snapshot. Each chapter patch is cumulative (a device only downloads files it lacks). In-game videos must stay short and small (WebM/MP4, ~720p), a handful per Part. The store teaser lives on YouTube, not in a patch.

## 1. Phase A — the first AAB, "perfect" (Unity 6 LTS, Decision D-31)

Scope stays D-22 on **Unity 6 LTS (`apps/unity/`)**: logos (Unity / ŞovTaym Studios), Tap-to-Start title, Google sign-in + background patch download, 9-shot prologue, tutorial T-1..T-3, patch wait, restart into the hub. "Perfect" means that flow is flawless on real phones and that the Unity AAB carries **all future C# code** (ported from the handed-over legacy `apps/game` reference oracle).

| # | Work | Owner | State |
|---|---|---|---|
| A1 | **World map hub** (`WorldMapScene`): the Part I Bell Road from canon ([WORLD_ATLAS §2](../narrative/08_Locations/WORLD_ATLAS_AND_GENIE_BIBLE_TR.md): Chapter 1–7 west→east, one bell each, side roads, later Part II north / Part III south). Chapter nodes open their stages; unreleased chapters show "coming soon"; the hub buttons (Summon, Roster, Team, Errands, Deeds, Trials, Mail, Shop, Profile, Options, Notices, events, banner spotlight) sit around the map. Map layout is **data** (`world/world_map.json`, built by `tools/build_world_map.ts`), so patches move/reveal regions without code; without a map (base content) Home stays the grid. | C (code + schema), A (map painting ART-2) | **Done** (`4e8bccf3` code, `5a2a0e86` painted map `bg_world_map_part1`, e2e `world-map.spec`) |
| A2 | **Hard mode code & content** in the AAB & campaign patch: `difficulty` on stage nodes + `hard_mode_v1`; a Hard stage is its own node (own progress/stars/rewards, unchanged server checks); the unlock rule is the requires-chain (first Hard node requires the end of Chapter 7); NORMAL/HARD switch in Chapters only when Hard stages exist. `tools/build_campaign.ts` emits 35 Hard battle nodes (`ch01_s01_battle_hard`..`ch07_s05_boss_hard`) and 35 Hard encounters (+10 levels, +35% HP/ATK, +25% DEF, 80 Eclipse Tokens first-clear). | C + A | **Done** (`c3b5ada4` code, `5a2a0e86` campaign builder + tests) |
| A3 | **Per-chapter patch build**: `tools/make_chapter_patch.ts --chapters N` derives the "Part I chapters 1..N" snapshot from the full campaign build (`tools/lib/chapter-patch.ts`): chapter index, story coverage and recruit selectors trimmed, library entries behind later chapters dropped (and Hard nodes dropped for `N < 7`), encounters/scenes of later chapters left out; units, art (all 52 unit atlases + 100 hero portraits) and the world map stay whole (the map shows the rest as "coming soon"). Patch 1 = 176 files. Publish: `npx tsx tools/publish_release.ts --admin "$UOMD_ADMIN_URL" --dir .cache/patches/part1_chN --id rel_part1_chN --channel <channel> --depends rel_0001` (or 1-click preset in Control Center → Releases). | C + A | **Done**: every N validates over the base (unit tests), e2e `world-map.spec` publishes patch 1 and sees chapters 2–7 as coming soon |
| A4 | In-game video: playback exists (`NarrativeStage` `video` command, skippable, captions). Format: WebM (VP9 + Opus), 1280×720, ≤ 300 s, ≤ 20 MiB per video (validated), captions on stable line ids, Japanese audio only with a reviewed transcript. Device playback check is part of A6. | C (check), A (videos) | **Done** in code; device check in A6 |
| A5 | Known P0/P1 fixes before freezing the AAB: everything in REVIEW §7 that is code (journal fix done, signature passives done, builder waves, Workers Builds clean-clone fix `fe67fae3`, Prologue first-viewing no-skip contract `7207dae1`, parallel R2/IDB batch downloads `5a2a0e86`). | C + A | **Done** |
| A6 | Native QA on physical phones ([QA_ANDROID](QA_ANDROID.md)): sign-in, purchase restore, rewarded ads, patch download/resume, lifecycle, phone-landscape layout. Phone-viewport e2e (2026-10-20/21): every spec that runs on the phone project passes, and all 5 long scenarios on desktop (including prologue timing after `7207dae1`) pass. The runs found and fixed: the canvas/HTML split on 20:9 screens (`9faa09fb`), the tutorial battle freeze after a quick skill pick (`5a137363`), and the patch strip taking battle taps (`38bea845`). `tools/publish_release.ts` retries dropped uploads. Physical phones not run. | C + A (automation), O (devices) | Browser done (desktop + phone); physical devices open |
| A7 | Release mechanics: versionCode, Play App Signing, production API base, test → internal track ([AAB_ACCESS_PLAN](AAB_ACCESS_PLAN.md)). | O + A | Prepared, not run |

**Order:** A3 and A1 first (they define what patch 1 is), then A2, then A6/A7. A1's painted map art (`bg_world_map_part1`) and all 52 unit atlases (`ART-1`) are ingested and approved.

## 2. Phase B — store listing

| # | Asset | Spec (Play Console help, checked 2026-10-20) | Owner | State |
|---|---|---|---|---|
| B1 | App icon | 512 × 512, 32-bit PNG (`docs/store/assets/icon_512.png`, ≤ 1 MB) + Android launcher mipmaps (`mdpi`..`xxxhdpi`); full square; no rank/price text | A (art), O (approve) | **Done** (`e782e255`) |
| B2 | Feature graphic (store banner) | 1024 × 500, 24-bit PNG (`docs/store/assets/feature_graphic_1024x500.png`), no alpha; the play button of the video sits over it | A | **Done** (`e782e255`) |
| B3 | Screenshots | 6 × 1920 × 1080 24-bit PNG (`docs/store/assets/screenshots/01_title_screen.png` .. `06_world_map_hub.png`), landscape 16:9 captures | A | **Done** (`e782e255`) |
| B4 | **Preview video (~1:30 teaser)** | A YouTube URL in the listing. 12-scene, 90-second spoiler-free storyboard & production guide (`docs/store/TEASER_STORYBOARD_90S.md`) ready for capture/assembly. | A (storyboard, shots, edit), O (approve, YouTube channel, budget) | **Storyboard done** (`e782e255`); video cut pending owner sign-off |
| B5 | Copy, data safety, content rating, privacy/terms/deletion URLs, website for `app-ads.txt` | Drafts exist in [docs/store](store/README.md); website/support email/URLs are still UNKNOWN | O + A | Drafts done; operator URLs pending owner |

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
