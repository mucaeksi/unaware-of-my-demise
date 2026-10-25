---
name: unity-android-il2cpp
description: Build, sign, record and debug the Unaware of My Demise Android IL2CPP ARM64 AAB in the cloud — unity_ci.sh build, UomdBuild/UomdProjectSetup, the Maven retry proxy and Gradle trust-store mirroring, release signing from UOMD_KEYSTORE_*, the Control Center build record, and the Java JNI bridges (Google Sign-In, Play Billing, ads, WebP decode).
license: Proprietary
---
# Android IL2CPP build & JNI bridges (UOMD)

## Build in the cloud (verified)

```bash
bash apps/unity/cloud/install_unity_linux.sh        # once per container: Unity 6000.0.58f2 + Android SDK/NDK/OpenJDK, no Hub
bash apps/unity/cloud/unity_ci.sh import            # licence (UNITY_EMAIL/UNITY_PASSWORD) + import
bash apps/unity/cloud/unity_ci.sh build             # Builds/Android/uomd.aab (debug-signed without a keystore)
node tools/record_unity_build.mjs                   # docs/evidence/unity-android-build.json → Control Center Development page
```

- `UomdBuild.BuildAndroidBatch` (Editor): `UOMD_BUILD_OUTPUT`, `UOMD_BUILD_APK=1` for an APK, `UOMD_VERSION_CODE` /
  `UOMD_VERSION_NAME`; release signing when `UOMD_KEYSTORE_FILE`, `UOMD_KEYSTORE_PASSWORD`, `UOMD_KEY_ALIAS`,
  `UOMD_KEY_PASSWORD` are set (owner-provided upload key; never commit or print them). Without them the AAB is debug-signed
  and is not uploadable to Play.
- Player settings (`UomdProjectSetup`, `ProjectSettings.asset`): IL2CPP, ARM64 only, min SDK 24, target SDK 35, landscape
  left/right, render outside safe area, application id `io.github.mucaeksi.unawareofmydemise`, bundle version from
  `bundleVersion` (patch compat uses it as semver, `PatchManager.ToSemver`).
- Gradle behind the egress proxy: Maven Central rate-limits the shared IP (429 / fake 404) → `unity_ci.sh` starts
  `maven_retry_proxy.py` (127.0.0.1:8765, disk cache) with `maven-retry-proxy.init.gradle`; Unity's Gradle daemon does not
  see `JAVA_TOOL_OPTIONS`, so trust store and proxy are mirrored into `~/.gradle/gradle.properties`; stale daemons are killed
  before a build. Read `apps/unity/cloud/README.md` before changing any of this.
- Size: base art ships as JPG/PNG siblings (no WebP), ~91 MB AAB. Check size after content changes.

## JNI bridges (`Assets/Plugins/Android/UomdNative.androidlib`, package `io.github.mucaeksi.unawareofmydemise`)

| Java | C# entry (`Uomd.Platform.UomdAndroidJniBridge`) |
| --- | --- |
| `UomdGoogleSignInBridge` (Credential Manager) | `SignInWithGoogleAsync`, `SignOutGoogleAsync` |
| `UomdBillingBridge` (Play Billing) | `PurchaseProductAsync`, `QueryOwnedPurchasesAsync`, `ReconcileOwnedPurchasesAsync` |
| `UomdAdsBridge` (UMP + rewarded, SSV) | `InitAdsConsentAsync`, `ShowPrivacyOptionsFormAsync`, `ShowRewardedAdAsync` |
| `UomdAppBridge` (secure token storage, app utilities) | `LoadEncryptedSessionTokenAsync`, `ClearEncryptedSessionTokenAsync`, … |
| `UomdImageBridge` (BitmapFactory WebP → RGBA) | `UomdTextureLoader.DecodeWebp` |
| `UomdUnityCallback` | callback proxy back to C# |

Rules: wrap `AndroidJavaClass`/`AndroidJavaObject` in `using`; marshal proxy callbacks to the main thread before touching
UI; never log tokens or purchase data; guard Android-only code with `#if UNITY_ANDROID && !UNITY_EDITOR` (the Editor uses
`UomdEditorMockBridge`). Physical-device acceptance (sign-in, billing sandbox, ads, Play Integrity) is still open (R18) —
see the vendored `unity-device-testing` and `unity-android-release` for method; use the commands above, not their shell
templates.
