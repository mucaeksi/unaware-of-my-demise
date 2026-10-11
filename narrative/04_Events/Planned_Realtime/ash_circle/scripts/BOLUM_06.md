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
