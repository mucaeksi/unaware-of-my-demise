# Fadyme — tam oyun denetimi ve tasarım kapsamı · v001 · 2026-10-09

Bu paket üretim öncesi denetimdir. Yeni görsel/ses üretilmedi, adaylara yeni onay verilmedi ve runtime kodu değiştirilmedi. Baz alınan kod: `ccc9f67`. İlk AAB için hazırlanmış düzeltmeler ve build kanıtları Codex'in son AAB teslimidir; bundan sonra Codex oyun/script incelemesi ve asset/tasarım üretir, Claude kod entegrasyonu ve sonraki AAB'leri yapar. Kullanıcı Fadyme'yi ilk tasarım odağı olarak seçti. Kaynaklar `main` için hazırlanır; gönderim gerçekleşmeden GitHub'da mevcut sayılmaz.

## Sonuç

Seslendirme tek eksik değil. Mevcut Fadyme paketi oynatılabilir bir görsel pilot sunuyor; eksiksiz animasyon, duygu eşleştirmesi, hikâye durumları, sinematikler, özel skill VFX/SFX ve bütün UI kullanımları için tamamlanması gereken işler var.

| Alan | Doğrulanan mevcut durum | Eksik / sonraki iş |
|---|---|---|
| Replikler | 241 benzersiz ID: 206 konuşma + 35 iç ses | 216 kayıt; 40 tutorial satırına JP çeviri; tüm JP taslağına dil/editör ve dinleme kontrolü |
| Mevcut sesler | 25 OGG, 16 konuşma + 9 iç ses; hepsi tam decode edildi; İngilizce kaynakları güncel scriptle aynı | Hiçbiri runtime ses klasöründe değil; Claude doğru `speaker_id/line_id` ile taşır |
| VN portreleri | `composed`, `warm`, `quiet_pain`, `honest_fear`, `wry`; beş PNG mevcut | 154 duygulu satır / 55 etiket açık eşleşme bulamıyor ve `composed` kullanıyor; ifade yönlendirme tasarımı ve gerekiyorsa yeni varyantlar |
| Savaş | v003 atlas; sekiz durum; ayrı v003 ultimate pozu, v001 cut-in | Gerçek döngü/ara kare veya ayrı katman paketi yok; anticipation, aksan, recovery, geçiş ve kesilme tasarımı |
| VFX | Veil hedef izi, temel hit/heal/status sunumu ve ultimate sunum altyapısı | Dört skillin ayrı görsel dili; Dread, cleanse, heal ve pasifin okunur anlatımı; özel ses/miks |
| UI | Runtime profile icon ve Entry portresi; kaynakta dört farklı UI portrait adayı | Companion/Roster/Menu/BattleHUD adaylarını ekran bazında değerlendirme ve doğru türev/handoff; bütün ekranlarda bitmiş entegrasyon yok |
| Hikâye | Yedi bölüm + companion/event/tutorial tarandı; 93 sahne/direction kaydı listelendi | Mektup/dua kitabı, kanı gizleyen atkı/eldiven, anne portresi/pin, 5-4 beyaz tutam, final el/lanet/itiraf kompozisyonları ve durum kapıları |
| Tema | Kilitli Fadyme tema loop/original hashleri kaynak kopyalarıyla doğrulanabiliyor | Runtime müzik klasöründe OGG yok; doğru sahne/cue, loop/miks ve paket kararı gerekiyor; ana tema ayrı ve kullanıcıya ait |
| Referanslar | Kilit listesinin 26 tarihsel yolu artık yok; 9 öğe taşınmış kaynaklarda byte-exact bulundu | Diğer 17 kilitli özgün Git geçmişinden kurtarıldı; mevcut pilotla farkları açık kalır, kilit dosyası değiştirilmedi |

## Ses iş listesi — gerçek güncel kapsam

| Kaynak | Fadyme satırı | Kayıt mevcut | Kayıt eksik |
|---|---:|---:|---:|
| Ch1 | 22 | 22 | 0 |
| Ch2 | 21 | 3 | 18 |
| Ch3 | 14 | 0 | 14 |
| Ch4 | 16 | 0 | 16 |
| Ch5 | 13 | 0 | 13 |
| Ch6 | 15 | 0 | 15 |
| Ch7 | 31 | 0 | 31 |
| Tüm companion hikâyelerindeki Fadyme | 56 | 0 | 56 |
| Event | 2 | 0 | 2 |
| Karakter/combat voice bank | 11 | 0 | 11 |
| Yeni T-1/T-2/T-3 tutorial | 40 | 0 | 40 |
| **Toplam** | **241** | **25** | **216** |

Eski `Fadyme_Missing_VO.json` 201 kaynak / 25 mevcut / 176 eksik sayıyor. O liste tarihsel olarak doğru; yeni tutorialın 40 Fadyme repliğini içermiyor. Eski ID'ler yeni tutorial ID'lerine yeniden adlandırılarak kullanılamaz. Güncel 201 satırın tamamı eski JP taslağındaki İngilizce metinle aynı; tutorialın 40 satırı o taslakta yok. [current_lines.json](current_lines.json) her satırın metnini, kaynak konumunu, JP taslağını, ses varlığını ve runtime hedefini içerir. Eksik replik metni ile eksik ses kaydı farklıdır: bu 241 ID'nin İngilizce metni mevcut.

Kimlik: Sulafat; genç yetişkin, kontrollü alto, nazik ve kesin, acıyı teatralleştirmeden saklar; iç ses çok yakın ve sessiz. Kilitli casting/referans yeniden üretilmez. Mevcut take seçimlerinde ASR skoru düşük olanlar var (ör. `ch1_camp_006`); ASR puanı tek başına kayıt ret nedeni değildir. Ana dili Japonca olan editör metin/telaffuz ve dinleyerek seçim yapmalı. Decode başarısı dil veya sanat onayı değildir. Google API ile önce 40 tutorial çevirisini ve bir küçük ses grubunu birlikte gözden geçiririz, sonra sahne grupları; bu denetim ücretli çağrı yapmadı.

## Görseller, animasyon ve script sorunları

Güncel bağlama otoritesi `game/data/presentation/battle_art_v001.json`: atlas `chibi_poses_v003.png`, ultimate `ultimate_pose_v003.png`. Eski pilot notlarının v001/v002 isimleri bugün kullanılan sürümleri açıklamıyor. `chibi_poses_v001.png` ve `ultimate_v001.png` kaynak/önceki sürüm olarak duruyor; otomatik silinmedi.

11 runtime PNG tamamen Pillow ile açıldı; atlas/pozların alpha sınırları mevcut `tools/inspect_battle_art.py` ile ölçüldü. Fadyme'nin zemin farkı 250 px ölçümde en fazla 1.16 px. Bu ölçüm anatomi veya çizim onayı değildir. PNG'ler toplam 31,227,944 byte; tümünün aynı anda RGBA açılması yaklaşık 66 MiB, mipmap/diğer GPU maliyetleri hariç. Gerçek eşzamanlı kaynak yükü ve Android performansı ölçülmedi. Genel planned spec 640×960 VN ve 192×192 profile önerirken güncel dosyalar VN 1086×1448, profile 1254×1254; bu farkı yeni türev ve cihaz ölçümüyle çözmek gerekir, kaynakları ezerek değil.

`BattleArt.portrait()` açık alias yoksa `composed` seçiyor. Manifestte `warm` ve `wry` dosyaları olsa da aynı isimli duygu etiketleri alias listesinde yok; `fear`, `tearful`, `fragile`, `strained`, `curious`, `gentle` gibi pek çok etiket de bu yolu kullanıyor. Her etiket için yeni portre gerekmez: önce [current_lines.json](current_lines.json) üzerinden 55 etiketi sahne bağlamına göre mevcut beş ifadeye veya gerçek yeni varyanta yönlendiren tasarım tablosu hazırlanır. Final itirafındaki kırılganlık ile tutorialın merakı aynı yüzle geçmemeli. Runtime manifest düzeltmesini Claude yapar.

Üç ayrı aksesuar korunur: hoodun alın üstü kenarında kırık taç parçası; yüz yanında annenin küçük gümüş çan saç pini; zincirde diken tokmaklı çan silahı. Birbirine veya göğüsteki dekoratif kopçaya indirgenmez. Mevcut çizimler ash-blonde saç, violet göz, plum/black kumaş, ivory scarf ve silver-lilac işlemeyle değerlendirildi; küçük ölçekte pin/kolye ve alpha kenarları ayrıca gözden geçirilecek. `Summoner` yazan eski board canon sınıfı değildir: `Veil`, `support_dps`, rear, free starter, 22 yaş yetişkin korunur.

Animasyon paketi sekiz durumun tasarımını kapsar: idle, walk, basic, active, ultimate, hit, defeat, victory. PNG pozu ve tween mevcut, iskelet/katman/ara kare varmış gibi teslim yapılamaz. Kaynaklara göre frame dizisi veya katmanlı cutout seçilir; sabit ayak pivotu, sağa facing, silah silueti, kesilme/ölüm sonrası dönüş, x1/x2/x3 ve Reduced Motion için kabul koşulları yazılır. Dövüş hesapları yeniden tasarlanmaz.

VFX dört mevcut ID'ye bağlanır: `fadyme_basic_veilglass_thorn` (tek hedef thorn/Veil), `fadyme_active_borrowed_hour` (tek hedef damage + Dread, düşük HP müttefike heal), `fadyme_passive_a_smile_kept` (düşük HP koşulunda müttefik Veil RES), `fadyme_ultimate_the_bell_that_forgets` (all-enemy damage/Dread, müttefik cleanse ve koşullu heal). Yeni güç veya summon icat edilmez. Mevcut violet iz tek başına bu dört anlamın tamamını anlatmıyor; HP/isim/hedef/subtitle örtülmeden etki, hedef ve destek rolleri ayrıştırılmalı. Mobile GL Compatibility bütçeleri cihaz ölçümüne bağlıdır.

## Hikâye durumları ve sinematikler

[scene_requirements.json](scene_requirements.json) Fadyme'nin konuşmadığı ama yönlendirmede geçtiği sahneleri de kapsar. Açılışın mektubu/kanlı eldiveni; 3-3 kanı gizleyen scarf; 4-4 mektubun dua kitabına saklanması; 5-4 kemik beyazı saç tutamı; 6-2 anne portresi, bell hairpin ve saatsiz saat; Ch7 parmaklardaki siyah-altın çizgiler, Mahmut'un yanında diz çöktüğü itiraf kompozisyonu ve Cael/Yseldra yansıması için kaynak/katman ve shot planı gerekiyor. Üç tutorial sahnesi yeni metin taşıyor; eski prologue görselleri bu yeni repliklerin hepsine otomatik uygun sayılmaz.

Hastalık ilerlemesi normal savaş sprite'ına ve varsayılan UI portresine erken spoiler olarak taşınmaz. İlerleme/unlock sınırları canon ve mevcut `stage_id/placement/unlock` kaydından gelir. Zamanlaması belirsiz detay için yeni eşik icat edilmez. Part II'nin iyileşme/yeniden sevinme hali Part I default assetine karıştırılmaz. Arka planların tümü tamamlanmış kabul edilmez; Fadyme sinematiği gerekli lokasyon/diğer karakter handofflarını da açıklar.

## Referans ve provenance düzeltmesi

`narrative/14_References/REFERENCE_SET.lock.json` eski `narrative/references/...` yollarını tutuyor. Dosyaları değiştirmedik. Tarihsel 26 öğenin 9'u mevcut narrative kopyalarının hashleriyle eşleşti; kalan 17 dosya `85ca464` commitinin özgün bloblarından SHA-256 doğrulanarak `narrative/14_References/recovered_locked_v001/` içine alındı. [reference_resolution.json](reference_resolution.json) gerçek mevcut yolları verir; [reference_recovery.json](reference_recovery.json) commit ve kurtarma listesini tutar. Bütün 26 hash artık erişilebilir; eski path linkleri hâlâ tarihsel, mapping kullanılmalı. Kurtarma çalışma artworkü veya runtime promotion değildir.

Yeni Fadyme pilot/portrait manifestleri `pilot_preview`, `approval_board_only` veya `runtime_candidate` diyor. Main'e eklenmiş olmaları owner approval yerine geçmez. Yeni pilot ile tarihsel kilitli sheet aynı dosya değildir. Tek tasarım tutarlılığı için referans farkları review edilir; kilitli master ezilmez, varsa yeni creative karar açık kaydedilir. Ayrı layer/rig çalışma dosyası bulunmadı. Her yeni üretimde gerçek araç/model, kaynak hash, prompt, timestamp, lisans/provenance, aday/onay durumu ve runtime/patch kararı tutulur.

## Tüm oyun genelindeki diğer açık işler

Denetlenen script paketlerinde 419 ana hikâye + 388 companion + 45 event + 220 karakter voice-bank + 107 tutorial satır kaydı var. Tutorialın 24 narration satırı sessiz tasarlanmış, 83'ü Mahmut/Fadyme konuşması. Prologue narration ayrı storyboard/voice kararıdır; her metin kaydı zorunlu ses değildir. Bu paketlerin hiçbirinin runtime voice dosyası bulunmuyor. Fadyme dışındaki karakterlerin casting/çeviri/kayıt işi, müzik, ambience ve SFX de tamamlanmalı; önceki AAB [ses envanteri](../../../../../docs/release/first-aab-voice-inventory.json) açılış kapsamını ayrıca verir.

Registry taraması: character visuals 125 planned asset yolu / 125 dosya yok; visual assets 58 / 38 yok; brand assets 246 / 246 yok. [global_planned_asset_paths.json](global_planned_asset_paths.json) tam listeyi verir. Bunlar üretim backlogudur; mevcut BattleArt, Entry/prologue PNG'leri ve generic UI ikonları ayrı yollarla çalıştığı için bu sayılar "bütün oyun bozuk" sonucu değildir. Standart VN catalogındaki `vn_bust_v001.webp` ve battle atlas yolu eski plan; güncel Fadyme pilot PNG bağlamaları mevcut. Dedicated silah illüstrasyonu, karakter/skill markları ve diğer karakterlerin bitmiş art paketleri de kapsamlandırılmalı.

Teknik kapanış: debug AAB/sealed source ve önceki test kanıtları [ilk AAB raporunda](../../../../../docs/release/FIRST_AAB_FIX_REPORT_2026-10-09.md). Ses/müzik, gerçek Android cihaz/ısınma/giriş/patch uçtan uca kabulü, release signing ve ilgili servis yapılandırmaları açık; build pass bunları kapatmaz. Claude teknik işleri devralır. `fadyme_capture.gd` içindeki Windows çalışma yolu taşınabilir değil; üretim runtime davranışına etkisi ayrıca değerlendirilir.

## Önerilen üretim sırası

1. Referans farklarını ve mevcut beş yüzün kullanımını netleştir; 55 duygu etiketi için yönlendirme tablosu ve tutorial yüz/shot ihtiyaçları hazırlanır.
2. Fadyme'nin sekiz animasyon durumunu ve dört skill VFX'ini tek tutarlı hareket/aksesuar paketi olarak tasarla; ilk inceleme basic + active + idle/walk ile yapılır.
3. JP tutorial 40 satırı, mevcut 25 kaydın dinleme kontrolü ve küçük Sulafat ses grubu; ardından eksik 176 eski satır, chapter/companion sırasıyla. Google çağrılarını kullanıcıyla adım adım yap.
4. Story-state portre/prop varyantları, itiraf/cutin ve ilgili lokasyon katmanları; spoiler kapılarıyla teslim et.
5. Dört UI kullanımını ve dedicated weapon/skill ikonlarını mevcut ekran hedefleri üzerinden tamamla; Claude onaylı grupları entegre eder.

Her grup: brief → prompt/source → candidate → canon/teknik inceleme → durum/provenance → açık handoff. Başlangıç tasarım şartları [DESIGN_SCOPE.md](DESIGN_SCOPE.md) içindedir. İlk görüşmede seçim: mevcut referans farkları + ifade yönlendirmesi, ardından Fadyme'nin hareket dili. Bu paket yeni artwork üretimine başlamadan ortak yol çizmek içindir.
