// INF-033/034: the admin API — Access identity, roles, audited reads, audited idempotent changes.
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminApp } from "../src/admin";
import { AccessJwtVerifier, AdminAuthError, type AdminVerifier } from "../src/admin-auth";
import { createApp } from "../src/app";
import { ReleaseControlCache } from "../src/release";
import type { IdentityVerifier } from "../src/identity";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
let counter = 0;
const ORIGIN = "https://admin.test";

/** The test stand-in for Cloudflare Access: the operator's e-mail in a header. */
const accessStub: AdminVerifier = {
  verify: async (request) => {
    const email = request.headers.get("x-test-operator");
    if (!email) throw new AdminAuthError("No Cloudflare Access token");
    return { email };
  },
};
const admin = (verifier: AdminVerifier | null = accessStub) => createAdminApp({ connect: () => database.connect(), verifier, environment: "test" });

const playerVerifier: IdentityVerifier = {
  verify: async (credential) => {
    const [subject, nonce] = credential.split("|");
    return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
  },
};
const game = () => createApp({ connect: () => database.connect(), verifier: playerVerifier });

beforeAll(async () => {
  database = await createTestDatabase();
  await database.pool.query(
    "INSERT INTO admin_users (email, role, added_by) VALUES ('view@uomd.test', 'viewer', 'test'), ('help@uomd.test', 'support', 'test'), ('ops@uomd.test', 'operator', 'test'), ('gone@uomd.test', 'operator', 'test')",
  );
  await database.pool.query("UPDATE admin_users SET disabled_at = now() WHERE email = 'gone@uomd.test'");
});
afterAll(async () => {
  await database?.close();
});

async function player(): Promise<{ token: string; accountId: string; friendCode: string }> {
  const issued = (await (await game()(new Request("https://api.test/v1/auth/nonce", { method: "POST" }))).json()) as { nonce: string };
  const signed = (await (
    await game()(new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: `admin-${++counter}|${issued.nonce}` }) }))
  ).json()) as { session_token: string; account_id: string };
  const code = (await database.pool.query("SELECT friend_code FROM profiles WHERE account_id = $1", [signed.account_id])).rows[0].friend_code;
  return { token: signed.session_token, accountId: signed.account_id, friendCode: code };
}

async function get(operator: string | null, path: string, verifier?: AdminVerifier | null) {
  const response = await admin(verifier)(new Request(`${ORIGIN}${path}`, { headers: operator ? { "x-test-operator": operator } : {} }));
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function post(operator: string, path: string, body: unknown, key: string = crypto.randomUUID(), headers: Record<string, string> = {}) {
  const response = await admin()(
    new Request(`${ORIGIN}${path}`, {
      method: "POST",
      headers: { "x-test-operator": operator, origin: ORIGIN, "content-type": "application/json", "idempotency-key": key, ...headers },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

const auditRows = async (accountId: string) =>
  (await database.pool.query("SELECT * FROM admin_audit WHERE target_account_id = $1 ORDER BY audit_id", [accountId])).rows;

describe("who may use the admin API", () => {
  it("is closed without Access, without a token, to strangers and to disabled admins", async () => {
    expect((await get("ops@uomd.test", "/admin/api/me", null)).status).toBe(503);
    expect((await get(null, "/admin/api/me")).status).toBe(401);
    expect((await get("someone@uomd.test", "/admin/api/me")).status).toBe(403);
    expect((await get("gone@uomd.test", "/admin/api/me")).status).toBe(403);
    expect((await get("view@uomd.test", "/admin/api/me")).body).toEqual({ email: "view@uomd.test", role: "viewer", permissions: ["service.read", "player.read"] });
    expect((await get("view@uomd.test", "/admin/api/nope")).status).toBe(404);
  });

  it("gives each role only its permissions", async () => {
    const { accountId } = await player();
    expect((await get("view@uomd.test", "/admin/api/audit")).status).toBe(403);
    expect((await get("help@uomd.test", "/admin/api/audit")).status).toBe(403);
    expect((await get("ops@uomd.test", "/admin/api/audit")).status).toBe(200);
    expect((await post("view@uomd.test", `/admin/api/players/${accountId}/revoke-sessions`, { reason: "testing roles" })).status).toBe(403);
  });
});

describe("reading a player", () => {
  it("finds a player by friend code or account id, shows state, journal, pulls and claims, and audits each read", async () => {
    const { accountId, friendCode } = await player();
    const byCode = await get("view@uomd.test", `/admin/api/players?query=${friendCode.toLowerCase()}`);
    expect(byCode.body.players.map((row: { account_id: string }) => row.account_id)).toEqual([accountId]);
    expect((await get("view@uomd.test", `/admin/api/players?query=${accountId}`)).body.players).toHaveLength(1);
    expect((await get("view@uomd.test", "/admin/api/players?query=%25")).status, "no wildcard listing").toBe(400);
    const state = await get("view@uomd.test", `/admin/api/players/${accountId}/state`);
    expect(state.body.state.wallet).toBeDefined();
    const journal = await get("view@uomd.test", `/admin/api/players/${accountId}/journal`);
    expect(journal.body.entries.length).toBeGreaterThan(0);
    expect(journal.body.entries[0].endpoint).toBe("account_create");
    expect((await get("view@uomd.test", `/admin/api/players/${accountId}/pulls`)).body.pulls).toEqual([]);
    expect((await get("view@uomd.test", `/admin/api/players/${accountId}/claims`)).status).toBe(200);
    expect((await get("view@uomd.test", `/admin/api/players/acct_${"0".repeat(32)}/state`)).status).toBe(404);
    const actions = (await auditRows(accountId)).map((row) => [row.action, row.actor_email, row.environment]);
    expect(actions).toEqual([
      ["read.player_search", "view@uomd.test", "test"],
      ["read.player_search", "view@uomd.test", "test"],
      ["read.player_state", "view@uomd.test", "test"],
      ["read.player_journal", "view@uomd.test", "test"],
      ["read.player_pulls", "view@uomd.test", "test"],
      ["read.player_claims", "view@uomd.test", "test"],
    ]);
  });
});

describe("support: revoking a player's sessions", () => {
  it("signs the player out everywhere, once per key, with the reason audited in the same transaction", async () => {
    const { token, accountId } = await player();
    const key = crypto.randomUUID();
    const done = await post("help@uomd.test", `/admin/api/players/${accountId}/revoke-sessions`, { reason: "lost phone, ticket 7" }, key);
    expect(done.body).toEqual({ account_id: accountId, revoked_sessions: 1 });
    const state = await game()(new Request("https://api.test/v1/state", { headers: { authorization: `Bearer ${token}` } }));
    expect(state.status, "the player's session is gone").toBe(401);
    const again = await post("help@uomd.test", `/admin/api/players/${accountId}/revoke-sessions`, { reason: "lost phone, ticket 7" }, key);
    expect(again.body, "a replay answers the first result").toEqual(done.body);
    const changes = (await auditRows(accountId)).filter((row) => row.action === "support.revoke_sessions");
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ actor_email: "help@uomd.test", actor_role: "support", reason: "lost phone, ticket 7", operation_key: key });
    expect(changes[0].config_revision).toMatch(/^unrecorded\/[0-9a-f]{12}$/);
  });

  it("needs a reason, an Idempotency-Key and a same-origin JSON request", async () => {
    const { accountId } = await player();
    const path = `/admin/api/players/${accountId}/revoke-sessions`;
    expect((await post("help@uomd.test", path, { reason: "no" })).status).toBe(400);
    expect((await post("help@uomd.test", path, {})).status).toBe(400);
    expect((await post("help@uomd.test", path, { reason: "valid reason" }, "not-a-uuid")).status).toBe(400);
    expect((await post("help@uomd.test", path, { reason: "valid reason" }, crypto.randomUUID(), { origin: "https://evil.test" })).status).toBe(403);
    expect((await post("help@uomd.test", path, { reason: "valid reason" }, crypto.randomUUID(), { "content-type": "text/plain" })).status).toBe(403);
    expect((await auditRows(accountId)).filter((row) => row.action === "support.revoke_sessions")).toHaveLength(0);
  });

  it("lets operators read the audit trail of a player", async () => {
    const { accountId } = await player();
    await post("ops@uomd.test", `/admin/api/players/${accountId}/revoke-sessions`, { reason: "abuse report 3" });
    const trail = await get("ops@uomd.test", `/admin/api/audit?target=${accountId}`);
    expect(trail.body.entries.map((row: { action: string }) => row.action)).toEqual(["support.revoke_sessions"]);
  });
});

describe("moderation (INF-037): reports and nicknames", () => {
  const report = async (from: { token: string }, about: string, reason = "harassment") =>
    (await (await game()(new Request("https://api.test/v1/reports", {
      method: "POST",
      headers: { authorization: `Bearer ${(from as { token: string }).token}`, "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ account_id: about, reason_key: reason }),
    }))).json()) as { report_id: string };

  it("lists open reports with both players, resolves each once with the reason, and audits both", async () => {
    const [reporter, reported] = [await player(), await player()];
    const { report_id } = await report(reporter, reported.accountId);
    const open = await get("view@uomd.test", "/admin/api/reports");
    const row = open.body.reports.find((entry: { report_id: string }) => entry.report_id === report_id);
    expect(row).toMatchObject({ reason_key: "harassment", reporter_account_id: reporter.accountId, reported_account_id: reported.accountId, reported_friend_code: reported.friendCode, reports_against_player: 1 });
    expect((await post("view@uomd.test", `/admin/api/reports/${report_id}/resolve`, { reason: "warned the player" })).status, "a viewer cannot resolve").toBe(403);
    const resolved = await post("help@uomd.test", `/admin/api/reports/${report_id}/resolve`, { reason: "warned the player, ticket 12" });
    expect(resolved.body).toEqual({ report_id, resolved: true });
    expect((await post("help@uomd.test", `/admin/api/reports/${report_id}/resolve`, { reason: "second look at it" })).status).toBe(409);
    expect((await get("view@uomd.test", "/admin/api/reports")).body.reports.some((entry: { report_id: string }) => entry.report_id === report_id), "no longer open").toBe(false);
    const all = (await get("view@uomd.test", "/admin/api/reports?status=all")).body.reports.find((entry: { report_id: string }) => entry.report_id === report_id);
    expect(all).toMatchObject({ resolved_by: "help@uomd.test", resolution: "warned the player, ticket 12" });
    expect((await auditRows(reported.accountId)).map((entry) => entry.action)).toContain("support.resolve_report");
    expect((await get("view@uomd.test", "/admin/api/reports?status=bogus")).status).toBe(400);
  });

  it("resets an inappropriate nickname to a placeholder the player can replace at once", async () => {
    const target = await player();
    await game()(new Request("https://api.test/v1/profile", {
      method: "POST",
      headers: { authorization: `Bearer ${target.token}`, "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ nickname: `Rude${counter}` }),
    }));
    const reset = await post("help@uomd.test", `/admin/api/players/${target.accountId}/reset-nickname`, { reason: "offensive name, report 4" });
    expect(reset.body.previous_nickname).toBe(`Rude${counter}`);
    expect(reset.body.nickname).toMatch(/^Player[0-9A-F]{6}$/);
    const renamed = await game()(new Request("https://api.test/v1/profile", {
      method: "POST",
      headers: { authorization: `Bearer ${target.token}`, "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({ nickname: `Kind${counter}` }),
    }));
    expect(renamed.status, "no wait after a reset").toBe(200);
    expect((await auditRows(target.accountId)).filter((entry) => entry.action === "support.reset_nickname")).toHaveLength(1);
  });
});

describe("AccessJwtVerifier", () => {
  const team = "uomd.cloudflareaccess.com";
  const audience = "a".repeat(64);

  async function setup() {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
    const verifier = new AccessJwtVerifier(team, audience, createLocalJWKSet({ keys: [jwk] }));
    const sign = (claims: Record<string, unknown>, options: { issuer?: string; audience?: string; expires?: string } = {}) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: "RS256", kid: "k1" })
        .setIssuer(options.issuer ?? `https://${team}`)
        .setAudience(options.audience ?? audience)
        .setIssuedAt()
        .setExpirationTime(options.expires ?? "5m")
        .sign(privateKey);
    const request = (token: string) => new Request("https://admin.test/admin/api/me", { headers: { "cf-access-jwt-assertion": token } });
    return { verifier, sign, request };
  }

  it("accepts a token Access issued for this application", async () => {
    const { verifier, sign, request } = await setup();
    expect(await verifier.verify(request(await sign({ email: "Ops@UOMD.test" })))).toEqual({ email: "ops@uomd.test" });
  });

  it("refuses other applications, other issuers, expired, unsigned and e-mail-less tokens", async () => {
    const { verifier, sign, request } = await setup();
    const refused = [
      await sign({ email: "a@b.c" }, { audience: "b".repeat(64) }),
      await sign({ email: "a@b.c" }, { issuer: "https://other.cloudflareaccess.com" }),
      await sign({ email: "a@b.c" }, { expires: "1s ago" }),
      await sign({}),
      "eyJhbGciOiJub25lIn0.eyJlbWFpbCI6ImFAYi5jIn0.",
    ];
    for (const token of refused) await expect(verifier.verify(request(token))).rejects.toBeInstanceOf(AdminAuthError);
    await expect(verifier.verify(new Request("https://admin.test/"))).rejects.toBeInstanceOf(AdminAuthError);
  });

  it("refuses a configuration that is not an Access team and audience", () => {
    expect(() => new AccessJwtVerifier("example.com", audience)).toThrow(/ACCESS_TEAM_DOMAIN/);
    expect(() => new AccessJwtVerifier(team, "short")).toThrow(/ACCESS_AUD/);
  });
});

describe("release control (INF-033, DEC-0040)", () => {
  it("lets an operator set maintenance and the minimum version; the game applies it, audited, without a redeploy", async () => {
    expect((await post("help@uomd.test", "/admin/api/release", { maintenance_message: "x", reason: "support may not" })).status).toBe(403);
    expect((await post("ops@uomd.test", "/admin/api/release", { min_client_version_code: 0, reason: "a bad minimum" })).status).toBe(400);
    const key = crypto.randomUUID();
    const set = await post("ops@uomd.test", "/admin/api/release", { maintenance_message: "Back at 03:00 UTC", min_client_version_code: 3, reason: "database upgrade" }, key);
    expect(set.status).toBe(200);
    expect((await post("ops@uomd.test", "/admin/api/release", { maintenance_message: "other", reason: "database upgrade" }, key)).body, "a replayed key changes nothing").toEqual(set.body);
    const audit = (await database.pool.query("SELECT action, permission, reason FROM admin_audit WHERE operation_key = $1", [key])).rows;
    expect(audit).toEqual([{ action: "release.set_control", permission: "release.write", reason: "database upgrade" }]);

    const live = createApp({ connect: () => database.connect(), verifier: playerVerifier, releaseControl: new ReleaseControlCache(0) });
    const boot = (await (await live(new Request("https://api.test/v1/bootstrap"))).json()) as Record<string, any>;
    expect([boot.min_client_version_code, boot.maintenance.message]).toEqual([3, "Back at 03:00 UTC"]);
    expect((await live(new Request("https://api.test/v1/state", { headers: { "x-client-version-code": "3" } }))).status).toBe(503);
    const listed = await get("view@uomd.test", "/admin/api/release");
    expect(listed.body.revisions[0]).toMatchObject({ maintenance_message: "Back at 03:00 UTC", min_client_version_code: 3, created_by: "ops@uomd.test" });

    expect((await post("ops@uomd.test", "/admin/api/release", { maintenance_message: "", min_client_version_code: 1, reason: "upgrade finished" })).status).toBe(200);
    expect((await live(new Request("https://api.test/v1/state", { headers: { "x-client-version-code": "3" } }))).status, "open again: only the sign-in is missing").toBe(401);
  });
});
