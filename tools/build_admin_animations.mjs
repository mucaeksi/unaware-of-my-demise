/* global Buffer, console, process */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const REPO_ROOT = process.cwd();
const BRAIN_DIR = 'C:/Users/PC/.gemini/antigravity/brain/b194a43b-1915-4e29-a519-ec7a136f263a';
const ADMIN_ANIM_DIR = path.join(REPO_ROOT, 'apps/admin/public/dev/animations');
const WORKBENCH_GIF_DIR = path.join(REPO_ROOT, 'narrative/15_Art_Workbench/ui_animations/gifs');

const UI_KIT_DIR = path.join(REPO_ROOT, 'narrative/15_Art_Workbench/ui_screens/production_v001/ui_kit');
const ICONS_CORE_DIR = path.join(REPO_ROOT, 'narrative/15_Art_Workbench/icons/production_v001/core_16_rgba');
const KERA_DIR = path.join(REPO_ROOT, 'narrative/15_Art_Workbench/characters/kera_voss/production_v001');

/**
 * Helper: Stack an array of RGBA raw frame buffers (each width x height x 4) and encode as an animated GIF.
 */
async function encodeAnimatedGif(frameBuffers, width, height, delayMs, outPath) {
  const count = frameBuffers.length;
  const stacked = Buffer.concat(frameBuffers);
  const delays = Array.isArray(delayMs) ? delayMs : Array(count).fill(delayMs);
  await sharp(stacked, {
    raw: {
      width,
      height: height * count,
      channels: 4,
      pageHeight: height
    }
  })
    .gif({ delay: delays, loop: 0 })
    .toFile(outPath);
}

/**
 * Slice a 2x2 sheet (width x height) into 4 frames and build a smooth 16-frame ping-pong + pulse + particle animated GIF.
 */
async function buildSheet2x2AnimatedGif(sheetPath, outGifPath, opts = {}) {
  const { width = 480, height = 270, delayMs = 95, glowColor = [212, 155, 53] } = opts;
  const meta = await sharp(sheetPath).metadata();
  const cw = Math.floor(meta.width / 2);
  const ch = Math.floor(meta.height / 2);

  const quadrants = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const buf = await sharp(sheetPath)
        .extract({ left: c * cw, top: r * ch, width: cw, height: ch })
        .resize(width, height, { fit: 'cover' })
        .ensureAlpha()
        .raw()
        .toBuffer();
      quadrants.push(buf);
    }
  }

  // Create 16 smooth interpolated + subtle breathing/glow frames across the 4 keyframes (0 -> 1 -> 2 -> 3 -> 0)
  const frames = [];
  const totalFrames = 16;
  for (let f = 0; f < totalFrames; f++) {
    const progress = (f / totalFrames) * 4;
    const idxA = Math.floor(progress) % 4;
    const idxB = (idxA + 1) % 4;
    const t = progress - Math.floor(progress);
    // Smoothstep blend
    const s = t * t * (3 - 2 * t);

    const bufA = quadrants[idxA];
    const bufB = quadrants[idxB];
    const out = Buffer.alloc(width * height * 4);

    const pulse = 0.5 + 0.5 * Math.sin((f / totalFrames) * Math.PI * 2);

    for (let i = 0; i < width * height; i++) {
      const p = i * 4;
      let r = Math.round(bufA[p] * (1 - s) + bufB[p] * s);
      let g = Math.round(bufA[p + 1] * (1 - s) + bufB[p + 1] * s);
      let b = Math.round(bufA[p + 2] * (1 - s) + bufB[p + 2] * s);

      // Subtle highlight shimmer on bright pixels
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma > 165) {
        const boost = pulse * 0.14;
        r = Math.min(255, Math.round(r + glowColor[0] * boost));
        g = Math.min(255, Math.round(g + glowColor[1] * boost));
        b = Math.min(255, Math.round(b + glowColor[2] * boost));
      }

      out[p] = r;
      out[p + 1] = g;
      out[p + 2] = b;
      out[p + 3] = 255;
    }
    frames.push(out);
  }

  await encodeAnimatedGif(frames, width, height, delayMs, outGifPath);
}

/**
 * 05: Build 4-state UI Kit Gothic Button interactive cycle GIF
 */
async function buildButton4StateGif(outGifPath) {
  const width = 480;
  const height = 220;
  const states = [
    { file: 'button_primary_normal_v001.png', label: 'NORMAL (Default)', dy: 0, glow: 0 },
    { file: 'button_primary_hover_v001.png', label: 'HOVER (Focus Glow)', dy: -2, glow: 1 },
    { file: 'button_primary_pressed_v001.png', label: 'PRESSED (Active Click)', dy: 4, glow: 0.5 },
    { file: 'button_primary_disabled_v001.png', label: 'DISABLED (Locked)', dy: 0, glow: 0 }
  ];

  const stateImages = [];
  for (const st of states) {
    const p = path.join(UI_KIT_DIR, st.file);
    const resized = await sharp(p)
      .resize(360, 120, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    stateImages.push({ ...st, png: resized });
  }

  const frames = [];
  // 4 frames per state = 16 frames total
  for (let sIdx = 0; sIdx < states.length; sIdx++) {
    const st = stateImages[sIdx];
    for (let sub = 0; sub < 4; sub++) {
      const pulse = 0.5 + 0.5 * Math.sin((sub / 4) * Math.PI * 2);
      const badgeColor =
        sIdx === 0 ? '#8A6421' : sIdx === 1 ? '#E5A93C' : sIdx === 2 ? '#C84B31' : '#555B66';

      const bgSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bg" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stop-color="#1D152B"/>
            <stop offset="100%" stop-color="#0B0811"/>
          </radialGradient>
          <radialGradient id="glow" cx="50%" cy="48%" r="45%">
            <stop offset="0%" stop-color="#F2B84B" stop-opacity="${(st.glow * (0.22 + 0.12 * pulse)).toFixed(2)}"/>
            <stop offset="100%" stop-color="#F2B84B" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#bg)"/>
        <rect x="8" y="8" width="${width - 16}" height="${height - 16}" rx="8" fill="none" stroke="#3A2B4C" stroke-width="1.5"/>
        <ellipse cx="240" cy="100" rx="190" ry="70" fill="url(#glow)"/>
        <rect x="130" y="172" width="220" height="28" rx="14" fill="#120D1A" stroke="${badgeColor}" stroke-width="1.5"/>
        <text x="240" y="191" fill="#F0E6D2" font-family="Georgia, serif" font-size="13" font-weight="bold" text-anchor="middle">${st.label}</text>
      </svg>`;

      const frameRaw = await sharp(Buffer.from(bgSvg))
        .composite([{ input: st.png, left: 60, top: 34 + st.dy }])
        .ensureAlpha()
        .raw()
        .toBuffer();
      frames.push(frameRaw);
    }
  }

  await encodeAnimatedGif(frames, width, height, 130, outGifPath);
}

/**
 * 06: Build Animated HP & Focus Bar Gauge Fill GIF
 */
async function buildBarsAnimatedGif(outGifPath) {
  const width = 480;
  const height = 220;

  const emptyBar = await sharp(path.join(UI_KIT_DIR, 'bar_frame_empty_v001.png'))
    .resize(400, 48, { fit: 'fill' })
    .png()
    .toBuffer();

  const frames = [];
  const totalFrames = 18;
  // Simulate HP taking a hit and recovering, while Focus fills from 20% to 100% and triggers Ultimate Ready glow
  const hpCurve = [0.92, 0.92, 0.58, 0.54, 0.52, 0.52, 0.64, 0.76, 0.88, 0.96, 1.0, 1.0, 1.0, 0.82, 0.78, 0.85, 0.92, 0.92];
  const focusCurve = [0.25, 0.32, 0.40, 0.48, 0.56, 0.64, 0.72, 0.80, 0.88, 0.95, 1.0, 1.0, 1.0, 1.0, 0.15, 0.20, 0.22, 0.25];

  for (let f = 0; f < totalFrames; f++) {
    const hpPct = hpCurve[f];
    const focusPct = focusCurve[f];
    const ultReady = focusPct >= 0.99;

    const hpW = Math.max(8, Math.round(352 * hpPct));
    const focusW = Math.max(8, Math.round(352 * focusPct));

    const hpFill = await sharp(path.join(UI_KIT_DIR, 'bar_fill_hp_crimson_v001.png'))
      .resize(hpW, 22, { fit: 'fill' })
      .png()
      .toBuffer();

    const focusFill = await sharp(path.join(UI_KIT_DIR, 'bar_fill_focus_gold_violet_v001.png'))
      .resize(focusW, 22, { fit: 'fill' })
      .png()
      .toBuffer();

    const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#0E0A16"/>
      <rect x="8" y="8" width="${width - 16}" height="${height - 16}" rx="8" fill="none" stroke="#3A2B4C" stroke-width="1.5"/>
      <text x="44" y="36" fill="#E8D8B8" font-family="Georgia, serif" font-size="13" font-weight="bold">VITALITY (HP GAUGE)</text>
      <text x="436" y="36" fill="#E05A5A" font-family="monospace" font-size="13" font-weight="bold" text-anchor="end">${Math.round(hpPct * 2450)} / 2450</text>
      <text x="44" y="128" fill="#E8D8B8" font-family="Georgia, serif" font-size="13" font-weight="bold">ECLIPSE FOCUS GAUGE</text>
      <text x="436" y="128" fill="${ultReady ? '#FFD166' : '#B993F8'}" font-family="monospace" font-size="13" font-weight="bold" text-anchor="end">${Math.round(focusPct * 100)}% ${ultReady ? '★ ULTIMATE READY' : ''}</text>
      ${ultReady ? `<rect x="36" y="138" width="408" height="54" rx="10" fill="none" stroke="#FFD166" stroke-width="2.5" stroke-opacity="0.85"/>` : ''}
    </svg>`;

    const frameRaw = await sharp(Buffer.from(svg))
      .composite([
        { input: emptyBar, left: 40, top: 46 },
        { input: hpFill, left: 64, top: 59 },
        { input: emptyBar, left: 40, top: 140 },
        { input: focusFill, left: 64, top: 153 }
      ])
      .ensureAlpha()
      .raw()
      .toBuffer();
    frames.push(frameRaw);
  }

  await encodeAnimatedGif(frames, width, height, 100, outGifPath);
}

/**
 * 07 & 08: Build Kera Voss 8-State Chibi Showcase GIF and In-Battle Combo GIF
 */
async function buildKeraChibiGifs(outShowcaseGif, outComboGif) {
  const statesDir = path.join(KERA_DIR, 'animation/states');
  const stateDefs = [
    { file: 'kera_voss_chibi_01_idle_v001.png', name: '01 · IDLE (Ready Stance)', dx: 0, dy: 0 },
    { file: 'kera_voss_chibi_02_walk_v001.png', name: '02 · WALK (Advance)', dx: 12, dy: -6 },
    { file: 'kera_voss_chibi_03_basic_v001.png', name: '03 · BASIC (Mortar Strike)', dx: 26, dy: -2 },
    { file: 'kera_voss_chibi_04_active_v001.png', name: '04 · ACTIVE (Cinder Flask)', dx: 18, dy: -8 },
    { file: 'kera_voss_chibi_05_ultimate_v001.png', name: '05 · ULTIMATE (Eclipse Pyre)', dx: 8, dy: -16 },
    { file: 'kera_voss_chibi_06_hit_v001.png', name: '06 · HIT (Damage Recoil)', dx: -18, dy: 2 },
    { file: 'kera_voss_chibi_07_defeat_v001.png', name: '07 · DEFEAT (Collapsed)', dx: -10, dy: 10 },
    { file: 'kera_voss_chibi_08_victory_v001.png', name: '08 · VICTORY (Alchemist Pride)', dx: 0, dy: -10 }
  ];

  const width = 420;
  const height = 420;
  const showcaseFrames = [];

  for (let idx = 0; idx < stateDefs.length; idx++) {
    const st = stateDefs[idx];
    const spritePath = path.join(statesDir, st.file);

    // 3 sub-frames per state (with procedural bob/lunge/breathing so the character is actively moving!)
    for (let sub = 0; sub < 3; sub++) {
      const bobY = sub === 1 ? -5 : sub === 2 ? -2 : 0;
      const lungeX = sub === 1 ? Math.round(st.dx * 0.5) : 0;
      const scaleH = sub === 1 ? 306 : 300;
      const spriteBuf = await sharp(spritePath)
        .resize(300, scaleH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      const isUlt = idx === 4;
      const isHit = idx === 5;
      const auraColor = isUlt ? '#FF7B29' : isHit ? '#E03E3E' : '#C88A2E';
      const auraOpacity = isUlt ? (sub === 1 ? 0.42 : 0.26) : isHit ? 0.28 : 0.14;

      const stageSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="stageBg" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stop-color="#251A36"/>
            <stop offset="100%" stop-color="#0B0812"/>
          </radialGradient>
          <radialGradient id="aura" cx="50%" cy="55%" r="42%">
            <stop offset="0%" stop-color="${auraColor}" stop-opacity="${auraOpacity}"/>
            <stop offset="100%" stop-color="${auraColor}" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#stageBg)"/>
        <!-- Floor grid & shadow -->
        <ellipse cx="${210 + lungeX}" cy="336" rx="86" ry="20" fill="#040307" fill-opacity="0.78"/>
        <ellipse cx="${210 + lungeX}" cy="336" rx="68" ry="13" fill="none" stroke="${auraColor}" stroke-opacity="0.45" stroke-width="1.5"/>
        <circle cx="210" cy="210" r="150" fill="url(#aura)"/>
        <!-- Header & Footer -->
        <rect x="14" y="14" width="392" height="32" rx="6" fill="#140E20" fill-opacity="0.9" stroke="#4A3660" stroke-width="1"/>
        <text x="210" y="35" fill="#F2DEC1" font-family="Georgia, serif" font-size="14" font-weight="bold" text-anchor="middle">${st.name}</text>
        <text x="210" y="396" fill="#9E8FB2" font-family="monospace" font-size="11" text-anchor="middle">KERA VOSS · 2-HEAD SD CHIBI · PIVOT (0.5, 0.875)</text>
      </svg>`;

      const frameRaw = await sharp(Buffer.from(stageSvg))
        .composite([{ input: spriteBuf, left: 60 + lungeX, top: 62 + bobY + Math.round(st.dy * 0.4) }])
        .ensureAlpha()
        .raw()
        .toBuffer();

      showcaseFrames.push(frameRaw);
    }
  }

  await encodeAnimatedGif(showcaseFrames, width, height, 115, outShowcaseGif);

  // Also build a fast Battle Combo Sequence GIF (Idle -> Walk -> Basic -> Active -> Ultimate -> Victory)
  const comboIndices = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 7, 7];
  const comboFrames = comboIndices.map((i, step) => showcaseFrames[i * 3 + (step % 3)]);
  await encodeAnimatedGif(comboFrames, width, height, 95, outComboGif);
}

/**
 * 09: Build Kera Voss VN 4-Expression In-Context Stage GIF
 */
async function buildKeraVnGif(outVnGif) {
  const vnDir = path.join(KERA_DIR, 'vn');
  const expressions = [
    {
      file: 'kera_voss_vn_composed_v001.png',
      tag: 'COMPOSED (Default)',
      line: '"Stand back from the brazier, Aldric. One wrong draft and this batch blisters the cobbles."'
    },
    {
      file: 'kera_voss_vn_focused_v001.png',
      tag: 'FOCUSED (Analytical)',
      line: '"Two grains of cinder-salt, three drops of bell-water... the reaction is stabilizing."'
    },
    {
      file: 'kera_voss_vn_proud_smile_v001.png',
      tag: 'PROUD SMILE (Smug Grin)',
      line: '"Told you my mortar outlasts Sanctum steel. Try not to waste this flask."'
    },
    {
      file: 'kera_voss_vn_defiant_v001.png',
      tag: 'DEFIANT (Battle Retort)',
      line: '"If the Veil wants Oakhaven\'s square, it can choke on my sulfur first!"'
    }
  ];

  const width = 560;
  const height = 360;
  const frames = [];

  for (let idx = 0; idx < expressions.length; idx++) {
    const exp = expressions[idx];
    const portraitPath = path.join(vnDir, exp.file);

    for (let sub = 0; sub < 4; sub++) {
      const breathY = sub === 1 || sub === 2 ? -3 : 0;
      const portraitBuf = await sharp(portraitPath)
        .resize(230, 345, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      const vnSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="vnBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1E142B"/>
            <stop offset="55%" stop-color="#120D1C"/>
            <stop offset="100%" stop-color="#2A1715"/>
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#vnBg)"/>
        <circle cx="155" cy="175" r="130" fill="#D4842A" fill-opacity="0.12"/>
        <!-- Expression Badge -->
        <rect x="276" y="24" width="260" height="30" rx="6" fill="#171024" stroke="#C88A2E" stroke-width="1.5"/>
        <text x="406" y="44" fill="#F5D799" font-family="Georgia, serif" font-size="13" font-weight="bold" text-anchor="middle">${exp.tag}</text>
        <!-- VN Dialogue Box -->
        <rect x="16" y="242" width="528" height="104" rx="8" fill="#0E0A16" fill-opacity="0.92" stroke="#B6863A" stroke-width="2"/>
        <rect x="28" y="230" width="144" height="24" rx="4" fill="#2A1B38" stroke="#D49B35" stroke-width="1.5"/>
        <text x="100" y="247" fill="#FFE3A8" font-family="Georgia, serif" font-size="12" font-weight="bold" text-anchor="middle">KERA VOSS</text>
        <text x="34" y="278" fill="#EDE3D2" font-family="Georgia, serif" font-size="13">${exp.line.slice(0, 58)}</text>
        <text x="34" y="300" fill="#EDE3D2" font-family="Georgia, serif" font-size="13">${exp.line.slice(58)}</text>
        <text x="524" y="332" fill="#D49B35" font-family="monospace" font-size="11" text-anchor="end">▼ AUTO · 2:3 RGBA</text>
      </svg>`;

      const frameRaw = await sharp(Buffer.from(vnSvg))
        .composite([{ input: portraitBuf, left: 32, top: 8 + breathY }])
        .ensureAlpha()
        .raw()
        .toBuffer();

      frames.push(frameRaw);
    }
  }

  await encodeAnimatedGif(frames, width, height, 150, outVnGif);
}

async function copySupportingAssetsForLiveStage() {
  const stageAssetsDir = path.join(ADMIN_ANIM_DIR, 'assets');
  await fs.mkdir(stageAssetsDir, { recursive: true });

  // Copy UI Kit RGBA files
  const uiFiles = await fs.readdir(UI_KIT_DIR);
  for (const f of uiFiles) {
    if (f.endsWith('.png')) {
      await fs.copyFile(path.join(UI_KIT_DIR, f), path.join(stageAssetsDir, f));
    }
  }

  // Copy Core 16 RGBA icons
  const coreIcons = await fs.readdir(ICONS_CORE_DIR);
  for (const f of coreIcons) {
    if (f.endsWith('.png')) {
      await fs.copyFile(path.join(ICONS_CORE_DIR, f), path.join(stageAssetsDir, f));
    }
  }

  // Copy Kera Voss VN RGBA portraits, Chibi states, and Gacha Splash
  const vnFiles = ['kera_voss_vn_composed_v001.png', 'kera_voss_vn_focused_v001.png', 'kera_voss_vn_proud_smile_v001.png', 'kera_voss_vn_defiant_v001.png'];
  for (const f of vnFiles) {
    await fs.copyFile(path.join(KERA_DIR, 'vn', f), path.join(stageAssetsDir, f));
  }

  const stateFiles = await fs.readdir(path.join(KERA_DIR, 'animation/states'));
  for (const f of stateFiles) {
    if (f.endsWith('.png')) {
      await fs.copyFile(path.join(KERA_DIR, 'animation/states', f), path.join(stageAssetsDir, f));
    }
  }

  await fs.copyFile(
    path.join(KERA_DIR, 'gacha/kera_voss_gacha_splash_v001.png'),
    path.join(stageAssetsDir, 'kera_voss_gacha_splash_v001.png')
  );

  // Copy Title Screen & Hub background plates for in-context preview
  const bgSources = [
    'ui_title_main_menu_v001.jpg',
    'ui_hub_sanctuary_v001.jpg',
    'ui_gacha_summon_altar_v001.jpg',
    'ui_patch_loading_screen_v001.jpg'
  ];
  for (const bg of bgSources) {
    const src = path.join(REPO_ROOT, 'narrative/15_Art_Workbench/ui_screens', bg);
    await fs.copyFile(src, path.join(stageAssetsDir, bg));
  }
}

async function main() {
  await fs.mkdir(ADMIN_ANIM_DIR, { recursive: true });
  await fs.mkdir(WORKBENCH_GIF_DIR, { recursive: true });

  console.log('1/7 Building Step 1 UI Animation GIFs (01..04)...');
  await buildSheet2x2AnimatedGif(
    path.join(BRAIN_DIR, 'ui_anim_step1_01_eclipse_corona_loop_v001_1792373858381.jpg'),
    path.join(ADMIN_ANIM_DIR, '01_ui_eclipse_corona_loop.gif'),
    { glowColor: [235, 168, 52] }
  );
  await buildSheet2x2AnimatedGif(
    path.join(BRAIN_DIR, 'ui_anim_step1_02_bell_resonance_v001_1792373864626.jpg'),
    path.join(ADMIN_ANIM_DIR, '02_ui_bell_resonance_pulse.gif'),
    { glowColor: [240, 185, 70] }
  );
  await buildSheet2x2AnimatedGif(
    path.join(BRAIN_DIR, 'ui_anim_step1_03_title_button_seal_v001_1792373859072.jpg'),
    path.join(ADMIN_ANIM_DIR, '03_ui_title_cta_wax_seal.gif'),
    { glowColor: [225, 85, 65] }
  );
  await buildSheet2x2AnimatedGif(
    path.join(BRAIN_DIR, 'ui_anim_step1_04_loading_watch_bell_v001_1792373859575.jpg'),
    path.join(ADMIN_ANIM_DIR, '04_ui_loading_watch_bell.gif'),
    { glowColor: [212, 165, 85] }
  );

  console.log('2/7 Building UI Kit 4-State Button GIF (05)...');
  await buildButton4StateGif(path.join(ADMIN_ANIM_DIR, '05_ui_kit_button_4state_cycle.gif'));

  console.log('3/7 Building UI Kit HP & Focus Bars Live GIF (06)...');
  await buildBarsAnimatedGif(path.join(ADMIN_ANIM_DIR, '06_ui_kit_hp_focus_bars_live.gif'));

  console.log('4/7 Building Kera Voss 8-State Chibi Showcase & Battle Combo GIFs (07 & 08)...');
  await buildKeraChibiGifs(
    path.join(ADMIN_ANIM_DIR, '07_kera_voss_chibi_all_8_states.gif'),
    path.join(ADMIN_ANIM_DIR, '08_kera_voss_chibi_combat_combo.gif')
  );

  console.log('5/7 Building Kera Voss VN 4-Expression Live Stage GIF (09)...');
  await buildKeraVnGif(path.join(ADMIN_ANIM_DIR, '09_kera_voss_vn_expressions_live.gif'));

  console.log('6/7 Copying GIFs to workbench & brain artifact directory...');
  const gifFiles = (await fs.readdir(ADMIN_ANIM_DIR)).filter((f) => f.endsWith('.gif'));
  for (const gf of gifFiles) {
    await fs.copyFile(path.join(ADMIN_ANIM_DIR, gf), path.join(WORKBENCH_GIF_DIR, gf));
    await fs.copyFile(path.join(ADMIN_ANIM_DIR, gf), path.join(BRAIN_DIR, gf));
  }

  console.log('7/7 Copying supporting RGBA & stage assets to apps/admin/public/dev/animations/assets...');
  await copySupportingAssetsForLiveStage();

  console.log('=== ALL 9 ANIMATED GIFS & ADMIN LIVE STAGE ASSETS GENERATED SUCCESSFULLY ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
