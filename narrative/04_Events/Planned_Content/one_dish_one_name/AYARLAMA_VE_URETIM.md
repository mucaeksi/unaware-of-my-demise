# Bir Tabak, Bir İsim — ayarlama ve üretim sözleşmesi

## Oynanış kimliği

İki işten oluşan şölen hazırlığı. Üç plandan biri, bir kısa yol savaşı, konuğa iki eşlik biçimi, üç son konuşma. Şölenin sıcak günlük yaşam ritmi.

## Ayarlanabilenler

Referans ana bölüm aralığı **6–9 seviye**; kaynak Story Bible’dan, nihai event dengesi değil. Production roster binding henüz null. Enemy HP/ATK/DEF/SPD, unit level, mevcut skill cooldown/focus/AI priority ve izinli effect katsayıları ayarlanabilir. Sabit 5v5 ve 2 ön/3 arka düzen korunur; kayıt/sohbet sonucuna bağlı gizli ölüm cezası eklenmez.

Her varyant için canonical family → gerçek unit/skill/intent bağlaması gerekir. Rol açıklaması, aynı source unit ID’sinin bütün rolleri zaten uyguladığı anlamına gelmez. İzinli skill verisiyle destek/arka hedef/guard gibi davranışlar temsil edilebilir; yeni effect op eklemek gerekiyorsa o artık engine işi olur ve bu tasarımın scope’u dışındadır.

[Test prototipi](authoring/combat_feasibility.json), tutorial kitlerinden türetilen beş **QA proxy** ile rol uygulanabilirliğini gösterir. Enemy HP 0.8/1.0/1.2 × üç seed denendi. [Kontrol sonucu](COMBAT_FEASIBILITY_VALIDATION.json). Bunlar gerçek karakterlerin kitleri, chapter loot veya yayınlanacak combat pack değildir. Nihai ücretsiz/loan roster ve gerçek chapter zorluğu ayrıca test edilmeli.

Sabit tutulacaklar: canon metni ve bilgi sırası, sahne/line ID’leri, ilk tur seçim kaydı, replay izolasyonu. Ödül/enerji/tarih/min-client-version bu ayarlama dosyasında belirlenmedi. [Yapılandırılmış tuning](authoring/tuning.json).

## Üretim yüzeyi

VN sahneleri mevcut StoryScene komutlarıyla parse edilir. Kamera yönergesi prodüksiyon notudur; otomatik koreografi değildir. UI her seçimin görünür consequence_en önizlemesini metadata’dan sunmalı; mevcut choice export’u ayrı preview alanı taşımaz. Portre emotion mapping’i gerçek manifestte doğrulanmalı; her etiket için asset var sayılmaz.

Story/event graph, server gate/progress, battle reference binding, checkpoint/resume ve izole replay host’u entegrasyon ister.

Görsel ve ses dosyaları henüz üretilmedi. Mekân key’leri aynı ortamın kadrajlarına bağlanabilir; her location ID ayrı büyük illüstrasyon gerektirmez. İngilizce kaynak tam; Japonca çeviri ve kayıt boş. Yeni hero/boss videosu, escort AI, gerçek zamanlı kalabalık, physics/carry minigame veya event cüzdanı önerilmiyor. Güncel ana paranın görünen adı Bell’s Remains; içerik prop’ları para sayılmaz. Medya üretimi onaylı proje bütçesi ve araçlarıyla ayrıca yapılacak; bu çalışmada ücretli çağrı yapılmadı.

## Hikâye uyumu

Kaynak Harvest üç sahnesi/14 satırı korunur. Pippa charm sırrı ve Jori’nin sonraki aile/çan sahneleri yeni metinde açılmaz.

[Continuity kaydı](authoring/continuity.json). Gate, kilitli kapak ve metinler kaynak spoiler politikasına uymalı. Yayından önce actual stage IDs ve eski completion alias’ları bağlanacak; patch tarihi hikâyeye gün eklemez.
