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
  /** The private content bucket (INF-029); absent = content delivery answers 503. */
  CONTENT?: R2Bucket;
  /** The content channel this deployment serves (production, staging); empty = production. */
  CONTENT_CHANNEL?: string;
  /** Comma-separated AdMob rewarded ad unit ids whose SSV callbacks pay (INF-036); empty = rewarded ads answer 503. */
  ADMOB_AD_UNIT_IDS?: string;
  /** Secret: the JSON key of the service account that reads purchases in the Play Console; absent = purchases answer 503. */
  GOOGLE_PLAY_SERVICE_ACCOUNT?: string;
  /** The Android package the purchases belong to; empty = io.github.mucaeksi.unawareofmydemise. */
  PLAY_PACKAGE_NAME?: string;
  /** The audience and service account of the Pub/Sub push subscription for Play's developer notifications. */
  RTDN_AUDIENCE?: string;
  RTDN_PUSH_SERVICE_ACCOUNT?: string;
  AUTH_LIMITER?: RateLimit;
  API_LIMITER?: RateLimit;
}
