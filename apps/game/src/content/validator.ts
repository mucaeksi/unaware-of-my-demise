import { validateContentSet } from '@uomd/content-schema';
import type { PatchEnv } from '@uomd/patch';

const EMPTY = new Uint8Array(0);

/**
 * Device-side semantic validation: self-contained snapshots stand alone; legacy dependencies
 * overlay the exact embedded base. Non-JSON base files only need to exist, so they are not read into memory.
 */
export const validatePatch: PatchEnv['validate'] = async (files, manifest, base) => {
  const effective = new Map(files);
  for (const path of manifest.depends_on ? Object.keys(base.files) : []) {
    if (effective.has(path)) continue;
    effective.set(path, path.endsWith('.json') ? await base.read(path) : EMPTY);
  }
  validateContentSet(effective);
};
