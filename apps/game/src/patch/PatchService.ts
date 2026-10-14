import type { ApplyOptions, PatchOutcome, PatchProgress } from '@uomd/patch';

/** What the bar and the finish page render. `ready` also covers "nothing newer is published": there is nothing left to wait for. */
export type PatchStatus =
  | { kind: 'idle' }
  | { kind: 'running'; progress: PatchProgress | null }
  | { kind: 'ready'; outcome: PatchOutcome }
  | { kind: 'failed'; detail: string; updateRequired: boolean; requiresNetworkApproval?: boolean };

/** The slice of ContentService the first-install download needs (a fake in tests). */
export interface PatchSource {
  readonly persistent?: boolean;
  checkForUpdates(opts?: ApplyOptions): Promise<PatchOutcome>;
}

type Listener = (s: PatchStatus) => void;

/**
 * Background download of the content patch during the first-install flow. It downloads, verifies and validates but only STAGES the
 * release (see PatchManager.activateStaged): the story and tutorial keep running on the content they started with, and the restart at
 * the end switches the new content on without any network. Safe to call `start()` repeatedly; a failed run is retried by the player.
 */
export class PatchService {
  private status: PatchStatus = { kind: 'idle' };
  private readonly listeners = new Set<Listener>();
  private run: Promise<PatchStatus> | null = null;
  private controller: AbortController | null = null;
  private allowMetered = false;

  constructor(private readonly source: () => PatchSource | null) {}

  get(): PatchStatus {
    return this.status;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private set(s: PatchStatus): void {
    this.status = s;
    for (const fn of [...this.listeners]) fn(s);
  }

  /** Starts the download unless it is running or already complete. Resolves with the final status. */
  start(): Promise<PatchStatus> {
    if (this.run) return this.run;
    if (this.status.kind === 'ready') return Promise.resolve(this.status);
    this.run = this.execute().finally(() => {
      this.run = null;
    });
    return this.run;
  }

  cancel(): void { this.controller?.abort(); }

  retry(opts: Pick<ApplyOptions, 'allowMetered'> = {}): Promise<PatchStatus> {
    if (opts.allowMetered !== undefined) this.allowMetered = opts.allowMetered;
    if (this.status.kind === 'failed') this.status = { kind: 'idle' };
    return this.start();
  }

  private async execute(): Promise<PatchStatus> {
    const source = this.source();
    if (!source) {
      this.set({ kind: 'failed', detail: 'content service is not ready', updateRequired: false });
      return this.status;
    }
    this.controller = new AbortController();
    this.set({ kind: 'running', progress: null });
    let outcome: PatchOutcome;
    try {
      outcome = await source.checkForUpdates({ activate: false, signal: this.controller.signal, allowMetered: this.allowMetered, onProgress: (p) => this.set({ kind: 'running', progress: p }) });
    } catch (e) {
      this.set({ kind: 'failed', detail: e instanceof Error ? e.message : String(e), updateRequired: false });
      return this.status;
    }
    switch (outcome.status) {
      case 'staged':
        if (source.persistent === false) { this.set({ kind: 'failed', detail: 'Local storage is unavailable. Enable device storage and restart before entering the downloaded content.', updateRequired: false }); break; }
        this.set({ kind: 'ready', outcome }); break;
      case 'applied':
      case 'up_to_date':
      case 'reverted_to_base':
        this.set({ kind: 'ready', outcome });
        break;
      case 'offline':
        this.set({ kind: 'failed', detail: 'no connection', updateRequired: false });
        break;
      case 'rejected':
        // a release this app can never apply (too new for the binary) needs an app update, not a retry
        this.set({ kind: 'failed', detail: outcome.detail, ...(outcome.reason === 'network_policy' ? { requiresNetworkApproval: true } : {}), updateRequired: outcome.reason === 'client_too_old' || outcome.reason === 'schema_too_new' || outcome.reason === 'capability_missing' });
        break;
    }
    return this.status;
  }
}
