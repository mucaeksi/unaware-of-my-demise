// The Part I story cursor and the First Oath Invitation as API rules, on top of the ported StoryRules
// (core/story/story_state.gd, LEGACY services/story_service.gd).
//
// LEGACY advanced the cursor on the client without checks, because the client's own flow only called it on narrative
// entries. Here the server owns the cursor, so it enforces that flow: a stage entry moves only through a verified
// victory, the story's end does not move, and the one-time First Oath gate is resolved before anything else.
import { ApiError } from "./http";
import { StoryError, type PersistedStoryState } from "./engine/story";
import { contentRegistry, storyRules } from "./rules";

/** `StoryState.to_persisted_dict` form, as stored in `story_state.state`. */
export type StoryStateDict = PersistedStoryState;

const conflict = (message: string): ApiError => new ApiError(409, "CONFLICT", message);

/** Every `story_order` entry is a stage or a narrative (VN) scene. */
export const isStageEntry = (entryId: string): boolean => contentRegistry().stages.has(entryId);

/** The persisted state of a brand-new account: nothing completed, the free starters owned. */
export const newStoryState = (): StoryStateDict => storyRules().toPersisted(storyRules().newPlayerState());

/** Moves past the current narrative entry. */
export function advance(state: StoryStateDict): StoryStateDict {
  if (state.first_oath_invitation_available) throw conflict("The First Oath Invitation must be resolved first");
  const rules = storyRules();
  const entry = rules.storyOrder()[state.story_cursor] ?? null;
  if (entry === null) throw conflict("The story is finished");
  if (isStageEntry(entry)) throw conflict(`Stage ${entry} is cleared by winning its battle`);
  return rules.toPersisted(rules.advanceStoryCursor(rules.fromPersisted(state as unknown as Record<string, unknown>)));
}

/** Claims the one-time guaranteed character selector for `characterId`. */
export function claimFirstOath(state: StoryStateDict, characterId: string): StoryStateDict {
  if (state.first_oath_invitation_claimed) throw conflict("First Oath Invitation has already been claimed");
  if (!state.first_oath_invitation_available) throw conflict("First Oath Invitation is not available yet");
  const rules = storyRules();
  try {
    return rules.toPersisted(rules.claimFirstOathInvitation(rules.fromPersisted(state as unknown as Record<string, unknown>), characterId));
  } catch (error) {
    if (error instanceof StoryError) throw new ApiError(400, "INVALID_REQUEST", error.message);
    throw error;
  }
}
