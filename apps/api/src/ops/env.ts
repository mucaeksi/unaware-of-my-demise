import type { VersionMetadata } from '../monitoring';
export interface OpsEnv {
  CF_VERSION_METADATA?: VersionMetadata;
  DB: D1Database;
  BACKUPS: R2Bucket;
  /** age PUBLIC key (age1...) the backups are encrypted to; the private key stays with the owner */
  AGE_RECIPIENT: string;
  TARGET: string;
  /** Service bindings: a Worker cannot fetch another Worker of the same account through its public workers.dev URL (Cloudflare error 1042). */
  GAME: Fetcher;
  ADMIN: Fetcher;
  /** Optional public Admin URL behind Cloudflare Access edge for external edge-protection probing (R17). */
  PUBLIC_ADMIN_URL?: string;
  /** Optional owner-configured webhook endpoint for out-of-band health/backup failure escalation (R17). */
  ALERT_WEBHOOK_URL?: string;
  ALERT_BEARER_TOKEN?: string;
  /** Optional R2 backup retention window in days (defaults to 30, always keeping at least 3 backups). */
  BACKUP_RETENTION_DAYS?: string;
}
