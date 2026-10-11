import { analyzeBanner, BannerConfig, CANON, emptyPity, GachaError, pullMany, type PityState, type PullResult, type Roll } from '@uomd/economy';
import { HttpError } from '../content/store';
import { balanceOf, ledgerStatements } from '../db/ledger';

/** CSPRNG roll in [0, 1) with 53 bits of precision. Pulls never use Math.random or a client-supplied value. */
export const cryptoRoll: Roll = () => {
  const [hi, lo] = crypto.getRandomValues(new Uint32Array(2)) as Uint32Array & [number, number];
  return ((hi >>> 5) * 67108864 + (lo >>> 6)) / 9007199254740992;
};

interface BannerRow {
  id: string;
  title_en: string;
  config_json: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
}

export interface PullInput {
  bannerId: string;
  count: number;
  requestId: string;
  target?: string | undefined;
}

export interface PullRecord {
  seq: number;
  pullNumber: number;
  rarity: 3 | 4 | 5;
  itemType: 'character' | 'weapon';
  itemId: string;
  outcome: PullResult['outcome'];
  upgraded: boolean;
  duplicate: boolean;
  /** Memory Shards granted because the item was already owned */
  shards: number;
}

export interface PullResponse {
  requestId: string;
  bannerId: string;
  pityGroup: string;
  pulls: PullRecord[];
  cost: { currency: 'eclipse_token'; perPull: number; amount: number };
  pity: PityState & { hardPity: number };
  balance: number;
  replayed: boolean;
}

const active = (r: BannerRow, now: Date): boolean => r.status === 'active' && (!r.starts_at || r.starts_at <= now.toISOString()) && (!r.ends_at || r.ends_at > now.toISOString());

async function loadBanner(db: D1Database, id: string, now: Date): Promise<{ row: BannerRow; config: BannerConfig }> {
  const row = await db.prepare('SELECT id, title_en, config_json, starts_at, ends_at, status FROM banners WHERE id = ?1').bind(id).first<BannerRow>();
  if (!row || !active(row, now)) throw new HttpError(404, 'banner_unavailable', 'this banner is not available');
  return { row, config: BannerConfig.parse(JSON.parse(row.config_json)) };
}

async function storedResult(db: D1Database, playerId: string, input: PullInput): Promise<Omit<PullResponse, 'balance' | 'replayed'> | null> {
  const prior = await db
    .prepare('SELECT banner_id, pull_count, result_json FROM gacha_requests WHERE player_id = ?1 AND request_id = ?2')
    .bind(playerId, input.requestId)
    .first<{ banner_id: string; pull_count: number; result_json: string }>();
  if (!prior) return null;
  if (prior.banner_id !== input.bannerId || prior.pull_count !== input.count) throw new HttpError(409, 'request_id_reused', 'this requestId was already used for a different pull');
  return JSON.parse(prior.result_json) as Omit<PullResponse, 'balance' | 'replayed'>;
}

/**
 * Server-authoritative pull. One D1 batch (= one transaction) does ALL of:
 *   optimistic-concurrency update of the pity counters (guarded: a concurrent pull aborts and we retry with fresh state),
 *   the Eclipse Token debit (ledger + CHECK balance >= 0), the request record, the pull journal and the inventory grants.
 * A replayed requestId returns the stored result and never pulls twice.
 */
export async function pullGacha(db: D1Database, playerId: string, input: PullInput, opts: { now?: Date; roll?: Roll } = {}): Promise<PullResponse> {
  const now = opts.now ?? new Date();
  const roll = opts.roll ?? cryptoRoll;
  const replay = async (): Promise<PullResponse | null> => {
    const stored = await storedResult(db, playerId, input);
    return stored ? { ...stored, balance: await balanceOf(db, playerId, 'eclipse_token'), replayed: true } : null;
  };
  const again = await replay();
  if (again) return again;

  const { config } = await loadBanner(db, input.bannerId, now);
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      const seen = await replay(); // an identical request may have won while this one was retrying
      if (seen) return seen;
    }
    const stateRow = await db
      .prepare('SELECT pity5, pity4, lost, version FROM pity_state WHERE player_id = ?1 AND pity_group = ?2')
      .bind(playerId, config.pityGroup)
      .first<{ pity5: number; pity4: number; lost: number; version: number }>();
    const state: PityState = stateRow ? { pity5: stateRow.pity5, pity4: stateRow.pity4, lost: stateRow.lost } : emptyPity();
    const version = stateRow?.version ?? 0;
    const owned = new Set(
      (await db.prepare('SELECT item_id FROM player_items WHERE player_id = ?1 AND item_type = ?2').bind(playerId, config.kind).all<{ item_id: string }>()).results.map((r) => r.item_id)
    );

    let pulled: ReturnType<typeof pullMany>;
    try {
      pulled = pullMany(config, state, input.count, roll, input.target);
    } catch (e) {
      if (e instanceof GachaError) throw new HttpError(e.code === 'invalid_target' ? 422 : 400, e.code, e.message);
      throw e;
    }
    const records: PullRecord[] = pulled.results.map((r, seq) => {
      const duplicate = owned.has(r.itemId);
      owned.add(r.itemId);
      return {
        seq,
        pullNumber: r.pullNumber,
        rarity: r.rarity,
        itemType: config.kind,
        itemId: r.itemId,
        outcome: r.outcome,
        upgraded: r.upgraded,
        duplicate,
        shards: duplicate ? CANON.duplicateShards[r.rarity] : 0
      };
    });
    const response: Omit<PullResponse, 'balance' | 'replayed'> = {
      requestId: input.requestId,
      bannerId: input.bannerId,
      pityGroup: config.pityGroup,
      pulls: records,
      cost: { currency: 'eclipse_token', perPull: config.costPerPull, amount: input.count * config.costPerPull },
      pity: { ...pulled.state, hardPity: config.hardPity }
    };

    const batch: D1PreparedStatement[] = [
      db.prepare('INSERT OR IGNORE INTO pity_state (player_id, pity_group, pity5, pity4, lost, version) VALUES (?1, ?2, 0, 0, 0, 0)').bind(playerId, config.pityGroup),
      db
        .prepare('UPDATE pity_state SET pity5 = ?3, pity4 = ?4, lost = ?5, version = version + 1 WHERE player_id = ?1 AND pity_group = ?2 AND version = ?6')
        .bind(playerId, config.pityGroup, pulled.state.pity5, pulled.state.pity4, pulled.state.lost, version),
      // the update above changed exactly one row, or somebody else pulled meanwhile: ok = 0 violates the CHECK and rolls everything back
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
      ...ledgerStatements(db, {
        playerId,
        currency: 'eclipse_token',
        delta: -response.cost.amount,
        reason: `gacha:${input.bannerId}`,
        idempotencyKey: `gacha:${playerId}:${input.requestId}`
      }),
      db.prepare('INSERT INTO gacha_requests (player_id, request_id, banner_id, pull_count, result_json) VALUES (?1, ?2, ?3, ?4, ?5)').bind(playerId, input.requestId, input.bannerId, input.count, JSON.stringify(response))
    ];
    pulled.results.forEach((r, i) => {
      const rec = records[i] as PullRecord;
      batch.push(
        db
          .prepare(
            'INSERT INTO gacha_pulls (player_id, request_id, seq, banner_id, pull_number, rarity, item_type, item_id, outcome, upgraded, duplicate, rolls_json) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)'
          )
          .bind(playerId, input.requestId, i, input.bannerId, r.pullNumber, r.rarity, rec.itemType, r.itemId, r.outcome, r.upgraded ? 1 : 0, rec.duplicate ? 1 : 0, JSON.stringify(r.rolls)),
        db
          .prepare(
            'INSERT INTO player_items (player_id, item_type, item_id, copies, shards) VALUES (?1, ?2, ?3, 1, 0) ON CONFLICT (player_id, item_type, item_id) DO UPDATE SET copies = copies + 1, shards = shards + ?4'
          )
          .bind(playerId, rec.itemType, r.itemId, rec.shards)
      );
    });
    batch.push(db.prepare('DELETE FROM tx_guard'));

    try {
      await db.batch(batch);
      return { ...response, balance: await balanceOf(db, playerId, 'eclipse_token'), replayed: false };
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      if (/CHECK constraint failed: ok = 1/i.test(msg)) continue; // lost the race for the pity counters: recompute from fresh state
      if (/CHECK constraint failed: balance >= 0/i.test(msg)) throw new HttpError(402, 'insufficient_funds', 'not enough Eclipse Tokens');
      if (/UNIQUE constraint failed: (gacha_requests|ledger)\./i.test(msg)) {
        const dup = await replay();
        if (dup) return dup;
        throw new HttpError(409, 'request_id_reused', 'this requestId was already used');
      }
      throw e;
    }
  }
  throw new HttpError(409, 'busy', 'too many simultaneous pulls on this account, try again');
}

/** Public banner disclosure: exact rates, pity and pool lists (required rate transparency). */
export function disclosure(row: BannerRow, config: BannerConfig): Record<string, unknown> {
  const report = analyzeBanner(config);
  return {
    id: row.id,
    title: row.title_en,
    kind: config.kind,
    pityGroup: config.pityGroup,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    cost: { currency: 'eclipse_token', perPull: config.costPerPull },
    hardPity: config.hardPity,
    baseFiveStarRate: config.baseFiveStarRate,
    softPity: config.softPity,
    featured: config.featured,
    fourStarWeight: config.fourStarWeight,
    threeStarWeight: config.threeStarWeight,
    minFourStarEvery: config.minFourStarEvery,
    pools: config.pools,
    duplicateShards: CANON.duplicateShards,
    analysis: {
      consolidatedFiveStarRate: report.consolidatedFiveStarRate,
      expectedPullsPerFiveStar: report.expectedPullsPerFiveStar,
      expectedPullsPerTarget: report.expectedPullsPerTarget,
      worstCasePullsForTarget: report.worstCasePullsForTarget,
      fiveStarRateByPull: report.perPull.filter((p, i, a) => i === 0 || p.fiveStar !== a[i - 1]?.fiveStar)
    }
  };
}

export async function activeBanners(db: D1Database, now = new Date()): Promise<{ row: BannerRow; config: BannerConfig }[]> {
  const { results } = await db.prepare("SELECT id, title_en, config_json, starts_at, ends_at, status FROM banners WHERE status = 'active' ORDER BY id").all<BannerRow>();
  return results.filter((r) => active(r, now)).map((row) => ({ row, config: BannerConfig.parse(JSON.parse(row.config_json)) }));
}
