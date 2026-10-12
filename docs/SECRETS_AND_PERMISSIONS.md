# Secrets, bindings and current access

[README](../README.md) is authoritative. Names/public identifiers are safe to record; private values stay in approved Worker/runtime/signing stores and never in chat, Git, browser variables or debug logs. Inspect existing settings before creating replacements.

## Current delivery/access facts

- Staging uses **Cloudflare Workers Builds**. `tools/deploy_staging.sh game|admin|ops` deploys one Worker per build; game alone owns D1 migrations/seeds. Removed GitHub Actions workflows are not a supported bootstrap or permission source.
- Existing public account/resource/Access/Google identifiers are in `apps/api/wrangler.*.jsonc`, `content/keys/trusted_public_keys.json` and the dated AAB access record. Configuration presence does not prove live permissions, MFA or credential usability.
- **2026-10-12 host check:** bounded Wrangler whoami reports unauthenticated. Staging health and current official-reference requests are blocked by proxy 403. No live secrets were read/created/uploaded; deployed tags, migration state, Access/MFA and scheduled outcomes are unverified here.
- Configure credentials through the supported secure environment/Cloudflare mechanism. Git push authorization, connector access, Wrangler authorization and Google app permissions are separate capabilities. Do not initiate login or paste tokens merely to inspect the project.

## Required settings

| Target | Names | Minimum purpose/evidence |
| --- | --- | --- |
| Existing game Worker per environment | `GOOGLE_CLIENT_IDS`, `PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT` | Verify Google identity and app-specific Publisher product/subscription/order reads plus acknowledgement/consume permissions. Check Android/Web OAuth IDs, package/signing certificates and actual sandbox responses. Prices/base plans remain in Play Console. |
| Existing game Worker per environment | **`BILLING_TOKEN_KEYS`** | R02-E3 environment-specific AES-256-GCM keyring for encrypted durable receipt work; setup/rotation below. No host/client copy or presumed binding. |
| Existing game Worker / Pub/Sub | `RTDN_AUDIENCE`, `RTDN_PUSH_SERVICE_ACCOUNT`, configured topic/push subscription | OIDC signature/issuer/audience/verified publisher identity, retry/retention/dead-letter/seek and actual replay evidence. Reuse the existing project/permissions; do not invent a new role. |
| Existing game Worker / AdMob | `ADMOB_AD_UNIT_IDS`, approved app/unit/test IDs and SSV configuration | Signature, nonce, cap and native test/live behavior. A historical URL check is not current financial/device proof. |
| Existing admin Worker | `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_BOOTSTRAP_OWNERS` | Existing Access edge/owner-member policy, MFA, JWT and D1 RBAC; service-binding rejection alone does not prove edge protection. |
| Existing admin Worker | `CONTENT_SIGNING_KEY`, `CONTENT_SIGNING_KID` | Existing ES256 private key only in the Worker secret store; matching public key embedded in clients. Retain old trusted public keys during approved rotation. No obsolete Actions bootstrap or blind replacement. |
| Existing ops Worker | `AGE_RECIPIENT`, DB/`BACKUPS`/GAME/ADMIN bindings | Age public recipient, authorized encrypted export and health. The owner-held private identity is required for a real encrypted restore; never substitute a new key. |
| Native secure build environment | `UOMD_KEYSTORE_FILE`, `UOMD_KEYSTORE_PASSWORD`, `UOMD_KEY_ALIAS`, explicit version/environment | Existing upload key, strictly increasing versionCode and reproducible signed AAB/device evidence. Do not recreate the upload key. |
| Approved media runtime | Existing approved Google credentials and `content/budget/media_budget.json` | Current approval is 1000 TL/month (recorded $20), $3/batch, three paid attempts per asset; R14 durability/uncertain-charge fixes are still required. Creative/paid generation is deferred by the owner. |

## Billing keyring setup and rotation

Set `BILLING_TOKEN_KEYS` as a **secret on each existing game Worker**, independently for dev/staging. Format: JSON object with `current` key ID and `keys` mapping of retained IDs to canonical base64url values. Each value must encode **32 cryptographically random bytes**, without padding; at most eight IDs. The structural example below is not usable key material:

```json
{"current":"v1","keys":{"v1":"<base64url of 32 securely generated random bytes>"}}
```

Generate/store the real material only through approved secure handling. Use the existing Cloudflare Worker Variables and Secrets console or an authenticated, explicitly targeted `wrangler secret put BILLING_TOKEN_KEYS --config apps/api/wrangler.game.jsonc --env staging` with secure input. Never print material, put it in `.codex/config.toml`, `.env`/Vite client variables, a build artifact or a prompt. Production provisioning remains a separate owner gate.

Rotation: add a fresh ID/material, retain prior IDs, then change `current`. New verified receipt work rewraps ciphertext under the current key. Viewer job metadata exposes only `key_id`; verify no pending/review rows need an old ID before its approved removal. A removed key yields explicit review, not guessed tokens. A genuine authenticated client/RTDN receipt can be reverified and rewrapped; immutable grants stay deduplicated. Backups contain ciphertext, not this keyring, so recovery must retain access to the matching secure key versions.

Verify the intended Workers Builds source tag, migration **0022**, every-minute game Cron and bounded backlog/ack behavior with approved isolated Google sandbox data. `verifyReceipt` fails closed without a valid keyring before new financial fulfillment; already-confirmed consumable replay remains available without a new grant. The local scheduled-dispatch check without the keyring proved blocked configuration, not successful cloud reconciliation.

## Historical records and preserved resources

2026-10-10 Actions deployment/signing and older Cloudflare/Gemini connectivity reports are historical evidence only. The original record and run IDs remain in Git history; they do not authorize restoring deleted workflows, rotating keys or granting broad roles now. Preserve existing settings and request only the capability actually missing.

The retired Godot/Neon/Hyperdrive/legacy Worker resources were decommissioned under the dated owner instruction. **Preserve `uomd-db-backups`: current ops binds it and stores encrypted D1 exports.** Old instructions to delete that bucket or presume it contains only a legacy dump are superseded. No new decommission operation is part of this assignment. Context7 is retired and needs no key.
