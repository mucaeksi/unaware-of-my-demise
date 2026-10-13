import { z } from 'zod';
import { BattleParty, ChapterIndex, Encounter, RATION_COST, UnitPack, type RewardAttachment } from '@uomd/content-schema';
import { replayBattle } from '@uomd/combat';
import { RATION_CAP, rationNextMs, rationNow, rationSpend, type RationState } from '@uomd/economy';
import { sha256Hex } from '@uomd/shared';
import { ContentStore, HttpError } from '../content/store';
import { grantStatements } from '../db/grants';
import { taskEventStatements } from '../tasks/service';
import { rollNodeDrops } from './drops';
import { buildParty } from './party';
import type { GameEnv } from '../env';
import { BATTLE_SESSION_TTL_MS, economicStatement, requireEconomic } from '../content/authority';

export const BattleSubmission = z
  .object({
    releaseId: z.string().regex(/^[a-z][a-z0-9_]{1,47}$/),
    nodeId: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
    requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
    /** owned-hero stages: the session returned by /progress/battle/start (the party is frozen in it) */
    sessionId: z.string().regex(/^[a-f0-9]{32}$/).optional(),
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


interface Stage {
  node: ReturnType<typeof ChapterIndex.parse>['chapters'][number]['nodes'][number];
  pack: UnitPack;
  encounter: Encounter;
}

/** The published node, its unit pack and encounter, after the "previous node cleared" gate. */
async function loadStage(env: Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>, playerId: string, releaseId: string, nodeId: string): Promise<Stage> {
  const db = env.DB;
  const store = new ContentStore(db, env.CONTENT);
  const rel = await store.getRelease(releaseId);
  if (!rel || rel.state !== 'published' || rel.channel !== env.CONTENT_CHANNEL) throw new HttpError(404, 'unknown_release', 'release is not published on this channel');
  const dec = new TextDecoder();
  const indexBytes = await store.effectiveBytes(releaseId, 'chapters/chapter_index.json');
  if (!indexBytes) throw new HttpError(404, 'unknown_node', 'release has no chapter index');
  const index = ChapterIndex.parse(JSON.parse(dec.decode(indexBytes)));
  const node = index.chapters.flatMap((c) => c.nodes).find((n) => n.node_id === nodeId);
  if (!node || node.kind !== 'battle' || !node.encounter) throw new HttpError(404, 'unknown_node', 'no such battle node in this release');
  if (node.requires) {
    const req = await db.prepare('SELECT stars FROM player_progress WHERE player_id = ?1 AND node_id = ?2').bind(playerId, node.requires).first<{ stars: number }>();
    if (!req || req.stars < 1) throw new HttpError(403, 'node_locked', `clear ${node.requires} first`);
  }
  const [packBytes, encBytes] = await Promise.all([store.effectiveBytes(releaseId, 'units/unit_pack.json'), store.effectiveBytes(releaseId, node.encounter)]);
  if (!packBytes || !encBytes) throw new HttpError(404, 'unknown_encounter', 'encounter is not part of that release');
  return { node, pack: UnitPack.parse(JSON.parse(dec.decode(packBytes))), encounter: Encounter.parse(JSON.parse(dec.decode(encBytes))) };
}

const MAX_OPEN_SESSIONS = 10;

export interface BattleStart {
  sessionId: string | null;
  /** the exact player side to fight with (owned-hero stages), or null for fixed story encounters */
  party: BattleParty | null;
  expiresAt: string | null;
}

/**
 * Step 1 of an owned-hero battle: freezes the party the server computed from the player's team, gear, ranks and the stage's story loans.
 * The client must fight with exactly this party; the submit step replays against the frozen copy, never against live data.
 */
export async function startBattle(env: Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>, playerId: string, input: { releaseId: string; nodeId: string }, now = new Date()): Promise<BattleStart> {
  const stage = await loadStage(env, playerId, input.releaseId, input.nodeId);
  await requireEconomic(env.DB, env.CONTENT_CHANNEL, input.releaseId, playerId, input.nodeId, now);
  const party = (stage.encounter.party_mode ?? 'fixed') === 'owned' ? await buildParty(env.DB, playerId, stage.encounter, new Set(stage.pack.units.map((u) => u.unit_id))) : null;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = new Date(now.getTime() + BATTLE_SESSION_TTL_MS).toISOString();
  try {
    await env.DB.batch([
      economicStatement(env.DB, env.CONTENT_CHANNEL, input.releaseId, playerId, input.nodeId, now, undefined, true),
      env.DB.prepare('DELETE FROM battle_sessions WHERE player_id = ?1 AND (expires_at < ?2 OR consumed_at IS NOT NULL)').bind(playerId, now.toISOString()),
      // a player can hold a handful of open sessions; the oldest ones make room
      env.DB.prepare(`DELETE FROM battle_sessions WHERE player_id = ?1 AND id IN (SELECT id FROM battle_sessions WHERE player_id = ?1 ORDER BY created_at DESC LIMIT -1 OFFSET ?2)`).bind(playerId, MAX_OPEN_SESSIONS - 1),
      env.DB.prepare('INSERT INTO battle_sessions (id, player_id, release_id, node_id, party_json, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(id, playerId, input.releaseId, input.nodeId, JSON.stringify(party), now.toISOString(), expiresAt),
      env.DB.prepare('DELETE FROM tx_guard')
    ]);
  } catch (e) {
    if (/CHECK constraint failed: ok = 1/i.test(String(e))) throw new HttpError(409, 'release_not_economic', 'release authority changed before the battle started');
    throw e;
  }
  return { sessionId: id, party, expiresAt };
}

/**
 * Accepts a battle result ONLY by re-simulating it on the server (deterministic engine + published content), then in one
 * atomic batch: pays Ration, upserts node progress, grants first-clear / three-star / repeat rewards and records the claim.
 * The client never reports stars, rewards or costs.
 */
export async function submitBattle(env: Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>, playerId: string, input: BattleSubmission, now = new Date()): Promise<BattleResponse> {
  const db = env.DB;
  const nowMs = now.getTime();
  const wallStarted = Date.now();
  const currentTime = (): Date => new Date(nowMs + Math.max(0, Date.now() - wallStarted));
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

  const stage = await loadStage(env, playerId, input.releaseId, input.nodeId);
  await requireEconomic(db, env.CONTENT_CHANNEL, input.releaseId, playerId, input.nodeId, currentTime(), input.sessionId);
  const node = stage.node;
  let party: BattleParty | undefined;
  let sessionRow: { id: string } | null = null;
  const owned = (stage.encounter.party_mode ?? 'fixed') === 'owned';
  if (owned && !input.sessionId) throw new HttpError(400, 'session_required', 'this stage is fought with your own heroes: start it first');
  if (input.sessionId) {
    const sess = await db
      .prepare('SELECT id, release_id, node_id, party_json, expires_at, consumed_at FROM battle_sessions WHERE id = ?1 AND player_id = ?2')
      .bind(input.sessionId, playerId)
      .first<{ id: string; release_id: string; node_id: string; party_json: string; expires_at: string; consumed_at: string | null }>();
    if (!sess || sess.release_id !== input.releaseId || sess.node_id !== input.nodeId) throw new HttpError(404, 'unknown_session', 'no such battle session for this stage');
    if (sess.consumed_at) throw new HttpError(409, 'session_used', 'this battle session was already submitted');
    if (Date.parse(sess.expires_at) <= currentTime().getTime()) throw new HttpError(409, 'session_expired', 'this battle session expired; start the stage again');
    if (owned) party = BattleParty.parse(JSON.parse(sess.party_json));
    sessionRow = { id: sess.id };
  }
  const out = await replayBattle(stage.pack, stage.encounter, input.actions, party);
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
    await requireEconomic(db, env.CONTENT_CHANNEL, input.releaseId, playerId, input.nodeId, currentTime(), input.sessionId);
    const old = await db.prepare('SELECT stars FROM player_progress WHERE player_id = ?1 AND node_id = ?2').bind(playerId, input.nodeId).first<{ stars: number }>();
    const oldStars = old?.stars ?? 0;
    const firstClear = !old;
    const newThreeStar = stars === 3 && oldStars < 3;
    const ration = await rationRow(db, playerId, nowMs);
    const spent = cost > 0 ? rationSpend(ration.stored, cost, nowMs) : null;
    if (cost > 0 && !spent) throw new HttpError(402, 'not_enough_ration', 'not enough Ration for this battle');

    const drops = await rollNodeDrops(db, node.drop, firstClear);
    const grants: { a: RewardAttachment; key: string }[] = [];
    if (firstClear) rewardsDef.first_clear.forEach((a, i) => grants.push({ a, key: `stage:${playerId}:${input.nodeId}:first:${i}` }));
    if (newThreeStar) rewardsDef.three_star.forEach((a, i) => grants.push({ a, key: `stage:${playerId}:${input.nodeId}:three:${i}` }));
    rewardsDef.repeat.forEach((a, i) => grants.push({ a, key: `stage:${playerId}:${input.requestId}:repeat:${i}` }));
    drops.first.forEach((a, i) => grants.push({ a, key: `stage:${playerId}:${input.nodeId}:firstdrop:${i}` }));
    drops.repeat.forEach((a, i) => grants.push({ a, key: `stage:${playerId}:${input.requestId}:drop:${i}` }));

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
    const batch: D1PreparedStatement[] = [economicStatement(db, env.CONTENT_CHANNEL, input.releaseId, playerId, input.nodeId, currentTime(), input.sessionId, true)];
    if (sessionRow) {
      batch.push(
        db.prepare('UPDATE battle_sessions SET consumed_at = ?2 WHERE id = ?1 AND consumed_at IS NULL AND julianday(expires_at) > julianday(?2)').bind(sessionRow.id, currentTime().toISOString()),
        db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)')
      );
    }
    if (cost > 0 && spent) {
      batch.push(
        db.prepare('INSERT OR IGNORE INTO player_ration (player_id, value, at_ms) VALUES (?1, ?2, ?3)').bind(playerId, ration.stored.value, ration.stored.atMs),
        db.prepare('UPDATE player_ration SET value = ?4, at_ms = ?5 WHERE player_id = ?1 AND value = ?2 AND at_ms = ?3').bind(playerId, ration.stored.value, ration.stored.atMs, spent.value, spent.atMs),
        db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)')
      );
    }
    // First clear is a plain INSERT (a parallel first clear hits the primary key and retries); later clears only apply when the best
    // stars are still what this attempt read, so one-time rewards (first clear, first three stars) can never be granted twice.
    batch.push(
      firstClear
        ? db.prepare('INSERT INTO player_progress (player_id, node_id, stars, clears, best_turns, first_cleared_at, updated_at) VALUES (?1, ?2, ?3, 1, ?4, ?5, ?5)').bind(playerId, input.nodeId, stars, turns, now.toISOString())
        : db
            .prepare(
              `UPDATE player_progress SET stars = MAX(stars, ?3), clears = clears + 1, best_turns = MIN(COALESCE(best_turns, ?4), ?4), updated_at = ?5
               WHERE player_id = ?1 AND node_id = ?2 AND stars = ?6`
            )
            .bind(playerId, input.nodeId, stars, turns, now.toISOString(), oldStars),
      ...(firstClear ? [] : [db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)')])
    );
    // one-time rewards keep stable keys (first clear / three stars), repeat rewards are keyed by the request
    // task progress counts only Ration-consuming wins (canon eligibility), in the same atomic batch
    if (cost > 0) batch.push(...(await taskEventStatements(db, playerId, { eligible_wins: 1, ...(node.boss ? { boss_wins: 1 } : {}), ...(stars === 3 ? { three_star_wins: 1 } : {}) }, nowMs)));
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
      if (/UNIQUE constraint failed: player_progress/i.test(msg)) continue; // a parallel first clear took the row: recompute
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
