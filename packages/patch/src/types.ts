import type { ContentManifest, Channel, ManifestFile } from '@uomd/content-schema';
import type { PublicKeyJwk } from '@uomd/shared';

export interface ActiveRelease {
  releaseId: string;
  generation: number;
  manifest: ContentManifest;
  activatedAt: string;
}

/** Everything the patch manager persists. It is written with a single atomic put. */
export interface PatchState {
  schema: 1;
  active: ActiveRelease | null;
  previous: ActiveRelease | null;
  /** a release that is fully downloaded, verified and validated but not yet switched on (it activates at the next start) */
  staged?: ActiveRelease | null;
  /** releases that failed validation or crashed on activation; never auto-applied again */
  denied: string[];
}

/** Independent of the overlay state, so rollback or a lost state record cannot erase accepted authority. */
export interface GenerationMark {
  generation: number;
  releaseId: string;
  killed: boolean;
}

export interface DownloadReservation { files: Record<string, number>; expiresAt: number }

export interface StorageSnapshot {
  inventory?: Record<string, number>;
  downloads?: Record<string, DownloadReservation>;
  removeObjects?: string[];
  state: PatchState | null;
  highWater: GenerationMark | null;
}

export interface ContentStorage {
  getObject(sha256: string): Promise<Uint8Array | null>;
  putObject(sha256: string, bytes: Uint8Array, reservation?: string): Promise<void>;
  hasObject(sha256: string): Promise<boolean>;
  listObjects(): Promise<string[]>;
  deleteObject(sha256: string): Promise<void>;
  getState(): Promise<PatchState | null>;
  /** MUST be atomic: readers see either the old or the new state, never a mix. */
  setState(state: PatchState): Promise<void>;
  getHighWater(channel: Channel): Promise<GenerationMark | null>;
  /** Reads current state/mark and commits both atomically. The callback is synchronous; null makes no change. */
  updateState(channel: Channel, change: (current: StorageSnapshot) => StorageSnapshot | null): Promise<boolean>;
}

export interface RemoteSource {
  /** latest published manifest for a channel, or null when none is published (HTTP 404) */
  fetchManifest(channel: Channel, signal?: AbortSignal): Promise<unknown | null>;
  /** `onBytes` (optional) reports the bytes received so far of this object, for a smooth progress bar. */
  fetchObject(sha256: string, file: ManifestFile, onBytes?: (received: number) => void, options?: { signal?: AbortSignal; partial?: Uint8Array; onPartial?: (bytes: Uint8Array) => Promise<void> }): Promise<Uint8Array>;
}

export interface BaseContent {
  releaseId: string;
  generation: number;
  /** path -> sha256 of the file shipped inside the app binary */
  files: Record<string, string>;
  read(path: string): Promise<Uint8Array>;
}

export interface PatchEnv {
  channel: Channel;
  /** binary version of this client, compared with manifest.compat */
  clientVersion: string;
  /** highest content schema version this client's code understands */
  supportedContentSchema: number;
  supportedCapabilities?: readonly string[];
  trustedKeys: readonly PublicKeyJwk[];
  /** stable random install id; drives percentage rollout buckets */
  installId: string;
  /** max extra bytes a patch may add to storage (mobile storage budget) */
  storageBudgetBytes: number;
  /** semantic validation of the downloaded content (schemas + cross references). Throw to reject. */
  validate(files: Map<string, Uint8Array>, manifest: ContentManifest, base: BaseContent): Promise<void> | void;
  /** Optional synchronous media header/resource checks, before activation, without retaining full media. */
  validateObject?(file: ManifestFile, bytes: Uint8Array): void;
  maxAttempts?: number;
  sleep?(ms: number): Promise<void>;
  now?(): Date;
  storageEstimate?(): Promise<{ usage?: number; quota?: number }>;
  networkPolicy?(): 'online' | 'offline' | 'metered';
  downloadTimeoutMs?: number;
}

export type PatchPhase = 'checking' | 'downloading' | 'verifying' | 'activating';

/** Progress snapshot handed to `onProgress`; totals are known from the signed manifest once the check has passed. */
export interface PatchProgress {
  phase: PatchPhase;
  releaseId: string | null;
  filesDone: number;
  filesTotal: number;
  bytesDone: number;
  bytesTotal: number;
}

export interface ApplyOptions {
  signal?: AbortSignal;
  allowMetered?: boolean;
  onProgress?: (p: PatchProgress) => void;
  /** false: download, verify and validate, then park the release as `staged` (switched on later by `activateStaged`). Default true. */
  activate?: boolean;
}

export type PatchOutcome =
  | { status: 'up_to_date'; releaseId: string | null }
  | { status: 'applied'; releaseId: string; generation: number; downloadedBytes: number; downloadedFiles: number }
  | { status: 'staged'; releaseId: string; generation: number; downloadedBytes: number; downloadedFiles: number }
  | { status: 'reverted_to_base'; reason: 'kill_switch' }
  | { status: 'offline'; detail: string }
  | { status: 'rejected'; reason: RejectReason; detail: string };

export type RejectReason =
  | 'capability_missing'
  | 'cancelled'
  | 'download_timeout'
  | 'network_policy'
  | 'storage_quota'
  | 'malformed_manifest'
  | 'bad_signature'
  | 'wrong_channel'
  | 'client_too_old'
  | 'client_too_new'
  | 'schema_too_new'
  | 'dependency_mismatch'
  | 'stale_generation'
  | 'denied_release'
  | 'storage_budget'
  | 'download_failed'
  | 'hash_mismatch'
  | 'validation_failed'
  | 'storage_busy'
  | 'storage_state_invalid';
