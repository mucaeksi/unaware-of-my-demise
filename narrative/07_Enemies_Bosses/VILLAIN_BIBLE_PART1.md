# Part I Adversary Bible

Part I adds two recurring antagonists to the existing 20-character playable roster. Neither is playable or required from a banner. Both are adults. Their art briefs are not generated art; visual production remains out of scope for this design pass.

## 1. Lady Yseldra Vale — The Bell-Widow

**Role:** Female opening antagonist, recurring rival, Chapter 2-5 boss.  
**Age:** 34.  
**Former office:** Royal Inquisitor and keeper of the Sevenfold Crown's sealed records.  
**Motive:** Yseldra witnessed previous Last Bell heirs being used as living anchors. She believes the only certain way to stop the next sacrifice is to remove Fadyme from every road leading to the altar—even if that means imprisoning her. She is correct that the ritual is consuming Fadyme, but wrongly assumes that keeping her away from the machine will halt the curse.  
**Boundary:** She will fight Mahmut and disable armed guards, but refuses to harm civilians or order a public execution. She uses the dead and sealed corridors to delay the party rather than massacre a village.  
**Mirror to Mahmut:** Both believe protection can justify withholding the truth. Mahmut protects Fadyme by hiding danger from her; Yseldra protects her by taking away her choice. Neither can save her through secrecy.

**Silhouette and palette:** Tall, straight-backed adult woman; an opaque mourning veil over a bone-white half-mask, long split surcoat over fitted mail, leather gloves with seven small bell-clapper rings. No exposed-skin or pin-up framing. Palette: black plum, ash ivory, cold brass. Her cracked handbell is the unmistakable prop; its clapper is tied off with red thread.

**Brand mark:** `mark_villains_bell_widow` — cracked bell inside a seven-notch wax seal; 512×512 master, 128×128 standard, 64×64 combat/status slot. Never use a skull as the main shape.

**Voice direction (JP):** Low, measured contralto; crisp consonants, almost no breathiness. She speaks as if issuing a verdict, then allows one small pause before a personal truth. Do not play her as gleefully cruel.

**Story appearances:** Opening VN before 1-1; distant bell/ash trace in Ch. 1; full reveal and boss at 2-5; her seal on Rusk's order at 3-5; the same seal beside C.V. in the Ashen ledger at 6-4; reflection after 7-5 behind Cael, with one spoken warning (the script is authoritative, C8).

**Key English lines:**

- Opening: “You are guarding a door that has already chosen its offering.”
- Chapter 2: “You keep asking who wrote it. Ask who keeps it running.”
- Ending: “He is offering you the same lie that made her the price.”

**Boss signature:** *Widow's Verdict* — seals one ally's skill for one turn while Yseldra charges a line attack; breaking the visible wax seal frees the ally and interrupts the judgment. Every target and telegraph remains readable in Auto-Battle.

## 2. Lord Cael Veyr — The Clockless Chancellor

**Role:** Male Part I final twist, architect of the Rewrite (the Unwritten Hour and the altar's Hinge, its time-loop design); not a playable roster member.  
**Age:** 41 at the time of the Crownfall; current age uncertain because he has been outside ordinary time.  
**Former office:** Royal chancellor, ritual architect and keeper of the court's handless chronometer. Public history lists him among the dead at the capital's fall.  
**Motive:** Cael loved a kingdom, a household and a future he could not accept losing. He designed the Rewrite around the Unwritten Hour so Veyrhold could be returned to the minute before Crownfall (his public promise; his hidden aim reaches further back, see the 2026-09-29 decisions below). He believes one heir's life is a fair price for restoring thousands of lives, and calls the sacrifice temporary because the hour would be rewritten. His reasoning is coherent; his consent is absent.  
**Boundary:** Cael avoids uncontrolled destruction because it damages the historical moment he wants to restore. He manipulates officials, orders and machinery, and treats individual suffering as an accounting error.  
**Mirror to Fadyme (sharpened by C33):** she set out to offer herself, by choice, for the living; his machine would have taken that same offering for his past. Fadyme gives away her remaining time so other people can have a future; Cael takes her time to force his preferred past back into existence.

**Silhouette and palette:** Slender adult man in a severe black court coat over antique-gold scale panels, one empty signet socket, gloves with no insignia. A signet chain carries a small watch with no hands. The face is partly concealed by fractured mirror reflection, not a permanent mask. Palette: ink black, aged gold, cold white. Signature prop: the unwound handless watch.

**Brand mark:** `mark_villains_clockless_chancellor` — open circle with a missing clock hand and one broken crown arc; 512×512 master, 128×128 standard, 64×64 UI slot.

**Voice direction (JP):** Quiet adult baritone, courtly and patient; no villainous growl. He places a deliberate pause before any offer, so kindness and threat share the same cadence.

**Clue trail:** C.V. beneath the seal at 3-5; a handless-watch diagram in the 6-4 ledger; the First Eclipse record describes the Construct as a “hinge” but omits its maker; full name and plan only after Mahmut understands Fadyme is dying.

**Ending lines:**

- “You broke the instrument, Sir Mahmut. You have not broken the hour.”
- “One life to return a kingdom to the moment before it fell. Help me, and I can give her time back.”
- “Come to the Clockless Court, and decide whether you believe her—or me.”

## Story and data constraints

- Keep the existing emotional confession before Cael's reveal; the twist is a second beat after a clean silence.
- Do not add a battle node, stamina cost or playable character slot for either villain.
- Yseldra's Chapter 2 boss defeat is a retreat, not a kill. Her motives remain legible but she does not become an ally in Part I.
- Cael is not the Chapter 7 boss; the Eclipse Construct remains the final gameplay encounter.
- Asset IDs live in `content/brand_assets_part1.json` and villain illustration briefs in `content/visual_assets_part1.json`.

## Canon decisions — 2026-09-27

- **Yseldra's guilt (C4):** At Crownfall the Inquisition was ordered to deliver a bearer for the rite. Yseldra chose Fadyme, believing the seal would protect her, then watched it consume her. This is the meaning of Cael's line “Yseldra chose who would stand in it.” Her Part I actions are atonement, not only prevention. The seven cut seals on her chain are the seven lives the bells took during her years of service (C9).
- **Cael and Fadyme (C3):** Cael is the brother of Fadyme's mother and a member of House Veyr, the bell-keeping house. He built the door his own niece stands in. Fadyme names him “Uncle.” in the final scene.
- **Oren and the order chain:** Yseldra carried the Crown order; Oren signed it (`node_5_5_pre_005`).
- **Ending lines (C8):** The script in `content/story_script_ch07.json` is authoritative for the Part I ending. The Cael and Yseldra ending lines listed above that are not in the script are reserved as Part II material, not Part I canon.

## World foundation decisions — 2026-09-29 (W1, C16–C21)

Full rules in `lore/world_rules.md` 6–10; terms in `lore/glossary.md`.

- **Why Fadyme and not Cael (C16):** only the Veyr bell line, mother to daughter, can be sealed as Last Bell. Cael is Veyr by birth, not of the bell line.
- **The order chain (C19):** Yseldra sealed Fadyme at the bell altar beneath the Silent Bell in the capital; a second order sent the sealed bearer to the First Eclipse Altar. Yseldra carried it, Oren signed it, Mahmut defied it. Yseldra did not yet know what the Altar would do with her (LIKELY); her guilt starts there.
- **Cael's machinery (C20):** the Unwritten Hour (the stolen hour), the Rewrite (the plan), the Hinge (the Eclipse Construct), the Schedule (the bell order). **Public promise:** the minute before Crownfall. **Hidden aim, SECRET until Part II:** keep the Hinge counting back to the hour he lost the siege in which Liora and Aren died. This makes his "household" motive coherent: the minute before Crownfall cannot give them back; the hours before it can.
- **Yseldra's bell (C21):** her calling bell, clapper tied with red thread, still sounds whenever Fadyme's debt moves. She does not ring it; it rings, and she follows it.

## World foundation decisions — 2026-09-29 (W2, C24, C26)

- **Cael wrote both Crownfall orders (C24):** the king refused his letter (the king's last page); after the king's death Cael, as chancellor, issued the sealing order and the delivery order under the Inquisition seal. Every later order with C.V. beneath an Inquisition seal is his.
- **His name fades (C26, world rule 11):** because he stepped out of the Ledger, people remember "the chancellor who died at Crownfall" but cannot hold his name or face. Those who hold something he wrote still can: Fadyme (the king's last page) and Yseldra (the orders she carried).
- **The king's death** happened inside the Unwritten Hour; Cael is the only one who could restore that knowledge, by rewriting it.
