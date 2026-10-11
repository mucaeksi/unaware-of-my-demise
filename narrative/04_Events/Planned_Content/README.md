# İleriki patch’lar için sekiz hikâyeli yan içerik

Tam narrative tasarımları; otomatik etkinleştirilmiş oyun içeriği değildir. Ana hikâye eşiği ve patch yayın durumu birlikte kontrol edilecek. Ödül türü/adedi, enerji maliyeti ve yayın takvimi henüz belirlenmedi.

| İçerik | Açılma eşiği | Bölüm/sahne/satır | Seçim yolu | İlk tur savaşı/varyant | Tahmini dakika |
|---|---|---|---|---|---|
| [İki Etiket](two_labels/README.md) | 4-5 | 5/31/316 | 32 | 5/8 | 30–50 |
| [Bir Tabak, Bir İsim](one_dish_one_name/README.md) | 3-5 | 5/23/209 | 18 | 1/3 | 15–25 |
| [Son Geçen İçin](last_traveler/README.md) | 1-4 | 4/15/116 | 8 | 1/4 | 10–18 |
| [Kuru Bir Yer](somewhere_dry/README.md) | 2-3 | 4/14/82 | 4 | 1/2 | 10–18 |
| [Tutulmayı Bekleyenler](those_who_watch/README.md) | 6-5 | 5/23/137 | 12 | 3/5 | 20–35 |
| [Açık Yol](open_road/README.md) | 5-5 | 4/13/77 | 4 | 1/2 | 10–18 |
| [Arşiv Nöbeti](archive_watch/README.md) | 4-5 | 4/10/54 | 8 | 3/8 | 15–25 |
| [Ödünç Bir Sandalye](borrowed_chair/README.md) | 3-5 + şölen tamamlanması | 3/5/37 | 2 | 0/0 | 3–5 |

Toplam **34 bölüm, 134 sahne, 1.028 replik/anlatım satırı, 88 tam seçim yolu ve 32 karşılaşma tasarım varyantı**. Satırların 35’i kaynak canon’dan aynen korunur; 993’ü yeni yazımdır. Süreler aktif ilk tur tahminidir; cihazda ölçülmedi ve günlük bekleme/farm içermez.

Her pakette bütün bölüm scriptleri, birleşik script, sahne/line ID’leri, seçim sonuçları, graph, karşılaşma brief’leri, replay/state sözleşmeleri, StoryScene JSON export’ları, VO listesi, medya ihtiyaçları ve ayarlanabilirlik/üretim notları bulunur. Oyuncu metni İngilizce; yapım notları Türkçe. Japonca çeviri/kayıt ve yeni medya dosyaları henüz üretilmedi.

[Tasarım ve uyum raporu](DESIGN_REVIEW.md) · [88 yol/VM doğrulaması](VALIDATION_SUMMARY.json) · [Paketler arası kontrol](CROSS_PACKAGE_VALIDATION.json) · [Combat uygulanabilirlik](COMBAT_FEASIBILITY_SUMMARY.json).

Story export’ları mevcut grammar ile doğrulandı. Event graph, gate/completion alias’ları, güvenli seçim/resume/replay akışı, gerçek roster/skill/AI ve asset eşlemeleri oyun framework’üne ayrıca bağlanacak. Combat fixture’ları yalnız QA kaynağıdır; canlı patch’e alınmaz. Ödül belirlendiğinde server claim kuralları ayrıca tanımlanacak.
