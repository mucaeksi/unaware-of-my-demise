import type { ChapterIndex } from '@uomd/content-schema';
import type { StorySave } from '@uomd/story';
import { changeContinuity, loadContinuity, type Cursor, type CursorInput, type StoryMark } from './continuity';

const READ_PREFIX = 'uomd.read.v1:';
const PROLOGUE_PREFIX = 'uomd.prologue.checkpoint.v1:';

export type CampaignNode = ChapterIndex['chapters'][number]['nodes'][number];
export type StoryCheckpointRecord = StoryMark;
/** the flow step to resume (R09 continuity cursor) */
export type FlowCheckpoint = Cursor;
export type FlowCheckpointInput = CursorInput;

export function loadReadLines(accountKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${READ_PREFIX}${accountKey}`);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function saveReadLines(accountKey: string, read: Set<string>): void {
  try {
    localStorage.setItem(`${READ_PREFIX}${accountKey}`, JSON.stringify([...read].slice(-4000)));
  } catch {
    /* ignore */
  }
}

export function loadPrologueCheckpoint(accountKey: string, maxScenes?: number): number | null {
  try {
    const raw = localStorage.getItem(`${PROLOGUE_PREFIX}${accountKey}`);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o !== 'object' || o === null || typeof o.index !== 'number' || !Number.isInteger(o.index) || o.index < 0) return null;
    if (maxScenes !== undefined && o.index >= maxScenes) return null;
    return o.index;
  } catch {
    return null;
  }
}

export function savePrologueCheckpoint(accountKey: string, index: number, now = new Date().toISOString()): void {
  try {
    localStorage.setItem(`${PROLOGUE_PREFIX}${accountKey}`, JSON.stringify({ index: Math.max(0, Math.floor(index)), updatedAt: now }));
  } catch {
    /* ignore */
  }
}

export function clearPrologueCheckpoint(accountKey: string): void {
  try {
    localStorage.removeItem(`${PROLOGUE_PREFIX}${accountKey}`);
  } catch {
    /* ignore */
  }
}

/** A mid-scene mark for this scene, or null when there is none or the installed scene changed since (it restarts). */
export function loadStoryCheckpoint(accountKey: string, path: string, sceneId: string, sceneHash?: string): StoryCheckpointRecord | null {
  const m = loadContinuity(accountKey).stories[path];
  if (!m || m.sceneId !== sceneId) return null;
  if (sceneHash && m.sceneHash && m.sceneHash !== sceneHash) return null;
  return m;
}

export function saveStoryCheckpoint(
  accountKey: string,
  input: { path: string; sceneId: string; sceneHash?: string; checkpointId?: string; state: StorySave },
  now = new Date().toISOString()
): void {
  const mark: StoryMark = {
    path: input.path,
    sceneId: input.sceneId,
    ...(input.sceneHash ? { sceneHash: input.sceneHash } : {}),
    ...(input.checkpointId !== undefined ? { checkpointId: input.checkpointId } : {}),
    state: input.state,
    updatedAt: now
  };
  changeContinuity(accountKey, (c) => ({ cursor: c.cursor, stories: { ...c.stories, [input.path]: mark } }), false, now);
}

export function clearStoryCheckpoint(accountKey: string, path: string): void {
  if (!(path in loadContinuity(accountKey).stories)) return;
  changeContinuity(accountKey, (c) => {
    const { [path]: _gone, ...stories } = c.stories;
    return { cursor: c.cursor, stories };
  });
}

export function loadFlowCheckpoint(accountKey: string): FlowCheckpoint | null {
  return loadContinuity(accountKey).cursor;
}

export function saveFlowCheckpoint(accountKey: string, input: FlowCheckpointInput, now = new Date().toISOString()): FlowCheckpoint {
  const cursor: Cursor = { ...input, updatedAt: now };
  changeContinuity(accountKey, (c) => ({ cursor, stories: c.stories }), true, now);
  return cursor;
}

export function clearFlowCheckpoint(accountKey: string): void {
  if (!loadContinuity(accountKey).cursor) return;
  changeContinuity(accountKey, (c) => ({ cursor: null, stories: c.stories }), true);
}

/**
 * The node Continue resumes: the cursor's node while it still exists in the installed content (whatever step it was at;
 * playNode reconciles a battle or story that was already committed on the server), else the first unfinished playable
 * node. The entry tutorial chapter is skipped whenever main campaign chapters are installed, so after the first restart
 * Continue enters Part I and tutorial replay stays a separate action.
 */
export function resolveNextCampaignNode(index: ChapterIndex, progress: Record<string, { stars: number }>, accountKey = 'guest'): CampaignNode | null {
  const allNodes = index.chapters.flatMap((ch) => ch.nodes);
  const cp = loadFlowCheckpoint(accountKey);
  if (cp?.kind === 'campaign') {
    const resumed = allNodes.find((n) => n.node_id === cp.nodeId);
    if (resumed) return resumed;
  }
  const campaignChapters = index.chapters.filter((ch) => ch.chapter_id !== 'tutorial');
  const pool = (campaignChapters.length > 0 ? campaignChapters : index.chapters).flatMap((ch) => ch.nodes);
  const nextUnfinished = pool.find((n) => !progress[n.node_id] && (!n.requires || Boolean(progress[n.requires])));
  return nextUnfinished ?? pool[0] ?? null;
}
