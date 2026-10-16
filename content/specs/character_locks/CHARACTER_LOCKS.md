# Canonical Character Visual Locks (`content/specs/character_locks/`)

Once a character's visual identity (face structure, hair, silhouette, and proportions) is approved by the Game Director, their canonical reference images are permanently locked in this directory and **MUST** be passed via `ImagePaths` on every future `generate_image` call (Light Novel knee-up `boydan` sprites, Prologue/Chapter event CG stills, Key Art, and UI portraits).

## 1. Fadyme (`fadyme`)
- **Canonical Head / Hair / Hood Lock:** [`fadyme_canonical_head_lock.png`](file:///c:/Users/PC/Drive'ım/unaware-of-my-demise/content/specs/character_locks/fadyme_canonical_head_lock.png)
- **Canonical Knee-Up (`Boydan`) Sprite Lock:** `fadyme_canonical_boydan_lock.jpg`
- **Locked Visual Traits:**
  - **Hair:** Voluminous, airy, tousled/feathery, multi-layered wavy pale ash-blonde / silver-blonde locks cascading abundantly from beneath the hood around her cheeks, neck, and shoulders.
  - **Face Structure:** Delicate, refined, mature anime facial structure with soft oval chin, almond-shaped violet eyes with thick dark upper lashes, and composed soulful depth.
  - **Hood & Scarf:** Deep plum-black gothic hood (`#1A111E` exterior, `#321B29` burgundy lining) with thorny silver spiderweb-crown filigree running asymmetrically along the side/upper rim of the hood (strictly NO tiara sitting on top of the hood), a small silver bell hanging at the temple above her ear, a silver drop earring, and a high wrapped white cloth neck scarf (strictly NO ruffled lace jabot).
  - **Body Proportions & Outfit (`Boydan`):** Slender knee-up standing proportions, fitted dark plum-black gothic dress and pilgrim mantle with silver-lilac scroll/vine embroidery, double leather waist belts with silver buckles and chains, dark gloves, and a small silver thorn-bell on a chain.

## 2. Mahmut (`mahmut`)
- **Canonical Head / Face / Armor Lock:** [`mahmut_canonical_head_lock.png`](file:///c:/Users/PC/Drive'ım/unaware-of-my-demise/content/specs/character_locks/mahmut_canonical_head_lock.png)
- **Canonical Knee-Up (`Boydan`) Sprite Lock:** [`mahmut_canonical_boydan_lock.jpg`](file:///c:/Users/PC/Drive'ım/unaware-of-my-demise/content/specs/character_locks/mahmut_canonical_boydan_lock.jpg)
- **Locked Visual Traits:**
  - **Hair & Face:** Clean cel-shaded anime knight with tousled/spiky dark-brown hair, subtle light jawline stubble, and warm amber-gold eyes.
  - **Armor & Cloak (`Boydan`):** Deep crimson-red scarf-cloak wrapped around the neck and shoulders, smooth dark gunmetal-steel medieval half-plate chest armor featuring the crimson-and-silver eight-pointed star emblem at the center of the chestplate with a small round black empty socket hole directly above the star, segmented steel pauldrons and gauntlets, brown leather waist sword-belt, sheathed arming sword, and star-emblem heater shield.

## 3. Continuity Rule for All Future Characters
- Whenever a new hero, companion, or antagonist is introduced:
  1. Lock their approved canonical head/hair crop (`<id>_canonical_head_lock.png`) and knee-up standing sprite (`<id>_canonical_boydan_lock.jpg`) in `content/specs/character_locks/`.
  2. Archive any superseded drafts in `archive/<id>_legacy_variants/`.
  3. Always pass the locked files in `ImagePaths` for every subsequent expression variant, cutscene CG still, and promotional illustration.
