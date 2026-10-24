# Claude Opus 5.5 — Full Project Handoff & Unity Engine Migration Blueprint (D-31, 2026-10-24)

**Owner decision D-31 (2026-10-24):** All project operations, engineering, architecture, game/UX/art direction, **Unity engine migration**, and **Gemini API asset production** are transferred **exclusively to Claude Opus 5.5 (`claude-opus-5-5` / Claude Code)**. Argon 4 / Antigravity and Codex are retired from active ownership; **only Claude Opus 5.5 works on this repository from now on**.

Read in this order at session start:
1. [CLAUDE.md](../../CLAUDE.md) (host entry point)
2. [README.md](../../README.md) (sole authoritative engineering & creative master prompt)
3. **This blueprint (`docs/handoff/CLAUDE_OPUS_UNITY_HANDOFF.md`)**
4. [DECISIONS.md](../DECISIONS.md), [NEXT_STEPS.md](../NEXT_STEPS.md), [RELEASE_ROADMAP.md](../RELEASE_ROADMAP.md), [ART_BIBLE.md](../media/ART_BIBLE.md), and [EXPORT_PIPELINE.md](../media/EXPORT_PIPELINE.md).

---

## 1. Executive Mandate & Non-Negotiable Rules (D-31)

1. **Sole Agent Ownership (`Claude Opus 5.5`)**:
   - Claude Opus 5.5 owns 100% of the repository (`F:\unaware-of-my-demise`): client migration to Unity (C#), backend maintenance (`apps/api`), admin Control Center (`apps/admin`), narrative canon upkeep (`narrative/`), content compilers (`tools/`), and all creative asset production via the **Gemini API**.
   - Reports to the owner are in **Turkish**; in-game player-facing text and technical code/docs are in **English**; spoken voiceovers are **reviewed Japanese**.
2. **Engine Migration to Unity (`apps/unity/`)**:
   - The game client is migrating from the PixiJS v8 + DOM/CSS + Capacitor 8 web-wrapper stack (`apps/game` + `apps/android`) to a **native Unity (C#, Unity 6 LTS, Universal Render Pipeline 2D)** project housed at `apps/unity/` (keeping `apps/game` intact as the verified reference oracle and behavioral specification during the port until Unity reaches full parity).
   - First public release target remains **Android via Google Play** (signed IL2CPP ARM64 `.aab`, package ID `io.github.mucaeksi.unawareofmydemise`, `1920×1080` landscape reference frame with dynamic safe areas).
3. **Exclusive Gemini API Asset Production by Claude Opus 5.5**:
   - Claude Opus 5.5 generates all remaining and future visual, musical, voiceover, and cinematic assets directly through the **Google Gemini API (`https://generativelanguage.googleapis.com`)** using `GEMINI_API_KEY` (configured in `.env` / environment) and the repository's deterministic budget-guarded tools (`tools/gen_image.ts`, `tools/media_budget.ts`, `tools/lib/media_budget.py`, `tools/ingest_art.ts`, `tools/generate_phase1_music_lyria35.py`, `tools/record_game_vo.py`).
   - Respect `content/budget/media_budget.json` (**1000 TL / $20 USD per month**, **$3 USD per batch cap**, **max 3 paid attempts per asset**). Every paid call must reserve budget before execution and settle/fail afterward.
4. **Delivery & Git Discipline (D-28)**:
   - Work only in `F:\unaware-of-my-demise` on `main`.
   - Before every commit, run `npm run verify` (`lint` + `typecheck` + `test` + `check:content`).
   - Commit only the files you changed (`git add <paths>`, never `git add -A`).
   - **Never run `git push` or `wrangler deploy` by hand.** The owner pushes `main` via GitHub Desktop, which triggers Cloudflare Workers Builds (`uomd-game-staging`, `uomd-admin-staging`, `uomd-ops-staging`).

---

## 2. Complete Repository Audit & Module Classification

| Path | Current Contents (Verified 2026-10-24) | Disposition in Unity Transition |
| --- | --- | --- |
| `narrative/` | **1,496 files**: Authoritative fiction, canon (`00_Canon`), 51 main-story entries, 88 Part I scenes, 419 line IDs, 32 character profiles (`06_Characters`), 27 enemies/bosses (`07_Enemies_Bosses`), 43+ locations (`08_Locations`), runtime JSON snapshot (`09_VN_Scripts/Runtime_Snapshot`), Japanese VO master script (`10_VO`), audio cues (`11_Audio_Cues`), art workbench (`15_Art_Workbench`). | **KEEP 100% UNCHANGED AS CANON AUTHORITY.** Compiled into game JSON via `tools/build_content.ts` and `tools/build_campaign.ts`. |
| `content/` | `content/base` (**202 files**, release `rel_0001`), `content/approved_art` (**258 approved entries**: 54 16-frame chibi/objective atlases, 128 VN portraits, 47 backgrounds, 16 gacha banners, 11 stills, 2 UI marks), `content/balance/attributes.json` (D-27 STR/INT/VIT/AGI archetypes), `content/balance/gear_passives.json` (25 signature weapon hooks), `content/budget/media_budget.json`, `content/keys/trusted_public_keys.json` (P-256 trust root). | **KEEP 100% REUSED.** Exported directly into Unity `StreamingAssets/uomd_base/` and R2 OTA patch packages via `npm run export:unity` (`tools/export_unity_bundle.ts`). |
| `apps/api/` | **64 source files**, **29 D1 SQLite migrations** (`0001_core.sql`..`0029_attribute_stats.sql`), **4 SQL seeds** (`assets.sql`, `banners.sql`, `catalog.sql`, `characters.sql`), **89 public REST routes** (`/api/v1/*`) + admin routes (`/admin/api/*`) on Cloudflare Workers + Hono + D1 + R2. | **KEEP 100% UNCHANGED.** The backend is engine-agnostic HTTP/JSON. Unity communicates with the exact same `/api/v1/*` endpoints via `UnityWebRequest`. |
| `apps/admin/` | **19 source files** (14 React 19 pages: `Dashboard`, `Development`, `Animations`, `Assets`, `Banners`, `Catalog`, `Characters`, `Economy`, `Flags`, `Monitoring`, `Players`, `Releases`, `Shop`, `Audit`) behind Cloudflare Access. | **KEEP 100% UNCHANGED.** Manages D1/R2 releases, LiveOps banners, player support, and asset approvals for the Unity client. |
| `packages/shared/` | **13 files**: `Mulberry32` seeded PRNG (`rng.ts`), `canonicalJson` (`canonical.ts`), `ES256` P-256 IEEE-P1363 manifest signing/verification (`signing.ts`), `sha256Hex`/`crc32`, Gemini media pricing & budget state machine (`media.ts`, `budget.ts`). | **KEEP FOR SERVER/TOOLS + PORT CORE TO C# (`Uomd.Core`).** `tools/export_unity_bundle.ts` auto-generates `UomdCorePrimitives.g.cs` with bit-exact `Mulberry32Rng` and trust roots. |
| `packages/content-schema/` | **22 files**: Zod schemas for `UnitPack`, `SkillDef`, `EffectOp` (25+ closed ops), `StoryScene` (19 ops), `ArtManifest`, `VfxPack`, `PresentationPack`, `WorldMap`, `ContentManifest`, and `validateContentSet()`. | **KEEP FOR SERVER/BUILDERS + PORT DTOs/VALIDATOR TO C# (`Uomd.ContentSchema`).** |
| `packages/economy/` | **21 files**: D-27 attribute math (`attributes.ts`: `STR/INT/VIT/AGI` → `HP/ATK/DEF/SPD/Crit/EffectHit`), leveling/ascension curves, gacha pity/rates, Ration regeneration, AFK patrol formula, chronological simulator. | **KEEP FOR SERVER + PORT TO C# (`Uomd.Economy`).** `UomdStatMath` in `UomdCorePrimitives.g.cs` provides the bit-exact C# stat derivation. |
| `packages/combat/` | **12 files**: Deterministic 5v5 `Battle` state machine (`engine.ts`, 1,927 lines), turn gauge, Focus/ultimates, 15 statuses, boss fresh-bar phases, breakable objectives, telegraphs, multi-wave spawning, Auto AI, and `replayBattle()` (`replay.ts`). | **KEEP ON SERVER FOR `/api/v1/battles/verify` + PORT BIT-EXACT TO C# (`Uomd.Combat`).** C# `Battle` must produce the exact same `BattleEvent[]` log and `SHA-256` `logHash` as TypeScript for every seed and action list. |
| `packages/story/` | **3 files**: Declarative `StoryRunner` VM (`runner.ts`, 264 lines), program counter, flags, branches, choices, `StorySave`, `RestoredSceneState`. | **PORT TO C# (`Uomd.Story`).** Small, pure state machine with zero rendering dependencies. |
| `packages/patch/` | **7 files**: `PatchManager` (`manager.ts`, 469 lines), ES256 signature admission, capability checks, generation high-water mark, staged activation, rollback, kill switch. | **PORT TO C# (`Uomd.Patch`).** Uses `Application.streamingAssetsPath` (`uomd_base`) + `Application.persistentDataPath` (`uomd_patches/objects/<sha256>`) instead of browser IndexedDB. |
| `apps/game/` | **116 source files**, **28 scenes** on PixiJS v8 + HTML/ARIA layer (`Boot`, `Splash`, `Studio`, `Title`, `Prologue`, `Story`, `Battle`, `Finish`, `Home/WorldMap`, `Chapters`, `Roster`, `Character`, `Gear`, `Team`, `Summon`, `Recruit`, `Shop`, `Tasks`, `Deeds`, `Trials`, `Profile`, `Mail`, `Library`, `Account`, `Purchases`, `Operations`, `ContentPanel`, `PatchBar`). | **REFERENCE ORACLE → PORT TO UNITY (`apps/unity/`).** Keep `apps/game` passing `npm run verify` while building `apps/unity/` scene by scene. |
| `apps/android/` | Capacitor 8 Android shell + **5 Java plugins** (`MainActivity.java`, `UomdGoogleSignInPlugin.java`, `UomdBillingPlugin.java`, `UomdAdsPlugin.java`, `UomdAppPlugin.java`). | **EXTRACT JAVA LOGIC INTO UNITY ANDROID PLUGINS (`apps/unity/Assets/Plugins/Android/`).** Retire Capacitor WebView bridge; invoke Android Credential Manager, KeyStore AES-GCM, Play Billing v7, and AdMob/UMP directly via Unity `AndroidJavaObject` / `AndroidJavaProxy`. |
| `tools/` | **89 files**: Content/campaign compilers (`build_content.ts`, `build_campaign.ts`, `make_release.ts`, `make_chapter_patch.ts`), Gemini API generators (`gen_image.ts`, `record_game_vo.py`, `generate_phase1_music_lyria35.py`), offline art ingest (`ingest_art.ts`), Unity exporter (`export_unity_bundle.ts`). | **KEEP & EXTEND.** Primary CLI toolkit for Claude Opus 5.5. |

---

## 3. Unity 6 LTS Architecture & Technical Specification (`apps/unity/`)

### 3.1 Project Settings & Render Pipeline
- **Unity Version**: Unity 6 LTS (`6000.0.x` or latest stable LTS installed on host; if Unity CLI is not installed in a cloud container, Claude Opus 5.5 authors and verifies all C# core/domain/network/combat/story/patch assemblies via standard `.NET SDK / dotnet test` and generates the complete Unity project structure, `.asmdef` files, Editor importers, Prefabs/UI Toolkit `.uxml`/`.uss`, and scenes).
- **Render Pipeline**: Universal Render Pipeline (URP) with **2D Renderer (`Renderer2DData`)**.
- **Display & Orientation**:
  - Package ID: `io.github.mucaeksi.unawareofmydemise`
  - Orientation: **Landscape Left / Landscape Right** (auto-rotation landscape).
  - Reference Resolution: **1920×1080** (`Match Width Or Height = 0.5` or letterboxed `16:9` stage container inside `Screen.safeArea`).
  - Color Space: **Linear** (with sRGB textures for UI/portraits/sprites).
  - Scripting Backend: **IL2CPP**, Target Architectures: **ARM64** (Google Play requirement).

### 3.1.1 Pre-Implemented C# Infrastructure in `apps/unity/Assets/` (Layers 2–5 Ready for Claude Opus 5.5)
Layers 2, 3, 4, and 5 are already implemented and verified in `apps/unity/Assets/` so Claude Opus 5.5 can immediately focus on **Layer 1** (`Uomd.Combat`, `Uomd.Narrative`, and the 28 game scenes):
- **Layer 5 — Server & Shared Schema C# Compatibility (`Uomd.Contracts` & `Uomd.Core`)**:
  - `apps/unity/Assets/_UOMD/Scripts/Contracts/Uomd.Contracts.asmdef` & `UomdApiContracts.cs` (`[Serializable, Preserve]` DTOs for Auth, Wallets, Gacha Banners/Pulls, Roster, Character Growth, Gear, Teams, Entry/Story/Battle Progress, Mail, Unity Sprite Slices, and `VfxPackDto`).
  - `apps/unity/Assets/_UOMD/Scripts/Core/Uomd.Core.asmdef`, `CanonicalJson.cs` (UTF-16 ordinal key-sorted JSON + SHA-256 + Base64Url), `Es256SignatureVerifier.cs` (ECDSA P-256 IEEE P1363 verification), `UomdApiClient.cs` (`UnityWebRequest` + `Awaitable` HTTP client matching `apps/game/src/net/api.ts`), and `Generated/UomdCorePrimitives.g.cs` (`Mulberry32Rng`, D-27 `UomdStatMath`, `ComputeVictoryStars`, `UomdClientConfig`).
- **Layer 4 — Pure Android Java JNI Bridges (`Uomd.Platform` & `Assets/Plugins/Android/`)**:
  - `apps/unity/Assets/Plugins/Android/io/github/mucaeksi/unawareofmydemise/`: `UomdUnityCallback.java`, `UomdGoogleSignInBridge.java` (`CredentialManager` + `AndroidKeyStore` AES-GCM 256-bit), `UomdBillingBridge.java` (Google Play Billing v7), `UomdAdsBridge.java` (UMP + AdMob SSV), `UomdAppBridge.java` (`makeRestartActivityTask`).
  - `apps/unity/Assets/_UOMD/Scripts/Platform/Uomd.Platform.asmdef` & `UomdPlatformBridge.cs` (`IUomdPlatformBridge`, `UomdAndroidJniBridge`, `UomdEditorMockBridge`).
- **Layer 2 — Gothic Dark Anime UI Toolkit (`Uomd.UI` + UXML/USS)**:
  - `apps/unity/Assets/_UOMD/UI/USS/uomd-tokens.uss`, `apps/unity/Assets/_UOMD/UI/UXML/UomdHubFrame.uxml`, `apps/unity/Assets/_UOMD/UI/UXML/UomdModalDialog.uxml`.
  - `apps/unity/Assets/_UOMD/Scripts/UI/Uomd.UI.asmdef`, `UomdThemeTokens.cs`, `SafeAreaBinder.cs`, `UomdUiKit.cs` (Gothic buttons, HP/Focus progress bars, focus-trapped cost-disclosure confirmation modals, and toasts).
- **Layer 3 — URP 2D Shaders, Sprite Slicing & Data-Driven VFX (`Uomd.Battle`)**:
  - `apps/unity/Assets/_UOMD/Shaders/UomdSpriteFlash.shader` & `UomdVfxBlend.shader`.
  - `apps/unity/Assets/_UOMD/Scripts/Battle/Uomd.Battle.asmdef`, `ChibiAtlasSlicer.cs` (bottom-left `y_unity = H - (y + h)` and normalized foot pivot `(pivot_x, 1 - foot_y)` runtime sprite creation), `Vfx/VfxProceduralTextures.cs` (15 procedural textures + 4 vector emblems), and `Vfx/BattleVfxStage.cs` (object-pooled 115-preset `vfx_presets.json` runtime).
- **IL2CPP Stripping Protection**: `apps/unity/Assets/_UOMD/link.xml` and `apps/unity/ProjectSettings/ProjectVersion.txt` (`6000.0.41f1`).

### 3.2 Modular C# Assembly Definitions (`.asmdef`)
Structure `apps/unity/Assets/_Uomd/` into clean, deterministic assemblies so `dotnet test` and Unity Test Runner can verify logic without booting scenes:

```text
apps/unity/
├── Assets/
│   ├── _Uomd/
│   │   ├── Core/                  # Uomd.Core.asmdef (UomdCorePrimitives.g.cs: Mulberry32Rng, UomdStatMath, CanonicalJson, Sha256, Es256Verifier)
│   │   ├── ContentSchema/         # Uomd.ContentSchema.asmdef (C# DTOs for UnitPack, Encounter, StoryScene, ArtManifest, VfxPack, PresentationPack, WorldMap, ContentManifest)
│   │   ├── Economy/               # Uomd.Economy.asmdef (Progression, Gacha, Ration, AfkMath, BannerConfig)
│   │   ├── Combat/                # Uomd.Combat.asmdef (Deterministic 5v5 Battle engine, 25+ EffectOps, 15 Statuses, Boss phases/objectives, ReplayBattle)
│   │   ├── Story/                 # Uomd.Story.asmdef (StoryRunner VM, StorySave, RestoredSceneState, R09 Continuity v1)
│   │   ├── Patch/                 # Uomd.Patch.asmdef (PatchManager, StreamingAssets base + persistentDataPath R2 cache, ContentService)
│   │   ├── Net/                   # Uomd.Net.asmdef (UomdApiClient via UnityWebRequest/HttpClient, OperationJournal persistent idempotency)
│   │   ├── Platform/              # Uomd.Platform.asmdef (Google Sign-In Credential Manager + KeyStore, Play Billing, AdMob SSV + UMP, SafeArea, QualityTier)
│   │   ├── Presentation/          # Uomd.Presentation.asmdef (SceneManager, BattleStage, UnitView 8-state animator, VfxStage, NarrativeStage, Subtitles, Audio/Music loop player, UI Toolkit/uGUI screens)
│   │   ├── Editor/                # Uomd.Editor.asmdef (Atlas slice importer reading unity_*_art_slices.json, Addressables/StreamingAssets sync, AAB build script)
│   │   └── Tests/
│   │       ├── EditMode/          # Uomd.Tests.EditMode.asmdef (RNG, StatMath, Combat replay vectors C01-C39, StoryRunner, PatchManager, OperationJournal)
│   │       └── PlayMode/          # Uomd.Tests.PlayMode.asmdef (Boot->Title->Prologue->T-1..T-3->Finish->WorldMap E2E flows)
│   ├── Plugins/
│   │   └── Android/               # Native Java bridges (CredentialManager, KeyStore, BillingClient, MobileAds/UMP)
│   └── StreamingAssets/
│       ├── uomd_base/             # Populated by `npm run export:unity` (rel_0001 base content)
│       └── uomd_metadata/         # Populated by `npm run export:unity` (unity_base_art_slices.json, unity_campaign_art_slices.json)
```

### 3.3 Bit-Exact Server Parity Requirements (CRITICAL)
The Cloudflare Worker backend (`POST /api/v1/battles/verify` in `apps/api`) re-simulates every client battle using `@uomd/combat` (`packages/combat/src/replay.ts`) and compares:
1. `result.victory` (`true` / `false`), `result.turns`, `result.stars` (`1 | 2 | 3`)
2. `logHash`: `sha256Hex(canonicalJson(battle.log))`
3. `eventCount`: `battle.log.length`

To guarantee 100% server verification acceptance in Unity:
1. **PRNG (`Mulberry32Rng`)**: Use the generated `Uomd.Core.Mulberry32Rng` class (`tools/export_unity_bundle.ts`). Never use `UnityEngine.Random` or `System.Random` for gameplay logic.
2. **Rounding (`RoundHalfUp`)**: Always use `(int)Math.Floor(x + 0.5 + 1e-9)` (`UomdStatMath.RoundHalfUp`) in `double` precision—never `float` (`Single`) or `Math.Round` banker's rounding—for stat growth, damage, healing, shields, and enemy tuning multipliers.
3. **Canonical JSON (`CanonicalJson`)**: Sort object keys by UTF-16 code unit order (`StringComparer.Ordinal`), strip `null`/`undefined` optional fields identically to `packages/shared/src/canonical.ts`, and format numbers without trailing `.0` for integers.
4. **ES256 Manifest Verification**: Verify `ContentManifest.signature` (`alg: "ES256"`, `kid: "uomd-staging-2026-10"`) over `canonicalJson(manifest_without_signature)` using `.NET` `ECDsa.VerifyData(bytes, sigBytes, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation)` with the P-256 `(X, Y)` coordinates in `UomdClientConfig.TrustedPublicKeys`.

### 3.4 Coordinate System & Sprite Atlas Conversion
In the existing PixiJS v8 engine (`packages/content-schema/src/art.ts`):
- Texture atlas regions `[x, y, w, h]` are measured from the **top-left** `(0, 0)` of the WebP image.
- Each unit state specifies `pivot_x` (`0.0..1.0` from left) and `foot_y` (`0.5..1.0` from **top** of the frame).
In Unity (`Sprite.Create` / `TextureImporter`):
- Texture coordinates `(x, y, width, height)` and normalized pivots `(pivot.x, pivot.y)` are measured from the **bottom-left** `(0, 0)` of the texture!
- Therefore:
  - `unityRect.x = x`
  - `unityRect.y = atlasHeight - (y + h)`
  - `unityPivot.x = pivot_x`
  - `unityPivot.y = 1.0f - foot_y`
- Running `npm run export:unity` (`npx tsx tools/export_unity_bundle.ts`) automatically computes these exact bottom-left rects, normalized pivots, and 8-state animation frame lists (`idle`, `walk`, `basic`, `active`, `ultimate`, `hit`, `defeat`, `victory`) for all base and campaign atlases and writes them to `StreamingAssets/uomd_metadata/unity_base_art_slices.json` and `unity_campaign_art_slices.json`.
- Note on WebP in Unity: Unity's built-in `ImageConversion.LoadImage` only decodes PNG/JPG at runtime unless a WebP decoder (such as `webp-unity` / `LibWebP` native plugin or build-time PNG/ASTC Texture2D conversion for `StreamingAssets`) is included. For `StreamingAssets` and Editor imports, either convert `.webp` to `.png` / ASTC `SpriteAtlas` during the Unity import step (using `sharp` in a Node pre-step or a C# `AssetPostprocessor`) or bundle `libwebp` for runtime R2 patch textures so downloaded `.webp` objects from R2 (preserving their exact R2 SHA-256 bytes on disk!) decode directly into `Texture2D`. **Important:** When verifying R2 patch files in `PatchManager`, always verify `SHA-256` over the raw downloaded `.webp` bytes before decoding!

### 3.5 Mapping All 28 Client Scenes (`apps/game/src/scenes/` → Unity)

| Scene Group | PixiJS / DOM Reference Scene (`apps/game/src/scenes/`) | Unity Target Implementation (`Uomd.Presentation`) |
| --- | --- | --- |
| **Entry & Onboarding (Phase 1 Initial AAB)** | `BootScene.ts`, `SplashScene.ts`, `StudioScene.ts`, `TitleScene.ts`, `PrologueScene.ts`, `StoryScene.ts`, `BattleScene.ts`, `FinishScene.ts`, `PatchBarScene.ts` | - `Boot` / `Splash` (engine credit + synth chime) / `Studio` (ŞovTaym celestial astrolabe + `bgm_main_theme.ogg` intro/loop)<br>- `Title` (Tap-to-Start → Google Sign-In → background R2 patch check → `BEGIN` / `CONTINUE`)<br>- `Prologue` (9-shot 120s plate sequence, `Algieba` 96 Hz Japanese VO, punctuation-synced subtitles, no-skip on first viewing)<br>- `Story` (`NarrativeStage` with bottom-anchored breathing LN portraits, emotion cross-fades, voice-clock subtitles, choices, backlog)<br>- `Battle` (5v5 tactical stage, `UnitView` 8-state chibi sprite animator with 2-phase anticipation coil & `1.35×` impact hold, `VfxStage` playing all 115 presets in `vfx_presets.json`, breakable boss objectives from `atlas_objective.webp`, hit-stop, camera shake)<br>- `Finish` (14 canon quotes, local/cloud save status, staged patch activation & client restart)<br>- `PatchBar` (non-blocking overlay hidden during active Battle/Story/Prologue input) |
| **Hub & World Map (Patch 1+)** | `HomeScene.ts` (`ui/worldMap.ts`), `ChaptersScene.ts`, `ContentPanelScene.ts` | - `WorldMapHub` (`bg_world_map_part1.webp` 1920×1080 Bell Road, 7 chapter nodes, 4 landmarks, `340×150` Banner Spotlight card, surrounding Gothic HUD buttons respecting safe zones `x < 250`, `x > 1670`, `y > 950`)<br>- `Chapters` (Stage list, Normal/Hard difficulty toggle `hard_mode_v1`, 3★ requirements, Stage Sweep) |
| **Heroes, Gear & Gacha** | `RosterScene.ts`, `CharacterScene.ts`, `GearScene.ts`, `TeamScene.ts`, `SummonScene.ts`, `RecruitScene.ts` | - `Roster` & `Character` (`OVERVIEW \| LEVEL \| ASCEND \| SKILLS` tabs, Memory Shard resonance/conversion, expression/voice preview)<br>- `Gear` (Weapons/Armor/Accessories, 25 Signature Weapon passive hooks from `gear_passives.json`)<br>- `Team` (5-slot front/rear row formation editor)<br>- `Summon` (`940×440` banner key art from the 16 approved banners, 1×/10× wish pulls with `Bell's Remains`, staggered 4★/5★ card reveal + rates/pity/history modal)<br>- `Recruit` (`First Oath` 7-choice selector & story recruits) |
| **LiveOps, Modes & Account** | `TasksScene.ts`, `DeedsScene.ts`, `TrialsScene.ts`, `ProfileScene.ts`, `ShopScene.ts`, `MailScene.ts`, `LibraryScene.ts`, `AccountScene.ts`, `PurchasesScene.ts`, `OperationsScene.ts` | - `Tasks` (Daily/Weekly errands, 80-token UTC Daily Supplies floor, AFK Idle Patrol status & claim)<br>- `Deeds` (Achievements & Seasonal Events)<br>- `Trials` (Async Arena with `SET DEFENSE` squad selector + real-player D1 matchmaking, Endless Corridor waves)<br>- `Profile` (Player title & Leaderboards)<br>- `Shop` (In-game shop + Play Billing localized offers/subscriptions + AdMob rewarded ad trigger with 5/12h cap)<br>- `Mail`, `Library` (92-entry spoiler-gated Archive), `Account` (UMP privacy options, data export `GET /api/v1/account/export`, 21-table account deletion `POST /api/v1/account/delete`), `Purchases` & `Operations` (Saved Actions recovery UI) |

### 3.6 Native Android Bridges in Unity (`apps/unity/Assets/Plugins/Android/`)
Do **not** discard the battle-tested Java logic in `apps/android/android/app/src/main/java/io/github/mucaeksi/unawareofmydemise/`. Adapt those 4 classes by removing the `com.getcapacitor.*` wrapper and calling them from C# via `AndroidJavaClass` / `AndroidJavaObject` + `AndroidJavaProxy`:
1. **`UomdGoogleSignInBridge.java`** (from `UomdGoogleSignInPlugin.java`):
   - Uses `androidx.credentials:credentials` + `com.google.android.libraries.identity.googleid` (`CredentialManager`) to obtain the Google ID token (`idToken`) for `POST /api/v1/auth/google`.
   - Persists the opaque server session (`token`, `expiresAt`, `playerId`) in `AndroidKeyStore` (`AES/GCM/NoPadding`, 256-bit key `uomd_session_key_v1`).
2. **`UomdBillingBridge.java`** (from `UomdBillingPlugin.java`):
   - Uses `com.android.billingclient:billing:7.x` (`BillingClient`) for `getProducts` (returning localized `formattedPrice`, `basePlanId`, `offerId`, `offerToken`, `pricingPhases`), `purchase`, and startup/resume `queryPurchasesAsync` reconciliation.
3. **`UomdAdsBridge.java`** (from `UomdAdsPlugin.java`):
   - Uses `com.google.android.ump:user-messaging-platform` (`UserMessagingPlatform`) for EEA/UK/Swiss consent & withdrawal, and `com.google.android.gms:play-services-ads` (`RewardedAd`) with `ServerSideVerificationOptions` (`setUserId(playerId)`, `setCustomData(nonce)`).
4. **Gradle Dependencies**: Configure via Unity's **External Dependency Manager for Unity (EDM4U)** or `Assets/Plugins/Android/mainTemplate.gradle` with the exact Maven coordinates from `apps/android/android/app/build.gradle`.

---

## 4. Gemini API Asset Creation Pipeline (Claude Opus 5.5 Exclusive)

Claude Opus 5.5 generates all visual and audio assets through the Gemini API (`https://generativelanguage.googleapis.com`) using `GEMINI_API_KEY` (already present in `.env`).

### 4.1 Media Budget Guard (`content/budget/media_budget.json`)
- **Monthly Limit**: `1000 TL/month` (recorded as `$20.00 USD/month`), `$3.00 USD` per-batch cap, max `3` paid attempts per asset.
- **Check budget status before any paid run**:
  ```bash
  npx tsx tools/media_budget.ts status
  ```
- Never bypass `tools/media_budget.ts` or `tools/lib/media_budget.py`. If an asset fails 3 times, you **must** modify the prompt/references before requesting another attempt.

### 4.2 Visual Asset Generation (Gemini Image API: `gemini-3-pro-image` / `gemini-3.1-flash-image`)
1. **Verify Canon Anchor & Identity Lock**:
   - Check `docs/media/ART_BIBLE.md` (§4 verbatim character/enemy/location anchors) and `content/specs/character_locks/CHARACTER_LOCKS.md`.
2. **Author or Update Prompt Spec (`art_specs/<set>/<id>.json`)**:
   - Follow `ImageSpec` in `packages/shared/src/media.ts`:
     - `model`: `"gemini-3-pro-image"` (`$0.134` at `1K`/`2K`, `$0.24` at `4K`) or `"gemini-3.1-flash-image"` (`$0.045` at `0.5K`, `$0.067` at `1K`, `$0.101` at `2K`).
     - `references`: Up to 10 reference images from `reference/`, `narrative/14_References/recovered_locked_v001/`, or `content/approved_art/art/`.
3. **Dry-Run First, Then Execute**:
   ```bash
   # 1. Dry-run (estimates cost, checks budget & references, makes NO network call)
   npx tsx tools/gen_image.ts --spec art_specs/<set>/<id>.json

   # 2. Paid execution (reserves budget -> calls Gemini API -> writes .cache/generated/<id>/ + .provenance.json -> settles budget)
   npx tsx tools/gen_image.ts --spec art_specs/<set>/<id>.json --execute
   ```
4. **Deterministic Ingest, Slicing, QC & Approval (`tools/ingest_art.ts`)**:
   ```bash
   # Initialize ingest spec if needed
   npx tsx tools/ingest_art.ts init --spec art_specs/<set>/<id>.json --class <unit_sheet|portrait|background|still|ui_image|icon_sheet|banner>

   # Run deterministic chroma-keying, component slicing, pivot/foot_y grounding & WebP export
   npx tsx tools/ingest_art.ts art_specs/<set>/<id>.ingest.json --source .cache/generated/<id>/<file>.png --execute

   # Verify automated QC gates and approve
   npx tsx tools/ingest_art.ts verify
   npx tsx tools/ingest_art.ts approve <asset_id> --by claude:art-director --note "<visual & in-game QC summary>"
   ```

### 4.3 Music Generation (Google Lyria 3.5 via Gemini Interactions API)
- Uses `/v1beta/interactions` with `model: "lyria-3.5"`, guarded by `tools/lib/media_budget.py`:
  ```bash
  UOMD_EST_USD_LYRIA=0.08 python3 tools/generate_phase1_music_lyria35.py
  ```
- Automatically masters audio via `ffmpeg` (`loudnorm`, fade-in/out, `48kHz` Ogg Vorbis `.ogg` for game content + `44.1kHz` MP3 for auditioning) and records loop metadata (`loop_start_s`, `duration_s`) in `art_manifest.json`.

### 4.4 Japanese Voiceover Synthesis (Gemini 3.8 Flash TTS / Chirp 3 HD)
- Uses `narrative/10_VO/Line_Maps/jp_script_vertical_slice_master.json` (and future reviewed Japanese line maps) with locked cast (`Algieba` Narrator, `Sulafat` Fadyme, `Iapetus` Mahmut):
  ```bash
  # Dry-run inspection
  python3 tools/record_game_vo.py --dry-run

  # Paid synthesis (reserves/settles per line in media_budget.json, normalizes to -20 LUFS 24kHz Ogg Vorbis, syncs presentation.json)
  UOMD_EST_USD_TTS=0.002 python3 tools/record_game_vo.py --engine gemini-3.8-flash-tts
  ```

### 4.5 Content Compilation & Unity Bundle Sync
Whenever any narrative JSON, balance table, or approved asset changes:
```bash
npm run build:content      # Rebuilds content/base + release.json + apps/api/seed/assets.sql
npm run build:campaign     # Rebuilds content/patches/rel_0003_part1_campaign + runs 35-stage balance probe
npm run export:unity       # Exports StreamingAssets/uomd_base, bottom-left Unity atlas slices & UomdCorePrimitives.g.cs
npm run verify             # Runs ESLint + TypeScript typecheck + all Vitest suites + check:content
```

---

## 5. Step-by-Step Unity Migration Execution Plan (Phases U-0 to U-6)

Execute the Unity transition in strict, verifiable phases:

### Phase U-0 — Environment & Export Verification *(Completed in D-31 Setup)*
- `tools/export_unity_bundle.ts` (`npm run export:unity`) is live and unit-tested (`tools/export_unity_bundle.test.ts`).
- Generates `.cache/unity_bundle/StreamingAssets/uomd_base/`, `StreamingAssets/uomd_metadata/unity_base_art_slices.json`, `unity_campaign_art_slices.json`, and `Runtime/Generated/UomdCorePrimitives.g.cs`.

### Phase U-1 — Core C# Assemblies & Server Parity Proof (`Uomd.Core`, `Uomd.ContentSchema`, `Uomd.Economy`, `Uomd.Combat`, `Uomd.Story`)
1. Scaffold `apps/unity/` project structure and a standalone `.NET` solution (`apps/unity/Uomd.Logic.sln`) referencing the pure C# assemblies (`Uomd.Core`, `Uomd.ContentSchema`, `Uomd.Economy`, `Uomd.Combat`, `Uomd.Story`, `Uomd.Patch`) so `dotnet test` can run in any environment (Windows or Linux cloud container) alongside Unity Test Runner.
2. Port `packages/content-schema` JSON deserializers (`System.Text.Json` / `Newtonsoft.Json`) and `validateContentSet()` to `Uomd.ContentSchema`.
3. Port `packages/story/src/runner.ts` (`StoryRunner`) to `Uomd.Story` and pass all `runner.test.ts` cases in C#.
4. Port `packages/combat/src/engine.ts` (`Battle`) and `replay.ts` (`ReplayBattle`) to `Uomd.Combat`.
5. **Parity Gate**: Run a cross-runtime test that exports action logs and `logHash` values from TypeScript (`@uomd/combat` across all 35 Part I stages + tutorial T-1..T-3 + boss phases/objectives) and proves C# `ReplayBattle` produces the **exact same `SHA-256` `logHash` and `eventCount`** for every battle.

### Phase U-2 — Content Overlay, R2 PatchManager & Durable Networking (`Uomd.Patch`, `Uomd.Net`)
1. Port `packages/patch/src/manager.ts` (`PatchManager`) and `apps/game/src/content/ContentService.ts` to C#:
   - Base layer reads from `Application.streamingAssetsPath + "/uomd_base"`.
   - Patch layer stores content-addressed objects in `Application.persistentDataPath + "/uomd_patches/objects/<sha256>"` with atomic state commits, ES256 signature verification, capability checks (`CONTENT_CAPABILITIES`), and rollback/kill-switch handling.
2. Port `apps/game/src/net/operations.ts` (`OperationJournal`) and `apps/game/src/net/api.ts` (`UomdApiClient`) to C#:
   - Persist pending/confirmed/rejected mutations to disk before sending HTTP `POST`/`PUT` requests so app kills or lost responses never duplicate debits or grants.

### Phase U-3 — Phase 1 Initial AAB Vertical Slice in Unity (`Uomd.Presentation`)
1. Build the Gothic UI theme (`#f2e9dc` parchment, `#d6b36a` antique gold, `#07050c` obsidian, `#b84a59` crimson; `Cinzel` display & `Cormorant Garamond` body fonts) and `1920×1080` safe-area scaler in Unity.
2. Implement the complete first-install AAB vertical slice:
   - `BootScene` → `SplashScene` → `StudioScene` (`bgm_main_theme.ogg`) → `TitleScene` (Google Sign-In + background patch download) → `PrologueScene` (9 shots, 120s, `Algieba` VO + synced subtitles, no-skip on first viewing) → `Tutorial T-1 / T-2 / T-3` (`StoryScene` + 5v5 `BattleScene` with `UnitView` 8-state chibi animations, `VfxStage` 115 presets, hit-stop, shake) → `FinishScene` (save sync + staged patch restart).

### Phase U-4 — World Map Hub & Full LiveOps/Progression Screens in Unity
1. Implement `WorldMapScene` (`bg_world_map_part1.webp`, 7 chapter regions, 4 side-road landmarks, Banner Spotlight, hub navigation).
2. Implement all progression and LiveOps screens: `Chapters` (Normal/Hard switch + Sweep), `Roster`, `Character` (Level/Ascend/Skills/Shards), `Gear` (Signature passives), `Team` (5-slot front/rear), `Summon` (16 banner key-arts + 4★/5★ reveal + pity/history), `Recruit` (`First Oath`), `Tasks` (Errands + Daily Supplies + AFK Patrol), `Deeds` (Achievements + Events), `Trials` (Async Arena +Defense + Endless Corridor), `Profile`, `Shop`, `Mail`, `Library` (92-entry Archive), `Account` (Privacy/Export/Delete), `Purchases`, and `Operations`.

### Phase U-5 — Android Native Plugins & Signed AAB Build Pipeline
1. Wire `UomdGoogleSignInBridge.java` (Credential Manager + KeyStore AES-GCM), `UomdBillingBridge.java` (Play Billing v7), and `UomdAdsBridge.java` (AdMob SSV + UMP consent) into `apps/unity/Assets/Plugins/Android/`.
2. Configure Unity Android Player Settings (`io.github.mucaeksi.unawareofmydemise`, IL2CPP, ARM64, keystore signing via `UOMD_KEYSTORE_FILE` / `UOMD_KEYSTORE_PASSWORD` / `UOMD_KEY_ALIAS`, launcher mipmaps & splash screens from `docs/store/assets/`).

### Phase U-6 — Remaining Gemini API Asset Production & R18 Store Acceptance
1. Using the Gemini API tools (§4), produce and ingest remaining regional/boss music tracks (Chapters 2–7 + Boss motifs via `lyria-3.5`), any additional reviewed Japanese voiceover packs (`gemini-3.8-flash-tts`), and optional in-game WebM cinematics within the monthly media budget.
2. Execute R18 physical Android device & Google Play internal track acceptance.
