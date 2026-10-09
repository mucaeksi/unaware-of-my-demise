# Main incelemesi ve ilk AAB düzeltmeleri

Başlangıç: `origin/main` — `3d05c7682e8a44d3f65b9b978c9f1c1fc43c0bf4`.
Çalışma: `/workspace/uomd-main-review`; bu raporun ilk doğrulama checkpoint'i
commit/push öncesinde kaydedildi. Orijinal çalışma kopyası korunmuştur.
Sonraki owner yönlendirmesi cloud'da doğrulanmış değişiklikleri `main`'e göndermek
ve GitHub Desktop ile çekip yerel Godot'ta oynamaktır; güncel akış
[cloud/main sync](../coder/CLOUD_MAIN_SYNC.md) dosyasında kayıtlıdır.

Güncel kaynaklardan yeni **yerel debug AAB** üretildi ve `release/current`
yenilendi. Kaynak/paket tutarlılığı ve teknik kontroller geçti. **İlk AAB tamamen
bitmiş değildir:** Japonca sesler/müzik, gerçek cihaz kabulü ve yayın için uygun
imza/hesap ayarları hâlâ açıktır.

## Düzeltilen bulgular

- Manifest'teki görsel JSON hash/byte hatası LF/CRLF dönüşümünden kaynaklanıyordu.
  Runtime içerik JSON'u LF'ye sabitlendi; manifest güncel dosyalardan üretildi.
- 13 aktif shell betiği ve APK lisans kontrolü için çalıştırma izni düzeltildi.
  Snapshot üreticisi bu izni artık koruyor ve POSIX doğrulamasında kaybını yakalıyor.
- `release/current` satır sonu dönüşümünden korundu; eski seal'in 31 kaynak dosyası
  uyuşmazlığı güncel kaynaklardan yeniden build ile kapatıldı. Seal yalnızca yeni
  kaynak doğrulaması geçtikten sonra yenilendi.
- Kayıp **10 ana hikâye repliği** özgün kaynaklardan ID ve sırayla geri kazanıldı;
  ana hikâye **419** benzersiz satır içeriyor. Dokuz farklılaşan İngilizce metin
  (2 ana hikâye, 6 yan hikâye, 1 event) ve ilgili konuşmacı metadata'sı düzeltildi.
  Yseldra'nın canon/entity ID'si `lady_yseldra_vale` olarak kullanılıyor.
- **9 Codex spoiler kilidi**, **40 ilişki VO koşulu**, sahne konukları/yönetmenlik
  ve müzik notları geri taşındı. Müzik notları henüz çalışan cue/ses dosyası eşlemesi değildir.
- Kaynak/runtime eşleşmesini koruyan dört regresyon testi eklendi. Tarihsel
  Narrative audit raporları değiştirilmedi; yeni değişiklik kaydı ayrı tutuldu.
- Owner brief'indeki 50 bozuk link çözüldü. Reddedilmiş eski sanat sistemi için
  Git geçmişindeki kayıt kullanıldı; reddedilmiş görseller aktif stile terfi edilmedi.
  Görev başlangıcı ve Git takip politikası güncel owner yönlendirmesine uyarlandı.
- Build araçlarının Windows APPDATA ve sabit Linux HOME varsayımları düzeltildi.
  Bundletool checksum kontrolü verilen JAR için de uygulanıyor. Owner'ın ignore
  kurallarını kapatma kararı korundu; üretilen dependency/cache çıktıları teslimden çıkarıldı.
  Dosya kataloğunun kendi çıktısını ve cache dosyalarını değişiklik olarak görmesi
  düzeltildi; build/check regresyon testi geçti.

Alan değişiklikleri ve özgün kaynaklar: [dialogue-restoration.json](dialogue-restoration.json).

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| Manifest ve Part I çapraz içerik denetimi | Geçti; 29 JSON, 419 ana hikâye satırı |
| Godot 4.7.2 / GUT tam test | 67 script, **509/509**, 153.984 assertion |
| Son JSON byte/manifest tekrar kontrolü | **2/2**, 86 assertion |
| Worker / PostgreSQL 18.6 | 42 dosya, **521/521** |
| Veritabanı | 0001–0012 migration, SQL testleri ve bütün koruma kontrolleri geçti |
| Python araç testleri | **22/22 + 13/13** |
| Gerçek Worker + headless istemci E2E | **2/2**, 56 assertion; 0 pending |
| Admin | Typecheck ve production build geçti |
| Worker paketleme | Dry-run geçti; deploy yapılmadı |
| AAB | Debug JAR imzası, bundletool 1.18.2 ve native paketleme geçti |
| AAB'den universal APK | SDK 28/36, ARM64, izin listesi, 16 KB ZIP/ELF hizalama, 61 library notice geçti |
| Base + hikâye patch | Base opening-only; üç eğitim zaferi, 32 pose; patch policy ve hikâye yükleme geçti |
| Bağımsız kaynak rebuild | 540 girdi; 520 aynı runtime girdi, 17 sahne anlamsal eşit; 3 engine config girdisi yeniden üretildi |
| Sealed current | 555 dosya, kaynak hash'leri ve bütün snapshot byte'ları doğrulandı |
| Codex sistemi | 32 skill, 6 agent, 327 arşiv provenance kaydı geçti |

Node test ortamı 24.19.0; CI Node 22 kullanıyor. GitHub CI/deploy çalıştırılmadı.
Godot ve Android araç zinciri pinleri kullanıldı. E2E yerel test girişini kullanır;
gerçek Google OAuth veya Android cihaz kabulü değildir. Bu ilk test checkpoint'inde
grafik editörü yoktu. Sonraki cloud kurulumunda gerçek Godot/Godot AI editörü,
21 sahnenin açılması/ağaç okuması ve Entry runtime/LocalUiPreview doğrulandı.
Bağlı Android cihazı yok; gerçek cihaz, ses ve thermal kabulü hâlâ bekliyor.

Makine tarafından okunabilir sonuçlar ve JUnit:
[validation/20261009/summary.json](validation/20261009/summary.json).

## Teslim ve sıradaki iş

- Test AAB: [release/current/artifacts/game.aab](../../release/current/artifacts/game.aab).
- Eşleşen base: [opening-base.pck](../../release/current/artifacts/opening-base.pck).
- Güncel hikâye patch'i: [story-content.pck](../../release/support/current-aab/story-content.pck).
- Kaynak haritası: [FILE_INDEX.json](../../release/current/FILE_INDEX.json).
- Birlikte ilerleme planı: [FIRST_AAB_PLAN.md](FIRST_AAB_PLAN.md).

İlk AAB'nin güncel eğitim sahnelerinde **83 diyalog sesi** eksik: Mahmut 43,
Fadyme 40. Prologue'daki dokuz anlatım satırının ses kararı ayrıdır. Eski seçilmiş
Fadyme kayıtları yeni `tutorial_*` metinlerine yeniden adlandırılamaz. Fadyme'nin
onaylı Sulafat kimliği korunur; Google API erişimi/model doğrulaması, JP metin ve
telaffuz, küçük performans örnekleri, kontrollü üretim ve entegrasyon sırayla yapılır.
Envanter: [first-aab-voice-inventory.json](first-aab-voice-inventory.json).

Codex'in devam eden alanı Fadyme/Mahmut ve açılış mekânlarının tasarım kaynaklarıdır;
teslimler `narrative/15_Art_Workbench` ve mevcut handoff düzeninde toplanır. Kullanıcı
sonraki ekranı/kapsamı seçmeden diğer sunum akışlarına geçilmez.

Support mail için doğrulanmış gönderici, Google giriş için doğru sertifika kaydı,
gerçek cihaz ve yayın anahtarı kullanıcı hesabı/cihazı gerektirir. Mevcut cloud AAB
geçici debug kimliği taşır; kayıtlı OAuth sertifikası yerine geçtiği iddia edilmez.
Google ücretli ses/müzik üretimi başlatılmadı.

Knowledge graph AST/Godot ilişkileri yenilendi; harici LLM API çağrısı yapılmadı.
Gradle için iki AST extractor uyarısı graph aracının kapsama sınırıdır; gerçek
Gradle/AAB build geçti. Arşiv bağlantıları ve önerilmiş kavramlar runtime hata
listesi olarak değerlendirilmez.
