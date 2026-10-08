// Player story progression, story recruits, the First Oath selector and battle rosters with story loans (port of
// core/story/story_state.gd, LEGACY core/story_state.py).
//
// Story beats come from `story_script_part1_manifest.json`, party limits from the battle rules, stage guests from the
// Stage records. Transitions never mutate their input; where the reference raises ValueError/TypeError this throws
// StoryError.
import { pyRepr, type ContentRegistry, type Stage } from "./content";

export const STORY_LOAN_EQUIPMENT_TEMPLATE_ID = "story_loan_standard";

export class StoryError extends Error {}

type Row = Record<string, unknown>;

/** One deployed hero; `level` is null when the player's saved build is loaded. */
export interface BattleSlot {
  slot_index: number;
  position: "front" | "rear";
  character_id: string;
  temporary: boolean;
  level: number | null;
  equipment_template_id: string | null;
}

/** Save-state fields owned by the Part I story state machine. */
export interface PlayerStoryState {
  completed_stage_ids: Set<string>;
  owned_character_ids: Set<string>;
  first_oath_invitation_claimed: boolean;
  first_oath_invitation_selection: string | null;
  first_oath_invitation_available: boolean;
  /** Index into the manifest's flat `story_order` of the next entry not yet presented. */
  story_cursor: number;
  /** Characters the server granted (gacha); also in owned_character_ids but never story-derived. */
  online_character_ids: Set<string>;
}

/** `to_persisted_dict` form (sets become sorted lists). */
export interface PersistedStoryState {
  completed_stage_ids: string[];
  owned_character_ids: string[];
  first_oath_invitation_claimed: boolean;
  first_oath_invitation_selection: string | null;
  first_oath_invitation_available: boolean;
  story_cursor: number;
  story_cursor_entry_id: string | null;
  online_character_ids: string[];
}

export function copyState(state: PlayerStoryState): PlayerStoryState {
  return {
    ...state,
    completed_stage_ids: new Set(state.completed_stage_ids),
    owned_character_ids: new Set(state.owned_character_ids),
    online_character_ids: new Set(state.online_character_ids),
  };
}

const sorted = (ids: Iterable<string>): string[] => [...ids].sort();
const isObject = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);
const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
const get = (data: Row, key: string, fallback: unknown): unknown => (key in data ? data[key] : fallback);

export class StoryRules {
  constructor(
    private readonly registry: ContentRegistry,
    private readonly manifest: Row,
  ) {}

  private startingOwnedIds(): string[] {
    return [...this.registry.characters.values()].filter((character) => character.acquisition === "free_start").map((character) => character.character_id);
  }

  /** `PlayerStoryState()`: nothing completed, the free-start characters owned. */
  newPlayerState(): PlayerStoryState {
    return {
      completed_stage_ids: new Set(),
      owned_character_ids: new Set(this.startingOwnedIds()),
      first_oath_invitation_claimed: false,
      first_oath_invitation_selection: null,
      first_oath_invitation_available: false,
      story_cursor: 0,
      online_character_ids: new Set(),
    };
  }

  storyOrder(): string[] {
    const order = this.manifest.story_order;
    if (!isStringList(order)) throw new StoryError("Story manifest story_order must be an array of strings");
    return [...order];
  }

  /** Plain JSON-compatible form for storage. `order` defaults to the manifest's story_order. */
  toPersisted(state: PlayerStoryState, order: readonly string[] | null = null): PersistedStoryState {
    const entries = order ?? this.storyOrder();
    return {
      completed_stage_ids: sorted(state.completed_stage_ids),
      owned_character_ids: sorted(state.owned_character_ids),
      first_oath_invitation_claimed: state.first_oath_invitation_claimed,
      first_oath_invitation_selection: state.first_oath_invitation_selection,
      first_oath_invitation_available: state.first_oath_invitation_available,
      story_cursor: state.story_cursor,
      story_cursor_entry_id: state.story_cursor < entries.length ? entries[state.story_cursor]! : null,
      online_character_ids: sorted(state.online_character_ids),
    };
  }

  /**
   * Reconstructs a state from `toPersisted` output. The cursor is re-resolved through `story_cursor_entry_id` when
   * content moved entries; the reference's log lines are appended to `notes`.
   */
  fromPersisted(data: Row, order: readonly string[] | null = null, notes: string[] = []): PlayerStoryState {
    const completed = get(data, "completed_stage_ids", []);
    const owned = get(data, "owned_character_ids", []);
    if (!isStringList(completed)) throw new StoryError("Persisted completed_stage_ids must be a list of strings");
    if (!isStringList(owned)) throw new StoryError("Persisted owned_character_ids must be a list of strings");
    const claimed = get(data, "first_oath_invitation_claimed", false);
    const selection = get(data, "first_oath_invitation_selection", null);
    const available = get(data, "first_oath_invitation_available", false);
    if (typeof claimed !== "boolean" || typeof available !== "boolean") throw new StoryError("Persisted first_oath_invitation flags must be booleans");
    if (selection !== null && typeof selection !== "string") throw new StoryError("Persisted first_oath_invitation_selection must be a string or null");
    // story_cursor defaults to 0 so saves written before the field existed still load.
    const rawCursor = get(data, "story_cursor", 0);
    if (!isWhole(rawCursor) || rawCursor < 0) throw new StoryError("Persisted story_cursor must be a non-negative integer");
    let cursor = rawCursor;
    const online = get(data, "online_character_ids", []);
    if (!isStringList(online)) throw new StoryError("Persisted online_character_ids must be a list of strings");
    const entryId = get(data, "story_cursor_entry_id", null);
    if (entryId !== null) {
      if (typeof entryId !== "string") throw new StoryError("Persisted story_cursor_entry_id must be a string or null");
      const entries = order ?? this.storyOrder();
      if (!(cursor < entries.length && entries[cursor] === entryId)) {
        const resolved = entries.indexOf(entryId);
        if (resolved >= 0) {
          notes.push(`StoryState: story_cursor re-resolved from ${cursor} to ${resolved} for entry ${pyRepr(entryId)}`);
          cursor = resolved;
        } else {
          notes.push(`StoryState: persisted story_cursor entry ${pyRepr(entryId)} no longer exists in story_order; keeping index ${cursor}`);
        }
      }
    }
    return {
      completed_stage_ids: new Set(completed),
      owned_character_ids: new Set(owned),
      first_oath_invitation_claimed: claimed,
      first_oath_invitation_selection: selection,
      first_oath_invitation_available: available,
      story_cursor: cursor,
      online_character_ids: new Set(online),
    };
  }

  /** A new state pointing at the next story_order entry. */
  advanceStoryCursor(state: PlayerStoryState): PlayerStoryState {
    return { ...copyState(state), story_cursor: state.story_cursor + 1 };
  }

  private acquisitionBeats(): Row {
    const beats = this.manifest.acquisition_story_beats;
    if (!isObject(beats)) throw new StoryError("Story manifest is missing acquisition_story_beats");
    return beats;
  }

  /** [size, front, rear] of the party for a stage, honouring the tutorial exception. */
  private partyShape(stage: Stage): [number, number, number] {
    const rules = this.registry.battle_rules.party;
    if (!isObject(rules)) throw new StoryError("battle_rules_part1.json is missing the party rules");
    const { size, front, rear } = rules;
    if (!isWhole(size) || !isWhole(front) || !isWhole(rear)) throw new StoryError("Battle party size/front/rear rules must be integers");
    if (size !== front + rear || size < 1 || front < 0 || rear < 0) throw new StoryError("Battle party size must equal front plus rear slots");
    const exception = rules.tutorial_exception;
    if (isObject(exception) && exception.stage_id === stage.stage_id) {
      const exceptionSize = exception.size;
      if (!isWhole(exceptionSize) || exceptionSize < 1) throw new StoryError("Tutorial party exception size must be a positive integer");
      return [exceptionSize, exceptionSize, 0];
    }
    return [size, front, rear];
  }

  private static battleSlot(characterId: string, slotIndex: number, frontCount: number, temporary: boolean, stageLevel: number): BattleSlot {
    return {
      slot_index: slotIndex,
      position: slotIndex < frontCount ? "front" : "rear",
      character_id: characterId,
      temporary,
      level: temporary ? stageLevel : null,
      equipment_template_id: temporary ? STORY_LOAN_EQUIPMENT_TEMPLATE_ID : null,
    };
  }

  /** Resolves saved heroes and fills vacant slots with the stage's story guests (authored order) up to the party size. */
  resolveBattleRoster(state: PlayerStoryState, stage: Stage, playerSelectedFive: readonly unknown[]): BattleSlot[] {
    const selected: string[] = [];
    for (const characterId of playerSelectedFive) {
      if (typeof characterId !== "string" || characterId.length === 0) throw new StoryError("player_selected_five must be a list of non-empty character IDs");
      selected.push(characterId);
    }
    if (new Set(selected).size !== selected.length) throw new StoryError("A battle roster cannot contain duplicate character IDs");

    const [size, frontCount] = this.partyShape(stage);
    const unknownGuests = stage.guest_characters.filter((characterId) => !this.registry.characters.has(characterId));
    if (unknownGuests.length > 0) throw new StoryError(`Stage ${pyRepr(stage.stage_id)} has unknown guest IDs: ${pyRepr(unknownGuests)}`);

    if (stage.stage_id === "1-1") {
      // startingOwnedIds is already in registry order.
      const starters = this.startingOwnedIds();
      if (starters.length !== size) throw new StoryError("The 1-1 tutorial exception must resolve to exactly its two free starters");
      if (!starters.every((characterId) => state.owned_character_ids.has(characterId))) {
        throw new StoryError("Mahmut and Fadyme must be owned for the 1-1 tutorial party");
      }
      return starters.map((characterId, index) => StoryRules.battleSlot(characterId, index, frontCount, false, stage.recommended_level));
    }

    if (selected.length > size) throw new StoryError(`The party can contain at most ${size} selected heroes`);
    const rosterIds = [...selected];
    for (const characterId of rosterIds) {
      if (!this.registry.characters.has(characterId)) throw new StoryError(`Unknown selected character: ${characterId}`);
      if (!state.owned_character_ids.has(characterId) && !stage.guest_characters.includes(characterId)) {
        throw new StoryError(`Character ${pyRepr(characterId)} is neither owned nor a guest in this stage`);
      }
    }
    // A selected guest keeps the player's actual copy when owned; otherwise the slot is a temporary story loan.
    for (const characterId of stage.guest_characters) {
      if (rosterIds.length >= size) break;
      if (!rosterIds.includes(characterId)) rosterIds.push(characterId);
    }
    if (rosterIds.length !== size) {
      throw new StoryError(
        `Stage ${pyRepr(stage.stage_id)} requires ${size} heroes; selected heroes and story guests provide ${rosterIds.length}. ` +
          `Select ${size - rosterIds.length} more owned hero(s).`,
      );
    }
    return rosterIds.map((characterId, index) =>
      StoryRules.battleSlot(characterId, index, frontCount, !state.owned_character_ids.has(characterId), stage.recommended_level),
    );
  }

  /** A new state after recording stage completion and story unlocks. */
  applyStoryRewards(state: PlayerStoryState, stage: Stage): PlayerStoryState {
    const result = copyState(state);
    result.completed_stage_ids.add(stage.stage_id);
    for (const row of stage.story_rewards) {
      const recruitId = get(row, "recruit_character_id", null);
      if (recruitId === null) continue;
      if (typeof recruitId !== "string" || !this.registry.characters.has(recruitId)) {
        throw new StoryError(`Stage ${pyRepr(stage.stage_id)} has an invalid recruit_character_id`);
      }
      result.owned_character_ids.add(recruitId);
    }
    const beats = this.acquisitionBeats();
    const recruits = get(beats, "story_recruits", []);
    if (!Array.isArray(recruits)) throw new StoryError("acquisition_story_beats.story_recruits must be an array");
    for (const recruit of recruits) {
      if (!isObject(recruit)) throw new StoryError("Story recruit entries must be objects");
      if (recruit.after_stage !== stage.stage_id) continue;
      const characterId = recruit.character_id;
      if (typeof characterId !== "string" || !this.registry.characters.has(characterId)) {
        throw new StoryError(`Story manifest has invalid recruit for stage ${pyRepr(stage.stage_id)}`);
      }
      result.owned_character_ids.add(characterId);
    }
    let invitationGranted = stage.story_rewards.some((row) => row.grant_item_id === "first_oath_invitation");
    const selector = beats.guaranteed_selector;
    if (!isObject(selector)) throw new StoryError("acquisition_story_beats.guaranteed_selector must be an object");
    if (selector.claim_after_stage === stage.stage_id) invitationGranted = true;
    result.first_oath_invitation_available =
      !state.first_oath_invitation_claimed && (state.first_oath_invitation_available || invitationGranted);
    return result;
  }

  /** The selector's manifest-defined character pool in authored order (independent of any state). */
  firstOathChoices(): string[] {
    const selector = this.acquisitionBeats().guaranteed_selector;
    if (!isObject(selector)) throw new StoryError("acquisition_story_beats.guaranteed_selector must be an object");
    const eligible = selector.choose_one_from;
    if (!isStringList(eligible)) throw new StoryError("First Oath Invitation selector has an invalid choose_one_from list");
    return [...eligible];
  }

  /** Claims the one-time guaranteed character selector. */
  claimFirstOathInvitation(state: PlayerStoryState, chosenCharacterId: string): PlayerStoryState {
    if (state.first_oath_invitation_claimed) throw new StoryError("First Oath Invitation has already been claimed");
    if (!state.first_oath_invitation_available) throw new StoryError("First Oath Invitation is not available yet");
    if (!this.firstOathChoices().includes(chosenCharacterId)) {
      throw new StoryError(`Character ${pyRepr(chosenCharacterId)} is not eligible for First Oath Invitation`);
    }
    if (!this.registry.characters.has(chosenCharacterId)) throw new StoryError(`Selector references unknown character ${pyRepr(chosenCharacterId)}`);
    const result = copyState(state);
    result.owned_character_ids.add(chosenCharacterId);
    result.first_oath_invitation_claimed = true;
    result.first_oath_invitation_selection = chosenCharacterId;
    result.first_oath_invitation_available = false;
    return result;
  }
}
