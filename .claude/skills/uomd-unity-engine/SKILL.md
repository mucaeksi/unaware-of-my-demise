---
name: uomd-unity-engine
description: Implement, review, or debug the Unaware of My Demise game client on Unity 6 LTS (6000.0.58f2, C#, URP 2D, Runtime UI Toolkit) in apps/unity/ — verified assembly/type inventory, the headless .NET harness, StreamingAssets/uomd_base export, server combat parity rules, and what is still only planned. Read first for any apps/unity work.
license: Proprietary
---
# UOMD on Unity 6 LTS (Decision D-31)

The legacy web client (`apps/game`) and Capacitor shell (`apps/android`) were removed in `e918b723`; recover them from `e918b723^` when you need the behavioural reference. `apps/unity/` is the only game client.

## Verified state (2026-10-24, re-check before relying on it)

- The C# has **never been compiled by a Unity Editor**: no `.meta` files, no `ProjectSettings/*.asset` except `ProjectVersion.txt` (6000.0.58f2), no `packages-lock.json`. The first real import happens through `apps/unity/cloud/unity_ci.sh import` on a licensed machine. After that, commit metas, ProjectSettings, `packages-lock.json` and `Assets/_UOMD/Settings/`.
- Engine-free code **is** compiled and tested headlessly: `npm run test:unity-logic` (`apps/unity/Logic/Uomd.Logic.sln`, C# 9 + netstandard2.1, asmdef boundaries mirrored, non-transitive references). It links the real `Assets/` files; never copy sources into `Logic/`.
- `Uomd.Combat` is a line-by-line, bit-exact port of `@uomd/combat` (`engine.ts` + `replay.ts`): `Battle` (partial: `Battle.cs`, `Battle.Effects.cs`, `Battle.Damage.cs`), `BattleReplay`, typed content in `CombatContent.cs`, JS semantics in `JsMath.cs` (stable sort, `Math.round`, half-up rounding, UTF-16 string order). `CombatParityTests` replays 171 golden battles from `tools/export_unity_combat_vectors.ts` (every Part I encounter, tutorials, waves, illegal replays) and must match logHash/eventCount/result exactly; `npm run verify` fails when the vectors are stale. Any engine change goes into TypeScript and C# together, then regenerate the vectors.
- The 28 screen controllers are mostly UI shells; no approved art is wired into them. `PatchManager` reads the embedded base and has no remote download/verify path yet.

## Verified assembly and type inventory

| asmdef (`Assets/_UOMD/...`) | References | Types that exist |
| --- | --- | --- |
| `Scripts/Contracts/Uomd.Contracts` | — | API DTOs (`SessionDto`, `AccountPayloadDto`, `BannerInfoDto`, `PullResponseDto`, `CharacterViewDto`, `GearViewDto`, `BattleSubmitRequestDto`, `MailItemDto`, `UnityArtExportDto`, `VfxPackDto`, …) |
| `Scripts/Core/Uomd.Core` | Contracts | engine-free: `CanonicalJson`, `Sha256Hash`, `Es256SignatureVerifier` (managed P-256), `UomdJson`, `GameSessionState`/`UomdScreenId`, generated `Mulberry32Rng`/`UomdStatMath`/`UomdClientConfig`; engine: `PatchManager`, `UomdApiClient` (`UnityWebRequest` + `Awaitable`), `AudioDirector`, `UomdTextureLoader` |
| `Scripts/Combat/Uomd.Combat` | Core | `Battle`, `BattleReplay`, `UnitPackDef`/`EncounterDef`/`CombatJson`, `Combatant` + runtime records, `JsMath` |
| `Scripts/Narrative/Uomd.Narrative` | Contracts, Core, UI | `StoryRunner` (engine-free), `SubtitleSynchronizer` |
| `Scripts/UI/Uomd.UI` | Contracts, Core, Platform | `UomdUiKit`, `UomdThemeTokens`, `SafeAreaBinder`; UXML/USS in `UI/` |
| `Scripts/Battle/Uomd.Battle` | Contracts, Core, Platform, UI | `ChibiAtlasSlicer`, `BattleVfxStage`, `VfxProceduralTextures`; shaders in `Shaders/` |
| `Scripts/Platform/Uomd.Platform` | Contracts, Core | `IUomdPlatformBridge`, `UomdAndroidJniBridge`, `UomdEditorMockBridge`, `UomdPlatformBridgeFactory` |
| `Scripts/Scenes/Uomd.Scenes` | all runtime | `UomdBootstrap` (runtime entry, builds `UIDocument` + router), `UomdSceneRouter`, `*ScreenController` ×28 (`BattleScreenController` runs the real engine; write `Uomd.Combat.Battle` fully qualified there, `Battle` alone resolves to the `Uomd.Battle` namespace) |
| `Editor/Uomd.Editor` | URP, runtime | `UomdProjectSetup` (URP 2D + Android player settings, `ApplicationId = io.github.mucaeksi.unawareofmydemise`), `UomdBuild` (AAB, signing from `UOMD_KEYSTORE_*`), `UomdMcpEditorTools` |
| `Tests/EditMode/Uomd.Tests.EditMode` | Contracts, Core, Combat | `CoreParityTests` (RNG, stat math, stars, canonical JSON, JS numbers, ES256, exported bundle), `CombatParityTests` (171 golden replays) |

Android Java bridges live in `Assets/Plugins/Android/UomdNative.androidlib/` (`UomdGoogleSignInBridge`, `UomdBillingBridge`, `UomdAdsBridge`, `UomdAppBridge`, `UomdUnityCallback`) with their Gradle dependencies.

Names such as `BattleStageController`, `ChibiUnitView`, `PortraitRigView`, `ContentService`, `QualityTierService`, `SafeAreaMonitor`, `BattleClock` or `UomdCombatParityTests` that appear in older skills are **planned designs, not code**. Do not reference them as existing; create them deliberately or use the types above.

## Rules

1. **Server parity**: gameplay randomness only through `Mulberry32Rng`; `double` math with `UomdStatMath.RoundHalfUp` (never `float`, never `Math.Round`); battle logs hashed with `CanonicalJson` exactly as `packages/shared/src/canonical.ts`. The Worker re-simulates every battle (`POST /api/v1/battles/verify`).
2. **Generated code**: `UomdCorePrimitives.g.cs`, `StreamingAssets/uomd_metadata/*` and `StreamingAssets/uomd_base/` (git-ignored) come from `npm run export:unity`. Edit `tools/export_unity_bundle.ts`, not the outputs. Parity vectors come from `npx tsx tools/export_unity_parity_vectors.ts`.
3. **Unity limits**: C# 9 and the .NET Standard 2.1 API. No `System.Text.Json`, no `ECDsa` (unavailable on Mono/IL2CPP; use the managed verifier), no WebP decoding (the exporter writes PNG siblings).
4. **Keep engine-free code engine-free**: a file listed in `Logic/*/*.csproj` must not gain `using UnityEngine` (except `UnityEngine.Scripting.Preserve`). Put new pure logic in those assemblies so it stays testable without a licence.
5. **Data-only patches**: chapters, characters and media arrive as signed JSON/media; never downloaded code. Unknown ops are rejected.
6. Use `Awaitable` and cancellation tokens for async flows, cache UI queries outside per-frame loops, release runtime `Texture2D`/`Sprite` objects you create.

## Reference skills

Project skills: `unity-6-core`, `unity-urp-2d`, `unity-ui-toolkit`, `unity-2d-animation`, `unity-deterministic-combat`, `unity-android-il2cpp`, `unity-mcp-workflow`. Vetted general Unity references (MIT, pinned in `.claude/skills-lock.json`, written against Unity 6.3 — confirm an API exists in 6000.0 before using it): `unity-scripting`, `unity-lifecycle`, `unity-async-patterns`, `unity-ui`, `unity-ui-patterns`, `unity-2d`, `unity-graphics`, `unity-audio`, `unity-input`, `unity-testing`, `unity-performance`, `unity-platforms`, `unity-editor-tools`, `unity-save-system`, `unity-scene-assets`, `unity-packages-services`, `unity-data-driven`, `unity-game-architecture`, `unity-state-machines`. This skill wins on conflict.

## Verification

```bash
npm run export:unity          # bundle, slices, generated primitives
npm run test:unity-logic      # headless C# build + EditMode parity tests (.NET 10 SDK, installed by the session hook)
npm run verify                # lint + typecheck + all TS tests + content drift (deploy gate)
bash apps/unity/cloud/unity_ci.sh import|test|build   # real Unity compile/tests/AAB; needs an installed, licensed editor
```

Report Unity Editor compilation as UNVERIFIED until `unity_ci.sh import` has actually run.
