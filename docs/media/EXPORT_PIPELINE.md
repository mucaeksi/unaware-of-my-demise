# Export pipeline — from a raw Gemini image to shippable game content

v1 · 2026-10-11 · **design only**: no tool was written, no paid call was made, no budget was reserved (`content/budget/media_budget.json` still has `entries: []`). English only.
Subordinate to `README.md` (sole master prompt), `narrative/` canon and `docs/media/ART_BIBLE.md` (the visual contract). Where this file and the ART_BIBLE differ, the difference is listed in §8 and the owner decides.
Tags: **FACT** verified in the working tree of 2026-10-11 (path given) · **PROPOSAL** decision of this file, owner may replace it · **UNKNOWN** not verifiable yet (first approved paid batch decides).
Scope: the art a player needs from first launch to the restart boundary (`docs/GAME_FLOW.md` screens 1-11). Audio is out of scope (sound comes last). Free CC0 VFX and generic UI glyphs (`docs/media/FREE_ASSETS.md`) do not go through Gemini; the same ingest tool can wrap them later with `source.kind: "external"`.

## 0. The design in one screen

1. **One new CLI, `tools/ingest_art.ts`, offline and free**: raw PNG from `.cache/generated/` + a small committed `*.ingest.json` -> key, slice, trim, normalise, pack, WebP, hash, QC -> `content/approved_art/` (committed, the only place approved pixels live) -> an **assembler** merges those entries into `content/base/` (or a patch directory) and regenerates the art manifest and `release.json`. It never calls Google, never touches `content/budget/`.
2. **Approved art becomes the source of truth, not Git history.** Today `tools/build_content.ts` wipes `content/base` and re-derives art from legacy blobs (`LEGACY_COMMIT`). Generated PNGs are 3-6 MB each and live in git-ignored `.cache/`, so the rebuild cannot reproduce them. Fix: `build_content.ts` reads `content/approved_art/` first and falls back to the legacy builders only for keys that have no approved entry; a `--strict-art` mode (used before the AAB) fails while any `git:` source remains.
3. **First-install set = 29 shipped image files** (27 Gemini-generated, 2 locked re-exports) + 1 manifest, **hard cap 8 632 KB (8.4 MiB), soft target 6.5 MiB** (§2.2). First-attempt generation cost $2.63 at the repo price table (§2.5).
4. **Schema gaps (all additive, all must land before the new AAB, F8)**: `ArtManifest.stills` (lazy full-frame art: prologue plates and event illustrations), `StoryScene.illustration_id`, and a lazy loader in `ArtLibrary`. The UI icon atlas and everything else fit the existing schema (§2.3).
5. **Slicing cannot rely on pixel-exact grids** (Gemini will not place figures at exact offsets). The slicer is component-first with declared counts, gutter cross-checks and a manual `regions` fallback; the request side asks for flat key green, one common scale and wide gutters, no drawn guides (§5).
6. **QC split**: 31 automated gates (§4.1) catch halo, spill, size, hash, slicing, safe-zone and contrast defects; identity, canon, anatomy, pose order and style coherence stay human (§4.2). Approval is an explicit owner-written state in the entry file; the AAB build refuses unapproved entries.

## 1. What exists today (FACT)

| Piece | What it does | Gap for generated art |
|---|---|---|
| `tools/gen_image.ts` | Dry-run default. With `--execute`: reserve -> call -> save `.cache/generated/<id>/<stamp>-<n>[-<i>].png` (`.jpg` if the response mime is jpeg, **`.png` for every other mime, including webp**) + `<stamp>.provenance.json` = `{spec, generated_at, model, references[{path,sha256}], outputs[{file,sha256}], usage, estimated_usd, settled_usd}` | `.cache/` is git-ignored, so the provenance is not durable; `outputs[].file` is an absolute machine path; the extension can lie -> ingest sniffs the format from the bytes |
| `tools/lib/art.ts` | `trimmedCrop` (alpha > 12), `shelfPack` (max width 2048, pad 2, sort height desc then name), `buildUnitAtlas` (one scale from the idle pose, WebP q86 / alpha q92), `buildPortrait` (height 1100, q84), `buildBackground` (width 1920, q82), `buildKeyedImage` (alpha ramp on `g - max(r,b)` 40..130, g clamped to `max(r,b)`, trims, q88), `buildFadedKeyArt` (left-edge ramp, 760 px) | The keyer assumes exactly `#00FF00`, does **no colour decontamination of edge pixels**, and trims (portraits must keep a fixed canvas). Atlas/portrait builders read hard-coded legacy regions and do not key. |
| `tools/build_content.ts` | `rmSync(content/base)` then rebuilds scenes, encounters, units, **art from `UNIT_ART / PORTRAIT_FILES / BG_FILES / UI_FILES` (legacy blobs and `narrative/14_References/...`)**; writes `content/provenance.json` with `git:` sources; `npm run build:content` then runs `make_release.ts` | Cannot accept new pixels; art manifest is assembled in code, so an ingest tool cannot "edit the manifest" without fighting it |
| `tools/build_campaign.ts` | Patch `rel_0003`: **copies the base art manifest** (and the rel_0002 one, being removed in the current working tree), adds placeholder atlases/backgrounds, writes the whole `art/art_manifest.json` | A patch manifest is a full replacement of the base one: a stale copy silently reverts newer base art (§3.8) |
| `packages/content-schema/src/art.ts` | `ArtManifest` (strict): `atlases` (frames `[x,y,w,h]`, max 4096), `units` (8 `UnitAnimState`s, `foot_y` 0.5..1, `pivot_x`), `portraits{emotions,images}`, `backgrounds`, `music`, `ui` (single images) | No `stills`/illustrations; no icon concept |
| `packages/content-schema/src/validate.ts` | Every path referenced by atlases, backgrounds, music, ui, portraits must exist in the effective set; unit `art_key`, scene backgrounds and `show` portraits must resolve | Nothing checks illustrations or unreferenced art files |
| `packages/patch/src/publish.ts` `classify()` | `art/atlas_` -> `atlas_image`, `art/portrait_` -> `portrait`, `art/bg_` -> `background`, everything else under art -> `other_data` (so `ui_logo.webp` is `other_data` today) | `FileKind` is a strict enum inside the signed manifest: adding values is a wire-format change (§2.3 G7) |
| `apps/game/src/content/ArtLibrary.ts` | `loadUi` loads **every** `ui` entry (BootScene calls it at start, `BootScene.ts:60`); `loadUnits` is the only atlas loader; `loadPortraits` loads **all images of a character at once**; `portrait(char, emotion)` falls back to `composed`; `art.ui('studio_mark' / 'logo' / 'key_art')` | No lazy full-frame loader, no generic atlas loader, no icon accessor |
| `apps/game/src/scenes/StoryScene.ts` | Portrait scaled to **980 ref px tall**, bottom-anchored at y 1098-1120, x 500 / 1420; dialogue panel y 805-1055 is 0.97 opaque (`ui/kit.ts`); background cover-scaled 1.02 -> 1.08 | `illustration_id` in the narrative is dropped by `tools/lib/data.ts buildScene` |
| `apps/game/src/scenes/PrologueScene.ts` (F4, **uncommitted at the time of writing**) | Plate from `art.ui('prologue_' + scene.visual)` (3 families: village, crownfall, road), painted stand-ins in `entry/plates.ts`, cover-scaled with zoom 1.0 <-> 1.09 and a horizontal drift of +-46 px | Plates would be eager-loaded by `loadUi`; one plate per family, not per scene |
| `apps/game/src/content/ContentService.ts` | `asset(path)` -> cache key `path@<sha256[0:10]>`; embedded base is verified file by file against `content/base/release.json` (`loadBase`); an active patch release shadows the base per path | **Any change to a base art file without regenerating `release.json` makes the client throw "failed its integrity check"** |
| Current provisional base art | 14 webp + the manifest, 3.4 MB total (atlas 450 KB / 400 KB / 250 KB / 155 KB, portraits 200-300 KB at 825x1100 or 733x1100, background 1536x1024 163 KB, logo 1400x647 166 KB, key art 760x1362 75 KB); music 4.4 MB sits next to it in the base | Legacy crimson Fadyme atlas must not ship or be used as a reference (README, reference/README.md) |

## 2. The first-install art set

### 2.1 Exact manifest entries

Asset ids follow ART_BIBLE §3.0 (`^[a-z][a-z0-9_]{2,63}$`). "Export" is the shipped pixel size. Caps are per file (§2.2). Every generated asset is **`count: 1`, `gemini-3.1-flash-image`, `2K`** unless stated (price table `IMAGE_PRICES_USD`).

**A. Unit atlases** — field `atlases.atlas_<key>` + `units.<key>`; file `art/atlas_<key>.webp`; consumer `UnitView` via `ArtLibrary.loadUnits`. Runtime scale is `height_px / idle_frame_height`, so the atlas frame size is free; PROPOSAL: **idle frame height = 1.2 x runtime `height_px`** (covers a 1.33 x device-pixel ratio on QHD phones without a 1.0 x blur), all states share the sheet's one scale (`scale: 1`).

| Asset id | Key | `facing` / `height_px` | Idle frame px | Frames (atlas frame names) | Sheet layout (§5) |
|---|---|---|---|---|---|
| `fadyme_chibi_sheet` | `fadyme` | right / 360 | 432 | `idle walk basic active ultimate hit defeat victory` | 4x2 |
| `mahmut_chibi_sheet` | `mahmut` | right / 360 | 432 | same 8 | 4x2 |
| `bellbound_dead_chibi_sheet` | `bellbound_dead` | left / 340 | 408 | `idle basic hit defeat`; `state_map`: walk->idle, victory->idle, active->basic, ultimate->basic (as `build_content.ts` does today) | 2x2 |
| `hollow_pilgrim_chibi_sheet` | `hollow_pilgrim` | left / 380 | 456 | same 4 and `state_map` | 2x2 |

Export: atlas <= 2048 x 1024 (hero, estimated 2048 x ~960), <= 2048 x 768 (enemy, estimated ~1700 x 460); WebP lossy q82 / alpha q92, `smartSubsample`, `exact: true`; pad 4 px; `foot_y` and `pivot_x` computed (§3.4 step 7).

**B. Portraits** — field `portraits.<char>.images.<tag>` = `art/portrait_<char>_<tag>.webp` and `portraits.<char>.emotions.<tag> = "<tag>"` (identity map; `composed` always present, `ArtLibrary.portrait` falls back to it). Consumer `StoryScene` via `loadPortraits`. Tags are exactly the `emotion` values the six tutorial scenes use (**FACT**, computed from `narrative/09_VN_Scripts/Runtime_Snapshot/game/data/entry/tutorial_v001.json`): Mahmut `composed, watchful, protective, dry_humor`; Fadyme `composed, dry_amusement, soft_smile, determined`.

| Asset ids | Export | Format | Cap each |
|---|---|---|---|
| `mahmut_vn_composed`, `mahmut_vn_watchful`, `mahmut_vn_protective`, `mahmut_vn_dry_humor`, `fadyme_vn_composed`, `fadyme_vn_dry_amusement`, `fadyme_vn_soft_smile`, `fadyme_vn_determined` | **768 x 1152** (exact 2:3, **fixed canvas, not trimmed**, alpha) | lossy q80 / alpha q90 | 240 KB |

Fallback that costs nothing: manifest aliasing (`emotions.watchful = "composed"`), as the provisional base does today.

**C. Battle backgrounds** — field `backgrounds.<location_id>` = `art/bg_<location_id>.webp`; consumers `BattleScene`, `StoryScene`, `TitleScene`, hub, chapters (all call `loadBackground / addBackdrop('forest_whispering_ash')`). Export **1920 x 1080 opaque**, lossy q80, cap 320 KB, 7.9 MB decoded.

| Asset id | Key | Used by |
|---|---|---|
| `bg_forest_whispering_ash_ordered` | `forest_whispering_ash` (existing id, every narrative scene uses it) | T-1, T-2 battle and story, title, hub, chapters |
| `bg_forest_shelter_dusk` (**PROPOSAL, owner decision**) | `forest_shelter` | T-3 battle only: ART_BIBLE §7.8 says T-3's fight is at a broken-roof shelter's doorway. Narrative keeps `location_id: forest_whispering_ash` for T-3, so the switch is a **build-time override in `buildEncounter`** (encounter file only, with a `provenance.note`), not a canon edit. Without the owner's yes, the second background does not exist and T-3 reuses the first. |

**D. Stills (new group `stills`, lazy)** — field `stills.<id>` = `art/still_<id>.webp`. Export **1920 x 1080 opaque**.

| Asset id | `stills` key | Source of the key | Format | Cap each |
|---|---|---|---|---|
| `ill_roadside_rest` | `roadside_rest` | narrative `illustration_id` of `tutorial_t2_after` (verbatim) | lossy q82 | 380 KB |
| `ill_shelter_evening` | `shelter_evening` | narrative `illustration_id` of `tutorial_t3_after` (verbatim) | lossy q82 | 380 KB |
| `prologue_village_hours`, `prologue_village_names`, `prologue_village_ordinary_days`, `prologue_village_search`, `prologue_crownfall_throne_wars`, `prologue_crownfall_crownfall`, `prologue_crownfall_roads`, `prologue_road_reunion`, `prologue_road_beginning` | `prologue_hours`, `prologue_names`, `prologue_ordinary_days`, `prologue_search`, `prologue_throne_wars`, `prologue_crownfall`, `prologue_roads`, `prologue_reunion`, `prologue_beginning` | `prologue_<scene.id>` of `prologue_v001.json` (the `visual` value names the family, ART_BIBLE §3.5) | lossy q78 | 300 KB |

Prologue plate resolution order (PROPOSAL, replaces the F4 rule): `stills.prologue_<scene.id>` -> `stills.prologue_<scene.visual>` (optional family fallback, one image shared by the scenes of a family) -> the painted stand-in in `entry/plates.ts`. **Minimum viable alternative (budget lever L2, §2.2): 3 family plates `prologue_village`, `prologue_crownfall`, `prologue_road`** — this is exactly what F4's code asks for today (`art.ui('prologue_' + visual)`), but it puts 3 x 7.9 MB of decoded textures into `loadUi` at boot, which is why it should move to `stills`. Composition for plates: PrologueScene zooms up to 1.09 and drifts 46 px, so **keep key content inside the central ~84 % of the frame** (1/1.09 = 92 % visible at full zoom, minus the drift); caption text sits in the bottom band.
Moving layers (bell and rope, quill hand, walkers) from ART_BIBLE §3.5 are **not part of the first-install minimum**: the schema has no layer concept; an additive `still_layers` field can follow later without breaking the string form of `stills`.

**E. UI** — field `ui.<name>` = `art/ui_<name>.webp`; consumers `StudioScene`, `TitleScene`; eager-loaded by `loadUi` (fine: small, needed at boot).

| Asset id | `ui` key | Export | Cap | Note |
|---|---|---|---|---|
| `studio_mark_01` (**optional**) | `studio_mark` | fit inside 512 x 512, keyed, alpha | 60 KB | StudioScene shows <= 260 x 260 ref px; concept and name clearance are UNKNOWN (ART_BIBLE §3.7); the text-only ornament ships if the owner gives no brief |
| (locked, no generation) | `logo` | width 1400 (1400 x 647), keyed, alpha | 200 KB | byte-exact `narrative/14_References/recovered_locked_v001/logo/brand_logo_wordmark_r2_v003.png`; existing `buildKeyedImage` output stays valid |
| (locked, no generation) | `key_art` | 760 x 1362, left-edge alpha ramp | 120 KB | byte-exact `.../key_art/brand_key_art_portrait_r2_v003.png`; existing `buildFadedKeyArt` stays valid |

**F. UI icon atlas** — field `atlases.atlas_ui_icons` (no schema change; frame names <= 40 chars are the icon ids); file `art/atlas_ui_icons.webp` (`classify` -> `atlas_image`). Asset `icons_core_01`, **1:1, 2K** (the 1K price is lower, `$0.067`, but 4x4 glyphs at 128 px want a 2K source), keyed, R3 style. Export **512 x 512 = fixed 4x4 grid of 128 px cells** (glyph fit into 112 px, 8 px padding), lossy q90 / alpha q95 or lossless if smaller, cap 120 KB. Row-major frame ids (PROPOSAL; every id is derived from something already in the runtime):
`el_veil el_stone el_ember el_tide el_gale el_dawn` (the six `Element`s; Stone and Veil are the tutorial elements) · `skill_basic skill_active skill_ultimate` · `st_dread st_stoneguard st_taunt` (the three statuses the four base units actually use, **FACT** from `units/unit_pack.json`) · `focus eclipse_token` (README single currency) · `bell wax_seal` (ART_BIBLE §3.6 vocabulary, reserve). Generic system glyphs (settings, pause, close, arrows, lock) come from CC0 Kenney Game Icons, not from Gemini. **No battle/hub screen reads these frames yet** (`BattleScene` only tints by element), so this atlas is the one first-install item the owner can defer ($0.10 and 120 KB) without breaking anything.

### 2.2 Size and memory budget (embedded base, images only)

Totals are sums of per-file caps (**PROPOSAL; calibrate after the pilot, §6.2**; the ingest tool searches quality down to a floor of q70 / alpha q85 to meet a cap and fails if it cannot).

| Class | Files | Export | Cap each | Class total | Decoded each |
|---|---|---|---|---|---|
| Prologue plates | 9 | 1920x1080 | 300 KB | 2 700 KB | 7.9 MB |
| Portraits | 8 | 768x1152 | 240 KB | 1 920 KB | 3.4 MB |
| Hero atlases | 2 | <= 2048x1024 | 650 KB | 1 300 KB | <= 8.0 MB |
| Enemy atlases | 2 | <= 2048x768 | 400 KB | 800 KB | <= 4.0 MB (est. 3 MB) |
| Event illustrations | 2 | 1920x1080 | 380 KB | 760 KB | 7.9 MB |
| Battle backgrounds | 2 | 1920x1080 | 320 KB | 640 KB | 7.9 MB |
| Logo | 1 | 1400x647 | 200 KB | 200 KB | 3.5 MB |
| Key art | 1 | 760x1362 | 120 KB | 120 KB | 4.0 MB |
| Icon atlas | 1 | 512x512 | 120 KB | 120 KB | 1.0 MB |
| Studio mark | 1 | <= 512x512 | 60 KB | 60 KB | 1.0 MB |
| `art_manifest.json` | 1 | n/a | 12 KB | 12 KB | n/a |
| **Total** | **30 files** | | | **8 632 KB = 8.43 MiB** (hard cap) | |

Soft target **6.5 MiB** (typical outputs should land at 55-75 % of their caps). For comparison the provisional art is 3.4 MB; the growth is the 9 plates, 2 illustrations and the icon atlas. WebP is stored as-is in the APK, so the APK delta equals the byte total.
Decoded (GPU) budget, PROPOSAL, to be checked on a real low-end Android with `phaser4-mobile-qa`: **<= 64 MB of art textures resident per scene**. Estimates from the table: Title 15 MB (background + key art + logo); Prologue 16 MB (two plates during a crossfade, unload the old one); Story before-battle 35 MB (background + 8 portraits, because `loadPortraits` loads every image of a character); Story after-battle with an illustration 43 MB (unload the background once the still covers it); Battle 31 MB (background + 2 hero + 2 enemy atlases + icons).
Levers if the owner wants a smaller base: **L1** plates at 1600x900 q76 / 220 KB (-720 KB, -2.5 MB decoded per plate in a crossfade); **L2** three family plates instead of nine (-1.8 MB, -$0.61 generation); **L3** drop the studio mark (-60 KB); **L4** alias `mahmut watchful -> composed` (-240 KB, -$0.10); **L5** defer the icon atlas (-120 KB, -$0.10).

### 2.3 Schema gaps and the minimal additions

All additions are **optional-with-default inside strict objects**. Old clients reject unknown keys of a strict schema, so (a) the client with the new parser must exist before a manifest with the new keys is first served, (b) **they must land before the new AAB (F8)**: after a store build ships them, any further art-manifest field needs a `content_schema` bump (older clients then ignore the release by `compat.content_schema`, `docs/PATCHING.md`). Because the new keys are in the embedded base itself, base and client cannot mismatch.

| # | Gap (FACT) | Minimal addition (PROPOSAL) |
|---|---|---|
| G1 | No home for full-frame art that must **not** load at boot (`ArtManifest.ui` is eagerly loaded) | `art.ts`: `stills: z.record(Id, SafeAssetPath).default({})` with the doc comment "full-frame story art loaded on demand: prologue plates `prologue_<scene id>` and event illustrations (narrative `illustration_id`)". `validate.ts`: add `Object.values(art.stills)` to the "referenced file must exist" list. |
| G2 | Narrative carries `illustration_id` (`roadside_rest`, `shelter_evening`) but `StoryScene` has no field and `tools/lib/data.ts buildScene` drops it | `story.ts`: `StoryScene.illustration_id: Id.optional()` (scene-level; matches v006 "the two shared illustrations stay on screen across speaker changes"). `data.ts`: pass it through. `validate.ts`: `scene.illustration_id` must exist in `art.stills`. `StoryScene.ts`: show the still above the background, below the HUD, and hide the actors while it is shown (v006 UNKNOWN: confirm with the owner whether portraits stay). A per-line `still` op would be more expressive but is a new story-runner op (new binary code); not needed for the two tutorial scenes. |
| G3 | F4 resolves `art.ui('prologue_' + visual)` | Change to the resolution order of §2.1 D through one helper (`ArtLibrary.plate(sceneId, visual)`), lazy per scene. No schema change; **coordinate with the F4 work in progress**. |
| G4 | No generic atlas loader or icon accessor | No schema change: `atlases.atlas_ui_icons` + frame ids. `ArtLibrary`: `loadAtlas(scene, atlasId)` (generalise the frame-adding code in `loadUnits`) and `icon(id) -> {key, frame}`. |
| G5 | Second battle background needs an id the narrative does not use for T-3 | Build-time override table in `tools/build_content.ts buildEncounter` (`T-3 -> forest_shelter`), owner decision; encounter `location_id` only (the T-3 story scenes and the `shelter_evening` still keep `forest_whispering_ash`). |
| G6 | Nothing detects unreferenced art files, so replaced legacy files would silently ship | **Not** in `validateContentSet` (a patch's effective set legitimately contains base files its manifest no longer references). Put it in the assembler: run on the release directory itself, fail if a file under `art/` is not referenced by that directory's manifest. |
| G7 | `FileKind` is a strict enum in the signed manifest | **Do not extend it.** Map the new prefixes inside `classify()`: `art/still_` -> `background`, `art/ui_` stays `other_data`. Zero wire-format risk. |
| G8 | `ArtLibrary.loadUi` must keep loading only small boot images | No change; stills/plates/illustrations load through a new `loadStills(scene, ids)` / `still(id)` pair and are released by the scene that loaded them. |

### 2.4 Naming and mapping rules (the assembler enforces them)

| Class | Spec id (ImageSpec) | Manifest key | Shipped file |
|---|---|---|---|
| unit sheet | `<unit>_chibi_sheet` | `atlases.atlas_<unit>`, `units.<unit>` | `art/atlas_<unit>.webp` |
| portrait | `<char>_vn_<tag>` | `portraits.<char>.images.<tag>` | `art/portrait_<char>_<tag>.webp` |
| background | `bg_<location>_<variant>` | `backgrounds.<location>` | `art/bg_<location>.webp` |
| illustration | `ill_<illustration_id>` | `stills.<illustration_id>` | `art/still_<illustration_id>.webp` |
| prologue plate | `prologue_<visual>_<scene_id>` | `stills.prologue_<scene_id>` | `art/still_prologue_<scene_id>.webp` |
| UI image | `studio_mark_<nn>` / locked | `ui.<name>` | `art/ui_<name>.webp` |
| icon atlas | `icons_<set>_<nn>` | `atlases.atlas_ui_icons` | `art/atlas_ui_icons.webp` |

The shipped file name is **derived** from the manifest key, never typed by hand, and is stable across revisions (§3.6). Legacy image keys (`wry`, `warm`, `resolve`, `protective_resolve`) disappear: portrait image keys become the emotion tags.

### 2.5 Generation cost of the set (from `IMAGE_PRICES_USD`, verified 2026-10-11; re-check the pricing page before the owner approves spend)

27 generated images: 4 sheets + 8 portraits + 2 backgrounds + 2 illustrations + 9 plates + 1 icon sheet = 26 x $0.101 = **$2.626**, + studio mark $0.067 = **$2.693** for one attempt each. Worst case with the 3-attempt cap on every asset: $7.88 (+ $0.20). The logo and key art cost nothing (locked). Fits the $20 month and the $3 per-reservation cap (each spec is its own reservation). Re-ingesting a different candidate of an already generated spec costs nothing; only a new generation call counts as an attempt (`attemptsFor`).

## 3. `tools/ingest_art.ts` — design

### 3.1 Place in the chain

```
art_specs/<set>/<id>.json            ImageSpec (committed; gen_image input; holds the prompt)
   | reserve + call (tools/gen_image.ts)            <- only paid step
.cache/generated/<id>/<stamp>-<n>.png + <stamp>.provenance.json     (git-ignored)
   | tools/ingest_art.ts <id>.ingest.json           <- free, offline, deterministic
.cache/ingest/<id>/                   preview run: key_alpha.png, slices.png, review.png, qc.json  (git-ignored)
   | --execute
content/approved_art/                 COMMITTED, only approved pixels
   art/…webp                          shippable files (release-relative paths)
   entries/<id>.json                  manifest fragment + lock + QC + approval state
   provenance/<id>.<stamp>.provenance.json     verbatim copy of gen_image's file (paths made repo-relative)
   qc_thresholds.json                 thresholds calibrated on the pilot
   | tools/ingest_art.ts assemble --target base | patch:<dir>
content/base/**  or  content/patches/<rel>/**   (+ regenerated art_manifest.json, release.json, content/provenance.json)
   | make_release.ts / publish_release.ts (sha256 manifest, R2 objects, ES256 signature at publish)
client (embedded base, or signed patch shadowing it per path)
```

Raw originals (3-6 MB PNG each) are not committed: they are archived under their SHA-256 in a **private** R2 bucket (UNKNOWN/owner decision: bucket name proposal `uomd-media-originals`; until it exists they stay in `.cache/`). The committed entry keeps their hash, so a missing raw only prevents *re-ingesting*; the shipped WebP stays valid and verifiable.

### 3.2 CLI (PROPOSAL; same safety stance as `gen_image.ts`: nothing is written to `content/` without `--execute`)

```
npx tsx tools/ingest_art.ts init   --spec art_specs/p0/fadyme_chibi_sheet.json --class unit_sheet   # writes a template *.ingest.json
npx tsx tools/ingest_art.ts <ingest.json> [--source <file>]            # PREVIEW: .cache/ingest/<id>/ only; prints QC report
npx tsx tools/ingest_art.ts <ingest.json> --execute                    # promotes to content/approved_art/ (state: pending)
npx tsx tools/ingest_art.ts approve <asset_id> --by owner [--note ""]  # sets human.status approved (owner action; the agent never self-approves)
npx tsx tools/ingest_art.ts reject  <asset_id> --reason "..."
npx tsx tools/ingest_art.ts assemble --target base [--require-approved] [--strict-art]
npx tsx tools/ingest_art.ts assemble --target patch:content/patches/rel_0004_art_pass1
npx tsx tools/ingest_art.ts verify                                     # CI: locks vs files, caps, orphans, duplicates (no raw needed)
npx tsx tools/ingest_art.ts report                                     # byte and decoded-memory table per class and per scene
```

### 3.3 The per-asset ingest file (`art_specs/<set>/<id>.ingest.json`, committed, written by a human or `init`)

```ts
interface IngestSpec {
  schema: 1;
  asset_id: string;                          // = ImageSpec.id for generated sources
  class: 'unit_sheet' | 'portrait' | 'background' | 'still' | 'ui_image' | 'icon_sheet';
  source:
    | { kind: 'generated'; pick: string; provenance?: string }          // pick = >=10 hex chars of an output sha256 listed in the provenance
    | { kind: 'locked'; file: string; sha256: string }                  // byte-exact owner-approved originals (logo, key art)
    | { kind: 'external'; file: string; sha256: string; license_record: string };  // CC0 packs
  key?: { colour: 'auto' | string; sample: ('top' | 'bottom' | 'left' | 'right')[]; alpha_ramp: [number, number]; choke_px: number; despill: boolean };
  layout: { mode: 'single' }
        | { mode: 'grid'; cols: number; rows: number; cells: string[]; merge_gap_px?: number; min_gutter_pct?: number }
        | { mode: 'regions'; cells: Record<string, [number, number, number, number]> };   // manual fallback, source pixels
  frames?: { idle: string; idle_frame_px: number; ground: 'lowest'; pivot: 'lower_body_centroid' | 'alpha_centroid';
             cell_order?: number[]; state_map?: Record<string, string>; overrides?: Record<string, { foot_y?: number; pivot_x?: number }> };
  export: { fit: 'exact' | 'inside' | 'trim'; width?: number; height?: number; max_atlas?: number; pad?: number;
            webp: { mode: 'lossy' | 'lossless' | 'near_lossless'; quality: number; alpha_quality: number; effort: number }; max_bytes: number };
  manifest: Record<string, unknown>;         // per class, see examples; the file path is derived (§2.4)
  qc: { profile: 'bust_r1' | 'chibi_r2' | 'plate' | 'icon_r3' | 'mark'; overrides?: Record<string, number> };
}
```

Example 1 — portrait (fixed canvas; key colour sampled from top/left/right edges because a bust may be cut at the bottom):
```json
{ "schema": 1, "asset_id": "fadyme_vn_composed", "class": "portrait",
  "source": { "kind": "generated", "pick": "9c41f0aa27" },
  "key": { "colour": "auto", "sample": ["top", "left", "right"], "alpha_ramp": [0, 255], "choke_px": 0.5, "despill": true },
  "layout": { "mode": "single" },
  "export": { "fit": "exact", "width": 768, "height": 1152, "webp": { "mode": "lossy", "quality": 80, "alpha_quality": 90, "effort": 5 }, "max_bytes": 245760 },
  "manifest": { "character": "fadyme", "image": "composed", "emotion_tags": ["composed"] },
  "qc": { "profile": "bust_r1" } }
```
Example 2 — hero chibi sheet (4x2, order = `UNIT_ANIM_STATES`, idle frame 432 px):
```json
{ "schema": 1, "asset_id": "fadyme_chibi_sheet", "class": "unit_sheet",
  "source": { "kind": "generated", "pick": "e03b7d11c8" },
  "key": { "colour": "auto", "sample": ["top", "bottom", "left", "right"], "alpha_ramp": [0, 255], "choke_px": 0.5, "despill": true },
  "layout": { "mode": "grid", "cols": 4, "rows": 2, "cells": ["idle","walk","basic","active","ultimate","hit","defeat","victory"] },
  "frames": { "idle": "idle", "idle_frame_px": 432, "ground": "lowest", "pivot": "lower_body_centroid" },
  "export": { "fit": "trim", "max_atlas": 2048, "pad": 4, "webp": { "mode": "lossy", "quality": 82, "alpha_quality": 92, "effort": 5 }, "max_bytes": 665600 },
  "manifest": { "atlas": "atlas_fadyme", "unit": "fadyme", "facing": "right", "height_px": 360 },
  "qc": { "profile": "chibi_r2" } }
```
Example 3 — enemy sheet: same, with `"layout": {"mode":"grid","cols":2,"rows":2,"cells":["idle","basic","hit","defeat"]}` and `"frames": {..., "state_map": {"walk":"idle","victory":"idle","active":"basic","ultimate":"basic"}}`.
Example 4 — opaque plate: no `key`, `layout.single`, `export {fit:"exact",width:1920,height:1080,...,max_bytes:307200}`, `manifest {still:"prologue_hours"}`, `qc.profile "plate"`. Example 5 — icon sheet: `layout.grid 4x4` with the 16 frame ids as `cells`, `export {fit:"trim", pad:16, grid:{cell:128}}`, `manifest {atlas:"atlas_ui_icons"}`.

### 3.4 Steps (each step is a pure function of its inputs; no randomness, stable sorts, integer geometry)

0. **Resolve and verify the source.** Generated: find the provenance whose `outputs[]` contains a hash starting with `pick`; recompute the file's SHA-256; require the spec embedded in the provenance to equal the committed `art_specs/.../<id>.json` (else record `spec_drift: true` and warn). Locked: SHA-256 must equal the pinned value (and appear in `reference/INDEX.json` or the locked folder). **Reference hygiene (gate A31)**: every `provenance.references[]` path must be under `reference/`, `narrative/14_References/recovered_locked_v001/` or an already-approved `content/approved_art/art/` file; any hash equal to a legacy-derived source (`content/provenance.json` `git:` sources, current `content/base` files) fails ingest (the crimson Fadyme atlas must never leak into a prompt, README).
1. **Decode.** Sniff the container from the magic bytes (PNG/JPEG/WebP), convert to 8-bit sRGB RGBA, no EXIF rotation. A JPEG source is allowed but warned (block noise widens the key tolerance).
2. **Key** (keyed classes only; generation never outputs alpha, ART_BIBLE §3.0), at **full source resolution**:
   1. Estimate the key colour `K` = per-channel median of a border ring (width max(4 px, 0.5 % of the short side)) on the declared `sample` edges, rejecting pixels whose green dominance is below 200; report `K` and the ring sigma (gate A07). Default expectation `#00FF00`; the reference sheets measure `#03FE03`-`#04FB06`.
   2. Alpha from a **linear mixing ramp**: `dom = g - max(r,b)` and `domK = K.g - max(K.r,K.b)` (about 250 for `#00FF00`); `alpha_ramp = [t0, t1]` is given on the 0..255 dominance scale and rescaled to `lo = t0 * domK / 255`, `hi = t1 * domK / 255`; `alpha = 1 - clamp((dom - lo) / (hi - lo), 0, 1)`. Default **[0, 255]**, i.e. alpha falls linearly from 1 (dominance 0, any non-green subject) to 0 (pure key). Today's `buildKeyedImage` uses [40, 130], which is steeper and eats into the subject edge.
   3. **Decontaminate** every pixel with `0 < alpha < 1`: `F = clamp((C - (1 - alpha) * K) / alpha)`, then **despill** every pixel with `alpha > 0`: `g = min(g, max(r, b))`.
   4. Optional **choke** (alpha erosion of `choke_px`, default 0.5) to remove the residual rim; **speck removal** (connected alpha components under 0.02 % of the image area and not inside a figure's dilated bounding box are zeroed).
   5. **Alpha bleed**: RGB of fully transparent pixels is filled from the nearest opaque pixel (4 px), so neither a straight-alpha nor a premultiplied sampler, nor the lossy encoder, ever mixes key green or black into an edge. Re-applied after the final resize. Encode with `exact: true`.
   *Evidence (synthetic fixture, scratchpad script, not in the repo): a plum disc with a soft 1.5 px edge and a lilac rim on `#00FF00`, composited over bone ivory and compared with the true render over bone ivory. Mean RGB error on the 1 943 edge pixels: current ramp 40..130 without decontamination **24.6** (worst 158); same ramp with decontamination 21.0; linear ramp 0..255 with decontamination **10.7** (worst 48); ramp 20..235 with decontamination 13.3. The linear model wins but leaves faint green on a few pixels (79 here), which the despill, choke and gate A08 handle. Parameters must be re-calibrated on real Gemini output; the same fixture becomes a unit test with the real tool.*
3. **Layout** (§5.4): `single` -> one cell (the whole frame, no trim for portrait/still/background); `grid` -> deterministic component slicing into `cols x rows` named cells; `regions` -> the manual rectangles. Emits `slices.png` (the detected boxes drawn on the sheet) and `slices.json`. `cell_order` can remap cells without re-generation (pose in the wrong cell).
4. **Trim** each cell on 8-bit `alpha > 12` (same threshold as `trimmedCrop`, for continuity), keeping the bounding box, the alpha area, the **ground row** (lowest row with 8-bit `alpha >= 128` after speck removal) and the pivot sample.
5. **Normalise** (sheets): one scale `k = idle_frame_px / idle_trim_height` for **every** frame (the sheet already shares a scale; singles drifting in size are why the legacy build needed `relativeHeight`); `k > 1` (upscaling) fails gate A03. Resize with Lanczos3. Frames keep their own sizes (an extended sword pose is wider than idle; `scale` stays 1).
6. **Baseline and pivot** (per frame, written to the manifest): `foot_y = (ground_row + 1) / frame_height`, clamped to [0.9, 1.0] (the legacy build used the constant 0.985); `pivot_x` = alpha-weighted centroid x of the **lowest 35 % of the figure**, as a fraction of the trimmed width (the legacy whole-figure centroid made Mahmut's `basic` pivot 0.383 against 0.578 for idle because the sword drags the centroid; a lower-body centroid keeps the feet where the idle feet were). `overrides` per frame exist for the odd pose.
7. **Pack**: `shelfPack` rules of `tools/lib/art.ts` (sort height desc then name asc, max width 2048, **pad 4**), fixed 128 px grid for the icon atlas; atlas must be <= 2048 x 2048 (decoded cap per class §2.2) or the step fails. Frame rectangles `[x, y, w, h]` go to `atlases.<id>.frames`.
8. **Encode**: WebP per `export.webp`; if over `max_bytes`, lower `quality` in steps of 2 down to q70 / alpha q85 (deterministic search), else fail with the achievable size. Optional `lossless` / `near_lossless` is tried for icons and the smaller one that passes QC wins.
9. **Hash**: `output_sha256` (bytes, authoritative for the release manifest), `pixels_sha256` (SHA-256 of the decoded RGBA, stable across libwebp versions), width, height, bytes, decoded MB.
10. **QC** (§4.1) runs on the **decoded encoded output**, not on the intermediate. Writes `qc.json` and `review.png`: sprite frames on `C.ink`, `C.bone` and the forest background at 300 %, the runtime view at display size with the unit shadow ellipse, a 160 px silhouette strip, the alpha matte, and the detected slices.
11. **Entry/lock** (§3.5) and, with `--execute`, atomic promotion: files are written to a temp directory and renamed; the entry JSON is written last.

### 3.5 The committed entry (`content/approved_art/entries/<asset_id>.json`)

```json
{ "schema": 1, "asset_id": "fadyme_chibi_sheet", "revision": 1,
  "targets": { "atlases": { "atlas_fadyme": { "image": "art/atlas_fadyme.webp", "width": 2048, "height": 962, "frames": { "idle": [4,4,300,432] } } },
               "units": { "fadyme": { "atlas": "atlas_fadyme", "facing": "right", "height_px": 360, "states": { "idle": { "frame": "idle", "scale": 1, "foot_y": 0.988, "pivot_x": 0.514 } } } } },
  "source": { "kind": "generated", "sha256": "e03b7d11c8…", "mime": "image/png", "width": 2752, "height": 1536,
              "provenance_file": "content/approved_art/provenance/fadyme_chibi_sheet.2026-10-12T09-14-03-221Z.provenance.json", "provenance_sha256": "…",
              "model": "gemini-3.1-flash-image", "size": "2K", "spec_path": "art_specs/p0/fadyme_chibi_sheet.json", "spec_sha256": "…", "prompt_sha256": "…",
              "references": [ { "path": "reference/locked/fadyme/sheet/char-fadyme-uomd.png", "sha256": "…" } ],
              "settled_usd": 0.101, "attempt": 2, "archive": "r2://uomd-media-originals/e03b7d11c8….png" },
  "ingest": { "spec_path": "art_specs/p0/fadyme_chibi_sheet.ingest.json", "spec_sha256": "…", "tool": "ingest_art@1", "sharp": "0.35.5", "vips": "8.18.7", "libwebp": "1.6.0", "fingerprint": "…" },
  "outputs": [ { "path": "art/atlas_fadyme.webp", "sha256": "…", "pixels_sha256": "…", "bytes": 561220, "width": 2048, "height": 962 } ],
  "qc": { "automated": { "passed": true, "warnings": [], "report": "…", "thresholds_sha256": "…" }, "human": { "status": "pending", "by": null, "at": null, "note": "" } },
  "license": { "origin": "google_gemini_output", "terms_checked_on": null, "note": "owner/legal check pending; do not strip or alter embedded provenance marks deliberately" },
  "history": [] }
```
Environment values above (`sharp`, `vips`, `libwebp`) are the versions installed today (**FACT**: `sharp 0.35.5`, libvips 8.18.7, libwebp 1.6.0; `sharp` is pinned exactly in the root `package.json`).

### 3.6 Idempotency, determinism, revisions

- **Fingerprint** = SHA-256 of `{source_sha256, canonical ingest JSON, tool version, thresholds_sha256}`. Same fingerprint and the output files exist with the recorded hashes -> **no-op**, exit 0, "unchanged". A different source or ingest file -> new `revision`, the previous revision's `{outputs, source, qc}` pushed to `history[]`, files overwritten **at the same release path** (stable names keep base and patch overlays aligned). `--force` re-runs without changing inputs.
- **Byte determinism**: same inputs + same tool + same sharp/libvips/libwebp -> byte-identical WebP. `verify` compares `output_sha256` first; if only that differs but `pixels_sha256` matches it reports "toolchain drift" (warning), not corruption.
- **Atomic and ordered**: temp dir -> rename files -> write entry last; an interrupted run leaves either the old complete revision or none.
- **Manifest edit is regeneration, not patching**: the assembler is the only writer of `art_manifest.json`: it merges entries sorted by key (stable JSON), validates with `ArtManifest.parse` and `validateContentSet` over the effective set, and refuses duplicate keys across entries.
- **Only approved candidates are committed.** Git history is permanent and a full pass is ~8.4 MiB; rejected or unreviewed candidates stay in `.cache/` (and R2). Batch `--execute` per approved set to keep revisions few.

### 3.7 Replacing the legacy-derived entries in `content/base/art`

1. `build_content.ts` gets one new first step: load `content/approved_art/entries/*.json`. For every manifest key that has an entry, the entry wins and the legacy builder for that key is **not run** (its legacy sources are no longer read). Remaining keys fall back to the existing builders, so the game stays playable while assets arrive one by one. `content/provenance.json` records approved outputs with `sources: { "generated:<asset_id>@rev<n>": <raw sha256>, "entry": <entry sha256> }` instead of `git:` paths.
2. Order of replacement (also the generation order, §6.2): Fadyme portraits and sheet, backgrounds, enemy sheets, Mahmut, stills, plates, icons. Portrait image keys change from `wry/warm/resolve/protective_resolve` to the emotion tags; the old files become orphans.
3. `assemble` rebuilds the target directory and **deletes unreferenced files under `art/`** (G6), so the legacy WebPs leave `content/base` when their last reference does. `--strict-art` (required for the AAB build) fails if any manifest key is still legacy-derived, any entry is not `approved`, or any cap in §2.2 is exceeded.
4. Locked items (`logo`, `key_art`) keep their current builders until the strict switch; then they get thin `source.kind: "locked"` ingest files so they appear in the same lock inventory. When every key is approved-art, delete the legacy tables, `LEGACY_COMMIT` use and the legacy branch of `fsutil.ts`.
5. **CI reproducibility** (the content-reproducibility gate in the Workers Builds command, P2): rebuild = `f(narrative, content/approved_art)`; raw originals and Gemini are not needed. `verify` replaces "rebuild art from sources" for approved entries.

### 3.8 Base vs patch, signing, publishing (`docs/PATCHING.md`) and the traps

- **Base (rel_0001, embedded in the AAB)**: `assemble --target base`, then `npm run build:content` regenerates `release.json` (sha256 of every file). The client verifies each base file against it (`loadBase`), so **a base art change without a new `release.json` is a boot failure**; the assembler ends by calling the same `make_release` step, and `verify` re-checks the pairing. The base is unsigned; its integrity comes from the AAB itself.
- **Patch (after the AAB ships)**: `assemble --target patch:content/patches/rel_NNNN_*`, then `make_release.ts --depends rel_0001:1` or `publish_release.ts` (objects `PUT` by sha256 to R2, draft release, server signs ES256 on publish, rollback = a new higher generation pointing at older files). A patch file at the same path **shadows** the base file for that path; the base bytes stay in the install. **Therefore replace art in the base before F8**; use patches only for art added or changed after the store build.
- **Trap — stale manifest overlay**: every release that carries `art/art_manifest.json` replaces the whole base manifest (`build_campaign.ts` copies the base one). Rule: patch manifests are produced by the **same assembler** from the same approved store, and the assembler gate "a patch manifest may not drop or change a base key unless the entry lists it in `replaces[]`" prevents a stale copy from reverting newer base art. After any base art change, re-run `build:content` **then** `build:campaign`.
- **Trap — working tree in flux**: at the time of writing `build_content.ts`, `build_campaign.ts`, `validate.ts` and the entry/patch client code have uncommitted changes (F2-F4). Land the ingest work after those commits, not on top of them.
- **Admin asset catalog**: `apps/admin` already catalogs `{path, sha256, bytes, media_type, kind, source, license, status}`; an optional `assemble --register` can post the entries there with the Access service token used by `publish_release.ts` (later; not needed for first install).
- **Paid-call separation**: `ingest_art.ts` imports nothing from `media.ts` price/budget code and has no network code. `gen_image.ts` is not modified.

## 4. QC gates

### 4.1 Automated (run on the decoded encoded output; thresholds are starting values, the pilot batch fixes them in `content/approved_art/qc_thresholds.json`)

F = fail (blocks `--execute`), W = warning (shown in the entry, needs a human look).

| ID | Applies to | Check and proposed threshold | Sev |
|---|---|---|---|
| A01 | all | Source SHA-256 appears in the provenance `outputs[]` (generated) or equals the pinned hash (locked/external); embedded spec equals the committed spec | F / W (spec drift) |
| A02 | all | Decodes; 8-bit; width and height within 256..8192; container sniffed from bytes | F |
| A03 | all | No upscaling: source at least the export size after the crop (sheets: scale `k <= 1.0`); between 0.9 and 1.0 -> W | F / W |
| A04 | all | Aspect within 1 % of the spec `aspectRatio` (1-2 % cropped from the centre with a warning, over 2 % fail) | F / W |
| A05 | all | Output SHA-256 not equal to any other approved output (exact duplicate) | F |
| A06 | all | Near duplicate: 64-bit dHash Hamming distance <= 6 against sibling attempts and other assets of the same class (expression siblings are checked by A28 instead) | W |
| A07 | keyed | Key flatness: border ring per-channel sigma <= 8 and mean within RGB distance 24 of `#00FF00`; sigma > 20 (gradient, vignette, floor) fails | W / F |
| A08 | keyed | Green spill: pixels with `alpha >= 0.05` and `g - max(r,b) > 10` are <= 0.005 % of opaque pixels (W) / 0.02 % (F) | W / F |
| A09 | R2 and R3 contour classes | Halo: boundary band (`alpha >= 0.5` within 2 px of `alpha < 0.5`) pixels that are not ink-dark (luma > 0.35 or green excess > 8) <= 2 % (W) / 5 % (F); catches green, white or missing outlines | W / F |
| A10 | keyed | Edge softness: median 10-90 % alpha transition <= 2.5 px (sprites, icons) / 3.5 px (portraits) at export scale | W |
| A11 | keyed | Subject green keyed out: enclosed transparent regions whose **source** colour is not within 40 of `K` (i.e. a subject colour, not a see-through gap) <= 0.01 % of the figure area | F |
| A12 | keyed | After speck removal no isolated component remains; removed count reported (> 0 -> W) | W |
| A13 | sheets, icons | No cell's alpha within 1.5 % of its own border (clipped weapon, cloak or effect); portraits exclude the declared cut edge | F |
| A14 | sheets, icons | Detected cell count equals `cols x rows`; each cell's alpha area within 0.35..3 x the median | F |
| A15 | sheets, icons | Gutters: neighbouring bounding boxes <= 4 % of a cell width apart -> W; overlapping boxes -> F (cannot be separated deterministically) | W / F |
| A16 | unit sheets | Pose height ratios vs idle (ART_BIBLE §3.2): ultimate <= 1.2, defeat 0.4-0.7, hit 0.7-1.05, others 0.85-1.1 (W); beyond 15 % outside -> F | W / F |
| A17 | unit sheets | Pivot stability: after normalisation the foot centroid of every state is within 0.08 x idle width of the idle one; `foot_y` in [0.9, 1.0] | W |
| A18 | all | Exact export dimensions per class (§2.1); atlas <= 2048 x 2048 and every frame inside the atlas; icon atlas exactly 512 x 512 | F |
| A19 | all | File size <= class cap (§2.2) after the quality search | F |
| A20 | all | Decoded bytes (`w x h x 4`) <= class cap; per-scene resident sum from `report` <= 64 MB | F |
| A21 | opaque classes | Alpha is 255 everywhere; outer 2 px not key-like (RGB distance to `#00FF00` > 60) | F |
| A22 | all | Round trip: decoded output vs the pre-encode image PSNR >= 38 dB, alpha-edge max error <= 24 | W |
| A23 | plates, stills, backgrounds, busts | Palette (ART_BIBLE §1.3): >= 60 % of pixels at or below `mist_slate` luma; 0.1 / 99.9 percentile luma inside `#0F0D11`..`#F2EDE4`; pure black or white pixels <= 0.5 % | W |
| A24 | all | Crimson share (hue 340-10 degrees, saturation > 0.5) <= 3 % (per-asset override for Mahmut's oxblood cloak) | W |
| A25 | backgrounds | Safe zones of ART_BIBLE §3.3 in 1920x1080 space: HUD band y 0-235 mean luma <= 0.22 and 99th percentile <= 0.55; unit columns (x 350-750, 1170-1570, y 130-830) have no 48 px block above luma 0.62 or local sigma 0.18; description band y 840-1080: contrast of `T.text #EFE8F5` against the 95th-percentile pixel >= 7:1 (text band F, others W) | F / W |
| A26 | portraits | **Readable contrast**: render the portrait over each shipped backdrop with the StoryScene grade (gradient 0.05 -> 0.7, vignette, non-speaker alpha 0.72 and tint `0xa89fb6`); the outer 8 px silhouette band must differ from the backdrop 24 px outside the contour by dL* >= 12 along >= 85 % of the contour (a dark plum hood on dark forest fails), and the face band (15-45 % of the height) luma range p5..p95 >= 0.25 in the dimmed state | W |
| A27 | plates, stills | Text-safe bands: bottom 28 % (caption/narration) contrast against `T.text` >= 7:1 at the 95th percentile after the engine scrim; top-left title and top-right button zones have no high local contrast | W |
| A28 | portrait sets | Expression-set consistency vs `composed`: silhouette IoU >= 0.95, alpha bounding-box top and bottom within 1.5 % of the canvas, change confined to the face band (mean luma difference inside >= 3, outside <= 4) | W |
| A29 | busts | Alpha bounding-box top >= 3 % of the canvas (hood or hair not clipped) | W |
| A30 | all | Set integrity: all images of one character share size and mode; manifest keys unique; file name equals the derived name (§2.4) | F |
| A31 | generated | Reference hygiene (step 0): no legacy-derived reference, no reference outside the allowed folders | F |

### 4.2 Needs a human or visual look (owner approves; the agent prepares `review.png`)

Identity against the anchors (ART_BIBLE §4: Fadyme's ash-blonde hair without a white lock, violet eyes, deep-plum hood with the crown fragment, silver bell with thorn clapper; Mahmut's star with an **empty** socket, oxblood cloak, repaired shield, no helm; Mahmut has **no locked face anchor**, so the first owner-approved portrait becomes it) · the whole ART_BIBLE §5 canon checklist (adult-coded, no text or letters, no gore, no sexualised framing, no extra people or named characters, no curse signs, no cross motifs) · hands, anatomy and weapon handling · **which pose sits in which cell** (the tool can only report positions) and whether a pose reads at 160 px · expression correctness (`watchful` vs `composed`) · eye line at 24-30 % from the top and face and hands inside the visible 62 % for busts, faces and hands inside y 140-780 for illustrations (no face detector is shipped) · style coherence across independently generated assets (a set contact sheet) · composition semantics the metrics cannot see (landmark placement on plates, the strap-and-buckle action in `roadside_rest`, "never depict the king's death" in the prologue) · studio-mark name clearance and concept · licence and platform disclosure questions (UNKNOWN: whether Google Play asks for an AI-asset disclosure for pre-generated art; the owner checks in the Play Console questionnaire).

### 4.3 Approval states

`ingested (pending)` -> `approved` or `rejected(reason)` -> `shipped(release id)` (set by `assemble`). Stored in the entry (`qc.human`), changed only by `approve` / `reject` (an owner action, committed so the PR shows it). The agent preparing the PR never runs `approve`. `assemble --require-approved` is the AAB gate; without it, pending entries may enter a **dev/preview** base so the owner can look at them in the game, and the release notes say so.

## 5. Requesting sheets so slicing is deterministic

### 5.1 What the slicer relies on (the contract the prompt must satisfy)

R1 flat key green between and around the figures (no gradient, vignette, floor, shadow, glow, mist, particles) · R2 each figure is **one connected silhouette or a few parts within a gap smaller than 2 % of the sheet width** (bell on its chain stays attached) · R3 a gutter of flat green at least **12 % of one figure's width** between neighbours and from the sheet border · R4 **one common scale** for all figures of the sheet · R5 reading order left to right, then top to bottom, fixed by the prompt (position is the only identity the tool can see) · R6 **no drawn guides**: no grid lines, frames, numbers, labels, arrows or captions (they would key as subject and pollute QC) · R7 nothing hangs below the planted sole, no cast shadow or ground ring (ART_BIBLE §3.2) · R8 the figure count is exactly the declared one.

### 5.2 Layouts

| Sheet | Layout | Canvas request | Why |
|---|---|---|---|
| Hero (8 states) | **4 columns x 2 rows**, order `idle walk basic active ultimate hit defeat victory` | 16:9, 2K (ART_BIBLE: sheet >= 2400 px wide, cells ~690 x 770, idle ~470 px) | matches `UNIT_ANIM_STATES` and `SEQ` in `build_content.ts` |
| Enemy (4 states) | **2 x 2**, order `idle basic hit defeat` | 16:9, 2K | each cell ~1376 x 768: wide strike poses (Pilgrim) keep their resolution; a 4 x 1 row would squeeze them to ~690 px wide |
| Icon sheet (16) | **4 x 4** row-major, order = the frame ids of §2.1 F | 1:1, 2K | ART_BIBLE §3.6 |
| Expressions | **not a sheet**: one image per tag, each an edit conditioned on the approved `composed` | 2:3, 2K | identity and crop lock; a 2 x 2 face sheet would drop resolution and drift |
| Plates, stills, backgrounds | single image | 16:9, 2K | opaque |

### 5.3 Prompt contract lines (appended to the ART_BIBLE §6 skeleton; positive wording, one closing noun list)

> LAYOUT: one image containing exactly eight separate full-body figures of the same character, arranged in four columns and two rows on one flat pure #00FF00 background. Reading order left to right, then top to bottom: 1 idle, 2 walk, 3 basic attack, 4 active skill, 5 ultimate, 6 hit reaction, 7 defeat, 8 victory. All eight figures are drawn at one identical scale and every figure, with its weapon, cloak and chain, lies entirely inside its own area, separated from every other figure and from the image border by flat empty green at least as wide as twelve percent of a figure. The planted foot is the lowest point of each figure. No grid lines, frames, numbers, captions, arrows, shadows or ground.

(For the enemy sheet replace "eight / four columns and two rows" with "four / two columns and two rows" and the pose list; for icons "sixteen separate objects, four columns and four rows".) `count: 1`, `aspectRatio: 16:9` (icons `1:1`), `size: 2K`. Reference images: approved portrait, chibi proportion references and the locked sheet exactly as ART_BIBLE §6 lists; **no blank layout-guide image** as a reference (the model may copy the lines).

### 5.4 The slicing algorithm (deterministic, no randomness)

1. Mask `M = alpha > 0.1` from the keyed full-resolution image; drop specks under 0.02 % of the area.
2. Dilate `M` by `merge_gap_px` (default 2 % of the sheet width, ~55 px at 2752) and label 4-connected components. Components are the candidate figures; the **un-dilated** mask inside each component gives the figure's bounding box.
3. If the count is higher than `cols x rows`: merge each component smaller than 25 % of the median area into the nearest large component (bounding-box gap); two large components are never merged. If it is lower, fail ("figures touch"; try a smaller `merge_gap_px` or the `regions` fallback).
4. Order: sort component centroids by y, split into `rows` groups at the `rows - 1` largest y-gaps, sort each group by x, assign the declared `cells` names in reading order; `cell_order` can remap.
5. Cross-check with row and column **projection profiles** (alpha summed per row/column): every adjacent pair must be separated by an empty run of at least `min_gutter_pct` of a cell width (default 4 %); otherwise W (A15), not failure, because components already separated them.
6. Emit `slices.json` and the overlay `slices.png`.
7. **Failure modes and fallbacks**: wrong count or overlap -> fail with the overlay, the curator either re-prompts (counts as a paid attempt) or supplies `layout.mode: "regions"` with manual rectangles read off `slices.png` (free; this is what the legacy `build_content.ts` regions tables were). Detached floating parts that sit farther than the merge gap are attached by step 3's rule; if that picks the wrong figure, use `regions`.

## 6. Risks and ordering

### 6.1 Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Gemini output size, aspect and container are UNKNOWN (ART_BIBLE §3.0; `media.ts` says the request shape is unexercised) | Export sizes are independent of the generated size; A03/A04 read the real dimensions; the pilot (§6.2) comes first |
| 2 | Key not flat, gradient background, JPEG block noise | A07, `key.colour: "auto"`, configurable colour for subjects that contain green later (blue/magenta key), re-prompt |
| 3 | Figures touch or cross cells; wrong pose in a cell | Component slicing + `regions` fallback + `cell_order`; human gate on `review.png` |
| 4 | Edge halo on light and dark UI backdrops | Mixing-model alpha + decontamination + bleed + A08/A09; review at 300 % on `C.ink` and `C.bone` |
| 5 | Style drift between independently generated assets | Reference chaining (approved asset becomes reference 1 of the next), style-anchor-first order, set contact sheet in review |
| 6 | **No locked Mahmut face**, and the enemy boards are unapproved design candidates (ART_BIBLE §7.3) | Owner approval of the Mahmut `composed` portrait gates everything with Mahmut; enemy design approval gates the enemy sheets |
| 7 | The legacy crimson Fadyme leaks into a prompt | A31 reference hygiene |
| 8 | GPU memory: `loadPortraits` decodes all emotions at once, plates are 7.9 MB each | Per-scene budget (§2.2), lazy `stills`, release after use, mobile profiling on a real device |
| 9 | Schema compatibility after the first store build | Land G1-G2 before F8; otherwise a `content_schema` bump |
| 10 | CI reproducibility vs non-committed raw pixels | `content/approved_art` + `verify`; raw archive in private R2 (needs a bucket decision) |
| 11 | Stale manifest overlay reverts art | One assembler for base and patches; superset gate; build order `build:content` -> `build:campaign` |
| 12 | `release.json` out of sync with base files -> client boot failure | Assembler ends with `make_release`; `verify` checks the pair |
| 13 | Repo growth (~8.4 MiB per full pass, history is permanent) | Commit approved candidates only; few revisions |
| 14 | Toolchain drift changes WebP bytes | Pinned `sharp`, versions recorded, `pixels_sha256` fallback |
| 15 | F2-F4 and the content build tools are mid-change in the working tree | Sequence after their commits (§3.8) |
| 16 | Licence / disclosure for AI-generated art in the store UNKNOWN | Owner check; `license.terms_checked_on` is null until done |
| 17 | Budget discipline | Ingest has no paid path; the 3-attempt cap is per asset id in `media_budget.json`; ingesting a second candidate of the same generation is free |

### 6.2 Order of work

1. **P0, no spend**: schema G1-G2 + validator + `classify` mapping; `ArtLibrary` lazy loaders and icon accessor (G3, G4, G8, coordinated with F4); `tools/lib` keyer and component slicer with **synthetic-fixture unit tests** (drawn shapes on `#00FF00` with soft edges, JPEG noise, touching figures, detached bell) including the §3.4 evidence fixture; `ingest_art.ts` preview mode, `report` and `verify`; assembler + `build_content.ts` integration with legacy fallback. Everything here is testable without Gemini.
2. **P1, owner decisions** (§7) and spec authoring: `art_specs/p0/*.json` (ImageSpec) and `*.ingest.json` templates for the 27 assets, following ART_BIBLE §6.
3. **P2, pilot (about $0.5-1.0)**: one asset per class, cheapest first: `fadyme_vn_composed` (key quality, real dimensions, portrait export), `fadyme_chibi_sheet` (slicing, scale, pivot), `bg_forest_whispering_ash_ordered` (safe zones), one prologue plate (crossfade/zoom margins). Calibrate `qc_thresholds.json`, caps and the keyer ramp on the real output; fix the prompt contract of §5.3 if the grid fails.
4. **P3, dependency order** (each arrow is "approved first"): Fadyme `composed` -> Fadyme 3 expressions and Fadyme sheet; Mahmut `composed` (owner approval = anchor) -> Mahmut 3 expressions and sheet; backgrounds (second one chained from the first); enemy sheets (after enemy design approval); `ill_*` and the six plates that show characters (`search`, `reunion`, `beginning`, plus `names`/`ordinary_days` if figures appear) need both anchors; family-anchor plates `prologue_hours`, `prologue_throne_wars`, `prologue_beginning` first, the other six chained from them; icons and studio mark any time.
5. **P4**: `ingest --execute` per approved batch -> `approve` by the owner -> `assemble --target base` -> `build:content` -> `build:campaign` -> unit tests + `verify` + e2e with screenshots of every first-install screen (F7) -> owner review.
6. **P5, before F8**: freeze the base list; `assemble --require-approved --strict-art` must pass; delete the legacy builders and `LEGACY_COMMIT`; update `docs/BUILD_STATE.md` and the ART_BIBLE conflicts list.

## 7. Open decisions for the owner

1. **Second battle background**: is it the T-3 shelter doorway (`forest_shelter`, build-time override in the encounter) or something else? Without a yes, only one background is made.
2. **Prologue plates**: nine per-scene plates ($0.91, ~2.7 MB) or three family plates ($0.30, ~0.9 MB)?
3. **Studio mark**: commission an emblem (needs a concept brief, name clearance) or keep the text-only ornament?
4. **Mahmut anchor**: approval of the first Mahmut `composed` portrait as the identity reference; **enemy designs**: approval or redirection of the Bellbound and Pilgrim designs (the board's skull-like Bellbound face is not canon).
5. **Illustrations**: do portraits stay on screen while a still is shown (v006 does not say)?
6. **Raw-original archive**: create the private R2 bucket (proposal `uomd-media-originals`)?
7. **Schema additions G1-G2** accepted, and agreed that they land before the next AAB?
8. **Icon atlas now or later**, and the 16-icon list.
9. **Base cap** of 8.4 MiB (soft target 6.5 MiB) acceptable?

## 8. Differences from `docs/media/ART_BIBLE.md` (to reconcile when this file is accepted)

| Topic | ART_BIBLE | This file |
|---|---|---|
| Portrait export | "max height 1100" (the current `buildPortrait` argument) | 768 x 1152, exact 2:3, fixed canvas (no trim). If the owner prefers 1100, the same pipeline exports 733 x 1100 (data change only) |
| Keyer | alpha ramp over `g - max(r,b)` 40..130, via `buildKeyedImage` | mixing-model ramp [0, 255] + colour decontamination + bleed (§3.4); `buildKeyedImage` trims, which busts must not |
| Prologue plates | nine plates plus separately generated moving layers | nine plates (or three); layers deferred, additive field later; plates live in `stills`, not `ui` |
| Sheet request | "pure green between cells, >= 8 % gutters" | gutters >= 12 % of a figure width, one scale, reading order stated, plus the component-slicing contract |
| Idle frame size | idle ~470 px in the **source** sheet | idle frame 1.2 x runtime `height_px` in the **export** (408-456 px) |
| Studio mark | optional concept | optional, deferrable ($0.067, 60 KB) |
| Icon atlas | 16 glyphs, vocabulary list | exact 16 frame ids derived from the runtime (§2.1 F), deferrable |

Nothing in this file overrides the ART_BIBLE's canon rules, palette, safe zones, identity anchors or the checklist of its §5; those are inputs to the gates above.
