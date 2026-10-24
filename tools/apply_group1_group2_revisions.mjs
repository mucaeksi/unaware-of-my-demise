/* global console, process */
import { Buffer } from 'node:buffer';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const STORE_ASSETS = path.join(ROOT, 'docs/store/assets');
const STORE_SCREENSHOTS = path.join(STORE_ASSETS, 'screenshots');
const BRAND_DIR = path.join(
  ROOT,
  'narrative/15_Art_Workbench/ui_screens/production_v001/brand',
);
const ANDROID_RES = path.join(ROOT, 'apps/unity/Assets/Plugins/Android/res');
const WORKBENCH_CG_DIR = path.join(ROOT, 'narrative/15_Art_Workbench/cg');

const ART_MANIFEST_PATH = path.join(
  ROOT,
  'content/patches/rel_0003_part1_campaign/art/art_manifest.json',
);
const artManifest = JSON.parse(fs.readFileSync(ART_MANIFEST_PATH, 'utf8'));

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
 * 1. Weather & Darken Mahmut's overly bright peach/orange skin & armor glare
 * so he looks like a battle-worn 32-year-old veteran knight matching Fadyme's twilight palette.
 */
async function weatherMahmutImage(filePath, minXRatio = 0.0, isWebp = true) {
  if (!fs.existsSync(filePath)) return;
  const inputBuf = fs.readFileSync(filePath);
  const { data, info } = await sharp(inputBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const startX = Math.floor(w * minXRatio);

  for (let y = 0; y < h; y++) {
    for (let x = startX; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3];
      if (a < 16) continue;
      let r = data[idx];
      let g = data[idx + 1];
      let b = data[idx + 2];

      // Smooth continuous color grading (zero hard threshold edges on beard stubble!)
      const warmth = r - b;
      const wWarm = Math.max(0, Math.min(1, (warmth - 10) / 34));
      const wBright = Math.max(0, Math.min(1, (r - 68) / 70));
      const wNotPureRed = g >= b - 14 ? 1 : Math.max(0, 1 - (b - 14 - g) / 25);
      const skinWeight = wWarm * wBright * wNotPureRed;

      if (skinWeight > 0.01) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const darken = lum > 175 ? 0.75 : lum > 135 ? 0.80 : 0.85;
        const targetR = (r * 0.56 + lum * 0.44) * darken;
        const targetG = (g * 0.64 + lum * 0.36) * darken * 0.97;
        const targetB = (b * 0.74 + lum * 0.26) * darken * 1.05 + 5;
        r = Math.max(0, Math.min(255, Math.round(r * (1 - skinWeight) + targetR * skinWeight)));
        g = Math.max(0, Math.min(255, Math.round(g * (1 - skinWeight) + targetG * skinWeight)));
        b = Math.max(0, Math.min(255, Math.round(b * (1 - skinWeight) + targetB * skinWeight)));
      } else if (x > startX && r > 135 && g > 135 && b > 140 && Math.abs(r - g) < 22) {
        // Smoothly tone down overly bright silver armor glare on Mahmut's breastplate/pauldrons
        const glareW = Math.max(0, Math.min(1, (r - 135) / 50));
        r = Math.round(r * (1 - 0.18 * glareW));
        g = Math.round(g * (1 - 0.18 * glareW));
        b = Math.round(b * (1 - 0.14 * glareW));
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
    }
  }

  let pipeline = sharp(data, { raw: { width: w, height: h, channels: 4 } });
  const outBuf = isWebp
    ? await pipeline.webp({ quality: 92 }).toBuffer()
    : await pipeline.png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(filePath, outBuf);
}

async function runStep1WeatherMahmut() {
  console.log('Step 1: Weathering & darkening Mahmut across portraits, key art, title bg & stills...');
  // Restore clean copies from git first so running the script multiple times is 100% idempotent!
  execSync(
    'git checkout -- content/base/art/portrait_mahmut_*.webp content/base/art/ui_key_art.webp content/base/art/ui_title_bg.webp content/base/art/still_prologue_*.webp content/base/art/still_roadside_rest.webp content/base/art/still_shelter_evening.webp',
    { cwd: ROOT, stdio: 'ignore' },
  );
  const mahmutRelFiles = [
    { rel: 'content/base/art/portrait_mahmut_composed.webp', minX: 0.0 },
    { rel: 'content/base/art/portrait_mahmut_protective_resolve.webp', minX: 0.0 },
    { rel: 'content/base/art/portrait_mahmut_watchful.webp', minX: 0.0 },
    { rel: 'content/base/art/portrait_mahmut_dry_humor.webp', minX: 0.0 },
    { rel: 'content/base/art/ui_key_art.webp', minX: 0.52 },
    { rel: 'content/base/art/ui_title_bg.webp', minX: 0.72 },
    { rel: 'content/base/art/still_prologue_reunion.webp', minX: 0.52 },
    { rel: 'content/base/art/still_roadside_rest.webp', minX: 0.48 },
    { rel: 'content/base/art/still_shelter_evening.webp', minX: 0.56 },
  ];

  for (const item of mahmutRelFiles) {
    const basePath = path.join(ROOT, item.rel);
    await weatherMahmutImage(basePath, item.minX, true);
    const approvedPath = path.join(
      ROOT,
      item.rel.replace(/^content\/base\//, 'content/approved_art/'),
    );
    if (fs.existsSync(approvedPath)) {
      fs.copyFileSync(basePath, approvedPath);
    }
  }
  console.log('✓ Step 1 complete: Mahmut toned down & weathered across all base + approved_art files.');
}

/**
 * 2. Build Ornate Gothic Crest Logo (ui_logo.webp, logo_master.png, logo_compact.png)
 *    without "GOTHIC ANIME TACTICAL RPG", plus Fadyme + UOMD App Icon (icon_512.png)
 *    and redesigned Feature Graphic (feature_graphic_1024x500.png).
 */
function buildOrnateLogoSvg(width, height, includeTagline = false) {
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 1600 760" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="eclipseAura" cx="50%" cy="44%" r="42%">
        <stop offset="0%" stop-color="#D94B72" stop-opacity="0.48"/>
        <stop offset="42%" stop-color="#6A1E44" stop-opacity="0.28"/>
        <stop offset="78%" stop-color="#D4AF37" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="goldBevel" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFDF5"/>
        <stop offset="22%" stop-color="#F7E3AA"/>
        <stop offset="52%" stop-color="#D4A84F"/>
        <stop offset="78%" stop-color="#8F6320"/>
        <stop offset="100%" stop-color="#F2D283"/>
      </linearGradient>
      <linearGradient id="silverStone" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFBF2"/>
        <stop offset="30%" stop-color="#EFE2C6"/>
        <stop offset="68%" stop-color="#B8A17A"/>
        <stop offset="100%" stop-color="#6E583B"/>
      </linearGradient>
      <linearGradient id="crimsonRim" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FF8DA8"/>
        <stop offset="50%" stop-color="#C9385B"/>
        <stop offset="100%" stop-color="#591227"/>
      </linearGradient>
      <filter id="heavyShadow" x="-15%" y="-20%" width="130%" height="150%">
        <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#040208" flood-opacity="0.92"/>
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.95"/>
      </filter>
    </defs>

    <!-- Atmospheric Eclipse Glow -->
    <ellipse cx="800" cy="340" rx="610" ry="285" fill="url(#eclipseAura)"/>

    <!-- Black-Sun Eclipse Ring & Filigree Sunburst Behind Crest -->
    <g transform="translate(800, 290)" filter="url(#heavyShadow)">
      <circle cx="0" cy="0" r="218" fill="none" stroke="url(#goldBevel)" stroke-width="2.2" stroke-opacity="0.55" stroke-dasharray="10 8"/>
      <circle cx="0" cy="0" r="196" fill="#08040F" fill-opacity="0.82" stroke="url(#crimsonRim)" stroke-width="5.5"/>
      <circle cx="0" cy="0" r="186" fill="none" stroke="url(#goldBevel)" stroke-width="2.4" stroke-opacity="0.88"/>

      <!-- 8 Gothic Compass / Eclipse Spires -->
      <polygon points="0,-252 14,-196 0,-210 -14,-196" fill="url(#goldBevel)"/>
      <polygon points="0,252 14,196 0,210 -14,196" fill="url(#goldBevel)"/>
      <polygon points="-252,0 -196,14 -210,0 -196,-14" fill="url(#goldBevel)"/>
      <polygon points="252,0 196,14 210,0 196,-14" fill="url(#goldBevel)"/>
      <polygon points="-172,-172 -132,-142 -145,-145 -142,-132" fill="url(#goldBevel)"/>
      <polygon points="172,-172 132,-142 145,-145 142,-132" fill="url(#goldBevel)"/>
      <polygon points="-172,172 -132,142 -145,145 -142,132" fill="url(#goldBevel)"/>
      <polygon points="172,172 132,142 145,145 142,132" fill="url(#goldBevel)"/>

      <!-- Shattered Crown Finial at Top of Eclipse -->
      <path d="M-92,-182 L-68,-242 L-32,-204 L0,-264 L32,-204 L68,-242 L92,-182 Q0,-198 -92,-182 Z" fill="url(#goldBevel)" stroke="#160B24" stroke-width="3"/>
      <circle cx="0" cy="-272" r="7" fill="#FFF4D2"/>
      <circle cx="-68" cy="-248" r="5" fill="#FF8DA8"/>
      <circle cx="68" cy="-248" r="5" fill="#FF8DA8"/>
    </g>

    <!-- Ornate Gothic Filigree Side Wings -->
    <g filter="url(#heavyShadow)" stroke="url(#goldBevel)" stroke-width="2.5" fill="none" opacity="0.88">
      <path d="M 90,340 Q 210,275 340,320 Q 240,355 90,340 Z" fill="#1A0C2B"/>
      <path d="M 1510,340 Q 1390,275 1260,320 Q 1360,355 1510,340 Z" fill="#1A0C2B"/>
      <polygon points="56,340 94,326 84,340 94,354" fill="url(#goldBevel)" stroke="none"/>
      <polygon points="1544,340 1506,326 1516,340 1506,354" fill="url(#goldBevel)" stroke="none"/>
    </g>

    <!-- Main Sculpted Title: UNAWARE -->
    <g filter="url(#heavyShadow)">
      <text x="800" y="388" text-anchor="middle" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="212" font-weight="900" letter-spacing="12" fill="#090410" stroke="#090410" stroke-width="22" stroke-linejoin="round">UNAWARE</text>
      <text x="800" y="388" text-anchor="middle" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="212" font-weight="900" letter-spacing="12" fill="url(#silverStone)" stroke="url(#goldBevel)" stroke-width="4.5" stroke-linejoin="round">UNAWARE</text>
    </g>

    <!-- Fractured Sanctuary Bell & Sword-Needle Centerpiece -->
    <g transform="translate(800, 462)" filter="url(#heavyShadow)">
      <!-- Left & Right Double Filigree Rules -->
      <line x1="-680" y1="18" x2="-110" y2="18" stroke="url(#goldBevel)" stroke-width="4"/>
      <line x1="-620" y1="30" x2="-130" y2="30" stroke="url(#goldBevel)" stroke-width="1.6" stroke-opacity="0.75"/>
      <line x1="110" y1="18" x2="680" y2="18" stroke="url(#goldBevel)" stroke-width="4"/>
      <line x1="130" y1="30" x2="620" y2="30" stroke="url(#goldBevel)" stroke-width="1.6" stroke-opacity="0.75"/>

      <polygon points="-695,18 -675,10 -682,18 -675,26" fill="url(#goldBevel)"/>
      <polygon points="695,18 675,10 682,18 675,26" fill="url(#goldBevel)"/>

      <!-- Vertical Needle / Clapper Spire -->
      <polygon points="0,-58 9,20 0,248 -9,20" fill="url(#goldBevel)" stroke="#12081E" stroke-width="2"/>
      <!-- Sanctuary Bell Body -->
      <path d="M-54,18 L54,18 L40,-38 C36,-64 20,-80 0,-80 C-20,-80 -36,-64 -40,-38 Z" fill="url(#silverStone)" stroke="url(#goldBevel)" stroke-width="3.5"/>
      <ellipse cx="0" cy="18" rx="56" ry="11" fill="#1A0E29" stroke="url(#goldBevel)" stroke-width="3"/>
      <circle cx="0" cy="24" r="9" fill="#FFE6A3"/>
    </g>

    <!-- Secondary Title: OF MY DEMISE -->
    <g filter="url(#heavyShadow)">
      <text x="415" y="592" text-anchor="middle" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="76" font-weight="800" letter-spacing="18" fill="#090410" stroke="#090410" stroke-width="14" stroke-linejoin="round">OF MY</text>
      <text x="415" y="592" text-anchor="middle" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="76" font-weight="800" letter-spacing="18" fill="url(#goldBevel)">OF MY</text>

      <text x="1195" y="592" text-anchor="middle" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="76" font-weight="800" letter-spacing="18" fill="#090410" stroke="#090410" stroke-width="14" stroke-linejoin="round">DEMISE</text>
      <text x="1195" y="592" text-anchor="middle" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="76" font-weight="800" letter-spacing="18" fill="url(#goldBevel)">DEMISE</text>
    </g>

    <!-- Bottom Filigree Rule -->
    <g filter="url(#heavyShadow)">
      <line x1="160" y1="636" x2="755" y2="636" stroke="url(#goldBevel)" stroke-width="3"/>
      <line x1="845" y1="636" x2="1440" y2="636" stroke="url(#goldBevel)" stroke-width="3"/>
      <polygon points="800,624 812,636 800,648 788,636" fill="#FFE6A3"/>
    </g>
    ${
      includeTagline
        ? `<text x="800" y="728" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="24" font-style="italic" letter-spacing="3" fill="#E6D5F5">“Every name left on the Bell Road still answers.”</text>`
        : ''
    }
  </svg>`);
}

async function runStep2LogosIconAndFeatureGraphic() {
  console.log('Step 2: Building ornate Gothic logo, master/compact store logos, UOMD icon_512 & feature_graphic...');
  const logoSvg = buildOrnateLogoSvg(1600, 760, false);

  // Save in-game ui_logo.webp (both base and approved_art)
  const uiLogoWebpBuf = await sharp(logoSvg).webp({ quality: 95 }).toBuffer();
  fs.writeFileSync(path.join(ROOT, 'content/base/art/ui_logo.webp'), uiLogoWebpBuf);
  fs.writeFileSync(path.join(ROOT, 'content/approved_art/art/ui_logo.webp'), uiLogoWebpBuf);

  // Save store logo_master.png (1600x760 RGBA — NO "Gothic Anime" badge!)
  const masterPngBuf = await sharp(logoSvg).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(STORE_ASSETS, 'logo_master.png'), masterPngBuf);

  // Save store logo_compact.png (960x360 RGBA)
  const compactPngBuf = await sharp(logoSvg)
    .resize(960, 360, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(STORE_ASSETS, 'logo_compact.png'), compactPngBuf);

  // Build App Icon (512x512) with Canonical Fadyme + Ornate Gold "UOMD / UNAWARE OF MY DEMISE" Crest Plaque
  const canonicalFadymePath = path.join(ROOT, 'content/base/art/portrait_fadyme_resolve.webp');
  const fadymeIconCrop = await sharp(canonicalFadymePath)
    .extract({ left: 108, top: 268, width: 552, height: 552 })
    .resize(476, 476, { fit: 'cover' })
    .modulate({ brightness: 1.04, saturation: 1.06 })
    .png()
    .toBuffer();

  const iconBgSvg = Buffer.from(`<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="skyG" cx="50%" cy="38%" r="72%">
        <stop offset="0%" stop-color="#3B194C"/>
        <stop offset="42%" stop-color="#1E0C30"/>
        <stop offset="100%" stop-color="#06030B"/>
      </radialGradient>
      <radialGradient id="corG" cx="50%" cy="34%" r="42%">
        <stop offset="0%" stop-color="#FFF2BD" stop-opacity="0.95"/>
        <stop offset="48%" stop-color="#E59A3C" stop-opacity="0.78"/>
        <stop offset="76%" stop-color="#B9385D" stop-opacity="0.52"/>
        <stop offset="100%" stop-color="#1E0C30" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="512" height="512" fill="url(#skyG)"/>
    <circle cx="256" cy="176" r="184" fill="none" stroke="#D4AF37" stroke-width="1.4" stroke-opacity="0.36" stroke-dasharray="6 6"/>
    <circle cx="256" cy="176" r="158" fill="url(#corG)"/>
    <circle cx="256" cy="176" r="114" fill="#08040E" stroke="#FFE9A6" stroke-width="5"/>
    <circle cx="256" cy="176" r="120" fill="none" stroke="#D94B72" stroke-width="3" stroke-opacity="0.88"/>
  </svg>`);

  const iconTitleCrestSvg = Buffer.from(`<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="botV" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#06030B" stop-opacity="0"/>
        <stop offset="58%" stop-color="#06030B" stop-opacity="0.08"/>
        <stop offset="82%" stop-color="#08040F" stop-opacity="0.92"/>
        <stop offset="100%" stop-color="#05020A" stop-opacity="0.98"/>
      </linearGradient>
      <linearGradient id="crestGold" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFDF4"/>
        <stop offset="35%" stop-color="#F6DF9E"/>
        <stop offset="75%" stop-color="#C9963B"/>
        <stop offset="100%" stop-color="#8A5E1B"/>
      </linearGradient>
      <linearGradient id="plaqueBg" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0B0514" stop-opacity="0.95"/>
        <stop offset="50%" stop-color="#241038" stop-opacity="0.97"/>
        <stop offset="100%" stop-color="#0B0514" stop-opacity="0.95"/>
      </linearGradient>
      <filter id="iShad" x="-15%" y="-20%" width="130%" height="150%">
        <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.95"/>
      </filter>
    </defs>

    <rect width="512" height="512" fill="url(#botV)"/>

    <!-- Outer Gold Filigree Border Frame -->
    <rect x="10" y="10" width="492" height="492" rx="28" fill="none" stroke="url(#crestGold)" stroke-width="3" stroke-opacity="0.68"/>

    <!-- Sculpted Bottom Crest Plaque with UOMD & UNAWARE OF MY DEMISE -->
    <g filter="url(#iShad)">
      <path d="M 34,420 L 70,396 L 442,396 L 478,420 L 462,488 L 50,488 Z" fill="url(#plaqueBg)" stroke="url(#crestGold)" stroke-width="2.8"/>
      <line x1="68" y1="404" x2="444" y2="404" stroke="#FFE8A3" stroke-width="1" stroke-opacity="0.55"/>
      <polygon points="256,386 266,396 256,406 246,396" fill="url(#crestGold)"/>

      <text x="256" y="454" text-anchor="middle" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="56" font-weight="900" letter-spacing="10" fill="#090410" stroke="#090410" stroke-width="8" stroke-linejoin="round">UOMD</text>
      <text x="256" y="454" text-anchor="middle" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="56" font-weight="900" letter-spacing="10" fill="url(#crestGold)">UOMD</text>

      <text x="256" y="479" text-anchor="middle" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="13.5" font-weight="700" letter-spacing="3.6" fill="#EAD5A2">UNAWARE OF MY DEMISE</text>
    </g>
  </svg>`);

  const storeIconBuf = await sharp(iconBgSvg)
    .composite([
      { input: fadymeIconCrop, top: 6, left: 18 },
      { input: iconTitleCrestSvg, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(path.join(STORE_ASSETS, 'icon_512.png'), storeIconBuf);
  ensureDir(BRAND_DIR);
  fs.writeFileSync(path.join(BRAND_DIR, 'app_icon_512x512_v001.png'), storeIconBuf);
  await sharp(storeIconBuf)
    .jpeg({ quality: 95 })
    .toFile(path.join(ROOT, 'narrative/15_Art_Workbench/ui_screens/brand_app_icon_v001.jpg'));

  // Update Android Launcher Mipmaps
  const mipmaps = [
    { dir: 'mipmap-mdpi', launcher: 48 },
    { dir: 'mipmap-hdpi', launcher: 72 },
    { dir: 'mipmap-xhdpi', launcher: 96 },
    { dir: 'mipmap-xxhdpi', launcher: 144 },
    { dir: 'mipmap-xxxhdpi', launcher: 192 },
  ];
  for (const m of mipmaps) {
    const outDir = path.join(ANDROID_RES, m.dir);
    ensureDir(outDir);
    await sharp(storeIconBuf)
      .resize(m.launcher, m.launcher)
      .png({ compressionLevel: 9 })
      .toFile(path.join(outDir, 'ic_launcher.png'));
  }

  // Redesign Feature Graphic (1024x500 24-bit RGB): Cinematic Eclipse Key Art + New Ornate Crest Logo
  const titleBgArt = await sharp(path.join(ROOT, 'content/base/art/ui_title_bg.webp'))
    .resize(1024, 576, { fit: 'cover', position: 'center' })
    .extract({ left: 0, top: 24, width: 1024, height: 500 })
    .modulate({ brightness: 0.92, saturation: 1.05 })
    .png()
    .toBuffer();

  const featureLogoBuf = await sharp(logoSvg)
    .resize(520, 248, { fit: 'inside' })
    .png()
    .toBuffer();

  const featureOverlaySvg = Buffer.from(`<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="featShade" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#05030A" stop-opacity="0.92"/>
        <stop offset="42%" stop-color="#0B0615" stop-opacity="0.72"/>
        <stop offset="68%" stop-color="#0B0615" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#05030A" stop-opacity="0.35"/>
      </linearGradient>
      <linearGradient id="botFade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#05030A" stop-opacity="0"/>
        <stop offset="72%" stop-color="#05030A" stop-opacity="0"/>
        <stop offset="100%" stop-color="#05030A" stop-opacity="0.90"/>
      </linearGradient>
      <linearGradient id="fgGold" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#8A6320" stop-opacity="0.3"/>
        <stop offset="50%" stop-color="#FFE6A3" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#8A6320" stop-opacity="0.3"/>
      </linearGradient>
    </defs>

    <rect width="1024" height="500" fill="url(#featShade)"/>
    <rect width="1024" height="500" fill="url(#botFade)"/>

    <!-- Subtle Gold Frame Border -->
    <rect x="12" y="12" width="1000" height="476" rx="10" fill="none" stroke="#D4AF37" stroke-width="1.6" stroke-opacity="0.65"/>

    <!-- Tagline Below Logo on Left -->
    <g transform="translate(278, 376)">
      <line x1="-210" y1="0" x2="210" y2="0" stroke="url(#fgGold)" stroke-width="1.5"/>
      <text x="0" y="30" text-anchor="middle" font-family="Cinzel, Georgia, 'Times New Roman', serif" font-size="15.5" font-weight="700" letter-spacing="3.2" fill="#F6DF9E">PART I: THE ASHEN VOW  ·  5v5 TACTICAL RPG</text>
      <text x="0" y="58" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="16" font-style="italic" fill="#E3D4F4">“Every name left on the Bell Road still answers.”</text>
      <line x1="-160" y1="74" x2="160" y2="74" stroke="url(#fgGold)" stroke-width="1.2"/>
    </g>
  </svg>`);

  const featureBuf = await sharp(titleBgArt)
    .composite([
      { input: featureOverlaySvg, top: 0, left: 0 },
      { input: featureLogoBuf, top: 96, left: 18 },
    ])
    .flatten({ background: '#06030B' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(path.join(STORE_ASSETS, 'feature_graphic_1024x500.png'), featureBuf);
  fs.writeFileSync(path.join(BRAND_DIR, 'google_play_feature_graphic_1024x500_v001.png'), featureBuf);
  await sharp(featureBuf)
    .jpeg({ quality: 95 })
    .toFile(path.join(ROOT, 'narrative/15_Art_Workbench/ui_screens/brand_key_art_wide_v001.jpg'));

  console.log('✓ Step 2 complete: ui_logo.webp, logo_master.png, logo_compact.png, icon_512.png & feature_graphic_1024x500.png rebuilt.');
}

export { runStep1WeatherMahmut, runStep2LogosIconAndFeatureGraphic, buildOrnateLogoSvg };

async function getAlphaBounds(imgInput) {
  const { data, info } = await sharp(imgInput)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let maxX = 0;
  let minY = info.height;
  let maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 24) {
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
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function extractCanonicalPortrait(
  imgPath,
  targetW,
  targetH,
  fit = 'cover',
  flipX = false,
  cropHeightRatio = 1.0,
) {
  let sourceInput = imgPath;
  if (imgPath.includes('portrait_marshal_oren_')) {
    const neckPatchSvg = Buffer.from(`<svg width="768" height="1152" viewBox="0 0 768 1152" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="orenNeck" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#6B5550"/>
          <stop offset="45%" stop-color="#4A3A44"/>
          <stop offset="100%" stop-color="#282130"/>
        </linearGradient>
      </defs>
      <polygon points="286,204 434,196 446,294 272,294" fill="url(#orenNeck)"/>
      <path d="M 282 224 Q 362 274 440 224 L 446 294 L 272 294 Z" fill="#322B3D" stroke="#5A4E68" stroke-width="2"/>
    </svg>`);
    sourceInput = await sharp(neckPatchSvg)
      .composite([{ input: imgPath, left: 0, top: 0 }])
      .png()
      .toBuffer();
  }
  const bounds = await getAlphaBounds(sourceInput);
  const croppedBounds = {
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: Math.max(64, Math.round(bounds.height * cropHeightRatio)),
  };
  let pipe = sharp(sourceInput).extract(croppedBounds);
  if (flipX) pipe = pipe.flop();
  return pipe
    .resize(targetW, targetH, {
      fit,
      position: 'top',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

/**
 * Extracts an atlas frame AND trims transparent space around it so the bottom pixel
 * is 100% guaranteed to be the bottom of the unit's feet/boots (NO floating units!).
 */
async function extractGroundedAtlasFrame(
  atlasKey,
  frameName,
  targetMaxWidth,
  targetMaxHeight,
  flipX = false,
) {
  const atlas = artManifest.atlases[atlasKey];
  if (!atlas) throw new Error(`Atlas not found: ${atlasKey}`);
  const rect = atlas.frames[frameName] ?? atlas.frames.idle ?? Object.values(atlas.frames)[0];
  const [left, top, width, height] = rect;
  const imgPath = path.join(ROOT, 'content/approved_art', atlas.image);

  const cellBuf = await sharp(imgPath).extract({ left, top, width, height }).png().toBuffer();
  const bounds = await getAlphaBounds(cellBuf);

  let pipeline = sharp(cellBuf).extract(bounds);
  if (flipX) pipeline = pipeline.flop();
  return pipeline
    .resize(targetMaxWidth, targetMaxHeight, {
      fit: 'inside',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

function buildEditorialRibbonSvg({ badge, headline, subtitle, position = 'top' }) {
  const isTop = position === 'top';
  const yBox = isTop ? 14 : 926;
  const pillW = Math.max(420, Math.round(badge.length * 12.4 + 68));

  return Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
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
    </g>

    <rect x="190" y="${yBox + 18}" width="${pillW}" height="28" rx="14" fill="url(#badgeFill)" stroke="#D4AF37" stroke-width="1.2"/>
    <circle cx="208" cy="${yBox + 32}" r="4" fill="#F2C96B"/>
    <text x="224" y="${yBox + 37}" font-family="Cinzel, Georgia, serif" font-size="13.5" font-weight="700" letter-spacing="2.2" fill="#F4DC9B">${escapeXml(badge)}</text>
    <text x="190" y="${yBox + 82}" font-family="Cinzel, Georgia, serif" font-size="34" font-weight="700" letter-spacing="2.2" fill="url(#titleGold)" filter="url(#dropShadow)">${escapeXml(headline)}</text>
    <text x="190" y="${yBox + 114}" font-family="Georgia, serif" font-size="19.5" font-style="italic" fill="#DDD0E8">${escapeXml(subtitle)}</text>
  </svg>`);
}

async function buildCinematicVnShowcasePlate({
  outFile,
  bgRelPath,
  leftPortraitRel,
  leftSpeaker,
  leftFlip = false,
  rightPortraitRel,
  rightSpeaker,
  rightFlip = false,
  activeRight = true,
  stillTopRel,
  stillTopCaption,
  stillBotRel,
  stillBotCaption,
  dialogueLine1,
  dialogueLine2,
  footerMeta,
  badge,
  headline,
  subtitle,
}) {
  const bgBuf = await sharp(path.join(ROOT, bgRelPath))
    .resize(1920, 1080, { fit: 'cover' })
    .modulate({ brightness: 0.72 })
    .png()
    .toBuffer();

  const leftPort = await extractCanonicalPortrait(
    path.join(ROOT, leftPortraitRel),
    550,
    800,
    'inside',
    leftFlip,
  );
  const rightPort = await extractCanonicalPortrait(
    path.join(ROOT, rightPortraitRel),
    550,
    800,
    'inside',
    rightFlip,
  );

  const still01Buf = await sharp(path.join(ROOT, stillTopRel))
    .resize(372, 208, { fit: 'cover' })
    .png()
    .toBuffer();
  const still02Buf = await sharp(path.join(ROOT, stillBotRel))
    .resize(372, 208, { fit: 'cover' })
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
    <g transform="translate(774, 184)">
      <rect x="-8" y="-8" width="388" height="252" rx="10" fill="#090510" fill-opacity="0.94" stroke="#D4AF37" stroke-width="2.2"/>
      <text x="186" y="228" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12.5" font-weight="700" letter-spacing="1.6" fill="#EAD08A">${escapeXml(stillTopCaption)}</text>
    </g>
    <g transform="translate(774, 452)">
      <rect x="-8" y="-8" width="388" height="252" rx="10" fill="#090510" fill-opacity="0.94" stroke="#D4AF37" stroke-width="2.2"/>
      <text x="186" y="228" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12.5" font-weight="700" letter-spacing="1.6" fill="#EAD08A">${escapeXml(stillBotCaption)}</text>
    </g>

    <!-- Gothic Visual Novel Dialogue Box -->
    <g transform="translate(96, 736)">
      <rect x="0" y="0" width="1728" height="284" rx="12" fill="url(#dlgGrad)" stroke="#D4AF37" stroke-width="2.4"/>
      <rect x="8" y="8" width="1712" height="268" rx="8" fill="none" stroke="#8C6D23" stroke-width="1" stroke-opacity="0.6"/>

      <rect x="1310" y="${activeRight ? -26 : -22}" width="330" height="${activeRight ? 52 : 44}" rx="8" fill="${activeRight ? '#2A1344' : '#140A22'}" stroke="${activeRight ? '#FFE394' : '#8C6D23'}" stroke-width="${activeRight ? 2.2 : 1.5}"/>
      <text x="1475" y="7" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="${activeRight ? 21 : 17}" font-weight="700" letter-spacing="2.8" fill="${activeRight ? '#FFF6DC' : '#C9B8DC'}">${escapeXml(rightSpeaker)}</text>

      <rect x="64" y="${!activeRight ? -26 : -22}" width="330" height="${!activeRight ? 52 : 44}" rx="8" fill="${!activeRight ? '#2A1344' : '#140A22'}" stroke="${!activeRight ? '#FFE394' : '#8C6D23'}" stroke-width="${!activeRight ? 2.2 : 1.5}"/>
      <text x="229" y="7" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="${!activeRight ? 21 : 17}" font-weight="700" letter-spacing="2.8" fill="${!activeRight ? '#FFF6DC' : '#C9B8DC'}">${escapeXml(leftSpeaker)}</text>

      <text x="64" y="76" font-family="Georgia, serif" font-size="28" fill="#F5ECFC">${escapeXml(dialogueLine1)}</text>
      <text x="64" y="122" font-family="Georgia, serif" font-size="28" fill="#F5ECFC">${escapeXml(dialogueLine2)}</text>

      <line x1="64" y1="168" x2="1664" y2="168" stroke="#D4AF37" stroke-width="1" stroke-opacity="0.4"/>
      <text x="64" y="212" font-family="Cinzel, Georgia, serif" font-size="15" font-weight="700" letter-spacing="2.0" fill="#E6C77B">${escapeXml(footerMeta)}</text>
    </g>
  </svg>`);

  const ribbon = buildEditorialRibbonSvg({ badge, headline, subtitle, position: 'top' });

  await sharp(bgBuf)
    .composite([
      { input: leftPort, left: 96, top: 192 },
      { input: rightPort, left: 1264, top: 192 },
      { input: vnHudSvg, left: 0, top: 0 },
      { input: still01Buf, left: 774, top: 184 },
      { input: still02Buf, left: 774, top: 452 },
      { input: ribbon, left: 0, top: 0 },
    ])
    .flatten({ background: '#07040C' })
    .png({ compressionLevel: 9 })
    .toFile(outFile);
}

async function runStep3StoreScreenshots() {
  console.log('Step 3: Rebuilding all 8 Google Play 1920x1080 Showcase Plates (Grounded 5v5 + Cinematic VN + Unified Cards)...');
  ensureDir(STORE_SCREENSHOTS);

  // 01: CINEMATIC SAGA OPENING (No raw title menu buttons!)
  await buildCinematicVnShowcasePlate({
    outFile: path.join(STORE_SCREENSHOTS, '01_title_screen.png'),
    bgRelPath: 'content/base/art/ui_title_bg.webp',
    leftPortraitRel: 'content/base/art/portrait_fadyme_resolve.webp',
    leftSpeaker: 'FADYME · VEIL WEAVER',
    rightPortraitRel: 'content/base/art/portrait_mahmut_protective_resolve.webp',
    rightSpeaker: 'MAHMUT · OATH VANGUARD',
    activeRight: false,
    stillTopRel: 'content/base/art/still_prologue_crownfall.webp',
    stillTopCaption: 'THE NIGHT OF CROWNFALL · VEYRHOLD IN ASH',
    stillBotRel: 'content/base/art/still_prologue_reunion.webp',
    stillBotCaption: 'SEVEN YEARS LATER · REUNION ON THE ASH ROAD',
    dialogueLine1: '“Seven winters have passed since the Sanctuary Bell cracked above the capital.',
    dialogueLine2: 'Keep your hand near the hilt, Uncle — the ash is rising from the stones again.”',
    footerMeta: 'PART I: THE ASHEN VOW   ·   120s CINEMATIC PROLOGUE   ·   FULL JAPANESE VOICE ACTING',
    badge: 'DARK FANTASY TACTICAL RPG & VISUAL NOVEL',
    headline: 'A BROKEN OATH · A KINGDOM IN ASH',
    subtitle: 'Step onto the Bell Road with Fadyme & Mahmut in an atmospheric Gothic anime saga.',
  });

  // 02: PROLOGUE & VISUAL NOVEL (Approved layout, updated with weathered Mahmut!)
  await buildCinematicVnShowcasePlate({
    outFile: path.join(STORE_SCREENSHOTS, '02_prologue_cinematic.png'),
    bgRelPath: 'content/base/art/bg_shelter_courtyard_dusk.webp',
    leftPortraitRel: 'content/base/art/portrait_mahmut_composed.webp',
    leftSpeaker: 'MAHMUT',
    rightPortraitRel: 'content/base/art/portrait_fadyme_warm.webp',
    rightSpeaker: 'FADYME',
    activeRight: true,
    stillTopRel: 'content/base/art/still_prologue_beginning.webp',
    stillTopCaption: 'PROLOGUE CG · BEFORE THE BELL ROAD',
    stillBotRel: 'content/base/art/still_roadside_rest.webp',
    stillBotCaption: 'STORY CG · CAMPFIRE IN THE ASH WOODS',
    dialogueLine1: '“You have inspected the entire courtyard in the time it took me to unlatch the shutter.',
    dialogueLine2: 'Sit down before the tea goes cold, Uncle — the road to the Sunken Nave waits for dawn.”',
    footerMeta: 'CHAPTER I · A ROOF BEFORE DAWN   ·   JAPANESE VOICE OVER (CHIRP 3 HD)   ·   32 EXPRESSIVE PORTRAIT SETS',
    badge: 'VOICED LIGHT NOVEL STORY & HAND-PAINTED CGS',
    headline: 'EVERY NAME LEFT ON THE ROAD MATTERS',
    subtitle: 'Experience a literary dark-fantasy narrative with canonical knee-up portraits, story stills & Japanese voice acting.',
  });

  // 03: GROUNDED 5v5 TACTICAL BATTLE (All 10 units' feet alpha-trimmed and planted firmly on the stone floor y=645..755!)
  {
    const bg03 = await sharp(
      path.join(ROOT, 'content/approved_art/art/bg_cathedral_saint_luthos.webp'),
    )
      .resize(1920, 1080, { fit: 'cover' })
      .modulate({ brightness: 0.76 })
      .png()
      .toBuffer();

    const fadymeCutinPortrait = await sharp(
      path.join(ROOT, 'content/base/art/portrait_fadyme_resolve.webp'),
    )
      .extract({ left: 84, top: 270, width: 600, height: 340 })
      .resize(280, 158, { fit: 'cover' })
      .png()
      .toBuffer();

    // 5 Allies spread cleanly on the stone floor slabs between the candle rows (y = 742..798)
    const allies = [
      { name: 'KERA VOSS', atlas: 'atlas_kera_voss', pose: 'active', x: 145, y: 744, hp: 0.92, focus: 0.65 },
      { name: 'FADYME', atlas: 'atlas_fadyme', pose: 'ultimate', x: 300, y: 794, hp: 0.96, focus: 1.0, active: true },
      { name: 'SISTER AVELINE', atlas: 'atlas_sister_aveline', pose: 'idle', x: 455, y: 738, hp: 1.0, focus: 0.75 },
      { name: 'MAHMUT', atlas: 'atlas_mahmut', pose: 'active', x: 615, y: 796, hp: 0.94, focus: 0.85 },
      { name: 'BRIN ALDER', atlas: 'atlas_brin_alder', pose: 'idle', x: 770, y: 746, hp: 0.89, focus: 0.55 },
    ];

    // 5 Enemies spread cleanly on the stone floor slabs on the right side (y = 740..796)
    const enemies = [
      { name: 'ASH WOLF', atlas: 'atlas_ash_wolf', pose: 'idle', x: 1125, y: 748, hp: 0.78, targeted: false },
      { name: 'BELLBOUND DEAD', atlas: 'atlas_bellbound_dead', pose: 'hit', x: 1280, y: 794, hp: 0.48, targeted: true },
      { name: 'HOLLOW PILGRIM', atlas: 'atlas_hollow_pilgrim', pose: 'idle', x: 1435, y: 740, hp: 0.62, targeted: false },
      { name: 'BOSS · BELL WIDOW', atlas: 'atlas_boss_bell_widow', pose: 'active', x: 1595, y: 796, hp: 0.84, targeted: false, isBoss: true },
      { name: 'CHOIR KNIGHT', atlas: 'atlas_choir_knight', pose: 'idle', x: 1765, y: 744, hp: 0.81, targeted: false },
    ];

    const allUnits = [
      ...allies.map((u) => ({ ...u, side: 'ally' })),
      ...enemies.map((e) => ({ ...e, side: 'enemy' })),
    ].sort((a, b) => a.y - b.y);

    const spriteComposites = [];
    const shadowSvgParts = [];
    const plateSvgParts = [];

    for (const u of allUnits) {
      const maxW = u.isBoss ? 225 : 158;
      const maxH = u.isBoss ? 235 : 168;
      const buf = await extractGroundedAtlasFrame(u.atlas, u.pose, maxW, maxH, false);
      const m = await sharp(buf).metadata();
      const sw = m.width ?? 140;
      const sh = m.height ?? 150;

      // Plant bottom of trimmed boots directly at u.y!
      spriteComposites.push({
        input: buf,
        left: Math.round(u.x - sw / 2),
        top: Math.round(u.y - sh),
      });

      const isAlly = u.side === 'ally';
      const rx = u.isBoss ? 86 : 58;
      const ry = u.isBoss ? 18 : 13;
      shadowSvgParts.push(`
        <g transform="translate(${u.x}, ${u.y})">
          <ellipse cx="0" cy="-2" rx="${rx + 8}" ry="${ry + 4}" fill="#040208" fill-opacity="0.72"/>
          <ellipse cx="0" cy="-2" rx="${rx}" ry="${ry}" fill="${isAlly ? (u.active ? '#3A1859' : '#101828') : '#240B1C'}" fill-opacity="0.88" stroke="${u.active || u.targeted ? '#FFE394' : isAlly ? '#68B5E8' : '#FF5E8E'}" stroke-width="${u.active || u.targeted ? 2.5 : 1.8}"/>
        </g>
      `);

      plateSvgParts.push(`
        <g transform="translate(${u.x}, ${u.y})">
          ${u.targeted ? `<polygon points="0,-${sh + 16} 12,-${sh + 38} -12,-${sh + 38}" fill="#FFE394" stroke="#08040E" stroke-width="2"/>` : ''}
          <rect x="-82" y="8" width="164" height="36" rx="10" fill="#0B0814" fill-opacity="0.92" stroke="${u.active || u.targeted ? '#FFE394' : isAlly ? '#5A769A' : '#FF5E8E'}" stroke-width="${u.active || u.targeted ? 2 : 1.3}"/>
          <text x="0" y="22" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="10.5" font-weight="700" letter-spacing="0.6" fill="${u.isBoss || u.active ? '#FFE394' : '#FFF6DC'}">${u.name}</text>
          <rect x="-66" y="27" width="132" height="6" rx="3" fill="#1A2436"/>
          <rect x="-65" y="28" width="${Math.round(130 * u.hp)}" height="4" rx="2" fill="${isAlly ? '#7CE89B' : '#E03E6D'}"/>
          ${isAlly ? `<rect x="-52" y="35" width="104" height="4" rx="2" fill="#1A162B"/><rect x="-51" y="36" width="${Math.round(102 * u.focus)}" height="2.5" rx="1.2" fill="#D4AF37"/>` : ''}
        </g>
      `);
    }

    const battleUnderlaySvg = Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
      <!-- Ground Plane Perspective Grid & Shadows on the Stone Floor -->
      <ellipse cx="455" cy="772" rx="395" ry="62" fill="#090512" fill-opacity="0.45" stroke="#D4AF37" stroke-width="1.2" stroke-opacity="0.32" stroke-dasharray="8 6"/>
      <ellipse cx="1445" cy="772" rx="405" ry="62" fill="#140612" fill-opacity="0.45" stroke="#FF5E8E" stroke-width="1.2" stroke-opacity="0.32" stroke-dasharray="8 6"/>
      ${shadowSvgParts.join('\n')}
    </svg>`);

    const battleHudOverlaySvg = Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cutinGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#1E0C33" stop-opacity="0.96"/>
          <stop offset="65%" stop-color="#381557" stop-opacity="0.94"/>
          <stop offset="100%" stop-color="#12071F" stop-opacity="0.96"/>
        </linearGradient>
      </defs>

      ${plateSvgParts.join('\n')}

      <!-- Turn Order Timeline Bar -->
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

      <!-- Ultimate Cut-In Banner Card on Upper Right -->
      <g transform="translate(980, 168)">
        <rect x="0" y="0" width="876" height="158" rx="10" fill="url(#cutinGrad)" stroke="#D4AF37" stroke-width="2.5"/>
        <circle cx="578" cy="79" r="62" fill="none" stroke="#D94B72" stroke-width="1.8" stroke-opacity="0.55"/>
        <line x1="300" y1="26" x2="846" y2="26" stroke="#D4AF37" stroke-width="1" stroke-opacity="0.5"/>
        <line x1="300" y1="132" x2="846" y2="132" stroke="#D4AF37" stroke-width="1" stroke-opacity="0.5"/>
        <text x="574" y="50" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" letter-spacing="3.0" fill="#F2C96B">ULTIMATE UNLEASHED · 100 FOCUS</text>
        <text x="574" y="86" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="25" font-weight="700" letter-spacing="1.8" fill="#FFF6DC">THE BELL THAT FORGETS</text>
        <text x="574" y="116" text-anchor="middle" font-family="Georgia, serif" font-size="15" font-style="italic" fill="#DFC9F2">「忘却の鐘よ、灰のヴェールを裂け！」 · AoE Veil DMG &amp; Silence</text>
      </g>

      <!-- Bottom Tactical Command Bar -->
      <g transform="translate(272, 838)">
        <rect x="0" y="0" width="1376" height="48" rx="8" fill="#0B0613" fill-opacity="0.92" stroke="#8C6D23" stroke-width="1.4"/>
        <text x="688" y="30" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13.5" font-weight="700" letter-spacing="1.8" fill="#E6C77B">ACTIVE TURN: FADYME (VEIL WEAVER)  ·  5v5 GROUNDED TACTICAL FORMATION  ·  WAVE 2 / 3</text>
      </g>

      <g transform="translate(472, 898)">
        <rect x="0" y="0" width="976" height="102" rx="10" fill="#090510" fill-opacity="0.94" stroke="#7A5E29" stroke-width="1.5"/>
        <g transform="translate(24, 11)">
          <rect x="0" y="0" width="286" height="80" rx="8" fill="#170C28" stroke="#D4AF37" stroke-width="1.6"/>
          <text x="143" y="36" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="18" font-weight="700" fill="#FFF3D1">VEILGLASS THORN</text>
          <text x="143" y="60" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" letter-spacing="1.8" fill="#C9B8DC">BASIC  ·  +20 FOCUS</text>
        </g>
        <g transform="translate(345, 11)">
          <rect x="0" y="0" width="286" height="80" rx="8" fill="#1E0E36" stroke="#D4AF37" stroke-width="1.8"/>
          <text x="143" y="36" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="18" font-weight="700" fill="#FFF3D1">BORROWED HOUR</text>
          <text x="143" y="60" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" letter-spacing="1.8" fill="#E6C77B">SKILL  ·  TURN ADVANCE</text>
        </g>
        <g transform="translate(666, 11)">
          <rect x="0" y="0" width="286" height="80" rx="8" fill="#381657" stroke="#FFE394" stroke-width="2.4"/>
          <text x="143" y="36" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="16.5" font-weight="700" fill="#FFF6DC">BELL THAT FORGETS</text>
          <text x="143" y="60" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" letter-spacing="1.8" fill="#FFE394">ULTIMATE  ·  100/100 FOCUS</text>
        </g>
      </g>
    </svg>`);

    const ribbon03 = buildEditorialRibbonSvg({
      badge: '5v5 TURN-BASED TACTICAL COMBAT',
      headline: 'COMMAND 5v5 TACTICAL BATTLES',
      subtitle: 'Read enemy target intentions, control the turn timeline, and trigger 3-beat Japanese Ultimate Cut-Ins.',
      position: 'top',
    });

    await sharp(bg03)
      .composite([
        { input: battleUnderlaySvg, top: 0, left: 0 },
        ...spriteComposites,
        { input: battleHudOverlaySvg, top: 0, left: 0 },
        { input: fadymeCutinPortrait, top: 168, left: 980 },
        { input: ribbon03, top: 0, left: 0 },
      ])
      .flatten({ background: '#07040C' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(STORE_SCREENSHOTS, '03_tactical_battle.png'));
  }

  // 04: CINEMATIC CHAPTER CONFRONTATION (Replaces raw World Map Hub screen!)
  await buildCinematicVnShowcasePlate({
    outFile: path.join(STORE_SCREENSHOTS, '04_world_map_hub.png'),
    bgRelPath: 'content/approved_art/art/bg_bridge_forsaken.webp',
    leftPortraitRel: 'content/approved_art/art/portrait_nara_vell_defiant.webp',
    leftSpeaker: 'NARA VELL · GATEWARDEN',
    rightPortraitRel: 'content/approved_art/art/portrait_marshal_oren_defiant.webp',
    rightSpeaker: 'MARSHAL OREN · IRON VANGUARD',
    activeRight: true,
    stillTopRel: 'content/approved_art/art/bg_cathedral_saint_luthos.webp',
    stillTopCaption: 'CHAPTER II · THE CATHEDRAL OF SAINT LUTHOS',
    stillBotRel: 'content/approved_art/art/bg_estate_ashen_lord.webp',
    stillBotCaption: 'CHAPTER VI · THE ASHEN LORD’S ESTATE',
    dialogueLine1: '“By order of the Regency, no living soul crosses the Iron-Chain Span without a seal.',
    dialogueLine2: 'Lower your shield, Gatewarden — or be buried beneath the stones you swore to keep.”',
    footerMeta: 'SEVEN CHAPTER REGIONS   ·   47 HAND-PAINTED BATTLEFIELDS   ·   7 PART I BOSS ENCOUNTERS',
    badge: 'SEVEN CHAPTERS · A DARK FANTASY ODYSSEY',
    headline: 'CROSS THE SEVEN REGIONS OF VEYRHOLD',
    subtitle: 'From the Whispering Ash and Sunken Nave to the Iron-Chain Span and First Eclipse Altar.',
  });

  // 05: UNIFIED 5-HERO PORTRAIT SHOWCASE (Clean identical-format cards, no floating chibi clutter!)
  {
    const bg05 = await sharp(
      path.join(ROOT, 'content/approved_art/art/bg_cathedral_saint_luthos.webp'),
    )
      .resize(1920, 1080, { fit: 'cover' })
      .modulate({ brightness: 0.52 })
      .png()
      .toBuffer();

    const heroes = [
      {
        name: 'FADYME',
        title: '5★ Mystic · Radiance',
        role: 'SANCTUARY BELL BEARER',
        portrait: path.join(ROOT, 'content/base/art/portrait_fadyme_resolve.webp'),
        cropRatio: 0.96,
        weaponIcon: path.join(ROOT, 'narrative/15_Art_Workbench/icons/production_v001/icons_rgba/icon_sig_sanctum_bell.png'),
        accent: '#C968E8',
      },
      {
        name: 'MAHMUT',
        title: '5★ Vanguard · Flame',
        role: 'OATHBREAKER GUARDIAN',
        portrait: path.join(ROOT, 'content/base/art/portrait_mahmut_protective_resolve.webp'),
        cropRatio: 0.96,
        weaponIcon: path.join(ROOT, 'narrative/15_Art_Workbench/icons/production_v001/icons_rgba/icon_sig_oathkeeper_blade.png'),
        accent: '#E05A47',
      },
      {
        name: 'SISTER AVELINE',
        title: '5★ Bulwark · Radiance',
        role: 'ASHEN VIGIL CLERIC',
        portrait: path.join(ROOT, 'content/approved_art/art/portrait_sister_aveline_composed.webp'),
        cropRatio: 0.66,
        weaponIcon: path.join(ROOT, 'narrative/15_Art_Workbench/icons/production_v001/icons_rgba/icon_sig_last_vigil_staff.png'),
        accent: '#F2C96B',
      },
      {
        name: 'SABLE WREN',
        title: '5★ Striker · Shadow',
        role: 'VEILGLASS NIGHTBLADE',
        portrait: path.join(ROOT, 'content/approved_art/art/portrait_sable_wren_composed.webp'),
        cropRatio: 0.66,
        weaponIcon: path.join(ROOT, 'narrative/15_Art_Workbench/icons/production_v001/icons_rgba/icon_sig_broken_bell_daggers.png'),
        accent: '#68B5E8',
      },
      {
        name: 'VESPERA WISP',
        title: '5★ Mystic · Tide',
        role: 'LANTERN OF THE LAST HOUR',
        portrait: path.join(ROOT, 'content/approved_art/art/portrait_vespera_wisp_composed.webp'),
        cropRatio: 0.66,
        weaponIcon: path.join(ROOT, 'narrative/15_Art_Workbench/icons/production_v001/icons_rgba/icon_sig_last_hour_lantern.png'),
        accent: '#E85C8A',
      },
    ];

    const composites = [];
    const cardW = 336;
    const cardH = 840;
    const gap = 28;
    const startX = 64;
    const startY = 178;

    for (let i = 0; i < heroes.length; i++) {
      const h = heroes[i];
      const x = startX + i * (cardW + gap);

      const cardBg = Buffer.from(`<svg width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cGrad${i}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#150A24" stop-opacity="0.96"/>
            <stop offset="60%" stop-color="#221038" stop-opacity="0.94"/>
            <stop offset="100%" stop-color="#090411" stop-opacity="0.98"/>
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="${cardW - 4}" height="${cardH - 4}" rx="12" fill="url(#cGrad${i})" stroke="#D4AF37" stroke-width="2.4"/>
        <rect x="9" y="9" width="${cardW - 18}" height="${cardH - 18}" rx="8" fill="none" stroke="${h.accent}" stroke-width="1.2" stroke-opacity="0.55"/>
        <circle cx="${cardW / 2}" cy="260" r="134" fill="${h.accent}" fill-opacity="0.14"/>
        <circle cx="${cardW / 2}" cy="260" r="134" fill="none" stroke="#D4AF37" stroke-width="1" stroke-opacity="0.38" stroke-dasharray="5 6"/>
      </svg>`);
      composites.push({ input: cardBg, left: x, top: startY });

      // Uniform portrait frame (exact same knee/thigh-up crop & head alignment across all 5 cards!)
      const pBuf = await extractCanonicalPortrait(
        h.portrait,
        cardW - 20,
        620,
        'cover',
        false,
        h.cropRatio,
      );
      composites.push({ input: pBuf, left: x + 10, top: startY + 14 });

      const wpnBuf = await sharp(h.weaponIcon)
        .resize(58, 58, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      const cardFooter = Buffer.from(`<svg width="${cardW}" height="248" viewBox="0 0 ${cardW} 248" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fGrad${i}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0A0512" stop-opacity="0"/>
            <stop offset="26%" stop-color="#0A0512" stop-opacity="0.94"/>
            <stop offset="100%" stop-color="#07030D" stop-opacity="0.99"/>
          </linearGradient>
        </defs>
        <rect x="4" y="0" width="${cardW - 8}" height="244" rx="10" fill="url(#fGrad${i})"/>
        <line x1="20" y1="74" x2="${cardW - 20}" y2="74" stroke="#D4AF37" stroke-width="1.4" stroke-opacity="0.8"/>
        <polygon points="${cardW / 2},67 ${cardW / 2 + 6},74 ${cardW / 2},81 ${cardW / 2 - 6},74" fill="#FFE394"/>

        <!-- Uniform Star Badge -->
        <text x="${cardW / 2}" y="104" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="14" font-weight="700" letter-spacing="3" fill="#FFE394">★ ★ ★ ★ ★</text>
        <text x="${cardW / 2}" y="136" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="23" font-weight="800" letter-spacing="1.6" fill="#FFF6DC">${escapeXml(h.name)}</text>
        <text x="${cardW / 2}" y="162" text-anchor="middle" font-family="Georgia, serif" font-size="15.5" font-style="italic" fill="#E6C77B">${escapeXml(h.title)}</text>

        <rect x="20" y="178" width="${cardW - 40}" height="50" rx="8" fill="#180B29" stroke="${h.accent}" stroke-width="1.3"/>
        <circle cx="52" cy="203" r="22" fill="#0B0514" stroke="#D4AF37" stroke-width="1.2"/>
        <text x="192" y="208" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="11.5" font-weight="700" letter-spacing="1.2" fill="#F2E6FA">${escapeXml(h.role)}</text>
      </svg>`);
      composites.push({ input: cardFooter, left: x, top: startY + cardH - 248 });
      composites.push({ input: wpnBuf, left: x + 23, top: startY + cardH - 74 });
    }

    const ribbon05 = buildEditorialRibbonSvg({
      badge: '25 PLAYABLE COMPANIONS · UNIFIED PORTRAIT SERIES',
      headline: 'COLLECT & ASCEND 25 UNIQUE COMPANIONS',
      subtitle: 'Every hero features canonical knee-up portraits, signature 5★ armaments, and voiced story bonds.',
      position: 'top',
    });
    composites.push({ input: ribbon05, left: 0, top: 0 });

    await sharp(bg05)
      .composite(composites)
      .flatten({ background: '#07040C' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(STORE_SCREENSHOTS, '05_companion_roster.png'));
  }

  // 06: CINEMATIC UNDERCITY & ASHEN ESTATE STORY SHOWCASE (Replaces raw Character Sheet dump!)
  await buildCinematicVnShowcasePlate({
    outFile: path.join(STORE_SCREENSHOTS, '06_character_sheet.png'),
    bgRelPath: 'content/approved_art/art/bg_undercity_subterranean.webp',
    leftPortraitRel: 'content/approved_art/art/portrait_sable_wren_defiant.webp',
    leftSpeaker: 'SABLE WREN · NIGHTBLADE',
    rightPortraitRel: 'content/approved_art/art/portrait_lady_yseldra_vale_composed.webp',
    rightSpeaker: 'LADY YSELDRA VALE',
    activeRight: false,
    stillTopRel: 'content/approved_art/art/bg_undercity_red_vial_ward.webp',
    stillTopCaption: 'CHAPTER III · THE RED VIAL APOTHECARY WARD',
    stillBotRel: 'content/approved_art/art/bg_altar_first_eclipse.webp',
    stillBotCaption: 'CHAPTER VII · ALTAR OF THE FIRST ECLIPSE',
    dialogueLine1: '“You bought the silence of the Undercity with red glass and forged ledgers, Yseldra.',
    dialogueLine2: 'Tonight the drowned bell rings for the names you erased from the archive.”',
    footerMeta: 'INTRIGUE & RECKONING   ·   32 VOICED CHARACTERS   ·   BRANCHING BOND DIALOGUES',
    badge: 'DARK FANTASY INTRIGUE & DRAMATIC ENCOUNTERS',
    headline: 'UNCOVER THE CONSPIRACY OF THE CROWN',
    subtitle: 'Confront the Red Vial Cult, the Undercity Syndicate, and the architects of the First Eclipse.',
  });

  // 07: GROUNDED BOSS & BREAKABLE OBJECTIVE BATTLE (All units' feet planted firmly on the stone crossing y=645..755!)
  {
    const battleStageBg = await sharp(
      path.join(ROOT, 'content/approved_art/art/bg_forgotten_stone_crossing.webp'),
    )
      .resize(1920, 1080, { fit: 'cover' })
      .modulate({ brightness: 0.74, saturation: 0.96 })
      .png()
      .toBuffer();

    const partyDefs = [
      { name: 'SISTER AVELINE', atlas: 'atlas_sister_aveline', pose: 'idle', x: 140, y: 702, hp: 1.0, focus: 0.65 },
      { name: 'FADYME', atlas: 'atlas_fadyme', pose: 'active', x: 295, y: 762, hp: 0.92, focus: 1.0, active: true },
      { name: 'SABLE WREN', atlas: 'atlas_sable_wren', pose: 'basic', x: 450, y: 696, hp: 0.88, focus: 0.55 },
      { name: 'MAHMUT', atlas: 'atlas_mahmut', pose: 'idle', x: 605, y: 764, hp: 0.95, focus: 0.80 },
      { name: 'NARA VELL', atlas: 'atlas_nara_vell', pose: 'idle', x: 760, y: 704, hp: 0.94, focus: 0.70 },
    ];

    const partyComposites = [];
    const shadowParts = [];
    const partyPlateSvgParts = [];

    for (const p of partyDefs) {
      const spriteBuf = await extractGroundedAtlasFrame(p.atlas, p.pose, 162, 172);
      const sMeta = await sharp(spriteBuf).metadata();
      const sw = sMeta.width ?? 145;
      const sh = sMeta.height ?? 155;
      partyComposites.push({
        input: spriteBuf,
        left: Math.round(p.x - sw / 2),
        top: Math.round(p.y - sh),
      });

      shadowParts.push(`
        <g transform="translate(${p.x}, ${p.y})">
          <ellipse cx="0" cy="-2" rx="64" ry="15" fill="#040208" fill-opacity="0.72"/>
          <ellipse cx="0" cy="-2" rx="56" ry="12" fill="${p.active ? '#3A1859' : '#101828'}" fill-opacity="0.88" stroke="${p.active ? '#FFE394' : '#68B5E8'}" stroke-width="1.8"/>
        </g>
      `);

      partyPlateSvgParts.push(`
        <g transform="translate(${p.x}, ${p.y})">
          <rect x="-84" y="8" width="168" height="36" rx="10" fill="#0B0914" fill-opacity="0.92" stroke="${p.active ? '#FFE394' : '#5A769A'}" stroke-width="1.4"/>
          <text x="0" y="22" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="10.5" font-weight="700" fill="#FFF6DC">${p.name}</text>
          <rect x="-68" y="27" width="136" height="6" rx="3" fill="#1A2436"/>
          <rect x="-67" y="28" width="${Math.round(134 * p.hp)}" height="4" rx="2" fill="#7CE89B"/>
          <rect x="-52" y="35" width="104" height="4" rx="2" fill="#1A162B"/>
          <rect x="-51" y="36" width="${Math.round(102 * p.focus)}" height="2.5" rx="1.2" fill="#D4AF37"/>
        </g>
      `);
    }

    const objY = 678;
    const objX = 1105;
    const objReliquary = await extractGroundedAtlasFrame('atlas_objective', 'altar_pylon_intact', 200, 200);
    const objMeta = await sharp(objReliquary).metadata();

    const bossY = 742;
    const bossX = 1565;
    const bossChibi = await extractGroundedAtlasFrame('atlas_boss_ashen_lord_wraith', 'active', 270, 280);
    const bossMeta = await sharp(bossChibi).metadata();

    const bossUnderlaySvg = Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="objPulse" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FF477E" stop-opacity="0.44"/>
          <stop offset="65%" stop-color="#D4AF37" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="bossAura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#9A36D9" stop-opacity="0.44"/>
          <stop offset="70%" stop-color="#1E0B30" stop-opacity="0.24"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      ${shadowParts.join('\n')}
      <circle cx="${objX}" cy="${objY - 85}" r="115" fill="url(#objPulse)"/>
      <ellipse cx="${objX}" cy="${objY - 2}" rx="82" ry="18" fill="#2A0D2E" stroke="#FFE394" stroke-width="2.5"/>
      <circle cx="${bossX}" cy="${bossY - 115}" r="142" fill="url(#bossAura)"/>
      <ellipse cx="${bossX}" cy="${bossY - 2}" rx="108" ry="22" fill="#1C071B" stroke="#FF5E8E" stroke-width="2.5"/>
    </svg>`);

    const bossOverlaySvg = Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
      ${partyPlateSvgParts.join('\n')}

      <polygon points="${objX},${objY - (objMeta.height ?? 180) - 18} ${objX + 14},${objY - (objMeta.height ?? 180) - 42} ${objX - 14},${objY - (objMeta.height ?? 180) - 42}" fill="#FFE394" stroke="#08040E" stroke-width="2"/>

      <g transform="translate(${objX - 210}, ${objY + 12})">
        <rect x="0" y="0" width="420" height="82" rx="8" fill="#160824" fill-opacity="0.96" stroke="#FFE394" stroke-width="2"/>
        <text x="210" y="24" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13.5" font-weight="700" letter-spacing="1.4" fill="#FFE394">BREAKABLE OBJECTIVE · ECLIPSE PYLON</text>
        <rect x="28" y="34" width="364" height="10" rx="5" fill="#2B1228" stroke="#8C6D23" stroke-width="1"/>
        <rect x="29" y="35" width="212" height="8" rx="4" fill="#FF4D79"/>
        <text x="210" y="66" text-anchor="middle" font-family="Georgia, serif" font-size="14" font-style="italic" fill="#F2D9E6">Shatter Effect: Collapses Boss Shield &amp; Stuns for 1 Turn!</text>
      </g>

      <g transform="translate(${bossX - 190}, ${bossY + 12})">
        <rect x="0" y="0" width="380" height="78" rx="8" fill="#1C071B" fill-opacity="0.96" stroke="#FF5E8E" stroke-width="2"/>
        <text x="190" y="24" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="14.5" font-weight="700" letter-spacing="1.4" fill="#FF94B2">BOSS · ASHEN LORD’S WRAITH</text>
        <rect x="28" y="34" width="324" height="10" rx="5" fill="#2B1228"/>
        <rect x="29" y="35" width="276" height="8" rx="4" fill="#E03E6D"/>
        <text x="190" y="64" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="12" fill="#FFE394">▶ INTENT: ECLIPSE REQUIEM (AOE)</text>
      </g>

      <g transform="translate(272, 838)">
        <rect x="0" y="0" width="1376" height="48" rx="8" fill="#0B0613" fill-opacity="0.92" stroke="#8C6D23" stroke-width="1.4"/>
        <text x="688" y="30" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13.5" font-weight="700" letter-spacing="1.8" fill="#E6C77B">ACTIVE TURN: FADYME  ·  TARGETING BREAKABLE OBJECTIVE: ECLIPSE PYLON (+35% SHATTER DMG)</text>
      </g>

      <g transform="translate(472, 898)">
        <rect x="0" y="0" width="976" height="102" rx="10" fill="#090510" fill-opacity="0.94" stroke="#7A5E29" stroke-width="1.5"/>
        <g transform="translate(24, 11)">
          <rect x="0" y="0" width="286" height="80" rx="8" fill="#170C28" stroke="#D4AF37" stroke-width="1.6"/>
          <text x="143" y="36" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="18" font-weight="700" fill="#FFF3D1">VEILGLASS THORN</text>
          <text x="143" y="60" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" letter-spacing="1.8" fill="#C9B8DC">BASIC  ·  +20 FOCUS</text>
        </g>
        <g transform="translate(345, 11)">
          <rect x="0" y="0" width="286" height="80" rx="8" fill="#1E0E36" stroke="#D4AF37" stroke-width="1.8"/>
          <text x="143" y="36" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="18" font-weight="700" fill="#FFF3D1">BORROWED HOUR</text>
          <text x="143" y="60" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" letter-spacing="1.8" fill="#E6C77B">SKILL  ·  READY</text>
        </g>
        <g transform="translate(666, 11)">
          <rect x="0" y="0" width="286" height="80" rx="8" fill="#381657" stroke="#FFE394" stroke-width="2.4"/>
          <text x="143" y="36" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="16.5" font-weight="700" fill="#FFF6DC">BELL THAT FORGETS</text>
          <text x="143" y="60" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13" font-weight="700" letter-spacing="1.8" fill="#FFE394">ULTIMATE  ·  100/100 FOCUS</text>
        </g>
      </g>
    </svg>`);

    const ribbon07 = buildEditorialRibbonSvg({
      badge: 'TACTICAL BOSS ENCOUNTERS & BREAKABLE OBJECTIVES',
      headline: 'SHATTER BOSS RELIQUARIES · TURN THE TIDE',
      subtitle: 'Destroy cursed bells, sanctum censers & eclipse pylons mid-battle to collapse boss defenses.',
      position: 'top',
    });

    await sharp(battleStageBg)
      .composite([
        { input: bossUnderlaySvg, left: 0, top: 0 },
        ...partyComposites,
        {
          input: objReliquary,
          left: Math.round(objX - (objMeta.width ?? 180) / 2),
          top: Math.round(objY - (objMeta.height ?? 180)),
        },
        {
          input: bossChibi,
          left: Math.round(bossX - (bossMeta.width ?? 250) / 2),
          top: Math.round(bossY - (bossMeta.height ?? 250)),
        },
        { input: bossOverlaySvg, left: 0, top: 0 },
        { input: ribbon07, left: 0, top: 0 },
      ])
      .flatten({ background: '#07040C' })
      .png({ compressionLevel: 9 })
      .toFile(path.join(STORE_SCREENSHOTS, '07_boss_objectives.png'));
  }

  // 08: CINEMATIC OATH INVOCATION & FINALE SHOWCASE (Replaces cluttered split Trials/Summon UI dump!)
  await buildCinematicVnShowcasePlate({
    outFile: path.join(STORE_SCREENSHOTS, '08_trials_and_summon.png'),
    bgRelPath: 'content/approved_art/art/bg_altar_first_eclipse.webp',
    leftPortraitRel: 'content/approved_art/art/portrait_sister_aveline_focused.webp',
    leftSpeaker: 'SISTER AVELINE · OATH OF THE VIGIL',
    rightPortraitRel: 'content/approved_art/art/portrait_vespera_wisp_defiant.webp',
    rightSpeaker: 'VESPERA WISP · OATH OF THE LANTERN',
    activeRight: true,
    stillTopRel: 'content/approved_art/art/ui_banner_oath_01_sister.webp',
    stillTopCaption: 'OATH INVOCATION · SISTER AVELINE (5★ BULWARK)',
    stillBotRel: 'content/approved_art/art/ui_banner_oath_05_vespera.webp',
    stillBotCaption: 'OATH INVOCATION · VESPERA WISP (5★ MYSTIC)',
    dialogueLine1: '“Every lantern lit along the flooded nave carries the oath of a companion who refused to kneel.',
    dialogueLine2: 'Call upon the Hall of Ancestors — no soul walks the road to the First Eclipse alone.”',
    footerMeta: 'HALL OF ANCESTORS   ·   7 LIMITED OATH HEROES & SIGNATURE ARMAMENTS   ·   EARNABLE BELL’S REMAINS',
    badge: 'HALL OF ANCESTORS · SACRED OATH INVOCATIONS',
    headline: 'SUMMON LEGENDARY OATH COMPANIONS',
    subtitle: 'Forge unbreakable bonds with 25 companions and wield their 5★ signature armaments.',
  });

  console.log('✓ Step 3 complete: All 8 Google Play 1920x1080 showcase screenshots rebuilt.');
}

// ============================================================================
// STEP 4: REBUILD ALL 15 PART I STORY EVENT CGS (1920x1080)
// Using ONLY canonical in-game characters & backgrounds in logical story scenes
// ============================================================================
async function buildCanonicalStoryCg({
  outFileName,
  bgRelPath,
  secondaryBgRelPath = null,
  chapterBadge,
  sceneTitle,
  sceneQuote,
  atmosphereColor = '#D4AF37',
  glowColor = '#C968E8',
  actors = [],
}) {
  const outPath = path.join(WORKBENCH_CG_DIR, outFileName);

  let bgBuf = await sharp(path.join(ROOT, bgRelPath), { page: 0 })
    .resize(1920, 1080, { fit: 'cover', position: 'center' })
    .modulate({ brightness: 0.84, saturation: 1.04 })
    .png()
    .toBuffer();

  if (secondaryBgRelPath) {
    const secBuf = await sharp(path.join(ROOT, secondaryBgRelPath), { page: 0 })
      .resize(1920, 1080, { fit: 'cover', position: 'center' })
      .ensureAlpha(0.32)
      .png()
      .toBuffer();
    bgBuf = await sharp(bgBuf)
      .composite([{ input: secBuf, left: 0, top: 0, blend: 'screen' }])
      .png()
      .toBuffer();
  }

  // Atmospheric back-lighting behind the characters
  const backlightSvg = Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="cgGlow1" cx="50%" cy="46%" r="52%">
        <stop offset="0%" stop-color="${glowColor}" stop-opacity="0.32"/>
        <stop offset="55%" stop-color="${atmosphereColor}" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#05020A" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="cgVig" cx="50%" cy="48%" r="68%">
        <stop offset="52%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#040208" stop-opacity="0.78"/>
      </radialGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#cgGlow1)"/>
    <rect width="1920" height="1080" fill="url(#cgVig)"/>
  </svg>`);

  const composites = [{ input: backlightSvg, left: 0, top: 0 }];

  // Render each canonical character or boss in the scene
  for (const actor of actors) {
    if (actor.type === 'boss') {
      const bossBuf = await extractGroundedAtlasFrame(
        actor.atlas,
        actor.pose || 'active',
        actor.width || 520,
        actor.height || 520,
        Boolean(actor.flipX),
      );
      const bMeta = await sharp(bossBuf).metadata();
      const bw = bMeta.width ?? 440;
      const bh = bMeta.height ?? 440;
      composites.push({
        input: bossBuf,
        left: Math.round(actor.x - bw / 2),
        top: Math.round(actor.y - bh),
      });
    } else {
      const isAlreadyKneeUp =
        actor.portrait.includes('portrait_fadyme_') ||
        actor.portrait.includes('portrait_mahmut_') ||
        actor.portrait.includes('portrait_eclipse_construct_') ||
        actor.portrait.includes('portrait_ashen_lord_wraith_');
      const maxActorW = Math.min(actor.width || 560, 560);
      const maxActorH = Math.min(actor.height || 790, 790);
      let portBuf = await extractCanonicalPortrait(
        path.join(ROOT, actor.portrait),
        maxActorW,
        maxActorH,
        'inside',
        Boolean(actor.flipX),
        isAlreadyKneeUp ? 0.98 : 0.72,
      );
      const pMeta = await sharp(portBuf).metadata();
      const pw = pMeta.width ?? maxActorW;
      const ph = pMeta.height ?? maxActorH;
      // Anchor bottom of knee-up portrait behind the y=868 story plaque (at y=892) with guaranteed top headroom >= 42px!
      composites.push({
        input: portBuf,
        left: Math.round(actor.x - pw / 2),
        top: Math.max(42, Math.round(892 - ph)),
      });
    }
  }

  // Deterministic seed from filename for foreground ember/ash particles & light rays
  let seed = 0;
  for (let i = 0; i < outFileName.length; i++) {
    seed = (seed * 31 + outFileName.charCodeAt(i)) >>> 0;
  }
  const embers = [];
  for (let i = 0; i < 42; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const ex = 60 + (seed % 1800);
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const ey = 60 + (seed % 900);
    const r = 1.6 + (i % 5) * 1.1;
    const op = (0.28 + (i % 6) * 0.1).toFixed(2);
    const col = i % 3 === 0 ? '#FFE394' : i % 3 === 1 ? atmosphereColor : glowColor;
    embers.push(`<circle cx="${ex}" cy="${ey}" r="${r}" fill="${col}" fill-opacity="${op}"/>`);
  }

  // Cinematic letterbox bars, atmospheric foreground lighting & story caption plate
  const fgOverlaySvg = Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="cgBotShade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#05020A" stop-opacity="0"/>
        <stop offset="55%" stop-color="#07030E" stop-opacity="0.68"/>
        <stop offset="100%" stop-color="#040208" stop-opacity="0.96"/>
      </linearGradient>
      <linearGradient id="cgTopBar" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#040208" stop-opacity="0.92"/>
        <stop offset="100%" stop-color="#040208" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <!-- Diagonal Volumetric Light Beams -->
    <polygon points="180,0 520,0 980,1080 540,1080" fill="${atmosphereColor}" fill-opacity="0.06"/>
    <polygon points="1120,0 1480,0 1860,1080 1420,1080" fill="${glowColor}" fill-opacity="0.06"/>

    <!-- Floating Embers & Ash Motes -->
    ${embers.join('\n')}

    <!-- Top & Bottom Cinematic Framing -->
    <rect x="0" y="0" width="1920" height="86" fill="url(#cgTopBar)"/>
    <rect x="0" y="760" width="1920" height="320" fill="url(#cgBotShade)"/>
    <rect x="28" y="24" width="1864" height="1032" rx="8" fill="none" stroke="#D4AF37" stroke-width="1.6" stroke-opacity="0.45"/>

    <!-- Canonical Story Event CG Plate (Bottom Left) -->
    <g transform="translate(68, 868)">
      <rect x="0" y="0" width="1784" height="156" rx="10" fill="#0B0514" fill-opacity="0.88" stroke="#D4AF37" stroke-width="2"/>
      <rect x="8" y="8" width="1768" height="140" rx="6" fill="none" stroke="${glowColor}" stroke-width="1" stroke-opacity="0.45"/>
      <rect x="28" y="-18" width="380" height="36" rx="6" fill="#240F3B" stroke="#FFE394" stroke-width="1.6"/>
      <text x="218" y="5" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="13.5" font-weight="700" letter-spacing="2.4" fill="#FFE394">${escapeXml(chapterBadge)}</text>

      <text x="36" y="56" font-family="Cinzel, Georgia, serif" font-size="28" font-weight="800" letter-spacing="1.6" fill="#FFF6DC">${escapeXml(sceneTitle)}</text>
      <line x1="36" y1="74" x2="1748" y2="74" stroke="#D4AF37" stroke-width="1" stroke-opacity="0.42"/>
      <text x="36" y="114" font-family="Georgia, serif" font-size="22" font-style="italic" fill="#EADCF7">${escapeXml(sceneQuote)}</text>
    </g>
  </svg>`);

  composites.push({ input: fgOverlaySvg, left: 0, top: 0 });

  await sharp(bgBuf)
    .composite(composites)
    .flatten({ background: '#05020A' })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toFile(outPath);
}

async function runStep4Rebuild15StoryCgs() {
  console.log('Step 4: Rebuilding all 15 Part I Story Event CGs (cg_01..cg_15) with canonical in-game characters...');
  ensureDir(WORKBENCH_CG_DIR);

  const cgSpecs = [
    {
      outFileName: 'cg_01_opening_letter_v001.jpg',
      bgRelPath: 'content/base/art/bg_shelter_courtyard_dusk.webp',
      chapterBadge: 'CHAPTER I · EVENT CG 01',
      sceneTitle: 'THE LETTER SEALED IN ASH',
      sceneQuote: '“If the Sanctuary Bell still answers your hand, do not return to the capital — walk the road where names are kept.”',
      atmosphereColor: '#F2C96B',
      glowColor: '#C968E8',
      actors: [
        { portrait: 'content/base/art/portrait_fadyme_composed.webp', x: 580, y: 110, width: 560, height: 790 },
        { portrait: 'content/base/art/portrait_mahmut_composed.webp', x: 1340, y: 95, width: 560, height: 790 },
      ],
    },
    {
      outFileName: 'cg_02_the_roof_v001.jpg',
      bgRelPath: 'content/base/art/bg_shelter_courtyard_dusk.webp',
      chapterBadge: 'CHAPTER I · EVENT CG 02',
      sceneTitle: 'A ROOF BEFORE DAWN',
      sceneQuote: 'Sister Aveline tends the last shelter brazier beside Fadyme & Mahmut before the Bell Road claims the dawn.',
      atmosphereColor: '#FFB86B',
      glowColor: '#D4AF37',
      actors: [
        { portrait: 'content/approved_art/art/portrait_sister_aveline_warm.webp', x: 420, y: 115, width: 540, height: 780 },
        { portrait: 'content/base/art/portrait_fadyme_warm.webp', x: 960, y: 120, width: 540, height: 780 },
        { portrait: 'content/base/art/portrait_mahmut_watchful.webp', x: 1500, y: 100, width: 550, height: 790 },
      ],
    },
    {
      outFileName: 'cg_03_ash_falls_upward_v001.jpg',
      bgRelPath: 'content/approved_art/art/bg_forest_whispering_ash.webp',
      chapterBadge: 'CHAPTER I · EVENT CG 03',
      sceneTitle: 'WHERE THE ASH FALLS UPWARD',
      sceneQuote: 'When the cracked Sanctuary Bell tolls along the Whispering Road, even the cinders rise back toward the Eclipse.',
      atmosphereColor: '#E85C8A',
      glowColor: '#9A36D9',
      actors: [
        { portrait: 'content/approved_art/art/portrait_kera_voss_defiant.webp', x: 400, y: 120, width: 540, height: 780 },
        { portrait: 'content/base/art/portrait_fadyme_resolve.webp', x: 960, y: 100, width: 550, height: 790 },
        { portrait: 'content/base/art/portrait_mahmut_protective_resolve.webp', x: 1510, y: 95, width: 550, height: 790 },
      ],
    },
    {
      outFileName: 'cg_04_bell_widow_verdict_v001.jpg',
      bgRelPath: 'content/approved_art/art/bg_cathedral_saint_luthos.webp',
      chapterBadge: 'CHAPTER II · EVENT CG 04',
      sceneTitle: 'THE BELL WIDOW’S VERDICT',
      sceneQuote: 'Beneath the shattered choir of Saint Luthos, Garrick Cinder, Sister Aveline & Fadyme defy the Bell Widow’s toll.',
      atmosphereColor: '#FF4D79',
      glowColor: '#A63AE0',
      actors: [
        { portrait: 'content/approved_art/art/portrait_garrick_cinder_defiant.webp', x: 410, y: 110, width: 640, height: 950 },
        { portrait: 'content/approved_art/art/portrait_sister_aveline_defiant.webp', x: 960, y: 105, width: 650, height: 955 },
        { portrait: 'content/base/art/portrait_fadyme_resolve.webp', x: 1510, y: 105, width: 660, height: 960 },
      ],
    },
    {
      outFileName: 'cg_05_the_well_v001.jpg',
      bgRelPath: 'content/approved_art/art/bg_undercity_red_vial_ward.webp',
      chapterBadge: 'CHAPTER III · EVENT CG 05',
      sceneTitle: 'THE WELL OF RED GLASS',
      sceneQuote: 'Mirel Quill, Brin Alder & Fadyme uncover the Red Vial Matron’s alchemical cistern beneath Oakhaven.',
      atmosphereColor: '#E03E6D',
      glowColor: '#68B5E8',
      actors: [
        { portrait: 'content/approved_art/art/portrait_mirel_quill_focused.webp', x: 410, y: 110, width: 640, height: 950 },
        { portrait: 'content/approved_art/art/portrait_brin_alder_focused.webp', x: 960, y: 110, width: 640, height: 950 },
        { portrait: 'content/base/art/portrait_fadyme_resolve.webp', x: 1510, y: 105, width: 650, height: 955 },
      ],
    },
    {
      outFileName: 'cg_06_measure_of_a_life_v001.jpg',
      bgRelPath: 'content/approved_art/art/bg_oakhaven_refuge.webp',
      chapterBadge: 'CHAPTER III · EVENT CG 06',
      sceneTitle: 'THE MEASURE OF A LIFE',
      sceneQuote: '“No life in Oakhaven is weighed in red glass while the Vigil lamp still burns.” — Sister Aveline & Fadyme',
      atmosphereColor: '#7CE89B',
      glowColor: '#F2C96B',
      actors: [
        { portrait: 'content/approved_art/art/portrait_sister_aveline_focused.webp', x: 420, y: 115, width: 640, height: 940 },
        { portrait: 'content/base/art/portrait_fadyme_wry.webp', x: 960, y: 115, width: 640, height: 940 },
        { portrait: 'content/approved_art/art/portrait_rikka_ember_focused.webp', x: 1490, y: 120, width: 630, height: 940 },
      ],
    },
    {
      outFileName: 'cg_07_white_strand_v001.jpg',
      bgRelPath: 'content/approved_art/art/bg_forest_whispering_ash.webp',
      chapterBadge: 'CHAPTER IV · EVENT CG 07',
      sceneTitle: 'A SINGLE WHITE STRAND',
      sceneQuote: 'By the dying embers of the roadside watch, Mahmut notices the ash-white lock braided through Fadyme’s hair.',
      atmosphereColor: '#FFB86B',
      glowColor: '#C968E8',
      actors: [
        { portrait: 'content/base/art/portrait_fadyme_wry.webp', x: 640, y: 90, width: 560, height: 790 },
        { portrait: 'content/base/art/portrait_mahmut_watchful.webp', x: 1290, y: 80, width: 560, height: 790 },
      ],
    },
    {
      outFileName: 'cg_08_oren_holds_the_span_v001.jpg',
      bgRelPath: 'content/approved_art/art/bg_bridge_forsaken.webp',
      chapterBadge: 'CHAPTER IV · EVENT CG 08',
      sceneTitle: 'OREN HOLDS THE IRON-CHAIN SPAN',
      sceneQuote: 'Marshal Oren, Gatewarden Nara Vell & Captain Rusk lock shields across the Forsaken Bridge against the Regency host.',
      atmosphereColor: '#68B5E8',
      glowColor: '#E05A47',
      actors: [
        { portrait: 'content/approved_art/art/portrait_nara_vell_defiant.webp', x: 400, y: 110, width: 640, height: 950 },
        { portrait: 'content/approved_art/art/portrait_marshal_oren_defiant.webp', x: 960, y: 95, width: 680, height: 970 },
        { portrait: 'content/approved_art/art/portrait_rusk_defiant.webp', x: 1520, y: 110, width: 640, height: 950 },
      ],
    },
    {
      outFileName: 'cg_09_portraits_without_names_v001.jpg',
      bgRelPath: 'content/approved_art/art/bg_ashen_estate_gallery.webp',
      chapterBadge: 'CHAPTER V · EVENT CG 09',
      sceneTitle: 'PORTRAITS WITHOUT NAMES',
      sceneQuote: 'In the Ashen Lord’s gallery, Sable Wren & Fadyme confront Lady Yseldra Vale beneath the defaced lineage of Veyrhold.',
      atmosphereColor: '#D4AF37',
      glowColor: '#9A36D9',
      actors: [
        { portrait: 'content/approved_art/art/portrait_sable_wren_focused.webp', x: 410, y: 115, width: 630, height: 940 },
        { portrait: 'content/base/art/portrait_fadyme_composed.webp', x: 960, y: 115, width: 640, height: 940 },
        { portrait: 'content/approved_art/art/portrait_lady_yseldra_vale_focused.webp', x: 1510, y: 110, width: 640, height: 950 },
      ],
    },
    {
      outFileName: 'cg_10_stair_of_seven_chains_v001.jpg',
      bgRelPath: 'content/approved_art/art/bg_undercity_cistern_stairs.webp',
      chapterBadge: 'CHAPTER V · EVENT CG 10',
      sceneTitle: 'THE STAIR OF SEVEN CHAINS',
      sceneQuote: 'Vespera Wisp raises the Lantern of the Last Hour to guide Sable Wren & Odelia Pike into the Drowned Bell Undercity.',
      atmosphereColor: '#68B5E8',
      glowColor: '#C968E8',
      actors: [
        { portrait: 'content/approved_art/art/portrait_sable_wren_defiant.webp', x: 410, y: 115, width: 630, height: 940 },
        { portrait: 'content/approved_art/art/portrait_vespera_wisp_focused.webp', x: 960, y: 105, width: 660, height: 950 },
        { portrait: 'content/approved_art/art/portrait_odelia_pike_focused.webp', x: 1510, y: 115, width: 630, height: 940 },
      ],
    },
    {
      outFileName: 'cg_11_those_who_held_the_road_v001.jpg',
      bgRelPath: 'content/approved_art/art/bg_forgotten_stone_crossing.webp',
      chapterBadge: 'CHAPTER VI · EVENT CG 11',
      sceneTitle: 'THOSE WHO HELD THE ROAD',
      sceneQuote: 'Garrick Cinder, Nara Vell, Kera Voss & Brin Alder form an unbreakable rear-guard at the Forgotten Stone Crossing.',
      atmosphereColor: '#E05A47',
      glowColor: '#D4AF37',
      actors: [
        { portrait: 'content/approved_art/art/portrait_garrick_cinder_defiant.webp', x: 280, y: 120, width: 590, height: 930 },
        { portrait: 'content/approved_art/art/portrait_nara_vell_focused.webp', x: 730, y: 115, width: 600, height: 940 },
        { portrait: 'content/approved_art/art/portrait_kera_voss_defiant.webp', x: 1190, y: 115, width: 600, height: 940 },
        { portrait: 'content/approved_art/art/portrait_brin_alder_defiant.webp', x: 1640, y: 120, width: 590, height: 930 },
      ],
    },
    {
      outFileName: 'cg_12_names_we_kept_v001.jpg',
      bgRelPath: 'content/approved_art/art/bg_altar_round_archive.webp',
      chapterBadge: 'CHAPTER VI · EVENT CG 12',
      sceneTitle: 'THE NAMES WE KEPT',
      sceneQuote: 'In the Round Archive, Sister Aveline, Pippa Bell & Mirel Quill restore the erased names to the Sanctuary ledger.',
      atmosphereColor: '#FFE394',
      glowColor: '#68B5E8',
      actors: [
        { portrait: 'content/approved_art/art/portrait_sister_aveline_composed.webp', x: 420, y: 115, width: 630, height: 940 },
        { portrait: 'content/approved_art/art/portrait_pippa_bell_warm.webp', x: 960, y: 125, width: 620, height: 930 },
        { portrait: 'content/approved_art/art/portrait_mirel_quill_composed.webp', x: 1500, y: 115, width: 630, height: 940 },
      ],
    },
    {
      outFileName: 'cg_13_the_words_he_did_not_know_v001.jpg',
      bgRelPath: 'content/approved_art/art/bg_estate_ashen_lord.webp',
      chapterBadge: 'CHAPTER VII · EVENT CG 13',
      sceneTitle: 'THE WORDS HE DID NOT KNOW',
      sceneQuote: 'Before the Throne of Cracked Gold, Mahmut & Fadyme face Lord Cael Veyr and the Wraith of the Ashen Lord.',
      atmosphereColor: '#D94B72',
      glowColor: '#9A36D9',
      actors: [
        { portrait: 'content/base/art/portrait_mahmut_protective_resolve.webp', x: 310, y: 95, width: 630, height: 960 },
        { portrait: 'content/base/art/portrait_fadyme_resolve.webp', x: 760, y: 110, width: 610, height: 950 },
        { portrait: 'content/approved_art/art/portrait_lord_cael_veyr_defiant.webp', x: 1220, y: 105, width: 610, height: 950 },
        { portrait: 'content/approved_art/art/portrait_ashen_lord_wraith_defiant.webp', x: 1650, y: 100, width: 610, height: 955 },
      ],
    },
    {
      outFileName: 'cg_14_the_hour_that_remained_v001.jpg',
      bgRelPath: 'content/approved_art/art/bg_altar_first_eclipse.webp',
      chapterBadge: 'CHAPTER VII · EVENT CG 14',
      sceneTitle: 'THE HOUR THAT REMAINED',
      sceneQuote: 'At the Altar of the First Eclipse, Fadyme, Sister Aveline & Vespera Wisp ring the Sanctuary Bell against totality.',
      atmosphereColor: '#C968E8',
      glowColor: '#FFE394',
      actors: [
        { portrait: 'content/approved_art/art/portrait_sister_aveline_focused.webp', x: 310, y: 115, width: 610, height: 940 },
        { portrait: 'content/base/art/portrait_fadyme_resolve.webp', x: 760, y: 105, width: 630, height: 960 },
        { portrait: 'content/approved_art/art/portrait_vespera_wisp_defiant.webp', x: 1210, y: 115, width: 610, height: 940 },
        { portrait: 'content/approved_art/art/portrait_eclipse_construct_defiant.webp', x: 1650, y: 100, width: 620, height: 955 },
      ],
    },
    {
      outFileName: 'cg_15_uncle_v001.jpg',
      bgRelPath: 'content/approved_art/art/bg_altar_first_eclipse.webp',
      chapterBadge: 'CHAPTER VII FINALE · EVENT CG 15',
      sceneTitle: '“UNCLE.”',
      sceneQuote: 'As the First Eclipse parts above the silent bell, Fadyme reaches for the weathered hand that never left her side.',
      atmosphereColor: '#FFE394',
      glowColor: '#E85C8A',
      actors: [
        { portrait: 'content/base/art/portrait_mahmut_dry_humor.webp', x: 630, y: 85, width: 560, height: 790 },
        { portrait: 'content/base/art/portrait_fadyme_warm.webp', x: 1290, y: 95, width: 560, height: 790 },
      ],
    },
  ];

  for (const spec of cgSpecs) {
    await buildCanonicalStoryCg(spec);
  }

  console.log('✓ Step 4 complete: All 15 canonical Part I Story Event CGs (cg_01..cg_15) generated.');
}

// ============================================================================
// STEP 5: ANIMATE TITLE BACKGROUND & PROLOGUE STILLS AS LIVING WEBP LOOPS
// Creates smooth 10-frame looping animated WebPs with drifting glowing embers,
// pulsing Eclipse/lantern aura, and rising ash motes.
// ============================================================================
async function buildAnimatedLivingWebp(relPaths, theme) {
  const srcPath = path.join(ROOT, relPaths[0]);
  const srcBuf = fs.readFileSync(srcPath);
  const meta = await sharp(srcBuf).metadata();
  const width = meta.width ?? 1920;
  const height = meta.height ?? 1080;
  const basePng = await sharp(srcBuf)
    .resize(width, height, { fit: 'cover' })
    .png()
    .toBuffer();

  const frameCount = 10;
  const frameDelays = new Array(frameCount).fill(110); // ~9 FPS smooth atmospheric loop

  // Generate 36 deterministic ember/ash particles
  let seed = 0;
  for (let i = 0; i < relPaths[0].length; i++) {
    seed = (seed * 33 + relPaths[0].charCodeAt(i)) >>> 0;
  }
  const particles = [];
  for (let i = 0; i < 36; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x0 = 40 + (seed % (width - 80));
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y0 = 40 + (seed % (height - 80));
    const radius = 2.2 + (i % 5) * 1.4;
    const ampX = 14 + (i % 4) * 8;
    const ampY = 22 + (i % 5) * 10;
    const phase = (i / 36) * Math.PI * 2;
    const isGold = i % 2 === 0;
    particles.push({ x0, y0, radius, ampX, ampY, phase, isGold });
  }

  const rawFrames = [];
  for (let f = 0; f < frameCount; f++) {
    const t = (f / frameCount) * Math.PI * 2;
    const pulse = 0.5 + 0.5 * Math.sin(t);

    const particleCircles = particles.map((p) => {
      // Smooth periodic motion so frame 9 loops seamlessly into frame 0!
      const px = (p.x0 + Math.sin(t + p.phase) * p.ampX).toFixed(1);
      const py = (p.y0 + Math.cos(t + p.phase) * p.ampY).toFixed(1);
      const op = (0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2 + p.phase))).toFixed(2);
      const col = p.isGold ? theme.sparkPrimary : theme.sparkSecondary;
      return `
        <circle cx="${px}" cy="${py}" r="${(p.radius * 2.4).toFixed(1)}" fill="${col}" fill-opacity="${(Number(op) * 0.28).toFixed(2)}"/>
        <circle cx="${px}" cy="${py}" r="${p.radius.toFixed(1)}" fill="#FFF9E6" fill-opacity="${op}"/>
      `;
    });

    const auraOpacity1 = (0.14 + 0.16 * pulse).toFixed(3);
    const auraOpacity2 = (0.10 + 0.14 * (1 - pulse)).toFixed(3);
    const ringRadius = Math.round(theme.ringBaseRadius + 18 * Math.sin(t));

    const fxSvg = Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="pulseA${f}" cx="${theme.glowX}" cy="${theme.glowY}" r="48%">
          <stop offset="0%" stop-color="${theme.glowColor}" stop-opacity="${auraOpacity1}"/>
          <stop offset="55%" stop-color="${theme.secondaryGlow}" stop-opacity="${auraOpacity2}"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#pulseA${f})"/>
      <circle cx="${theme.ringX}" cy="${theme.ringY}" r="${ringRadius}" fill="none" stroke="${theme.sparkPrimary}" stroke-width="2" stroke-opacity="${(0.18 + 0.22 * pulse).toFixed(2)}"/>
      ${particleCircles.join('\n')}
    </svg>`);

    const frameRaw = await sharp(basePng)
      .composite([{ input: fxSvg, left: 0, top: 0 }])
      .removeAlpha()
      .raw()
      .toBuffer();

    rawFrames.push(frameRaw);
  }

  const stackedRaw = Buffer.concat(rawFrames);
  const animatedWebpBuf = await sharp(stackedRaw, {
    raw: {
      width,
      height: height * frameCount,
      channels: 3,
      pageHeight: height,
    },
  })
    .webp({
      quality: 86,
      loop: 0,
      delay: frameDelays,
    })
    .toBuffer();

  for (const rel of relPaths) {
    fs.writeFileSync(path.join(ROOT, rel), animatedWebpBuf);
  }
}

async function runStep5AnimateTitleAndPrologueWebps() {
  console.log('Step 5: Converting ui_title_bg.webp & all 6 Prologue Stills into looping animated Living WebPs...');

  const targets = [
    {
      paths: ['content/base/art/ui_title_bg.webp', 'content/approved_art/art/ui_title_bg.webp'],
      theme: {
        glowX: '50%',
        glowY: '26%',
        glowColor: '#FF4D79',
        secondaryGlow: '#C968E8',
        sparkPrimary: '#FFE394',
        sparkSecondary: '#FF5E8E',
        ringX: 960,
        ringY: 280,
        ringBaseRadius: 190,
      },
    },
    {
      paths: ['content/base/art/still_prologue_beginning.webp', 'content/approved_art/art/still_prologue_beginning.webp'],
      theme: {
        glowX: '52%',
        glowY: '42%',
        glowColor: '#FFB86B',
        secondaryGlow: '#D4AF37',
        sparkPrimary: '#FFE394',
        sparkSecondary: '#FFA057',
        ringX: 980,
        ringY: 440,
        ringBaseRadius: 150,
      },
    },
    {
      paths: ['content/base/art/still_prologue_ordinary_days.webp', 'content/approved_art/art/still_prologue_ordinary_days.webp'],
      theme: {
        glowX: '52%',
        glowY: '40%',
        glowColor: '#FFB86B',
        secondaryGlow: '#D4AF37',
        sparkPrimary: '#FFE394',
        sparkSecondary: '#FFA866',
        ringX: 980,
        ringY: 420,
        ringBaseRadius: 155,
      },
    },
    {
      paths: ['content/base/art/still_prologue_throne_wars.webp', 'content/approved_art/art/still_prologue_throne_wars.webp'],
      theme: {
        glowX: '50%',
        glowY: '36%',
        glowColor: '#E05A47',
        secondaryGlow: '#D4AF37',
        sparkPrimary: '#FFE394',
        sparkSecondary: '#FF6B6B',
        ringX: 960,
        ringY: 390,
        ringBaseRadius: 185,
      },
    },
    {
      paths: ['content/base/art/still_prologue_crownfall.webp', 'content/approved_art/art/still_prologue_crownfall.webp'],
      theme: {
        glowX: '50%',
        glowY: '32%',
        glowColor: '#FF3B5C',
        secondaryGlow: '#FF884D',
        sparkPrimary: '#FFE394',
        sparkSecondary: '#FF4D6D',
        ringX: 960,
        ringY: 320,
        ringBaseRadius: 210,
      },
    },
    {
      paths: ['content/base/art/still_prologue_search.webp', 'content/approved_art/art/still_prologue_search.webp'],
      theme: {
        glowX: '48%',
        glowY: '42%',
        glowColor: '#FFB86B',
        secondaryGlow: '#68B5E8',
        sparkPrimary: '#FFE394',
        sparkSecondary: '#9AD4FF',
        ringX: 920,
        ringY: 440,
        ringBaseRadius: 160,
      },
    },
    {
      paths: ['content/base/art/still_prologue_roads.webp', 'content/approved_art/art/still_prologue_roads.webp'],
      theme: {
        glowX: '50%',
        glowY: '48%',
        glowColor: '#E05A47',
        secondaryGlow: '#C968E8',
        sparkPrimary: '#FFE394',
        sparkSecondary: '#FF8866',
        ringX: 960,
        ringY: 500,
        ringBaseRadius: 165,
      },
    },
    {
      paths: ['content/base/art/still_prologue_names.webp', 'content/approved_art/art/still_prologue_names.webp'],
      theme: {
        glowX: '48%',
        glowY: '50%',
        glowColor: '#D4AF37',
        secondaryGlow: '#9A36D9',
        sparkPrimary: '#FFE394',
        sparkSecondary: '#D8B2FF',
        ringX: 920,
        ringY: 520,
        ringBaseRadius: 150,
      },
    },
    {
      paths: ['content/base/art/still_prologue_reunion.webp', 'content/approved_art/art/still_prologue_reunion.webp'],
      theme: {
        glowX: '50%',
        glowY: '44%',
        glowColor: '#C968E8',
        secondaryGlow: '#FFB86B',
        sparkPrimary: '#FFE394',
        sparkSecondary: '#E298FF',
        ringX: 960,
        ringY: 460,
        ringBaseRadius: 165,
      },
    },
    {
      paths: ['content/base/art/still_prologue_hours.webp', 'content/approved_art/art/still_prologue_hours.webp'],
      theme: {
        glowX: '50%',
        glowY: '35%',
        glowColor: '#9A36D9',
        secondaryGlow: '#FF4D79',
        sparkPrimary: '#FFE394',
        sparkSecondary: '#C968E8',
        ringX: 960,
        ringY: 375,
        ringBaseRadius: 185,
      },
    },
  ];

  for (const t of targets) {
    await buildAnimatedLivingWebp(t.paths, t.theme);
  }

  console.log('✓ Step 5 complete: ui_title_bg.webp & all 6 Prologue Stills are now looping animated Living WebPs.');
}

// ============================================================================
// STEP 6: FIX SISTER AVELINE SIGNATURE WEAPON ICON (icon_sig_last_vigil_staff.png)
// Matches the exact Sunburst-Halo Lantern Staff held in Sister Aveline's portrait
// ============================================================================
async function runStep6FixSisterAvelineWeaponIcon() {
  console.log('Step 6: Aligning Sister Aveline signature weapon icon (icon_sig_last_vigil_staff.png) to her portrait staff...');
  const avelinePort = fs.readFileSync(
    path.join(ROOT, 'content/approved_art/art/portrait_sister_aveline_composed.webp'),
  );
  // Extract ONLY the sunburst halo + suspended hexagonal lantern + gilded scrollwork collar
  const rawCrop = await sharp(avelinePort)
    .extract({ left: 45, top: 142, width: 300, height: 336 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Clear the bottom-right corner where the edge of her white sleeve enters (x > 215 && y > 240)
  for (let y = 235; y < rawCrop.info.height; y++) {
    for (let x = 210; x < rawCrop.info.width; x++) {
      rawCrop.data[(y * rawCrop.info.width + x) * 4 + 3] = 0;
    }
  }

  const staffHead = await sharp(rawCrop.data, {
    raw: { width: rawCrop.info.width, height: rawCrop.info.height, channels: 4 },
  })
    .resize(188, 206, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const iconFrameSvg = Buffer.from(`<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="avBg" cx="50%" cy="46%" r="52%">
        <stop offset="0%" stop-color="#3B244F"/>
        <stop offset="58%" stop-color="#170E24"/>
        <stop offset="100%" stop-color="#090510"/>
      </radialGradient>
      <radialGradient id="avGlow" cx="50%" cy="44%" r="44%">
        <stop offset="0%" stop-color="#FFE394" stop-opacity="0.58"/>
        <stop offset="65%" stop-color="#D4AF37" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="avGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFF4CC"/>
        <stop offset="45%" stop-color="#D4AF37"/>
        <stop offset="100%" stop-color="#7A5813"/>
      </linearGradient>
    </defs>
    <!-- Ornate Gothic 5★ Weapon Frame -->
    <rect x="8" y="8" width="240" height="240" rx="22" fill="url(#avBg)" stroke="url(#avGold)" stroke-width="6"/>
    <rect x="16" y="16" width="224" height="224" rx="16" fill="none" stroke="#FFE394" stroke-width="1.5" stroke-opacity="0.58"/>
    <polygon points="8,36 36,8 46,8 8,46" fill="url(#avGold)" opacity="0.75"/>
    <polygon points="248,36 220,8 210,8 248,46" fill="url(#avGold)" opacity="0.75"/>
    <circle cx="128" cy="112" r="96" fill="url(#avGlow)"/>
    <circle cx="128" cy="112" r="88" fill="none" stroke="#D4AF37" stroke-width="1.4" stroke-opacity="0.45" stroke-dasharray="6 5"/>
  </svg>`);

  const starsOverlaySvg = Buffer.from(`<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <rect x="44" y="210" width="168" height="30" rx="15" fill="#12081E" fill-opacity="0.95" stroke="#D4AF37" stroke-width="1.8"/>
    <text x="128" y="231" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="18" font-weight="700" letter-spacing="3" fill="#FFE394">★★★★★</text>
  </svg>`);

  const outPng = await sharp(iconFrameSvg)
    .composite([
      { input: staffHead, left: 34, top: 8 },
      { input: starsOverlaySvg, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  const outRgba = path.join(
    ROOT,
    'narrative/15_Art_Workbench/icons/production_v001/icons_rgba/icon_sig_last_vigil_staff.png',
  );
  fs.writeFileSync(outRgba, outPng);

  const outWebpBase = path.join(ROOT, 'content/base/art/icon_sig_last_vigil_staff.webp');
  const outWebpApp = path.join(ROOT, 'content/approved_art/art/icon_sig_last_vigil_staff.webp');
  const webpBuf = await sharp(outPng).webp({ quality: 94 }).toBuffer();
  if (fs.existsSync(outWebpBase)) fs.writeFileSync(outWebpBase, webpBuf);
  if (fs.existsSync(outWebpApp)) fs.writeFileSync(outWebpApp, webpBuf);

  console.log('✓ Step 6 complete: icon_sig_last_vigil_staff.png now matches Sister Aveline’s exact sunburst-halo lantern staff.');
}

async function runStep7SyncApprovedArtAndProvenance() {
  console.log('Step 7: Syncing content/approved_art/entries/*.json & content/provenance.json hashes...');
  const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');

  const entriesDir = path.join(ROOT, 'content/approved_art/entries');
  if (fs.existsSync(entriesDir)) {
    const files = fs.readdirSync(entriesDir).filter((f) => f.endsWith('.json')).sort();
    let updatedCount = 0;
    for (const f of files) {
      const entryPath = path.join(entriesDir, f);
      const entry = JSON.parse(fs.readFileSync(entryPath, 'utf8'));
      let changed = false;
      for (const out of entry.outputs ?? []) {
        const absOut = path.join(ROOT, 'content/approved_art', out.path);
        if (!fs.existsSync(absOut)) continue;
        const actualBytes = fs.readFileSync(absOut);
        const actualSha = sha256Hex(actualBytes);
        if (actualSha !== out.sha256 || actualBytes.length !== out.bytes) {
          const decoded = await sharp(actualBytes).ensureAlpha().raw().toBuffer();
          out.sha256 = actualSha;
          out.pixels_sha256 = sha256Hex(decoded);
          out.bytes = actualBytes.length;
          changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(entryPath, `${JSON.stringify(entry, null, 2)}\n`);
        updatedCount++;
      }
    }
    console.log(`  Updated ${updatedCount} approved_art entry manifests.`);
  }

  const provPath = path.join(ROOT, 'content/provenance.json');
  if (fs.existsSync(provPath)) {
    const prov = JSON.parse(fs.readFileSync(provPath, 'utf8'));
    for (const relOut of ['content/base/art/ui_logo.webp', 'content/base/art/ui_key_art.webp']) {
      const absOut = path.join(ROOT, relOut);
      if (!fs.existsSync(absOut)) continue;
      const rec = (prov.outputs ?? []).find((o) => o.output === relOut);
      if (rec) {
        rec.sha256 = sha256Hex(fs.readFileSync(absOut));
      }
    }
    fs.writeFileSync(provPath, `${JSON.stringify(prov, null, 2)}\n`);
  }
  console.log('✓ Step 7 complete: approved_art entries and provenance synced.');
}

async function main() {
  console.log('=== Applying Grup 1 & Grup 2 Visual Revisions ===');
  if (process.argv.includes('--only-7')) {
    await runStep7SyncApprovedArtAndProvenance();
    return;
  }
  if (process.argv.includes('--only-4-6')) {
    await runStep4Rebuild15StoryCgs();
    await runStep6FixSisterAvelineWeaponIcon();
    await runStep7SyncApprovedArtAndProvenance();
    console.log('=== Steps 4, 6 & 7 Successfully Applied! ===');
    return;
  }
  await runStep1WeatherMahmut();
  await runStep2LogosIconAndFeatureGraphic();
  await runStep3StoreScreenshots();
  await runStep4Rebuild15StoryCgs();
  await runStep5AnimateTitleAndPrologueWebps();
  await runStep6FixSisterAvelineWeaponIcon();
  await runStep7SyncApprovedArtAndProvenance();
  console.log('=== All Grup 1 & Grup 2 Revisions Successfully Applied! ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

