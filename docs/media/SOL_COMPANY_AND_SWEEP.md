# Native companion, formation, Armory and Sweep

2026-10-27, D-35. The real Character, Team, Gear and Saved Actions routes now use the editable native
`Resources/Rebuild/Hub.uxml` / `Hub.uss` frame. Home/Company/Chapters navigation retains the original route IDs. This slice
reuses the existing original OpenAI shelter background and rebuilt lead portraits; it generates no new bitmap assets.
Historical Gemini character/gear images are not substituted into these screens. Other companions remain readable as data
until their rebuilt portraits exist. Human art, final native-resolution, live-account and Android acceptance remain open.

## Companion and equipment

Companion details show the account's character level, XP, ascension, skill ranks, Memory Shards/resonance, derived stats
and four equipment slots. Existing growth planners disclose the selected material, fee, projected result and eligibility
before a spend. Ascension checks authoritative prerequisite stars, matching the provider. Missing optional stats are
explicitly unavailable rather than invented zeroes. Material/catalog/equipment failures prevent a fresh spend.

The detail read group is bound to account, auth revision, release and selected companion. Navigation cancels old reads;
late responses cannot populate a different companion/account. A failed same-context refresh marks the retained snapshot
stale and disables changes. The account header uses only the authoritative `eclipse_token` balance (Bell's Remains).

Team has five presets, two front slots and three rear slots. The picker excludes already selected companions. Unsaved
formation changes require explicit discard before native navigation. Save-and-activate saves successfully before sending
activation; repeated taps cannot overlap writes. Clear requires confirmation. The provider remains the party authority.
Existing custom preset names survive membership saves; clear binds the exact preset named by its confirmation.

Armory preserves companion/slot filtering and Back to the originating companion. It shows all equipment in native scroll
views, including its stats, owner and unavailable reason. Undefined signature passives cannot be newly equipped; retired
or unsupported equipment already worn can still be removed. Moving equipment is explicit in the action label.

Team PUT/activate/DELETE and equipment equip/unequip retain their strict plain-write schemas: no generic requestId is
added. Success requires a fresh readback matching the selected preset/members/active slot or equipment owner. On response
loss, the UI reports an uncertain outcome and requires a refresh/inspection; it never automatically repeats these writes.
These operations do not claim an economic request journal or a durable history of plain-write intent.

## Original-action recovery

`UomdSavedAction` / `UomdActionJournal` cover the compiled companion level-up, ascend, skill upgrade, shard attune/convert
and Sweep paths. One unresolved economic intent per stable account is saved before sending: exact path, canonical body,
requestId, original release and state. No credentials are stored. The file is bounded to 256 KiB, checksummed, flushed and
atomically promoted. A corrupt/newer journal fails closed; an older backup is never silently substituted for an unresolved
claim. A fresh store reads the same original body; unpromoted temporary files are not adopted.
The original displayed cost summary is retained for recovery. It is display information, never a server pricing input.
New intent freezes its body and approved release before awaiting prior-status checks; a changed release requires another
explicit choice. Records without an original cost summary permit status-only recovery, not an unknown-status resubmit.

Recovery checks `/operations/<requestId>?path=...`. Confirmed status requires the exact path/request/hash binding, not a
legacy/unbound result. Sweep's hash includes the provider's `sweep:true` discriminator. Unknown status is not success or
proof of failure: retry sends the same original body/release/request, including after a content cutover. Repeated taps are
serialized. Confirmed receipts are saved before refreshing the account; failed refresh remains visibly pending and blocks
another economic action. Account/auth changes fence every callback and preserve the original account's saved intent.
Generated controls also bind their rendered version, account, auth revision and release. A retained click from an older
screen cannot start a new account's intent before the next redraw. Token-only legacy sessions resolve a verified `/me`
identity before opening a stable account journal.

Explicit known provider rejections are recorded separately from transport/auth/busy/unknown failures. A new action after
a rejection requires fresh account data and another check of the previous identity first. Pending intent cannot be
overwritten by a new request. Saved Actions exposes the original action and retains the existing campaign battle recovery
and story continuation. It stores the current/last action, not an unbounded transaction history.

## Stage actions

Chapters retains real story/battle entry and Normal/Hard identities. Sweep is shown only for a published Ration-paid
battle. Its feature flag, three-star progress, daily usage/limit, maximum batch and available Ration all come from the
validated account replies. Counts 1/5/10 show the total cost before the action. Free tutorials cannot be swept. Published
repeat rewards and randomized drops are distinguished from first-clear rewards; only server-confirmed results are shown
as awarded. No replacement chapter-tier currency or invented reward claim is introduced.

## Review and acceptance

Production Review adds `hub/companion`, `hub/team`, `hub/armory` and `hub/actions`; navigation between rebuilt routes uses
the actual controllers. Account data and mutation/status transport are explicit Editor-only, memory-only fixtures with
HTTP blocked. They exercise selection, gating, write serialization, readback, response loss, rejection and account races;
their synthetic inventory/rewards are not economy balance or live-provider evidence. Full campaign layout uses the
canonical local patch index and records its source; this does not mean that patch is installed/published in the fixture.

Actual Game-view captures, exact checks, source hashes and Editor restoration are recorded in
[scoped evidence](../evidence/sol-company-sweep-2026-10-27.json). NavigationSubmit events are Editor input evidence, not
physical touch. Android process death/storage, real identity/provider, signed patch cutover and release acceptance remain
separate. Remaining system screen presentation, broader gear growth/mode foundations and live/device acceptance continue
in dependency order. Work is committed locally on main; the owner controls pushes and deployments.
