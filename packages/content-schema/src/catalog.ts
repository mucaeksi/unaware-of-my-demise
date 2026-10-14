import { z } from 'zod';
import { BannerConfig, DropConfig, ProgressionConfig } from '@uomd/economy';
import { Element, Id } from './primitives';
import { TaskConfig } from './tasks';
import type { RewardAttachment } from './rewards';
import type { ChapterIndex } from './story';
import type { UnitPack } from './units';

export const CATALOG_PATH = 'catalog/economy.json';
export const MAX_CATALOG_BYTES = 1024 * 1024;
export const CATALOG_LIMITS = { characters: 512, skills: 4096, items: 1024, gear: 4096, sets: 256, weapon_types: 128, banners: 256 } as const;
const Name = z.string().min(1).max(160);
const Count = z.number().int().safe().nonnegative();
const Status = z.enum(['active', 'hidden', 'retired']);
const Slot = z.enum(['weapon', 'armor', 'necklace', 'ring']);
export const GearStatId = z.enum(['hp_flat', 'atk_flat', 'def_flat', 'spd_flat', 'hp_pct', 'atk_pct', 'def_pct', 'spd_pct', 'effect_res_pct', 'element_res_pct', 'focus_gain_pct', 'heal_bonus_pct']);
export const GearConfig = z.object({
  note: z.string().max(400).default(''), roleStat: z.record(Id, GearStatId), roleStatOrder: z.array(Id).max(512).optional(), equipSlots: z.array(Slot).min(1).max(4),
  rerollCost: z.object({ itemId: Id, quantityByRarity: z.partialRecord(z.enum(['1', '2', '3', '4', '5']), Count.min(1)) }).strict()
}).strict().superRefine((c, ctx) => {
  if (!c.roleStat.default) ctx.addIssue({ code: 'custom', message: 'role stat needs a default' });
  if (c.roleStatOrder) {
    const keys = Object.keys(c.roleStat).filter((key) => key !== 'default');
    if (new Set(c.roleStatOrder).size !== keys.length || c.roleStatOrder.length !== keys.length || c.roleStatOrder.some((key) => !keys.includes(key))) ctx.addIssue({ code: 'custom', message: 'role stat order must list every non-default role exactly once' });
  }
  if (new Set(c.equipSlots).size !== c.equipSlots.length) ctx.addIssue({ code: 'custom', message: 'duplicate equipment slot' });
});
const Base = z.object({ hp: z.number().positive(), atk: z.number().nonnegative(), def: z.number().nonnegative(), spd: z.number().positive() }).strict();
const Growth = z.object({ hp: z.number().nonnegative(), atk: z.number().nonnegative(), def: z.number().nonnegative(), spd: z.number().nonnegative() }).strict();
const Character = z.object({ id: Id, name_en: Name, rarity: z.number().int().min(1).max(5), element: Element, role: Id, age: Count,
  acquisition: z.enum(['free_start', 'free_story_recruit', 'free_story_recruit_and_banner', 'gacha', 'limited_banner', 'standard_banner_pool']),
  base: Base, growth: Growth, formation_affinity: z.enum(['front', 'rear']).nullable(), weapon_type: Id, signature_weapon_id: Id, status: Status }).strict();
const Skill = z.object({ skill_id: Id, character_id: Id, type: z.enum(['basic', 'active', 'passive', 'ultimate']), name_en: Name }).strict();
const Item = z.object({ item_id: Id, name_en: Name,
  kind: z.enum(['accessory_reroll_token', 'ascension', 'boss_shop', 'character_xp', 'crafting', 'duplicate_progression', 'equipment_xp', 'event_exchange', 'recruit_selector', 'skill_rank', 'weapon_xp_virtual_resource']),
  rarity: z.number().int().min(1).max(5).nullable(), stack_cap: Count.min(1), xp_value: Count.nullable(), consumable: z.boolean(),
  data: z.object({ description_en: z.string().max(2000), sources: z.array(z.string().min(1).max(120)).max(32) }).strict(), status: Status }).strict();
const PoolStat = z.object({ stat_id: GearStatId, weight: z.number().positive(), unit: z.enum(['percent', 'flat']), min_value: z.number().nonnegative(), max_value: z.number().nonnegative() }).strict()
  .superRefine((s, ctx) => {
    if (s.min_value > s.max_value) ctx.addIssue({ code: 'custom', message: 'stat range is inverted' });
    if (s.unit !== (s.stat_id.endsWith('_pct') ? 'percent' : 'flat')) ctx.addIssue({ code: 'custom', message: 'stat unit differs from its identity' });
  });
const Accessory = z.object({ main: z.array(PoolStat).min(1).max(12), sub: z.array(PoolStat).min(1).max(12),
  profile: z.object({ substat_count: Count.min(1).max(12), is_rerollable: z.boolean(), reroll_cost: z.object({ item_id: Id, quantity: Count.min(1) }).strict().nullable(), minimum_substat_value_rolls: Count.min(1), maximum_substat_value_rolls: Count.min(1) }).strict() }).strict()
  .superRefine((a, ctx) => {
    for (const pool of [a.main, a.sub]) if (new Set(pool.map((s) => s.stat_id)).size !== pool.length) ctx.addIssue({ code: 'custom', message: 'duplicate accessory stat' });
    if (a.main.some((main) => a.sub.filter((sub) => sub.stat_id !== main.stat_id).length < a.profile.substat_count)) ctx.addIssue({ code: 'custom', message: 'insufficient distinct substats for a possible main stat' });
    if (a.profile.minimum_substat_value_rolls > a.profile.maximum_substat_value_rolls) ctx.addIssue({ code: 'custom', message: 'accessory roll bounds are inverted' });
  });
const commonGear = { gear_id: Id, name_en: Name, rarity: z.number().int().min(1).max(5), family: Id, tier: Id.nullable(), set_id: Id.nullable(), owner_character_id: Id.nullable(),
  /** Preserved canon acquisition tag, not the executable banner's ID; actual membership is in banner pools. */
  source_banner_id: Id.nullable(), level_cap: Count.min(1).max(20), dismantle_xp: Count,
  dismantle: z.array(z.object({ item_id: Id, quantity: Count.min(1).max(9999) }).strict()).max(8), dismantle_allowed: z.boolean(), status: Status };
const passive = z.object({ passive_name_en: Name.optional(), passive_effect_en: z.string().max(2000).optional(), passive_effect_id: Id.optional() }).strict();
const Gear = z.discriminatedUnion('slot', [
  z.object({ ...commonGear, slot: z.literal('weapon'), base: z.object({ atk: z.number().nonnegative(), secondary_stat: z.union([z.literal('role_stat'), GearStatId]), secondary_value: z.number().nonnegative() }).strict(), growth: z.object({ atk: z.number().nonnegative() }).strict(), extra: passive }).strict(),
  z.object({ ...commonGear, slot: z.literal('armor'), base: z.object({ hp: z.number().nonnegative(), def: z.number().nonnegative() }).strict(), growth: z.object({ hp: z.number().nonnegative(), def: z.number().nonnegative() }).strict(), extra: z.object({}).strict() }).strict(),
  ...(['necklace', 'ring'] as const).map((slot) => z.object({ ...commonGear, slot: z.literal(slot), level_cap: z.literal(1), base: z.object({}).strict(), growth: z.object({}).strict(), extra: Accessory }).strict())
]);
const SetDef = z.object({ set_id: Id, name_en: Name, pieces_for_bonus: Count.min(1).max(2), bonus: z.object({ stat: GearStatId, pct: z.number().nonnegative(), text: z.string().max(2000) }).strict() }).strict();
const Banner = z.object({ id: Id, title_en: Name, config: BannerConfig, starts_at: z.iso.datetime().nullable(), ends_at: z.iso.datetime().nullable(), status: z.enum(['draft', 'active', 'retired']) }).strict()
  .superRefine((b, ctx) => {
    if (b.id !== b.config.id) ctx.addIssue({ code: 'custom', message: 'banner row/config identity differs' });
    if (b.starts_at && b.ends_at && Date.parse(b.starts_at) >= Date.parse(b.ends_at)) ctx.addIssue({ code: 'custom', message: 'banner schedule is inverted' });
  });

export const EconomyCatalog = z.object({ schema_version: z.literal(1),
  characters: z.array(Character).min(1).max(CATALOG_LIMITS.characters), skills: z.array(Skill).min(1).max(CATALOG_LIMITS.skills),
  items: z.array(Item).min(1).max(CATALOG_LIMITS.items), gear: z.array(Gear).min(1).max(CATALOG_LIMITS.gear), sets: z.array(SetDef).min(1).max(CATALOG_LIMITS.sets),
  weapon_types: z.array(z.object({ weapon_type: Id, name_en: Name }).strict()).min(1).max(CATALOG_LIMITS.weapon_types), banners: z.array(Banner).min(1).max(CATALOG_LIMITS.banners),
  config: z.object({ progression: ProgressionConfig, drops: DropConfig, tasks: TaskConfig, gear: GearConfig }).strict()
}).strict().superRefine((c, ctx) => {
  const bad = (message: string): void => ctx.addIssue({ code: 'custom', message });
  const unique = (what: string, ids: string[]): void => { if (new Set(ids).size !== ids.length) bad(`duplicate catalog ${what}`); };
  for (const [what, ids] of [['character', c.characters.map((r) => r.id)], ['skill', c.skills.map((r) => r.skill_id)], ['item', c.items.map((r) => r.item_id)], ['gear', c.gear.map((r) => r.gear_id)], ['set', c.sets.map((r) => r.set_id)], ['weapon type', c.weapon_types.map((r) => r.weapon_type)], ['banner', c.banners.map((r) => r.id)]] as [string, string[]][]) unique(what, ids);
  const chars = new Map(c.characters.map((r) => [r.id, r])); const gear = new Map(c.gear.map((r) => [r.gear_id, r])); const items = new Map(c.items.map((r) => [r.item_id, r]));
  const item = (id: string): void => { if (!items.has(id) || items.get(id)!.status === 'retired') bad(`unknown or retired catalog item ${id}`); };
  const equipment = (id: string): void => { if (!gear.has(id) || gear.get(id)!.status === 'retired') bad(`unknown or retired catalog gear ${id}`); };
  const reward = (r: RewardAttachment): void => { if (r.type === 'item') item(r.itemId); else if (r.type === 'gear') equipment(r.gearId); else if (r.type === 'character' && (!chars.has(r.itemId) || chars.get(r.itemId)!.status === 'retired')) bad(`unknown or retired catalog character ${r.itemId}`); };
  for (const ch of c.characters) {
    const roleStats = Object.keys(c.config.gear.roleStat).filter((key) => key !== 'default' && ch.role.includes(key)).map((key) => c.config.gear.roleStat[key]);
    if (!c.config.gear.roleStatOrder && new Set(roleStats).size > 1) bad(`character ${ch.id}: ambiguous role stats need explicit priority`);
    if (!c.weapon_types.some((w) => w.weapon_type === ch.weapon_type)) bad(`character ${ch.id}: unknown weapon type`);
    const sig = gear.get(ch.signature_weapon_id);
    if (!sig || sig.slot !== 'weapon' || sig.owner_character_id !== ch.id || sig.family !== ch.weapon_type) bad(`character ${ch.id}: invalid signature weapon`);
    const skills = c.skills.filter((s) => s.character_id === ch.id);
    for (const type of ['basic', 'active', 'passive', 'ultimate']) if (skills.filter((s) => s.type === type).length !== 1) bad(`character ${ch.id}: needs one ${type} skill`);
  }
  for (const s of c.skills) if (!chars.has(s.character_id)) bad(`skill ${s.skill_id}: unknown character`);
  for (const g of c.gear) {
    for (const output of g.dismantle) item(output.item_id);
    if (g.slot === 'weapon') {
      if (!c.weapon_types.some((w) => w.weapon_type === g.family)) bad(`gear ${g.gear_id}: unknown weapon family`);
      if (g.owner_character_id && (!chars.has(g.owner_character_id) || chars.get(g.owner_character_id)!.weapon_type !== g.family)) bad(`gear ${g.gear_id}: invalid owner/family`);
      if (g.source_banner_id && !c.banners.some((b) => b.config.kind === 'weapon' && [...b.config.pools.fiveFeatured, ...b.config.pools.fiveOther].includes(g.gear_id))) bad(`gear ${g.gear_id}: acquisition tag has no declared banner membership`);
    } else if (g.owner_character_id || g.source_banner_id) bad(`gear ${g.gear_id}: owner/banner only supported on weapons`);
    if (g.slot === 'ring' || g.slot === 'necklace') {
      if (!g.set_id || !c.sets.some((s) => s.set_id === g.set_id)) bad(`gear ${g.gear_id}: unknown accessory set`);
      const profile = g.extra.profile;
      if (profile.is_rerollable !== (profile.reroll_cost !== null)) bad(`gear ${g.gear_id}: inconsistent reroll capability`);
      if (profile.reroll_cost) {
        item(profile.reroll_cost.item_id);
        if (profile.reroll_cost.item_id !== c.config.gear.rerollCost.itemId || profile.reroll_cost.quantity !== c.config.gear.rerollCost.quantityByRarity[String(g.rarity) as '1' | '2' | '3' | '4' | '5']) bad(`gear ${g.gear_id}: reroll costs differ from catalog rules`);
      }
    } else if (g.set_id) bad(`gear ${g.gear_id}: set only supported on accessories`);
  }
  for (const b of c.banners) for (const [pool, rarity] of [['fiveFeatured', 5], ['fiveOther', 5], ['four', 4], ['three', 3]] as const) for (const id of b.config.pools[pool]) {
    const target = b.config.kind === 'character' ? chars.get(id) : gear.get(id);
    if (!target || target.status === 'retired' && b.status !== 'retired' || target.rarity !== rarity || b.config.kind === 'weapon' && 'slot' in target && target.slot !== 'weapon') bad(`banner ${b.id}: invalid ${rarity}-star ${b.config.kind} ${id}`);
  }
  const p = c.config.progression;
  for (const id of [p.equipment.xpItemId, p.equipment.milestoneItemId, ...Object.values(p.character.skills.itemBySkillType), ...p.character.ascension.flatMap((s) => s.items.map((i) => i.itemId)), c.config.gear.rerollCost.itemId]) item(id);
  for (const table of Object.values(c.config.drops.tables)) for (const e of [...table.repeat, ...table.firstClear]) {
    if (e.kind === 'item') item(e.itemId); else if (e.kind === 'item_pool') { unique('drop pool item', e.itemIds); e.itemIds.forEach(item); }
    else if (e.kind === 'gear') equipment(e.gearId);
    else if (e.kind === 'gear_pool') for (const rarity of e.rarities) {
      if (!c.gear.some((g) => g.status === 'active' && g.rarity === rarity && (e.slot === 'accessory' ? g.slot === 'ring' || g.slot === 'necklace' : g.slot === e.slot) && (e.slot !== 'weapon' || !g.owner_character_id && !g.source_banner_id))) bad(`empty ${e.slot} rarity ${rarity} drop pool`);
    }
  }
  const tasks = c.config.tasks;
  for (const r of [...tasks.daily.tasks.flatMap((t) => t.rewards), ...tasks.daily.completion.rewards, ...tasks.weekly.segments.flatMap((t) => t.rewards)]) reward(r);
});
export type EconomyCatalog = z.infer<typeof EconomyCatalog>;

/** Additional references into the exact pack and chapter graph carried by this release. */
export function catalogContentProblems(c: EconomyCatalog, pack: UnitPack, index: ChapterIndex): string[] {
  const problems: string[] = []; const bad = (s: string): void => { problems.push(s); };
  const characters = new Map(c.characters.map((ch) => [ch.id, ch])); const items = new Map(c.items.map((i) => [i.item_id, i])); const gear = new Map(c.gear.map((g) => [g.gear_id, g]));
  const units = new Map(pack.units.map((u) => [u.unit_id, u])); const nodes = new Map(index.chapters.flatMap((ch) => ch.nodes.map((n) => [n.node_id, n] as const)));
  for (const ch of c.characters.filter((ch) => ch.status !== 'retired')) {
    const u = units.get(ch.id);
    if (!u || u.kind !== 'character') { bad(`catalog character ${ch.id}: missing from release unit pack`); continue; }
    if (u.name_en !== ch.name_en || u.rarity !== ch.rarity || u.element !== ch.element || u.role !== ch.role || (u.formation_affinity ?? null) !== ch.formation_affinity || (['hp', 'atk', 'def', 'spd'] as const).some((key) => u.base_stats[key] !== ch.base[key] || (u.growth_per_level?.[key] ?? 0) !== ch.growth[key])) bad(`catalog character ${ch.id}: stats/metadata differ from release unit pack`);
    const skills = c.skills.filter((s) => s.character_id === ch.id);
    if (skills.length !== u.skills.length || skills.some((s) => !u.skills.some((sk) => sk.skill_id === s.skill_id && sk.type === s.type && sk.name_en === s.name_en))) bad(`catalog character ${ch.id}: skill identities differ from release unit pack`);
  }
  for (const u of pack.units.filter((u) => u.kind === 'character')) if (!characters.has(u.unit_id) || characters.get(u.unit_id)!.status === 'retired') bad(`unit ${u.unit_id}: missing or retired catalog character`);
  const reward = (r: RewardAttachment): void => {
    if (r.type === 'character' && (!characters.has(r.itemId) || characters.get(r.itemId)!.status === 'retired')) bad(`reward: unknown or retired catalog character ${r.itemId}`);
    if (r.type === 'item' && (!items.has(r.itemId) || items.get(r.itemId)!.status === 'retired')) bad(`reward: unknown or retired catalog item ${r.itemId}`);
    if (r.type === 'gear' && (!gear.has(r.gearId) || gear.get(r.gearId)!.status === 'retired')) bad(`reward: unknown or retired catalog gear ${r.gearId}`);
  };
  for (const node of nodes.values()) {
    if (node.rewards) [...node.rewards.first_clear, ...node.rewards.three_star, ...node.rewards.repeat].forEach(reward);
    if (node.drop) {
      const table = Object.hasOwn(c.config.drops.tables, node.drop.table) ? c.config.drops.tables[node.drop.table] : undefined;
      if (!table) { bad(`node ${node.node_id}: unknown catalog drop table ${node.drop.table}`); continue; }
      if (node.drop.boss_set_id && !c.sets.some((s) => s.set_id === node.drop!.boss_set_id)) bad(`node ${node.node_id}: unknown catalog boss set`);
      for (const entry of [...table.repeat, ...table.firstClear]) if (entry.kind === 'boss_set' && !c.gear.some((g) => g.status === 'active' && g.set_id === node.drop!.boss_set_id && (g.slot === 'necklace' || g.slot === 'ring') && g.rarity === entry.rarity)) bad(`node ${node.node_id}: empty boss-set rarity ${entry.rarity} pool`);
    }
  }
  for (const selector of index.recruit_selectors ?? []) {
    const i = items.get(selector.item_id);
    if (!i || i.status === 'retired' || i.kind !== 'recruit_selector' || !i.consumable) bad(`selector ${selector.item_id}: invalid catalog item`);
  }
  for (const step of c.config.progression.character.ascension) if (step.requiresNode && nodes.get(step.requiresNode)?.kind !== 'battle') bad(`progression: unknown battle gate ${step.requiresNode}`);
  const loan = pack.rules.story_loan_equipment;
  if (loan) {
    const armor = gear.get(loan.armor_id);
    if (!armor || armor.slot !== 'armor' || armor.rarity !== loan.rarity || armor.status === 'retired') bad('loan template: invalid catalog armor');
    for (const slot of loan.accessory_slots) if (!c.gear.some((g) => g.slot === slot && g.set_id === loan.accessory_set_id && g.rarity === loan.rarity && g.status !== 'retired')) bad(`loan template: missing catalog ${slot}`);
    for (const ch of c.characters.filter((ch) => ch.status !== 'retired')) if (!c.gear.some((g) => g.slot === 'weapon' && g.family === ch.weapon_type && g.rarity === loan.rarity && !g.owner_character_id && g.status !== 'retired')) bad(`loan template: missing catalog weapon family ${ch.weapon_type}`);
  }
  return problems;
}
