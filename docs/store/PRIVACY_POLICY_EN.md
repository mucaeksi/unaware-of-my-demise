# Privacy policy — English draft, not published

Effective date: UNKNOWN (set on approved publication). Operator/data controller: UNKNOWN legal name and contact. Privacy/support contact and postal address: UNKNOWN. This draft describes the checked-in implementation at `5c83e3d1` and must be reconciled with the final Android AAB/Google SDK settings before release.

## Information used to provide the game

When you sign in with Google, the game verifies a Google identity token and associates Google's stable account identifier with an internal player ID. It stores that identifier, a display name when available, creation/last-seen timestamps and account status. The token can include your verified email address, which the verifier processes; the current player creation code does not persist an email column. We do not receive your Google password. The server stores a hash of its own session token rather than the usable token itself; the device stores the active session locally.

Game records include currency balances and transaction history; character ownership, copies/shards, growth/skills; inventory materials and equipment; teams; battle results/actions used for server verification; progression, task and reward claims; wish history and guarantees; mailbox contents and claims; and cloud-save data. Cloud-save uploads can contain local preferences and a random install identifier along with progress. Local storage also holds preferences, cached media and signed content manifests.

Purchases are processed through Google Play. The game sends purchase tokens to its server and the Google Play Developer API for verification. It stores a token hash, order/product identifiers, purchase/subscription periods, grant/refund state and fulfillment events. Google receives purchase/account information through its own services. The game does not implement a form for your payment card or bank information.

Rewarded advertising uses Google AdMob and Google's User Messaging Platform (UMP). To verify a reward, the game supplies AdMob with an internal user identifier and a one-time nonce. The server receives a signed callback and retains transaction/ad-unit identifiers, reward amount and timing. The Android manifest declares advertising ID permission; Google advertising SDKs may process device/ad identifiers, interactions, diagnostics and IP-derived information according to their SDK behavior, your choices and the applicable configuration. The exact final SDK data categories and regional behavior must be completed in the Data Safety worksheet before publication.

The service processes network requests and security/operational logs. App rate limiting uses a hash of an IP address; hosting providers still process network addresses and request metadata. Hashing does not automatically make data anonymous. The repository does not establish a separate analytics/crash-reporting SDK or collection of contacts, microphone recordings, camera images or GPS location; the final AAB and its dependencies must be checked for any additional processing.

## Purposes and recipients

Information is used to authenticate accounts, provide and recover gameplay, verify purchases and rewards, prevent duplicate claims/fraud, deliver content, honor consent choices and operate/support the service. Optional advertising has separate Google/UMP choices as applicable. UNKNOWN: operator-approved legal bases, lawful age limits and jurisdiction-specific rights wording.

The backend and database run on Cloudflare Workers/D1, with assets and backups in R2. Google provides sign-in, Play payments/notifications and AdMob/UMP. Authorized administrators can access account and audit records through the protected Control Center. Do not interpret these integrations as a promise that no data is disclosed to third parties. UNKNOWN: contractual roles, international transfer safeguards, storage regions and the operator's definitive vendor/privacy-link list. Google generative tools produce game assets; no source code path audited here sends player/account data for media generation.

## Choices, access and deletion

You can sign out, use the account screen to export game data, and request account deletion using Account → DELETE ACCOUNT → confirm. Export uses GET `/api/v1/account/export`; deletion uses authenticated DELETE `/api/v1/account` with exact confirmation `DELETE`. Account exports include the most recent 2,000 currency records, 2,000 wish records and 500 mail records, with truncation flags; other included gameplay categories are listed in the Data Safety worksheet. The export currently omits some identity/session/ad/operational records. It is not a claim of a complete legal subject-access response; UNKNOWN privacy-contact process for additional records.

Deletion removes the Google link/display name, revokes sessions and erases mutable account balances, inventory, roster/growth, teams, tasks, progress and saves from the active game database. Immutable transaction, wish, purchase and mailbox records and other audit/ad records remain linked to a tombstone player ID for retention purposes. Tombstoning is not asserted to be irreversible anonymization: external order IDs and other identifiers can still relate to a person. Backups may contain previous account records until the applicable retention/deletion process completes.

UNKNOWN: legal grounds and exact retention/deletion schedule for each retained category, backup lifecycle and restoration/deletion propagation. The code alone cannot establish that retained information must legally be kept indefinitely. Signing in again after deletion creates a new account; old progress is not automatically restored. Deleting the game account does **not** cancel a Google Play subscription; manage subscription cancellation in Google Play.

Where UMP requires privacy options, the app offers Privacy options (ads) to review your choice. Choices do not remove past verified transaction/reward records. UNKNOWN: approved underage policy and applicable consent/personalization settings; no age gate is established by this draft.

An externally accessible account-deletion request page and contact route are required for the store submission: **UNKNOWN URL and workflow**. Do not substitute an authenticated API endpoint or internal staging page for that public route.

## Security and retention

The service uses HTTPS, server-side Google token/signature checks, expiring sessions, protected administrative access and append-only financial/audit records. Encrypted backups use the owner's public age key; the source currently also enables a temporary plaintext backup probe, flagged in `docs/RUNBOOK.md`, so a blanket claim that every backup is encrypted is withheld until remediation is verified. No system is promised immune to loss or unauthorized access.

Some code-level time limits are known: app sessions last 30 days and older expired sessions are cleaned on a later sign-in; reward nonces expire in 30 minutes; operational result rows are pruned after 30 days. These are validity/cleanup rules, not a complete personal-data retention policy. UNKNOWN definitive retention schedule, logs/R2 lifecycle, deletion propagation and privacy incident process.

## Changes and contact

Publish approved changes with an effective date and accessible notice as appropriate. For access, correction, deletion and other applicable rights contact UNKNOWN privacy contact; regulator/appeal and jurisdiction-specific routes must be completed by the operator. This text is a draft until all UNKNOWN fields and actual SDK/data practices are resolved.
