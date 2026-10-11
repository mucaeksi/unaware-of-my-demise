# Arşiv Nöbeti / Archive Watch — tam içerik paketi v1

İleriki patch’lar için · **4-5 sonrası** · Ödüller açık.

Arşiv defterindeki bilinen tehditler üzerinden bir vaka canlandırması. Bu, kliniğe yeni bir saldırı veya geçen günlere ek yolculuk değildir. Kullanılan iki hazırlık alanı dört savaş profili verir; kapanışta iki farklı okuma tartışılabilir.

**Oynanış:** Üç vaka; her biri taze battle state ile başlar. İlk vaka line, ikinci response, üçüncü ikisinin birleşimiyle seçilir. Dört savaş profili × iki kapanış = sekiz yazılı yol. Defeat aynı vakayı tekrar eder.

| Kapsam | Miktar |
|---|---|
| Bölüm | 4 |
| Sahne | 10 |
| Replik/anlatım | 54 (kaynak canon 0) |
| Geçerli seçim yolu | 8 |
| İlk tur savaşı | 3 |
| Karşılaşma tasarım varyantı | 8 |

Bütün diyalog dalları, sahne yönergeleri, line ID’leri, emotion, seçim/graph ve replay sınırları yazıldı. [Tam script](TAM_SCRIPT.md), [sahne indeksi](SAHNE_INDEKSI.md), [bölüm akışı](BOLUM_AKISI.md), [karşılaşmalar](KARSILASMALAR.md), [medya](MEDYA_VE_YONETIM.md), [ayar/üretim](AYARLAMA_VE_URETIM.md), [patch devri](PATCH_DEVRI.md).

İlk tur 48–48 satır, 571–579 İngilizce kelime içerir. **15–25 dakika** aktif oynanış tahmini; cihazda ölçülmedi. Tam yazım öncesindeki daha uzun süre hedefleri bu metin miktarıyla güncellendi. Bekleme/farm toplamda yok.

Fiziksel ekip yalnız kısa arşiv VN’sinde; savaşlar izole canlandırmadır. Gerçek düşmanlar kliniğe taşınmaz. Dynamic modifier, günlük zorunluluk, leaderboard veya yeni farm ödülü seçilmedi.

[Story/akış doğrulaması](VALIDATION.json) bütün kombinasyonları mevcut StoryScene/StoryRunner ile kontrol eder. [Combat uygulanabilirlik](COMBAT_FEASIBILITY_VALIDATION.json) yalnız mevcut motorla rol proxy’lerinin kontrolüdür; gerçek roster dengesi, medya playback, event API, Android ve canlı patch testi değildir. İngilizce tam, Japonca çeviri/kayıt ve media üretimi henüz yok. Graph/encounter JSON authoring girdisi; otomatik canlı event kaydı değildir.

Ödül türü/adedi, enerji maliyeti, publish/expiry ve min-client-version null; daha sonra belirlenecek. Null “ödül yok” kararı değil. Yapılandırılmış kaynak [event.json](authoring/event.json), [VO listesi](VO_LINE_LIST.csv).
