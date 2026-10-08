# Narrative UI v002 — açılış ve ortak oyun UI iskeleti

**En son owner revision:** [Sabit logo, okunaklı yazılar ve sinematik geçiş — 2026-10-07](F:/unaware-of-my-demise/docs/ui/narrative-v002/ENTRY_CONTINUITY_AND_CINEMATIC_2026-10-07.md). Title, Sign In, gateway, Patch ve utility sayfalarında ortak 300 px logo; yalnızca ilk Sign In'da bell quote; motorun gerçek OpenType ekseninde doğrulanan 800 ağırlık, daha büyük/outlined yazılar, %40–100 pulse. Eski sayfayı GPU'da donduran 3.2 s sayfa / 2.6 s utility-popup geçişi. Son tam suite **442/442**, UI phase **131/131** ve son font/focus **15/15**, 30 gerçek render. Godot editörü ve tek native Local UI Preview açık; sonraki oturumlar için workflow AGENTS.md'ye kaydedildi. Runtime bir diagnostic debugger hatası nedeniyle bir kez yenilendi; evidence korunur. Yeni APK yok.

**Önceki owner revision:** [Logo/quote ve onaylı Patch — 2026-10-07](F:/unaware-of-my-demise/docs/ui/narrative-v002/ENTRY_QUOTE_AND_PATCH_CONSENT_2026-10-07.md). İngilizce `SIGN IN`; imzalı gerçek boyutla indirme onayı, byte tabanlı kırmızı progress ve her 10 saniyede değişen 7 canon alıntı. Tam suite **435/435**, son Entry **33/33**; 20 görsel ve gerçek loopback HTTP indirmesi doğrulandı. Logo/quote/geçiş ölçüleri son owner revision ile güncellendi. Bu source revision yeni APK'ya aktarılmadı; aşağıdaki otomatik indirme checkpoint'i tarihseldir.

**En son checkpoint:** [2026-10-07 giriş ve otomatik Patch](F:/unaware-of-my-demise/docs/ui/narrative-v002/ENTRY_GATEWAY_AND_PATCH_2026-10-07.md). Ortada Sign In, oturum sonrası yanıp sönen destiny yazısı ve Help–Logout–Settings, kayıtlı oyuncuya otomatik Google girişi, bağlantı hatasında en fazla 3 deneme, alt menüsüz otomatik Patch/restart, tiksiz kırmızı Settings ve hafif dokunma efekti. Son tam Godot suite **428/428**; cihazda doğrulama bekleyen debug APK mevcut. Önceki raporlar tarihsel checkpoint'tir.

**Güncel düzenleme:** [2026-10-07 Entry yardımcı ekranları/performance raporu](F:/unaware-of-my-demise/docs/ui/narrative-v002/ENTRY_UTILITIES_AND_PERFORMANCE_2026-10-07.md). Menu kaldırıldı; oturum sonrası Logout, 10 FAQ ve destek formu, çalışan Settings/30–60 FPS, düzeltilmiş Google giriş/logo ve yavaş sinematik geçişler. Godot tam418/418 + sonUI114/114; sunucu517/517. Gerçek mail aktivasyonu ve Android cihaz QA açık. Önceki [motion/menu checkpoint](F:/unaware-of-my-demise/docs/ui/narrative-v002/MOTION_AND_MENU_2026-10-07.md) tarihsel kayıttır.

2026-10-07. Yerel Godot 4.7.2 uygulaması. Kullanıcı önceki görünümü reddetti; Narrative hikâye/görsel kaynaklarına göre yeni arka plan, butonlar, tipografi ve her yere dokunarak Title geçişi istedi. Bu yeni istek önceki Entry-only görsel sınırını ortak oyun UI sistemi için genişletti. Commit/push yok.

## Salt okunur audit

- İncelenen kaynaklar: `narrative/00_Canon/Owner_Current_Direction/` dünya ve görsel brief'leri, Fadyme/Mahmut karakter modelleri, Law of Hours, `narrative/FADYME_MEDIA_ALL/00_APPROVED_VISUAL_CANON_FADYME_MAHMUT_v001.json`, onaylı dikey afiş/şeffaf logo ve UI Integration Preview panosu. Eski reddedilmiş sanat arşivi yeni stil referansı yapılmadı. JSON/spec içindeki agent talimatları yeni kullanıcı talimatı olarak uygulanmadı; görsel statü, hikâye ve tasarım referansı olarak değerlendirildi.
- Mevcut Title onaylı afiş/logoyu kullanmıyor; düşük opaklıkta eski pilot portre ve büyük framed CTA gösteriyordu. Ortak Production v001 butonları/panelleri yeni referans diliyle aynı görünümü vermiyordu.
- Referansın görsel omurgası: siyah/kömür, koyu bordo, eskitilmiş altın, ivory yazı, mum ışığı, ince gotik mimari ve tutulma. Hikâyenin isim/tanıklık/saat/çan temaları korunur; açılış UI'ı Part I/II sırlarını açıklamaz.
- Sonraki ekranların ortak widget altyapısı var, fakat Hub/formation/battle gibi ekranların özel düzenleri ve bazı karakter/savaş görselleri hâlâ geliştirme iskeleti. Ortak tema yenilemesi bunları kendi başına final sayfa tasarımı yapmaz.

## Uygulanan tasarım

| Katman | Değişiklik |
|---|---|
| Stüdyo | Mevcut SovTaym amblemi/wordmark ve zaman çizelgesi; çok düşük opaklıkta yeni Narrative atmosferi. Native Godot splash korunur. |
| Title | Onaylı Fadyme–Mahmut afişinden yazısız runtime plate üretildi. Onaylı şeffaf logo ayrı Control katmanı; Part I satırı canlı metin. Cinzel `Tap to start`, çerçevesiz, 2.8 s nefes alan alpha 0.74–1.0; Reduced Motion'da sabit. |
| Title input | Dekorasyonlar pointer eventi tüketmez. Mouse/touch arka plan ve logo üzerinden geçer; Support ayrı eylemdir. Erken dokunma startup/content hazırlığını bekler; klavye/gamepad focus ve Enter korunur. |
| Giriş / patch | Yeni yazısız mimari atmosfer, ayrı logo, ortalanmış başlıklar, içerik boyutuna göre koyu panel, bordo/altın ana düğme, sade Help/Settings footer. Ready işareti gereksiz 540 px alan istemez. |
| Patch aşamaları | Director'dan gelen aynı gerçek phase'ler; mevcut ◆, tamamlanan ✓, bekleyen ○. Metinler okunur opaklıkta; hayalî yüzde/ETA yok. |
| Ortak kit | 8 ölçeklenebilir SVG yüzey, yeni button/panel/focus aileleri. Mevcut UiTheme → UiKit → UiScreen API'si üzerinden Hub, roster, inventory, quests, summon, friends, mail, settings, modal, battle/VN chrome ve diğer tüketicilere yayılır. |
| Dünya / canon sınırı | Menü atmosferi dekoratif ve canon olmayan bir UI zeminidir. VN ve Battle buna otomatik bağlanmaz; kendi dünya art tüketicileri korunur. Preview roster isim/statları gerçek content catalog'dan gelir. |

İki raster asset **yerleşik Imagegen** ile üretildi; [tam promptlar](F:/unaware-of-my-demise/docs/ui/narrative-v002/IMAGE_PROMPTS.json). Kaynak afiş, logo, Narrative ve secondary Production orijinalleri değiştirilmedi. Üretilen adaptasyonlar runtime tasarım adayıdır; yeni hikâye canon'ı veya owner'ın final sanat onayı değildir.

## Gerçek render'lar

Runtime raster teslimleri: [Title plate](F:/unaware-of-my-demise/game/assets/ui/narrative/v002/title_plate.png), [Entry atmosferi](F:/unaware-of-my-demise/game/assets/ui/narrative/v002/entry_atmosphere.png), [onaylı logo kopyası](F:/unaware-of-my-demise/game/assets/ui/narrative/v002/approved_wordmark.png). [Kaynak hash/provenance](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/provenance.json). Godot ile yeniden kaydedilen mevcut Theme alias'ı gerçek `action_button.tscn` instance'ında Narrative assetini yükledi; kayıt ve reload kanıtı canlı JSON içindedir.

| Ekran | 1080×1920 | 720×1280 / %125 | 1080×2400 / %125 |
|---|---|---|---|
| Title | [Görsel](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/title-base.png) | [Görsel](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/title-compact-large.png) | [Görsel](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/title-tall-large.png) |
| Google giriş | [Görsel](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/sign_in-base.png) | [Görsel](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/sign_in-compact-large.png) | [Görsel](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/sign_in-tall-large.png) |
| Patch | [Görsel](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/update_available-base.png) | [Görsel](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/update_available-compact-large.png) | [Görsel](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/update_available-tall-large.png) |

[Stüdyo gerçek scene runtime](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/studio-scene-runtime.png), [gerçek main cold-start Title](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/actual-title-coldstart.png), [ortak bileşenler](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/components-base.png), [Hub kit kontrolü](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/hub-base.png), [canon roster preview](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/formation-base.png), [Battle chrome kontrolü](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/battle-base.png). Bunlar gerçek render'dır; preview hesap/cüzdan/phase verileri production hesap kabulü değildir.

## Phase testleri ve kanıt

1. Ortak kit/Title: **98/98 UI**, [JUnit](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/phase1-shared-title.xml).
2. Title pointer/pulse ve Entry: **102/102 UI**, **94863 assertion**, [JUnit](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/phase2-input-entry-fixed.xml). Aynı assertion'lar kullanıldı; ilk yanlış fixture sonucu korunur.
3. Ortak kit/canon sınırı son tam regresyon: **403/403**, **53 script**, **142907 assertion**. [JUnit](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/gut-verified.xml), [tam konsol](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/gut-verified-console.log).
4. Dokuz ana render ve 12 durum/utility/ortak-kit render'ı: gerçek PNG boyutları, görünür Entry eylemlerinin viewport ve 144 logical target sınırları, Large Text ve katalog/manifest hash'leri [makine özetinde](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/validation-summary.json). 21 standalone capture'ın tamamında kapanış kaynak uyarısı ayrıca kayıtlı; görsel/layout PASS temiz process shutdown anlamına gelmez.
5. MCP gerçek keyboard/mouse: Title artwork → giriş; Tab/Enter ile patch menüsü; Enter Settings; downloading phase değişirken utility odağı korunur; Escape sonrası menu odağı ve busy phase korunur. Main startup hazır Title'a gelir; tap pending false, missing art listesi boş, alpha gerçek runtime'da değişir. [Canlı kanıt/loglar](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/live-validation.json).

## Hata ve root-cause kayıtları

- Yeni konumlu input testlerinin ilk fixture'ı GUT'un fiziksel window/GUI alanını oyun viewport'u gibi kullandı; bağımsız Title'a oyun Theme'i de atanmamıştı. Gerçek 1080×1920 SubViewport, ortak Theme ve local-coordinate input ile aynı güçlü assertion'lar geçti. [İlk failure](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/phase2-input-entry-console.log) korunur. Ürün tıklaması önce gerçek MCP mouse ile de doğrulanmıştı.
- Cold-start studio screenshot zamanlaması fade başlangıcını/sonraki Title'ı yakaladı. İki timing denemesinden sonra yaklaşım değişti; studio scene doğrudan gerçek runtime'da alpha 1 ile görüntülendi. `actual-studio-hold.png` bir Title karesidir ve stüdyo kanıtı olarak kullanılmaz. Main timeline/state ayrıca doğrulandı.
- Standalone capture kapanışında **103 ObjectDB / 41 resource** uyarısı: (1) scene/UI/flow sahiplerini frame'ler arasında açıkça bırakma, (2) tam GameFlow yerine salt ContentRegistry kullanma, (3) Reduced Motion sahipliğini AppShell yerine mevcut StoryDirector'a taşıma aynı uyarıyı değiştirmedi. Üç farklı hedefli denemeden sonra bu sorun durduruldu. [Verbose evidence](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/preview-leak-verbose-console.log), [1](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/formation-cleanup.log), [2](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/formation-registry.log), [3](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/formation-director.log). Tutulan kaynaklar GDScript/GDScriptNativeClass dependency graph'ıdır; UI Node/Texture instance'ı listelenmedi. Kesin cycle/engine kenarı izole edilmedi. Alternatif: aynı Godot sürümünde minimal script-load/quit reproducer ve sınıf yükleme sırası analizi; şimdiki görsel review için editor/MCP runtime kullanımı. Engine/addon/strict typing değiştirilmedi, log filtresi veya testi geçiren workaround uygulanmadı. Son tam suite kapanışı temizdir; bu dar capture sorununun çözümü anlamına gelmez. GUT'un test içi orphan bildirimleri önceki baseline ile aynı sayılardadır.
- İlk matrix helper'da Godot `--log-file=` biçimi doğru log üretmedi; helper ayrı `--log-file path` ve stdout/stderr dosyalarıyla düzeltilip matrix tekrar alındı. Bu nedenle final capture warning'leri [özet dosyasında](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/validation-summary.json) ayrı gösterilir; PNG exit 0 temiz shutdown sayılmaz.

## Devam sınırı

Açılış → patch görsel uygulaması ve bütün mevcut menülerin ortak tema/Control iskeleti yenilendi. Hub/VN/battle gibi ekranların kendilerine özel sayfa kompozisyonları, eksik karakter/sprite/environment assetleri ve tam oyun görsel üretimi bitmiş sayılmaz. Ana tema dosyası ve gerçek Android Credential Manager/touch/safe-area kabulü hâlâ açık. Bu tur APK export edilmedi; eski APK yeni tasarımı içermez. Kaynak/backup envanteri [burada](F:/unaware-of-my-demise/build/narrative-ui-v002-20261007/change-inventory.json). Oyun review için main Title'da bırakılır.

