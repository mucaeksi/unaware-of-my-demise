# Unity Production Review

The **hub/home**, **hub/company**, **hub/chapters**, **hub/companion**, **hub/team**, **hub/armory**, **hub/actions** **hub/archive**, **hub/invitations** and **hub/errands** scenarios run the real native hub/system controllers with explicit isolated account and mutation/status fixtures. [Invitations/Errands guide](../media/SOL_INVITATIONS_AND_ERRANDS.md). [Archive reader guide](../media/SOL_ARCHIVE_READER.md). [Company/Sweep guide](../media/SOL_COMPANY_AND_SWEEP.md). The new shelter plate is an OpenAI candidate with human/native-2K acceptance open. [Hub guide, prompt and limits](../media/SOL_NATIVE_HUB.md).

First slice, LOCAL_TESTED on 2026-10-26. Open **Window → UOMD → Production Review** in Unity 6000.3.27f1.
The window is left open after delivery; Play Mode is stopped and `UomdMain` is restored.

The **campaign** scenario adds an explicit memory-only server fixture for the actual manual battle, settlement and
Saved Actions screens. It defaults to offline confirmation; captures show REVIEW FIXTURE and the bound request/hash/state.
No HTTP or device journal writes occur. See [campaign recovery guide](../UNITY_CAMPAIGN_OPERATIONS.md).

1. Pick one of the 27 OpenAI candidates. Disable **OpenAI candidates** to browse all 461 records
   (285 ingest entries plus 176 runtime/store references). Historical art is explicitly reference-only.
2. **Asset / provenance** shows stable ID/revision, native source dimensions, decoded alpha, exact source/prompt/reference
   hashes, QC, consumer mappings and existing owner feedback. Zoom/pan the checkerboard preview or compare a retained
   PNG/JPG source by its path and SHA-256. Ingest records and prior sources are never overwritten.
3. **Real scene / directing** selects Boot, Studio, Title, any canonical opening shot the eight rebuilt portrait poses any of the six tutorial story scenes or the four rebuilt battle units. Choose
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

Portrait extension: `portrait/fadyme` and `portrait/mahmut` load the real T1 Story controller. Select a canonical line, then restart/show it. The static `sol_composed` master override is explicit: authored emotion mappings remain unchanged. Both new actors and the historical background are identified by consumed paths and source identities in capture metadata. Pause holds line/voice; subtitle visibility controls the dialogue panel. Stage camera/light/particle sliders and applying stage authoring are disabled for portraits. [Sources/prompts and exact scope](../media/SOL_STORY_PORTRAIT_PILOT.md); [latest evidence](../evidence/sol-portrait-masters-2026-10-26.json).

The earlier portrait pilot checks were EditMode 115/115, PlayMode 3/3 and logic 102/102; those remain dated pilot evidence.

Expression extension: select `portrait/fadyme/resolve`, `/warm`, `/wry`, or `portrait/mahmut/dry_humor`, `/protective_resolve`, `/watchful` for a fixed selected pose. The original `portrait/fadyme` and `portrait/mahmut` remain composed-master checks. Select either character's `/authored` scenario to follow the canonical emotion aliases with both rebuilt actors. Seeking reconstructs the companion's earlier expression without playing skipped voice lines. Scenario IDs keep pose-specific feedback/captures separate. The six tutorial story scenes now use the rebuilt stages, native Story UI and these portraits in normal play; other story/battle/hub consumers remain migration work.

Current expression checks: EditMode 126/126, logic 111/111, twelve-assembly reference compile, repository verification, all fourteen T1 lines compared against both expected actor poses, three captured pixel sizes, paused resize/voice and restored Editor/preferences. [Guide and prompts](../media/SOL_STORY_EXPRESSIONS.md); [evidence](../evidence/sol-story-expressions-2026-10-26.json). Agents connect to Unity through CLI only; no MCP configuration was removed. No owner acceptance was created.

Limits: full story/tutorial/battle/hub authoring adapters remain future work; portrait masters have only the scoped adapter above. Audio seeking,
layered actors/rigging, generating raster revisions from the window, physical Android validation and final art acceptance
remain separate work. The initial workbench generated no media; the earlier portrait pilot generated two OpenAI masters. The current expression delivery used seven built-in calls for six selected variants, retaining one rejected attempt. No Gemini/provider API generation or undisclosed cost is claimed. Desktop pointer automation was denied Unity access during the earlier pilot, which used MCP/menu/public entry points and Editor tests. The current delivery uses CLI only; native pointer acceptance remains unverified.

Tutorial narrative extension: choose `story/tutorial_t1_before` / `_after`, T2 or T3, select a canonical line and restart/show. Pause holds the line and voice. Turn pause off to use Next (reveal, then advance), normal-speed Auto or voice replay; Space/Return on the stage also advances. Toolbar events do not advance the story. First-view tutorial Skip is absent. Review reaches a local end state without persisting entry progress or navigating to battle/Finish. Missing illustrations offer Try Again or explicit reading without images; failed story text offers retry only. [Production guide and native sizes](../media/SOL_TUTORIAL_NARRATIVE.md); [executed evidence](../evidence/sol-tutorial-narrative-2026-10-26.json).

Unit motion extension (2026-10-27): select `unit/mahmut`, `unit/fadyme`, `unit/bellbound_dead` or `unit/hollow_pilgrim`. Choose the animation state and sequence frame, then open/restart. Pause pins the selected pose; unpause auditions the authored sequence. Both original and mirrored facing use the real BattleUnitView at authored runtime scale, against a foot baseline. Non-looping actions return to idle; defeat clamps its last frame. These are read-only asset auditions, with combat/rewards/progress disabled. Capture metadata records actual state/frame, bounds, foot line, image paths and related ingest identities. Fadyme's 1536×2048 source is a derived assembly of two native 1536×1024 pages, never a claimed native tall generation. [Guide](../media/SOL_BATTLE_ATLASES.md); [evidence](../evidence/sol-battle-atlases-2026-10-27.json).

Manual battle extension: choose `battle/tutorial_t1`, T2 or T3. Unpause, select an available skill, select its legal target when required, then Confirm. There is no tutorial Auto/speed control. Pause preserves selection and holds combat input/unit movement; the review result restarts the local battle only. Missing rebuilt art offers Retry without advancing progress. Captures record actual source identities, image paths, action count and combat-log hash. The three normal tutorial battles use the same presenter. [Guide](../media/SOL_MANUAL_BATTLES.md), [scoped evidence](../evidence/sol-manual-battles-2026-10-27.json). These typed UI-event checks do not certify physical touch or Android.

Entry/Finish extension: `entry` starts a fresh, isolated full walkthrough through the real opening, six stories, three manual battles and native Finish. `finish` opens the native Finish layout immediately with a dedicated memory-only coarse-progress fixture. Switching to entry starts an independent rehearsal; the Finish fixture cannot complete its tutorials. Account and remote patch states are not live in review. Save status visibly carries REVIEW FIXTURE, and metadata marks memory-only state. Entry gallery labels show the active screen, phase, stage and canonical line. Feedback attaches only captures that consumed the exact selected asset revision. [Continuity contract and reproduction](../UNITY_ENTRY_CONTINUITY.md), [executed evidence](../evidence/sol-entry-continuity-2026-10-27.json).

Local-save failure is visible before Finish too: Title/opening/story/battle show a native warning with Retry Save. The isolated storage-failure probe preserves the current story line through retry; its warning is explicitly marked REVIEW FIXTURE. [Focused evidence](../evidence/sol-entry-save-warning-2026-10-27.json).
