---
name: phaser4-narrative-cinematics
description: Implement the visual novel and cinematic engine (`PrologueScene`, `StoryScene`, `NarrativeStage`, `SubtitleOverlay`) on PixiJS v8 + DOM UI for Part I, including the 120-second anime opening and three-part tutorial.
---
# Narrative-First Cinematic Engine (PixiJS v8 Stage + Synchronized Subtitles)
- Use `narrative/` files as canonical script authority; validate speaker IDs, chapters, spoilers and Gemini 3.8 TTS voice maps (`Algieba`, `Sulafat`, `Iapetus`).
- Execute compiled versioned dialogue commands for 16:9 background plates, knee-up `boydan` portraits, expressions, stage directives (camera shake, flash, fade, tint, masks, tweens), audio, Lyria 3.5 music, synchronized `SubtitleOverlay`, branching choices and battle triggers.
- The renderer must never execute arbitrary script code embedded in downloaded narrative data.
- Cutscene playback requires Auto reading toggle, replay, durable account/release-scoped checkpoint resume, real-time audio-clock subtitle synchronization, mute, platform autoplay handling and video/plate fallback compatible with mobile WebViews.
- Opening target: 9-shot ~120 seconds (`PrologueScene`). Tutorial: three story portions (`T-1`, `T-2`, `T-3`) with interleaved cinematic scenes and tactical combat; exact plot from `narrative/`.
- Test interruption, patch swaps, locale switching, missing voice fallback, replay and offline cached content.
