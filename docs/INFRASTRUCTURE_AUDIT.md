# Infrastructure Audit

Phase 1 of the master execution prompt. Every row below is backed by a command
or MCP call executed in the Claude Code Cloud session on **2026-10-03**.
No secret values were printed or recorded.

Status vocabulary: `VERIFIED`, `PARTIALLY_VERIFIED`, `UNVERIFIED`, `BLOCKED`,
`CLOUD_DEPENDENCY_GAP`, `DECISION_REQUIRED`.

---

## 1. Cloud Environment

| Item | Result | Status | Evidence |
|---|---|---|---|
| Shell / OS | Linux container, bash | VERIFIED | session env |
| Git | 2.43.0 | VERIFIED | `git --version` |
| Node / npm / npx | v22.22.0 / 10.9.4 | VERIFIED | `node --version` |
| Bun / pnpm | 1.3.14 / 10.28.0 | VERIFIED | `--version` |
| Python | 3.11.15 | VERIFIED | `python3 --version` |
| Java | present (JAVA_HOME set, proxy truststore configured) | VERIFIED | `java -version` |
| Docker CLI | 29.6.2 | VERIFIED (CLI only; daemon not exercised) | `docker --version` |
| psql | 16.14 | VERIFIED | `psql --version` |
| Playwright + Chromium | 1.56.1, browsers at `/opt/pw-browsers` | VERIFIED (binary) | `playwright --version` |
| gh / gcloud | present, proxy-preconfigured | VERIFIED (binary) | `--version` |
| **Wrangler** | not installed globally | MISSING — use `npx wrangler` (pinned devDependency) | `command -v wrangler` |
| **Neon CLI** | not installed | MISSING — Neon MCP covers read checks | `command -v neonctl` |
| **Godot 4.7.2** | not preinstalled; official `Godot_v4.7.2-stable_linux.x86_64.zip` downloads from GitHub releases and passes `SHA512-SUMS.txt`; reports `4.7.2.stable.official.ed1daf0bf` | VERIFIED (session scratch install) | `sha512sum -c`, `--version` |
| Outbound network | via agent proxy; GitHub release downloads OK; `api.github.com` for repos outside session scope returns 403 (scope policy, not network) | VERIFIED | `$HTTPS_PROXY/__agentproxy/status` |
| Setup script | none committed in repo; Godot must be fetched per session or in CI | CLOUD_DEPENDENCY_GAP (mitigated: CI downloads + verifies Godot) | — |

### Credentials present (names only, never values)

| Credential | Location | Status |
|---|---|---|
| GitHub | session git proxy + GitHub MCP | VERIFIED |
| Gemini / Google AI | **not** an env var; injected by the agent proxy for `*.googleapis.com` | VERIFIED (models list HTTP 200) |
| Cloudflare | Cloudflare MCP (OAuth) — no `CLOUDFLARE_API_TOKEN` env var | VERIFIED via MCP |
| Neon | Neon MCP (OAuth, ADMIN on project) — no `DATABASE_URL` env var | VERIFIED via MCP |
| Android keystore | none | EXPECTED (later release task) |

Consequence: `npx wrangler deploy` from this container would need a
`CLOUDFLARE_API_TOKEN`; the Cloudflare MCP can read/write resources but is not
a wrangler deploy credential. See §4 and `docs/DECISIONS.md`.

---

## 2. GitHub

| Item | Result | Status |
|---|---|---|
| Repository | `mucaeksi/unaware-of-my-demise`, **private**, default branch `main` | VERIFIED |
| Repo id | `1401200243`, created `2026-10-02T06:01:17Z` | VERIFIED |
| Remote `main` head at session start | `8797289` ("new") | VERIFIED (`git ls-remote`) |
| Session working branch | `claude/framework-bootstrap-setup-ahj0tz` (session-mandated; work lands on `main` via PR) | VERIFIED |
| GitHub Actions workflows | **none** (`.github/workflows/` absent, 0 runs) | VERIFIED |
| Branch protection / tags | no tags | VERIFIED |

Note: the master prompt says "work on main". This session is required by the
Claude Code Cloud harness to push to `claude/framework-bootstrap-setup-ahj0tz`
and open a PR. The PR is the reviewable checkpoint; merging to `main` is an
owner action.

---

## 3. Cloudflare

Account access through Cloudflare MCP: VERIFIED (read of Workers, Builds,
Hyperdrive, R2 succeeded).

### 3.1 Worker

| Item | Expected (master prompt) | Actual | Status |
|---|---|---|---|
| Name | `unaware-of-my-demise-api` | **`unaware-of-my-demise`** (id `d1778051ed6742ec88bb07f0ebcd980b`) | DECISION_REQUIRED (name mismatch) |
| Count | 1 | 1 (no duplicate) | VERIFIED |
| Deployed code | — | Cloudflare dashboard "Hello world" template (`source: dash_template`, 2026-10-01) | VERIFIED |
| Bindings | `HYPERDRIVE` (+ R2) | **none** | VERIFIED gap |
| compatibility_date / flags | — | `2026-10-01` / none (no `nodejs_compat`) | VERIFIED |
| workers.dev subdomain | — | disabled; previews disabled | VERIFIED |
| Routes / custom domains | — | none | VERIFIED |
| Observability | — | not configured | VERIFIED gap |
| Cloudflare Access | must be OFF for game API | not in front (no routes/domains at all) | VERIFIED |

The Worker currently has **no public endpoint** (no workers.dev, no route).

### 3.2 Workers Builds (Cloudflare CI)

| Item | Actual | Status |
|---|---|---|
| Trigger | root `server/`, build `npm run build`, deploy `npx wrangler deploy`, branch `main`, caching on | VERIFIED |
| Connected repo | `Unaware-of-My-Demise`, **repo_id `1395495121`** | VERIFIED |
| Current repo id | `1401200243` | VERIFIED |
| Build history | 6 builds 2026-10-01..02, **all `fail`**; their commits (`6400e58`, `d0f21b0`, `d9d5a14`, …) do not exist in the current repository | VERIFIED |

Conclusion: the Workers Builds trigger is bound to a **deleted predecessor
repository** and is orphaned. It will not fire for the current repo. Even if
reconnected, it would fail: `server/` is a Node/Fastify server (no
`wrangler.toml`, native `argon2`, `app.listen`). See `docs/CURRENT_STATE.md`.

Canonical deploy path: **DECISION_REQUIRED** — recorded as DEC-0003 in
`docs/DECISIONS.md` with a recommendation (GitHub Actions + wrangler, and
disconnect the orphaned Workers Builds trigger in the dashboard).

### 3.3 Hyperdrive

| Item | Actual | Status |
|---|---|---|
| ID | `edbe90afd0ab42a1ab708e7e2e49c04b` (matches) | VERIFIED |
| Name | `unaware-of-my-demise-production` | VERIFIED |
| Origin | Neon `ep-quiet-hill-b21qpl4j.c-6.eu-central-1.aws.neon.tech:5432`, db `UOMD`, user `hyperdrive-user` | VERIFIED |
| Origin connection limit | 20 | VERIFIED |
| Query caching | disabled (correct for transactional game state) | VERIFIED |
| Duplicates | none (1 config) | VERIFIED |
| Bound to Worker | **no** | VERIFIED gap |

### 3.4 R2

| Item | Actual | Status |
|---|---|---|
| Bucket | `unaware-of-my-demise-content`, Standard, location EEUR, default jurisdiction | VERIFIED |
| r2.dev public URL | **disabled** | VERIFIED |
| Custom domains | none | VERIFIED |
| Duplicates | none (1 bucket) | VERIFIED |
| Bound to Worker | **no** | VERIFIED gap |
| Patch pipeline usage | not implemented | VERIFIED gap |

---

## 4. Neon

| Item | Expected | Actual | Status |
|---|---|---|---|
| Project | `sweet-cake-52313810` | "Unaware of My Demise", aws-eu-central-1, PG **18.6**, plan `free_v3` | VERIFIED |
| Branch | `production` | `br-aged-grass-b2a0ukkk`, primary/default, **not protected** | VERIFIED |
| Database | `UOMD` | present, owner `UOMD_owner` | VERIFIED |
| Roles | — | `UOMD_owner`, `hyperdrive-user` (password auth) | VERIFIED |
| `public` schema | — | **0 tables** (no game schema applied) | VERIFIED |
| **Neon Auth** | must NOT be enabled | **`neon_auth` schema exists with 9 tables** (`user`, `session`, `account`, `jwks`, …); `neon_auth.user` has 0 rows | DECISION_REQUIRED |
| Autoscaling | — | 0.25–2 CU, suspend timeout 0 (default) | VERIFIED |
| History retention | — | 6 h (free plan) | VERIFIED |
| IP allow-list | — | empty; public connections allowed | NOTE (Hyperdrive needs public access unless private networking is configured) |

Only read-only SQL was executed:
`SELECT … FROM pg_namespace/pg_class … ; SELECT count(*) FROM neon_auth."user"`.

Neon Auth appears to have been provisioned at project creation through the
console. Disabling it is a destructive external change and is **not** done
autonomously — see DEC-0002.

Recommendation recorded for the owner: mark `production` as a protected branch.

---

## 5. Gemini (development-time only)

| Item | Result | Status |
|---|---|---|
| Reachability | `GET generativelanguage.googleapis.com/v1beta/models` → HTTP 200, 61 models | VERIFIED |
| Key handling | no key in env or repo; proxy-injected | VERIFIED |
| Nano Banana 2 | `models/gemini-3.1-flash-image` (displayName "Nano Banana 2"; GA). Preview twin `gemini-3.1-flash-image-preview`; Lite `gemini-3.1-flash-lite-image` | VERIFIED |
| TTS candidates | `gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`, `gemini-3.1-flash-tts-preview`, `gemini-2.5-flash/pro-preview-tts` | VERIFIED (listing) |
| Lyria candidates | `lyria-3.5`, `lyria-3-pro-preview`, `lyria-3-clip-preview`, `lyria-realtime-exp` | VERIFIED (listing) |
| Generation call | not executed in Phase 1 (no reference set yet) | UNVERIFIED |

Repository violation found: `server/src/ai.ts` imports `@google/genai` and
reads `GEMINI_API_KEY` at runtime — a Gemini **runtime** integration in the
backend, which the architecture forbids. It is not imported by
`server/src/index.ts`. Tracked in `docs/CURRENT_STATE.md` (removal is part of
the Worker rewrite).

Model pinning per medium is DEC-0004 (see `docs/DECISIONS.md`); the LEGACY
archive already contains Gemini TTS voice auditions and Lyria-style BGM, which
must be audited before a voice/music model is pinned.

---

## 6. Godot cloud/headless validation

| Check | Result | Status |
|---|---|---|
| Binary | 4.7.2 official, SHA-512 verified | VERIFIED |
| `--headless --import` on a scratch copy of `game/` | runs; reports parse error in `patch_manager.gd` | VERIFIED (project broken) |
| `--headless --quit-after 5` | autoload `PatchManager` fails; `main.gd` crashes on Nil | VERIFIED (project broken) |
| Android export templates / SDK | not installed in session | UNVERIFIED |
| Android AAB build | not attempted | UNVERIFIED |

Details in `docs/CURRENT_STATE.md`. Headless Godot is confirmed to be a viable
cloud validation path (no GUI needed).

---

## 7. Google Drive LEGACY

See `docs/DRIVE_LEGACY_ACCESS.md` (DRIVE_ACCESS_STATUS).

---

## 8. Security observations

| # | Observation | Severity | Action |
|---|---|---|---|
| S1 | `server/src/index.ts` falls back to JWT secret `"dev"` when `JWT_SECRET` is unset | HIGH | fix in Worker rewrite; never deploy as-is |
| S2 | Admin auth = single shared `x-admin-token`, non-constant-time compare, actor logged as `"admin"` | HIGH | RBAC + per-admin identity (roadmap) |
| S3 | `gacha_draws.request_id` is globally unique and lookup is not scoped by player → another player's draw result can be returned for a reused UUID | HIGH | scope idempotency key by player |
| S4 | No rate limiting on auth/gacha/admin | HIGH | Worker rate limiting |
| S5 | `/content/:file` and manifest served unsigned from local disk | MEDIUM | signed manifest + R2 |
| S6 | LEGACY Drive contains a folder named `narrative/.secrets` | HIGH (owner) | contents deliberately NOT read; owner should verify nothing sensitive is stored in Drive |
| S6b | LEGACY Drive folder link-shared to `anyone` as **writer** | CRITICAL (owner) | restrict sharing (OQ-000) |
| S7 | Neon `production` branch not protected | MEDIUM | owner toggle |
| S8 | Gemini runtime code in backend (`server/src/ai.ts`) | MEDIUM | remove with Worker rewrite |

No secrets were found committed in the current repository tree
(`.env.example` contains placeholders only).
