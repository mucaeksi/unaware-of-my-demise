// Accounts, sign-in nonces, sessions and profiles (LEGACY server/repository.py, server/app.py auth routes).
import { randomChoice, randomHex, randomUrlSafe, sha256Hex } from "./crypto";
import { rationRules } from "./ration";
import { newStoryState } from "./story";
import type { Db } from "./db";

export const SESSION_TTL_SECONDS = 3600;
/** A nonce only has to outlive one Credential Manager round trip. */
export const NONCE_TTL_SECONDS = 300;
/** No 0/O/1/I/L: unambiguous when read aloud or typed. */
const FRIEND_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Never store a raw provider subject; this deterministic hash maps a returning player back to the same account. */
export const hashSubject = (provider: string, subject: string): Promise<string> => sha256Hex(`${provider}:${subject}`);

export async function issueNonce(db: Db): Promise<{ nonce: string; expiresAt: Date }> {
  const nonce = randomUrlSafe(24);
  const { rows } = await db.query<{ expires_at: Date }>(
    "INSERT INTO auth_nonces (nonce, expires_at) VALUES ($1, now() + make_interval(secs => $2)) RETURNING expires_at",
    [nonce, NONCE_TTL_SECONDS],
  );
  return { nonce, expiresAt: rows[0]!.expires_at };
}

/** True only the first time, and only for an issued, unexpired nonce: one atomic UPDATE is the whole check-and-set. */
export async function consumeNonce(db: Db, nonce: string): Promise<boolean> {
  const { rowCount } = await db.query(
    "UPDATE auth_nonces SET consumed_at = now() WHERE nonce = $1 AND consumed_at IS NULL AND expires_at > now()",
    [nonce],
  );
  return rowCount === 1;
}

export async function findAccountBySubject(db: Db, provider: string, subjectHash: string): Promise<string | null> {
  const { rows } = await db.query<{ account_id: string }>(
    "SELECT account_id FROM provider_links WHERE provider = $1 AND subject_hash = $2",
    [provider, subjectHash],
  );
  return rows[0]?.account_id ?? null;
}

/**
 * A new account with everything the game expects to exist: provider link, empty wallet, the starting story state (free
 * starters owned) with their roster rows, and the public profile. Run inside the caller's transaction. The account id is
 * minted here, never taken from the client.
 */
export async function createAccount(db: Db, provider: string, subjectHash: string): Promise<string> {
  const accountId = `acct_${randomHex(16)}`;
  await db.query("INSERT INTO account (account_id) VALUES ($1)", [accountId]);
  await db.query("INSERT INTO provider_links (provider, subject_hash, account_id) VALUES ($1, $2, $3)", [provider, subjectHash, accountId]);
  // A new player starts with a full Ration meter.
  await db.query("INSERT INTO wallet (account_id, ration) VALUES ($1, $2)", [accountId, rationRules().cap]);
  const story = newStoryState();
  await db.query("INSERT INTO story_state (account_id, state) VALUES ($1, $2)", [accountId, JSON.stringify(story)]);
  for (const characterId of story.owned_character_ids) {
    await db.query("INSERT INTO roster (account_id, character_id) VALUES ($1, $2)", [accountId, characterId]);
  }
  await ensureProfile(db, accountId);
  return accountId;
}

export interface Profile {
  friend_code: string;
  nickname: string;
  avatar_mark_id: string | null;
  chapter_badge_id: string | null;
  presence_opt_in: boolean;
}

const generateFriendCode = (): string => {
  const chars = Array.from({ length: 8 }, () => randomChoice(FRIEND_CODE_ALPHABET));
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
};

/** The account's public profile, created on first use with a placeholder nickname and a fresh unique friend code. */
export async function ensureProfile(db: Db, accountId: string): Promise<Profile> {
  const select = "SELECT friend_code, nickname, avatar_mark_id, chapter_badge_id, presence_opt_in FROM profiles WHERE account_id = $1";
  const existing = await db.query<Profile>(select, [accountId]);
  if (existing.rows[0]) return existing.rows[0];
  const nickname = `Player${accountId.slice(-6).toUpperCase()}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const inserted = await db.query(
      "INSERT INTO profiles (account_id, friend_code, nickname) VALUES ($1, $2, $3) ON CONFLICT (friend_code) DO NOTHING",
      [accountId, generateFriendCode(), nickname],
    );
    if (inserted.rowCount === 1) return (await db.query<Profile>(select, [accountId])).rows[0]!;
  }
  throw new Error("Could not generate a unique friend code after 5 attempts");
}

/** A new opaque bearer token; only its SHA-256 is stored, the plaintext is returned exactly once. */
export async function createSession(db: Db, accountId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomUrlSafe(32);
  const { rows } = await db.query<{ expires_at: Date }>(
    "INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3)) RETURNING expires_at",
    [await sha256Hex(token), accountId, SESSION_TTL_SECONDS],
  );
  return { token, expiresAt: rows[0]!.expires_at };
}

/** The session's account, or null when the token is unknown or expired. */
export async function resolveSession(db: Db, token: string): Promise<string | null> {
  const { rows } = await db.query<{ account_id: string }>(
    "SELECT account_id FROM sessions WHERE token_hash = $1 AND expires_at > now()",
    [await sha256Hex(token)],
  );
  return rows[0]?.account_id ?? null;
}
