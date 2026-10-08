# Admin panel (INF-033/034, DEC-0033)

The operator panel is its own Worker, `unaware-of-my-demise-admin` (`server/src/admin-index.ts`,
`server/wrangler.admin.jsonc`), deployed with every production deploy. It serves the static Next.js page
(`admin/`, `next build` → `admin/out`) and the admin API (`/admin/api/*`, `server/src/admin.ts`) on one origin.
The game Worker has no admin routes.

## Sign-in and roles

- **Cloudflare Access** in front of the admin Worker's workers.dev host does the sign-in (one-time PIN or an identity
  provider; MFA per the Access policy). The panel has no passwords, sessions or tokens of its own.
- The API verifies the Access token (`Cf-Access-Jwt-Assertion`: RS256, the team's keys, issuer, the application's
  audience tag) on every request, then looks the e-mail up in `admin_users` (migration 0008).
- Roles: `viewer` (service, player reads), `support` (+ support actions), `operator` (+ audit trail).
- Without `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` the API answers 503 to everyone.

## What it does

| Route | Permission | Audited |
|---|---|---|
| `GET /admin/api/me`, `GET /admin/api/service` (release, schema version, account and session counts) | service.read | no |
| `GET /admin/api/players?query=<acct_…|XXXX-XXXX>` (exact match only, no listing) | player.read | `read.player_search` |
| `GET /admin/api/players/{id}/state` · `/journal` · `/pulls` · `/claims` | player.read | `read.player_*` |
| `POST /admin/api/players/{id}/revoke-sessions` (reason + Idempotency-Key) | player.support | `support.revoke_sessions`, same transaction |
| `GET /admin/api/reports?status=open\|all&before=` | player.read | `read.reports` (player reports with both players' nicknames, the reported friend code and how often that player was reported) |
| `POST /admin/api/reports/{report_id}/resolve` (reason + Idempotency-Key) | player.support | `support.resolve_report`; the reason is stored on the report as the decision; a resolved report answers 409 |
| `POST /admin/api/players/{id}/reset-nickname` (reason + Idempotency-Key) | player.support | `support.reset_nickname`: back to a `Player…` placeholder, the player may choose again at once |
| `GET /admin/api/audit?target=` | audit.read | no |
| `GET /admin/api/liveops` (current config, last mail with claim counts) | service.read | no |
| `POST /admin/api/liveops/config` (a new config revision) · `POST /admin/api/mail` · `POST /admin/api/mail/{id}/revoke` | liveops.write (operator) | `liveops.*`, same transaction |
| `GET /admin/api/release` (the deploy values and the release-control revisions) | service.read | no |
| `POST /admin/api/release` `{maintenance_message, min_client_version_code}` (DEC-0040: applied by the game within 30 s; the minimum never drops below the deploy's) | release.write (operator) | `release.set_control`, same transaction |

Changes need a same-origin JSON request (the panel page), a reason of 5–500 characters and an Idempotency-Key; a
replayed key answers the first result and changes nothing. `admin_audit` is append-only (triggers refuse UPDATE,
DELETE, TRUNCATE) and keeps the actor, role, permission, reason, key, target, environment and config revision
(Worker release + rules hash). The economic journal of a change carries the same key (`admin:<action>` endpoint).

## Setting it up (owner decision D-11)

1. After the next production deploy, the Worker `unaware-of-my-demise-admin` exists. In the Cloudflare dashboard:
   Workers & Pages → `unaware-of-my-demise-admin` → Settings → Domains & Routes → workers.dev → enable Cloudflare
   Access, with a policy that allows only the operators' e-mails (and requires MFA if the identity provider offers it).
2. Copy the Access team domain (`<team>.cloudflareaccess.com`) and the application's audience (AUD) tag into the
   repository variables `ADMIN_ACCESS_TEAM_DOMAIN` and `ADMIN_ACCESS_AUD`.
3. Put the operators' e-mails into the repository variable `ADMIN_OPERATOR_EMAILS` (comma-separated); the deploy adds
   missing ones as `operator` and never changes existing rows.
4. The next deploy passes the Access settings to the Worker; its check confirms the API refuses requests without an
   Access token.

## Not built yet

Staging-only test grants (none exist in production by design). Maintenance and the minimum app version are set from
the Service tab (DEC-0040; `docs/runbooks/INCIDENT.md`).
