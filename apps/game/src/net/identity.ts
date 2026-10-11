import { GoogleSignIn, isNative } from '../platform/native';

/**
 * Google identity comes from the native Android shell (Credential Manager through the Capacitor plugin `UomdGoogleSignIn`).
 * A browser has no verified source of a Google ID token, so on the web sign-in is reported as unavailable instead of faked.
 */
export interface IdentityProvider {
  readonly kind: 'native' | 'none';
  getIdToken(): Promise<string>;
  /** forgets the chosen Google account on the device (the server session is revoked separately) */
  forget(): Promise<void>;
}

export class IdentityUnavailable extends Error {
  constructor() {
    super('Google sign-in is available in the Android app');
  }
}

export function detectIdentity(): IdentityProvider {
  if (isNative()) {
    return {
      kind: 'native',
      getIdToken: async () => (await GoogleSignIn.signIn()).idToken,
      forget: () => GoogleSignIn.signOut().catch(() => undefined)
    };
  }
  return {
    kind: 'none',
    getIdToken: () => Promise.reject(new IdentityUnavailable()),
    forget: () => Promise.resolve()
  };
}
