---
name: uomd-android-lifecycle
description: "Inspect UOMD Android background/resume, Back, permissions and native callbacks with the current state owners and renderer."
---

# uomd-android-lifecycle

Read [shared authority](../../standards/authority.md) and [Godot rules](../../standards/godot-development.md). Godot 4.7.2, GDScript, Android portrait 1080×1920, gl_compatibility and strict types remain the target. Codex produces/reviews; Claude integrates runtime changes through a concrete handoff. Shared discovery does not change that ownership.

Use for Android lifecycle review and integration handoffs, paired with uomd-perf-profile for device measurements.

1. Inspect existing App, navigation, Audio and native-plugin owners before proposing callbacks. Node application pause/resume, focus and Android Back notifications have different meanings; verify the installed class API.
2. Persist only existing local settings/checkpoint state on pause. Never introduce a SaveManager that replaces server-authoritative economy/account state. Do not replay rewards, requests or voice from the beginning on every resume.
3. Test modal -> screen -> app Back precedence and input consumption. Keep the existing navigation owner; report whether automatic quit is enabled before claiming Back is handled.
4. Make callbacks and in-flight actions idempotent across rapid pause/resume, auth return, permission denial and process recreation. Restoring a scene does not prove account reconciliation succeeded.
5. Convert physical safe-area coordinates through the current window/stretch transform before applying logical 1080×1920 margins. Direct physical Rect2i assignment is not a generally valid UI layout recipe.
6. Request only an existing feature's needed permission, handle denial and native-plugin absence, and verify on a real device.

No new signing keys, IAP/ads, renderer, compression policy, iOS/C# scope or PiP feature is selected by this skill. Source S05 is MIT; original full references are archived for study, not execution.
