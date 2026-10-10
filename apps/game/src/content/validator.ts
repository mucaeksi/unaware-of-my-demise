import { validateContentSet } from '@uomd/content-schema';
import type { PatchEnv } from '@uomd/patch';

const EMPTY = new Uint8Array(0);

/**
 * Device-side semantic validation: overlays the patch files on the embedded base and validates the
 * effective set. Non-JSON base files only need to exist, so they are not read into memory.
 */
export const validatePatch: PatchEnv['validate'] = async (files, _manifest, base) => {
  const effective = new Map(files);
  for (const path of Object.keys(base.files)) {
    if (effective.has(path)) continue;
    effective.set(path, path.endsWith('.json') ? await base.read(path) : EMPTY);
  }
  validateContentSet(effective);
};
