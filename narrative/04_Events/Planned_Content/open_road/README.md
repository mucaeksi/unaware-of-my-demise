# Açık Yol / An Open Road — tam içerik paketi v1

İleriki patch’lar için · **5-5 sonrası** · Ödüller açık.

5-5 sonrasında Nara/Marek güvenli taraftaki yardım noktasını yerel gönüllülere devreder. Oyuncu önce stok erişimini veya açık geçidi öğretebilir; sonra yeni gönüllünün anlatması ya da dinlenme arası üzerinden işleyişi kontrol eder.

**Oynanış:** İki görev öğretme sırası, tek savaş, iki teach-back kontrolü ve gönüllünün kullanımıyla bitiş. Tabela onarma veya yürüyüş şarkısı görevi değil.

| Kapsam | Miktar |
|---|---|
| Bölüm | 4 |
| Sahne | 13 |
| Replik/anlatım | 77 (kaynak canon 0) |
| Geçerli seçim yolu | 4 |
| İlk tur savaşı | 1 |
| Karşılaşma tasarım varyantı | 2 |

Bütün diyalog dalları, sahne yönergeleri, line ID’leri, emotion, seçim/graph ve replay sınırları yazıldı. [Tam script](TAM_SCRIPT.md), [sahne indeksi](SAHNE_INDEKSI.md), [bölüm akışı](BOLUM_AKISI.md), [karşılaşmalar](KARSILASMALAR.md), [medya](MEDYA_VE_YONETIM.md), [ayar/üretim](AYARLAMA_VE_URETIM.md), [patch devri](PATCH_DEVRI.md).

İlk tur 55–56 satır, 637–673 İngilizce kelime içerir. **10–18 dakika** aktif oynanış tahmini; cihazda ölçülmedi. Tam yazım öncesindeki daha uzun süre hedefleri bu metin miktarıyla güncellendi. Bekleme/farm toplamda yok.

Sivillerle kalan ikilinin mevcut yan rotası; Mahmut/Fadyme geri dönmez. Köprünün kaderi ve Oren’in yeri hakkında yeni bilgi yok. Last Cart, Oren’s Teacher ve Refugee Measure tekrarlanmaz. Yalnız bilinen Hollow düşmanlar kullanılır; yaşayan Crown Guard bu paketten çıkarıldı.

[Story/akış doğrulaması](VALIDATION.json) bütün kombinasyonları mevcut StoryScene/StoryRunner ile kontrol eder. [Combat uygulanabilirlik](COMBAT_FEASIBILITY_VALIDATION.json) yalnız mevcut motorla rol proxy’lerinin kontrolüdür; gerçek roster dengesi, medya playback, event API, Android ve canlı patch testi değildir. İngilizce tam, Japonca çeviri/kayıt ve media üretimi henüz yok. Graph/encounter JSON authoring girdisi; otomatik canlı event kaydı değildir.

Ödül türü/adedi, enerji maliyeti, publish/expiry ve min-client-version null; daha sonra belirlenecek. Null “ödül yok” kararı değil. Yapılandırılmış kaynak [event.json](authoring/event.json), [VO listesi](VO_LINE_LIST.csv).
