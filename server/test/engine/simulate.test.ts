import { describe, expect, it } from "vitest";
import { engineSimulate } from "../../src/stages";
import { contentRegistry } from "../../src/rules";
import { loadFixture } from "./fixtures";

type Any = Record<string, any>;

// The server re-runs an attempt from its stored inputs; for every stage, one recorded client run (first case of each
// battle fixture) must come out the same through the Worker's bundled content and engineSimulate.
describe("engineSimulate against parity/fixtures/battle_*.json", () => {
  it("reproduces a recorded run of every stage", () => {
    const stageIds = [...contentRegistry().stages.keys()];
    expect(stageIds.length).toBe(35);
    for (const stageId of stageIds) {
      for (const testCase of loadFixture<{ cases: Any[] }>(`battle_${stageId}`).cases.slice(0, 2)) {
        const { input } = testCase;
        const result = engineSimulate({
          attempt_id: "fixture",
          stage_id: stageId,
          roster: input.roster,
          run_seed: Number(testCase.seed),
          inputs: {
            owned_character_ids: input.owned_character_ids,
            player_levels: input.player_levels,
            equipment: input.equipment,
            skill_ranks: input.skill_ranks,
            memory_nodes: input.memory_nodes,
          },
        });
        expect(result, `${stageId} ${testCase.variant} seed ${testCase.seed}`).toEqual({
          outcome: testCase.outcome,
          stars: testCase.stars,
          actions: testCase.actions,
          cycles: testCase.cycles,
        });
      }
    }
  });
});
