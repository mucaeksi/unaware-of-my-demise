# Narrative / UI checkpoint — 2026-10-05

Bu kayıt Narrative ve UI tasarım işine aittir. Infrastructure ekibinin `active.md` kaydı ve runtime değişiklikleri ayrı sahipliktedir.

## Tamamlanan kaynak aktarımı

- Main commit: `395c4b909c62cd0c883b546d3aa542e09fe46b06` / BATCH-0005. LEGACY Narrative `1Xw7Hqw4RDdeYeaiJiaX_Rjt9bbcxuXkK` canlı olarak listelendi: 558 kayıt; ayrıca root GDD okundu.
- 163 seçili dosya aktarıldı; 26 kilitli referans yeniden kullanılmak üzere doğrulandı. Drive orijinalleri, kaynak byte'ları ve statüleri korundu. Her dosya ID/yol/hedef/hash/boyut/Git blob kaydıyla [manifestte](../../docs/migration/BATCH-0005.manifest.json).
- 55 mevcut referans/runtime dosyası `7440328` main baseline'ına göre değişmedi. 12 PNG ve 29 OGG decode; kaynak JSON ve 13 üretim scripti statik okuma kontrolü geçti. Legacy scriptleri çalıştırılmadı.
- 20 karakter paketi, canon/story/lore/art/audio/tools dizinleri ve indeksleri düzenlendi. Eski Story Bible/canon kopyaları archive'da korunur.
- Runtime'a otomatik içerik terfisi yapılmadı. [Eksikler/farklar](../../narrative/migration/RECONCILIATION.md): 10 kaynak repliği, 2 metin farkı, music cue ve unlock kayıpları; stale costume/weapon çelişkileri; JP editör ve eksik seçili ses işleri.

## UI / 01 — ilk giriş

- [ENTRY_SCREEN.md](../../narrative/ui/ENTRY_SCREEN.md), [entry/index.html](../../narrative/ui/entry/index.html): onaylı logo içeren key art ile bağımsız giriş v02 taslağı. Asset byte'ları değişmedi.
- Release → native Google/session → snapshot sırası mevcut main koduyla eşlendi. İlk/dönen oyuncu ve bağlantı/iptal/hesap yok/unavailable/bakım/app update/content update/snapshot hata durumları yerel örnek akışla gösterilir.
- [ENTRY_VERIFICATION.json](../../narrative/ui/ENTRY_VERIFICATION.json): tarayıcı ölçümleri/akış kontrolleri. Gerçek hesap, Godot veya Android cihaz kabulü değildir. Ses düğmesi görsel durum; ana tema korunur.
- Godot/runtime/server/deploy değişikliği yapılmadı. Başarılı örnek geçiş eski Sığınak prototipindeki örnek roster/cüzdana gider; bu veriler gerçek yeni oyuncu başlangıcı değildir.

## Sonraki iş

İlk giriş tasarım değerlendirmesinden sonra Sığınak ana menüsünü ve ortak UI bileşenlerini ayrıntılandır. Tüm ekranları aynı tasarım diliyle sırayla ilerlet; çalışma sırası [SCREEN_MAP.md](../../narrative/ui/SCREEN_MAP.md). Godot bağlantısı ayrı uygulama aşaması. Kaynak/runtime Narrative farklarını bağımsız, ID/spoiler/VO/music korunarak ele al; hikâye veya karakter tasarımını yeniden üretme. Kilitli referans seti ve owner'a ait ana tema değiştirilemez.
