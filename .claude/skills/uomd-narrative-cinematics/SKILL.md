---
name: uomd-narrative-cinematics
description: Implement the Unaware of My Demise visual novel and cinematic runtime (PrologueScreenController, StoryScreenController, StoryRunner, SubtitleSynchronizer, UomdCutscene, AudioDirector voice/BGM) on Unity 6 LTS UI Toolkit for Part I.
---
# Narrative and cinematics (`Uomd.Narrative`)

- Canon authority is `narrative/`; compiled scenes are data (`StreamingAssets/uomd_base/story/*.json`, `entry/prologue.json`) validated by `@uomd/content-schema` and exported via `npm run export:unity`. The Unity 6 runtime (`Uomd.Narrative`) executes only the closed command grammar — never code from downloaded data.
- Entry contract: Prologue and tutorial cutscenes (`T-1`, `T-2`, `T-3`) expose the normal-speed Auto read toggle and hide Skip on a first viewing (Skip appears only in Editor/development builds or after scene completion is recorded). Tutorial cutscenes play without BGM by owner decision; the 116 Japanese VO lines live in `StreamingAssets/uomd_base/voices/` with timings in `presentation/presentation.json`.
- Runtime: `StoryRunner` (engine-free, closed command grammar) drives `StoryScreenController`; `PrologueScreenController` plays the plates; `UomdCutscene` holds the hold/pause/characters-per-second rules (tests from the TS cases); `SubtitleSynchronizer` paces subtitles to the voice line from `AudioDirector`. Port missing directives from `e918b723^:apps/game/src/scenes/StoryScene.ts` / `PrologueScene.ts`; there is no VideoPlayer path yet.
- Continuity (R09): account + release + scene/line checkpoints (`POST /api/v1/story/checkpoint`) must survive app restart; never reset a player's entry progress outside development builds.
- Change generated content through `tools/build_content.ts` + `npm run export:unity` and prove reproducibility with `npm run check:content`.
