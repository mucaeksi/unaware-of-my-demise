# Ses ve müzik kaynakları

- [AUDIO_VO_PLAN_PART1.md](AUDIO_VO_PLAN_PART1.md): VO ve cue kapsamı.
- **Onaylı Japonca VO (`content/base/voices/*.ogg`, `content/base/presentation/presentation.json`):** 116 dikey-dilim repliği (`entry_past_001..009` + `tutorial_t1..t3`) Google Gemini 3.8 TTS ile kilitli kanonik kadro (`Algieba` Anlatıcı, `Sulafat` Fadyme, `Iapetus` Mahmut) üzerinden kaydedilmiş ve `apps/game/src/audio/voiceTranscripts.ts` içinde doğrulanmıştır.
- **Kanonik 16 SFX Seti (`content/base/sfx/*.ogg`, [SFX_PROVENANCE.json](SFX_PROVENANCE.json)):** `tools/build_sfx_pack.mjs` ile deterministik olarak üretilen 16 Ogg Vorbis ses efekti (`ui`, `footsteps`, `blades`, `shields`, `bells`, `statuses`, `ultimates`) `content/base/presentation/presentation.json` → `sounds` tablosuna ve `apps/game/src/audio/Sfx.ts` çalışma zamanına bağlanmıştır.
- **Lyria 3.5 Müzik Paketi (`content/base/audio/*.ogg`):**
  - `bgm_main_theme.ogg`: Ana tema (Candidate 3 — 68 BPM Anadolu gotik melankolik rock motifi).
  - `bgm_prologue_before_the_road.ogg`: Prolog ve anıt/katedral sahneleri.
  - `bgm_fadyme_theme.ogg`: Fadyme teması, kamp/yemin ve savaş sonrası samimi sahneler.
  - `bgm_ch1_ash_forest_calm.ogg`, `bgm_ch1_ash_forest_uneasy.ogg`, `bgm_ch1_ash_forest_chaotic.ogg`: Bölüm 1–7 hikâye gerilim kademeleri ve 7 Bölüm Boss karşılaşması.
  - `bgm_battle_field.ogg`: Taktiksel 5v5 saha savaşları.
- [Müzik promptları](music_part1_prompt_REFERENCE_ONLY.md).

Raw take'ler, reddedilmiş seçmeler ve original MP3'ler Drive'da kalır; envanterde `LEAVE_IN_DRIVE`. Loop sidecar'larının `original` alanları tarihsel kaynak yoludur; transfer manifesti original Drive kimliğini de kaydeder. Her sidecar alanını yerel asset varlığı gibi varsayma.
