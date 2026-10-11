# Açık Yol — karşılaşma tasarımı

İlk tur 1 savaş; 2 tasarım varyantı. Physical scene cast ve battle roster ayrı kayıtlardır. Story gate sonrası uygun ücretsiz/loan beşli kullanılır; yeni paid hero veya ownership koşulu yok.

## or_enc_supply

Odak: Ön hattı sabit tutup destek baskısını azaltmak.

Ön bilgi: The survivors stay behind the relief point. Check the front pressure and the threat supporting it.

| Slot | Sıra | Canon aile referansı | Rol | Brief |
|---|---|---|---|---|
| 0 | front | `bridge_revenant` | ön baskı | İzinli frontline damage; köprü lore intentte yok. |
| 1 | front | `bridge_revenant` | ön baskı | İzinli frontline damage; köprü lore intentte yok. |
| 2 | rear | `hollow_cleric` | destek baskısı | İzinli heal/support profili; yaşayan Crown Guard bu karşılaşmaya eklenmez. |
| 3 | rear | `lost_vow_knight` | yakın tehdit | Standart ön hedef; kaynak family mapping entegrasyonda. |
| 4 | rear | `lost_vow_knight` | yakın tehdit | Standart ön hedef; kaynak family mapping entegrasyonda. |

Standard zafer, iki yöntemde de recovery mümkün; sivil HP yok.

## or_enc_passage

Odak: Arka sıraya ulaşan tehdidi önceliklendirmek.

Ön bilgi: The survivors stay behind the relief point. Check the front pressure and the threat supporting it.

| Slot | Sıra | Canon aile referansı | Rol | Brief |
|---|---|---|---|---|
| 0 | front | `bridge_revenant` | ön baskı | İzinli frontline damage; köprü lore intentte yok. |
| 1 | front | `lost_vow_knight` | yakın tehdit | Standart ön hedef; kaynak family mapping entegrasyonda. |
| 2 | rear | `hollow_pilgrim` | arka tehdit | İzinli rear_row_enemies selector; niyet açık. |
| 3 | rear | `hollow_cleric` | destek baskısı | İzinli heal/support profili; yaşayan Crown Guard bu karşılaşmaya eklenmez. |
| 4 | rear | `lost_vow_knight` | yakın tehdit | Standart ön hedef; kaynak family mapping entegrasyonda. |

Standard zafer, iki yöntemde de recovery mümkün; sivil HP yok.

Nihai unit/skill/AI profili bağlanmadı. Standard zafer yeterli; ustalık/tur sınırı veya ona bağlı ödül seçilmedi. Bilinen aileler bestiary ile kontrol edildi. Numeric ayar ve test sınırları [ayar sözleşmesinde](AYARLAMA_VE_URETIM.md); [encounter JSON](authoring/encounters.json).
