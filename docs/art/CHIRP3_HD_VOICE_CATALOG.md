# Google Chirp 3 HD · ortak ses kataloğu

2026-10-09 · Fadyme ve sonraki karakterlerin ses seçimi için saklanan standart **30 seslik referans liste**: **14 kadın, 16 erkek**. Henüz bir karaktere ses atanmadı. Kullanıcı tüm kadın/erkek sesler için aynı Japonca metinle Google API örneklerini açıkça istedi; üretim erişim/kimlik nedeniyle bekliyor. Gerçek sentez çağrısı ve yeni ses dosyası sayısı şu anda 0.

**Doğrulama durumu:** Bu cloud oturumunun doğrudan Google bağlantısı 403 ile engellendi; resmi authentication/Chirp 3 HD belgeleri daha sonra GitHub Actions üzerinden okundu ve örnek paketinin `provider_reference.json` dosyasına kaydedildi. Mevcut `GEMINI_API` secret’ı bulundu; Cloud TTS iki API-key biçimini 401 ile reddetti. Mevcut Google servis hesabı OAuth erişimi çalıştı, ancak `604013824221` projesinde Cloud TTS kapalı (`SERVICE_DISABLED`); açma isteği 403 aldı. Aşağıdaki katalog canlı API’den alınmadı; güncel Japonca ses kapsamı hâlâ doğrulanmalı. API etkinleştirildiğinde araç canlı listeyi esas alarak tüm kadın/erkek örneklerini üretecek. Kimlik bilgileri dosyalara taşınmadı.

## Kadın · 14

| İsim | Japonca voice ID adayı |
|---|---|
| Achernar | `ja-JP-Chirp3-HD-Achernar` |
| Aoede | `ja-JP-Chirp3-HD-Aoede` |
| Autonoe | `ja-JP-Chirp3-HD-Autonoe` |
| Callirrhoe | `ja-JP-Chirp3-HD-Callirrhoe` |
| Despina | `ja-JP-Chirp3-HD-Despina` |
| Erinome | `ja-JP-Chirp3-HD-Erinome` |
| Gacrux | `ja-JP-Chirp3-HD-Gacrux` |
| Kore | `ja-JP-Chirp3-HD-Kore` |
| Laomedeia | `ja-JP-Chirp3-HD-Laomedeia` |
| Leda | `ja-JP-Chirp3-HD-Leda` |
| Pulcherrima | `ja-JP-Chirp3-HD-Pulcherrima` |
| Sulafat | `ja-JP-Chirp3-HD-Sulafat` |
| Vindemiatrix | `ja-JP-Chirp3-HD-Vindemiatrix` |
| Zephyr | `ja-JP-Chirp3-HD-Zephyr` |

## Erkek · 16

| İsim | Japonca voice ID adayı |
|---|---|
| Achird | `ja-JP-Chirp3-HD-Achird` |
| Algenib | `ja-JP-Chirp3-HD-Algenib` |
| Algieba | `ja-JP-Chirp3-HD-Algieba` |
| Alnilam | `ja-JP-Chirp3-HD-Alnilam` |
| Charon | `ja-JP-Chirp3-HD-Charon` |
| Enceladus | `ja-JP-Chirp3-HD-Enceladus` |
| Fenrir | `ja-JP-Chirp3-HD-Fenrir` |
| Iapetus | `ja-JP-Chirp3-HD-Iapetus` |
| Orus | `ja-JP-Chirp3-HD-Orus` |
| Puck | `ja-JP-Chirp3-HD-Puck` |
| Rasalgethi | `ja-JP-Chirp3-HD-Rasalgethi` |
| Sadachbia | `ja-JP-Chirp3-HD-Sadachbia` |
| Sadaltager | `ja-JP-Chirp3-HD-Sadaltager` |
| Schedar | `ja-JP-Chirp3-HD-Schedar` |
| Umbriel | `ja-JP-Chirp3-HD-Umbriel` |
| Zubenelgenubi | `ja-JP-Chirp3-HD-Zubenelgenubi` |

Makineyle okunabilir karşılık: [chirp3_hd_voice_catalog.json](../../narrative/10_VO/Line_Maps/chirp3_hd_voice_catalog.json). Liste tüm karakterler için ortak referanstır; ses isimlerinden yaş, karakter, duygu veya performans niteliği çıkarılmaz. Aynı isimleri kullanan Gemini TTS kayıtları Chirp 3 HD kullanılabilirliğinin kanıtı sayılmaz. Eski Fadyme Sulafat kayıtları arşivde kalır; bu katalog o take'leri yeniden etkinleştirmez.

Güncel [ortak örnek paketi](../../narrative/10_VO/Voice_Samples/Chirp3_HD/ja-JP/audition_v001/README.md), tüm seslerde aynı uzun Japonca kelimeyi soru/ünlem ve duraksama işaretleriyle kullanır. Örnek çağrıları kullanıcı tarafından yetkilendirildi; aynı izin yeniden sorulmaz. Önce canlı katalog ve erişim çalışmalı. Dinlemeden ses seçimi veya ayrı 241 satırlık üretim başlatılmaz. Gerçek üretim durumu örnek paketinin `manifest.json` dosyasındadır.

Resmi kontrol kaynakları (authentication/Chirp belgeleri Actions üzerinden okundu; canlı ses kataloğu API aktivasyonunu bekliyor):

- https://cloud.google.com/text-to-speech/docs/chirp3-hd
- https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types
- https://cloud.google.com/text-to-speech/docs/reference/rest/v1/voices/list

Bu dosya doğrulanmış canlı snapshot yerine mevcut referans listeyi saklar; test aşamasında API yanıtı, tarih ve dil filtresiyle birlikte yenilenecek.
