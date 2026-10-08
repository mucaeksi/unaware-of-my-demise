# Taşıma, AAB, patch ve cloud geliştirme raporu

**Tarih:** 8 Ekim 2026, envanter başlangıcı 22:27 Türkiye saati.  
**Kaynak:** `F:\unaware-of-my-demise3`  
**Önerilen yeni çalışma kökü:** `F:\unaware-of-my-demise`  
**Kapsam:** Yerel dosya envanteri, GitHub'ın okunması, mevcut paketlerin doğrulanması ve taşıma önerisi. Dosya taşıma, commit, push, deployment, anahtar değiştirme veya cloud kurulumu yapılmadı.

## Sonuç

Mevcut oyunun geliştirilmesi, AAB üretimi ve içerik güncellemeleri için gereken kaynaklar yeni klasörde bir araya getirilebilir. Ana geliştirme projesi `game/` olarak korunmalı. Yalnızca `game/assets/` veya `release/current/` taşınırsa sonraki geliştirme ve patch üretimi eksik kalır.

Önerilen paket; bütün mevcut kaynakları, güncel doğrulanmış test sürümünü, bu sürüme ait patch/kanıtları ve isteğe bağlı yerel referans orijinallerini kapsıyor. Ölçülen toplam **809.643.637 bayt, yaklaşık 0,754 GiB**. Yeni Git metadata'sı, rapor dosyaları ve yeniden oluşturulacak önbellekler bu hesaba dahil değil. Kaynağın tamamı ise yaklaşık **11,52 GiB**.

GitHub üzerinden cloud geliştirme için uygun bir temel var; fakat **GitHub `main` şu anda boş**. Güncel kaynakların yeniden version control kapsamına alınması ve temiz bir Linux kopyasında doğrulanması gerekiyor. Masaüstünde Godot'u görmek ve cloud ajanıyla Godot AI üzerinden çalışmak için önerim: **cloud'da kaynak geliştirme/test/build, masaüstünde Godot ve Local UI Preview, gerektiğinde SSH üzerinden Godot AI köprüsü**.

## 1. Ölçülen mevcut durum

Yollar bu raporda belirtilen kaynak köküne göredir. Envanter bağlantıların hedeflerine gitmeden alındı; aynı skill dizini ikinci kez sayılmadı. Dosya sayıları raporun yazılmasından önceki anlık görüntüdür.

| Alan | Dosya | Boyut | Anlamı |
|---|---:|---:|---|
| Bütün kaynak klasör | 46.871 | 11,52 GiB | Kaynak, eski build'ler, bağımlılıklar, Git ve önbellekler birlikte |
| Git tarafından takip edilen mevcut dosyalar | 1.254 | 31,98 MiB | Eski commit tabanındaki dosyalar |
| Git'e henüz eklenmemiş görünür dosyalar | 4.859 | 381,42 MiB | Yeni assetler, narrative, Godot AI, `.codex` ve yeni geliştirme dosyaları dahil |
| `game/assets/` | 3.164 | 162,42 MiB | `.import` ayarları dahil; 1.664 dosya `.import` dışında |
| `narrative/` | 575 | 213,98 MiB | Kanon, sanat/ses kaynakları, brief'ler, arşivler ve provenance |
| `release/current/` | 557 | 347,45 MiB | Mühürlü mevcut test kaynakları ve AAB/base PCK |
| `build/` | 15.095 | 7,88 GiB | Çok sayıda eski/tekrarlı paket, doğrulama kopyası, log ve build cache |
| `game/android/build/` | 1.284 | 1,58 GiB | Yeniden kurulabilir Godot Android şablonu ve Gradle çıktıları |
| `game/.godot/` | 3.143 | 133,52 MiB | Yeniden üretilebilir Godot import/editor cache |
| `server/node_modules/` + `admin/node_modules/` | 13.460 | 579,04 MiB | Lockfile'larla yeniden kurulabilir bağımlılıklar |

F: diskinde envanter sırasında yaklaşık **131,53 GiB boş alan** vardı. Dosyalar okunurken envanter erişim hatası görülmedi. Bu envanter kullanılmayan assetleri silme kararı değildir; gelecekteki ekranlar için mevcut kaynaklar da korunmalı.

## 2. Hedef klasör ve GitHub

`F:\unaware-of-my-demise` zaten mevcut. İçinde yalnızca `.git/` var; çalışma ağacı temiz ve dosyasız. Hedefin `.git/` dizini korunmalı, kaynak klasörün `.git/` dizini bunun üzerine kopyalanmamalı.

GitHub bağlantısı canlı, salt okunur API çağrılarıyla kontrol edildi:

- Depo: [mucaeksi/unaware-of-my-demise](https://github.com/mucaeksi/unaware-of-my-demise), private; varsayılan dal `main`.
- GitHub ve hedef klasör HEAD'i: `20097e93c39d278d438e9bf99b975625a2d41706`.
- [Bu commit](https://github.com/mucaeksi/unaware-of-my-demise/commit/20097e93c39d278d438e9bf99b975625a2d41706) 8 Ekim 2026 saat **22:05:37 Türkiye saati** oluşturulmuş; mesajı `Remove all files from main at repository owner request`. Commit'in ağacı boş.
- Kaynak klasör HEAD'i: `b862576306526fffa09660fe62d0faa5fb6308be`; bu, hedef HEAD'inin doğrudan parent commit'i.
- Kaynakta `git status` **1.218 değiştirilmiş dosya** ve ayrıntılı untracked sayımında **4.859 dosya** bildiriyor. `git diff --numstat` içerik farkı gösteren 68 dosya saydı. Durum ve içerik farkı sayıları aynı şey değildir; taşıma byte hash'leriyle kontrol edilmeli.

Güncel oyunu yalnız `git clone` ile elde etmek bugün mümkün değil. Son yerel assetlerin önemli bölümü hiçbir commit'te bulunmuyor: `game/assets/` altındaki 3.115 dosya ve `narrative/` altındaki 575 dosya untracked.

İleride yayınlama aşamasında hedefin mevcut Git geçmişinden bir `codex/` dalı açıp yeni dosyaları eklemek yeterli; geçmişi sıfırlamak veya force push yapmak gerekmiyor. Bu rapor push yapmaz.

Eski commit için görülen son birkaç Actions kaydı Monitor başarılarını ve bir Backup başarısızlığını içeriyor. Bunlar yeni yerel oyunun CI/AAB başarısı sayılmaz. GitHub secret değerleri veya mevcut secret kurulumunun eksiksizliği doğrulanmadı.

## 3. Neler taşınmalı?

| Dosya grubu | Yerel hedefe | GitHub'a | Neden |
|---|---|---|---|
| `game/` kaynakları; asset, `.import`, `.uid`, data, scene, script, shader, theme | Evet; cache/build hariç | Evet | Godot geliştirme, yeniden import ve AAB/patch üretimi |
| `game/android/plugins/uomd_native/` kaynakları ve `game/addons/uomd_native/` | Evet; Gradle çıktıları hariç | Evet | Sign-in, billing, ads/consent Android köprüsünün yeniden derlenmesi |
| `game/addons/godot_ai/`, GUT ve mevcut editor araçları | Evet | Evet | Geliştirme ve doğrulama; uygulama export'una dahil edilmez |
| `server/`, `database/`, `admin/`, `parity/` | Evet; dependency cache hariç | Evet | Sunucu contract'ı, içerik dağıtımı, migration ve client/server parity |
| `tools/`, `scripts/`, `.github/`, `.codex/`, `.agents/library/` ve mevcut arşiv belgeleri | Evet | Evet | AAB, patch, CI, aktif çalışma kuralları ve geçmişin korunması |
| `narrative/`, mevcut provenance ve lisanslar | Evet | Evet | Sonraki içerik/asset çalışmalarının mevcut orijinalleri ve kaynak kayıtları |
| `release/current/` | Evet, byte'ları değişmeden | Normal Git'e eklenmez | Güncel doğrulanmış test teslimi; kaynak projenin yerini almaz |
| Son build'e ait `story-content.pck`, inventory ve kabul raporları | Evet | Artifact/depolama olarak | Base AAB ile eşleşen mevcut patch'in korunması |
| `references/free_2d/upstream/`, `references/gdquest_vfx/upstream/` | İsteğe bağlı; önerilen envanterde var | Varsayılan olarak ignored | Orijinal demo kaynaklarına çevrimdışı erişim; toplam yaklaşık 10,77 MiB |
| Eski `build/`, `local-backups/`, `.godot/`, Gradle cache, `node_modules/`, graph çıktıları | Aktif kök için gerekli değil | Hayır | Mevcut kaynak klasörde korunabilir; ihtiyaç halinde yeniden üretilebilir |
| `.local/audio-authoring.cfg`, kişisel Codex config'i, private signing keys ve MCP capability kayıtları | Özel yerel ayar olarak ayrı tutulmalı | Hayır | Makineye/kullanıcıya ait gizli bilgiler |

Bütün Git-görünür mevcut kaynaklar **6.113 dosya / 413,40 MiB**. Önerilen manifest bunları, 557 güncel release dosyasını, 616 isteğe bağlı referans dosyasını ve 21 seçilmiş build kanıtını kapsıyor. Son build'deki AAB/base PCK tekrarları seçilmedi; aynı byte'lar `release/current/artifacts/` içinde zaten var.

`.agents/skills` kaynakta bir Windows junction ve şu anda `F:\unaware-of-my-demise\.codex\skills` yoluna işaret ediyor. Hedefte `.codex` henüz olmadığı için bağlantı kopuk. Bağlantı dosyalarını çoğaltmadan, hedefte `.codex/scripts/bootstrap_skills.ps1` ile yeniden oluşturulmalı. Linux'ta PowerShell 7 varsa aynı bootstrap kullanılabilir; yoksa aynı göreli ilişki için bir bootstrap adımı hazırlanmalı. Git'teki `100755` shell script izinleri de yeni Windows checkout'una dosya eklerken korunmalı. İncelenen ana build scriptleri LF satır sonlu ve BOM'suz.

Secondary Production ve Drive LEGACY orijinalleri bu taşımanın kaynakları olarak değiştirilmemeli. Bu klasörde bulunan kopyalar/provenance korunabilir. Bütün harici yaratım geçmişinin bu klasörde bulunduğu iddia edilmez; bazı provenance kayıtları harici dosya ve Drive kaynaklarına işaret ediyor.

## 4. AAB ve patch için mevcut kanıt

Bu rapor sırasında aşağıdaki kontroller yeniden çalıştırıldı:

| Kontrol | Sonuç |
|---|---|
| `materialize_aab.py verify release/current --project-root .` | PASS; 555 mühürlü dosya, upstream kaynak güncelliği kontrol edildi |
| Güncel AAB/base PCK SHA-256 hesapları | Release metadata'sıyla eşleşiyor |
| bundletool 1.18.2 `validate` | PASS |
| `jarsigner -verify` | PASS; mevcut debug imzası |
| `verify_aab_native.py` | PASS; native bridge, Google sign-in, billing, ads/consent sınıfları ve manifest kayıtları |
| Güncel story patch'e `pck_inventory.py --patch-policy --base ...` | PASS; 9 dosya |

| Artifact | Konum | Boyut |
|---|---|---:|
| Güncel AAB | `release/current/artifacts/game.aab` | 134.505.206 bayt / 128,27 MiB |
| Bu AAB'nin base pack'i | `release/current/artifacts/opening-base.pck` | 101.418.860 bayt / 96,72 MiB |
| Eşleşen story patch | `build/current-aab-20261008-221217-9ccfb2c4/story-content.pck` | 155.488 bayt |

SHA-256 kimlikleri:

```text
AAB:   7bd2bf0bfa85e5e7d387d62e893d4be087c44a5dcda2225785a02bf5e186a652
Base:  8a92c0ace0ff928ea131ccb34494cee237644532e255054a7108399fade5dc1f
Patch: f2095e3492a1e3f17e76857e0bf2780034162e4ba26ac12e2d7556c271dcee9c
```

Mevcut release kabul kayıtlarında üç tutorial savaşının tamamlanması, 32 pose lookup ve temiz kaynak rebuild başarısı bulunuyor. Bu rapor yeni bir görsel runtime/telefon testi veya yeni AAB build'i çalıştırmadı. Android cihaz kabulü, production signing ve final ses/müzik halen pending. `game/assets/voice/` yok; narrative içinde Japonca ses kaynakları var, fakat bunların güncel runtime'a tamamının entegre olduğu sonucu çıkmaz.

`release/current/` açılış/prologue, tutorial, patch onayı ve restart için üretilmiş bir test snapshot'ı. Bütün sonraki story içeriğinin geliştirme kaynağı değildir. Düzenlemeler ana `game/` projesinde yapılmalı; kabul edilen değişikliklerden sonra `tools/Update-CurrentAAB.ps1` ile snapshot yenilenmeli. Mühürlü snapshot elle değiştirilmemeli.

## 5. Patchlenebilmek ne gerektiriyor?

Mevcut projedeki patch politikası **JSON içerik verisi ve izin verilen import edilmiş görsel/ses assetleri** ile sınırlı. GDScript, native kod, sahne, script barındırabilen resource ve proje ayarı değişiklikleri içerik patch'iyle gönderilmez; yeni uygulama/AAB sürümü gerektirir. Godot'un genel PCK mekanizması daha geniştir; bu sınır projenin kendi `tools/pck_inventory.py` kontrolünden gelir.

Korunması gerekenler:

1. Tam Godot kaynakları, `game/data/content/MANIFEST.json`, stable asset ID'leri, import ayarları ve UIDs.
2. Her yayımlanan AAB'ye ait **gerçek base PCK**, hash, engine/preset/versionCode ve kaynak commit kimliği. Eski base pack'i saklamak, her defasında yeniden üretildiğini varsaymaktan daha güçlü bir kanıttır.
3. İçerik public verification key'i `game/data/keys/uomd-content-1.pem`; private signing key ayrı bir secret olarak tutulmalı.
4. `game/tools/build_content_patch.sh`, inventory/manifest/signing araçları ve `publish-content.yml`.
5. R2 pack/manifest/history/channel objeleri ve dağıtım yapan Worker kaynakları. Canlı R2/Neon verileri klasörün içinde değildir; disk taşıması bunları taşımaz.

Mevcut publish workflow'u base commit'ten pack'i yeniden üretir ve kümülatif patch yayınlar. Linux'ta yeniden üretilen base'in gerçek release base'iyle uyumu, yeni cloud doğrulamasında özellikle kontrol edilmeli. Ayrı export süreçlerinde import/resource byte farklarını yalnız commit SHA üzerinden doğru varsaymamak gerekir. Godot'un [PCK ve patch dokümantasyonu](https://docs.godotengine.org/en/stable/tutorials/export/exporting_pcks.html) paket yükleme ve imzalama sınırlarını açıklar.

## 6. Yerel ve cloud araç zinciri

Yerelde Godot **4.7.2.stable.official.ed1daf0bf**, JDK **17.0.20.1**, Node **22.23.3**, Git LFS **3.7.1** ölçüldü. Android SDK platform 36/build-tools 36.1.0 ve Godot 4.7.2 Android debug/release/source template dosyalarının varlığı kontrol edildi. Gradle 8.11.1 mevcut; native plugin AGP 8.6.1 pin'li.

Engine, SDK/JDK, Gradle, Python/uvx ve Codex kişisel ayarları proje klasörünün dışında. Sadece klasörü taşımak bu araçları yeni bir cloud makinesine kurmaz. Cloud hazırlığı şunları yeniden kurmalı:

- Linux Godot 4.7.2 ve eşleşen export templates; checksum kontrolüyle.
- JDK 17, Android SDK/platform 36/build-tools 36.1.0, Gradle 8.11.1, Python ve Node 22.
- Native AAR'lar: `game/tools/build_uomd_native.sh` ile yeniden derleme.
- Server/admin dependency'leri: mevcut lockfile'larla `npm ci`.
- Test DB için PostgreSQL 18 ve mevcut GUT/parity/e2e harness'i.
- Graphify gerekiyorsa cloud'a ait interpreter yolu ve güncel Godot extraction helper; yerel `.graphify_python` yolu kopyalanmamalı.

Gerçek renderer **gl_compatibility**, GDScript, Android portrait 1080×1920 ve strict typing korunmalı. `project.yaml` içindeki Mobile renderer ve gdUnit4 komutu gerçek projeyle uyumsuz; gerçek proje GUT kullanıyor. Bunlar cloud bootstrap'ın körlemesine uygulayacağı ayarlar olmamalı. Android AAB için Gradle ve release signing gereksinimleri [Godot Android export belgesinde](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_android.html) açıklanıyor.

Yerelde `.github/workflows/` altında CI, Android release, content publishing, deploy/staging, monitor, backup ve restore-drill kaynakları var. Fakat yeni yerel release/materialization testlerinin `tools/tests/` kapsamına gerçekten girdiği doğrulanmalı; mevcut CI tool test adımı `tools/` kökünü keşfediyor. Cloud için temiz clone setup'ı ve güncel opening AAB/native/patch kanıtlarının CI'de aynı kapsamda üretilmesi henüz doğrulanmadı.

**Deployment etkisi:** Bu workflow'lar yeniden `main` üzerinde yer aldığında başarılı CI, `deploy.yml` aracılığıyla production migration/Worker deployment tetikleyebilir. İlk taşıma doğrulamasının ayrı dal/PR'da yapılması ve production geçişinin kaynakları saklama adımından ayrı ele alınması gerekir.

## 7. GitHub dosya politikası

İncelenen Git-görünür kaynak dosyalarında 100 MiB üzeri dosya yok; en büyük kaynak ZIP yaklaşık 12,07 MiB. Bu nedenle mevcut kaynak setini saklamak için hemen LFS'ye geçmek zorunlu değil. Asset sürümleri büyüdükçe PNG/audio/PSD gibi binary kaynakların LFS politikası ayrıca belirlenebilir. `.gitattributes` şu an binary tanımlar içeriyor, LFS tracking içermiyor; git-lfs'nin bilgisayarda kurulu olması tek başına LFS kullanımını başlatmaz.

128,27 MiB AAB normal Git upload sınırını aşıyor. AAB/PCK ve build cache'ler normal kaynak commit'lerine eklenmemeli. Kaynaklar Git'e, test AAB'leri Actions artifacts'a; kalıcı release base/manifest/provenance kayıtları ve dağıtım dosyaları uzun süre saklanan release/object storage alanına gitmeli. Mevcut Android workflow artifact retention süresi 90 gün; uzun vadeli patch base arşivi yalnız bu geçici saklamaya bağlı bırakılmamalı. [GitHub büyük dosya sınırları](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) ve [LFS açıklaması](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage).

## 8. Godot AI / MCP ve masaüstü görüntüleme

| Kontrol | Bugünkü durum |
|---|---|
| Resmî Godot AI addon | 4.3.0; `game/addons/godot_ai/`, 313 dosya; proje içinde enabled |
| Codex client launcher | `godot-ai==4.3.0`, authenticated `attach`/STDIO; telemetry kapalı |
| Client çalışma yolu | `F:/unaware-of-my-demise/game`; bugün bu dizin henüz yok, taşıma sonrası doğru hedef olacak |
| HTTP/WebSocket ayarları | 8000 / 9500; `allow_remote_hosts` boş, loopback |
| Bu sohbetin araç kataloğu | Godot AI araçları görünmüyor |
| Canlı Godot Editor/runtime | Bu audit sırasında çalışan editor veya 8000/9500 listener tespit edilmedi; bağlantı yeniden denenmedi |
| Eski NPGameDev MCP | İptal edilmiş tarihsel yedek; aktifleştirilmemeli |
| Cloud → masaüstü bağlantısı | Henüz kurulmadı/doğrulanmadı; kontrol edilen `sshd` servis sorgusu kayıt döndürmedi |

Kurulumun geçmiş başarılı round-trip ve screenshot kayıtları var; bunlar bugünkü canlı bağlantının kanıtı yerine geçmez. Godot AI değerlendirmesi **PARTIALLY_VERIFIED**: addon/config doğrulandı, canlı bağlantı ve cloud erişimi doğrulanmadı.

Godot AI 4.3.0'ın [sürümle sabitlenmiş resmî client belgesi](https://github.com/hi-godot/godot-ai/blob/b82b5c519b1b17228f70d8effce1626f391bd1dd/docs/client-configuration.md#agents-on-another-machine-or-in-a-container), uzaktaki ajanın `attach` köprüsünü **editörün bilgisayarında** çalıştırıp STDIO'yu SSH üzerinden taşımasını tarif ediyor. Private capability kaydı makinede kalıyor. Bir cloud container'daki `127.0.0.1`, masaüstündeki bilgisayara işaret etmez.

Önerilen çalışma düzeni:

```text
GitHub: kaynak + asset + pipeline + sürüm kimliği
   ├─ Cloud çalışma kopyası: düzenleme, headless test, AAB/patch build
   └─ F:\unaware-of-my-demise: aynı commit'in masaüstü çalışma kopyası
        └─ Godot Editor + mevcut Local UI Preview + Godot AI

Cloud ajanı ── SSH / özel ağ ── masaüstündeki godot-ai attach
```

Cloud commit'inin yerel çalışma kopyasına kontrollü alınması, temiz/ayrı dallar ve commit kimliği üzerinden senkronizasyon gerekir. Kaydedilmemiş iki ayrı çalışma ağacı kendiliğinden senkronize olmaz. Aynı dosyalara iki tarafın eşzamanlı yazmasını koordine etmek gerekir. Bridge'in same-user SSH erişimi ve cloud ortamının buna izin vermesi bağlantı deneyiyle kanıtlanmalı; bu rapor ortamdan bağımsız hazır bağlantı garantisi vermez.

**Masaüstündeki Godot penceresini doğrudan görebilirsin.** MCP; ajan için editör/sahne/runtime inspection, kontrol ve screenshot erişimi sağlar. Sürekli uzak masaüstü/video akışı ayrı bir GUI erişim katmanıdır. Editörün kendisinin de cloud'da çalışması istenirse GUI'li kalıcı VM, uygun OpenGL ortamı ve remote desktop gerekir; standart headless CI runtime'ı bu görsel gereksinimi tek başına karşılamaz. Masaüstü kapalıyken cloud headless işleri çalışabilir, masaüstü Godot MCP incelemesi çalışamaz.

## 9. Önerilen taşıma ve kabul sırası

1. Kaynaktaki mevcut değişiklikleri ve hedefin `.git` geçmişini koru. Manifestteki kaynakları hedefe kopyala; kopuk skill junction'ını dosya gibi kopyalama. Kaynak kökü bu aşamada silme.
2. SHA-256, kaynak dosya sayısı, `.uid`/`.import`, lisans ve executable Git modlarını manifestle karşılaştır. Özel yerel ses config'ini Git paketine alma; API anahtarının yenilenmesi gerekli.
3. Skill bridge'i hedefte oluştur. Mevcut kişisel Godot AI `cwd` hedefle zaten uyumlu; kişisel config'i Git'e kopyalama. Yerel Godot'u hedef projede açıp editor/runtime logları, Entry ve aynı reusable Local UI Preview üzerinden screenshot/etkileşim kanıtı al.
4. Hedefte mevcut mühürlü release'i yeniden doğrula; ardından temiz bir kopyada native rebuild, opening AAB ve content-only patch üretimini doğrula. Eski kabul edilmiş AAB/base kimliklerini ayrı sakla.
5. GitHub/cloud hazırlığı aşamasında kaynakları `codex/` dalına al; `.gitignore`, source-only paket, CI test kapsamı ve deployment tetiklerini kontrol et. Yeni Linux clone'da SDK/templates/native/GUT/parity/AAB/patch kontrollerini çalıştır. Sonuçlar görülmeden cloud çalışması tamamlandı sayılmamalı.
6. Seçilen cloud ortamında SSH üzerinden Godot AI'ye salt okunur sahne/log/screenshot çağrısı yap; doğru proje ve aynı commit doğrulandıktan sonra bu bağlantıyı günlük akışa ekle.
7. Production upload key, content signing key, Play sürüm/cihaz kabulü ve yayınlama ayrı tamamlanmalı. Kaynak klasörün kaldırılması ancak taşıma ve çalışma kanıtları tamamlandıktan sonra değerlendirilir.

## 10. Denetim çıktıları ve sınırlar

Yerel kanıtlar `.local/migration-audit-20261008/` içinde:

- `summary.json`: klasör/boyut/Git/MCP config özeti; secret değerleri içermez.
- `file-inventory.json`: 46.871 fiziksel dosyanın yol/boyut envanteri; graph.json okunmadı.
- `proposed-file-manifest.json`: önerilen 7.307 dosyanın SHA-256, kategori, Git modu ve GitHub/local saklama politikası.
- `github-readonly.json`: GitHub branch/metadata/son run özetleri.
- `validation.json`, `native-packaging.json`, `story-patch-policy.json`, bundletool ve signature logları.

Manifest mevcut uygulama kaynaklarına ve eldeki assetlere aittir; henüz üretilmemiş müzik, ses, final sanat veya gelecek ekranların bütün assetlerini var kabul etmez. R2/Neon servislerinin güncel production sağlığı, secret kurulumunun eksiksizliği, production imzalama, temiz cloud build ve gerçek Android cihaz kabulü bu raporda doğrulanmış değildir.

Ses authoring config'indeki API anahtarı dosya okunurken araç çıktısına yanlışlıkla alındı. Bu rapor ve hazırlanan manifestler anahtar değerini içermez. Anahtarın yenilenmesi önerilir; anahtar iptali veya ayar değişikliği bu rapor aşamasında yapılmadı.
