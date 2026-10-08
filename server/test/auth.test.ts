import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type AppDeps } from "../src/app";
import { IdentityVerificationError, type IdentityVerifier, type VerifiedIdentity } from "../src/identity";
import { createTestDatabase, type TestDatabase } from "./db";

/** LEGACY FakeGoogleIdentityVerifier: registered credential strings stand in for real ID tokens, no network. */
class FakeVerifier implements IdentityVerifier {
  readonly fixtures = new Map<string, VerifiedIdentity>();

  async verify(credential: string): Promise<VerifiedIdentity> {
    const identity = this.fixtures.get(credential);
    if (!identity) throw new IdentityVerificationError("Unrecognized test credential");
    return identity;
  }
}

let database: TestDatabase;
const verifier = new FakeVerifier();

beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database?.close();
});

interface Call {
  body?: unknown;
  raw?: string;
  token?: string;
}

async function call(method: string, path: string, init: Call = {}, deps: Partial<AppDeps> = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const body = init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body));
  const app = createApp({ connect: () => database.connect(), verifier, ...deps });
  const response = await app(new Request(`https://api.test${path}`, { method, headers, body }));
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function nonce(): Promise<string> {
  const { status, body } = await call("POST", "/v1/auth/nonce");
  expect(status).toBe(200);
  return body.nonce;
}

/** Signs `subject` in with a fresh nonce. */
async function signIn(subject: string) {
  const issued = await nonce();
  const credential = `cred-${subject}-${issued}`;
  verifier.fixtures.set(credential, { provider: "google_oidc", subject, nonce: issued });
  return call("POST", "/v1/auth/google", { body: { credential } });
}

describe("health and routing", () => {
  it("answers health with the database reachable", async () => {
    expect(await call("GET", "/healthz")).toEqual({ status: 200, body: { status: "ok" } });
  });

  it("uses the LEGACY error shape for unknown routes and methods", async () => {
    expect(await call("GET", "/v1/nope")).toEqual({ status: 404, body: { error: { code: "HTTP_ERROR", message: "Not Found" } } });
    expect((await call("GET", "/v1/auth/nonce")).status).toBe(405);
  });

  it("rate-limits by client, never the health check", async () => {
    const limiter = { limit: async () => ({ success: false }) } as unknown as RateLimit;
    const limited = await call("POST", "/v1/auth/nonce", {}, { authLimiter: limiter });
    expect(limited).toEqual({ status: 429, body: { error: { code: "RATE_LIMITED", message: "Too many requests" } } });
    expect((await call("GET", "/healthz", {}, { apiLimiter: limiter, authLimiter: limiter })).status).toBe(200);
  });
});

describe("sign-in", () => {
  it("issues nonces that expire in five minutes", async () => {
    const { body } = await call("POST", "/v1/auth/nonce");
    expect(body.nonce).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(body.expires_at_utc).toMatch(/Z$/);
    const seconds = (Date.parse(body.expires_at_utc) - Date.now()) / 1000;
    expect(seconds).toBeGreaterThan(290);
    expect(seconds).toBeLessThanOrEqual(300);
  });

  it("creates an account on first sign-in and restores it afterwards", async () => {
    const first = await signIn("subject-a");
    expect(first.status).toBe(200);
    expect(first.body.account_id).toMatch(/^acct_[0-9a-f]{32}$/);
    expect(first.body.is_new_account).toBe(true);
    expect(first.body.session_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const again = await signIn("subject-a");
    expect(again.body.account_id).toBe(first.body.account_id);
    expect(again.body.is_new_account).toBe(false);
    expect(again.body.session_token).not.toBe(first.body.session_token);
  });

  it("stores neither the raw subject nor the raw session token", async () => {
    const { body } = await signIn("subject-secret");
    const links = await database.pool.query("SELECT subject_hash FROM provider_links");
    expect(links.rows.map((row) => row.subject_hash).join()).not.toContain("subject-secret");
    const sessions = await database.pool.query("SELECT token_hash FROM sessions");
    expect(sessions.rows.map((row) => row.token_hash)).not.toContain(body.session_token);
  });

  it("rejects unverifiable credentials, missing or unissued nonces and replays", async () => {
    expect((await call("POST", "/v1/auth/google", { body: { credential: "forged" } })).body.error.code).toBe("UNAUTHORIZED");

    verifier.fixtures.set("no-nonce", { provider: "google_oidc", subject: "s", nonce: null });
    expect((await call("POST", "/v1/auth/google", { body: { credential: "no-nonce" } })).status).toBe(401);

    verifier.fixtures.set("unissued", { provider: "google_oidc", subject: "s", nonce: "never-issued" });
    expect((await call("POST", "/v1/auth/google", { body: { credential: "unissued" } })).status).toBe(401);

    const issued = await nonce();
    verifier.fixtures.set("replayed", { provider: "google_oidc", subject: "replay", nonce: issued });
    expect((await call("POST", "/v1/auth/google", { body: { credential: "replayed" } })).status).toBe(200);
    expect((await call("POST", "/v1/auth/google", { body: { credential: "replayed" } })).status).toBe(401);
  });

  it("rejects an expired nonce", async () => {
    const issued = await nonce();
    await database.pool.query("UPDATE auth_nonces SET expires_at = now() - interval '1 second' WHERE nonce = $1", [issued]);
    verifier.fixtures.set("late", { provider: "google_oidc", subject: "late", nonce: issued });
    expect((await call("POST", "/v1/auth/google", { body: { credential: "late" } })).status).toBe(401);
  });

  it("validates the request body", async () => {
    expect((await call("POST", "/v1/auth/google", { raw: "{" })).body.error.code).toBe("INVALID_REQUEST");
    expect((await call("POST", "/v1/auth/google", { body: [] })).status).toBe(400);
    expect((await call("POST", "/v1/auth/google", { body: { credential: "" } })).status).toBe(400);
    expect((await call("POST", "/v1/auth/google", { raw: JSON.stringify({ credential: "x".repeat(20000) }) })).status).toBe(400);
  });

  it("answers 503 while sign-in is not configured", async () => {
    const response = await call("POST", "/v1/auth/google", { body: { credential: "x" } }, { verifier: null });
    expect(response).toEqual({ status: 503, body: { error: { code: "SERVICE_UNAVAILABLE", message: "Sign-in is not configured" } } });
  });
});

describe("sessions and account", () => {
  it("requires a valid bearer token", async () => {
    expect((await call("GET", "/v1/account")).status).toBe(401);
    expect((await call("GET", "/v1/account", { token: "not-a-session" })).status).toBe(401);
  });

  it("returns the profile with a generated friend code and placeholder nickname", async () => {
    const { body: session } = await signIn("subject-profile");
    const { status, body } = await call("GET", "/v1/account", { token: session.session_token });
    expect(status).toBe(200);
    expect(body.account_id).toBe(session.account_id);
    expect(body.friend_code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$/);
    expect(body.nickname).toBe(`Player${session.account_id.slice(-6).toUpperCase()}`);
    expect(body.presence_opt_in).toBe(true);
  });

  it("stops accepting a session once it expires", async () => {
    const { body: session } = await signIn("subject-expiring");
    expect((await call("GET", "/v1/wallet", { token: session.session_token })).status).toBe(200);
    await database.pool.query("UPDATE sessions SET expires_at = now() - interval '1 second' WHERE account_id = $1", [session.account_id]);
    expect((await call("GET", "/v1/wallet", { token: session.session_token })).status).toBe(401);
  });
});
