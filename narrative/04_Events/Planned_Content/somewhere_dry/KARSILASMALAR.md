# Kuru Bir Yer — karşılaşma tasarımı

İlk tur 1 savaş; 2 tasarım varyantı. Physical scene cast ve battle roster ayrı kayıtlardır. Story gate sonrası uygun ücretsiz/loan beşli kullanılır; yeni paid hero veya ownership koşulu yok.

## dr_enc_shelf

Odak: Destek hedefini azaltıp approach açmak.

Ön bilgi: The waiting people and records are outside the fight. Read the armored front and the supporting cleric.

| Slot | Sıra | Canon aile referansı | Rol | Brief |
|---|---|---|---|---|
| 0 | front | `choir_knight` | ön zırh | İzinli ön baskı profili; ward bağı varsa açık intent. |
| 1 | front | `inkbound_dead` | işaret baskısı | Mevcut mark/status grammar ile sınırlı; lore intent panelinde yok. |
| 2 | rear | `hollow_cleric` | destek | İzinli heal profili; destek hedefi görünür. |
| 3 | rear | `inkbound_dead` | işaret baskısı | Mevcut mark/status grammar ile sınırlı; lore intent panelinde yok. |
| 4 | rear | `inkbound_dead` | işaret baskısı | Mevcut mark/status grammar ile sınırlı; lore intent panelinde yok. |

Standard zafer; sustain veya destek önceliği. Belge savunma HP/minigame yok.

## dr_enc_desk

Odak: Ön baskıyı yönetirken tek desteği takip etmek.

Ön bilgi: The waiting people and records are outside the fight. Read the armored front and the supporting cleric.

| Slot | Sıra | Canon aile referansı | Rol | Brief |
|---|---|---|---|---|
| 0 | front | `choir_knight` | ön zırh | İzinli ön baskı profili; ward bağı varsa açık intent. |
| 1 | front | `choir_knight` | ön zırh | İzinli ön baskı profili; ward bağı varsa açık intent. |
| 2 | rear | `hollow_cleric` | destek | İzinli heal profili; destek hedefi görünür. |
| 3 | rear | `inkbound_dead` | işaret baskısı | Mevcut mark/status grammar ile sınırlı; lore intent panelinde yok. |
| 4 | rear | `inkbound_dead` | işaret baskısı | Mevcut mark/status grammar ile sınırlı; lore intent panelinde yok. |

Standard zafer; sustain veya destek önceliği. Belge savunma HP/minigame yok.

Nihai unit/skill/AI profili bağlanmadı. Standard zafer yeterli; ustalık/tur sınırı veya ona bağlı ödül seçilmedi. Bilinen aileler bestiary ile kontrol edildi. Numeric ayar ve test sınırları [ayar sözleşmesinde](AYARLAMA_VE_URETIM.md); [encounter JSON](authoring/encounters.json).
