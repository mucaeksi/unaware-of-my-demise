# UOMD — UI Tasarım Çalışması

Durum: `DESIGN_DRAFT`. Kullanıcı yönlendirmesi, 2026-10-04: AFK Arena benzeri gezinme ve sunum; Unaware of My Demise'in daha karanlık teması ve kendi mekanikleri. Önce ana menüden başlayan tüm UI tasarımı; Godot uygulaması ve Narrative aktarımı sonraki aşamalar.

Bu alan tasarım kaynağıdır. Prototip örnek verilerle çalışır; satın alma, ödül, ilerleme, giriş veya gerçek oyuncu hesabında işlem yapmaz. Runtime ve kilitli referans dosyalarını değiştirmez.

- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md): renk, tipografi, bileşenler ve davranışlar.
- [SCREEN_MAP.md](SCREEN_MAP.md): ekran/alt ekran haritası ve mevcut mekaniklerle eşleme.
- [SCREEN_SPEC.md](SCREEN_SPEC.md): her ekranın yerleşimi, davranışı ve üretim durumları.
- [IMPLEMENTATION_BACKLOG.md](IMPLEMENTATION_BACKLOG.md): önceliklendirilmiş eksik listesi.
- [prototype/index.html](prototype/index.html): etkileşimli portrait UI prototipi; 14 ekran/alt ekran ve sheet'ler.
- [review.html](review.html): ekran önizlemeleri ve prototip geçişleri.
- `assets/`: yeni tasarım görselleri ve kaynak kayıtları; hiçbir dosya varsayılan olarak approved değildir.
- `previews/`: Chromium ile alınan taslak ekran görüntüleri; ayrı artwork orijinalleri değildir.
- `verification.json`: tarayıcı kontrol sonuçları; gerçek cihaz/Godot kabulü değildir.

Prototip bağımlılıksız HTML/CSS/JS'tir; `prototype/index.html` dosyası tarayıcıda doğrudan açılabilir. HTTP ile incelemek için repository kökünde `python -m http.server 8765` çalıştırıp `http://localhost:8765/narrative/ui/review.html` açılır. Kaynak veriyi güncellemek için `python narrative/ui/prototype/sync-source-data.py`; yalnız `sample-data.js` yenilenir. Player demo state bellektedir; yeniden yüklemede sıfırlanır.

Referanslar: `../references/REFERENCE_SET.lock.json`, `../../docs/DECISIONS.md` DEC-0014, `../../game/data/content/chapters_part1.json`, `../../game/data/content/story_script_part1_manifest.json`. Kaynak canon ve onaylı karakter kimlikleri korunur. Yeni hub sahnesi bir UI ortam önerisidir; yeni canon lokasyonu olarak kaydedilmez.

Gemini görsel hattı bu çalışma sırasında silinmez. Yeni tasarım görsellerinin sağlayıcısı ve prompt'u ayrı kaydedilir; ses/müzik hattı ve owner'a ait ana tema korunur.
