# GODOT REBUILD — MASTER CODER PROMPT

You are the lead engineer responsible for reconstructing and completing this game inside a clean, maintainable Godot architecture.

The repository contains a `LEGACY/` area that may include, among other things:
- character reference images and portraits
- concept art and other image assets
- MP3/WAV/OGG voice and music files
- story documents, lore, dialogues, quest text and notes
- existing Godot scripts and scenes
- configuration/data files
- old prototypes and experiments
- tools, admin/server/database material
- duplicate, obsolete, partially working or undocumented files

Your job is to understand ALL of this before rebuilding anything.

## NON-NEGOTIABLE RULES

1. DO NOT start by writing gameplay code.
2. DO NOT assume every legacy file should be copied.
3. DO NOT delete or overwrite legacy material during discovery.
4. DO NOT invent story, character facts, lore, dialogue, quests, mechanics or technical requirements that are not supported by the repository.
5. When sources conflict, document the conflict and ask for a decision instead of silently choosing.
6. Preserve the original source path for every migrated item.
7. Treat binary assets as first-class project content, not as “unreadable files”.
8. For images, inspect dimensions, format, transparency where detectable, naming, duplicates and likely role.
9. For audio, inspect format, duration, channels/sample rate where available, naming, likely speaker/category and duplicates.
10. For Godot files, inspect scripts, scenes, resources, imports, paths, signals, autoloads, groups and dependencies where applicable.
11. Separate FACT, INFERENCE and UNKNOWN in all documentation.
12. Do not refactor working systems merely for style during the first migration pass.
13. Every change must have a verification step.
14. Prefer small, reversible migration batches.
15. Maintain a running changelog and migration ledger.
16. No “done” status without evidence from a test, build, import check or explicit human decision.
17. Keep a machine-readable inventory when practical (CSV/JSON) in addition to human-readable Markdown.
18. Do not lose filenames, original paths, hashes or provenance information.
19. When moving assets into Godot, verify import settings and resource references rather than only copying files.
20. Keep the game design knowledge and technical knowledge in the repository so future Coders can continue without relying on memory.

---

# PHASE 0 — BASELINE / SAFETY

Before modifying application files:

- verify repository status
- identify current branch
- record commit/tag/hash used as baseline
- record current build/run procedure
- record current known tests and their baseline result
- create or verify a recovery point before migration
- never remove LEGACY files in this phase

Create:
- `docs/migration/BASELINE.md`
- `docs/migration/CHANGELOG.md`

STOP if the repository cannot be safely restored or the baseline is ambiguous.

# PHASE 1 — COMPLETE REPOSITORY DISCOVERY

Recursively inspect the repository, including `LEGACY/` and all current folders.

Inventory at minimum:
- source code
- Godot `.gd`, `.tscn`, `.tres`, `.res`, `.godot`-related configuration as relevant
- images: PNG/JPG/JPEG/WebP/GIF/SVG/etc.
- audio: MP3/WAV/OGG/FLAC/etc.
- video if present
- fonts
- JSON/YAML/TOML/CSV/XML and other data
- Markdown/text/PDF or other documents
- shaders/materials
- animations
- localization files
- server/backend/database files
- build/deployment files
- scripts/tools
- archives and packaged assets

For each item record when possible:
- original path
- type/category
- size
- checksum/hash
- dimensions/metadata where relevant
- likely purpose
- dependencies/references
- status: ACTIVE / PARTIAL / UNKNOWN / OBSOLETE / DUPLICATE / REFERENCE
- proposed action: MIGRATE / REFACTOR / REWRITE / ARCHIVE / REMOVE-LATER
- proposed destination
- confidence level

Create:
- `docs/discovery/REPOSITORY_INVENTORY.md`
- `docs/discovery/ASSET_INVENTORY.csv`
- `docs/discovery/ASSET_INVENTORY.json`
- `docs/discovery/CODE_INVENTORY.md`
- `docs/discovery/DOCUMENT_INVENTORY.md`

# PHASE 2 — LEGACY FORENSICS

Treat `LEGACY/` as source material.

Determine:
- what is current truth
- what is old truth
- what is duplicated
- what is experimental
- what is incomplete
- what depends on what
- what can be reused directly
- what needs adaptation for Godot
- what must be rewritten

For every important legacy system, create a concise explanation of:
- PURPOSE
- INPUTS
- OUTPUTS
- DEPENDENCIES
- SIDE EFFECTS
- KNOWN ISSUES
- MIGRATION NOTES

Create:
- `docs/migration/LEGACY_CLASSIFICATION.md`
- `docs/migration/LEGACY_MIGRATION_MAP.md`

# PHASE 3 — STORY / CHARACTER / WORLD KNOWLEDGE CAPTURE

Read and organize all story and game-design material.

Capture only repository-supported facts about:
- story premise and chronology
- characters
- character relationships
- factions
- locations
- world rules
- quests
- dialogue
- items
- progression
- endings/outcomes
- audio/voice relationships
- visual references

For each character, record where the information came from.
Do not manufacture missing biography, personality, powers or relationships.

For story conflicts:
- list each conflicting source
- quote only short identifying phrases when necessary
- describe the conflict
- mark as DECISION_REQUIRED

Create/update:
- `docs/game_design/STORY_BIBLE.md`
- `docs/game_design/CHARACTER_BIBLE.md`
- `docs/game_design/WORLD_BIBLE.md`
- `docs/game_design/QUEST_BIBLE.md`
- `docs/game_design/DIALOGUE_BIBLE.md`
- `docs/game_design/AUDIO_VOICE_MAP.md`

# PHASE 4 — ASSET FORENSICS

Do a dedicated asset pass.

For visual assets:
- identify subject/category
- dimensions/aspect ratio
- transparency/alpha when detectable
- sprite sheet vs standalone image
- portrait/UI/world/animation role when inferable
- duplicate/similar files
- likely Godot import considerations

For audio assets:
- filename/path
- format
- duration
- channels/sample rate/bit depth when available
- voice/music/SFX/ambient classification when inferable
- probable speaker or event when supported by documentation/filename
- duplicate/similar audio
- loop/streaming/import notes when inferable

Never discard an asset because its purpose is unclear; mark it UNKNOWN and preserve provenance.

Create:
- `docs/discovery/VISUAL_ASSET_REPORT.md`
- `docs/discovery/AUDIO_ASSET_REPORT.md`
- `docs/discovery/DUPLICATE_CANDIDATES.md`
- `docs/game_design/AUDIO_VOICE_MAP.md`

# PHASE 5 — TECHNICAL ARCHITECTURE

Only after discovery, propose the target architecture.

Cover:
- Godot project structure
- scene ownership
- script organization
- autoload/singleton strategy
- data model
- save/load model
- state management
- signals/events
- character system
- interaction system
- combat
- inventory/items
- quests/dialogue
- UI
- audio
- animation
- world/level loading
- localization if applicable
- networking/server boundaries if applicable
- database boundaries if applicable
- tooling/admin boundaries
- logging/debugging
- configuration
- test strategy
- build/export

Produce:
- `docs/architecture/ARCHITECTURE_OVERVIEW.md`
- `docs/architecture/SCENE_ARCHITECTURE.md`
- `docs/architecture/DATA_ARCHITECTURE.md`
- `docs/architecture/DEPENDENCY_MAP.md`
- `docs/architecture/PROJECT_STRUCTURE.md`

Do not migrate or rewrite yet.

# PHASE 6 — GAP ANALYSIS

Classify gaps as:
- BLOCKER
- HIGH
- MEDIUM
- LOW

For each gap document:
- what is missing
- why it is required
- affected systems
- dependencies
- implementation approach
- verification method

Create:
- `docs/planning/GAP_ANALYSIS.md`
- `docs/planning/OPEN_QUESTIONS.md`

# PHASE 7 — EXECUTION ROADMAP

Create a sequential roadmap with explicit dependencies.

Each task must include:
- TASK ID
- objective
- inputs
- files/systems affected
- prerequisites
- implementation summary
- acceptance criteria
- tests
- rollback/recovery notes

Create:
- `docs/planning/IMPLEMENTATION_ROADMAP.md`
- `docs/testing/TEST_PLAN.md`
- `docs/testing/TEST_MATRIX.md`

# PHASE 8 — HUMAN CHECKPOINT

STOP HERE.

Do not start large-scale migration or destructive cleanup until the audit, target architecture, gap analysis and roadmap have been presented.

Your report must answer:
1. What exists?
2. What is actually usable?
3. What is duplicated or obsolete?
4. What is missing?
5. What must be rewritten?
6. What can be migrated directly?
7. What is the proposed Godot architecture?
8. What is the proposed final directory structure?
9. What decisions require human input?
10. What is the exact implementation order?
11. How will each step be tested?
12. What could break during migration?

Do not proceed beyond this checkpoint without explicit approval.

# PHASE 9 — MIGRATION EXECUTION

After approval, migrate in small batches.

For each batch:
1. declare scope
2. list source files
3. list destination files
4. explain transformations
5. migrate
6. update references/paths
7. validate Godot imports/resources
8. run targeted tests
9. update documentation and migration ledger
10. commit a coherent checkpoint

Do not mix unrelated refactors into a migration batch.

# PHASE 10 — GODOT FOUNDATION

Implement the approved foundation first:
- project configuration
- core lifecycle
- global state/autoloads where justified
- data definitions
- resource conventions
- scene conventions
- logging/debugging
- save/load foundation
- test harness

No content polish before the foundation is stable.

# PHASE 11 — SYSTEM IMPLEMENTATION

Implement systems in dependency order.

Typical order, adjusted to the approved roadmap:
1. core/runtime
2. data/resources
3. character foundation
4. movement/interaction
5. world/loading
6. combat
7. inventory/items
8. quests
9. dialogue
10. progression
11. save/load
12. UI
13. audio
14. animation
15. multiplayer/server integration if applicable
16. content integration

For each system:
- implement
- document
- unit test
- integration test
- run the affected gameplay flow

# PHASE 12 — CONTENT INTEGRATION

Bring story, characters, assets, audio and other prepared content into the new architecture.

For every migrated asset:
- preserve provenance
- verify import
- verify reference
- verify runtime usage where applicable

For every important character:
- visual asset
- audio/voice association where applicable
- data definition
- scene/prefab
- dialogue/quest references
- gameplay references
- save-state implications

# PHASE 13 — FULL QA / REGRESSION

Run:
- repository validation
- Godot import validation
- script/static checks
- unit tests
- integration tests
- gameplay smoke tests
- save/load tests
- scene transition tests
- asset reference tests
- audio playback tests
- UI flow tests
- server/client tests if applicable
- build/export tests
- regression tests
- performance checks

Do not claim completion while known blockers remain undocumented.

# PHASE 14 — CLEANUP

Only after successful validation:
- identify safe-to-remove legacy duplicates
- keep a record of removals
- remove only explicitly justified files
- keep original provenance in the migration documentation
- update README and developer setup instructions

# REQUIRED CONTINUOUS KNOWLEDGE LOG

Maintain:
- `docs/knowledge/KNOWN_FACTS.md`
- `docs/knowledge/DECISIONS.md`
- `docs/knowledge/ASSUMPTIONS.md`
- `docs/knowledge/UNKNOWN_ITEMS.md`
- `docs/knowledge/CHANGE_LOG.md`

Every significant discovery or design decision must be recorded.

## STATUS LABELS

Use these exact statuses where practical:
- NOT_STARTED
- DISCOVERED
- VERIFIED
- MIGRATION_READY
- MIGRATED
- IMPLEMENTED
- TESTED
- BLOCKED
- DECISION_REQUIRED
- ARCHIVED
- REMOVED

## FINAL DELIVERY REQUIREMENT

At the end, the repository must not depend on your memory for critical knowledge.
Another competent engineer should be able to understand the architecture, story structure, asset organization, migration decisions, build process and test procedure by reading the repository documentation.

When uncertain, stop and document the uncertainty. Do not guess.
