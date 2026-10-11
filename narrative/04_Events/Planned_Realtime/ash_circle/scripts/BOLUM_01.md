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
