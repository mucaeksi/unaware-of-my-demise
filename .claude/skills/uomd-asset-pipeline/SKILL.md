---
name: uomd-asset-pipeline
description: "Audit, organize, validate, version and promote UOMD creative assets generated through the Gemini development workflow."
---

# UOMD Asset Pipeline

Use this skill when work involves character art, PNG assets, voice clips, music,
reference sets, generated content, metadata, naming/versioning, or promotion to
runtime content.

## Phase 1 — Read project controls

Read:

- `CLAUDE.md`
- `docs/UOMD_PROJECT_CONTEXT.md`
- `docs/UOMD_ASSET_PIPELINE.md`
- `docs/UOMD_REFERENCE_LOCK.md`
- relevant current-state/architecture docs

## Phase 2 — Inspect before inventing

Search the active repository and Google Drive LEGACY for:

- naming scripts
- ID registries
- manifests
- metadata
- generation scripts
- Gemini/AI workflows
- import rules
- versioning
- patch manifests
- old prompts

Do not create a new convention until the old system has been assessed.

## Phase 3 — Generate/organize

Creative generation happens through the configured Gemini development workflow.

Stage sources under:

`narrative/`

Use the canonical Fadyme reference set after it is locked.

## Phase 4 — Validate

Check:

- correct content/character association
- file format
- expected dimensions/aspect ratio
- readability at 1080×1920
- consistency with references
- naming/ID
- metadata/provenance
- duplicate/superseded state
- build/PCK classification

## Phase 5 — Promote

Only after validation:

1. record metadata
2. copy/promote to the production location
3. update content manifest/version
4. ensure references are valid
5. run relevant tests
6. document the promotion
7. commit coherent progress

Never modify Google Drive LEGACY originals.
