import { CATALOG_PATH, ContentManifest, EconomyCatalog, MAX_CATALOG_BYTES } from '@uomd/content-schema';
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
  const manifest = ContentManifest.parse(JSON.parse(release.manifest_json));
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

export function catalogCharacter(catalog: RuntimeCatalog, id: string): EconomyCatalog['characters'][number] {
  const row = catalog.data.characters.find((c) => c.id === id && c.status !== 'retired');
  if (!row) throw new HttpError(422, 'unknown_item', `character ${id} is unavailable in this release`);
  return row;
}

export function catalogGear(catalog: RuntimeCatalog, id: string): EconomyCatalog['gear'][number] {
  const row = catalog.data.gear.find((g) => g.gear_id === id && g.status !== 'retired');
  if (!row) throw new HttpError(422, 'unknown_item', `gear ${id} is unavailable in this release`);
  return row;
}

export function catalogRoleStat(catalog: RuntimeCatalog, role: string): string {
  const { roleStat, roleStatOrder } = catalog.data.config.gear;
  const key = (roleStatOrder ?? Object.keys(roleStat)).find((candidate) => candidate !== 'default' && role.includes(candidate));
  return (key ? roleStat[key] : roleStat.default)!;
}

export function characterDefinition(row: EconomyCatalog['characters'][number]) {
  return { ...row, base_hp: row.base.hp, base_atk: row.base.atk, base_def: row.base.def, base_spd: row.base.spd,
    growth_hp: row.growth.hp, growth_atk: row.growth.atk, growth_def: row.growth.def, growth_spd: row.growth.spd };
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
