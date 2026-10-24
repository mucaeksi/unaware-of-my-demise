---
name: uomd-unity-engine
description: Implement, review, or debug the Unaware of My Demise game client on Unity 6 LTS (6000.0.x, C#, URP 2D, Runtime UI Toolkit + TextMeshPro) in apps/unity/ — covering the 8 .asmdef assemblies, StreamingAssets/uomd_base bundle, SceneRouter, ContentService ES256 patch overlays, URP 2D battle/story stage, and deterministic combat parity.
license: Proprietary
---
# UOMD on Unity 6 LTS (Decision D-31)

## Architecture Overview (`apps/unity/`)

Under Decision D-31 (2026-10-24), the legacy web runtime (`apps/game/`) and Capacitor wrapper (`apps/android/`) are retired. All client engineering targets **Unity 6 LTS (`6000.0.x`, C#, Universal Render Pipeline 2D, Runtime UI Toolkit + TextMeshPro)** in `apps/unity/`, operated exclusively by **Claude Opus 5.5**.

### 1. Assembly Definition (`.asmdef`) Boundaries
Code under `apps/unity/Assets/_UOMD/Scripts/` is partitioned into 8 strict `.asmdef` assemblies with zero circular dependencies:
- **`Uomd.Contracts`**: Pure C# DTOs mirroring `packages/contracts` and `packages/content-schema` (`ArtManifestDto`, `UnitSliceSpecDto`, `StorySceneDto`, `VfxPresetDto`, API request/response envelopes). No `UnityEngine` dependency required except `[Serializable]` attributes.
- **`Uomd.Core`**: Generated `UomdCorePrimitives.g.cs` (from `npm run export:unity`), `Mulberry32Rng`, `UomdStatMath` (D-27 stat pipeline), `CanonicalJson`, `Sha256Hash`, `ContentService` (ES256 P-256 signature verification & atomic rollback in `Application.persistentDataPath/uomd_content/`), and `ApiClient` (`UnityWebRequest` with `X-Idempotency-Key` and Bearer JWT refresh).
- **`Uomd.Combat`**: Pure C# deterministic 5v5 turn-based combat engine (`BattleEngine`, `TurnOrder`, `SkillExecutor`, `StatusProcessor`, `BossPhaseController`). Uses IEEE-754 `double` math and `UomdCorePrimitives.RoundHalfUp` to guarantee bit-exact `log_hash` parity with `/api/v1/battles/verify`.
- **`Uomd.Platform`**: `IUomdPlatformBridge`, `AndroidJniBridge` (`AndroidJavaClass`/`AndroidJavaObject` calls to `UomdGoogleSignInPlugin`, `UomdBillingPlugin`, `UomdAdsPlugin`, `UomdAppPlugin`), `EditorMockBridge`, `SafeAreaMonitor`, and `QualityTierService`.
- **`Uomd.UI`**: Runtime UI Toolkit (`UIDocument`, `PanelSettings` 1920×1080 landscape) + TextMeshPro (`Cinzel`, `Cormorant Garamond`) screens for Title, Sanctum (`Home`), Summon (`Gacha`), Roster, Character Detail, Team Formation, Relics (`Gear`), World Map (`Chapters`), Modes, Mail, Shop, and Settings.
- **`Uomd.Battle`**: URP 2D tactical stage (`BattleStageController`, `BattleFormation`, `ChibiUnitView`, `BattleVfxStage`, `BattleCameraRig`, `BattleHudController`).
- **`Uomd.Narrative`**: Visual Novel & Cinematic stage (`PrologueStageController`, `StoryStageController`, `PortraitRigView`, `SubtitleClockSynchronizer`, `VideoCutscenePlayer` via `UnityEngine.Video.VideoPlayer`).
- **`Uomd.Editor`**: Custom Unity Editor importers, slice previewers, and CLI build scripts (`UomdBuildPipeline.BuildAndroidAab`, `UomdBundleImporter`).

### 2. Content & Asset Pipeline (`npm run export:unity`)
- Never hardcode game balance, story scripts, or sprite coordinates in C#.
- Run `npm run export:unity` (`tools/export_unity_bundle.ts`), which compiles and copies `content/base/` into `apps/unity/Assets/StreamingAssets/uomd_base/`, writes `unity_export_manifest.json` (`210` files, `162` SHA-256 verified assets, `20` unit slice specs with precomputed Unity bottom-left normalized pivots), and generates `UomdCorePrimitives.g.cs`.
- Runtime asset resolution order in `ContentService`:
  1. Verified hot-patch file in `Application.persistentDataPath/uomd_content/<release_id>/...` (only after ES256 signature + per-file SHA-256 verification).
  2. Base file in `Application.streamingAssetsPath + "/uomd_base/..."`.

### 3. Core Engineering Rules
1. **Strict Separation of Simulation and Presentation**: `Uomd.Combat` never references `UnityEngine.MonoBehaviour`, `Transform`, or frame delta time. `Uomd.Battle` plays back `BattleActionEvent` sequences emitted by `Uomd.Combat`.
2. **Unity 6 `Awaitable` First**: Use `Awaitable` (`Awaitable.NextFrameAsync()`, `Awaitable.WaitForSecondsAsync()`, `destroyCancellationToken`) for async flows and scene transitions instead of legacy string-based `StartCoroutine` or unmanaged `Task.Run`.
3. **Zero-GC Frame Loop**: Never allocate strings, LINQ iterators, closures, or `GetComponent<T>()` / `rootVisualElement.Q<T>()` calls inside `Update()` or `LateUpdate()`. Cache component and UI references in `Awake()` / `OnEnable()`.
4. **Deterministic Resource Lifecycle**: Every runtime `Texture2D`, `Sprite`, `AudioClip`, or `VisualElement` event subscription created by a scene must be released in `OnDisable()` / `OnDestroy()`.
5. **Pair with Specialized Unity Skills**:
   - `unity-6-core` for `Awaitable`, lifecycle, `.asmdef`, and memory/GC rules.
   - `unity-urp-2d` for URP 2D sorting layers, runtime `Sprite.Create` bottom-left rect/pivot conversion, and `vfx_presets.json` rendering.
   - `unity-ui-toolkit` for Runtime UI Toolkit UXML/USS, safe area insets, and Gothic tokens.
   - `unity-2d-animation` for 16-cell SD Chibi 8-state frame loops and VN portrait breathing/cross-fade.
   - `unity-deterministic-combat` for bit-exact C# combat parity with Cloudflare Workers.
   - `unity-android-il2cpp` for Android IL2CPP ARM64 AAB builds and JNI plugin bridges.
   - `unity-mcp-workflow` for `uomd-unity-live` MCP inspection and CLI batchmode test execution.

## Verification
- Export & verify bundle parity: `npm run export:unity` and `npx vitest run tools/export_unity_bundle.test.ts`.
- Inspect Unity bundle, unit slices, and C# assemblies via the `uomd-unity-live` MCP (`unity_bundle_status`, `unity_inspect_unit_slices`, `unity_project_status`).
- Run Unity EditMode/PlayMode tests via CLI:
  `Unity -batchmode -nographics -projectPath apps/unity -runTests -testPlatform EditMode -testResults .cache/unity-editmode-results.xml -quit`
- Run workspace gate: `npm run verify`.
