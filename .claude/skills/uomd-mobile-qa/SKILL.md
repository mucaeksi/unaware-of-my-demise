---
name: uomd-mobile-qa
description: Test and profile Unaware of My Demise Unity 6 LTS builds (Editor PlayMode, CLI batchmode EditMode, and Android IL2CPP ARM64 AAB) and React Control Center — covering URP 2D frame time, memory, Screen.safeArea, lifecycle, ES256 signed patches, and Play Store release gates.
---
# Mobile and Unity 6 LTS QA

> **Reality check (2026-10-24):** project class names in this skill that are not listed in `uomd-unity-engine` → *Verified assembly and type inventory* are planned designs, not existing code. Verify with `rg` before referencing them.

- **Unity Bundle & CLI Verification**: Run `npm run export:unity`, `npx vitest run tools/export_unity_bundle.test.ts`, and Unity CLI batchmode tests (`Unity -batchmode -nographics -projectPath apps/unity -runTests -testPlatform EditMode -quit`). Inspect bundle parity and unit slices with the `uomd-unity-live` MCP (`unity_bundle_status`, `unity_project_status`).
- **Android IL2CPP Device Build**: Build ARM64 `.apk` / `.aab` via `UomdBuildPipeline.BuildAndroidAab` (`unity-android-il2cpp`). Physical Android devices and Google Play sandbox testing (`uomd-android-release-qa`) are required for R18 native acceptance (CredentialManager Google Sign-In, Play Billing v7, AdMob SSV, Play Integrity).
- **Coverage Checklist**: `16:9` to `21:9` landscape aspect ratios, `Screen.safeArea` camera cutout insets, quality tiers (`60 FPS` High / `30 FPS` Balanced), `OnApplicationPause`/`OnApplicationFocus` background/resume, audio mixer & video cutscene resume, network reconnect/idempotency, low storage, and `ContentService` ES256 signature/SHA-256 verification and atomic rollback.
- **Release Hygiene**: Production IL2CPP builds must force dev-only preview shortcuts off (`#if UNITY_EDITOR || DEVELOPMENT_BUILD` guards).
- **Reporting**: Report `PASS` / `FAIL` / `BLOCKED` / `UNVERIFIED` with the exact evidence level (`unit`, `editmode`, `playmode`, `admin-browser`, `android-device`).
