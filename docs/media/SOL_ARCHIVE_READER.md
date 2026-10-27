# Native Archive and reading flow

2026-10-27, D-35. The actual Library route now uses the shared editable native Hub frame. Its companion, Codex and event
shelves contain only cards returned by the authenticated `/api/v1/library` response. The installed/local library index
never grants access or supplies hidden titles. The provider checks stage prerequisites, companion ownership, previous
parts and event availability again when an entry is opened and when its completion is recorded.

Listing and detail replies are bound to the current account, authentication revision, content release and selected card.
Missing, malformed, duplicate or mismatched data fails closed. Refresh failure retains a visibly stale snapshot and
disables opening; guest and empty shelves have explicit states. Lists use constrained vertical scrolling and the native
frame's safe-area and retained-control guards. The former fixed-coordinate Archive implementation is removed; Trials
is unchanged.

## Actual reader

Archive scenes run in order through the existing `StoryRunner` and `StoryScreenController`, with `Rebuild/Story.uxml`
and `Story.uss`. Canonical text, identities, choice/flag behavior and audio cues remain data. The Archive header and
scrollable reading text retain normal-speed Auto, manual reveal/advance and voice replay. Native choice controls avoid
historical bitmap panels. Entry and campaign checkpoints are not adopted as Archive cursors.

Only existing rebuilt OpenAI backgrounds and portraits are loaded. All required backgrounds/actors are checked before
starting an illustrated scene. An unavailable rebuilt image offers Retry or explicit reading without images; no historical
Gemini bitmap is silently substituted. Leaving an unfinished reading requires confirmation and does not mark it read.
Cancel keeps the current line. This slice produces no new visual assets or art approval.

## Completion and recovery

A first reading completes only after its last scene. It uses one original `/api/v1/progress/story` body containing the
approved release, entry/node and request ID. The status response must match its exact path, request and canonical input
hash, and the receipt must confirm the same release/node/request. Unknown status is not success. Retry checks status
first, then submits only that original body if still unknown. Transport loss leaves a visible pending result; returning
to the Archive preserves the pending result and its explicit retry control within the same running session. New Archive
readings, chapter entry and Continue route back to its recovery before replacing it. Rapid taps are serialized. Account, auth revision, release and scene callback fences prevent
late results from advancing another reading or account.

A card already confirmed read by the server is a replay: its playback returns to the Archive without another completion
write. Reading grants no currency, rewards, stars, Ration or task progress. The server remains authoritative over which
later companion parts become visible after a confirmed first reading.

The Archive cursor and pending completion are memory-only. An unfinished reading restarts after leaving/restarting the
app. If the server committed a completion before interruption, a fresh listing reports it read. This is not a durable
Archive operation journal or Android process-death proof. Economic action and campaign battle journals are unchanged.

## Review and acceptance

Production Review adds `hub/archive` with actual Library and Story controllers. Canonical patch text is read from
`content/patches/rel_0003_part1_campaign/library/library_index.json`; account gates, completion/status and failure cases
are explicitly synthetic memory-only fixtures with HTTP blocked. This does not claim that the patch is installed or
published on the embedded fixture release. Capture metadata records the text source, fixture mode, reading/replay state
and original completion request/hash.

The [scoped evidence](../evidence/sol-archive-reader-2026-10-27.json) binds tested source, real Game-view captures, executed
checks and restored Editor state. NavigationSubmit events are Editor input evidence, not physical touch. Live accounts,
provider/event schedules, signed patch cutover, Android storage/lifecycle, human art and release acceptance remain open.
Non-Archive campaign narrative/visual migration and broader system screens continue in the production plan. Local main
commits remain separate from owner-controlled pushes and deployments.
