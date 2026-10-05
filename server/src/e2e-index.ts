// End-to-end test entry (INF-042, DEC-0035): the game Worker exactly as production builds it, except that sign-in
// accepts test credentials "e2e:<subject>|<nonce>" instead of Google ID tokens. Used only by `wrangler dev` with
// server/wrangler.e2e.jsonc against a disposable local database (server/e2e/run.sh); never deployed — the production
// config (wrangler.jsonc) points at src/index.ts, and deploy.yml refuses a config whose main is this file.
import worker from "./index";
import { createApp } from "./app";
import type { DbConnection } from "./db";
import type { Env } from "./env";
import type { IdentityVerifier } from "./identity";
import { IdentityVerificationError } from "./identity";
import { bannerEpoch } from "./gacha";
import { parseReleaseConfig, ReleaseControlCache } from "./release";
import { engineSimulate } from "./stages";
import { Client } from "pg";

const testVerifier: IdentityVerifier = {
  verify: async (credential) => {
    const match = /^e2e:([A-Za-z0-9_-]{1,64})\|(.+)$/.exec(credential);
    if (!match) throw new IdentityVerificationError("not an e2e test credential");
    return { provider: "google_oidc", subject: `e2e-${match[1]}`, nonce: match[2]! };
  },
};

/** As in production (src/index.ts): the admin release control, cached per isolate. */
const releaseControl = new ReleaseControlCache();

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const app = createApp({
      connect: async (): Promise<DbConnection> => {
        const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
        await client.connect();
        return Object.assign(client, { release: () => client.end() });
      },
      verifier: testVerifier,
      waitUntil: (promise) => ctx.waitUntil(promise),
      simulate: engineSimulate,
      bannerEpoch: bannerEpoch(env.BANNER_EPOCH),
      release: parseReleaseConfig(env),
      releaseControl,
    });
    return app(request);
  },
  scheduled: worker.scheduled,
} satisfies ExportedHandler<Env>;
