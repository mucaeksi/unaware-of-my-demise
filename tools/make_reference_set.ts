/**
 * Builds the curated visual REFERENCE set (reference/derived/*.webp + reference/INDEX.json) from the legacy
 * images that are being archived (owner decision 2026-10-10: all visuals are regenerated with Google models; old art
 * is only used as reference material in prompts). Run it BEFORE the originals are removed from the working tree, or
 * point it at a checkout of the archive branch:  npx tsx tools/make_reference_set.ts [--root <checkout>]
 * Originals stay recoverable from the read-only branch archive/pre-cleanup-2026-10-10; the derivatives are 1536 px
 * WebP copies that record the sha256 of the original they were made from.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';

type Status = 'LOCKED_OWNER_APPROVED' | 'DESIGN_CANDIDATE_NOT_OWNER_APPROVED';
interface Source { id: string; path: string; role: string; status: Status }

const LOCKED = 'narrative/14_References/recovered_locked_v001';
const SOURCES: Source[] = [
  ...['composed_v001', 'honest_fear_v001', 'quiet_pain_v002', 'warm_v001'].map((n): Source => ({ id: `fadyme_vn_bust_${n}`, path: `${LOCKED}/fadyme/vn_bust/vn_bust_fadyme_${n}.png`, role: 'Fadyme visual-novel bust (expression reference)', status: 'LOCKED_OWNER_APPROVED' })),
  ...['attack_v003', 'guard_v003', 'hit_v003', 'idle_v002', 'skill_v002', 'victory_v002'].map((n): Source => ({ id: `fadyme_battle_pose_${n}`, path: `${LOCKED}/fadyme/battle_pose/battle_pose_fadyme_${n}.png`, role: 'Fadyme chibi battle pose (pose/silhouette reference)', status: 'LOCKED_OWNER_APPROVED' })),
  { id: 'fadyme_cut_in_ultimate_v002', path: `${LOCKED}/fadyme/cut_in/cut_in_fadyme_ultimate_v002.png`, role: 'Fadyme ultimate cut-in (composition reference)', status: 'LOCKED_OWNER_APPROVED' },
  { id: 'icons_pilot_mixed_16', path: `${LOCKED}/icons/icons_pilot_mixed_16_mixed_v001.png`, role: 'UI icon style sheet', status: 'LOCKED_OWNER_APPROVED' },
  { id: 'brand_key_art_with_logo_v003', path: `${LOCKED}/key_art/brand_key_art_portrait_r2_v003_with_logo.png`, role: 'Key art with logo (brand composition reference)', status: 'LOCKED_OWNER_APPROVED' },
  { id: 'forest_whispering_ash_ordered_v001', path: 'narrative/08_Locations/Reference_Images/forest_whispering_ash/bg_forest_whispering_ash_ordered_v001.png', role: 'Location plate: Whispering Ash forest', status: 'LOCKED_OWNER_APPROVED' },
  { id: 'forest_whispering_ash_battle_plate_v002', path: 'narrative/08_Locations/Reference_Images/forest_whispering_ash/bg_forest_whispering_ash_battle_plate_ordered_v002.png', role: 'Location plate: Whispering Ash battle arena', status: 'LOCKED_OWNER_APPROVED' },
  ...['ch01_whispering_ash_v001', 'ch02_saint_luthos_v001', 'ch03_oakhaven_v001', 'ch04_undercity_v001', 'ch05_forsaken_bridge_v002', 'ch06_ashen_estate_v001', 'ch07_first_eclipse_v003'].map((n): Source => ({ id: `enemy_board_${n}`, path: `narrative/15_Art_Workbench/enemies/design_v001/boards/${n}.png`, role: 'Enemy design board (silhouette / design intent; text lives in design_cards.json)', status: 'DESIGN_CANDIDATE_NOT_OWNER_APPROVED' }))
];

const rootArg = process.argv.indexOf('--root');
const ROOT = resolve(rootArg >= 0 ? (process.argv[rootArg + 1] as string) : join(import.meta.dirname, '..'));
const OUT = join(import.meta.dirname, '..', 'reference');
const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

mkdirSync(join(OUT, 'derived'), { recursive: true });
const entries: Record<string, unknown>[] = [];
for (const s of SOURCES) {
  const abs = join(ROOT, s.path);
  if (!existsSync(abs)) throw new Error(`missing source ${s.path} (use --root <checkout of archive/pre-cleanup-2026-10-10>)`);
  const original = readFileSync(abs);
  const img = await sharp(original).resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 5 }).toBuffer({ resolveWithObject: true });
  const file = `derived/${s.id}.webp`;
  writeFileSync(join(OUT, file), img.data);
  entries.push({ id: s.id, role: s.role, status: s.status, file: `reference/${file}`, width: img.info.width, height: img.info.height, bytes: img.data.length, sha256: sha(img.data), derived_from: { path_at_archive: s.path, bytes: original.length, sha256: sha(original) } });
  console.log(`${s.id}: ${original.length} -> ${img.data.length} B`);
}
const total = entries.reduce((n, e) => n + (e.bytes as number), 0);
const index = {
  schema_version: 1,
  purpose: 'Prompt/visual references for Google-generated art. Not shippable assets.',
  archive_ref: 'branch archive/pre-cleanup-2026-10-10 (full pre-cleanup tree); older Godot-era tree: branch archive/godot-era',
  byte_exact_originals: [
    { file: 'reference/locked/fadyme/sheet/char-fadyme-uomd.png', role: 'CANONICAL Fadyme model sheet (turnaround, expressions, palette, materials, chibi/battle sprites)', status: 'LOCKED_OWNER_APPROVED' },
    { file: 'reference/locked/fadyme/sheet/chibi_ref_fadyme.png', role: 'Fadyme chibi reference crop (low resolution)', status: 'LOCKED_OWNER_APPROVED' },
    { file: 'narrative/14_References/recovered_locked_v001/logo/brand_logo_wordmark_r2_v003.png', role: 'Brand wordmark (also read by the content build)', status: 'LOCKED_OWNER_APPROVED' },
    { file: 'narrative/14_References/recovered_locked_v001/key_art/brand_key_art_portrait_r2_v003.png', role: 'Key art (also read by the content build)', status: 'LOCKED_OWNER_APPROVED' }
  ],
  derivatives: entries,
  derivatives_total_bytes: total
};
writeFileSync(join(OUT, 'INDEX.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(`${entries.length} derivatives, ${total} bytes -> reference/INDEX.json (${basename(OUT)})`);
