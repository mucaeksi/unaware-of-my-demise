# Mevcut hikâye kayıtlarına erişim

Bu indeks depodaki mevcut runtime hikâye kayıtlarını listeler. **Legacy Narrative orijinal kapsamı henüz okunmadı; bu mevcut runtime kaydıdır.** Özgün hikâye/canon belgelerinin okunduğu, güncelliğinin karşılaştırıldığı veya bütünüyle taşındığı iddia edilmez.

Hikâye metinleri, olaylar ve karakter geçmişleri burada özetlenmez veya yeniden yazılmaz. JSON kaynakları çoğaltılmaz; yalnız mevcut başlıklar, kimlikler ve sayımlar listelenir.

Ana kaynak: [story_script_part1_manifest.json](../../game/data/content/story_script_part1_manifest.json). `chapter_files` bölüm dosyalarını, `story_order` oynatma sırasını belirler.

Kapsam: **7 bölüm scripti**, **51 story_order kaydı**, **35 stage sahnesi**, **16 stage dışı sahne**, **409 benzersiz ana hikâye line_id**. Companion story kataloğunda ayrıca **20 karakter / 76 bölüm** vardır; bunlar ana manifestteki 51 kayda dahil değildir.

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
- [Karakter indeksi](../characters/INDEX.md), [görsel karakter briefleri](../../game/data/content/character_visuals_part1.json), [mekân/görsel briefler](../../game/data/content/visual_assets_part1.json), [marka/simge kayıtları](../../game/data/content/brand_assets_part1.json). Planlanan yollar varlık bulunduğunu veya runtime bağlantısını kanıtlamaz.
- [Legacy audit](../../docs/LEGACY_AUDIT.md), [migration ledger](../../docs/MIGRATION_LEDGER.md), [hikâye/karakter bilgi kaydı şablonu](../../docs/coder/STORY_CHARACTER_TEMPLATE.md).

## Tüketiciler ve bütünlük

- [StoryIndex](../../game/scripts/app/story_index.gd) manifest/bölümleri okur; [StoryDirector](../../game/scripts/ui/story_director.gd) ekran sırasını yönetir. [VnScreen](../../game/scripts/ui/vn/vn_screen.gd) mevcut haliyle text_en, konuşmacı ve duyguyu gösterir; portre/background placeholder kullanır ve voice_track/müzik alanlarını ses dosyasına bağlamaz.
- Konuşmacı kimlikleri oynanabilir karakterlerle sınırlı değildir; iç ses, narration/narrator, NPC ve antagonist kimlikleri kaynaklarda olduğu gibi korunur.
- [Runtime içerik manifesti](../../game/data/content/MANIFEST.json) **27 JSON dosyasının** boyut ve SHA256 değerini kaydeder. Tarif ettiği `tools/sync_godot_content.py` aracı ve kaynak `content/` ağacı mevcut checkout içinde yoktur. [İçerik bütünlük testi](../../game/tests/unit/test_content_copy.gd) dosya kümesi, hash, boyut ve JSON parse sonuçlarını doğrular.
- [Kilitli referans manifesti](../references/REFERENCE_SET.lock.json) ve [kilit kuralları](../../docs/UOMD_REFERENCE_LOCK.md) ayrı korunur. Bu indeks runtime kayıtlarını veya kilitli referansları değiştirmez.
