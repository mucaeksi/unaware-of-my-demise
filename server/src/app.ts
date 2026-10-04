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
import { idempotencyKey, runIdempotent } from "./idempotency";
import { ApiError, errorResponse, isoUtc, json, readJsonObject, requireString, unauthorized } from "./http";
import { IdentityVerificationError, type IdentityVerifier } from "./identity";
import { levelUp, parseXpItems, unlockMemoryNode, upgradeSkill } from "./progression";
import { beginAttempt, completeAttempt, parseClientResult, parseRoster, type Simulate } from "./stages";
import { snapshot, wallet } from "./state";
import { advance, claimFirstOath, type StoryStateDict } from "./story";

export interface AppDeps {
  connect: Connect;
  /** null = sign-in is not configured (no Google client ID): /v1/auth/google answers 503. */
  verifier: IdentityVerifier | null;
  authLimiter?: RateLimit;
  apiLimiter?: RateLimit;
  /** Schedules work after the response (the Worker's ctx.waitUntil); awaited inline when absent. */
  waitUntil?: (promise: Promise<unknown>) => void;
  /** Re-runs a stored battle attempt (the battle engine); null = victories cannot be verified yet: 503. */
  simulate?: Simulate | null;
  /** The server clock in UTC unix seconds (quest windows); defaults to the system clock. */
  nowUnix?: () => number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface Context {
  request: Request;
  db: Db;
  /** Path parameters of a pattern route (`:name` segments). */
  params: Record<string, string>;
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

/** The account's story state, read inside the request's transaction (the account row is already locked). */
async function lockedStoryState(tx: Db, accountId: string): Promise<StoryStateDict> {
  const { rows } = await tx.query<{ state: StoryStateDict }>("SELECT state FROM story_state WHERE account_id = $1", [accountId]);
  if (!rows[0]) throw new Error(`account ${accountId} has no story state`);
  return rows[0].state;
}

async function saveStoryState(tx: Db, accountId: string, state: StoryStateDict): Promise<void> {
  await tx.query("UPDATE story_state SET state = $2, updated_at = now() WHERE account_id = $1", [accountId, JSON.stringify(state)]);
}

/**
 * A mutating route: authenticated, idempotent (Idempotency-Key), one transaction with the account row locked. `action`
 * changes the state; the response is the new player snapshot under "state" (the client's `GameBackend` contract).
 */
async function mutate(
  context: Context,
  endpoint: string,
  fingerprint: string,
  action: (tx: Db, accountId: string) => Promise<Record<string, unknown> | void>,
): Promise<Response> {
  const accountId = await requireAccount(context);
  const key = idempotencyKey(context.request);
  const { response } = await runIdempotent(context.db, key, accountId, endpoint, fingerprint, async (tx) => {
    const extra = (await action(tx, accountId)) ?? {};
    return { ...extra, state: await snapshot(tx, accountId) };
  });
  return json(response);
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

    "POST /v1/story/advance": (context) =>
      mutate(context, "story_advance", "", async (tx, accountId) => {
        await saveStoryState(tx, accountId, advance(await lockedStoryState(tx, accountId)));
      }),

    "POST /v1/story/first-oath": async (context) => {
      const characterId = requireString(await readJsonObject(context.request), "character_id", 64);
      return mutate(context, "story_first_oath", characterId, async (tx, accountId) => {
        await saveStoryState(tx, accountId, claimFirstOath(await lockedStoryState(tx, accountId), characterId));
        // The durable one-time record (LEGACY story_claims 'first_oath'); the hero joins the roster at level 1.
        await tx.query("INSERT INTO story_claims (account_id, claim_key, character_id) VALUES ($1, 'first_oath', $2)", [accountId, characterId]);
        await tx.query("INSERT INTO roster (account_id, character_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [accountId, characterId]);
      });
    },

    "POST /v1/stages/:stage_id/attempts": async (context) => {
      const stageId = context.params.stage_id!;
      const roster = parseRoster(await readJsonObject(context.request));
      return mutate(context, "stage_attempt", JSON.stringify([stageId, roster]), async (tx, accountId) => {
        const attempt = await beginAttempt(tx, accountId, await lockedStoryState(tx, accountId), stageId, roster);
        return { attempt };
      });
    },

    "POST /v1/roster/:character_id/level-up": async (context) => {
      const characterId = context.params.character_id!;
      const items = parseXpItems(await readJsonObject(context.request));
      const now = Math.floor((deps.nowUnix ?? (() => Date.now() / 1000))());
      return mutate(context, "roster_level_up", JSON.stringify([characterId, items]), async (tx, accountId) => ({
        ...(await levelUp(tx, accountId, characterId, items, now)),
      }));
    },

    "POST /v1/roster/:character_id/skills/:skill_id/upgrade": (context) => {
      const { character_id: characterId, skill_id: skillId } = context.params as { character_id: string; skill_id: string };
      return mutate(context, "roster_skill_upgrade", JSON.stringify([characterId, skillId]), async (tx, accountId) => ({
        ...(await upgradeSkill(tx, accountId, characterId, skillId)),
      }));
    },

    "POST /v1/roster/:character_id/memory-nodes": (context) => {
      const characterId = context.params.character_id!;
      return mutate(context, "roster_memory_node", characterId, async (tx, accountId) => ({ ...(await unlockMemoryNode(tx, accountId, characterId)) }));
    },

    "POST /v1/attempts/:attempt_id/victory": async (context) => {
      const attemptId = context.params.attempt_id!.toLowerCase();
      if (!UUID.test(attemptId)) throw new ApiError(404, "ITEM_NOT_FOUND", "Unknown battle attempt");
      const client = parseClientResult(await readJsonObject(context.request));
      const simulate = deps.simulate;
      if (!simulate) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Battle verification is not available");
      const now = Math.floor((deps.nowUnix ?? (() => Date.now() / 1000))());
      return mutate(context, "stage_victory", JSON.stringify([attemptId, client]), async (tx, accountId) => {
        const { victory, story, recruits } = await completeAttempt(tx, accountId, await lockedStoryState(tx, accountId), attemptId, client, simulate, now);
        await saveStoryState(tx, accountId, story);
        // Story recruits join the roster at level 1, like the First Oath pick.
        for (const characterId of recruits) {
          await tx.query("INSERT INTO roster (account_id, character_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [accountId, characterId]);
        }
        return { ...victory };
      });
    },
  };
}

/** `:name` segments match one path segment of word characters and dashes (stage ids like "1-2", UUIDs). */
function matchRoute(table: Record<string, Handler>, method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
  const exact = table[`${method} ${pathname}`];
  if (exact) return { handler: exact, params: {} };
  const segments = pathname.split("/");
  for (const [key, handler] of Object.entries(table)) {
    const [routeMethod, pattern] = key.split(" ") as [string, string];
    const parts = pattern.split("/");
    if (routeMethod !== method || parts.length !== segments.length || !parts.some((part) => part.startsWith(":"))) continue;
    const params: Record<string, string> = {};
    const matched = parts.every((part, index) => {
      const segment = segments[index]!;
      if (!part.startsWith(":")) return part === segment;
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(segment)) return false;
      params[part.slice(1)] = segment;
      return true;
    });
    if (matched) return { handler, params };
  }
  return null;
}

/** The client key for rate limiting: Cloudflare's connecting IP (set by the edge, not by the client). */
const clientKey = (request: Request): string => request.headers.get("cf-connecting-ip") ?? "unknown";

export function createApp(deps: AppDeps): (request: Request) => Promise<Response> {
  const table = routes(deps);
  return async (request) => {
    const url = new URL(request.url);
    const route = matchRoute(table, request.method, url.pathname);
    if (!route) {
      const known = ["GET", "POST", "PUT", "PATCH", "DELETE"].some((method) => matchRoute(table, method, url.pathname) !== null);
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
      return await route.handler({ request, db: connection, params: route.params });
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

