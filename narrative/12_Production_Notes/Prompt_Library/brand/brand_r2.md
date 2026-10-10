# Brand r2 — logo and key art (2026-09-30)

**Status:** APPROVED FOR PRODUCTION (Gemini, `tools/gen_image.py`, model `gemini-3.1-flash-image`, size 2K).

**Why r2:** the current logo reads as a generic blood-and-sword title (a red cross-sword and thorn arc: nothing from our story), and the current key art is off-model (audit CC-12: Fadyme with red eyes and a black-red hood, Mahmut in fur, two unknown pale-haired figures, crimson used as a fill, dense micro-texture).

**Exception to the no-game-name rule (C41):** brand assets are the only prompts that may contain the game's title, and only the logo renders it. The key art is generated WITHOUT text; the approved logo is composited onto it afterwards, so the title is identical everywhere.

**Order:** 1 logo → approve → 2 key art (portrait) → approve. Wide, square and app-icon variants follow from the approved key art. Then the Fadyme sheet r2, which uses the approved key art as its style reference.

**Story the brand must say:** the title is Mahmut's blindness, not Fadyme's: she knows she is dying and hides it; he walks in front of her guarding a road he does not know leads to her death. Symbols from canon only: the silver bell with a thorn clapper (her weapon, House Veyr), the broken crown fragment (her father's circlet), a thin crimson eclipse ring (the one focal crimson), names fading like ash. No blood.

---

## 1. Logo — wordmark with the bell emblem

```
The attached image is the current logo: keep only its general idea of a weathered gothic serif wordmark with a small subtitle line; replace its red cross-sword and thorn arc completely. Design a game logo for a dark-fantasy story about a woman who hides that she is dying. Main word "UNAWARE" in large weathered bone-white gothic serif capitals with sharp, slightly worn edges and fine hairline cracks drawn as a few clean strokes, not texture; below it the smaller spaced small-caps line "OF MY DEMISE" flanked by two thin silver rules. Emblem integrated into the wordmark: a small silver bell whose clapper is a long silver thorn, hanging from the crossbar of the letter W, inside a thin crimson eclipse ring that frames the bell; one small broken fragment of a silver crown resting on the top edge of the ring. Colours: bone white, tarnished silver, deep plum shadow in the letter bevels, and crimson ONLY for the thin eclipse ring. Clean vector-like edges, strong readability at small size, symmetrical and centred, generous empty margin on all sides. Flat, evenly lit, pure #00FF00 green background; hard-edged silhouette; no gradient, no floor shadow, no glow or particles touching the edges. Exactly this text and nothing else: "UNAWARE" and "OF MY DEMISE", spelled exactly.
```

**Negative:**
```
blood, dripping, splatter, sword, cross, skull, thorns wrapped around letters, flames, extra words, misspelled letters, extra letters, watermark, signature, gradient background, 3D chrome, glossy plastic, heavy grunge texture, noise, micro-texture, green in the logo
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
revision: v001
date: 2026-09-30
```

## 2. Key art — portrait (store and title screen)

```
The first attached image is Fadyme's approved model sheet and the second is Mahmut's approved model sheet: match their faces, hair, costumes, palettes and weapons exactly; ignore the sheets' layouts, labels, text, backgrounds and story panels. Vertical key art illustration for a dark-fantasy story. Polished hand-painted anime light-novel illustration, gothic dark fantasy, clean painterly shading, soft consistent light; large calm areas, detail only at the faces and hands; no micro-texture, no film grain. SCENE: dusk on a high stone road that climbs toward a distant crater-shaped mountain; above the mountain an unmoving eclipse, a black disc with a thin crimson ring, the only crimson in the image. In the middle ground MAHMUT, an adult man (28), dark messy hair, stubble, tired watchful brown eyes, dark worn half-plate with a small star on the breastplate and an empty hammered socket above it, torn oxblood cloak, long arming sword lowered, repaired heater shield on his arm, walks one step ahead and looks forward along the road, guarding, not looking back. In the foreground, closer to the viewer and slightly behind him, FADYME, an adult woman (22), long pale ash-blonde hair from under a deep plum hood, violet eyes, a small broken silver crown fragment at the hood's front edge, white scarf high at the throat, deep plum layered mantle with silver-lilac embroidery, thin dark gloves holding a silver bell on a chain whose clapper is a long silver thorn; she looks back over her shoulder toward the viewer with a small, calm, polite smile and tired eyes: she knows something he does not. Around her, a few pale flakes like ash drift UPWARD, and a few thin threads of her silver-lilac embroidery lift and fade at the hem, the only hint of what is happening to her. Palette: plum, slate, oxblood, dusk grey-blue, silver, one thin crimson ring. The lower third of the image is calm and darker (road stones and mantle folds) and empty of important detail, reserved for the title logo which is added later. No text, letters, logos, watermarks, signatures or UI anywhere in the image.
```

**Negative:**
```
text, letters, title, logo, watermark, signature, UI, red eyes, black-red hood, red hood, fur mantle, fur collar on Mahmut, extra characters, crowd, pale-haired background figures, blood, gore, crimson sky, red fog, red particles, crimson fill, dense lace micro-texture, moire, film grain, pin-up framing, cleavage, chest crop
```

**Metadata:**
```
id: key_art
kind: brand
mode: narrative
variant: portrait_r2
reference files: art/sheets/char-fadyme-uomd.png + art/sheets/char-mahmut-uomd.png
key colour: opaque
native size: 1080x1920
intended runtime size: store portrait, title screen background
ORDER_LEVEL: n/a
revision: v001
date: 2026-09-30
```
