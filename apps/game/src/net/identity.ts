import { GOOGLE_WEB_CLIENT_ID } from '../config';
import { GoogleSignIn, isNative } from '../platform/native';

/**
 * Google identity comes from the native Android shell (Credential Manager through the Capacitor plugin `UomdGoogleSignIn`)
 * or, on web staging when `VITE_GOOGLE_WEB_CLIENT_ID` is configured, from Google Identity Services (GIS) returning a genuine
 * Google-signed ID JWT verified by `/api/v1/auth/google`. Without configured credentials, web sign-in fails closed.
 */
export interface IdentityProvider {
  readonly kind: 'native' | 'web' | 'none';
  getIdToken(): Promise<string>;
  /** forgets the chosen Google account on the device (the server session is revoked separately) */
  forget(): Promise<void>;
}

export class IdentityUnavailable extends Error {
  readonly code = 'identity_unavailable';
  constructor(message = 'Google sign-in is available in the Android app or a configured staging web build') {
    super(message);
  }
}

interface GisPromptNotification {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
  getDismissedReason?: () => string;
}

interface GoogleIdentityWindow {
  google?: {
    accounts?: {
      id?: {
        initialize(config: {
          client_id: string;
          callback: (response: { credential?: string }) => void;
          use_fedcm_for_prompt?: boolean;
          cancel_on_tap_outside?: boolean;
        }): void;
        prompt(momentListener?: (notification: GisPromptNotification) => void): void;
        disableAutoSelect(): void;
      };
    };
  };
}

let gisScriptPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new IdentityUnavailable());
  }
  const win = window as unknown as GoogleIdentityWindow;
  if (win.google?.accounts?.id) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-uomd-gis="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => {
        gisScriptPromise = null;
        reject(new Error('Google Identity Services script could not be loaded'));
      }, { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.dataset.uomdGis = '1';
    s.onload = () => resolve();
    s.onerror = () => {
      gisScriptPromise = null;
      reject(new Error('Google Identity Services script could not be loaded'));
    };
    document.head.appendChild(s);
  });
  return gisScriptPromise;
}

export function requestWebGoogleIdToken(clientId: string): Promise<string> {
  return loadGisScript().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const gis = (window as unknown as GoogleIdentityWindow).google?.accounts?.id;
        if (!gis) {
          reject(new IdentityUnavailable('Google Identity Services is unavailable in this browser'));
          return;
        }
        let settled = false;
        const finish = (fn: () => void): void => {
          if (settled) return;
          settled = true;
          fn();
        };
        gis.initialize({
          client_id: clientId,
          use_fedcm_for_prompt: true,
          cancel_on_tap_outside: false,
          callback: (res) => {
            if (res?.credential && res.credential.length >= 100) {
              finish(() => resolve(res.credential!));
            } else {
              finish(() => reject(Object.assign(new Error('Google ID token was not returned'), { code: 'bad_token' })));
            }
          }
        });
        gis.prompt((notification) => {
          if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
            finish(() => reject(Object.assign(new Error('Google sign-in prompt was not displayed or no Google session is active'), { code: 'no_account' })));
          } else if (notification.isDismissedMoment?.() && notification.getDismissedReason?.() !== 'credential_returned') {
            finish(() => reject(Object.assign(new Error('Sign-in was cancelled'), { code: 'canceled' })));
          }
        });
      })
  );
}

export function detectIdentity(webClientId = GOOGLE_WEB_CLIENT_ID): IdentityProvider {
  if (isNative()) {
    return {
      kind: 'native',
      getIdToken: async () => (await GoogleSignIn.signIn()).idToken,
      forget: () => GoogleSignIn.signOut().catch(() => undefined)
    };
  }
  const trimmed = webClientId.trim();
  if (trimmed.length > 0) {
    return {
      kind: 'web',
      getIdToken: () => requestWebGoogleIdToken(trimmed),
      forget: async () => {
        try {
          (window as unknown as GoogleIdentityWindow).google?.accounts?.id?.disableAutoSelect();
        } catch {
          /* ignore */
        }
      }
    };
  }
  return {
    kind: 'none',
    getIdToken: () => Promise.reject(new IdentityUnavailable()),
    forget: () => Promise.resolve()
  };
}
