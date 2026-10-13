import type { StoryLoanEquipment } from '@uomd/content-schema';
import { aggregateGear, rollAccessory, type GearPiece, type GearStats, type ProgressionConfig } from '@uomd/economy';
import { crc32, Rng } from '@uomd/shared';
import { z } from 'zod';
import { HttpError } from '../content/store';
import { requireSupportedGearPassive } from '../gear/effects';

const Pool = z.array(z.object({ stat_id: z.string().min(1).max(100), weight: z.number().positive().max(100_000), unit: z.enum(['percent', 'flat']),
  min_value: z.number().min(0), max_value: z.number().min(0) }).refine((entry) => entry.min_value <= entry.max_value, 'invalid stat range')).min(1).max(40);
const Accessory = z.object({ main: Pool, sub: Pool, profile: z.object({ substat_count: z.number().int().min(1).max(6),
  is_rerollable: z.boolean(), reroll_cost: z.number().nullable(), minimum_substat_value_rolls: z.literal(1).optional(), maximum_substat_value_rolls: z.literal(1).optional() }).passthrough().optional() }).passthrough();
interface Definition { gear_id: string; slot: GearPiece['slot']; set_id: string | null; base_json: string; growth_json: string; extra_json: string }

/** Virtual pieces only: never mint inventory, spend materials or reroll the player's equipment. */
export async function loanGear(db: D1Database, characterId: string, weaponType: string | null, role: string, stageId: string, cfg: ProgressionConfig, template: StoryLoanEquipment): Promise<GearStats> {
  const columns = 'gear_id, slot, set_id, base_json, growth_json, extra_json';
  const batches = await db.batch([
    db.prepare(`SELECT ${columns} FROM gear_defs WHERE slot = 'weapon' AND family = ?1 AND rarity = ?2 AND owner_character_id IS NULL ORDER BY gear_id LIMIT 1`).bind(weaponType, template.rarity),
    db.prepare(`SELECT ${columns} FROM gear_defs WHERE gear_id = ?1 AND slot = 'armor' AND rarity = ?2`).bind(template.armor_id, template.rarity),
    db.prepare('SELECT pieces_for_bonus, bonus_json FROM accessory_sets WHERE set_id = ?1').bind(template.accessory_set_id),
    db.prepare("SELECT value_json FROM game_config WHERE key = 'gear'"),
    ...template.accessory_slots.map((slot) => db.prepare(`SELECT ${columns} FROM gear_defs WHERE slot = ?1 AND set_id = ?2 AND rarity = ?3 ORDER BY gear_id LIMIT 1`).bind(slot, template.accessory_set_id, template.rarity))
  ]);
  if (batches.some((batch) => batch.results.length !== 1)) throw new HttpError(503, 'loan_equipment_missing', 'the declared story equipment needs catalog review');
  try {
    const defs = [batches[0]!.results[0], batches[1]!.results[0], ...batches.slice(4).map((batch) => batch.results[0])] as Definition[];
    const pieces: GearPiece[] = defs.map((def) => {
      requireSupportedGearPassive(def.extra_json);
      const piece: GearPiece = { slot: def.slot, setId: def.set_id, level: template.level, ascension: template.ascension,
        base: JSON.parse(def.base_json), growth: JSON.parse(def.growth_json) };
      if (def.slot === 'necklace' || def.slot === 'ring') {
        const accessory = Accessory.parse(JSON.parse(def.extra_json));
        const rng = new Rng(crc32(`${characterId}:${stageId}:${def.gear_id}`));
        piece.rolled = rollAccessory(accessory, () => rng.next());
      }
      return piece;
    });
    const config = JSON.parse((batches[3]!.results[0] as { value_json: string }).value_json) as { roleStat?: Record<string, string> };
    const roles = config.roleStat ?? {}; const key = Object.keys(roles).find((candidate) => candidate !== 'default' && role.includes(candidate));
    const roleStat = (key ? roles[key] : roles.default) ?? 'atk_pct';
    const set = batches[2]!.results[0] as { pieces_for_bonus: number; bonus_json: string };
    const bonus = z.object({ stat: z.string().min(1).max(100), pct: z.number().min(0).max(5) }).parse(JSON.parse(set.bonus_json));
    return aggregateGear(cfg, pieces, roleStat, { [template.accessory_set_id]: { piecesForBonus: set.pieces_for_bonus, stat: bonus.stat, pct: bonus.pct } });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, 'loan_equipment_invalid', 'the declared story equipment needs catalog review');
  }
}
