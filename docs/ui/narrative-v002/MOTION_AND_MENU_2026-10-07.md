# Açılış, geçişler ve menü — 2026-10-07

## Read-only audit sonucu

- Entry logosu, sağ üstteki 144 px dişliyle aynı HBox'taydı; bu satır logoyu ekran merkezinden sola kaydırıyordu.
- Ayarlar hem sağ üstte hem footer'da bulunuyordu. Yardımcı bağlantılar 32 punto, normal Cinzel ağırlığındaydı.
- AppShell sayfayı anında değiştiriyordu; ortak sayfa ve patch kartı geçişi yoktu.
- AudioDirector zaten tek giriş müziği sahibi, 5 saniyelik yükselme ve Ogg loop desteği sunuyordu. Main Theme dosyası henüz sağlanmamıştı.

## Uygulanan değişiklikler

- Logo ve hesap bilgisi tam genişlikte, ortalanmış başlığa taşındı. Sağ üst dişli kaldırıldı. Footer: **Help · Menu · Settings**.
- Support/Help/Settings/Menu, **40 punto Cinzel 700**; Large Text ile 50 punto. Dokunma alanı en az 144 mantıksal px. İnce odak çizgisi ve koyu yazı gölgesi var.
- Menu, footer'ın üzerinde açılan 720 px panel. Arka plan kararıyor; dışarı tıklama menüyü kapatıyor, arkadaki komutlara geçmiyor. Tab menü içinde, Escape kapatıyor.
- Ortak UiScreen girişinde merkezden açılan yumuşak koyu perde ve hafif pirinç ışığı: **1,15 s**. Entry kartında durum değişimi **0,65 s**; menü/modal **0,75 s**. Help/Settings/Licenses sayfaları ve dönüşleri de ortak efekti kullanıyor.
- SovTaym: **1,35 s giriş → 2,4 s duruş → 1,35 s çıkış → 1,65 s Title açılışı**. Amblem/yazı grubu 3,2 saniyede %97'den doğal boyutuna geliyor. Godot'un kendi açılış logosu korunuyor; efektler ilk oyun kontrollü SovTaym ekranında başlıyor.
- Routing, doğrulanmış patch durumu ve odak animasyondan bağımsız. Hızlı gelen durumlarda eski efekt kaldırılıp son durum gösteriliyor. Reduced Motion perdeleri atlıyor; açılması mevcut perdeleri hemen bitiriyor. Title yazısı da sabit kalıyor.
- Editor'deki ortak Theme, Godot ResourceSaver ile tekrar kaydedildi; mevcut Control şablonları da yeni yazı ağırlığını kullanıyor.

## Main Theme yuvası

Dosya: **`game/assets/audio/music/bgm_main_theme.ogg`**. Hazır olduğunda bu konuma eklenebilir; `flow.title` açıkça başka bir cue atarsa o kullanılır.

Studio'nun başlaması `Audio.play_entry_theme(5.0)` çağrısını yapıyor. Başlangıç -60 dB, 5 saniyede 0 dB oynatıcı seviyesine ulaşır; kullanıcının Music bus ses düzeyi ayrıca uygulanır. Studio/Title/giriş/patch/yardımcı ekranlar aynı oynatıcıyı ve çalma konumunu kullanır; ekran geçişi müziği yeniden başlatmaz. Ogg oynatıcı kopyası loop olur, kaynak import ayarı değiştirilmez. Android arka plan/devam davranışı korunur.

**Şu anda müzik üretilmedi veya eklenmedi.** Eksik slot sessiz; müzik miksajı/duyusal kabul, gerçek eser geldiğinde yapılmalı. Testlerde yalnızca mevcut 80 ms sessiz Ogg fixture kullanıldı.

## Doğrulama

| Aşama | Sonuç | Kanıt |
|---|---:|---|
| Yerleşim/font | 103/103 | [JUnit](F:/unaware-of-my-demise/build/ui-motion-20261007/phase1-layout-fixed.xml) |
| Geçiş/menu son hali | 109/109 | [JUnit](F:/unaware-of-my-demise/build/ui-motion-20261007/phase2-final.xml) |
| Müzik/fade/loop | 21/21 | [JUnit](F:/unaware-of-my-demise/build/ui-motion-20261007/phase3-music-fixed.xml) |
| Son tam paket | **411/411; 54 script; 142957 assertion** | [JUnit](F:/unaware-of-my-demise/build/ui-motion-20261007/gut-verified.xml), [log](F:/unaware-of-my-demise/build/ui-motion-20261007/gut-verified-console.log) |

Tam paket son ürün değişikliğinden sonra geçti; GUT kapanışında SCRIPT ERROR/ERROR veya ObjectDB kaynak uyarısı yok. Önceden var olan test içi orphan bildirimleri korunuyor. Gerçek Godot AI main/preview loglarında hata/uyarı 0; editor'de mevcut 110 uyarı, hata 0. Native splash → SovTaym → hazır Title doğrulandı; kaynak Theme 40 punto/700 ağırlık. Logo x merkezi 540/1080. Geçiş örnekleri 0,144 → 0,493 → 0,841 → 1; başlangıç odağı korunuyor. Settings açıkken downloading durumu/busy korunuyor; kapatınca Menu odağı geri geliyor. Reduced Motion kalan perde sayısı 0.

9 temel render: Title/Sign In/Patch × 1080×1920 standart, 720×1280 ve 1080×2400 %125 yazı. Ek olarak iki Menu ve bir Settings render'ı; gerçek cold-start Studio/Title görüntüleri. [Makine doğrulaması](F:/unaware-of-my-demise/build/ui-motion-20261007/validation-summary.json), [canlı kanıt](F:/unaware-of-my-demise/build/ui-motion-20261007/live-validation.json), [bu iterasyonun dosyaları](F:/unaware-of-my-demise/build/ui-motion-20261007/change-inventory.json).

## Görsel kanıt

- [Geçiş kaydı — gerçek framebuffer, kaydedilen zamanlarla](F:/unaware-of-my-demise/build/ui-motion-20261007/entry-transition.webp)
- [Gerçek main menüsü — hesap açılmadı](F:/unaware-of-my-demise/build/ui-motion-20261007/menu-main-final.png)
- [Yeni giriş](F:/unaware-of-my-demise/build/ui-motion-20261007/sign_in-base.png)
- [Küçük ekran / büyük yazı](F:/unaware-of-my-demise/build/ui-motion-20261007/sign_in-compact-large.png)
- [Uzun ekran patch](F:/unaware-of-my-demise/build/ui-motion-20261007/update_available-tall-large.png)
- [Menu / küçük ekran / büyük yazı](F:/unaware-of-my-demise/build/ui-motion-20261007/menu-compact-large.png)
- [SovTaym — gerçek main çalışma görüntüsü](F:/unaware-of-my-demise/build/ui-motion-20261007/studio-live.png)

## Başarısız denemeler ve kalan sorun

1. İlk yeni layout testi eklenirken mevcut Settings odak testinin gövdesi yanlış testin altında kaldı. İlk koşu 101/103 ve 1 risky. Gövde yerine taşındı; bütün eski assertion'lar korundu, 103/103 geçti. Menü konumu assertion'ı yeni tasarımın footer üzerinde açılmasını doğrulayacak şekilde değiştirildi; containment/focus kapıları korunuyor.
2. İlk iki Godot AI eval snippet'inde tip bildirimi eksikti; project strict typing onları reddetti. Plugin/ayar değiştirilmeyip araç wrapper ve hata kaydı okundu, tüm snippet değişkenleri açık tiple yazıldı; canlı doğrulamalar geçti.
3. Müzik testinin ilk CLI filtre argümanı `.gd` ile parser tarafından reddedildi. `gdir/gprefix` filtresine geçildi; 21/21 test koşuldu.
4. Yeni shader'ı global script constant olarak preload etmek, bağımsız GLES3 kayıt aracı kapanışına **1 CanvasShaderGLES3 never freed** hatası ekledi. Shader yüklemesi kısa ömürlü geçiş düğümüne taşındı. Aynı kayıt denemesi ve son matris bu GPU hatasını artık vermiyor; tam test paketi yeniden 411/411 geçti. İlk kayıtlar [önceki kanıt klasöründe](F:/unaware-of-my-demise/build/ui-motion-20261007/before-shader-ownership-fix) tutuldu.
5. Son matrisin uzun patch kaydı bir kez **0xC0000005 / -1073741819** ile çıktı; stderr boştu, native stack trace yoktu. Editör oyunu durdurulup kayıt tek başına çalıştırıldı: exit 0, PNG/JSON doğrulandı; kalan kayıtlar sırayla tamamlandı. Kök neden kanıtlanmadı; eşzamanlı grafik süreçleri/çıkış sırası ancak olası etken. Tek başarılı tekrar bunu kalıcı olarak çözüldü yapmaz. Tekrarlanırsa native crash dump ile aynı GLES3 kayıt sahnesi incelenmeli.

**Kalan bağımsız kayıt kapanışı:** 12 preview kaydında **107 ObjectDB / 42 resources still in use** var (önceki iterasyon 103/41). Yeni script tipiyle sayı arttı; düğüm/tween yaşam testleri ve main/GUT kapanışı temiz olsa da bu cluster'ın kesin kökü hâlâ ayrıştırılmadı. Startup capture kapanışı temiz. Önceki üç farklı hedefli girişim ve durma kararı [Narrative raporunda](F:/unaware-of-my-demise/docs/ui/narrative-v002/README.md) korunuyor. Uyarı bastırılmadı, assertions gevşetilmedi, engine/plugin workaround uygulanmadı. Alternatif: aynı engine'de minimal script-load/quit reproducer ve GDScript sınıf bağımlılığı/yüklenme sırası analizi; görsel inceleme gerçek editor/runtime üzerinden yapılabilir.

Yerel çalışma; export/commit/push yapılmadı. Gerçek Google hesap ve Android cihaz kabulü yapılmadı. Narrative/Production kaynakları ve unrelated çalışmalar korunuyor. Özel sonraki oyun ekranlarının kompozisyonu bu Entry düzenlemesinin sonucu olarak tamamlandı sayılmıyor; ortak geçiş altyapısını devralırlar.
