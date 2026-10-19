# UI Screens & Layered Gothic UI Kit — Production Package (`production_v001`)

This directory contains the **Argon Delivery Specification (Priority #1A)** production-ready, chroma-keyed RGBA UI Kit components and Store Brand deliverables for *Unaware of My Demise*.

## 1. Directory Structure

- `ui_kit/` — Individual transparent RGBA PNG components (zero baked text; ready for `PixiJS v8 NineSliceSprite` and HTML/CSS ARIA menus).
- `brand/` — Exact-dimension PNG Store & Android Adaptive Icon deliverables.
- `sources/` — Lossless PNG masters on flat `#00FF00` chroma-key green.
- `provenance/ui_kit_provenance_v001.json` — Full R14 provenance and commercial terms metadata.

## 2. 9-Slice Panel Frame Coordinates (`NineSliceSprite`)

| Component | File | Dimensions | `leftWidth` | `topHeight` | `rightWidth` | `bottomHeight` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Primary Outer Gothic Frame** | `ui_kit/panel_frame_primary_9slice_v001.png` | `906×906` | `148px` | `148px` | `148px` | `148px` |
| **Secondary Inner Brass Frame** | `ui_kit/panel_frame_secondary_9slice_v001.png` | `734×734` | `112px` | `112px` | `112px` | `112px` |
| **Double Composite Frame** | `ui_kit/panel_frame_double_composite_9slice_v001.png` | `1024×1024` | `224px` | `224px` | `224px` | `224px` |
| **Inner Slate Plate Texture** | `ui_kit/panel_inner_plate_texture_v001.png` | `447×447` | Tile / Stretch | Tile / Stretch | Tile / Stretch | Tile / Stretch |

## 3. Text-Free 4-State Interactive Controls & Bars

- `ui_kit/button_primary_normal_v001.png` — Default obsidian-and-tarnished-gold Gothic bevel button (no text).
- `ui_kit/button_primary_hover_v001.png` — Illuminated warm amber/gold rim hover state (no text).
- `ui_kit/button_primary_pressed_v001.png` — Depressed dark sunken bevel state (no text).
- `ui_kit/button_primary_disabled_v001.png` — Desaturated weathered iron disabled state (no text).
- `ui_kit/tab_header_active_v001.png` & `ui_kit/tab_header_inactive_v001.png` — Active/Inactive cathedral tab headers.
- `ui_kit/divider_bell_ornate_v001.png` — Horizontal filigree section divider with central bell motif.
- `ui_kit/bar_frame_empty_v001.png` — Empty ornate metal gauge frame.
- `ui_kit/bar_fill_hp_crimson_v001.png` — Blood-crimson HP liquid fill strip.
- `ui_kit/bar_fill_focus_gold_violet_v001.png` — Luminous amber-gold to twilight-violet Focus fill strip.
- `ui_kit/vfx_eclipse_corona_ring_v001.png`, `ui_kit/vfx_ember_ash_particles_v001.png`, `ui_kit/ornament_corner_bell_chain_v001.png` — Isolated RGBA overlay layers for PixiJS / CSS animation.

## 4. Store & Android Adaptive Brand Pack (`brand/`)

| Deliverable | File | Format & Size | Notes |
| :--- | :--- | :---: | :--- |
| **App Icon** | `brand/app_icon_512x512_v001.png` | `512×512` PNG | Full composite store icon |
| **Adaptive Foreground** | `brand/android_adaptive_foreground_512x512_v001.png` | `512×512` RGBA PNG | Emblem centered inside inner 66% (`338×338`) safe circle |
| **Adaptive Background** | `brand/android_adaptive_background_512x512_v001.png` | `512×512` PNG | Full-bleed dark eclipse cathedral background layer |
| **Google Play Feature Graphic** | `brand/google_play_feature_graphic_1024x500_v001.png` | `1024×500` PNG | Exact Google Play Console required dimensions |

## 5. R14 Provenance & Commercial Usage Terms

- **Google Gemini API Terms**: https://ai.google.dev/gemini-api/terms
- **Google Universal Terms of Service**: https://policies.google.com/terms
- **Google Labs / Whisk Terms**: https://labs.google/fx/terms
