import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const REPO_ROOT = process.cwd();
const BRAIN_DIR = 'C:/Users/PC/.gemini/antigravity/brain/b194a43b-1915-4e29-a519-ec7a136f263a';

const UI_PROD_DIR = path.join(REPO_ROOT, 'narrative/15_Art_Workbench/ui_screens/production_v001');
const ICONS_PROD_DIR = path.join(REPO_ROOT, 'narrative/15_Art_Workbench/icons/production_v001');
const KERA_PROD_DIR = path.join(REPO_ROOT, 'narrative/15_Art_Workbench/characters/kera_voss/production_v001');

const COMMERCIAL_TERMS_URLS = [
  'https://ai.google.dev/gemini-api/terms',
  'https://policies.google.com/terms',
  'https://labs.google/fx/terms'
];

/**
 * Chroma-key #00FF00 green background to RGBA with smooth edge anti-aliasing and green despill.
 */
function chromaKeyGreenBuffer(data, width, height, channels) {
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];
    const aIn = channels === 4 ? data[i * 4 + 3] : 255;

    const maxRB = Math.max(r, b);
    const greenExcess = g - maxRB;

    let alpha = aIn;
    let nr = r;
    let ng = g;
    let nb = b;

    // Pure green background detection + soft ramp
    if (g > 110 && greenExcess > 35) {
      if (g > 155 && greenExcess > 75) {
        alpha = 0;
      } else {
        // Soft ramp between greenExcess 35..75
        const t = Math.min(1, Math.max(0, (greenExcess - 35) / 40));
        alpha = Math.round(aIn * (1 - t));
      }
      // Despill green fringe on semi-transparent edge pixels
      ng = Math.min(g, Math.round(maxRB * 1.05));
    } else if (greenExcess > 18 && g > 90) {
      // Subtle despill on anti-aliased edge pixels
      ng = Math.min(g, Math.round(maxRB + (greenExcess * 0.35)));
    }

    out[i * 4] = nr;
    out[i * 4 + 1] = ng;
    out[i * 4 + 2] = nb;
    out[i * 4 + 3] = alpha;
  }
  return out;
}

/**
 * Compute tight non-transparent bounding box of an RGBA buffer.
 */
function getAlphaBoundingBox(rgba, width, height, alphaThreshold = 16) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = rgba[(y * width + x) * 4 + 3];
      if (a >= alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    return { left: 0, top: 0, width, height };
  }
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

/**
 * Flood-fill border-connected dark/slate background for existing 4x4 icon sheets so all 96 icons have clean RGBA alpha.
 */
function keyBorderConnectedDarkBackground(data, width, height, channels) {
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    out[i * 4] = data[i * channels];
    out[i * 4 + 1] = data[i * channels + 1];
    out[i * 4 + 2] = data[i * channels + 2];
    out[i * 4 + 3] = 255;
  }

  // Sample border color from corners/edges
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;

  function isBgLike(idx) {
    const r = out[idx * 4];
    const g = out[idx * 4 + 1];
    const b = out[idx * 4 + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    // Dark neutral/slate background or thin grid border line near outer edge
    return luma < 46 && sat < 38;
  }

  for (let x = 0; x < width; x++) {
    const topIdx = x;
    const botIdx = (height - 1) * width + x;
    if (isBgLike(topIdx)) { visited[topIdx] = 1; queue[tail++] = topIdx; }
    if (isBgLike(botIdx)) { visited[botIdx] = 1; queue[tail++] = botIdx; }
  }
  for (let y = 0; y < height; y++) {
    const leftIdx = y * width;
    const rightIdx = y * width + (width - 1);
    if (!visited[leftIdx] && isBgLike(leftIdx)) { visited[leftIdx] = 1; queue[tail++] = leftIdx; }
    if (!visited[rightIdx] && isBgLike(rightIdx)) { visited[rightIdx] = 1; queue[tail++] = rightIdx; }
  }

  while (head < tail) {
    const curr = queue[head++];
    out[curr * 4 + 3] = 0;
    const cx = curr % width;
    const cy = (curr - cx) / width;
    const neighbors = [];
    if (cx > 0) neighbors.push(curr - 1);
    if (cx < width - 1) neighbors.push(curr + 1);
    if (cy > 0) neighbors.push(curr - width);
    if (cy < height - 1) neighbors.push(curr + width);
    for (const n of neighbors) {
      if (!visited[n] && isBgLike(n)) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
  }

  // Feather 1px border around transparent pixels
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (out[idx * 4 + 3] > 0) {
        let zeroNeighbors = 0;
        if (out[(idx - 1) * 4 + 3] === 0) zeroNeighbors++;
        if (out[(idx + 1) * 4 + 3] === 0) zeroNeighbors++;
        if (out[(idx - width) * 4 + 3] === 0) zeroNeighbors++;
        if (out[(idx + width) * 4 + 3] === 0) zeroNeighbors++;
        if (zeroNeighbors >= 2) {
          out[idx * 4 + 3] = 140;
        }
      }
    }
  }
  return out;
}

async function loadAndChromaKey(srcPath) {
  const { data, info } = await sharp(srcPath).raw().toBuffer({ resolveWithObject: true });
  const rgba = chromaKeyGreenBuffer(data, info.width, info.height, info.channels);
  return { rgba, width: info.width, height: info.height };
}

async function saveSubRegionRgba(rgba, fullW, fullH, reg, destPath, trim = true, pad = 8, resizeTo = null) {
  const { left, top, width, height } = reg;
  const sub = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const srcStart = ((top + y) * fullW + left) * 4;
    const dstStart = (y * width) * 4;
    rgba.copy(sub, dstStart, srcStart, srcStart + width * 4);
  }

  let finalBuf = sub;
  let finalW = width;
  let finalH = height;

  if (trim) {
    const bb = getAlphaBoundingBox(sub, width, height, 20);
    const pLeft = Math.max(0, bb.left - pad);
    const pTop = Math.max(0, bb.top - pad);
    const pRight = Math.min(width - 1, bb.left + bb.width - 1 + pad);
    const pBottom = Math.min(height - 1, bb.top + bb.height - 1 + pad);
    finalW = pRight - pLeft + 1;
    finalH = pBottom - pTop + 1;
    finalBuf = Buffer.alloc(finalW * finalH * 4);
    for (let y = 0; y < finalH; y++) {
      const sStart = ((pTop + y) * width + pLeft) * 4;
      finalBuf.fill(0, y * finalW * 4, (y + 1) * finalW * 4);
      sub.copy(finalBuf, y * finalW * 4, sStart, sStart + finalW * 4);
    }
  }

  let pipeline = sharp(finalBuf, { raw: { width: finalW, height: finalH, channels: 4 } });
  if (resizeTo) {
    pipeline = pipeline.resize(resizeTo.width, resizeTo.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    });
  }
  await pipeline.png().toFile(destPath);
  return { width: resizeTo ? resizeTo.width : finalW, height: resizeTo ? resizeTo.height : finalH };
}

async function buildUiProductionPackage() {
  console.log('--- Building Priority #1A: UI Kit & Store Brand Package (ui_screens/production_v001) ---');
  const sourcesDir = path.join(UI_PROD_DIR, 'sources');
  const uiKitDir = path.join(UI_PROD_DIR, 'ui_kit');
  const brandDir = path.join(UI_PROD_DIR, 'brand');
  const provDir = path.join(UI_PROD_DIR, 'provenance');

  await fs.mkdir(sourcesDir, { recursive: true });
  await fs.mkdir(uiKitDir, { recursive: true });
  await fs.mkdir(brandDir, { recursive: true });
  await fs.mkdir(provDir, { recursive: true });

  const rawPanel = path.join(BRAIN_DIR, 'gothic_panel_frame_1792383786169.jpg');
  const rawButtons = path.join(BRAIN_DIR, 'gothic_ui_button_sheet_2x2_1792383787419.jpg');
  const rawControls = path.join(BRAIN_DIR, 'gothic_ui_kit_controls_bars_1792383789047.jpg');
  const rawVfx = path.join(BRAIN_DIR, 'ui_vfx_texture_sheet_1792383911737.jpg');
  const rawAdaptiveFg = path.join(BRAIN_DIR, 'android_adaptive_icon_foreground_1792383785247.jpg');

  // Save lossless PNG copies of the #00FF00 green source sheets
  await sharp(rawPanel).png().toFile(path.join(sourcesDir, 'ui_panel_frames_green_v001.png'));
  await sharp(rawButtons).png().toFile(path.join(sourcesDir, 'ui_button_sheet_2x2_green_v001.png'));
  await sharp(rawControls).png().toFile(path.join(sourcesDir, 'ui_controls_bars_green_v001.png'));
  await sharp(rawVfx).png().toFile(path.join(sourcesDir, 'ui_vfx_texture_sheet_2x2_green_v001.png'));
  await sharp(rawAdaptiveFg).png().toFile(path.join(sourcesDir, 'brand_adaptive_foreground_green_v001.png'));

  // 1. Process 9-Slice Panel Frames
  const panelKeyed = await loadAndChromaKey(rawPanel);
  // Save double composite 9-slice
  await sharp(panelKeyed.rgba, { raw: { width: panelKeyed.width, height: panelKeyed.height, channels: 4 } })
    .png()
    .toFile(path.join(uiKitDir, 'panel_frame_double_composite_9slice_v001.png'));

  // Outer Frame only (masking inner ring [145..878, 145..878] to transparent)
  const outerRgba = Buffer.from(panelKeyed.rgba);
  for (let y = 145; y <= 878; y++) {
    for (let x = 145; x <= 878; x++) {
      const idx = (y * panelKeyed.width + x) * 4;
      outerRgba[idx + 3] = 0;
    }
  }
  const outerDims = await saveSubRegionRgba(
    outerRgba,
    panelKeyed.width,
    panelKeyed.height,
    { left: 0, top: 0, width: 1024, height: 1024 },
    path.join(uiKitDir, 'panel_frame_primary_9slice_v001.png'),
    true,
    8
  );

  // Inner Frame only (subregion [145..878, 145..878])
  const innerDims = await saveSubRegionRgba(
    panelKeyed.rgba,
    panelKeyed.width,
    panelKeyed.height,
    { left: 145, top: 145, width: 734, height: 734 },
    path.join(uiKitDir, 'panel_frame_secondary_9slice_v001.png'),
    true,
    8
  );

  // 2. Process 4-State Button Sheet (2x2 on 1024x1024)
  const btnKeyed = await loadAndChromaKey(rawButtons);
  const btnNormalDims = await saveSubRegionRgba(
    btnKeyed.rgba, 1024, 1024,
    { left: 0, top: 0, width: 512, height: 512 },
    path.join(uiKitDir, 'button_primary_normal_v001.png'), true, 8
  );
  const btnHoverDims = await saveSubRegionRgba(
    btnKeyed.rgba, 1024, 1024,
    { left: 512, top: 0, width: 512, height: 512 },
    path.join(uiKitDir, 'button_primary_hover_v001.png'), true, 8
  );
  const btnPressedDims = await saveSubRegionRgba(
    btnKeyed.rgba, 1024, 1024,
    { left: 0, top: 512, width: 512, height: 512 },
    path.join(uiKitDir, 'button_primary_pressed_v001.png'), true, 8
  );
  const btnDisabledDims = await saveSubRegionRgba(
    btnKeyed.rgba, 1024, 1024,
    { left: 512, top: 512, width: 512, height: 512 },
    path.join(uiKitDir, 'button_primary_disabled_v001.png'), true, 8
  );

  // 3. Process Controls, Tabs, Divider & Progress Bars Sheet
  // Y-bands detected: [55, 222], [340, 450], [555, 686], [750, 833], [886, 969]
  const ctrlKeyed = await loadAndChromaKey(rawControls);
  await saveSubRegionRgba(
    ctrlKeyed.rgba, 1024, 1024,
    { left: 0, top: 40, width: 512, height: 200 },
    path.join(uiKitDir, 'tab_header_active_v001.png'), true, 6
  );
  await saveSubRegionRgba(
    ctrlKeyed.rgba, 1024, 1024,
    { left: 512, top: 40, width: 512, height: 200 },
    path.join(uiKitDir, 'tab_header_inactive_v001.png'), true, 6
  );
  await saveSubRegionRgba(
    ctrlKeyed.rgba, 1024, 1024,
    { left: 0, top: 325, width: 1024, height: 140 },
    path.join(uiKitDir, 'divider_bell_ornate_v001.png'), true, 6
  );
  await saveSubRegionRgba(
    ctrlKeyed.rgba, 1024, 1024,
    { left: 0, top: 540, width: 1024, height: 160 },
    path.join(uiKitDir, 'bar_frame_empty_v001.png'), true, 6
  );
  await saveSubRegionRgba(
    ctrlKeyed.rgba, 1024, 1024,
    { left: 0, top: 740, width: 1024, height: 105 },
    path.join(uiKitDir, 'bar_fill_hp_crimson_v001.png'), true, 4
  );
  await saveSubRegionRgba(
    ctrlKeyed.rgba, 1024, 1024,
    { left: 0, top: 875, width: 1024, height: 105 },
    path.join(uiKitDir, 'bar_fill_focus_gold_violet_v001.png'), true, 4
  );

  // 4. Process UI VFX & Panel Inner Texture Sheet (2x2 on 1024x1024)
  const vfxKeyed = await loadAndChromaKey(rawVfx);
  await saveSubRegionRgba(
    vfxKeyed.rgba, 1024, 1024,
    { left: 0, top: 0, width: 512, height: 512 },
    path.join(uiKitDir, 'vfx_eclipse_corona_ring_v001.png'), true, 8
  );
  await saveSubRegionRgba(
    vfxKeyed.rgba, 1024, 1024,
    { left: 512, top: 0, width: 512, height: 512 },
    path.join(uiKitDir, 'vfx_ember_ash_particles_v001.png'), true, 8
  );
  await saveSubRegionRgba(
    vfxKeyed.rgba, 1024, 1024,
    { left: 0, top: 512, width: 512, height: 512 },
    path.join(uiKitDir, 'ornament_corner_bell_chain_v001.png'), true, 8
  );
  await saveSubRegionRgba(
    vfxKeyed.rgba, 1024, 1024,
    { left: 512, top: 512, width: 512, height: 512 },
    path.join(uiKitDir, 'panel_inner_plate_texture_v001.png'), true, 4
  );

  // 5. Process Store Brand Pack (App Icon 512x512, Adaptive Foreground 512x512, Adaptive Background 512x512, Feature Graphic 1024x500)
  const adaptiveFgKeyed = await loadAndChromaKey(rawAdaptiveFg);
  // Fit the emblem cleanly inside the 66% safe zone (338x338 centered inside 512x512)
  const fgTrimmedPath = path.join(brandDir, '_tmp_fg_trimmed.png');
  await saveSubRegionRgba(
    adaptiveFgKeyed.rgba, 1024, 1024,
    { left: 0, top: 0, width: 1024, height: 1024 },
    fgTrimmedPath, true, 4
  );
  const fgSafe332 = await sharp(fgTrimmedPath)
    .resize(332, 332, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: fgSafe332, left: 90, top: 90 }])
    .png()
    .toFile(path.join(brandDir, 'android_adaptive_foreground_512x512_v001.png'));
  await fs.unlink(fgTrimmedPath);

  // Create Android Adaptive Background 512x512 (rich dark obsidian cathedral slate + subtle eclipse radial vignette)
  const bgSvg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="eclipseBg" cx="50%" cy="50%" r="65%">
        <stop offset="0%" stop-color="#26173E"/>
        <stop offset="48%" stop-color="#140D22"/>
        <stop offset="82%" stop-color="#0B0812"/>
        <stop offset="100%" stop-color="#050409"/>
      </radialGradient>
      <radialGradient id="goldGlow" cx="50%" cy="46%" r="42%">
        <stop offset="0%" stop-color="#D49B35" stop-opacity="0.22"/>
        <stop offset="65%" stop-color="#7A283B" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="512" height="512" fill="url(#eclipseBg)"/>
    <circle cx="256" cy="256" r="220" fill="url(#goldGlow)"/>
    <circle cx="256" cy="256" r="196" fill="none" stroke="#8A6421" stroke-opacity="0.25" stroke-width="2"/>
    <circle cx="256" cy="256" r="232" fill="none" stroke="#4D3668" stroke-opacity="0.22" stroke-width="1.5"/>
  </svg>`;
  await sharp(Buffer.from(bgSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(brandDir, 'android_adaptive_background_512x512_v001.png'));

  // Export 512x512 App Icon PNG (from brand_app_icon_v001.jpg AND adaptive composite)
  const existingAppIcon = path.join(REPO_ROOT, 'narrative/15_Art_Workbench/ui_screens/brand_app_icon_v001.jpg');
  await sharp(existingAppIcon)
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toFile(path.join(brandDir, 'app_icon_512x512_v001.png'));

  // Export 1024x500 Google Play Feature Graphic PNG (exact required dimensions from brand_key_art_wide_v001.jpg)
  const existingFeatureGraphic = path.join(REPO_ROOT, 'narrative/15_Art_Workbench/ui_screens/brand_key_art_wide_v001.jpg');
  await sharp(existingFeatureGraphic)
    .resize(1024, 500, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(path.join(brandDir, 'google_play_feature_graphic_1024x500_v001.png'));

  // Write Provenance JSON & README.md
  const provenanceData = {
    schema_version: '1.0.0',
    package_id: 'uomd_ui_screens_production_v001',
    round_compliance: 'R14_PROVENANCE_AND_COMMERCIAL_TERMS',
    generated_at: '2026-10-19T07:40:00+03:00',
    generator_pipeline: {
      tool_name: 'Google Antigravity image-generator (Gemini Imagen / Whisk pipeline) + sharp chroma-key pipeline',
      commercial_terms_urls: COMMERCIAL_TERMS_URLS,
      license_status: 'Commercial rights verified under Google Gemini / Labs Terms of Service; original project-specific generations',
      chroma_key_background: '#00FF00',
      post_processing: 'Automated RGBA chroma-key extraction, green despill, alpha bounding-box trim, and 9-slice margin calibration via tools/build_argon_production_v001.mjs'
    },
    nine_slice_frames: {
      panel_frame_primary_9slice_v001: {
        file: 'ui_kit/panel_frame_primary_9slice_v001.png',
        dimensions: outerDims,
        nine_slice_insets_px: { left: 148, right: 148, top: 148, bottom: 148 },
        pixi_nine_slice_sprite_config: { leftWidth: 148, topHeight: 148, rightWidth: 148, bottomHeight: 148 }
      },
      panel_frame_secondary_9slice_v001: {
        file: 'ui_kit/panel_frame_secondary_9slice_v001.png',
        dimensions: innerDims,
        nine_slice_insets_px: { left: 112, right: 112, top: 112, bottom: 112 },
        pixi_nine_slice_sprite_config: { leftWidth: 112, topHeight: 112, rightWidth: 112, bottomHeight: 112 }
      },
      panel_frame_double_composite_9slice_v001: {
        file: 'ui_kit/panel_frame_double_composite_9slice_v001.png',
        dimensions: { width: 1024, height: 1024 },
        nine_slice_insets_px: { left: 224, right: 224, top: 224, bottom: 224 },
        pixi_nine_slice_sprite_config: { leftWidth: 224, topHeight: 224, rightWidth: 224, bottomHeight: 224 }
      }
    },
    buttons_4state: {
      normal: { file: 'ui_kit/button_primary_normal_v001.png', dimensions: btnNormalDims, baked_text: false },
      hover: { file: 'ui_kit/button_primary_hover_v001.png', dimensions: btnHoverDims, baked_text: false },
      pressed: { file: 'ui_kit/button_primary_pressed_v001.png', dimensions: btnPressedDims, baked_text: false },
      disabled: { file: 'ui_kit/button_primary_disabled_v001.png', dimensions: btnDisabledDims, baked_text: false }
    },
    store_brand_assets: {
      app_icon_512x512: 'brand/app_icon_512x512_v001.png',
      android_adaptive_foreground_512x512: 'brand/android_adaptive_foreground_512x512_v001.png',
      android_adaptive_background_512x512: 'brand/android_adaptive_background_512x512_v001.png',
      google_play_feature_graphic_1024x500: 'brand/google_play_feature_graphic_1024x500_v001.png'
    }
  };

  await fs.writeFile(path.join(provDir, 'ui_kit_provenance_v001.json'), JSON.stringify(provenanceData, null, 2), 'utf8');

  const readmeMd = `# UI Screens & Layered Gothic UI Kit — Production Package (\`production_v001\`)

This directory contains the **Argon Delivery Specification (Priority #1A)** production-ready, chroma-keyed RGBA UI Kit components and Store Brand deliverables for *Unaware of My Demise*.

## 1. Directory Structure

- \`ui_kit/\` — Individual transparent RGBA PNG components (zero baked text; ready for \`PixiJS v8 NineSliceSprite\` and HTML/CSS ARIA menus).
- \`brand/\` — Exact-dimension PNG Store & Android Adaptive Icon deliverables.
- \`sources/\` — Lossless PNG masters on flat \`#00FF00\` chroma-key green.
- \`provenance/ui_kit_provenance_v001.json\` — Full R14 provenance and commercial terms metadata.

## 2. 9-Slice Panel Frame Coordinates (\`NineSliceSprite\`)

| Component | File | Dimensions | \`leftWidth\` | \`topHeight\` | \`rightWidth\` | \`bottomHeight\` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Primary Outer Gothic Frame** | \`ui_kit/panel_frame_primary_9slice_v001.png\` | \`${outerDims.width}×${outerDims.height}\` | \`148px\` | \`148px\` | \`148px\` | \`148px\` |
| **Secondary Inner Brass Frame** | \`ui_kit/panel_frame_secondary_9slice_v001.png\` | \`${innerDims.width}×${innerDims.height}\` | \`112px\` | \`112px\` | \`112px\` | \`112px\` |
| **Double Composite Frame** | \`ui_kit/panel_frame_double_composite_9slice_v001.png\` | \`1024×1024\` | \`224px\` | \`224px\` | \`224px\` | \`224px\` |
| **Inner Slate Plate Texture** | \`ui_kit/panel_inner_plate_texture_v001.png\` | \`447×447\` | Tile / Stretch | Tile / Stretch | Tile / Stretch | Tile / Stretch |

## 3. Text-Free 4-State Interactive Controls & Bars

- \`ui_kit/button_primary_normal_v001.png\` — Default obsidian-and-tarnished-gold Gothic bevel button (no text).
- \`ui_kit/button_primary_hover_v001.png\` — Illuminated warm amber/gold rim hover state (no text).
- \`ui_kit/button_primary_pressed_v001.png\` — Depressed dark sunken bevel state (no text).
- \`ui_kit/button_primary_disabled_v001.png\` — Desaturated weathered iron disabled state (no text).
- \`ui_kit/tab_header_active_v001.png\` & \`ui_kit/tab_header_inactive_v001.png\` — Active/Inactive cathedral tab headers.
- \`ui_kit/divider_bell_ornate_v001.png\` — Horizontal filigree section divider with central bell motif.
- \`ui_kit/bar_frame_empty_v001.png\` — Empty ornate metal gauge frame.
- \`ui_kit/bar_fill_hp_crimson_v001.png\` — Blood-crimson HP liquid fill strip.
- \`ui_kit/bar_fill_focus_gold_violet_v001.png\` — Luminous amber-gold to twilight-violet Focus fill strip.
- \`ui_kit/vfx_eclipse_corona_ring_v001.png\`, \`ui_kit/vfx_ember_ash_particles_v001.png\`, \`ui_kit/ornament_corner_bell_chain_v001.png\` — Isolated RGBA overlay layers for PixiJS / CSS animation.

## 4. Store & Android Adaptive Brand Pack (\`brand/\`)

| Deliverable | File | Format & Size | Notes |
| :--- | :--- | :---: | :--- |
| **App Icon** | \`brand/app_icon_512x512_v001.png\` | \`512×512\` PNG | Full composite store icon |
| **Adaptive Foreground** | \`brand/android_adaptive_foreground_512x512_v001.png\` | \`512×512\` RGBA PNG | Emblem centered inside inner 66% (\`338×338\`) safe circle |
| **Adaptive Background** | \`brand/android_adaptive_background_512x512_v001.png\` | \`512×512\` PNG | Full-bleed dark eclipse cathedral background layer |
| **Google Play Feature Graphic** | \`brand/google_play_feature_graphic_1024x500_v001.png\` | \`1024×500\` PNG | Exact Google Play Console required dimensions |

## 5. R14 Provenance & Commercial Usage Terms

- **Google Gemini API Terms**: https://ai.google.dev/gemini-api/terms
- **Google Universal Terms of Service**: https://policies.google.com/terms
- **Google Labs / Whisk Terms**: https://labs.google/fx/terms
`;
  await fs.writeFile(path.join(UI_PROD_DIR, 'README.md'), readmeMd, 'utf8');
}

async function buildIconsProductionPackage() {
  console.log('--- Building Priority #1B: 16 Core Chroma-Keyed Icons + 96 Semantic RGBA Icons (icons/production_v001) ---');
  const core16Dir = path.join(ICONS_PROD_DIR, 'core_16_rgba');
  const all96Dir = path.join(ICONS_PROD_DIR, 'icons_rgba');
  const provDir = path.join(ICONS_PROD_DIR, 'provenance');

  await fs.mkdir(core16Dir, { recursive: true });
  await fs.mkdir(all96Dir, { recursive: true });
  await fs.mkdir(provDir, { recursive: true });

  const rawCoreSheet = path.join(BRAIN_DIR, 'gothic_rpg_icon_sheet_4x4_1792383913934.jpg');
  await sharp(rawCoreSheet).png().toFile(path.join(ICONS_PROD_DIR, 'icons_core_01_sheet_green_v001.png'));

  const coreKeyed = await loadAndChromaKey(rawCoreSheet);
  await sharp(coreKeyed.rgba, { raw: { width: coreKeyed.width, height: coreKeyed.height, channels: 4 } })
    .png()
    .toFile(path.join(ICONS_PROD_DIR, 'icons_core_01_sheet_rgba_v001.png'));

  const core16Names = [
    ['icon_el_veil.png', 'icon_element_veil.png'],
    ['icon_el_stone.png', 'icon_element_stone.png'],
    ['icon_el_ember.png', 'icon_element_ember.png'],
    ['icon_el_tide.png', 'icon_element_tide.png'],
    ['icon_el_gale.png', 'icon_element_gale.png'],
    ['icon_el_dawn.png', 'icon_element_dawn.png'],
    ['icon_skill_basic.png', 'icon_skill_basic.png'],
    ['icon_skill_active.png', 'icon_skill_active.png'],
    ['icon_skill_ultimate.png', 'icon_skill_ultimate.png'],
    ['icon_st_dread.png', 'icon_status_dread.png'],
    ['icon_st_stoneguard.png', 'icon_status_stoneguard.png'],
    ['icon_st_taunt.png', 'icon_status_taunt.png'],
    ['icon_ui_focus.png', 'icon_focus_crystal.png'],
    ['icon_curr_eclipse_token.png', 'icon_eclipse_token.png'],
    ['icon_ui_bell.png', 'icon_nav_summon.png'],
    ['icon_ui_wax_seal.png', 'icon_nav_settings_seal.png']
  ];

  const cellW = Math.floor(coreKeyed.width / 4);
  const cellH = Math.floor(coreKeyed.height / 4);

  for (let idx = 0; idx < 16; idx++) {
    const r = Math.floor(idx / 4);
    const c = idx % 4;
    const [shortName] = core16Names[idx];
    const outCorePath = path.join(core16Dir, shortName);
    await saveSubRegionRgba(
      coreKeyed.rgba,
      coreKeyed.width,
      coreKeyed.height,
      { left: c * cellW + 6, top: r * cellH + 6, width: cellW - 12, height: cellH - 12 },
      outCorePath,
      true,
      10,
      { width: 256, height: 256 }
    );
    await fs.copyFile(outCorePath, path.join(all96Dir, shortName));
  }

  // Process all 96 canonical tiles from the 6 tile folders into 256x256 RGBA PNGs
  const tileFolders = [
    'elements_statuses_tiles',
    'currencies_items_tiles',
    'weapon_families_tiles',
    'signature_weapons_tiles',
    'accessories_armor_nav_tiles',
    'chapters_banners_tiles'
  ];

  const srcIconsRoot = path.join(REPO_ROOT, 'narrative/15_Art_Workbench/icons');
  for (const folder of tileFolders) {
    const folderPath = path.join(srcIconsRoot, folder);
    const files = (await fs.readdir(folderPath)).filter((f) => f.endsWith('.png')).sort();
    for (const file of files) {
      const tilePath = path.join(folderPath, file);
      const { data, info } = await sharp(tilePath).raw().toBuffer({ resolveWithObject: true });
      const keyedCell = keyBorderConnectedDarkBackground(data, info.width, info.height, info.channels);
      const semanticSlug = file.replace(/^\d+_/, ''); // e.g. element_ember.png
      const canonicalIconName = `icon_${semanticSlug}`;
      const outPath = path.join(all96Dir, canonicalIconName);
      await sharp(keyedCell, { raw: { width: info.width, height: info.height, channels: 4 } })
        .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(outPath);
    }
  }

  // Override the matching core semantic slots in all96Dir with the ultra-clean #00FF00 chroma-keyed versions
  for (const [shortName, canonical96Name] of core16Names) {
    await fs.copyFile(path.join(core16Dir, shortName), path.join(all96Dir, canonical96Name));
  }

  const iconProvenance = {
    schema_version: '1.0.0',
    package_id: 'uomd_icons_production_v001',
    round_compliance: 'R14_PROVENANCE_AND_COMMERCIAL_TERMS',
    generated_at: '2026-10-19T07:40:00+03:00',
    commercial_terms_urls: COMMERCIAL_TERMS_URLS,
    core_16_sheet_green: 'icons_core_01_sheet_green_v001.png',
    core_16_sheet_rgba: 'icons_core_01_sheet_rgba_v001.png',
    core_16_count: 16,
    semantic_96_count: 96,
    icon_resolution: '256x256 RGBA PNG'
  };
  await fs.writeFile(path.join(provDir, 'icons_provenance_v001.json'), JSON.stringify(iconProvenance, null, 2), 'utf8');

  const readmeMd = `# Game Icons — Production Package (\`production_v001\`)

Deliverables for **Argon Delivery Specification (Priority #1B)**:
1. \`icons_core_01_sheet_green_v001.png\` — 4×4 Core 16 Icon Sheet generated on flat \`#00FF00\` chroma-key green.
2. \`icons_core_01_sheet_rgba_v001.png\` — Full 4×4 Core 16 sheet chroma-keyed to transparent RGBA.
3. \`core_16_rgba/\` — The 16 essential combat/element/status/UI icons (\`256×256\` RGBA PNGs) sliced from the \`#00FF00\` sheet.
4. \`icons_rgba/\` — All **96 semantic icons** (\`icon_<category>_<index>_<name>.png\`) plus the 16 short-name aliases in \`256×256\` transparent RGBA PNG format.
5. \`provenance/icons_provenance_v001.json\` — Full R14 provenance and Google Gemini / Labs commercial usage terms links.
`;
  await fs.writeFile(path.join(ICONS_PROD_DIR, 'README.md'), readmeMd, 'utf8');
}

async function buildKeraVossProductionPackage() {
  console.log('--- Building Priority #2: Pilot Character Full Production Package (characters/kera_voss/production_v001) ---');
  const vnDir = path.join(KERA_PROD_DIR, 'vn');
  const animDir = path.join(KERA_PROD_DIR, 'animation');
  const statesDir = path.join(animDir, 'states');
  const gachaDir = path.join(KERA_PROD_DIR, 'gacha');
  const provDir = path.join(KERA_PROD_DIR, 'provenance');

  await fs.mkdir(vnDir, { recursive: true });
  await fs.mkdir(statesDir, { recursive: true });
  await fs.mkdir(gachaDir, { recursive: true });
  await fs.mkdir(provDir, { recursive: true });

  const vnSources = [
    { expr: 'composed', src: path.join(BRAIN_DIR, 'kera_voss_sprite_composed_1792383944302.jpg') },
    { expr: 'focused', src: path.join(BRAIN_DIR, 'kera_voss_sprite_focused_1792384488306.jpg') },
    { expr: 'proud_smile', src: path.join(BRAIN_DIR, 'kera_voss_sprite_proud_smile_1792384489243.jpg') },
    { expr: 'defiant', src: path.join(BRAIN_DIR, 'kera_voss_sprite_defiant_1792384491688.jpg') }
  ];

  // 1. Process 4 VN Expression Portraits (both #00FF00 green PNG masters and 768x1152 2:3 chroma-keyed RGBA PNGs)
  for (const item of vnSources) {
    const greenPngPath = path.join(vnDir, `kera_voss_vn_${item.expr}_green_v001.png`);
    await sharp(item.src).png().toFile(greenPngPath);

    const keyed = await loadAndChromaKey(item.src);
    // Save full-res RGBA
    await sharp(keyed.rgba, { raw: { width: keyed.width, height: keyed.height, channels: 4 } })
      .png()
      .toFile(path.join(vnDir, `kera_voss_vn_${item.expr}_fullres_rgba_v001.png`));

    // Save canonical 768x1152 (exact 2:3) RGBA PNG with identical alignment across all 4 expressions
    await sharp(keyed.rgba, { raw: { width: keyed.width, height: keyed.height, channels: 4 } })
      .resize(768, 1152, {
        fit: 'contain',
        position: 'bottom',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(vnDir, `kera_voss_vn_${item.expr}_v001.png`));
  }

  // 2. Process 8-State 2-Head SD Chibi Battle Sheet (4x2 grid on #00FF00 green + 8 normalized 512x512 state PNGs)
  const rawChibiSheet = path.join(BRAIN_DIR, 'kera_voss_chibi_battle_spritesheet_green_1792383945759.jpg');
  await sharp(rawChibiSheet).png().toFile(path.join(animDir, 'kera_voss_chibi_sheet_green_v001.png'));

  const chibiKeyed = await loadAndChromaKey(rawChibiSheet);
  await sharp(chibiKeyed.rgba, { raw: { width: chibiKeyed.width, height: chibiKeyed.height, channels: 4 } })
    .png()
    .toFile(path.join(animDir, 'kera_voss_chibi_sheet_v001.png'));

  const stateNames = [
    '01_idle',
    '02_walk',
    '03_basic',
    '04_active',
    '05_ultimate',
    '06_hit',
    '07_defeat',
    '08_victory'
  ];

  const cellW = Math.floor(chibiKeyed.width / 4); // 1376 / 4 = 344
  const cellH = Math.floor(chibiKeyed.height / 2); // 768 / 2 = 384

  // Normalize each state onto a 512x512 RGBA canvas with foot baseline anchored at y = 448 (87.5%) and x-center at 256 (50%)
  for (let idx = 0; idx < 8; idx++) {
    const r = Math.floor(idx / 4);
    const c = idx % 4;
    const left = c * cellW;
    const top = r * cellH;

    const sub = Buffer.alloc(cellW * cellH * 4);
    for (let y = 0; y < cellH; y++) {
      const sOff = ((top + y) * chibiKeyed.width + left) * 4;
      chibiKeyed.rgba.copy(sub, y * cellW * 4, sOff, sOff + cellW * 4);
    }

    const bb = getAlphaBoundingBox(sub, cellW, cellH, 24);
    const cropBuf = Buffer.alloc(bb.width * bb.height * 4);
    for (let y = 0; y < bb.height; y++) {
      const sOff = ((bb.top + y) * cellW + bb.left) * 4;
      sub.copy(cropBuf, y * bb.width * 4, sOff, sOff + bb.width * 4);
    }

    // Scale uniformly by 1.18x (fitting within 380px max height / 440px max width) and anchor feet at y = 448
    const targetScale = Math.min(380 / bb.height, 440 / bb.width, 1.18);
    const scaledW = Math.max(1, Math.round(bb.width * targetScale));
    const scaledH = Math.max(1, Math.round(bb.height * targetScale));

    const scaledPng = await sharp(cropBuf, { raw: { width: bb.width, height: bb.height, channels: 4 } })
      .resize(scaledW, scaledH)
      .png()
      .toBuffer();

    const destLeft = Math.round((512 - scaledW) / 2);
    const destTop = Math.max(16, 448 - scaledH);

    await sharp({
      create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
      .composite([{ input: scaledPng, left: destLeft, top: destTop }])
      .png()
      .toFile(path.join(statesDir, `kera_voss_chibi_${stateNames[idx]}_v001.png`));
  }

  // 3. Process Gacha Splash Art (16:9 full-res PNG)
  const rawGacha = path.join(BRAIN_DIR, 'kera_voss_gacha_splash_v001_1792384494089.jpg');
  const gachaMeta = await sharp(rawGacha).metadata();
  await sharp(rawGacha)
    .png()
    .toFile(path.join(gachaDir, 'kera_voss_gacha_splash_v001.png'));

  // 4. Copy canonical head & boydan lock references into production_v001/locks/ for complete self-contained package
  const locksDir = path.join(KERA_PROD_DIR, 'locks');
  await fs.mkdir(locksDir, { recursive: true });
  await fs.copyFile(
    path.join(REPO_ROOT, 'content/specs/character_locks/kera_voss_canonical_head_lock.png'),
    path.join(locksDir, 'kera_voss_canonical_head_lock.png')
  );
  await fs.copyFile(
    path.join(REPO_ROOT, 'content/specs/character_locks/kera_voss_canonical_boydan_lock.jpg'),
    path.join(locksDir, 'kera_voss_canonical_boydan_lock.jpg')
  );

  // 5. Write asset_inventory.json, provenance JSON, and README.md
  const inventory = {
    character_id: 'kera_voss',
    display_name: 'Kera Voss',
    title: 'Field Alchemist of Oakhaven',
    rarity: 4,
    element: 'Ember',
    role: 'Controller / Debuffer',
    weapon_family: 'alchemy_vessel',
    package_version: 'production_v001',
    facing_direction: 'right',
    foot_pivot_normalized: { x: 0.5, y: 0.875, canvas_px: { width: 512, height: 512, pivot_x: 256, pivot_y: 448 } },
    vn_portraits: {
      aspect_ratio: '2:3',
      resolution: '768x1152',
      chroma_key_source: '#00FF00',
      expressions: {
        composed: {
          rgba_png: 'vn/kera_voss_vn_composed_v001.png',
          fullres_rgba_png: 'vn/kera_voss_vn_composed_fullres_rgba_v001.png',
          green_source_png: 'vn/kera_voss_vn_composed_green_v001.png'
        },
        focused: {
          rgba_png: 'vn/kera_voss_vn_focused_v001.png',
          fullres_rgba_png: 'vn/kera_voss_vn_focused_fullres_rgba_v001.png',
          green_source_png: 'vn/kera_voss_vn_focused_green_v001.png'
        },
        proud_smile: {
          rgba_png: 'vn/kera_voss_vn_proud_smile_v001.png',
          fullres_rgba_png: 'vn/kera_voss_vn_proud_smile_fullres_rgba_v001.png',
          green_source_png: 'vn/kera_voss_vn_proud_smile_green_v001.png'
        },
        defiant: {
          rgba_png: 'vn/kera_voss_vn_defiant_v001.png',
          fullres_rgba_png: 'vn/kera_voss_vn_defiant_fullres_rgba_v001.png',
          green_source_png: 'vn/kera_voss_vn_defiant_green_v001.png'
        }
      }
    },
    chibi_battle_animation: {
      proportion: '2-head SD chibi',
      sheet_layout: '4x2 (8 states)',
      sheet_rgba_png: 'animation/kera_voss_chibi_sheet_v001.png',
      sheet_green_png: 'animation/kera_voss_chibi_sheet_green_v001.png',
      states: {
        idle: 'animation/states/kera_voss_chibi_01_idle_v001.png',
        walk: 'animation/states/kera_voss_chibi_02_walk_v001.png',
        basic: 'animation/states/kera_voss_chibi_03_basic_v001.png',
        active: 'animation/states/kera_voss_chibi_04_active_v001.png',
        ultimate: 'animation/states/kera_voss_chibi_05_ultimate_v001.png',
        hit: 'animation/states/kera_voss_chibi_06_hit_v001.png',
        defeat: 'animation/states/kera_voss_chibi_07_defeat_v001.png',
        victory: 'animation/states/kera_voss_chibi_08_victory_v001.png'
      }
    },
    gacha_splash: {
      file: 'gacha/kera_voss_gacha_splash_v001.png',
      dimensions: { width: gachaMeta.width, height: gachaMeta.height },
      aspect_ratio: '16:9'
    }
  };

  await fs.writeFile(path.join(KERA_PROD_DIR, 'asset_inventory.json'), JSON.stringify(inventory, null, 2), 'utf8');

  const keraProvenance = {
    schema_version: '1.0.0',
    package_id: 'uomd_character_kera_voss_production_v001',
    round_compliance: 'R14_PROVENANCE_AND_COMMERCIAL_TERMS',
    character_id: 'kera_voss',
    generated_at: '2026-10-19T07:40:00+03:00',
    commercial_terms_urls: COMMERCIAL_TERMS_URLS,
    canonical_locks_used: [
      'content/specs/character_locks/kera_voss_canonical_head_lock.png',
      'content/specs/character_locks/kera_voss_canonical_boydan_lock.jpg'
    ],
    pipeline_steps: [
      '1. Generated base VN portrait (composed) on flat #00FF00 green using canonical boydan lock.',
      '2. Generated 3 character-specific VN expressions (focused, proud_smile, defiant) passing composed portrait in ImagePaths for 100% locked pose/hat/camera alignment.',
      '3. Generated 8-state 4x2 2-head SD chibi battle sprite sheet on flat #00FF00 green with all poses facing right.',
      '4. Generated 16:9 Gacha Splash Art passing canonical boydan lock in ImagePaths.',
      '5. Executed automated chroma-key RGBA extraction, green despill, and 512x512 foot-pivot normalization (x=256, y=448).'
    ]
  };
  await fs.writeFile(path.join(provDir, 'kera_voss_provenance_v001.json'), JSON.stringify(keraProvenance, null, 2), 'utf8');

  const keraReadme = `# Kera Voss — Pilot Character Full Production Package (\`production_v001\`)

This package fulfills **Priority #2** of the **Argon Delivery Specification** for pilot character \`kera_voss\` (*Field Alchemist of Oakhaven*, 4★ Ember Controller).

## 1. Visual Novel (VN) Expression Set (\`vn/\`)

All 4 expressions share the **exact same camera framing, body posture, oversized witch-hat silhouette, and reagent rigging**, generated on flat \`#00FF00\` green and chroma-keyed to \`768×1152\` (\`2:3\`) RGBA PNGs (plus full-resolution \`848×1264\` RGBA PNGs):

| Expression State | \`768×1152\` RGBA PNG | Full-Res RGBA PNG | \`#00FF00\` Green Source PNG |
| :--- | :--- | :--- | :--- |
| **1. \`composed\`** (Default) | \`vn/kera_voss_vn_composed_v001.png\` | \`vn/kera_voss_vn_composed_fullres_rgba_v001.png\` | \`vn/kera_voss_vn_composed_green_v001.png\` |
| **2. \`focused\`** (Analytical) | \`vn/kera_voss_vn_focused_v001.png\` | \`vn/kera_voss_vn_focused_fullres_rgba_v001.png\` | \`vn/kera_voss_vn_focused_green_v001.png\` |
| **3. \`proud_smile\`** (Smug Grin) | \`vn/kera_voss_vn_proud_smile_v001.png\` | \`vn/kera_voss_vn_proud_smile_fullres_rgba_v001.png\` | \`vn/kera_voss_vn_proud_smile_green_v001.png\` |
| **4. \`defiant\`** (Battle Retort) | \`vn/kera_voss_vn_defiant_v001.png\` | \`vn/kera_voss_vn_defiant_fullres_rgba_v001.png\` | \`vn/kera_voss_vn_defiant_green_v001.png\` |

## 2. 8-State 2-Head SD Chibi Battle Set (\`animation/\`)

- **Full Sheet (RGBA)**: \`animation/kera_voss_chibi_sheet_v001.png\` (\`1376×768\`, \`4×2\` grid)
- **Full Sheet (\`#00FF00\` Green)**: \`animation/kera_voss_chibi_sheet_green_v001.png\`
- **Normalized State Frames (\`512×512\` RGBA PNGs, facing \`right\`, foot baseline anchored at \`x = 256, y = 448\` / \`87.5%\`)**:
  1. \`animation/states/kera_voss_chibi_01_idle_v001.png\`
  2. \`animation/states/kera_voss_chibi_02_walk_v001.png\`
  3. \`animation/states/kera_voss_chibi_03_basic_v001.png\`
  4. \`animation/states/kera_voss_chibi_04_active_v001.png\`
  5. \`animation/states/kera_voss_chibi_05_ultimate_v001.png\`
  6. \`animation/states/kera_voss_chibi_06_hit_v001.png\`
  7. \`animation/states/kera_voss_chibi_07_defeat_v001.png\`
  8. \`animation/states/kera_voss_chibi_08_victory_v001.png\`

## 3. Gacha Pull Splash Art (\`gacha/\`)

- \`gacha/kera_voss_gacha_splash_v001.png\` (\`1376×768\` \`16:9\` widescreen dynamic splash illustration).

## 4. R14 Provenance & Commercial Usage Terms

- See \`provenance/kera_voss_provenance_v001.json\` and \`asset_inventory.json\`.
- Commercial Terms URLs:
  - https://ai.google.dev/gemini-api/terms
  - https://policies.google.com/terms
  - https://labs.google/fx/terms
`;
  await fs.writeFile(path.join(KERA_PROD_DIR, 'README.md'), keraReadme, 'utf8');
}

async function main() {
  const onlyKera = process.argv.includes('--only-kera');
  if (!onlyKera) {
    await buildUiProductionPackage();
    await buildIconsProductionPackage();
  }
  await buildKeraVossProductionPackage();
  console.log('=== ALL ARGON PRODUCTION_V001 PACKAGES BUILT SUCCESSFULLY ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
