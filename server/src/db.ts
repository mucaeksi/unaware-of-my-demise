// The database surface the routes use: a pg-compatible client per request (Hyperdrive in the Worker, a pool in tests).

export interface QueryResult<R> {
  rows: R[];
  rowCount: number | null;
}

export interface Db {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}

export interface DbConnection extends Db {
  release(): Promise<void>;
}

export type Connect = () => Promise<DbConnection>;

/** Runs `fn` in one transaction: COMMIT on success, ROLLBACK on any error (rethrown). */
export async function transaction<T>(db: Db, fn: (tx: Db) => Promise<T>, begin = "BEGIN"): Promise<T> {
  await db.query(begin);
  try {
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

/**
 * Runs the reads of `fn` against one consistent view of the database (INF-012): a read-only REPEATABLE READ transaction
 * sees every table as of its first query, so a snapshot never mixes data from before and after a concurrent mutation.
 */
export const consistentRead = <T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> =>
  transaction(db, fn, "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");

/** pg returns BIGINT as a string; balances must stay exact integers. */
export function toSafeInt(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`not a safe integer: ${String(value)}`);
  return number;
}
