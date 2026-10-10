# Unaware of My Demise — Master Development Prompt
**Gothic anime gacha RPG · Phaser 4 · 2026-10-10**

> **Claude Code: read this entire README at the start of each substantial task.**
> This README is the **only authoritative engineering master prompt**. The canonical fiction, scripts, characters, chronology and spoilers live in `narrative/`. Neither source may be silently rewritten. `CLAUDE.md` is only an entry-point pointer, not an alternative specification.

## Mission and working rules
You are the project's lead engineer, game architect, technical artist, asset-pipeline developer, admin-panel engineer and automated tester. The owner approves artistic, monetary and publishing decisions. The game must be a coherent premium-feeling Gothic Dark Fantasy **anime**, not a generic browser demo. Develop in GitHub with reviewable commits, playable browser previews, test evidence, screenshots where appropriate and changelogs. Do not delete old Godot/narrative material or invent canon. Protect secrets and the owner's existing work. **Begin with an audit before migration.**

## Approved game identity
- **FIRST AND PRIMARY RELEASE: Android through Google Play Store** (signed AAB, Google Play Console). Browser builds are internal **development, QA and owner preview**, not a separate public platform launch. **iOS and Steam are future expansion targets only**, NOT priorities or first-release acceptance gates. Keep portable domain/gameplay code and identity mapping for future platform migration, without delaying Google Play.
- Mobile **landscape**. Responsive **1920×1080 reference coordinates**; adaptive rendering and safe-area handling.
- Main combat: **5v5 turn-based tactical team RPG** with manual targeting, skills, ultimate, status effects, bosses, deterministic core, **Auto Battle**, **Sweep** and server-calculated **AFK rewards**.
- Artistic format: detailed painterly gothic-anime portraits and consistent **chibi battle units**, sophisticated ornamental UI, atmospheric locations, restrained transitions and narrative-first staging.
- Style references (principles only, **never copy assets**): *Heaven Burns Red* (relationships/story rhythm), *Reverse: 1999* (visual treatment), *AFK Arena* (convenience), *BrownDust2* (tactical readability), *Morimens* (later replayability).
- The existing `narrative/` is authoritative for Part I (~7 chapters / 20 playable characters; **verify actual files and IDs**), antagonists, scripts, canon and dialogue. **Story access must never require winning a gacha character**; use guest units when appropriate.

## Approved implementation stack
- Game: **Phaser 4.2.1 initially pinned**, TypeScript strict, Vite, responsive WebGL scenes, tested Spine and optional Live2D integration only after SDK/license review.
- Mobile: Capacitor 8 initially pinned; **Android AAB and Google Play release first**; native Android Google identity, Google Play Billing and AdMob integration must exist in the **first AAB**. iOS App Store packaging and Steam desktop distribution are later, separately approved projects. Keep future adapters possible but do not implement/release them ahead of Android.
- API: Cloudflare Workers + Hono; PostgreSQL at Neon through Cloudflare Hyperdrive; Drizzle ORM when validated; asset/update CDN Cloudflare R2; background jobs as needed.
- Management: separate **UOMD Control Center** web app in React + TypeScript, protected admin authentication/MFA and audit log.
- Production infrastructure, staging and pull-request preview must be separated; no production user data in preview.
- Suggested monorepo: `apps/game`, `apps/admin`, `apps/api`, `packages/shared`, `packages/combat`, `packages/content-schema`, `content`, `narrative`, `tools`, `tests`. **Audit first; do not destructive-restructure.**

## Approved launch platform, identity and monetization (OWNER DECISION — 2026-10-10)
**Launch order:** (1) **Android / Google Play Store**; (2) potential **iOS**; (3) potential **Steam**. Only Android is in the first release acceptance scope. Web is an owner/developer preview tool. Defer Apple signing, App Store purchase plumbing, desktop storefront integration and Steam-specific work until separate approval. Design a platform adapter interface now so future additions do not corrupt existing accounts or gameplay data.

**Google-only player login on Android:** present **Sign in with Google** as the **sole player sign-in method**. No email/password, Facebook, guest authentication, anonymous permanent progress accounts or other identity providers in the initial Android release. Use modern Android Credential Manager + Google ID token and validate token issuer/audience/expiry/signature on Cloudflare Workers. Persist a stable internal player ID keyed to Google's verified `sub` subject (not mutable email address); safely handle session refresh, revoked access, account deletion and account recovery. Google Play Games Services authentication is **optional platform identity for achievements and services, not a substitute for the in-game Google login**. Desktop/browser staging must exercise real Google web sign-in where configured; use isolated, explicit test-only identities in automated CI, never bypass live auth protections.

**Paid monetization is required from the first Android binary:**
- **Google AdMob** SDK for game advertisements: rewarded ads as default; optional non-disruptive interstitial placements only with owner approval. No forced ad inside emotional cutscenes, critical dialogue or tactical choice screens. Reward grants must be server-verified, idempotent and abuse-protected; SDK-mediated rewards are never minted solely from untrusted Phaser state.
- **Google Play Billing** for digital in-game **Shop**, premium currency packs, bundles, one-time purchases and **recurring subscriptions** (e.g., approved monthly benefits or ad-free privileges), within applicable regional billing requirements. Google Play Console owns real payment products, pricing, plans and purchase/subscription life cycles; UOMD Control Center manages in-game catalog mappings, entitlements, reward tables, availability and audit trails.
- Back-end via Cloudflare must verify purchases using the **Google Play Developer API**, handle pending/cancelled/refunded transactions, consumable processing and acknowledgement, deduplicated fulfillment, subscription renewals and expiration, grace/hold states and **Real-time Developer Notifications** from Google Cloud Pub/Sub. Never credit currency, premium goods or subscription access before server confirmation.
- **Google User Messaging Platform (UMP)** consent flow and applicable GDPR/EEA/UK/Swiss and age/child-directed advertising safeguards, user privacy disclosures, Google Play Data safety declaration, user-initiated account/data deletion, and appropriate ad frequency limits. Follow current Google Play/AdMob policies and local laws.
- Revenue and monetization analytics should reconcile Google Play/AdMob source information with Cloudflare-side entitlement, ledger and event records. The backend, not a Google Analytics dashboard, remains authoritative for player inventory/economy.
- First-AAB acceptance must include **real Android sandbox tests** of Google sign-in, purchase, recurring subscription, refund/cancel/pending paths, reward ads, UMP and offline/resume; **web mockups do not count**. Do not hardcode test credentials.

**Future storefront caveat:** iOS may require an additional equivalent login option under App Store Review Guideline 4.8 when Google Sign-In is used; Apple billing and Steam billing have their own rules. Therefore **Google-only login and Google-only checkout are Android launch decisions, not a promise that future iOS/Steam can ship unchanged**. Keep accounts and entitlements platform-independent so users can retain their progress.

## Database decision and Cloudflare D1 evaluation (2026-10-10)
**Current approved production database remains Neon PostgreSQL**, accessed from Cloudflare Workers through Hyperdrive. Cloudflare Workers, R2, previews, queues and admin hosting remain on Cloudflare. **Do not silently migrate Neon or change database dialect without owner approval.**

Owner preference: where viable, it would be ideal to keep the SQL database **inside Cloudflare** as well. Evaluate **Cloudflare D1 (SQLite)** before data model/production database lock-in. D1 connects directly to Workers, has attractive usage-based billing and may simplify administration, but it is **not a drop-in PostgreSQL replacement**:
- D1 currently has a **10 GB per-database limit on paid Workers plans**, and each database processes statements serially; high-write concurrency, premium currency/gacha ledger throughput and hot accounts require realistic load testing or explicit sharding.
- D1 has transactional SQL batches, but PostgreSQL SQL features, migration tooling, data consistency, connection model and read-replica behavior differ. Compare transaction atomicity, ledger correctness under concurrency, failover, recovery, indexing and schema/ORM compatibility.
- Build a **repeatable benchmark** using representative login, summons, premium purchase fulfillment, subscription entitlement changes, reward claims, admin edits and leaderboard queries; compare correctness, peak concurrency, p95/p99 latency, price and operational maintenance between **D1 vs Neon**.
- Give the owner a concise decision report and recommended migration plan **before building live economy tables**. Unless the owner explicitly accepts the D1 proposal, implement **Neon PostgreSQL** as agreed. Use R2 for assets, not as a substitute for SQL ledger data.

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

**Before the first store binary is signed, fully implement and test these foundations** (no pretend scaffolds): Phaser scene/asset/audio/input managers; **Android Google-only player sign-in/cloud save (Credential Manager, server-validated Google identity, Play Games compatibility)**; account linking/recovery; story/dialogue/cinematic player (expressions, skip/replay, subtitles, choices, checkpoint, voice); character roster/stats/growth/skills/rarity/equipment; team building; 5v5 combat/AI/buffs/boss phases; AFK/Auto/Sweep; server-validated currency, inventory, gacha/pity/rates/history, **Google Play Billing shop + subscriptions (including RTDN/backend verification), Google AdMob rewarded advertisements, and UMP privacy/consent**; progression, quests, achievements, mail and rewards; event, arena and endless-mode extensible mechanics; social/profile/leaderboard foundations; localization/accessibility/settings; audio and chibi animation runtime; live-ops flags; game content schemas; telemetry/security; robust patch/download/cache/rollback and mobile lifecycle. Future modes may be initially locked but **their promised mechanics must actually work before initial AAB submission**.

**Content-first distribution:** immutable signed/versioned manifests for downloadable approved JSON, music, images, cinematics, animations, chapters, banners and other declarative configurations. Validate hashes/dependencies/client-version/asset licenses; atomic activation, resumable downloads, staging, rollback, offline/network failure. **No arbitrary downloaded JavaScript/native code or disguised code hot updates.** The owner wants to avoid a second AAB; **never promise that store/OS SDK requirements, security fixes or new native features cannot force a new release**, and do not bypass App Store policies.

## Combat and narrative contracts
Use typed, schema-validated, server-auditable mechanics; client visuals are not authority for currency, loot, gacha or progression. Data-driven enemies, boss triggers and skill effects must select from **precompiled permitted** effect types. Use deterministic battle tests, server acceptance, tamper protection and audit logs. Write `narrative/` → validated, versioned runtime JSON compilers; preserve line/character IDs, spoiler gates, guest-party provisions and localization. No invented canonical events.

## Control Center required areas
Dashboard/metrics/crashes; players and account moderation; currency transactions and compensations; playable character and enemy balance; gacha banners/rates/pity simulations; narrative scene/VO preview with GitHub canon reconciliation; quests, events and feature flags; Google AI prompt+asset generation queue with spending; R2 asset catalog; content patch staging/approval/publish/rollback; **Google Play Console product/subscription mapping, shop promotions, paid entitlements, refunds, rewarded-ad placement/caps, UMP consent status, revenue reconciliation, Google sign-in reports**; privacy and audit/security. Role-based access, MFA and approvals for sensitive changes; immutable audit records; no frontend database admin credentials.

## Web development and QA
Every meaningful PR must offer a functioning **Cloudflare game preview** and separate secure admin preview where possible, independent staging Neon/R2, CI typecheck/lint/tests, screenshots/Playwright browser smoke tests, Chrome DevTools network/console checks, performance budgets, mobile touch safe-area tests and **real Android device checks before Google Play release**. Add iOS hardware QA only in the separately approved iOS phase. Browser preview success ≠ mobile platform acceptance. Measure responsiveness, cold-start, memory, frame pacing, video/audio decoder support and long sessions.

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
7. **Android QA/hardening**: device testing, Google identity, AdMob+UMP, Google Play Billing subscriptions/products, purchase/refund/reward reconciliation, patch rollback and Google Play compliance.
8. **Google Play Android AAB release** only with owner approval. iOS and Steam follow as independent future planning/release tracks, not current milestones.

Every substantive result: cite file paths/commits, give preview link if deployed, show tests actually run, defects, unfinished items, cost and exact next step. Never fake a successful connection/build/test. Ask permission for real cloud spending, public release, sensitive mutations or destructive migrations. Proceed autonomously on ordinary reversible coding tasks.

**Initial directive:** Audit GitHub branch history and Narrative, discover verified project skills/MCP, report the skill matrix, initialize a testable Phaser web preview and secure admin shell. Do not overwrite canon, merge legacy code blindly or remove existing branches.
