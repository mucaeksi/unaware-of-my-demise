import type { ChapterIndex } from '@uomd/content-schema';
import type { StorySave } from '@uomd/story';

const READ_PREFIX = 'uomd.read.v1:';
const PROLOGUE_PREFIX = 'uomd.prologue.checkpoint.v1:';
const STORY_PREFIX = 'uomd.story.checkpoint.v1:';
const FLOW_PREFIX = 'uomd.flow.checkpoint.v1:';

export type CampaignNode = ChapterIndex['chapters'][number]['nodes'][number];

export interface StoryCheckpointRecord {
  path: string;
  sceneId: string;
  checkpointId?: string;
  state: StorySave;
  updatedAt: string;
}

export type FlowCheckpoint =
  | { kind: 'tutorial'; index: 1 | 2 | 3; step: 'pre_story' | 'battle' | 'post_story'; updatedAt: string }
  | { kind: 'campaign'; nodeId: string; step: 'pre_story' | 'battle' | 'post_story'; stars?: number; updatedAt: string };

export type FlowCheckpointInput =
  | { kind: 'tutorial'; index: 1 | 2 | 3; step: 'pre_story' | 'battle' | 'post_story' }
  | { kind: 'campaign'; nodeId: string; step: 'pre_story' | 'battle' | 'post_story'; stars?: number };

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

function loadStoryMap(accountKey: string): Record<string, StoryCheckpointRecord> {
  try {
    const raw = localStorage.getItem(`${STORY_PREFIX}${accountKey}`);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    return typeof o === 'object' && o !== null && !Array.isArray(o) ? (o as Record<string, StoryCheckpointRecord>) : {};
  } catch {
    return {};
  }
}

export function loadStoryCheckpoint(accountKey: string, path: string, sceneId: string): StoryCheckpointRecord | null {
  const map = loadStoryMap(accountKey);
  const rec = map[path];
  if (!rec || typeof rec !== 'object' || rec.sceneId !== sceneId || !rec.state || rec.state.sceneId !== sceneId) return null;
  if (typeof rec.state.index !== 'number' || !Array.isArray(rec.state.choices)) return null;
  return rec;
}

export function saveStoryCheckpoint(
  accountKey: string,
  input: { path: string; sceneId: string; checkpointId?: string; state: StorySave },
  now = new Date().toISOString()
): void {
  try {
    const map = loadStoryMap(accountKey);
    const rec: StoryCheckpointRecord = {
      path: input.path,
      sceneId: input.sceneId,
      ...(input.checkpointId !== undefined ? { checkpointId: input.checkpointId } : {}),
      state: input.state,
      updatedAt: now
    };
    map[input.path] = rec;
    localStorage.setItem(`${STORY_PREFIX}${accountKey}`, JSON.stringify(map));
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('uomd.story.checkpoint.v1', JSON.stringify({ accountKey, ...rec }));
    }
  } catch {
    /* ignore */
  }
}

export function clearStoryCheckpoint(accountKey: string, path: string): void {
  try {
    const map = loadStoryMap(accountKey);
    if (!(path in map)) return;
    delete map[path];
    localStorage.setItem(`${STORY_PREFIX}${accountKey}`, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function loadFlowCheckpoint(accountKey: string): FlowCheckpoint | null {
  try {
    const raw = localStorage.getItem(`${FLOW_PREFIX}${accountKey}`);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o !== 'object' || o === null) return null;
    const step = o.step;
    if (step !== 'pre_story' && step !== 'battle' && step !== 'post_story') return null;
    const updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt : new Date(0).toISOString();
    if (o.kind === 'tutorial' && (o.index === 1 || o.index === 2 || o.index === 3)) {
      return { kind: 'tutorial', index: o.index, step, updatedAt };
    }
    if (o.kind === 'campaign' && typeof o.nodeId === 'string' && o.nodeId.length > 0) {
      return {
        kind: 'campaign',
        nodeId: o.nodeId,
        step,
        ...(typeof o.stars === 'number' ? { stars: o.stars } : {}),
        updatedAt
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveFlowCheckpoint(accountKey: string, input: FlowCheckpointInput, now = new Date().toISOString()): FlowCheckpoint {
  const cp: FlowCheckpoint = { ...input, updatedAt: now };
  try {
    localStorage.setItem(`${FLOW_PREFIX}${accountKey}`, JSON.stringify(cp));
  } catch {
    /* ignore */
  }
  return cp;
}

export function clearFlowCheckpoint(accountKey: string): void {
  try {
    localStorage.removeItem(`${FLOW_PREFIX}${accountKey}`);
  } catch {
    /* ignore */
  }
}

/**
 * Resolves the next playable campaign node from authoritative progress and any active mid-node FlowCheckpoint.
 * Excludes the entry tutorial chapter whenever main campaign chapters are installed so post-restart Continue enters Part I.
 */
export function resolveNextCampaignNode(
  index: ChapterIndex,
  progress: Record<string, { stars: number }>,
  accountKey = 'guest'
): CampaignNode | null {
  const allNodes = index.chapters.flatMap((ch) => ch.nodes);
  const cp = loadFlowCheckpoint(accountKey);
  if (cp?.kind === 'campaign') {
    const resumed = allNodes.find((n) => n.node_id === cp.nodeId);
    if (resumed && (cp.step === 'post_story' || !progress[resumed.node_id])) {
      return resumed;
    }
  }
  const campaignChapters = index.chapters.filter((ch) => ch.chapter_id !== 'tutorial');
  const pool = (campaignChapters.length > 0 ? campaignChapters : index.chapters).flatMap((ch) => ch.nodes);
  const nextUnfinished = pool.find((n) => !progress[n.node_id] && (!n.requires || Boolean(progress[n.requires])));
  return nextUnfinished ?? pool[0] ?? null;
}

