# SovTaym açılışı — tam çözünürlüklü önizleme

2026-10-05. Owner düşük çözünürlüklü önizlemeleri ve açılmayan yerel sohbet bağlantılarını bildirdi. Bu teslim gerçek Godot render'ını oyun hedefi olan **1080×1920** ölçüde paylaşır.

| Dosya | Ölçü | Kaynak |
| --- | --- | --- |
| [Stüdyo sayfası](studio_1080x1920.png) | 1080×1920 PNG | Gerçek main scene'in viewport'u; amblem, yazılar ve shader birlikte |
| [Açılış videosu](cold_boot_1080x1920.mp4) | 1080×1920 H.264 MP4, 30 fps, 12 saniye | Native Godot → SovTaym → mevcut TitleScreen; X11 ekran kaydı |
| [Native Godot frame](native_godot_1080x1920.png) | 1080×1920 PNG | Yukarıdaki videonun 1,2. saniyesi; motorun kendi resmi |
| [Mevcut title](title_1080x1920.png) | 1080×1920 PNG | Hazır title, tap/account request olmadan; final artwork bekler |
| [Şeffaf logo kaynağı](../../v01/emblem.png) | 1254×1254 RGBA PNG | Üretilen orijinal; runtime kopyası aynı byte'lar |

Önceki 360×640 ve 390×844 dosyalar küçük telefon yerleşim kontrolüydü. Buradaki PNG/video onlar büyütülerek hazırlanmadı: Godot doğrudan 1080×1920 pencerede çalıştırıldı. Ekrandaki amblem 720×720 alana oturur; kaynağın ayrıntısı bu kullanım için yeterlidir. Daha büyük baskı/master kullanımında 1254 kaynağı yapay biçimde büyütüp yeni ayrıntı varmış gibi sunulmaz.

Görsel sohbet içinde doğrudan gösterilir. İndirme/yeniden açma için GitHub dosya sayfaları kullanılır; `/workspace/...` yerel yolları sohbet indirme bağlantısı değildir. Repo private olduğundan owner'ın GitHub hesabı ile oturum açması gerekir. Bu klasördeki dosyalar GitHub'da açılarak download/raw düğmesiyle alınabilir.

[Capture kaydı](capture.json), [ölçü/hash/doğrulama kaydı](VERIFY_HD.json). Test runtime'ı Godot 4.6.3; hedef 4.7.2/Android kabulü bekler. Müzik dosyası henüz gelmediği için video sessizdir. Scene/script veya çalışma çözünürlüğü ayarı değiştirilmedi; yalnız yeni render ve teslim kaydı eklendi.
