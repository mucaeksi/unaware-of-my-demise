# Sol Unity rebuild — execution and acceptance

Decision D-35, owner instruction 2026-10-26. This is an implementation plan under the root README, not a second master prompt.
Starting revision: `f341b018`. Working directory: `E:/Unity/unaware-of-my-demise`.

## Ownership and media

GPT Sol/Codex owns production planning, engineering, Unity, the API and Control Center, art direction, image production,
integration, QA and documentation. The owner pushes verified local commits. Production/public Play approval, legal facts,
upload-key custody and additional spending remain with the owner.

All rebuilt visual assets are newly generated with the built-in OpenAI image tool. Existing Gemini images are identity,
composition or atmosphere references only. Their old approval records remain historical; they are not approvals of a new
image. Preserve source PNGs, prompts, exact reference hashes, actual native dimensions and generator provenance. Never
claim an undisclosed model or price. No enlargement can turn a 1K output into a native 2K asset. The first title image is
an integration candidate at native 1672x941; the owner approved its visual quality and the direction for all subsequent
production on 2026-10-26. Native 2K and device gates remain open. Music and reviewed Japanese
voice production continue through the existing budget-guarded Gemini tools; this handoff authorizes no new API budget.

`docs/media/SOL_VISUAL_REBUILD.json` inventories the old approved artwork and tracked runtime/store bitmaps. A row is a
replacement obligation, not a promise that an image has already been generated. Keep canonical identity references and
old source history; migrate consumers only after the replacement passes ingest and in-engine review.

## Method

Rebuild the player experience in dependency order inside `apps/unity`; carry working domain systems over piece by piece.
Keep the existing client available as a behavioral reference during the transition. Preserve bit-exact TypeScript/C#
combat replay, account/economic authority, signed declarative patches, stable narrative IDs and the no-gacha story route.
D-34 mockups/prototypes are reference material; their design direction is stopped. New layouts use native UI Toolkit
UXML/USS with C# bindings where useful, without inheriting the old animated decoration library.

| Milestone | Deliverable | Acceptance |
| --- | --- | --- |
| RB-00 | Current ownership, source inventory and reproducible local baseline | Skill adapters pass; fresh Unity import, console and tests recorded against the actual tree; local commits only |
| RB-01 | Rebuilt startup, studio and title | Newly generated imagery; editable UI; real sign-in/continue/retry, accessible settings and privacy; 16:9, 20:9, 4:3 and safe areas; no fake realm/production labels |
| RB-02 | Prologue, narrative and three tutorials | Newly generated opening plates/portraits/three stages; localizable captions, reviewed Japanese audio, manual tutorial input, durable save/Continue/restart |
| RB-03 | Real combat presentation | New Mahmut/Fadyme/enemy animation atlases, readable skill/target/HP/Focus/turn/intent; actual engine events drive presentation; golden replay parity preserved |
| RB-04 | Whole first-binary systems | Operation recovery, server-sessioned campaign battles, identity/privacy/Billing/ads, complete compiled mode foundations and compatible patch validation |
| RB-05 | Android and first-AAB acceptance | Signed reproducible IL2CPP ARM64 build, physical-device/provider/fault/performance matrix and owner acceptance; first binary locked before broad later content production |
| RB-06 | World, complete roster and subsequent content | Remaining visual obligations, chapter/no-pull progression and full character identity/animation review; signed data-only season on the unchanged accepted AAB |
| RB-07 | Release and live operations | Current operational evidence, store/privacy/legal facts, restore proof, staged owner-approved public release and monitored updates |

## First delivery

- Original `sol_title_key_art_01` candidate with two explicitly recorded character-identity references, raw source and prompt.
- Existing `ingest_art` pipeline records the OpenAI origin and recognizes the canonical character-lock reference directory.
- `RebuildTitleScreen` replaces the registered title presentation; existing identity and entry services remain its behavior.
- UXML/USS title and settings use native controls and no Gemini bitmap UI kit. The old startup/story/battle screens remain
  migration work; this delivery does not claim a complete visual replacement or a release-ready rebuild.
- Exact verification and captures are recorded in `docs/evidence/sol-rebuild-2026-10-26.json` when executed.

## Full redesign direction and second delivery

The owner approved the first image and requested a complete redesign as a newly designed game on 2026-10-26. Carry this
direction through startup, story, tutorials, combat, the hub and every system screen. Every player-facing bitmap is a new
OpenAI production. Preserve canon and the tested domain contracts while rebuilding presentation and interaction.

The second delivery replaces startup/studio and the nine opening plates with a native URP 2D cinematic stage. The studio
emblem has true alpha; all captions and credits are live UI Toolkit text. Individual plate holds and stable narrative IDs
remain the canonical 120 seconds. Pause freezes voice, music, camera and particles; manual Auto-off waits at shot end;
muting preserves the spoken subtitle clock. Replay does not overwrite the first-viewing checkpoint. Old Studio, Title
and Prologue controllers, including the automatic flattened-video fallback, are removed after replacement.

This stage uses original whole-scene paintings, a camera push, a lit studio emblem, restrained practical light and at most
64 procedural particles. It holds at most two plate textures during crossfade and releases the old plate afterward.
Independent bell/rope/actor layer animation remains a later asset pass; these paintings do not constitute rigged actors.

Use Unity features where their visible effect serves the scene and survives the Android budget:

| Area | Native production approach | Required evidence |
| --- | --- | --- |
| Opening/story | URP 2D sprites, Light2D, camera choreography, bounded particles, editable UI Toolkit and voice-clock captions | Aspect ratios, reading/pause/mute/replay, lifecycle and memory ownership |
| Battle | Dedicated sprite atlases and explicit animation states, layered stage/camera, event-driven VFX, audio and feedback budgets | Deterministic replay unchanged, manual target/skill flow, readable telegraphs and device frame time |
| Hub/system UI | Native UXML/USS controls, safe-area layouts, accessible focus and meaningful transitions | Real account data, every touchpoint, loading/error/retry and operation recovery |
| Assets/data | Authored configs and existing verified patch/media loading; initial binary carries runtime code and capability foundations | Reproducible export, native dimensions, source/alpha/slicing, signed data-only patch compatibility |
| Release | IL2CPP ARM64, Android lifecycle, graphics/thermal/memory and native provider integrations | Signed artifact and physical-device evidence; owner release approval |

Owner review requirement added 2026-10-26: before scaling asset production, implement a usable Editor-only Production
Review workbench for asset/revision browsing, actual scene/shot preview, playback/aspect controls, feedback and captures.
Its concrete scope and isolation/acceptance requirements are in [the CLI context handoff](CODEX_CLI_MASTER_PROMPT.md#9-owner-inspection-and-revision-workflow--first-new-implementation-task).
The first workbench slice is implemented and locally tested: [usage](../review/README.md),
[evidence](../evidence/sol-production-review-2026-10-26.json). It browses the current candidates/reference inventory and
previews real Boot/Studio/Title/opening shots with drafts, feedback and captures. Extend it for new story portraits and
the three tutorial stages, followed by the real battle presentation.
The next local delivery adds two new alpha portrait masters and a real T1 canonical-line adapter ([pilot](../media/SOL_STORY_PORTRAIT_PILOT.md), [evidence](../evidence/sol-portrait-masters-2026-10-26.json)). Thirteen candidates are now browsable. The neutral master override is explicit and Editor-only; six expression variants, three tutorial stages and narrative UI remain before consumer migration and complete RB-02 acceptance.
Do not count old Gemini consumers, placeholder art, Editor captures or a local compile as a finished Android release.
