// INF-029: content patches come from the private bucket through the Worker, to signed-in players only, byte-exact,
// with single-range reads for resumed downloads.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { parseRange, type ContentObject, type ContentStore } from "../src/content";
import type { IdentityVerifier } from "../src/identity";
import { createTestDatabase, type TestDatabase } from "./db";

let database: TestDatabase;
let counter = 0;

const verifier: IdentityVerifier = {
  verify: async (credential) => {
    const [subject, nonce] = credential.split("|");
    return { provider: "google_oidc", subject: subject!, nonce: nonce ?? null };
  },
};

/** An in-memory bucket with R2's get/head semantics (range reads, whole-object size). */
function memoryStore(objects: Record<string, Uint8Array>): ContentStore {
  return {
    head: async (key) => (objects[key] ? { size: objects[key]!.length } : null),
    get: async (key, options) => {
      const data = objects[key];
      if (!data) return null;
      const slice = options?.range ? data.subarray(options.range.offset, options.range.offset + options.range.length) : data;
      const object: ContentObject = {
        size: data.length,
        body: new Response(slice).body!,
        arrayBuffer: async () => slice.slice().buffer,
      };
      return object;
    },
  };
}

const pack = new TextEncoder().encode("GDPC" + "x".repeat(96));
const sha = "a".repeat(64);
const manifest = new TextEncoder().encode('{"generation": 2}\n');
const signature = new Uint8Array([1, 2, 3, 250]);
const store = memoryStore({
  [`packs/${sha}.pck`]: pack,
  "channels/production/current.json": manifest,
  "channels/production/current.json.sig": signature,
});
const app = (content: ContentStore | null = store) => createApp({ connect: () => database.connect(), verifier, content });

beforeAll(async () => {
  database = await createTestDatabase();
});
afterAll(async () => {
  await database?.close();
});

async function token(): Promise<string> {
  const issued = (await (await app()(new Request("https://api.test/v1/auth/nonce", { method: "POST" }))).json()) as { nonce: string };
  const response = await app()(new Request("https://api.test/v1/auth/google", { method: "POST", body: JSON.stringify({ credential: `content-${++counter}|${issued.nonce}` }) }));
  return ((await response.json()) as { session_token: string }).session_token;
}

const get = async (path: string, auth: string | null, headers: Record<string, string> = {}, content: ContentStore | null = store) =>
  app(content)(new Request(`https://api.test${path}`, { headers: { ...(auth ? { authorization: `Bearer ${auth}` } : {}), ...headers } }));

describe("GET /v1/content/current", () => {
  it("answers the channel's signed manifest byte-exact", async () => {
    const response = await get("/v1/content/current", await token());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as Record<string, string>;
    expect(body.channel).toBe("production");
    expect(Buffer.from(body.manifest_b64!, "base64")).toEqual(Buffer.from(manifest));
    expect(Buffer.from(body.signature_b64!, "base64")).toEqual(Buffer.from(signature));
  });

  it("is for signed-in players, 404 before the first release, 503 without a bucket", async () => {
    expect((await get("/v1/content/current", null)).status).toBe(401);
    const auth = await token();
    const empty = await get("/v1/content/current", auth, {}, memoryStore({}));
    expect([empty.status, ((await empty.json()) as { error: { code: string } }).error.code]).toEqual([404, "NO_CONTENT_RELEASE"]);
    expect((await get("/v1/content/current", auth, {}, null)).status).toBe(503);
  });
});

describe("GET /v1/content/packs/{sha256}", () => {
  it("streams the whole pack, immutable and private", async () => {
    const response = await get(`/v1/content/packs/${sha}`, await token());
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pack);
    expect(response.headers.get("content-length")).toBe(String(pack.length));
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("etag")).toBe(`"${sha}"`);
    expect(response.headers.get("cache-control")).toBe("private, max-age=31536000, immutable");
  });

  it("resumes with a byte range", async () => {
    const auth = await token();
    const tail = await get(`/v1/content/packs/${sha}`, auth, { range: "bytes=40-" });
    expect(tail.status).toBe(206);
    expect(tail.headers.get("content-range")).toBe(`bytes 40-99/100`);
    expect(new Uint8Array(await tail.arrayBuffer())).toEqual(pack.subarray(40));
    const middle = await get(`/v1/content/packs/${sha}`, auth, { range: "bytes=4-7" });
    expect(new TextDecoder().decode(await middle.arrayBuffer())).toBe("xxxx");
    const beyond = await get(`/v1/content/packs/${sha}`, auth, { range: "bytes=100-" });
    expect([beyond.status, beyond.headers.get("content-range")]).toEqual([416, "bytes */100"]);
  });

  it("refuses strangers, unknown packs and names that are not a SHA-256", async () => {
    expect((await get(`/v1/content/packs/${sha}`, null)).status).toBe(401);
    const auth = await token();
    expect((await get(`/v1/content/packs/${"b".repeat(64)}`, auth)).status).toBe(404);
    expect((await get("/v1/content/packs/not-a-hash", auth)).status).toBe(404);
    expect((await get(`/v1/content/packs/${sha}`, auth, {}, null)).status).toBe(503);
  });
});

describe("parseRange", () => {
  it("reads one range, open-ended or suffix, clamped to the object", () => {
    expect(parseRange(null, 10)).toBeNull();
    expect(parseRange("bytes=0-4", 10)).toEqual({ offset: 0, length: 5 });
    expect(parseRange("bytes=5-", 10)).toEqual({ offset: 5, length: 5 });
    expect(parseRange("bytes=-3", 10)).toEqual({ offset: 7, length: 3 });
    expect(parseRange("bytes=8-100", 10)).toEqual({ offset: 8, length: 2 });
    expect(parseRange("bytes=-100", 10)).toEqual({ offset: 0, length: 10 });
  });

  it("refuses what it cannot serve", () => {
    for (const header of ["bytes=10-", "bytes=5-2", "bytes=-0", "bytes=-", "bytes=0-1,4-5", "items=0-1"]) {
      expect(() => parseRange(header, 10), header).toThrow(/not satisfiable/);
    }
  });
});
