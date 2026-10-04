// Worker entry: one Hyperdrive-backed pg client per request (Hyperdrive pools the origin connections).
import { Client } from "pg";
import { createApp } from "./app";
import type { DbConnection } from "./db";
import type { Env } from "./env";
import { GoogleIdTokenVerifier, type IdentityVerifier } from "./identity";
import { bannerEpoch } from "./gacha";
import { parseReleaseConfig } from "./release";
import { engineSimulate } from "./stages";

let verifierFor: { audiences: string; verifier: IdentityVerifier | null } | null = null;

/** One verifier per isolate and configuration, so Google's signing keys stay cached between requests. */
function verifier(env: Env): IdentityVerifier | null {
  if (verifierFor?.audiences !== env.GOOGLE_CLIENT_IDS) {
    const audiences = (env.GOOGLE_CLIENT_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    verifierFor = { audiences: env.GOOGLE_CLIENT_IDS, verifier: audiences.length > 0 ? new GoogleIdTokenVerifier(audiences) : null };
  }
  return verifierFor.verifier;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const app = createApp({
      connect: async (): Promise<DbConnection> => {
        const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
        await client.connect();
        return Object.assign(client, { release: () => client.end() });
      },
      verifier: verifier(env),
      authLimiter: env.AUTH_LIMITER,
      apiLimiter: env.API_LIMITER,
      waitUntil: (promise) => ctx.waitUntil(promise),
      simulate: engineSimulate,
      bannerEpoch: bannerEpoch(env.BANNER_EPOCH),
      release: parseReleaseConfig(env),
    });
    return app(request);
  },
} satisfies ExportedHandler<Env>;
