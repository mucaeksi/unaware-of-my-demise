// Worker entry: one Hyperdrive-backed pg client per request (Hyperdrive pools the origin connections).
import { Client } from "pg";
import { createApp } from "./app";
import type { DbConnection } from "./db";
import type { Env } from "./env";
import { GoogleIdTokenVerifier, type IdentityVerifier } from "./identity";
import { bannerEpoch } from "./gacha";
import { parseReleaseConfig } from "./release";
import { CHANNELS } from "./content";
import { runRetention } from "./retention";
import { engineSimulate } from "./stages";
import { HttpAdmobKeys } from "./ads";

let verifierFor: { audiences: string; verifier: IdentityVerifier | null } | null = null;
/** Google's AdMob verifier keys, kept per isolate (fetched on the first callback). */
const admobKeys = new HttpAdmobKeys();

/** One verifier per isolate and configuration, so Google's signing keys stay cached between requests. */
function verifier(env: Env): IdentityVerifier | null {
  if (verifierFor?.audiences !== env.GOOGLE_CLIENT_IDS) {
    const audiences = (env.GOOGLE_CLIENT_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
    verifierFor = { audiences: env.GOOGLE_CLIENT_IDS, verifier: audiences.length > 0 ? new GoogleIdTokenVerifier(audiences) : null };
  }
  return verifierFor.verifier;
}

/** The configured content channel; anything but a known channel name is a deployment mistake, refused loudly. */
function contentChannel(value: string | undefined): string {
  const channel = (value ?? "").trim() || "production";
  if (!(CHANNELS as readonly string[]).includes(channel)) throw new Error(`CONTENT_CHANNEL must be one of ${CHANNELS.join(", ")}`);
  return channel;
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
      content: env.CONTENT ?? null,
      contentChannel: contentChannel(env.CONTENT_CHANNEL),
      // GOOGLE_CLIENT_IDS holds the Web OAuth client id (docs/GITHUB_SECRETS.md): the deletion page signs in with it.
      webClientId: (env.GOOGLE_CLIENT_IDS ?? "").split(",").map((id) => id.trim()).find(Boolean) ?? null,
      admobKeys,
      admobAdUnits: (env.ADMOB_AD_UNIT_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean),
    });
    return app(request);
  },

  /** The data lifecycle job (INF-016, `triggers.crons` in wrangler.jsonc); its report goes to the Worker logs. */
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
    await client.connect();
    try {
      console.log(JSON.stringify({ event: "retention", ...(await runRetention(client)) }));
    } finally {
      await client.end();
    }
  },
} satisfies ExportedHandler<Env>;
