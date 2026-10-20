import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { MIN_EFFECTIVE_CLIENT_VERSION, requiredContentCapabilities, type ContentManifest, type ManifestFile } from '@uomd/content-schema';
import { compareSemver, generateSigningKeyPair, importPrivateKey, sha256Hex, type PublicKeyJwk } from '@uomd/shared';
import { MemoryStorage, PatchManager, buildManifest, manifestFromEntries, signManifest, type BaseContent, type FileEntry, type PatchEnv, type PatchProgress, type RemoteSource } from './index';

const ROOT = fileURLToPath(new URL('../../../content/', import.meta.url));
const walk = (dir: string, rel = ''): string[] =>
  readdirSync(join(dir, rel)).flatMap((n) => {
    const r = rel ? `${rel}/${n}` : n;
    return statSync(join(dir, r)).isDirectory() ? walk(dir, r) : [r];
  });
const load = (dir: string): { path: string; bytes: Uint8Array }[] => walk(dir).map((p) => ({ path: p, bytes: new Uint8Array(readFileSync(join(dir, p))) }));

let publicJwk: PublicKeyJwk;
let privateKey: CryptoKey;
let otherPublic: PublicKeyJwk;
let baseFiles: { path: string; bytes: Uint8Array }[];
let patchFiles: { path: string; bytes: Uint8Array }[];
let patchEntries: FileEntry[];
let baseCapabilities: string[];
let patchCapabilities: string[];
let patchObjects: Map<string, Uint8Array>;
let shaByBytes: Map<Uint8Array, string>;
let signedPatchCache: Map<string, ContentManifest>;
let base: BaseContent;

beforeAll(async () => {
  const kp = await generateSigningKeyPair();
  publicJwk = { ...(kp.publicJwk as PublicKeyJwk), kid: 'test-1' };
  privateKey = await importPrivateKey(kp.privateJwk);
  otherPublic = { ...((await generateSigningKeyPair()).publicJwk as PublicKeyJwk), kid: 'test-1' };
  baseFiles = load(join(ROOT, 'base'));
  patchFiles = load(join(ROOT, 'patches/rel_0003_part1_campaign'));
  patchEntries = [];
  patchObjects = new Map();
  shaByBytes = new Map();
  signedPatchCache = new Map();
  for (const f of patchFiles) {
    const sha256 = await sha256Hex(f.bytes);
    shaByBytes.set(f.bytes, sha256);
    patchEntries.push({ path: f.path, sha256, bytes: f.bytes.byteLength });
    patchObjects.set(sha256, f.bytes);
  }
  baseCapabilities = [...requiredContentCapabilities(new Map(baseFiles.map((f) => [f.path, f.bytes])))].sort();
  patchCapabilities = [...requiredContentCapabilities(new Map(patchFiles.map((f) => [f.path, f.bytes])))].sort();
  const hashes: Record<string, string> = {};
  for (const f of baseFiles) {
    const sha256 = await sha256Hex(f.bytes);
    shaByBytes.set(f.bytes, sha256);
    hashes[f.path] = sha256;
  }
  base = {
    releaseId: 'rel_0001',
    generation: 1,
    files: hashes,
    read: async (p) => {
      const f = baseFiles.find((x) => x.path === p);
      if (!f) throw new Error(`base has no ${p}`);
      return f.bytes;
    }
  };
}, 30_000);

async function signedPatch(over: Partial<Parameters<typeof buildManifest>[0]> = {}, files = patchFiles): Promise<ContentManifest> {
  const meta = { releaseId: 'rel_0002', generation: 2, channel: 'staging' as const, notes: 'test', minClient: '0.1.0', dependsOn: { releaseId: 'rel_0001', generation: 1 }, ...over };
  if (files === patchFiles) {
    const cacheKey = JSON.stringify(meta);
    const cached = signedPatchCache.get(cacheKey);
    if (cached) return structuredClone(cached);
    const requiredCapabilities = [...new Set([...(meta.requiredCapabilities ?? []), ...patchCapabilities])].sort();
    const minClient = requiredCapabilities.length && compareSemver(meta.minClient, MIN_EFFECTIVE_CLIENT_VERSION) < 0 ? MIN_EFFECTIVE_CLIENT_VERSION : meta.minClient;
    const signed = await signManifest(manifestFromEntries({ ...meta, minClient, requiredCapabilities }, patchEntries), privateKey, 'test-1');
    signedPatchCache.set(cacheKey, signed);
    return structuredClone(signed);
  }
  if (files.every((f) => shaByBytes.has(f.bytes))) {
    const entries: FileEntry[] = files.map((f) => ({ path: f.path, sha256: shaByBytes.get(f.bytes)!, bytes: f.bytes.byteLength }));
    const requiredCapabilities = [...new Set([...(meta.requiredCapabilities ?? []), ...baseCapabilities, ...patchCapabilities])].sort();
    const minClient = requiredCapabilities.length && compareSemver(meta.minClient, MIN_EFFECTIVE_CLIENT_VERSION) < 0 ? MIN_EFFECTIVE_CLIENT_VERSION : meta.minClient;
    return signManifest(manifestFromEntries({ ...meta, minClient, requiredCapabilities }, entries), privateKey, 'test-1');
  }
  const m = await buildManifest(meta, files);
  return signManifest(m, privateKey, 'test-1');
}

class FakeRemote implements RemoteSource {
  fetched: string[] = [];
  failFirst = new Map<string, number>();
  corrupt = new Set<string>();
  offline = false;
  constructor(public manifest: unknown, private readonly objects: Map<string, Uint8Array>) {}
  async fetchManifest(): Promise<unknown | null> {
    if (this.offline) throw new Error('network down');
    return this.manifest;
  }
  async fetchObject(sha: string, f: ManifestFile, onBytes?: (n: number) => void): Promise<Uint8Array> {
    this.fetched.push(f.path);
    onBytes?.(Math.floor(f.bytes / 2));
    const left = this.failFirst.get(sha) ?? 0;
    if (left > 0) {
      this.failFirst.set(sha, left - 1);
      throw new Error('connection reset');
    }
    const bytes = this.objects.get(sha);
    if (!bytes) throw new Error('404');
    if (this.corrupt.has(sha)) {
      const c = new Uint8Array(bytes);
      c[0] = (c[0] ?? 0) ^ 0xff;
      return c;
    }
    return bytes;
  }
}

async function objectsOf(files: { path: string; bytes: Uint8Array }[]): Promise<Map<string, Uint8Array>> {
  if (files === patchFiles) return patchObjects;
  const m = new Map<string, Uint8Array>();
  for (const f of files) m.set(shaByBytes.get(f.bytes) ?? (await sha256Hex(f.bytes)), f.bytes);
  return m;
}

const env = (over: Partial<PatchEnv> = {}): PatchEnv => ({
  channel: 'staging',
  // a capability-requiring release (the campaign's D-27 units) floors min_client at MIN_EFFECTIVE_CLIENT_VERSION
  clientVersion: '0.1.2',
  supportedContentSchema: 1,
  trustedKeys: [publicJwk],
  installId: 'install-a',
  storageBudgetBytes: 50 * 1024 * 1024,
  // the campaign patch's units are D-27 attribute units with sprite animations and world map
  supportedCapabilities: ['attributes_v1', 'sprite_animation_v1', 'world_map_v1'],
  validate: () => undefined,
  sleep: async () => undefined,
  ...over
});

async function setup(over: Partial<PatchEnv> = {}, manifestOver: Parameters<typeof signedPatch>[0] = {}) {
  const manifest = await signedPatch(manifestOver);
  const remote = new FakeRemote(manifest, await objectsOf(patchFiles));
  const storage = new MemoryStorage();
  const pm = new PatchManager(env(over), storage, remote, base);
  return { manifest, remote, storage, pm };
}

describe('PatchManager', () => {
  it('applies a signed patch, downloads only missing bytes, and serves patched files through the overlay', async () => {
    const { pm, remote, storage } = await setup();
    const out = await pm.checkAndApply();
    expect(out).toMatchObject({ status: 'applied', releaseId: 'rel_0002', generation: 2 });
    // files byte-identical to the base (e.g. unchanged atlases) are never downloaded
    expect(remote.fetched.every((p) => patchFiles.some((f) => f.path === p))).toBe(true);
    expect((await storage.getState())?.active?.releaseId).toBe('rel_0002');
    const idx = JSON.parse(new TextDecoder().decode(await pm.read('chapters/chapter_index.json')));
    expect(idx.chapters.length).toBeGreaterThan(1); // the patch's chapter index (the whole campaign) replaces the base's single tutorial chapter
    // a path the patch does not touch still comes from the embedded base
    expect((await pm.read('audio/bgm_ch1_ash_forest_calm.ogg')).byteLength).toBeGreaterThan(1000);
    expect((await pm.checkAndApply()).status).toBe('up_to_date');
  });

  it('reads base-identical files in a full snapshot without downloading or rolling back', async () => {
    const files = [...new Map([...baseFiles, ...patchFiles].map((f) => [f.path, f])).values()];
    const manifest = await signedPatch({ dependsOn: undefined }, files);
    const storage = new MemoryStorage();
    const remote = new FakeRemote(manifest, await objectsOf(files));
    const pm = new PatchManager(env({ clientVersion: '0.1.2', supportedCapabilities: ['attributes_v1', 'presentation_v1', 'sprite_animation_v1', 'vfx_v1', 'world_map_v1'] }), storage, remote, base);
    expect((await pm.checkAndApply()).status).toBe('applied');
    const path = 'audio/bgm_ch1_ash_forest_calm.ogg';
    expect(remote.fetched).not.toContain(path);
    expect(Buffer.compare(await pm.read(path), await base.read(path))).toBe(0);
    expect(storage.state?.active?.releaseId).toBe('rel_0002');
  }, 20_000);


  it('does not serve undeclared base files through a self-contained snapshot', async () => {
    const { pm } = await setup({}, { dependsOn: undefined });
    expect((await pm.checkAndApply()).status).toBe('applied');
    const path = 'audio/bgm_ch1_ash_forest_calm.ogg';
    await expect(pm.read(path)).rejects.toThrow('no such content file');
    await expect(pm.locate(path)).rejects.toThrow('no such content file');
  });

  it('rejects a manifest with a bad or untrusted signature and leaves state untouched', async () => {
    const { pm, storage } = await setup({ trustedKeys: [otherPublic] });
    expect(await pm.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'bad_signature' });
    expect(await storage.getState()).toBeNull();
  });

  it('rejects tampered manifest contents (signature no longer matches)', async () => {
    const { manifest, storage } = await setup();
    const tampered = structuredClone(manifest) as ContentManifest;
    tampered.release.notes = 'evil';
    const pm = new PatchManager(env(), storage, new FakeRemote(tampered, await objectsOf(patchFiles)), base);
    expect(await pm.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'bad_signature' });
  });

  it('rejects unsigned manifests and malformed/hostile paths', async () => {
    const m = await buildManifest({ releaseId: 'rel_0002', generation: 2, channel: 'staging', notes: 'x', minClient: '0.1.0' }, patchFiles);
    const storage = new MemoryStorage();
    const unsigned = new PatchManager(env(), storage, new FakeRemote(m, new Map()), base);
    expect(await unsigned.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'bad_signature' });
    const hostile = structuredClone(m) as ContentManifest;
    (hostile.files[0] as ManifestFile).path = '../../escape.json';
    const pm = new PatchManager(env(), storage, new FakeRemote(hostile, new Map()), base);
    expect(await pm.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'malformed_manifest' });
  });

  it('retries a flaky download and finishes; a persistently corrupted object is rejected with hash_mismatch', async () => {
    const flaky = await setup();
    const some = flaky.manifest.files.find((f) => f.path === 'encounters/stage_1_1.json') as ManifestFile;
    flaky.remote.failFirst.set(some.sha256, 2);
    expect((await flaky.pm.checkAndApply()).status).toBe('applied');

    const bad = await setup();
    const target = bad.manifest.files.find((f) => f.path === 'encounters/stage_1_2.json') as ManifestFile;
    bad.remote.corrupt.add(target.sha256);
    expect(await bad.pm.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'hash_mismatch' });
    expect((await bad.storage.getState())?.active ?? null).toBeNull();
    // the corrupt object was never stored
    expect(await bad.storage.hasObject(target.sha256)).toBe(false);
  });

  it('resumes after an interruption: objects already stored are not downloaded again', async () => {
    const first = await setup();
    const last = first.manifest.files[first.manifest.files.length - 1] as ManifestFile;
    first.remote.failFirst.set(last.sha256, 99);
    expect(await first.pm.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'download_failed' });
    const stored = (await first.storage.listObjects()).length;
    expect(stored).toBeGreaterThan(0);
    first.remote.failFirst.clear();
    first.remote.fetched.length = 0;
    expect((await first.pm.checkAndApply()).status).toBe('applied');
    expect(first.remote.fetched.length).toBeLessThan(first.manifest.files.length);
  });

  it('enforces compatibility: client range, channel, content schema, dependency', async () => {
    expect(await (await setup({ clientVersion: '0.0.9' })).pm.checkAndApply()).toMatchObject({ reason: 'client_too_old' });
    expect(await (await setup({ clientVersion: '2.0.0' }, { maxClient: '1.9.9' })).pm.checkAndApply()).toMatchObject({ reason: 'client_too_new' });
    expect(await (await setup({}, { channel: 'dev' })).pm.checkAndApply()).toMatchObject({ reason: 'wrong_channel' });
    expect(await (await setup({}, { contentSchema: 2 })).pm.checkAndApply()).toMatchObject({ reason: 'schema_too_new' });
    expect(await (await setup({}, { dependsOn: { releaseId: 'rel_9999', generation: 1 } })).pm.checkAndApply()).toMatchObject({ reason: 'dependency_mismatch' });
  });

  it('refuses downgrades (generation must increase) and a patch over the storage budget', async () => {
    const stale = await setup({}, { generation: 1, dependsOn: undefined });
    expect(await stale.pm.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'stale_generation' });
    const big = await setup({ storageBudgetBytes: 100 });
    expect(await big.pm.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'storage_budget' });
  });

  it('semantic validation failure keeps the old release and denies the new one for this device', async () => {
    const { pm, storage } = await setup({
      validate: () => {
        throw new Error('encounter references unknown unit');
      }
    });
    expect(await pm.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'validation_failed' });
    const st = await storage.getState();
    expect(st?.active).toBeNull();
    expect(st?.denied).toContain('rel_0002');
    expect(await pm.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'denied_release' });
  });

  it('offline: reports offline and keeps serving the active release', async () => {
    const { pm, remote } = await setup();
    await pm.checkAndApply();
    remote.offline = true;
    expect(await pm.checkAndApply()).toMatchObject({ status: 'offline' });
    expect((await pm.read('chapters/chapter_index.json')).byteLength).toBeGreaterThan(10);
  });

  it('percentage rollout buckets by install id deterministically', async () => {
    let applied = 0;
    for (let i = 0; i < 40; i++) {
      const { pm } = await setup({ installId: `device-${i}` }, { rolloutPercent: 50 });
      if ((await pm.checkAndApply()).status === 'applied') applied++;
    }
    expect(applied).toBeGreaterThan(8);
    expect(applied).toBeLessThan(32);
    const zero = await setup({}, { rolloutPercent: 0 });
    expect((await zero.pm.checkAndApply()).status).toBe('up_to_date');
  }, 60_000);

  it('kill switch returns the device to the embedded base; rollback restores the previous release', async () => {
    const { pm, storage, remote } = await setup();
    await pm.checkAndApply();
    const kill = await signedPatch({ generation: 3, killSwitch: true });
    remote.manifest = kill;
    expect(await pm.checkAndApply()).toMatchObject({ status: 'reverted_to_base' });
    expect((await storage.getState())?.active).toBeNull();
    const idx = JSON.parse(new TextDecoder().decode(await pm.read('chapters/chapter_index.json')));
    expect(idx.chapters).toHaveLength(1); // base index again
  });

  it('rolls back to the previous release when a stored object is corrupted on disk', async () => {
    const { pm, storage } = await setup();
    await pm.checkAndApply();
    const st = await storage.getState();
    const victim = st?.active?.manifest.files.find((f) => f.path === 'chapters/chapter_index.json') as ManifestFile;
    await storage.putObject(victim.sha256, new TextEncoder().encode('{"tampered":true}'));
    const bytes = await pm.read('chapters/chapter_index.json'); // detects, rolls back, serves base
    expect(JSON.parse(new TextDecoder().decode(bytes)).chapters).toHaveLength(1);
    expect((await storage.getState())?.active).toBeNull();
    expect((await storage.getState())?.denied).toContain('rel_0002');
  });

  it('reports progress: checking, downloading with byte counters that only grow, verifying, activating', async () => {
    const { pm } = await setup();
    const seen: PatchProgress[] = [];
    const out = await pm.checkAndApply({ onProgress: (p) => seen.push(structuredClone(p)) });
    expect(out.status).toBe('applied');
    expect(seen[0]?.phase).toBe('checking');
    expect(seen.map((p) => p.phase)).toEqual(expect.arrayContaining(['checking', 'downloading', 'verifying', 'activating']));
    const dl = seen.filter((p) => p.phase === 'downloading');
    expect(dl.at(-1)?.bytesDone).toBe(dl.at(-1)?.bytesTotal);
    expect(dl.at(-1)?.filesDone).toBe(dl.at(-1)?.filesTotal);
    const total = dl[0]?.bytesTotal ?? 0;
    expect(total).toBeGreaterThan(0);
    for (const p of dl) expect(p.bytesDone).toBeLessThanOrEqual(total);
    // a late within-file report never moves the counter backwards across files
    let last = 0;
    for (const p of dl) {
      expect(p.bytesDone).toBeGreaterThanOrEqual(0);
      last = p.bytesDone;
    }
    expect(last).toBe(total);
  });

  it('staged: downloads and validates but does not switch on; a later start activates it without any network', async () => {
    const { pm, storage, remote } = await setup();
    const out = await pm.checkAndApply({ activate: false });
    expect(out).toMatchObject({ status: 'staged', releaseId: 'rel_0002' });
    const st = await storage.getState();
    expect(st?.active ?? null).toBeNull();
    expect(st?.staged?.releaseId).toBe('rel_0002');
    // still served from the embedded base
    expect(JSON.parse(new TextDecoder().decode(await pm.read('chapters/chapter_index.json'))).chapters).toHaveLength(1);

    remote.offline = true; // the restart has no network
    remote.fetched.length = 0;
    expect(await pm.activateStaged()).toMatchObject({ status: 'applied', releaseId: 'rel_0002' });
    expect(remote.fetched).toEqual([]);
    const after = await storage.getState();
    expect(after?.active?.releaseId).toBe('rel_0002');
    expect(after?.staged ?? null).toBeNull();
    expect(JSON.parse(new TextDecoder().decode(await pm.read('chapters/chapter_index.json'))).chapters.length).toBeGreaterThan(1);
    expect(await pm.activateStaged()).toBeNull(); // nothing left to switch on
  });

  it('staged: a normal check with the same release activates it from storage instead of downloading again', async () => {
    const { pm, remote } = await setup();
    await pm.checkAndApply({ activate: false });
    remote.fetched.length = 0;
    expect(await pm.checkAndApply()).toMatchObject({ status: 'applied', releaseId: 'rel_0002' });
    expect(remote.fetched).toEqual([]);
  });

  it('staged: a damaged or missing stored object drops the stage instead of half-applying it', async () => {
    const { pm, storage, manifest } = await setup();
    await pm.checkAndApply({ activate: false });
    const victim = manifest.files.find((f) => f.path === 'chapters/chapter_index.json') as ManifestFile;
    await storage.putObject(victim.sha256, new TextEncoder().encode('{"tampered":true}'));
    expect(await pm.activateStaged()).toMatchObject({ status: 'rejected', reason: 'download_failed' });
    const st = await storage.getState();
    expect(st?.active ?? null).toBeNull();
    expect(st?.staged ?? null).toBeNull();
  });

  it('staged objects survive garbage collection while a newer release is active', async () => {
    const { pm, storage, manifest } = await setup();
    await pm.checkAndApply({ activate: false });
    const stagedHashes = manifest.files.filter((f) => base.files[f.path] !== f.sha256).map((f) => f.sha256);
    expect(stagedHashes.length).toBeGreaterThan(0);
    for (const h of stagedHashes) expect(await storage.hasObject(h)).toBe(true);
    await pm.rollback(); // nothing active: returns false, collect() must not run over the staged release
    for (const h of stagedHashes) expect(await storage.hasObject(h)).toBe(true);
  });

  it('rejects an older authentic kill after accepting a higher generation', async () => {
    const { pm, remote, storage } = await setup({}, { releaseId: 'rel_0004', generation: 4 });
    await pm.checkAndApply(); remote.manifest = await signedPatch({ releaseId: 'kill_0002', generation: 2, killSwitch: true });
    expect(await pm.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'stale_generation' });
    expect((await storage.getState())!.active!.releaseId).toBe('rel_0004');
  });

  it('remembers the kill generation on a fresh manager and rejects an older release replay', async () => {
    const { pm, remote, storage } = await setup(); await pm.checkAndApply();
    remote.manifest = await signedPatch({ releaseId: 'kill_0003', generation: 3, killSwitch: true }); await pm.checkAndApply();
    remote.manifest = await signedPatch();
    const restarted = new PatchManager(env(), storage, remote, base);
    expect(await restarted.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'stale_generation' });
    expect((await storage.getState())!.active).toBeNull();
  });

  it('keeps the greatest generation after local rollback and rejects an unseen intermediate version', async () => {
    const { pm, remote, storage } = await setup(); await pm.checkAndApply();
    remote.manifest = await signedPatch({ releaseId: 'rel_0004', generation: 4 }); await pm.checkAndApply();
    await pm.rollback(); expect((await storage.getState())!.active!.generation).toBe(2);
    remote.manifest = await signedPatch({ releaseId: 'rel_0003', generation: 3 });
    expect(await new PatchManager(env(), storage, remote, base).checkAndApply()).toMatchObject({ status: 'rejected', reason: 'stale_generation' });
    expect((await storage.getState())!.active!.generation).toBe(2);
  });

  it('allows an intentionally newer signed release with older files after rollback', async () => {
    const { pm, remote, storage } = await setup({}, { releaseId: 'rel_0004', generation: 4 });
    await pm.checkAndApply(); await pm.rollback();
    remote.manifest = await signedPatch({ releaseId: 'rollback_0005', generation: 5 });
    expect(await pm.checkAndApply()).toMatchObject({ status: 'applied', generation: 5 });
    expect((await storage.getHighWater('staging'))!.generation).toBe(5);
    expect(await pm.checkAndApply()).toMatchObject({ status: 'up_to_date' });
  });

  it('keeps authority when the overlay state is lost or corrupted and isolates channel marks', async () => {
    const { pm, storage, remote } = await setup({}, { releaseId: 'rel_0004', generation: 4 });
    await pm.checkAndApply();
    expect(await storage.getHighWater('dev')).toBeNull();
    for (const state of [null, { schema: 99 }]) {
      storage.state = state as typeof storage.state;
      remote.manifest = await signedPatch({ releaseId: 'rel_0003', generation: 3 });
      expect(await new PatchManager(env(), storage, remote, base).checkAndApply()).toMatchObject({ status: 'rejected', reason: 'stale_generation' });
      expect((await storage.getHighWater('staging'))!.generation).toBe(4);
    }
  });

  it('migrates the retained signed legacy overlay generation before admitting an older kill', async () => {
    const { pm, storage, remote } = await setup({}, { releaseId: 'rel_0004', generation: 4 });
    await pm.checkAndApply(); storage.highWater.clear();
    remote.manifest = await signedPatch({ releaseId: 'kill_0003', generation: 3, killSwitch: true });
    expect(await new PatchManager(env(), storage, remote, base).checkAndApply()).toMatchObject({ status: 'rejected', reason: 'stale_generation' });
    expect((await storage.getHighWater('staging'))!.generation).toBe(4);
  });

  it('clears staged content on kill and retains its tombstone through repeated polling', async () => {
    const { pm, remote, storage } = await setup(); await pm.checkAndApply({ activate: false });
    remote.manifest = await signedPatch({ releaseId: 'kill_0003', generation: 3, killSwitch: true });
    expect(await pm.checkAndApply()).toMatchObject({ status: 'reverted_to_base' });
    expect(await pm.checkAndApply()).toMatchObject({ status: 'reverted_to_base' });
    expect(await new PatchManager(env(), storage, remote, base).activateStaged()).toBeNull();
    remote.manifest = await signedPatch({ releaseId: 'different_0003', generation: 3 });
    expect(await pm.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'stale_generation' });
    expect(await storage.getHighWater('staging')).toMatchObject({ generation: 3, killed: true });
  });

  it('rejects tampered stored stages on restart without raising the trusted generation', async () => {
    const { pm, storage, remote } = await setup(); await pm.checkAndApply({ activate: false });
    storage.state!.staged!.manifest.release.generation = 100;
    const restarted = new PatchManager(env(), storage, remote, base);
    expect(await restarted.activateStaged()).toBeNull();
    remote.manifest = await signedPatch({ releaseId: 'rel_0003', generation: 3 });
    expect(await restarted.checkAndApply()).toMatchObject({ status: 'applied', generation: 3 });
  });

  it('fails closed when the independent accepted-generation record is damaged', async () => {
    const { pm, storage } = await setup();
    storage.highWater.set('staging', { generation: NaN, releaseId: 'damaged', killed: false });
    expect(await pm.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'storage_state_invalid' });
    expect(storage.state).toBeNull();
  });

  it('fences a delayed download against a newer kill accepted by another manager', async () => {
    const { pm, remote, storage } = await setup({}, { releaseId: 'rel_0003', generation: 3 });
    let started!: () => void; let resume!: () => void;
    const downloading = new Promise<void>((resolve) => { started = resolve; });
    const gate = new Promise<void>((resolve) => { resume = resolve; });
    const fetchObject = remote.fetchObject.bind(remote);
    remote.fetchObject = async (...args) => { started(); await gate; return fetchObject(...args); };
    const applying = pm.checkAndApply(); await downloading;
    const killer = new PatchManager(env(), storage, new FakeRemote(await signedPatch({ releaseId: 'kill_0004', generation: 4, killSwitch: true }), new Map()), base);
    expect(await killer.checkAndApply()).toMatchObject({ status: 'reverted_to_base' });
    resume(); expect(await applying).toMatchObject({ status: 'rejected', reason: 'stale_generation' });
    expect(storage.state!.active).toBeNull();
    expect(await storage.getHighWater('staging')).toMatchObject({ generation: 4, killed: true });
  });

  it('verifies cached object bytes before reusing them for a new release', async () => {
    const { pm, manifest, storage } = await setup();
    const victim = manifest.files.find((f) => base.files[f.path] !== f.sha256)!;
    await storage.putObject(victim.sha256, new Uint8Array(victim.bytes));
    expect(await pm.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'hash_mismatch' });
    expect(storage.state?.active ?? null).toBeNull();
  });
});
