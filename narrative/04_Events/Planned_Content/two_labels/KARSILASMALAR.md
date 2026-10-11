# İki Etiket — savaş karşılaşmaları

**Tam içerik planı; oynanmış veya dengelenmiş savaş paketi değildir.** Ödüller, enerji ücretleri ve sayı dengesi bu sürümde tanımlanmadı. Düşman türleri mevcut canon’dan; event’e yeni named boss/villain eklenmiyor.

Her encounter 5v5, 2 Front / 3 Rear. Dört odak karakteri gerektiğinde story-loan olarak sunulur; beşinci yer açılmış ücretsiz kadrodan seçilebilir. Oyuncunun dolu beşlisi zorla bozulmaz. Battle loan listesi ve VN scene cast listesi ayrı kalır. Canon’a uygun roster resolver’ın somut Front/Rear önerisi ve loan seviyeleri gelecekteki full-cast dengesiyle bağlanmalı; dört event karakterini tek bir zorunlu diziliş olarak dayatmıyoruz.

## Karşılaşma dizisi

| Düğüm | Tasarım ID | Oynama koşulu | Taktik mesele |
|---|---|---|---|
| B01 | `tl_enc_gate` | Bütün yollar | Bellbound destek tehdidini okumak; erken hedef veya dayanıklılık |
| B02C | `tl_enc_coast_wall` | Kıyı | Arka sıraya ulaşabilen saldırganı fark etmek |
| B03C | `tl_enc_coast_turn` | Kıyı | Bellbound destek ile arka saldırgan arasında öncelik |
| B02L | `tl_enc_load_sheds` | Yük yolu | Sürdürülen ön sıra baskısını karşılamak |
| B03L | `tl_enc_load_cart` | Yük yolu | İki ön tehdide karşı burst/recovery sıralaması |
| B04 | `tl_enc_boundary_clean` | Kit hazırlığı | Ön baskıda ekip istikrarı; mevcut recovery imkanlarını kullanmak |
| B04 | `tl_enc_boundary_scout` | Keşif hazırlığı | İki açık tehdidin hedef sıralaması |
| B05 | `tl_enc_last_lane` | Bütün yollar | Ön dayanıklılık ile arka tehdit yönetiminin birleşimi |

Bir oynanış B01 → iki rota savaşı → bir B04 → B05 içerir. B04’ün iki versiyonu arka arkaya oynatılmaz. Tüm sekiz tasarımın **beş düşman slotu, base unit kimliği, rolü, davranış brief’i, İngilizce savaş brifingi ve karşı hamleleri** [encounters.json](authoring/encounters.json) içinde yazılıdır.

## Temel kurallar

- Ana başarı standard zaferdir. Zorunlu üç yıldız, kesin tur limiti, tek element, özel silah veya karakter şartı yok.
- NPC ve ilaç kasaları görünüm/öykü nesnesidir. Altıncı müttefik, escort HP, ölen hasta, kasa durumu cüzdanı veya dinamik yol kaynakları değildir.
- Threat bütün oyunculara önceden görünür. Keşif seçen oyuncuya bilgi sunmak için diğer hazırlığı seçenin standart intent panelini gizlemiyoruz.
- Hazırlık **farklı, önceden yazılmış encounter kompozisyonunu seçer**. Global karakter statını, sahip olunan item’i, gacha sonucunu veya ana hikâyedeki skill’i değiştirmez.
- Zorunlu yeni geçici buff/tek kullanımlık cleanse item yok. Önceki v0.1’deki temizleme avantajı önerisi, v1’de patch kapsamını küçük tutan encounter seçimine dönüştürüldü.
- Optional mastery metinleri taktik deneme amaçlı öneridir. Hangi condition’ın ölçüleceği combat verifier’a bağlanmadan UI’da kazanılmış sayılmaz. Karşılığında ödül seçilmedi.

## Mevcut grammar ile veri yaklaşımı

Story JSON’ları mevcut grammar ile doğrulandı. Encounter dosyası ise **authoring formatıdır**, mevcut `Encounter` şemasına uygun sayısal üretim dosyası değildir.

Kıyı varyantı için `rear_row_enemies` hedef seçimi ve destek tehdidi için mevcut `damage`, `grant_shield`/`modify_stat` gibi izinli işlemler üzerinden bir düşman varyantı hazırlanabilir. Bunlar engine registry’de görünen primitive’lerdir; fakat ilgili canon düşmanını böyle bir profile derlemek ve gerçek targeting/front-protection davranışını test etmek ayrı iştir. Canon düşmanın genel tanımı sessizce değiştirilmez; event-specific UnitDef/skill varyantları aynı onaylı art key’i kullanır.

Yeni saldırı animasyonu, AI kodu veya doğal dilden effect çıkarma indirilmez. Mevcut motor davranışına uymayan bir brief çıkarsa içerik yayınlanmadan düzeltilir veya gerekli primitive istemci/sunucu sürümünde önceden tamamlanır. “Yama ile gelecek” motorun hiç sahip olmadığı davranışı JSON ile icat etmek anlamına gelmez.

## Sayı dengesi yapılırken kabul şartları

1. 4-5’i yeni bitirmiş ücretsiz kadro + uygun loan ile her rota kazanılabilir olmalı.
2. Ön sırayı koruyan yavaş yaklaşım ve öncelikli hedefi hızlı düşüren yaklaşım birlikte geçerli kalmalı.
3. Kıyı ve yük yolları güç bakımından benzer zorlukta olmalı; biri “kolay ödül” rotasına dönüşmemeli.
4. Aktif okuma/taktik farkı görünmeli; sekiz kopya HP çubuğu olarak kalmamalı.
5. Sunucu replay aynı published event revision, encounter, party ve seed ile doğrulamalı. Battle client’ın hangi rotayı istediği tek başına encounter seçimine yetmez.
6. Mağlubiyet, refund/claim veya enerji ücreti politikasını bu dosyadaki metinlerden türetmemeli; ayrı, yetkili konfigürasyona bağlanmalı.

Bu oturumda battle simulation, kazanma oranı veya cihazdaki savaş süresi ölçülmedi. Tahmini okuma/savaş süresi ile doğrulama sonucu [ana dosyada](README.md) ayrılıyor.
