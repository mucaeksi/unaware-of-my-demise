# Ödünç Bir Sandalye — bütün bölüm ve karar akışı

Beş kısa sahne, bir ikili konuşma tercihi, sıfır savaş. Emaneti geri götürmek bir taşıma minigame’i değildir; eşya tüketme/üretme veya teslimat farm’ı yok.

| Node | Tür | Sahne/karşılaşma | Sonraki node ve koşul |
|---|---|---|---|
| `bc_a1_stack` | story | `bc_a1_stack` | bc_a1_walk |
| `bc_a1_walk` | story | `bc_a1_walk` | bc_a2_door |
| `bc_a2_door` | story | `bc_a2_door` | bc_a3_inside |
| `bc_a3_inside` | story | `bc_a3_inside` | bc_a3_end |
| `bc_a3_end` | story | `bc_a3_end` | bc_complete |
| `bc_complete` | complete | `bitiş` | tamamlandı |

## Seçimler

| Sahne | State alanı | Etiket ve görünür sonuç |
|---|---|---|
| `bc_a2_door` | `voice=jori` | Let Jori speak about the borrowed work. — A practical thanks; the owner tells how she used the chair before supper. |
| `bc_a2_door` | `voice=pippa` | Let Pippa share a small supper memory. — A brief remembered moment; the owner chooses what she keeps from it. |

## Bölüm scriptleri

- [Bölüm 1](scripts/BOLUM_01.md).
- [Bölüm 2](scripts/BOLUM_02.md).
- [Bölüm 3](scripts/BOLUM_03.md).

## Replay ve kayıt

Replay kataloglarının entry/stop_before/stop_after sınırları host tarafından uygulanır. Stop_after sahnesinden sonra ana graph kenarı değerlendirilmez. Conversation replay varsa followup_scene’i ayrıca oynar; aradaki ana event ve savaşlar yeniden zorunlu olmaz. İlk tur state’i ve claim kayıtları değiştirilmez.

Scene cursor VM ile kaydedilir. Pending choice sırasında VM save reddeder; seçime girmeden önceki cursor ve onaylandıktan sonraki seçim/state güvenli kaydedilmeli. Sahne/UI/medya restore entegrasyonu ayrıca yapılacak. Her battle defeat aynı node’a retry yapar; hikâye sonucu ölümü/para cezasına dönüşmez.

[Replay katalogu](authoring/replay_catalog.json) · [State sözleşmesi](authoring/state_contract.json).
