import { z } from 'zod';
import { ChapterIndex, Encounter, RATION_COST, UnitPack, type RewardAttachment } from '@uomd/content-schema';
import { replayBattle } from '@uomd/combat';
import { RATION_CAP, rationNextMs, rationNow, rationSpend, type RationState } from '@uomd/economy';
import { sha256Hex } from '@uomd/shared';
import { ContentStore, HttpError } from '../content/store';
import { grantStatements } from '../db/grants';
import type { GameEnv } from '../env';

export const BattleSubmission = z
  .object({
    releaseId: z.string().regex(/^[a-z][a-z0-9_]{1,47}$/),
    nodeId: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
    requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
    actions: z.array(z.object({ skillId: z.string().max(80), targetId: z.string().max(80).optional() }).strict()).max(600)
  })
  .strict();
export type BattleSubmission = z.infer<typeof BattleSubmission>;

export interface BattleOutcome {
  requestId: string;
  nodeId: string;
  stars: number;
  bestStars: number;
  firstClear: boolean;
  newThreeStar: boolean;
  turns: number;
  rewards: RewardAttachment[];
  ration: { spent: number };
}
export interface BattleResponse extends BattleOutcome {
  ration: { spent: number; value: number; cap: number; nextMs: number };
  replayed: boolean;
}

async function rationRow(db: D1Database, playerId: string, nowMs: number): Promise<{ state: RationState; exists: boolean; stored: RationState }> {
  const row = await db.prepare('SELECT value, at_ms FROM player_ration WHERE player_id = ?1').bind(playerId).first<{ value: number; at_ms: number }>();
  const stored: RationState = row ? { value: row.value, atMs: row.at_ms } : { value: RATION_CAP, atMs: nowMs };
  return { state: rationNow(stored, nowMs), exists: Boolean(row), stored };
}

export async function getProgress(db: D1Database, playerId: string, nowMs = Date.now()): Promise<Record<string, unknown>> {
  const { results } = await db.prepare('SELECT node_id, stars, clears, best_turns FROM player_progress WHERE player_id = ?1 ORDER BY node_id').bind(playerId).all();
  const r = await rationRow(db, playerId, nowMs);
  return { nodes: results, ration: { value: r.state.value, cap: RATION_CAP, nextMs: rationNextMs(r.stored, nowMs) } };
}

/**
 * Accepts a battle result ONLY by re-simulating it on the server (deterministic engine + published content), then in one
 * atomic batch: pays Ration, upserts node progress, grants first-clear / three-star / repeat rewards and records the claim.
 * The client never reports stars, rewards or costs.
 */
export async function submitBattle(env: Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>, playerId: string, input: BattleSubmission, now = new Date()): Promise<BattleResponse> {
  const db = env.DB;
  const nowMs = now.getTime();
  const finish = async (o: BattleOutcome, replayed: boolean): Promise<BattleResponse> => {
    const r = await rationRow(db, playerId, Date.now());
    return { ...o, ration: { spent: o.ration.spent, value: r.state.value, cap: RATION_CAP, nextMs: rationNextMs(r.stored, Date.now()) }, replayed };
  };
  const replay = async (): Promise<BattleResponse | null> => {
    const prior = await db.prepare('SELECT release_id, node_id, result_json FROM battle_claims WHERE player_id = ?1 AND request_id = ?2').bind(playerId, input.requestId).first<{ release_id: string; node_id: string; result_json: string }>();
    if (!prior) return null;
    if (prior.release_id !== input.releaseId || prior.node_id !== input.nodeId) throw new HttpError(409, 'request_id_reused', 'this requestId was already used for a different battle');
    return finish(JSON.parse(prior.result_json) as BattleOutcome, true);
  };
  const first = await replay();
  if (first) return first;

  const store = new ContentStore(db, env.CONTENT);
  const rel = await store.getRelease(input.releaseId);
  if (!rel || rel.state !== 'published' || rel.channel !== env.CONTENT_CHANNEL) throw new HttpError(404, 'unknown_release', 'release is not published on this channel');
  const dec = new TextDecoder();
  const indexBytes = await store.effectiveBytes(input.releaseId, 'chapters/chapter_index.json');
  if (!indexBytes) throw new HttpError(404, 'unknown_node', 'release has no chapter index');
  const index = ChapterIndex.parse(JSON.parse(dec.decode(indexBytes)));
  const node = index.chapters.flatMap((c) => c.nodes).find((n) => n.node_id === input.nodeId);
  if (!node || node.kind !== 'battle' || !node.encounter) throw new HttpError(404, 'unknown_node', 'no such battle node in this release');

  if (node.requires) {
    const req = await db.prepare('SELECT stars FROM player_progress WHERE player_id = ?1 AND node_id = ?2').bind(playerId, node.requires).first<{ stars: number }>();
    if (!req || req.stars < 1) throw new HttpError(403, 'node_locked', `clear ${node.requires} first`);
  }
  const [packBytes, encBytes] = await Promise.all([store.effectiveBytes(input.releaseId, 'units/unit_pack.json'), store.effectiveBytes(input.releaseId, node.encounter)]);
  if (!packBytes || !encBytes) throw new HttpError(404, 'unknown_encounter', 'encounter is not part of that release');
  const out = await replayBattle(UnitPack.parse(JSON.parse(dec.decode(packBytes))), Encounter.parse(JSON.parse(dec.decode(encBytes))), input.actions);
  if (!out.valid || !out.complete || out.result?.winner !== 'player') {
    throw new HttpError(422, 'battle_not_won', out.valid ? (out.complete ? 'the battle was not won' : 'the action list does not finish the battle') : (out.error ?? 'illegal action list'));
  }
  const stars = out.result.stars;
  const turns = out.result.turns;
  const cost = node.ration_class ? RATION_COST[node.ration_class] : 0;
  const rewardsDef = node.rewards ?? { first_clear: [], three_star: [], repeat: [] };

  for (let attempt = 0; attempt < 5; attempt++) {
    const seen = attempt > 0 ? await replay() : null;
    if (seen) return seen;
    const old = await db.prepare('SELECT stars FROM player_progress WHERE player_id = ?1 AND node_id = ?2').bind(playerId, input.nodeId).first<{ stars: number }>();
    const oldStars = old?.stars ?? 0;
    const firstClear = !old;
    const newThreeStar = stars === 3 && oldStars < 3;
    const ration = await rationRow(db, playerId, nowMs);
    const spent = cost > 0 ? rationSpend(ration.stored, cost, nowMs) : null;
    if (cost > 0 && !spent) throw new HttpError(402, 'not_enough_ration', 'not enough Ration for this battle');

    const grants: { a: RewardAttachment; key: string }[] = [];
    if (firstClear) rewardsDef.first_clear.forEach((a, i) => grants.push({ a, key: `stage:${playerId}:${input.nodeId}:first:${i}` }));
    if (newThreeStar) rewardsDef.three_star.forEach((a, i) => grants.push({ a, key: `stage:${playerId}:${input.nodeId}:three:${i}` }));
    rewardsDef.repeat.forEach((a, i) => grants.push({ a, key: `stage:${playerId}:${input.requestId}:repeat:${i}` }));

    const outcome: BattleOutcome = {
      requestId: input.requestId,
      nodeId: input.nodeId,
      stars,
      bestStars: Math.max(stars, oldStars),
      firstClear,
      newThreeStar,
      turns,
      rewards: grants.map((g) => g.a),
      ration: { spent: cost }
    };
    const batch: D1PreparedStatement[] = [];
    if (cost > 0 && spent) {
      batch.push(
        db.prepare('INSERT OR IGNORE INTO player_ration (player_id, value, at_ms) VALUES (?1, ?2, ?3)').bind(playerId, ration.stored.value, ration.stored.atMs),
        db.prepare('UPDATE player_ration SET value = ?4, at_ms = ?5 WHERE player_id = ?1 AND value = ?2 AND at_ms = ?3').bind(playerId, ration.stored.value, ration.stored.atMs, spent.value, spent.atMs),
        db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)')
      );
    }
    batch.push(
      db
        .prepare(
          `INSERT INTO player_progress (player_id, node_id, stars, clears, best_turns, first_cleared_at, updated_at) VALUES (?1, ?2, ?3, 1, ?4, ?5, ?5)
           ON CONFLICT (player_id, node_id) DO UPDATE SET stars = MAX(stars, excluded.stars), clears = clears + 1,
             best_turns = MIN(COALESCE(best_turns, excluded.best_turns), excluded.best_turns), updated_at = excluded.updated_at`
        )
        .bind(playerId, input.nodeId, stars, turns, now.toISOString())
    );
    // one-time rewards keep stable keys (first clear / three stars), repeat rewards are keyed by the request
    for (const g of grants) batch.push(...(await grantStatements(db, playerId, [g.a], { keyPrefix: g.key, reason: `stage:${input.nodeId}` })));
    batch.push(
      db.prepare('INSERT INTO battle_claims (player_id, request_id, release_id, node_id, result_json) VALUES (?1, ?2, ?3, ?4, ?5)').bind(playerId, input.requestId, input.releaseId, input.nodeId, JSON.stringify(outcome)),
      db
        .prepare('INSERT INTO battle_audit (release_id, encounter, valid, complete, winner, stars, turns, log_hash, client_match, caller) VALUES (?1,?2,1,1,?3,?4,?5,?6,1,?7)')
        .bind(input.releaseId, node.encounter, 'player', stars, turns, out.logHash, `player:${(await sha256Hex(playerId)).slice(0, 20)}`),
      db.prepare('DELETE FROM tx_guard')
    );
    try {
      await db.batch(batch);
      return finish(outcome, false);
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      if (/CHECK constraint failed: ok = 1/i.test(msg)) continue; // someone spent Ration meanwhile: recompute
      if (/UNIQUE constraint failed: ledger\.idempotency_key/i.test(msg)) continue; // a parallel request took the one-time reward: recompute
      if (/UNIQUE constraint failed: battle_claims/i.test(msg)) continue; // the same request won meanwhile: the next round returns its stored result
      throw e;
    }
  }
  throw new HttpError(409, 'busy', 'too many simultaneous submissions on this account, try again');
}

const Save = z.object({ expectedVersion: z.number().int().min(0), data: z.record(z.string(), z.unknown()) }).strict();

export async function readSave(db: D1Database, playerId: string): Promise<{ version: number; data: unknown; updatedAt: string | null }> {
  const row = await db.prepare('SELECT version, data, updated_at FROM player_saves WHERE player_id = ?1').bind(playerId).first<{ version: number; data: string; updated_at: string }>();
  return row ? { version: row.version, data: JSON.parse(row.data), updatedAt: row.updated_at } : { version: 0, data: {}, updatedAt: null };
}

/** Compare-and-set write of the client's cloud-save blob. A stale `expectedVersion` gets 409 plus the server copy to merge. */
export async function writeSave(db: D1Database, playerId: string, raw: unknown, now = new Date()): Promise<{ version: number }> {
  const parsed = Save.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, 'bad_request', 'invalid save');
  const text = JSON.stringify(parsed.data.data);
  if (text.length > 65_536) throw new HttpError(413, 'save_too_large', 'cloud save is limited to 64 KB');
  const { expectedVersion } = parsed.data;
  const res =
    expectedVersion === 0
      ? await db.prepare('INSERT INTO player_saves (player_id, version, data, updated_at) VALUES (?1, 1, ?2, ?3) ON CONFLICT (player_id) DO NOTHING').bind(playerId, text, now.toISOString()).run()
      : await db.prepare('UPDATE player_saves SET version = version + 1, data = ?3, updated_at = ?4 WHERE player_id = ?1 AND version = ?2').bind(playerId, expectedVersion, text, now.toISOString()).run();
  if (res.meta.changes !== 1) throw new HttpError(409, 'save_conflict', 'the cloud save changed on another device', await readSave(db, playerId));
  return { version: expectedVersion + 1 };
}
