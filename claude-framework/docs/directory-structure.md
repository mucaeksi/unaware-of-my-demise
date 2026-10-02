# UOMD Directory Structure

```text
/
├── CLAUDE.md
├── project.yaml
├── .claude/                     # UOMD-tailored Claude Code framework
├── game/                        # Godot 4.7.2 Android client
├── narrative/                   # Creative staging, references, prompts, generated assets, provenance
├── server/                      # Cloudflare Workers API
├── admin/                       # Next.js admin panel
├── database/                    # Versioned PostgreSQL migrations and seed definitions
├── patch/                       # PCK manifests / content-patch tooling
├── scripts/                     # Build / patch / integration helpers
├── docs/                        # Project, architecture, audit, story, asset and deployment documentation
├── production/                  # Session state, logs, recoverable project checkpoints
└── .github/                     # CI/CD workflows when present
```

## Engine and code root

UOMD uses **Godot 4.7.2 + GDScript**.

The project's explicit game code root is:

`game/`

This is authoritative for UOMD and is declared in:

`project.yaml → project.code_root`

Do not default to `src/`.

Skills and hooks should resolve `project.code_root` before applying generic
engine conventions.

## Legacy boundary

The historical project is not stored in `game/` or under a GitHub `LEGACY/`
directory.

Canonical external legacy archive:

Google Drive folder ID:
`1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy`

The Drive archive is read/reference material and remains untouched.
