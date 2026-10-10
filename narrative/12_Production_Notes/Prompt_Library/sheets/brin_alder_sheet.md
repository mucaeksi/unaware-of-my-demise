# Character Sheet Prompt — Brin Alder (r2, 2026-09-30: re-render in the series style)

**Why r2:** Brin's current sheet (`art/sheets/char-brin-alder-uomd.png`) is on-model but uses the light-paper style (like Kera's old sheet), its story panels include other characters (audit VIS-05 risk), and its text has a contraction ("That's") and a star typo ("4★★") (VIS-08). r2 keeps her design exactly and moves her to the Fadyme/Mahmut layout.

**Attach two images, in this order:**
1. `art/sheets/char-brin-alder-uomd.png` — Brin's current sheet: identity (face, braid, cloak, fur collar, gambeson, axe, buckler).
2. `art/sheets/char-fadyme-uomd.png` — layout and painting style only.

**After approval:** save as `art/sheets/char-brin-alder-uomd.png` replacing the current file (move the current one to `archive/2026-09-30_brin_sheet_r1/` first). Re-crop `art/sheets/chibi_ref/chibi_ref_brin_alder.png` from its chibi panel. Then `prompts/asset_pipeline/brin_alder.md` applies.

Canon sources: `lore/characters/brin_alder.md`, `content/characters_part1.json` (Stone, tank, 4★, front row; Rootsplitter / Oakbrace / Hold the Gate / Alderwall), `lore_text_part1.json` (weapon: "A tree does not stand for itself."), companion stories `cs_brin_alder_1–4`.

## Main prompt

```
TWO REFERENCE IMAGES. IMAGE 1 shows THIS SAME character, Brin Alder: keep her face, hair and braid, cloak, fur collar, gambeson, belts, boot guards, hand axe, buckler, palette and proportions exactly as in image 1; ignore image 1's page layout, paper colour, labels, text and story panels. IMAGE 2 is a character sheet of a DIFFERENT character: use it ONLY for page layout, panel arrangement, dark painted panels on aged parchment, typography style and overall painting style; do NOT copy that character's face, hair, hood, clothing, bell, colours or pose.

Vertical character design reference sheet, 2:3 portrait, 1024x1536, for a dark gothic fantasy anime gacha RPG. Painterly dark-gothic anime illustration, desaturated, cold rain light with pine-green shadows, fine iron line ornament. Dark painted panels over aged parchment with thin ruled borders, the same layout language as image 2.

SUBJECT: Brin Alder, a 23-year-old adult woman, the village guard and woodcutter of an alder-wood village on a rainy forest road. Sturdy, broad-shouldered, quiet; a steady, warm face that does not smile often. Long brown hair, loose and a little messy around the face, gathered into one long braid over her shoulder; brown eyes. A heavy pine-green village-guard cloak with a thick pale grey wolf-fur collar; a quilted cream gambeson; layered brown leather belts with pouches; thick leather gloves; dark trousers; tall brown boots with iron boot guards. Weapons: a woodcutter's hand axe with a long plain haft, and a round iron buckler with a raised boss, alder wood showing at its rim under the iron and leather. Fully clothed and practical. Palette: pine green, iron grey, cream, brown.

LAYOUT (match image 2): top left, the title "Brin Alder" in a weathered serif, below it "The Forest's Quiet Shield" and the italic line "A tree does not stand for itself." Left 40%: full-body hero pose on a rainy forest road before a small stone wayshrine, axe low in one hand, buckler on the other arm, cloak heavy with rain. Top centre: large close-up portrait, braid over her shoulder, rain on the fur collar, a calm, watchful look.

EXPRESSIONS (top right, three labelled heads, same braid and collar in all): "Quiet Focus" (level gaze, mouth closed), "Protective Concern" (brows drawn, eyes on someone beside her), "Small Smile" (a rare, small warm smile).

CENTRE: "Idle Pose" (standing planted, axe resting on her shoulder, buckler at her side) and "Guard Pose" (knees bent, buckler raised, axe held back) as two full-body panels.

RIGHT COLUMN: "Alderwall's Promise (Detail)" showing the hand axe and the round iron buckler with alder wood at its rim; "Materials" swatches labelled Wool (cloak), Wolf fur (collar), Quilted cotton (gambeson), Leather (belts, gloves), Iron (buckler, boot guards), Alder wood (haft, buckler core).

MIDDLE BAND: "Turnaround" front, side, back labelled "Front" "Side" "Back", the back view showing the long braid and the full cloak; "Color Palette" four round swatches: pine green, iron grey, cream, brown; "Chibi / Battle Sprite" four chibi poses in the series chibi style: idle with buckler, axe strike, buckler raised in a taunting stance, bracing low with a pale stone-grey shield light around her.

STORY STATE VARIATIONS (bottom band, four labelled panels, Brin alone in each): "The Roof" (inside a timber shelter, bracing a heavy fallen beam overhead with both arms, jaw clenched), "The Road Back" (walking at the front on a rainy forest road, glancing back over her shoulder), "Letters in the Bark" (touching carved letters on an old alder trunk, quiet), "Holding the Stair" (at the top of a stone stair at dawn, buckler raised, cloak torn, steady).

MOOD & ATMOSPHERE strip: a small alder-wood village under rain, a stone wayshrine with a lit lantern, a woodcutters' shelter at dusk, a muddy refugee road between tall pines.

Bottom right: large VN bust, chest-up, three-quarter view, braid over the shoulder, fur collar, calm watchful face, on a soft dark painted vignette.
```

## Negative prompt

```
game title, logo, watermark, extra text, misspelled title, hood, veil, plum, purple, lilac, blonde hair, pale hair, short hair, plate armor, heater shield, sword, oxblood cloak, bare shoulders, cleavage, low neckline, pin-up, other characters, children, gore, 3D render, photorealism, extra fingers, duplicated character in turnaround, light blank paper background
```

## Must-match checklist

- [ ] Face, braid, cloak, fur collar, gambeson, axe and buckler identical to image 1 (no redesign).
- [ ] Series layout (title top left, hero left, close-up top centre, expressions top right, story states and mood strip at the bottom, VN bust bottom right); dark painted panels.
- [ ] Round buckler, never a heater shield (that silhouette is Mahmut's).
- [ ] Only Brin in every panel.
- [ ] Text spelled exactly: "Brin Alder", "The Forest's Quiet Shield", "A tree does not stand for itself." (no contractions in the tagline, no star rating).
