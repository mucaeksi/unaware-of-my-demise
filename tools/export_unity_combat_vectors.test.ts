import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCombatVectors, COMBAT_VECTORS_PATH } from './export_unity_combat_vectors';

describe('Unity combat golden vectors', () => {
  it('match the current TypeScript engine and content (regenerate with npx tsx tools/export_unity_combat_vectors.ts)', async () => {
    const committed = JSON.parse(readFileSync(COMBAT_VECTORS_PATH, 'utf8'));
    const fresh = await buildCombatVectors();
    expect(fresh.cases.length).toBeGreaterThan(100);
    expect(fresh.cases.map((c) => [c.name, c.logHash, c.eventCount])).toEqual(committed.cases.map((c: { name: string; logHash: string; eventCount: number }) => [c.name, c.logHash, c.eventCount]));
    expect(JSON.parse(JSON.stringify(fresh))).toEqual(committed);
  });
});
