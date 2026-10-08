// INF-019/INF-020: logout ends the session; account deletion needs a fresh credential of the linked identity and removes
// every row of the account, keeping only an anonymous deletion record.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { IdentityVerifier } from "../src/identity";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
let counter = 0;

/** The credential is "<subject>|<nonce>". */
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

async function nonce(): Promise<string> {
  return ((await (await app()(new Request("https://api.test/v1/auth/nonce", { method: "POST" }))).json()) as { nonce: string }).nonce;
}

async function signIn(subject: string): Promise<{ token: string; accountId: string; isNew: boolean }> {
  const response = await app()(
    new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: `${subject}|${await nonce()}` }) }),
  );
  const body = (await response.json()) as { session_token: string; account_id: string; is_new_account: boolean };
  return { token: body.session_token, accountId: body.account_id, isNew: body.is_new_account };
}

async function post(token: string, path: string, body?: unknown) {
  const response = await app()(
    new Request(`https://api.test${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "idempotency-key": crypto.randomUUID() },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

const stateStatus = async (token: string) =>
  (await app()(new Request("https://api.test/v1/state", { headers: { authorization: `Bearer ${token}` } }))).status;

/** Rows of `accountId` in every table that has an account_id column. */
async function rowsOf(accountId: string): Promise<number> {
  const tables = await database.pool.query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.columns WHERE column_name = 'account_id' AND table_schema = 'public' AND table_name <> 'account_deletions'",
  );
  let total = 0;
  for (const { table_name } of tables.rows) {
    total += Number((await database.pool.query(`SELECT count(*) FROM ${table_name} WHERE account_id = $1`, [accountId])).rows[0].count);
  }
  return total;
}

describe("POST /v1/auth/logout", () => {
  it("ends this session only", async () => {
    const subject = `logout-${++counter}`;
    const first = await signIn(subject);
    const second = await signIn(subject);
    expect((await post(first.token, "/v1/auth/logout")).body).toEqual({ signed_out: true });
    expect(await stateStatus(first.token)).toBe(401);
    expect(await stateStatus(second.token), "another device stays signed in").toBe(200);
    expect((await post(first.token, "/v1/auth/logout")).status, "a used token is unauthorized").toBe(401);
  });
});

describe("POST /v1/account/delete", () => {
  it("needs a fresh credential of the identity linked to the account", async () => {
    const subject = `delete-${++counter}`;
    const { token, accountId } = await signIn(subject);
    expect((await post(token, "/v1/account/delete", {})).status, "no credential").toBe(400);
    expect((await post(token, "/v1/account/delete", { credential: `${subject}|never-issued` })).status, "a nonce the server never issued").toBe(401);
    const someoneElse = await post(token, "/v1/account/delete", { credential: `other-${counter}|${await nonce()}` });
    expect([someoneElse.status, someoneElse.body.error.code]).toEqual([403, "REAUTH_MISMATCH"]);
    expect((await post("nope", "/v1/account/delete", { credential: `${subject}|${await nonce()}` })).status, "no session").toBe(401);
    expect(await rowsOf(accountId), "nothing was deleted").toBeGreaterThan(0);
  });

  it("deletes every row of the account, keeps an anonymous record, and a new sign-in starts over", async () => {
    const subject = `delete-${++counter}`;
    const { token, accountId } = await signIn(subject);
    expect((await post(token, "/v1/story/advance")).status).toBe(200);
    await database.pool.query("UPDATE wallet SET eclipse_tokens = 500 WHERE account_id = $1", [accountId]);
    const deleted = await post(token, "/v1/account/delete", { credential: `${subject}|${await nonce()}` });
    expect(deleted.body).toEqual({ deleted: true, account_id: accountId });
    expect(await rowsOf(accountId)).toBe(0);
    expect((await database.pool.query("SELECT 1 FROM account WHERE account_id = $1", [accountId])).rowCount).toBe(0);
    const record = (await database.pool.query("SELECT * FROM account_deletions WHERE account_id = $1", [accountId])).rows[0];
    expect(record.confirmed_by).toBe("google_oidc");
    expect(JSON.stringify(record)).not.toContain(subject);
    expect(await stateStatus(token), "the session went with the account").toBe(401);
    const again = await signIn(subject);
    expect(again.isNew).toBe(true);
    expect(again.accountId).not.toBe(accountId);
  });

  it("answers 503 when sign-in is not configured", async () => {
    const { token } = await signIn(`delete-${++counter}`);
    const unconfigured = createApp({ connect: () => database.connect(), verifier: null });
    const response = await unconfigured(
      new Request("https://api.test/v1/account/delete", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ credential: "x" }) }),
    );
    expect(response.status).toBe(503);
  });
});

// D-01 / OQ-016: the public deletion page (Google Play's Data safety link) and the deletion it performs without the app.
describe("/account/delete (web)", () => {
  const web = (deps: Partial<Parameters<typeof createApp>[0]> = {}) =>
    createApp({ connect: () => database.connect(), verifier, webClientId: "web-client.apps.googleusercontent.com", ...deps });
  const webDelete = async (body: unknown) => {
    const response = await web()(new Request("https://api.test/account/delete", { method: "POST", body: JSON.stringify(body) }));
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };

  it("serves the page without a database, a client version or a session, under a strict CSP", async () => {
    const response = await web({ connect: () => Promise.reject(new Error("no database for the page")) })(new Request("https://api.test/account/delete"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("unawareofmydemise@gmail.com");
    expect(html).toContain('"web-client.apps.googleusercontent.com"');
    const csp = response.headers.get("content-security-policy")!;
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)![1]!;
    expect(html.match(/<script[^>]*>/g)!.every((tag) => tag.includes(`nonce="${nonce}"`)), "every script carries the nonce").toBe(true);
  });

  it("stays readable during maintenance", async () => {
    const maintenance = web({ release: { sourceSha: null, minClientVersionCode: 1, maintenanceMessage: "Down for maintenance" } });
    expect((await maintenance(new Request("https://api.test/account/delete"))).status).toBe(200);
  });

  it("offers only the app and the support address when sign-in is not configured", async () => {
    const html = await (await web({ verifier: null })(new Request("https://api.test/account/delete"))).text();
    expect(html).toContain("unawareofmydemise@gmail.com");
    expect(html).not.toContain("accounts.google.com/gsi/client\"");
    expect(html).not.toContain("<script");
  });

  it("deletes the account linked to a fresh credential, keeping only the anonymous record", async () => {
    const subject = `web-delete-${++counter}`;
    const { token, accountId } = await signIn(subject);
    expect((await webDelete({ credential: `${subject}|never-issued` })).status, "a nonce the server never issued").toBe(401);
    expect(await rowsOf(accountId), "nothing was deleted").toBeGreaterThan(0);
    const fresh = await nonce();
    expect(await webDelete({ credential: `${subject}|${fresh}` })).toEqual({ status: 200, body: { deleted: true } });
    expect(await rowsOf(accountId)).toBe(0);
    const record = (await database.pool.query("SELECT confirmed_by FROM account_deletions WHERE account_id = $1", [accountId])).rows[0];
    expect(record.confirmed_by).toBe("web:google_oidc");
    expect(await stateStatus(token), "the sessions went with the account").toBe(401);
    expect((await webDelete({ credential: `${subject}|${fresh}` })).status, "a used nonce cannot be replayed").toBe(401);
  });

  it("answers 404 for a Google account without a game account, and deletes nothing", async () => {
    const response = await webDelete({ credential: `never-played-${++counter}|${await nonce()}` });
    expect([response.status, response.body.error.code]).toEqual([404, "NOT_FOUND"]);
  });

  it("uses the sign-in rate limit", async () => {
    const used: string[] = [];
    const limiter = (name: string) => ({ limit: async () => (used.push(name), { success: true }) });
    await web({ authLimiter: limiter("auth"), apiLimiter: limiter("api") })(
      new Request("https://api.test/account/delete", { method: "POST", body: JSON.stringify({ credential: "x|y" }) }),
    );
    expect(used).toEqual(["auth"]);
  });
});
