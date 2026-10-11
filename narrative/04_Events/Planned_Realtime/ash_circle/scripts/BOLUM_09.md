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
