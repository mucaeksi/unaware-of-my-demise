---
name: unity-android-il2cpp
description: Build, integrate, and profile the Unity 6 LTS Android IL2CPP ARM64 client — AndroidJavaClass/AndroidJavaObject JNI bridges to UomdGoogleSignInPlugin, UomdBillingPlugin, UomdAdsPlugin, and UomdAppPlugin, KeyStore AES-GCM token storage, Play Billing v7, AdMob SSV, and release QA gates.
license: Proprietary
---
# Unity 6 LTS Android IL2CPP & Native JNI Bridges (`Uomd.Platform`)

> **Reality check (2026-10-24):** project class names in this skill that are not listed in `uomd-unity-engine` → *Verified assembly and type inventory* are planned designs, not existing code. Verify with `rg` before referencing them.

Use this skill when working on Android builds, native Kotlin/Java plugins (`Assets/Plugins/Android/`), Google Sign-In (`CredentialManager`), Google Play Billing v7, AdMob Rewarded Ads SSV, Play Integrity, or mobile performance profiling.

## 1. Unity 6 Android Build Settings (`ProjectSettings`)
- **Scripting Backend**: `IL2CPP`
- **Target Architectures**: `ARM64` (`arm64-v8a` only; 32-bit `armeabi-v7a` is disabled)
- **Target SDK / Min SDK**: `minSdkVersion 26` (Android 8.0+), `targetSdkVersion 35` (Android 15 Play Store requirement)
- **Screen Orientation**: `Auto Rotation` (`Landscape Left` + `Landscape Right`), `renderOutsideSafeArea = true`
- **Graphics API**: `Vulkan` primary with `OpenGLES3` fallback (`Auto Graphics API` disabled for deterministic shader compilation)
- **Packaging**: Android App Bundle (`.aab`) with Split Application Binary / Play Asset Delivery when exceeding base size budgets

## 2. Native Android Plugin Architecture (`Assets/Plugins/Android/`)
The 4 native Kotlin plugins originally built in `apps/android/app/src/main/java/com/unawareofmydemise/app/` are migrated into `apps/unity/Assets/Plugins/Android/` as pure JNI helper classes invoked from C# (`Uomd.Platform.AndroidJniBridge`) without any Capacitor WebView dependencies:

| Native Class | Responsibility | C# JNI Entry Point |
| :--- | :--- | :--- |
| `UomdGoogleSignInHelper` | Android `CredentialManager` (`GetGoogleIdOption`) returning Google ID Token for `POST /api/v1/auth/google` | `AndroidJniBridge.SignInWithGoogleAsync()` |
| `UomdBillingHelper` | Google Play Billing Library `7.1.1` (`BillingClient`, `queryProductDetailsAsync`, `launchBillingFlow`, `acknowledgePurchase`) for `POST /api/v1/billing/google/verify` | `AndroidJniBridge.PurchaseProductAsync(sku)` |
| `UomdAdsHelper` | Google UMP Consent + AdMob `RewardedAd` with `ServerSideVerificationOptions` (`userId = playerId`, `customData = placementId:nonce`) | `AndroidJniBridge.ShowRewardedAdAsync(placement)` |
| `UomdSecurityHelper` | `AndroidKeyStore` (`AES/GCM/NoPadding`) hardware-backed encryption for session refresh tokens + Play Integrity API token requests | `AndroidJniBridge.ReadSecureToken()` / `WriteSecureToken()` |

## 3. Safe JNI Invocation & Threading Rules
1. **Acquire `currentActivity` Safely**:
   ```csharp
   using var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
   using var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
   ```
   Always wrap `AndroidJavaClass` and `AndroidJavaObject` local references in `using` statements so JNI local reference tables never overflow.
2. **Marshal Callbacks to Unity Main Thread**:
   - Callbacks arriving on Android Binder / UI threads via `AndroidJavaProxy` must switch to the Unity main thread (`await Awaitable.MainThreadAsync();`) before mutating `MonoBehaviour` state, `UIDocument` elements, or `SceneManager`.
3. **Never Log Secrets or Tokens**:
   - Never pass Google ID tokens, refresh tokens, Play Billing `purchaseToken`s, or JWTs into `Debug.Log` or crash breadcrumbs.

## 4. Lifecycle, Audio & Context Recovery
- Handle `OnApplicationPause(bool paused)` and `OnApplicationFocus(bool hasFocus)` in `UomdAppLifecycle`:
  - Flush dirty story/tutorial checkpoints before backgrounding.
  - Pause audio mixers and video cutscenes on background; cleanly resume without audio crackle on foreground return.
  - Re-verify server session / clock skew when resuming after `> 5 minutes`.
- Pair with `uomd-android-release-qa` for physical-device Play Store acceptance gates.
