# Chirp 3 HD · ortak Japonca ses denemesi v001

Kullanıcı 2026-10-09 tarihinde tüm kadın ve erkek sesler için Google API ile
aynı Japonca kelime/metin üzerinde örnek üretimini ve main'de saklanmasını
açıkça istedi. Bu paket sonraki karakter seçimlerinde de kullanılacak.

**Kelime:** 超電導磁気浮上式鉄道

**Okunuş:** ちょうでんどうじきふじょうしきてつどう

**Anlam:** Süperiletken manyetik levitasyon demiryolu.

**Her sesin aynı okuyacağı metin:**

> ……超電導磁気浮上式鉄道……？　超電導磁気浮上式鉄道！

Tek uzun birleşik ifade iki kez geçer: soru işaretiyle tereddüt/şaşkınlık,
ünlemle heyecan ve kararlılık hedeflenir. Actions üzerinden okunan güncel resmi
belge, synchronous Chirp 3 HD için SSML `break` ve `prosody` desteğini Preview
olarak doğruladı. Aynı istekte 450 ms başlangıç, 700 ms iki okuma arası ve 250 ms
bitiş duraklaması; ilk okuma %90, ikinci okuma %105 prosody hızı istenir.
Gerçek duygu ve durak süreleri dinlenerek değerlendirilecek. Serbest biçimli
`prompt`, pitch veya audioConfig speakingRate parametresi eklenmedi.
Reji notları API'ye okunacak talimat olarak gönderilmez. Bütün seslerde metin,
`ja-JP`, LINEAR16 / mono / 24 kHz ve diğer istek alanları aynıdır; yalnız ses
kimliği değişir. Sağlayıcı WAV masterına sessizlik, efekt veya normalizasyon
eklenmez; orijinal API çıktısı korunur.

## Dosyalar ve gerçek durum

- `audition_plan.json`: aynı metin/ayarlar ve 30 seslik planlanan referans liste.
- `manifest.json`: gerçek çağrı sayıları, üretilen dosyalar, hashler, WAV
  ölçümleri ve varsa güvenli hata kategorileri. Üretim için belirleyici dosyadır.
- `index.html`: yerel dosya olarak açılan kadın/erkek filtreli dinleme galerisi.
  Üretilmemiş örnekler bekleyen kartlar olarak görünür; sahte ses içermez.
- `voices_live_snapshot.json`: yalnız başarılı canlı liste çağrısından sonra
  oluşur. Örnekler, bu yanıtın tüm `ja-JP-Chirp3-HD-*` kadın/erkek sesleri için
  üretilir; referans listenin eksik veya değişmiş olduğu ortaya çıkarsa canlı
  liste esas alınır.
- `female/` ve `male/`: yalnız gerçek başarılı API üretiminden sonra WAV
  masterları oluşur. Planlanan dosya, üretilmiş dosya sayılmaz.

Hazırlık anında gerçek örnek sayısı **0**. Etkin cloud ağ listesi LFS ve Google
TTS bağlantılarını CONNECT 403 ile engelledi. Mevcut ADC SDK tarafından
kullanılabilir bulunmadı; bu oturumda Google API key binding'i yoktu. Ağ ve
güvenli `GOOGLE_CLOUD_API_KEY` gereksinimleri cloud ayar taslağına kaydedildi;
taslak kaydı etkin runtime erişimi veya anahtar değeri oluşturmaz.

## Üretim / devam

Kullanıcı GitHub Actions secret adını **`GEMINI_API`** olarak bildirdi. Bu mevcut
secret GitHub runner içinde `GOOGLE_CLOUD_API_KEY` değişkenine bağlanabilir;
değeri cloud oturumuna veya repoya aktarılmaz. Kullanılan servis yine **Google
Cloud Text-to-Speech / Chirp 3 HD** olur; secret'ın adı model seçimi değildir.
Bu yol için anahtarın ikinci bir kopyasını cloud ayarlarına girmek gerekmez.

İki gerçek Actions kontrolünde `GEMINI_API` runner'a ulaştı; hem API key header
hem standart REST key parametresiyle Cloud TTS ses listesi `401
CREDENTIALS_MISSING` döndürdü. Resmi authentication belgesi ADC/OAuth yolunu
gösteriyor. Workflow, repoda zaten referans verilen
`GOOGLE_PLAY_SERVICE_ACCOUNT` secret'ı varsa, Google OAuth SDK ile bellek içinde
yükleyerek Cloud TTS erişimini denetler. Servis hesabı JSON'u/key'i veya access
token dosyaya/loga yazılmaz. Bu hesabın TTS erişimi başarılı olmadan kayıt seti
üretilmiş sayılmaz. Kimlik yöntemi manifestte açıkça kaydedilir.

`.github/workflows/chirp3-hd-voice-samples.yml`, yardımcı dal push'ında veya
manual dispatch ile aynı üretim aracını çalıştırır. Önce güncel main ile
birleşir; doğrulanmış aynı-istek örneklerini tekrar üretmez. Tam başarılı set,
canlı katalog ve manifest normal push ile main'e kaydedilir. Hata durumunda
üretilen mevcut dosyalar ve güvenli hata kategorileri Actions artifact'ında
korunur; başarısız batch tamamlanmış sayılmaz.

Google hata yanıtından yalnız izin verilen `SERVICE_DISABLED` veya
`API_KEY_SERVICE_BLOCKED` gibi durum kodları saklanır. Ham hata gövdesi, mesaj,
anahtar veya header yazılmaz. Böylece mevcut anahtarın Cloud TTS için uygunluğu
gerçek çağrıyla doğrulanır; farklı TTS modeline geçilmez.

Repo kökünden, güvenli cloud ayarları uygulandıktan sonra:

```sh
/workspace/.cloud-onboarding/audio-tools/bin/python narrative/10_VO/Recording_Notes/Tools/chirp3_hd_audition.py --generate
```

Google Cloud Text-to-Speech API çağıran OAuth hesabının projesinde açık ve
gerekli faturalama/kota/IAM erişimi mevcut olmalı. Doğrudan cloud CLI yolu için
kullanılabilir ADC/OAuth gerekir; yalnız API key verilmesi bu oturumdaki gerçek
testlerde yeterli olmadı. Kimlik bilgileri sohbet, repo, komut argümanı veya
JSON'a yazılmaz. Actions yolu mevcut GitHub secret'larını kullanır.

Araç önce canlı Japonca ses listesini doğrular. Ardından her ses için bir
sentez çağrısı yapar; referans liste değişmezse 30 sentez + 1 liste isteği.
Gerçek faturalandırma Google projesine bağlıdır; ücretsiz olduğu varsayılmaz.
Başarılı, aynı ortak istek hashine sahip ve WAV hashi doğrulanan örnekler
devam çalıştırmasında tekrar üretilmez. İlk API hatasında durur; belirsiz
sonuçlu çağrı otomatik tekrarlanmaz. Böyle bir çağrı incelendikten sonra açık
`--retry-uncertain` seçeneği gerekebilir; tekrar ücret doğurabilir.

Her WAV için RIFF/PCM yapısı, örnek hızı, kanal, frame sayısı, süre, tepe/RMS ve
clipping oranı kaydedilir. Bu teknik kontrol Japonca performans onayı değildir;
dinleme ve ses seçimi birlikte yapılacak. 241 Fadyme repliği, SFX ve müzik bu
audition çağrısının kapsamında üretilmez. Oyuna bağlantı yapılmaz.

Başarılı üretimden sonra WAV'lar, canlı liste, manifest, galeri ve güncellenmiş
ortak katalog main'e normal push ile gönderilir. LFS kancaları ve TLS
doğrulaması kapatılmaz. Örnek paketini LFS sorunu çözülmüş gibi göstermek için
salt pointer veya eski kayıt gönderilmez.
