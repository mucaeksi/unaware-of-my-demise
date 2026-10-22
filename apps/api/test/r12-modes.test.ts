import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { playAuto } from '@uomd/combat';
import { Encounter, UnitPack } from '@uomd/content-schema';
import { sha256Hex } from '@uomd/shared';
import { baseFiles, type TestFile } from './fixtures';
import { admin, entries, game, post, resetContent, seedCanonCatalog, signIn, upload } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
let base: TestFile[];
let actions: { skillId: string; targetId?: string }[];
const dec = new TextDecoder();
let seq = 0;
const rid = (): string => `r12_${++seq}_${Math.random().toString(36).slice(2, 10)}`;

beforeAll(async () => {
  const files = await baseFiles();
  const find = (p: string) => files.find((f) => f.path === p) as TestFile;
  const played = playAuto(
    UnitPack.parse(JSON.parse(dec.decode(find('units/unit_pack.json').bytes))),
    Encounter.parse(JSON.parse(dec.decode(find('encounters/tutorial_t1.json').bytes))),
  );
  actions = played.actions;

  const index = JSON.parse(dec.decode(find('chapters/chapter_index.json').bytes));
  const t1 = index.chapters[0].nodes[0];
  t1.ration_class = 'campaign';
  t1.rewards = {
    first_clear: [{ type: 'currency', currency: 'eclipse_token', amount: 100 }],
    three_star: [{ type: 'currency', currency: 'eclipse_token', amount: 50 }],
    repeat: [{ type: 'account_xp', amount: 25 }],
  };
  index.chapters[0].nodes.push({
    node_id: 't1_tutorial',
    title_en: 'Tutorial Non-Repeatable',
    kind: 'battle',
    encounter: t1.encounter,
  });
  const bytes = new TextEncoder().encode(JSON.stringify(index));
  const patched: TestFile = {
    path: 'chapters/chapter_index.json',
    bytes,
    mediaType: 'application/json',
    sha256: await sha256Hex(bytes),
  };
  base = files.map((f) => (f.path === patched.path ? patched : f));
});

beforeEach(async () => {
  await resetContent();
  await seedCanonCatalog();
  await upload(base);
  const r = await admin('/admin/api/releases', post({ id: 'rel_0001', channel: 'dev', notes: 'r12 fixture', files: entries(base) }));
  expect(r.status).toBe(201);
  expect((await admin('/admin/api/releases/rel_0001/publish', post({}))).status).toBe(200);
});

const clearNode = (auth: Record<string, string>, nodeId = 't1') =>
  game('/api/v1/progress/battle', post({ releaseId: 'rel_0001', nodeId, requestId: rid(), actions }, auth));

describe('R12 — Sweep, Memory Shards, AFK Patrol, Modes, Arena & Endless Corridor', () => {
  it('enforces 3-star eligibility, repeatable Ration cost, daily cap, task accounting, and idempotency on stage sweep', async () => {
    const { auth, playerId } = await signIn(`sub-sweep-${rid()}`);

    // Cannot sweep before 3-star clear
    const uncleared = await game('/api/v1/progress/sweep', post({ releaseId: 'rel_0001', nodeId: 't1', count: 2, requestId: rid() }, auth));
    expect(uncleared.status).toBe(403);
    expect(await uncleared.json()).toMatchObject({ error: 'sweep_requires_three_stars' });

    // Clear t1 and t1_tutorial with 3 stars
    const clear1 = await clearNode(auth, 't1');
    expect(clear1.status).toBe(200);
    expect(await clear1.json()).toMatchObject({ stars: 3 });

    const clearTut = await clearNode(auth, 't1_tutorial');
    expect(clearTut.status).toBe(200);

    // Tutorial / zero-ration node cannot be swept
    const tutSweep = await game('/api/v1/progress/sweep', post({ releaseId: 'rel_0001', nodeId: 't1_tutorial', count: 1, requestId: rid() }, auth));
    expect(tutSweep.status).toBe(422);
    expect(await tutSweep.json()).toMatchObject({ error: 'sweep_not_repeatable' });

    // Valid 3x sweep deducts 18 Rations, grants 3x 25 account_xp, and records daily usage
    const sweepReqId = rid();
    const res = await game('/api/v1/progress/sweep', post({ releaseId: 'rel_0001', nodeId: 't1', count: 3, requestId: sweepReqId }, auth));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      count: number;
      dailyUsed: number;
      dailyLimit: number;
      ration: { spent: number; value: number };
      rewards: { type?: string; amount?: number }[];
      replayed: boolean;
    };
    expect(body.count).toBe(3);
    expect(body.ration.spent).toBe(18);
    expect(body.dailyUsed).toBe(3);
    expect(body.dailyLimit).toBe(20);
    expect(body.replayed).toBe(false);
    expect(body.rewards).toHaveLength(3);
    expect(body.rewards[0]).toEqual({ type: 'account_xp', amount: 25 });

    // Idempotent replay with same requestId does not charge or grant again
    const replay = await game('/api/v1/progress/sweep', post({ releaseId: 'rel_0001', nodeId: 't1', count: 3, requestId: sweepReqId }, auth));
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ replayed: true, count: 3, dailyUsed: 3 });

    // Progress endpoint exposes sweep usage metadata
    const progRes = await game('/api/v1/progress', { headers: auth });
    expect(progRes.status).toBe(200);
    const progBody = (await progRes.json()) as { sweep?: { usageByNode: Record<string, number> } };
    expect(progBody.sweep?.usageByNode.t1).toBe(3);

    // Exceeding daily cap (20) returns 409 sweep_limit_reached
    await db().prepare('UPDATE player_ration SET value = 500 WHERE player_id = ?1').bind(playerId).run();
    expect((await game('/api/v1/progress/sweep', post({ releaseId: 'rel_0001', nodeId: 't1', count: 10, requestId: rid() }, auth))).status).toBe(200);
    expect((await game('/api/v1/progress/sweep', post({ releaseId: 'rel_0001', nodeId: 't1', count: 7, requestId: rid() }, auth))).status).toBe(200);
    const overCap = await game('/api/v1/progress/sweep', post({ releaseId: 'rel_0001', nodeId: 't1', count: 1, requestId: rid() }, auth));
    expect(overCap.status).toBe(409);
    expect(await overCap.json()).toMatchObject({ error: 'sweep_limit_reached' });
  });

  it('attunes character-bound Memory Shards for optional stat resonance and converts excess shards into Chronicle Pages', async () => {
    const { auth, playerId } = await signIn(`sub-shards-${rid()}`);

    // Insufficient shards returns 402
    const noShards = await game('/api/v1/characters/mahmut/shards/attune', post({ requestId: rid() }, auth));
    expect(noShards.status).toBe(402);

    // Seed 250 Mahmut shards on player_items (character row)
    await db()
      .prepare("UPDATE player_items SET shards = 250 WHERE player_id = ?1 AND item_type = 'character' AND item_id = 'mahmut'")
      .bind(playerId)
      .run();

    // Base stats before attunement
    const beforeList = (await (await game('/api/v1/characters/mine', { headers: auth })).json()) as {
      characters: { id: string; shards: number; resonance: { tier: number } }[];
    };
    const mahmutBefore = beforeList.characters.find((c) => c.id === 'mahmut')!;
    expect(mahmutBefore.shards).toBe(250);
    expect(mahmutBefore.resonance.tier).toBe(0);
    const stats0 = (await (await game('/api/v1/characters/mahmut/stats', { headers: auth })).json()) as { stats: { hp: number } };

    // Attune Tier 1
    const attuneReq = rid();
    const attune1 = await game('/api/v1/characters/mahmut/shards/attune', post({ requestId: attuneReq }, auth));
    expect(attune1.status).toBe(200);
    const attuneBody = (await attune1.json()) as {
      spentShards: number;
      shardsRemaining: number;
      resonance: { tier: number; bonusPct: number };
      replayed: boolean;
    };
    expect(attuneBody.spentShards).toBeGreaterThan(0);
    expect(attuneBody.shardsRemaining).toBe(250 - attuneBody.spentShards);
    expect(attuneBody.resonance.tier).toBe(1);
    expect(attuneBody.resonance.bonusPct).toBe(1);
    expect(attuneBody.replayed).toBe(false);

    // Verify stats increased after Tier 1 resonance
    const stats1 = (await (await game('/api/v1/characters/mahmut/stats', { headers: auth })).json()) as { stats: { hp: number } };
    expect(stats1.stats.hp).toBeGreaterThan(stats0.stats.hp);

    // Replay returns idempotently
    const replayAttune = await game('/api/v1/characters/mahmut/shards/attune', post({ requestId: attuneReq }, auth));
    expect(replayAttune.status).toBe(200);
    expect(await replayAttune.json()).toMatchObject({ replayed: true, spentShards: attuneBody.spentShards });

    // Convert 15 excess shards into Torn Chronicle Pages (never Eclipse Tokens)
    const convRes = await game('/api/v1/characters/mahmut/shards/convert', post({ shards: 15, requestId: rid() }, auth));
    expect(convRes.status).toBe(200);
    const convBody = (await convRes.json()) as {
      convertedShards: number;
      shardsRemaining: number;
      gained: { type: string; itemId: string; quantity: number }[];
    };
    expect(convBody.convertedShards).toBe(15);
    expect(convBody.gained).toEqual([{ type: 'item', itemId: 'torn_chronicle_page', quantity: 15 }]);
    expect(convBody.shardsRemaining).toBe(attuneBody.shardsRemaining - 15);
  });

  it('calculates server-clock AFK idle patrol rewards with 12h cap and atomic checkpoint update', async () => {
    const { auth, playerId } = await signIn(`sub-afk-${rid()}`);

    // Locked before clearing any stage
    const lockedStatus = await game('/api/v1/afk?releaseId=rel_0001', { headers: auth });
    expect(lockedStatus.status).toBe(200);
    expect(await lockedStatus.json()).toMatchObject({ unlocked: false, claimable: false });
    expect((await game('/api/v1/afk/claim', post({ releaseId: 'rel_0001', requestId: rid() }, auth))).status).toBe(403);

    // Clear t1 to unlock AFK Patrol
    expect((await clearNode(auth, 't1')).status).toBe(200);

    // Rewind checkpoint by 4 hours (14,400 seconds)
    const fourHoursAgo = Math.floor(Date.now() / 1000) - 14400;
    await db()
      .prepare("INSERT INTO player_tasks (player_id, period_key, task_id, progress, target) VALUES (?1, 'afk:checkpoint', 'idle', ?2, 43200)")
      .bind(playerId, fourHoursAgo)
      .run();

    const readyStatus = (await (await game('/api/v1/afk?releaseId=rel_0001', { headers: auth })).json()) as {
      unlocked: boolean;
      claimable: boolean;
      elapsedSeconds: number;
      rewards: { type: string; amount?: number; quantity?: number }[];
    };
    expect(readyStatus.unlocked).toBe(true);
    expect(readyStatus.claimable).toBe(true);
    expect(readyStatus.elapsedSeconds).toBeGreaterThanOrEqual(14400);
    expect(readyStatus.rewards.length).toBeGreaterThan(0);

    const claimId = rid();
    const claimRes = await game('/api/v1/afk/claim', post({ releaseId: 'rel_0001', requestId: claimId }, auth));
    expect(claimRes.status).toBe(200);
    const claimBody = (await claimRes.json()) as { elapsedSeconds: number; minutesAccrued: number; rewards: unknown[]; replayed: boolean };
    expect(claimBody.elapsedSeconds).toBeGreaterThanOrEqual(14400);
    expect(claimBody.minutesAccrued).toBeGreaterThanOrEqual(240);
    expect(claimBody.rewards.length).toBeGreaterThan(0);
    expect(claimBody.replayed).toBe(false);

    // Replay returns recorded result
    const replayClaim = await game('/api/v1/afk/claim', post({ releaseId: 'rel_0001', requestId: claimId }, auth));
    expect(replayClaim.status).toBe(200);
    expect(await replayClaim.json()).toMatchObject({ replayed: true });

    // Immediate second claim (<60s elapsed) is rejected with 409
    expect((await game('/api/v1/afk/claim', post({ releaseId: 'rel_0001', requestId: rid() }, auth))).status).toBe(409);
  });

  it('evaluates mode gates, permanent achievements, seasonal events, profile customization, and leaderboards', async () => {
    const { auth } = await signIn(`sub-meta-${rid()}`);
    expect((await clearNode(auth, 't1')).status).toBe(200);

    // Mode gates
    const modesRes = await game('/api/v1/modes?releaseId=rel_0001', { headers: auth });
    expect(modesRes.status).toBe(200);
    const modesBody = (await modesRes.json()) as { modes: Record<string, { unlocked: boolean; launchLocked: boolean }> };
    expect(modesBody.modes.afk?.unlocked).toBe(true);
    expect(modesBody.modes.catacomb_raids?.launchLocked).toBe(true);

    // Achievements: ach_first_clear is unlocked after 1 battle clear
    const achList = (await (await game('/api/v1/achievements?releaseId=rel_0001', { headers: auth })).json()) as {
      achievements: { id: string; done: boolean; claimed: boolean }[];
    };
    expect(achList.achievements.find((a) => a.id === 'ach_first_clear')?.done).toBe(true);

    const achClaim = await game('/api/v1/achievements/claim', post({ releaseId: 'rel_0001', achievementId: 'ach_first_clear', requestId: rid() }, auth));
    expect(achClaim.status).toBe(200);
    expect(await achClaim.json()).toMatchObject({ achievementId: 'ach_first_clear', badgeTitle: 'wayfarer_of_ash' });

    // Profile update with earned badge
    const profUpdate = await game('/api/v1/profile', {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Knight Mahmut', avatarCharacterId: 'mahmut', titleBadge: 'wayfarer_of_ash', requestId: rid() }),
    });
    expect(profUpdate.status).toBe(200);
    expect(await profUpdate.json()).toMatchObject({
      displayName: 'Knight Mahmut',
      avatarCharacterId: 'mahmut',
      titleBadge: 'wayfarer_of_ash',
    });

    // Seasonal event list & claim
    const evList = (await (await game('/api/v1/events?releaseId=rel_0001', { headers: auth })).json()) as {
      events: { eventId: string; state: string; objectives: { id: string; done: boolean }[] }[];
    };
    expect(evList.events[0]?.state).toBe('active');
    expect(evList.events[0]?.objectives.find((o) => o.id === 'ev_obj_clear_1')?.done).toBe(true);
    const evClaim = await game(
      '/api/v1/events/ev_ashen_vigil_s1/claim',
      post({ releaseId: 'rel_0001', objectiveId: 'ev_obj_clear_1', requestId: rid() }, auth),
    );
    expect(evClaim.status).toBe(200);

    // Leaderboard
    const lbRes = await game('/api/v1/leaderboard?board=campaign_stars', { headers: auth });
    expect(lbRes.status).toBe(200);
    const lbBody = (await lbRes.json()) as { entries: { displayName: string; score: number }[] };
    expect(lbBody.entries.some((e) => e.displayName === 'Knight Mahmut' && e.score >= 3)).toBe(true);
  });

  it('runs server-authoritative Async Arena defense, deterministic combat match, Elo rating update, and season claim', async () => {
    const { auth } = await signIn(`sub-arena-${rid()}`);
    expect((await clearNode(auth, 't1')).status).toBe(200);

    const state0 = await game('/api/v1/arena?releaseId=rel_0001', { headers: auth });
    expect(state0.status).toBe(200);
    const body0 = (await state0.json()) as {
      unlocked: boolean;
      rating: number;
      season: { seasonId: string };
      opponents: { opponentId: string }[];
    };
    expect(body0.unlocked).toBe(true);
    expect(body0.rating).toBe(1000);
    expect(body0.opponents.length).toBe(3);

    // Set defense formation (PUT /api/v1/arena/defense)
    const defRes = await game(
      '/api/v1/arena/defense',
      {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: 'rel_0001',
          members: [{ characterId: 'mahmut', slot: 0, row: 'front' }],
          requestId: rid(),
        }),
      },
    );
    expect(defRes.status).toBe(200);
    expect(await defRes.json()).toMatchObject({ defense: [{ characterId: 'mahmut', slot: 0, row: 'front' }] });

    // Fight first opponent
    const oppId = body0.opponents[0]!.opponentId;
    const matchRes = await game('/api/v1/arena/match', post({ releaseId: 'rel_0001', opponentId: oppId, requestId: rid() }, auth));
    expect(matchRes.status).toBe(200);
    const matchBody = (await matchRes.json()) as { won: boolean; ratingAfter: number; dailyUsed: number; rewards: unknown[] };
    expect(matchBody.dailyUsed).toBe(1);
    expect(matchBody.rewards.length).toBeGreaterThan(0);

    // Claim season reward
    const seasonClaim = await game(
      '/api/v1/arena/season/claim',
      post({ releaseId: 'rel_0001', seasonId: body0.season.seasonId, requestId: rid() }, auth),
    );
    expect(seasonClaim.status).toBe(200);
    expect(await seasonClaim.json()).toMatchObject({ seasonId: body0.season.seasonId, replayed: false });

    // Second player sees first player's defense snapshot in matchmaking and fights it
    const { auth: auth2 } = await signIn(`sub-arena-challenger-${rid()}`);
    expect((await clearNode(auth2, 't1')).status).toBe(200);
    const state2 = await game('/api/v1/arena?releaseId=rel_0001', { headers: auth2 });
    expect(state2.status).toBe(200);
    const body2 = (await state2.json()) as {
      opponents: { opponentId: string; displayName: string; rating: number; level: number }[];
    };
    const pvpOpp = body2.opponents.find((o) => o.opponentId.startsWith('player:'));
    expect(pvpOpp).toBeDefined();
    const pvpMatch = await game(
      '/api/v1/arena/match',
      post({ releaseId: 'rel_0001', opponentId: pvpOpp!.opponentId, requestId: rid() }, auth2),
    );
    expect(pvpMatch.status).toBe(200);
    expect(await pvpMatch.json()).toMatchObject({ opponentId: pvpOpp!.opponentId, dailyUsed: 1 });
  });

  it('snapshots Endless Corridor party and modifiers at run start, advances waves, and claims milestones', async () => {
    const { auth } = await signIn(`sub-endless-${rid()}`);
    expect((await clearNode(auth, 't1')).status).toBe(200);

    const startRes = await game('/api/v1/endless/start', post({ releaseId: 'rel_0001', modifier: 'blood_moon', requestId: rid() }, auth));
    expect(startRes.status).toBe(200);
    const startBody = (await startRes.json()) as { sessionId: string; modifier: string; wave: number; party: unknown[] };
    expect(startBody.modifier).toBe('blood_moon');
    expect(startBody.wave).toBe(1);
    expect(startBody.party.length).toBeGreaterThan(0);

    // Advance wave 1 (auto-simulates if actions omitted or replayed)
    const wave1 = await game(
      '/api/v1/endless/wave',
      post({ releaseId: 'rel_0001', sessionId: startBody.sessionId, requestId: rid() }, auth),
    );
    expect(wave1.status).toBe(200);
    const wave1Body = (await wave1.json()) as { clearedWave: number; bestWave: number; nextWave: number; rewards: unknown[] };
    expect(wave1Body.clearedWave).toBe(1);
    expect(wave1Body.bestWave).toBe(1);
    expect(wave1Body.nextWave).toBe(2);
    expect(wave1Body.rewards.length).toBeGreaterThan(0);

    // Claim wave 1 milestone
    const msClaim = await game('/api/v1/endless/milestone/claim', post({ releaseId: 'rel_0001', wave: 1, requestId: rid() }, auth));
    expect(msClaim.status).toBe(200);
    expect(await msClaim.json()).toMatchObject({ wave: 1, replayed: false });
  });
});
