export interface OpsEnv {
  DB: D1Database;
  BACKUPS: R2Bucket;
  /** age PUBLIC key (age1...) the backups are encrypted to; the private key stays with the owner */
  AGE_RECIPIENT: string;
  TARGET: string;
  GAME_URL: string;
  ADMIN_URL: string;
  /** staging only: also store a PLAINTEXT copy under probe/ once, to prove a restore end to end (delete it afterwards) */
  BACKUP_PROBE?: string;
}
