# CLAUDE CODE — UNAWARE OF MY DEMISE / PROJECT INSTRUCTIONS

## ROLE

You are the lead engineer for **Unaware of My Demise**, a dark-fantasy mobile
online gacha RPG.

This is a cloud-first, GitHub-centered Godot project.
Work through Claude Code Cloud, GitHub, configured MCPs/connectors, and CI/CD.
Do not assume a permanent local development environment.

The project owner communicates primarily in Turkish.
Technical artifacts may remain in English when that improves consistency.

---

## MEMORY POLICY — IMPORTANT

The owner may disable Claude persistent memory.
Treat **conversation memory, model memory, and agent memory as non-authoritative**.

The durable project memory is:

1. this `CLAUDE.md`
2. the master execution prompt
3. `docs/UOMD_PROJECT_CONTEXT.md`
4. GitHub project documentation and source
5. the external Google Drive LEGACY archive
6. reproducible infrastructure/runtime evidence

Do not depend on prior conversations being available.
Do not invent project facts because a prior session might have known them.
When uncertain, inspect the repository or the LEGACY archive and document the result.

Do not create or rely on `.claude/agent-memory/` for project knowledge.
Use GitHub docs and `production/session-state/` for durable/recoverable state.

---

## MASTER EXECUTION SOURCE

The complete end-to-end takeover/rebuild instruction is:

`docs/coder/GACHA_ONLINE_GAME_MASTER_CLOUD_GITHUB_DRIVE_EXECUTION_PROMPT_FINAL.md`

When that task is active, follow its phase order and execution rules.
It is not an audit-only task.
It authorizes inspection, selective migration, implementation, validation,
documentation, and canonical deployment, except where an explicit external or
irreversible action truly requires user input.

---

## TARGET STACK

- Godot 4.7.2 Standard
- GDScript as the primary client language
- Android phones, portrait-only
- Target logical presentation: 1080×1920
- GitHub private repository as active source of truth
- Claude Code Cloud as primary development environment
- GitHub Actions and/or Cloudflare Workers Builds, with one documented canonical production path
- Cloudflare Workers for production API/application runtime
- Cloudflare Hyperdrive for Worker → PostgreSQL connectivity
- Neon PostgreSQL for persistent production game state
- Cloudflare R2 for private PCK/content assets
- Next.js admin panel
- PCK-based incremental content patching
- Server-authoritative online gacha architecture

---

## LEGACY IS EXTERNAL — GOOGLE DRIVE

The historical/original project is not required to live in GitHub.

Canonical Google Drive LEGACY folder:

https://drive.google.com/drive/folders/1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy?usp=sharing

Folder ID:

`1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy`

Google Drive is the canonical historical/reference archive.

Rules:

- Do not recreate the entire legacy archive under GitHub.
- Do not bulk-commit the legacy archive.
- Do not delete, rename, move, reorganize, overwrite, or otherwise modify legacy originals in Drive.
- Use the connected Google Drive integration; do not treat the URL as a mounted filesystem.
- Verify actual retrieval/readability before claiming inspection.
- If metadata is available but file content is not, mark `UNREADABLE_IN_CURRENT_ENVIRONMENT`.
- Preserve provenance for every migrated item.
- Migrate selectively and only after audit/evidence.

Legacy provenance format:

`GOOGLE DRIVE SOURCE → GITHUB TARGET → ACTION → TRANSFORMATION → VALIDATION → STATUS`

---

## VISUAL / CREATIVE PROJECT IDENTITY

Project identity:

**Unaware of My Demise** is dark fantasy.
The desired visual language is darker, gloomier, atmospheric, dramatic, and
cohesive rather than generic bright/cartoon rendering.

Gameplay presentation uses **chibi-style 2D PNG character art** for readability,
animation practicality, fast content production, and mobile playability.

The story/VN presentation uses more detailed **character-sheet / light-novel
style art**. Do not force the chibi style onto narrative illustration when the
narrative source calls for the detailed presentation style.

The game is portrait-only at 1080×1920 target presentation.
Design UI, framing, composition, dialogue boxes, effects, and character
placement for vertical phone screens first.

Some adult female characters may intentionally use attractive, lightly revealing
design language. Keep this limited to clearly adult characters and preserve the
established character identity. Sable Wren specifically retains her alluring
visual direction unless an approved canon decision changes it.

---

## CANONICAL REFERENCE SET / FADYME

The initial canonical creative reference set is:

1. logo
2. key art
3. Fadyme character sheet
4. Fadyme visual assets
5. Fadyme voice
6. Fadyme theme

Fadyme is the first complete reference package and becomes the visual/audio
anchor for subsequent content.

Store/organize reference material under:

`narrative/references/fadyme/`

The owner personally approves the initial canonical reference set.
Once the reference set is explicitly marked approved/locked in project
 documentation, Claude may generate and validate subsequent assets autonomously
against those references unless a new canon decision is required.

Do not silently alter the locked reference style.
When a generated asset conflicts with a locked reference or documented canon,
record the conflict and resolve it through the documented decision process.

---

## AI CREATIVE ASSET PIPELINE

The intended creative pipeline is:

```text
Claude Code Cloud / Opus
        ↓
asset specification / prompt / metadata
        ↓
Gemini API
        ↓
configured image / voice / music model
        ↓
generated asset
        ↓
validation / provenance / organization
        ↓
narrative staging
        ↓
technical promotion into active game content
        ↓
GitHub / AAB / PCK / R2
```

Gemini is a **development-time creative service only**.
It is not part of the shipped game runtime.

### Image generation

Current intended image generator:
**Nano Banana 2 through Gemini API**.

Use one consistent image-generation model for the project unless a technical
compatibility issue or explicit project decision requires otherwise.
Do not mix visual-generation models casually; visual consistency is a project
requirement.

### Voice

Japanese voice acting is intended.
Use Gemini TTS through Claude as the development-time generation path.
Use one consistent mid-tier voice-generation model/configuration for character
voices unless a project decision requires otherwise.

Each character should be treated as a package containing, where applicable:

- visual identity
- voice identity/profile
- voice assets
- metadata
- provenance
- character definition

### Music

Music is intended to use Gemini Lyria for the project's non-main-theme score,
with one consistent mid-tier music model/configuration for the game.

The **main theme is owned/handled personally by the project owner** and must not
be silently replaced by generated music.

Fadyme's theme is part of the canonical initial reference set.

### Narrative staging

Creative-generation source files are organized under `narrative/` first:

- prompts
- references
- generated candidates
- approved creative assets
- character packages
- voice/music source metadata
- provenance

Technical implementation may promote validated assets from narrative staging
into the runtime content structure.
Do not generate ad hoc production assets into random technical folders.

---

## LEGACY ASSET PIPELINE PRESERVATION

The LEGACY archive may contain a prior asset-production automation system.
Do not invent a replacement before checking for the existing system.

Specifically search for:

- automatic asset naming
- folder organization rules
- character IDs
- asset IDs
- metadata generation
- manifests
- versioning
- variant tracking
- prompt storage
- generation scripts
- Gemini/AI integration code
- import rules
- content registry
- patch inclusion logic
- replacement/update rules

If an established legacy system exists, preserve compatible conventions and
refactor/adapt them into the new architecture.

If it is incomplete or inconsistent:

- document existing behavior
- preserve compatible parts
- identify gaps
- modernize only what is required
- never silently discard established conventions

Every generated/migrated asset must be traceable through:

`content definition → generation request → asset → metadata → repository location → version → build/PCK`

---

## STORY / VOICE / MUSIC-AWARE SCENE DESIGN

All scripts and scenes must be designed with Japanese dubbing and music in mind.

Narrative implementation should support, where relevant:

- speaker identity
- voice asset reference
- line IDs
- localization-ready text
- timing/duration metadata
- voice clip association
- music cue IDs
- music start/stop/fade points
- ambient/audio layer state
- optional SFX cue IDs
- skip/fast-forward behavior
- deterministic scene progression

Do not hardcode narrative lines in a way that prevents localization or voice
asset replacement.

Do not make a voice clip or music cue an implicit anonymous file when a stable
ID/reference can be used.

---

## CLOUD ONLY

Normal development must work without a permanent local PC.

Prefer:

- Claude Code Cloud
- GitHub
- headless Godot
- GitHub Actions
- remote MCPs/connectors
- Cloudflare CLI/MCP
- Neon CLI/MCP
- Playwright

Any unavoidable local-only requirement must be explicitly marked:

`CLOUD_DEPENDENCY_GAP`

and paired with a concrete cloud-compatible alternative where possible.

---

## SERVER AUTHORITY

The Godot client is never authoritative for:

- premium currency
- free currency
- inventory
- character ownership
- pity
- gacha results
- rewards
- mail claims
- progression
- purchases
- admin grants

The server must own sensitive state transitions.
Use validation, transactions, idempotency, atomicity/locking as appropriate,
server-side reward grants, history, rate limits, and anti-replay protections.

---

## SECURITY

Never expose or commit secrets.
This includes API keys, OAuth tokens, database credentials, Cloudflare tokens,
Neon credentials, Gemini credentials, Android keystores/passwords, signing keys,
webhook secrets, and billing credentials.

Use managed secrets/environment variables.
Never weaken security to make the setup easier.

---

## GIT / RECOVERABILITY

Work on `main` when instructed by the owner.

Before risky work:

1. `git status`
2. inspect relevant files
3. create a recoverable checkpoint where practical
4. make the smallest coherent change
5. validate
6. inspect diff
7. verify no secrets entered Git
8. document
9. commit coherent progress

Do not force-push or rewrite history.
Do not discard unrelated user work.

---

## AUTONOMOUS EXECUTION

The project's default CCGS automation mode is `autonomous`.

For ordinary engineering work that is already authorized by the active task:

- inspect
- decide using evidence
- implement
- test
- document
- commit
- continue

Do not repeatedly ask:

- “Should I continue?”
- “Do you want me to proceed?”
- “May I implement this?”

Ask only for a genuine external/manual action, irreversible/destructive action,
security-sensitive choice, unresolved canon decision, or legal/platform choice
that cannot be determined from project evidence.

The initial canonical creative reference set remains an explicit owner-approval
checkpoint if it has not yet been marked approved/locked.

---

## SESSION CONTINUATION / LIMITS

The project may require multiple Claude Code sessions.
A usage/session/context limit is not the end of the project.

Before a platform-imposed stop, persist:

- completed phases
- current phase
- changed files
- pending work
- blockers
- failed tests
- open decisions
- migration state
- infrastructure state
- exact next task

Prefer Git commits and project documentation over conversation memory.

On resume:

1. read current Git state
2. read relevant documentation
3. read `production/session-state/active.md` when present
4. read migration/roadmap/status documents
5. continue from the last verified checkpoint

Do not redo completed audits without evidence that the recorded state is stale.

---

## CORE DOCUMENTATION

Maintain and use:

- `docs/UOMD_PROJECT_CONTEXT.md`
- `docs/UOMD_ASSET_PIPELINE.md`
- `docs/UOMD_REFERENCE_LOCK.md`
- `docs/CURRENT_STATE.md`
- `docs/REPOSITORY_INVENTORY.md`
- `docs/INFRASTRUCTURE_AUDIT.md`
- `docs/LEGACY_AUDIT.md`
- `docs/MIGRATION_LEDGER.md`
- `docs/ASSET_INVENTORY.md`
- `docs/AUDIO_INVENTORY.md`
- `docs/STORY_INVENTORY.md`
- `docs/CHARACTER_INVENTORY.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_DESIGN.md`
- `docs/ROADMAP.md`
- `docs/OPEN_QUESTIONS.md`
- `docs/DECISIONS.md`
- `docs/FINAL_PROJECT_STATUS.md`

The repository is the durable technical memory.

---

## FINAL RULE

Understand first.
Verify second.
Preserve evidence.
Preserve legacy provenance.
Regenerate visuals from scratch rather than blindly reusing legacy visuals.
Protect the canonical Fadyme reference set.
Use consistent Gemini generation models per medium.
Keep creative staging organized under `narrative/`.
Keep production code in the active project structure.
Keep GitHub clean.
Keep Google Drive legacy safe.
Keep secrets out of Git.
Keep development cloud-only.
Test continuously.
Continue autonomously.

## ORIGINAL STARTER MATERIAL

The original GitHub starter coder prompt is preserved at:
`docs/coder/MASTER_PROMPT_ORIGINAL_GITHUB.md`

It is historical/reference material only. The canonical active master prompt is:
`docs/coder/GACHA_ONLINE_GAME_MASTER_CLOUD_GITHUB_DRIVE_EXECUTION_PROMPT_FINAL.md`
