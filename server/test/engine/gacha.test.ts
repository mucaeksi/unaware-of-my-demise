// LEGACY gacha tests ported case for case (Google Drive archive: tests/test_gacha_service.py, test_gacha_edge_cases.py,
// test_banner_rotation.py, the pure parts of test_banner_state.py, test_gacha_pull.py and test_gacha_ten_pull.py), plus
// the duplicate-grant rules of server/gacha_grants.py. Seeds, scripted draws and expected values are the reference's.
// Bit-exact seeded parity with the reference lives in gacha-parity.test.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GachaError,
  GachaRules,
  grantKindFor,
  pityState,
  pityStateFromPayload,
  pityStatePayload,
  probabilityTotal,
  pullFingerprint,
  pullsToResponse,
  weaponGrant,
  type AccountPityState,
  type PullResult,
} from "../../src/engine/gacha";
import { openBannerWindows, parseEpoch, RotationError } from "../../src/engine/gacha-rotation";
import { CpythonRandom } from "../../src/engine/random";

const CONTENT = join(import.meta.dirname, "..", "..", "..", "game", "data", "content");
const pack = (name: string): Record<string, unknown> => JSON.parse(readFileSync(join(CONTENT, name), "utf8"));
const economy = pack("economy_part1.json");
const characters = pack("characters_part1.json");
const weapons = pack("weapons_part1.json");
const rules = new GachaRules(economy, characters, weapons);
const BANNERS = economy.banners as Record<string, unknown>;

const rng = (seed: number): CpythonRandom => new CpythonRandom(BigInt(seed));
const close = (actual: number, expected: number, tolerance = 1e-12): void => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
/** pytest.approx defaults: relative 1e-6 or absolute 1e-12. */
const approx = (actual: number, expected: number): void =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.max(1e-6 * Math.abs(expected), 1e-12));
const probabilities = (result: PullResult): Record<number, number> => Object.fromEntries(result.rarity_probabilities);

/** `random()` returns scripted values in order; everything else (randrange) draws from the seed-0 stream. */
class ScriptedRandom extends CpythonRandom {
  private readonly values: number[];

  constructor(...values: number[]) {
    super(0n);
    this.values = values;
  }

  override random(): number {
    return this.values.length > 0 ? this.values.shift()! : super.random();
  }
}

function gachaError(action: () => unknown): GachaError {
  try {
    action();
  } catch (error) {
    if (error instanceof GachaError) return error;
    throw error;
  }
  throw new Error("expected a GachaError");
}

const LIMITED = ["sister_aveline", "sable_wren", "mirel_quill", "nara_vell", "vespera_wisp"];

describe("test_gacha_service.py", () => {
  it("character probabilities normalize through pull 80 and hard pity", () => {
    for (let pity = 0; pity < 80; pity++) {
      const result = rules.pull(pityState({ character_five_star_pity: pity }), "character:oath_01_aveline", rng(20260927));
      close(probabilityTotal(result), 1.0);
      const map = probabilities(result);
      if (map[5]! < 1.0) approx(map[4]! / map[3]!, 17 / 81);
      if (pity === 0) approx(map[5]!, 0.025);
      if (pity === 64) approx(map[5]!, 0.085);
      if (pity === 78) approx(map[5]!, 0.925);
      if (pity === 79) {
        expect(map[5]).toBe(1.0);
        expect(result.rarity).toBe(5);
        expect(result.hard_pity_triggered).toBe(true);
      }
    }
  });

  it("a lost featured 5★ guarantees the next 5★", () => {
    const initial = pityState({ character_five_star_pity: 79, selected_character_id: "sister_aveline" });
    const lost = rules.pull(initial, "limited_character", rng(0));
    expect(lost.rarity).toBe(5);
    expect(lost.is_featured).toBe(false);
    // Owner decision 2026-09-28: a lost 55/45 grants a standard 5★.
    expect(lost.outcome_pool_id).toBeNull();
    expect(["mahmut", "fadyme"]).toContain(lost.reward_id);
    expect(lost.account_state.lost_featured_next_five_star_guaranteed).toBe(true);
    expect(lost.account_state.character_five_star_pity).toBe(0);
    expect(initial.character_five_star_pity).toBe(79); // input snapshot was not mutated
    expect(initial.lost_featured_next_five_star_guaranteed).toBe(false);

    const guaranteed = { ...lost.account_state, character_five_star_pity: 79 };
    const featured = rules.pull(guaranteed, "limited_character", rng(11));
    expect(featured.rarity).toBe(5);
    expect(featured.is_featured).toBe(true);
    expect(featured.reward_id).toBe("sister_aveline");
    expect(featured.featured_guarantee_triggered).toBe(true);
    expect(featured.account_state.lost_featured_next_five_star_guaranteed).toBe(false);
  });

  it("the weapon banner has no soft pity and Fate Knots guarantee the selected target", () => {
    const target = "weapon_aveline_last_vigil";
    for (const [pity, expected] of [
      [0, 0.025],
      [63, 0.025],
      [64, 1.0],
    ] as const) {
      const odds = rules.getRarityProbabilities(pityState({ weapon_five_star_pity: pity, selected_weapon_target_id: target }), "limited_signature_weapon");
      close(odds[5] + odds[4] + odds[3], 1.0);
      approx(odds[5], expected);
    }
    const unprotected = pityState({ weapon_five_star_pity: 64, selected_weapon_target_id: target });
    const miss = rules.pull(unprotected, "limited_signature_weapon", rng(0));
    expect(miss.rarity).toBe(5);
    expect(miss.is_featured).toBe(false);
    expect(miss.account_state.weapon_fate_knots).toBe(1);
    expect(unprotected.weapon_fate_knots).toBe(0);

    const protectedState = { ...miss.account_state, weapon_fate_knots: 2, weapon_five_star_pity: 64 };
    const protectedPull = rules.pull(protectedState, "limited_signature_weapon", rng(7));
    expect(protectedPull.rarity).toBe(5);
    expect(protectedPull.is_featured).toBe(true);
    expect(protectedPull.reward_id).toBe(target);
    expect(protectedPull.target_guarantee_triggered).toBe(true);
    expect(protectedPull.account_state.weapon_fate_knots).toBe(0);

    const notYetAwarded = pityState({ weapon_fate_knots: 2, selected_weapon_target_id: target });
    const lower = rules.pull(notYetAwarded, "limited_signature_weapon", rng(0));
    expect(lower.rarity).toBeLessThan(5);
    expect(lower.target_guarantee_triggered).toBe(false);
    expect(lower.account_state.weapon_fate_knots).toBe(2);
  });

  it("unprotected 5★ featured and weapon target odds are 55%", () => {
    let stream = rng(44027);
    const characterState = pityState({ character_five_star_pity: 79 });
    let hits = 0;
    for (let index = 0; index < 3000; index++) hits += rules.pull(characterState, "character:oath_01_aveline", stream).is_featured ? 1 : 0;
    expect(Math.abs(hits / 3000 - 0.55)).toBeLessThanOrEqual(0.025);

    stream = rng(99027);
    const weaponState = pityState({ weapon_five_star_pity: 64, selected_weapon_target_id: "weapon_aveline_last_vigil" });
    hits = 0;
    for (let index = 0; index < 3000; index++) hits += rules.pull(weaponState, "limited_signature_weapon", stream).is_featured ? 1 : 0;
    expect(Math.abs(hits / 3000 - 0.55)).toBeLessThanOrEqual(0.025);
  });

  it("the tenth pull upgrades a 3★ to the minimum 4★", () => {
    const result = rules.pull(pityState({ character_four_star_pity: 9 }), "character:oath_01_aveline", rng(13));
    expect(result.rarity).toBeGreaterThanOrEqual(4);
    if (result.minimum_four_star_triggered) expect(result.rarity).toBe(4);
  });
});

describe("test_gacha_edge_cases.py", () => {
  const CHAR = "character:oath_01_aveline";
  const WEAPON_TARGET = "weapon_mahmut_signature";
  const OTHER_WEAPON_TARGET = "weapon_fadyme_signature";
  const hall = (fields: Partial<AccountPityState> = {}): AccountPityState => pityState({ selected_weapon_target_id: WEAPON_TARGET, ...fields });

  it.each([
    [0, 0.025],
    [63, 0.025],
    [64, 0.085],
    [65, 0.145],
    [70, 0.445],
    [77, 0.865],
    [78, 0.925],
    [79, 1.0],
  ])("character soft pity curve at pity %i is %f", (pity, expected) => {
    const odds = rules.getRarityProbabilities(pityState({ character_five_star_pity: pity }), CHAR);
    approx(odds[5], expected);
    approx(odds[5] + odds[4] + odds[3], 1.0);
  });

  it("character hard pity 80 ignores the rarity roll", () => {
    const result = rules.pull(pityState({ character_five_star_pity: 79 }), CHAR, new ScriptedRandom(0.999999, 0.0));
    expect(result.rarity === 5 && result.hard_pity_triggered).toBe(true);
    expect(result.account_state.character_five_star_pity).toBe(0);
  });

  it("weapon hard pity 65 and a flat rate before it", () => {
    approx(rules.getRarityProbabilities(hall({ weapon_five_star_pity: 63 }), "hall_of_armaments")[5], 0.025);
    const result = rules.pull(hall({ weapon_five_star_pity: 64 }), "hall_of_armaments", new ScriptedRandom(0.999999, 0.0));
    expect(result.rarity === 5 && result.hard_pity_triggered).toBe(true);
  });

  it("the tenth pull guarantees a 4★ but the ninth does not", () => {
    const ninth = rules.pull(pityState({ character_four_star_pity: 8 }), CHAR, new ScriptedRandom(0.999999));
    expect(ninth.rarity === 3 && !ninth.minimum_four_star_triggered).toBe(true);
    expect(ninth.account_state.character_four_star_pity).toBe(9);
    const tenth = rules.pull(ninth.account_state, CHAR, new ScriptedRandom(0.999999));
    expect(tenth.rarity === 4 && tenth.minimum_four_star_triggered).toBe(true);
    expect(tenth.account_state.character_four_star_pity).toBe(0);
  });

  it("a lost 55/45 grants a standard 5★", () => {
    // Rarity roll 0.0 -> 5★, featured roll 0.99 -> lost. lost_featured_pool = standard_character (Mahmut/Fadyme).
    const result = rules.pull(pityState(), CHAR, new ScriptedRandom(0.0, 0.99));
    expect(result.rarity === 5 && result.is_featured === false).toBe(true);
    expect(["mahmut", "fadyme"]).toContain(result.reward_id);
    expect(result.outcome_pool_id).toBeNull();
    expect(result.account_state.lost_featured_next_five_star_guaranteed).toBe(true);
  });

  it("without lost_featured_pool the loss stays explicit", () => {
    // The reference calls _resolve_reward with rules {"featured_chance_on_five_star": 0.55}; here the same rules come
    // from an economy pack without the flag.
    const character = { ...(BANNERS.character as Record<string, unknown>) };
    delete character.lost_featured_pool;
    const bare = new GachaRules({ ...economy, banners: { ...BANNERS, character } }, characters, weapons);
    const result = bare.pull(pityState(), CHAR, new ScriptedRandom(0.0, 0.99));
    expect([result.reward_id, result.outcome_pool_id]).toEqual([null, "character_standard_five_star_pool"]);
    expect(result.account_state.lost_featured_next_five_star_guaranteed).toBe(true);
  });

  it("two knots guarantee the target and reset the knots", () => {
    const result = rules.pull(hall({ weapon_fate_knots: 2 }), "hall_of_armaments", new ScriptedRandom(0.0, 0.99));
    expect(result.rarity === 5 && result.target_guarantee_triggered).toBe(true);
    expect(result.reward_id).toBe(WEAPON_TARGET);
    expect(result.account_state.weapon_fate_knots).toBe(0);
  });

  it("a lost weapon roll adds a knot, capped at two", () => {
    const one = rules.pull(hall(), "hall_of_armaments", new ScriptedRandom(0.0, 0.99));
    expect(one.is_featured === false && one.reward_id !== WEAPON_TARGET).toBe(true);
    expect(one.account_state.weapon_fate_knots).toBe(1);
    const two = rules.pull(one.account_state, "hall_of_armaments", new ScriptedRandom(0.0, 0.99));
    expect(two.account_state.weapon_fate_knots).toBe(2);
  });

  it("knots carry over when the selected target changes", () => {
    const one = rules.pull(hall(), "hall_of_armaments", new ScriptedRandom(0.0, 0.99));
    const retargeted = { ...one.account_state, selected_weapon_target_id: OTHER_WEAPON_TARGET };
    expect(retargeted.weapon_fate_knots).toBe(1);
    const result = rules.pull({ ...retargeted, weapon_fate_knots: 2 }, "hall_of_armaments", new ScriptedRandom(0.0));
    expect(result.reward_id === OTHER_WEAPON_TARGET && result.target_guarantee_triggered).toBe(true);
  });

  it("a target won by chance resets the knots", () => {
    const result = rules.pull(hall({ weapon_fate_knots: 1 }), "hall_of_armaments", new ScriptedRandom(0.0, 0.0));
    expect(result.is_featured === true && !result.target_guarantee_triggered).toBe(true);
    expect(result.reward_id).toBe(WEAPON_TARGET);
    expect(result.account_state.weapon_fate_knots).toBe(0);
  });

  it.each([
    [0, 0.02],
    [64, 0.02],
    [78, 0.02],
    [79, 1.0],
  ])("Hall of Ancestors: flat rate and hard pity 80 (pity %i -> %f)", (pity, expected) => {
    const odds = rules.getRarityProbabilities(pityState({ standard_five_star_pity: pity }), "hall_of_ancestors");
    approx(odds[5], expected);
    if (expected < 1.0) approx(odds[4] / odds[3], 17 / 81);
  });

  it("Hall of Ancestors: a 5★ comes from the standard pool without featured logic", () => {
    const result = rules.pull(pityState(), "hall_of_ancestors", new ScriptedRandom(0.0));
    expect(result.rarity).toBe(5);
    expect(["mahmut", "fadyme"]).toContain(result.reward_id);
    expect(result.is_featured).toBeNull();
    expect(result.account_state.lost_featured_next_five_star_guaranteed).toBe(false);
  });

  it("Hall of Ancestors: counters are separate from the limited banner", () => {
    const result = rules.pull(pityState({ character_five_star_pity: 40, character_four_star_pity: 3 }), "hall_of_ancestors", new ScriptedRandom(0.999999));
    expect(result.rarity).toBe(3);
    expect(result.account_state.standard_five_star_pity).toBe(1);
    expect(result.account_state.standard_four_star_pity).toBe(1);
    expect([result.account_state.character_five_star_pity, result.account_state.character_four_star_pity]).toEqual([40, 3]);
    const tenth = rules.pull({ ...result.account_state, standard_four_star_pity: 9 }, "hall_of_ancestors", new ScriptedRandom(0.999999));
    expect(tenth.rarity === 4 && tenth.minimum_four_star_triggered).toBe(true);
    expect(LIMITED).not.toContain(tenth.reward_id);
  });

  it("Hall of Ancestors never grants a limited character", () => {
    const stream = rng(7);
    let state = pityState();
    for (let index = 0; index < 3000; index++) {
      const result = rules.pull(state, "hall_of_ancestors", stream);
      expect(LIMITED).not.toContain(result.reward_id);
      state = result.account_state;
    }
  });
});

describe("test_banner_rotation.py", () => {
  const EPOCH = new Date("2026-10-05T00:00:00Z"); // a Monday
  const DAY = 86_400_000;
  const PERMANENT = ["hall_of_ancestors", "hall_of_armaments"];
  const ORDER = ["oath_01_aveline", "oath_02_sable", "oath_03_nara", "oath_04_mirel", "oath_05_vespera"];
  const at = (ms: number): Date => new Date(EPOCH.getTime() + ms);
  const open = (now: Date, epoch: Date | null = EPOCH) => openBannerWindows(BANNERS, now, epoch);
  const ids = (now: Date, epoch: Date | null = EPOCH) => open(now, epoch).map((window) => window.banner_id);

  it("content order is the story order and loops", () => {
    const rotation = BANNERS.rotation as Record<string, unknown>;
    expect(rotation.order).toEqual(ORDER);
    expect(rotation.after_last).toBe("loop");
    expect(BANNERS.limited_duration_days).toBe(15);
  });

  it("permanent banners are always open and undated", () => {
    for (const now of [at(-3 * DAY), EPOCH, at(400 * DAY)]) {
      const permanent = open(now).slice(0, 2);
      expect(permanent.map((window) => window.banner_id)).toEqual(PERMANENT);
      expect(permanent.every((window) => window.closes_at === null)).toBe(true);
    }
  });

  it("before launch only the permanent banners are open", () => {
    expect(ids(at(-1000))).toEqual(PERMANENT);
  });

  it("each pair is open for exactly 15 days and both banners move together", () => {
    ORDER.forEach((pair, index) => {
      const start = 15 * index * DAY;
      const expected = [...PERMANENT, `character:${pair}`, `weapon:${pair}`];
      expect(ids(at(start))).toEqual(expected);
      expect(ids(at(start + 15 * DAY - 1))).toEqual(expected); // last instant (JS Dates have millisecond resolution)
      const windows = open(at(start + 3 * DAY));
      expect(windows[2]!.closes_at).toEqual(at(start + 15 * DAY));
      expect(windows[3]!.closes_at).toEqual(at(start + 15 * DAY));
    });
  });

  it("the boundary hands over with no gap and no overlap", () => {
    expect(ids(at(15 * DAY - 1))[2]).toBe("character:oath_01_aveline");
    expect(ids(at(15 * DAY)).slice(2)).toEqual(["character:oath_02_sable", "weapon:oath_02_sable"]);
  });

  it("after Oath 5 the cycle starts over every 75 days", () => {
    expect(ids(at(75 * DAY))[2]).toBe("character:oath_01_aveline");
    expect(ids(at((75 + 15 * 3 + 1) * DAY))[2]).toBe("character:oath_04_mirel");
    expect(ids(at((75 * 40 + 15 * 2) * DAY))[2]).toBe("character:oath_03_nara");
  });

  it("without an epoch the first pair stays open, undated", () => {
    const windows = open(new Date("2030-01-01T00:00:00Z"), null);
    expect(windows.map((window) => window.banner_id)).toEqual([...PERMANENT, "character:oath_01_aveline", "weapon:oath_01_aveline"]);
    expect(windows.every((window) => window.closes_at === null)).toBe(true);
  });

  it.each(["2026-10-06T00:00:00Z", "2026-10-05T12:00:00Z", "2026-10-05T00:00:01Z", "2026-10-05T00:00:00", "2026-10-05T00:00:00+02:00", "not a date"])(
    "the epoch must be a Monday midnight UTC: %s",
    (text) => {
      expect(() => parseEpoch(text)).toThrow(RotationError);
    },
  );

  it("the epoch accepts Z and an explicit UTC offset, normalized before the Monday check", () => {
    expect(parseEpoch("2026-10-05T00:00:00Z")).toEqual(EPOCH);
    expect(parseEpoch("2026-10-05T00:00:00+00:00")).toEqual(EPOCH);
    expect(parseEpoch("2026-10-05T02:00:00+02:00")).toEqual(EPOCH);
  });
});

describe("test_banner_state.py (pure parts: describe_next_pull and banner_status)", () => {
  const CHAR = "character:oath_01_aveline";
  const state = (fields: Partial<AccountPityState>) => pityState(fields);

  it("a fresh account sees base rates and no guarantee", () => {
    const windows = rules.openBanners(new Date("2026-10-04T00:00:00Z"), null);
    const banners = Object.fromEntries(windows.map((window) => [window.banner_id, rules.bannerInfo(window, null)]));
    const limited = banners[CHAR]!;
    const weapon = banners["weapon:oath_01_aveline"]!;
    const ancestors = banners.hall_of_ancestors!;
    approx(limited.next_pull.five_star, 0.025);
    expect([limited.hard_pity, limited.pity, limited.pulls_until_hard_pity]).toEqual([80, 0, 80]);
    approx(weapon.next_pull.five_star, 0.025);
    expect(weapon.hard_pity).toBe(65);
    approx(ancestors.next_pull.five_star, 0.02);
    for (const banner of Object.values(banners)) {
      const odds = banner.next_pull;
      approx(odds.five_star + odds.four_star + odds.three_star, 1.0);
      expect([banner.four_star_pity, banner.four_star_guarantee_every, banner.four_star_guaranteed_next]).toEqual([0, 10, false]);
      expect([banner.guarantee.active, banner.guarantee.text]).toEqual([false, ""]);
      expect(banner.pull_cost).toBe(1);
    }
    expect(limited.guarantee.kind).toBe("featured_character");
    expect(weapon.guarantee).toEqual({ kind: "weapon_target", active: false, fate_knots: 0, fate_knots_needed: 2, text: "" });
    expect(ancestors.guarantee.kind).toBe("none");
    expect(banners.hall_of_armaments!.target_ids).toHaveLength(15);
    expect(limited.target_ids).toBeNull();
    expect(limited.closes_at).toBeNull();
  });

  it.each([
    [63, 0.025],
    [64, 0.025 + 0.06 * 1],
    [70, 0.025 + 0.06 * 7],
    [79, 1.0],
  ])("limited character soft and hard pity (pity %i)", (pity, expected) => {
    const banner = rules.bannerState(CHAR, state({ character_five_star_pity: pity }));
    approx(banner.next_pull.five_star, expected);
    expect([banner.pity, banner.pulls_until_hard_pity]).toEqual([pity, 80 - pity]);
  });

  it("the lost-featured flag becomes an active guarantee with text", () => {
    expect(rules.bannerState(CHAR, state({ lost_featured_next_five_star_guaranteed: true })).guarantee).toEqual({
      kind: "featured_character",
      active: true,
      fate_knots: null,
      fate_knots_needed: null,
      text: "Next 5★ is guaranteed to be the featured hero",
    });
  });

  it("weapon Fate Knot progress and guarantee texts", () => {
    expect(rules.bannerState("weapon:oath_01_aveline", state({ weapon_fate_knots: 1 })).guarantee).toEqual({
      kind: "weapon_target",
      active: false,
      fate_knots: 1,
      fate_knots_needed: 2,
      text: "Fate Knots: 1/2",
    });
    expect(rules.bannerState("hall_of_armaments", state({ weapon_fate_knots: 1 })).guarantee.text).toBe("Fate Knots: 1/2");
    const limited = rules.bannerState("weapon:oath_01_aveline", state({ weapon_fate_knots: 2 }));
    expect(limited.guarantee.active).toBe(true);
    expect(limited.guarantee.text).toBe("Next 5★ is guaranteed to be the featured weapon");
    expect(rules.bannerState("hall_of_armaments", state({ weapon_fate_knots: 2 })).guarantee.text).toBe(
      "Next 5★ is guaranteed to be your selected weapon",
    );
  });

  it("the Hall of Armaments reports the remembered or the default target", () => {
    const targets = rules.hallTargetIds();
    expect(targets.slice(0, 2)).toEqual(["weapon_mahmut_signature", "weapon_fadyme_signature"]);
    expect(rules.bannerState("hall_of_armaments", null).selected_target_id).toBe(targets[0]);
    expect(rules.bannerState("hall_of_armaments", state({ selected_weapon_target_id: targets[3]! })).selected_target_id).toBe(targets[3]);
    expect(rules.bannerState("hall_of_armaments", state({ selected_weapon_target_id: "not_a_selectable_weapon" })).selected_target_id).toBe(targets[0]);
    expect(rules.bannerState("weapon:oath_01_aveline", state({ selected_weapon_target_id: targets[3]! })).selected_target_id).toBeNull();
  });

  it.each<[string, Partial<AccountPityState>]>([
    ["character", {}],
    ["character", { character_five_star_pity: 66, character_four_star_pity: 9 }],
    ["weapon", { weapon_five_star_pity: 64, weapon_four_star_pity: 4, weapon_fate_knots: 1 }],
    ["standard_character", { standard_five_star_pity: 79, standard_four_star_pity: 9 }],
  ])("banner values equal the legacy local derivation (%s %j)", (bannerType, fields) => {
    const windows = rules.openBanners(new Date("2026-10-04T00:00:00Z"), null);
    for (const window of windows) {
      if (GachaRules.bannerTypeFor(window.banner_id) !== bannerType) continue;
      const info = rules.bannerInfo(window, pityState(fields));
      const legacy = window.banner_id === "hall_of_armaments" ? pityState({ ...fields, selected_weapon_target_id: info.selected_target_id }) : pityState(fields);
      const five = rules.getRarityProbabilities(legacy, window.banner_id)[5];
      expect(Math.round(info.next_pull.five_star * 10000)).toBe(Math.round(five * 10000));
      const counter = { character: legacy.character_five_star_pity, weapon: legacy.weapon_five_star_pity, standard_character: legacy.standard_five_star_pity }[
        bannerType
      ];
      expect(info.pity).toBe(counter);
    }
  });

  it("describe_next_pull folds the minimum-4★ rule into the odds", () => {
    const plain = rules.describeNextPull(state({ character_four_star_pity: 3 }), CHAR);
    expect(plain.four_star_guaranteed).toBe(false);
    expect(plain.three_star).toBeGreaterThan(0);
    const due = rules.describeNextPull(state({ character_four_star_pity: 9 }), CHAR);
    expect(due.four_star_guaranteed).toBe(true);
    expect(due.three_star).toBe(0.0);
    const raw = rules.getRarityProbabilities(state({ character_four_star_pity: 9 }), CHAR);
    expect(due.five_star).toBe(raw[5]);
    approx(due.four_star, raw[4] + raw[3]);
    approx(due.five_star + due.four_star + due.three_star, 1.0);
  });

  it("describe_next_pull agrees with what pull then does", () => {
    const fourDue = state({ character_four_star_pity: 9 });
    const hard = state({ character_five_star_pity: 79 });
    expect(rules.describeNextPull(fourDue, CHAR).four_star_guaranteed).toBe(true);
    expect(rules.describeNextPull(hard, CHAR).pulls_until_hard_pity).toBe(1);
    for (let seed = 0; seed < 300; seed++) {
      expect(rules.pull(fourDue, CHAR, rng(seed)).rarity).toBeGreaterThanOrEqual(4);
      expect(rules.pull(hard, CHAR, rng(seed)).rarity).toBe(5);
    }
  });
});

describe("server/gacha_transaction.py (pure parts, from test_gacha_pull.py / test_gacha_ten_pull.py)", () => {
  const OPEN = rules.openBanners(new Date("2026-10-04T00:00:00Z"), null).map((window) => window.banner_id);
  const plan = (input: Partial<Parameters<GachaRules["resolvePulls"]>[0]> & { banner_id: string }) =>
    rules.resolvePulls({ stored: null, pull_count: 10, open_banner_ids: OPEN, rng: rng(1), ...input });

  it("banner types and the pull cost", () => {
    expect(GachaRules.bannerTypeFor("character:oath_02_sable")).toBe("character");
    expect(GachaRules.bannerTypeFor("limited_character")).toBe("character");
    expect(GachaRules.bannerTypeFor("hall_of_ancestors")).toBe("standard_character");
    expect(GachaRules.bannerTypeFor("weapon:oath_02_sable")).toBe("weapon");
    expect(GachaRules.bannerTypeFor("limited_signature_weapon")).toBe("weapon");
    expect(GachaRules.bannerTypeFor("hall_of_armaments")).toBe("weapon");
    expect(gachaError(() => GachaRules.bannerTypeFor("standard")).message).toBe("Unsupported banner ID: standard");
    expect(rules.pullCost()).toBe(1);
    expect(plan({ banner_id: "character:oath_01_aveline" }).total_cost).toBe(10);
    expect(plan({ banner_id: "character:oath_01_aveline", pull_count: 1 }).total_cost).toBe(1);
  });

  it("a 10-pull chains pity and always holds a 4★ or better", () => {
    for (let seed = 0; seed < 200; seed++) {
      const result = plan({ banner_id: "character:oath_01_aveline", rng: rng(seed) });
      expect(result.results).toHaveLength(10);
      expect(result.results.some((pull) => pull.rarity >= 4)).toBe(true);
      expect(result.final_state).toEqual(result.results[9]!.account_state);
      for (let index = 1; index < 10; index++) {
        const before = result.results[index - 1]!.account_state.character_five_star_pity;
        const pull = result.results[index]!;
        expect(pull.account_state.character_five_star_pity).toBe(pull.rarity === 5 ? 0 : before + 1);
      }
    }
  });

  it("a single character pull leaves the weapon-side pity untouched", () => {
    const result = plan({ banner_id: "character:oath_01_aveline", pull_count: 1 });
    expect([0, 1]).toContain(result.final_state.character_five_star_pity);
    expect([result.final_state.weapon_five_star_pity, result.final_state.weapon_four_star_pity, result.final_state.weapon_fate_knots]).toEqual([0, 0, 0]);
    expect(Object.keys(pityStatePayload(result.final_state)).sort()).toEqual([
      "character_five_star_pity",
      "character_four_star_pity",
      "lost_featured_next_five_star_guaranteed",
      "selected_character_id",
      "selected_weapon_target_id",
      "standard_five_star_pity",
      "standard_four_star_pity",
      "weapon_fate_knots",
      "weapon_five_star_pity",
      "weapon_four_star_pity",
    ]);
  });

  it("the Hall of Ancestors uses its own counters (standard_character row)", () => {
    const result = plan({ banner_id: "hall_of_ancestors" });
    expect(result.banner_type).toBe("standard_character");
    const rarities = result.results.map((pull) => pull.rarity);
    const lastFive = rarities.lastIndexOf(5);
    expect(result.final_state.standard_five_star_pity).toBe(rarities.length - 1 - lastFive);
    expect(result.final_state.character_five_star_pity).toBe(0);
    expect(result.results.every((pull) => grantKindFor(pull) === "character")).toBe(true);
  });

  it("the Hall of Armaments persists its target and shares the weapon pity", () => {
    const targets = rules.hallTargetIds();
    const result = plan({ banner_id: "hall_of_armaments", target_id: targets[3]!, stored: { weapon_fate_knots: 1, weapon_five_star_pity: 10 } });
    expect(result.banner_type).toBe("weapon");
    expect(result.final_state.selected_weapon_target_id).toBe(targets[3]);
    expect(result.results.every((pull) => grantKindFor(pull) === "weapon")).toBe(true);
    const rarities = result.results.map((pull) => pull.rarity);
    expect(result.final_state.weapon_five_star_pity).toBe(rarities.includes(5) ? rarities.length - 1 - rarities.lastIndexOf(5) : 20);
    // The same pity row then serves the paired weapon banner.
    expect(plan({ banner_id: "weapon:oath_01_aveline", pull_count: 1, stored: pityStatePayload(result.final_state) }).results).toHaveLength(1);
  });

  it("rejects bad targets, closed banners and the generic selected-target ids before anything is charged", () => {
    const message = (input: Partial<Parameters<GachaRules["resolvePulls"]>[0]> & { banner_id: string }) => gachaError(() => plan(input)).message;
    for (const bad of [null, "nonsense", "weapon_aveline_last_vigil"]) {
      expect(message({ banner_id: "hall_of_armaments", pull_count: 1, target_id: bad })).toMatch(/^hall_of_armaments needs a selectable target_id/);
    }
    expect(message({ banner_id: "character:oath_01_aveline", target_id: "weapon_mahmut_signature" })).toBe("target_id only applies to hall_of_armaments");
    expect(message({ banner_id: "character:oath_02_sable" })).toBe("Banner 'character:oath_02_sable' is not open for pulls");
    expect(message({ banner_id: "limited_character" })).toMatch(/^This server only accepts explicit/);
    expect(message({ banner_id: "character:not_a_real_banner", open_banner_ids: ["character:not_a_real_banner"] })).toBe(
      "Unknown character banner ID: character:not_a_real_banner",
    );
    expect(message({ banner_id: "character:oath_01_aveline", pull_count: 5 })).toBe("pull_count must be one of (1, 10), got 5");
  });

  it("the stored payload loads like AccountPityState(**payload)", () => {
    expect(pityStateFromPayload(null)).toEqual(pityState());
    expect(pityStateFromPayload({ weapon_fate_knots: 2 }).weapon_fate_knots).toBe(2);
    const error = gachaError(() => pityStateFromPayload({ bogus: 1 }));
    expect([error.kind, error.message, error.isRequestError]).toEqual(["TypeError", "AccountPityState.__init__() got an unexpected keyword argument 'bogus'", false]);
  });

  it("the response mirrors the last pull and lists every pull with its grant", () => {
    const result = plan({ banner_id: "weapon:oath_01_aveline", rng: rng(3) });
    const outcomes = result.results.map((pull, index) => ({
      pull_id: `pull_${index}`,
      result: pull,
      grant: weaponGrant(pull.reward_id!, `wpn_${index}`),
    }));
    const response = pullsToResponse(outcomes);
    expect(response.pull_count).toBe(10);
    expect(response.results).toHaveLength(10);
    expect(new Set(response.results.map((entry) => entry.pull_id)).size).toBe(10);
    expect(response.rarity).toBe(response.results[9]!.rarity);
    expect(response.reward_id).toBe(result.results[9]!.reward_id);
    expect(Object.keys(response)).toEqual([
      "banner_id",
      "banner_type",
      "rarity",
      "reward_id",
      "outcome_pool_id",
      "is_featured",
      "hard_pity_triggered",
      "featured_guarantee_triggered",
      "target_guarantee_triggered",
      "minimum_four_star_triggered",
      "pull_count",
      "results",
    ]);
    expect(Object.keys(response.results[0]!)[0]).toBe("pull_id");
    expect(response.results[0]!.grant).toEqual({ kind: "weapon", item_id: result.results[0]!.reward_id, duplicate: false, copies: null, instance_id: "wpn_0", memory_shards: 0 });
  });

  it("idempotency fingerprints keep the historical single-pull form", () => {
    expect(pullFingerprint("character:oath_01_aveline", 1)).toBe("character:oath_01_aveline");
    expect(pullFingerprint("character:oath_01_aveline", 10)).toBe("character:oath_01_aveline|x10");
    expect(pullFingerprint("hall_of_armaments", 1, "weapon_mahmut_signature")).toBe("hall_of_armaments|target=weapon_mahmut_signature");
    expect(pullFingerprint("hall_of_armaments", 10, "weapon_mahmut_signature")).toBe("hall_of_armaments|x10|target=weapon_mahmut_signature");
  });
});

describe("server/gacha_grants.py (duplicate policy)", () => {
  it("a first copy inserts copies 1 without shards", () => {
    expect(rules.characterGrant("kera_voss", null)).toEqual({
      grant: { kind: "character", item_id: "kera_voss", duplicate: false, copies: 1, instance_id: null, memory_shards: 0 },
      roster: { insert: true, copies: 1, memory_shards: 0 },
    });
  });

  it("free starters count as owned, so their first pull is a duplicate", () => {
    expect(rules.characterGrant("fadyme", null)).toEqual({
      grant: { kind: "character", item_id: "fadyme", duplicate: true, copies: 2, instance_id: null, memory_shards: 10 },
      roster: { insert: true, copies: 2, memory_shards: 10 },
    });
  });

  it("each duplicate increments copies and adds the rarity's Memory Shards (5★ 10, 4★ 5, 3★ 2)", () => {
    expect(rules.characterGrant("sister_aveline", { copies: 1, memory_shards: 0 }).roster).toEqual({ insert: false, copies: 2, memory_shards: 10 });
    expect(rules.characterGrant("tilda_fen", { copies: 3, memory_shards: 7 })).toEqual({
      grant: { kind: "character", item_id: "tilda_fen", duplicate: true, copies: 4, instance_id: null, memory_shards: 5 },
      roster: { insert: false, copies: 4, memory_shards: 12 },
    });
    expect(rules.characterGrant("clem_marr", { copies: 1, memory_shards: 0 }).grant.memory_shards).toBe(2);
  });

  it("copies count every pull of the same character across a 20-pull sequence", () => {
    const owned = new Map<string, { copies: number; memory_shards: number }>();
    const stream = rng(5);
    let state = pityState();
    for (let index = 0; index < 20; index++) {
      const pull = rules.pull(state, "character:oath_01_aveline", stream);
      state = pull.account_state;
      const plan = rules.characterGrant(pull.reward_id!, owned.get(pull.reward_id!) ?? null);
      owned.set(pull.reward_id!, { copies: plan.roster.copies, memory_shards: plan.roster.memory_shards });
      expect(plan.grant.duplicate).toBe(plan.grant.copies! > 1);
    }
    expect([...owned.values()].some((row) => row.copies > 1)).toBe(true);
  });

  it("an unsupported conversion fails like the reference", () => {
    const policy = { ...(BANNERS.duplicate_policy as Record<string, unknown>), conversion: "silver" };
    const bad = new GachaRules({ ...economy, banners: { ...BANNERS, duplicate_policy: policy } }, characters, weapons);
    const error = gachaError(() => bad.characterGrant("kera_voss", null));
    expect([error.kind, error.message]).toEqual(["ValueError", "Unsupported duplicate_policy.conversion: 'silver'"]);
  });

  it("grant kinds follow the banner type; an unresolved loss grants nothing", () => {
    const character = rules.pull(pityState(), "character:oath_01_aveline", rng(1));
    expect(grantKindFor(character)).toBe("character");
    expect(grantKindFor({ ...character, reward_id: null, outcome_pool_id: "character_standard_five_star_pool" })).toBeNull();
    expect(grantKindFor(rules.pull(pityState(), "weapon:oath_01_aveline", rng(1)))).toBe("weapon");
  });
});
