# Production Rules (technical team spec, adopted 2026-09-29)

Verbatim technical spec is authoritative for production assets. Narrative addenda follow it.

## Two art modes (locked)
- NARRATIVE MODE (VN busts, cutscene/key illustrations, chapter backgrounds): polished hand-painted anime / light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light.
- PLAY MODE (chibi battle poses, item/skill/enemy icons, hub and map props): gritty 2D ink style — chibi anime proportions (2–3 heads tall), adults drawn chibi with adult design cues and no childlike facial cues, fully covered costume, no suggestive poses; bold uneven black ink outline (thick outer silhouette, thinner inside, slightly angular brush lines, closed and continuous, no glow, no soft outline); flat cel shading in 2–3 tone steps; sparse bold hatch strokes only in the deepest shadows; strong readable silhouette with exaggerated hood/cloak/weapon shapes and angular folds; 3–4 main colours plus ONE accent from the model sheet; grim without gore. Never name any game, studio or living artist.
Both modes share each character's face cues, hair, signature colour and costume from the model sheet.

## Global rules
- Attach the character's approved model sheet and match it exactly. Adults only; no pin-up framing, no chest/hip crops, no distress-as-spectacle. Costumes follow the character's sheet: fully covered by default. C42 allure tiers: Tier A (Sable, Vespera) may show bare shoulders, collarbone, upper back and fitted silhouettes, and may use figure-emphasizing framing only in banner key art, ultimate cut-ins, victory poses and limited/event illustrations; Tier B (Pippa) has a stage costume only. Never nudity, see-through fabric, upskirt/down-blouse angles or sexual implication.
- Palette layers: characters follow their sheet; environments follow the location brief; crimson is an omen/curse accent only, never a fill.
- Forbidden texture: moire, mesh, chain-mail-like or stippled micro-patterns, dense high-frequency noise, baked-in film grain. Keep large areas calm; detail only at focal points.
- No text, logos, watermarks, signatures or UI in the image.

## Asset specs
1. VN bust 1024x1536: head, face, hands in the upper 70%; bottom quarter calm; centered, facing the open side. Expression sets: identical pose, camera, hairline and hood; change only the face; name each expression.
2. Battle poses: six separate images (idle, attack, hit, skill, guard, victory); same proportions, scale, camera, feet baseline and costume; generous margin; not a grid.
3. Chapter background 1024x1536: content inside centre 84% of width; no characters; lower third calmer and darker; opaque. Battle plate variant: unit band mid-to-light in value, edges darker, rows empty.
4. Icon sets 1024x1024: one category per image (mixed set allowed for the pilot), 4x4 grid, wide gaps, one centred object per cell, flat single-colour background, one accent per icon, readable at 64 px, no text.
5. Transparent needs (busts, poses, icons): flat evenly lit single-colour key background; hard-edged silhouette; no gradient, floor shadow, glow, smoke, particles or soft fringes touching the edge (effects are separate assets). Key colour #00FF00 / #00FFFF / #FF00FF with the largest hue distance from the palette; state it.

## Filenames and metadata
`{kind}_{id}[_{variant}]_v001.png` — metadata: id, kind, mode, variant, reference files, key colour or "opaque", native size, intended runtime size (bust 640x960, background 1080x1920, icon 128 px), ORDER_LEVEL, revision, date.

## Narrative addenda (do not conflict with the spec)
- Production reference rule is the SAME-character rule: "The attached model sheet shows THIS character. Match face, hair, costume, palette and weapon exactly; ignore its layout, labels, text and background."
- Canon details that must never drift are in each character's identity block "LOCKS" line (e.g. Cael's watch has no hands; Yseldra's seals are gray).
- Materials that the forbidden-texture rule affects (Yseldra's mail, Cael's gold scales, Nara's plate) are drawn as broad simplified shapes, never micro-pattern.
- Prompt template (C40, applies to every character): (1) reference sentence; for expressions and non-idle poses, a second sentence naming the approved composed bust / idle pose as the second attached image; (2) IDENTITY + ADDITIONS verbatim from `character_briefs.md`; (3) mode block; (4) composition; (5) key colour block; (6) a "Locks:" sentence; (7) expression or pose. Generate the base asset first and approve it before its variants.
- Pose content comes from the character's combat fantasy and skill names in `characters_part1.json`; weapon lore wins over generic action (e.g. Fadyme's thorn clapper never swings).
- Never attach off-model art as a reference (`art/brand/key_art_*.png`, app icon: CC-12).
- Fadyme's curse is shown only by the story state requested; default production art shows no curse marks. Never make the curse look like a gameplay penalty.
