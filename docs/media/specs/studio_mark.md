# Asset group `studio_mark` — prompt-spec plan

Date 2026-10-11 · author: prompt-spec subagent · contract: `docs/media/ART_BIBLE.md` (§3.7 Studio mark, §1 palette, §3.0 keyed classes, §5 checklist, §6 prompting rules) · spec format: `ImageSpec` in `packages/shared/src/media.ts` · English only.
**Status: planned, no paid call made.** `content/budget/media_budget.json` `entries: []`; the spec below was dry-run only (`npx tsx tools/gen_image.ts --spec art_specs/p0/studio_mark_01.json`, no `--execute`): validation passed, reservation WOULD succeed.

## 0. Summary

| # | Spec file | Asset id | Model | Size | Ratio | Count | References | Estimate (1 attempt) |
|---|---|---|---|---|---|---|---|---|
| 1 | `art_specs/p0/studio_mark_01.json` | `studio_mark_01` | `gemini-3.1-flash-image` | 1K | 1:1 | 1 | 0 | **$0.067** |

**Group total (one reserved attempt): $0.067.** Contingency if the 2 reserve attempts are used: attempt 2 flash $0.067, attempt 3 flash $0.067 (or pro $0.134) → worst case **$0.201** (all flash) or **$0.268** (attempt 3 on pro). Prices from `IMAGE_PRICES_USD` (verified 2026-10-11): flash 1K $0.067, pro 1K $0.134. Fits `$20/month`, `$3/batch`, `<=3 attempts/asset`. Always reuse the id `studio_mark_01` for every attempt: the guard counts attempts per asset id, and a new id must not be used to dodge the cap.

## 1. Spec `studio_mark_01`

**Purpose.** The emblem shown on the "SovTaym Studios Presents" card (`apps/game/src/scenes/StudioScene.ts`): `ui('studio_mark')`, fitted into 260 x 260 reference px, centred at (960, 370), over the card colour `#05030A` ("ink on black"), above the Phaser-rendered text "SovTaym Studios" (Cinzel, bone ivory) and "PRESENTS". Pipeline: keyed green -> `tools/lib/art.ts buildKeyedImage` (alpha ramp over `g - max(r,b)` 40..130, despill, trim) -> fit inside 512 x 512, <= 60 KB (`docs/media/EXPORT_PIPELINE.md` section E, row `studio_mark_01`, marked optional). **Glyph only: no text is baked in** (the model is not trusted to render the studio name, the name is PRELIMINARY, and the scene already draws the text in the UI font).

**Concept (PROPOSAL, owner may replace; the owner brief is UNKNOWN).** A "lozenge sigil": an upright outer diamond frame (double hairline, worn old gold `C.gold` #B8975A), a smaller concentric diamond filled with ink (`C.ink` #120A18) and edged in silver-lilac (`C.silver` #C9B6E4), one tiny bone-ivory diamond (`C.bone` #E9E2D4) at the centre, and one short tapered silver-lilac hairline running out of each side corner. It is deliberately the "hairlines meeting a diamond" vocabulary already used by the fallback ornament (`StudioScene.ornament`) and the UI panels, so the card looks the same whether the mark is generated or not. Why this and not a story symbol:
- Owner direction (`narrative/00_Canon/Owner_Current_Direction/CREATIVE_RESTART_PROMPT.md` line 46, `EXTERNAL_DESIGNER_INTRO_PROMPT_TR.md` line 19): the studio logo is separate from the game logo, and the two must carry separate visual identities. The bell, silver thorn, broken crown fragment and thin crimson eclipse ring are the game logo's identity (`WORLD_STORY_CHARACTER_BRIEF_2026-10-05.md` line 247, ART_BIBLE §3.7), so none of them may appear. Also excluded: raven and hourglass (the archived non-Google studio emblem; `VISUAL_REFERENCE_BRIEF_2026-10-05.md` line 5 says earlier studio emblems are not a style reference), cross and sword shapes (owner brief rejects the cross-sword identity; ART_BIBLE §5 A8), circles and rings (eclipse), anything that spells or implies the name (pronunciation and clearance UNKNOWN, `STUDIO_NAME_RESEARCH_2026-10-05.md`).
- An abstract glyph keeps working if the studio name changes after the trademark checks (the card text is separate), and a four-corner symmetric shape is the geometry a diffusion model holds most reliably.

**Model and why.** `gemini-3.1-flash-image` at 1K ($0.067). There is no character identity to hold, so the pro model ($0.134) is not needed for attempt 1; it is reserved for attempt 3 if flash cannot hold the geometry. `gemini-3.1-flash-lite-image` ($0.0336, the only cheaper option) is not used: its aspect-ratio support, instruction following and green-background purity are UNKNOWN and the saving is $0.033, while a keyed asset that fails costs a whole attempt. Size 1K per ART_BIBLE §3.7 (export is <= 512 px, so 2K buys nothing).

**Size / ratio / count.** 1K, `1:1`, `count: 1` (ART_BIBLE §3.0). Real output dimensions UNKNOWN until the first call (expected 1024 x 1024).

**References: none (0 images), on purpose.**
- The locked wordmark (`narrative/14_References/recovered_locked_v001/logo/brand_logo_wordmark_r2_v003.png`) and key art (`.../key_art/brand_key_art_portrait_r2_v003.png`) were viewed. Both carry exactly what must NOT transfer: letters, the bell and thorn, the broken crown, the crimson ring, the two characters. Image conditioning leaks such content even with an "ignore X" role line, and ART_BIBLE §6 says each extra reference dilutes control.
- Palette and finish are specified by hex tokens and material words instead (the same tokens the logo uses: `C.silver`, `C.gold`, `C.bone`).
- `reference/locked/fadyme/...` is irrelevant (no character, and it would invite a figure).
- Optional use on attempt 2 or 3 only if the finish does not match the game's silver and gold: the wordmark as reference image 1 with the role "MATERIAL FINISH ONLY: worn matte silver and old-gold surface treatment; ignore all lettering, the bell, thorn, crown fragment, ring and layout, none of them may appear". That is a single-variable change; do not add it speculatively.

**Prompt.** Self-contained, in the JSON (`prompt`). It follows ART_BIBLE §6 order: deliverable, SUBJECT (hex tokens), COMPOSITION (proportions, not pixels: outer diamond ~60% of canvas width, outward hairlines ~9% each, whole symbol ~78% wide, >= 8% margin all sides), STYLE (matte worn metal, brush grain, strokes ~1.5% of width and never < 1%, so the 512 export and the 260 px display keep >= 3 px strokes and the keyer does not erase hairlines), LIGHT AND PALETTE, TECHNICAL (flat `#00FF00`, no green on the subject, no glow/shadow/vignette), and a closing "Do not include" tail (text/letters/numbers/watermark; ring or circle; bell, crown, bird, hourglass, cross; extra ornaments or borders; gloss, bevel, 3D facets). No canon identity is quoted because no character appears; no UNKNOWN is invented. R3's heavy ink contour is intentionally not applied: the mark sits on `#05030A`, where an `C.ink` outline would vanish, so the ink appears as the inner fill instead (documented deviation from §2 R3).

**Acceptance checklist (reviewer; any "no" fails the attempt).** Review the keyed result composited on `#05030A` and on a light backdrop (`#D8D2C8`), at 300% and after downscaling to 260 px and 120 px wide.
1. Exactly one symbol, centred (bbox centre within 3% of canvas centre), mirror-symmetric left-right and top-bottom (side margins differ by <= 4% of canvas width), >= 6% margin from every edge (ART_BIBLE §3.0; prompt asks 8%).
2. Zero text, letters, digits, pseudo-glyphs, runes, watermark, UI, rating badge (§5 A2).
3. Background flat pure green: border pixels median within +-12 per channel of `#00FF00`, no gradient, vignette, glow, mist, particles or cast shadow touching any edge (§3.0).
4. Keyer-safe: no pixel on the symbol, 3 px or more inside its silhouette, has `g - max(r,b) > 40`; no green fringe at 300% on either backdrop; gold is warm brown-amber, not olive or yellow-green (§1.3 rule 5).
5. Palette only old gold, silver-lilac, bone ivory, ink plum; no crimson or red (reserved for the eclipse ring, §1.3 rule 2), no cyan/magenta/neon; darkest value not pure `#000` (use >= `#0F0D11`), brightest <= `#F2EDE4` (§1.3 rule 1).
6. Separate from the game identity: no circle or ring, bell, crown or spikes, thorn, eclipse, hourglass, bird, cross/plus/dagger shape, sword; not a figurative picture of anything (§3.7, owner brief).
7. Flat matte 2D: no bevel, gloss, glass, 3D gem facets, drop shadow or glow; visible fine brush grain or paper tooth is fine, plastic or airbrushed is not (§2 Texture).
8. Structure intact: outer gold diamond double line, inner ink-filled diamond with silver-lilac edge, centre ivory diamond, two matching side hairlines. At 120 px wide the outer diamond, the dark inner diamond and the side hairlines must still read; the centre gem and the inner edge line may drop out. Every main stroke >= 3 px at 260 px display width.
9. Does not read as a playing-card suit, a "gem" emoji, an eye, a compass rose or a cross; reads as quiet gothic ornament (understated, not "epic").
10. Technical: keyed export fits 512 x 512, <= 60 KB WebP, alpha clean on `#05030A`; provenance JSON saved (model, prompt, reference hashes (none), cost); attempts for `studio_mark_01` <= 3 (§5 F4, F5).
11. Owner gate, not a reviewer pass/fail: the concept is a PROPOSAL; the owner approves it, and the mark is not marked final while the studio name clearance is open (`STUDIO_NAME_RESEARCH`, PRELIMINARY). Clearance of the symbol itself (similar existing logos) is unchecked.

**Fallback plan (attempts 2 and 3; one variable per retry, §6 iteration discipline; "SUBJECT / COMPOSITION / STYLE / TECHNICAL" below are the clause labels inside the JSON prompt).**

Attempt 2, chosen by which checklist item failed:
- Items 1, 8, 9 (asymmetric, too busy, thin strokes, unreadable at 120 px): simplify. Replace the whole SUBJECT sentence with: `SUBJECT: an abstract, perfectly symmetrical sigil built only from two diamond (lozenge) shapes, drawn as engraved metal-inlay linework: an upright outer diamond outline in a single worn old gold (#B8975A) line, the four corners sharp and closed; inside it a smaller concentric diamond filled with deep plum-black ink (#120A18) and edged with a thin silver-lilac line (#C9B6E4). Nothing else is on the canvas.` In COMPOSITION replace the proportion clause with `the diamond is as tall as it is wide and about 72% of the canvas width, with at least 12% empty margin on every side.` In STYLE replace `main strokes about 1.5% of the canvas width and nothing thinner than 1%` with `main strokes about 2% of the canvas width`. (This is the default attempt 2: attempt 1 is the richest version and complexity is the most likely failure.)
- Item 4 (green in the subject or olive gold): in TECHNICAL replace `no green anywhere on the symbol, no green tint or reflection in the metal` with `every colour on the symbol has red at least as high as green; the gold is a warm brown-amber like aged brass leaf, never yellow-green or olive; the metal reflects only dark plum`.
- Item 3 (background not flat): in TECHNICAL replace `flat pure #00FF00 background filling the whole canvas edge to edge, no shadow, glow, vignette, mist or particles around the symbol` with `the entire canvas behind and around the symbol is one uniform flat colour, exactly #00FF00 (RGB 0, 255, 0), identical in all four corners, like a chroma-key screen; the symbol casts no shadow and emits no glow`.
- Items 2, 6 (text, pseudo-glyphs or a forbidden motif appears): replace the final "Do not include ..." sentence with `The canvas holds exactly one object, the sigil, and no other mark of any kind. Do not include text, letters, numbers or a watermark.` (a long negative list can prime what it names, §6).
- Item 7 (3D, glossy, faceted): replace STYLE with `STYLE: flat 2D inlay: opaque flat fills with slightly irregular hand-drawn edges, matte, one thin hard ivory edge-light on the upper-left side of each gold line, no gradients inside shapes, brush grain only as a faint paper tooth; quiet gothic ornament, restrained and understated.`

Attempt 3 (last allowed; after it stop and request owner review), choose by the attempt-2 outcome:
- Precision or instruction-following failure (geometry, symmetry, leakage still present): keep the attempt-2 prompt unchanged and switch only the model to `gemini-3-pro-image`, 1K, $0.134 (price verified in `IMAGE_PRICES_USD`).
- Semantic failure (item 9 or the owner dislikes the concept): switch concept to B, a gothic double-lancet, with the SUBJECT sentence replaced by `SUBJECT: an abstract, perfectly symmetrical sigil made of two nested pointed gothic arches (lancet outlines), drawn as engraved metal-inlay linework: a tall outer pointed-arch outline in a single worn old gold (#B8975A) line, open at the base; inside it a smaller concentric pointed arch filled with deep plum-black ink (#120A18) and edged with a thin silver-lilac line (#C9B6E4); one tiny bone-ivory diamond (#E9E2D4) in the gap between the two arch tips.` and the COMPOSITION proportion clause with `the outer arch is about 50% of the canvas width and about 76% of the canvas height, centred, with at least 8% empty margin on every side.` Concept B can read as a door or tombstone, so it needs the owner's nod before spending.
- If attempt 3 also fails: do not generate a 4th. Ship the existing text-only hairline ornament (`StudioScene.ts` already falls back when `art.ui('studio_mark')` is absent; EXPORT_PIPELINE lever L3 drops the 60 KB) and ask the owner for a concept brief (EXPORT_PIPELINE open question 3).

## 2. Group cost and ordering

| Item | USD |
|---|---|
| Attempt 1 (reserved), flash 1K x 1 | 0.067 |
| Attempt 2 (reserve, not reserved yet), flash 1K x 1 | 0.067 |
| Attempt 3 (reserve), flash $0.067 or pro $0.134 | 0.067 to 0.134 |
| **Planned group total (1 attempt)** | **0.067** |
| **Worst case (3 attempts)** | **0.201 to 0.268** |

The asset has no dependency on any other asset (no references, no anchor): "icons and studio mark any time" (EXPORT_PIPELINE section on P3 order). It can be bundled into any batch; one reservation per spec, far below the $3 batch cap. Note for the ledger: the 0.067 here is the same figure EXPORT_PIPELINE already includes in its $2.693 one-attempt total.

## 3. Open points and risks (UNKNOWN stays unknown)

1. Owner concept brief for the studio emblem: UNKNOWN; the lozenge sigil is a PROPOSAL. Studio name clearance and pronunciation: UNKNOWN (PRELIMINARY); the mark is name-independent by design but is not to be called final until the owner decides.
2. Zero-reference generation is unverified for this model; the whole request shape in `media.ts` is unexercised (ART_BIBLE §4 note). Green-key purity of Gemini output, real 1K dimensions and whether thin hairlines survive the keyer's alpha ramp (`g - max(r,b)` 40..130) are UNKNOWN until the first call; hence the >= 1% stroke rule.
3. A lozenge pair can read as a card-suit diamond or a divider rather than an emblem (checklist 9); the fallback to concept B exists but needs owner approval.
4. Deviation recorded: ART_BIBLE §2 gives R3 glyphs a heavy `C.ink` contour; this mark has none because it is shown on `#05030A` (ink appears as the inner fill). Confirm with the owner when reviewing.
5. Tooling: only `buildKeyedImage` keys green (ART_BIBLE §7 item 6); the studio mark is the one class already wired to it (`ui.studio_mark`), so no new builder work is needed.
6. Symbol-level trademark or similarity check has not been done and is not part of the generation.
