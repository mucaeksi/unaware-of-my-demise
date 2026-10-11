# İki Etiket — bütün aktların birleşik scripti

31 sahne; bütün rota ve seçim varyantları. Oyuncu tek turda yalnız kendi yolunu görür.

# İki Etiket — Akt 1: tam sahne scriptleri

Oyuncu metni İngilizce. Yeni ekler yaratıcı taslak; canon sahneler birebir kaynak kopyasıdır.
Sahne numarası okuma sırasıdır; gerçek oynatma sırası akış grafiğinden gelir. Rota ve seçim dalları açıkça işaretlidir.

## event_guild_salt_fever_1 — A Dispatch Posted

Mekân: `undercity_antidote_archive` · Kaynak: `canon_verbatim`

Amaç: Mevcut duyuru: işin amacı ve dört karakter; konuşmalar aynen korunur.

**Sahne yönergesi:** Kera nails the archive wing's first public notice to its own door.

**Kera** · `event_guild_salt_fever_1_001` · defiant

Salt-road fever in the coastal villages. The ledger wing sold the cure. We are giving it away.

**Tilda** · `event_guild_salt_fever_1_002` · dry

With what staff? You have three shelves and a temper.

**Kera** · `event_guild_salt_fever_1_003` · smug

I have you, Iona, and a harbor archer who knows the coast.

**Odelia** · `event_guild_salt_fever_1_004` · hesitant

I did not agree to this.

**Kera** · `event_guild_salt_fever_1_005` · tsundere

You agreed with your face.

**Checkpoint:** `event_guild_salt_fever_1_done`

## tl_a1_crates — What Goes in the Crate

Mekân: `undercity_antidote_archive` · Kaynak: `new_authored_expansion`

Amaç: Ekip iş bölümünü kurar; üç kasa görev prop’udur, cüzdan veya tüketilebilir event parası değildir.

**Sahne yönergesi:** Open crates on the archive table. Kera ties paper labels to stoppered bottles. Iona has cleared a place for clean cloth.

**Narration** · `tl_a1_crates_001` · composed

The last shelf holds enough bottles to make the table look generous. The open crates make it look smaller.

**Tilda** · `tl_a1_crates_002` · dry

Four people. Three crates. Which of those is carrying the table?

**Kera** · `tl_a1_crates_003` · focused

The table stays here. We are taking cloth, clean water, and the medicine.

**Iona** · `tl_a1_crates_004` · gentle

And a place for the bottles we open. They cannot travel beside the sealed ones.

**Kera** · `tl_a1_crates_005` · annoyed

I know how to pack a crate.

**Tilda** · `tl_a1_crates_006` · dry

Good. I know how to unpack one someone has sat on.

**Odelia** · `tl_a1_crates_007` · hesitant

There are two ways past the old salt sheds. We can choose when we reach the fork.

**Kera** · `tl_a1_crates_008` · focused

Which is shorter?

**Odelia** · `tl_a1_crates_009` · serious

That depends on what is standing in it.

**Iona** · `tl_a1_crates_010` · calm

Then we leave room to change our minds.

**Narration** · `tl_a1_crates_011` · composed

Iona slips a folded cloth beneath the handles. Odelia tests each knot before lifting anything.

**Kera** · `tl_a1_crates_012` · wry

This is a dispatch. Not a rescue of my packing habits.

**Tilda** · `tl_a1_crates_013` · dry

We can do two useful things at once.

**Checkpoint:** `tl_a1_crates_done`

## tl_a1_preparation — Before the Road

Mekân: `undercity_antidote_archive` · Kaynak: `new_authored_expansion`

Amaç: İki hazırlık da her rotayla uyumlu; seçimin avantajı ilgili sonraki karşılaşma brifinginde görünür.

**Sahne yönergesi:** Tilda separates a field kit. Odelia unrolls a rough route sketch beside it. No map puzzle or hidden hotspot is required.

**Odelia** · `tl_a1_preparation_001` · focused

The roads look open from here. The last bend is where they stop looking open.

**Tilda** · `tl_a1_preparation_002` · focused

There is also fever sweat, dirty water, and whatever the road throws on us.

**Kera** · `tl_a1_preparation_003` · annoyed

You have both made persuasive arguments against going anywhere.

**Iona** · `tl_a1_preparation_004` · gentle

They have made arguments for being ready.

**Odelia** · `tl_a1_preparation_005` · hesitant

I can walk ahead and mark the bad approaches.

**Tilda** · `tl_a1_preparation_006` · focused

Or we prepare the field kit where we can still see what we are doing.

**Kera** · `tl_a1_preparation_007` · focused

Both will be useful. Which do we do first?

### Seçim: Choose the first preparation.

Kayıt alanı: `prep`. Her dal kendi repliklerinden sonra sahne sonuna birleşir.

#### Prepare the field kit — focus on sustained pressure. — `tl_prep_clean`

Seçim önizlemesi: Prioritize recovery during sustained pressure; both routes remain available.

**Tilda** · `tl_a1_preparation_008` · focused

Clean cloth here. Treatment tools here. Nothing goes back into the medicine crate.

**Kera** · `tl_a1_preparation_009` · focused

I have labeled the pockets.

**Tilda** · `tl_a1_preparation_010` · dry

You have labeled one of them "obvious".

**Kera** · `tl_a1_preparation_011` · wry

It is the pocket for the obvious things.

**Iona** · `tl_a1_preparation_012` · gentle

I will keep the kit within reach.

**Odelia** · `tl_a1_preparation_013` · calm

Then I will watch the turns from the cart.

#### Survey the approaches — focus on target priority. — `tl_prep_scout`

Seçim önizlemesi: Prioritize advance warning and target selection; both routes remain available.

**Odelia** · `tl_a1_preparation_014` · focused

I will mark where the path narrows. A small mark. Not one that sends everyone following it.

**Kera** · `tl_a1_preparation_015` · focused

What if we cannot find it?

**Odelia** · `tl_a1_preparation_016` · serious

You will. It will point at the part you should be looking at.

**Iona** · `tl_a1_preparation_017` · gentle

We will wait at the bend until we can see you.

**Tilda** · `tl_a1_preparation_018` · dry

And the kit comes with me. Prepared or not, I refuse to misplace it.

**Kera** · `tl_a1_preparation_019` · wry

Good. Nobody has been outvoted by a pocket.

**Checkpoint:** `tl_a1_preparation_done`

## tl_a1_gate — The Yard Gate

Mekân: `tl_archive_yard` · Kaynak: `new_authored_expansion`

Amaç: B01 savaş öncesi; tehdit okunur, taşınan ilacı savaş HP barına dönüştürmez.

**Sahne yönergesi:** At the outer service gate, ruined carts leave a narrow passage. A moving bell cord appears beyond a leaning shutter.

**Narration** · `tl_a1_gate_001` · composed

At the service gate, a dead hand works the same latch again and again. The gate has no door left to open.

**Odelia** · `tl_a1_gate_002` · serious

Stop. Something behind the shutter is moving with it.

**Kera** · `tl_a1_gate_003` · focused

The yard was clear this morning.

**Tilda** · `tl_a1_gate_004` · dry

It has had a busy morning.

**Iona** · `tl_a1_gate_005` · calm

Keep the crates behind us. There is room along the wall.

**Odelia** · `tl_a1_gate_006` · focused

The one with the cord is making the others turn. Deal with that first, or hold until it cannot reach us.

**Kera** · `tl_a1_gate_007` · focused

Bottles down. Hands free.

**Narration** · `tl_a1_gate_008` · composed

They lower the crates together. No bottle breaks.

**Checkpoint:** `tl_a1_gate_done`

## tl_a1_after_gate — Four Handles

Mekân: `tl_archive_yard` · Kaynak: `new_authored_expansion`

Amaç: Zafer sonrası işbirliği; Odelia’nın tek başına yük taşıma alışkanlığına küçük temas.

**Sahne yönergesi:** The gate is clear. Everyone checks one crate seam or knot; no victory makes medicine or money appear.

**Odelia** · `tl_a1_after_gate_001` · calm

Clear to the first bend.

**Kera** · `tl_a1_after_gate_002` · focused

Stoppers intact. Labels dry.

**Tilda** · `tl_a1_after_gate_003` · dry

You checked the labels before the glass.

**Kera** · `tl_a1_after_gate_004` · wry

The labels are easier to frighten.

**Iona** · `tl_a1_after_gate_005` · gentle

This handle is cutting into your fingers. Put your hand here.

**Odelia** · `tl_a1_after_gate_006` · hesitant

I can take it.

**Iona** · `tl_a1_after_gate_007` · calm

I know. That is why I am sharing it.

**Narration** · `tl_a1_after_gate_008` · composed

Odelia shifts her grip. The crate settles between them instead of against one shoulder.

**Checkpoint:** `tl_a1_after_gate_done`

## tl_a1_fork — Two Roads, One Delivery

Mekân: `tl_salt_fork` · Kaynak: `new_authored_expansion`

Amaç: Kalıcı rota kararı; iki yol aynı canon kıyı sahnesine birleşir.

**Sahne yönergesi:** A salt-stained sign points toward the coast. Wheel tracks climb away through the sheds. Route previews stay visible until chosen.

**Odelia** · `tl_a1_fork_001` · focused

The coast path bends below the watch posts. You can see far. So can anything waiting there.

**Tilda** · `tl_a1_fork_002` · focused

The load road has shelter, but no room to step aside. We will need to keep the front steady.

**Kera** · `tl_a1_fork_003` · focused

Both reach the villages?

**Odelia** · `tl_a1_fork_004` · calm

Yes. They meet before the harbor.

**Iona** · `tl_a1_fork_005` · gentle

Then we are choosing how to arrive. Not who gets medicine.

**Kera** · `tl_a1_fork_006` · wry

A mercifully sensible map.

**Odelia** · `tl_a1_fork_007` · quiet

It is not the map that will carry the crates.

### Seçim: Choose the delivery route.

Kayıt alanı: `route`. Her dal kendi repliklerinden sonra sahne sonuna birleşir.

#### Take the coast path — rear-line threats. — `tl_route_coast`

Seçim önizlemesi: Two battles emphasizing rear-line threats and target priority. Odelia leads.

**Odelia** · `tl_a1_fork_008` · focused

Single file at the open bend. Watch the sea wall, not the water.

**Tilda** · `tl_a1_fork_009` · dry

Tell that to the water when it comes over the wall.

**Kera** · `tl_a1_fork_010` · wry

If the water has a complaint, it may submit it in writing.

**Iona** · `tl_a1_fork_011` · gentle

I will keep the cloth over the glass.

#### Take the old load road — sustained front-line pressure. — `tl_route_load`

Seçim önizlemesi: Two battles emphasizing front-line pressure and recovery. Tilda and Iona lead.

**Tilda** · `tl_a1_fork_012` · focused

Stay close enough to pass the kit. Far enough that one fallen crate does not stop all of us.

**Odelia** · `tl_a1_fork_013` · focused

I will check the shed doors before we reach them.

**Kera** · `tl_a1_fork_014` · focused

Nothing leaves the crates until we find a dry place.

**Iona** · `tl_a1_fork_015` · gentle

Then we make one if we need it.

**Checkpoint:** `tl_a1_fork_done`



---

# İki Etiket — Akt 2: tam sahne scriptleri

Oyuncu metni İngilizce. Yeni ekler yaratıcı taslak; canon sahneler birebir kaynak kopyasıdır.
Sahne numarası okuma sırasıdır; gerçek oynatma sırası akış grafiğinden gelir. Rota ve seçim dalları açıkça işaretlidir.

## tl_a2_coast_wall — Below the Sea Wall

Mekân: `tl_coast_path` · Kaynak: `new_authored_expansion`

Amaç: B02C: arka sıra baskısı; kaynak düşmanların yeni taktik düzeni.

**Sahne yönergesi:** The water is far below. On the wall above, dead figures turn toward the movement of the covered crates.

**Narration** · `tl_a2_coast_wall_001` · composed

The coast road smells of wet rope. A line of dead figures stands where the watch used to change hands.

**Odelia** · `tl_a2_coast_wall_002` · serious

Do not bunch up under the wall.

**Kera** · `tl_a2_coast_wall_003` · focused

They are looking at the crates.

**Odelia** · `tl_a2_coast_wall_004` · focused

They are looking at the movement. Keep our back line away from the opening.

**Tilda** · `tl_a2_coast_wall_005` · dry

I preferred them when they were looking at nothing.

**Iona** · `tl_a2_coast_wall_006` · calm

There is a flat place behind us. We can set the load down there.

**Odelia** · `tl_a2_coast_wall_007` · focused

One of them is already leaning past the others. That is the threat to watch.

**Kera** · `tl_a2_coast_wall_008` · focused

Then we stop it leaning any farther.

**Checkpoint:** `tl_a2_coast_wall_done`

## tl_a2_coast_steps — The Steps That Remain

Mekân: `tl_coast_path` · Kaynak: `new_authored_expansion`

Amaç: Odelia’nın liman aidiyeti; kardeşinin adı, akıbeti veya companion gizemi açılmaz.

**Sahne yönergesi:** The cleared watch steps pass an old bread-stall alcove. A shutter is closed; no new clue about Tomas is visible.

**Narration** · `tl_a2_coast_steps_001` · composed

Past the wall, Odelia slows beside three narrow steps worn hollow at the edges.

**Kera** · `tl_a2_coast_steps_002` · curious

A bad footing?

**Odelia** · `tl_a2_coast_steps_003` · quiet

No. I know these steps.

**Tilda** · `tl_a2_coast_steps_004` · calm

We can stop for a breath.

**Odelia** · `tl_a2_coast_steps_005` · hesitant

I was only checking the shutter.

**Iona** · `tl_a2_coast_steps_006` · gentle

Then we will wait while you check it.

**Narration** · `tl_a2_coast_steps_007` · composed

Odelia touches the edge of the shutter, where an old latch has been moved twice.

**Odelia** · `tl_a2_coast_steps_008` · quiet

People used to leave bread here to cool. Even when they knew someone would take it.

**Kera** · `tl_a2_coast_steps_009` · quiet

That sounds like a poor arrangement for bread.

**Odelia** · `tl_a2_coast_steps_010` · small_smile

It was a good arrangement for us.

**Tilda** · `tl_a2_coast_steps_011` · dry

Then we should arrive before the next batch is cold.

**Narration** · `tl_a2_coast_steps_012` · composed

Odelia moves on. Nobody asks her to turn the memory into an explanation.

**Checkpoint:** `tl_a2_coast_steps_done`

## tl_a2_coast_turn — The Blind Turn

Mekân: `tl_coast_path` · Kaynak: `new_authored_expansion`

Amaç: B03C: erken görünür öncelik problemi; oyuncu iki hedefi nasıl sıralayacağını seçer.

**Sahne yönergesi:** Salt nets and a low wall break sightlines. The threat is shown before deployment, not hidden behind a surprise attack.

**Odelia** · `tl_a2_coast_turn_001` · serious

The road looks straight. It turns behind those nets.

**Kera** · `tl_a2_coast_turn_002` · focused

Can we take the crates around the other side?

**Odelia** · `tl_a2_coast_turn_003` · focused

No. But we can see what is waiting before it sees all of us.

**Iona** · `tl_a2_coast_turn_004` · calm

I will stand where the others can see the lantern.

**Tilda** · `tl_a2_coast_turn_005` · focused

Nobody runs after a target around the wall alone.

**Narration** · `tl_a2_coast_turn_006` · composed

A staff drags against stone. Beyond it, a small iron bell knocks against a dead chest.

**Odelia** · `tl_a2_coast_turn_007` · focused

Two kinds of movement. The bell draws attention. The staff reaches past it.

**Kera** · `tl_a2_coast_turn_008` · focused

Then attention is not our only problem.

**Checkpoint:** `tl_a2_coast_turn_done`

## tl_a2_coast_arrival — A Place to Put It Down

Mekân: `tl_harbor_square` · Kaynak: `new_authored_expansion`

Amaç: Kıyı rotası karakter payoff’u; ortak canon sahnesine geçiş.

**Sahne yönergesi:** The route opens into the harbor. Odelia finds a dry bench for the crates without asking permission to recognize her own road.

**Odelia** · `tl_a2_coast_arrival_001` · calm

Here. Above the splash line.

**Kera** · `tl_a2_coast_arrival_002` · focused

You knew where that would be.

**Odelia** · `tl_a2_coast_arrival_003` · hesitant

The sea usually leaves the same things alone.

**Tilda** · `tl_a2_coast_arrival_004` · dry

Useful. Unlike people.

**Iona** · `tl_a2_coast_arrival_005` · gentle

The handle is yours again. We can lower it together.

**Narration** · `tl_a2_coast_arrival_006` · composed

The crates touch the bench with a single dull knock.

**Odelia** · `tl_a2_coast_arrival_007` · small_smile

I thought I would want to walk past all of it.

**Kera** · `tl_a2_coast_arrival_008` · quiet

We still need a guide who knows where to stop.

**Odelia** · `tl_a2_coast_arrival_009` · calm

Then stop here.

**Checkpoint:** `tl_a2_coast_arrival_done`

## tl_a2_load_sheds — Between the Salt Sheds

Mekân: `tl_load_road` · Kaynak: `new_authored_expansion`

Amaç: B02L: iki ön sıra tehdidi ve devam eden baskı; hızlı öldürme tek çözüm değil.

**Sahne yönergesi:** Collapsed sheds compress the road to a single lane. The front line can see the coming pressure clearly.

**Narration** · `tl_a2_load_sheds_001` · composed

The old load road is quiet until a cart wheel begins to turn without a horse.

**Odelia** · `tl_a2_load_sheds_002` · focused

The far door is open. Something has been dragging the cart in and out.

**Tilda** · `tl_a2_load_sheds_003` · focused

Keep a clear space behind our front line. I need to reach them.

**Kera** · `tl_a2_load_sheds_004` · focused

We could push straight through.

**Tilda** · `tl_a2_load_sheds_005` · dry

You could. Then I would have to collect you.

**Iona** · `tl_a2_load_sheds_006` · calm

There is enough room to hold here and pass the load back.

**Odelia** · `tl_a2_load_sheds_007` · serious

The nearest dead will reach us first. The ones behind it cannot pass unless we give them space.

**Kera** · `tl_a2_load_sheds_008` · focused

Then we do not give them space.

**Checkpoint:** `tl_a2_load_sheds_done`

## tl_a2_load_cloth — A Dry Fold

Mekân: `tl_load_road` · Kaynak: `new_authored_expansion`

Amaç: Tilda’nın dürüst bakım anlayışı; eski teacher/clinic companion sahnesini yeniden anlatmaz.

**Sahne yönergesi:** In the lee of a shed, Tilda replaces wet outer cloth. A sheltered pause is practical rather than a second clinic origin story.

**Narration** · `tl_a2_load_cloth_001` · composed

Tilda shakes rain from her cape before she touches the field kit.

**Kera** · `tl_a2_load_cloth_002` · focused

That is our last clean outer cloth.

**Tilda** · `tl_a2_load_cloth_003` · dry

No. That is the cloth you put on top. The clean one is still inside.

**Kera** · `tl_a2_load_cloth_004` · annoyed

I know what I packed.

**Iona** · `tl_a2_load_cloth_005` · gentle

You both packed it.

**Narration** · `tl_a2_load_cloth_006` · composed

For a moment only the rain speaks.

**Tilda** · `tl_a2_load_cloth_007` · quiet

People see a healer arrive and think the waiting is finished.

**Kera** · `tl_a2_load_cloth_008` · quiet

We have brought the treatment.

**Tilda** · `tl_a2_load_cloth_009` · focused

Yes. We still have to ask, examine, explain, and stay long enough to notice trouble.

**Iona** · `tl_a2_load_cloth_010` · calm

Arriving is the first useful thing. It is not the only one.

**Kera** · `tl_a2_load_cloth_011` · quiet

Then we keep enough cloth for the last patient, too.

**Narration** · `tl_a2_load_cloth_012` · composed

Tilda gives her the dry fold. This time Kera puts it where someone else can reach it.

**Checkpoint:** `tl_a2_load_cloth_done`

## tl_a2_load_cart — The Cart with No Driver

Mekân: `tl_load_road` · Kaynak: `new_authored_expansion`

Amaç: B03L: savunma/iyileştirme kaynaklarını yönetme; yaşayan NPC savaş slotu değildir.

**Sahne yönergesi:** An overturned cart blocks a shallow cut. A living carter waits behind a roof beam; the enemies are visible in the lane, not holding a hostage.

**Carter** · `tl_a2_load_cart_001` · worried

Do not come through the middle. That wheel drops when you touch it.

**Odelia** · `tl_a2_load_cart_002` · focused

We can use the side, one at a time.

**Tilda** · `tl_a2_load_cart_003` · focused

Are you hurt?

**Carter** · `tl_a2_load_cart_004` · worried

Just waiting. They came down from the sheds. I got behind the beam.

**Iona** · `tl_a2_load_cart_005` · calm

Stay where you have cover. We will clear the lane.

**Kera** · `tl_a2_load_cart_006` · focused

Someone is turning that wheel from the other side.

**Odelia** · `tl_a2_load_cart_007` · serious

Two ahead. The others are following the noise.

**Tilda** · `tl_a2_load_cart_008` · focused

We hold the front while the load gets through. Do not spend everything in the first exchange.

**Checkpoint:** `tl_a2_load_cart_done`

## tl_a2_load_arrival — The Road Opens

Mekân: `tl_harbor_square` · Kaynak: `new_authored_expansion`

Amaç: Yük rotası güven sorusunu kurar; ortak canon kıyı sahnesine geçiş.

**Sahne yönergesi:** The carter has a clear road. The group carries the medicine the last distance on foot; no escort mission teleports a patient into the battle.

**Carter** · `tl_a2_load_arrival_001` · relieved

You could have left the cart. You had your own load.

**Tilda** · `tl_a2_load_arrival_002` · dry

The cart is still there. We helped the person.

**Iona** · `tl_a2_load_arrival_003` · gentle

Wait until the wheel is braced before you move it.

**Odelia** · `tl_a2_load_arrival_004` · focused

The harbor is past that low roof. I will show you the dry path.

**Narration** · `tl_a2_load_arrival_005` · composed

The carter nods toward the covered crates.

**Carter** · `tl_a2_load_arrival_006` · curious

Medicine?

**Kera** · `tl_a2_load_arrival_007` · focused

For the salt fever. No charge.

**Carter** · `tl_a2_load_arrival_008` · quiet

Then people will want to know why.

**Tilda** · `tl_a2_load_arrival_009` · quiet

Yes. They will.

**Narration** · `tl_a2_load_arrival_010` · composed

The road widens. This time nobody has to walk behind the load.

**Checkpoint:** `tl_a2_load_arrival_done`



---

# İki Etiket — Akt 3: tam sahne scriptleri

Oyuncu metni İngilizce. Yeni ekler yaratıcı taslak; canon sahneler birebir kaynak kopyasıdır.
Sahne numarası okuma sırasıdır; gerçek oynatma sırası akış grafiğinden gelir. Rota ve seçim dalları açıkça işaretlidir.

## event_guild_salt_fever_2 — The Coast Road

Mekân: `salt_road_coast` · Kaynak: `canon_verbatim`

Amaç: Mevcut kıyı sahnesi: Tilda’nın öğrenimi, Odelia’nın fırın anısı, Iona’nın cevabı aynen.

**Sahne yönergesi:** The salt villages. Tilda treats patients; Odelia guides them through her old harbor.

**Tilda** · `event_guild_salt_fever_2_001` · reflective

This is where I learned. My teacher treated this fever with salt and honesty.

**Odelia** · `event_guild_salt_fever_2_002` · small_smile

My brother and I stole bread from that bakery.

**Iona** · `event_guild_salt_fever_2_003` · gentle

Then we will pay it back with medicine.

**Checkpoint:** `event_guild_salt_fever_2_done`

## tl_a3_bakery — The Bakery Door

Mekân: `tl_clinic_table` · Kaynak: `new_authored_expansion`

Amaç: Yeni sıradan NPC rolü; yeni Guild patronu ve başka kan örneği olay örgüsü yok.

**Sahne yönergesi:** A baker opens a dry side room. Their face is not a new permanent character portrait; a nameplate and an empty table are sufficient.

**Baker** · `tl_a3_bakery_001` · guarded

You can use the side room. The table is clean enough for bread. I do not know about medicine.

**Tilda** · `tl_a3_bakery_002` · focused

Then we clean it once more. Thank you.

**Odelia** · `tl_a3_bakery_003` · hesitant

We will not need the ovens.

**Baker** · `tl_a3_bakery_004` · dry

Good. They are occupied.

**Narration** · `tl_a3_bakery_005` · composed

The baker notices Odelia's cap, then looks back at the crates. Recognition is left unspoken.

**Baker** · `tl_a3_bakery_006` · guarded

A free bottle usually comes with a second question.

**Kera** · `tl_a3_bakery_007` · focused

Mine comes with instructions.

**Baker** · `tl_a3_bakery_008` · serious

And after the instructions?

**Iona** · `tl_a3_bakery_009` · gentle

You may ask us something. You do not owe us an answer.

**Tilda** · `tl_a3_bakery_010` · focused

Nobody is giving a blood sample, signing a debt, or promising a favor for this treatment.

**Kera** · `tl_a3_bakery_011` · quiet

I will write that down.

**Baker** · `tl_a3_bakery_012` · quiet

Write it where the next person can see it.

**Checkpoint:** `tl_a3_bakery_done`

## tl_a3_questions — A Line for Questions

Mekân: `tl_clinic_table` · Kaynak: `new_authored_expansion`

Amaç: İki eşit sosyal dal; seçimin final öncesi kısa karşılığı bulunur, güven sayacı yok.

**Sahne yönergesi:** Kera places two labels side by side: a short formula label and a clear public label. No readable recipe gives real medical instructions.

**Kera** · `tl_a3_questions_001` · focused

The label is correct.

**Tilda** · `tl_a3_questions_002` · dry

You have told the bottle. Tell the person.

**Kera** · `tl_a3_questions_003` · annoyed

Dose, contents, maker. What else?

**Iona** · `tl_a3_questions_004` · gentle

What they may ask before they take it.

**Odelia** · `tl_a3_questions_005` · quiet

And whether they can say no.

**Kera** · `tl_a3_questions_006` · quiet

Fine. I am adding a line.

**Patient** · `tl_a3_questions_007` · worried

Will you tell us what is in it, or just tell us it works?

**Narration** · `tl_a3_questions_008` · composed

Kera takes her hand off the nearest bottle. There is room for the question on the table.

### Seçim: How should the group begin?

Kayıt alanı: `approach`. Her dal kendi repliklerinden sonra sahne sonuna birleşir.

#### Show the sealed supplies and explain. — `tl_approach_show`

Seçim önizlemesi: The villagers can inspect the preparation. No medicine is taken without agreement.

**Kera** · `tl_a3_questions_009` · focused

You may watch from that side of the table. These stay sealed until Tilda needs them.

**Tilda** · `tl_a3_questions_010` · dry

That means she is pleased you asked.

**Kera** · `tl_a3_questions_011` · annoyed

It means the table has sides for a reason.

**Iona** · `tl_a3_questions_012` · gentle

Ask us to stop if something is unclear.

**Patient** · `tl_a3_questions_013` · quiet

Can the others watch too?

**Kera** · `tl_a3_questions_014` · quiet

Yes. Leave room for the person being treated.

**Odelia** · `tl_a3_questions_015` · calm

I will move the bench where they can see.

#### Ask what worries them first. — `tl_approach_listen`

Seçim önizlemesi: The villagers can question the offer before deciding. No medicine is taken without agreement.

**Iona** · `tl_a3_questions_016` · gentle

What would you like to know first?

**Patient** · `tl_a3_questions_017` · worried

Why does the same Guild sell one bottle and give away another?

**Kera** · `tl_a3_questions_018` · quiet

We are the archive wing. We made these, and we are responsible for what we brought.

**Tilda** · `tl_a3_questions_019` · focused

You are right to ask. We will answer what we know and say when we do not.

**Iona** · `tl_a3_questions_020` · calm

You can keep asking after the bottles are gone.

**Kera** · `tl_a3_questions_021` · wry

Preferably before I pack the table.

**Odelia** · `tl_a3_questions_022` · small_smile

The table stays here.

**Checkpoint:** `tl_a3_questions_done`

## tl_a3_boundary — A Lantern at the Boundary

Mekân: `tl_harbor_square` · Kaynak: `new_authored_expansion`

Amaç: B04; hazırlık iki encounter varyantından birini seçer, NPC’ler savaşta hedef olamaz.

**Sahne yönergesi:** While patients wait safely inside, the group checks the next delivery lane. A safe barrier separates the clinic from the enemies.

**Odelia** · `tl_a3_boundary_001` · serious

The next lane is not clear. The dead are turning at the net racks.

**Tilda** · `tl_a3_boundary_002` · focused

The people inside stay inside. We do not carry the queue into this.

**Kera** · `tl_a3_boundary_003` · focused

There is one crate left for the far end of the harbor.

**Iona** · `tl_a3_boundary_004` · calm

It stays behind the door until we can carry it safely.

**Odelia** · `tl_a3_boundary_005` · focused

We will need room behind the front line. If they reach the turn, they will spread along it.

**Tilda** · `tl_a3_boundary_006` · focused

Check the kit before we step out. Recovery matters more than looking fast.

**Kera** · `tl_a3_boundary_007` · focused

And if we surveyed the approach, we use what we saw.

**Narration** · `tl_a3_boundary_008` · composed

Iona hangs the lantern where both the door and the turn remain visible.

**Iona** · `tl_a3_boundary_009` · calm

A boundary. Not a lure.

**Checkpoint:** `tl_a3_boundary_done`

## tl_a3_after_boundary — The Door Stays Open

Mekân: `tl_clinic_table` · Kaynak: `new_authored_expansion`

Amaç: Başarıyla gelen güven; başka köye yetişememe veya süreli hasta ölümü sistemi yok.

**Sahne yönergesi:** The lane is clear. Tilda checks a waiting patient; the public scene continues regardless of optional battle mastery.

**Narration** · `tl_a3_after_boundary_001` · composed

The lantern returns to its hook. The people inside have not moved from the dry benches.

**Patient** · `tl_a3_after_boundary_002` · worried

Did we make you stay longer?

**Tilda** · `tl_a3_after_boundary_003` · focused

You did not make the road unsafe.

**Kera** · `tl_a3_after_boundary_004` · quiet

We knew where we were taking the crates.

**Iona** · `tl_a3_after_boundary_005` · gentle

Now we have room to finish the work.

**Odelia** · `tl_a3_after_boundary_006` · calm

The far lane is clear as well. I checked it on the way back.

**Tilda** · `tl_a3_after_boundary_007` · dry

Then sit down for one minute before you check it again.

**Odelia** · `tl_a3_after_boundary_008` · hesitant

I can still see it from the door.

**Kera** · `tl_a3_after_boundary_009` · wry

A remarkable compromise. Take it.

**Checkpoint:** `tl_a3_after_boundary_done`



---

# İki Etiket — Akt 4: tam sahne scriptleri

Oyuncu metni İngilizce. Yeni ekler yaratıcı taslak; canon sahneler birebir kaynak kopyasıdır.
Sahne numarası okuma sırasıdır; gerçek oynatma sırası akış grafiğinden gelir. Rota ve seçim dalları açıkça işaretlidir.

## tl_a4_last_lane — The Last Delivery

Mekân: `tl_harbor_lane` · Kaynak: `new_authored_expansion`

Amaç: B05 sentez: ön baskı + arka tehdit; satıcıyla fiziksel boss savaşı yok.

**Sahne yönergesi:** A narrow lane leads to the outer salt-workers’ shelter. The final visible group of dead blocks the passage; no vendor is commanding them.

**Narration** · `tl_a4_last_lane_001` · composed

The last crate is lighter. The road to put it down is not.

**Odelia** · `tl_a4_last_lane_002` · focused

They are caught between the wall and the racks. We cannot carry past them.

**Kera** · `tl_a4_last_lane_003` · focused

The people beyond this lane have been waiting since before we arrived.

**Tilda** · `tl_a4_last_lane_004` · focused

Then we do this carefully. They do not need a broken crate arriving first.

**Iona** · `tl_a4_last_lane_005` · calm

It is on dry ground. We can leave it here until the way is clear.

**Odelia** · `tl_a4_last_lane_006` · serious

The bell draws them together. The others reach through the gaps. Do not chase the sound without looking at the hands.

**Kera** · `tl_a4_last_lane_007` · focused

We have crossed two roads and kept every stopper in place.

**Tilda** · `tl_a4_last_lane_008` · dry

That was the easy part. One more clear passage.

**Checkpoint:** `tl_a4_last_lane_done`

## tl_a4_delivery_done — Nothing Owed

Mekân: `tl_harbor_lane` · Kaynak: `new_authored_expansion`

Amaç: Genel, kurgusal bakım; gerçek doz/tıbbi tarif yok. Ödül vaatleri diyalogda geçmez.

**Sahne yönergesi:** The passage is clear. A crate rests beside a dry door; the group hands over explanations and stays for questions.

**Patient** · `tl_a4_delivery_done_001` · quiet

What do you need from us?

**Kera** · `tl_a4_delivery_done_002` · focused

A dry place for the unopened bottles. Someone to read the instructions with Tilda.

**Patient** · `tl_a4_delivery_done_003` · worried

I meant in return.

**Iona** · `tl_a4_delivery_done_004` · gentle

You may tell the next person where to find us. You do not have to.

**Tilda** · `tl_a4_delivery_done_005` · focused

Ask for help if the fever does not ease or anything gets worse. Do not wait because the bottle was free.

**Odelia** · `tl_a4_delivery_done_006` · calm

The path to the bakery is clear.

**Narration** · `tl_a4_delivery_done_007` · composed

The patient takes the written directions before the bottle. Kera notices, and leaves both within reach.

**Kera** · `tl_a4_delivery_done_008` · quiet

There. No second price.

**Checkpoint:** `tl_a4_delivery_done_done`

## tl_a4_echo_show — What They Saw

Mekân: `tl_clinic_table` · Kaynak: `new_authored_expansion`

Amaç: Show dalı geri dönüşü; ortak mevcut satıcı sahnesine bağlanır.

**Sahne yönergesi:** A patient recalls the inspected supplies. This is the payoff of showing, not a superior trust outcome.

**Patient** · `tl_a4_echo_show_001` · quiet

I told the people at the shelter we saw the sealed crates opened.

**Kera** · `tl_a4_echo_show_002` · focused

Good. Tell them they may ask to see the next one, too.

**Tilda** · `tl_a4_echo_show_003` · dry

And that the table has sides. That part is apparently important.

**Odelia** · `tl_a4_echo_show_004` · small_smile

They moved the bench without being asked.

**Iona** · `tl_a4_echo_show_005` · gentle

They knew what they wanted to see.

**Narration** · `tl_a4_echo_show_006` · composed

On the table, the explanation has more fingerprints than the bottle.

**Checkpoint:** `tl_a4_echo_show_done`

## tl_a4_echo_listen — What They Asked

Mekân: `tl_clinic_table` · Kaynak: `new_authored_expansion`

Amaç: Listen dalı geri dönüşü; ortak mevcut satıcı sahnesine bağlanır.

**Sahne yönergesi:** A patient repeats an answered question. This is the payoff of listening, not a superior trust outcome.

**Patient** · `tl_a4_echo_listen_001` · quiet

Someone at the shelter asked me what you wanted in return. I knew what to say.

**Iona** · `tl_a4_echo_listen_002` · gentle

And if they have another question, they can come here.

**Kera** · `tl_a4_echo_listen_003` · focused

Or write it. We have room left on the paper.

**Tilda** · `tl_a4_echo_listen_004` · dry

She checked. Twice.

**Odelia** · `tl_a4_echo_listen_005` · small_smile

They brought the bench closer so they could hear.

**Narration** · `tl_a4_echo_listen_006` · composed

On the table, the question has left a small crease in the paper. Kera does not flatten it away.

**Checkpoint:** `tl_a4_echo_listen_done`

## event_guild_salt_fever_3 — Two Labels

Mekân: `salt_road_coast` · Kaynak: `canon_verbatim`

Amaç: Mevcut satıcı sahnesi aynen: iki etiket, şişelerin seçilmesi ve satıcının ayrılması.

**Sahne yönergesi:** A ledger-wing agent arrives selling the same cure at ten times the price.

**Ledger Agent** · `event_guild_salt_fever_3_001` · cold

You are ruining a market, alchemist.

**Kera** · `event_guild_salt_fever_3_002` · fierce

I am labeling it correctly. Yours says "cure". Mine says "cure, free, and the name of who made it".

**Narration** · `event_guild_salt_fever_3_003` · satisfied

The villagers took Kera's bottles. The agent left with a full crate and an empty road.

**Checkpoint:** `event_guild_salt_fever_3_done`

## tl_a4_after_agent — The Paper Left Behind

Mekân: `tl_clinic_table` · Kaynak: `new_authored_expansion`

Amaç: Küçük toplumsal kazanım; satıcı dövülmez, ölüm veya yeni Guild lideri ifşa edilmez.

**Sahne yönergesi:** The agent has gone. Their old sales paper remains beside the public instructions. The group does not turn the departure into a new conspiracy.

**Baker** · `tl_a4_after_agent_001` · quiet

He comes through here often. People know the seal on his paper.

**Kera** · `tl_a4_after_agent_002` · quiet

They should know what is inside the bottle, too.

**Tilda** · `tl_a4_after_agent_003` · focused

And who to find when they have a question.

**Odelia** · `tl_a4_after_agent_004` · hesitant

Do we take his paper down?

**Iona** · `tl_a4_after_agent_005` · calm

It is their wall.

**Narration** · `tl_a4_after_agent_006` · composed

The baker picks up the old sales paper and sets it beside the stove, away from the medicine.

**Baker** · `tl_a4_after_agent_007` · dry

I can find another use for it.

**Kera** · `tl_a4_after_agent_008` · wry

Not the instructions. Those are still useful paper.

**Baker** · `tl_a4_after_agent_009` · small_smile

I noticed.

**Checkpoint:** `tl_a4_after_agent_done`



---

# İki Etiket — Akt 5: tam sahne scriptleri

Oyuncu metni İngilizce. Yeni ekler yaratıcı taslak; canon sahneler birebir kaynak kopyasıdır.
Sahne numarası okuma sırasıdır; gerçek oynatma sırası akış grafiğinden gelir. Rota ve seçim dalları açıkça işaretlidir.

## tl_a5_quiet — The Quiet After Work

Mekân: `tl_clinic_table` · Kaynak: `new_authored_expansion`

Amaç: Tam ve mucizevi tedavi iddiası yok; görev sonu gelecekteki iş ihtiyacını belirler, yeni zorunlu quest açmaz.

**Sahne yönergesi:** Work is winding down. The bottles are not instant miraculous cures; instructions and follow-up arrangements remain beside each delivery.

**Narration** · `tl_a5_quiet_001` · composed

The crates are empty. The benches are not. Tilda speaks quietly to the last person waiting.

**Kera** · `tl_a5_quiet_002` · quiet

They have enough for the next delivery as well.

**Tilda** · `tl_a5_quiet_003` · focused

They have enough treatment for the cases we examined. We return to the archive and check what else is needed.

**Kera** · `tl_a5_quiet_004` · quiet

That is what I meant.

**Tilda** · `tl_a5_quiet_005` · dry

Then put that on the next notice.

**Iona** · `tl_a5_quiet_006` · gentle

I left space beside the instructions for questions to come back with the cart.

**Odelia** · `tl_a5_quiet_007` · quiet

You expect them to ask more?

**Iona** · `tl_a5_quiet_008` · calm

I hope they can.

**Narration** · `tl_a5_quiet_009` · composed

Kera turns a spare label over. For once, she leaves the blank side blank.

**Checkpoint:** `tl_a5_quiet_done`

## tl_a5_coast_memory — A Familiar Step

Mekân: `tl_harbor_square` · Kaynak: `new_authored_expansion`

Amaç: Kıyı rotası final callback’i; Tomas hakkındaki açık soru korunur.

**Sahne yönergesi:** At the edge of the square, Odelia looks back toward the sea-wall steps. This callback plays only for the coast route.

**Odelia** · `tl_a5_coast_memory_001` · quiet

The shutter was not painted the same color.

**Kera** · `tl_a5_coast_memory_002` · curious

On the coast path?

**Odelia** · `tl_a5_coast_memory_003` · hesitant

Yes. I kept looking for something exactly as I left it.

**Iona** · `tl_a5_coast_memory_004` · gentle

You still found the way.

**Odelia** · `tl_a5_coast_memory_005` · quiet

I found somewhere to put the crate down.

**Tilda** · `tl_a5_coast_memory_006` · dry

That was the part the rest of us needed.

**Narration** · `tl_a5_coast_memory_007` · composed

Odelia folds the route sketch along a new crease. The steps still have a place on it.

**Checkpoint:** `tl_a5_coast_memory_done`

## tl_a5_load_memory — Something Still Dry

Mekân: `tl_clinic_table` · Kaynak: `new_authored_expansion`

Amaç: Yük rotası final callback’i; yardımın sürekliliği, sonsuz talep değil.

**Sahne yönergesi:** Tilda folds the unused clean cloth. This callback plays only for the load-road route.

**Kera** · `tl_a5_load_memory_001` · quiet

There is still a clean fold left.

**Tilda** · `tl_a5_load_memory_002` · calm

We kept one. That is different from forgetting to use it.

**Iona** · `tl_a5_load_memory_003` · gentle

The carter offered to bring questions back with the next load.

**Odelia** · `tl_a5_load_memory_004` · calm

He knows where the road is clear now.

**Tilda** · `tl_a5_load_memory_005` · dry

Then he has a useful job. We should not give him six more because he said yes to one.

**Kera** · `tl_a5_load_memory_006` · wry

You have made restraint sound like a packing instruction.

**Narration** · `tl_a5_load_memory_007` · composed

Tilda puts the cloth where the first hand opening the kit will find it.

**Checkpoint:** `tl_a5_load_memory_done`

## tl_a5_bread — Bread, with No Conditions

Mekân: `tl_clinic_table` · Kaynak: `new_authored_expansion`

Amaç: Mevcut fırın anısına küçük karşılık; işlevsel ödül tanımlanmaz.

**Sahne yönergesi:** The baker sets warm bread beside the empty crates, away from the medicine. It is a story prop, not an inventory or reward grant.

**Baker** · `tl_a5_bread_001` · calm

For the road. It was coming out of the oven anyway.

**Odelia** · `tl_a5_bread_002` · hesitant

We can pay for it.

**Baker** · `tl_a5_bread_003` · dry

You can take it before it cools.

**Kera** · `tl_a5_bread_004` · quiet

The medicine was not a bargain for bread.

**Baker** · `tl_a5_bread_005` · quiet

I know. Neither is this.

**Narration** · `tl_a5_bread_006` · composed

Odelia breaks a piece carefully, then passes the larger part to Tilda.

**Tilda** · `tl_a5_bread_007` · dry

Do not choose my portion for me. I have worked very hard to remain difficult.

**Odelia** · `tl_a5_bread_008` · small_smile

Then choose this one.

**Iona** · `tl_a5_bread_009` · gentle

We can eat before we carry the empty crates back.

**Narration** · `tl_a5_bread_010` · composed

For a little while, nobody needs anything explained.

**Checkpoint:** `tl_a5_bread_done`

## tl_a5_company — Before They Leave

Mekân: `tl_harbor_square` · Kaynak: `new_authored_expansion`

Amaç: Dört isteğe bağlı ekip anı. Sonuç değişmez; tümü replay’de okunabilir, ödül bağlanmaz.

**Sahne yönergesi:** The group rests at the dry bench. Choose one brief conversation; all options rejoin the same ending. Other conversations are available in replay.

**Narration** · `tl_a5_company_001` · composed

The road back is clear enough to wait for one conversation.

**Kera** · `tl_a5_company_002` · quiet

We should go before I find something else to label.

**Tilda** · `tl_a5_company_003` · dry

You have already labeled the empty crates.

**Iona** · `tl_a5_company_004` · gentle

Then we have a moment.

### Seçim: Who do you sit beside?

Kayıt alanı: `focus`. Her dal kendi repliklerinden sonra sahne sonuna birleşir.

#### Kera, with the spare label. — `tl_focus_kera`

Seçim önizlemesi: A conversation about making the maker visible.

**Iona** · `tl_a5_company_005` · gentle

You wrote your name larger on the second label.

**Kera** · `tl_a5_company_006` · hesitant

The first one did not have enough room.

**Iona** · `tl_a5_company_007` · calm

You made room.

**Kera** · `tl_a5_company_008` · quiet

If something is wrong, they should know who brought it.

**Tilda** · `tl_a5_company_009` · quiet

And if something is right.

**Kera** · `tl_a5_company_010` · hesitant

That is not what the name is for.

**Odelia** · `tl_a5_company_011` · quiet

It can be for both.

**Narration** · `tl_a5_company_012` · composed

Kera presses the loose label flat against an empty crate. She leaves the name where it can be read.

#### Tilda, beside the folded kit. — `tl_focus_tilda`

Seçim önizlemesi: A conversation about care after arrival.

**Kera** · `tl_a5_company_013` · quiet

You were the first to tell them we would stay for questions.

**Tilda** · `tl_a5_company_014` · focused

People are used to a seller leaving when the bottle changes hands.

**Iona** · `tl_a5_company_015` · gentle

You stayed after the last one did.

**Tilda** · `tl_a5_company_016` · dry

There was still someone on the bench.

**Odelia** · `tl_a5_company_017` · quiet

There is not now.

**Narration** · `tl_a5_company_018` · composed

Tilda looks at the empty place, then puts the kit down instead of checking it again.

**Tilda** · `tl_a5_company_019` · quiet

Good. Then I can sit there.

**Kera** · `tl_a5_company_020` · wry

A practical use for a successful treatment room.

#### Iona, where the lantern is hanging. — `tl_focus_iona`

Seçim önizlemesi: A conversation about help without an obligation.

**Odelia** · `tl_a5_company_021` · hesitant

You let them leave without telling us their names.

**Iona** · `tl_a5_company_022` · gentle

They came for medicine. We were not registering them for a journey.

**Kera** · `tl_a5_company_023` · quiet

Some stayed and asked to write it down anyway.

**Iona** · `tl_a5_company_024` · calm

Then they chose something to leave with us.

**Tilda** · `tl_a5_company_025` · dry

The baker chose bread. A sound decision.

**Odelia** · `tl_a5_company_026` · quiet

It felt different when nobody asked for it first.

**Iona** · `tl_a5_company_027` · gentle

Yes.

**Narration** · `tl_a5_company_028` · composed

Iona lifts the lantern from its hook. Its light falls on the bread before the road.

#### Odelia, with the folded route sketch. — `tl_focus_odelia`

Seçim önizlemesi: A conversation about being useful in a familiar place.

**Kera** · `tl_a5_company_029` · quiet

You got us here.

**Odelia** · `tl_a5_company_030` · hesitant

I knew the roads.

**Tilda** · `tl_a5_company_031` · dry

Roads rarely carry their own crates.

**Iona** · `tl_a5_company_032` · gentle

You showed us where to wait, too.

**Odelia** · `tl_a5_company_033` · quiet

I thought coming back would mean answering questions I cannot answer.

**Kera** · `tl_a5_company_034` · quiet

You answered the ones we needed today.

**Odelia** · `tl_a5_company_035` · small_smile

Then I can show you the way back.

**Narration** · `tl_a5_company_036` · composed

She folds the sketch without hiding it beneath the crate.

**Checkpoint:** `tl_a5_company_done`

## tl_a5_end — Room on the Notice

Mekân: `tl_salt_fork` · Kaynak: `new_authored_expansion`

Amaç: Ortak bitiş; event completed burada yazılır. Ana hikâye ve diğer görevler etkilenmez.

**Sahne yönergesi:** At the fork on the return, all four carry the empty crates. No named villain, royal secret, or cure for Fadyme is revealed.

**Odelia** · `tl_a5_end_001` · calm

The turn is clear. We can stay together on the way back.

**Kera** · `tl_a5_end_002` · focused

The next notice needs a place for questions.

**Tilda** · `tl_a5_end_003` · dry

And a place for whoever answers them to sit down.

**Iona** · `tl_a5_end_004` · gentle

We can leave both.

**Kera** · `tl_a5_end_005` · wry

It will be a very large notice.

**Narration** · `tl_a5_end_006` · composed

The crates knock gently as they walk. Paper labels remain tied to their handles.

**Odelia** · `tl_a5_end_007` · quiet

Do we take those off?

**Kera** · `tl_a5_end_008` · quiet

No. They still say who brought them.

**Narration** · `tl_a5_end_009` · composed

Nothing about the road has become easy. It is only easier to know whom to ask.

**Checkpoint:** `tl_a5_end_done`
