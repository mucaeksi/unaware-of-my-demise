# Native Account, Privacy and Settings

2026-10-28, D-35. Account now uses the editable native Hub frame with separate Account, Privacy and Settings sections.
Signed-in identity and cloud-copy data are authenticated reads. A failed or malformed cloud read disables data-changing
controls while local sign-out, privacy notice/options and preferences remain reachable. Guest, empty cloud, stale data,
network/storage failure and native-provider unavailability have explicit states. Purchases and Saved Actions retain their routes.

## Cloud copy

Cloud upload freezes the displayed compare-and-set version and preserves unrelated fields. It merges cloud/device stars
using the higher value, preserving cloud-only nodes and per-node fields. It never uploads wallet, roster, rewards or battle
authority. The provider remains authoritative for signed-in progress and economy. Download reads the current copy, validates
all stages/stars before applying anything and only raises device stars; it cannot grant account rewards or battle clears.

An upload sends one strict `expectedVersion`/`data` body. It verifies the exact resulting version and data by readback.
A lost response can be resolved by that read, without another write. Version conflict or unverified readback leaves a
visible failure and requires a fresh review. There is no automatic replacement upload. This plain cloud-copy flow does
not extend the economic action journal or claim durable operation recovery. Existing provider CAS semantics remain unchanged.

## Identity and destructive actions

Async work is bound to the screen lifetime, auth revision, stable account and active content release. Leaving cancels its
owned work; checks after every await prevent a late cloud read, export, Google result or deletion reply from modifying a
different account or the device. Rapid taps are serialized. Sign-out starts revocation with the old bearer and ends local
authority before awaiting it; a delayed old reply cannot clear a newly adopted session. Local sign-out does not claim
confirmed server revocation or Google-provider acceptance.

Deletion has a separate review and explicit **DELETE FOREVER** / **KEEP ACCOUNT** choice. Refresh, account/auth changes and
leaving invalidate approval. Confirmation rechecks the selected player and requires the provider's matching deletion
receipt before clearing that session. Unknown response does not imply deletion, does not retry automatically and does not
erase a new identity. Pending economic recovery continues through Saved Actions. Retention terms remain in the existing
privacy notice; no new legal or retention promise is introduced here.

Exports must identify the approved player before reaching storage. Runtime output uses an account-scoped filename in the
app's private folder and a temporary file promoted atomically only while the original context is still current. A failed or
canceled write cannot report a saved export. Existing files remain intact on a failed replacement. Native Android access
to that private file, sharing and process-death behavior are separate acceptance work; this slice does not add a share bridge.

## Privacy and preferences

Privacy notice and public deletion links use the configured API origin and existing routes. Only HTTPS, or loopback HTTP
for local development, is accepted; credentials/local-file/script URLs are rejected. Advertising privacy choices use the
existing native bridge. Closing its form is not reported as a changed consent choice. Google sign-in and native privacy
controls are unavailable outside Android, except for explicit isolated review fixtures.

Music/effects/voice volumes, mute, reduced motion/flash and the supported battle-layout selector use the existing session,
audio and `UomdPrefs` storage. Settings update their retained controls without rebuilding the scroll on every adjustment.
They remain available without a signed-in account. Existing Title settings and narrative/combat behavior are unchanged.

## Evidence and boundaries

Production Review adds `hub/account`, using the actual Account controller with explicit synthetic identity, cloud-copy,
native-provider, mutation and storage fixtures. HTTP, secure-session writes, actual Google/UMP dialogs, external page opens,
device progress/preferences and export files remain isolated. Capture metadata records the account fixture, cloud version,
operation, notice and busy state, never an export body or credential. No real account is deleted or signed out in this review.

The [scoped evidence](../evidence/sol-account-privacy-2026-10-28.json) binds tested source, actual Game-view pixels, checks and
restored Editor state. No new art is generated; the existing rebuilt OpenAI shelter is reused. Fixture outcomes are not
live provider, Android secure storage/file/lifecycle/touch, human art/native-2K or release acceptance. No API/config/migration,
credential, paid-provider call, push or deployment is part of this slice. Verified changes are committed locally on main.
