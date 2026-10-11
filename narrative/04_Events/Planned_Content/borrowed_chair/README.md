# Ödünç Bir Sandalye / A Borrowed Chair — tam içerik paketi v1

İleriki patch’lar için · **3-5 sonrası** · Ödüller açık.

Şölenin mevcut sandalyeleri geri götürme montajında küçük bir ev kapısına uğranır. Jori ve Pippa, şölende kalan onarılmış sandalye dışındaki bir emaneti geri verir. Ev sahibi aynı akşamın farklı bir anını hatırlar.

**Oynanış:** Beş kısa sahne, bir ikili konuşma tercihi, sıfır savaş. Emaneti geri götürmek bir taşıma minigame’i değildir; eşya tüketme/üretme veya teslimat farm’ı yok.

| Kapsam | Miktar |
|---|---|
| Bölüm | 3 |
| Sahne | 5 |
| Replik/anlatım | 37 (kaynak canon 0) |
| Geçerli seçim yolu | 2 |
| İlk tur savaşı | 0 |
| Karşılaşma tasarım varyantı | 0 |

Bütün diyalog dalları, sahne yönergeleri, line ID’leri, emotion, seçim/graph ve replay sınırları yazıldı. [Tam script](TAM_SCRIPT.md), [sahne indeksi](SAHNE_INDEKSI.md), [bölüm akışı](BOLUM_AKISI.md), [karşılaşmalar](KARSILASMALAR.md), [medya](MEDYA_VE_YONETIM.md), [ayar/üretim](AYARLAMA_VE_URETIM.md), [patch devri](PATCH_DEVRI.md).

İlk tur 33–33 satır, 332–333 İngilizce kelime içerir. **3–5 dakika** aktif oynanış tahmini; cihazda ölçülmedi. Tam yazım öncesindeki daha uzun süre hedefleri bu metin miktarıyla güncellendi. Bekleme/farm toplamda yok.

3-5 ve Harvest tamamlanması gerekir; source/working alias eşlemesi sonradan bağlanır. Görülmemiş bir kapanış anı, yeni bir ertesi gün değil. Onarılmış sandalye meydanda kalır. İkinci şölen, şarkı provası veya charm/çan reveal’i yok.

[Story/akış doğrulaması](VALIDATION.json) bütün kombinasyonları mevcut StoryScene/StoryRunner ile kontrol eder. [Combat uygulanabilirlik](COMBAT_FEASIBILITY_VALIDATION.json) yalnız mevcut motorla rol proxy’lerinin kontrolüdür; gerçek roster dengesi, medya playback, event API, Android ve canlı patch testi değildir. İngilizce tam, Japonca çeviri/kayıt ve media üretimi henüz yok. Graph/encounter JSON authoring girdisi; otomatik canlı event kaydı değildir.

Ödül türü/adedi, enerji maliyeti, publish/expiry ve min-client-version null; daha sonra belirlenecek. Null “ödül yok” kararı değil. Yapılandırılmış kaynak [event.json](authoring/event.json), [VO listesi](VO_LINE_LIST.csv).
