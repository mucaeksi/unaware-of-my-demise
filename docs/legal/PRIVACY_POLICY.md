# Privacy Policy — Unaware of My Demise

> **DRAFT for owner review (2026-10-05, D-15).** Written from what the game and its servers actually store
> (`docs/legal/README.md` lists the evidence). Items in [square brackets] are owner inputs. Not yet published; after
> approval it is served at `https://unaware-of-my-demise.muratcaneksiii.workers.dev/privacy` and linked from the game and
> the Google Play listing. A review by a lawyer familiar with KVKK (Türkiye) and the GDPR is recommended before launch.

Last updated: [date of publication]

This policy explains what personal data the mobile game **Unaware of My Demise** (the "Game") and its online services
collect, why, how long it is kept, who processes it, and what rights you have.

## 1. Who is responsible

The controller of your personal data is **Serpil Ekşi**, Bahçelievler Mah. Emektar Sok. Taşkent Sitesi No:17 D:1, 59030 Süleymanpaşa/Tekirdağ, Türkiye
("we", "us"). Contact for every privacy question or request: **unawareofmydemise@gmail.com**.

## 2. What we collect and why

| Data | Where it comes from | Why | Legal basis (GDPR / KVKK) |
|---|---|---|---|
| **Account link to your Google account.** We keep only a one-way hash (SHA-256) of the identifier Google gives your account. We do **not** store your e-mail address, name or photo. | Google Sign-In (Android Credential Manager), when you sign in | To recognise you and load your progress on any device | Performance of the contract (providing the Game) |
| **Game account:** a random account ID, your nickname, a friend code, whether you show your online status and, if you do, when you were last seen (coarse) | Created by our server; the nickname and setting are your choice | Running the Game and its social features | Contract |
| **Game progress and items:** story progress, characters, equipment, currencies, quest and reward claims, summon (gacha) history and pity counters, battle inputs used to verify results, mail claims, and a ledger of every change to your currencies and items | Your play | Running the Game, keeping it fair (the server decides every reward), resolving support requests | Contract; legitimate interest in preventing cheating and fraud |
| **Friends and moderation:** friend requests and relations, players you block, and reports you send or receive (the reason chosen and the players involved) | Your use of social features | Social features; keeping the community safe | Contract; legitimate interest |
| **Purchases:** the Google Play purchase token of a subscription, its product, period, status (active, cancelled, refunded) and the rewards it paid | Google Play Billing and Google Play's notifications | Paying subscription rewards, handling renewals and refunds, preventing fraud | Contract; legal obligations (records of sales) |
| **Rewarded ads:** a confirmation that an ad was watched to the end (an ad network transaction ID and the time) | Google AdMob's server-to-server callback | Paying the ad reward, enforcing the daily limits | Contract |
| **Technical data:** a session token (stored by us only as a hash), the app version, sign-in nonces, request logs (time, route, result, request ID). Your IP address is processed by our hosting provider to deliver requests and to apply rate limits; we do not store it in our database | Your device and our hosting provider | Security, preventing abuse, keeping the service running | Legitimate interest |
| **Support messages:** what you write to us, plus the build number and account ID the Game fills in when you use "Contact support" | You | Answering you | Legitimate interest; contract |

We do not collect precise location, contacts, photos, microphone or camera data. We do not sell personal data.

**Ads (Google AdMob).** The Game shows rewarded ads only when you choose to watch one. Google, as an independent
provider, may collect device identifiers (such as the Android advertising ID), IP address and information about the
ad interaction to show and measure ads, according to Google's own policy (https://policies.google.com/technologies/ads).
In the EEA, the UK and Switzerland, and where the law requires it elsewhere, Google's consent form asks for your choice
before any ad is requested, and **"Ad privacy choices" in the Game's Settings** lets you change it at any time.

## 3. On your device

The Game stores on your device: your sound settings, game data updates it has downloaded, and (through Android) which
Google account you chose for sign-in. Your session is kept in memory only and is not written to storage.

## 4. Who processes your data for us

| Provider | What it does | Location |
|---|---|---|
| Cloudflare, Inc. | Hosts our servers, the content downloads and encrypted backups; processes request data and IP addresses | Global network (United States company) |
| Neon (Databricks, Inc.) | Hosts our database | Frankfurt, Germany (AWS eu-central-1) |
| Google LLC / Google Ireland Ltd | Sign-in, Google Play Billing and its notifications, AdMob ads and the consent form | Global (United States / Ireland) |
| GitHub, Inc. (Microsoft) | Runs our automated, encrypted nightly backup | United States |

These providers act on our instructions under their data processing terms, except Google where it acts as an
independent controller for sign-in, payments and ads under its own policies.

**International transfers.** Some providers process data outside Türkiye and outside the European Economic Area. Such
transfers rely on the providers' standard contractual clauses under the GDPR and, under KVKK Article 9, on the
standard contracts announced by the Turkish Personal Data Protection Board, notified to the Board within five business
days of signing [being arranged with each provider: docs/legal/KVKK_TRANSFERS.md].

## 5. How long we keep it

- **Your account and everything in it:** until you delete your account.
- **Deleting your account** removes it and all game data at once. Only three things remain:
  - a record that a deletion happened: the random account ID, the sign-in provider name and two dates;
  - a one-way hash of each purchase token, so that a refunded or reused purchase cannot pay again;
  - records of support actions taken by our staff, which name only the random account ID.
- **Database history:** our database host keeps point-in-time history for 6 hours.
- **Encrypted backups:** kept for 30 days, then deleted automatically. A deleted account therefore disappears from
  backups within 30 days.
- **Sign-in nonces:** deleted within about 2 days.
- **Expired sessions:** deleted 7 days after they expire.
- **Stored replies to game requests:** emptied after 30 days.
- **Request logs:** kept for a few days by our hosting provider.
- **Support e-mails:** kept as long as needed to handle the request, at most [12 months].

## 6. Your rights

You can, at any time:
- **Delete your account:** in the Game (Settings → Delete account), or without the app at
  https://unaware-of-my-demise.muratcaneksiii.workers.dev/account/delete.
- **Ask for a copy of your data, a correction, or restriction, or object to processing:** by e-mail to
  unawareofmydemise@gmail.com from any address. Give your account ID (Settings shows the last characters; "Contact
  support" fills it in). We answer within 30 days.
- **Withdraw ad consent:** Settings → Ad privacy choices.
- **Complain to a supervisory authority:** in Türkiye the Personal Data Protection Authority (KVKK, www.kvkk.gov.tr), or
  the data protection authority of your country in the EU/EEA or UK.

## 7. Children

The Game is intended for players aged 13 and over and is not directed to children under 13. In countries where a
higher age applies to consent to online services (up to 16 in some EU countries), younger players need a parent's
permission. We do not knowingly collect data from children under 13. If you believe a child has an account, write to us and we will
delete it.

## 8. Security

Connections are encrypted (HTTPS). The server decides every reward; nothing your device reports can grant items. Session
tokens and the Google account link are stored only as hashes. Backups are encrypted with a key held offline by the
controller. Staff access to the operations panel requires an identity check and every access to player data is logged.

## 9. Changes

We will update this policy when the Game or the law changes, and show the date above. Significant changes are announced
in the Game before they take effect.
