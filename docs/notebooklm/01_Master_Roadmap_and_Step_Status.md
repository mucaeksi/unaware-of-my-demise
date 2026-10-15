# 01 — Unaware of My Demise: Master Gacha Transformation Roadmap & Step Status

## 1. Executive Summary & Base AAB vs. Patch Boundary
- **Genre & Platform:** Dark Gothic Anime 5v5 Tactical Turn-Based Gacha RPG built on **Phaser 4 (v4.0.0-rc.7)** + **Capacitor Android/iOS** + **Cloudflare Workers / D1 / R2 LiveOps**.
- **Base AAB Scope (< 150 MB Google Play Asset Delivery ceiling):**
  1. **SplashScene:** Phaser 4 emblem reveal.
  2. **StudioScene:** SovTaym Studios bespoke dark-gothic celestial astrolabe mark (`ui_studio_mark.webp`) with rotating filigree rings and ember particles.
  3. **TitleScene:** Full-screen 16:9 dark gothic anime key art (`ui_title_bg.webp`) featuring canonical Fadyme & Mahmut, atmospheric ash drift, and a single breathing `TAP TO CONTINUE` prompt (no cluttered menu buttons).
  4. **Background Patch Start:** The moment the player taps `TAP TO CONTINUE`, `Services.patches.start()` begins downloading and verifying the signed Ed25519 LiveOps patch manifest (`manifest.sig`) in the background while the player experiences the opening sequence.
  5. **PrologueScene (120s "Before the Road"):** 9 bespoke 16:9 dark gothic anime cinematic plates (`still_prologue_*`) with clean typography and zero scene-number clutter.
  6. **3-Part Tutorial (`T-1`, `T-2`, `T-3`) & 6 Cutscenes:**
     - `tutorial_t1_before` $\rightarrow$ Battle `T-1: The First Step` $\rightarrow$ `tutorial_t1_after`
     - `tutorial_t2_before` $\rightarrow$ Battle `T-2: A Road Forgotten` $\rightarrow$ `tutorial_t2_after` (with full-screen event CG `still_roadside_rest.webp`)
     - `tutorial_t3_before` $\rightarrow$ Battle `T-3: A Roof Before Dawn` $\rightarrow$ `tutorial_t3_after` (with full-screen event CG `still_shelter_evening.webp`)
  7. **FinishScene ("The Road Opens"):** Confirms background patch completion and presents the explicit `RESTART & ENTER GAME` button, which saves the server entry checkpoint and restarts the client into the full patched gacha game (`HomeScene` / Sanctum Hub).

## 2. Six-Step Transformation Roadmap
- **Adım 1 (Completed):** Opening sequence (`SplashScene` $\rightarrow$ `StudioScene` $\rightarrow$ `TitleScene` $\rightarrow$ 120s 9-scene `PrologueScene`), background patch trigger on first tap, and 100% template-faithful Fadyme & Mahmut key art and prologue illustrations.
- **Adım 2 (Completed):** 3-Part Tutorial (`T-1..T-3`), 6 narrative cutscenes, template-faithful event CGs (`roadside_rest`, `shelter_evening`), dark gothic anime Chibi battle sheets for heroes (`fadyme`, `mahmut`) and enemies (`bellbound_dead`, `hollow_pilgrim`), staggered AFK-Faithful 5v5 formation without UI overlap, and `FinishScene` restart flow.
- **Adım 3 (Next):** Online Gacha Main Hub (`HomeScene` / Sanctum), Live Banner Summon (`SummonScene` / "First Oath"), 20-Hero Roster & 4-Tab Growth (`CharacterScene`), Shop, Mail, and Daily/Weekly Tasks.
- **Adım 4:** Chapters 1–8 Campaign Map (`ChaptersScene`), Endless Corridor, Patrol idle rewards, and Boss Encounters.
- **Adım 5:** Audio & Cinematics — Google Flow (Veo 3.1) animated cutscenes, Lyria dark gothic BGM loops, and Chirp 3 HD voice packs.
- **Adım 6:** Admin Control Center (`apps/admin`), Cloudflare D1/R2 LiveOps publishing, and Android Release AAB verification.
