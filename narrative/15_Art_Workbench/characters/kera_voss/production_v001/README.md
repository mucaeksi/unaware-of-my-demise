# Kera Voss — Pilot Character Full Production Package (`production_v001`)

This package fulfills **Priority #2** of the **Argon Delivery Specification** for pilot character `kera_voss` (*Field Alchemist of Oakhaven*, 4★ Ember Controller).

## 1. Visual Novel (VN) Expression Set (`vn/`)

All 4 expressions share the **exact same camera framing, body posture, oversized witch-hat silhouette, and reagent rigging**, generated on flat `#00FF00` green and chroma-keyed to `768×1152` (`2:3`) RGBA PNGs (plus full-resolution `848×1264` RGBA PNGs):

| Expression State | `768×1152` RGBA PNG | Full-Res RGBA PNG | `#00FF00` Green Source PNG |
| :--- | :--- | :--- | :--- |
| **1. `composed`** (Default) | `vn/kera_voss_vn_composed_v001.png` | `vn/kera_voss_vn_composed_fullres_rgba_v001.png` | `vn/kera_voss_vn_composed_green_v001.png` |
| **2. `focused`** (Analytical) | `vn/kera_voss_vn_focused_v001.png` | `vn/kera_voss_vn_focused_fullres_rgba_v001.png` | `vn/kera_voss_vn_focused_green_v001.png` |
| **3. `proud_smile`** (Smug Grin) | `vn/kera_voss_vn_proud_smile_v001.png` | `vn/kera_voss_vn_proud_smile_fullres_rgba_v001.png` | `vn/kera_voss_vn_proud_smile_green_v001.png` |
| **4. `defiant`** (Battle Retort) | `vn/kera_voss_vn_defiant_v001.png` | `vn/kera_voss_vn_defiant_fullres_rgba_v001.png` | `vn/kera_voss_vn_defiant_green_v001.png` |

## 2. 8-State 2-Head SD Chibi Battle Set (`animation/`)

- **Full Sheet (RGBA)**: `animation/kera_voss_chibi_sheet_v001.png` (`1376×768`, `4×2` grid)
- **Full Sheet (`#00FF00` Green)**: `animation/kera_voss_chibi_sheet_green_v001.png`
- **Normalized State Frames (`512×512` RGBA PNGs, facing `right`, foot baseline anchored at `x = 256, y = 448` / `87.5%`)**:
  1. `animation/states/kera_voss_chibi_01_idle_v001.png`
  2. `animation/states/kera_voss_chibi_02_walk_v001.png`
  3. `animation/states/kera_voss_chibi_03_basic_v001.png`
  4. `animation/states/kera_voss_chibi_04_active_v001.png`
  5. `animation/states/kera_voss_chibi_05_ultimate_v001.png`
  6. `animation/states/kera_voss_chibi_06_hit_v001.png`
  7. `animation/states/kera_voss_chibi_07_defeat_v001.png`
  8. `animation/states/kera_voss_chibi_08_victory_v001.png`

## 3. Gacha Pull Splash Art (`gacha/`)

- `gacha/kera_voss_gacha_splash_v001.png` (`1376×768` `16:9` widescreen dynamic splash illustration).

## 4. R14 Provenance & Commercial Usage Terms

- See `provenance/kera_voss_provenance_v001.json` and `asset_inventory.json`.
- Commercial Terms URLs:
  - https://ai.google.dev/gemini-api/terms
  - https://policies.google.com/terms
  - https://labs.google/fx/terms
