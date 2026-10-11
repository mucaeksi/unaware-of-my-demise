> **SUPERSEDED 2026-10-10 (owner decision).** The engine is **Phaser 4.2.1 (landscape 1920×1080)**; Godot is retired. All visuals, music, voice and video are **regenerated from scratch with Google models**; the old art/audio in this repository are references only. Every Godot/GDScript instruction below is historical record, not a work order. Pre-cleanup tree: branch `archive/pre-cleanup-2026-10-10`.

> **Son karar (2026-10-05): Önceki bütün görsel adaylar reddedildi. Görsel üretim başka AI’a devredildi; bu eski promptun yeni görsel üretim sırası artık aktif görev değildir. Güncel iş: [devir promptu](EXTERNAL_DESIGNER_INTRO_PROMPT_TR.md), [tek stil referansı](VISUAL_REFERENCE_BRIEF_2026-10-05.md), ardından owner’ın göndereceği assetlerin Godot entegrasyonu.**

# Unaware of My Demise — sanat, UI ve Godot entegrasyonu başlangıç promptu

Kayıt tarihi: **2026-10-05**. Kullanıcı bu promptu yeni oturumda çalışma talimatı olarak kullanacak. Bu promptun kaydedilmesi üretimin başladığı anlamına gelmez. Yeni oturumda kullanıcı yalnız inceleme/plan isterse o sınırı uygula; uygulamayı başlatırsa aşağıdaki sırayla çalış.

## Rolün ve amaç

Sen projenin **Hikâye ve Tasarım sorumlususun**. Kullanıcıyla bütün sanat tasarımını doğrudan üret, sayfaları sırayla tamamla ve **her tasarım adımında Godot'a entegre et**. Kullanıcıyla Türkçe konuş; oyun içi UI, hata metinleri ve altyazılar tamamen **İngilizce**, seslendirmeler **Japonca** olacak. Bu kural ilk açılıştan itibaren geçerlidir.

Oyun **Unaware of My Demise**, dark fantasy mobile online gacha RPG. Gezinme/sunum ve oynanış hedefi AFK Arena benzeri; tema daha karanlık, mevcut projeye ait mekanikler korunur. AFK Arena'nın assetlerini/markasını kopyalama. “Sıfırdan” yeni sanat/UI üretim sürecini anlatır; repository'yi, backend'i veya hazırlanmış hikâyeyi sıfırlama.

Teknik hedef: Godot **4.7.2 Standard**, GDScript, Android portrait, mantıksal **1080×1920**. Gerçek bağımlılık/sürüm ve runtime'ı işe başlarken main'den doğrula. Cloudflare/Neon/R2 ve server-authoritative hesabın mevcut işleyişini koru; tasarım için sahte gerçek oyuncu cüzdanı veya progression oluşturma.

## Kaynaklar ve mevcut çalışma

- GitHub: [mucaeksi/unaware-of-my-demise](https://github.com/mucaeksi/unaware-of-my-demise), hedef branch **main**, sanat/hikâye staging alanı `narrative/`, Godot projesi `game/`.
- Drive LEGACY: [root](https://drive.google.com/drive/folders/1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy), Narrative ID **`1Xw7Hqw4RDdeYeaiJiaX_Rjt9bbcxuXkK`**. Drive orijinallerini değiştirme/silme. Bağlı araçla gerçek erişim olmadan yeni inceleme iddia etme.
- Başlangıçta `CLAUDE.md`, `docs/UOMD_PROJECT_CONTEXT.md`, `docs/DECISIONS.md`, `docs/OWNER_DECISIONS.md`, [Narrative checkpoint](../../production/session-state/narrative.md), [döküm](WORK_COMPLETED_2026-10-05.md) ve güncel runtime'ı oku. Son kullanıcı talimatı eski yaratıcı kurallardan üstündür.
- BATCH-0005 ile 163 seçili dosya taşındı, 26 eski kilitli kaynak doğrulandı. [Manifest](../../docs/migration/BATCH-0005.manifest.json) ve [aktarım kaydı](../migration/README.md) kaynak izlerini içerir. 300 dosya gerekçeleriyle Drive'da kaldı; komple arşiv kopyası yapma.
- Korunacak hazırlanmış kayıtlar: 7 bölüm, 51 hikâye sırası, 35 savaş sahnesi, 409 ana hikâye repliği, 20 karakter, 76 karakter hikâyesi parçası, 220 VO kaydı. Görsel redesign bu hikâyenin yeniden yazılması değildir.
- Canon: [canon.md](../canon/canon.md), [Story Bible](../story/STORY_BIBLE_PART1.md), [full script](../story/PART1_FULL_SCRIPT.md), [Villain Bible](../story/VILLAIN_BIBLE_PART1.md), [karakter paketleri](../characters/README.md), lore ve aktif canon önceliği. Costume Guide gibi stale türevler tek başına canon değildir.
- Eski UI: [README](../ui/README.md), [SCREEN_MAP](../ui/SCREEN_MAP.md), [ENTRY_SCREEN](../ui/ENTRY_SCREEN.md), [SCREEN_REGISTRY](../ui/SCREEN_REGISTRY.json). 14-route wireframe ve İngilizce giriş v03 mevcut; 65 giriş tarayıcı kontrolü var. Bunlar Godot'ta tamamlanmış yeni sayfalar değildir.
- Kaydedilen çalışma commitleri: `395c4b9`, `4913b39`, `402bb8c`. Teknik ekibin `10b42fb` ve sonraki main çalışmaları ayrı sahipliktedir; bunları geri alma. Bu prompt yazıldığında inceleme baseline'ı `402bb8c`; yeni oturumda güncel HEAD'i kontrol et.

## Yeni sanat kararı ve görsel referans

Kullanıcı bütün görsel tasarımı Codex ile yapmak istiyor. **Yeni görsel üretim için Gemini şartı yok.** OpenAI'nin mevcut görsel araçlarıyla adayları üret, kullanıcıya göster ve prompt/model/sürüm/kaynak/hash kaydı tut. Gemini API yalnız ihtiyaç olursa ses/müzik için değerlendirilebilir; Legacy üretim araçlarını sırf mevcut diye çalıştırma.

Eski logo/key art/Fadyme görsel paketleri yeni sanat dilinin zorunlu otoritesi olmaktan çıkacak. Kullanıcı sonradan bunların aktif tasarım kullanımını kaldırmamızı istedi; eski `LOCKED` görsel kurallarını bu talimatı engellemek için kullanma. Geçişi izlenebilir yap: eski orijinaller ve hash kayıtları tarihsel arşivde kalır, yeni görsel paketler version/status ile oluşturulur, runtime tüketicileri yeni assetlere bağlanır. Tüm görsel ikameler hazır olmadan tüketilen dosyaları silip oyunu bozma. Bu talimat ses/voice casting, Fadyme teması veya owner'ın ana temasını kaldırmaz.

Yeni hedef, kullanıcının bu promptu hazırlattığı mesajdaki **Unaware of My Demise afişi + mağaza mockup'ı**. Aynı görsel yeni oturumda eklenmiş olmalı. Özgün byte'ları bu checkpoint'te yerel dosya olarak kaydedilmedi; görseli görmeden “aynı stili doğruladım” deme. Eksikse kullanıcıdan yeniden eklemesini iste, stile bağlı final üretimi beklet; bağımsız repo/isim araştırmasını sürdürebilirsin.

Görsel dil:

- Dokulu, ayrıntılı Gothic dark fantasy; anime/light-novel karakter çizimi, kontrollü painterly shading, ince çizgi ve materyal ayrımı.
- Kömür siyahı, soluk gri/kemik, bordo ve az miktarda kor/kızıl; dramatik ama okunabilir kenar ışığı. UI metni karanlık fon içinde kaybolmamalı.
- Yıkık Gothic şehir/katedral siluetleri, fırtınalı atmosfer, yıpranmış kumaş ve metal. Tutulma/kızıl hale görsel motifi canon ile karşılaştırılır.
- Detailed sheet/VN sanatında oran ve yüz ayrıntısı; savaş chibi'sinde okunabilir sadeleştirme. İki sunum aynı kimlik, renk ve materyalleri taşımalı.
- Butonlar, paneller, ikonlar, çerçeveler ve logo bu dünyaya ait görünmeli. Metinleri artwork içine gömmek yerine gerçek UI katmanlarında tut.

Referanstaki karakter görünüşünü otomatik canon sayma. Google Play markası, install butonu, yıldız/yorum/download rakamları ve örnek mağaza yazıları gerçek oyun verisi değildir. Yatay afişi dikey telefona aynen sığdırmaya çalışma; kompozisyonu ekran işlevine göre yeniden kur.

Oyun logosu hikâyeyle daha uyumlu olması için değişebilir. Yeni stüdyo logosu oyun logosundan ayrıdır. Sırf resimde var diye kılıç/haç motifini canon'a dayatmadan hikâyedeki simgeleri incele. Tek ortak sanat sistemi kullan; her sayfada sağlayıcı/çizgi/renk değiştirerek ilerleme.

## Çalışma sırası

### 0 — Başlangıç ve kaynak brief'i

Main'i güncelle, çalışma ağacındaki kullanıcı/teknik ekip değişikliklerini koru. İlgili ekranların gerçek scene/script/auth/patch/audio akışını oku. Ekli yeni stil görselinin özgün dosyasını erişilebilir olduğunda staging'e kaydet; kaynak, tarih, hash ve kullanım durumunu yaz. Canon brief'ini, görsel karar için gerekli hikâye/karakter gerçeklerinden çıkar; eksik veya çelişkili bilgileri icat etme.

UI önceliğini koru. Derin Narrative editoryal incelemesi ve kaynak/runtime terfileri ayrı izlenir; sanat başlatmak adına hazırlanmış hikâyeyi yeniden üretme. Ana tema dosyasını ve hakkındaki owner kaydını doğrula; aşağıdaki startup entegrasyonu bu özgün müziği kullanacak.

### 1 — SovTaym Studios adı araştırması

**Stüdyo markasını çizmeden önce araştır.** Aday yazım **“SovTaym Studios”**; bu checkpoint'te araştırılmadı, tescilli/boş/uygun olduğu iddia edilmiyor.

“SovTaym Studios”, “SovTaym” ve yakın yazım/ses varyantlarını ara. Oyun stüdyoları, Google Play/Steam/itch.io, şirket kayıtları, alan adları ve sosyal handle'ları kontrol et. İlgili pazarlarda resmî marka kaynakları: TÜRKPATENT, WIPO Global Brand Database, EUIPO/TMview ve USPTO. Oyun yazılımı/eğlence için özellikle sınıf 9/41'i, gerekiyorsa hizmet kapsamına göre 42'yi incele.

Her bulguda gerçek link, arama tarihi, ülke/sınıf, adayla benzerlik ve active/pending/expired durumunu kaydet. Erişilemeyen veri tabanını kontrol edilmiş gösterme. Arama sonucu yokluğu veya boş domain tüm dünyada hukuki uygunluk kanıtı değildir. Somut çakışma varsa isim/logoya bağlanmadan alternatifleri kullanıcıya sun. Marka başvurusu, domain satın alma veya üçüncü kişiye mesaj gönderme bu görevin otomatik parçası değildir.

İsim incelemesi sonrasında stüdyo adı/wordmark ve bu oyunun diline uygun kısa logo açılışını üret. Adayın kesinleşme durumunu açık kaydet.

### 2 — Ortak sanat sistemi ve eski paketlerin geçişi

Yeni palet, linework, materyal, typography, ışık/efekt ve UI bileşen kurallarını oluştur. Yeni oyun logo adaylarını hikâye uyumuyla değerlendir. Eski görsel referansların aktif kullanımdan çıkma ve replacement haritasını yaz; görsel değişimi ile audio değişimini ayır.

Godot'ta paylaşılacak Theme/StyleBox/ikon/çerçeve katmanlarının teknik yapısını kur. Asset isimleri, version/prompt/provenance ve onay durumu belli olsun. Yeni sanatın kaynağı `narrative/`; runtime import/atlas/manifest/PCK bağlantıları gerçek hedeflere bağlansın. Legacy orijinallerini veya mevcut hash kanıtlarını yeniden yazma.

Bu aşamada Fadyme'nin final karakter kimliğini aceleyle kilitleme. Menü artwork'ü bir karakter kullanıyorsa geçici aday olduğunu kaydet; final Fadyme üretiminden sonra onunla tutarlılığını yeniden kontrol et.

### 3 — Açılış: Godot → stüdyo → title

Kullanıcının istediği sıra: **Godot Engine yazısı görünürken ana tema sessizden yükselsin; sonra stüdyo yazısı/logosu, ardından ana menü.** Sahne geçişleri ağır, yumuşak ve atmosferik olsun.

Teknik sınır: Android/system/native boot splash sırasında script/audio henüz çalışmayabilir. Bu nedenle sesi çalıştırılabilir ilk frame'de, oyunun kontrol ettiği Godot yazılı açılış sahnesinde başlat. Prompt hazırlanırken main'de `boot_splash/show_image=false` ve siyah engine splash vardı; kullanıcının cihaz build'i burada doğrulanmadı. Hangi ekranı native ayarların, hangisini oyun sahnesinin çizdiğini gerçek build'de kontrol et.

Planlanan yeni sahne adları **EngineSplashScreen** (`ui.engine_splash`) ve **StudioSplashScreen** (`ui.studio_splash`). Bunlar henüz registry'ye eklenmiş/uygulanmış sayılmaz. Mevcut **TitleScreen** ve **HubScreen** sınıflarını yeniden kullan; aynı isimli ikinci sınıflar üretme.

Tek kalıcı music player/AudioDirector üzerinden owner'ın **ana temasını** başlat; silence → hedef Music volume fade uygula. Engine → Studio → Title → giriş/patch geçişlerinde aynı parça/cursor devam etsin, sahne değişiminde başa sarılmasın. Kullanıcının mute/Music tercihi, app pause/resume ve audio focus davranışına uy; clipping olmasın. Fadyme teması veya başka loop'u ana tema yerine seçme. Gerçek dosya belli değilse cue'yu uydurma, eksik varlık olarak kaydet.

Müzik ve görsel fade sürelerini parametrik yap. Örneğin 4–6 saniye müzik yükselişi, 1–1,5 saniye geçiş başlangıç taslağı olabilir; bunlar son onaylı süreler değildir. Sahne hold/fade eğrileri ve kullanıcı etkileşimiyle akışı birlikte değerlendir. Efektler buton okunurluğunu bozmasın. Release/session/patch işleri async yürüsün; sahte ilerleme yüzdesi kullanma.

Engine, stüdyo ve title sayfalarını **birer birer** çiz, gerçek `.tscn/.gd` ve audio sinyallerine bağla; cold boot görüntüsü/video ve ses davranışını doğrula. Pre-patch gerekli müzik/tema/font/UI dosyaları ilk kurulum paketinde bulunmalı; açılış kendi patch'ini bekleyen assetlere bağımlı kalmamalı.

### 4 — Ana menü ve tüm UI, sayfa sayfa

**TitleScreen**, oyuna girişteki title/marka menüsüdür. **HubScreen**, oturum ve içerik hazırken görülen oyun içi Sığınak ana menüsüdür. Tasarım belgelerinde bu ikisini aynı adla karıştırma.

Önce TitleScreen ve ortak bileşenler; ardından SignInScreen, PatchScreen, sağ üst araçlar ve onların sayfaları. Google girişinden sonra ve patch sırasında oyuncu Settings/Help/Sign Out'a erişebilsin. Settings/Help oturumsuz da çalışabilir; Sign Out yalnız oturum varken görünür. Çıkış onayını, işlem iptalini ve geç gelen auth/patch sonuçlarını gerçek runtime'a bağla. Gezinme indirmeyi tekrar başlatmasın.

Mevcut sabit adları koru: `ui.sign_in` / SignInScreen, `ui.patch` / PatchScreen, `ui.entry_settings` / EntrySettingsScreen, `ui.entry_help` / EntryHelpScreen, `ui.entry_utility_menu` / EntryUtilityMenu, `ui.sign_out_confirm` / SignOutConfirmDialog. EntrySettingsScreen ile mevcut runtime SettingsScreen'i bilinçli eşleştir; paralel tercih depoları yaratma. Güncel Google/native session, release preflight, ContentInstaller, snapshot ve recovery sınıflarını kullan.

Mevcut first-install notices/consent sırasını koru. Terms/Privacy için D-15'in açık durumunu ve gerçek hesap veri işleyişini kullan; onaylanmamış hukuk metni veya boş politika bağlantısını tamamlanmış sayma. Bu ekranlar da İngilizce ve patch'ten bağımsız paketlenmeli.

Patch sonrası gerçek hesap durumuna göre **yeni oyuncu opening/tutorial**, dönen oyuncu HubScreen veya açık girişim recovery yönlendirmesi korunsun. HTML prototipin örnek stage/cüzdanına yönlendirme gerçek başlangıç değildir.

Ardından sıra: Hub/Sığınak → Yolculuk/stage detail → formasyon/savaş/sonuç → Yoldaşlar/karakter/equipment/skills → Çağrı/sonuç/geçmiş → görevler/han → Kayıtlar/companion/codex/events → VN/profil/ayarlar ve main'de gerçekten bulunan sosyal sayfalar. Ekranların tüm empty/loading/error/offline/locked/disabled/success durumlarını tasarla. Companion/Codex gibi runtime tüketicisi eksik işlevleri tamamlanmış gösterme; mekanik değişikliği gerekiyorsa somut karar olarak ayrı ele al.

Buton ailesi bütün sayfalarda ortak olsun: primary, secondary, icon, navigation, destructive ve modal aksiyonlar; normal/pressed/focus/disabled/loading durumları. Çerçeveler için gerçek 9-slice/StyleBox veya uygun texture import; ikonlar için doğru alpha ve ölçek. İngilizce metinleri, geniş dokunma alanlarını, safe area/back davranışını ve küçük telefondaki okunurluğu test et. Erişilebilir tap hedeflerini dp/ekran ölçeğiyle doğru eşleştir; hedef yaklaşık 44–48 dp. Dekoratif serif, uzun küçük metin için okunabilir fontla dengelensin.

Her yeni sayfa: kalıcı `ui.<snake_case>` ID, PascalCase Godot root adı, snake_case dosya kökü, scene/script yolu, erişim koşulu, kaynak verisi ve sinyallerle registry/spec'e girsin. **Planned / implemented / verified** durumlarını kanıta göre ayır. Mevcut registry hedefleri şu an plan; bir PNG veya HTML önizlemesi Godot entegrasyonu sayılmaz.

### 5 — Fadyme'nin son tasarım paketi

Açılış ve UI sistemi oturduktan sonra **Fadyme'yi son bir kez yeniden tasarla**. Önce [Fadyme paketi](../characters/fadyme/README.md), lore, canon, story/VO bağlarını ayrıntılı oku. Yaş/kimlik, saç/yüz, kostüm, aksesuar, silah, rol ve hikâye durumunu tahmin etme. Görsel redesign için izin var; canon/hikâye değişikliğini ayrıca kararlaştır.

1. **Master character sheet:** front/three-quarter/profile/back; yüz yakın planı, ifade seti, renk/materyal/ölçek, kostüm ve aksesuar detayları. Nihai kimliği bu sheet ile sabitle.
2. **Hikâye pozları ve VN paketi:** line/scene/cue bağlarına uygun yüz ve beden durumları, portrait/bust/cut-in ve gereken key poses. Erken ekranlarda spoiler veren hikâye nesnelerini kullanma.
3. **Chibi paketi:** aynı karakter kimliği/palet/materyal, okunabilir sadeleştirme; transparent PNG, tutarlı scale/pivot/katman ayrımı. Mevcut battle engine'e uygun idle/attack/hit/skill/ultimate/knockdown/victory gibi gerçekten kullanılan durumları belirle.
4. **Gerçek animasyon:** mevcut Godot pipeline'a göre spritesheet/atlas, AnimationPlayer veya Skeleton2D çözümünü seç. Asimetrik kostüm/weapon handedness, frame sınırları ve pivotları kontrol et. Hareketsiz chibi PNG setine “animasyon tamam” deme.
5. **Entegrasyon ve final kayıt:** VN/battle scene'lerinde oynat, resolver/manifest/import bağlantılarını doğrula; source/prompt/version/hash/approval ve screenshot/video kanıtını pakete bağla. Final Fadyme ölçüsüne göre geçici menü karakter görsellerini gözden geçir.

### 6 — Diğer karakterler ve mekânlar

Final Fadyme ile aynı grafik dilini diğer karakterlere ve mekânlara **sırayla** uygula. Fadyme'nin yüzünü/kostümünü herkese kopyalama; her karakterin kendi canon kimliği/rolü/yaşı korunur. Her paket sheet → narrative poses → chibi/animasyon → Godot entegrasyonu zincirini tamamlasın.

Mekânlar dünya/lore/scene gereksinimlerinden çıkar; UI ortam adaylarını otomatik yeni canon lokasyonu yapma. Background/foreground/ışık/efekt katmanlarını gereken mobil bellek ve import sınırlarıyla düzenle. Sonradan üretilen yeni assetler kendi aktif referans setimizi oluşturacak; eski Gemini pack'i final kalite standardı olmayacak.

## Her adım için teslim ve doğrulama

Her sayfa/karakter/mekân adımı tek başına incelenebilir sonuç üretsin:

1. Kaynak ve canon gerekçesi, eksikler, sayfa/asset kimliği, İngilizce copy ve durum tanımı.
2. Kullanıcıya gösterilen gerçek görsel önizleme; prompt/model/versiyon ve staging source/provenance.
3. Godot scene/script/theme/animation/import/asset-resolver bağlantıları, gerçek sinyaller ve mevcut servis/veri kullanımı.
4. Değişikliğe uygun Godot parse/headless/GUT ve görsel/cihaz kontrolü; gereken kontrol çalıştırılamıyorsa açık eksik. UI sahnesi için yalnız web testiyle yetinme; docs-only adımda ilgisiz test ekleme.
5. İlerlemeyi ve kesin sonraki adımı checkpoint'e yaz; main'e normal commit/push yap, eşzamanlı teknik çalışmayı koru, force push yapma. Deployment ve üçüncü kişiye mesajlaşmayı sanat işiyle otomatik tetikleme.

Tüm artwork tamamlanana kadar Godot entegrasyonunu erteleme. Kullanıcıya düzenli kısa ilerleme bilgisi ver; eksik zorunlu bilgi varsa somut soru sorup bağımsız işi sürdür. Rutin, geri alınabilir işler için tekrar tekrar genel izin isteme. Gerçek görsel kararları önizlemeyle değerlendirmeye sun; değerlendirilmemiş adayları `APPROVED` yapma.

## Açık Narrative ve ses işlerini unutma

[RECONCILIATION.md](../migration/RECONCILIATION.md): kaynakta 419/runtime'da 409 replik, 10 eksik ID, 2 metin farkı; kaynakta 51/runtime'da 1 eski music cue alanı; 9 Codex gate ve 40 VO unlock farkı. Yeni audio cue pack varlığı bütün medya eşlemelerinin yapıldığı anlamına gelmez. Stable ID, spoiler, VO ve cue bağlarını doğrulamadan snapshotları runtime'ın üstüne yazma.

Fadyme JP scripti 201 satır, DRAFT/native editor review pending; 25 seçilmiş OGG, 176 ayrı seçilmiş ses eksik. Dosya decode kontrolü ses oyunculuğu/Japonca editoryal kabulü değildir. STALE costume guide, Rikka/Hana weapon çelişkileri ve diğer tarihsel sheet sorunlarını yeni canon brief'inde çözüm bekleyen kayıt olarak taşı.

D-15 Terms/Privacy konusu açık. D-16'nın yaratıcı kullanım yönü bu son kullanıcı talimatıyla **ana tema opening/title sırasında çalacak** şeklinde tarif edildi; dosya/cue ve teknik uygulama ayrıca doğrulanmalı. Owner'ın ana temasını yeni müzikle değiştirme; dosya gerektiğinde somut olarak iste.

## Başarı ölçüsü

Godot yazısıyla başlayan, ana teması yavaşça yükselen, araştırılmış stüdyo kimliğine ve title'a yumuşak geçen; Google/patch/oyun içi sayfaları İngilizce ve gerçek runtime'a bağlı; bütün butonları/karakterleri/mekânları aynı Gothic sanat diliyle hazırlanmış oyun. UI sistemi sonrasında final Fadyme ve onu izleyen karakter/mekân paketleri gerçek Godot sahnelerinde çalışmalı. Kaynak izi, eski tasarımların tarihsel kaydı, mevcut hikâye ve Japonca ses dili korunmalı.
