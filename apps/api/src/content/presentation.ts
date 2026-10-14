import { PRESENTATION_PATH, PresentationPack, ShopSchedule } from '@uomd/content-schema';
import type { GameEnv } from '../env';
import { inWindow, releaseData, selectedRelease } from './release-data';
type Env = Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>;
export async function availablePanels(env: Env, playerId: string, releaseId: string, now = new Date()): Promise<{ releaseId: string; panelIds: string[]; serverTimeMs: number }> {
  const pack = await releaseData(env, releaseId, PRESENTATION_PATH, PresentationPack);
  const { results } = await env.DB.prepare('SELECT node_id FROM player_progress WHERE player_id = ?1 AND (stars > 0 OR clears > 0)').bind(playerId).all<{ node_id: string }>();
  const cleared = new Set(results.map((r) => r.node_id));
  return { releaseId, serverTimeMs: now.getTime(), panelIds: Object.entries(pack?.panels ?? {}).filter(([, p]) => (!p.after_node || cleared.has(p.after_node)) && (!p.window || inWindow(p.window, now))).map(([id]) => id) };
}
export async function scheduledProducts<T extends { productId?: unknown }>(env: Env, products: T[], releaseId?: string, now = new Date()): Promise<T[]> {
  const id = await selectedRelease(env, releaseId);
  const schedule = id ? await releaseData(env, id, 'schedules/shop.json', ShopSchedule) : undefined;
  return products.filter((p) => { const slot = schedule?.offers.find((s) => s.product_id === p.productId); return !slot || inWindow(slot.window, now); });
}
