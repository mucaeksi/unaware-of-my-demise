// Provider identity verification (LEGACY server/identity.py): a verifier only proves which provider identity signed a
// credential; the nonce-replay policy is enforced by the sign-in route.
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface VerifiedIdentity {
  provider: string;
  subject: string;
  /** The credential's `nonce` claim, if it carried one. */
  nonce: string | null;
}

export interface IdentityVerifier {
  verify(credential: string): Promise<VerifiedIdentity>;
}

export class IdentityVerificationError extends Error {}

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Verifies a Google ID token: signature (Google's published keys), issuer, audience (our client IDs) and expiry. */
export class GoogleIdTokenVerifier implements IdentityVerifier {
  constructor(private readonly audiences: string[]) {
    if (audiences.length === 0) throw new Error("at least one Google OAuth client ID is required");
  }

  async verify(credential: string): Promise<VerifiedIdentity> {
    let payload;
    try {
      ({ payload } = await jwtVerify(credential, GOOGLE_JWKS, { issuer: GOOGLE_ISSUERS, audience: this.audiences }));
    } catch (error) {
      throw new IdentityVerificationError(`Invalid Google ID token: ${(error as Error).message}`);
    }
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new IdentityVerificationError("Google ID token has no 'sub' claim");
    }
    return { provider: "google_oidc", subject: payload.sub, nonce: typeof payload.nonce === "string" ? payload.nonce : null };
  }
}
