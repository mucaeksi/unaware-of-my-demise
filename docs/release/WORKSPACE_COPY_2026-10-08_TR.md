# Yeni çalışma klasörü — 8 Ekim 2026

Kaynak: `F:/unaware-of-my-demise3`. Yeni çalışma kökü: `F:/unaware-of-my-demise`.

Gerekli mevcut kaynaklar kopyalandı; kaynak klasör değişmedi veya silinmedi. İlk kopya 6.409 dosya / 795.188.011 bayt (yaklaşık 0,741 GiB); her dosyanın SHA-256 değeri kaynakla karşılaştırıldı. Bu sayıya daha sonra eklenen iş bölümü belgeleri ve yeniden üretilen yerel cache dahil değil.

## Düzen ve iş bölümü

| Alan | Kullanım |
|---|---|
| `game/` | Godot 4.7.2 geliştirme projesi, runtime assetleri, native plugin kaynakları ve testler |
| `narrative/` | Mevcut kanon, karakter/mekân/ses kaynakları, referans ve provenance |
| `narrative/15_Art_Workbench/` | Codex'in yeni karakter/mekân tasarımları, promptları ve Claude'a asset teslimleri |
| `server/`, `database/`, `admin/`, `parity/` | Claude'un kodlama/entegrasyon ve sunucu contract'ı kaynakları |
| `tools/`, `.github/`, `.codex/` | Mevcut build/patch/CI araçları ve aktif standartlar |
| `.agents/library/`, `.agents/archive/` | Gerekli skill/rol provenance indeksi ve doğrulanmış tarihsel orijinaller |
| `release/current/` | Güncel mühürlü AAB ve kaynak snapshot'ı; Git'ten hariç |
| `release/support/current-aab/` | Eşleşen story patch ve seçilmiş JSON build kanıtları; Git'ten hariç |

Yeni çalışma şekli `docs/ART_AND_CODE_HANDOFF.md`, root `AGENTS.md` ve güncel `CLAUDE.md` içinde yazılı. Eski aktif `.claude/` kopyası ve `.DOTFILES.md` alınmadı; ilgili tarihsel orijinaller `.agents/archive/` altında korunuyor. Mevcut Godot resource yolları, ID'ler, `.uid`, `.import` ve sanat orijinalleri değiştirilmedi.

## Alınmayanlar

Eski/tekrarlı `build/`, `local-backups/`, Godot ve Gradle cache'leri, `node_modules`, eski graph çıktıları, isteğe bağlı upstream demo projeleri, kaynak `.git/` ve kişisel `.local` ayarları taşınmadı. Runtime'da kullanılan seçili third-party assetler ve lisans/provenance dosyaları korunuyor. Yerel Android export için küçük mevcut native AAR girdileri ignored `game/addons/uomd_native/bin/` altında tutuldu; cloud bunları kaynaklarından derler.

Özel ses API anahtarı, keystore ve kişisel Codex/MCP capability kayıtları Git kaynaklarına alınmadı. Yeni tasarım çalışma alanında henüz yeni görsel üretimi yapılmadı.

## Git ve yayın sınırı

Hedef kullanıcı talebi geldiğinde boştu. GitHub remote'u aynı private depo: `https://github.com/mucaeksi/unaware-of-my-demise.git`; `main`, mevcut `20097e93c39d278d438e9bf99b975625a2d41706` tabanına bağlı. Remote commit nesnesi authenticated API metadata'sından byte düzeyinde yeniden elde edilip aynı SHA-1 ile doğrulandı; parent geçmişi mevcut yerel depodan alındı. Yeni commit veya remote değişikliği yapılmadı.

Kaynaklar Git'e hazırlanır; AAB/APK/PCK teslimleri, release klasörü, cache ve özel config hariç kalır. Shell scriptlerinin executable Git modları korunur. Commit ve push proje sahibine aittir.

Cloud clone'da provenance hash'lerinin aynı kalması için `.agents/archive/` byte'ları Git newline dönüşümünden korunur; shell scriptleri LF kullanır. Kopyalanan tarihsel kaynaklardaki mevcut whitespace yeniden formatlanmaz.

Git index'ine 5.845 kaynak dosyası hazırlandı; 15 mevcut executable mod korundu. En büyük tek Git dosyası yaklaşık 12,1 MiB. Archive Git blob'ları dosya byte'larıyla aynı; generated/private/release klasörleri index'te yok. Genel whitespace kontrolü tarihsel kaynaklardaki mevcut satır sonları/boşlukları raporlar; bu kopyada güncellenen handoff/policy belgelerinin whitespace kontrolü temizdir. Commit/push yapılmadı.

`main` push'u sonrası başarılı CI mevcut `deploy.yml` ile production migration/Worker deployment tetikleyebilir. Bu davranış değiştirilmedi. Android release/content publishing ayrıca manual workflow ve signing/configuration secrets gerektirir.

## Doğrulama

İlk dosya kopyası SHA-256 kontrolünü geçti. Skill discovery bağlantısı hedefte yeniden kuruldu; mevcut sistem doğrulayıcısı 32 skill, 6 agent ve 327 arşiv orijinalini PASS olarak doğruladı.

İlk kopyaya ek olarak snapshot doğrulayıcısının kullandığı iki küçük upstream acceptance JSON'u ve mevcut native Android plugin'in üretilmiş public AdMob XML'i aynı byte'larla alındı. Bu üç ignored dosya için dev eski build klasörleri kopyalanmadı.

| Kontrol | Sonuç |
|---|---|
| Godot import | Cache sıfırdan üretildi; ikinci temiz import exit 0, script/load hatası yok |
| Mevcut GUT | 67 script, 509/509 test, 153.974 assertion; exit 0 |
| Mühürlü snapshot | Yeni kökten 555 snapshot girdisi ve upstream kanıtları hash doğrulamasını geçti |
| Güncel AAB | 134.505.206 bayt; SHA-256 `7bd2bf0bfa85e5e7d387d62e893d4be087c44a5dcda2225785a02bf5e186a652` |
| Base PCK | SHA-256 `8a92c0ace0ff928ea131ccb34494cee237644532e255054a7108399fade5dc1f` |
| Story patch | `release/support/current-aab/story-content.pck`; SHA-256 `f2095e3492a1e3f17e76857e0bf2780034162e4ba26ac12e2d7556c271dcee9c` |
| Gerçek masaüstü | Godot 4.7.2 / Godot AI 4.3.0 yeni köke bağlandı; Entry ve 540×960 native preview açık |
| Son canlı log | Editor/game hata 0; mevcut editor uyarısı 103; native screenshot görsel olarak incelendi |
| Graphify | Yeni kökte code update ve Godot/directed/parallel helper tamamlandı; 592/592 Godot kaynak okunabilir, dangling endpoint 0 |

Graphify'nin genel parser'ı native Gradle dosyasının bir bölümünü modelleyemiyor; bu Godot parse hatası değildir. Yeni graph cache'inde eski semantic document fragment'leri yok; yapısal/Godot coverage doğrulaması exhaustive semantic analiz anlamına gelmez.

## Devam için gerçek sınırlar

Mevcut AAB debug teslimidir; yeni bir Play Store release build'i veya Android cihaz QA'sı bu kopyada yapılmadı. Signing keystore/şifreleri ve sunucu/content publishing secrets yerel kişisel alanda veya GitHub secrets'ta ayrıca sağlanır. `release/current/` geçerli mühürlü tarihsel snapshot'tır; upstream kaynak staleness bilgisi true. Yeni sürüm hazırlanırken `game/` kaynaklarından build/reseal yapılır; snapshot elle düzenlenmez.

Cloud geliştirme için Git kaynakları, lockfile'lar, Godot/native build ve patch araçları, CI workflow'ları korunmuştur. Cloud clone üzerinde temiz import/test/Android build henüz çalıştırılmadı. Android export sırasında ignored `game/android/build/` template'i export templates'tan yeniden kurulur. Masaüstü Godot AI yerel bağlantısı canlı doğrulandı; cloud'dan bu masaüstüne SSH erişimi henüz kurulmadı/doğrulanmadı. Güncel bağlantı bilgisi root `GODOT_AI_READY.md` içindedir.

Yerel ayrıntılı kopya manifesti ve kanıtlar ignored `.local/migration-20261008/` altında tutulur. Ana `game/` kaynakları değiştirilmez; `release/current/` elle düzenlenmez. Eski raporlar tarihsel ölçümler olabilir; yeni çalışma kökü için bu belge ve handoff belgeleri esas alınır.
