# Kül Çemberi — tüm scriptler

# Kül Çemberi — 01: Açık Kapı

İngilizce oyuncu metni; Türkçe üretim notları. Yeni yaratıcı genişletme.

## ac_opening — An Open Space on the Map

Mekân: `ac_gate`

Yönetim: Late afternoon. Jori stays at Oakhaven; only yard workers appear inside the new location.

Amaç: 4-5 sonrası Jori dönüşü. Ana gizem, sealed order ve Fadyme açıklaması kullanılmaz.

**Narration** · `ac_opening_001` · composed

On returning to Oakhaven, Jori finds a supply cart waiting outside the gate. Its driver will not cross the charcoal yard.

**Jori** · `ac_opening_002` · tense

The captain is gone. Why is the road still empty?

**Mera** · `ac_opening_003` · guarded

The captain was not the first reason it emptied.

**Tovin** · `ac_opening_004` · uneasy

The yard has its own dead. We kept working around them until there was no way through.

**Jori** · `ac_opening_005` · stern

And you waited for the village to notice?

**Tovin** · `ac_opening_006` · quiet

I waited for someone else to sign the closure.

**Mera** · `ac_opening_007` · firm

I brought the old survey. One yard, ten places we have to account for.

**Jori** · `ac_opening_008` · firm

We open the road, keep the records, and leave the dead to people who can truly witness them.

**Mera** · `ac_opening_009` · quiet

That is all I am asking. It is already more than anyone has promised us.

Checkpoint: `ac_opening_done`

## ac_terms — A Road, Not a Cure

Mekân: `ac_gate`

Yönetim: Mera marks three routes. This choice changes only an optional log note, not the objectives.

Amaç: Ton seçimi tüm içerikleri erişilebilir bırakır.

**Mera** · `ac_terms_001` · firm

You can read the yard from its gate, its loads, or its missing workers. We need all three before we close the record.

**Jori** · `ac_terms_002` · firm

Start with the thing you can keep in sight. We will follow it through.

### What will you keep in sight?

Kayıt: `watch_note`

#### A road people can use. · `ac_watch_note_road`

Log note only; every chapter remains available.

**Jori** · `ac_terms_003` · firm

Then keep the exits open. We will need them when the work turns against us.

**Mera** · `ac_terms_004` · composed

I will mark the usable routes beside the old survey.

#### A record people can trust. · `ac_watch_note_record`

Log note only; every chapter remains available.

**Mera** · `ac_terms_005` · firm

Then we keep the damaged page with the clean one. Nothing disappears to make our account easier.

**Jori** · `ac_terms_006` · quiet

And no guess becomes a name.

#### A place for the missing. · `ac_watch_note_workers`

Log note only; every chapter remains available.

**Tovin** · `ac_terms_007` · quiet

I can remember some of them. You will hear where my memory stops.

**Mera** · `ac_terms_008` · firm

We leave that space open for the people who know.

Checkpoint: `ac_terms_done`

## ac_setback — Back Through the Gate

Mekân: `ac_gate`

Yönetim: Generic first defeat scene. Thereafter a short UI message replaces the full scene.

Amaç: Kaybedilen koşu XP yükseltmeleri sıfırlanır; temizlenen bölümler silinmez.

**Narration** · `ac_setback_001` · composed

Mera moves the lamp to the gate. The chalk marks beyond it are still where she left them.

**Mera** · `ac_setback_002` · firm

We withdraw before another name has to be added to the missing.

**Tovin** · `ac_setback_003` · uneasy

Did we lose the whole route?

**Jori** · `ac_setback_004` · firm

No. We lost this attempt. We know the way back in.

**Mera** · `ac_setback_005` · focused

The record stays. Rest, change what you carry, and begin this part again.

Checkpoint: `ac_setback_done`

## ac_ch01_entry — The Open Gate

Mekân: `ac_gate`

Yönetim: Chapter 1, before deployment. Cut to the same yard, at the named landmark.

Amaç: Tebeşir işaretlerini topla; geçit boyunca geri dön. İlk koşu hareket ve otomatik saldırıyı öğretir.

**Narration** · `ac_ch01_entry_001` · composed

Jori lifts the bar with her shoulder. The charcoal yard opens onto a road of overturned handcarts.

**Jori** · `ac_ch01_entry_002` · tense

This gate faces the village. Whatever we leave behind it will reach the houses first.

**Tovin** · `ac_ch01_entry_003` · guarded

The carts stopped before the captain came. We had nowhere left to put the charcoal.

**Mera** · `ac_ch01_entry_004` · composed

And no one left who could tell me which workers were missing.

**Jori** · `ac_ch01_entry_005` · firm

Then we start with the road. No bell, no shouting. Let the dead follow our feet.

**Mera** · `ac_ch01_entry_006` · composed

I will mark what we know. You bring back what can still be read.

**Tovin** · `ac_ch01_entry_007` · uneasy

Stay on the pale chalk. The dark lines are cracks, not paths.

Checkpoint: `ac_ch01_entry_done`

## ac_ch01_breather — The Open Gate: The Safe Mark

Mekân: `ac_gate`

Yönetim: At combat tick 7200, freeze combat and all timers, then play this brief scene. Existing enemies remain paused.

Amaç: Bir defalık durak; aynı koşuda yeniden tetiklenmez.

**Mera** · `ac_ch01_breather_001` · focused

The first mark is visible again. The scale house is farther in.

**Tovin** · `ac_ch01_breather_002` · uneasy

That carrier keeps circling the same empty cart.

**Jori** · `ac_ch01_breather_003` · firm

Leave room to pass it. A shield is no use if we close our own way out.

Checkpoint: `ac_ch01_breather_done`

## ac_ch01_clear — The Open Gate: The Record

Mekân: `ac_gate`

Yönetim: Only after the server accepts the complete chapter victory. No dialogue appears during active dodging.

Amaç: Onaylı ilk zafer sonrası; skip olsa da idempotent sahne checkpoint kaydı tutulur.

**Narration** · `ac_ch01_clear_001` · composed

The carrier falls beside its cart. Under the handle is a small plate, worn smooth on one side.

**Mera** · `ac_ch01_clear_002` · quiet

A worker's number. No name.

**Tovin** · `ac_ch01_clear_003` · ashamed

We used numbers to settle loads. It was quicker.

**Jori** · `ac_ch01_clear_004` · stern

Quicker for who?

**Tovin** · `ac_ch01_clear_005` · quiet

For the man paying us.

**Mera** · `ac_ch01_clear_006` · firm

I will keep the plate. We need the book that gave it a name.

Checkpoint: `ac_ch01_clear_done`


---

# Kül Çemberi — 02: İsimsiz Tartı

İngilizce oyuncu metni; Türkçe üretim notları. Yeni yaratıcı genişletme.

## ac_ch02_entry — Weight Without Names

Mekân: `ac_weighbridge`

Yönetim: Chapter 2, before deployment. Cut to the same yard, at the named landmark.

Amaç: Üç tartı levhasını farklı yaklaşım yönlerinden topla; paralel düşman hatlarının arasından geç.

**Narration** · `ac_ch02_entry_001` · composed

The scale arm rocks although nothing rests on the platform.

**Mera** · `ac_ch02_entry_002` · focused

Each plate is a week's tally. The names should be on the back.

**Tovin** · `ac_ch02_entry_003` · guarded

The foreman kept that side against the wall.

**Jori** · `ac_ch02_entry_004` · stern

Which foreman?

**Tovin** · `ac_ch02_entry_005` · quiet

Me.

**Mera** · `ac_ch02_entry_006` · firm

Then you can tell us which screws to loosen.

**Tovin** · `ac_ch02_entry_007` · quiet

All three. I will not ask you to leave one behind.

Checkpoint: `ac_ch02_entry_done`

## ac_ch02_breather — Weight Without Names: The Safe Mark

Mekân: `ac_weighbridge`

Yönetim: At combat tick 7200, freeze combat and all timers, then play this brief scene. Existing enemies remain paused.

Amaç: Bir defalık durak; aynı koşuda yeniden tetiklenmez.

**Tovin** · `ac_ch02_breather_001` · focused

The crossing lane opens when the scale arm drops. Do not wait underneath it.

**Mera** · `ac_ch02_breather_002` · quiet

One plate has the word 'advance'. A wage paid before the work.

**Jori** · `ac_ch02_breather_003` · tense

Or a debt made to look like one.

Checkpoint: `ac_ch02_breather_done`

## ac_ch02_clear — Weight Without Names: The Record

Mekân: `ac_weighbridge`

Yönetim: Only after the server accepts the complete chapter victory. No dialogue appears during active dodging.

Amaç: Onaylı ilk zafer sonrası; skip olsa da idempotent sahne checkpoint kaydı tutulur.

**Mera** · `ac_ch02_clear_001` · focused

The backs were filed clean. There are no names here.

**Tovin** · `ac_ch02_clear_002` · ashamed

I signed that order. I thought the mill kept the originals.

**Jori** · `ac_ch02_clear_003` · stern

Thinking is not the same as asking.

**Mera** · `ac_ch02_clear_004` · firm

The totals do not match. These workers delivered more than they were paid for.

**Tovin** · `ac_ch02_clear_005` · quiet

The dispatch rack holds the next set. I can show you.

**Narration** · `ac_ch02_clear_006` · composed

Mera wraps the plates separately. An empty space is still evidence when someone made it empty.

Checkpoint: `ac_ch02_clear_done`


---

# Kül Çemberi — 03: Değiştirilen Yol

İngilizce oyuncu metni; Türkçe üretim notları. Yeni yaratıcı genişletme.

## ac_ch03_entry — The Route That Changed

Mekân: `ac_dispatch`

Yönetim: Chapter 3, before deployment. Cut to the same yard, at the named landmark.

Amaç: Eski sevk etiketlerini güney-doğu-kuzey rotasında al; kurt kıskacında yön değiştir.

**Tovin** · `ac_ch03_entry_001` · focused

The road ran south. Those tags point north.

**Jori** · `ac_ch03_entry_002` · tense

Toward the pits.

**Mera** · `ac_ch03_entry_003` · focused

A new route was stamped over the old one. This ink is ordinary. Someone chose it.

**Tovin** · `ac_ch03_entry_004` · guarded

I was told the south bridge could not take another load.

**Jori** · `ac_ch03_entry_005` · stern

Did you see the bridge?

**Tovin** · `ac_ch03_entry_006` · quiet

No.

**Mera** · `ac_ch03_entry_007` · firm

We will read the instruction we have, not invent the one we want.

Checkpoint: `ac_ch03_entry_done`

## ac_ch03_breather — The Route That Changed: The Safe Mark

Mekân: `ac_dispatch`

Yönetim: At combat tick 7200, freeze combat and all timers, then play this brief scene. Existing enemies remain paused.

Amaç: Bir defalık durak; aynı koşuda yeniden tetiklenmez.

**Mera** · `ac_ch03_breather_001` · focused

The tags carry the yard stamp. No royal seal.

**Jori** · `ac_ch03_breather_002` · firm

Good. Keep the captain's business out of this. Oakhaven has enough wounds of its own.

**Tovin** · `ac_ch03_breather_003` · uneasy

The largest wolf follows the broken cart. It turns late. Give it a wide corner.

Checkpoint: `ac_ch03_breather_done`

## ac_ch03_clear — The Route That Changed: The Record

Mekân: `ac_dispatch`

Yönetim: Only after the server accepts the complete chapter victory. No dialogue appears during active dodging.

Amaç: Onaylı ilk zafer sonrası; skip olsa da idempotent sahne checkpoint kaydı tutulur.

**Mera** · `ac_ch03_clear_001` · focused

All three loads were redirected to the same storage pit.

**Tovin** · `ac_ch03_clear_002` · quiet

The pit was already full.

**Jori** · `ac_ch03_clear_003` · stern

Full of charcoal?

**Tovin** · `ac_ch03_clear_004` · ashamed

That is what the tally says.

**Mera** · `ac_ch03_clear_005` · quiet

That is what you let the tally say.

**Narration** · `ac_ch03_clear_006` · composed

The tags dry beneath a stone. Their arrows disagree with the road, but agree with each other.

Checkpoint: `ac_ch03_clear_done`


---

# Kül Çemberi — 04: Geçici Kuru Yer

İngilizce oyuncu metni; Türkçe üretim notları. Yeni yaratıcı genişletme.

## ac_ch04_entry — A Borrowed Dry Place

Mekân: `ac_shelter`

Yönetim: Chapter 4, before deployment. Cut to the same yard, at the named landmark.

Amaç: Çevredeki üç sığınak mandalını aç; merkez etrafında dönen tehdide tek yönde bağımlı kalma.

**Narration** · `ac_ch04_entry_001` · composed

A child's mitten hangs inside the stock shelter. Rain has hardened the cloth against its nail.

**Mera** · `ac_ch04_entry_002` · quiet

There were families here.

**Tovin** · `ac_ch04_entry_003` · guarded

They came with the seasonal crews. The village had no beds left.

**Jori** · `ac_ch04_entry_004` · stern

And you locked the only dry roof?

**Tovin** · `ac_ch04_entry_005` · ashamed

After the deliveries stopped. I thought they had all gone.

**Mera** · `ac_ch04_entry_006` · firm

We open it before we decide what that thought is worth.

**Jori** · `ac_ch04_entry_007` · firm

Three latches. Keep the door's swing clear.

Checkpoint: `ac_ch04_entry_done`

## ac_ch04_breather — A Borrowed Dry Place: The Safe Mark

Mekân: `ac_shelter`

Yönetim: At combat tick 7200, freeze combat and all timers, then play this brief scene. Existing enemies remain paused.

Amaç: Bir defalık durak; aynı koşuda yeniden tetiklenmez.

**Mera** · `ac_ch04_breather_001` · quiet

A stool, two bowls, four blankets. This was a room, not a store.

**Tovin** · `ac_ch04_breather_002` · uneasy

The keeper still shuts every open shutter.

**Jori** · `ac_ch04_breather_003` · firm

Move around it. Do not fight the whole roof at once.

Checkpoint: `ac_ch04_breather_done`

## ac_ch04_clear — A Borrowed Dry Place: The Record

Mekân: `ac_shelter`

Yönetim: Only after the server accepts the complete chapter victory. No dialogue appears during active dodging.

Amaç: Onaylı ilk zafer sonrası; skip olsa da idempotent sahne checkpoint kaydı tutulur.

**Narration** · `ac_ch04_clear_001` · composed

The shelter opens onto a wall of pencilled heights. The smallest mark ends below Jori's shoulder.

**Mera** · `ac_ch04_clear_002` · quiet

These marks belong in the register too.

**Tovin** · `ac_ch04_clear_003` · ashamed

I only counted the hands that could lift a sack.

**Jori** · `ac_ch04_clear_004` · quiet

Children are not the part of a load you can leave out.

**Mera** · `ac_ch04_clear_005` · firm

We cannot tell who lived from a mark alone. I will write 'family present', and keep the wall.

**Narration** · `ac_ch04_clear_006` · composed

For the first time, Tovin carries something from the yard that cannot be sold.

Checkpoint: `ac_ch04_clear_done`


---

# Kül Çemberi — 05: Kara Suyun Altı

İngilizce oyuncu metni; Türkçe üretim notları. Yeni yaratıcı genişletme.

## ac_ch05_entry — Under the Black Water

Mekân: `ac_cistern`

Yönetim: Chapter 5, before deployment. Cut to the same yard, at the named landmark.

Amaç: Üç sabit tahliye kolunu sırayla çevir; su şeritlerinin değişen güvenli tarafını kullan.

**Tovin** · `ac_ch05_entry_001` · focused

The cistern drains below the storage pit. If we empty it, the boards may still be there.

**Mera** · `ac_ch05_entry_002` · guarded

Paper will not survive that water.

**Jori** · `ac_ch05_entry_003` · firm

Then we save the wood it was nailed to.

**Tovin** · `ac_ch05_entry_004` · uneasy

Three handles. The middle one opens both channels if you turn it first.

**Mera** · `ac_ch05_entry_005` · focused

Left, right, middle. I have marked them.

**Jori** · `ac_ch05_entry_006` · firm

And if the marks wash away?

**Tovin** · `ac_ch05_entry_007` · focused

I stay here and call the order.

Checkpoint: `ac_ch05_entry_done`

## ac_ch05_breather — Under the Black Water: The Safe Mark

Mekân: `ac_cistern`

Yönetim: At combat tick 7200, freeze combat and all timers, then play this brief scene. Existing enemies remain paused.

Amaç: Bir defalık durak; aynı koşuda yeniden tetiklenmez.

**Mera** · `ac_ch05_breather_001` · focused

The ink on the water is moving against the current.

**Jori** · `ac_ch05_breather_002` · tense

Keep it off the boards. Breaking a chain does not read what was chained.

**Tovin** · `ac_ch05_breather_003` · firm

The west rim is dry. The next drain is on your right.

Checkpoint: `ac_ch05_breather_done`

## ac_ch05_clear — Under the Black Water: The Record

Mekân: `ac_cistern`

Yönetim: Only after the server accepts the complete chapter victory. No dialogue appears during active dodging.

Amaç: Onaylı ilk zafer sonrası; skip olsa da idempotent sahne checkpoint kaydı tutulur.

**Mera** · `ac_ch05_clear_001` · quiet

The boards were turned face down before they were sunk.

**Tovin** · `ac_ch05_clear_002` · ashamed

They told me it would stop arguments over pay.

**Jori** · `ac_ch05_clear_003` · stern

It stopped people proving they had been here.

**Mera** · `ac_ch05_clear_004` · firm

Do not scrape them clean. Even a crossed-out letter may be all a family has.

**Tovin** · `ac_ch05_clear_005` · quiet

I will bring cloth. Clean cloth this time.

**Narration** · `ac_ch05_clear_006` · composed

Black water leaves the channel. The earth beneath it keeps the shape of every board.

Checkpoint: `ac_ch05_clear_done`


---

# Kül Çemberi — 06: Boş Kenar

İngilizce oyuncu metni; Türkçe üretim notları. Yeni yaratıcı genişletme.

## ac_ch06_entry — The Book's Empty Margin

Mekân: `ac_ledger`

Yönetim: Chapter 6, before deployment. Cut to the same yard, at the named landmark.

Amaç: Üç ayrı defter yaprağını al; hareket izi bırakan mürekkep yüzünden aynı yolu hemen tekrar kullanma.

**Mera** · `ac_ch06_entry_001` · focused

There were two books. One for loads. One for advances.

**Tovin** · `ac_ch06_entry_002` · guarded

The clerk said the second was private.

**Jori** · `ac_ch06_entry_003` · stern

Private is a useful word when everyone else pays.

**Mera** · `ac_ch06_entry_004` · quiet

Here. The names were cut out, not crossed out.

**Tovin** · `ac_ch06_entry_005` · ashamed

I saw the scraps in the stove. I thought they were mistakes.

**Mera** · `ac_ch06_entry_006` · firm

Then today we keep the margins. Missing words have edges.

**Jori** · `ac_ch06_entry_007` · firm

Keep moving. That thing is tracing where we stood.

Checkpoint: `ac_ch06_entry_done`

## ac_ch06_breather — The Book's Empty Margin: The Safe Mark

Mekân: `ac_ledger`

Yönetim: At combat tick 7200, freeze combat and all timers, then play this brief scene. Existing enemies remain paused.

Amaç: Bir defalık durak; aynı koşuda yeniden tetiklenmez.

**Mera** · `ac_ch06_breather_001` · focused

The clerk carried the missing names on separate slips. Some may still be caught in the binding.

**Tovin** · `ac_ch06_breather_002` · uneasy

The ink joins at the corner. Cross the room, not your old trail.

**Jori** · `ac_ch06_breather_003` · firm

A fresh path costs less than a stubborn one.

Checkpoint: `ac_ch06_breather_done`

## ac_ch06_clear — The Book's Empty Margin: The Record

Mekân: `ac_ledger`

Yönetim: Only after the server accepts the complete chapter victory. No dialogue appears during active dodging.

Amaç: Onaylı ilk zafer sonrası; skip olsa da idempotent sahne checkpoint kaydı tutulur.

**Mera** · `ac_ch06_clear_001` · focused

There is a receipt for the boards. Tovin's mark beside the clerk's.

**Tovin** · `ac_ch06_clear_002` · quiet

I cannot say I did not know what my hand did.

**Jori** · `ac_ch06_clear_003` · stern

You can stop asking the paper to take the blame.

**Mera** · `ac_ch06_clear_004` · firm

This copy stays intact. We will put your account beside it, not over it.

**Tovin** · `ac_ch06_clear_005` · quiet

Write that I signed. Write that I was paid.

**Narration** · `ac_ch06_clear_006` · composed

Mera sets a clean sheet beside the damaged one. For once, the second account does not replace the first.

Checkpoint: `ac_ch06_clear_done`


---

# Kül Çemberi — 07: Boş Arabayı Döndürmek

İngilizce oyuncu metni; Türkçe üretim notları. Yeni yaratıcı genişletme.

## ac_ch07_entry — An Empty Cart Returns

Mekân: `ac_cart`

Yönetim: Chapter 7, before deployment. Cut to the same yard, at the named landmark.

Amaç: Bir araba üç durakta oyuncu yakındayken ilerler; temas menzilinde beklemek yerine önden koridor aç.

**Narration** · `ac_ch07_entry_001` · composed

Tovin pulls a wheel free. The cart under the shelter is too narrow for charcoal sacks.

**Tovin** · `ac_ch07_entry_002` · quiet

I told the crews to use the pit until someone came for the dead.

**Mera** · `ac_ch07_entry_003` · quiet

Did you send for anyone?

**Tovin** · `ac_ch07_entry_004` · ashamed

I wrote the request. I did not send it.

**Jori** · `ac_ch07_entry_005` · tense

Because the yard would close.

**Tovin** · `ac_ch07_entry_006` · quiet

Yes.

**Mera** · `ac_ch07_entry_007` · firm

Then we move the cart now. Empty. No more pretending a journey happened because you wrote it down.

Checkpoint: `ac_ch07_entry_done`

## ac_ch07_breather — An Empty Cart Returns: The Safe Mark

Mekân: `ac_cart`

Yönetim: At combat tick 7200, freeze combat and all timers, then play this brief scene. Existing enemies remain paused.

Amaç: Bir defalık durak; aynı koşuda yeniden tetiklenmez.

**Jori** · `ac_ch07_breather_001` · firm

Let the cart stop if you need room. Its wheels are not a clock.

**Mera** · `ac_ch07_breather_002` · focused

The dead follow the handle. Clear the next corner before you draw them there.

**Tovin** · `ac_ch07_breather_003` · quiet

I remember this route. I should have used it.

Checkpoint: `ac_ch07_breather_done`

## ac_ch07_clear — An Empty Cart Returns: The Record

Mekân: `ac_cart`

Yönetim: Only after the server accepts the complete chapter victory. No dialogue appears during active dodging.

Amaç: Onaylı ilk zafer sonrası; skip olsa da idempotent sahne checkpoint kaydı tutulur.

**Narration** · `ac_ch07_clear_001` · composed

The cart reaches the open gate with no burden to deliver. Tovin keeps both hands on the handle.

**Mera** · `ac_ch07_clear_002` · firm

We do not know how many were taken to the pit. We write that plainly.

**Jori** · `ac_ch07_clear_003` · quiet

And we stop calling it storage.

**Tovin** · `ac_ch07_clear_004` · quiet

Will saying it change what is under there?

**Mera** · `ac_ch07_clear_005` · quiet

It changes what the next person is told. That is what we can promise.

**Narration** · `ac_ch07_clear_006` · composed

On the yard map, Mera strikes one word through once. The mark remains readable.

Checkpoint: `ac_ch07_clear_done`


---

# Kül Çemberi — 08: Çukurun Sakladığı

İngilizce oyuncu metni; Türkçe üretim notları. Yeni yaratıcı genişletme.

## ac_ch08_entry — What the Pit Keeps

Mekân: `ac_pit`

Yönetim: Chapter 8, before deployment. Cut to the same yard, at the named landmark.

Amaç: Açık çukur kenarındaki üç taşı işaretle; kül fırtınalarının önceden görünen yönüne göre yol değiştir.

**Narration** · `ac_ch08_entry_001` · composed

The pit holds sacks, broken tools and a shoe with the foot still inside it. Nothing here has a proper place.

**Jori** · `ac_ch08_entry_002` · quiet

No one dumps another load here.

**Mera** · `ac_ch08_entry_003` · firm

Markers first. We do not enter until the ground and the dead are safe to approach.

**Tovin** · `ac_ch08_entry_004` · ashamed

I said the shortage would pass if we kept the carts running.

**Jori** · `ac_ch08_entry_005` · stern

The carts kept running. The shortage became people.

**Mera** · `ac_ch08_entry_006` · focused

There are two kinds of marks on these tools. We may have more than one crew to account for.

**Tovin** · `ac_ch08_entry_007` · quiet

I will name both. Even the ones who left.

Checkpoint: `ac_ch08_entry_done`

## ac_ch08_breather — What the Pit Keeps: The Safe Mark

Mekân: `ac_pit`

Yönetim: At combat tick 7200, freeze combat and all timers, then play this brief scene. Existing enemies remain paused.

Amaç: Bir defalık durak; aynı koşuda yeniden tetiklenmez.

**Tovin** · `ac_ch08_breather_001` · focused

The gust runs from the kiln to the pit. Watch the hanging cloth, not the dust at your feet.

**Mera** · `ac_ch08_breather_002` · quiet

One spade has a child's height scratched into its shaft. A parent kept count.

**Jori** · `ac_ch08_breather_003` · firm

Then keep the spade. Do not make the mark prettier.

Checkpoint: `ac_ch08_breather_done`

## ac_ch08_clear — What the Pit Keeps: The Record

Mekân: `ac_pit`

Yönetim: Only after the server accepts the complete chapter victory. No dialogue appears during active dodging.

Amaç: Onaylı ilk zafer sonrası; skip olsa da idempotent sahne checkpoint kaydı tutulur.

**Mera** · `ac_ch08_clear_001` · firm

The rim is marked. No names guessed, no bodies moved without a witness.

**Tovin** · `ac_ch08_clear_002` · quiet

I can remember eleven workers. Not all their families.

**Jori** · `ac_ch08_clear_003` · quiet

Then eleven is where we start, not where we stop.

**Mera** · `ac_ch08_clear_004` · firm

I will leave the list open. Anyone missing may be written here without proving what they earned.

**Narration** · `ac_ch08_clear_005` · composed

The first new sign at the pit forbids a load. The second asks a question: Who is still missing?

**Tovin** · `ac_ch08_clear_006` · quiet

I should have asked that before there was a pit.

Checkpoint: `ac_ch08_clear_done`


---

# Kül Çemberi — 09: Avluyu Açmak

İngilizce oyuncu metni; Türkçe üretim notları. Yeni yaratıcı genişletme.

## ac_ch09_entry — The Yard Must Open

Mekân: `ac_kiln`

Yönetim: Chapter 9, before deployment. Cut to the same yard, at the named landmark.

Amaç: Üç çıkış zincirini sök; iki dik ateş hattı aynı anda kapandığında kalan çeyreği bul.

**Tovin** · `ac_ch09_entry_001` · focused

The kiln's lever draws all three gate chains. One pull can close the whole yard.

**Jori** · `ac_ch09_entry_002` · stern

A prison that calls itself a workplace.

**Mera** · `ac_ch09_entry_003` · guarded

The clerk has tied the binding to the last chain. Cut the chain, keep the book.

**Tovin** · `ac_ch09_entry_004` · uneasy

The tender follows the heat vents. It was his last duty.

**Jori** · `ac_ch09_entry_005` · firm

Then we stop feeding the duty. No more charcoal goes in.

**Mera** · `ac_ch09_entry_006` · firm

Keep every warning line visible. We need our way out as much as the way in.

**Tovin** · `ac_ch09_entry_007` · quiet

I can open the first link from this side.

Checkpoint: `ac_ch09_entry_done`

## ac_ch09_breather — The Yard Must Open: The Safe Mark

Mekân: `ac_kiln`

Yönetim: At combat tick 7200, freeze combat and all timers, then play this brief scene. Existing enemies remain paused.

Amaç: Bir defalık durak; aynı koşuda yeniden tetiklenmez.

**Mera** · `ac_ch09_breather_001` · focused

Two chains are free. The last is under the kiln arm.

**Jori** · `ac_ch09_breather_002` · firm

Let it sweep. Cross behind it, not under it.

**Tovin** · `ac_ch09_breather_003` · tense

The north corner is clear. I have marked it twice.

Checkpoint: `ac_ch09_breather_done`

## ac_ch09_clear — The Yard Must Open: The Record

Mekân: `ac_kiln`

Yönetim: Only after the server accepts the complete chapter victory. No dialogue appears during active dodging.

Amaç: Onaylı ilk zafer sonrası; skip olsa da idempotent sahne checkpoint kaydı tutulur.

**Narration** · `ac_ch09_clear_001` · composed

The final chain drops. The gates stay open when the kiln arm turns.

**Jori** · `ac_ch09_clear_002` · quiet

A door should not need someone crushed beneath it to remain a door.

**Mera** · `ac_ch09_clear_003` · focused

The binding is intact. Most slips are blank; three still carry letters.

**Tovin** · `ac_ch09_clear_004` · quiet

Will three letters be enough?

**Mera** · `ac_ch09_clear_005` · firm

Enough to ask the families. Never enough to decide for them.

**Narration** · `ac_ch09_clear_006` · composed

Beyond the yard, Oakhaven's ordinary lamps become visible through the gap.

Checkpoint: `ac_ch09_clear_done`


---

# Kül Çemberi — 10: Yolu Açık Bırak

İngilizce oyuncu metni; Türkçe üretim notları. Yeni yaratıcı genişletme.

## ac_reconstruction — A Route Remembered

Mekân: `ac_gate`

Yönetim: Post-clear replay framing. Reconstructed encounters have no new canonical casualties.

Amaç: Yeniden oynanış yazar düzeyinde rekonstrüksiyon; evren içi gerçek zaman döngüsü veya yeni ölüm değildir.

**Mera** · `ac_reconstruction_001` · focused

I have drawn each route as we found it. The marks show the attacks we had to pass.

**Jori** · `ac_reconstruction_002` · firm

A road map is useful. Knowing where it nearly killed you is better.

**Tovin** · `ac_reconstruction_003` · quiet

May I practice the routes too?

**Mera** · `ac_reconstruction_004` · firm

Yes. On the record. No one goes back into danger just to prove the first crossing counted.

**Narration** · `ac_reconstruction_005` · composed

The yard survey lies flat beneath the lamps. Its routes can be studied again without closing the real gate.

Checkpoint: `ac_reconstruction_done`

## ac_ch10_entry — Leave the Road Open

Mekân: `ac_gate`

Yönetim: Chapter 10, before deployment. Cut to the same yard, at the named landmark.

Amaç: Arenanın üç bölgesindeki tanık direklerini etkinleştir; önceki hareket dilini üç boss fazında birleştir.

**Narration** · `ac_ch10_entry_001` · composed

Mera pins the damaged book beneath a clear board. Beside it, Tovin's account is held open by his own hammer.

**Mera** · `ac_ch10_entry_002` · firm

Both stay. The missing names, and the man who helped remove them.

**Tovin** · `ac_ch10_entry_003` · quiet

I will answer when they come.

**Jori** · `ac_ch10_entry_004` · stern

You will also keep the road clear for them.

**Mera** · `ac_ch10_entry_005` · focused

The last carrier has scraps from every corner of the yard. It keeps bringing the load home.

**Jori** · `ac_ch10_entry_006` · firm

Then give it no closed gate to lean on.

**Tovin** · `ac_ch10_entry_007` · focused

Three posts. The gate, the shelter, the pit. I will keep a lamp at each.

Checkpoint: `ac_ch10_entry_done`

## ac_ch10_breather — Leave the Road Open: The Safe Mark

Mekân: `ac_gate`

Yönetim: At combat tick 7200, freeze combat and all timers, then play this brief scene. Existing enemies remain paused.

Amaç: Bir defalık durak; aynı koşuda yeniden tetiklenmez.

**Mera** · `ac_ch10_breather_001` · firm

The posts are standing. The pages will not be washed away tonight.

**Jori** · `ac_ch10_breather_002` · tense

The carrier is turning back toward the gate. Leave its first sweep room.

**Tovin** · `ac_ch10_breather_003` · firm

I will not close it behind you.

Checkpoint: `ac_ch10_breather_done`

## ac_ch10_clear — Leave the Road Open: The Record

Mekân: `ac_gate`

Yönetim: Only after the server accepts the complete chapter victory. No dialogue appears during active dodging.

Amaç: Onaylı ilk zafer sonrası; skip olsa da idempotent sahne checkpoint kaydı tutulur.

**Narration** · `ac_ch10_clear_001` · composed

The last carrier breaks apart on the road. No bell sounds, and no light rises from the pit.

**Tovin** · `ac_ch10_clear_002` · quiet

I thought there would be a sign.

**Mera** · `ac_ch10_clear_003` · quiet

There is a road people can use. There is a record they can read. Those are our signs.

**Jori** · `ac_ch10_clear_004` · firm

The dead still need witnesses. The village will send people who remember, not another captain.

**Tovin** · `ac_ch10_clear_005` · quiet

And until they come?

**Mera** · `ac_ch10_clear_006` · firm

We keep the list open.

**Jori** · `ac_ch10_clear_007` · quiet

I have a gate to hold. You have a gate to stop closing.

**Narration** · `ac_ch10_clear_008` · composed

Mera leaves one clean space at the end of the page. It is not a name invented to make the work feel finished.

Checkpoint: `ac_ch10_clear_done`
