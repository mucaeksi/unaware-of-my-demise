import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { DbConnection } from "../src/db";
import { API_VERSION, parseReleaseConfig, rulesHash, RULES_FILES, serverRulesHash, type ReleaseConfig } from "../src/release";

const ROOT = join(import.meta.dirname, "..", "..");
const CONTENT = join(ROOT, "game", "data", "content");
const manifest = JSON.parse(readFileSync(join(CONTENT, "MANIFEST.json"), "utf8"));

/** No database: the gate answers before any query, and /v1/bootstrap reads none. */
const noDatabase = async (): Promise<DbConnection> => ({
  query: async () => ({ rows: [{ "?column?": 1 }], rowCount: 1 }) as never,
  release: async () => undefined,
});

const SHA = "0123456789abcdef0123456789abcdef01234567";
const app = (release: ReleaseConfig) => createApp({ connect: noDatabase, verifier: null, release, nowUnix: () => 1_790_000_000 });
const get = (release: ReleaseConfig, path: string, headers: Record<string, string> = {}) => app(release)(new Request(`https://api.test${path}`, { headers }));

describe("rules hash", () => {
  it("matches the test vector the Godot client checks too (test_client_release.gd)", async () => {
    const vector = { files: { "b.json": { sha256: "b".repeat(64) }, "a.json": { sha256: "a".repeat(64) } } };
    const expected = "64b8f81d7fcdaffcbbe2327fb7fa25bbaa634df5fe252024619d8b6cfef76c71";
    expect(createHash("sha256").update(`a.json ${"a".repeat(64)}\nb.json ${"b".repeat(64)}\n`).digest("hex")).toBe(expected);
    expect(await rulesHash(vector, ["b.json", "a.json"])).toBe(expected);
  });

  it("covers exactly the content files the server rules bundle", () => {
    const imported = [...readFileSync(join(ROOT, "server", "src", "rules.ts"), "utf8").matchAll(/from "\.\.\/\.\.\/game\/data\/content\/([^"]+)"/g)].map((m) => m[1]);
    expect([...imported].sort()).toEqual([...RULES_FILES]);
    expect([...RULES_FILES].sort()).toEqual([...RULES_FILES]);
  });

  it("lists the same files as the Godot client (client_release.gd RULES_FILES)", () => {
    const source = readFileSync(join(ROOT, "game", "scripts", "app", "client_release.gd"), "utf8");
    const block = /const RULES_FILES: Array\[String\] = \[([^\]]*)\]/.exec(source);
    expect(block, "client_release.gd declares RULES_FILES").not.toBeNull();
    expect([...block![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1])).toEqual([...RULES_FILES]);
  });

  it("is computed from the shipped files' real bytes (the bundle and the manifest agree)", async () => {
    for (const file of RULES_FILES) {
      const digest = createHash("sha256").update(readFileSync(join(CONTENT, file))).digest("hex");
      expect(manifest.files[file].sha256, file).toBe(digest);
    }
    expect(await serverRulesHash()).toBe(await rulesHash(manifest));
  });

  it("refuses a manifest that lacks a rules file", async () => {
    await expect(rulesHash({ files: {} }, ["x.json"])).rejects.toThrow("no sha256 for x.json");
  });
});

describe("release configuration", () => {
  it("defaults to an unrecorded source, version floor 1 and no maintenance", () => {
    expect(parseReleaseConfig({})).toEqual({ sourceSha: null, minClientVersionCode: 1, maintenanceMessage: "" });
    expect(parseReleaseConfig({ RELEASE_SOURCE_SHA: SHA.toUpperCase(), MIN_CLIENT_VERSION_CODE: " 7 ", MAINTENANCE_MESSAGE: " Back soon " })).toEqual({
      sourceSha: SHA,
      minClientVersionCode: 7,
      maintenanceMessage: "Back soon",
    });
  });

  it("rejects malformed values instead of serving with a guessed configuration", () => {
    expect(() => parseReleaseConfig({ RELEASE_SOURCE_SHA: "main" })).toThrow("RELEASE_SOURCE_SHA");
    for (const bad of ["0", "-1", "1.5", "x", "12345678901"]) {
      expect(() => parseReleaseConfig({ MIN_CLIENT_VERSION_CODE: bad }), bad).toThrow("MIN_CLIENT_VERSION_CODE");
    }
  });

  it("accepts the variables committed in wrangler.jsonc", () => {
    const text = readFileSync(join(ROOT, "server", "wrangler.jsonc"), "utf8").replace(/^\s*\/\/.*$/gm, "");
    const vars = JSON.parse(text).vars;
    expect(Object.keys(vars)).toEqual(expect.arrayContaining(["RELEASE_SOURCE_SHA", "MIN_CLIENT_VERSION_CODE", "MAINTENANCE_MESSAGE"]));
    expect(parseReleaseConfig(vars)).toEqual({ sourceSha: null, minClientVersionCode: 1, maintenanceMessage: "" });
  });
});

describe("GET /v1/bootstrap", () => {
  it("reports the contract versions, the client floor, the rules hash, the source commit and maintenance", async () => {
    const response = await get({ sourceSha: SHA, minClientVersionCode: 3, maintenanceMessage: "" }, "/v1/bootstrap");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      api_version: API_VERSION,
      snapshot_schema_version: 1,
      min_client_version_code: 3,
      rules_hash: await rulesHash(manifest),
      source_sha: SHA,
      maintenance: { active: false, message: "" },
      server_time_utc: new Date(1_790_000_000_000).toISOString(),
    });
  });

  it("answers without a database (a database outage must not hide the maintenance notice)", async () => {
    const unreachable = () => Promise.reject(new Error("database down"));
    const response = await createApp({ connect: unreachable, verifier: null, release: { sourceSha: null, minClientVersionCode: 1, maintenanceMessage: "Database maintenance" } })(
      new Request("https://api.test/v1/bootstrap"),
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { maintenance: unknown }).maintenance).toEqual({ active: true, message: "Database maintenance" });
  });

  it("still answers an outdated client and during maintenance (it is how the client learns either)", async () => {
    const release = { sourceSha: null, minClientVersionCode: 5, maintenanceMessage: "Patch in progress" };
    const response = await get(release, "/v1/bootstrap", { "x-client-version-code": "1" });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { maintenance: unknown }).maintenance).toEqual({ active: true, message: "Patch in progress" });
    expect((await get(release, "/healthz")).status).toBe(200);
  });
});

describe("update and maintenance gate", () => {
  const floor = { sourceSha: null, minClientVersionCode: 5, maintenanceMessage: "" };

  it("answers 426 UPDATE_REQUIRED to an app below the minimum versionCode, before any authentication", async () => {
    const response = await get(floor, "/v1/state", { "x-client-version-code": "4" });
    expect(response.status).toBe(426);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("UPDATE_REQUIRED");
  });

  it("lets a current app (or a tool without the header) through to the route", async () => {
    for (const headers of [{ "x-client-version-code": "5" }, { "x-client-version-code": "12" }, {}] as Record<string, string>[]) {
      expect((await get(floor, "/v1/state", headers)).status, JSON.stringify(headers)).toBe(401);
    }
  });

  it("rejects a malformed version header", async () => {
    expect((await get(floor, "/v1/state", { "x-client-version-code": "five" })).status).toBe(400);
  });

  it("answers 503 MAINTENANCE on every game route while the switch is on", async () => {
    const release = { sourceSha: null, minClientVersionCode: 1, maintenanceMessage: "Patch in progress" };
    for (const [method, path] of [["GET", "/v1/state"], ["POST", "/v1/auth/nonce"], ["POST", "/v1/gacha/pull"]] as const) {
      const response = await app(release)(new Request(`https://api.test${path}`, { method }));
      expect(response.status, path).toBe(503);
      expect(await response.json()).toEqual({ error: { code: "MAINTENANCE", message: "Patch in progress" } });
    }
  });
});
