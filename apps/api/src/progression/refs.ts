import type { ProgressionConfig } from '@uomd/economy';
import { HttpError } from '../content/store';

/** Validate material identities against the authoritative catalog before accepting new config. */
export async function progressionRefsExist(db: D1Database, config: ProgressionConfig): Promise<void> {
  const ids = [...new Set([config.equipment.xpItemId, config.equipment.milestoneItemId,
    ...Object.values(config.character.skills.itemBySkillType), ...config.character.ascension.flatMap((step) => step.items.map((item) => item.itemId))])];
  const { results } = await db.prepare(`SELECT item_id FROM item_defs WHERE item_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<{ item_id: string }>();
  const known = new Set(results.map((row) => row.item_id));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length) throw new HttpError(422, 'invalid_config', `Unknown progression materials: ${missing.slice(0, 3).join(', ')}`);
}
