# Bir Tabak, Bir İsim — medya ve yönetim

## Görsel yön

Meydan sabah/hazırlık ve akşam/boş tabaklar ışık varyantlarıyla çalışır. Masa altı, depo yolu ve prova köşesi aynı Oakhaven setinden kadraj olabilir. Yemek, sandalye, şarkı sayfası çevre prop’udur; item drop değildir. Konuk/yardımcı event kapsamındaki adsız NPC’lerdir; portre şartı yok.

Sahne başına kamera/yerleşim yönergesi tam scriptte var. Story export background/show/hide komutlarını kullanır; yönergeler otomatik kamera koreografisi olarak uygulanmış değildir. Portre ekranı solda/sağda iki kişiyi tutar; görünmeyen konuşmacının konuşması isim kutusuyla anlaşılır. NPC’ler portresiz kalabilir; farklı bir hero portresi yerine kullanılmaz.

## Location listesi

| Location ID | Üretim durumu |
|---|---|
| `oakhaven_inn` | Kaynak referans/henüz üretilmedi; asset key mapping gerekir |
| `oakhaven_square` | Kaynak referans/henüz üretilmedi; asset key mapping gerekir |
| `od_outer_lane` | Kaynak referans/henüz üretilmedi; asset key mapping gerekir |
| `od_song_corner` | Kaynak referans/henüz üretilmedi; asset key mapping gerekir |
| `od_storehouse_lane` | Kaynak referans/henüz üretilmedi; asset key mapping gerekir |
| `od_table_work` | Kaynak referans/henüz üretilmedi; asset key mapping gerekir |

## Ses

od_work: hafif günlük iş ritmi; od_threat: yalnız dış yol karşılaşması. Last Song’un kaynak metni korunur; prodüksiyonda sade, kusursuz olmayan toplu bir refrain düşünülebilir. Yeni besteleme/kayıt yapılmadı. Pippa’nın charm’ına ek büyü sesi veya Part II sırrını ima eden cue eklenmez.

Müzik cue’ları: `od_threat`, `od_work`. Dosyalar üretilmedi.

Oyuncu metni İngilizce. Japonca çeviri ve bütün karakter/anlatıcı kayıtları henüz boş; VO_LINE_LIST.csv her line ID’yi aynı kaynak metne bağlar. Konuşmacı kimliği, iç düşünce ve anlatıcı voice track’leri çeviride korunur. Line ID’ler sonraki editlerde mümkünse sabit tutulur; yeni satırlara yeni ID verilir.

## Karakter tonu ve spoiler

Pippa’nın bell charm kökeni, Silent Bell sırrı, Nixie’nin soyu, Jori’nin gizli işleri ve Fadyme’nin kraliyet adı/hastalığının çözümü açılmaz. Canon Inn Meal’deki Fadyme/Mahmut varlığı korunur. Oyuncunun yapmadığı iş yüzünden kimse aç kalmaz; başarı/moral puanı yok.

Şölenin sıcak tonu ve Kera’nın çorba mizahı, iki sosyal tercihin eşit değeri, üç işin sırası ve karakter kapanışları incelenecek. Bu event’i yeni bir boss baskınına büyütmek ritmini bozar.

## Teslim kapsamı

Bütün sahne yönergeleri, İngilizce diyaloglar, emotion ve line ID’ler yazıldı. Yeni görsel, müzik, Japonca metin, ses dosyası veya canlı medya üretimi bu teslimde yok. Ücretli üretim çağrısı yapılmadı. Portre emotion adları mevcut sprite manifest’ine kontrollü eşlenmeli; adı bulunan her emotion için resim var sayılmaz.

[Medya ihtiyaçları JSON](authoring/media_requirements.json) ve [VO tablosu](VO_LINE_LIST.csv).
