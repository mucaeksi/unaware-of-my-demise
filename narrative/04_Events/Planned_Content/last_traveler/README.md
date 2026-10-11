# Son Geçen İçin / For the Last Traveler — tam içerik tasarımı v1

11 Ekim 2026 · İleriki içerik patch’ları için · **1-4 tamamlanınca açılır** · Ödüller belirlenmedi.

Bir sonraki yolcu, bizim kadar yol bilgisine sahip olmasa da güvenle geçebilsin.

Shrine sonrasındaki yolda devrilmiş bir işaret var. Nixie geçidin izlerini okumayı, Brin güvenli bir tutunma noktası hazırlamayı öneriyor. Oyuncu yöntemi ve yöntemin içindeki taktik odağı seçiyor. Bilinen düşmanlar temizleniyor; adsız bir yolcu hazırladıkları geçitten geçiyor. Asıl küçük değişim, Brin ile Nixie’nin birbirlerinin göremediği tarafı kontrol etmesi.

İçerik yazımı tamamlandı; yeni metinler onay bekleyen yaratıcı genişletmedir. Oyuncu metni İngilizce, prodüksiyon notları Türkçe. Japonca çeviri ve ses kayıtları üretilmedi. Bu paket ileriki patch için narrative kaynağıdır; çalışan oyuna henüz bağlanmadı.

| Kapsam | Teslim |
|---|---|
| Bölüm | 4 |
| Sahne | 15 (15 yeni + 0 birebir kaynak) |
| Replik/anlatım | 116 (116 yeni + 0 kaynak) |
| Seçim yolu | 8 geçerli kombinasyon |
| Karşılaşma | İlk turda 1 savaş; 4 tasarım varyantı |
| Story JSON | 15 sahne, mevcut StoryScene şemasıyla doğrulandı |
| Tam script ve VO | Bütün diyalog dalları, line ID’leri, yönergeler, emotion ve kayıt tablosu |

## Okuma sırası

1. [Bölüm akışı ve seçimler](BOLUM_AKISI.md).
2. [Birleşik tam script](TAM_SCRIPT.md) veya [sahne indeksi](SAHNE_INDEKSI.md).
3. [Karşılaşmalar](KARSILASMALAR.md).
4. [Medya ve yönetim](MEDYA_VE_YONETIM.md).
5. [Patch devri ve state sözleşmesi](PATCH_DEVRI.md).

Bölüm scriptleri: [Bölüm 1](scripts/BOLUM_01.md), [Bölüm 2](scripts/BOLUM_02.md), [Bölüm 3](scripts/BOLUM_03.md), [Bölüm 4](scripts/BOLUM_04.md). Yapılandırılmış tam kaynak: [event.json](authoring/event.json). Çeviri/kayıt listesi: [VO_LINE_LIST.csv](VO_LINE_LIST.csv).

## Süre ve tekrar

İlk tur **82–83 satır, 768–791 İngilizce kelime, tek savaş** içerir. Tahmin: okuma 4–6 dk, savaş 4–7 dk, karar/geçiş 2–5 dk; toplam **10–18 dakika aktif oynanış**. Ölçülmüş cihaz süresi değildir. Önceki atölye süresi bu tamamlanmış metin miktarıyla güncellendi; bekleme veya grind süreye dahil edilmedi.

Diğer yöntemin üç sahnesi yaklaşık 2–4 dakika; ikinci kapanış yaklaşık 1 dakika. İstenirse diğer hazır savaş düzeni ayrıca denenebilir; gerçek savaş süresi ölçülmedi. Ortak başlangıç/finali yeniden okumak gerekmez.

## Kaynak ve sınırlar

Bu paket sıfır kaynak sahne kopyası içerir; tamamen yeni yaratıcı yan görevdir. Part I Story Bible, dünya kuralları, spoiler unlock policy ve Brin/Nixie profilleri referans alındı. 1-4 sonrasındaki mevcut yol gününe yerleşir; yeni gün veya Part I’in üç haftalık zamanına uzatma eklenmez.

Brin’in babası ve Two Roofs companion olayı yeniden anlatılmaz. Nixie’nin gerçek soyu, false-map veya home/registry sırları çözülmez. Yolcu kayıp kraliyet tanığı, gizli düşman veya önemli yeni karakter yapılmaz. Shrine kaydı gereksiz ilan edilmez; ekip yol temizlemektedir, resmi kayıt tutmamaktadır. Brin’in 2-1’deki ayrılışı korunur.

Ödül türü/adedi, first-clear/replay ayrımı, enerji maliyeti, yayın/sona erme tarihleri ve min-client-version açık. Null alanlar “ödül yok” değil, sonradan belirlenecek anlamında.

[VALIDATION.json](VALIDATION.json): bütün 8 geçerli kombinasyon mevcut StoryRunner ile sona ulaşıyor; bütün sahneler mevcut StoryScene şemasından geçiyor; line ID/metin eşleşmesi, referanslar, canon bütünlüğü ve sahne sonu checkpoint save/restore kontrol edildi. Gerçek savaş dengesi, event API, medya playback, mobil cihaz ve yayımlanmış patch test edilmedi. Graph/encounter JSON authoring formatıdır; gelecekteki adaptöre ihtiyaç duyar.
