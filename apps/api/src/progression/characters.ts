import { canonicalJson } from '@uomd/shared';
import { z } from 'zod';
import { accountLevelFromXp, applyCharacterXp, characterLevelCap, characterXpToNext, feeForLevels, ProgressionConfig, xpToReach, type CharState } from '@uomd/economy';
import { HttpError } from '../content/store';
import { grantStatements, stackSpend } from '../db/grants';
import { balanceOf, ledgerStatements } from '../db/ledger';
import { operationStatement, recordedOperation } from '../db/operations';
import { taskEventStatements } from '../tasks/service';
import { catalogCharacter, operationCatalog, type RuntimeCatalog, type ReleaseScope } from '../content/runtime-catalog';
import { identityStatement } from '../db/identities';
import { economicStatement, requireEconomic } from '../content/authority';

export const SHARD_MAX_TIER = 6;
export const SHARD_BONUS_PCT_PER_TIER = 1;
export const EXCESS_SHARD_ITEM = 'torn_chronicle_page';
export const SHARD_COSTS_BY_RARITY: Record<number, readonly number[]> = {
  3: [2, 2, 4, 4, 6, 6],
  4: [5, 5, 10, 10, 15, 15],
  5: [10, 10, 20, 20, 30, 30]
};

export function shardResonanceInfo(rarity: number, tier: number, shards: number): {
  tier: number;
  maxTier: number;
  nextShardCost: number | null;
  bonusPct: number;
  excessShards: number;
  excessItemId: string;
} {
  const costs = SHARD_COSTS_BY_RARITY[rarity] ?? SHARD_COSTS_BY_RARITY[4]!;
  const clampedTier = Math.max(0, Math.min(SHARD_MAX_TIER, tier));
  const nextShardCost = clampedTier < SHARD_MAX_TIER ? (costs[clampedTier] ?? null) : null;
  const remainingNeeded = costs.slice(clampedTier).reduce((sum, c) => sum + c, 0);
  const excessShards = Math.max(0, shards - remainingNeeded);
  return {
    tier: clampedTier,
    maxTier: SHARD_MAX_TIER,
    nextShardCost,
    bonusPct: clampedTier * SHARD_BONUS_PCT_PER_TIER,
    excessShards,
    excessItemId: EXCESS_SHARD_ITEM
  };
}

export async function loadProgressionConfig(db: D1Database): Promise<ProgressionConfig> {
  const row = await db.prepare("SELECT value_json FROM game_config WHERE key = 'progression'").first<{ value_json: string }>();
  if (!row) throw new HttpError(503, 'config_missing', 'progression rules are not configured');
  try { return ProgressionConfig.parse(JSON.parse(row.value_json)); }
  catch { throw new HttpError(503, 'invalid_progression_config', 'progression rules need operator review'); }
}

export async function accountOf(db: D1Database, playerId: string, cfg: ProgressionConfig): Promise<{ xp: number; level: number; into: number; toNext: number | null }> {
  const r = await db.prepare('SELECT xp FROM player_account WHERE player_id = ?1').bind(playerId).first<{ xp: number }>();
  const xp = r?.xp ?? 0;
  return { xp, ...accountLevelFromXp(cfg, xp) };
}

interface CharRow {
  level: number;
  xp: number;
  ascension: number;
  skill_ranks: string;
  version: number;
}
const DEFAULT_ROW: CharRow = { level: 1, xp: 0, ascension: 0, skill_ranks: '{}', version: 0 };

async function ownsCharacter(db: D1Database, playerId: string, characterId: string): Promise<void> {
  const r = await db.prepare("SELECT 1 AS ok FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND item_id = ?2").bind(playerId, characterId).first();
  if (!r) throw new HttpError(404, 'not_owned', 'you do not own this character');
}

export interface SkillView {
  skillId: string;
  type: string;
  name: string;
  rank: number;
  maxRank: number;
  next: { rank: number; unlockLevel: number; itemId: string; quantity: number; fee: number } | null;
}
export interface CharacterView {
  id: string;
  level: number;
  xp: number;
  xpToNext: number | null;
  ascension: number;
  cap: number;
  copies: number;
  shards: number;
  resonance: ReturnType<typeof shardResonanceInfo>;
  nextAscension: { cap: number; accountLevel: number; items: { itemId: string; quantity: number }[]; fee: number; requiresNode?: string } | null;
  skills: SkillView[];
}

function skillViews(cfg: ProgressionConfig, level: number, ranks: Record<string, number>, skills: { skill_id: string; type: string; name_en: string }[]): SkillView[] {
  const sk = cfg.character.skills;
  return skills.map((s) => {
    const type = s.type as 'basic' | 'active' | 'passive' | 'ultimate';
    const rank = ranks[s.skill_id] ?? 1;
    const max = sk.maxRank[type];
    const idx = rank - 1; // index into the per-rank arrays: rank 2 uses [0]
    const unlock = sk.rankUnlockLevels[idx];
    const qty = sk.quantityPerRank[idx];
    return { skillId: s.skill_id, type, name: s.name_en, rank, maxRank: max, next: rank < max && unlock !== undefined && qty !== undefined ? { rank: rank + 1, unlockLevel: unlock, itemId: sk.itemBySkillType[type], quantity: qty, fee: sk.feePerRank[idx] ?? 0 } : null };
  });
}

export async function listCharacters(db: D1Database, playerId: string, catalog?: RuntimeCatalog): Promise<{ account: Awaited<ReturnType<typeof accountOf>>; characters: CharacterView[]; unavailable: { id: string; reason: string }[] }> {
  const cfg = catalog?.data.config.progression ?? await loadProgressionConfig(db);
  const account = await accountOf(db, playerId, cfg);
  const ownedRows = (await db.prepare("SELECT item_id, copies, shards FROM player_items WHERE player_id = ?1 AND item_type = 'character' ORDER BY item_id").bind(playerId).all<{ item_id: string; copies: number; shards: number }>()).results;
  const owned = ownedRows.map((r) => r.item_id);
  const itemByChar = new Map(ownedRows.map((r) => [r.item_id, r]));
  const rows = new Map((await db.prepare('SELECT character_id, level, xp, ascension, skill_ranks, version FROM player_chars WHERE player_id = ?1').bind(playerId).all<CharRow & { character_id: string }>()).results.map((r) => [r.character_id, r]));
  const resonanceRows = new Map(
    (await db.prepare("SELECT task_id, progress FROM player_tasks WHERE player_id = ?1 AND period_key = 'shard:resonance'").bind(playerId).all<{ task_id: string; progress: number }>()).results.map((r) => [r.task_id, r.progress])
  );
  const rarityByChar = catalog
    ? new Map(catalog.data.characters.map((c) => [c.id, c.rarity]))
    : new Map((await db.prepare('SELECT id, rarity FROM characters').all<{ id: string; rarity: number }>()).results.map((c) => [c.id, c.rarity]));
  const skills = catalog ? catalog.data.skills : (await db.prepare('SELECT skill_id, character_id, type, name_en FROM character_skills ORDER BY skill_id').all<{ skill_id: string; character_id: string; type: string; name_en: string }>()).results;
  const characters = owned.filter((id) => !catalog || catalog.data.characters.some((c) => c.id === id && c.status !== 'retired')).map((id): CharacterView => {
    const r = rows.get(id) ?? DEFAULT_ROW;
    const item = itemByChar.get(id) ?? { copies: 1, shards: 0 };
    const rarity = rarityByChar.get(id) ?? 4;
    const resTier = resonanceRows.get(id) ?? 0;
    const cap = characterLevelCap(cfg, r.ascension, account.level);
    const step = cfg.character.ascension[r.ascension + 1];
    return {
      id,
      level: r.level,
      xp: r.xp,
      xpToNext: r.level >= cfg.character.levelCap ? null : characterXpToNext(cfg, r.level),
      ascension: r.ascension,
      cap,
      copies: item.copies,
      shards: item.shards,
      resonance: shardResonanceInfo(rarity, resTier, item.shards),
      nextAscension: step ? { cap: step.cap, accountLevel: step.accountLevel, items: step.items, fee: step.fee, ...(step.requiresNode ? { requiresNode: step.requiresNode } : {}) } : null,
      skills: skillViews(cfg, r.level, JSON.parse(r.skill_ranks) as Record<string, number>, skills.filter((s) => s.character_id === id))
    };
  });
  return { account, characters, unavailable: catalog ? owned.filter((id) => !characters.some((c) => c.id === id)).map((id) => ({ id, reason: 'Unavailable in this content version' })) : [] };
}

interface Plan {
  state: CharState & { skillRanks: Record<string, number> };
  items: { itemId: string; quantity: number }[];
  fee: number;
  response: Record<string, unknown>;
}
type Compute = (ctx: { catalog?: RuntimeCatalog; cfg: ProgressionConfig; row: CharRow; state: CharState; ranks: Record<string, number>; accountLevel: number }) => Promise<Plan> | Plan;

/**
 * One atomic, idempotent character upgrade: re-reads the character under optimistic concurrency, lets `compute` decide the new
 * state, then ONE batch applies the state, spends materials and the fee, and records the request. A stale read retries.
 */
async function characterOp(db: D1Database, playerId: string, characterId: string, input: { requestId: string } & Record<string, unknown>, kind: string, compute: Compute, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const { requestId } = input;
  const inputJson = canonicalJson(input);
  const stored = async (): Promise<Record<string, unknown> | null> => {
    const r = await db.prepare('SELECT kind, result_json, input_json FROM progression_requests WHERE player_id = ?1 AND request_id = ?2').bind(playerId, requestId).first<{ kind: string; result_json: string; input_json: string | null }>();
    if (!r) return null;
    if (r.kind !== `${kind}:${characterId}` || r.input_json !== null && r.input_json !== inputJson) throw new HttpError(409, 'request_id_reused', 'this requestId was already used for a different operation');
    return { ...(JSON.parse(r.result_json) as Record<string, unknown>), replayed: true };
  };
  const first = await stored();
  if (first) return first;
  if (input.releaseId !== scope?.releaseId) throw new HttpError(400, 'release_context_mismatch', 'the selected release requires matching operation context');
  await ownsCharacter(db, playerId, characterId);
  const catalog = await operationCatalog(db, playerId, scope);
  if (catalog) catalogCharacter(catalog, characterId);
  const cfg = catalog?.data.config.progression ?? await loadProgressionConfig(db);
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      const seen = await stored();
      if (seen) return seen;
    }
    const existing = await db.prepare('SELECT level, xp, ascension, skill_ranks, version FROM player_chars WHERE player_id = ?1 AND character_id = ?2').bind(playerId, characterId).first<CharRow>();
    const row = existing ?? DEFAULT_ROW;
    const account = await accountOf(db, playerId, cfg);
    const plan = await compute({ catalog, cfg, row, state: { level: row.level, xp: row.xp, ascension: row.ascension }, ranks: JSON.parse(row.skill_ranks) as Record<string, number>, accountLevel: account.level });
    const response = { ...plan.response, ...(scope?.releaseId ? { releaseId: scope.releaseId } : {}), ...(catalog ? { catalogSha256: catalog.sha256 } : {}), character: characterId, level: plan.state.level, xp: plan.state.xp, ascension: plan.state.ascension, spent: { items: plan.items, fee: plan.fee } };
    const batch: D1PreparedStatement[] = [
      ...(scope?.releaseId ? [economicStatement(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', new Date(), undefined, true)] : []),
      ...(catalog ? [identityStatement(db, 'character', characterId), ...plan.items.map((item) => identityStatement(db, 'item', item.itemId))] : []),
      db.prepare('INSERT OR IGNORE INTO player_chars (player_id, character_id) VALUES (?1, ?2)').bind(playerId, characterId),
      db
        .prepare('UPDATE player_chars SET level = ?3, xp = ?4, ascension = ?5, skill_ranks = ?6, version = version + 1 WHERE player_id = ?1 AND character_id = ?2 AND version = ?7')
        .bind(playerId, characterId, plan.state.level, plan.state.xp, plan.state.ascension, JSON.stringify(plan.state.skillRanks), row.version),
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
      ...plan.items.map((i) => stackSpend(db, playerId, i.itemId, i.quantity)),
      ...(plan.fee > 0 ? ledgerStatements(db, { playerId, currency: 'eclipse_token', delta: -plan.fee, reason: `${kind}:${characterId}`, idempotencyKey: `prog:${playerId}:${requestId}` }) : []),
      ...(kind === 'level_up' ? await taskEventStatements(db, playerId, { level_ups: 1 }, Date.now(), catalog?.data.config.tasks, catalog) : []),
      db.prepare('INSERT INTO progression_requests (player_id, request_id, kind, result_json, input_json) VALUES (?1, ?2, ?3, ?4, ?5)').bind(playerId, requestId, `${kind}:${characterId}`, JSON.stringify(response), inputJson),
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
  throw new HttpError(409, 'busy', 'too many simultaneous upgrades on this character, try again');
}

const ItemsInput = z.array(z.object({ itemId: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/), quantity: z.number().int().min(1).max(9999) }).strict()).min(1).max(5);
const ReleaseId = z.string().regex(/^[a-z][a-z0-9_]{1,47}$/).optional();
export const LevelUpBody = z.object({ releaseId: ReleaseId, requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/), items: ItemsInput }).strict();
export const RequestOnly = z.object({ releaseId: ReleaseId, requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/) }).strict();

export function levelUpCharacter(db: D1Database, playerId: string, characterId: string, input: z.infer<typeof LevelUpBody>, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  return characterOp(db, playerId, characterId, input, 'level_up', async ({ catalog, cfg, state, ranks, accountLevel }) => {
    const merged = new Map<string, number>();
    for (const i of input.items) merged.set(i.itemId, (merged.get(i.itemId) ?? 0) + i.quantity);
    const defs = catalog ? catalog.data.items.filter((item) => merged.has(item.item_id) && item.status !== 'retired') : (await db.prepare(`SELECT item_id, xp_value, kind FROM item_defs WHERE item_id IN (${[...merged.keys()].map(() => '?').join(',')})`).bind(...merged.keys()).all<{ item_id: string; xp_value: number | null; kind: string }>()).results;
    let gained = 0;
    let smallest = Infinity;
    for (const [id, qty] of merged) {
      const d = defs.find((x) => x.item_id === id);
      if (!d || d.kind !== 'character_xp' || !d.xp_value) throw new HttpError(422, 'not_xp_item', `${id} cannot be used to level a character`);
      gained += d.xp_value * qty;
      smallest = Math.min(smallest, d.xp_value);
    }
    const cap = characterLevelCap(cfg, state.ascension, accountLevel);
    if (state.level >= cap) {
      const ascCap = characterLevelCap(cfg, state.ascension, 10_000);
      const why = state.level >= ascCap ? (state.ascension < cfg.character.ascension.length - 1 ? 'ascension' : 'max') : 'account_level';
      throw new HttpError(409, 'at_cap', `this character cannot level further (${why === 'account_level' ? `limited by account level ${accountLevel}` : why === 'ascension' ? 'ascend first' : 'maximum level'})`, { cap, reason: why });
    }
    const need = xpToReach(cfg, state, cap);
    if (gained - need >= smallest) throw new HttpError(422, 'xp_overflow', 'that would waste whole items: use fewer', { neededXp: need, offeredXp: gained });
    const r = applyCharacterXp(cfg, state, gained, cap);
    return {
      state: { ...r.state, skillRanks: ranks },
      items: [...merged].map(([itemId, quantity]) => ({ itemId, quantity })),
      fee: feeForLevels(cfg, r.feeLevels),
      response: { gainedXp: gained, levelsGained: r.levelsGained, wastedXp: r.wasted, cap }
    };
  }, scope);
}

export function ascendCharacter(db: D1Database, playerId: string, characterId: string, input: z.infer<typeof RequestOnly>, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  return characterOp(db, playerId, characterId, input, 'ascend', async ({ cfg, state, ranks, accountLevel }) => {
    const step = cfg.character.ascension[state.ascension + 1];
    if (!step) throw new HttpError(409, 'max_ascension', 'this character is fully ascended');
    const atCap = state.level >= characterLevelCap(cfg, state.ascension, 10_000);
    if (!atCap) throw new HttpError(409, 'not_at_cap', `reach level ${characterLevelCap(cfg, state.ascension, 10_000)} first`);
    if (accountLevel < step.accountLevel) throw new HttpError(409, 'account_level_too_low', `needs account level ${step.accountLevel}`, { required: step.accountLevel, have: accountLevel });
    if (step.requiresNode) {
      const cleared = await db.prepare('SELECT stars FROM player_progress WHERE player_id = ?1 AND node_id = ?2').bind(playerId, step.requiresNode).first<{ stars: number }>();
      if (!cleared || cleared.stars < 1) throw new HttpError(409, 'story_gate', `clear ${step.requiresNode} first`);
    }
    return { state: { ...state, ascension: state.ascension + 1, skillRanks: ranks }, items: step.items, fee: Math.ceil(step.fee), response: { newCap: step.cap } };
  }, scope);
}

export function upgradeSkill(db: D1Database, playerId: string, characterId: string, skillId: string, input: z.infer<typeof RequestOnly>, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  return characterOp(db, playerId, characterId, input, `skill:${skillId}`, async ({ catalog, cfg, state, ranks }) => {
    const skill = catalog ? catalog.data.skills.find((s) => s.skill_id === skillId && s.character_id === characterId) : await db.prepare('SELECT skill_id, type FROM character_skills WHERE skill_id = ?1 AND character_id = ?2').bind(skillId, characterId).first<{ skill_id: string; type: 'basic' | 'active' | 'passive' | 'ultimate' }>();
    if (!skill) throw new HttpError(404, 'no_such_skill', 'this character has no such skill');
    const sk = cfg.character.skills;
    const rank = ranks[skillId] ?? 1;
    if (rank >= sk.maxRank[skill.type]) throw new HttpError(409, 'max_rank', 'this skill is at its highest rank');
    const unlock = sk.rankUnlockLevels[rank - 1];
    const qty = sk.quantityPerRank[rank - 1];
    if (unlock === undefined || qty === undefined) throw new HttpError(409, 'max_rank', 'this skill is at its highest rank');
    if (state.level < unlock) throw new HttpError(409, 'level_too_low', `rank ${rank + 1} unlocks at character level ${unlock}`, { required: unlock });
    return { state: { ...state, skillRanks: { ...ranks, [skillId]: rank + 1 } }, items: [{ itemId: sk.itemBySkillType[skill.type], quantity: qty }], fee: Math.ceil(sk.feePerRank[rank - 1] ?? 0), response: { skillId, rank: rank + 1 } };
  }, scope);
}

export const ShardConvertBody = RequestOnly.extend({
  shards: z.number().int().min(1).max(9999).optional()
}).strict();

/**
 * R12 Memory Shards: nonmandatory character-bound keepsake resonance sink.
 * Never gates story chapters, skills, or ascension caps, and costs zero main currency.
 */
export async function attuneCharacterShards(db: D1Database, playerId: string, characterId: string, input: z.infer<typeof RequestOnly>, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const kind = `shard_attune:${characterId}`;
  const first = await recordedOperation(db, playerId, kind, input);
  if (first) return first;
  if (input.releaseId !== scope?.releaseId) throw new HttpError(400, 'release_context_mismatch', 'the selected release requires matching operation context');
  await ownsCharacter(db, playerId, characterId);
  const catalog = await operationCatalog(db, playerId, scope);
  const rarity = catalog
    ? catalogCharacter(catalog, characterId).rarity
    : ((await db.prepare('SELECT rarity FROM characters WHERE id = ?1').bind(characterId).first<{ rarity: number }>())?.rarity ?? 4);
  const costs = SHARD_COSTS_BY_RARITY[rarity] ?? SHARD_COSTS_BY_RARITY[4]!;

  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      const seen = await recordedOperation(db, playerId, kind, input);
      if (seen) return seen;
    }
    const item = await db
      .prepare("SELECT shards FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND item_id = ?2")
      .bind(playerId, characterId)
      .first<{ shards: number }>();
    if (!item) throw new HttpError(404, 'not_owned', 'you do not own this character');
    const resRow = await db
      .prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = 'shard:resonance' AND task_id = ?2")
      .bind(playerId, characterId)
      .first<{ progress: number }>();
    const currentTier = resRow?.progress ?? 0;
    if (currentTier >= SHARD_MAX_TIER) {
      throw new HttpError(409, 'max_resonance', 'this character has already reached maximum Memory Resonance');
    }
    const cost = costs[currentTier] ?? 10;
    if (item.shards < cost) {
      throw new HttpError(402, 'insufficient_shards', `needs ${cost} character Memory Shards (have ${item.shards})`, { required: cost, have: item.shards });
    }
    const nextTier = currentTier + 1;
    const remainingShards = item.shards - cost;
    const resonance = shardResonanceInfo(rarity, nextTier, remainingShards);
    const result = {
      ...(scope?.releaseId ? { releaseId: scope.releaseId } : {}),
      ...(catalog ? { catalogSha256: catalog.sha256 } : {}),
      character: characterId,
      spentShards: cost,
      shardsRemaining: remainingShards,
      resonance
    };

    const batch: D1PreparedStatement[] = [
      ...(scope?.releaseId ? [economicStatement(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', new Date(), undefined, true)] : []),
      ...(catalog ? [identityStatement(db, 'character', characterId)] : []),
      db
        .prepare("UPDATE player_items SET shards = shards - ?3 WHERE player_id = ?1 AND item_type = 'character' AND item_id = ?2 AND shards = ?4 AND shards >= ?3")
        .bind(playerId, characterId, cost, item.shards),
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
      ...(resRow
        ? [
            db
              .prepare("UPDATE player_tasks SET progress = ?3 WHERE player_id = ?1 AND period_key = 'shard:resonance' AND task_id = ?2 AND progress = ?4")
              .bind(playerId, characterId, nextTier, currentTier),
            db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)')
          ]
        : [
            db
              .prepare("INSERT INTO player_tasks (player_id, period_key, task_id, progress, target) VALUES (?1, 'shard:resonance', ?2, ?3, ?4)")
              .bind(playerId, characterId, nextTier, SHARD_MAX_TIER)
          ]),
      operationStatement(db, playerId, kind, input, result),
      db.prepare('DELETE FROM tx_guard')
    ];

    try {
      await db.batch(batch);
      return { ...result, replayed: false };
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      if (/CHECK constraint failed: ok = 1|UNIQUE constraint failed: (player_tasks|progression_requests)/i.test(msg)) {
        const prior = await recordedOperation(db, playerId, kind, input);
        if (prior) return prior;
        if (scope?.releaseId) await requireEconomic(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', new Date());
        continue;
      }
      throw e;
    }
  }
  throw new HttpError(409, 'busy', 'too many simultaneous shard operations on this character, try again');
}

/**
 * R12 Excess Memory Shards: converts surplus character-bound shards (beyond what is needed for max resonance)
 * into general character XP materials (`torn_chronicle_page`), never into the main currency (`eclipse_token`).
 */
export async function convertExcessShards(db: D1Database, playerId: string, characterId: string, input: z.infer<typeof ShardConvertBody>, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const kind = `shard_convert:${characterId}`;
  const first = await recordedOperation(db, playerId, kind, input);
  if (first) return first;
  if (input.releaseId !== scope?.releaseId) throw new HttpError(400, 'release_context_mismatch', 'the selected release requires matching operation context');
  await ownsCharacter(db, playerId, characterId);
  const catalog = await operationCatalog(db, playerId, scope);
  const rarity = catalog
    ? catalogCharacter(catalog, characterId).rarity
    : ((await db.prepare('SELECT rarity FROM characters WHERE id = ?1').bind(characterId).first<{ rarity: number }>())?.rarity ?? 4);

  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      const seen = await recordedOperation(db, playerId, kind, input);
      if (seen) return seen;
    }
    const item = await db
      .prepare("SELECT shards FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND item_id = ?2")
      .bind(playerId, characterId)
      .first<{ shards: number }>();
    if (!item) throw new HttpError(404, 'not_owned', 'you do not own this character');
    const resRow = await db
      .prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = 'shard:resonance' AND task_id = ?2")
      .bind(playerId, characterId)
      .first<{ progress: number }>();
    const currentTier = resRow?.progress ?? 0;
    const info = shardResonanceInfo(rarity, currentTier, item.shards);
    const toConvert = input.shards ?? info.excessShards;
    if (toConvert <= 0 || toConvert > info.excessShards) {
      throw new HttpError(409, 'no_excess_shards', 'only shards exceeding remaining resonance tiers can be converted into materials', {
        shards: item.shards,
        excessAvailable: info.excessShards,
        requested: toConvert
      });
    }
    const remainingShards = item.shards - toConvert;
    const gained = [{ type: 'item' as const, itemId: EXCESS_SHARD_ITEM, quantity: toConvert }];
    const result = {
      ...(scope?.releaseId ? { releaseId: scope.releaseId } : {}),
      ...(catalog ? { catalogSha256: catalog.sha256 } : {}),
      character: characterId,
      convertedShards: toConvert,
      shardsRemaining: remainingShards,
      gained,
      resonance: shardResonanceInfo(rarity, currentTier, remainingShards)
    };
    const grantStmts = await grantStatements(db, playerId, gained, {
      keyPrefix: `shard_excess:${playerId}:${input.requestId}`,
      reason: `shard_excess:${characterId}`,
      catalog
    });

    const batch: D1PreparedStatement[] = [
      ...(scope?.releaseId ? [economicStatement(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', new Date(), undefined, true)] : []),
      ...(catalog ? [identityStatement(db, 'character', characterId)] : []),
      db
        .prepare("UPDATE player_items SET shards = shards - ?3 WHERE player_id = ?1 AND item_type = 'character' AND item_id = ?2 AND shards = ?4 AND shards >= ?3")
        .bind(playerId, characterId, toConvert, item.shards),
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
      ...grantStmts,
      operationStatement(db, playerId, kind, input, result),
      db.prepare('DELETE FROM tx_guard')
    ];

    try {
      await db.batch(batch);
      return { ...result, replayed: false };
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      if (/CHECK constraint failed: ok = 1|UNIQUE constraint failed: progression_requests/i.test(msg)) {
        const prior = await recordedOperation(db, playerId, kind, input);
        if (prior) return prior;
        if (scope?.releaseId) await requireEconomic(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', new Date());
        continue;
      }
      throw e;
    }
  }
  throw new HttpError(409, 'busy', 'too many simultaneous shard conversions on this character, try again');
}

