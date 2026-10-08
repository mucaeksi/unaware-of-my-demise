// INF-037 social (DEC-0037). The LEGACY HTTP tests (Drive: tests/test_social.py) ported case by case, then what this
// port adds: cancel, unblock, limits, idempotent replays, concurrent crossed requests, nicknames, presence, paging.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { IdentityVerifier } from "../src/identity";
import { SOCIAL_LIMITS, normalizeFriendCode, parseNickname } from "../src/social";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
let counter = 0;
let now = Date.parse("2026-10-05T12:00:00Z") / 1000;

/** The credential is "<subject>|<nonce>". */
const verifier: IdentityVerifier = {
  verify: async (credential) => {
    const [subject, nonce] = credential.split("|");
    return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
  },
};
const app = () => createApp({ connect: () => database.connect(), verifier, nowUnix: () => now });

beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database?.close();
});

interface Player {
  token: string;
  accountId: string;
  code: string;
}

async function call(token: string | null, method: string, path: string, body?: unknown, key: string = crypto.randomUUID()) {
  const headers: Record<string, string> = { "idempotency-key": key };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await app()(new Request(`https://api.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function player(): Promise<Player> {
  const nonce = (await call(null, "POST", "/v1/auth/nonce")).body.nonce as string;
  const signed = await call(null, "POST", "/v1/auth/google", { credential: `social-${++counter}-${Date.now()}|${nonce}` });
  const token = signed.body.session_token as string;
  const account = await call(token, "GET", "/v1/account");
  return { token, accountId: signed.body.account_id as string, code: account.body.friend_code as string };
}

const friends = async (p: Player) => (await call(p.token, "GET", "/v1/friends")).body;
const request = (from: Player, to: Player, key?: string) => call(from.token, "POST", "/v1/friend-requests", { friend_code: to.code }, key);

describe("LEGACY behaviour (tests/test_social.py)", () => {
  it("gives every account a unique, stable friend code", async () => {
    const [a, b] = [await player(), await player()];
    expect(a.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(a.code).not.toBe(b.code);
    expect((await call(a.token, "GET", "/v1/account")).body.friend_code).toBe(a.code);
  });

  it("a request is pending on both sides, with one request id", async () => {
    const [a, b] = [await player(), await player()];
    const sent = await request(a, b);
    expect(sent.status).toBe(200);
    expect(sent.body).toMatchObject({ account_id: b.accountId, relationship: "pending_out" });
    expect(sent.body.request_id).toMatch(/^freq_[0-9a-f]{32}$/);
    expect(sent.body).not.toHaveProperty("friend_code");
    expect((await friends(a)).items).toMatchObject([{ account_id: b.accountId, relationship: "pending_out" }]);
    expect((await friends(b)).items).toMatchObject([{ account_id: a.accountId, relationship: "pending_in", request_id: sent.body.request_id }]);
  });

  it("sending the same request again changes nothing", async () => {
    const [a, b] = [await player(), await player()];
    const first = await request(a, b);
    const second = await request(a, b);
    expect(second.body.request_id).toBe(first.body.request_id);
    expect(second.body.relationship).toBe("pending_out");
  });

  it("crossed requests become a friendship instead of two pending ones", async () => {
    const [a, b] = [await player(), await player()];
    await request(a, b);
    const back = await request(b, a);
    expect([back.status, back.body.relationship]).toEqual([200, "accepted"]);
    expect((await friends(a)).items).toMatchObject([{ account_id: b.accountId, relationship: "accepted" }]);
  });

  it("accepting makes both sides friends", async () => {
    const [a, b] = [await player(), await player()];
    const sent = await request(a, b);
    const accepted = await call(b.token, "POST", `/v1/friend-requests/${sent.body.request_id}/accept`);
    expect([accepted.status, accepted.body.relationship, accepted.body.account_id]).toEqual([200, "accepted", a.accountId]);
    expect((await friends(a)).items).toMatchObject([{ account_id: b.accountId, relationship: "accepted" }]);
  });

  it("rejecting removes the request from both sides", async () => {
    const [a, b] = [await player(), await player()];
    const sent = await request(a, b);
    expect((await call(b.token, "POST", `/v1/friend-requests/${sent.body.request_id}/reject`)).body).toEqual({ status: "rejected" });
    expect((await friends(a)).items).toEqual([]);
    expect((await friends(b)).items).toEqual([]);
  });

  it("only the recipient can accept a request", async () => {
    const [a, b, c] = [await player(), await player(), await player()];
    const sent = await request(a, b);
    expect((await call(c.token, "POST", `/v1/friend-requests/${sent.body.request_id}/accept`)).status).toBe(404);
    expect((await call(a.token, "POST", `/v1/friend-requests/${sent.body.request_id}/accept`)).status, "nor the sender").toBe(404);
  });

  it("removing a friend ends it on both sides; removing a stranger is 404", async () => {
    const [a, b] = [await player(), await player()];
    const sent = await request(a, b);
    await call(b.token, "POST", `/v1/friend-requests/${sent.body.request_id}/accept`);
    expect((await call(b.token, "POST", `/v1/friends/${a.accountId}/remove`)).body).toEqual({ status: "removed" });
    expect((await friends(a)).items).toEqual([]);
    expect((await call(b.token, "POST", `/v1/friends/${a.accountId}/remove`)).status).toBe(404);
    expect((await call(b.token, "POST", "/v1/friends/acct_does_not_exist/remove")).status).toBe(400);
  });

  it("a block ends any relationship and pending request", async () => {
    const [a, b] = [await player(), await player()];
    await request(a, b);
    expect((await call(a.token, "POST", "/v1/blocks", { account_id: b.accountId })).body).toEqual({ status: "blocked" });
    expect((await friends(a)).items).toEqual([]);
    expect((await friends(b)).items).toEqual([]);
  });

  it("the blocked player cannot ask the blocker again, and the blocker must unblock first", async () => {
    const [a, b] = [await player(), await player()];
    await call(a.token, "POST", "/v1/blocks", { account_id: b.accountId });
    const blocked = await request(b, a);
    expect([blocked.status, blocked.body.error.message]).toEqual([403, "This player is not accepting friend requests"]);
    expect((await request(a, b)).status).toBe(403);
  });

  it("refuses self requests, unknown codes, self blocks and self reports", async () => {
    const a = await player();
    expect((await request(a, a)).status).toBe(400);
    expect((await call(a.token, "POST", "/v1/friend-requests", { friend_code: "ZZZZ-ZZZZ" })).status).toBe(404);
    expect((await call(a.token, "POST", "/v1/blocks", { account_id: a.accountId })).status).toBe(400);
    expect((await call(a.token, "POST", "/v1/reports", { account_id: a.accountId, reason_key: "spam" })).status).toBe(400);
  });

  it("records a report", async () => {
    const [a, b] = [await player(), await player()];
    const reported = await call(a.token, "POST", "/v1/reports", { account_id: b.accountId, reason_key: "harassment" });
    expect(reported.body.status).toBe("reported");
    const row = (await database.pool.query("SELECT reporter_account_id, reported_account_id, reason_key FROM reports WHERE report_id = $1", [reported.body.report_id])).rows[0];
    expect(row).toEqual({ reporter_account_id: a.accountId, reported_account_id: b.accountId, reason_key: "harassment" });
  });

  it("needs a session", async () => {
    expect((await call(null, "GET", "/v1/friends")).status).toBe(401);
    expect((await call(null, "POST", "/v1/friend-requests", { friend_code: "AAAA-AAAA" })).status).toBe(401);
  });
});

describe("what the port adds", () => {
  it("the sender can cancel a request; the recipient cannot", async () => {
    const [a, b] = [await player(), await player()];
    const sent = await request(a, b);
    expect((await call(b.token, "POST", `/v1/friend-requests/${sent.body.request_id}/cancel`)).status).toBe(404);
    expect((await call(a.token, "POST", `/v1/friend-requests/${sent.body.request_id}/cancel`)).body).toEqual({ status: "cancelled" });
    expect((await friends(b)).items).toEqual([]);
  });

  it("unblocking lets the two meet again; the list shows who is blocked", async () => {
    const [a, b] = [await player(), await player()];
    await call(a.token, "POST", "/v1/blocks", { account_id: b.accountId });
    expect((await call(a.token, "GET", "/v1/blocks")).body.items).toMatchObject([{ account_id: b.accountId }]);
    expect((await friends(a)).counts.blocked).toBe(1);
    expect((await call(b.token, "POST", `/v1/blocks/${a.accountId}/remove`)).status, "the blocked one cannot lift it").toBe(404);
    expect((await call(a.token, "POST", `/v1/blocks/${b.accountId}/remove`)).body).toEqual({ status: "unblocked" });
    expect((await request(b, a)).body.relationship).toBe("pending_out");
  });

  it("a retried request with the same key replays; the same key for another request is refused", async () => {
    const [a, b, c] = [await player(), await player(), await player()];
    const key = crypto.randomUUID();
    const first = await request(a, b, key);
    expect((await request(a, b, key)).body).toEqual(first.body);
    expect((await request(a, c, key)).status).toBe(409);
  });

  it("crossed requests sent at the same moment end as one friendship, without a deadlock", async () => {
    for (let round = 0; round < 5; round++) {
      const [a, b] = [await player(), await player()];
      const [one, two] = await Promise.all([request(a, b), request(b, a)]);
      expect([one.status, two.status]).toEqual([200, 200]);
      const edges = (await database.pool.query("SELECT state FROM friend_edges WHERE $1 IN (owner_account_id, other_account_id)", [a.accountId])).rows;
      expect(edges.map((row) => row.state).sort(), `round ${round}`).toEqual(["accepted", "accepted"]);
    }
  });

  it("limits outgoing requests and the friend list", async () => {
    const a = await player();
    await database.pool.query("INSERT INTO idempotency_keys (idempotency_key, account_id, endpoint, request_fingerprint, response_json) SELECT gen_random_uuid(), $1, 'friend_request', 'x', '{}' FROM generate_series(1, $2)", [a.accountId, SOCIAL_LIMITS.requests_per_day]);
    const limited = await request(a, await player());
    expect([limited.status, limited.body.error.code]).toEqual([409, "LIMIT_REACHED"]);
    await database.pool.query("DELETE FROM idempotency_keys WHERE account_id = $1", [a.accountId]);

    const full = await player();
    const others: Player[] = [];
    for (let index = 0; index < 2; index++) others.push(await player());
    await database.pool.query(
      "INSERT INTO account (account_id) SELECT 'acct_' || md5(random()::text) FROM generate_series(1, $1) RETURNING account_id",
      [SOCIAL_LIMITS.friends],
    ).then(({ rows }) => Promise.all(rows.map((row) =>
      database.pool.query("INSERT INTO friend_edges (owner_account_id, other_account_id, state) VALUES ($1, $2, 'accepted'), ($2, $1, 'accepted')", [full.accountId, row.account_id]))));
    expect((await request(full, others[0]!)).body.error.code).toBe("LIMIT_REACHED");
    const toFull = await request(others[1]!, full);
    expect(toFull.status).toBe(200);
    const accept = await call(full.token, "POST", `/v1/friend-requests/${toFull.body.request_id}/accept`);
    expect([accept.status, accept.body.error.message]).toEqual([409, "Your friend list is full"]);
  });

  it("a repeat report within a day is the same report; reports per day are limited", async () => {
    const [a, b] = [await player(), await player()];
    const first = await call(a.token, "POST", "/v1/reports", { account_id: b.accountId, reason_key: "spam" });
    const again = await call(a.token, "POST", "/v1/reports", { account_id: b.accountId, reason_key: "cheating" });
    expect(again.body.report_id).toBe(first.body.report_id);
    expect((await call(a.token, "POST", "/v1/reports", { account_id: b.accountId, reason_key: "rude" })).status).toBe(400);
    for (let index = 1; index < SOCIAL_LIMITS.reports_per_day; index++) {
      expect((await call(a.token, "POST", "/v1/reports", { account_id: (await player()).accountId, reason_key: "other" })).status).toBe(200);
    }
    const over = await call(a.token, "POST", "/v1/reports", { account_id: (await player()).accountId, reason_key: "other" });
    expect(over.body.error.code).toBe("LIMIT_REACHED");
  });

  it("a nickname is chosen once a day, unique regardless of case", async () => {
    const [a, b] = [await player(), await player()];
    const name = `Ash${counter}`;
    const set = await call(a.token, "POST", "/v1/profile", { nickname: ` ${name} ` });
    expect([set.status, set.body.nickname]).toEqual([200, name]);
    expect(set.body.nickname_change_available_at_utc).toBe(new Date((now + 86_400) * 1000).toISOString());
    expect((await call(b.token, "POST", "/v1/profile", { nickname: name.toUpperCase() })).body.error.code).toBe("NICKNAME_TAKEN");
    expect((await call(a.token, "POST", "/v1/profile", { nickname: "Another" })).status, "too soon").toBe(429);
    expect((await call(a.token, "POST", "/v1/profile", { nickname: name })).status, "the same name is no change").toBe(200);
    now += 86_400;
    expect((await call(a.token, "POST", "/v1/profile", { nickname: `Elm${counter}` })).status).toBe(200);
    const record = (await request(b, a)).body;
    expect(record.nickname).toBe(`Elm${counter}`);
  });

  it("presence shows only for players who allow it and were seen lately", async () => {
    const [a, b] = [await player(), await player()];
    await request(a, b);
    await call(b.token, "GET", "/v1/state");
    const realNow = Date.now() / 1000;
    const saved = now;
    now = realNow;
    expect((await friends(a)).items[0].presence).toBe("online");
    await call(b.token, "POST", "/v1/profile", { presence_opt_in: false });
    expect((await friends(a)).items[0].presence).toBe("offline");
    now = saved;
  });

  it("pages the list newest first with a cursor", async () => {
    const a = await player();
    const others: Player[] = [];
    for (let index = 0; index < 5; index++) {
      others.push(await player());
      await request(a, others[index]!);
    }
    const first = (await call(a.token, "GET", "/v1/friends?limit=2")).body;
    expect(first.items.map((item: { account_id: string }) => item.account_id)).toEqual([others[4]!.accountId, others[3]!.accountId]);
    const second = (await call(a.token, "GET", `/v1/friends?limit=2&cursor=${first.next_cursor}`)).body;
    const third = (await call(a.token, "GET", `/v1/friends?limit=2&cursor=${second.next_cursor}`)).body;
    expect([...second.items, ...third.items].map((item: { account_id: string }) => item.account_id)).toEqual([others[2]!.accountId, others[1]!.accountId, others[0]!.accountId]);
    expect(third.next_cursor).toBeNull();
    expect(first.counts).toEqual({ friends: 0, incoming: 0, outgoing: 5, blocked: 0 });
    expect((await call(a.token, "GET", "/v1/friends?cursor=nope")).status).toBe(400);
    expect((await call(a.token, "GET", "/v1/friends?limit=1000")).status).toBe(400);
  });

  it("deleting an account removes it from everyone's lists", async () => {
    const [a, b] = [await player(), await player()];
    const sent = await request(a, b);
    await call(b.token, "POST", `/v1/friend-requests/${sent.body.request_id}/accept`);
    await database.pool.query("DELETE FROM account WHERE account_id = $1", [b.accountId]);
    expect((await friends(a)).items).toEqual([]);
  });
});

describe("input rules", () => {
  it("normalizes friend codes", () => {
    expect(normalizeFriendCode("abcd 2345")).toBe("ABCD-2345");
    expect(normalizeFriendCode("ABCD2345")).toBe("ABCD-2345");
    expect(() => normalizeFriendCode("ABCD-0000")).toThrow("XXXX-XXXX");
    expect(() => normalizeFriendCode(42)).toThrow();
  });

  it("accepts letters of any script and refuses reserved or malformed nicknames", () => {
    expect(parseNickname("  Fadyme Fan ")).toBe("Fadyme Fan");
    expect(parseNickname("Yıldız_42")).toBe("Yıldız_42");
    expect(parseNickname("灰の道")).toBe("灰の道");
    for (const bad of ["ab", "a".repeat(17), "two  spaces", "<script>", "12345", "Game_Admin", "S.u.p.p.o.r.t"]) {
      expect(() => parseNickname(bad), bad).toThrow();
    }
  });
});
