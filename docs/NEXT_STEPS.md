# Argon 4 / Antigravity Continuation & Master Execution Plan

Updated **2026-10-21**. [README](../README.md) is the complete execution brief and master prompt; [DEV_TRACKER](DEV_TRACKER.json) holds package/evidence status.

## Status 2026-10-21

- **Done since 2026-10-20:**
  - **Workers Builds clean-clone fix (`fe67fae3`)**: `tools/check_content.ts` no longer fails on fresh Linux clones without `narrative/ARCHIVE_MANIFEST.tsv`.
  - **Prologue first-viewing no-skip contract (`7207dae1`)**: SKIP button hidden on first viewing (`!account.storyProgress.prologueDone`) per entry contract; all 5 long desktop E2E scenarios (`zzz-entry-flow.spec.ts`) and phone-landscape E2E pass.
  - **ART-1 complete (`a2279792`)**: All 25 playable heroes (100 VN portraits + 25 16-cell animated chibi atlases) and all 27 enemies & bosses (27 16-cell animated chibi atlases) ingested and owner-approved (`171` approved art entries in `content/approved_art`, `312` seeded assets in `apps/api/seed/assets.sql`).
  - **ART-2 & Phase E (`5a2a0e86`)**: Painted Part I World Map (`bg_world_map_part1.webp`) ingested and wired into `world/world_map.json`; 35 Hard mode battle nodes (`ch01_s01_battle_hard`..`ch07_s05_boss_hard`) and 35 Hard encounters built in `tools/build_campaign.ts` (`hard_mode_v1`); parallel R2/IDB batch downloads in `PatchManager` and `IdbStorage`.
  - **ART-3 & ART-4 (`e782e255`)**: Google Play store icon (`512x512`), Android launcher mipmaps (`mdpi`..`xxxhdpi`), feature graphic (`1024x500`), 6 `1920x1080` store screenshots (`docs/store/assets/`), and 90-second spoiler-free teaser storyboard (`docs/store/TEASER_STORYBOARD_90S.md`).
- **Workspace:** the repository is `F:\unaware-of-my-demise` (owner, 2026-10-20); the owner pushes GitHub `main` with GitHub Desktop. `E:\unaware-of-my-demise`, the `C:\Users\PC\uomd-*` worktrees and the Drive copy are retired (do not edit or commit there).
- **Staging (2026-10-21):** healthy: migration 0029 applied, `/api/v1/health` reports `world_map_v1`, `hard_mode_v1`, `sprite_animation_v1`, `attributes_v1`. Control Center (`uomd-admin-staging`) includes 1-click D-29 release presets (`rel_0001`, `rel_part1_ch1`, `rel_0003_part1_campaign`) and full 52-unit / World Map inspector.
- **Release plan (D-29):** [RELEASE_ROADMAP](RELEASE_ROADMAP.md) — first AAB carries all code (world map hub, Hard mode switch, video), patch 1 = Chapter 1 + the hub (`rel_part1_ch1`), patches 2–7 = one chapter each, then Hard mode; store listing with a ~1:30 teaser.
- **Open, ranked:** Phase C live publication of `rel_0001` + `rel_part1_ch1` on staging; owner decisions on target progression pace, economy numbers, combat semantics (`PROGRESSION_PACE.md`); Chapters 2–7 and boss music within media budget; physical Android device QA & Play Console internal track (`R18`).
- **Argon:** binding working rules in [handoff/ARGON_INSTRUCTIONS](handoff/ARGON_INSTRUCTIONS.md).

## Master 4-Phase Execution Order (Owner Direction — 2026-10-17)

All ongoing and future sessions must execute work in the following four sequential phases (detailed in Section 0 of [README.md](../README.md)):

1. **PHASE 1 — Complete & Perfect the Initial AAB (Base Binary / Vertical Slice) *(CURRENT ACTIVE FOCUS)*:**
   - **Flow & Visual Revisions:** Full first-install AAB playability from `http://127.0.0.1:5173/` (`Studio` → `Title` → 9-shot `Prologue` → `T-1 / T-2 / T-3` story & battles → `Finish`) with locked canonical knee-up (`boydan`) portraits, 16:9 plates/CGs, and 2-head SD Chibi battle sprites.
   - **Music (Lyria 3.5):** Official Main Theme (`bgm_main_theme.ogg`, Candidate 3 — 68 BPM Anatolian gothic melancholic rock motif) is locked and active on Studio/Title. Remaining Prologue, story cutscene, and battle tracks are designed and placed **one by one** with the owner, reusing cohesive motifs across intervals without chaotic clutter or excessive repetition.
   - **Voiceovers (Gemini 3.8 TTS), Subtitles & SFX:** All 116 Japanese lines (`Algieba` locked spiritual 96.0 Hz Narrator, `Sulafat` Fadyme, `Iapetus` Mahmut) paired with voice-synchronized, punctuation-aware cinematic subtitle effects (`apps/game/src/ui/subtitles.ts`) and polished SFX.
   - **Combat Mechanics, Math & VFX:** Deep polish of the 5v5 tactical turn-based battle engine (`@uomd/combat`), damage/shield/Focus/status/resistance math, hit-stop, camera shake, skill/ultimate VFX particles/shaders, and SD Chibi combat animations.
2. **PHASE 2 — Full World Design & Construction (Patch Content):**
   - Design and build all post-AAB chapters (Chapters 1–8+), regions, routes, panoramic battlefields, story backgrounds, event CGs,regional BGM, and Codex/Archive lore via signed declarative patches.
3. **PHASE 3 — All Good & Evil Characters (Playable Heroes, Enemies & Bosses):**
   - Design, generate, and tune all playable heroes/companions and all enemy factions/multi-phase bosses (47+ entity backlog): canonical identity locks, multi-expression knee-up Light Novel portraits, 2-head SD Chibi sprite sheets, skill kits, combat math/balance, and voiceovers.
4. **PHASE 4 — Events, LiveOps & Final Polish:**
   - Seasonal/story events, banner schedules, AFK/Sweep/Arena/Endless Corridor content tuning, Control Center LiveOps publication, final visual/performance polish, and physical Android / Google Play store acceptance (`R18`).

## Argon 4 / Antigravity local deliveries (2026-10-15)

- **R09 (`123c3e6e`)**: Nine-shot prologue caption-alpha/overlap fix, durable account-scoped resume, audio-gesture unlock, native restart fallback, campaign Continue target resolution and first-clear vs repeat stage preview.
- **R13-A (`524f0043`, Opus 5.5 merged)**: Cumulative admin mail grant threshold, atomic mail/compensation audit, banner/shop CAS and cursor pagination/filtering endpoints.
- **R10 (`6f32229a`)**: Battle layout candidates (`afk_faithful`, `current`, `arena_lite`), dynamic cutout/safe-area inset helper (`safeArea.ts`), companion growth legibility tabs (`OVERVIEW | LEVEL | ASCEND | SKILLS`) and accessibility/quality preferences.
- **R11 (`b7cacc52`)**: Native identity (`AndroidKeyStore`), store catalog/offer disclosures, startup/resume/reinstall purchase reconciliation, reactive UMP consent & child/teen ad policy, nonce-bound rewarded ad verification, 21-table account erasure + deletion-on-restore (deletion tombstones are `audit_log` rows read by `reapplyAccountDeletions`; there is no `account_deletions` table and the migration file named at delivery never existed in history) and fail-closed Android release gates.
- **R17-A (`f0020808`, Opus 5.5 merged)**: Bounded snapshot-consistent D1 backup (`apps/api/src/ops/dump.ts`, `apps/api/src/ops/backup.ts`) and index-backed monitoring prune/freshness (`apps/api/src/monitoring.ts`, `apps/api/src/admin/monitoring.ts`).
- **R13 (`55d3437d`)**: Control Center workflows, release composer, R2 asset provenance (`POST /admin/api/assets/:id/approve`, `mediaProvenance`), release diff, sensitive approvals endpoint and Access MFA gate (`ACCESS_REQUIRE_MFA`).
- **R12 (`fc1daea1`)**: Stage Sweep, character-bound Memory Shards nonmandatory resonance & excess conversion, AFK Idle Patrol, Mode Unlock Gates, Achievements, Seasonal Events, Profile & Leaderboards, Async Arena and Endless Corridor (state in `player_tasks` period keys such as `afk:checkpoint`; the migration file named at delivery never existed in history, and 0029 is `0029_attribute_stats.sql`, D-27).
- **R14-B (`c9dfbca2`)**: Deterministic offline art ingest (`tools/ingest_art.ts`), component-first sheet slicer (`tools/lib/slice.ts`), `A31` reference hygiene and `tools/build_content.ts` approved-art assembly & `--strict-art`.
- **R17-B (`b1c3b3cf`)**: Encrypted backup verification & restore rehearsal (`apps/api/src/ops/restore.ts`), deletion-on-restore account scrub (`reapplyAccountDeletions`), R2 backup retention/lifecycle pruning (`pruneBackups`), optional public Cloudflare Access edge probe (`admin_access_edge`) and out-of-band R2/webhook alert persistence (`alerts/<target>/latest.json`).
- **R16 (`8e0e1c3d`)**: Chronological variable-fee/material-gate/no-ad simulator (`packages/economy/src/chronological.ts`), final-boss repeat-5★ vs first-clear resolution (`resolveFinalBossDropTable`), unconditional 80-token UTC Daily Supplies recovery floor (`POST /api/v1/tasks/supplies`) and reviewed Japanese voice transcript/reading validation (`apps/game/src/audio/voiceTranscripts.ts`).
- **R15 (`4b94649c`)**: Locked Fadyme/Mahmut pilot identity anchors, adult-age provenance, resolved hood-vs-cape and studio mark decisions, 8-pose chibi contract verification, third-party engine credit separation (`apps/game/src/ui/pilotAttachment.ts`) and companion bond/tactical/expression UI in `RosterScene`, `CharacterScene` and `SummonScene`.
- **R14-A (`fa80bf43`)**: Cross-process atomic file lock (`tools/lib/budget_lock.ts`), per-call batch reservations (`reserveBatch`), `failed` uncertain call status & `reconcile`, unchanged failed prompt rejection (`unchanged_failed_prompt`), multi-call usage summation (`mergeUsage`) and partial-output `.provenance.json` sidecar persistence in `tools/gen_image.ts` and `tools/media_budget.ts`.
- **R06/R12-Engine (`7e74074e`)**: Status resistance (`effect_res`, `effect_res_pct`, `modify_stat`), per-element fractional damage resistance (`element_res`, `element_res_pct`) and multi-wave encounter progression (`Encounter.waves`, `wave_start` event, deterministic wave spawning) in `@uomd/content-schema` and `@uomd/combat`.
- **D-23 Engine Migration (2026-10-17)**: Complete migration of `@uomd/game` (`apps/game`) from Phaser 4 (`phaser: 4.2.1`) to the **Hybrid PixiJS v8 (`pixi.js: ^8.8.0`) 2D Stage + Modular TypeScript DOM/CSS UI Architecture (`#uomd-ui-layer`)**, retirement of the 28 upstream Phaser topic skills, update of the 6 project engine skills (`phaser4-*` compatibility aliases) and MCP live inspector (`tools/mcp_phaser_live.ts`), and full E2E/unit/Python test verification.

## Remaining external gates

- **R18 & External Gates**: Physical Android device testing, signed unchanged-AAB season proof, real Google OAuth/Play Billing/AdMob sandbox verification, owner-held `age` private-key live restore drill and live Cloudflare deployment tag verification remain explicit external gates.

