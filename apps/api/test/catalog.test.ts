import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { ProgressionConfig } from '@uomd/economy';
import { admin, game } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
const j = (method: string, body: unknown, as?: string) => ({ method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, ...(as ? { as } : {}) });

/** the seed is the canon import: running it against the migrated schema proves both agree */
export async function loadCatalogSeed(): Promise<void> {
  const sql = Object.values(import.meta.glob('../seed/catalog.sql', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>)[0] as string;
  const stmts = sql.split(/;\n(?=(?:INSERT|UPDATE) )/).map((x) => x.replace(/^--.*\n/, '').trim().replace(/;$/, '')).filter(Boolean);
  for (let i = 0; i < stmts.length; i += 50) await db().batch(stmts.slice(i, i + 50).map((s) => db().prepare(s)));
}

beforeAll(async () => {
  const ids: [string, number][] = [['mahmut', 5], ['fadyme', 5], ['kera_voss', 4], ['brin_alder', 4], ['nixie_vale', 4], ['sister_aveline', 5], ['sable_wren', 5], ['tilda_fen', 4], ['rikka_ember', 4], ['mirel_quill', 5], ['odelia_pike', 4], ['pippa_bell', 4], ['nara_vell', 5], ['clem_marr', 3], ['vespera_wisp', 5], ['hana_birch', 3], ['thistle_roe', 4], ['iona_mist', 4], ['jori_flint', 3], ['marek_vane', 4]];
  for (const [id, r] of ids) await db().prepare("INSERT OR IGNORE INTO characters (id, name_en, rarity, element, role, age, acquisition, base_hp, base_atk, base_def, base_spd) VALUES (?1,?1,?2,'Stone','tank',20,'gacha',10,2,2,4)").bind(id, r).run();
  await loadCatalogSeed();
  await db().prepare("INSERT OR IGNORE INTO admin_users (email, role, created_by) VALUES ('viewer@example.com','viewer','test'), ('operator@example.com','operator','test')").run();
});

describe('canon catalog seed', () => {
  it('imports every canon definition (18 items, 20 signature + 160 common weapons, 36 armor, 42 accessories in 7 sets) and is re-runnable', async () => {
    const count = async (sql: string): Promise<number> => ((await db().prepare(sql).first<{ n: number }>()) as { n: number }).n;
    expect(await count('SELECT COUNT(*) AS n FROM item_defs')).toBe(18);
    expect(await count("SELECT COUNT(*) AS n FROM gear_defs WHERE slot = 'weapon'")).toBe(180);
    expect(await count("SELECT COUNT(*) AS n FROM gear_defs WHERE slot = 'weapon' AND rarity = 5 AND owner_character_id IS NOT NULL")).toBe(20);
    expect(await count("SELECT COUNT(*) AS n FROM gear_defs WHERE slot = 'armor'")).toBe(36);
    expect(await count("SELECT COUNT(*) AS n FROM gear_defs WHERE slot IN ('necklace','ring')")).toBe(42);
    expect(await count('SELECT COUNT(*) AS n FROM accessory_sets')).toBe(7);
    expect(await count('SELECT COUNT(*) AS n FROM weapon_types')).toBe(20);
    expect(await count('SELECT COUNT(*) AS n FROM character_skills')).toBe(80);
    await loadCatalogSeed();
    expect(await count("SELECT COUNT(*) AS n FROM gear_defs WHERE slot = 'weapon'")).toBe(180);
    const m = await db().prepare("SELECT growth_hp, growth_atk, weapon_type, signature_weapon_id FROM characters WHERE id = 'mahmut'").first();
    expect(m).toMatchObject({ growth_hp: 0.7, growth_atk: 0.12, weapon_type: 'arming_sword', signature_weapon_id: 'weapon_mahmut_signature' });
  });

  it('the seeded progression rules are valid and carry the canon curve and ascension steps', async () => {
    const row = await db().prepare("SELECT value_json FROM game_config WHERE key = 'progression'").first<{ value_json: string }>();
    const c = ProgressionConfig.parse(JSON.parse(row!.value_json));
    expect(c.character.ascension.map((a) => a.cap)).toEqual([5, 10, 15, 20]);
    expect(c.character.ascension[1]).toMatchObject({ accountLevel: 5, items: [{ itemId: 'iron_oath_seal', quantity: 3 }] });
    expect(c.equipment.milestones.map((m) => m.rivets)).toEqual([1, 2, 3]);
  });

  it('serves the public catalog and lets operators edit rules with optimistic concurrency and validation', async () => {
    const pub = (await (await game('/api/v1/catalog')).json()) as { items: unknown[]; gear: unknown[]; config: { progression: { character: { levelCap: number } } } };
    expect(pub.items).toHaveLength(18);
    expect(pub.gear.length).toBe(258);
    expect(pub.config.progression.character.levelCap).toBe(20);
    const cfg = (await (await admin('/admin/api/config/progression', { as: 'viewer@example.com' })).json()) as { value: Record<string, unknown>; version: number };
    expect((await admin('/admin/api/config/progression', j('PUT', { value: cfg.value, expectedVersion: cfg.version }, 'viewer@example.com'))).status).toBe(403);
    const bad = await admin('/admin/api/config/progression', j('PUT', { value: { ...cfg.value, extra: 1 }, expectedVersion: cfg.version }));
    expect(bad.status).toBe(422);
    const ok = await admin('/admin/api/config/progression', j('PUT', { value: cfg.value, expectedVersion: cfg.version }));
    expect(ok.status).toBe(200);
    expect((await admin('/admin/api/config/progression', j('PUT', { value: cfg.value, expectedVersion: cfg.version }))).status).toBe(409);
    expect((await admin('/admin/api/config/nope', { as: 'viewer@example.com' })).status).toBe(404);
    const sum = (await (await admin('/admin/api/catalog/summary', { as: 'viewer@example.com' })).json()) as { sets: unknown[] };
    expect(sum.sets).toHaveLength(7);
    const item = (await (await admin('/admin/api/catalog/items', { as: 'viewer@example.com' })).json()) as { items: { item_id: string; version: number }[] };
    const page = item.items.find((i) => i.item_id === 'torn_chronicle_page')!;
    expect((await admin('/admin/api/catalog/items/torn_chronicle_page', j('PATCH', { expectedVersion: page.version, xp_value: 120 }, 'operator@example.com'))).status).toBe(200);
    expect((await admin('/admin/api/catalog/items/torn_chronicle_page', j('PATCH', { expectedVersion: page.version, xp_value: 130 }))).status).toBe(409);
  });
});
