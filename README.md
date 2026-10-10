# Unaware of My Demise — Master Development Prompt
**Gothic anime gacha RPG · Phaser 4 · 2026-10-10**

> **Claude Code: read this entire README at the start of each substantial task.**
> This README is the **only authoritative engineering master prompt**. The canonical fiction, scripts, characters, chronology and spoilers live in `narrative/`. Neither source may be silently rewritten. `CLAUDE.md` is only an entry-point pointer, not an alternative specification.

## Mission and working rules
You are the project's lead engineer, game architect, technical artist, asset-pipeline developer, admin-panel engineer and automated tester. The owner approves artistic, monetary and publishing decisions. The game must be a coherent premium-feeling Gothic Dark Fantasy **anime**, not a generic browser demo. Develop in GitHub with reviewable commits, playable browser previews, test evidence, screenshots where appropriate and changelogs. Do not delete old Godot/narrative material or invent canon. Protect secrets and the owner's existing work. **Begin with an audit before migration.**

## Approved game identity
- Platforms: Android and iOS, plus browser-playable previews. Mobile **landscape**. Responsive **1920×1080 reference coordinates**; adaptive rendering and safe-area handling.
- Main combat: **5v5 turn-based tactical team RPG** with manual targeting, skills, ultimate, status effects, bosses, deterministic core, **Auto Battle**, **Sweep** and server-calculated **AFK rewards**.
- Artistic format: detailed painterly gothic-anime portraits and consistent **chibi battle units**, sophisticated ornamental UI, atmospheric locations, restrained transitions and narrative-first staging.
- Style references (principles only, **never copy assets**): *Heaven Burns Red* (relationships/story rhythm), *Reverse: 1999* (visual treatment), *AFK Arena* (convenience), *BrownDust2* (tactical readability), *Morimens* (later replayability).
- The existing `narrative/` is authoritative for Part I (~7 chapters / 20 playable characters; **verify actual files and IDs**), antagonists, scripts, canon and dialogue. **Story access must never require winning a gacha character**; use guest units when appropriate.

## Approved implementation stack
- Game: **Phaser 4.2.1 initially pinned**, TypeScript strict, Vite, responsive WebGL scenes, tested Spine and optional Live2D integration only after SDK/license review.
- Mobile: Capacitor 8 initially pinned; Android App Bundle, separately packaged/signed iOS app, safe lifecycle, native purchasing, platform accessibility.
- API: Cloudflare Workers + Hono; PostgreSQL at Neon through Cloudflare Hyperdrive; Drizzle ORM when validated; asset/update CDN Cloudflare R2; background jobs as needed.
- Management: separate **UOMD Control Center** web app in React + TypeScript, protected admin authentication/MFA and audit log.
- Production infrastructure, staging and pull-request preview must be separated; no production user data in preview.
- Suggested monorepo: `apps/game`, `apps/admin`, `apps/api`, `packages/shared`, `packages/combat`, `packages/content-schema`, `content`, `narrative`, `tools`, `tests`. **Audit first; do not destructive-restructure.**

## Google-only generative media pipeline
Generate commissioned source media with Google services, then process/export locally without substituting a non-Google generative vendor.
- **Lyria 3.5**: BGM, character themes, event/boss scores and musical loops.
- **Chirp 3 HD**: spoken character dialogue. **Lyria is not dialogue TTS.**
- **Veo 3.1 Lite**: Gothic-anime cinematic shots; **prefer video-only/silent output only if the selected actual API supports it**. Inspect endpoint/price and obtain owner cost approval. Finish music, voice, effects separately.
- **Google Gemini image models**: portraits, chibi references, environments, costumes, promotional/UX assets. Retain per-character identity references and asset provenance. A flat image is **not** automatically a Spine/Live2D rig.
- Independent SFX: research a suitable verified **Google-based** workflow; do not pretend Lyria handles arbitrary SFX.
- Production queues require model/version, prompt, seed/reference when available, license/usage checks, visual review, cost estimates, retry caps, daily/monthly spending limits, upload to R2 and asset manifests.
- All generation API keys live server-side. Never expose them in game binaries or Git history.

## First Android AAB: extensive foundation, small initial content
**Player-facing first release:** coherent full UI and navigation, approximately **120-second anime opening**, **three tutorial sections with in-between cinematic scenes**, and a **Finish** completion/save flow. All story beats must come from Narrative.

**Before the first store binary is signed, fully implement and test these foundations** (no pretend scaffolds): Phaser scene/asset/audio/input managers; player authentication/cloud save; account linking/recovery; story/dialogue/cinematic player (expressions, skip/replay, subtitles, choices, checkpoint, voice); character roster/stats/growth/skills/rarity/equipment; team building; 5v5 combat/AI/buffs/boss phases; AFK/Auto/Sweep; server-validated currency, inventory, gacha/pity/rates/history and store payments; progression, quests, achievements, mail and rewards; event, arena and endless-mode extensible mechanics; social/profile/leaderboard foundations; localization/accessibility/settings; audio and chibi animation runtime; live-ops flags; game content schemas; telemetry/security; robust patch/download/cache/rollback and mobile lifecycle. Future modes may be initially locked but **their promised mechanics must actually work before initial AAB submission**.

**Content-first distribution:** immutable signed/versioned manifests for downloadable approved JSON, music, images, cinematics, animations, chapters, banners and other declarative configurations. Validate hashes/dependencies/client-version/asset licenses; atomic activation, resumable downloads, staging, rollback, offline/network failure. **No arbitrary downloaded JavaScript/native code or disguised code hot updates.** The owner wants to avoid a second AAB; **never promise that store/OS SDK requirements, security fixes or new native features cannot force a new release**, and do not bypass App Store policies.

## Combat and narrative contracts
Use typed, schema-validated, server-auditable mechanics; client visuals are not authority for currency, loot, gacha or progression. Data-driven enemies, boss triggers and skill effects must select from **precompiled permitted** effect types. Use deterministic battle tests, server acceptance, tamper protection and audit logs. Write `narrative/` → validated, versioned runtime JSON compilers; preserve line/character IDs, spoiler gates, guest-party provisions and localization. No invented canonical events.

## Control Center required areas
Dashboard/metrics/crashes; players and account moderation; currency transactions and compensations; playable character and enemy balance; gacha banners/rates/pity simulations; narrative scene/VO preview with GitHub canon reconciliation; quests, events and feature flags; Google AI prompt+asset generation queue with spending; R2 asset catalog; content patch staging/approval/publish/rollback; native purchases, consent/privacy and audit/security. Role-based access, MFA and approvals for sensitive changes; immutable audit records; no frontend database admin credentials.

## Web development and QA
Every meaningful PR must offer a functioning **Cloudflare game preview** and separate secure admin preview where possible, independent staging Neon/R2, CI typecheck/lint/tests, screenshots/Playwright browser smoke tests, Chrome DevTools network/console checks, performance budgets, mobile touch safe-area tests and real Android/iOS checks before release. Browser preview success ≠ mobile platform acceptance. Measure responsiveness, cold-start, memory, frame pacing, video/audio decoder support and long sessions.

## Claude project skills, MCP and self-directed research
Project skills live in **`.claude/skills/`**, sourced from the approved, pinned ZIP archives and the **official Phaser `phaserjs/phaser` skills**. `.mcp.json` configures **Graphify (essential), Context7, Chrome DevTools**. **Ponytail (essential)** provides focused implementation and review; **UI/UX Pro Max** provides design quality. Do not enable third-party executable hooks without separate inspection/approval. Use the repository's `tools/bootstrap_skills.py` and `tools/skills_doctor.py` to install/verify. The original ZIPs may be stored in `skill-sources/`; **GitHub never automatically extracts ZIPs on its own**. CI bootstrap uses verified checksums and records a lock manifest. MCP packages still require Node/Python/uv, browser availability, permissions and real-call checks.

**Claude may actively research further useful skills** (official Phaser skills first; then proven Phaser 4, TypeScript, Cloudflare, Neon, Capacitor, Spine/Live2D, audio, playwright, security and Google media skills). Inspect the source, license, maintenance, compatibility, duplicates and malicious instruction/executable risk; pin an immutable revision and record provenance. Documentation-only skills can be proposed/added in reviewable branches after audit; third-party hooks, extra MCP permissions and installations with code execution require explicit owner approval. **Never auto-install everything from a catalog blindly.** Never use engine-specific Godot guidance for Phaser.

## Delivery phases and acceptance
0. **Audit** repo/branches/README/Narrative/skills/MCP/legacy. Determine which branch holds `narrative/`; do not claim it exists on `main` until verified. Report gaps and recovery route; don't force-reset or erase branches.
1. **Foundation** Phaser+TS game boot, secure Cloudflare API/Neon check, R2, GitHub CI and functioning browser/game+admin previews.
2. **Art/UX** consistent design tokens, navigation, 1920×1080 adaptive layout, aesthetic approval.
3. **Character pilot** one Narrative character from portrait→chibi→rig→animations→VO→browser/mobile validation.
4. **Combat pilot** real 5v5 turn-based encounter, Auto and boss-state tests.
5. **Narrative pilot** cinematic opener, three-scene tutorial, actual authored dialogue, Finish checkpoint.
6. **Complete underlying first-binary systems**, secure admin/patch/economy/gacha integrations and mode foundations.
7. **QA/hardening**, device testing, patch rollback and store compliance.
8. **Release** only with owner approval.

Every substantive result: cite file paths/commits, give preview link if deployed, show tests actually run, defects, unfinished items, cost and exact next step. Never fake a successful connection/build/test. Ask permission for real cloud spending, public release, sensitive mutations or destructive migrations. Proceed autonomously on ordinary reversible coding tasks.

**Initial directive:** Audit GitHub branch history and Narrative, discover verified project skills/MCP, report the skill matrix, initialize a testable Phaser web preview and secure admin shell. Do not overwrite canon, merge legacy code blindly or remove existing branches.
