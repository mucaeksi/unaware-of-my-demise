# Legacy Narrative aktarım kaydı

Hedef: GitHub projesinin `main` dalındaki `narrative/` alanı.
Kaynak: [Google Drive LEGACY](https://drive.google.com/drive/folders/1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy),
Narrative klasör kimliği `1Xw7Hqw4RDdeYeaiJiaX_Rjt9bbcxuXkK`.

## Güncel durum — 2026-10-04

**Özgün Narrative aktarımı tamamlanmadı.** Google Drive eklentisi kurulum
isteği onaylandı; fakat bu oturumda çağrılabilir Drive okuma araçları henüz
açılmadı. Bu nedenle aşağıdaki liste canlı Drive envanteri değildir.
[Önceki Legacy denetimindeki](../../docs/LEGACY_AUDIT.md) kaynak kimlikleri,
yeniden erişimde gerçek parent/yol/sürüm/boyut/içerik doğrulaması yapılması
gereken başlangıç kayıtlarıdır.

Mevcut repo malzemesinin erişim indeksleri hazırlandı:
[hikâye](../story/README.md), [karakterler](../characters/INDEX.md) ve
[onaylı referanslar](../references/README.md). 26 kilitli referans dosyasının
ve runtime manifestindeki 27 JSON'un SHA-256/boyut kontrolleri geçti.
Bu kontrol, Drive'daki dosyaların güncel sürümlerini doğrulamaz.

## Yeniden açılacak özgün kaynaklar

| Belge | Önceki denetimde kaydedilen Drive kimliği | Aktarım durumu |
|---|---|---|
| `canon.md` | `1xo3hj0OBhb91MI5wGWBW3YiQty14gAYA` | İndirilecek; tam Legacy yolu önceki kayıtta belirsiz |
| `STORY_BIBLE_PART1.md` — Narrative kopyası | `10zXNEUnkoJN-vclQVB9DVRWHlHTujJlZ` | İndirilecek; diğer kopyayla karşılaştırılacak |
| `STORY_BIBLE_PART1.md` — diğer kopya | `1Rs9h7NuQcPyeUzlV9pqpR1NCDnc9vWNc` | Canon/onay ve fark incelemesi gerekli |
| `ART_BIBLE.md` | `1RBVeqCVo-UZ98TIokryrFxR75BLIIO0r` | İndirilecek |
| `CHARACTER_COSTUME_GUIDE.md` | `18oJBN2Shj51s3mrYWTp0bzXj2u27zIcn` | İndirilecek |
| `ASSET_CATALOG.md` | `1bWte1djufNhSPs08xzT3dAart2xDQemA` | İndirilecek; pipeline ile eski/yeni durum karşılaştırılacak |
| `NARRATIVE_TECH_HANDOFF_PART1.md` | `1Ci8LP5_mqPveryD8jRaxIaEPV0DKkBnr` | İndirilecek; güncel runtime ile karşılaştırılacak |
| `music_part1.md` | `1cA2p_5ZEr0uA5OiKlWUcWkEvTQJ_YVHx` | İndirilecek |
| `jp_script_fadyme.json` | `1vbLtA_j2w_UoS7kZk-lkOPXk_5IYjMOw` | İndirilecek; `line_id` ve kayıt ilişkileri korunacak |
| `registry.md` | `1wTcW8jWwypHHtIsKFc0HkYBnSVX8Q1pZ` | İndirilecek; gerçek parent/yol doğrulanacak |
| `_registry.md` | `1I-dJv0jqTtWHZJjtsSrppMFm7f5-Habf` | İndirilecek; ayrı belgenin anlamı okunarak belirlenecek |
| Narrative `tools/` klasörü | `1YmYFXq9veTMvw41piOoAcFE9fIe3PX4Z` | Tam dosya listesi ve kaynak kodlar incelenecek |

İlgili Part I GDD'nin kayıtlı kimliği
`17pi9ULybDLxKHaRtzQoUhlXaSLql_ZHn`; Narrative klasörü dışında bulunan
bu belge, kaynak ilişkileri incelenirken başvurulacak tamamlayıcı malzemedir.
Bu tablo Narrative'in tüm karakter/lore/prompt/üretim dosyalarını kapsamaz.

## Aktarımın tamamlanma koşulları

1. Narrative ağacı tüm listeleme sayfalarıyla gezilir. Klasörler, dosyalar,
   aynı adlı kopyalar, gerçek parent/yollar, MIME, boyut ve sağlayıcının
   sunduğu sürüm/checksum bilgileri kaydedilir. `.secrets/` içerikleri açılmaz
   ve Git'e alınmaz; build/cache gürültüsü aktarılmaz.
2. Hikâye/canon/art/kostüm/lore/karakter kaynakları tam okunur. Mevcut runtime
   tanımlarıyla farklar, onay durumu ve çözümlenmemiş canon soruları kaydedilir.
   Güncelleme tarihi tek başına canon önceliğini belirlemez.
3. Kaynak dosyalar kayıpsız indirilir. Drive ID, doğrulanan Legacy yolu,
   GitHub hedefi, kaynak boyutu/hash'i, hedef hash'i, dönüşüm ve doğrulama
   kaydedilir. Git'in satır sonu normalizasyonu da açık bir dönüşümdür;
   byte-exact iddiası yalnız doğrulanan Git blob'u için kullanılır.
4. Zaten taşınmış referanslar [mevcut lock'a](../references/REFERENCE_SET.lock.json)
   bağlanır. PNG `uomd_*` metadata ve ses sidecar'ları korunur. Onaylı, taslak,
   reddedilmiş ve superseded malzeme kaynakta kanıtlanan durumuyla ayrılır.
   Büyük/tekrarlı geçmiş dosyalar için ayrı transfer kararı ve envanter tutulur.
5. Yeni per-file manifest `docs/migration/` altında kaydedilir;
   [migration ledger](../../docs/MIGRATION_LEDGER.md) gerçek aktarım tamamlandığında
   güncellenir. Eksik kaynak için `MIGRATED` veya yeni batch tamamlandı kaydı açılmaz.
6. İndeks bağları, JSON/metadata tutarlılığı, kilitli referans bütünlüğü ve
   Git diff kontrol edilir. Doğrulanmış aktarım GitHub `main` dalına gönderilir.

Legacy orijinalleri Drive'da taşınmaz, yeniden adlandırılmaz veya değiştirilmez.
Bu görev sırasında yaratıcı üretim araçları çalıştırılmaz ve mevcut hikâye,
karakter tasarımı veya onay kararları yeniden oluşturulmaz.
