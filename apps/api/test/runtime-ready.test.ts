import { expect, it } from 'vitest';
import { manifestFromEntries } from '@uomd/patch';
import { requireGameRuntime } from '../src/content/runtime-ready';
import type { ReleaseRow } from '../src/content/store';
const manifest = manifestFromEntries({ releaseId: 'rel_runtime_test', generation: 1, channel: 'staging', notes: 'Synthetic readiness fixture', minClient: '0.1.2', requiredCapabilities: ['catalog_v1'] }, [{ path: 'data/probe.txt', sha256: 'a'.repeat(64), bytes: 1 }]);
const release = { id: manifest.release.id, channel: 'staging', manifest_json: JSON.stringify(manifest) } as ReleaseRow;
const connect = (): never => { throw new Error('readiness fixtures must not open raw sockets'); };
const healthy = { environment: 'staging', channel: 'staging', d1: { ok: true, migrations_applied: 27 }, runtime: { catalog_protocol: 1, capabilities: ['catalog_v1'] } };
it.each(['missing binding', 'old runtime', 'old schema', 'wrong environment', 'wrong channel', 'missing capability', 'outage'] as const)('blocks new content against %s', async (kind) => {
  const body = structuredClone(healthy);
  if (kind === 'old runtime') body.runtime.catalog_protocol = 0;
  if (kind === 'old schema') body.d1.migrations_applied = 26;
  if (kind === 'wrong environment') body.environment = 'dev';
  if (kind === 'wrong channel') body.channel = 'dev';
  if (kind === 'missing capability') body.runtime.capabilities = [];
  const GAME = kind === 'missing binding' ? undefined : { connect, fetch: async () => Response.json(body, { status: kind === 'outage' ? 503 : 200 }) } satisfies Fetcher;
  await expect(requireGameRuntime({ ENVIRONMENT: 'staging', GAME }, release)).rejects.toMatchObject({ code: 'game_runtime_unavailable' });
});
it('accepts the same-channel bound runtime and leaves catalog-free historical publication unchanged', async () => {
  const GAME = { connect, fetch: async () => Response.json(healthy) } satisfies Fetcher;
  await expect(requireGameRuntime({ ENVIRONMENT: 'staging', GAME }, release)).resolves.toBeUndefined();
  const legacy = structuredClone(manifest); delete legacy.compat.required_capabilities;
  await expect(requireGameRuntime({ ENVIRONMENT: 'staging' }, { ...release, manifest_json: JSON.stringify(legacy) })).resolves.toBeUndefined();
});
