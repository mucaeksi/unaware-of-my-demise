---
name: test-setup
description: "Set up and verify the UOMD Godot test harness and cloud/headless validation path."
---

# UOMD Test Setup

This project uses Godot 4.7.2 and GDScript.
Do not offer Unity or Unreal testing paths.

## Test roots

- Unit: `tests/unit/`
- Integration: `tests/integration/`
- Regression/content: repository-defined test locations under `tests/`

## Preferred framework

`gdUnit4` for GDScript unit/integration tests where supported.

## Procedure

1. Read `project.yaml`.
2. Verify Godot 4.7.2.
3. Verify the project can launch headlessly.
4. Verify or install the required test addon only when authorized and absent.
5. Verify the test command.
6. Run a representative test.
7. Record evidence in the appropriate QA documentation.

## Naming

Use:

`[system]_[feature]_test.gd`

with:

`test_[scenario]_[expected]`

## Critical coverage

At minimum the project must test:

- gacha logic
- pity behavior
- currency integrity
- inventory integrity
- idempotency
- auth/authorization
- database migrations
- API validation
- content/asset validation
- patch manifest/hash checks
- regression cases

Never mark a check as passed when the relevant command could not run.
Use `NOT ASSESSED` / `UNVERIFIED` when evidence is unavailable.
