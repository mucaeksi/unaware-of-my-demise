/**
 * Google identity comes from the native Android shell (Credential Manager through the Capacitor plugin `UomdGoogleSignIn`).
 * A browser has no verified source of a Google ID token, so on the web sign-in is reported as unavailable instead of faked.
 */
export interface IdentityProvider {
  readonly kind: 'native' | 'none';
  getIdToken(): Promise<string>;
}

interface NativePlugin {
  signIn(): Promise<{ idToken: string }>;
}
interface CapacitorWindow {
  Capacitor?: { Plugins?: { UomdGoogleSignIn?: NativePlugin } };
}

export class IdentityUnavailable extends Error {
  constructor() {
    super('Google sign-in is available in the Android app');
  }
}

export function detectIdentity(): IdentityProvider {
  const plugin = (window as unknown as CapacitorWindow).Capacitor?.Plugins?.UomdGoogleSignIn;
  if (plugin) return { kind: 'native', getIdToken: async () => (await plugin.signIn()).idToken };
  return {
    kind: 'none',
    getIdToken: () => Promise.reject(new IdentityUnavailable())
  };
}
