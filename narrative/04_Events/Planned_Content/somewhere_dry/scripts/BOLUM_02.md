# Kuru Bir Yer — Bölüm 2: Okunabilen ve Bilinen

Yeni metinler yaratıcı genişletmedir; canon sahneler kaynak kopyasıdır. Oyuncu metni İngilizce.

## dr_a2_shelf_1 — Page Numbers Outward

Mekân: `dr_dry_room` · `new_authored_expansion`

Amaç: Shelf dalı 1; düzen ile kişiye erişim birlikte.

**Sahne yönergesi:** Mirel moves ordinary slips in their existing order; the cathedral archive as a whole remains damaged.

**Mirel** · `dr_a2_shelf_1_001` · focused

This stack stays in order. A dry mistake is still a mistake.

**Aveline** · `dr_a2_shelf_1_002` · warm

I have brought a cloth for the bench, not the book.

**Mirel** · `dr_a2_shelf_1_003` · quiet

Thank you. The book is not the only thing waiting here.

**Narration** · `dr_a2_shelf_1_004` · composed

The carrier settles close enough to see the slips being moved.

**Carrier** · `dr_a2_shelf_1_005` · relieved

I can recognize mine from here.

**Mirel** · `dr_a2_shelf_1_006` · precise

Good. Recognition is useful evidence. We will keep it beside the page number.

**Checkpoint:** `dr_a2_shelf_1_done`

## dr_a2_shelf_2 — Room beside the Shelf

Mekân: `dr_dry_room` · `new_authored_expansion`

Amaç: Shelf dalı 2; ana arşiv kraliyet sayfası kurutulmaz.

**Sahne yönergesi:** Aveline checks the access path. No candle-count scene is repeated.

**Aveline** · `dr_a2_shelf_2_001` · focused

This crate goes behind the bench. Nobody should have to step over it to reach the shelf.

**Mirel** · `dr_a2_shelf_2_002` · wry

An excellent shelving rule. I wish more scribes had feet.

**Carrier** · `dr_a2_shelf_2_003` · hesitant

I could hold the stack.

**Mirel** · `dr_a2_shelf_2_004` · calm

Hold the dry board instead. You need not risk the slip twice.

**Narration** · `dr_a2_shelf_2_005` · composed

The pages settle on the shelf with their numbers visible. The carrier keeps the original on the board.

**Aveline** · `dr_a2_shelf_2_006` · warm

Now we can look without making you stand in the doorway.

**Checkpoint:** `dr_a2_shelf_2_done`

## dr_a2_desk_1 — The Wall Table

Mekân: `dr_refuge_desk` · `new_authored_expansion`

Amaç: Desk dalı 1; kayıt confidence teması.

**Sahne yönergesi:** Aveline clears space around a solid table. Mirel keeps the original and any new note separate.

**Aveline** · `dr_a2_desk_1_001` · focused

This side for waiting. That side for anyone walking through.

**Mirel** · `dr_a2_desk_1_002` · precise

The original goes here. New notes go on the clean board.

**Carrier** · `dr_a2_desk_1_003` · curious

Why not write the clearer answer on the slip?

**Mirel** · `dr_a2_desk_1_004` · calm

Because we have not earned a clearer answer yet.

**Narration** · `dr_a2_desk_1_005` · composed

Aveline shifts the lamp. The blurred line remains blurred, but can be seen without leaning into the passage.

**Aveline** · `dr_a2_desk_1_006` · gentle

At least nobody has to read in the dark while we ask.

**Checkpoint:** `dr_a2_desk_1_done`

## dr_a2_desk_2 — A Reader at the Table

Mekân: `dr_refuge_desk` · `new_authored_expansion`

Amaç: Desk dalı 2; sosyal sessizliğe davet değil birlikte belge inceleme.

**Sahne yönergesi:** The table is accessible to someone sitting down. No repair or carrying minigame is implied.

**Carrier** · `dr_a2_desk_2_001` · quiet

I thought the table was for the people keeping the book.

**Mirel** · `dr_a2_desk_2_002` · precise

It is for the book being read.

**Aveline** · `dr_a2_desk_2_003` · warm

Which includes you.

**Narration** · `dr_a2_desk_2_004` · composed

Mirel turns the board toward the carrier. Aveline rests a dry blanket across the chair back.

**Mirel** · `dr_a2_desk_2_005` · focused

You can point to what you remember. We will not make the page say it first.

**Carrier** · `dr_a2_desk_2_006` · relieved

I remember the blue cord around the bundle.

**Checkpoint:** `dr_a2_desk_2_done`

## dr_a2_reading — A Note Is Not an Answer

Mekân: `dr_refuge_desk` · `new_authored_expansion`

Amaç: Kayıt okuma yöntemi iki farklı somut resolution; battle düzenini değiştirmez.

**Sahne yönergesi:** The readable date and blue-cord detail are visible. Choose how to document the unclear receiving place.

**Mirel** · `dr_a2_reading_001` · focused

The slip tells us the day. The blue cord may tell us which return point lent it.

**Aveline** · `dr_a2_reading_002` · calm

We can record the limit of what we know, or ask the keeper of the bundles.

**Mirel** · `dr_a2_reading_003` · precise

Either is honest. Only one pretends the water never touched the line, and we will not do that.

### Seçim — Handle the unclear entry.

Kayıt alanı: `reading`

#### Attach a note: receiving place unclear. — `dr_reading_note`

Önizleme: Preserve the original and route the return through the refuge keeper.

**Mirel** · `dr_a2_reading_004` · focused

A separate note. Clear date, unclear place, blue cord remembered by the carrier.

**Aveline** · `dr_a2_reading_005` · calm

The refuge keeper can receive it safely without inventing a destination.

**Carrier** · `dr_a2_reading_006` · relieved

Then I can return it here and let them check.

#### Ask the linen keeper about the blue cord. — `dr_reading_ask`

Önizleme: Confirm the ordinary return point while keeping the original unchanged.

**Aveline** · `dr_a2_reading_007` · focused

I will ask from the door. Stay warm while we check.

**Mirel** · `dr_a2_reading_008` · precise

A confirmed answer belongs on a new note, with where it came from.

**Carrier** · `dr_a2_reading_009` · quiet

I can show the cord. It is still on the bundle.

**Checkpoint:** `dr_a2_reading_done`

## dr_a2_note — The Limit Written Down

Mekân: `dr_refuge_desk` · `new_authored_expansion`

Amaç: Note dalı: doğru belirsizlik kaydı.

**Sahne yönergesi:** Mirel attaches a plain note to the original. It is an ordinary administrative action, not witness magic.

**Mirel** · `dr_a2_note_001` · focused

There. The note says what was legible and what was not.

**Carrier** · `dr_a2_note_002` · hesitant

Is an unclear place allowed in the book?

**Mirel** · `dr_a2_note_003` · precise

It was already there. Now it is admitted.

**Aveline** · `dr_a2_note_004` · warm

And you have a place to leave the bundle while it is checked.

**Narration** · `dr_a2_note_005` · composed

The carrier places the slip flat on the board instead of trying to unfold the wet corner again.

**Checkpoint:** `dr_a2_note_done`

## dr_a2_ask — The Cord and the Keeper

Mekân: `dr_refuge_desk` · `new_authored_expansion`

Amaç: Ask dalı: canlı kaynak doğrulaması; kayıp royal isim bulunmaz.

**Sahne yönergesi:** The linen keeper confirms off-screen that blue-cord bundles return at the refuge desk. No named historical witness enters.

**Aveline** · `dr_a2_ask_001` · calm

Blue cords return here. The keeper tied them herself before the rain.

**Mirel** · `dr_a2_ask_002` · focused

Then I will note that she confirmed it. I will not mend the original handwriting into ours.

**Carrier** · `dr_a2_ask_003` · relieved

I thought I had forgotten the way.

**Aveline** · `dr_a2_ask_004` · warm

The line got wet. You did not do anything wrong.

**Narration** · `dr_a2_ask_005` · composed

The cord lies beside the note, an ordinary small thing that helped an answer become clear.

**Checkpoint:** `dr_a2_ask_done`
