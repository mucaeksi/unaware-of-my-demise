# Story Bible — Unaware of My Demise, Part I

**Canon title:** Unaware of My Demise  
**Part I subtitle:** Unaware, I Fade  
**Working chapter content language:** English  
**Production notes:** Turkish  
**Campaign:** 7 chapters × 5 battle nodes = 35 nodes; recommended player level 1–20. Complete line-addressable VN scripts are in `content/story_script_ch01.json`–`content/story_script_ch07.json`, indexed by `content/story_script_part1_manifest.json`.

**Main adversaries:** Lady Yseldra Vale (the Bell-Widow), first seen before Node 1-1 and fought at 2-5; Lord Cael Veyr (the Clockless Chancellor), revealed only after the emotional ending of 7-5.

## 1. Canon and emotional contract

Fadyme knows the curse is consuming her. Mahmut knows she carries a dangerous royal seal, but he does not understand that it is already killing her. She consciously hides the speed and cost of the Fading Curse because she wants some remaining days to feel like a shared journey rather than a vigil.

Mahmut is not foolish or indifferent. He notices each symptom, but Fadyme gives plausible explanations, the curse imitates ordinary magical backlash, and the people with records are lying or afraid. He believes that breaking the Eclipse mechanism will stop the curse. The player sees more than he does through short Fadyme interior lines, private clues and small visual changes.

Fadyme's own purpose (C33): she walks to the Altar to pay her debt in full, by choice, because while she hid her slow payment fell on the villages. Mahmut believes they are going to break the machine. At 7-3 she wants to be witnessed rather than offered, and at 7-5 she refuses the Altar. Neither knew the Altar had become Cael's Hinge.

Part I resolves the immediate threat to the villages and reveals the truth to Mahmut. It does not cure Fadyme. The final promise is to find a way to return the time the seal has consumed.

The recurring line is “I'm fine.” It changes meaning each time: dry humor, deflection, reassurance, then a choice to spend one more moment beside Mahmut.

## 2. Places and recurring clues

- **Whispering Ash Forest:** Names carved into trees lose a letter after each bell. The forest establishes the memory-and-identity side of the curse.
- **Ruined Cathedral of Saint Luthos:** Old clergy records identify Fadyme as the Last Bell Heir and frame the curse as a protective seal.
- **Oakhaven:** Fadyme coughs blood after using magic. She wipes it from Mahmut's glove before he can ask.
- **The Subterranean Undercity:** After the physician's opening estimate of one month, a forbidden alchemist tells Fadyme privately that the answering bells have accelerated the curse: she now has weeks, perhaps less. She pretends to Mahmut that a restorative elixir may help.
- **Bridge of the Forsaken:** Mahmut confronts his former commander. After a bell pulse, a lock of Fadyme's hair turns white.
- **Ashen Lord's Estate:** A manor archive collapses. The party saves servants and recovers only one page of the ritual ledger.
- **Altar of the First Eclipse:** The Eclipse Construct is revealed as the machine that directs the curse, not its original creator.
- **Seven-notched gray seal:** Yseldra's old Inquisition mark appears on an order at Oakhaven (3-5) and on the Ashen estate ledger (6-4). The initials **C.V.** sit beneath the seal, unexplained until the ending.
- **The handless watch:** A conservatory portrait and ledger diagram show a court signet beside a watch with no hands. Its owner is identified as Cael Veyr in the Chapter 7 mirror.

## 3. Guest-party rules

The campaign never checks whether a banner character is owned. A battle stage can provide a story loan at its recommended level with temporary equipment. A loan lasts only for the marked encounter or chapter segment; it is not silently added to the account. Story dialogue and progression remain visible to every player. If the player owns a listed loan character, their own build takes that slot. The battle guest list fills vacant party slots in order; it never displaces a full player-selected party. Standard battles use five heroes (2 Front / 3 Rear); the free, no-Ration 1-1 tutorial is the only two-hero exception.

Content has two distinct guest fields: a script scene's `story_guests` names characters present in that VN scene; `Stage.guest_characters` is the battle-loan whitelist used to fill open combat slots. They are allowed to differ: a character can speak in the scene without being forced into the battle, and a battle loan can be offered without a new dialogue beat. The battle roster resolver must use the Stage list; the VN uses its scene list.

A character may join the traveling company for one or more chapters, then leave for a concrete reason: to escort refugees, report to a guild, hold a road, investigate another lead or protect a settlement. This gives the banner cast story agency without requiring a permanent twenty-person marching column. Alongside free starters Mahmut and Fadyme, Brin (1-2), Nixie (1-4) and Jori (3-4) are permanent story recruits. First Oath Invitation, granted after 1-2, also guarantees the player's choice of one of seven permanent 4★ heroes before 1-3. Brin and Nixie remain banner-eligible for duplicate copies; the story recruit does not remove them from the banner pool.

The current permanent-recruit and selector eligibility source is `content/story_script_part1_manifest.json` under `acquisition_story_beats`; `core.story_state` applies those unlocks. Chapter outline/script `story_rewards` fields are authoring and scene-flow cues, not a second inventory grant path. `Stage.story_rewards` is available for future row-based rewards but currently has no authored rows. The first invitation becomes claimable after 1-2; the 1-3 beat is the intended selection moment before the first standard five-slot encounter.

## 4. Seven-chapter route and 35 nodes

### Opening scene — Before Node 1-1 (VN, no battle node)

Before dawn on the forest road, Fadyme hides a letter that repeats the physician's prognosis: one month, perhaps less. Mahmut notices her shaking hand; she blames the cold. A distant, cracked handbell rings once on its own (its clapper is tied; C21), and a mourning-veiled woman calls her “the last hour.” Yseldra says she came to stop the bell, not kill its prisoner. Mahmut refuses to surrender Fadyme. Yseldra leaves a seven-notched gray seal on his shield; Fadyme recognizes the bell and hides that she is crying. This is the first encounter with Lady Yseldra Vale, the Bell-Widow. It is a VN scene outside the 35-node count and has no Ration cost. The full 16-line English/JP-voice scene is `opening_scene` in `content/story_script_ch01.json`.

**Dialogue core, English:**

- FADYME, private thought: “One month, perhaps less. The old physician wrote it in Mother's prayer book. The ink does not tremble. I do.”
- MAHMUT: “Your hand is shaking.”
- FADYME: “The cold has found my fingers. It has not found the rest of me.”
- YSELDRA: “I came to stop the bell, not to kill its prisoner. You cannot guard a door that has already chosen its offering.”
- MAHMUT: “Then it can choose someone who is not under my shield.”

### Chapter 1 — Whispering Ash Forest  
**Turkish meaning:** Fısıldayan Kül Ormanı  
**Recommended level:** 1–3  
**Backdrop:** Rain-dark road, pale ash leaves, abandoned shrine, distant St. Luthos bell tower  
**Enemy family:** Ash Wolves, Hollow Pilgrims, Bellbound Dead  
**Chapter role:** Introduce the duo, tactical basics, forest memory motif, and first cover story.  
**Guest cast:** Brin, Kera and Nixie are loaned in 1-2 so the two free starters can field a five-person team. Brin joins permanently after 1-2; Kera and Nixie remain temporary story loans until Kera departs after 1-3 and Nixie joins permanently after 1-4.

| Node | English title / type | Scene, encounter and story turn |
|---|---|---|
| 1-1 | **The Road That Whispers** — Normal/VN | The only two-hero tutorial: Mahmut and Fadyme fight Ash Wolves and a Hollow Pilgrim in a free no-Ration battle. Teach automatic turn order, Basic/Active behavior, Focus, player-triggered/automatic Ultimate and x1 speed. Fadyme recognizes the bell but calls it an echo. |
| 1-2 | **No Bell in the Trees** — Normal/VN guest | Brin braces a fallen beam while Bellbound Dead threaten woodcutters; Nixie scouts the road and Kera's herb cart is overturned nearby. Loan all three so Mahmut and Fadyme can field five heroes and teach 2 Front / 3 Rear placement. Brin joins permanently; Nixie and Kera remain story loans. The shrine keeper gives First Oath Invitation. |
| 1-3 | **A Cart of Empty Bottles** — Normal/VN guest | Before deployment, the player claims the invitation and selects one permanent 4★ character from Tilda, Rikka, Odelia, Pippa, Thistle, Iona or Marek. Kera's overturned alchemy cart has drawn Hollow Pilgrims; loan her to fill the fifth slot and introduce Burn. She trades a vial for a route map and leaves to warn the Red Vial Guild. |
| 1-4 | **The Map's Little Lie** — Normal/VN guest | Nixie marks a safe route and loans her rear-line counter kit. After the wolves are beaten she joins permanently and the five-owned-hero starter formation is complete before the 1-5 boss. x2 battle speed is unlocked after this tutorial. |
| 1-5 | **The Ash-Maw** — Boss/VN | A wolf carcass fused with a cracked bell attacks in two short phases. Breaking its jaw-bell interrupts its howl; Stone and Ember are both viable. After victory, Fadyme's fingertips briefly lose color. Mahmut notices her hand is cold; she blames the rain. |

**Dialogue core, English:**

- MAHMUT: “The road has no tracks going in.”
- FADYME: “Then we are the first people foolish enough to take it.”
- BRIN: “I can hold this shrine. You two keep moving.”
- FADYME, private thought: “One step. Then another. The road does not need to know how many it costs.”

### Chapter 2 — The Ruined Cathedral of Saint Luthos  
**Turkish meaning:** Aziz Luthos'un Yıkık Katedrali  
**Recommended level:** 3–6  
**Backdrop:** Broken rose window, flooded nave, candle archive and a bell tower with no rope  
**Enemy family:** Hollow Clerics, Choir Knights, Inkbound Dead  
**Chapter role:** Establish the old royal rite, introduce Aveline and Mirel, and show that official records have been altered.  
**Guest cast:** Aveline, Mirel, Nixie; all can be loaned. Nixie leaves for Oakhaven after the boss.

| Node | English title / type | Scene, encounter and story turn |
|---|---|---|
| 2-1 | **Rain in the Nave** — Normal/VN | Hollow Clerics occupy the nave. The scene teaches Veil's Dread and Fadyme's support damage. A bell rings although its clapper is missing. |
| 2-2 | **The Choir Without Breath** — Normal/VN | Two Choir Knights share a ward. The party must remove or outlast the shared protection. Aveline arrives to evacuate pilgrims and offers a story-loan Dawn healer. |
| 2-3 | **The Guest Roll** — Normal/VN guest | Mirel reads the cathedral's guest register. Fadyme's name is scraped from a line that should list the royal heir. Lend Mirel as a buffer; her Ink Index marks a priority target. |
| 2-4 | **A Page Beneath the Font** — Normal/VN guest | Aveline and Mirel combine a prayer ledger and a water-stained royal page. The surviving sentence calls the rite “a life held against the dark.” Fadyme closes the book before Mahmut can read the missing lines. |
| 2-5 | **The Bell-Widow's Verdict** — Boss/VN | Yseldra guards the royal record chamber. Her wax-seal shield must be broken before interrupting a charged judgement. Defeated, she refuses execution and escapes through the bell tower, leaving the seven-notched gray seal. Nixie recognizes Oakhaven and leaves to warn the locals. Aveline and Mirel remain to protect the archive. |

**Dialogue core, English:**

- AVELINE: “A seal can protect a life and still take payment.”
- MAHMUT: “Then we find the person who wrote the price.”
- YSELDRA: “You keep asking who wrote it. Ask who keeps it running.”
- FADYME: “She is trying to frighten you.”
- YSELDRA: “No, princess. I am trying to make him leave while you still can.”
- FADYME: “Or the person who erased it.”
- MIREL: “Someone removed the last page by hand. This was not age.”

### Chapter 3 — Oakhaven, the Red Harvest  
**Turkish meaning:** Oakhaven ve Kızıl Hasat  
**Recommended level:** 6–9  
**Backdrop:** Orchard walls, a windmill, a village well and white linen drying in the square  
**Enemy family:** Corrupted Mercenaries, Red Vial Scouts, Orchard Ghouls  
**Chapter role:** Make the curse bodily, bring Jori into the traveling company, and give the duo their first public rescue.  
**Guest cast:** Jori becomes a permanent free recruit; Kera and Nixie return temporarily; Pippa performs at the village inn.

| Node | English title / type | Scene, encounter and story turn |
|---|---|---|
| 3-1 | **The Empty Orchard** — Normal/VN | Orchard Ghouls hide among fallen fruit and attack the rear row. Nixie returns with a warning and lends her scout kit. She says the mercenaries are collecting people with royal marks. |
| 3-2 | **A Smith's Last Bell** — Normal/VN guest | Jori barricades the village forge with a compact shield. Lend Jori to teach a basic guard action. Kera identifies red glass residue on the mercenary weapons but cannot explain why the residue reacts to Fadyme. |
| 3-3 | **The Well Runs Red** — Normal/VN | Protect villagers while Corrupted Mercenaries attempt to poison the well. Fadyme uses a Veil spell, coughs blood into her glove and wipes the stain onto a white scarf. Mahmut sees the red on his own gauntlet; she claims it is a mercenary's blood. |
| 3-4 | **The Inn of Borrowed Names** — Normal/VN | Pippa's song keeps the villagers calm while the enemy tries to steal the registry. Her temporary Gale buff teaches Focus timing. Pippa leaves to carry names and news to a nearby refuge. Jori chooses to travel with Mahmut and Fadyme after the village is safe. |
| 3-5 | **The Mercenary Captain** — Boss/VN | Captain Rusk uses a marked-target volley and calls two guards. Interrupting the banner signal prevents reinforcements. The captain carries an order to the Red Vial Guild; a seven-notched gray seal hides the initials C.V. on its reverse. Fadyme asks Mahmut not to read it until they have a healer. |

**Dialogue core, English:**

- JORI: “I made a shield because I was tired of doors being the only thing between us and danger.”
- MAHMUT: “Then you may walk beside us.”
- FADYME: “You should know he says that as if it were not the kindest thing he can offer.”
- MAHMUT: “I heard that.”
- FADYME: “I know.”

### Chapter 4 — The Subterranean Undercity  
**Turkish meaning:** Yeraltı Şehri  
**Recommended level:** 9–12  
**Backdrop:** Drainage canals, mushroom lamps, abandoned cisterns and a hidden alchemist ward  
**Enemy family:** Red Vial Alchemists, Chain Cultists, Glass Vipers  
**Chapter role:** Put a private time limit in the player's hands while Fadyme actively hides it from Mahmut.  
**Guest cast:** Odelia, Kera, Tilda, Iona, Clem and Thistle rotate through the chapter. Kera remains the lead contact but leaves after the boss to secure the antidote archive.

| Node | English title / type | Scene, encounter and story turn |
|---|---|---|
| 4-1 | **Stairs Below the Cistern** — Normal/VN | The party descends into the Undercity and fights Glass Vipers that strike the rear row. Odelia lends an aimed shot that marks the viper nest. |
| 4-2 | **The Red Vial Ward** — Normal/VN guest | Kera returns with a guild ledger; Tilda and Iona run a clandestine healing table. Lend Tilda or Iona based on the player's tutorial choice. They cleanse a poison debuff and show that the city's healers are not aligned with the Guild. |
| 4-3 | **The Measure of a Life** — Normal/VN private | Clem leads Fadyme to an old alchemist's locked room while Mahmut distracts the wardens. The alchemist explains that the bell has accelerated the curse: not a month now, but weeks, perhaps less. Fadyme asks him not to tell Mahmut. In the battle, Thistle lends a small heal and cleanse. |
| 4-4 | **The Elixir Lie** — Normal/VN | Fadyme tells Mahmut the Guild has a restorative elixir that may help. Kera knows the recipe is incomplete but agrees to test it rather than expose Fadyme's secret in the street. Fight Chain Cultists trying to take the ledger. |
| 4-5 | **The Red Vial Matron** — Boss/VN | The Matron cycles between a glass shield and corrosive flasks. Destroying the flask racks reduces her area damage. Kera stays behind to preserve the antidote archive; Tilda and Iona reopen the healing ward. Fadyme keeps the new weeks-long estimate to herself.

**Dialogue core, English:**

- ALCHEMIST: “Not a month now. Weeks, perhaps less, if the bell keeps calling.”
- FADYME: “And if I stop answering?”
- ALCHEMIST: “Then perhaps the bell will take the answer from someone else.”
- FADYME, private thought: “Mahmut has already given enough years to my name.”
- MAHMUT: “What did he say?”
- FADYME: “That the elixir might work.”

### Chapter 5 — The Bridge of the Forsaken  
**Turkish meaning:** Terk Edilmişlerin Köprüsü  
**Recommended level:** 12–15  
**Backdrop:** A great stone span over a fog-filled ravine, torn banners and abandoned siege engines  
**Enemy family:** Lost Vow Knights, Corrupted Crown Guard, Bridge Revenants  
**Chapter role:** Confront Mahmut's former commander and make the curse's physical progression unmistakable to the player.  
**Guest cast:** Marek and Nara aid the bridge defense; Rikka and Sable join the infiltration; Odelia carries a warning. Temporary guests can be substituted by owned characters.

| Node | English title / type | Scene, encounter and story turn |
|---|---|---|
| 5-1 | **A Banner in the Fog** — Normal/VN | Marek arrives as a herald for refugees and recognizes Mahmut's stripped crest. He offers a Gale control trial to slow the first knight wave, then carries the refugees toward safety. |
| 5-2 | **The Gatekeeper's Measure** — Normal/VN guest | Nara holds a narrow bridge gate while the party disables two siege winches. Her loaned tank kit demonstrates guarding an ally rather than provoking every enemy. She leaves to keep the span open for civilians. |
| 5-3 | **A Knife Between Orders** — Normal/VN guest | Sable and Rikka slip into a supply tower. Rikka draws the guards while Sable disables the signal bell; both are available as temporary units. Sable finds Mahmut's former commander's seal on an order targeting Fadyme. |
| 5-4 | **The White Strand** — Normal/VN | Odelia brings word that the bridge has been mined. During a bell pulse, a lock of Fadyme's hair turns white. She hides it under her hood. Mahmut notices the change in her voice, not the strand. |
| 5-5 | **The Commander Who Remained** — Boss/VN | Marshal Oren, Mahmut's former commander, uses a shield formation and a delayed bridge-wide strike. Destroy the signal standard to stop reinforcements. Oren admits the Crown Guard knew Fadyme's blood was tied to the rite; he says he believed the rite would save the kingdom without consuming its heir. Oren stays to keep the span open until the last civilians cross, then leaves by the estate road before anyone can hold him to account; his whereabouts are unknown. Marek and Nara stay to escort survivors; Rikka returns to the kiln company; Sable follows the estate route alone. |

**Dialogue core, English:**

- OREN: “I gave the order. I did not know it would hollow her out.”
- MAHMUT: “You knew enough to send men after her.”
- OREN: “The Ashen estate has the full schedule. Go before the bridge falls.”
- MAHMUT: “You are coming with us.”
- OREN: “No. Someone must keep this span open. I will not fail the people twice.”
- FADYME, private thought: “The white strand is small. I can still hide something small.”

### Chapter 6 — The Ashen Lord's Estate  
**Turkish meaning:** Kül Lordunun Malikânesi  
**Recommended level:** 15–18  
**Backdrop:** An aristocratic manor of soot-dark stone, sealed portrait gallery, glass conservatory and a half-collapsed archive  
**Enemy family:** Noble Retainers, Inkbound Dead, Estate Wraiths  
**Chapter role:** Bring separated companions back, reveal the Crown's deliberate deception and stage the manor collapse.  
**Guest cast:** Aveline, Mirel, Sable, Vespera, Hana, Thistle and Iona reappear. Nara and Marek support the evacuation off-screen and in inter-node scenes.

| Node | English title / type | Scene, encounter and story turn |
|---|---|---|
| 6-1 | **The Servants' Entrance** — Normal/VN | Sable opens a side entrance, having found the estate's servants locked below. Use her loaned Veil assassin to remove a Bellbound sentinel before it calls reinforcements. |
| 6-2 | **Portraits Without Names** — Normal/VN | Mirel and Aveline return with the cathedral folio. Each portrait's nameplate has been removed. Hana holds off Estate Wraiths while the others search the gallery. |
| 6-3 | **The Sealed Conservatory** — Normal/VN guest | Vespera recognizes a glass ward as the same pattern used in the Undercity. Thistle and Iona coordinate a field infirmary. A loaned Vespera can dispel the ward; the battle can also be won by destroying its three anchors. |
| 6-4 | **The Manor Gives Way** — Normal/VN | The estate collapses after the party recovers one ritual ledger page. The cast splits to rescue servants and preserve the page. Fadyme uses a forbidden burst to hold a stone arch, then insists she is merely dizzy. Mahmut is pulled away by a trapped child. Mirel finds the seven-notched seal on a torn margin beside a handless-watch diagram signed C.V. |
| 6-5 | **The Ashen Lord's Wraith** — Boss/VN | A dead noble bound to the estate uses portrait doubles and a falling-beam telegraph. Breaking the mirror frame removes its copied shield. After the victory, Mirel compares the recovered page with the cathedral record: the rite is still operating at the First Eclipse Altar. Everyone agrees to converge there; companions take separate safe routes. |

**Dialogue core, English:**

- MIREL: “The missing page was not a cure. It was a schedule.”
- AVELINE: “A schedule for what?”
- FADYME: “For the bells.”
- MAHMUT: “And for you?”
- FADYME: “For the heir. The ink does not say more.”

### Chapter 7 — The Altar of the First Eclipse  
**Turkish meaning:** İlk Tutulmanın Sunağı  
**Recommended level:** 18–20  
**Backdrop:** A crown-shaped crater, seven broken bell chains and a circular altar under an unmoving eclipse  
**Enemy family:** Royal Hollows, Eclipse Sentinels, Crownless Knights  
**Chapter role:** Resolve the Part I investigation, defeat the mechanism, reveal the cost to Mahmut and end on a clear Part II goal.  
**Guest cast:** The entire roster appears across the chapter. Companions hold side routes or speak in VN scenes while the player's chosen five-person formation fights; no guest slot removes one of the player's five deployed heroes. No character is required from gacha.

| Node | English title / type | Scene, encounter and story turn |
|---|---|---|
| 7-1 | **The Stair of Seven Chains** — Normal/VN | Nixie and Odelia scout the approach; Jori recognizes the smith marks on the chains. Fight Royal Hollows and teach the player to inspect enemy intent before a boss. |
| 7-2 | **Those Who Held the Road** — Normal/VN | Brin, Rikka, Nara and Marek arrive with survivors from earlier routes. They hold the outer steps while Mahmut's core team advances. The scene acknowledges each companion's prior departure and choice to return. |
| 7-3 | **The Names We Kept** — Normal/VN | Aveline, Mirel, Clem and Pippa reconstruct the missing ritual record. Kera's copied formula shows the altar can be interrupted but not safely destroyed. Fadyme's name disappears from the page and returns in Mirel's handwriting. |
| 7-4 | **Before the Last Toll** — Normal/VN | Sable, Vespera, Tilda, Iona, Thistle and Hana prepare barriers and evacuation routes. Fadyme privately asks Mahmut to stay beside her after the battle. He promises, still believing they will find a cure in the mechanism. |
| 7-5 | **The Eclipse Construct** — Boss/VN | Two-phase final boss. Phase I has a Stone weakness and breakable chain joints; Phase II raises an Aether Ward and applies Decay. The player can break pylons, cleanse or shield marked allies and time burst damage. After defeat the curse surges, Fadyme collapses, and Mahmut finally understands that she is dying. Only after this confession does a mirror reveal Lord Cael Veyr, the presumed-dead Clockless Chancellor, as the architect of the Unwritten Hour and the altar's time-loop design. |

**Dialogue core, English:**

- FADYME: “If the bell asks for a name, write mine where you can see it.”
- MAHMUT: “When this is over, you are telling me everything.”
- FADYME: “When this is over, I will tell you what I can.”
- MAHMUT: “That is not the same promise.”
- FADYME: “No. It is the honest one.”

## 5. Chapter 7 boss — The Eclipse Construct

**Silhouette:** A cathedral-sized brass-and-stone guardian built around a hollow bell. Its limbs are made from broken crown arches and chained altar slabs. It is magical machinery, not a living person.  
**Player expectation:** Level 20 is recommended and required to unlock the finale. A balanced five-hero party helps, but there is no mandatory gacha element.  
**Resistance rules:** Phase I is weak to Stone attacks and normal to the other player elements. Phase II's Aether Ward is a boss-only property, not a seventh playable element. Stone damage to the three visible pylons lowers the ward; Dawn cleanse and shields answer Decay.

### Phase I — Crownless Frame

- Construct HP is split into a 60% phase bar.
- Two chain joints and one ankle anchor are visible. Each has a small independent break meter. Stone attacks deal +50% break damage.
- **Crownfall Sweep:** One-turn telegraph, then front-row physical damage. Guard, swap formation or break an ankle anchor to reduce the strike.
- **Bell Without a Rope:** The construct marks one ally for a delayed strike. The mark and target portrait remain visible in the Action Gauge timeline.
- Breaking both chain joints removes its area shield for one cycle and adds delay to the next boss Action Gauge threshold. The phase is beatable without breaking them, but with higher healing demand.

### Phase II — Aether Ward

- At phase change, three Aether Pylons appear and a 20% phase-HP ward activates.
- **Aether Ward:** While active, the boss takes 35% less damage. Stone attacks against pylons reduce the ward; hitting the boss directly does not.
- **Decay Brand:** Marks one hero for two turns. At the end of the second turn it deals a moderate percentage of current HP and lowers healing received for one turn. Cleanse, shield or defeat the pylon linked to the mark before it resolves.
- **Eclipse Pulse:** Telegraphs at boss readiness and resolves after one player action opportunity; it targets the full party. The pulse is survivable at level 20 with ordinary story equipment. Breaking one pylon cuts damage; breaking all three removes the follow-up pulse.
- At 25% HP the ward collapses permanently. The boss gains no sudden enrage or unavoidable wipe attack; the end is a readable damage-and-survival check.

### Victory story and cliffhanger

The construct falls silent, but the bells behind the altar begin to ring without it. Fadyme hides the black-gold lines on her hand and tells Mahmut she is tired. She collapses once the five-person party reaches the outer dais. The boss fight and emotional reveal are separate narrative beats.

**Final VN scene, English:**

MAHMUT: “All this time, you were carrying something alone.”  
FADYME: “I thought if I smiled, the curse would have to wait its turn.”  
FADYME: “You still do not understand. I am dying, Mahmut. The curse is taking my hours one by one.”  
MAHMUT: “Then I will find the hand that wrote this curse. I will not let it write the last line.”  
FADYME: “I was afraid you would look at me and see a final hour.”  
MAHMUT: “I see you. I should have seen you sooner.”

After the confession, a separate VN scene begins. A reflection moves in the altar's polished black stone. Lord Cael Veyr, the presumed-dead Clockless Chancellor, steps through it with a handless watch; Yseldra appears behind him. Cael reveals that he made the door, while Yseldra chose the bearer, and offers to return Fadyme's hours for one hour belonging to Mahmut. This scene is not part of the boss fight or the emotional confession.

CAEL: “Lord Cael Veyr. The Clockless Chancellor, if titles still comfort anyone.”  
FADYME: “Uncle.”  
MAHMUT: “You made her curse.”  
CAEL: “I made a door. Yseldra chose who would stand in it.”  
YSELDRA: “Do not mistake him for your answer, Fadyme. He only knows how to turn grief into a bargain.”  
CAEL: “Come to the Clockless Court, Mahmut. I can return the hours the curse has taken. The price is one hour that belongs to you.”

The mirror goes dark. Mahmut's next goal is to find the Clockless Court and learn whether Cael's promise is real. Cut to black: **Part II — The Hours We Have Left**. The result screen, save and account remain normal; the visual effect is confined to the story scene.

The twist preserves two separate emotional beats: Mahmut first learns Fadyme is dying; only then does the player learn who designed the mechanism and what he intends to do. Cael is not the Chapter 7 battle boss and cannot undercut the loss reveal with mid-fight exposition.

## 6. Playable cast appearances, departures and acquisition

Every cast member has a chapter moment independent of ownership. The listed guest battle is a loan unit and does not imply a permanent join. The banner schedule is a launch plan proposal; standard characters remain in the permanent pool after their showcase.

| Character | Story entrance and scene | Join / departure | Account acquisition |
|---|---|---|---|
| Mahmut | Ch. 1, all chapters | Permanent lead | Free at start |
| Fadyme | Ch. 1, all chapters | Permanent lead | Free at start |
| Kera Voss | Ch. 1-3, returns Ch. 3 and Ch. 4 | Leaves after Ch. 1; leads Undercity investigation; remains to copy the antidote archive | Oath Banner 1; permanent pool |
| Brin Alder | Ch. 1-2, returns Ch. 7 | Joins permanently after saving the woodcutters; leaves at 2-1 to escort forest refugees; returns for the outer defense | Free story recruit after 1-2; Oath Banner 1/permanent pool for copies |
| Nixie Vale | Ch. 1-4, returns Ch. 7 | Joins permanently after 1-4; later leaves Cathedral to warn Oakhaven and rejoins for the altar | Free story recruit after 1-4; Oath Banner 2/permanent pool for copies |
| Sister Aveline | Ch. 2, 6-7 | Protects Saint Luthos archive, returns for altar; leaves the active travel column between scenes | Oath Banner 1 limited focus |
| Sable Wren | Ch. 5-7 | Infiltrates the Estate and moves ahead to the Altar | Oath Banner 2 limited focus |
| Tilda Fen | Ch. 4, 6-7 | Runs Undercity infirmary; reopens a field clinic after Ch. 4 | Oath Banner 2; permanent pool |
| Rikka Ember | Ch. 5, 7 | Returns to kiln company after the bridge, answers the final call | Oath Banner 3; permanent pool |
| Mirel Quill | Ch. 2, 6-7 | Protects Cathedral records, returns to compare the recovered page | Oath Banner 4 limited focus |
| Odelia Pike | Ch. 4-5, 7 | Carries messages between the village and bridge; rejoins for final scouting | Oath Banner 3; permanent pool |
| Pippa Bell | Ch. 3, 7 | Carries the village names to refuge; sings the names back into the final record | Oath Banner 4; permanent pool |
| Nara Vell | Ch. 5-7 | Holds bridge gate, escorts civilians, leads outer Altar defense | Oath Banner 3 limited focus |
| Clem Marr | Ch. 4, 6-7 | Guides Fadyme to the private alchemist; follows the missing page lead | Standard banner pool |
| Vespera Wisp | Ch. 6-7 (earlier Undercity visit referenced at 6-3) | Recognizes the ward in the Estate; returns to remove the altar's false seal | Oath Banner 5 limited focus |
| Hana Birch | Ch. 6-7 | Helps evacuate estate servants, joins outer defense | Standard banner pool |
| Thistle Roe | Ch. 4, 6-7 | Heals the Undercity and Estate survivors | Oath Banner 5; permanent pool |
| Iona Mist | Ch. 4, 6-7 | Reopens the Undercity ward, later runs the Altar field infirmary | Oath Banner 5; permanent pool |
| Jori Flint | Ch. 3-4, 7 | Permanently joins after the 3-4 Oakhaven battle; returns to Oakhaven's gate after 4-5; returns to guard the Altar's outer stairs | Free story recruit after Ch. 3-4 |
| Marek Vane | Ch. 5, 7 | Escorts refugees from the bridge, returns with the survivors | Oath Banner 4; permanent pool |

## 7. Banner presentation that supports the story

Each banner is introduced after its character has appeared in story. The rate-up is a new way to recruit that known companion, not a prerequisite to see their story. A free story-loan unit appears in their featured scene.

| Banner | Feature | Featured 4★ companions | Story tie-in |
|---|---|---|---|
| Oath Banner 1 | Sister Aveline, 5★ limited | Kera Voss, Brin Alder | Saint Luthos archive and healing the road |
| Oath Banner 2 | Sable Wren, 5★ limited | Nixie Vale, Tilda Fen | Bridge infiltration and a healer's field kit |
| Oath Banner 3 | Nara Vell, 5★ limited | Rikka Ember, Odelia Pike | Bridge defense and the white strand |
| Oath Banner 4 | Mirel Quill, 5★ limited | Pippa Bell, Marek Vane | Reconstructing the missing page and carrying names |
| Oath Banner 5 | Vespera Wisp, 5★ limited | Thistle Roe, Iona Mist | Estate glass wards and the altar approach |

A matching signature-weapon banner runs beside each limited character banner for the same 15-day period. The names below are current design names for weapon art and content IDs; every signature is optional, craftable/hunt gear remains viable, and no weapon is required for story access.

| Banner | Selected signature weapon | Art / prop anchor |
|---|---|---|
| Oath Banner 1 | **Lantern of the Last Vigil** (`weapon_aveline_last_vigil`) | Reliquary staff and sun-disc at Saint Luthos |
| Oath Banner 2 | **Quietus at the Broken Bell** (`weapon_sable_broken_bell`) | Courier twin blades and severed bell-rope |
| Oath Banner 3 | **Gatewarden's Promise** (`weapon_nara_gatewarden_promise`) | Glaive and compact kite shield at the bridge gate |
| Oath Banner 4 | **The Unwritten Ledger** (`weapon_mirel_unwritten_ledger`) | Brass astrolabe folio and stylus dagger |
| Oath Banner 5 | **Mirror of the Last Hour** (`weapon_vespera_last_hour`) | Glass lantern and focus ring in the conservatory |

Character and weapon banners share Fate's Thread but use separate pity. Weapon Fate Knots and pity carry according to [PART1_ECONOMY_ANDROID.md](PART1_ECONOMY_ANDROID.md). The weapon banner must be clearly labeled as a long-horizon optional chase.

Clem Marr and Hana Birch are 3★ standard characters and can appear in every compatible banner pool. Limited 5★ characters return on a published rerun plan; pity and featured-guarantee state carry according to the GDD rules. No character is sold as a story chapter key.

## 8. Writing and implementation handoff

- Dialogue files should be keyed by chapter, node, scene and line ID; the English text is authoritative for UI and JP recording.
- JP voice direction should map each line to emotion, intensity, pause and breath notes. Do not assign a real voice actor in the design document.
- A story loan must reference a stable character ID and temporary level/build template.
- Story nodes must list guest characters, owned-character replacement policy, enemy family, battle mechanic, rewards and unlock conditions.
- Visual progression for Fadyme is subtle and cumulative: cold fingers, shortened breath, red stain, one white strand, then visible fading marks. Never make the condition an Auto-battle penalty.
- Chapter end screens preserve previous route memories through small companion callbacks. Do not repeat introductions when a returning character has already appeared.

## 9. Canon decisions — 2026-09-27 (Narrative Master Plan, Phase 0)

Approved by the project owner. Full ledger: `lore/canon.md`; chronology: `lore/timeline.md`; magic rules: `lore/world_rules.md`.

- **Mahmut (C1):** On the night of Crownfall he defied Marshal Oren's order to deliver the heir to the altar and helped Fadyme escape. The Council of Dukes recorded it as treason. They were separated during the flight; he later found her again in a village.
- **Oren (C2):** Holds the bridge, then leaves by the estate road without facing Mahmut. Whereabouts unknown. His atonement is to "the people", not to Mahmut or Fadyme; it is deliberately unfinished.
- **House Veyr (C3):** Veyr is not the reigning dynasty but the ancient bell-keeping house the kingdom is named after. The throne passes through Fadyme's father; the Last Bell blood through her mother, a Veyr. The name was deliberately removed from court records, so a palace guard would not know it. **Lord Cael Veyr is Fadyme's maternal uncle.** Fadyme recognizes his hand from her father's last page (3-5, 6-4) and names him at the Part I ending: “Uncle.” Part I ends on this reveal.
- **Yseldra (C4, C9):** At Crownfall the Inquisition was ordered to deliver a bearer; Yseldra chose Fadyme, believing the seal would shield her. Her present protectiveness is guilt. The seven cut seals on her chain mark seven lives the bells took during her service. Fadyme is the last living Veyr blood, not the first bearer. *(Reworded by C16, 2026-09-29: the last living daughter of the Veyr bell line; Cael is Veyr by birth, not of the bell line.)*
- **“Vale” (C5):** A common surname given to unregistered roadside children in Veyrhold. Nixie and Yseldra are not related.
- **Departures (C6):** Brin leaves at 2-1; Jori returns to Oakhaven after 4-5. Both return in Chapter 7.
- **Timing (C10):** Crownfall was six years before Part I. The guest-register cut at 2-3 is recent (last winter).
- **Seal on the chains (C11):** The 7-1 chains carry the seven-notched Inquisition seal.

## 10. Part I targeted revision pass — 2026-09-27 (Master Plan Phase 2)

Line-level additions; no node, boss, recruit or chapter event changed. Exact lines are in the chapter scripts.

- **Mahmut's secret (opening, 2-5, confession):** his "No." to "Do you know her?" is delivered too quickly; at 2-5 Yseldra exposes that he knew her; in the confession he admits he saw her call Fadyme to the altar at Crownfall. The mirror is now two-way: both of them were pretending.
- **Rusk's order (3-5 → 4-2):** Mahmut carries it sealed; Tilda opens it in the Undercity ward. It asks for the heir's blood, preparing the Matron's line at 4-5.
- **The letter (4-4):** Fadyme refolds the opening letter into her mother's prayer book. Payoff reserved for the Part II opening.
- **Breaking the pattern (5-4):** Mahmut does not drop the question; Fadyme has no answer ready.
- **Oren (5-5):** "Yseldra carried the order from the Inquisition. I signed it."
- **Mirel's atonement (6-2, 7-3):** she recognizes her own scribe's hand on the erasure order and writes Fadyme's name back herself.
- **A witness (6-4):** Hana sees Fadyme's arm; Fadyme asks her not to tell Mahmut.
- **The Ashen Lord (6-5):** he hid "the bell-keeper's daughter" (Fadyme's mother) from the Crown.
- **Jori (7-1):** "We made a cage and called it a bridge."
- **Deferred:** R17, trimming the Chapter 7 roll-call lines, needs a dedicated pass because it removes authored lines.

## 11. Part I completion pass — 2026-09-27

- **Chapter 7 roll-call (R17):** Marek's duplicate 7-2 line and the Iona/Thistle 7-4 lines were removed; Hana's 7-4 line now closes her 6-4 promise. Both characters keep their beats in companion stories.
- **First Eclipse Cult context:** Kera (4-4) and Nixie (7-1) each name the chain-bearers and their belief.
- **Companion stories:** `content/character_stories_part1.json` — 76 parts for all 20 characters (2 each for Mahmut and Fadyme, 4 for everyone else). Unlock: ownership (except the two leads) plus a completed stage.
- **Events:** `content/events_part1.json` — four canon events: The Red Harvest Supper (festival), The Day the Eclipse Breathes (mystery), Guild Dispatch: Salt-Road Fever (guild), The Council's Herald (court).
- **Lore text:** `content/lore_text_part1.json` — 20 signature weapons, 27 enemies, 18 items, 12 codex entries.
- **Full script:** `docs/PART1_FULL_SCRIPT.md`, compiled start to finish with companion stories, events and codex as appendices.

## 12. Part I final scene pass — 2026-09-27

Thirteen non-battle VN scenes (no Ration cost, not counted in the 35 nodes) now connect the chapters. Order is in the manifest `story_order`.

| Scene | Placement | Purpose |
|---|---|---|
| `ch1_first_oath` | after 1-2 | Shrine keeper explains the First Oath Invitation in-world: the oath binds a companion's road to yours before your paths cross, so a chosen companion may still meet the party "as a stranger" in their own chapter. |
| `ch1_camp` | after 1-5 | Yseldra's distant bell and upward ash (Villain Bible Ch1 trace). |
| `ch2_road` / `ch2_camp` | before 2-1 / after 2-5 | Arrival at Saint Luthos; Fadyme confronts Mahmut's lie gently. |
| `ch3_road` / `ch3_camp` | before 3-1 / after 3-5 | Orchard road pacing; the sealed order and the decision to go below. |
| `ch4_road` / `ch4_camp` | before 4-1 / after 4-5 | The river city; Fadyme in the sun after the "weeks" estimate. |
| `ch5_road` / `ch5_camp` | before 5-1 / after 5-5 | Refugees warn of Oren; Fadyme keeps watch for the first time. |
| `ch6_road` / `ch6_camp` | before 6-1 / after 6-5 | Sable's signal; the company splits onto safe roads. |
| `ch7_road` | before 7-1 | Crater rim after the two quiet days. |

Also added: `content/character_voice_lines_part1.json` (220 lines: first meeting, team, idle, attacks, victory, defeat, low HP, two relationship lines per character) and banner copy plus chapter title cards in `content/lore_text_part1.json`.

## 13. World foundation W1 — 2026-09-29 (decisions C15–C21)

Approved by the project owner. No script line changed. Rules: `lore/world_rules.md` 6–10; terms: `lore/glossary.md`; facts: `lore/canon.md` F-012, F-014–F-019, W-006–W-012.

- **C15 The Ledger:** the seven bells are one account; unwitnessed dead become Hollows; a bell is a place, not bronze; distance slows payment and never stops it.
- **C16 The bell line:** only Veyr daughters of the bell line (mother to daughter) can be sealed; Cael is Veyr by birth, not of the bell line.
- **C17 Terms:** the Last Bell (the seven bells count, the Last Bell pays), bearer, the Last Bell seal, the Offering, the Sevenfold Crown, the First Eclipse, the two meanings of "heir".
- **C18 The Silent Bell:** silent since the throne wars (at least 15 years); seven bell-line daughters were spent standing in for it before Fadyme.
- **C19 Crownfall:** Fadyme was sealed beneath the Silent Bell in the capital ("I saw her call you to the altar that night"); the second order sent her to the First Eclipse Altar.
- **C20 Cael:** the Unwritten Hour, the Rewrite, the Hinge, the Schedule; public promise vs hidden aim (SECRET until Part II).
- **C21 Yseldra's bell:** a calling bell stays tuned to its bearer; hers rings on its own, which is how she finds Fadyme.

## 14. World foundation W2 — 2026-09-29 (decisions C22–C28)

Approved by the project owner. No script line changed. Facts: `lore/canon.md` F-020–F-026; rule 11 in `lore/world_rules.md`.

- **C22** The throne wars were the ducal succession war over **King Audren of House Carrow**, who had no legitimate children.
- **C23** Fadyme was recognized in secret at 7 (raised in a guarded royal hunting lodge) and publicly at 13, when she came to court; Mahmut was assigned as her shield because the declaration made her a target.
- **C24** The king's last page is Cael's unanswered letter; the king refused. After his death Cael, as chancellor, issued both Crownfall orders under the Inquisition seal.
- **C25** The Council of Dukes is the dukes' truce after Crownfall; an empty throne keeps the peace.
- **C26** The king died inside the Unwritten Hour, so no one knows who killed him; Cael's name fades from memory (rule 11). This is why no one at 3-5 or 6-4 can place "C.V.".
- **C27** Oren's company is paid by the Council to finish the Crownfall order.
- **C28** The portrait that "came down" (`ch1_camp`) hung in the king's study and fell on Crownfall night.

## 15. World foundation W3 — 2026-09-29 (decisions C29–C30)

- **C29 The clock:** Part I lasts about three weeks; route days follow the script (`ch3_road` 3, `ch5_road` 4, `ch7_road` 2). Mirel's rewrite at 7-3 delays payment (world rule 3), which is why "weeks" remain after 7-5. Iona's nightly reading and Clem's daily writing of the name keep delaying it: their companion gifts are mechanical, not only comfort.
- **C30 Names:** the capital is **Carrowgate**; the river city above the Undercity is **Glassford**. Neither is spoken in Part I.
- Location IDs: `lore/locations/registry.md` (44 IDs).

## 16. World foundation W4 — 2026-09-29 (decisions C31–C32)

- **C31 The Six Manners:** the combat elements are the ways the living spend their hours: Ember burns, Gale carries, Stone holds, Tide returns, Dawn witnesses, Veil hides. Dawn↔Veil is the game's theme as a rule. Fadyme is Veil (the hidden debt); her arc moves toward being witnessed. `lore/elements.md`.
- **C32 Registries:** `lore/factions/_registry.md` (data faction IDs canonical, lore mapping, character affiliations) and `lore/bestiary.md` (Hollow, Bellbound, Inkbound, Wraith, Ashbound, Construct, Living; all 27 enemies).
- World foundation W1–W4 is complete. Next: the Part I story pass.

## 17. Part I story pass, step 1 — 2026-09-29 (decisions C33–C35)

- **C33** Fadyme's purpose: pay in full at the Altar, by choice; dramatic irony: her Offering would have fed Cael's Rewrite.
- **C34** The letter's contents are locked (truth; release from the oath; "Let no one pay for my hours. Not even you."; the king's last page inside); payoff at the Part II opening.
- **C35** Added lines: `node_3_1_post_004` (after the blank name boards) and `node_7_3_pre_007` (after "witnesses, not sacrifices"). Both are Fadyme's thoughts. 411 main-story lines.

## 18. Part I story pass, step 2 — 2026-09-30 (decision C36)

Continuity fixes, no new beats: Mahmut heads east for the altar road (the estate schedule is Oren's news at 5-5); Kera compares the wax to Mahmut's shield; Jori replaces Rikka in Tilda's first story; Nixie's second story unlocks after 3-4 and Kera's third after 4-5; Sable carried the Council's first commission, not the Crownfall order; Odelia's message gathers the companions at the estate; the 6-2 gallery shows the handless-watch portrait that Mahmut mentions at 6-4 (a required background detail). Details: `lore/canon.md` C36.

## 19. Part I story pass, step 3 — 2026-09-30 (decision C37)

- **Yseldra between 2-5 and the ending:** she is ahead of the party, hunting the ledger wing's hunters without killing (bound Red Vial scouts sealed in gray wax, `ch4_road`) and leaving a fresh seal on the estate road milestone (`ch6_road`: "She is ahead of us." / "Then she reaches the altar before we do."). This prepares her presence in the mirror scene.
- **Quieter companions get a line each:** Rikka (5-5, her departure), Iona (4-5), Clem (6-1), Thistle (6-3), Pippa (7-3). 419 main-story lines.
- **After 7-5:** companion parts spread over the night on the dais, the dawn, and the road down (crater rim, lower pass).
- **Spoilers:** `docs/SPOILER_UNLOCK_POLICY.md`.

## 20. Part I story pass, step 4 — 2026-09-30 (decision C38)

**The Ashen Lord** was Lord Edric Aske, the Crown's Keeper of the Schedule. He timed every Offering, hid the last bell-line daughter (Fadyme's mother) at his estate, where the king met her and Fadyme was born, and after Crownfall refused Cael the Schedule, sealing himself in the archive to die. His name erased, he became a Wraith repeating his last order: hide them from the Crown. That is why the house locks its servants away and why it fights anyone who opens a door. His name is never spoken in Part I. No script line changes. `lore/characters/ashen_lord.md`.
