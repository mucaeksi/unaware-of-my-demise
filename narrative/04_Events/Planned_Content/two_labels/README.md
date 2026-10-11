# İki Etiket / Two Labels — tam içerik tasarımı v1

**11 Ekim 2026 · Sonraki içerik yamaları için · 4-5 tamamlanınca açılır · Ödüller belirlenmedi.**

Bu paket İki Etiket’in bütün aktlarını, iki rota dalını, diyalog seçimlerini, kapanışlarını ve sahne scriptlerini içerir. Oyuncu metni İngilizce; yapım/yönetim açıklamaları Türkçe. İleriki patch için narrative kaynağıdır; aktif runtime bağlantısı henüz yapılmadı.

Mevcut **Guild Dispatch: Salt-Road Fever** event’inin üç canon sahnesi ve 11 repliği aynen korundu. Eklenen metin, bu sahnelerin önüne/arasına/sonrasına yazılmış 28 yeni sahneden oluşuyor. Yeni metinler yaratıcı genişletmedir; mevcut canon dosyaları bunlarla değiştirilmiş değildir.

## Paket içeriği

| Teslim | İçerik |
|---|---|
| 5 akt / bölüm | Başlangıç, iki yol, klinik, iki etiket ve dönüş |
| 31 sahne | 28 yeni sahne + 3 birebir canon sahnesi; bütün rota/tercih varyantları dahil |
| 316 replik/anlatım satırı | 305 yeni + 11 canon; tekil line ID, konuşmacı, emotion ve voice track |
| 2 yol | Kıyı patikası / eski yük yolu; aynı ana sonuca birleşir |
| 4 karar | Hazırlık × rota × yaklaşım × son konuşma; 32 kombinasyon |
| 8 karşılaşma tasarımı | Bir oynanışta 5 savaş; iki rota ve hazırlık varyantları |
| 31 story JSON | Projenin mevcut StoryScene şemasına uygun sahne komutları |
| Authoring JSON | Event akışı, state sözleşmesi, karşılaşmalar, medya ihtiyaçları ve kaynak snapshot’ı |
| VO tablosu | Tüm 316 satırın İngilizce kaynak metni; Japonca çeviri/kayıt henüz yok |

Ödül miktarı, türü, enerji maliyeti, yayın tarihi ve sona erme tarihi bu paketle belirlenmedi. Önceki atölye taslağındaki ödül yüzdeleri ve 14 günlük sunum önerisi bu sürümün kararı değildir. Görev ödül alanları `null`; “ödül yok” anlamına gelmez, sonradan bağlanacak demektir.

## Hikâye

Matron karşılaşmasından sonra Kera, arşiv kanadının ilk ücretsiz tedavi sevkiyatını hazırlıyor. Tilda işin hasta bakımını, Iona insanların soru sormasını ve güvenli beklemesini, Odelia ise kıyı yolunu üstleniyor.

İlacı üretmek sorunun yalnızca bir kısmı. İnsanlar aynı loncanın başka bir kolunun sattığı şişelere alışık; ücretsiz gelen bir teklifin görünmeyen bir borcu olup olmadığını bilmek istiyorlar. Oyuncu ekibin nasıl gideceğini ve kendisini nasıl anlatacağını seçiyor. Sonunda karşılarına çıkan satıcı bir boss değil: Kera’nın etiketi, tedavinin ne olduğunu ve kimin yaptığını açıkça söylüyor. Zafer, insanların bu bilgiyi görerek seçebilmesi.

Kuru mizah ekip işinin içinde kalır; hastaların korkusu şaka hedefi olmaz. Odelia’nın eve benzeyen bir yere dönmesi ve Tilda–Iona’nın bakım anlayışı yan hikâyeyi taşır. Fadyme’nin tedavisi, Odelia’nın kardeşinin akıbeti veya Part II’nin büyük gizemleri bu event’te çözülmez.

## Okuma sırası

1. [Bölümler, sahne akışı ve karar sonuçları](BOLUM_AKISI.md).
2. [Akt 1 — Arşivin Kapısı](scripts/AKT_01.md).
3. [Akt 2 — İki Yol](scripts/AKT_02.md): kıyı ve yük yolu ayrı; oyuncu ilk turda birini görür.
4. [Akt 3 — Temiz Masa](scripts/AKT_03.md).
5. [Akt 4 — İki Etiket](scripts/AKT_04.md): show/listen callback’lerinden biri oynar.
6. [Akt 5 — Boş Kasalar](scripts/AKT_05.md): rota callback’i ve dört son konuşma seçeneği.
7. [Karşılaşma tasarımı](KARSILASMALAR.md), [görsel/ses yapım planı](MEDYA_VE_YONETIM.md), [gelecekteki patch devri](PATCH_DEVRI.md).

Tek dosyada okumak için [bütün aktların birleşik scripti](TAM_SCRIPT.md). Tekil sahneler için [sahne indeksi](SAHNE_INDEKSI.md); yapılandırılmış tam metin için [authoring/event.json](authoring/event.json). Her scriptte sahne yönergesi, konuşmacı, emotion, line ID, seçim dalı ve checkpoint var. Bir diyalog dalı seçildiğinde diğer dalın replikleri oynatılmaz.

## Oyun süresi

Bir tam rota **224–225 satır, yaklaşık 2.194–2.284 İngilizce kelime ve 5 savaş** içeriyor. Önceki 80–100 dakika varsayımını bu metin miktarıyla doğrulanmış hedef gibi sürdürmüyorum. Bu sürüm için tahmin: okuma yaklaşık 12–18 dk, savaşlar yaklaşık 15–25 dk, karar/ekran geçişleri yaklaşık 3–7 dk; **yaklaşık 30–50 dakika aktif ilk oynanış**. Gerçek sesli sunum veya daha yavaş okuma bunu uzatabilir; cihazda ölçülmedi.

Diğer yolun özgün dört sahnesi ve iki karşılaşması ayrıca yaklaşık 10–20 dk hedefliyor. İkinci turda ortak aktları zorunlu tekrar ettirmiyoruz. Kapanış konuşmalarının hepsi ayrı sahne replay’inden görülebilir; seçimler tek bir “doğru son” oluşturmaz. Bekleme ve günlük farm süreye dahil edilmedi.

## Kontrol sonucu ve sınır

[VALIDATION.json](VALIDATION.json) şu yerel doğrulamaları içerir: 31 story export’u mevcut şemadan geçti; 316 satır export ile eşleşti; tüm 39 akış düğümü erişilebilir; 32 karar kombinasyonu mevcut StoryRunner ile sona ulaştı; hepsinde üç canon sahnesi doğru sırada ve beş savaş düğümü var. Sahne sonlarında StoryRunner checkpoint save/restore denendi. Kaynak hash’i ve canon sahneler eşleşti.

Bu, tam oyun entegrasyon testi değildir. Gerçek savaş dengesi, event API, sahne asset’lerinin oynatılması, mobil cihaz, ses ve yayınlanmış patch bu pakette test edilmedi. **Story JSON’lar şema bakımından uyumlu; event graph ve encounter authoring dosyaları gelecekteki uygulama adaptörüne ihtiyaç duyuyor.**

Üretim kaynakları: [VO listesi](VO_LINE_LIST.csv), [canon snapshot](authoring/canon_source_snapshot.json), [ayar ve üretim sözleşmesi](AYARLAMA_VE_URETIM.md). Export/doğrulama araçları bu narrative tesliminin dışında tutuldu.
