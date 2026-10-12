# Codex skills alongside Claude

The owner authorized Codex development alongside Claude on 2026-10-11. Root README remains the sole engineering master prompt; narrative/ remains the canon. `AGENTS.md` is the Codex entry point and does not replace either source.

Codex has **54 repository skills**: adapters for all **46** pinned skills on main, plus eight project-specific skills. Claude continues to use its original `.claude/skills/`, `CLAUDE.md`, `.mcp.json`, bootstrap, lock file, scripts/data and licenses. Those files are unchanged by this adaptation. The Codex adapters reference canonical content rather than duplicating it; read the linked source in full when applying a skill and resolve its relative resources against the canonical directory.

## Usage and parallel development

Open the repository/current task worktree as the Codex project. Start a fresh session or reload skills after fetching the change. A running chat's advertised skill/tool list does not automatically become a new runtime just because files were added; read the project adapter manually when automatic discovery is unavailable.

Example requests:

```text
$uomd-codex-workflow Implement the assigned change on current main.
$ponytail-review Review the patch without editing files.
$phaser4-mobile-qa Check Android landscape input and lifecycle.
$uomd-monitoring Verify the latest SSV result and deployed version, read-only.
$uomd-monetization Add a regression test for duplicate callbacks.
$uomd-workers-review Review API handlers and binding configuration, read-only.
$uomd-android-release-qa List first-AAB gaps using source and device evidence.
$uomd-visual-regression Check the affected Control Center flow.
```

Claude slash commands/plugin-qualified invocations are mapped to Codex `$skill-name` requests. Generic Bash/Read/Write/Task instructions use the host's actual tools. Delegation, authentication, network access and spending follow the current session; a source skill does not supply those capabilities.

Use separate task branches/worktrees for Claude and Codex. Fetch main before starting and again before publishing; integrate intervening commits and recheck affected behavior. Follow the owner's verified-step-to-main policy without force-pushing or overwriting another agent's working tree. The old Claude-only assignment table in docs/AGENT_RULES.md does not override explicitly assigned Codex work. Ordinary code tasks, canon/media constraints and production/spending gates remain governed by README.

## Complete adapted catalog

Each listed name has `.agents/skills/<name>/SKILL.md` linked to `.claude/skills/<name>/SKILL.md`.

| Family | Adapted names | Codex-specific handling |
| --- | --- | --- |
| Focused development / review | `ponytail`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`, `ponytail-review` | Scope/mode preserved; Codex invocation; no plugin auto-install/update or fictitious benchmark evidence |
| Graph and browser | `graphify`, `chrome-devtools` | Existing pinned runtimes; real tool schemas; rg/Playwright fallback reported when the MCP is absent |
| UI guidance | `ui-ux-pro-max` | Resolve CLAUDE_SKILL_DIR to the canonical scripts/data; preserve established Gothic tokens and architecture |
| Backend, security, media | `cloudflare-d1-liveops`, `security-audit`, `google-anime-media` | Actual connector access; D1-only staging builds; audit isolation retained; Google-only approved media/budgets |
| Project Phaser workflows | `phaser4-engine`, `phaser4-battle`, `phaser4-anime-ui`, `phaser4-chibi-animation`, `phaser4-mobile-qa`, `phaser4-narrative-cinematics` | Installed Phaser 4 APIs; narrative/asset provenance; browser evidence distinguished from Android acceptance |
| Official Phaser: configuration / state | `game-setup-and-config`, `scenes`, `events-system`, `data-manager`, `time-and-timers`, `loading-assets` | Canonical technical content reused; installed types checked before implementation |
| Official Phaser: objects / drawing | `sprites-and-images`, `game-object-components`, `groups-and-containers`, `graphics-and-shapes`, `text-and-bitmaptext`, `geometry-and-math`, `curves-and-paths` | Same canonical resources and version pin |
| Official Phaser: animation / rendering | `animations`, `tweens`, `particles`, `cameras`, `filters-and-postfx`, `render-textures`, `scale-and-responsive` | Same canonical resources and version pin |
| Official Phaser: interaction / other | `input-keyboard-mouse-touch`, `audio-and-sound`, `physics-arcade`, `physics-matter`, `tilemaps`, `actions-and-utilities`, `v3-to-v4-migration`, `v4-new-features` | Same canonical resources and version pin; no implied engine upgrade |

The 28 official Phaser topics remain pinned to phaserjs/phaser revision `02d8931b626d9764c133cbb3fbf99966c03c757c`. Archive pins/licenses remain in `.claude/skills-lock.json` and `.claude/third-party-licenses/`. Graphify is 0.9.84, Chrome DevTools MCP 1.10.1, Ponytail 5.1.0 and UI/UX Pro Max 2.15.0 according to the existing source inventory. Skill instructions mentioning newer upstream tool options are checked against the actual pinned runtime before use.

## Additional skills and recommendations

| Skill / capability | Decision | Value |
| --- | --- | --- |
| [uomd-codex-workflow](../.agents/skills/uomd-codex-workflow/SKILL.md) | Added, project-authored prompt only | Safe parallel development, current-main integration and truthful validation/deployment evidence |
| [uomd-monitoring](../.agents/skills/uomd-monitoring/SKILL.md) | Added, project-authored prompt only | Central panel coverage, safe SSV/payment/API outcomes, player/economy provenance and freshness |
| [uomd-monetization](../.agents/skills/uomd-monetization/SKILL.md) | Added, project-authored prompt only | SSV encoding/signatures, Play/RTDN lifecycle, immutable single-currency ledger and native acceptance |
| [uomd-cloudflare-platform](../.agents/skills/uomd-cloudflare-platform/SKILL.md) | Added project entry point to official plugin/current docs | Current Workers/D1/R2/Access platform evidence within the approved UOMD architecture |
| [uomd-workers-review](../.agents/skills/uomd-workers-review/SKILL.md) | Added project entry point to official best-practices skill | Full-file code/config/type review with actual impact and retrieval before platform claims |
| [uomd-wrangler](../.agents/skills/uomd-wrangler/SKILL.md) | Added project entry point to official CLI skill | Pinned local CLI, explicit config/environment, read-only scope and single migration owner |
| [uomd-android-release-qa](../.agents/skills/uomd-android-release-qa/SKILL.md) | Added focused project acceptance workflow | Existing QA_ANDROID cases plus physical-device/Play sandbox evidence; plans distinguished from executed results |
| [uomd-visual-regression](../.agents/skills/uomd-visual-regression/SKILL.md) | Added focused project browser workflow | Reproducible states, existing Playwright flows, landscape/touch and safe screenshot/trace handling |

All eight project additions contain instructions only: no runtime packages, executable hooks, API keys, new external permissions or paid generation jobs. Project skills are versioned by Git. They remain separate from generated adapters and survive regeneration. The five follow-up additions reuse existing reviewed capabilities rather than installing an external Android/QA catalog.

### Official guidance provenance and project adaptations

The three Cloudflare entry points were reviewed against the installed Cloudflare plugin packages `c0/cloudflare`, `c0/workers-best-practices` (including references/review.md), and `c0/wrangler` on 2026-10-11. These aliases belong to the current host, not portable filesystem paths; discover the installed skill package again in another session. They are runtime-provided official guidance, not new third-party source files copied into this repository. No external installer was executed. Retrieve current official docs/types when applying them; Git pins the project-authored entry points.

Project adaptations preserve the locked Wrangler/test setup and existing resource IDs, prefer available connector access over a missing CLI credential, keep D1-only/Google-only decisions, and never auto-update packages, compatibility flags, permissions or deployments from generic examples. Current provider documentation is compared with installed versions; only an authorized implementation task changes those versions. Android/visual workflows reuse canonical Phaser guidance and the existing acceptance plan/tests.

The [new-session project review prompt](NEW_SESSION_PROJECT_REVIEW.md) implements the owner's requested sequence: inspect current main read-only, present a numbered evidence-backed backlog, wait for a selected task, complete that task and wait for the next selection. This overrides the general implementation loop for an explicitly review-only first phase.

## Synchronization and integrity

```bash
python3 tools/sync_codex_skills.py
python3 tools/sync_codex_skills.py --check
python3 -m unittest discover -s tools/tests -p 'test_*.py'
python3 tools/bootstrap_skills.py --verify
python3 tools/skills_doctor.py
```

The first command writes only the generated `.agents/skills/<canonical-name>/SKILL.md` files and `.agents/skills-lock.json`; the check command is read-only. Source SKILL.md hashes must match the existing Claude lock before any output is generated. The Codex manifest records every canonical resource and adapter hash, plus the Claude lock hash, so resource drift also fails a later check. Relative script/reference locations stay in the canonical source. Generated adapters are overwritten on refresh; edit the generator for durable host adaptations and add independent project skills under different names.

Destination/source symlinks and invalid targets are rejected before writes. A removed canonical skill requires explicit review of its obsolete generated adapter; the tool does not silently delete it or unrelated manual skills. No installer, source script or hook is run by synchronization. Source upgrades are separate reviewed work: update/verify the canonical inventory with its existing procedure, then regenerate and verify the adapters.

## Optional MCP configuration

`.codex/config.toml` mirrors Claude's two pinned launcher commands but initially sets both to `enabled = false`. It does not edit `.mcp.json`, global Codex configuration, authentication or permission settings. Project configuration also depends on the local Codex project being trusted; follow the host's existing trust policy.

When the relevant runtime is already available and a task requires it, enable only that server in the Codex project configuration and start Codex from the repository root (the launcher paths are relative). Chrome DevTools needs Node/npx and a supported Chromium installation; Graphify needs Python/uv and `graphify-out/graph.json` for useful queries. Inspect the launcher/source, actual installed package/tool version and host permissions first. Enabling a declaration is not a successful connection. Do not auto-upgrade the pinned versions, install upstream hooks or request new paid extraction credentials merely to make the declaration appear usable.

The current connector/plugin tools may already cover Cloudflare and browser capabilities independently of this optional file. Query actual available tools before setting up a second connection.

## Verification record — 2026-10-11

On the implementation worktree, Codex CLI **0.159.0-alpha.3** returned **49 enabled repository skills** and **zero repository skill errors** from a real `skills/list` request with `cwds` set to the repository and `forceReload: true`. This exercised native Codex discovery and frontmatter parsing, not just a Markdown file count. No model turn was started.

To repeat with a compatible CLI, start `codex app-server --stdio`, send JSON-RPC `initialize` with `clientInfo`, then `initialized`, then `skills/list` with `{"cwds":["/absolute/repo/path"],"forceReload":true}`; inspect repository paths/scopes, enabled flags and errors, then stop the server. Protocol schemas can be generated with `codex app-server generate-json-schema --out <scratch-directory>`; commands and schemas are version-dependent. See [Codex skills](https://developers.openai.com/codex/skills/) and [configuration reference](https://developers.openai.com/codex/config-reference/).

The adapter regression suite verifies lock/resource drift, read-only checks, regeneration/preservation, folded/quoted metadata, removed-source review and symlink/write-boundary rejection. Claude bootstrap/doctor static checks still pass. The optional MCP commands match the original configuration exactly and remain disabled; live Graphify/DevTools calls are not asserted by this adaptation.

The final change passed lint, all workspace typechecks, **365 workspace unit/integration tests** and **10 adapter regression tests**. The UI/UX canonical local search returned a real result for `useState` using the React data source. No gameplay, UI, database schema or native code changed, so browser/device acceptance was not rerun for this skills-only step.

The follow-up added five prompt-only skills and the new-session handoff. Native Codex discovery was rerun and returned **54 enabled repository skills with zero errors**. Adapter integrity/regression checks and unchanged Claude file checks were repeated; the application test suite was not repeated for Markdown-only additions.
