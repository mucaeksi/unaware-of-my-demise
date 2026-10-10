# Pilot — Fadyme (prompt revision r2, 2026-09-30; APPROVED FOR PRODUCTION by the Narrative & Visual Director)

**Later batch (not in this one):** curse story-state busts (blood on the scarf from 3-3, the late-story hand marks at 7-5). They wait for the curse-colour decision (audit CC-11) and a technical answer on how a scene requests a story-state bust.

Files: vn_bust_fadyme_{composed,quiet_pain,honest_fear,warm}_v001.png · battle_pose_fadyme_{idle,attack,hit,skill,guard,victory}_v001.png · bg_forest_whispering_ash_ordered_v001.png · bg_forest_whispering_ash_battle_plate_ordered_v001.png · icons_pilot_mixed_v001.png

**Generation order (matters):** 1 composed bust → approve → 2, 3 and 3b with the composed bust attached as a second reference. 4 idle pose (attach the sheet + `art/sheets/chibi_ref/chibi_ref_fadyme.png`) → approve → 5–9 with the idle attached. Each group in a new chat.

**Batch 1 result (2026-09-30):** busts composed, warm, honest_fear APPROVED (`art/production/fadyme/`); quiet_pain rejected (regenerate v002); all six poses rejected (not chibi) → prompts rewritten as chibi sprites (v002); backgrounds and icons rejected (they do not follow prompts 10–12; regenerate in fresh chats). 10 background → approve → 11 with it attached. 12 is independent.

**Script emotion → bust (runtime mapping request for the technical team; 155 Fadyme lines checked, `fadyme_thought` lines use no bust):**

| Bust | `emotion` values in the script |
|---|---|
| `composed` (default, also her mask) | quiet, soft, gentle, curious, deflecting, light, steady, small_smile, soft_smile, controlled, wry, dry, dry_amusement, composed, focused, guarded, firm, false_reassurance, false_calm, knowing, kind, cold, perceptive, defiant, observant, wary, sharp, careful, serious, honest, and any unlisted value |
| `warm` | warm, amused, laughing, smile, smiling, relieved, touched, hopeful, encouraging |
| `quiet_pain` | strained, weak_smile, pained_smile, weak_laugh, low, sad, fragile, vulnerable, wistful |
| `honest_fear` | tearful, uneasy, stunned, breathless, pleading, breaking, disbelief, afraid |

The mask lines (deflecting, false_reassurance, false_calm) stay on `composed` on purpose: the player sees the smile, the text says otherwise. `warm` is the real smile, kept apart from the polite one so her joy scenes read as joy (fadyme.md risk note: she must not be only tragic).

**r2 changes (narrative review of r1, decision C40):** bell hairpin added (VIS-03); crown fragment placed where the sheet shows it (front edge of the hood); dress embroidery named; explicit second-reference sentence for expressions and poses; attack no longer swings the clapper (weapon lore); hit keeps the hood up; background wayshrine is tended, not ruined (ch1_first_oath has a keeper), camp-light moved inside the crop-safe area, off-model brand art removed as reference; icons use existing item IDs (potion placeholder → `ration`; accessory → Ash-Maw Hide Necklace without a bell shard, world rule 7), Fate's Thread and Silver Crowns follow `docs/BRAND_MARKS_AND_ICON_GUIDE.md`. r1 is archived at `archive/2026-09-30_pilot_r1/pilot_fadyme_r1.md`.

## 1. VN bust — composed

```
The first attached image is THIS character's approved model sheet. Match her face, hair, costume, palette and weapon exactly; ignore the sheet's layout, labels, text, background and story-state panels. VN dialogue bust of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face and one gloved hand holding the bell chain near her collarbone all within the upper 70% of the image; the bottom quarter is visually calm (only the plain lower mantle). Hood up, hair falling forward over the shoulder nearest the viewer. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; no curse marks, no blood. EXPRESSION composed: a small polite smile, eyes calm with quiet fatigue.
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
reference files: art/sheets/char-fadyme-uomd.png
key colour: #00FF00
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 2. VN bust — quiet_pain

```
The first attached image is THIS character's approved model sheet. Match her face, hair, costume, palette and weapon exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is her approved composed bust: copy its pose, camera, framing, hairline, hood and hand position exactly and change only the face. VN dialogue bust of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face and one gloved hand holding the bell chain near her collarbone all within the upper 70% of the image; the bottom quarter is visually calm (only the plain lower mantle). Hood up, hair falling forward over the shoulder nearest the viewer. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; no curse marks, no blood. EXPRESSION quiet_pain: eyes half-closed and lowered, brows slightly drawn, lips pressed together in a straight line; dry eyes; no smile at all. She is holding pain in, not crying.
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
reference files: art/sheets/char-fadyme-uomd.png + vn_bust_fadyme_composed (approved)
key colour: #00FF00
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v002
date: 2026-09-30
```


## 3. VN bust — honest_fear

```
The first attached image is THIS character's approved model sheet. Match her face, hair, costume, palette and weapon exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is her approved composed bust: copy its pose, camera, framing, hairline, hood and hand position exactly and change only the face. VN dialogue bust of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face and one gloved hand holding the bell chain near her collarbone all within the upper 70% of the image; the bottom quarter is visually calm (only the plain lower mantle). Hood up, hair falling forward over the shoulder nearest the viewer. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; no curse marks, no blood. EXPRESSION honest_fear: eyes widened and glistening, brows raised and drawn together, lips parted.
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
reference files: art/sheets/char-fadyme-uomd.png + vn_bust_fadyme_composed (approved)
key colour: #00FF00
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 3b. VN bust — warm

```
The first attached image is THIS character's approved model sheet. Match her face, hair, costume, palette and weapon exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is her approved composed bust: copy its pose, camera, framing, hairline, hood and hand position exactly and change only the face. VN dialogue bust of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face and one gloved hand holding the bell chain near her collarbone all within the upper 70% of the image; the bottom quarter is visually calm (only the plain lower mantle). Hood up, hair falling forward over the shoulder nearest the viewer. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; no curse marks, no blood. EXPRESSION warm: a real, open smile that reaches her eyes, eyes slightly narrowed with warmth, brows relaxed, the fatigue still faintly there; softer and more genuine than the composed polite smile, not a laugh.
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
reference files: art/sheets/char-fadyme-uomd.png + vn_bust_fadyme_composed (approved)
key colour: #00FF00
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```



## 4. Battle pose — idle

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


## 5. Battle pose — attack

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (costume, hairstyle, composed adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated hood and mantle shapes, angular cloth folds, heavy shadow masses. Limited desaturated palette of plum, black, silver and white plus ONE accent: pale lilac-violet. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes with at most a few embroidery strokes; the costume clean and intact. Pose attack: casting Veilglass Thorn: stepping forward, one arm thrust toward screen-right with the bell held out on its chain; the thorn clapper hangs perfectly still inside the bell; a single small lilac crystal thorn just leaving the bell mouth, fully inside the frame. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; the thorn clapper never swings; no curse marks.
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
revision: v002
date: 2026-09-30
```


## 6. Battle pose — hit

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (costume, hairstyle, composed adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated hood and mantle shapes, angular cloth folds, heavy shadow masses. Limited desaturated palette of plum, black, silver and white plus ONE accent: pale lilac-violet. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes with at most a few embroidery strokes; the costume clean and intact. Pose hit: flinching back from a blow, shoulders hunched, one arm raised protectively, eyes squeezed shut, the hood still up and pressed forward by the motion; unharmed. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; no curse marks.
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
revision: v002
date: 2026-09-30
```


## 7. Battle pose — skill

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


## 8. Battle pose — guard

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Fadyme, an adult woman (22), slender and composed, gentle fatigue in her eyes; long pale ash-blonde hair falling from under a deep plum hood; violet eyes; a small broken silver crown fragment pinned at the front edge of the hood above her brow; a deep plum layered hooded mantle with silver-lilac floral embroidery at the hems, and the same embroidery on the long skirt of a high-collared black dress; a white scarf worn high at the throat; thin dark gloves; a silver bell hanging on a chain, its clapper a long silver thorn. One detail that is not on the sheet, keep it small: a tiny silver bell-shaped hairpin in the pale hair at the side of her face, half hidden by the hood's edge. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (costume, hairstyle, composed adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated hood and mantle shapes, angular cloth folds, heavy shadow masses. Limited desaturated palette of plum, black, silver and white plus ONE accent: pale lilac-violet. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes with at most a few embroidery strokes; the costume clean and intact. Pose guard: defensive stance, mantle wrapped around her body like a shield, bell pressed to her chest, knees slightly bent, watchful eyes. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always pale ash-blonde; hood up; no curse marks.
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
revision: v002
date: 2026-09-30
```


## 9. Battle pose — victory

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


## 10. Chapter 1 background — ordered

```
Chapter 1 location, Whispering Ash Forest, ORDER_LEVEL ordered: a damp overgrown forest of layered mossy and dark pine greens under a pale ash-grey canopy of ash trees whose pale leaves look like drifting ash; soft rain and light low mist; a clear narrow muddy road winding into the distance; old trunks with names carved into the bark, the carvings crisp but drawn only as abstract marks, never letters; at mid-distance a small old stone roadside wayshrine that the Church has left behind but one old keeper still tends: weathered stone, a swept doorstep, a small empty bell niche under its eave, one shuttered lantern; the distant spire of a gothic cathedral bell tower rising above the treeline; one warm camp-light glowing among the trees on the left side. No characters, no animals in focus. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; no micro-texture, no film grain. Vertical 1024x1536 composition; all important content, including the wayshrine and the camp-light, inside the centre 84% of the width because the sides will be cropped; the lower third calmer and darker (plain road and undergrowth) to sit under a dialogue box. Opaque image, no key colour. No text, logos, watermarks, signatures or UI in the image.
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


## 11. Chapter 1 battle plate — ordered

```
The attached image is the approved ordered background of this location: keep its forest, road, wayshrine, bell tower, palette and light. Battle plate variant of the same location. Chapter 1 location, Whispering Ash Forest, ORDER_LEVEL ordered: a damp overgrown forest of layered mossy and dark pine greens under a pale ash-grey canopy of ash trees whose pale leaves look like drifting ash; soft rain and light low mist; a clear narrow muddy road winding into the distance; old trunks with names carved into the bark, the carvings crisp but drawn only as abstract marks, never letters; at mid-distance a small old stone roadside wayshrine that the Church has left behind but one old keeper still tends: weathered stone, a swept doorstep, a small empty bell niche under its eave, one shuttered lantern; the distant spire of a gothic cathedral bell tower rising above the treeline; one warm camp-light glowing among the trees on the left side. No characters, no animals in focus. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; no micro-texture, no film grain. Vertical 1024x1536; a horizontal band across the middle 40% of the image where units will stand is mid-to-light in value: pale trampled ground, soft mist and a faint warm glow from the camp-light, with no objects in it; only the top and bottom edges and the far sides are darkened, so thick dark ink outlines of units remain visible against the band. Unit rows are empty. Opaque image. No text, logos, watermarks, signatures or UI in the image.
```

**Negative:**
```
text, logo, watermark, UI, characters, units, people, creatures, objects in the middle band, dark middle band, crimson, blood, moire, micro-texture, film grain
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
revision: v001
date: 2026-09-30
```


## 12. Icon set — pilot mixed 16

```
Icon set of 16 game item icons for a dark fantasy RPG. Gritty 2D ink style: bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: bold simple shapes, few details, heavy shadow masses, each object readable at 64 px. Desaturated neutral base colours with exactly ONE accent colour per icon as listed. 1024x1024 image, a regular 4x4 grid read left-to-right, top-to-bottom, with wide empty gaps so no icon touches another; one centred object per cell, same scale and same three-quarter top-down angle for all. Cells: 1 weapon (weapon_mahmut_signature): a long arming sword whose round hilt crest socket is plugged with a plain iron disc (accent: steel blue); 2 weapon (weapon_fadyme_signature): a small silver bell on a chain with a long thorn-shaped clapper (accent: pale lilac); 3 armor (Padded Roadcoat): a road-worn padded travel coat folded upright (accent: warm brown); 4 accessory (Ash-Maw Hide Necklace): a rough cord of ash-grey beast hide with a single blackened fang pendant (accent: ember orange); 5 supply (ration): a small loaf of travel bread tied to a leather water flask (accent: pale wheat); 6 material (iron_oath_seal): an iron wax-seal disc stamped with a star (accent: iron grey); 7 material (alchemy_core): a glowing distilled alchemy core in a brass cage (accent: amber); 8 material (bellglass_shard): a curved shard of pale bell-glass (accent: pale gold); 9 material (blacksmith_rivet): a single heavy blacksmith rivet (accent: copper); 10 material (torn_chronicle_page): a torn chronicle page with a ragged edge, lines suggested but no letters (accent: parchment); 11 material (hymn_leaves): two pressed brown-gold hymn leaves tied with thread (accent: gold); 12 material (memory_shard): a small faceted crystal with a warm light inside (accent: soft white); 13 currency (eclipse_token): a dark coin stamped with an eclipsed black sun circled by a thin crimson ring (accent: crimson, omen); 14 currency (fates_thread): a single strand of silver thread tied in one loose knot (accent: silver); 15 currency (silver_crowns): three stacked silver coins, each stamped with a small crown (accent: silver-blue); 16 skill (Borrowed Hour): a round skill emblem, a bell above a small hourglass (accent: lilac). Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image.
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
revision: v001
date: 2026-09-30
```
