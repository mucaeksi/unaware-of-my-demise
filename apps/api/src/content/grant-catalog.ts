import { z } from 'zod';
import { EconomyCatalog, type RewardAttachment } from '@uomd/content-schema';
import type { RuntimeCatalog } from './runtime-catalog';
import { HttpError } from './store';

/** Frozen definition subset travels with earned/paid obligations, independently of later publication or R2 availability. */
export const GrantCatalog = z.object({ releaseId: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), data: z.object({
  characters: z.array(EconomyCatalog.shape.characters.element).max(512), items: z.array(EconomyCatalog.shape.items.element).max(1024), gear: z.array(EconomyCatalog.shape.gear.element).max(4096)
}).strict() }).strict();
export type GrantCatalog = z.infer<typeof GrantCatalog>;
export function freezeGrantCatalog(catalog: RuntimeCatalog | undefined, rewards: readonly RewardAttachment[]): GrantCatalog | undefined {
  if (!catalog) return undefined;
  const characters = new Set(rewards.flatMap((r) => r.type === 'character' ? [r.itemId] : []));
  const items = new Set(rewards.flatMap((r) => r.type === 'item' ? [r.itemId] : []));
  const gear = new Set(rewards.flatMap((r) => r.type === 'gear' ? [r.gearId] : []));
  const data = {
    characters: catalog.data.characters.filter((r) => characters.has(r.id) && r.status !== 'retired'),
    items: catalog.data.items.filter((r) => items.has(r.item_id) && r.status !== 'retired'),
    gear: catalog.data.gear.filter((r) => gear.has(r.gear_id) && r.status !== 'retired')
  };
  if (data.characters.length !== characters.size || data.items.length !== items.size || data.gear.length !== gear.size) throw new HttpError(422, 'unknown_item', 'reward definitions are unavailable in the selected release');
  // Subsets may be empty even though the complete published catalog cannot be.
  return { releaseId: catalog.releaseId, sha256: catalog.sha256, data };
}
