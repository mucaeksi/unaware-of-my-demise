# Unity Production Review

First slice, LOCAL_TESTED on 2026-10-26. Open **Window → UOMD → Production Review** in Unity 6000.3.27f1.
The window is left open after delivery; Play Mode is stopped and `UomdMain` is restored.

1. Pick one of the eleven OpenAI candidates. Disable **OpenAI candidates** to browse all 445 records
   (269 ingest entries plus 176 runtime/store references). Historical art is explicitly reference-only.
2. **Asset / provenance** shows stable ID/revision, native source dimensions, decoded alpha, exact source/prompt/reference
   hashes, QC, consumer mappings and existing owner feedback. Zoom/pan the checkerboard preview or compare a retained
   PNG/JPG source by its path and SHA-256. Ingest records and prior sources are never overwritten.
3. **Real scene / directing** selects Boot, Studio, Title or any canonical opening shot. Choose
   **Open isolated preview**, then **Restart / show selected** when changing scenarios. This runs the actual production
   controllers in `ProductionReviewPreview.unity`, with a fresh session and embedded `rel_0001` content.
4. Pause/restart, audition audio, toggle subtitles/reduced motion/flash and choose 1920×1080, 2400×1080 or 1600×1200.
   The cutout/gesture toggle simulates 96px side, 28px top and 48px bottom insets in authored panel coordinates;
   it is not a device-specific cutout measurement. Aspect changes work while paused.
5. For Studio/opening stages, adjust camera framing, subtitle bottom, stage lighting and particles. **Save Draft** writes
   only `docs/review/drafts/<scenario>.json`; **Load Draft** reopens it. **Apply reviewed presentation** writes the runtime's
   `Assets/_UOMD/Resources/Rebuild/Presentation.json`, retaining the prior config under `drafts/history/`. Reopen the preview
   to verify persisted changes. This button applies scene presentation, never art approval. Title/Boot use their UXML/USS;
   stage sliders are explicitly not presented as title layout edits. Canon text/order/holds are not edited by this tool.
6. **Capture settled Game view + metadata** briefly holds the selected scene, captures native UI and stage pixels,
   restores playback, and saves under `docs/review/captures/`. The metadata includes commit/working-tree scope, release,
   actual asset revision/source and entry hashes, scenario/line, pixels, simulated insets, settings, UI bounds and observed
   errors. [Local gallery](index.html) and [review index](PRODUCTION_REVIEW.json) retain the links/hashes.
7. **Requests / evidence** records a precise revision request or agent QC note against ID + revision + source/entry hashes,
   scenario/line and prior capture hashes. Requests/outcomes remain visible after reopening. Human art acceptance remains
   in `tools/ingest_art.ts` and its `qc.human` schema; no button manufactures owner approval or closes device/release gates.
8. **Stop & restore**, closing the window or stopping Play ends the owned session. Original scene/start scene, viewport,
   gizmos and background mode are restored. Live API calls and preference writes are blocked; patch downloads/cache,
   saved authentication and first-view checkpoints are not inherited. Dirty scene edits must be saved/discarded explicitly
   before starting; the tool never saves unrelated dirty scenes.

For initial-bundle chibi atlases, the asset page also previews authored states/frames, FPS, loop/one-shot behavior and
grounded pivot guides. Historical campaign atlases without a decoded initial-bundle copy show their metadata and an
explicit preview-unavailable message. A historical approval does not approve a rebuilt replacement.

The workbench is Editor-only; typed preview routes, account/network guards and rehearsal controls are compiled out of
player builds. Runtime presentation configuration is ordinary shipped authoring data, not a new executable patch path.
The reference compiler now checks Editor-defined runtime dependencies normally and offers `--player-only` to check their
absence from the player compilation. Its viewport adapter contains the reflected Editor API and follows
[Unity's 6000.3 source](https://github.com/Unity-Technologies/UnityCsReference/blob/6000.3/Editor/Mono/GameView/GameViewSizeGroup.cs).

The Control Center was inspected before choosing storage: Animations uses browser-local historical review state;
Assets approves verified R2 assets through authenticated endpoints. This window projects the existing ingest authority
and stores only scene feedback/capture links locally; it does not copy those browser approvals or contact the live backend.

Verified: menu/window opening and reopening, all eleven source chains, fixture revision persistence without approvals,
draft round-trip, actual fresh-Play camera/subtitle authoring, all nine real shots and pause/plate cleanup, three captured
pixel sizes, exact preference/checkpoint/session snapshot preservation, normal startup/replay separately, EditMode 113/113,
PlayMode audio 3/3, headless logic 101/101 and repository verification. See [executed evidence](../evidence/sol-production-review-2026-10-26.json).

Limits: no story/tutorial/battle/hub preview adapters yet; those follow their rebuilt controllers/assets. Audio seeking,
layered actors/rigging, generating raster revisions from the window, physical Android validation and final art acceptance
remain separate work. No new media was generated or paid service called. Desktop pointer automation was denied Unity
access by the host; Unity MCP/menu/public entry points and Editor tests were used, so manual pointer acceptance is unverified.
