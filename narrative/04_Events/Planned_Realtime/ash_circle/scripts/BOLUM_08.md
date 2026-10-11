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
