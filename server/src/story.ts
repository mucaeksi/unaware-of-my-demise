// The Part I story cursor and the First Oath Invitation, server-side (port of core/story/story_state.gd
// `advance_story_cursor` / `claim_first_oath_invitation`, LEGACY services/story_service.gd).
//
// LEGACY advanced the cursor on the client without checks, because the client's own flow only called it on narrative
// entries. Here the server owns the cursor, so it enforces that flow: a stage entry moves only through a verified
// victory, the story's end does not move, and the one-time First Oath gate is resolved before anything else.
import { ApiError } from "./http";
import { CHARACTER_IDS, FIRST_OATH_POOL, NON_STAGE_ENTRY_IDS, STORY_ORDER } from "./content";

/** `StoryState.to_persisted_dict` form. */
export interface StoryStateDict {
  completed_stage_ids: string[];
  owned_character_ids: string[];
  first_oath_invitation_claimed: boolean;
  first_oath_invitation_selection: string | null;
  first_oath_invitation_available: boolean;
  story_cursor: number;
  story_cursor_entry_id: string | null;
  online_character_ids: string[];
}

const conflict = (message: string): ApiError => new ApiError(409, "CONFLICT", message);

export const isStageEntry = (entryId: string): boolean => !NON_STAGE_ENTRY_IDS.has(entryId);

export const currentEntry = (state: StoryStateDict): string | null => STORY_ORDER[state.story_cursor] ?? null;

const withCursor = (state: StoryStateDict, cursor: number): StoryStateDict => ({
  ...state,
  story_cursor: cursor,
  story_cursor_entry_id: STORY_ORDER[cursor] ?? null,
});

/** Moves past the current narrative entry. */
export function advance(state: StoryStateDict): StoryStateDict {
  if (state.first_oath_invitation_available) throw conflict("The First Oath Invitation must be resolved first");
  const entry = currentEntry(state);
  if (entry === null) throw conflict("The story is finished");
  if (isStageEntry(entry)) throw conflict(`Stage ${entry} is cleared by winning its battle`);
  return withCursor(state, state.story_cursor + 1);
}

/** Claims the one-time guaranteed character selector for `characterId`. */
export function claimFirstOath(state: StoryStateDict, characterId: string): StoryStateDict {
  if (state.first_oath_invitation_claimed) throw conflict("First Oath Invitation has already been claimed");
  if (!state.first_oath_invitation_available) throw conflict("First Oath Invitation is not available yet");
  if (!FIRST_OATH_POOL.includes(characterId) || !CHARACTER_IDS.has(characterId)) {
    throw new ApiError(400, "INVALID_REQUEST", `Character '${characterId}' is not eligible for First Oath Invitation`);
  }
  return {
    ...state,
    owned_character_ids: [...new Set([...state.owned_character_ids, characterId])].sort(),
    first_oath_invitation_claimed: true,
    first_oath_invitation_selection: characterId,
    first_oath_invitation_available: false,
  };
}
