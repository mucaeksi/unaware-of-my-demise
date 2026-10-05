# Reddedilen görseller — 2026-10-05

Owner: **“Yaptığımız bütün Görselleri Arşivle Narrative içerisinde. Hiç birini beğenmedim, farklı yere yaptırtacağım.”**

**REJECTED_BY_OWNER / HISTORICAL_ONLY.** Bu arşiv onaylı görsel yön veya yeni üretimin referans seti değildir. Yeni tasarım dış AI'dan gelecek; owner'ın gönderdiği sonuçlar uygun Godot tüketicilerine paket paket eklenecek.

[MANIFEST.json](MANIFEST.json): **222 dosya, 123 görsel/video/SVG, 44.437.959 byte**. Kaynak/varyant/PNG/SVG/MP4, eski UI ve entry önizlemeleri, HTML/CSS mockup'ları, prompt/provenance/doğrulama belgeleri ve runtime görsel karşılıkları orijinal byte'larıyla `files/<orijinal repo yolu>` altında saklandı. Altı özgün imagegen çıktısının tamamı arşivde aynı SHA-256 ile bulundu.

- Key art v01/v02; SovTaym logosu ve bütün açılış capture/video'ları; oyun amblemi v001/v002, ortak ikon/çerçeve/tema materyali ve bütün sanat sistemi panoları.
- Önceki Narrative UI PNG'leri, hub arka planı, entry/prototype dosyaları.
- Son, henüz commit edilmemiş Android ikon kaynağı, mono SVG, 1024/512/192/64/48/32 export'ları, 432px adaptive katmanları ve hazırlanan fakat çalıştırılmayan review script'i. **APK/AAB/cihaz/maske kabulü yok; review PNG üretildiği iddia edilmez.**

Android app icon'un yeni project/export ayarları geri alındı; yeni beş runtime dosyası arşivlendikten sonra kaldırıldı. Çalıştırılan Xvfb durduruldu. Godot projesinin bu turdaki runtime diff'i boş.

Önceden commit edilmiş staging/runtime dosyaları, mevcut linkleri ve teknik bağlantıları kırmamak için orijinal yerlerinde de korunur. Mevcut oyunda bunları gösteren yerler **reddedilmiş geçici geliştirme placeholder'larıdır**; yeni final sanat onayı sayılmaz. Aktif kabul durumu [ACTIVE_ART_SET.json](../../art/ACTIVE_ART_SET.json) tarafından geçersiz kılınır. İşlevsel tema/buton/modal/akış kodu sırf görsel reddedildi diye sökülmedi; yeni teslimler geldiğinde bu tüketicilere bağlanacak.

Drive/Legacy orijinalleri, Narrative'deki tarihsel sheet/reference lock'ları, canon, oyun içeriği ve voice/music değiştirilmedi. Native Godot logosunun screenshot'ta bulunması o üçüncü taraf logonun owner'a ait veya reddedilmiş bir tasarımımız olduğu anlamına gelmez.

Yeni başlangıç: [dış tasarım AI'ı için ilk prompt](../../design/EXTERNAL_DESIGNER_INTRO_PROMPT_TR.md). Bu prompt görsel üretim görevinin devrini anlatır; bizim kesin sonraki işimiz owner'ın tasarım/asset teslimlerini alıp uygun Godot alanlarına entegre etmektir.
