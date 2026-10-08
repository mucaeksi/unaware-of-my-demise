// INF-011: one structured log line per request, tied to a request id the client also gets, and nothing secret in it.
import { describe, expect, it } from "vitest";
import { createApp, type LogEntry } from "../src/app";
import type { DbConnection } from "../src/db";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const noDatabase = async (): Promise<DbConnection> => ({ query: async () => ({ rows: [], rowCount: 0 }) as never, release: async () => undefined });

function appWith(connect: () => Promise<DbConnection> = noDatabase) {
  const entries: LogEntry[] = [];
  const app = createApp({ connect, verifier: null, release: { sourceSha: SHA, minClientVersionCode: 1, maintenanceMessage: "" }, log: (entry) => entries.push(entry) });
  return { app, entries };
}

describe("request log", () => {
  it("logs method, route, status, duration and release, and returns the request id", async () => {
    const { app, entries } = appWith();
    const response = await app(new Request("https://api.test/v1/bootstrap"));
    const requestId = response.headers.get("x-request-id")!;
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(entries).toEqual([
      { event: "request", request_id: requestId, method: "GET", route: "GET /v1/bootstrap", status: 200, duration_ms: expect.any(Number), source_sha: SHA.slice(0, 12) },
    ]);
  });

  it("uses Cloudflare's ray id, logs the route pattern (no ids) and never a token", async () => {
    const { app, entries } = appWith();
    const attemptId = crypto.randomUUID();
    const token = "secret-session-token-value";
    const response = await app(
      new Request(`https://api.test/v1/attempts/${attemptId}/abandon`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "cf-ray": "8c1f2e3d4c5b6a79-FRA", "idempotency-key": crypto.randomUUID() },
      }),
    );
    expect(response.headers.get("x-request-id")).toBe("8c1f2e3d4c5b6a79-FRA");
    expect(entries[0]).toMatchObject({ request_id: "8c1f2e3d4c5b6a79-FRA", route: "POST /v1/attempts/:attempt_id/abandon", status: 401 });
    const line = JSON.stringify(entries);
    expect(line).not.toContain(token);
    expect(line).not.toContain(attemptId);
    expect(line.toLowerCase()).not.toContain("authorization");
  });

  it("logs an unexpected error with the same request id, and the 500", async () => {
    const { app, entries } = appWith(async () => {
      throw new Error("database exploded");
    });
    const response = await app(new Request("https://api.test/healthz"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
    const requestId = response.headers.get("x-request-id");
    expect(entries.map((entry) => [entry.event, entry.request_id, entry.route])).toEqual([
      ["unhandled_error", requestId, "GET /healthz"],
      ["request", requestId, "GET /healthz"],
    ]);
    expect(entries[0]!.error).toContain("database exploded");
    expect(entries[1]!.status).toBe(500);
  });

  it("names an unknown path 'unmatched' instead of logging it", async () => {
    const { app, entries } = appWith();
    expect((await app(new Request("https://api.test/v1/no/such/path/with-secret-ish-segment"))).status).toBe(404);
    expect(entries[0]).toMatchObject({ route: "unmatched", status: 404 });
    expect(JSON.stringify(entries)).not.toContain("with-secret-ish-segment");
  });
});
