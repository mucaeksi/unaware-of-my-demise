// Routes (LEGACY server/app.py paths and payloads). Every handler gets one database connection for the request.
import {
  consumeNonce,
  createAccount,
  createSession,
  ensureProfile,
  findAccountBySubject,
  hashSubject,
  issueNonce,
  resolveSession,
} from "./accounts";
import { transaction, type Connect, type Db } from "./db";
import { ApiError, errorResponse, isoUtc, json, readJsonObject, requireString, unauthorized } from "./http";
import { IdentityVerificationError, type IdentityVerifier } from "./identity";
import { snapshot, wallet } from "./state";

export interface AppDeps {
  connect: Connect;
  /** null = sign-in is not configured (no Google client ID): /v1/auth/google answers 503. */
  verifier: IdentityVerifier | null;
  authLimiter?: RateLimit;
  apiLimiter?: RateLimit;
  /** Schedules work after the response (the Worker's ctx.waitUntil); awaited inline when absent. */
  waitUntil?: (promise: Promise<unknown>) => void;
}

interface Context {
  request: Request;
  db: Db;
}

type Handler = (context: Context) => Promise<Response>;

const UNIQUE_VIOLATION = "23505";

async function requireAccount({ request, db }: Context): Promise<string> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) throw unauthorized("Missing or invalid Authorization header");
  const accountId = await resolveSession(db, token);
  if (accountId === null) throw unauthorized("Session token is missing, invalid or expired");
  return accountId;
}

function routes(deps: AppDeps): Record<string, Handler> {
  return {
    "GET /healthz": async ({ db }) => {
      await db.query("SELECT 1");
      return json({ status: "ok" });
    },

    "POST /v1/auth/nonce": async ({ db }) => {
      const { nonce, expiresAt } = await issueNonce(db);
      return json({ nonce, expires_at_utc: isoUtc(expiresAt) });
    },

    "POST /v1/auth/google": async ({ request, db }) => {
      if (deps.verifier === null) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Sign-in is not configured");
      const credential = requireString(await readJsonObject(request), "credential", 8192);
      let identity;
      try {
        identity = await deps.verifier.verify(credential);
      } catch (error) {
        if (error instanceof IdentityVerificationError) throw unauthorized(error.message);
        throw error;
      }
      if (!identity.nonce) throw unauthorized("Credential is missing a nonce claim");
      // Never-issued, already-used and expired nonces fail alike: telling them apart helps no legitimate retry.
      if (!(await consumeNonce(db, identity.nonce))) throw unauthorized("Invalid, expired or already-used nonce");

      const subjectHash = await hashSubject(identity.provider, identity.subject);
      let accountId = await findAccountBySubject(db, identity.provider, subjectHash);
      const isNewAccount = accountId === null;
      if (accountId === null) {
        try {
          accountId = await transaction(db, (tx) => createAccount(tx, identity.provider, subjectHash));
        } catch (error) {
          // A concurrent first sign-in of the same identity won the race: use its account.
          if ((error as { code?: string }).code !== UNIQUE_VIOLATION) throw error;
          accountId = await findAccountBySubject(db, identity.provider, subjectHash);
          if (accountId === null) throw error;
        }
      }
      const session = await createSession(db, accountId);
      return json({
        account_id: accountId,
        session_token: session.token,
        expires_at_utc: isoUtc(session.expiresAt),
        is_new_account: isNewAccount,
      });
    },

    "GET /v1/account": async (context) => {
      const accountId = await requireAccount(context);
      const created = await context.db.query<{ created_at: Date }>("SELECT created_at FROM account WHERE account_id = $1", [accountId]);
      if (!created.rows[0]) throw new ApiError(404, "ITEM_NOT_FOUND", "Account not found");
      const profile = await ensureProfile(context.db, accountId);
      return json({ account_id: accountId, created_at_utc: isoUtc(created.rows[0].created_at), ...profile });
    },

    "GET /v1/wallet": async (context) => {
      const accountId = await requireAccount(context);
      const balances = await wallet(context.db, accountId);
      if (balances === null) throw new ApiError(404, "ITEM_NOT_FOUND", "Wallet not found");
      return json(balances);
    },

    "GET /v1/state": async (context) => {
      const accountId = await requireAccount(context);
      return json(await snapshot(context.db, accountId));
    },
  };
}

/** The client key for rate limiting: Cloudflare's connecting IP (set by the edge, not by the client). */
const clientKey = (request: Request): string => request.headers.get("cf-connecting-ip") ?? "unknown";

export function createApp(deps: AppDeps): (request: Request) => Promise<Response> {
  const table = routes(deps);
  return async (request) => {
    const url = new URL(request.url);
    const handler = table[`${request.method} ${url.pathname}`];
    if (!handler) {
      const known = Object.keys(table).some((key) => key.endsWith(` ${url.pathname}`));
      return errorResponse(new ApiError(known ? 405 : 404, "HTTP_ERROR", known ? "Method Not Allowed" : "Not Found"));
    }
    if (url.pathname !== "/healthz") {
      const limiter = url.pathname.startsWith("/v1/auth/") ? deps.authLimiter : deps.apiLimiter;
      if (limiter && !(await limiter.limit({ key: clientKey(request) })).success) {
        return errorResponse(new ApiError(429, "RATE_LIMITED", "Too many requests"), { "retry-after": "60" });
      }
    }
    let connection;
    try {
      connection = await deps.connect();
      return await handler({ request, db: connection });
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error);
      console.error("unhandled", request.method, url.pathname, error);
      return errorResponse(new ApiError(500, "INTERNAL_ERROR", "Unexpected server error"));
    } finally {
      if (connection) {
        const released = connection.release().catch((error: unknown) => console.error("release failed", error));
        if (deps.waitUntil) deps.waitUntil(released);
        else await released;
      }
    }
  };
}

