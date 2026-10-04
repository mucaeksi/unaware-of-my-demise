import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { engineSimulate, type SimulatedBattle, type Simulate, type StoredAttempt } from "../src/stages";
import type { IdentityVerifier } from "../src/identity";
import { loadFixture } from "./engine/fixtures";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
let counter = 0;

const verifier: IdentityVerifier = {
  verify: async (credential) => {
    const [subject, nonce] = credential.split("|");
    return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
  },
};

/** The engine stand-in: every attempt it is shown is recorded and answered with `verdict`. */
let verdict: SimulatedBattle = { outcome: "victory", stars: 3, actions: 20, cycles: 3 };
const simulated: StoredAttempt[] = [];
const simulate: Simulate = (attempt) => {
  simulated.push(attempt);
  return verdict;
};
/** 2026-10-07T10:00:00Z, a Wednesday morning: half-day cycle 41466, week 2961, segment cycle_a. */
const NOW = 1791367200;
let withEngine = true;
const app = () => createApp({ connect: () => database.connect(), verifier, simulate: withEngine ? simulate : null, nowUnix: () => NOW });

beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database?.close();
});

async function newPlayer(): Promise<{ token: string; accountId: string }> {
  const issued = (await (await app()(new Request("https://api.test/v1/auth/nonce", { method: "POST" }))).json()) as { nonce: string };
  const response = await app()(
    new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: `stage-player-${++counter}|${issued.nonce}` }) }),
  );
  const body = (await response.json()) as { session_token: string; account_id: string };
  return { token: body.session_token, accountId: body.account_id };
}

async function post(token: string, path: string, body?: unknown, key: string = crypto.randomUUID()) {
  const response = await app()(
    new Request(`https://api.test${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "idempotency-key": key },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

/** Puts the account at the default-walk state the rosters fixture recorded for `stageId`. */
async function atStage(accountId: string, stageId: string): Promise<void> {
  const fixture = loadFixture<{ cases: { stage_id: string; state: unknown }[] }>("rosters");
  const state = fixture.cases.find((entry) => entry.stage_id === stageId)!.state;
  await database.pool.query("UPDATE story_state SET state = $2 WHERE account_id = $1", [accountId, JSON.stringify(state)]);
}

async function attempts(accountId: string) {
  const { rows } = await database.pool.query(
    "SELECT attempt_id, stage_id, roster, run_seed, inputs, status FROM stage_attempts WHERE account_id = $1 ORDER BY created_at",
    [accountId],
  );
  return rows;
}

describe("POST /v1/stages/{stage_id}/attempts", () => {
  it("opens an attempt at the current stage with a server-chosen seed", async () => {
    const { token, accountId } = await newPlayer();
    expect((await post(token, "/v1/stages/1-1/attempts", { roster: [] })).status, "the opening scene comes first").toBe(409);
    expect((await post(token, "/v1/story/advance")).status).toBe(200);
    const { status, body } = await post(token, "/v1/stages/1-1/attempts", { roster: [] });
    expect(status).toBe(200);
    expect(body.attempt.stage_id).toBe("1-1");
    expect(Number.isSafeInteger(body.attempt.run_seed) && body.attempt.run_seed >= 0).toBe(true);
    expect(body.state.story_state.story_cursor_entry_id).toBe("1-1");
    const [row] = await attempts(accountId);
    expect(row).toMatchObject({ attempt_id: body.attempt.attempt_id, stage_id: "1-1", roster: [], status: "open" });
    expect(Number(row.run_seed)).toBe(body.attempt.run_seed);
    expect(row.inputs).toEqual({ owned_character_ids: ["fadyme", "mahmut"], player_levels: {}, equipment: {}, skill_ranks: {}, memory_nodes: {} });
  });

  it("refuses unknown and locked stages, a pending First Oath and illegal rosters", async () => {
    const { token, accountId } = await newPlayer();
    await atStage(accountId, "1-4");
    expect((await post(token, "/v1/stages/9-9/attempts", { roster: [] })).status).toBe(404);
    expect((await post(token, "/v1/stages/2-1/attempts", { roster: [] })).body.error.code).toBe("CONFLICT");
    const owned = ["brin_alder", "fadyme", "mahmut", "tilda_fen"];
    for (const roster of [["brin_alder", "brin_alder"], ["clem_marr"], ["no_such_hero"], ["nixie_vale"]]) {
      const refused = await post(token, "/v1/stages/1-4/attempts", { roster });
      expect(refused.status, JSON.stringify(roster)).toBe(400);
      expect(refused.body.error.code).toBe("INVALID_REQUEST");
    }
    expect((await post(token, "/v1/stages/1-4/attempts", { roster: [...owned, "a", "b"] })).status, "more than five").toBe(400);
    expect((await post(token, "/v1/stages/1-4/attempts", { roster: "fadyme" })).status).toBe(400);
    expect(await attempts(accountId)).toEqual([]);
    expect((await post(token, "/v1/stages/1-4/attempts", { roster: owned })).status).toBe(200);
    expect((await post(token, "/v1/stages/1-2/attempts", { roster: owned })).status, "a cleared stage can be replayed").toBe(200);

    await database.pool.query(
      "UPDATE story_state SET state = state || '{\"first_oath_invitation_available\": true}'::jsonb WHERE account_id = $1",
      [accountId],
    );
    expect((await post(token, "/v1/stages/1-4/attempts", { roster: owned })).body.error.code).toBe("CONFLICT");
  });

  it("keeps one open attempt per account and replays a retried request", async () => {
    const { token, accountId } = await newPlayer();
    await atStage(accountId, "1-4");
    const roster = ["brin_alder", "fadyme", "mahmut", "tilda_fen"];
    const key = crypto.randomUUID();
    const first = await post(token, "/v1/stages/1-4/attempts", { roster }, key);
    const retry = await post(token, "/v1/stages/1-4/attempts", { roster }, key);
    expect(retry).toEqual(first);
    expect((await post(token, "/v1/stages/1-4/attempts", { roster: roster.slice(0, 3) }, key)).status, "same key, other body").toBe(409);
    const second = await post(token, "/v1/stages/1-4/attempts", { roster });
    expect(second.body.attempt.attempt_id).not.toBe(first.body.attempt.attempt_id);
    expect((await attempts(accountId)).map((row) => [row.attempt_id, row.status])).toEqual([
      [first.body.attempt.attempt_id, "expired"],
      [second.body.attempt.attempt_id, "open"],
    ]);
  });

  it("freezes the player's build in the client's battle_options shape", async () => {
    const { token, accountId } = await newPlayer();
    await atStage(accountId, "1-4");
    const q = (sql: string, values: unknown[]) => database.pool.query(sql, values);
    for (const id of ["brin_alder", "tilda_fen"]) await q("INSERT INTO roster (account_id, character_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [accountId, id]);
    await q("UPDATE roster SET level = 7, memory_nodes = 2 WHERE account_id = $1 AND character_id = 'fadyme'", [accountId]);
    await q("INSERT INTO skill_ranks (account_id, character_id, skill_id, rank) VALUES ($1, 'fadyme', 'fadyme_active', 3)", [accountId]);
    await q(
      "INSERT INTO inventory_weapons (instance_id, account_id, weapon_id, level, equipped_character_id) VALUES ('wpn_test_1', $1, 'weapon_axe_shield_3_01', 4, 'brin_alder')",
      [accountId],
    );
    await q(
      "INSERT INTO inventory_accessories (instance_id, account_id, accessory_id, equip_slot, equipped_character_id, payload) VALUES ('acc_test_1', $1, 'accessory_ash_maw_hide_ring_3', 'ring', 'brin_alder', '{\"slot\": \"ring\"}')",
      [accountId],
    );
    // An unowned hero's gear never enters the inputs.
    await q(
      "INSERT INTO inventory_weapons (instance_id, account_id, weapon_id, equipped_character_id) VALUES ('wpn_test_2', $1, 'weapon_axe_shield_3_01', 'clem_marr')",
      [accountId],
    );
    expect((await post(token, "/v1/stages/1-4/attempts", { roster: ["brin_alder", "fadyme", "mahmut", "tilda_fen"] })).status).toBe(200);
    const [row] = await attempts(accountId);
    expect(row.inputs).toEqual({
      owned_character_ids: ["brin_alder", "fadyme", "mahmut", "tilda_fen"],
      player_levels: { fadyme: 7 },
      memory_nodes: { fadyme: 2 },
      skill_ranks: { fadyme: { fadyme_active: 3 } },
      equipment: {
        brin_alder: {
          weapon_id: "weapon_axe_shield_3_01",
          weapon_level: 4,
          armor_id: null,
          accessory_ids: ["accessory_ash_maw_hide_ring_3"],
          rolled_accessories: [{ slot: "ring" }],
        },
      },
    });
  });
});

describe("POST /v1/attempts/{attempt_id}/victory", () => {
  const ROSTER = ["brin_alder", "fadyme", "mahmut", "tilda_fen"];

  async function opened(stageId: string, roster: string[] = ROSTER) {
    const player = await newPlayer();
    await atStage(player.accountId, stageId);
    const begin = await post(player.token, `/v1/stages/${stageId}/attempts`, { roster });
    expect(begin.status, JSON.stringify(begin.body)).toBe(200);
    return { ...player, attemptId: begin.body.attempt.attempt_id as string, runSeed: begin.body.attempt.run_seed as number };
  }

  const claim = (attemptId: string, key?: string, body: unknown = { outcome: "victory", stars: 3, actions: 20, cycles: 3 }) =>
    ({ path: `/v1/attempts/${attemptId}/victory`, body, key });

  async function count(sql: string, values: unknown[]): Promise<number> {
    return Number((await database.pool.query(sql, values)).rows[0].count);
  }

  it("re-runs the stored attempt, pays the first clear once and moves the story", async () => {
    verdict = { outcome: "victory", stars: 3, actions: 20, cycles: 3 };
    const { token, accountId, attemptId, runSeed } = await opened("1-4");
    const request = claim(attemptId);
    const { status, body } = await post(token, request.path, request.body);
    expect(status, JSON.stringify(body)).toBe(200);
    expect(simulated.at(-1)).toMatchObject({ attempt_id: attemptId, stage_id: "1-4", roster: ROSTER, run_seed: runSeed });
    expect(simulated.at(-1)!.inputs.owned_character_ids).toEqual(ROSTER);
    expect(body.first_clear).toBe(true);
    expect(body.result).toEqual(verdict);
    expect(body.applied.length).toBeGreaterThan(0);
    const story = body.state.story_state;
    expect(story.completed_stage_ids).toContain("1-4");
    expect(story.story_cursor_entry_id, "the cursor moved past the cleared stage").toBe("1-5");
    expect(story.owned_character_ids, "1-4 recruits Nixie").toContain("nixie_vale");
    expect(body.state.roster).toHaveProperty("nixie_vale");
    expect(await count("SELECT count(*) FROM claims WHERE account_id = $1 AND reward_type = 'first_clear_stage:1-4'", [accountId])).toBe(1);
    const [attempt] = await attempts(accountId);
    expect(attempt.status).toBe("won");
    // Silver Crowns and stackable items landed where the snapshot shows them.
    for (const reward of body.applied) {
      if (reward.kind === "currency" && reward.item_id === "silver_crowns") expect(body.state.wallet.silver_crowns).toBeGreaterThanOrEqual(reward.quantity);
      if (reward.kind === "item") expect(body.state.items[reward.item_id]).toBeGreaterThanOrEqual(Math.min(reward.quantity, 1));
    }
    // A Ration-costing 3-star win counts for the daily and the active weekly tasks under the server clock.
    const progress = await database.pool.query("SELECT task_id, cycle_id, progress FROM quest_progress WHERE account_id = $1 ORDER BY task_id", [accountId]);
    expect(progress.rows.map((row) => [row.task_id, Number(row.cycle_id), row.progress])).toEqual([
      ["weekly:cycle_a", 2961, 1],
      ["win_three_battles", 41466, 1],
    ]);
  });

  it("replays a retried victory and refuses a used attempt", async () => {
    const { token, accountId, attemptId } = await opened("1-4");
    const key = crypto.randomUUID();
    const request = claim(attemptId);
    const first = await post(token, request.path, request.body, key);
    const wallet = (await database.pool.query("SELECT * FROM wallet WHERE account_id = $1", [accountId])).rows[0];
    const retry = await post(token, request.path, request.body, key);
    expect(retry).toEqual(first);
    expect((await database.pool.query("SELECT * FROM wallet WHERE account_id = $1", [accountId])).rows[0]).toEqual(wallet);
    const again = await post(token, request.path, request.body);
    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe("This battle attempt is already won");
  });

  it("pays first-clear rows once per account and stage even if the story forgets the clear", async () => {
    const { token, accountId, attemptId } = await opened("1-4");
    const first = await post(token, claim(attemptId).path, claim(attemptId).body);
    expect(first.body.applied.some((reward: { is_first_clear: boolean }) => reward.is_first_clear)).toBe(true);
    await atStage(accountId, "1-4"); // the story state is back at 1-4, uncleared; the claim ledger is not
    const again = await post(token, "/v1/stages/1-4/attempts", { roster: ROSTER });
    const second = await post(token, claim(again.body.attempt.attempt_id).path, claim(again.body.attempt.attempt_id).body);
    expect(second.status).toBe(200);
    expect(second.body.first_clear).toBe(true);
    expect(second.body.applied.some((reward: { is_first_clear: boolean }) => reward.is_first_clear), "the ledger refused the duplicate").toBe(false);
    expect(await count("SELECT count(*) FROM claims WHERE account_id = $1", [accountId])).toBe(1);
  });

  it("grants nothing when the server's own run is not a victory", async () => {
    verdict = { outcome: "defeat", stars: 0, actions: 40, cycles: 6 };
    try {
      const { token, accountId, attemptId } = await opened("1-4");
      const request = claim(attemptId);
      const refused = await post(token, request.path, request.body);
      expect(refused.status).toBe(409);
      expect(refused.body.error).toEqual({ code: "CONFLICT", message: "The battle result could not be verified" });
      expect((await attempts(accountId))[0].status, "nothing was stored").toBe("open");
      expect(await count("SELECT count(*) FROM claims WHERE account_id = $1", [accountId])).toBe(0);
      expect(await count("SELECT count(*) FROM inventory_items WHERE account_id = $1", [accountId])).toBe(0);
    } finally {
      verdict = { outcome: "victory", stars: 3, actions: 20, cycles: 3 };
    }
  });

  it("pays a replay without first-clear rows and leaves the cursor alone", async () => {
    const { token, accountId } = await opened("1-4");
    const replay = await post(token, "/v1/stages/1-2/attempts", { roster: ROSTER });
    const request = claim(replay.body.attempt.attempt_id);
    const { status, body } = await post(token, request.path, request.body);
    expect(status).toBe(200);
    expect(body.first_clear).toBe(false);
    expect(body.applied.every((reward: { is_first_clear: boolean }) => !reward.is_first_clear)).toBe(true);
    expect(body.state.story_state.story_cursor_entry_id).toBe("1-4");
    expect(await count("SELECT count(*) FROM claims WHERE account_id = $1", [accountId])).toBe(0);
  });

  it("writes a boss stage's rolled accessory with its own instance id", async () => {
    const { token, accountId, attemptId } = await opened("1-5", [...ROSTER, "nixie_vale"]);
    const request = claim(attemptId);
    const { status, body } = await post(token, request.path, request.body);
    expect(status, JSON.stringify(body)).toBe(200);
    const accessories = body.applied.filter((reward: { payload: unknown }) => reward.payload !== null);
    expect(accessories.length).toBeGreaterThan(0);
    const rows = await database.pool.query("SELECT instance_id, accessory_id, equip_slot, payload FROM inventory_accessories WHERE account_id = $1", [accountId]);
    expect(rows.rows.map((row) => row.instance_id).sort()).toEqual(accessories.map((reward: { instance_id: string }) => reward.instance_id).sort());
    for (const row of rows.rows) {
      expect(row.instance_id).toMatch(/^acc_[0-9a-f]{32}$/);
      expect(row.payload.instance_id).toBe(row.instance_id);
      expect(row.equip_slot).toBe(row.payload.slot);
    }
  });

  it("refuses unknown, foreign and malformed requests, and answers 503 without an engine", async () => {
    const a = await opened("1-4");
    const b = await newPlayer();
    const foreign = claim(a.attemptId);
    expect((await post(b.token, foreign.path, foreign.body)).status, "another player's attempt").toBe(404);
    expect((await post(a.token, `/v1/attempts/${crypto.randomUUID()}/victory`, foreign.body)).status).toBe(404);
    expect((await post(a.token, "/v1/attempts/not-a-uuid/victory", foreign.body)).status).toBe(404);
    expect((await post(a.token, foreign.path, { outcome: "defeat" })).status).toBe(400);
    expect((await post(a.token, foreign.path, { outcome: "victory", stars: -1 })).status).toBe(400);
    withEngine = false;
    try {
      expect((await post(a.token, foreign.path, foreign.body)).status).toBe(503);
    } finally {
      withEngine = true;
    }
  });
});

describe("victories through the real battle engine", () => {
  it("verifies the tutorial with the server's own run of the stored attempt", async () => {
    const real = createApp({ connect: () => database.connect(), verifier, simulate: engineSimulate, nowUnix: () => NOW });
    const { token, accountId } = await newPlayer();
    const call = async (path: string, body?: unknown) => {
      const response = await real(new Request(`https://api.test${path}`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "idempotency-key": crypto.randomUUID() },
        body: body === undefined ? undefined : JSON.stringify(body),
      }));
      return { status: response.status, body: (await response.json()) as Record<string, any> };
    };
    expect((await call("/v1/story/advance")).status).toBe(200);
    const begin = await call("/v1/stages/1-1/attempts", { roster: [] });
    expect(begin.status).toBe(200);
    const [row] = await attempts(accountId);
    const expected = engineSimulate({ attempt_id: row.attempt_id, stage_id: "1-1", roster: row.roster, run_seed: Number(row.run_seed), inputs: row.inputs });
    const victory = await call(`/v1/attempts/${begin.body.attempt.attempt_id}/victory`, { outcome: "victory", stars: expected.stars });
    if (expected.outcome === "victory") {
      expect(victory.status, JSON.stringify(victory.body)).toBe(200);
      expect(victory.body.result).toEqual(expected);
      expect(victory.body.state.story_state.story_cursor_entry_id).toBe("1-2");
    } else {
      expect(victory.status).toBe(409);
    }
  });
});
