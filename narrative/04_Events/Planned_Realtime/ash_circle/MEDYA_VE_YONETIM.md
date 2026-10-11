# Medya ve içerik yönetimi

Yeni medya veya paid API çağrısı yapılmadı. Bu paket üretilecek varlıkların listesi ve source script'tir. 1000 TL/ay proje bütçesinin hangi batch'e ayrılacağı gerçek maliyet tahminiyle ele alınır; burada fiyat/ödül/monetization seçilmez.

Tek arena painting, 512 birim tile kırpımı ve max2048 atlas önerisiyle ele alınır. 4096×3072 tek RGBA görüntü yaklaşık48 MiB ham GPU texture'dır (mipmap/ek kopyalar hariç); bu yüzden çoğaltılmış 9 fon için dokuz fulltexture yüklenmez. Landmark VN görüntüleri aynı kaynak resmin kadrajı olabilir. Hasar alanları fotoğrafın içine çizilip görünmez hale getirilmez; warning vector/shape katmanı üstte kalır.

Beş enemy atlas family, 10 role-prop boss silhouette,20 hero için mevcut approved chibi kaynak uyumluluğu,6 attack family effect ve ortak warning ikonları gerekir. Mevcut approved art olsa bile yürüyüş yönleri, pivot, hurt radius, frame süreleri ve atlas padding'i tekrar denetlenir. Portreler rig veya hareket sprite'ı sayılmaz. Mera/Tovin başlangıçta text-only olabilir; yeni portreler opsiyoneldir. Portrait placeholder üretimde approved kaliteyi taklit ettiğini iddia etmez.

VO_LINE_LIST bütün İngilizce satırlar ve stable line ID içerir. Japonca text_ja boş, recording_status not_recorded. Player-facing UI/briefing/hint English; Türkçe üretim notları runtime metni değildir. Localize sonrası say600 char ve option120 char sınırları/scene max400 tekrar doğrulanır. JP timing'de pause edilen VN nedeniyle savaş zorluğu farklılaşmaz. Cast direction yalnız scriptteki emotions/direction üzerinden yapılır; aile adı veya kadın karakter stereotype eklenmez.

Tek work music loop ve boss stems opsiyoneldir. Tema içinde yeni bir dünya bell'i icat eden sekizinci çan sesi kullanılmaz. Hazard warning kapatılabilir SFX olsa da kontur ve yön görünür kalır. Çoklu attack sesleri throttled; her spawn aynı yüksek sesi çalmaz. Ses kapalı cihazda chapter kazanılabilir olmalıdır.

Control Center önizlemesi kaynak hash, gate mapping, min client, sim revision, schema digest, scene references ve media fallback durumunu göstermelidir. Rank/chapter tabloları strict schema'dan geçmeden kaydedilmez. Destructive ID rename yerine migration mapping. Unknown enemy/card/op/revision publish'i reddeder. Yayın compatibility check'i runtime toggle'ı varsayılan kapalı tutar. Package-only content deploy çalışması event'in hesabında açılması anlamına gelmez.
