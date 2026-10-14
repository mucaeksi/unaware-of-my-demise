/**
 * Logical dump of a D1 database made INSIDE a Worker through the D1 binding (no API token needed): schema, then data, then indexes and
 * triggers (so the append-only triggers cannot block the restore). Output is plain SQL that restores with `sqlite3 restore.db < dump.sql`
 * or `wrangler d1 execute --file`.
 *
 * Bounded by construction (R17):
 *  1. sizing reads only COUNT(*) per table, so a database over the row cap fails before a single row is loaded;
 *  2. every row read is a page with an explicit LIMIT, planned from those counts plus one page of headroom, so even a table that
 *     grows between sizing and reading can never be read unbounded;
 *  3. all pages, the exact in-snapshot counts and the ledger reconciliation run in ONE batch = one transaction = one consistent
 *     snapshot, and any growth since sizing fails the dump instead of producing a partial file;
 *  4. SQL text is emitted page by page against a byte budget, and each page is released once serialized.
 */
export interface DumpLimits {
  /** total rows the single-snapshot dump may contain */
  maxRows: number;
  /** rows per page statement (pages use deterministic primary-key / rowid order) */
  pageRows: number;
  /** plain SQL bytes the dump may produce */
  maxBytes: number;
}
export const DUMP_LIMITS: DumpLimits = { maxRows: 200_000, pageRows: 25_000, maxBytes: 48 * 1024 * 1024 };

export interface DumpResult {
  sql: string;
  tables: Record<string, number>;
  /** page statements read per table */
  pages: Record<string, number>;
  /** UTF-8 bytes of `sql` */
  bytes: number;
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

export async function dumpDatabase(db: D1Database, override: Partial<DumpLimits> = {}): Promise<DumpResult> {
  const limits = { ...DUMP_LIMITS, ...override };
  const { results: master } = await db
    .prepare("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")
    .all<{ type: string; name: string; sql: string }>();
  const tables = master.filter((m) => m.type === 'table');
  const after = master.filter((m) => m.type !== 'table').sort((a, b) => (a.type === b.type ? 0 : a.type === 'index' ? -1 : 1));

  // Deterministic page order: rowid, or the declared primary key of WITHOUT ROWID tables.
  const keyed = tables.filter((t) => /WITHOUT\s+ROWID/i.test(t.sql)).map((t) => t.name);
  const pk = new Map<string, string[]>();
  if (keyed.length) {
    // D1 authorizes the PRAGMA statement form (not the pragma_table_info() table function)
    const infos = await db.batch<{ name: string; pk: number }>(keyed.map((name) => db.prepare(`PRAGMA table_info(${quote(name)})`)));
    keyed.forEach((name, i) => pk.set(name, (infos[i]?.results ?? []).filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name)));
  }
  const orderBy = (name: string): string => {
    if (!pk.has(name)) return 'rowid';
    const cols = pk.get(name);
    if (!cols?.length) throw new Error(`cannot page ${name}: no primary key found`);
    return cols.map(quote).join(', ');
  };

  // 1. size from counts only: an oversized database fails here, before any row is loaded
  const sized = await db.batch<{ n: number }>(tables.map((t) => db.prepare(`SELECT COUNT(*) AS n FROM ${quote(t.name)}`)));
  const planned = tables.map((_, i) => Number(sized[i]?.results[0]?.n ?? 0));
  const plannedTotal = planned.reduce((a, b) => a + b, 0);
  if (plannedTotal > limits.maxRows) throw new Error(`database has ${plannedTotal} rows: streaming backup is needed (single-snapshot dump is capped at ${limits.maxRows})`);

  // 2. one transaction: bounded pages (one page of headroom detects growth), exact counts and reconciliation
  const pageCount = planned.map((n) => Math.floor(n / limits.pageRows) + 1);
  const statements: D1PreparedStatement[] = [];
  tables.forEach((t, i) => {
    for (let p = 0; p < (pageCount[i] ?? 1); p++) {
      statements.push(db.prepare(`SELECT * FROM ${quote(t.name)} ORDER BY ${orderBy(t.name)} LIMIT ?1 OFFSET ?2`).bind(limits.pageRows, p * limits.pageRows));
    }
  });
  for (const t of tables) statements.push(db.prepare(`SELECT COUNT(*) AS n FROM ${quote(t.name)}`));
  const names = new Set(tables.map((t) => t.name));
  const reconcilable = names.has('wallets') && names.has('ledger');
  if (reconcilable) {
    statements.push(db.prepare('SELECT COUNT(*) AS bad FROM wallets w WHERE w.balance <> COALESCE((SELECT SUM(l.delta) FROM ledger l WHERE l.player_id = w.player_id AND l.currency = w.currency), 0)'));
  }
  const reads = await db.batch<Record<string, Cell>>(statements);
  const pagesRead = pageCount.reduce((a, b) => a + b, 0);
  const actual = tables.map((_, i) => Number((reads[pagesRead + i]?.results[0] as { n?: number } | undefined)?.n ?? NaN));
  const actualTotal = actual.reduce((a, b) => a + b, 0);
  if (actualTotal > limits.maxRows) throw new Error(`database has ${actualTotal} rows: streaming backup is needed (single-snapshot dump is capped at ${limits.maxRows})`);
  tables.forEach((t, i) => {
    if (!((actual[i] ?? NaN) <= (pageCount[i] ?? 1) * limits.pageRows)) throw new Error(`${t.name} grew from ${planned[i]} to ${actual[i]} rows while the dump was taken: retry the backup`);
  });

  // 3. serialize page by page against the byte budget
  const encoder = new TextEncoder();
  const out: string[] = [];
  let bytes = 0;
  const emit = (line: string): void => {
    bytes += encoder.encode(line).byteLength + 1;
    if (bytes > limits.maxBytes) throw new Error(`dump exceeds ${limits.maxBytes} bytes: streaming backup is needed`);
    out.push(line);
  };
  emit('-- UOMD D1 logical dump');
  emit('PRAGMA foreign_keys=OFF;');
  emit('BEGIN TRANSACTION;');
  for (const t of tables) emit(`${t.sql};`);

  const counts: Record<string, number> = {};
  const pages: Record<string, number> = {};
  let cursor = 0;
  tables.forEach((t, i) => {
    let read = 0;
    let cols: string[] | null = null;
    let pending: string[] = [];
    const flush = (): void => {
      if (cols && pending.length) emit(`INSERT INTO ${quote(t.name)} (${cols.map(quote).join(',')}) VALUES ${pending.join(',')};`);
      pending = [];
    };
    for (let p = 0; p < (pageCount[i] ?? 1); p++, cursor++) {
      const page = reads[cursor]?.results ?? [];
      read += page.length;
      for (const row of page) {
        cols ??= Object.keys(row);
        const c = cols;
        pending.push(`(${c.map((k) => sqlLiteral(row[k])).join(',')})`);
        if (pending.length === ROWS_PER_INSERT) flush(); // grouping is independent of page size: identical output for any pageRows
      }
      page.length = 0; // release the page once serialized
    }
    flush();
    if (read !== actual[i]) throw new Error(`dump of ${t.name} is incomplete: read ${read} rows, table has ${actual[i]}`);
    counts[t.name] = read;
    pages[t.name] = pageCount[i] ?? 1;
  });
  for (const o of after) emit(`${o.sql};`);
  emit('COMMIT;');

  const reconciled = reconcilable ? Number((reads[pagesRead + tables.length]?.results[0] as { bad?: number } | undefined)?.bad ?? NaN) === 0 : null;
  return { sql: `${out.join('\n')}\n`, tables: counts, pages, bytes, atomic: true, reconciled };
}
