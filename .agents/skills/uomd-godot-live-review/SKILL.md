---
name: uomd-godot-live-review
description: "Verify live Godot AI inventory, project identity, read-only scene/log access and native preview evidence for UOMD."
---

# uomd-godot-live-review

Read [shared authority](../../standards/authority.md) and [Godot rules](../../standards/godot-development.md). Godot 4.7.2, GDScript, Android portrait 1080×1920, gl_compatibility and strict types remain the target. Codex produces/reviews; Claude integrates runtime changes through a concrete handoff. Shared discovery does not change that ownership.

Use when actual editor/runtime evidence is needed.

1. Inspect callable tools and the official installed Godot AI version. Use the dock-generated authenticated attach command for each client; keep capabilities and personal config outside Git. Do not substitute bare HTTP or invent another MCP's tool names.
2. Read the live project root, engine/plugin version and renderer. Require game/ and the pinned toolchain before any editor write. One scene/resource has one writer.
3. Enumerate actual tool schemas, then read the scene tree and error log. Explicitly distinguish a native client round-trip from an SDK bridge check. A connected SDK does not prove both clients discovered their config.
4. Use game/scripts/art_review/preview_session.gd with local sample data and the existing preview. Refresh supported hot reloads; restart only for a demonstrated lifecycle/debugger/parse problem.
5. Capture fixture, commit, window/logical size, native frame and relevant logs. Check interaction/cleanup and repeat at relevant portrait ratios. Headless parsing is a separate result.
6. If GUI, authenticated attach, client loader or Android device is absent, record that exact check as pending and continue independent validation. Do not report historical evidence as live success.

Read [shared installation workflow](../../workflows/shared-skills.md). The installed plugin source and its configurator determine real capabilities; keep the existing addon unchanged.
