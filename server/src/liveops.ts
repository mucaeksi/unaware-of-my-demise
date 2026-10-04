// Live operations (INF-035, DEC-0034): versioned remote config (feature flags, notices on a server-UTC schedule) and mail
// with rewards, paid once per account through the mail_claims ledger. Published by operators through the admin API.
import type { Db } from "./db";
import { ApiError, invalid, isoUtc } from "./http";
import { addItemQuantity } from "./rewards";
import { contentRegistry, stackCaps } from "./rules";

export interface Notice {
  notice_id: string;
  title_en: string;
  body_en: string;
  starts_at_utc: string;
  ends_at_utc: string;
}

export interface LiveopsConfig {
  flags: Record<string, boolean>;
  notices: Notice[];
}

export interface MailRewards {
  silver_crowns?: number;
  eclipse_tokens?: number;
  items?: Record<string, number>;
}

/** Upper bounds of one mail's rewards: a typo in the panel cannot mint a fortune. */
export const MAIL_LIMITS = { silver_crowns: 1_000_000, eclipse_tokens: 10_000, item_quantity: 10_000, item_kinds: 10 } as const;
const ID = /^[a-z][a-z0-9_]{0,63}$/;

const text = (value: unknown, field: string, max: number): string => {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) throw invalid(`${field} must be 1 to ${max} characters`);
  return value;
};

const instant = (value: unknown, field: string): Date => {
  const parsed = typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) ? new Date(value) : null;
  if (parsed === null || Number.isNaN(parsed.getTime())) throw invalid(`${field} must be a UTC timestamp like 2026-10-05T00:00:00Z`);
  return parsed;
};

/** A config an operator publishes, checked and normalized; anything unexpected is refused, not ignored. */
export function parseConfig(value: unknown): LiveopsConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalid("config must be an object");
  const { flags = {}, notices = [], ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0) throw invalid(`unknown config fields: ${Object.keys(rest).join(", ")}`);
  if (typeof flags !== "object" || flags === null || Array.isArray(flags)) throw invalid("flags must be an object");
  const parsedFlags: Record<string, boolean> = {};
  for (const [name, enabled] of Object.entries(flags)) {
    if (!ID.test(name) || typeof enabled !== "boolean") throw invalid(`flag ${name} must be a snake_case name with a boolean value`);
    parsedFlags[name] = enabled;
  }
  if (!Array.isArray(notices) || notices.length > 20) throw invalid("notices must be a list of at most 20");
  const seen = new Set<string>();
  const parsedNotices = notices.map((notice: unknown) => {
    const row = (notice ?? {}) as Record<string, unknown>;
    const id = String(row.notice_id ?? "");
    if (!ID.test(id) || seen.has(id)) throw invalid(`notice_id ${id} must be a unique snake_case id`);
    seen.add(id);
    const starts = instant(row.starts_at_utc, "starts_at_utc");
    const ends = instant(row.ends_at_utc, "ends_at_utc");
    if (ends <= starts) throw invalid(`notice ${id} ends before it starts`);
    return { notice_id: id, title_en: text(row.title_en, "title_en", 120), body_en: text(row.body_en, "body_en", 2000), starts_at_utc: isoUtc(starts), ends_at_utc: isoUtc(ends) };
  });
  return { flags: parsedFlags, notices: parsedNotices };
}

/** What a client sees: the current revision's flags and the notices running now. No config yet = revision 0, nothing on. */
export async function currentLiveops(db: Db, now: Date): Promise<Record<string, unknown>> {
  const { rows } = await db.query<{ revision: string; config: LiveopsConfig }>("SELECT revision, config FROM liveops_config ORDER BY revision DESC LIMIT 1");
  const config = rows[0]?.config ?? { flags: {}, notices: [] };
  return {
    revision: Number(rows[0]?.revision ?? 0),
    flags: config.flags,
    notices: config.notices.filter((notice) => new Date(notice.starts_at_utc) <= now && now < new Date(notice.ends_at_utc)),
    server_time_utc: isoUtc(now),
  };
}

/** Mail rewards an operator attaches, checked against the content (known items) and MAIL_LIMITS. */
export function parseRewards(value: unknown): MailRewards {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw invalid("rewards must be an object");
  const { silver_crowns, eclipse_tokens, items, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0) throw invalid(`unknown reward fields: ${Object.keys(rest).join(", ")}`);
  const amount = (raw: unknown, field: string, max: number): number | undefined => {
    if (raw === undefined) return undefined;
    if (typeof raw !== "number" || !Number.isSafeInteger(raw) || raw < 1 || raw > max) throw invalid(`${field} must be an integer from 1 to ${max}`);
    return raw;
  };
  const rewards: MailRewards = {};
  const silver = amount(silver_crowns, "silver_crowns", MAIL_LIMITS.silver_crowns);
  const tokens = amount(eclipse_tokens, "eclipse_tokens", MAIL_LIMITS.eclipse_tokens);
  if (silver !== undefined) rewards.silver_crowns = silver;
  if (tokens !== undefined) rewards.eclipse_tokens = tokens;
  if (items !== undefined) {
    if (typeof items !== "object" || items === null || Array.isArray(items)) throw invalid("items must be an object of item id to quantity");
    const entries = Object.entries(items);
    if (entries.length > MAIL_LIMITS.item_kinds) throw invalid(`at most ${MAIL_LIMITS.item_kinds} kinds of items`);
    const known = contentRegistry().items;
    rewards.items = {};
    for (const [itemId, quantity] of entries) {
      if (!known.has(itemId)) throw invalid(`unknown item ${itemId}`);
      rewards.items[itemId] = amount(quantity, `items.${itemId}`, MAIL_LIMITS.item_quantity)!;
    }
  }
  return rewards;
}

export function parseMail(body: Record<string, unknown>): { accountId: string | null; title: string; text: string; rewards: MailRewards; starts: Date; expires: Date } {
  const accountId = body.account_id === undefined || body.account_id === null ? null : String(body.account_id);
  if (accountId !== null && !/^acct_[0-9a-f]{32}$/.test(accountId)) throw invalid("account_id must be an account id or absent (everyone)");
  const starts = instant(body.starts_at_utc, "starts_at_utc");
  const expires = instant(body.expires_at_utc, "expires_at_utc");
  if (expires <= starts) throw invalid("the mail expires before it starts");
  return { accountId, title: text(body.title_en, "title_en", 120), text: text(body.body_en, "body_en", 2000), rewards: parseRewards(body.rewards), starts, expires };
}

interface MailRow {
  mail_id: string;
  title_en: string;
  body_en: string;
  rewards: MailRewards;
  starts_at: Date;
  expires_at: Date;
  claimed_at: Date | null;
}

/** The account's mail that is open now (to everyone or to it), newest first, with whether it was claimed. */
export async function listMail(db: Db, accountId: string, now: Date): Promise<Record<string, unknown>[]> {
  const { rows } = await db.query<MailRow>(
    `SELECT m.mail_id, m.title_en, m.body_en, m.rewards, m.starts_at, m.expires_at, c.claimed_at
     FROM mail m LEFT JOIN mail_claims c ON c.mail_id = m.mail_id AND c.account_id = $1
     WHERE m.revoked_at IS NULL AND (m.account_id IS NULL OR m.account_id = $1) AND m.starts_at <= $2 AND $2 < m.expires_at
     ORDER BY m.starts_at DESC LIMIT 100`,
    [accountId, now],
  );
  return rows.map((row) => ({
    mail_id: row.mail_id,
    title_en: row.title_en,
    body_en: row.body_en,
    rewards: row.rewards,
    expires_at_utc: isoUtc(row.expires_at),
    claimed: row.claimed_at !== null,
  }));
}

/** Pays mail `mailId` to the account once (inside the caller's transaction, journaled as mail_claim). */
export async function claimMail(tx: Db, accountId: string, mailId: string, now: Date, operationKey: string): Promise<Record<string, unknown>> {
  const { rows } = await tx.query<{ rewards: MailRewards }>(
    `SELECT rewards FROM mail WHERE mail_id = $1 AND revoked_at IS NULL AND (account_id IS NULL OR account_id = $2) AND starts_at <= $3 AND $3 < expires_at`,
    [mailId, accountId, now],
  );
  if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "No such mail, or it has expired");
  const rewards = rows[0].rewards;
  const inserted = await tx.query(
    "INSERT INTO mail_claims (account_id, mail_id, operation_key, granted) VALUES ($1, $2, $3, $4) ON CONFLICT (account_id, mail_id) DO NOTHING",
    [accountId, mailId, operationKey, JSON.stringify(rewards)],
  );
  if (inserted.rowCount !== 1) throw new ApiError(409, "CONFLICT", "This mail was already claimed");
  if (rewards.silver_crowns || rewards.eclipse_tokens) {
    await tx.query("UPDATE wallet SET silver_crowns = silver_crowns + $2, eclipse_tokens = eclipse_tokens + $3 WHERE account_id = $1", [
      accountId,
      rewards.silver_crowns ?? 0,
      rewards.eclipse_tokens ?? 0,
    ]);
  }
  for (const [itemId, quantity] of Object.entries(rewards.items ?? {})) {
    await addItemQuantity(tx, accountId, itemId, quantity, stackCaps().get(itemId) ?? null);
  }
  return { mail_id: mailId, granted: rewards };
}
