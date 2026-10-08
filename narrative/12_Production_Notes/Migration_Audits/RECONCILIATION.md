# Kaynak / runtime farkları — 2026-10-05

Bu aktarım kaynakları korur; oyun JSON kayıtlarını değiştirmez. Tam dosya alan farkları [SOURCE_RUNTIME_DIFF.json](SOURCE_RUNTIME_DIFF.json), eski/yeni belge kayıtları [DOCUMENT_COPY_COMPARISON.json](DOCUMENT_COPY_COMPARISON.json) içindedir.

## Ana hikâye

- Drive Narrative kaynağı: **419** line_id; runtime: **409**. Sahne sırası iki tarafta 51 kayıttır.
- Ortak line_id için değişen İngilizce replik sayısı: **2**.
- Runtime eksikleri: `ch4_road_006`, `ch6_road_005`, `ch6_road_006`, `node_3_1_post_004`, `node_4_5_post_007`, `node_5_5_post_005`, `node_6_1_post_004`, `node_6_3_post_004`, `node_7_3_pre_007`, `node_7_3_pre_008`.
- Music cue alanı: kaynak **51**, runtime **1**. Cue metadata eşlemesi kaynak ayrıntılarıyla yapılmalı.

## Değişen ortak replikler

| line_id | Özgün Narrative metni | Mevcut runtime metni |
|---|---|---|
| `node_3_5_post_001` | Seven notches. Same wax as the seal on your shield. There are letters beneath it: C.V. | Seven notches. Same wax as the cathedral. There are letters beneath it: C.V. |
| `ch4_camp_006` | East, then. The altar road crosses the ravine. | East, then. The estate schedule is somewhere past the ravine. |

## Yan içerik ve kilitler

- Codex unlock farkı: **9** kayıt. Runtime `always` kaydı canon'ın ilerleme kapısını geçersiz kılmaz.
- Karakter VO unlock alanı: kaynak **40**, runtime **0**. Sahiplik/ilerleme koşulları sessizce kaldırılmamalı.
- Fadyme JP script: **201** line_id; durum: `DRAFT — Narrative & Visual Director; native JP editor review pending`. **25** seçilmiş OGG dosyası selection kaydıyla eşleşti; **176** satırın ayrı seçilmiş sesi yok. Dosya/hash/decode doğrulaması JP telaffuz/editör onayı değildir.

## Canon ve tasarımda korunan açık işler

- Costume Guide kendi başında 15 karakter için STALE uyarısı taşır. Lore karakter modelleri, voice/visual matrix, onaylı sheet ve güncel canon kullanılır.
- Rikka silah betimi ve Hana silah betimi lore / derived visual JSON arasında uyuşmuyor; mevcut dosyalar değiştirilmedi.
- Nixie sheet `APPROVED_WITH_ISSUE`; hair düzeltmesi gerektirir. Sable, Aveline, Nara ve iki antagonist sheet PENDING olarak korundu.
- Brin/Kera mevcut sheetleri korunur; r2 yeniden sunum işleri onaylı mevcut tasarımı değiştirmez.
- Source artifact status ile runtime promotion ayrı kavramlardır. Native giriş/AssetResolver/AudioDirector güncel main içinde var; bu Narrative snapshotlarını otomatik shipped asset yapmaz.

## Belge kopyaları

Aktif Story Bible ve canon ile arşiv kopyaları byte-identical değildir. Aktiflik kanıtı özgün [Narrative çalışma açıklaması](sources/LEGACY_NARRATIVE_README.md) ve [arşiv açıklaması](../archive/LEGACY_README.md) içindedir. Eski belgeler silinmedi; tarih tek başına seçim ölçütü olmadı.

## Sonraki Narrative işi

Kaynak/runtime farkları ayrı içerik terfi değişikliğinde, stable ID ve spoiler/VO/music bağları doğrulanarak kapatılmalı. Bu aktarım sırasında hikâye, karakter veya canon yeniden yazılmadı.
