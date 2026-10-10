# Production prompts — Mahmut (template C40, 2026-09-30)

**Status:** APPROVED FOR PRODUCTION (2026-09-30).

Files: vn_bust_mahmut_{watchful,dry_humor,protective_resolve,gentle_concern,grief}_v001.png · battle_pose_mahmut_{idle,attack,hit,skill,guard,victory}_v001.png

**Generation order:** 1 watchful bust → approve → 2–5 with the watchful bust attached as a second reference. 6 idle pose (attach the sheet + `art/sheets/chibi_ref/chibi_ref_mahmut.png`) → approve → 7–11 with the idle attached.

**Why five busts (Fadyme has three):** Mahmut speaks 132 lines in Part I with a wider range; the five match five of the six sheet expressions. The sheet's "Battlefield Command" is folded into `protective_resolve`.

**Script emotion → bust (runtime mapping request for the technical team):**

| Bust | `emotion` values in the script |
|---|---|
| `watchful` (default) | curious, careful, thoughtful, polite, flat, alarmed, tense, warning, steady, hard, quiet, observant, wary, alert, watchful, guarded, calm, measured, direct, certain, skeptical, questioning, searching, surprised, casual, respectful, decisive, tight, too_quick, and any unlisted value |
| `dry_humor` | dry, deadpan, wry |
| `protective_resolve` | promise, anger, grief_to_anger, resolved, protective, command, urgent, angry, defiant, frustrated |
| `gentle_concern` | grateful, approving, troubled, gentle, concern, tender, warm, hopeful |
| `grief` | stunned, hollow, raw, fear, shaken, hurt, remorseful, strained, grim, low, tired, ashamed |

**Canon carried into every prompt (not always readable on the sheet):** the empty hammered socket above the Crown Guard star (A-003, 5-1 Marek), the iron-plugged crest socket in the sword hilt (weapon lore), Yseldra's gray seal on the shield rim (opening; paid off at 3-5 and 7-1). Busts show only the breastplate star; the sword and shield details live in the battle poses.

**Key colour:** #00FFFF (largest hue distance from oxblood).

## 1. VN bust — watchful

```
The first attached image is THIS character's approved model sheet. Match his face, hair, armor, cloak, palette, sword and shield exactly; ignore the sheet's layout, labels, text, background and story-state panels. VN dialogue bust of Mahmut, an adult man (28), tall and broad-shouldered, a weathered knight; messy dark brown hair, almost black; light stubble; tired, watchful brown eyes; dark worn steel half-plate over a dark gambeson, the plates dented and repaired in mismatched styles, brown leather belts; a tattered oxblood cloak wrapped high around his shoulders like a cowl, its torn hem never mended; no helmet; a long arming sword with a brown leather grip; a dark iron heater shield with a raised four-point star, visibly repaired with a riveted patch plate. Canon detail that must be visible even if the sheet is unclear: a small Crown Guard star on the breastplate with an empty, hammered socket directly above it where a crown was beaten off. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; the armor is drawn as broad simple plates with a few dents, never rivet or chain micro-pattern; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face and the star on his breastplate all within the upper 70% of the image, one gauntleted hand resting on the cloak's edge at his chest; the bottom quarter is visually calm (only plain cloak and dark plate). No sword or shield in frame. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: an empty socket above the star, never a crown anywhere on his armor; hair always dark; no helmet; the cloak stays oxblood and torn. EXPRESSION watchful: steady and guarded, eyes alert and slightly narrowed, mouth a flat line, calm tired face; not angry.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, crown emblem, crown on armor, helmet, blond hair, light hair, clean shiny armor, bright red cloak, fur mantle, fur collar, bare chest, blood, gore, wounds, moire, mesh pattern, chain mail texture, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, smiling, crying
```

**Metadata:**
```
id: mahmut
kind: vn_bust
mode: narrative
variant: watchful
reference files: art/sheets/char-mahmut-uomd.png
key colour: #00FFFF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 2. VN bust — dry_humor

```
The first attached image is THIS character's approved model sheet. Match his face, hair, armor, cloak, palette, sword and shield exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is his approved watchful bust: copy its pose, camera, framing, hair and hand position exactly and change only the face. VN dialogue bust of Mahmut, an adult man (28), tall and broad-shouldered, a weathered knight; messy dark brown hair, almost black; light stubble; tired, watchful brown eyes; dark worn steel half-plate over a dark gambeson, the plates dented and repaired in mismatched styles, brown leather belts; a tattered oxblood cloak wrapped high around his shoulders like a cowl, its torn hem never mended; no helmet; a long arming sword with a brown leather grip; a dark iron heater shield with a raised four-point star, visibly repaired with a riveted patch plate. Canon detail that must be visible even if the sheet is unclear: a small Crown Guard star on the breastplate with an empty, hammered socket directly above it where a crown was beaten off. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; the armor is drawn as broad simple plates with a few dents, never rivet or chain micro-pattern; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face and the star on his breastplate all within the upper 70% of the image, one gauntleted hand resting on the cloak's edge at his chest; the bottom quarter is visually calm (only plain cloak and dark plate). No sword or shield in frame. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: an empty socket above the star, never a crown anywhere on his armor; hair always dark; no helmet; the cloak stays oxblood and torn. EXPRESSION dry_humor: one corner of the mouth lifted in a small dry half-smile, eyes tired but amused, brows relaxed.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, crown emblem, crown on armor, helmet, blond hair, light hair, clean shiny armor, bright red cloak, fur mantle, fur collar, bare chest, blood, gore, wounds, moire, mesh pattern, chain mail texture, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, open-mouthed laugh, crying
```

**Metadata:**
```
id: mahmut
kind: vn_bust
mode: narrative
variant: dry_humor
reference files: art/sheets/char-mahmut-uomd.png + vn_bust_mahmut_watchful (approved)
key colour: #00FFFF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 3. VN bust — protective_resolve

```
The first attached image is THIS character's approved model sheet. Match his face, hair, armor, cloak, palette, sword and shield exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is his approved watchful bust: copy its pose, camera, framing, hair and hand position exactly and change only the face. VN dialogue bust of Mahmut, an adult man (28), tall and broad-shouldered, a weathered knight; messy dark brown hair, almost black; light stubble; tired, watchful brown eyes; dark worn steel half-plate over a dark gambeson, the plates dented and repaired in mismatched styles, brown leather belts; a tattered oxblood cloak wrapped high around his shoulders like a cowl, its torn hem never mended; no helmet; a long arming sword with a brown leather grip; a dark iron heater shield with a raised four-point star, visibly repaired with a riveted patch plate. Canon detail that must be visible even if the sheet is unclear: a small Crown Guard star on the breastplate with an empty, hammered socket directly above it where a crown was beaten off. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; the armor is drawn as broad simple plates with a few dents, never rivet or chain micro-pattern; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face and the star on his breastplate all within the upper 70% of the image, one gauntleted hand resting on the cloak's edge at his chest; the bottom quarter is visually calm (only plain cloak and dark plate). No sword or shield in frame. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: an empty socket above the star, never a crown anywhere on his armor; hair always dark; no helmet; the cloak stays oxblood and torn. EXPRESSION protective_resolve: jaw set, brows lowered, eyes hard and focused past the viewer, lips pressed; determined, not shouting.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, crown emblem, crown on armor, helmet, blond hair, light hair, clean shiny armor, bright red cloak, fur mantle, fur collar, bare chest, blood, gore, wounds, moire, mesh pattern, chain mail texture, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, smiling, crying, open mouth
```

**Metadata:**
```
id: mahmut
kind: vn_bust
mode: narrative
variant: protective_resolve
reference files: art/sheets/char-mahmut-uomd.png + vn_bust_mahmut_watchful (approved)
key colour: #00FFFF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 4. VN bust — gentle_concern

```
The first attached image is THIS character's approved model sheet. Match his face, hair, armor, cloak, palette, sword and shield exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is his approved watchful bust: copy its pose, camera, framing, hair and hand position exactly and change only the face. VN dialogue bust of Mahmut, an adult man (28), tall and broad-shouldered, a weathered knight; messy dark brown hair, almost black; light stubble; tired, watchful brown eyes; dark worn steel half-plate over a dark gambeson, the plates dented and repaired in mismatched styles, brown leather belts; a tattered oxblood cloak wrapped high around his shoulders like a cowl, its torn hem never mended; no helmet; a long arming sword with a brown leather grip; a dark iron heater shield with a raised four-point star, visibly repaired with a riveted patch plate. Canon detail that must be visible even if the sheet is unclear: a small Crown Guard star on the breastplate with an empty, hammered socket directly above it where a crown was beaten off. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; the armor is drawn as broad simple plates with a few dents, never rivet or chain micro-pattern; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face and the star on his breastplate all within the upper 70% of the image, one gauntleted hand resting on the cloak's edge at his chest; the bottom quarter is visually calm (only plain cloak and dark plate). No sword or shield in frame. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: an empty socket above the star, never a crown anywhere on his armor; hair always dark; no helmet; the cloak stays oxblood and torn. EXPRESSION gentle_concern: brows lifted slightly and drawn together, eyes soft and searching, mouth relaxed and closed; quiet worry for someone he is looking at.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, crown emblem, crown on armor, helmet, blond hair, light hair, clean shiny armor, bright red cloak, fur mantle, fur collar, bare chest, blood, gore, wounds, moire, mesh pattern, chain mail texture, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, smiling, crying, angry
```

**Metadata:**
```
id: mahmut
kind: vn_bust
mode: narrative
variant: gentle_concern
reference files: art/sheets/char-mahmut-uomd.png + vn_bust_mahmut_watchful (approved)
key colour: #00FFFF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 5. VN bust — grief

```
The first attached image is THIS character's approved model sheet. Match his face, hair, armor, cloak, palette, sword and shield exactly; ignore the sheet's layout, labels, text, background and story-state panels. The second attached image is his approved watchful bust: copy its pose, camera, framing, hair and hand position exactly and change only the face. VN dialogue bust of Mahmut, an adult man (28), tall and broad-shouldered, a weathered knight; messy dark brown hair, almost black; light stubble; tired, watchful brown eyes; dark worn steel half-plate over a dark gambeson, the plates dented and repaired in mismatched styles, brown leather belts; a tattered oxblood cloak wrapped high around his shoulders like a cowl, its torn hem never mended; no helmet; a long arming sword with a brown leather grip; a dark iron heater shield with a raised four-point star, visibly repaired with a riveted patch plate. Canon detail that must be visible even if the sheet is unclear: a small Crown Guard star on the breastplate with an empty, hammered socket directly above it where a crown was beaten off. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light. Keep large areas calm with detail only at the focal point; the armor is drawn as broad simple plates with a few dents, never rivet or chain micro-pattern; no micro-texture, no film grain. Vertical 1024x1536 composition, chest-up bust, three-quarter view facing screen-left toward the open side of the frame, centered horizontally; head, face and the star on his breastplate all within the upper 70% of the image, one gauntleted hand resting on the cloak's edge at his chest; the bottom quarter is visually calm (only plain cloak and dark plate). No sword or shield in frame. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: an empty socket above the star, never a crown anywhere on his armor; hair always dark; no helmet; the cloak stays oxblood and torn. EXPRESSION grief: eyes lowered and heavy, jaw tight, the face held still by effort; restrained, no tears.
```

**Negative:**
```
text, letters, logo, watermark, signature, UI, frame, crown emblem, crown on armor, helmet, blond hair, light hair, clean shiny armor, bright red cloak, fur mantle, fur collar, bare chest, blood, gore, wounds, moire, mesh pattern, chain mail texture, micro-texture, film grain, gradient background, drop shadow, glow at the edges, extra fingers, second character, smiling, tears, open mouth, screaming
```

**Metadata:**
```
id: mahmut
kind: vn_bust
mode: narrative
variant: grief
reference files: art/sheets/char-mahmut-uomd.png + vn_bust_mahmut_watchful (approved)
key colour: #00FFFF
native size: 1024x1536
intended runtime size: 640x960
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 6. Battle pose — idle

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is the chibi study from the same sheet: match its short chibi body proportions and silhouette, rendered in the ink style described below. Single full-body chibi battle sprite of Mahmut, an adult man (28), tall and broad-shouldered, a weathered knight; messy dark brown hair, almost black; light stubble; tired, watchful brown eyes; dark worn steel half-plate over a dark gambeson, the plates dented and repaired in mismatched styles, brown leather belts; a tattered oxblood cloak wrapped high around his shoulders like a cowl, its torn hem never mended; no helmet; a long arming sword with a brown leather grip; a dark iron heater shield with a raised four-point star, visibly repaired with a riveted patch plate. Canon details that must be visible even if the sheet is unclear: a small Crown Guard star on the breastplate with an empty, hammered socket directly above it where a crown was beaten off; the sword's round hilt crest socket plugged with a plain iron disc; a small gray wax seal pressed into the shield's rim. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult man drawn chibi, keeping adult design cues (stubble, tired adult eyes, armor, cloak) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated cloak, broad pauldrons and an oversized heater shield, angular cloth folds, heavy shadow masses; armor as broad flat plates. Limited desaturated palette of slate steel, dark brown, taupe and black plus ONE accent: oxblood. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose idle: standing square and planted, weight even, sword held low and point-down in one hand, the heater shield on the other arm resting against his side, cloak hanging heavy; tired, watchful face. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: an empty socket above the star, never a crown anywhere on his armor; hair always dark; no helmet; the cloak stays oxblood and torn. The shield stays visibly repaired.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, chain mail texture, stippling, film grain, crown emblem, helmet, light hair, fur mantle, bare skin, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped weapon
```

**Metadata:**
```
id: mahmut
kind: battle_pose
mode: play
variant: idle
reference files: art/sheets/char-mahmut-uomd.png + art/sheets/chibi_ref/chibi_ref_mahmut.png
key colour: #00FFFF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 7. Battle pose — attack

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is his approved idle pose: copy its scale, camera, proportions, armor and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Mahmut, an adult man (28), tall and broad-shouldered, a weathered knight; messy dark brown hair, almost black; light stubble; tired, watchful brown eyes; dark worn steel half-plate over a dark gambeson, the plates dented and repaired in mismatched styles, brown leather belts; a tattered oxblood cloak wrapped high around his shoulders like a cowl, its torn hem never mended; no helmet; a long arming sword with a brown leather grip; a dark iron heater shield with a raised four-point star, visibly repaired with a riveted patch plate. Canon details that must be visible even if the sheet is unclear: a small Crown Guard star on the breastplate with an empty, hammered socket directly above it where a crown was beaten off; the sword's round hilt crest socket plugged with a plain iron disc; a small gray wax seal pressed into the shield's rim. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult man drawn chibi, keeping adult design cues (stubble, tired adult eyes, armor, cloak) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated cloak, broad pauldrons and an oversized heater shield, angular cloth folds, heavy shadow masses; armor as broad flat plates. Limited desaturated palette of slate steel, dark brown, taupe and black plus ONE accent: oxblood. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose attack: Oathless Cut: a heavy diagonal downward sword slash toward screen-right, front foot stepping in, shield pulled tight to his body, cloak swinging behind; the full sword blade stays inside the frame; no slash trail effect. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: an empty socket above the star, never a crown anywhere on his armor; hair always dark; no helmet; the cloak stays oxblood and torn. The shield stays visibly repaired.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, chain mail texture, stippling, film grain, crown emblem, helmet, light hair, fur mantle, bare skin, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped weapon
```

**Metadata:**
```
id: mahmut
kind: battle_pose
mode: play
variant: attack
reference files: art/sheets/char-mahmut-uomd.png + battle_pose_mahmut_idle (approved)
key colour: #00FFFF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 8. Battle pose — hit

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is his approved idle pose: copy its scale, camera, proportions, armor and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Mahmut, an adult man (28), tall and broad-shouldered, a weathered knight; messy dark brown hair, almost black; light stubble; tired, watchful brown eyes; dark worn steel half-plate over a dark gambeson, the plates dented and repaired in mismatched styles, brown leather belts; a tattered oxblood cloak wrapped high around his shoulders like a cowl, its torn hem never mended; no helmet; a long arming sword with a brown leather grip; a dark iron heater shield with a raised four-point star, visibly repaired with a riveted patch plate. Canon details that must be visible even if the sheet is unclear: a small Crown Guard star on the breastplate with an empty, hammered socket directly above it where a crown was beaten off; the sword's round hilt crest socket plugged with a plain iron disc; a small gray wax seal pressed into the shield's rim. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult man drawn chibi, keeping adult design cues (stubble, tired adult eyes, armor, cloak) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated cloak, broad pauldrons and an oversized heater shield, angular cloth folds, heavy shadow masses; armor as broad flat plates. Limited desaturated palette of slate steel, dark brown, taupe and black plus ONE accent: oxblood. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose hit: taking a blow on the shield: jarred half a step back, shield arm pushed in against his chest, shoulders braced, teeth clenched, one eye narrowed; he does not fall; unharmed. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: an empty socket above the star, never a crown anywhere on his armor; hair always dark; no helmet; the cloak stays oxblood and torn. The shield stays visibly repaired.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, chain mail texture, stippling, film grain, crown emblem, helmet, light hair, fur mantle, bare skin, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped weapon
```

**Metadata:**
```
id: mahmut
kind: battle_pose
mode: play
variant: hit
reference files: art/sheets/char-mahmut-uomd.png + battle_pose_mahmut_idle (approved)
key colour: #00FFFF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 9. Battle pose — skill

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is his approved idle pose: copy its scale, camera, proportions, armor and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Mahmut, an adult man (28), tall and broad-shouldered, a weathered knight; messy dark brown hair, almost black; light stubble; tired, watchful brown eyes; dark worn steel half-plate over a dark gambeson, the plates dented and repaired in mismatched styles, brown leather belts; a tattered oxblood cloak wrapped high around his shoulders like a cowl, its torn hem never mended; no helmet; a long arming sword with a brown leather grip; a dark iron heater shield with a raised four-point star, visibly repaired with a riveted patch plate. Canon details that must be visible even if the sheet is unclear: a small Crown Guard star on the breastplate with an empty, hammered socket directly above it where a crown was beaten off; the sword's round hilt crest socket plugged with a plain iron disc; a small gray wax seal pressed into the shield's rim. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult man drawn chibi, keeping adult design cues (stubble, tired adult eyes, armor, cloak) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated cloak, broad pauldrons and an oversized heater shield, angular cloth folds, heavy shadow masses; armor as broad flat plates. Limited desaturated palette of slate steel, dark brown, taupe and black plus ONE accent: oxblood. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose skill: Broken Crest Guard: a wide sideways step, the heater shield swung out and raised to cover an unseen ally behind him on screen-left, sword held back and low, head turned to watch the enemy; the star on his breastplate and the shield face both toward the viewer; shield effects are a separate asset. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: an empty socket above the star, never a crown anywhere on his armor; hair always dark; no helmet; the cloak stays oxblood and torn. The shield stays visibly repaired.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, chain mail texture, stippling, film grain, crown emblem, helmet, light hair, fur mantle, bare skin, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped weapon
```

**Metadata:**
```
id: mahmut
kind: battle_pose
mode: play
variant: skill
reference files: art/sheets/char-mahmut-uomd.png + battle_pose_mahmut_idle (approved)
key colour: #00FFFF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 10. Battle pose — guard

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is his approved idle pose: copy its scale, camera, proportions, armor and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Mahmut, an adult man (28), tall and broad-shouldered, a weathered knight; messy dark brown hair, almost black; light stubble; tired, watchful brown eyes; dark worn steel half-plate over a dark gambeson, the plates dented and repaired in mismatched styles, brown leather belts; a tattered oxblood cloak wrapped high around his shoulders like a cowl, its torn hem never mended; no helmet; a long arming sword with a brown leather grip; a dark iron heater shield with a raised four-point star, visibly repaired with a riveted patch plate. Canon details that must be visible even if the sheet is unclear: a small Crown Guard star on the breastplate with an empty, hammered socket directly above it where a crown was beaten off; the sword's round hilt crest socket plugged with a plain iron disc; a small gray wax seal pressed into the shield's rim. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult man drawn chibi, keeping adult design cues (stubble, tired adult eyes, armor, cloak) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated cloak, broad pauldrons and an oversized heater shield, angular cloth folds, heavy shadow masses; armor as broad flat plates. Limited desaturated palette of slate steel, dark brown, taupe and black plus ONE accent: oxblood. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose guard: defensive stance: knees bent, shield braced in front of his body with its star facing screen-right, sword resting ready above the shield's upper edge, cloak drawn around his back, eyes watchful over the rim. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: an empty socket above the star, never a crown anywhere on his armor; hair always dark; no helmet; the cloak stays oxblood and torn. The shield stays visibly repaired.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, chain mail texture, stippling, film grain, crown emblem, helmet, light hair, fur mantle, bare skin, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped weapon
```

**Metadata:**
```
id: mahmut
kind: battle_pose
mode: play
variant: guard
reference files: art/sheets/char-mahmut-uomd.png + battle_pose_mahmut_idle (approved)
key colour: #00FFFF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```


## 11. Battle pose — victory

```
CHIBI GAME SPRITE, not an illustration. The first attached image is this character's model sheet: take ONLY the costume design, colours, hairstyle, face cues and weapon shape from it; do NOT copy its painterly rendering, realistic body proportions or magic effects. The second attached image is his approved idle pose: copy its scale, camera, proportions, armor and feet baseline exactly; change only the pose. Single full-body chibi battle sprite of Mahmut, an adult man (28), tall and broad-shouldered, a weathered knight; messy dark brown hair, almost black; light stubble; tired, watchful brown eyes; dark worn steel half-plate over a dark gambeson, the plates dented and repaired in mismatched styles, brown leather belts; a tattered oxblood cloak wrapped high around his shoulders like a cowl, its torn hem never mended; no helmet; a long arming sword with a brown leather grip; a dark iron heater shield with a raised four-point star, visibly repaired with a riveted patch plate. Canon details that must be visible even if the sheet is unclear: a small Crown Guard star on the breastplate with an empty, hammered socket directly above it where a crown was beaten off; the sword's round hilt crest socket plugged with a plain iron disc; a small gray wax seal pressed into the shield's rim. Gritty 2D ink style: chibi anime proportions about 2.5 heads tall, large head and small body; an adult man drawn chibi, keeping adult design cues (stubble, tired adult eyes, armor, cloak) with no childlike facial cues; fully covered costume. Bold, uneven black ink outline, thick on the outer silhouette and thinner inside, slightly angular brush-made lines, closed and continuous, no glow and no soft outline. Flat cel shading in three tone steps, with sparse bold hand-drawn hatch strokes only in the deepest shadows. Strong readable silhouette: exaggerated cloak, broad pauldrons and an oversized heater shield, angular cloth folds, heavy shadow masses; armor as broad flat plates. Limited desaturated palette of slate steel, dark brown, taupe and black plus ONE accent: oxblood. PROPORTIONS: about 2.5 heads tall, the head about 40% of the full height, short stubby limbs, small simplified hands, sturdy flat-soled boots; the costume simplified into a few big shapes; the costume clean and intact. Pose victory: sword lowered point-down to the ground with one hand on the pommel, shield resting against his leg, glancing back over his shoulder toward screen-left as if checking on someone behind him, a small tired relieved half-smile. Facing screen-right, three-quarter view, feet on a fixed baseline at 85% of the image height, figure about 60% of the image height; generous empty margin on all sides. One figure only, not a grid, not a sprite sheet. Flat, evenly lit, pure #00FFFF cyan background; hard-edged silhouette; no gradient, no floor shadow, and no glow, smoke or particles touching the image edges. No text, logos, watermarks, signatures or UI in the image. Locks: an empty socket above the star, never a crown anywhere on his armor; hair always dark; no helmet; the cloak stays oxblood and torn. The shield stays visibly repaired.
```

**Negative:**
```
painterly illustration, semi-realistic figure, tall slender body, long legs, high heels, large magic effects, energy swirls, floating particles, text, logo, watermark, UI, childlike face, baby face, realistic proportions, soft airbrush shading, glow, soft outline, gradient, painterly blending, micro-texture, chain mail texture, stippling, film grain, crown emblem, helmet, light hair, fur mantle, bare skin, floor shadow, cast shadow, grid, sprite sheet, multiple characters, cropped feet, cropped weapon
```

**Metadata:**
```
id: mahmut
kind: battle_pose
mode: play
variant: victory
reference files: art/sheets/char-mahmut-uomd.png + battle_pose_mahmut_idle (approved)
key colour: #00FFFF
native size: 1024x1536 (generator native)
intended runtime size: decided after pilot
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```
