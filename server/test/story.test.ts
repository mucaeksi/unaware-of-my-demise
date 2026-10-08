import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiError } from "../src/http";
import { advance, claimFirstOath, isStageEntry, type StoryStateDict } from "../src/story";

// The Python reference's golden story walk (parity/fixtures/story_flow.json): every case plays all of story_order,
// clearing stages and claiming one First Oath choice. The GDScript port passes the same fixture.
interface Step {
  entry_id: string;
  is_stage: boolean;
  state_before: StoryStateDict;
  state_after: StoryStateDict;
  /** The hero claimed just before this entry was presented (the invitation is a gate before whichever entry is next). */
  first_oath_claimed?: string;
  state_after_claim?: StoryStateDict;
}

const flow = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "parity", "fixtures", "story_flow.json"), "utf8")) as {
  cases: { first_oath_choice: string; steps: Step[] }[];
};

function rejection(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected a rejection");
}

describe("story rules against the reference walk", () => {
  it("covers every case of the fixture", () => {
    expect(flow.cases.length).toBeGreaterThan(0);
  });

  for (const [index, flowCase] of flow.cases.entries()) {
    it(`case ${index} (${flowCase.first_oath_choice}): narrative entries advance exactly as the reference`, () => {
      let claims = 0;
      let previous: StoryStateDict | null = null;
      for (const step of flowCase.steps) {
        expect(isStageEntry(step.entry_id), step.entry_id).toBe(step.is_stage);
        if (step.first_oath_claimed) {
          claims++;
          const pending = previous!;
          expect(rejection(() => advance(pending)).message).toContain("First Oath");
          expect(claimFirstOath(pending, step.first_oath_claimed)).toEqual(step.state_after_claim);
          expect(step.state_before).toEqual(step.state_after_claim);
          expect(rejection(() => claimFirstOath(step.state_before, step.first_oath_claimed!)).code).toBe("CONFLICT");
        }
        if (step.is_stage) {
          // A stage moves only through a verified victory, never through advance.
          expect(rejection(() => advance(step.state_before)).code).toBe("CONFLICT");
        } else {
          expect(advance(step.state_before), step.entry_id).toEqual(step.state_after);
        }
        previous = step.state_after;
      }
      expect(claims).toBe(1);
      const last = flowCase.steps.at(-1)!;
      expect(rejection(() => advance(last.state_after)).message).toBe("The story is finished");
    });
  }

  it("rejects a First Oath hero outside the selector pool", () => {
    const steps = flow.cases[0]!.steps;
    const available = steps[steps.findIndex((step) => step.first_oath_claimed) - 1]!.state_after;
    expect(available.first_oath_invitation_available).toBe(true);
    expect(rejection(() => claimFirstOath(available, "mahmut"))).toMatchObject({ status: 400, code: "INVALID_REQUEST" });
    expect(rejection(() => claimFirstOath(available, "nobody")).status).toBe(400);
  });
});
