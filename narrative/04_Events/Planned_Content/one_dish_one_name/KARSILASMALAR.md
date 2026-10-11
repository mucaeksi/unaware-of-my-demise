# Bir Tabak, Bir İsim — karşılaşma tasarımı

Canon sahne kadrosu Jori, Nixie, Pippa, Kera; Inn Meal ve sonrasında kaynakta olduğu gibi Fadyme/Mahmut. 5v5 kadro, 3-5 sonrasında erişilebilen ücretsiz karakterler ve gerekirse uygun story-loan ile tamamlanır. Gacha ownership koşulu yok; beşinci slot için yeni hikâye karakteri icat edilmez.

İlk turda tek 5v5 karşılaşma; iki ön / üç arka düşman slotu. Standart düşman takımını yenmek yeterli. İş/yöntem tercihi hazırlanmış encounter varyantı seçer; yeni global buff, escort AI veya çevre fizik motoru gerektirdiği varsayılmaz.

Düşmanlar kaynak aile referanslarıdır. Her base_unit_id’nin runtime unit/skill profili yayımlanan roster ile doğrulanacak; aşağıdaki roller mevcut AI’ın uyguladığı iddiası değildir. Sayısal HP/ATK/speed ve izinli skill/targeting bağlamaları açık. Aynı aileden iki düşman farklı rol taşıyacaksa gerçek unit/skill varyantları açıkça bağlanmalı.

## od_enc_wood_road — A Steady Passage

Taktik odak: Dengeli ön dayanıklılık ve bir arka tehdit.

Oyuncuya savaş öncesi: “The serving load stays safely inside. Read the visible threats; a steady defensive party can also win.”

| Slot | Sıra | Kaynak düşman | Rol | Davranış brief’i |
|---|---|---|---|---|
| 0 | front | `hollow_pilgrim` | ön tutucu | Standart ön sıra baskısı; sayısal dengesi sonra. |
| 1 | front | `hollow_pilgrim` | ön tutucu | Standart ön sıra baskısı; sayısal dengesi sonra. |
| 2 | rear | `hollow_pilgrim` | arka tehdit | Önceden derlenmiş rear-row targeting varyantı; niyeti gösterilir. |
| 3 | rear | `bellbound_dead` | destek tehdidi | İzinli destek profili; niyeti gösterilir. |
| 4 | rear | `hollow_pilgrim` | ön tutucu | Standart ön sıra baskısı; sayısal dengesi sonra. |

Kazanma seçenekleri: Hedef önceliği veya savunma/recovery; üç plan benzer zorlukta dengelenir. İşler stat buff’ı üretmez.

## od_enc_road_song — The Reaching Line

Taktik odak: İki arka tehdidi destek baskısıyla sıralamak.

Oyuncuya savaş öncesi: “The serving load stays safely inside. Read the visible threats; a steady defensive party can also win.”

| Slot | Sıra | Kaynak düşman | Rol | Davranış brief’i |
|---|---|---|---|---|
| 0 | front | `hollow_pilgrim` | ön tutucu | Standart ön sıra baskısı; sayısal dengesi sonra. |
| 1 | front | `hollow_pilgrim` | ön tutucu | Standart ön sıra baskısı; sayısal dengesi sonra. |
| 2 | rear | `hollow_pilgrim` | arka tehdit | Önceden derlenmiş rear-row targeting varyantı; niyeti gösterilir. |
| 3 | rear | `hollow_pilgrim` | arka tehdit | Önceden derlenmiş rear-row targeting varyantı; niyeti gösterilir. |
| 4 | rear | `bellbound_dead` | destek tehdidi | İzinli destek profili; niyeti gösterilir. |

Kazanma seçenekleri: Hedef önceliği veya savunma/recovery; üç plan benzer zorlukta dengelenir. İşler stat buff’ı üretmez.

## od_enc_song_wood — Hold the Turn

Taktik odak: Ön baskıyı tutarken destek tehdidini azaltmak.

Oyuncuya savaş öncesi: “The serving load stays safely inside. Read the visible threats; a steady defensive party can also win.”

| Slot | Sıra | Kaynak düşman | Rol | Davranış brief’i |
|---|---|---|---|---|
| 0 | front | `bellbound_dead` | destek tehdidi | İzinli destek profili; niyeti gösterilir. |
| 1 | front | `hollow_pilgrim` | ön tutucu | Standart ön sıra baskısı; sayısal dengesi sonra. |
| 2 | rear | `bellbound_dead` | destek tehdidi | İzinli destek profili; niyeti gösterilir. |
| 3 | rear | `hollow_pilgrim` | ön tutucu | Standart ön sıra baskısı; sayısal dengesi sonra. |
| 4 | rear | `hollow_pilgrim` | ön tutucu | Standart ön sıra baskısı; sayısal dengesi sonra. |

Kazanma seçenekleri: Hedef önceliği veya savunma/recovery; üç plan benzer zorlukta dengelenir. İşler stat buff’ı üretmez.

## Denge ve test hedefi

- Bütün varyantlar ilgili hikâye eşiğinin ücretsiz kadrosuyla kazanılabilir; ownership/ödeme şartı yok.
- Hedef önceliğini okuyan oyuncu daha rahat ilerler; sakin savunma/recovery de geçerli kalır.
- Düşman niyeti savaş öncesi ve sırası değişince anlaşılır biçimde görünür.
- Kaybetmek hikâyenin insanî sonucunu değiştirmez. Yeniden deneme aynı kayıtlı planı kullanır.
- Ustalık/tur sınırı/üç yıldız zorunluluğu veya ona bağlı ödül seçilmedi.
- Yerel doğrulama yalnız slot düzeni, seçilen varyant ve graph referanslarıdır; gerçek savaş simülasyonu yapılmadı.

Yapılandırılmış kaynak: [encounters.json](authoring/encounters.json).
