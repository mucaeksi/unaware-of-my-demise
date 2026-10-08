# Brand Marks and Icon System — Part I

Every named entity that appears in a menu, battle, reward, profile, story map, gacha result or equipment screen has a stable, legible mark. This is a design/production requirement; files are briefs until an actual reviewed image or SVG exists.

## Coverage rule

`content/brand_assets_part1.json` is the inventory and ID registry for logos/marks. It includes the game identity, every playable character, all 80 named character skills, their 20 signature weapons/foci, all stage enemies, both villains, every Part I currency/material, chapters, elements, status effects, and all character/weapon banners. The catalog also registers 20 shared weapon-type family marks, three armor-family marks and seven accessory-set marks. A gameplay entity cannot ship in a UI without either a dedicated mark or an explicitly referenced shared family mark. A display name change does not change the stable mark ID.

## Pixel/export standard

- Mark master: clean vector paths on a 512×512 SVG viewBox, with a 1.5 px minimum stroke at master size and no baked letters or tiny ornamental text.
- Standard in-game mark: 128×128 SVG/PNG, transparent background, 1:1 canvas, centered silhouette in a 10% safe margin.
- Compact slot: 64×64; simplify interior cuts and maintain at least 2 px effective strokes at export.
- Micro mark: 32×32 only for secondary status indicators; use a solid silhouette, not a detail-reduced miniature of the full mark.
- App icon is a separate 1024×1024 master and 512×512 Play listing export. Adaptive icon has foreground/background layers; keep the identifying shape inside central 66×66 dp of its 108×108 dp viewport.
- Character and skill marks can share a family frame but retain separate `logo_id` and silhouette; all 80 skill marks are registered individually.
- The portrait game canvas is 1080×1920. Store listing art may use Google Play's externally specified 1024×500 feature graphic dimensions; it is not an in-game screen.

## Shape and color system

- Characters: a role- or prop-led silhouette framed by a broken heraldic escutcheon; one primary palette cue. Do not rely on hue alone.
- Weapons: side-profile silhouette, 15° diagonal allowed, same frame and rarity treatment across the collection.
- Shared common weapons: one unmistakable silhouette per weapon type; each catalog row refers to its family `logo_id`. Do not generate 160 near-duplicate item logos.
- Accessories: unique emblem per named set, shared between its necklace and ring rarity variants; rarity is conveyed by the UI frame, not a different mark.
- Currencies: geometric center icon inside a small medieval seal: Eclipse Token = eclipsed sun; Fate's Thread = knotted strand; Silver Crowns = three stacked crown coins; Ration = bread-and-flask; Focus = filled lantern eye.
- Items: family border distinguishes Chronicle XP books, blacksmith gear parts, alchemy materials, skill notes/leaves and memory materials; inner silhouette identifies the item.
- Villains: irregular but clear silhouette; Bell-Widow = cracked bell/seven wax notches; Clockless Chancellor = handless dial/broken crown arc.
- Chapters: one environmental object inside a map pin/roundel; avoid tiny words and use numbers in UI outside the mark.
- Element/status marks pair silhouette with a short English label or accessible tooltip; no red/green-only state encoding.

## File and version rules

`assets/marks/<category>/<stable_id>_v001.svg` is the source path. Raster exports append `_128.png`, `_64.png` or `_32.png`; retain the SVG as master. A meaningful revision increments `v002`; keep superseded export history in `docs/CHANGELOG.md` and asset state in the manifest. Generated art does not become `approved` until inspected at 32×32, 64×64, 128×128 and against both light/dark UI panels.

## Android store references

## Structured content marks

The runtime packs `characters_part1.json`, `weapons_part1.json`, `armors_part1.json`, `accessories_part1.json`, `items_part1.json` and `enemies_part1.json` carry a `brand_mark_id` on each catalog entry. Shared references resolve through the `weapon_families`, `armor_families` or `accessory_sets` arrays. Cinder of the Unwritten Hour and Weapon Tempering XP are registered as material-mark briefs. Every new row remains `brief` until its SVG file exists and has been reviewed.

The Play listing uses its own square app icon and landscape feature graphic requirements; in-game art stays portrait-first. Android adaptive icons use a separate layer/safe-zone layout. See [Google Play graphic assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB) and [Android adaptive icon design](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).
