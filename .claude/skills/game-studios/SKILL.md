---
name: game-studios
description: Game-studio roles and production workflows (Claude Code Game Studios v1.2.0) mapped onto UOMD - design review, balance, QA, release, live-ops, Unity specialist roles. Use when acting as a studio role or running such a workflow.
license: MIT
---

# Game studio roles and workflows (UOMD adaptation)

Vendored from [Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) v1.2.0
(commit `05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418`, MIT, licence in
`.claude/third-party-licenses/donchitos-claude-code-game-studios-LICENSE.txt`). Only Markdown/YAML is vendored: no hooks,
scripts, `settings.json`, `CLAUDE.md` or `project.yaml`. Godot, Unreal and DOTS agents are left out. Upstream workflows are
stored as `references/skills/<name>/WORKFLOW.md` so no host loads them as live skills.

This is a **library of roles and checklists**, not a second project framework. Root `README.md` stays the master prompt,
`narrative/` the canon, `docs/DECISIONS.md` the decision log. Never run upstream `/start`, `/setup-engine`, `/adopt` or
`/onboard`, and never create the upstream `design/`, `production/`, `src/` or `project.yaml` tree.

## How to use

1. Pick the role or workflow below and read its file in `references/` (by section when long).
2. Translate it for this host and project:
   - lines starting with `` !`bash ...` `` and `${CLAUDE_SKILL_DIR}` / `yaml-helper.sh` calls are Claude Code preprocessing
     of the upstream config; skip them (UOMD has no `project.yaml`, use the defaults "collaborative" and "ask");
   - `AskUserQuestion` = ask the owner in chat; `Task`/`Agent` = your host's subagent tool (`invoke_subagent` in
     Antigravity) with the role file as its instructions; `Read/Write/Edit/Bash/Grep/Glob` = your file and shell tools;
   - upstream paths map to UOMD paths (table below); anything upstream writes under a missing folder goes to the mapped
     file, or to the chat when no mapping fits.
3. Project rules win on conflict: `uomd-unity-engine`, `unity-deterministic-combat`, `unity-ui-toolkit`, `uomd-battle`,
   `cloudflare-d1-liveops`, the D-28/D-32/D-33 delivery rules and the owner approval gates in README.

| Upstream | UOMD |
| --- | --- |
| `design/gdd/*`, game concept, pillars | `docs/GAME_FLOW.md`, `docs/COMBAT_RULES.md`, `docs/combat/`, `docs/ECONOMY_SINGLE_CURRENCY.md`, `docs/economy/` (read; propose edits) |
| narrative, lore, characters, factions | `narrative/` — canon: never rewrite silently, propose to the owner |
| art bible, asset specs | `art_specs/`, `narrative/15_Art_Workbench/`, skills `create-game-assets`, `google-anime-media` |
| ADRs, architecture docs | `docs/DECISIONS.md`, `docs/ARCHITECTURE.md` |
| sprint plan, milestones, stories, retrospectives | `docs/NEXT_STEPS.md`, `docs/DEV_TRACKER.json` |
| QA plans, test evidence, smoke/soak/regression | `docs/QA_ANDROID.md`, `docs/evidence/`, `npm run verify`, Unity EditMode, `unity_ci` |
| release/launch checklists, patch notes, hotfix | `docs/RELEASE_ROADMAP.md`, `docs/RUNBOOK.md`, `docs/PATCHING.md` (content ships as signed data patches) |
| live-ops, economy model, analytics | `docs/economy/`, `docs/MONITORING.md`, `apps/api`, `apps/admin` |
| `src/` engine code | `apps/unity/` (C#), `apps/api/`, `apps/admin/` |

## Roles (`references/agents/<role>.md`)

- **Unity**: `unity-specialist` (lead), `unity-ui-specialist`, `unity-shader-specialist`, `unity-addressables-specialist`.
  In UOMD the UI is Runtime UI Toolkit built in C# (no UGUI/TextMeshPro), content is not Addressables but signed
  StreamingAssets/patch data, and combat is the deterministic `Uomd.Combat` port.
- **Direction**: `creative-director`, `technical-director`, `producer`, `art-director`, `audio-director`, `narrative-director`.
- **Design**: `game-designer`, `systems-designer`, `economy-designer`, `live-ops-designer`, `level-designer`, `ux-designer`,
  `world-builder`, `writer`.
- **Engineering**: `lead-programmer`, `gameplay-programmer`, `engine-programmer`, `ui-programmer`, `ai-programmer`,
  `network-programmer`, `tools-programmer`, `devops-engineer`, `security-engineer`, `analytics-engineer`, `prototyper`.
- **Quality and release**: `qa-lead`, `qa-tester`, `performance-analyst`, `accessibility-specialist`, `localization-lead`,
  `release-manager`, `community-manager`, `technical-artist`, `sound-designer`.

Hierarchy, escalation and gate rules: `references/docs/coordination-rules.md`, `references/docs/agent-roster.md`,
`references/docs/director-gates.md`.

## Workflows most useful here (`references/skills/<name>/WORKFLOW.md`)

- Design: `design-review`, `balance-check`, `consistency-check`, `scope-check`, `propagate-design-change`, `ux-review`.
- Production: `sprint-plan`, `sprint-status`, `estimate`, `milestone-review`, `retrospective`, `tech-debt`.
- QA: `qa-plan`, `smoke-check`, `soak-test`, `regression-suite`, `playtest-report`, `bug-report`, `bug-triage`,
  `perf-profile`, `asset-audit`, `content-audit`.
- Release and live-ops: `release-checklist`, `launch-checklist`, `day-one-patch`, `patch-notes`, `hotfix`, `changelog`,
  `team-live-ops`, `localize`.
- The full list with one-line summaries: `references/docs/skills-reference.md`. Document templates:
  `references/docs/templates/`.

Before acting on a workflow that writes files, say which UOMD file it will change. Report what was skipped because it
depends on upstream infrastructure (hooks, `project.yaml`, upstream folders).
