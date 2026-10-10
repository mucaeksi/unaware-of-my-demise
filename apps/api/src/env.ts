export type Environment = 'dev' | 'staging' | 'production';

export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Bindings of the public game Worker (also serves the static game client). */
export interface GameEnv {
  DB: D1Database;
  CONTENT: R2Bucket;
  ASSETS: Fetcher;
  API_LIMITER?: RateLimit;
  ENVIRONMENT: Environment;
  CONTENT_CHANNEL: Environment;
}

/** Bindings of the Control Center Worker (static admin SPA + /admin/api, behind Cloudflare Access). */
export interface AdminEnv {
  DB: D1Database;
  CONTENT: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT: Environment;
  /** e.g. "red-sky-901e.cloudflareaccess.com"; auth fails closed when absent */
  ACCESS_TEAM_DOMAIN?: string;
  /** Application Audience (AUD) tag of the Access application protecting this Worker */
  ACCESS_AUD?: string;
  /** dev-only: URL of a test JWKS used instead of Cloudflare's (ignored unless ENVIRONMENT is dev) */
  ACCESS_JWKS_URL?: string;
  /** comma separated emails that are created as `owner` on their first authenticated request */
  ADMIN_BOOTSTRAP_OWNERS?: string;
  /** secret: ES256 private JWK (JSON) used to sign content manifests */
  CONTENT_SIGNING_KEY?: string;
  CONTENT_SIGNING_KID?: string;
}
