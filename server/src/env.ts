export interface Env {
  HYPERDRIVE: Hyperdrive;
  /** Comma-separated Google OAuth client IDs accepted as the ID token audience; empty = sign-in is not configured. */
  GOOGLE_CLIENT_IDS: string;
  /** The banner rotation launch instant (ISO-8601, a Monday 00:00 UTC); empty = development (first banner pair stays open). */
  BANNER_EPOCH?: string;
  /** The git commit this Worker was deployed from (set by the deploy workflow); empty = not recorded. */
  RELEASE_SOURCE_SHA?: string;
  /** The lowest Android versionCode the API serves (older apps get 426 UPDATE_REQUIRED); empty = 1. */
  MIN_CLIENT_VERSION_CODE?: string;
  /** Non-empty = maintenance: every game route answers 503 MAINTENANCE with this message. */
  MAINTENANCE_MESSAGE?: string;
  AUTH_LIMITER?: RateLimit;
  API_LIMITER?: RateLimit;
}
