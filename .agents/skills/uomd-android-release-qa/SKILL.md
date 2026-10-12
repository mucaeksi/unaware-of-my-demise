---
name: uomd-android-release-qa
description: Assess and verify UOMD Android/Google Play readiness with physical-device evidence for identity, Billing, AdMob/UMP, lifecycle, privacy and signed data patches.
---
# UOMD Android release QA

Read README, [Android acceptance plan](../../../docs/QA_ANDROID.md), [phaser4-mobile-qa](../phaser4-mobile-qa/SKILL.md) and its canonical source. Inspect current native bridges, SDK/config/build files under apps/android, client platform adapters and matching Worker code/tests. Historical QA plans are requirements/evidence maps, not executed acceptance results; verify every previously stated source limit against current main.

Build an acceptance matrix with requirement, current implementation, test route, PASS/FAIL/BLOCKED/NOT RUN, source evidence and device/build evidence. Keep browser, emulator, physical device, local backend, live staging and Play sandbox results separate. Record commit/AAB hash/versionCode, device/Android/WebView versions, environment, patch generation and actual test timestamp.

Cover Google-only identity/stable subject and account recovery/deletion; UMP/consent; test rewarded ads and SSV no-double-grant; Play products/subscriptions, pending/restore/acknowledgement/renewal/grace/hold/refund/RTDN; portrait-to-landscape transitions, cutouts/touch, low-memory/background/resume, offline/reconnect and long-session performance. Check signed data-only patch interruption, corruption, activation, persistence and rollback on an unchanged build. Refer to the current documented cases rather than creating a competing acceptance plan.

Use physical devices and licensed Play sandbox/test-device configurations for native gates. Test ads exercise SDK/UI behavior; a callback that deliberately grants nothing is not proof of reward fulfillment. Do not invent real-device results, mint fake live rewards, modify player wallets directly or generate real charges to remove a blocker.

Capture sanitized screenshots/logcat/Worker evidence with no Google/session/purchase tokens, signatures, keystore secrets or other users' data. If a device, Console grant/product or SDK capability is unavailable, provide the exact blocked test and owner configuration step while continuing source analysis. Browser tests do not waive a native gate. Public store upload/release, real pricing and paid services need their applicable authorization.
