# Son Geçen İçin — medya ve yönetim

## Görsel yön

Forest junction ana kadraj; scout bend ve brace bank yakın kadrajları; forest passage savaş zemini. Aynı orman setinin dört location ID’siyle eşlenebilir, dört ayrı büyük illüstrasyon zorunlu değildir. Devrilmiş/ayakta işaret ve yaprak/kiriş varyantları çevre prop’udur; büyü mührü, isim silinmesi veya kraliyet clue’su çizilmez.

Sahne başına kamera/yerleşim yönergesi tam scriptte var. Story export background/show/hide komutlarını kullanır; yönergeler otomatik kamera koreografisi olarak uygulanmış değildir. Portre ekranı solda/sağda iki kişiyi tutar; görünmeyen konuşmacının konuşması isim kutusuyla anlaşılır. NPC’ler portresiz kalabilir; farklı bir hero portresi yerine kullanılmaz.

## Location listesi

| Location ID | Üretim durumu |
|---|---|
| `lt_brace_bank` | Kaynak referans/henüz üretilmedi; asset key mapping gerekir |
| `lt_forest_junction` | Kaynak referans/henüz üretilmedi; asset key mapping gerekir |
| `lt_forest_passage` | Kaynak referans/henüz üretilmedi; asset key mapping gerekir |
| `lt_scout_bend` | Kaynak referans/henüz üretilmedi; asset key mapping gerekir |

## Ses

lt_work: sakin orman/yol dokusu; lt_threat: kısa savaş geçişi. Yaprak ve yere sürtünen staff/ölülerin tıkırtısı gözlem sağlar; yeni Law of Hours kuralı veya kehanet sesi değildir. Yolcunun son geçişinde zafer fanfarı yerine doğal adımlar uygun.

Müzik cue’ları: `lt_threat`, `lt_work`. Dosyalar üretilmedi.

Oyuncu metni İngilizce. Japonca çeviri ve bütün karakter/anlatıcı kayıtları henüz boş; VO_LINE_LIST.csv her line ID’yi aynı kaynak metne bağlar. Konuşmacı kimliği, iç düşünce ve anlatıcı voice track’leri çeviride korunur. Line ID’ler sonraki editlerde mümkünse sabit tutulur; yeni satırlara yeni ID verilir.

## Karakter tonu ve spoiler

Brin’in babası ve Two Roofs companion olayı yeniden anlatılmaz. Nixie’nin gerçek soyu, false-map veya home/registry sırları çözülmez. Yolcu kayıp kraliyet tanığı, gizli düşman veya önemli yeni karakter yapılmaz. Shrine kaydı gereksiz ilan edilmez; ekip yol temizlemektedir, resmi kayıt tutmamaktadır. Brin’in 2-1’deki ayrılışı korunur.

Küçük yan görev ölçeği, iki yöntemin eşit geçerliliği ve Brin’in yardımı paylaşması incelenecek. Yöntem seçiminde başarısızlıkla bir yolcuyu öldüren gizli doğru cevap eklenmez.

## Teslim kapsamı

Bütün sahne yönergeleri, İngilizce diyaloglar, emotion ve line ID’ler yazıldı. Yeni görsel, müzik, Japonca metin, ses dosyası veya canlı medya üretimi bu teslimde yok. Ücretli üretim çağrısı yapılmadı. Portre emotion adları mevcut sprite manifest’ine kontrollü eşlenmeli; adı bulunan her emotion için resim var sayılmaz.

[Medya ihtiyaçları JSON](authoring/media_requirements.json) ve [VO tablosu](VO_LINE_LIST.csv).
