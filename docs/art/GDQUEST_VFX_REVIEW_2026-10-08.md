# GDQuest VFX reference review — 2026-10-08

The owner requested local installation and inspection, with no gameplay use yet. The library is installed, six 2D shader studies run in the existing native preview, and every game export preset excludes the library. No battle, character, story, audio, renderer, or strict typing setting was changed.

## Source and installed layout

- Source: https://github.com/gdquest-demos/godot-4-VFX-assets
- Pinned revision: `f6034a88877f6ea144ae487694cc8fde82d4da7f`.
- `game/assets/vfx/gdquest_reference/shaders/`: 35 unmodified MIT shaders, preserving upstream paths.
- `game/assets/vfx/gdquest_reference/SOURCE.json`: source revision, status, exact file inventory and SHA-256 hashes.
- `game/assets/vfx/gdquest_reference/LICENSE-MIT.txt`: complete upstream software notice.
- `references/gdquest_vfx/upstream/project.godot`: separate original Godot demo, restored from 259 tracked upstream files. Local and Git-ignored, outside the game root.
- `tools/Install-GdquestVfxReference.ps1`: pinned reinstall, preserving existing altered assets. Godot-generated importer sidecars may differ after opening the demo and are preserved.
- `game/scripts/art_review/gdquest_vfx_review.gd`: isolated six-tile development gallery using procedural Godot gradients/noise and the copied shaders. The existing review export exclusion also removes this script.

Open the original demo as a separate project to browse all 12 curated gallery entries. Its scripts, scene paths, global PreviewData class and Godot 4.1 / Forward Plus defaults remain isolated from the main 4.7.2 / Compatibility project. This avoids importing untyped upstream scripts into the game's strict typing checks or remapping upstream scene dependencies.

## License boundary

The upstream LICENSE explicitly splits software and art. Scripts, scenes, shaders and other Godot-generated resources use MIT; image textures and 3D models use CC BY-NC-SA 4.0. The complete upstream LICENSE remains in the separate demo. The main game receives no upstream image, model, script, material or scene. MIT notice must accompany any later shipped shader adaptation. Original NC art is reference-only for this project; a later production integration needs independently licensed/generated art or a separate permission decision.

Reference: https://github.com/gdquest-demos/godot-4-VFX-assets/blob/main/LICENSE

## Useful candidates

Suitability and cost notes below are engineering assessments from source inspection, not Android profiling results. They propose future uses without assigning new character powers or story canon.

| Priority | Effect / source | Potential use | Review result / boundary |
| --- | --- | --- | --- |
| High | `effects/2d_vortex/source/2d_vortex.gdshader` | Ultimate focal point, portal-like transition, area effect | Procedural, no art samplers. Native Compatibility preview passed. Reduce speed and opacity for the slower battle cadence; keep the swirl away from health/name bars. |
| High | `effects/2d_trail/source/trail_2d.gd` plus `effects/2d_trail/preview/material/star_trail.gdshader` | Blade trail or moving projectile | The trail shader passed native preview. Original Line2D follower script was inspected in the separate project, not installed into gameplay. Bound point count and lifetime before applying it to simultaneous 5v5 attacks. |
| High | `effects/2d_explosion/source/materials/explosion.gdshader` and `explosion_red_circle.gdshader` | Layered hit core, expanding ring, ultimate impact | Both passed native preview using new procedural sampler textures. The original full scene also uses NC smoke art; copying that scene unchanged is outside the production plan. Use short readable layers and control overdraw. |
| Medium | `to_sort/shaders/glow.gdshader` | Selective energy accents, ultimate-ready emphasis | Source reviewed; screen-reading mipmapped glow is not runtime-validated here. Keep it localized and compare it against the game's existing UI glow before any integration. Prototype directory, not a production-ready recommendation. |
| Medium | `to_sort/shaders/vignette.gdshader` | Light novel framing or ultimate cut-in framing | Native preview passed with a generated gradient. Prototype directory. Avoid covering subtitles/buttons or reducing character readability. |
| Medium | `backgrounds/2d_sky/source/2d_sky.gdshader` | Animated sky layer behind existing art | Procedural sky source reviewed. Not rendered in this review; check its size and star parameters before use. Background art direction and story context still determine suitability. |
| Later | `effects/2d_water/source/2d_water.gdshader` | Limited environmental distortion | Source uses screen texture; requires isolated readback and readability/performance checks. No gameplay connection. |
| Later | `effects/2d_eyeball/source/eyeball.gdshader` | Creature detail or environmental study | Native procedural preview passed. A study asset rather than a reason to introduce another tutorial enemy type. |
| Later | `backgrounds/space/source/star_field.gdshader` | Atmospheric background accent | Source reviewed; not runtime-validated. Original sampler art remains in the separate demo. |
| Low for current 2D scope | 3D flame, smoke explosion, paint projectile, iridescent material, stylized water, hologram prototypes | Technical reference for a future 3D/composited effect | Isolated project imported in 4.7.2 headlessly. This does not establish Compatibility rendering support or mobile performance for its 3D scenes. No renderer change proposed. |

Recommended first adaptation when VFX work is authorized: a bounded trail, one restrained impact core/ring, then one character-specific ultimate composition. Effects should follow the existing left-party/right-enemy battle layout. Preserve five portrait slots, health/name readability and the ultimate cut-in timing contract. Do not integrate now.

## Runtime and export evidence

Six shader studies first rendered in the existing Godot AI live session, in isolated SubViewports inside the native LocalUiPreview window: vortex, star trail, explosion core, shockwave ring, procedural eye and vignette. During the close/reopen check, invoking the opening helper through `GDScript.call` failed and caused a noncontinuable debugger break. Only the runtime was restarted; the editor remained open. The final reusable `PreviewSession.open_vfx(tree)` was then verified using a preloaded static method, including successful return to the character preview and reopening the gallery. All sampler textures in that gallery are newly constructed Godot resources. The hidden FadymePilot remains in the same window. No account or network gameplay request is made by the gallery.

- Native image: `build/gdquest-vfx-review-20261008/native-gallery.png`.
- Final reopened native gallery: `build/gdquest-vfx-review-20261008/native-gallery-live.png`.
- Original demo import log: `build/gdquest-vfx-review-20261008/upstream-import.log`.
- Development gallery passes `--check-only` under the unchanged main project settings.
- Android, Android AAB and Content Full exclude `assets/vfx/gdquest_reference/*`. The standalone upstream demo is outside `game/` and cannot enter these exports.
- Export verification packs and a machine-readable result live in `build/gdquest-vfx-review-20261008/`.

This review validates the six displayed 2D shader compositions on the current desktop Compatibility runtime. It does not certify all 35 shaders, complete upstream animations, 3D Compatibility support, or Android frame-time budgets. The previously built opening review AAB remains the earlier artifact; adding this reference library does not require rebuilding that artifact.
