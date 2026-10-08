# UOMD — Asset Pipeline Specification

## Purpose

This document defines how creative assets are generated, tracked, reviewed,
validated, and promoted for **Unaware of My Demise**.

## Source-of-truth boundaries

- Google Drive LEGACY: historical/reference source
- `narrative/`: creative staging, prompts, references, candidate outputs,
  approved creative packages, and provenance
- active GitHub production paths: validated runtime assets/content and code
- R2: private published patch/content objects

## Reference-first generation

The initial canonical reference set is:

- logo
- key art
- Fadyme sheet
- Fadyme assets
- Fadyme voice
- Fadyme theme

These references are owner-approved before the rest of the visual/audio library
is generated autonomously.

## Generated asset lifecycle

```text
SPECIFICATION
  ↓
GENERATION REQUEST
  ↓
GEMINI OUTPUT
  ↓
CANDIDATE
  ↓
REFERENCE / CANON CHECK
  ↓
TECHNICAL VALIDATION
  ↓
APPROVED
  ↓
METADATA + PROVENANCE
  ↓
PRODUCTION PROMOTION
  ↓
AAB OR PCK
```

## Model consistency

Use one consistent model/configuration per modality whenever possible:

- Images: Nano Banana 2 path through Gemini API
- Voice: one selected mid-tier Gemini TTS configuration
- Music: one selected mid-tier Gemini Lyria configuration

Do not mix models merely for novelty or convenience.

## Naming and IDs

Do not invent a new convention before auditing LEGACY.
If legacy contains working naming/ID/versioning logic, reuse compatible parts.

A final asset must have a stable project identifier independent of a generated
filename where practical.

Example conceptual structure:

```text
narrative/
  references/
    fadyme/
  characters/
    <character-id>/
  generated/
    images/
    voice/
    music/
  approved/
  prompts/
```

The exact naming convention is established only after the LEGACY audit and
current repository inspection.

## Metadata

For generated content, preserve where available:

- content ID
- asset ID
- character/content relationship
- asset type
- version
- generation model/configuration
- prompt or prompt reference
- source/reference set
- created/generated timestamp
- approval state
- replacement/supersession information
- production destination
- base game vs patch classification

## Visual requirements

Gameplay character art:

- PNG
- chibi 2D presentation
- portrait-oriented composition where relevant
- consistent proportions and framing
- readable at mobile scale
- darker/gloomier project language

Narrative art:

- detailed character-sheet / light-novel presentation
- canonical character continuity

## Animation expectations

Do not require 3D rigging for PNG character assets.

Use the most appropriate Godot 2D approach for the actual asset structure:

- Sprite2D / AnimatedSprite2D where frame sequences exist
- AnimationPlayer for transforms/tweens/presentation motion
- layered cutout/puppet techniques when separate parts are available
- shader/VFX assistance where useful

Do not pretend a single flattened PNG is bone-rigged.

## Promotion rules

Creative generation happens in `narrative/` first.
Production promotion requires:

1. canon/reference check
2. technical validity
3. metadata/provenance
4. correct destination
5. version assignment
6. build/PCK inclusion decision

## Legacy protection

Never modify original Drive LEGACY assets.
Never bulk-copy the whole legacy archive into GitHub.
