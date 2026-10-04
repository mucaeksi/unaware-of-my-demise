// The content packs the server needs, bundled from the same files the client ships (game/data/content).
import charactersPack from "../../game/data/content/characters_part1.json";
import storyManifest from "../../game/data/content/story_script_part1_manifest.json";

interface CharacterRow {
  character_id: string;
  acquisition?: unknown;
}

const characters = (charactersPack as unknown as { characters: CharacterRow[] }).characters;

export const STORY_ORDER: readonly string[] = (storyManifest as unknown as { story_order: string[] }).story_order;

/** core.story_state `_starting_owned_ids`: every character whose acquisition is "free_start". */
export const FREE_START_CHARACTER_IDS: readonly string[] = characters
  .filter((character) => character.acquisition === "free_start")
  .map((character) => character.character_id)
  .sort();

/** `StoryState.to_persisted_dict(StoryState.new_player_state())`: nothing completed, the free starters owned. */
export function newStoryState(): Record<string, unknown> {
  return {
    completed_stage_ids: [],
    owned_character_ids: [...FREE_START_CHARACTER_IDS],
    first_oath_invitation_claimed: false,
    first_oath_invitation_selection: null,
    first_oath_invitation_available: false,
    story_cursor: 0,
    story_cursor_entry_id: STORY_ORDER[0] ?? null,
    online_character_ids: [],
  };
}
