---
name: google-anime-media
description: Coordinate Google-powered anime portraits, chibi references, soundtracks, Chirp 3 HD dialogue, Veo 3.1 Lite cinematics and asset QC with cost control.
---
# Google anime media production
- Canonical art and dialogue content come from `narrative/`; do not hallucinate costumes, identities or scripts as canon.
- All generative source media must use owner-approved Google models. Use current Gemini image capability after validating quotas/terms.
- Music: Lyria 3.5; dialogue: Chirp 3 HD; cinematic source: Veo 3.1 Lite. Lyria is not a replacement for spoken TTS or standalone SFX generation.
- Verify current API availability and whether silent video is natively supported by the selected endpoint; don't assume pricing tiers apply across endpoints.
- Estimate cost before submitting paid batches, enforce quotas and require owner approval on major spending.
- Generated 2D media needs pose consistency, rig/layer preparation, QC, traceable model/prompt versions and asset provenance.
- Never store cloud credentials in GitHub; send generation calls from secure worker/job infrastructure.
