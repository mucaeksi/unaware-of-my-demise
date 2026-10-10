# Asset Catalog — Part I

## Current production state

The project currently contains written art direction and production-ready briefs. No generated, approved or in-game raster art is present yet. The active image-generation tool is not exposed in the current workspace; the available workflow does not authorize substituting a CLI image API. Every absent image below therefore remains marked brief or prompt_ready.

All in-game screens use portrait 1080×1920 reference composition. Exact source/runtime dimensions and safe areas are in [ART_BIBLE.md](ART_BIBLE.md). Stable marks for characters, skills, enemies, weapons, armor, accessory families, materials/currencies, chapters, villains, elements, statuses and banners are indexed in [BRAND_MARKS_AND_ICON_GUIDE.md](BRAND_MARKS_AND_ICON_GUIDE.md) and `content/brand_assets_part1.json`. Catalog marks use 512×512 source, 128×128 runtime and 64×64 compact targets; common weapons share 20 type-family marks, 36 armors share three family marks, and the 42 necklace/ring variants share seven set marks.

## Folder map

| Folder | Contents | Current state |
|---|---|---|
| assets/characters | Turnarounds, VN busts, expressions and battle sprite atlases | Briefs ready; images pending |
| assets/weapons | Weapon callouts and inventory icons | Briefs ready; images pending |
| assets/backgrounds | Chapter plates, battle arenas and map thumbnails | Briefs ready; images pending |
| assets/banners | Character and signature-weapon banner key art and crops | Briefs ready; images pending |
| assets/ui | Element, status, currency and navigation icons | Briefs pending |
| narrative/art/brand/concepts | Brand and icon concepts (unapproved) | Moved 2026-09-30 |
| assets/marks | Character, weapon, item, currency, chapter, villain, element, status and banner marks | IDs registered; SVG artwork pending |

Runtime-content catalogs and data-entry pixel/mark references are described in [CONTENT_DATA_PART1.md](CONTENT_DATA_PART1.md). Adding structured gear data did not generate any images; the new family/set/material mark records remain at `brief` status.

## Character art package

For each playable character, produce a model sheet, VN bust, 3 expression variants, chibi battle sprite sheet, weapon illustration, ultimate cut-in and banner cutout only when featured. See docs/CHARACTER_COSTUME_GUIDE.md and content/character_visuals_part1.json for the stable ID, costume, color and prompt source.

Recommended export naming:
- characters/{character_id}/model_sheet_v001.png
- characters/{character_id}/vn_bust_v001.webp
- characters/{character_id}/expressions_v001.webp
- characters/{character_id}/battle_atlas_v001.webp
- weapons/{character_id}_weapon_v001.webp
- characters/{character_id}/ultimate_cutin_v001.webp

Dimensions per asset kind are defined in `docs/ART_BIBLE.md`; data-level planned sizes for each character are recorded in `content/character_visuals_part1.json`.

## Part I villain art queue

| Villain | Story placement | Art brief | Status |
|---|---|---|---|
| Lady Yseldra Vale / Bell-Widow | Opening VN, Chapter 2-5 boss, final reflection | Mourning veil, wax-seal half-mask, cracked handbell; adult, opaque practical clothing | prompt_ready |
| Lord Cael Veyr / Clockless Chancellor | Clue props in Ch. 3/6, final reflection reveal | Court coat, handless watch, fractured mirror; adult, restrained silhouette | prompt_ready |

## Environment and encounter art

| ID | Chapter | Required artwork | Priority |
|---|---:|---|---|
| forest_whispering_ash | 1 | Story background, battle plate, map node image | P0 |
| cathedral_saint_luthos | 2 | Nave, archive, bell tower, battle plate | P0 |
| village_oakhaven | 3 | Square, forge, orchard, well battle plate | P0 |
| undercity_subterranean | 4 | Cistern stairs, red-vial ward, flask-rack battle plate | P0 |
| bridge_forsaken | 5 | Fog approach, bridge span, siege winch arena | P0 |
| estate_ashen_lord | 6 | Servants' entrance, portrait gallery, conservatory, collapse arena | P0 |
| altar_first_eclipse | 7 | Eclipse crater, pylon arena, phase transition plate | P0 |

Create one master mood plate per chapter before secondary angles. Reuse art with weather/light variants to control memory use.

## Weapons and combat identifiers

Each character has exactly one signature weapon or focus in docs/CHARACTER_COSTUME_GUIDE.md. Standard equipment art can reuse a family base silhouette and change metal, grip, charm and icon overlay. Avoid a unique 3D model pipeline. Enemy families need four common silhouettes plus one boss silhouette per chapter; the Chapter 7 Construct has a separate Phase I and Phase II key pose.

## Banner art queue

| Banner ID | Featured unit | Creative scene | Status |
|---|---|---|---|
| oath_01_aveline | Sister Aveline | Rainlit cathedral threshold, a lantern covering pilgrims | prompt_ready |
| oath_02_sable | Sable Wren | Bridge signal tower, one cut bell-rope and fog | prompt_ready |
| oath_03_nara | Nara Vell | Forsaken bridge defense, civilians crossing behind her | prompt_ready |
| oath_04_mirel | Mirel Quill | Ashen estate ledger page held under a reading lens | prompt_ready |
| oath_05_vespera | Vespera Wisp | Conservatory glass reflections aligned like a broken crown | prompt_ready |

Banner copy, rarity, duration, featured guarantee and pity are governed by the GDD. Keep text as a separate layer so the same key art can localize without regenerating the image.

### Signature weapon banner art

Weapon-banner key art is paired with the same 15-day period as the limited character banner. Current selected-weapon names and stable IDs are listed in docs/STORY_BIBLE_PART1.md; briefs are in content/visual_assets_part1.json. Keep the target weapon and character prop readable at phone scale, do not bake text into art, and keep all five assets marked prompt_ready until image files exist.

| Weapon banner ID | Selected weapon | Status |
|---|---|---|
| weapon_01_last_vigil | Lantern of the Last Vigil | prompt_ready |
| weapon_02_broken_bell | Quietus at the Broken Bell | prompt_ready |
| weapon_03_gatewarden_promise | Gatewarden's Promise | prompt_ready |
| weapon_04_unwritten_ledger | The Unwritten Ledger | prompt_ready |
| weapon_05_last_hour | Mirror of the Last Hour | prompt_ready |

## Review checklist

Before marking an asset reviewed: confirm character identity and weapon match the stable ID, adult styling matches the costume guide, hands and weapon grip read clearly at phone scale, lower dialogue-safe area is clean, palette belongs to the chapter/element, no text is baked into art unless approved, and the optimized export has a measured file size.

## State changes

Update content/visual_assets_part1.json for every generated file, revision, approval, retirement or missing asset. Changelog entries must include the path and reason.

