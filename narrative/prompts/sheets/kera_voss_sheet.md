# Character Sheet Prompt — Kera Voss (r2, 2026-09-30: re-render in the series style)

**Why r2:** Kera's approved sheet (`art/sheets/char-kera-voss-uomd.png`) is on-model but uses a different page style (light paper, "Action Poses", no Story State or Mood rows). r2 keeps her design exactly and re-renders her on the series layout of the Fadyme and Mahmut sheets. The r1 prompt is archived at `archive/2026-09-30_kera_sheet_r1/`.

**Attach two images, in this order:**
1. `art/sheets/char-kera-voss-uomd.png` — Kera's current sheet: identity (face, hair, hat, goggles, outfit, palette, mortar).
2. `art/sheets/char-fadyme-uomd.png` — layout and painting style only.

**After approval:** save as `art/sheets/char-kera-voss-uomd.png` (old file → `archive/2026-09-30_kera_sheet_r1/`); re-crop `art/sheets/chibi_ref/chibi_ref_kera_voss.png` from its chibi panel; then the production prompt list (`prompts/asset_pipeline/kera_voss.md`) is written from the new sheet.

Canon sources: `lore/characters/kera_voss.md`, `content/characters_part1.json` (Ember, alchemist_dps, 4★, skills Flask Flick / Cinder Tonic / Measure Twice / Redoubt Reaction), `lore/elements.md` (Ember), companion stories `cs_kera_voss_1–4`, 3-2 direction.

## Main prompt

```
TWO REFERENCE IMAGES. IMAGE 1 shows THIS SAME character, Kera Voss: keep her face, hair, hat, goggles, coat, apron, flask belt, brass mortar, palette and proportions exactly as in image 1; ignore image 1's page layout, paper colour, labels and text. IMAGE 2 is a character sheet of a DIFFERENT character: use it ONLY for page layout, panel arrangement, dark painted panels on aged parchment, typography style and overall painting style; do NOT copy that character's face, hair, hood, clothing, bell, colours or pose.

Vertical character design reference sheet, 2:3 portrait, 1024x1536, for a dark gothic fantasy anime gacha RPG. Painterly dark-gothic anime illustration, desaturated overall with warm ember-orange firelight on this character, fine brass line ornament. Dark painted panels over aged parchment with thin ruled borders, the same layout language as image 2.

SUBJECT: Kera Voss, a 20-year-old adult woman, a field alchemist of the Red Vial Guild's archive wing. Petite and quick, always slightly in motion; sharp-tongued and prickly, caring underneath. Shoulder-length messy ash-silver hair, choppy at the ends with a few singed strands; bright amber eyes; a faint soot smudge on one cheek. Her silhouette is dominated by a very wide-brimmed, tall-crowned dark brown field hat with a sagging tip (her old master's), with brass goggles with round ember-orange lenses strapped around the hat band. Dark brown fitted field coat with a short capelet and deep orange lining, fitted sleeves with leather bracers; a high-collared cream shirt; a long cream canvas apron, clean except for one scorch mark near the hem; a broad leather flask belt and a chest bandolier holding stoppered vials of amber, red and smoke-grey liquid; dark trousers, laced brown boots. Weapon: a heavy engraved brass hand mortar and pestle carried at her hip, and one sealed crystal vial of glowing ember liquid kept apart from the others. Fully clothed and practical. Palette: ember orange, dark brown, taupe, brass, cream, charcoal.

LAYOUT (match image 2): top left, the title "Kera Voss" in a weathered serif, below it "The Field Alchemist" and the italic line "Measure twice. Then ask who is paying." Left 40%: full-body hero pose on a muddy orchard road under bare apple trees at dusk, her small rebuilt alchemy cart behind her, one hand on the brass mortar at her hip, the other raising the glowing ember vial, faint smoke curling around her boots. Top centre: large close-up portrait, hat brim shading her eyes, goggles catching firelight, a scowl that is almost a smile.

EXPRESSIONS (top right, six labelled heads, same hat and goggles in all): "Tsundere Scowl" (eyes narrowed, mouth tight), "Focused" (goggles down over her eyes, measuring a vial), "Proud Smile" (confident small grin), "Flustered" (cheeks faintly flushed, looking away), "Guilty" (eyes down, lips pressed), "Defiant" (chin up, eyes blazing).

CENTRE: "Idle Pose" (hat tilted, tapping a foot, mortar in hand) and "Casting Pose" (flicking a small burning vial, ember-orange fire trailing from it) as two full-body panels.

RIGHT COLUMN: "Redoubt's Last Vial (Detail)" showing the engraved brass mortar and pestle and the one sealed glowing ember vial; "Materials" swatches labelled Felt (hat), Waxed canvas (coat), Orange wool (lining), Cream canvas (apron), Leather (belts), Brass (mortar, goggles), Glass (vials).

MIDDLE BAND: "Turnaround" front, side, back labelled "Front" "Side" "Back", the back view showing the full hat brim, capelet and flask belt; "Color Palette" six round swatches: ember orange, dark brown, taupe, polished brass, cream, charcoal; "Chibi / Battle Sprite" four chibi poses in the series chibi style: idle with mortar, flicking a burning vial, a vial shattering into orange embers, holding her hat down against a large ember burst.

STORY STATE VARIATIONS (bottom band, four labelled panels, Kera alone in each): "Sorted by Volatility" (relabelling bottles on her cart in red ink, sleeves rolled), "The Sample Book" (reading an old ledger by mushroom-lamp light, stricken), "Honest Labels" (pinning a handwritten notice to a wooden door, paste brush in hand, jaw set), "Formula, Incomplete" (writing by lantern at dawn on cold stone, exhausted, hat set beside her).

MOOD & ATMOSPHERE strip: a river city of glassworks at dusk, an orchard village square with blank wooden name boards, an underground archive lit by mushroom lamps, an open recipe book beside glowing vials.

Bottom right: large VN bust, chest-up, three-quarter view, hat and goggles, amber eyes, a sharp little smile, on a soft dark painted vignette.
```

## Negative prompt

```
game title, logo, watermark, extra text, misspelled title, hood, veil, plum, purple, violet magic, lilac, long hair, hair past the shoulders, blonde hair, pure white hair, pointed witch hat with stars, broomstick, magic wand, staff, cauldron, bare shoulders, cleavage, low neckline, short skirt, thigh-highs, pin-up, spectacles, teal cloak, green cloak, fur collar, plate armor, heater shield, sword, other characters, red-gold fire, gore, 3D render, photorealism, extra fingers, duplicated character in turnaround, light blank paper background
```

## Must-match checklist

- [ ] Face, hat, goggles, coat, apron, belts and mortar identical to image 1 (no redesign).
- [ ] Series layout: title top left, hero left, close-up top centre, expressions top right, story states and mood strip at the bottom, VN bust bottom right; dark painted panels, not light paper.
- [ ] Hat dominates the silhouette; hair never reads as Fadyme's (shoulder-length, ash-silver, no hood, no plum).
- [ ] Fire is ember orange (not Rikka's red-gold).
- [ ] Only Kera in every panel (story panels with other characters caused errors on other sheets, audit VIS-05).
- [ ] Text spelled exactly: "Kera Voss", "The Field Alchemist", "Measure twice. Then ask who is paying."
