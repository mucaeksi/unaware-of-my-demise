---
name: uomd-setup-engine
description: "Verify UOMD Godot 4.7.2, project root, actual renderer, strict typing and available local toolchain without retargeting."
---

# uomd-setup-engine

Read [Godot rules](../../standards/godot-development.md), project.yaml and actual game/project.godot. Check installed/editor version, renderer, project/export presets and available headless/Android tooling relevant to the task. Report configuration-vs-runtime mismatches without silently retargeting; project.yaml Mobile currently differs from actual gl_compatibility. Preserve plugins/strict typing. Return VERIFIED / PARTIALLY_VERIFIED / UNVERIFIED / BLOCKED with evidence. Do not install packages, open another visible runtime, or edit game settings merely to satisfy this verification.
