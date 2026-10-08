# Opening tutorial revision v006 — 2026-10-08

Owner-requested local revision. This supersedes the tutorial text and direct 1-1 handoff described in earlier opening reviews. Main-story canon remains in the existing character and story documents. The newly authored tutorial interactions are connective presentation material: existing companions, modest roadside encounters and a quiet shared shelter, without new lore reveals or changing chapter-one events.

## Delivered changes

- Story Names now uses a complete painted writing arm. The runtime writes the readable English inscription **We were here.** character by character, with the quill following the text before lifting from the page.
- Ordinary Days places both walkers closer to the ground; Search lowers Mahmut; Reunion lowers and reduces Fadyme so she is visibly shorter than Mahmut on the same road plane.
- All six tutorial cutscenes start with **Auto enabled**. The button is a single normal-speed on/off toggle. There are no Auto x1/x2/x3 modes and no Skip controls.
- Text reveals at 26 characters/second without a recording. Short lines stay for at least 5.5 seconds, plus the transition pause. After complete reveal or finished voice playback, Auto waits at least 3.2 seconds; narration specifies 4 seconds. The final scene holds its closing line for 5 seconds.
- Speaker changes get a 1-second pause and a 0.8-second portrait dissolve. Consecutive lines by the same speaker get 0.65 seconds. The two shared illustrations stay visible across speaker changes. Manual Next still reveals the current text first and advances on the next press.
- Voice timing retains the Voice-bus recording clock and subtitle-cue hooks. Auto waits until a Japanese performance finishes. Current tutorial audio is intentionally deferred until final voice/music authoring.
- The script contains **107 English lines**, including **34 lines after the last battle**. Only Fadyme and Mahmut are playable; the encounters retain Bellbound Dead and Hollow Pilgrim, the two existing common enemy types. Reward-free tutorial and battle mechanics remain unchanged.

## First-install boundary

**Prologue → fade to black → Continue → T-1 before / battle / after → T-2 before / battle / after → T-3 before / battle / extended after → patch page → verified-install confirmation → process restart → fresh boot → existing game menu.**

Patch download runs independently of narrative pacing. If it finishes early, the tutorial still completes. If it finishes late, the final tableau dissolves into the download page while the transfer continues. Completion presents **Restart & Enter Game**; no automatic jump into 1-1 occurs. Clicking once or repeatedly requests only one restart. A failed restart exposes Retry without downloading the installed content again.

EntryRestart retains the existing implementation: desktop exports use OS.set_restart_on_exit and quit; Android uses the native activity/process rebirth path. Its one-use restart hint does not contain credentials. The completed tutorial checkpoint is account-scoped, and the next authenticated boot lands on the existing Hub menu with chapter 1-1 still unstarted. Returning players keep their existing content update / unfinished-battle / menu routing.

The native Local UI Preview deliberately simulates the restart boundary to keep the owner's editor session open. It uses local sample data and does not sign in, mutate accounts, grant rewards or restart the production client.

## Validation and evidence

- Godot 4.7.2 headless UI suite: **190 / 190 tests passed**, 105,697 assertions (`build/opening-revision-20261008/ui-tests-accepted.log`). This includes prologue contact/height, preloaded Auto lifecycle, minimum reading time, portrait dissolve, uninterrupted Japanese voice, early/late patch installation, restart idempotence, retry and fresh-boot menu routing.
- Real editor/runtime: all four changed prologue shots reviewed; both paired illustrations and the portrait transition captured in the existing native 540×960 preview. The transition snapshot measured incoming/outgoing alpha 0.5 / 0.5 while the next text remained empty.
- Real runtime opening sequence: all six readers, all three victories, late patch page, completed patch confirmation and preview restart boundary were exercised. The accelerated encounter clock and manual Next were used only by the local validation driver; the game does not expose Skip.
- A preview-only freed-node tween capture discovered during the full sequence was corrected using WeakRef. The patch simulation was then verified to continue after the tutorial was removed, without new log errors. The editor remained open; one debugger recovery restart was required after an invalid inspection path.
- Exported opening-base and data-only story patch passed `tools/verify_opening_pack.gd`: all three tutorials won, 32 pose textures, both icons/ultimates, both new paired illustrations and the complete writing arm loaded. The base has no main-story chapter payload or reference libraries. Mounting the patch makes existing chapters available.
- New local debug-signed AAB: `build/opening-aab-revision-20261008/opening-review.aab`, **135,146,148 bytes**, SHA256 **1b2f655165d5ab7ea0cf91457a528c12610be75069f2e15f451381ef15de8445**. JAR signature and bundletool validation passed. This is a local review build. Android device installation, actual device restart and production upload signing remain untested/pending.
- Native evidence: `after_names.png`, `after_ordinary_days.png`, `after_search.png`, `after_reunion.png`, `tutorial-roadside-native.png`, `tutorial-shelter-native.png`, `tutorial-mahmut-native.png`, `tutorial-dissolve-native.png`, `tutorial-fadyme-native.png`, `tutorial-ending-patch-wait-native.png`, `tutorial-ending-patch-complete-native.png`, `tutorial-ending-restart-native.png`, all under `build/opening-revision-20261008/`.

## Art sources and final prompt set

The following final production prompt briefs retain the generated assets' identity, composition and quality constraints. Generation used the **built-in image_gen tool**, with inspected local references. The selected outputs were copied into the project without replacing reference originals. Full paths, references, generation originals and SHA256 values are recorded in `game/assets/ui/narrative/tutorial_v002/SOURCE.json`.

### writing_arm_v003.png

Saved: `game/assets/ui/narrative/prologue_v002/writing_arm_v003.png`. Transparent background: `True`.

Edit the reference into a complete natural writing arm for a painted dark-fantasy prologue. Keep the pale feminine hand, brown feather quill, dark embroidered sleeve and existing painterly style. Show the entire forearm and a bent elbow leading naturally into the sleeve; no abruptly amputated limb. Quill nib points toward the left at the writing plane. Isolated transparent background, clean alpha edges, no parchment, text, scenery, UI or watermark. The arm will enter from the right of the portrait game frame.

### roadside_rest_v001.png

Saved: `game/assets/ui/narrative/tutorial_v002/roadside_rest_v001.png`. Transparent background: `False`.

Create a finished painted light-novel illustration for the existing dark-fantasy game using both portraits strictly as identity and costume references. Fadyme, an adult woman age 22 with silver hair, violet eyes, a dark embroidered hood and a small bell, sits on the left; Mahmut, an adult man age 28 with brown hair, weathered dark armor and a red scarf/cloak, sits on the right. Both sit naturally on a fallen roadside stone at dusk. Fadyme is smaller and shorter than Mahmut and quietly fastens a loose strap on his gauntlet while he watches her hands with restrained warmth. Gentle unspoken attraction through glances and small gestures, lightly playful but serious, no overt romance. Portrait composition keeps both faces and the shared hand action readable. Cool forest and ruins, warm amber rim light, detailed fabric and metal, consistent established painted quality. No other characters, modern objects, explicit intimacy, spoilers, lettering, UI or watermark.

### shelter_evening_v001.png

Saved: `game/assets/ui/narrative/tutorial_v002/shelter_evening_v001.png`. Transparent background: `False`.

Create a second finished painted light-novel illustration for the existing dark-fantasy game using the same two portraits strictly as identity and costume references. Fadyme, adult age 22, silver hair and violet eyes in her embroidered dark hood and bell, is seated on the left; Mahmut, adult age 28, brown hair, dark armor and red scarf/cloak, is seated beside her on the right, visibly taller and broader. They rest on a stone bench inside a modest abandoned shelter with a broken roof at evening. Fadyme holds a piece of bread and looks through the open side toward the quiet road. Mahmut turns his attention toward her with understated care. Close companionship and hidden attraction, restrained serious expressions, no embrace or overt romance. Both faces, seated bodies and different gaze directions stay clear in a portrait composition. Last amber sunset light against cool violet dusk, textured ancient stone, detailed consistent painted fabrics and armor. No new characters, modern props, canon revelations, lettering, UI or watermark.

## Complete English review script

### T-1 — The First Step

**Before battle — 14 lines**

- **Narration:** The last light lay between the trees. Their footsteps had almost found the same rhythm.
- **Mahmut:** Keep to the stones. The mud gets deeper ahead.
- **Fadyme:** The stones have already claimed one boot.
- **Mahmut:** Both boots are still with us.
- **Fadyme:** You have a comforting way of counting disasters.
- **Mahmut:** That one is loose. Give me your hand.
- **Fadyme:** For the stone, or for the whole road?
- **Mahmut:** The stone first.
- **Narration:** She took his hand. On the other side, neither let go quite as promptly as the crossing required.
- **Fadyme:** There. An excellent rescue. Very little applause, unfortunately.
- **Mahmut:** We can live with that.
- **Narration:** Something scraped across the stones ahead. Mahmut turned before she could make another remark.
- **Mahmut:** Two of them. Stay beside the wall.
- **Fadyme:** Beside it. Not behind you. I know the difference.

**After battle — 14 lines**

- **Narration:** The road grew quiet again. This time they listened to the silence before moving.
- **Mahmut:** Are you hurt?
- **Fadyme:** Only my opinion of this road.
- **Mahmut:** Your sleeve.
- **Fadyme:** A branch. It has dreadful manners.
- **Narration:** He brushed a torn leaf from her shoulder, then found a reason to check his shield.
- **Mahmut:** We can rest here.
- **Fadyme:** In the mud? I was hoping your invitation would improve.
- **Mahmut:** A dry stone, then.
- **Fadyme:** Tempting. A roof would make it irresistible.
- **Mahmut:** There should be shelter farther along. We stop if you need to.
- **Fadyme:** If either of us needs to. That is the arrangement.
- **Mahmut:** Agreed.
- **Narration:** He shortened his stride. She noticed, and chose not to thank him for it aloud.

### T-2 — A Road Forgotten

**Before battle — 13 lines**

- **Narration:** Where the path narrowed, a lone pilgrim dragged one foot around the same worn stones.
- **Mahmut:** It has crossed this patch three times.
- **Fadyme:** Perhaps the road used to end here.
- **Mahmut:** It does not end here now.
- **Fadyme:** No. Someone ought to tell it.
- **Narration:** For a moment she watched the empty movement without speaking. Mahmut did not hurry her.
- **Fadyme:** Do you ever wonder where they meant to go?
- **Mahmut:** Sometimes.
- **Fadyme:** I would rather we reached somewhere ordinary. With an especially ordinary supper.
- **Mahmut:** That can be arranged.
- **Narration:** The pilgrim stopped. Its head turned toward them.
- **Mahmut:** It has seen us. Keep room to move.
- **Fadyme:** And you keep room for me.

**After battle — 18 lines** · Illustration: `roadside_rest`

- **Narration:** Beyond the narrow path, a fallen stone offered a seat. Mahmut checked the trees before he sat.
- **Fadyme:** Sit. The trees have survived your inspection.
- **Mahmut:** This strap needs tightening.
- **Fadyme:** Then hold still. Even your armour is asking for a rest.
- **Narration:** She drew his wrist toward her and threaded the loose leather through its buckle.
- **Mahmut:** I can do that.
- **Fadyme:** I know. You can also let me.
- **Narration:** He watched her fingers instead of the trees. She kept her eyes on the strap a little longer than necessary.
- **Mahmut:** Too tight?
- **Fadyme:** You are supposed to answer that.
- **Mahmut:** No.
- **Fadyme:** A wonderfully detailed report.
- **Mahmut:** The buckle is sound. The work is good.
- **Fadyme:** Careful. Another sentence and I might mistake that for a compliment.
- **Mahmut:** It was one.
- **Narration:** She smiled down at the finished knot. He looked away first, but not quickly.
- **Fadyme:** There. Your turn to be looked after.
- **Mahmut:** We should do that more evenly.

### T-3 — A Roof Before Dawn

**Before battle — 14 lines**

- **Narration:** A broken roof appeared through the branches. There was still enough of it to promise a dry corner.
- **Mahmut:** A roof. We stop there.
- **Fadyme:** You make it sound as though you ordered it specially.
- **Mahmut:** I would have asked for fewer holes.
- **Fadyme:** No view of the stars? A severe oversight.
- **Mahmut:** I can see the stars outside. I would rather keep the rain there too.
- **Narration:** She laughed softly. He was still listening when a shape moved beneath the eaves.
- **Mahmut:** The doorway. Two more by the steps.
- **Fadyme:** The previous tenants seem reluctant to leave.
- **Mahmut:** Wait for my shield. Do not let them separate us.
- **Fadyme:** You were very quick to decide we are a pair.
- **Mahmut:** We have been walking the same road.
- **Fadyme:** Then keep your place. I intend to keep mine.
- **Narration:** This time they stepped forward together.

**After battle — 34 lines** · Illustration: `shelter_evening`

- **Narration:** Inside, the wind softened to a sound in the rafters. For the first time that evening, neither of them had to walk.
- **Mahmut:** Dry enough here. The far corner is better.
- **Fadyme:** You have inspected the entire house in one breath.
- **Mahmut:** It is not a large house.
- **Narration:** He laid his cloak over the cold stone. She sat on one edge and left the other unmistakably free.
- **Fadyme:** This seat appears to be available.
- **Mahmut:** I will check the doorway.
- **Fadyme:** You checked it on the way in.
- **Mahmut:** From the other side.
- **Fadyme:** An important distinction. Sit before you discover a third side.
- **Narration:** He sat. His shield rested within reach; her shoulder rested almost within reach of his.
- **Mahmut:** We have enough bread for tonight.
- **Fadyme:** Actual bread, or another of your possibilities?
- **Mahmut:** Actual bread.
- **Fadyme:** A roof and a supper. You should announce your successes more often.
- **Narration:** She broke the loaf in two, considered the pieces, and put the larger one in his hand.
- **Mahmut:** You gave me more.
- **Fadyme:** A flaw in the architecture of the loaf. Quite beyond my control.
- **Mahmut:** Tomorrow we find a better one.
- **Narration:** She looked toward the doorway. For a moment her answer did not come.
- **Fadyme:** Tomorrow. Yes.
- **Mahmut:** What is it?
- **Fadyme:** Nothing that needs solving tonight.
- **Mahmut:** It does not have to need solving.
- **Narration:** That made her turn back to him. The small joke she had prepared went unused.
- **Fadyme:** Stay a little while. Before you stand watch.
- **Mahmut:** I am here.
- **Fadyme:** I know. That was why I asked.
- **Narration:** He stayed. Outside, the last light left the road; inside, the silence no longer felt empty.
- **Mahmut:** We leave when there is light. No hurry.
- **Fadyme:** And no walking two steps ahead.
- **Mahmut:** Beside you, then.
- **Fadyme:** Then.
- **Narration:** For tonight, a dry corner, half a loaf, and a place beside each other were enough.

