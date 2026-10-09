# Native source validation

Captured in an isolated Godot4.7.2 GL Compatibility project using Mesa llvmpipe. The running game/editor were not modified or restarted. 16 property clips, 12 generated locomotion frames, 6 VFX scenes, 12 prop/icon AtlasTextures and 3 still-shot scenes loaded and rendered. All VFX end renders match the backdrop exactly; max locomotion core foot delta0.0064px at240px height. Icons were sampled at48/96px. Still-shot beginning/middle/end and Reduced Motion scale tracks/paused seeks were checked.

The .gd fixtures use portable `user://fadyme-review-evidence` output; open this package’s isolated `project.godot` and run a fixture with --script. Their outputs are design evidence, not gameplay integration or production lifecycle acceptance. Managed cloud requires writable XDG data/config/cache paths. Do not commit .godot import/cache directories generated during later review.

No Android physical device/profile or final typography layout was tested. No source master was raster-edited outside image_gen; Pillow was used only for decode/alpha/hash measurement. Native captures are Godot-rendered evidence. Source inspection does not establish owner art approval.
