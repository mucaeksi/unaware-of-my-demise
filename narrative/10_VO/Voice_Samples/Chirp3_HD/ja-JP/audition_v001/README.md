# Chirp 3 HD · ortak Japonca ses denemesi v001

**Gerçek üretim tamamlandı: 30 ses, 14 kadın ve 16 erkek.**
[Başarılı Actions kaydı](https://github.com/mucaeksi/unaware-of-my-demise/actions/runs/37915312151) ·
[Ortak canlı katalog](../../../../../../docs/art/CHIRP3_HD_VOICE_CATALOG.md).
Kadın/erkek kapsamı Google Cloud `voices.list` yanıtında `ja-JP-Chirp3-HD-*`
olarak doğrulandı. Örnekler ilerideki karakter seçimleri için ortak pakettir.
Henüz Fadyme veya başka karakter için bir ses seçilmedi.

## Dinleme

GitHub Desktop ile güncel main'i aldıktan sonra bu klasördeki **`index.html`**
dosyasını tarayıcıda aç. **Female**, **Male** ve **All** filtreleri bulunur.
Galeri yerel dosyalardan çalışır; bir sunucu, API anahtarı veya yeniden üretim
isteği gerektirmez. WAV'lar `female/` ve `male/` klasörlerindedir.

## Aynı Japonca metin ve ayarlar

**Kelime:** 超電導磁気浮上式鉄道

**Okunuş:** ちょうでんどうじきふじょうしきてつどう

**Anlam:** Süperiletken manyetik levitasyon demiryolu.

> ……超電導磁気浮上式鉄道……？　超電導磁気浮上式鉄道！

Her ses aynı SSML isteğini okudu: 450 ms başlangıç, 700 ms iki okuma arası ve
250 ms bitiş duraklaması; ilk okuma %90, ikinci okuma %105 prosody hızı.
Tereddüt/şaşkınlık ve heyecan/kararlılık hedeflendi; gerçek duygu ve duraklamalar
owner dinleme aşamasında değerlendirilecek. Yalnız voice ID değişti. Teknik
ayarlar LINEAR16, mono, 16-bit PCM, 24 kHz. Orijinal sağlayıcı WAV masterlarına
normalizasyon, sessizlik veya efekt eklenmedi.

Dosyalar yaklaşık **6,49–8,20 saniye**, toplam **216,37 saniye** ve
**10.387.312 bayt**. Sayısal clipping ölçümü tüm kayıtlarda 0.

## Kanıt ve yapılandırma

- `audition_plan.json`: ortak metin, SSML, ayarlar ve açık kullanıcı yetkilendirmesi.
- `voices_live_snapshot.json`: gerçek başarılı Japonca ses listesi yanıtı.
- `manifest.json`: 30 gerçek WAV, istek/dosya hashleri, süre/RMS/tepe ölçümleri.
- `audio_validation.json`: tüm masterların bağımsız teknik ve katalog doğrulaması.
- `gallery_validation.json`: yerel Chromium galeri, filtre, decode ve playback kontrolü.
- `workflow_run_status.json`: gerçek başarılı Actions run/commit/üretim sayısı.
- `provider_reference.json`: resmi sağlayıcı belgelerinin güvenli alıntıları.
- `authoring_validation.json`: üretim öncesindeki MOCK transport testidir;
  gerçek kayıt üretiminin kanıtı değildir.

Bu batch **30 sentez çağrısı** yaptı. Manifestteki eski kimlik/erişim hataları
geçmiş denemelerdir; güncel durum başarılıdır. Kümülatif CLI sayacı 10 ses listesi
isteği ve 30 sentez isteğidir; servis setup/OAuth/LFS/belge okumalarını içermez.
Doğru quota projesi `gen-lang-client-0955955681`; mevcut GitHub servis hesabıyla
OAuth erişimi çalıştı. [Proje erişim kaydı](../../../../../../docs/coder/cloud_delivery/GOOGLE_TTS_PROJECT_ACCESS.md)
çözülmüş IAM adımını ve kullanılan public principal'ı içerir. API key değerleri,
private credential JSON ve OAuth tokenlar dosyalara taşınmadı.

## Sonraki üretim

Aynı metin/hash ile doğrulanmış WAV'ları tekrar üretme. Araç devam çalıştırmasında
bunları yeniden kullanır; yalnız eksik canlı sesler üretilir. Belirsiz sentez
çağrıları otomatik tekrarlanmaz. Google kimlik bilgileri yalnız ses/müzik için
kullanılır; görseller ayrı araçla üretilir.

Dinleme, Japonca performans değerlendirmesi ve Fadyme ses seçimi kullanıcıyla
birlikte yapılacak. **241 satırlık final Fadyme kayıt batch'i, SFX ve müzik bu
ortak örnek batch'ine dahil değildir ve üretilmedi.** Oyuna bağlantı yapılmadı;
entegrasyon Claude'un görevidir. Eski Sulafat VO arşivde kalır.
