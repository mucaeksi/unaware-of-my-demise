# Sekiz yan hikâye — tasarım ve üretim değerlendirmesi

11 Ekim 2026. Referans: main `99df3cf`. Sonuç: sekiz paket bütün dallarıyla yazıldı; mevcut hikâye/VM grammar ve savaş operasyonları kapsamında üretilebilir tasarımlar. Canlı entegrasyon, gerçek roster dengesi ve cihaz kabulü henüz tamamlanmış sayılmıyor.

## Farklı hikâye ve oynanış kimlikleri

| Paket | Temel eylem | Hikâyeyi taşıyan soru | Oynanış ritmi |
|---|---|---|---|
| İki Etiket | Sevkiyat götürmek ve tedaviyi açıklamak | Ücretsiz tedavinin ne olduğunu bilerek seçmek mümkün mü? | Uzun yol, iki rota, beş savaş, klinik ve açıklama |
| Bir Tabak, Bir İsim | Şölen için iki işi tamamlamak | Bir akşamı birlikte kurarken kime nasıl yer açılır? | İki hazırlık işi, tek savaş, konuk eşliği ve toplu kapanış |
| Son Geçen İçin | Geçidi gözlemek ve küçük hazırlık yapmak | Bir sonraki yolcuya işe yarayan ne bırakılabilir? | Kısa keşif/dayanak, yönteme bağlı hazırlık, tek savaş |
| Kuru Bir Yer | Islak kaydı okumak ve bilgiyi doğrulamak | Emin olmadığın bir kayıt nasıl dürüstçe kullanılır? | Çalışma düzeni, okuma yöntemi ve sonucu, tek savaş |
| Tutulmayı Bekleyenler | Aynı olaya farklı yerlerden tanıklık etmek | Gördüğünle duyduğunun sınırını nasıl korursun? | Seyir yolu, üç savaş, kaynak tutulma, gözlem ve karakter kapanışı |
| Açık Yol | Yardım noktasını gönüllülere devretmek | Bir iş, onu kuranlar ayrılınca nasıl devam eder? | Öğretme sırası, tek savaş, gönüllünün anlatması/ara vermesi ve kullanım |
| Arşiv Nöbeti | Dört profilde üç taktik vakayı denemek | İlk yaklaşım neyi korur, neyi açık bırakır? | İzole üç savaş, dört sabit profil, iki değerlendirme konuşması |
| Ödünç Bir Sandalye | Bir emaneti geri vermek | Ortak akşam evde hangi küçük izini bırakır? | Beş kısa sahne, tek ilişkisel seçim, savaşsız bitiş |

Ortak VN + savaş altyapısı korunur; yeni minigame motoru gerekmez. Benzer karakterler kullanılsa bile amaç, kararın etkisi, gerilim, savaş yoğunluğu ve kapanışları ayrıdır. İki Etiket ile Arşiv Nöbeti aynı dört karakteri farklı işlerde kullanır: ilkinde canlı sevkiyat ve toplumsal güven, ikincisinde casebook taktik değerlendirmesi. Şölen ile Sandalye bilinçli ana hikâye/devam ilişkisi taşır; devam yeni hazırlık veya ikinci şölen tekrarı değildir.

Yeni diyaloglarda paketler arası uzun birebir satır tekrarı bulunmadı. Sekiz kelimelik dizi karşılaştırması da ortaklık bulmadı; bu sadece metin tekrarı kontrolüdür. Hikâye özgünlüğü kararı yukarıdaki eylem, çatışma ve sonuç karşılaştırmasına dayanır. Referans oyunlardan karakter, görev zinciri veya sahne kopyası alınmadı; projenin mevcut dünyası ve altyapısı kullanıldı. Dışarıdaki tüm eserlerle kapsamlı benzerlik taraması yapıldığı iddia edilmez.

## Canon ve zaman çizelgesi

Kaynak [Story Bible](../../01_Story_Bible/STORY_BIBLE_PART1.md), [event metinleri](../events_part1.json), [bestiary](../../07_Enemies_Bosses/bestiary.md) ve paket snapshot’larındaki world rules/spoiler/companion/karakter profilleriyle karşılaştırıldı. Salt-Road, Harvest ve Sun-Eclipse kaynaklarının toplam dokuz sahnesi/35 satırı, konuşmacı ve alanları korunuyor; mevcut canon dosyaları değiştirilmedi.

Karakterlerin ilk görünüşleri gate’lerden önce: Pippa 3-4, Mirel 2-3, Nara 5-2, Vespera 6-3 dahil. Fiziksel sahne ekibi ile savaş roster’ı ayrı tutulur; karakteri görmüş olmak ownership gerektirmez. Yeni metinler Part II sırlarını çözmez, Fadyme’nin durumunu iyileştirmez ve ismi yazmanın borcu iptal ettiği yeni bir dünya kuralı yaratmaz. Patch tarihi hikâyeye gün eklemez.

Önemli süreklilik kararları:

- **Kuru Bir Yer:** sıradan keten emanet kaydı; kraliyet kayıt sayfası, Mirel’in sonraki suçunu fark etmesi ve Aveline’in sonraki itirafı erkene alınmaz.
- **Açık Yol:** Nara/Marek mevcut güvenli yan rotada gönüllülere iş devreder. Mahmut/Fadyme geri çağrılmaz; Oren’in yeri ve köprünün kaderi açıklanmaz. Yaşayan Corrupted Crown Guard taslaktan çıkarıldı; bilinen Hollow tehditleri kaldı.
- **Tutulmayı Bekleyenler:** mevcut üç tutulma sahnesi aynen. Clem/Vespera/Thistle’a iki yerel NPC eşlik ederek kaynaktaki beş tokenın beş kişisini kurar. Token bir sahne prop’udur; ikinci event cüzdanı veya ödül kararı değildir.
- **Ödünç Bir Sandalye:** mevcut şölen kapanışının sandalyeleri geri götürme montajında geçer. Onarılmış sandalye meydanda kalır; geri verilen başka bir emanettir. Yeni bir ertesi gün veya ikinci şölen yok. 3-5 yanında şölen completion’ı da gerekir.
- **Arşiv Nöbeti:** casebook canlandırması; kliniğe gerçek bir undead saldırısı eklemez. Üç vaka taze battle state ile başlar. İki hazırlık alanı dört sabit profil oluşturur; iki kapanış seçimiyle sekiz yazılı yol vardır.

Kaynakla uyumlu yeni hikâye yazımı proje sahibinin son editoryal değerlendirmesine açıktır; henüz yayımlanmış canon gibi sunulmaz.

## Doğrulananlar

134 StoryScene export’u mevcut şemadan geçti. 1.028 benzersiz line ID ve VO/script/export metni eşleşti. 88 geçerli seçim kombinasyonu mevcut StoryRunner ile sonuna ulaştı; bütün graph düğümleri ve 32 encounter varyantı erişilebilir. Her satır sonrasında, seçim öncesinde ve sahne checkpoint’lerinde save/restore karşılaştırıldı. VM’nin pending choice anında save reddetmesi beklenen davranış olarak kontrol edildi; host güvenli cursor/state kaydını uygulamalı.

Düşman ailelerinin bestiary’de bulunması ve açılma bölümünden önce bilinmesi kontrol edildi. Savaş tasarımları mevcut beşli, iki ön/üç arka düzeninde; savaşsız Sandalye boş encounter listesine sahip. Replay segmentleri ve konuşma hedefleri sınırlı kataloglarda tanımlandı. Ödül, maliyet ve yayın alanlarının açık bırakıldığı kontrol edildi.

**288 teknik combat simülasyonu** tamamlandı: 32 varyant × üç enemy HP katsayısı (0,8/1/1,2) × üç seed. Temel katsayıdaki **96 vaka** replay ile doğrulandı; tekrar replay log hash’leri eşleşti. Her simülasyon sonuçlandı; normalleştirilmiş proxy takım hepsini kazandı. Bu kazanma sonucu gerçek bölüm zorluğu veya ücretsiz roster erişilebilirliği kanıtı değildir.

Combat fixture’ı mevcut Mahmut/Fadyme tutorial kitlerinden türetilen beş teknik proxy ve mevcut damage/heal/shield/status/selector operasyonlarını kullanır. Bunlar gerçek karakter veya düşman kitlerinin yerine geçmez. Test, yeni motor operasyonu gerektirmeden rol tasarımlarının kurulabildiğini ve HP ayarının çalıştığını gösterir. Üretim dengesi raporlarda `NOT_CERTIFIED` olarak işaretlidir.

## Üretilebilirlik ve ayar sınırları

Tam diyalog, sahne yönergesi, graph/state/replay sözleşmesi, encounter brief’i ve VO kaynak listesi teslim edildi. Yeni boss modeli, escort AI, gerçek zamanlı kalabalık, taşıma fiziği, dinamik taktik modifier, leaderboard veya günlük zorunluluk yok. Mekân key’leri aynı setin kadrajlarıyla karşılanabilir; her key ayrı büyük illüstrasyon şartı değildir.

Her paketin `authoring/tuning.json` dosyası bölüm seviyesini, roster bağlama yerini, HP aralığını, unit/skill ayar yüzeylerini ve korunacak hikâye alanlarını belirtir. Sayısal zorluk, cooldown/focus/AI priority ve mevcut effect grammar ile ayarlanabilir. Gate, canon metin, seçilmiş dal ve tamamlanma/replay kayıtları zorluk ayarına göre değiştirilmez. Gerçek skill/intent değişirse oyuncuya verilen karşı önlem bilgisi de güncellenir.

Henüz bağlanması/üretilmesi gerekenler: actual stage ve completion alias mapping’i; server gate/verified victory/claim; event graph adapter; choice sonucu önizlemesi; güvenli UI/VM/media resume; revision pin/migration ve replay izolasyonu; gerçek ücretsiz/loan roster, enemy skill/AI ve art/cue/portrait mapping’i; Japonca çeviri/kayıt ve yeni medya. StoryScene seçim şemasına yeni bir alan eklenmedi; sonuç önizlemesi authoring metadata’dan host tarafından gösterilecek.

Ödüller, enerji, takvim ve min-client-version belirlenmedi. Güncel ana paranın görünen adı Bell’s Remains; prop’lar event parası değildir. Android, medya playback, canlı API, server claim ve imzalı patch kabul testi yapılmadı. Bunlar üretim kabul kriterleri; bu teslimde çalışan özellik olarak raporlanmıyor.

## Repo teslim kapsamı

Yalnız `narrative/04_Events/Planned_Content/` altına yeni dosyalar eklenir. Çalışan oyun kodu, ana canon kaynakları, CI/deploy ve başka geliştiricinin çalışma dosyaları değiştirilmez. Export/doğrulama araçları, ağ/kimlik bilgisi ve geçici çalışma dosyaları teslim ağacına dahil edilmez. JSON QA kayıtları ve combat fixture’ları authoring-only; otomatik canlı patch kaydı değildir.

Mevcut main push workflow’u staging deploy’u tetikler; planned narrative dosyalarını runtime içeriğine bağlayan bir değişiklik yapılmadı. Canlı içerik publish workflow’u ayrıca manuel çalışır. Bu commit içerikleri ileriki patch için saklar, oyun içinde açmaz.

[Paket indeksi](README.md) · [VM kontrolü](VALIDATION_SUMMARY.json) · [Canon/VO/gate ve metin kontrolü](CROSS_PACKAGE_VALIDATION.json) · [Combat kontrolü](COMBAT_FEASIBILITY_SUMMARY.json).
