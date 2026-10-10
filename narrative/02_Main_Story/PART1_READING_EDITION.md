# Part I — Unaware, I Fade · tam okuma metni

Otomatik okuma kopyası; spoiler içerir. Burada düzenleme yapmayın.

Kaynak JSON metinleri, konuşmacılar ve line_id değerleri aynen alınır. Kaynağın taslak/onay durumu değişmez.

Kaynaklar: [story_script_ch01.json](../09_VN_Scripts/Main_Story/story_script_ch01.json), [story_script_ch02.json](../09_VN_Scripts/Main_Story/story_script_ch02.json), [story_script_ch03.json](../09_VN_Scripts/Main_Story/story_script_ch03.json), [story_script_ch04.json](../09_VN_Scripts/Main_Story/story_script_ch04.json), [story_script_ch05.json](../09_VN_Scripts/Main_Story/story_script_ch05.json), [story_script_ch06.json](../09_VN_Scripts/Main_Story/story_script_ch06.json), [story_script_ch07.json](../09_VN_Scripts/Main_Story/story_script_ch07.json)

## A Letter the Rain Could Not Keep

scene_id: opening_sad_scene

location_id: forest_whispering_ash

direction_en: Black screen. Rain ticks on an abandoned roadside shrine. Fadyme, alone for one breath, presses a blood-marked glove to a letter and writes by candlelight. She folds the page before Mahmut enters. A distant bell rings once; ash drifts upward instead of down.

music_cue: bgm_fadyme_theme — Felt piano and low cello; leave two seconds of silence after the first bell.

### lines

**Fadyme (thought)** · `opening_001`

If I wake before the bell tomorrow, I will call it luck. If I do not... Mahmut must never read this page.

emotion: frightened · voice_track: jp_inner

**Fadyme (thought)** · `opening_002`

One month, perhaps less. The old physician wrote it in Mother's prayer book. The ink does not tremble. I do.

emotion: breaking · voice_track: jp_inner

**Mahmut** · `opening_003`

You missed supper. I saved the part that did not burn.

emotion: gentle · voice_track: jp

**Fadyme** · `opening_004`

Then it is a feast. I am perfectly fine.

emotion: soft_smile · voice_track: jp

**Mahmut** · `opening_005`

Your hand is shaking.

emotion: concern · voice_track: jp

**Fadyme** · `opening_006`

The cold has found my fingers. It has not found the rest of me.

emotion: deflecting · voice_track: jp

**Narration** · `opening_007`

She hides the red stain beneath her cuff. He offers his cloak. She takes it, and lets him believe the warmth helped.

emotion: none · voice_track: none

**Yseldra** · `opening_008`

Princess. The road ends at the altar. Give me the last hour before it takes you.

emotion: grave · voice_track: jp

**Mahmut** · `opening_009`

You will not take her anywhere.

emotion: protective · voice_track: jp

**Yseldra** · `opening_010`

I came to stop the bell, not to kill its prisoner. You cannot guard a door that has already chosen its offering.

emotion: warning · voice_track: jp

**Mahmut** · `opening_011`

Then it can choose someone who is not under my shield.

emotion: defiant · voice_track: jp

**Fadyme** · `opening_012`

Do you know her?

emotion: composed · voice_track: jp

**Mahmut** · `opening_013`

No.

emotion: too_quick · voice_track: jp

**Fadyme (thought)** · `opening_014`

I know the bell she carries. And I know what it means when it rings for me.

emotion: sad · voice_track: jp_inner

**Yseldra** · `opening_015`

When the names begin to vanish, remember: I warned you.

emotion: distant · voice_track: jp

**Narration** · `opening_016`

Yseldra leaves a seven-notched gray seal on Mahmut’s shield. Fadyme turns away before he can see that she is crying.

emotion: none · voice_track: none

## The Road That Whispers

scene_id: vn_1_1

stage_id: 1-1

location_id: forest_whispering_ash

direction_en: At gray dawn, ash leaves whisper the names carved into them. Mahmut hears only wind; Fadyme hears one syllable spoken in her mother’s voice.

music_cue: pre: bgm_ch1_ash_forest (calm layer) — rain, whispering leaves; one soft bell tone when Fadyme hears the syllable | post: sting_victory, then bgm_ch1_ash_forest

battle_transition_en: A guided two-hero prologue encounter is the only exception to the normal five-unit party rule. No Ration is spent.

### tutorial_cards_en

### pre_battle_lines

**Mahmut** · `node_1_1_pre_001`

Three wolves. Stay behind my shield.

emotion: alert · voice_track: jp

**Fadyme** · `node_1_1_pre_002`

You say that as if I have ever listened.

emotion: dry_amusement · voice_track: jp

**Fadyme (thought)** · `node_1_1_pre_003`

The bell has no clapper. Why can I still hear it?

emotion: uneasy · voice_track: jp_inner

### post_battle_lines

**Mahmut** · `node_1_1_post_001`

The last one ran when the bell stopped.

emotion: watchful · voice_track: jp

**Fadyme** · `node_1_1_post_002`

It did not stop. It only learned to whisper.

emotion: pained_smile · voice_track: jp

**Fadyme (thought)** · `node_1_1_post_003`

One step. Then another. The road does not need to know how many it costs.

emotion: determined · voice_track: jp_inner

## No Bell in the Trees

scene_id: vn_1_2

stage_id: 1-2

location_id: forest_whispering_ash

direction_en: At a collapsed wayshrine, Brin braces a fallen beam while Bellbound Dead scratch at the woodcutters’ shelter. Nixie has been scouting the road; Kera's herb cart is overturned beside the shrine. All three join the guided five-person battle as story loans.

music_cue: pre: bgm_tension — scratching under the rain, low strings | post: sting_victory, then bgm_warmth (first recruit, small and quiet)

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Brin** · `node_1_2_pre_001`

If I move, the roof comes down. If I stay, they reach the children.

emotion: strained · voice_track: jp

**Mahmut** · `node_1_2_pre_002`

You do not have to hold it alone.

emotion: steady · voice_track: jp

**Fadyme** · `node_1_2_pre_003`

Three hands for the beam and three swords for the dead. We can manage both.

emotion: encouraging · voice_track: jp

**Nixie** · `node_1_2_pre_004`

The tracks circle the shrine. We are being pushed toward the road, not away from it.

emotion: alert · voice_track: jp

**Kera** · `node_1_2_pre_005`

My cart is full of smoke vials. If someone can throw straight, I can make that pack of corpses regret gathering.

emotion: brisk · voice_track: jp

### post_battle_lines

**Brin** · `node_1_2_post_001`

The woodcutters are safe. I will walk with you until the next bell is silent.

emotion: resolved · voice_track: jp

**Mahmut** · `node_1_2_post_002`

That is farther than the next shrine.

emotion: wry · voice_track: jp

**Brin** · `node_1_2_post_003`

Then try to keep up.

emotion: small_smile · voice_track: jp

**Nixie** · `node_1_2_post_004`

I will mark the next stretch before the wolves can double back. You can borrow my bow until we reach the old cart road.

emotion: practical · voice_track: jp

**Kera** · `node_1_2_post_005`

And I am going to retrieve my bottles before they become somebody else's research.

emotion: flustered · voice_track: jp

**Narration** · `node_1_2_post_006`

Brin joins permanently as a story recruit. Nixie and Kera remain as temporary story loans for the next stretch. The shrine keeper gives the party a First Oath Invitation.

emotion: none · voice_track: none

### story_rewards

## The Shrine Keeper's Register

scene_id: ch1_first_oath

location_id: forest_whispering_ash

direction_en: Inside the wayshrine, the old keeper opens a register of oaths. Brin stands guard at the door.

music_cue: bgm_ledger_motif (first statement, music-box tempo) under the register; stop on 'An invitation can only be written once.'

### lines

**Shrine Keeper** · `ch1_first_oath_001`

You saved the woodcutters' children. The road owes you a companion.

emotion: kind · voice_track: jp

**Mahmut** · `ch1_first_oath_002`

We did not ask for payment.

emotion: wary · voice_track: jp

**Shrine Keeper** · `ch1_first_oath_003`

It is not payment. It is an oath. Travelers write here that they will walk for someone else when called.

emotion: gentle · voice_track: jp

**Fadyme** · `ch1_first_oath_004`

And they come? Just like that?

emotion: curious · voice_track: jp

**Shrine Keeper** · `ch1_first_oath_005`

The oath binds their road to yours before your paths truly cross. You may meet them later as strangers. The oath remembers even when they do not.

emotion: mysterious · voice_track: jp

**Fadyme (thought)** · `ch1_first_oath_006`

A promise that remembers people who forget. I should like one of those.

emotion: wistful · voice_track: jp_inner

**Shrine Keeper** · `ch1_first_oath_007`

Choose with care. An invitation can only be written once.

emotion: solemn · voice_track: jp

## A Cart of Empty Bottles

scene_id: vn_1_3

stage_id: 1-3

location_id: forest_whispering_ash

direction_en: Glass vials roll down a muddy slope. Kera is defending her overturned cart with a brass hand mortar and a look of personal offense.

music_cue: pre: bgm_comic — pizzicato, rolling glass | post: bgm_ch1_ash_forest

battle_transition_en: Kera fills the fifth battle place as a guest unless the player already owns her. Guest presence never adds a second copy to the party.

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Kera** · `node_1_3_pre_001`

Those bottles were sorted by volatility. You have turned them into a choir.

emotion: annoyed · voice_track: jp

**Mahmut** · `node_1_3_pre_002`

We can help you gather them after the dead are gone.

emotion: calm · voice_track: jp

**Kera** · `node_1_3_pre_003`

Good. Try not to step on the red ones. Or the blue ones. Or anything that smells like almonds.

emotion: flustered · voice_track: jp

### post_battle_lines

**Kera** · `node_1_3_post_001`

Take this route map. The Red Vial Guild owes me a favor, and now it owes you one too.

emotion: proud · voice_track: jp

**Fadyme** · `node_1_3_post_002`

You are coming with us?

emotion: curious · voice_track: jp

**Kera** · `node_1_3_post_003`

No. I am going ahead to warn the Guild. This is not concern. It is field research.

emotion: tsundere · voice_track: jp

### story_rewards

## The Map’s Little Lie

scene_id: vn_1_4

stage_id: 1-4

location_id: forest_whispering_ash

direction_en: A twig snaps above the road. Nixie drops from a low branch, bow already drawn at the shadow behind the party.

music_cue: pre: silence until the twig snaps, then bgm_tension | post: bgm_warmth (party of five is complete)

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Nixie** · `node_1_4_pre_001`

Do not follow the map. The map is lying. The wolves learned the road from it.

emotion: urgent · voice_track: jp

**Mahmut** · `node_1_4_pre_002`

And you learned that by climbing a tree?

emotion: skeptical · voice_track: jp

**Nixie** · `node_1_4_pre_003`

I learned it by being chased up one. There is a difference.

emotion: genki · voice_track: jp

### post_battle_lines

**Nixie** · `node_1_4_post_001`

I was going to Oakhaven anyway. I will take the rear watch.

emotion: decisive · voice_track: jp

**Fadyme** · `node_1_4_post_002`

You do not have to stay with us.

emotion: gentle · voice_track: jp

**Nixie** · `node_1_4_post_003`

I know. That is why I can choose to.

emotion: warm · voice_track: jp

**Narration** · `node_1_4_post_004`

Nixie joins permanently. The company now has five owned heroes: Mahmut, Fadyme, Brin, Nixie and the companion chosen by invitation.

emotion: none · voice_track: none

### story_rewards

## The Ash-Maw

scene_id: vn_1_5

stage_id: 1-5

location_id: forest_whispering_ash

direction_en: A dead wolf rises from the shrine ditch with a cracked bell fused through its jaw. The air goes silent around it.

music_cue: pre: silence — the air goes silent around the wolf; no music until the battle starts | battle: bgm_boss_beast | post: sting_bell_toll (the bell stops), then bgm_ch1_ash_forest (uneasy layer)

battle_transition_en: The boss has a visible two-phase transition; intent and target markers remain legible at x1, x2 or x3.

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Nixie** · `node_1_5_pre_001`

That is not a wolf. That is what the bell left wearing one.

emotion: fear · voice_track: jp

**Mahmut** · `node_1_5_pre_002`

Front line, hold. Rear line, wait for the jaw to open.

emotion: command · voice_track: jp

**Fadyme** · `node_1_5_pre_003`

When it opens, strike the clapper. We only get one clean chance.

emotion: focused · voice_track: jp

### post_battle_lines

**Brin** · `node_1_5_post_001`

The bell stopped. The trees are still whispering.

emotion: uneasy · voice_track: jp

**Fadyme** · `node_1_5_post_002`

They will forget the sound by morning.

emotion: false_reassurance · voice_track: jp

**Mahmut** · `node_1_5_post_003`

Your hand is freezing.

emotion: concern · voice_track: jp

**Fadyme** · `node_1_5_post_004`

Rain does that. I am perfectly fine.

emotion: smile · voice_track: jp

**Fadyme (thought)** · `node_1_5_post_005`

My fingertips have gone pale. I will tell him after the next town.

emotion: sad · voice_track: jp_inner

## Ash That Falls Upward

scene_id: ch1_camp

location_id: forest_whispering_ash

direction_en: Night after the Ash-Maw. The company camps at the shrine. Far off, a cracked handbell rings once; the ash above the fire drifts up instead of down.

music_cue: bgm_camp (acoustic, fire) — one far cracked handbell, then the camp theme thins to a single cello

### lines

**Brin** · `ch1_camp_001`

The trees stopped whispering.

emotion: quiet · voice_track: jp

**Nixie** · `ch1_camp_002`

No. Listen. They are whispering someone else's name now.

emotion: alert · voice_track: jp

**Narration** · `ch1_camp_003`

Beyond the firelight, a single cracked bell rang, then went still.

emotion: tense · voice_track: jp_narration

**Mahmut** · `ch1_camp_004`

Her.

emotion: hard · voice_track: jp

**Fadyme** · `ch1_camp_005`

She is not coming closer. She wants us to know she is there.

emotion: steady · voice_track: jp

**Fadyme (thought)** · `ch1_camp_006`

The widow's bell. It rang like that the night Mother's portrait came down.

emotion: shaken · voice_track: jp_inner

**Mahmut** · `ch1_camp_007`

Sleep. I will watch.

emotion: protective · voice_track: jp

**Fadyme** · `ch1_camp_008`

You always say that. One day I will watch, and you will sleep.

emotion: light · voice_track: jp

## The Tower Across the Fields

scene_id: ch2_road

location_id: forest_edge_road

direction_en: Morning. Beyond the last ash trees, the bell tower of Saint Luthos rises over flooded fields. It has no rope.

music_cue: bgm_road — morning, flooded fields; the ropeless tower gets a held note, no bell

### lines

**Nixie** · `ch2_road_001`

Cathedral by noon if the fields do not eat our boots.

emotion: brisk · voice_track: jp

**Fadyme** · `ch2_road_002`

I prayed there once. I was small enough to hide under the pews.

emotion: wistful · voice_track: jp

**Mahmut** · `ch2_road_003`

You never told me.

emotion: gentle · voice_track: jp

**Fadyme** · `ch2_road_004`

I am telling you now. See? I tell you things.

emotion: wry · voice_track: jp

**Fadyme (thought)** · `ch2_road_005`

Small things. Only small things.

emotion: guilt · voice_track: jp_inner

## Rain in the Nave

scene_id: vn_2_1

stage_id: 2-1

location_id: cathedral_saint_luthos

direction_en: Rain falls through the broken rose window. Fadyme stops at the nave threshold when an unstrung bell answers from above.

music_cue: pre: bgm_ch2_cathedral — rain through the rose window, organ pedal note; the unstrung bell answers with sting_bell_toll | post: bgm_ch2_cathedral (uneasy layer)

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Brin** · `node_2_1_pre_000`

The forest road is full of people running from the bells. I will walk them to the lowland shrine. Keep the next bell quiet until I catch up.

emotion: resolved · voice_track: jp

**Aveline** · `node_2_1_pre_001`

Pilgrims first. Questions after. The clerics sealed the east aisle.

emotion: firm_kind · voice_track: jp

**Mahmut** · `node_2_1_pre_002`

We will open it.

emotion: steady · voice_track: jp

**Fadyme** · `node_2_1_pre_003`

That bell has no rope.

emotion: uneasy · voice_track: jp

### post_battle_lines

**Aveline** · `node_2_1_post_001`

The sound is coming from inside the stone.

emotion: grave · voice_track: jp

**Fadyme** · `node_2_1_post_002`

Then the stone remembers what we have forgotten.

emotion: quiet · voice_track: jp

**Fadyme (thought)** · `node_2_1_post_003`

It remembers my name.

emotion: fear · voice_track: jp_inner

## The Choir Without Breath

scene_id: vn_2_2

stage_id: 2-2

location_id: cathedral_saint_luthos

direction_en: Two Choir Knights sing without moving their mouths. A pale ward passes from shield to shield.

music_cue: pre: bgm_ch2_cathedral with wordless male choir (the Choir Knights) | post: bgm_warmth (Aveline, candles)

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Aveline** · `node_2_2_pre_001`

Their ward is shared. Strike the bond, not the armor.

emotion: focused · voice_track: jp

**Mahmut** · `node_2_2_pre_002`

Can you get the pilgrims through?

emotion: concern · voice_track: jp

**Aveline** · `node_2_2_pre_003`

I can get them out. You can make the passage safe.

emotion: confident · voice_track: jp

### post_battle_lines

**Aveline** · `node_2_2_post_001`

I will stay until every candle in the refuge is lit. Then I will follow the records.

emotion: resolved · voice_track: jp

**Fadyme** · `node_2_2_post_002`

You should not have to choose between people and the truth.

emotion: soft · voice_track: jp

**Aveline** · `node_2_2_post_003`

Someone always has to choose. Let us make sure it is not the children.

emotion: gentle · voice_track: jp

## The Guest Roll

scene_id: vn_2_3

stage_id: 2-3

location_id: cathedral_saint_luthos

direction_en: Mirel unrolls a guest register under a brass reading lens. One line has been scraped so deeply that the parchment is nearly split.

music_cue: pre: bgm_tension (low, investigative, clock-like pulse) | post: bgm_revelation (short) on 'exactly where the heir's name should be'

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Mirel** · `node_2_3_pre_001`

This register lists every royal visitor since the old king was crowned. One name was removed with a knife.

emotion: observant · voice_track: jp

**Fadyme** · `node_2_3_pre_002`

Perhaps the ink had spoiled.

emotion: controlled · voice_track: jp

**Mirel** · `node_2_3_pre_003`

Ink fades. This was erased by someone afraid it would be read.

emotion: dry · voice_track: jp

**Mirel** · `node_2_3_pre_004`

And the cut is fresh. Last winter, not years ago. Someone is still erasing this name.

emotion: grave · voice_track: jp

### post_battle_lines

**Mirel** · `node_2_3_post_001`

There is a gap exactly where the heir’s name should be.

emotion: grave · voice_track: jp

**Mahmut** · `node_2_3_post_002`

You know who belongs there.

emotion: measured · voice_track: jp

**Fadyme** · `node_2_3_post_003`

I know who they wanted the world to forget.

emotion: sad · voice_track: jp

**Fadyme (thought)** · `node_2_3_post_004`

And the world is already doing it.

emotion: fear · voice_track: jp_inner

## A Page Beneath the Font

scene_id: vn_2_4

stage_id: 2-4

location_id: cathedral_saint_luthos

direction_en: Aveline lifts a waterlogged page from beneath the font. Mirel holds its edges together while candlelight reveals one surviving sentence.

music_cue: pre: bgm_quiet_sorrow | post: bgm_quiet_sorrow fades out on 'mercy'

### story_guests

### pre_battle_lines

**Aveline** · `node_2_4_pre_001`

A life held against the dark. That is the rite’s promise.

emotion: reading · voice_track: jp

**Mirel** · `node_2_4_pre_002`

The sentence continues on a page someone carried away.

emotion: focused · voice_track: jp

**Mahmut** · `node_2_4_pre_003`

Who wrote the promise?

emotion: direct · voice_track: jp

### post_battle_lines

**Fadyme** · `node_2_4_post_001`

The person who wrote it may have thought it was mercy.

emotion: guarded · voice_track: jp

**Mahmut** · `node_2_4_post_002`

Mercy does not need a missing page.

emotion: grim · voice_track: jp

**Fadyme** · `node_2_4_post_003`

No. But people do.

emotion: quiet · voice_track: jp

## The Bell-Widow’s Verdict

scene_id: vn_2_5

stage_id: 2-5

location_id: cathedral_saint_luthos

direction_en: At the archive door, Yseldra waits beneath the bell tower. Seven wax seals hang from her chain, each cut through the center.

music_cue: pre: bgm_bell_widow — first full statement; Yseldra's seven seals click as percussion | battle: bgm_boss_bell_widow | post: bgm_tension, cut to silence on 'She escaped.'

battle_transition_en: Yseldra retreats alive; the scene contains no execution or kill animation. Nixie departs to warn Oakhaven.

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Yseldra** · `node_2_5_pre_001`

You found the record. You still do not know what it asks of her.

emotion: controlled · voice_track: jp

**Mahmut** · `node_2_5_pre_002`

Then tell us.

emotion: angry · voice_track: jp

**Yseldra** · `node_2_5_pre_003`

The altar does not cure. It keeps a wound open until the kingdom can be put back inside it.

emotion: grave · voice_track: jp

**Fadyme** · `node_2_5_pre_004`

You came to take me away.

emotion: quiet · voice_track: jp

**Yseldra** · `node_2_5_pre_005`

I came to stop the next sacrifice. I will not pretend that makes my choice yours.

emotion: honest · voice_track: jp

**Yseldra** · `node_2_5_pre_006`

And you, Sir Mahmut. You told her you did not know me.

emotion: cold · voice_track: jp

**Fadyme** · `node_2_5_pre_007`

Mahmut?

emotion: stunned · voice_track: jp

**Mahmut** · `node_2_5_pre_008`

Not now.

emotion: tight · voice_track: jp

### post_battle_lines

**Mahmut** · `node_2_5_post_001`

She escaped.

emotion: frustrated · voice_track: jp

**Mirel** · `node_2_5_post_002`

She could have killed us. She chose the bell tower instead.

emotion: uneasy · voice_track: jp

**Yseldra (distant)** · `node_2_5_post_003`

Ask who keeps the hour running.

emotion: warning · voice_track: jp

**Nixie** · `node_2_5_post_004`

Oakhaven is marked on the map. I will warn them before the soldiers arrive.

emotion: urgent · voice_track: jp

**Fadyme (thought)** · `node_2_5_post_005`

She knows I am dying. That does not mean I can let Mahmut know.

emotion: fear · voice_track: jp_inner

**Fadyme (thought)** · `node_2_5_post_006`

He lied to me, gently. So we are both keeping something.

emotion: hurt · voice_track: jp_inner

## What We Did Not Say

scene_id: ch2_camp

location_id: cathedral_saint_luthos

direction_en: The cathedral refuge after the Bell-Widow's escape. Fadyme finds Mahmut on the tower stair.

music_cue: bgm_fadyme_theme (solo piano, slow) on the tower stair; no strings until the last line

### lines

**Fadyme** · `ch2_camp_001`

You knew her.

emotion: quiet · voice_track: jp

**Mahmut** · `ch2_camp_002`

Yes.

emotion: low · voice_track: jp

**Fadyme** · `ch2_camp_003`

You said no. In the rain. You said it very fast.

emotion: steady · voice_track: jp

**Mahmut** · `ch2_camp_004`

I thought if you did not know her, she could not frighten you.

emotion: ashamed · voice_track: jp

**Fadyme** · `ch2_camp_005`

That is a very foolish reason.

emotion: soft · voice_track: jp

**Fadyme (thought)** · `ch2_camp_006`

And it is mine too. I cannot scold him without scolding myself.

emotion: guilt · voice_track: jp_inner

**Fadyme** · `ch2_camp_007`

Tell me the rest when you can. I will not ask tonight.

emotion: gentle · voice_track: jp

**Mahmut** · `ch2_camp_008`

That is a kinder bargain than I deserve.

emotion: tired · voice_track: jp

## Orchard Country

scene_id: ch3_road

location_id: orchard_lowlands

direction_en: Three days of orchard roads. Fadyme walks slower on the hills; Mahmut adjusts his pace without comment.

music_cue: bgm_road (slower tempo than ch2_road: Fadyme walks slower); hint of bgm_mahmut_theme when he adjusts his pace

### lines

**Mahmut** · `ch3_road_001`

We will stop at the next wall.

emotion: casual · voice_track: jp

**Fadyme** · `ch3_road_002`

You stopped at the last wall. And the one before.

emotion: dry · voice_track: jp

**Mahmut** · `ch3_road_003`

They were good walls.

emotion: deadpan · voice_track: jp

**Fadyme** · `ch3_road_004`

You are pacing yourself for me.

emotion: knowing · voice_track: jp

**Mahmut** · `ch3_road_005`

I am pacing myself for the walls.

emotion: deadpan · voice_track: jp

**Narration** · `ch3_road_006`

She laughed, and then coughed, and turned her face into her scarf before he could see.

emotion: somber · voice_track: jp_narration

## The Empty Orchard

scene_id: vn_3_1

stage_id: 3-1

location_id: village_oakhaven

direction_en: Nixie leads the company beneath bare apple trees. The fruit is still on the branches, but every name board in the orchard is blank.

music_cue: pre: bgm_ch3_oakhaven (uneasy layer from the start: the name boards are blank) | post: bgm_ch3_oakhaven

### story_guests

### pre_battle_lines

**Nixie** · `node_3_1_pre_001`

I warned them. The names are gone anyway.

emotion: serious · voice_track: jp

**Mahmut** · `node_3_1_pre_002`

Who took them?

emotion: watchful · voice_track: jp

**Nixie** · `node_3_1_pre_003`

The men with red glass on their weapons. They are looking for Fadyme.

emotion: alert · voice_track: jp

### post_battle_lines

**Fadyme** · `node_3_1_post_001`

A village can survive losing a name.

emotion: quiet · voice_track: jp

**Nixie** · `node_3_1_post_002`

A person should not have to prove they belong in their own home.

emotion: angry · voice_track: jp

**Mahmut** · `node_3_1_post_003`

Then we give the names back.

emotion: resolved · voice_track: jp

**Fadyme (thought)** · `node_3_1_post_004`

Every year I hid, someone else paid my hours.

emotion: guilty · voice_track: jp_inner

## A Smith’s Last Bell

scene_id: vn_3_2

stage_id: 3-2

location_id: village_oakhaven

direction_en: Jori has wedged her compact forge shield beneath the gate. She is too small to hold the door alone, but refuses to step away. Kera arrives on the Guild road with her rebuilt cart.

music_cue: pre: bgm_tension (hammered anvil hits in the rhythm) | post: bgm_warmth (Jori held the gate)

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Jori** · `node_3_2_pre_001`

If the gate falls, the forge is next. If the forge falls, they take the tools.

emotion: stubborn · voice_track: jp

**Kera** · `node_3_2_pre_002`

You can replace tools. You cannot replace a village.

emotion: impatient · voice_track: jp

**Jori** · `node_3_2_pre_003`

I know. That is why I am still standing here.

emotion: earnest · voice_track: jp

### post_battle_lines

**Mahmut** · `node_3_2_post_001`

You held the gate long enough for everyone to run.

emotion: respectful · voice_track: jp

**Jori** · `node_3_2_post_002`

I made the shield because I was tired of doors being the only thing between us and danger.

emotion: honest · voice_track: jp

**Fadyme** · `node_3_2_post_003`

Then walk with us. A shield belongs where people need it.

emotion: warm · voice_track: jp

## The Well Runs Red

scene_id: vn_3_3

stage_id: 3-3

location_id: village_oakhaven

direction_en: A red-vial mercenary tips a flask into the village well. Fadyme raises her silver bell focus; the spell takes more from her than she lets anyone see.

music_cue: pre: bgm_tension | post: bgm_quiet_sorrow — very quiet; the red on the gauntlet is not scored, leave room

### story_guests

### pre_battle_lines

**Mahmut** · `node_3_3_pre_001`

Fadyme, take the left side. I have the well.

emotion: command · voice_track: jp

**Fadyme** · `node_3_3_pre_002`

I can reach both.

emotion: strained · voice_track: jp

**Jori** · `node_3_3_pre_003`

Your hand is bleeding.

emotion: alarm · voice_track: jp

**Fadyme** · `node_3_3_pre_004`

It is the mercenary’s blood. Keep the bucket moving.

emotion: deflecting · voice_track: jp

### post_battle_lines

**Mahmut** · `node_3_3_post_001`

There is red on my gauntlet.

emotion: concern · voice_track: jp

**Fadyme** · `node_3_3_post_002`

Then the enemy finally managed to hit you.

emotion: dry · voice_track: jp

**Fadyme (thought)** · `node_3_3_post_003`

I wiped my own blood on his glove. He must not count the drops.

emotion: sad · voice_track: jp_inner

## The Inn of Borrowed Names

scene_id: vn_3_4

stage_id: 3-4

location_id: village_oakhaven

direction_en: Pippa sings the lost names back to frightened villagers while a bell charm trembles at her wrist.

music_cue: pre: Pippa's song is diegetic: lute and voice only (record with her VO) | post: bgm_warmth

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Pippa** · `node_3_4_pre_001`

If the ledger forgets you, I will sing louder than the paper.

emotion: bright · voice_track: jp

**Jori** · `node_3_4_pre_002`

People are smiling again. I thought the bell took that too.

emotion: relieved · voice_track: jp

**Fadyme** · `node_3_4_pre_003`

Not everything precious can be written down.

emotion: gentle · voice_track: jp

### post_battle_lines

**Pippa** · `node_3_4_post_001`

I am carrying the names to the refuge. Someone has to keep them safe.

emotion: resolute · voice_track: jp

**Jori** · `node_3_4_post_002`

I will go with Mahmut and Fadyme. The village has its gate back.

emotion: certain · voice_track: jp

**Mahmut** · `node_3_4_post_003`

Then the road has room for one more.

emotion: warm · voice_track: jp

**Narration** · `node_3_4_post_004`

Jori joins permanently as a story recruit.

emotion: none · voice_track: none

### story_rewards

## The Mercenary Captain

scene_id: vn_3_5

stage_id: 3-5

location_id: village_oakhaven

direction_en: Captain Rusk raises a signal banner over the orchard road. A volley is already aimed at the well.

music_cue: pre: bgm_tension, snare roll under the signal banner | battle: bgm_boss_human | post: bgm_ledger_motif on 'Seven notches'

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Captain Rusk** · `node_3_5_pre_001`

The order says the heir comes quietly. It says nothing about the village.

emotion: cold · voice_track: jp

**Mahmut** · `node_3_5_pre_002`

Your order is written by cowards.

emotion: angry · voice_track: jp

**Captain Rusk** · `node_3_5_pre_003`

It was sealed by someone the Crown buried years ago.

emotion: uneasy · voice_track: jp

### post_battle_lines

**Kera** · `node_3_5_post_001`

Seven notches. Same wax as the seal on your shield. There are letters beneath it: C.V.

emotion: focused · voice_track: jp

**Mahmut** · `node_3_5_post_002`

Do those initials mean anything to you?

emotion: questioning · voice_track: jp

**Kera** · `node_3_5_post_003`

Not yet. The Red Vial ledger may know.

emotion: thoughtful · voice_track: jp

**Fadyme (thought)** · `node_3_5_post_004`

C.V. I saw those letters on my father’s last page.

emotion: shaken · voice_track: jp_inner

**Fadyme** · `node_3_5_post_005`

We should find a healer before we open the order.

emotion: deflecting · voice_track: jp

**Mahmut** · `node_3_5_post_006`

Then I will carry it, sealed, until we do.

emotion: steady · voice_track: jp

## The Sealed Order

scene_id: ch3_camp

location_id: oakhaven_inn

direction_en: Oakhaven's inn, after the captain falls. Mahmut sets Rusk's sealed order on the table between them. Nixie has stayed behind in the refuge with Oakhaven's Vale children.

music_cue: bgm_camp (inn version: indoor, fire) → bgm_tension once the sealed order is on the table

### lines

**Kera** · `ch3_camp_001`

We should open it. Knowledge is the only antidote I trust.

emotion: impatient · voice_track: jp

**Fadyme** · `ch3_camp_002`

A healer first. Please.

emotion: firm · voice_track: jp

**Jori** · `ch3_camp_003`

Why does a healer matter for paper?

emotion: confused · voice_track: jp

**Fadyme** · `ch3_camp_004`

Because whatever it says, someone at the table may need one afterward.

emotion: quiet · voice_track: jp

**Kera** · `ch3_camp_005`

...The Undercity has the best healers. And the Guild ledger.

emotion: thoughtful · voice_track: jp

**Mahmut** · `ch3_camp_006`

Then we go down.

emotion: decisive · voice_track: jp

## The River City

scene_id: ch4_road

location_id: river_city_gates

direction_en: The river city at dusk. Beneath its bridges, drainage mouths breathe cold air. Chalk arrows mark one of them. At the marked mouth, two Red Vial scouts sit bound back to back, alive, a gray seven-notched seal pressed on each collar.

music_cue: bgm_road (river city at dusk, distant crowd) → bgm_tension at the bound scouts

### lines

**Jori** · `ch4_road_001`

Someone marked that tunnel. Neat arrows. Harbor knots.

emotion: observant · voice_track: jp

**Kera** · `ch4_road_002`

The Undercity. Everything the city does not want to see goes down there. Including my Guild.

emotion: bitter · voice_track: jp

**Fadyme** · `ch4_road_003`

And its healers.

emotion: hopeful · voice_track: jp

**Kera** · `ch4_road_006`

Gray wax on Guild scouts, and the scouts still breathing. Someone is hunting my Guild's hunters.

emotion: sharp · voice_track: jp

**Mahmut** · `ch4_road_004`

Stay close below. The dark down there is not like the forest.

emotion: protective · voice_track: jp

**Fadyme** · `ch4_road_005`

I know. The forest at least whispered.

emotion: light · voice_track: jp

## Stairs Below the Cistern

scene_id: vn_4_1

stage_id: 4-1

location_id: undercity_subterranean

direction_en: Odelia’s chalk arrows lead beneath the city. The water is still, but something moves against its reflection.

music_cue: pre: bgm_ch4_undercity — dripping water, low drone | post: bgm_ch4_undercity

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Odelia** · `node_4_1_pre_001`

Do not look for ripples. These things follow the shape of your shadow.

emotion: low · voice_track: jp

**Mahmut** · `node_4_1_pre_002`

How did you find the tunnel?

emotion: curious · voice_track: jp

**Odelia** · `node_4_1_pre_003`

I followed the people who stopped coming back.

emotion: plain · voice_track: jp

### post_battle_lines

**Odelia** · `node_4_1_post_001`

The nest is behind us. The Guild ward is ahead.

emotion: measured · voice_track: jp

**Fadyme** · `node_4_1_post_002`

You did not have to follow us down here.

emotion: kind · voice_track: jp

**Odelia** · `node_4_1_post_003`

I dislike unanswered tracks. Yours are the loudest.

emotion: dry · voice_track: jp

## The Red Vial Ward

scene_id: vn_4_2

stage_id: 4-2

location_id: undercity_subterranean

direction_en: Tilda and Iona have turned a storage room into a clinic. Kera sets the recovered ledger beside their medicine jars.

music_cue: pre: bgm_warmth (muted: a clinic in a storage room) | post: bgm_quiet_sorrow on 'Fear takes longer.'

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Tilda** · `node_4_2_pre_001`

We have one clean table and three patients. I can make it four if you stop bleeding on it.

emotion: dry_kind · voice_track: jp

**Iona** · `node_4_2_pre_002`

She means welcome. Sit down before you fall down.

emotion: calm · voice_track: jp

**Kera** · `node_4_2_pre_003`

I brought the ledger. Do not let anyone spill medicine on it.

emotion: tsundere · voice_track: jp

### post_battle_lines

**Tilda** · `node_4_2_post_001`

The poison is gone. Fear takes longer.

emotion: gentle · voice_track: jp

**Iona** · `node_4_2_post_002`

We will reopen this ward after the Guild is settled.

emotion: resolved · voice_track: jp

**Fadyme** · `node_4_2_post_003`

You have given the city a place to breathe.

emotion: warm · voice_track: jp

**Iona** · `node_4_2_post_004`

Then keep breathing while you are in it.

emotion: quiet · voice_track: jp

**Tilda** · `node_4_2_post_005`

The captain's order you carried, Sir Knight. It does not ask for her. It asks for her blood, sealed and delivered.

emotion: grim · voice_track: jp

**Kera** · `node_4_2_post_006`

Then someone in my Guild wrote a recipe around a person.

emotion: furious · voice_track: jp

## The Measure of a Life

scene_id: vn_4_3

stage_id: 4-3

location_id: undercity_subterranean

direction_en: Clem unlocks a narrow archive room. Mahmut waits at the stairwell while Fadyme asks for a private reading.

music_cue: pre: bgm_ch4_undercity (uneasy layer) | post: bgm_fadyme_theme — first time the theme is played in a minor key

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Clem** · `node_4_3_pre_001`

You asked for a truth with no witnesses. I can give you one.

emotion: matter_of_fact · voice_track: jp

**Undercity Alchemist** · `node_4_3_pre_002`

Not a month now. Weeks, perhaps less, if the bell keeps calling.

emotion: grave · voice_track: jp

**Fadyme** · `node_4_3_pre_003`

And if I stop answering?

emotion: controlled · voice_track: jp

**Undercity Alchemist** · `node_4_3_pre_004`

Then perhaps the bell will take the answer from someone else.

emotion: sad · voice_track: jp

### post_battle_lines

**Clem** · `node_4_3_post_001`

He will ask what I told you.

emotion: concern · voice_track: jp

**Fadyme** · `node_4_3_post_002`

Tell him the elixir might work.

emotion: quiet · voice_track: jp

**Clem** · `node_4_3_post_003`

That is a lie.

emotion: direct · voice_track: jp

**Fadyme** · `node_4_3_post_004`

It is a small one. Let me keep it.

emotion: pleading · voice_track: jp

**Fadyme (thought)** · `node_4_3_post_005`

Mahmut has already given enough years to my name.

emotion: sad · voice_track: jp_inner

## The Elixir Lie

scene_id: vn_4_4

stage_id: 4-4

location_id: undercity_subterranean

direction_en: Fadyme returns with a sealed vial. Kera recognizes the mixture from the guild ledger and sees the label is false. Later, alone, Fadyme refolds the letter from the forest road and tucks it deeper into her mother's prayer book.

music_cue: pre: bgm_tension | post: bgm_fadyme_theme (piano only) while she refolds the letter; silence before 'I will not promise a cure.'

### story_guests

### pre_battle_lines

**Mahmut** · `node_4_4_pre_001`

What did the alchemist say?

emotion: careful · voice_track: jp

**Fadyme** · `node_4_4_pre_002`

That the elixir might work.

emotion: steady · voice_track: jp

**Kera** · `node_4_4_pre_003`

The label is wrong. The recipe is incomplete.

emotion: low · voice_track: jp

**Fadyme** · `node_4_4_pre_004`

Then complete it. You are good at turning bad mixtures into useful ones.

emotion: soft · voice_track: jp

**Kera** · `node_4_4_pre_005`

And those are Chain Cultists on the stair. They pray to an eclipse that never moves, and they pay the Guild in silver for glass.

emotion: bitter · voice_track: jp

### post_battle_lines

**Kera** · `node_4_4_post_001`

I will try. I will not promise a cure.

emotion: honest · voice_track: jp

**Mahmut** · `node_4_4_post_002`

That is enough for tonight.

emotion: tired · voice_track: jp

**Fadyme (thought)** · `node_4_4_post_003`

He accepted a hope because I asked him to. I will have to live with that.

emotion: guilt · voice_track: jp_inner

## The Red Vial Matron

scene_id: vn_4_5

stage_id: 4-5

location_id: undercity_subterranean

direction_en: The Matron seals herself behind a glass ward and floods the chamber with corrosive vapor.

music_cue: pre: bgm_tension (glass harmonics) | battle: bgm_boss_human (alchemist variation) | post: bgm_warmth (Kera stays)

battle_transition_en: Kera remains to preserve the archive; Tilda and Iona return to the clinic.

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Red Vial Matron** · `node_4_5_pre_001`

The heir’s blood is not a cure. It is the last ingredient.

emotion: hungry · voice_track: jp

**Kera** · `node_4_5_pre_002`

I knew the Guild was using the wrong formula. I did not know it was using her.

emotion: furious · voice_track: jp

**Fadyme** · `node_4_5_pre_003`

Break the flasks. Do not let her finish the sentence.

emotion: focused · voice_track: jp

### post_battle_lines

**Kera** · `node_4_5_post_001`

I am staying to copy every page of the antidote archive.

emotion: resolved · voice_track: jp

**Tilda** · `node_4_5_post_002`

Iona and I will reopen the clinic. The patients need a door that stays open.

emotion: firm_kind · voice_track: jp

**Iona** · `node_4_5_post_007`

I will hang the lantern first. People should see the door before they need it.

emotion: calm · voice_track: jp

**Mahmut** · `node_4_5_post_003`

We will come back for you.

emotion: promise · voice_track: jp

**Kera** · `node_4_5_post_004`

Bring the missing formula. I will bring the rest.

emotion: determined · voice_track: jp

**Jori** · `node_4_5_post_006`

Oakhaven has no smith while I am down here. I am going home to hold the gate. Send word when something needs a door.

emotion: firm · voice_track: jp

**Fadyme (thought)** · `node_4_5_post_005`

Weeks. Perhaps less. The words do not become kinder when repeated.

emotion: sad · voice_track: jp_inner

## Up Into the Light

scene_id: ch4_camp

location_id: river_city_gates

direction_en: They climb out of the Undercity at dawn. Fadyme stops on the last stair to feel the sun.

music_cue: bgm_fadyme_theme (major, strings join) as she stops in the sun; the brightest cue of Part I

### lines

**Mahmut** · `ch4_camp_001`

You are smiling.

emotion: surprised · voice_track: jp

**Fadyme** · `ch4_camp_002`

The sun is warm. I had forgotten it was allowed to be.

emotion: soft · voice_track: jp

**Mahmut** · `ch4_camp_003`

The elixir. Did Kera say when?

emotion: hopeful · voice_track: jp

**Fadyme** · `ch4_camp_004`

Soon. She is very good at soon.

emotion: steady · voice_track: jp

**Fadyme (thought)** · `ch4_camp_005`

Weeks. I will spend some of them standing in the sun. That much I can choose.

emotion: bittersweet · voice_track: jp_inner

**Mahmut** · `ch4_camp_006`

East, then. The altar road crosses the ravine.

emotion: resolved · voice_track: jp

## Fog in the Ravine

scene_id: ch5_road

location_id: eastern_ravine_road

direction_en: Four days east. Refugees move the other way, carrying carts and children.

music_cue: bgm_road (against the flow of refugees; muted)

### lines

**Refugee** · `ch5_road_001`

Do not cross the old bridge. Soldiers on it. Crown colors, upside down.

emotion: afraid · voice_track: jp

**Mahmut** · `ch5_road_002`

Whose soldiers?

emotion: hard · voice_track: jp

**Refugee** · `ch5_road_003`

A marshal's. They are looking for a woman with a bell pin.

emotion: afraid · voice_track: jp

**Fadyme** · `ch5_road_004`

Then she had better keep her hood up.

emotion: wry · voice_track: jp

**Mahmut (thought)** · `ch5_road_005`

Crown colors, upside down. Oren always hated sloppy banners.

emotion: grim · voice_track: jp_inner

## A Banner in the Fog

scene_id: vn_5_1

stage_id: 5-1

location_id: bridge_forsaken

direction_en: A herald’s pennant appears through ravine mist. Marek recognizes the empty crest socket on Mahmut’s armor.

music_cue: pre: bgm_ch5_bridge — fog, wind in chains; a solo horn for Marek's pennant | post: bgm_mahmut_theme (Marek recognizes the crest)

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Marek** · `node_5_1_pre_001`

That socket used to carry a crown. The road has not forgotten.

emotion: measured · voice_track: jp

**Mahmut** · `node_5_1_pre_002`

The road remembers a version of me that no longer exists.

emotion: guarded · voice_track: jp

**Marek** · `node_5_1_pre_003`

Good. Then it can remember this one too.

emotion: warm · voice_track: jp

### post_battle_lines

**Marek** · `node_5_1_post_001`

The refugees are across. I will carry your warning to the next watch post.

emotion: resolved · voice_track: jp

**Fadyme** · `node_5_1_post_002`

You sing as if the bridge is still standing.

emotion: curious · voice_track: jp

**Marek** · `node_5_1_post_003`

A road is not a stone span. It is whoever agrees to walk it.

emotion: gentle · voice_track: jp

## The Gatekeeper’s Measure

scene_id: vn_5_2

stage_id: 5-2

location_id: bridge_forsaken

direction_en: Nara braces a narrow gate while two siege winches pull its chains tight.

music_cue: pre: bgm_ch5_bridge (uneasy layer), winch ratchets as percussion | post: bgm_warmth

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Nara** · `node_5_2_pre_001`

The gate can hold for one minute. The winches can be stopped in ten seconds. Choose the faster danger.

emotion: command · voice_track: jp

**Mahmut** · `node_5_2_pre_002`

You hold the civilians. We take the winches.

emotion: certain · voice_track: jp

**Nara** · `node_5_2_pre_003`

That is the right order. Do not make me repeat it.

emotion: cool · voice_track: jp

### post_battle_lines

**Nara** · `node_5_2_post_001`

The civilians are clear. I will stay with the gate until the last cart crosses.

emotion: resolved · voice_track: jp

**Fadyme** · `node_5_2_post_002`

You always put yourself between people and the fall.

emotion: soft · voice_track: jp

**Nara** · `node_5_2_post_003`

Someone has to be the first thing the stone hits.

emotion: plain · voice_track: jp

## A Knife Between Orders

scene_id: vn_5_3

stage_id: 5-3

location_id: bridge_forsaken

direction_en: Sable and Rikka slip into a signal tower while the party draws guards away from the bell rope.

music_cue: pre: bgm_tension (stealth, pizzicato) | post: bgm_revelation on 'This order names Fadyme.'

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Rikka** · `node_5_3_pre_001`

I can break the door. I can also break the whole wall. Which one do you want?

emotion: competitive · voice_track: jp

**Sable** · `node_5_3_pre_002`

The door. We are rescuing prisoners, not improving the view.

emotion: deadpan · voice_track: jp

**Rikka** · `node_5_3_pre_003`

You make every plan sound less fun.

emotion: pout · voice_track: jp

### post_battle_lines

**Sable** · `node_5_3_post_001`

This order names Fadyme. The seal belongs to the old Crown Guard.

emotion: low · voice_track: jp

**Mahmut** · `node_5_3_post_002`

My commander signed it.

emotion: stunned · voice_track: jp

**Fadyme** · `node_5_3_post_003`

Then we ask him why.

emotion: quiet · voice_track: jp

**Sable** · `node_5_3_post_004`

If he answers honestly, I will be surprised.

emotion: cool · voice_track: jp

## The White Strand

scene_id: vn_5_4

stage_id: 5-4

location_id: bridge_forsaken

direction_en: Odelia warns the party about mines. A bell pulse crosses the bridge; one lock of Fadyme’s ash-pale hair turns stark white, whiter than bone.

music_cue: pre: bgm_ch5_bridge | the bell pulse: sting_bell_toll, then silence while the lock turns white; bgm_fadyme_theme returns only on 'Only tired.' | post: bgm_quiet_sorrow

### story_guests

### pre_battle_lines

**Odelia** · `node_5_4_pre_001`

The stones are hollow under the third span. Do not run when the bell rings.

emotion: urgent · voice_track: jp

**Fadyme** · `node_5_4_pre_002`

I was not going to run.

emotion: breathless · voice_track: jp

**Mahmut** · `node_5_4_pre_003`

Your voice changed. Are you hurt?

emotion: concern · voice_track: jp

### post_battle_lines

**Fadyme** · `node_5_4_post_001`

Only tired. The wind is colder here.

emotion: false_calm · voice_track: jp

**Mahmut** · `node_5_4_post_002`

You have been tired since the forest.

emotion: quiet · voice_track: jp

**Fadyme** · `node_5_4_post_003`

Then I have been consistent.

emotion: small_smile · voice_track: jp

**Mahmut** · `node_5_4_post_005`

Consistent is not the same as well.

emotion: quiet · voice_track: jp

**Narration** · `node_5_4_post_006`

She does not answer. For the first time, he does not let the question go, and for the first time, she has nothing ready.

emotion: somber · voice_track: jp_narration

**Fadyme (thought)** · `node_5_4_post_004`

A white strand. One more thing the mirror will remember before he does.

emotion: sad · voice_track: jp_inner

## The Commander Who Remained

scene_id: vn_5_5

stage_id: 5-5

location_id: bridge_forsaken

direction_en: Marshal Oren waits at the far end of the bridge with a shield line and Mahmut’s old crest painted upside down.

music_cue: pre: bgm_mahmut_theme (minor, slow march) facing Oren | battle: bgm_boss_human (commander variation, march snare) | post: bgm_mahmut_theme, solo cello

battle_transition_en: Oren stays to hold the bridge; Marek and Nara escort survivors, Rikka returns to her kiln company, and Sable advances toward the estate.

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Oren** · `node_5_5_pre_001`

I gave the order. I did not know the rite would hollow her out.

emotion: strained · voice_track: jp

**Mahmut** · `node_5_5_pre_002`

You knew enough to send men after her.

emotion: anger · voice_track: jp

**Oren** · `node_5_5_pre_003`

I thought the seal would save the kingdom without consuming its heir.

emotion: shame · voice_track: jp

**Fadyme** · `node_5_5_pre_004`

You thought a promise was the same as a plan.

emotion: cold · voice_track: jp

**Oren** · `node_5_5_pre_005`

Yseldra carried the order from the Inquisition. I signed it. That is the whole of my courage.

emotion: shame · voice_track: jp

### post_battle_lines

**Oren** · `node_5_5_post_001`

The Ashen estate has the full schedule. Go before the bridge falls.

emotion: regret · voice_track: jp

**Mahmut** · `node_5_5_post_002`

You are coming with us.

emotion: hard · voice_track: jp

**Oren** · `node_5_5_post_003`

No. Someone must keep this span open. I will not fail the people twice.

emotion: resolved · voice_track: jp

**Rikka** · `node_5_5_post_005`

My kiln company is guarding the refugee road. They need someone loud. I am extremely loud!

emotion: determined · voice_track: jp

**Fadyme (thought)** · `node_5_5_post_004`

The white strand is small. I can still hide something small.

emotion: sad · voice_track: jp_inner

## Watch Kept

scene_id: ch5_camp

location_id: bridge_far_bank

direction_en: Night on the far bank. Mahmut sits with his back to the bridge. Fadyme brings two cups of weak tea.

music_cue: bgm_camp (night, very sparse); two cups of tea: no melody, just a warm pad

### lines

**Fadyme** · `ch5_camp_001`

You have not spoken since the span.

emotion: gentle · voice_track: jp

**Mahmut** · `ch5_camp_002`

He taught me to hold a shield. He signed the order that made me drop it.

emotion: hollow · voice_track: jp

**Fadyme** · `ch5_camp_003`

And tonight he held a bridge.

emotion: soft · voice_track: jp

**Mahmut** · `ch5_camp_004`

Does that make him better or worse?

emotion: raw · voice_track: jp

**Fadyme** · `ch5_camp_005`

It makes him a man who was late. You know how that feels.

emotion: quiet · voice_track: jp

**Narration** · `ch5_camp_006`

For once, she kept watch, and he slept.

emotion: warm · voice_track: jp_narration

## The Estate Road

scene_id: ch6_road

location_id: eastern_highland_road

direction_en: The estate road climbs through soot-dark pines. A lantern flickers three times from a high window. On the milestone below it, a gray seven-notched seal, still soft.

music_cue: bgm_road (soot pines, lantern signal) → bgm_bell_widow motif (handbell only) at the soft gray seal

### lines

**Mahmut** · `ch6_road_001`

A signal.

emotion: alert · voice_track: jp

**Fadyme** · `ch6_road_002`

Sable. She said she would open a door from inside.

emotion: relieved · voice_track: jp

**Mahmut** · `ch6_road_003`

You trust her.

emotion: searching · voice_track: jp

**Fadyme** · `ch6_road_004`

She opens doors for others and never walks through first. People like that keep their word.

emotion: perceptive · voice_track: jp

**Fadyme** · `ch6_road_005`

Gray wax on the milestone, still soft. She passed here this morning. She is ahead of us.

emotion: uneasy · voice_track: jp

**Mahmut** · `ch6_road_006`

Then she reaches the altar before we do.

emotion: grim · voice_track: jp

## The Servants’ Entrance

scene_id: vn_6_1

stage_id: 6-1

location_id: estate_ashen_lord

direction_en: Sable opens the servants’ entrance from inside. A dozen servants wait in the dark, afraid to speak above a whisper.

music_cue: pre: bgm_ch6_estate — whispering, soft clock ticks that stop and start | post: bgm_warmth (muted)

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Sable** · `node_6_1_pre_001`

No names until we are outside. The walls listen here.

emotion: hushed · voice_track: jp

**Hana** · `node_6_1_pre_002`

There are children under the stair. I can get them out.

emotion: nervous · voice_track: jp

**Mahmut** · `node_6_1_pre_003`

Take the rear passage. We will keep the sentinel busy.

emotion: steady · voice_track: jp

### post_battle_lines

**Hana** · `node_6_1_post_001`

They are safe. I thought my hands would shake more.

emotion: relieved · voice_track: jp

**Sable** · `node_6_1_post_002`

They did shake. You still opened the door.

emotion: respectful · voice_track: jp

**Fadyme** · `node_6_1_post_003`

That is often what courage looks like.

emotion: warm · voice_track: jp

**Clem** · `node_6_1_post_004`

There is a row of graves behind this wing. No names. I am coming back for them.

emotion: grim · voice_track: jp

## Portraits Without Names

scene_id: vn_6_2

stage_id: 6-2

location_id: estate_ashen_lord

direction_en: The gallery contains portraits with their nameplates cut away. Mirel and Aveline arrive with the cathedral folio; Odelia's message found them. In one portrait, a court official's gloved hand rests beside a watch with no hands.

music_cue: pre: bgm_ch6_estate (uneasy layer) | post: bgm_fadyme_theme + bgm_ledger_motif together on 'She was my mother.'

### story_guests

### pre_battle_lines

**Mirel** · `node_6_2_pre_001`

Someone removed the names but left the faces. A very specific kind of cowardice.

emotion: wry · voice_track: jp

**Aveline** · `node_6_2_pre_002`

Or a person trying to hide the victims from the rite.

emotion: thoughtful · voice_track: jp

**Hana** · `node_6_2_pre_003`

This woman has the same bell pin as Fadyme.

emotion: quiet · voice_track: jp

### post_battle_lines

**Fadyme** · `node_6_2_post_001`

She was my mother.

emotion: soft · voice_track: jp

**Mahmut** · `node_6_2_post_002`

You never told me she was here.

emotion: gentle · voice_track: jp

**Fadyme** · `node_6_2_post_003`

I was not sure I remembered her correctly.

emotion: sad · voice_track: jp

**Mirel** · `node_6_2_post_004`

Then we will remember the portrait for you.

emotion: kind · voice_track: jp

**Mirel** · `node_6_2_post_005`

Wait. The order that cut these names was copied in my hand. I was a court scribe. I never asked whose names they were.

emotion: stricken · voice_track: jp

**Fadyme** · `node_6_2_post_006`

Then you know how easily it happens. That is not the same as choosing it.

emotion: gentle · voice_track: jp

## The Sealed Conservatory

scene_id: vn_6_3

stage_id: 6-3

location_id: estate_ashen_lord

direction_en: Vespera’s glass lantern reveals three hidden anchors around the conservatory. Thistle and Iona, who followed the same message up from the Undercity, set up a field infirmary beneath a stone arch.

music_cue: pre: bgm_ch6_estate with glass harmonics (Vespera's lantern) | post: bgm_revelation (soft)

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Vespera** · `node_6_3_pre_001`

This ward is drinking time from the glass. Slowly. Patiently.

emotion: distant · voice_track: jp

**Vespera** · `node_6_3_pre_004`

I saw this ward beneath the city, in the Guild's lowest cistern. I left before I understood what it was drinking.

emotion: quiet · voice_track: jp

**Thistle** · `node_6_3_pre_002`

Then we will stop it before it drinks from anyone else.

emotion: encouraging · voice_track: jp

**Iona** · `node_6_3_pre_003`

Break the anchors or let Vespera unwind the seal. Either path is safe.

emotion: calm · voice_track: jp

### post_battle_lines

**Vespera** · `node_6_3_post_001`

Someone taught the glass to remember a room that is gone.

emotion: uneasy · voice_track: jp

**Fadyme** · `node_6_3_post_002`

Can a room miss someone?

emotion: quiet · voice_track: jp

**Vespera** · `node_6_3_post_003`

A room can keep an absence. That is close enough.

emotion: soft · voice_track: jp

**Thistle** · `node_6_3_post_004`

Th-then we plant something in it. Absences hate that.

emotion: gentle · voice_track: jp

## The Manor Gives Way

scene_id: vn_6_4

stage_id: 6-4

location_id: estate_ashen_lord

direction_en: The manor shudders. Fadyme holds a stone arch above a trapped child; the recovered ledger lies open beside a handless-watch drawing.

music_cue: pre: bgm_tension (the manor shudders) | post: bgm_clockless — first hint (pizzicato only) under 'C.V.'

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Mahmut** · `node_6_4_pre_001`

Let the arch go. I have the child.

emotion: urgent · voice_track: jp

**Fadyme** · `node_6_4_pre_002`

I have it. Go.

emotion: strained · voice_track: jp

**Hana** · `node_6_4_pre_003`

Fadyme, your sleeve—

emotion: alarm · voice_track: jp

**Fadyme** · `node_6_4_pre_004`

Dust. It is only dust.

emotion: weak_smile · voice_track: jp

**Fadyme** · `node_6_4_pre_005`

Hana. Please do not tell him.

emotion: low · voice_track: jp

**Hana** · `node_6_4_pre_006`

I will not. But I saw it.

emotion: quiet · voice_track: jp

### post_battle_lines

**Mirel** · `node_6_4_post_001`

Seven notches. The same seal. And these initials: C.V.

emotion: focused · voice_track: jp

**Mahmut** · `node_6_4_post_002`

The handless watch was in the portrait.

emotion: grim · voice_track: jp

**Fadyme** · `node_6_4_post_003`

The name is not in the ledger. We should keep moving.

emotion: controlled · voice_track: jp

**Fadyme (thought)** · `node_6_4_post_004`

The letters have found us again. I know whose hand wrote them.

emotion: fear · voice_track: jp_inner

## The Ashen Lord’s Wraith

scene_id: vn_6_5

stage_id: 6-5

location_id: estate_ashen_lord

direction_en: An old noble’s Wraith steps out of its portrait frame. It wears the same face as every blank nameplate in the gallery.

music_cue: pre: bgm_ch6_estate (chaotic layer) | battle: bgm_boss_wraith | post: bgm_ledger_motif on 'a schedule for the bells'

battle_transition_en: The party escorts survivors and separates onto safe roads before reuniting at the First Eclipse Altar.

### story_guests

### tutorial_cards_en

### pre_battle_lines

**The Wraith** · `node_6_5_pre_001`

A house remembers its master. A kingdom remembers its heir.

emotion: echo · voice_track: jp

**The Wraith** · `node_6_5_pre_004`

I hid the bell-keeper's daughter from the Crown. I kept her face and lost her name.

emotion: echo · voice_track: jp

**Mirel** · `node_6_5_pre_002`

It is copying the portraits. Break the mirror frame.

emotion: urgent · voice_track: jp

**Mahmut** · `node_6_5_pre_003`

Then we end the memory.

emotion: command · voice_track: jp

### post_battle_lines

**Mirel** · `node_6_5_post_001`

The page is not a cure. It is a schedule for the bells.

emotion: grave · voice_track: jp

**Aveline** · `node_6_5_post_002`

A schedule for what?

emotion: quiet · voice_track: jp

**Fadyme** · `node_6_5_post_003`

For the heir. The ink says no more.

emotion: deflecting · voice_track: jp

**Mahmut** · `node_6_5_post_004`

Then we find the altar before the next line is written.

emotion: resolved · voice_track: jp

## Separate Roads

scene_id: ch6_camp

location_id: ashen_estate_ruins

direction_en: Dawn among the estate ruins. The company divides to reach the altar by safe roads.

music_cue: bgm_camp (dawn version) → bgm_held_the_road (first quiet statement) as the company divides

### lines

**Mirel** · `ch6_camp_001`

The schedule points to the First Eclipse Altar. Everyone go by different roads. Fewer targets.

emotion: decisive · voice_track: jp

**Aveline** · `ch6_camp_002`

The servants and the wounded go with Nara and Marek.

emotion: firm_kind · voice_track: jp

**Sable** · `ch6_camp_003`

I go ahead. Lanterns.

emotion: terse · voice_track: jp

**Hana** · `ch6_camp_004`

Fadyme. I am still not telling. But please be careful on the stairs.

emotion: worried · voice_track: jp

**Fadyme** · `ch6_camp_005`

I will be the most careful person on any stair.

emotion: small_smile · voice_track: jp

**Mahmut** · `ch6_camp_006`

We meet at the altar. All of us.

emotion: resolved · voice_track: jp

## The Crown-Shaped Crater

scene_id: ch7_road

location_id: mountain_crater_rim

direction_en: Two quiet days later. Mahmut and Fadyme reach the crater rim. Below, an eclipse hangs over seven broken chains.

music_cue: bgm_ch7_altar (distant, calm layer) — two quiet days; wind over the crater

### lines

**Fadyme** · `ch7_road_001`

It is beautiful. That is the worst part.

emotion: quiet · voice_track: jp

**Mahmut** · `ch7_road_002`

When this is done, we will find somewhere ugly and safe.

emotion: dry · voice_track: jp

**Fadyme** · `ch7_road_003`

With cheese.

emotion: smiling · voice_track: jp

**Mahmut** · `ch7_road_004`

With cheese.

emotion: gentle · voice_track: jp

**Fadyme (thought)** · `ch7_road_005`

He believes the machine is the curse. Tomorrow he learns it is only the hand that holds the pen.

emotion: sad · voice_track: jp_inner

**Narration** · `ch7_road_006`

Below them, at the foot of the stair, a small lantern light moved. Their friends were already there.

emotion: hopeful · voice_track: jp_narration

## The Stair of Seven Chains

scene_id: vn_7_1

stage_id: 7-1

location_id: altar_first_eclipse

direction_en: A stairway descends through the mountain into the altar. Seven chains cross the passage; each bears the seven-notched gray seal that Yseldra left on Mahmut's shield. Nixie returns with Jori and Odelia.

music_cue: pre: bgm_ch7_altar (uneasy layer), chains as percussion | post: bgm_ledger_motif (seven notes, then silence where the eighth should be)

battle_transition_en: The upper chain breaks. Below it, a bell rings once without moving its clapper.

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Nixie** · `node_7_1_pre_001`

I brought the people from Oakhaven as far as the lower pass. They are safe. I am not staying behind again.

emotion: firm · voice_track: jp

**Jori** · `node_7_1_pre_002`

These links came from my family's forge. We were told they were made for a royal bridge.

emotion: ashamed · voice_track: jp

**Odelia** · `node_7_1_pre_003`

They were made to hold something in place. The question is what the crown was afraid would move.

emotion: wary · voice_track: jp

**Nixie** · `node_7_1_pre_006`

The chain-bearers up there sing to it. They think the eclipse is holding its breath for the kingdom.

emotion: wary · voice_track: jp

**Mahmut** · `node_7_1_pre_004`

We find the answer together. No one goes ahead alone.

emotion: protective · voice_track: jp

**Fadyme** · `node_7_1_pre_005`

You say that as if I am the one who keeps trying to disappear.

emotion: light · voice_track: jp

### post_battle_lines

**Jori** · `node_7_1_post_001`

The hammer marks are mine. My grandmother's, before me. We repaired these chains after the first eclipse.

emotion: stricken · voice_track: jp

**Fadyme** · `node_7_1_post_002`

Then your family tried to mend a wound it did not make.

emotion: gentle · voice_track: jp

**Jori** · `node_7_1_post_004`

We made a cage and called it a bridge. My hands will not make that mistake again.

emotion: resolved · voice_track: jp

**Nixie** · `node_7_1_post_003`

The marks point down. We can be sad after we stop the thing below.

emotion: brisk · voice_track: jp

## Those Who Held the Road

scene_id: vn_7_2

stage_id: 7-2

location_id: altar_first_eclipse

direction_en: At a fork in the stair, companions who escorted refugees return from the outer route. They do not replace the player's formation; they create a brief, scripted diversion while the five-person party advances.

music_cue: pre: bgm_held_the_road — full ensemble statement | post: bgm_held_the_road (comic tag for the barricade line)

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Brin** · `node_7_2_pre_001`

The refugees are through. I told the guards to bar the road behind us.

emotion: relieved · voice_track: jp

**Rikka** · `node_7_2_pre_002`

And I told them the barricade was my idea. They believed me because I looked proud of it.

emotion: cheerful · voice_track: jp

**Nara** · `node_7_2_pre_003`

Two sentinels are winding up a flank attack. Mahmut, your left side is about to become very popular.

emotion: dry · voice_track: jp

**Mahmut** · `node_7_2_pre_005`

You have already done enough. Get everyone home.

emotion: grateful · voice_track: jp

**Brin** · `node_7_2_pre_006`

Then come back so I can tell you that in person.

emotion: earnest · voice_track: jp

### post_battle_lines

**Rikka** · `node_7_2_post_001`

Outer stair is held! Mostly because my barricade is now on fire, but held is held.

emotion: excited · voice_track: jp

**Marek** · `node_7_2_post_002`

The road is ours. Go finish what we began.

emotion: steady · voice_track: jp

**Fadyme** · `node_7_2_post_003`

When this is over, I want to hear every detail of that barricade.

emotion: warm · voice_track: jp

**Fadyme (thought)** · `node_7_2_post_004`

When this is over. I will keep borrowing those words until there are none left.

emotion: melancholy · voice_track: jp_inner

## The Names We Kept

scene_id: vn_7_3

stage_id: 7-3

location_id: altar_first_eclipse

direction_en: A round archive is carved into the stairwell. Aveline, Mirel, Clem, Pippa and Kera rebuild the erased record from copied names, bell rubbings and Jori's forge marks.

music_cue: pre: bgm_ledger_motif under the voices reading names | post: bgm_fadyme_theme with choir when the name is written back; this is the emotional peak before the boss

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Mirel** · `node_7_3_pre_001`

The ledger was written over, not burned. Someone needed the names to remain beneath the ink.

emotion: focused · voice_track: jp

**Aveline** · `node_7_3_pre_002`

I can read the prayer beneath it. The names were offered as witnesses, not sacrifices.

emotion: quiet · voice_track: jp

**Fadyme (thought)** · `node_7_3_pre_007`

I came here to be offered. They are asking me to be witnessed.

emotion: tender · voice_track: jp_inner

**Clem** · `node_7_3_pre_003`

Witnesses to what?

emotion: curious · voice_track: jp

**Pippa** · `node_7_3_pre_004`

To a promise. The last line says, 'Let the lost hour be remembered by the living.'

emotion: tender · voice_track: jp

**Kera** · `node_7_3_pre_005`

There is one space scraped clean. It is the same length as Fadyme's name.

emotion: careful · voice_track: jp

**Fadyme** · `node_7_3_pre_006`

Then write it back. A name should not vanish just because someone feared what it meant.

emotion: composed · voice_track: jp

**Pippa** · `node_7_3_pre_008`

I will sing it while you write. The page will not dare lose its place.

emotion: bright · voice_track: jp

### post_battle_lines

**Mirel** · `node_7_3_post_005`

Give me the pen. My hand helped erase it. This time, my hand writes it back.

emotion: resolved · voice_track: jp

**Aveline** · `node_7_3_post_001`

Fadyme Veyr. The record accepts the ink.

emotion: relieved · voice_track: jp

**Mahmut** · `node_7_3_post_002`

Veyr?

emotion: surprised · voice_track: jp

**Fadyme** · `node_7_3_post_003`

My mother's name. It was hers before it was mine.

emotion: guarded · voice_track: jp

**Fadyme (thought)** · `node_7_3_post_004`

I am sorry. I wanted one more quiet day before you knew even this much.

emotion: guilty · voice_track: jp_inner

## Before the Last Toll

scene_id: vn_7_4

stage_id: 7-4

location_id: altar_first_eclipse

direction_en: At the altar's outer ring, the returned companions raise wards and open an evacuation path. The five-person core party faces the last sentinels while distant friends hold the side lanes in a non-playable set piece.

music_cue: pre: bgm_held_the_road → bgm_tension | post: sting_bell_toll (the pulse stops)

battle_transition_en: The companions seal the side altar. Mahmut and Fadyme pass through the inner gate with their four chosen allies.

### story_guests

### tutorial_cards_en

### pre_battle_lines

**Sable** · `node_7_4_pre_001`

The east passage is clear. I left a lantern at every turn; nobody gets lost in the dark tonight.

emotion: assured · voice_track: jp

**Vespera** · `node_7_4_pre_002`

The altar is counting backward. It has mistaken a bell for a clock.

emotion: distant · voice_track: jp

**Tilda** · `node_7_4_pre_005`

The eastern anchor is mine. Hana, take the evacuees through the lantern path.

emotion: commanding · voice_track: jp

**Hana** · `node_7_4_pre_006`

I will. And Fadyme—I kept my promise. Come back, so I can stop keeping it.

emotion: worried · voice_track: jp

**Fadyme** · `node_7_4_pre_007`

I promise to try.

emotion: soft · voice_track: jp

**Mahmut** · `node_7_4_pre_008`

You do not have to promise alone.

emotion: tender · voice_track: jp

### post_battle_lines

**Aveline** · `node_7_4_post_001`

The pulse is stopped. The altar is open.

emotion: focused · voice_track: jp

**Fadyme** · `node_7_4_post_002`

Mahmut, after this, stay beside me. Just for a little while.

emotion: vulnerable · voice_track: jp

**Mahmut** · `node_7_4_post_003`

As long as you ask me to.

emotion: gentle · voice_track: jp

**Fadyme (thought)** · `node_7_4_post_004`

I do not know how to ask for forever. I will ask for one more step.

emotion: fragile · voice_track: jp_inner

## The Eclipse Construct

scene_id: vn_7_5

stage_id: 7-5

location_id: altar_first_eclipse

direction_en: Five heroes enter a circular chamber beneath a suspended black sun. A crownless, clockwork guardian unfolds from the altar. During the battle, the VN camera returns briefly between phases to show Fadyme hiding the ash-dark veins spreading past her wrist.

music_cue: pre: bgm_ch7_altar (chaotic layer) | battle: bgm_boss_eclipse_construct (phase 1, phase 2 adds choir and the bell motif) | post: silence after 'HOUR... STILL OWED.'

battle_transition_en: The chamber falls silent. Fadyme tries to walk, then collapses. The surviving heroes carry her to the altar's outer dais.

### tutorial_cards_en

### pre_battle_lines

**Mahmut** · `node_7_5_pre_001`

Five of us. We have broken worse lines than this.

emotion: steady · voice_track: jp

**Fadyme** · `node_7_5_pre_002`

And if the altar asks for a name?

emotion: quiet · voice_track: jp

**Mahmut** · `node_7_5_pre_003`

It can have mine first.

emotion: certain · voice_track: jp

**Fadyme** · `node_7_5_pre_004`

No. We leave with all five names. That is the only answer I will accept.

emotion: warm · voice_track: jp

### phase_interludes

direction_en: The chain joints split. The Construct falls to one knee. Fadyme presses a darkening hand beneath her cloak before Mahmut turns.

##### lines

**Eclipse Construct** · `node_7_5_phase1_001`

THE HOUR IS UNPAID.

emotion: mechanical · voice_track: jp

**Fadyme** · `node_7_5_phase1_002`

Then stop asking the living to pay it.

emotion: defiant · voice_track: jp

direction_en: The three pylons ignite. Black-gold lines crawl over Fadyme's fingers; she closes her fist and keeps her voice even.

##### lines

**Vespera (memory)** · `node_7_5_phase2_001`

The ward is using the bearer as its anchor! Break the pylons!

emotion: urgent · voice_track: jp

**Mahmut** · `node_7_5_phase2_002`

Fadyme, stay behind me!

emotion: alarmed · voice_track: jp

**Fadyme** · `node_7_5_phase2_003`

I am right here. Finish it with me.

emotion: strained · voice_track: jp

### post_battle_lines

**Eclipse Construct** · `node_7_5_post_001`

WITNESS... RESTORED. HOUR... STILL OWED.

emotion: fading · voice_track: jp

**Fadyme** · `node_7_5_post_002`

It is over.

emotion: relieved · voice_track: jp

**Mahmut** · `node_7_5_post_003`

Fadyme? Your hand—

emotion: fear · voice_track: jp

**Fadyme** · `node_7_5_post_004`

I am only tired. Please, Mahmut. Not here.

emotion: weak_smile · voice_track: jp

**Fadyme (thought)** · `node_7_5_post_005`

The dark has reached my heart. I cannot make it wait much longer.

emotion: terrified · voice_track: jp_inner

## The Words He Did Not Know

scene_id: part1_emotional_confession

location_id: altar_first_eclipse_outer_dais

direction_en: Battle UI dissolves to a still VN composition: Mahmut kneels beside Fadyme under the dim eclipse. The others wait beyond a broken arch, close enough to help but giving them privacy. The narration is quiet; no music for the first exchange.

music_cue: silence for the first lines; bgm_fadyme_theme enters on piano only when Mahmut first speaks her name; no percussion anywhere in this scene

### lines

**Mahmut** · `confession_001`

All this time, you were carrying something alone.

emotion: shaken · voice_track: jp

**Fadyme** · `confession_002`

I thought if I smiled, the curse would have to wait its turn.

emotion: weak_laugh · voice_track: jp

**Mahmut** · `confession_003`

You should have told me.

emotion: hurt · voice_track: jp

**Fadyme** · `confession_004`

I know. I wanted to be more than the person you were trying to save.

emotion: honest · voice_track: jp

**Mahmut** · `confession_005`

You are. You are the person who made every road feel like it led somewhere.

emotion: tender · voice_track: jp

**Fadyme** · `confession_006`

Then let me ask for one selfish thing. Stay until I fall asleep.

emotion: fragile · voice_track: jp

**Mahmut** · `confession_007`

I will stay when you wake, too.

emotion: resolved · voice_track: jp

**Fadyme** · `confession_008`

You still do not understand. I am dying, Mahmut. The curse is taking my hours one by one.

emotion: tearful · voice_track: jp

**Mahmut** · `confession_009`

Then I will find the hand that wrote this curse. I will not let it write the last line.

emotion: grief_to_anger · voice_track: jp

**Fadyme** · `confession_010`

I was afraid you would look at me and see a final hour.

emotion: vulnerable · voice_track: jp

**Mahmut** · `confession_011`

I see you. I should have seen you sooner.

emotion: remorseful · voice_track: jp

**Fadyme** · `confession_012`

You did not know. That is why I could keep pretending.

emotion: soft · voice_track: jp

**Mahmut** · `confession_014`

Then I have one more thing to confess. I knew Yseldra. I saw her call you to the altar that night, and I told you I did not know her.

emotion: ashamed · voice_track: jp

**Fadyme** · `confession_015`

I know. I heard it in the cathedral. We were both pretending, Mahmut. Let us stop together.

emotion: tearful · voice_track: jp

**Narration** · `confession_013`

For one breath, the eclipse above them thinned. Fadyme's fingers found Mahmut's, and the darkness beneath her skin did not retreat.

emotion: somber · voice_track: jp_narration

## The Hour That Remained

scene_id: part1_clockless_reveal

location_id: altar_first_eclipse_reflection

direction_en: A reflection moves in the altar's polished black stone after the others leave. A man in a travel-stained chancellor's coat steps through it, carrying a watch with no hands. Yseldra appears in the reflected archway, her veil lifted for the first time.

music_cue: bgm_clockless — full statement: pizzicato that never resolves; cut to silence on 'Uncle.'; bgm_main_theme over the ending card

next_part_teaser_en: Part II — The Hours We Have Left

### lines

**Cael** · `ending_cael_001`

You have finally told him the truth. How considerate of you to wait until the hour was nearly gone.

emotion: cool_amusement · voice_track: jp

**Mahmut** · `ending_mahmut_001`

Show yourself.

emotion: warning · voice_track: jp

**Cael** · `ending_cael_002`

Lord Cael Veyr. The Clockless Chancellor, if titles still comfort anyone.

emotion: formal · voice_track: jp

**Fadyme** · `ending_fadyme_003`

Uncle.

emotion: breaking · voice_track: jp

**Fadyme** · `ending_fadyme_001`

You were dead.

emotion: disbelief · voice_track: jp

**Cael** · `ending_cael_003`

The court recorded my death. It did not record where my missing hour went.

emotion: cold · voice_track: jp

**Mahmut** · `ending_mahmut_002`

You made her curse.

emotion: angry · voice_track: jp

**Cael** · `ending_cael_004`

I made a door. Yseldra chose who would stand in it.

emotion: measured · voice_track: jp

**Yseldra** · `ending_yseldra_001`

Do not mistake him for your answer, Fadyme. He only knows how to turn grief into a bargain.

emotion: bitter · voice_track: jp

**Cael** · `ending_cael_005`

Come to the Clockless Court, Mahmut. I can return the hours the curse has taken. The price is one hour that belongs to you.

emotion: inviting · voice_track: jp

**Mahmut** · `ending_mahmut_003`

And if I refuse?

emotion: guarded · voice_track: jp

**Cael** · `ending_cael_006`

Then she keeps fading, and you keep learning what 'too late' means.

emotion: quiet_threat · voice_track: jp

**Fadyme** · `ending_fadyme_002`

Mahmut, do not answer him tonight.

emotion: afraid · voice_track: jp

**Narration** · `ending_narration_001`

The handless watch ticked once. Somewhere below the altar, a bell answered.

emotion: ominous · voice_track: jp_narration
