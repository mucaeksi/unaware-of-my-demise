# Bir Tabak, Bir İsim / One Dish, One Name — tam içerik tasarımı v1

11 Ekim 2026 · İleriki içerik patch’ları için · **3-5 tamamlanınca açılır** · Ödüller belirlenmedi.

Bir şölenin hazırlığını birlikte yapmak: tabak kadar masada oturacak kişiye de yer açmak.

Mercenary Captain sonrasında Oakhaven meydanı yeniden insanlara ait bir yer olmaya çalışır. Jori sağlam bir masa, Nixie paylaşılabilir bir taşıma işi, Pippa herkese sığan bir son mısra hazırlıyor. Kera mutfak katkısının bilimsel geçerliliğini savunuyor. Oyuncu üç işten ikisine katılıyor, kalanını yerel yardımcılar bitiriyor. Şölen yolu tek bir kısa karşılaşmayla açılıyor; akşamın asıl sonucu insanların aynı sofraya oturması.

İçerik yazımı tamamlandı; yeni metinler onay bekleyen yaratıcı genişletmedir. Oyuncu metni İngilizce, prodüksiyon notları Türkçe. Japonca çeviri ve ses kayıtları üretilmedi. Bu paket ileriki patch için narrative kaynağıdır; çalışan oyuna henüz bağlanmadı.

| Kapsam | Teslim |
|---|---|
| Bölüm | 5 |
| Sahne | 23 (20 yeni + 3 birebir kaynak) |
| Replik/anlatım | 209 (195 yeni + 14 kaynak) |
| Seçim yolu | 18 geçerli kombinasyon |
| Karşılaşma | İlk turda 1 savaş; 3 tasarım varyantı |
| Story JSON | 23 sahne, mevcut StoryScene şemasıyla doğrulandı |
| Tam script ve VO | Bütün diyalog dalları, line ID’leri, yönergeler, emotion ve kayıt tablosu |

## Okuma sırası

1. [Bölüm akışı ve seçimler](BOLUM_AKISI.md).
2. [Birleşik tam script](TAM_SCRIPT.md) veya [sahne indeksi](SAHNE_INDEKSI.md).
3. [Karşılaşmalar](KARSILASMALAR.md).
4. [Medya ve yönetim](MEDYA_VE_YONETIM.md).
5. [Patch devri ve state sözleşmesi](PATCH_DEVRI.md).

Bölüm scriptleri: [Bölüm 1](scripts/BOLUM_01.md), [Bölüm 2](scripts/BOLUM_02.md), [Bölüm 3](scripts/BOLUM_03.md), [Bölüm 4](scripts/BOLUM_04.md), [Bölüm 5](scripts/BOLUM_05.md). Yapılandırılmış tam kaynak: [event.json](authoring/event.json). Çeviri/kayıt listesi: [VO_LINE_LIST.csv](VO_LINE_LIST.csv).

## Süre ve tekrar

İlk tur **155–156 satır, 1425–1476 İngilizce kelime, tek savaş** içerir. Tahmin: okuma 8–12 dk, savaş 4–7 dk, karar/geçiş 3–6 dk; toplam **15–25 dakika aktif oynanış**. Ölçülmüş cihaz süresi değildir. Önceki atölye süresi bu tamamlanmış metin miktarıyla güncellendi; bekleme veya grind süreye dahil edilmedi.

Seçilmeyen üçüncü iş, üç sahnelik yaklaşık 2–4 dakikalık ayrı bir replay. İki diğer kapanış konuşması toplam yaklaşık 1–3 dakika. Şölenin ortak sahneleri yeniden okunmak zorunda değil.

## Kaynak ve sınırlar

Kaynak event_harvest_inn_meal içindeki üç sahne ve 14 satır birebir korunur. Kaynağın sofra/isim kuralı değiştirilmez; hikâyesini herkese anlatma zorunluluğu eklenmez. Nixie’nin kısa süreli parlaması kaynak mizahıdır, stat buff’ı değildir. Fadyme’nin çanı yüksek sesli meydanda kaybetmesi iç düşünce/mecazdır; çan veya saat borcu gerçekte iptal olmaz.

Pippa’nın bell charm kökeni, Silent Bell sırrı, Nixie’nin soyu, Jori’nin gizli işleri ve Fadyme’nin kraliyet adı/hastalığının çözümü açılmaz. Canon Inn Meal’deki Fadyme/Mahmut varlığı korunur. Oyuncunun yapmadığı iş yüzünden kimse aç kalmaz; başarı/moral puanı yok.

Ödül türü/adedi, first-clear/replay ayrımı, enerji maliyeti, yayın/sona erme tarihleri ve min-client-version açık. Null alanlar “ödül yok” değil, sonradan belirlenecek anlamında.

[VALIDATION.json](VALIDATION.json): bütün 18 geçerli kombinasyon mevcut StoryRunner ile sona ulaşıyor; bütün sahneler mevcut StoryScene şemasından geçiyor; line ID/metin eşleşmesi, referanslar, canon bütünlüğü ve sahne sonu checkpoint save/restore kontrol edildi. Gerçek savaş dengesi, event API, medya playback, mobil cihaz ve yayımlanmış patch test edilmedi. Graph/encounter JSON authoring formatıdır; gelecekteki adaptöre ihtiyaç duyar.
