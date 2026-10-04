// A disposable, fully migrated PostgreSQL database for the API tests. Needs TEST_ADMIN_DATABASE_URL: the maintenance
// database of a local or CI server, never production. Without it the database suites fail loudly instead of skipping.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import type { DbConnection } from "../src/db";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "database", "migrations");

/**
 * Only a disposable server is accepted (INF-010): a local socket or loopback host, never a Neon host. Another host needs
 * TEST_DATABASE_ALLOW_REMOTE=1, an explicit statement that it is a throwaway server.
 */
export function assertDisposableServer(url: string, allowRemote = process.env.TEST_DATABASE_ALLOW_REMOTE === "1"): void {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (/(^|\.)neon\.(tech|build)$/i.test(host)) throw new Error(`refusing to run tests against ${host}: Neon is never a test server`);
  const socket = (parsed.searchParams.get("host") ?? "").startsWith("/");
  const loopback = ["", "localhost", "127.0.0.1", "::1"].includes(host);
  if (!socket && !loopback && !allowRemote) {
    throw new Error(`refusing to run tests against ${host}: set TEST_DATABASE_ALLOW_REMOTE=1 if it is a disposable server`);
  }
}

function adminUrl(): string {
  const url = process.env.TEST_ADMIN_DATABASE_URL;
  if (!url) throw new Error("TEST_ADMIN_DATABASE_URL is not set (a disposable PostgreSQL maintenance database)");
  assertDisposableServer(url);
  return url;
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function admin(statement: string): Promise<void> {
  const client = new pg.Client({ connectionString: adminUrl() });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

export interface TestDatabase {
  pool: pg.Pool;
  connect: () => Promise<DbConnection>;
  close: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `uomd_api_test_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  await admin(`CREATE DATABASE ${name}`);
  const pool = new pg.Pool({ connectionString: withDatabase(adminUrl(), name), max: 4 });
  try {
    for (const file of readdirSync(MIGRATIONS).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort()) {
      await pool.query(readFileSync(join(MIGRATIONS, file), "utf8"));
    }
  } catch (error) {
    // A failed setup must not leave the database behind.
    await pool.end().catch(() => undefined);
    await admin(`DROP DATABASE IF EXISTS ${name}`).catch(() => undefined);
    throw error;
  }
  return {
    pool,
    connect: async () => {
      const client = await pool.connect();
      const giveBack = client.release.bind(client);
      return Object.assign(client, { release: async () => giveBack() }) as unknown as DbConnection;
    },
    close: async () => {
      await pool.end();
      await admin(`DROP DATABASE IF EXISTS ${name}`);
    },
  };
}
