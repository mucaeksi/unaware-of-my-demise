> **2026-10-10:** The Godot mapping in this folder (scene paths, `Game.attach`, `SceneTree.quit()`, engine splash) is obsolete — Phaser 4 scenes replace it. The HTML wireframes and UI specs remain useful as *design references only*; the final UI is rebuilt with Google-generated art.

# Son owner kararı — görsel tasarım devri

Önceki UI/görsel adayların tamamı owner tarafından reddedildi ve [arşivlendi](../archive/visuals_rejected_2026-10-05/README.md). Yeni UI, buton, ikon ve chibi dili **yalnız owner'ın afişinden** türetilecek; eski panolar referans değildir. [Dış tasarım AI'ı için ilk prompt](../design/EXTERNAL_DESIGNER_INTRO_PROMPT_TR.md). Mevcut kod/binding altyapısı yeni assetler gelene kadar geliştirme scaffold'ıdır. Aşağıdaki uygulama kayıtları tarihseldir.

---

# UOMD — UI Tasarım Çalışması

**Ortak Godot temeli / 2. adım:** [ART_SYSTEM_V02](../design/ART_SYSTEM_V02.md), aktif UiTheme/UiKit, oyun logo adayları, ikon/button/frame/modal ailesi ve [1080×1920 panolar](../art/system/v02/README.md). Eski HTML DESIGN_DRAFT ve reference lock kayıtları tarihsel kalır; tek tek oyuncu ekranlarının final tasarımı tamamlanmış değildir.

Durum: prototipler **DESIGN_DRAFT**; Godot’un native logosu geri açıldı, logolu Studio/StartupSequence ve mevcut Title bağlantısı yerel olarak kontrol edildi. [Güncel logolu açılış](../design/STUDIO_SPLASH_V02.md), [doğrulama](../art/studio/VERIFY_V02.json). Kullanıcı yönlendirmesi: AFK Arena benzeri gezinme ve sunum; daha karanlık tema ve oyunun kendi mekanikleri. Oyuncu arayüzü/altyazı İngilizce, seslendirme Japonca. Seçili Narrative kaynakları BATCH-0005 ile main'e aktarıldı.

**Son yönlendirme — 2026-10-05:** [yeniden başlangıç promptu](../design/CREATIVE_RESTART_PROMPT.md) ve [döküm](../design/WORK_COMPLETED_2026-10-05.md) yeni sanat kararını/sırayı kaydeder. Her tasarım adımı gerçek Godot entegrasyonunu da içerir. Dünya/karakter okuması ve ilk sanat adayları sonrasında açılış sahneleri uygulandı. Ana tema owner tarafından daha sonra sağlanacak; şimdilik sessiz rezervasyon var. Eski görsel pack'ler tarihsel olarak korunur. Final title/entry UI ve Fadyme paketleri açık.

Bu alan tasarım kaynağıdır. HTML prototip örnek verilerle çalışır; satın alma, ödül, ilerleme, giriş veya gerçek oyuncu hesabında işlem yapmaz. Gerçek Godot bağlantıları registry'de ekran bazında ayırt edilir; tarihsel referans byte'ları korunur.

- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md): renk, tipografi, bileşenler ve davranışlar.
- [SCREEN_MAP.md](SCREEN_MAP.md): ekran/alt ekran haritası ve mevcut mekaniklerle eşleme.
- [SCREEN_SPEC.md](SCREEN_SPEC.md): her ekranın yerleşimi, davranışı ve üretim durumları.
- [IMPLEMENTATION_BACKLOG.md](IMPLEMENTATION_BACKLOG.md): önceliklendirilmiş eksik listesi.
- [LANGUAGE_POLICY.md](LANGUAGE_POLICY.md): ilk girişten itibaren EN metin/altyazı, JA ses kuralı.
- [SCREEN_REGISTRY.json](SCREEN_REGISTRY.json) ve [screens/](screens/README.md): eklenen sayfaların sabit ID'leri, adları, ayrı kaynakları ve Godot hedefleri.
- [ENTRY_SCREEN.md](ENTRY_SCREEN.md) ve [entry/index.html](entry/index.html): v03 SignInScreen/PatchScreen, sağ üst menü, Settings/Help ve Sign Out onayı.
- [prototype/index.html](prototype/index.html): etkileşimli portrait UI prototipi; 14 ekran/alt ekran ve sheet'ler.
- [review.html](review.html): ekran önizlemeleri ve prototip geçişleri.
- `assets/`: yeni tasarım görselleri ve kaynak kayıtları; hiçbir dosya varsayılan olarak approved değildir.
- `previews/`: Chromium ile alınan taslak ekran görüntüleri; ayrı artwork orijinalleri değildir.
- [ENTRY_VERIFICATION.json](ENTRY_VERIFICATION.json): güncel giriş/patch kontrolleri; [verification.json](verification.json): İngilizce sistem wireframe kontrolü. [Önceki giriş kontrolü](archive/ENTRY_VERIFICATION_v002.json) tarihsel kayıttır. Gerçek cihaz/Godot kabulü değildir.

Prototip bağımlılıksız HTML/CSS/JS'tir. HTTP ile incelemek için repository kökünde `python -m http.server 8765` çalıştırıp `/narrative/ui/review.html` açılır. Kaynak veriyi güncellemek için `python narrative/ui/prototype/sync-source-data.py`; yalnız `sample-data.js` yenilenir. Player demo state bellektedir; yeniden yüklemede sıfırlanır. Giriş taslağının yerel ses/erişilebilirlik tercihleri cihaz depolamasında tutulur; hesap/token verisi saklanmaz. Eski Türkçe v01/v02 screenshot'ları tarihsel tasarım kaydıdır; güncel review v03 İngilizce görselleri kullanır.

Referanslar: `../references/REFERENCE_SET.lock.json`, `../../docs/DECISIONS.md` DEC-0014, `../../game/data/content/chapters_part1.json`, `../../game/data/content/story_script_part1_manifest.json`. Kaynak canon ve onaylı karakter kimlikleri korunur. Yeni hub sahnesi bir UI ortam önerisidir; yeni canon lokasyonu olarak kaydedilmez.

Mevcut prototiplerin üretimi sırasında Gemini hattı/referans seti değiştirilmedi. Son kullanıcı kararıyla yeni görseller Codex üzerinden üretilecek; eski görsel paketlerin ve aktif üretim kuralının geçişi yeni promptta planlıdır. Sağlayıcı/prompt ve eski kaynak izi kayıtlı kalır; ses/müzik hattı ve owner'a ait ana tema korunur.
