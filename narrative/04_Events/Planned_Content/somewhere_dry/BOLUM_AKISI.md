# Kuru Bir Yer — bütün bölüm ve karar akışı

İki çalışma düzeni; iki kayıt okuma yöntemi; yöntem callback’i; tek savaş; gündelik kaydın gerçekten kullanıldığı kapanış. Kayıp kişiyi bulmak veya belge yetiştirme sayacı yok.

| Node | Tür | Sahne/karşılaşma | Sonraki node ve koşul |
|---|---|---|---|
| `dr_a1_edge` | story | `dr_a1_edge` | dr_a1_slip |
| `dr_a1_slip` | story | `dr_a1_slip` | dr_a1_layout |
| `dr_a1_layout` | story | `dr_a1_layout` | dr_a2_shelf_1 [layout=shelf]; dr_a2_desk_1 [layout=desk] |
| `dr_a2_shelf_1` | story | `dr_a2_shelf_1` | dr_a2_shelf_2 |
| `dr_a2_shelf_2` | story | `dr_a2_shelf_2` | dr_a2_reading |
| `dr_a2_desk_1` | story | `dr_a2_desk_1` | dr_a2_desk_2 |
| `dr_a2_desk_2` | story | `dr_a2_desk_2` | dr_a2_reading |
| `dr_a2_reading` | story | `dr_a2_reading` | dr_a2_note [reading=note]; dr_a2_ask [reading=ask] |
| `dr_a2_note` | story | `dr_a2_note` | dr_a3_passage |
| `dr_a2_ask` | story | `dr_a2_ask` | dr_a3_passage |
| `dr_a3_passage` | story | `dr_a3_passage` | dr_b01 |
| `dr_b01` | battle | `dr_enc_shelf/ dr_enc_desk` | dr_a3_clear |
| `dr_a3_clear` | story | `dr_a3_clear` | dr_a4_found |
| `dr_a4_found` | story | `dr_a4_found` | dr_a4_end |
| `dr_a4_end` | story | `dr_a4_end` | dr_complete |
| `dr_complete` | complete | `bitiş` | tamamlandı |

## Seçimler

| Sahne | State alanı | Etiket ve görünür sonuç |
|---|---|---|
| `dr_a1_layout` | `layout=shelf` | Move the records to the dry side room. — Clear a supported threat from the approach; the person waits inside. |
| `dr_a1_layout` | `layout=desk` | Prepare the sheltered wall table. — Hold the entrance against front pressure; the records stay within reach. |
| `dr_a2_reading` | `reading=note` | Attach a note: receiving place unclear. — Preserve the original and route the return through the refuge keeper. |
| `dr_a2_reading` | `reading=ask` | Ask the linen keeper about the blue cord. — Confirm the ordinary return point while keeping the original unchanged. |

## Bölüm scriptleri

- [Bölüm 1](scripts/BOLUM_01.md).
- [Bölüm 2](scripts/BOLUM_02.md).
- [Bölüm 3](scripts/BOLUM_03.md).
- [Bölüm 4](scripts/BOLUM_04.md).

## Replay ve kayıt

Replay kataloglarının entry/stop_before/stop_after sınırları host tarafından uygulanır. Stop_after sahnesinden sonra ana graph kenarı değerlendirilmez. Conversation replay varsa followup_scene’i ayrıca oynar; aradaki ana event ve savaşlar yeniden zorunlu olmaz. İlk tur state’i ve claim kayıtları değiştirilmez.

Scene cursor VM ile kaydedilir. Pending choice sırasında VM save reddeder; seçime girmeden önceki cursor ve onaylandıktan sonraki seçim/state güvenli kaydedilmeli. Sahne/UI/medya restore entegrasyonu ayrıca yapılacak. Her battle defeat aynı node’a retry yapar; hikâye sonucu ölümü/para cezasına dönüşmez.

[Replay katalogu](authoring/replay_catalog.json) · [State sözleşmesi](authoring/state_contract.json).
