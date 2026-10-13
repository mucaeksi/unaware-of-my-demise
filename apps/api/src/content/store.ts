import { ContentManifest, ContentValidationError, validateContentSet, type Channel } from '@uomd/content-schema';
import { manifestFromEntries, signManifest, type FileEntry } from '@uomd/patch';
import { importPrivateKey, sha256Hex } from '@uomd/shared';
import { auditStatement } from '../db/audit';

export class HttpError extends Error {
  constructor(readonly status: 400 | 401 | 402 | 403 | 404 | 409 | 413 | 422 | 429 | 503, readonly code: string, message: string, readonly extra?: unknown) {
    super(message);
  }
}

export const MAX_OBJECT_BYTES = 25 * 1024 * 1024;
const EMPTY = new Uint8Array(0);
const RELEASE_ID = /^[a-z][a-z0-9_]{1,47}$/;
const SHA = /^[0-9a-f]{64}$/;

export interface ReleaseRow {
  id: string;
  generation: number;
  channel: Channel;
  state: 'draft' | 'published' | 'retired';
  depends_on: string | null;
  manifest_json: string;
  notes: string;
  created_by: string;
  created_at: string;
  published_at: string | null;
}

export interface Signer {
  key: CryptoKey;
  kid: string;
}

export async function loadSigner(secretJwk: string | undefined, kid: string | undefined): Promise<Signer> {
  if (!secretJwk || !kid) throw new HttpError(503, 'signing_not_configured', 'CONTENT_SIGNING_KEY / CONTENT_SIGNING_KID are not configured');
  const jwk = JSON.parse(secretJwk) as JsonWebKey;
  return { key: await importPrivateKey(jwk), kid };
}

/**
 * Release store: D1 holds releases/pointers/object index, R2 holds the immutable, content-addressed
 * objects (objects/<sha256>). Nothing is served to players unless a published release references it.
 */
export class ContentStore {
  constructor(private readonly db: D1Database, private readonly bucket: R2Bucket) {}

  static objectKey(sha: string): string {
    return `objects/${sha}`;
  }

  // ------------------------------------------------------------------ objects

  async putObject(sha256: string, bytes: ArrayBuffer, mediaType: string): Promise<{ created: boolean }> {
    if (!SHA.test(sha256)) throw new HttpError(400, 'bad_hash', 'sha256 must be 64 lowercase hex characters');
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_OBJECT_BYTES) throw new HttpError(413, 'bad_size', `object must be 1..${MAX_OBJECT_BYTES} bytes`);
    if ((await sha256Hex(bytes)) !== sha256) throw new HttpError(400, 'hash_mismatch', 'body does not match the stated sha256');
    const existing = await this.db.prepare('SELECT 1 AS x FROM content_objects WHERE sha256 = ?1').bind(sha256).first();
    if (existing) return { created: false };
    await this.bucket.put(ContentStore.objectKey(sha256), bytes, { httpMetadata: { contentType: mediaType }, sha256 });
    await this.db.prepare('INSERT OR IGNORE INTO content_objects (sha256, bytes, media_type) VALUES (?1, ?2, ?3)').bind(sha256, bytes.byteLength, mediaType).run();
    return { created: true };
  }

  /** True when the object belongs to a release a player on `channel` may receive (pointer + its dependency chain). */
  async isServable(sha256: string, channel: Channel): Promise<boolean> {
    const row = await this.db
      .prepare(
        `WITH RECURSIVE live(id) AS (
           SELECT release_id FROM channel_pointers WHERE channel = ?2
           UNION
           SELECT r.depends_on FROM content_releases r JOIN live ON r.id = live.id WHERE r.depends_on IS NOT NULL
         )
         SELECT 1 AS x FROM release_files WHERE sha256 = ?1 AND release_id IN (SELECT id FROM live) LIMIT 1`
      )
      .bind(sha256, channel)
      .first();
    return row !== null;
  }

  async getObject(sha256: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(ContentStore.objectKey(sha256));
  }

  // ------------------------------------------------------------------ queries

  async getRelease(id: string): Promise<ReleaseRow | null> {
    return this.db.prepare('SELECT * FROM content_releases WHERE id = ?1').bind(id).first<ReleaseRow>();
  }

  async publishedManifest(channel: Channel): Promise<{ releaseId: string; json: string } | null> {
    const row = await this.db
      .prepare('SELECT r.id AS id, r.manifest_json AS json FROM channel_pointers p JOIN content_releases r ON r.id = p.release_id WHERE p.channel = ?1 AND r.state = ?2')
      .bind(channel, 'published')
      .first<{ id: string; json: string }>();
    return row ? { releaseId: row.id, json: row.json } : null;
  }

  async listReleases(): Promise<(Omit<ReleaseRow, 'manifest_json'> & { files: number })[]> {
    const { results } = await this.db
      .prepare(
        `SELECT r.id, r.generation, r.channel, r.state, r.depends_on, r.notes, r.created_by, r.created_at, r.published_at,
                (SELECT COUNT(*) FROM release_files f WHERE f.release_id = r.id) AS files,
                (SELECT 1 FROM channel_pointers p WHERE p.release_id = r.id) AS is_current
         FROM content_releases r ORDER BY r.channel, r.generation DESC`
      )
      .all();
    return results as unknown as (Omit<ReleaseRow, 'manifest_json'> & { files: number })[];
  }

  /** Files of a release plus everything inherited through depends_on (dependency first, release wins). */
  async effectiveFiles(releaseId: string): Promise<Map<string, string>> {
    const chain: string[] = [];
    let cur: string | null = releaseId;
    while (cur && chain.length < 8) {
      chain.push(cur);
      const r: { depends_on: string | null } | null = await this.db.prepare('SELECT depends_on FROM content_releases WHERE id = ?1').bind(cur).first();
      cur = r?.depends_on ?? null;
    }
    const out = new Map<string, string>();
    for (const id of chain.reverse()) {
      const { results } = await this.db.prepare('SELECT path, sha256 FROM release_files WHERE release_id = ?1').bind(id).all<{ path: string; sha256: string }>();
      for (const f of results) out.set(f.path, f.sha256);
    }
    return out;
  }

  async readText(sha256: string): Promise<Uint8Array> {
    const obj = await this.getObject(sha256);
    if (!obj) throw new HttpError(404, 'object_missing', `object ${sha256.slice(0, 8)} is not in storage`);
    return new Uint8Array(await obj.arrayBuffer());
  }

  /** Effective path->bytes map for semantic validation (JSON is read, other media only needs to exist). */
  private async effectiveSet(files: Map<string, string>): Promise<Map<string, Uint8Array>> {
    const set = new Map<string, Uint8Array>();
    for (const [path, sha] of files) set.set(path, path.endsWith('.json') ? await this.readText(sha) : EMPTY);
    return set;
  }

  private async validate(files: Map<string, string>): Promise<void> {
    try {
      validateContentSet(await this.effectiveSet(files));
    } catch (e) {
      if (e instanceof ContentValidationError) throw new HttpError(422, 'content_invalid', e.message, e.problems);
      throw e;
    }
  }

  // ------------------------------------------------------------------ drafts and publishing

  async createDraft(input: {
    id: string;
    channel: Channel;
    notes: string;
    minClient: string;
    dependsOn?: string;
    files: { path: string; sha256: string }[];
    rolloutPercent?: number;
    actor: string;
  }): Promise<ReleaseRow> {
    if (!RELEASE_ID.test(input.id)) throw new HttpError(400, 'bad_release_id', 'release id must match [a-z][a-z0-9_]{1,47}');
    if (input.files.length === 0) throw new HttpError(400, 'no_files', 'a release needs at least one file');
    if (await this.getRelease(input.id)) throw new HttpError(409, 'release_exists', `release ${input.id} already exists`);

    let dependsGeneration: number | undefined;
    if (input.dependsOn) {
      const dep = await this.getRelease(input.dependsOn);
      if (!dep || dep.state !== 'published') throw new HttpError(409, 'bad_dependency', `dependency ${input.dependsOn} must be a published release`);
      dependsGeneration = dep.generation;
    }
    const placeholders = input.files.map((_, i) => `?${i + 1}`).join(',');
    const { results } = await this.db
      .prepare(`SELECT sha256, bytes FROM content_objects WHERE sha256 IN (${placeholders})`)
      .bind(...input.files.map((f) => f.sha256))
      .all<{ sha256: string; bytes: number }>();
    const sizes = new Map(results.map((r) => [r.sha256, r.bytes]));
    const missing = input.files.filter((f) => !sizes.has(f.sha256));
    if (missing.length > 0) throw new HttpError(409, 'missing_objects', `${missing.length} object(s) were not uploaded`, missing.map((m) => m.path));

    const effective = input.dependsOn ? await this.effectiveFiles(input.dependsOn) : new Map<string, string>();
    for (const f of input.files) effective.set(f.path, f.sha256);
    await this.validate(effective);

    const gen = await this.db.prepare('SELECT COALESCE(MAX(generation), 0) + 1 AS g FROM content_releases WHERE channel = ?1').bind(input.channel).first<{ g: number }>();
    const generation = gen?.g ?? 1;
    const entries: FileEntry[] = input.files.map((f) => ({ path: f.path, sha256: f.sha256, bytes: sizes.get(f.sha256) as number }));
    const manifest = manifestFromEntries(
      {
        releaseId: input.id,
        generation,
        channel: input.channel,
        notes: input.notes,
        minClient: input.minClient,
        ...(input.dependsOn && dependsGeneration ? { dependsOn: { releaseId: input.dependsOn, generation: dependsGeneration } } : {}),
        rolloutPercent: input.rolloutPercent ?? 100
      },
      entries
    );
    const db = this.db;
    try {
      await db.batch([
        db
          .prepare('INSERT INTO content_releases (id, generation, channel, depends_on, manifest_json, notes, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
          .bind(input.id, generation, input.channel, input.dependsOn ?? null, JSON.stringify(manifest), input.notes, input.actor),
        ...entries.map((e) => db.prepare('INSERT INTO release_files (release_id, path, sha256) VALUES (?1, ?2, ?3)').bind(input.id, e.path, e.sha256)),
        auditStatement(db, input.actor, 'release.draft', input.id, { channel: input.channel, generation, files: entries.length })
      ]);
    } catch (e) {
      if (/UNIQUE constraint failed/i.test(String(e))) throw new HttpError(409, 'generation_race', 'another release was created at the same time; retry');
      throw e;
    }
    return (await this.getRelease(input.id)) as ReleaseRow;
  }

  /** Signs a draft and makes it the channel's current release (atomically, only if it is newer). */
  async publish(id: string, actor: string, role: 'owner' | 'operator', signer: Signer): Promise<ReleaseRow> {
    const row = await this.getRelease(id);
    if (!row) throw new HttpError(404, 'no_such_release', `release ${id} not found`);
    if (row.state !== 'draft') throw new HttpError(409, 'not_a_draft', `release ${id} is ${row.state}`);
    if (row.channel === 'production' && role !== 'owner') throw new HttpError(403, 'owner_required', 'publishing to production needs the owner role');
    await this.validate(await this.effectiveFiles(id));
    const { signature: _drop, ...unsigned } = JSON.parse(row.manifest_json) as ContentManifest;
    const signed = await signManifest(ContentManifest.parse(unsigned), signer.key, signer.kid);
    return this.activate(row, signed, actor, 'release.publish');
  }

  private async activate(row: ReleaseRow, signed: ContentManifest, actor: string, action: string): Promise<ReleaseRow> {
    const db = this.db;
    const now = new Date().toISOString();
    const canary = signed.rollout.percent < 100 && !signed.rollout.kill_switch;
    const validUntil = new Date(Date.parse(now) + (canary ? 24 : 2) * 3_600_000).toISOString();
    try {
      await db.batch([
        db
          .prepare(
            `UPDATE content_releases SET state = 'published', manifest_json = ?2, published_at = ?3
             WHERE id = ?1 AND state = 'draft'
               AND generation > COALESCE((SELECT r.generation FROM channel_pointers p JOIN content_releases r ON r.id = p.release_id WHERE p.channel = ?4), 0)`
          )
          .bind(row.id, JSON.stringify(signed), now, row.channel),
        db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
        db.prepare(`INSERT INTO release_economic_policy (release_id, mode, valid_until, cutover_at, updated_by, updated_at)
          SELECT release_id, ?5, ?2, ?3, ?4, ?3 FROM channel_pointers WHERE channel = ?1
          ON CONFLICT (release_id) DO NOTHING`).bind(row.channel, validUntil, now, actor, canary ? 'allowlisted' : 'grace'),
        db
          .prepare(
            `INSERT INTO channel_pointers (channel, release_id, updated_by, updated_at, economic_floor)
             SELECT ?1, id, ?3, ?4, CASE WHEN ?5 = 1 THEN generation ELSE 0 END FROM content_releases WHERE id = ?2 AND state = 'published'
             ON CONFLICT (channel) DO UPDATE SET release_id = excluded.release_id, version = version + 1, updated_by = excluded.updated_by, updated_at = excluded.updated_at,
               economic_floor = MAX(channel_pointers.economic_floor, excluded.economic_floor)
             WHERE (SELECT generation FROM content_releases WHERE id = excluded.release_id)
               > COALESCE((SELECT generation FROM content_releases WHERE id = channel_pointers.release_id), 0)`
          )
          .bind(row.channel, row.id, actor, now, signed.rollout.kill_switch ? 1 : 0),
        db.prepare('INSERT INTO tx_guard (ok) VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)'),
        auditStatement(db, actor, action, row.id, { channel: row.channel, generation: row.generation }),
        db.prepare('DELETE FROM tx_guard')
      ]);
    } catch (e) {
      if (/CHECK constraint failed: ok = 1/i.test(String(e))) throw new HttpError(409, 'stale_release', 'the draft or channel changed before publication; retry');
      throw e;
    }
    return (await this.getRelease(row.id)) as ReleaseRow;
  }

  /**
   * Rollback and kill switch both publish a NEW release (higher generation, same files as an earlier
   * one) so every device moves forward monotonically; clients never accept a lower generation.
   */
  async republish(opts: { channel: Channel; sourceId: string; mode: 'rollback' | 'kill'; actor: string; role: 'owner' | 'operator'; signer: Signer }): Promise<ReleaseRow> {
    if (opts.channel === 'production' && opts.role !== 'owner') throw new HttpError(403, 'owner_required', 'production changes need the owner role');
    const src = await this.getRelease(opts.sourceId);
    if (!src || src.state === 'draft' || src.channel !== opts.channel) throw new HttpError(404, 'no_such_release', `no published release ${opts.sourceId} on ${opts.channel}`);
    const srcManifest = JSON.parse(src.manifest_json) as ContentManifest;
    const gen = await this.db.prepare('SELECT COALESCE(MAX(generation), 0) + 1 AS g FROM content_releases WHERE channel = ?1').bind(opts.channel).first<{ g: number }>();
    const generation = gen?.g ?? src.generation + 1;
    const id = `${opts.mode === 'kill' ? 'kill' : 'rb'}_${opts.channel}_g${generation}`;
    const manifest = manifestFromEntries(
      {
        releaseId: id,
        generation,
        channel: opts.channel,
        notes: `${opts.mode === 'kill' ? 'KILL SWITCH' : 'Rollback'} to ${src.id}`,
        minClient: srcManifest.compat.min_client,
        ...(srcManifest.depends_on ? { dependsOn: { releaseId: srcManifest.depends_on.release_id, generation: srcManifest.depends_on.generation } } : {}),
        rollbackTo: { releaseId: src.id, generation: src.generation },
        killSwitch: opts.mode === 'kill',
        rolloutPercent: 100
      },
      srcManifest.files
    );
    const db = this.db;
    await db.batch([
      db
        .prepare('INSERT INTO content_releases (id, generation, channel, depends_on, manifest_json, notes, created_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)')
        .bind(id, generation, opts.channel, src.depends_on, JSON.stringify(manifest), manifest.release.notes, opts.actor),
      ...manifest.files.map((f) => db.prepare('INSERT INTO release_files (release_id, path, sha256) VALUES (?1, ?2, ?3)').bind(id, f.path, f.sha256))
    ]);
    const signed = await signManifest(manifest, opts.signer.key, opts.signer.kid);
    const row = (await this.getRelease(id)) as ReleaseRow;
    return this.activate(row, signed, opts.actor, opts.mode === 'kill' ? 'release.kill_switch' : 'release.rollback');
  }

  // ------------------------------------------------------------------ battle verification support

  /** Bytes of the effective file `path` as seen by clients running `releaseId`. */
  async effectiveBytes(releaseId: string, path: string): Promise<Uint8Array | null> {
    const files = await this.effectiveFiles(releaseId);
    const sha = files.get(path);
    return sha ? this.readText(sha) : null;
  }
}
