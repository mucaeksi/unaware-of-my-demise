// Gacha on the server (port of LEGACY server/gacha_transaction.py, gacha_grants.py and banner_status.py around the
// parity-tested rules in engine/gacha.ts). A pull request is one transaction: the pity row of the banner's type is read,
// every pull is resolved (all validation happens before anything is written), Fate's Threads are debited, each result is
// granted and recorded in `pull_history`, and the final pity state is saved. Any failure rolls everything back.
//
// Each request draws a fresh CSPRNG seed (LEGACY used an unaudited OS-seeded generator). The seed is stored on every
// history row of the request, so with the pity state before it a disputed pull replays exactly.
//
// Ownership stays single-sourced in the story state (DEC-0012): a newly pulled character joins `owned_character_ids`
// and `online_character_ids` (granted by the server, never story-derived) as well as the roster.
import { toSafeInt, type Db } from "./db";
import { ApiError, invalid } from "./http";
import { GachaError, GachaRules, pityStatePayload, pullsToResponse, weaponGrant, grantKindFor, type AccountPityState, type BannerType, type GachaPullResponse, type Grant, type PullOutcome } from "./engine/gacha";
import { parseEpoch } from "./engine/gacha-rotation";
import { CpythonRandom } from "./engine/random";
import { newInstanceId } from "./rewards";
import { fateThreadTokenCost, gachaRules, storyRules } from "./rules";

const BANNER_TYPES: readonly BannerType[] = ["character", "weapon", "standard_character"];
const PULL_CURRENCY_NAME = "Fate's Threads";

function hex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A 64-bit seed from the platform CSPRNG. */
function newSeed(): bigint {
  return BigInt(`0x${hex(8)}`);
}

/** The reference's GachaError is a request error (400); anything else is a content or server fault (500). */
function asApiError(error: unknown): never {
  if (error instanceof GachaError && error.kind === "GachaError") throw new ApiError(400, "INVALID_REQUEST", error.message);
  throw error;
}

/** The launch instant of the banner rotation (a Monday 00:00 UTC; empty = development, the first pair stays open). */
export function bannerEpoch(value: string | undefined): Date | null {
  return value ? parseEpoch(value) : null;
}

export interface PullRequest {
  banner_id: string;
  pull_count: number;
  target_id: string | null;
}

export function parsePullRequest(body: Record<string, unknown>): PullRequest {
  const { banner_id: bannerId, pull_count: count = 1, target_id: targetId = null } = body;
  if (typeof bannerId !== "string" || bannerId.length === 0 || bannerId.length > 96) throw invalid("banner_id is required");
  if (typeof count !== "number" || !Number.isSafeInteger(count)) throw invalid("pull_count must be an integer");
  if (targetId !== null && (typeof targetId !== "string" || targetId.length === 0 || targetId.length > 96)) throw invalid("target_id must be a string or null");
  return { banner_id: bannerId, pull_count: count, target_id: targetId as string | null };
}

async function storedPity(tx: Db, accountId: string, bannerType: BannerType): Promise<AccountPityState | null> {
  const { rows } = await tx.query<{ state: AccountPityState }>("SELECT state FROM gacha_pity WHERE account_id = $1 AND banner_type = $2", [accountId, bannerType]);
  return rows[0]?.state ?? null;
}

/** `_grant_character` plus the story-state ownership of a first copy. */
async function grantCharacter(tx: Db, rules: GachaRules, accountId: string, characterId: string): Promise<Grant> {
  const { rows } = await tx.query<{ copies: unknown; memory_shards: unknown }>(
    "SELECT copies, memory_shards FROM roster WHERE account_id = $1 AND character_id = $2 FOR UPDATE",
    [accountId, characterId],
  );
  const existing = rows[0] ? { copies: toSafeInt(rows[0].copies), memory_shards: toSafeInt(rows[0].memory_shards) } : null;
  const plan = rules.characterGrant(characterId, existing);
  if (plan.roster.insert) {
    await tx.query("INSERT INTO roster (account_id, character_id, copies, memory_shards) VALUES ($1, $2, $3, $4)", [
      accountId,
      characterId,
      plan.roster.copies,
      plan.roster.memory_shards,
    ]);
  } else {
    await tx.query("UPDATE roster SET copies = $3, memory_shards = $4 WHERE account_id = $1 AND character_id = $2", [
      accountId,
      characterId,
      plan.roster.copies,
      plan.roster.memory_shards,
    ]);
  }
  const story = await tx.query<{ state: Record<string, unknown> }>("SELECT state FROM story_state WHERE account_id = $1", [accountId]);
  const state = storyRules().fromPersisted(story.rows[0]!.state);
  if (!state.owned_character_ids.has(characterId)) {
    state.owned_character_ids.add(characterId);
    state.online_character_ids.add(characterId);
    await tx.query("UPDATE story_state SET state = $2, updated_at = now() WHERE account_id = $1", [accountId, JSON.stringify(storyRules().toPersisted(state))]);
  }
  return plan.grant;
}

/** POST /v1/gacha/pull inside the request's transaction. */
export async function pull(tx: Db, accountId: string, request: PullRequest, nowUnix: number, epoch: Date | null): Promise<GachaPullResponse> {
  const rules = gachaRules();
  let bannerType: BannerType | null = null;
  try {
    bannerType = GachaRules.bannerTypeFor(request.banner_id);
  } catch {
    // resolvePulls reports the unsupported id with the reference's message.
  }
  const seed = newSeed();
  let plan;
  try {
    const openIds = rules.openBanners(new Date(nowUnix * 1000), epoch).map((window) => window.banner_id);
    plan = rules.resolvePulls({
      stored: bannerType ? await storedPity(tx, accountId, bannerType) : null,
      banner_id: request.banner_id,
      pull_count: request.pull_count,
      open_banner_ids: openIds,
      target_id: request.target_id,
      rng: new CpythonRandom(seed),
    });
  } catch (error) {
    asApiError(error);
  }

  const debited = await tx.query("UPDATE wallet SET fate_threads = fate_threads - $2 WHERE account_id = $1 AND fate_threads >= $2", [accountId, plan.total_cost]);
  if (debited.rowCount !== 1) {
    const { rows } = await tx.query<{ fate_threads: unknown }>("SELECT fate_threads FROM wallet WHERE account_id = $1", [accountId]);
    throw new ApiError(402, "INSUFFICIENT_FUNDS", `Not enough ${PULL_CURRENCY_NAME} (have ${toSafeInt(rows[0]?.fate_threads ?? 0)}, need ${plan.total_cost})`);
  }

  const outcomes: PullOutcome[] = [];
  for (const result of plan.results) {
    const kind = grantKindFor(result);
    let grant: Grant | null = null;
    if (kind === "character") grant = await grantCharacter(tx, rules, accountId, result.reward_id!);
    else if (kind === "weapon") {
      const instanceId = newInstanceId("wpn");
      await tx.query("INSERT INTO inventory_weapons (instance_id, account_id, weapon_id) VALUES ($1, $2, $3)", [instanceId, accountId, result.reward_id]);
      grant = weaponGrant(result.reward_id!, instanceId);
    }
    const pullId = `pull_${hex(16)}`;
    await tx.query(
      `INSERT INTO pull_history (pull_id, account_id, banner_id, banner_type, rarity, reward_id, outcome_pool_id, is_featured, hard_pity_triggered, rng_seed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [pullId, accountId, result.banner_id, result.banner_type, result.rarity, result.reward_id, result.outcome_pool_id, result.is_featured, result.hard_pity_triggered, seed.toString()],
    );
    outcomes.push({ pull_id: pullId, result, grant });
  }
  await tx.query(
    `INSERT INTO gacha_pity (account_id, banner_type, state) VALUES ($1, $2, $3)
     ON CONFLICT (account_id, banner_type) DO UPDATE SET state = excluded.state, updated_at = now()`,
    [accountId, plan.banner_type, JSON.stringify(pityStatePayload(plan.final_state))],
  );
  return pullsToResponse(outcomes);
}

/** GET /v1/gacha/banners: every open window with this account's pity, odds and guarantee. */
export async function banners(db: Db, accountId: string, nowUnix: number, epoch: Date | null) {
  const rules = gachaRules();
  const stored = new Map<string, AccountPityState>();
  const { rows } = await db.query<{ banner_type: string; state: AccountPityState }>("SELECT banner_type, state FROM gacha_pity WHERE account_id = $1", [accountId]);
  for (const row of rows) stored.set(row.banner_type, row.state);
  try {
    return {
      banners: rules
        .openBanners(new Date(nowUnix * 1000), epoch)
        .map((window) => rules.bannerInfo(window, stored.get(GachaRules.bannerTypeFor(window.banner_id)) ?? null)),
    };
  } catch (error) {
    asApiError(error);
  }
}

/** GET /v1/gacha/history?limit=&before=: the caller's pulls, newest first, `seq` as the cursor. */
export async function history(db: Db, accountId: string, url: URL) {
  const limitText = url.searchParams.get("limit");
  const beforeText = url.searchParams.get("before");
  const limit = limitText === null ? 50 : Number(limitText);
  const before = beforeText === null ? null : Number(beforeText);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw invalid("limit must be between 1 and 200");
  if (before !== null && (!Number.isSafeInteger(before) || before < 1)) throw invalid("before must be a positive cursor");
  const { rows } = await db.query<Record<string, unknown> & { seq: unknown; created_at: Date }>(
    `SELECT seq, pull_id, banner_id, banner_type, rarity, reward_id, is_featured, hard_pity_triggered, created_at
     FROM pull_history WHERE account_id = $1 AND ($2::bigint IS NULL OR seq < $2) ORDER BY seq DESC LIMIT $3`,
    [accountId, before, limit + 1],
  );
  const page = rows.slice(0, limit);
  return {
    items: page.map(({ seq: _seq, created_at, ...row }) => ({ ...row, created_at_utc: created_at.toISOString().replace(/\.\d{3}Z$/, "Z") })),
    next_cursor: rows.length > limit ? toSafeInt(page[page.length - 1]!.seq) : null,
  };
}

/** GET /v1/gacha/pity: the raw stored state of every banner type (`{}` when there is none yet). */
export async function pity(db: Db, accountId: string) {
  const { rows } = await db.query<{ banner_type: string; state: unknown }>("SELECT banner_type, state FROM gacha_pity WHERE account_id = $1", [accountId]);
  const byType = Object.fromEntries(BANNER_TYPES.map((type) => [type, {}])) as Record<string, unknown>;
  for (const row of rows) byType[row.banner_type] = row.state;
  return { banner_types: byType };
}

/** POST /v1/wallet/convert: Eclipse Tokens into Fate's Threads at the authored rate (`token_conversion_cost`, one way). */
export async function convertToFateThreads(tx: Db, accountId: string, count: number): Promise<{ fate_threads_gained: number; eclipse_tokens_spent: number }> {
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000) throw invalid("count must be between 1 and 1000");
  const cost = fateThreadTokenCost() * count;
  const updated = await tx.query(
    "UPDATE wallet SET eclipse_tokens = eclipse_tokens - $2, fate_threads = fate_threads + $3 WHERE account_id = $1 AND eclipse_tokens >= $2",
    [accountId, cost, count],
  );
  if (updated.rowCount !== 1) throw new ApiError(402, "INSUFFICIENT_FUNDS", `Not enough Eclipse Tokens (need ${cost})`);
  return { fate_threads_gained: count, eclipse_tokens_spent: cost };
}
