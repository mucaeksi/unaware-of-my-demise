# Google Play Data Safety — evidence worksheet

English only; source revision `5c83e3d1`. **Do not submit this as a final form.** Play answers must cover the final AAB plus Google/hosting SDKs, not merely the app's D1 tables. The exact Console category labels/exemptions must be checked at submission. “Not stored in D1” does not imply “not collected,” and hashing is not proof of anonymity. No live SDK packet capture or Play form was completed here.

## Form-level draft answers

| Form question | Source-backed answer / remaining decision |
|---|---|
| Does the app collect/share data? | **Yes, collection** for Google identity, gameplay and transaction/reward processing. Vendor sharing classification must include Google/Cloudflare SDK/services; **UNKNOWN final sharing selections**, never answer blanket No |
| Encrypted in transit? | App API uses HTTPS; Google APIs use HTTPS and token/signature verification. **UNKNOWN final complete SDK flows**; verify AAB/network before final Yes |
| Can users request deletion? | In-app authenticated delete implemented. Required externally accessible deletion webpage/workflow **UNKNOWN**, so do not mark public URL complete |
| Account creation/sign-in | Google sign-in only on Android; no app email/password or anonymous permanent account. Does not require/supply Google password |
| Optional vs required processing | Identity/game state required for account functions. Purchase data arises when user buys; ads interaction/SSV when user opts to watch. Cloud-save upload user-initiated. Some SDK advertising processing can occur at SDK initialization; **UNKNOWN precise optional/consent fields** |
| Independent security review/certification | No certification claim evidenced; repository security review is not Play certification |

## Data categories and purpose mapping

| Candidate Play category | Concrete fields / location | Collection, purpose and sharing evidence | Final form status |
|---|---|---|---|
| Personal info: name | `players.display_name`; derived Google token name | collected/stored for profile/account functionality; backend hosted on Cloudflare | Yes collection; sharing/optional selection review |
| Personal info: user IDs | `players.google_sub`, internal player ID; sessions token_hash, billingTag; device installId in optional save | authentication/account management, app functions, fraud prevention; internal player ID sent to AdMob SSV | Yes collection; identity/ad vendor classification review |
| Personal info: email address | GoogleClaims.email processed from ID token; **not persisted** by playerForGoogle | transient identity processing; Google SDK/provider also handles Google account identity | UNKNOWN ephemeral-processing/required form selections; do not claim app stores email |
| Financial info: purchase history | `purchases` order/product, token_hash, periods/grant/refund/unrecovered; `purchase_events`; periodic mail | Google Play verification/fulfillment/refund/fraud; Play API receives purchase token | Yes purchase history collection; optional purchase flow; sharing review |
| Financial info: payment details | No app card/bank form/table found; billing is Google's UI | Google processes payment methods separately | No direct app collection found; UNKNOWN final SDK/form interpretation |
| App activity: in-app interactions / other actions | roster/growth/gear/materials/teams/progress/tasks, `gacha_pulls`, `battle_audit`, `player_saves`, mailbox/read/claim; ad callback history | game functions, save/recovery, fraud prevention; no separate marketing analytics SDK established | Yes app activity collection; exact subcategories reviewed on final form |
| Device or other IDs | `Prefs.installId` stored locally and may be uploaded with prefs; Android `AD_ID` permission; AdMob identifiers | patch rollout/device preferences, optional cloud save, Google advertising SDK | Yes install ID transmitted with save; UNKNOWN complete Google ad IDs/consent behavior |
| Approximate location | no app GPS permission/table; network/Google SDK may infer region from IP | hosting/advertising processing can involve IP-derived area | **UNKNOWN SDK category; cannot answer No from absence of GPS** |
| Precise location | no location permission/direct field found in inspected app manifest/code | final merged manifest/SDK behavior must be inspected | No direct app collection found; pending AAB verification |
| Diagnostics/crash/performance | Workers logs/errors/ops probes/rate limits, SDK may emit diagnostics | functionality/security; `ops_runs` contains service health, not necessarily per-user crashes | UNKNOWN final SDK diagnostics categories; no Firebase/analytics SDK inferred |
| Contacts, photos/videos, microphone/audio uploads, health | no corresponding player upload endpoint/permissions found | generated game art/VO is delivered content, not user audio/photo collection | No direct collection found; verify final dependency/permission inventory |
| Messages | `mail` is server-generated in-game mail, not evidenced user chat/email collection | account rewards/announcements retained for audit | Classify as app activity unless final messaging feature requires different fields; UNKNOWN exact form choice |

SDK assessment required: final versions in Android build/merged manifest, Google Sign-In/Credential Manager, Billing, AdMob and UMP; consent modes, ad personalization/age flags, device identifiers, IP/location/interaction/diagnostic collection, purpose and Play service-provider sharing exemptions. Review vendor's actual SDK disclosure; no internet facts or unverified “not shared” answers were invented in this repository audit. Google generative media is a developer pipeline and no audited source passes player personal data to it.

## Account export and deletion audit

`apps/api/src/account/service.ts` export fields: profile(id/created/display/last-seen/status), wallets, ledger(max2000), characters/copies/shards, characterGrowth, gear, materials, account XP, progress, teams, pulls(max2000), mail(max500), purchases(order/product/kind/state/granted/refunded), cloudSave, exportedAt and truncated flags.

Not included by current export: google_sub, sessions, pity_state, player_tasks, ad_nonces/ad_rewards, full purchase token_hash/period/events, battle_audit, server logs/backup snapshots and some operational rows. Do not call export “everything” in a legal promise; a fuller access-request process is UNKNOWN.

Deletion: `players.status=deleted`, google_sub/display_name=NULL, deleted_at set; atomic removal of sessions, player_teams, player_tasks, progression_requests, player_gear, player_chars, player_stacks, player_account, player_progress, player_ration, battle_claims, player_saves, pity_state, gacha_requests, ad_nonces, player_items, wallets. Retains tombstone + ledger, gacha_pulls, purchases, mail, ad_rewards and purchase/other audit records where present. These retained entries can contain externally linkable order IDs; no “all information removed” or irrevocably anonymous claim.

Backup source currently has plaintext probe flag enabled; see `../RUNBOOK.md` R03. UNKNOWN retained-data legal basis/time limits, public deletion request route, backup lifecycle and deletion-on-restore procedure. Thirty-day ops log pruning and session validity are not a complete data-retention policy.

## Completion evidence required

Owner/lead fills legal contact/retention/deletion URLs, validates actual APK/AAB permissions and SDK collection, performs real UMP/ads/identity/billing/export/delete device cases, records any extra data flows, then enters Console selections with date/version evidence. No release submission is part of SOL-2.
