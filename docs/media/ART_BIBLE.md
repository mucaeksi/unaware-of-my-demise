# UOMD Art Bible — the single visual contract for generated media

v1 · 2026-10-11 · subordinate to `README.md` (sole master prompt) and `narrative/` canon; where they disagree they win and this file is corrected. For generation it supersedes the stale portrait-era `narrative/12_Production_Notes/Art_Source_Notes/ART_BIBLE.md` (1080×1920).
Every `art_specs/*.json` (`ImageSpec`, `packages/shared/src/media.ts`) and every row of `docs/media/QUEUE_DATA.json` must obey this file. English only. **No paid image call is recorded in the budget ledger (`entries: []`)**: rules marked *(unverified)* are hypotheses to confirm on the first approved, budget-reserved batch (the media.ts request shape is also unexercised).
Tags: **CANON** quoted from `narrative/` (path given) · **REF** read by eye from a reference image · **PROPOSAL** decision of this file, owner may replace · **UNKNOWN** not in canon: never invent it, never prompt for it.
Precedence: README > narrative canon > locked refs (`reference/locked/`, `narrative/14_References/recovered_locked_v001/`) > this file > `QUEUE*` > derived/legacy art. Budget (`content/budget/media_budget.json`): $20/month, $3/batch, ≤3 attempts/asset; Gemini image prices 1K $0.067 · 2K $0.101 · 4K $0.151 (`IMAGE_PRICES_USD`).

## 1. Palette tokens

### 1.1 UI tokens — copied from `apps/game/src/ui/theme.ts` (source of truth; edit both in the same commit)
| Token | Hex | Role | Token | Hex | Role |
|---|---|---|---|---|---|
| `C.void` | #0A0610 | scene bg, dim, grade overlay | `C.hpGood` | #6FBF73 | HP high |
| `C.ink` | #120A18 | panels, chips; **sprite/icon outline colour** | `C.hpMid` | #D9A441 | HP mid; also the one warm world accent |
| `C.plum` | #2A1530 | panel fill | `C.hpLow` | #C8324A | HP low |
| `C.plumHi` | #4A2548 | panel highlight | `C.focus` | #8FB8FF | focus bar |
| `C.silver` | #C9B6E4 | lilac ornament, sparks, embroidery | `C.shield` | #9FD0FF | shield |
| `C.bone` | #E9E2D4 | titles, wordmark ivory | `C.player` | #7FB2FF | ally ring |
| `C.gold` | #B8975A | frames | `C.enemy` | #D4325C | enemy ring |
| `C.goldHi` | #E3C37D | selected/focus gold | `C.crimson` | #8F1D3A | danger/omen |
| `C.veil` | #B48CFF | Veil element VFX | `C.crimsonHi` | #D4325C | hot/enemy |
Text `T.*`: text #EFE8F5 · dim #A99BB8 · gold #E3C37D · crimson #FF7A96 · heal #8FE3A0 · shield #9FD0FF · crit #FFD86B. Fonts: `F.display` Cinzel, `F.body` Cormorant Garamond. Type (1920×1080 ref px): title 96, h1 56, h2 40, body 38, small 30, touch ≥120. Depth: bg 0, world 100, units 200+y, fx 1400, hud 1600, modal 2000, toast 2200.
**Engine grade**: BattleScene lays #0A0610 at alpha 0.35 (top) → 0.65 (bottom) + vignette; StoryScene 0.05 → 0.7 + vignette. Generate plates ~10–15% brighter and lower in micro-contrast than the final look; the bottom third gets darkened anyway.

### 1.2 World tokens — measured (median of pixel clusters) from the locked/derived references unless marked PROPOSAL
| Token | Hex | Use | Source |
|---|---|---|---|
| `ash_ink` | #0F0D11 | darkest allowed value (never pure #000) | REF key art |
| `plum_shadow` / `plum_hood` | #22151E / #45293B | Fadyme hood and cloak shadow / mid-tone (sits between `C.plum` and `C.plumHi`) | REF Fadyme bust |
| `lilac_thread` | #C9B6E4 | silver-lilac embroidery (= `C.silver`) | CANON "silver-lilac" |
| `night_slate` / `mist_slate` | #3B434D / #474A54 | cold ambient: sky, mountains, stone | REF key art |
| `bridge_stone` | #1E1D23 | dark stone floor | REF key art |
| `forest_shadow` / `forest_mid` | #1F2626 / #333C3B | under-canopy / trunks and foliage (grey-green, never saturated moss) | REF battle plate |
| `ash_path` / `mist_sky` | #B4B09C / #C2CCCF | lightest ground value / overcast gap | REF battle plate |
| `bone_ivory` | #E9E2D4 | scarf, bone, wordmark (= `C.bone`) | CANON |
| `oxblood_shadow` / `oxblood` | #371C21 / #6B1E2C | Mahmut cloak: measured shadow / lit mid (PROPOSAL; stays darker than UI `C.crimson` so a cloak never reads as UI) | REF key art |
| `eclipse_ring` | #B06470 core, #E57C86 glow edge | thin ring only; the one crimson focal element in a scene | REF key art |
| `candle_amber` | #D9A441 (= `C.hpMid`) | single warm accent per image (camp fire measured #D19C77 on the plate) | REF plate |
| `brass_cold` | #66533E | Bellbound bell, "cold brass" | REF enemy board (candidate) |
| `ash_beige` | #5F4D41 mid-tone (lit ≈ +25% lightness) | Hollow Pilgrim coarse cloth | REF enemy board (candidate) |
| `ember_crack` | #D19C77 | tiny hot cracks on ash beasts only, never a surface fill | REF enemy board |
| `key_green` | #00FF00 | chroma key background ONLY (references measure #03FE03–#04FB06) | REF all green-screen refs |
Elements as art language (legacy `ART_BIBLE.md`, still the only source): Ember rust/furnace orange · Tide deep blue-green · Gale desaturated teal · Stone moss and iron · Dawn ivory and gold · Veil plum and silver. `BattleScene.ELEMENT_COLOR` tints (Veil #B48CFF, Stone #E0D2B0, Ember #FF8A4C, Tide #6CC4FF, Gale #9BE8C3, Dawn #FFE9A8) are VFX tints for particles/rings, not costume colours.

### 1.3 Colour rules
1. Dark-dominant: ≥60% of pixels at or below `mist_slate`; one focal light per image; shadows never below `ash_ink`, highlights never above #F2EDE4.
2. Crimson only as: eclipse ring, omen marks, wax seals, Mahmut's oxblood cloak. No red glowing eyes, no red wash (Bellbound card: "kırmızı parıltı bütün yüzeyi kaplamaz" = red glow never covers the whole surface).
3. Saturation stays low except plum, lilac and amber. No neon, no cyan/magenta glow.
4. Never encode state by red/green alone (shape, label or position must also differ).
5. Anything keyed on `key_green` may contain NO pixel with `g − max(r,b) > 40` (see §3.0); that bans emerald, moss, olive, acid-yellow and green glows on keyed subjects.

## 2. Rendering style rules
Two registers share one palette and material system (owner direction: all game visuals, buttons and chibis must harmonise with the single poster style, `narrative/00_Canon/Owner_Current_Direction/VISUAL_REFERENCE_BRIEF_2026-10-05.md`): **R1 painterly gothic anime** (busts, plates, event art, key art, design sheets), **R2 chibi battle** (sprites), **R3 icon glyph** (UI icons, only class with a heavy contour).
- **Line.** R1: thin soft coloured line (deep plum-black, never pure black), slightly heavier on the outer silhouette, fine hair strands. Plates: no outlines, painted edges. R2 (REF `fadyme_battle_pose_idle_v002`): uniform bold outline in `C.ink` #120A18, ≈2–3% of figure height, closed shapes, no outline on the ground. R3 (REF `icons_pilot_mixed_16`): bold ink contour, constant weight across a sheet.
- **Shading.** R1: soft cel on skin (2–3 value steps), painterly gradients on cloth, occlusion in folds, matte materials. R2: flat 2-tone cel + one hard highlight, embroidery kept as simple lilac line-vines. R3: flat cel + one hard highlight.
- **Texture.** Visible brush grain and paper tooth, woven cloth, scuffed leather, worn dull metal; painted architecture. Never plastic, glassy-smooth, airbrushed or 3D-render looking.
- **Lighting.** Cool ambient (`night_slate` family) + at most one warm rim/practical (`candle_amber`: fire, lantern, last sun) per image, same direction across a set. Eclipse ring only in sky/key art. Fog and ash flakes may drift in plates (never baked into keyed sprites).
- **Camera.** Busts: three-quarter, eye level, fixed crop across an expression set. Plates: shallow raised 3/4 for battle, eye level for story. Chibi: 3–3.5 heads tall (REF), large head, small hands, full silhouette readable at 360 px.
- **Mood words that should work** *(unverified)*: painterly dark gothic anime, light-novel illustration, detailed face and hair, matte cloth, weathered leather, worn dull metal, warm rim light with cool ambient light, soft brush grain, painted architecture, restrained palette, charcoal and plum and bone-ivory, damp mist, drifting ash, hushed, intimate, melancholic, quiet dignity, understated.
- **Words to avoid**: photorealistic, 3D render, CGI, Unreal/octane, 8K hyper-detailed, HDR, glossy, plastic, neon, vaporwave, cyberpunk, pixel art, flat vector clip-art (R3 excepted), gore, blood splatter, horror, jump scare, sexy, seductive, pin-up, waifu, "epic", "masterpiece", "trending on ArtStation", any artist/franchise/game name (IP), "glowing red eyes", cross/holy/angelic motifs (owner brief rejects the cross-sword identity), and the word "chibi" outside R2.

## 3. Per-asset-class conventions
### 3.0 Universal
- Canvas via `ImageSpec.aspectRatio` + `size`; asset ids match `^[a-z][a-z0-9_]{2,63}$`; `count: 1`; ≤10 references (5 recommended). The locked originals have the sizes Google's Gemini 3 image tier documents for 2K, as I recall them (Fadyme sheet 2:3 = 1696×2528, key art 9:16 = 1536×2752, logo 16:9 = 2752×1536): plan on those for `size: '2K'`. The supported ratio set, the real output dims and the 4K dims of `gemini-3.1-flash-image` are **UNKNOWN until the first call**.
- Generation never outputs alpha. Keyed classes (busts, sprite sheets, icons, studio mark, layered prologue elements) use a flat `#00FF00` background and `tools/lib/art.ts buildKeyedImage` (alpha ramps over `g − max(r,b)` 40→130, despills g to max(r,b), trims). Therefore: pure flat green, no gradient/vignette/floor/cast shadow/glow/mist/particles touching the edge; crisp hard silhouette (no feathering, no motion blur); subject ≥6% margin from every edge; no green anywhere on the subject, no green rim light or reflections; keep loose hair strands thick (wisps leave a green fringe); QA every keyed result at 300% on a dark and a light backdrop. Green-palette characters later (Brin pine, Thistle sage, Tilda sea-green) need a magenta key (art.ts change, Claude-owned).
- **Tooling gap (flag):** `buildPortrait` and `buildUnitAtlas` currently do NOT key green (only `buildKeyedImage`, used for the logo); a keyed pre-pass must run before busts/sprites enter those builders. Contract here is for the artwork; wiring is Claude's.
- No text, letters, numbers, logos, rating badges, watermarks or UI in any image (runtime types story text, e.g. the inscription "We were here." is never baked).
- Adults only. No gore, no sexualised framing, no child-coded chibi anatomy (chibi = proportion style of an adult).
- Ids: `<char>_vn_<emotion>`, `<char>_chibi_sheet`, `<enemy>_chibi_sheet`, `bg_<location_id>_<variant>`, `ill_<illustration_id>`, `prologue_<visual>_<scene_id>[_<layer>]`, `icons_<set>_<nn>`, `studio_mark_<nn>`, `<id>_design_sheet`.

### 3.1 VN portrait / bust — 2:3, 2K ($0.101), keyed green
- Canvas **2:3** (REF derived busts are 1024×1536 and the locked sheet is 1696×2528, both 2:3; QUEUE proposes 3:4 — not used, conflict flagged §7). Runtime (`StoryScene.showActor`): scaled to **980 px tall**, bottom-anchored at y≈1098–1120, centre x=500 (left slot) or x=1420 (right slot), dimmed to alpha 0.72 when not speaking. Dialogue panel covers y 805–1055, name plate at y 784 → **only the top ~70% of the image is visible**: eyes at 24–30% from top, hood/hair top ≥3% from the edge, face and both hands inside the top 62%; the bottom 30% may be plain cloth/cloak.
- Crop: chest-up to mid-torso, three-quarter view, head turned slightly toward the open side, eyes to camera or just past it. Facing PROPOSAL: Fadyme = left slot, faces viewer-right (REF composed bust); Mahmut = right slot, faces viewer-left; author both so no runtime flip is needed (`showActor` flips nothing for the right slot).
- Fixed across an expression set: identical hood/hair silhouette, crop, camera, lighting, costume, props; only brows/eyes/mouth/head tilt of ≤5° change. Generate `composed` first, approve it, then make every other emotion as an image-edit conditioned on it (§6).
- Tags used by `narrative/09_VN_Scripts/Runtime_Snapshot/game/data/entry/tutorial_v001.json` (narration lines carry `emotion: ""` and show no portrait). Output names `portrait_<char>_<tag>.webp` (max height 1100):
| Char | Tag | Look (PROPOSAL unless noted) | Closest legacy/locked |
|---|---|---|---|
| mahmut | `composed` | steady, level eyes, jaw relaxed, mouth closed; tired but steady (CANON "Early Days" default) | `composed` |
| mahmut | `watchful` | eyes tracking slightly off-axis, brow minimally lowered, head 3–5° turned | maps to `composed` today |
| mahmut | `protective` | brow lowered, jaw set, eyes hard and forward, chin down; resolve, not rage (anger is silence) | `protective_resolve` |
| mahmut | `dry_humor` | one mouth corner barely lifted, flat amused eyes, no teeth | `dry_humor` |
| fadyme | `composed` | calm half-smile with fatigue in the eyes (locked sheet "Composed (with fatigue)") | `composed` |
| fadyme | `dry_amusement` | "small knowing asymmetric smile, gently raised eyebrow, alert relaxed eyes, quiet agency; no big grin/coyness" (`narrative/12_Production_Notes/Current_Design/FADYME_PILOT_AND_SIDE_BATTLE_v001_2026-10-08.md`) | `wry` |
| fadyme | `soft_smile` | warm closed-mouth smile, softened eyes | `warm` (locked bust `warm_v001`) |
| fadyme | `determined` | steady eyes, lips pressed, chin slightly lifted; not anger | `resolve` |
Locked-only extras for later story (not tutorial): Fadyme `quiet_pain`, `honest_fear` (locked sheet + derived busts).

### 3.2 Chibi battle sprite sheet — one 16:9 sheet, 2K, keyed green
- **One image per unit, 4×2 grid, order = `UNIT_ANIM_STATES`** (`packages/content-schema/src/art.ts`, `tools/build_content.ts SEQ`): row 1 `idle walk basic active`, row 2 `ultimate hit defeat victory`. Pure green between cells (≥8% gutters), no grid lines, no labels. One image keeps one scale for all poses (the builder scales every frame by the idle height; singles drift in scale and needed manual `relativeHeight` patches).
- Cell rules: whole figure incl. weapon/cloak/staff/chain strictly inside its cell (the legacy sword "cell crossing" is why this exists); idle figure ≈60–65% of cell height with ≥8% padding, ultimate may reach ≤1.15× idle height, defeat ≈0.5–0.6×. The lowest opaque pixel of every frame is the planted sole/staff tip (builder sets `foot_y` 0.985 of the trimmed frame and `pivot_x` to the alpha centroid): nothing may hang below the soles, **no ground shadow, ring, text or baked VFX** (UnitView draws the ellipse shadow, plate and VFX itself). Spell/impact glows come from CC0 VFX packs, not from the sprite.
- Size: sheet must be ≥2400 px wide (cells ≈690×770, idle ≈470 px tall ≥ the largest runtime height 380); if the returned sheet is smaller, use two 2×2 sheets. Current runtime `height_px`: Pilgrim 380, Fadyme/Mahmut 360, Bellbound 340 (`tools/build_content.ts`); design cards propose 160–210 normal / 230–300 boss (unvalidated): final export size is the runtime contract (QUEUE M03). PROPOSAL: keep the silhouette order Pilgrim (broad) > heroes > Bellbound (thin).
- Facing: heroes face **right**, enemies face **left** (`UnitArt.facing`; battle: allies left facing right, enemies right facing left). Mirroring is allowed at runtime, so carry no canon-bearing asymmetry that breaks when flipped. Weapon hands: Mahmut sword in the right hand, shield on the left arm (REF key art; legacy plan "shield left arm"); Fadyme holds the bell chain in gloved hand(s) at waist height (REF chibi idle).
- Style R2, 3–3.5 heads tall, outline `C.ink`, same costume as the identity anchors (§4), facial detail simplified but violet eyes / brown eyes still read.
- Poses (skill names from `content/base/units/unit_pack.json`): `idle` relaxed 3/4 stance (REF) · `walk` mid-stride · `basic` Mahmut *Oathless Cut* sword cut / Fadyme *Veilglass Thorn* bell-thorn thrust · `active` Mahmut *Broken Crest Guard* shield forward / Fadyme *Borrowed Hour* bell raised · `ultimate` Mahmut *Last Wall at Dusk* / Fadyme *The Bell That Forgets*: largest single pose, ultimate content beyond the name is UNKNOWN · `hit` recoil, eyes shut, no blood · `defeat` collapse/kneel, no gore · `victory` small, in character (Mahmut restrained, Fadyme composed).
- Enemies (Bellbound Dead, Hollow Pilgrim): one 16:9 2K sheet of 4 cells (one row or 2×2, order `idle basic hit defeat`) because only these are unique art; `walk`/`victory` alias idle and `active`/`ultimate` alias basic until a skill needs them (the existing build maps exactly so: idle 0, basic 1, hit 2, defeat 3). Poses from the cards: Bellbound = chain pulled taut and bell tilting (*Tolling Grab*); Pilgrim = both hands on the staff, heavy swing (*Pilgrim's Weight*); `defeat` = collapse, kneel.
- A separate four-view **design sheet** (`*_design_sheet`, 4:3, neutral plain background, no labels) is a review artefact, never an atlas.

### 3.3 Battle background — 16:9, 2K ($0.101), opaque, exported 1920×1080
Exactly 16:9 (`BattleScene` scales `max(1920/w, 1080/h)` anchored top-centre: any other ratio crops the bottom; `StoryScene` zooms 1.02→1.08, so keep key content inside the central 90%). One plate serves battle and story. Safe zones in 1920×1080 ref px, from `BattleScene.ts` and `battle/formation.ts`:
| Zone | Rect (x, y) | Rule |
|---|---|---|
| HUD top band | 0–1920, 0–235 | stage title x60, turn chips (x74–922, y152–232), buttons x≥1230 (y20–120), telegraph text right-aligned x≤1860: low detail, darker, no landmark, no bright spot |
| Skill-banner | 410–1510, 215–350 | calm |
| Horizon | y 400–440 | far line; everything vertical (spire, tree-line) sits above it |
| Stage floor | 120–1800, 430–840 | flat, open, low contrast, slightly lighter than surroundings (`ash_path` family); no rocks/roots/puddle highlights; unit feet band y470–670, name/HP/intent plates run to y≈810 |
| Unit columns | player x350–750, enemy x1170–1570 | sprites (340–380 px tall) reach from y≈130 to the plates at y≈810: no bright, warm or high-contrast spots at y130–830 |
| Clash lane | 860–1060, 330–820 | open and calm (lunges land here) |
| Description + skill buttons | 140–1780, 840–1080 (text y860, buttons y896–1024) | near-black foreground (REF plate bottom ≈ #111213), no detail |
| Edge frame | x<300, x>1620 | trees, shrine, carved trunks and the single warm light live here |
- Composition: shallow raised 3/4 side view, flat clearing in the lower ~65%, no depth road, player space left / enemy space right, no characters, no UI, no text, no grid, no baked shadows (legacy brief, `ASSET_PLAN_PART1.md`).
- **Location anchor (CANON)** `forest_whispering_ash`, `narrative/12_Production_Notes/Prompt_Library/asset_pipeline/location_briefs.md`: "Damp overgrown forest: layered mossy and dark pine greens under a pale ash-grey canopy of ash trees whose pale leaves look like drifting ash; rain and low mist; a narrow muddy road; old trunks with names carved into the bark; a small old stone roadside wayshrine … with a small empty bell niche under its eave; the distant spire of the Saint Luthos bell tower above the trees; one warm camp-light inside the crop-safe area." State to draw: *ordered* (road clear, carved names readable, shrine intact, light mist). Crimson omen marks only in chaotic states, not the tutorial. Time of day PROPOSAL: dusk, cool purple-grey twilight (`CANON` T-1/T-2 "The last light lay between the trees"). Carved names: unreadable glyph-like strokes, no legible words (REF plate).

### 3.4 Event illustration — 16:9, 2K, opaque, full-bleed over the VN scene
IDs `roadside_rest` (T-2 after) and `shelter_evening` (T-3 after). Sources: `tutorial_v001.json`, `OPENING_TUTORIAL_REVISION_v006_2026-10-08.md` (its prompts were portrait/legacy and are NOT reused as-is). Panel covers y805–1055: **faces, hands and the key action inside y140–780 (14–72% of height)**, bottom 28% quiet cloth/ground, top-left title and top-right buttons stay clear. Both characters at identity-anchor fidelity (§4), adults 22 and 28, Fadyme visibly smaller than Mahmut, no other people, no lettering, restrained attraction (glances, small gestures; no embrace, no overt romance).
- `roadside_rest`: Fadyme (left) and Mahmut (right) on a fallen roadside stone, dusk, cool forest and ruins, warm amber rim light; she threads a loose leather strap through its buckle at his wrist (which armour piece it belongs to is UNKNOWN), he watches her hands (CANON T-2: "She drew his wrist toward her and threaded the loose leather through its buckle.").
- `shelter_evening`: a modest abandoned stone shelter with a broken roof; they sit side by side on a stone bench, his cloak laid on the cold stone, his shield within reach, a broken loaf, she looks out through the open side at the quiet road, he turns toward her with understated care; last amber light against cool violet dusk (CANON T-3: "He sat. His shield rested within reach; her shoulder rested almost within reach of his.").
- Curse signs absent (no blood on the scarf, no white lock, no black-gold lines; whether pale fingertips are allowed before 1-5 is UNKNOWN: default normal skin).

### 3.5 Prologue plates — `prologue_v001.json`, "layered_motion_comic_v002", 16:9
Nine scene plates (one per `scene.id`, each with its own framing from its `direction` field) in three `visual` environment families that share materials and palette (village: hours, names, ordinary_days, search · crownfall: throne_wars, crownfall, roads · road: reunion, beginning), 2K opaque, plus **separately generated moving layers** on key green (bell and rope, quill hand, two market adults, refugee walkers, travelers, the duo seen from behind). Smoke, ash, mist and dust are CC0 VFX, not generated. Faces are NOT required: use backs, hoods, silhouettes, hands; faces only where the scene direction needs them (reunion) and then at anchor fidelity. Rules (CANON, the scene `direction` fields): no invented legible name (the ledger shows only an indistinct ink stroke; "We were here." is typed at runtime); **never depict the king's death or its cause**; no faction emblems in `throne_wars`; no ritual, seal or villain in `roads`; no later revelation in `beginning`; `search` = younger Mahmut at an unnamed winter inn counter, no other named character; `reunion` = Fadyme aged 20 and Mahmut aged 26 in an unnamed hill village (younger look: UNKNOWN beyond the ages, keep both anchors, no bone-white lock). Caption/subtitle band: bottom 28% calm, top-left title clear.

### 3.6 UI icon sheet — 1:1, 1K or 2K, keyed green, R3
4×4 grid of 16 glyphs (REF `icons_pilot_mixed_16`, 1536×1536, cells 384): one object per cell, centred, 70–80% of the cell, ≥12% green gutter, no row/column lines. Glyph-only: no text, digits or letters, no frame (the UI draws rarity frames). Same light (upper-left), contour weight and palette across the sheet, heavy `C.ink` contour, flat cel + one highlight; read at 64 px and 128 px (the export sizes). One silhouette per concept, no near-duplicates. Shape vocabulary: bell, chain, eclipse disc with crimson ring (Eclipse Token = eclipsed sun), hourglass, wax seal, lantern (flame **amber**, never green: the pilot's green lantern glow would be keyed out), crown fragment, bread-and-flask. **Currency: one main currency `eclipse_token` only** (README, 2026-10-11): do not generate Fate's Thread (rope knot) or Silver Crowns (crown coins) as currency icons even though the pilot sheet shows them.

### 3.7 Studio mark — 1:1, 1K, keyed green
`StudioScene` shows `ui('studio_mark')` at ≤260×260 px centred at (960, 370), then "SovTaym Studios" and "PRESENTS" as separate text on #05030A. Concept brief, name clearance and pronunciation are **UNKNOWN** (name is PRELIMINARY, `narrative/12_Production_Notes/Design_Notes/STUDIO_NAME_RESEARCH_2026-10-05.md`); the earlier raven/hourglass emblem is an archived non-Google asset, not a reference. Until the owner supplies a brief, ship the text-only hairline ornament (already in `StudioScene.ts`). If an emblem is commissioned: one glyph, silver/old-gold (`C.silver`, `C.gold`) on key green, no letters, readable at 120 px, and visually distinct from the game mark (the bell, crown fragment and eclipse ring belong to the game logo).
Locked brand art (never regenerate, only reference): wordmark `narrative/14_References/recovered_locked_v001/logo/brand_logo_wordmark_r2_v003.png` (bone-ivory chiselled letters, plum-black extrusion, silver bell and thorn at the W/line, broken crown over a thin crimson ring) and key art `.../key_art/brand_key_art_portrait_r2_v003.png`.

## 4. Identity anchors (verbatim canon; anything not quoted is UNKNOWN)
### 4.1 Mahmut (`narrative/06_Characters/Playable/mahmut.md` unless stated)
| Aspect | Verbatim | Status |
|---|---|---|
| Identity | "28 · male · Stone tank-bruiser · 5★ free start · former sworn palace guard, branded traitor by the Council of Dukes" | CANON §1 |
| Face/hair | "dark messy hair, stubble, brown eyes" (§6 Approved look); "Stubble and tired eyes: He sleeps last and wakes first. The sheet's "Early Days" state (tired, but steady) is his default." | CANON |
| Build | "Tall, weathered knight" (`narrative/12_Production_Notes/Art_Source_Notes/CHARACTER_COSTUME_GUIDE.md`, Mahmut row marked current); v006: "visibly taller and broader" than Fadyme | CANON-guide |
| Armour | "dark worn half-plate"; "The dark half-plate is his Guard armor, never replaced, repaired by village smiths in six different styles." | CANON |
| Star | "The Crown Guard star stays on his breastplate; the crown that sat above it was hammered off, leaving the empty socket Marek recognizes (5-1)." | CANON |
| Cloak | "tattered oxblood cloak"; "The oxblood cloak was Guard red; he dyed it darker so it would not be recognized, and never mended the tears because each one is a road he walked looking for her." | CANON |
| Hands | "scarred gloves" (CHARACTER_COSTUME_GUIDE.md) | CANON-guide |
| Props | "the repaired heater shield (Yseldra's seal is still pressed into its rim from the opening), the arming sword with iron-filled crest socket." Sword: "he filled the crest socket in its hilt with plain iron the night he hammered the crest from his armor." [NEW lore] | CANON |
| Palette | "Steel, oxblood, ash; watchful, tired eyes" (guide); "Slate steel, oxblood" (`narrative/06_Characters/_visual_matrix.md`) | CANON-guide |
| REF | key art shows him from behind/profile: dark short hair, star on the armour, torn dark-red cloak, dark shield on the left arm, sword in the right hand | REF |
| UNKNOWN | face shape and eye shape, skin tone, exact hair length/parting, height/build in numbers, helm (none shown), boots, glove colour, scar positions, shield size/colour/other heraldry, sword length. **No Mahmut face anchor exists in `reference/`** (the cited `art/sheets/char-mahmut-uomd.png` is not in the repo): the first owner-approved Mahmut portrait becomes the anchor. | UNKNOWN |

### 4.2 Fadyme (`narrative/06_Characters/Playable/fadyme.md` unless stated)
| Aspect | Verbatim | Status |
|---|---|---|
| Identity | "22 · female · Veil support-DPS · 5★ free start · heir of Veyrhold through her father, last daughter of the Veyr bell line through her mother · the current Last Bell" | CANON §1 |
| Approved look | "pale ash-blonde hair, violet eyes, deep plum hood with the broken crown pin at the clasp, black dress with silver-lilac embroidery, white scarf. The 5-4 "white strand" is a stark, bone-white lock in her pale hair." | CANON §5 |
| Costume | "Adult princess with pale ash-blonde hair and violet eyes; deep plum hooded mantle over a high-collar black dress with silver-lilac embroidery, white scarf, thin gloves; one broken silver crown pin at the hood clasp" (CHARACTER_COSTUME_GUIDE.md) | CANON-guide |
| Hair/hood | "The pale ash hair is her mother's"; "The deep plum hood is a Saint Luthos pilgrim mantle she took when she fled, dyed darker; she keeps it up because hoods make people stop looking at faces." | CANON |
| Crown pin | "The crown pin at the clasp (front edge of the hood, above the brow): a fragment of her father's circlet, broken on the night of Crownfall. She wears it where only someone standing very close would see it." | CANON |
| Bell pin | "her mother's House Veyr pin, a tiny silver bell-shaped hairpin at the side of her face. The hood hides it" | CANON |
| Scarf | "White scarf: worn high so blood can be hidden in its folds (3-3). The silver-lilac embroidery on her dress is fading; the art bible uses it as a quiet progress bar of the curse." | CANON |
| Bell | "the silver bell of House Veyr, carried on a chain … Its clapper is a silver thorn that never swings; it rings when she casts, and the other bells answer." [NEW lore] — the bell pin is "a separate family pin": three different props (crown pin, bell pin, chain bell) | CANON |
| Tutorial state | "No bone-white lock before 5-4; no bloody scarf in tutorial." (`docs/media/QUEUE_DATA.json`, `fadyme.identity`) | CANON-queue |
| Palette | "Plum, silver, cold lilac; composed smile, fatigue in the eyes" (guide) | CANON-guide |
| REF (locked sheet) | long wavy hair to chest, pale lavender-grey violet eyes, silver-lilac vine embroidery on hood/cloak, brown leather gloves, silver bell with spike clapper on a chain, white scarf, chibi = 3–3.5 heads | REF |
| UNKNOWN | exact hair length, skin tone, height, face/eye shape beyond the sheet, glove material (sheet brown leather, derived bust black, guide "thin gloves"), hood length, prop sizes | UNKNOWN |

### 4.3 Bellbound Dead (`bestiary.md` = `narrative/07_Enemies_Bosses/bestiary.md`; lore = `narrative/05_Codex_Lore/lore_text_part1.json`; card = `narrative/15_Art_Workbench/enemies/design_v001/design_cards.json`, status DESIGN_CANDIDATE_NOT_OWNER_APPROVED)
| Aspect | Verbatim | Status |
|---|---|---|
| Lore | "Hollows wired to a bell by their own chains. Alone they are weak; the bell never sends one alone." | CANON |
| Kind | Bellbound = "A Hollow wired to a bell by its own chains." / "Never sent alone; acts when the bell acts." ; Hollow = "Dead whose hours could not be closed because no name witnessed them (world rule 6)." / "Repeats its last task: pilgrims walk, clerics copy, guards stand at post. Drawn to bells." (bestiary table); `narrative/05_Codex_Lore/world.md` §4: "Hollows wired to a bell or wrapped in erased records; they serve whoever controls the bell or ledger." | CANON |
| Data | role `swarm`, element Veil, weak Dawn/Ember; skills *Grave-Worn Strike*, *Tolling Grab* (`narrative/09_VN_Scripts/Runtime_Snapshot/game/data/content/enemies_part1.json`); tutorial: 2 in T-1, 2 in T-3 (`tutorial_v001.json`) | CANON |
| Silhouette (card, TR) | "Çökük göğüs, sarkık uzun kollar; zincirle bölünmüş ince dikey gövde." = caved chest, long hanging arms, thin vertical torso divided by chain | candidate |
| Palette (card) | "Kömür bez, kirli kemik, soğuk pirinç." = charcoal cloth, dirty bone, cold brass | candidate |
| Props (card) | "Göğüs çanı; göğüs ve bileği bağlayan kendi zincirleri. Mevcut tutorial tasarımı korunur." = chest bell; its own chains linking chest and wrists; keep the tutorial design | candidate |
| Constraint (card) | "Ağır zırhlı şövalye değildir; kırmızı parıltı bütün yüzeyi kaplamaz." = not a heavy-armoured knight; red glow never covers the whole surface | candidate |
| Attack | "Tolling Grab: bilek zinciri gerilir, çan eğilir" = wrist chain tightens, bell tilts | candidate |
| Queue | "Slumped thin hollow with long hanging arms, charcoal cloth, dirty bone and cold brass; chest bell and its own chains linking chest to wrists. Preserve tutorial identity, no heavy knight armor." | candidate |
| REF board | thin skeletal figure, skull-like face, torn charcoal-brown rags, bronze bell on a neck chain at the chest, chains wrapped on both wrists, long clawed hands, faint ember underglow; painterly-realistic, not anime | REF (not approved) |
| UNKNOWN | whether a skull face is allowed (only "dirty bone" is stated), bell size, number of chains, height, hair, ember cracks | UNKNOWN |

### 4.4 Hollow Pilgrim (same sources)
| Aspect | Verbatim | Status |
|---|---|---|
| Lore | "A pilgrim whose hours ran out on the road but whose feet did not. Slow, stubborn, heavy." | CANON |
| Behaviour | "Hollows … move by habit, repeat old tasks (pilgrims walk, clerics copy, knights guard) and are drawn to bells." (`narrative/05_Codex_Lore/world.md` §4); "Where the path narrowed, a lone pilgrim dragged one foot around the same worn stones." (`tutorial_t2_before_001`); "The pilgrim stopped. Its head turned toward them." | CANON |
| Data | role `slow_vanguard`, element Veil, weak Dawn/Ember; *Pilgrim's Weight*: "A slow, stubborn frontliner with high HP and a crushing step."; tutorial: 1 in T-2, 1 in T-3 | CANON |
| Silhouette (card) | "Kambur geniş üçgen; yük çantası ve yere basan tek kalın asa." = hunched wide triangle, load pack and one thick planted staff | candidate |
| Palette (card) | "Kül beji kaba dokuma; mat kahverengi deri." = ash-beige coarse weave, matte brown leather | candidate |
| Props (card) | "Yüzü karanlık başlıkta; yıpranmış yol yükü. Mevcut tutorial kimliği korunur." = face in a dark hood; worn road load; keep the tutorial identity | candidate |
| Constraint / attack | "Havada uçan hayalet ya da hızlı suikastçı yapılmaz." = no floating ghost or fast assassin; "iki el asaya geçer, ağır salınım; Stoneguard sonrası ayaklar sabitlenir" = both hands on the staff, heavy swing, feet planted | candidate |
| Queue | "Heavy hunched pilgrim under coarse ash-beige hood, face in shadow; worn brown-leather pack and one thick planted walking staff. Not a floating ghost or fast assassin." | candidate |
| REF board | hooded ragged ash-beige robe, large backpack with rolled bedroll and hanging bronze pots/bells, tall staff with a small bell and red cloth ties | REF (not approved) |
| UNKNOWN | face, bell on the staff or pack (board only), pack contents, red cloth, the dragged foot in static art, exact height | UNKNOWN |
Read the pair as opposites at 160 px: Bellbound thin, tall-reaching, chest bell and chains; Pilgrim broad triangle, hood, pack, planted staff, no chest bell or wrist chains.

## 5. Canon-violation checklist (run on every generated image; any "no" fails it)
**A. Global** 1 adult-coded (Mahmut 28, Fadyme 22; reunion plate 26/20) · 2 zero text/letters/digits/logos/watermarks/UI/rating badges · 3 dark-dominant, no pure black/white, no neon, crimson only per §1.3 · 4 painterly anime (R1/R2) or bold-contour glyph (R3), never photoreal/3D/clip-art · 5 no other named or identifiable character, no legible invented name, no faction emblem unless the scene allows · 6 no gore, no sexualised framing · 7 nothing from the legacy crimson/burgundy Fadyme atlas, never two Fadyme costumes in one image · 8 no cross/dagger-cross pins or holy motifs.
**B. Fadyme** 1 hair pale ash-blonde (not silver, white or yellow) and **no bone-white lock** · 2 violet eyes · 3 deep plum hood up, broken crown fragment at the front edge above the brow · 4 black high-collar dress, silver-lilac embroidery (lilac, not gold) · 5 high white scarf, clean (no blood) · 6 silver chain bell with silver THORN clapper; tiny bell hairpin by the face is partly hidden; the three props are distinct · 7 no weapon, no black-gold hand lines, normal skin tone · 8 same adult face as the approved anchor.
**C. Mahmut** 1 dark messy hair, stubble, brown tired-but-steady eyes · 2 dark worn mismatched-repaired half-plate · 3 Crown Guard **star** on the breastplate with an **empty** socket where the crown was (not a crown, not smooth) · 4 torn oxblood cloak, darker than UI crimson · 5 repaired heater shield (seal in the rim) and arming sword with iron-filled socket; no royal crest anywhere · 6 clearly taller and broader than Fadyme · 7 no helm in portraits, same face as the approved anchor.
**D. Enemies** 1 Bellbound: thin slumped Hollow, long hanging arms, charcoal cloth/dirty bone/cold brass, chest bell with its own chains to the wrists, not heavy armour, red glow limited · 2 Pilgrim: broad hunched triangle, coarse ash-beige hood with face in shadow, brown leather pack, one thick planted staff, slow, not floating, no chest bell · 3 pair readable and distinct as 160 px silhouettes · 4 no invented speech, abilities, faces or names beyond §4.
**E. Plates and illustrations** 1 exact aspect, no characters in battle plates · 2 safe zones of §3.3 respected (HUD band, floor, columns, clash lane, bottom band) · 3 forest anchors present (ash canopy, mist, carved unreadable glyphs, wayshrine with empty bell niche, distant spire, one warm light at an edge) · 4 event art: faces/hands inside y140–780, no embrace, no other people, no curse signs · 5 prologue: no king's death or cause, no ritual/seal/villain in `roads`, no legible invented names.
**F. Technical** 1 keyed classes: flat pure green, no green on the subject, no green fringe at 300% on dark and light backdrops · 2 sprite sheet: 8 poses in `UNIT_ANIM_STATES` order, each wholly inside its cell, one common scale, planted sole is the lowest pixel, no shadow/ring/VFX/text · 3 expression set identical in crop, lighting and costume · 4 hash-compared against its siblings (no near-duplicate across attempts) · 5 provenance JSON saved (model, prompt, reference hashes, cost) and attempt count ≤3.

## 6. Gemini prompting rules for multi-reference conditioning *(unverified until the first approved batch)*
**How the request is built** (`buildImageRequest`): one user turn = `[text part, image part 1, image part 2, …]`; the text is `spec.prompt` followed by auto-appended lines `Reference image N: <role>.` in `references` order. So (a) the prompt body must not restate roles, only cite "reference image N" with the same numbering; (b) write each `role` as a complete instruction fragment; (c) text comes before the images: one cheap A/B (images first) is allowed if consistency is poor, via a media.ts change owned by Claude. ≤5 references per call, ≤3 of them identity-bearing; each additional image dilutes the identity lock.
**Order of the prompt text:** 1 one-line deliverable (asset class, aspect, count of images = 1) · 2 identity block (verbatim anchors of §4, positive wording, include the age) · 3 composition (camera, crop, facing, safe-zone proportions) · 4 style (§2 mood words, line/shading/texture) · 5 lighting and palette (token names → words + hex once) · 6 technical (background, key green, margins, "no text") · 7 short "keep out" list (≤6 items) last.
**Per-reference roles** (each role names what to take AND what to ignore):
- Locked Fadyme sheet (`reference/locked/fadyme/sheet/char-fadyme-uomd.png`): "IDENTITY ONLY: face, hair, eye colour, hood, crown fragment, scarf, embroidery, bell design, palette, from the large left figure and the close-up; ignore the page layout, text labels, chibi thumbnails, mood boxes and story-state vignettes, the brown gloves and the shown tiara shape (use the canon text)."
- Derived Fadyme bust (`reference/derived/fadyme_vn_bust_composed_v001.webp`): "CAMERA, CROP and RENDER STYLE only: three-quarter chest-up framing and painterly finish; ignore the green background and the cross-shaped clasp pins."
- Key art (`.../brand_key_art_portrait_r2_v003.png`): "ATMOSPHERE and PALETTE only: slate sky, thin crimson eclipse ring, stone; do not copy the composition or the two characters' faces." For Mahmut it is also the only costume reference: "COSTUME ONLY for the dark half-plate with star, torn oxblood cloak, shield and sword; the face is not visible, do not copy the figure's pose."
- Battle plate (`forest_whispering_ash_battle_plate_v002.webp`): "LOCATION materials, palette and mood; recompose to a landscape clearing with the layout in this prompt; do not keep the portrait framing."
- Enemy board (`enemy_board_ch01_whispering_ash_v001.webp`): "SILHOUETTE and MATERIAL intent of the named creature only (candidate design); redraw in the painterly anime register; ignore the other creatures, captions, insets and the realistic skull rendering."
- Chibi references (`chibi_ref_fadyme.png`, `fadyme_battle_pose_idle_v002.webp`): "CHIBI PROPORTION (3–3.5 heads), bold outline and cel shading only; do not copy the costume details or pose."
- Icon sheet (`icons_pilot_mixed_16.webp`): "STYLE ONLY: contour weight, cel shading, 4×4 layout; do not reproduce its objects; green glow and green gaps are not to be repeated."
- Previously approved output of this project: for every follow-up asset, reference image 1 = the approved neutral portrait or sheet with "IDENTITY AND CROP LOCK: keep face, hair, costume, crop, camera and lighting identical; change only …".
**Attachment map:** Fadyme bust set [sheet · composed bust · key art]; Mahmut `composed` [key art costume · Fadyme bust for crop/render only, "do not copy her identity"]; all other emotions [approved `composed` + one sentence of change]; chibi sheet [approved portrait · chibi_ref · battle_pose_idle for silhouette]; enemy sheet [board crop · chibi_ref]; battle plate [plate · key art]; event art [approved Fadyme portrait · approved Mahmut portrait · plate]; prologue [plate · key art]; icons [pilot sheet]. Never attach the legacy crimson atlas or both Fadyme costumes.
**Negative phrasing:** state what the image IS in positive terms ("matte cloth", "flat open ground", "empty background") rather than negating it; a long "no X" list can prime X. Keep unavoidable negatives to one closing sentence of nouns ("No text, logos, watermarks, borders, extra people."). Do not name unwanted motifs you can replace with a positive substitute (write "pin shaped as a small bell and a broken crown", not "no cross"). Use proportions ("lowest quarter plain") instead of pixels for layout; state pixel zones only in this doc and in the spec notes.
**Iteration discipline:** `count: 1`; change one variable per retry; after the 3rd paid attempt on an asset change the prompt substantively and request review (the guard counts attempts per asset id); expression edits, sprite sheets and plates are separate ids; record the winning reference hashes in provenance; seeds are not exposed by `ImageSpec` (UNKNOWN). Dry-run first (`tools/gen_image.ts`), reserve before spending, never retry blindly after an ambiguous failure.
**Skeleton (fill from §3/§4):**
`Deliverable: one <class> image, <ratio>. Reference image roles are listed below the prompt. SUBJECT: <identity block verbatim, adult, age>. COMPOSITION: <camera/crop/facing/safe-zone fractions>. STYLE: painterly dark gothic anime light-novel illustration, <line/shading/texture words>. LIGHT AND PALETTE: cool slate ambient, one warm amber rim, <tokens>. TECHNICAL: <flat pure #00FF00 background / opaque scene>, crisp edges, 6% margin, text-free. Keep out: <≤6 nouns>.`

**Worked example** (`art_specs/p0/fadyme_vn_composed.json`, dry-run first; the prompt body meets the 80-character minimum and never restates reference roles):
```json
{"id":"fadyme_vn_composed","model":"gemini-3.1-flash-image","size":"2K","aspectRatio":"2:3","count":1,
 "references":[
  {"path":"reference/locked/fadyme/sheet/char-fadyme-uomd.png","role":"IDENTITY ONLY: face, hair, eye colour, hood, embroidery, bell design and palette from the large figure and close-up; ignore page layout, labels, thumbnails, gloves and tiara shape"},
  {"path":"reference/derived/fadyme_vn_bust_composed_v001.webp","role":"CAMERA, CROP and RENDER STYLE only: three-quarter chest-up framing and painterly finish; ignore the green background and the cross-shaped clasp pins"},
  {"path":"narrative/14_References/recovered_locked_v001/key_art/brand_key_art_portrait_r2_v003.png","role":"ATMOSPHERE and PALETTE only: slate tones, restrained plum; do not copy composition or faces"}],
 "prompt":"Deliverable: one painterly dark gothic anime light-novel visual-novel bust of a single character, portrait 2:3. SUBJECT: Fadyme, an adult woman aged 22, pale ash-blonde hair, violet eyes, deep plum hood raised with a small broken silver crown fragment at its front edge above the brow, black high-collar dress with silver-lilac embroidery, high clean white scarf, a silver bell with a silver thorn clapper hanging from a chain in one gloved hand, a tiny silver bell-shaped hairpin half hidden by the hood beside her face. Calm closed-mouth half-smile with fatigue in the eyes. COMPOSITION: three-quarter view, head turned slightly toward the right of the frame, eyes to camera, chest-up, eyes about 27% from the top, face and hands in the upper 60%, lower third plain cloak folds, 6% margin. STYLE: soft thin plum-black linework, soft cel skin, painterly matte cloth, brush grain, no gloss. LIGHT AND PALETTE: cool slate ambient light with one warm amber rim from behind, charcoal, plum and bone ivory. TECHNICAL: flat pure #00FF00 background with no shadow or glow, crisp hard silhouette edges, no green on the subject, text-free. Keep out: text, logos, watermark, frame, extra people, weapons."}
```

## 7. Open conflicts and UNKNOWNs (decide before the paid batch)
1. **Orientation**: legacy `ART_BIBLE.md` and the v006 illustration prompts are portrait (1080×1920); README and the engine are landscape 1920×1080 → this file is landscape; v006 prompts must be re-authored 16:9.
2. **Identity drift in sources**: v006 prompts say Fadyme "silver hair"/"ivory scarf" and Mahmut "red scarf/cloak" and "gauntlet" (canon: ash-blonde, white scarf, tattered oxblood cloak, "scarred gloves"; no gauntlet or scarf is canon); Fadyme sheet shows a tiara-like crown and hanging bell charms and brown gloves, the derived bust shows black gloves and cross-shaped pins → canon text wins, no crosses.
3. **No locked Mahmut face reference** and no approved enemy designs; Mahmut's anchor will be the first approved portrait; enemy boards are DESIGN_CANDIDATE and realistic-painterly with a skull-like Bellbound face (not canon).
4. **Portrait ratio**: QUEUE proposes 3:4 1K, locked busts are 2:3 → 2:3 used.
5. **Chibi display height**: runtime 340–380 px vs card proposal 160–210 px; export size awaits the runtime contract (QUEUE M03).
6. **Tooling**: `buildPortrait`/`buildUnitAtlas` do not key green; only `buildKeyedImage` does.
7. **Icon pilot** shows retired currencies (Fate's Thread, Silver Crowns) and a green lantern glow the keyer erases.
8. **T-3**: battle copy places the fight at a broken-roof shelter's doorway but every stage uses the single `location_id` `forest_whispering_ash`; title "A Roof Before Dawn" vs evening text and `shelter_evening` id → default one forest plate with a distant wayshrine silhouette; a shelter variant needs an owner decision.
9. **Studio mark** concept/name clearance, Gemini supported ratios/4K dims/seed/green-key purity, enemy facial treatment, pale-fingertip rule before 1-5: UNKNOWN.
