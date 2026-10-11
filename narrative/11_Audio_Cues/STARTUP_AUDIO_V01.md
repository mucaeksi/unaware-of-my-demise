> **Archived 2026-10-10:** historical v01 record of the retired Godot engine splash. The Phaser build has no engine splash; the active studio flow is `STUDIO_SPLASH_V02.md` (its Godot-logo steps are likewise obsolete).

# Godot → stüdyo → title ve gelecekteki ana tema — v01

**Tarihsel v01 kaydı.** Owner’ın ek Godot yazılı sayfa ve düz stüdyo yazısını düzeltme isteğiyle aktif akış [SovTaym logolu açılış v02](STUDIO_SPLASH_V02.md) olarak güncellendi: Godot’un native logosu → logolu studio → mevcut title. Aşağıdaki v01 süreleri/görüntüleri kendi ilk commit aşamasına aittir.

Tarih: **2026-10-05**. Uygulama durumu: **IMPLEMENTED**, yerel Godot **4.6.3** kontrolü. Hedef **4.7.2 Standard** ve Android cihaz kabulü açık. Engine/stüdyo yazıları **CANDIDATE**; SovTaym Studios adı **PRELIMINARY**. Title’ın son sanat tasarımı bu adımda tamamlanmadı.

Owner, ana tema dosyasının henüz hazır olmadığını ve sonradan eklenecek şekilde hazırlanmasını istedi. Ayrılan yol **`game/assets/audio/music/bgm_main_theme.ogg`**. Dosya şu an yok; boş ses dosyası veya Fadyme temasıyla ikame edilmedi. [Teslim/kurulum notu](../../game/assets/audio/music/README.md).

## Gerçek açılış bağlantısı

Mevcut `main.tscn` → AppShell → StoryDirector, mevcut TitleScreen’i kurar ve üstüne [StartupSequence](../ui/screens/startup_sequence.md) ekler. İlk oyun kontrollü sahne [EngineSplashScreen](../ui/screens/engine_splash_screen.md), sonra [StudioSplashScreen](../ui/screens/studio_splash_screen.md), sonra mevcut [TitleScreen](../ui/screens/title_transition_screen.md). Godot’un native boot ekranı siyah kalır; script/audio başlamadan önce burada müzik çaldığı iddia edilmez.

Yazılar ilk kurulumda bulunan Cinzel/Inter fontlarını ve ortak Gothic aday paletini kullanır. Motor/stüdyo wordmark’ları ortalanır, SafeAreaContainer içindedir; stüdyo için final bir amblem çizilmiş sayılmaz. Dört görsel fade 1 saniye, engine hold 1,8 saniye, stüdyo hold 2,2 saniye, title reveal 1,2 saniye: toplam 9,2 saniye. Eğri sine/ease-in-out; süreler export parametreleridir ve son owner onayı değildir.

İçerik mevcut worker üzerinden yüklenmeye devam eder. Title’ın başlatma kapısı hem intro hem yükleme tamamlanınca açılır. Overlay pointer girişini tutar; kodla verilen erken title tap mevcut pending-start davranışını korur. Retry/content-update restart intro’yu iptal eder ve yeniden oynatmaz. Back mevcut title quit yolunu kullanır. App pause/focus-out tween’i durdurur; resume kaldığı yerden sürdürür.

Release gate, Google/session, patch ve snapshot servisleri mevcut title başlatmasından sonra çalışır. Bu adım onları intro’nun arkasında çalışıyor gibi göstermedi, ayrı auth/patch sayfalarını tamamlamadı. D-15 notices/hukuki metinler açık kalır. Yeni oyuncu opening/tutorial, dönen oyuncu Hub ve açık savaş recovery yolları korunur.

## Dosya geldiğinde

AudioDirector’ın `play_entry_theme()` çağrısı, gerçek `flow.title` eşlemesi varsa onu kullanır; yoksa **gelecek dosya için ayrılan** `bgm_main_theme` yolunu arar. `audio_cues_part1.json` içindeki null değerler değiştirilmedi ve bir kaydın teslim edildiği iddia edilmedi. Böylece eski/null content pack’leri de dosya sonradan eklendiğinde çalışır.

Ana tema ilk oyun kontrollü Godot sahnesinde yaklaşık −60 dB’den 5 saniyede player gain 0 dB’ye yükselir; kullanıcının kaydedilmiş Music bus düzeyi/mute tercihi korunur. OGG yalnız playback kopyasında loop edilir, import/cache kaynağı değiştirilmez. Aynı cue tekrar istendiğinde player, stream, cursor ve devam eden fade korunur. Engine → Studio → Title → mevcut giriş/patch boyunca aynı Audio autoload çalışır. Uygulama arka plandayken başlatılan bir ses/fade de resume’u bekler.

Eksik kayıt sessizliktir, `Audio.missing()` içine bir kez girer. Yeni oyuncunun opening sahnesine geçerken entry müziği 1,2 saniyede bırakılır; hikâye cue’su varsa mevcut VN sistemi devralır. Hub/recovery mevcut `flow.hub` yolunu kullanır. Gerçek ana tema geldiğinde dosya ilk Android paketine konulmalı; loop dikişi, seviye ve cihaz/focus davranışı ayrıca dinlenmelidir.

## Önizleme ve doğrulama

[Doğrulama kaydı](STARTUP_VERIFY_V01.json), actual viewport screenshot’ları, test kapsamı, geçici GUT uyumluluk düzenlemeleri ve sürüm sınırlarını tutar. Görseller gerçek `main.tscn` cold start’ından alındı; title tap/account request yapılmadı. Title capture hâlâ eski placeholder’ı gösterir.

| Ekran | Küçük telefon | Uzun telefon |
|---|---|---|
| Godot | [360×640](../art/direction/previews/startup/engine_360x640.png) | [390×844](../art/direction/previews/startup_tall/engine_390x844.png) |
| Stüdyo | [360×640](../art/direction/previews/startup/studio_360x640.png) | [390×844](../art/direction/previews/startup_tall/studio_390x844.png) |
| Mevcut title | [360×640](../art/direction/previews/startup/title_360x640.png) | [390×844](../art/direction/previews/startup_tall/title_390x844.png) |

Yeniden capture: `DISPLAY=:99 godot --path game --audio-driver Dummy --resolution 360x640 res://tools/startup_capture.tscn -- --startup-capture-dir=/absolute/output`. Developer helper yalnız capture için kullanılır, runtime ana scene değildir. Scene/script `tools/*`, sessiz test fixture’ı `tests/*` altındadır; mevcut Android export filtresi bunları paket dışında tutar.

Yerel GUT 9.7.1, Godot 4.6.3’te `AccessibilityServer` ve inferred `StringName`/null nedeniyle iki parse hatası verdi. Depodaki GUT ve engine pin değiştirilmedi. Geçici QA kopyasında yalnız mevcut olmayan singleton referansı çıkarıldı ve `return_val` açık `Variant` yapıldı; bu kontrol 4.7.2 CI kabulü değildir. Gerçek ana tema hazır olmadığı için müzikal kalite/loop seam kabulü yapılamadı; 80 ms dijital sessizlik yalnız test fixture’ıdır ve oyun cue’suna bağlı değildir.

Bu kopyada 29 startup/first-launch/audio testi geçti. Tam suite 344 testin 343’ünü geçti; tek başarısız test engine pin kontrolüdür (yerel 4.6.3, hedef 4.7.2). Bütün 46 script raporda bulunur, SCRIPT ERROR yoktur. Üç audio validator testi, içerik audit’i ve manifest kontrolü geçti. Import/capture/test kapanışlarında ObjectDB/tek resource uyarısı kaydedildi; nedeni bu adımda çözülmedi. Capture process’leri 0 ile çıktı; bunlar cihaz kabulü değildir.

Main’e normal push restart talimatının parçasıdır. Mevcut `deploy.yml`, main CI başarılı olduğunda üretim deploy’unu otomatik başlatır. Sanat işiyle otomatik deploy tetiklememe sınırı nedeniyle bu kayıt commit’i `[skip ci]` kullanır; workflow’lar değiştirilmez, hedef 4.7.2/Android CI kabulü yapılmış sayılmaz. Yerel tam rapor ve iki scratch-only GUT düzenlemesi kanıt dizininde korunur.

Önceki [kaynak okuma](SOURCE_REVIEW_2026-10-05.json) ve [ilk sanat doğrulaması](../art/direction/VERIFY_V01.json) kendi başlangıç snapshot’larının kayıtlarıdır. Bu uygulama onların hash’lerini yeniden yazmaz; kasıtlı yeni runtime/doc farkları yeni doğrulama kaydında listelenir. Canon, kaynak hikâye, seçilmiş voice/music orijinalleri ve tarihsel görseller korunur.

**Sonraki tasarım:** TitleScreen’i ortak aday sanat sistemiyle yeniden kurmak; ardından gerçek SignIn/Patch/entry araçları. Final Fadyme sheet/poz/chibi animasyonu UI sistemi sonrasında.
