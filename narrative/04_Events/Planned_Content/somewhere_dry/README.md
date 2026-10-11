# Kuru Bir Yer / Somewhere Dry — tam içerik paketi v1

İleriki patch’lar için · **2-3 sonrası** · Ödüller açık.

Saint Luthos sığınağında sıradan bir keten emanet kaydı ıslanmıştır. Mirel düzen ve bilgi sınırını, Aveline erişim ve bekleme yerini önemser. Oyuncu bir okuma yeri hazırlar; belirsiz teslim yerini dürüst not veya yaşayan kaynaktan doğrulama ile ele alır.

**Oynanış:** İki çalışma düzeni; iki kayıt okuma yöntemi; yöntem callback’i; tek savaş; gündelik kaydın gerçekten kullanıldığı kapanış. Kayıp kişiyi bulmak veya belge yetiştirme sayacı yok.

| Kapsam | Miktar |
|---|---|
| Bölüm | 4 |
| Sahne | 14 |
| Replik/anlatım | 82 (kaynak canon 0) |
| Geçerli seçim yolu | 4 |
| İlk tur savaşı | 1 |
| Karşılaşma tasarım varyantı | 2 |

Bütün diyalog dalları, sahne yönergeleri, line ID’leri, emotion, seçim/graph ve replay sınırları yazıldı. [Tam script](TAM_SCRIPT.md), [sahne indeksi](SAHNE_INDEKSI.md), [bölüm akışı](BOLUM_AKISI.md), [karşılaşmalar](KARSILASMALAR.md), [medya](MEDYA_VE_YONETIM.md), [ayar/üretim](AYARLAMA_VE_URETIM.md), [patch devri](PATCH_DEVRI.md).

İlk tur 60–60 satır, 721–733 İngilizce kelime içerir. **10–18 dakika** aktif oynanış tahmini; cihazda ölçülmedi. Tam yazım öncesindeki daha uzun süre hedefleri bu metin miktarıyla güncellendi. Bekleme/farm toplamda yok.

2-3 ile 2-4 arasındaki mevcut sığınak işi. Keten defteri kraliyet kaydı değildir. Mirel’in kendi erasure suçunu fark etmesi 6-2’de, dua sayfası 2-4’te, Aveline’in ruhban itirafı 2-5’te kalır.

[Story/akış doğrulaması](VALIDATION.json) bütün kombinasyonları mevcut StoryScene/StoryRunner ile kontrol eder. [Combat uygulanabilirlik](COMBAT_FEASIBILITY_VALIDATION.json) yalnız mevcut motorla rol proxy’lerinin kontrolüdür; gerçek roster dengesi, medya playback, event API, Android ve canlı patch testi değildir. İngilizce tam, Japonca çeviri/kayıt ve media üretimi henüz yok. Graph/encounter JSON authoring girdisi; otomatik canlı event kaydı değildir.

Ödül türü/adedi, enerji maliyeti, publish/expiry ve min-client-version null; daha sonra belirlenecek. Null “ödül yok” kararı değil. Yapılandırılmış kaynak [event.json](authoring/event.json), [VO listesi](VO_LINE_LIST.csv).
