# Asset Pipeline — how sheet prompts and production prompts fit together

Two stages, two kinds of prompt. Both live in `narrative/prompts/`.

| Stage | What | Prompt source | Reference attached | Output |
|---|---|---|---|---|
| 1. Identity | One character model sheet per character (layout, labels, turnaround, palette) | `prompts/<id>_sheet.md` | A DIFFERENT character's sheet, layout only (or none) | `narrative/art/sheets/char-<id>-uomd.png` after approval |
| 2. Production | Individual game assets: VN busts, battle poses, backgrounds, icon sets | `prompts/asset_pipeline/` (this folder), technical team spec | The SAME character's approved sheet, match exactly | `assets/` via the code team's pipeline |

Rules that bridge the two:
1. No production asset for a character until that character's sheet is approved in `narrative/art/sheets/`.
2. Production prompts are built from the **identity block** of the character (`character_briefs.md`), which is extracted from the approved sheet, plus the mode block and asset spec from `00_rules.md`.
3. Sheet-only elements never enter production prompts: labels, titles, taglines, the game title, parchment texture, cracked-paint texture, panel layout.
4. Environments come from `location_briefs.md` (narrative team) with an ORDER_LEVEL.
5. Every production prompt ends with a short NEGATIVE line (narrative technique) and a METADATA block (technical spec). Both are kept as the asset log.
6. Pilot first: Fadyme only (`pilot_fadyme.md`). Approved for production 2026-09-30 together with `mahmut.md` and `kera_voss.md` (Kera after her r2 sheet).
7. Asset count per character is set by story need, not fixed at 12: busts = the expressions the script actually uses (see each file's emotion → bust table); poses = the six battle states.
8. Approval (C41): the owner approves the reference set (logo, key art, Fadyme sheet r2, all Fadyme assets). Everything after it is generated and approved by the Narrative & Visual Director against that set.
