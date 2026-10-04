// INF-035: remote config (flags, scheduled notices) and mail whose rewards are paid once per account.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminApp } from "../src/admin";
import { AdminAuthError, type AdminVerifier } from "../src/admin-auth";
import { createApp } from "../src/app";
import type { IdentityVerifier } from "../src/identity";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
let counter = 0;
let clock = Date.parse("2026-10-10T12:00:00Z") / 1000;
const ORIGIN = "https://admin.test";

const accessStub: AdminVerifier = {
  verify: async (request) => {
    const email = request.headers.get("x-test-operator");
    if (!email) throw new AdminAuthError("No Cloudflare Access token");
    return { email };
  },
};
const admin = () => createAdminApp({ connect: () => database.connect(), verifier: accessStub, environment: "test", nowUnix: () => clock });
const verifier: IdentityVerifier = {
  verify: async (credential) => {
    const [subject, nonce] = credential.split("|");
    return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
  },
};
const game = () => createApp({ connect: () => database.connect(), verifier, nowUnix: () => clock });

beforeAll(async () => {
  database = await createTestDatabase();
  await database.pool.query("INSERT INTO admin_users (email, role, added_by) VALUES ('ops@uomd.test', 'operator', 'test'), ('view@uomd.test', 'viewer', 'test')");
});
afterAll(async () => {
  await database?.close();
});

async function player(): Promise<{ token: string; accountId: string }> {
  const issued = (await (await game()(new Request("https://api.test/v1/auth/nonce", { method: "POST" }))).json()) as { nonce: string };
  const signed = (await (
    await game()(new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: `liveops-${++counter}|${issued.nonce}` }) }))
  ).json()) as { session_token: string; account_id: string };
  return { token: signed.session_token, accountId: signed.account_id };
}

async function operate(path: string, body: Record<string, unknown>, operator = "ops@uomd.test", key: string = crypto.randomUUID()) {
  const response = await admin()(
    new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: { "x-test-operator": operator, origin: ORIGIN, "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function call(token: string | null, method: string, path: string, key: string = crypto.randomUUID()) {
  const response = await game()(
    new Request(`https://api.test${path}`, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(method === "POST" ? { "idempotency-key": key } : {}) },
    }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

const wallet = async (accountId: string) =>
  (await database.pool.query("SELECT silver_crowns::int, eclipse_tokens::int FROM wallet WHERE account_id = $1", [accountId])).rows[0];

describe("remote config", () => {
  it("has no flags and no notices before the first revision", async () => {
    const { body } = await call(null, "GET", "/v1/liveops");
    expect(body).toMatchObject({ revision: 0, flags: {}, notices: [], server_time_utc: "2026-10-10T12:00:00.000Z" });
  });

  it("publishes a revision; clients see its flags and only the notices running now (server UTC)", async () => {
    const published = await operate("/admin/api/liveops/config", {
      reason: "synthetic notice test",
      config: {
        flags: { mail_enabled: true },
        notices: [
          { notice_id: "welcome", title_en: "Welcome", body_en: "Hello", starts_at_utc: "2026-10-10T00:00:00Z", ends_at_utc: "2026-10-11T00:00:00Z" },
          { notice_id: "later", title_en: "Soon", body_en: "Later", starts_at_utc: "2026-10-10T12:00:01Z", ends_at_utc: "2026-10-12T00:00:00Z" },
        ],
      },
    });
    expect(published.status).toBe(200);
    const now = await call(null, "GET", "/v1/liveops");
    expect(now.body.revision).toBe(published.body.revision);
    expect(now.body.flags).toEqual({ mail_enabled: true });
    expect(now.body.notices.map((notice: { notice_id: string }) => notice.notice_id)).toEqual(["welcome"]);
    clock += 1;
    expect((await call(null, "GET", "/v1/liveops")).body.notices).toHaveLength(2);
    clock -= 1;
  });

  it("refuses a malformed config and non-operators, publishing nothing", async () => {
    const before = (await call(null, "GET", "/v1/liveops")).body.revision;
    for (const config of [{ extra: 1 }, { flags: { "Bad-Name": true } }, { flags: { x: "yes" } },
      { notices: [{ notice_id: "n", title_en: "t", body_en: "b", starts_at_utc: "2026-10-11T00:00:00Z", ends_at_utc: "2026-10-10T00:00:00Z" }] }]) {
      expect((await operate("/admin/api/liveops/config", { reason: "should fail", config })).status, JSON.stringify(config)).toBe(400);
    }
    expect((await operate("/admin/api/liveops/config", { reason: "viewer try", config: {} }, "view@uomd.test")).status).toBe(403);
    expect((await call(null, "GET", "/v1/liveops")).body.revision).toBe(before);
  });
});

describe("mail", () => {
  const window = { starts_at_utc: "2026-10-10T00:00:00Z", expires_at_utc: "2026-10-17T00:00:00Z" };

  it("pays its rewards once per account, journaled, whatever the retries", async () => {
    const { token, accountId } = await player();
    const sent = await operate("/admin/api/mail", { reason: "compensation for outage 1", title_en: "Sorry", body_en: "For the outage.", rewards: { silver_crowns: 500, eclipse_tokens: 20, items: { torn_chronicle_page: 3 } }, ...window });
    expect(sent.status).toBe(200);
    const mailId = sent.body.mail_id as string;
    const listed = await call(token, "GET", "/v1/mail");
    expect(listed.body.mail.find((mail: { mail_id: string }) => mail.mail_id === mailId)).toMatchObject({ claimed: false, rewards: { silver_crowns: 500, eclipse_tokens: 20 } });
    const before = await wallet(accountId);
    const key = crypto.randomUUID();
    const claimed = await call(token, "POST", `/v1/mail/${mailId}/claim`, key);
    expect(claimed.status).toBe(200);
    expect(claimed.body.granted).toEqual({ silver_crowns: 500, eclipse_tokens: 20, items: { torn_chronicle_page: 3 } });
    expect(await wallet(accountId)).toEqual({ silver_crowns: before.silver_crowns + 500, eclipse_tokens: before.eclipse_tokens + 20 });
    const replay = await call(token, "POST", `/v1/mail/${mailId}/claim`, key);
    expect(replay.body, "the same request answers the same result").toEqual(claimed.body);
    const again = await call(token, "POST", `/v1/mail/${mailId}/claim`);
    expect([again.status, again.body.error.code]).toEqual([409, "CONFLICT"]);
    expect(await wallet(accountId), "paid once").toEqual({ silver_crowns: before.silver_crowns + 500, eclipse_tokens: before.eclipse_tokens + 20 });
    const journal = await database.pool.query("SELECT endpoint, resource_id, delta::int FROM economy_journal WHERE account_id = $1 AND endpoint = 'mail_claim' ORDER BY entry_id", [accountId]);
    expect(journal.rows.map((row) => [row.resource_id, row.delta]).sort()).toEqual([["eclipse_tokens", 20], ["silver_crowns", 500], ["torn_chronicle_page", 3]]);
    expect((await call(token, "GET", "/v1/mail")).body.mail.find((mail: { mail_id: string }) => mail.mail_id === mailId).claimed).toBe(true);
  });

  it("reaches only its addressee and only inside its window", async () => {
    const first = await player();
    const second = await player();
    const sent = await operate("/admin/api/mail", { reason: "ticket 42 refund", title_en: "Refund", body_en: "Yours.", account_id: first.accountId, rewards: { silver_crowns: 10 }, ...window });
    const mailId = sent.body.mail_id as string;
    expect((await call(second.token, "GET", "/v1/mail")).body.mail.map((mail: { mail_id: string }) => mail.mail_id)).not.toContain(mailId);
    expect((await call(second.token, "POST", `/v1/mail/${mailId}/claim`)).status).toBe(404);
    const saved = clock;
    clock = Date.parse(window.expires_at_utc) / 1000;
    expect((await call(first.token, "POST", `/v1/mail/${mailId}/claim`)).status, "expired at expires_at").toBe(404);
    clock = Date.parse(window.starts_at_utc) / 1000 - 1;
    expect((await call(first.token, "GET", "/v1/mail")).body.mail.map((mail: { mail_id: string }) => mail.mail_id), "not yet").not.toContain(mailId);
    clock = saved;
    expect((await call(first.token, "POST", `/v1/mail/${mailId}/claim`)).status).toBe(200);
  });

  it("stops claims when revoked and keeps what was claimed", async () => {
    const early = await player();
    const late = await player();
    const sent = await operate("/admin/api/mail", { reason: "event reward test", title_en: "Event", body_en: "Thanks.", rewards: { silver_crowns: 7 }, ...window });
    const mailId = sent.body.mail_id as string;
    expect((await call(early.token, "POST", `/v1/mail/${mailId}/claim`)).status).toBe(200);
    expect((await operate(`/admin/api/mail/${mailId}/revoke`, { reason: "sent by mistake" })).status).toBe(200);
    expect((await call(late.token, "POST", `/v1/mail/${mailId}/claim`)).status).toBe(404);
    expect((await database.pool.query("SELECT count(*)::int FROM mail_claims WHERE mail_id = $1", [mailId])).rows[0].count).toBe(1);
    const trail = await database.pool.query("SELECT action FROM admin_audit WHERE action LIKE 'liveops.%' AND result->>'mail_id' = $1 ORDER BY audit_id", [mailId]);
    expect(trail.rows.map((row) => row.action)).toEqual(["liveops.send_mail", "liveops.revoke_mail"]);
  });

  it("refuses unknown items, oversized rewards and bad windows", async () => {
    for (const rewards of [{ items: { not_an_item: 1 } }, { eclipse_tokens: 10_001 }, { silver_crowns: 0 }, { gems: 5 }]) {
      expect((await operate("/admin/api/mail", { reason: "bad rewards", title_en: "x", body_en: "y", rewards, ...window })).status, JSON.stringify(rewards)).toBe(400);
    }
    expect((await operate("/admin/api/mail", { reason: "bad window", title_en: "x", body_en: "y", starts_at_utc: window.expires_at_utc, expires_at_utc: window.starts_at_utc })).status).toBe(400);
    expect((await operate("/admin/api/mail", { reason: "unknown player", title_en: "x", body_en: "y", account_id: `acct_${"0".repeat(32)}`, ...window })).status).toBe(404);
  });
});
