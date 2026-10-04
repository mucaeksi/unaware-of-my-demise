export interface Env {
  HYPERDRIVE: Hyperdrive;
  /** Comma-separated Google OAuth client IDs accepted as the ID token audience; empty = sign-in is not configured. */
  GOOGLE_CLIENT_IDS: string;
  AUTH_LIMITER?: RateLimit;
  API_LIMITER?: RateLimit;
}
