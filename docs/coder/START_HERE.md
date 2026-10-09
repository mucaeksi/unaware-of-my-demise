# UOMD — Start here

Read [AGENTS.md](../../AGENTS.md), [authority.md](../../.codex/standards/authority.md),
[CLAUDE.md](../../CLAUDE.md) and the [art/code handoff](../ART_AND_CODE_HANDOFF.md)
before choosing work. Older takeover prompts are historical context and do not
override current owner instructions.

The owner's latest request closes Codex's AAB responsibility with the prepared
first-AAB fixes/build evidence. From here Codex inspects the game/scripts and
produces assets/designs, starting with all Fadyme contexts. Claude owns future
coding, fixes, runtime integration and AAB builds. Read the
[Fadyme audit and design scope](../../narrative/15_Art_Workbench/characters/fadyme/audit_v001/README.md)
for exact missing audio IDs, expression fallbacks, asset measurements and source
integrity gaps. Japanese voice and music use Google APIs with the owner step by
step; no paid batch is implied. Validated cloud deliverables are authorized for
`main`; desktop review uses GitHub Desktop fetch/pull and local Godot.
See [cloud/main sync](CLOUD_MAIN_SYNC.md) and the
[first AAB plan](../release/FIRST_AAB_PLAN.md) for the closing technical handoff.

Read [CURRENT_STATE.md](../CURRENT_STATE.md), [PROJECT_MAP.md](../PROJECT_MAP.md),
[GAME_TOOLCHAIN.md](../../GAME_TOOLCHAIN.md), and the current task's source notes.
The active Entry implementation scope remains until the owner selects another
screen. Keep stable IDs, locked references, English UI and Japanese voice.

Stage design sources, prompts, candidates, approvals and provenance under
`narrative/15_Art_Workbench/`; promote approved derivatives through the handoff.
The secondary Production folder and Drive LEGACY originals remain read-only.
Keep credentials and signing keys outside the repository. Preparing a change or
a local review AAB does not authorize store/app publication or paid batches.
The current owner's cloud/main push authorization is explicit; existing CI and
its configured automatic Worker/admin deployment may run after a push.

Current Fadyme production update, 2026-10-09: the owner explicitly requests asset production only, no game integration; visual expressions → animation/VFX → story/cinematic/UI → audio last. Old Sulafat VO is archived byte-exact under `narrative/13_Archive/fadyme_voice_sulafat_2026-10-09/`; it must not be promoted. New VO is Google Chirp 3 HD `ja-JP`, voice ID pending audition, all 241 lines need new recordings. Fadyme theme music is preserved. Current staged production: [production_v002](../../narrative/15_Art_Workbench/characters/fadyme/production_v002/README.md). Claude owns runtime bindings/imports/state gates and subsequent AAB work. No paid API batch has been executed.
