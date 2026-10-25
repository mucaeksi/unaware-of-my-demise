---
name: uomd-mobile-qa
description: Test and verify Unaware of My Demise Unity builds and the Control Center — headless C# harness, reference compile, Unity EditMode, Xvfb player captures published to the admin panel, AAB records, content/patch checks, and physical-device acceptance. Use before claiming any apps/unity change works.
---
# QA for the Unity client

Evidence levels, lowest to highest: `unit` (headless) → `editmode` (inside Unity) → `capture` (player screenshots) →
`android-device`. Report each claim as PASS / FAIL / BLOCKED / UNVERIFIED with its level.

| Check | Command | Notes |
| --- | --- | --- |
| Headless C# build + EditMode tests | `npm run test:unity-logic` | engine-free assemblies only; installs .NET 10 if missing |
| All asmdefs against real Unity DLLs | `python3 apps/unity/cloud/unity_ref_compile.py --editor-data /root/Unity/Editors/6000.0.58f2/Editor/Data` | catches missing modules/asmdef refs without a licence |
| EditMode inside Unity | `bash apps/unity/cloud/unity_ci.sh test` | results in `apps/unity/Logs/ci/editmode-results.xml` |
| Player screenshots | `bash apps/unity/cloud/unity_ci.sh capture` then `node tools/publish_unity_screens.mjs` | Linux player under Xvfb, 1920×1080, `UomdCaptureRunner` order; T-1 plays on AUTO (`05-battle-vfx`, `05-battle-result`); downloads stay in memory |
| Android AAB | `bash apps/unity/cloud/unity_ci.sh build` then `node tools/record_unity_build.mjs` | debug-signed unless `UOMD_KEYSTORE_*` set |
| Repository gate | `npm run verify` | lint, typecheck, all TS tests (incl. vector freshness), content drift |

Always open the capture PNGs (`apps/unity/Builds/Capture/`) and compare with the TS reference scene before saying a screen
is right; check `apps/unity/Logs/ci/capture-player.log` for exceptions.

Coverage to keep in mind: 16:9 → 21:9 landscape and `Screen.safeArea`; reduced motion / reduce flash; first install vs
returning player (`PatchManager.EntryCompleted`); offline and metered network for patch downloads; storage full;
background/resume; long strings. Signed patches: tampered/unsigned/stale manifests are covered by `PatchClientTests`.

Physical devices (R18): sign-in, Play Billing sandbox, rewarded ads, Play Integrity, performance — use the vendored
`unity-device-testing` / `unity-profiling` methods. Release builds must not expose dev shortcuts (`#if UNITY_EDITOR ||
DEVELOPMENT_BUILD`).
