// Routes (LEGACY server/app.py paths and payloads). Every handler gets one database connection for the request.
import {
  consumeNonce,
  createAccount,
  createSession,
  deleteAccount,
  ensureProfile,
  findAccountBySubject,
  hashSubject,
  isLinked,
  issueNonce,
  resolveSession,
  revokeSession,
} from "./accounts";
import { consistentRead, transaction, type Connect, type Db } from "./db";
import { setJournalContext } from "./journal";
import { committedOperation, idempotencyKey, runIdempotent } from "./idempotency";
import { ApiError, errorResponse, isoUtc, json, readJsonObject, requireString, unauthorized } from "./http";
import { IdentityVerificationError, type IdentityVerifier } from "./identity";
import {
  dismantleWeapon,
  equip,
  levelUpEquipment,
  parseCharacterId,
  parseLocked,
  parseTable,
  parseTargetLevels,
  rerollAccessory,
  setLocked,
  unequip,
} from "./equipment";
import { banners, convertToFateThreads, history, parsePullRequest, pity, pull } from "./gacha";
import { pullFingerprint } from "./engine/gacha";
import { claimQuest, parseQuestClaim, questStatus } from "./quest-claims";
import { levelUp, parseXpItems, unlockMemoryNode, upgradeSkill } from "./progression";
import { abandonAttempt, beginAttempt, completeAttempt, parseClientResult, parseRoster, type Simulate } from "./stages";
import { claimInnMeal } from "./ration";
import { admit, bootstrap, DEVELOPMENT_RELEASE, type ReleaseConfig } from "./release";
import { bumpStateRevision, snapshot, wallet } from "./state";
import { currentRelease, packResponse, type ContentStore } from "./content";
import { claimMail, currentLiveops, listMail } from "./liveops";
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
  /** The banner rotation launch instant; null/absent = undated development rotation (the first banner pair stays open). */
  bannerEpoch?: Date | null;
  /** This deployment's release identity, client floor and maintenance switch; defaults to `DEVELOPMENT_RELEASE`. */
  release?: ReleaseConfig;
  /** Where the structured request and error log lines go (INF-011); defaults to the Worker log (console). */
  log?: (entry: LogEntry) => void;
  /** The private content bucket (INF-029); null/absent = content delivery answers 503. */
  content?: ContentStore | null;
  /** The content channel this deployment serves; defaults to "production". */
  contentChannel?: string;
}

/**
 * One structured log line (INF-011). Never carries a header, a body, a token or a credential: the route is the pattern
 * (ids stay out), and an error carries its message and stack only.
 */
export interface LogEntry {
  event: "request" | "unhandled_error";
  request_id: string;
  method: string;
  route: string;
  status?: number;
  duration_ms?: number;
  source_sha?: string | null;
  error?: string;
}

const consoleLog = (entry: LogEntry): void => (entry.event === "request" ? console.log : console.error)(JSON.stringify(entry));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface Context {
  request: Request;
  db: Db;
  /** Path parameters of a pattern route (`:name` segments). */
  params: Record<string, string>;
}

type Handler = (context: Context) => Promise<Response>;

const UNIQUE_VIOLATION = "23505";

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

async function requireAccount({ request, db }: Context): Promise<string> {
  const token = bearerToken(request);
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
 * changes the state; the response is the new player snapshot under "state" (the client's `GameBackend` contract), whose
 * `state_revision` the commit raised by one. A replay answers the stored response, revision included.
 */
async function mutate(
  context: Context,
  endpoint: string,
  fingerprint: string,
  action: (tx: Db, accountId: string) => Promise<Record<string, unknown> | void>,
  nowUnix: number,
): Promise<Response> {
  const accountId = await requireAccount(context);
  const key = idempotencyKey(context.request);
  const { response } = await runIdempotent(context.db, key, accountId, endpoint, fingerprint, async (tx) => {
    // Every balance or inventory change below is journaled with this request (INF-015).
    await setJournalContext(tx, key, endpoint);
    const extra = (await action(tx, accountId)) ?? {};
    await bumpStateRevision(tx, accountId);
    return { ...extra, state: await snapshot(tx, accountId, nowUnix) };
  });
  return json(response);
}

function routes(deps: AppDeps): Record<string, Handler> {
  /** The provider identity of a `{credential}` body: verified, with its single-use server nonce consumed. */
  const verifiedIdentity = async (request: Request, db: Db): Promise<{ provider: string; subjectHash: string }> => {
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
    return { provider: identity.provider, subjectHash: await hashSubject(identity.provider, identity.subject) };
  };

  /** The server clock in whole UTC seconds (quest windows, Ration). */
  const clock = (): number => Math.floor((deps.nowUnix ?? (() => Date.now() / 1000))());
  const mutateNow = (...args: [Context, string, string, (tx: Db, accountId: string) => Promise<Record<string, unknown> | void>]) => mutate(...args, clock());
  return {
    "GET /healthz": async ({ db }) => {
      await db.query("SELECT 1");
      return json({ status: "ok" });
    },

    // Unauthenticated and outside the update/maintenance gate: a client asks it first to learn whether it may play.
    "GET /v1/bootstrap": async () => json(await bootstrap(deps.release ?? DEVELOPMENT_RELEASE, new Date(clock() * 1000))),

    // Content patches (INF-029): signed-in players only; the bucket itself is private.
    "GET /v1/content/current": async (context) => {
      await requireAccount(context);
      return json(await currentRelease(deps.content ?? null, deps.contentChannel ?? "production"));
    },

    "GET /v1/content/packs/:sha256": async (context) => {
      await requireAccount(context);
      return packResponse(deps.content ?? null, context.params.sha256!, context.request.headers.get("range"));
    },

    "POST /v1/auth/nonce": async ({ db }) => {
      const { nonce, expiresAt } = await issueNonce(db);
      return json({ nonce, expires_at_utc: isoUtc(expiresAt) });
    },

    "POST /v1/auth/google": async ({ request, db }) => {
      const identity = await verifiedIdentity(request, db);
      const subjectHash = identity.subjectHash;
      let accountId = await findAccountBySubject(db, identity.provider, subjectHash);
      const isNewAccount = accountId === null;
      if (accountId === null) {
        try {
          accountId = await transaction(db, async (tx) => {
            await setJournalContext(tx, null, "account_create");
            return createAccount(tx, identity.provider, subjectHash);
          });
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

    // INF-019: ends this session; the token stops working at once.
    "POST /v1/auth/logout": async (context) => {
      await requireAccount(context);
      await revokeSession(context.db, bearerToken(context.request));
      return json({ signed_out: true });
    },

    // INF-020: deletes the account and all its data. The session alone is not enough: a fresh credential for a fresh
    // nonce must prove the player holds the identity linked to this account.
    "POST /v1/account/delete": async (context) => {
      const accountId = await requireAccount(context);
      const identity = await verifiedIdentity(context.request, context.db);
      if (!(await isLinked(context.db, accountId, identity.provider, identity.subjectHash))) {
        throw new ApiError(403, "REAUTH_MISMATCH", "The confirmation was signed with another account");
      }
      await transaction(context.db, (tx) => deleteAccount(tx, accountId, identity.provider));
      return json({ deleted: true, account_id: accountId });
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
      const balances = await consistentRead(context.db, (tx) => wallet(tx, accountId, clock()));
      if (balances === null) throw new ApiError(404, "ITEM_NOT_FOUND", "Wallet not found");
      return json(balances);
    },

    "GET /v1/state": async (context) => {
      const accountId = await requireAccount(context);
      return json(await consistentRead(context.db, (tx) => snapshot(tx, accountId, clock())));
    },

    "POST /v1/story/advance": (context) =>
      mutateNow(context, "story_advance", "", async (tx, accountId) => {
        await saveStoryState(tx, accountId, advance(await lockedStoryState(tx, accountId)));
      }),

    "POST /v1/story/first-oath": async (context) => {
      const characterId = requireString(await readJsonObject(context.request), "character_id", 64);
      return mutateNow(context, "story_first_oath", characterId, async (tx, accountId) => {
        await saveStoryState(tx, accountId, claimFirstOath(await lockedStoryState(tx, accountId), characterId));
        // The durable one-time record (LEGACY story_claims 'first_oath'); the hero joins the roster at level 1.
        await tx.query("INSERT INTO story_claims (account_id, claim_key, character_id) VALUES ($1, 'first_oath', $2)", [accountId, characterId]);
        await tx.query("INSERT INTO roster (account_id, character_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [accountId, characterId]);
      });
    },

    "POST /v1/stages/:stage_id/attempts": async (context) => {
      const stageId = context.params.stage_id!;
      const roster = parseRoster(await readJsonObject(context.request));
      const now = clock();
      return mutateNow(context, "stage_attempt", JSON.stringify([stageId, roster]), async (tx, accountId) => {
        const attempt = await beginAttempt(tx, accountId, await lockedStoryState(tx, accountId), stageId, roster, now);
        return { attempt };
      });
    },

    "POST /v1/roster/:character_id/level-up": async (context) => {
      const characterId = context.params.character_id!;
      const items = parseXpItems(await readJsonObject(context.request));
      const now = clock();
      return mutateNow(context, "roster_level_up", JSON.stringify([characterId, items]), async (tx, accountId) => ({
        ...(await levelUp(tx, accountId, characterId, items, now)),
      }));
    },

    "POST /v1/roster/:character_id/skills/:skill_id/upgrade": (context) => {
      const { character_id: characterId, skill_id: skillId } = context.params as { character_id: string; skill_id: string };
      return mutateNow(context, "roster_skill_upgrade", JSON.stringify([characterId, skillId]), async (tx, accountId) => ({
        ...(await upgradeSkill(tx, accountId, characterId, skillId)),
      }));
    },

    "POST /v1/roster/:character_id/memory-nodes": (context) => {
      const characterId = context.params.character_id!;
      return mutateNow(context, "roster_memory_node", characterId, async (tx, accountId) => ({ ...(await unlockMemoryNode(tx, accountId, characterId)) }));
    },

    "POST /v1/inventory/:table/:instance_id/equip": async (context) => {
      const table = parseTable(context.params.table!);
      const instanceId = context.params.instance_id!;
      const characterId = parseCharacterId(await readJsonObject(context.request));
      return mutateNow(context, "inventory_equip", JSON.stringify([table, instanceId, characterId]), (tx, accountId) => equip(tx, accountId, table, instanceId, characterId));
    },

    "POST /v1/inventory/:table/:instance_id/unequip": (context) => {
      const table = parseTable(context.params.table!);
      const instanceId = context.params.instance_id!;
      return mutateNow(context, "inventory_unequip", JSON.stringify([table, instanceId]), (tx, accountId) => unequip(tx, accountId, table, instanceId));
    },

    "POST /v1/inventory/:table/:instance_id/lock": async (context) => {
      const table = parseTable(context.params.table!);
      const instanceId = context.params.instance_id!;
      const locked = parseLocked(await readJsonObject(context.request));
      return mutateNow(context, "inventory_lock", JSON.stringify([table, instanceId, locked]), (tx, accountId) => setLocked(tx, accountId, table, instanceId, locked));
    },

    "POST /v1/inventory/inventory_weapons/:instance_id/dismantle": (context) => {
      const instanceId = context.params.instance_id!;
      return mutateNow(context, "inventory_dismantle", instanceId, async (tx, accountId) => ({ ...(await dismantleWeapon(tx, accountId, instanceId)) }));
    },

    "POST /v1/inventory/:table/:instance_id/level-up": async (context) => {
      const table = parseTable(context.params.table!);
      const instanceId = context.params.instance_id!;
      const targetLevels = parseTargetLevels(await readJsonObject(context.request));
      const now = clock();
      return mutateNow(context, "inventory_level_up", JSON.stringify([table, instanceId, targetLevels]), async (tx, accountId) => ({
        ...(await levelUpEquipment(tx, accountId, table, instanceId, targetLevels, now)),
      }));
    },

    "POST /v1/inventory/inventory_accessories/:instance_id/reroll": (context) => {
      const instanceId = context.params.instance_id!;
      return mutateNow(context, "inventory_reroll", instanceId, (tx, accountId) => rerollAccessory(tx, accountId, instanceId));
    },

    // INF-013: whether a mutation whose reply was lost committed, and what it answered then.
    "GET /v1/operations/:key": async (context) => {
      const accountId = await requireAccount(context);
      const operation = await committedOperation(context.db, accountId, context.params.key!.toLowerCase());
      if (!operation) throw new ApiError(404, "ITEM_NOT_FOUND", "No committed operation with this key");
      return json(operation);
    },

    "POST /v1/attempts/:attempt_id/abandon": (context) => {
      const attemptId = context.params.attempt_id!.toLowerCase();
      if (!UUID.test(attemptId)) throw new ApiError(404, "ITEM_NOT_FOUND", "Unknown battle attempt");
      return mutateNow(context, "stage_abandon", attemptId, async (tx, accountId) => ({ ...(await abandonAttempt(tx, accountId, attemptId)) }));
    },

    "GET /v1/quests/status": async (context) => {
      const accountId = await requireAccount(context);
      return json(await questStatus(context.db, accountId, clock()));
    },

    "POST /v1/quests/claim": async (context) => {
      const request = parseQuestClaim(await readJsonObject(context.request));
      const now = clock();
      return mutateNow(context, "quest_claim", JSON.stringify(request), async (tx, accountId) => ({ ...(await claimQuest(tx, accountId, request, now)) }));
    },

    "GET /v1/gacha/banners": async (context) => {
      const accountId = await requireAccount(context);
      return json(await banners(context.db, accountId, clock(), deps.bannerEpoch ?? null));
    },

    "GET /v1/gacha/pity": async (context) => {
      const accountId = await requireAccount(context);
      return json(await pity(context.db, accountId));
    },

    "GET /v1/gacha/history": async (context) => {
      const accountId = await requireAccount(context);
      return json(await history(context.db, accountId, new URL(context.request.url)));
    },

    "POST /v1/gacha/pull": async (context) => {
      const request = parsePullRequest(await readJsonObject(context.request));
      const now = clock();
      return mutateNow(context, "gacha_pull", pullFingerprint(request.banner_id, request.pull_count, request.target_id), async (tx, accountId) => ({
        pull: await pull(tx, accountId, request, now, deps.bannerEpoch ?? null),
      }));
    },

    // Live operations (INF-035): flags and notices for everyone; mail and its one-time rewards per account.
    "GET /v1/liveops": async ({ db }) => json(await currentLiveops(db, new Date(clock() * 1000))),

    "GET /v1/mail": async (context) => {
      const accountId = await requireAccount(context);
      return json({ mail: await listMail(context.db, accountId, new Date(clock() * 1000)) });
    },

    "POST /v1/mail/:mail_id/claim": async (context) => {
      const mailId = context.params.mail_id!;
      if (!/^mail_[0-9a-f]{32}$/.test(mailId)) throw new ApiError(404, "NOT_FOUND", "No such mail");
      const now = new Date(clock() * 1000);
      const key = idempotencyKey(context.request);
      return mutateNow(context, "mail_claim", mailId, async (tx, accountId) => ({ ...(await claimMail(tx, accountId, mailId, now, key)) }));
    },

    "POST /v1/ration/inn-meal": async (context) => {
      const now = clock();
      return mutateNow(context, "ration_inn_meal", "", async (tx, accountId) => ({ ...(await claimInnMeal(tx, accountId, now)) }));
    },

    "POST /v1/wallet/convert": async (context) => {
      const { count = 1 } = await readJsonObject(context.request);
      if (typeof count !== "number" || !Number.isSafeInteger(count)) throw new ApiError(400, "INVALID_REQUEST", "count must be an integer");
      return mutateNow(context, "wallet_convert", String(count), async (tx, accountId) => ({ ...(await convertToFateThreads(tx, accountId, count)) }));
    },

    "POST /v1/attempts/:attempt_id/victory": async (context) => {
      const attemptId = context.params.attempt_id!.toLowerCase();
      if (!UUID.test(attemptId)) throw new ApiError(404, "ITEM_NOT_FOUND", "Unknown battle attempt");
      const client = parseClientResult(await readJsonObject(context.request));
      const simulate = deps.simulate;
      if (!simulate) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Battle verification is not available");
      const now = clock();
      return mutateNow(context, "stage_victory", JSON.stringify([attemptId, client]), async (tx, accountId) => {
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
function matchRoute(
  table: Record<string, Handler>,
  method: string,
  pathname: string,
): { handler: Handler; params: Record<string, string>; route: string } | null {
  const exact = table[`${method} ${pathname}`];
  if (exact) return { handler: exact, params: {}, route: `${method} ${pathname}` };
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
    if (matched) return { handler, params, route: key };
  }
  return null;
}

/** The client key for rate limiting: Cloudflare's connecting IP (set by the edge, not by the client). */
const clientKey = (request: Request): string => request.headers.get("cf-connecting-ip") ?? "unknown";

/** Routes that answer whatever the client version or maintenance state (liveness, and the bootstrap that reports both). */
const UNGATED = new Set(["/healthz", "/v1/bootstrap"]);
/** Routes that read no database, so they answer during a database outage too (the bootstrap carries the maintenance notice). */
const NO_DATABASE = new Set(["/v1/bootstrap"]);
const noDatabase: Db = {
  query: () => Promise.reject(new Error("this route has no database connection")),
};

export function createApp(deps: AppDeps): (request: Request) => Promise<Response> {
  const table = routes(deps);
  const release = deps.release ?? DEVELOPMENT_RELEASE;
  const log = deps.log ?? consoleLog;
  const sourceSha = release.sourceSha?.slice(0, 12) ?? null;

  const handle = async (request: Request, url: URL, requestId: string): Promise<{ response: Response; route: string }> => {
    const route = matchRoute(table, request.method, url.pathname);
    if (!route) {
      const known = ["GET", "POST", "PUT", "PATCH", "DELETE"].some((method) => matchRoute(table, method, url.pathname) !== null);
      return { response: errorResponse(new ApiError(known ? 405 : 404, "HTTP_ERROR", known ? "Method Not Allowed" : "Not Found")), route: "unmatched" };
    }
    const answer = (response: Response) => ({ response, route: route.route });
    if (url.pathname !== "/healthz") {
      const limiter = url.pathname.startsWith("/v1/auth/") ? deps.authLimiter : deps.apiLimiter;
      if (limiter && !(await limiter.limit({ key: clientKey(request) })).success) {
        return answer(errorResponse(new ApiError(429, "RATE_LIMITED", "Too many requests"), { "retry-after": "60" }));
      }
    }
    if (!UNGATED.has(url.pathname)) {
      try {
        admit(request, release);
      } catch (error) {
        if (error instanceof ApiError) return answer(errorResponse(error));
        throw error;
      }
    }
    let connection;
    try {
      if (NO_DATABASE.has(url.pathname)) return answer(await route.handler({ request, db: noDatabase, params: route.params }));
      connection = await deps.connect();
      return answer(await route.handler({ request, db: connection, params: route.params }));
    } catch (error) {
      if (error instanceof ApiError) return answer(errorResponse(error));
      log({
        event: "unhandled_error",
        request_id: requestId,
        method: request.method,
        route: route.route,
        error: error instanceof Error ? (error.stack ?? error.message) : String(error),
      });
      return answer(errorResponse(new ApiError(500, "INTERNAL_ERROR", "Unexpected server error")));
    } finally {
      if (connection) {
        const released = connection.release().catch((error: unknown) => console.error("release failed", error));
        if (deps.waitUntil) deps.waitUntil(released);
        else await released;
      }
    }
  };

  return async (request) => {
    const started = Date.now();
    // Cloudflare's ray id ties the line to the edge logs; elsewhere (tests, local runs) a fresh UUID.
    const requestId = request.headers.get("cf-ray") ?? crypto.randomUUID();
    const url = new URL(request.url);
    const { response, route } = await handle(request, url, requestId);
    response.headers.set("x-request-id", requestId);
    log({ event: "request", request_id: requestId, method: request.method, route, status: response.status, duration_ms: Date.now() - started, source_sha: sourceSha });
    return response;
  };
}

