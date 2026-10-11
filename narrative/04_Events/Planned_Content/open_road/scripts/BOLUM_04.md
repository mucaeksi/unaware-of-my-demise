# Açık Yol — Bölüm 4: Biz Olmadan da

Yeni metinler yaratıcı genişletmedir; canon sahneler kaynak kopyasıdır. Oyuncu metni İngilizce.

## or_a4_test — Who Shows the Next Person

Mekân: `or_relief_stop` · `new_authored_expansion`

Amaç: Ustalık/timing puanı değil iki somut teach-back callback.

**Sahne yönergesi:** Choose a teach-back check. This is not a hidden correct answer or a character affection score.

**Marek** · `or_a4_test_001` · calm

One more check. We should see this work with an unfamiliar pair of hands.

**Nara** · `or_a4_test_002` · focused

Or with an unexpected pause. Both happen on roads.

### Seçim — Check the handover.

Kayıt alanı: `test`

#### Let a new volunteer explain the order. — `or_test_newcomer`

Önizleme: See whether the instructions work without Nara or Marek leading.

**Volunteer** · `or_a4_test_003` · focused

I will show them once, then let them show me.

**Marek** · `or_a4_test_004` · gentle

Good. Leave room for their question before answering it.

**Nara** · `or_a4_test_005` · calm

And watch where their feet hesitate.

#### Rehearse a pause with the current volunteer. — `or_test_pause`

Önizleme: See how they keep the passage clear while someone rests.

**Volunteer** · `or_a4_test_006` · focused

I can stop at the bench without stopping the next person at the entrance.

**Nara** · `or_a4_test_007` · measured

Show us. Slowly is a useful speed for this check.

**Marek** · `or_a4_test_008` · calm

I will be the next person with the empty basket.

**Checkpoint:** `or_a4_test_done`

## or_a4_newcomer — A Second Explanation

Mekân: `or_relief_stop` · `new_authored_expansion`

Amaç: Newcomer sonrasıcallback; Marek refugees şarkısı yok.

**Sahne yönergesi:** A second local volunteer repeats the order off-screen; no new named companion appears.

**Narration** · `or_a4_newcomer_001` · composed

The new volunteer asks where the empty marker goes. The first points to the board instead of to Marek.

**Marek** · `or_a4_newcomer_002` · quiet

They did not need to call us.

**Nara** · `or_a4_newcomer_003` · measured

They knew whom to ask.

**Volunteer** · `or_a4_newcomer_004` · relieved

And now two of us can show it.

**Marek** · `or_a4_newcomer_005` · gentle

That is the useful number for today.

**Checkpoint:** `or_a4_newcomer_done`

## or_a4_pause — A Place to Stop

Mekân: `or_relief_stop` · `new_authored_expansion`

Amaç: Pause callback; NaraLastCart travması tekrar değil.

**Sahne yönergesi:** The volunteer demonstrates resting without closing the access lane.

**Narration** · `or_a4_pause_001` · composed

The volunteer sits at the bench. Marek passes with the basket without turning sideways.

**Nara** · `or_a4_pause_002` · measured

Enough room. Keep that distance when the next group arrives.

**Volunteer** · `or_a4_pause_003` · quiet

I thought sitting down meant leaving the work.

**Marek** · `or_a4_pause_004` · gentle

It means letting the next person do it for a while.

**Nara** · `or_a4_pause_005` · calm

The opening is still open.

**Checkpoint:** `or_a4_pause_done`

## or_a4_end — A Place That Continues

Mekân: `or_relief_stop` · `new_authored_expansion`

Amaç: Ortak bitiş. Off-screen devam 7-2return korunur.

**Sahne yönergesi:** Nara and Marek continue the established survivor escort route. Neither predicts the bridge fate or Oren whereabouts.

**Volunteer** · `or_a4_end_001` · quiet

Will you be back?

**Marek** · `or_a4_end_002` · calm

We will walk with the next people who need the road. You know how to keep this place.

**Nara** · `or_a4_end_003` · focused

Ask for help before the waiting space closes. You do not have to manage every arrival alone.

**Narration** · `or_a4_end_004` · composed

A new volunteer takes the basket. The first stays seated long enough to finish the water.

**Marek** · `or_a4_end_005` · wry

They have already become better at resting than we are.

**Nara** · `or_a4_end_006` · quiet

Then we taught something useful.

**Checkpoint:** `or_a4_end_done`
