/**
 * Writes golden vectors from the authoritative TypeScript packages so the Unity EditMode tests
 * (apps/unity/Assets/_UOMD/Tests/EditMode) can prove the C# ports stay bit-exact.
 * Run: npx tsx tools/export_unity_parity_vectors.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rng } from '../packages/shared/src/rng.ts';
import { canonicalJson } from '../packages/shared/src/canonical.ts';
import { generateSigningKeyPair, importPrivateKey, signPayload } from '../packages/shared/src/signing.ts';
import { attributesAt, deriveStats, type AttributeBlock } from '../packages/economy/src/attributes.ts';
import { computeVictoryStars } from '../packages/combat/src/engine.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps/unity/Assets/_UOMD/Tests/EditMode/parity_vectors.json');

export async function buildParityVectors() {
  const rng = [1, 42, 20261024, 4294967295].map((seed) => {
    const r = new Rng(seed);
    const values = Array.from({ length: 8 }, () => r.next());
    return { seed, values, snapshot: r.snapshot() };
  });

  const blocks: AttributeBlock[] = [
    { power: 'str', base: { str: 6, int: 2, vit: 5, agi: 4 }, growth: { str: 0.6, int: 0.1, vit: 0.45, agi: 0.35 }, armor: 1 },
    { power: 'int', base: { str: 1, int: 7, vit: 3, agi: 5 }, growth: { str: 0.05, int: 0.7, vit: 0.3, agi: 0.5 } }
  ] as AttributeBlock[];
  const stats = [];
  for (const block of blocks) {
    for (const level of [1, 10, 37, 60]) {
      for (const bonus of [{}, { str: 2, vit: 1, power: 3 }]) {
        const a = attributesAt(block, level, bonus);
        for (const armor of [0, 7.5]) {
          stats.push({ block, level, bonus, armor, attributes: a, derived: deriveStats(block, a, armor) });
        }
      }
    }
  }

  const stars = [];
  for (let players = 1; players <= 5; players++) {
    for (let defeated = 0; defeated <= players; defeated++) {
      stars.push({ players, defeated, stars: computeVictoryStars(players, defeated) });
    }
  }

  const canonicalInputs: unknown[] = [
    { b: 1, a: [true, null, 'x'], c: { z: 0.5, y: -3 } },
    { 'é': 'ü', A: 'a', _: '\n\t"\\', n: 1e21, m: 0.1 },
    [{ k: 'v' }, [], {}],
    { lone: '\ud800x', pair: '😀', ctl: '\u0001', nil: null, neg: -0.5 }
  ];
  const canonical = canonicalInputs.map((input) => ({ input: JSON.stringify(input), canonical: canonicalJson(input) }));

  const numberValues = [0.1, 0.7999999999999999, 0.30000000000000004, 1e21, 1e-7, 1.5e-7, 123456789012345680000, 5e-324, -0.000001, 1.5e300, -42, 2 ** 53, 1 / 3];
  const view = new DataView(new ArrayBuffer(8));
  const numbers = numberValues.map((value) => {
    view.setFloat64(0, value);
    return { bits: view.getBigInt64(0).toString(), text: JSON.stringify(value) };
  });

  return { generated_by: 'tools/export_unity_parity_vectors.ts', rng, stats, stars, canonical, numbers, signature: await buildSignatureVector() };
}

/** Throwaway key pair (never a trust root): proves the managed C# P-256 verifier accepts WebCrypto ES256 output. */
async function buildSignatureVector() {
  const { publicJwk, privateJwk } = await generateSigningKeyPair();
  const key = await importPrivateKey(privateJwk);
  const payload = { schema_version: 1, release: { id: 'rel_parity', generation: 3, notes: 'çağ ✓' }, files: [{ path: 'a.json', sha256: 'ab', bytes: 2 }], rollout: null };
  const signed = await signPayload(payload, key, 'uomd-parity-test');
  return { kid: 'uomd-parity-test', x: publicJwk.x, y: publicJwk.y, signed_json: JSON.stringify(signed) };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(await buildParityVectors(), null, 2)}\n`, 'utf8');
  console.log(`wrote ${OUT}`);
}
