# Açılış → patch ekranı — UI checkpoint

2026-10-07. Kullanıcının kapsamı: en baştan açılış UI'ını düzelterek patch ekranına kadar adım adım ilerlemek. Çalışma yerel; commit/push yapılmadı. Godot 4.7.2 / resmî Godot AI 4.3.0 kullanıldı.

## Salt okunur audit

Değişiklikten önce bulgular kullanıcıya gösterildi. Native Godot splash'ı ardından SovTaym sunumu ve Title geliyor; Google girişi açık kullanıcı eylemiyle başlıyor. SovTaym canlı editörde düzgün render edildi. Title başlığı portredeki yüzün üzerine denk geliyordu. Giriş/patch kartları 680/1240 px minimum yüksekliğe, utility menüsü sabit 190 px konuma bağlıydı. Title ve Entry ilk klavye/gamepad odağını tanımlamıyordu. Kaynak spec/tema mevcut; final Title key art/wordmark ve sahibin ana müziği eksik.

## Yapılanlar

- **Title:** başlık üst bölgeye alındı; sınırlı yatay alan içinde Large Text ile sarılıyor. Part I ortalandı, Support kendi içeriğine uygun genişlikte. İlk odak Tap to start; Tab ile Support erişilebilir. Erken dokunmanın startup/content gate'lerini beklemesi korundu.
- **Google girişi:** üst başlık sadeleştirildi, açıklama oyuncunun kayıt ilişkisini anlatıyor. Esnek portre boşluğu ve içeriğe göre kart yüksekliği kullanılıyor; Google düğmesi ilk odağı alıyor. Girişten önceki checking durumunda hesap görünümü korunuyor.
- **Patch:** sabit 1240 px kart kaldırıldı; kart içeriğe göre boyutlanıp kalan alanda ortalanıyor. Snapshot sync'in oyuncuya görünen adı Loading progress oldu. Yüzde/boyut/ETA eklenmedi; aşamalar mevcut director olaylarından geliyor.
- **Menü/utility:** menü, gerçek düğme ve safe content rect'ine göre konumlanıyor. Menü ve utility kendi odak döngülerini kullanıyor; alt katmanın odaklanabilir kontrolleri geçici olarak kapatılıyor. Phase değişimi açık Settings odağını almıyor. Back geçerli kontrole dönüyor.
- **Developer preview:** menü önizlemesi de gerçek aç/kapat komutunu çağırıyor. Dört yeni regression testi fiziksel Enter/Tab/Escape girdisini, busy gate'i, safe-area menüsünü ve utility odağını doğruluyor.

Native splash/studio kaynakları ve görseller değiştirilmedi. Aynı AppShell/StoryDirector/EntryScreen sahipliği, strict typing, plugin'ler ve Google-only giriş kullanılıyor. Hub/Journey/oynanış ekranlarına geçilmedi.

## Önce / sonra

| Ekran | Önce | Sonra — 1080×1920 |
|---|---|---|
| Title | [Görüntü](F:/unaware-of-my-demise/build/entry-ui-20261007/before-title.png) | [Görüntü](F:/unaware-of-my-demise/build/entry-ui-20261007/final-title-base.png) |
| Google girişi | [Görüntü](F:/unaware-of-my-demise/build/entry-ui-20261007/before-sign_in.png) | [Görüntü](F:/unaware-of-my-demise/build/entry-ui-20261007/final-sign_in-base.png) |
| Patch | [Görüntü](F:/unaware-of-my-demise/build/entry-ui-20261007/before-update_available.png) | [Görüntü](F:/unaware-of-my-demise/build/entry-ui-20261007/final-update_available-base.png) |

Large Text: [720×1280 Title](F:/unaware-of-my-demise/build/entry-ui-20261007/final-title-compact-large.png), [720×1280 patch](F:/unaware-of-my-demise/build/entry-ui-20261007/final-update_available-compact-large.png), [1080×2400 giriş](F:/unaware-of-my-demise/build/entry-ui-20261007/final-sign_in-tall-large.png). Sonuçlar mevcut pilot portreyle UI adayıdır; final art onayı değildir.

## Phase doğrulamaları

| Phase | Sonuç / kanıt |
|---|---|
| Açılış / Title | SovTaym canlı screenshot/hierarchy; native splash ayarı ve ana sahne startup gate'i doğrulandı. Düzeltme sonrası **94/94 UI testi**, [JUnit](F:/unaware-of-my-demise/build/entry-ui-20261007/phase1-title-fixed.xml). |
| Google giriş / kart düzeni | **94/94 UI testi**, [JUnit](F:/unaware-of-my-demise/build/entry-ui-20261007/phase2-entry.xml); gerçek Enter ile Title → Sign In, ilk odak Google düğmesi. |
| Menü / utility / patch odağı | Yeni input testleri **4/4**, entegre UI **98/98**. [JUnit](F:/unaware-of-my-demise/build/entry-ui-20261007/phase3-ui-all.xml), [UI logu](F:/unaware-of-my-demise/build/entry-ui-20261007/phase3-ui-all-console.log), [canlı mouse/Enter/Escape kanıtı](F:/unaware-of-my-demise/build/entry-ui-20261007/live-validation.json). |
| Son regresyon | **399/399**, **53 script**, **142887 assertion**, 64.624 s. Eksik script, SCRIPT ERROR, ERROR veya kapanış leak'i yok. [JUnit](F:/unaware-of-my-demise/build/entry-ui-20261007/gut-final.xml), [konsol](F:/unaware-of-my-demise/build/entry-ui-20261007/gut-final-console.log). |
| Görsel / layout | Title, Sign In, Update available için 1080×1920 normal, 720×1280 %125 ve 1080×2400 %125: **9 gerçek render**. Ana eylemler/footer'lar viewport içinde; menü testi 128/96 px dikey ve 48 px yatay insets ile geçti. [Özet](F:/unaware-of-my-demise/build/entry-ui-20261007/validation-summary.json). |
| Gerçek ana sahne | `res://scenes/main/main.tscn` startup'ı tamamlayıp hazır Title'da kaldı; ilk odak Start, tap pending false. [Kanıt](F:/unaware-of-my-demise/build/entry-ui-20261007/cold-start-validation.json), [görüntü](F:/unaware-of-my-demise/build/entry-ui-20261007/actual-title-coldstart.png). |

Godot AI araçları bu turda doğrudan kullanılabildi. Oyun logunda 0 error ve 1 mevcut eksik `ui/title_key_art` uyarısı; editor kayıtlarında 0 error ve 111 mevcut kod uyarısı var. Loglar korunuyor. Preview'daki hesap ve phase geçişleri demo veridir; Google hesabı veya production backend kabulü sayılmaz. Gerçek main-scene kontrolünde Title'a dokunulmadı.

## Hatalar ve yaklaşım değişiklikleri

1. İlk Title değişikliğinde focus NodePath'leri lazy build sırasında, node'lar ağaca eklenmeden kurulmuştu. Tam test 19 hatayla bunu yakaladı. Kurulum `_ready()` içine taşındı; aynı davranış testleri geçti. İlk log/XML korunuyor (`phase1-title.*`).
2. Menü odağının ilk görünürlük-sinyali yaklaşımı çocukların görünürlük/focus güncellemesiyle çakıştı. Deferred sinyal denemesi menüyü düzeltti ama başlangıçtaki hide callback'i ilk odağı menu düğmesine kaydırdı. İki başarısız denemeden sonra sinyal yaklaşımı bırakıldı; açık `_toggle_menu` / `_close_menu` komutları ve yalnız açılış için deferred focus kullanıldı. Aynı dört assertion grubu geçti; testler gevşetilmedi. `phase3-focus.*`, `phase3-focus-fixed.*` ve `phase3-focus-explicit.*` kanıtları tutuldu.
3. Tek dosya GUT çalıştırması 4/4 geçse de kapanışta 282 ObjectDB / 106 resource ve RID uyarısı üretti. Tek testlik verbose inceleme GUT GUI/error-tracker ve bağımlı resource'ların tutulduğunu gösterdi; kesin cycle kökü bu UI kapsamı içinde izole edilmedi. Entegre **98/98**, tam **399/399** ve standalone ekran capture'ları bu kapanış hatalarını üretmedi. Runner/addon'a workaround uygulanmadı. Dar runner sorunu yeniden ele alınacaksa aynı setup ile ayrı bir GUT reproducer üzerinden incelenmeli; temiz entegre sonuçlar dar koşulun çözüldüğü anlamına gelmez.
4. MCP `input_sequence` action-state yöntemi GUI Enter eventi üretmedi; doğrulama fiziksel `input_key` ve `input_mouse` ile yapıldı. İlk main-scene screenshot'ı fade'in siyah başlangıcını yakaladı; ardından gerçek pencere odağı ve tamamlanmış startup/Title durumu kontrol edildi.

## Sınırlar ve devam noktası

Final Title art/wordmark, sahibin ana tema dosyası ve gerçek Android cihazda Credential Manager/touch/safe-area QA'sı bekliyor. Bu UI turunda APK yeniden üretilmedi; önceki debug APK bu son UI değişikliklerini içermez. Son main runtime Title'da açık bırakıldı. Sonraki ekranı kullanıcı seçer; mevcut checkpoint patch ekranına kadar olan UI'dır.

Başlangıç kopyaları `local-backups/entry-ui-20261007/`; kaynak envanteri [change-inventory.json](F:/unaware-of-my-demise/build/entry-ui-20261007/change-inventory.json). Önceki transport/cleanup/APK çalışması [ayrı audit raporunda](F:/unaware-of-my-demise/docs/ui/production-v001/ENTRY_AUDIT_2026-10-07.md) korunuyor.
