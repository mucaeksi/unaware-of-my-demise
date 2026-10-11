# Prompt-spec plan: group `chibi_sheets`

v1 · 2026-10-11 · planning only. **No paid call, no budget reservation, no ledger write was made** (`content/budget/media_budget.json` still has `entries: []`; every spec was validated with `validateSpec` and dry-run with `tools/gen_image.ts` without `--execute`). English only. Subordinate to `README.md` (sole master prompt), `narrative/` canon, `docs/media/ART_BIBLE.md` (called "the bible") and `docs/media/EXPORT_PIPELINE.md` (called "the pipeline", slicing contract in its section 5).
Tags: **CANON** quoted from `narrative/` · **REF** read by eye from a locked or derived reference · **PROPOSAL** decision of this file, owner may replace · **UNKNOWN** not in canon, left unspecified in every prompt.

Specs (`ImageSpec`, `packages/shared/src/media.ts`): `art_specs/p0/fadyme_chibi_sheet.json`, `mahmut_chibi_sheet.json`, `bellbound_dead_chibi_sheet.json`, `hollow_pilgrim_chibi_sheet.json`.

## 1. Summary

| Asset id | Purpose | Model / size / ratio / count | Layout | Refs | Depends on | First-attempt USD |
|---|---|---|---|---|---|---|
| `fadyme_chibi_sheet` | Battle atlas source for Fadyme (right-facing, runtime 360 px) and the P2 pilot for slicing, scale and pivot | `gemini-3.1-flash-image` / 2K / 16:9 / 1 | 4 x 2, `idle walk basic active ultimate hit defeat victory` | 3 | nothing (locked sheet is the anchor) | 0.101 |
| `mahmut_chibi_sheet` | Battle atlas source for Mahmut (right-facing, runtime 360 px) | same | 4 x 2, same 8 | 2 | owner-approved `mahmut_identity_master` (`reference/approved/`, created by the `mahmut_portraits` approval gate) | 0.101 |
| `bellbound_dead_chibi_sheet` | Battle atlas source for the Bellbound Dead (left-facing, runtime 340 px) | same | 2 x 2, `idle basic hit defeat` (runtime aliases: walk, victory to idle; active, ultimate to basic) | 2 | owner look at the enemy design (candidate, not approved) | 0.101 |
| `hollow_pilgrim_chibi_sheet` | Battle atlas source for the Hollow Pilgrim (left-facing, runtime 380 px) | same | 2 x 2, same 4 and aliases | 2 | same | 0.101 |
| | **Group total, one attempt each** | 4 images | | | | **$0.404** |

**Cost envelope** (`IMAGE_PRICES_USD`, verified 2026-10-11, recheck before approval): planning figure with one retry on every sheet (flash 2K) = 8 x 0.101 = **$0.808**. Hard cap, three attempts on every id with the third on `gemini-3-pro-image` 2K ($0.134) = 4 x (0.101 + 0.101 + 0.134) = **$1.344** (6.7 % of the $20 month). First attempts alone are 2.0 % of the month. Every reservation is $0.101, far under the $3 batch cap; the guard counts attempts per asset id, so each sheet has its own three-attempt cap. If a real output turns out narrower than 2400 px the 4K option is $0.151 per attempt (section 2.3).

## 2. Decisions

### 2.1 One sheet per unit, one scale, not single poses
The bible (3.2) and the pipeline (5.2) fix one image per unit. A single image gives every pose the same scale, which is why the legacy build needed manual `relativeHeight` patches (`tools/build_content.ts`: Mahmut basic 0.92, active 0.98, Fadyme ultimate 1.12). Alternatives considered:

| Option | Cost per unit | Verdict |
|---|---|---|
| A. Eight (or four) single-pose images | 8 x 0.101 = $0.808 (enemies $0.404) | Scale and identity drift per image, eight approvals; rejected |
| B. One sheet per unit (chosen) | $0.101 | One scale, one identity, one review |
| C. One combined enemy sheet, 4 x 2, both creatures | $0.101 for both (saves $0.101) | Both designs share one canvas (identity bleed), one bad figure re-rolls both, ids and ingest assume one sheet per unit, and the second design is not approved; rejected |
| D. Two 2 x 2 sheets per hero | $0.202 | Only if the real 2K output is narrower than 2400 px or crowding persists after attempt 3; new ids reset the guard's caps, so this needs an explicit owner decision, never a silent split |
| E. 4K, 4 x 2 | $0.151 | Only if the real 2K width is below 2400 px; real 4K dimensions are UNKNOWN |

### 2.2 Layout arithmetic (expected, the real dimensions are UNKNOWN until the first call)
At `size: 2K`, 16:9, the bible expects 2752 x 1536 (the dimensions of the locked 16:9 logo). The prompt asks for fractions, never pixels.

| Sheet | Areas (count of width x height) | Idle at 64 % of area height | Ultimate at about 115 % of idle | Defeat at about 55 % of idle | Baseline at 85 % of area height | Export need (pipeline 2.1 A) | k = need / source idle (A03 needs <= 1.0) |
|---|---|---|---|---|---|---|---|
| Hero 4 x 2 | 8 of 688 x 768 | about 491 px | about 565 px, head top at 11 % of the area (above the 8 % pad) | about 270 px | y about 653 px in the area | idle frame 432 | 0.88 |
| Enemy 2 x 2 | 4 of 1376 x 768 | about 491 px | none (alias of basic) | about 270 px | same | Bellbound 408, Pilgrim 456 | 0.83 and 0.93 (the Pilgrim sits in the 0.90-1.00 warning band, not a failure) |

If the Pilgrim idle measures under 507 px, ingest uses `idle_frame_px` 440 (1.16 x runtime): a data change, no re-prompt. Ratios asked of the model match QC A16 (ultimate <= 1.2, defeat 0.4-0.7, hit 0.7-1.05, others 0.85-1.1). Gutters: the pipeline asks 12 % of one figure's width (R3), the bible 8 %; the prompts use 12 %, which satisfies both. The idle must be tall enough to avoid upscaling (A03) while the bible's 8 % padding and the A13 border margin still hold for the tallest pose, hence 64 %.

Enemies use 2 x 2 rather than 4 x 1 (pipeline 5.2): each area is about 1376 x 768, so the Pilgrim's wide swing and the Bellbound's reaching arm keep their resolution; a 4 x 1 row would squeeze them to about 690 px wide.

### 2.3 Model and size
`gemini-3.1-flash-image`, 2K, 16:9 for all four ($0.101): it is the cheapest tier that meets the bible's 2K sheet contract. `gemini-3.1-flash-lite-image` is 1K only ($0.0336): at 1K 16:9 (expected 1376 x 768) a hero area is about 344 x 384, idle about 245 px, below the 432 px export need (upscaling, gate A03), so it is rejected for sprites. `gemini-3-pro-image` ($0.134 at 2K, +33 %) is used **only as attempt 3**, when two flash attempts fail on instruction following (grid, identity). No evidence exists yet that pro holds an 8-figure grid better; the first calls decide, and a pilot on `fadyme_chibi_sheet` calibrates all four.

### 2.4 Determinism of the grid: what the prompt does and what the slicer does
Gemini will not place figures at exact pixel offsets, so the contract is component-first (pipeline 5.1 and 5.4) and the prompt only has to satisfy R1-R8:

| Pipeline rule | How every spec satisfies it |
|---|---|
| R1 flat key green, nothing touching the edge | TECHNICAL paragraph: single flat `#00FF00`, no gradient, floor, vignette, shadow, glow, mist, particles |
| R2 one connected silhouette per figure | "Each prop stays physically attached": bell on a continuous chain held in the hand; sword and shield in hand and on the arm; staff held or touching |
| R3 gutter >= 12 % of a figure's width | LAYOUT sentence, plus "every figure centred in its own equal area" so a gutter exists by construction |
| R4 one common scale | LAYOUT gives the height of every pose as a fraction of idle and says "one identical scale ... not a turnaround" |
| R5 reading order fixed | Numbered order, "left to right, then top to bottom", pose list in the same order |
| R6 no drawn guides | "No grid lines, frames, numbers, captions, arrows, shadows or ground"; no blank layout-guide image is attached (the model may copy the lines) |
| R7 nothing below the sole | "lowest point rests on one shared baseline, nothing hanging below it" |
| R8 exact count | "exactly eight (four) separate figures", count restated in the layout |

Free recoveries that are not retries: a correct pose in the wrong cell is fixed by `cell_order` in the ingest file; touching figures or a failed component count are fixed by `layout.mode: "regions"` (manual rectangles read off `slices.png`); a slightly wrong idle height is fixed by `idle_frame_px`. Only a defect in the pixels themselves costs an attempt.

### 2.5 References (bible 6 attachment map: approved portrait, chibi_ref, battle_pose_idle for silhouette; enemy sheet: board crop, chibi ref)
Rules applied: <= 5 references and <= 3 identity-bearing, text first, roles written as complete instruction fragments naming what to take **and** what to ignore, no role restated in the prompt body. The legacy crimson atlas in `content/base/art` is never attached, never described, and no two Fadyme costumes appear in any call.

| Ref | Used by | Role in one line |
|---|---|---|
| `reference/locked/fadyme/sheet/char-fadyme-uomd.png` (6.3 MB, sha256 `22a6010a...6517`; full hashes are printed by the dry run) | Fadyme 1 | Identity only (face, ash-blonde hair, violet eyes, plum hood and mantle, lilac embroidery, scarf, thorn-clapper bell, palette); not the layout, labels, thumbnails, gloves, tiara or hanging charms |
| `reference/derived/fadyme_battle_pose_idle_v002.webp` (sha256 `9ff1339f...bf7c`, locked-owner-approved) | Fadyme 2, Mahmut 2, both enemies 2 | Chibi render style and proportion only: bold uniform ink outline, flat two-tone cel, head-to-body ratio, small hands, closed outline against flat green; for non-Fadyme units the role says to ignore her costume, hood, hair, face, bell and pose |
| `reference/locked/fadyme/sheet/chibi_ref_fadyme.png` (sha256 `88d0aeb4...13d7`) | Fadyme 3 | 3 to 3.5 head proportion only; not the grey paper, purple shards, cropped figures or low resolution |
| `reference/approved/mahmut_identity_master.png` (**does not exist yet**) | Mahmut 1 | Identity lock for the face, hair, stubble, eyes, armour, star with empty socket, oxblood cloak, shield and sword, redrawn at chibi proportion, not the realistic proportions or pose |
| `reference/derived/enemy_board_ch01_whispering_ash_v001.webp` (sha256 `d611a347...9261`, DESIGN_CANDIDATE_NOT_OWNER_APPROVED) | Bellbound 1 (second panel), Pilgrim 1 (third panel) | Silhouette and material intent of the named creature only, redrawn as a flat-cel chibi sprite facing left; not the other creatures, captions, insets or the realistic skull |

Not attached on purpose: `fadyme_battle_pose_attack_v003` (flying crystal shard), `_hit_v003`, `_skill_v002`, `_guard_v003` and `_victory_v002` (a stray image patch sits in its lower-left corner; INDEX marks it locked, but do not feed it). Every Fadyme battle-pose reference carries a tiara and dangling bell charms that contradict canon ("one broken silver crown pin at the hood clasp"; the bell hairpin is "a separate family pin"). Canon wins: the prompts describe "one small broken fragment of a silver circlet ... pinned at the front edge above the brow" and "a tiny silver bell-shaped hairpin half hidden", wording shared with the sibling `fadyme_vn_*` specs, and the roles tell the model to ignore the references' tiara and charms. The pose references stay available as a one-change fallback (section 5).
Payload: Fadyme about 6.9 MB raw (about 9.2 MB as base64 inline data); the enemy calls are about 0.3 MB; the Mahmut call is the approved master (a keyed 2K PNG, size UNKNOWN, expected a few MB) plus 0.09 MB. The 20 MB inline request limit is recalled, not verified here.

### 2.6 Pose list, mapped to skills (bible 3.2; ultimate content beyond the names is UNKNOWN, so poses use only what the names and `unit_pack.json` descriptions imply, with no VFX)
| State | Fadyme | Mahmut |
|---|---|---|
| idle | relaxed, weight on one leg, chain in both gloved hands at waist height (REF chibi idle), bell hanging | relaxed, shield low in front, sword low at his side, point toward the ground |
| walk | mid-stride, bell swinging gently, mantle trailing | mid-stride, shield and sword low, cloak trailing |
| basic | *Veilglass Thorn*: arm straight out at shoulder height, chain taut, bell hanging at the end with the thorn toward the target | *Oathless Cut*: sword arm swung forward, short blade at chest height, shield kept close |
| active | *Borrowed Hour*: bell lifted on its taut chain to head height, other hand open | *Broken Crest Guard*: wide planted guard, shield raised and pushed slightly forward |
| ultimate | *The Bell That Forgets*: both arms raised, bell held at the top, thorn pointing down, eyes closed (largest pose) | *Last Wall at Dusk*: shield thrust high and forward like a wall, sword raised, cloak flaring (largest pose), mouth closed ("anger is silence") |
| hit | recoil to the left, one arm up before the face, eyes shut, no blood | recoil, torso back, shield arm swinging aside, eyes shut, no blood |
| defeat | kneeling, folded forward, bell on the ground on its chain | kneeling, shield slipped down the forearm, sword point on the ground at a slant (never planted upright: avoids a cross-grave icon, owner brief rejects cross-sword motifs) |
| victory | composed: bell at chest height, other hand over her heart, small smile (matches the locked victory chibi) | restrained: sword lowered, shield arm relaxed, slow breath out, faintest softening of the mouth |

| State | Bellbound Dead | Hollow Pilgrim |
|---|---|---|
| idle | slumped and swaying, arms to the knees, chest bell hanging, chains slack | hunched, both feet planted, one hand on the planted staff |
| basic | *Tolling Grab* (card: "wrist chain tightens, bell tilts"): lunge, reaching arm, taut chain, bell tilted forward | *Pilgrim's Weight* (card: "both hands on the staff, heavy swing, feet planted"): heavy diagonal swing, staff top no higher than the hood |
| hit | jolted back, arms flung out, bell swung sideways, eyes squeezed shut, no blood | staggers back, staff slipping, hood still forward over the shadowed face |
| defeat | crumpled on the knees, bell on the ground, chains slack | collapsed on the knees over the pack, staff on the ground against a knee |

Facing: heroes face right, enemies face left (`UnitArt.facing`); mirroring at runtime is allowed, so nothing canon-bearing may depend on handedness. Mahmut keeps the sword in the right hand and the shield on the left arm (REF key art): in a right-facing three-quarter view that puts the shield arm forward on the right of the figure and the sword on the trailing left, which also reads as a tank.

### 2.7 What was reused from Sol's QUEUE drafts and what was fixed
The `chibi_sheet` prompt in `QUEUE_DATA.json` is a four-view turnaround **design sheet** ("front, left side, back and three-quarter views ... neutral plain background ... a reference sheet, not an animation atlas"). The bible 3.2 gives that class its own id (`*_design_sheet`, 4:3, review artefact), so it is **not** in this group and none of these specs is a turnaround. Reused: the verbatim identity wording (age, hair, eyes, plum hood, scarf, silver bell with thorn clapper; Mahmut's star with empty socket, repaired heater shield, arming sword), "unobstructed complete silhouette", "no labels", "compact chibi proportion". Fixed: the generic header ("Original Gothic anime/light-novel illustration ... crimson eclipse accents ... No copied franchise designs, UI, text, logos, rating badges or mock store metrics") was dropped because a long negation list primes the very items it names (bible 6) and an eclipse accent has no place in a keyed sprite; "neutral plain background" became flat key green; "turnaround" became the eight-pose layout; the enemy rows add the proportions, materials and poses that the cards give ("Slumped thin hollow ...", "Heavy hunched pilgrim ..."), and the single "keep the tutorial design" instruction cannot be followed because that design is not in the repo (UNKNOWN).

### 2.8 Source conflicts resolved here
1. Bible 3.2 (8-state sheet) vs QUEUE (four-view sheet): the bible wins; the design sheet is a separate asset.
2. Gutter 8 % (bible) vs 12 % (pipeline): 12 % asked.
3. Idle about 470 px in the source (bible) vs 1.2 x runtime in the export (pipeline): the prompt asks idle at 64 % of the area height, about 491 px at 2752 x 1536.
4. Chibi heads: bible 3 to 3.5; REF idle pose measures about 3.6, REF chibi crop about 2.6: prompts say 3 to 3.5 (Fadyme), 3.5 (Mahmut, Bellbound), about 3 (Pilgrim, hood included).
5. Canon vs reference props on Fadyme: tiara, dangling charms, brown gloves: canon text wins; glove colour is left unspecified ("thin gloves").
6. Enemy board is realistic painterly with a skull-like Bellbound face (not canon, not approved): redrawn in R2 with a simplified mask-like face (PROPOSAL, owner reviews).
7. The two battle-pose derivatives come from `narrative/14_References/recovered_locked_v001/fadyme/battle_pose/` (plum costume, locked-owner-approved in `reference/INDEX.json`), not from the legacy crimson atlas; `reference/derived/` is an allowed reference folder (gate A31).

### 2.9 UNKNOWN, left unspecified in every prompt
Fadyme: glove colour and material, exact hair length (the sheet shows chest length, the chibi refs shoulder length: the prompt says "past her shoulders"), hood length, prop sizes, which hand carries the chain bell, ultimate content. Mahmut: face and eye shape, skin tone, hair parting, boots, glove colour, scars, shield size and heraldry, sword length, seal design, ultimate content. Bellbound: whether a skull face is allowed (only "dirty bone" is stated), bell size, number of chains, height, hair, ember cracks, feet and claws. Pilgrim: face (kept as darkness), bell on the staff or pack, pack contents, red cloth, the dragged foot. Platform: real 2K output dimensions and supported ratios, seed control, how reliably Gemini holds an 8-figure grid.
PROPOSALS that the owner may change before ingest: the Bellbound's mask-like face, bare head and bare feet; the Pilgrim's rolled bedroll (a board detail kept as the card's "worn road load") and no bells, pots or red ties (kept off so the two enemies read as opposites, bible 4.4); Mahmut's shield-forward facing; the pose choices of section 2.6.

### 2.10 Order and gates
1. `fadyme_chibi_sheet` first (pilot, no dependency): calibrates slicing, scale, key purity and whether Gemini holds an 8-figure grid. If the grid fails here, fix the LAYOUT text once (section 5 rows) before spending on Mahmut.
2. `bellbound_dead_chibi_sheet` and `hollow_pilgrim_chibi_sheet` next. The designs are candidates, not approved: treat attempt 1 as the owner's design look ($0.101 is cheaper than a separate design round) and ingest only after the owner approves or redirects it.
3. `mahmut_chibi_sheet` last: only after the owner approves `mahmut_identity_master` and the approval gate copies it byte-exact to `reference/approved/mahmut_identity_master.png`. If the owner replaces the master step, swap reference 1 for the approved `composed` bust plus `brand_key_art_portrait_r2_v003.png` (costume only) and tell the model, in the role, that the body is not visible.
Reserve per spec ($0.101) before each call, persist the reservation, settle actual cost, never run two writers on the ledger, never retry blindly after an ambiguous failure (bible 6).

## 3. Reviewer checklist, common to all four sheets (any "no" fails the candidate; bible 5 and pipeline 4.1 gates in brackets)
- **S1** exactly 8 (heroes) or 4 (enemies) figures, one per area, in the declared reading order; no duplicate pose, no turnaround (R5, R8, A14).
- **S2** every figure wholly inside its own area with at least 12 % of a figure width of flat green to its neighbours and at least a 1.5 % margin to the image border (A13, A15); nothing touching or overlapping (overlap is an automatic fail).
- **S3** one common scale: pose heights against the idle figure stay within ultimate <= 1.2, defeat 0.4-0.7, hit 0.7-1.05, others 0.85-1.1 (A16); idle figure at least the export need tall in the source (heroes 432, Bellbound 408, Pilgrim 456) (A03).
- **S4** the planted sole (or staff tip, or knee in defeat) is the lowest opaque pixel of each figure; no ground line, ground ring, cast or contact shadow, floor; no baked VFX (sparks, aura, motion lines, impact marks), no text, letters, numbers, labels, frames or grid lines (bible 3.2, R6, R7).
- **S5** key: flat pure `#00FF00` (border ring sigma <= 8, A07); no green on any figure, no green rim or reflection; no green fringe at 300 % on `C.ink` and on `C.bone` backdrops; hair or cloth silhouettes closed, no thin wisps (A08, A09, A11).
- **S6** style R2: one uniform bold outline in `C.ink` (#120A18) of about 2-3 % of the figure height, closed shapes, flat two-tone cel, one hard highlight, no gradients, airbrush, gloss or painted realism; darkest value not pure black; dark-dominant, no neon (A3, A4).
- **S7** one identity across all figures of the sheet (face, costume, props, colours) and equal to the anchor named in the spec section; no costume drift between figures (A7).
- **S8** facing: heroes right, enemies left, in every figure (`UnitArt.facing`).
- **S9** each cell shows its stated pose (section 2.6): hit has no blood, defeat is a collapse or kneel with no gore, ultimate is the largest figure, victory is small and in character.
- **S10** props attached: the bell hangs from a continuous chain into a hand (R2), the sword and shield are held or strapped, the staff is held or touching; no detached floating part farther than 2 % of the sheet width.
- **S11** adult-coded at chibi scale (adult jaw, eyes and brow; no round child-like face) and no sexualised framing (A1, A6); no other person or creature, no legible name or emblem (A5).
- **S12** the silhouettes are distinct at 160 px (idle strip): Fadyme hooded and small, Mahmut broad with shield, Bellbound thin with long arms, Pilgrim a broad hunched triangle (D3).
- **S13** hash compared with the other attempts and with sibling sheets, no near-duplicate (A06, F4); provenance JSON saved (model, prompt, reference hashes, cost) and attempt count <= 3 (F5).

## 4. `fadyme_chibi_sheet`
**Purpose.** Source of the Fadyme battle atlas (`atlas_fadyme`, `facing: right`, `height_px 360`); first sheet to be generated, so it also tests the grid, the key and the pivot logic for the other three.
**Model / size.** `gemini-3.1-flash-image`, 2K, 16:9, `count: 1`, key green, $0.101. The identity anchor is the **locked** owner-approved sheet, so this spec needs no generated portrait first.
**References** (text first, then `Reference image N: <role>.` is appended by `buildImageRequest`): 1 locked sheet, identity only; 2 `fadyme_battle_pose_idle_v002.webp`, chibi render style and proportion only; 3 `chibi_ref_fadyme.png`, 3 to 3.5 head proportion only.
**Prompt.** Bible 6 skeleton: deliverable; SUBJECT (canon verbatim: "pale ash-blonde hair, violet eyes, deep plum hood with the broken crown pin at the clasp, black dress with silver-lilac embroidery, white scarf", "thin gloves", "silver bell ... on a chain ... clapper is a silver thorn", the tiny bell hairpin "partly hidden"); LAYOUT (4 x 2, fractions); POSES; STYLE (R2); LIGHT AND PALETTE (`plum_hood` #45293B, `plum_shadow` #22151E, `lilac_thread` #C9B6E4, `bone_ivory` #E9E2D4, `ash_ink` #0F0D11); TECHNICAL; closing "Do not add" with eleven short noun groups (the bible suggests at most six; eleven are used because the references themselves pull toward a tiara, charms and a crimson robe, and the task asks for the known failure modes: text, grid lines or frames, ground shadows, magic or impact effects, blood, crimson or burgundy costume, dangling bell charms, full tiara, modern items, extra fingers or limbs, a second character). The other three sheets use the same count for the same reason. No bone-white lock and no bloody scarf (tutorial state, `QUEUE_DATA.json`).
**Acceptance** (S1-S13 plus bible 5 B):
1. **B1** hair pale ash-blonde (not silver, white or yellow), no bone-white lock. **B2** violet eyes readable in idle, walk and victory.
2. **B3** deep plum hood up with one small broken circlet fragment at its front edge above the brow (a short arc with a few points, not a full tiara); **B4** black high-collar dress with silver-lilac (not gold) embroidery lines; **B5** high white scarf, clean.
3. **B6** silver chain bell with a silver **thorn** clapper hanging down in every figure that holds it; tiny bell hairpin partly hidden; crown fragment, hairpin and chain bell are three distinct props; no dangling charms from the hood.
4. **B7** no weapon, no black-gold hand lines, normal skin; **A7** nothing crimson or burgundy anywhere, never two costumes; no cross or holy motif.
5. Poses read as 1 idle, 2 walk (one boot lifted), 3 arm-out thrust with the bell hanging at the end, 4 bell raised to head height, 5 both arms raised with the bell at the top (tallest figure), 6 recoil with eyes shut, 7 kneeling and folded forward, 8 composed with a hand over the heart.
**Fallback.** One change per retry, chosen by the first failure the reviewer records (default = first matching row). Snippets are defined in section 7.

| Failure on attempt 1 | Attempt 2: exact change |
|---|---|
| Wrong figure count, merged or touching figures, figures crossing an area | apply snippet **W** (replace the sentence "Every figure ... overlaps." in LAYOUT) and **C** (prepend the count check) |
| Pose size ratios off (idle too small, ultimate not largest, defeat not smallest) | apply snippet **S** (replace the scale sentence) |
| Poses duplicated or in the wrong order | apply snippet **P** (replace the POSES lead-in, add row words) |
| Costume or identity drift (crimson or burgundy robe, full tiara, dangling bell charms, gold embroidery, lighter or white hair, scarf missing) | replace the sentence from "Take her identity from reference image 1:" through "... thin gloves and plain dark boots." with: "Take her identity from reference image 1. Fadyme wears only these items: pale ash-blonde hair, violet eyes, a deep plum hood with one small broken silver circlet fragment at its front edge, one tiny silver bell-shaped hairpin half hidden by the hood, a deep plum hooded mantle, a black high-collar dress, thin silver-lilac vine embroidery lines (lilac, never gold), a high clean white scarf, thin gloves and dark boots; nothing else hangs from the hood or the mantle." |
| Face or costume differs between figures | apply snippet **I** (append to SUBJECT) |
| Bell detached from the hand or missing in some poses | append to POSES: "In every figure the bell hangs from a visible continuous chain that runs into a gloved hand." |
| Proportions too tall or realistic (more than 4 heads) | append to SUBJECT: "The head is as wide as the shoulders and about one third of the figure height, the legs are short, the hands are small." |
| Painted, gradient or outline-less rendering, or soft edges | apply snippet **F** (append to STYLE) |
| Green background not flat, floor or shadow, green fringe, wispy hair | apply snippet **K** (replace TECHNICAL) |
| Baked glows, ground shadow, labels or numbers | apply snippet **X** (replace the closing sentence) |
| All poses look like the idle (little action) | add reference 4 `reference/derived/fadyme_battle_pose_skill_v002.webp` with role "POSE LANGUAGE only: the raised-bell pose of figures 4 and 5; ignore its tiara, dangling charms and crop" |
| Grey paper, thumbnails or purple shards leak in from reference 3 | delete reference 3 from `references`, no text change |

Attempt 3: switch `model` to `gemini-3-pro-image` ($0.134) with the best prompt so far, no other change. After a third paid attempt stop and request owner review before any new prompt (the guard counts attempts per id).

## 5. `mahmut_chibi_sheet`
**Purpose.** Source of the Mahmut battle atlas (`facing: right`, `height_px 360`). **Model / size.** Flash, 2K, 16:9, `count: 1`, key green, $0.101.
**Dependency.** `reference/approved/mahmut_identity_master.png` (new folder, created by the owner-approval gate described in `docs/media/specs/mahmut_portraits.md` 2.4). Until it exists, `gen_image` dry-runs fail with `ENOENT` (verified), while `validateSpec`, the price check and a dry-run on a copy with a stand-in reference all pass (section 8). No Mahmut face is locked; the master, once approved, is the anchor, and this sheet only redraws it at chibi scale.
**References.** 1 approved master, identity lock redrawn at chibi proportion; 2 `fadyme_battle_pose_idle_v002.webp`, chibi render style and proportion only, "she is a different character, so ignore her hood, hair, face, mantle, scarf, dress, bell, boots and pose entirely" (the only Fadyme image in this call, so her palette cannot dominate). Not attached: the key art (the master already carries its costume) and the Fadyme `chibi_ref` (second Fadyme image).
**Prompt.** Same skeleton. CANON quoted: "dark messy hair, stubble, brown eyes", "tired, but steady", "dark worn half-plate" repaired in "mismatched" styles (canon "six different styles"), "scarred gloves", "Crown Guard star" on the breastplate with an "empty socket", "tattered oxblood cloak" (Guard red dyed darker; `oxblood` #6B1E2C lit, #371C21 shadow), "repaired heater shield" with the seal pressed into the rim, "arming sword with iron-filled crest socket" (drawn as a flat dull iron disc in the pommel). "Tall, weathered knight" becomes "sturdy weathered build" at 3.5 heads. No helm. The star is placed on the breastplate (canon), not on the pauldron as the key art shows.
**Acceptance** (S1-S13 plus bible 5 C):
1. **C1** dark messy short hair, stubble, brown tired-but-steady eyes, same face as the approved master (overlay it); **C2** dark worn half-plate with visibly mismatched patched plates; **C3** small star on the breastplate with an **empty** socket directly above it (not a crown, not smooth plate).
2. **C4** torn oxblood cloak, darker and browner than UI `C.crimson` #8F1D3A, never covering the sword, shield or front plate; **C5** heater-shaped dark shield on the left forearm with a rim seal and no heraldry, arming sword with a plain guard in the right hand, no royal crest anywhere.
3. **C6** broad, sturdy and visibly bulkier than the Fadyme sheet; **C7** no helm, same face in every figure. Relative height against Fadyme cannot be set across two separate generations and the runtime gives both `height_px` 360 (`tools/build_content.ts`), so "taller" is carried by width, plate and the shield; if the owner wants him taller on screen the fix is a data change of `height_px`, not new art.
4. Handedness: sword on the trailing left of the figure, shield leading on the right; pose 3 swings the sword forward with the whole blade inside its area; pose 7 has the sword point touching the ground at a slant (not planted upright).
5. The only reddish element is the cloak; crimson share needs the per-asset override of gate A24.
**Fallback.**

| Failure on attempt 1 | Attempt 2: exact change |
|---|---|
| Fadyme traits leak (hood, ash-blonde hair, white scarf, bell, plum tones) | delete reference 2 and append to SUBJECT: "He is a man with short dark hair, no hood and no scarf; his build is broad and heavy-shouldered." |
| Costume or prop drift (helm, crown, bright red cloak, round or kite shield, sword in the wrong hand, star on the shoulder, smooth chest) | replace the four sentences from "A small Crown Guard star" through "... no heraldry on its face." with: "A small Crown Guard star sits on the centre of the breastplate and directly above it is a small bare empty socket; no crown is mounted anywhere. His tattered cloak is a deep brownish oxblood (lit mid-tone #6B1E2C, shadow #371C21) with ragged torn edges, hanging behind him and never covering the front of the armour, the sword or the shield. In his right hand, on the trailing left side of the figure unless the pose swings it forward, he holds an arming sword with a plain straight guard and a plain grip. On his left forearm, on the leading right side, he carries a repaired dark heater-shaped shield: a wide flat top with the sides tapering to a point at the bottom, bevelled iron rim, riveted repairs, no heraldry." |
| Face drifts from the approved master or reads child-like | append to SUBJECT: "Every figure copies the face of reference image 1: the same brows, nose, jaw and stubble, with an adult man's strong jaw and heavy brow; only the expression changes with the pose." |
| Figures crowd or the sword leaves its area | apply snippet **W**; additionally append to pose 3: "the blade is short and held close to the body" |
| Wrong count, duplicated or misordered poses, wrong scale ratios | snippets **C**, **P** or **S** respectively |
| Face or costume differs between figures | snippet **I** |
| Painted or gradient rendering, soft edges | snippet **F** |
| Green not flat, fringe, wispy hair | snippet **K** (hair clause: "the hair is a solid dark mass of thick locks") |
| Baked glows, shadows, labels | snippet **X** |
| Poses all look like the idle (little action) | append to POSES: "Each pose is dynamic: the torso, arms and legs of every figure are clearly different from the idle." No second Fadyme pose reference is added here, because it would pull her costume into his sheet. |

Attempt 3: switch `model` to `gemini-3-pro-image`, best prompt so far. After a third paid attempt, request owner review.

## 6. `bellbound_dead_chibi_sheet` and `hollow_pilgrim_chibi_sheet`
Both: flash, 2K, 16:9, `count: 1`, key green, $0.101 each, 2 x 2 (order `idle basic hit defeat`), face left. Runtime aliases (`tools/build_content.ts` SEQ): walk and victory use `idle`, active and ultimate use `basic`; no `walk`, `victory`, `active` or `ultimate` art is drawn. Ingest: `unit_sheet`, grid 2 x 2, `state_map` from the pipeline 2.1 A, `idle_frame_px` 408 (Bellbound) and 456 (Pilgrim).
Both enemy boards are DESIGN_CANDIDATE_NOT_OWNER_APPROVED and painterly-realistic, so the R2 redraw (flat cel, bold outline) is the main risk. References: 1 the board, role names the panel (second from the left for the Bellbound, third for the Pilgrim) and what to take (silhouette and materials) and to leave (other creatures, captions, insets, realistic skull); 2 `fadyme_battle_pose_idle_v002.webp`, render style and proportion only. The first output is also the owner's design look (section 2.10).

### 6.1 `bellbound_dead_chibi_sheet`
**Prompt.** CANON: "Hollows wired to a bell by their own chains. Alone they are weak; the bell never sends one alone." Card (candidate, translated): "Caved chest, long hanging arms; thin vertical torso divided by a chain"; "charcoal cloth, dirty bone, cold brass"; "chest bell; its own chains linking chest and wrists"; "not a heavy-armoured knight; red glow never covers the whole surface"; attack "wrist chain tightens, bell tilts". Used as: 3.5 heads, thin caved body, arms to the knees, torn charcoal cloth, dirty-bone skin, `brass_cold` #66533E bell (no green patina, because green would be keyed out), two thin chains from the bell to the wrists. No ember cracks and no red glow are drawn (VFX come from the engine, bible 3.2). Mask-like face with dark hollow sockets is a PROPOSAL.
**Acceptance** (S1-S13 plus bible 5 D):
1. **D1** thin slumped hollow, long hanging arms, charcoal cloth, dirty bone, cold brass; chest bell with its own chains to both wrists; not heavy armour; no red glow, no red tint.
2. Face simplified and mask-like (not a detailed realistic skull, no glowing eyes); owner decides whether this face treatment is acceptable.
3. **D3** reads as the opposite of the Pilgrim at 160 px: thin, tall-reaching, bell at the chest.
4. Poses: 1 slumped, 2 lunge with a reaching arm, taut chain and forward-tilted bell, 3 jolted back, 4 crumpled with the bell on the ground; **D4** no invented speech, abilities, faces or names.
**Fallback.**

| Failure on attempt 1 | Attempt 2: exact change (default for this unit = first row) |
|---|---|
| Realistic painted rendering, detailed skull, gradients, soft edges | snippet **F**, and replace the sentence beginning "The face is gaunt" with: "The face is a simple pale mask shape with two dark oval eye sockets and a small dark mouth line, drawn with the same bold outline as the rest of the figure." |
| Reads as a knight or is bulky | append to SUBJECT: "The torso is as narrow as the head is wide and the arms are longer than the torso; there is no plate, no helm and no shoulder armour." |
| Chains or bell wrong (no wrist chains, bell on the belt) | replace the bell and chain sentences with: "A single cold-brass bell hangs on a short chain at the centre of the chest. From the bell one thin dark iron chain runs to the left wrist and one to the right wrist, each visibly wrapped around its wrist." |
| Red, orange or ember colour appears on the figure | append to LIGHT AND PALETTE: "no red, orange or ember colour anywhere on the figure." |
| Fadyme traits leak (plum, hood) | delete reference 2 |
| Count, crowding, ratios, order, identity across figures, key defects, baked FX | snippets **C**, **W**, **S**, **P**, **I**, **K**, **X** (enemy wording in section 7) |
| Owner rejects the mask-like face (decision, not a defect) | replace the face sentence with: "The head is lowered and the face is hidden by long ragged strips of charcoal cloth wrapped around the head, leaving only a pale chin visible." |

Attempt 3: `gemini-3-pro-image`, best prompt so far; after that request owner review.

### 6.2 `hollow_pilgrim_chibi_sheet`
**Prompt.** CANON: "A pilgrim whose hours ran out on the road but whose feet did not. Slow, stubborn, heavy."; `tutorial_t2_before_001` ("a lone pilgrim dragged one foot around the same worn stones"; the dragged foot is not drawn, UNKNOWN in static art). Card (candidate): "hunched wide triangle; load pack and one thick planted staff"; "ash-beige coarse weave, matte brown leather"; "face in a dark hood; worn road load"; "no floating ghost or fast assassin"; attack "both hands on the staff, heavy swing; feet planted". Used as: about 3 heads, broad hunched triangle, `ash_beige` #5F4D41 robe, hood with the face as flat shadow, brown leather pack with a rolled bedroll, one thick staff taller than its head, heavy planted feet. Bells, pots and red ties from the board are left out (UNKNOWN, and they would blur the contrast with the Bellbound's chest bell). Faceless by design, so "a visible face or eyes under the hood" is in the closing "Do not add" list.
**Acceptance** (S1-S13 plus bible 5 D):
1. **D2** broad hunched triangle, coarse ash-beige hood with the face only as shadow, brown leather pack, one thick planted staff, slow and heavy, not floating; **no** chest bell, chains or armour.
2. The face is never visible in any of the four figures, including the hit pose.
3. **D3** reads as the opposite of the Bellbound at 160 px: broad, planted, hood and pack.
4. Poses: 1 hunched with the staff planted, 2 both hands on the staff in a heavy diagonal swing with its top no higher than the hood (height ratio within 1.1 of idle), 3 staggering back with the hood still forward, 4 collapsed on the knees over the pack.
**Fallback.**

| Failure on attempt 1 | Attempt 2: exact change (default for this unit = first row) |
|---|---|
| Realistic painted rendering, gradients, soft edges | snippet **F** |
| A face, eyes or mouth visible under the hood | replace the hood clause with: "the deep hood is pulled forward and its opening is filled with flat black shadow (#0F0D11): no eyes, nose or mouth are drawn" |
| Thin, tall or ghostly instead of heavy and broad | append to SUBJECT: "The body is about as wide as it is tall: the robe flares into a heavy triangle, the shoulders slope forward, the hunched back carries the pack, and both feet are planted flat on the baseline." |
| Bells, pots, jars or coloured ties creep in from the board | append to SUBJECT: "The pack and the staff carry no bells, pots, jars or coloured ties; the pack has a rolled bedroll and plain straps only." |
| Plum tint or Fadyme traits leak from reference 2 | delete reference 2 and append to LIGHT AND PALETTE: "colours are ash-beige, brown leather and dark wood only." |
| Staff swing too tall or crosses the area | replace the pose 2 clause with: "2 basic attack, Pilgrim's Weight: both hands gripping the staff held diagonally at chest height and pulled back to the right side as a heavy wind-up, the feet planted wide, the whole body leaning forward." |
| Count, crowding, ratios, order, identity across figures, key defects, baked FX | snippets **C**, **W**, **S**, **P**, **I**, **K**, **X** (enemy wording in section 7) |

Attempt 3: `gemini-3-pro-image`, best prompt so far; after that request owner review.

## 7. Fallback snippets (exact text; hero wording first, enemy substitutions in brackets)
- **W (crowding)**: replace the sentence "Every figure, with its cloak, weapon, chain and bell, lies completely inside ... so nothing touches or overlaps." with: "Every figure, with its cloak, weapon, chain and bell [chains, bell, pack and staff], occupies only the middle 60% of the width of its area; the outer 20% on each side of every area stays empty flat green, so at least 40% of an area's width of empty green separates each figure from the next and from the image border."
- **C (count)**: prepend to LAYOUT: "Count check: the image contains eight [four] figures in total, no more and no fewer, one per area, and no two figures show the same pose."
- **S (scale)**: replace "All eight figures are drawn at one identical scale ... about 55% of it." with: "All eight figures share one identical scale, as eight different poses of the same character and not a turnaround. Measured on the area height, the idle, walk, basic attack, active skill and victory figures stand from 21% to 85% of their area, the hit reaction from 27% to 85%, the ultimate from 11% to 85% and the defeat figure from 50% to 85%." [enemies: "All four figures share one identical scale, as four different poses of the same creature and not a turnaround. ... the idle and basic attack figures stand from 21% to 85% of their area, the hit reaction from 27% to 85% and the defeat figure from 50% to 85%."]
- **P (poses)**: replace the opening words "POSES, every figure facing the right [left] of the frame in a three-quarter view" (Mahmut: only that first clause, keeping his shield-and-sword sentence that follows it) with "POSES: each figure has its own distinct pose, described here in reading order, and no two figures share a pose or a stance; every figure faces the right [left] of the frame in a three-quarter view" and insert "Top row from the left," before "1" and "Bottom row from the left," before "5" [enemies: before "3"].
- **I (identity)**: append to SUBJECT: "Draw figure 1 first and redraw every other figure from it: copy its face, hair, costume colours and props exactly and change only the pose."
- **F (flat style)**: append to STYLE: "Every figure is closed by one unbroken bold ink outline of equal thickness and filled with flat colour areas in two tones; shadows are hard-edged shapes, never soft gradients, and nothing looks painted or rendered."
- **K (key)**: replace the TECHNICAL paragraph with: "TECHNICAL: the background is a single flat colour, exactly #00FF00 (RGB 0, 255, 0), identical in all four corners and across the whole canvas, with nothing painted on it and no shadow under any figure; every figure is closed by an unbroken ink outline, so no edge is soft, feathered or blurred; cloak, cloth and metal carry no green tint or reflection; [Fadyme: the hair is drawn as thick clumped locks without thin flyaway strands;] [Mahmut: the hair is a solid dark mass of thick locks;] [Bellbound: the bell stays brown-bronze with no green patina;] text-free."
- **X (baked FX)**: replace the closing sentence with: "Do not add: text, letters, numbers or labels; grid lines, frames or panels; ground, floor, cast shadows or contact shadows; sparks, smoke, light rays, aura, motion lines or impact marks; blood; modern items; extra fingers or limbs; a second character [creature]."

Not a retry reason (free, in ingest): pose in the wrong cell (`cell_order`), mildly touching figures (manual `regions`), idle a little small (`idle_frame_px`), faint green fringe (keyer parameters, A08/A09).
Not a prompt problem: the real 2K output is narrower than 2400 px. Then decide with the owner between 4K ($0.151 per attempt, dimensions UNKNOWN) and two 2 x 2 sheets per hero (new ids, $0.202); never reset a cap silently.

## 8. Validation record (2026-10-11)
- `validateSpec` + `estimateUsd` on all four: pass, each $0.101, prompts 4.6-6.5 k characters, roles do not end with a period (the tool appends one), no avoided words (photoreal, 3D, glossy, neon, epic, cross, glowing red eyes, and similar) in any prompt or role.
- `npx tsx tools/gen_image.ts --spec ...` without `--execute`: `fadyme_chibi_sheet`, `bellbound_dead_chibi_sheet`, `hollow_pilgrim_chibi_sheet` print the request path, reference hashes and "a reservation WOULD succeed (nothing reserved, no call made)". `mahmut_chibi_sheet` fails with `ENOENT` on `reference/approved/mahmut_identity_master.png` by design (the approval gate has not run); a scratch copy with the key art as a stand-in for reference 1 dry-runs cleanly, so the rest of the spec is sound.
- `content/budget/media_budget.json` unchanged (`entries: []`); no file outside `art_specs/p0/` and this plan was written; no `--execute`, no paid call.
- Open items for Claude (tooling, not for these specs): `buildUnitAtlas` still reads fixed legacy regions and does not key green, so the ingest tool of the pipeline (component slicer, lower-body pivot, `state_map`) must exist before the first sheet can ship; the real Gemini dimensions, supported 16:9 at 2K, and the `media.ts` request shape are unverified until the first approved call.
