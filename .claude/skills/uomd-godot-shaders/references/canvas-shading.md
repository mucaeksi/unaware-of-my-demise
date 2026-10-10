# Canvas shader review

Modified 2026-10-09 from S01 (Apache-2.0); original shading-language.md, LICENSE and NOTICE are preserved in the shared source archive.

Use canvas_item vertex/fragment outputs for 2D. COLOR modulation, premultiplied versus straight alpha and imported texture color space must agree. source_color is appropriate for color inputs, not every data/noise sampler. Screen-reading depends on capture/draw ordering and viewport boundaries; test nested CanvasLayer/SubViewport layouts.

Document each uniform's type/default, units, independent material ownership and reset value. Check progress at 0, 0.5 and 1, reversed direction, non-square surfaces, soft/hard masks, texture repeat and filter. Test edges at real output sizes. Screen texture mipmaps and extra samples carry costs; confirm the actual Compatibility path and measure the Android target.

Spatial, sky/fog, 3D depth/normal and Forward+ examples in the archived source are outside this skill's selected scope. Native render compilation, visual evidence and device performance are separate results.

Universal Transition Shader study: the tested horizontal recipe uses progress 0→2, with 1 at half wipe. Do not assume a universal 0→1 range. The original mask branch divides by local_progress, so zero/bias-induced zero requires an explicit recipe guard before production; masks/clocks/shapes and other aspect ratios have separate acceptance.
