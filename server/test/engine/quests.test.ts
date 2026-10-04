import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  completedTasks,
  countedTasks,
  countedWeeklyTasks,
  halfDayWindow,
  QuestError,
  QuestProgress,
  weeklyCycleKey,
  weeklySegment,
  type QuestProgressMap,
} from "../../src/engine/quests";
import { loadFixture } from "./fixtures";

const CONTENT = join(import.meta.dirname, "..", "..", "..", "game", "data", "content");
const readPack = (name: string): Record<string, unknown> => JSON.parse(readFileSync(join(CONTENT, name), "utf8"));
const quest = new QuestProgress(readPack("economy_part1.json"), readPack("items_part1.json"));

type Any = Record<string, any>;
const fixture = loadFixture<{ cases: Any[] }>("quests").cases[0]!;

const repeat = (event: [string, number, string | null], times: number) => Array.from({ length: times }, () => event);
/** The events tools/parity/f_story.py fed each recorded sequence. */
const SCRIPTS: Record<string, [string, number, string | null][]> = {
  daily_only: [...repeat(["eligible_win", 1, null], 4), ["successful_level_up", 1, null], ["boss_win", 1, null]],
  weekly_cycle_a: repeat(["eligible_win", 1, "cycle_a"], 16),
  weekly_cycle_b_ignores_a: [...repeat(["boss_win", 1, "cycle_a"], 2), ...repeat(["boss_win", 1, "cycle_b"], 6)],
  weekly_sun_eclipse: repeat(["three_star_win", 1, "sun_eclipse"], 4),
  amount_over_target: [["eligible_win", 50, "cycle_a"]],
  no_active_segment: [["eligible_win", 1, null], ["three_star_win", 2, null]],
};

describe("QuestProgress against parity/fixtures/quests.json", () => {
  it("tasks come from the economy pack", () => {
    expect(quest.allTasks()).toEqual(fixture.tasks);
    expect(quest.dailyTasks().length, "the rewarded-ad task has no counted objective").toBe(2);
    expect(quest.weeklyTasks().length).toBe(3);
  });

  it("apply_event scripts", () => {
    const tasks = quest.allTasks();
    expect(fixture.sequences.length).toBe(Object.keys(SCRIPTS).length);
    for (const sequence of fixture.sequences) {
      const events = SCRIPTS[sequence.name]!;
      expect(events.length, sequence.name).toBe(sequence.steps.length);
      let progress: QuestProgressMap = {};
      sequence.steps.forEach((step: Any, index: number) => {
        const label = `${sequence.name} step ${index}`;
        expect(step.event, label).toBe(events[index]![0]);
        expect(step.active_segment, label).toBe(events[index]![2]);
        progress = quest.applyEvent(progress, tasks, step.event, step.amount, step.active_segment);
        expect(progress, label).toEqual(step.progress);
        expect(completedTasks(progress, tasks), label).toEqual(step.completed);
      });
    }
  });

  it("invalid events and amounts are rejected without changing progress", () => {
    const calls: Record<string, [string, unknown]> = {
      unknown_event: ["no_such_event", 1],
      zero_amount: ["eligible_win", 0],
      negative_amount: ["eligible_win", -1],
      bool_amount: ["eligible_win", true],
    };
    expect(fixture.invalid.length).toBe(Object.keys(calls).length);
    for (const entry of fixture.invalid) {
      expect(entry.raises).toBe("ValueError");
      const before = { win_three_battles: 1 };
      expect(() => quest.applyEvent(before, quest.allTasks(), ...calls[entry.name]!), entry.name).toThrow(QuestError);
      expect(before).toEqual({ win_three_battles: 1 });
    }
    expect(() => quest.applyEvent({}, quest.allTasks(), "eligible_win", 1.5)).toThrow(QuestError);
  });

  it("half-day and weekly windows", () => {
    expect(fixture.windows.length).toBeGreaterThan(80);
    for (const entry of fixture.windows) {
      const label = `unix ${entry.unix}`;
      expect(halfDayWindow(entry.unix), label).toEqual(entry.half_day);
      expect(weeklySegment(entry.unix), label).toEqual(entry.weekly);
      expect(weeklyCycleKey(entry.unix), label).toEqual(entry.weekly_cycle_key);
    }
  });

  it("Character XP is paid as Chronicle items, largest first", () => {
    expect(fixture.character_xp_items.length).toBe(9);
    for (const entry of fixture.character_xp_items) {
      const label = `amount ${entry.amount}`;
      if (entry.raises !== null) expect(() => quest.characterXpItems(entry.amount), label).toThrow(QuestError);
      else expect(quest.characterXpItems(entry.amount), label).toEqual(entry.items);
    }
  });

  it("content defaults and malformed rows", () => {
    const tasks = countedTasks({
      tasks: [
        { id: "a", objective: { type: "eligible_wins", count: 2 } },
        { id: "b", objective: { type: "verified_rewarded_ad", per_view: 30 } },
        { id: "c", objective: { type: "boss_wins", count: 0 } },
        { id: "d", objective: { type: "boss_wins", count: true } },
        { id: "e" },
        "not a row",
      ],
    });
    expect(tasks).toEqual([{ task_id: "a", objective_type: "eligible_wins", target: 2, segment_id: null }]);
    expect(countedTasks({})).toEqual([]);
    expect(countedWeeklyTasks({})).toEqual([]);
    const weekly = countedWeeklyTasks({ segments: [{ id: "s1", objective: { type: "boss_wins", count: 5 } }, { id: "s2", objective: { type: "x" } }] });
    expect(weekly).toEqual([{ task_id: "weekly:s1", objective_type: "boss_wins", target: 5, segment_id: "s1" }]);
  });
});
