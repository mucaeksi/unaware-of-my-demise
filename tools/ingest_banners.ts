/**
 * Generates and runs the 16 canonical banner ingest specs (`content/specs/image/banner_*.ingest.json`)
 * from `narrative/15_Art_Workbench/banners/banner_*_v001.jpg`, exporting approved `1376x768` WebP
 * plates (`content/approved_art/art/ui_banner_*.webp`) and `targets.ui` manifest mappings.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { approveArtEntry, initIngestSpec, runIngest } from './ingest_art';
import { ROOT } from './lib/fsutil';

const BANNERS = [
  ['banner_hall_of_ancestors', 'narrative/15_Art_Workbench/banners/banner_hall_of_ancestors_v001.jpg'],
  ['banner_oath_01_sister', 'narrative/15_Art_Workbench/banners/banner_oath_01_aveline_v001.jpg'],
  ['banner_oath_02_sable', 'narrative/15_Art_Workbench/banners/banner_oath_02_sable_v001.jpg'],
  ['banner_oath_03_nara', 'narrative/15_Art_Workbench/banners/banner_oath_03_nara_v001.jpg'],
  ['banner_oath_04_mirel', 'narrative/15_Art_Workbench/banners/banner_oath_04_mirel_v001.jpg'],
  ['banner_oath_05_vespera', 'narrative/15_Art_Workbench/banners/banner_oath_05_vespera_v001.jpg'],
  ['banner_oath_06_garrick', 'narrative/15_Art_Workbench/banners/banner_oath_06_garrick_v001.jpg'],
  ['banner_oath_07_corbin', 'narrative/15_Art_Workbench/banners/banner_oath_07_corbin_v001.jpg'],
  ['banner_hall_of_armaments_weapons', 'narrative/15_Art_Workbench/banners/banner_hall_of_armaments_v001.jpg'],
  ['banner_oath_01_weapon', 'narrative/15_Art_Workbench/banners/banner_weapon_01_last_vigil_v001.jpg'],
  ['banner_oath_02_weapon', 'narrative/15_Art_Workbench/banners/banner_weapon_02_broken_bell_v001.jpg'],
  ['banner_oath_03_weapon', 'narrative/15_Art_Workbench/banners/banner_weapon_03_gatewarden_promise_v001.jpg'],
  ['banner_oath_04_weapon', 'narrative/15_Art_Workbench/banners/banner_weapon_04_unwritten_ledger_v001.jpg'],
  ['banner_oath_05_weapon', 'narrative/15_Art_Workbench/banners/banner_weapon_05_last_hour_v001.jpg'],
  ['banner_oath_06_weapon', 'narrative/15_Art_Workbench/banners/banner_weapon_06_cinder_anvil_v001.jpg'],
  ['banner_oath_07_weapon', 'narrative/15_Art_Workbench/banners/banner_weapon_07_locke_chain_v001.jpg'],
] as const;

async function main() {
  for (const [assetId, fileRel] of BANNERS) {
    const specRel = `content/specs/image/${assetId}.ingest.json`;
    const absFile = join(ROOT, fileRel);
    const sha = createHash('sha256').update(readFileSync(absFile)).digest('hex');
    const spec = initIngestSpec(`content/specs/image/${assetId}.json`, 'banner');
    spec.source = { kind: 'locked', file: fileRel, sha256: sha };
    writeFileSync(join(ROOT, specRel), `${JSON.stringify(spec, null, 2)}\n`);
    const res = await runIngest({ rootDir: ROOT, ingestSpecPath: specRel, execute: true });
    approveArtEntry(ROOT, assetId, 'argon:art-director', '§4.4 canonical banner key art passed QC');
    const out = res.entry.outputs[0];
    console.log(`${assetId} -> ${res.status} (${out?.path}, ${out?.bytes}B)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
