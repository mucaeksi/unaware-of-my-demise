# Arşiv Nöbeti — bütün bölüm ve karar akışı

Üç vaka; her biri taze battle state ile başlar. İlk vaka line, ikinci response, üçüncü ikisinin birleşimiyle seçilir. Dört savaş profili × iki kapanış = sekiz yazılı yol. Defeat aynı vakayı tekrar eder.

| Node | Tür | Sahne/karşılaşma | Sonraki node ve koşul |
|---|---|---|---|
| `aw_a1_book` | story | `aw_a1_book` | aw_a1_line |
| `aw_a1_line` | story | `aw_a1_line` | aw_a1_response |
| `aw_a1_response` | story | `aw_a1_response` | aw_a2_before |
| `aw_a2_before` | story | `aw_a2_before` | aw_b01 |
| `aw_b01` | battle | `aw_enc_first_steady/ aw_enc_first_reach` | aw_a2_after |
| `aw_a2_after` | story | `aw_a2_after` | aw_a3_before |
| `aw_a3_before` | story | `aw_a3_before` | aw_b02 |
| `aw_b02` | battle | `aw_enc_second_interrupt/ aw_enc_second_endure` | aw_a3_after |
| `aw_a3_after` | story | `aw_a3_after` | aw_a4_before |
| `aw_a4_before` | story | `aw_a4_before` | aw_b03 |
| `aw_b03` | battle | `aw_enc_final_steady_interrupt/ aw_enc_final_steady_endure/ aw_enc_final_reach_interrupt/ aw_enc_final_reach_endure` | aw_a4_profile |
| `aw_a4_profile` | story | `aw_a4_profile` | aw_a4_end |
| `aw_a4_end` | story | `aw_a4_end` | aw_complete |
| `aw_complete` | complete | `bitiş` | tamamlandı |

## Seçimler

| Sahne | State alanı | Etiket ve görünür sonuç |
|---|---|---|
| `aw_a1_line` | `line=steady` | Practice holding steady front pressure. — Case one uses two front pressure units; case three carries this emphasis. |
| `aw_a1_line` | `line=reach` | Practice noticing the reaching threat. — Case one includes a clear rear-reaching attacker; case three carries this emphasis. |
| `aw_a1_response` | `response=interrupt` | Practice early support target priority. — Case two exposes a priority support; no special interrupt button is required. |
| `aw_a1_response` | `response=endure` | Practice recovery under support pressure. — Case two emphasizes sustainable pressure; target priority can still win. |
| `aw_a4_profile` | `review=steady` | Review the steady-front reading. — A short note on keeping the front question visible; no new battle or reward. |
| `aw_a4_profile` | `review=reach` | Review the reaching-threat reading. — A short note on looking beyond the front; no new battle or reward. |

## Bölüm scriptleri

- [Bölüm 1](scripts/BOLUM_01.md).
- [Bölüm 2](scripts/BOLUM_02.md).
- [Bölüm 3](scripts/BOLUM_03.md).
- [Bölüm 4](scripts/BOLUM_04.md).

## Replay ve kayıt

Replay kataloglarının entry/stop_before/stop_after sınırları host tarafından uygulanır. Stop_after sahnesinden sonra ana graph kenarı değerlendirilmez. Conversation replay varsa followup_scene’i ayrıca oynar; aradaki ana event ve savaşlar yeniden zorunlu olmaz. İlk tur state’i ve claim kayıtları değiştirilmez.

Scene cursor VM ile kaydedilir. Pending choice sırasında VM save reddeder; seçime girmeden önceki cursor ve onaylandıktan sonraki seçim/state güvenli kaydedilmeli. Sahne/UI/medya restore entegrasyonu ayrıca yapılacak. Her battle defeat aynı node’a retry yapar; hikâye sonucu ölümü/para cezasına dönüşmez.

[Replay katalogu](authoring/replay_catalog.json) · [State sözleşmesi](authoring/state_contract.json).
