---
name: setup-engine
description: "Verify and maintain the pinned Godot 4.7.2 project configuration for Unaware of My Demise. This project does not select among engines."
---

# UOMD Godot Setup / Verification

This project is fixed to:

- Godot 4.7.2 Standard
- GDScript
- Android
- portrait
- touch input

Do not ask the user to choose an engine.
Do not propose Unity or Unreal.

## Procedure

1. Read `project.yaml`.
2. Verify `engine.name == Godot`.
3. Verify `engine.version == 4.7.2`.
4. Verify `engine.language == GDScript`.
5. Verify the actual Godot binary/version available in the Cloud Environment.
6. Verify the relevant Godot reference documentation is present.
7. Verify the Godot project file and export configuration if they exist.
8. Verify Android export tooling availability.
9. Verify headless execution is possible.
10. Update project documentation with evidence.

If the installed version differs from 4.7.2:

- do not silently retarget the project
- record the mismatch
- use `CLOUD_DEPENDENCY_GAP` only when the mismatch blocks the required task
- use `DECISION_REQUIRED` if changing the pinned version becomes necessary

## Commands

Prefer headless/cloud validation.
Do not create local-editor dependencies.

A valid Android export preset must be discovered from the actual project before
setting `commands.build` to a concrete preset string. Do not invent the preset.

## Output

Use:

VERIFIED
PARTIALLY_VERIFIED
UNVERIFIED
BLOCKED
DECISION_REQUIRED
CLOUD_DEPENDENCY_GAP

Write findings into `docs/INFRASTRUCTURE_AUDIT.md` or the relevant project doc.
In autonomous mode, perform non-destructive configuration corrections directly
when they are authorized by the active task.
