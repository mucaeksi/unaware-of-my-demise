import type { ContentStorage, PatchState } from './types';

/** In-memory storage for tests and for browsers without IndexedDB. */
export class MemoryStorage implements ContentStorage {
  readonly objects = new Map<string, Uint8Array>();
  state: PatchState | null = null;
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
}
