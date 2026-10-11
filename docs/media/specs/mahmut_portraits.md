# Prompt-spec plan: group `mahmut_portraits`

v1 · 2026-10-11 · planning only. **No paid call, no budget reservation, no ledger write was made** (`content/budget/media_budget.json` still has `entries: []`; every spec was only validated or dry-run). English only. Subordinate to `README.md`, `narrative/` canon and `docs/media/ART_BIBLE.md` (called "the bible" below).
Tags: **CANON** quoted from `narrative/` · **REF** read by eye from a locked reference · **PROPOSAL** decision of the bible or of this file, owner may replace · **UNKNOWN** not in canon, left unspecified in every prompt.

Specs (committed, `ImageSpec` of `packages/shared/src/media.ts`): `art_specs/p0/mahmut_vn_composed.json`, `mahmut_identity_master.json`, `mahmut_vn_watchful.json`, `mahmut_vn_protective.json`, `mahmut_vn_dry_humor.json`.

## 1. Summary

| Stage | Asset id | Purpose | Model / size / ratio / count | Refs | First-attempt USD |
|---|---|---|---|---|---|
| 1 | `mahmut_vn_composed` | First Mahmut face. Once the owner approves it, it **is** his identity anchor (no locked face exists) and the default VN bust | `gemini-3.1-flash-image` / 2K / 2:3 / 1 | 2 | 0.101 |
| 2 | `mahmut_identity_master` | Full-body identity-anchor master: costume and equipment reference for his chibi sheet (and later key art) | same | 2 | 0.101 |
| 2 | `mahmut_vn_watchful` | Bust, tag `watchful` (edit of the approved composed) | same | 1 | 0.101 |
| 2 | `mahmut_vn_protective` | Bust, tag `protective` (edit) | same | 1 | 0.101 |
| 2 | `mahmut_vn_dry_humor` | Bust, tag `dry_humor` (edit) | same | 1 | 0.101 |
| | **Group total, one attempt each** | | 5 images | | **$0.505** |

Cost envelope (price table `IMAGE_PRICES_USD`, verified 2026-10-11; recheck before approval): planning figure with one retry on `composed`, on the master and on one expression = 0.505 + 3 x 0.101 = **$0.808**. Hard cap, three attempts on every id with the third on `gemini-3-pro-image` 2K ($0.134): 5 x (0.101 + 0.101 + 0.134) = **$1.680**. All of it is far under the $20 month and every reservation (one per spec, $0.101) is under the $3 batch cap. Attempts are counted per asset id by the guard, so the five ids have independent three-attempt caps.

## 2. Decisions

### 2.1 Four singles, not one 4-up sheet
The brief asked to decide by cost and consistency. Singles win on consistency by a wide margin and lose about $0.25 on paper.

| | A. Four single busts (chosen) | B. One 4-up sheet |
|---|---|---|
| Canvas | 4 x 2:3 at 2K (expected 1696 x 2528 each, UNKNOWN until the first call) | The exported bust is a fixed 768 x 1152 canvas (`EXPORT_PIPELINE.md` 2.1 B) and may not be upscaled (gate A03). A 2x2 on 1:1 at 2K gives cells of about 1024 x 1024, so a 2:3 bust inside is about 683 x 1024: too small. It would need **4K** (`$0.151`, real dimensions UNKNOWN) |
| First-attempt cost | 0.101 + 3 x 0.101 = **$0.404** | **$0.151** |
| Cost when one expression is wrong | re-roll that one id: $0.101 | re-roll the whole sheet: $0.151, and the three good ones are lost; one asset id shares one 3-attempt cap |
| Identity | composed is generated first, approved, then each expression is an **edit conditioned on it** (bible 3.1 and 6: "approved composed + one sentence of change") | no approved face exists yet, so all four faces are invented together and the owner approves all or none; no edit conditioning |
| Fixed crop (gate A28: silhouette IoU >= 0.95, eye line 27 %, bbox within 1.5 %) | enforced by the edit lock | cannot be enforced; each cell is composed independently, slicing needs gutters of >= 12 % around four broad-shouldered, caped figures |
| Fit with the sibling Fadyme set | same pipeline (singles + edits) | breaks symmetry |

Verdict: singles, chained by edits. The extra $0.25 buys the set-consistency gate.

### 2.2 Model choice
`gemini-3.1-flash-image` at 2K for all five (the cheapest tier that meets the bible's 2K bust contract; $0.101). `gemini-3.1-flash-lite-image` is 1K only ($0.0336), below the 2K contract, and nothing in the repo shows it holds identity from references. `gemini-3-pro-image` ($0.134 at 2K, +33 %) is used **only as the third attempt** when attempts one and two fail on identity or on instruction following. After the pilot, a 1K trial for the three expression edits is a possible saving of $0.067 each, not planned.

### 2.3 Why a full-body master and why 2K
A chest-up bust shows no legs, boots, shield or sword, and the chibi sheet needs the whole costume. The master carries the equipment the chibi sheet must obey: sword in the right hand, heater shield on the left arm (REF key art; canon "scarred gloves", "repaired heater shield", "arming sword with iron-filled crest socket"). It is also what the owner looks at when approving the star, the empty crown socket and the shield rim, so 2K ($0.101, not 1K $0.067) keeps those details legible at about 80 px.

### 2.4 Order, approval gates and the reference path
1. Dry-run `mahmut_vn_composed` (works today), reserve, execute (max three attempts), review with the checklist below. **Owner approval of the chosen candidate = identity anchor.**
2. Approval gate (Claude-owned, not part of these specs): copy the chosen raw PNG **byte-exact** to `reference/approved/mahmut_vn_composed.png` and record its SHA-256 in the provenance. `reference/` is an allowed reference folder for ingest gate A31. This folder is a PROPOSAL (new, "approved project outputs"); until it exists, the four stage-2 specs fail a gen_image dry run with `ENOENT` (verified), while `validateSpec` and the price check pass.
3. Stage 2 can then run in any order. Suggested: `mahmut_identity_master` first (it unblocks the chibi-sheet spec of another author), then the three expressions.
4. Owner approves the master; copy it byte-exact to `reference/approved/mahmut_identity_master.png`. The `mahmut_chibi_sheet` spec should take this master as its reference 1 (costume and face) and may add the approved composed bust to hold the face, plus `chibi_ref_fadyme.png` / `fadyme_battle_pose_idle_v002.webp` for CHIBI proportion and outline only, per bible 6.

### 2.5 What was deliberately left unspecified (UNKNOWN, bible 4.1)
Face shape, eye shape, skin tone, exact hair length and parting (only "short, clumped into thick locks" is taken from the REF key art), height or build numbers, boots, glove colour, scar positions (the face is asked to be clean and unmarked so no invented scar becomes canon), shield size and any heraldry (REF: dark, plain face; the "seal pressed into its rim" is only "a tiny abstract round seal impression", design unknown), sword length. Whatever attempt 1 of `composed` decides is frozen by the owner's approval.

### 2.6 Source conflicts resolved
- **Star position**: REF key art puts the star on the right **pauldron**; CANON says "on his breastplate". The prompts follow canon and tell the model not to take the position from the key art.
- **Gauntlet**: REF key art shows a gauntlet; CANON guide says "scarred gloves"; the prompts say scarred, scuffed gloves.
- **Hands in busts**: bible 3.1 reads "face and both hands inside the top 62 %". These busts crop above the hands (fixed props across a set, nothing to drift); the rule is satisfied vacuously and the checklist marks canon item C5 (shield, sword) as N/A for busts.
- **Rim-light direction** (PROPOSAL, bible says only "same direction across a set"): warm amber rim from behind on the **left** of the frame, i.e. toward the screen centre for the right slot, tracing hair, jaw and pauldron so the dark steel and oxblood separate from the dimmed backdrop (gate A26). The Fadyme set author should mirror this (rim on her right) if both appear together.
- **Facing**: Mahmut = right slot, faces viewer-left, authored so no runtime flip is needed (bible 3.1). The bible id list has no class for the master; `mahmut_identity_master` matches the id regex and is a review/anchor artefact, never shipped.

### 2.7 Runtime geometry the busts are composed for
`StoryScene.showActor` scales a portrait to 980 ref px tall, bottom-anchored at y 1098-1120, x = 1420 for the right slot; the dialogue panel (y 805-1055) hides the lower ~30 %. Hence: eyes about 27 % from the top (allowed 24-30 %), top of hair >= 3 % (asked 4 %) from the top edge, face inside the top 50 % (limit 62 %), shoulders and cloak >= 6 % from the side edges, lowest third plain breastplate and cloak. Export is 768 x 1152 with a fixed canvas (no trim), lossy alpha WebP, cap 240 KB.

## 3. Reviewer checklist, common to all five (any "no" fails the candidate)
Bible section 5, restricted to what applies to Mahmut:
- **A1** reads as an adult man of about 28 (not a boy, not elderly). **A2** no text, letters, digits, logos, watermark, UI, badge. **A3** dark-dominant, no pure black or pure white, no neon; crimson appears only as the oxblood cloak (darker and browner than UI `C.crimson` #8F1D3A). **A4** painterly gothic anime (R1), never photoreal, 3D or flat clip-art. **A5** no second person, no legible name, no faction or royal crest. **A6** no gore, no sexualised framing. **A8** no cross, holy or angelic motif on armour, shield or pins.
- **C1** dark messy hair, stubble, brown tired-but-steady eyes. **C2** dark worn, visibly mismatched-repaired half-plate. **C3** small Crown Guard **star** on the breastplate with an **empty** socket directly above it (not a crown, not smooth plate). **C4** torn oxblood cloak. **C6** reads tall and broad. **C7** no helm, no raised hood, same face as the approved `composed`.
- **F1** flat pure #00FF00 (border ring sigma <= 8), no green on the subject, no green fringe at 300 % on a dark and on a light backdrop, hair silhouette not wispy. **F3** (busts) identical crop, lighting and costume across the set. **F4** hash-compared against sibling candidates (no near-duplicate across attempts). **F5** provenance JSON saved (model, prompt, reference hashes, cost), attempt count <= 3.
- Crimson share (gate A24 <= 3 %) needs a per-asset override for the cloak; not a reason to reject.

---

## 4. `mahmut_vn_composed`

**Purpose.** Defines Mahmut's face and the set's crop, camera and light. Tutorial tag `composed` (14 of Mahmut's 43 tutorial lines, e.g. "We can rest here.", "I am here."). Approved output = identity anchor (bible 4.1 UNKNOWN row).
**Model.** `gemini-3.1-flash-image`: this is text plus costume-reference generation, the cheapest tier at 2K; pro only on attempt 3.
**Size.** 2K, 2:3, `count: 1`, key green. $0.101.
**References** (text goes first, then the images; the tool appends `Reference image N: <role>.`):
1. `narrative/14_References/recovered_locked_v001/key_art/brand_key_art_portrait_r2_v003.png` (sha256 `58c54af2d268ce663542960950aace744286c7c4cf5d85b77a814134e3156176`): COSTUME and PALETTE of the man only (half-plate, pauldrons, gorget, torn oxblood cloak, short dark messy hair, slate mood); explicitly **not** his face (hidden), star position, pose, bridge, eclipse or the woman.
2. `reference/derived/fadyme_vn_bust_composed_v001.webp` (sha256 `7254e88f2c300e9c031e473620cea6b81e3c049f353d5905b9fbeb8ab5a97347`): CAMERA, CROP and RENDER STYLE only; explicitly not her face, hair, hood, scarf, bell or the cross-shaped pins.

**Prompt.** Skeleton of bible 6 (deliverable, identity block quoted from canon, composition with fractions, style, light and palette with token hex once, technical, one closing "Do not add" sentence of nouns). Canon descriptors used verbatim or near-verbatim: "dark messy hair, stubble, brown eyes", "tired, but steady", "dark worn half-plate", repaired "in several mismatched styles" (canon: "six different styles"), "Crown Guard star", "empty socket", "tattered oxblood cloak", "Guard red ... dyed darker". Expression composed = bible 3.1 row (steady level eyes, relaxed jaw, closed mouth).
**Acceptance** (common checklist plus):
1. Face turned toward viewer-left, three-quarter, eyes to camera or just past it; eye line 24-30 % from the top; hair top >= 3 % from the edge; face and any hand inside the top 62 % (no hands expected); shoulders/cloak >= 6 % from the side edges; bottom third plain.
2. A man's face, not a copy of Fadyme (no pale ash hair, violet eyes, hood, scarf, bell, cross-shaped pin) and not a generic anime template; tired but steady, no smile, no sadness.
3. Silhouette separable from a dark backdrop by the thin warm rim; the cloak mid-tone is visibly lighter than its shadow (A26).
4. Owner can sign off "this is Mahmut" because every later asset copies it.
**Fallback.** Attempt 2 changes one thing, chosen by the first failure the reviewer records (default = first row):

| Failure on attempt 1 | Attempt 2: exact change |
|---|---|
| Fadyme traits leak, or the face reads feminine | delete reference 2 from `references` and append to the SUBJECT paragraph: "A man's face: an adult man's face and neck." |
| Costume drift (bright red or purple cloak, star on the shoulder or missing, crown present or smooth chest, clean or gilded armour, helm) | replace the sentence "He wears dark worn half-plate ..." through "... where a crown once sat." with: "He wears only these items: dark worn half-plate in matte charcoal steel, scuffed and patched with mismatched repair plates, with no gold and no engraving; one small silver star on the centre of the breastplate and a small empty round socket directly above it, bare plate; a torn matte oxblood cloak, deep brownish crimson." |
| Face too young, glossy or idealised | append to the SUBJECT paragraph: "His face is that of a man of 28 who sleeps last and wakes first: faint shadows under the eyes, weathered matte skin, nothing glossy or youthful." |
| Keying defects (gradient, floor, green halo, thin hair wisps) | replace the TECHNICAL paragraph with: "TECHNICAL: the background is a single flat colour, exactly #00FF00 (RGB 0, 255, 0), identical in all four corners and across the whole canvas, with nothing painted on it; every edge of the figure is a hard clean silhouette; the hair is a solid dark mass of thick locks; cloak and steel carry no green tint or reflection; text-free." |
| Crop or pose miss (eyes off 24-30 %, hands visible, shoulders cut, faces right) | replace the COMPOSITION paragraph's fractions with: "Divide the canvas height into ten equal bands: the top of the hair in band 1, the eyes in the upper part of band 3 (about 27 %), the chin at the end of band 4, the frame ending at the lower ribs; the face turns toward the left of the frame." |

Attempt 3: switch `model` to `gemini-3-pro-image` ($0.134) with the best prompt so far; no other change. After a third paid attempt, stop and request owner review before any new prompt (guard rule).

---

## 5. `mahmut_identity_master`

**Purpose.** Whole-body identity anchor in the approved face: costume and equipment authority for `mahmut_chibi_sheet` and later key art (bible 6 attachment map: chibi sheet takes the approved portrait; this adds the legs, boots, sword and shield a bust cannot show). Review artefact, not shipped.
**Model.** `gemini-3.1-flash-image`: single identity-locked generation; pro only on attempt 3.
**Size.** 2K, 2:3 (head-to-boots at about 7.5 heads leaves a face of roughly 300 px, enough for identity), `count: 1`, key green. $0.101. Depends on the approved composed (stage 2).
**References.**
1. `reference/approved/mahmut_vn_composed.png` (created at the approval gate): IDENTITY LOCK for the face and costume; draw the whole body, do not copy the bust framing.
2. `narrative/14_References/recovered_locked_v001/key_art/brand_key_art_portrait_r2_v003.png`: COSTUME, EQUIPMENT and PALETTE only (half-plate with greaves and boots, torn oxblood cloak, dark heater shield on the left arm, arming sword in the right hand held low); not the back view, pose, bridge, eclipse, woman, shoulder star position or gauntlet shape.

**Prompt.** Same skeleton. Equipment quoted from canon: "repaired heater shield", "arming sword with iron-filled crest socket" (drawn as a flat dull iron disc filling a round socket in the pommel), "scarred gloves", star plus empty socket. Handedness stated against the picture: sword in his right hand on the picture's left, shield strapped to his left forearm on the picture's right. Pose neutral and relaxed, 30 degrees toward viewer-left, soles about 6 % above the bottom, hair about 5 % below the top, >= 8 % side margin, nothing under the boots. Boots and greaves are drawn as plain dark (REF), style UNKNOWN. The word "chibi" does not appear (R1 register).
**Acceptance** (common checklist plus):
1. Whole figure inside the frame, both boots visible, soles the lowest pixels, no floor line or cast shadow, margins as above.
2. Face, hair, stubble and expression match the approved composed (overlay it; same man, not a lookalike).
3. **C5**: arming sword (single-handed, straight, double-edged) in the right hand on the picture's left, point down and away; its pommel shows a flat iron-filled socket; heater shield (not round, not a tower or kite shield) on the left forearm on the picture's right, plain dark face, riveted repairs, a tiny abstract seal in the rim, no crest; no royal crest anywhere.
4. Five fingers per hand, hands not hidden by cloak; cloak hangs behind and does not cover the sword, shield or front plate.
5. Reads tall and broad (about 7 to 8 heads); silhouette (cloak, sword, shield, boots) stays readable when shrunk to 160 px, which is what the chibi sheet will be derived from.
**Fallback.**

| Failure on attempt 1 | Attempt 2: exact change |
|---|---|
| A bust or three-quarter length is returned, feet cut off | prepend to the prompt: "Reference image 1 shows only the head and shoulders. The output shows the entire standing body from the hair to the soles of both boots, with the boots clearly visible." |
| Face drifts from the approved composed | append to the SUBJECT paragraph: "The face must match reference image 1 exactly: the same brows, eyes, nose, mouth, jaw and stubble." |
| Wrong hand or missing equipment (sword in the left hand, round shield, no shield) | replace the two equipment sentences with a restatement that begins "On the left side of the picture his right hand holds ...; on the right side of the picture his left forearm carries ..." and adds "heater-shaped: wide flat top, sides tapering to a point at the bottom". |
| Hands malformed | append: "Each hand has one thumb and four fingers, partly closed around the grip or the strap." |
| Key defects | same TECHNICAL replacement as in section 4 |

Attempt 3: `gemini-3-pro-image`, same prompt. If it still fails, ask the owner whether to accept the best candidate as a costume-only reference and keep the approved bust as the face lock for the chibi sheet.

---

## 6. `mahmut_vn_watchful`, `mahmut_vn_protective`, `mahmut_vn_dry_humor`

Shared design: **image-edit conditioned on the approved composed** (reference 1 only, so the identity lock is not diluted), a self-contained prompt that restates the identity block, then "CHANGE ONLY THE EXPRESSION". Per bible 3.1 only brows, eyes, mouth and a head tilt of <= 5 degrees may change. Model `gemini-3.1-flash-image`, 2K, 2:3, `count: 1`, $0.101 each; single-reference edits are the easiest case for the cheapest tier. All depend on `reference/approved/mahmut_vn_composed.png`.
**Common acceptance** (common checklist plus A28 of `EXPORT_PIPELINE.md`): same silhouette as composed (IoU >= 0.95), alpha bounding-box top and bottom within 1.5 % of the canvas, eye line within about 1 % of composed, same star, socket, armour, cloak tatters and rim light; difference confined to the face band; the expression is correct and distinguishable from `composed` at a glance at 980 px height.
**Common fallback.** Attempt 2 default: prepend to the prompt "Edit reference image 1 in place: copy it pixel for pixel and repaint only the eyebrows, eyelids, eyes and mouth." If the expression is too weak, strengthen one notch (rows below); if too strong (angry, sneering, smirking), halve it with "half as strong". Attempt 3: `gemini-3-pro-image`, same prompt.

| Id | Look (bible 3.1 PROPOSAL) | Tutorial lines | Specific acceptance | Attempt 2 intensity change when the expression is too weak |
|---|---|---|---|---|
| `mahmut_vn_watchful` | eyes track slightly off-axis (past the camera toward the frame's left edge), brow minimally lowered, head turned 3-5 degrees further, mouth closed | 14 lines, e.g. "Are you hurt?", "Keep to the stones." | gaze clearly leaves the camera yet the head barely moves; reads attentive, not afraid or suspicious; mouth neutral | "the eyes rest clearly on the left edge of the frame" |
| `mahmut_vn_protective` | brow lowered and drawn together, jaw set, eyes hard and level to the camera, chin down a few degrees; resolve, not rage | 3 lines: "Two of them. Stay beside the wall.", "Wait for my shield." | no teeth, no snarl, no wrinkled-nose anger; eyes on the camera; face still the same man (canon: his anger is silence) | "the brow is clearly lowered and the jaw clearly set" |
| `mahmut_vn_dry_humor` | one mouth corner barely lifted, flat amused eyes, no teeth | 12 lines, e.g. "Both boots are still with us.", "Actual bread." | smile closed and asymmetric, subtle; not a grin, smirk or laugh; tiredness remains | "the lifted mouth corner is clearly visible while the mouth stays closed" |

---

## 7. Dry-run evidence (2026-10-11, no `--execute`, budget file untouched)
- `validateSpec` and `estimateUsd` over all five specs: OK; each `gemini-3.1-flash-image` 2K = $0.101; group total $0.505; no banned style words in any prompt (no "chibi", "photorealistic", "masterpiece", "8K", "epic", "neon" and so on).
- `npx tsx tools/gen_image.ts --spec art_specs/p0/mahmut_vn_composed.json`: dry-run OK, request path `/v1beta/models/gemini-3.1-flash-image:generateContent`, both references hashed, "a reservation WOULD succeed (nothing reserved, no call made)", remaining $20, attempts used 0.
- The four stage-2 specs: a real dry run stops with `ENOENT ... reference/approved/mahmut_vn_composed.png` because the approved file does not exist yet (expected, not a spec error). Scratch copies in the session scratchpad with that path swapped for an existing file passed the full dry run (validation, price, request build, budget check) with the same $0.101.

## 8. Open items for the owner or Claude
1. Approve the proposed `reference/approved/` convention (or name another folder) so stage 2 can run.
2. Confirm the rim-light direction with the Fadyme set (section 2.6).
3. Confirm Mahmut's `composed` default, and that the first approved face becomes the anchor (bible 7.3 and `EXPORT_PIPELINE.md` 7.4).
4. The keyed pre-pass for portraits is still a tooling gap (bible 3.0): `buildPortrait` does not key green.
