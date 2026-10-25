import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { verifyPayload, type PublicKeyJwk, type SignedPayload } from '../packages/shared/src/index.ts';
import { buildUnsignedPatchVectors, PATCH_VECTORS_PATH } from './export_unity_patch_vectors';

describe('Unity patch vectors', () => {
  it('match the current publisher (regenerate with npx tsx tools/export_unity_patch_vectors.ts)', async () => {
    const committed = JSON.parse(readFileSync(PATCH_VECTORS_PATH, 'utf8'));
    const fresh = await buildUnsignedPatchVectors();
    const stripped = Object.fromEntries(Object.entries(committed.manifests as Record<string, Record<string, unknown>>).map(([name, m]) => {
      const { signature: _signature, ...rest } = m;
      return [name, rest];
    }));
    expect(stripped).toEqual(JSON.parse(JSON.stringify(fresh.manifests)));
    expect({ base: committed.base, objects: committed.objects, rollout: committed.rollout, kid: committed.kid }).toEqual({ base: fresh.base, objects: fresh.objects, rollout: fresh.rollout, kid: fresh.kid });
  });

  it('carry authentic signatures under the trusted key only', async () => {
    const committed = JSON.parse(readFileSync(PATCH_VECTORS_PATH, 'utf8'));
    const key = (k: { x: string; y: string }): PublicKeyJwk => ({ kty: 'EC', crv: 'P-256', kid: committed.kid, x: k.x, y: k.y }) as PublicKeyJwk;
    for (const [name, m] of Object.entries(committed.manifests as Record<string, SignedPayload>)) {
      expect(await verifyPayload(m, [key(committed.trusted_key)]), name).toBe(name !== 'r2_unsigned');
      expect(await verifyPayload(m, [key(committed.other_key)]), name).toBe(false);
    }
  });
});
