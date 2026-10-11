import { z } from 'zod';
import { aggregateGear, equipmentLevelFee, equipmentXpToNext, finalStats, gearLevelCap, rerollAccessory, type AccessoryDef, type AccessoryStats, type GearPiece, type ProgressionConfig } from '@uomd/economy';
import { HttpError } from '../content/store';
import { stackAdd, stackSpend } from '../db/grants';
import { balanceOf, ledgerStatements } from '../db/ledger';
import { cryptoRoll } from '../db/rng';
import { loadProgressionConfig } from '../progression/characters';
import { taskEventStatements } from '../tasks/service';

export const GearRequest = z.object({ requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/) }).strict();
export const EquipBody = z.object({ characterId: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/) }).strict();
export const GearLevelBody = z.object({ requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/), xp: z.number().int().min(1).max(1_000_000) }).strict();
export const LockBody = z.object({ locked: z.boolean() }).strict();

export interface GearRow {
  id: number;
  gear_id: string;
  slot: 'weapon' | 'armor' | 'necklace' | 'ring';
  level: number;
  xp: number;
  ascension: number;
  equipped_by: string | null;
  stats_json: string;
  locked: number;
  version: number;
  name_en: string;
  rarity: number;
  family: string;
  set_id: string | null;
  level_cap: number;
  base_json: string;
  growth_json: string;
  extra_json: string;
  owner_character_id: string | null;
  dismantle_allowed: number;
  dismantle_xp: number;
  dismantle_json: string;
}

const JOIN =
  'SELECT g.id, g.gear_id, g.slot, g.level, g.xp, g.ascension, g.equipped_by, g.stats_json, g.locked, g.version, d.name_en, d.rarity, d.family, d.set_id, d.level_cap, d.base_json, d.growth_json, d.extra_json, d.owner_character_id, d.dismantle_allowed, d.dismantle_xp, d.dismantle_json FROM player_gear g JOIN gear_defs d ON d.gear_id = g.gear_id';

async function getGear(db: D1Database, playerId: string, id: number): Promise<GearRow> {
  const row = await db.prepare(`${JOIN} WHERE g.id = ?1 AND g.player_id = ?2`).bind(id, playerId).first<GearRow>();
  if (!row) throw new HttpError(404, 'no_such_gear', 'you do not have this item');
  return row;
}

export interface GearView {
  id: number;
  gearId: string;
  slot: string;
  name: string;
  rarity: number;
  family: string;
  setId: string | null;
  level: number;
  levelCap: number;
  xp: number;
  xpToNext: number | null;
  ascension: number;
  equippedBy: string | null;
  locked: boolean;
  stats: AccessoryStats | null;
  passive: { name?: string; text?: string } | null;
  canDismantle: boolean;
}

export async function listGear(db: D1Database, playerId: string): Promise<GearView[]> {
  const cfg = await loadProgressionConfig(db);
  const { results } = await db.prepare(`${JOIN} WHERE g.player_id = ?1 ORDER BY d.rarity DESC, g.slot, g.id`).bind(playerId).all<GearRow>();
  return results.map((g) => {
    const cap = Math.min(g.level_cap, gearLevelCap(cfg, g.ascension));
    const extra = JSON.parse(g.extra_json) as { passive_name_en?: string; passive_effect_en?: string };
    return {
      id: g.id,
      gearId: g.gear_id,
      slot: g.slot,
      name: g.name_en,
      rarity: g.rarity,
      family: g.family,
      setId: g.set_id,
      level: g.level,
      levelCap: cap,
      xp: g.xp,
      xpToNext: g.slot === 'weapon' || g.slot === 'armor' ? (g.level >= g.level_cap ? null : equipmentXpToNext(cfg, g.level)) : null,
      ascension: g.ascension,
      equippedBy: g.equipped_by,
      locked: g.locked === 1,
      stats: g.slot === 'necklace' || g.slot === 'ring' ? (JSON.parse(g.stats_json) as AccessoryStats) : null,
      passive: extra.passive_name_en ? { name: extra.passive_name_en, ...(extra.passive_effect_en ? { text: extra.passive_effect_en } : {}) } : null,
      canDismantle: g.dismantle_allowed === 1 && g.equipped_by === null && g.locked === 0
    };
  });
}

/** Generic atomic gear operation with replay protection (reuses progression_requests). */
async function gearOp(db: D1Database, playerId: string, id: number, requestId: string, kind: string, build: (g: GearRow, cfg: ProgressionConfig) => Promise<{ statements: D1PreparedStatement[]; response: Record<string, unknown> }>): Promise<Record<string, unknown>> {
  const stored = async (): Promise<Record<string, unknown> | null> => {
    const r = await db.prepare('SELECT kind, result_json FROM progression_requests WHERE player_id = ?1 AND request_id = ?2').bind(playerId, requestId).first<{ kind: string; result_json: string }>();
    if (!r) return null;
    if (r.kind !== `${kind}:${id}`) throw new HttpError(409, 'request_id_reused', 'this requestId was already used for a different operation');
    return { ...(JSON.parse(r.result_json) as Record<string, unknown>), replayed: true };
  };
  const first = await stored();
  if (first) return first;
  const cfg = await loadProgressionConfig(db);
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      const seen = await stored();
      if (seen) return seen;
    }
    const g = await getGear(db, playerId, id);
    const { statements, response } = await build(g, cfg);
    const batch = [
      // optimistic concurrency on the instance: version must still match, or somebody changed it meanwhile
      db.prepare('UPDATE player_gear SET version = version + 1 WHERE id = ?1 AND player_id = ?2 AND version = ?3').bind(id, playerId, g.version),
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
      ...statements,
      ...(kind === 'gear_level' ? await taskEventStatements(db, playerId, { level_ups: 1 }) : []),
      db.prepare('INSERT INTO progression_requests (player_id, request_id, kind, result_json) VALUES (?1, ?2, ?3, ?4)').bind(playerId, requestId, `${kind}:${id}`, JSON.stringify(response)),
      db.prepare('DELETE FROM tx_guard')
    ];
    try {
      await db.batch(batch);
      return { ...response, balance: await balanceOf(db, playerId, 'eclipse_token'), replayed: false };
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      if (/CHECK constraint failed: ok = 1/i.test(msg)) continue;
      if (/CHECK constraint failed: qty >= 0/i.test(msg)) throw new HttpError(402, 'insufficient_items', 'you do not have enough materials');
      if (/CHECK constraint failed: balance >= 0/i.test(msg)) throw new HttpError(402, 'insufficient_funds', 'not enough of the main currency');
      if (/UNIQUE constraint failed: (progression_requests|ledger)/i.test(msg)) continue;
      throw e;
    }
  }
  throw new HttpError(409, 'busy', 'too many simultaneous changes to this item, try again');
}

const feeStatements = (db: D1Database, playerId: string, fee: number, reason: string, requestId: string): D1PreparedStatement[] =>
  fee > 0 ? ledgerStatements(db, { playerId, currency: 'eclipse_token', delta: -fee, reason, idempotencyKey: `gear:${playerId}:${requestId}` }) : [];

export function equipGear(db: D1Database, playerId: string, id: number, characterId: string): Promise<Record<string, unknown>> {
  return (async () => {
    const g = await getGear(db, playerId, id);
    const ch = await db
      .prepare("SELECT c.weapon_type FROM player_items i JOIN characters c ON c.id = i.item_id WHERE i.player_id = ?1 AND i.item_type = 'character' AND i.item_id = ?2")
      .bind(playerId, characterId)
      .first<{ weapon_type: string | null }>();
    if (!ch) throw new HttpError(404, 'not_owned', 'you do not own this character');
    if (g.slot === 'weapon' && g.owner_character_id !== characterId && g.family !== ch.weapon_type) throw new HttpError(422, 'wrong_weapon_type', 'this character cannot use that weapon type');
    if (g.slot === 'weapon' && g.owner_character_id && g.owner_character_id !== characterId) throw new HttpError(422, 'signature_locked', 'a signature weapon belongs to its character');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await db.batch([
          db.prepare('UPDATE player_gear SET equipped_by = NULL, version = version + 1 WHERE player_id = ?1 AND equipped_by = ?2 AND slot = ?3 AND id <> ?4').bind(playerId, characterId, g.slot, id),
          db.prepare('UPDATE player_gear SET equipped_by = ?3, version = version + 1 WHERE id = ?1 AND player_id = ?2').bind(id, playerId, characterId)
        ]);
        return { id, equippedBy: characterId, slot: g.slot };
      } catch (e) {
        if (/UNIQUE constraint failed: player_gear/i.test(String(e instanceof Error ? e.message : e))) continue; // a parallel equip took the slot: swap again
        throw e;
      }
    }
    throw new HttpError(409, 'busy', 'too many simultaneous changes, try again');
  })();
}

export async function unequipGear(db: D1Database, playerId: string, id: number): Promise<Record<string, unknown>> {
  await getGear(db, playerId, id);
  await db.prepare('UPDATE player_gear SET equipped_by = NULL, version = version + 1 WHERE id = ?1 AND player_id = ?2').bind(id, playerId).run();
  return { id, equippedBy: null };
}

export async function lockGear(db: D1Database, playerId: string, id: number, locked: boolean): Promise<Record<string, unknown>> {
  await getGear(db, playerId, id);
  await db.prepare('UPDATE player_gear SET locked = ?3, version = version + 1 WHERE id = ?1 AND player_id = ?2').bind(id, playerId, locked ? 1 : 0).run();
  return { id, locked };
}

/** Spend tempering XP on a weapon or armor. No waste: only what is needed up to the current cap is consumed. */
export function levelGear(db: D1Database, playerId: string, id: number, input: z.infer<typeof GearLevelBody>): Promise<Record<string, unknown>> {
  return gearOp(db, playerId, id, input.requestId, 'gear_level', async (g, cfg) => {
    if (g.slot !== 'weapon' && g.slot !== 'armor') throw new HttpError(422, 'not_levelable', 'only weapons and armor level up');
    const cap = Math.min(g.level_cap, gearLevelCap(cfg, g.ascension));
    if (g.level >= cap) throw new HttpError(409, 'at_cap', g.level >= g.level_cap ? 'maximum level' : 'spend Blacksmith Rivets to unlock the next 5 levels', { cap, ascension: g.ascension });
    let level = g.level;
    let xp = g.xp + input.xp;
    let used = input.xp;
    const feeLevels: number[] = [];
    while (level < cap && xp >= equipmentXpToNext(cfg, level)) {
      xp -= equipmentXpToNext(cfg, level);
      feeLevels.push(level);
      level++;
    }
    if (level >= cap) {
      used -= xp; // the surplus is not consumed
      xp = 0;
    }
    const fee = feeLevels.reduce((s, l) => s + equipmentLevelFee(cfg, l), 0);
    return {
      statements: [
        db.prepare('UPDATE player_gear SET level = ?3, xp = ?4 WHERE id = ?1 AND player_id = ?2').bind(id, playerId, level, xp),
        stackSpend(db, playerId, cfg.equipment.xpItemId, used),
        ...feeStatements(db, playerId, fee, `gear_level:${id}`, input.requestId)
      ],
      response: { id, level, xp, cap, spentXp: used, fee }
    };
  });
}

/** Rivet milestone: unlocks the next five levels and the milestone bonus. */
export function ascendGear(db: D1Database, playerId: string, id: number, input: z.infer<typeof GearRequest>): Promise<Record<string, unknown>> {
  return gearOp(db, playerId, id, input.requestId, 'gear_ascend', async (g, cfg) => {
    const next = cfg.equipment.milestones[g.ascension];
    if (!next) throw new HttpError(409, 'max_ascension', 'no further milestones');
    if (g.level < Math.min(g.level_cap, gearLevelCap(cfg, g.ascension))) throw new HttpError(409, 'not_at_cap', `reach level ${gearLevelCap(cfg, g.ascension)} first`);
    return {
      statements: [db.prepare('UPDATE player_gear SET ascension = ascension + 1 WHERE id = ?1 AND player_id = ?2').bind(id, playerId), stackSpend(db, playerId, cfg.equipment.milestoneItemId, next.rivets)],
      response: { id, ascension: g.ascension + 1, newCap: gearLevelCap(cfg, g.ascension + 1), spentRivets: next.rivets }
    };
  });
}

/** Destroys an unequipped, unlocked, dismantle-able piece for tempering XP and crafting materials. */
export function dismantleGear(db: D1Database, playerId: string, id: number, input: z.infer<typeof GearRequest>): Promise<Record<string, unknown>> {
  return gearOp(db, playerId, id, input.requestId, 'gear_dismantle', async (g, cfg) => {
    if (!g.dismantle_allowed) throw new HttpError(422, 'not_dismantlable', 'this item cannot be dismantled');
    if (g.equipped_by) throw new HttpError(409, 'equipped', 'unequip it first');
    if (g.locked) throw new HttpError(409, 'locked', 'unlock it first');
    const out = JSON.parse(g.dismantle_json) as { item_id: string; quantity: number }[];
    const caps = new Map((await db.prepare('SELECT item_id, stack_cap FROM item_defs').all<{ item_id: string; stack_cap: number }>()).results.map((r) => [r.item_id, r.stack_cap]));
    const gains = [...(g.dismantle_xp > 0 ? [{ item_id: cfg.equipment.xpItemId, quantity: g.dismantle_xp }] : []), ...out];
    return {
      // version bump above makes the delete race-safe; the delete itself requires the piece to still be free
      statements: [
        ...gains.map((x) => stackAdd(db, playerId, x.item_id, x.quantity, caps.get(x.item_id) ?? 9999)),
        db.prepare('DELETE FROM player_gear WHERE id = ?1 AND player_id = ?2 AND equipped_by IS NULL AND locked = 0').bind(id, playerId)
      ],
      response: { id, gained: gains.map((x) => ({ itemId: x.item_id, quantity: x.quantity })) }
    };
  });
}

/** 4-star and 5-star accessories can re-roll their sub stats with Cinders of the Unwritten Hour; main stat, set, slot and rarity stay. */
export function rerollGear(db: D1Database, playerId: string, id: number, input: z.infer<typeof GearRequest>): Promise<Record<string, unknown>> {
  return gearOp(db, playerId, id, input.requestId, 'gear_reroll', async (g) => {
    if (g.slot !== 'necklace' && g.slot !== 'ring') throw new HttpError(422, 'not_accessory', 'only accessories can be re-rolled');
    const gcfg = (await db.prepare("SELECT value_json FROM game_config WHERE key = 'gear'").first<{ value_json: string }>());
    const rc = (JSON.parse(gcfg?.value_json ?? '{}') as { rerollCost?: { itemId: string; quantityByRarity: Record<string, number> } }).rerollCost;
    const qty = rc?.quantityByRarity[String(g.rarity)];
    if (!rc || !qty) throw new HttpError(422, 'not_rerollable', `${g.rarity}-star accessories cannot be re-rolled`);
    const rolled = rerollAccessory(JSON.parse(g.extra_json) as AccessoryDef, JSON.parse(g.stats_json) as AccessoryStats, cryptoRoll);
    return {
      statements: [db.prepare('UPDATE player_gear SET stats_json = ?3 WHERE id = ?1 AND player_id = ?2').bind(id, playerId, JSON.stringify(rolled)), stackSpend(db, playerId, rc.itemId, qty)],
      response: { id, stats: rolled, spent: { itemId: rc.itemId, quantity: qty } }
    };
  });
}

/** Final combat stats of an owned character: level growth + equipped gear + set bonuses. This is what a server-verified party will use. */
export async function computeCharacterStats(db: D1Database, playerId: string, characterId: string, cfg?: ProgressionConfig): Promise<{ characterId: string; level: number; stats: { hp: number; atk: number; def: number; spd: number }; other: Record<string, number>; equipped: { id: number; slot: string; name: string }[] }> {
  cfg ??= await loadProgressionConfig(db);
  const ch = await db
    .prepare("SELECT c.base_hp, c.base_atk, c.base_def, c.base_spd, c.growth_hp, c.growth_atk, c.growth_def, c.growth_spd, c.role FROM player_items i JOIN characters c ON c.id = i.item_id WHERE i.player_id = ?1 AND i.item_type = 'character' AND i.item_id = ?2")
    .bind(playerId, characterId)
    .first<{ base_hp: number; base_atk: number; base_def: number; base_spd: number; growth_hp: number; growth_atk: number; growth_def: number; growth_spd: number; role: string }>();
  if (!ch) throw new HttpError(404, 'not_owned', 'you do not own this character');
  const st = await db.prepare('SELECT level FROM player_chars WHERE player_id = ?1 AND character_id = ?2').bind(playerId, characterId).first<{ level: number }>();
  const level = st?.level ?? 1;
  const { results } = await db.prepare(`${JOIN} WHERE g.player_id = ?1 AND g.equipped_by = ?2`).bind(playerId, characterId).all<GearRow>();
  const gcfg = JSON.parse((await db.prepare("SELECT value_json FROM game_config WHERE key = 'gear'").first<{ value_json: string }>())?.value_json ?? '{}') as { roleStat?: Record<string, string> };
  const roles = gcfg.roleStat ?? {};
  const roleKey = Object.keys(roles).find((k) => k !== 'default' && ch.role.includes(k));
  const roleStat = (roleKey ? roles[roleKey] : roles.default) ?? 'atk_pct';
  const setRows = (await db.prepare('SELECT set_id, pieces_for_bonus, bonus_json FROM accessory_sets').all<{ set_id: string; pieces_for_bonus: number; bonus_json: string }>()).results;
  const sets = Object.fromEntries(setRows.map((s) => [s.set_id, { piecesForBonus: s.pieces_for_bonus, ...(() => { const b = JSON.parse(s.bonus_json) as { stat: string; pct: number }; return { stat: b.stat, pct: b.pct }; })() }]));
  const pieces: GearPiece[] = results.map((g) => ({
    slot: g.slot,
    setId: g.set_id,
    level: g.level,
    ascension: g.ascension,
    base: JSON.parse(g.base_json) as Record<string, number | string>,
    growth: JSON.parse(g.growth_json) as Record<string, number>,
    ...(g.slot === 'necklace' || g.slot === 'ring' ? { rolled: JSON.parse(g.stats_json) as AccessoryStats } : {})
  }));
  const gear = aggregateGear(cfg, pieces, roleStat, sets);
  const stats = finalStats({ hp: ch.base_hp, atk: ch.base_atk, def: ch.base_def, spd: ch.base_spd }, { hp: ch.growth_hp, atk: ch.growth_atk, def: ch.growth_def, spd: ch.growth_spd }, level, gear);
  return { characterId, level, stats, other: gear.other, equipped: results.map((g) => ({ id: g.id, slot: g.slot, name: g.name_en })) };
}

export async function characterStats(db: D1Database, playerId: string, characterId: string): Promise<Record<string, unknown>> {
  return computeCharacterStats(db, playerId, characterId);
}
