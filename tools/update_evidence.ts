/**
 * Refreshes docs/evidence (shown in the Control Center "Development > Screens" tab) from the latest browser-test screenshots in
 * .cache/e2e-shots: desktop shots at 1280 px wide, one phone shot per screen, WebP. Run after `npm run e2e`.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT } from './lib/fsutil';

const src = join(ROOT, '.cache/e2e-shots');
const dst = join(ROOT, 'docs/evidence');
if (!existsSync(src)) throw new Error('no .cache/e2e-shots: run `npm run e2e` first');
const NAME: Record<string, string> = {
  '01-title': 'title', '02-story': 'story', '03-battle': 'battle', '05-victory': 'victory', '06-patch-lab': 'patch-lab', '07-chapters-patched': 'chapters',
  '10-account-signed-out': 'account-signed-out', '11-summon': 'summon', '12-summon-result': 'summon-result', '13-mail': 'mail', '14-roster': 'roster'
};
let n = 0;
for (const f of readdirSync(src)) {
  const m = /^(landscape-desktop|phone-landscape)-(.+)\.png$/.exec(f);
  const base = m?.[2] ? NAME[m[2]] : undefined;
  if (!m || !base) continue;
  const phone = m[1] === 'phone-landscape';
  if (phone && !['battle', 'summon', 'summon-result', 'mail', 'roster', 'title'].includes(base)) continue;
  await sharp(join(src, f)).resize({ width: phone ? 1200 : 1280, withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(dst, `${phone ? 'phone' : 'desktop'}-${base}.webp`));
  n++;
}
console.log(`${n} screenshots -> docs/evidence`);
