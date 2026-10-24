---
name: uomd-narrative-cinematics
description: Implement the Unaware of My Demise visual novel and cinematic runtime (PrologueStageController, StoryStageController, PortraitRigView, SubtitleClockSynchronizer, VideoPlayer cutscenes, Chirp 3 HD voice, Lyria BGM) on Unity 6 LTS URP 2D + UI Toolkit for Part I.
---
# Narrative and cinematics (`Uomd.Narrative`)

> **Reality check (2026-10-24):** project class names in this skill that are not listed in `uomd-unity-engine` → *Verified assembly and type inventory* are planned designs, not existing code. Verify with `rg` before referencing them.

- Canon authority is `narrative/`; compiled scenes are data (`StreamingAssets/uomd_base/story/*.json`, `entry/prologue.json`) validated by `@uomd/content-schema` and exported via `npm run export:unity`. The Unity 6 runtime (`Uomd.Narrative`) executes only the closed command grammar — never code from downloaded data.
- Entry contract: Prologue and tutorial cutscenes (`T-1`, `T-2`, `T-3`) expose the normal-speed Auto read toggle and hide Skip on a first viewing (Skip appears only in Editor/development builds or after scene completion is recorded). Tutorial cutscenes play without BGM by owner decision; the 116 Japanese VO lines live in `StreamingAssets/uomd_base/voices/` with timings in `presentation/presentation.json`.
- Subtitles (`SubtitleClockSynchronizer`) lock directly to `AudioSource.timeSamples / clip.frequency` on the voice channel; stage directives (`fade`, `flash`, `shake`, `tint`, `mask`, `tween`, `video_id`) map onto the Unity 6 URP 2D stage (`PortraitRigView`, `UnityEngine.Video.VideoPlayer`) and `CameraShakePivot`.
- Continuity (R09): account + release + scene/line checkpoints (`POST /api/v1/story/checkpoint`) must survive app restart; never reset a player's entry progress outside development builds.
- Change generated content through `tools/build_content.ts` + `npm run export:unity` and prove reproducibility with `npm run check:content`.
