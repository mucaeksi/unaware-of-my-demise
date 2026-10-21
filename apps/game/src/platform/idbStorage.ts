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
  private readonly writeQueue: { sha: string; bytes: Uint8Array | null; reservation?: string; resolve: () => void; reject: (e: unknown) => void }[] = [];
  private flushing = false;
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
      this.writeQueue.push({ sha, bytes, reservation, resolve, reject });
      if (!this.flushing) {
        this.flushing = true;
        queueMicrotask(() => this.flushWrites());
      }
    });
  }
  private flushWrites(): void {
    const batch = this.writeQueue.splice(0);
    if (batch.length === 0) {
      this.flushing = false;
      return;
    }
    const tx = this.db.transaction([OBJECTS, META], 'readwrite');
    const objects = tx.objectStore(OBJECTS);
    const meta = tx.objectStore(META);
    tx.oncomplete = () => {
      for (const item of batch) item.resolve();
      this.flushWrites();
    };
    tx.onabort = tx.onerror = () => {
      const err = tx.error ?? new Error('content object transaction aborted');
      for (const item of batch) item.reject(err);
      this.flushWrites();
    };
    const saveItem = (item: (typeof batch)[number]): void => {
      if (item.bytes) {
        objects.put(item.bytes.buffer.slice(item.bytes.byteOffset, item.bytes.byteOffset + item.bytes.byteLength), item.sha);
        meta.put(item.bytes.byteLength, `size:${item.sha}`);
      } else {
        objects.delete(item.sha);
        meta.delete(`size:${item.sha}`);
      }
      if (item.reservation && !item.sha.startsWith('partial:')) {
        objects.delete(`partial:${item.sha}`);
        meta.delete(`size:partial:${item.sha}`);
      }
    };
    if (batch.every((item) => !item.reservation)) {
      for (const item of batch) saveItem(item);
      return;
    }
    const request = meta.get('downloads');
    request.onsuccess = () => {
      const downloads = request.result as Record<string, DownloadReservation> | undefined;
      const now = Date.now();
      for (const item of batch) {
        if (item.reservation) {
          const entry = downloads?.[item.reservation];
          const limit = entry?.files[item.sha.replace(/^partial:/, '')];
          if (!entry || entry.expiresAt <= now || limit === undefined || (item.bytes && item.bytes.byteLength > limit)) {
            tx.abort();
            return;
          }
        }
        saveItem(item);
      }
    };
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
