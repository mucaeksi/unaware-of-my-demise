# UOMD — Start here

Read [AGENTS.md](../../AGENTS.md), [authority.md](../../.codex/standards/authority.md),
[CLAUDE.md](../../CLAUDE.md) and the [art/code handoff](../ART_AND_CODE_HANDOFF.md)
before choosing work. Older takeover prompts are historical context and do not
override current owner instructions.

The owner's latest request is to fix review findings, recover missing dialogue,
and finish the first AAB before expanding creative work. Google APIs will be
used for Japanese voice and music, together with the owner, step by step.
See [the first AAB plan](../release/FIRST_AAB_PLAN.md) for scope, evidence and open
decisions. Codex is authorized to prepare review fixes for this task; ongoing
character/environment design remains Codex's responsibility and coding/integration
remains Claude's. The owner now authorizes validated cloud changes to be pushed
to `main`; desktop review uses GitHub Desktop fetch/pull and the local Godot
project. See [cloud/main sync](CLOUD_MAIN_SYNC.md).

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
