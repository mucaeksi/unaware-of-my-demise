# Narrative — hikâye ve karakter kaynakları

Bu alan, Unaware of My Demise'in mevcut hikâyesini, karakter tasarımlarını,
canon kararlarını ve yaratıcı üretim kaynaklarını korur. Runtime verileri
`game/data/content/` altında kalır; burada kaynak belgeler ve erişim indeksleri
yer alır. Aktarım, yeni hikâye yazılması veya yeni görsel/ses üretimi değildir.

## Mevcut içerik

| Alan | İçerik | Giriş |
|---|---|---|
| Ana hikâye | 7 bölüm; 51 hikâye sırası girdisi, 35 stage sahnesi; 409 ana hikâye `line_id` kaydı | [Hikâye indeksi](story/README.md) |
| Karakterler | 20 oynanabilir karakter; görsel brief, karakter hikâyesi ve ses repliği tanımları | [Karakter indeksi](characters/INDEX.md) |
| Onaylı referanslar | Fadyme, logo/key art, orman ve pilot ikonlar; 26 kilitli dosya | [Referans seti](references/README.md) |
| Referans promptları | R01–R23 üretim promptları | [Kaynak prompt](prompts/reference_set/REFERENCE_SET_PART1.md) |
| Legacy kaynak aktarımı | Önceki denetimde saptanan özgün belgeler ve henüz tamamlanmamış aktarım | [Aktarım kaydı](migration/README.md) |

Ana hikâye ve karakter tanımları zaten GitHub'dadır. `characters/`,
`approved/` ve `generated/` içindeki başlangıç README'leri, bütün karakter
çizimlerinin veya ses kayıtlarının tamamlandığının kanıtı değildir. Özgün
Legacy Narrative belgelerinin güncel kapsamı Drive'dan okunarak doğrulanmalıdır.

## Kaynakların yerleşimi

Drive'daki gerçek dosya ağacı ve belge ilişkileri doğrulandıktan sonra yazılı
canon kararları `canon/`, hikâye belgeleri `story/`, lore belgeleri `lore/`,
karakter paketleri `characters/<character_id>/` altında düzenlenir. Mevcut
Legacy prompt, `art/`, `audio/` ve `tools/` adlandırmaları uyumlu oldukları
ölçüde korunur. Her eski → yeni yol eşlemesi aktarım manifestine yazılır;
bu hedefler, henüz indirilmemiş kaynak dosyaların burada bulunduğu anlamına gelmez.

## Koruma kuralları

- [Canon ve kaynak kuralları](../CLAUDE.md) ile
  [yaratıcı pipeline kararı](../docs/DECISIONS.md) geçerlidir.
- Kilitli referanslar ve [hash kaydı](references/REFERENCE_SET.lock.json)
  korunur. Eski sidecar yolları kilitli dosyada değiştirilmez; eşleme ayrı
  aktarım kaydında tutulur.
- `character_id`, `scene_id`, `line_id`, `location_id` ve `asset_id` korunur.
  Konuşmacı takma adları veya NPC kimlikleri kanıt olmadan yeniden adlandırılmaz.
- Kaynak metinler yeniden yazılarak taşınmaz. Birbiriyle çelişen veya eski
  belgeler kaynak sürümü ve mevcut onay kaydıyla birlikte tutulur.
- Bir dosyanın bu alana alınması, oyuna/AAB'ye eklenmesi veya onaylanması
  anlamına gelmez. Runtime'a terfi ayrı doğrulama gerektirir.

Bu indeksler 2026-10-04'te mevcut repo içeriğinden hazırlandı. O tarihte bu
oturumun Google Drive okuma araçları açılmadığından, eksik özgün Narrative
belgeleri indirilmiş veya ayrıntılı incelenmiş olarak işaretlenmedi.
