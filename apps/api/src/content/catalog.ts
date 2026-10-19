import { CATALOG_LIMITS, CATALOG_PATH, EconomyCatalog, MAX_CATALOG_BYTES } from '@uomd/content-schema';
import { canonicalJson, sha256Hex } from '@uomd/shared';
import { HttpError } from './store';
import { CHARACTER_STAT_COLUMNS, withAttributes, type CharacterStatRow } from './runtime-catalog';

export interface CatalogSnapshot {
  path: typeof CATALOG_PATH;
  sha256: string;
  bytes: number;
  json: string;
  counts: Record<keyof typeof CATALOG_LIMITS, number>;
}

/** One read batch gives every exported table the same D1 transaction snapshot. */
export async function exportCatalog(db: D1Database): Promise<CatalogSnapshot> {
  const queries = [
    `SELECT id, name_en, rarity, element, role, age, acquisition, ${CHARACTER_STAT_COLUMNS}, formation_affinity, weapon_type, signature_weapon_id, status FROM characters ORDER BY id LIMIT ${CATALOG_LIMITS.characters + 1}`,
    `SELECT skill_id, character_id, type, name_en FROM character_skills ORDER BY skill_id LIMIT ${CATALOG_LIMITS.skills + 1}`,
    `SELECT item_id, name_en, kind, rarity, stack_cap, xp_value, consumable, data_json, status FROM item_defs ORDER BY item_id LIMIT ${CATALOG_LIMITS.items + 1}`,
    `SELECT gear_id, slot, name_en, rarity, family, tier, set_id, owner_character_id, banner_id, level_cap, base_json, growth_json, extra_json, dismantle_xp, dismantle_json, dismantle_allowed, status FROM gear_defs ORDER BY gear_id LIMIT ${CATALOG_LIMITS.gear + 1}`,
    `SELECT set_id, name_en, pieces_for_bonus, bonus_json FROM accessory_sets ORDER BY set_id LIMIT ${CATALOG_LIMITS.sets + 1}`,
    `SELECT weapon_type, name_en FROM weapon_types ORDER BY weapon_type LIMIT ${CATALOG_LIMITS.weapon_types + 1}`,
    `SELECT id, title_en, config_json, starts_at, ends_at, status FROM banners ORDER BY id LIMIT ${CATALOG_LIMITS.banners + 1}`,
    'SELECT key, value_json FROM game_config ORDER BY key LIMIT 5'
  ];
  const rows = await db.batch<Record<string, unknown>>(queries.map((q) => db.prepare(q)));
  const [characters, skills, items, gear, sets, weapon_types, banners, config] = rows.map((r) => r.results);
  const raw = {
    schema_version: 1,
    characters: characters!.map((r) => {
      return withAttributes(r as CharacterStatRow & Record<string, unknown>);
    }),
    skills,
    items: items!.map((r) => { const { data_json, consumable, ...rest } = r; return { ...rest, data: parse(data_json), consumable: consumable === 1 }; }),
    gear: gear!.map((r) => {
      const { base_json, growth_json, extra_json, dismantle_json, dismantle_allowed, banner_id, ...rest } = r;
      return { ...rest, source_banner_id: banner_id, base: parse(base_json), growth: parse(growth_json), extra: parse(extra_json), dismantle: parse(dismantle_json), dismantle_allowed: dismantle_allowed === 1 };
    }),
    sets: sets!.map((r) => { const { bonus_json, ...rest } = r; return { ...rest, bonus: parse(bonus_json) }; }),
    weapon_types,
    banners: banners!.map((r) => { const { config_json, ...rest } = r; return { ...rest, config: parse(config_json) }; }),
    config: Object.fromEntries(config!.map((r) => [r.key, parse(r.value_json)]))
  };
  // Canonical JSON sorts record keys. Preserve the live first-match rule as explicit snapshot metadata.
  const gearConfig = raw.config.gear;
  if (gearConfig && typeof gearConfig === 'object' && !Array.isArray(gearConfig) && 'roleStat' in gearConfig) {
    if ('roleStatOrder' in gearConfig) throw new HttpError(503, 'catalog_invalid', 'role stat order is snapshot metadata, not a live authoring field');
    const roles = gearConfig.roleStat;
    if (roles && typeof roles === 'object' && !Array.isArray(roles)) Object.assign(gearConfig, { roleStatOrder: Object.keys(roles).filter((key) => key !== 'default') });
  }
  const parsed = EconomyCatalog.safeParse(raw);
  if (!parsed.success) throw new HttpError(503, 'catalog_invalid', 'catalog needs operator review', parsed.error.issues.slice(0, 8).map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  const json = canonicalJson(parsed.data);
  const bytes = new TextEncoder().encode(json).byteLength;
  if (bytes > MAX_CATALOG_BYTES) throw new HttpError(503, 'catalog_too_large', 'catalog exceeds the 1 MiB staging budget');
  const counts = Object.fromEntries(Object.keys(CATALOG_LIMITS).map((key) => [key, parsed.data[key as keyof typeof CATALOG_LIMITS].length])) as CatalogSnapshot['counts'];
  return { path: CATALOG_PATH, sha256: await sha256Hex(json), bytes, json, counts };
}

function parse(value: unknown): unknown {
  try { return JSON.parse(String(value)) as unknown; }
  catch { throw new HttpError(503, 'catalog_invalid', 'catalog contains malformed JSON; operator review required'); }
}
