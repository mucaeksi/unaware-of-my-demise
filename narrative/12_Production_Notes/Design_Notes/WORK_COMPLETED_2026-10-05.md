# Narrative ve sanat/UI çalışması — döküm ve yeniden başlangıç kararı

Tarih: **2026-10-05**. Bu dökümün incelendiği main: **`402bb8cf7f2bdc219f7fe464c290922355f33a03`**. Bu kayıt yalnız belge/checkpoint çalışmasıdır; yeni görsel üretimi, isim araştırması, referans kaldırma veya Godot değişikliği başlatılmadı.

Yeni oturum için kullanılacak talimat: [CREATIVE_RESTART_PROMPT.md](CREATIVE_RESTART_PROMPT.md). Kullanıcı yaratıcı çalışmayı sıfırdan başlatacak; mevcut oyun, kaynak arşivi ve teknik ekibin çalışmaları silinmeyecek.

## 1. Kaydedilmiş işler

| Commit | Çalışma | Gerçek durum |
|---|---|---|
| `e9ac495` | Kullanıcının aktardığı önceki checkpoint: hikâye/karakter indeksleri, Narrative giriş/aktarım kaydı, 26 kilitli kaynak | Önceden main'e gönderilmiş başlangıç çalışması |
| `395c4b909c62cd0c883b546d3aa542e09fe46b06` | BATCH-0005: seçili Drive kaynaklarının aktarımı, düzenli Narrative kütüphanesi, ilk UI sistem taslağı | Main'e kaydedildi |
| `4913b39ee525705d1bdc559d9b70af970e9273a2` | İlk giriş/patch taslağı v02, ekran önizlemeleri ve 40 tarayıcı kontrolü | Tasarım prototipi |
| `402bb8cf7f2bdc219f7fe464c290922355f33a03` | İngilizce v03 giriş, patch öncesi araçlar, ayrı sayfa adları, Godot hedefleri, 65 tarayıcı kontrolü | Tasarım prototipi ve entegrasyon tarifi |
| `10b42fbd09b7a8fdce6bc2b98d7a5a72eec5f388` | Teknik ekibin title/ilk oyuncu akışı, audio cue desteği, sosyal işlevler ve diğer runtime çalışmaları | Main'den alındı; bu Narrative/UI çalışmasının üretimi değildir |

### Drive → GitHub aktarımı

- Kaynak: [LEGACY](https://drive.google.com/drive/folders/1oe_UF3PyZ1u8dPWner_7rJhx7228Fovy), Narrative klasör kimliği **`1Xw7Hqw4RDdeYeaiJiaX_Rjt9bbcxuXkK`**.
- Envanter: **558 kayıt / 488 dosya / 70 klasör**. 68 klasör listelendi; `.secrets/` ve `__pycache__/` alt ağaçları açılmadı. Narrative dışındaki root GDD supplemental kayıt olarak eklendi.
- **163 yeni dosya / 38.070.780 byte** taşındı. **26** mevcut kilitli dosya yeniden kullanılmak üzere doğrulandı; **300** dosya gerekçeleriyle Drive'da bırakıldı. Bütün Legacy topluca kopyalanmadı.
- Canon, aktif Story Bible, tam hikâye scripti, Villain Bible, farklı eski belge kopyaları, lore/world/faction/location kayıtları, 20 karakter paketi, art/costume/asset belgeleri, teknik handoff, promptlar ve GDD düzenlendi.
- 13 özgün Narrative JSON snapshot'ı runtime'dan ayrı korundu. 13 Legacy Python aracı statik olarak incelendi; çalıştırılmadı.
- Fadyme'nin 201 satırlık Japonca ses scripti, 25 seçilmiş OGG ve 4 ek onaylı müzik loop'u/metadata taşındı. Mevcut referans sesleri ve temalar korundu.
- Her aktarım için Drive ID, özgün yol/parent, mevcut modifiedTime/boyut, hedef yol, SHA-256, Git blob SHA-1, dönüşüm ve durum kaydedildi. Drive orijinalleri değiştirilmedi.

Kanıtlar: [manifest](../../docs/migration/BATCH-0005.manifest.json), [aktarım kaydı](../migration/README.md), [doğrulama](../migration/VALIDATION.json), [kaynak/runtime karşılaştırması](../migration/RECONCILIATION.md).

Aktarım anında **189 hedef** doğrulandı; 12 PNG ve 29 OGG decode, JSON ve Python AST kontrolleri geçti. 528 yeni indeks bağlantısı kontrol edildi. Bu sonuçlar dosya bütünlüğünü gösterir; bütün karakter tasarımlarının editoryal onayı veya Japonca telaffuz onayı değildir.

### Korunan oyun içeriği

**7 bölüm, 51 hikâye sırası, 35 savaş sahnesi, 16 savaş dışı sahne, 409 ana hikâye repliği, 20 karakter/visual brief, 76 karakter hikâyesi parçası ve 220 karakter ses repliği kaydı** korundu. Bu sayılar üretilmiş görsel/ses dosyası sayıları değildir.

Aktarımın `7440328` baseline'ında 55 korunan dosya ve 27 runtime JSON vardı. Daha sonra teknik ekibin `10b42fb` değişikliği MANIFEST'e audio cue paketini ekledi. Son UI doğrulamasındaki **56 dosya kontrolü bu yeni upstream'e göredir**; 26 eski kilitli referans değişmedi. Eski doğrulama raporunun baseline'ı yeni runtime ile karıştırılmamalı.

### UI tasarım çalışması

- AFK Arena benzeri gezinme ve daha karanlık atmosfer için **14 ekran/alt ekranlık** İngilizce etkileşimli sistem wireframe'i hazırlandı. Bunlar tamamlanmış oyun sayfaları değildir.
- İlk girişten itibaren **oyuncu metinleri ve altyazılar İngilizce, seslendirme Japonca** olarak kaydedildi.
- v03 giriş taslağında **SignInScreen, PatchScreen, EntrySettingsScreen, EntryHelpScreen, EntryUtilityMenu ve SignOutConfirmDialog** ayrı kaynak/spec ve kalıcı ID'lerle adlandırıldı.
- Sağ üstte Settings/Help; oturum açılmışsa Sign Out. Patch sırasında Settings/Help'e gidip dönme, devam eden indirme durumu, kontrollü çıkış ve geç gelen sonuçların iptal edilmesi prototipte ele alındı.
- 13 örnek hata/akış senaryosu ve beş ekran boyutu dahil **65 giriş kontrolü** geçti. Eski sistem wireframe'i için 42 route/viewport kontrolü ayrıca kayıtlı.
- Kaynaklar: [UI dizini](../ui/README.md), [giriş tasarımı](../ui/ENTRY_SCREEN.md), [sayfa kaydı](../ui/SCREEN_REGISTRY.json), [tarayıcı prototipi](../ui/entry/index.html), [giriş kontrolü](../ui/ENTRY_VERIFICATION.json).

Bu UI çalışması gerçek OAuth, patch indirme, ses oynatma, Android cihaz kabulü veya yeni `.tscn/.gd` üretmedi. Prototipteki cüzdan, roster ve stage örnek veridir. Güncel main'in mevcut Godot/auth/patch/runtime sistemleri teknik ekibin ayrı çalışmasıdır. Yeni kullanıcı opening/tutorial ve mevcut girişim recovery akışı korunmalıdır.

## 2. Açık işler ve eksik listesi

| Alan | Eksik / karar bekleyen nokta |
|---|---|
| Ana hikâye | Kaynakta 419, runtime'da 409 line_id: **10 eksik satır**, ortak ID'lerde **2 farklı İngilizce replik**. Otomatik eklenmedi/değiştirilmedi. |
| Müzik eşlemesi | Kaynakta 51, eski runtime'da 1 music cue alanı. Yeni audio cue altyapısı var; slotlar henüz müzik dosyalarıyla doldurulmuş sayılmaz. |
| Unlock koşulları | **9 Codex gate**, **40 karakter VO unlock** farkı. İlerleme/spoiler koşulları korunarak ayrı terfi işi gerekiyor. |
| Japonca ses | Fadyme scripti **DRAFT**; native JP editör incelemesi açık. 201 satırın 25'i seçilmiş dosyaya sahip; **176 satır için ayrı seçilmiş ses yok**. |
| Tarihsel karakter görselleri | Costume Guide 15 karakter için STALE; Rikka/Hana silah betimlerinde çelişki; Nixie saç issue; Aveline, Sable, Nara, Cael ve Yseldra sheetleri pending. Brin/Kera r2 işleri kayıtlı. Yeni görsel üretim öncesinde bunlar canon brief'ine yansıtılmalı. |
| UI | Bütün sayfaların nihai artwork'ü, ortak button/theme sistemi ve gerçek Godot bağlantıları tamamlanmadı. İlk giriş v03 HTML taslağı henüz Godot kabulü değildir. |
| Açılış / tema | Yeni Godot → stüdyo → title akışı, yavaş geçişler ve ana tema fade-in'i uygulanmadı. Owner'ın ana tema dosyası/cue eşlemesi bu checkpoint'te doğrulanmış değil. Fadyme temasıyla karıştırılmamalı. |
| Stüdyo adı | **SovTaym Studios araştırılmadı**. Marka/şirket/ad/alan adı/handle uygunluğu ve stüdyo logosu açık. |
| Sanat dönüşümü | Yeni görsel dilin üretim/entegrasyonu ve eski görsel referans paketlerinin aktif kullanımdan çıkarılması yapılmadı. |
| Hukuk / yardım | D-15 Terms/Privacy içerik ve onayı bekliyor. Help'teki support adresi onaylı; e-posta gönderilmedi. |
| Fadyme ve sonraki paketler | Son redesign sheet'i, hikâye pozları, gerçek animasyonlu chibi ve tüm diğer karakter/mekânların aynı dilde üretimi henüz başlamadı. |

10 eksik ID ve 2 metin farkı [RECONCILIATION.md](../migration/RECONCILIATION.md) içinde tek tek listelenir. Bu döküm kaynak farklarını kapatmaz veya yeni canon yaratmaz.

## 3. Son kullanıcı talimatı — yeni çalışma sırası

1. **Önce kayıt ve plan.** Kullanıcı yeni oturumdan başlatacak; bu tur üretime geçilmeyecek.
2. **Sanat sorumluluğu Codex ile kullanıcıda.** Yeni görseller doğrudan birlikte üretilecek. Eski Gemini görsel hattı/pack'leri yeni görsel otoritesi olmayacak; ses/müzikte gerekirse API kullanılabilir.
3. **SovTaym Studios adayını araştır.** İnternet ve ilgili resmî marka kaynaklarında araştırma, stüdyo adı/logosu üretiminden önce yapılacak. Bu ad henüz kesinleşmiş veya hakları temizlenmiş değildir.
4. **Tek sanat dili kur.** Ekli görseldeki karanlık, dokulu Gothic/anime/light-novel yaklaşımı; ana menü, butonlar, karakterler, mekânlar ve animasyonlarda tutarlı uygulanacak. Oyun logosu hikâyeye uyacak şekilde değişebilir.
5. **Açılışı sırayla tasarla ve Godot'a bağla.** Godot yazısı görünürken ana tema sessizden yükselir → stüdyo yazısı/logosu → yavaş geçişlerle title/ana menü → Google girişi → patch öncesi araçlar → oyun içi ekranlar.
6. **Her ekran ayrı ad/ID ile ilerler.** Görsel üretimi, Godot scene/script/theme bağlantısı ve doğrulama aynı adımın parçasıdır; entegrasyon topluca sona bırakılmaz.
7. **UI/açılış sistemi sonrasında Fadyme'nin son tasarımı.** Önce master character sheet, ardından hikâyeye uygun pozlar/ifadeler ve animasyonlaştırılan chibi. Son Fadyme paketi sonraki üretimin kalite ölçüsü olur.
8. **Diğer karakterler ve mekânlar sırayla.** Aynı sanat dili uygulanır; her karakterin kendi canon kimliği korunur. Narrative farkları ve derin içerik incelemesi ayrı kayıtlarla devam eder.

Bu son talimat, eski belgelerdeki “yalnız Gemini ile görsel üret”, “kilitli görsel referans asla değiştirilemez” ve “Godot bağlantısı ayrı son aşama” yönlendirmelerini **gelecek yaratıcı çalışma için günceller**. Ana tema/sesler ve hikâye kayıtları kendiliğinden değiştirilmez. Referans dosyaları bu tur silinmedi; gelecekte aktif görsel paketler değiştirilirken kaynak izi ve eski sürümler tarihsel arşivde tutulacak, mevcut runtime tüketicileri yeni assetlere geçirilecek.

### Ekli yeni stil görselinin kaydı

Kaynak: kullanıcının bu dökümü istediği mesajdaki tek görsel ek. Siyah/kömür palet, bordo-kızıl tutulma, yıkık Gothic siluetler, soluk kemik renkli serif logo, dokulu kumaş/metal, dramatik kenar ışığı ve ayrıntılı anime illüstrasyonu görsel yönü tarif eder.

Görseldeki karakterlerin canon kimlikleri bu resimden çıkarılmaz. Google Play kartı, yıldız/download/review değerleri ve örnek mağaza metinleri gerçek ürün verisi değildir. Kompozisyon bir stil hedefidir; portrait oyun arayüzüne aynen taşınacak ekran değildir.

Bu sohbet ekinin özgün byte'ları erişilebilir yerel dosya/file ID olarak verilmedi. Dolayısıyla bu kayıt görsel için indirme, repository hedefi veya SHA-256 iddia etmez. **Yeni oturumda prompt ile birlikte bu görsel yeniden eklenmeli**; üretim başladığında özgün dosya ve provenance kaydedilmelidir.

### Açılıştaki teknik ayrım

Kullanıcı mevcut oyunun Godot Engine yazısıyla açıldığını belirtti. İncelenen main'in `game/project.godot` ayarında engine splash siyah ve `boot_splash/show_image=false`; cihazdaki build'in sürümü burada doğrulanmadı. Native/system splash koddan önce çalışabilir. Planlanan müzik girişi, ses çalıştırılabilen ilk **oyun kontrollü Godot yazılı sahnede** yapılır. Yeni prompt bu farkı ve temanın sahneler arasında kesintisiz sürmesini içerir.

## 4. Bu checkpoint'in sınırı

Yeni üretim, web/marka araştırması, dosya silme, referans kilidi değiştirme, Godot/runtime/backend müdahalesi ve deployment yapılmadı. Yalnız bu döküm, yeniden başlangıç promptu ve yönlendirme kayıtları kaydediliyor. Önceki doğrulamalar kendi commit/baseline'larında geçerlidir; bu belgeler için yeni bir oyun/device kabulü iddia edilmez.
