# Visual references for Google-generated art

Owner direction (2026-10-10): visuals are **rebuilt from scratch with Google image models**; old art is reference-only.
Use these files as image references/conditioning in prompts, never as shippable assets.

| Tier | Where | Meaning |
|---|---|---|
| A (byte-exact originals) | `locked/fadyme/sheet/` + the logo and key art in `narrative/14_References/recovered_locked_v001/` | owner-approved, **locked**: do not edit, re-encode, crop or rename |
| B (derivatives) | `derived/*.webp` (1536 px WebP, 22 files, ~3.5 MB) | made by `tools/make_reference_set.ts`; `INDEX.json` records role, status and the SHA-256 of the original each one was made from (original at `archive/pre-cleanup-2026-10-10`) |

## Which Fadyme is canonical?
`locked/fadyme/sheet/char-fadyme-uomd.png` (deep-plum hooded cloak, silver bell, white scarf) is the **identity reference**. The legacy chibi atlas that
ships in `content/base` (crimson/burgundy robe) contradicts it (flagged VIS-04). Until the owner decides otherwise: use the locked sheet as the identity
anchor, use other poses only as pose/composition references, and never mix both costumes in one prompt.

`status` values: `LOCKED_OWNER_APPROVED` (locked canon) and `DESIGN_CANDIDATE_NOT_OWNER_APPROVED` (enemy boards: design intent only, not Google-verified).
Every paid generation must first reserve budget with `npx tsx tools/media_budget.ts reserve …` (the budget is $0 until the owner approves an amount).
