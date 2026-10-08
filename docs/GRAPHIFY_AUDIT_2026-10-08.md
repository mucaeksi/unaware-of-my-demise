# Graphify project inspection and continuation — 2026-10-08

The project map was rebuilt locally after `graphify-out/graph.json` was found
absent. Standard Graphify extraction was supplemented with authored-file
inventory, conservative Godot extraction, document structure and grounded
document concepts. The interactive map and full report are in `graphify-out/`;
`coverage.json` records the final counts and explicit limits.

## Inspection findings

The current project has five main connected areas:

- **Client presentation:** `AppShell` hosts screens; `StoryDirector` coordinates
  the startup/Entry/story flow. Entry presentation is split into `EntryScreen`,
  `EntryPrologue`, shot/actor components and shared UI utilities.
- **Application and state:** `GameFlow`, `GameBackend` and `PlayerState` connect
  screen actions, backend results and adopted player snapshots. Content
  installation/release checks and restart handling form a separate startup
  boundary.
- **Game rules and content:** `game/scripts/core/` owns content, battle and
  progression logic. `game/data/content/` supplies authored packs; parity
  fixtures and tests connect the Godot implementation to server rules.
- **Server and persistence:** the current server is a TypeScript Cloudflare
  Worker using Hyperdrive and Neon PostgreSQL, with migrations under
  `database/`. Bootstrap/release contracts and mutation snapshots cross the
  client/server boundary. This is source inspection, not a deployment check.
- **Creative sources and decisions:** `narrative/`, UI/design documents and
  decision records connect presentation assets to authored intent. Historical
  mirrors and generic framework instructions need their source authority kept
  explicit; folder location or graph centrality alone does not decide canon.

Graph queries surface `Outcome`, `BattleUnit`, `UiKit` and `ContentModels` as
highly connected project symbols. GUT and Godot AI also appear as hubs because
plugins are included; high degree alone is not an architectural defect.

1. **Godot needs the project adapter.** Native Graphify 0.9.80 skips `.gd`,
   `.tscn`, `.tres` and `.gdshader`. The adapter maps all 492 existing Godot
   source/resource/config files, including plugins and tests. It resolves all
   authored scene/resource/project resource targets. The remaining literal
   diagnostics are mostly directory prefixes and intentional test inputs;
   they are not a list of broken runtime assets.
2. **A complete update must preserve graph information.** Native update was
   exercised and did flatten distinct parallel relations. The final project
   refresh restores a MultiDiGraph. Recursive calls, public/private method
   identity and scene root/child identity were independently checked and fixed
   in the extraction tooling. Original Godot source was not changed.
3. **Current development documentation is inconsistent.** `GAME_TOOLCHAIN.md`
   and root `README.md` retain cloud-only language; current `AGENTS.md` sets
   local Godot work. `docs/ARCHITECTURE.md` retains a Fastify diagram; current
   `server/README.md` describes Worker → Hyperdrive → Neon. These mismatches
   are recorded, not used to replace working architecture.
4. **Generic test guidance differs from the actual harness.**
   `.claude/skills/test-setup/SKILL.md:19` and
   `.claude/docs/coding-standards.md:97` name gdUnit4. The current CI invokes
   GUT at `.github/workflows/ci.yml:106`. Generic window-launch/capture/quit
   guidance also differs from the owner's persistent live-preview workflow.
5. **Continuation pointers are stale.** `production/session-state/active.md`
   and `docs/ui/narrative-v002/README.md` omit later presentation V003,
   grounding V004 and DEC-0047. Production remains a read-only creative source.
6. **Narrative navigation has historical paths and mirrors.** Some package
   READMEs still refer to pre-consolidation `lore/`, `story/`, `art/` and
   `audio/` locations. Exact SHA-256 duplicates are catalogued separately;
   duplication alone does not authorize deletion or establish canon authority.

Detailed provenance and read depth are in `PROJECT_DOCS_FINDINGS.md`,
`FRAMEWORK_DOCS_FINDINGS.md`, `GODOT_EXTRACTION_NOTES.md`, and `MAP_REVIEW.md`
inside `graphify-out/`. Long generic templates and historical campaign texts
received focused surveys; this is not a paragraph-by-paragraph certification.
Image/audio content is indexed by identity, paths and usage, not exhaustively
visually interpreted or transcribed. No external LLM/audio API was invoked.

## Validation performed in this session

- Godot headless UI suite: **152/152 tests, 103,699 assertions**, 16 scripts,
  45.05 seconds. No `SCRIPT ERROR` or `ERROR:` lines in that run.
- Graph checks: inventory IDs, source evidence, class/scene/resource links,
  endpoint closure, parallel relations, recursive-call retention, semantic
  source hashes, private/public method separation and collision handling.
- Real Graphify `query`, `explain`, and `path` commands were exercised. A
  script and scene can share a label; use exact IDs or `path::symbol` when
  Graphify reports ambiguity. A shortest path is a structural relationship,
  not proof of runtime control flow.
- SQL extraction was enabled by adding Graphify's `tree-sitter-sql` optional
  dependency. Procedural SQL blocks have file coverage without full symbol
  interpretation. Native extraction also reports a Gradle expression that it
  does not parse; this does not establish a failed Android build.
- The Godot MCP session check returned no active session. No editor/runtime
  restart was performed. The prior session's PID, screenshots and desktop
  timing samples remain historical evidence, not a new live validation.
- No remote CI, deployment, Android-device acceptance or external service
  delivery was performed. No project push, archive move, gameplay change or
  creative-source modification was made.

Evidence: `build/graphify-map-20261007/` (the directory uses the session's start
date). The full-map refresh command and coverage limitations are documented in
`docs/GRAPHIFY_PROJECT_MAP.md` and appended to `AGENTS.md`.

## Resume Master Coding 1

The last completed implementation is **Entry prologue grounding V004 / DEC-0047**:
planted feet, authored road perspective, intact Ordinary Days loaf and improved
Names writing motion. The newer UI test run above preserves that checkpoint.

The latest uncompleted owner request in **Master Coding 1** is the deep folder
inspection and reorganization, preserving everything already implemented and
moving proven obsolete material into `.archive`. Its subsequent test request
was interrupted by the connection failure. This map supplies the dependency
and duplicate evidence needed before any move; no move has happened yet.

Continue that cleanup from the graph and existing source authorities. Restore
or attach the live Godot MCP session before meaningful UI/gameplay changes,
then reuse `scripts/art_review/preview_session.gd` for the Entry preview.
The owner chooses the next screen. Three-part tutorial design, bootstrap-pack
separation, Japanese narrator audition/audio generation and Android acceptance
remain distinct pending work; none is silently treated as already implemented.

The existing dirty worktree was preserved. Only Graphify tooling, Graphify
instructions, this inspection note and generated mapping/evidence were added.
