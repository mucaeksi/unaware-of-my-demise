# Açık Yol — birleşik tam script

Bütün yol ve seçim varyantları dahil.

# Açık Yol — Bölüm 1: Geçişten Sonra

Yeni metinler yaratıcı genişletmedir; canon sahneler kaynak kopyasıdır. Oyuncu metni İngilizce.

## or_a1_after — Beyond the Crossing

Mekân: `or_relief_stop` · `new_authored_expansion`

Amaç: 5-5 yan sivil rota; Mahmut/Fadyme geri dönmez.

**Sahne yönergesi:** Nara and Marek are on the safe side with survivors. The bridge and Oren are off-screen; no fate is assigned to either.

**Narration** · `or_a1_after_001` · composed

Beyond the crossing, a stretch of firm ground has become a place to stop. It needs to become a place other people can use.

**Nara** · `or_a1_after_002` · focused

Keep the exit wide. Resting people should not become a wall for arriving people.

**Marek** · `or_a1_after_003` · calm

The volunteers have brought water and cloth. They need to know where each belongs.

**Volunteer** · `or_a1_after_004` · hesitant

We can keep it going if someone shows us the order.

**Nara** · `or_a1_after_005` · measured

Then we will show you. After that, you will show us.

**Marek** · `or_a1_after_006` · wry

She accepts demonstrations more readily than thanks.

**Checkpoint:** `or_a1_after_done`

## or_a1_need — A Stop with Two Edges

Mekân: `or_relief_stop` · `new_authored_expansion`

Amaç: Yardım düzeninin devri; Refugee Measure şarkısı tekrar değil.

**Sahne yönergesi:** Supplies and the passage are both necessary. No survivor is assigned a hidden death outcome.

**Volunteer** · `or_a1_need_001` · worried

If we put everything close to the bench, the next group can reach it.

**Nara** · `or_a1_need_002` · focused

And if the boxes close the approach, they cannot reach the bench.

**Marek** · `or_a1_need_003` · calm

We need an order that works when the two of us have gone ahead.

**Volunteer** · `or_a1_need_004` · quiet

I thought keeping you here was the safer plan.

**Nara** · `or_a1_need_005` · calm

A useful place should not depend on one pair of shoulders.

**Narration** · `or_a1_need_006` · composed

Marek sets his spear beside the supply board. He does not start a marching song.

**Checkpoint:** `or_a1_need_done`

## or_a1_handoff — Show the Next Hands

Mekân: `or_relief_stop` · `new_authored_expansion`

Amaç: Handoff sırası iki farklı rehearsal ve battle düzeni.

**Sahne yönergesi:** Choose which operational task to teach first. Both are completed before the handover.

**Marek** · `or_a1_handoff_001` · calm

We can start with finding and replacing supplies, or with keeping the way through open.

**Nara** · `or_a1_handoff_002` · measured

The first needs a steady entrance. The second needs the reaching threat noticed early.

**Volunteer** · `or_a1_handoff_003` · focused

Tell me what to try. I will do it, rather than promise I understood.

### Seçim — Begin the handover.

Kayıt alanı: `handoff`

#### Teach the supply handover first. — `or_handoff_supply`

Önizleme: Show stock placement and replacement; battle emphasizes a steady front.

**Marek** · `or_a1_handoff_004` · focused

Find a cloth, bring it to the bench, then show where the next one waits.

**Nara** · `or_a1_handoff_005` · calm

I will watch the approach while you learn the order.

#### Teach the open passage first. — `or_handoff_passage`

Önizleme: Show waiting and passing space; battle emphasizes the reaching threat.

**Nara** · `or_a1_handoff_006` · focused

Walk it as if you had never seen this stop. Tell us where you must hesitate.

**Marek** · `or_a1_handoff_007` · calm

I will carry the empty basket through after you.

**Checkpoint:** `or_a1_handoff_done`



---

# Açık Yol — Bölüm 2: Sıradaki Eller

Yeni metinler yaratıcı genişletmedir; canon sahneler kaynak kopyasıdır. Oyuncu metni İngilizce.

## or_a2_supply_1 — Where the Next Cloth Waits

Mekân: `or_supply_board` · `new_authored_expansion`

Amaç: Görünür stok işleyişi; yapı/üretim ekonomisi eklenmez.

**Sahne yönergesi:** The volunteer demonstrates a simple stock handover. Supplies are story props, not reward inventory.

**Volunteer** · `or_a2_supply_1_001` · focused

One here, one brought forward, the empty cloth marker laid flat.

**Marek** · `or_a2_supply_1_002` · calm

Good. How does the next person see that the stack is low?

**Volunteer** · `or_a2_supply_1_003` · hesitant

I could call for you.

**Marek** · `or_a2_supply_1_004` · gentle

Try a person who will still be here.

**Nara** · `or_a2_supply_1_005` · calm

The keeper at the bench can see a flat marker. Put it where their eyes already go.

**Narration** · `or_a2_supply_1_006` · composed

The volunteer moves the marker, then starts the handover again.

**Checkpoint:** `or_a2_supply_1_done`

## or_a2_supply_2 — An Order Someone Else Can Use

Mekân: `or_supply_board` · `new_authored_expansion`

Amaç: Supply dalı tamam; herikiiş de biter.

**Sahne yönergesi:** The route through is also cleared. The volunteer can repeat the procedure without Marek doing it for them.

**Marek** · `or_a2_supply_2_001` · focused

Now pretend I am sitting at the bench. What do you need from me?

**Volunteer** · `or_a2_supply_2_002` · calm

Leave the opening clear. Put the used cloth here, so the clean stack stays clean.

**Nara** · `or_a2_supply_2_003` · measured

That is an instruction people can follow.

**Marek** · `or_a2_supply_2_004` · wry

And one I can follow while sitting down. A rare luxury.

**Narration** · `or_a2_supply_2_005` · composed

The exit remains open. The board holds enough room for another pair of hands.

**Checkpoint:** `or_a2_supply_2_done`

## or_a2_passage_1 — Walk It Once

Mekân: `or_waiting_lane` · `new_authored_expansion`

Amaç: İşaret/tabela tamiri değil işlevsel mekân düzeni ve rehearsal.

**Sahne yönergesi:** Nara asks the volunteer to walk the passage at an ordinary pace. No real-time civilian pathfinding is required.

**Volunteer** · `or_a2_passage_1_001` · focused

Here I would stop. I cannot see whether that space is for waiting or passing.

**Nara** · `or_a2_passage_1_002` · measured

Then separate the bench from the opening. Do not make the tired person guess.

**Marek** · `or_a2_passage_1_003` · calm

The supply basket can wait inside the marked space.

**Volunteer** · `or_a2_passage_1_004` · relieved

That leaves the turn open.

**Nara** · `or_a2_passage_1_005` · focused

Try it again from the other side. Nobody arriving owes us knowledge of the first side.

**Narration** · `or_a2_passage_1_006` · composed

The volunteer returns by the same clear opening, without taking the shortest line across the bench.

**Checkpoint:** `or_a2_passage_1_done`

## or_a2_passage_2 — Leave the Opening

Mekân: `or_waiting_lane` · `new_authored_expansion`

Amaç: Passage dalı tamam; yeni kalıcı buildsystem yok.

**Sahne yönergesi:** The supplies are made accessible too. Marek gives a small practical instruction rather than a procession song.

**Marek** · `or_a2_passage_2_001` · calm

Water within reach of someone seated. Extra cloth behind it, where it stays dry.

**Volunteer** · `or_a2_passage_2_002` · focused

And nobody waits inside the opening, even when the bench is full.

**Nara** · `or_a2_passage_2_003` · measured

What do you do when it is full?

**Volunteer** · `or_a2_passage_2_004` · calm

Ask the next group to stop on the firm ground here. I do not press them against the exit.

**Nara** · `or_a2_passage_2_005` · quiet

Good. That is a place, not a crowd.

**Narration** · `or_a2_passage_2_006` · composed

Marek puts the empty basket down where its owner can find it again.

**Checkpoint:** `or_a2_passage_2_done`



---

# Açık Yol — Bölüm 3: Noktayı Güvenli Tutmak

Yeni metinler yaratıcı genişletmedir; canon sahneler kaynak kopyasıdır. Oyuncu metni İngilizce.

## or_a3_line — The Remaining Threat

Mekân: `or_safe_approach` · `new_authored_expansion`

Amaç: B01 standard battle; sivil escortAI yok.

**Sahne yönergesi:** Known bridge dead approach the outer ground. Survivors and volunteers remain safely behind the relief point.

**Narration** · `or_a3_line_001` · composed

A dead guard drags its weapon over the far stones. Others follow where the firm ground narrows.

**Nara** · `or_a3_line_002` · focused

Everyone behind the stop. This is the line we keep, not a line you join.

**Marek** · `or_a3_line_003` · focused

Read the one supporting the formation. The nearest blade is not the only threat.

**Volunteer** · `or_a3_line_004` · worried

Do we move the people again?

**Nara** · `or_a3_line_005` · calm

They have safe room. Keep it clear for them.

**Narration** · `or_a3_line_006` · composed

The two step forward without asking the volunteers to hold a weapon.

**Checkpoint:** `or_a3_line_done`

## or_a3_safe — Use It Again

Mekân: `or_relief_stop` · `new_authored_expansion`

Amaç: Savaş sonrası işlevsel kontrol; kast yaralanma kaybı cezaları yok.

**Sahne yönergesi:** After standard victory, the handover demonstration resumes without repeating the battle.

**Marek** · `or_a3_safe_001` · calm

The approach is clear. Show us the order once more.

**Volunteer** · `or_a3_safe_002` · focused

Waiting space here. Passing space there. Supplies brought forward without blocking either.

**Nara** · `or_a3_safe_003` · measured

And who can explain it if you are resting?

**Volunteer** · `or_a3_safe_004` · calm

The next volunteer. I will show them before I sit down.

**Narration** · `or_a3_safe_005` · composed

Marek leaves the supply board in the volunteer’s hands.

**Checkpoint:** `or_a3_safe_done`



---

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
