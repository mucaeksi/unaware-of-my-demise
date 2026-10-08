// Social features (INF-037, owner decision D-10, DEC-0037): the LEGACY friends / requests / block / report behaviour
// (Drive: server/social.py, server/repository.py, tests/test_social.py, docs/ONLINE_ACCOUNT_SOCIAL_PART1.md), on the
// tables of migrations 0001 and 0010. No chat, guild, PvP, co-op or resource transfer.
//
// friend_edges holds one row per direction. Every state but `blocked` is a mirrored pair (requester pending_out /
// recipient pending_in sharing one request id; accepted on both sides); `blocked` is one-sided: only the blocker has a
// row, so a lone row toward someone is always a block. Every change to a pair runs under a transaction-scoped advisory
// lock on that pair, so two requests touching the same two players (reciprocal requests, a block during an accept) run
// one after the other instead of deadlocking.
import type { Db } from "./db";
import { randomHex } from "./crypto";
import { ApiError, invalid, isoUtc } from "./http";
import { progression } from "./rules";

/**
 * Anti-abuse limits (versioned server config, as the LEGACY design asks: "define caps and anti-abuse limits in a
 * versioned server config"). Engineering defaults recorded in DEC-0037; the owner may tune them.
 */
export const SOCIAL_LIMITS = {
  version: 1,
  /** Accepted friends per account. */
  friends: 50,
  /** Requests an account may have waiting on others at once. */
  outgoing_pending: 30,
  /** Requests an account may have waiting for its answer; past this, new requests to it are refused. */
  incoming_pending: 100,
  /** Friend requests an account may send per rolling 24 hours. */
  requests_per_day: 30,
  /** Reports an account may file per rolling 24 hours (a repeat about the same player in that time is not a new one). */
  reports_per_day: 10,
  /** Hours between two nickname changes. */
  nickname_change_hours: 24,
  /** A player counts as online for this long after the game last talked to the server. */
  presence_online_minutes: 15,
  /** How often the server refreshes a player's last-seen time at most. */
  presence_refresh_minutes: 5,
  /** Largest page of the friends listing. */
  page_size_max: 100,
} as const;

/** The LEGACY report reasons (client/screens/friends_screen.py). */
export const REPORT_REASONS = ["spam", "harassment", "inappropriate_name", "cheating", "other"] as const;

/** Friend codes: 8 characters of an alphabet without 0/O/1/I/L, shown as XXXX-XXXX (LEGACY repository.py). */
const FRIEND_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;
const ACCOUNT_ID = /^acct_[0-9a-f]{32}$/;
const REQUEST_ID = /^freq_[0-9a-f]{32}$/;

/** Words a nickname may not contain (impersonating the game or its staff). */
const RESERVED_NICKNAME_WORDS = ["admin", "moderator", "support", "official", "staff", "system", "unawareofmydemise"];

type Relationship = "pending_out" | "pending_in" | "accepted";

export interface PublicRecord {
  account_id: string;
  nickname: string;
  avatar_mark_id: string | null;
  player_level: number;
  chapter_badge_id: string | null;
  presence: "online" | "offline";
  relationship: Relationship | "none";
  request_id: string | null;
}

const notFound = (message: string) => new ApiError(404, "NOT_FOUND", message);
const limitReached = (message: string) => new ApiError(409, "LIMIT_REACHED", message);

/** "abcd 2345", "ABCD2345" and "ABCD-2345" are the same code; anything else is refused. */
export function normalizeFriendCode(raw: unknown): string {
  if (typeof raw !== "string") throw invalid("friend_code must be a string");
  const compact = raw.toUpperCase().replace(/[\s-]/g, "");
  const code = compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
  if (!FRIEND_CODE.test(code)) throw invalid("friend_code must look like XXXX-XXXX");
  return code;
}

export function requireAccountId(raw: unknown, field = "account_id"): string {
  if (typeof raw !== "string" || !ACCOUNT_ID.test(raw)) throw invalid(`${field} must be an account id`);
  return raw;
}

export function requireRequestId(raw: unknown): string {
  if (typeof raw !== "string" || !REQUEST_ID.test(raw)) throw notFound("No such friend request");
  return raw;
}

export function requireReason(raw: unknown): (typeof REPORT_REASONS)[number] {
  if (typeof raw !== "string" || !(REPORT_REASONS as readonly string[]).includes(raw)) {
    throw invalid(`reason_key must be one of ${REPORT_REASONS.join(", ")}`);
  }
  return raw as (typeof REPORT_REASONS)[number];
}

/**
 * A nickname the player chose: trimmed and NFC-normalized, 3 to 16 characters of letters, digits, single spaces and
 * _ - . (any script), not made of digits and punctuation only, without a reserved word. Uniqueness (regardless of
 * case) is the database's unique index.
 */
export function parseNickname(raw: unknown): string {
  if (typeof raw !== "string") throw invalid("nickname must be a string");
  const nickname = raw.normalize("NFC").trim();
  const length = [...nickname].length;
  if (length < 3 || length > 16) throw invalid("nickname must be 3 to 16 characters");
  if (!/^[\p{L}\p{N}_.\- ]+$/u.test(nickname) || /\s{2,}/.test(nickname)) {
    throw invalid("nickname may use letters, digits, single spaces and _ - . only");
  }
  if (!/\p{L}/u.test(nickname)) throw invalid("nickname needs at least one letter");
  const folded = nickname.toLowerCase().replace(/[\s_.\-]/g, "");
  if (RESERVED_NICKNAME_WORDS.some((word) => folded.includes(word))) throw invalid("that nickname is reserved");
  return nickname;
}

/** Serializes every change to the relationship of `a` and `b` (in either direction) until the transaction ends. */
async function lockPair(tx: Db, a: string, b: string): Promise<void> {
  const [low, high] = a < b ? [a, b] : [b, a];
  await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`friend:${low}|${high}`]);
}

async function edge(db: Db, owner: string, other: string): Promise<{ state: string; request_id: string | null } | null> {
  const { rows } = await db.query<{ state: string; request_id: string | null }>(
    "SELECT state, request_id FROM friend_edges WHERE owner_account_id = $1 AND other_account_id = $2",
    [owner, other],
  );
  return rows[0] ?? null;
}

async function putEdge(tx: Db, owner: string, other: string, state: string, requestId: string | null): Promise<void> {
  await tx.query(
    `INSERT INTO friend_edges (owner_account_id, other_account_id, state, request_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT (owner_account_id, other_account_id) DO UPDATE SET state = excluded.state, request_id = excluded.request_id, updated_at = now()`,
    [owner, other, state, requestId],
  );
}

async function dropPair(tx: Db, a: string, b: string): Promise<void> {
  await tx.query("DELETE FROM friend_edges WHERE (owner_account_id = $1 AND other_account_id = $2) OR (owner_account_id = $2 AND other_account_id = $1)", [a, b]);
}

async function countEdges(db: Db, owner: string, state: string): Promise<number> {
  const { rows } = await db.query<{ count: string }>("SELECT count(*) FROM friend_edges WHERE owner_account_id = $1 AND state = $2", [owner, state]);
  return Number(rows[0]!.count);
}

/** The public records of `ids` (in that order): never a provider subject, e-mail, friend code or anything private. */
export async function publicRecords(
  db: Db,
  ids: { account_id: string; relationship: PublicRecord["relationship"]; request_id: string | null }[],
  now: Date,
): Promise<PublicRecord[]> {
  if (ids.length === 0) return [];
  const { rows } = await db.query<{
    account_id: string;
    nickname: string;
    avatar_mark_id: string | null;
    chapter_badge_id: string | null;
    presence_opt_in: boolean;
    last_seen_at: Date | null;
    account_xp: string | null;
  }>(
    `SELECT p.account_id, p.nickname, p.avatar_mark_id, p.chapter_badge_id, p.presence_opt_in, p.last_seen_at, w.account_xp
     FROM profiles p LEFT JOIN wallet w ON w.account_id = p.account_id WHERE p.account_id = ANY($1)`,
    [ids.map((id) => id.account_id)],
  );
  const byId = new Map(rows.map((row) => [row.account_id, row]));
  const onlineSince = now.getTime() - SOCIAL_LIMITS.presence_online_minutes * 60_000;
  const rules = progression();
  return ids.flatMap(({ account_id, relationship, request_id }) => {
    const row = byId.get(account_id);
    if (!row) return [];
    const online = row.presence_opt_in && row.last_seen_at !== null && row.last_seen_at.getTime() >= onlineSince;
    return [{
      account_id,
      nickname: row.nickname,
      avatar_mark_id: row.avatar_mark_id,
      player_level: rules.accountLevelForXp(Number(row.account_xp ?? 0)),
      chapter_badge_id: row.chapter_badge_id,
      presence: online ? "online" : "offline",
      relationship,
      request_id,
    }];
  });
}

async function recordOf(db: Db, accountId: string, relationship: PublicRecord["relationship"], requestId: string | null, now: Date): Promise<PublicRecord> {
  const [record] = await publicRecords(db, [{ account_id: accountId, relationship, request_id: requestId }], now);
  if (!record) throw notFound("No such player");
  return record;
}

/**
 * Sends a friend request by friend code (inside the caller's idempotent transaction). Repeating a request that is still
 * waiting, or asking an accepted friend, answers the relationship as it is; asking someone who already asked you
 * accepts theirs (LEGACY: no two crossed requests). Blocked either way: 403, never saying who blocked whom.
 */
export async function sendFriendRequest(tx: Db, accountId: string, friendCode: string, now: Date): Promise<PublicRecord> {
  const { rows } = await tx.query<{ account_id: string }>("SELECT account_id FROM profiles WHERE friend_code = $1", [friendCode]);
  const target = rows[0]?.account_id;
  if (!target) throw notFound("No player has that friend code");
  if (target === accountId) throw invalid("That is your own friend code");
  await lockPair(tx, accountId, target);
  const mine = await edge(tx, accountId, target);
  if (mine?.state === "blocked") throw new ApiError(403, "FORBIDDEN", "You have blocked this player; unblock them first");
  if (mine?.state === "accepted" || mine?.state === "pending_out") return recordOf(tx, target, mine.state, mine.request_id, now);
  if (mine?.state === "pending_in") return acceptPair(tx, accountId, target, now);
  if ((await edge(tx, target, accountId)) !== null) throw new ApiError(403, "FORBIDDEN", "This player is not accepting friend requests");

  const sentToday = await tx.query<{ count: string }>(
    "SELECT count(*) FROM idempotency_keys WHERE account_id = $1 AND endpoint = 'friend_request' AND created_at > now() - interval '24 hours'",
    [accountId],
  );
  if (Number(sentToday.rows[0]!.count) >= SOCIAL_LIMITS.requests_per_day) throw limitReached("Too many friend requests today; try again tomorrow");
  if ((await countEdges(tx, accountId, "pending_out")) >= SOCIAL_LIMITS.outgoing_pending) throw limitReached("Too many requests are still waiting for an answer");
  if ((await countEdges(tx, accountId, "accepted")) >= SOCIAL_LIMITS.friends) throw limitReached("Your friend list is full");
  if ((await countEdges(tx, target, "pending_in")) >= SOCIAL_LIMITS.incoming_pending) throw limitReached("This player has too many requests waiting");

  const requestId = `freq_${randomHex(16)}`;
  await putEdge(tx, accountId, target, "pending_out", requestId);
  await putEdge(tx, target, accountId, "pending_in", requestId);
  return recordOf(tx, target, "pending_out", requestId, now);
}

/** Both sides become friends (the friend limit applies to both). */
async function acceptPair(tx: Db, accountId: string, other: string, now: Date): Promise<PublicRecord> {
  if ((await countEdges(tx, accountId, "accepted")) >= SOCIAL_LIMITS.friends) throw limitReached("Your friend list is full");
  if ((await countEdges(tx, other, "accepted")) >= SOCIAL_LIMITS.friends) throw limitReached("This player's friend list is full");
  await putEdge(tx, accountId, other, "accepted", null);
  await putEdge(tx, other, accountId, "accepted", null);
  return recordOf(tx, other, "accepted", null, now);
}

/** The pending request `requestId` as seen by `accountId` in direction `state`; 404 when there is none. */
async function pendingRequest(tx: Db, accountId: string, requestId: string, state: "pending_in" | "pending_out"): Promise<string> {
  const { rows } = await tx.query<{ other_account_id: string }>(
    "SELECT other_account_id FROM friend_edges WHERE owner_account_id = $1 AND request_id = $2 AND state = $3",
    [accountId, requestId, state],
  );
  const other = rows[0]?.other_account_id;
  if (!other) throw notFound("No such friend request");
  await lockPair(tx, accountId, other);
  // Re-read under the lock: the other side may have cancelled, or blocked, in the meantime.
  const current = await edge(tx, accountId, other);
  if (current?.state !== state || current.request_id !== requestId) throw notFound("No such friend request");
  return other;
}

export async function acceptFriendRequest(tx: Db, accountId: string, requestId: string, now: Date): Promise<PublicRecord> {
  const other = await pendingRequest(tx, accountId, requestId, "pending_in");
  return acceptPair(tx, accountId, other, now);
}

export async function rejectFriendRequest(tx: Db, accountId: string, requestId: string): Promise<{ status: "rejected" }> {
  const other = await pendingRequest(tx, accountId, requestId, "pending_in");
  await dropPair(tx, accountId, other);
  return { status: "rejected" };
}

export async function cancelFriendRequest(tx: Db, accountId: string, requestId: string): Promise<{ status: "cancelled" }> {
  const other = await pendingRequest(tx, accountId, requestId, "pending_out");
  await dropPair(tx, accountId, other);
  return { status: "cancelled" };
}

export async function removeFriend(tx: Db, accountId: string, other: string): Promise<{ status: "removed" }> {
  if (other === accountId) throw invalid("You are not your own friend");
  await lockPair(tx, accountId, other);
  if ((await edge(tx, accountId, other))?.state !== "accepted") throw notFound("That player is not your friend");
  await dropPair(tx, accountId, other);
  return { status: "removed" };
}

/** Blocks `other`: any friendship or request between the two ends, and only the blocker keeps a (one-sided) row. */
export async function blockAccount(tx: Db, accountId: string, other: string): Promise<{ status: "blocked" }> {
  if (other === accountId) throw invalid("You cannot block yourself");
  if ((await tx.query("SELECT 1 FROM account WHERE account_id = $1", [other])).rowCount !== 1) throw notFound("No such player");
  await lockPair(tx, accountId, other);
  await dropPair(tx, accountId, other);
  await putEdge(tx, accountId, other, "blocked", null);
  return { status: "blocked" };
}

/** Ends a block `accountId` placed; the other player's own block of `accountId`, if any, stays. */
export async function unblockAccount(tx: Db, accountId: string, other: string): Promise<{ status: "unblocked" }> {
  await lockPair(tx, accountId, other);
  const { rowCount } = await tx.query("DELETE FROM friend_edges WHERE owner_account_id = $1 AND other_account_id = $2 AND state = 'blocked'", [accountId, other]);
  if (rowCount !== 1) throw notFound("That player is not blocked");
  return { status: "unblocked" };
}

/** Files a report (a repeat about the same player within 24 hours answers the earlier one). */
export async function reportAccount(tx: Db, accountId: string, other: string, reason: string): Promise<{ status: "reported"; report_id: string }> {
  if (other === accountId) throw invalid("You cannot report yourself");
  if ((await tx.query("SELECT 1 FROM account WHERE account_id = $1", [other])).rowCount !== 1) throw notFound("No such player");
  const recent = await tx.query<{ report_id: string }>(
    "SELECT report_id FROM reports WHERE reporter_account_id = $1 AND reported_account_id = $2 AND created_at > now() - interval '24 hours' ORDER BY created_at DESC LIMIT 1",
    [accountId, other],
  );
  if (recent.rows[0]) return { status: "reported", report_id: recent.rows[0].report_id };
  const today = await tx.query<{ count: string }>(
    "SELECT count(*) FROM reports WHERE reporter_account_id = $1 AND created_at > now() - interval '24 hours'",
    [accountId],
  );
  if (Number(today.rows[0]!.count) >= SOCIAL_LIMITS.reports_per_day) throw limitReached("Too many reports today; try again tomorrow");
  const reportId = `report_${randomHex(16)}`;
  await tx.query("INSERT INTO reports (report_id, reporter_account_id, reported_account_id, reason_key) VALUES ($1, $2, $3, $4)", [reportId, accountId, other, reason]);
  return { status: "reported", report_id: reportId };
}

/** One page of the account's friends and requests (blocks are listed apart), newest change first. */
export async function listFriends(db: Db, accountId: string, cursor: string | null, limit: number, now: Date): Promise<Record<string, unknown>> {
  if (!Number.isInteger(limit) || limit < 1 || limit > SOCIAL_LIMITS.page_size_max) throw invalid(`limit must be 1 to ${SOCIAL_LIMITS.page_size_max}`);
  const params: unknown[] = [accountId, limit + 1];
  let where = "owner_account_id = $1 AND state <> 'blocked'";
  if (cursor !== null) {
    const match = /^(\d{1,20})\.(acct_[0-9a-f]{32})$/.exec(cursor);
    if (!match) throw invalid("cursor is not one this server issued");
    params.push(match[1], match[2]);
    where += " AND ((extract(epoch FROM updated_at) * 1000000)::bigint, other_account_id) < ($3::bigint, $4)";
  }
  const { rows } = await db.query<{ other_account_id: string; state: Relationship; request_id: string | null; updated_us: string }>(
    `SELECT other_account_id, state, request_id, (extract(epoch FROM updated_at) * 1000000)::bigint AS updated_us
     FROM friend_edges WHERE ${where} ORDER BY updated_at DESC, other_account_id DESC LIMIT $2`,
    params,
  );
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const counts = await db.query<{ state: string; count: string }>(
    "SELECT state, count(*) FROM friend_edges WHERE owner_account_id = $1 GROUP BY state",
    [accountId],
  );
  const count = (state: string) => Number(counts.rows.find((row) => row.state === state)?.count ?? 0);
  return {
    items: await publicRecords(db, page.map((row) => ({ account_id: row.other_account_id, relationship: row.state, request_id: row.request_id })), now),
    next_cursor: rows.length > limit && last ? `${last.updated_us}.${last.other_account_id}` : null,
    counts: { friends: count("accepted"), incoming: count("pending_in"), outgoing: count("pending_out"), blocked: count("blocked") },
    limits: { friends: SOCIAL_LIMITS.friends, outgoing_pending: SOCIAL_LIMITS.outgoing_pending },
  };
}

/** The players the account blocked (nickname only: a block is not a relationship). */
export async function listBlocks(db: Db, accountId: string): Promise<Record<string, unknown>> {
  const { rows } = await db.query<{ account_id: string; nickname: string; blocked_at: Date }>(
    `SELECT e.other_account_id AS account_id, p.nickname, e.updated_at AS blocked_at FROM friend_edges e
     JOIN profiles p ON p.account_id = e.other_account_id
     WHERE e.owner_account_id = $1 AND e.state = 'blocked' ORDER BY e.updated_at DESC LIMIT 200`,
    [accountId],
  );
  return { items: rows.map((row) => ({ account_id: row.account_id, nickname: row.nickname, blocked_at_utc: isoUtc(row.blocked_at) })) };
}

/** The account's own profile as GET /v1/account shows it, with when the nickname may next change. */
export async function ownProfile(db: Db, accountId: string, now: Date): Promise<Record<string, unknown>> {
  const { rows } = await db.query<{ friend_code: string; nickname: string; avatar_mark_id: string | null; chapter_badge_id: string | null; presence_opt_in: boolean; nickname_changed_at: Date | null }>(
    "SELECT friend_code, nickname, avatar_mark_id, chapter_badge_id, presence_opt_in, nickname_changed_at FROM profiles WHERE account_id = $1",
    [accountId],
  );
  const row = rows[0];
  if (!row) throw notFound("No profile");
  const next = row.nickname_changed_at === null ? null : new Date(row.nickname_changed_at.getTime() + SOCIAL_LIMITS.nickname_change_hours * 3_600_000);
  const { nickname_changed_at: _changed, ...profile } = row;
  return { ...profile, nickname_change_available_at_utc: next !== null && next > now ? isoUtc(next) : null };
}

/** Changes the nickname and/or the presence setting (inside the caller's idempotent transaction). */
export async function updateProfile(tx: Db, accountId: string, body: Record<string, unknown>, now: Date): Promise<Record<string, unknown>> {
  const { nickname, presence_opt_in, ...rest } = body;
  if (Object.keys(rest).length > 0) throw invalid(`unknown profile fields: ${Object.keys(rest).join(", ")}`);
  if (nickname === undefined && presence_opt_in === undefined) throw invalid("nothing to change");
  if (presence_opt_in !== undefined) {
    if (typeof presence_opt_in !== "boolean") throw invalid("presence_opt_in must be true or false");
    await tx.query("UPDATE profiles SET presence_opt_in = $2, updated_at = now() WHERE account_id = $1", [accountId, presence_opt_in]);
  }
  if (nickname !== undefined) {
    const chosen = parseNickname(nickname);
    const { rows } = await tx.query<{ nickname: string; nickname_changed_at: Date | null }>(
      "SELECT nickname, nickname_changed_at FROM profiles WHERE account_id = $1 FOR UPDATE",
      [accountId],
    );
    const current = rows[0];
    if (!current) throw notFound("No profile");
    if (current.nickname !== chosen) {
      const wait = current.nickname_changed_at === null ? 0 : current.nickname_changed_at.getTime() + SOCIAL_LIMITS.nickname_change_hours * 3_600_000 - now.getTime();
      if (wait > 0) throw new ApiError(429, "RATE_LIMITED", `The nickname can change again at ${isoUtc(new Date(now.getTime() + wait))}`);
      try {
        await tx.query("UPDATE profiles SET nickname = $2, nickname_changed_at = $3, updated_at = now() WHERE account_id = $1", [accountId, chosen, now]);
      } catch (error) {
        // The unique index (regardless of case); the whole request rolls back, the presence change with it.
        if ((error as { code?: string }).code === "23505") throw new ApiError(409, "NICKNAME_TAKEN", "That nickname is taken");
        throw error;
      }
    }
  }
  return ownProfile(tx, accountId, now);
}

/** Refreshes the coarse presence of the account (at most every few minutes: one cheap conditional update). */
export async function touchPresence(db: Db, accountId: string): Promise<void> {
  await db.query(
    "UPDATE profiles SET last_seen_at = now() WHERE account_id = $1 AND (last_seen_at IS NULL OR last_seen_at < now() - make_interval(mins => $2))",
    [accountId, SOCIAL_LIMITS.presence_refresh_minutes],
  );
}
