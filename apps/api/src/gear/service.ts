import { canonicalJson } from '@uomd/shared';
import { z } from 'zod';
import { aggregateGear, characterStats as statsFor, resonancePoints, equipmentLevelFee, equipmentXpToNext, gearLevelCap, type AttributeValues, type CharacterStatSource, type CombatStats, rerollAccessory, type AccessoryDef, type AccessoryStats, type GearPiece, type ProgressionConfig } from '@uomd/economy';
import { HttpError } from '../content/store';
import { stackAdd, stackSpend } from '../db/grants';
import { balanceOf, ledgerStatements } from '../db/ledger';
import { cryptoRoll } from '../db/rng';
import { loadProgressionConfig } from '../progression/characters';
import { taskEventStatements } from '../tasks/service';
import { gearPassive, requireSupportedGearPassive } from './effects';
import { CHARACTER_STAT_COLUMNS, catalogCharacter, characterDefinition, rowAttributes, type CharacterStatRow, catalogGear, gearDefinition, catalogRoleStat, operationCatalog, type RuntimeCatalog, type ReleaseScope } from '../content/runtime-catalog';

import { economicStatement, requireEconomic } from '../content/authority';
import { identityStatement } from '../db/identities';

export const GearContext = z.object({ releaseId: z.string().regex(/^[a-z][a-z0-9_]{1,47}$/).optional() }).strict();
export const GearRequest = GearContext.extend({ requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/) }).strict();
export const EquipBody = GearContext.extend({ characterId: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/) }).strict();
export const GearLevelBody = GearContext.extend({ requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/), xp: z.number().int().min(1).max(1_000_000) }).strict();
export const LockBody = GearContext.extend({ locked: z.boolean() }).strict();

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

async function getGear(db: D1Database, playerId: string, id: number, catalog?: RuntimeCatalog): Promise<GearRow> {
  if (catalog) {
    const instance = await db.prepare('SELECT id, gear_id, slot, level, xp, ascension, equipped_by, stats_json, locked, version FROM player_gear WHERE id = ?1 AND player_id = ?2').bind(id, playerId).first<GearRow>();
    if (!instance) throw new HttpError(404, 'no_such_gear', 'you do not have this item');
    const definition = catalogGear(catalog, instance.gear_id);
    if (instance.slot !== definition.slot) throw new HttpError(503, 'invalid_gear_instance', 'item slot differs from its release definition');
    return { ...instance, ...gearDefinition(definition) };
  }
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
  passive: { name?: string; text?: string; supported: boolean } | null;
  canDismantle: boolean;
  unavailableReason?: string;
}

export async function listGear(db: D1Database, playerId: string, catalog?: RuntimeCatalog): Promise<GearView[]> {
  const cfg = catalog?.data.config.progression ?? await loadProgressionConfig(db);
  const instances = catalog ? (await db.prepare('SELECT id, gear_id, slot, level, xp, ascension, equipped_by, stats_json, locked, version FROM player_gear WHERE player_id = ?1').bind(playerId).all<GearRow>()).results : [];
  const available = (g: GearRow) => catalog!.data.gear.some((d) => d.gear_id === g.gear_id && d.status !== 'retired');
  const results = catalog ? instances.filter(available).map((g) => {
    const definition = catalogGear(catalog, g.gear_id);
    if (g.slot !== definition.slot) throw new HttpError(503, 'invalid_gear_instance', 'item slot differs from its release definition');
    return { ...g, ...gearDefinition(definition) };
  }) : (await db.prepare(`${JOIN} WHERE g.player_id = ?1 ORDER BY d.rarity DESC, g.slot, g.id`).bind(playerId).all<GearRow>()).results;
  results.sort((a, b) => b.rarity - a.rarity || a.slot.localeCompare(b.slot) || a.id - b.id);
  const views: GearView[] = results.map((g) => {
    const cap = Math.min(g.level_cap, gearLevelCap(cfg, g.ascension));
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
      passive: gearPassive(g.extra_json),
      canDismantle: g.dismantle_allowed === 1 && g.equipped_by === null && g.locked === 0
    };
  });
  if (catalog) for (const g of instances.filter((row) => !available(row))) views.push({ id: g.id, gearId: g.gear_id, slot: g.slot, name: g.gear_id, rarity: 0, family: '', setId: null, level: g.level, levelCap: g.level, xp: g.xp, xpToNext: null, ascension: g.ascension, equippedBy: g.equipped_by, locked: g.locked === 1, stats: null, passive: null, canDismantle: false, unavailableReason: 'Unavailable in this content version' });
  return views;
}

/** Generic atomic gear operation with replay protection (reuses progression_requests). */
async function gearOp(db: D1Database, playerId: string, id: number, input: { requestId: string } & Record<string, unknown>, kind: string, build: (g: GearRow, cfg: ProgressionConfig, catalog?: RuntimeCatalog) => Promise<{ statements: D1PreparedStatement[]; response: Record<string, unknown> }>, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const { requestId } = input;
  const inputJson = canonicalJson(input);
  const stored = async (): Promise<Record<string, unknown> | null> => {
    const r = await db.prepare('SELECT kind, result_json, input_json FROM progression_requests WHERE player_id = ?1 AND request_id = ?2').bind(playerId, requestId).first<{ kind: string; result_json: string; input_json: string | null }>();
    if (!r) return null;
    if (r.kind !== `${kind}:${id}` || r.input_json !== null && r.input_json !== inputJson) throw new HttpError(409, 'request_id_reused', 'this requestId was already used for a different operation');
    return { ...(JSON.parse(r.result_json) as Record<string, unknown>), replayed: true };
  };
  const first = await stored();
  if (first) return first;
  if (input.releaseId !== scope?.releaseId) throw new HttpError(400, 'release_context_mismatch', 'the selected release requires matching operation context');
  const catalog = await operationCatalog(db, playerId, scope);
  const cfg = catalog?.data.config.progression ?? await loadProgressionConfig(db);
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      const seen = await stored();
      if (seen) return seen;
    }
    const g = await getGear(db, playerId, id, catalog);
    const built = await build(g, cfg, catalog);
    const statements = built.statements;
    const response = { ...built.response, ...(scope?.releaseId ? { releaseId: scope.releaseId } : {}), ...(catalog ? { catalogSha256: catalog.sha256 } : {}) };
    const batch = [
      ...admission(db, playerId, scope),
      // optimistic concurrency on the instance: version must still match, or somebody changed it meanwhile
      db.prepare('UPDATE player_gear SET version = version + 1 WHERE id = ?1 AND player_id = ?2 AND version = ?3').bind(id, playerId, g.version),
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
      ...statements,
      ...(kind === 'gear_level' ? await taskEventStatements(db, playerId, { level_ups: 1 }, Date.now(), catalog?.data.config.tasks, catalog) : []),
      db.prepare('INSERT INTO progression_requests (player_id, request_id, kind, result_json, input_json) VALUES (?1, ?2, ?3, ?4, ?5)').bind(playerId, requestId, `${kind}:${id}`, JSON.stringify(response), inputJson),
      db.prepare('DELETE FROM tx_guard')
    ];
    try {
      await db.batch(batch);
      return { ...response, balance: await balanceOf(db, playerId, 'eclipse_token'), replayed: false };
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      if (/CHECK constraint failed: ok = 1/i.test(msg)) {
        const prior = await stored(); if (prior) return prior;
        if (scope?.releaseId) await requireEconomic(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', new Date());
        continue;
      }
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

const admission = (db: D1Database, playerId: string, scope?: ReleaseScope): D1PreparedStatement[] => scope?.releaseId
  ? [economicStatement(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', new Date(), undefined, true)] : [];

/** Assignment/lock remain repeatable state setters, without inventing durable economic requests. */
async function setGear(db: D1Database, playerId: string, id: number, scope: ReleaseScope | undefined, build: (g: GearRow, catalog?: RuntimeCatalog) => Promise<D1PreparedStatement[]>, response: Record<string, unknown>, allowUnavailable = false): Promise<Record<string, unknown>> {
  const catalog = await operationCatalog(db, playerId, scope);
  for (let attempt = 0; attempt < 3; attempt++) {
    const g = allowUnavailable ? await db.prepare('SELECT id, gear_id, slot, version FROM player_gear WHERE id = ?1 AND player_id = ?2').bind(id, playerId).first<GearRow>() : await getGear(db, playerId, id, catalog);
    if (!g) throw new HttpError(404, 'no_such_gear', 'you do not have this item');
    const statements = await build(g, catalog);
    try {
      await db.batch([...admission(db, playerId, scope),
        db.prepare('UPDATE player_gear SET version = version + 1 WHERE id = ?1 AND player_id = ?2 AND version = ?3').bind(id, playerId, g.version),
        db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
        ...statements, db.prepare('DELETE FROM tx_guard')]);
      return { id, slot: g.slot, ...response, ...(scope?.releaseId ? { releaseId: scope.releaseId } : {}), ...(catalog ? { catalogSha256: catalog.sha256 } : {}) };
    } catch (error) {
      if (!/CHECK constraint failed: ok = 1|UNIQUE constraint failed: player_gear/i.test(String(error))) throw error;
      if (scope?.releaseId) await requireEconomic(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', new Date());
    }
  }
  throw new HttpError(409, 'busy', 'too many simultaneous changes, try again');
}

export function equipGear(db: D1Database, playerId: string, id: number, characterId: string, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  return setGear(db, playerId, id, scope, async (g, catalog) => {
    const owned = await db.prepare("SELECT 1 FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND item_id = ?2").bind(playerId, characterId).first();
    if (!owned) throw new HttpError(404, 'not_owned', 'you do not own this character');
    const ch = catalog ? catalogCharacter(catalog, characterId) : await db.prepare('SELECT weapon_type FROM characters WHERE id = ?1').bind(characterId).first<{ weapon_type: string | null }>();
    if (!ch) throw new HttpError(404, 'not_owned', 'you do not own this character');
    if (g.slot === 'weapon' && g.owner_character_id !== characterId && g.family !== ch.weapon_type) throw new HttpError(422, 'wrong_weapon_type', 'this character cannot use that weapon type');
    if (g.slot === 'weapon' && g.owner_character_id && g.owner_character_id !== characterId) throw new HttpError(422, 'signature_locked', 'a signature weapon belongs to its character');
    requireSupportedGearPassive(g.extra_json);
    return [
      ...(catalog ? [identityStatement(db, 'character', characterId)] : []),
      db.prepare('UPDATE player_gear SET equipped_by = NULL, version = version + 1 WHERE player_id = ?1 AND equipped_by = ?2 AND slot = ?3 AND id <> ?4').bind(playerId, characterId, g.slot, id),
      db.prepare('UPDATE player_gear SET equipped_by = ?3 WHERE id = ?1 AND player_id = ?2').bind(id, playerId, characterId)
    ];
  }, { equippedBy: characterId });
}

export function unequipGear(db: D1Database, playerId: string, id: number, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  return setGear(db, playerId, id, scope, async () => [db.prepare('UPDATE player_gear SET equipped_by = NULL WHERE id = ?1 AND player_id = ?2').bind(id, playerId)], { equippedBy: null }, true);
}

export function lockGear(db: D1Database, playerId: string, id: number, locked: boolean, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  return setGear(db, playerId, id, scope, async () => [db.prepare('UPDATE player_gear SET locked = ?3 WHERE id = ?1 AND player_id = ?2').bind(id, playerId, locked ? 1 : 0)], { locked }, true);
}

/** Spend tempering XP on a weapon or armor. No waste: only what is needed up to the current cap is consumed. */
export function levelGear(db: D1Database, playerId: string, id: number, input: z.infer<typeof GearLevelBody>, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  return gearOp(db, playerId, id, input, 'gear_level', async (g, cfg) => {
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
  }, scope);
}

/** Rivet milestone: unlocks the next five levels and the milestone bonus. */
export function ascendGear(db: D1Database, playerId: string, id: number, input: z.infer<typeof GearRequest>, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  return gearOp(db, playerId, id, input, 'gear_ascend', async (g, cfg) => {
    const next = cfg.equipment.milestones[g.ascension];
    if (!next) throw new HttpError(409, 'max_ascension', 'no further milestones');
    if (g.level < Math.min(g.level_cap, gearLevelCap(cfg, g.ascension))) throw new HttpError(409, 'not_at_cap', `reach level ${gearLevelCap(cfg, g.ascension)} first`);
    return {
      statements: [db.prepare('UPDATE player_gear SET ascension = ascension + 1 WHERE id = ?1 AND player_id = ?2').bind(id, playerId), stackSpend(db, playerId, cfg.equipment.milestoneItemId, next.rivets)],
      response: { id, ascension: g.ascension + 1, newCap: gearLevelCap(cfg, g.ascension + 1), spentRivets: next.rivets }
    };
  }, scope);
}

/** Destroys an unequipped, unlocked, dismantle-able piece for tempering XP and crafting materials. */
export function dismantleGear(db: D1Database, playerId: string, id: number, input: z.infer<typeof GearRequest>, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  return gearOp(db, playerId, id, input, 'gear_dismantle', async (g, cfg, catalog) => {
    if (!g.dismantle_allowed) throw new HttpError(422, 'not_dismantlable', 'this item cannot be dismantled');
    if (g.equipped_by) throw new HttpError(409, 'equipped', 'unequip it first');
    if (g.locked) throw new HttpError(409, 'locked', 'unlock it first');
    const out = JSON.parse(g.dismantle_json) as { item_id: string; quantity: number }[];
    const caps = new Map((catalog ? catalog.data.items.filter((item) => item.status !== 'retired') : (await db.prepare('SELECT item_id, stack_cap FROM item_defs').all<{ item_id: string; stack_cap: number }>()).results).map((r) => [r.item_id, r.stack_cap]));
    const gains = [...(g.dismantle_xp > 0 ? [{ item_id: cfg.equipment.xpItemId, quantity: g.dismantle_xp }] : []), ...out];
    return {
      // version bump above makes the delete race-safe; the delete itself requires the piece to still be free
      statements: [
        ...(catalog ? gains.map((x) => identityStatement(db, 'item', x.item_id)) : []),
        ...gains.map((x) => stackAdd(db, playerId, x.item_id, x.quantity, caps.get(x.item_id) ?? 9999)),
        db.prepare('DELETE FROM player_gear WHERE id = ?1 AND player_id = ?2 AND equipped_by IS NULL AND locked = 0').bind(id, playerId)
      ],
      response: { id, gained: gains.map((x) => ({ itemId: x.item_id, quantity: x.quantity })) }
    };
  }, scope);
}

/** 4-star and 5-star accessories can re-roll their sub stats with Cinders of the Unwritten Hour; main stat, set, slot and rarity stay. */
export function rerollGear(db: D1Database, playerId: string, id: number, input: z.infer<typeof GearRequest>, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  return gearOp(db, playerId, id, input, 'gear_reroll', async (g, _cfg, catalog) => {
    if (g.slot !== 'necklace' && g.slot !== 'ring') throw new HttpError(422, 'not_accessory', 'only accessories can be re-rolled');
    const gcfg = catalog ? undefined : (await db.prepare("SELECT value_json FROM game_config WHERE key = 'gear'").first<{ value_json: string }>());
    const rc: { itemId: string; quantityByRarity: Record<string, number | undefined> } | undefined = catalog?.data.config.gear.rerollCost ?? (JSON.parse(gcfg?.value_json ?? '{}') as { rerollCost?: { itemId: string; quantityByRarity: Record<string, number> } }).rerollCost;
    const qty = rc?.quantityByRarity[String(g.rarity)];
    if (!rc || !qty) throw new HttpError(422, 'not_rerollable', `${g.rarity}-star accessories cannot be re-rolled`);
    const rolled = rerollAccessory(JSON.parse(g.extra_json) as AccessoryDef, JSON.parse(g.stats_json) as AccessoryStats, cryptoRoll);
    return {
      statements: [db.prepare('UPDATE player_gear SET stats_json = ?3 WHERE id = ?1 AND player_id = ?2').bind(id, playerId, JSON.stringify(rolled)), stackSpend(db, playerId, rc.itemId, qty)],
      response: { id, stats: rolled, spent: { itemId: rc.itemId, quantity: qty } }
    };
  }, scope);
}

/** Final combat stats of an owned character: level growth + equipped gear + set bonuses. This is what a server-verified party will use. */
export async function computeCharacterStats(db: D1Database, playerId: string, characterId: string, cfg?: ProgressionConfig, catalog?: RuntimeCatalog): Promise<{ characterId: string; level: number; stats: CombatStats; attributes?: AttributeValues; power?: 'str' | 'int'; other: Record<string, number>; equipped: { id: number; slot: string; name: string }[]; unsupportedPassives: string[] }> {
  cfg = catalog?.data.config.progression ?? cfg ?? await loadProgressionConfig(db);
  const definition = catalog ? catalogCharacter(catalog, characterId) : undefined;
  if (catalog && !await db.prepare("SELECT 1 FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND item_id = ?2").bind(playerId, characterId).first()) throw new HttpError(404, 'not_owned', 'you do not own this character');
  const row = definition ? characterDefinition(definition) : await db
    .prepare(`SELECT ${CHARACTER_STAT_COLUMNS.split(', ').map((c) => `c.${c}`).join(', ')}, c.role FROM player_items i JOIN characters c ON c.id = i.item_id WHERE i.player_id = ?1 AND i.item_type = 'character' AND i.item_id = ?2`)
    .bind(playerId, characterId)
    .first<CharacterStatRow & { role: string }>();
  if (!row) throw new HttpError(404, 'not_owned', 'you do not own this character');
  const ch = 'stats' in row ? row : { role: row.role, stats: { attributes: rowAttributes(row) } as CharacterStatSource };
  const st = await db.prepare('SELECT level FROM player_chars WHERE player_id = ?1 AND character_id = ?2').bind(playerId, characterId).first<{ level: number }>();
  const level = st?.level ?? 1;
  const results = catalog
    ? (await db.prepare('SELECT id, gear_id, slot, level, xp, ascension, equipped_by, stats_json, locked, version FROM player_gear WHERE player_id = ?1 AND equipped_by = ?2').bind(playerId, characterId).all<GearRow>()).results.map((instance) => {
      const definition = catalogGear(catalog, instance.gear_id);
      if (instance.slot !== definition.slot) throw new HttpError(503, 'invalid_gear_instance', 'equipped item slot differs from its release definition');
      return { ...instance, ...gearDefinition(definition) };
    })
    : (await db.prepare(`${JOIN} WHERE g.player_id = ?1 AND g.equipped_by = ?2`).bind(playerId, characterId).all<GearRow>()).results;
  const gcfg = catalog?.data.config.gear ?? JSON.parse((await db.prepare("SELECT value_json FROM game_config WHERE key = 'gear'").first<{ value_json: string }>())?.value_json ?? '{}') as { roleStat?: Record<string, string> };
  const roles = gcfg.roleStat ?? {};
  const roleKey = Object.keys(roles).find((k) => k !== 'default' && ch.role.includes(k));
  const roleStat = catalog ? catalogRoleStat(catalog, ch.role) : (roleKey ? roles[roleKey] : roles.default) ?? 'atk_pct';
  const setRows = catalog ? catalog.data.sets.map((row) => ({ set_id: row.set_id, pieces_for_bonus: row.pieces_for_bonus, bonus_json: JSON.stringify(row.bonus) })) : (await db.prepare('SELECT set_id, pieces_for_bonus, bonus_json FROM accessory_sets').all<{ set_id: string; pieces_for_bonus: number; bonus_json: string }>()).results;
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
  const resRow = await db
    .prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = 'shard:resonance' AND task_id = ?2")
    .bind(playerId, characterId)
    .first<{ progress: number }>();
  const resonanceTier = Math.max(0, Math.min(6, resRow?.progress ?? 0));
  // D-27: resonance tiers are whole attribute points; legacy catalogs keep the +1% per tier multiplier
  const { attributes, ...baseStats } = statsFor(ch.stats, level, gear, resonancePoints(resonanceTier));
  const stats: CombatStats =
    resonanceTier > 0 && !attributes
      ? {
          hp: Math.ceil(baseStats.hp * (1 + resonanceTier * 0.01)),
          atk: Math.ceil(baseStats.atk * (1 + resonanceTier * 0.01)),
          def: Math.ceil(baseStats.def * (1 + resonanceTier * 0.01)),
          spd: baseStats.spd
        }
      : baseStats;
  return {
    characterId,
    level,
    stats,
    ...(attributes ? { attributes, power: ch.stats.attributes!.power } : {}),
    ...(resonanceTier > 0 ? { resonanceTier } : {}),
    other: gear.other,
    equipped: results.map((g) => ({ id: g.id, slot: g.slot, name: g.name_en })),
    unsupportedPassives: results.filter((g) => gearPassive(g.extra_json)).map((g) => g.gear_id)
  };
}

export async function characterStats(db: D1Database, playerId: string, characterId: string, catalog?: RuntimeCatalog): Promise<Record<string, unknown>> {
  return computeCharacterStats(db, playerId, characterId, undefined, catalog);
}
