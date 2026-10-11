# Kül Çemberi / Ash Circle

Tek büyük arena, 10 hikâyeli bölüm, oyuncunun kendi beş kişilik partisiyle gerçek zamanlı hayatta kalma modu. Gelecek patch için üretim öncesi paket; **oynanabilir mod henüz uygulanmadı**. Bu belgeler ana mühendislik README'sini veya mevcut canon'u değiştirmez.

4-5 tamamlandıktan sonra Oakhaven'da açılır. Sonraki bütün ilerleme bu modun içinde gerçekleşir. Bir lider hareket ettirilir, dört destek otomatik yetenek ve pasif verir. Ana oyunun seviye/ekipman/rarity avantajları taşınmaz; mod gücü eşit başlangıç ve koşu yükseltmeleriyle kurulur. Ödül, enerji ve yayın tarihi bağlanmamıştır.

10 bölüm ayrı ayrı koşulardır; her koşu 6 dakika rota görevi + en fazla 2 dakika boss penceresi kullanır. Hikâye/yükseltme seçimleri saati durdurur. İlk hikâye tamamlayışı yaklaşık 80 dakika azami aktif savaş süresi; yenilgi, okuma ve parti denemeleri bunun dışındadır. Bu süre ayar hedefidir, ölçülmüş oyuncu verisi değildir. Aynı avlunun geometrisi tüm bölümlerde korunur.

| Bölüm | İsim | Oynayış amacı | Boss profili |
|---|---|---|---|
| 1 | Açık Kapı | Tebeşir işaretlerini topla; geçit boyunca geri dön. İlk koşu hareket ve otomatik saldırıyı öğretir. | `charcoal_carrier` |
| 2 | İsimsiz Tartı | Üç tartı levhasını farklı yaklaşım yönlerinden topla; paralel düşman hatlarının arasından geç. | `scale_minder` |
| 3 | Değiştirilen Yol | Eski sevk etiketlerini güney-doğu-kuzey rotasında al; kurt kıskacında yön değiştir. | `road_hound` |
| 4 | Geçici Kuru Yer | Çevredeki üç sığınak mandalını aç; merkez etrafında dönen tehdide tek yönde bağımlı kalma. | `shelter_warden` |
| 5 | Kara Suyun Altı | Üç sabit tahliye kolunu sırayla çevir; su şeritlerinin değişen güvenli tarafını kullan. | `sluice_turner` |
| 6 | Boş Kenar | Üç ayrı defter yaprağını al; hareket izi bırakan mürekkep yüzünden aynı yolu hemen tekrar kullanma. | `ledger_clerk` |
| 7 | Boş Arabayı Döndürmek | Bir araba üç durakta oyuncu yakındayken ilerler; temas menzilinde beklemek yerine önden koridor aç. | `cart_hauler` |
| 8 | Çukurun Sakladığı | Açık çukur kenarındaki üç taşı işaretle; kül fırtınalarının önceden görünen yönüne göre yol değiştir. | `pit_digger` |
| 9 | Avluyu Açmak | Üç çıkış zincirini sök; iki dik ateş hattı aynı anda kapandığında kalan çeyreği bul. | `kiln_tender` |
| 10 | Yolu Açık Bırak | Arenanın üç bölgesindeki tanık direklerini etkinleştir; önceki hareket dilini üç boss fazında birleştir. | `last_load` |

İlk pakette temel kademe dahil 6 tehdit kademesi / 60 bölüm-kademe hücresi tasarlandı. Kayıp, bitirilmiş hücreleri geri almaz. Daha yüksek kademeler doğrulanan ayar paketleriyle eklenebilir. Bu tasarım sınırsız üretilmiş, dengesi bilinmeyen düşman artışı vaat etmez.

- [Tasarım ve oyuncu akışı](OYUN_TASARIMI.md)
- [Arena ve karşılaşmalar](ARENA_VE_KARSILASMALAR.md)
- [Tam metin ve tüm seçim dalları](TAM_SCRIPT.md); [10 bölüm scripti](scripts/BOLUM_01.md)
- [Parti, silahlar ve yükseltmeler](PARTI_VE_YUKSELTMELER.md)
- [Bağımsız ilerleme ve kayıt](ILERLEME_VE_KAYIT.md)
- [Teknik geliştirme devri](TEKNIK_DEVIR.md)
- [Medya, yerelleştirme ve yönetim](MEDYA_VE_YONETIM.md)
- [QA ve kabul koşulları](QA_VE_KABUL.md)
- [Tasarım değerlendirmesi](TASARIM_RAPORU.md)
- [Veri ve script doğrulaması](VALIDATION.json), [kanıt kapsamı](qa/EVIDENCE.md)

Paket: 34 sahne, 189 İngilizce satır (tüm seçim dalları), 10 boss profili, 5 düşman ailesi, 20 karakter adapter taslağı, 20 yükseltme kartı. Japonca çeviri, ses ve görsel üretimi yapılmadı.

`authoring/*.json` yeni moda ait **tasarım veri biçimi**; mevcut runtime'a doğrudan yüklenmez. `story_json/*.json` mevcut StoryScene grammar'ına göre doğrulanır; medya eşlemesi ve tetik controller'ı geliştirilmeden kendiliğinden açılmaz. Arşivden alınan karakter pack'i kit/oynanabilirlik kanıtı değildir. Kaynak hash'leri `authoring/mode.json` içindedir. QA doğrulayıcıları bu klasörde, araştırma/prototip araçları dış çalışma klasöründe tutuldu; dağıtım paketine Phaser kütüphanesi veya runtime kodu eklenmedi.
