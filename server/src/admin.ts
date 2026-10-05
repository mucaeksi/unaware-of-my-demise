// The admin API (INF-033/034, DEC-0033), served only by the separate admin Worker behind Cloudflare Access — the game
// Worker has no admin routes. Every request: Access JWT verified → e-mail looked up in admin_users (active) → the role
// must hold the route's permission. Reads of player data are audited; every change is audited in its own transaction
// with a reason and an Idempotency-Key (the same change is never applied twice), and the economic journal of the change
// carries the same key. Mutations also require a same-origin JSON request (the panel's own page), so a link or a form on
// another site cannot trigger one with the operator's Access cookie.
import type { AdminVerifier } from "./admin-auth";
import { AdminAuthError } from "./admin-auth";
import { randomHex } from "./crypto";
import { consistentRead, transaction, type Connect, type Db } from "./db";
import { ApiError, errorResponse, isoUtc, json, readJsonObject } from "./http";
import { setJournalContext } from "./journal";
import { bootstrap, DEVELOPMENT_RELEASE, type ReleaseConfig } from "./release";
import { snapshot } from "./state";
import { currentLiveops, parseConfig, parseMail } from "./liveops";

export type AdminRole = "viewer" | "support" | "operator";
export type Permission = "service.read" | "player.read" | "player.support" | "audit.read" | "liveops.write";

const GRANTS: Record<AdminRole, readonly Permission[]> = {
  viewer: ["service.read", "player.read"],
  support: ["service.read", "player.read", "player.support"],
  operator: ["service.read", "player.read", "player.support", "audit.read", "liveops.write"],
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

/**
 * Runs an admin change once per Idempotency-Key: `apply` and its audit row commit in one transaction (the journal of
 * any balance it moves carries the same key); a replayed or concurrently repeated key answers the stored result.
 */
async function auditedChange(
  deps: AdminDeps,
  context: AdminContext,
  change: { reason: string; key: string },
  permission: Permission,
  action: string,
  target: string | null,
  apply: (tx: Db) => Promise<Record<string, unknown>>,
): Promise<Response> {
  const stored = async () => (await context.db.query<{ result: unknown }>("SELECT result FROM admin_audit WHERE operation_key = $1", [change.key])).rows[0];
  const replay = await stored();
  if (replay) return json(replay.result);
  try {
    return json(
      await transaction(context.db, async (tx) => {
        await setJournalContext(tx, change.key, `admin:${action}`);
        const result = await apply(tx);
        await audit(tx, deps, context.operator, { permission, action, target, reason: change.reason, operationKey: change.key, result });
        return result;
      }),
    );
  } catch (error) {
    if ((error as { code?: string }).code !== "23505") throw error;
    const concurrent = await stored();
    if (!concurrent) throw error;
    return json(concurrent.result);
  }
}

function routes(deps: AdminDeps): Record<string, AdminHandler> {
  const now = (): number => Math.floor((deps.nowUnix ?? (() => Date.now() / 1000))());
  const audited = (context: AdminContext, change: { reason: string; key: string }, action: string, target: string | null, apply: (tx: Db) => Promise<Record<string, unknown>>) =>
    auditedChange(deps, context, change, action.startsWith("support.") ? "player.support" : "liveops.write", action, target, apply);
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
      await requireAccountExists(context.db, accountId);
      return audited(context, change, "support.revoke_sessions", accountId, async (tx) => {
        const revoked = await tx.query("DELETE FROM sessions WHERE account_id = $1", [accountId]);
        return { account_id: accountId, revoked_sessions: revoked.rowCount ?? 0 };
      });
    },

    // Moderation (INF-037, DEC-0037): player reports, newest first (open ones by default); `before` = a report's
    // created_at (ISO) to page from.
    "GET /admin/api/reports": async ({ db, url, operator }) => {
      requirePermission(operator, "player.read");
      const status = url.searchParams.get("status") ?? "open";
      if (status !== "open" && status !== "all") throw new ApiError(400, "INVALID_REQUEST", "status is open or all");
      const before = url.searchParams.get("before");
      const beforeDate = before === null ? null : new Date(before);
      if (beforeDate !== null && Number.isNaN(beforeDate.getTime())) throw new ApiError(400, "INVALID_REQUEST", "before must be a timestamp");
      const { rows } = await db.query(
        `SELECT r.report_id, r.reason_key, r.created_at, r.resolved_at, r.resolved_by, r.resolution,
                r.reporter_account_id, reporter.nickname AS reporter_nickname,
                r.reported_account_id, reported.nickname AS reported_nickname, reported.friend_code AS reported_friend_code,
                (SELECT count(*) FROM reports other WHERE other.reported_account_id = r.reported_account_id)::int AS reports_against_player
         FROM reports r
         LEFT JOIN profiles reporter ON reporter.account_id = r.reporter_account_id
         LEFT JOIN profiles reported ON reported.account_id = r.reported_account_id
         WHERE ($1 = 'all' OR r.resolved_at IS NULL) AND ($2::timestamptz IS NULL OR r.created_at < $2)
         ORDER BY r.created_at DESC LIMIT ${PAGE}`,
        [status, beforeDate],
      );
      await audit(db, deps, operator, { permission: "player.read", action: "read.reports", request: { status, before } });
      return json({ reports: rows });
    },

    // A report has been looked at: who, when and what was decided (the reason) are kept on it and in the audit trail.
    "POST /admin/api/reports/:report/resolve": async (context) => {
      requirePermission(context.operator, "player.support");
      const reportId = context.params.report!;
      if (!/^report_[0-9a-f]{32}$/.test(reportId)) throw new ApiError(404, "HTTP_ERROR", "Not Found");
      const change = await changeRequest(context);
      const found = await context.db.query<{ reported_account_id: string; resolved_at: Date | null }>(
        "SELECT reported_account_id, resolved_at FROM reports WHERE report_id = $1",
        [reportId],
      );
      const report = found.rows[0];
      if (!report) throw new ApiError(404, "NOT_FOUND", "No such report");
      return audited(context, change, "support.resolve_report", report.reported_account_id, async (tx) => {
        const updated = await tx.query(
          "UPDATE reports SET resolved_at = now(), resolved_by = $2, resolution = $3 WHERE report_id = $1 AND resolved_at IS NULL",
          [reportId, context.operator.email, change.reason],
        );
        if (updated.rowCount !== 1) throw new ApiError(409, "CONFLICT", "The report was already resolved");
        return { report_id: reportId, resolved: true };
      });
    },

    // An inappropriate nickname goes back to a placeholder; the player may choose a new one at once.
    "POST /admin/api/players/:account/reset-nickname": async (context) => {
      requirePermission(context.operator, "player.support");
      const accountId = accountParam(context);
      const change = await changeRequest(context);
      await requireAccountExists(context.db, accountId);
      return audited(context, change, "support.reset_nickname", accountId, async (tx) => {
        const before = (await tx.query<{ nickname: string }>("SELECT nickname FROM profiles WHERE account_id = $1 FOR UPDATE", [accountId])).rows[0];
        if (!before) throw new ApiError(404, "NOT_FOUND", "The player has no profile");
        for (let attempt = 0; attempt < 5; attempt++) {
          const placeholder = `Player${randomHex(3).toUpperCase()}`;
          const taken = await tx.query("SELECT 1 FROM profiles WHERE lower(nickname) = lower($1)", [placeholder]);
          if (taken.rowCount !== 0) continue;
          await tx.query("UPDATE profiles SET nickname = $2, nickname_changed_at = NULL, updated_at = now() WHERE account_id = $1", [accountId, placeholder]);
          return { account_id: accountId, previous_nickname: before.nickname, nickname: placeholder };
        }
        throw new Error("no free placeholder nickname after 5 attempts");
      });
    },

    // Live operations (INF-035): what runs now, and the last mail sent.
    "GET /admin/api/liveops": async ({ db, operator }) => {
      requirePermission(operator, "service.read");
      const mail = await db.query(
        `SELECT mail_id, account_id, title_en, rewards, starts_at, expires_at, revoked_at, created_by, reason,
                (SELECT count(*) FROM mail_claims c WHERE c.mail_id = m.mail_id)::int AS claims
         FROM mail m ORDER BY created_at DESC LIMIT ${PAGE}`,
      );
      return json({ current: await currentLiveops(db, new Date(now() * 1000)), mail: mail.rows });
    },

    "POST /admin/api/liveops/config": async (context) => {
      requirePermission(context.operator, "liveops.write");
      const change = await changeRequest(context);
      const config = parseConfig(change.body.config);
      return audited(context, change, "liveops.publish_config", null, async (tx) => {
        const { rows } = await tx.query<{ revision: string }>(
          "INSERT INTO liveops_config (config, created_by, reason, operation_key) VALUES ($1, $2, $3, $4) RETURNING revision",
          [JSON.stringify(config), context.operator.email, change.reason, change.key],
        );
        return { revision: Number(rows[0]!.revision), config };
      });
    },

    "POST /admin/api/mail": async (context) => {
      requirePermission(context.operator, "liveops.write");
      const change = await changeRequest(context);
      const mail = parseMail(change.body);
      if (mail.accountId !== null) await requireAccountExists(context.db, mail.accountId);
      const mailId = `mail_${[...crypto.getRandomValues(new Uint8Array(16))].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      return audited(context, change, "liveops.send_mail", mail.accountId, async (tx) => {
        await tx.query(
          `INSERT INTO mail (mail_id, account_id, title_en, body_en, rewards, starts_at, expires_at, created_by, reason, operation_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [mailId, mail.accountId, mail.title, mail.text, JSON.stringify(mail.rewards), mail.starts, mail.expires, context.operator.email, change.reason, change.key],
        );
        return { mail_id: mailId, account_id: mail.accountId, rewards: mail.rewards, starts_at_utc: isoUtc(mail.starts), expires_at_utc: isoUtc(mail.expires) };
      });
    },

    // Stops future claims; what was claimed stays claimed.
    "POST /admin/api/mail/:mail/revoke": async (context) => {
      requirePermission(context.operator, "liveops.write");
      const mailId = context.params.mail!;
      const change = await changeRequest(context);
      return audited(context, change, "liveops.revoke_mail", null, async (tx) => {
        const revoked = await tx.query("UPDATE mail SET revoked_at = now() WHERE mail_id = $1 AND revoked_at IS NULL", [mailId]);
        if (revoked.rowCount !== 1) throw new ApiError(404, "NOT_FOUND", "No such mail, or already revoked");
        return { mail_id: mailId, revoked: true };
      });
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
