# Ortak sanat sistemi — 2. adım / v02

2026-10-05. Owner 1. adımdan 2. adıma geçilmesini istedi. **Uygulanan temel, sanat statüsü CANDIDATE.** Önceki v01 ve bütün Legacy kayıtları tarihsel kanıttır. Bu sürümün ortak Theme'i gerçek oyuncu ekranlarında aktiftir; her ekranın final artwork ve yerleşimi kendi sırasındadır.

## Sanatın omurgası

[Dünya/20 karakter brief'i](WORLD_STORY_CHARACTER_BRIEF_2026-10-05.md) ve owner'ın afişi temel alınır. Tema kayıp isim, tanıklık, çanın saydığı saatler ve yol arkadaşlığıdır. Yalnız yıkıntı değil, korunmaya değer küçük hayatlar da çizilir: mum, bakım masası, tamir izi ve paylaşılan yemek. Karakterlerin kendi iradesi, mizahı ve ayrılan silüeti korunur.

- Yüz/eller: ince temiz kontur, ölçülü anime/light-novel gölgesi; göz, yüz ve jest okunur. Çizgi boyalı çevrede kaybolmaz.
- Kumaş: kat yönü ve tamir izi; yumuşak, mat yüzey. Her karakteri siyah pelerine çevirmek yerine lore paleti korunur.
- Metal: kontrollü soğuk kenar ışığı, eskitilmiş gümüş ve az bronz; parlak plastik görünümü yok. Büyük yüzeyler sade, odak ayrıntıları belirgin.
- Taş/çevre: dar Gothic dikey ritim, kırık kemer ve yağmur/kül; panel metninin arkasında resim dokusu kullanılmaz.
- Işık: kömür gölgeler, küçük sıcak ışıklar, seyrek kızıl vurgu. Kızıl halka bir kan/lanet rengi değildir; C43 karakter varyantları ayrı kalır.
- Ornament: ince çift metal kenar ve küçük baklava birleşim noktaları. Yüz, metin ve dokunma alanları diken yığınıyla örtülmez.

Karakter sheet/VN ve chibi aynı renk/nesne kimliğini taşır; chibi, küçük alanda okunabilmesi için ayrıntıyı azaltır. Yeni key-art yüzleri final Fadyme sheet'i değildir. Final Fadyme, UI sırasından sonra hazırlanır.

## Oyun kimliği

Oyun logosu SovTaym kuzgun/kum saatinden ayrıdır. C41'in **gümüş çan + diken tokmak + kırık taç parçası + ince kızıl halka** fikri kullanılır. İlk üretimde halka ve iki ayrı taç parçası baskındı; v002 edit'i tek küçük, kesik taç parçası ve daha ince halka üretti. [Prompt'lar ve üretim izi](../art/system/v02/PROVENANCE.json) gerçek araç çıktısına bağlıdır. Kaynak 1254×1254 RGBA; yapay büyütme, kırpma, yazı montajı veya alpha temizliği yapılmadı.

`GameLogo` iki dizgi sunar: **Seal** büyük başlık/açılış için, **Compact** dar header için. Aynı amblem kullanılır; UNAWARE / OF MY DEMISE gerçek Cinzel Label katmanlarıdır. Böylece başlık doğru yazılır ve ölçeklenir. Kompakt sürümde metal ayrıntısı azalır; 32 px app icon bu adayın küçültülmesiyle tamamlanmış sayılmaz. App/adaptive icon ve store assetleri kendi üretimini bekler.

Bu bir aday değerlendirmesidir. Owner'ın final logo, title, Fadyme veya resmî marka uygunluğu onayı kaydedilmez. SovTaym resmî kayıt kontrolündeki erişim eksikleri 2. adımı engellemeden açık kalır.

## Palet ve dizgi

| Rol | Hex | Kullanım |
| --- | --- | --- |
| Ink | `#0B0D11` | Tam ekran sessiz zemin |
| Panel / Raised | `#15181F` / `#20242C` | Metin yüzeyi ve ikincil eylem |
| Bone / Muted | `#EDE3D2` / `#B7B0A6` | Ana / ikincil metin |
| Silver / Bronze | `#B7BEC9` / `#8C755F` | İnce sınır ve metal |
| Warm accent | `#B59A76` | Kısa vurgu/ornament; önceki gold placeholder yerine |
| Wine | `#4B2028` | Primary aksiyon |
| Wine hover / pressed | `#602A34` / `#35191F` | Gerçek Button durumları |
| Danger | `#FFB9B6` | Açık eylem adıyla destructive |
| Teal | `#86BEB7` | Az kullanılan bilgi/bakım; HP rolü korunur |
| Disabled text | `#A4A0A1` | Kullanılamayan eylemin okunabilir metni |

Cinzel kısa başlık/oyun dizgisi; Inter gövde, eylem ve uzun metin. Gerçek font dosyaları ve OFL lisansları önceki kaynak kaydından kullanılır. 1080×1920 mantıksal canvas: gövde 36, ikincil 30, kısa başlık 60–64. Artwork üzerindeki copy, bağımsız koyu yüzeye alınır. [Doğrulama](../art/system/v02/VERIFY.json) düz renk kontrastlarını içerir; raster/cihaz erişilebilirliği kabulü değildir.

Button minimum yüksekliği 144 mantıksal px: 360 dp genişlik varsayımında 48 dp. SVG utility glyph'leri 64×64 viewBox, aynı 3 birim çizgi, UI'da en çok 48 px; caption/tooltip ile anlaşılır. Raw screenshot pikseli Android dp değildir. Gerçek küçük cihaz/density/readability/assistive technology kabulü açık kalır.

## Ortak Godot katmanı

- `res://theme/gothic_system_v02.gd` Theme/StyleBox/font/token kaynağıdır. Mevcut `UiTheme` API'si ona bağlandı; `AppShell` aynı create() çağrısıyla temayı bütün mevcut ekranlara taşır.
- `UiScreen` aynı safe-area/container yapısını korur; statik ink shader'ı kullanır. Efekt TIME kullanmaz, parent alpha korunur. UI aksiyonlarına yeni zorunlu animasyon eklenmedi; startup süreleri aynı kalır.
- Primary, secondary, icon, navigation, destructive ve modal action varyantlarında normal/hover/pressed/focus/disabled gerçek theme durumları vardır. Bone focus sınırı klavye/gamepad yön bulmayı destekler; destructive yalnız renkle anlatılmaz.
- `GothicActionButton`, mevcut `Button` yerine aynı UiKit API'siyle yaratılır. `set_busy()` text/icon/disabled durumunu saklar, aksiyonu kilitler, sonra ilk durumunu geri getirir; tekrar çağrı ve daha önce disabled olan buton güvenle ele alınır. Gerçek async servis bağlama her ekranın kendi adımındadır; gallery yüzde/indirme uydurmaz.
- `FramedPanel`, gerçek `StyleBoxTexture` 9-slice: 256 px SVG master, 32 px texture kenarları, 40/36 px içerik boşluğu. Çerçeve yatay/dikey uzarken köşe motifleri korunur. Bütün default panelleri süslemek yerine odak kartı/modal için seçilir.
- `GothicModal` gerçek Control overlay ve safe area içerir; açık confirmed/canceled sinyalleri, Cancel'da ilk focus, Tab/yön focus döngüsü, Escape/ui_cancel ve handle_back(), kapanınca önceki focus'a dönüş. Tekrar confirm/back çift sinyal üretmez. Bileşen kendi başına hesap çıkışı yapmaz.
- LineEdit, CheckBox/CheckButton, OptionButton/MenuButton/PopupMenu, HSlider ve ProgressBar temel stili paylaşır. Oyuncu/backend/auth/patch/cüzdan/VO akışı veya tercih deposu değişmez.
- Büyük dokunma alanı uzun menüleri taşırmasın diye mevcut Hub menüsü ve gacha banner listesi kaydırılır; ortak scroll odağı takip eder. HSlider hit yüksekliği 144'e gelir. Menü ID/sinyalleri aynı kalır; bu, final Hub/gacha sayfa redesign'i değildir.

## Kaynak, katalog ve ilk paket

Yeni kaynak: `narrative/art/system/v02/`; runtime: `game/assets/ui/gothic/v02/` ve `game/assets/branding/uomd/v01/`. [Asset manifest](../art/system/v02/ASSET_MANIFEST.json) her source/runtime/hash/import bağlantısını tutar. 15 SVG glyph, 9-slice frame ve game emblem **17 gerçek Texture2D** olarak `visual_assets_part1.json/shared_ui` üzerinden AssetCatalog'a kayıtlıdır. Yalnız bu pack'in content MANIFEST byte/hash'i güncellendi. Eski karakter/çevre/logo brief slotları rastgele tamamlanmış yapılmadı.

Theme/font/frame/ikon ve amblem pre-patch base install kaynaklarıdır; bir patch'i bekleyerek açılmaz. Font, PNG, SVG ve shader Godot tarafından import edilir, runtime tüketicileri gerçek dosyaları preload/load eder. Bu UI için atlas gerekmez; character battle atlas slotları kendi üretiminde kalır. APK/AAB `all_resources` yolunu kullanır; dev `art_review` sahne/script/texture'ları iki Android presetinde export dışına alındı. Script/theme/scene base install değişikliğidir, indirilen content PCK içine yeni executable kod konmaz. Bu tur APK/AAB veya production PCK yayımlanmadı; hedef 4.7.2/Android export kabulü açık.

## Eski setten geçiş

[Tüketici ve replacement haritası](../art/system/v02/REPLACEMENT_MAP.json), 26 kilitli kaynak hash'ini yeniden doğrular. [Aktif sanat seçimi](../art/ACTIVE_ART_SET.json) yeni adayları runtime tüketicileriyle eşler; eski lock/history dosyasını yeniden yazmaz. Eski görseller yeni üretimin zorunlu otoritesi olmaktan çıkar, fakat hazır karşılık bağlanmadan dosya silinmez. Eski HTML entry/prototype hâlâ tarihsel görsel tüketir; yeni sayfaya dönüştüğü iddia edilmez.

R01/R02 title terfisi, Fadyme sheet/VN/chibi/animasyon, forest plates, item/currency/element/status art ve app/store ikonları kendi sıralarında bekler. Yeni utility/navigation ikonları pilot item sheet'inin tamamını değiştirmez. Fadyme theme/voice casting ve Japonca VO kayıtları görsel geçişin dışında korunur. Owner ana tema dosyası hâlâ hazır değildir; mevcut sessiz rezervasyon değişmez.

## Görsel ve davranış kontrolü

[Kimlik panosu](../art/system/v02/previews/identity_1080x1920.png), [bileşen panosu](../art/system/v02/previews/components_1080x1920.png), [modal](../art/system/v02/previews/modal_1080x1920.png): gerçek, montajsız **1080×1920 Godot render'ları**. Ayrıca 390×844 yerleşim ve gerçek startup→mevcut title kontrolü var. Title yeni ortak temel ile görünür; final key art/logo yerleşimi henüz TitleScreen'e terfi edilmedi.

Yerel 4.6.3'te **81/81 UI testi** (9 script, 7 yeni component/uzun menü davranış testi dahil), 17-asset resolver kontrolü ve Part I content audit geçti. GUT için yalnız scratch QA kopyasındaki iki belgeli engine uyumluluk düzenlemesi kullanıldı. İlk koşunun iki savaş testi eksik scratch parity fixture'ı yüzünden durmuştu; repo fixture'ları tamamlanınca hepsi geçti. Production addon/pin değiştirilmedi. Mevcut kapanıştaki ObjectDB/1 resource uyarısı ayrıca kayıtta tutulur.

Bu adımın temel üretimi ve yerel entegrasyonu tamam. Sonraki görsel iş, mevcut native Godot/SovTaym açılışından gelen **TitleScreen'in final aday kompozisyonunu** bu sistemle kurmak; ardından entry araçlarını sayfa sayfa tamamlamak. Fadyme kimliğini bu panoyla kilitleme.

Son ek kontrolde GUT'un `-gtest` seçeneğinin config'teki dizinlere test eklediği görüldü; tüm suite de çalıştı. 375 testin 372'si geçti; iki server fixture'ı scratch kopyasında eksikti, bir test yerel 4.6.3 ile hedef 4.7.2 pin farkını yakaladı. Eksik fixture'lar tamamlanınca ilgili iki unit suite ve bütün UI **114/114** geçti; component adlandırma/focus kontrolü ayrıca 7/7. Version pin değiştirilmeyerek hedef runtime kabulü açık tutulur. [VERIFY](../art/system/v02/VERIFY.json) gerçek sonuçları ayrı kaydeder.
