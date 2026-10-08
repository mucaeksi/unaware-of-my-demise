# Entry yardımcı ekranları ve performans — 2026-10-07

## Kapsam ve salt okunur audit

Owner isteği: gereksiz Menu kaldırılması; oturum sonrası Logout; Help içinde 10 FAQ ve adres göstermeyen destek formu; çalışan Settings; Google girişinin görsel iyileştirmesi; logonun kırmızı ayın altına indirilmesi; daha yavaş sinematik geçiş; varsayılan 60 FPS, seçilebilir 30 FPS ve gelecekte 120 FPS altyapısı.

Çalışma Entry ve ona ait yardımcı sayfalarda yerel olarak yapıldı. Narrative/Production kaynakları ve önceki çalışmalar korunuyor. Hikâye kanonu eklenmedi. Yeni ekranların özel tasarımına geçilmedi. `C:/Users/PC/Desktop/MASTER PROMPT.md` bu çalışmada mevcut değildi; önceki kaynak incelemesinin yerini dolduracak yeni belge talimatı varsayılmadı. Ekteki belge içerikleri kullanıcı talimatı olarak yükseltilmedi.

Audit: footer Menu, Help/Settings'i tekrar ediyordu. Help iki paragraf, açık adres ve mailto içeriyordu; sunucu form endpoint'i/gönderici yoktu. Ses/büyük yazı/hareket ayarları mevcuttu; FPS sınırsızdı. Entry kendi atmosferini çizerken ortak ikinci atmosfer katmanı da çiziliyordu. Başlangıç render ölçümü 90 kare, 13 draw call; FPS sınırı 0, yaklaşık 200 FPS.

## Değişiklikler

| Alan | Uygulama |
|---|---|
| Footer | Menu/popup/shade kaldırıldı. Help ve Settings doğrudan açık. Logout yalnızca oturumda görünür; meşgulken kapalı; mevcut onay ve sunucu logout akışı korunur. |
| Giriş | Ortalanmış logo öncesine 144 logical px boşluk; ay için alan açıldı. Resmi Google G, Google Sans Medium, yüksek kontrastlı giriş düğmesi. |
| Geçiş | Sayfa 1,8 s; yardımcı efekt 1,1 s; patch phase 0,9 s. Yumuşak lens/ink perdesi ve geriden gelen exposure. Reduced Motion iptal/bypass, hızlı state değişimleri ve input sahipliği korunur. Efekt routing/network komutlarını geciktirmez. |
| Settings | Performance/Audio/Accessibility bölümleri, özgün SVG ikonlar ve belirgin slider tutacakları. Music/Voices/Effects mevcut AudioDirector bus'larına bağlı. Large Text ve Reduced Motion gerçek runtime ayarlarıdır. |
| FPS | İlk açılıştan itibaren 60 cap. 30/60 seçimi anında uygulanır ve aynı settings.cfg içinde saklanır; audio değerleri korunur. 120 görünür fakat bu sürümde kilitlidir. İleride project feature gate ve ≥119 Hz ekran kontrolü birlikte gerekir. Physics/simülasyon tick rate değiştirilmedi. |
| Help | 10 açılır FAQ: Google hesabı, giriş, hesap değiştirme, internet, content update, yarım indirme, restart/app update, Ready, FPS, ses/destek. Yanıtlar mevcut flow'a dayanır. En sonda Contact Us. Licenses erişimi korunur. |
| Form | Contact email/topic/subject/message, karakter sayacı, yanıt izni, doğrulama, busy/başarı/hata. Mail alıcısı arayüzde yok. Çift gönderim engeli; hata durumunda taslak korunur; klavyeyle Send Message'a ulaşılır. Gönderim süresince form kapatılmaz. |
| Sunucu | Public `/v1/support`, mevcut HTTP transport ve Worker mimarisi. DB/login/maintenance'dan bağımsız; ayrı 3/IP/dakika rate limit, bounded body, sabit alıcı, sağlayıcı makbuzu sonrası 202. Ayrıntı: `server/SUPPORT_FORM.md`. |
| Varlık/lisans | Google Sans OFL notices'a eklendi. Google G resmi kaynaktan, diğer yeni ikonlar özgün SVG. Theme alias Godot ResourceSaver ile yeniden kaydedildi. Yeni AI raster gerekli olmadı. |

Google kaynakları: [resmi giriş görsel kuralları](https://developers.google.com/identity/branding-guidelines), [resmi G asset](https://developers.google.com/static/identity/images/g-logo.png), [Google Fonts kaydı](https://github.com/google/fonts/tree/main/ofl/googlesans). G oranı/renkleri korunur; font ağırlığı 500. Lisans ve asset hash'leri build manifest'inde.

## Testler ve gerçek runtime

| Aşama | Kanıt | Sonuç |
|---|---|---|
| 1 Entry/giriş/geçiş | `phase1-ui.xml` | 109/109 |
| 2 Settings/FPS | `phase2-ui.xml` | 111/111; runtime cap30/cap60 doğrulandı |
| 3 Form/Help | `phase3-entry.xml`, `phase3-server.log` | 21/21 Entry, 18/18 sunucu/observability |
| Tam Godot paketi | `final-gut.xml` | 418/418, 56 script, 143025 assertion; 71,583 s |
| Son klavye/scroll düzeltmesi | `final-ui.xml`, `final-entry.xml` | 114/114 UI; son Entry22/22, 150 assertion |
| Tam sunucu paketi | `final-server-isolated.log` | 517/517, 41 dosya; 44,62 s |
| Derleme | `server-types.log`, `worker-build.log` | strict TypeScript ve Worker dry-run başarılı; publish yok |

Godot AI gerçek main runtime, parse-only doğrulama yerine kullanıldı. Google auth yapılmadan sign_in görünümü; Help10 soru; Settings cap30→cap60; Contact form valid/disabled durumu ve son odak halkası doğrulandı. 1080×1920, 720×1280 Large Text ve 1080×2400 Large Text için 15 temel render alındı. Help/Settings/Contact alt bölgeleri ayrıca gerçek runtime'da Large Text ile, yerleşim oturduktan sonra keyboard focus/ScrollContainer üzerinden görüldü. Form Send Message ve Help Contact Us hedefleri scroll viewport içinde tam görünür.

Son tam paket 418 testi kapsar; bundan sonra eklenen tek keyboard regression testi son UI/Entry paketlerinde geçti. Tek bir 419-test tam çalıştırma iddia edilmiyor. Test assertion'ları gevşetilmedi. Menu testleri sahibi kaldırılmasını istediği için Logout/footer/utility testlerine değiştirildi.

Gerçek main son koşuda helper live, Entry sign_in, 60 FPS, runtime error yok. Editor 111 warning: önceki110 + polymorphic Transport.request üzerindeki aynı mevcut OnlineBackend düzenine uygun `await` için redundant-await uyarısı. Async override korunur; uyarı bastırılmadı. GUT'un beklenen fixture uyarıları loglarda korunur. Önceki preview shutdown ObjectDB/resource problemi bu işte tekrar kovalanmadı; son 15 temel capture temiz exit0 ve stderr boş. Dry-run mevcut çoklu ortam seçimi uyarısı içerir, deployment yapılmadı.

## Performans ölçümü ve sınırları

RTX1650 / GL Compatibility / 1080×1920 logical viewport / sign_in / 90 kare:

| Ölçüm | Önce (uncapped ≈200 FPS) | Sonra (60 cap) |
|---|---:|---:|
| Draw call | 13 | 12 |
| Render CPU median / p95 | 0,258 / 0,292 ms | 0,268 / 0,279 ms |
| Render GPU median / p95 | 0,227 / 0,930 ms | 0,210 / 0,482 ms |
| Process frame aralığı median / p95 / max | ayrıca örneklenmedi | 16,667 / 16,677 / 16,684 ms |

Ham veri `profile-before.json`, `profile-after.json`. GPU ölçümünü iyileşme yüzdesi olarak yorumlamıyoruz: önce/sonra pacing farklı. Gereksiz ikinci katmanın kaldırılması draw call'ı azaltır. Render CPU/GPU tüm oyun mantığı süresi değildir; 90 idle kare uzun süreli kararlılık testi değildir.

ADB var fakat bağlı cihaz listesi boş. Android10+ tüm sürüm/cihazlarda 60FPS garantisi verilmedi. Native Google chooser, soft keyboard/safe area, gerçek indirme/verify yükü ve thermal soak cihazda bekliyor. Release device matrix: Android10 düşük donanım + güncel orta/üst donanım; 30 modunda33,33ms, 60 modunda16,67ms bütçesi; startup, utility gezinme, content install ve 20–30dakika ısınma sırasında frame dağılımı/memory/draw call ölçülecek. 120 gate, 8,33ms bütçesi gerçek yüksek refresh cihazda doğrulanmadan açılmayacak. [Godot DisplayServer](https://docs.godotengine.org/en/stable/classes/class_displayserver.html) ekran refresh/VSync sınırlarını açıklar.

## Başarısız denemeler, kök neden ve alternatif

1. İlk runtime probe yanlış Performance enum adı kullandı; compile break. Sonraki probe8s tool süresini aştı ve helper ömrü bitince viewport null oldu. Kök neden test probe'u: doğrulanmış `RENDER_TOTAL_DRAW_CALLS_IN_FRAME`, kalıcı shell viewport'u ve <8s çağrılarla çözüldü. Oyun ayarı/strict typing değiştirilmedi.
2. İlk tam sunucu testi mevcut localhost54318 kapalı olduğu için21 suite başlatamadı: 348passed/169skipped, ECONNREFUSED. Ayrı cluster başlatma ilk denemesi Windows Turkish_Türkiye.1252 locale non-ASCII hatası verdi. Üçüncü hedefli yaklaşım kurulu PostgreSQL18, yeni `pgdata_C`, explicit `--locale=C`, loopback54319 ile başarılı;517/517. Cluster test sonunda durduruldu. Üretim DB'sine bağlanılmadı.
3. Alt capture ilk olarak temel Entry scroll'una yöneliyordu; ikinci yaklaşım custom class string araması; üçüncü yaklaşım gerçek child type kontrolü. Görsel yine üstteydi. Üç denemede tekrar durduruldu. Static inceleme kök nedeni gösterdi: kullanılan `--ui-scroll-end` parametresi parser'daki `--ui-scroll=end` değildi. Yanlış kanıtlar `failed-scroll-captures/` içine alındı; capture script literal'i sonraki kullanım için düzeltildi, dördüncü otomatik capture denenmedi. Alternatif doğrulama: yerleşim oturduktan sonra gerçek runtime keyboard focus ile alt hedeflere ulaşıldı; `help-bottom-runtime.png`, `settings-bottom-runtime.png`, `contact-bottom-runtime.png` ve keyboard scroll assertion'ı başarılı. Bu helper sorunu ürün scroll sorunu olarak raporlanmıyor.

## Açık dış bağımlılıklar

- Gerçek e-posta: doğrulanmış sender/domain + Cloudflare binding yok; owner'a eksik adres soruldu. UI/client/server tamam, fake provider ile test edildi; üretim mail teslimi tamamlandı sayılmıyor. Yerel çalışma/no-push nedeniyle endpoint de henüz deploy edilmedi.
- Android cihaz/thermal/native sign-in/keyboard QA ve Main Theme dosyası bekliyor. Mevcut müzik yuvası korunur: bgm_main_theme.ogg, Studio başlangıcından fade-in, menü/patch boyunca loop.

Backup: `local-backups/entry-utilities-20261007/`. Build/evidence ve yalnız bu işin dosya hash envanteri: `build/entry-utilities-20261007/`. Önceki motion/menu raporu tarihsel kayıt olarak korunur; güncel footer artık Menu içermez.
