# Production prompts — Kera Voss (template C40, 2026-09-30)

**Status:** APPROVED FOR PRODUCTION (2026-09-30). Starts only after the r2 sheet is approved.

Files: vn_bust_kera_voss_{tsundere_scowl,focused,proud_smile,flustered,guilty,defiant}_v001.png · battle_pose_kera_voss_{idle,attack,hit,skill,guard,victory}_v001.png

**Prerequisite:** the r2 sheet (`prompts/sheets/kera_voss_sheet.md`) is generated, approved and saved as `art/sheets/char-kera-voss-uomd.png`. Every prompt below attaches that sheet as the first image.

**Generation order:** 1 tsundere_scowl bust → approve → 2–6 with it attached as a second reference. 7 idle pose (attach the sheet + `art/sheets/chibi_ref/chibi_ref_kera_voss.png`) → approve → 8–12 with the idle attached.

**Why six busts:** they are the six expressions on the r2 sheet, and each carries real script lines (48 Kera lines in Part I).

**Script emotion → bust (runtime mapping request for the technical team; every Kera `emotion` value is listed):**

| Bust | `emotion` values in the script |
|---|---|
| `tsundere_scowl` (default) | tsundere, impatient, annoyed, brisk, sharp, gruff, defensive, and any unlisted value |
| `focused` | focused, thoughtful, careful, serious, steady, honest |
| `proud_smile` | proud, smug, gentle |
| `flustered` | flustered |
| `guilty` | low, bitter, ashamed, stunned, breaking, tired |
| `defiant` | furious, indignant, fierce, defiant, resolved, determined |

**Poses follow her kit** (`characters_part1.json`, Ember, rear row): attack = Flask Flick, skill = Cinder Tonic (cracks a vial in the mortar, Burn). Measure Twice and Redoubt Reaction are effect assets, not poses.

**Key colour:** #00FFFF (largest hue distance from ember orange and brown).

## 1. VN bust — tsundere_scowl

```
The first attached image is THIS character's approved model sheet. Match her face, hair, hat, goggles, coat, apron, belts, brass mortar and palette exactly; ignore the sheet's layout, labels, text, background and story-state panels. VN dialogue bust of Kera Voss, an adult woman (20), petite and quick; shoulder-length messy ash-silver hair, choppy at the ends with a few singed strands; bright amber eyes; a faint soot smudge on one cheek; a very wide-brimmed, tall-crowned dark brown field hat with a sagging tip, brass goggles with round ember-orange lenses strapped around its band; a dark brown fitted field coat with a short capelet and deep orange lining, leather bracers; a high-collared cream shirt; a long cream canvas apron clean except for one scorch mark near the hem; a broad leather flask belt and a chest bandolier of stoppered vials in amber, red and smoke-grey; dark trousers, laced brown boots; an engraved brass hand mortar and pestle at her hip, and one sealed crystal vial of glowing ember liquid kept apart from the others. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light with a faint warm ember tone on her face. Keep large areas calm with detail only at the focal point; the vials are a few simple shapes, not a dense row; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; the whole hat brim, face and one hand holding the brass mortar near her chest all within the upper 70% of the image, the brim fully inside the frame; the bottom quarter is visually calm (only plain coat and apron). Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: the hat dominates her silhouette; hair shoulder-length ash-silver, never blonde or long; no hood; fire and glow are ember orange only; one scorch mark on the apron. EXPRESSION tsundere_scowl: eyes narrowed, mouth tight and a little sideways, one brow lowered; prickly, not angry; goggles on the hat band.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, hood, veil, plum, purple, lilac, violet magic, blonde hair, long hair, pure white hair, witch hat with stars, spectacles, bare shoulders, cleavage, low neckline, pin-up framing, chest crop, blood, gore, moire, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, hat cropped by the frame, smiling, crying
```

**Metadata:**
```
id: kera_voss
kind: vn_bust
mode: narrative
variant: tsundere_scowl
reference files: art/sheets/char-kera-voss-uomd.png (r2 series-style sheet, after approval)
key colour: #00FFFF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 2. VN bust — focused

```
The first attached image is THIS character's approved model sheet. Match her face, hair, hat, goggles, coat, apron, belts, brass mortar and palette exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is her approved tsundere_scowl bust: copy its pose, camera, framing, hat angle, hair and hand position exactly and change only the face (and the goggles, only where the expression says so). VN dialogue bust of Kera Voss, an adult woman (20), petite and quick; shoulder-length messy ash-silver hair, choppy at the ends with a few singed strands; bright amber eyes; a faint soot smudge on one cheek; a very wide-brimmed, tall-crowned dark brown field hat with a sagging tip, brass goggles with round ember-orange lenses strapped around its band; a dark brown fitted field coat with a short capelet and deep orange lining, leather bracers; a high-collared cream shirt; a long cream canvas apron clean except for one scorch mark near the hem; a broad leather flask belt and a chest bandolier of stoppered vials in amber, red and smoke-grey; dark trousers, laced brown boots; an engraved brass hand mortar and pestle at her hip, and one sealed crystal vial of glowing ember liquid kept apart from the others. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light with a faint warm ember tone on her face. Keep large areas calm with detail only at the focal point; the vials are a few simple shapes, not a dense row; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; the whole hat brim, face and one hand holding the brass mortar near her chest all within the upper 70% of the image, the brim fully inside the frame; the bottom quarter is visually calm (only plain coat and apron). Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: the hat dominates her silhouette; hair shoulder-length ash-silver, never blonde or long; no hood; fire and glow are ember orange only; one scorch mark on the apron. EXPRESSION focused: the goggles pulled down over her eyes, amber lenses catching light, mouth set, attention on a small vial held up in her free hand at eye level (keep the vial inside the upper 70%).
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, hood, veil, plum, purple, lilac, violet magic, blonde hair, long hair, pure white hair, witch hat with stars, spectacles, bare shoulders, cleavage, low neckline, pin-up framing, chest crop, blood, gore, moire, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, hat cropped by the frame, smiling, crying, goggles on the hat
```

**Metadata:**
```
id: kera_voss
kind: vn_bust
mode: narrative
variant: focused
reference files: art/sheets/char-kera-voss-uomd.png (r2 series-style sheet, after approval) + vn_bust_kera_voss_tsundere_scowl (approved)
key colour: #00FFFF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 3. VN bust — proud_smile

```
The first attached image is THIS character's approved model sheet. Match her face, hair, hat, goggles, coat, apron, belts, brass mortar and palette exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is her approved tsundere_scowl bust: copy its pose, camera, framing, hat angle, hair and hand position exactly and change only the face (and the goggles, only where the expression says so). VN dialogue bust of Kera Voss, an adult woman (20), petite and quick; shoulder-length messy ash-silver hair, choppy at the ends with a few singed strands; bright amber eyes; a faint soot smudge on one cheek; a very wide-brimmed, tall-crowned dark brown field hat with a sagging tip, brass goggles with round ember-orange lenses strapped around its band; a dark brown fitted field coat with a short capelet and deep orange lining, leather bracers; a high-collared cream shirt; a long cream canvas apron clean except for one scorch mark near the hem; a broad leather flask belt and a chest bandolier of stoppered vials in amber, red and smoke-grey; dark trousers, laced brown boots; an engraved brass hand mortar and pestle at her hip, and one sealed crystal vial of glowing ember liquid kept apart from the others. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light with a faint warm ember tone on her face. Keep large areas calm with detail only at the focal point; the vials are a few simple shapes, not a dense row; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; the whole hat brim, face and one hand holding the brass mortar near her chest all within the upper 70% of the image, the brim fully inside the frame; the bottom quarter is visually calm (only plain coat and apron). Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: the hat dominates her silhouette; hair shoulder-length ash-silver, never blonde or long; no hood; fire and glow are ember orange only; one scorch mark on the apron. EXPRESSION proud_smile: a confident small grin, chin slightly raised, eyes bright; goggles on the hat band.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, hood, veil, plum, purple, lilac, violet magic, blonde hair, long hair, pure white hair, witch hat with stars, spectacles, bare shoulders, cleavage, low neckline, pin-up framing, chest crop, blood, gore, moire, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, hat cropped by the frame, crying, open-mouthed laugh
```

**Metadata:**
```
id: kera_voss
kind: vn_bust
mode: narrative
variant: proud_smile
reference files: art/sheets/char-kera-voss-uomd.png (r2 series-style sheet, after approval) + vn_bust_kera_voss_tsundere_scowl (approved)
key colour: #00FFFF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 4. VN bust — flustered

```
The first attached image is THIS character's approved model sheet. Match her face, hair, hat, goggles, coat, apron, belts, brass mortar and palette exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is her approved tsundere_scowl bust: copy its pose, camera, framing, hat angle, hair and hand position exactly and change only the face (and the goggles, only where the expression says so). VN dialogue bust of Kera Voss, an adult woman (20), petite and quick; shoulder-length messy ash-silver hair, choppy at the ends with a few singed strands; bright amber eyes; a faint soot smudge on one cheek; a very wide-brimmed, tall-crowned dark brown field hat with a sagging tip, brass goggles with round ember-orange lenses strapped around its band; a dark brown fitted field coat with a short capelet and deep orange lining, leather bracers; a high-collared cream shirt; a long cream canvas apron clean except for one scorch mark near the hem; a broad leather flask belt and a chest bandolier of stoppered vials in amber, red and smoke-grey; dark trousers, laced brown boots; an engraved brass hand mortar and pestle at her hip, and one sealed crystal vial of glowing ember liquid kept apart from the others. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light with a faint warm ember tone on her face. Keep large areas calm with detail only at the focal point; the vials are a few simple shapes, not a dense row; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; the whole hat brim, face and one hand holding the brass mortar near her chest all within the upper 70% of the image, the brim fully inside the frame; the bottom quarter is visually calm (only plain coat and apron). Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: the hat dominates her silhouette; hair shoulder-length ash-silver, never blonde or long; no hood; fire and glow are ember orange only; one scorch mark on the apron. EXPRESSION flustered: cheeks faintly flushed, eyes glancing away to the side, lips pressed in an embarrassed pout; goggles on the hat band.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, hood, veil, plum, purple, lilac, violet magic, blonde hair, long hair, pure white hair, witch hat with stars, spectacles, bare shoulders, cleavage, low neckline, pin-up framing, chest crop, blood, gore, moire, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, hat cropped by the frame, crying, tears, smiling broadly
```

**Metadata:**
```
id: kera_voss
kind: vn_bust
mode: narrative
variant: flustered
reference files: art/sheets/char-kera-voss-uomd.png (r2 series-style sheet, after approval) + vn_bust_kera_voss_tsundere_scowl (approved)
key colour: #00FFFF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 5. VN bust — guilty

```
The first attached image is THIS character's approved model sheet. Match her face, hair, hat, goggles, coat, apron, belts, brass mortar and palette exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is her approved tsundere_scowl bust: copy its pose, camera, framing, hat angle, hair and hand position exactly and change only the face (and the goggles, only where the expression says so). VN dialogue bust of Kera Voss, an adult woman (20), petite and quick; shoulder-length messy ash-silver hair, choppy at the ends with a few singed strands; bright amber eyes; a faint soot smudge on one cheek; a very wide-brimmed, tall-crowned dark brown field hat with a sagging tip, brass goggles with round ember-orange lenses strapped around its band; a dark brown fitted field coat with a short capelet and deep orange lining, leather bracers; a high-collared cream shirt; a long cream canvas apron clean except for one scorch mark near the hem; a broad leather flask belt and a chest bandolier of stoppered vials in amber, red and smoke-grey; dark trousers, laced brown boots; an engraved brass hand mortar and pestle at her hip, and one sealed crystal vial of glowing ember liquid kept apart from the others. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light with a faint warm ember tone on her face. Keep large areas calm with detail only at the focal point; the vials are a few simple shapes, not a dense row; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; the whole hat brim, face and one hand holding the brass mortar near her chest all within the upper 70% of the image, the brim fully inside the frame; the bottom quarter is visually calm (only plain coat and apron). Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: the hat dominates her silhouette; hair shoulder-length ash-silver, never blonde or long; no hood; fire and glow are ember orange only; one scorch mark on the apron. EXPRESSION guilty: eyes lowered, brows drawn up in the middle, lips pressed, shoulders slightly drawn in; restrained, no tears; goggles on the hat band.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, hood, veil, plum, purple, lilac, violet magic, blonde hair, long hair, pure white hair, witch hat with stars, spectacles, bare shoulders, cleavage, low neckline, pin-up framing, chest crop, blood, gore, moire, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, hat cropped by the frame, smiling, tears, open mouth
```

**Metadata:**
```
id: kera_voss
kind: vn_bust
mode: narrative
variant: guilty
reference files: art/sheets/char-kera-voss-uomd.png (r2 series-style sheet, after approval) + vn_bust_kera_voss_tsundere_scowl (approved)
key colour: #00FFFF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 6. VN bust — defiant

```
The first attached image is THIS character's approved model sheet. Match her face, hair, hat, goggles, coat, apron, belts, brass mortar and palette exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is her approved tsundere_scowl bust: copy its pose, camera, framing, hat angle, hair and hand position exactly and change only the face (and the goggles, only where the expression says so). VN dialogue bust of Kera Voss, an adult woman (20), petite and quick; shoulder-length messy ash-silver hair, choppy at the ends with a few singed strands; bright amber eyes; a faint soot smudge on one cheek; a very wide-brimmed, tall-crowned dark brown field hat with a sagging tip, brass goggles with round ember-orange lenses strapped around its band; a dark brown fitted field coat with a short capelet and deep orange lining, leather bracers; a high-collared cream shirt; a long cream canvas apron clean except for one scorch mark near the hem; a broad leather flask belt and a chest bandolier of stoppered vials in amber, red and smoke-grey; dark trousers, laced brown boots; an engraved brass hand mortar and pestle at her hip, and one sealed crystal vial of glowing ember liquid kept apart from the others. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light with a faint warm ember tone on her face. Keep large areas calm with detail only at the focal point; the vials are a few simple shapes, not a dense row; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; the whole hat brim, face and one hand holding the brass mortar near her chest all within the upper 70% of the image, the brim fully inside the frame; the bottom quarter is visually calm (only plain coat and apron). Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: the hat dominates her silhouette; hair shoulder-length ash-silver, never blonde or long; no hood; fire and glow are ember orange only; one scorch mark on the apron. EXPRESSION defiant: chin up, eyes wide and blazing, jaw set, mouth open mid-retort; goggles on the hat band.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, hood, veil, plum, purple, lilac, violet magic, blonde hair, long hair, pure white hair, witch hat with stars, spectacles, bare shoulders, cleavage, low neckline, pin-up framing, chest crop, blood, gore, moire, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, hat cropped by the frame, smiling, crying, screaming
```

**Metadata:**
```
id: kera_voss
kind: vn_bust
mode: narrative
variant: defiant
reference files: art/sheets/char-kera-voss-uomd.png (r2 series-style sheet, after approval) + vn_bust_kera_voss_tsundere_scowl (approved)
key colour: #00FFFF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 7. Battle pose — idle

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is the chibi study from the same sheet: match its short chibi body proportions and silhouette, rendered in the ink style described below. Single full-body chibi battle sprite of Kera Voss, an adult woman (20), petite and quick; shoulder-length messy ash-silver hair, choppy at the ends with a few singed strands; bright amber eyes; a faint soot smudge on one cheek; a very wide-brimmed, tall-crowned dark brown field hat with a sagging tip, brass goggles with round ember-orange lenses strapped around its band; a dark brown fitted field coat with a short capelet and deep orange lining, leather bracers; a high-collared cream shirt; a long cream canvas apron clean except for one scorch mark near the hem; a broad leather flask belt and a chest bandolier of stoppered vials in amber, red and smoke-grey; dark trousers, laced brown boots; an engraved brass hand mortar and pestle at her hip, and one sealed crystal vial of glowing ember liquid kept apart from the others. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (hat, coat, apron, sharp adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: an exaggerated oversized wide-brimmed hat that dominates the shape, flaring capelet and coat tails, angular cloth folds, heavy shadow masses; vials as three or four bold simple shapes. Limited desaturated palette of dark brown, cream, brass and charcoal plus ONE accent: ember orange. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose idle: weight on one hip, tapping one foot, the brass mortar held in one hand, the other hand on her hip, hat tilted, impatient little scowl. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height including the hat; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: the hat dominates her silhouette; hair shoulder-length ash-silver, never blonde or long; no hood; fire and glow are ember orange only; one scorch mark on the apron.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, hood, plum, purple, blonde hair, long hair, witch hat with stars, broomstick, wand, bare skin, red-gold fire, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped hat
```

**Metadata:**
```
id: kera_voss
kind: battle_pose
mode: play
variant: idle
reference files: art/sheets/char-kera-voss-uomd.png (r2 series-style sheet, after approval) + art/sheets/chibi_ref/chibi_ref_kera_voss.png
key colour: #00FFFF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 8. Battle pose — attack

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Kera Voss, an adult woman (20), petite and quick; shoulder-length messy ash-silver hair, choppy at the ends with a few singed strands; bright amber eyes; a faint soot smudge on one cheek; a very wide-brimmed, tall-crowned dark brown field hat with a sagging tip, brass goggles with round ember-orange lenses strapped around its band; a dark brown fitted field coat with a short capelet and deep orange lining, leather bracers; a high-collared cream shirt; a long cream canvas apron clean except for one scorch mark near the hem; a broad leather flask belt and a chest bandolier of stoppered vials in amber, red and smoke-grey; dark trousers, laced brown boots; an engraved brass hand mortar and pestle at her hip, and one sealed crystal vial of glowing ember liquid kept apart from the others. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (hat, coat, apron, sharp adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: an exaggerated oversized wide-brimmed hat that dominates the shape, flaring capelet and coat tails, angular cloth folds, heavy shadow masses; vials as three or four bold simple shapes. Limited desaturated palette of dark brown, cream, brass and charcoal plus ONE accent: ember orange. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose attack: Flask Flick: a quick sidearm flick toward screen-right, a small burning vial just leaving her fingers with a tiny ember-orange flame at its neck, fully inside the frame; hat brim bouncing, coat tails swinging; no trail effect. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height including the hat; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: the hat dominates her silhouette; hair shoulder-length ash-silver, never blonde or long; no hood; fire and glow are ember orange only; one scorch mark on the apron.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, hood, plum, purple, blonde hair, long hair, witch hat with stars, broomstick, wand, bare skin, red-gold fire, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped hat
```

**Metadata:**
```
id: kera_voss
kind: battle_pose
mode: play
variant: attack
reference files: art/sheets/char-kera-voss-uomd.png (r2 series-style sheet, after approval) + battle_pose_kera_voss_idle (approved)
key colour: #00FFFF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 9. Battle pose — hit

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Kera Voss, an adult woman (20), petite and quick; shoulder-length messy ash-silver hair, choppy at the ends with a few singed strands; bright amber eyes; a faint soot smudge on one cheek; a very wide-brimmed, tall-crowned dark brown field hat with a sagging tip, brass goggles with round ember-orange lenses strapped around its band; a dark brown fitted field coat with a short capelet and deep orange lining, leather bracers; a high-collared cream shirt; a long cream canvas apron clean except for one scorch mark near the hem; a broad leather flask belt and a chest bandolier of stoppered vials in amber, red and smoke-grey; dark trousers, laced brown boots; an engraved brass hand mortar and pestle at her hip, and one sealed crystal vial of glowing ember liquid kept apart from the others. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (hat, coat, apron, sharp adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: an exaggerated oversized wide-brimmed hat that dominates the shape, flaring capelet and coat tails, angular cloth folds, heavy shadow masses; vials as three or four bold simple shapes. Limited desaturated palette of dark brown, cream, brass and charcoal plus ONE accent: ember orange. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose hit: knocked half a step back, one hand clamping the hat down on her head, the other arm tucked around the vials on her belt, eyes squeezed shut, teeth gritted; unharmed. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height including the hat; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: the hat dominates her silhouette; hair shoulder-length ash-silver, never blonde or long; no hood; fire and glow are ember orange only; one scorch mark on the apron.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, hood, plum, purple, blonde hair, long hair, witch hat with stars, broomstick, wand, bare skin, red-gold fire, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped hat
```

**Metadata:**
```
id: kera_voss
kind: battle_pose
mode: play
variant: hit
reference files: art/sheets/char-kera-voss-uomd.png (r2 series-style sheet, after approval) + battle_pose_kera_voss_idle (approved)
key colour: #00FFFF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 10. Battle pose — skill

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Kera Voss, an adult woman (20), petite and quick; shoulder-length messy ash-silver hair, choppy at the ends with a few singed strands; bright amber eyes; a faint soot smudge on one cheek; a very wide-brimmed, tall-crowned dark brown field hat with a sagging tip, brass goggles with round ember-orange lenses strapped around its band; a dark brown fitted field coat with a short capelet and deep orange lining, leather bracers; a high-collared cream shirt; a long cream canvas apron clean except for one scorch mark near the hem; a broad leather flask belt and a chest bandolier of stoppered vials in amber, red and smoke-grey; dark trousers, laced brown boots; an engraved brass hand mortar and pestle at her hip, and one sealed crystal vial of glowing ember liquid kept apart from the others. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (hat, coat, apron, sharp adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: an exaggerated oversized wide-brimmed hat that dominates the shape, flaring capelet and coat tails, angular cloth folds, heavy shadow masses; vials as three or four bold simple shapes. Limited desaturated palette of dark brown, cream, brass and charcoal plus ONE accent: ember orange. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose skill: Cinder Tonic: the brass mortar held out in front of her in one hand, the pestle in the other just cracking a vial inside the bowl, a small puff of ember-orange sparks rising from the bowl only; goggles pulled down over her eyes; fire effects are a separate asset. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height including the hat; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: the hat dominates her silhouette; hair shoulder-length ash-silver, never blonde or long; no hood; fire and glow are ember orange only; one scorch mark on the apron.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, hood, plum, purple, blonde hair, long hair, witch hat with stars, broomstick, wand, bare skin, red-gold fire, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped hat
```

**Metadata:**
```
id: kera_voss
kind: battle_pose
mode: play
variant: skill
reference files: art/sheets/char-kera-voss-uomd.png (r2 series-style sheet, after approval) + battle_pose_kera_voss_idle (approved)
key colour: #00FFFF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 11. Battle pose — guard

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Kera Voss, an adult woman (20), petite and quick; shoulder-length messy ash-silver hair, choppy at the ends with a few singed strands; bright amber eyes; a faint soot smudge on one cheek; a very wide-brimmed, tall-crowned dark brown field hat with a sagging tip, brass goggles with round ember-orange lenses strapped around its band; a dark brown fitted field coat with a short capelet and deep orange lining, leather bracers; a high-collared cream shirt; a long cream canvas apron clean except for one scorch mark near the hem; a broad leather flask belt and a chest bandolier of stoppered vials in amber, red and smoke-grey; dark trousers, laced brown boots; an engraved brass hand mortar and pestle at her hip, and one sealed crystal vial of glowing ember liquid kept apart from the others. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (hat, coat, apron, sharp adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: an exaggerated oversized wide-brimmed hat that dominates the shape, flaring capelet and coat tails, angular cloth folds, heavy shadow masses; vials as three or four bold simple shapes. Limited desaturated palette of dark brown, cream, brass and charcoal plus ONE accent: ember orange. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose guard: turning one shoulder toward the threat, crouched low, the wide hat brim tipped down to shield her face, the capelet pulled across her chest with one arm, the mortar clutched to her body. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height including the hat; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: the hat dominates her silhouette; hair shoulder-length ash-silver, never blonde or long; no hood; fire and glow are ember orange only; one scorch mark on the apron.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, hood, plum, purple, blonde hair, long hair, witch hat with stars, broomstick, wand, bare skin, red-gold fire, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped hat
```

**Metadata:**
```
id: kera_voss
kind: battle_pose
mode: play
variant: guard
reference files: art/sheets/char-kera-voss-uomd.png (r2 series-style sheet, after approval) + battle_pose_kera_voss_idle (approved)
key colour: #00FFFF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 12. Battle pose — victory

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Kera Voss, an adult woman (20), petite and quick; shoulder-length messy ash-silver hair, choppy at the ends with a few singed strands; bright amber eyes; a faint soot smudge on one cheek; a very wide-brimmed, tall-crowned dark brown field hat with a sagging tip, brass goggles with round ember-orange lenses strapped around its band; a dark brown fitted field coat with a short capelet and deep orange lining, leather bracers; a high-collared cream shirt; a long cream canvas apron clean except for one scorch mark near the hem; a broad leather flask belt and a chest bandolier of stoppered vials in amber, red and smoke-grey; dark trousers, laced brown boots; an engraved brass hand mortar and pestle at her hip, and one sealed crystal vial of glowing ember liquid kept apart from the others. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (hat, coat, apron, sharp adult expression) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: an exaggerated oversized wide-brimmed hat that dominates the shape, flaring capelet and coat tails, angular cloth folds, heavy shadow masses; vials as three or four bold simple shapes. Limited desaturated palette of dark brown, cream, brass and charcoal plus ONE accent: ember orange. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose victory: goggles pushed up on the hat band, arms crossed with the mortar tucked under one arm, chin up, eyes glancing away, a smug small smile she is trying to hide. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height including the hat; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: the hat dominates her silhouette; hair shoulder-length ash-silver, never blonde or long; no hood; fire and glow are ember orange only; one scorch mark on the apron.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, hood, plum, purple, blonde hair, long hair, witch hat with stars, broomstick, wand, bare skin, red-gold fire, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped hat
```

**Metadata:**
```
id: kera_voss
kind: battle_pose
mode: play
variant: victory
reference files: art/sheets/char-kera-voss-uomd.png (r2 series-style sheet, after approval) + battle_pose_kera_voss_idle (approved)
key colour: #00FFFF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```
