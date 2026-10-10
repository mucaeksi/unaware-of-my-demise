---
name: phaser4-narrative-cinematics
description: Implement the visual novel and cinematic engine for Part I, including the 120-second Google-generated anime opening and three-part tutorial.
---
# Narrative-first cinematic engine
- Use `narrative/` files as canonical script authority; validate speaker IDs, chapters, spoilers and voice maps.
- Build compiled versioned dialogue commands for background, portrait, expression, text, audio, music, subtitling, branching, pause and battle triggers.
- The renderer must never execute arbitrary script code embedded in downloaded narrative data.
- Cutscene playback requires skip, replay, resume, subtitle/audio alignment, mute, platform autoplay handling and video codecs compatible with mobile webviews.
- Opening target: ~120 seconds. Tutorial: three story portions with interleaved cinematic scenes and combat; exact plot from Narrative.
- Test interruption, patch swaps, locale switching, missing voice fallback, replay after skip and offline cached content.
