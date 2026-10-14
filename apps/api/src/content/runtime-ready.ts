import { z } from 'zod';
import type { AdminEnv } from '../env';
import { ContentManifest } from '@uomd/content-schema';
import { HttpError, type ReleaseRow } from './store';

const Health = z.object({ environment: z.string(), channel: z.string(), d1: z.object({ ok: z.literal(true), migrations_applied: z.number().int().min(27) }), runtime: z.object({ catalog_protocol: z.number().int().min(1), capabilities: z.array(z.string()).max(32) }) });
/** Independent Worker builds can finish in either order. Do not activate new data against an older game backend. */
export async function requireGameRuntime(env: Pick<AdminEnv, 'ENVIRONMENT' | 'GAME'>, release: ReleaseRow | null): Promise<void> {
  if (!release) return; // The store retains its normal not-found response.
  const needed = ContentManifest.parse(JSON.parse(release.manifest_json)).compat.required_capabilities ?? [];
  if (!needed.length) return;
  const unavailable = () => new HttpError(503, 'game_runtime_unavailable', 'the game runtime and migration 0027 must support this content before publication');
  if (!env.GAME) throw unavailable();
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(unavailable()); }, 3000); });
    const check = async () => {
      const response = await env.GAME!.fetch('https://uomd-game.internal/api/v1/health', { signal: controller.signal });
      if (!response.ok) throw unavailable();
      const parsed = Health.safeParse(await response.json());
      if (!parsed.success || parsed.data.environment !== env.ENVIRONMENT || parsed.data.channel !== release.channel || needed.some((capability) => !parsed.data.runtime.capabilities.includes(capability))) throw unavailable();
    };
    await Promise.race([check(), expired]);
  } catch { throw unavailable(); }
  finally { clearTimeout(timer); }
}
