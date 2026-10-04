// Stage attempts (DEC-0013): the server picks the battle seed and freezes the inputs, the client plays that seed, and a
// reported victory is re-simulated from the stored attempt before anything is granted.
import { toSafeInt, type Db } from "./db";
import { ApiError, invalid } from "./http";
import { StoryError, type PersistedStoryState } from "./engine/story";
import { contentRegistry, storyRules } from "./rules";

/** The engine options a run needs besides the stage, roster and seed (game_flow.gd `battle_options`). */
export interface BattleInputs {
  player_levels: Record<string, number>;
  equipment: Record<string, Loadout>;
  skill_ranks: Record<string, Record<string, number>>;
  memory_nodes: Record<string, number>;
}

export interface Loadout {
  weapon_id: string | null;
  weapon_level?: number;
  armor_id: string | null;
  armor_level?: number;
  accessory_ids: string[];
  rolled_accessories: unknown[];
}

/** Largest party any stage allows; a longer list is refused before the rules see it. */
const MAX_ROSTER = 5;
/** Seeds stay below 2^53 so they survive JSON on every client (Godot parses JSON numbers as doubles). */
const SEED_BOUND = 2n ** 53n;

const conflict = (message: string): ApiError => new ApiError(409, "CONFLICT", message);

/** A uniformly random integer in [0, 2^53) from the platform CSPRNG. */
export function newRunSeed(): number {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return Number(((BigInt(words[0]!) << 32n) | BigInt(words[1]!)) % SEED_BOUND);
}

/**
 * The player's build for every owned hero, read inside the request's transaction, in the exact shape and order the
 * client builds it (`GameFlow.battle_options`), so client and server runs see the same inputs.
 */
export async function battleInputs(tx: Db, accountId: string, owned: ReadonlySet<string>): Promise<BattleInputs> {
  const inputs: BattleInputs = { player_levels: {}, equipment: {}, skill_ranks: {}, memory_nodes: {} };
  const roster = await tx.query<{ character_id: string; level: unknown; memory_nodes: unknown }>(
    "SELECT character_id, level, memory_nodes FROM roster WHERE account_id = $1 ORDER BY character_id",
    [accountId],
  );
  for (const row of roster.rows) {
    if (!owned.has(row.character_id)) continue;
    const level = toSafeInt(row.level);
    if (level > 1) inputs.player_levels[row.character_id] = level;
    const nodes = toSafeInt(row.memory_nodes);
    if (nodes > 0) inputs.memory_nodes[row.character_id] = nodes;
  }
  const ranks = await tx.query<{ character_id: string; skill_id: string; rank: number }>(
    "SELECT character_id, skill_id, rank FROM skill_ranks WHERE account_id = $1 ORDER BY character_id, skill_id",
    [accountId],
  );
  for (const row of ranks.rows) {
    if (!owned.has(row.character_id)) continue;
    (inputs.skill_ranks[row.character_id] ??= {})[row.skill_id] = row.rank;
  }
  // An unequipped weapon is an explicit `weapon_id: null` (a missing key would mean the signature weapon).
  const loadout = (characterId: string): Loadout =>
    (inputs.equipment[characterId] ??= { weapon_id: null, armor_id: null, accessory_ids: [], rolled_accessories: [] });
  const weapons = await tx.query<{ equipped_character_id: string; weapon_id: string; level: unknown }>(
    "SELECT equipped_character_id, weapon_id, level FROM inventory_weapons WHERE account_id = $1 AND equipped_character_id IS NOT NULL ORDER BY acquired_seq",
    [accountId],
  );
  for (const row of weapons.rows) {
    if (!owned.has(row.equipped_character_id)) continue;
    Object.assign(loadout(row.equipped_character_id), { weapon_id: row.weapon_id, weapon_level: toSafeInt(row.level) });
  }
  const armor = await tx.query<{ equipped_character_id: string; armor_id: string; level: unknown }>(
    "SELECT equipped_character_id, armor_id, level FROM inventory_armor WHERE account_id = $1 AND equipped_character_id IS NOT NULL ORDER BY acquired_seq",
    [accountId],
  );
  for (const row of armor.rows) {
    if (!owned.has(row.equipped_character_id)) continue;
    Object.assign(loadout(row.equipped_character_id), { armor_id: row.armor_id, armor_level: toSafeInt(row.level) });
  }
  const accessories = await tx.query<{ equipped_character_id: string; accessory_id: string; payload: unknown }>(
    "SELECT equipped_character_id, accessory_id, payload FROM inventory_accessories WHERE account_id = $1 AND equipped_character_id IS NOT NULL ORDER BY acquired_seq",
    [accountId],
  );
  for (const row of accessories.rows) {
    if (!owned.has(row.equipped_character_id)) continue;
    const target = loadout(row.equipped_character_id);
    target.accessory_ids.push(row.accessory_id);
    target.rolled_accessories.push(row.payload ?? {});
  }
  return inputs;
}

/** The `roster` field of a request body: up to five non-empty character ids. */
export function parseRoster(body: Record<string, unknown>): string[] {
  const roster = body.roster ?? [];
  if (!Array.isArray(roster) || roster.length > MAX_ROSTER || !roster.every((id) => typeof id === "string" && id.length > 0 && id.length <= 64)) {
    throw invalid(`roster must be a list of at most ${MAX_ROSTER} character ids`);
  }
  return roster as string[];
}

export interface AttemptStart {
  attempt_id: string;
  stage_id: string;
  run_seed: number;
}

/**
 * Opens an attempt at `stageId`: the stage must be the story's current entry or one already cleared, the First Oath must
 * be resolved, and the roster must be legal for the stage. Any older open attempt of the account expires.
 */
export async function beginAttempt(tx: Db, accountId: string, persisted: PersistedStoryState, stageId: string, roster: string[]): Promise<AttemptStart> {
  const stage = contentRegistry().stages.get(stageId);
  if (!stage) throw new ApiError(404, "ITEM_NOT_FOUND", `Unknown stage '${stageId}'`);
  const rules = storyRules();
  const state = rules.fromPersisted(persisted as unknown as Record<string, unknown>);
  if (state.first_oath_invitation_available) throw conflict("The First Oath Invitation must be resolved first");
  const current = rules.storyOrder()[state.story_cursor] ?? null;
  if (current !== stageId && !state.completed_stage_ids.has(stageId)) throw conflict(`Stage ${stageId} is not unlocked`);
  try {
    rules.resolveBattleRoster(state, stage, roster);
  } catch (error) {
    if (error instanceof StoryError) throw invalid(error.message);
    throw error;
  }
  const inputs = await battleInputs(tx, accountId, state.owned_character_ids);
  await tx.query("UPDATE stage_attempts SET status = 'expired', resolved_at = now() WHERE account_id = $1 AND status = 'open'", [accountId]);
  const attemptId = crypto.randomUUID();
  const runSeed = newRunSeed();
  await tx.query(
    "INSERT INTO stage_attempts (attempt_id, account_id, stage_id, roster, run_seed, inputs) VALUES ($1, $2, $3, $4, $5, $6)",
    [attemptId, accountId, stageId, JSON.stringify(roster), runSeed, JSON.stringify(inputs)],
  );
  return { attempt_id: attemptId, stage_id: stageId, run_seed: runSeed };
}
