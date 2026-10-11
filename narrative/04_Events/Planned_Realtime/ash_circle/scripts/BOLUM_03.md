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
