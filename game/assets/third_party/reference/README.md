# Reviewed free 2D library

Nine source groups, 1,422 asset files (including variant sizes/colors/masks), plus the separate official 2D particle demo. No imported character/chibi pack, 3D asset or active plugin. This entire directory is excluded from Android, Android AAB and Content Full exports.

`COLLECTION.json` records every source URL, pinned Git revision or ZIP hash, original path, file SHA-256, file size and license. Each collection retains its original LICENSE.txt. Godot's generated `.import`/`.uid` sidecars are not upstream asset counts. `tools/import_free_2d_library.py` reconstructs the selection from the reviewed local downloads at `build/free-2d-review-20261008/` and refuses to overwrite altered copies. Source URLs and hashes support later retrieval when this temporary download folder is absent.

| Collection | Files | License | Useful role |
| --- | ---: | --- | --- |
| Kenney particles | 80 | CC0 | Dust, glows, traces, bursts |
| Kenney smoke | 77 | CC0 | Puff layers and smoke masks |
| Kenney light masks | 456 | CC0 | Default/inverted/transparent masks and variants |
| Kenney UI Adventure | 256 | CC0 | Reference controls and panels; adapt to the existing art direction |
| Kenney fantasy borders | 281 | CC0 | Decorative border references and vectors |
| Official Godot sprite shaders | 9 | MIT | Aura, outline, shadows, dissolve, glow |
| Godot VFX Library shaders | 24 | MIT | Status effects, portal, environmental and screen effects |
| Selected Game-icons.net weapon/skill icons | 239 | CC BY 3.0, with author-specific CC0 exceptions | Weapon/skill UI; retain each author's credit |
| Official Godot 2D particles demo | Separate project, 1 scene | MIT | GPUParticles2D examples |

Full selected original demos remain under `references/free_2d/upstream/`, outside the strict main project. The VFX Library plugin/autoload managers were not enabled; they require adaptation to the game's existing clocks, strict types and cleanup rules before any integration.

The two production selections are copied separately into `assets/vfx/kenney_impacts/`. Only those textures and their notices are used by `battle_hit_fx.gd`. No other reference texture, icon or shader is connected to gameplay. Character sheets, portraits, chibis and ultimate illustrations remain project-generated art.

The 33 copied canvas shaders were bound in small isolated SubViewports on the current Compatibility renderer without shader errors. This is a compilation smoke check, not validation of every sampler default, visual composition or Android performance. The native source-study gallery is `scripts/art_review/free_2d_library_review.gd`.
