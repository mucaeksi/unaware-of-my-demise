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
