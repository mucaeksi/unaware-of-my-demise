#!/usr/bin/env node
/* global console */
/**
 * Deterministically composes the 5 missing canonical 1376x768 banner key-art masters in
 * `narrative/15_Art_Workbench/banners/` from locked approved portraits, weapon details, and
 * chapter backgrounds ($0.00 cost), completing all 16 banner masters required by `tools/seed_banners.ts`.
 */
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'narrative/15_Art_Workbench/banners');
const W = 1376;
const H = 768;

function makeBackdropOverlaySvg({ glowColor, glowSecondary, accentRingColor, sparksColor, weaponHalos = false }) {
  const sparks = Array.from({ length: 32 }, (_, i) => {
    const cx = 540 + ((i * 137) % 780);
    const cy = 60 + ((i * 193) % 640);
    const r = 1.6 + (i % 4) * 1.1;
    const op = (0.35 + (i % 5) * 0.13).toFixed(2);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${sparksColor}" opacity="${op}"/>`;
  }).join('\n');

  const ringSvg = weaponHalos
    ? `<g transform="translate(930, 384)" opacity="0.92">
        <circle cx="0" cy="0" r="245" fill="#090610" fill-opacity="0.58" stroke="${accentRingColor}" stroke-width="3.5"/>
        <circle cx="0" cy="0" r="224" fill="none" stroke="${glowColor}" stroke-width="2" stroke-dasharray="14 8" opacity="0.85"/>
        <circle cx="0" cy="0" r="196" fill="none" stroke="${accentRingColor}" stroke-width="2.5" opacity="0.9"/>
        <polygon points="0,-264 14,-236 0,-208 -14,-236" fill="${accentRingColor}" opacity="0.9"/>
        <polygon points="0,264 14,236 0,208 -14,236" fill="${accentRingColor}" opacity="0.9"/>
        <polygon points="-264,0 -236,14 -208,0 -236,-14" fill="${accentRingColor}" opacity="0.9"/>
        <polygon points="264,0 236,14 208,0 236,-14" fill="${accentRingColor}" opacity="0.9"/>
      </g>`
    : `<g transform="translate(930, 390)" opacity="0.72">
        <circle cx="0" cy="0" r="290" fill="none" stroke="${accentRingColor}" stroke-width="2.2" stroke-dasharray="18 10" opacity="0.58"/>
        <circle cx="0" cy="0" r="248" fill="none" stroke="${glowColor}" stroke-width="1.5" opacity="0.48"/>
      </g>`;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="leftShade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#07040c" stop-opacity="0.84"/>
        <stop offset="38%" stop-color="#0b0713" stop-opacity="0.54"/>
        <stop offset="68%" stop-color="#0b0713" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#07040c" stop-opacity="0.46"/>
      </linearGradient>
      <radialGradient id="focalGlow" cx="68%" cy="50%" r="46%">
        <stop offset="0%" stop-color="${glowColor}" stop-opacity="0.62"/>
        <stop offset="45%" stop-color="${glowSecondary}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#07040c" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="bottomVignette" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#050208" stop-opacity="0.35"/>
        <stop offset="20%" stop-color="#050208" stop-opacity="0"/>
        <stop offset="76%" stop-color="#050208" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#050208" stop-opacity="0.78"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#leftShade)"/>
    <rect width="${W}" height="${H}" fill="url(#focalGlow)"/>
    ${ringSvg}
    ${sparks}
    <rect width="${W}" height="${H}" fill="url(#bottomVignette)"/>
  </svg>`);
}

async function preparePortrait(absPath, targetHeight) {
  const meta = await sharp(absPath).metadata();
  const cropH = Math.min(meta.height ?? 1152, Math.round((meta.height ?? 1152) * 0.82));
  return sharp(absPath)
    .extract({ left: 0, top: 0, width: meta.width ?? 768, height: cropH })
    .resize({ height: targetHeight, fit: 'inside', kernel: 'lanczos3' })
    .png()
    .toBuffer();
}

/** Extracts the circular interior of a 256x256 weapon tile (excluding the square frame and 5-star row) and scales to diameter. */
async function prepareCircularMedallion(absPath, diameter, borderColor) {
  const scaled = await sharp(absPath)
    .extract({ left: 34, top: 26, width: 188, height: 188 })
    .resize(diameter, diameter, { fit: 'cover', kernel: 'lanczos3' })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const r = diameter / 2;
  for (let y = 0; y < diameter; y++) {
    for (let x = 0; x < diameter; x++) {
      const dist = Math.hypot(x - r + 0.5, y - r + 0.5);
      const idx = (y * diameter + x) * 4;
      if (dist > r - 2) {
        scaled[idx + 3] = 0;
      } else if (dist > r - 8) {
        const t = (r - 2 - dist) / 6;
        scaled[idx + 3] = Math.round(scaled[idx + 3] * t);
      }
    }
  }
  const ringSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}">
      <circle cx="${r}" cy="${r}" r="${r - 4}" fill="none" stroke="${borderColor}" stroke-width="5"/>
      <circle cx="${r}" cy="${r}" r="${r - 12}" fill="none" stroke="#ffffff" stroke-opacity="0.38" stroke-width="1.5"/>
    </svg>`,
  );
  return sharp(scaled, { raw: { width: diameter, height: diameter, channels: 4 } })
    .composite([{ input: ringSvg, left: 0, top: 0 }])
    .png()
    .toBuffer();
}

async function buildHallOfAncestors() {
  const bgPath = path.join(ROOT, 'narrative/15_Art_Workbench/ui_screens/ui_gacha_summon_altar_v001.jpg');
  const mahmutPath = path.join(ROOT, 'content/approved_art/art/portrait_mahmut_composed.webp');
  const fadymePath = path.join(ROOT, 'content/approved_art/art/portrait_fadyme_composed.webp');

  const mahmutBuf = await preparePortrait(mahmutPath, 710);
  const fadymeBuf = await preparePortrait(fadymePath, 690);

  const overlaySvg = makeBackdropOverlaySvg({
    glowColor: '#f3c969',
    glowSecondary: '#7e48b8',
    accentRingColor: '#ffe29a',
    sparksColor: '#ffeaad',
    weaponHalos: false,
  });

  await sharp(bgPath)
    .resize(W, H, { fit: 'cover' })
    .composite([
      { input: overlaySvg, left: 0, top: 0 },
      { input: mahmutBuf, left: 485, top: 58 },
      { input: fadymeBuf, left: 805, top: 78 },
    ])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(path.join(OUT_DIR, 'banner_hall_of_ancestors_v001.jpg'));
}

async function buildCharacterOathBanner({ bgRel, portraitRel, outFile, glowColor, glowSecondary, accentRingColor, sparksColor }) {
  const bgPath = path.join(ROOT, bgRel);
  const portraitPath = path.join(ROOT, portraitRel);
  const portraitBuf = await preparePortrait(portraitPath, 748);
  const overlaySvg = makeBackdropOverlaySvg({
    glowColor,
    glowSecondary,
    accentRingColor,
    sparksColor,
    weaponHalos: false,
  });

  await sharp(bgPath)
    .resize(W, H, { fit: 'cover' })
    .modulate({ brightness: 0.82, saturation: 1.08 })
    .composite([
      { input: overlaySvg, left: 0, top: 0 },
      { input: portraitBuf, left: 635, top: 20 },
    ])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(path.join(OUT_DIR, outFile));
}

async function buildWeaponBanner({
  bgRel,
  tileRel,
  outFile,
  glowColor,
  glowSecondary,
  accentRingColor,
  sparksColor,
}) {
  const bgPath = path.join(ROOT, bgRel);
  const medallion = await prepareCircularMedallion(path.join(ROOT, tileRel), 380, accentRingColor);

  const overlaySvg = makeBackdropOverlaySvg({
    glowColor,
    glowSecondary,
    accentRingColor,
    sparksColor,
    weaponHalos: true,
  });

  await sharp(bgPath)
    .resize(W, H, { fit: 'cover' })
    .modulate({ brightness: 0.76, saturation: 1.08 })
    .composite([
      { input: overlaySvg, left: 0, top: 0 },
      { input: medallion, left: 740, top: 194 },
    ])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(path.join(OUT_DIR, outFile));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await buildHallOfAncestors();
  await buildCharacterOathBanner({
    bgRel: 'content/approved_art/art/bg_oakhaven_forge.webp',
    portraitRel: 'content/approved_art/art/portrait_garrick_cinder_composed.webp',
    outFile: 'banner_oath_06_garrick_v001.jpg',
    glowColor: '#ff7b39',
    glowSecondary: '#b8332a',
    accentRingColor: '#ffcf7d',
    sparksColor: '#ffb36b',
  });
  await buildCharacterOathBanner({
    bgRel: 'content/approved_art/art/bg_undercity_cistern_stairs.webp',
    portraitRel: 'content/approved_art/art/portrait_corbin_locke_composed.webp',
    outFile: 'banner_oath_07_corbin_v001.jpg',
    glowColor: '#5ec2d6',
    glowSecondary: '#4c3a88',
    accentRingColor: '#b7e6f5',
    sparksColor: '#9be7ff',
  });
  await buildWeaponBanner({
    bgRel: 'content/approved_art/art/bg_oakhaven_forge.webp',
    tileRel: 'narrative/15_Art_Workbench/icons/signature_weapons_tiles/16_sig_bridgewarden_hammer.png',
    portraitWeaponCrop: {
      rel: 'content/approved_art/art/portrait_garrick_cinder_composed.webp',
      box: { left: 60, top: 30, width: 250, height: 1020 },
      left: 560,
      top: 50,
    },
    outFile: 'banner_weapon_06_cinder_anvil_v001.jpg',
    glowColor: '#ff8a3d',
    glowSecondary: '#9c2b23',
    accentRingColor: '#ffd480',
    sparksColor: '#ffc278',
  });
  await buildWeaponBanner({
    bgRel: 'content/approved_art/art/bg_undercity_cistern_stairs.webp',
    tileRel: 'narrative/15_Art_Workbench/icons/signature_weapons_tiles/14_sig_seventh_chain_lantern.png',
    portraitWeaponCrop: {
      rel: 'content/approved_art/art/portrait_corbin_locke_composed.webp',
      box: { left: 480, top: 40, width: 260, height: 1080 },
      left: 1040,
      top: 44,
    },
    outFile: 'banner_weapon_07_locke_chain_v001.jpg',
    glowColor: '#7a63d9',
    glowSecondary: '#2d687a',
    accentRingColor: '#d0c2ff',
    sparksColor: '#e2d6ff',
  });
  console.log('5 missing banner masters generated in narrative/15_Art_Workbench/banners/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
