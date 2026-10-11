# Tutulmayı Bekleyenler — bütün bölüm ve karar akışı

İki seyir yolu, iki yaklaşma savaşı, kaynak öğle sahnesi, iki gözlem yaklaşımı, bir dönüş savaşı ve üç karakter kapanışı. Görsel tepe noktası gözlem sahnesidir.

| Node | Tür | Sahne/karşılaşma | Sonraki node ve koşul |
|---|---|---|---|
| `tw_a1_road` | story | `tw_a1_road` | event_sun_eclipse_day_1 |
| `event_sun_eclipse_day_1` | story | `event_sun_eclipse_day_1` | tw_a1_questions |
| `tw_a1_questions` | story | `tw_a1_questions` | tw_a1_place |
| `tw_a1_place` | story | `tw_a1_place` | tw_a2_ridge_1 [place=ridge]; tw_a2_terrace_1 [place=terrace] |
| `tw_a2_ridge_1` | story | `tw_a2_ridge_1` | tw_b01_ridge |
| `tw_b01_ridge` | battle | `tw_enc_ridge_1` | tw_a2_ridge_2 |
| `tw_a2_ridge_2` | story | `tw_a2_ridge_2` | tw_a2_ridge_3 |
| `tw_a2_ridge_3` | story | `tw_a2_ridge_3` | tw_b02_ridge |
| `tw_b02_ridge` | battle | `tw_enc_ridge_2` | tw_a2_ridge_4 |
| `tw_a2_ridge_4` | story | `tw_a2_ridge_4` | event_sun_eclipse_day_2 |
| `tw_a2_terrace_1` | story | `tw_a2_terrace_1` | tw_b01_terrace |
| `tw_b01_terrace` | battle | `tw_enc_terrace_1` | tw_a2_terrace_2 |
| `tw_a2_terrace_2` | story | `tw_a2_terrace_2` | tw_a2_terrace_3 |
| `tw_a2_terrace_3` | story | `tw_a2_terrace_3` | tw_b02_terrace |
| `tw_b02_terrace` | battle | `tw_enc_terrace_2` | tw_a2_terrace_4 |
| `tw_a2_terrace_4` | story | `tw_a2_terrace_4` | event_sun_eclipse_day_2 |
| `event_sun_eclipse_day_2` | story | `event_sun_eclipse_day_2` | tw_a3_after |
| `tw_a3_after` | story | `tw_a3_after` | tw_a3_account |
| `tw_a3_account` | story | `tw_a3_account` | tw_a4_descent |
| `tw_a4_descent` | story | `tw_a4_descent` | tw_b03 |
| `tw_b03` | battle | `tw_enc_return` | tw_a4_clear |
| `tw_a4_clear` | story | `tw_a4_clear` | tw_a4_seen [account=seen]; tw_a4_heard [account=heard] |
| `tw_a4_seen` | story | `tw_a4_seen` | event_sun_eclipse_day_3 |
| `tw_a4_heard` | story | `tw_a4_heard` | event_sun_eclipse_day_3 |
| `event_sun_eclipse_day_3` | story | `event_sun_eclipse_day_3` | tw_a5_token |
| `tw_a5_token` | story | `tw_a5_token` | tw_a5_company |
| `tw_a5_company` | story | `tw_a5_company` | tw_a5_end |
| `tw_a5_end` | story | `tw_a5_end` | tw_complete |
| `tw_complete` | complete | `bitiş` | tamamlandı |

## Seçimler

| Sahne | State alanı | Etiket ve görünür sonuç |
|---|---|---|
| `tw_a1_place` | `place=ridge` | Take the open ridge. — Two approach fights emphasize reaching attackers and target priority. |
| `tw_a1_place` | `place=terrace` | Take the sheltered terrace. — Two approach fights emphasize steady front pressure and supporting enemies. |
| `tw_a3_account` | `account=seen` | Describe the view and its limits. — Record the rim and viewpoint; a visual observation callback. |
| `tw_a3_account` | `account=heard` | Record what the watchers heard. — Keep the collective sound and a person’s account; a listening callback. |
| `tw_a5_company` | `focus=clem` | Clem and the ordinary record. — A closing about making room for more than one account. |
| `tw_a5_company` | `focus=vespera` | Vespera and the unanswered question. — A closing about a useful limit to an explanation. |
| `tw_a5_company` | `focus=thistle` | Thistle and the place to sit. — A closing about care while people try to understand. |

## Bölüm scriptleri

- [Bölüm 1](scripts/BOLUM_01.md).
- [Bölüm 2](scripts/BOLUM_02.md).
- [Bölüm 3](scripts/BOLUM_03.md).
- [Bölüm 4](scripts/BOLUM_04.md).
- [Bölüm 5](scripts/BOLUM_05.md).

## Replay ve kayıt

Replay kataloglarının entry/stop_before/stop_after sınırları host tarafından uygulanır. Stop_after sahnesinden sonra ana graph kenarı değerlendirilmez. Conversation replay varsa followup_scene’i ayrıca oynar; aradaki ana event ve savaşlar yeniden zorunlu olmaz. İlk tur state’i ve claim kayıtları değiştirilmez.

Scene cursor VM ile kaydedilir. Pending choice sırasında VM save reddeder; seçime girmeden önceki cursor ve onaylandıktan sonraki seçim/state güvenli kaydedilmeli. Sahne/UI/medya restore entegrasyonu ayrıca yapılacak. Her battle defeat aynı node’a retry yapar; hikâye sonucu ölümü/para cezasına dönüşmez.

[Replay katalogu](authoring/replay_catalog.json) · [State sözleşmesi](authoring/state_contract.json).
