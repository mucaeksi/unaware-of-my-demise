> **Güncel owner kararı (2026-10-05): Bu görsel set reddedildi ve [Narrative arşivine](https://github.com/mucaeksi/unaware-of-my-demise/tree/main/narrative/archive/visuals_rejected_2026-10-05) alındı. Yeni stil kaynağı yalnız owner afişidir. Bu sayfadaki eski candidate/aktif ifadeleri tarihsel uygulama kaydıdır. [Yeni tasarım devri](https://github.com/mucaeksi/unaware-of-my-demise/blob/main/narrative/design/EXTERNAL_DESIGNER_INTRO_PROMPT_TR.md).**

# SovTaym logolu açılış — v02

Tarih: **2026-10-05**. Owner, önceki düz yazılı stüdyo sayfasını yetersiz buldu ve Godot’un zaten kendi açılış ekranı olduğunu hatırlattı. Bu revizyon native Godot ekranını geri açar, ek Godot yazılı sayfayı aktif akıştan çıkarır ve SovTaym için özgün amblemli sayfa uygular.

**Aktif sıra:** Godot’un kendi native boot logosu → **SovTaym Studios** → mevcut TitleScreen. Stüdyo adı/çizim **CANDIDATE**, owner final onayı kaydedilmedi. Title’ın final artwork’ü ayrı adımdır; burada mevcut placeholder’a geçiş gösterilir.

## Godot’un kendi sayfası

Projede `application/boot_splash/show_image=false` vardı. `true` yapıldı; custom `boot_splash/image` atanmadı. Godot böylece kendi derlenmiş logo görselini kullanır. `minimum_display_time=1200` ms, siyah fon. Kontrol kaynağı: [Godot 4.6.3 main.cpp](https://github.com/godotengine/godot/blob/4.6.3-stable/main/main.cpp#L3829); standart boot görseli fallback’i aynı dosyanın 3877–3887 satırlarındadır. Yerel runtime’ın gerçek native ekranı videoda ve [çıkarılan frame’de](../art/studio/previews/native_godot_360x640.png) görüldü; PNG bizim çizdiğimiz Godot taklidi değildir.

`EngineSplashScreen` artık StartupSequence tarafından preload/instantiate edilmez. Eski sınıf/scene yalnız önceki adımın tarihsel inceleme kaydı için yerinde tutulur, registry’de **RETIRED_FROM_STARTUP**. Android’in sistem açılışı ve Godot’un motor boot’u uygulama sahnesi değildir; gerçek APK/cihaz burada çalıştırılmadı. Hedef 4.7.2, test runtime’ı 4.6.3.

## SovTaym sayfası

Logo fikri, iki kuzgun kanadının çevrelediği kum saati: zaman ve hikâye üretimi için ayrı stüdyo kimliği. İşlenmiş gümüş, eskitilmiş altın, küçük bordo oyuklar ve tepesi açık ince halka. Bu, oyun dünyasının yeni canon sembolü değildir. Oyun karakteri/çan/taç/kılıç logosu kullanılmadı.

Amblem OpenAI imagegen ile **gerçek alpha** olarak üretildi; kaynak **1254×1254 RGBA**, byte’ları değiştirilmeden Godot’a kopyalandı. [Amblem](../art/studio/v01/emblem.png), [prompt](../art/studio/v01/logo.prompt.txt), [üretim izi](../art/studio/PROVENANCE.json). Kaynak PNG üzerinde sonradan resize, crop, alpha temizleme veya yazı montajı yapılmadı. Native `Label` katmanları Cinzel ile **SovTaym / STUDIOS**, Inter ile **PRESENTS** yazar; amblem ve yazılar editörde ayrı node’lardır.

Gerçek scene: `res://scenes/ui/startup/studio_splash_screen.tscn`. Koyu, hafif dokulu zemin iki yumuşak ışık alanıyla shader içinde çizilir; shader parent modulate/alpha’yı korur. Logo aspect-centered, safe area içinde; wing/hourglass uçları kesilmez. Atmosfer statiktir, app pause sırasında gizlice hareket eden TIME efekti yoktur.

Studio fade-in 1 saniye → hold 3 saniye → fade-out 1 saniye → title reveal 1,2 saniye: oyun kontrollü bölüm **6,2 saniye**, sine/ease-in-out. Önceki ikinci Godot sayfası bu sürenin parçası değildir. İçerik yüklemesi/erken tap/readiness, retry cancellation, pause/resume ve gerçek oyuncu yönlendirmesi korunur.

Owner ana teması hâlâ yok. `bgm_main_theme.ogg` rezervasyonu ve aynı AudioDirector/cursor devam eder; müzik script’in çalışabildiği ilk **stüdyo** frame’inde yükselmeye başlar. Native Godot ekranında script müziği başladığı iddia edilmez. Gerçek dosya gelene kadar sessizlik.

## Gerçek önizleme

- **Güncel tam çözünürlüklü teslim:** [1080×1920 stüdyo PNG](../art/studio/previews/v02_1080/studio_1080x1920.png), [1080×1920 gerçek cold-boot MP4](../art/studio/previews/v02_1080/cold_boot_1080x1920.mp4), [native Godot frame](../art/studio/previews/v02_1080/native_godot_1080x1920.png), [ölçü ve kontrol kaydı](../art/studio/previews/v02_1080/VERIFY_HD.json). Küçük önizlemeler büyütülmedi; gerçek Godot viewport'u hedef çözünürlükte yeniden render edildi. Şeffaf logo kaynağı 1254×1254, ekrandaki TextureRect 720×720; logo source/runtime byte'ları aynı.
- Önceki sohbet teslimindeki `/workspace/...` bağlantıları yalnız çalışma ortamının yerel yollarıydı. Güncel teslimde görsel sohbet içinde doğrudan gösterilir ve gerçek GitHub dosya bağlantıları kullanılır. Private repo için owner'ın GitHub hesabında oturum açması gerekir.
- [360×640 stüdyo](../art/studio/previews/v01_360/studio_360x640.png)
- [390×844 stüdyo](../art/studio/previews/v01_390/studio_390x844.png)
- [Native Godot → studio → mevcut title videosu](../art/studio/previews/cold_boot_v02_360x640.mp4): gerçek main scene, X11 ekran kaydı, 30 fps, 12 saniye, ses dosyası olmadan. Title’a dokunulmadı ve hesap isteği başlatılmadı.
- [Doğrulama kaydı](../art/studio/VERIFY_V02.json): actual kaynak/hash, parse/render, 30 ilgili GUT testi ve sürüm/kapanış sınırları.

Çalışma sırasında teknik ekibin `b65a387` main değişiklikleri alındı ve korundu. Yalnız yayımlanmamış sanat commit’i rebase edildi; D-16 metni güncellenirken yeni D-17/D-18/D-19 satırları tutuldu. Birleşmiş main’de **33/33** ilgili test ve [yeni studio render’ı](../art/studio/verification/v02/studio_integrated_390x844.png) doğrulandı. Önceki 30-test/video kaydı ilk sanat ağacının kanıtıdır; bu son kontrol güncel teknik akışla birlikte çalışmayı kapsar.

Yerel 4.6.3 test kopyası, önceki adımda belgelenen iki GUT-only uyumluluk düzenlemesini kullanır; production GUT/pin değiştirilmedi. Hedef 4.7.2/Android kabulü ve gerçek müziği dinleme açık. Main push `[skip ci]` ile yapılır; mevcut CI → production deploy zinciri sanat kaydıyla otomatik tetiklenmez. Backend/hesap/progression ve eski görsel/audio orijinalleri değiştirilmez.
