// INF-010: the API tests only ever create databases on a disposable server.
import { describe, expect, it } from "vitest";
import { assertDisposableServer } from "./db";

describe("assertDisposableServer", () => {
  it("accepts a local socket and loopback hosts", () => {
    for (const url of [
      "postgresql://uomd@localhost/postgres?host=/var/tmp/uomd-pg&port=54329",
      "postgresql://postgres:postgres@localhost:5432/postgres",
      "postgresql://postgres@127.0.0.1/postgres",
      "postgresql://postgres@[::1]:5432/postgres",
    ]) {
      expect(() => assertDisposableServer(url, false), url).not.toThrow();
    }
  });

  it("never accepts Neon, even when remote servers are allowed", () => {
    for (const url of ["postgresql://u:p@ep-cool-1.eu-central-1.aws.neon.tech/neondb", "postgresql://u:p@c-6.eu-central-1.aws.neon.tech/x"]) {
      expect(() => assertDisposableServer(url, true), url).toThrow("Neon is never a test server");
    }
  });

  it("needs an explicit opt-in for any other host", () => {
    expect(() => assertDisposableServer("postgresql://u:p@db.example.com/postgres", false)).toThrow("TEST_DATABASE_ALLOW_REMOTE=1");
    expect(() => assertDisposableServer("postgresql://u:p@db.example.com/postgres", true)).not.toThrow();
  });
});
