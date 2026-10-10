---
name: phaser4-chibi-animation
description: Produce or integrate anime chibi characters, Spine and Live2D assets, layered portraits, skill cut-ins and combat VFX for Phaser 4.
---
# Character media pipeline
- Canon character identity is defined in `narrative/`. Every asset has stable character ID and visual reference manifest.
- Google AI may generate drawings, layers and references; a flat PNG is not an automatically rigged Spine or Live2D model.
- Verify Spine editor/runtime version, binary format licensing and Phaser 4 compatibility before selecting a production rig format.
- Validate Live2D Cubism licensing, web SDK support, renderer mixing, alpha compositing and Android/iOS WebView performance.
- Prefer atlases and sprite sheets where they meet quality/performance targets; avoid requiring both Spine and Live2D for every asset.
- Standard states: idle, enter, attack, skill, hit, buff, defeat, victory and narrative expression transitions.
- Asset acceptance: consistent face, costume, proportions, alpha fringe, pivot positions, correct animation events and frame time.
