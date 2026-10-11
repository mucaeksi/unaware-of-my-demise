# Free, license-compatible assets (vetted)

Status: research only, 2026-10-11. **No binary was added to the repo and no paid API was called.** Every download below was fetched with `curl` (through the session proxy) into a scratchpad directory outside the repo, inspected, and left there. English text.

Context: owner direction (2026-10-11) is that all character, story and key visuals are generated with Google Gemini image models; free CC0 or Phaser-compatible assets cover **VFX and generic UI**; sound and music come last (not covered here). Budget guard: `content/budget/media_budget.json` ($20/month, $3/batch, 3 attempts/asset). Nothing in this file consumes budget.

Fit scale used below: **Good** = usable as-is after tint; **Fair** = usable with work or only for placeholders; **Poor** = do not use for the shipped look.

## 1. Decisions in one screen

1. **Lean on Phaser 4.2.1 built-ins first** (particle emitter, Vignette/Glow/Blur/ColorMatrix/GradientMap filters, `Phaser.Actions.AddEffectBloom`). They cost no asset, no attribution beyond the engine's MIT notice, and the game already uses two of them.
2. **Kenney Particle Pack + Kenney Light Masks (both CC0)** are the VFX sprite source: slash arcs, impact flares, rune circles, rings, smoke, debris, light shafts. They are neutral white/grey, so they take our muted violet/bronze/ash by tint plus ADD blend.
3. **game-icons.net (CC BY 3.0) is the only symbol set with real thematic fit** (ringing bell, crown, crowned skull, candle, raven, coffin). It is usable **only with a credits-screen attribution** (block in section 12). Kenney Game Icons (CC0) covers plain system glyphs.
4. **Fonts are already free**: Cinzel and Cormorant Garamond, SIL OFL 1.1, via `@fontsource` (already imported in `apps/game/src/main.ts`). The OFL license text must ship with the app.
5. **"Made with Phaser"**: there is **no separate badge file**. The official logo files are public and the Trademark Policy lets us show the logo to say a game was built with Phaser, unmodified except proportional scaling. The pixel-art logos are explicitly offered for use in games and may be re-coloured. Recommendation: pixel-art logo, with the text wordmark as the fallback. Details in section 8.
6. **Phaser's examples assets are not shippable.** Their README says so, and our game carries ads (AdMob). Rejected outright (section 9).

Heads-up on style: the Kenney sprites are clean, soft, generic glows. They suit the generic VFX layer (hit flash, ambient ash, ripples). They will not give painterly anime hero effects; skill cut-ins and key VFX should stay on the Gemini pipeline.

## 2. How verification was done

- Each asset page was fetched with `curl -L` and the license read from the page and from the license file inside the archive.
- Each archive or file was downloaded with `curl -L` and extracted/inspected; HTTP status and byte size are recorded. Where useful, SHA-256 is recorded so the intake record can pin the exact bytes.
- Previews were rendered into contact sheets and judged against the game's dark-fantasy muted-violet/bronze/ash look.
- Licenses on OpenGameArt (OGA) were read from each page's `License(s):` field. OGA pages can list several licenses; only pages showing **CC0 alone** are marked CC0 here.
- This is engineering due diligence, not legal advice. CC BY 3.0 in particular is worth one owner glance.

Intake rule for any asset that later enters the repo or an R2 patch: record source URL, retrieval date, license text, archive SHA-256, file SHA-256, any modification (recolour, resize, invert) and whether credit is required. README already requires license/source records for media.

## 3. Phaser 4.2.1 built-ins (no external file)

Source checked: `node_modules/phaser` 4.2.1 (`src/filters/*`, `src/actions/AddEffectBloom.js`, `types/phaser.d.ts`, `skills/filters-and-postfx`, `skills/particles`). License: MIT, "Copyright (c) 2026 Richard Davey, Phaser Studio Inc." (`node_modules/phaser/LICENSE.md`). Attribution is not required by MIT, but the copyright and permission notice must be kept in copies, so list it in the third-party notices.

Already used in the repo: `cameras.main.filters.external.addVignette(...)` in `TitleScene`, `StoryScene`, `BattleScene`; a canvas-generated `fx_spark` texture (`BootScene`) feeding `add.particles` in `StudioScene`/`BattleScene`; panels drawn with `Graphics.generateTexture` (`ui/kit.ts`). So the repo currently ships **no external VFX or UI binary**.

| Built-in | API (verified in 4.2.1 types) | Use for us |
|---|---|---|
| Particle emitter | `this.add.particles(x, y, texture, config)`; `speed`, `angle`, `scale`, `alpha`, `tint`/`color` + `colorEase`, `blendMode: 'ADD'`, `lifespan`, `gravityX/Y`, `accelerationX/Y`, `moveToX/Y`, `emitZone` (random/edge), `deathZone`, `anim`, `explode()`, `flow()`, `fastForward()`, `createGravityWell()` | embers, ash, hit bursts, ripples, ambient drift |
| Vignette | `filters.internal/external.addVignette(x, y, radius, strength, color, blendMode)` (NORMAL/ADD/MULTIPLY/SCREEN) | darkened, tinted frame for story and battle |
| Glow | `addGlow(color, outerStrength, innerStrength, scale, knockout, quality, distance)` | halo on bell, runes, selected unit; `quality` and `distance` are fixed at creation |
| Blur, Bokeh, TiltShift | `addBlur(quality, x, y, strength, color, steps)`, `addBokeh(radius, amount, contrast)`, `addTiltShift(...)` | depth-of-field on story backdrops, pause/menu blur |
| ColorMatrix, GradientMap, Quantize | `addColorMatrix()`, `addGradientMap(config)`, `addQuantize(config)` | desaturate and grade the whole scene toward violet/bronze; stylised "memory" scenes |
| Displacement | `addDisplacement(texture, x, y)` | heat haze, shockwave (needs a proper displacement map; untested) |
| Shadow, Threshold, Mask, Blend, Wipe, Pixelate, Barrel, Blocky, Key, Sampler, PanoramaBlur, ImageLight, NormalTools, CombineColorMatrix | `add*` on `FilterList` | transitions (`addWipe`), spot effects |
| Bloom | **No dedicated filter.** `Phaser.Actions.AddEffectBloom(cameraOrObject, config)` returns `{ parallelFilters, threshold, blur }`; or by hand `addParallelFilters()` + `top.addThreshold(0.5, 1)` + `top.addBlur()` + `blend.blendMode = ADD` (example in `ParallelFilters.js`) | subtle glow on bright VFX; best as a full-screen effect |
| Shine | `Phaser.Actions.AddEffectShine(...)` | rare/gacha card sheen |
| Procedural objects | `add.gradient`, `add.noise` (simplex and cell, 2D/3D/4D), `add.pointlight`, `add.spriteGPULayer`, `add.nineslice`, `add.stamp` | mist/fog from noise, light shafts from gradients, thousands of drifting ash motes in one draw call (`spriteGPULayer`), 9-slice panels |

Cautions (be critical):

- Filters are **WebGL only**. There is no Phaser 3 `postFX` API anymore; port tutorials accordingly.
- **External** filters are full-screen passes and the most expensive. Prefer `filters.internal` or a one-time baked overlay for the permanent vignette, and **profile on a low-end Android device** before keeping it on every scene (README requires real-hardware profiling).
- Blur and Glow sample outside the object; call `setPaddingOverride(null)` or enlarge the camera or edges clip.
- Bloom applied to an object with alpha cannot blend its glow correctly; use it on the camera.
- Phaser's ParticleEmitter needs a texture. Until sprites are intake-approved, keep the code-generated `fx_spark`.

## 4. CC0 sprite packs for VFX

All Kenney pages and archives were fetched from `kenney.nl` (HTTP 200). The archive URLs contain a content hash; if one ever 404s, re-read the asset page and take the new link.

### 4.1 Kenney Particle Pack — recommended (fit: Good after tint)

- Page: https://kenney.nl/assets/particle-pack  (page metadata: "Files 80x", "License Creative Commons CC0", tile size 512 x 512)
- License, verbatim from `License.txt` (Particle Pack 1.1): "License (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/ . You may use these assets in personal and commercial projects. Credit (Kenney or www.kenney.nl) would be nice but is not mandatory."
- Attribution required: **No** (courtesy credit suggested).
- Tested download: `https://kenney.nl/media/pages/assets/particle-pack/f8fe0f8cb8-1677578741/kenney_particle-pack.zip` -> **HTTP 200, 15,001,764 bytes**, SHA-256 `b631d4b07f7002549fdcf155f01141ad482f79f3440e4e301eed49ce5f1d8958`. Extracted: 80 transparent PNGs at 512 x 512 (`PNG (Transparent)/`), black-background copies, rotated variants, and a Unity package (do not use the Unity package).
- Look: white/grey soft glows and line shapes with transparency, so they tint cleanly. Names verified visually:
  - `slash_01`..`slash_04` crescent arcs; `twirl_01`..`twirl_03` large crescent swirls; `scratch_01` triple claw scratch.
  - `star_05`..`star_09` soft discs and 4-point flares for impact flashes; `flare_01` thin lens flare.
  - `scorch_01`..`scorch_03`, `fire_01`, `fire_02`, `dirt_01`..`dirt_03` debris/ash bursts.
  - `circle_01`..`circle_05` rings of varying softness plus a soft disc; `light_01`..`light_03` concentric glows.
  - `magic_01`..`magic_05` rune-node circles, crosshair and 4-point star (`magic_01`/`02` are the useful ring-of-nodes ones).
  - `smoke_01`..`smoke_10` (`smoke_10` is a ring), `flame_02`/`flame_03` wispy curls, `flame_05`, `muzzle_*` flame jets.
  - `spark_01`..`spark_07` are **lightning/electric arcs**, not hit sparks.
  - Poor fit, skip: `symbol_01` (heart), `symbol_02` (star), `window_*` (white panes), `trace_*` (thin streaks, only for speed lines).
- Size: all transparent PNGs 5.4 MB. A 39-sprite working subset is 3.46 MB raw PNG, **about 517 KB as 256 px WebP, about 186 KB as 128 px WebP** (measured with the repo's `sharp`).
- Recommended use: the generic VFX layer (section 5). Pack ~40 sprites into one atlas at 256 px; most are used at small scale on a 1920 x 1080 canvas.

### 4.2 Kenney Light Masks — recommended (fit: Good for shafts and rings, Fair for windows)

- Page: https://kenney.nl/assets/light-masks  (v1.0, 2026-04-07)
- License, verbatim from `License.txt`: "License: (Creative Commons Zero, CC0) http://creativecommons.org/publicdomain/zero/1.0/ . You can use this content for personal, educational, and commercial purposes. Support by crediting 'Kenney' or 'www.kenney.nl' (this is not a requirement)".
- Attribution required: **No**.
- Tested download: `https://kenney.nl/media/pages/assets/light-masks/6530e254f9-1775631687/kenney_light-masks-1.0.zip` -> **HTTP 200, 15,017,378 bytes**, SHA-256 `e1238694d7e49046e42d67f2975be0217861c7cc9bc358383a8e5e583645004f`. 152 masks each in `Transparent/`, `Default/`, `Inverted/`, 512 px.
- Look: grey gradient masks. `cone_*` and `cone_composed_*` (with `_blur`/`_noise`) are light shafts; `ring_a..c`, `circle_rings_a..d` and `circle_*_streaks` are concentric rings and glows; `window_*` are window-shaped gobos (some arched; check visually before picking); `foliage_*`, `water_caustics_*`, `fan_*` are off-theme.
- Recommended use: god-ray shafts through windows (ADD, low alpha, slow drift), bell-ring ripple rings, soft vignettes/halos.

### 4.3 Kenney Smoke Particles — conditional (fit: Fair; only two of five folders)

- Page: https://kenney.nl/assets/smoke-particles  (v1.0, 2014; "Files 70x" on the page, 77 per the OGA mirror)
- License, verbatim from `license.txt`: "License (CC0) http://creativecommons.org/publicdomain/zero/1.0/ . You may use these graphics in personal and commercial projects. Credit (Kenney or www.kenney.nl) would be nice but is not mandatory."
- Attribution required: **No**.
- Tested download: `https://kenney.nl/media/pages/assets/smoke-particles/23249a0d35-1677695171/kenney_smoke-particles.zip` -> **HTTP 200, 6,019,666 bytes**, SHA-256 `97a1d09c66e4fd6c247c8ea87f84c0cc59caaeceae19414c995afb1616a1e1c9`. Folders: `Black smoke` (25), `White puff` (25), `Explosion` (9), `Flash` (9), `Fart` (9).
- Look: soft, rounded cartoon puffs, 336-550 px. **Use only `White puff` (tint to ash-violet, NORMAL blend) and `Black smoke` at low alpha.** `Explosion` and `Flash` have orange/yellow baked in and look cartoonish (poor fit); `Fart` is green (do not ship).
- Recommended use: only if `smoke_01..09` of the Particle Pack is not enough for animated multi-frame puffs.

### 4.4 Kenney Splat Pack — not recommended (fit: Poor)

- https://kenney.nl/assets/splat-pack (CC0). Tested `https://kenney.nl/media/pages/assets/splat-pack/1070534984-1677495350/kenney_splat-pack.zip` -> HTTP 200, 351,719 bytes. Flat white paint-splat blobs; cartoon, not our look. Skip.

### 4.5 OpenGameArt: Weapon Slash - Effect — optional (fit: Fair, low resolution)

- Page: https://opengameart.org/content/weapon-slash-effect  (author per page text: Cethiel)
- License, from the page `License(s):` field: "CC0". Attribution required: **No**.
- Tested download: `https://opengameart.org/sites/default/files/Everything_0.zip` -> **HTTP 200, 2,078,113 bytes**, SHA-256 `163eb4e4d41385f3b888e7176c6da077d0e7fa7c101da96bbaa4645a2ec9d673`. Five slash animations in four colour variants (`Classic`, `Alternative 1` purple, `Alternative 2` blue, `Alternative 3` fire), frames about 126 x 150 px.
- Look: crescent-swipe frame animations; the purple variant sits well with the violet palette. **Resolution is low** for a 1920 x 1080 reference (visible softness when upscaled; the author sells higher-res versions).
- Recommended use: only if we want frame-animated slashes; otherwise the Kenney crescents with a scale/alpha tween are sharper.

### 4.6 OpenGameArt: 4 summoning circles — optional (fit: Good for rune ground decals after processing)

- Page: https://opengameart.org/content/4-summoning-circles  License field: "CC0". Attribution: **No**.
- Tested downloads: `https://opengameart.org/sites/default/files/summoning_circles.zip` -> **HTTP 200, 4,306,421 bytes**, SHA-256 `d07138ac5bee5242a4672abf321e2dff84dd7ababbe06b96f97ec530361eb5e9` (contains `circle4..7` as `.png`, `.svg`, `.ai`); single PNGs such as `https://opengameart.org/sites/default/files/circle5.png` -> HTTP 200, 46,259 bytes (1000 x 1000, **opaque white background, black ink**).
- Look: hand-inked arcane glyph rings (invented runes), black on white. Use the SVG, or invert the PNG offline, then tint and draw with ADD blend; rotate slowly under a unit for buffs, banners, Yseldra scenes.
- Note: the PNG is not transparent; do not drop it in as-is.

### 4.7 Other OpenGameArt items checked and rejected

| Item | License on page | Verdict |
|---|---|---|
| Animations - Blood, Hit and Both (https://opengameart.org/content/animations-blood-hit-and-both-d); `0_16.png` HTTP 200, 470,404 B; `1_128.png` 289,754 B; `2_75.png` 376,486 B (2048 x 2048, 16 frames of 512) | CC0 | Poor fit: red cross-flares and blood; keep only if recoloured, and we do not need it. Skip |
| Sunbursts / 2D Rays (https://opengameart.org/content/sunbursts-2d-rays); `sunburst_blackandwhite2.png` HTTP 200, 87,145 B | CC0 | Poor fit: hard-edged cartoon sunburst. Kenney Light Masks cones are better |
| Vertical Particle Effects: Blue and gold (https://opengameart.org/content/vertical-particle-effects-blue-and-gold) | CC0 | Poor: the "ring" files are tiny vertical streak strips, not rings |
| Magic Summoning Circle (https://opengameart.org/content/magic-summoning-circle), `SummoningCircle.zip` HTTP 200, 520,168 B | CC0 | Poor fit: 3D-rendered teal/blue toy platform; also ships `.fbx` and a city-kit ad |
| teleport circle - sprite sheet (`teleportCircle.png` HTTP 200, 1,692,991 B) | CC0 | Poor: very dark and low contrast |
| Smoke Vapor Particles (`smoke1.png`..`smoke4.png`, 512 px, HTTP 200, 113-167 KB each) | CC0 | Fair, redundant with Kenney `smoke_*` |
| Spark effect (`spark_sprite_strip9.png`, 288 x 32, HTTP 200, 583 B) | CC0 | Poor: tiny pixel-art strips |
| Particle textures (64 x 64 sparkles, `bishie_sparkle_1.png` HTTP 200, 1,526 B) | CC0 | Poor: 64 px is too small |
| 25 special effects rendered with blender (`blender-volumetric-particles-effects.zip` HTTP 200, 24,574,812 B) | CC0 | Poor value: 128 px frames, 24 MB, blender sources |
| Auras (GIF/7z, Substance sources) | CC0 | Not usable without Substance Player and 7z; skip |
| Special Effects (CC0) by angelx | not captured | Not vetted: no downloadable file was exposed on the page |
| OGA mirrors "Particle Pack (80+ sprites)" and "Smoke particle assets" (e.g. `kenney_particlePack.zip` HTTP 200, 9,760,286 B) | CC0 | Same Kenney content; take it from kenney.nl instead |

## 5. Effect recipes (what to take for each need)

Tint and timing values are starting points to tune in the browser preview, not locked art direction.

| Need | Recipe |
|---|---|
| Slash / hit | Kenney `slash_01..04` or `twirl_01..03` at the target, ADD blend, tint bronze `0xd9a65a` or violet `0xa98bd9`, scale 0.6 -> 1.2 and alpha 1 -> 0 over ~180 ms; impact flash `star_06`/`star_08` + debris `scorch_01/02`; `scratch_01` for claw/beast attacks |
| Magic glow | `star_05` or `circle_05` soft disc + `light_01..03`, ADD, plus internal `addGlow` on the caster; rotating `magic_01`/`magic_02` as a cast circle; OGA summoning circle (inverted) as a ground decal |
| Smoke | `smoke_01..09` tinted `0x6f6580`, NORMAL blend, alpha 0.25-0.5, slow rise; or Smoke Particles `White puff`; layered with `add.noise` mist for large areas |
| Embers / ash | Emitter with `circle_05` or `star_05` at scale 0.03-0.12, bronze/orange tint, ADD, low gravity, `emitZone` across the screen; ash from `dirt_01..03` or `scorch_03` in grey, NORMAL blend, slow fall. For hundreds of ambient motes use `add.spriteGPULayer` |
| Light rays | Kenney Light Masks `cone_*`/`cone_composed_*` (blur/noise variants), ADD, alpha 0.15-0.35, slow alpha/position tween; optionally an arched `window_*` gobo as the shape source |
| Bell-ring ripples | 2-3 staggered rings (`circle_01..04` or Light Masks `ring_a..c`), scale 0.2 -> 1.6, alpha 0.8 -> 0, ADD with silver-white tint, 100-150 ms apart, `addGlow` on the ring; no-asset fallback is `Graphics.strokeCircle` with the same tween |

## 6. Icons and generic UI

### 6.1 game-icons.net — recommended for thematic icons (fit: Good; **attribution required**)

- Site: https://game-icons.net (about page: https://game-icons.net/about.html). Repo mirrored on jsDelivr: `https://cdn.jsdelivr.net/gh/game-icons/icons@master/<author>/<icon>.svg` (the plain GitHub UI/raw API for the repo is not reachable from this session; jsDelivr and `raw.githubusercontent.com` are).
- License, verbatim from the repo `license.txt` (fetched, HTTP 200, 1,421 bytes): "Icons provided under the Creative Commons 3.0 BY or CC0 if mentioned below." and "Please, include a mention "Icons made by {author}" in your derivative work." The about page adds: "A mention like "Icons made by {author}. Available on https://game-icons.net" is fine." Only the contributors marked CC0 in that file (Viscious Speed, Zeromancer) are CC0; everything else is **CC BY 3.0** (https://creativecommons.org/licenses/by/3.0/).
- Attribution required: **Yes**, per author whose icon is used. If an icon is recoloured, say so in the credit (CC BY expects adaptations to be identified).
- Size/format: 4,229 SVGs on 512 x 512 viewBox, white shape on a **black background rect** (`<path d="M0 0h512v512H0z"/>`): strip that rect or use the repo's `colorize-svgs.sh transparent` approach before using as a tinted glyph. Single files are about 0.4-2.4 KB.
- Tested sample downloads (all **HTTP 200**): `lorc/ringing-bell.svg` 2,189 B; `lorc/bell-shield.svg` 892 B; `lorc/crown.svg` 1,609 B; `lorc/crowned-skull.svg` 1,926 B; `lorc/candle-flame.svg` 1,319 B; `lorc/raven.svg` 874 B; `lorc/coffin.svg` 399 B; `lorc/magic-swirl.svg` 1,273 B; `lorc/broken-shield.svg` 1,272 B; `lorc/sword-wound.svg` 1,063 B; `lorc/ankh.svg` 830 B; `lorc/cut-diamond.svg` 500 B; `delapouite/church.svg` 1,399 B; `delapouite/sparkles.svg` 1,898 B; `delapouite/spell-book.svg` 2,419 B; `delapouite/two-coins.svg` 1,075 B; `darkzaitzev/hooded-figure.svg` 1,415 B; `zeromancer/heart-plus.svg` 425 B (CC0 author). `lorc/bell.svg` does **not** exist (HTTP 404); the bell icons are `ringing-bell` and `bell-shield`.
- `@master` is a moving ref; pin a commit SHA when ingesting (the GitHub API was not reachable, so record the SHA from jsDelivr's package page at intake) and store the file SHA-256.
- Look: bold white silhouette icons, gothic-leaning and already on theme for a bell/crown/death motif. Judged Good for currency, status, rarity and menu icons once tinted bronze/silver; weaker for very detailed gear icons.
- Recommended use: roughly 20-40 hand-picked icons, always tinted, never the full 4,229 set.

### 6.2 Kenney Game Icons — recommended for neutral system glyphs (fit: Fair)

- Page: https://kenney.nl/assets/game-icons  (v1.0, 2014, "Files 105x", CC0)
- License, verbatim from `license.txt`: "License (CC0) http://creativecommons.org/publicdomain/zero/1.0/ . You may use these graphics in personal and commercial projects. Credit (Kenney or www.kenney.nl) would be nice but is not mandatory." Attribution: **No**.
- Tested download: `https://kenney.nl/media/pages/assets/game-icons/1ebf9c14af-1677661579/kenney_game-icons.zip` -> **HTTP 200, 1,045,980 bytes**, SHA-256 `7a86d8d58e0b851e22004b3c70bf90b003632bbf9ac633424daa3bb17d9e7e4e`. 105 icons in white and black, 50 px (1x) and 100 px (2x) PNG, plus SVG and sprite sheets.
- Look: chunky rounded flat glyphs (arrows, gear, check, close, lock, trash, shop cart, audio, info). Neutral and clean, but **not gothic**; fine as tinted placeholders for settings/system screens, poor for diegetic or premium-feeling UI.

### 6.3 Generic UI frames

- **Kenney Fantasy UI Borders** (https://kenney.nl/assets/fantasy-ui-borders, CC0, "Files 140x"): tested `https://kenney.nl/media/pages/assets/fantasy-ui-borders/ab29cd0165-1701602367/kenney_fantasy-ui-borders.zip` -> HTTP 200, 358,780 bytes, SHA-256 `59532da3bd61195a425585455b40baa6cbf1eda8227c42adcef31a535a737769`. Clean white corner-ornament frames with `Border`, `Panel`, `Divider` folders (Default and Double), tintable, suited to `add.nineslice`. Fit: **Fair**; geometric more than gothic, so only for temporary frames; our `ui/kit.ts` generated panels already carry corner ornaments. Low priority.
- **Kenney UI Pack** (https://kenney.nl/assets/ui-pack; HTTP 200, 1,229,750 bytes): flat bright blue casual UI. **Poor** fit.
- **Kenney UI Pack - Adventure** (https://kenney.nl/assets/ui-pack-adventure; HTTP 200, 577,463 bytes) and **UI Pack: RPG Expansion** (https://kenney.nl/assets/ui-pack-rpg-expansion; HTTP 200, 214,394 bytes): toon/parchment brown and grey, cartoon. **Poor** fit. All three are CC0 but we should not use them.

## 7. Fonts already in `package.json`

| Font | Package | License | Used weights (from `apps/game/src/main.ts`) |
|---|---|---|---|
| Cinzel | `@fontsource/cinzel` 5.2.8 | OFL-1.1 | latin 600, 700 (woff2 about 15 KB each) |
| Cormorant Garamond | `@fontsource/cormorant-garamond` 5.2.11 | OFL-1.1 | latin 500 normal and italic (woff2 about 23-24 KB each) |

- License text, verbatim opening of each `LICENSE`: "Copyright 2020 The Cinzel Project Authors (https://github.com/NDISCOVER/Cinzel) . This Font Software is licensed under the SIL Open Font License, Version 1.1." and "Copyright 2015 The Cormorant Project Authors (github.com/CatharsisFonts/Cormorant) ... This Font Software is licensed under the SIL Open Font License, Version 1.1." Upstream OFL files were also fetched (HTTP 200: `raw.githubusercontent.com/google/fonts/main/ofl/cinzel/OFL.txt`, 4,383 B; `.../cormorantgaramond/OFL.txt`, 4,387 B).
- Attribution required: OFL asks that the **copyright notice and license text accompany any redistribution** of the font files. Credit lines in the credits screen plus the full OFL text in the app's notices satisfy this. Fonts may not be sold by themselves; embedding in an app is fine. Neither license declares a Reserved Font Name.
- Coverage warning: only the `latin` subset is loaded. Neither font has CJK, so any on-screen Japanese would need a separate OFL CJK font (for example Noto Serif JP); `latin-ext` files exist if Turkish or other accented text is ever shown.

## 8. Phaser logo ("Made with Phaser")

Findings (pages retrieved 2026-10-11):

- Logo page: https://phaser.io/download/logo. Trademark Policy: https://www.phaser.io/download/trademark. License page: https://phaser.io/download/license (MIT for the code, and "Please see the trademark policy for details about using the Phaser logo or branding").
- **There is no separate "Made with Phaser" badge or file.** "Made with Phaser" is the title of the https://phaser.io/games showcase page; `https://phaser.io/made-with-phaser` returns 404. The only official brand files are the logos below.
- Trademark Policy, verbatim: "The Phaser name and logos are trademarks of Phaser Studio Inc." You may "Use the Phaser logo to indicate that your game or application was built with Phaser." and "State "Powered by Phaser" or "Built with Phaser" in your project." You may not "Modify the Phaser logo in any way, other than proportional scaling.", nor "Use the Phaser name or logo in a way that implies endorsement or sponsorship by Phaser Studio Inc."
- Logo page, verbatim for the pixel-art set: "Intended for use in your own games and demos (commercial and non-commercial alike). They do not follow the same trademark guidelines as the logos above. You are free to re-colour these logos as required."
- Phaser's own README: "The Phaser logo and characters are (c) 2011 - 2026 Phaser Studio Inc. All rights reserved." So the logo is **not** under the MIT license; permission comes only from the policy text above. There is no separate license file.

Tested files (all HTTP 200 from `https://cdn.phaser.io/images/logo/`; the site's own `https://phaser.io/api/cdn-download?url=...` route also returns the same 153,755-byte PNG; `raw.githubusercontent.com` has no logo asset):

| File | Size | Dimensions | SHA-256 | Notes |
|---|---|---|---|---|
| `phaser-pixel-large-shaded.png` | 994 B | 208 x 50 | `707b0d15efe9f97a7d19e34ac78714d874f3f924a215b6a94892dbe5a16d67f0` | grey/white pixel wordmark with black outline; recolourable |
| `phaser-pixel-medium-shaded.png` | 764 B | 104 x 25 | `96d612e6bfaa223da43efad0dea5c42445ece6bc9a7e852c971de9bf69184057` | |
| `phaser-pixel-medium-flat.png` | 522 B | 104 x 22 | `114613acb2da354dca5e82725a258b37fdc586b60f4d52b73d46f378f9ad0da5` | |
| `phaser-pixel-small-flat.png` | 322 B | 51 x 11 | `a737a6617f2e503988f48bfe57f794eef758d7825649bec99b01c7195e7259a4` | |
| `phaser-logo.png` | 153,755 B | 2000 x 434 RGBA | `ad7f0d459b4e160cade16523aead985bc4e8a500bcdaf3bb84a6198a673b2ff0` | official 2D wordmark: pale-blue glass fill with thick black outline; **cannot be recoloured** |
| `phaser-logo.svg` | 3,704 B | vector | `4ef3f1028fb2d21e5100b0d9b972fcee95fc3b69a0550359572cbf7073cddda2` | same wordmark; fills `#b8eefe`, `#8fb7e5` |
| `phaser-planet-small.png` / `-web.png` | 180,337 B / 3,085,182 B | 382 x 331 / 3000 x 2500 | not recorded | planet mark; not needed |

Verdict on bundling: **permitted for the stated purpose** (telling players the game is built with Phaser), under the policy's conditions. Fit: the 2D wordmark's saturated blue glass look is **poor** against the muted violet/bronze palette and cannot be tinted; the grey pixel logo is neutral and tints freely, but is pixel-art against a painterly game (acceptable on a 2.5 s black splash).

Recommendation, in order:

1. **Pixel-art `phaser-pixel-large-shaded.png`**, integer scale (4x = 832 x 200 at the 1920 x 1080 reference), `NEAREST` filtering, tint to ash-white if wanted, fade in/out on black, with the text "Made with Phaser" in Cinzel under it if the owner wants the exact phrase. This is the option the logo page explicitly allows for games, including re-colouring.
2. If the owner prefers the full-colour official logo: use `phaser-logo.png` or `.svg` **unmodified**, proportional scale only, no tint/glow/filter; opacity fades are a transition, but ask Phaser Studio (the policy invites questions) if unsure.
3. **Wordmark-text fallback**: if the owner wants zero trademark exposure, keep the current plain "Made with Phaser" text (docs/GAME_FLOW.md already describes this) and do not bundle any logo file.

Risk notes: store a dated snapshot of the logo page and policy (URL, retrieval date, file SHA-256) with the provenance record, because the permission is a web-page statement, not a license file; consider a one-line email to Phaser Studio for written confirmation; do not use the logo in the Play Store icon, feature graphic or screenshots' branding; do not imply endorsement (see the disclaimer in section 12).

## 9. Considered and rejected

- **Phaser examples assets** (https://github.com/phaserjs/examples, README fetched from `raw.githubusercontent.com`): "The source code in this repo is released under the MIT license. The assets are not. Lots of the assets in this repo come from old classic arcade / computer games or open and stock art sites. As such, you cannot use them in your own commercial games, or for any games that carry advertising." The old `photonstorm/phaser3-examples` URL serves the byte-identical README (it is the same, renamed repo). **Do not ship anything from this repo.** No separate asset license file was found at the usual paths (404 on `LICENSE`, `LICENSE.md`, `public/assets/README.md`, `public/assets/LICENSE`), so individual assets cannot be cleared item by item here.
- Not CC0, so excluded from the free-and-no-credit set: OGA "Sparks (Fire, Ice, Blood)" (CC BY 3.0), "Smoke & Fire Animated Particle [16x16]" (CC BY 3.0), "Colored summoning circles" (CC BY 3.0), "Lens-Flares and Particles - ring.png" (CC BY and CC0 listed together), "Tiny Magic Glyphs" (OGA-BY 3.0 and CC0 listed together). Licenses for these came from search listings, not downloads; re-verify before any use.
- Pixel-art packs (OGA Fire Smoke Animations, pixel sword slash, explosions) clash with the painterly-anime direction.
- Kenney colour-baked folders (`Explosion`, `Flash`, `Fart`) and UI packs: poor fit as above.

## 10. What not to do

- Do not commit the extracted packs. Pick the sprites, record provenance, atlas them (about 0.2-0.5 MB), and ship through the normal asset path (R2 patch manifest with license/source fields).
- Do not use the Unity package or `.fbx`/`.blend` sources inside the archives.
- Do not mix free VFX colours with the Fadyme identity palette in character prompts; VFX stay tint-driven, and character art stays on the locked reference sheet.
- Do not remove the credits for CC BY or OFL material when assets are swapped later; the credits file should be generated from the provenance records.

## 11. Ranked shortlist ("use these")

1. **Phaser 4.2.1 built-ins**: particles, Vignette, Glow, Blur, ColorMatrix/GradientMap, `AddEffectBloom`, noise/gradient/spriteGPULayer (MIT, in `node_modules`). Zero cost; profile external filters on Android.
2. **Kenney Particle Pack** (CC0): about 40 sprites for slash, impact, magic, smoke, debris, rings.
3. **Kenney Light Masks** (CC0): light shafts, bell ripples, halos.
4. **@fontsource Cinzel + Cormorant Garamond** (OFL 1.1): already installed; ship OFL text.
5. **game-icons.net selected icons** (CC BY 3.0, credit required): bell, crown, skull, candle, raven, coffin and other themed icons.
6. **Phaser pixel-art logo `phaser-pixel-large-shaded.png`** (policy-permitted for games, recolourable) for the splash; text wordmark as fallback.
7. **Kenney Game Icons** (CC0): neutral system glyphs, tinted placeholders.
8. **OGA 4 summoning circles** (CC0): rune ground decals after inversion/SVG use.
9. **Kenney Smoke Particles** (CC0), `White puff` and `Black smoke` folders only.
10. Optional, low priority: **OGA Weapon Slash purple** (CC0, low-res) and **Kenney Fantasy UI Borders** (CC0, temporary frames).

Skip: Kenney Splat Pack, Kenney UI Pack / Adventure / RPG Expansion, every Phaser examples asset, all other OGA items in section 4.7.

## 12. Attribution block (paste into the credits screen)

Only the lines for assets that actually ship need to stay. Required lines are marked; the rest are courtesy.

```
THIRD-PARTY CREDITS

Engine
Phaser 4. Copyright (c) 2013-2026 Phaser Studio Inc. MIT License. https://phaser.io
Phaser and the Phaser logo are trademarks of Phaser Studio Inc.
This game is not endorsed by or affiliated with Phaser Studio Inc.

Typefaces                                                       [REQUIRED by the OFL: notice + license text]
Cinzel. Copyright 2020 The Cinzel Project Authors (https://github.com/NDISCOVER/Cinzel).
Cormorant Garamond. Copyright 2015 The Cormorant Project Authors (github.com/CatharsisFonts/Cormorant).
Both licensed under the SIL Open Font License, Version 1.1. https://openfontlicense.org

Icons                                                           [REQUIRED by CC BY 3.0; list only authors actually used]
Icons made by Lorc, Delapouite and DarkZaitzev. Available on https://game-icons.net
Licensed under CC BY 3.0, https://creativecommons.org/licenses/by/3.0/ . Some icons recoloured.

Visual effects                                                  [courtesy; CC0 does not require it]
Particle, smoke, light-mask and icon sprites by Kenney (www.kenney.nl), CC0 1.0, public domain.
```

Author names and homepages to match against the icons chosen (from the repo `license.txt`): Lorc (http://lorcblog.blogspot.com), Delapouite (http://delapouite.com), DarkZaitzev (http://darkzaitzev.deviantart.com). Add one name per additional folder used; CC0 authors (Viscious Speed, Zeromancer) need no credit. OGA CC0 items (summoning circles, weapon slash) need none either; a courtesy line is optional. If the pixel-art Phaser logo is shown on the splash, no extra text is mandatory, but keep the trademark and non-endorsement lines above.

## 13. Open questions for the owner

1. Phaser logo: pixel-art (recommended), full-colour 2D logo unmodified, or text-only wordmark?
2. Is a credits-screen attribution acceptable for game-icons.net (CC BY 3.0)? If not, limit icons to Kenney Game Icons and generate thematic icons with Gemini instead.
3. Should the permanent vignette stay an external camera filter, or be baked into a texture for low-end Android (needs profiling)?
4. Do we want a legal read of CC BY 3.0 and the Phaser logo terms before the first AAB?
