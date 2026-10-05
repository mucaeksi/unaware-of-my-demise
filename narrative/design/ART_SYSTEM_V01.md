# Ortak sanat sistemi — v01 adayı

Tarih: **2026-10-05**. Durum: **CANDIDATE / bağımsız Godot inceleme sahnesi**. Kaynak okuması tamamlandıktan sonra üretildi; oyuncu akışındaki bütün ekranların final tasarımı veya Fadyme'nin nihai character sheet'i değildir.

## Dünya ve çizgi

Bilgi tabanı: [dünya/hikâye/20 karakter brief'i](WORLD_STORY_CHARACTER_BRIEF_2026-10-05.md). Kullanıcının verdiği afişin ince Gothic/anime çizgisi, dokulu boyaması, yıpranmış kumaşı ve metal ayrımı korunur. Yüzlerde temiz kontur ve ölçülü gölge; mimari/kumaşta daha yoğun doku kullanılır. Gölge yüz ve eli silmez; küçük metal kenarlar, kumaş katları ve odak nesneleri sıcak rim ışığıyla ayrılır.

Hikâye ekseni çan, saat, adın tanıklığı ve yol arkadaşlığıdır. Ortamı yalnız büyük canavar ve yıkıntıyla anlatmayız: kayıt tahtası, tamir edilmiş zırh, temiz klinik masası, mum ve köy ışıkları dünyada korumaya değer hayatı gösterir. Fadyme'nin ifadesinde irade ve ince mizah bulunur. Mahmut'un koruması diğer karakterlerin kendi iradelerini örtecek beden diliyle kurulmaz.

Gothic biçim sivri taş kemerlerden, dar dikey ritimden ve yıpranmış kayıttan çıkar. Her butona büyük diken/haç/kılıç eklenmez. C41'in gümüş çan / diken tokmak / kırık taç / ince kızıl halka motifi yeni **oyun logosu** araştırmasının kaynağıdır; bu sürümde üretilmiş final logo yoktur. Stüdyo markası ayrı iş; [ön araştırması ve erişim eksikleri](STUDIO_NAME_RESEARCH_2026-10-05.md) kayıtlıdır.

## Temel renkler

Bu değerler ilk **UI adayı**dır; karakterin ve mekânın canon paletinin yerine geçmez.

| Token | Hex | Kullanım |
|---|---|---|
| Ink | `#0B0D11` | Zemin / sessiz alan |
| Panel | `#15181F` | Metin ve modal zemini |
| Raised | `#20242C` | İkincil eylem / yükseltilmiş yüzey |
| Bone | `#EDE3D2` | Ana metin / focus çizgisi |
| Muted | `#B7B0A6` | İkincil metin |
| Silver | `#B7BEC9` | İkincil çerçeve / çan metali |
| Bronze | `#8C755F` | Eskimiş metal sınır |
| Wine | `#4B2028` | Primary eylem |
| Wine hover | `#602A34` | Hover |
| Wine pressed | `#35191F` | Pressed |
| Danger | `#FFB9B6` | Açık eylem adıyla destructive |
| Teal | `#86BEB7` | Az kullanılan bakım/bilgi vurgusu |

Hesaplanan düz renk çiftleri: Bone/Panel **13,97:1**, Muted/Panel **8,27:1**, Bone/Wine **10,75:1**, Bone/Wine-hover **8,80:1**, Bone/Raised **12,24:1**, Danger/destructive-panel **10,39:1**, disabled-text/Panel **6,87:1**. Bunlar fontun raster sonucu, artwork üzerindeki metin veya bütün oyunun erişilebilirlik kabulü değildir. Artwork üzerindeki metin ayrı koyu yüzeye alınır.

Ortak çerçeve için gerçek `StyleBoxFlat` kullanıldı; mobil ölçekte iki mantıksal px metal sınır, sekiz px köşe, dört px focus. İnce doku/ornament ve özel ikon aileleri sonraki adaylarda eklenecek. UI metinleri çizime gömülmez.

## Fontlar ve ölçek

- **Cinzel:** kısa başlık / geçici wordmark dizgisi. Ayrı final oyun logosu değildir.
- **Inter:** eylem, durum, açıklama ve uzun metin.
- İki font Google Fonts'un gerçek kaynak dosyalarından indirildi; SIL OFL 1.1 metinleri dosyaların yanında. Hash ve kaynak URL'leri [provenance kaydında](../art/direction/PROVENANCE.json).
- 1080×1920 mantıksal canvas: body 36, küçük bilgi 30, ortak display 58. İnceleme sahnesindeki geçici oyun adı 76.
- Button minimum yüksekliği **144 mantıksal px**: ekran genişliği 360 dp kabul edildiğinde 48 dp, 411 dp'de yaklaşık 54,8 dp. Başka dp genişliklerinde gerçek karşılığı ayrıca kontrol edilmeli; salt screenshot pikseli dp kabulü değildir.
- 64 px iç kenar boşluğu, container tabanlı yerleşim ve metin wrap. Native safe area/hardware back entegrasyonu üretim ekranlarının kendi adımında doğrulanır.

Buton adayları: default, primary, secondary, destructive; normal/hover/pressed/focus/disabled gerçek Godot theme durumlarıdır. `Preparing…` yükleme **görsel örneği** disabled button'dur; gerçek patch işi veya sahte yüzde üretmez. Icon/navigation/modal varyantlarının final çizimleri henüz yoktur.

## Key-art üretimi ve karakter kontrolü

Beş yetişkin karakter: **Fadyme, Mahmut, Brin, Nixie, Kera**. Bu bir tanıtım kompozisyonudur; her sahnenin kalıcı beşli kadrosu veya yeni canon olay değildir. Kaynak: karakterlerin ayrı lore modelleri, world/location brief ve C41/42/43.

- Fadyme: ash-blonde / mor göz / plum hood / beyaz atkı / silver-lilac işlemeli siyah elbise / küçük zincirli gümüş çan. Kan, lanet çizgisi ve geç beyaz tutam yok.
- Mahmut: koyu saç, hafif sakal, oxblood cloak, yamalı half-plate, yıldız ve boş taç yuvası, heater shield.
- Brin: kahverengi tek örgü, pine-green cloak, küçük wolf-fur collar, **cream quilted gambeson**, hand axe, round iron buckler.
- Nixie: açık kahverengi saç, amber göz, açık/aydınlık ifade, geride hood, teal/ochre, kısa yay ve harita.
- Kera: kazadan ash-silver saç, brown geniş saha şapkası/goggles, ochre saha giysisi, cream apron, brass mortar.

**v01 ilk görsel inceleme:** yüz/renk ayrımı, Fadyme'nin aktif ifadesi, küçük çan ve temiz atkı, Nixie'nin açık kahverengi saçı, Mahmut'un star/empty socket yönü başarılı adaylar. Brin'in ağır göğüs/boyun zırhı lore'a göre hatalı bulundu; **v02 edit'i kapitone cream kumaşa çevirdi** ve bu düzeltme görsel olarak incelendi. Godot inceleme sahnesi v02'yi tüketir; v01 tarihsel aday olarak kalır. Taç parçası, ayrı küçük saç tokası ve diken tokmağın ayrıntıları final sheet ölçeğinde ayrıca kontrol edilecek. Gölge altındaki göz renklerinin küçük boyutta kaybolması da final kimlik kontrolünün konusu.

Arka plan distant cathedral + vadi + ince kızıl tutulma halkasıyla **world montage** statüsündedir. Bu kombinasyon belirli bir scene_id, gerçek yeni şehir adı veya fiziksel harita kabul edilmez. Başlangıçtan saklı akrabalık/letter/final curse/boss bilgisi kullanılmadı.

Üretim aracı OpenAI `image_gen`; altında kullanılan kesin model/sürüm/seed araçtan dönmedi, uydurulmadı. v01 kullanıcı sohbet görseliyle redesign; v02 yerel v01 PNG'siyle edit. Özgün kullanıcı referansı görülmüştür; byte/hash erişimi hâlâ yoktur. Prompt'lar, generated output yolu, PNG hash ve aday statüsü provenance'da.

## Eski görsel paketlerden geçiş haritası

Son kullanıcı talimatı eski görsel setin yeni üretimde zorunlu sanat otoritesi olmasını kaldırdı. Orijinallerin byte/hash/statü kayıtları tarihsel kanıttır; bu tur yeniden yazılmadı veya silinmedi. Bu adayın varlığı bütün tüketicilerin yeni sete geçtiği anlamına gelmez.

| Eski referans | Mevcut tüketici / kapsam | Yeni karşılık ve durum |
|---|---|---|
| R01 wordmark | Tarihsel oyun logosu / R02 composite | C41 kaynaklı çan/diken/kırık taç logo çalışması **planned**; review'deki Cinzel Label geçici dizgi |
| R02 key art / R02+R01 | TitleScreen'in `ui/title_key_art` slotu; eski HTML taslakları | Yeni v02 yalnız `review.art_direction_v01` texture'ıdır; Title/asset resolver terfisi **planned** |
| R03 sheet, R04–R07 VN, R08–R13 battle, R14 cut-in | Fadyme kimliği ve türev görseller | UI sonrası final sheet → VN/poz → chibi/animasyon → runtime zinciri **planned**; key-art yüzü final sheet değildir |
| R15–R16 forest | Chapter 1 background/battle plate | Yeni mekân paketleri **planned**; tanıtım montajı bu iki asseti değiştirmez |
| R17 icons | Tarihsel pilot ikonlar | Yeni ikon/9-slice aileleri **planned**; ilk butonlar gerçek StyleBoxFlat adayı |
| R18 theme / R23 casting | Audio/voice referansları | **Korunur**; görsel reset veya bu aday tema dosyalarını/casting'i kaldırmaz |

Slot tüketicileri yeni paketlere geçtiğinde source→runtime/manifest/import/hash ve gerçek scene kabulü aynı adımda kaydedilir. Eksik görseli telafi etmek için kullanılan bir dosya önceden silinmez.

## Godot tüketicisi ve üretim sınırı

- [Ortak aday tema](../../game/theme/gothic_candidate_v01.gd): yalnız onu açıkça kullanan tüketiciye uygulanır.
- [ArtDirectionReviewV01 sahnesi](../../game/scenes/art_review/art_direction_review_v01.tscn) ve [script'i](../../game/scripts/art_review/art_direction_review_v01.gd): gerçek texture, font, container ve butonları kullanır. Ayrı dev inceleme hedefi `review.art_direction_v01`; bir oyuncu ekranı değildir.
- Temanın ürettiği `Theme` ve `StyleBoxFlat` durumları sahnede gerçek Godot Controls tarafından tüketilir. Aday resim, Narrative'den ayrı runtime inceleme kopyasına hash eşitliğiyle bağlıdır.
- Artwork aspect contain + centered: farklı telefon oranında beş yüz korunur. İlk cover denemesinde 390×844'te Nixie'nin yüzü kırpıldı; contain düzeltmesi bu yüzden yapıldı.
- Geçici oyun adı ve eylem metinleri Label/Button katmanıdır. Görselin içine metin çizilmedi.
- Sahne GameFlow/auth/patch/cüzdan/müzik çağrısı yapmaz. Mevcut `TitleScreen`, `HubScreen`, aktif `UiTheme`, project main scene, asset resolver ve içerik manifesti bu adayla değiştirilmedi. Bütün UI'nun yeni stile geçirildiği iddia edilmez.
- Godot proje autoload'ları normal yüklenir; inceleme scene'i hesap oturumu başlatmaz ve Audio'ya cue göndermez.

Açılış üretimi ayrı sırayla devam eder: **EngineSplashScreen → StudioSplashScreen → TitleScreen**. Owner ana temasının dosya/cue eşlemesi hâlâ açık; `flow.title=null`, Fadyme reference theme ikame edilmez. Engine/stüdyo/title geçişi veya kesintisiz ana tema bu inceleme sahnesiyle tamam sayılmaz. UI sistemi sonrası final Fadyme, diğer karakterler ve mekân paketleri hazırlanır.

## İncelemeyi açma

Repository root'undan:

```bash
godot --path game res://scenes/art_review/art_direction_review_v01.tscn
```

Buton örnekleriyle açma:

```bash
godot --path game res://scenes/art_review/art_direction_review_v01.tscn -- --components
```

Headless import / parse ve scene smoke kontrolü yapıldı. Yerel araç **Godot 4.6.3**; hedef **4.7.2 Standard**, Android portrait. Yazılım OpenGL / Xvfb gerçek viewport görüntüleri [VERIFY_V01.json](../art/direction/VERIFY_V01.json) ve preview dosyalarında. Bu kontroller 4.7.2/device/Android build kabulünün yerine geçmez. Ortamda Xvfb sistem kurulumu yetkisizdi; resmî Debian paketinin kullanıcı alanına çıkarılmasıyla render alındı, ağ politikası veya sistem ayarı değiştirilmedi.

## Sonraki somut üretim

İlk adayın Brin düzeltmesi ve viewport incelemesi tamamlandı. EngineSplashScreen'in gerçek startup akışına geç; resmî kayıt doğrulaması eksik stüdyo adını finallemeden stüdyo wordmark'ını aday olarak tut. Ana tema varlığı ve 4.7.2 runtime doğrulaması somut eksik olarak izlenir. Hikâyenin belirsiz canon satırları ayrı karar kaydı olarak kalır; yeni görsel adına metinleri yeniden yazma.
