/**
 * Logical dump of a D1 database made INSIDE a Worker through the D1 binding (no API token needed): schema, then data, then indexes and
 * triggers (so the append-only triggers cannot block the restore). All tables are read in ONE batch, i.e. one consistent snapshot.
 * Output is plain SQL that restores with `sqlite3 restore.db < dump.sql` or `wrangler d1 execute --file`.
 */
export interface DumpResult {
  sql: string;
  tables: Record<string, number>;
  /** every table was read in a single transaction */
  atomic: boolean;
  /** wallet balances equal the sum of the ledger (null when the tables do not exist) */
  reconciled: boolean | null;
}

type Cell = string | number | null | ArrayBuffer | number[];

export function sqlLiteral(v: Cell | undefined): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'string') return `'${v.replaceAll("'", "''")}'`;
  const bytes = v instanceof ArrayBuffer ? new Uint8Array(v) : Uint8Array.from(v);
  return `X'${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}'`;
}

const quote = (id: string): string => `"${id.replaceAll('"', '""')}"`;
const ROWS_PER_INSERT = 50;
const MAX_ROWS_ATOMIC = 200_000;

export async function dumpDatabase(db: D1Database): Promise<DumpResult> {
  const { results: master } = await db
    .prepare("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")
    .all<{ type: string; name: string; sql: string }>();
  const tables = master.filter((m) => m.type === 'table');
  const after = master.filter((m) => m.type !== 'table').sort((a, b) => (a.type === b.type ? 0 : a.type === 'index' ? -1 : 1));

  // one batch = one transaction = a consistent snapshot of every table, plus the row counts to verify against
  const reads = await db.batch<Record<string, Cell>>([...tables.map((t) => db.prepare(`SELECT * FROM ${quote(t.name)}`)), ...tables.map((t) => db.prepare(`SELECT COUNT(*) AS n FROM ${quote(t.name)}`))]);
  const counts: Record<string, number> = {};
  const rows: Record<string, Record<string, Cell>[]> = {};
  tables.forEach((t, i) => {
    rows[t.name] = reads[i]?.results ?? [];
    counts[t.name] = rows[t.name]?.length ?? 0;
    const expected = Number((reads[tables.length + i]?.results?.[0] as { n?: number } | undefined)?.n ?? NaN);
    if (expected !== counts[t.name]) throw new Error(`dump of ${t.name} is incomplete: read ${counts[t.name]} rows, table has ${expected}`);
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total > MAX_ROWS_ATOMIC) throw new Error(`database has ${total} rows: streaming backup is needed (single-snapshot dump is capped at ${MAX_ROWS_ATOMIC})`);

  const out: string[] = ['-- UOMD D1 logical dump', 'PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;'];
  for (const t of tables) out.push(`${t.sql};`);
  for (const t of tables) {
    const r = rows[t.name] ?? [];
    if (r.length === 0) continue;
    const cols = Object.keys(r[0] as object);
    for (let i = 0; i < r.length; i += ROWS_PER_INSERT) {
      const part = r.slice(i, i + ROWS_PER_INSERT).map((row) => `(${cols.map((c) => sqlLiteral(row[c])).join(',')})`);
      out.push(`INSERT INTO ${quote(t.name)} (${cols.map(quote).join(',')}) VALUES ${part.join(',')};`);
    }
  }
  for (const o of after) out.push(`${o.sql};`);
  out.push('COMMIT;');

  let reconciled: boolean | null = null;
  const wallets = rows.wallets;
  const ledger = rows.ledger;
  if (wallets && ledger) {
    const sums = new Map<string, number>();
    for (const l of ledger) sums.set(`${l.player_id}|${l.currency}`, (sums.get(`${l.player_id}|${l.currency}`) ?? 0) + Number(l.delta));
    reconciled = wallets.every((w) => Number(w.balance) === (sums.get(`${w.player_id}|${w.currency}`) ?? 0));
  }
  return { sql: `${out.join('\n')}\n`, tables: counts, atomic: true, reconciled };
}
