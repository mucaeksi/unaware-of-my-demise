# Game API (Cloudflare Worker)

Production: `https://unaware-of-my-demise.muratcaneksiii.workers.dev` (deployed from `main` by `.github/workflows/deploy.yml`, DEC-0003).

The server-authoritative API of Unaware of My Demise (DEC-0012, DEC-0013). It is a TypeScript Worker that reaches Neon
PostgreSQL through Hyperdrive (binding `HYPERDRIVE`). Routes, payload names and the error shape follow the LEGACY FastAPI
server (`docs/LEGACY_AUDIT.md` §9). The schema lives in `database/migrations/`.

## Implemented

| Route | Purpose |
|---|---|
| `GET /healthz` | Liveness check, including a database round trip. |
| `GET /v1/bootstrap` | The release contract (INF-003, `src/release.ts`), unauthenticated and outside the update/maintenance gate: `{api_version, snapshot_schema_version, min_client_version_code, rules_hash, source_sha, maintenance: {active, message}, server_time_utc}`. `rules_hash` is the SHA-256 of `"<file> <sha256>\n"` lines of the rules packs in `game/data/content/MANIFEST.json`; the client (`game/scripts/app/client_release.gd`) refuses to play on any mismatch. |
| `POST /v1/auth/nonce` | Issues a single-use sign-in nonce, valid for 300 s. |
| `POST /v1/auth/google` | Verifies a Google ID token (signature, issuer, audience, expiry), then consumes its nonce. Creates the account on the first sign-in and returns an opaque session token valid for 3600 s. |
| `GET /v1/account` | Returns the profile: friend code, nickname, avatar, badge, presence opt-in. |
| `GET /v1/wallet` | Returns the currency balances (one consistent read). |
| `GET /v1/state` | Returns the player snapshot the Godot client renders (`game/scripts/app/player_state.gd`), read in one `REPEATABLE READ READ ONLY` transaction so it never mixes states from before and after a concurrent mutation. `state_revision` grows by one with every committed mutation of the account (migration 0003); the client never adopts a lower one. `open_attempt` is the battle opened but not reported (`{attempt_id, stage_id, run_seed, roster, inputs}` or null); after a restart the client re-runs it from those frozen inputs. |
| `POST /v1/story/advance` | Moves the story past the current narrative entry. A stage entry, the end of the story and a pending First Oath are refused with 409. |
| `POST /v1/story/first-oath` | Takes `{character_id}` and claims the one-time First Oath hero from the manifest's selector pool. The claim is recorded in `story_claims` and the hero joins the roster. |
| `POST /v1/stages/{stage_id}/attempts` | Takes `{roster}` and opens a battle attempt. The stage must be the story's current entry or one already cleared; the First Oath must be resolved; the roster must be legal (`StoryRules.resolveBattleRoster`). The server freezes the player's build and owned heroes, checks the stage's Ration cost (402 `INSUFFICIENT_FUNDS`, nothing spent), picks a CSPRNG seed below 2^53 and answers `{attempt: {attempt_id, stage_id, run_seed}, state}`. Older open attempts expire. |
| `POST /v1/attempts/{attempt_id}/victory` | Takes the client's `{outcome: "victory", stars, actions, cycles}` (informational) and re-runs the attempt with the bundled battle engine. Only the server's own victory pays, in one transaction (docs/LEGACY_AUDIT.md 9.4): the stage's Ration (DEC-0014), loot from a fresh reward seed, the first-clear claim ledger, the reward writes, quest events for Ration-costing wins, story rewards and recruits, and the cursor on a first clear. Answers `{applied, first_clear, result, state}`; a run that does not verify gets 409. |
| `POST /v1/attempts/{attempt_id}/abandon` | Gives up an open attempt (a defeat, or a battle the player chose not to resume): it becomes `lost` and pays nothing. Abandoning a lost/expired attempt changes nothing; a won one is 409. Answers `{attempt_status, state}`. |
| `GET /v1/operations/{key}` | INF-013: whether the account's mutation with this Idempotency-Key committed. 200 `{operation_key, endpoint, committed_at_utc, response}` (the stored reply) or 404. A request still running is not visible yet; resending it with the same key is always safe. |
| `POST /v1/roster/{character_id}/level-up` | Takes `{items: {xp_item_id: count}}` and applies every affordable level (LEGACY `level_up_character`): Character XP from Chronicle items, Silver Crowns per level, ascension gates (account level, gate items, ascension Crowns). An unpaid step stops leveling with `stopped_reason` and keeps the XP. A level gained counts the `successful_level_up` daily task. |
| `POST /v1/roster/{character_id}/skills/{skill_id}/upgrade` | Raises one skill rank for its character level, Silver Crowns and item cost (draft_v1). |
| `POST /v1/roster/{character_id}/memory-nodes` | Unlocks the hero's next Memory Node with that hero's Memory Shards. |
| `POST /v1/inventory/{table}/{instance_id}/equip` | Takes `{character_id}` and equips an owned instance on an owned hero, replacing that slot's holder. Weapons must pass `canEquipWeapon`; armor and accessories must match their slots. |
| `POST /v1/inventory/{table}/{instance_id}/unequip` | Unequips an equipped instance. |
| `POST /v1/inventory/{table}/{instance_id}/lock` | Takes `{locked}`; an accessory's payload copy follows the column. |
| `POST /v1/inventory/inventory_weapons/{instance_id}/dismantle` | Deletes an unequipped, unlocked, dismantlable weapon and grants its `dismantle_output` plus `dismantle_xp` Weapon Tempering XP, in one transaction. |
| `POST /v1/inventory/{table}/{instance_id}/level-up` | Takes `{target_levels}` (default 1) for weapons and armor: spends only the Tempering XP still needed, per-step Silver Crowns and milestone Blacksmith Rivets; an unpaid step stops with `stopped_reason` and the item keeps its XP. A level gained counts the `successful_level_up` daily task. |
| `POST /v1/inventory/inventory_accessories/{instance_id}/reroll` | Rerolls a rerollable accessory's sub-stats for its reroll tokens with a fresh CSPRNG seed (main stat kept, locked items refused). |
| `GET /v1/quests/status` | The server-clock claim scope (half-day window, active weekly segment), the keys claimed in it, the weekly mailbox (finished segments within `completed_unclaimed_mail_days`) and the verified progress of every counted task. |
| `POST /v1/quests/claim` | Takes `{kind: "daily"\|"weekly", task_id, period?}` and pays a reward once per window (`quest_claims`; LEGACY `server/quests.py`). Gameplay tasks pay only when their verified progress reached the target. The window chest needs both daily tasks claimed. The grant covers Eclipse Tokens, Silver Crowns, Account XP and Character XP (as Chronicle items). A repeat claim returns the original grant. |
| `GET /v1/gacha/banners` | The open banner windows (rotation from `BANNER_EPOCH`; empty = undated development rotation) with the account's pity, next-pull odds and guarantee (LEGACY `server/banner_status.py`). |
| `GET /v1/gacha/pity` | The stored pity state per banner type (`character`, `weapon`, `standard_character`; `{}` before the first pull). |
| `GET /v1/gacha/history?limit=&before=` | The account's pulls, newest first (limit 1..200, default 50; `next_cursor` feeds `before`). |
| `POST /v1/gacha/pull` | Takes `{banner_id, pull_count: 1\|10, target_id?}` (target = Hall of Armaments weapon). One transaction: pity read, every pull resolved by the parity-tested `engine/gacha.ts` from a fresh CSPRNG seed, Fate's Threads debited (402 `INSUFFICIENT_FUNDS`, nothing written), characters granted (duplicates become copies plus Memory Shards; a first copy joins the story state's owned/online heroes), weapons minted as `wpn_` instances, each pull recorded in `pull_history` with the request's `rng_seed`, pity saved. Answers `{pull, state}`. Closed banners, bad counts and a missing target are 400. |
| `POST /v1/ration/inn-meal` | The daily Inn Meal: `daily_inn_meal` (30) Ration once per UTC day, recorded in `quest_claims`. A repeat the same day answers `already_claimed: true` and grants nothing. The snapshot's `ration.inn_meal {amount, available}` drives the hub button. |
| `POST /v1/wallet/convert` | Takes `{count}` (1..1000) and converts Eclipse Tokens into Fate's Threads at `token_conversion_cost` (160) each, one way. |

Mutating routes require a UUIDv4 `Idempotency-Key`. Each request is one transaction that locks the account row, so a
retried request replays its stored response, and a key reused for another account, endpoint or body gets 409. Mutating
routes answer `{"state": <snapshot>}`, the client's `GameBackend` contract. The story rules are checked against the
Python reference walk in `parity/fixtures/story_flow.json`.

Every route except `/healthz` and `/v1/bootstrap` passes the release gate first: a request whose `X-Client-Version-Code`
is below `MIN_CLIENT_VERSION_CODE` gets 426 `UPDATE_REQUIRED` (the header is optional; the Godot client always sends
it), and a non-empty `MAINTENANCE_MESSAGE` answers 503 `MAINTENANCE` with that message.

Errors use the shape `{"error": {"code", "message"}}`. The codes are `UPDATE_REQUIRED` (426), `MAINTENANCE` (503), `UNAUTHORIZED`, `INVALID_REQUEST`, `INSUFFICIENT_FUNDS` (402, Ration or Fate's Threads), `RATE_LIMITED`,
`SERVICE_UNAVAILABLE`, `CONFLICT`, `PROGRESSION` and `EQUIPMENT` (409, a request the rules refuse; the client shows the message), `ITEM_NOT_FOUND`, `HTTP_ERROR` and `INTERNAL_ERROR`.

Security properties:
- The Google `sub` and the session tokens are stored only as SHA-256 hashes.
- Account ids are random and minted on the server.
- Request bodies are capped at 16 KiB.
- Rate limits apply per client IP: 20/min for sign-in and 240/min for everything else. `/healthz` is exempt.

## Next

Ration (DEC-0014): cap 100, 1 unit / 300 s regenerated on read, spent only by verified victories; `/v1/state` carries the meter.

Not implemented yet: billing, ads and social. They go through the same `mutate` helper in `src/app.ts`.

## Commands

```sh
npm ci
npm run check        # tsc
TEST_ADMIN_DATABASE_URL=postgres://user@host/postgres npm test   # needs a disposable PostgreSQL; never production
npm run build        # wrangler dry-run bundle
```

Configuration:
- `GOOGLE_CLIENT_IDS` lists the accepted OAuth client ids (the Web client the Android app passes as its server client id),
  comma-separated. Production takes them from the GitHub repository variable (or secret) of the same name: the Deploy workflow checks the format
  without printing it and passes it with `wrangler deploy --var`. `wrangler.jsonc` keeps it empty, and while it is empty
  sign-in answers 503. After each deploy the workflow expects a forged credential to get 401 (or 503 without the secret).
- No secrets live in this directory.
- Deploys go through `.github/workflows/deploy.yml` (DEC-0003). The Worker name is `unaware-of-my-demise` (DEC-0001).
