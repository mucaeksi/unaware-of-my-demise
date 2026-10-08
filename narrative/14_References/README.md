# Canonical Reference Set — LOCKED

Owner-approved consistency anchors for every generated visual and audio
asset. Status, item list and rules: `docs/UOMD_REFERENCE_LOCK.md`.
Integrity (sha256, Drive source, LEGACY path, embedded metadata):
`REFERENCE_SET.lock.json`.

Do not edit, re-encode, crop, rename or regenerate anything in this tree.
Derivatives are produced elsewhere and record the locked file as their
reference. Changes require an owner canon decision.

Verify integrity:

    python3 -c "import json;[print(i['sha256']+'  '+i['path']) for i in json.load(open('narrative/references/REFERENCE_SET.lock.json'))['items']]" | sha256sum -c -

| Folder | Content |
|---|---|
| `logo/` | R01 wordmark |
| `key_art/` | R02 key art (+ composite with logo) |
| `fadyme/sheet/` | R03 model sheet r2, chibi crop reference |
| `fadyme/vn_bust/` | R04–R07 VN busts |
| `fadyme/battle_pose/` | R08–R13 chibi battle poses |
| `fadyme/cut_in/` | R14 ultimate cut-in |
| `fadyme/theme/` | R18 Fadyme theme (loop + original, JSON sidecars) |
| `fadyme/voice/` | R23 casting (Sulafat) + reference recording |
| `locations/forest_whispering_ash/` | R15–R16 chapter 1 background and battle plate |
| `icons/` | R17 pilot icon set |
