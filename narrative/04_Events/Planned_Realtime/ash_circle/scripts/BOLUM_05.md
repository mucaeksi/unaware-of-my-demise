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
