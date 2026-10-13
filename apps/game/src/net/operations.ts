import { canonicalJson, sha256Hex } from '@uomd/shared';

export type OperationState = 'pending' | 'confirmed' | 'rejected';
export interface OperationRecord {
  id: string;
  scope: string;
  signature: string;
  payloadHash: string;
  method: 'POST' | 'PUT';
  path: string;
  body: Record<string, unknown>;
  state: OperationState;
  result?: unknown;
  code?: string;
  attempts: number;
  at: number;
}
export interface OperationStorage {
  change<T>(work: (records: OperationRecord[]) => T): Promise<T>;
}
const MUTATION_PATH = /^\/api\/v1\/(gacha\/pull|progress\/(battle|story)|characters\/[a-z][a-z0-9_]{0,79}\/(level-up|ascend|skills\/[a-z][a-z0-9_]{0,79}\/upgrade)|gear\/\d+\/(level-up|ascend|reroll|dismantle)|mail\/\d+\/claim|tasks\/claim|entry|save)$/;
const MAX_PENDING = 64;
const MAX_HISTORY = 64;

function valid(record: OperationRecord): boolean {
  return typeof record === 'object' && record !== null && typeof record.id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(record.id)
    && typeof record.scope === 'string' && typeof record.signature === 'string' && /^[a-f0-9]{64}$/.test(record.signature)
    && typeof record.payloadHash === 'string' && /^[a-f0-9]{64}$/.test(record.payloadHash)
    && record.method === (/^\/api\/v1\/(entry|save)$/.test(record.path) ? 'PUT' : 'POST') && MUTATION_PATH.test(record.path) && typeof record.body === 'object' && record.body !== null && !Array.isArray(record.body)
    && record.body.requestId === record.id && ['pending', 'confirmed', 'rejected'].includes(record.state) && Number.isFinite(record.at)
    && Number.isSafeInteger(record.attempts) && record.attempts >= 0;
}

/** No volatile fallback: a money operation is not sent until its original identity is durably saved. */
export class IndexedOperationStorage implements OperationStorage {
  private opened: Promise<IDBDatabase> | null = null;
  private open(): Promise<IDBDatabase> {
    return this.opened ??= new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('Persistent operation storage is unavailable')); return; }
      const request = indexedDB.open('uomd-operations', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('journal');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Operation storage is blocked'));
    });
  }
  async change<T>(work: (records: OperationRecord[]) => T): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('journal', 'readwrite'); const store = tx.objectStore('journal');
      let value: T;
      tx.oncomplete = () => resolve(value);
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Operation journal transaction aborted'));
      const request = store.get('records');
      request.onsuccess = () => {
        try {
          const records: OperationRecord[] = request.result ?? [];
          if (!Array.isArray(records) || records.length > MAX_PENDING + MAX_HISTORY || !records.every(valid)) throw new Error('Operation journal is corrupted');
          const before = JSON.stringify(records);
          value = work(records);
          if (JSON.stringify(records) === before) return;
          const pending = records.filter((r) => r.state === 'pending');
          const final = records.filter((r) => r.state !== 'pending').reverse().sort((a, b) => b.at - a.at).slice(0, MAX_HISTORY);
          store.put([...pending, ...final], 'records');
        } catch (error) { try { tx.abort(); } catch { /* already aborted */ } reject(error); }
      };
    });
  }
}

export class OperationJournal {
  constructor(private readonly storage: OperationStorage = new IndexedOperationStorage()) {}
  private async signature(method: string, path: string, body: Record<string, unknown>): Promise<string> {
    const { requestId: _identity, ...intent } = body;
    return sha256Hex(canonicalJson({ method, path, body: intent }));
  }
  private payloadHash(record: Pick<OperationRecord, 'id' | 'scope' | 'method' | 'path' | 'body'>): Promise<string> {
    return sha256Hex(canonicalJson({ id: record.id, scope: record.scope, method: record.method, path: record.path, body: record.body }));
  }
  async begin(scope: string, method: 'POST' | 'PUT', path: string, body: Record<string, unknown>): Promise<OperationRecord> {
    if (method !== (/^\/api\/v1\/(entry|save)$/.test(path) ? 'PUT' : 'POST') || !MUTATION_PATH.test(path)) throw new Error('Unsupported durable operation');
    const serialized = JSON.stringify(body);
    if (/"(?:purchaseToken|idToken|token|authorization|refreshToken|accessToken)"\s*:/i.test(serialized)) throw new Error('Credentials cannot be recorded in an operation');
    if (new TextEncoder().encode(serialized).byteLength > 65_536) throw new Error('Operation payload is too large');
    const snapshot = JSON.parse(serialized) as Record<string, unknown>;
    const signature = await this.signature(method, path, snapshot);
    const id = crypto.randomUUID().replaceAll('-', '');
    const request = { id, scope, method, path, body: { ...snapshot, requestId: id } };
    const payloadHash = await this.payloadHash(request);
    const record = await this.storage.change((records) => {
      const pending = records.find((r) => r.scope === scope && r.signature === signature && r.state === 'pending');
      if (pending) return structuredClone(pending);
      if (records.some((r) => r.scope === scope && r.path === path && r.state === 'pending')) throw new Error('Confirm the previous action before changing its input');
      if (records.filter((r) => r.state === 'pending').length >= MAX_PENDING) throw new Error('Resolve pending actions before starting more');
      const record: OperationRecord = { ...request, signature, payloadHash, state: 'pending', at: Date.now(), attempts: 0 };
      records.push(record); return structuredClone(record);
    });
    return (await this.get(scope, record.id))!;
  }
  async get(scope: string, id: string): Promise<OperationRecord | null> {
    const record = await this.storage.change((records) => structuredClone(records.find((r) => r.scope === scope && r.id === id) ?? null));
    if (record && (await this.signature(record.method, record.path, record.body) !== record.signature || await this.payloadHash(record) !== record.payloadHash)) throw new Error('Operation payload changed after recording');
    return record;
  }
  list(scope: string): Promise<OperationRecord[]> {
    return this.storage.change((records) => structuredClone(records.filter((r) => r.scope === scope)));
  }
  attempt(scope: string, id: string): Promise<number> {
    return this.storage.change((records) => {
      const record = records.find((r) => r.scope === scope && r.id === id);
      if (!record || record.state !== 'pending') throw new Error('Operation is no longer pending');
      return ++record.attempts;
    });
  }
  async finish(scope: string, id: string, state: OperationState, result?: unknown, code?: string): Promise<void> {
    await this.storage.change((records) => {
      const record = records.find((r) => r.scope === scope && r.id === id);
      if (!record || record.state !== 'pending' && !(record.state === 'confirmed' && state === 'confirmed')) return;
      record.state = state; record.at = Date.now();
      if (state === 'confirmed') record.result = structuredClone(result);
      if (code) record.code = /^[a-z_]{1,80}$/.test(code) ? code : 'request_failed';
    });
  }
}
