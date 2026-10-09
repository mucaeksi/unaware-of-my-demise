# İlk AAB çalışma planı

İnceleme tabanı: `origin/main` / `3d05c7682e8a44d3f65b9b978c9f1c1fc43c0bf4`.
Bu çalışma yerel düzeltme ve build hazırlığıdır. GitHub push/yayın sahibi kullanıcıdır.

Kullanıcının son yönlendirmesi: önce inceleme sorunlarını düzelt; kayıp replikleri
bul veya yeniden üret; ilk AAB'yi tamamla; ardından Codex'in karakter ve mekân
tasarımına yoğunlaş. Japonca seslendirme ve müzik Google API ile, kullanıcıyla
adım adım hazırlanacak. Eski takeover prompt'u bu yönlendirmeyi geçersiz kılamaz.

## Kapsam ve tamamlanma ölçütü

Mevcut export mimarisi temel alındı: Entry/Title, giriş, yardım/ayarlar, 120 saniyelik
Prologue, Continue, altı eğitim öncesi/sonrası sahnesi, üç Fadyme/Mahmut eğitim
savaşı, patch indirmesine onay, tamamlama ve yeniden başlatma. Yedi bölümün
hikâyesi `story-content.pck` ile gelir. Kullanıcı yedi bölümün AAB içinde olmasını
seçerse export sınırı ve kabul listesi birlikte değiştirilecek; bu henüz seçilmedi.

“Tamamlandı” demek için güncel kaynaklardan imzalı AAB, kaynak/paket eşleşmesi,
onaylı gerekli sesler ve müzik, gerçek Android cihazda giriş/patch/restart testi,
görsel/ses kabulü ve yayın hedefi için gerekli imza/hesap ayarları gerekir.
Headless test veya debug imzası tek başına bu ölçütleri karşılamaz.

## Bu düzeltme paketinin kapsamı

| Bulgu | Düzeltme / doğrulama |
|---|---|
| LF/CRLF yüzünden manifest farklılığı | Runtime JSON için LF; manifest yeniden üretildi |
| Betiklerin çalıştırma izni yok | Aktif shell betikleri ve doğrudan çağrılan APK notices betiği executable |
| Sealed release byte'ları checkout'ta değişiyor | `release/current/**` için satır sonu dönüşümü kapalı |
| Kayıp ana hikâye replikleri | 10 özgün kayıt kaynak sırası ve ID ile geri kazanıldı; toplam 419 |
| Runtime diyalog/konuşmacı/canon farkları | Ana/yan hikâye ve event farkları özgün kaynakla düzeltildi; Yseldra entity ID korunuyor |
| Spoiler/VO koşulları kayıp | 9 Codex ve 40 ilişki VO unlock koşulu geri taşındı |
| Sahne yönetmenliği ve müzik notları kayıp | Kaynak metadata korundu; uygulanabilir cue/ses eşlemesi sonraki ses aşaması |
| Eski görev başlangıcı ve taşınmış linkler | Güncel yetki sırası ve mevcut dosya hedefleri kullanılıyor |
| Windows'a bağlı build varsayımları | XDG templates/config ve platforma uygun harici debug keystore yolu |
| Eski AAB kaynak kopyası | Güncel kaynaklardan AAB üretildi; bağımsız rebuild, 17 sahne ve sealed kaynak denetimi geçti |

Ayrıntılı alan ve kaynak kayıtları: [dialogue-restoration.json](dialogue-restoration.json).
Eski Narrative audit dosyaları tarihsel kanıttır; önceki 409 sayısı güncel sonucu anlatmaz.
Yeni regresyon testi kaynak/runtime replik, sıra, konuşmacı ve unlock kaybını yakalar.

## Google ses ve müzik: birlikte uygulanacak sıra

1. İlk AAB sınırını ve Prologue anlatıcısını kesinleştir. Güncel içerikte **83 diyalog**
   var: **Mahmut 43**, **Fadyme 40**. Prologue **9 anlatım satırı**, eğitim sahneleri
   **24 metin anlatımı** içeriyor. Metin anlatımlarını otomatik seslendirme işi sayma.
   [Güncel satır envanteri](first-aab-voice-inventory.json) her ID'yi ve İngilizce metni verir.
2. Google projesi/API erişimi, kullanılabilir Japonca TTS ve müzik modelinin gerçek
   API dokümanı, bölge ve fiyatını kontrol et. Eski notlardaki model adları erişim
   kanıtı değildir. Kimlik bilgileri secret ortamında kalır. Henüz ücretli API çağrısı yapılmadı.
3. Güncel 83 repliğin Japonca metnini ve telaffuz sözlüğünü hazırla; karakter sesi,
   duygu, duraklama ve süreleri satır ID'sine bağla. Fadyme için mevcut onaylı **Sulafat**
   ses kimliğini koru; Mahmut için farklı bir ses seç. Önce küçük bir performans
   kontrol/audition grubu üretip kullanıcıyla dinle; ardından kabul edilen ayarlarla
   kontrollü gruplar halinde devam et. JP editör kontrolünü ayrıca kaydet.
4. Eski Fadyme paketindeki 25 seçilmiş sesi kendi ID'si ve metniyle değerlendir.
   Bunlar yeni `tutorial_*` ID'lerinin yerine yeniden adlandırılamaz. Eski 201 satırlık
   taslağın 176 ses eksiği bütün Part I içindir; ilk AAB'nin 83 yeni satırıyla aynı liste değildir.
5. Ana tema kullanıcı kontrolündedir; mevcut müzik mi kullanılacak, Google ile
   birlikte mi üretilecek kararı bekliyor. Önce Entry/Prologue/eğitim savaşı ve sonuç
   cue listesi oluştur. Katmanlar, loop sınırları, sessizlik ve diyalog altında ducking
   ayrı kabul ölçütleridir. Kaynak `music_cue` notları çalışan runtime cue ID'si değildir.
6. Onaylı seslerin master/provenance kayıtlarını repo içinde mevcut ses düzeninde
   tut; runtime türevlerini `game/assets/audio/voice/<speaker_id>/<line_id>.ogg` ve
   mevcut music/sfx cue yollarına taşı. Hash, süre, decode, ses seviyesi, loop ve
   telif/kullanım kaydı doğrulanır. Export envanterinde gerçek inclusion kontrol edilir.
7. Mevcut eğitim akışı sesleri erteliyor. Claude entegrasyonunda voice lifecycle,
   Auto'nun sesi kesmemesi, skip/geri tuşu, ses seviyesi, Prologue timeline sinyalleri,
   base/patch sınıflandırması ve cold launch doğrulanır. Yeni AAB bu kabulden sonra alınır.

## Codex tasarım alanı ve main'e teslim

Öncelik ilk AAB'nin kullandığı Fadyme/Mahmut ve açılış ormanı/Prologue katmanlarıdır.
Mevcut kilitli kimlikler, referanslar ve onaylı assetler başlangıç noktasıdır. Yeni
karakter veya hikâye icat edilmez; diğer 18 karakter ve sonraki mekânlar ilk AAB'den sonra sıralanır.

Her teslim `narrative/15_Art_Workbench/<characters|locations>/<existing-id>/<version>/`
altında brief, prompt, candidates/approved ve provenance içerir. Runtime'a girecek
türev için handoff; hedef yol, stable ID, ölçü, alpha, anchor, import ayarı, boyut
bütçesi ve base/patch sınıfını belirtir. Claude entegrasyonu yapar. Kullanıcıyla
görsel kabulden sonra hazırlanan dosyalar main için seçilir; secret/cache dosyaları
teslim değildir. Owner ignore kurallarını kapattığı için commit dosyaları açıkça seçilir.

## Teknik build dışındaki açık işler

| İş | Gerekli somut adım |
|---|---|
| Gerçek Android kabulü | İki ekran boyutu, Large Text/Reduced Motion, ses, touch/Back, kesilen download/resume, disk doluluğu, cold restart, FPS/thermal |
| Google giriş | Kullanılacak debug/upload/Play signing sertifikasını doğru OAuth istemcisine kaydet; cloud test anahtarı yalnız geçicidir |
| Support mail | Doğrulanmış gönderici ve `SUPPORT_MAIL` / `SUPPORT_FROM` bağlarını kur; mevcut devre dışı durumunu gerçek gönderim testiyle kapat |
| Yayın | Hedef debug/internal test/Play release ayrımı, kullanıcıya ait upload key, mağaza/legal/Data safety ve gerekli hesap ayarları |
| Sonraki patch'in spoiler/VO UI'ları | Restore edilen unlock koşullarını ekranlar seçildiğinde gerçekten uygulayan sunum kabulü; metadata restoration tek başına bir yeni ekran uygulaması değildir |
| Diğer canon/art notları | Costume Guide'ın STALE uyarıları, Nixie hair issue, pending antagonist sheets ve Rikka/Hana türev weapon farkları özgün lore ve mevcut onaylarla birlikte ele alınır |

Bu hesap, cihaz ve kreatif kabul işleri tamamlanmadan “ilk AAB tamamen bitti” durumu verilmez.
