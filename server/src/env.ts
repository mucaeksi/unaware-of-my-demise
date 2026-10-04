export interface Env {
  HYPERDRIVE: Hyperdrive;
  /** Comma-separated Google OAuth client IDs accepted as the ID token audience; empty = sign-in is not configured. */
  GOOGLE_CLIENT_IDS: string;
  /** The banner rotation launch instant (ISO-8601, a Monday 00:00 UTC); empty = development (first banner pair stays open). */
  BANNER_EPOCH?: string;
  AUTH_LIMITER?: RateLimit;
  API_LIMITER?: RateLimit;
}
