/* global Buffer, console, process */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const inputDir = path.resolve(process.cwd(), 'docs/store/assets');
const outputDir = path.resolve(process.cwd(), 'docs/store/generated');

fs.mkdirSync(outputDir, { recursive: true });

const files = [
  'icon_512.png',
  'feature_graphic_1024x500.png',
  'screen_01.png',
  'screen_02.png',
  'screen_03.png',
  'screen_04.png',
  'screen_05.png',
  'screen_06.png',
];

for (const file of files) {
  const source = path.join(inputDir, file);
  if (!fs.existsSync(source)) continue;

  const image = sharp(source);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const safeName = file.replace(/\.[^.]+$/, '') + '-canonical.png';
  const outPath = path.join(outputDir, safeName);

  await image
    .resize(width > 0 ? Math.min(width, 2048) : 2048, height > 0 ? Math.min(height, 2048) : 2048, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log(`generated ${outPath}`);
}

console.log('Canonical store and brand assets built.');
