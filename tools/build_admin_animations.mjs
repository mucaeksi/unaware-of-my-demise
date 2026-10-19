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

const BASE_ART_DIR = path.join(REPO_ROOT, 'content/base/art');

/**
 * 10: Build First AAB Splash -> SovTaym Studios Intro Sequence GIF
 */
async function buildAabSplashStudioGif(outGifPath) {
  const width = 520;
  const height = 292;
  const studioMark = await sharp(path.join(BASE_ART_DIR, 'ui_studio_mark.webp'))
    .resize(110, 110, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const frames = [];
  const totalFrames = 16;
  for (let f = 0; f < totalFrames; f++) {
    const isSplash = f < 6;
    const rot = f * 22.5;

    if (isSplash) {
      const ruleW = Math.round(80 + (f / 5) * 280);
      const glintX = Math.round(90 + (f / 5) * 340);
      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="#04020A"/>
        <g transform="translate(260, 146) rotate(${rot})">
          <circle cx="0" cy="0" r="84" fill="none" stroke="#E3C37D" stroke-opacity="0.45" stroke-width="2" stroke-dasharray="10 8"/>
          <circle cx="0" cy="0" r="102" fill="none" stroke="#9B4DFF" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="4 10"/>
        </g>
        <ellipse cx="260" cy="148" rx="160" ry="42" fill="none" stroke="#00E5FF" stroke-opacity="0.35" stroke-width="2"/>
        <ellipse cx="260" cy="148" rx="130" ry="32" fill="none" stroke="#FF2A85" stroke-opacity="0.38" stroke-width="1.5"/>
        <line x1="110" y1="210" x2="410" y2="88" stroke="#00E5FF" stroke-opacity="0.65" stroke-width="3"/>
        <line x1="116" y1="214" x2="416" y2="92" stroke="#FF2A85" stroke-opacity="0.65" stroke-width="3"/>
        <text x="260" y="88" fill="#B5A6C8" font-family="Georgia, serif" font-size="11" letter-spacing="6" text-anchor="middle">POWERED BY</text>
        <text x="260" y="156" fill="#F4EFE6" font-family="Georgia, serif" font-size="44" font-weight="bold" letter-spacing="10" text-anchor="middle">PIXIJS</text>
        <rect x="${260 - Math.floor(ruleW / 2)}" y="182" width="${ruleW}" height="2.5" fill="#E3C37D"/>
        <circle cx="${glintX}" cy="146" r="14" fill="#00E5FF" fill-opacity="0.55"/>
        <text x="260" y="208" fill="#9ECFFF" font-family="monospace" font-size="10" letter-spacing="3" text-anchor="middle">WEBGL2 · GOTHIC DOM UI · v8.0</text>
        <rect x="12" y="12" width="230" height="24" rx="5" fill="#140D22" stroke="#D49B35" stroke-width="1"/>
        <text x="127" y="28" fill="#FFE3A8" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">SAHNE 1/15 · SPLASH ENGINE</text>
      </svg>`;
      frames.push(await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer());
    } else {
      const sf = f - 6;
      const ringRadius = 18 + (sf % 5) * 26;
      const ringAlpha = Math.max(0.05, 0.85 - (sf % 5) * 0.18).toFixed(2);
      const bellAngle = (Math.sin(sf * 0.9) * 8).toFixed(1);
      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="#05030A"/>
        <g transform="translate(260, 96) rotate(${rot})">
          <circle cx="0" cy="0" r="68" fill="none" stroke="#E3C37D" stroke-opacity="0.52" stroke-width="2" stroke-dasharray="12 6"/>
        </g>
        <g transform="translate(260, 96) rotate(${-rot * 0.8})">
          <circle cx="0" cy="0" r="54" fill="none" stroke="#C9B6E4" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="6 6"/>
        </g>
        <ellipse cx="260" cy="172" rx="${ringRadius * 1.5}" ry="${ringRadius * 0.75}" fill="none" stroke="#F6E3B4" stroke-opacity="${ringAlpha}" stroke-width="2"/>
        <line x1="120" y1="172" x2="236" y2="172" stroke="#E3C37D" stroke-width="2"/>
        <line x1="284" y1="172" x2="400" y2="172" stroke="#E3C37D" stroke-width="2"/>
        <g transform="translate(260, 162) rotate(${bellAngle})">
          <polygon points="-7,2 7,2 11,16 -11,16" fill="#2A1B14" stroke="#F6E3B4" stroke-width="1.5"/>
          <circle cx="0" cy="18" r="2.5" fill="#F6E3B4"/>
        </g>
        <text x="260" y="214" fill="#EFE8F5" font-family="Georgia, serif" font-size="28" font-weight="bold" letter-spacing="5" text-anchor="middle">SOVTAYM STUDIOS</text>
        <text x="260" y="244" fill="#E3C37D" font-family="Georgia, serif" font-style="italic" font-size="15" letter-spacing="7" text-anchor="middle">PRESENTS</text>
        <rect x="12" y="12" width="230" height="24" rx="5" fill="#140D22" stroke="#D49B35" stroke-width="1"/>
        <text x="127" y="28" fill="#FFE3A8" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">SAHNE 2/15 · SOVTAYM STUDIOS</text>
      </svg>`;
      const raw = await sharp(Buffer.from(svg))
        .composite([{ input: studioMark, left: 205, top: 41 }])
        .ensureAlpha()
        .raw()
        .toBuffer();
      frames.push(raw);
    }
  }
  await encodeAnimatedGif(frames, width, height, 115, outGifPath);
}

/**
 * 11: Build First AAB TitleScreen Full In-Context Animated GIF
 */
async function buildAabTitleScreenGif(outGifPath) {
  const width = 520;
  const height = 292;
  const bgBuf = await sharp(path.join(BASE_ART_DIR, 'ui_title_bg.webp'))
    .resize(width, height, { fit: 'cover' })
    .png()
    .toBuffer();
  const logoBuf = await sharp(path.join(BASE_ART_DIR, 'ui_logo.webp'))
    .resize(230, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const frames = [];
  const totalFrames = 16;
  for (let f = 0; f < totalFrames; f++) {
    const rot = f * 18;
    const bellAng = (Math.sin((f / totalFrames) * Math.PI * 2) * 7.5).toFixed(1);
    const waveR = 16 + (f % 8) * 18;
    const waveA = Math.max(0.06, 0.82 - (f % 8) * 0.1).toFixed(2);
    const burst = f >= 12;
    const burstR = (f - 11) * 28;
    const sheenX = -60 + f * 28;

    const overlaySvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="42" fill="#05030A" fill-opacity="0.58"/>
      <rect x="0" y="212" width="${width}" height="80" fill="#05030A" fill-opacity="0.78"/>
      <rect x="14" y="10" width="175" height="22" rx="11" fill="#120A18" fill-opacity="0.82" stroke="#E3C37D" stroke-width="1"/>
      <circle cx="25" cy="21" r="4" fill="#5EE39B"/>
      <text x="35" y="25" fill="#E3C37D" font-family="monospace" font-size="9" font-weight="bold">SANCTUM-01 · ONLINE</text>
      <g transform="translate(152, 92) rotate(${rot})">
        <circle cx="0" cy="0" r="56" fill="none" stroke="#E3C37D" stroke-opacity="0.65" stroke-width="2" stroke-dasharray="10 6"/>
        <circle cx="0" cy="0" r="68" fill="none" stroke="#C9B6E4" stroke-opacity="0.38" stroke-width="1.2" stroke-dasharray="4 8"/>
      </g>
      <ellipse cx="152" cy="40" rx="${waveR * 1.4}" ry="${waveR * 0.65}" fill="none" stroke="#F6E3B4" stroke-opacity="${waveA}" stroke-width="1.8"/>
      <g transform="translate(152, 24) rotate(${bellAng})">
        <polygon points="-8,2 8,2 13,20 -13,20" fill="#2A1B14" stroke="#F6E3B4" stroke-width="1.5"/>
        <line x1="2" y1="6" x2="-2" y2="17" stroke="#FF9D42" stroke-width="1.8"/>
        <circle cx="0" cy="22" r="3" fill="#F6E3B4"/>
      </g>
      <rect x="52" y="162" width="200" height="38" rx="19" fill="#2E163A" stroke="#F6E3B4" stroke-width="2"/>
      <line x1="${Math.max(58, Math.min(240, sheenX))}" y1="164" x2="${Math.max(70, Math.min(246, sheenX + 24))}" y2="198" stroke="#FFF4D4" stroke-opacity="0.55" stroke-width="10"/>
      <text x="152" y="185" fill="#F8F2E8" font-family="Georgia, serif" font-size="12" font-weight="bold" text-anchor="middle">PLAY PREVIEW BUILD</text>
      <line x1="120" y1="248" x2="185" y2="248" stroke="#F6E3B4" stroke-width="1.5"/>
      <line x1="335" y1="248" x2="400" y2="248" stroke="#F6E3B4" stroke-width="1.5"/>
      <text x="260" y="253" fill="#F8F2E8" font-family="Georgia, serif" font-size="14" font-weight="bold" letter-spacing="3" text-anchor="middle">TAP TO START</text>
      ${
        !burst
          ? `<circle cx="324" cy="248" r="10" fill="#9E1B34" stroke="#F6E3B4" stroke-width="1.5"/>`
          : `<circle cx="324" cy="248" r="${burstR}" fill="none" stroke="#F6E3B4" stroke-opacity="${(1 - (f - 11) * 0.22).toFixed(2)}" stroke-width="2.5"/>
             <circle cx="${324 - (f - 11) * 8}" cy="244" r="6" fill="#9E1B34" stroke="#F6E3B4" stroke-width="1"/>
             <circle cx="${324 + (f - 11) * 8}" cy="244" r="6" fill="#9E1B34" stroke="#F6E3B4" stroke-width="1"/>`
      }
      <text x="260" y="274" fill="#E3C37D" font-family="monospace" font-size="9" text-anchor="middle">SAHNE 3/15 · TITLE SCREEN (CORONA + BELL + WAX SEAL)</text>
    </svg>`;

    const raw = await sharp(bgBuf)
      .composite([
        { input: logoBuf, left: 37, top: 44 + Math.round(Math.sin((f / totalFrames) * Math.PI * 2) * 3) },
        { input: Buffer.from(overlaySvg), left: 0, top: 0 }
      ])
      .ensureAlpha()
      .raw()
      .toBuffer();
    frames.push(raw);
  }
  await encodeAnimatedGif(frames, width, height, 110, outGifPath);
}

/**
 * 12: Build First AAB 120s 9-Scene Prologue ("Before the Road") Animated Flow GIF
 */
async function buildAabPrologueFlowGif(outGifPath) {
  const width = 520;
  const height = 292;
  const shots = [
    { file: 'still_prologue_crownfall.webp', cap: 'I · CROWNFALL', line: 'When the High Sanctum fell, the sky forgot how to dawn.' },
    { file: 'still_prologue_roads.webp', cap: 'II · THE ASH ROADS', line: 'Only the bell-posts remained to mark where the realm had been.' },
    { file: 'still_prologue_throne_wars.webp', cap: 'III · THRONE WARS', line: 'Banners burned to cinders while the dead kept their vigil.' },
    { file: 'still_prologue_reunion.webp', cap: 'V · THE REUNION', line: 'Two wardens met beneath the fractured sanctuary arch.' },
    { file: 'still_prologue_search.webp', cap: 'IX · BEFORE THE ROAD', line: 'As long as the bell still rings, our road is not yet over.' }
  ];

  const frames = [];
  for (let s = 0; s < shots.length; s++) {
    const shot = shots[s];
    for (let sub = 0; sub < 3; sub++) {
      const zoom = 1.0 + sub * 0.03;
      const sw = Math.round(width * zoom);
      const sh = Math.round(height * zoom);
      const plateBuf = await sharp(path.join(BASE_ART_DIR, shot.file))
        .resize(sw, sh, { fit: 'cover' })
        .extract({ left: Math.floor((sw - width) / 2), top: Math.floor((sh - height) / 2), width, height })
        .png()
        .toBuffer();

      const ringR = 12 + sub * 24;
      const ringA = (0.85 - sub * 0.28).toFixed(2);
      const progW = Math.round(((s * 3 + sub + 1) / (shots.length * 3)) * 180);
      const waveW = Math.round(60 + ((sub + 1) / 3) * 160);

      const hudSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${width}" height="74" fill="#05030A" fill-opacity="0.65"/>
        <rect x="0" y="196" width="${width}" height="96" fill="#05030A" fill-opacity="0.78"/>
        <rect x="10" y="8" width="${width - 20}" height="${height - 16}" fill="none" stroke="#C9B6E4" stroke-opacity="0.35" stroke-width="1"/>
        <text x="260" y="28" fill="#E3C37D" font-family="Georgia, serif" font-size="13" font-weight="bold" letter-spacing="4" text-anchor="middle">${shot.cap}</text>
        <line x1="160" y1="38" x2="246" y2="38" stroke="#E3C37D" stroke-width="1.2"/>
        <line x1="274" y1="38" x2="360" y2="38" stroke="#E3C37D" stroke-width="1.2"/>
        <ellipse cx="260" cy="38" rx="${ringR * 1.5}" ry="${ringR * 0.6}" fill="none" stroke="#F6E3B4" stroke-opacity="${ringA}" stroke-width="1.6"/>
        <polygon points="255,34 265,34 268,44 252,44" fill="#2A1B14" stroke="#F6E3B4" stroke-width="1.2"/>
        <rect x="170" y="50" width="180" height="3" fill="#3A284E"/>
        <rect x="170" y="50" width="${progW}" height="3" fill="#F6E3B4"/>
        <rect x="28" y="210" width="464" height="66" rx="12" fill="#0B0614" fill-opacity="0.82" stroke="#E3C37D" stroke-opacity="0.62" stroke-width="1.5"/>
        <text x="260" y="242" fill="#F8F2E8" font-family="Georgia, serif" font-size="13" text-anchor="middle">${shot.line}</text>
        <rect x="150" y="264" width="220" height="2.5" fill="#3A284E"/>
        <rect x="150" y="264" width="${waveW}" height="2.5" fill="#F6E3B4"/>
        <text x="480" y="26" fill="#FFE3A8" font-family="monospace" font-size="9" text-anchor="end">SAHNE 4/15 · 120s PROLOG</text>
      </svg>`;

      const raw = await sharp(plateBuf)
        .composite([{ input: Buffer.from(hudSvg), left: 0, top: 0 }])
        .ensureAlpha()
        .raw()
        .toBuffer();
      frames.push(raw);
    }
  }
  await encodeAnimatedGif(frames, width, height, 130, outGifPath);
}

/**
 * 13: Build First AAB Tutorial VN (Mahmut & Fadyme 4 Emotions + Event CGs roadside_rest & shelter_evening) GIF
 */
async function buildAabTutorialVnGif(outGifPath) {
  const width = 520;
  const height = 292;
  const bgAsh = await sharp(path.join(BASE_ART_DIR, 'bg_forest_whispering_ash.webp')).resize(width, height, { fit: 'cover' }).png().toBuffer();
  const cgRest = await sharp(path.join(BASE_ART_DIR, 'still_roadside_rest.webp')).resize(width, height, { fit: 'cover' }).png().toBuffer();
  const cgShelter = await sharp(path.join(BASE_ART_DIR, 'still_shelter_evening.webp')).resize(width, height, { fit: 'cover' }).png().toBuffer();

  const beats = [
    {
      mode: 'busts',
      stageLabel: 'SAHNE 5/15 · T-1 BEFORE (VN)',
      mFile: 'portrait_mahmut_watchful.webp',
      fFile: 'portrait_fadyme_composed.webp',
      speaker: 'FADYME',
      cue: 'HAND IN HAND ACROSS THE SLIPPERY CROSSING',
      line: '"Keep your lantern low, Mahmut. The ash carries the bell-sound farther than the mist."'
    },
    {
      mode: 'busts',
      stageLabel: 'SAHNE 7/15 · T-1 AFTER (VN)',
      mFile: 'portrait_mahmut_dry_humor.webp',
      fFile: 'portrait_fadyme_warm.webp',
      speaker: 'MAHMUT',
      cue: 'HE BRUSHES A TORN ASH LEAF FROM HER SHOULDER',
      line: '"If that was a quiet road, I would hate to see what you call a crowded crossing."'
    },
    {
      mode: 'busts',
      stageLabel: 'SAHNE 8/15 · T-2 BEFORE (VN)',
      mFile: 'portrait_mahmut_protective_resolve.webp',
      fFile: 'portrait_fadyme_resolve.webp',
      speaker: 'MAHMUT',
      cue: 'COMBAT STANCE AT THE FORGOTTEN STONE CROSSING',
      line: '"Stay half a pace behind my shield. Hollow Pilgrims never walk alone."'
    },
    {
      mode: 'cg_rest',
      stageLabel: 'SAHNE 10/15 · T-2 AFTER CG (ROADSIDE REST)',
      speaker: 'FADYME',
      cue: 'EVENT CG · FADYME TIGHTENS THE STRAP ON HIS GAUNTLET',
      line: '"Hold still. If the buckle slips again, you will blame the iron instead of your arm."'
    },
    {
      mode: 'cg_shelter',
      stageLabel: 'SAHNE 13/15 · T-3 FINALE CG (SHELTER EVENING)',
      speaker: 'FADYME &amp; MAHMUT',
      cue: 'EVENT CG · BY THE SHELTER COURTYARD HEARTH',
      line: '"Tomorrow the road opens in earnest. Tonight, let the fire keep the watch."'
    }
  ];

  const frames = [];
  for (let b = 0; b < beats.length; b++) {
    const bt = beats[b];
    for (let sub = 0; sub < 3; sub++) {
      const dy = sub === 1 ? -4 : 0;
      const composites = [];
      let baseBuf = bgAsh;

      if (bt.mode === 'busts') {
        const mBuf = await sharp(path.join(BASE_ART_DIR, bt.mFile))
          .resize(195, 255, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        const fBuf = await sharp(path.join(BASE_ART_DIR, bt.fFile))
          .flop()
          .resize(195, 255, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        composites.push(
          { input: mBuf, left: 26 + (bt.speaker === 'MAHMUT' ? 6 : 0), top: 24 + (bt.speaker === 'MAHMUT' ? dy : 0) },
          { input: fBuf, left: 298 - (bt.speaker === 'FADYME' ? 6 : 0), top: 24 + (bt.speaker === 'FADYME' ? dy : 0) }
        );
      } else if (bt.mode === 'cg_rest') {
        baseBuf = cgRest;
      } else {
        baseBuf = cgShelter;
      }

      const bellAng = (Math.sin((b * 3 + sub) * 0.8) * 7).toFixed(1);
      const vnSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="10" width="290" height="22" rx="5" fill="#120A18" fill-opacity="0.88" stroke="#E3C37D" stroke-width="1"/>
        <text x="157" y="25" fill="#FFE3A8" font-family="monospace" font-size="10" font-weight="bold" text-anchor="middle">${bt.stageLabel}</text>
        <rect x="16" y="196" width="488" height="84" rx="10" fill="#0B0614" fill-opacity="0.90" stroke="#E3C37D" stroke-width="1.6"/>
        <rect x="32" y="182" width="138" height="24" rx="6" fill="#32183E" stroke="#F6E3B4" stroke-width="1.5"/>
        <text x="101" y="198" fill="#F6E3B4" font-family="Georgia, serif" font-size="11" font-weight="bold" text-anchor="middle">${bt.speaker}</text>
        <g transform="translate(260, 190) rotate(${bellAng})">
          <polygon points="-5,1 5,1 8,11 -8,11" fill="#2A1B14" stroke="#F6E3B4" stroke-width="1.2"/>
        </g>
        <text x="260" y="214" fill="#E3C37D" font-family="monospace" font-size="9" font-weight="bold" text-anchor="middle">${bt.cue}</text>
        <text x="32" y="236" fill="#F8F2E8" font-family="Georgia, serif" font-size="12">${bt.line.slice(0, 62)}</text>
        <text x="32" y="254" fill="#F8F2E8" font-family="Georgia, serif" font-size="12">${bt.line.slice(62)}</text>
        <text x="488" y="270" fill="#F6E3B4" font-family="monospace" font-size="11" text-anchor="end">▼</text>
      </svg>`;

      composites.push({ input: Buffer.from(vnSvg), left: 0, top: 0 });
      const raw = await sharp(baseBuf).composite(composites).ensureAlpha().raw().toBuffer();
      frames.push(raw);
    }
  }
  await encodeAnimatedGif(frames, width, height, 140, outGifPath);
}

/**
 * 14: Build First AAB Tutorial Battles (T-1 Whispering Ash, T-2 Stone Crossing, T-3 Shelter Courtyard) GIF
 */
async function buildAabTutorialBattlesGif(outGifPath) {
  const width = 520;
  const height = 292;

  const extractFrame = async (atlasFile, rect, targetH, flip = false) => {
    let p = sharp(path.join(BASE_ART_DIR, atlasFile)).extract({ left: rect[0], top: rect[1], width: rect[2], height: rect[3] });
    if (flip) p = p.flop();
    return p.resize(targetH, targetH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  };

  const mahmutIdle = await extractFrame('atlas_mahmut.webp', [4, 4, 305, 408], 116);
  const mahmutBasic = await extractFrame('atlas_mahmut.webp', [717, 4, 467, 382], 122);
  const mahmutUlt = await extractFrame('atlas_mahmut.webp', [313, 4, 400, 398], 126);

  const fadymeIdle = await extractFrame('atlas_fadyme.webp', [376, 4, 277, 408], 112);
  const fadymeBasic = await extractFrame('atlas_fadyme.webp', [657, 4, 462, 399], 118);
  const fadymeUlt = await extractFrame('atlas_fadyme.webp', [4, 4, 368, 409], 124);

  const deadIdle = await extractFrame('atlas_bellbound_dead.webp', [4, 4, 292, 408], 112);
  const deadHit = await extractFrame('atlas_bellbound_dead.webp', [737, 4, 442, 387], 112);
  const deadDefeat = await extractFrame('atlas_bellbound_dead.webp', [1183, 4, 394, 344], 104);

  const pilgrimIdle = await extractFrame('atlas_hollow_pilgrim.webp', [529, 4, 467, 408], 118);
  const pilgrimHit = await extractFrame('atlas_hollow_pilgrim.webp', [4, 4, 521, 429], 118);

  const bgs = [
    { file: 'bg_forest_whispering_ash.webp', title: 'SAHNE 6/15 · BATTLE T-1 (WHISPERING ASH)' },
    { file: 'bg_forgotten_stone_crossing.webp', title: 'SAHNE 9/15 · BATTLE T-2 (STONE CROSSING)' },
    { file: 'bg_shelter_courtyard_dusk.webp', title: 'SAHNE 12/15 · BATTLE T-3 (SHELTER COURTYARD)' }
  ];
  const bgBufs = await Promise.all(
    bgs.map((b) => sharp(path.join(BASE_ART_DIR, b.file)).resize(width, height, { fit: 'cover' }).png().toBuffer())
  );

  const states = [
    { name: 'IDLE &amp; WALK (Aura + Stride)', m: mahmutIdle, f: fadymeIdle, d: deadIdle, p: pilgrimIdle, mx: 95, fx: 44, dx: 310, enemyHp: 1.0, ghostHp: 1.0, focus: 0.45, ult: false },
    { name: 'BASIC STRIKE (Dash + Slash)', m: mahmutBasic, f: fadymeIdle, d: deadHit, p: pilgrimIdle, mx: 215, fx: 44, dx: 324, enemyHp: 0.68, ghostHp: 0.96, focus: 0.72, ult: false },
    { name: 'ACTIVE SKILL (Bell Sigil Cast)', m: mahmutIdle, f: fadymeBasic, d: deadHit, p: pilgrimHit, mx: 95, fx: 165, dx: 320, enemyHp: 0.42, ghostHp: 0.68, focus: 1.0, ult: false },
    { name: 'ULTIMATE (100% Focus Eclipse Burst)', m: mahmutUlt, f: fadymeUlt, d: deadDefeat, p: pilgrimHit, mx: 135, fx: 85, dx: 332, enemyHp: 0.08, ghostHp: 0.42, focus: 1.0, ult: true },
    { name: 'VICTORY (Celebration Bounce)', m: mahmutUlt, f: fadymeUlt, d: deadDefeat, p: deadDefeat, mx: 95, fx: 44, dx: 336, enemyHp: 0.0, ghostHp: 0.08, focus: 0.3, ult: false }
  ];

  const frames = [];
  for (let bIdx = 0; bIdx < 3; bIdx++) {
    for (let sIdx = 0; sIdx < states.length; sIdx++) {
      const st = states[sIdx];
      const bobY = sIdx === 0 || sIdx === 4 ? -6 : 0;
      const hudSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${width}" height="38" fill="#080510" fill-opacity="0.72"/>
        <rect x="0" y="232" width="${width}" height="60" fill="#080510" fill-opacity="0.82"/>
        <text x="16" y="24" fill="#F6E3B4" font-family="monospace" font-size="10" font-weight="bold">${bgs[bIdx].title}</text>
        <text x="504" y="24" fill="#FFE3A8" font-family="Georgia, serif" font-size="11" font-weight="bold" text-anchor="end">${st.name}</text>
        <ellipse cx="${st.mx + 58}" cy="212" rx="44" ry="11" fill="none" stroke="#7EA8FF" stroke-opacity="0.65" stroke-width="2"/>
        <ellipse cx="${st.fx + 56}" cy="226" rx="42" ry="10" fill="none" stroke="#C9B6E4" stroke-opacity="0.65" stroke-width="2"/>
        <ellipse cx="${st.dx + 56}" cy="212" rx="44" ry="11" fill="none" stroke="#E56B86" stroke-opacity="0.65" stroke-width="2"/>
        ${
          st.ult
            ? `<circle cx="260" cy="140" r="88" fill="none" stroke="#F6E3B4" stroke-opacity="0.85" stroke-width="3" stroke-dasharray="14 6"/>
               <circle cx="260" cy="140" r="62" fill="#E3C37D" fill-opacity="0.22"/>`
            : ''
        }
        <rect x="36" y="242" width="160" height="36" rx="8" fill="#0C0714" stroke="#7EA8FF" stroke-width="1.4"/>
        <text x="46" y="255" fill="#CFE0FF" font-family="monospace" font-size="9" font-weight="bold">MAHMUT &amp; FADYME</text>
        <rect x="46" y="260" width="140" height="6" rx="3" fill="#1A1024"/>
        <rect x="46" y="260" width="132" height="6" rx="3" fill="#5EE39B"/>
        <rect x="46" y="269" width="140" height="5" rx="2.5" fill="#1A1024"/>
        <rect x="46" y="269" width="${Math.round(140 * st.focus)}" height="5" rx="2.5" fill="${st.focus >= 0.99 ? '#FFE9A8' : '#B993F8'}"/>
        <rect x="320" y="242" width="164" height="36" rx="8" fill="#0C0714" stroke="#E56B86" stroke-width="1.4"/>
        <text x="330" y="255" fill="#FFB3C4" font-family="monospace" font-size="9" font-weight="bold">BELLBOUND &amp; PILGRIM</text>
        <rect x="330" y="262" width="144" height="8" rx="4" fill="#1A1024"/>
        <rect x="330" y="262" width="${Math.round(144 * st.ghostHp)}" height="8" rx="4" fill="#FFB3C4" fill-opacity="0.75"/>
        <rect x="330" y="262" width="${Math.round(144 * st.enemyHp)}" height="8" rx="4" fill="#E04F5F"/>
      </svg>`;

      const raw = await sharp(bgBufs[bIdx])
        .composite([
          { input: st.f, left: st.fx, top: 114 + bobY },
          { input: st.m, left: st.mx, top: 98 + bobY },
          { input: st.p, left: 386, top: 108 },
          { input: st.d, left: st.dx, top: 102 },
          { input: Buffer.from(hudSvg), left: 0, top: 0 }
        ])
        .ensureAlpha()
        .raw()
        .toBuffer();
      frames.push(raw);
    }
  }
  await encodeAnimatedGif(frames, width, height, 145, outGifPath);
}

/**
 * 15: Build First AAB Patch Wait (Cracked Watch & Bell Spinner) -> Company Hub (9 Tiles) GIF
 */
async function buildAabPatchAndHubGif(outGifPath) {
  const width = 520;
  const height = 292;
  const bgAsh = await sharp(path.join(BASE_ART_DIR, 'bg_forest_whispering_ash.webp'))
    .resize(width, height, { fit: 'cover' })
    .modulate({ brightness: 0.45 })
    .png()
    .toBuffer();

  const frames = [];
  const totalFrames = 16;
  for (let f = 0; f < totalFrames; f++) {
    const isPatchWait = f < 8;
    const rot = f * 24;
    const bellAng = (Math.sin(f * 0.95) * 9).toFixed(1);

    if (isPatchWait) {
      const pct = Math.min(100, Math.round(45 + (f / 7) * 55));
      const barW = Math.round((pct / 100) * 340);
      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(260, 56)">
          <circle cx="0" cy="0" r="28" fill="#0C0714" stroke="#F6E3B4" stroke-width="2.5"/>
          <line x1="-10" y1="-16" x2="8" y2="12" stroke="#FFA447" stroke-width="1.4"/>
          <g transform="rotate(${rot})"><line x1="0" y1="4" x2="0" y2="-20" stroke="#FFF0C4" stroke-width="2"/></g>
          <g transform="rotate(${rot * 0.25})"><line x1="0" y1="3" x2="0" y2="-13" stroke="#E3C37D" stroke-width="2.5"/></g>
          <g transform="translate(0, 29) rotate(${bellAng})">
            <polygon points="-5,2 5,2 8,12 -8,12" fill="#2A1B14" stroke="#F6E3B4" stroke-width="1.3"/>
          </g>
        </g>
        <rect x="44" y="102" width="432" height="128" rx="14" fill="#180D24" fill-opacity="0.90" stroke="#F6E3B4" stroke-width="2"/>
        <text x="260" y="128" fill="#F6E3B4" font-family="Georgia, serif" font-size="15" font-weight="bold" text-anchor="middle">${pct === 100 ? 'THE ROAD IS READY' : 'WHILE THE ROAD OPENS…'}</text>
        <rect x="90" y="144" width="340" height="14" rx="7" fill="#08040C" stroke="#C9B6E4" stroke-width="1"/>
        <rect x="92" y="146" width="${Math.max(8, barW - 4)}" height="10" rx="5" fill="#F6E3B4"/>
        <text x="260" y="176" fill="#D5C8E8" font-family="monospace" font-size="10" text-anchor="middle">${pct} % · ${pct === 100 ? 'READY TO ENTER' : 'VERIFYING SIGNED RELEASE PACK'}</text>
        <rect x="160" y="188" width="200" height="30" rx="15" fill="#3A1C46" stroke="#F6E3B4" stroke-width="1.6"/>
        <text x="260" y="207" fill="#F8F2E8" font-family="Georgia, serif" font-size="11" font-weight="bold" text-anchor="middle">${pct === 100 ? 'RESTART &amp; ENTER HUB' : 'PAUSE DOWNLOAD'}</text>
        <text x="260" y="256" fill="#EFE8F5" font-family="Georgia, serif" font-style="italic" font-size="12" text-anchor="middle">"A cracked watch still keeps the hour it broke."</text>
        <text x="260" y="278" fill="#FFE3A8" font-family="monospace" font-size="9" font-weight="bold" text-anchor="middle">SAHNE 14/15 · PATCH WAIT (CRACKED WATCH &amp; BELL SPINNER)</text>
      </svg>`;
      const raw = await sharp(bgAsh).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).ensureAlpha().raw().toBuffer();
      frames.push(raw);
    } else {
      const hf = f - 8;
      const tiles = ['SUMMON', 'ROSTER', 'TEAM', 'ERRANDS', 'ARMORY', 'MAIL', 'SHOP', 'ACCOUNT', 'ACTIONS'];
      let tileSvg = '';
      tiles.forEach((t, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const tx = 46 + col * 148;
        const ty = 64 + row * 56;
        const isHot = i === 0 || i === hf % 9;
        tileSvg += `<rect x="${tx}" y="${ty}" width="132" height="46" rx="12" fill="${isHot ? '#3A1C46' : '#1E1228'}" stroke="${isHot ? '#F6E3B4' : '#B9A6D4'}" stroke-width="${isHot ? 2 : 1.2}"/>
        <text x="${tx + 66}" y="${ty + 28}" fill="#F8F2E8" font-family="Georgia, serif" font-size="12" font-weight="bold" text-anchor="middle">${t}</text>`;
      });

      const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(260, 28) rotate(${rot})">
          <circle cx="0" cy="0" r="24" fill="none" stroke="#E3C37D" stroke-opacity="0.55" stroke-width="1.5" stroke-dasharray="6 4"/>
        </g>
        <text x="260" y="34" fill="#F6E3B4" font-family="Georgia, serif" font-size="18" font-weight="bold" letter-spacing="3" text-anchor="middle">THE COMPANY</text>
        ${tileSvg}
        <text x="260" y="278" fill="#FFE3A8" font-family="monospace" font-size="9" font-weight="bold" text-anchor="middle">SAHNE 15/15 · COMPANY HUB (9 ANIMATED GOTHIC TILES)</text>
      </svg>`;
      const raw = await sharp(bgAsh).composite([{ input: Buffer.from(svg), left: 0, top: 0 }]).ensureAlpha().raw().toBuffer();
      frames.push(raw);
    }
  }
  await encodeAnimatedGif(frames, width, height, 125, outGifPath);
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const forceAll = process.argv.includes('--all');
  await fs.mkdir(ADMIN_ANIM_DIR, { recursive: true });
  await fs.mkdir(WORKBENCH_GIF_DIR, { recursive: true });

  if (forceAll || !(await exists(path.join(ADMIN_ANIM_DIR, '09_kera_voss_vn_expressions_live.gif')))) {
    console.log('1/8 Building Step 1 UI Animation GIFs (01..04)...');
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

    console.log('2/8 Building UI Kit 4-State Button GIF (05)...');
    await buildButton4StateGif(path.join(ADMIN_ANIM_DIR, '05_ui_kit_button_4state_cycle.gif'));

    console.log('3/8 Building UI Kit HP & Focus Bars Live GIF (06)...');
    await buildBarsAnimatedGif(path.join(ADMIN_ANIM_DIR, '06_ui_kit_hp_focus_bars_live.gif'));

    console.log('4/8 Building Kera Voss 8-State Chibi Showcase & Battle Combo GIFs (07 & 08)...');
    await buildKeraChibiGifs(
      path.join(ADMIN_ANIM_DIR, '07_kera_voss_chibi_all_8_states.gif'),
      path.join(ADMIN_ANIM_DIR, '08_kera_voss_chibi_combat_combo.gif')
    );

    console.log('5/8 Building Kera Voss VN 4-Expression Live Stage GIF (09)...');
    await buildKeraVnGif(path.join(ADMIN_ANIM_DIR, '09_kera_voss_vn_expressions_live.gif'));
  }

  console.log('6/8 Building First AAB (Base AAB) 15-Scene End-to-End Flow GIFs (10..15)...');
  if (forceAll || !(await exists(path.join(ADMIN_ANIM_DIR, '10_aab_splash_studio_intro.gif')))) {
    await buildAabSplashStudioGif(path.join(ADMIN_ANIM_DIR, '10_aab_splash_studio_intro.gif'));
  }
  if (forceAll || !(await exists(path.join(ADMIN_ANIM_DIR, '11_aab_title_screen_full.gif')))) {
    await buildAabTitleScreenGif(path.join(ADMIN_ANIM_DIR, '11_aab_title_screen_full.gif'));
  }
  if (forceAll || !(await exists(path.join(ADMIN_ANIM_DIR, '12_aab_prologue_9scenes_flow.gif')))) {
    await buildAabPrologueFlowGif(path.join(ADMIN_ANIM_DIR, '12_aab_prologue_9scenes_flow.gif'));
  }
  await buildAabTutorialVnGif(path.join(ADMIN_ANIM_DIR, '13_aab_tutorial_vn_mahmut_fadyme.gif'));
  await buildAabTutorialBattlesGif(path.join(ADMIN_ANIM_DIR, '14_aab_tutorial_battles_t1_t2_t3.gif'));
  await buildAabPatchAndHubGif(path.join(ADMIN_ANIM_DIR, '15_aab_patch_wait_and_hub.gif'));

  console.log('7/8 Copying GIFs to workbench & brain artifact directory...');
  const gifFiles = (await fs.readdir(ADMIN_ANIM_DIR)).filter((f) => f.endsWith('.gif'));
  for (const gf of gifFiles) {
    await fs.copyFile(path.join(ADMIN_ANIM_DIR, gf), path.join(WORKBENCH_GIF_DIR, gf));
    await fs.copyFile(path.join(ADMIN_ANIM_DIR, gf), path.join(BRAIN_DIR, gf));
  }

  console.log('8/8 Copying supporting RGBA & stage assets to apps/admin/public/dev/animations/assets...');
  await copySupportingAssetsForLiveStage();

  console.log('=== ALL 15 ANIMATED GIFS & ADMIN LIVE STAGE ASSETS GENERATED SUCCESSFULLY ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
