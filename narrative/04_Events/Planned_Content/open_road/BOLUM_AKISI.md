# Açık Yol — bütün bölüm ve karar akışı

İki görev öğretme sırası, tek savaş, iki teach-back kontrolü ve gönüllünün kullanımıyla bitiş. Tabela onarma veya yürüyüş şarkısı görevi değil.

| Node | Tür | Sahne/karşılaşma | Sonraki node ve koşul |
|---|---|---|---|
| `or_a1_after` | story | `or_a1_after` | or_a1_need |
| `or_a1_need` | story | `or_a1_need` | or_a1_handoff |
| `or_a1_handoff` | story | `or_a1_handoff` | or_a2_supply_1 [handoff=supply]; or_a2_passage_1 [handoff=passage] |
| `or_a2_supply_1` | story | `or_a2_supply_1` | or_a2_supply_2 |
| `or_a2_supply_2` | story | `or_a2_supply_2` | or_a3_line |
| `or_a2_passage_1` | story | `or_a2_passage_1` | or_a2_passage_2 |
| `or_a2_passage_2` | story | `or_a2_passage_2` | or_a3_line |
| `or_a3_line` | story | `or_a3_line` | or_b01 |
| `or_b01` | battle | `or_enc_supply/ or_enc_passage` | or_a3_safe |
| `or_a3_safe` | story | `or_a3_safe` | or_a4_test |
| `or_a4_test` | story | `or_a4_test` | or_a4_newcomer [test=newcomer]; or_a4_pause [test=pause] |
| `or_a4_newcomer` | story | `or_a4_newcomer` | or_a4_end |
| `or_a4_pause` | story | `or_a4_pause` | or_a4_end |
| `or_a4_end` | story | `or_a4_end` | or_complete |
| `or_complete` | complete | `bitiş` | tamamlandı |

## Seçimler

| Sahne | State alanı | Etiket ve görünür sonuç |
|---|---|---|
| `or_a1_handoff` | `handoff=supply` | Teach the supply handover first. — Show stock placement and replacement; battle emphasizes a steady front. |
| `or_a1_handoff` | `handoff=passage` | Teach the open passage first. — Show waiting and passing space; battle emphasizes the reaching threat. |
| `or_a4_test` | `test=newcomer` | Let a new volunteer explain the order. — See whether the instructions work without Nara or Marek leading. |
| `or_a4_test` | `test=pause` | Rehearse a pause with the current volunteer. — See how they keep the passage clear while someone rests. |

## Bölüm scriptleri

- [Bölüm 1](scripts/BOLUM_01.md).
- [Bölüm 2](scripts/BOLUM_02.md).
- [Bölüm 3](scripts/BOLUM_03.md).
- [Bölüm 4](scripts/BOLUM_04.md).

## Replay ve kayıt

Replay kataloglarının entry/stop_before/stop_after sınırları host tarafından uygulanır. Stop_after sahnesinden sonra ana graph kenarı değerlendirilmez. Conversation replay varsa followup_scene’i ayrıca oynar; aradaki ana event ve savaşlar yeniden zorunlu olmaz. İlk tur state’i ve claim kayıtları değiştirilmez.

Scene cursor VM ile kaydedilir. Pending choice sırasında VM save reddeder; seçime girmeden önceki cursor ve onaylandıktan sonraki seçim/state güvenli kaydedilmeli. Sahne/UI/medya restore entegrasyonu ayrıca yapılacak. Her battle defeat aynı node’a retry yapar; hikâye sonucu ölümü/para cezasına dönüşmez.

[Replay katalogu](authoring/replay_catalog.json) · [State sözleşmesi](authoring/state_contract.json).
