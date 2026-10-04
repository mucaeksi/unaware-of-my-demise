// The admin API (INF-033/034, DEC-0033), served only by the separate admin Worker behind Cloudflare Access — the game
// Worker has no admin routes. Every request: Access JWT verified → e-mail looked up in admin_users (active) → the role
// must hold the route's permission. Reads of player data are audited; every change is audited in its own transaction
// with a reason and an Idempotency-Key (the same change is never applied twice), and the economic journal of the change
// carries the same key. Mutations also require a same-origin JSON request (the panel's own page), so a link or a form on
// another site cannot trigger one with the operator's Access cookie.
import type { AdminVerifier } from "./admin-auth";
import { AdminAuthError } from "./admin-auth";
import { consistentRead, transaction, type Connect, type Db } from "./db";
import { ApiError, errorResponse, isoUtc, json, readJsonObject } from "./http";
import { setJournalContext } from "./journal";
import { bootstrap, DEVELOPMENT_RELEASE, type ReleaseConfig } from "./release";
import { snapshot } from "./state";

export type AdminRole = "viewer" | "support" | "operator";
export type Permission = "service.read" | "player.read" | "player.support" | "audit.read";

const GRANTS: Record<AdminRole, readonly Permission[]> = {
  viewer: ["service.read", "player.read"],
  support: ["service.read", "player.read", "player.support"],
  operator: ["service.read", "player.read", "player.support", "audit.read"],
};

export interface AdminDeps {
  connect: Connect;
  /** null = Access is not configured: every admin route answers 503. */
  verifier: AdminVerifier | null;
  /** Which deployment this is (recorded with every audit row): production, staging, test. */
  environment: string;
  release?: ReleaseConfig;
  nowUnix?: () => number;
}

interface Operator {
  email: string;
  role: AdminRole;
}

interface AdminContext {
  request: Request;
  url: URL;
  db: Db;
  operator: Operator;
  params: Record<string, string>;
}

const ACCOUNT_ID = /^acct_[0-9a-f]{32}$/;
const FRIEND_CODE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PAGE = 50;

const forbidden = (message: string) => new ApiError(403, "FORBIDDEN", message);

function requirePermission(operator: Operator, permission: Permission): void {
  if (!GRANTS[operator.role].includes(permission)) throw forbidden(`The ${operator.role} role does not have ${permission}`);
}

/** The audit row's config revision: the Worker release and the rules it runs. */
async function configRevision(release: ReleaseConfig): Promise<string> {
  const info = await bootstrap(release, new Date());
  return `${release.sourceSha ?? "unrecorded"}/${String(info.rules_hash).slice(0, 12)}`;
}

async function audit(
  db: Db,
  deps: AdminDeps,
  operator: Operator,
  entry: { permission: Permission; action: string; target?: string | null; reason?: string | null; operationKey?: string | null; request?: unknown; result?: unknown },
): Promise<void> {
  await db.query(
    `INSERT INTO admin_audit (actor_email, actor_role, permission, action, reason, operation_key, target_account_id, environment, config_revision, request, result)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      operator.email,
      operator.role,
      entry.permission,
      entry.action,
      entry.reason ?? null,
      entry.operationKey ?? null,
      entry.target ?? null,
      deps.environment,
      await configRevision(deps.release ?? DEVELOPMENT_RELEASE),
      entry.request === undefined ? null : JSON.stringify(entry.request),
      entry.result === undefined ? null : JSON.stringify(entry.result),
    ],
  );
}

function accountParam(context: AdminContext): string {
  const accountId = context.params.account!;
  if (!ACCOUNT_ID.test(accountId)) throw new ApiError(404, "HTTP_ERROR", "Not Found");
  return accountId;
}

async function requireAccountExists(db: Db, accountId: string): Promise<void> {
  if ((await db.query("SELECT 1 FROM account WHERE account_id = $1", [accountId])).rowCount === 0) throw new ApiError(404, "NOT_FOUND", "No such account");
}

/** A change's reason and key, from the JSON body and the Idempotency-Key header; both are required. */
async function changeRequest(context: AdminContext): Promise<{ reason: string; key: string; body: Record<string, unknown> }> {
  const origin = context.request.headers.get("origin");
  if (origin !== context.url.origin || !(context.request.headers.get("content-type") ?? "").startsWith("application/json")) {
    throw forbidden("Admin changes are accepted only from the admin panel itself");
  }
  const key = context.request.headers.get("idempotency-key") ?? "";
  if (!UUID.test(key)) throw new ApiError(400, "INVALID_REQUEST", "Idempotency-Key must be a UUID");
  const body = await readJsonObject(context.request);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 5 || reason.length > 500) throw new ApiError(400, "INVALID_REQUEST", "A reason of 5 to 500 characters is required");
  return { reason, key, body };
}

type AdminHandler = (context: AdminContext) => Promise<Response>;

function routes(deps: AdminDeps): Record<string, AdminHandler> {
  const now = (): number => Math.floor((deps.nowUnix ?? (() => Date.now() / 1000))());
  return {
    "GET /admin/api/me": async ({ operator }) => json({ email: operator.email, role: operator.role, permissions: GRANTS[operator.role] }),

    "GET /admin/api/service": async ({ db, operator }) => {
      requirePermission(operator, "service.read");
      const release = deps.release ?? DEVELOPMENT_RELEASE;
      // One connection runs one query at a time.
      const ledger = await db.query<{ version: number; filename: string; applied_at: Date }>(
        "SELECT version, filename, applied_at FROM schema_migrations ORDER BY version DESC LIMIT 1",
      );
      const counts = await db.query<{ accounts: string; sessions: string }>(
        "SELECT (SELECT count(*) FROM account) AS accounts, (SELECT count(*) FROM sessions WHERE expires_at > now()) AS sessions",
      );
      return json({
        environment: deps.environment,
        release: await bootstrap(release, new Date(now() * 1000)),
        schema: ledger.rows[0] ? { version: ledger.rows[0].version, filename: ledger.rows[0].filename, applied_at_utc: isoUtc(ledger.rows[0].applied_at) } : null,
        accounts: Number(counts.rows[0]?.accounts ?? 0),
        active_sessions: Number(counts.rows[0]?.sessions ?? 0),
      });
    },

    // Search by account id or friend code (exact): no listing of all players.
    "GET /admin/api/players": async ({ db, url, operator }) => {
      requirePermission(operator, "player.read");
      const query = (url.searchParams.get("query") ?? "").trim();
      const code = query.toUpperCase();
      if (!ACCOUNT_ID.test(query) && !FRIEND_CODE.test(code)) throw new ApiError(400, "INVALID_REQUEST", "Search by account id (acct_...) or friend code (XXXX-XXXX)");
      const { rows } = await db.query<{ account_id: string; friend_code: string; nickname: string; created_at: Date; state_revision: string }>(
        `SELECT a.account_id, p.friend_code, p.nickname, a.created_at, a.state_revision
         FROM account a LEFT JOIN profiles p USING (account_id) WHERE a.account_id = $1 OR p.friend_code = $2`,
        [query, code],
      );
      await audit(db, deps, operator, { permission: "player.read", action: "read.player_search", target: rows[0]?.account_id ?? null, request: { query } });
      return json({
        players: rows.map((row) => ({ ...row, state_revision: Number(row.state_revision), created_at: isoUtc(row.created_at) })),
      });
    },

    "GET /admin/api/players/:account/state": async (context) => {
      requirePermission(context.operator, "player.read");
      const accountId = accountParam(context);
      await requireAccountExists(context.db, accountId);
      const state = await consistentRead(context.db, (tx) => snapshot(tx, accountId, now()));
      await audit(context.db, deps, context.operator, { permission: "player.read", action: "read.player_state", target: accountId });
      return json({ account_id: accountId, state });
    },

    // The economic journal, newest first; `before` = an entry_id to page from.
    "GET /admin/api/players/:account/journal": async (context) => {
      requirePermission(context.operator, "player.read");
      const accountId = accountParam(context);
      const before = Number(context.url.searchParams.get("before") ?? "0");
      const { rows } = await context.db.query(
        `SELECT entry_id::text, operation_key, endpoint, rules_hash, resource_kind, resource_id, delta::text, balance_after::text, detail, created_at
         FROM economy_journal WHERE account_id = $1 AND ($2::bigint = 0 OR entry_id < $2) ORDER BY entry_id DESC LIMIT ${PAGE}`,
        [accountId, Number.isSafeInteger(before) && before > 0 ? before : 0],
      );
      await audit(context.db, deps, context.operator, { permission: "player.read", action: "read.player_journal", target: accountId });
      return json({ account_id: accountId, entries: rows });
    },

    "GET /admin/api/players/:account/pulls": async (context) => {
      requirePermission(context.operator, "player.read");
      const accountId = accountParam(context);
      const { rows } = await context.db.query(
        `SELECT pull_id, seq::text, banner_id, banner_type, rarity, reward_id, is_featured, hard_pity_triggered, created_at
         FROM pull_history WHERE account_id = $1 ORDER BY seq DESC LIMIT ${PAGE}`,
        [accountId],
      );
      await audit(context.db, deps, context.operator, { permission: "player.read", action: "read.player_pulls", target: accountId });
      return json({ account_id: accountId, pulls: rows });
    },

    "GET /admin/api/players/:account/claims": async (context) => {
      requirePermission(context.operator, "player.read");
      const accountId = accountParam(context);
      const story = await context.db.query("SELECT claim_key, character_id, claimed_at FROM story_claims WHERE account_id = $1 ORDER BY claimed_at DESC LIMIT 100", [accountId]);
      const quests = await context.db.query("SELECT claim_key, granted_json, claimed_at FROM quest_claims WHERE account_id = $1 ORDER BY claimed_at DESC LIMIT 100", [accountId]);
      const other = await context.db.query("SELECT reward_type, cycle_id::text, claimed_at, payload FROM claims WHERE account_id = $1 ORDER BY claimed_at DESC LIMIT 100", [accountId]);
      await audit(context.db, deps, context.operator, { permission: "player.read", action: "read.player_claims", target: accountId });
      return json({ account_id: accountId, story: story.rows, quests: quests.rows, other: other.rows });
    },

    // Support: sign the player out everywhere (a lost or shared phone). The change and its audit row commit together.
    "POST /admin/api/players/:account/revoke-sessions": async (context) => {
      requirePermission(context.operator, "player.support");
      const accountId = accountParam(context);
      const change = await changeRequest(context);
      const replay = await context.db.query<{ result: unknown }>("SELECT result FROM admin_audit WHERE operation_key = $1", [change.key]);
      if (replay.rows[0]) return json(replay.rows[0].result);
      await requireAccountExists(context.db, accountId);
      const apply = () => transaction(context.db, async (tx) => {
        await setJournalContext(tx, change.key, "admin:support.revoke_sessions");
        const revoked = await tx.query("DELETE FROM sessions WHERE account_id = $1", [accountId]);
        const outcome = { account_id: accountId, revoked_sessions: revoked.rowCount ?? 0 };
        await audit(tx, deps, context.operator, {
          permission: "player.support",
          action: "support.revoke_sessions",
          target: accountId,
          reason: change.reason,
          operationKey: change.key,
          result: outcome,
        });
        return outcome;
      });
      try {
        return json(await apply());
      } catch (error) {
        // The same key committed concurrently: answer what it did, apply nothing again.
        if ((error as { code?: string }).code !== "23505") throw error;
        const stored = await context.db.query<{ result: unknown }>("SELECT result FROM admin_audit WHERE operation_key = $1", [change.key]);
        if (!stored.rows[0]) throw error;
        return json(stored.rows[0].result);
      }
    },

    "GET /admin/api/audit": async ({ db, url, operator }) => {
      requirePermission(operator, "audit.read");
      const target = url.searchParams.get("target");
      if (target !== null && !ACCOUNT_ID.test(target)) throw new ApiError(400, "INVALID_REQUEST", "target must be an account id");
      const { rows } = await db.query(
        `SELECT audit_id::text, at, actor_email, actor_role, permission, action, reason, operation_key, target_account_id, environment, config_revision, result
         FROM admin_audit WHERE ($1::text IS NULL OR target_account_id = $1) ORDER BY audit_id DESC LIMIT ${PAGE}`,
        [target],
      );
      return json({ entries: rows });
    },
  };
}

function match(table: Record<string, AdminHandler>, method: string, pathname: string): { handler: AdminHandler; params: Record<string, string> } | null {
  const exact = table[`${method} ${pathname}`];
  if (exact) return { handler: exact, params: {} };
  const segments = pathname.split("/");
  for (const [key, handler] of Object.entries(table)) {
    const [routeMethod, pattern] = key.split(" ") as [string, string];
    const parts = pattern.split("/");
    if (routeMethod !== method || parts.length !== segments.length) continue;
    const params: Record<string, string> = {};
    if (parts.every((part, index) => (part.startsWith(":") ? ((params[part.slice(1)] = segments[index]!), /^[A-Za-z0-9_-]{1,64}$/.test(segments[index]!)) : part === segments[index]))) {
      return { handler, params };
    }
  }
  return null;
}

export function createAdminApp(deps: AdminDeps): (request: Request) => Promise<Response> {
  const table = routes(deps);
  return async (request) => {
    const url = new URL(request.url);
    const route = match(table, request.method, url.pathname);
    if (!route) return errorResponse(new ApiError(404, "HTTP_ERROR", "Not Found"));
    if (deps.verifier === null) return errorResponse(new ApiError(503, "SERVICE_UNAVAILABLE", "The admin panel is not configured (Cloudflare Access)"));
    let email: string;
    try {
      email = (await deps.verifier.verify(request)).email;
    } catch (error) {
      if (error instanceof AdminAuthError) return errorResponse(new ApiError(401, "UNAUTHORIZED", error.message));
      throw error;
    }
    let connection;
    try {
      connection = await deps.connect();
      const found = await connection.query<{ role: AdminRole }>("SELECT role FROM admin_users WHERE email = $1 AND disabled_at IS NULL", [email]);
      if (!found.rows[0]) return errorResponse(forbidden(`${email} is not an admin user`));
      return await route.handler({ request, url, db: connection, operator: { email, role: found.rows[0].role }, params: route.params });
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error);
      console.error(JSON.stringify({ event: "admin_error", route: `${request.method} ${url.pathname.replace(/acct_[0-9a-f]{32}/, ":account")}`, error: String((error as Error)?.stack ?? error) }));
      return errorResponse(new ApiError(500, "INTERNAL_ERROR", "Unexpected server error"));
    } finally {
      await connection?.release();
    }
  };
}
