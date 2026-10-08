# Shader, particle and VFX guidance

Target Godot 4.7.2 and the actual gl_compatibility renderer. Favor focused canvas_item shaders, bounded 2D particles and contained overlays. Inspect available Godot AI material/particle/API tools before authoring complex resources. Preserve existing render settings, strict typing and unrelated addons.

Each effect needs a visual purpose, silhouette/palette reference, trigger/source, duration, bounds, cleanup, quality fallback and Reduced Motion behavior. Keep HP, names, focus, targets, telegraphs, subtitles and touch controls readable. Prefer one readable focal effect over many perpetual glows. Expose meaningful uniforms with correct hints; document non-obvious math and target constraints.

Measure particle cap/lifetime/emission, texture size/samples, screen coverage/overdraw, draw calls and memory in the real scene. Pool only when profiling justifies it. Screen-texture readbacks, blur, branching and layered full-screen effects require explicit renderer/runtime checks. Record desktop measurements separately from Android device acceptance; unknown budgets stay unmeasured.

GDQuest source/licensing/status is `docs/art/GDQUEST_VFX_REVIEW_2026-10-08.md`. Six desktop shader studies passed; this does not validate all 35 shaders or 3D/mobile support. MIT shader code and noncommercial upstream art have different boundaries. The reference library remains excluded from exports; study approval does not authorize gameplay integration. Preserve source revision and license notices in any authorized later adaptation. Kenney and other free libraries retain their own source manifests/licenses.

Use procedural or approved independently licensed sampler textures when adapting study shaders. Never silently bring reference scenes, scripts or NC artwork into production. Validate the requested effect in the existing preview and relevant real scene; retain evidence, logs and limits.
