# Unity entry continuity and Finish

The rebuilt first-install path uses the existing prologue, three tutorial encounters and six canonical story scenes.
`UomdEntryFlow` routes them; `UomdEntryContinuity` binds the local checkpoint to the current API account and reconciles the
existing `/api/v1/entry` coarse progress record. Local narrative continuity grants no wallet, reward or campaign authority.

## Local record

`persistentDataPath/uomd_entry/v1/<scope hash>.json` contains a bounded versioned checkpoint. Its scope is a SHA-256 of
the stable player identity or the guest namespace; it contains no token or raw account identifier. Guest progress is not
automatically adopted by a signed-in account. Legacy token-only sessions resolve the stable player identity before binding.
The old global `uomd.prologue.checkpoint` is preserved but not imported into an account whose ownership cannot be known.

The record holds the content release, phase/stage, exact scene-source hash, current blocking story index, choices/flags,
prologue shot, monotonic local sequence, coarse completion and confirmed account progress. StoryRunner reconstructs both
actors and their earlier emotions before replaying the current line. The line begins again, avoiding silent loss of unread
text. A release change restarts from the last completed tutorial boundary; a changed scene hash restarts that scene. These
rules preserve completed coarse entry progress while refusing to apply a cursor to different content.

Tutorial reading starts in manual mode. The player's Auto choice is saved and restored, so returning through Title does
not silently re-enable automatic advancement. Account changes invalidate the old entry flow and its pending scene loads;
callbacks carry the original checkpoint scope and cannot complete a different account's tutorial.

Writes occur at shot, line/choice and phase boundaries, with a synchronous background/quit flush. The small JSON payload is
checksummed, capped at 64 KiB and written through a flushed temporary file and atomic replacement with a previous copy.
A corrupt latest record can recover the previous valid copy; saving that recovered state preserves the good backup.
Newer unsupported formats are retained and block overwriting. Storage failures remain visible and prevent Finish reload
from claiming a saved checkpoint. The checksum detects damage; this local narrative file is not an authority mechanism.

An unfinished battle resumes as a fresh deterministic encounter. A won tutorial checkpoints the post-story phase before
the result's Continue button, so an interruption at victory does not require winning it again. A stage is recorded as
finished only after its post-story. This is entry continuity; pending server-sessioned campaign operations and full
cross-device scene cursors remain separate work.

## Account confirmation

Title Continue reads the server entry record and merges its monotonic prologue/tutorial/completion fields with the local
record. The detailed scene/choice cursor remains on the device; the current server endpoint stores coarse entry progress
only. When offline, an existing local checkpoint remains available and account confirmation stays pending. No cloud
confirmation is inferred from a successful local write.

Every coarse write persists its request ID before sending. An ambiguous failure retries the same ID and payload through
the existing idempotent server operation. Story cursor writes do not change that request. A later tutorial/completion
checkpoint receives a new ID. Responses from a changed account cannot update the newly bound account's checkpoint.
The underlying server contract and economy rules are unchanged.

## Finish and reload

Native `Rebuild/Finish.uxml` / `Finish.uss` replaces the previous bitmap-decorated controller. It uses the new Sol shelter
painting and live text, progress and buttons. It distinguishes device-save failure, device-only progress, account sync
pending and confirmed account progress. The signed patch service still owns download, metered-network consent, retry,
verification and app-update requirements. Finishing T3 does not mark a patch as installed.

The explicit Save, Reload & Continue action first persists the completed entry and waits for account confirmation when
signed in. It then activates the staged release and verifies the expected active release and absence of a pending stage.
Rejection, rollback or activation failure keeps Finish retryable. Only successful activation and local reload-checkpoint
save mark this installation complete. The existing runtime reload returns through Studio and Title; Continue then opens
Home without restarting T1. This is an in-process content reload, not evidence of an Android OS process relaunch.

## Isolated review and remaining acceptance

Production Review's `entry` route permits the actual startup/entry/Finish/Home sequence with memory-only checkpoints,
embedded content and blocked API transport. Single-shot/portrait/battle review routes retain their existing holds and
isolation. Remote patch/account statuses used in rehearsal are explicit fixtures; they do not certify a live download,
sign-in or cloud save. Entry captures include the active screen/phase/stage, local save state, sequence and actual media
source identities without account identifiers. Closing review restores the original Editor state and preferences.

[Executed checks and limitations](evidence/sol-entry-continuity-2026-10-27.json) bind the final source and captures. Real
signed-in cross-device/offline reconciliation, Android process death, staged-release activation/relaunch, lifecycle,
touch and provider acceptance remain required. Home and the broader system screens retain their prior presentation
until their own D-35 rebuild.

Reproduce the process-boundary storage check with
`python -m unittest tools.tests.test_unity_entry_checkpoint_process -v`. It compiles a temporary probe against the actual
engine-free Core source, runs separate processes to write/read and interrupt before temporary-file promotion, then checks
backup recovery and account separation. This verifies the disk protocol across processes; it is not an Android lifecycle
or full-player force-stop test.
