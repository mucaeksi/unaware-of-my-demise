# UOMD — Canonical Reference Lock

## Status

Initial reference set: **OWNER APPROVAL REQUIRED / NOT YET LOCKED** until the
project owner explicitly marks it APPROVED.

## Initial reference set

- Logo
- Key art
- Fadyme character sheet
- Fadyme visual assets
- Fadyme voice
- Fadyme theme

## Locations

Primary staging location:

`narrative/references/fadyme/`

## Lock rule

Before this set is marked APPROVED/LOCKED:

- the owner personally reviews it
- Claude must not silently declare the reference set approved
- later generation should not be treated as canon

After APPROVED/LOCKED:

- use these references as consistency anchors
- later routine assets may be generated and validated autonomously
- conflicts are logged as `DECISION_REQUIRED`
- the reference set is not overwritten by generated output

## LEGACY evidence (recorded 2026-10-03, status unchanged)

The LEGACY Drive archive records owner approval on 2026-09-30 of a complete
set: R01 logo `brand_logo_wordmark_r2_v003`, R02 key art
`brand_key_art_portrait_r2_v003`, R03 Fadyme sheet r2 `char-fadyme-uomd`,
R04–R17 Fadyme busts/battle poses/cut-in, Fadyme voice `Sulafat`
(Gemini TTS), R18 Fadyme theme `bgm_fadyme_theme_v001` (`lyria-3.5`).
Details and Drive ids: `docs/LEGACY_AUDIT.md` §4.

This lock stays **NOT YET LOCKED** in this repository until the owner
confirms that set (DEC-0010 / OQ-007). On confirmation the files are migrated
byte-exact into `narrative/references/` with sha256 and the status below
changes to APPROVED/LOCKED.

## Change control

Changing the locked logo, key art, Fadyme sheet, Fadyme voice identity, or
Fadyme theme is a creative/canon change and must be documented.
