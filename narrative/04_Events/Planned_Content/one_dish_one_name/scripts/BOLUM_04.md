# Bir Tabak, Bir İsim — Bölüm 4: Bir Kâse İçin

Yeni metinler yaratıcı genişletmedir; canon sahneler kaynak kopyasıdır. Oyuncu metni İngilizce.

## event_harvest_inn_meal_2 — The Inn Meal

Mekân: `oakhaven_inn` · `canon_verbatim`

Amaç: Kaynak Inn Meal sahnesinin beş repliği aynen; Fadyme/Mahmut yerleşmiş canon varlığı korunur.

**Sahne yönergesi:** The innkeeper explains why every traveler gets a free meal twice a day.

**Innkeeper** · `event_harvest_inn_meal_2_001` · warm

After Crownfall, travelers stopped paying. So we stopped charging. Twice a day, a meal, no coin.

**Fadyme** · `event_harvest_inn_meal_2_002` · touched

That is generous.

**Innkeeper** · `event_harvest_inn_meal_2_003` · wry

It is practical. A fed traveler says their name at the door. A hungry one slips past the register.

**Mahmut** · `event_harvest_inn_meal_2_004` · observant

So the meal is a count.

**Innkeeper** · `event_harvest_inn_meal_2_005` · laughing

The meal is a meal, knight. The count is a bonus.

**Checkpoint:** `event_harvest_inn_meal_2_done`

## od_a4_gap — An Empty Place

Mekân: `oakhaven_inn` · `new_authored_expansion`

Amaç: İki eşit yaklaşım; isim sunmak ile hikâyesini sahnede anlatmaya zorlamak ayrılır.

**Sahne yönergesi:** A guest pauses near a remaining seat. Bowls are being served, and the guest has offered a name without a public story.

**Guest** · `od_a4_gap_001` · hesitant

I can say a name. I do not think I can sing it in front of everyone.

**Pippa** · `od_a4_gap_002` · gentle

Speaking is allowed to remain speaking.

**Jori** · `od_a4_gap_003` · calm

This seat is steady.

**Nixie** · `od_a4_gap_004` · bright

That is Jori's highest recommendation.

**Fadyme** · `od_a4_gap_005` · gentle

You can sit before deciding how loud to be.

**Mahmut** · `od_a4_gap_006` · calm

There is room to pass behind the chair.

**Narration** · `od_a4_gap_007` · composed

The guest touches the back of the chair, then looks toward the open square.

### Seçim — How should the company make room?

Kayıt alanı: `welcome`

#### Invite them into the table conversation. — `od_welcome_join`

Önizleme: A gentle invitation; the guest may still decline the song.

**Pippa** · `od_a4_gap_008` · bright

We are comparing the chairs. You can help us settle the matter.

**Jori** · `od_a4_gap_009` · dry

There is no matter. They are all chairs.

**Nixie** · `od_a4_gap_010` · wry

That is one side of the argument.

**Guest** · `od_a4_gap_011` · small_smile

This one is a very good chair.

**Fadyme** · `od_a4_gap_012` · wry

A decisive answer.

#### Keep them company without asking for a story. — `od_welcome_quiet`

Önizleme: A quiet seat; joining the song remains their decision.

**Fadyme** · `od_a4_gap_013` · gentle

I will sit here for a moment.

**Guest** · `od_a4_gap_014` · quiet

You do not have to.

**Fadyme** · `od_a4_gap_015` · calm

I know. I would like to.

**Mahmut** · `od_a4_gap_016` · calm

I will bring the bread within reach.

**Narration** · `od_a4_gap_017` · composed

The guest sits. The silence does not ask them to fill it.

**Checkpoint:** `od_a4_gap_done`

## od_a4_join_echo — A Small Argument

Mekân: `oakhaven_square` · `new_authored_expansion`

Amaç: Join tercihi callback’i; ortak Last Song sahnesine bağlanır.

**Sahne yönergesi:** The earlier invited guest comes to the square beside the company. Nobody asks them to lead.

**Guest** · `od_a4_join_echo_001` · small_smile

Are you still arguing about the chairs?

**Nixie** · `od_a4_join_echo_002` · bright

We have moved on to bowls.

**Jori** · `od_a4_join_echo_003` · dry

There is still no argument.

**Pippa** · `od_a4_join_echo_004` · gentle

Stay here if you like. The song starts from wherever you are standing.

**Narration** · `od_a4_join_echo_005` · composed

The guest stays close enough to hear a familiar voice.

**Checkpoint:** `od_a4_join_echo_done`

## od_a4_quiet_echo — A Place beside the Noise

Mekân: `oakhaven_square` · `new_authored_expansion`

Amaç: Quiet tercihi callback’i; ortak Last Song sahnesine bağlanır.

**Sahne yönergesi:** The quiet guest approaches the edge of the square. Fadyme does not turn their presence into a confession.

**Guest** · `od_a4_quiet_echo_001` · quiet

I thought I might listen from here.

**Fadyme** · `od_a4_quiet_echo_002` · gentle

It is a good place to listen.

**Mahmut** · `od_a4_quiet_echo_003` · calm

Nobody needs to move closer.

**Pippa** · `od_a4_quiet_echo_004` · gentle

If you want to join, you will hear where your line belongs.

**Narration** · `od_a4_quiet_echo_005` · composed

The guest keeps the space they chose. The song can reach it.

**Checkpoint:** `od_a4_quiet_echo_done`
