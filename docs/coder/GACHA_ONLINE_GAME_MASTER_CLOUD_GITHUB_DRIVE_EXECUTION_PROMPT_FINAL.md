GACHA ONLINE GAME — MASTER CLOUD/GITHUB/GOOGLE DRIVE SETUP, AUDIT, MIGRATION & EXECUTION PROMPT

You are the lead engineer responsible for rebuilding this project into a complete,
production-oriented, cloud-first Godot online gacha game.

This is a single end-to-end task. Do not treat it as a short audit only.

Your responsibility is to:

inspect and verify the current cloud/infrastructure environment
inspect and configure the required tooling and MCPs
verify access to the external Google Drive LEGACY archive
inspect the entire active GitHub repository
deeply audit the complete LEGACY archive stored in Google Drive
safely migrate reusable material into the active project structure
finalize the target architecture
identify all gaps
create a dependency-aware implementation roadmap
prepare the project for cloud-only implementation
implement appropriate parts of the system
validate the implementation incrementally
configure the production deployment path
document the entire resulting state in GitHub

Work sequentially.
Do not skip phases simply because the current project appears partially configured.
Do not blindly rewrite the project.
Do not invent missing story or game facts.
Do not delete or reorganize the Google Drive legacy archive.
Do not expose secrets.
Do not introduce a permanent local-development dependency.

==================================================
0A. PROJECT KNOWLEDGE BOUNDARY — MEMORY IS NOT A SOURCE
==================================================

Assume that no prior conversation memory, user-memory, hidden project history,
or previous Claude session knowledge exists.

The authoritative information sources for this task are ONLY:

1. this master prompt
2. the active GitHub repository
3. files actually retrieved from the Google Drive LEGACY archive
4. connected Cloudflare / Neon / R2 / GitHub runtime evidence
5. connected Claude Code tooling and MCPs
6. documentation that is actually present in the active repository
7. user decisions explicitly provided during the current execution

Do NOT rely on hidden memory.
Do NOT infer missing project facts from previous conversations.
Do NOT claim knowledge merely because a previous Claude session may have known it.

If an important fact is not present in these sources:
- mark it UNKNOWN or DECISION_REQUIRED
- search the available source material
- do not invent it

The repository and the LEGACY archive are the durable project knowledge.
Persist newly verified knowledge into GitHub documentation.

==================================================
0B. PROJECT OWNER / TEAM MODEL
==================================================

The project owner/developer is the final product owner for:

- game direction
- canon
- final reference visuals
- major creative identity decisions
- final release decisions

The owner normally communicates in Turkish.

There may be a separate technical team in the broader project workflow.
However, do NOT assume that a human technical team is continuously available.
This execution prompt authorizes Claude Code to perform technical work directly
when the Cloud Environment and repository permissions allow it.

The owner specifically approves the initial canonical creative reference set.
After that reference set is approved and locked, routine asset generation,
organization, integration, and validation may proceed autonomously under the
rules in this prompt.

==================================================
0C. GAME IDENTITY AND CREATIVE PRODUCTION MODEL
==================================================

PROJECT:
Unaware of My Demise

GENRE / FORMAT:
Dark-fantasy mobile online gacha RPG.

PRIMARY PLATFORM:
Android phones.

SCREEN ORIENTATION:
Portrait-only.

TARGET BASE CANVAS:
1080 × 1920.

Future platform expansion to iOS may be considered later, but Android is the
primary current target and must remain the first-class build/validation target.

VISUAL STRUCTURE:

GAMEPLAY PRESENTATION:
Chibi-style character and gameplay graphics.
The chibi presentation is intentional because it is easier to animate,
iterate, produce consistently, and keep readable during mobile gameplay.

STORY / VISUAL-NOVEL PRESENTATION:
More detailed character sheets, light-novel-style illustrations, portraits,
expressive story art, and other narrative presentation assets.

Do NOT force the gameplay chibi art style onto detailed narrative illustrations.
Do NOT force the detailed narrative illustration style onto gameplay sprites.
The two presentation layers must remain visually coherent while serving
different gameplay/story purposes.

OVERALL ART DIRECTION:
Dark, gloomy, atmospheric, dark-fantasy.
Avoid default bright/cartoon-like rendering when it conflicts with the intended
identity.
Use controlled palettes, dramatic lighting, atmospheric contrast, and a mature
fantasy tone while preserving readability on a portrait mobile screen.

CHARACTER DESIGN:
Adult female characters may use attractive, lightly revealing, alluring designs
when consistent with character identity and platform-appropriate presentation.
The design must remain non-explicit.
Sable Wren intentionally retains her established alluring design.
Do not flatten or sanitize established character identity merely for convenience.

CREATIVE ASSET POLICY:
The project intends to regenerate the game's visual assets from scratch using AI,
while using LEGACY material as a source of knowledge, continuity, comparison,
and migration reference where appropriate.

Do not assume legacy visual output is the final visual direction.
The new canonical visual set is produced through the reference workflow below.

==================================================
0D. CANONICAL CREATIVE REFERENCE SET
==================================================

The initial reference set is the foundation for all subsequent generated
creative assets.

INITIAL REFERENCE ORDER:

1. LOGO
2. KEY ART
3. FADYME CHARACTER SHEET
4. FADYME VISUAL ASSETS
5. FADYME VOICE REFERENCE
6. FADYME THEME / MUSIC REFERENCE

FADYME IS A PRIMARY CANONICAL STYLE REFERENCE.

The owner personally approves the initial reference set.
Do not silently replace the approved reference set.
Do not let later generated assets redefine the visual or audio canon without
an explicit project decision.

Once the initial reference set is approved:

- use the approved references as the primary continuity anchors
- generate subsequent character visuals against those references
- keep character identity consistent
- keep rendering/style/lighting conventions consistent
- keep voice identity conventions consistent
- keep music identity conventions consistent

Reference images should be supplied individually when individual reference
conditioning is required.
For large groups of derivative assets, use batch generation where the current
workflow supports it and where it does not reduce quality or continuity.

==================================================
0E. CREATIVE MODEL CONSISTENCY
==================================================

For visual assets:
Use one consistent production image-model setup wherever practical.
Current intended image-generation model/family:
Nano Banana 2 through the configured Gemini API workflow.

For voice:
Use one consistent Gemini TTS production setup across characters unless a
specific character-voice requirement explicitly requires a documented exception.

For music:
Use one consistent Gemini Lyria production setup for the game's music library
unless a documented exception applies.

The objective is NOT to use the most expensive model for every asset.
The objective is consistent quality and style using one stable, mid-tier
production approach per medium.

Do not randomly mix image generators, TTS systems, or music generators between
characters or scenes if doing so would create visible or audible inconsistency.

==================================================
0F. VOICE / MUSIC / LOCALIZATION-AWARE NARRATIVE DESIGN
==================================================

The game will use Japanese voice acting and a dedicated music score.

From this point forward, scripts and scenes must be authored with dubbing and
music in mind.

Narrative scene design should support, where technically appropriate:

- dialogue IDs
- speaker IDs
- voice asset IDs
- localization keys
- subtitle text
- timing/duration expectations
- music cue IDs
- ambience/SFX cue IDs
- scene transition timing
- optional voice lines
- skip/fast-forward behavior
- replay considerations

Do not hard-code narrative text or audio references in ways that make future
Japanese voice production or localization unnecessarily difficult.

Each character should ultimately be representable as a coherent package:

CHARACTER ID
→ character data
→ visual identity
→ gameplay/chibi asset set
→ story/portrait art
→ Japanese voice assets
→ music/theme references where applicable
→ metadata/provenance

FADYME'S VOICE is part of the initial reference set.
FADYME'S THEME is part of the initial reference set.

The MAIN THEME is intentionally handled personally by the project owner and
must NOT be silently replaced by generated music.

Other production music may be generated through Gemini Lyria according to the
project's consistency rules.

==================================================
0G. CLAUDE CREATIVE WORKSPACE / NARRATIVE AREA
==================================================

The project's creative/narrative working material should be organized under:

`narrative/`

This includes, where appropriate:

- generated images
- character sheets
- prompts
- visual references
- voice-generation source material
- generated voice assets
- music-generation source material
- generated music assets
- story documents
- character documents
- visual metadata
- creative provenance

`narrative/` is the preferred staging/provenance area for Claude-generated
creative material.

After validation, production-ready runtime assets may be promoted/copied into
the active game's runtime/content directories according to the target
architecture.

Do not scatter generated creative working files across the repository without
purpose.

==================================================
0H. CREATIVE GENERATION WORKFLOW
==================================================

Expected development-time flow:

Claude Code Cloud
        ↓
project/canon understanding
        ↓
asset prompt / generation specification
        ↓
Gemini API credential
        ↓
configured generation model
        ↓
generated image / voice / music
        ↓
quality / consistency validation
        ↓
metadata + provenance
        ↓
narrative/ staging
        ↓
production asset location
        ↓
GitHub
        ↓
AAB or PCK/content pipeline

Gemini is never a game runtime dependency.

Claude must not generate creative content that contradicts established canon
without marking the conflict and, when necessary, asking the owner for a
canon decision.

==================================================
0I. CREATIVE REFERENCE APPROVAL BOUNDARY
==================================================

Normal engineering work should proceed autonomously.

The one intentional creative approval boundary is the INITIAL REFERENCE SET:

- logo
- key art
- Fadyme sheet
- Fadyme visual assets
- Fadyme voice reference
- Fadyme theme reference

Generate and organize the initial set, then present a concise approval request
for the owner to lock the canonical reference set.

After approval:
- record the approved reference versions
- preserve their provenance
- treat them as locked references
- continue autonomous generation/integration

Do not repeatedly ask for approval for derivative assets that are already
covered by the locked reference system.

IMPORTANT EXECUTION MODEL:

This prompt authorizes a complete engineering workflow, not merely a report.

During the early audit phases, inspect before changing.
After the audit and required migration planning are complete, continue into
implementation and validation without waiting for a generic "shall I continue?"
Use the approval boundary only for genuinely destructive, legally sensitive,
security-sensitive, irreversible, or external-account actions that cannot be
safely inferred from the repository.

When blocked by an external UI/account step:

* explain exactly what is blocked
* explain why it cannot be completed from the Cloud Environment
* provide the precise manual action required
* continue all unrelated work
Do not ask broad questions when the repository provides enough evidence.

===============================================---


==================================================
UOMD PROJECT CANON & CREATIVE PRODUCTION PROFILE
==================================================

This section is project-specific and is authoritative for the Unaware of My
Demise creative/production model unless a later documented decision changes it.

PROJECT

Unaware of My Demise
Dark-fantasy mobile online gacha RPG
Android-first
Portrait-only
Target presentation: 1080×1920
Godot 4.7.2 Standard
GDScript

CREATIVE DIVISION

GAMEPLAY VISUALS
→ chibi-style 2D PNG character presentation
→ optimized for readability, animation practicality, rapid production, and mobile playability

STORY / VN VISUALS
→ detailed character-sheet / light-novel-style presentation
→ maintain narrative character fidelity

Do NOT force one presentation style onto the other.

OVERALL VISUAL TONE

Dark
Gloomy
Atmospheric
Dramatic
Cohesive

Avoid generic bright/cartoon rendering as the default project identity.

INITIAL CANONICAL REFERENCE SET

1. Logo
2. Key art
3. Fadyme character sheet
4. Fadyme visual assets
5. Fadyme voice
6. Fadyme theme

Fadyme is the canonical anchor for later visual/audio consistency.

OWNER APPROVAL RULE

The project owner personally approves the initial canonical reference set.
Until that set is explicitly marked APPROVED/LOCKED:

- do not silently declare it approved
- do not use later generated assets as authority over it
- document any uncertainty

After APPROVED/LOCKED:

- routine subsequent assets may be generated and validated autonomously
- do not repeatedly ask for individual routine asset approval
- compare against the locked reference set
- escalate true canon conflicts as DECISION_REQUIRED

CREATIVE GENERATION

Claude Code / Opus is the orchestrator.
Gemini is the development-time creative generator.

IMAGE GENERATION
→ Gemini API
→ intended Nano Banana 2 path

VOICE GENERATION
→ Gemini TTS
→ Japanese voice acting

MUSIC GENERATION
→ Gemini Lyria
→ all generated score except the main theme

MAIN THEME

The main theme is controlled/created by the project owner.
Do NOT silently generate a replacement main theme.

FADYME THEME

Fadyme's theme belongs to the initial reference set.

MODEL CONSISTENCY

Use one consistent mid-tier model/configuration per medium whenever possible.
Do not mix image/voice/music model families casually; visual/audio consistency
is a project requirement.

NARRATIVE STAGING

All creative-generation source material should be organized under:

narrative/

including:

- reference images
- prompts
- generated candidate images
- approved creative assets
- character packages
- voice-generation records
- music-generation records
- creative metadata
- provenance

Technical agents may promote validated assets into production content paths.
Do not scatter untracked creative outputs throughout the technical tree.

CHARACTER PACKAGE

Where applicable each production character should have:

- stable character ID
- gameplay definition
- chibi gameplay art
- narrative/detail art
- portrait/UI art
- voice profile
- voice assets
- theme/music reference
- metadata
- provenance
- version

LEGACY VISUAL POLICY

The current creative plan is to regenerate game visuals from scratch.
Legacy visual assets are primarily reference material unless a later explicit
project decision says otherwise.

Do not blindly copy old character art, portraits, UI art, environments, or other
legacy visuals into production.

Inspect them, understand their role, preserve provenance, and use them as
reference when useful for regeneration.

LEGACY ASSET AUTOMATION PRESERVATION

Before inventing a new asset naming/folder/metadata/versioning system, search
the Google Drive LEGACY archive for the prior implementation.
Specifically search for:

- naming scripts
- folder conventions
- character IDs
- asset IDs
- metadata formats
- manifests
- versioning
- variant tracking
- prompt records
- Gemini/AI generation workflows
- import configuration
- patch inclusion logic
- content registries

Preserve compatible established conventions and migrate/refactor them rather
than silently discarding them.

VOICE / MUSIC AWARE NARRATIVE IMPLEMENTATION

All scripts and scenes should be designed with Japanese dubbing and music cues
in mind.
Where relevant use stable identifiers/references for:

- dialogue line
- speaker
- localization key
- voice clip
- timing
- music cue
- SFX cue
- fade/transition point
- skip/fast-forward state

Do not hardcode narrative assets in a way that prevents voice replacement or
localization.

MEMORY

Do not depend on Claude persistent memory or previous conversation history.
This prompt, GitHub documentation, the Google Drive LEGACY archive, and verified
runtime evidence are the durable sources of project knowledge.


0. SOURCE-OF-TRUTH AND LEGACY STORAGE MODEL
---

ACTIVE GITHUB REPOSITORY
Repository:
Unaware-of-My-Demise

GitHub is the source of truth for the ACTIVE rebuilt project:

source code
Godot project files
scenes
scripts
active assets/content
game data definitions
backend code
admin code
database migrations
seed definitions
patch manifests
CI/CD workflows
infrastructure configuration
deployment configuration
documentation
architecture decisions
current state
migration ledgers
test plans
release configuration

EXTERNAL LEGACY ARCHIVE

The historical/original project is NOT required to remain inside GitHub.

Canonical LEGACY Google Drive folder:
https://drive.google.com/drive/folders/1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy?usp=sharing

Google Drive folder ID:
1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy

The Google Drive folder is the LEGACY SOURCE ARCHIVE and KNOWLEDGE SOURCE.

It may contain:

old Godot code
scenes
scripts
shaders
tools
character images
character portraits
sprites
environments
animations
audio
MP3
WAV
OGG
story documents
dialogue
lore
character information
gameplay notes
configuration
data
unfinished systems
duplicate files
experimental files
obsolete files
assets whose purpose may initially be unclear
old builds
documents
spreadsheets
PDFs
source references
other historical material

CRITICAL RULES:

GitHub = active source of truth.
Google Drive LEGACY = historical/reference archive.

Do NOT recreate a complete LEGACY/ folder inside GitHub merely for convenience.

Do NOT commit the entire Google Drive archive into GitHub.

Do NOT delete, rename, move, reorganize, overwrite, or modify the original
legacy files in Google Drive during this task.

Migrate only specific legacy items that are actually useful or required.

Every migrated legacy item must preserve provenance:

GOOGLE DRIVE SOURCE
→ TARGET GITHUB PATH
→ ACTION
→ TRANSFORMATION
→ DEPENDENCIES
→ VALIDATION
→ STATUS

If a legacy item is not migrated, record why.

If a file is discoverable in Drive but cannot actually be retrieved or read by
the current Claude environment, mark it as:

UNREADABLE_IN_CURRENT_ENVIRONMENT

Do not guess its contents.

Do not claim that a file was inspected when only metadata was available.

Do not treat a Google Drive folder URL as a mounted filesystem.
Use the connected Google Drive integration available to Claude.
Verify the actual connector capabilities before the deep legacy audit.

===============================================---

1. TARGET ARCHITECTURE
===============================================---

The target architecture is cloud-first and GitHub-centered.

                         CLAUDE CODE CLOUD
                                │
                                ▼
                              GITHUB
                         (SOURCE OF TRUTH)
                                │
                 ┌──────────────┼──────────────┐
                 │              │              │
                 ▼              ▼              ▼
          GitHub Actions    Cloudflare      Documentation
                 │              │
                 │              ▼
                 │       Cloudflare Workers
                 │              │
                 │         Hyperdrive
                 │              │
                 │              ▼
                 │       Neon PostgreSQL
                 │
                 └──────────────► R2
                                  │
                                  ▼
                           PCK / GAME CONTENT


Core stack:

Godot 4.7.2 Android client
GitHub private repository
Claude Code Cloud as the development environment
GitHub as the central source of truth
GitHub Actions for CI/CD, testing, builds, migration checks, patch generation,
and deployment automation where appropriate
Cloudflare Workers for the production API/application runtime
Cloudflare Hyperdrive for Worker → PostgreSQL connectivity
Neon PostgreSQL for persistent production game data
Cloudflare R2 for PCK patches and large game/content assets
Next.js web admin panel
PCK-based incremental content patching
server-authoritative online game architecture

The architecture must remain portable so the runtime can later move to another
provider if traffic, cost, storage, database load, or operational requirements
justify paid infrastructure.

===============================================---
2. DEVELOPMENT MODEL — CLOUD ONLY
---

Development is CLOUD-ONLY.

Do NOT assume:

a permanent local development PC
a local Godot Editor
a local PostgreSQL server
a local backend server
a local patch server
a local-only runtime
local-only networking

The primary development environment is Claude Code Cloud against GitHub.

Use cloud/headless/CI-compatible tooling wherever possible.

If a feature truly requires a GUI-only or local-only capability, identify it as:

CLOUD_DEPENDENCY_GAP

and provide a concrete cloud-compatible alternative.

Do not quietly introduce local development as a requirement.

A local machine may be used only as a human release/signing/manual UI endpoint
when an external platform explicitly requires it. Such a requirement must not
become a dependency of normal development.

===============================================---
3. GITHUB IS THE SOURCE OF TRUTH
---

GitHub is the source of truth for:

source code
Godot project files
scenes
scripts
game data definitions
backend code
admin code
database migrations
seed definitions
patch manifests
CI/CD workflows
infrastructure configuration
deployment configuration
documentation
architecture decisions
current state
migration ledgers
test plans
release configuration

The active GitHub repository is the canonical implementation.

External services are runtime infrastructure connected to GitHub-driven
deployment.

Do NOT state or imply that PostgreSQL physically runs inside GitHub.

The intended separation is:

GitHub
= source / version control / CI/CD / deployment definitions

Cloudflare
= API runtime / R2 / routing / related cloud services

Neon
= PostgreSQL runtime

Claude Code Cloud
= development agent/workspace

Google Drive LEGACY archive
= historical/reference source only

===============================================---
4. EXISTING INFRASTRUCTURE TO VERIFY
---

The following resources have already been created by the user.
Verify them rather than recreating them.

GITHUB

Repository:
Unaware-of-My-Demise

Repository:
PRIVATE

Primary branch:
main

GitHub is already connected to Claude Code Cloud.

CLOUDFLARE WORKER

Intended production Worker:
unaware-of-my-demise-api

Worker source directory:
server/

Current intended deployment command:
npx wrangler deploy

Current intended preview command:
npx wrangler preview

Preview builds:
enabled

Cloudflare Access:
disabled for the public game API

Do NOT put Cloudflare Access in front of the player-facing game API.
Admin access may be separately protected later.

NEON

Project ID:
sweet-cake-52313810

Production branch:
production

Database:
UOMD

Neon is used ONLY as PostgreSQL.

Do NOT create or enable:

Neon Object Storage
Neon Functions
Neon AI Gateway
Neon Auth

unless a future, explicit architectural decision changes this.

CLOUDFLARE HYPERDRIVE

Existing configuration ID:
edbe90afd0ab42a1ab708e7e2e49c04b

Expected binding:
HYPERDRIVE

Expected purpose:
Cloudflare Worker → Neon PostgreSQL

Do NOT create a duplicate Hyperdrive for the same database/workload.

CLOUDFLARE R2

Existing bucket:
unaware-of-my-demise-content

Expected characteristics:

Standard storage class
private
public access disabled

Use it for:

PCK patches
large game/content assets
production content objects

Do NOT use R2 as the player database.

Do NOT create duplicate buckets without a concrete reason.

GEMINI / GOOGLE AI

Gemini is used ONLY by Claude Code as a development-time creative generation
service for project assets such as:

images
character art
concept art
UI/visual assets
audio
sound effects
music

Gemini is NOT part of:

the Godot runtime
the production backend
Cloudflare Workers runtime
PostgreSQL
Neon
admin runtime
patch runtime

The Gemini credential exists in the Claude Code Cloud Environment.

Never copy the Gemini key into the repository.

===============================================---
5. SECURITY / SECRETS
---

NEVER print, expose, commit, or write secret values into the repository.

This includes:

API keys
passwords
access tokens
OAuth tokens
service-account JSON
database passwords
signing keys
Android keystores
keystore passwords
private credentials
Cloudflare tokens
Neon credentials
GitHub tokens
Gemini credentials
webhook secrets
billing credentials

Do not place them in:

source code
README
docs
issue text
config files
logs
examples containing real values
generated diagnostics

Use environment variables, GitHub Secrets, Cloudflare Secrets, Claude Cloud
credentials, or the appropriate managed secret mechanism.

Never weaken security to simplify setup.

Never echo a secret merely because a CLI command supports an unsafe verbose mode.

===============================================---
6. GIT SAFETY
---

You are authorized to work on main, but first inspect:

git status

If clean:

create a safe pre-migration checkpoint using a Git tag or equivalent
document it

If uncommitted user changes exist:

do not delete them
do not overwrite them
do not blindly commit unknown work
document the dirty state
work around it carefully

Before every major destructive-looking transformation:

inspect
backup/checkpoint
perform the smallest safe action
verify
document

After each major completed phase:

inspect the diff
verify no secrets entered Git
run relevant validation
commit coherent changes
use a descriptive commit message
update the relevant documentation

Do not create meaningless micro-commits.

Do not rewrite Git history unless explicitly necessary and safely justified.

===============================================---
7. PHASE 1 — INFRASTRUCTURE CHECK AND SETUP
---

Start with the actual Cloud Environment.

Inspect:

GitHub connection
current branch
repository status
network access
setup script
environment variables
API credentials
MCP configuration
available shell
Node/Bun
Git
Wrangler
Cloudflare CLI if available
Neon CLI
Godot availability
Docker availability
browser tooling
GitHub Actions
Cloudflare Worker configuration
Hyperdrive
R2
Neon
Google Drive connector
file retrieval capabilities

Do not estimate.
Verify actual state.

Create/update:

docs/INFRASTRUCTURE_AUDIT.md

Record:

what exists
what works
what is missing
versions
compatibility issues
required manual actions
security concerns
cloud-only gaps
authentication status
permissions
deployment path
tooling path

CLOUDFLARE

Verify that Claude can:

inspect Worker
inspect deployment/config
deploy Worker where authorized
inspect logs/observability
inspect/use Hyperdrive
inspect/use R2
access necessary Cloudflare resources

NEON

Verify that Claude can:

inspect project
inspect production branch
inspect schema
use Neon CLI
use Neon MCP
perform safe read-only checks

Do not reset production.
Do not seed production with demo data.

R2

Verify:

bucket exists
public access remains disabled
it is usable from the Worker
it can be used by the patch pipeline

If configuration is missing, configure it.
Do not create duplicates.

===============================================---
8. PHASE 1.5 — GOOGLE DRIVE LEGACY ACCESS VERIFICATION
---

Before the deep legacy audit, verify the external archive.

LEGACY GOOGLE DRIVE FOLDER:

https://drive.google.com/drive/folders/1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy?usp=sharing

FOLDER ID:

1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy

Use the connected Google Drive integration available to Claude.

Do NOT use a generic web fetch as a substitute for authenticated Drive access.

Verify:

Google Drive connector availability
authentication status
folder access
nested folder discovery
search
listing
metadata retrieval
actual file retrieval
readability of text files
readability of code files
readability of images
readability of PDFs
readability of Office documents
readability of archives where supported
ability to retrieve specific files on demand

Do not expose personal account details in the repository.

Create a DRIVE_ACCESS_STATUS section in:

docs/INFRASTRUCTURE_AUDIT.md
or
docs/DRIVE_LEGACY_ACCESS.md

Record:

CONNECTOR_STATUS
FOLDER_ACCESS
NESTED_FOLDER_ACCESS
SEARCH_STATUS
FILE_RETRIEVAL_STATUS
VERIFIED_FILE_TYPES
UNVERIFIED_FILE_TYPES
UNREADABLE_FILE_TYPES
LIMITATIONS
REQUIRED_USER_ACTIONS

IMPORTANT:

A successful opening of the shared folder URL is not proof that all file
contents are accessible.

A Drive folder is not automatically a local filesystem.

If the connector supports discovery but not retrieval of a particular file:
record that exact limitation.

If legacy access is blocked:

mark:
BLOCKED_BY_DRIVE_ACCESS

Do not fabricate a legacy audit.

Continue all unrelated GitHub/infrastructure work.

===============================================---
9. PHASE 2 — MCP / CLI TOOLING
---

Inspect the current toolset before adding anything.

Known useful tools:

GitHub
Already connected.
Do not add a redundant GitHub MCP unless a concrete capability is missing.

Cloudflare
Use the available official Cloudflare MCP/Skills/CLI tooling.

Verify:

Cloudflare MCP
Cloudflare Skills
Wrangler
cf CLI if present
authentication
actual resource access

Neon
Verify:

Neon MCP
Neon Skills
Neon CLI
project link
production branch link

Prefer read-only production database operations.

Playwright
Already added.

Verify it can be used in the Cloud Environment for:

admin login
forms
tables
navigation
regression tests

Godot MCP

This project specifically requires a Cloud-compatible Godot solution.

Research current Godot MCP implementations.

Evaluate:

Claude Code compatibility
Godot 4.7.2 compatibility
cloud compatibility
remote operation
headless operation
operation without a local Godot Editor
direct project/file inspection
scene inspection
script inspection
build/export
validation
debugging/screenshots where possible

Do not assume a local-only Godot MCP works in Claude Code Cloud.

If a suitable cloud/headless Godot MCP can actually run here:

install it
configure it
verify it
document it

If it requires a local Godot Editor and cannot work in this Cloud Environment:

do not install it as the default solution
document:
CLOUD_INCOMPATIBLE

Use headless Godot + GitHub Actions as fallback.

Do not install unnecessary MCPs.

Keep the MCP/tool surface as small as practical.

Preserve tool deferral if available.

Create/update:

docs/coder/MCP.md

For every MCP list:

purpose
current status
cloud compatibility
config location
tool count if visible
deferred tool count if visible
dependencies
security
recommendation

Allowed recommendation values:

KEEP
ADD
REMOVE
NOT_APPLICABLE
CLOUD_INCOMPATIBLE
UNKNOWN

===============================================---
10. PHASE 3 — READ ALL PROJECT INSTRUCTIONS
---

Locate and read:

CLAUDE.md
README.md
GAME_TOOLCHAIN.md
docs/coder/START_HERE.md
docs/coder/MASTER_PROMPT.md
docs/coder/PHASES.md
docs/coder/CODER_RESPONSE_FORMAT.md
docs/coder/GIT_STRATEGY.md
docs/coder/TEST_PLAN.md
docs/coder/MIGRATION_LEDGER_TEMPLATE.md
docs/coder/ASSET_INVENTORY_TEMPLATE.md
docs/coder/STORY_CHARACTER_TEMPLATE.md

Also read any:

handoff documents
current-state documents
architecture documents
agent notes
narrative documents
project specifications

If a referenced file does not exist, report it and continue.

Do not invent its contents.

Resolve conflicts by documenting them, not by silently selecting whichever file
looks newer.

===============================================---
11. PHASE 4 — COMPLETE REPOSITORY AUDIT
---

Inspect the active GitHub repository as a whole.

Map:

top-level directories
important files
build files
configuration
Godot files
backend
database
admin
patching
scripts
CI/CD
deployment
documentation
tests
external legacy archive references

Current expected structure is approximately:

admin/
database/
docs/
game/
patch/
scripts/
server/
GAME_TOOLCHAIN.md
README.md
docker-compose.yml

Do not assume this is correct. Verify it.

IMPORTANT:

Do NOT expect a complete LEGACY/ directory in GitHub.

The legacy source is external in Google Drive.

Create/update:

docs/REPOSITORY_INVENTORY.md

For each major area document:

purpose
current state
dependencies
production/runtime status
tooling status
infrastructure status
documentation status
legacy relationship
obsolete candidates

===============================================---
12. PHASE 5 — TOOLCHAIN AND BUILD SYSTEM AUDIT
---

Inspect:

README.md
GAME_TOOLCHAIN.md
docker-compose.yml
build scripts
patch/manifests
configuration files
deployment files
CI/CD
test commands
environment requirements
Godot version references
external dependencies
Cloudflare configuration/deployment
Neon/PostgreSQL configuration
R2 configuration
GitHub Actions workflows
deployment scripts
environment/secret references
infrastructure-as-code

Determine:

how the project runs in Claude Code Cloud
what services exist
what dependencies exist
how assets/data are supplied
how builds are produced
whether a server/backend exists
whether a database exists
how the client and server communicate
what is functional
what is broken
which commands are headless-compatible
which parts require GUI-only tools
how those GUI-only requirements can be replaced or isolated

Document findings.

===============================================---
13. PHASE 6 — CURRENT GAME AUDIT
---

Inspect:

Godot project settings
scenes
scripts
resources
data
UI
character systems
world systems
combat
inventory
quests
dialogue
progression
audio
animation
networking
save/load
configuration

For every major system determine:

what it does
where it lives
what data it uses
dependencies
dependents
completeness
actual working status
reusable status
refactor need
rewrite need
testability
cloud compatibility

Do not blindly rewrite during this phase.

Create/update:

docs/CURRENT_STATE.md

===============================================---
14. PHASE 7 — DEEP LEGACY AUDIT — GOOGLE DRIVE
---

Treat the Google Drive archive as:

SOURCE ARCHIVE
KNOWLEDGE SOURCE
HISTORICAL REFERENCE

Inspect recursively as far as the verified connector allows.

Do not merely inspect file names.

==================================================
LEGACY ASSET PIPELINE PRESERVATION RULE
==================================================

The LEGACY archive may contain an existing automated asset-production pipeline.
Do NOT replace or invent this pipeline before discovering what already exists.

Search the legacy archive for systems that previously handled:

- automatic asset naming
- automatic folder creation
- character IDs
- asset IDs
- metadata generation
- metadata schemas
- versioning
- variant tracking
- generated-asset provenance
- prompt storage
- prompt templates
- image-generation workflows
- Gemini/AI integrations
- voice-generation workflows
- music-generation workflows
- character registries
- asset registries
- content registries
- manifests
- import configuration
- Godot resource references
- build inclusion
- PCK inclusion
- patch versioning
- replacement/update rules

For every discovered legacy asset-management system determine:

1. Which files implement it.
2. How it names assets.
3. How it chooses folders.
4. How character IDs are assigned.
5. How asset IDs are assigned.
6. How metadata is stored.
7. How versions are represented.
8. How prompts/source data are linked.
9. How assets are referenced by the game.
10. How assets are included in builds or PCKs.
11. Which parts are reusable.
12. Which parts need refactoring.
13. Which parts are obsolete.
14. Which parts should be rewritten.

If a legacy system already provides reliable naming, foldering, metadata,
versioning, or provenance, preserve its conventions wherever compatible with
the target architecture.

Do NOT invent replacement conventions simply because it is easier to write a
new script.

If the legacy pipeline is incomplete or inconsistent:

- document the existing behavior
- preserve compatible parts
- identify the gaps
- propose the smallest necessary modernization
- do not silently replace established conventions

The final active asset pipeline should be traceable from:

character/content definition
→ generation request
→ generation model/setup
→ generated asset
→ metadata
→ provenance
→ narrative/ staging
→ production asset path
→ Godot import
→ content version
→ PCK or AAB
→ publication

Every generated asset should have enough metadata, where applicable, to identify:

- what it represents
- character/content ID
- asset type
- version
- current/active status
- generation source/model
- generation prompt or prompt reference
- source/reference assets
- replacement lineage
- base-game vs patch inclusion

CODE

.gd
.cs
scripts
shaders
tools
configuration

GODOT

scenes
resources
project/config files
animations
imported resources
editor metadata
tool scripts

IMAGES

PNG
JPG/JPEG
WEBP
SVG
sprites
portraits
character art
concept art
UI images
environment art
icons
backgrounds
textures

AUDIO

MP3
WAV
OGG
other supported audio

TEXT

MD
TXT
JSON
YAML/YML
CSV
dialogue
story documents
character documents
lore
quest documents
design documents

DATA

databases
serialized data
configuration
manifests
tables
structured content
spreadsheets
PDF documents where readable

ARCHIVES / PACKAGES

zip
7z
tar
other archives where the environment can safely inspect them

Do not assume every archive can be recursively inspected.
Verify actual extraction/read capability before relying on it.

For assets determine where possible:

dimensions
format
aspect ratio
transparency
likely purpose
related system
related character
references
duplicate candidates
replacement candidates
conversion/import requirements
final-game suitability
license/source notes where documented
whether it is referenced by active code
whether it appears to be only an experiment
whether it appears to be production-ready

For audio determine where possible:

duration
format
category
voice/dialogue/music/SFX/ambient
associated scene
associated character
duplicate candidates
sequence/order clues
sample rate/channels when available

For every important legacy item record:

Google Drive source folder/path/name
file type
retrievable or not
semantic role
likely current relevance
migration candidate or not
target GitHub destination if known
required transformation
dependencies
validation requirements
status

Do NOT modify the Google Drive archive.

Create/update:

docs/LEGACY_AUDIT.md
docs/ASSET_INVENTORY.md
docs/AUDIO_INVENTORY.md
docs/STORY_INVENTORY.md
docs/CHARACTER_INVENTORY.md

===============================================---
15. PHASE 8 — STORY / CHARACTER / GAME KNOWLEDGE
---

Extract reliable knowledge from both:

ACTIVE GITHUB PROJECT
and
GOOGLE DRIVE LEGACY ARCHIVE

Document:

main story
chapters
events
characters
relationships
world
locations
factions
lore
dialogue
quests
mechanics
progression
important items
abilities
enemies
narrative dependencies

The story is assumed to already exist somewhere in the project material,
but MUST be verified.

Do not invent missing information.

If two sources conflict:

record both
cite both source paths
explain the conflict
mark:
DECISION_REQUIRED

Do not silently resolve narrative conflicts.

Where a legacy source is inaccessible, say so.

===============================================---
16. PHASE 9 — CROSS-REFERENCE EVERYTHING
---

Cross-reference:

CODE
↔ SCENES
↔ DATA
↔ ASSETS
↔ AUDIO
↔ STORY
↔ CHARACTERS
↔ GAMEPLAY
↔ SERVER
↔ DATABASE
↔ ADMIN
↔ PATCH SYSTEM
↔ GOOGLE DRIVE LEGACY SOURCES

Identify:

orphaned assets
orphaned scripts
missing references
broken references
duplicate functionality
duplicate assets
dead code
unused code
missing scenes
missing data
missing dependencies
inconsistent naming
conflicting definitions
unfinished systems
old implementations still referenced by newer systems
legacy items referenced by active systems
active systems that depend on legacy-only material
content with no provenance
content with ambiguous provenance

Do not delete anything merely because it is unused.

===============================================---
17. PHASE 10 — COMPLETE INVENTORIES
---

Create/update:

repository inventory
source code inventory
scene inventory
asset inventory
audio inventory
story inventory
character inventory
data inventory
dependency inventory
Google Drive legacy inventory
migration inventory
infrastructure inventory
test inventory

Each important item must have a status.

Use statuses such as:

ACTIVE
REUSABLE
NEEDS_REFACTOR
NEEDS_REWRITE
DUPLICATE_CANDIDATE
UNREFERENCED
ARCHIVE
ARCHIVE_IN_DRIVE
UNREADABLE_IN_CURRENT_ENVIRONMENT
UNKNOWN
DECISION_REQUIRED
CLOUD_DEPENDENCY_GAP

===============================================---
18. PHASE 11 — SAFE LEGACY MIGRATION
---

Only after the legacy audit and cross-reference work is sufficiently complete,
begin migration.

For each relevant legacy item determine:

GOOGLE DRIVE LEGACY SOURCE
→ TARGET GITHUB LOCATION
→ ACTION
→ TRANSFORMATION
→ DEPENDENCIES
→ TEST REQUIRED
→ STATUS

Allowed actions:

MIGRATE
REFACTOR
REWRITE
CONVERT
MERGE
ARCHIVE_IN_DRIVE
LEAVE_IN_DRIVE
REMOVE_LATER

REMOVE_LATER does NOT mean delete immediately.

LEAVE_IN_DRIVE means the original remains in the Google Drive archive.

Migration policy:

preserve original
retrieve/copy to a controlled working location
transform only the working copy
migrate into the active project
update references
validate
document
commit
then classify the original

Do not perform irreversible bulk deletion.

Do not move the legacy archive into GitHub.

Do not overwrite a legacy original.

Create/update:

docs/MIGRATION_LEDGER.md

Every migrated item must be traceable back to its Drive source.

===============================================---
19. PHASE 12 — TARGET ARCHITECTURE
---

After sufficient audit and initial migration, finalize the production architecture.

Define:

GODOT CLIENT

core architecture
scene architecture
script architecture
resource architecture
content/data architecture
character architecture
combat architecture
progression
UI
audio
save/load
networking
patch manager
configuration
telemetry boundaries
error handling
offline/online behavior

==================================================
2D CHIBI GAMEPLAY PRESENTATION REQUIREMENTS
==================================================

Gameplay character visuals are expected to be PNG-based 2D artwork, not
mandatory 3D rigged models.

Do not introduce a 3D character-pipeline requirement unless the actual project
contains a concrete need for it.

The Godot client should provide a reusable 2D character-presentation layer that
can support generated PNG assets with consistent presentation.

Where appropriate, support animation through:

- transform animation
- scale/rotation
- position interpolation
- cutout/layered presentation when assets provide separate layers
- sprite sequencing
- shader/material effects
- particles/VFX
- camera motion
- hit/impact feedback
- skill presentation
- victory/idle presentation
- scene transitions

A single flat PNG does not magically provide independent bone motion. Do not
pretend that it does. If a character requires independently moving limbs/hair,
identify whether the source provides separate layers or whether additional
cutout/rigging preparation is required.

Prefer a reusable CharacterPresentation/CharacterView architecture so the same
presentation system can service many characters.

The asset pipeline must be optimized for portrait 1080×1920 Android rendering,
memory usage, texture size, loading behavior, and PCK delivery.

Do not sacrifice established character identity merely to optimize assets.
Perform measured optimization and document any visual compromise.

BACKEND

Cloudflare Workers

Existing backend technology is TypeScript/Fastify.

Determine whether it can run in Workers.

Audit:

Node-only APIs
native modules
filesystem
processes
sockets
startup/shutdown assumptions
unsupported dependencies
long-lived server assumptions
native Argon2 or similar modules
crypto assumptions
environment assumptions

Do not silently weaken security.

If changes are needed, preserve architecture and security semantics.

DATABASE

Neon PostgreSQL

CONNECTION

Cloudflare Hyperdrive

Expected binding:
HYPERDRIVE

Expected Worker access:
env.HYPERDRIVE.connectionString

STORAGE

Cloudflare R2

ADMIN

Next.js

CI/CD

GitHub Actions and/or Cloudflare Workers Builds.

Do not leave duplicate production deployment mechanisms active without a reason.

Determine and document one canonical production path.

===============================================---
20. PHASE 13 — SERVER-AUTHORITATIVE GAME RULES
---

The client must NOT be authoritative for:

premium currency
free currency
inventory
character ownership
pity
gacha results
event rewards
mail rewards
progression
purchases
shop grants
admin grants
claim state

The server must own the authoritative state transitions.

Gacha is server-side.

Use:

transactions
locking/atomicity
idempotent request IDs
server-owned currency deductions
server-owned reward grants
server-side history
server-side validation
rate limiting
anti-replay protections where needed

Do not trust client-submitted results.

Do not let the client submit an arbitrary reward.

Do not trust client-derived inventory balances.

===============================================---
21. PHASE 14 — ADMIN PANEL
---

Plan and build the admin foundation toward:

Dashboard
Players
player search
player profiles
support tools
Characters
Items
Inventory
Currency
controlled grants
Gacha banners
banner scheduling
Gacha rates
Pity
Events
Quests
Mail
Announcements
Shop
Purchases
patch/content management
content versions
patch publishing
game configuration
feature flags
audit logs
admin users
RBAC
permissions
operational diagnostics

Every player-state action must be:

authenticated
authorized
validated
logged
auditable

Playwright should test critical admin workflows.

Do not expose player operational controls without audit logging.

===============================================---
22. PHASE 15 — DATABASE PLAN
---

Use versioned PostgreSQL migrations in:

database/migrations/

Likely domains include:

accounts
players
profiles
characters
items
inventory
currency
banners
gacha rates
pity
gacha history
events
quests
mail
shop
purchases
admin users
roles
audit logs
game configuration

Do not invent the final schema before inspecting existing code/data.

Do not reset production.

Do not seed production demo data.

Prepare development/preview branch strategy if appropriate.

Ensure migrations are:

ordered
repeatable where appropriate
reviewable
safe
documented
testable
compatible with the chosen deployment process

===============================================---
23. PHASE 16 — PATCH / CONTENT SYSTEM
---

Initial Google Play AAB contains:

core executable
patch manager
initial content

Later content should be delivered by PCK/content patching where technically
and platform-policy appropriate.

Patchable content may include:

characters
character art
skins
maps
story
events
audio
music
localization
UI assets
data

Do NOT use patches to download arbitrary executable code.

The patch system must support:

app version
base content version
installed patch version
ordered patches
manifest
size
SHA-256
signature
URL
minimum app version
retry/resume
failure recovery
rollback
atomic install
integrity verification
incompatible patch detection

R2 bucket:

unaware-of-my-demise-content

Keep it private.

Document the client download/authentication model.

===============================================---
24. PHASE 17 — GEMINI ASSET WORKFLOW
---

Gemini is development-only and used by Claude Code.

Purpose:

image generation
character/concept art
UI/visual assets
audio
sound effects
music

Workflow:

Claude Code Cloud
↓
Gemini API credential
↓
Generated asset
↓
Review/organize
↓
GitHub asset/content directory
↓
Patch or initial game content

Do NOT add Gemini to:

Godot runtime
production API
Cloudflare Worker runtime
Neon
admin runtime
patch runtime

Never place the Gemini key in Git.

Generated assets must receive normal project provenance and naming.
Do not allow creative generation to silently replace established canon.

For UOMD, stage creative-generation outputs under `narrative/` before technical promotion.
Use the locked Fadyme reference set after owner approval.
Images are intended to use the configured Nano Banana 2 path, Japanese voice assets use Gemini TTS, and generated score uses Gemini Lyria except the owner-controlled main theme.

When generated content conflicts with documented story/character information,
record the conflict rather than silently changing canon.

===============================================---
==================================================
CREATIVE PRODUCTION / NARRATIVE INTEGRATION VALIDATION
==================================================

Before or during implementation, ensure that the narrative/content pipeline
supports the planned Japanese voice and music workflow.

Validate that narrative scenes can identify, at minimum:

- speaker
- dialogue line
- localization key
- voice asset
- voice duration where available
- music cue
- ambience/SFX cue
- transition timing

Generated voice and music should be treated as content assets with the same
provenance discipline as images.

For each completed character package, verify the relationship between:

character definition
↔ chibi gameplay art
↔ story art/portrait
↔ Japanese voice assets
↔ metadata
↔ gameplay/data references

Do not create isolated assets that cannot be traced to a character/content ID.

==================================================
25. PHASE 18 — CLOUD-ONLY GODOT BUILD
---

Determine how to validate Godot without a permanent local editor.

Prefer:

headless Godot
GitHub Actions
deterministic CI
project validation
scene/resource checks
script checks
Android AAB build
PCK build
regression tests
artifact upload
build logs

Document:

Godot version
Java version
Android SDK/build tools
Gradle
export preset
build commands
test commands
artifact paths
cache strategy
CI runner requirements

Any required local-only capability must be marked:

CLOUD_DEPENDENCY_GAP

and replaced with a cloud/headless alternative where possible.

Do not claim an Android build works until CI actually validates it.

===============================================---
26. PHASE 19 — GOOGLE PLAY PREPARATION
---

Google Play Console is a later release task.

Do not create it now unless already available.

Prepare the repository for:

Android AAB
release signing
package name
Play target requirements
Play Billing
purchase token verification
gacha odds disclosure
testing tracks
release notes
content rating requirements
privacy disclosures
support/contact requirements

Do not treat PCK patches as a universal replacement for application updates.

===============================================---
27. PHASE 20 — CI/CD
---

The canonical deployment flow must be explicit.

Desired conceptual flow:

GitHub
↓
Validation
↓
Tests
↓
Build
├── Cloudflare Worker
├── Admin
├── PCK
└── Android AAB

Database:

GitHub migration
↓
controlled migration job
↓
Neon

Patch:

GitHub
↓
PCK
↓
manifest/hash/sign
↓
R2

Android:

GitHub
↓
Godot build
↓
AAB
↓
artifact / later Play publishing

Inspect whether Cloudflare Workers Builds or GitHub Actions should be the
canonical production Worker deployment path.

Do not keep duplicate deployment mechanisms active for the same production Worker
without a concrete reason.

The canonical path must be documented in:

docs/INFRASTRUCTURE.md
docs/ARCHITECTURE.md
and the relevant workflow files.

===============================================---
28. PHASE 21 — COMPLETE GAP ANALYSIS
---

Identify everything missing to reach a complete online gacha game.

Classify:

BLOCKER
HIGH
MEDIUM
LOW

At minimum review:

account/auth
player data
backend
PostgreSQL
gacha
pity
inventory
characters
combat
progression
events
quests
mail
shop
purchases
Play Billing
admin
patching
R2
networking
security
rate limiting
abuse prevention
fraud controls
observability
analytics
backups
restore
localization
accessibility
performance
deployment
release
privacy/legal
age-related requirements where applicable

Do not claim completion without evidence.

===============================================---
29. PHASE 22 — IMPLEMENTATION ROADMAP
---

Create a complete dependency-aware roadmap.

The roadmap must be executable by another engineer/Claude session.

Use concrete phases, not vague tasks.

For every phase list:

objective
prerequisites
affected files
affected systems
implementation work
expected result
tests
validation criteria
completion criteria
rollback considerations

A reasonable initial ordering is:

infrastructure stabilization
Claude/MCP tooling stabilization
Google Drive access stabilization
repository cleanup/organization
legacy inventory
legacy migration
Worker compatibility
database schema/migrations
authentication
player model
authoritative game state
gacha
pity
inventory
character system
combat
progression
events/quests/mail
admin panel
patch manager
R2 content publishing
browser/admin regression
observability/security
purchase verification
Android AAB pipeline
closed testing
Play release
production hardening

Modify this ordering based on actual repository dependencies.

===============================================---
30. PHASE 23 — TEST STRATEGY
---

Create/update a complete test strategy.

Include:

unit
integration
API
auth
database
migration
transaction
gacha probability/pity
idempotency
inventory integrity
gameplay
scene
resource
asset
audio
story/content
networking
admin
Playwright
patch
manifest/hash/signature
R2
AAB
deployment
security
performance
regression
recovery/failure

Testing must be incremental.

Do not wait until the end to discover architecture problems.

For every critical system define:

positive path
invalid input path
authorization failure
dependency failure
retry behavior
rollback/recovery
data-integrity expectations

===============================================---
31. PHASE 24 — DOCUMENTATION
---

Persist the project state into GitHub.

Create/update where appropriate:

docs/
├── CURRENT_STATE.md
├── REPOSITORY_INVENTORY.md
├── INFRASTRUCTURE_AUDIT.md
├── DRIVE_LEGACY_ACCESS.md
├── LEGACY_AUDIT.md
├── MIGRATION_LEDGER.md
├── ASSET_INVENTORY.md
├── AUDIO_INVENTORY.md
├── STORY_INVENTORY.md
├── CHARACTER_INVENTORY.md
├── PROJECT_SPEC.md
├── ARCHITECTURE.md
├── GAME_DESIGN.md
├── ROADMAP.md
├── OPEN_QUESTIONS.md
├── DECISIONS.md
├── ADMIN_PANEL.md
├── INFRASTRUCTURE.md
├── FINAL_PROJECT_STATUS.md
└── coder/
├── MCP.md
├── START_HERE.md
├── MASTER_PROMPT.md
├── PHASES.md
├── TEST_PLAN.md
├── GIT_STRATEGY.md
├── GITHUB_SECRETS.md
└── ...

Do not blindly overwrite useful existing documentation.

Merge carefully.

Where conflicting information exists, document the conflict.

When documenting a migrated legacy item, preserve the Google Drive source
reference/path/name and the final GitHub target.

The documentation in GitHub must be sufficient for a future Claude session to
understand the project without depending on this conversation.

===============================================---
32. PHASE 25 — EXECUTION RULES
---

This is an execution task, not merely a report.

After each major phase:

inspect
act where appropriate
verify
document
commit
continue

Do not stop after the infrastructure audit.

Do not stop after the repository audit.

Do not stop after the legacy audit.

Do not stop after the migration plan.

Continue into implementation and validation unless an actual external/manual
block prevents progress.

Do not ask for approval for normal repository edits already authorized by this task.

Ask the user only when:

an external account/UI step is unavoidable
an irreversible destructive action would be required
a security-sensitive choice cannot be inferred safely
a story/canon conflict genuinely requires human resolution
a legal/product decision cannot be determined from technical evidence

When blocked:

explain exactly what is blocked
explain why
give the precise manual action
continue all unrelated work

===============================================---
33. PHASE 26 — WHAT NOT TO DO
---

Do NOT:

delete the Google Drive legacy archive
rename or reorganize legacy files in Drive
bulk-copy the entire legacy archive into GitHub
recreate a full LEGACY/ directory in GitHub
reset Neon production
seed production demo data
expose credentials
commit secrets
invent story facts
silently resolve narrative conflicts
create duplicate Cloudflare Workers
create duplicate Hyperdrive
create duplicate R2 buckets
create duplicate Neon projects
add unnecessary MCPs
add a Gemini runtime integration
require a permanent local development machine
replace secure auth with a weaker implementation
blindly rewrite the entire existing game
claim access to files that were not actually retrieved
claim a build works without executing the relevant validation
claim production deployment is configured without verifying it
leave duplicate production deployment paths unexplained

===============================================---
34. PHASE 27 — FINAL STATUS / HANDOFF
---

At the end, create:

docs/FINAL_PROJECT_STATUS.md

Include:

Executive summary
Infrastructure status
Cloud Environment status
Google Drive access status
MCP/tooling status
GitHub status
Cloudflare Worker status
Hyperdrive status
R2 status
Neon status
Current game architecture
Legacy findings
Legacy migration status
Assets
Audio
Story
Characters
Database
Backend
Admin
Patch system
CI/CD
Tests
Security
Production hardening gaps
Open questions
Decisions requiring human approval
External/manual actions remaining
Complete implementation roadmap
Current implementation status
Exact next development task
Known blockers
Known CLOUD_DEPENDENCY_GAP items
Creative reference-set status
Creative asset pipeline status
Narrative/ staging status
Image-generation workflow status
Voice-generation workflow status
Music-generation workflow status
Japanese dubbing integration status
Main-theme ownership status
Chibi gameplay presentation status
Portrait 1080×1920 validation status

Every important conclusion must cite supporting evidence.

For active project conclusions:
cite the supporting GitHub repository path/file.

For infrastructure conclusions:
cite command output or measurable runtime evidence where available.

For legacy conclusions:
cite the Google Drive source name/path/folder context.

Never fabricate evidence.

===============================================---
35. FINAL PROJECT PRINCIPLES
---

Remember these principles throughout the task:

GitHub is the source of truth for the active project.
Development is Claude Code Cloud-only.
Google Drive is the external legacy archive.
Cloudflare Workers is the intended production API runtime.
Neon PostgreSQL is the production database.
Hyperdrive connects Worker to Neon.
R2 stores PCK/content assets.
PCK is for data/content, not arbitrary executable code.
Gemini is only a Claude Code development-time creative asset service.
Nano Banana 2 is the intended image-generation setup unless the project owner
changes that decision.
Gemini TTS is the intended voice-generation path unless the project owner
changes that decision.
Gemini Lyria is the intended generated-music path unless the project owner
changes that decision.
The main theme is handled personally by the project owner.
The initial approved logo/key-art/Fadyme reference set anchors subsequent
creative generation.
Gameplay visuals are chibi-style PNG-based 2D presentation.
Story/VN visuals use detailed character-sheet/light-novel-style art.
The game is portrait-only at 1080×1920 for Android.
Narrative scenes are authored with Japanese dubbing and music cues in mind.
The game client is not authoritative for sensitive player state.
Legacy is an archive and knowledge source.
Important knowledge must be written into docs.
Do not rely on conversation memory.
Do not invent missing information.
Security must not be weakened to make setup easier.
Use evidence before making architecture changes.
Preserve provenance when migrating legacy material.
Perform the work sequentially.
Test incrementally.
Commit coherent progress.
Leave the repository in a documented, cloud-ready, production-oriented state.

===============================================---
36. FINAL LEGACY STORAGE RULE
---

The Google Drive folder identified below is the canonical external legacy archive:

https://drive.google.com/drive/folders/1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy?usp=sharing

DO NOT:

recreate the complete archive under GitHub/LEGACY
commit the whole archive "just in case"
delete legacy files
rename legacy files
move legacy files
reorganize the Drive archive
overwrite legacy files
fabricate unreadable content
treat Drive as a mounted filesystem

DO:

use Google Drive as the historical/reference source
inspect what is actually accessible
inventory accessible and inaccessible materials
migrate only necessary/approved materials
preserve source provenance
keep the active GitHub repository clean and production-oriented
record inaccessible files honestly
keep legacy originals untouched

The intended end state is:

GOOGLE DRIVE
└── LEGACY / historical source archive
│
│ selective, traceable migration
▼
GITHUB
└── ACTIVE rebuilt project / production source of truth
│
├── CI/CD
├── Cloudflare Worker
├── Neon PostgreSQL
├── R2 / PCK
└── Next.js Admin

===============================================---
37. RESPONSE / COMMUNICATION RULE
---

You may use English for code, filenames, architecture documents, commit
messages, and technical terms where that improves consistency.

I will generally communicate with you in Turkish.

When reporting progress to me, prefer Turkish unless the surrounding technical
artifact is intentionally English.

Do not replace evidence with vague statements such as:
"looks good"
"should work"
"probably configured"

Use evidence-oriented statements such as:

VERIFIED
PARTIALLY_VERIFIED
UNVERIFIED
BLOCKED
CLOUD_DEPENDENCY_GAP
DECISION_REQUIRED

At the end of each major stage, report the actual state and continue.

===============================================---
38. CRITICAL EXECUTION ORDER
---

Follow this overall order unless repository evidence proves that a dependency
requires a different sequence:

1. Inspect Cloud Environment.
2. Verify GitHub connection and repository state.
3. Verify Cloudflare resources.
4. Verify Neon resources.
5. Verify Hyperdrive.
6. Verify R2.
7. Verify Gemini credential presence without exposing it.
8. Verify Google Drive connector access to the LEGACY folder.
9. Inspect MCP/CLI tooling.
10. Read project instructions.
11. Audit repository.
12. Audit current game.
13. Audit Google Drive legacy recursively as accessible.
14. Extract story/character/game knowledge.
15. Cross-reference current and legacy systems.
16. Create inventories.
17. Create migration ledger.
18. Safely migrate reusable material.
19. Finalize architecture.
20. Identify gaps.
21. Stabilize Worker compatibility.
22. Stabilize database/migrations.
23. Implement authoritative backend foundation.
24. Implement core player/game systems.
25. Implement gacha/pity/inventory.
26. Implement content/admin systems.
27. Implement patch/R2 pipeline.
28. Implement CI validation/builds.
29. Implement Android AAB pipeline.
30. Run regression/security tests.
31. Verify deployment path.
32. Update all documentation.
33. Create FINAL_PROJECT_STATUS.md.
34. Commit coherent final state.
35. State the exact next task.

Do not skip a step silently.

===============================================---
39. STOP CONDITIONS
---

STOP AND ASK FOR USER ACTION only when one of the following is truly required:

Google Drive connector authentication cannot be completed by Claude
Cloudflare authentication requires external UI/account action
Neon authentication requires external UI/account action
GitHub authentication requires external UI/account action
a signing key/keystore must be supplied by the user
Google Play Console must be accessed manually
a destructive irreversible migration is genuinely required
a story/canon decision has multiple valid conflicting sources and cannot be
resolved from documented project evidence
a legal/compliance choice cannot be inferred from technical requirements

Do NOT stop merely because:

the project is incomplete
there are bugs
legacy is messy
the architecture needs refactoring
the Worker is currently incompatible
tests fail
the admin panel is incomplete
the database is missing tables
the game has placeholder content
an MCP is unavailable

Those are engineering tasks, not reasons to stop.

===============================================---
40. DEFINITION OF DONE
---

The project is considered "cloud-ready" only when:

GitHub contains the active production source of truth
legacy source remains safely archived in Google Drive
legacy provenance is documented
Cloud Environment setup is documented
MCP/tooling status is documented
Cloudflare deployment path is documented and validated
Hyperdrive is verified
Neon is verified
R2 is verified
database migrations are version-controlled
backend architecture is compatible with the intended Worker runtime
server-authoritative rules are enforced
gacha/pity/inventory are server-authoritative
admin foundation is documented and validated
patch system is documented
PCK pipeline is reproducible
R2 publishing path is reproducible
Godot cloud/headless validation is reproducible
Android AAB build path is documented
creative reference set is locked or explicitly marked pending owner approval
asset naming/foldering/metadata/versioning is understood and documented
legacy asset pipeline has been preserved/adapted where valuable
Gemini generation workflow is operational as a development-time process
Japanese voice workflow is represented in narrative/content data
music cue workflow is represented in narrative/content data
2D chibi gameplay presentation is validated
portrait 1080×1920 Android presentation is validated
tests exist for critical systems
security controls are documented
open gaps are explicitly listed
final status is written to GitHub
the next implementation task is unambiguous

Do not falsely mark the project complete merely because the repository looks organized.

===============================================---
41. FINAL INSTRUCTION
===============================================---
---

## AUTONOMOUS EXECUTION / CONTINUATION RULE

Work as autonomously as reasonably possible.

This is a long-running engineering task. Do not stop unnecessarily between
phases, subtasks, implementation steps, tests, migrations, documentation,
asset-generation tasks, or commits.

Follow this master prompt sequentially and continue through the project without
repeatedly asking for confirmation for ordinary engineering decisions already
authorized by this prompt.

When a task can be completed safely using:

- the active repository
- connected Google Drive access
- GitHub
- Cloudflare
- Neon
- R2
- Gemini credentials
- MCPs
- CLI tools
- CI
- headless tooling
- available Cloud Environment capabilities

perform the task yourself.

Do not pause simply because the project is large, incomplete, messy, or
contains many legacy files.

Do not pause merely because tests fail. Investigate, fix, re-test, and continue
when the failure is within your authorized scope.

Do not pause merely because refactoring is needed. Perform safe refactoring when
it is supported by evidence and the documented architecture.

==================================================
LIMIT / SESSION CONTINUATION
==================================================

This project may exceed a single Claude Code usage/session limit.

If the current usage limit, context limit, session limit, or temporary tool
limitation is reached:

1. Do NOT abandon the project.
2. Do NOT undo completed work merely because the session is ending.
3. Persist the current state whenever technically possible.
4. Commit completed coherent work.
5. Update the relevant documentation.
6. Update current-state / roadmap / handoff information.
7. Record exactly what was completed.
8. Record exactly what remains.
9. Record known blockers and failed tests.
10. Record the exact next task.

When the environment becomes available again, continue from the latest verified
repository checkpoint.

Do NOT restart the project from the beginning.
Do NOT repeat audits already documented as completed.
Do NOT rely on conversation memory to recover context.

Read the current repository state, Git history, project documentation,
migration ledger, roadmap, decisions, and relevant files, then continue from
the latest verified state.

The repository and its documentation are the persistent memory of the project.

==================================================
CHECKPOINT / RESUME RULE
==================================================

At meaningful milestones create a recoverable checkpoint.

Preserve at minimum:

- completed phases
- current phase
- current implementation state
- changed files
- pending work
- known blockers
- failed tests
- unresolved decisions
- migration status
- infrastructure status
- creative reference-set status
- asset-generation status
- exact next task

Prefer Git commits and project documentation over conversation-only notes.

==================================================
NO UNNECESSARY APPROVAL PAUSES
==================================================

Do NOT ask:

"Should I continue?"
"Do you want me to proceed?"
"Would you like me to implement this?"
"Should I inspect the next phase?"

when this prompt already authorizes the work.

Continue automatically.

The main intentional approval boundary is the INITIAL CANONICAL CREATIVE
REFERENCE SET described earlier in this prompt.

Ask the owner only when:

- an external account/UI action is genuinely required
- a secret/credential must be supplied by the user
- an irreversible destructive action is unavoidable
- a security-sensitive decision cannot safely be inferred
- a genuine story/canon conflict requires human input
- the initial reference set requires owner approval before it can be locked
- a legal/platform decision cannot be determined technically

Even when blocked, continue all unrelated work that remains possible.

==================================================
FAILURE RECOVERY
==================================================

When an operation fails:

1. inspect the error
2. classify the cause
3. attempt a safe correction
4. retry
5. validate
6. document the outcome
7. continue

Do not repeatedly retry the same failing operation without changing the
diagnosis or approach.

When a tool or MCP is unavailable:

- check whether an equivalent CLI/headless/native capability exists
- use the alternative when safe
- document the limitation
- never pretend an unavailable tool worked

==================================================
CONTEXT MANAGEMENT
==================================================

When context becomes large:

- persist important findings into GitHub documentation
- avoid rereading large files unnecessarily
- use project documentation as durable memory
- summarize completed work into the appropriate files
- continue from verified state

Do not sacrifice correctness merely to reduce context size.

==================================================
AUTONOMOUS DECISION MAKING
==================================================

Use documented project requirements and actual code/data as primary evidence.

When multiple technically valid choices exist:

- prefer the simplest maintainable solution
- preserve the target architecture
- preserve security
- preserve portability
- minimize unnecessary dependencies
- minimize infrastructure duplication
- minimize long-term operational complexity
- preserve established creative conventions when they are documented/canonical

Document meaningful architecture and asset-pipeline decisions.

Do not invent requirements merely because a feature would be convenient.

==================================================
FINAL CONTINUATION PRINCIPLE
==================================================

Treat this as one continuous engineering project even if it requires multiple
Claude Code sessions.

A session ending is NOT the end of the project.
A usage limit is NOT permission to abandon the project.

When execution becomes available again, resume from the latest verified
repository state and continue toward the remaining work.

The objective is not to produce a good-looking report.

The objective is to progressively leave the actual repository closer to a
complete, tested, documented, production-oriented, cloud-only Godot online
gacha game with a coherent narrative and AI-assisted creative asset pipeline.

==================================================
FINAL COMMAND
==================================================

You are the lead engineer for the entire rebuild.

Understand first.
Verify second.
Preserve evidence.
Preserve legacy provenance.
Preserve established legacy asset conventions where valuable.
Migrate selectively.
Architect deliberately.
Generate creative assets consistently.
Respect the approved Fadyme reference set.
Integrate Japanese voice and music from the start.
Implement incrementally.
Test continuously.
Deploy canonically.
Document everything.
Keep GitHub clean.
Keep Google Drive legacy safe.
Keep secrets out of Git.
Keep development cloud-only.
Do not rely on hidden memory.

Then continue the project until you reach a real, evidence-backed implementation
state or encounter a genuine external/manual blocker.

I will generally communicate with you in Turkish.

Start now.
Read this master prompt completely before acting.
Execute it autonomously from the beginning.
Use the active GitHub repository as the source of truth and the specified
Google Drive folder as the legacy archive.
Verify connected services before making assumptions.
Persist progress, decisions, migrations, creative assets, tests, and checkpoints
into GitHub.
If a usage/session limit is reached, leave the repository in a recoverable state
and continue from the latest verified checkpoint when execution becomes
available again.
Do not stop for ordinary approval requests.
Only stop for genuine external/manual blockers or the explicitly defined
creative/canon approval boundary.

==================================================
PROJECT PROFILE — MACHINE-READABLE SUMMARY
==================================================

PROJECT_ID: unaware-of-my-demise
PROJECT_TITLE: Unaware of My Demise
PROJECT_TYPE: dark-fantasy mobile online gacha RPG
PRIMARY_PLATFORM: Android
ORIENTATION: portrait-only
BASE_RESOLUTION: 1080x1920
ENGINE: Godot 4.7.2
ACTIVE_REPO: Unaware-of-My-Demise
ACTIVE_BRANCH: main
LEGACY_SOURCE: Google Drive
LEGACY_FOLDER_ID: 1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy
WORKER: unaware-of-my-demise-api
WORKER_SOURCE_DIR: server/
DATABASE_PROVIDER: Neon PostgreSQL
NEON_PROJECT_ID: sweet-cake-52313810
NEON_BRANCH: production
NEON_DATABASE: UOMD
HYPERDRIVE_ID: edbe90afd0ab42a1ab708e7e2e49c04b
HYPERDRIVE_BINDING: HYPERDRIVE
R2_BUCKET: unaware-of-my-demise-content
R2_VISIBILITY: private
ADMIN: Next.js
PATCH_FORMAT: PCK/content patches
IMAGE_MODEL_INTENT: Nano Banana 2 via Gemini API
VOICE_INTENT: Gemini TTS
MUSIC_INTENT: Gemini Lyria
MAIN_THEME_OWNER_CONTROLLED: true
GAMEPLAY_ART_STYLE: chibi PNG-based 2D
STORY_ART_STYLE: detailed character-sheet / light-novel style
VOICE_LANGUAGE: Japanese
INITIAL_CANON_REFERENCE_CHARACTER: Fadyme
INITIAL_CANON_REFERENCE_SET: logo + key art + Fadyme sheet + Fadyme assets + Fadyme voice + Fadyme theme
CREATIVE_WORKSPACE: narrative/
MEMORY_SOURCE: this prompt + active repository + accessible Google Drive legacy + verified connected services


==================================================
UOMD CONTINUATION POLICY
==================================================

If a Claude Code usage/session/context limit is reached, do not abandon the task.
Persist checkpoint state to GitHub and continue from the latest verified state
when the environment is available again.
Do not restart completed audits.
Do not rely on conversation memory for recovery.
