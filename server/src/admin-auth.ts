// Operator sign-in for the admin panel (INF-033, DEC-0033): Cloudflare Access in front of the admin Worker does the
// login (SSO / one-time PIN, MFA per the Access policy); the Worker verifies the Access JWT on every request and then
// looks the e-mail up in admin_users for the role. The panel has no passwords, sessions or tokens of its own.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AdminIdentity {
  email: string;
}

export interface AdminVerifier {
  /** The verified operator of `request`, or throws AdminAuthError. */
  verify(request: Request): Promise<AdminIdentity>;
}

export class AdminAuthError extends Error {}

/** The header Cloudflare Access adds to every request it lets through to the origin. */
export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";

/**
 * Verifies the Cloudflare Access application token: RS256 signature by the team's published keys, issuer (the team
 * domain), audience (the application's AUD tag), expiry. Only a token Access itself issued for this application passes.
 */
export class AccessJwtVerifier implements AdminVerifier {
  private readonly issuer: string;
  private readonly keys: JWTVerifyGetKey;

  constructor(
    teamDomain: string,
    private readonly audience: string,
    keys?: JWTVerifyGetKey,
  ) {
    const team = teamDomain.trim().replace(/^https:\/\//, "").replace(/\/+$/, "");
    if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team)) throw new Error("ACCESS_TEAM_DOMAIN must look like <team>.cloudflareaccess.com");
    if (!/^[0-9a-f]{64}$/.test(audience)) throw new Error("ACCESS_AUD must be the 64-hex Access application audience tag");
    this.issuer = `https://${team}`;
    this.keys = keys ?? createRemoteJWKSet(new URL(`${this.issuer}/cdn-cgi/access/certs`));
  }

  async verify(request: Request): Promise<AdminIdentity> {
    const token = request.headers.get(ACCESS_JWT_HEADER) ?? "";
    if (!token) throw new AdminAuthError("No Cloudflare Access token");
    let payload;
    try {
      ({ payload } = await jwtVerify(token, this.keys, { issuer: this.issuer, audience: this.audience, algorithms: ["RS256"] }));
    } catch (error) {
      throw new AdminAuthError(`Invalid Cloudflare Access token: ${(error as Error).message}`);
    }
    if (typeof payload.email !== "string" || !payload.email.includes("@")) throw new AdminAuthError("The Access token carries no e-mail");
    return { email: payload.email.toLowerCase() };
  }
}
