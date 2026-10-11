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
