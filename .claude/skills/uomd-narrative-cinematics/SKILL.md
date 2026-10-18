---
name: uomd-narrative-cinematics
description: Implement the Unaware of My Demise visual novel and cinematic runtime (PrologueScene, StoryScene, NarrativeStage, subtitles, voice, music) on the PixiJS v8 stage for Part I — the ~120-second opening and the T-1/T-2/T-3 tutorial scenes.
---
# Narrative and cinematics

- Canon authority is `narrative/`; compiled scenes are data (`content/base/story/*.json`, `entry/prologue.json`) validated by `@uomd/content-schema`. The runtime executes only the closed command grammar — never code from downloaded data.
- Entry contract: prologue and tutorial cutscenes have the normal-speed Auto read toggle and no Skip on a first viewing (Skip appears only on the dev server or after completion). Tutorial cutscenes currently play without BGM by owner decision; the 116 Japanese VO lines live in `content/base/voices` with timings in `presentation/presentation.json`.
- Subtitles follow the voice audio clock (`ui/subtitles.ts`); stage directives (fade, flash, shake, tint, masks, tweens) map onto the PIXI stage and camera.
- Continuity (R09): account + release + scene/line checkpoints must survive restart; never reset a player's entry progress outside `isDevServer()`.
- Change generated content through `tools/build_content.ts` and prove it with `npm run check:content`; authored media (voices/, presentation/, Lyria tracks) is preserved by the builder.
