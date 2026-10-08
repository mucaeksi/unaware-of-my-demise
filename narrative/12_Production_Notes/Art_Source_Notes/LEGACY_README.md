# Art — narrative & visual direction images

Reorganized 2026-09-30 (was `photos/`). Nothing here is read at runtime; the code team exports game-ready files into the repository's `assets/`.

| Folder | Contents |
|---|---|
| `sheets/` | Approved character model sheets `char-<id-with-hyphens>-uomd.png` (identity references). |
| `sheets/pending/` | Sheets not yet approved (do not use as references). |
| `sheets/chibi_ref/` | Crops of each sheet's chibi panel; attach as the second image for a character's first (idle) battle pose. |
| `production/<character_id>/` | Approved generated assets: `vn_bust_*`, `battle_pose_*`. |
| `production/locations/<location_id>/` | Approved backgrounds and battle plates. |
| `production/icons/` | Approved icon sets. |
| `brand/` | Approved r2 logo and portrait key art (reference set). `concepts/`: app-icon concepts, old store mockups, font comparison (reference only). `superseded/`: old logo, old key art (portrait/wide/square) and old app icon — off-model (audit CC-12), never generation references; replacements are in the asset plan (wave 1 brand). |
| `_review/` | Fresh generations from the tools (status REVIEW), before the Director looks at them. |
| `_proposed/` | The Director's recommended pick, renamed without the try suffix (status PROPOSED), waiting for the owner. |
| `_rejected/` | Eliminated generations and non-recommended alternatives, with the reason in their metadata (status REJECTED). |

**Review flow (owner rule 2026-09-30):** tools write to `_review/` → the Director moves each image with `tools/art_review.py`: `propose` → `_proposed/`, `reject --notes "reason"` → `_rejected/` → the owner's pick is moved with `approve` into its main folder (brand, sheets, production/<id>, production/locations/<id>, production/icons; status APPROVED). Every move renames the file and rewrites its embedded metadata; the manifest is rebuilt automatically. After the reference set, the Director approves directly.

**Metadata:** every PNG carries text chunks `uomd_id`, `uomd_kind`, `uomd_variant`, `uomd_status` (APPROVED / APPROVED_WITH_ISSUE / PENDING / REFERENCE / REJECTED), `uomd_reference`, `uomd_date`, `uomd_notes` and others. `MANIFEST.md` lists them all.

**Adding an image:** save it under the metadata file name from its prompt, then run
`python3 tools/art_manifest.py tag art/<path>.png id=<id> kind=<kind> variant=<variant> status=APPROVED` (pixels are not changed) — or send it to the Narrative & Visual Director, who reviews and files it.

Originals of the old `photos/` files: `archive/2026-09-30_photos_originals/`.
