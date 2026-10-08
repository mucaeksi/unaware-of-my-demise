# UOMD UI — Ortak Tasarım Sistemi v1
Durum: DESIGN_DRAFT · 2026-10-05 · İlk girişten itibaren oyuncu arayüzü ve altyazılar İngilizce, seslendirme Japonca. [LANGUAGE_POLICY.md](LANGUAGE_POLICY.md) geçerlidir; runtime metni ve ses kaynakları korunur.

## Tasarım yönü
AFK Arena referansının kullanıldığı noktalar: dikey mobil kompozisyon, mekânlara bağlı ana merkez kısayolları, kalıcı beş bölüm navigasyonu, portreli yoldaş koleksiyonu, ön/arka sıralı beş kişilik takım ve okunabilir otomatik savaş sunumu. UOMD kimliği: sisli taş, yıpranmış kumaş, soluk kemik, oksitlenmiş pirinç, düşük ışık ve az sayıda sıcak fener. Narrative illüstrasyonları ressamsı; gameplay ikonları/chibi'ler kaynakta tanımlı ink stilinde.

Ana hub ortamı önerisi: terk edilmemiş ama yorgun bir yolcu sığınağının avlusu. UI taslak ortamıdır; canon'a yeni şehir/mekân eklemez. Kullanıcı tercihi geldiğinde revize edilebilir.

## Tokenlar
| Rol | Değer | Kullanım |
|---|---|---|
| ink | #101318 | Ana zemin |
| panel | #1c2027 | İçerik panelleri |
| bone | #eee4d1 | Ana metin |
| muted | #b2aca1 | Yardımcı metin |
| brass | #c4a56c | Seçim, navigasyon, ana eylem |
| plum | #65516a | Veil/kişisel vurgu |
| ember | #bd7853 | Ember/han ışığı |
| danger | #d98986 | Hata/tehlike; yalnız renkle anlatılmaz |
| tide | #78adb0 | Tide/durum |
| border | rgba(196,165,108,.28) | İnce malzeme kenarı |

- Doku, artwork alanında kalır; metin panelleri sakin. Ağır filigree ve metin üstüne sis yok.
- Başlıklar Georgia/serif; gövde sistem sans-serif. İngilizce metin ve büyük metin yerleşimleri kontrol edilir. Godot üretim fontları ayrı lisans/boyut kararıyla seçilir.
- Prototip: 390×844 CSS referansı; oyunun hedefi 1080×1920 portrait. Telefon safe-area hesaba katılır; uzun ekranda arka plan genişler.
- Gövde 13–16 px, ana başlık 26–32 px, dokunma hedefi en az 44 px. Kaynak canvas'a çevrilirken Godot safe-area ve okunabilirliği korunur.

## Navigasyon
Sanctuary / Journey / Companions / Summon / Records. Envanter sığınakta teçhizat kısayolundan ve yoldaş ekipmanından erişilir. Ayarlar profil üstünden açılır. Görevler hub kısayolu ve Kayıtlar sekmesinde. VN ve savaş odağında alt navigasyon gizlenir; geri çıkış oyun ilerlemesini değiştirmez. Giriş/patch alanında sağ üst Settings kısayolu ve account menu vardır; alt hub navigasyonu kullanılmaz.

## Ortak bileşenler
Profil mührü, kaynak chip'i, başlık/geri satırı, bölüm kartı, yoldaş kartı, öğe satırı, formasyon slotu, görev kartı, tab bar, rarity frame, durum rozeti, banner, alt sheet ve onay dialog'u.

Her eylem: idle / focus / pressed / disabled / loading / success / error. Boş/henüz-açılmadı durumları ayrı açıklanır. Bildirim noktası yalnız somut alınabilir ödül veya tamamlanabilir iş için; tüm ekranlara sürekli kırmızı nokta yok.

## Korunan oyun davranışları
- Beş kişilik takım: 2 Front + 3 Rear. Story guest ile owned hero açık ayrılır.
- Ration 100 cap, 300 sn/unit; yalnız doğrulanmış zaferde stage maliyeti. Inn Meal +30, grant cap'i aşabilir. UI sayacı server zamanı/snapshot kaynaklı olacak.
- Pull öncesi maliyet, oran, pity ve guarantee görünür; mevcut ekonomi değiştirilmez.
- Spoiler kapıları ve görev açılış koşulları içerik/veri kaynaklı; tasarım yeni eşik icat etmez.
- Otomatik savaşta hız/skip ve boss telegraph okunur. Aynı ekranda yeni gerçek-zamanlı/manual savaş mekaniği varsayılmaz.
- Henüz kararlaştırılmamış AFK loot, guild/PvP, shop ve yeni ekonomi ekranları aktif ana menüye eklenmez.

## Hareket ve ses
Geçiş 160–220 ms, küçük amber ışık vurguları, az miktar derinlik; parallax şart değildir. Reduced motion bütün kozmetik hareketi kapatır. VN auto sonradan voice süresi/okuma hızıyla bağlanır. Main theme owner kontrolündedir; bu taslak ses üretmez.

## Prototip sınırları
Örnek cüzdan/ilerleme/seviye verileri, sadece tarayıcı oturumundaki etkileşimler. Source_data karakter/chapter/skill ID'leri mevcut runtime'dan alınmıştır. Diğer karakterlerin yeni portreleri üretilmez; görsel kartlarda kimlik işaretleri kullanılabilir. Hero/koleksiyon ve diğer sekmeler ana ekran kadar nihai detay seviyesinde değildir. Gerçek backend işlemi veya Godot değişikliği yok.

## Kabul kontrolü
390×844 ve 360×800 telefon; 320 px yatay taşma; İngilizce metin ve EN/JA dil kuralı; klavye erişimi/focus; dialog focus/geri; azaltılmış hareket; 20 karakter/7 bölüm; görsel yükleme ve tüm buton rotaları. Yeni sayfaların ID/ad/dosya/Godot hedefi [SCREEN_REGISTRY.json](SCREEN_REGISTRY.json) içinde kaydedilir. Prototype doğrulaması, gerçek cihaz/Godot kabulünün yerine geçmez.
