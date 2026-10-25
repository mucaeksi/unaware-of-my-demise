---
name: uomd-unity-engine
description: Implement, review, or debug the Unaware of My Demise game client on Unity 6 LTS (editor pinned in ProjectSettings/ProjectVersion.txt; C#, URP 2D, Runtime UI Toolkit) in apps/unity/ — the real assembly/type inventory, what runs where (headless harness vs Unity), the TypeScript reference oracle, server parity rules, content patching, and the cloud build/capture loop. Read first for any apps/unity work.
license: Proprietary
---
# UOMD on Unity 6 LTS (Decision D-31)

`apps/unity/` is the only game client. There is no PixiJS, Phaser or Capacitor code left: the web client (`apps/game`) and
Android shell (`apps/android`) were removed in `e918b723`. Their TypeScript is still the **behaviour oracle** for every
ported screen: `git show e918b723^:apps/game/src/scenes/<Scene>.ts` (or extract the tree once into the scratchpad) and port
timings, strings, layout coordinates and rules from it instead of inventing them.

## State (2026-10-25; re-check with `git log` before relying on it)

- Imported and compiled by a licensed Unity editor (the version in `ProjectSettings/ProjectVersion.txt`) in the cloud (`apps/unity/cloud/install_unity_linux.sh`,
  `unity_ci.sh import`); `.meta` files, `ProjectSettings/*.asset` and `Packages/packages-lock.json` are committed.
- Debug-signed IL2CPP ARM64 AAB builds in the cloud (`unity_ci.sh build`, ~91 MB); release signing waits on the owner's
  upload key (B-SIGNING). Builds and screen captures are recorded for the Control Center (`docs/evidence/`).
- Ported and art-wired: Boot → Studio → Title → Prologue → Story → Battle (real engine, chibi atlases, VFX presets) →
  Finish (real patch download). All 28 screens are ported from their TS scenes (2026-10-25): the account-backed hub
  screens derive from `UomdHubScreen` and read the API as JSON. Not yet ported: Google Play checkout and rewarded ads
  (BUY/WATCH stay disabled), the operation journal, server-sessioned campaign battles, the world-map hub, locales.
- Remote content patching works (U-2): `PatchManager` resolves every content path through the active signed release.

## Assembly and type inventory (verified)

| asmdef (`Assets/_UOMD/...`) | Engine-free? | Key types |
| --- | --- | --- |
| `Scripts/Contracts/Uomd.Contracts` | yes | API DTOs (`SessionDto`, `BannerInfoDto`, `BattleSubmitRequestDto`, …), `UnityArtExportDto` |
| `Scripts/Core/Uomd.Core` | partly | engine-free: `CanonicalJson`, `Sha256Hash`, `Es256SignatureVerifier`, `UomdJson`, `GameSessionState`, `UomdMediaCatalog`, `UomdBattleFormation`, generated `Mulberry32Rng`/`UomdStatMath`/`UomdClientConfig`, `Patching/*` (`UomdPatchClient`, `ContentManifest`, `FileContentStorage`, `UomdPatchService`, `UomdContentOverlay`), `Vfx/*` (`VfxPack`, `VfxTimeline`, `VfxCanvas`, `VfxTextureArt`), `Growth/UomdGrowth`, `JsonRead`. Engine: `PatchManager`, `UomdPatchAdapters` (`UomdApiRemote`, `UomdStreamingBase`), `UomdApiClient`, `AudioDirector`, `UomdMediaLoader`, `UomdTextureLoader` |
| `Scripts/Combat/Uomd.Combat` | yes | `Battle` (+ `.Effects`/`.Damage`), `BattleReplay`, `UnitPackDef`/`EncounterDef`, `JsMath` — bit-exact port of `@uomd/combat` |
| `Scripts/Narrative/Uomd.Narrative` | partly | `StoryRunner`, `SubtitleSynchronizer`, `UomdCutscene` |
| `Scripts/UI/Uomd.UI` | no | `UomdScreenKit` (layout/animation helpers), `UomdThemeTokens`, `UomdUiKit` (toast/modal/bars), `SafeAreaBinder` |
| `Scripts/Battle/Uomd.Battle` | no | `ChibiAtlasSlicer`; shaders in `Shaders/` |
| `Scripts/Platform/Uomd.Platform` | no | `IUomdPlatformBridge`, `UomdAndroidJniBridge`, `UomdEditorMockBridge`, `UomdPlatformBridgeFactory` |
| `Scripts/Scenes/Uomd.Scenes` | no | `UomdBootstrap` (creates `UIDocument` + `PanelSettings` in code), `UomdSceneRouter`, `UomdEntryFlow`, `UomdCaptureRunner`, screen controllers (`EntryAndCinematicScenes.cs`, `BattleScreenController.cs`; the account-backed screens derive from `UomdHubScreen` in `CompanyAndChaptersScreens.cs`, `RosterAndCompanionScreens.cs`, `TeamAndArmoryScreens.cs`, `SummonScreen.cs`, `StoreScreens.cs`, `AccountScreen.cs`, `ProgressScreens.cs`, `ArchiveAndTrialsScreens.cs`, `NoticesAndPatchStrip.cs`), `BattleUnitView`, `UomdVfxPlayer`, `VfxShapeElement`. Write `Uomd.Combat.Battle` fully qualified here. |
| `Editor/Uomd.Editor` | no | `UomdProjectSetup` (URP 2D + Android settings, `io.github.mucaeksi.unawareofmydemise`), `UomdBuild` (AAB/APK, capture player), `UomdMcpEditorTools` |
| `Tests/EditMode/Uomd.Tests.EditMode` | yes | `CoreParityTests`, `CombatParityTests` (171 golden replays), `PatchClientTests`, `PatchServiceTests`, `VfxTests`, `MediaCatalogTests`, `CutsceneTests`, `BattleFormationTests`, `GrowthTests` |

Android Java lives in `Assets/Plugins/Android/UomdNative.androidlib/` (`UomdGoogleSignInBridge`, `UomdBillingBridge`,
`UomdAdsBridge`, `UomdAppBridge`, `UomdImageBridge` (WebP decode), `UomdUnityCallback`).

## Rules

1. **Server parity**: gameplay randomness only through `Mulberry32Rng`; `double` math with JS rounding (`JsMath`,
   `UomdStatMath`); battle logs hashed with `CanonicalJson`. The Worker re-simulates every battle. Engine changes go into
   TypeScript and C# together, then regenerate `tools/export_unity_combat_vectors.ts`.
2. **Port, don't invent**: UI text, timings and coordinates come from the TS scene or `narrative/`; never write new canon.
3. **Engine-free code stays engine-free**: files compiled by `apps/unity/Logic/*/*.csproj` (globs include `Core/Patching/*`
   and `Core/Vfx/*`) must not use `UnityEngine`. Put new pure logic there so it is tested without a licence.
4. **Unity limits**: C# 9, .NET Standard 2.1; no `System.Text.Json`, no `ECDsa`; Unity cannot decode WebP (base content ships
   JPG/PNG siblings via `decodable.json`; patched WebP decodes through Android `UomdImageBridge`).
5. **Async on the main thread**: `Awaitable` in scene code; `Task` code that touches Unity APIs must not use
   `ConfigureAwait(false)`. Never block on a task from the main thread.
6. **Data-only patches**: content arrives as signed JSON/media (`PatchManager`/`UomdPatchClient`); never downloaded code.
7. **Generated outputs**: `UomdCorePrimitives.g.cs` and `StreamingAssets/uomd_base/` come from `npm run export:unity`; edit
   `tools/export_unity_bundle.ts`, not the outputs.
8. New `.cs` files need a committed `.meta` (`fileFormatVersion: 2` + a fresh 32-hex `guid`).
9. **Hub screens**: subclass `UomdHubScreen` (frame, backdrop by heading, wallet, sign-in gate) and lay out in the TS
   1920×1080 coordinates with its helpers (`Text`, `Button`, `Card`, `Box`, `Bar`, `Scroll`, `OpenModal`, `ActAsync`);
   check `IsCurrent(generation)` after every await. Read endpoints with `Api.GetJsonAsync` + `JsonRead`; write with
   `Api.SendJsonAsync` — `idempotent: true` (adds `requestId`) only for endpoints the TS client called through `mutate`,
   `idempotent: false` for its plain `call` writes (teams, equip, logout, account delete: their schemas are strict).

## Verification loop

```bash
npm run test:unity-logic                                   # headless C# build + EditMode tests (no licence)
python3 apps/unity/cloud/unity_ref_compile.py --editor-data /root/Unity/Editors/$(sed -n "s/^m_EditorVersion: //p" apps/unity/ProjectSettings/ProjectVersion.txt)/Editor/Data   # all asmdefs vs real Unity DLLs
bash apps/unity/cloud/unity_ci.sh test                     # EditMode inside Unity
bash apps/unity/cloud/unity_ci.sh capture && node tools/publish_unity_screens.mjs   # player screenshots → Control Center
bash apps/unity/cloud/unity_ci.sh build && node tools/record_unity_build.mjs        # AAB → Control Center
npm run verify                                             # repository gate before every commit
```

Read the captured PNGs (`apps/unity/Builds/Capture/*.png`) before claiming a screen looks right.

## Related skills

Project: `unity-ui-toolkit`, `uomd-anime-ui`, `uomd-battle`, `unity-deterministic-combat`, `uomd-narrative-cinematics`,
`uomd-chibi-animation`, `unity-android-il2cpp`, `uomd-mobile-qa`, `unity-mcp-workflow`, `unity-mcp-orchestrator` (live Editor via MCP for Unity), `unity-6-core`, `unity-urp-2d`.
Vendored references (pinned in `.claude/skills-lock.json`; this skill wins on conflict): official Unity `ui`, `ui-uitk`;
`unity-android-release`, `unity-device-testing`, `unity-profiling`, `unity-game-feel`; Unity 6.3 reference set
`unity-scripting`, `unity-lifecycle`, `unity-async-patterns`, `unity-2d`, `unity-graphics`, `unity-audio`, `unity-input`,
`unity-testing`, `unity-performance`, `unity-platforms`, `unity-editor-tools`, `unity-save-system`, `unity-scene-assets`,
`unity-packages-services`, `unity-data-driven`, `unity-game-architecture`, `unity-state-machines` (confirm an API exists
in the pinned editor version before using it).
