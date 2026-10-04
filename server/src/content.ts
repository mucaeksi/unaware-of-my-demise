// Content-patch delivery from the private R2 bucket (INF-029, DEC-0030). The bucket is never public: only this Worker
// reads it, and only for a signed-in player. Objects are immutable and content-addressed:
//   packs/<sha256>.pck                       a content pack, named by the SHA-256 of its bytes (never overwritten)
//   manifests/<channel>/<generation>.json    a signed manifest (+ .sig), one per generation (never overwritten)
//   channels/<channel>/current.json          the channel pointer: a copy of the current manifest (+ .sig)
// The pointer is the only object that changes. It needs no trust of its own: the client verifies the manifest's
// signature with the key shipped in the app and refuses a generation that is not newer than the installed one, so a
// stale or substituted pointer can only make it install nothing (ContentManifest, DEC-0029).
import { ApiError } from "./http";

/** The bucket operations delivery needs (an R2Bucket satisfies it; tests pass a map). */
export interface ContentStore {
  head(key: string): Promise<{ size: number } | null>;
  get(key: string, options?: { range?: { offset: number; length: number } }): Promise<ContentObject | null>;
}

export interface ContentObject {
  /** The whole object's size, whatever range was read. */
  size: number;
  body: ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export const SHA256_HEX = /^[0-9a-f]{64}$/;
export const CHANNELS = ["production", "staging", "test"] as const;
/** Packs are immutable: a client may keep them as long as it likes; `private` keeps shared caches out. */
const PACK_CACHE = "private, max-age=31536000, immutable";

const unavailable = () => new ApiError(503, "CONTENT_UNAVAILABLE", "Content delivery is not configured");

function base64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

/**
 * The channel's current signed manifest, byte-exact (base64: the signature covers these bytes), or 404
 * NO_CONTENT_RELEASE before the first release.
 */
export async function currentRelease(store: ContentStore | null, channel: string): Promise<Record<string, string>> {
  if (store === null) throw unavailable();
  const [manifest, signature] = await Promise.all([
    store.get(`channels/${channel}/current.json`),
    store.get(`channels/${channel}/current.json.sig`),
  ]);
  if (manifest === null || signature === null) throw new ApiError(404, "NO_CONTENT_RELEASE", "No content release is published on this channel");
  return { channel, manifest_b64: base64(await manifest.arrayBuffer()), signature_b64: base64(await signature.arrayBuffer()) };
}

/** A parsed `Range: bytes=...` header (one range): `null` = the whole object; throws 416 when it cannot be served. */
export function parseRange(header: string | null, size: number): { offset: number; length: number } | null {
  if (header === null || header.trim() === "") return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) throw notSatisfiable();
  let start: number;
  let end: number;
  if (match[1] === "") {
    // Suffix range: the last N bytes.
    const suffix = Number(match[2]);
    if (suffix === 0) throw notSatisfiable();
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) throw notSatisfiable();
  return { offset: start, length: end - start + 1 };
}

const notSatisfiable = (): ApiError => new ApiError(416, "RANGE_NOT_SATISFIABLE", "The requested range is not satisfiable");

/** Streams pack `sha256` (whole, or one byte range for a resumed download). */
export async function packResponse(store: ContentStore | null, sha256: string, rangeHeader: string | null): Promise<Response> {
  if (store === null) throw unavailable();
  if (!SHA256_HEX.test(sha256)) throw new ApiError(404, "HTTP_ERROR", "Not Found");
  const key = `packs/${sha256}.pck`;
  const head = await store.head(key);
  if (head === null) throw new ApiError(404, "HTTP_ERROR", "Not Found");
  const headers: Record<string, string> = {
    "content-type": "application/octet-stream",
    "accept-ranges": "bytes",
    etag: `"${sha256}"`,
    "cache-control": PACK_CACHE,
  };
  let range: { offset: number; length: number } | null;
  try {
    range = parseRange(rangeHeader, head.size);
  } catch (error) {
    if (error instanceof ApiError && error.status === 416) {
      return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${head.size}` } });
    }
    throw error;
  }
  const object = await store.get(key, range === null ? undefined : { range });
  if (object === null) throw new ApiError(404, "HTTP_ERROR", "Not Found");
  if (range === null) {
    return new Response(object.body, { status: 200, headers: { ...headers, "content-length": String(object.size) } });
  }
  return new Response(object.body, {
    status: 206,
    headers: {
      ...headers,
      "content-length": String(range.length),
      "content-range": `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`,
    },
  });
}
