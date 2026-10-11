import type { Channel, ManifestFile } from '@uomd/content-schema';
import type { RemoteSource } from '@uomd/patch';
import { API_BASE } from '../config';

/** Talks to the Worker's content endpoints. 404 on the manifest = nothing published (not an error). */
export class ApiRemote implements RemoteSource {
  constructor(private readonly base = API_BASE, private readonly fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  async fetchManifest(channel: Channel): Promise<unknown | null> {
    const res = await this.fetchImpl(`${this.base}/api/v1/content/channels/${channel}/manifest`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`manifest request failed: HTTP ${res.status}`);
    return res.json();
  }

  async fetchObject(sha256: string, file: ManifestFile, onBytes?: (received: number) => void): Promise<Uint8Array> {
    const res = await this.fetchImpl(`${this.base}/api/v1/content/objects/${sha256}`);
    if (!res.ok) throw new Error(`object ${sha256.slice(0, 8)} failed: HTTP ${res.status}`);
    if (!onBytes || !res.body) return new Uint8Array(await res.arrayBuffer());
    // streamed so a big object moves the progress bar smoothly instead of in one jump
    const reader = res.body.getReader();
    const out = new Uint8Array(file.bytes);
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (received + value.byteLength > out.byteLength) throw new Error(`object ${sha256.slice(0, 8)} is larger than its manifest says`);
      out.set(value, received);
      received += value.byteLength;
      onBytes(received);
    }
    return received === out.byteLength ? out : out.slice(0, received); // a short body fails the size check in the manager
  }
}
