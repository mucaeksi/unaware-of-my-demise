# Hikâye kaynakları ve runtime indeksi

Özgün Narrative metinleri ve JSON'ları BATCH-0005 ile kaynak izleri korunarak aktarıldı. Hikâye yeniden yazılmadı; oyun paketleri değiştirilmedi.

- [STORY_BIBLE_PART1.md](STORY_BIBLE_PART1.md): güncel Narrative kopyası.
- [PART1_FULL_SCRIPT.md](PART1_FULL_SCRIPT.md): özgün tam okunabilir script; yeniden compile edilmedi.
- [VILLAIN_BIBLE_PART1.md](VILLAIN_BIBLE_PART1.md): antagonist tasarımları.
- [Canon](../00_Canon/README.md), [lore](../05_Codex_Lore/README.md), [karakter paketleri](../06_Characters/INDEX.md).
- [Özgün sahne/line JSON kaynakları](../09_VN_Scripts/README.md); aşağıdaki tablo mevcut runtime kayıtlarına bağlanır.
- [Tarihî arşiv](../13_Archive/): tarihsel karşılaştırma; aktif kopyanın yerine kullanılmaz.

İki tarafta **7 bölüm**, **51 story_order**, **35 stage** ve **16 stage dışı sahne**. 10 Ekim 2026 kontrolünde özgün kaynak ve runtime **419/419** ana hikâye line_id taşır; metin/konuşmacı/voice track farkı yoktur. [Güncel kontrol](../12_Production_Notes/Collection_2026-10-10/SOURCE_RUNTIME_STATUS.json). Önceki 409/10 eksik replik bulgusu [tarihî fark raporunda](../12_Production_Notes/Migration_Audits/RECONCILIATION.md) korunur. Companion kapsamı **20 karakter / 76 parça**; ses repliği kataloğu **220 kayıt**. Stable ID ve konuşmacı alias'ları değiştirilmedi.

## Bölüm ve stage kaynakları

Başlık/katalog kimlikleri [chapters_part1.json](../../game/data/content/chapters_part1.json) dosyasından, script kimlikleri ilgili bölüm dosyasından alınmıştır. Stage oynanış kayıtları [stages_part1.json](../../game/data/content/stages_part1.json) dosyasındadır. Tablodaki stage listesi oynatma sırasının yerine geçmez.

| Bölüm / katalog başlığı | Katalog chapter_id | Script chapter_id | Stage kayıtları | Kaynak script |
|---|---|---|---|---|
| 1 — Whispering Ash Forest | `ch01_whispering_ash_forest` | `ch01_whispering_ash_forest` | `1-1`, `1-2`, `1-3`, `1-4`, `1-5` | [story_script_ch01.json](../../game/data/content/story_script_ch01.json) |
| 2 — The Ruined Cathedral of Saint Luthos | `ch02_ruined_cathedral` | `ch02_ruined_cathedral_of_saint_luthos` | `2-1`, `2-2`, `2-3`, `2-4`, `2-5` | [story_script_ch02.json](../../game/data/content/story_script_ch02.json) |
| 3 — Oakhaven, the Red Harvest | `ch03_oakhaven_red_harvest` | `ch03_oakhaven_red_harvest` | `3-1`, `3-2`, `3-3`, `3-4`, `3-5` | [story_script_ch03.json](../../game/data/content/story_script_ch03.json) |
| 4 — The Subterranean Undercity | `ch04_subterranean_undercity` | `ch04_subterranean_undercity` | `4-1`, `4-2`, `4-3`, `4-4`, `4-5` | [story_script_ch04.json](../../game/data/content/story_script_ch04.json) |
| 5 — The Bridge of the Forsaken | `ch05_bridge_of_the_forsaken` | `ch05_bridge_forsaken` | `5-1`, `5-2`, `5-3`, `5-4`, `5-5` | [story_script_ch05.json](../../game/data/content/story_script_ch05.json) |
| 6 — The Ashen Lord's Estate | `ch06_ashen_lord_estate` | `ch06_ashen_lord_estate` | `6-1`, `6-2`, `6-3`, `6-4`, `6-5` | [story_script_ch06.json](../../game/data/content/story_script_ch06.json) |
| 7 — The Altar of the First Eclipse | `ch07_altar_first_eclipse` | `ch07_altar_first_eclipse` | `7-1`, `7-2`, `7-3`, `7-4`, `7-5` | [story_script_ch07.json](../../game/data/content/story_script_ch07.json) |

Bölüm 2 ve 5 için katalog/script kimlikleri farklıdır; kaynak değerleri korunmuş, tek kimliğe dönüştürülmemiştir. Açılış, yol/kamp ve diğer stage dışı sahnelerin kayıtları ilgili scriptlerde ve ana manifestte bulunur.

## İlişkili kataloglar

- [Karakter companion story kayıtları](../../game/data/content/character_stories_part1.json): character_id, story_id, açılma koşulları ve line_id.
- [Lore metinleri](../../game/data/content/lore_text_part1.json): stable ID ile indekslenmiş silah, düşman, item, codex, banner ve bölüm kartı metinleri.
- [Karakter ses replikleri](../../game/data/content/character_voice_lines_part1.json): ana bölüm repliklerinden ayrı tetikleyici/replik kataloğu.
- [Karakter indeksi](../06_Characters/INDEX.md), [görsel karakter briefleri](../../game/data/content/character_visuals_part1.json), [mekân/görsel briefler](../../game/data/content/visual_assets_part1.json), [marka/simge kayıtları](../../game/data/content/brand_assets_part1.json). Planlanan yollar varlık bulunduğunu veya runtime bağlantısını kanıtlamaz.
- [Legacy audit](../../docs/LEGACY_AUDIT.md), [migration ledger](../../docs/MIGRATION_LEDGER.md), [hikâye/karakter bilgi kaydı şablonu](../../docs/coder/STORY_CHARACTER_TEMPLATE.md).

## Tüketiciler ve bütünlük

- [StoryIndex](../../game/scripts/app/story_index.gd) bölüm/manifestleri; [StoryDirector](../../game/scripts/ui/story_director.gd) akışı okur. Güncel [VnScreen](../../game/scripts/ui/vn/vn_screen.gd) AssetResolver/AudioDirector bağlantılarını içerir; Narrative kaynaklarının burada olması aktif asset dosyalarının AAB/PCK içinde bulunduğunu kanıtlamaz.
- Konuşmacı kimlikleri oynanabilir karakterlerle sınırlı değildir; iç ses, narration/narrator, NPC ve antagonist kimlikleri kaynaklarda olduğu gibi korunur.
- [Runtime içerik manifesti](../../game/data/content/MANIFEST.json) 27 JSON için boyut/SHA-256 kaydıdır; güncel araç [tools/content_manifest.py](../../tools/content_manifest.py). Runtime kaynakları bu aktarımda korunur; [bütünlük testi](../../game/tests/unit/test_content_copy.gd) mevcut paketi doğrular.
- [Kilitli referans manifesti](../14_References/REFERENCE_SET.lock.json) ve [kilit kuralları](../../docs/UOMD_REFERENCE_LOCK.md) ayrı korunur. Bu indeks runtime kayıtlarını veya kilitli referansları değiştirmez.
