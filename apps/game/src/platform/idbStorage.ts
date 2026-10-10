import { MemoryStorage, type ContentStorage, type PatchState } from '@uomd/patch';

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
  async putObject(sha: string, bytes: Uint8Array): Promise<void> {
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await req(this.store(OBJECTS, 'readwrite').put(copy, sha));
  }
  async hasObject(sha: string): Promise<boolean> {
    return (await req(this.store(OBJECTS, 'readonly').count(sha))) > 0;
  }
  async listObjects(): Promise<string[]> {
    return (await req(this.store(OBJECTS, 'readonly').getAllKeys())) as string[];
  }
  async deleteObject(sha: string): Promise<void> {
    await req(this.store(OBJECTS, 'readwrite').delete(sha));
  }
  async getState(): Promise<PatchState | null> {
    return ((await req(this.store(META, 'readonly').get('state'))) as PatchState | undefined) ?? null;
  }
  async setState(state: PatchState): Promise<void> {
    await req(this.store(META, 'readwrite').put(state, 'state'));
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
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => {
        open.result.createObjectStore(OBJECTS);
        open.result.createObjectStore(META);
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
      open.onblocked = () => reject(new Error('indexedDB blocked'));
    });
    return { storage: new IdbStorage(db), persistent: true };
  } catch {
    return { storage: new MemoryStorage(), persistent: false };
  }
}
