# Legal texts (owner decision D-15)

Status: **DRAFT, awaiting the owner's review** (2026-10-05). Not yet published or shown in the Game.

| File | What | Published at (after approval) |
|---|---|---|
| `PRIVACY_POLICY.md` | Privacy policy (GDPR, KVKK, Google Play User Data policy, AdMob disclosures) | `/privacy` on the game Worker; Play Console → App content → Privacy policy |
| `TERMS_OF_SERVICE.md` | Terms of service | `/terms` on the game Worker |

## Owner inputs still needed

1. Controller identity: full legal name (or company), postal address in Türkiye.
2. Minimum age / target audience (draft: 16+). It must match the Play Console target-audience answers and the IARC
   rating; the gacha with paid subscriptions and the adult character designs point to 16+ or 18+.
3. Refund rule: keep "rewards already paid are not taken back" (DEC-0038)?
4. Governing law (draft: Türkiye) and the closing notice period (draft: 30 days).
5. How long support e-mails are kept (draft: 12 months).
6. KVKK cross-border transfers (Article 9 as amended in 2024): sign the standard contracts with the providers that offer
   them, or rely on another safeguard, and notify the KVKK Board within 5 business days of signing. Needs a lawyer.

## Evidence the texts were written from

- Tables: `database/migrations/0001…0012` (no e-mail, name or photo column; `provider_links.subject_hash` is
  SHA-256 of `provider:subject`, `server/src/accounts.ts`; `sessions.token_hash`).
- Deletion: migration 0006 cascades; `account_deletions` keeps id, provider and dates; `billing_instant_grants` keeps a
  token hash (DEC-0038); `admin_audit` keeps the random id (DEC-0033).
- Retention: `server/src/retention.ts` (nonces 24 h after expiry, sessions 7 days after expiry, replies 30 days,
  attempts 24 h), Neon history 6 h (`docs/runbooks/BACKUP_RESTORE.md`), backups 30 days (`backup.yml`, D-05).
- Providers: Cloudflare (Workers, Hyperdrive, R2), Neon `eu-central-1` (`docs/INFRASTRUCTURE_AUDIT.md`), Google (Sign-In,
  Play Billing, Pub/Sub, AdMob, UMP), GitHub Actions (backup runner).
- IP addresses: used by the Workers rate limiters (`server/src/app.ts` `clientKey`), never written to the database or to
  the request log lines (`LogEntry`).

## Engineering work the texts depend on (found while drafting)

- **Ad privacy choices** (AdMob/UMP requirement): Settings must offer Google's privacy options form when UMP reports it
  is required. Not built yet.
- **Full summon odds** (Google Play loot-box policy): the summon screen shows the 5★ rate and pity; the 4★/3★ rates and
  the featured share must be shown before a pull too.
- Serving `/privacy` and `/terms` and the first-install notices screen (docs/design/FIRST_LAUNCH_FLOW.md step 5) once
  the texts are approved.

## Sources consulted

- Google Play User Data policy and Data safety section requirements.
- Google Play monetization policy: odds disclosure for randomized items (since 2019).
- AdMob EU user consent policy: Google-certified CMP since 16 January 2024, privacy options to revoke consent.
- KVKK: information notice (Article 10) and the 2024 amendment of cross-border transfers (Article 9).
