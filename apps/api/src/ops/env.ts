export interface OpsEnv {
  DB: D1Database;
  BACKUPS: R2Bucket;
  /** age PUBLIC key (age1...) the backups are encrypted to; the private key stays with the owner */
  AGE_RECIPIENT: string;
  TARGET: string;
  /** Service bindings: a Worker cannot fetch another Worker of the same account through its public workers.dev URL (Cloudflare error 1042). */
  GAME: Fetcher;
  ADMIN: Fetcher;
  /** staging only: also store a PLAINTEXT copy under probe/ once, to prove a restore end to end (delete it afterwards) */
  BACKUP_PROBE?: string;
}
