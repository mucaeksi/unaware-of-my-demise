# Entry — yerel entegrasyon

## Güncel görünüm — Narrative UI v002

Owner önceki UI'ı reddetti ve Narrative stilini istedi. Açılış/Title/giriş/patch yeni plate, onaylı ayrı logo, Cinzel breathing Tap to start, her yere mouse/touch ve yeni ortak buton/panel sistemiyle yenilendi. Ortak kit bütün mevcut menü iskeletine yayılır; VN/Battle dünya art'ı ayrı kalır. Son **403/403**, 53 script, 142907 assertion. [Güncel görsel ve kanıt raporu](F:/unaware-of-my-demise/docs/ui/narrative-v002/README.md). Yeni kaynaklar yereldir, APK henüz yeniden export edilmedi. Standalone capture kapanış uyarısının üç hedefli denemesi ve açık root-cause/alternatif analizi raporda korunur. Aşağıdaki checkpoint'ler önceki UI sürümüdür.

## Son UI checkpoint — 2026-10-07

Kullanıcının istediği açılış → SovTaym → Title → Google giriş → patch ekranı aralığı incelendi ve düzenlendi. Title başlık/Support yerleşimi, esnek giriş/patch kartları, ilk klavye odağı ve safe-area menü/utility odak yönetimi tamamlandı. Son test **399/399**, 53 script; 9 çözünürlük/Large Text render'ı ve gerçek Godot AI runtime etkileşimleri doğrulandı.

[UI değişiklikleri, önce/sonra görüntüleri ve phase kanıtları](F:/unaware-of-my-demise/docs/ui/production-v001/ENTRY_UI_OPENING_TO_PATCH_2026-10-07.md). Yeni UI kaynakları önceki debug APK'ya henüz export edilmedi. Final Title art/müzik ve Android cihaz kabulü bekliyor. Sonraki ekrana geçilmedi.

## Güncel checkpoint — 2026-10-07

Yerel Entry audit'inin blocker olmayan işleri tamamlandı: gerçek HTTP range resume, installer cleanup ve idle Entry Back düzeltildi; eski MCP kaydı/çalışma yolu ve durum belgeleri güncellendi. Son tam regresyon **395/395**, 52 script ve 142857 assertion; kapanış leak'i yok. Gerçek socket-drop testi, Godot AI ile 60 başarılı canlı çağrı ve Android debug APK doğrulaması geçti.

[Güncel audit ve kanıt raporu](F:/unaware-of-my-demise/docs/ui/production-v001/ENTRY_AUDIT_2026-10-07.md) · [Debug APK](F:/unaware-of-my-demise/build/entry-audit-20261006/entry-debug.apk).

Son Title key art/wordmark, sahibin ana teması ve gerçek Android cihaz kabulü bekliyor. Kapsam Entry; commit/push yapılmadı. Aşağıdaki 2026-10-05 metni tarihsel checkpoint'tir; eski cleanup ve “APK yeniden oluşturulmadı” ifadeleri güncel durumu temsil etmez.

## Önceki checkpoint — 2026-10-05

2026-10-05. Bu adım yalnızca Entry kapsamındadır. GitHub'a push yapılmadı.

## Tamamlananlar

- Title: temiz Fadyme pilot portresi, canlı başlık, Tap to start, Preparing ve Support. Erken dokunma; stüdyo sunumu ve içerik yüklemesi tamamlanana kadar bekler.
- Google girişi: Title dokunuşu hesap seçicisini açmaz. Continue with Google, mevcut Online/Game giriş sözleşmesini başlatır.
- İçerik kontrolü: update_available durumunda Download Update beklenir. Checking, signing_in, downloading, verifying, installing ve snapshot_sync durumları gerçek işlem sınırlarından gelir; yüzde, boyut veya süre uydurulmaz.
- Ready: başarılı release kontrolü ve sunucu snapshot'ından sonra Enter Game açılır. Mevcut yeni oyuncu, geri dönen oyuncu ve yarım kalan savaş yönlendirmesi korunur.
- Restart required: Enter Game yerine Close Game gösterilir. Offline/hata durumunda Retry vardır.
- Settings ve Help: giriş yapmadan kullanılabilir; işlem sürerken ekranın üstünde açılır. İndirme, içerik yeniden yükleme ve senkronizasyon aynı Entry ekranında devam eder.
- Settings: Music/Voice/SFX, Large Text ve Reduced Motion. Sunumdaki tercihler yerel settings.cfg dosyasına kaydedilir; oyuncu ilerlemesi sunucunun sorumluluğundadır. Entry ekranları statiktir; Reduced Motion, bir sonraki açılıştaki stüdyo/başlık geçişlerini azaltır.
- Help: destek adresi, kullanıcı tarafından açılan e-posta taslağı ve ayrı kaydırılabilir lisans sayfası.
- Sign Out: yalnızca oturum varken, işlem bitmişken ve onaydan sonra çalışır; yerel oturum ve yüklenmiş oyuncu snapshot'ı temizlenir.

## İzlenebilir önizleme

PowerShell: `./tools/Start-EntryPreview.ps1` veya `./tools/Start-EntryPreview.ps1 -LargeText`.

Üst listeden Title, Sign In, Offline, Update Available, işlem aşamaları, Ready ve Restart Required seçilebilir. Title → Sign In → Update Available → Ready tıklanarak gezilebilir. Önizleme gerçek runtime bileşenlerini kullanır; geçiş sonuçları örnektir ve Google/sunucu isteği göndermez. Enter Game önizlemeyi bitiren açıklamayı açar. Oyundaki gerçek Enter Game mevcut director yönlendirmesine gider.

Runtime sahneleri: `game/scenes/ui/entry/entry_screen.tscn` ve `entry_utility.tscn`. Kontrolcü: mevcut `StoryDirector`. Yeni autoload veya oyuncu kayıt sistemi eklenmedi.

## Doğrulama

- İlk tam GUT çalıştırması: **389/389**; `build/entry-flow-tests.log`.
- Son UI çalıştırması, iki ek Entry testiyle: **94/94**, Entry davranışları **7/7**; `build/entry-ui-final.log`, `build/entry-flow-final.log`.
- Tüm scriptleri yükleme kontrolü başarılı; `build/entry-parse-final.log`.
- 720×1600, 1080×1920 ve 1080×2400; ayrıca %125 metin ölçeğiyle ekran görüntüleri `build/entry-review/` içinde. Settings, Help, menü ve Sign Out modalı da görüntülendi.
- Yerel Android preset PCK envanterinde Entry script/sahneleri ve portre import'u var; geliştirici önizleme/testleri pakete alınmıyor. Bu kontrol APK/cihaz testi değildir.
- GUT başarılı olsa da kapanışta ObjectDB/resource cleanup uyarıları görülüyor; önizleme/export araçlarında da var. Bu adım bunların kök nedenini araştırmadı.

## Kaynaklar ve sınırlar

Entry v001 spec/README kopyası `source/entry/` içinde. Fadyme portresi değişmeden kopyalandı; SHA-256 ve kaynak yolu `entry-manifest.json` içinde. Değiştirilen mevcut dosyaların önceki kopyaları `local-backups/entry-before-20261005/` altında.

Portre pilot varlıktır; son Title key art/wordmark bunun yerine takılabilir. Sahibin ana tema müziği henüz runtime yolunda yok; müzik uydurulmadı. Android cihazda gerçek Credential Manager, debug sertifikası ve dokunma QA'sı henüz yapılmadı. APK yeniden oluşturulmadı.

Sonraki ekran adımını kullanıcı belirleyecek; bu çalışmada Hub/Journey ekran düzenleri genişletilmedi.
