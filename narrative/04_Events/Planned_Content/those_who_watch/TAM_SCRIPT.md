# Tutulmayı Bekleyenler — birleşik tam script

Bütün yol ve seçim varyantları dahil.

# Tutulmayı Bekleyenler — Bölüm 1: Eski Bir Kutsal Gün

Yeni metinler yaratıcı genişletmedir; canon sahneler kaynak kopyasıdır. Oyuncu metni İngilizce.

## tw_a1_road — The People Going Up

Mekân: `eastern_highland_road` · `new_authored_expansion`

Amaç: Kaynak beş token için iki event-scoped köylü eklenir; Fadyme/Mahmut çağrılmaz.

**Sahne yönergesi:** On the separate safe altar route, Clem, Vespera and Thistle meet a local guide and lantern carrier. These two ordinary villagers complete the five-person viewing group in the new expansion.

**Narration** · `tw_a1_road_001` · composed

The highland road has more footsteps than carts today. People carry wrapped food and small lamps that will not be needed until they come down.

**Guide** · `tw_a1_road_002` · calm

We leave the narrow shelf for anyone coming back. The watchers go up on this side.

**Clem** · `tw_a1_road_003` · curious

Watchers. That sounds more respectable than people looking at the sky.

**Lantern Carrier** · `tw_a1_road_004` · wry

It sounds shorter when you need them to move.

**Thistle** · `tw_a1_road_005` · gentle

There is room to rest before the climb?

**Guide** · `tw_a1_road_006` · warm

At the lower terrace. And at the ridge, if you do not crowd its edge.

**Vespera** · `tw_a1_road_007` · quiet

Then we can see without making someone stand where they should not.

**Narration** · `tw_a1_road_008` · composed

The guide and lantern carrier stay with the three travelers, a small group inside the larger procession.

**Checkpoint:** `tw_a1_road_done`

## event_sun_eclipse_day_1 — An Old Holy Day

Mekân: `eastern_highland_road` · `canon_verbatim`

Amaç: Canon An Old Holy Day üç satır aynen; sourceafter6-5.

**Sahne yönergesi:** On their own safe route to the altar, Clem, Vespera and Thistle join highland villagers climbing to watch the far mountain where the eclipse hangs.

**Clem** · `event_sun_eclipse_day_1_001` · curious

Sun-Eclipse Day. Once a year the villages say the black sun breathes.

**Vespera** · `event_sun_eclipse_day_1_002` · dry

Does it?

**Clem** · `event_sun_eclipse_day_1_003` · cheerful

Every grave-keeper's record says yes. Every scholar's says no. I trust grave-keepers.

**Checkpoint:** `event_sun_eclipse_day_1_done`

## tw_a1_questions — What the Records Say

Mekân: `eastern_highland_road` · `new_authored_expansion`

Amaç: Metodoloji curiosity; sonraki büyükmekanizmaya kesincevap yok.

**Sahne yönergesi:** Clem talks about records without disclosing Fadyme secrets. Vespera distinguishes observation from explanations.

**Clem** · `tw_a1_questions_001` · bright

I would like to read the village record after we watch.

**Vespera** · `tw_a1_questions_002` · dry

Before and after would be better.

**Clem** · `tw_a1_questions_003` · curious

You think they will change it?

**Vespera** · `tw_a1_questions_004` · quiet

I think we will ask different questions after seeing something.

**Thistle** · `tw_a1_questions_005` · focused

And we should choose a place before the crowd fills it.

**Guide** · `tw_a1_questions_006` · calm

The open ridge gives a wider view. The terrace gives firmer room behind you.

**Lantern Carrier** · `tw_a1_questions_007` · focused

We can reach either. The first turn needs clearing before the slower walkers come.

**Checkpoint:** `tw_a1_questions_done`

## tw_a1_place — Where to Watch

Mekân: `tw_upper_turn` · `new_authored_expansion`

Amaç: İki rota2encounterve4storyscenede ayrışır; viewpoint sourceeventi değiştirmez.

**Sahne yönergesi:** Both viewing places see the same source eclipse event. The party clears the first approach before villagers use it.

**Guide** · `tw_a1_place_001` · focused

The open path lets the far threats reach around. On the terrace path the closest dead press harder.

**Thistle** · `tw_a1_place_002` · calm

We can prepare for either. Nobody goes ahead of the clear road.

**Vespera** · `tw_a1_place_003` · quiet

Choose where we stand. It will not choose what the sky does.

### Seçim — Choose the viewing place.

Kayıt alanı: `place`

#### Take the open ridge. — `tw_place_ridge`

Önizleme: Two approach fights emphasize reaching attackers and target priority.

**Clem** · `tw_a1_place_004` · bright

Wide view. I can write what changed without borrowing someone’s shoulder.

**Thistle** · `tw_a1_place_005` · focused

And I will keep a place behind the first row for anyone needing to sit.

#### Take the sheltered terrace. — `tw_place_terrace`

Önizleme: Two approach fights emphasize steady front pressure and supporting enemies.

**Thistle** · `tw_a1_place_006` · focused

Firm ground, and room to stop. That will help people look without leaning.

**Vespera** · `tw_a1_place_007` · quiet

A narrower view can still be an honest one.

**Checkpoint:** `tw_a1_place_done`



---

# Tutulmayı Bekleyenler — Bölüm 2: Bakılacak Yer

Yeni metinler yaratıcı genişletmedir; canon sahneler kaynak kopyasıdır. Oyuncu metni İngilizce.

## tw_a2_ridge_1 — The Open Turn

Mekân: `tw_ridge_path` · `new_authored_expansion`

Amaç: Ridge B01 önce; gerçek ölü tehdidi pulse nedeniyle yeni üretilmiş sayılmaz.

**Sahne yönergesi:** The villagers wait below the first turn. Enemies are known earlier-chapter dead, not a new eclipse-created species.

**Guide** · `tw_a2_ridge_1_001` · focused

Wait below the white stone. We clear the turn before anyone climbs past it.

**Clem** · `tw_a2_ridge_1_002` · serious

The one at the back is reaching around the nearest bodies.

**Vespera** · `tw_a2_ridge_1_003` · focused

Notice the reach. Do not follow it off the firm line.

**Thistle** · `tw_a2_ridge_1_004` · focused

There is room for the rear to stay together here.

**Narration** · `tw_a2_ridge_1_005` · composed

The lantern carrier sets the wrapped lamps down on safe ground.

**Checkpoint:** `tw_a2_ridge_1_done`

## tw_a2_ridge_2 — A View with a Limit

Mekân: `tw_ridge_path` · `new_authored_expansion`

Amaç: Observationvstakecertainty; noteordinarywrittenprop.

**Sahne yönergesi:** After the first fight, Clem notes where the view ends. No free-text notebook feature is required.

**Clem** · `tw_a2_ridge_2_001` · focused

I can see the valley mouth, but not the road behind that rise.

**Vespera** · `tw_a2_ridge_2_002` · quiet

Write both. A limit is part of a useful account.

**Clem** · `tw_a2_ridge_2_003` · wry

The grave-keepers are less demanding.

**Guide** · `tw_a2_ridge_2_004` · calm

The grave-keepers ask which stone you actually saw.

**Clem** · `tw_a2_ridge_2_005` · bright

A fair correction. I like this village already.

**Narration** · `tw_a2_ridge_2_006` · composed

Thistle checks the firm edge while the group climbs into the cleared turn.

**Checkpoint:** `tw_a2_ridge_2_done`

## tw_a2_ridge_3 — The Last Open Stretch

Mekân: `tw_ridge_path` · `new_authored_expansion`

Amaç: RidgeB02önce rolkombinasyonu farklı.

**Sahne yönergesi:** A second visible threat blocks access to the viewing area. The locals stay behind the cleared line.

**Lantern Carrier** · `tw_a2_ridge_3_001` · focused

The ridge opens beyond this stretch. Nobody climbs round the dead to save time.

**Thistle** · `tw_a2_ridge_3_002` · focused

The nearest one holds the line. Something behind it is keeping it moving.

**Vespera** · `tw_a2_ridge_3_003` · focused

Then notice the support and the reach together.

**Clem** · `tw_a2_ridge_3_004` · serious

Two things to write down after. One thing to choose first.

**Narration** · `tw_a2_ridge_3_005` · composed

The group leaves its waiting space clear before stepping forward.

**Checkpoint:** `tw_a2_ridge_3_done`

## tw_a2_ridge_4 — A Safe Edge

Mekân: `highland_ridge` · `new_authored_expansion`

Amaç: Firstnooncanonöncesi güvenli seyir; kamerafizikengineyok.

**Sahne yönergesi:** The small five-person group reaches the ridge. The wider village crowd stays within marked safe viewing room.

**Guide** · `tw_a2_ridge_4_001` · calm

Here. You can see without standing at the edge.

**Thistle** · `tw_a2_ridge_4_002` · focused

Leave this space for anyone who needs to sit.

**Clem** · `tw_a2_ridge_4_003` · quiet

The mountain looks closer than it did from the road.

**Vespera** · `tw_a2_ridge_4_004` · quiet

The distance has not changed. Our view has.

**Lantern Carrier** · `tw_a2_ridge_4_005` · wry

That is a good reason to climb. A worse reason to lean.

**Narration** · `tw_a2_ridge_4_006` · composed

The lamps remain wrapped. There is enough daylight to see one another’s faces.

**Checkpoint:** `tw_a2_ridge_4_done`

## tw_a2_terrace_1 — The Firm Approach

Mekân: `tw_terrace_path` · `new_authored_expansion`

Amaç: TerraceB01önce; standart5v5.

**Sahne yönergesi:** The villagers wait at a safe bend. The narrow approach emphasizes front-line pressure.

**Guide** · `tw_a2_terrace_1_001` · focused

This bend stays for waiting. The next stretch stays for the fight.

**Thistle** · `tw_a2_terrace_1_002` · focused

Two close threats, and a supporting one behind them.

**Vespera** · `tw_a2_terrace_1_003` · focused

Hold the line where the ground is firm. You do not need to win the whole path at once.

**Clem** · `tw_a2_terrace_1_004` · quiet

The watchers can see us from below. Let us leave them a clear way up.

**Narration** · `tw_a2_terrace_1_005` · composed

The carrier keeps the lamps beside the waiting bench.

**Checkpoint:** `tw_a2_terrace_1_done`

## tw_a2_terrace_2 — Room to Rest and See

Mekân: `tw_terrace_path` · `new_authored_expansion`

Amaç: Terrace humanview scene; karakterbüyüksecret çözülmez.

**Sahne yönergesi:** After the first fight, the group tests the terrace viewpoint. People can still observe the source event.

**Thistle** · `tw_a2_terrace_2_001` · focused

The bench is low enough to sit without blocking anyone’s view.

**Clem** · `tw_a2_terrace_2_002` · curious

I see less of the valley from here.

**Vespera** · `tw_a2_terrace_2_003` · quiet

Then write less of the valley. There is no duty to invent the part behind stone.

**Lantern Carrier** · `tw_a2_terrace_2_004` · wry

The people who sat here last year survived with very modest views.

**Guide** · `tw_a2_terrace_2_005` · calm

There is more to see when people are not trying to see over one another.

**Narration** · `tw_a2_terrace_2_006` · composed

Thistle moves a loose basket out of the walking space, not into the sight line.

**Checkpoint:** `tw_a2_terrace_2_done`

## tw_a2_terrace_3 — The Upper Landing

Mekân: `tw_terrace_path` · `new_authored_expansion`

Amaç: TerraceB02önce; noescortAI/real-timecrowd.

**Sahne yönergesi:** The second encounter protects access to the landing; enemies are outside the waiting terrace.

**Guide** · `tw_a2_terrace_3_001` · focused

The upper landing is not clear yet. The terrace remains safe while we make it so.

**Thistle** · `tw_a2_terrace_3_002` · focused

The support is behind the nearest dead. I can hold while it is chosen.

**Vespera** · `tw_a2_terrace_3_003` · focused

A steady opening. Keep it rather than chasing the first gap.

**Clem** · `tw_a2_terrace_3_004` · serious

Nobody watching needs to join the fight to earn the view.

**Narration** · `tw_a2_terrace_3_005` · composed

The group steps toward the landing. The villagers stay seated until the road is open.

**Checkpoint:** `tw_a2_terrace_3_done`

## tw_a2_terrace_4 — The View from the Landing

Mekân: `highland_ridge` · `new_authored_expansion`

Amaç: SourceTheBreathaynılocation; viewednoonbeforestage7.

**Sahne yönergesi:** The protected landing shares the canonical ridge location. No new event result is attached to the route.

**Lantern Carrier** · `tw_a2_terrace_4_001` · calm

There. The rim of the black sun is above that shoulder of rock.

**Clem** · `tw_a2_terrace_4_002` · curious

I can see it from the bench.

**Thistle** · `tw_a2_terrace_4_003` · gentle

That was the useful part of the plan.

**Vespera** · `tw_a2_terrace_4_004` · quiet

Keep your account at the height of your own eyes.

**Guide** · `tw_a2_terrace_4_005` · warm

And your feet on this side of the last stone.

**Narration** · `tw_a2_terrace_4_006` · composed

The little group watches with the other villagers. Nobody needs to hold someone else upright to see.

**Checkpoint:** `tw_a2_terrace_4_done`



---

# Tutulmayı Bekleyenler — Bölüm 3: Nefes

Yeni metinler yaratıcı genişletmedir; canon sahneler kaynak kopyasıdır. Oyuncu metni İngilizce.

## event_sun_eclipse_day_2 — The Breath

Mekân: `highland_ridge` · `canon_verbatim`

Amaç: Canon The Breath dört satır aynen: owingbell/recount/calendar açıklaması kaynak sınırında.

**Sahne yönergesi:** At noon the eclipse's rim flickers. Every bell pin, charm and bell in the valley hums at once.

**Thistle** · `event_sun_eclipse_day_2_001` · frightened

The owing-bells are all opening. All of them. The whole ridge.

**Vespera** · `event_sun_eclipse_day_2_002` · grave

It is not breathing. It is recounting. Every owed hour in the valley, checked at once.

**Thistle** · `event_sun_eclipse_day_2_003` · tense

Why t-today?

**Vespera** · `event_sun_eclipse_day_2_004` · quiet

Because someone set a day for it. Machines keep calendars. So do chancellors.

**Checkpoint:** `event_sun_eclipse_day_2_done`

## tw_a3_after — After the Humming

Mekân: `highland_ridge` · `new_authored_expansion`

Amaç: Duyulanilemekanizmayıayırır; bellmagic cancel yok.

**Sahne yönergesi:** The collective hum has passed. The source phenomenon is not stopped, cleansed or defeated by a battle.

**Narration** · `tw_a3_after_001` · composed

The humming leaves the air before the crowd remembers how to speak at its usual volume.

**Lantern Carrier** · `tw_a3_after_002` · quiet

I heard mine with the valley’s. I have never heard it like that.

**Thistle** · `tw_a3_after_003` · gentle

Sit for a moment. You do not have to stand while you find the words.

**Clem** · `tw_a3_after_004` · serious

I will write that the rim flickered and the bells answered together.

**Vespera** · `tw_a3_after_005` · quiet

And keep the explanation beside it, rather than inside the observation.

**Guide** · `tw_a3_after_006` · calm

We go down in small groups. The road has not become wider because everyone wants it now.

**Checkpoint:** `tw_a3_after_done`

## tw_a3_account — What to Keep in the Account

Mekân: `highland_ridge` · `new_authored_expansion`

Amaç: Eyewitnessstyle değişir, cannonrecountbilgisinisilmez.

**Sahne yönergesi:** Choose an emphasis for the ordinary local account. Both preserve the source explanation and uncertainty about its authors.

**Clem** · `tw_a3_account_001` · focused

The guide keeps a record of what the watchers noticed. I can help make today’s useful.

**Thistle** · `tw_a3_account_002` · gentle

People may remember the sound before they remember the sky.

**Vespera** · `tw_a3_account_003` · quiet

We need not make all memories look alike.

### Seçim — Choose the emphasis of the account.

Kayıt alanı: `account`

#### Describe the view and its limits. — `tw_account_seen`

Önizleme: Record the rim and viewpoint; a visual observation callback.

**Clem** · `tw_a3_account_004` · focused

The rim flickered. I will say where we stood when we saw it.

**Vespera** · `tw_a3_account_005` · quiet

And where the stone interrupted the view.

**Guide** · `tw_a3_account_006` · calm

That will help the next reader understand what you actually saw.

#### Record what the watchers heard. — `tw_account_heard`

Önizleme: Keep the collective sound and a person’s account; a listening callback.

**Thistle** · `tw_a3_account_007` · gentle

We can start with the sound. You do not have to explain the whole valley.

**Lantern Carrier** · `tw_a3_account_008` · quiet

Mine joined the others. That is what I know.

**Clem** · `tw_a3_account_009` · focused

Then that is the line I will keep beside what we saw.

**Checkpoint:** `tw_a3_account_done`



---

# Tutulmayı Bekleyenler — Bölüm 4: Duyduğumuz ve Bildiğimiz

Yeni metinler yaratıcı genişletmedir; canon sahneler kaynak kopyasıdır. Oyuncu metni İngilizce.

## tw_a4_descent — A Road Down for Everyone

Mekân: `tw_lower_path` · `new_authored_expansion`

Amaç: B03common; eclipsehourcount savaşbuff/debuff değil.

**Sahne yönergesi:** The outer return path has a known supporting-dead threat. The villagers wait at a safe landing; the hum is not a new combat modifier.

**Guide** · `tw_a4_descent_001` · focused

The lower return path is blocked. Wait at the landing until we clear it.

**Thistle** · `tw_a4_descent_002` · focused

The people behind us have space to rest. Keep that space out of the fight.

**Vespera** · `tw_a4_descent_003` · focused

A reaching threat and a support. Read both before we move.

**Clem** · `tw_a4_descent_004` · serious

We do not need a battle to explain the sky. We do need one to open this road.

**Narration** · `tw_a4_descent_005` · composed

The lantern carrier leaves the lamps at the landing. The travelers face the known dead below it.

**Checkpoint:** `tw_a4_descent_done`

## tw_a4_clear — The Next Small Group

Mekân: `tw_lower_path` · `new_authored_expansion`

Amaç: Threatcleared objective; sourcephenomenonuntouched.

**Sahne yönergesi:** The cleared road is used by small groups. No timed civilian failure simulation.

**Guide** · `tw_a4_clear_001` · calm

The turn is clear. The first group can go at its own pace.

**Lantern Carrier** · `tw_a4_clear_002` · relieved

I can carry the lamps without asking everyone to hurry.

**Thistle** · `tw_a4_clear_003` · gentle

Good. Somebody will still need light lower down.

**Vespera** · `tw_a4_clear_004` · quiet

Let the road decide the pace, rather than the fear.

**Narration** · `tw_a4_clear_005` · composed

Clem folds the account away before helping the next watcher stand.

**Checkpoint:** `tw_a4_clear_done`

## tw_a4_seen — A View Kept Honestly

Mekân: `highland_village` · `new_authored_expansion`

Amaç: Seen callbackteklif; uncertainty withoutmysterysolve.

**Sahne yönergesi:** Callback for the visual account. The local record has a viewpoint note; no new codex answer is unlocked.

**Guide** · `tw_a4_seen_001` · focused

You wrote that the rise hid part of the valley.

**Clem** · `tw_a4_seen_002` · calm

It did. I was tempted to borrow the wider view from the person beside me.

**Vespera** · `tw_a4_seen_003` · quiet

You may quote them. You may not pretend their eyes were yours.

**Clem** · `tw_a4_seen_004` · wry

A demanding village record. I am beginning to approve of it.

**Narration** · `tw_a4_seen_005` · composed

The guide leaves room beside Clem’s account for another watcher to add their own.

**Checkpoint:** `tw_a4_seen_done`

## tw_a4_heard — A Sound Kept in Someone’s Words

Mekân: `highland_village` · `new_authored_expansion`

Amaç: Heardcallbacknamesprivacyconsent; sourcewitnessrule consistent.

**Sahne yönergesi:** Callback for listening. The lantern carrier chooses a brief account without revealing a secret identity.

**Lantern Carrier** · `tw_a4_heard_001` · quiet

Will you write that I was frightened?

**Clem** · `tw_a4_heard_002` · gentle

If that is part you want kept. Or only the sound.

**Thistle** · `tw_a4_heard_003` · gentle

You get to choose your own line.

**Lantern Carrier** · `tw_a4_heard_004` · calm

The sound first. I will decide about the rest later.

**Narration** · `tw_a4_heard_005` · composed

Clem writes the short account and reads it back at the carrier’s pace.

**Checkpoint:** `tw_a4_heard_done`



---

# Tutulmayı Bekleyenler — Bölüm 5: Buradaydık

Yeni metinler yaratıcı genişletmedir; canon sahneler kaynak kopyasıdır. Oyuncu metni İngilizce.

## event_sun_eclipse_day_3 — Tokens

Mekân: `highland_village` · `canon_verbatim`

Amaç: Canon Tokens üç satır aynen. Beşli sourcecümlesine uygun newviewinggroup; token prop only.

**Sahne yönergesi:** The villagers give each traveler a stamped token so the eclipse will "know they watched".

**Clem** · `event_sun_eclipse_day_3_001` · delighted

Sun-Eclipse tokens. Superstition. I am keeping five.

**Thistle** · `event_sun_eclipse_day_3_002` · curious

Why five?

**Clem** · `event_sun_eclipse_day_3_003` · gentle

One for each of us who watched. So somebody knows we were here.

**Checkpoint:** `event_sun_eclipse_day_3_done`

## tw_a5_token — Five Ordinary Pieces

Mekân: `highland_village` · `new_authored_expansion`

Amaç: Fivekeeperexplained authorednotcanon sourceextraidentityclaim; propnoeconomicreward.

**Sahne yönergesi:** Clem has five stamped keepsakes for the three travelers, guide and lantern carrier. They are props, not a new currency or defined reward.

**Guide** · `tw_a5_token_001` · warm

You have enough for the little group. You may take them.

**Clem** · `tw_a5_token_002` · bright

I did count before keeping five. I am capable of restraint when given clear instructions.

**Vespera** · `tw_a5_token_003` · dry

You asked whether there were larger ones.

**Clem** · `tw_a5_token_004` · wry

A separate inquiry.

**Thistle** · `tw_a5_token_005` · gentle

It will be easier to remember where we stood than what we were afraid of.

**Lantern Carrier** · `tw_a5_token_006` · quiet

I would like both to be remembered honestly.

**Narration** · `tw_a5_token_007` · composed

Clem wraps the five pieces in cloth. None has made the bells quiet or the day’s account complete.

**Checkpoint:** `tw_a5_token_done`

## tw_a5_company — What Each Watcher Kept

Mekân: `highland_village` · `new_authored_expansion`

Amaç: 3distinctcharacterclosure; no repeatsowncompanionreveal.

**Sahne yönergesi:** Choose a short closing perspective. Nobody discloses the Part II offer or concludes the calendar’s author.

**Narration** · `tw_a5_company_001` · composed

The guide folds the village record. The three travelers have a quiet moment before taking their established road again.

### Seçim — Whose view do you keep beside the account?

Kayıt alanı: `focus`

#### Clem and the ordinary record. — `tw_focus_clem`

Önizleme: A closing about making room for more than one account.

**Clem** · `tw_a5_company_002` · quiet

The guide did not ask me to write the best account. Only my own.

**Vespera** · `tw_a5_company_003` · quiet

That is a better record than one with no room left.

**Clem** · `tw_a5_company_004` · small_smile

I will leave room. Even if the next watcher has dreadful handwriting.

**Narration** · `tw_a5_company_005` · composed

She makes the margin a little wider before folding the page.

#### Vespera and the unanswered question. — `tw_focus_vespera`

Önizleme: A closing about a useful limit to an explanation.

**Thistle** · `tw_a5_company_006` · gentle

You still have questions.

**Vespera** · `tw_a5_company_007` · quiet

Yes. I have better boundaries for them now.

**Clem** · `tw_a5_company_008` · curious

I may borrow that phrase.

**Vespera** · `tw_a5_company_009` · dry

Borrow the boundaries too.

#### Thistle and the place to sit. — `tw_focus_thistle`

Önizleme: A closing about care while people try to understand.

**Thistle** · `tw_a5_company_010` · quiet

They kept asking what the sound meant. I could only give them a place to sit.

**Clem** · `tw_a5_company_011` · gentle

They asked more clearly after they sat down.

**Vespera** · `tw_a5_company_012` · quiet

A useful place is an answer to a useful question.

**Narration** · `tw_a5_company_013` · composed

Thistle checks that the bench is dry before leaving it for the next watcher.

**Checkpoint:** `tw_a5_company_done`

## tw_a5_end — A Record and a Road

Mekân: `eastern_highland_road` · `new_authored_expansion`

Amaç: SamePartIroute; cliffhangerreveal7onlynoextraannualwait.

**Sahne yönergesi:** The three resume their existing safe altar route. The locals stay with the village record; no extra story day or reunion.

**Guide** · `tw_a5_end_001` · calm

Your road continues past the lower terrace. Keep to the firm side when it turns.

**Clem** · `tw_a5_end_002` · bright

And keep the village account. I would like to read it again if I come this way.

**Lantern Carrier** · `tw_a5_end_003` · warm

It has room for another visit.

**Thistle** · `tw_a5_end_004` · gentle

Thank you for the place to sit.

**Vespera** · `tw_a5_end_005` · quiet

And for not asking the sky to become simpler than it was.

**Narration** · `tw_a5_end_006` · composed

The travelers leave on the road they were already taking. Behind them, the village keeps several accounts of one noon.

**Checkpoint:** `tw_a5_end_done`
