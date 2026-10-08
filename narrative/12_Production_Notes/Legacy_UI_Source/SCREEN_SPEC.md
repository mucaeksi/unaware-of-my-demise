# UOMD — Ekran davranışları v1

Durum: DESIGN_DRAFT. Ana menü görsel adayı ve toplam 14 ekran/alt ekranın etkileşimli yerleşimi hazır. Aşağıdaki üretim şartları, Godot'a uygulandığı anlamına gelmez. Mekanik/ekonomi JSON'ları bu çalışma sırasında değiştirilmez.

## 01 — Açılış / oturum
Mevcut TitleScreen → SignInScreen Google session → PatchScreen içerik kontrolü/indirme/doğrulama → snapshot → yeni oyuncuda açılış/tutorial, geri dönende Sığınak veya açık girişim recovery. App sürümü/bakım preflight erken bloklayabilir. Sağ üst Settings/Help/Sign Out araçları patch öncesi ve sırasında çalışır; çıkış onay gerektirir. Yerel Settings ve Help için playable içerik/snapshot gerekmez. Arayüz/altyazı İngilizce, ses Japonca. Mevcut Online session bellektedir. Ayrıntılı v03 durum tasarımı ve ayrı sayfalar: [ENTRY_SCREEN.md](ENTRY_SCREEN.md), [screens/](screens/README.md).

Loading sırasında ikinci giriş engellenir. Kullanıcı iptali yumuşak durumdur; ağ hatası açık yeniden deneme sunar. Hesap bilgisi doğrulanmadan örnek/cached bakiye gerçek bakiye gibi sunulmaz. Prototip giriş yapmaz.

## 02 — Sığınak
Üst profil ve görev/ayar kısayolları → dört kaynak chip'i → avlu → devam kartı → beş alt bölüm. Avludaki sunağın, hanın ve tezgâhın işlevi ikon + metinle anlaşılır. Büyük devam kartı güncel chapter/node'u açar. Ortam adı/görseli bir UI önerisidir; canon lokasyon tanımı değildir.

Claim edilebilir han yemeği sıcak ışık etiketi taşır; alındığında sakin “Bugün alındı”. Bildirim noktası görev ready durumundan gelir. Günlük başlangıç popup zinciri, otomatik mağaza açılışı ve yeni AFK ödül sandığı eklenmez.

## 03 — Kaynak detayı / Han
Kaynak adı, bakiye, kullanım, kazanım kuralları ve gerekirse ilgili ekrana geçiş. Ration: doğal yenilenme tavanı 100; 300 saniyede 1; savaş yalnız doğrulanmış zaferde maliyet düşürür. Han: UTC gününde bir kez +30; 100 üstü hibeyi kabul eder.

Claim sırasında pending → confirmed / error. Çift tıklama ikinci hibe üretmez. Tavan üstündeyken sayaç 108/100 gibi gerçeği gösterir; otomatik kırpılmaz. Prototip 78 → 108 geçişini yalnız bellekte gösterir.

## 04 — Yolculuk / stage detayı
Mevcut chapter'ın artwork alanı, doğrusal beş durak ve diğer altı chapter. Clear/current/locked şekil, ikon ve metinle ayrılır. Kilitli ilerideki içeriklerin spoiler başlıkları üretimde ayrıca değerlendirilir.

Stage sheet: adı, önerilen seviye, Ration, düşman ailesi, ilk tamamlama/drop özeti, takım hazırlama. Ödül sayıları gerçek drop tablolarından gelir. 1-1 istisnası ücretsiz, Mahmut/Fadyme ile iki kişilik tutorial; standart beş kişilik akışa zorlanmaz. 1-2 guest ile owned karakter ayrımı görünür.

## 05 — İlk Yemin
Kalıcı 4★ seçenekler; portre, element, rol, dört yetenek ve edinme etiketi. Seçim öncesi detay, sonra “Tek kalıcı seçim” onayı. Davet kullanıldıysa aynı ekran yeniden seçim sunmaz. Gerçek havuz ve eligibility selector/backend kaydından; tüm 4★'ları koşulsuz uygun saymak üretim kararı değildir.

## 06 — Formasyon
Üst: stage, önerilen seviye, Ration. Orta: iki ön slot, üç arka slot. Alt: kullanılabilir roster, guest rozeti, hedef ve Ultimate politikası, savaşa geçiş.

Dokun seç/değiştir temel etkileşim; sürükleme opsiyonel. Aynı karakter iki slota yerleşmez. Affinity öneridir; runtime kuralı doğrulanmadan zorunlu row yasağı konmaz. Prototipte beş örnek yoldaş arasında slot değişimi çalışır; yeni politika seçenekleri nihai enum'larla eşlenecek.

## 07 — Savaş
Alt navigasyon gizli. Stage, tur/sıra, hız ve otomatik kontrol üstte; düşmanlar üst, oyuncu ön/arka sıraları alt. HP, Focus, status ve telegraph ikonlarının açıklaması erişilebilir. Hedef/politika kontrolleri otomatik sıra sistemiyle uyumlu olur.

Boss telegraph görünür uyarı alanında; yalnız renk kullanmaz. Combat log açılabilir, tüm olaylar ana canvas'ı kaplamaz. Skip yetkisi ve hız gerçek playback kuralına göre. Prototip sahne kompozisyonu gösterir; motor, animasyon veya gerçek savaş çalıştırmaz.

## 08 — Sonuç
Zafer: sonucu doğrulama → stage clear → ayrı ilk tamamlama/drop/XP kartları → savaş sonrası VN / sonraki durak. Pending iken ödül “hesaba yazıldı” denmez.

Yenilgi: Ration harcanmadı bilgisi → formasyonu düzenle / geri çekil. Tekrar savaş yeni doğrulanmış istektir. Sunucu sonucu bilinmiyorsa kazandı/kaybetti yerine “Sonuç doğrulanıyor / tekrar bağlan” durumu.

## 09 — Yoldaş koleksiyonu
Arama, sahiplik, element/rol filtreleri; üç kolon portre kartı. Kartta seviye, element ve rarity; güç skoru mevcut modelde yoksa uydurulmaz. Sahip olunmayan karakterlerde kilit ve edinme yolu.

Detay: portre, ad, rol/element, statlar, ekipman, skill ve memory. Kompakt mevcut HP/ATK ölçeği korunur. Prototip Lv 1 değerlerini doğrudan kaynaktan kullanır. Onaylı portresi olmayan kartlar element işaretiyle gösterilir; karakter tasarımı yeniden yorumlanmaz.

## 10 — Ekipman / gelişim
Slotlar: silah, zırh, kolye, yüzük. Envanterde kategori, filtre, kilit/favori ve detay. Öğede stat, rarity, seviye, passive/set, uygun slot ve edinme yolu ayrı alanlar.

Takma: eski/yeni karşılaştırma ve yoldaş seçimi. Geliştirme: kaynak maliyeti + stat öncesi/sonrası + onay. Parçalama: exact output + kalıcı kayıp onayı; signature parçalama yasakları veriyle uygulanır. 4★/5★ takı reroll yalnız substat değiştirir; main stat/set/rarity korunur. Prototip bu işlemleri yapmaz.

## 11 — Çağrı
Banner türü, artwork, hedef, süre yalnız gerçek takvim varsa, bakiye, tek/10 maliyet, pity, guarantee, oran/geçmiş. Kalıcı karakter havuzu Mahmut/Fadyme: %2 taban 5★, hard pity 80, soft pity yok. Sınırlı karakter: %2,5 taban 5★, hard 80, soft 65. Sınırlı silah: %2,5, hard 65, hedef/Fate Knot bilgisi.

Onaydan sonra pending sırasında ikinci pull engellenir. Sonuçta her öğe, yeni/duplicate ve server dönüşümü ayrı gösterilir. Prototip Atalar bölümünde sabit bir sonuç kompozisyonu gösterir; oran simülasyonu değildir. Weapon target seçimi henüz yalnız blueprint.

## 12 — Görevler
Günlük/haftalık gruplar; görev ilerlemesi, exact reward, reset zamanı, ready/claimed/locked. Claim sonrası confirmed olmadan kaynak animasyonu oynatılmaz. Tüm görevler için tek otomatik kırmızı nokta yok. Prototip görev satırları görsel örnektir; yeni ödül/hedef tanımı olarak kullanılmaz.

## 13 — Kayıtlar
Anılar / Codex / Etkinlikler. Companion kilitleri sahiplik + after_stage + sıra koşullarından gelir; Mahmut/Fadyme sahiplik istisnası korunur. Kilitli başlık ve içerik spoiler verebiliyorsa “Mühürlü kayıt”.

Codex unlock kaynak/runtime farkı kapatılmadan runtime `always` değerleriyle her şeyi açma. Prototip yalnız ilk iki world kaydını gösterir; diğerlerini spoiler koruması için mühürler. Bu görünüm nihai canon unlock kararı değildir. Event erişimi story gate + takvim; mevcut dört narrative event, yeni sosyal guild sistemi varsaymaz.

## 14 — VN
Alt navigasyon gizli. Mekân background, doğru karakter bust, konuşmacı, okunabilir subtitle; Auto/Log/Skip için alan. Doğrusal anlatıdaki sahte seçim butonları eklenmez. Satır ID → JP voice → music cue eşleşir; missing VO metin akışını durdurmaz.

Skip geri alınamayan ödül veya story state yazımını bağımsız tetiklemez. Log yalnız görülmüş satırları açar. Prototip açılıştan dört mevcut İngilizce satırı önceki/sonraki/log ile gösterir. Artwork temsili; doğru açılış lokasyon/bust varlıkları sonraki entegrasyonda bağlanır.

## 15 — Profil / ayarlar
Hesap/bağlantı, BGM/SFX/VO ayrı, metin boyutu, reduced motion, dil, gizlilik ve oturum. Oturumdan çıkış önce sonuçları açık onay; gerçek sunucu bulunurken “no server” metni kullanılmaz. Büyük metin satırları yeniden akar. Prototip reduced motion ve büyük metin CSS'ini değiştirir; gerçek ses/oturum işlemez.

## Ortak durum matrisi
| Durum | Görünüm | Eylem |
|---|---|---|
| Loading | Kısa durum + stable layout | İkinci gönderim kapalı |
| Empty | Neden ve uygun yol | Koleksiyon/arama/çağrı önerisi |
| Locked | Kilit + spoiler güvenli koşul | İçerik gösterilmez |
| Ready | Ölçülü amber vurgu | Claim / continue |
| Pending mutation | Maliyet görünür, bekliyor | Çift işlem engeli |
| Network error | Sonuç biliniyor/bilinmiyor ayrımı | Retry / sync |
| Insufficient resource | Gerekli/mevcut miktar | Geri / edinme bilgisi |
| Confirmed | State + ledger aynı sonuç | Sonraki geçiş |

Godot Android Back: modal → önceki alt ekran → ana bölüm → çıkış onayı; savaş/VN'de ilerleme kaydıyla uyumlu. Safe-area üst ve altta; tüm dokunma hedefleri en az 44 CSS px karşılığı. Screenshot doğrulaması gerçek cihazdaki metin ve dokunma testini kapsamaz.
