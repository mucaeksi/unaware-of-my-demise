import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPacks, PACK_FILES, type PackName } from "../../src/engine/content";
import { Dec } from "../../src/engine/dec";
import { Progression, ProgressionError } from "../../src/engine/progression";
import { loadFixture } from "./fixtures";

const CONTENT = join(import.meta.dirname, "..", "..", "..", "game", "data", "content");
const registry = loadPacks(
  Object.fromEntries(PACK_FILES.map((name) => [name, JSON.parse(readFileSync(join(CONTENT, name), "utf8"))])) as Record<PackName, unknown>,
);
const progression = Progression.create(registry);

const decMap = (map: Record<string, Dec>): Record<string, string> =>
  Object.fromEntries(Object.entries(map).map(([key, value]) => [key, value.toText()]));
const sameDecMap = (actual: Record<string, Dec>, expected: Record<string, string>): boolean =>
  Object.keys(actual).length === Object.keys(expected).length &&
  Object.entries(expected).every(([key, text]) => actual[key] !== undefined && actual[key].equals(Dec.parse(text)!));

describe("Dec against parity/fixtures/float_repr.json", () => {
  it("reads every double as the decimal Python's repr prints", () => {
    const fixture = loadFixture<{ cases: { bits: string; decimal: string }[] }>("float_repr");
    expect(fixture.cases.length).toBeGreaterThan(5);
    for (const { bits, decimal } of fixture.cases) {
      const value = Buffer.from(bits, "hex").readDoubleBE(0);
      expect(Dec.fromNumber(value).equals(Dec.parse(decimal)!), `${bits} -> ${decimal}`).toBe(true);
    }
  });

  it("keeps Decimal scales and rounds half up away from zero", () => {
    expect(Dec.parse("1.5")!.add(Dec.parse("1.50")!).toText()).toBe("3.00");
    expect(Dec.parse("0.1")!.mul(Dec.parse("0.20")!).toText()).toBe("0.020");
    expect(Dec.parse("2.5")!.roundHalfUp()).toBe(3);
    expect(Dec.parse("-2.5")!.roundHalfUp()).toBe(-3);
    expect(Dec.parse("2.4999")!.roundHalfUp()).toBe(2);
    expect(Dec.fromNumber(0.3 * 1.5).toText()).toBe("0.44999999999999996");
    expect(Dec.parse("1.005")!.quantizeHalfUp(2).toText()).toBe("1.01");
  });
});

describe("Progression against parity/fixtures/stats_*.json", () => {
  it("character stats at every level", () => {
    const fixture = loadFixture<{ level_cap: number; cases: { character_id: string; levels: Record<string, number>[] }[] }>("stats_characters");
    expect(progression.characterLevelCap()).toBe(fixture.level_cap);
    for (const hero of fixture.cases) {
      const character = registry.characters.get(hero.character_id)!;
      hero.levels.forEach((expected, index) => {
        expect(progression.baseStatAtLevel(character.base_stats_level_1, character.growth_per_level, index + 1), `${hero.character_id} L${index + 1}`).toEqual(expected);
      });
    }
  });

  it("enemy stats at every level and multiplier", () => {
    const fixture = loadFixture<{
      cases: { enemy_id: string; multiplier: number; levels: Record<string, number>[] }[];
      stages: { stage_id: string; enemy_level: number; enemy_stat_multiplier: number; recommended_level: number }[];
    }>("stats_enemies");
    for (const foe of fixture.cases) {
      const enemy = registry.enemies.get(foe.enemy_id)!;
      foe.levels.forEach((expected, index) => {
        expect(progression.enemyStatsAtLevel(enemy.base_stats_level_1, enemy.growth_per_level, index + 1, foe.multiplier), `${foe.enemy_id} x${foe.multiplier} L${index + 1}`).toEqual(expected);
      });
    }
    for (const row of fixture.stages) {
      const stage = registry.stages.get(row.stage_id)!;
      expect([stage.enemy_level, stage.enemy_stat_multiplier, stage.recommended_level]).toEqual([row.enemy_level, row.enemy_stat_multiplier, row.recommended_level]);
    }
  });

  it("weapon and armor bonuses at every level, as exact decimals", () => {
    const fixture = loadFixture<{ cases: { item_id: string; kind: string; levels: { flat: Record<string, string>; percent: Record<string, string> }[] }[] }>("stats_equipment");
    for (const piece of fixture.cases) {
      const row = (piece.kind === "weapon" ? registry.weapons.get(piece.item_id) : registry.armors.get(piece.item_id)) as unknown as Record<string, unknown>;
      piece.levels.forEach((expected, index) => {
        const equipped = progression.equippedItemFromContent(row, index + 1);
        const label = `${piece.item_id} L${index + 1}`;
        expect(sameDecMap(equipped.flat_stats, expected.flat), `${label} flat ${JSON.stringify(decMap(equipped.flat_stats))}`).toBe(true);
        expect(sameDecMap(equipped.percent_stats, expected.percent), `${label} percent`).toBe(true);
      });
    }
  });
});

describe("Progression against parity/fixtures/curves.json", () => {
  const curves = loadFixture<{ cases: Record<string, any>[] }>("curves").cases[0]!;

  it("XP, cost and account curves", () => {
    expect(progression.characterLevelCap()).toBe(curves.character_level_cap);
    for (let level = 1; level <= curves.character_level_cap; level++) {
      expect(progression.xpToNext(level)).toBe(curves.xp_to_next[level - 1]);
      expect(progression.levelUpSilverCrownsCost(level)).toBe(curves.level_up_silver_crowns_cost[level - 1]);
      expect(progression.ascensionSilverCrownsCost(level)).toBe(curves.ascension_silver_crowns_cost[level - 1]);
      expect(progression.ascensionsRequiredForLevel(level)).toBe(curves.ascensions_required_for_level[level - 1]);
    }
    curves.account_xp_to_next.forEach((expected: number, index: number) => expect(progression.accountXpToNext(index + 1)).toBe(expected));
    for (const sample of curves.account_level_for_xp) expect(progression.accountLevelForXp(sample.total_xp)).toBe(sample.level);
  });

  it("ascension gates", () => {
    for (const { character_level, account_level, ...expected } of curves.ascension_gates) {
      expect(progression.ascensionGate(character_level, account_level), `L${character_level} / account ${account_level}`).toEqual(expected);
    }
  });

  it("equipment curves and milestones", () => {
    expect(progression.equipmentLevelCap()).toBe(curves.equipment_level_cap);
    for (let level = 1; level <= curves.equipment_level_cap; level++) {
      expect(progression.equipmentXpToNext(level)).toBe(curves.equipment_xp_to_next[level - 1]);
      expect(progression.equipmentLevelUpSilverCrownsCost(level)).toBe(curves.equipment_level_up_silver_crowns_cost[level - 1]);
      expect(progression.equipmentBonusPct(level).equals(Dec.parse(curves.equipment_bonus_pct[level - 1])!)).toBe(true);
      const milestone = progression.equipmentMilestoneForStep(level);
      const expected = curves.equipment_milestone_for_step[level - 1];
      if (expected === null) expect(milestone).toBeNull();
      else expect({ ...milestone!, bonus_pct: milestone!.bonus_pct.toText() }).toEqual(expected);
    }
  });

  it("skill ranks", () => {
    for (const entry of curves.skills) {
      expect(progression.skillMaxRank(entry.skill_type)).toBe(entry.max_rank);
      entry.upgrade_from_rank.forEach((expected: unknown, index: number) => {
        expect(progression.skillUpgradeRequirement(entry.skill_type, index + 1), `${entry.skill_type} from ${index + 1}`).toEqual(expected);
      });
      entry.multiplier_by_rank.forEach((expected: number, index: number) => expect(progression.skillRankMultiplier(index + 1)).toBe(expected));
    }
  });

  it("Memory Nodes", () => {
    expect(progression.memoryNodes().map((node) => ({ ...node, value: node.value.toText() }))).toEqual(curves.memory_nodes);
  });

  it("rejects exactly the calls the reference rejects", () => {
    const calls: Record<string, (level: number | null) => unknown> = {
      base_stat_at_level: (level) => progression.baseStatAtLevel({ hp: 10 }, { hp: 1 }, level!),
      xp_to_next: (level) => progression.xpToNext(level!),
      level_up_silver_crowns_cost: (level) => progression.levelUpSilverCrownsCost(level!),
      ascension_gate: (level) => progression.ascensionGate(level!, 1),
      account_xp_to_next: (level) => progression.accountXpToNext(level!),
      account_level_for_xp: (level) => progression.accountLevelForXp(level!),
      skill_rank_multiplier: (level) => progression.skillRankMultiplier(level!),
      skill_max_rank: () => progression.skillMaxRank("no_such_type"),
    };
    for (const error of curves.errors) {
      expect(error.raises).toBe("ValueError");
      expect(() => calls[error.call]!(error.level), `${error.call}(${error.level})`).toThrow(ProgressionError);
    }
  });
});
