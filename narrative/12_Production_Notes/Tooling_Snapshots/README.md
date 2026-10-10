# Korunan Legacy üretim araçları

13 aktif kaynak scripti korundu: image/batch/art review/manifest/asset plan, music/audio, VO audition/record/split/JP script ve narrative compile. AST syntax kontrolü yapıldı; araçlar **çalıştırılmadı**.

Bu klasör kaynak koruma içindir. Mevcut GitHub düzeni, secret injection, API/model kararı, dosya yolları, approval flow ve output registry adaptasyonu tamamlanmadan üretim komutu çalıştırma. `compile.py` özgün `docs/PART1_FULL_SCRIPT.md` yolunu bekler; yeni hedef `story/PART1_FULL_SCRIPT.md` olduğundan bu da açık adaptasyon işidir. Özgün kaynak kodu byte-exact tutmak için sessizce düzeltmedik.

`.secrets/` ve `__pycache__/` hiç açılmadı/taşınmadı. `tools/archive/` içindeki one-off authoring scriptleri kaynakta “Do not run” olarak işaretlidir ve Drive'da bırakıldı. Mevcut pipeline adlandırma ve metadata kuralları [art kaynaklarında](../art/LEGACY_README.md) korunur.
