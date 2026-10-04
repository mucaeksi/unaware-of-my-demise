import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
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

const app = () => createApp({ connect: () => database.connect(), verifier });

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
    expect(row.inputs).toEqual({ player_levels: {}, equipment: {}, skill_ranks: {}, memory_nodes: {} });
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
