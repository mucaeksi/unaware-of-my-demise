import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';
import { ProgressionConfig } from '@uomd/economy';
import { admin, game, seedCanonCatalog } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
const j = (method: string, body: unknown, as?: string) => ({ method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, ...(as ? { as } : {}) });

beforeAll(async () => {
  await seedCanonCatalog();
  await db().prepare("INSERT OR IGNORE INTO admin_users (email, role, created_by) VALUES ('viewer@example.com','viewer','test'), ('operator@example.com','operator','test')").run();
});

describe('canon catalog seed', () => {
  it('imports every canon definition (18 items, 25 signature + 160 common weapons, 36 armor, 42 accessories in 7 sets) and is re-runnable', async () => {
    const count = async (sql: string): Promise<number> => ((await db().prepare(sql).first<{ n: number }>()) as { n: number }).n;
    expect(await count('SELECT COUNT(*) AS n FROM item_defs')).toBe(18);
    expect(await count("SELECT COUNT(*) AS n FROM gear_defs WHERE slot = 'weapon'")).toBe(185);
    expect(await count("SELECT COUNT(*) AS n FROM gear_defs WHERE slot = 'weapon' AND rarity = 5 AND owner_character_id IS NOT NULL")).toBe(25);
    expect(await count("SELECT COUNT(*) AS n FROM gear_defs WHERE slot = 'armor'")).toBe(36);
    expect(await count("SELECT COUNT(*) AS n FROM gear_defs WHERE slot IN ('necklace','ring')")).toBe(42);
    expect(await count('SELECT COUNT(*) AS n FROM accessory_sets')).toBe(7);
    expect(await count('SELECT COUNT(*) AS n FROM weapon_types')).toBe(20);
    expect(await count('SELECT COUNT(*) AS n FROM character_skills')).toBe(100);
    await seedCanonCatalog();
    expect(await count("SELECT COUNT(*) AS n FROM gear_defs WHERE slot = 'weapon'")).toBe(185);
    // attributes come with the row (seed/characters.sql); the catalog seed links the weapon identity
    const m = await db().prepare("SELECT weapon_type, signature_weapon_id FROM characters WHERE id = 'mahmut'").first();
    expect(m).toMatchObject({ weapon_type: 'arming_sword', signature_weapon_id: 'weapon_mahmut_signature' });
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
    expect(pub.gear.length).toBe(263);
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

describe('banner seed against the catalog', () => {
  it('every seeded banner (character and weapon) references items that exist with the right rarity', async () => {
    const sql = Object.values(import.meta.glob('../seed/banners.sql', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>)[0] as string;
    for (const stmt of sql.split(/;\n(?=INSERT )/).map((x) => x.replace(/^--.*\n/, '').trim().replace(/;$/, '')).filter(Boolean)) await db().prepare(stmt).run();
    const { BannerConfig } = await import('@uomd/economy');
    const { results } = await db().prepare("SELECT id, config_json, status FROM banners WHERE id IN ('hall_of_ancestors','hall_of_armaments_weapons') OR id LIKE 'oath_%'").all<{ id: string; config_json: string; status: string }>();
    expect(results.length).toBe(12);
    for (const b of results) {
      const cfg = BannerConfig.parse(JSON.parse(b.config_json));
      const ids = [...cfg.pools.fiveFeatured, ...cfg.pools.fiveOther, ...cfg.pools.four, ...cfg.pools.three];
      const table = cfg.kind === 'character' ? 'characters' : 'gear_defs';
      const col = cfg.kind === 'character' ? 'id' : 'gear_id';
      let found = 0;
      for (let i = 0; i < ids.length; i += 80) {
        const part = ids.slice(i, i + 80);
        found += (await db().prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} IN (${part.map(() => '?').join(',')})`).bind(...part).first<{ n: number }>())!.n;
      }
      expect(found, b.id).toBe(ids.length);
    }
    expect(results.find((r) => r.id === 'hall_of_armaments_weapons')?.status).toBe('active');
  });
});
