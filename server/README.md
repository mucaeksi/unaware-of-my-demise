# Game API (Cloudflare Worker)

The server-authoritative API of Unaware of My Demise (DEC-0012, DEC-0013). It is a TypeScript Worker that reaches Neon
PostgreSQL through Hyperdrive (binding `HYPERDRIVE`). Routes, payload names and the error shape follow the LEGACY FastAPI
server (`docs/LEGACY_AUDIT.md` §9). The schema lives in `database/migrations/`.

## Implemented

| Route | Purpose |
|---|---|
| `GET /healthz` | Liveness check, including a database round trip. |
| `POST /v1/auth/nonce` | Issues a single-use sign-in nonce, valid for 300 s. |
| `POST /v1/auth/google` | Verifies a Google ID token (signature, issuer, audience, expiry), then consumes its nonce. Creates the account on the first sign-in and returns an opaque session token valid for 3600 s. |
| `GET /v1/account` | Returns the profile: friend code, nickname, avatar, badge, presence opt-in. |
| `GET /v1/wallet` | Returns the currency balances. |
| `GET /v1/state` | Returns the player snapshot the Godot client renders (`game/scripts/app/player_state.gd`). |

Errors use the shape `{"error": {"code", "message"}}`. The codes are `UNAUTHORIZED`, `INVALID_REQUEST`, `RATE_LIMITED`,
`SERVICE_UNAVAILABLE`, `ITEM_NOT_FOUND`, `HTTP_ERROR` and `INTERNAL_ERROR`.

Security properties:
- The Google `sub` and the session tokens are stored only as SHA-256 hashes.
- Account ids are random and minted on the server.
- Request bodies are capped at 16 KiB.
- Rate limits apply per client IP: 20/min for sign-in and 240/min for everything else. `/healthz` is exempt.

## Next

The mutating game endpoints are not implemented yet: story, stage attempts with server re-simulation, progression,
equipment, gacha, quests, billing, ads and social. They will reuse the LEGACY idempotency model (a UUIDv4
`Idempotency-Key` with a request fingerprint) and run one transaction per request that locks the account row.

## Commands

```sh
npm ci
npm run check        # tsc
TEST_ADMIN_DATABASE_URL=postgres://user@host/postgres npm test   # needs a disposable PostgreSQL; never production
npm run build        # wrangler dry-run bundle
```

Configuration:
- `GOOGLE_CLIENT_IDS` (a var in `wrangler.jsonc`) lists the accepted OAuth client ids, comma-separated. While it is
  empty, sign-in answers 503.
- No secrets live in this directory.
- Deploys go through GitHub Actions (DEC-0003). The Worker name `unaware-of-my-demise` is the existing Worker.
