# Reference Set — Part I (every prompt, in production order; 2026-09-30)

Everything in this file is generated one by one by the Narrative & Visual Director and **approved by the owner** (C41). After the whole set is approved, the rest of Part I is produced in batches against it.

**Order and dependencies.** R01 logo → R02 key art → R03 Fadyme sheet r2 (uses R02 as style) → R04 composed bust → R05–R07 other busts (with R04) → R08 idle pose (with the chibi crop cut from the approved R03) → R09–R13 poses (with R08) → R14 ultimate cut-in → R15 ch1 background → R16 battle plate (with R15) → R17 pilot icon set → music R18–R22 → voice R23 (audition, then all of Fadyme's lines).

**Models (C44, one per medium):** images `gemini-3.1-flash-image` at 2K; music `lyria-3.5`; voice `gemini-3.8-flash-tts`.

**Run with:** `tools/gen_image.py --file prompts/reference_set/REFERENCE_SET_PART1.md --asset R0x --size 2K --ref …` (images), `tools/gen_audio.py music --file prompts/reference_set/REFERENCE_SET_PART1.md --asset R1x` (music).

**Already approved before this set:** Fadyme busts composed, warm, honest_fear (v001) and quiet_pain (v002) were made against the old sheet. After R03 is approved they are compared with it; only the ones that no longer match are regenerated (R04–R07).

**Curse colour (C43, resolves audit CC-11):** pale cold fingers → a small blood spot on the scarf → one bone-white lock → thin black-gold lines on the fingers that spread past the wrist (7-5). Default art shows none of it.

## R01. Logo — wordmark with the bell emblem

```
Design a game logo for a melancholic dark-fantasy story about a woman who hides that she is dying. Mature, dark and heavy, like the carved title of a gothic horror novel: NOT cartoonish, NOT a casual mobile-game logo, no thick cartoon outlines. The attached image is the previous logo: keep only the idea of a large wordmark with a smaller subtitle line; replace its red cross-sword and thorn arc completely.
WORDMARK: "UNAWARE" in large, sharp, high-contrast gothic book-cover serif capitals with thin hairline serifs and slightly chiselled, worn edges; letters look carved from old weathered bone-white stone, painterly and semi-realistic, with chipped edges, a few deep cracks, grime settled in the recesses, deep plum-black shadows in the bevels and a faint cold highlight on the top edges. Below it, spaced small caps "OF MY DEMISE" in the same ivory, between two thin tarnished-silver rules.
EMBLEM: a small polished silver bell hangs from the middle of the letter W; its clapper is a long, slender silver thorn that hangs perfectly straight down between "MY" and "DEMISE". Behind the W, a thin crimson ring, fine as a hairline (an eclipse ring), frames the bell. Resting ON the top edge of the ring: one small jagged fragment snapped from a thin silver circlet, only two points, clearly broken, not a whole crown.
Colours: bone ivory, tarnished silver, deep plum shadow; crimson ONLY for the thin ring. Clean edges, readable at small sizes, symmetrical and centred, wide empty margin. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, no glow or particles touching the edges. Exactly this text and nothing else, spelled exactly: "UNAWARE" and "OF MY DEMISE".
```

**Negative:**
```
thick black cartoon outline, flat vector fill, bright clean letters, cartoon style, comic lettering, playful, rounded bubbly letters, rust, whole crown, crown floating above, thick ring, blood, dripping, splatter, sword, cross, skull, thorns wrapped around letters, flames, extra words, misspelled letters, extra letters, watermark, signature, gradient background, 3D chrome, glossy plastic, heavy grunge texture, noise, micro-texture, green in the logo
```

**Metadata:**
```
id: logo
kind: brand
mode: narrative
variant: wordmark_r2
reference files: art/brand/brand_logo.png
key colour: #00FF00
native size: 1920x1080
intended runtime size: title screen 1080 wide; store listing
ORDER_LEVEL: n/a
revision: v003
date: 2026-09-30
```

## R02. Key art — portrait (store and title screen)

```
The THIRD attached image is used ONLY for its painting technique, darkness, lighting and level of rendering: copy its mood and brushwork, but NOT its characters, faces, colours, red eyes, red hood, castle or composition. STYLE (most important): dark, moody, semi-realistic painterly anime illustration in the manner of a gothic light-novel cover painting, NOT cel-shaded and NOT cartoon: rich layered brushwork, soft painterly edges, heavy chiaroscuro, deep crushed shadows that swallow half of each figure, one cold rim light and one small warm light, desaturated palette close to black, atmospheric haze and depth, cinematic gloom, mature and melancholic. The first attached image is Fadyme's approved model sheet and the second is Mahmut's approved model sheet: match their faces, hair, costumes, palettes and weapons exactly; ignore the sheets' layouts, labels, text, backgrounds and story panels. Vertical key art illustration for a dark-fantasy story. Large calm dark areas, detail only at the faces, hands and the bell; no micro-texture, no film grain. SCENE: dusk on a high stone road that climbs AWAY from the viewer toward a distant crater-shaped mountain; the viewer stands on the road behind the two travellers, who are walking away from us, toward the mountain; above the mountain an unmoving eclipse, a black disc with a thin crimson ring, the only crimson in the image. In the middle ground MAHMUT, an adult man (28), dark messy hair, stubble, tired watchful brown eyes, dark worn half-plate with a small star on the breastplate and an empty hammered socket above it, torn oxblood cloak, long arming sword lowered, repaired heater shield on his arm, walks one step ahead with his BACK to the viewer, facing the mountain, his torn cloak and shield toward us, his head turned only slightly so a sliver of his profile shows; he is guarding the road ahead and never looks back. In the foreground, closer to the viewer and slightly behind him, FADYME, an adult woman (22), long pale ash-blonde hair from under a deep plum hood, violet eyes, a small broken silver crown fragment at the hood's front edge, white scarf high at the throat, deep plum layered mantle with silver-lilac embroidery, thin dark gloves holding a silver bell on a chain whose clapper is a long silver thorn; she is walking toward the mountain behind him but turns her head back over her shoulder to look at the viewer, with a small, calm, polite smile and tired eyes: she knows something he does not. Around her, a few pale flakes like ash drift UPWARD, and a few thin threads of her silver-lilac embroidery lift and fade at the hem, the only hint of what is happening to her. Palette: plum, slate, oxblood, dusk grey-blue, silver, one thin crimson ring. Both figures stand in the upper two thirds of the image; the lowest quarter shows only empty dark road stones and the trailing hem of her mantle, calm and free of any important detail, reserved for the title logo added later. No text, letters, logos, watermarks, signatures or UI anywhere in the image.
```

**Negative:**
```
cel shading, flat colours, cartoon, clean vector lines, bright evenly lit scene, children's illustration, characters walking toward the viewer, Mahmut facing the viewer, tiara, full crown, text, letters, title, logo, watermark, signature, UI, red eyes, black-red hood, red hood, fur mantle, fur collar on Mahmut, extra characters, crowd, pale-haired background figures, blood, gore, crimson sky, red fog, red particles, crimson fill, dense lace micro-texture, moire, film grain, pin-up framing, cleavage, chest crop
```

**Metadata:**
```
id: key_art
kind: brand
mode: narrative
variant: portrait_r2
reference files: art/sheets/char-fadyme-uomd.png + art/sheets/char-mahmut-uomd.png + art/brand/key_art_portrait.png (style only)
key colour: opaque
native size: 1080x1920
intended runtime size: store portrait, title screen background
ORDER_LEVEL: n/a
revision: v003
date: 2026-09-30
```

## R03. Fadyme model sheet r2

After approval: save as `art/sheets/char-fadyme-uomd.png` (old one to `archive/`), then crop its chibi panel to `art/sheets/chibi_ref/chibi_ref_fadyme.png`.

```
TWO REFERENCE IMAGES. IMAGE 1 is Fadyme's current approved character sheet: keep her face, hair, hood, mantle, dress, scarf, gloves, bell and palette, and keep its page layout and panel arrangement. IMAGE 2 is the approved key art: match its dark, semi-realistic painterly technique, heavy chiaroscuro, near-black desaturated palette and level of finish (not cel-shaded, not cartoon). Redraw the whole sheet at higher quality with the changes listed below; do not redesign her.

Vertical character design reference sheet, 2:3 portrait, for a dark gothic fantasy anime gacha RPG. Dark, moody, semi-realistic painterly anime illustration like a gothic light-novel cover painting: rich layered brushwork, soft painterly edges, deep shadows, cold rim light; dark painted panels over aged parchment with thin ruled borders; large calm areas, detail at faces, hands and the bell; no micro-texture, no film grain.

SUBJECT: Fadyme, an adult woman (22), slender and composed, gentle fatigue in her violet eyes; long pale ash-blonde hair falling from under a deep plum hood that is always up; a small broken silver crown fragment pinned flat at the front edge of the hood above her brow: one jagged snapped piece of a thin circlet with at most two short points, clearly broken, NOT a tiara and NOT a whole crown; a tiny silver bell-shaped hairpin in her hair at the side of her face, half hidden by the hood (new: show it clearly in the close-up and the detail panel); a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; flat-soled dark boots; a silver bell on a chain whose clapper is a long silver thorn. Palette: plum, aubergine, black, silver, white, with a pale lilac-violet accent for her Veil magic.

LAYOUT (same as image 1): top left the title "Fadyme", below it "The Last Bell" and the italic line "The Last Bell still rings." Left 40%: full-body hero pose on a rainy forest road before a stone wayshrine, holding the bell chain, hood up; her white scarf is clean (no blood outside the story-state panel). Top centre: large close-up portrait, the crown fragment and the bell hairpin visible, a small polite smile with tired eyes.

EXPRESSIONS (top right column: EXACTLY FOUR small labelled heads stacked vertically, make them smaller so all four fit; hood up in all; each label under or beside its own head): "Composed" (small polite smile, calm tired eyes), "Quiet Pain" (eyes lowered and half-closed, lips pressed, no tears), "Honest Fear" (eyes wide and glistening, brows raised and drawn together, lips parted), "Warm" (a real smile that reaches her eyes).

CENTRE: "Idle Pose" and "Spellcasting Pose" (the bell held out on its chain, the thorn clapper perfectly still, pale lilac crystal thorns forming around it) as two full-body panels.

RIGHT COLUMN: "Bell Focus (Detail)" showing the silver bell with its long thorn clapper; "Family Pins (Detail)" showing the broken crown fragment and the tiny bell hairpin side by side; "Materials" swatches labelled Wool (mantle), Fabric (dress), Leather (gloves, straps), Metal (silver), Embroidery, Glass / Crystal (veil effect).

MIDDLE BAND: "Turnaround" front, side, back labelled "Front" "Side" "Back"; "Color Palette" six round swatches; "Chibi / Battle Sprite" four chibi figures OF FADYME ONLY (no other character) drawn in the game's battle style: about 2.5 heads tall, adult face, bold uneven black ink outlines, flat cel shading in three tones, a few bold hatch strokes in the deepest shadows, strong silhouette with an exaggerated hood and mantle; poses idle, casting, guard, victory; each on its own plain parchment square.

STORY STATE VARIATIONS (bottom band, four labelled panels): "Early Signs" (a bare pale hand, cold fingers), "After Spellcasting" (a small blood spot hidden in the fold of the white scarf), "Hiding the White Lock" (one bone-white lock tucked under the hood), "Late Story" (thin black-gold lines on her fingers spreading past the wrist; she closes her fist).

MOOD & ATMOSPHERE strip: a rainy ash forest with a wayshrine, a flooded cathedral nave, a letter written by one candle, a crater altar under a black eclipse with a thin crimson ring.

Bottom right: large VN bust, chest-up, three-quarter view, hood up, bell chain in one gloved hand, a small polite smile, on a soft dark painted vignette.
```

**Negative:**
```
three expressions, missing Warm expression, Mahmut, knight, man, blood on the hero pose, tiara, whole crown, cel shading, flat colours, cartoon, game title, logo, watermark, extra text, misspelled labels, red eyes, red hood, black-red hood, dark hair, short hair, hood down, bare shoulders, cleavage, low neckline, pin-up, other characters, blood beyond one small spot, gore, crimson fill, curse marks outside the story-state panels, moire, micro-texture, film grain, 3D render, photorealism, extra fingers, duplicated character in turnaround
```

**Metadata:**
```
id: fadyme
kind: sheet
mode: narrative
variant: r2
reference files: art/sheets/char-fadyme-uomd.png (current) + art/brand/brand_key_art_portrait_r2_v003.png (approved)
key colour: opaque
native size: 1024x1536
intended runtime size: reference only
ORDER_LEVEL: n/a
revision: v002
date: 2026-09-30
```

## R04. VN bust — composed

```
The first attached image is THIS character's approved model sheet. Match her face, hair, costume, palette and weapon exactly; ignore the sheet's layout, labels, text, background and story-state panels. VN dialogue bust of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Dark, moody, semi-realistic painterly anime illustration matching the approved key art and sheet: rich layered brushwork, soft painterly edges, heavy chiaroscuro with one cold rim light, desaturated palette close to black; not cel-shaded, not cartoon. Keep large areas calm with detail only at the face, hands and bell; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face and one gloved hand holding the bell chain near her collarbone all within the upper 70% of the image; the bottom quarter is visually calm (only the plain lower mantle). Hood up, hair falling forward over the shoulder nearest the viewer. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; no curse marks, no blood. EXPRESSION composed: a small polite smile, eyes calm with quiet fatigue.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, dark hair, black hair, brown hair, hood down, bare shoulders, cleavage, low neckline, pin-up framing, chest crop, hip crop, curse marks, black veins, white hair streak, blood, gore, moire, mesh pattern, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, crying, tears
```

**Metadata:**
```
id: fadyme
kind: vn_bust
mode: narrative
variant: composed
reference files: art/sheets/char-fadyme-uomd.png (r2)
key colour: #00FF00
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```

## R05. VN bust — quiet_pain

```
The first attached image is THIS character's approved model sheet. Match her face, hair, costume, palette and weapon exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is her approved composed bust: copy its pose, camera, framing, hairline, hood and hand position exactly and change only the face. VN dialogue bust of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Dark, moody, semi-realistic painterly anime illustration matching the approved key art and sheet: rich layered brushwork, soft painterly edges, heavy chiaroscuro with one cold rim light, desaturated palette close to black; not cel-shaded, not cartoon. Keep large areas calm with detail only at the face, hands and bell; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face and one gloved hand holding the bell chain near her collarbone all within the upper 70% of the image; the bottom quarter is visually calm (only the plain lower mantle). Hood up, hair falling forward over the shoulder nearest the viewer. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; no curse marks, no blood. EXPRESSION quiet_pain: eyes half-closed and lowered, brows slightly drawn, lips pressed together in a straight line; dry eyes; no smile at all. She is holding pain in, not crying.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, dark hair, black hair, brown hair, hood down, bare shoulders, cleavage, low neckline, pin-up framing, chest crop, hip crop, curse marks, black veins, white hair streak, blood, gore, moire, mesh pattern, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, smiling
```

**Metadata:**
```
id: fadyme
kind: vn_bust
mode: narrative
variant: quiet_pain
reference files: art/sheets/char-fadyme-uomd.png (r2) + vn_bust_fadyme_composed (approved)
key colour: #00FF00
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v002
date: 2026-09-30
```

## R06. VN bust — honest_fear

```
The first attached image is THIS character's approved model sheet. Match her face, hair, costume, palette and weapon exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is her approved composed bust: copy its pose, camera, framing, hairline, hood and hand position exactly and change only the face. VN dialogue bust of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Dark, moody, semi-realistic painterly anime illustration matching the approved key art and sheet: rich layered brushwork, soft painterly edges, heavy chiaroscuro with one cold rim light, desaturated palette close to black; not cel-shaded, not cartoon. Keep large areas calm with detail only at the face, hands and bell; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face and one gloved hand holding the bell chain near her collarbone all within the upper 70% of the image; the bottom quarter is visually calm (only the plain lower mantle). Hood up, hair falling forward over the shoulder nearest the viewer. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; no curse marks, no blood. EXPRESSION honest_fear: eyes widened and glistening, brows raised and drawn together, lips parted.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, dark hair, black hair, brown hair, hood down, bare shoulders, cleavage, low neckline, pin-up framing, chest crop, hip crop, curse marks, black veins, white hair streak, blood, gore, moire, mesh pattern, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, smiling, tears on the cheeks
```

**Metadata:**
```
id: fadyme
kind: vn_bust
mode: narrative
variant: honest_fear
reference files: art/sheets/char-fadyme-uomd.png (r2) + vn_bust_fadyme_composed (approved)
key colour: #00FF00
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```

## R07. VN bust — warm

```
The first attached image is THIS character's approved model sheet. Match her face, hair, costume, palette and weapon exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is her approved composed bust: copy its pose, camera, framing, hairline, hood and hand position exactly and change only the face. VN dialogue bust of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Dark, moody, semi-realistic painterly anime illustration matching the approved key art and sheet: rich layered brushwork, soft painterly edges, heavy chiaroscuro with one cold rim light, desaturated palette close to black; not cel-shaded, not cartoon. Keep large areas calm with detail only at the face, hands and bell; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face and one gloved hand holding the bell chain near her collarbone all within the upper 70% of the image; the bottom quarter is visually calm (only the plain lower mantle). Hood up, hair falling forward over the shoulder nearest the viewer. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; no curse marks, no blood. EXPRESSION warm: a real, open smile that reaches her eyes, eyes slightly narrowed with warmth, brows relaxed, the fatigue still faintly there; softer and more genuine than the composed polite smile, not a laugh.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, dark hair, black hair, brown hair, hood down, bare shoulders, cleavage, low neckline, pin-up framing, chest crop, hip crop, curse marks, black veins, white hair streak, blood, gore, moire, mesh pattern, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, crying, tears, open-mouthed laugh, sad eyes
```

**Metadata:**
```
id: fadyme
kind: vn_bust
mode: narrative
variant: warm
reference files: art/sheets/char-fadyme-uomd.png (r2) + vn_bust_fadyme_composed (approved)
key colour: #00FF00
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```

## R08. Battle pose — idle

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is the chibi study from the same sheet: match its short chibi body proportions and silhouette, rendered in the ink style described below. Single full-body chibi battle sprite of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (costume, hairstyle, composed adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated hood and mantle shapes, angular cloth folds, heavy shadow masses. Limited desaturated palette of plum, black, silver and white plus ONE accent: pale lilac-violet. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes with at most a few embroidery strokes; the costume clean and intact. Pose idle: standing relaxed, weight on one foot, both gloved hands holding the silver bell chain in front of her, the bell hanging still, hood up, calm small smile. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; no curse marks.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, lace micro-detail, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, dark hair, hood down, bare skin, curse marks, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet
```

**Metadata:**
```
id: fadyme
kind: battle_pose
mode: play
variant: idle
reference files: art/sheets/char-fadyme-uomd.png + art/sheets/chibi_ref/chibi_ref_fadyme.png
key colour: #00FF00
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v002
date: 2026-09-30
```

## R09. Battle pose — attack

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (costume, hairstyle, composed adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated hood and mantle shapes, angular cloth folds, heavy shadow masses. Limited desaturated palette of plum, black, silver and white plus ONE accent: pale lilac-violet. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes with at most a few embroidery strokes; the costume clean and intact.  DYNAMIC ACTION POSE with a silhouette clearly different from the idle reference: do not copy the idle's standing stance, copy only its proportions, costume and style. Pose attack: a big lunging step forward toward screen-right, body leaning into it, the mantle trailing behind; one arm fully extended with the bell swung out on its chain; a clearly visible small pale lilac crystal thorn shooting out of the bell mouth toward the right, fully inside the frame; focused eyes. Original notes: casting Veilglass Thorn: stepping forward, one arm thrust toward screen-right with the bell held out on its chain; the thorn clapper hangs perfectly still inside the bell; a single small lilac crystal thorn just leaving the bell mouth, fully inside the frame. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; the thorn clapper never swings; no curse marks.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, lace micro-detail, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, dark hair, hood down, bare skin, curse marks, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet
```

**Metadata:**
```
id: fadyme
kind: battle_pose
mode: play
variant: attack
reference files: art/sheets/char-fadyme-uomd.png + battle_pose_fadyme_idle (approved)
key colour: #00FF00
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v003
date: 2026-09-30
```

## R10. Battle pose — hit

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (costume, hairstyle, composed adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated hood and mantle shapes, angular cloth folds, heavy shadow masses. Limited desaturated palette of plum, black, silver and white plus ONE accent: pale lilac-violet. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes with at most a few embroidery strokes; the costume clean and intact.  DYNAMIC ACTION POSE with a silhouette clearly different from the idle reference: do not copy the idle's standing stance, copy only its proportions, costume and style. Pose hit: knocked backward away from screen-right, body bent and leaning back off balance, one foot lifted, both arms raised in front of her face to shield it, mantle whipping forward, eyes squeezed shut in pain (not crying, no hand on the mouth). Original notes: flinching back from a blow, shoulders hunched, one arm raised protectively, eyes squeezed shut, the hood still up and pressed forward by the motion; unharmed. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; no curse marks.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, lace micro-detail, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, dark hair, hood down, bare skin, curse marks, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet
```

**Metadata:**
```
id: fadyme
kind: battle_pose
mode: play
variant: hit
reference files: art/sheets/char-fadyme-uomd.png + battle_pose_fadyme_idle (approved)
key colour: #00FF00
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v003
date: 2026-09-30
```

## R11. Battle pose — skill

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (costume, hairstyle, composed adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated hood and mantle shapes, angular cloth folds, heavy shadow masses. Limited desaturated palette of plum, black, silver and white plus ONE accent: pale lilac-violet. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes with at most a few embroidery strokes; the costume clean and intact. Pose skill: casting Borrowed Hour: bell held high above her head with both hands, mantle flaring outward in angular folds, eyes closed in concentration; spell effects are a separate asset, so only a tiny lilac spark at the bell. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; the thorn clapper never swings; no curse marks.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, lace micro-detail, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, dark hair, hood down, bare skin, curse marks, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet
```

**Metadata:**
```
id: fadyme
kind: battle_pose
mode: play
variant: skill
reference files: art/sheets/char-fadyme-uomd.png + battle_pose_fadyme_idle (approved)
key colour: #00FF00
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v002
date: 2026-09-30
```

## R12. Battle pose — guard

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (costume, hairstyle, composed adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated hood and mantle shapes, angular cloth folds, heavy shadow masses. Limited desaturated palette of plum, black, silver and white plus ONE accent: pale lilac-violet. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes with at most a few embroidery strokes; the costume clean and intact.  DYNAMIC ACTION POSE with a silhouette clearly different from the idle reference: do not copy the idle's standing stance, copy only its proportions, costume and style. Pose guard: a low crouch, knees clearly bent, turned sideways to screen-right, the whole deep plum mantle pulled around her body with one arm like a round shield so it covers her from shoulder to knee, the bell clutched to her chest inside it, only her watchful eyes and the crown fragment visible over the mantle's edge. Original notes: defensive stance, mantle wrapped around her body like a shield, bell pressed to her chest, knees slightly bent, watchful eyes. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; no curse marks.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, lace micro-detail, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, dark hair, hood down, bare skin, curse marks, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet
```

**Metadata:**
```
id: fadyme
kind: battle_pose
mode: play
variant: guard
reference files: art/sheets/char-fadyme-uomd.png + battle_pose_fadyme_idle (approved)
key colour: #00FF00
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v003
date: 2026-09-30
```

## R13. Battle pose — victory

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (costume, hairstyle, composed adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated hood and mantle shapes, angular cloth folds, heavy shadow masses. Limited desaturated palette of plum, black, silver and white plus ONE accent: pale lilac-violet. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes with at most a few embroidery strokes; the costume clean and intact. Pose victory: bell lowered at her side, free hand over her heart, a tired but sincere small smile; the hood has slipped back just enough to show more pale hair and the tiny silver bell hairpin clearly. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; the hood slips back only partly, never fully down; no curse marks.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, lace micro-detail, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, dark hair, hood down, bare skin, curse marks, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet
```

**Metadata:**
```
id: fadyme
kind: battle_pose
mode: play
variant: victory
reference files: art/sheets/char-fadyme-uomd.png + battle_pose_fadyme_idle (approved)
key colour: #00FF00
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v002
date: 2026-09-30
```

## R14. Ultimate cut-in — The Bell That Forgets

```
The first attached image is Fadyme's approved model sheet: match her face, hair, hood, mantle, gloves and bell exactly; ignore its layout and text. Ultimate skill cut-in illustration for "The Bell That Forgets". Dark, moody, semi-realistic painterly anime illustration matching the approved key art: rich layered brushwork, heavy chiaroscuro, near-black desaturated palette with the lilac light as the only bright colour; not cel-shaded, not cartoon. Vertical 2:3 portrait composition for a portrait-only phone game: the face and the bell inside the central band between 20% and 75% of the height, nothing important within 8% of the left and right edges. A three-quarter shot of Fadyme from the waist up on a strong diagonal, hood up and pushed back by wind, one gloved hand raising the silver bell toward the viewer, the long thorn clapper perfectly still while the bell rings: pale lilac-violet rings of light spread from its mouth, and pale ash-like flakes and faint written names dissolve into the light around her. Her face is calm and resolved, eyes half-lidded, the tired smile gone. Background: deep plum darkness with a soft lilac glow, no scenery. Palette: plum, black, silver, white, pale lilac-violet light. No crimson. No text, letters, logos, watermarks, signatures or UI; the faint names are abstract strokes, never readable letters.
```

**Negative:**
```
text, readable letters, logo, watermark, UI, red eyes, red hood, dark hair, hood down, clapper swinging, crimson, blood, gore, curse marks, bare shoulders, cleavage, pin-up framing, extra fingers, second character, moire, micro-texture, film grain
```

**Metadata:**
```
id: fadyme
kind: cut_in
mode: narrative
variant: ultimate
reference files: art/sheets/char-fadyme-uomd.png (r2, approved)
key colour: opaque
native size: 1024x1536
intended runtime size: 768x1152 portrait (ART_BIBLE: ultimate cut-in reuses the portrait master)
ORDER_LEVEL: n/a
revision: v002
date: 2026-09-30
```

## R15. Chapter 1 background — ordered

```
Chapter 1 location, Whispering Ash Forest, ORDER_LEVEL ordered: a damp overgrown forest of layered mossy and dark pine greens under a pale ash-grey canopy of ash trees whose pale leaves look like drifting ash; soft rain and light low mist; a clear narrow muddy road winding into the distance; old trunks with names carved into the bark, the carvings crisp but drawn only as abstract marks, never letters; at mid-distance a small old stone roadside wayshrine that the Church has left behind but one old keeper still tends: weathered stone, a swept doorstep, a small empty bell niche under its eave, one shuttered lantern; the distant spire of a gothic cathedral bell tower rising above the treeline; one warm camp-light glowing among the trees on the left side. No characters, no animals in focus. Dark, moody, semi-realistic painterly anime illustration matching the approved key art and sheet: rich layered brushwork, soft painterly edges, heavy chiaroscuro with one cold rim light, desaturated palette close to black; not cel-shaded, not cartoon. Keep large areas calm with detail only at the focal point (the wayshrine and the road); no micro-texture, no film grain. Vertical 1024x1536 composition; all important content, including the wayshrine and the camp-light, inside the centre 84% of the width because the sides will be cropped; the lower third calmer and darker (plain road and undergrowth) to sit under a dialogue box. Opaque image, no key colour. No text, logos, watermarks, signatures or UI in the image.
```

**Negative:**
```
text, letters, readable words, logo, watermark, UI, characters, people, silhouettes of people, ruined shrine, collapsed roof, crimson, red glow, blood, eclipse, moire, micro-texture, film grain, busy lower third, important details at the side edges
```

**Metadata:**
```
id: forest_whispering_ash
kind: bg
mode: narrative
variant: ordered
reference files: none (location brief only; art/brand/superseded/key_art_wide.png is off-model brand art, CC-12, do not attach)
key colour: opaque
native size: 1024x1536
intended runtime size: 1080x1920
ORDER_LEVEL: ordered
revision: v001
date: 2026-09-30
```

## R16. Chapter 1 battle plate — ordered

```
The attached image is the approved ordered background of this location: keep its forest, road, wayshrine, bell tower, palette and light. Battle plate variant of the same location. Chapter 1 location, Whispering Ash Forest, ORDER_LEVEL ordered: a damp overgrown forest of layered mossy and dark pine greens under a pale ash-grey canopy of ash trees whose pale leaves look like drifting ash; soft rain and light low mist; a clear narrow muddy road winding into the distance; old trunks with names carved into the bark, the carvings crisp but drawn only as abstract marks, never letters; at mid-distance a small old stone roadside wayshrine that the Church has left behind but one old keeper still tends: weathered stone, a swept doorstep, a small empty bell niche under its eave, one shuttered lantern; the distant spire of a gothic cathedral bell tower rising above the treeline; one warm camp-light glowing among the trees on the left side. No characters, no animals in focus. Dark, moody, semi-realistic painterly anime illustration matching the approved key art and sheet: rich layered brushwork, soft painterly edges, heavy chiaroscuro with one cold rim light, desaturated palette close to black; not cel-shaded, not cartoon. Keep large areas calm with detail only at the focal point (the wayshrine and the road); no micro-texture, no film grain. Vertical 1024x1536; the camera looks down the road into an open forest clearing; the middle 40% of the image height is that clearing itself, painted as part of the scene (NOT an overlay, NOT a translucent rectangle, NOT a stripe): pale trampled earth and flat grass lit by soft mist and the warm camp-light, lighter in value than the rest of the picture, with nothing standing in it; only the top and bottom edges and the far sides are darkened, so thick dark ink outlines of units remain visible against the band. Unit rows are empty. Opaque image. No text, logos, watermarks, signatures or UI in the image.
```

**Negative:**
```
translucent rectangle, overlay band, grey stripe, UI panel, text, logo, watermark, UI, characters, units, people, creatures, objects in the middle band, dark middle band, crimson, blood, moire, micro-texture, film grain
```

**Metadata:**
```
id: forest_whispering_ash
kind: bg
mode: narrative
variant: battle_plate_ordered
reference files: bg_forest_whispering_ash_ordered (approved)
key colour: opaque
native size: 1024x1536
intended runtime size: 1080x1920
ORDER_LEVEL: ordered
revision: v002
date: 2026-09-30
```

## R17. Icon set — pilot mixed 16

```
Icon set of 16 game item icons for a dark fantasy RPG. Gritty 2D ink style: bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: bold simple shapes, few details, heavy shadow masses, each object readable at 64 px. Desaturated neutral base colours with exactly ONE accent colour per icon as listed. 1024x1024 image, a regular 4x4 grid read left-to-right, top-to-bottom, with wide empty gaps so no icon touches another; one centred object per cell, same scale and same three-quarter top-down angle for all. Cells: 1 weapon (weapon_mahmut_signature): a long straight arming sword (clearly a sword, long blade, not a dagger) whose round hilt crest socket is plugged with a plain iron disc (accent: steel blue); 2 weapon (weapon_fadyme_signature): a small silver bell on a chain with a long thorn-shaped clapper (accent: pale lilac); 3 armor (Padded Roadcoat): a road-worn padded travel coat folded upright (accent: warm brown); 4 accessory (Ash-Maw Hide Necklace): a rough cord of ash-grey beast hide with a single blackened fang pendant (accent: ember orange); 5 supply (ration): a small loaf of travel bread tied to a leather water flask (accent: pale wheat); 6 material (iron_oath_seal): an iron wax-seal disc stamped with a star (accent: iron grey); 7 material (alchemy_core): a glowing amber distilled alchemy core in a brass cage, the glass is clear amber with no green at all (accent: amber); 8 material (bellglass_shard): a curved shard of pale bell-glass (accent: pale gold); 9 material (blacksmith_rivet): a single heavy blacksmith rivet (accent: copper); 10 material (torn_chronicle_page): a torn chronicle page with a ragged edge, lines suggested but no letters (accent: parchment); 11 material (hymn_leaves): two pressed brown-gold hymn leaves tied with thread (accent: gold); 12 material (memory_shard): a small faceted crystal with a warm light inside (accent: soft white); 13 currency (eclipse_token): a dark coin stamped with an eclipsed black sun circled by a thin crimson ring (accent: crimson, omen); 14 currency (fates_thread): a single strand of silver thread tied in one loose knot (accent: silver); 15 currency (silver_crowns): three stacked silver coins, each stamped with a small crown (accent: silver-blue); 16 skill (Borrowed Hour): a round skill emblem, a bell above a small hourglass (accent: lilac). Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image.
```

**Negative:**
```
text, numbers, letters, labels, frames, borders around icons, grid lines, touching icons, overlapping icons, green objects, green accents, glow, soft outline, gradient, painterly blending, micro-texture, film grain, blood, gore, characters, hands
```

**Metadata:**
```
id: pilot_mixed
kind: icons
mode: play
variant: 16_mixed
reference files: art/sheets/char-fadyme-uomd.png, art/sheets/char-mahmut-uomd.png (weapon shapes)
key colour: #00FF00 (no green accents used)
native size: 1024x1024
intended runtime size: 128 px per icon
ORDER_LEVEL: n/a
revision: v002
date: 2026-09-30
```

---

# Music (Lyria)

Fadyme's theme = the composed motif (`audio/music/motifs/motif_fadyme_theme_minor.mid`, D minor, 3/4, 72 BPM) played solo as an intro, then the Lyria bed (R18) in the same key and tempo; the major, resolved version is used at ch4_camp. The Ledger motif (`motif_ledger_seven_bells.mid`) is final as composed; it is layered, not generated.

## R18. bgm_fadyme_theme

```
BED for Fadyme's theme: D minor, 72 BPM, 3/4 time. Felt piano playing soft broken-chord arpeggios, low solo cello holding the bass, one small high bell every eight bars. Chord loop: Dm, Dm/C, Bb, A, Dm, Bb, Gm, A (never resolves to D at the end). Leave the upper register empty: a melody will be laid on top later. Tender, tired, composed, a smile that hides something. Original instrumental soundtrack cue for a dark-fantasy story game: restrained, cinematic, acoustic orchestra, gothic but intimate. Instrumental only, no vocals, no lyrics. No drums unless stated. Clean studio mix, no vinyl noise, no lo-fi effects. About 1 minute 45 seconds. Loopable: no fade-out; the last bar leads back into the first bar in the same key and tempo.
```

**Negative:**
```
vocals, lyrics, singing words, rap, EDM drops, dubstep, modern pop drums, electric guitar solos, lo-fi, vinyl crackle, fade-out ending, sudden stop
```

**Metadata:**
```
id: bgm_fadyme_theme
kind: music
mode: n/a
variant: main
reference files: audio/music/motifs (key/tempo match)
key colour: n/a
native size: 1 minute 45 seconds
intended runtime size: loop in game (lyria-3.5)
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
wave: 0
```

## R19. bgm_ch1_ash_forest_calm

```
Location: a rainy ash forest road at grey dawn. E minor, 66 BPM. Sparse harp and nylon guitar, soft woodwind (alto flute), string pad, rain-like light percussion on wood. Quiet, damp, whispering, a long road ahead. Original instrumental soundtrack cue for a dark-fantasy story game: restrained, cinematic, acoustic orchestra, gothic but intimate. Instrumental only, no vocals, no lyrics. No drums unless stated. Clean studio mix, no vinyl noise, no lo-fi effects. About 2 minutes. Loopable: no fade-out; the last bar leads back into the first bar in the same key and tempo.
```

**Negative:**
```
vocals, lyrics, singing words, rap, EDM drops, dubstep, modern pop drums, electric guitar solos, lo-fi, vinyl crackle, fade-out ending, sudden stop
```

**Metadata:**
```
id: bgm_ch1_ash_forest_calm
kind: music
mode: n/a
variant: calm
reference files: audio/music/motifs (key/tempo match)
key colour: n/a
native size: 2 minutes
intended runtime size: loop in game (lyria-3.5)
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
wave: 0
```

## R20. bgm_ch1_ash_forest_uneasy

```
Same place as the calm forest cue, same key (E minor) and tempo (66 BPM), same instruments, but uneasy: the pad detunes slightly, low bowed bass notes, a single cracked bell tone far away, the guitar pattern hesitates. Built to crossfade with the calm version. Original instrumental soundtrack cue for a dark-fantasy story game: restrained, cinematic, acoustic orchestra, gothic but intimate. Instrumental only, no vocals, no lyrics. No drums unless stated. Clean studio mix, no vinyl noise, no lo-fi effects. About 2 minutes. Loopable: no fade-out; the last bar leads back into the first bar in the same key and tempo.
```

**Negative:**
```
vocals, lyrics, singing words, rap, EDM drops, dubstep, modern pop drums, electric guitar solos, lo-fi, vinyl crackle, fade-out ending, sudden stop
```

**Metadata:**
```
id: bgm_ch1_ash_forest_uneasy
kind: music
mode: n/a
variant: uneasy
reference files: audio/music/motifs (key/tempo match)
key colour: n/a
native size: 2 minutes
intended runtime size: loop in game (lyria-3.5)
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
wave: 0
```

## R21. bgm_ch1_ash_forest_chaotic

```
Same place, same key (E minor) and tempo (66 BPM), now chaotic: low string tremolo, dissonant brass swells held back, frame drum pulses, the far bell tolls irregularly. Still recognisably the forest cue. Built to crossfade with the uneasy version. Original instrumental soundtrack cue for a dark-fantasy story game: restrained, cinematic, acoustic orchestra, gothic but intimate. Instrumental only, no vocals, no lyrics. No drums unless stated. Clean studio mix, no vinyl noise, no lo-fi effects. About 2 minutes. Loopable: no fade-out; the last bar leads back into the first bar in the same key and tempo.
```

**Negative:**
```
vocals, lyrics, singing words, rap, EDM drops, dubstep, modern pop drums, electric guitar solos, lo-fi, vinyl crackle, fade-out ending, sudden stop
```

**Metadata:**
```
id: bgm_ch1_ash_forest_chaotic
kind: music
mode: n/a
variant: chaotic
reference files: audio/music/motifs (key/tempo match)
key colour: n/a
native size: 2 minutes
intended runtime size: loop in game (lyria-3.5)
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
wave: 0
```

## R22. bgm_battle_field

```
Fast, energetic standard battle music: C minor, 132 BPM, 4/4, full tempo from the very first second, no slow intro. Relentless eighth-note ostinato in low strings and cellos, frame drums and taiko on every beat, staccato brass stabs on the off-beats, a bold, memorable heroic melody on horns over the top; gothic, grim but heroic and urgent, a mobile RPG field battle that stays exciting on repeat. Original instrumental soundtrack cue for a dark-fantasy story game: cinematic acoustic orchestra with percussion. Instrumental only, no vocals, no lyrics. Clean studio mix, no vinyl noise, no lo-fi effects. About 1 minute 45 seconds at constant tempo and full energy. Loopable: no fade-out, no ritardando; the last bar leads back into the first bar in the same key and tempo.
```

**Negative:**
```
vocals, lyrics, singing words, rap, EDM drops, dubstep, modern pop drums, electric guitar solos, lo-fi, vinyl crackle, fade-out ending, sudden stop, slow tempo, ambient pad intro, ritardando, half-time feel
```

**Metadata:**
```
id: bgm_battle_field
kind: music
mode: n/a
variant: main
reference files: audio/music/motifs (key/tempo match)
key colour: n/a
native size: 1 minute 45 seconds
intended runtime size: loop in game (lyria-3.5)
ORDER_LEVEL: n/a
revision: v002
date: 2026-09-30
wave: 0
```

---

# Voice (Gemini TTS) — R23 Fadyme

**Step 1 — voice search.** The audition line below, read by each of the 30 prebuilt voices with the style sentence (cost: cents). The Director shortlists four.
**Step 2 — audition.** The four candidates read all five audition lines. The owner chooses one voice.
**Step 3 — production.** Her full Japanese script (`audio/voice/jp_script_fadyme.json`, all story, inner-voice and battle lines, about 230) is drafted, then every line is recorded with the chosen voice and reviewed by the Director; the owner approves the set.

**Style sentence (every line):** a young adult woman in her early twenties; light, controlled alto; soft, courteous and precise; quiet warmth and tiredness under the politeness; dry, dark humour; never theatrical, never childish; she hides pain by speaking a little more evenly. Inner-voice lines: closer, softer, almost a breath.

| # | line_id | English | Japanese (draft) | Direction |
|---|---|---|---|---|
| 1 | opening_001 (inner) | If I wake before the bell tomorrow, I will call it luck. If I do not... Mahmut must never read this page. | 明日、鐘より先に目が覚めたなら……運が良かったと思うことにする。もし覚めなかったら……マフムトには、このページを決して読ませない。 | inner voice, frightened, very quiet |
| 2 | node_5_4_post_001 | Only tired. The wind is colder here. | ……少し疲れただけ。ここは、風が冷たいのね。 | false calm, too even |
| 3 | ch5_road_004 | Then she had better keep her hood up. | なら、その人はフードを下ろさないほうがいいわね。 | wry, a small private smile |
| 4 | node_7_2_post_003 | When this is over, I want to hear every detail of that barricade. | 全部終わったら、そのバリケードの話、ひとつ残らず聞かせて。 | warm, genuinely amused |
| 5 | confession_008 | You still do not understand. I am dying, Mahmut. The curse is taking my hours one by one. | まだ分かってないのね。私は死ぬの、マフムト。呪いが、私の時間をひとつずつ奪っていくの。 | tearful, the mask finally breaking, no shouting |

Name readings: ファディメ, マフムト (glossary in `docs/AUDIO_VO_PLAN_PART1.md` §2.4). The Japanese is a draft for a native editor's review before final recording.
