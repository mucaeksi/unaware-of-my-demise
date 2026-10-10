import { ContentManifest, type ManifestFile } from '@uomd/content-schema';
import { compareSemver, sha256Hex, verifyPayload, type SignedPayload } from '@uomd/shared';
import type { ActiveRelease, BaseContent, ContentStorage, PatchEnv, PatchOutcome, PatchState, RejectReason, RemoteSource } from './types';

const EMPTY: PatchState = { schema: 1, active: null, previous: null, denied: [] };

class Reject extends Error {
  constructor(readonly reason: RejectReason, detail: string) {
    super(detail);
  }
}

/**
 * Content patch client. Contract (README "Patch manager baseline"):
 *  - only data/media described by a signed, schema-valid manifest is ever accepted;
 *  - every object is size- and SHA-256-verified before it is stored (content addressed);
 *  - semantic validation runs before activation; activation is ONE atomic state write;
 *  - the previous release is kept for rollback; failures never touch the active release.
 */
export class PatchManager {
  constructor(
    private readonly env: PatchEnv,
    private readonly storage: ContentStorage,
    private readonly remote: RemoteSource,
    private readonly base: BaseContent
  ) {}

  async state(): Promise<PatchState> {
    return (await this.storage.getState()) ?? EMPTY;
  }

  /** Looks for a newer release and applies it. Never throws for expected failure modes. */
  async checkAndApply(): Promise<PatchOutcome> {
    const state = await this.state();
    let raw: unknown | null;
    try {
      raw = await this.remote.fetchManifest(this.env.channel);
    } catch (e) {
      return { status: 'offline', detail: String(e) };
    }
    if (raw === null) return { status: 'up_to_date', releaseId: state.active?.releaseId ?? null };
    try {
      const manifest = await this.admit(raw, state);
      if (manifest.rollout.kill_switch) {
        if (state.active) await this.storage.setState({ ...state, active: null, previous: state.active });
        return { status: 'reverted_to_base', reason: 'kill_switch' };
      }
      const currentGen = state.active?.generation ?? this.base.generation;
      if (manifest.release.generation === currentGen && manifest.release.id === (state.active?.releaseId ?? this.base.releaseId)) {
        return { status: 'up_to_date', releaseId: state.active?.releaseId ?? null };
      }
      if (manifest.release.generation <= currentGen) throw new Reject('stale_generation', `generation ${manifest.release.generation} <= active ${currentGen}`);
      if (!(await this.inRollout(manifest))) return { status: 'up_to_date', releaseId: state.active?.releaseId ?? null };
      return await this.apply(manifest, state);
    } catch (e) {
      if (e instanceof Reject) return { status: 'rejected', reason: e.reason, detail: e.message };
      throw e;
    }
  }

  /** Reads a content file through the overlay: active patch release first, else the embedded base. */
  async read(path: string): Promise<Uint8Array> {
    const st = await this.state();
    const f = st.active?.manifest.files.find((x) => x.path === path);
    if (f) {
      const bytes = await this.storage.getObject(f.sha256);
      if (bytes && (await sha256Hex(bytes)) === f.sha256) return bytes;
      // storage lost or corrupted a patched object: fall back to the last good state, then to base
      await this.rollback();
      return this.read(path);
    }
    return this.base.read(path);
  }

  /** Which layer serves a path, and the SHA-256 of the bytes it serves (used for cache keys). */
  async locate(path: string): Promise<{ source: 'base' | 'patch'; sha256: string }> {
    const st = await this.state();
    const f = st.active?.manifest.files.find((x) => x.path === path);
    if (f) return { source: 'patch', sha256: f.sha256 };
    const h = this.base.files[path];
    if (!h) throw new Error(`no such content file: ${path}`);
    return { source: 'base', sha256: h };
  }

  /** Re-activates the previous release (or the embedded base). Returns false when already on base. */
  async rollback(): Promise<boolean> {
    const st = await this.state();
    if (!st.active) return false;
    const denied = st.denied.includes(st.active.releaseId) ? st.denied : [...st.denied, st.active.releaseId];
    await this.storage.setState({ schema: 1, active: st.previous, previous: null, denied });
    await this.collect();
    return true;
  }

  // ---------------------------------------------------------------------------- internals

  private async admit(raw: unknown, state: PatchState): Promise<ContentManifest> {
    const parsed = ContentManifest.safeParse(raw);
    if (!parsed.success) throw new Reject('malformed_manifest', parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    const m = parsed.data;
    if (!(await verifyPayload(m as unknown as SignedPayload, this.env.trustedKeys))) throw new Reject('bad_signature', 'signature missing, unknown key or invalid');
    if (m.release.channel !== this.env.channel) throw new Reject('wrong_channel', `${m.release.channel} != ${this.env.channel}`);
    if (compareSemver(this.env.clientVersion, m.compat.min_client) < 0) throw new Reject('client_too_old', `needs >= ${m.compat.min_client}`);
    if (m.compat.max_client && compareSemver(this.env.clientVersion, m.compat.max_client) > 0) throw new Reject('client_too_new', `needs <= ${m.compat.max_client}`);
    if (m.compat.content_schema > this.env.supportedContentSchema) throw new Reject('schema_too_new', `content schema ${m.compat.content_schema} > ${this.env.supportedContentSchema}`);
    if (state.denied.includes(m.release.id)) throw new Reject('denied_release', `${m.release.id} previously failed on this device`);
    const dep = m.depends_on;
    if (dep && dep.release_id !== this.base.releaseId) throw new Reject('dependency_mismatch', `needs ${dep.release_id}, base is ${this.base.releaseId}`);
    return m;
  }

  private async inRollout(m: ContentManifest): Promise<boolean> {
    if (m.rollout.percent >= 100) return true;
    if (m.rollout.percent <= 0) return false;
    const h = await sha256Hex(`${this.env.installId}:${m.release.id}`);
    return parseInt(h.slice(0, 8), 16) % 100 < m.rollout.percent;
  }

  private async apply(m: ContentManifest, state: PatchState): Promise<PatchOutcome> {
    // 1. what is missing locally? (base-identical files and already-stored objects are free)
    const missing: ManifestFile[] = [];
    for (const f of m.files) {
      if (this.base.files[f.path] === f.sha256) continue;
      if (!(await this.storage.hasObject(f.sha256))) missing.push(f);
    }
    const addBytes = missing.reduce((n, f) => n + f.bytes, 0);
    if (addBytes > this.env.storageBudgetBytes) throw new Reject('storage_budget', `patch needs ${addBytes} bytes, budget ${this.env.storageBudgetBytes}`);

    // 2. download + verify each object; completed objects survive an interruption (resume)
    let downloaded = 0;
    for (const f of missing) {
      const bytes = await this.download(f);
      await this.storage.putObject(f.sha256, bytes);
      downloaded += bytes.byteLength;
    }

    // 3. semantic validation of the complete file set, as it would be activated
    const files = new Map<string, Uint8Array>();
    for (const f of m.files) {
      const bytes = this.base.files[f.path] === f.sha256 ? await this.base.read(f.path) : await this.storage.getObject(f.sha256);
      if (!bytes) throw new Reject('download_failed', `object for ${f.path} vanished from storage`);
      files.set(f.path, bytes);
    }
    try {
      await this.env.validate(files, m, this.base);
    } catch (e) {
      await this.storage.setState({ ...state, denied: [...new Set([...state.denied, m.release.id])] });
      throw new Reject('validation_failed', e instanceof Error ? e.message : String(e));
    }

    // 4. atomic activation; the old active release becomes the rollback target
    const next: ActiveRelease = {
      releaseId: m.release.id,
      generation: m.release.generation,
      manifest: m,
      activatedAt: (this.env.now?.() ?? new Date()).toISOString()
    };
    await this.storage.setState({ schema: 1, active: next, previous: state.active, denied: state.denied });
    await this.collect();
    return { status: 'applied', releaseId: next.releaseId, generation: next.generation, downloadedBytes: downloaded, downloadedFiles: missing.length };
  }

  private async download(f: ManifestFile): Promise<Uint8Array> {
    const attempts = this.env.maxAttempts ?? 3;
    const sleep = this.env.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    let last = 'unknown';
    for (let i = 1; i <= attempts; i++) {
      try {
        const bytes = await this.remote.fetchObject(f.sha256, f);
        if (bytes.byteLength !== f.bytes) {
          last = `size ${bytes.byteLength} != ${f.bytes}`;
        } else if ((await sha256Hex(bytes)) !== f.sha256) {
          last = 'sha256 mismatch';
        } else {
          return bytes;
        }
      } catch (e) {
        last = String(e);
      }
      if (i < attempts) await sleep(250 * 2 ** (i - 1));
    }
    throw new Reject(last.includes('mismatch') || last.startsWith('size') ? 'hash_mismatch' : 'download_failed', `${f.path}: ${last}`);
  }

  /** Drops stored objects no longer referenced by the active or previous release. */
  private async collect(): Promise<void> {
    const st = await this.state();
    const keep = new Set<string>();
    for (const r of [st.active, st.previous]) for (const f of r?.manifest.files ?? []) keep.add(f.sha256);
    for (const h of await this.storage.listObjects()) if (!keep.has(h)) await this.storage.deleteObject(h);
  }
}
