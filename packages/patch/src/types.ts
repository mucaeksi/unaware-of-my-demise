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
  /** releases that failed validation or crashed on activation; never auto-applied again */
  denied: string[];
}

export interface ContentStorage {
  getObject(sha256: string): Promise<Uint8Array | null>;
  putObject(sha256: string, bytes: Uint8Array): Promise<void>;
  hasObject(sha256: string): Promise<boolean>;
  listObjects(): Promise<string[]>;
  deleteObject(sha256: string): Promise<void>;
  getState(): Promise<PatchState | null>;
  /** MUST be atomic: readers see either the old or the new state, never a mix. */
  setState(state: PatchState): Promise<void>;
}

export interface RemoteSource {
  /** latest published manifest for a channel, or null when none is published (HTTP 404) */
  fetchManifest(channel: Channel): Promise<unknown | null>;
  fetchObject(sha256: string, file: ManifestFile): Promise<Uint8Array>;
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
  trustedKeys: readonly PublicKeyJwk[];
  /** stable random install id; drives percentage rollout buckets */
  installId: string;
  /** max extra bytes a patch may add to storage (mobile storage budget) */
  storageBudgetBytes: number;
  /** semantic validation of the downloaded content (schemas + cross references). Throw to reject. */
  validate(files: Map<string, Uint8Array>, manifest: ContentManifest, base: BaseContent): Promise<void> | void;
  maxAttempts?: number;
  sleep?(ms: number): Promise<void>;
  now?(): Date;
}

export type PatchOutcome =
  | { status: 'up_to_date'; releaseId: string | null }
  | { status: 'applied'; releaseId: string; generation: number; downloadedBytes: number; downloadedFiles: number }
  | { status: 'reverted_to_base'; reason: 'kill_switch' }
  | { status: 'offline'; detail: string }
  | { status: 'rejected'; reason: RejectReason; detail: string };

export type RejectReason =
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
  | 'validation_failed';
