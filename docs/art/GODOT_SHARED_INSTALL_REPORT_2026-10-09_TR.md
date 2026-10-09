# Godot ortak skill ve referans kurulumu — 9 Ekim 2026

Belgedeki ilk uygulama paketi kuruldu ve doğrulandı. Aktif ortak skill sayısı **32 → 38**. Üç yeni referans ayrı Godot projelerinde çalışıyor. Oyun kaynakları, renderer, autoload/scene bağları, mevcut addon'lar ve ses seçimleri değiştirilmedi. İki gerçek istemcili MCP kabulü ile Windows/Android kabulü aşağıdaki sınırlara tabi.

İstenen araştırma dosyası güncel depoda `docs/art/GODOT_SHARED_SKILLS_ASSETS_2026-10-09_TR.md` konumundaydı. Başlangıç kopyası gerideydi; sahibin son `main` değişiklikleri fast-forward ile alındı. Kurulum öncesi baz commit: `93753f7`.

## Kurulanlar

- `.codex/skills/` tek kaynak; mevcut `.agents/skills` korundu, Claude için 38 ayrı relative keşif bağlantısı eklendi. İki görünüm bütün skill/referans dosyalarında aynı hash'i okuyor.
- Altı yeni skill: `uomd-godot-shaders`, `uomd-godot-audio`, `uomd-android-lifecycle`, `uomd-godot-live-review`, `uomd-accessibility-review`, `uomd-shared-skill-validation`.
- Parçacık, responsive UI, performans, Phantom Camera, asset üretimi/import ve touch yönergeleri mevcut skill'lere yedi uyarlanmış referans olarak bağlandı. Chibi/animation yönergeleri native Skeleton2D çalışmasına yönlendirildi.
- Awesome GameDev ve GodotPrompter'dan seçilen on skill'in tam dizinleri/referansları, LICENSE/NOTICE ve dosya hash'leri `.agents/library/upstream/20261009/` altında **inert kaynak** olarak saklandı. Genel SaveManager, ikinci audio/navigation manager, renderer değişimi, yeni IAP/ads/keystore, 3D veya ücretli API talimatları aktif gövdelere alınmadı.
- `references/shared_godot/`: resmî Skeleton2D demosu, Phantom Camera **0.11.0.3** ve Universal Transition Shader; ayrı Compatibility projeleri ve tekrar çalıştırılabilir kontrol script'leri. Kaynaklar hash/revizyonla sabit, oyun export kökünün dışında.
- Windows/Linux bootstrap, iki keşif yolu + provenance doğrulayıcısı, veri koruma kontrolleri ve Windows tek tıklama kısayolu `ORTAK_SKILLLERI_KUR.cmd` hazır.
- Yeni kaynak arşivleri ve byte-hash'li referanslar için Git satır sonu dönüşümü kapatıldı. Mevcut kütüphane yeniden indirilmedi; inceleme kaydı korundu.

Kaynak pinleri:

| Kaynak | Commit |
| --- | --- |
| Awesome GameDev Agent Skills | `0a70cfc64672d512c5b5b6006b5dcb5cf90dbdbd` |
| GodotPrompter | `1e7d79d3cbbd6fd8016cd9cc77c6a79f342ea218` |
| Godot resmî Skeleton2D | `b761b4cd5718a7118f2c95eb55f181d0a5f004f1` |
| Phantom Camera | `21d3762492e2dc51b448f55438b89b3c19349f96` |
| Universal Transition Shader | `c4e3e659e1338894fc0818f96e69e422a54d67ed` |

## Doğrulama

| Kontrol | Gerçek sonuç |
| --- | --- |
| Mevcut sistem validator'ü | PASS: 38 skill, 6 mevcut agent, 327 arşiv kaynak dosyası; hata yok |
| Ortak keşif/hash/kaynak kontrolü | PASS: 38×2 görünüm, relative referanslar, yeni upstream byte hash'leri ve lisans/notice'lar |
| Native Codex yükleyici | PASS: app-server `skills/list`, modelsiz; 38 proje skill'i birer kez, toplam 44 skill; parser hatası yok |
| Python bootstrap | PASS: beş veri koruma/taşıma/idempotence testi |
| PowerShell bootstrap | PASS: Linux PowerShell 7.5.4'te gerçek bağlantı oluşturma, kullanıcı klasörü koruma, tekrar çalıştırma, taşıma; dört kontrol |
| Skeleton2D | PASS: Godot 4.7.2, gerçek Compatibility render, 16 kemik; fall/fly/idle/jump/land/land_hard/run/walk kliplerinde değişen kemik transform'ları |
| Phantom Camera | PASS: 0.11.0.3, strict untyped kontrolü açık ayrı proje; priority/tween ile focus'a gidip ilk kameraya dönüş; hedef (240,80) |
| Geçiş shaderı | PASS: 540×960 gerçek Compatibility render; yatay wipe için progress 0/1/2'de görünür/yarım/gizli pixel örnekleri |
| Godot AI | PASS: mevcut 4.3.0, canlı 47-tool inventory; iki eşzamanlı authenticated **SDK attach** köprüsü aynı game/ projesini, 4.7.2, gl_compatibility, sahne ağacı ve logları okudu |
| Mevcut Entry native preview | PASS: fixture ile canlı runtime, UI ağacı/öğeleri okunuyor; son çalıştırmada current_run_errors boş ve game helper live |
| Graphify | Mevcut 0.9.80 sorgulandı ve native + Godot/directed/parallel yardımcı yenilemesi yapıldı; haricî semantik API çağrısı yok |

Render kanıtı Mesa llvmpipe yazılım OpenGL üzerinden gerçek Godot görüntüsüdür. Cihaz GPU/FPS kabulü değildir. GBot bir MIT teknik örnektir; Fadyme rig'i veya üretim animasyonu teslim edilmiş sayılmaz. Kamera testi focus/priority/tween kapsamındadır; bütün follow/group modları test edilmiş sayılmaz. Shader testi belirtilen wipe tarifidir; bütün mask/clock/shape kombinasyonları kabul edilmedi.

Kanıtlar: `narrative/15_Art_Workbench/shared_godot_setup_v001/VALIDATION.json` ve `evidence/`. Kaynak kayıtları: `.agents/library/shared-skills-install.json`, `references/shared_godot/SOURCES.json`.

## Bulduğum sorunlar

1. **Varsayılan motor yanlış sürüm:** PATH `godot` 4.6.3; ortamda bulunan doğru **4.7.2.stable.official.ed1daf0bf** ikilisi doğrudan seçildi. PATH geneli değiştirilmedi. Sonraki test/build'lerde de `game/GODOT_VERSION` ile eşleşen ikili kullanılmalı.
2. **Mevcut reference manifesti byte düzeyinde uyuşmuyor:** 1.422 assetin 1.391'i birebir eşleşiyor; **24 VFX shader + 7 SVG ikon** ve ayrıca **7 LICENSE** kaydında CRLF→LF farkı var. CRLF yeniden konulduğunda kayıtlı hash'ler birebir tutuyor; farklı içerik göstergesi yok. Farklar `93753f7` baz commitinde zaten vardı. Kaynak/özgün SHA'lar değiştirilmedi; `.agents/library/reference-byte-audit.json` her farkı kaydediyor. Yeni Git byte-koruma kuralı ilerideki dönüşümü önler; eski manifestin original-source-hash / stored-file-hash ayrımıyla uzlaştırılması ayrı metadata işi olarak açık. Mevcut importer farklı byte'ları değiştirmeyi reddedebilir.
3. **Phantom sürüm/API farkı ve yan etki:** upstream referans skill'i 0.11.0.2, seçilen gerçek addon 0.11.0.3. Yönerge gerçek sürüme göre sınırlandı. Orijinal plugin etkinleşirse PhantomCameraManager autoload ekler ve editörü yeniden başlatır. Denemede manager yalnız ayrı projede kayıtlı; oyun addon listesine eklenmedi.
4. **Shader progress ve sınır riski:** test edilen wipe **0–2** kullanıyor; 1 yarım geçiş. Genel 0–1 kabulü burada yanlış. Mask branch `uv / local_progress` yapıyor; progress/bias sıfıra gelince bölme riski var. Üretim tarifinde açık clamp/endpoint sözleşmesi gerekir; upstream shader patch'lenmedi. Reduced Motion, farklı portrait oranları ve diğer modlar ayrıca test edilmeli.
5. **Godot AI restart güvenilirliği:** bir yeniden başlatmada uvx wrapper'ın process identity/proof kontrolü takıldı. Resmî 4.3.0 backend'i önce dışarıdan başlatıp editörün authenticated adoption yapmasıyla bağlantı düzeldi; addon kaynakları değiştirilmedi. Bu otomatik launch yolundaki bulgu upstream/Claude incelemesine uygun.
6. **Bulut tanı logları:** ses cihazı olmadığı için ilk runtime ALSA ERR_CANT_OPEN verdi; özel test ortamında null ses çıkışıyla son runtime hatasız açıldı. Bu dinleme/mix kabulü değildir. Editörün Vulkan surface sorgusu başarısız, fakat seçilen Compatibility OpenGL render çalışıyor. GUT çevrimiçi sürüm sorgusu yanıt alamıyor; test harness'i değiştirilmedi. Global “editör error=0” iddiası yapılmıyor.
7. **Gerçek iki istemcili kabul tamamlanmadı:** bu bulut profilinde native Codex MCP konfigürasyonu yok; Claude Code kurulu değil. İki SDK köprüsü testi, gerçek Codex+Claude istemcilerinin attach/loader testi değildir. Native Codex skill keşfi başarılı; native Claude skill keşfi, iki native MCP kaydı ve sahibin Windows cihazında doğrulama açık.
8. **Windows junction/placeholder kabulü açık:** Linux'ta hem Python hem PowerShell çalıştı. Git `core.symlinks=false` text placeholder ve Developer Mode olmadan junction fallback mantığı hazır, fakat gerçek Windows'ta çalıştırılmadı. Bootstrap kullanıcı normal klasörlerini veya yanlış hedefli linkleri silmez. Taşınmış eski junction konfliktsa yalnız doğrulanmış link düğümü kaldırılıp tekrar kurulmalı; hedefe recursive silme uygulanmaz.
9. **Graphify kapsam sınırı:** mevcut Android Gradle dosyalarında iki AST parse uyarısı ve bazı script/SQL dosyalarında sıfır sembol uyarısı var. Bunlar Godot/native source test arızası kanıtı değil; graph çıkarıcısı kapsam sınırı. Değişen dokümanların eski semantik fragmentleri hash kontrolüyle ayrıldı; tüm yeni metnin LLM-semantic analizi yapıldığı iddia edilmiyor.

10. **Entry MCP screenshot güvenilirliği:** iki `editor_screenshot(source="game")` denemesi `TRANSPORT_OUTCOME_UNKNOWN` ile sonuçlandı; dispatch sonrası tamamlanma belirsiz olduğu için başarılı capture sayılmadı. Üç isolated çalışmanın doğrudan Godot framebuffer PNG'leri gerçekten üretildi ve incelendi. Entry runtime canlılık/UI/log turu başarılı; Entry MCP screenshot kabulü ayrı olarak açık.

## Sahibin Windows kopyasında kullanım

1. GitHub Desktop'ta `main` için Fetch/Pull yap.
2. Kök `ORTAK_SKILLLERI_KUR.cmd` dosyasını bir kez aç. Kopya skill oluşturmaz; iki istemci aynı `.codex/skills/` kaynaklarına bağlanır. Eski kullanıcı klasörü/yanlış link varsa konsol somut çatışmayı gösterir ve korur.
3. Codex ve **Claude Code** keşfini yenile. Claude web sohbeti/Cowork'un yerel bağlantıları otomatik okuyacağı varsayılmamalı.
4. Godot AI dock'unda her gerçek istemci için kendi **Configure/Verify** yolunu kullan. Capability/token ve kişisel client config'ini Git'e koyma. 4.3.0 + game/ + 4.7.2 + Compatibility kimliğini, read-only sahne/log turuyla doğrula.
5. Referansları kendi `project.godot` dosyalarından ayrı aç; mevcut oyun projesine kopyalama/etkinleştirme otomatik kabul adımı değildir.

## Sonraki fazların durumu

Katalogdaki koşullu/beklet kaynaklar, karşılaştırma bekleyen fontlar, ses seçkileri ve Perfetto topluca kurulmadı. Belgenin seçtiği ilk paket tamamlandı; gerçek Fadyme parça/rig/klip üretimi ayrı yaratıcı teslim, audio ise son aşama. Yeni ücretli synthesis, voice seçimi, final 241-line kayıt, oyun entegrasyonu, AAB veya Play yayını yapılmadı. Claude somut handoff ve ölçümlere göre runtime promotion yapacak.

Doğrulanmış kurulum dosyaları ve kanıtları main'e normal fast-forward push kapsamında hazırlanmıştır. Son CI sonucu ayrıca kontrol edilmelidir; bu rapor CI/production deployment/device kabulünün geçtiği iddiası değildir.
