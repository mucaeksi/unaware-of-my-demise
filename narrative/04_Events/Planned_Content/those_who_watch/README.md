# Tutulmayı Bekleyenler / Those Who Watch — tam içerik paketi v1

İleriki patch’lar için · **6-5 sonrası** · Ödüller açık.

Clem, Vespera ve Thistle ayrı güvenli altar yolunda yayla köylülerine katılır. Açık sırt veya korunaklı terastan aynı kaynak tutulmayı izlerler. Sonra görmüş ve duymuş olduklarını sınırlarıyla birlikte bir yerel kayıtta tutarlar.

**Oynanış:** İki seyir yolu, iki yaklaşma savaşı, kaynak öğle sahnesi, iki gözlem yaklaşımı, bir dönüş savaşı ve üç karakter kapanışı. Görsel tepe noktası gözlem sahnesidir.

| Kapsam | Miktar |
|---|---|
| Bölüm | 5 |
| Sahne | 23 |
| Replik/anlatım | 137 (kaynak canon 10) |
| Geçerli seçim yolu | 12 |
| İlk tur savaşı | 3 |
| Karşılaşma tasarım varyantı | 5 |

Bütün diyalog dalları, sahne yönergeleri, line ID’leri, emotion, seçim/graph ve replay sınırları yazıldı. [Tam script](TAM_SCRIPT.md), [sahne indeksi](SAHNE_INDEKSI.md), [bölüm akışı](BOLUM_AKISI.md), [karşılaşmalar](KARSILASMALAR.md), [medya](MEDYA_VE_YONETIM.md), [ayar/üretim](AYARLAMA_VE_URETIM.md), [patch devri](PATCH_DEVRI.md).

İlk tur 97–97 satır, 1103–1176 İngilizce kelime içerir. **20–35 dakika** aktif oynanış tahmini; cihazda ölçülmedi. Tam yazım öncesindeki daha uzun süre hedefleri bu metin miktarıyla güncellendi. Bekleme/farm toplamda yok.

Kaynak Sun-Eclipse üç sahnesi/10 satırı aynen. Üç karaktere bir yerel guide ve lantern carrier eşlik eder; beş token cümlesinin beşlisi yeni taslakta böyle kurulur. Mahmut/Fadyme çağrılmaz. Tokendan yeni cüzdan yapılmaz; Part II teklifi/Clockless Court veya kralın katili açılmaz.

[Story/akış doğrulaması](VALIDATION.json) bütün kombinasyonları mevcut StoryScene/StoryRunner ile kontrol eder. [Combat uygulanabilirlik](COMBAT_FEASIBILITY_VALIDATION.json) yalnız mevcut motorla rol proxy’lerinin kontrolüdür; gerçek roster dengesi, medya playback, event API, Android ve canlı patch testi değildir. İngilizce tam, Japonca çeviri/kayıt ve media üretimi henüz yok. Graph/encounter JSON authoring girdisi; otomatik canlı event kaydı değildir.

Ödül türü/adedi, enerji maliyeti, publish/expiry ve min-client-version null; daha sonra belirlenecek. Null “ödül yok” kararı değil. Yapılandırılmış kaynak [event.json](authoring/event.json), [VO listesi](VO_LINE_LIST.csv).
