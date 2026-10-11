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
