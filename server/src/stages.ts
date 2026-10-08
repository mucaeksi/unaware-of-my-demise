// Stage attempts (DEC-0013): the server picks the battle seed and freezes the inputs, the client plays that seed, and a
// reported victory is re-simulated from the stored attempt before anything is granted.
import { toSafeInt, type Db } from "./db";
import { ApiError, invalid } from "./http";
import { CpythonRandom } from "./engine/random";
import { StoryError, type PersistedStoryState, type PlayerStoryState } from "./engine/story";
import { requireRation, spendRation } from "./ration";
import { applyRewards, recordBattleVictory, type AppliedReward } from "./rewards";
import { serverRulesHash } from "./release";
import { battleService, contentRegistry, lootResolver, questProgress, stackCaps, storyRules } from "./rules";

/** The engine options a run needs besides the stage, roster and seed (game_flow.gd `battle_options`). */
export interface BattleInputs {
  player_levels: Record<string, number>;
  equipment: Record<string, Loadout>;
  skill_ranks: Record<string, Record<string, number>>;
  memory_nodes: Record<string, number>;
}

/** What an attempt freezes when it opens: the build and the owned heroes the client's run starts from. */
export interface AttemptInputs extends BattleInputs {
  owned_character_ids: string[];
}

export interface Loadout {
  weapon_id: string | null;
  weapon_level?: number;
  armor_id: string | null;
  armor_level?: number;
  accessory_ids: string[];
  rolled_accessories: unknown[];
}

/**
 * An open attempt older than this is expired (INF-016): it can no longer be won, the snapshot stops offering it, and the
 * retention job marks it. Nothing was paid for it, so expiry only costs the player a replay.
 */
export const ATTEMPT_TTL_SECONDS = 24 * 3600;

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
export async function beginAttempt(tx: Db, accountId: string, persisted: PersistedStoryState, stageId: string, roster: string[], nowUnix: number): Promise<AttemptStart> {
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
  // Ration is checked here but spent only by the verified victory (`loss_on_failure: false`).
  await requireRation(tx, accountId, stage.stamina_cost, nowUnix);
  const inputs: AttemptInputs = {
    owned_character_ids: [...state.owned_character_ids].sort(),
    ...(await battleInputs(tx, accountId, state.owned_character_ids)),
  };
  await tx.query("UPDATE stage_attempts SET status = 'expired', resolved_at = now() WHERE account_id = $1 AND status = 'open'", [accountId]);
  const attemptId = crypto.randomUUID();
  const runSeed = newRunSeed();
  await tx.query(
    "INSERT INTO stage_attempts (attempt_id, account_id, stage_id, roster, run_seed, inputs, rules_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [attemptId, accountId, stageId, JSON.stringify(roster), runSeed, JSON.stringify(inputs), await serverRulesHash()],
  );
  return { attempt_id: attemptId, stage_id: stageId, run_seed: runSeed };
}

/**
 * Gives up an open attempt (a defeat, or a battle the player chose not to resume): it becomes `lost` and pays nothing.
 * Abandoning an attempt that is already lost or expired changes nothing; one that was won cannot be abandoned.
 */
export async function abandonAttempt(tx: Db, accountId: string, attemptId: string): Promise<{ attempt_status: string }> {
  const { rows } = await tx.query<{ status: string }>("SELECT status FROM stage_attempts WHERE attempt_id = $1 AND account_id = $2 FOR UPDATE", [
    attemptId,
    accountId,
  ]);
  const status = rows[0]?.status;
  if (status === undefined) throw new ApiError(404, "ITEM_NOT_FOUND", "Unknown battle attempt");
  if (status === "won") throw conflict("This battle attempt was already won");
  if (status === "open") await tx.query("UPDATE stage_attempts SET status = 'lost', resolved_at = now() WHERE attempt_id = $1", [attemptId]);
  return { attempt_status: "lost" };
}

/** The stored attempt a re-simulation runs from. */
export interface StoredAttempt {
  attempt_id: string;
  stage_id: string;
  roster: string[];
  run_seed: number;
  inputs: AttemptInputs;
}

/** The server's own run of an attempt. */
export interface SimulatedBattle {
  outcome: "victory" | "defeat";
  stars: number;
  actions: number;
  cycles: number;
}

/** Re-runs an attempt with the battle engine (the client's run is never trusted). */
export type Simulate = (attempt: StoredAttempt, client?: ClientResult) => SimulatedBattle;

/**
 * The battle engine's run of an attempt: the client's `GameFlow.battle_options` inputs rebuilt from what the attempt froze
 * (only the owned set of the story state matters to the run), the stored roster and the server's seed.
 */
export const engineSimulate: Simulate = (attempt, client) => {
  const story = storyRules().newPlayerState();
  story.owned_character_ids = new Set(attempt.inputs.owned_character_ids);
  const result = battleService().run(attempt.stage_id, attempt.roster, {
    story_state: story,
    player_levels: attempt.inputs.player_levels,
    equipment: attempt.inputs.equipment as unknown as Record<string, Record<string, unknown>>,
    skill_ranks: attempt.inputs.skill_ranks,
    memory_nodes: attempt.inputs.memory_nodes,
    run_seed: attempt.run_seed,
    combat_mode: client?.combat_mode,
    manual_commands: client?.manual_commands,
  });
  if (result.error) throw conflict(`The battle could not be re-run: ${result.error}`);
  return { outcome: result.outcome === "victory" ? "victory" : "defeat", stars: result.stars, actions: result.actions, cycles: result.cycles };
};

/** Claims are diagnostic; bounded Ultimate inputs receive authoritative re-simulation. */
export interface ClientResult {
  combat_mode?: "manual_ultimate_v1";
  manual_commands?: { after_actions: number; actor_id: string }[];
  outcome: string;
  stars: number | null;
  actions: number | null;
  cycles: number | null;
}

export function parseClientResult(body: Record<string, unknown>): ClientResult {
  const count = (key: string): number | null => {
    const value = body[key];
    if (value === undefined || value === null) return null;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw invalid(`${key} must be a non-negative integer`);
    return value;
  };
  if (body.outcome !== "victory") throw invalid("outcome must be 'victory' (a defeat is not reported)");
  const result: ClientResult = { outcome: "victory", stars: count("stars"), actions: count("actions"), cycles: count("cycles") };
  if (body.combat_mode !== undefined || body.manual_commands !== undefined) {
    if (body.combat_mode !== "manual_ultimate_v1" || !Array.isArray(body.manual_commands) || body.manual_commands.length > 1000) throw invalid("Invalid manual combat report");
    let previous = 0;
    result.combat_mode = "manual_ultimate_v1";
    result.manual_commands = body.manual_commands.map(value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid("Invalid Ultimate command");
      const command = value as Record<string, unknown>;
      const boundary = command.after_actions;
      if (typeof boundary !== "number" || !Number.isSafeInteger(boundary) || boundary < previous || boundary > 10000 ||
          typeof command.actor_id !== "string" || !/^[a-z][a-z0-9_]{0,95}$/.test(command.actor_id) ||
          Object.keys(command).some(key => key !== "after_actions" && key !== "actor_id")) throw invalid("Invalid Ultimate command");
      previous = boundary;
      return {after_actions:boundary,actor_id:command.actor_id};
    });
  }
  return result;
}

export interface VictoryResult {
  applied: AppliedReward[];
  first_clear: boolean;
  result: SimulatedBattle;
}

/** A 64-bit seed from the platform CSPRNG for one clear's reward rolls (LEGACY re-rolled rewards on every clear). */
function newRewardSeed(): bigint {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(words[0]!) << 32n) | BigInt(words[1]!);
}

/**
 * Verifies and pays one attempt (LEGACY `GameController._apply_victory`, docs/LEGACY_AUDIT.md 9.4), all inside the
 * request's transaction: the server re-runs the attempt from its stored inputs and refuses anything but its own victory;
 * then loot (first-clear rows claimed once per account and stage), the reward writes, the quest events, the story rewards
 * and, on a first clear, the cursor. The attempt is used up.
 */
export async function completeAttempt(
  tx: Db,
  accountId: string,
  persisted: PersistedStoryState,
  attemptId: string,
  client: ClientResult,
  simulate: Simulate,
  nowUnix: number,
): Promise<{ victory: VictoryResult; story: PersistedStoryState; recruits: string[] }> {
  const { rows } = await tx.query<{
    stage_id: string;
    roster: string[];
    run_seed: unknown;
    inputs: AttemptInputs;
    status: string;
    stale: boolean;
    rules_hash: string | null;
  }>(
    "SELECT stage_id, roster, run_seed, inputs, status, rules_hash, created_at <= now() - make_interval(secs => $3) AS stale " +
      "FROM stage_attempts WHERE attempt_id = $1 AND account_id = $2 FOR UPDATE",
    [attemptId, accountId, ATTEMPT_TTL_SECONDS],
  );
  const row = rows[0];
  if (!row) throw new ApiError(404, "ITEM_NOT_FOUND", "Unknown battle attempt");
  if (row.status !== "open") throw conflict(`This battle attempt is already ${row.status}`);
  if (row.stale) throw conflict("This battle attempt is already expired");
  // INF-022: the client fought it under other rules than the server would re-run now.
  if (row.rules_hash !== null && row.rules_hash !== (await serverRulesHash())) {
    throw new ApiError(409, "RULES_CHANGED", "The game data changed since this battle started; start it again");
  }
  const stage = contentRegistry().stages.get(row.stage_id);
  if (!stage) throw conflict(`Stage ${row.stage_id} no longer exists`);
  const rules = storyRules();
  const state: PlayerStoryState = rules.fromPersisted(persisted as unknown as Record<string, unknown>);
  const current = rules.storyOrder()[state.story_cursor] ?? null;
  if (current !== stage.stage_id && !state.completed_stage_ids.has(stage.stage_id)) throw conflict(`Stage ${stage.stage_id} is not unlocked`);

  const attempt: StoredAttempt = { attempt_id: attemptId, stage_id: row.stage_id, roster: row.roster, run_seed: toSafeInt(row.run_seed), inputs: row.inputs };
  const simulated = simulate(attempt, client);
  if (simulated.outcome !== "victory") throw conflict("The battle result could not be verified");

  await spendRation(tx, accountId, stage.stamina_cost, nowUnix);
  const isFirstClear = !state.completed_stage_ids.has(stage.stage_id);
  const rewardSeed = newRewardSeed();
  const rewards = await lootResolver().resolveBattleRewards(
    stage.drop_table_id,
    isFirstClear,
    accountId,
    async (claimAccountId, claimType) =>
      ((await tx.query("INSERT INTO claims (account_id, reward_type, cycle_id) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING", [claimAccountId, claimType])).rowCount ?? 0) === 1,
    new CpythonRandom(rewardSeed),
    stage.stage_id,
    stage.boss_id,
  );
  const applied = await applyRewards(tx, accountId, rewards, stackCaps());
  const questEvents = await recordBattleVictory(tx, questProgress(), accountId, nowUnix, {
    staminaCost: stage.stamina_cost,
    isBoss: Boolean(stage.boss_id),
    stars: simulated.stars,
  });
  let next = rules.applyStoryRewards(state, stage);
  if (isFirstClear) next = rules.advanceStoryCursor(next);
  const recruits = [...next.owned_character_ids].filter((characterId) => !state.owned_character_ids.has(characterId)).sort();

  const victory: VictoryResult = { applied, first_clear: isFirstClear, result: simulated };
  await tx.query("UPDATE stage_attempts SET status = 'won', resolved_at = now(), result = $2 WHERE attempt_id = $1", [
    attemptId,
    JSON.stringify({ ...victory, client, reward_seed: rewardSeed.toString(), quest_events: questEvents }),
  ]);
  return { victory, story: rules.toPersisted(next), recruits };
}
