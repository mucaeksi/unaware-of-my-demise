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
