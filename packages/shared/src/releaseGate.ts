export interface ReleaseGateEnv {
  UOMD_API_BASE?: string;
  UOMD_CHANNEL?: string;
  UOMD_VERSION_CODE?: string;
  UOMD_VERSION_NAME?: string;
  UOMD_KEYSTORE_FILE?: string;
  UOMD_KEYSTORE_PASSWORD?: string;
  UOMD_KEY_ALIAS?: string;
  UOMD_KEY_PASSWORD?: string;
  UOMD_ADMOB_APP_ID?: string;
  UOMD_ADMOB_REWARDED_UNIT?: string;
  UOMD_GOOGLE_WEB_CLIENT_ID?: string;
  UOMD_ALLOW_UNSIGNED_RELEASE?: string;
}

const SAMPLE_TEST_PUBLISHER = '3940256099942544';
const DEFAULT_PROD_REWARDED_UNIT = 'ca-app-pub-4258559369390965/3553164322';
const DEFAULT_PROD_APP_ID = 'ca-app-pub-4258559369390965~2559970251';
const DEFAULT_WEB_CLIENT_ID = '604013824221-n7htgfhfs55njs5ie11ulojsk1tnk6da.apps.googleusercontent.com';

export function validateAndroidReleaseEnv(
  env: ReleaseGateEnv,
  fileExists: (path: string) => boolean = () => true
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const allowUnsigned = env.UOMD_ALLOW_UNSIGNED_RELEASE === 'true';
  const channel = env.UOMD_CHANNEL ?? 'staging';
  const apiBase = env.UOMD_API_BASE ?? 'https://uomd-game-staging.muratcaneksiii.workers.dev';
  const versionCodeRaw = env.UOMD_VERSION_CODE ?? '';
  const versionCode = Number.parseInt(versionCodeRaw, 10);
  const keystoreFile = env.UOMD_KEYSTORE_FILE ?? '';
  const keystorePassword = env.UOMD_KEYSTORE_PASSWORD ?? '';
  const adAppId = env.UOMD_ADMOB_APP_ID ?? DEFAULT_PROD_APP_ID;
  const rewardedUnit = env.UOMD_ADMOB_REWARDED_UNIT ?? DEFAULT_PROD_REWARDED_UNIT;
  const webClientId = env.UOMD_GOOGLE_WEB_CLIENT_ID ?? DEFAULT_WEB_CLIENT_ID;

  if (!['staging', 'production'].includes(channel)) {
    errors.push(`UOMD_CHANNEL must be 'staging' or 'production' (got '${channel}').`);
  }
  if (!apiBase.startsWith('https://')) {
    errors.push(`UOMD_API_BASE must use HTTPS for release builds (got '${apiBase}').`);
  }
  if (
    channel === 'production' &&
    (apiBase.includes('staging') || apiBase.includes('localhost') || apiBase.includes('127.0.0.1'))
  ) {
    errors.push(`Production release cannot target a staging or local UOMD_API_BASE ('${apiBase}').`);
  }
  if (!/^\d+$/.test(versionCodeRaw) || !Number.isSafeInteger(versionCode) || versionCode < 1) {
    errors.push(`UOMD_VERSION_CODE must be an explicit positive integer for Play Console upload (got '${versionCodeRaw}').`);
  }
  if (!allowUnsigned) {
    if (!keystoreFile || !fileExists(keystoreFile)) {
      errors.push('UOMD_KEYSTORE_FILE must point to an existing upload keystore file.');
    }
    if (!keystorePassword || keystorePassword.trim().length < 6) {
      errors.push('UOMD_KEYSTORE_PASSWORD is required for release signing.');
    }
  }
  if (adAppId.includes(SAMPLE_TEST_PUBLISHER) || rewardedUnit.includes(SAMPLE_TEST_PUBLISHER)) {
    errors.push('Google sample test AdMob IDs (3940256099942544) are forbidden in release builds.');
  }
  if (!/^ca-app-pub-\d{16}~\d{10}$/.test(adAppId)) {
    errors.push(`UOMD_ADMOB_APP_ID has invalid format ('${adAppId}').`);
  }
  if (!/^ca-app-pub-\d{16}\/\d{10}$/.test(rewardedUnit)) {
    errors.push(`UOMD_ADMOB_REWARDED_UNIT has invalid format ('${rewardedUnit}').`);
  }
  if (!webClientId.endsWith('.apps.googleusercontent.com')) {
    errors.push(`UOMD_GOOGLE_WEB_CLIENT_ID must be a valid Google OAuth Web client ID ('${webClientId}').`);
  }

  return { ok: errors.length === 0, errors };
}
