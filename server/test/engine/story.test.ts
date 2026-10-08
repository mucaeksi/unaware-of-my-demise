import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPacks, PACK_FILES, type PackName } from "../../src/engine/content";
import { StoryError, StoryRules, type PlayerStoryState } from "../../src/engine/story";
import { loadFixture } from "./fixtures";

const CONTENT = join(import.meta.dirname, "..", "..", "..", "game", "data", "content");
const readPack = (name: string): unknown => JSON.parse(readFileSync(join(CONTENT, name), "utf8"));
const registry = loadPacks(Object.fromEntries(PACK_FILES.map((name) => [name, readPack(name)])) as Record<PackName, unknown>);
const story = new StoryRules(registry, readPack("story_script_part1_manifest.json") as Record<string, unknown>);

const PARTY = 5;
const TUTORIAL = "1-1";

/** GameController.auto_roster: nobody for the tutorial, else the first five owned heroes by id. */
const autoRoster = (state: PlayerStoryState, stageId: string): string[] =>
  stageId === TUTORIAL ? [] : [...state.owned_character_ids].sort().slice(0, PARTY);

type Any = Record<string, any>;

describe("StoryRules against parity/fixtures/story_flow.json", () => {
  const fixture = loadFixture<Any>("story_flow");

  it("story order and the First Oath pool", () => {
    expect(story.storyOrder()).toEqual(fixture.story_order);
    expect(story.firstOathChoices()).toEqual(fixture.first_oath_choices);
  });

  it("the whole story walked once per First Oath choice", () => {
    expect(story.storyOrder().length).toBe(51);
    expect(fixture.cases.length).toBeGreaterThan(0);
    for (const testCase of fixture.cases) {
      let state = story.newPlayerState();
      const choice = testCase.first_oath_choice as string;
      for (const step of testCase.steps) {
        const label = `${choice} / ${step.entry_id}`;
        const stage = registry.stages.get(step.entry_id);
        expect(stage !== undefined, `${label} is_stage`).toBe(step.is_stage);
        if (state.first_oath_invitation_available) {
          expect(step.first_oath_claimed, `${label} claim`).toBe(choice);
          state = story.claimFirstOathInvitation(state, choice);
          expect(story.toPersisted(state), `${label} after claim`).toEqual(step.state_after_claim);
        } else {
          expect(step).not.toHaveProperty("first_oath_claimed");
        }
        expect(story.toPersisted(state), `${label} before`).toEqual(step.state_before);
        if (stage) {
          const roster = autoRoster(state, stage.stage_id);
          expect(roster, `${label} auto roster`).toEqual(step.auto_roster);
          expect(story.resolveBattleRoster(state, stage, roster), `${label} slots`).toEqual(step.slots);
          state = story.advanceStoryCursor(story.applyStoryRewards(state, stage));
        } else {
          state = story.advanceStoryCursor(state);
        }
        expect(story.toPersisted(state), `${label} after`).toEqual(step.state_after);
      }
    }
  });
});

describe("StoryRules against parity/fixtures/rosters.json", () => {
  it("valid and invalid selections for every stage", () => {
    const fixture = loadFixture<Any>("rosters");
    expect(fixture.cases.length).toBe(35);
    for (const testCase of fixture.cases) {
      const stage = registry.stages.get(testCase.stage_id)!;
      const state = story.fromPersisted(testCase.state);
      expect(stage.guest_characters).toEqual(testCase.guest_characters);
      expect(stage.recommended_level).toBe(testCase.recommended_level);
      for (const row of testCase.selections) {
        const label = `${stage.stage_id} / ${row.name}`;
        if (row.error === null) expect(story.resolveBattleRoster(state, stage, row.selected), label).toEqual(row.slots);
        else expect(() => story.resolveBattleRoster(state, stage, row.selected), label).toThrow(StoryError);
      }
    }
  });
});

describe("StoryRules against parity/fixtures/persisted_state.json", () => {
  const fixture = loadFixture<{ cases: Any[] }>("persisted_state").cases[0]!;

  it("round trips and re-resolves the cursor", () => {
    expect(fixture.valid.length).toBe(8);
    for (const row of fixture.valid) {
      const notes: string[] = [];
      const state = story.fromPersisted(row.data, row.story_order, notes);
      expect(state.story_cursor, `${row.name} cursor`).toBe(row.story_cursor);
      expect(story.toPersisted(state, row.story_order), `${row.name} persisted`).toEqual(row.state);
      const expectedNotes = row.name === "entry_id_gone_keeps_index" || row.name === "entry_id_moved_later" ? 1 : 0;
      expect(notes.length, `${row.name} notes`).toBe(expectedNotes);
    }
  });

  it("rejects malformed data", () => {
    expect(fixture.invalid.length).toBe(11);
    for (const row of fixture.invalid) expect(() => story.fromPersisted(row.data), row.name).toThrow(StoryError);
  });

  it("First Oath claim rules", () => {
    expect(story.firstOathChoices()).toEqual(fixture.first_oath_pool);
    for (const row of fixture.first_oath_claims) {
      const state = story.fromPersisted(row.state);
      if (row.raises !== null) expect(() => story.claimFirstOathInvitation(state, row.choice), row.name).toThrow(StoryError);
      else expect(story.toPersisted(story.claimFirstOathInvitation(state, row.choice)), row.name).toEqual(row.result);
    }
  });
});

describe("StoryRules transitions", () => {
  it("never mutate their input", () => {
    const state = story.newPlayerState();
    const before = story.toPersisted(state);
    const next = story.applyStoryRewards(state, registry.stages.get("1-2")!);
    story.advanceStoryCursor(next);
    expect(story.toPersisted(state)).toEqual(before);
    expect(next.completed_stage_ids.has("1-2")).toBe(true);
    expect(next.first_oath_invitation_available, "1-2 opens the First Oath selector").toBe(true);
  });

  it("never offer a claimed invitation again", () => {
    const stage = registry.stages.get("1-2")!;
    const claimed = story.claimFirstOathInvitation(story.applyStoryRewards(story.newPlayerState(), stage), story.firstOathChoices()[0]!);
    const replayed = story.applyStoryRewards(claimed, stage);
    expect(replayed.first_oath_invitation_available).toBe(false);
    expect(replayed.first_oath_invitation_claimed).toBe(true);
  });
});
