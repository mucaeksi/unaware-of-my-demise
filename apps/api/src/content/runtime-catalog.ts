import { CATALOG_PATH, ContentManifest, EconomyCatalog, MAX_CATALOG_BYTES } from '@uomd/content-schema';
import type { AttributeBlock, CharacterStatSource } from '@uomd/economy';
import { sha256Hex } from '@uomd/shared';
import type { GameEnv } from '../env';
import { ContentStore, HttpError } from './store';
import { requireEconomic } from './authority';

/** Request-local definitions. Never cache under a channel or fall back after finding a declared catalog. */
export interface RuntimeCatalog {
  releaseId: string;
  sha256: string;
  data: EconomyCatalog;
}

export async function loadReleaseCatalog(env: Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>, releaseId: string): Promise<RuntimeCatalog | undefined> {
  const store = new ContentStore(env.DB, env.CONTENT);
  const release = await store.getRelease(releaseId);
  if (!release || release.state !== 'published' || release.channel !== env.CONTENT_CHANNEL) throw new HttpError(404, 'unknown_release', 'release is not published on this channel');
  const invalid = (): HttpError => new HttpError(503, 'release_catalog_invalid', 'the declared release catalog is unavailable or invalid');
  let manifest: ContentManifest;
  try { manifest = ContentManifest.parse(JSON.parse(release.manifest_json)); } catch { throw invalid(); }
  const declared = manifest.files.find((file) => file.path === CATALOG_PATH);
  const sha256 = (await store.effectiveFiles(releaseId)).get(CATALOG_PATH);
  if (!declared && !sha256) return undefined; // explicit catalog-free legacy contract
  if (!sha256 || manifest.depends_on || !declared || declared.sha256 !== sha256 || declared.bytes > MAX_CATALOG_BYTES) throw invalid();
  const object = await store.getObject(sha256);
  if (!object || object.size !== declared.bytes || object.size > MAX_CATALOG_BYTES) throw invalid();
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (bytes.byteLength > MAX_CATALOG_BYTES || await sha256Hex(bytes) !== sha256) throw invalid();
  try {
    return { releaseId, sha256, data: EconomyCatalog.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes))) };
  } catch {
    throw invalid();
  }
}

export function catalogCharacter(catalog: { data: Pick<EconomyCatalog, 'characters'> }, id: string): EconomyCatalog['characters'][number] {
  const row = catalog.data.characters.find((c) => c.id === id && c.status !== 'retired');
  if (!row) throw new HttpError(422, 'unknown_item', `character ${id} is unavailable in this release`);
  return row;
}

export function catalogGear(catalog: { data: Pick<EconomyCatalog, 'gear'> }, id: string): EconomyCatalog['gear'][number] {
  const row = catalog.data.gear.find((g) => g.gear_id === id && g.status !== 'retired');
  if (!row) throw new HttpError(422, 'unknown_item', `gear ${id} is unavailable in this release`);
  return row;
}

export function catalogRoleStat(catalog: RuntimeCatalog, role: string): string {
  const { roleStat, roleStatOrder } = catalog.data.config.gear;
  const key = (roleStatOrder ?? Object.keys(roleStat)).find((candidate) => candidate !== 'default' && role.includes(candidate));
  return (key ? roleStat[key] : roleStat.default)!;
}

/** A release's character row with its stat source: attributes (D-27) or the legacy base + growth of older catalogs. */
export function characterDefinition(row: EconomyCatalog['characters'][number]): EconomyCatalog['characters'][number] & { stats: CharacterStatSource } {
  return { ...row, stats: row.attributes ? { attributes: row.attributes } : { base: row.base!, growth: row.growth! } };
}

/** D1 `characters` attribute columns (migration 0029) as selected by CHARACTER_STAT_COLUMNS */
export const CHARACTER_STAT_COLUMNS = 'power_stat, base_str, base_int, base_vit, base_agi, growth_str, growth_int, growth_vit, growth_agi, armor';
export interface CharacterStatRow { power_stat: string; base_str: number; base_int: number; base_vit: number; base_agi: number; growth_str: number; growth_int: number; growth_vit: number; growth_agi: number; armor: number }
/** a selected D1 row with its attribute columns folded into `attributes` */
export function withAttributes<T extends CharacterStatRow>(row: T): Omit<T, keyof CharacterStatRow> & { attributes: AttributeBlock } {
  const { power_stat: _p, base_str: _s, base_int: _i, base_vit: _v, base_agi: _a, growth_str: _gs, growth_int: _gi, growth_vit: _gv, growth_agi: _ga, armor: _ar, ...rest } = row;
  return { ...rest, attributes: rowAttributes(row) };
}
export function rowAttributes(r: CharacterStatRow): AttributeBlock {
  return {
    power: r.power_stat === 'int' ? 'int' : 'str',
    base: { str: r.base_str, int: r.base_int, vit: r.base_vit, agi: r.base_agi },
    growth: { str: r.growth_str, int: r.growth_int, vit: r.growth_vit, agi: r.growth_agi },
    ...(r.armor ? { armor: r.armor } : {})
  };
}

/** Existing gear math consumes these columns; only player instance fields continue to come from D1. */
export function gearDefinition(row: EconomyCatalog['gear'][number]) {
  return { ...row, base_json: JSON.stringify(row.base), growth_json: JSON.stringify(row.growth), extra_json: JSON.stringify(row.extra),
    dismantle_json: JSON.stringify(row.dismantle), dismantle_allowed: row.dismantle_allowed ? 1 : 0 };
}

/** Route context is passed lazily so durable operation recovery runs before release/catalog admission. */
export interface ReleaseScope extends Pick<GameEnv, 'CONTENT' | 'CONTENT_CHANNEL'> { releaseId?: string }
export function releaseScope(env: Pick<GameEnv, 'CONTENT' | 'CONTENT_CHANNEL'>, releaseId?: string): ReleaseScope {
  return { CONTENT: env.CONTENT, CONTENT_CHANNEL: env.CONTENT_CHANNEL, releaseId };
}
export async function operationCatalog(db: D1Database, playerId: string, scope?: ReleaseScope, now = new Date()): Promise<RuntimeCatalog | undefined> {
  if (!scope) return undefined; // internal legacy callers; public routes always supply channel context
  const env = { ...scope, DB: db };
  if (!scope.releaseId) {
    const pointer = await db.prepare('SELECT release_id FROM channel_pointers WHERE channel = ?1').bind(scope.CONTENT_CHANNEL).first<{ release_id: string }>();
    if (pointer && await loadReleaseCatalog(env, pointer.release_id)) throw new HttpError(409, 'release_required', 'select the installed content release before changing this account');
    return undefined;
  }
  await requireEconomic(db, scope.CONTENT_CHANNEL, scope.releaseId, playerId, '', now);
  return loadReleaseCatalog(env, scope.releaseId);
}
export async function displayCatalog(env: Pick<GameEnv, 'DB' | 'CONTENT' | 'CONTENT_CHANNEL'>, releaseId?: string): Promise<RuntimeCatalog | undefined> {
  if (!releaseId) releaseId = (await env.DB.prepare('SELECT release_id FROM channel_pointers WHERE channel = ?1').bind(env.CONTENT_CHANNEL).first<{ release_id: string }>())?.release_id;
  return releaseId ? loadReleaseCatalog(env, releaseId) : undefined;
}
