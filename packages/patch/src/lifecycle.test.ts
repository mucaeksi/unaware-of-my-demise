import { beforeAll, describe, expect, it } from 'vitest';
import { generateSigningKeyPair, importPrivateKey, sha256Hex, type PublicKeyJwk } from '@uomd/shared';
import { buildManifest, signManifest, MemoryStorage, PatchManager, type PatchEnv, type RemoteSource } from './index';
let key: CryptoKey; let trusted: PublicKeyJwk;
beforeAll(async () => { const pair = await generateSigningKeyPair(); key = await importPrivateKey(pair.privateJwk); trusted = { ...pair.publicJwk, kid: 'lifecycle' } as PublicKeyJwk; });
const base = { releaseId: 'rel_base', generation: 1, files: {}, read: async () => new Uint8Array() };
const env = (over: Partial<PatchEnv> = {}): PatchEnv => ({ channel: 'dev', clientVersion: '0.1.2', supportedContentSchema: 1, trustedKeys: [trusted], installId: 'fixture', storageBudgetBytes: 100, validate: () => undefined, sleep: async () => undefined, maxAttempts: 1, ...over });
async function fixture(generation = 2, value = '1234567890') {
  const bytes = new TextEncoder().encode(value); const sha = await sha256Hex(bytes);
  const manifest = await signManifest(await buildManifest({ releaseId: `rel_test_${generation}`, generation, channel: 'dev', minClient: '0.1.0', notes: 'Synthetic test data only' }, [{ path: `data/file_${generation}.txt`, bytes }]), key, 'lifecycle');
  return { bytes, sha, manifest, remote: { fetchManifest: async () => manifest, fetchObject: async () => bytes } satisfies RemoteSource };
}
describe('patch lifecycle faults', () => {
  it('charges active, previous and staged objects together and retains both healthy generations on refusal', async () => {
    const storage = new MemoryStorage();
    const one = await fixture(2, '1111111111'); const two = await fixture(3, '2222222222'); const three = await fixture(4, '3333333333');
    expect((await new PatchManager(env(), storage, one.remote, base).checkAndApply()).status).toBe('applied');
    expect((await new PatchManager(env(), storage, two.remote, base).checkAndApply()).status).toBe('applied');
    expect(await new PatchManager(env({ storageBudgetBytes: 29 }), storage, three.remote, base).checkAndApply({ activate: false })).toMatchObject({ status: 'rejected', reason: 'storage_budget' });
    expect((await storage.getState())?.active?.releaseId).toBe('rel_test_3'); expect((await storage.getState())?.previous?.releaseId).toBe('rel_test_2');
    expect(await storage.hasObject(one.sha)).toBe(true); expect(await storage.hasObject(two.sha)).toBe(true);
  });
  it('cancels a hanging source and prevents its late success from changing state or storing objects', async () => {
    const f = await fixture(); const storage = new MemoryStorage(); const controller = new AbortController();
    let complete!: (bytes: Uint8Array) => void; let started!: () => void;
    const began = new Promise<void>((r) => { started = r; });
    const remote: RemoteSource = { fetchManifest: async () => f.manifest, fetchObject: async () => { started(); return new Promise((r) => { complete = r; }); } };
    const pending = new PatchManager(env(), storage, remote, base).checkAndApply({ signal: controller.signal });
    await began; controller.abort(); expect(await pending).toMatchObject({ status: 'rejected', reason: 'cancelled' });
    complete(f.bytes); await new Promise((r) => setTimeout(r, 0));
    expect((await storage.getState())?.active ?? null).toBeNull(); expect(await storage.hasObject(f.sha)).toBe(false);
  });
  it('times out a source which ignores AbortSignal', async () => {
    const storage = new MemoryStorage(); const remote: RemoteSource = { fetchManifest: async () => new Promise(() => undefined), fetchObject: async () => new Uint8Array() };
    expect(await new PatchManager(env({ downloadTimeoutMs: 10 }), storage, remote, base).checkAndApply()).toMatchObject({ status: 'rejected', reason: 'download_timeout' });
    expect((await storage.getState())?.active ?? null).toBeNull();
  });
  it('requires explicit mobile-data consent and refuses low browser quota before downloading', async () => {
    const f = await fixture(); let fetched = 0; f.remote.fetchObject = async () => { fetched++; return f.bytes; };
    const storage = new MemoryStorage();
    const manager = new PatchManager(env({ networkPolicy: () => 'metered' }), storage, f.remote, base);
    expect(await manager.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'network_policy' }); expect(fetched).toBe(0);
    expect((await manager.checkAndApply({ allowMetered: true })).status).toBe('applied');
    const quota = new PatchManager(env({ storageEstimate: async () => ({ quota: 100, usage: 99 }) }), new MemoryStorage(), f.remote, base);
    expect(await quota.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'storage_quota' }); expect(fetched).toBe(1);
  });
  it('resumes a retained prefix but hashes the complete object before activation', async () => {
    const f = await fixture(); const storage = new MemoryStorage(); await storage.putObject(`partial:${f.sha}`, f.bytes.slice(0, 4));
    const remote: RemoteSource = { fetchManifest: async () => f.manifest, fetchObject: async (_sha, _file, _progress, options) => { expect(options?.partial).toEqual(f.bytes.slice(0, 4)); return f.bytes; } };
    expect((await new PatchManager(env(), storage, remote, base).checkAndApply()).status).toBe('applied');
    expect(await storage.hasObject(`partial:${f.sha}`)).toBe(false); expect(await storage.getObject(f.sha)).toEqual(f.bytes);
  });
  it('rejects an unimplemented declared capability before requesting any objects', async () => {
    const f = await fixture(); let called = false;
    f.manifest.compat.required_capabilities = ['future_renderer']; const signed = await signManifest(f.manifest, key, 'lifecycle');
    const remote: RemoteSource = { fetchManifest: async () => signed, fetchObject: async () => { called = true; return f.bytes; } };
    expect(await new PatchManager(env(), new MemoryStorage(), remote, base).checkAndApply()).toMatchObject({ status: 'rejected', reason: 'capability_missing' }); expect(called).toBe(false);
  });
  it('atomically reserves shared storage and protects an in-flight download from competing GC', async () => {
    const storage = new MemoryStorage(); const one = await fixture(2); const two = await fixture(3, 'different!');
    let started!: () => void; let finish!: () => void; const began = new Promise<void>((r) => { started = r; }); const gate = new Promise<void>((r) => { finish = r; });
    const slow: RemoteSource = { fetchManifest: async () => one.manifest, fetchObject: async (_sha, _file, _progress, options) => { await options?.onPartial?.(one.bytes.slice(0, 3)); started(); await gate; return one.bytes; } };
    const first = new PatchManager(env({ storageBudgetBytes: 15 }), storage, slow, base).checkAndApply(); await began;
    expect(await new PatchManager(env({ storageBudgetBytes: 15 }), storage, two.remote, base).checkAndApply()).toMatchObject({ status: 'rejected', reason: 'storage_budget' });
    expect(await storage.hasObject(`partial:${one.sha}`)).toBe(true); finish(); expect((await first).status).toBe('applied');
  });
});
it('retains the healthy state when object storage raises QuotaExceededError', async () => {
  const good = await fixture(2); const next = await fixture(3, 'next-data'); const storage = new MemoryStorage();
  expect((await new PatchManager(env(), storage, good.remote, base).checkAndApply()).status).toBe('applied');
  const original = await storage.getState(); const put = storage.putObject.bind(storage);
  storage.putObject = async (hash, bytes, owner) => { if (hash === next.sha) throw new DOMException('Synthetic low disk fault', 'QuotaExceededError'); return put(hash, bytes, owner); };
  expect(await new PatchManager(env(), storage, next.remote, base).checkAndApply()).toMatchObject({ status: 'rejected', reason: 'storage_quota' });
  expect(await storage.getState()).toEqual(original); expect(await storage.hasObject(good.sha)).toBe(true);
});
it('refuses a hash-valid resource which exceeds decoder/header limits without activating it', async () => {
  const f = await fixture(); const storage = new MemoryStorage();
  const manager = new PatchManager(env({ validateObject: () => { throw new Error('Synthetic oversized bitmap'); } }), storage, f.remote, base);
  expect(await manager.checkAndApply()).toMatchObject({ status: 'rejected', reason: 'validation_failed' }); expect((await storage.getState())?.active ?? null).toBeNull();
});
it('retains an explicit offline capability requirement instead of silently widening compatibility', async () => {
  const bytes = new Uint8Array([1]); const manifest = await buildManifest({ releaseId: 'rel_explicit_cap', generation: 2, channel: 'dev', minClient: '0.1.0', notes: 'Synthetic compatibility fixture', requiredCapabilities: ['future_primitive'] }, [{ path: 'data/probe.txt', bytes }]);
  expect(manifest.compat).toMatchObject({ min_client: '0.1.2', required_capabilities: ['future_primitive'] });
});
