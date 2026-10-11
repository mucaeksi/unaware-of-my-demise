# Son Geçen İçin — karşılaşma tasarımı

Fiziksel sahne ekibi Brin, Nixie, Fadyme, Mahmut. 1-4 sonrasında ücretsiz First Oath seçimi beşinci 5v5 slotunu sağlayabilir; seçim havuzu yayımlanan sürümle eşlenir. Zorunlu yeni hero, ücretli karakter veya nadir element yok. Sahneye beşinci bir kişiyi sırf battle formatı için sokmayız.

İlk turda tek 5v5 karşılaşma; iki ön / üç arka düşman slotu. Standart düşman takımını yenmek yeterli. İş/yöntem tercihi hazırlanmış encounter varyantı seçer; yeni global buff, escort AI veya çevre fizik motoru gerektirdiği varsayılmaz.

Düşmanlar kaynak aile referanslarıdır. Her base_unit_id’nin runtime unit/skill profili yayımlanan roster ile doğrulanacak; aşağıdaki roller mevcut AI’ın uyguladığı iddiası değildir. Sayısal HP/ATK/speed ve izinli skill/targeting bağlamaları açık. Aynı aileden iki düşman farklı rol taşıyacaksa gerçek unit/skill varyantları açıkça bağlanmalı.

## lt_enc_scout_tracks — Read the Tracks

Taktik odak: Arka tehdit önceliği.

Oyuncuya savaş öncesi: “The traveler is outside the fight. Read the visible threats; both target priority and steady defense can succeed.”

| Slot | Sıra | Kaynak düşman | Rol | Davranış brief’i |
|---|---|---|---|---|
| 0 | front | `ash_wolf` | ön baskı | Kaynak Ash Wolf’un ön sıraya baskısı; sayı dengesi sonra. |
| 1 | front | `ash_wolf` | ön baskı | Kaynak Ash Wolf’un ön sıraya baskısı; sayı dengesi sonra. |
| 2 | rear | `hollow_pilgrim` | arka tehdit | İzinli rear targeting varyantı; niyeti önceden görünür. |
| 3 | rear | `bellbound_dead` | destek tehdidi | İzinli destek profili; niyeti önceden görünür. |
| 4 | rear | `hollow_pilgrim` | hafif takip | Standard ön hedef baskısı. |

Kazanma seçenekleri: Ücretsiz 1-4 sonrası beşli veya uygun loan ile kazanılabilir. Tek element ve üç yıldız şartı yok.

## lt_enc_scout_sound — Read the Sound

Taktik odak: İki destek tehdidini fark etmek.

Oyuncuya savaş öncesi: “The traveler is outside the fight. Read the visible threats; both target priority and steady defense can succeed.”

| Slot | Sıra | Kaynak düşman | Rol | Davranış brief’i |
|---|---|---|---|---|
| 0 | front | `ash_wolf` | ön baskı | Kaynak Ash Wolf’un ön sıraya baskısı; sayı dengesi sonra. |
| 1 | front | `hollow_pilgrim` | hafif takip | Standard ön hedef baskısı. |
| 2 | rear | `bellbound_dead` | destek tehdidi | İzinli destek profili; niyeti önceden görünür. |
| 3 | rear | `bellbound_dead` | destek tehdidi | İzinli destek profili; niyeti önceden görünür. |
| 4 | rear | `hollow_pilgrim` | arka tehdit | İzinli rear targeting varyantı; niyeti önceden görünür. |

Kazanma seçenekleri: Ücretsiz 1-4 sonrası beşli veya uygun loan ile kazanılabilir. Tek element ve üç yıldız şartı yok.

## lt_enc_brace_bank — Hold the Bank

Taktik odak: Ön sırayı istikrarlı tutmak.

Oyuncuya savaş öncesi: “The traveler is outside the fight. Read the visible threats; both target priority and steady defense can succeed.”

| Slot | Sıra | Kaynak düşman | Rol | Davranış brief’i |
|---|---|---|---|---|
| 0 | front | `ash_wolf` | ön baskı | Kaynak Ash Wolf’un ön sıraya baskısı; sayı dengesi sonra. |
| 1 | front | `ash_wolf` | ön baskı | Kaynak Ash Wolf’un ön sıraya baskısı; sayı dengesi sonra. |
| 2 | rear | `hollow_pilgrim` | hafif takip | Standard ön hedef baskısı. |
| 3 | rear | `bellbound_dead` | destek tehdidi | İzinli destek profili; niyeti önceden görünür. |
| 4 | rear | `hollow_pilgrim` | hafif takip | Standard ön hedef baskısı. |

Kazanma seçenekleri: Ücretsiz 1-4 sonrası beşli veya uygun loan ile kazanılabilir. Tek element ve üç yıldız şartı yok.

## lt_enc_brace_beam — Hold the Straight Line

Taktik odak: Ön baskıyla destek hedefini birlikte yönetmek.

Oyuncuya savaş öncesi: “The traveler is outside the fight. Read the visible threats; both target priority and steady defense can succeed.”

| Slot | Sıra | Kaynak düşman | Rol | Davranış brief’i |
|---|---|---|---|---|
| 0 | front | `bellbound_dead` | destek tehdidi | İzinli destek profili; niyeti önceden görünür. |
| 1 | front | `ash_wolf` | ön baskı | Kaynak Ash Wolf’un ön sıraya baskısı; sayı dengesi sonra. |
| 2 | rear | `bellbound_dead` | destek tehdidi | İzinli destek profili; niyeti önceden görünür. |
| 3 | rear | `hollow_pilgrim` | hafif takip | Standard ön hedef baskısı. |
| 4 | rear | `hollow_pilgrim` | hafif takip | Standard ön hedef baskısı. |

Kazanma seçenekleri: Ücretsiz 1-4 sonrası beşli veya uygun loan ile kazanılabilir. Tek element ve üç yıldız şartı yok.

## Denge ve test hedefi

- Bütün varyantlar ilgili hikâye eşiğinin ücretsiz kadrosuyla kazanılabilir; ownership/ödeme şartı yok.
- Hedef önceliğini okuyan oyuncu daha rahat ilerler; sakin savunma/recovery de geçerli kalır.
- Düşman niyeti savaş öncesi ve sırası değişince anlaşılır biçimde görünür.
- Kaybetmek hikâyenin insanî sonucunu değiştirmez. Yeniden deneme aynı kayıtlı planı kullanır.
- Ustalık/tur sınırı/üç yıldız zorunluluğu veya ona bağlı ödül seçilmedi.
- Yerel doğrulama yalnız slot düzeni, seçilen varyant ve graph referanslarıdır; gerçek savaş simülasyonu yapılmadı.

Yapılandırılmış kaynak: [encounters.json](authoring/encounters.json).
