# Legacy Narrative aktarım kaydı

Hedef: GitHub `main/narrative/`. Kaynak [LEGACY](https://drive.google.com/drive/folders/1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy), Narrative ID `1Xw7Hqw4RDdeYeaiJiaX_Rjt9bbcxuXkK`.

## Güncel durum — 2026-10-05 / BATCH-0005

**Seçili Narrative kaynakları aktarıldı.** Bağlı Google Drive araçlarıyla gerçek ağaç yeniden listelendi: **558 kayıt / 488 dosya / 70 klasör**. 68 klasör tam listelendi; `.secrets/` ve `__pycache__/` içlerine girilmedi. Önceki tam indirmeler, güncel kimlik/yol/boyut/modifiedTime ve yerel hash değişmediği doğrulandıktan sonra kullanıldı; canon ve Story Bible ayrıca yeniden indirildi.

- **163 yeni dosya / 38.070.780 byte:** canon ve lore, Story Bible + full script + villain bible, 13 özgün JSON, art/audio/prompt/teknik kaynaklar, 13 araç, mevcut/pending sheet ve chibi referansları, 25 seçilmiş VO, 4 ek onaylı müzik loop'u; supplemental root GDD dahil.
- **26 ALREADY_MIGRATED:** mevcut kilitli referanslara aynı yollarıyla bağlı; yeniden kopyalanmadı/değiştirilmedi.
- **300 LEAVE_IN_DRIVE:** tarihsel görsel/belge tekrarları, rejected/raw take/original ve mevcut görev için gereksiz dosyalar; kimlik/yollar ve karar gerekçesi manifestte.
- **68 INVENTORY_FOLDER / 2 EXCLUDE_SUBTREE**.

Bu, Legacy arşivinin tamamının GitHub'a kopyalandığı anlamına gelmez. Tam seçme kararları [per-file manifestte](../../docs/migration/BATCH-0005.manifest.json); hash/boyut/Drive ID/parent/original path/target path/statü/Git blob ve dönüşüm kayıtları her taşınan dosya için ayrı. Connector checksum/version alanlarını vermedi; “provider verified” gibi bir iddia yapılmadı. Yerel byte hash ve Git blob doğrulandı. Stream download bearer URL veya session download path'i provenance'e yazılmadı.

## Başlangıç belgeleri

- [Canon](../canon/canon.md), [Story Bible](../story/STORY_BIBLE_PART1.md), [tam script](../story/PART1_FULL_SCRIPT.md), [villain bible](../story/VILLAIN_BIBLE_PART1.md).
- [Art Bible](../art/ART_BIBLE.md), [Costume Guide](../art/CHARACTER_COSTUME_GUIDE.md), [asset katalog](../art/ASSET_CATALOG.md).
- [Teknik handoff](../docs/NARRATIVE_TECH_HANDOFF_PART1.md), [VO plan](../audio/AUDIO_VO_PLAN_PART1.md), [JP script](../audio/voice/jp_script_fadyme.json), [müzik promptları](../prompts/music/music_part1.md).
- [Locations registry](../lore/locations/registry.md), [faction registry](../lore/factions/_registry.md), [araçlar](../tools/README.md).
- [Root GDD](../design/Unaware_of_My_Demise_Part1_GDD.md): dış Narrative supplemental kaynak.

## Farklar ve bekleyen içerik işi

[RECONCILIATION.md](RECONCILIATION.md) ve [SOURCE_RUNTIME_DIFF.json](SOURCE_RUNTIME_DIFF.json): 419/409 ana hikâye satırı, 10 eksik line_id, 2 değişen ortak replik, 51/1 music cue alanı, 9 Codex gate ve 40 VO unlock farkı. Bunlar bu aktarımda sessizce kapatılmadı; mevcut JSON'lar korundu. Costume Guide STALE, Nixie sheet issue, pending sheetler ve JP editor review kaynak statülerinde durur.

İki Story Bible/canon kopyası [belge karşılaştırmasında](DOCUMENT_COPY_COMPARISON.json). Aktiflik kanıtı özgün çalışma ve archive açıklamalarıdır; timestamp tek başına öncelik değildir. Source belgelerin tarihsel iç bağlantı/path'leri byte-exact bırakıldı; taşınan target'ı manifest/source index üzerinden bul.

## Doğrulama

[tools/validate_narrative_migration.py](../../tools/validate_narrative_migration.py): 55 korunan dosya, 26 lock, 27 runtime JSON ve içerik sayıları; tüm transfer source/target/Git blob hash/size, JSON/AST syntax ve envanter karar kapsamı. [Son doğrulama raporu](VALIDATION.json) kontrol sonucunu kaydeder. Görsel/ses decode ve yeni indeks linkleri ayrıca kontrol edildi; JP telaffuz veya gerçek cihaz/Godot kabulü yapılmış sayılmaz.

Legacy üzerinde yazma/silme/taşıma yapılmadı; generation araçları çalıştırılmadı. Aktif teknik ekibin runtime ve altyapı değişiklikleri korunur.
