import { z } from 'zod';
import { BattleParty, Encounter, UnitPack, type PartyMember, type RewardAttachment } from '@uomd/content-schema';
import { playAuto, replayBattle } from '@uomd/combat';
import { accountLevelFromXp, afkYield, AFK_CAP_SEC, AFK_MIN_CLAIM_SEC, weekStart, windowOf, type AfkYield } from '@uomd/economy';
import { sha256Hex } from '@uomd/shared';
import { ContentStore, HttpError } from '../content/store';
import { BATTLE_SESSION_TTL_MS, economicStatement, requireEconomic } from '../content/authority';
import { loadReleaseCatalog, operationCatalog, type ReleaseScope, type RuntimeCatalog } from '../content/runtime-catalog';
import { grantStatements } from '../db/grants';
import { balanceOf } from '../db/ledger';
import { operationStatement, recordedOperation } from '../db/operations';
import type { GameEnv } from '../env';
import { loadProgressionConfig } from '../progression/characters';
import { buildParty } from '../progress/party';
import { SWEEP_DAILY_NODE_LIMIT, SWEEP_MAX_BATCH } from '../progress/service';

const RequestId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
const ReleaseId = z.string().regex(/^[a-z][a-z0-9_]{1,47}$/);

export { AFK_CAP_SEC, AFK_MIN_CLAIM_SEC };
export const ARENA_DAILY_LIMIT = 5;
export const ARENA_BASE_RATING = 1000;

export const AfkClaimBody = z
  .object({
    releaseId: ReleaseId.optional(),
    requestId: RequestId
  })
  .strict();

export const AchievementClaimBody = z
  .object({
    releaseId: ReleaseId.optional(),
    achievementId: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
    requestId: RequestId
  })
  .strict();

export const EventClaimBody = z
  .object({
    releaseId: ReleaseId.optional(),
    objectiveId: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
    requestId: RequestId
  })
  .strict();

export const ProfileUpdateBody = z
  .object({
    displayName: z.string().trim().min(2).max(32).optional(),
    avatarCharacterId: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/).optional(),
    titleBadge: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/).optional(),
    requestId: RequestId
  })
  .strict();

export const ArenaDefenseBody = z
  .object({
    releaseId: ReleaseId.optional(),
    members: z
      .array(
        z
          .object({
            characterId: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
            slot: z.number().int().min(0).max(4),
            row: z.enum(['front', 'rear'])
          })
          .strict()
      )
      .min(1)
      .max(5),
    requestId: RequestId
  })
  .strict();

export const ArenaMatchBody = z
  .object({
    releaseId: ReleaseId,
    opponentId: z.string().min(2).max(80),
    actions: z.array(z.object({ skillId: z.string().max(80), targetId: z.string().max(80).optional() }).strict()).max(600).optional(),
    requestId: RequestId
  })
  .strict();

export const ArenaSeasonClaimBody = z
  .object({
    releaseId: ReleaseId.optional(),
    seasonId: z.string().regex(/^s:[0-9-]{10}$/),
    requestId: RequestId
  })
  .strict();

export const EndlessModifiers = ['blood_moon', 'iron_ward', 'ashen_haste'] as const;
export type EndlessModifier = (typeof EndlessModifiers)[number];

export const EndlessStartBody = z
  .object({
    releaseId: ReleaseId,
    modifier: z.enum(EndlessModifiers).default('blood_moon'),
    requestId: RequestId
  })
  .strict();

export const EndlessWaveBody = z
  .object({
    releaseId: ReleaseId,
    sessionId: z.string().regex(/^[a-f0-9]{32}$/),
    actions: z.array(z.object({ skillId: z.string().max(80), targetId: z.string().max(80).optional() }).strict()).max(600).optional(),
    requestId: RequestId
  })
  .strict();

export const EndlessMilestoneClaimBody = z
  .object({
    releaseId: ReleaseId.optional(),
    wave: z.number().int().min(1).max(100),
    requestId: RequestId
  })
  .strict();

interface ProgressStats {
  clearedBattles: number;
  threeStarStages: number;
  totalStars: number;
  totalClears: number;
  earliestClearIso: string | null;
  ownedCharacters: number;
  maxAscension: number;
  accountXp: number;
  accountLevel: number;
  arenaWins: number;
  arenaRating: number;
  endlessBestWave: number;
}

export function arenaSeasonOf(nowMs: number): { seasonId: string; startsAtMs: number; endsAtMs: number; settlementEndsAtMs: number } {
  const start = weekStart(nowMs);
  const end = start + 7 * 86_400_000;
  const iso = new Date(start).toISOString().slice(0, 10);
  return {
    seasonId: `s:${iso}`,
    startsAtMs: start,
    endsAtMs: end,
    settlementEndsAtMs: end + 2 * 86_400_000
  };
}

async function loadProgressStats(db: D1Database, playerId: string, nowMs = Date.now(), catalog?: RuntimeCatalog): Promise<ProgressStats> {
  const cfg = catalog?.data.config.progression ?? (await loadProgressionConfig(db).catch(() => null));
  const [prog, chars, asc, acc, arenaWinRow, arenaEloRow, endlessRow] = await Promise.all([
    db
      .prepare(
        'SELECT COUNT(CASE WHEN stars >= 1 THEN 1 END) AS clearedBattles, COUNT(CASE WHEN stars = 3 THEN 1 END) AS threeStarStages, COALESCE(SUM(stars), 0) AS totalStars, COALESCE(SUM(clears), 0) AS totalClears, MIN(first_cleared_at) AS earliestClearIso FROM player_progress WHERE player_id = ?1'
      )
      .bind(playerId)
      .first<{ clearedBattles: number; threeStarStages: number; totalStars: number; totalClears: number; earliestClearIso: string | null }>(),
    db.prepare("SELECT COUNT(*) AS n FROM player_items WHERE player_id = ?1 AND item_type = 'character'").bind(playerId).first<{ n: number }>(),
    db.prepare('SELECT COALESCE(MAX(ascension), 0) AS maxAsc FROM player_chars WHERE player_id = ?1').bind(playerId).first<{ maxAsc: number }>(),
    db.prepare('SELECT xp FROM player_account WHERE player_id = ?1').bind(playerId).first<{ xp: number }>(),
    db.prepare("SELECT COALESCE(SUM(progress), 0) AS wins FROM player_tasks WHERE player_id = ?1 AND period_key LIKE 'arena:wins:%'").bind(playerId).first<{ wins: number }>(),
    db
      .prepare('SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = ?2 AND task_id = ?3')
      .bind(playerId, `arena:rating:${arenaSeasonOf(nowMs).seasonId}`, 'elo')
      .first<{ progress: number }>(),
    db.prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = 'endless:best' AND task_id = 'wave'").bind(playerId).first<{ progress: number }>()
  ]);
  const accountXp = acc?.xp ?? 0;
  const accountLevel = cfg ? accountLevelFromXp(cfg, accountXp).level : Math.max(1, Math.floor(accountXp / 250) + 1);
  return {
    clearedBattles: prog?.clearedBattles ?? 0,
    threeStarStages: prog?.threeStarStages ?? 0,
    totalStars: prog?.totalStars ?? 0,
    totalClears: prog?.totalClears ?? 0,
    earliestClearIso: prog?.earliestClearIso ?? null,
    ownedCharacters: chars?.n ?? 0,
    maxAscension: asc?.maxAsc ?? 0,
    accountXp,
    accountLevel,
    arenaWins: arenaWinRow?.wins ?? 0,
    arenaRating: arenaEloRow?.progress ?? ARENA_BASE_RATING,
    endlessBestWave: endlessRow?.progress ?? 0
  };
}

/**
 * R12 Mode Unlock Gates & Launch Locks:
 * Evaluates authoritative progress for core modes and explicitly distinguishes unlocked modes,
 * progression-gated modes, and launch-locked future expansions.
 */
export async function getModeGates(db: D1Database, playerId: string, nowMs = Date.now(), scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const catalog = await operationCatalog(db, playerId, scope, new Date(nowMs));
  const stats = await loadProgressStats(db, playerId, nowMs, catalog);
  return {
    serverTimeMs: nowMs,
    modes: {
      sweep: {
        unlocked: stats.threeStarStages >= 1,
        launchLocked: false,
        requirement: 'Earn 3 stars on any repeatable battle stage',
        dailyNodeLimit: SWEEP_DAILY_NODE_LIMIT,
        maxBatch: SWEEP_MAX_BATCH
      },
      afk: {
        unlocked: stats.clearedBattles >= 1,
        launchLocked: false,
        requirement: 'Clear at least 1 battle stage',
        capSeconds: AFK_CAP_SEC
      },
      achievements: {
        unlocked: true,
        launchLocked: false,
        requirement: 'Available from start'
      },
      events: {
        unlocked: stats.clearedBattles >= 1,
        launchLocked: false,
        requirement: 'Clear at least 1 battle stage'
      },
      arena: {
        unlocked: stats.clearedBattles >= 1,
        launchLocked: false,
        requirement: 'Clear at least 1 battle stage',
        dailyLimit: ARENA_DAILY_LIMIT
      },
      endless: {
        unlocked: stats.clearedBattles >= 1,
        launchLocked: false,
        requirement: 'Clear at least 1 battle stage'
      },
      profile: {
        unlocked: true,
        launchLocked: false,
        requirement: 'Available from start'
      },
      catacomb_raids: {
        unlocked: false,
        launchLocked: true,
        requirement: 'Future seasonal expansion (launch-locked; no guild/chat scope in v1)'
      }
    }
  };
}

function computeAfkAccrual(checkpointSec: number, nowSec: number, clearedBattles: number): Omit<AfkYield, 'accountXp' | 'pages' | 'dust'> & { rewards: RewardAttachment[] } {
  const { accountXp, pages, dust, ...rest } = afkYield(nowSec - checkpointSec, clearedBattles);
  if (!rest.claimable) return { ...rest, rewards: [] };
  const rewards: RewardAttachment[] = [
    { type: 'account_xp', amount: accountXp },
    { type: 'item', itemId: 'torn_chronicle_page', quantity: pages },
    ...(dust >= 1 ? [{ type: 'item' as const, itemId: 'forge_dust', quantity: dust }] : [])
  ];
  return { ...rest, rewards };
}

/**
 * R12 AFK Idle Status: computes server-clock elapsed time since the player's last AFK checkpoint
 * (or first stage clear timestamp if never claimed yet), capped at 12 hours.
 */
export async function getAfkStatus(db: D1Database, playerId: string, now = new Date(), scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const nowMs = now.getTime();
  const nowSec = Math.floor(nowMs / 1000);
  const catalog = await operationCatalog(db, playerId, scope, now);
  const stats = await loadProgressStats(db, playerId, nowMs, catalog);
  const cpRow = await db
    .prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = 'afk:checkpoint' AND task_id = 'idle'")
    .bind(playerId)
    .first<{ progress: number }>();
  const defaultSec = stats.earliestClearIso ? Math.floor(Date.parse(stats.earliestClearIso) / 1000) : nowSec;
  const checkpointSec = cpRow ? cpRow.progress : defaultSec;
  const accrual = computeAfkAccrual(checkpointSec, nowSec, stats.clearedBattles);
  return {
    unlocked: stats.clearedBattles >= 1,
    serverTimeMs: nowMs,
    checkpointMs: checkpointSec * 1000,
    capSeconds: AFK_CAP_SEC,
    minClaimSeconds: AFK_MIN_CLAIM_SEC,
    clearedStages: stats.clearedBattles,
    ...accrual
  };
}

/**
 * R12 AFK Idle Claim: atomically advances the server-clock checkpoint and grants accrued idle rewards.
 * Idempotent per requestId; concurrent claims race on the checkpoint CAS guard.
 */
export async function claimAfkRewards(db: D1Database, playerId: string, input: z.infer<typeof AfkClaimBody>, now = new Date(), scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const kind = 'afk_claim';
  const first = await recordedOperation(db, playerId, kind, input);
  if (first) return first;
  if (input.releaseId !== scope?.releaseId) throw new HttpError(400, 'release_context_mismatch', 'AFK claim release context differs');
  const nowMs = now.getTime();
  const nowSec = Math.floor(nowMs / 1000);
  const catalog = await operationCatalog(db, playerId, scope, now);

  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      const seen = await recordedOperation(db, playerId, kind, input);
      if (seen) return seen;
    }
    const stats = await loadProgressStats(db, playerId, nowMs, catalog);
    if (stats.clearedBattles < 1) {
      throw new HttpError(403, 'mode_locked', 'clear at least one battle stage to unlock AFK Patrol rewards');
    }
    const cpRow = await db
      .prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = 'afk:checkpoint' AND task_id = 'idle'")
      .bind(playerId)
      .first<{ progress: number }>();
    const defaultSec = stats.earliestClearIso ? Math.floor(Date.parse(stats.earliestClearIso) / 1000) : nowSec;
    const checkpointSec = cpRow ? cpRow.progress : defaultSec;
    const accrual = computeAfkAccrual(checkpointSec, nowSec, stats.clearedBattles);
    if (!accrual.claimable || accrual.rewards.length === 0) {
      throw new HttpError(409, 'afk_nothing_to_claim', 'at least one minute of AFK patrol time must accrue before claiming', {
        elapsedSeconds: accrual.elapsedSeconds,
        minClaimSeconds: AFK_MIN_CLAIM_SEC
      });
    }

    const result = {
      ...(scope?.releaseId ? { releaseId: scope.releaseId } : {}),
      ...(catalog ? { catalogSha256: catalog.sha256 } : {}),
      requestId: input.requestId,
      previousCheckpointMs: checkpointSec * 1000,
      checkpointMs: nowSec * 1000,
      elapsedSeconds: accrual.elapsedSeconds,
      minutesAccrued: accrual.minutesAccrued,
      capped: accrual.capped,
      rewards: accrual.rewards
    };

    const grantStmts = await grantStatements(db, playerId, accrual.rewards, {
      keyPrefix: `afk:${playerId}:${input.requestId}`,
      reason: 'afk_claim',
      catalog
    });

    const batch: D1PreparedStatement[] = [
      ...(scope?.releaseId ? [economicStatement(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', now, undefined, true)] : []),
      db.prepare("INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (SELECT 1 FROM players WHERE id = ?1 AND status = 'active') THEN 1 ELSE 0 END)").bind(playerId),
      ...(cpRow
        ? [
            db
              .prepare("UPDATE player_tasks SET progress = ?2, claimed_at = ?3 WHERE player_id = ?1 AND period_key = 'afk:checkpoint' AND task_id = 'idle' AND progress = ?4 AND ?2 > ?4")
              .bind(playerId, nowSec, now.toISOString(), checkpointSec),
            db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)')
          ]
        : [
            db
              .prepare("INSERT INTO player_tasks (player_id, period_key, task_id, progress, target, claimed_at) VALUES (?1, 'afk:checkpoint', 'idle', ?2, ?3, ?4)")
              .bind(playerId, nowSec, AFK_CAP_SEC, now.toISOString())
          ]),
      ...grantStmts,
      operationStatement(db, playerId, kind, input, result),
      db.prepare('DELETE FROM tx_guard')
    ];

    try {
      await db.batch(batch);
      return { ...result, replayed: false };
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      if (/CHECK constraint failed: ok = 1|UNIQUE constraint failed: (player_tasks|progression_requests|ledger)/i.test(msg)) {
        const prior = await recordedOperation(db, playerId, kind, input);
        if (prior) return prior;
        if (scope?.releaseId) await requireEconomic(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', now);
        continue;
      }
      throw e;
    }
  }
  throw new HttpError(409, 'busy', 'concurrent AFK claim in progress, try again');
}

interface AchievementDef {
  id: string;
  title: string;
  description: string;
  badgeTitle: string;
  target: number;
  progressOf: (s: ProgressStats) => number;
  rewards: RewardAttachment[];
}

const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'ach_first_clear',
    title: 'First Ashen Step',
    description: 'Clear your first campaign battle stage.',
    badgeTitle: 'wayfarer_of_ash',
    target: 1,
    progressOf: (s) => s.clearedBattles,
    rewards: [
      { type: 'currency', currency: 'eclipse_token', amount: 60 },
      { type: 'account_xp', amount: 100 }
    ]
  },
  {
    id: 'ach_three_stars_3',
    title: 'Unblemished Tactician',
    description: 'Earn at least 9 total stars across campaign stages.',
    badgeTitle: 'unblemished_tactician',
    target: 9,
    progressOf: (s) => s.totalStars,
    rewards: [
      { type: 'currency', currency: 'eclipse_token', amount: 120 },
      { type: 'item', itemId: 'torn_chronicle_page', quantity: 5 }
    ]
  },
  {
    id: 'ach_clears_5',
    title: 'Relentless March',
    description: 'Complete 5 total stage victories (including sweeps).',
    badgeTitle: 'relentless_warden',
    target: 5,
    progressOf: (s) => s.totalClears,
    rewards: [
      { type: 'currency', currency: 'eclipse_token', amount: 150 },
      { type: 'item', itemId: 'iron_oath_seal', quantity: 2 }
    ]
  },
  {
    id: 'ach_fellowship_4',
    title: 'Company of the Demise',
    description: 'Recruit at least 4 companions into your roster.',
    badgeTitle: 'oathbound_captain',
    target: 4,
    progressOf: (s) => s.ownedCharacters,
    rewards: [
      { type: 'currency', currency: 'eclipse_token', amount: 100 },
      { type: 'item', itemId: 'tactical_notes', quantity: 3 }
    ]
  },
  {
    id: 'ach_ascend_1',
    title: 'Broken Seal',
    description: 'Ascend any companion to Ascension Tier 1.',
    badgeTitle: 'seal_breaker',
    target: 1,
    progressOf: (s) => s.maxAscension,
    rewards: [
      { type: 'currency', currency: 'eclipse_token', amount: 100 },
      { type: 'item', itemId: 'forge_dust', quantity: 5 }
    ]
  },
  {
    id: 'ach_arena_victor',
    title: 'Bell-Tower Challenger',
    description: 'Win 1 Asynchronous Arena match.',
    badgeTitle: 'bell_challenger',
    target: 1,
    progressOf: (s) => s.arenaWins,
    rewards: [
      { type: 'currency', currency: 'eclipse_token', amount: 80 },
      { type: 'account_xp', amount: 100 }
    ]
  },
  {
    id: 'ach_endless_wave_3',
    title: 'Corridor Delver',
    description: 'Clear Wave 3 in the Endless Corridor.',
    badgeTitle: 'corridor_delver',
    target: 3,
    progressOf: (s) => s.endlessBestWave,
    rewards: [
      { type: 'currency', currency: 'eclipse_token', amount: 120 },
      { type: 'item', itemId: 'torn_chronicle_page', quantity: 5 }
    ]
  }
];

export async function listAchievements(db: D1Database, playerId: string, nowMs = Date.now(), scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const catalog = await operationCatalog(db, playerId, scope, new Date(nowMs));
  const stats = await loadProgressStats(db, playerId, nowMs, catalog);
  const { results: claimedRows } = await db
    .prepare("SELECT task_id, claimed, claimed_at FROM player_tasks WHERE player_id = ?1 AND period_key = 'achievement'")
    .bind(playerId)
    .all<{ task_id: string; claimed: number; claimed_at: string | null }>();
  const claimedMap = new Map(claimedRows.map((r) => [r.task_id, r]));
  return {
    serverTimeMs: nowMs,
    achievements: ACHIEVEMENTS.map((a) => {
      const progress = Math.min(a.target, a.progressOf(stats));
      const c = claimedMap.get(a.id);
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        badgeTitle: a.badgeTitle,
        progress,
        target: a.target,
        done: progress >= a.target,
        claimed: c?.claimed === 1,
        claimedAt: c?.claimed_at ?? null,
        rewards: a.rewards
      };
    })
  };
}

export async function claimAchievement(db: D1Database, playerId: string, input: z.infer<typeof AchievementClaimBody>, now = new Date(), scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const kind = `achievement_claim:${input.achievementId}`;
  const first = await recordedOperation(db, playerId, kind, input);
  if (first) return first;
  if (input.releaseId !== scope?.releaseId) throw new HttpError(400, 'release_context_mismatch', 'achievement release context differs');
  const def = ACHIEVEMENTS.find((a) => a.id === input.achievementId);
  if (!def) throw new HttpError(404, 'unknown_achievement', 'no such achievement');
  const nowMs = now.getTime();
  const catalog = await operationCatalog(db, playerId, scope, now);
  const stats = await loadProgressStats(db, playerId, nowMs, catalog);
  const progress = Math.min(def.target, def.progressOf(stats));
  if (progress < def.target) {
    throw new HttpError(409, 'achievement_not_ready', 'this achievement objective is not complete yet', { progress, target: def.target });
  }
  const existing = await db
    .prepare("SELECT claimed FROM player_tasks WHERE player_id = ?1 AND period_key = 'achievement' AND task_id = ?2")
    .bind(playerId, def.id)
    .first<{ claimed: number }>();
  if (existing?.claimed === 1) {
    const replay = await recordedOperation(db, playerId, kind, input);
    if (replay) return replay;
    throw new HttpError(409, 'already_claimed', 'achievement already claimed');
  }

  const result = {
    ...(scope?.releaseId ? { releaseId: scope.releaseId } : {}),
    ...(catalog ? { catalogSha256: catalog.sha256 } : {}),
    requestId: input.requestId,
    achievementId: def.id,
    badgeTitle: def.badgeTitle,
    rewards: def.rewards
  };
  const grantStmts = await grantStatements(db, playerId, def.rewards, {
    keyPrefix: `achievement:${playerId}:${def.id}`,
    reason: `achievement:${def.id}`,
    catalog
  });

  try {
    await db.batch([
      ...(scope?.releaseId ? [economicStatement(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', now, undefined, true)] : []),
      db.prepare("INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (SELECT 1 FROM players WHERE id = ?1 AND status = 'active') THEN 1 ELSE 0 END)").bind(playerId),
      db
        .prepare(
          "INSERT INTO player_tasks (player_id, period_key, task_id, progress, target, claimed, claimed_at) VALUES (?1, 'achievement', ?2, ?3, ?3, 1, ?4) ON CONFLICT (player_id, period_key, task_id) DO UPDATE SET progress = ?3, claimed = 1, claimed_at = ?4 WHERE claimed = 0"
        )
        .bind(playerId, def.id, def.target, now.toISOString()),
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
      ...grantStmts,
      operationStatement(db, playerId, kind, input, result),
      db.prepare('DELETE FROM tx_guard')
    ]);
  } catch (e) {
    const replay = await recordedOperation(db, playerId, kind, input);
    if (replay) return replay;
    if (scope?.releaseId) await requireEconomic(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', now);
    const msg = String(e instanceof Error ? e.message : e);
    if (/CHECK constraint failed: ok = 1|UNIQUE constraint failed: (player_tasks|ledger|progression_requests)/i.test(msg)) {
      throw new HttpError(409, 'already_claimed', 'achievement already claimed');
    }
    throw e;
  }
  return { ...result, balance: await balanceOf(db, playerId, 'eclipse_token'), replayed: false };
}

interface EventObjectiveDef {
  id: string;
  title: string;
  target: number;
  progressOf: (s: ProgressStats) => number;
  rewards: RewardAttachment[];
}

interface SeasonalEventDef {
  eventId: string;
  title: string;
  subtitle: string;
  startsAtMs: number;
  endsAtMs: number;
  claimEndsAtMs: number;
  objectives: readonly EventObjectiveDef[];
}

const SEASONAL_EVENTS: readonly SeasonalEventDef[] = [
  {
    eventId: 'ev_ashen_vigil_s1',
    title: 'Ashen Vigil — Season I',
    subtitle: 'Hold the bell-tower road and gather chronicle remnants.',
    startsAtMs: Date.UTC(2026, 0, 1, 0, 0, 0),
    endsAtMs: Date.UTC(2027, 0, 1, 0, 0, 0),
    claimEndsAtMs: Date.UTC(2027, 0, 8, 0, 0, 0),
    objectives: [
      {
        id: 'ev_obj_clear_1',
        title: 'Clear 1 Campaign Battle',
        target: 1,
        progressOf: (s) => s.clearedBattles,
        rewards: [{ type: 'item', itemId: 'torn_chronicle_page', quantity: 3 }]
      },
      {
        id: 'ev_obj_clears_3',
        title: 'Win or Sweep 3 Stages',
        target: 3,
        progressOf: (s) => s.totalClears,
        rewards: [
          { type: 'currency', currency: 'eclipse_token', amount: 80 },
          { type: 'item', itemId: 'forge_dust', quantity: 4 }
        ]
      },
      {
        id: 'ev_obj_stars_6',
        title: 'Accumulate 6 Campaign Stars',
        target: 6,
        progressOf: (s) => s.totalStars,
        rewards: [
          { type: 'currency', currency: 'eclipse_token', amount: 120 },
          { type: 'item', itemId: 'iron_oath_seal', quantity: 2 }
        ]
      }
    ]
  }
];

export async function listEvents(db: D1Database, playerId: string, nowMs = Date.now(), scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const catalog = await operationCatalog(db, playerId, scope, new Date(nowMs));
  const stats = await loadProgressStats(db, playerId, nowMs, catalog);
  const { results: claimedRows } = await db
    .prepare("SELECT period_key, task_id, claimed, claimed_at FROM player_tasks WHERE player_id = ?1 AND period_key LIKE 'event:%'")
    .bind(playerId)
    .all<{ period_key: string; task_id: string; claimed: number; claimed_at: string | null }>();
  const claimedMap = new Map(claimedRows.map((r) => [`${r.period_key}:${r.task_id}`, r]));
  return {
    serverTimeMs: nowMs,
    events: SEASONAL_EVENTS.map((ev) => {
      const state = nowMs < ev.startsAtMs ? 'scheduled' : nowMs < ev.endsAtMs ? 'active' : nowMs < ev.claimEndsAtMs ? 'claim_grace' : 'ended';
      return {
        eventId: ev.eventId,
        title: ev.title,
        subtitle: ev.subtitle,
        state,
        startsAtMs: ev.startsAtMs,
        endsAtMs: ev.endsAtMs,
        claimEndsAtMs: ev.claimEndsAtMs,
        objectives: ev.objectives.map((o) => {
          const progress = Math.min(o.target, o.progressOf(stats));
          const c = claimedMap.get(`event:${ev.eventId}:${o.id}`);
          return {
            id: o.id,
            title: o.title,
            progress,
            target: o.target,
            done: progress >= o.target,
            claimed: c?.claimed === 1,
            claimedAt: c?.claimed_at ?? null,
            rewards: o.rewards
          };
        })
      };
    })
  };
}

export async function claimEventReward(db: D1Database, playerId: string, eventId: string, input: z.infer<typeof EventClaimBody>, now = new Date(), scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const kind = `event_claim:${eventId}:${input.objectiveId}`;
  const first = await recordedOperation(db, playerId, kind, input);
  if (first) return first;
  if (input.releaseId !== scope?.releaseId) throw new HttpError(400, 'release_context_mismatch', 'event release context differs');
  const ev = SEASONAL_EVENTS.find((e) => e.eventId === eventId);
  if (!ev) throw new HttpError(404, 'unknown_event', 'no such event');
  const nowMs = now.getTime();
  if (nowMs < ev.startsAtMs) throw new HttpError(409, 'event_not_started', 'this event has not started yet');
  if (nowMs >= ev.claimEndsAtMs) throw new HttpError(409, 'event_expired', 'the claim window for this event has closed');
  const obj = ev.objectives.find((o) => o.id === input.objectiveId);
  if (!obj) throw new HttpError(404, 'unknown_objective', 'no such event objective');

  const catalog = await operationCatalog(db, playerId, scope, now);
  const stats = await loadProgressStats(db, playerId, nowMs, catalog);
  const progress = Math.min(obj.target, obj.progressOf(stats));
  if (progress < obj.target) {
    throw new HttpError(409, 'objective_not_ready', 'this event objective is not complete yet', { progress, target: obj.target });
  }
  const periodKey = `event:${ev.eventId}`;
  const existing = await db
    .prepare('SELECT claimed FROM player_tasks WHERE player_id = ?1 AND period_key = ?2 AND task_id = ?3')
    .bind(playerId, periodKey, obj.id)
    .first<{ claimed: number }>();
  if (existing?.claimed === 1) {
    const replay = await recordedOperation(db, playerId, kind, input);
    if (replay) return replay;
    throw new HttpError(409, 'already_claimed', 'event objective already claimed');
  }

  const result = {
    ...(scope?.releaseId ? { releaseId: scope.releaseId } : {}),
    ...(catalog ? { catalogSha256: catalog.sha256 } : {}),
    requestId: input.requestId,
    eventId: ev.eventId,
    objectiveId: obj.id,
    rewards: obj.rewards
  };
  const grantStmts = await grantStatements(db, playerId, obj.rewards, {
    keyPrefix: `event:${playerId}:${ev.eventId}:${obj.id}`,
    reason: `event:${ev.eventId}:${obj.id}`,
    catalog
  });

  try {
    await db.batch([
      ...(scope?.releaseId ? [economicStatement(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', now, undefined, true)] : []),
      db.prepare("INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (SELECT 1 FROM players WHERE id = ?1 AND status = 'active') THEN 1 ELSE 0 END)").bind(playerId),
      db
        .prepare(
          'INSERT INTO player_tasks (player_id, period_key, task_id, progress, target, claimed, claimed_at) VALUES (?1, ?2, ?3, ?4, ?4, 1, ?5) ON CONFLICT (player_id, period_key, task_id) DO UPDATE SET progress = ?4, claimed = 1, claimed_at = ?5 WHERE claimed = 0'
        )
        .bind(playerId, periodKey, obj.id, obj.target, now.toISOString()),
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
      ...grantStmts,
      operationStatement(db, playerId, kind, input, result),
      db.prepare('DELETE FROM tx_guard')
    ]);
  } catch (e) {
    const replay = await recordedOperation(db, playerId, kind, input);
    if (replay) return replay;
    if (scope?.releaseId) await requireEconomic(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', now);
    const msg = String(e instanceof Error ? e.message : e);
    if (/CHECK constraint failed: ok = 1|UNIQUE constraint failed: (player_tasks|ledger|progression_requests)/i.test(msg)) {
      throw new HttpError(409, 'already_claimed', 'event objective already claimed');
    }
    throw e;
  }
  return { ...result, balance: await balanceOf(db, playerId, 'eclipse_token'), replayed: false };
}

/**
 * R12 Social / Profile / Leaderboard Foundations (without guild/chat bloat).
 */
export async function getProfile(db: D1Database, playerId: string, nowMs = Date.now(), scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const catalog = await operationCatalog(db, playerId, scope, new Date(nowMs));
  const stats = await loadProgressStats(db, playerId, nowMs, catalog);
  const [pRow, metaRow, claimedAch] = await Promise.all([
    db.prepare('SELECT id, display_name, created_at FROM players WHERE id = ?1').bind(playerId).first<{ id: string; display_name: string | null; created_at: string }>(),
    db.prepare("SELECT claimed_at FROM player_tasks WHERE player_id = ?1 AND period_key = 'profile:meta' AND task_id = 'card'").bind(playerId).first<{ claimed_at: string | null }>(),
    db.prepare("SELECT task_id FROM player_tasks WHERE player_id = ?1 AND period_key = 'achievement' AND claimed = 1").bind(playerId).all<{ task_id: string }>()
  ]);
  const meta = metaRow?.claimed_at ? (JSON.parse(metaRow.claimed_at) as { avatarCharacterId?: string; titleBadge?: string }) : {};
  const unlockedBadges = ['novice_warden', ...ACHIEVEMENTS.filter((a) => claimedAch.results.some((c) => c.task_id === a.id)).map((a) => a.badgeTitle)];
  return {
    playerId,
    displayName: pRow?.display_name ?? 'Wanderer',
    createdAt: pRow?.created_at ?? null,
    avatarCharacterId: meta.avatarCharacterId ?? 'mahmut',
    titleBadge: meta.titleBadge ?? 'novice_warden',
    unlockedBadges,
    summary: {
      accountLevel: stats.accountLevel,
      totalStars: stats.totalStars,
      totalClears: stats.totalClears,
      ownedCharacters: stats.ownedCharacters,
      arenaRating: stats.arenaRating,
      endlessBestWave: stats.endlessBestWave
    }
  };
}

export async function updateProfile(db: D1Database, playerId: string, input: z.infer<typeof ProfileUpdateBody>): Promise<Record<string, unknown>> {
  const kind = 'profile_update';
  const first = await recordedOperation(db, playerId, kind, input);
  if (first) return first;

  if (input.avatarCharacterId) {
    const owns = await db
      .prepare("SELECT 1 FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND item_id = ?2")
      .bind(playerId, input.avatarCharacterId)
      .first();
    if (!owns) throw new HttpError(404, 'not_owned', 'you do not own the selected avatar character');
  }
  if (input.titleBadge && input.titleBadge !== 'novice_warden') {
    const ach = ACHIEVEMENTS.find((a) => a.badgeTitle === input.titleBadge);
    if (!ach) throw new HttpError(422, 'invalid_badge', 'unknown title badge');
    const claimed = await db
      .prepare("SELECT claimed FROM player_tasks WHERE player_id = ?1 AND period_key = 'achievement' AND task_id = ?2")
      .bind(playerId, ach.id)
      .first<{ claimed: number }>();
    if (claimed?.claimed !== 1) throw new HttpError(403, 'badge_locked', 'claim the corresponding achievement before equipping this title badge');
  }

  const currentMetaRow = await db
    .prepare("SELECT claimed_at FROM player_tasks WHERE player_id = ?1 AND period_key = 'profile:meta' AND task_id = 'card'")
    .bind(playerId)
    .first<{ claimed_at: string | null }>();
  const currentMeta = currentMetaRow?.claimed_at ? (JSON.parse(currentMetaRow.claimed_at) as { avatarCharacterId?: string; titleBadge?: string }) : {};
  const nextMeta = {
    avatarCharacterId: input.avatarCharacterId ?? currentMeta.avatarCharacterId ?? 'mahmut',
    titleBadge: input.titleBadge ?? currentMeta.titleBadge ?? 'novice_warden'
  };
  const pRow = await db.prepare('SELECT display_name FROM players WHERE id = ?1').bind(playerId).first<{ display_name: string | null }>();
  const nextName = input.displayName ?? pRow?.display_name ?? 'Wanderer';

  const result = {
    requestId: input.requestId,
    displayName: nextName,
    avatarCharacterId: nextMeta.avatarCharacterId,
    titleBadge: nextMeta.titleBadge
  };

  await db.batch([
    db.prepare("INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (SELECT 1 FROM players WHERE id = ?1 AND status = 'active') THEN 1 ELSE 0 END)").bind(playerId),
    ...(input.displayName ? [db.prepare('UPDATE players SET display_name = ?2 WHERE id = ?1').bind(playerId, nextName)] : []),
    db
      .prepare(
        "INSERT INTO player_tasks (player_id, period_key, task_id, progress, target, claimed_at) VALUES (?1, 'profile:meta', 'card', 1, 1, ?2) ON CONFLICT (player_id, period_key, task_id) DO UPDATE SET progress = progress + 1, claimed_at = ?2"
      )
      .bind(playerId, JSON.stringify(nextMeta)),
    operationStatement(db, playerId, kind, input, result),
    db.prepare('DELETE FROM tx_guard')
  ]);

  return { ...result, replayed: false };
}

export async function getLeaderboard(db: D1Database, playerId: string, board: 'campaign_stars' | 'arena' | 'endless', limit = 20, nowMs = Date.now()): Promise<Record<string, unknown>> {
  const clampedLimit = Math.min(50, Math.max(1, limit));
  const season = arenaSeasonOf(nowMs);
  let rows: { player_id: string; display_name: string | null; score: number }[];
  if (board === 'campaign_stars') {
    rows = (
      await db
        .prepare(
          `SELECT p.id AS player_id, p.display_name, COALESCE(SUM(pp.stars), 0) AS score
           FROM players p LEFT JOIN player_progress pp ON pp.player_id = p.id
           WHERE p.status = 'active'
           GROUP BY p.id
           ORDER BY score DESC, p.created_at ASC
           LIMIT ?1`
        )
        .bind(clampedLimit)
        .all<{ player_id: string; display_name: string | null; score: number }>()
    ).results;
  } else if (board === 'arena') {
    rows = (
      await db
        .prepare(
          `SELECT p.id AS player_id, p.display_name, COALESCE(pt.progress, ?1) AS score
           FROM players p LEFT JOIN player_tasks pt ON pt.player_id = p.id AND pt.period_key = ?2 AND pt.task_id = 'elo'
           WHERE p.status = 'active'
           ORDER BY score DESC, p.created_at ASC
           LIMIT ?3`
        )
        .bind(ARENA_BASE_RATING, `arena:rating:${season.seasonId}`, clampedLimit)
        .all<{ player_id: string; display_name: string | null; score: number }>()
    ).results;
  } else {
    rows = (
      await db
        .prepare(
          `SELECT p.id AS player_id, p.display_name, COALESCE(pt.progress, 0) AS score
           FROM players p LEFT JOIN player_tasks pt ON pt.player_id = p.id AND pt.period_key = 'endless:best' AND pt.task_id = 'wave'
           WHERE p.status = 'active'
           ORDER BY score DESC, p.created_at ASC
           LIMIT ?1`
        )
        .bind(clampedLimit)
        .all<{ player_id: string; display_name: string | null; score: number }>()
    ).results;
  }

  const entries = await Promise.all(
    rows.map(async (r, idx) => ({
      rank: idx + 1,
      playerTag: `W-${(await sha256Hex(r.player_id)).slice(0, 8).toUpperCase()}`,
      displayName: r.display_name ?? 'Wanderer',
      score: r.score,
      isMe: r.player_id === playerId
    }))
  );
  return {
    board,
    seasonId: board === 'arena' ? season.seasonId : null,
    entries
  };
}

/**
 * R12 Async Arena: defense setup, opponent matchmaking, deterministic combat verification,
 * Elo rating update, daily match limit, and season reward settlement.
 */
const SYNTHETIC_ARENA_OPPONENTS = [
  { opponentId: 'sentinel_vanguard', displayName: 'Vanguard Sentinel', rating: 960, level: 1 },
  { opponentId: 'ashen_outrider', displayName: 'Ashen Outrider', rating: 1020, level: 2 },
  { opponentId: 'bell_tower_warden', displayName: 'Bell-Tower Warden', rating: 1100, level: 3 }
] as const;

export function arenaTierRewards(rating: number): { tier: string; rewards: RewardAttachment[] } {
  if (rating >= 1100) {
    return {
      tier: 'gold_bell',
      rewards: [
        { type: 'currency', currency: 'eclipse_token', amount: 150 },
        { type: 'item', itemId: 'torn_chronicle_page', quantity: 6 },
        { type: 'item', itemId: 'forge_dust', quantity: 4 }
      ]
    };
  }
  if (rating >= 1025) {
    return {
      tier: 'silver_bell',
      rewards: [
        { type: 'currency', currency: 'eclipse_token', amount: 100 },
        { type: 'item', itemId: 'torn_chronicle_page', quantity: 4 }
      ]
    };
  }
  return {
    tier: 'iron_bell',
    rewards: [
      { type: 'currency', currency: 'eclipse_token', amount: 60 },
      { type: 'item', itemId: 'torn_chronicle_page', quantity: 2 }
    ]
  };
}

export async function getArenaState(db: D1Database, playerId: string, nowMs = Date.now(), scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const catalog = await operationCatalog(db, playerId, scope, new Date(nowMs));
  const stats = await loadProgressStats(db, playerId, nowMs, catalog);
  const season = arenaSeasonOf(nowMs);
  const win = windowOf(nowMs, 12);
  const [defRow, matchesRow, seasonClaimRow] = await Promise.all([
    db.prepare("SELECT claimed_at FROM player_tasks WHERE player_id = ?1 AND period_key = 'arena:defense' AND task_id = 'formation'").bind(playerId).first<{ claimed_at: string | null }>(),
    db.prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = ?2 AND task_id = 'arena:matches'").bind(playerId, win.key).first<{ progress: number }>(),
    db.prepare('SELECT claimed FROM player_tasks WHERE player_id = ?1 AND period_key = ?2 AND task_id = ?3').bind(playerId, `arena:season:${season.seasonId}`, 'settlement').first<{ claimed: number }>()
  ]);
  const defense = defRow?.claimed_at ? (JSON.parse(defRow.claimed_at) as unknown[]) : [];
  const tier = arenaTierRewards(stats.arenaRating);
  return {
    unlocked: stats.clearedBattles >= 1,
    season,
    rating: stats.arenaRating,
    wins: stats.arenaWins,
    tier: tier.tier,
    seasonRewards: tier.rewards,
    seasonClaimed: seasonClaimRow?.claimed === 1,
    dailyUsed: matchesRow?.progress ?? 0,
    dailyLimit: ARENA_DAILY_LIMIT,
    defense,
    opponents: SYNTHETIC_ARENA_OPPONENTS
  };
}

export async function setArenaDefense(db: D1Database, playerId: string, input: z.infer<typeof ArenaDefenseBody>, scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const kind = 'arena_defense';
  const first = await recordedOperation(db, playerId, kind, input);
  if (first) return first;
  if (input.releaseId !== scope?.releaseId) throw new HttpError(400, 'release_context_mismatch', 'arena defense release context differs');
  const seenChars = new Set<string>();
  const seenSlots = new Set<number>();
  for (const m of input.members) {
    if (seenChars.has(m.characterId)) throw new HttpError(422, 'duplicate_character', 'cannot place the same character twice in arena defense');
    if (seenSlots.has(m.slot)) throw new HttpError(422, 'duplicate_slot', 'cannot place two characters in the same slot');
    seenChars.add(m.characterId);
    seenSlots.add(m.slot);
  }
  const frontCount = input.members.filter((m) => m.row === 'front').length;
  const rearCount = input.members.filter((m) => m.row === 'rear').length;
  if (frontCount > 2 || rearCount > 3) {
    throw new HttpError(422, 'invalid_formation', 'formation allows at most 2 front-row and 3 rear-row members');
  }
  const owned = (
    await db
      .prepare(`SELECT item_id FROM player_items WHERE player_id = ?1 AND item_type = 'character' AND item_id IN (${[...seenChars].map(() => '?').join(',')})`)
      .bind(playerId, ...seenChars)
      .all<{ item_id: string }>()
  ).results;
  if (owned.length !== seenChars.size) {
    throw new HttpError(404, 'not_owned', 'all arena defense characters must be owned');
  }

  const result = {
    requestId: input.requestId,
    defense: input.members
  };

  await db.batch([
    db.prepare("INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (SELECT 1 FROM players WHERE id = ?1 AND status = 'active') THEN 1 ELSE 0 END)").bind(playerId),
    db
      .prepare(
        "INSERT INTO player_tasks (player_id, period_key, task_id, progress, target, claimed_at) VALUES (?1, 'arena:defense', 'formation', 1, 1, ?2) ON CONFLICT (player_id, period_key, task_id) DO UPDATE SET progress = progress + 1, claimed_at = ?2"
      )
      .bind(playerId, JSON.stringify(input.members)),
    operationStatement(db, playerId, kind, input, result),
    db.prepare('DELETE FROM tx_guard')
  ]);

  return { ...result, replayed: false };
}

async function loadPublishedUnitPack(env: Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>, releaseId: string): Promise<UnitPack> {
  const store = new ContentStore(env.DB, env.CONTENT);
  const rel = await store.getRelease(releaseId);
  if (!rel || rel.state !== 'published' || rel.channel !== env.CONTENT_CHANNEL) {
    throw new HttpError(404, 'unknown_release', 'release is not published on this channel');
  }
  const packBytes = await store.effectiveBytes(releaseId, 'units/unit_pack.json');
  if (!packBytes) throw new HttpError(404, 'unknown_encounter', 'release has no unit pack');
  return UnitPack.parse(JSON.parse(new TextDecoder().decode(packBytes)));
}

function buildSyntheticEncounter(pack: UnitPack, stageId: string, seed: number, enemyLevel: number, enemyCount = 2): Encounter {
  const enemyTemplates = pack.units.filter((u) => u.kind === 'enemy');
  const heroTemplates = pack.units.filter((u) => u.kind === 'character');
  const chosen = (enemyTemplates.length > 0 ? enemyTemplates : pack.units).slice(0, enemyCount);
  const safeId = stageId.replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 20);
  const fallbackHero = heroTemplates[0]?.unit_id ?? pack.units[0]!.unit_id;
  return Encounter.parse({
    schema_version: 1,
    encounter_id: safeId,
    stage_id: safeId,
    title_en: safeId,
    location_id: 'bell_tower',
    seed,
    party_mode: 'owned',
    party: [{ unit_id: fallbackHero, level: 1, slot: 0, row: 'front' }],
    guests: [],
    enemies: chosen.map((u, idx) => ({
      unit_id: u.unit_id,
      level: Math.max(1, enemyLevel),
      slot: idx,
      row: idx === 0 ? 'front' : 'rear'
    })),
    provenance: { source: 'runtime_synthetic' }
  });
}

async function resolveModeBattleParty(
  db: D1Database,
  playerId: string,
  encounter: Encounter,
  pack: UnitPack,
  catalog?: RuntimeCatalog
): Promise<BattleParty> {
  try {
    return await buildParty(db, playerId, encounter, new Set(pack.units.map((u) => u.unit_id)), undefined, pack.rules.story_loan_equipment, catalog);
  } catch (e) {
    if (e instanceof HttpError && e.code === 'no_team') {
      const heroTemplates = pack.units.filter((u) => u.kind === 'character');
      const fallback = (heroTemplates.length > 0 ? heroTemplates : pack.units).slice(0, 2);
      return BattleParty.parse(
        fallback.map((u, idx) => ({
          unit_id: u.unit_id,
          level: 1,
          slot: idx,
          row: idx === 0 ? 'front' : 'rear',
          loan: true
        }))
      );
    }
    throw e;
  }
}

export async function fightArenaMatch(env: Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>, playerId: string, input: z.infer<typeof ArenaMatchBody>, now = new Date()): Promise<Record<string, unknown>> {
  const db = env.DB;
  const kind = `arena_match:${input.opponentId}`;
  const first = await recordedOperation(db, playerId, kind, input);
  if (first) return first;

  const nowMs = now.getTime();
  await requireEconomic(db, env.CONTENT_CHANNEL, input.releaseId, playerId, '', now);
  const catalog = await loadReleaseCatalog(env, input.releaseId);
  const stats = await loadProgressStats(db, playerId, nowMs, catalog);
  if (stats.clearedBattles < 1) {
    throw new HttpError(403, 'mode_locked', 'clear at least one campaign battle stage before entering the Arena');
  }
  const opponent = SYNTHETIC_ARENA_OPPONENTS.find((o) => o.opponentId === input.opponentId);
  if (!opponent) throw new HttpError(404, 'unknown_opponent', 'no such arena opponent');

  const pack = await loadPublishedUnitPack(env, input.releaseId);
  const seed = (parseInt((await sha256Hex(`${playerId}:${input.requestId}`)).slice(0, 8), 16) >>> 0) || 1;
  const encounter = buildSyntheticEncounter(pack, `arena_${opponent.opponentId}`, seed, opponent.level, 1);
  const party = await resolveModeBattleParty(db, playerId, encounter, pack, catalog);

  const sim = input.actions
    ? await replayBattle(pack, encounter, input.actions, party)
    : await (async () => {
        const auto = playAuto(pack, encounter, party);
        return replayBattle(pack, encounter, auto.actions, party);
      })();
  if (!sim.valid || !sim.complete) {
    throw new HttpError(422, 'invalid_battle', sim.error ?? 'arena battle did not complete');
  }
  const won = sim.result?.winner === 'player';
  const season = arenaSeasonOf(nowMs);
  const win = windowOf(nowMs, 12);
  const ratingKey = `arena:rating:${season.seasonId}`;
  const winsKey = `arena:wins:${season.seasonId}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      const seen = await recordedOperation(db, playerId, kind, input);
      if (seen) return seen;
    }
    const [matchesRow, ratingRow, winsRow] = await Promise.all([
      db.prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = ?2 AND task_id = 'arena:matches'").bind(playerId, win.key).first<{ progress: number }>(),
      db.prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = ?2 AND task_id = 'elo'").bind(playerId, ratingKey).first<{ progress: number }>(),
      db.prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = ?2 AND task_id = 'wins'").bind(playerId, winsKey).first<{ progress: number }>()
    ]);
    const used = matchesRow?.progress ?? 0;
    if (used >= ARENA_DAILY_LIMIT) {
      throw new HttpError(409, 'arena_limit_reached', 'daily Arena match limit reached', { limit: ARENA_DAILY_LIMIT, used });
    }
    const oldRating = ratingRow?.progress ?? ARENA_BASE_RATING;
    const delta = won ? 25 : -10;
    const newRating = Math.max(800, oldRating + delta);
    const oldWins = winsRow?.progress ?? 0;
    const newWins = won ? oldWins + 1 : oldWins;
    const rewards: RewardAttachment[] = won
      ? [
          { type: 'item', itemId: 'torn_chronicle_page', quantity: 2 },
          { type: 'account_xp', amount: 25 }
        ]
      : [{ type: 'account_xp', amount: 10 }];

    const result = {
      ...(catalog ? { catalogSha256: catalog.sha256 } : {}),
      requestId: input.requestId,
      opponentId: opponent.opponentId,
      won,
      turns: sim.result?.turns ?? 1,
      logHash: sim.logHash,
      ratingBefore: oldRating,
      ratingAfter: newRating,
      ratingDelta: newRating - oldRating,
      dailyUsed: used + 1,
      dailyLimit: ARENA_DAILY_LIMIT,
      rewards
    };

    const grantStmts = await grantStatements(db, playerId, rewards, {
      keyPrefix: `arena:${playerId}:${input.requestId}`,
      reason: `arena_match:${opponent.opponentId}`,
      catalog
    });

    const batch: D1PreparedStatement[] = [
      economicStatement(db, env.CONTENT_CHANNEL, input.releaseId, playerId, '', now, undefined, true),
      ...(matchesRow
        ? [
            db
              .prepare("UPDATE player_tasks SET progress = progress + 1 WHERE player_id = ?1 AND period_key = ?2 AND task_id = 'arena:matches' AND progress = ?3 AND progress < ?4")
              .bind(playerId, win.key, used, ARENA_DAILY_LIMIT),
            db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)')
          ]
        : [
            db
              .prepare("INSERT INTO player_tasks (player_id, period_key, task_id, progress, target) VALUES (?1, ?2, 'arena:matches', 1, ?3)")
              .bind(playerId, win.key, ARENA_DAILY_LIMIT)
          ]),
      ...(ratingRow
        ? [
            db
              .prepare("UPDATE player_tasks SET progress = ?3 WHERE player_id = ?1 AND period_key = ?2 AND task_id = 'elo' AND progress = ?4")
              .bind(playerId, ratingKey, newRating, oldRating),
            db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)')
          ]
        : [
            db
              .prepare("INSERT INTO player_tasks (player_id, period_key, task_id, progress, target) VALUES (?1, ?2, 'elo', ?3, 5000)")
              .bind(playerId, ratingKey, newRating)
          ]),
      ...(won
        ? winsRow
          ? [
              db
                .prepare("UPDATE player_tasks SET progress = ?3 WHERE player_id = ?1 AND period_key = ?2 AND task_id = 'wins' AND progress = ?4")
                .bind(playerId, winsKey, newWins, oldWins),
              db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)')
            ]
          : [
              db
                .prepare("INSERT INTO player_tasks (player_id, period_key, task_id, progress, target) VALUES (?1, ?2, 'wins', 1, 1000)")
                .bind(playerId, winsKey)
            ]
        : []),
      ...grantStmts,
      operationStatement(db, playerId, kind, input, result),
      db.prepare('DELETE FROM tx_guard')
    ];

    try {
      await db.batch(batch);
      return { ...result, replayed: false };
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e);
      if (/CHECK constraint failed: ok = 1|UNIQUE constraint failed: (player_tasks|progression_requests|ledger)/i.test(msg)) {
        const prior = await recordedOperation(db, playerId, kind, input);
        if (prior) return prior;
        await requireEconomic(db, env.CONTENT_CHANNEL, input.releaseId, playerId, '', now);
        continue;
      }
      throw e;
    }
  }
  throw new HttpError(409, 'busy', 'concurrent arena match in progress, try again');
}

export async function claimArenaSeason(db: D1Database, playerId: string, input: z.infer<typeof ArenaSeasonClaimBody>, now = new Date(), scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const kind = `arena_season_claim:${input.seasonId}`;
  const first = await recordedOperation(db, playerId, kind, input);
  if (first) return first;
  if (input.releaseId !== scope?.releaseId) throw new HttpError(400, 'release_context_mismatch', 'arena season claim release context differs');

  const catalog = await operationCatalog(db, playerId, scope, now);
  const winsRow = await db
    .prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = ?2 AND task_id = 'wins'")
    .bind(playerId, `arena:wins:${input.seasonId}`)
    .first<{ progress: number }>();
  if (!winsRow || winsRow.progress < 1) {
    throw new HttpError(409, 'arena_season_ineligible', 'win at least one Arena match in this season before claiming season rewards');
  }
  const ratingRow = await db
    .prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = ?2 AND task_id = 'elo'")
    .bind(playerId, `arena:rating:${input.seasonId}`)
    .first<{ progress: number }>();
  const rating = ratingRow?.progress ?? ARENA_BASE_RATING;
  const tier = arenaTierRewards(rating);
  const periodKey = `arena:season:${input.seasonId}`;

  const existing = await db
    .prepare("SELECT claimed FROM player_tasks WHERE player_id = ?1 AND period_key = ?2 AND task_id = 'settlement'")
    .bind(playerId, periodKey)
    .first<{ claimed: number }>();
  if (existing?.claimed === 1) {
    const replay = await recordedOperation(db, playerId, kind, input);
    if (replay) return replay;
    throw new HttpError(409, 'already_claimed', 'season rewards already claimed');
  }

  const result = {
    ...(scope?.releaseId ? { releaseId: scope.releaseId } : {}),
    ...(catalog ? { catalogSha256: catalog.sha256 } : {}),
    requestId: input.requestId,
    seasonId: input.seasonId,
    rating,
    tier: tier.tier,
    rewards: tier.rewards
  };
  const grantStmts = await grantStatements(db, playerId, tier.rewards, {
    keyPrefix: `arena_season:${playerId}:${input.seasonId}`,
    reason: `arena_season:${input.seasonId}`,
    catalog
  });

  try {
    await db.batch([
      ...(scope?.releaseId ? [economicStatement(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', now, undefined, true)] : []),
      db.prepare("INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (SELECT 1 FROM players WHERE id = ?1 AND status = 'active') THEN 1 ELSE 0 END)").bind(playerId),
      db
        .prepare(
          "INSERT INTO player_tasks (player_id, period_key, task_id, progress, target, claimed, claimed_at) VALUES (?1, ?2, 'settlement', ?3, 1, 1, ?4) ON CONFLICT (player_id, period_key, task_id) DO UPDATE SET claimed = 1, claimed_at = ?4 WHERE claimed = 0"
        )
        .bind(playerId, periodKey, rating, now.toISOString()),
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
      ...grantStmts,
      operationStatement(db, playerId, kind, input, result),
      db.prepare('DELETE FROM tx_guard')
    ]);
  } catch (e) {
    const replay = await recordedOperation(db, playerId, kind, input);
    if (replay) return replay;
    if (scope?.releaseId) await requireEconomic(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', now);
    const msg = String(e instanceof Error ? e.message : e);
    if (/CHECK constraint failed: ok = 1|UNIQUE constraint failed: (player_tasks|ledger|progression_requests)/i.test(msg)) {
      throw new HttpError(409, 'already_claimed', 'season rewards already claimed');
    }
    throw e;
  }
  return { ...result, balance: await balanceOf(db, playerId, 'eclipse_token'), replayed: false };
}

/**
 * R12 Endless Corridor: frozen party snapshot, modifier selection, wave scaling, and milestone claims.
 */
const ENDLESS_MILESTONES: readonly { wave: number; rewards: RewardAttachment[] }[] = [
  {
    wave: 1,
    rewards: [
      { type: 'currency', currency: 'eclipse_token', amount: 50 },
      { type: 'item', itemId: 'torn_chronicle_page', quantity: 2 }
    ]
  },
  {
    wave: 3,
    rewards: [
      { type: 'currency', currency: 'eclipse_token', amount: 100 },
      { type: 'item', itemId: 'forge_dust', quantity: 4 }
    ]
  },
  {
    wave: 5,
    rewards: [
      { type: 'currency', currency: 'eclipse_token', amount: 150 },
      { type: 'item', itemId: 'iron_oath_seal', quantity: 2 }
    ]
  }
];

function applyEndlessModifierToParty(party: BattleParty, modifier: EndlessModifier): BattleParty {
  return party.map((m): PartyMember => {
    if (!m.stats) return m;
    if (modifier === 'blood_moon') {
      return { ...m, stats: { ...m.stats, atk: Math.floor(m.stats.atk * 1.15) } };
    }
    if (modifier === 'iron_ward') {
      return { ...m, stats: { ...m.stats, def: Math.floor(m.stats.def * 1.2), hp: Math.floor(m.stats.hp * 1.1) } };
    }
    return { ...m, stats: { ...m.stats, spd: m.stats.spd + 12 } };
  });
}

export async function getEndlessState(db: D1Database, playerId: string, nowMs = Date.now(), scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const catalog = await operationCatalog(db, playerId, scope, new Date(nowMs));
  const stats = await loadProgressStats(db, playerId, nowMs, catalog);
  const [activeRow, claimedRows] = await Promise.all([
    db.prepare("SELECT progress, claimed_at FROM player_tasks WHERE player_id = ?1 AND period_key = 'endless:run' AND task_id = 'active'").bind(playerId).first<{ progress: number; claimed_at: string | null }>(),
    db.prepare("SELECT task_id, claimed, claimed_at FROM player_tasks WHERE player_id = ?1 AND period_key = 'endless:milestone'").bind(playerId).all<{ task_id: string; claimed: number; claimed_at: string | null }>()
  ]);
  const activeMeta = activeRow?.claimed_at ? (JSON.parse(activeRow.claimed_at) as { sessionId: string; modifier: EndlessModifier; releaseId: string }) : null;
  const claimedMap = new Map(claimedRows.results.map((r) => [r.task_id, r]));
  return {
    unlocked: stats.clearedBattles >= 1,
    bestWave: stats.endlessBestWave,
    activeRun: activeMeta ? { wave: activeRow!.progress, ...activeMeta } : null,
    availableModifiers: EndlessModifiers.map((m) => ({
      id: m,
      description:
        m === 'blood_moon'
          ? 'Allied ATK +15%'
          : m === 'iron_ward'
            ? 'Allied DEF +20%, HP +10%'
            : 'Allied SPD +12'
    })),
    milestones: ENDLESS_MILESTONES.map((ms) => {
      const c = claimedMap.get(`wave_${ms.wave}`);
      return {
        wave: ms.wave,
        ready: stats.endlessBestWave >= ms.wave,
        claimed: c?.claimed === 1,
        claimedAt: c?.claimed_at ?? null,
        rewards: ms.rewards
      };
    })
  };
}

export async function startEndlessRun(env: Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>, playerId: string, input: z.infer<typeof EndlessStartBody>, now = new Date()): Promise<Record<string, unknown>> {
  const db = env.DB;
  const kind = 'endless_start';
  const first = await recordedOperation(db, playerId, kind, input);
  if (first) return first;

  const nowMs = now.getTime();
  await requireEconomic(db, env.CONTENT_CHANNEL, input.releaseId, playerId, '', now);
  const catalog = await loadReleaseCatalog(env, input.releaseId);
  const stats = await loadProgressStats(db, playerId, nowMs, catalog);
  if (stats.clearedBattles < 1) {
    throw new HttpError(403, 'mode_locked', 'clear at least one campaign battle stage before entering the Endless Corridor');
  }
  const pack = await loadPublishedUnitPack(env, input.releaseId);
  const encounter = buildSyntheticEncounter(pack, `endless_${input.modifier}_w1`, 101, 1, 1);
  const rawParty = await resolveModeBattleParty(db, playerId, encounter, pack, catalog);
  const party = applyEndlessModifierToParty(rawParty, input.modifier);

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const sessionId = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = new Date(nowMs + BATTLE_SESSION_TTL_MS).toISOString();
  const nodeId = `endless:${input.modifier}:1`;
  const runMeta = { sessionId, modifier: input.modifier, releaseId: input.releaseId };

  const result = {
    ...(catalog ? { catalogSha256: catalog.sha256 } : {}),
    requestId: input.requestId,
    sessionId,
    wave: 1,
    modifier: input.modifier,
    party,
    expiresAt
  };

  await db.batch([
    economicStatement(db, env.CONTENT_CHANNEL, input.releaseId, playerId, '', now, undefined, true),
    db.prepare('INSERT INTO battle_sessions (id, player_id, release_id, node_id, party_json, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)').bind(sessionId, playerId, input.releaseId, nodeId, JSON.stringify(party), now.toISOString(), expiresAt),
    db
      .prepare(
        "INSERT INTO player_tasks (player_id, period_key, task_id, progress, target, claimed_at) VALUES (?1, 'endless:run', 'active', 1, 100, ?2) ON CONFLICT (player_id, period_key, task_id) DO UPDATE SET progress = 1, claimed_at = ?2"
      )
      .bind(playerId, JSON.stringify(runMeta)),
    operationStatement(db, playerId, kind, input, result),
    db.prepare('DELETE FROM tx_guard')
  ]);

  return { ...result, replayed: false };
}

export async function submitEndlessWave(env: Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>, playerId: string, input: z.infer<typeof EndlessWaveBody>, now = new Date()): Promise<Record<string, unknown>> {
  const db = env.DB;
  const kind = `endless_wave:${input.sessionId}`;
  const first = await recordedOperation(db, playerId, kind, input);
  if (first) return first;

  const nowMs = now.getTime();
  await requireEconomic(db, env.CONTENT_CHANNEL, input.releaseId, playerId, '', now, input.sessionId);
  const catalog = await loadReleaseCatalog(env, input.releaseId);

  const sess = await db
    .prepare('SELECT id, release_id, node_id, party_json, expires_at, consumed_at FROM battle_sessions WHERE id = ?1 AND player_id = ?2')
    .bind(input.sessionId, playerId)
    .first<{ id: string; release_id: string; node_id: string; party_json: string; expires_at: string; consumed_at: string | null }>();
  if (!sess || sess.release_id !== input.releaseId || !sess.node_id.startsWith('endless:')) {
    throw new HttpError(404, 'unknown_session', 'no such endless run session');
  }
  if (sess.consumed_at) throw new HttpError(409, 'session_used', 'this endless wave session was already submitted');
  if (Date.parse(sess.expires_at) <= nowMs) throw new HttpError(409, 'session_expired', 'this endless run session expired; start a new run');

  const [, rawModifier, rawWave] = sess.node_id.split(':');
  const modifier = (EndlessModifiers.includes(rawModifier as EndlessModifier) ? rawModifier : 'blood_moon') as EndlessModifier;
  const wave = Math.max(1, Number(rawWave) || 1);
  const party = BattleParty.parse(JSON.parse(sess.party_json));
  const pack = await loadPublishedUnitPack(env, input.releaseId);
  const enemyLevel = Math.max(1, Math.min(20, Math.ceil(wave / 2)));
  const encounter = buildSyntheticEncounter(pack, `endless_${modifier}_w${wave}`, 100 + wave, enemyLevel, 1);

  const sim = input.actions
    ? await replayBattle(pack, encounter, input.actions, party)
    : await (async () => {
        const auto = playAuto(pack, encounter, party);
        return replayBattle(pack, encounter, auto.actions, party);
      })();
  if (!sim.valid || !sim.complete || sim.result?.winner !== 'player') {
    throw new HttpError(422, 'wave_not_won', sim.error ?? 'the endless wave was not won');
  }

  const nextBytes = new Uint8Array(16);
  crypto.getRandomValues(nextBytes);
  const nextSessionId = [...nextBytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const nextWave = wave + 1;
  const nextExpiresAt = new Date(nowMs + BATTLE_SESSION_TTL_MS).toISOString();
  const nextNodeId = `endless:${modifier}:${nextWave}`;
  const rewards: RewardAttachment[] = [
    { type: 'item', itemId: 'torn_chronicle_page', quantity: 1 + Math.floor(wave / 2) },
    { type: 'account_xp', amount: 15 * wave }
  ];

  const bestRow = await db
    .prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = 'endless:best' AND task_id = 'wave'")
    .bind(playerId)
    .first<{ progress: number }>();
  const bestWave = Math.max(bestRow?.progress ?? 0, wave);

  const result = {
    ...(catalog ? { catalogSha256: catalog.sha256 } : {}),
    requestId: input.requestId,
    clearedWave: wave,
    bestWave,
    modifier,
    turns: sim.result.turns,
    logHash: sim.logHash,
    nextWave,
    nextSessionId,
    nextExpiresAt,
    rewards
  };

  const grantStmts = await grantStatements(db, playerId, rewards, {
    keyPrefix: `endless_wave:${playerId}:${input.requestId}`,
    reason: `endless_wave:${wave}`,
    catalog
  });

  await db.batch([
    economicStatement(db, env.CONTENT_CHANNEL, input.releaseId, playerId, '', now, input.sessionId, true),
    db
      .prepare('UPDATE battle_sessions SET consumed_at = ?2 WHERE id = ?1 AND consumed_at IS NULL')
      .bind(sess.id, now.toISOString()),
    db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
    db
      .prepare('INSERT INTO battle_sessions (id, player_id, release_id, node_id, party_json, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
      .bind(nextSessionId, playerId, input.releaseId, nextNodeId, sess.party_json, now.toISOString(), nextExpiresAt),
    db
      .prepare(
        "INSERT INTO player_tasks (player_id, period_key, task_id, progress, target, claimed_at) VALUES (?1, 'endless:run', 'active', ?2, 100, ?3) ON CONFLICT (player_id, period_key, task_id) DO UPDATE SET progress = ?2, claimed_at = ?3"
      )
      .bind(playerId, nextWave, JSON.stringify({ sessionId: nextSessionId, modifier, releaseId: input.releaseId })),
    db
      .prepare(
        "INSERT INTO player_tasks (player_id, period_key, task_id, progress, target) VALUES (?1, 'endless:best', 'wave', ?2, 100) ON CONFLICT (player_id, period_key, task_id) DO UPDATE SET progress = MAX(progress, ?2)"
      )
      .bind(playerId, wave),
    ...grantStmts,
    operationStatement(db, playerId, kind, input, result),
    db.prepare('DELETE FROM tx_guard')
  ]);

  return { ...result, replayed: false };
}

export async function claimEndlessMilestone(db: D1Database, playerId: string, input: z.infer<typeof EndlessMilestoneClaimBody>, now = new Date(), scope?: ReleaseScope): Promise<Record<string, unknown>> {
  const kind = `endless_milestone:${input.wave}`;
  const first = await recordedOperation(db, playerId, kind, input);
  if (first) return first;
  if (input.releaseId !== scope?.releaseId) throw new HttpError(400, 'release_context_mismatch', 'endless milestone release context differs');
  const ms = ENDLESS_MILESTONES.find((m) => m.wave === input.wave);
  if (!ms) throw new HttpError(404, 'unknown_milestone', 'no such endless wave milestone');

  const catalog = await operationCatalog(db, playerId, scope, now);
  const bestRow = await db
    .prepare("SELECT progress FROM player_tasks WHERE player_id = ?1 AND period_key = 'endless:best' AND task_id = 'wave'")
    .bind(playerId)
    .first<{ progress: number }>();
  const bestWave = bestRow?.progress ?? 0;
  if (bestWave < ms.wave) {
    throw new HttpError(409, 'milestone_not_reached', `clear Endless Wave ${ms.wave} first`, { bestWave, requiredWave: ms.wave });
  }
  const taskId = `wave_${ms.wave}`;
  const existing = await db
    .prepare("SELECT claimed FROM player_tasks WHERE player_id = ?1 AND period_key = 'endless:milestone' AND task_id = ?2")
    .bind(playerId, taskId)
    .first<{ claimed: number }>();
  if (existing?.claimed === 1) {
    const replay = await recordedOperation(db, playerId, kind, input);
    if (replay) return replay;
    throw new HttpError(409, 'already_claimed', 'endless milestone already claimed');
  }

  const result = {
    ...(scope?.releaseId ? { releaseId: scope.releaseId } : {}),
    ...(catalog ? { catalogSha256: catalog.sha256 } : {}),
    requestId: input.requestId,
    wave: ms.wave,
    rewards: ms.rewards
  };
  const grantStmts = await grantStatements(db, playerId, ms.rewards, {
    keyPrefix: `endless_ms:${playerId}:${ms.wave}`,
    reason: `endless_milestone:${ms.wave}`,
    catalog
  });

  try {
    await db.batch([
      ...(scope?.releaseId ? [economicStatement(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', now, undefined, true)] : []),
      db.prepare("INSERT INTO tx_guard (ok) VALUES (CASE WHEN EXISTS (SELECT 1 FROM players WHERE id = ?1 AND status = 'active') THEN 1 ELSE 0 END)").bind(playerId),
      db
        .prepare(
          "INSERT INTO player_tasks (player_id, period_key, task_id, progress, target, claimed, claimed_at) VALUES (?1, 'endless:milestone', ?2, ?3, ?3, 1, ?4) ON CONFLICT (player_id, period_key, task_id) DO UPDATE SET claimed = 1, claimed_at = ?4 WHERE claimed = 0"
        )
        .bind(playerId, taskId, ms.wave, now.toISOString()),
      db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
      ...grantStmts,
      operationStatement(db, playerId, kind, input, result),
      db.prepare('DELETE FROM tx_guard')
    ]);
  } catch (e) {
    const replay = await recordedOperation(db, playerId, kind, input);
    if (replay) return replay;
    if (scope?.releaseId) await requireEconomic(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', now);
    const msg = String(e instanceof Error ? e.message : e);
    if (/CHECK constraint failed: ok = 1|UNIQUE constraint failed: (player_tasks|ledger|progression_requests)/i.test(msg)) {
      throw new HttpError(409, 'already_claimed', 'endless milestone already claimed');
    }
    throw e;
  }
  return { ...result, balance: await balanceOf(db, playerId, 'eclipse_token'), replayed: false };
}
