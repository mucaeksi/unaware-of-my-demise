/* global console */
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const STORE_ASSETS = path.join(ROOT, 'docs/store/assets');
const STORE_SCREENSHOTS = path.join(STORE_ASSETS, 'screenshots');
const BRAND_DIR = path.join(
  ROOT,
  'narrative/15_Art_Workbench/ui_screens/production_v001/brand',
);
const ANDROID_RES = path.join(ROOT, 'apps/unity/Assets/Plugins/Android/res');
const ARTIFACT_DIR =
  'C:/Users/PC/.gemini/antigravity/brain/1d18a194-8e93-4af4-8c55-93327064d12d';

const ART_MANIFEST_PATH = path.join(
  ROOT,
  'content/patches/rel_0003_part1_campaign/art/art_manifest.json',
);
const artManifest = JSON.parse(fs.readFileSync(ART_MANIFEST_PATH, 'utf8'));

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Finds the non-transparent bounding box [minX, minY, width, height] of a canonical portrait
 * so that Fadyme (minY=280), Mahmut (minY=242), and all 25 companions (minY=53) align at the exact same head height.
 */
async function getAlphaBounds(imgPath) {
  const { data, info } = await sharp(imgPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let maxX = 0;
  let minY = info.height;
  let maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX > maxX || minY > maxY) {
    return { left: 0, top: 0, width: info.width, height: info.height };
  }
  const padX = Math.min(minX, info.width - 1 - maxX, 16);
  const top = Math.max(0, minY - 12);
  return {
    left: minX - padX,
    top,
    width: maxX - minX + 1 + padX * 2,
    height: info.height - top,
  };
}

/**
 * Extracts and resizes a canonical portrait from its visible head/hood top down,
 * guaranteeing uniform head placement across all characters.
 */
async function extractCanonicalPortrait(imgPath, targetW, targetH, fit = 'cover') {
  const bounds = await getAlphaBounds(imgPath);
  return sharp(imgPath)
    .extract(bounds)
    .resize(targetW, targetH, {
      fit,
      position: 'top',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

/**
 * Extract an exact named frame [x, y, w, h] from a packed atlas using art_manifest.json
 */
async function extractAtlasFrame(
  atlasKey,
  frameName,
  targetMaxWidth,
  targetMaxHeight,
  flipX = false,
) {
  const atlas = artManifest.atlases[atlasKey];
  if (!atlas) {
    throw new Error(`Atlas not found in art_manifest.json: ${atlasKey}`);
  }
  const rect = atlas.frames[frameName] ?? atlas.frames.idle ?? Object.values(atlas.frames)[0];
  if (!rect) {
    throw new Error(`Frame ${frameName} not found in ${atlasKey}`);
  }
  const [left, top, width, height] = rect;
  const imgPath = path.join(ROOT, 'content/approved_art', atlas.image);

  let pipeline = sharp(imgPath).extract({ left, top, width, height });
  if (flipX) {
    pipeline = pipeline.flop();
  }
  return pipeline
    .resize(targetMaxWidth, targetMaxHeight, {
      fit: 'inside',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

function buildEditorialRibbonSvg(opts) {
  const { badge, headline, subtitle, position = 'top' } = opts;
  const isTop = position === 'top';
  const yBox = isTop ? 14 : 926;
  const pillW = Math.max(420, Math.round(badge.length * 12.4 + 68));

  const svg = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ribbonBg" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#07040C" stop-opacity="0.96"/>
        <stop offset="18%" stop-color="#140B22" stop-opacity="0.94"/>
        <stop offset="50%" stop-color="#1E1032" stop-opacity="0.94"/>
        <stop offset="82%" stop-color="#140B22" stop-opacity="0.94"/>
        <stop offset="100%" stop-color="#07040C" stop-opacity="0.96"/>
      </linearGradient>
      <linearGradient id="goldLine" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#5E4618" stop-opacity="0.25"/>
        <stop offset="15%" stop-color="#D4AF37" stop-opacity="0.95"/>
        <stop offset="50%" stop-color="#FFF0B8" stop-opacity="1.0"/>
        <stop offset="85%" stop-color="#D4AF37" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#5E4618" stop-opacity="0.25"/>
      </linearGradient>
      <linearGradient id="badgeFill" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3A1A4D" stop-opacity="0.96"/>
        <stop offset="100%" stop-color="#1C0C29" stop-opacity="0.96"/>
      </linearGradient>
      <linearGradient id="titleGold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFF8E7"/>
        <stop offset="55%" stop-color="#EAD298"/>
        <stop offset="100%" stop-color="#C49B45"/>
      </linearGradient>
      <filter id="dropShadow" x="-10%" y="-20%" width="120%" height="150%">
        <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.85"/>
      </filter>
    </defs>

    <rect x="0" y="${isTop ? 0 : 885}" width="1920" height="${isTop ? 172 : 195}" fill="#050309" fill-opacity="0.62"/>

    <g filter="url(#dropShadow)">
      <rect x="64" y="${yBox}" width="1792" height="136" rx="10" fill="url(#ribbonBg)" stroke="url(#goldLine)" stroke-width="2.2"/>
      <rect x="72" y="${yBox + 6}" width="1776" height="124" rx="7" fill="none" stroke="#8F6F2B" stroke-width="1" stroke-opacity="0.55"/>
    </g>

    <g transform="translate(128, ${yBox + 68})">
      <circle cx="0" cy="0" r="34" fill="#0B0613" stroke="#D4AF37" stroke-width="1.8"/>
      <circle cx="0" cy="0" r="24" fill="#160B24" stroke="#B6536E" stroke-width="1.5" stroke-opacity="0.85"/>
      <path d="M-11,10 L11,10 L8,-4 C8,-11 4,-15 0,-15 C-4,-15 -8,-11 -8,-4 Z" fill="#E5C675"/>
      <circle cx="0" cy="14" r="3" fill="#FFF2C2"/>
      <path d="M0,-20 L0,-15" stroke="#FFF2C2" stroke-width="2"/>
    </g>

    <g transform="translate(1792, ${yBox + 68})">
      <circle cx="0" cy="0" r="34" fill="#0B0613" stroke="#D4AF37" stroke-width="1.8"/>
      <circle cx="0" cy="0" r="22" fill="#06030A" stroke="#E5A93B" stroke-width="2.2"/>
      <circle cx="0" cy="0" r="27" fill="none" stroke="#C94A6A" stroke-width="1.2" stroke-opacity="0.8"/>
      <polygon points="0,-32 3,-24 0,-26 -3,-24" fill="#F3D689"/>
      <polygon points="0,32 3,24 0,26 -3,24" fill="#F3D689"/>
      <polygon points="-32,0 -24,3 -26,0 -24,-3" fill="#F3D689"/>
      <polygon points="32,0 24,3 26,0 24,-3" fill="#F3D689"/>
    </g>

    <rect x="190" y="${yBox + 18}" width="${pillW}" height="28" rx="14" fill="url(#badgeFill)" stroke="#D4AF37" stroke-width="1.2"/>
    <circle cx="208" cy="${yBox + 32}" r="4" fill="#F2C96B"/>
    <text x="224" y="${yBox + 37}" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="13.5" font-weight="700" letter-spacing="2.2" fill="#F4DC9B">${escapeXml(badge)}</text>

    <text x="190" y="${yBox + 82}" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="34" font-weight="700" letter-spacing="2.2" fill="url(#titleGold)" filter="url(#dropShadow)">${escapeXml(headline)}</text>

    <text x="190" y="${yBox + 114}" font-family="Georgia, 'Times New Roman', serif" font-size="19.5" font-style="italic" fill="#DDD0E8">${escapeXml(subtitle)}</text>

    <path d="M 18 52 L 18 18 L 52 18" fill="none" stroke="#D4AF37" stroke-width="2" stroke-opacity="0.7"/>
    <path d="M 1902 52 L 1902 18 L 1868 18" fill="none" stroke="#D4AF37" stroke-width="2" stroke-opacity="0.7"/>
    <path d="M 18 1028 L 18 1062 L 52 1062" fill="none" stroke="#D4AF37" stroke-width="2" stroke-opacity="0.7"/>
    <path d="M 1902 1028 L 1902 1062 L 1868 1062" fill="none" stroke="#D4AF37" stroke-width="2" stroke-opacity="0.7"/>
  </svg>`;

  return Buffer.from(svg);
}

/**
 * Step 0: Sync narrative/15_Art_Workbench/characters/fadyme/production_v002/vn/ with canonical AAB portraits
 * so that no script or workbench view ever reads the rejected cross-hatched side-profile Fadyme again.
 */
async function syncWorkbenchFadymePortraits() {
  console.log('Syncing narrative/15_Art_Workbench/characters/fadyme/production_v002/vn/ with canonical Fadyme...');
  const vnDir = path.join(ROOT, 'narrative/15_Art_Workbench/characters/fadyme/production_v002/vn');
  const pairs = [
    { src: 'content/base/art/portrait_fadyme_resolve.webp', dest: path.join(vnDir, 'vn_resolve_v002.png') },
    { src: 'content/base/art/portrait_fadyme_composed.webp', dest: path.join(vnDir, 'sources/vn_composed_v001.png') },
    { src: 'content/base/art/portrait_fadyme_warm.webp', dest: path.join(vnDir, 'sources/vn_warm_v001.png') },
    { src: 'content/base/art/portrait_fadyme_wry.webp', dest: path.join(vnDir, 'sources/vn_wry_v001.png') },
  ];
  for (const p of pairs) {
    ensureDir(path.dirname(p.dest));
    await sharp(path.join(ROOT, p.src)).png({ compressionLevel: 9 }).toFile(p.dest);
  }
  console.log('✓ Synced 4 canonical Fadyme VN portraits into 15_Art_Workbench');
}

/**
 * Step 1: Master Logo (1600x760 RGBA) & Compact Logo (960x360 RGBA)
 */
async function buildMasterAndCompactLogos() {
  console.log('Building Master Logo (1600x760 RGBA) & Compact Logo (960x360 RGBA)...');
  const rawLogoPath = path.join(ROOT, 'content/base/art/ui_logo.webp');

  const resizedLogo = await sharp(rawLogoPath)
    .resize(1380, 638, { fit: 'inside' })
    .png()
    .toBuffer();

  const glowAndCrestSvg = Buffer.from(`<svg width="1600" height="760" viewBox="0 0 1600 760" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="eclipseGlow" cx="50%" cy="42%" r="36%">
        <stop offset="0%" stop-color="#D94B72" stop-opacity="0.42"/>
        <stop offset="45%" stop-color="#8A2C52" stop-opacity="0.22"/>
        <stop offset="78%" stop-color="#D4AF37" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="subPill" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0E0717" stop-opacity="0"/>
        <stop offset="20%" stop-color="#190D2B" stop-opacity="0.88"/>
        <stop offset="50%" stop-color="#271440" stop-opacity="0.94"/>
        <stop offset="80%" stop-color="#190D2B" stop-opacity="0.88"/>
        <stop offset="100%" stop-color="#0E0717" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <ellipse cx="800" cy="310" rx="520" ry="270" fill="url(#eclipseGlow)"/>
    <rect x="370" y="678" width="860" height="48" rx="24" fill="url(#subPill)"/>
    <line x1="430" y1="678" x2="1170" y2="678" stroke="#D4AF37" stroke-width="1.5" stroke-opacity="0.75"/>
    <line x1="430" y1="726" x2="1170" y2="726" stroke="#D4AF37" stroke-width="1.5" stroke-opacity="0.75"/>
    <polygon points="800,671 806,678 800,685 794,678" fill="#F2D17B"/>
    <text x="800" y="709" text-anchor="middle" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="22" font-weight="700" letter-spacing="6.5" fill="#F5DF9E">GOTHIC ANIME TACTICAL RPG</text>
  </svg>`);

  const masterOut = path.join(STORE_ASSETS, 'logo_master.png');
  await sharp({
    create: {
      width: 1600,
      height: 760,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: glowAndCrestSvg, top: 0, left: 0 },
      { input: resizedLogo, top: 24, left: 110 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(masterOut);

  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.copyFileSync(masterOut, path.join(ARTIFACT_DIR, 'logo_master.png'));
  }

  const compactLogoBuf = await sharp(rawLogoPath)
    .resize(740, 342, { fit: 'inside' })
    .png()
    .toBuffer();

  const compactGlowSvg = Buffer.from(`<svg width="960" height="360" viewBox="0 0 960 360" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="cGlow" cx="50%" cy="48%" r="40%">
        <stop offset="0%" stop-color="#D94B72" stop-opacity="0.36"/>
        <stop offset="55%" stop-color="#8A2C52" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="480" cy="175" rx="340" ry="155" fill="url(#cGlow)"/>
  </svg>`);

  const compactOut = path.join(STORE_ASSETS, 'logo_compact.png');
  await sharp({
    create: {
      width: 960,
      height: 360,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: compactGlowSvg, top: 0, left: 0 },
      { input: compactLogoBuf, top: 9, left: 110 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(compactOut);

  console.log('✓ Saved logo_master.png & logo_compact.png');
}

/**
 * Step 2: Canonical App Icon (512x512 RGBA), Adaptive Icon Layers, and all 15 Android Launcher Mipmaps
 * Uses ONLY canonical content/base/art/portrait_fadyme_resolve.webp (768x1152, minY=280).
 */
async function buildAppIconAndMipmaps() {
  console.log('Building Canonical App Icon (512x512), Adaptive Icons, and Android Mipmaps...');

  const bgSvg = Buffer.from(`<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="skyGrad" cx="50%" cy="42%" r="72%">
        <stop offset="0%" stop-color="#3B194C"/>
        <stop offset="38%" stop-color="#210E33"/>
        <stop offset="72%" stop-color="#11071C"/>
        <stop offset="100%" stop-color="#07040C"/>
      </radialGradient>
      <radialGradient id="coronaGlow" cx="50%" cy="38%" r="44%">
        <stop offset="0%" stop-color="#FFF2BD" stop-opacity="0.95"/>
        <stop offset="48%" stop-color="#E59A3C" stop-opacity="0.82"/>
        <stop offset="74%" stop-color="#B9385D" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#210E33" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="goldRay" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFF3C4" stop-opacity="0.9"/>
        <stop offset="50%" stop-color="#D4AF37" stop-opacity="0.75"/>
        <stop offset="100%" stop-color="#8C5828" stop-opacity="0.1"/>
      </linearGradient>
    </defs>

    <rect width="512" height="512" fill="url(#skyGrad)"/>

    <circle cx="256" cy="196" r="198" fill="none" stroke="#D4AF37" stroke-width="1.2" stroke-opacity="0.28" stroke-dasharray="6 8"/>
    <circle cx="256" cy="196" r="172" fill="none" stroke="#C86D8A" stroke-width="1.4" stroke-opacity="0.34"/>
    <circle cx="256" cy="196" r="165" fill="url(#coronaGlow)"/>

    <g transform="translate(256, 196)">
      ${Array.from({ length: 12 })
        .map((_, i) => {
          const angle = i * 30;
          const len = i % 2 === 0 ? -188 : -162;
          const w = i % 2 === 0 ? 11 : 7;
          return `<polygon points="0,${len} ${w},-108 0,-118 -${w},-108" fill="url(#goldRay)" transform="rotate(${angle})"/>`;
        })
        .join('\n')}
    </g>

    <circle cx="256" cy="196" r="118" fill="#090510" stroke="#FFE9A6" stroke-width="5.5"/>
    <circle cx="256" cy="196" r="123" fill="none" stroke="#D94B72" stroke-width="3.5" stroke-opacity="0.88"/>

    <circle cx="72" cy="128" r="3.2" fill="#FFE6A3" fill-opacity="0.85"/>
    <circle cx="104" cy="290" r="2.4" fill="#E3D7F4" fill-opacity="0.7"/>
    <circle cx="438" cy="118" r="3.5" fill="#FFE6A3" fill-opacity="0.9"/>
    <circle cx="418" cy="248" r="2.5" fill="#FF94B2" fill-opacity="0.75"/>
    <circle cx="64" cy="396" r="3.8" fill="#FFB85C" fill-opacity="0.85"/>
    <circle cx="448" cy="382" r="3.2" fill="#FFE6A3" fill-opacity="0.8"/>
  </svg>`);

  const adaptiveBgPath = path.join(
    BRAND_DIR,
    'android_adaptive_background_512x512_v001.png',
  );
  await sharp(bgSvg).png({ compressionLevel: 9 }).toFile(adaptiveBgPath);

  // Canonical Fadyme from content/base/art/portrait_fadyme_resolve.webp (768x1152, minY=280)
  // Extract her head, hood, silver hair, and upper cloak clasp (left: 108, top: 268, width: 552, height: 552)
  const canonicalFadymePath = path.join(ROOT, 'content/base/art/portrait_fadyme_resolve.webp');
  const fadymeStoreCrop = await sharp(canonicalFadymePath)
    .extract({ left: 108, top: 268, width: 552, height: 552 })
    .resize(496, 496, { fit: 'cover' })
    .modulate({ brightness: 1.04, saturation: 1.06 })
    .png()
    .toBuffer();

  const fgVfxSvg = Buffer.from(`<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bottomShade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#07040C" stop-opacity="0"/>
        <stop offset="74%" stop-color="#07040C" stop-opacity="0"/>
        <stop offset="100%" stop-color="#07040C" stop-opacity="0.82"/>
      </linearGradient>
    </defs>
    <rect width="512" height="512" fill="url(#bottomShade)"/>
    <circle cx="96" cy="436" r="4.2" fill="#FFD97D" fill-opacity="0.92"/>
    <circle cx="142" cy="468" r="2.6" fill="#FFF4D4" fill-opacity="0.85"/>
    <circle cx="398" cy="442" r="3.6" fill="#FFD97D" fill-opacity="0.9"/>
    <circle cx="436" cy="336" r="2.8" fill="#E8D8FF" fill-opacity="0.8"/>
    <circle cx="84" cy="212" r="2.8" fill="#FFD97D" fill-opacity="0.85"/>
  </svg>`);

  const storeIconBuf = await sharp(bgSvg)
    .composite([
      { input: fadymeStoreCrop, top: 16, left: 8 },
      { input: fgVfxSvg, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  const storeIconPath = path.join(STORE_ASSETS, 'icon_512.png');
  const brandIconPath = path.join(BRAND_DIR, 'app_icon_512x512_v001.png');
  const workbenchJpgIconPath = path.join(
    ROOT,
    'narrative/15_Art_Workbench/ui_screens/brand_app_icon_v001.jpg',
  );
  await fs.promises.writeFile(storeIconPath, storeIconBuf);
  await fs.promises.writeFile(brandIconPath, storeIconBuf);
  await sharp(storeIconBuf).jpeg({ quality: 95 }).toFile(workbenchJpgIconPath);
  if (fs.existsSync(ARTIFACT_DIR)) {
    await fs.promises.writeFile(path.join(ARTIFACT_DIR, 'icon_512.png'), storeIconBuf);
  }

  const fadymeSafeCrop = await sharp(canonicalFadymePath)
    .extract({ left: 108, top: 268, width: 552, height: 552 })
    .resize(376, 376, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const circleFadeMask = Buffer.from(`<svg width="376" height="376" viewBox="0 0 376 376" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="fadeMask" cx="50%" cy="46%" r="50%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="1"/>
        <stop offset="78%" stop-color="#FFFFFF" stop-opacity="1"/>
        <stop offset="96%" stop-color="#FFFFFF" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="188" cy="184" r="182" fill="url(#fadeMask)"/>
  </svg>`);

  const fadymeSafeMasked = await sharp(fadymeSafeCrop)
    .composite([{ input: circleFadeMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const adaptiveFgHaloSvg = Buffer.from(`<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="fgHalo" cx="50%" cy="44%" r="32%">
        <stop offset="0%" stop-color="#FFEAA6" stop-opacity="0.55"/>
        <stop offset="65%" stop-color="#D4AF37" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="256" cy="226" r="142" fill="url(#fgHalo)"/>
    <circle cx="256" cy="226" r="118" fill="#090510" stroke="#FFE699" stroke-width="4"/>
    <circle cx="256" cy="226" r="123" fill="none" stroke="#D94B72" stroke-width="2.2" stroke-opacity="0.85"/>
  </svg>`);

  const adaptiveFgBuf = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: adaptiveFgHaloSvg, top: 0, left: 0 },
      { input: fadymeSafeMasked, top: 68, left: 68 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  const adaptiveFgPath = path.join(
    BRAND_DIR,
    'android_adaptive_foreground_512x512_v001.png',
  );
  await fs.promises.writeFile(adaptiveFgPath, adaptiveFgBuf);

  const mipmaps = [
    { dir: 'mipmap-mdpi', launcher: 48, fg: 108 },
    { dir: 'mipmap-hdpi', launcher: 72, fg: 162 },
    { dir: 'mipmap-xhdpi', launcher: 96, fg: 216 },
    { dir: 'mipmap-xxhdpi', launcher: 144, fg: 324 },
    { dir: 'mipmap-xxxhdpi', launcher: 192, fg: 432 },
  ];

  for (const m of mipmaps) {
    const outDir = path.join(ANDROID_RES, m.dir);
    ensureDir(outDir);

    await sharp(storeIconBuf)
      .resize(m.launcher, m.launcher)
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, 'ic_launcher.png'));

    const r = m.launcher / 2;
    const roundMask = Buffer.from(
      `<svg width="${m.launcher}" height="${m.launcher}" viewBox="0 0 ${m.launcher} ${m.launcher}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${r}" cy="${r}" r="${r}" fill="#FFFFFF"/>
      </svg>`,
    );
    await sharp(storeIconBuf)
      .resize(m.launcher, m.launcher)
      .composite([{ input: roundMask, blend: 'dest-in' }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, 'ic_launcher_round.png'));

    await sharp(adaptiveFgBuf)
      .resize(m.fg, m.fg)
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, 'ic_launcher_foreground.png'));
  }

  console.log('✓ Saved canonical icon_512.png, adaptive icon layers, and all 15 Android mipmaps');
}

/**
 * Step 3: Canonical Dark Gothic Android Splash Screens across all 11 drawable* directories
 * Replaces the white Capacitor X splash screen with our dark gothic ui_title_bg + ui_logo composition.
 */
async function buildAndroidSplashScreens() {
  console.log('Building Dark Gothic Android Splash Screens across all 11 drawable* folders...');
  const titleBgPath = path.join(ROOT, 'content/base/art/ui_title_bg.webp');
  const logoPath = path.join(ROOT, 'content/base/art/ui_logo.webp');

  const splashTargets = [
    { dir: 'drawable', w: 480, h: 320 },
    { dir: 'drawable-land-mdpi', w: 480, h: 320 },
    { dir: 'drawable-land-hdpi', w: 800, h: 480 },
    { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
    { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
    { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
    { dir: 'drawable-port-mdpi', w: 320, h: 480 },
    { dir: 'drawable-port-hdpi', w: 480, h: 800 },
    { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
    { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
    { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
  ];

  for (const t of splashTargets) {
    const outDir = path.join(ANDROID_RES, t.dir);
    ensureDir(outDir);

    const bgBuf = await sharp(titleBgPath)
      .resize(t.w, t.h, { fit: 'cover', position: 'center' })
      .modulate({ brightness: 0.72 })
      .png()
      .toBuffer();

    const logoW = Math.round(Math.min(t.w * 0.62, t.h * 0.75));
    const logoH = Math.round(logoW * 0.46);
    const logoBuf = await sharp(logoPath)
      .resize(logoW, logoH, { fit: 'inside' })
      .png()
      .toBuffer();
    const lMeta = await sharp(logoBuf).metadata();
    const lw = lMeta.width ?? logoW;
    const lh = lMeta.height ?? logoH;

    const vignetteSvg = Buffer.from(`<svg width="${t.w}" height="${t.h}" viewBox="0 0 ${t.w} ${t.h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="spVig" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stop-color="#090512" stop-opacity="0.18"/>
          <stop offset="70%" stop-color="#090512" stop-opacity="0.58"/>
          <stop offset="100%" stop-color="#050309" stop-opacity="0.92"/>
        </radialGradient>
      </defs>
      <rect width="${t.w}" height="${t.h}" fill="url(#spVig)"/>
    </svg>`);

    await sharp(bgBuf)
      .composite([
        { input: vignetteSvg, left: 0, top: 0 },
        {
          input: logoBuf,
          left: Math.round((t.w - lw) / 2),
          top: Math.round((t.h - lh) / 2),
        },
      ])
      .flatten({ background: '#07040C' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, 'splash.png'));
  }

  console.log('✓ Replaced all 11 Android drawable*/splash.png files with canonical dark gothic splash screen');
}

/**
 * Step 4: Canonical Google Play Feature Graphic (1024x500, 24-bit RGB)
 * Uses ONLY canonical portrait_mahmut_protective_resolve.webp + portrait_fadyme_resolve.webp
 */
async function buildFeatureGraphic() {
  console.log('Building Canonical Google Play Feature Graphic (1024x500 24-bit RGB)...');

  const bridgeBgPath = path.join(ROOT, 'content/approved_art/art/bg_bridge_forsaken.webp');
  const bgResized = await sharp(bridgeBgPath)
    .resize(1024, 576, { fit: 'cover' })
    .extract({ left: 0, top: 38, width: 1024, height: 500 })
    .modulate({ brightness: 0.78, saturation: 1.1 })
    .png()
    .toBuffer();

  // Canonical Mahmut (trimmed from minY=242 so his head is near the top of the 500px banner and bottom is flush at y=500)
  const mahmutBuf = await extractCanonicalPortrait(
    path.join(ROOT, 'content/base/art/portrait_mahmut_protective_resolve.webp'),
    348,
    488,
    'inside',
  );
  const mahmutMeta = await sharp(mahmutBuf).metadata();

  // Canonical Fadyme (trimmed from minY=280 so her head and silver hood fill the front-right foreground and bottom is flush at y=500)
  const fadymeBuf = await extractCanonicalPortrait(
    path.join(ROOT, 'content/base/art/portrait_fadyme_resolve.webp'),
    396,
    488,
    'inside',
  );
  const fadymeMeta = await sharp(fadymeBuf).metadata();

  const logoBuf = await sharp(path.join(ROOT, 'content/base/art/ui_logo.webp'))
    .resize(400, 185, { fit: 'inside' })
    .png()
    .toBuffer();

  const featureBgOverlaySvg = Buffer.from(`<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="leftVignette" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#07040C" stop-opacity="0.95"/>
        <stop offset="38%" stop-color="#130920" stop-opacity="0.86"/>
        <stop offset="58%" stop-color="#1A0D2B" stop-opacity="0.45"/>
        <stop offset="82%" stop-color="#0E0718" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#07040C" stop-opacity="0.55"/>
      </linearGradient>
      <radialGradient id="centerEclipseGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFF2BE" stop-opacity="0.95"/>
        <stop offset="40%" stop-color="#E59238" stop-opacity="0.78"/>
        <stop offset="72%" stop-color="#B9385D" stop-opacity="0.46"/>
        <stop offset="100%" stop-color="#180C28" stop-opacity="0"/>
      </radialGradient>
    </defs>

    <rect width="1024" height="500" fill="url(#leftVignette)"/>

    <path d="M435,500 L435,340 L456,298 L472,338 L480,252 L492,178 L504,252 L512,338 L528,298 L549,340 L549,500 Z" fill="#0B0614" fill-opacity="0.85"/>

    <g transform="translate(492, 208)">
      <circle cx="0" cy="0" r="108" fill="url(#centerEclipseGlow)"/>
      <circle cx="0" cy="0" r="82" fill="none" stroke="#D4AF37" stroke-width="1.2" stroke-opacity="0.5" stroke-dasharray="5 7"/>
      <circle cx="0" cy="0" r="52" fill="#07030D" stroke="#FFEAA6" stroke-width="3.6"/>
      <circle cx="0" cy="0" r="57" fill="none" stroke="#D94B72" stroke-width="2.2" stroke-opacity="0.9"/>
      <path d="M-14,16 L14,16 L10,-5 C10,-14 5,-20 0,-20 C-5,-20 -10,-14 -10,-5 Z" fill="none" stroke="#E5C168" stroke-width="1.8" stroke-opacity="0.75"/>
      <circle cx="0" cy="21" r="3" fill="#FFE8A3" fill-opacity="0.85"/>
    </g>
  </svg>`);

  const featureFgOverlaySvg = Buffer.from(`<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bottomVignette" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#07040C" stop-opacity="0"/>
        <stop offset="74%" stop-color="#07040C" stop-opacity="0"/>
        <stop offset="100%" stop-color="#07040C" stop-opacity="0.88"/>
      </linearGradient>
      <linearGradient id="pillBg" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#221035" stop-opacity="0.96"/>
        <stop offset="50%" stop-color="#381A54" stop-opacity="0.96"/>
        <stop offset="100%" stop-color="#221035" stop-opacity="0.96"/>
      </linearGradient>
    </defs>

    <rect width="1024" height="500" fill="url(#bottomVignette)"/>

    <g transform="translate(32, 314)">
      <rect x="0" y="0" width="392" height="36" rx="18" fill="url(#pillBg)" stroke="#D4AF37" stroke-width="1.5"/>
      <circle cx="22" cy="18" r="4" fill="#FFE394"/>
      <text x="196" y="23" text-anchor="middle" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="14" font-weight="700" letter-spacing="3.0" fill="#FFF0C2">GOTHIC ANIME TACTICAL RPG</text>
      <circle cx="370" cy="18" r="4" fill="#FFE394"/>

      <text x="196" y="64" text-anchor="middle" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="13.5" font-weight="700" letter-spacing="1.6" fill="#E6C77B">5v5 TURN-BASED COMBAT  ·  25 COMPANIONS</text>
      <text x="196" y="90" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="14" font-style="italic" fill="#DFD0EE">“Every name left on the Bell Road still answers.”</text>
    </g>

    <circle cx="442" cy="132" r="2.5" fill="#FFE6A3" fill-opacity="0.85"/>
    <circle cx="542" cy="146" r="3.0" fill="#FFE6A3" fill-opacity="0.9"/>
    <circle cx="468" cy="318" r="2.2" fill="#E4D4F4" fill-opacity="0.75"/>
    <circle cx="528" cy="296" r="2.8" fill="#FFB85C" fill-opacity="0.85"/>
    <circle cx="598" cy="422" r="3.2" fill="#FFE6A3" fill-opacity="0.85"/>
    <circle cx="956" cy="392" r="2.8" fill="#FFE6A3" fill-opacity="0.8"/>
  </svg>`);

  const featureBuf = await sharp(bgResized)
    .composite([
      { input: featureBgOverlaySvg, top: 0, left: 0 },
      { input: mahmutBuf, top: 500 - (mahmutMeta.height ?? 476), left: 682 },
      { input: fadymeBuf, top: 500 - (fadymeMeta.height ?? 476), left: 478 },
      { input: featureFgOverlaySvg, top: 0, left: 0 },
      { input: logoBuf, top: 104, left: 28 },
    ])
    .flatten({ background: '#07040C' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const storeFeaturePath = path.join(STORE_ASSETS, 'feature_graphic_1024x500.png');
  const brandFeaturePath = path.join(
    BRAND_DIR,
    'google_play_feature_graphic_1024x500_v001.png',
  );
  const workbenchJpgFeaturePath = path.join(
    ROOT,
    'narrative/15_Art_Workbench/ui_screens/brand_key_art_wide_v001.jpg',
  );
  await fs.promises.writeFile(storeFeaturePath, featureBuf);
  await fs.promises.writeFile(brandFeaturePath, featureBuf);
  await sharp(featureBuf).jpeg({ quality: 95 }).toFile(workbenchJpgFeaturePath);
  if (fs.existsSync(ARTIFACT_DIR)) {
    await fs.promises.writeFile(
      path.join(ARTIFACT_DIR, 'feature_graphic_1024x500.png'),
      featureBuf,
    );
  }

  console.log('✓ Saved canonical feature_graphic_1024x500.png (24-bit RGB, canonical Fadyme & Mahmut)');
}

/**
 * Step 5: 8x 1920x1080 Canonical Store Showcase Banners (24-bit RGB PNG)
 */
async function buildShowcaseScreenshots() {
  console.log('Building 8x 1920x1080 Canonical Store Showcase Banners...');
  ensureDir(STORE_SCREENSHOTS);

  // ---------------------------------------------------------------------------
  // 01: TITLE SCREEN — A BROKEN OATH · A KINGDOM IN ASH
  // ---------------------------------------------------------------------------
  {
    const titleBg = await sharp(path.join(ROOT, 'content/base/art/ui_title_bg.webp'))
      .resize(1920, 1080, { fit: 'cover' })
      .png()
      .toBuffer();

    const titleLogo = await sharp(path.join(ROOT, 'content/base/art/ui_logo.webp'))
      .resize(740, 342, { fit: 'inside' })
      .png()
      .toBuffer();

    const titleUiSvg = Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ctaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#1E0E33" stop-opacity="0.94"/>
          <stop offset="50%" stop-color="#361854" stop-opacity="0.96"/>
          <stop offset="100%" stop-color="#1E0E33" stop-opacity="0.94"/>
        </linearGradient>
      </defs>

      <text x="468" y="572" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="25" font-style="italic" fill="#EADFF5">A dark-fantasy tactical RPG of memory, ash, and the Bell Road.</text>

      <g transform="translate(178, 636)">
        <rect x="0" y="0" width="580" height="84" rx="10" fill="url(#ctaGrad)" stroke="#FFE394" stroke-width="2.4"/>
        <rect x="8" y="8" width="564" height="68" rx="6" fill="none" stroke="#D4AF37" stroke-width="1" stroke-opacity="0.6"/>
        <polygon points="34,42 44,34 54,42 44,50" fill="#FFE394"/>
        <polygon points="546,42 536,34 526,42 536,50" fill="#FFE394"/>
        <text x="290" y="51" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="28" font-weight="700" letter-spacing="4.5" fill="#FFF6DC">TAP TO BEGIN</text>
      </g>

      <g transform="translate(228, 746)">
        <rect x="0" y="0" width="480" height="52" rx="8" fill="#120820" fill-opacity="0.9" stroke="#8C6D23" stroke-width="1.5"/>
        <text x="240" y="32" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="15.5" font-weight="700" letter-spacing="2.2" fill="#E6C77B">REPLAY OPENING  ·  CLOUD SAVE READY</text>
      </g>

      <text x="84" y="1038" font-family="Cinzel, Georgia, serif" font-size="14" letter-spacing="2" fill="#B9A6CC" fill-opacity="0.8">PART I: THE ASHEN VOW  ·  GOOGLE PLAY GAMES SERVICES</text>
    </svg>`);

    const ribbon01 = buildEditorialRibbonSvg({
      badge: 'DARK FANTASY TACTICAL RPG & VISUAL NOVEL',
      headline: 'A BROKEN OATH · A KINGDOM IN ASH',
      subtitle:
        'Step onto the Bell Road with Fadyme & Mahmut in an atmospheric Gothic anime saga.',
      position: 'top',
    });

    const out01 = path.join(STORE_SCREENSHOTS, '01_title_screen.png');
    await sharp(titleBg)
      .composite([
        { input: titleLogo, left: 98, top: 192 },
        { input: titleUiSvg, left: 0, top: 0 },
        { input: ribbon01, top: 0, left: 0 },
      ])
      .flatten({ background: '#07040C' })
      .png({ compressionLevel: 9 })
      .toFile(out01);
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.copyFileSync(out01, path.join(ARTIFACT_DIR, '01_title_screen.png'));
    }
    console.log('✓ 01_title_screen.png');
  }

  // ---------------------------------------------------------------------------
  // 02: PROLOGUE & VISUAL NOVEL — EVERY NAME LEFT ON THE ROAD MATTERS
  // Built 100% from canonical bg_shelter_courtyard_dusk.webp + canonical Mahmut (left)
  // + canonical Fadyme (right) + canonical AAB stills (still_prologue_beginning.webp & still_roadside_rest.webp)
  // ---------------------------------------------------------------------------
  {
    const bg02 = await sharp(
      path.join(ROOT, 'content/base/art/bg_shelter_courtyard_dusk.webp'),
    )
      .resize(1920, 1080, { fit: 'cover' })
      .modulate({ brightness: 0.72 })
      .png()
      .toBuffer();

    const mahmutVn = await extractCanonicalPortrait(
      path.join(ROOT, 'content/base/art/portrait_mahmut_composed.webp'),
      540,
      790,
      'inside',
    );
    const fadymeVn = await extractCanonicalPortrait(
      path.join(ROOT, 'content/base/art/portrait_fadyme_warm.webp'),
      540,
      790,
      'inside',
    );

    const still01Buf = await sharp(
      path.join(ROOT, 'content/base/art/still_prologue_beginning.webp'),
    )
      .resize(356, 200, { fit: 'cover' })
      .png()
      .toBuffer();
    const still02Buf = await sharp(
      path.join(ROOT, 'content/base/art/still_roadside_rest.webp'),
    )
      .resize(356, 200, { fit: 'cover' })
      .png()
      .toBuffer();

    const vnHudSvg = Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dlgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#12091E" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#08040E" stop-opacity="0.98"/>
        </linearGradient>
      </defs>

      <!-- Center Canonical Story Stills Inset Cards -->
      <g transform="translate(782, 188)">
        <rect x="-8" y="-8" width="372" height="244" rx="10" fill="#090510" fill-opacity="0.94" stroke="#D4AF37" stroke-width="2.2"/>
        <text x="178" y="220" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" letter-spacing="1.8" fill="#EAD08A">PROLOGUE CG · BEFORE THE BELL ROAD</text>
      </g>
      <g transform="translate(782, 452)">
        <rect x="-8" y="-8" width="372" height="244" rx="10" fill="#090510" fill-opacity="0.94" stroke="#D4AF37" stroke-width="2.2"/>
        <text x="178" y="220" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" letter-spacing="1.8" fill="#EAD08A">STORY CG · CAMPFIRE IN THE ASH WOODS</text>
      </g>

      <!-- Gothic Visual Novel Dialogue Box (y=736..1026) -->
      <g transform="translate(96, 736)">
        <rect x="0" y="0" width="1728" height="284" rx="12" fill="url(#dlgGrad)" stroke="#D4AF37" stroke-width="2.4"/>
        <rect x="8" y="8" width="1712" height="268" rx="8" fill="none" stroke="#8C6D23" stroke-width="1" stroke-opacity="0.6"/>

        <!-- Active Speaker Nameplate (Right-Aligned for Fadyme) -->
        <rect x="1320" y="-26" width="320" height="52" rx="8" fill="#2A1344" stroke="#FFE394" stroke-width="2.2"/>
        <text x="1480" y="7" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="22" font-weight="700" letter-spacing="3" fill="#FFF6DC">FADYME</text>

        <!-- Inactive Listener Nameplate (Left-Aligned for Mahmut) -->
        <rect x="64" y="-22" width="260" height="44" rx="8" fill="#140A22" stroke="#8C6D23" stroke-width="1.5"/>
        <text x="194" y="6" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="17" font-weight="700" letter-spacing="2.5" fill="#C9B8DC">MAHMUT</text>

        <!-- Dialogue Lines -->
        <text x="64" y="76" font-family="Georgia, 'Times New Roman', serif" font-size="29" fill="#F5ECFC">“You have inspected the entire courtyard in the time it took me to unlatch the shutter.</text>
        <text x="64" y="122" font-family="Georgia, 'Times New Roman', serif" font-size="29" fill="#F5ECFC">Sit down before the tea goes cold, Uncle — the road to the Sunken Nave waits for dawn.”</text>

        <line x1="64" y1="168" x2="1664" y2="168" stroke="#D4AF37" stroke-width="1" stroke-opacity="0.4"/>
        <text x="64" y="212" font-family="Cinzel, Georgia, serif" font-size="15.5" font-weight="700" letter-spacing="2.2" fill="#E6C77B">CHAPTER I · A ROOF BEFORE DAWN   ·   JAPANESE VOICE OVER (CHIRP 3 HD)   ·   32 EXPRESSIVE PORTRAIT SETS</text>

        <!-- VN Control Pills -->
        <g transform="translate(1280, 186)">
          <rect x="0" y="0" width="118" height="40" rx="20" fill="#1B0E2E" stroke="#D4AF37" stroke-width="1.2"/>
          <text x="59" y="25" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" fill="#EAD08A">AUTO</text>
          <rect x="132" y="0" width="118" height="40" rx="20" fill="#1B0E2E" stroke="#D4AF37" stroke-width="1.2"/>
          <text x="191" y="25" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" fill="#EAD08A">LOG</text>
          <rect x="264" y="0" width="118" height="40" rx="20" fill="#361854" stroke="#FFE394" stroke-width="1.5"/>
          <text x="323" y="25" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" fill="#FFF6DC">NEXT ▶</text>
        </g>
      </g>
    </svg>`);

    const ribbon02 = buildEditorialRibbonSvg({
      badge: 'VOICED LIGHT NOVEL STORY & HAND-PAINTED CGS',
      headline: 'EVERY NAME LEFT ON THE ROAD MATTERS',
      subtitle:
        'Experience a literary dark-fantasy narrative with canonical knee-up portraits, story stills & Japanese voice acting.',
      position: 'top',
    });

    const out02 = path.join(STORE_SCREENSHOTS, '02_prologue_cinematic.png');
    await sharp(bg02)
      .composite([
        { input: mahmutVn, left: 110, top: 196 },
        { input: fadymeVn, left: 1270, top: 196 },
        { input: vnHudSvg, left: 0, top: 0 },
        { input: still01Buf, left: 782, top: 188 },
        { input: still02Buf, left: 782, top: 452 },
        { input: ribbon02, left: 0, top: 0 },
      ])
      .flatten({ background: '#07040C' })
      .png({ compressionLevel: 9 })
      .toFile(out02);
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.copyFileSync(out02, path.join(ARTIFACT_DIR, '02_prologue_cinematic.png'));
    }
    console.log('✓ 02_prologue_cinematic.png');
  }

  // ---------------------------------------------------------------------------
  // 03: TACTICAL BATTLE — COMMAND 5v5 TACTICAL BATTLES
  // Built 100% from canonical party & enemy chibi atlases + canonical Fadyme resolve portrait cut-in
  // + Fadyme's actual skills (VEILGLASS THORN, BORROWED HOUR, BELL THAT FORGETS) + non-overlapping HP plates!
  // ---------------------------------------------------------------------------
  {
    const bg03 = await sharp(
      path.join(ROOT, 'content/approved_art/art/bg_cathedral_saint_luthos.webp'),
    )
      .resize(1920, 1080, { fit: 'cover' })
      .modulate({ brightness: 0.72 })
      .png()
      .toBuffer();

    // Canonical Fadyme bust crop for Ultimate Cut-In card (from content/base/art/portrait_fadyme_resolve.webp)
    const fadymeCutinPortrait = await sharp(
      path.join(ROOT, 'content/base/art/portrait_fadyme_resolve.webp'),
    )
      .extract({ left: 84, top: 270, width: 600, height: 340 })
      .resize(280, 158, { fit: 'cover' })
      .png()
      .toBuffer();

    // 5 Canonical Party Units on Left (each using its own distinct canonical atlas!)
    const allies = [
      { name: 'SISTER AVELINE', atlas: 'atlas_sister_aveline', pose: 'idle', x: 185, y: 455, hp: 1.0, focus: 0.70 },
      { name: 'FADYME', atlas: 'atlas_fadyme', pose: 'ultimate', x: 245, y: 695, hp: 0.96, focus: 1.0, active: true },
      { name: 'KERA VOSS', atlas: 'atlas_kera_voss', pose: 'active', x: 445, y: 365, hp: 0.92, focus: 0.65 },
      { name: 'BRIN ALDER', atlas: 'atlas_brin_alder', pose: 'idle', x: 615, y: 535, hp: 0.89, focus: 0.55 },
      { name: 'MAHMUT', atlas: 'atlas_mahmut', pose: 'active', x: 475, y: 715, hp: 0.94, focus: 0.85 },
    ];

    // 4 Canonical Enemies + Boss on Right
    const enemies = [
      { name: 'HOLLOW PILGRIM', atlas: 'atlas_hollow_pilgrim', pose: 'idle', x: 1215, y: 495, hp: 0.62, targeted: false },
      { name: 'BELLBOUND DEAD', atlas: 'atlas_bellbound_dead', pose: 'hit', x: 1315, y: 685, hp: 0.48, targeted: true },
      { name: 'ASH WOLF', atlas: 'atlas_ash_wolf', pose: 'idle', x: 1545, y: 425, hp: 0.78, targeted: false },
      { name: 'BOSS · BELL WIDOW', atlas: 'atlas_boss_bell_widow', pose: 'active', x: 1645, y: 655, hp: 0.84, targeted: false, isBoss: true },
    ];

    const spriteComposites = [];
    const plateSvgParts = [];

    for (const u of allies) {
      const buf = await extractAtlasFrame(u.atlas, u.pose, 170, 175, false);
      const m = await sharp(buf).metadata();
      const sw = m.width ?? 145;
      const sh = m.height ?? 155;
      spriteComposites.push({
        input: buf,
        left: Math.round(u.x - sw / 2),
        top: Math.round(u.y - sh),
      });
      plateSvgParts.push(`
        <g transform="translate(${u.x}, ${u.y})">
          <ellipse cx="0" cy="-6" rx="64" ry="16" fill="${u.active ? '#3A1859' : '#101828'}" fill-opacity="0.85" stroke="${u.active ? '#FFE394' : '#68B5E8'}" stroke-width="${u.active ? 2.5 : 1.8}"/>
          <rect x="-88" y="6" width="176" height="42" rx="12" fill="#0B0914" fill-opacity="0.92" stroke="${u.active ? '#FFE394' : '#5A769A'}" stroke-width="${u.active ? 2 : 1.3}"/>
          <text x="0" y="21" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="11" font-weight="700" letter-spacing="0.8" fill="#FFF6DC">${u.name}</text>
          <rect x="-70" y="27" width="140" height="7" rx="3.5" fill="#1A2436"/>
          <rect x="-69" y="28" width="${Math.round(138 * u.hp)}" height="5" rx="2.5" fill="#7CE89B"/>
          <rect x="-54" y="37" width="108" height="5" rx="2.5" fill="#1A162B"/>
          <rect x="-53" y="38" width="${Math.round(106 * u.focus)}" height="3" rx="1.5" fill="#D4AF37"/>
        </g>
      `);
    }

    for (const e of enemies) {
      const maxW = e.isBoss ? 255 : 170;
      const maxH = e.isBoss ? 265 : 175;
      const buf = await extractAtlasFrame(e.atlas, e.pose, maxW, maxH, false);
      const m = await sharp(buf).metadata();
      const sw = m.width ?? 150;
      const sh = m.height ?? 160;
      spriteComposites.push({
        input: buf,
        left: Math.round(e.x - sw / 2),
        top: Math.round(e.y - sh),
      });
      plateSvgParts.push(`
        <g transform="translate(${e.x}, ${e.y})">
          ${e.targeted ? `<ellipse cx="0" cy="-6" rx="82" ry="22" fill="#FFE394" fill-opacity="0.22" stroke="#FFE394" stroke-width="2.5"/><polygon points="0,-${sh + 28} 14,-${sh + 52} -14,-${sh + 52}" fill="#FFE394" stroke="#08040E" stroke-width="2"/>` : ''}
          <ellipse cx="0" cy="-6" rx="${e.isBoss ? 92 : 64}" ry="${e.isBoss ? 22 : 16}" fill="#240B1C" fill-opacity="0.85" stroke="#FF5E8E" stroke-width="2"/>
          <rect x="-96" y="6" width="192" height="40" rx="12" fill="#160714" fill-opacity="0.94" stroke="${e.targeted ? '#FFE394' : '#FF5E8E'}" stroke-width="${e.targeted ? 2.2 : 1.5}"/>
          <text x="0" y="21" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="11" font-weight="700" letter-spacing="0.8" fill="${e.isBoss ? '#FFE394' : '#FFD2E0'}">${e.name}</text>
          <rect x="-76" y="27" width="152" height="8" rx="4" fill="#2B1228"/>
          <rect x="-75" y="28" width="${Math.round(150 * e.hp)}" height="6" rx="3" fill="#E03E6D"/>
        </g>
      `);
    }

    const battleHudAndCutinSvg = Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cutinGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#1E0C33" stop-opacity="0.96"/>
          <stop offset="65%" stop-color="#381557" stop-opacity="0.94"/>
          <stop offset="100%" stop-color="#12071F" stop-opacity="0.96"/>
        </linearGradient>
      </defs>

      <!-- Unit Pedestals & Non-Overlapping Bottom Nameplates -->
      ${plateSvgParts.join('\n')}

      <!-- Turn Order Timeline Bar (y=168, x=64..944) -->
      <g transform="translate(64, 168)">
        <rect x="0" y="0" width="880" height="64" rx="8" fill="#0E0718" fill-opacity="0.94" stroke="#D4AF37" stroke-width="1.8"/>
        <text x="24" y="38" font-family="Cinzel, Georgia, serif" font-size="15" font-weight="700" letter-spacing="2" fill="#E6C77B">TURN ORDER</text>

        <rect x="164" y="10" width="146" height="44" rx="6" fill="#3A1859" stroke="#FFE394" stroke-width="2"/>
        <text x="237" y="37" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13.5" font-weight="700" fill="#FFF6DC">▶ FADYME</text>

        <rect x="322" y="12" width="128" height="40" rx="6" fill="#180D29" stroke="#68B5E8" stroke-width="1.2"/>
        <text x="386" y="37" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12.5" font-weight="700" fill="#D8ECFF">MAHMUT</text>

        <rect x="462" y="12" width="132" height="40" rx="6" fill="#180D29" stroke="#68B5E8" stroke-width="1.2"/>
        <text x="528" y="37" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12.5" font-weight="700" fill="#D8ECFF">KERA VOSS</text>

        <rect x="606" y="12" width="128" height="40" rx="6" fill="#260D1E" stroke="#FF5E8E" stroke-width="1.2"/>
        <text x="670" y="37" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12.5" font-weight="700" fill="#FFD2E0">BELL WIDOW</text>

        <rect x="746" y="12" width="118" height="40" rx="6" fill="#180D29" stroke="#68B5E8" stroke-width="1.2"/>
        <text x="805" y="37" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12.5" font-weight="700" fill="#D8ECFF">BRIN ALDER</text>
      </g>

      <!-- Ultimate Cut-In Banner Card on Upper Right (x=980, y=168) -->
      <g transform="translate(980, 168)">
        <rect x="0" y="0" width="876" height="158" rx="10" fill="url(#cutinGrad)" stroke="#D4AF37" stroke-width="2.5"/>
        <circle cx="578" cy="79" r="62" fill="none" stroke="#D94B72" stroke-width="1.8" stroke-opacity="0.55"/>
        <line x1="300" y1="26" x2="846" y2="26" stroke="#D4AF37" stroke-width="1" stroke-opacity="0.5"/>
        <line x1="300" y1="132" x2="846" y2="132" stroke="#D4AF37" stroke-width="1" stroke-opacity="0.5"/>
        <text x="574" y="50" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" letter-spacing="3.0" fill="#F2C96B">ULTIMATE UNLEASHED · 100 FOCUS</text>
        <text x="574" y="86" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="25" font-weight="700" letter-spacing="1.8" fill="#FFF6DC">THE BELL THAT FORGETS</text>
        <text x="574" y="116" text-anchor="middle" font-family="Georgia, serif" font-size="15" font-style="italic" fill="#DFC9F2">「忘却の鐘よ、灰のヴェールを裂け！」 · AoE Veil DMG &amp; Silence</text>
      </g>

      <!-- Bottom Tactical Command Bar (Consistent with Active Turn: Fadyme!) -->
      <g transform="translate(272, 804)">
        <rect x="0" y="0" width="1376" height="58" rx="8" fill="#0B0613" fill-opacity="0.92" stroke="#8C6D23" stroke-width="1.4"/>
        <text x="688" y="35" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="14" font-weight="700" letter-spacing="1.8" fill="#E6C77B">ACTIVE TURN: FADYME (VEIL WEAVER)  ·  5v5 TACTICAL FORMATION  ·  WAVE 2 / 3</text>
      </g>

      <g transform="translate(472, 876)">
        <rect x="0" y="0" width="976" height="106" rx="10" fill="#090510" fill-opacity="0.94" stroke="#7A5E29" stroke-width="1.5"/>

        <g transform="translate(24, 13)">
          <rect x="0" y="0" width="286" height="80" rx="8" fill="#170C28" stroke="#D4AF37" stroke-width="1.6"/>
          <text x="143" y="36" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="18" font-weight="700" fill="#FFF3D1">VEILGLASS THORN</text>
          <text x="143" y="60" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" letter-spacing="1.8" fill="#C9B8DC">BASIC  ·  +20 FOCUS</text>
        </g>

        <g transform="translate(345, 13)">
          <rect x="0" y="0" width="286" height="80" rx="8" fill="#1E0E36" stroke="#D4AF37" stroke-width="1.8"/>
          <text x="143" y="36" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="18" font-weight="700" fill="#FFF3D1">BORROWED HOUR</text>
          <text x="143" y="60" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" letter-spacing="1.8" fill="#E6C77B">SKILL  ·  TURN ADVANCE</text>
        </g>

        <g transform="translate(666, 13)">
          <rect x="0" y="0" width="286" height="80" rx="8" fill="#381657" stroke="#FFE394" stroke-width="2.4"/>
          <text x="143" y="36" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="16.5" font-weight="700" fill="#FFF6DC">BELL THAT FORGETS</text>
          <text x="143" y="60" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" letter-spacing="1.8" fill="#FFE394">ULTIMATE  ·  100/100 FOCUS</text>
        </g>
      </g>
    </svg>`);

    const ribbon03 = buildEditorialRibbonSvg({
      badge: '5v5 TURN-BASED TACTICAL COMBAT',
      headline: 'COMMAND 5v5 TACTICAL BATTLES',
      subtitle:
        'Read enemy target intentions, control the turn timeline, and trigger 3-beat Japanese Ultimate Cut-Ins.',
      position: 'top',
    });

    const out03 = path.join(STORE_SCREENSHOTS, '03_tactical_battle.png');
    await sharp(bg03)
      .composite([
        { input: battleHudAndCutinSvg, top: 0, left: 0 },
        ...spriteComposites,
        { input: fadymeCutinPortrait, top: 168, left: 980 },
        { input: ribbon03, top: 0, left: 0 },
      ])
      .flatten({ background: '#07040C' })
      .png({ compressionLevel: 9 })
      .toFile(out03);
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.copyFileSync(out03, path.join(ARTIFACT_DIR, '03_tactical_battle.png'));
    }
    console.log('✓ 03_tactical_battle.png');
  }

  // ---------------------------------------------------------------------------
  // 04: WORLD MAP HUB — EXPLORE 43 LIVING LOCATIONS ON THE BELL ROAD
  // ---------------------------------------------------------------------------
  {
    const worldMapBg = await sharp(
      path.join(ROOT, 'content/approved_art/art/bg_world_map_part1.webp'),
    )
      .resize(1920, 1080, { fit: 'cover' })
      .png()
      .toBuffer();

    const landmarks = [
      { id: 'I', name: 'PALE-ASH FOREST', sub: 'Ch. I · 6 Stages · 18/18★', x: 250, y: 690, state: 'cleared' },
      { id: 'II', name: 'SUNKEN NAVE', sub: 'Ch. II · 6 Stages · 18/18★', x: 465, y: 390, state: 'cleared' },
      { id: 'III', name: 'RED-HARVEST HAMLET', sub: 'Ch. III · Active Campaign', x: 675, y: 655, state: 'active' },
      { id: 'IV', name: 'DROWNED ARCHIVE', sub: 'Ch. IV · 6 Stages', x: 960, y: 500, state: 'unlocked' },
      { id: 'V', name: 'IRON-CHAIN SPAN', sub: 'Ch. V · 6 Stages', x: 1235, y: 665, state: 'unlocked' },
      { id: 'VI', name: 'ASHEN MANOR', sub: 'Ch. VI · 6 Stages', x: 1455, y: 365, state: 'locked' },
      { id: 'VII', name: 'FIRST ECLIPSE ALTAR', sub: 'Ch. VII · Finale', x: 1665, y: 650, state: 'locked' },
    ];

    const routeSvgParts = [];
    for (let i = 0; i < landmarks.length - 1; i++) {
      const a = landmarks[i];
      const b = landmarks[i + 1];
      const isLit = i < 2;
      routeSvgParts.push(
        `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${isLit ? '#FFE394' : '#8C6D23'}" stroke-width="${isLit ? '3.5' : '2'}" stroke-dasharray="8 8" stroke-opacity="${isLit ? '0.9' : '0.55'}"/>`,
      );
      for (let s = 1; s <= 4; s++) {
        const t = s / 5;
        const bx = Math.round(a.x + (b.x - a.x) * t);
        const by = Math.round(a.y + (b.y - a.y) * t);
        routeSvgParts.push(
          `<circle cx="${bx}" cy="${by}" r="${isLit ? 4.5 : 3}" fill="${isLit ? '#FFF2BD' : '#7A5E29'}"/>`,
        );
      }
    }

    const landmarkNodesSvg = landmarks
      .map((lm) => {
        const isAct = lm.state === 'active';
        const isClr = lm.state === 'cleared';
        const ringCol = isAct ? '#FFE394' : isClr ? '#D4AF37' : '#7A6888';
        const fillCol = isAct ? '#3C1659' : isClr ? '#1F1033' : '#12091E';
        return `<g transform="translate(${lm.x}, ${lm.y})">
          ${isAct ? `<circle cx="0" cy="0" r="54" fill="#FF4D79" fill-opacity="0.25" stroke="#FFE394" stroke-width="2" stroke-dasharray="6 4"/>` : ''}
          <circle cx="0" cy="0" r="${isAct ? 34 : 26}" fill="${fillCol}" stroke="${ringCol}" stroke-width="${isAct ? 3.2 : 2}"/>
          <text x="0" y="7" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="${isAct ? 20 : 16}" font-weight="700" fill="#FFF6DC">${lm.id}</text>
          <rect x="-126" y="${isAct ? 44 : 34}" width="252" height="50" rx="8" fill="#0B0614" fill-opacity="0.92" stroke="${ringCol}" stroke-width="1.5"/>
          <text x="0" y="${isAct ? 66 : 56}" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" letter-spacing="1.2" fill="#FFF3D1">${lm.name}</text>
          <text x="0" y="${isAct ? 84 : 74}" text-anchor="middle" font-family="Georgia, serif" font-size="12" font-style="italic" fill="${isAct ? '#FFE394' : '#C9B8DC'}">${lm.sub}</text>
        </g>`;
      })
      .join('\n');

    const worldMapHudSvg = Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
      ${routeSvgParts.join('\n')}
      ${landmarkNodesSvg}

      <g transform="translate(64, 824)">
        <rect x="0" y="0" width="880" height="118" rx="10" fill="#120820" fill-opacity="0.95" stroke="#D4AF37" stroke-width="2"/>
        <text x="28" y="36" font-family="Cinzel, Georgia, serif" font-size="17.5" font-weight="700" letter-spacing="1.5" fill="#FFE394">CHAPTER III · RED-HARVEST HAMLET · NODE 3-4</text>
        <text x="28" y="66" font-family="Georgia, serif" font-size="16" fill="#DDD0E8">Recommended Power: 4,200  ·  First-Clear: 80 Bell's Remains + Ashen Chronicle Page</text>
        <text x="28" y="96" font-family="Cinzel, Georgia, serif" font-size="13.5" fill="#B9A6CC">43 HAND-CRAFTED LOCATIONS  ·  STORY &amp; TACTICAL ENCOUNTER NODES</text>
        <rect x="674" y="30" width="180" height="58" rx="8" fill="#3A1859" stroke="#FFE394" stroke-width="2"/>
        <text x="764" y="65" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="17" font-weight="700" letter-spacing="2" fill="#FFF6DC">MARCH OUT</text>
      </g>

      <g transform="translate(64, 960)">
        <rect x="0" y="0" width="1792" height="76" rx="10" fill="#0B0613" fill-opacity="0.95" stroke="#D4AF37" stroke-width="1.8"/>
        ${[
          { label: 'WORLD MAP', active: true },
          { label: 'COMPANIONS (25)', active: false },
          { label: 'PARTY (5v5)', active: false },
          { label: 'SUMMON', active: false },
          { label: 'TRIALS & ARENA', active: false },
          { label: 'CHRONICLE & CODEX', active: false },
        ]
          .map((tab, idx) => {
            const tx = 24 + idx * 292;
            return `<g transform="translate(${tx}, 12)">
              <rect x="0" y="0" width="276" height="52" rx="8" fill="${tab.active ? '#341652' : '#160B26'}" stroke="${tab.active ? '#FFE394' : '#7A5E29'}" stroke-width="${tab.active ? 2 : 1.2}"/>
              <text x="138" y="32" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="15" font-weight="700" letter-spacing="1.6" fill="${tab.active ? '#FFF6DC' : '#D4C2E8'}">${escapeXml(tab.label)}</text>
            </g>`;
          })
          .join('\n')}
      </g>
    </svg>`);

    const ribbon04 = buildEditorialRibbonSvg({
      badge: 'THE KINGDOM OF VEYRHOLD · 7 CHAPTER REGIONS',
      headline: 'EXPLORE 43 LIVING LOCATIONS ON THE BELL ROAD',
      subtitle:
        'Traverse the Pale-Ash Forest, Sunken Nave, Red-Harvest Hamlet, Iron-Chain Span & Eclipse Altar.',
      position: 'top',
    });

    const out04 = path.join(STORE_SCREENSHOTS, '04_world_map_hub.png');
    await sharp(worldMapBg)
      .composite([
        { input: worldMapHudSvg, top: 0, left: 0 },
        { input: ribbon04, top: 0, left: 0 },
      ])
      .flatten({ background: '#07040C' })
      .png({ compressionLevel: 9 })
      .toFile(out04);
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.copyFileSync(out04, path.join(ARTIFACT_DIR, '04_world_map_hub.png'));
    }
    console.log('✓ 04_world_map_hub.png');
  }

  // ---------------------------------------------------------------------------
  // 05: COMPANION ROSTER — COLLECT & ASCEND 25 UNIQUE COMPANIONS
  // Uses ONLY canonical portraits (including canonical portrait_fadyme_resolve.webp!)
  // ---------------------------------------------------------------------------
  {
    const bg05 = await sharp(
      path.join(ROOT, 'content/approved_art/art/bg_cathedral_saint_luthos.webp'),
    )
      .resize(1920, 1080, { fit: 'cover' })
      .modulate({ brightness: 0.55 })
      .png()
      .toBuffer();

    const heroes = [
      {
        name: 'FADYME',
        title: 'Veil Weaver · 5★',
        role: 'TACTICAL CONTROL & VEIL DPS',
        portrait: path.join(ROOT, 'content/base/art/portrait_fadyme_resolve.webp'),
        atlasKey: 'atlas_fadyme',
        accent: '#C968E8',
      },
      {
        name: 'MAHMUT',
        title: 'Oath Vanguard · 5★',
        role: 'FRONT-LINE GUARDIAN & TAUNT',
        portrait: path.join(ROOT, 'content/base/art/portrait_mahmut_protective_resolve.webp'),
        atlasKey: 'atlas_mahmut',
        accent: '#E05A47',
      },
      {
        name: 'SISTER AVELINE',
        title: 'Sanctuary Cleric · 5★',
        role: 'TEAM HEALER & CLEANSE',
        portrait: path.join(ROOT, 'content/approved_art/art/portrait_sister_aveline_composed.webp'),
        atlasKey: 'atlas_sister_aveline',
        accent: '#F2C96B',
      },
      {
        name: 'SABLE WREN',
        title: 'Ashen Nightblade · 5★',
        role: 'SINGLE-TARGET ASSASSIN',
        portrait: path.join(ROOT, 'content/approved_art/art/portrait_sable_wren_composed.webp'),
        atlasKey: 'atlas_sable_wren',
        accent: '#68B5E8',
      },
      {
        name: 'VESPERA WISP',
        title: 'Eclipse Arcanist · 5★',
        role: 'AOE BURN & ARCANE BURST',
        portrait: path.join(ROOT, 'content/approved_art/art/portrait_vespera_wisp_composed.webp'),
        atlasKey: 'atlas_vespera_wisp',
        accent: '#E85C8A',
      },
    ];

    const composites = [];
    const cardW = 336;
    const cardH = 836;
    const gap = 28;
    const startX = 64;
    const startY = 180;

    for (let i = 0; i < heroes.length; i++) {
      const h = heroes[i];
      const x = startX + i * (cardW + gap);

      const cardBg = Buffer.from(`<svg width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cGrad${i}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#170C28" stop-opacity="0.95"/>
            <stop offset="65%" stop-color="#25123E" stop-opacity="0.92"/>
            <stop offset="100%" stop-color="#0B0614" stop-opacity="0.98"/>
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="${cardW - 4}" height="${cardH - 4}" rx="12" fill="url(#cGrad${i})" stroke="#D4AF37" stroke-width="2.2"/>
        <rect x="8" y="8" width="${cardW - 16}" height="${cardH - 16}" rx="8" fill="none" stroke="${h.accent}" stroke-width="1" stroke-opacity="0.5"/>
        <circle cx="${cardW / 2}" cy="240" r="128" fill="${h.accent}" fill-opacity="0.14"/>
        <circle cx="${cardW / 2}" cy="240" r="128" fill="none" stroke="#D4AF37" stroke-width="1" stroke-opacity="0.35" stroke-dasharray="4 6"/>
      </svg>`);
      composites.push({ input: cardBg, left: x, top: startY });

      // Alpha-trimmed portrait so all 5 cards have identical head height and cel-shaded anime style!
      const pBuf = await extractCanonicalPortrait(h.portrait, cardW - 16, 560, 'cover');
      composites.push({ input: pBuf, left: x + 8, top: startY + 16 });

      const chibiBuf = await extractAtlasFrame(h.atlasKey, 'idle', 135, 175);
      const cMeta = await sharp(chibiBuf).metadata();
      const cLeft = x + cardW - (cMeta.width ?? 120) - 18;
      const cTop = startY + 590 - (cMeta.height ?? 165);

      const chibiPedestalSvg = Buffer.from(`<svg width="160" height="50" viewBox="0 0 160 50" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="80" cy="25" rx="64" ry="16" fill="#12071F" fill-opacity="0.9" stroke="#D4AF37" stroke-width="1.8"/>
      </svg>`);
      composites.push({ input: chibiPedestalSvg, left: x + cardW - 170, top: startY + 558 });
      composites.push({ input: chibiBuf, left: cLeft, top: cTop });

      const cardFooter = Buffer.from(`<svg width="${cardW}" height="240" viewBox="0 0 ${cardW} 240" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fGrad${i}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0A0512" stop-opacity="0"/>
            <stop offset="28%" stop-color="#0A0512" stop-opacity="0.92"/>
            <stop offset="100%" stop-color="#08040E" stop-opacity="0.98"/>
          </linearGradient>
        </defs>
        <rect x="4" y="0" width="${cardW - 8}" height="236" rx="10" fill="url(#fGrad${i})"/>
        <line x1="20" y1="88" x2="${cardW - 20}" y2="88" stroke="#D4AF37" stroke-width="1.2" stroke-opacity="0.7"/>
        <text x="24" y="122" font-family="Cinzel, Georgia, serif" font-size="24" font-weight="700" letter-spacing="1.5" fill="#FFF3D1">${escapeXml(h.name)}</text>
        <text x="24" y="150" font-family="Georgia, serif" font-size="16" font-style="italic" fill="#E6C77B">${escapeXml(h.title)}</text>
        <rect x="22" y="168" width="${cardW - 44}" height="32" rx="6" fill="#1C0E30" stroke="${h.accent}" stroke-width="1"/>
        <text x="${cardW / 2}" y="189" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12.5" font-weight="700" letter-spacing="1.4" fill="#EADBF8">${escapeXml(h.role)}</text>
        <text x="${cardW / 2}" y="220" text-anchor="middle" font-family="Georgia, serif" font-size="13" fill="#B9A6CC">Lv. 40  ·  Bond Rank V  ·  8 Combat Poses</text>
      </svg>`);
      composites.push({ input: cardFooter, left: x, top: startY + cardH - 240 });
    }

    const ribbon05 = buildEditorialRibbonSvg({
      badge: '25 PLAYABLE COMPANIONS · ZERO DUPLICATE LOCKS',
      headline: 'COLLECT & ASCEND 25 UNIQUE COMPANIONS',
      subtitle:
        'Every companion features canonical knee-up portraits, 8 articulated combat poses & voiced bonds.',
      position: 'top',
    });
    composites.push({ input: ribbon05, left: 0, top: 0 });

    const out05 = path.join(STORE_SCREENSHOTS, '05_companion_roster.png');
    await sharp(bg05)
      .composite(composites)
      .flatten({ background: '#07040C' })
      .png({ compressionLevel: 9 })
      .toFile(out05);
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.copyFileSync(out05, path.join(ARTIFACT_DIR, '05_companion_roster.png'));
    }
    console.log('✓ 05_companion_roster.png');
  }

  // ---------------------------------------------------------------------------
  // 06: CHARACTER SHEET — 8 ARTICULATED COMBAT POSES · RELICS & SKILLS
  // ---------------------------------------------------------------------------
  {
    const bg06 = await sharp(
      path.join(ROOT, 'content/approved_art/art/bg_altar_round_archive.webp'),
    )
      .resize(1920, 1080, { fit: 'cover' })
      .modulate({ brightness: 0.48 })
      .png()
      .toBuffer();

    const fadymeFullBody = await extractCanonicalPortrait(
      path.join(ROOT, 'content/base/art/portrait_fadyme_resolve.webp'),
      470,
      690,
      'contain',
    );

    const mainChibiSkill = await extractAtlasFrame('atlas_fadyme', 'active', 280, 260);
    const mainMeta = await sharp(mainChibiSkill).metadata();

    const poseDefs = [
      { label: 'IDLE', frame: 'idle' },
      { label: 'WALK', frame: 'walk' },
      { label: 'ATTACK', frame: 'basic' },
      { label: 'SKILL', frame: 'active' },
      { label: 'ULTIMATE', frame: 'ultimate' },
      { label: 'HIT', frame: 'hit' },
      { label: 'VICTORY', frame: 'victory' },
      { label: 'KO', frame: 'defeat' },
    ];
    const miniPoses = [];
    for (let idx = 0; idx < poseDefs.length; idx++) {
      const r = Math.floor(idx / 4);
      const c = idx % 4;
      const buf = await extractAtlasFrame('atlas_fadyme', poseDefs[idx].frame, 118, 106);
      const m = await sharp(buf).metadata();
      const boxX = 596 + c * 156;
      const boxY = 682 + r * 162;
      const left = boxX + Math.round((144 - (m.width ?? 100)) / 2);
      const top = boxY + 8 + Math.round((108 - (m.height ?? 100)) / 2);
      miniPoses.push({ buf, left, top, label: poseDefs[idx].label });
    }

    const uiPanelsSvg = Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="panelBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#140A24" stop-opacity="0.94"/>
          <stop offset="100%" stop-color="#0A0513" stop-opacity="0.96"/>
        </linearGradient>
      </defs>

      <rect x="56" y="176" width="490" height="850" rx="12" fill="url(#panelBg)" stroke="#D4AF37" stroke-width="2"/>
      <circle cx="301" cy="520" r="190" fill="#A94CE6" fill-opacity="0.12" stroke="#D4AF37" stroke-width="1.2" stroke-dasharray="6 6"/>
      <text x="301" y="222" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="26" font-weight="700" letter-spacing="2" fill="#FFF3D1">FADYME</text>
      <text x="301" y="250" text-anchor="middle" font-family="Georgia, serif" font-size="16" font-style="italic" fill="#E6C77B">5★ Veil Weaver  ·  Sanctuary Bell Bearer</text>

      <rect x="572" y="176" width="664" height="850" rx="12" fill="url(#panelBg)" stroke="#D4AF37" stroke-width="2"/>
      <text x="904" y="220" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="21" font-weight="700" letter-spacing="2.2" fill="#FFF3D1">ARTICULATED CHIBI COMBAT VIEWER</text>
      <text x="904" y="246" text-anchor="middle" font-family="Georgia, serif" font-size="15" font-style="italic" fill="#CFC0DE">Tap any pose below to preview combat animations &amp; VFX</text>

      <circle cx="904" cy="436" r="142" fill="#2A1346" fill-opacity="0.7" stroke="#D4AF37" stroke-width="2"/>
      <circle cx="904" cy="436" r="126" fill="none" stroke="#D94B72" stroke-width="1.5" stroke-dasharray="5 5"/>
      <ellipse cx="904" cy="552" rx="118" ry="22" fill="#12071F" stroke="#E5C168" stroke-width="2"/>
      <rect x="774" y="602" width="260" height="36" rx="18" fill="#3A1859" stroke="#F2C96B" stroke-width="1.5"/>
      <text x="904" y="625" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="14" font-weight="700" letter-spacing="2" fill="#FFF4D2">ACTIVE POSE: SKILL CAST</text>

      ${miniPoses
        .map((p, idx) => {
          const boxX = 596 + (idx % 4) * 156;
          const boxY = 682 + Math.floor(idx / 4) * 162;
          const isSelected = idx === 3;
          return `<g>
            <rect x="${boxX}" y="${boxY}" width="144" height="148" rx="8" fill="${isSelected ? '#31164F' : '#120820'}" stroke="${isSelected ? '#FFE394' : '#7A5E29'}" stroke-width="${isSelected ? '2.4' : '1.2'}"/>
            <text x="${boxX + 72}" y="${boxY + 138}" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12" font-weight="700" letter-spacing="1.5" fill="${isSelected ? '#FFE394' : '#D4C2E8'}">${p.label}</text>
          </g>`;
        })
        .join('\n')}

      <rect x="1262" y="176" width="602" height="850" rx="12" fill="url(#panelBg)" stroke="#D4AF37" stroke-width="2"/>
      <text x="1563" y="220" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="21" font-weight="700" letter-spacing="2.2" fill="#FFF3D1">ATTRIBUTES · SKILLS · RELICS</text>

      <rect x="1292" y="244" width="542" height="156" rx="8" fill="#120820" stroke="#8C6D23" stroke-width="1.2"/>
      <text x="1316" y="280" font-family="Cinzel, Georgia, serif" font-size="16" font-weight="700" fill="#EAD08A">LEVEL 40 / 40   ·   ASCENSION TIER IV</text>
      <text x="1316" y="318" font-family="Georgia, serif" font-size="18" fill="#F2E8FA">HP: <tspan fill="#7CE89B" font-weight="bold">4,820</tspan>     ATK: <tspan fill="#FFB870" font-weight="bold">640</tspan>     DEF: <tspan fill="#8CC8FF" font-weight="bold">410</tspan></text>
      <text x="1316" y="354" font-family="Georgia, serif" font-size="18" fill="#F2E8FA">SPD: <tspan fill="#FFE394" font-weight="bold">118</tspan>       CRIT: <tspan fill="#FF8CA8" font-weight="bold">24%</tspan>     VEIL RES: <tspan fill="#D59BFF" font-weight="bold">38%</tspan></text>
      <text x="1316" y="384" font-family="Georgia, serif" font-size="15" font-style="italic" fill="#B9A6CC">Passive — A Smile Kept: Below 50% HP, grants all allies +8% Veil RES.</text>

      <g transform="translate(1292, 420)">
        <rect x="0" y="0" width="542" height="106" rx="8" fill="#1B0D2E" stroke="#D4AF37" stroke-width="1.4"/>
        <text x="22" y="34" font-family="Cinzel, Georgia, serif" font-size="17" font-weight="700" fill="#FFF3D1">BASIC · VEILGLASS THORN</text>
        <text x="22" y="62" font-family="Georgia, serif" font-size="15.5" fill="#DDD0E8">Deals 110% ATK Veil damage to one enemy and generates +20 Focus.</text>
        <text x="22" y="88" font-family="Cinzel, Georgia, serif" font-size="12.5" fill="#E6C77B">NO COOLDOWN  ·  SINGLE TARGET</text>
      </g>

      <g transform="translate(1292, 542)">
        <rect x="0" y="0" width="542" height="106" rx="8" fill="#1B0D2E" stroke="#D4AF37" stroke-width="1.4"/>
        <text x="22" y="34" font-family="Cinzel, Georgia, serif" font-size="17" font-weight="700" fill="#FFF3D1">SKILL · BORROWED HOUR</text>
        <text x="22" y="62" font-family="Georgia, serif" font-size="15.5" fill="#DDD0E8">Advances ally Turn Order by 25% and grants a Veil Barrier for 2 turns.</text>
        <text x="22" y="88" font-family="Cinzel, Georgia, serif" font-size="12.5" fill="#E6C77B">3-TURN COOLDOWN  ·  TACTICAL SUPPORT</text>
      </g>

      <g transform="translate(1292, 664)">
        <rect x="0" y="0" width="542" height="114" rx="8" fill="#2A1245" stroke="#FFE394" stroke-width="1.8"/>
        <text x="22" y="34" font-family="Cinzel, Georgia, serif" font-size="17" font-weight="700" fill="#FFE394">ULTIMATE · THE BELL THAT FORGETS</text>
        <text x="22" y="62" font-family="Georgia, serif" font-size="15.5" fill="#F4EAFB">Rings the fractured sanctuary bell, dealing 185% AoE Veil DMG &amp; Silence.</text>
        <text x="22" y="92" font-family="Cinzel, Georgia, serif" font-size="12.5" fill="#FF94B2">100 FOCUS  ·  ALL ENEMIES  ·  CINEMATIC CUT-IN</text>
      </g>

      <g transform="translate(1292, 796)">
        <rect x="0" y="0" width="542" height="134" rx="8" fill="#140923" stroke="#D4AF37" stroke-width="1.6"/>
        <text x="22" y="34" font-family="Cinzel, Georgia, serif" font-size="16.5" font-weight="700" fill="#EAD08A">SIGNATURE RELIC · THE BROKEN BELL (5★)</text>
        <text x="22" y="64" font-family="Georgia, serif" font-size="15.5" fill="#DDD0E8">+18% Effect Hit &amp; +15 Starting Focus. Ultimate hits delay target SPD.</text>
        <rect x="22" y="82" width="236" height="36" rx="18" fill="#381857" stroke="#D4AF37" stroke-width="1.2"/>
        <text x="140" y="105" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" fill="#FFF3D1">ASCEND &amp; ATTUNE RELIC</text>
      </g>
    </svg>`);

    const portraitFooterSvg = Buffer.from(`<svg width="490" height="70" viewBox="0 0 490 70" xmlns="http://www.w3.org/2000/svg">
      <rect x="25" y="12" width="440" height="42" rx="21" fill="#180B29" fill-opacity="0.92" stroke="#D4AF37" stroke-width="1.5"/>
      <text x="245" y="38" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12.5" font-weight="700" letter-spacing="1.4" fill="#FFE394">CANONICAL KNEE-UP PORTRAIT  ·  4 EXPRESSIONS</text>
    </svg>`);

    const ribbon06 = buildEditorialRibbonSvg({
      badge: 'CHARACTER PROGRESSION & INTERACTIVE CHIBI VIEWER',
      headline: '8 ARTICULATED COMBAT POSES · RELICS & SKILLS',
      subtitle:
        'Inspect canonical full-body portraits, preview all 8 combat animations, and customize relic loadouts.',
      position: 'top',
    });

    const out06 = path.join(STORE_SCREENSHOTS, '06_character_sheet.png');
    await sharp(bg06)
      .composite([
        { input: uiPanelsSvg, left: 0, top: 0 },
        { input: fadymeFullBody, left: 66, top: 264 },
        { input: portraitFooterSvg, left: 56, top: 950 },
        {
          input: mainChibiSkill,
          left: Math.round(904 - (mainMeta.width ?? 260) / 2),
          top: Math.round(555 - (mainMeta.height ?? 250)),
        },
        ...miniPoses.map((p) => ({ input: p.buf, left: p.left, top: p.top })),
        { input: ribbon06, left: 0, top: 0 },
      ])
      .flatten({ background: '#07040C' })
      .png({ compressionLevel: 9 })
      .toFile(out06);
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.copyFileSync(out06, path.join(ARTIFACT_DIR, '06_character_sheet.png'));
    }
    console.log('✓ 06_character_sheet.png');
  }

  // ---------------------------------------------------------------------------
  // 07: BOSS OBJECTIVES — SHATTER BOSS RELIQUARIES · TURN THE TIDE
  // ---------------------------------------------------------------------------
  {
    const battleStageBg = await sharp(
      path.join(ROOT, 'content/approved_art/art/bg_forgotten_stone_crossing.webp'),
    )
      .resize(1920, 1080, { fit: 'cover' })
      .modulate({ brightness: 0.72, saturation: 0.95 })
      .png()
      .toBuffer();

    const partyDefs = [
      { name: 'SISTER AVELINE', atlas: 'atlas_sister_aveline', pose: 'idle', x: 235, y: 420, hp: 1.0, focus: 0.65 },
      { name: 'FADYME', atlas: 'atlas_fadyme', pose: 'active', x: 285, y: 675, hp: 0.92, focus: 1.0 },
      { name: 'SABLE WREN', atlas: 'atlas_sable_wren', pose: 'basic', x: 535, y: 425, hp: 0.88, focus: 0.55 },
      { name: 'MAHMUT', atlas: 'atlas_mahmut', pose: 'idle', x: 605, y: 685, hp: 0.95, focus: 0.80 },
    ];

    const partyComposites = [];
    const partyPlateSvgParts = [];

    for (const p of partyDefs) {
      const spriteBuf = await extractAtlasFrame(p.atlas, p.pose, 175, 185);
      const sMeta = await sharp(spriteBuf).metadata();
      const sw = sMeta.width ?? 150;
      const sh = sMeta.height ?? 160;
      partyComposites.push({
        input: spriteBuf,
        left: Math.round(p.x - sw / 2),
        top: Math.round(p.y - sh),
      });

      partyPlateSvgParts.push(`
        <g transform="translate(${p.x}, ${p.y})">
          <ellipse cx="0" cy="-6" rx="64" ry="16" fill="#101828" fill-opacity="0.78" stroke="#68B5E8" stroke-width="1.8"/>
          <rect x="-92" y="8" width="184" height="44" rx="14" fill="#0B0914" fill-opacity="0.92" stroke="#5A769A" stroke-width="1.4"/>
          <text x="0" y="24" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="11.5" font-weight="700" letter-spacing="1" fill="#FFF6DC">${p.name}</text>
          <rect x="-74" y="30" width="148" height="8" rx="4" fill="#1A2436"/>
          <rect x="-73" y="31" width="${Math.round(146 * p.hp)}" height="6" rx="3" fill="#7CE89B"/>
          <rect x="-58" y="41" width="116" height="5" rx="2.5" fill="#1A162B"/>
          <rect x="-57" y="42" width="${Math.round(114 * p.focus)}" height="3" rx="1.5" fill="#D4AF37"/>
        </g>
      `);
    }

    const objReliquary = await extractAtlasFrame(
      'atlas_objective',
      'altar_pylon_intact',
      215,
      215,
    );
    const objMeta = await sharp(objReliquary).metadata();

    const bossChibi = await extractAtlasFrame(
      'atlas_boss_ashen_lord_wraith',
      'active',
      300,
      310,
    );
    const bossMeta = await sharp(bossChibi).metadata();

    const bossOverlaySvg = Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="objPulse" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FF477E" stop-opacity="0.48"/>
          <stop offset="65%" stop-color="#D4AF37" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="bossAura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#9A36D9" stop-opacity="0.48"/>
          <stop offset="70%" stop-color="#1E0B30" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>

      ${partyPlateSvgParts.join('\n')}

      <circle cx="1060" cy="475" r="126" fill="url(#objPulse)"/>
      <circle cx="1060" cy="475" r="96" fill="none" stroke="#FFE394" stroke-width="2.5" stroke-dasharray="10 8"/>
      <ellipse cx="1060" cy="566" rx="88" ry="22" fill="#2A0D2E" stroke="#FF5E8E" stroke-width="2.5"/>
      <polygon points="1060,348 1074,322 1046,322" fill="#FFE394" stroke="#08040E" stroke-width="2"/>

      <g transform="translate(840, 598)">
        <rect x="0" y="0" width="440" height="90" rx="8" fill="#160824" fill-opacity="0.96" stroke="#FFE394" stroke-width="2"/>
        <text x="220" y="26" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="14.5" font-weight="700" letter-spacing="1.5" fill="#FFE394">BREAKABLE OBJECTIVE · ECLIPSE PYLON</text>
        <rect x="32" y="38" width="376" height="12" rx="6" fill="#2B1228" stroke="#8C6D23" stroke-width="1"/>
        <rect x="33" y="39" width="218" height="10" rx="5" fill="#FF4D79"/>
        <text x="220" y="73" text-anchor="middle" font-family="Georgia, serif" font-size="14.5" font-style="italic" fill="#F2D9E6">Break Effect: Shatters Boss Shield &amp; Stuns for 1 Turn!</text>
      </g>

      <circle cx="1565" cy="455" r="148" fill="url(#bossAura)"/>
      <ellipse cx="1565" cy="576" rx="112" ry="26" fill="#1C071B" stroke="#FF5E8E" stroke-width="2.5"/>

      <g transform="translate(1375, 608)">
        <rect x="0" y="0" width="380" height="84" rx="8" fill="#1C071B" fill-opacity="0.96" stroke="#FF5E8E" stroke-width="2"/>
        <text x="190" y="26" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="15.5" font-weight="700" letter-spacing="1.5" fill="#FF94B2">BOSS · ASHEN LORD WRAITH</text>
        <rect x="28" y="36" width="324" height="12" rx="6" fill="#2B1228"/>
        <rect x="29" y="37" width="276" height="10" rx="5" fill="#E03E6D"/>
        <text x="190" y="68" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12.5" fill="#FFE394">▶ INTENT: ECLIPSE REQUIEM (AOE)</text>
      </g>

      <g transform="translate(272, 774)">
        <rect x="0" y="0" width="1376" height="68" rx="8" fill="#0B0613" fill-opacity="0.92" stroke="#8C6D23" stroke-width="1.4"/>
        <text x="688" y="28" text-anchor="middle" font-family="Georgia, serif" font-size="17" fill="#EAE0F5">Passive — A Smile Kept: Attacks against Breakable Objectives deal +35% Bonus Shatter DMG &amp; grant +15 Focus.</text>
        <text x="688" y="52" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" letter-spacing="1.8" fill="#E6C77B">ACTIVE TURN: FADYME  ·  TARGETING: ECLIPSE PYLON (RELIQUARY OBJECTIVE)</text>
      </g>

      <g transform="translate(472, 862)">
        <rect x="0" y="0" width="976" height="106" rx="10" fill="#090510" fill-opacity="0.94" stroke="#7A5E29" stroke-width="1.5"/>

        <g transform="translate(24, 13)">
          <rect x="0" y="0" width="286" height="80" rx="8" fill="#170C28" stroke="#D4AF37" stroke-width="1.6"/>
          <text x="143" y="36" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="18" font-weight="700" fill="#FFF3D1">VEILGLASS THORN</text>
          <text x="143" y="60" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" letter-spacing="1.8" fill="#C9B8DC">BASIC  ·  +20 FOCUS</text>
        </g>

        <g transform="translate(345, 13)">
          <rect x="0" y="0" width="286" height="80" rx="8" fill="#1E0E36" stroke="#D4AF37" stroke-width="1.8"/>
          <text x="143" y="36" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="18" font-weight="700" fill="#FFF3D1">BORROWED HOUR</text>
          <text x="143" y="60" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" letter-spacing="1.8" fill="#E6C77B">SKILL  ·  READY</text>
        </g>

        <g transform="translate(666, 13)">
          <rect x="0" y="0" width="286" height="80" rx="8" fill="#381657" stroke="#FFE394" stroke-width="2.4"/>
          <text x="143" y="36" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="16.5" font-weight="700" fill="#FFF6DC">BELL THAT FORGETS</text>
          <text x="143" y="60" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" letter-spacing="1.8" fill="#FFE394">ULTIMATE  ·  100/100 FOCUS</text>
        </g>
      </g>
    </svg>`);

    const ribbon07 = buildEditorialRibbonSvg({
      badge: 'TACTICAL BOSS ENCOUNTERS & BREAKABLE OBJECTIVES',
      headline: 'SHATTER BOSS RELIQUARIES · TURN THE TIDE',
      subtitle:
        'Destroy cursed bells, sanctum censers & eclipse pylons mid-battle to collapse boss defenses.',
      position: 'top',
    });

    const out07 = path.join(STORE_SCREENSHOTS, '07_boss_objectives.png');
    await sharp(battleStageBg)
      .composite([
        { input: bossOverlaySvg, left: 0, top: 0 },
        ...partyComposites,
        {
          input: objReliquary,
          left: Math.round(1060 - (objMeta.width ?? 200) / 2),
          top: Math.round(568 - (objMeta.height ?? 200)),
        },
        {
          input: bossChibi,
          left: Math.round(1565 - (bossMeta.width ?? 260) / 2),
          top: Math.round(580 - (bossMeta.height ?? 260)),
        },
        { input: ribbon07, left: 0, top: 0 },
      ])
      .flatten({ background: '#07040C' })
      .png({ compressionLevel: 9 })
      .toFile(out07);
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.copyFileSync(out07, path.join(ARTIFACT_DIR, '07_boss_objectives.png'));
    }
    console.log('✓ 07_boss_objectives.png');
  }

  // ---------------------------------------------------------------------------
  // 08: TRIALS & FAIR SUMMON — ENDLESS CORRIDOR · ARENA · TRANSPARENT PITY
  // Built 100% from canonical assets (no pre-fix e2e screenshot crops)
  // ---------------------------------------------------------------------------
  {
    const bg08 = await sharp(
      path.join(ROOT, 'content/approved_art/art/bg_altar_first_eclipse.webp'),
    )
      .resize(1920, 1080, { fit: 'cover' })
      .modulate({ brightness: 0.45 })
      .png()
      .toBuffer();

    const bossConstruct = await extractAtlasFrame('atlas_boss_eclipse_construct', 'idle', 210, 210);
    const bossMalakor = await extractAtlasFrame('atlas_boss_marshal_oren', 'idle', 195, 195);
    const bossVerdigris = await extractAtlasFrame('atlas_boss_red_vial_matron', 'idle', 195, 195);

    const invokeHeroes = [
      { name: 'CORBIN LOCKE', stars: '5★', path: 'content/approved_art/art/portrait_corbin_locke_composed.webp' },
      { name: 'CASSIAN THORNE', stars: '5★', path: 'content/approved_art/art/portrait_cassian_thorne_composed.webp' },
      { name: 'DORIAN KESK', stars: '5★', path: 'content/approved_art/art/portrait_dorian_kesk_composed.webp' },
      { name: 'GARRICK CINDER', stars: '4★', path: 'content/approved_art/art/portrait_garrick_cinder_composed.webp' },
      { name: 'ROWAN REED', stars: '4★', path: 'content/approved_art/art/portrait_rowan_reed_composed.webp' },
    ];

    const invokeComposites = [];
    for (let i = 0; i < invokeHeroes.length; i++) {
      const h = invokeHeroes[i];
      const pBuf = await extractCanonicalPortrait(path.join(ROOT, h.path), 146, 250, 'cover');
      invokeComposites.push({
        input: pBuf,
        left: 1004 + i * 164,
        top: 560,
      });
    }

    const bannerAveline = await sharp(
      path.join(ROOT, 'narrative/15_Art_Workbench/banners/banner_oath_01_aveline_v001.jpg'),
    )
      .resize(406, 218, { fit: 'cover' })
      .png()
      .toBuffer();

    const bannerVespera = await sharp(
      path.join(ROOT, 'narrative/15_Art_Workbench/banners/banner_oath_05_vespera_v001.jpg'),
    )
      .resize(406, 218, { fit: 'cover' })
      .png()
      .toBuffer();

    const frame08Svg = Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="card08" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#150B25" stop-opacity="0.95"/>
          <stop offset="100%" stop-color="#090411" stop-opacity="0.97"/>
        </linearGradient>
      </defs>

      <!-- Left Card: Endgame Tactical Trials -->
      <rect x="56" y="176" width="888" height="850" rx="12" fill="url(#card08)" stroke="#D4AF37" stroke-width="2.2"/>
      <text x="500" y="224" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="24" font-weight="700" letter-spacing="2" fill="#FFF3D1">ENDGAME TRIALS · ARENA &amp; ENDLESS CORRIDOR</text>
      <text x="500" y="254" text-anchor="middle" font-family="Georgia, serif" font-size="16.5" font-style="italic" fill="#E6C77B">Server-verified tactical challenges with seasonal Bell's Remains rewards</text>

      <!-- 3 Boss Floor Showcase Cards inside Left Panel -->
      <rect x="84" y="280" width="260" height="390" rx="10" fill="#10081C" stroke="#8C6D23" stroke-width="1.6"/>
      <text x="214" y="314" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="14" font-weight="700" fill="#EAD08A">CORRIDOR FLOOR 15</text>
      <text x="214" y="592" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="15" font-weight="700" fill="#FFF6DC">RED VIAL MATRON</text>
      <text x="214" y="618" text-anchor="middle" font-family="Georgia, serif" font-size="13.5" fill="#C9B8DC">Venom Mist  ·  +120 Bell's Remains</text>
      <rect x="124" y="630" width="180" height="28" rx="14" fill="#2A1344" stroke="#D4AF37" stroke-width="1"/>
      <text x="214" y="649" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="11.5" font-weight="700" fill="#FFE394">CLEARED 3★</text>

      <rect x="370" y="280" width="260" height="390" rx="10" fill="#1A0C2E" stroke="#FFE394" stroke-width="2.2"/>
      <text x="500" y="314" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="14" font-weight="700" fill="#FFE394">CORRIDOR FLOOR 25</text>
      <text x="500" y="592" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="15" font-weight="700" fill="#FFF6DC">ECLIPSE CONSTRUCT</text>
      <text x="500" y="618" text-anchor="middle" font-family="Georgia, serif" font-size="13.5" fill="#EADBF8">Blood Moon  ·  +250 Bell's Remains</text>
      <rect x="410" y="630" width="180" height="28" rx="14" fill="#3C1659" stroke="#FFE394" stroke-width="1.5"/>
      <text x="500" y="649" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="11.5" font-weight="700" fill="#FFF6DC">CHALLENGE NOW</text>

      <rect x="656" y="280" width="260" height="390" rx="10" fill="#10081C" stroke="#8C6D23" stroke-width="1.6"/>
      <text x="786" y="314" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="14" font-weight="700" fill="#EAD08A">IRON-CHAIN TRIAL</text>
      <text x="786" y="592" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="15" font-weight="700" fill="#FFF6DC">MARSHAL OREN</text>
      <text x="786" y="618" text-anchor="middle" font-family="Georgia, serif" font-size="13.5" fill="#C9B8DC">Iron Bulwark  ·  5★ Relic Shard</text>
      <rect x="696" y="630" width="180" height="28" rx="14" fill="#180D29" stroke="#7A5E29" stroke-width="1"/>
      <text x="786" y="649" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="11.5" font-weight="700" fill="#D4C2E8">UNLOCKED</text>

      <!-- Trials Feature Pills -->
      <rect x="84" y="704" width="832" height="136" rx="10" fill="#1B0E2E" stroke="#D4AF37" stroke-width="1.4"/>
      <text x="500" y="746" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="18" font-weight="700" fill="#FFE394">BLOOD MOON MUTATORS  ·  5-MATCH DAILY ARENA  ·  ZERO PAYWALLS</text>
      <text x="500" y="782" text-anchor="middle" font-family="Georgia, serif" font-size="16" fill="#DDD0E8">Climb from Iron Bell to Eclipse Sovereign and earn Torn Chronicle Pages &amp; Relics.</text>
      <text x="500" y="816" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13.5" letter-spacing="2" fill="#C98BFF">DETERMINISTIC COMBAT ENGINE · VERIFIED REPLAYS</text>

      <rect x="190" y="868" width="620" height="118" rx="10" fill="#120820" stroke="#7A5E29" stroke-width="1.4"/>
      <text x="500" y="914" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="18" font-weight="700" fill="#FFF3D1">SWEEP &amp; AUTO-BATTLE UNLOCKED</text>
      <text x="500" y="952" text-anchor="middle" font-family="Georgia, serif" font-size="16" font-style="italic" fill="#B9A6CC">Respects your time — instant clears &amp; offline rewards after 3★ mastery.</text>

      <!-- Right Card: Hall of Ancestors & Fair Invocation Rules -->
      <rect x="976" y="176" width="888" height="850" rx="12" fill="url(#card08)" stroke="#D4AF37" stroke-width="2.2"/>
      <text x="1420" y="224" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="24" font-weight="700" letter-spacing="2" fill="#FFF3D1">HALL OF ANCESTORS · FAIR INVOCATIONS</text>
      <text x="1420" y="254" text-anchor="middle" font-family="Georgia, serif" font-size="16.5" font-style="italic" fill="#E6C77B">Transparent 80-Pull 5★ Pity · Shared Earnable Bell's Remains Currency</text>

      <rect x="996" y="276" width="410" height="222" rx="8" fill="#08040E" stroke="#D4AF37" stroke-width="1.8"/>
      <rect x="1434" y="276" width="410" height="222" rx="8" fill="#08040E" stroke="#D4AF37" stroke-width="1.8"/>

      <text x="1420" y="536" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="15.5" font-weight="700" letter-spacing="2" fill="#FFE394">10x OATH INVOCATION PREVIEW · GUARANTEED 4★+ COMPANION</text>

      ${invokeHeroes
        .map((h, i) => {
          const cx = 1000 + i * 164;
          const is5 = h.stars === '5★';
          return `<g transform="translate(${cx}, 556)">
            <rect x="0" y="0" width="154" height="310" rx="8" fill="#140924" stroke="${is5 ? '#FFE394' : '#8C6D23'}" stroke-width="${is5 ? 2.2 : 1.4}"/>
            <rect x="4" y="254" width="146" height="52" rx="6" fill="#0B0514"/>
            <text x="77" y="276" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="11.5" font-weight="700" fill="#FFF6DC">${h.name}</text>
            <text x="77" y="296" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12" font-weight="700" fill="${is5 ? '#FFE394' : '#C9B8DC'}">${h.stars} COMPANION</text>
          </g>`;
        })
        .join('\n')}

      <rect x="1000" y="892" width="840" height="102" rx="10" fill="#23103B" stroke="#FFE394" stroke-width="1.6"/>
      <text x="1420" y="934" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="17.5" font-weight="700" letter-spacing="1.5" fill="#FFE394">PLAYER-FIRST MONETIZATION PROMISE</text>
      <text x="1420" y="968" text-anchor="middle" font-family="Georgia, serif" font-size="15.5" fill="#F2E8FA">No mandatory duplicate walls · Full odds &amp; pull history disclosed in-game.</text>
    </svg>`);

    const ribbon08 = buildEditorialRibbonSvg({
      badge: 'ENDGAME MODES & FAIR INVOCATIONS',
      headline: 'ENDLESS CORRIDOR · ARENA · TRANSPARENT PITY',
      subtitle:
        'Test your tactics in the Endless Corridor and summon heroes with honest, player-friendly rules.',
      position: 'top',
    });

    const out08 = path.join(STORE_SCREENSHOTS, '08_trials_and_summon.png');
    await sharp(bg08)
      .composite([
        { input: frame08Svg, left: 0, top: 0 },
        { input: bossVerdigris, left: 118, top: 355 },
        { input: bossConstruct, left: 396, top: 345 },
        { input: bossMalakor, left: 690, top: 355 },
        { input: bannerAveline, left: 998, top: 278 },
        { input: bannerVespera, left: 1436, top: 278 },
        ...invokeComposites,
        { input: ribbon08, left: 0, top: 0 },
      ])
      .flatten({ background: '#07040C' })
      .png({ compressionLevel: 9 })
      .toFile(out08);
    if (fs.existsSync(ARTIFACT_DIR)) {
      fs.copyFileSync(out08, path.join(ARTIFACT_DIR, '08_trials_and_summon.png'));
    }
    console.log('✓ 08_trials_and_summon.png');
  }
}

async function main() {
  ensureDir(STORE_ASSETS);
  ensureDir(STORE_SCREENSHOTS);
  ensureDir(BRAND_DIR);

  await syncWorkbenchFadymePortraits();
  await buildMasterAndCompactLogos();
  await buildAppIconAndMipmaps();
  await buildAndroidSplashScreens();
  await buildFeatureGraphic();
  await buildShowcaseScreenshots();
  console.log('\nALL CANONICAL STORE, BRAND, LAUNCHER & SPLASH ASSETS BUILT SUCCESSFULLY!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
