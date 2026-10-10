---
name: uomd-godot-shaders
description: "Author and review UOMD CanvasItem shaders, uniforms, masks and screen effects on Godot 4.7.2 Compatibility."
---

# uomd-godot-shaders

Read [shared authority](../../standards/authority.md) and [Godot rules](../../standards/godot-development.md). Godot 4.7.2, GDScript, Android portrait 1080×1920, gl_compatibility and strict types remain the target. Codex produces/reviews; Claude integrates runtime changes through a concrete handoff. Shared discovery does not change that ownership.

Use for .gdshader, ShaderMaterial and 2D compositing; pair with uomd-vfx for particle/effect design.

1. Inspect the actual material, imported textures and existing effect owner. Prefer canvas_item; preserve the renderer.
2. Expose typed uniforms with documented range, defaults, color space, sampler repeat/filter and alpha behavior. Declare screen sampling with hint_screen_texture; do not assume a normal/depth texture exists on Compatibility.
3. Separate shared shader code from per-instance ShaderMaterial state. Duplicate materials or use validated instance uniforms when different instances animate independently.
4. Drive progression with the existing presentation clock/Tween/AnimationPlayer. TIME is not a server clock; pause/resume and rollover must be explicit for synchronized effects.
5. Check progress endpoints, mask alpha, minification, portrait aspect and Reduced Motion. Screen-copy order and full-screen overdraw need real rendered evidence.
6. Compile on the pinned engine, then inspect native frames and logs. Headless resource load does not compile a GPU shader or establish Android performance.

Read [2D shading details](references/canvas-shading.md). This is a modified UOMD adaptation of S01, Apache-2.0; original license, NOTICE, full references and hashes are retained in the shared source archive.
