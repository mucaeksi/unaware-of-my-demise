import type { StorySave } from '@uomd/story';

/**
 * R09 continuity contract, version 1: where an account is in the story, kept on the device and in the account's cloud
 * save (`/api/v1/save`, key `continuity`). It is presentation state only: clears, stars and rewards stay
 * server-authoritative (battle claims and story completions go through the journaled operations).
 *
 * - `cursor`: the flow step to resume (tutorial or campaign node; pre-story, battle or post-story).
 * - `stories`: mid-scene marks per story path (StoryRunner save, bound to the scene's content hash).
 * - `seq`: bumped by every local change; the higher `seq` wins between device and cloud (ties: later `updatedAt`).
 *
 * Rules: an account's record never leaves its key (device) or player (cloud); a mark whose scene hash no longer matches
 * the installed content restarts that scene from its beginning (the cursor stays); a cursor whose node no longer exists
 * falls back to the next playable node; storage loss falls back to the cloud copy, then to authoritative progress.
 */
export const CONTINUITY_VERSION = 1;
export type FlowStep = 'pre_story' | 'battle' | 'post_story';
export type CursorInput =
  | { kind: 'tutorial'; index: 1 | 2 | 3; step: FlowStep }
  | { kind: 'campaign'; nodeId: string; step: FlowStep; stars?: number };
export type Cursor = CursorInput & { updatedAt: string };

export interface StoryMark {
  path: string;
  sceneId: string;
  /** sha-256 of the scene's canonical JSON when it was saved */
  sceneHash?: string;
  checkpointId?: string;
  state: StorySave;
  updatedAt: string;
}

export interface Continuity {
  v: typeof CONTINUITY_VERSION;
  seq: number;
  releaseId: string | null;
  cursor: Cursor | null;
  stories: Record<string, StoryMark>;
  updatedAt: string;
}

const KEY = 'uomd.continuity.v1:';
const LEGACY_FLOW = 'uomd.flow.checkpoint.v1:';
const LEGACY_STORY = 'uomd.story.checkpoint.v1:';
const MAX_STORIES = 8;
const EPOCH = new Date(0).toISOString();

export const emptyContinuity = (): Continuity => ({ v: CONTINUITY_VERSION, seq: 0, releaseId: null, cursor: null, stories: {}, updatedAt: EPOCH });

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown, max = 200): x is string => typeof x === 'string' && x.length > 0 && x.length <= max;
const isStep = (x: unknown): x is FlowStep => x === 'pre_story' || x === 'battle' || x === 'post_story';

export function parseCursor(raw: unknown): Cursor | null {
  if (!isObj(raw) || !isStep(raw.step)) return null;
  const updatedAt = str(raw.updatedAt, 40) ? raw.updatedAt : EPOCH;
  if (raw.kind === 'tutorial' && (raw.index === 1 || raw.index === 2 || raw.index === 3)) return { kind: 'tutorial', index: raw.index, step: raw.step, updatedAt };
  if (raw.kind === 'campaign' && str(raw.nodeId, 80)) {
    return {
      kind: 'campaign',
      nodeId: raw.nodeId,
      step: raw.step,
      ...(typeof raw.stars === 'number' && Number.isInteger(raw.stars) && raw.stars >= 0 && raw.stars <= 3 ? { stars: raw.stars } : {}),
      updatedAt
    };
  }
  return null;
}

function parseSave(raw: unknown): StorySave | null {
  if (!isObj(raw) || !str(raw.sceneId) || typeof raw.index !== 'number' || !Number.isInteger(raw.index) || raw.index < 0 || !Array.isArray(raw.choices)) return null;
  if (!raw.choices.every((c) => typeof c === 'string')) return null;
  const flags = isObj(raw.flags) && Object.values(raw.flags).every((v) => typeof v === 'boolean') ? (raw.flags as Record<string, boolean>) : undefined;
  return { sceneId: raw.sceneId, index: raw.index, choices: raw.choices as string[], ...(flags ? { flags } : {}) };
}

export function parseMark(raw: unknown): StoryMark | null {
  if (!isObj(raw) || !str(raw.path) || !str(raw.sceneId)) return null;
  const state = parseSave(raw.state);
  if (!state || state.sceneId !== raw.sceneId) return null;
  return {
    path: raw.path,
    sceneId: raw.sceneId,
    ...(str(raw.sceneHash, 80) ? { sceneHash: raw.sceneHash } : {}),
    ...(str(raw.checkpointId) ? { checkpointId: raw.checkpointId } : {}),
    state,
    updatedAt: str(raw.updatedAt, 40) ? raw.updatedAt : EPOCH
  };
}

/** Defensive parse: another version, a tampered or truncated record is ignored (never thrown). */
export function parseContinuity(raw: unknown): Continuity | null {
  if (!isObj(raw) || raw.v !== CONTINUITY_VERSION || typeof raw.seq !== 'number' || !Number.isSafeInteger(raw.seq) || raw.seq < 0) return null;
  const stories: Record<string, StoryMark> = {};
  if (isObj(raw.stories)) for (const m of Object.values(raw.stories).map(parseMark)) if (m) stories[m.path] = m;
  return {
    v: CONTINUITY_VERSION,
    seq: raw.seq,
    releaseId: str(raw.releaseId, 48) ? raw.releaseId : null,
    cursor: parseCursor(raw.cursor),
    stories: trimStories(stories),
    updatedAt: str(raw.updatedAt, 40) ? raw.updatedAt : EPOCH
  };
}

function trimStories(stories: Record<string, StoryMark>): Record<string, StoryMark> {
  const kept = Object.values(stories).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_STORIES);
  return Object.fromEntries(kept.map((m) => [m.path, m]));
}

/** The record to keep when a device and the cloud disagree. */
export function newer(a: Continuity, b: Continuity): Continuity {
  if (a.seq !== b.seq) return a.seq > b.seq ? a : b;
  return a.updatedAt >= b.updatedAt ? a : b;
}

function read(storageKey: string): unknown {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** pre-R09 builds kept the flow step and a per-path story map under separate keys: fold them in once */
function migrateLegacy(accountKey: string): Continuity | null {
  const flow = parseCursor(read(`${LEGACY_FLOW}${accountKey}`));
  const legacyStories = read(`${LEGACY_STORY}${accountKey}`);
  const stories: Record<string, StoryMark> = {};
  if (isObj(legacyStories)) for (const m of Object.values(legacyStories).map(parseMark)) if (m) stories[m.path] = m;
  try {
    localStorage.removeItem(`${LEGACY_FLOW}${accountKey}`);
    localStorage.removeItem(`${LEGACY_STORY}${accountKey}`);
  } catch {
    /* ignore */
  }
  if (!flow && Object.keys(stories).length === 0) return null;
  return { ...emptyContinuity(), seq: 1, cursor: flow, stories: trimStories(stories), updatedAt: new Date().toISOString() };
}

let release: string | null = null;
/** the content release in use; stamped on every change so a record says which content it was written against */
export function noteRelease(id: string | null): void {
  release = id;
}

type Push = (accountKey: string, urgent: boolean) => void;
let push: Push | null = null;
/** installed by the app shell: sends changed records to the account's cloud save (tests leave it unset) */
export function onContinuityChange(fn: Push | null): void {
  push = fn;
}

export function loadContinuity(accountKey: string): Continuity {
  const stored = parseContinuity(read(`${KEY}${accountKey}`));
  if (stored) return stored;
  const migrated = migrateLegacy(accountKey);
  if (migrated) storeContinuity(accountKey, migrated);
  return migrated ?? emptyContinuity();
}

/** writes a record as-is (cloud adoption keeps the remote `seq`) */
export function storeContinuity(accountKey: string, c: Continuity): void {
  try {
    localStorage.setItem(`${KEY}${accountKey}`, JSON.stringify(c));
  } catch {
    /* storage full or blocked: the cloud copy and authoritative progress still recover the player */
  }
}

/** applies a local change: bumps `seq`, stamps time and release, and asks for a cloud push (urgent for cursor moves) */
export function changeContinuity(accountKey: string, change: (c: Continuity) => Pick<Continuity, 'cursor' | 'stories'>, urgent = false, now = new Date().toISOString()): Continuity {
  const cur = loadContinuity(accountKey);
  const next = change(cur);
  const rec: Continuity = { ...cur, ...next, stories: trimStories(next.stories), seq: cur.seq + 1, releaseId: release ?? cur.releaseId, updatedAt: now };
  storeContinuity(accountKey, rec);
  push?.(accountKey, urgent);
  return rec;
}

/** The slice of the API client cloud sync needs (a fake in tests). Writes are not journaled: a lost push is repaired by the next sync. */
export interface ContinuityApi {
  readonly signedIn: boolean;
  readSave(): Promise<{ version: number; data: Record<string, unknown> }>;
  writeSaveDirect(expectedVersion: number, data: Record<string, unknown>): Promise<{ version: number }>;
}

/**
 * Reconciles the device with the account's cloud save: the newer record wins on both sides. Other keys of the cloud save are
 * preserved; a concurrent write from another device (409) is re-read and merged once more.
 */
export async function syncContinuity(api: ContinuityApi, accountKey: string): Promise<'synced' | 'offline' | 'signed_out'> {
  if (!api.signedIn) return 'signed_out';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const remote = await api.readSave();
      const cloud = parseContinuity(remote.data.continuity);
      const local = loadContinuity(accountKey);
      if (cloud && cloud.seq === local.seq && cloud.updatedAt === local.updatedAt) return 'synced';
      if (cloud && newer(cloud, local) === cloud) {
        storeContinuity(accountKey, cloud);
        return 'synced';
      }
      if (local.seq === 0) return 'synced'; // nothing on this device to share
      await api.writeSaveDirect(remote.version, { ...remote.data, continuity: local });
      return 'synced';
    } catch (e) {
      if ((e as { code?: string }).code === 'save_conflict') continue;
      return 'offline';
    }
  }
  return 'offline';
}
