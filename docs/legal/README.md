# Legal texts (owner decision D-15)

Status: **DRAFT, awaiting the owner's review** (2026-10-05). Not yet published or shown in the Game.

| File | What | Published at (after approval) |
|---|---|---|
| `PRIVACY_POLICY.md` | Privacy policy (GDPR, KVKK, Google Play User Data policy, AdMob disclosures) | `/privacy` on the game Worker; Play Console → App content → Privacy policy |
| `TERMS_OF_SERVICE.md` | Terms of service | `/terms` on the game Worker |

## Owner inputs

Answered on 2026-10-05:
- **Controller:** Serpil Ekşi, Bahçelievler Mah. Emektar Sok. Taşkent Sitesi No:17 D:1, 59030 Süleymanpaşa/Tekirdağ.
- **Governing law:** Türkiye.
- **Age:** the owner prefers 12+, else 16+. The texts use **13+**.
  - Picking an under-13 age group in Play's target audience puts the game under the Families policy:
    Families-certified ads only, no personalised ads, child data limits.
  - 13 is the lowest age that avoids that. The IARC content rating (PEGI 12 or 16, from the questionnaire) is
    separate from this.
- **Cross-border transfers (KVKK m.9):** map them and choose the mechanism; sign standard contracts and notify the
  Board within 5 business days where needed. The map and plan are in `KVKK_TRANSFERS.md`; a lawyer must confirm them.

Still open:
- Refund rule: keep "rewards already paid are not taken back" (DEC-0038)?
- How long support e-mails are kept (draft: 12 months).
- The closing notice period (draft: 30 days).

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

- **Ad privacy choices** (AdMob/UMP requirement): built. Settings offers "Ad privacy choices" when Google's consent
  applies to the player, and it opens Google's privacy options form. A changed choice is asked again before the next
  ad. The pieces: the UomdNative calls `adsPrivacyStatus` and `adsShowPrivacyOptions`, and `Monetization`. GUT covers it.
- **Full summon odds** (Google Play loot-box policy): built. Every banner lists every rarity's odds, the pity, the
  4★ guarantee and the featured share before a pull, from the same data the server rolls with. GUT covers it.
- Still to do once the texts are approved:
  - serve `/privacy` and `/terms`;
  - build the first-install notices screen (docs/design/FIRST_LAUNCH_FLOW.md step 5).

## Sources consulted

- Google Play User Data policy and Data safety section requirements.
- Google Play monetization policy: odds disclosure for randomized items (since 2019).
- AdMob EU user consent policy: Google-certified CMP since 16 January 2024, privacy options to revoke consent.
- KVKK: information notice (Article 10) and the 2024 amendment of cross-border transfers (Article 9).
