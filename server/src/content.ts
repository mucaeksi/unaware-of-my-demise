// The content packs the server needs, bundled from the same files the client ships (game/data/content).
import charactersPack from "../../game/data/content/characters_part1.json";
import storyManifest from "../../game/data/content/story_script_part1_manifest.json";

interface CharacterRow {
  character_id: string;
  acquisition?: unknown;
}

interface StoryManifest {
  story_order: string[];
  non_stage_scene_ids: string[];
  acquisition_story_beats: { guaranteed_selector: { choose_one_from: string[] } };
}

const characters = (charactersPack as unknown as { characters: CharacterRow[] }).characters;
const manifest = storyManifest as unknown as StoryManifest;

export const CHARACTER_IDS: ReadonlySet<string> = new Set(characters.map((character) => character.character_id));

export const STORY_ORDER: readonly string[] = manifest.story_order;

/** The narrative (VN) entries of `story_order`; every other entry is a stage. */
export const NON_STAGE_ENTRY_IDS: ReadonlySet<string> = new Set(manifest.non_stage_scene_ids);

/** The First Oath Invitation's selector pool, in authored order. */
export const FIRST_OATH_POOL: readonly string[] = manifest.acquisition_story_beats.guaranteed_selector.choose_one_from;

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
