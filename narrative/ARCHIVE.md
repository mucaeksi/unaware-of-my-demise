# Legacy media archive (2026-10-10 / 2026-10-11)

Owner decision: **all visuals and audio are regenerated from scratch with Google models.** The old images and sounds were
archived out of `main`'s working tree and are used only as *references* (see `reference/`).
**Nothing was lost**: every removed file is byte-identical in the read-only branch `archive/pre-cleanup-2026-10-10`
(commit `b3172b1`, the last tree that still had them). The older Godot-era tree is on `archive/godot-era` (commit `25dc0b2`).

| Folder | Removed from main | What it was |
|---|---:|---|
| `08_Locations` | 2 PNG (10.3 MB) | forest plates (1536 px derivatives kept in `reference/derived`) |
| `10_VO` | 30 WAV + audition viewer | Chirp 3 HD ja-JP voice auditions (text records/line maps stay) |
| `12_Production_Notes` | 1 PNG | legacy UI image |
| `13_Archive` | 104 OGG/MP3 | superseded Sulafat Fadyme VO copies (`MANIFEST.json` with SHA-256 stays) |
| `14_References` | 13 PNG | locked Fadyme busts/battle poses/cut-in/icons/key-art variants (derivatives kept; sheet + chibi ref moved byte-exact to `reference/locked`; logo + key art stay, the content build reads them) |
| `15_Art_Workbench` | 45 PNG + 2 viewers | Fadyme production_v002 candidates, enemy design boards and captures (prompts, provenance and design cards stay) |

Total: **195 media files, 170,016,447 bytes**; per-file SHA-256 and size in `ARCHIVE_MANIFEST.tsv`.
Kept in place because the content build or the owner-approved audio need them: 4 Fadyme VN portraits (`production_v002/vn`),
logo and key art (`14_References/recovered_locked_v001`), and everything in `11_Audio_Cues` (the Lyria 3.5 loops, two of which ship in `content/base`).

## Restore
```bash
git fetch origin archive/pre-cleanup-2026-10-10
# one folder
git restore --source=origin/archive/pre-cleanup-2026-10-10 --staged --worktree -- narrative/15_Art_Workbench/enemies/design_v001/boards
# one file
git show origin/archive/pre-cleanup-2026-10-10:narrative/14_References/recovered_locked_v001/fadyme/vn_bust/vn_bust_fadyme_warm_v001.png > out.png
```
Do not delete or force-push the `archive/*` branches; `main`'s own history also keeps every blob, so a history rewrite would break the content build (it reads approved legacy art from commit `25dc0b2`) and the archive.

## Notes
- Texts, JSON prompts, provenance, design cards, line maps and manifests were **not** removed: they are the real prompt references.
- Some READMEs inside the folders above still link to the removed images or galleries; those links are historical.
- The shipped `content/base` art is provisional and is replaced through the signed data-patch pipeline as Google-generated assets are approved.
