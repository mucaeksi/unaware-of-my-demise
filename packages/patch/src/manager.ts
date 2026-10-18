import { ContentManifest, type ManifestFile } from '@uomd/content-schema';
import { compareSemver, sha256Hex, verifyPayload, type SignedPayload } from '@uomd/shared';
import type { ActiveRelease, ApplyOptions, BaseContent, ContentStorage, GenerationMark, PatchEnv, PatchOutcome, PatchProgress, PatchState, RejectReason, RemoteSource, StorageSnapshot } from './types';

const EMPTY: PatchState = { schema: 1, active: null, previous: null, staged: null, denied: [] };

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
  private validated: { key: string; state: PatchState } | null = null;
  constructor(
    private readonly env: PatchEnv,
    private readonly storage: ContentStorage,
    private readonly remote: RemoteSource,
    private readonly base: BaseContent
  ) {}

  async state(): Promise<PatchState> {
    return this.validState(await this.storage.getState());
  }

  private async validState(raw: PatchState | null): Promise<PatchState> {
    if (!raw) return structuredClone(EMPTY);
    let key: string;
    try { key = JSON.stringify(raw); } catch { return structuredClone(EMPTY); }
    if (this.validated?.key === key) return structuredClone(this.validated.state);
    if (raw.schema !== 1 || !Array.isArray(raw.denied) || raw.denied.some((id) => typeof id !== 'string')) return structuredClone(EMPTY);
    const state: PatchState = { ...EMPTY, denied: [...raw.denied] };
    const valid = async (release: ActiveRelease | null | undefined): Promise<ActiveRelease | null> => {
      if (!release) return null;
      try {
        const manifest = await this.admit(release.manifest, state);
        if (release.releaseId !== manifest.release.id || release.generation !== manifest.release.generation || !Number.isFinite(Date.parse(release.activatedAt))) return null;
        return { ...release, manifest };
      } catch { return null; }
    };
    state.active = await valid(raw.active); state.previous = await valid(raw.previous); state.staged = await valid(raw.staged);
    if (raw.active && !state.active && state.previous) { state.active = state.previous; state.previous = null; }
    this.validated = { key, state: structuredClone(state) };
    return state;
  }

  /** Crypto validation happens outside IDB; compare the exact snapshot again inside its write transaction. */
  private async commit(change: (state: PatchState, mark: GenerationMark) => StorageSnapshot | null): Promise<boolean> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await this.storage.getState(); const state = await this.validState(raw); let matched = false;
      const result = await this.storage.updateState(this.env.channel, (current) => {
        if (JSON.stringify(current.state) !== JSON.stringify(raw)) return null;
        matched = true;
        let mark = current.highWater;
        if (mark && (!Number.isSafeInteger(mark.generation) || mark.generation < 1 || typeof mark.releaseId !== 'string' || typeof mark.killed !== 'boolean')) throw new Reject('storage_state_invalid', 'accepted generation record is corrupted');
        const candidates: GenerationMark[] = [{ generation: this.base.generation, releaseId: this.base.releaseId, killed: false }, ...[state.active, state.previous, state.staged].filter((r): r is ActiveRelease => !!r).map((r) => ({ generation: r.generation, releaseId: r.releaseId, killed: r.manifest.rollout.kill_switch }))];
        for (const candidate of candidates) if (!mark || candidate.generation > mark.generation) mark = candidate;
        return change(state, mark!);
      });
      if (matched) return result;
    }
    throw new Reject('storage_busy', 'content state changed concurrently; retry the update');
  }

  private async highWater(): Promise<GenerationMark> {
    let mark!: GenerationMark;
    await this.commit((state, known) => { mark = known; return { state: state.active || state.previous || state.staged || state.denied.length ? state : null, highWater: known }; });
    return mark;
  }

  private sameMark(mark: GenerationMark, manifest: ContentManifest): boolean {
    return mark.generation === manifest.release.generation && mark.releaseId === manifest.release.id && mark.killed === manifest.rollout.kill_switch;
  }

  /** Looks for a newer release and applies (or, with `activate: false`, stages) it. Never throws for expected failure modes. */
  async checkAndApply(opts: ApplyOptions = {}): Promise<PatchOutcome> {
    if (this.env.networkPolicy?.() === 'offline') return { status: 'offline', detail: 'no connection' };
    if (this.env.networkPolicy?.() === 'metered' && !opts.allowMetered) return { status: 'rejected', reason: 'network_policy', detail: 'Allow downloads on the current data-saving or metered connection to continue.' };
    const controller = new AbortController(); const owner = crypto.randomUUID();
    const abort = () => controller.abort(new Reject('cancelled', 'download cancelled; verified content is retained'));
    if (opts.signal?.aborted) abort(); else opts.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Reject('download_timeout', 'download deadline reached; completed files and partial bytes are retained')), this.env.downloadTimeoutMs ?? 240_000);
    try { return await interrupted(this.check({ ...opts, signal: controller.signal }, owner), controller.signal); }
    catch (error) {
      if (error instanceof Reject) return { status: 'rejected', reason: error.reason, detail: error.message };
      if (error instanceof Error && error.name === 'QuotaExceededError') return { status: 'rejected', reason: 'storage_quota', detail: 'Device storage is full. Existing content is retained.' };
      throw error;
    } finally {
      clearTimeout(timer); opts.signal?.removeEventListener('abort', abort);
      await this.storage.updateState(this.env.channel, (current) => { const downloads = { ...current.downloads }; delete downloads[owner]; return { ...current, downloads }; }).catch(() => undefined);
    }
  }

  private async check(opts: ApplyOptions, owner: string): Promise<PatchOutcome> {
    checkAbort(opts.signal);
    const state = await this.state();
    opts.onProgress?.({ phase: 'checking', releaseId: null, filesDone: 0, filesTotal: 0, bytesDone: 0, bytesTotal: 0 });
    let raw: unknown | null;
    try {
      raw = await interrupted(this.remote.fetchManifest(this.env.channel, opts.signal), opts.signal);
    } catch (e) {
      checkAbort(opts.signal);
      return { status: 'offline', detail: String(e) };
    }
    if (raw === null) return { status: 'up_to_date', releaseId: state.active?.releaseId ?? null };
    try {
      const manifest = await this.admit(raw, state);
      checkAbort(opts.signal);
      const highest = await this.highWater();
      if (manifest.release.generation < highest.generation || manifest.release.generation === highest.generation && !this.sameMark(highest, manifest)) throw new Reject('stale_generation', 'manifest predates the greatest accepted generation');
      if (manifest.rollout.kill_switch) {
        const committed = await this.commit((current, mark) => {
          if (manifest.release.generation < mark.generation || manifest.release.generation === mark.generation && !this.sameMark(mark, manifest)) return null;
          return { state: { ...current, active: null, previous: current.active ?? current.previous, staged: null }, highWater: { generation: manifest.release.generation, releaseId: manifest.release.id, killed: true } };
        });
        if (!committed) throw new Reject('stale_generation', 'a newer generation won before the kill committed');
        return { status: 'reverted_to_base', reason: 'kill_switch' };
      }
      const currentGen = state.active?.generation ?? this.base.generation;
      if (manifest.release.generation === currentGen && manifest.release.id === (state.active?.releaseId ?? this.base.releaseId)) {
        return { status: 'up_to_date', releaseId: state.active?.releaseId ?? null };
      }
      if (manifest.release.generation <= currentGen) throw new Reject('stale_generation', `generation ${manifest.release.generation} <= active ${currentGen}`);
      if (!(await this.inRollout(manifest))) return { status: 'up_to_date', releaseId: state.active?.releaseId ?? null };
      if (state.staged?.releaseId === manifest.release.id && opts.activate !== false) {
        const done = await this.activateStaged(opts.onProgress, opts.signal);
        if (done) return done;
      }
      if (this.sameMark(highest, manifest) && !state.staged) throw new Reject('stale_generation', 'this generation cannot be reapplied after fallback');
      return await this.apply(manifest, opts, owner);
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
      const bytes = this.base.files[path] === f.sha256 ? await this.base.read(path) : await this.storage.getObject(f.sha256);
      if (bytes && (await sha256Hex(bytes)) === f.sha256) return bytes;
      // storage lost or corrupted a patched object: fall back to the last good state, then to base
      await this.rollback();
      return this.read(path);
    }
    if (st.active && !st.active.manifest.depends_on) throw new Error(`no such content file: ${path}`);
    return this.base.read(path);
  }

  /** Which layer serves a path, and the SHA-256 of the bytes it serves (used for cache keys). */
  async locate(path: string): Promise<{ source: 'base' | 'patch'; sha256: string }> {
    const st = await this.state();
    const f = st.active?.manifest.files.find((x) => x.path === path);
    if (f) return { source: 'patch', sha256: f.sha256 };
    if (st.active && !st.active.manifest.depends_on) throw new Error(`no such content file: ${path}`);
    const h = this.base.files[path];
    if (!h) throw new Error(`no such content file: ${path}`);
    return { source: 'base', sha256: h };
  }

  /** Re-activates the previous release (or the embedded base). Returns false when already on base. */
  async rollback(): Promise<boolean> {
    const changed = await this.commit((st, mark) => {
      if (!st.active) return null;
      const denied = st.denied.includes(st.active.releaseId) ? st.denied : [...st.denied, st.active.releaseId];
      return { state: { ...st, active: st.previous, previous: null, denied }, highWater: mark };
    });
    if (!changed) return false;
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
    if (m.compat.required_capabilities?.some((c) => !this.env.supportedCapabilities?.includes(c))) throw new Reject('capability_missing', 'This content requires a newer app capability.');
    if (state.denied.includes(m.release.id)) throw new Reject('denied_release', `${m.release.id} previously failed on this device`);
    const dep = m.depends_on;
    if (dep && (dep.release_id !== this.base.releaseId || dep.generation !== this.base.generation)) throw new Reject('dependency_mismatch', `needs ${dep.release_id} g${dep.generation}, base is ${this.base.releaseId} g${this.base.generation}`);
    return m;
  }

  private async inRollout(m: ContentManifest): Promise<boolean> {
    if (m.rollout.percent >= 100) return true;
    if (m.rollout.percent <= 0) return false;
    const h = await sha256Hex(`${this.env.installId}:${m.release.id}`);
    return parseInt(h.slice(0, 8), 16) % 100 < m.rollout.percent;
  }

  private async apply(m: ContentManifest, opts: ApplyOptions, owner: string): Promise<PatchOutcome> {
    const emit = (phase: PatchProgress['phase'], p: Partial<PatchProgress> = {}): void => {
      if (!opts.signal?.aborted) opts.onProgress?.({ phase, releaseId: m.release.id, filesDone: 0, filesTotal: 0, bytesDone: 0, bytesTotal: 0, ...p });
    };
    // 1. what is missing locally? (base-identical files and already-stored objects are free)
    const missing: ManifestFile[] = []; const seen = new Set<string>();
    const verifiedObjects = new Map<string, Uint8Array>();
    for (const f of m.files) {
      checkAbort(opts.signal);
      if (this.base.files[f.path] === f.sha256 || seen.has(f.sha256)) continue;
      seen.add(f.sha256);
      const stored = await this.storage.getObject(f.sha256);
      if (!stored || stored.byteLength !== f.bytes || await sha256Hex(stored) !== f.sha256) {
        if (stored) { await this.storage.deleteObject(f.sha256); throw new Reject('hash_mismatch', `stored object for ${f.path} is damaged; retry to download a clean copy`); }
        missing.push(f);
      } else {
        this.checkObject(f, stored);
        verifiedObjects.set(f.sha256, f.path.endsWith('.json') ? stored : new Uint8Array(0));
      }
    }
    await this.collect(new Set(m.files.map((f) => f.sha256)));
    const addBytes = missing.reduce((n, f) => n + f.bytes, 0);
    const estimate = await this.env.storageEstimate?.();
    let permitted = false;
    await this.storage.updateState(this.env.channel, (current) => {
      checkAbort(opts.signal);
      const partialBytes = missing.reduce((n, f) => n + (current.inventory?.[`partial:${f.sha256}`] ?? 0), 0);
      if (estimate?.quota !== undefined && estimate.usage !== undefined && estimate.quota - estimate.usage < Math.max(0, addBytes - partialBytes) * 1.2 + 8 * 1024 * 1024) throw new Reject('storage_quota', 'Device storage has insufficient headroom; existing content is retained.');
      const downloads = Object.fromEntries(Object.entries(current.downloads ?? {}).filter(([, r]) => r.expiresAt > Date.now()));
      downloads[owner] = { files: Object.fromEntries(missing.map((f) => [f.sha256, f.bytes])), expiresAt: Date.now() + 5 * 60_000 };
      const sizes = new Map<string, number>();
      for (const [key, bytes] of Object.entries(current.inventory ?? {})) {
        if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Reject('storage_state_invalid', 'content size accounting is invalid');
        const hash = key.replace(/^partial:/, ''); sizes.set(hash, (sizes.get(hash) ?? 0) + bytes);
      }
      for (const reservation of Object.values(downloads)) for (const [hash, bytes] of Object.entries(reservation.files)) sizes.set(hash, Math.max(sizes.get(hash) ?? 0, bytes));
      if ([...sizes.values()].reduce((a, b) => a + b, 0) > this.env.storageBudgetBytes) return null;
      permitted = true; return { ...current, downloads };
    });
    if (!permitted) throw new Reject('storage_budget', 'Active, previous, staged, partial and reserved content exceeds the device budget.');
    checkAbort(opts.signal);

    // 2. download + verify each object; completed objects survive an interruption (resume)
    let downloaded = 0;
    emit('downloading', { filesTotal: missing.length, bytesTotal: addBytes });
    for (const [i, f] of missing.entries()) {
      const bytes = await this.download(f, owner, opts.signal, (received) => emit('downloading', { filesDone: i, filesTotal: missing.length, bytesDone: downloaded + received, bytesTotal: addBytes }));
      checkAbort(opts.signal);
      await this.storage.putObject(f.sha256, bytes, owner);
      this.checkObject(f, bytes);
      verifiedObjects.set(f.sha256, f.path.endsWith('.json') ? bytes : new Uint8Array(0));
      downloaded += bytes.byteLength;
      emit('downloading', { filesDone: i + 1, filesTotal: missing.length, bytesDone: downloaded, bytesTotal: addBytes });
    }

    // 3. semantic validation of the complete file set, as it would be activated
    emit('verifying', { filesDone: missing.length, filesTotal: missing.length, bytesDone: downloaded, bytesTotal: addBytes });
    const files = new Map<string, Uint8Array>();
    for (const f of m.files) {
      if (this.base.files[f.path] === f.sha256) {
        if (f.path.endsWith('.json')) {
          const bytes = await this.base.read(f.path);
          if (!bytes) throw new Reject('download_failed', `object for ${f.path} vanished from storage`);
          if (bytes.byteLength !== f.bytes || (await sha256Hex(bytes)) !== f.sha256) throw new Reject('hash_mismatch', `stored object for ${f.path} is damaged`);
          this.checkObject(f, bytes);
          files.set(f.path, bytes);
        } else {
          files.set(f.path, new Uint8Array(0));
        }
        continue;
      }
      const cached = verifiedObjects.get(f.sha256);
      if (cached !== undefined && !f.path.endsWith('.json')) {
        files.set(f.path, cached);
        continue;
      }
      if (cached !== undefined && f.path.endsWith('.json') && cached.byteLength === f.bytes) {
        files.set(f.path, cached);
        continue;
      }
      const bytes = await this.storage.getObject(f.sha256);
      if (!bytes) throw new Reject('download_failed', `object for ${f.path} vanished from storage`);
      if (bytes.byteLength !== f.bytes || (await sha256Hex(bytes)) !== f.sha256) throw new Reject('hash_mismatch', `stored object for ${f.path} is damaged`);
      this.checkObject(f, bytes);
      files.set(f.path, f.path.endsWith('.json') ? bytes : new Uint8Array(0));
    }
    try {
      await this.env.validate(files, m, this.base);
      checkAbort(opts.signal);
    } catch (e) {
      checkAbort(opts.signal);
      await this.commit((current, mark) => ({ state: { ...current, denied: [...new Set([...current.denied, m.release.id])] }, highWater: mark }));
      throw new Reject('validation_failed', e instanceof Error ? e.message : String(e));
    }

    const next: ActiveRelease = {
      releaseId: m.release.id,
      generation: m.release.generation,
      manifest: m,
      activatedAt: (this.env.now?.() ?? new Date()).toISOString()
    };
    const stored = await this.commit((current, mark) => {
      checkAbort(opts.signal);
      if (m.release.generation < mark.generation || m.release.generation === mark.generation && !this.sameMark(mark, m) || current.denied.includes(m.release.id)) return null;
      const highWater = { generation: m.release.generation, releaseId: m.release.id, killed: false };
      return { state: opts.activate === false ? { ...current, staged: next } : { ...current, active: next, previous: current.active, staged: null }, highWater };
    });
    if (!stored) throw new Reject('stale_generation', 'a newer accepted generation won during the download');
    if (opts.activate === false) {
      // parked: the objects stay in storage (kept by collect) and the next start switches it on without a network
      return { status: 'staged', releaseId: next.releaseId, generation: next.generation, downloadedBytes: downloaded, downloadedFiles: missing.length };
    }

    // 4. atomic activation; the old active release becomes the rollback target
    emit('activating', { filesDone: missing.length, filesTotal: missing.length, bytesDone: addBytes, bytesTotal: addBytes });
    await this.collect(new Set(m.files.map((f) => f.sha256)));
    return { status: 'applied', releaseId: next.releaseId, generation: next.generation, downloadedBytes: downloaded, downloadedFiles: missing.length };
  }

  /**
   * Switches on the staged release without touching the network: every object must still be in storage and the semantic
   * validation runs again over the exact file set. Returns null when nothing is staged; a broken stage is dropped (never half-applied).
   */
  async activateStaged(onProgress?: ApplyOptions['onProgress'], signal?: AbortSignal): Promise<PatchOutcome | null> {
    const state = await this.state();
    checkAbort(signal);
    const staged = state.staged;
    if (!staged) return null;
    const m = staged.manifest;
    onProgress?.({ phase: 'activating', releaseId: m.release.id, filesDone: 0, filesTotal: m.files.length, bytesDone: 0, bytesTotal: 0 });
    try {
      await this.admit(m, state);
      const highest = await this.highWater();
      if (m.release.generation < highest.generation || m.release.generation === highest.generation && !this.sameMark(highest, m)) throw new Reject('stale_generation', 'staged release predates the greatest accepted generation');
      const currentGen = state.active?.generation ?? this.base.generation;
      if (m.release.generation <= currentGen || state.denied.includes(m.release.id)) throw new Reject('stale_generation', 'staged release is no longer newer than the active one');
      const files = new Map<string, Uint8Array>();
      for (const f of m.files) {
        if (this.base.files[f.path] === f.sha256 && !f.path.endsWith('.json')) {
          files.set(f.path, new Uint8Array(0));
          continue;
        }
        const bytes = this.base.files[f.path] === f.sha256 ? await this.base.read(f.path) : await this.storage.getObject(f.sha256);
        if (!bytes || bytes.byteLength !== f.bytes || (await sha256Hex(bytes)) !== f.sha256) throw new Reject('download_failed', `staged object for ${f.path} is missing or damaged`);
        this.checkObject(f, bytes);
        files.set(f.path, f.path.endsWith('.json') ? bytes : new Uint8Array(0));
      }
      await this.env.validate(files, m, this.base);
      checkAbort(signal);
    } catch (e) {
      if (signal?.aborted) throw signal.reason;
      await this.commit((current, mark) => ({ state: { ...current, staged: current.staged?.releaseId === staged.releaseId ? null : current.staged }, highWater: mark }));
      await this.collect();
      if (e instanceof Reject) return { status: 'rejected', reason: e.reason, detail: e.message };
      return { status: 'rejected', reason: 'validation_failed', detail: e instanceof Error ? e.message : String(e) };
    }
    const next: ActiveRelease = { ...staged, activatedAt: (this.env.now?.() ?? new Date()).toISOString() };
    const activated = await this.commit((current, mark) => {
      checkAbort(signal);
      if (current.staged?.releaseId !== next.releaseId || next.generation < mark.generation || next.generation === mark.generation && !this.sameMark(mark, m)) return null;
      return { state: { ...current, active: next, previous: current.active, staged: null }, highWater: { generation: next.generation, releaseId: next.releaseId, killed: false } };
    });
    if (!activated) return { status: 'rejected', reason: 'stale_generation', detail: 'staged authority changed before activation' };
    await this.collect();
    return { status: 'applied', releaseId: next.releaseId, generation: next.generation, downloadedBytes: 0, downloadedFiles: 0 };
  }

  private checkObject(file: ManifestFile, bytes: Uint8Array): void {
    try { this.env.validateObject?.(file, bytes); }
    catch (error) { throw new Reject('validation_failed', error instanceof Error ? error.message : 'media exceeds the supported resource contract'); }
  }

  private async download(f: ManifestFile, owner: string, signal: AbortSignal | undefined, onBytes?: (received: number) => void): Promise<Uint8Array> {
    const attempts = this.env.maxAttempts ?? 3;
    const sleep = this.env.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    let last = 'unknown';
    for (let i = 1; i <= attempts; i++) {
      try {
        checkAbort(signal);
        const saved = await this.storage.getObject(`partial:${f.sha256}`);
        const partial = saved && saved.byteLength < f.bytes ? saved : undefined;
        const bytes = await interrupted(this.remote.fetchObject(f.sha256, f, onBytes, { signal, partial, onPartial: async (prefix) => { checkAbort(signal); await this.storage.putObject(`partial:${f.sha256}`, prefix, owner); } }), signal);
        checkAbort(signal);
        if (bytes.byteLength !== f.bytes) {
          last = `size ${bytes.byteLength} != ${f.bytes}`;
        } else if ((await sha256Hex(bytes)) !== f.sha256) {
          last = 'sha256 mismatch';
          await this.storage.deleteObject(`partial:${f.sha256}`);
        } else {
          return bytes;
        }
      } catch (e) {
        checkAbort(signal);
        if (e instanceof Error && e.name === 'QuotaExceededError') throw e;
        last = String(e);
      }
      if (i < attempts) await interrupted(sleep(250 * 2 ** (i - 1)), signal);
    }
    throw new Reject(last.includes('mismatch') || last.startsWith('size') ? 'hash_mismatch' : 'download_failed', `${f.path}: ${last}`);
  }

  /** GC and reservations share the same storage transaction as the pointer snapshot. */
  private async collect(extra = new Set<string>()): Promise<void> {
    const raw = await this.storage.getState(); const st = await this.validState(raw);
    const keep = new Set(extra);
    for (const r of [st.active, st.previous, st.staged]) for (const f of r?.manifest.files ?? []) keep.add(f.sha256);
    await this.storage.updateState(this.env.channel, (current) => {
      if (JSON.stringify(current.state) !== JSON.stringify(raw)) return null;
      for (const reservation of Object.values(current.downloads ?? {})) if (reservation.expiresAt > Date.now()) for (const hash of Object.keys(reservation.files)) keep.add(hash);
      return { ...current, removeObjects: Object.keys(current.inventory ?? {}).filter((key) => !keep.has(key.replace(/^partial:/, ''))) };
    });
  }
}

function checkAbort(signal?: AbortSignal): void { if (signal?.aborted) throw signal.reason instanceof Reject ? signal.reason : new Reject('cancelled', 'download cancelled'); }
function interrupted<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason instanceof Reject ? signal.reason : new Reject('cancelled', 'download cancelled'));
    if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
