# Google Chirp 3 HD · ortak ses kataloğu

2026-10-09 · Fadyme ve sonraki karakterlerin ses seçimi için saklanan standart **30 seslik referans liste**: **14 kadın, 16 erkek**. Henüz bir karaktere ses atanmadı; ses denemesi veya ücretli API çağrısı yapılmadı.

**Doğrulama durumu:** Bu oturumda Google'ın resmi dokümanlarına erişim `CONNECT 403 Forbidden` ile engellendi. Aşağıdaki referans katalog canlı API'den alınmadı; güncel listenin tamamlığı ve her sesin `ja-JP` kullanılabilirliği henüz doğrulanmadı. Japonca kimlikler adlandırma şablonundan oluşturulmuş adaylardır. Denemelerden önce yetkili Google Cloud `voices.list` çıktısıyla ad, dil ve `ssmlGender` doğrulanmalı; eksik veya değişmiş seçenekler katalogda güncellenmeli.

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

Sonraki adım, kullanıcının isteğiyle daha sonra yapılacak küçük karşılaştırmalı ses denemeleridir. Önce canlı katalog/erişim ve kısa Japonca test metni doğrulanır; dinlemeden ses seçimi veya 241 satırlık üretim başlatılmaz.

Resmi kontrol kaynakları (bu oturumda okunamadı):

- https://cloud.google.com/text-to-speech/docs/chirp3-hd
- https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types
- https://cloud.google.com/text-to-speech/docs/reference/rest/v1/voices/list

Bu dosya doğrulanmış canlı snapshot yerine mevcut referans listeyi saklar; test aşamasında API yanıtı, tarih ve dil filtresiyle birlikte yenilenecek.
