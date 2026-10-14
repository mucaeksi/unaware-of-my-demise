import { MemoryStorage, type ContentStorage, type GenerationMark, type PatchState, type StorageSnapshot, type DownloadReservation } from '@uomd/patch';
import type { Channel } from '@uomd/content-schema';

const DB = 'uomd-content';
const OBJECTS = 'objects';
const META = 'meta';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** IndexedDB-backed patch storage. The patch state is ONE record, so activation is atomic. */
class IdbStorage implements ContentStorage {
  constructor(private readonly db: IDBDatabase) {}

  private store(name: string, mode: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction(name, mode).objectStore(name);
  }
  async getObject(sha: string): Promise<Uint8Array | null> {
    const v = (await req(this.store(OBJECTS, 'readonly').get(sha))) as ArrayBuffer | undefined;
    return v ? new Uint8Array(v) : null;
  }
  async putObject(sha: string, bytes: Uint8Array, reservation?: string): Promise<void> {
    await this.objectWrite(sha, bytes, reservation);
  }
  async hasObject(sha: string): Promise<boolean> {
    return (await req(this.store(OBJECTS, 'readonly').count(sha))) > 0;
  }
  async listObjects(): Promise<string[]> {
    return (await req(this.store(OBJECTS, 'readonly').getAllKeys())) as string[];
  }
  async deleteObject(sha: string): Promise<void> {
    await this.objectWrite(sha, null);
  }
  async getState(): Promise<PatchState | null> {
    return ((await req(this.store(META, 'readonly').get('state'))) as PatchState | undefined) ?? null;
  }
  async setState(state: PatchState): Promise<void> {
    await this.write(META, (store) => { store.put(state, 'state'); });
  }
  async getHighWater(channel: Channel): Promise<GenerationMark | null> {
    return ((await req(this.store(META, 'readonly').get(`generation:${channel}`))) as GenerationMark | undefined) ?? null;
  }
  async updateState(channel: Channel, change: (current: StorageSnapshot) => StorageSnapshot | null): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([META, OBJECTS], 'readwrite'); const store = tx.objectStore(META); const objects = tx.objectStore(OBJECTS);
      let changed = false;
      tx.oncomplete = () => resolve(changed);
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('content state transaction aborted'));
      const state = req(store.get('state')); const mark = req(store.get(`generation:${channel}`));
      const keys = req(store.getAllKeys()); const values = req(store.getAll()); const downloads = req(store.get('downloads'));
      void Promise.all([state, mark, keys, values, downloads]).then(([value, highWater, names, rows, reservations]) => {
        const inventory = Object.fromEntries(names.flatMap((key, index) => typeof key === 'string' && key.startsWith('size:') ? [[key.slice(5), rows[index] as number]] : []));
        const next = change({ state: (value as PatchState | undefined) ?? null, highWater: (highWater as GenerationMark | undefined) ?? null, inventory, downloads: (reservations as Record<string, DownloadReservation> | undefined) ?? {} });
        if (!next) return;
        store.put(next.state, 'state');
        if (next.highWater) store.put(next.highWater, `generation:${channel}`);
        if (next.downloads) store.put(next.downloads, 'downloads');
        for (const key of next.removeObjects ?? []) { objects.delete(key); store.delete(`size:${key}`); }
        changed = true;
      }).catch((e: unknown) => { try { tx.abort(); } catch { /* already aborted */ } reject(e); });
    });
  }
  private objectWrite(sha: string, bytes: Uint8Array | null, reservation?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([OBJECTS, META], 'readwrite'); const objects = tx.objectStore(OBJECTS); const meta = tx.objectStore(META);
      tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('content object transaction aborted'));
      const save = (): void => {
        if (bytes) { objects.put(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), sha); meta.put(bytes.byteLength, `size:${sha}`); }
        else { objects.delete(sha); meta.delete(`size:${sha}`); }
        if (reservation && !sha.startsWith('partial:')) { objects.delete(`partial:${sha}`); meta.delete(`size:partial:${sha}`); }
      };
      if (!reservation) { save(); return; }
      const request = meta.get('downloads'); request.onsuccess = () => {
        const entry = (request.result as Record<string, DownloadReservation> | undefined)?.[reservation]; const limit = entry?.files[sha.replace(/^partial:/, '')];
        if (!entry || entry.expiresAt <= Date.now() || limit === undefined || bytes && bytes.byteLength > limit) { tx.abort(); return; }
        save();
      };
    });
  }
  private write(name: string, work: (store: IDBObjectStore) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(name, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('content storage transaction aborted'));
      try { work(tx.objectStore(name)); } catch (e) { try { tx.abort(); } catch { /* already aborted */ } reject(e); }
    });
  }
}

export interface StorageHandle {
  storage: ContentStorage;
  persistent: boolean;
}

/** Opens IndexedDB, falling back to memory (patches then last only for the session). */
export async function openContentStorage(): Promise<StorageHandle> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no indexedDB');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      let refused = false;
      const open = indexedDB.open(DB, 2);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(OBJECTS)) open.result.createObjectStore(OBJECTS);
        if (!open.result.objectStoreNames.contains(META)) open.result.createObjectStore(META);
        const tx = open.transaction!; const cursor = tx.objectStore(OBJECTS).openCursor();
        cursor.onsuccess = () => { const row = cursor.result; if (row) { tx.objectStore(META).put((row.value as ArrayBuffer).byteLength, `size:${String(row.key)}`); row.continue(); } };
      };
      open.onsuccess = () => { if (refused) open.result.close(); else { open.result.onversionchange = () => open.result.close(); resolve(open.result); } };
      open.onerror = () => reject(open.error);
      open.onblocked = () => { refused = true; reject(new Error('indexedDB blocked')); };
    });
    return { storage: new IdbStorage(db), persistent: true };
  } catch {
    return { storage: new MemoryStorage(), persistent: false };
  }
}
