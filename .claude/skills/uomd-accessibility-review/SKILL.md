---
name: uomd-accessibility-review
description: "Review UOMD Large Text, Reduced Motion, safe area, touch/Back and non-color meaning in native portrait previews."
---

# uomd-accessibility-review

Read [shared authority](../../standards/authority.md) and [Godot rules](../../standards/godot-development.md). Godot 4.7.2, GDScript, Android portrait 1080×1920, gl_compatibility and strict types remain the target. Codex produces/reviews; Claude integrates runtime changes through a concrete handoff. Shared discovery does not change that ownership.

Use with uomd-ux-review for selected presentation screens.

Check Large Text and English expansion for truncation and focus/reading order, safe areas for multiple portrait ratios, touch/drag cancellation and Android Back precedence. Measure hit areas in the actual device density and transform; a generic 44 px is not a physical-size guarantee. Labels/icons must preserve meaning when colors are indistinguishable.

Reduced Motion should remove or shorten shake, parallax, flashing and full-screen transitions while preserving state/meaning. Inspect existing preferences; an unavailable preference is a reported gap, not permission to invent a new settings framework. Avoid strobing and assess the actual effect sequence rather than judging a single frame.

Use native preview screenshots and interactions with settings recorded. Screen-reader behavior requires the target platform accessibility tree and actual device/assistive-technology evidence; focus alone does not establish support. Stage findings and design alternatives; Claude owns runtime integration.
