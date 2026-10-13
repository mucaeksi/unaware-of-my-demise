import type { Channel } from '@uomd/content-schema';
import type { ContentStorage, GenerationMark, PatchState, StorageSnapshot } from './types';

/** In-memory storage for tests and for browsers without IndexedDB. */
export class MemoryStorage implements ContentStorage {
  readonly objects = new Map<string, Uint8Array>();
  state: PatchState | null = null;
  readonly highWater = new Map<Channel, GenerationMark>();
  async getObject(sha: string): Promise<Uint8Array | null> {
    return this.objects.get(sha) ?? null;
  }
  async putObject(sha: string, bytes: Uint8Array): Promise<void> {
    this.objects.set(sha, bytes);
  }
  async hasObject(sha: string): Promise<boolean> {
    return this.objects.has(sha);
  }
  async listObjects(): Promise<string[]> {
    return [...this.objects.keys()];
  }
  async deleteObject(sha: string): Promise<void> {
    this.objects.delete(sha);
  }
  async getState(): Promise<PatchState | null> {
    return this.state ? structuredClone(this.state) : null;
  }
  async setState(s: PatchState): Promise<void> {
    this.state = structuredClone(s);
  }
  async getHighWater(channel: Channel): Promise<GenerationMark | null> {
    return structuredClone(this.highWater.get(channel) ?? null);
  }
  async updateState(channel: Channel, change: (current: StorageSnapshot) => StorageSnapshot | null): Promise<boolean> {
    // No await between read/modify/write: competing managers cannot commit over one another.
    const next = change({ state: structuredClone(this.state), highWater: structuredClone(this.highWater.get(channel) ?? null) });
    if (!next) return false;
    this.state = structuredClone(next.state);
    if (next.highWater) this.highWater.set(channel, structuredClone(next.highWater));
    return true;
  }
}
