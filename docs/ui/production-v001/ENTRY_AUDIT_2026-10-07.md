# Entry — audit, düzeltmeler ve yerel doğrulama

2026-10-07. Çalışma alanı `F:/unaware-of-my-demise`, Godot kökü `game/`, motor **4.7.2.stable.official.ed1daf0bf**. Kapsam yalnız Entry. Commit ve GitHub push yapılmadı.

## Read-only audit sonucu

Audit, değişikliklerden önce kullanıcıya gösterildi. `AGENTS.md` ve kullanıcının Entry/yerel çalışma sınırı uygulandı. Masaüstündeki `MASTER PROMPT.md` referans olarak okundu; belgedeki tam yayın ve diğer ekran talimatları mevcut kullanıcı isteğinin yerine geçirilmedi. Secondary Production kaynağı salt okunur kabul edildi.

| Bulgu | Kanıt / sonuç |
|---|---|
| Entry zaten entegre | `AppShell → StoryDirector → EntryScreen`; manuel Google girişi, gözlenen patch aşamaları, doğrulanmış snapshot sonrası Enter Game, restart gate, Settings/Help ve onaylı Sign Out mevcut. Mimari korundu. |
| Önceki testler eski klasörden | 389/389, UI 94/94 ve Entry 7/7 eski checkpoint. Güncel klasörde yeni başlangıç çalıştırması **391/391**, 52 script; script hatası yok. |
| Gerçek HTTP indirmesi resume sözleşmesini karşılamıyor | Installer `.part` beklerken transport `.chunk` kullanıyordu. Godot'un iptal edilen HTTPRequest indirmesi tamamlanmamış dosyayı siliyor. Önceki fake downloader testi gerçek transport davranışını göstermiyordu. |
| Idle Entry Back etkisiz | İşlem, modal ve üst katman Back davranışları mevcut; boşta Entry director'a ulaşınca çıkış yapmıyordu. Runtime harness hatayı yeniden üretti. |
| Kapanışta nesne tutuluyor | Başlangıç testinde 9 ObjectDB nesnesi / 1 resource; verbose inceleme `ContentInstaller` ve ilişkili CryptoKey/script'i gösterdi. `space_left` lambda'sı RefCounted nesnenin kendisini yakalıyordu. |
| MCP çalışma yolu eski | Resmî Godot AI kurulumu sağlam; config cwd'si mevcut olmayan eski proje yolunu gösteriyordu. `game/.mcp.json` iptal edilmiş toolkit'i hâlâ kaydediyordu. |
| Görsel/müzik/cihaz kabulü eksik | `ui/title_key_art` katalogda yok, pilot portre kullanılıyor. Ana tema runtime yolunda yok. Secondary Production klasörü ve bağlı Android cihaz yok. |

Başlangıç kanıtı: [özet](F:/unaware-of-my-demise/build/entry-audit-20261006/baseline-summary.json), [GUT logu](F:/unaware-of-my-demise/build/entry-audit-20261006/gut-baseline.log), [import logu](F:/unaware-of-my-demise/build/entry-audit-20261006/import-baseline.log).

## Tamamlanan düzeltmeler

1. **Gerçek HTTP resume:** imzalı manifest boyutu downloader'a veriliyor. Transport 512 KiB aralıklar istiyor; `Content-Range`, yanıt boyutu ve offset doğrulanmadan `.part` değişmiyor. Yalnız tamamlanmış aralıklar, 64 KiB buffer ile yazılıyor. Tam 200 yanıtına yalnız beklenen toplam boyutla izin veriliyor; installer'ın son SHA-256 doğrulaması korunuyor. Kesilen aralık yeniden indirilir, tamamlanan önceki aralıklar korunur.
2. **Installer yaşam süresi:** kendisini yakalayan varsayılan lambda yerine `_available_space` method Callable'ı kullanılıyor. Test enjeksiyonu korunuyor. Weakref testi nesnenin bırakıldığını doğruluyor.
3. **Entry Back:** boşta kök Entry ekranı uygulamayı kapatıyor. Aktif işlem, Sign Out modalı, utility ve menü önce kendi Back davranışlarını tüketiyor. Help metni gerçek resume sınırını açıklıyor.
4. **MCP ve belgeler:** iptal edilmiş toolkit'in proje kaydı temizlendi. Resmî `godot-ai` cwd'si `F:/unaware-of-my-demise/game` oldu. Launcher, sürüm pin'i, auth, izinler ve ilgisiz kullanıcı ayarları değişmedi. Güncel Entry durumu ve kanıt bağlantıları kaydedildi.

Runtime/test dosyaları: `game/scripts/app/online_backend.gd`, `content_installer.gd`, `game/scripts/ui/story_director.gd`, `game/scripts/ui/entry/entry_utility.gd`, `game/tests/unit/test_online_backend.gd`, `test_content_installer.gd`, `game/.mcp.json`. Strict typing, diğer plugin'ler ve mevcut işlem/snapshot sahipliği korundu. Assertion gevşetilmedi; beklenen hata kontrolleri kaldırılmadı.

## Phase sonuçları

| Phase | Sonuç | Kanıt |
|---|---|---|
| 1 — Transport / installer | Backend **20/20**, installer **10/10**, script yükleme **1/1** (154 assertion). Yanlış range, yarıda kesilme, tam 200 yanıtı ve nesne serbest bırakma regresyonları geçti. | Son entegre [JUnit](F:/unaware-of-my-demise/build/entry-audit-20261006/gut-final.xml) bu testleri de içerir. |
| 2 — Gerçek bağlantı kesilmesi | Gerçek HTTPRequest ve yerel TCP fixture. İkinci range'de socket kesildi; **524288 byte** korundu. Retry aynı offset'ten başladı, 1228800 byte tam dosyanın SHA-256 değeri eşleşti. Çıkış 0, hata/leak yok. | [Runtime logu](F:/unaware-of-my-demise/build/entry-audit-20261006/real-http-console.log), [istek aralıkları](F:/unaware-of-my-demise/build/entry-audit-20261006/http-requests.jsonl). |
| 3 — Back / cleanup | Gerçek AppShell/Entry runtime: işlem korunuyor, Sign Out iptal ediliyor, utility/menü kapanıyor, idle Entry çıkıyor. Son çalıştırma çıkış 0; kapanış leak'i yok. | [Back logu](F:/unaware-of-my-demise/build/entry-audit-20261006/back-final-console.log). |
| 4 — Tam regresyon | **395/395**, **52 script**, **142857 assertion**, 68.126 s. Eksik script, SCRIPT ERROR, ERROR ve kapanış ObjectDB/resource leak'i yok. | [Özet](F:/unaware-of-my-demise/build/entry-audit-20261006/final-summary.json), [konsol](F:/unaware-of-my-demise/build/entry-audit-20261006/gut-final-console.log), [JUnit](F:/unaware-of-my-demise/build/entry-audit-20261006/gut-final.xml). |
| 5 — Gerçek editör / UI | Godot AI 4.3.0 üzerinden **60 başarılı araç çağrısı**, mevcut proje yolu doğrulandı. Title → Sign In, Settings/Help/menü, update ve restart durumları çalıştırılıp görüntülendi. Game error 0, editor error 0. | [Live özet](F:/unaware-of-my-demise/build/entry-audit-20261006/live-summary.json), [Title/Sign In](F:/unaware-of-my-demise/build/entry-audit-20261006/live/title-signin-04-editor_screenshot-1.png), [Settings](F:/unaware-of-my-demise/build/entry-audit-20261006/live/settings-04-editor_screenshot-1.png), [Restart](F:/unaware-of-my-demise/build/entry-audit-20261006/live/restart-04-editor_screenshot-1.png). |
| 6 — Android debug paket | Export ve bağımsız paket doğrulamaları PASS. İmza, manifest, 16 KiB ZIP/ELF hizalama, Entry kaynakları, developer dışlamaları ve 61 kütüphane lisans kaydı kontrol edildi. | [APK doğrulaması](F:/unaware-of-my-demise/build/entry-audit-20261006/apk-verification.json), [export logu](F:/unaware-of-my-demise/build/entry-audit-20261006/android-export-quit-console.log). |
| 7 — Config / belge kapanışı | TOML ve JSON parse, yalnız hedef cwd değişikliği, belge yolları ve çalışmanın başlangıç yedeklerine göre değişiklik envanteri kontrol edildi. | [Cwd doğrulaması](F:/unaware-of-my-demise/build/entry-audit-20261006/mcp-cwd-fix.json), [envanter](F:/unaware-of-my-demise/build/entry-audit-20261006/change-inventory.json), [kapanış kontrolü](F:/unaware-of-my-demise/build/entry-audit-20261006/documentation-validation.json). |

UI testleri developer preview'da `autosave=false` ile gerçek runtime bileşenlerini kullandı. Preview hesap/sunucu yanıtlarını örnekler; bu kanıt gerçek Google hesabı veya production backend kabul testi değildir. HTTP fixture yalnız localhost ve sentetik pack byte'ları kullandı.

Live kayıtlarında **111 mevcut editor uyarısı**, game logunda **1 eksik `ui/title_key_art` uyarısı** var. Uyarılar gizlenmedi. Kapanıştaki leak'in düzelmesi bu görsel uyarısını ortadan kaldırmaz. Son kontrolde Godot Editor çalışmıyor; önceki “açık bırakıldı” notu tarihsel.

## Android çıktı

- [Entry debug APK](F:/unaware-of-my-demise/build/entry-audit-20261006/entry-debug.apk): **106991936 byte**, sürüm **0.1.0 / code 1**.
- Paket: `io.github.mucaeksi.unawareofmydemise`; yalnız `arm64-v8a`; min SDK **28**, target SDK **36**, portrait.
- SHA-256: `a874c7442bf738cd8c63725e39ae269162842e624e3023d98804bec076708ae0`.
- İmza doğrulandı; manifest izinleri mevcut allowlist'e uyuyor; UomdNative kayıtlı. ZIP CRC ve tüm native PT_LOAD segmentlerinde en az 16384 byte hizalama geçti.
- GUT, Godot AI/MCP, testler, tools ve art_review kaynakları/APK geliştirme autoload'ları dışlandı. Game/Online/Native/Audio autoload'ları mevcut.

Bu bir debug build'dir. Bağlı Android cihaz bulunmadığından kurulum, cihaz runtime'ı ve release/AAB kabulü yapılmadı.

## Başarısız denemeler ve yaklaşım değişiklikleri

- **Back harness:** ilk SceneTree harness'ı autoload'lar hazır olmadan statik bağımlılık yükledi ve compile hatası verdi. Harness ilk frame'den sonra dinamik yüklemeye geçirildi. Ürün assertion'ı değiştirilmedi. Ardından gerçek idle Back hatası çıkış 1 ile yakalandı; ürün düzeltmesinden sonra çıkış 0 doğrulandı. Önce/sonra logları tutuldu.
- **Resume kök nedeni:** fake transport sonucuna güvenmek yerine gerçek socket-drop fixture kullanıldı. Godot'un eksik HTTP download dosyasını silmesi yeniden üretildi; tamamlanmış range'leri ayrı kalıcı `.part` dosyasına yazma yaklaşımı doğrulandı.
- **Export konsolu:** ilk export APK üretti ama konsol bekledi; bu denemede GUT update-check HTTP 0 editor hatası da kayda geçti. İkinci, `--quit` eklenen export hatasız `[DONE]` üretti; konsol yine bekledi. Üçüncü export başlatılmadı. Godot child'ın çıktığı, konsolun CPU kullanmadığı ve görevden doğan Gradle daemon'un kaldığı incelendi; açık subprocess pipe'ı bulgularla uyumlu neden olarak belirlendi. Yalnız command line ve parent PID ile bu göreve ait olduğu doğrulanan daemon, export tamamlandıktan sonra kapatıldı; konsol çıkış 0 verdi. Ürün/plugin workaround'ı uygulanmadı. Sonraki build için konsol wrapper yerine GUI executable'ın headless CLI'si veya görev bazlı daemon kullanmayan Gradle çalıştırması değerlendirilmelidir.
- **Live rapor sayımı:** giriş JSON dizileri araç sonucu gibi sayılmıştı. Yapılandırılmış gerçek tool-result dosyaları ayrıştırılınca 60 çağrı / 0 hata doğrulandı. Girdi dosyaları ve gerçek sonuçlar korunuyor.
- **Belge kapanış kontrolü:** ilk metin kontrolü export'un ANSI renk/kalın yazı kodları nedeniyle `[ DONE ] export` işaretini eşleyemedi; ham logda tamamlanma var, ERROR yok. Kontrol aracı yalnız terminal biçim kodlarını kaldırarak aynı tamamlanma ve hata assertion'larını uyguluyor. İlk başarısız kontrol kaydı ve ham log korunuyor. Windows stdout kodlamasındaki ayrı tanılama hatası UTF-8/ASCII çıktı ile çözüldü.

## Kalan engeller ve uygulanabilir alternatifler

| Engel | Devam etmek için gereken / alternatif |
|---|---|
| Son Title görseli | Yerel referanslarda logo ve kare/dikey art var; art'ta gömülü başlık bulunuyor, referans sheet'te spoiler metni var. Runtime'a doğrudan taşınmadı. Onaylı, temiz portrait key art ve bağımsız wordmark sağlanınca mevcut asset resolver üzerinden bağlanabilir. Bu sırada mevcut pilot portre çalışıyor. |
| Ana tema | Sahibin müzik dosyası beklenen runtime yolunda yok. Dosya ve mevcut kullanım/lisans bilgisi sağlanınca Audio servisine bağlanabilir. Müzik ve hikâye kanonu uydurulmadı. |
| Production kaynak klasörü | `C:/Users/PC/Drive'ım/Unaware of My Demise - Production` mevcut değil. Mount/erişim gelince salt okunur source-check yapılabilir; mevcut kopyaların provenance kaydı korunuyor. |
| Gerçek Android kabulü | Cihaz bağlanınca Google Credential Manager/debug sertifikası, dokunma/Back, safe area/density, accessibility ve background/resume kontrolü gerekiyor. APK kontrolleri ve desktop runtime bu gate'i tamamlamıyor. |

Bu engeller bağımsız transport, cleanup, Back, MCP, belge ve APK işlerinin tamamlanmasını engellemedi. Sonraki ekranı proje sahibi seçer. Son Title/müzik/cihaz kabulü tamamlanmadığından yayın hazır sonucu verilmedi.

## Değişiklik sahipliği ve geri dönüş

Oyun/belge başlangıç kopyaları `local-backups/entry-audit-20261006/` altında. Profil config yedeği yalnız kullanıcı profilinde: `C:/Users/PC/.codex/config.before-entry-path-20261007-9b89e2c8.toml`. Config içeriği projeye kopyalanmadı. Yalnız hedef `mcp_servers.godot-ai.cwd` değişti; [resmî Codex config referansı](https://learn.chatgpt.com/docs/config-file/config-reference) bu anahtarı sunucunun çalışma dizini olarak tanımlar.

İlk audit sırasında `.git` yoktu. Kapanış kontrolünde Git deposu yeniden mevcut: `main`, HEAD `b862576` (`Delete narrative directory`). Çok sayıda mevcut değişiklik bulundu; tamamı bu çalışmaya atfedilmedi. Bu çalışmanın envanteri kendi başlangıç yedekleri ve dosya hash'leriyle çıkarıldı. Git index'i, branch'i ve geçmişi değiştirilmedi.
