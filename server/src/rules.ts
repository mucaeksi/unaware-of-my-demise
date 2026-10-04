// The engine's content registry and rule services, built once per Worker isolate from the packs the client ships
// (game/data/content, bundled at build time). Building is lazy so a request that needs no rules pays nothing.
import accessories from "../../game/data/content/accessories_part1.json";
import armors from "../../game/data/content/armors_part1.json";
import battleEffects from "../../game/data/content/battle_effects_part1.json";
import battleRules from "../../game/data/content/battle_rules_part1.json";
import characters from "../../game/data/content/characters_part1.json";
import dropTables from "../../game/data/content/drop_tables_part1.json";
import economy from "../../game/data/content/economy_part1.json";
import enemies from "../../game/data/content/enemies_part1.json";
import items from "../../game/data/content/items_part1.json";
import stages from "../../game/data/content/stages_part1.json";
import storyManifest from "../../game/data/content/story_script_part1_manifest.json";
import weapons from "../../game/data/content/weapons_part1.json";
import { AccessoryRoller } from "./engine/accessories";
import { BattleService } from "./engine/battle/service";
import { loadPacks, type ContentRegistry, type PackName } from "./engine/content";
import { Equipment } from "./engine/equipment";
import { LootResolver } from "./engine/loot";
import { Progression } from "./engine/progression";
import { QuestProgress } from "./engine/quests";
import { StoryRules } from "./engine/story";

const PACKS: Record<PackName, unknown> = {
  "characters_part1.json": characters,
  "enemies_part1.json": enemies,
  "weapons_part1.json": weapons,
  "armors_part1.json": armors,
  "accessories_part1.json": accessories,
  "items_part1.json": items,
  "stages_part1.json": stages,
  "battle_rules_part1.json": battleRules,
  "drop_tables_part1.json": dropTables,
  "battle_effects_part1.json": battleEffects,
};

const once = <T>(build: () => T): (() => T) => {
  let value: T | undefined;
  return () => (value ??= build());
};

export const contentRegistry = once((): ContentRegistry => loadPacks(PACKS));
export const storyRules = once(() => new StoryRules(contentRegistry(), storyManifest as Record<string, unknown>));
export const lootResolver = once(() => new LootResolver(contentRegistry()));
export const battleService = once(() => BattleService.create(contentRegistry(), storyRules()));
export const equipmentRules = once(() => new Equipment(contentRegistry()));
export const accessoryRoller = once(() => new AccessoryRoller(contentRegistry().accessories));
export const progression = once(() => Progression.create(contentRegistry()));
export const questProgress = once(() => new QuestProgress(economy as Record<string, unknown>, items as Record<string, unknown>));

/** items_part1.json `stack_cap` per item id (items without an integer cap are unbounded). */
export const stackCaps = once(
  (): ReadonlyMap<string, number> =>
    new Map(
      [...contentRegistry().items.values()]
        .filter((item) => Number.isInteger(item.stack_cap))
        .map((item) => [item.item_id, item.stack_cap as number]),
    ),
);

/** items_part1.json `progression_rules.character_xp`: Character XP per Chronicle item. */
export const characterXpValues = once((): ReadonlyMap<string, number> => {
  const values = (items as { progression_rules?: { character_xp?: unknown } }).progression_rules?.character_xp;
  if (values === null || typeof values !== "object" || Array.isArray(values) || Object.keys(values).length === 0) {
    throw new Error("items_part1.json progression_rules.character_xp is missing");
  }
  return new Map(Object.entries(values as Record<string, unknown>).map(([itemId, xp]) => [itemId, Math.trunc(Number(xp))]));
});

/** A string id under items_part1.json `progression_rules` (`dismantle_resource_id`, `reroll_token_id`). */
export function itemProgressionRule(key: string): string {
  const value = (items as { progression_rules?: Record<string, unknown> }).progression_rules?.[key];
  if (typeof value !== "string" || !value) throw new Error(`items_part1.json progression_rules.${key} is missing`);
  return value;
}
