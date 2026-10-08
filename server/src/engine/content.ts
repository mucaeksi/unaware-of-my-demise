// Loads and validates the Part I JSON content packs into a ContentRegistry (port of core/content/content_loader.gd and
// content_models.gd, themselves ports of LEGACY core/content_loader.py and core/models.py).
//
// Records are plain objects with the Python dataclass field names; an absent optional value is null, as in the
// reference (parity/fixtures/content_registry.json compares them directly). The first failed check throws
// ContentLoadError with the reference's message; checks run in the reference's order, so it is the same first message
// (parity/fixtures/content_errors.json).

export class ContentLoadError extends Error {}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Row = { [key: string]: Json };

export interface EffectOp {
  op: string;
  target_selector_id: string | null;
  parameters: Row;
}

export interface EffectHook {
  event: string;
  effect_ops: EffectOp[];
  extra: Row;
}

export interface Skill {
  skill_id: string;
  name_en: string;
  type: string;
  effect_ops: EffectOp[];
  element: string | null;
  target_rule: string | null;
  target_selector_id: string | null;
  scale_stat: string | null;
  multiplier: number | null;
  multipliers_pct: number[];
  cooldown_turns: number;
  focus_cost: number;
  focus_gain_rule: string | null;
  description_en: string | null;
  effect_en: string | null;
  auto_priority: number | null;
  ai_priority: number | null;
  damage_type: string | null;
  phase_ids: string[];
  telegraph_rules: Row;
  event_hooks: EffectHook[];
  continuous_modifiers: Row[];
  brand_mark_id: string | null;
  extra: Row;
}

export interface Character {
  character_id: string;
  name_en: string;
  gender: string;
  age: number;
  rarity: number;
  element: string;
  class_id: string;
  combat_role: string;
  signature_weapon_id: string;
  equip_weapon_type: string;
  skills: Skill[];
  base_stats_level_1: Row;
  growth_per_level: Row;
  level_cap: number;
  acquisition: Json;
  banner_id: string | null;
  brand_mark_id: string | null;
  skill_ids: string[];
  stat_formula: string | null;
  formation_affinity: Json;
  balance_status: string | null;
  extra: Row;
}

export interface BossObjective {
  objective_id: string;
  name_en: string;
  max_hp: number;
  hp: number;
  targetable_by_player: boolean;
  persists_across_phases: boolean | null;
  on_destroyed: EffectOp[];
  extra: Row;
}

export interface BossPhase {
  phase_id: string;
  name_en: string;
  transition: string;
  hp_multiplier: number;
  atk_multiplier: number;
  def_multiplier: number;
  weaknesses: string[];
  objectives: BossObjective[];
  transition_hp_percent: number | null;
  passives: Row[];
  telegraph: string | null;
  intent_rules: Row;
  interruptible_by_control: boolean;
  tauntable: boolean;
  break_targets: string[];
  enter_ops: EffectOp[];
  passive_ops: EffectOp[];
  signature_action_id: string | null;
  extra: Row;
}

export interface Enemy {
  enemy_id: string;
  name_en: string;
  faction_id: string;
  role: string;
  element: string;
  base_stats_level_1: Row;
  growth_per_level: Row;
  weaknesses: string[];
  resistances: string[];
  status_immunities: string[];
  skills: Skill[];
  phases: BossPhase[];
  intent: Row;
  passive_hooks: EffectHook[];
  continuous_modifiers: Row[];
  passives: Row[];
  boss_id: string | null;
  phase_ids: string[];
  drop_table_id: string | null;
  brand_mark_id: string | null;
  extra: Row;
}

export interface EnemyWaveEntry {
  enemy_id: string;
  count: number;
  extra: Row;
}

export interface Stage {
  stage_id: string;
  chapter_id: string;
  title_en: string;
  node_type: string;
  recommended_level: number;
  enemy_level: number;
  stamina_cost: number;
  enemy_waves: EnemyWaveEntry[][];
  drop_table_id: string;
  boss_id: string | null;
  boss_phases: string[];
  phase_mechanics: Row | null;
  guest_characters: string[];
  story_rewards: Row[];
  story_beat_en: string | null;
  /** Multiplies every enemy's HP and ATK in this stage; 1.0 = authored stats. */
  enemy_stat_multiplier: number;
  extra: Row;
}

export interface Weapon {
  weapon_id: string;
  name_en: string;
  rarity: number;
  weapon_type: string;
  acquisition: Json;
  level_cap: number;
  base_stats_level_1: Row;
  growth_per_level: Row;
  dismantle_xp: number;
  dismantle_allowed: boolean;
  owner_character_id: string | null;
  banner_id: string | null;
  brand_mark_id: string | null;
  passive_name_en: string | null;
  passive_effect_en: string | null;
  passive_effect_id: string | null;
  dismantle_output: Row[];
  balance_status: string | null;
  extra: Row;
}

export interface Armor {
  armor_id: string;
  name_en: string;
  rarity: number;
  armor_type: string;
  slot: string;
  acquisition: Json;
  level_cap: number;
  base_stats_level_1: Row;
  growth_per_level: Row;
  dismantle_xp: number;
  dismantle_allowed: boolean;
  brand_mark_id: string | null;
  dismantle_output: Row[];
  tier_id: string | null;
  extra: Row;
}

export interface AccessoryTemplate {
  accessory_id: string;
  name_en: string;
  rarity: number;
  slot: string;
  set_id: string;
  set_name_en: string;
  possible_main_stats: Row[];
  possible_sub_stats: Row[];
  rarity_profiles: Row;
  acquisition: Json;
  drop_is_gacha: boolean;
  brand_mark_id: string | null;
  flavor_en: string | null;
  extra: Row;
}

export interface Item {
  item_id: string;
  name_en: string;
  kind: string;
  rarity: number | null;
  stack_cap: number | null;
  xp_value: number | null;
  description_en: string;
  sources: string[];
  consumable: boolean;
  brand_mark_id: string | null;
  extra: Row;
}

export interface DropTable {
  drop_table_id: string;
  repeatable_rewards: Row[];
  first_clear_rewards: Row[];
  extra: Row;
}

export interface Status {
  status_id: string;
  name_en: string;
  kind: string;
  default_duration_turns: number;
  tags: string[];
  stacking: string;
  source_atk_multiplier_per_tick: number | null;
  extra: Row;
}

/** Part I content indexed by stable id (Maps keep the reference's insertion order). */
export interface ContentRegistry {
  characters: Map<string, Character>;
  skills: Map<string, Skill>;
  enemies: Map<string, Enemy>;
  boss_phases: Map<string, BossPhase>;
  boss_objectives: Map<string, BossObjective>;
  stages: Map<string, Stage>;
  weapons: Map<string, Weapon>;
  armors: Map<string, Armor>;
  accessories: Map<string, AccessoryTemplate>;
  items: Map<string, Item>;
  drop_tables: Map<string, DropTable>;
  statuses: Map<string, Status>;
  weapon_types: Record<string, Row>;
  weapon_banners: Record<string, Row>;
  accessory_sets: Record<string, Row>;
  currency_references: Record<string, Row>;
  battle_rules: Row;
  effect_operation_schemas: Record<string, Row>;
  /** The `contract` object of battle_effects_part1.json: the effect interpreter's rulebook, raw JSON. */
  effect_contract: Row;
  /** The raw drop_tables_part1.json object (claim keys, guarantees, claim scopes) the loot resolver reads. */
  drop_pack: Row;
  accessory_slots: Json;
  armor_slot_count: Json;
}

export const PACK_FILES = [
  "characters_part1.json",
  "enemies_part1.json",
  "weapons_part1.json",
  "armors_part1.json",
  "accessories_part1.json",
  "items_part1.json",
  "stages_part1.json",
  "battle_rules_part1.json",
  "drop_tables_part1.json",
  "battle_effects_part1.json",
] as const;

export type PackName = (typeof PACK_FILES)[number];

const SKILL_FIELDS = [
  "skill_id", "name_en", "type", "effect_ops", "element", "target_rule", "target_selector_id", "scale_stat", "multiplier",
  "multipliers_pct", "cooldown_turns", "focus_cost", "focus_gain_rule", "description_en", "effect_en", "auto_priority",
  "ai_priority", "damage_type", "phase_ids", "telegraph_rules", "event_hooks", "continuous_modifiers", "brand_mark_id",
];
const CHARACTER_FIELDS = [
  "character_id", "name_en", "gender", "age", "rarity", "element", "class_id", "combat_role", "acquisition", "banner_id",
  "signature_weapon_id", "equip_weapon_type", "brand_mark_id", "base_stats_level_1", "growth_per_level", "level_cap",
  "stat_formula", "formation_affinity", "skill_ids", "skills", "balance_status",
];
const OBJECTIVE_FIELDS = ["objective_id", "name_en", "max_hp", "hp", "targetable_by_player", "persists_across_phases", "on_destroyed"];
const PHASE_FIELDS = [
  "phase_id", "name_en", "transition", "transition_hp_percent", "hp_multiplier", "atk_multiplier", "def_multiplier",
  "weaknesses", "passives", "telegraph", "intent_rules", "interruptible_by_control", "tauntable", "break_targets",
  "objectives", "enter_ops", "passive_ops", "signature_action_id",
];
const ENEMY_FIELDS = [
  "enemy_id", "name_en", "faction_id", "role", "element", "base_stats_level_1", "growth_per_level", "weaknesses",
  "resistances", "status_immunities", "skills", "phases", "intent", "passive_hooks", "continuous_modifiers", "passives",
  "boss_id", "phase_ids", "drop_table_id", "brand_mark_id",
];
const STAGE_FIELDS = [
  "stage_id", "chapter_id", "title_en", "node_type", "recommended_level", "enemy_level", "stamina_cost", "enemy_waves",
  "drop_table_id", "boss_id", "boss_phases", "phase_mechanics", "guest_characters", "story_rewards", "story_beat_en",
  "enemy_stat_multiplier",
];
const WEAPON_FIELDS = [
  "weapon_id", "name_en", "rarity", "weapon_type", "acquisition", "banner_id", "owner_character_id", "level_cap",
  "base_stats_level_1", "growth_per_level", "passive_name_en", "passive_effect_en", "passive_effect_id", "dismantle_xp",
  "dismantle_output", "dismantle_allowed", "brand_mark_id", "balance_status",
];
const ARMOR_FIELDS = [
  "armor_id", "name_en", "rarity", "armor_type", "slot", "brand_mark_id", "acquisition", "level_cap", "base_stats_level_1",
  "growth_per_level", "dismantle_xp", "dismantle_output", "dismantle_allowed", "tier_id",
];
const ACCESSORY_FIELDS = [
  "accessory_id", "name_en", "rarity", "slot", "set_id", "set_name_en", "brand_mark_id", "possible_main_stats",
  "possible_sub_stats", "rarity_profiles", "acquisition", "drop_is_gacha", "flavor_en",
];
const ITEM_FIELDS = [
  "item_id", "name_en", "kind", "rarity", "brand_mark_id", "stack_cap", "xp_value", "description_en", "sources", "consumable",
];
const DROP_TABLE_FIELDS = ["drop_table_id", "repeatable_rewards", "first_clear_rewards"];
const STATUS_FIELDS = ["status_id", "name_en", "kind", "default_duration_turns", "source_atk_multiplier_per_tick", "tags", "stacking"];

// -- helpers ------------------------------------------------------------------------------------------

const fail = (message: string): never => {
  throw new ContentLoadError(message);
};

const isObject = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);
const isNumeric = (value: unknown): value is number => typeof value === "number";
const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
const deep = <T>(value: T): T => (value === null || typeof value !== "object" ? value : structuredClone(value));
const has = (row: Row, field: string): boolean => Object.hasOwn(row, field);
const get = (row: Row, field: string, fallback: Json | undefined = undefined): Json | undefined =>
  has(row, field) ? row[field] : fallback;

/** Python `repr` for the values that appear in reference error messages (as the GDScript port renders them). */
export function pyRepr(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") {
    if (value.includes("'") && !value.includes('"')) return `"${value}"`;
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }
  if (typeof value === "number") {
    // Every JSON number is a float in the GDScript port; a whole one prints as "N.0".
    if (Number.isInteger(value) && Math.abs(value) < 1e16) return `${value}.0`;
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(", ")}]`;
  if (isObject(value)) return `{${Object.entries(value).map(([key, item]) => `${pyRepr(key)}: ${pyRepr(item)}`).join(", ")}}`;
  return String(value);
}

const label = (value: unknown): string => (value === null || value === undefined ? "<unknown>" : String(value));

/** Python truthiness for the JSON values the passive check looks at. */
function truthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value) || typeof value === "string") return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return true;
}

function rows(pack: Row, field: string, fileName: string): Row[] {
  const value = pack[field];
  if (!Array.isArray(value)) fail(`${fileName}: ${pyRepr(field)} must be a JSON array`);
  (value as Json[]).forEach((row, index) => {
    if (!isObject(row)) fail(`${fileName}: ${field}[${index}] must be a JSON object`);
  });
  return value as Row[];
}

function indexRows(list: Row[], idField: string, context: string): Map<string, Row> {
  const indexed = new Map<string, Row>();
  list.forEach((row, index) => {
    const id = row[idField];
    if (typeof id !== "string" || id.length === 0) fail(`${context}[${index}]: missing non-empty ${idField}`);
    if (indexed.has(id as string)) fail(`${context}: duplicate ${idField} ${pyRepr(id)}`);
    indexed.set(id as string, row);
  });
  return indexed;
}

function catalogRows(pack: Row, field: string, idField: string, fileName: string): Record<string, Row> {
  const indexed = indexRows(rows(pack, field, fileName), idField, `${fileName}/${field}`);
  return Object.fromEntries([...indexed].map(([id, row]) => [id, deep(row)]));
}

function text(row: Row, field: string, context: string): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) fail(`${context}: ${pyRepr(field)} must be a non-empty string`);
  return value as string;
}

function optionalText(row: Row, field: string, context: string): string | null {
  const value = row[field];
  if (value === null || value === undefined) return null;
  return text(row, field, context);
}

function integer(row: Row, field: string, context: string, fallback?: number): number {
  const value = get(row, field, fallback);
  if (!isWhole(value)) fail(`${context}: ${pyRepr(field)} must be an integer`);
  return value as number;
}

function optionalInteger(row: Row, field: string, context: string): number | null {
  const value = row[field];
  if (value === null || value === undefined) return null;
  if (!isWhole(value)) fail(`${context}: ${pyRepr(field)} must be an integer or null`);
  return value as number;
}

function number(row: Row, field: string, context: string): number {
  const value = row[field];
  if (!isNumeric(value)) fail(`${context}: ${pyRepr(field)} must be numeric`);
  return value as number;
}

function optionalNumber(row: Row, field: string, context: string): number | null {
  const value = row[field];
  if (value === null || value === undefined) return null;
  if (!isNumeric(value)) fail(`${context}: ${pyRepr(field)} must be numeric or null`);
  return value as number;
}

function boolean(row: Row, field: string, context: string): boolean {
  const value = row[field];
  if (typeof value !== "boolean") fail(`${context}: ${pyRepr(field)} must be a boolean`);
  return value as boolean;
}

function optionalBoolean(row: Row, field: string, context: string): boolean | null {
  const value = row[field];
  if (value === null || value === undefined) return null;
  if (typeof value !== "boolean") fail(`${context}: ${pyRepr(field)} must be a boolean or null`);
  return value as boolean;
}

function mapping(row: Row, field: string, context: string): Row {
  const value = row[field];
  if (!isObject(value)) fail(`${context}: ${pyRepr(field)} must be a JSON object`);
  return deep(value as Row);
}

function optionalMapping(row: Row, field: string, context: string): Row {
  const value = get(row, field, {});
  if (value === null) return {};
  if (!isObject(value)) fail(`${context}: ${pyRepr(field)} must be a JSON object`);
  return deep(value as Row);
}

function stringTuple(row: Row, field: string, context: string): string[] {
  const value = get(row, field, []);
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) fail(`${context}: ${pyRepr(field)} must be an array of strings`);
  return [...(value as string[])];
}

function numberTuple(row: Row, field: string, context: string): number[] {
  const value = get(row, field, []);
  if (!Array.isArray(value) || !value.every(isNumeric)) fail(`${context}: ${pyRepr(field)} must be an array of numbers`);
  return [...(value as number[])];
}

function objectTuple(row: Row, field: string, context: string): Row[] {
  const value = get(row, field, []);
  if (!Array.isArray(value) || !value.every(isObject)) fail(`${context}: ${pyRepr(field)} must be an array of objects`);
  return (value as Row[]).map((item) => deep(item));
}

function extra(row: Row, known: readonly string[]): Row {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !known.includes(key)).map(([key, value]) => [key, deep(value)]));
}

// -- effect operations ---------------------------------------------------------------------------------

type Schemas = Record<string, Row>;

function validateOperationSchemas(effectPack: Row): Schemas {
  const contract = effectPack.contract;
  if (!isObject(contract)) fail("battle_effects_part1.json: contract must be an object");
  const schemas = (contract as Row).operation_schemas;
  const operations = (contract as Row).operations;
  const operationsOk = Array.isArray(operations) && operations.every((operation) => typeof operation === "string");
  if (!isObject(schemas) || !operationsOk) fail("battle_effects_part1.json: contract operations/schema are missing");
  const names = operations as string[];
  const schemaMap = schemas as Schemas;
  const sameKeys = names.every((name) => has(schemaMap, name)) && Object.keys(schemaMap).every((name) => names.includes(name));
  if (!sameKeys) fail("battle_effects_part1.json: operations and operation_schemas keys differ");
  for (const [operationName, schema] of Object.entries(schemaMap)) {
    if (!isObject(schema)) fail("battle_effects_part1.json: malformed operation schema");
    for (const field of ["required", "optional"]) {
      const values = get(schema, field, []);
      if (!Array.isArray(values) || !values.every((item) => typeof item === "string")) {
        fail(`battle_effects_part1.json: ${operationName}.${field} must be an array of strings`);
      }
    }
  }
  return schemaMap;
}

function validateEffectOp(raw: unknown, schemas: Schemas, context: string): void {
  if (!isObject(raw)) fail(`${context}: effect operation must be an object`);
  const operation = raw as Row;
  const opName = operation.op;
  if (typeof opName !== "string" || !has(schemas, opName)) fail(`${context}: unknown or missing effect operation ${pyRepr(opName)}`);
  const schema = schemas[opName as string]!;
  const required = (get(schema, "required", []) as string[]) ?? [];
  const optional = (get(schema, "optional", []) as string[]) ?? [];
  const missing = [...new Set(required.filter((field) => !has(operation, field)))].sort();
  const unexpected = Object.keys(operation).filter((key) => key !== "op" && !required.includes(key) && !optional.includes(key)).sort();
  if (missing.length > 0) fail(`${context}/${opName}: missing schema fields ${pyRepr(missing)}`);
  if (unexpected.length > 0) fail(`${context}/${opName}: fields outside the closed schema ${pyRepr(unexpected)}`);
}

function validateEffectOps(value: unknown, schemas: Schemas, context: string): void {
  if (!Array.isArray(value)) fail(`${context}: effect_ops must be an array`);
  (value as unknown[]).forEach((operation, index) => validateEffectOp(operation, schemas, `${context}[${index}]`));
}

function effectOp(raw: Row): EffectOp {
  const selector = raw.target_selector_id;
  const parameters: Row = {};
  for (const [key, value] of Object.entries(raw)) if (key !== "op" && key !== "target_selector_id") parameters[key] = deep(value);
  return { op: raw.op as string, target_selector_id: typeof selector === "string" ? selector : null, parameters };
}

function effectOps(row: Row, schemas: Schemas, context: string, field = "effect_ops"): EffectOp[] {
  const raw = get(row, field, []);
  validateEffectOps(raw, schemas, `${context}.${field}`);
  return (raw as Row[]).map(effectOp);
}

function eventHooks(row: Row, schemas: Schemas, context: string): EffectHook[] {
  const hooks = get(row, "event_hooks", []);
  if (!Array.isArray(hooks)) fail(`${context}: 'event_hooks' must be an array`);
  return (hooks as Json[]).map((hook, index) => {
    const hookContext = `${context}/event_hooks[${index}]`;
    if (!isObject(hook)) fail(`${hookContext}: event hook must be an object`);
    const hookRow = hook as Row;
    const event = text(hookRow, "event", hookContext);
    return { event, effect_ops: effectOps(hookRow, schemas, hookContext), extra: extra(hookRow, ["event", "effect_ops"]) };
  });
}

// -- records -----------------------------------------------------------------------------------------

function skill(row: Row, schemas: Schemas, context: string): Skill {
  return {
    skill_id: text(row, "skill_id", context),
    name_en: text(row, "name_en", context),
    type: text(row, "type", context),
    effect_ops: effectOps(row, schemas, context),
    element: optionalText(row, "element", context),
    target_rule: optionalText(row, "target_rule", context),
    target_selector_id: optionalText(row, "target_selector_id", context),
    scale_stat: optionalText(row, "scale_stat", context),
    multiplier: optionalNumber(row, "multiplier", context),
    multipliers_pct: numberTuple(row, "multipliers_pct", context),
    cooldown_turns: integer(row, "cooldown_turns", context, 0),
    focus_cost: integer(row, "focus_cost", context, 0),
    focus_gain_rule: optionalText(row, "focus_gain_rule", context),
    description_en: optionalText(row, "description_en", context),
    effect_en: optionalText(row, "effect_en", context),
    auto_priority: optionalInteger(row, "auto_priority", context),
    ai_priority: optionalInteger(row, "ai_priority", context),
    damage_type: optionalText(row, "damage_type", context),
    phase_ids: stringTuple(row, "phase_ids", context),
    telegraph_rules: optionalMapping(row, "telegraph_rules", context),
    event_hooks: eventHooks(row, schemas, context),
    continuous_modifiers: objectTuple(row, "continuous_modifiers", context),
    brand_mark_id: optionalText(row, "brand_mark_id", context),
    extra: extra(row, SKILL_FIELDS),
  };
}

function skillsOf(raw: Json | undefined, schemas: Schemas, context: string): Skill[] {
  return rows({ skills: raw ?? null }, "skills", context).map((row) =>
    skill(row, schemas, `${context}/skills/${label(row.skill_id)}`),
  );
}

function character(row: Row, schemas: Schemas): Character {
  const context = `characters/${label(row.character_id)}`;
  const skills = skillsOf(row.skills, schemas, context);
  return {
    character_id: text(row, "character_id", context),
    name_en: text(row, "name_en", context),
    gender: text(row, "gender", context),
    age: integer(row, "age", context),
    rarity: integer(row, "rarity", context),
    element: text(row, "element", context),
    class_id: text(row, "class_id", context),
    combat_role: text(row, "combat_role", context),
    signature_weapon_id: text(row, "signature_weapon_id", context),
    equip_weapon_type: text(row, "equip_weapon_type", context),
    skills,
    base_stats_level_1: mapping(row, "base_stats_level_1", context),
    growth_per_level: mapping(row, "growth_per_level", context),
    level_cap: integer(row, "level_cap", context),
    acquisition: deep(row.acquisition ?? null),
    banner_id: optionalText(row, "banner_id", context),
    brand_mark_id: optionalText(row, "brand_mark_id", context),
    skill_ids: stringTuple(row, "skill_ids", context),
    stat_formula: optionalText(row, "stat_formula", context),
    formation_affinity: deep(row.formation_affinity ?? null),
    balance_status: optionalText(row, "balance_status", context),
    extra: extra(row, CHARACTER_FIELDS),
  };
}

function bossObjective(row: Row, schemas: Schemas, context: string): BossObjective {
  return {
    objective_id: text(row, "objective_id", context),
    name_en: text(row, "name_en", context),
    max_hp: integer(row, "max_hp", context),
    hp: integer(row, "hp", context),
    targetable_by_player: boolean(row, "targetable_by_player", context),
    persists_across_phases: optionalBoolean(row, "persists_across_phases", context),
    on_destroyed: effectOps(row, schemas, context, "on_destroyed"),
    extra: extra(row, OBJECTIVE_FIELDS),
  };
}

function bossPhase(row: Row, schemas: Schemas, context: string): BossPhase {
  const phaseId = text(row, "phase_id", context);
  const objectiveRows = rows({ objectives: get(row, "objectives", []) ?? null }, "objectives", context);
  const name = text(row, "name_en", context);
  const transition = text(row, "transition", context);
  const hp = number(row, "hp_multiplier", context);
  const atk = number(row, "atk_multiplier", context);
  const def = number(row, "def_multiplier", context);
  const weaknesses = stringTuple(row, "weaknesses", context);
  const objectives = objectiveRows.map((objective) =>
    bossObjective(objective, schemas, `${context}/objectives/${label(objective.objective_id)}`),
  );
  return {
    phase_id: phaseId,
    name_en: name,
    transition,
    hp_multiplier: hp,
    atk_multiplier: atk,
    def_multiplier: def,
    weaknesses,
    objectives,
    transition_hp_percent: optionalNumber(row, "transition_hp_percent", context),
    passives: objectTuple(row, "passives", context),
    telegraph: optionalText(row, "telegraph", context),
    intent_rules: optionalMapping(row, "intent_rules", context),
    interruptible_by_control: boolean(row, "interruptible_by_control", context),
    tauntable: boolean(row, "tauntable", context),
    break_targets: stringTuple(row, "break_targets", context),
    enter_ops: effectOps(row, schemas, context, "enter_ops"),
    passive_ops: effectOps(row, schemas, context, "passive_ops"),
    signature_action_id: optionalText(row, "signature_action_id", context),
    extra: extra(row, PHASE_FIELDS),
  };
}

function enemy(row: Row, schemas: Schemas): Enemy {
  const enemyId = text(row, "enemy_id", "enemies");
  const context = `enemies/${enemyId}`;
  const skillRows = rows({ skills: get(row, "skills", []) ?? null }, "skills", context);
  const phaseRows = rows({ phases: get(row, "phases", []) ?? null }, "phases", context);
  const name = text(row, "name_en", context);
  const faction = text(row, "faction_id", context);
  const role = text(row, "role", context);
  const element = text(row, "element", context);
  const base = mapping(row, "base_stats_level_1", context);
  const growth = mapping(row, "growth_per_level", context);
  const weaknesses = stringTuple(row, "weaknesses", context);
  const resistances = stringTuple(row, "resistances", context);
  const immunities = stringTuple(row, "status_immunities", context);
  const skills = skillRows.map((skillRow) => skill(skillRow, schemas, `${context}/skills/${label(skillRow.skill_id)}`));
  const phases = phaseRows.map((phaseRow) => bossPhase(phaseRow, schemas, `${context}/phases/${label(phaseRow.phase_id)}`));
  return {
    enemy_id: enemyId,
    name_en: name,
    faction_id: faction,
    role,
    element,
    base_stats_level_1: base,
    growth_per_level: growth,
    weaknesses,
    resistances,
    status_immunities: immunities,
    skills,
    phases,
    intent: optionalMapping(row, "intent", context),
    passive_hooks: eventHooks({ event_hooks: get(row, "passive_hooks", []) ?? null }, schemas, context),
    continuous_modifiers: objectTuple(row, "continuous_modifiers", context),
    passives: objectTuple(row, "passives", context),
    boss_id: optionalText(row, "boss_id", context),
    phase_ids: stringTuple(row, "phase_ids", context),
    drop_table_id: optionalText(row, "drop_table_id", context),
    brand_mark_id: optionalText(row, "brand_mark_id", context),
    extra: extra(row, ENEMY_FIELDS),
  };
}

function stage(row: Row): Stage {
  const stageId = text(row, "stage_id", "stages");
  const context = `stages/${stageId}`;
  const rawWaves = row.enemy_waves;
  if (!Array.isArray(rawWaves)) fail(`${context}: 'enemy_waves' must be an array`);
  const waves = (rawWaves as Json[]).map((rawWave, waveIndex) => {
    if (!Array.isArray(rawWave)) fail(`${context}: enemy_waves[${waveIndex}] must be an array`);
    return (rawWave as Json[]).map((rawEntry, entryIndex) => {
      const entryContext = `${context}/enemy_waves[${waveIndex}][${entryIndex}]`;
      if (!isObject(rawEntry)) fail(`${entryContext}: enemy wave entry must be an object`);
      const entry = rawEntry as Row;
      const enemyId = text(entry, "enemy_id", entryContext);
      return { enemy_id: enemyId, count: integer(entry, "count", entryContext), extra: extra(entry, ["enemy_id", "count"]) };
    });
  });
  const phaseMechanics = row.phase_mechanics ?? null;
  if (phaseMechanics !== null && !isObject(phaseMechanics)) fail(`${context}: 'phase_mechanics' must be an object or null`);
  return {
    stage_id: stageId,
    chapter_id: text(row, "chapter_id", context),
    title_en: text(row, "title_en", context),
    node_type: text(row, "node_type", context),
    recommended_level: integer(row, "recommended_level", context),
    enemy_level: integer(row, "enemy_level", context),
    stamina_cost: integer(row, "stamina_cost", context),
    enemy_waves: waves,
    drop_table_id: text(row, "drop_table_id", context),
    boss_id: optionalText(row, "boss_id", context),
    boss_phases: stringTuple(row, "boss_phases", context),
    phase_mechanics: phaseMechanics === null ? null : deep(phaseMechanics as Row),
    guest_characters: stringTuple(row, "guest_characters", context),
    story_rewards: objectTuple(row, "story_rewards", context),
    story_beat_en: optionalText(row, "story_beat_en", context),
    enemy_stat_multiplier: has(row, "enemy_stat_multiplier") ? number(row, "enemy_stat_multiplier", context) : 1.0,
    extra: extra(row, STAGE_FIELDS),
  };
}

function weapon(row: Row): Weapon {
  const context = `weapons/${label(row.weapon_id)}`;
  return {
    weapon_id: text(row, "weapon_id", context),
    name_en: text(row, "name_en", context),
    rarity: integer(row, "rarity", context),
    weapon_type: text(row, "weapon_type", context),
    acquisition: deep(row.acquisition ?? null),
    level_cap: integer(row, "level_cap", context),
    base_stats_level_1: mapping(row, "base_stats_level_1", context),
    growth_per_level: mapping(row, "growth_per_level", context),
    dismantle_xp: integer(row, "dismantle_xp", context),
    dismantle_allowed: boolean(row, "dismantle_allowed", context),
    owner_character_id: optionalText(row, "owner_character_id", context),
    banner_id: optionalText(row, "banner_id", context),
    brand_mark_id: optionalText(row, "brand_mark_id", context),
    passive_name_en: optionalText(row, "passive_name_en", context),
    passive_effect_en: optionalText(row, "passive_effect_en", context),
    passive_effect_id: optionalText(row, "passive_effect_id", context),
    dismantle_output: objectTuple(row, "dismantle_output", context),
    balance_status: optionalText(row, "balance_status", context),
    extra: extra(row, WEAPON_FIELDS),
  };
}

function armor(row: Row): Armor {
  const context = `armors/${label(row.armor_id)}`;
  return {
    armor_id: text(row, "armor_id", context),
    name_en: text(row, "name_en", context),
    rarity: integer(row, "rarity", context),
    armor_type: text(row, "armor_type", context),
    slot: text(row, "slot", context),
    acquisition: deep(row.acquisition ?? null),
    level_cap: integer(row, "level_cap", context),
    base_stats_level_1: mapping(row, "base_stats_level_1", context),
    growth_per_level: mapping(row, "growth_per_level", context),
    dismantle_xp: integer(row, "dismantle_xp", context),
    dismantle_allowed: boolean(row, "dismantle_allowed", context),
    brand_mark_id: optionalText(row, "brand_mark_id", context),
    dismantle_output: objectTuple(row, "dismantle_output", context),
    tier_id: optionalText(row, "tier_id", context),
    extra: extra(row, ARMOR_FIELDS),
  };
}

function accessory(row: Row): AccessoryTemplate {
  const context = `accessories/${label(row.accessory_id)}`;
  return {
    accessory_id: text(row, "accessory_id", context),
    name_en: text(row, "name_en", context),
    rarity: integer(row, "rarity", context),
    slot: text(row, "slot", context),
    set_id: text(row, "set_id", context),
    set_name_en: text(row, "set_name_en", context),
    possible_main_stats: objectTuple(row, "possible_main_stats", context),
    possible_sub_stats: objectTuple(row, "possible_sub_stats", context),
    rarity_profiles: mapping(row, "rarity_profiles", context),
    acquisition: deep(row.acquisition ?? null),
    drop_is_gacha: boolean(row, "drop_is_gacha", context),
    brand_mark_id: optionalText(row, "brand_mark_id", context),
    flavor_en: optionalText(row, "flavor_en", context),
    extra: extra(row, ACCESSORY_FIELDS),
  };
}

function item(row: Row): Item {
  const context = `items/${label(row.item_id)}`;
  const xpValue = row.xp_value ?? null;
  if (xpValue !== null && !isNumeric(xpValue)) fail(`${context}: 'xp_value' must be numeric or null`);
  return {
    item_id: text(row, "item_id", context),
    name_en: text(row, "name_en", context),
    kind: text(row, "kind", context),
    rarity: optionalInteger(row, "rarity", context),
    stack_cap: optionalInteger(row, "stack_cap", context),
    xp_value: xpValue as number | null,
    description_en: text(row, "description_en", context),
    sources: stringTuple(row, "sources", context),
    consumable: boolean(row, "consumable", context),
    brand_mark_id: optionalText(row, "brand_mark_id", context),
    extra: extra(row, ITEM_FIELDS),
  };
}

function dropTable(row: Row): DropTable {
  const context = `drop_tables/${label(row.drop_table_id)}`;
  return {
    drop_table_id: text(row, "drop_table_id", context),
    repeatable_rewards: objectTuple(row, "repeatable_rewards", context),
    first_clear_rewards: objectTuple(row, "first_clear_rewards", context),
    extra: extra(row, DROP_TABLE_FIELDS),
  };
}

function status(row: Row): Status {
  const context = `statuses/${label(row.status_id)}`;
  return {
    status_id: text(row, "status_id", context),
    name_en: text(row, "name_en", context),
    kind: text(row, "kind", context),
    default_duration_turns: integer(row, "default_duration_turns", context),
    source_atk_multiplier_per_tick: optionalNumber(row, "source_atk_multiplier_per_tick", context),
    tags: stringTuple(row, "tags", context),
    stacking: text(row, "stacking", context),
    extra: extra(row, STATUS_FIELDS),
  };
}

// -- registry ----------------------------------------------------------------------------------------

/** The selected cross-pack checks of tools/validate_part1_content.py that the loader repeats. */
function checkCrossReferences(
  characterRows: Row[],
  stageRows: Row[],
  enemyRows: Row[],
  weaponIndex: Map<string, Row>,
  dropTableIndex: Map<string, Row>,
  enemyIndex: Map<string, Row>,
  schemas: Schemas,
): void {
  for (const hero of characterRows) {
    const characterId = hero.character_id as string;
    const signature = hero.signature_weapon_id;
    if (typeof signature !== "string" || !weaponIndex.has(signature)) {
      fail(`characters/${characterId}: unknown signature weapon ${pyRepr(signature ?? null)}`);
    }
    for (const skillRow of rows({ skills: hero.skills ?? null }, "skills", `characters/${characterId}`)) {
      const skillContext = `characters/${characterId}/skills/${label(skillRow.skill_id)}`;
      const ops = get(skillRow, "effect_ops", []);
      validateEffectOps(ops, schemas, skillContext);
      const hasOps = (ops as Json[]).length > 0;
      if (!hasOps && skillRow.type !== "passive") fail(`${skillContext}: non-passive skill has no executable effect_ops`);
      if (skillRow.type === "passive" && !(truthy(skillRow.event_hooks) || truthy(skillRow.continuous_modifiers) || hasOps)) {
        fail(`${skillContext}: passive has no effect_ops, event_hooks or modifiers`);
      }
    }
  }
  for (const stageRow of stageRows) {
    const stageId = stageRow.stage_id as string;
    const dropTableId = stageRow.drop_table_id;
    if (typeof dropTableId !== "string" || !dropTableIndex.has(dropTableId)) {
      fail(`stages/${stageId}: unknown drop_table_id ${pyRepr(dropTableId ?? null)}`);
    }
    const waves = stageRow.enemy_waves;
    if (!Array.isArray(waves)) fail(`stages/${stageId}: enemy_waves must be an array`);
    (waves as Json[]).forEach((wave, waveIndex) => {
      if (!Array.isArray(wave)) fail(`stages/${stageId}: enemy_waves[${waveIndex}] must be an array`);
      (wave as Json[]).forEach((entry, entryIndex) => {
        const context = `stages/${stageId}/enemy_waves[${waveIndex}][${entryIndex}]`;
        if (!isObject(entry)) fail(`${context}: enemy entry must be an object`);
        const enemyId = (entry as Row).enemy_id;
        if (typeof enemyId !== "string" || !enemyIndex.has(enemyId)) fail(`${context}: unknown enemy_id ${pyRepr(enemyId ?? null)}`);
      });
    });
  }
  // Boss operations and enemy actions use the same closed operation contract.
  for (const enemyRow of enemyRows) {
    const enemyId = enemyRow.enemy_id as string;
    for (const skillRow of rows({ skills: get(enemyRow, "skills", []) ?? null }, "skills", `enemies/${enemyId}`)) {
      validateEffectOps(get(skillRow, "effect_ops", []), schemas, `enemies/${enemyId}/${String(get(skillRow, "skill_id", "skill"))}`);
    }
    for (const phase of rows({ phases: get(enemyRow, "phases", []) ?? null }, "phases", `enemies/${enemyId}`)) {
      const phaseContext = `enemies/${enemyId}/phases/${label(phase.phase_id)}`;
      for (const field of ["enter_ops", "passive_ops"]) validateEffectOps(get(phase, field, []), schemas, `${phaseContext}.${field}`);
      for (const objective of rows({ objectives: get(phase, "objectives", []) ?? null }, "objectives", phaseContext)) {
        validateEffectOps(get(objective, "on_destroyed", []), schemas, `${phaseContext}/objectives/${label(objective.objective_id)}.on_destroyed`);
      }
    }
  }
}

/** Builds the registry from parsed packs ({file name: root}); throws ContentLoadError on the first failed check. */
export function loadPacks(packs: Partial<Record<PackName, unknown>>): ContentRegistry {
  for (const fileName of PACK_FILES) if (!isObject(packs[fileName])) fail(`${fileName}: JSON root must be an object`);
  const pack = (name: PackName): Row => packs[name] as Row;

  const characterRows = rows(pack("characters_part1.json"), "characters", "characters_part1.json");
  const enemyRows = rows(pack("enemies_part1.json"), "enemies", "enemies_part1.json");
  const weaponRows = rows(pack("weapons_part1.json"), "weapons", "weapons_part1.json");
  const armorRows = rows(pack("armors_part1.json"), "armors", "armors_part1.json");
  const accessoryRows = rows(pack("accessories_part1.json"), "accessories", "accessories_part1.json");
  const itemRows = rows(pack("items_part1.json"), "items", "items_part1.json");
  const stageRows = rows(pack("stages_part1.json"), "stages", "stages_part1.json");
  const statusRows = rows(pack("battle_rules_part1.json"), "statuses", "battle_rules_part1.json");
  const dropTableRows = rows(pack("drop_tables_part1.json"), "drop_tables", "drop_tables_part1.json");

  const characterIndex = indexRows(characterRows, "character_id", "characters");
  const enemyIndex = indexRows(enemyRows, "enemy_id", "enemies");
  const weaponIndex = indexRows(weaponRows, "weapon_id", "weapons");
  indexRows(armorRows, "armor_id", "armors");
  indexRows(accessoryRows, "accessory_id", "accessories");
  indexRows(itemRows, "item_id", "items");
  const stageIndex = indexRows(stageRows, "stage_id", "stages");
  const statusIndex = indexRows(statusRows, "status_id", "statuses");
  const dropTableIndex = indexRows(dropTableRows, "drop_table_id", "drop_tables");

  const schemas = validateOperationSchemas(pack("battle_effects_part1.json"));
  checkCrossReferences(characterRows, stageRows, enemyRows, weaponIndex, dropTableIndex, enemyIndex, schemas);

  const mapOf = <T>(index: Map<string, Row>, build: (row: Row) => T): Map<string, T> =>
    new Map([...index].map(([id, row]) => [id, build(row)]));
  const registry: ContentRegistry = {
    characters: mapOf(characterIndex, (row) => character(row, schemas)),
    skills: new Map(),
    enemies: mapOf(enemyIndex, (row) => enemy(row, schemas)),
    boss_phases: new Map(),
    boss_objectives: new Map(),
    stages: new Map(),
    weapons: mapOf(weaponIndex, weapon),
    armors: new Map(armorRows.map((row) => [row.armor_id as string, armor(row)])),
    accessories: new Map(accessoryRows.map((row) => [row.accessory_id as string, accessory(row)])),
    items: new Map(itemRows.map((row) => [row.item_id as string, item(row)])),
    drop_tables: new Map(),
    statuses: new Map(),
    weapon_types: {},
    weapon_banners: {},
    accessory_sets: {},
    currency_references: {},
    battle_rules: {},
    effect_operation_schemas: {},
    effect_contract: {},
    drop_pack: {},
    accessory_slots: null,
    armor_slot_count: null,
  };
  registry.stages = mapOf(stageIndex, stage);
  registry.drop_tables = mapOf(dropTableIndex, dropTable);
  registry.statuses = mapOf(statusIndex, status);

  for (const owner of [...registry.characters.values(), ...registry.enemies.values()]) {
    for (const ownSkill of owner.skills) {
      if (registry.skills.has(ownSkill.skill_id)) fail(`skills: duplicate skill_id ${pyRepr(ownSkill.skill_id)}`);
      registry.skills.set(ownSkill.skill_id, ownSkill);
    }
  }
  for (const foe of registry.enemies.values()) {
    for (const phase of foe.phases) {
      if (registry.boss_phases.has(phase.phase_id)) fail(`boss_phases: duplicate phase_id ${pyRepr(phase.phase_id)}`);
      registry.boss_phases.set(phase.phase_id, phase);
      for (const objective of phase.objectives) {
        if (registry.boss_objectives.has(objective.objective_id)) fail(`boss_objectives: duplicate objective_id ${pyRepr(objective.objective_id)}`);
        registry.boss_objectives.set(objective.objective_id, objective);
      }
    }
  }

  const weaponsPack = pack("weapons_part1.json");
  const accessoryPack = pack("accessories_part1.json");
  registry.battle_rules = deep(pack("battle_rules_part1.json"));
  registry.weapon_types = catalogRows(weaponsPack, "weapon_types", "weapon_type", "weapons_part1.json");
  registry.weapon_banners = catalogRows(weaponsPack, "weapon_banners", "banner_id", "weapons_part1.json");
  registry.accessory_sets = catalogRows(accessoryPack, "sets", "set_id", "accessories_part1.json");
  registry.currency_references = catalogRows(pack("items_part1.json"), "currency_references", "item_id", "items_part1.json");
  registry.effect_operation_schemas = deep(schemas);
  registry.effect_contract = deep((get(pack("battle_effects_part1.json"), "contract", {}) as Row) ?? {});
  registry.drop_pack = deep(pack("drop_tables_part1.json"));
  registry.accessory_slots = deep(accessoryPack.accessory_slots ?? null);
  registry.armor_slot_count = deep(pack("armors_part1.json").armor_slot_count ?? null);
  return registry;
}
