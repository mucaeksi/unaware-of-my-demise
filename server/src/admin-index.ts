// The admin Worker (INF-033, DEC-0033): its own deployment (server/wrangler.admin.jsonc), meant to sit behind
// Cloudflare Access. It serves the static operator panel (admin/out) and the admin API (/admin/api/*) on one origin,
// talking to the game database through its own Hyperdrive binding. The game Worker has no admin routes at all.
import { Client } from "pg";
import { createAdminApp } from "./admin";
import { AccessJwtVerifier, type AdminVerifier } from "./admin-auth";
import type { DbConnection } from "./db";
import { parseReleaseConfig } from "./release";

export interface AdminEnv {
  HYPERDRIVE: Hyperdrive;
  ASSETS: Fetcher;
  /** <team>.cloudflareaccess.com; empty = Access is not set up yet: the API answers 503. */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Access application's audience tag (64 hex); empty = 503. */
  ACCESS_AUD?: string;
  /** Recorded with every audit row: production, staging. */
  ADMIN_ENVIRONMENT?: string;
  RELEASE_SOURCE_SHA?: string;
}

let verifierFor: { key: string; verifier: AdminVerifier | null } | null = null;

/** One verifier per isolate and configuration, so Access's signing keys stay cached between requests. */
function verifier(env: AdminEnv): AdminVerifier | null {
  const key = `${env.ACCESS_TEAM_DOMAIN ?? ""}|${env.ACCESS_AUD ?? ""}`;
  if (verifierFor?.key !== key) {
    const configured = Boolean(env.ACCESS_TEAM_DOMAIN?.trim()) && Boolean(env.ACCESS_AUD?.trim());
    verifierFor = { key, verifier: configured ? new AccessJwtVerifier(env.ACCESS_TEAM_DOMAIN!, env.ACCESS_AUD!.trim()) : null };
  }
  return verifierFor.verifier;
}

export default {
  async fetch(request: Request, env: AdminEnv): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/admin/api/")) return env.ASSETS.fetch(request);
    const app = createAdminApp({
      connect: async (): Promise<DbConnection> => {
        const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
        await client.connect();
        return Object.assign(client, { release: () => client.end() });
      },
      verifier: verifier(env),
      environment: (env.ADMIN_ENVIRONMENT ?? "").trim() || "production",
      release: parseReleaseConfig(env),
    });
    const response = await app(request);
    response.headers.set("cache-control", "no-store");
    response.headers.set("x-content-type-options", "nosniff");
    return response;
  },
} satisfies ExportedHandler<AdminEnv>;
