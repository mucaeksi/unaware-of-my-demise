# Unaware of My Demise — Unified Development Master Prompt

**Gothic anime gacha RPG · Android / Google Play first · Unity 6 LTS (C#, URP 2D) Migration & Claude Opus 5.5 Exclusive Ownership (D-31) · updated 2026-10-24**

> Read this entire README before substantial work. It is the sole engineering and creative execution brief. [narrative/](narrative/) remains authoritative for fiction, dialogue, characters, chronology and spoilers. Supporting records hold implementation details and evidence; current owner instructions override older agent/model assignments.

**Current checkpoint (2026-10-24, Decision D-31): 100% of project operations, architecture, engineering, Unity engine migration and creative production are handed over exclusively to Claude Opus 5.5 (`claude-opus-5-5` / Claude Code). Argon 4 / Antigravity and Codex are retired from active ownership; only Claude Opus 5.5 operates on the repository. Under D-31, Claude Opus 5.5 is migrating the entire game client from the legacy web/Capacitor stack (now completely removed) to Unity (`apps/unity/`, C#, Unity 6 LTS, URP 2D) per [docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md](docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md), and generates all remaining and future assets exclusively via the Google Gemini API (`tools/gen_image.ts`, `tools/record_game_vo.py`, `tools/generate_phase1_music_lyria35.py`, `tools/ingest_art.ts` under `content/budget/media_budget.json`). `npm run export:unity` (`tools/export_unity_bundle.ts`) exports `content/base` (`rel_0001`), converts top-left atlas frames and `foot_y` pivots to Unity bottom-left coordinates (`StreamingAssets/uomd_metadata/`), and emits bit-exact C# core primitives (`Mulberry32Rng`, D-27 `UomdStatMath`, `UomdClientConfig`) for server battle replay verification (`POST /api/v1/battles/verify`). D-27: heroes, enemies and gear use the STR / INT / VIT / AGI stat model ([STAT_MATH](docs/combat/STAT_MATH.md)). D-28: Claude Opus 5.5 edits and commits locally in `E:\Unity`; since D-32 Claude Opus 5.5 pushes its verified work to GitHub `main` itself, and that push deploys staging through Cloudflare Workers Builds (gated by `npm run verify`).**

**Next step (Decision D-33, 2026-10-25, staged):** development moves to the owner's local machine (Unity 6.3 LTS). Claude Opus 5.5 runs the first local Unity pass ([docs/handoff/CLAUDE_LOCAL_FIRST_PASS.md](docs/handoff/CLAUDE_LOCAL_FIRST_PASS.md)) and then hands day-to-day operations to **Gemini Argon** ([docs/handoff/ARGON_UNITY_HANDOFF.md](docs/handoff/ARGON_UNITY_HANDOFF.md)) with the same delivery terms as D-32. Until that handoff is marked active, D-31 governs.

---

## 0. Master Execution Roadmap — Step-by-Step Project Progression (4 Phases)

Every new session or agent joining this project must follow this strict **four-phase sequential execution order**. Do not skip ahead to later phases before the active phase is polished, verified, and approved by the owner:

### PHASE 1 — Complete & Perfect the Initial AAB (Base Binary / Vertical Slice) *(CURRENT ACTIVE FOCUS)*
The top priority is finishing the **Initial Store AAB** (`StudioScene` → `TitleScene` → 9-shot `PrologueScene` → `Tutorial T-1 / T-2 / T-3` pre/post story scenes & battles → `FinishScene`) to 100% production quality:
1. **End-to-End Flow & Visual Revisions:**
   - Ensure `http://127.0.0.1:5173/` (and `?fresh=1`) always plays the complete initial AAB experience from the very beginning (`Studio` → `Title` → `BEGIN` → `Prologue` → `T-1` → `T-2` → `T-3` → `Finish`) without ever skipping straight into a battle or mid-tutorial state.
   - Maintain canonical character locks (`content/specs/character_locks/`) across all 16:9 plates, CGs (`roadside_rest`, `shelter_evening`), knee-up (`boydan`) Light Novel portraits (4 distinct expressions + body-language poses per character), and true 2-head Super-Deformed (SD) Chibi battle sprites.
2. **Music Design & Scene-by-Scene Placement (Google Lyria 3.5):**
   - **Main Theme (`bgm_main_theme.ogg`):** Completed and locked (Candidate 3 — 68 BPM, 2:46 Anatolian gothic melancholic rock ballad motif inspired by the emotional spirit of *Duman — Haberin Yok Ölüyorum*, active in `StudioScene` and `TitleScene`).
   - **Scene & Battle Soundtrack Placement:** Design and place the remaining tracks **one by one** with the owner using Google Lyria 3.5 (`/v1beta/interactions`, model `lyria-3.5`). Do **not** clutter every scene with a different chaotic track; reuse a cohesive, curated set of emotional motifs at smart intervals (Prologue, calm/wistful story scenes, pre-battle tension, and tactical combat) so tracks feel memorable without becoming repetitive.
3. **Voiceovers (Gemini 3.8 TTS), Subtitles & Sound Effects (SFX):**
   - **Locked Cast (116 Vertical Slice Lines):**
     - **Narrator (`Algieba`):** Locked to a single, serene, spiritual/ethereal (*ruhani*) 96.0 Hz voice tone and sacred-hall acoustic profile across all 9 Prologue scenes and 24 Tutorial narration lines so every narration sounds 100% uniform.
     - **Fadyme (`Sulafat`) & Mahmut (`Iapetus`):** Directed with per-line emotional `speech_metadata.style` prompts and natural inline vocal tags (`<chuckle>`, `<sigh>`, `<breath>`, `<exhales>`).
   - **Synchronized Cinematic Subtitles:** Subtitles (`apps/game/src/ui/subtitles.ts`) reveal in real-time lockstep with the active voiceover audio clock, pausing naturally on punctuation (`—`, `…`, `.`, `,`) with smooth rise/fade/shimmer and a golden voice-resonance bar.
   - **Combat & UI SFX:** Polish bell chimes, footsteps, blade/shield impacts, warding bell casts, and UI feedback.
4. **Combat Mechanics, Mathematics & Visual Effects (VFX):**
   - **Combat Math & Tactical Depth:** Audit and polish the 5v5 turn-based tactical combat math (`@uomd/combat`): damage/defense curves, shield absorption, Focus generation & Ultimate pacing, turn-order/speed readability, status effect durations, element/effect resistances (`element_res`, `effect_res`), and enemy telegraph/intent clarity.
   - **Combat VFX & Juice:** Upgrade skill and ultimate visual effects (slash arcs, warding bell ripples, elemental particles, hit-stop freeze frames, directional camera shake, floating damage/status typography, and smooth SD Chibi attack/hit/cast animations).

5. **Engine track — Unity 6 LTS (C#, URP 2D) Migration (Decision D-31, 2026-10-24; supersedes historical D-23/D-25 web track):** **Claude Opus 5.5** migrates the entire client from the handed-over legacy `apps/game` reference oracle to `apps/unity/` (`Uomd.Shared`, `Uomd.ContentSchema`, `Uomd.Patch`, `Uomd.Economy`, `Uomd.Story`, `Uomd.Combat`, `Uomd.Game`, `Uomd.Native`) per [docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md](docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md).
   1. **Phase U-0 (Complete 2026-10-24):** `npm run export:unity` (`tools/export_unity_bundle.ts`) exports `content/base` (`rel_0001`), converts top-left atlas frames and `foot_y` pivots into Unity bottom-left `Sprite` rects/pivots (`StreamingAssets/uomd_metadata/`), and emits bit-exact C# core primitives (`UomdCorePrimitives.g.cs`: `Mulberry32Rng`, D-27 `UomdStatMath`, `UomdClientConfig`).
   1a. **Licence-free verification (2026-10-24):** `npm run test:unity-logic` builds the engine-free assemblies in `apps/unity/Logic` with the .NET SDK and runs the EditMode parity tests; `npm run check:unity-compile` compiles every asmdef against the real Unity 6000.0.58f2 assemblies and checks `Packages/manifest.json` against the editor's bundled packages. Both pass. A real Unity import/AAB still needs an activated licence ([apps/unity/cloud/README.md](apps/unity/cloud/README.md)). The Control Center Development page shows the migration state computed from the repository.
   2. **Phases U-1 & U-2:** Unity 6000.0 LTS URP 2D scaffold + bit-exact C# ports of `@uomd/combat`, `@uomd/story`, `@uomd/patch`, `@uomd/economy` verified against server battle replay hashes (`POST /api/v1/battles/verify`).
   3. **Phases U-3 & U-4:** All 28 scenes ported to Unity URP 2D + UI Toolkit / TextMeshPro (`Cinzel` / `Cormorant Garamond`), including data-driven `vfx_presets.json` (`vfx_v1`), R09 durable continuity (`D-26`), and the Part I World Map hub (`world_map_v1`, `hard_mode_v1`).
   4. **Phases U-5 & U-6:** Direct Android `AndroidJavaObject` bridges (`Assets/Plugins/Android/`), IL2CPP ARM64 signed AAB cutover, and archival of legacy `apps/game` + `apps/android` into `archive/legacy-web-era`.

---

### PHASE 2 — Full World Design & Construction (Delivered via Signed Content/Media Patches)
Once the Initial AAB is 100% locked and approved:
1. **World & Chapter Architecture:** Design and build the complete game world across all chapters (Chapters 1–8+, regions, routes, sanctuaries, ruined capitals, cathedrals, and corridors) as declarative patch packages (`content/campaign/` & signed release snapshots).
2. **Environmental Art & Atmosphere:** Produce wide-angle 16:9 panoramic battlefields, VN story backgrounds, chapter event CGs, world-map/node navigation visuals, and regional background music themes that evolve with the narrative journey.
3. **World Lore & Codex Integration:** Wire regional histories, roadside registers, bell towers, and faction records into the gated Archive/Codex with spoiler-safe progression gates.

---

### PHASE 3 — All Good & Evil Characters (Playable Heroes, Enemies & Bosses)
After the world foundations and stages are established:
1. **Playable Heroes & Companions (Good Characters):**
   - Establish canonical visual identity locks (`character_locks`) for every playable hero and story companion.
   - Generate their knee-up (`boydan`) Light Novel dialogue sprites (multiple distinct emotional expressions and hand/body poses), true 2-head SD Chibi battle sprite sheets (`idle`, `attack`, `skill/ultimate`, `hit/defeat`), summon reveal art, and signature weapon/emblem visuals.
   - Author and tune each hero's complete combat kit: active skills, Focus ultimate, passive hooks, role identity (Vanguard, Warder, Arcanist, Striker, Support), stat growth curves, ascension gates, loan loadouts, and directed Japanese voice lines.
2. **Enemy Factions, Elites & Multi-Phase Bosses (Evil / Opposing Characters):**
   - Design and integrate the full enemy roster and major Boss encounters (47+ entity backlog) with distinct silhouettes, corrupted/hollow motifs, SD Chibi/Boss sprite sheets, and multi-wave formations.
   - Configure boss phase transitions (`battle_start`, HP-threshold/fresh-bar phases), destructible boss objectives, signature telegraph attacks, status immunities/resistances, and sequential campaign difficulty balance (ensuring the entire main story remains clearable with zero gacha pulls).

---

### PHASE 4 — Events, LiveOps Modes & Final Polish
In the final phase before and alongside store rollout:
1. **Events & Seasonal Content:** Design and wire seasonal story events, limited-time event stages, event shops, wish/banner schedules, daily/weekly task chains, and achievement milestones.
2. **Side Modes & End-Game Polish:** Finalize stage content and reward tables for AFK Idle Patrol, Stage Sweep, Async Arena, Endless Corridor, and Companion Bond Stories.
3. **Final QA, Control Center & Store Acceptance (R18):** Perform full end-to-end visual/audio/balance polish, Control Center LiveOps publication drills, and physical Android device / signed unchanged-AAB acceptance testing for Google Play release.

---

## 1. Authority, scope and working agreement

1. Current owner/session instructions take precedence. This README governs engineering; narrative/ governs canon. [AGENTS.md](AGENTS.md) and [CLAUDE.md](CLAUDE.md) are host entry points. Read the relevant canon, scripts and character profiles for the assigned feature.
2. Match the current assignment. A review or documentation task stays within that scope. An implementation assignment proceeds through complete, dependency-ordered changes and verification. If the owner explicitly requests review and task selection first, complete the review and wait for that selection; otherwise do not add routine approval stops.
3. Ordinary reversible coding, debugging, migrations authored for review, isolated previews, authorized staging work and vetted documentation-only skill research may proceed autonomously. Continue unblocked work while a genuine external dependency waits.
4. Separate approval is required for production creation/public release, permission boundaries/new roles, destructive canon or production-data operations, real-money prices, new executable third-party hooks/permissions and spending beyond the approved media budget. Never alter player transactions outside an explicitly authorized operation.
5. Canon may evolve through measured original changes to dialogue, pacing, quests, relationships and encounters. Preserve history, original source IDs and provenance; maintain chronology and character consistency. Flag substantial identity, plot-reversal or ending changes for owner review. Do not silently regenerate Part I or rewrite canon to accommodate an implementation.
6. Chat/progress reports are **Turkish**; player-facing text and technical deliverables are **English**; spoken dialogue targets **reviewed Japanese**. Turkish localization is deferred. Keep stable locale and line IDs for future additions.
7. Work in `E:\Unity` (owner, 2026-10-25; D-28, D-31). Under Decision D-31, **Claude Opus 5.5** is the sole agent authorized to work on the repository, commit locally on `main`, and execute the Unity migration (`apps/unity/`) and Gemini API asset generation, and pushes verified commits to `main` (D-32). Keep commits reviewable and `main` green (`npm run verify`). Never force-push/rewrite shared history or blindly commit all uncommitted files. Archive legacy trees before removal; the previous README remains in Git history.
8. Report actual PASS / FAIL / BLOCKED / UNVERIFIED results. Code presence, a declaration, mock, unit test, browser preview, deployed Worker and physical-device acceptance are different evidence levels. Revalidate dated findings on the current commit before opening or closing a task.

## 2. Approved game and experience

- **First public release: Android through Google Play**, signed AAB. Browser builds are internal development/QA/owner previews. iOS and Steam are separately approved future tracks. Keep portable account, entitlement and gameplay adapters without delaying Android.
- **Landscape**, authored at **1920×1080 reference coordinates**, with adaptive resolution, safe areas, readable text and physical-size touch targets.
- Main combat is **5v5 turn-based tactical team combat**: manual skills/targets, Focus/ultimate, formation, status effects, bosses and deterministic replay. Auto Battle, Sweep and server-calculated AFK rewards are required foundations.
- Painterly Gothic-anime portraits/cinematics, distinctive **chibi battle units**, restrained ornamental UI and atmospheric staging. References are principles only: Heaven Burns Red for relationships/story rhythm, Reverse: 1999 for visual treatment, AFK Arena for convenience, BrownDust2 for tactical readability, Morimens for later replayability. Do not copy assets or specific designs.
- Express existing motifs—bells, names, time, memory, vows, registers, loss and companionship—through original mechanics and character attachment. Each character needs a recognizable face, silhouette, costume, weapon handling, emblem, accent, poses, impact timing and VFX rhythm.
- **Main-story access never requires a gacha win.** Use authored recruits/guest units and viable loan loadouts. A no-pull, no-ad player must have a demonstrable story/progression route.
- **One main currency: eclipse_token, displayed as Bell's Remains.** Wishes, character/weapon upgrades and shop spending use it. XP/ascension materials and character-bound Memory Shards are items; Ration is energy. Retired Fate's Thread/Silver Crowns do not return as new money.
- Adult female and male characters may have tasteful, eye-catching Gothic designs fitting their roles and dignity. Do not sexualize chibi/child-coded or age-unconfirmed characters; no explicit sexual content. Aim around 16+ in presentation, but the actual regional IARC rating must come from the real content questionnaire and owner review.
- Avoid ads during emotional dialogue/cinematics or tactical choices. Show the next story action, skill purpose, exact spending/result and save/recovery state clearly. Keep gacha rates/pity/history accessible before spending; hide irrelevant developer diagnostics in shipping flows.

### Initial content and extensibility contract

The first store build contains a coherent menu, an authored approximately **120-second opening**, **T-1/T-2/T-3 with intervening scenes**, and a **Finish/save/restart** flow. Canonical initial tutorials use **Mahmut and Fadyme**, manual skills/targets, no speed/Auto battle buttons, no Ration/drops/economic clear claims; they record presentation checkpoints. Entry cutscenes use the approved normal-speed Auto on/off reading toggle and no Skip. The general later story reader still needs appropriate choices, replay and skip behavior.

Start background patch download after sign-in; keep progress/retry visible without changing the tutorial's active content. Stage downloaded content and activate at restart. A returning completed account opens the full menu with the next campaign action; tutorial replay is separate. First startup needs connectivity for Google identity/content, with truthful retry and no lost progress.

Small initial **content** does not reduce first-binary **capabilities**. All runtime, gameplay, identity, monetization, admin and interpreter foundations promised for the first binary must already function before submission, even if later modes are initially locked. Full-menu screens and effect interpreters ship as code; patches may unlock/configure them, not introduce missing executable screens or primitives.

Deliver new chapters, characters, encounters, events, seasons and media as validated **signed declarative data/media**. No downloaded JavaScript, WASM, native libraries, SDK replacements or disguised private executable language. New executable effects, native features, security/SDK updates or OS/store mandates can require another AAB. Minimize further binaries through tested extensibility; never promise that no further AAB will be necessary.

## 3. Architecture, rendering and deployment

| Area | Approved implementation |
| --- | --- |
| Game | **Unity 6 LTS (`apps/unity/`, C#, URP 2D) (Decision D-31, supersedes historical D-23a/D-25):** Claude Opus 5.5 ports the client to modular `.asmdef` assemblies (`Uomd.Shared`, `Uomd.ContentSchema`, `Uomd.Patch`, `Uomd.Economy`, `Uomd.Story`, `Uomd.Combat`, `Uomd.Game`, `Uomd.Native`) per [CLAUDE_OPUS_UNITY_HANDOFF](docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md). `npm run export:unity` (`tools/export_unity_bundle.ts`) exports `content/base` (`rel_0001`), bottom-left converted Unity sprite slice manifests, and bit-exact C# core primitives (`UomdCorePrimitives.g.cs`). The handed-over legacy `apps/game` client remains in the tree only as a behavioral/test oracle until Phases U-1..U-5 reach full parity and is archived in Phase U-6. |
| Renderer | **Unity Universal Render Pipeline 2D (URP 2D) + UI Toolkit (UXML/USS) / uGUI + TextMeshPro** (`Cinzel` / `Cormorant Garamond` SDF fonts) in the 1920×1080 landscape reference frame (`Screen.safeArea` adaptive reflow, `high`/`medium`/`low` quality tiers, 30/60 FPS target). |
| Mobile | **Unity Android IL2CPP / ARM64 AAB** (`com.sovtaym.unawareofmydemise`) with direct `AndroidJavaClass` / `AndroidJavaObject` bridges to the Java plugins (`UomdGoogleSignInPlugin`, `UomdBillingPlugin`, `UomdAdsPlugin`, `UomdAppPlugin`) migrated from legacy `apps/android` into `apps/unity/Assets/Plugins/Android/`. Android Credential Manager, Play Billing, AdMob/UMP, AndroidKeyStore AES-GCM session storage, lifecycle/networking/crash reporting and reproducible native builds. Spine/Live2D only after runtime binding, SDK/license/editor/export/mobile/performance review; a flat generated image is not a rig. |
| Backend | Cloudflare Workers + Hono. **D1/SQLite is the sole SQL database**, with DB bindings, parameterized SQL, migrations and typed models. Any Drizzle usage must use the D1/SQLite driver. No Neon/PostgreSQL/Hyperdrive/Firebase/Supabase game database. |
| Assets/services | R2 for versioned assets/media/patches, Queues/Cron where justified, Access for admin, appropriate WAF/rate limiting/Turnstile and monitoring. R2 is not a financial database. |
| Management | Separate React + TypeScript **UOMD Control Center**, protected by Access, verified JWT, MFA policy, RBAC, audit and least privilege. The approved Access policy restricts access to the owner's account members; verify live policy enforcement. |
| Isolation | Separate development, staging and production D1/R2/bindings; no production user data in previews. Add isolated PR previews. Production creation remains an owner decision. |

Keep `apps/unity/` (target Unity client), `apps/api`, `apps/admin`, `packages/*`, `content/`, `narrative/`, `tools/` and `tests/` intact (with handed-over legacy `apps/game` and `apps/android` retained only until Phase U-6 archival into `archive/legacy-web-era`). Godot survives only in `archive/godot-era`; older media are references in `archive/pre-cleanup-2026-10-10`, [narrative/ARCHIVE.md](narrative/ARCHIVE.md) and `reference/`. Do not restore retired code or engine guidance.

**Deploy path (D-28, D-31): Claude Opus 5.5 edits and commits → pushes `main` itself (D-32, fast-forward only) → Cloudflare Workers Builds deploys staging.** `E:\Unity` is the repository (owner, 2026-10-25; it replaces `E:\Unity`, owner 2026-10-20). `E:\unaware-of-my-demise`, the `C:\Users\PC\uomd-*` worktrees and the Drive copy are retired. Under D-31, **Claude Opus 5.5** is the sole agent operating on the repository: it edits only in F:, runs `npm run verify` and commits its own files locally. Under D-32 (2026-10-24) it pushes its verified commits to `main` itself (fetch first, fast-forward only, never force-push); it never deploys by hand. A push to `main` starts one Workers Build per Worker (game, admin, ops; settings in [RUNBOOK](docs/RUNBOOK.md#workers-builds)). The game build runs `npm run verify` before building; its deploy step, [tools/deploy_staging.sh](tools/deploy_staging.sh), applies the staging D1 migrations and idempotent seeds and then deploys with the commit sha as the version tag. One build deploys exactly one Worker, because Workers Builds forces its Worker name on every `wrangler deploy`. Build results appear as GitHub check runs on the commit. There is no local deploy path: the Drive/Wrangler scripts of D-24 were deleted. If Workers Builds is down, retry the build in the Cloudflare dashboard. Never deploy a Worker by hand: a Worker without its migrations answered 500 on 2026-10-19. GitHub Actions stays unused. Google Drive is no longer part of the workflow; do not run git in the old Drive copy, because Drive served stale reads and locked files during commits and checkouts.

D1 Free is authorized for development. The previously recorded baseline was 5 million rows read/day, 100,000 written/day, 5 GB aggregate storage, 500 MB/database and 10 databases; **reverify current provider limits before capacity decisions**. Measure rows read/written, CPU/query latency/concurrency, storage and costs; add quota handling/alarms and an approved paid-tier path. Optimize/shard from metrics while staying within Cloudflare.

### Trust and Google integrations

- Financial/gameplay state is server authoritative: balances, inventory, progression, pity, purchases, subscriptions, ad rewards, AFK/Sweep and event claims. Use immutable journals, unique idempotency keys, nonnegative balances, conditional writes/CAS, supported transactional D1 batches and durable retry/reconciliation. Two API calls are not a transaction; Miniflare concurrency tests are not live-D1 proof.
- Android player login is **Google only** via Credential Manager and backend signature/issuer/audience/expiry verification. Map verified Google sub to a stable internal player ID, not mutable email. Handle refresh/re-auth/revocation/recovery/deletion. Play Games is optional achievements/services identity, not a substitute login. Browser staging uses genuine Google web sign-in when configured; automation uses explicitly isolated dev/test identities only.
- **Play Billing is required in the first AAB** for shop products, consumables/bundles and recurring subscriptions. Google Play owns real prices/products/base plans; admin maps in-game benefits. Verify through Play Developer API; support pending, ack/consume, restore, renew/cancel/refund, grace/hold/pause/expiry and OIDC RTDN via Pub/Sub. Grant only after server confirmation; sale availability cannot cancel already-paid obligations.
- **AdMob rewarded ads** are the default; interstitial placements require approval. Verify SSV and idempotent nonce/transaction grants server-side, enforce abuse/frequency controls, and separate test/live units. The currently approved cap is five rewarded ads per rolling 12 hours; reward amounts remain subject to final tuning.
- **UMP/privacy** must support applicable EEA/UK/Swiss consent, withdrawal, age/child-directed safeguards, account/data deletion, Data Safety and truthful disclosures. Access MFA and consent configuration require actual evidence.
- Reconcile actual Google Play/AdMob reporting with entitlement/ledger records; token grants are not revenue. Keep accounts/entitlements platform-independent: future iOS can require another equivalent login and Apple billing, and Steam has separate storefront rules.

Secrets stay in the supported runtime/Worker/CI secret store. Never print keys/tokens, dump the environment, copy secret values into source/artifacts/chat or presume GitHub Actions secrets exist in the current host. A configured variable/MCP declaration does not prove permission or connectivity. For missing access, report the exact setting/secret name, console, minimum scope and target environment; let the owner enter it securely. Verify credentials with bounded authorized checks revealing only success/failure. Existing grants remain valid across turns.

## 4. Current implementation, checkpoint and evidence

The original four-commit transfer was integrated on 2026-10-13. Earlier audit failures and slice-by-slice deliveries remain in Git history, [BUILD_STATE](docs/BUILD_STATE.md) and [DEV_TRACKER](docs/DEV_TRACKER.json); they are not the active queue. R08 was built on `0f2f3f11403942ef4b58f8691f2f06e8699d4a03`. Its delivery commit is recorded in the handoff below.

| Area | Implemented now | Remaining acceptance/work |
| --- | --- | --- |
| Financial correctness | Shared atomic material spending; release/account/CAS fences; immutable request/grant provenance; duplicate/copy protection; paid-only repeat payouts; durable purchase/RTDN/refund/ack recovery and encrypted scheduled retry. | R02 policy/live/provider proof; R05 remaining cross-package/native recovery; R11 offer and session lifecycle; R16 final quantities. |
| Combat | Deterministic 5v5-capable replay, manual skills/targets, Focus, control/Auto correction, bosses/objectives/phases, owned teams and canonical virtual-loan equipment, supported healing/Focus bonuses. | R06 resistance and semantic decisions; undefined signature procs remain visibly unavailable; R12 modes/multiwave; R16 full sequential balance. |
| Canon and progression | All 51 main-story entries/419 main line IDs, 88 Part I scenes, both phase interludes; First Oath's seven-choice selector; one no-gacha Iona/manual chapter proof; 76 companion parts +12 codex +4 events in a gated 92-entry/100-scene Archive. | R09 durable continuity, production media and broader chronology/balance/native proof. Compiler coverage is not proof of every route's playability. |
| Effective content | Complete signed same-channel snapshots; exact server/client catalog; declared-only recruit→grow→equip→summon→fight; immutable ID registries (0026); frozen task/mail/purchase obligations (0027); safe unavailable-owned support. | Deployed season measurements and original signed-AAB proof in R17/R18. Catalog publication is enabled only for a compatible backend/client. |
| Presentation runtime | Closed voice/caption/video/locale/audio/stage/camera/mask/tween/flag/checkpoint/notice/frame-animation grammar; server calendar gates; local fallback/cleanup; compiled screen actions only. | R09 account/release resume, R10 full UI localization/accessibility, R15 production visuals/animations, R16 reviewed Japanese media. |
| Patch reliability | Client 0.1.2/capabilities; backend readiness probe; compiled trust-root rules; IDB v2 transaction completion; retained-byte reservations/GC/quota; partial range resume/cancel/deadlines/data consent; owned bounded caches and explicit storage-loss notices. | Physical WebView/storage/codec/memory/FPS/unchanged-AAB and live limits, R17/R18. |
| Entry and mobile | Nine-shot prologue, manual T-1/T-2/T-3 plus six interscenes, background staged download, Finish/restart, Android Java Google/Billing/Ads/UMP native bridges (migrating to Unity `apps/unity/Assets/Plugins/Android/` under D-31). | R09 timeline/Continue/account-scoped continuity; R11 privacy/session/native lifecycle; Unity Phases U-1..U-5 port & R18 physical sandbox. |
| Control Center and operations | 14 real pages; Access/JWT/RBAC/CSRF/audit; catalog export/publish tools; game/admin/ops configs; age-encrypted backups and health/reconciliation code. | R13 complete authoring/LiveOps/support/release UI; R17 bounded restore/capacity/alerts/current deployment proof. |
| Creative assets | Art Bible, canon, references, generation/budget helpers. `content/approved_art` has 258 approved art entries (54 16-frame unit/objective atlases, 128 VN portraits, 47 backgrounds, 16 banners, 11 stills, 2 UI marks), 7 Lyria BGM tracks, 116 Japanese voice lines and 16 Ogg Vorbis SFX cues (`415` D1 seeded assets). | Under D-31, **Claude Opus 5.5** owns 100% of visual design, **Google Gemini API** asset generation, Unity integration and animation. No synthetic test clip/tone is production art or Japanese speech. |

**Final R08 local verification (2026-10-14):** 923 application/tool tests (API469, game97, combat93, schema123, economy44, patch41, shared24, story8, tools24); lint/typecheck; campaign/game/admin builds; 46 skill adapters; 16 real local-Worker browser cases across desktop and touch-phone, with all 27 migrations. Final stage, notice, video/fallback, new-hero and battle screenshots were inspected. Exact scope/timestamps live in the registry; this handoff does not refresh old external evidence.

The browser season uses a signed synthetic catalog/media fixture published through public admin APIs and installed in the same built browser binary. It exercises new-identity economics, masks/locales/video/notices/animation, account-change cleanup, storage upgrade/abort/fallback, rollback/kill and lost-response recovery. Numeric definitions/art are reused; this is infrastructure evidence. No production generation, canon rewrite, live migration, signed AAB, physical device, provider sandbox or deployed acceptance was performed for R08.

## 5. Prioritized dependency route

**P0**: financial/data/release blocker. **P1**: required first-binary or core experience gap. **P2**: operational/scale/ergonomic debt, promoted when required by measured load or release acceptance. **S/M/L** are relative effort, not promised dates.

Current task and evidence status is recorded in [DEV_TRACKER](docs/DEV_TRACKER.json), with evidence semantics in [BUILD_STATE](docs/BUILD_STATE.md). R00/R01/R03/R04 and R08 are complete at the recorded local source scope. R02/R05/R06/R07 remain partial; R09–R18 retain the work below. External acceptance remains explicit. Recheck current code and scoped evidence before starting. Each package's completion criteria are defined once in section 6.

| ID | Work package | Priority / size | Dependencies |
| --- | --- | --- | --- |
| R00 | Truthful capability/evidence matrix | P1 / S | None |
| R01 | Atomic material spending and grant invariants | P0 / S–M | R00 |
| R02 | Purchase/refund/RTDN/entitlement recovery | P0 / L | R00 |
| R03 | Patch publication/generation/reward authority | P0 / M | R00 |
| R04 | Free-repeat rewards and duplicate grant concurrency | P0 / M | R01, R03 |
| R05 | Persistent client operation recovery | P1 / M | R01, R02, R04 |
| R06 | Combat semantics, gear/loans/capability limits | P1 / L | R01 |
| R07 | Canon compiler and semantic publication validation | P1 / L | R03, R06 |
| R08 | Effective server/client catalog and complete patch grammar | P1 / L | R02, R03, R06, R07 |
| R09 | Complete entry/Continue/checkpoint/restart flow | P1 / M–L | R05, R07 |
| R10 | Reviewable layouts and mobile/accessibility UX | P1 / M | R06, R09 |
| R11 | Native identity/monetization/privacy lifecycle | P1 / L | R02, R05 |
| R12 | Missing first-AAB mode foundations | P1 / L, separate slices | R01, R04, R06, R08 |
| R13 | Essential Control Center workflows | P1 / L | R02, R03, R07, R08 |
| R14 | Media budget correctness and free ingest/QC | P1 / M–L | Guard work early; layout-specific contracts after R10 |
| R15 | Approved visual pilot and character/UI polish | P1 / L | R10, R14 |
| R16 | Final economy/campaign balance and sound/VO | P1 / L | R06, R08, R09, R12, R15 |
| R17 | Ops/build/scale/restore hardening | P1/P2 / M–L | Starts early; completion after R02, R03, R08 |
| R18 | Unchanged signed-AAB and Play acceptance | P0 release gate / L | R11–R17 and all required systems |

**Execution order (D-31, 2026-10-24):** **Claude Opus 5.5** is the sole active agent on the repository. It executes the Unity 6 LTS (`apps/unity/`) migration Phases `U-1` through `U-6` defined in [docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md](docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md) alongside any remaining Gemini API asset production (`tools/gen_image.ts`, `tools/record_game_vo.py`, `tools/generate_phase1_music_lyria35.py`, `tools/ingest_art.ts`), economy/combat tuning (R16), and physical Android device / Google Play store acceptance (R18). A missing external credential does not block independent Unity C# porting, design, or offline verification work.

## 6. Package state and concrete completion criteria

### R00 — State, evidence and document reconciliation

**Complete locally.** Maintain [DEV_TRACKER](docs/DEV_TRACKER.json), [BUILD_STATE](docs/BUILD_STATE.md), [INFRA_ROADMAP](docs/INFRA_ROADMAP.md) and [NEXT_STEPS](docs/NEXT_STEPS.md) with revision, exact scope, checks, timestamp and real blockers after each delivery. BUILT, LOCAL_TESTED, STAGING_VERIFIED and DEVICE_VERIFIED are distinct. Admin `generatedAt` is not a test date. Preserve the active `uomd-db-backups` bucket. Account deletion is **POST /api/v1/account/delete**; export is **GET /api/v1/account/export**.

### R01 — Material spending and shared transaction invariants

**Complete locally.** Shared stack spending handles missing/zero/insufficient/exact/multiple materials atomically; rejected work rolls back balances, growth, task counters and journals. Concurrency, retries and response-loss protections must survive future changes. See the material-spending regressions and registry; do not reintroduce UPDATE-only missing-stack admission.

### R02 — Purchases, subscriptions, refunds and RTDN

**Partial; local A–F slices delivered.** Server verification, immutable original benefits, acknowledgement/consume/refund/entitlement fences, OIDC RTDN inbox, encrypted durable pending work, bounded Cron and viewer reconciliation are implemented. `BILLING_TOKEN_KEYS` is an environment-specific game Worker secret; retain old decrypt keys during rotation. Earned subscription terms/grant definitions survive catalog edits/removal and do not become void outside a sale calendar.

Remaining: use [billing/POLICY_REVIEW](docs/billing/POLICY_REVIEW.md) to resolve legacy/half-completed fulfillment, claimed periodic benefits, noncurrency/partial refunds, unrecoverable balances and period/cadence/hold policy. Do not reconstruct old terms from today's catalog or mutate historical balances as an unapproved repair. Complete native localized product/base-plan/offer/benefit-version binding in R11. Verify actual Google permissions, linked-token/ack timing, live keyring/Cron/RTDN and scheduled backlog capacity, then physical Play sandbox in R18. Nominal 60×12-hour/30-day wording is not proof of every accelerated/calendar plan's promise; final quantities remain R16.

**Accept when:** duplicate/out-of-order notifications, pending/cancel/grace/hold/pause/recovery/expiry, response loss, refund/claim/deletion races converge to the approved original journal/ledger/entitlement result. Policy approval and live/device evidence stay separate from local tests.

### R03 — Generation, publication and reward release authority

**Complete locally (A–C).** Persisted per-channel generation/tombstone, signed retained-state validation, atomic publication/pointer/audit and transaction-time account/economic fences are implemented. Existing frozen battle sessions keep their two-hour grace; bounded 24-hour canary/manual allowlists and kill floor apply. Kill/revocation cannot be bypassed by new economic writes. Original committed results remain recoverable. Keep the deployment/native checks in R17/R18; complete local storage deletion can erase local authority, so server admission remains necessary.

### R04 — Free-repeat rewards and cross-source duplicates

**Complete locally (A–C).** Original-copy concurrency guards and immutable future grant effects preserve one payout across pity and shared sources. Zero-cost fixed battles cannot farm repeat rewards; legitimate Ration-paid repeats and configured finite milestones retain their contract. Historical provenance is not fabricated. Preserve these invariants; final free supply/recovery/boss-repeat quantities remain R16.

### R05 — Durable client retry and operation status

**Partial.** Account-bound durable request identities and original-status recovery cover story, recruit/growth/gear/gacha and major battle/claim operations; Saved Actions and bounded purchase history support reload without resubmitting committed intent. Check actual source coverage rather than assuming all operations are covered.

Inventory every mutation against a fault matrix: entry checkpoints, task/mail/ad claims, native purchases and cross-scene/account changes. Persist the original input/request/release/account until authoritative reconciliation; distinguish a new player action from retry. Provide pending/confirmed/rejected state, useful retry and history. Native storage/lifecycle and startup/resume/reinstall store reconciliation remain R11/R18.

**Accept when:** committed response loss, force-stop/reload, repeated taps and account switches yield one debit/grant, no stale-account replay and no false success.

### R06 — Combat semantics, equipment, loans and compatible limits

**Partial; A–D2 delivered locally.** One-turn control and boss-aware Auto are corrected. Supported progression/gear config stays battle-admissible. Owned story guests use their copy/equipment once; unowned guests use canonical virtual rarity-3 loans with deterministic CRC32 accessory seeds without inventory minting. Frozen supported outgoing-heal/normal-action-Focus bonuses replay consistently. Undefined authored signature passives are disclosed and rejected for new equip/battle while old instances remain removable and frozen sessions preserve their contract.

Remaining: version status/DoT/regen/cooldown/event/RNG order and rounding; resolve effect/element resistance, redirect precedence, Soaked/Soul Link, lowest-HP meaning, shield copy, fresh-bar phases/objective hits and source text overrides. [OPS_SPEC](docs/combat/OPS_SPEC.md) and C01–C39 vectors are proposals, not applied decisions. Retain explicit signature rejection until reviewed finite ops/magnitudes exist. Sold supported effects must execute; never silently ignore one. No numeric retuning to hide a semantic bug.

**Accept when:** hand-checkable control/Auto/expiry/proc vectors and client/server replay agree; valid growth cannot create an inadmissible party; guest/recruit routes remain usable. Final difficulty belongs to R16.

### R07 — Canon compiler and semantic content validation

**Partial overall; A–C4 local source slices delivered.** Strict globally unique IDs, legal formations/roles/references, cycle checks, exact canon source/hash/line/order coverage, durable reward-free story completion, First Oath and reusable stable-ID spoiler/ownership/order gates are implemented. Main story and Archive coverage are listed in section 4. R08 supplies economic references/full data grammar.

Preserve the canonical chapter-1 music prefix, chapter-7 directions, both Construct phase interludes, no-spoiler locked titles and no-lore mechanical boss intents. Missing production media stays explicit/silent. Add relationship-voice/bestiary surfaces with the same gates when those screens arrive. Extend end-to-end chronological coverage beyond the existing single Iona/manual chapter proof. Default level-1 Auto lost 1-3 in that check; it is not an all-choice/all-Auto balance certificate. Durable post-battle continuity is R09; complete route/balance and device/media acceptance remain R16/R18.

**Accept when:** source coverage and rejected publication catch malformed/omitted content, chapter/recruit order is playable without gacha and every new surface respects stable IDs, spoilers and original-result recovery.

### R08 — Versioned effective catalog and full content grammar

**Source complete; LOCAL_TESTED (2026-10-14).** Detailed contracts: [R08_CONTENT_RUNTIME](docs/R08_CONTENT_RUNTIME.md), [CATALOG_SNAPSHOT](docs/CATALOG_SNAPSHOT.md), [CONTENT_RELEASE_CONTRACT](docs/CONTENT_RELEASE_CONTRACT.md), [PATCHING](docs/PATCHING.md).

- Complete signed snapshots select the same economic definitions on server/client; declared missing/corrupt data never falls back to editable tables. New identities recruit→grow→equip→summon→fight without copying definition rows into legacy tables.
- Migration 0026 preserves player foreign-key identities and gear sequence history. Migration 0027 freezes weekly task rules and grant subsets; earned mail, pending purchases and subscription periods honor original obligations after catalog loss. Missing/retired owned definitions keep safe view/remove/lock support.
- The temporary catalog activation block is removed. Publish/rollback probes the bound game Worker for matching environment/channel, catalog protocol/capabilities and migration 0027; unavailable/old backend fails before signing. Emergency kill remains available. Independently deploying admin first cannot prematurely enable a catalog.
- Client **0.1.2** and derived signed capabilities admit the finite presentation, voice/caption/video, locale, stage/camera/layer/mask/tween, boolean flag/checkpoint, sprite-animation, fixed notice and calendar grammar. Unknown JSON/ops/refs are rejected. Notices invoke only compiled actions; no downloaded executable code.
- Trust roots remain compiled P-256 public keys. Rotation to an already-embedded root is possible; add/remove/revoke root or primitive requires a new reviewed AAB. A content patch cannot install a new root or revoke an offline compiled key.
- Storage/transport enforce transaction-complete IDB v2, retained active/previous/staged/partial/reserved accounting, atomic GC/leases, quota protection, range resume, abort/deadline/retry and network consent. JSON/media caches have ownership/size limits and cleanup. Fast returning startup updates before art load or stages in the background with explicit restart.

Limits: 512 files, 25 MiB/object, 200 MiB signed/retained budget, 1 MiB/JSON and 8 MiB total JSON, 64-entry/8 MiB JSON LRU, 128 MiB managed media cost, 4096×4096/16M-pixel images. Managed memory excludes framebuffer/text/browser/codec overhead. Full-season publication needs a suitable paid Workers plan; local D1/R2 is not Free-plan/live capacity proof. Do not increase limits without measurements.

**Acceptance boundary:** final local evidence is recorded in section 4/registry. The original **signed unchanged AAB**, physical WebView faults/performance/codecs and deployed chapter/hero/boss/banner/event/media season remain mandatory R17/R18 acceptance. R09 account/release-scoped resume is not supplied by the bounded local source checkpoint.

### R09 — Entry, narrative continuity and returning-player flow

**Status 2026-10-18: items 1-5 implemented at local scope (D-26); item 6 reviewed in code (scene background preload, fade-then-start, team save before activation, error texts) without a reproduced gap; physical-device and deployed acceptance remain open.** Item 1: per-node tweens and an Animator that cancels the outgoing fade at the shot boundary (regression test, browser check of all nine shots, authored 120 s). Item 2: continuity contract v1 (device + cloud save, seq merge, scene-hash binding, release stamp, legacy migration, account isolation). Item 3: journal reconciliation of committed battles/stories before any replay. Item 4: Continue resolves the cursor or next campaign node (tutorial chapter excluded), title replay is a separate session-only mode. Item 5: Finish shows device-only / saving / not saved / saved states and re-pushes on open; a missing prologue shows TRY AGAIN / CONTINUE WITHOUT IT instead of silently marking it seen.

1. Reproduce and fix the nine-shot prologue's outgoing-caption tween lifecycle: the original Chromium audit saw second-shot body alpha 0. Measure visibility on every shot and actual whole-opening time. Authored holds total 120 seconds; historical overlap subtraction estimated 112.8 seconds. Define the overlap contract without shortening the intended experience. R08's optional whole-video path does not prove the plate path is fixed.
2. Design and implement durable **account + content/release + scene/line/choice** continuity with a versioned checkpoint contract. StoryRunner has save/load; R08 handles flags/branches/checkpoints and stores one bounded session snapshot. This is not a secure authoritative account-scoped resume system. Specify migration/incompatible release behavior, storage loss, pause/force-stop/offline, choices, read/skip state and stale-account isolation; keep rewards server-authoritative.
3. Resume a committed battle into its pending post-scene without replaying combat or granting rewards again. Reconcile the original request/session first; interruption before/during/after story completion must preserve the correct next action.
4. Replace completed-entry BEGIN's tutorial-first selection with authoritative campaign Continue/next-playable state. After the first successful restart, 1-1 remains unstarted and tutorial replay is a separate explicit action. New/returning/replaying accounts must not be conflated.
5. Finish must distinguish local save, cloud pending/failed and confirmed state. Keep first-entry staged activation at restart; native relaunch failure needs truthful retry/fallback. A missing mandatory prologue must not silently mark it seen. R08 already supplies fast returning update and a staged restart strip; preserve them.
6. Audit fades/background preload, team save-before-activation and useful errors against current code. R08 preloads commanded backgrounds and uses atomic team activation guards; reproduce any remaining UI sequencing gap before fixing it. Preserve no Skip/no speed/no battle Auto in entry and the normal-speed read Auto toggle.

**Accept when:** sign-in→visible authored opening→all manual tutorials/interscenes→durable Finish→verified patch/restart→campaign Continue plus mid-scene/post-battle resume pass desktop/touch and, in R18, physical Android. Test process interruption, post-commit response loss, offline/reconnect, rollback/incompatible content, repeated taps and account switch without lost/duplicate progress. Deliver code, tests, screenshots/evidence, docs and a verified local commit as one complete package.

### R10 — Layout review, safe areas and accessibility

**Claude Opus 5.5** maintains and ports the **A/current, B/arena-lite, C/AFK-faithful** battle layout candidates to Unity (`Uomd.Game`), including phone/desktop 2v2/5v5/boss/objective/summon cases, with locked chibi dimensions/pivots/background safe zones (`StreamingAssets/uomd_metadata/`). The owner has delegated routine design choices; prepare concrete alternatives when a substantial canon, budget or product decision needs review.

Apply actual `Screen.safeArea` insets/reflow to HUD, modals and touch zones, and responsive quality tiers (`high` / `medium` / `low`).

Wire stable EN string keys; implement text size/contrast/flash/reduced-motion preferences, physical-size touch targets, status shape cues and critical TalkBack/keyboard/focus semantics. Settings/privacy remain reachable before sign-in. Show exact material/currency costs, result/cap/rank/stats, remaining wallet, XP waste and affordability/gate reasons before growth actions.

Current visual debt observed during R08 inspection includes crowded companion growth/skill/rank/cost rows, temporary result toasts and provisional hero art. Fix these in the layout/polish pass; R08's functional media/animation assertions are not layout acceptance. Capture settled screens after transitions before choosing visual baselines.

**Accept when:** comparison artifacts are reviewable, the chosen contract is recorded, small/notched landscape devices remain readable/targetable, and core flows work under accessibility/lifecycle stress. Portrait-led final polish follows R15.

### R11 — Native identity, purchase recovery, privacy and release build

- Native Billing ignores asynchronous results without an active purchase call; one-time RTDN only notes completion and restoration runs only when Shop opens. Add startup/resume/background/pending/reinstall reconciliation, transient-versus-permanent error handling and safe backend retry.
- Use the existing ProductDetails/getProducts bridge in shop UI. Display localized price, selected base plan/offer, pricing phases, recurrence/trial terms and cancellation/restore paths before purchase; do not blindly choose the first offer or invent prices.
- Native secure session storage exists (AndroidKeyStore-backed bridge; legacy localStorage tokens are scrubbed on startup). Remaining: refresh/re-auth/revocation/account-switch recovery on device, and genuine web staging Google identity with configured credentials.
- Make UMP privacy options login-independent/reactive, including grant/refusal/withdrawal/offline retained state. Define approved age/TFUA/child-directed configuration; a teen ad-content rating alone is not an age/consent policy.
- Ad UI must track nonce/transaction-specific server pending/verified/rejected/test status. Unrelated wallet growth or a polling timeout cannot establish reward success; test-key callbacks intentionally do not mint real rewards.
- Inventory every collected/retained field and mutable table, including battle sessions, for full export/deletion/support and deletion-on-restore. Retain only justified financial/legal records under defined retention, with public privacy and deletion request routes.
- The instrumentation fixture now asserts the real package and bridge methods; it still does not exercise native interactions (sign-in, purchase, ad) — add those. Close Google executor/BillingClient connection lifecycle leaks.
- Make signing/environment/versionCode/test-ad/native SDK gates explicit and fail closed. A default staging endpoint, unsigned bundle or unintended live ad unit is not a store-ready release. Preserve the owner-held upload key; do not replace/recreate it.

**Accept when:** identity/store/consent recovery contracts are testable and release configuration is reproducible; the physical signed Play sandbox matrix in R18 verifies pending/completion/refund/renewal/reinstall/resume/deletion. Legal identity/contact/domain/retention/territories/Data Safety/IARC facts must be supplied, not invented.

### R12 — Required mode and progression foundations

Implement separate, complete slices sharing existing combat/ledger/grants:

- Sweep: server clear eligibility, reward/Ration/task accounting and repeated/concurrent claim limits.
- AFK: server-clock elapsed time, cap/checkpoint, offline return and idempotent claims.
- Achievements, unlock gates, event/season schedules and rewards; social/profile/leaderboard foundations.
- Async arena defense/match/season settlement and endless run/wave/modifier/snapshot mechanics.
- Multiwave admission/interpreter: current compiler takes only the first wave; all existing 35 stages are single-wave, but future extra waves must not disappear silently. Validate summons' tuning snapshot, scaling, reuse and formation slots.
- Character-bound Memory Shards' nonmandatory sink/excess/benefit policy. Do not turn them into another main currency or require duplicate pulls for story access.

**Accept when:** each mode executes a schema-valid example with authoritative results, abuse/concurrency/lifecycle tests and explicit compatibility. Launch locks may hide later content, not missing promised mechanisms. Do not add broad guild/chat scope without an approved need.

### R13 — Control Center workflow and authorization completion

Preserve the existing 13 pages, Access/JWT/RBAC/CSRF and audit foundation. Complete:

- Narrative Studio scene/VO/locale/spoiler preview and versioned Git canon reconciliation; design editing for skills/enemies/AI/bosses and staged simulations.
- LiveOps events/seasons/schedules/cohorts/mail/claims; Media Factory jobs/references/budget/quality approval; monetization entitlement/refund/ack/recovery/revenue reconciliation, ad placements/caps and consent reporting.
- Release composer: upload/build draft→semantic validation→file/config diff→compatible preview→approval→canary→adoption/error monitoring→rollback/kill. The owner should not need CLI choreography for normal publication.
- Sum premium attachments for owner thresholds: two 4,000-token attachments bypass the current per-attachment 5,000 check. Make mail/compensation grant and immutable admin audit atomic; preserve request replay.
- Product kind/version and banner state updates need truthful CAS/outcomes/audit; rejected/no-change writes must not claim a completed action.
- Bind owner-approved art to actual R2 hash/size/model/prompt/reference/cost/licence provenance. Operator-entered “approved” metadata or nonexistent object hashes cannot pass a store publication gate; pending preview media is explicit.
- Persist reviewable sensitive approval records and verify the actual Access MFA policy. Do not invent a second reviewer if there is only one owner.
- Add bounded cursor/filter/detail/export for characters/assets/releases/players/audit/purchases; measure/index/preaggregate expensive full-table polling so support can inspect complete history without runaway row scans.

**Accept when:** the owner can run a real scene/banner/event/media release and finance/support recovery through secure UI, with correct environment, authorization, version, audit and rollback evidence. Required dashboard/crash/revenue/privacy/security modules use real sources rather than decorative placeholders.

<a id="r14--google-media-budget-provenance-and-deterministic-ingest"></a>

### R14 — Media budget, provenance and deterministic ingest

Approved authority is [content/budget/media_budget.json](content/budget/media_budget.json): **1000 TL/month, recorded as $20/month, $3 per batch, at most three paid attempts per asset**. Recheck exchange/provider prices before spending so the owner's TL limit is respected; this is not zero budget or approval for a broad batch.

| Source media | Approved workflow |
| --- | --- |
| Portraits/chibi/backgrounds/UI | **Claude Opus 5.5** generates and integrates original assets exclusively via the **Google Gemini API** (`tools/gen_image.ts` + `tools/ingest_art.ts --by claude:art-director` + `npm run export:unity`); lock identity/reference/provenance (D-31). |
| BGM/themes/loops | **Claude Opus 5.5** owns production/integration via the **Google Gemini API / Lyria 3.5** (`tools/generate_phase1_music_lyria35.py`, `/v1beta/interactions`). |
| Dialogue | Reviewed Japanese transcript/casting bound to stable line IDs (`narrative/10_VO/Line_Maps/jp_script_vertical_slice_master.json`), generated by **Claude Opus 5.5** via **Gemini TTS** (`tools/record_game_vo.py`). |
| Cinematics | **Claude Opus 5.5** designs/animates/composites via the **Google Gemini API / Veo** and the shipped finite runtime; verify codec/export/licence. |
| SFX | **Claude Opus 5.5** manages SFX (`tools/build_sfx_pack.mjs` and Gemini audio synthesis), licence and provenance; deterministic local processing/export is allowed. |

The **2026-10-24 Decision D-31** handoff assigns 100% of engineering, Unity migration, and Gemini API asset production exclusively to **Claude Opus 5.5** (superseding the 2026-10-14 D-21 and 2026-10-23 D-30 Argon assignments). The existing budget (`content/budget/media_budget.json`) remains unchanged. Before any paid Gemini API call, verify actual model/version, request shape, quota, price and licence. Keys remain in `.env` (`GEMINI_API_KEY`) or server-side stores and must never be printed or committed. Workflow: dry-run→conservative durable **per-call** reservation→bounded call→sanitized usage/outcome/provenance→visual review→settlement/upload/manifest.

Fix unlocked JSON read-modify-write reservations, count>1 calls sharing one “attempt,” canceled/timeout attempts disappearing from the cap, unknown provider charges, last-call-only usage and missing partial-output sidecars. Persist/reconcile accepted-but-uncertain calls; changing a failed prompt is required after the retry cap. Test concurrency/crash/timeout/partial success offline without spending.

**tools/ingest_art.ts** and `build_content.ts --strict-art/--require-approved` exist. `build_content.ts` no longer deletes authored media (voices/, presentation/, Lyria tracks) and `npm run check:content` proves the committed base content is reproduced byte for byte (restoring it if not). Remaining: the base still contains legacy archived Git art, so `--strict-art` fails until approved replacements exist; offline ingest/QC must deterministically key/slice/atlas/export with alpha/pivot/crop/reference similarity, codec/size/memory/licence/hash/provenance checks, approved-first builds and store rejection of placeholder/legacy/unapproved output. The Python media tools (Lyria/TTS) now reserve/settle every paid call through `tools/lib/media_budget.py`; they refuse to run until `UOMD_EST_USD_<KIND>` holds a verified price. Spending before 2026-10-18 was never recorded in the ledger.

**Accept when:** every actual paid call consumes the correct budget/attempt, uncertain charges remain reserved until reconciled, all partial output has provenance, and reproducible offline ingest/strict-art can build approved media without calls or hidden overrides.

### R15 — Small visual pilot and character attachment

**Claude Opus 5.5** owns character/art direction, **Google Gemini API** image generation, animation, Unity UI/VFX and integration (D-31). All 25 playable heroes, 7 bosses, and 20 enemies now have approved 16-frame animated chibi sheets and VN portraits in `content/approved_art`; any remaining or future assets are generated via `tools/gen_image.ts` + `tools/ingest_art.ts --by claude:art-director` and exported to Unity via `npm run export:unity`.

Use locked character sheets/turnarounds/front-side-back, costume/weapon identity, expressions, texture/animation/audio cue maps and adult-age provenance. Compare similarity/hashes and inspect every result; do not borrow a mismatched body/hair/outfit/pose. Resolve current reference costume/hood-versus-cape and studio mark decisions through reviewable alternatives.

Polish portrait-led roster/character/team/summon reveal and restrained navigation/VFX around relationships and tactical roles, retaining rates/pity/history transparency and exact spending information. Preserve approved third-party engine credit/licences separately from generated project art.

**Accept when:** pilot identity/poses/alpha/pivots/readability/cohesion have reviewable acceptance evidence and perform on Android; required initial content no longer uses placeholder art. Broad campaign production stays patchable; initial polish must not wait for all future characters.

### R16 — Final balance, recovery floor and sound/VO production

Reward/fee quantities remain placeholders/proposals until the final math pass. [TUNING_PROPOSAL](docs/economy/TUNING_PROPOSAL.md) is **not applied approval**. Decide the unconditional supply/recovery source, real fee/reward changes, targeted material route availability and the final-boss repeat-5★ versus first-clear-only contradiction explicitly.

Replace averaged cash proxies with actual versioned fees, XP/material availability, account/ascension/story caps, skills/gear/loans, Ration/AFK/Sweep, daily/weekly claim windows, drops and pity timelines. Simulate chronological fresh accounts: all-in-wishes/balanced/no-pulls, no-ads, missed windows, caps and zero balance. Demonstrate recovery to an affordable next legal step within a daily cycle through predictable free sources; optional ads/subscriptions, winning blocked content or amortized weeklies cannot be its guaranteed floor.

Current campaign probes are smoke tests, not sequential feasibility: they may recruit after losing a preceding probe and omit actual gear/manual progression. Validate the full required story with no gacha gate and sensible manual/Auto challenge before signing off numeric balance.

Then produce final sound/music/VO/cinematic assets within R14's guard, as the owner requested. Establish voice mixer/cue/decoder/subtitle interfaces early, but record reviewed Japanese transcripts/name readings/casting rather than feeding English dialogue into a Japanese voice. Bind subtitles and cues to stable IDs, measure video/audio encoding, looping, pause/resume/ducking and device decoder behavior.

**Accept when:** actual-config sequential playthrough/simulator conservation/material gates are viable, desired no-ad recovery holds, cost/result UX matches authoritative values and reviewed audio/media work with the complete runtime on target devices.

### R17 — Telemetry, capacity, build and encrypted recovery

Use actual Cloudflare rows read/written/query/CPU/p95/error/storage/cost data and native crash/performance, player retention, actual revenue and patch download/adoption metrics. Existing error/callback logging and “usage not connected” states are retained; do not derive nonexistent successful-request SLO/revenue charts from incomplete logs.

Measure expensive dashboard/monitoring scans, large content validation and exports. Backup currently loads SELECT * before enforcing its row cap; use bounded/streamed consistent export and scale proof. Keep healthy-state reconciliation and appropriate forensic handling of an unhealthy dataset.

Complete encrypted full restore with the **owner-held age private key**, compare hashes/table/FK/ledger consistency, restore duration and RPO/RTO; a prior deleted plaintext-probe drill is not encrypted production recovery proof. Include D1 Time Travel recovery and periodic exports within the applicable provider limits. Define R2 retention/lifecycle, privacy deletion-on-restore and periodic recovery rehearsal; no substitute new key.

Service-binding admin 401 proves in-app auth, not Access-edge/MFA protection. Add independent authorized external health/alert coverage with tested delivery/escalation and an owner-chosen destination. Do not auto-send Slack/email or create new permissions to claim an alert works.

Record/reproduce live Workers Builds settings, test/content/build gates, tags, path filters and single migration owner. Add isolated PR preview datasets plus native/emulator/E2E gates through the current approved pipeline; snapshot/live configuration requires actual read permission.

**Accept when:** bounded operations meet measured capacity/SLO/cost targets, encrypted recovery and alert delivery are demonstrated, deployment evidence maps to the exact code version and outages do not silently depend solely on the failing application database.

### R18 — First-store-AAB acceptance and public release

Before store submission, every required capability has functioning code and evidence. Use a reproducible, explicitly configured, signed native build with a strictly increasing version code. Run emulator **and physical Android** checks; a desktop/touch viewport is not hardware acceptance.

| Gate | Required proof |
| --- | --- |
| Identity/save/privacy | Real Google subject mapping, expiry/revocation/re-auth, reinstall/account switch/deletion and lifecycle/cloud checkpoints; UMP grant/refuse/withdraw and accurate public privacy/deletion/Data Safety/IARC. |
| Financial correctness | Physical signed Play sandbox one-time/subscription/pending/ack/refund/cancel/hold/grace/recovery/RTDN replay; verified rewarded test-ad/SSV flows, consent/caps and one authoritative fulfillment. |
| Narrative/experience | Authored ~120-second opening, visible text, manual T-1/T-2/T-3/interscenes, Finish/download/restart, correct Continue and canonical no-gacha chapter flow. |
| Runtime/mechanics/admin | Required managers, locale/accessibility/audio/chibi/cinematic grammar, 5v5 and complete promised mode foundations, secure operational Control Center and audited server economy. |
| Unchanged-AAB season | Record original signed AAB checksum. Apply **one data-only season** with new chapter, playable hero/chibi animation, boss, limited banner, event, cinematic/music and balance, to that same unchanged AAB. Prove recruit/growth/equip/authoritative battle and compatible backend catalog. |
| Fault/performance | Low storage, corrupt hash/signature, partial download, offline, force-stop/restart, context loss, rollback/kill, long sessions, cold start/memory/frame pacing and device codecs; 60 FPS is a measured target where feasible, not a fabricated claim. |
| Ops/security | Current authorized Cloudflare source/deploy evidence, least privilege/MFA/source and relevant security audit, cost/health/crash/patch alerts, encrypted restore/retention and CI/build gates. |
| Store rollout | Internal test → any required closed test → owner-approved staged production. Publishing a public Play build and creating production remain separate approval gates. |

Review [QA_ANDROID](docs/QA_ANDROID.md) against these gates and current decisions. Mocked external services, green unit tests, a produced AAB file or a past preview do not close device/store gates.

## 7. Claude Opus 5.5 Exclusive Ownership & Unity Migration Handoff (D-31)

**Owner assignment dated 2026-10-24 (Decision D-31):** 100% of project operations, architecture, engineering, Unity engine migration (`apps/unity/`), and Gemini API creative asset production are transferred exclusively to **Claude Opus 5.5** (`claude-opus-5-5` / Claude Code). Argon 4 / Antigravity and Codex are retired from active ownership; only Claude Opus 5.5 operates on the repository from now on. Read the complete technical handoff and Unity 6 LTS architecture blueprint in [docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md](docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md). (Historical 2026-10-14 Argon handoff notes below are retained as historical audit context only and are superseded by D-31.)

| Delivery/checkpoint | Revision and meaning |
| --- | --- |
| R08 implementation | `a181a92248beacadf6bfb0444032943b057adea0` — completed application/source and local verification. |
| Final README/handoff | The enclosing documentation commit; find with `git log -1 -- README.md`. No R09 implementation is included. |
| Main integration | Both deliveries were fast-forward pushes to `origin/main`; confirm current remote before resuming. |
| External acceptance | Not refreshed by either push. Workers Builds may trigger; deployed tags, private provider access and physical AAB acceptance require observation. |

### Claude Opus 5.5's Execution Workflow (D-31)

1. Read this entire file, `CLAUDE.md`, [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md), and the Unity master blueprint [docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md](docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md). Work exclusively in `E:\Unity` on `main`.
2. Verify `.env` (`GEMINI_API_KEY` present; never print its value), Node 22+, Unity 6 LTS (`6000.0.x`), and `npm run export:unity`.
3. Execute Phases `U-1` through `U-6` in [docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md](docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md): scaffold `apps/unity/` with modular `.asmdef` assemblies, port `@uomd/combat` (`Mulberry32Rng` + `RoundHalfUp` bit-exact server replay parity), `@uomd/story`, `@uomd/patch` (`ECDsa` P-256), and `@uomd/economy` to C#, port all 28 scenes from the handed-over legacy `apps/game` reference oracle to Unity URP 2D + UI Toolkit / TextMeshPro, migrate the 4 Android Java plugins (`Assets/Plugins/Android/`), and archive `apps/game` + `apps/android` into `archive/legacy-web-era` in Phase `U-6`.

### Whole-game creative and animation responsibility (Claude Opus 5.5 + Gemini API)

**Claude Opus 5.5** owns the complete Gothic-anime visual and audio system from the canon brief: typography, palette, ornament, navigation, tactical readability, portrait/character identity, chibi proportions, backgrounds, nine opening shots, stills, skill/boss VFX (`vfx_presets.json`), summon reveal and motion/audio rhythm. All remaining and future images, BGM tracks, and Japanese voice lines are generated exclusively via the **Google Gemini API** (`tools/gen_image.ts`, `tools/generate_phase1_music_lyria35.py`, `tools/record_game_vo.py`), ingested with `tools/ingest_art.ts --by claude:art-director`, built with `npm run build:content`, and exported to Unity with `npm run export:unity`.

Keep character sheets, expressions, costumes, weapon handling, silhouettes, emotion/cue maps and adult-age provenance consistent. Store source references/prompts/model/version/cost/licence/hashes and approval/QC status. Never label a test pattern/tone or legacy placeholder as a final asset.

Routine design, Unity C# and TypeScript code, Gemini API asset preparation within `content/budget/media_budget.json`, verification and local commits are delegated to **Claude Opus 5.5**. Pushing verified work to `main`, which deploys staging through Workers Builds, is delegated to Claude Opus 5.5 under D-32. Preserve canon/provenance and the approved budget; bring a concrete result for substantial plot/identity changes, new spending/permissions, financial-policy decisions or public release. The user has not approved replacing the upload key, inventing legal facts or altering live player transactions.

### Verification and delivery discipline

1. Use a bounded vertical slice and meaningful regression tests for real correctness risks. Apply relevant pinned skills/current official APIs; preserve the **Unity 6 LTS (`apps/unity/`)** architecture (and keep legacy `apps/game` tests green until Phase U-6 archival), Android-first, D1-only, one currency, server authority and data-only patches.
2. Run checks appropriate to the actual changes (`npm run verify`, `npm run export:unity`, and Unity NUnit EditMode/PlayMode tests).
3. Inspect screenshots and actual UI/input/focus state, console/network, rollback/failure/account isolation. Never rebuild mutable content while an E2E stack reads it or run two stacks on the same ports/state.
4. Review the exact diff for unrelated edits/secrets, rerun the affected checks (`npm run verify`) and commit, then push to `main` (D-32: fetch, fast-forward only). Never deploy by hand. Report a deployment only after reading the Worker's actual version tag and behavior. Never rewrite history.
5. Update this README's current checkpoint, tracker/evidence, BUILD_STATE, INFRA_ROADMAP and NEXT_STEPS. Report in Turkish: completed behavior, commits ready for the owner to push, actual PASS/FAIL/BLOCKED/UNVERIFIED checks, evidence and next concrete task.

~~~sh
npm ci
npm run export:unity      # export content/base, bottom-left Unity sprite slices, and C# core primitives
npm run verify            # lint + typecheck + all tests + content drift check (the deploy gate)
npm run lint
npm run typecheck
npm test
npm run check:content     # rebuilds content/base and proves it is byte-identical (restores it otherwise)
npm run build:campaign
npm run build
python3 tools/sync_codex_skills.py --check
# When changing Python/skill tooling:
python3 -m unittest discover -s tools/tests -p 'test_*.py'
# Refresh structural navigation after source/new-file changes; no LLM calls:
bash tools/build_graph.sh
~~~

Node **22+**, Unity **6000.0 LTS**, pinned npm lockfile and workspace-local dependencies are required. E2E uses disposable local D1/R2, all 29 migrations, ephemeral signing/auth test keys and real game/admin service bindings. It must not point to production or real provider accounts. `.cache/` contains local bundles/screenshots and is git-ignored. Trace archives can include ephemeral auth data; do not publish them or private tokens.

### Real external inputs and gates

Prepare concrete reviewable work before requesting missing information; continue independent work.

| Input | Required facts/action |
| --- | --- |
| Gemini API / media | `GEMINI_API_KEY` in `.env` (server/local tool use only, never printed or committed) and safe R14 reservation/ingest under `content/budget/media_budget.json`. |
| Identity | Real Android/Web OAuth IDs, consent, package and signing SHA-1s; presence in a file does not prove usable credentials. |
| Play/Billing | Products/base plans/offers/testers/internal track; `PLAY_PACKAGE_NAME`, `RTDN_AUDIENCE`, `RTDN_PUSH_SERVICE_ACCOUNT`, secure `GOOGLE_PLAY_SERVICE_ACCOUNT` and `BILLING_TOKEN_KEYS`. |
| Ads/consent | Test/live AdMob IDs, SSV/app-ads.txt and actual approved audience/consent/withdrawal policy. |
| Native signing/device | Existing owner-held upload key and secure `UOMD_KEYSTORE_FILE/PASSWORD/KEY_ALIAS`, approved environment/versionCode, emulator and physical Android/Play sandbox. Do not recreate a key. |
| Policy/legal | Unapplied refund/reward/shard/combat decisions; actual operator/contact/domain/retention/deletion/Data Safety/IARC facts. |
| Operations/release | Authorized Cloudflare read/deploy evidence, owner-held age key for encrypted restore, approved alert destination and separate production/public Play approval after R18. |

Secrets remain in approved host/Worker stores. Report missing setting name, console, minimum scope and environment; never ask for a password/private key in chat or commit credentials. [SECRETS_AND_PERMISSIONS](docs/SECRETS_AND_PERMISSIONS.md) is the detailed map. [AAB_ACCESS_PLAN](docs/AAB_ACCESS_PLAN.md) includes history and obsolete Actions assumptions; revalidate actual access.

## 8. Skills, pinned tooling and reference map

**Skills, MCP and Unity Handoff (2026-10-24, Decision D-31).** Claude Opus 5.5 uses the 121 skills in `.claude/skills/` (including Everything Claude Code ECC 2.2.3, Cloudflare/D1 LiveOps, security-audit, google-anime-media, ponytail, graphify, and ui-ux-pro-max) plus [docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md](docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md). The earlier D-23/D-25 web-stage skills in `.claude/skills/` remain locked in `.claude/skills-lock.json` solely for read-only `skills_doctor.py` / `sync_codex_skills.py --check` checksum integrity while `apps/game` serves as the handed-over behavioral oracle during the Unity port. Project MCPs in `.mcp.json` are `graphify` (`tools/build_graph.sh`) and `chrome-devtools` (`tools/mcp_chrome_devtools.mjs`, for Control Center & reference inspection).

**Historical Google Drive constraints (historical; the working copy is local `E:\Unity` since 2026-10-25 (`E:\Unity` before), where plain `npm ci` works).** Use `node tools/link_workspaces.mjs` if workspace links ever need refreshing (`--check` verifies).

Claude skills are in `.claude/skills/`; adapters are in `.agents/skills/`. Read relevant `SKILL.md` and linked canonical sources, not an entire catalog by keyword. Preserve Claude files/bootstrap/lock/`.mcp.json`; validate with `python3 tools/sync_codex_skills.py --check` and `python3 tools/skills_doctor.py`.

The vetted source inventory has six ZIPs; ZIP presence is not installation or callable MCP. Use [tools/bootstrap_skills.py](tools/bootstrap_skills.py) and [tools/skills_doctor.py](tools/skills_doctor.py) for scoped verification/repair of checksums, licences and pinned revisions. Ponytail and Graphify remain high-priority; UI/UX Pro Max, Chrome DevTools and Cloudflare platform/security guidance are relevant when the task requires them. Apply the vetted pinned official security-audit workflow to assigned auth, payment, consent, D1, webhook, R2/patch, permissions, supply-chain and secret-handling changes; distinguish source findings from executed, authorized audit evidence. **Context7 is retired.**

**Historical tool setup, verified 2026-10-12 (previous host):** project MCPs enabled in `.codex/config.toml`; host trust configured for this repository. Native Codex discovery found 54 skills, all six Ponytail variants enabled, zero skill errors. Real stdio MCP calls passed: Graphify stats/query (2,705 nodes/6,771 edges/144 communities after SQL extraction), Chrome DevTools page creation and DOM evaluation on an isolated loopback page (30 tools). [build_graph.sh](tools/build_graph.sh) builds a free local code index with pinned SQL support and no LLM calls; canonical/media/vendor content is excluded, some Gradle/data constructs remain outside AST coverage. Index/report are Git-ignored, refreshed after source changes. These stdio checks do not prove tools were injected into an already-running chat; reload/restart the MCP client when required. [CODEX_SKILLS](docs/CODEX_SKILLS.md) records cache initialization and usage.

**R08 structural refresh (2026-10-14):** 3,404 nodes / 9,046 edges / 185 communities after staging new files, zero LLM calls. Its metadata records the pre-delivery base `0f2f3f11` plus the R08 working tree; stage/task navigation was checked against source. Content exclusions and incomplete Gradle/test-symbol extraction limit coverage. The ignored index may not transfer to Antigravity; regenerate it in the new checkout and verify findings against current source.

Research useful official/proven Phaser/TypeScript/D1/Workers/Capacitor/animation/audio/Play Billing/AdMob/Google/QA skills when they improve the assigned task. Inspect source, version, maintenance/licence, compatibility, duplicate instructions and executable risk; pin provenance. Documentation-only additions may proceed as reviewable work. New code-executing hooks/MCP permissions or paid services require their applicable approval; never blindly install a catalog or another engine's guidance.

Supporting records below are details/evidence/proposals. If they conflict with this README, current owner instructions, actual code or newer evidence, mark the conflict and correct the support record rather than silently changing approved decisions.

| Subject | Records |
| --- | --- |
| Canon/opening/spoilers | [narrative/00_Canon](narrative/00_Canon/), [Opening_Tutorial](narrative/02_Main_Story/Opening_Tutorial/), [spoiler policy](narrative/00_Canon/SPOILER_UNLOCK_POLICY.md), narrative/09_VN_Scripts/Runtime_Snapshot. |
| State/history | [BUILD_STATE](docs/BUILD_STATE.md), [DECISIONS](docs/DECISIONS.md), [GAME_FLOW](docs/GAME_FLOW.md), [DEV_TRACKER](docs/DEV_TRACKER.json), [INFRA_ROADMAP](docs/INFRA_ROADMAP.md), [handoff questions](docs/handoff/QUESTIONS.md). |
| Combat/economy | [COMBAT_RULES](docs/COMBAT_RULES.md), [OPS_SPEC/vectors](docs/combat/OPS_SPEC.md), [campaign probe](docs/combat/CAMPAIGN_BALANCE.md), [single-currency model](docs/ECONOMY_SINGLE_CURRENCY.md), [tuning proposal](docs/economy/TUNING_PROPOSAL.md). |
| Delivery/security | [ARCHITECTURE](docs/ARCHITECTURE.md), [PATCHING](docs/PATCHING.md), [MONITORING](docs/MONITORING.md), [RUNBOOK](docs/RUNBOOK.md), [QA_ANDROID](docs/QA_ANDROID.md), [secrets/permissions](docs/SECRETS_AND_PERMISSIONS.md), [source security review](docs/SECURITY_REVIEW_2026-10-10.md). |
| Media/locales/store | [ART_BIBLE](docs/media/ART_BIBLE.md), [EXPORT_PIPELINE](docs/media/EXPORT_PIPELINE.md), [media queue](docs/media/QUEUE.md), [string catalog](docs/i18n/STRINGS.md), [store drafts](docs/store/README.md), [THIRD_PARTY](docs/THIRD_PARTY.md). |
| Agent/tool coordination | [AGENTS](AGENTS.md), [CLAUDE](CLAUDE.md), [CODEX_SKILLS](docs/CODEX_SKILLS.md), [skill source inventory](skill-sources/README.md), [review-first template](docs/NEW_SESSION_PROJECT_REVIEW.md) only when that workflow is requested. |
