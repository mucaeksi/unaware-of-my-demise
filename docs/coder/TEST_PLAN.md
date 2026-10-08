# TEST PLAN

## 1. Baseline
- repository opens
- Godot project imports
- project runs
- known baseline tests recorded

## 2. Migration Validation
For every batch:
- file exists at destination
- references updated
- import succeeds
- no unexpected missing resource
- targeted tests pass

## 3. System Tests
At minimum where applicable:
- core lifecycle
- character creation/loading
- movement
- interaction
- scene transitions
- combat and damage
- inventory/items
- quests
- dialogue
- progression
- save/load
- UI
- audio playback
- animation
- networking/server integration

## 4. Content Tests
- character assets appear correctly
- portraits/sprites resolve
- voice files play correctly
- music/SFX load correctly
- dialogue references valid voice/character entries
- quests reference valid actors/items/locations

## 5. Build / Export
- clean checkout build
- clean import
- target export(s)
- runtime smoke test

## 6. Regression Gate
No milestone is complete until previously validated functionality remains green.

## Evidence
For every completed test record:
- command/action
- result
- date/time
- affected build/commit
- failure details if any
