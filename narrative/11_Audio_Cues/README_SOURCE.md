# Ses ve müzik kaynakları

- [AUDIO_VO_PLAN_PART1.md](AUDIO_VO_PLAN_PART1.md): VO ve cue kapsamı.
- [Fadyme JP script](voice/jp_script_fadyme.json): 201 line_id; **DRAFT / native JP editor review pending**.
- [Fadyme seçim kaydı](voice/fadyme/selection.json): 25 seçilmiş take. Aynı line_id'li OGG'ler `voice/fadyme/fadyme/` ve `voice/fadyme/fadyme_thought/` altında; source layout korunur. Sesleri bu taşıma sırasında yeniden üretmedik veya editör onaylı saymadık.
- [Casting](../references/fadyme/voice/casting.json), [referans ses](../references/fadyme/voice/Fadyme_Sulafat_11_satir.mp3) ve [Fadyme tema paketi](../references/fadyme/README.md): önceden kilitli kaynaklar.
- `music/bgm_ch1_ash_forest/`: onaylı calm/uneasy/chaotic loop OGG + JSON.
- `music/bgm_battle_field/`: onaylı v002 loop OGG + JSON; sidecar pitch/loop offset değerleri aynen korunur.
- [Müzik promptları](../prompts/music/music_part1.md).

Raw take'ler, reddedilmiş seçmeler ve original MP3'ler Drive'da kalır; envanterde `LEAVE_IN_DRIVE`. Loop sidecar'larının `original` alanları tarihsel kaynak yoludur; transfer manifesti original Drive kimliğini de kaydeder. Her sidecar alanını yerel asset varlığı gibi varsayma.

Ana tema kullanıcıya aittir. Narrative kaynağı burada bulunması AAB/PCK'ye girdiğini göstermez; AssetResolver/AudioDirector'a terfi ayrı adım. [Kapsam ve eksikler](../migration/RECONCILIATION.md).
