import type { Channel, ManifestFile } from '@uomd/content-schema';
import type { RemoteSource } from '@uomd/patch';
import { API_BASE } from '../config';

/** Immutable object URLs permit verified byte-range resume; an ignored range restarts from zero. */
export class ApiRemote implements RemoteSource {
  constructor(private readonly base = API_BASE, private readonly fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  async fetchManifest(channel: Channel, signal?: AbortSignal): Promise<unknown | null> {
    const res = await this.fetchImpl(`${this.base}/api/v1/content/channels/${channel}/manifest`, { cache: 'no-store', ...(signal ? { signal } : {}) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`manifest request failed: HTTP ${res.status}`);
    return res.json();
  }

  async fetchObject(sha256: string, file: ManifestFile, onBytes?: (received: number) => void, options: Parameters<RemoteSource['fetchObject']>[3] = {}): Promise<Uint8Array> {
    const prefix = options?.partial; const offset = prefix?.byteLength ?? 0;
    const res = await this.fetchImpl(`${this.base}/api/v1/content/objects/${sha256}`, { ...(options?.signal ? { signal: options.signal } : {}), ...(offset ? { headers: { Range: `bytes=${offset}-` } } : {}) });
    if (!res.ok) throw new Error(`object ${sha256.slice(0, 8)} failed: HTTP ${res.status}`);
    let received = 0;
    const out = new Uint8Array(file.bytes);
    if (res.status === 206) {
      if (!offset || res.headers.get('Content-Range') !== `bytes ${offset}-${file.bytes - 1}/${file.bytes}`) { await res.body?.cancel(); throw new Error('object range differs from its signed size'); }
      out.set(prefix!); received = offset;
    }
    if (!res.body) throw new Error('object response has no body');
    const reader = res.body.getReader(); let saved = received;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        if (received + value.byteLength > out.byteLength) throw new Error(`object ${sha256.slice(0, 8)} is larger than its manifest says`);
        out.set(value, received); received += value.byteLength; onBytes?.(received);
        if (received - saved >= 1024 * 1024 && received < out.byteLength) { await options?.onPartial?.(out.slice(0, received)); saved = received; }
      }
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    return received === out.byteLength ? out : out.slice(0, received);
  }
}
