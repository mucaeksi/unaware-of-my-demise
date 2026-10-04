// A disposable, fully migrated PostgreSQL database for the API tests. Needs TEST_ADMIN_DATABASE_URL: the maintenance
// database of a local or CI server, never production. Without it the database suites fail loudly instead of skipping.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import type { DbConnection } from "../src/db";

const MIGRATIONS = join(import.meta.dirname, "..", "..", "database", "migrations");

function adminUrl(): string {
  const url = process.env.TEST_ADMIN_DATABASE_URL;
  if (!url) throw new Error("TEST_ADMIN_DATABASE_URL is not set (a disposable PostgreSQL maintenance database)");
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
  const name = `uomd_api_test_${process.pid}_${Date.now()}`;
  await admin(`CREATE DATABASE ${name}`);
  const pool = new pg.Pool({ connectionString: withDatabase(adminUrl(), name), max: 4 });
  for (const file of readdirSync(MIGRATIONS).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort()) {
    await pool.query(readFileSync(join(MIGRATIONS, file), "utf8"));
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
