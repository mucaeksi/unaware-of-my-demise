# Unaware of My Demise

**Dark-fantasy mobile online gacha RPG**

This repository is the active production/development source of truth for
**Unaware of My Demise**. It combines the original Godot game foundation with a
UOMD-tailored Claude Code Game Studios 1.1.2 development framework.

## Project configuration

- Godot 4.7.2
- GDScript
- Android phones
- Portrait-only
- 1080×1920 target presentation
- Cloud-only development
- GitHub source of truth
- Cloudflare Workers + Hyperdrive
- Neon PostgreSQL
- Cloudflare R2
- Next.js admin
- Server-authoritative online gacha
- Google Drive external LEGACY archive
- Gemini development-only creative asset workflow
- UOMD-tailored Claude Code agents/skills/hooks/rules

## Source of truth

GitHub is the source of truth for the ACTIVE rebuilt project:

- Godot project and code
- backend
- admin panel
- database migrations
- content/data definitions
- patch manifests
- CI/CD
- infrastructure/deployment definitions
- documentation
- project decisions
- asset provenance for promoted production content

PostgreSQL does not run in GitHub. GitHub is the control plane.

Runtime boundaries:

```text
Claude Code Cloud
        ↓
      GitHub
        ├── GitHub Actions
        │      ├── tests
        │      ├── builds
        │      ├── migrations
        │      └── PCK/patch generation
        │
        ├── Cloudflare Workers
        │      ↓
        │   Hyperdrive
        │      ↓
        │   Neon PostgreSQL
        │
        └── Cloudflare R2
               ↓
            PCK/content

Google Drive LEGACY
        ↓
  historical/reference source
```

## Legacy storage

The historical/original project is stored **outside GitHub**.

Canonical Google Drive LEGACY folder:

https://drive.google.com/drive/folders/1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy?usp=sharing

Folder ID:

`1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy`

Do not recreate a full `LEGACY/` directory in GitHub.

Do not bulk-copy the archive.

Do not delete, rename, move, reorganize, overwrite, or modify the originals in
Google Drive.

Use the connected Google Drive integration and preserve provenance for every
migrated item.

## Repository

```text
Unaware-of-My-Demise/
├── .claude/                     # UOMD-tailored Claude Code framework
├── admin/                       # Next.js admin panel
├── database/                    # PostgreSQL migrations/seed definitions
├── docs/                        # project/engineering/design documentation
├── game/                        # Godot 4.7.2 Android client
├── narrative/                   # creative staging + references + generated assets
├── patch/                       # PCK manifests/content patch tooling
├── production/                  # session state/logs
├── scripts/                     # build/patch helpers
├── server/                      # Cloudflare Worker API
├── CLAUDE.md
├── GAME_TOOLCHAIN.md
├── project.yaml
├── docker-compose.yml
├── .env.example
└── .github/workflows/           # CI/CD when present
```

## Creative identity

Gameplay uses **chibi 2D PNG character visuals** for readability, practical
animation, rapid asset production, and mobile playability.

Narrative/VN presentation uses more detailed character-sheet / light-novel-style
art.

The desired art language is dark, gloomy, atmospheric, dramatic, and cohesive.
Avoid generic bright/cartoon rendering as the default.

The game is portrait-first at 1080×1920.

### Canonical reference set

The initial reference set is:

1. logo
2. key art
3. Fadyme character sheet
4. Fadyme visual assets
5. Fadyme voice
6. Fadyme theme

The owner personally approves the initial set. After it is explicitly locked,
Claude may generate subsequent assets autonomously against it.

See:

- `docs/UOMD_PROJECT_CONTEXT.md`
- `docs/UOMD_REFERENCE_LOCK.md`
- `docs/UOMD_ASSET_PIPELINE.md`

### AI-generated production assets

Development-time asset workflow:

```text
Claude Code Cloud
      ↓
Gemini API
      ↓
Nano Banana 2 / Gemini TTS / Lyria
      ↓
generated candidate
      ↓
reference/canon + technical validation
      ↓
narrative staging
      ↓
production promotion
      ↓
GitHub / AAB / PCK / R2
```

The main theme remains owner-controlled.

Gemini is never a shipped runtime dependency.

## Security / server authority

The client is not authoritative for:

- premium/free currency
- inventory
- character ownership
- pity
- gacha results
- event/mail rewards
- progression
- purchases

Gacha results are generated server-side and persisted transactionally.
The backend validates all sensitive state changes.

## Content / patch model

The initial AAB contains the core executable and initial content.

Later content may use PCK patches where technically and platform-policy
appropriate.

Patches can contain:

- characters
- art
- skins
- maps
- story
- events
- audio/music
- localization
- UI assets
- data

Do not use patches to distribute arbitrary executable code or to replace normal
application updates.

R2 bucket:

`unaware-of-my-demise-content`

Keep it private.

## Admin

The Next.js admin panel becomes the game's operational control center.

Target domains:

Dashboard
Players
Characters
Items
Inventory
Currency
Gacha
Pity
Events
Quests
Mail
Announcements
Shop
Purchases
Content/Patches
Game configuration
Feature flags
Audit logs
Admin users/RBAC
Diagnostics

Every player-state action must be authenticated, authorized, validated, logged,
and auditable.

## Database

Target production database:

**Neon PostgreSQL**

Use versioned migrations under:

`database/migrations/`

Never reset production or seed production demo data.

## CI/CD

Canonical deployment must be documented and verified.

```text
GitHub
  ↓
Validation
  ↓
Tests
  ↓
Build
  ├── Worker
  ├── Admin
  ├── PCK
  └── Android AAB
```

Database:

```text
GitHub migration
  ↓
controlled migration
  ↓
Neon
```

Patch:

```text
GitHub
  ↓
PCK
  ↓
manifest / SHA-256 / signature
  ↓
R2
```

Determine whether GitHub Actions or Cloudflare Workers Builds is the canonical
production Worker deployment mechanism. Do not leave duplicate unexplained
production deployment paths.

## Google Play

Google Play Console is a later release task unless already configured.

Prepare for:

- Android AAB
- release signing
- package name
- Play requirements
- Play Billing
- purchase token verification
- applicable gacha/loot-box odds disclosure
- testing tracks
- release requirements

## Claude Code Game Studios framework

This repository contains a UOMD-tailored subset of Claude Code Game Studios 1.1.2:

- Godot-focused agents
- skills
- hooks
- rules
- templates
- Godot engine references
- autonomous workflow configuration
- UOMD asset pipeline
- session/checkpoint support

Unity and Unreal specialist agents are intentionally excluded from the tailored
runtime framework.

Canonical project instructions are in `CLAUDE.md`.

The canonical master execution task is:

`docs/coder/GACHA_ONLINE_GAME_MASTER_CLOUD_GITHUB_DRIVE_EXECUTION_PROMPT_FINAL.md`

## Memory

Persistent Claude memory is not authoritative.

The durable project memory is the repository itself:

- `CLAUDE.md`
- project documentation
- source code
- migration ledgers
- session state
- asset provenance
- the external Google Drive LEGACY archive

Do not rely on prior conversation memory.

## Start

For the first major takeover, run the canonical master prompt in Claude Code
Cloud with autonomous execution.

For normal work, read `CLAUDE.md` and the relevant current-state/project
documentation before changing code.
