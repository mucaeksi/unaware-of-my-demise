/**
 * Signed content-patch scenarios for the C# port of packages/patch (apps/unity/Assets/_UOMD/Scripts/Core/Patching).
 * A small synthetic base release and patch file set keep the vectors tiny; every manifest is built with the real
 * publisher (manifestFromEntries + signManifest) so the C# admission rules are tested against authentic output.
 * Run: npx tsx tools/export_unity_patch_vectors.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSigningKeyPair, importPrivateKey, sha256Hex, type PublicKeyJwk } from '../packages/shared/src/index.ts';
import { manifestFromEntries, signManifest, type FileEntry, type ReleaseMeta } from '../packages/patch/src/publish.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PATCH_VECTORS_PATH = join(ROOT, 'apps/unity/Assets/_UOMD/Tests/EditMode/patch_vectors.json');
const CREATED_AT = '2026-10-25T00:00:00.000Z';
const KID = 'test-1';

const text = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
/** Deterministic filler bytes standing in for media (the patch client never decodes them). */
function filler(seed: number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let x = seed >>> 0 || 1;
  for (let i = 0; i < length; i++) {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    out[i] = x & 0xff;
  }
  return out;
}

type FileSet = Record<string, Uint8Array>;

const ATLAS = filler(11, 3000);
const BGM = filler(23, 2400);
export const BASE_FILES: FileSet = {
  'chapters/chapter_index.json': text({ chapters: [{ id: 'ch0_tutorial' }] }),
  'encounters/stage_0_1.json': text({ id: 'stage_0_1', waves: 1 }),
  'art/atlas_units.webp': ATLAS,
  'audio/bgm_ch1_ash_forest_calm.ogg': BGM
};
export const PATCH_FILES: FileSet = {
  'chapters/chapter_index.json': text({ chapters: [{ id: 'ch0_tutorial' }, { id: 'ch1_ash_forest' }] }),
  'encounters/stage_1_1.json': text({ id: 'stage_1_1', waves: 2 }),
  'encounters/stage_1_2.json': text({ id: 'stage_1_2', waves: 3 }),
  'units/units_ch1.json': text({ units: ['fadyme', 'sereth'] }),
  // byte-identical to the base: never downloaded
  'art/atlas_units.webp': ATLAS,
  'art/bg_ash_forest.webp': filler(37, 5000)
};

/** A release sharing no objects with PATCH_FILES: storage accounting cannot dedupe it against rel_0002. */
const ALT_FILES: FileSet = {
  'encounters/stage_2_1.json': text({ id: 'stage_2_1', waves: 4 }),
  'art/bg_ember_gate.webp': filler(41, 4000)
};

const SNAPSHOT_FILES: FileSet = { ...BASE_FILES, ...PATCH_FILES };

interface Scenario { name: string; meta: Partial<ReleaseMeta>; files?: FileSet; unsigned?: boolean }

/** Scenario names are what the C# tests look up; meta overrides the default rel_0002 g2 patch over rel_0001 g1. */
const SCENARIOS: Scenario[] = [
  { name: 'r2', meta: {} },
  { name: 'r2_unsigned', meta: {}, unsigned: true },
  { name: 'r2_snapshot', meta: { dependsOn: undefined }, files: SNAPSHOT_FILES },
  { name: 'r2_self_contained', meta: { dependsOn: undefined } },
  { name: 'r2_dev', meta: { channel: 'dev' } },
  { name: 'r2_max_client', meta: { maxClient: '1.9.9' } },
  { name: 'r2_schema2', meta: { contentSchema: 2 } },
  { name: 'r2_dep_mismatch', meta: { dependsOn: { releaseId: 'rel_9999', generation: 1 } } },
  { name: 'r2_capability', meta: { requiredCapabilities: ['future_v9'] } },
  { name: 'r2_rollout50', meta: { rolloutPercent: 50 } },
  { name: 'r2_rollout0', meta: { rolloutPercent: 0 } },
  { name: 'g1_stale', meta: { generation: 1, dependsOn: undefined } },
  { name: 'r3', meta: { releaseId: 'rel_0003', generation: 3 } },
  { name: 'r4', meta: { releaseId: 'rel_0004', generation: 4 } },
  { name: 'kill2', meta: { releaseId: 'kill_0002', generation: 2, killSwitch: true } },
  { name: 'kill3', meta: { releaseId: 'kill_0003', generation: 3, killSwitch: true } },
  { name: 'kill4', meta: { releaseId: 'kill_0004', generation: 4, killSwitch: true } },
  { name: 'different3', meta: { releaseId: 'different_0003', generation: 3 } },
  { name: 'rollback5', meta: { releaseId: 'rollback_0005', generation: 5 } },
  { name: 'r3_alt', meta: { releaseId: 'rel_0003', generation: 3 }, files: ALT_FILES }
];

async function entries(files: FileSet): Promise<FileEntry[]> {
  const out: FileEntry[] = [];
  for (const [path, bytes] of Object.entries(files)) out.push({ path, sha256: await sha256Hex(bytes), bytes: bytes.byteLength });
  return out;
}

const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

function metaFor(over: Partial<ReleaseMeta>): ReleaseMeta {
  const meta: ReleaseMeta = { releaseId: 'rel_0002', generation: 2, channel: 'staging', notes: 'unity patch vector', minClient: '0.1.0', dependsOn: { releaseId: 'rel_0001', generation: 1 }, createdAt: CREATED_AT };
  return { ...meta, ...over };
}

/** Everything except the signatures and the throwaway keys, which change on every run. */
export async function buildUnsignedPatchVectors() {
  const base: Record<string, string> = {};
  for (const [path, bytes] of Object.entries(BASE_FILES)) base[path] = b64(bytes);
  const objects: Record<string, string> = {};
  for (const bytes of Object.values({ ...SNAPSHOT_FILES, ...ALT_FILES })) objects[await sha256Hex(bytes)] = b64(bytes);
  const manifests: Record<string, unknown> = {};
  for (const s of SCENARIOS) manifests[s.name] = manifestFromEntries(metaFor(s.meta), await entries(s.files ?? PATCH_FILES));
  // percentage rollout buckets of the reference client: sha256("<installId>:<releaseId>")[0..8] % 100 < percent
  const rollout: { install_id: string; bucket: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const installId = `device-${i}`;
    rollout.push({ install_id: installId, bucket: parseInt((await sha256Hex(`${installId}:rel_0002`)).slice(0, 8), 16) % 100 });
  }
  return { generated_by: 'tools/export_unity_patch_vectors.ts', kid: KID, base: { release_id: 'rel_0001', generation: 1, files: base }, objects, manifests, rollout };
}

export async function buildPatchVectors() {
  const unsigned = await buildUnsignedPatchVectors();
  const signing = await generateSigningKeyPair();
  const privateKey = await importPrivateKey(signing.privateJwk);
  const other = await generateSigningKeyPair();
  const manifests: Record<string, unknown> = {};
  for (const s of SCENARIOS) {
    const m = unsigned.manifests[s.name] as Parameters<typeof signManifest>[0];
    manifests[s.name] = s.unsigned ? m : await signManifest(m, privateKey, KID);
  }
  const jwk = (k: JsonWebKey): Pick<PublicKeyJwk, 'x' | 'y'> => ({ x: k.x!, y: k.y! });
  // the "other" key reuses the kid: a forged manifest under a known key id must still fail
  return { ...unsigned, trusted_key: jwk(signing.publicJwk), other_key: jwk(other.publicJwk), manifests };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  mkdirSync(dirname(PATCH_VECTORS_PATH), { recursive: true });
  writeFileSync(PATCH_VECTORS_PATH, `${JSON.stringify(await buildPatchVectors(), null, 2)}\n`, 'utf8');
  console.log(`wrote ${PATCH_VECTORS_PATH}`);
}
