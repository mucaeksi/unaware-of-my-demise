# Production prompts — Brin Alder (template C40, 2026-09-30)

**Status:** APPROVED FOR PRODUCTION (2026-09-30). Starts only after the r2 sheet (`prompts/sheets/brin_alder_sheet.md`) is approved and saved as `art/sheets/char-brin-alder-uomd.png`.

Files: vn_bust_brin_alder_{quiet_focus,protective_concern,small_smile}_v001.png · battle_pose_brin_alder_{idle,attack,hit,skill,guard,victory}_v001.png

**Generation order:** 1 quiet_focus bust → approve → 2–3 with it attached as a second reference. 4 idle pose (attach the sheet + `art/sheets/chibi_ref/chibi_ref_brin_alder.png`) → approve → 5–9 with the idle attached.

**Why three busts:** Brin speaks 24 lines in Part I and her range is narrow on purpose (few words, warm under them). The three are her sheet expressions.

**Script emotion → bust (runtime mapping request; every Brin `emotion` value is listed):**

| Bust | `emotion` values in the script |
|---|---|
| `quiet_focus` (default) | quiet, steady, resolved, firm, earnest, commanding, realizing, deadpan, dry, and any unlisted value |
| `protective_concern` | strained, uneasy |
| `small_smile` | gentle, warm, small_smile, relieved |

**Poses follow her kit** (Stone tank, front row): attack = Rootsplitter, skill = Oakbrace (taunt). Hold the Gate and Alderwall are effect assets. Victory looks back to count her people ("Nobody left behind").

**Key colour:** #FF00FF (largest hue distance from pine green).

## 1. VN bust — quiet_focus

```
The first attached image is THIS character's approved model sheet. Match her face, hair and braid, cloak, fur collar, gambeson, axe, buckler and palette exactly; ignore the sheet's layout, labels, text, background and story-state panels. VN dialogue bust of Brin Alder, an adult woman (23), sturdy and broad-shouldered, quiet and steady; long brown hair, a little messy around the face, gathered into one long braid over her shoulder; brown eyes; a heavy pine-green village-guard cloak with a thick pale grey wolf-fur collar; a quilted cream gambeson; layered brown leather belts with pouches; thick leather gloves; dark trousers; tall brown boots with iron boot guards; a woodcutter's hand axe with a long plain haft; a round iron buckler with a raised boss, alder wood showing at its rim. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; the gambeson quilting and fur are broad simple shapes, never a fine grid or strand texture; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face, the braid over her shoulder and one gloved hand holding the cloak edge at her collar all within the upper 70% of the image; the bottom quarter is visually calm (only plain cloak and gambeson). No axe or buckler in frame. Flat, evenly lit, pure #FF00FF magenta background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always brown with one long braid; a round buckler, never a heater shield; no hood; the fur collar pale grey. EXPRESSION quiet_focus: a level, calm gaze, mouth closed, brows relaxed; steady and a little tired, not cold.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, hood, veil, blonde hair, pale hair, short hair, plate armor, heater shield, sword, oxblood cloak, bare shoulders, cleavage, low neckline, pin-up framing, chest crop, blood, gore, moire, mesh pattern, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, smiling, crying
```

**Metadata:**
```
id: brin_alder
kind: vn_bust
mode: narrative
variant: quiet_focus
reference files: art/sheets/char-brin-alder-uomd.png (r2 series-style sheet, after approval)
key colour: #FF00FF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 2. VN bust — protective_concern

```
The first attached image is THIS character's approved model sheet. Match her face, hair and braid, cloak, fur collar, gambeson, axe, buckler and palette exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is her approved quiet_focus bust: copy its pose, camera, framing, braid and hand position exactly and change only the face. VN dialogue bust of Brin Alder, an adult woman (23), sturdy and broad-shouldered, quiet and steady; long brown hair, a little messy around the face, gathered into one long braid over her shoulder; brown eyes; a heavy pine-green village-guard cloak with a thick pale grey wolf-fur collar; a quilted cream gambeson; layered brown leather belts with pouches; thick leather gloves; dark trousers; tall brown boots with iron boot guards; a woodcutter's hand axe with a long plain haft; a round iron buckler with a raised boss, alder wood showing at its rim. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; the gambeson quilting and fur are broad simple shapes, never a fine grid or strand texture; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face, the braid over her shoulder and one gloved hand holding the cloak edge at her collar all within the upper 70% of the image; the bottom quarter is visually calm (only plain cloak and gambeson). No axe or buckler in frame. Flat, evenly lit, pure #FF00FF magenta background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always brown with one long braid; a round buckler, never a heater shield; no hood; the fur collar pale grey. EXPRESSION protective_concern: brows drawn together, eyes fixed on someone just past the frame, lips pressed; worried but holding firm.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, hood, veil, blonde hair, pale hair, short hair, plate armor, heater shield, sword, oxblood cloak, bare shoulders, cleavage, low neckline, pin-up framing, chest crop, blood, gore, moire, mesh pattern, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, smiling, crying, angry shouting
```

**Metadata:**
```
id: brin_alder
kind: vn_bust
mode: narrative
variant: protective_concern
reference files: art/sheets/char-brin-alder-uomd.png (r2 series-style sheet, after approval) + vn_bust_brin_alder_quiet_focus (approved)
key colour: #FF00FF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 3. VN bust — small_smile

```
The first attached image is THIS character's approved model sheet. Match her face, hair and braid, cloak, fur collar, gambeson, axe, buckler and palette exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is her approved quiet_focus bust: copy its pose, camera, framing, braid and hand position exactly and change only the face. VN dialogue bust of Brin Alder, an adult woman (23), sturdy and broad-shouldered, quiet and steady; long brown hair, a little messy around the face, gathered into one long braid over her shoulder; brown eyes; a heavy pine-green village-guard cloak with a thick pale grey wolf-fur collar; a quilted cream gambeson; layered brown leather belts with pouches; thick leather gloves; dark trousers; tall brown boots with iron boot guards; a woodcutter's hand axe with a long plain haft; a round iron buckler with a raised boss, alder wood showing at its rim. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; the gambeson quilting and fur are broad simple shapes, never a fine grid or strand texture; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face, the braid over her shoulder and one gloved hand holding the cloak edge at her collar all within the upper 70% of the image; the bottom quarter is visually calm (only plain cloak and gambeson). No axe or buckler in frame. Flat, evenly lit, pure #FF00FF magenta background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always brown with one long braid; a round buckler, never a heater shield; no hood; the fur collar pale grey. EXPRESSION small_smile: a rare small warm smile, eyes softened, brows relaxed; quiet, not a grin.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, hood, veil, blonde hair, pale hair, short hair, plate armor, heater shield, sword, oxblood cloak, bare shoulders, cleavage, low neckline, pin-up framing, chest crop, blood, gore, moire, mesh pattern, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, crying, open-mouthed laugh, sad eyes
```

**Metadata:**
```
id: brin_alder
kind: vn_bust
mode: narrative
variant: small_smile
reference files: art/sheets/char-brin-alder-uomd.png (r2 series-style sheet, after approval) + vn_bust_brin_alder_quiet_focus (approved)
key colour: #FF00FF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 4. Battle pose — idle

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is the chibi study from the same sheet: match its short chibi body proportions and silhouette, rendered in the ink style described below. Single full-body chibi battle sprite of Brin Alder, an adult woman (23), sturdy and broad-shouldered, quiet and steady; long brown hair, a little messy around the face, gathered into one long braid over her shoulder; brown eyes; a heavy pine-green village-guard cloak with a thick pale grey wolf-fur collar; a quilted cream gambeson; layered brown leather belts with pouches; thick leather gloves; dark trousers; tall brown boots with iron boot guards; a woodcutter's hand axe with a long plain haft; a round iron buckler with a raised boss, alder wood showing at its rim. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (braid, sturdy build, calm adult face) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: a heavy cloak, an exaggerated fur collar, an oversized round buckler and axe, angular cloth folds, heavy shadow masses. Limited desaturated palette of iron grey, cream, brown and charcoal plus ONE accent: pine green. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose idle: standing planted with feet apart, the axe resting on her shoulder, the buckler hanging at her side, braid over her shoulder, calm watchful face. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #FF00FF magenta background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always brown with one long braid; a round buckler, never a heater shield; no hood; the fur collar pale grey.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, hood, pale hair, heater shield, sword, plate armor, bare skin, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped weapon
```

**Metadata:**
```
id: brin_alder
kind: battle_pose
mode: play
variant: idle
reference files: art/sheets/char-brin-alder-uomd.png (r2 series-style sheet, after approval) + art/sheets/chibi_ref/chibi_ref_brin_alder.png
key colour: #FF00FF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 5. Battle pose — attack

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Brin Alder, an adult woman (23), sturdy and broad-shouldered, quiet and steady; long brown hair, a little messy around the face, gathered into one long braid over her shoulder; brown eyes; a heavy pine-green village-guard cloak with a thick pale grey wolf-fur collar; a quilted cream gambeson; layered brown leather belts with pouches; thick leather gloves; dark trousers; tall brown boots with iron boot guards; a woodcutter's hand axe with a long plain haft; a round iron buckler with a raised boss, alder wood showing at its rim. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (braid, sturdy build, calm adult face) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: a heavy cloak, an exaggerated fur collar, an oversized round buckler and axe, angular cloth folds, heavy shadow masses. Limited desaturated palette of iron grey, cream, brown and charcoal plus ONE accent: pine green. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose attack: Rootsplitter: a short, heavy overhead axe chop downward toward screen-right, like splitting a log, buckler held tight to her chest, front foot planted; the whole axe inside the frame; no trail effect. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #FF00FF magenta background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always brown with one long braid; a round buckler, never a heater shield; no hood; the fur collar pale grey.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, hood, pale hair, heater shield, sword, plate armor, bare skin, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped weapon
```

**Metadata:**
```
id: brin_alder
kind: battle_pose
mode: play
variant: attack
reference files: art/sheets/char-brin-alder-uomd.png (r2 series-style sheet, after approval) + battle_pose_brin_alder_idle (approved)
key colour: #FF00FF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 6. Battle pose — hit

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Brin Alder, an adult woman (23), sturdy and broad-shouldered, quiet and steady; long brown hair, a little messy around the face, gathered into one long braid over her shoulder; brown eyes; a heavy pine-green village-guard cloak with a thick pale grey wolf-fur collar; a quilted cream gambeson; layered brown leather belts with pouches; thick leather gloves; dark trousers; tall brown boots with iron boot guards; a woodcutter's hand axe with a long plain haft; a round iron buckler with a raised boss, alder wood showing at its rim. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (braid, sturdy build, calm adult face) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: a heavy cloak, an exaggerated fur collar, an oversized round buckler and axe, angular cloth folds, heavy shadow masses. Limited desaturated palette of iron grey, cream, brown and charcoal plus ONE accent: pine green. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose hit: taking a blow on the buckler: pushed back half a step, boots digging in, buckler arm jarred against her body, teeth gritted; she does not fall; unharmed. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #FF00FF magenta background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always brown with one long braid; a round buckler, never a heater shield; no hood; the fur collar pale grey.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, hood, pale hair, heater shield, sword, plate armor, bare skin, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped weapon
```

**Metadata:**
```
id: brin_alder
kind: battle_pose
mode: play
variant: hit
reference files: art/sheets/char-brin-alder-uomd.png (r2 series-style sheet, after approval) + battle_pose_brin_alder_idle (approved)
key colour: #FF00FF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 7. Battle pose — skill

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Brin Alder, an adult woman (23), sturdy and broad-shouldered, quiet and steady; long brown hair, a little messy around the face, gathered into one long braid over her shoulder; brown eyes; a heavy pine-green village-guard cloak with a thick pale grey wolf-fur collar; a quilted cream gambeson; layered brown leather belts with pouches; thick leather gloves; dark trousers; tall brown boots with iron boot guards; a woodcutter's hand axe with a long plain haft; a round iron buckler with a raised boss, alder wood showing at its rim. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (braid, sturdy build, calm adult face) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: a heavy cloak, an exaggerated fur collar, an oversized round buckler and axe, angular cloth folds, heavy shadow masses. Limited desaturated palette of iron grey, cream, brown and charcoal plus ONE accent: pine green. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose skill: Oakbrace: planted wide, striking the axe haft against the face of the buckler to draw the enemy's attention, chin up, looking straight at screen-right; taunt and defence effects are a separate asset. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #FF00FF magenta background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always brown with one long braid; a round buckler, never a heater shield; no hood; the fur collar pale grey.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, hood, pale hair, heater shield, sword, plate armor, bare skin, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped weapon
```

**Metadata:**
```
id: brin_alder
kind: battle_pose
mode: play
variant: skill
reference files: art/sheets/char-brin-alder-uomd.png (r2 series-style sheet, after approval) + battle_pose_brin_alder_idle (approved)
key colour: #FF00FF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 8. Battle pose — guard

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Brin Alder, an adult woman (23), sturdy and broad-shouldered, quiet and steady; long brown hair, a little messy around the face, gathered into one long braid over her shoulder; brown eyes; a heavy pine-green village-guard cloak with a thick pale grey wolf-fur collar; a quilted cream gambeson; layered brown leather belts with pouches; thick leather gloves; dark trousers; tall brown boots with iron boot guards; a woodcutter's hand axe with a long plain haft; a round iron buckler with a raised boss, alder wood showing at its rim. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (braid, sturdy build, calm adult face) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: a heavy cloak, an exaggerated fur collar, an oversized round buckler and axe, angular cloth folds, heavy shadow masses. Limited desaturated palette of iron grey, cream, brown and charcoal plus ONE accent: pine green. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose guard: low defensive crouch, the round buckler raised in front of her face and chest, the axe held back and ready, cloak drawn around her, eyes watchful over the buckler's rim. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #FF00FF magenta background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always brown with one long braid; a round buckler, never a heater shield; no hood; the fur collar pale grey.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, hood, pale hair, heater shield, sword, plate armor, bare skin, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped weapon
```

**Metadata:**
```
id: brin_alder
kind: battle_pose
mode: play
variant: guard
reference files: art/sheets/char-brin-alder-uomd.png (r2 series-style sheet, after approval) + battle_pose_brin_alder_idle (approved)
key colour: #FF00FF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 9. Battle pose — victory

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is her approved idle pose: copy its scale, camera, proportions, costume and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Brin Alder, an adult woman (23), sturdy and broad-shouldered, quiet and steady; long brown hair, a little messy around the face, gathered into one long braid over her shoulder; brown eyes; a heavy pine-green village-guard cloak with a thick pale grey wolf-fur collar; a quilted cream gambeson; layered brown leather belts with pouches; thick leather gloves; dark trousers; tall brown boots with iron boot guards; a woodcutter's hand axe with a long plain haft; a round iron buckler with a raised boss, alder wood showing at its rim. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult woman drawn chibi, keeping adult design cues (braid, sturdy build, calm adult face) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: a heavy cloak, an exaggerated fur collar, an oversized round buckler and axe, angular cloth folds, heavy shadow masses. Limited desaturated palette of iron grey, cream, brown and charcoal plus ONE accent: pine green. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose victory: lowering the buckler, resting the axe head on the ground, glancing back over her shoulder toward screen-left as if counting that everyone is still there, a rare small smile. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #FF00FF magenta background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: hair always brown with one long braid; a round buckler, never a heater shield; no hood; the fur collar pale grey.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, loli, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, stippling, film grain, hood, pale hair, heater shield, sword, plate armor, bare skin, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped weapon
```

**Metadata:**
```
id: brin_alder
kind: battle_pose
mode: play
variant: victory
reference files: art/sheets/char-brin-alder-uomd.png (r2 series-style sheet, after approval) + battle_pose_brin_alder_idle (approved)
key colour: #FF00FF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```
