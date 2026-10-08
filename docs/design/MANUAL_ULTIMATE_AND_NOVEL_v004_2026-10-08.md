# Manual Ultimate and light novel presentation — v004

Local Godot 4.7.2 implementation, 8 October 2026. Owner visual review pending.
This supersedes v003's automatic player Ultimate and informational Ultimate tray.
Historical v003 remains a record of its earlier implementation.

## Owner direction

Basic and Active skills act automatically as they become available. The player chooses
when to spend a full Ultimate. Battle Skip and cutscene Skip are absent. Battle stays
at ×1 until Chapter 3 is completed; thereafter the player can choose ×1 or ×2.
English is the presentation language; final voices will be Japanese.
Damage, individual cooldown balance, Focus tuning, music and final voice/SFX production
remain later stages. No new story canon was authored in this pass.

## Live combat and input

game/scripts/core/battle/live_battle.gd prepares a seeded input-driven encounter
around the existing EncounterState, ActionGauge, interpreter, reactions, passives,
waves and boss phase hooks. live_battle_playback.gd translates emitted events and
HUD sidecars onto the shared screen clock. The former automatic engine is retained
for archived replays, tools and existing parity fixtures.

Every playable character's bottom tile has a real 144-unit Ultimate button,
character-colored Focus ring and pulsing readiness halo. Fadyme uses a bell/Veil
mark and lavender; Mahmut uses a shield/Stone mark and old gold. Basic and Active
cells display cooldowns. A full Focus bar waits indefinitely for a deliberate click.
One cut-in owns input at a time; duplicate/unfunded/dead/controlled casts are refused.
Eligibility is checked again at impact, because combat continues in the background.

The Focus maximum and Ultimate cost are 100. This pass keeps authored gains:
Basic 20, Active 25, taking a hit 5 with the existing per-owner-turn cap 15.
The owner's 5/10/20 examples remain balancing suggestions. There is currently
no separate ordinary-strike action type: Basic is the regular attack.
Per-skill cooldown values remain authored data, ready for the balance stage.

Default opposing manual-single targets use nearest formation distance with stable
slot/id tie-breaks. Living target selection uses the established Front/Rear geometry.
Explicit authored row, lowest-health, group and support selectors remain interpreter
contracts. Heals, guards, cleanses and other authored skill effects were preserved.
This default does not add a universal back-row, tank or low-HP priority.

## Ultimate presentation

ultimate_presentation.gd uses a real-time 1.8-second illustrated cut-in.
During it, only battle time and actor motion run at 0.1; Engine.time_scale remains 1.
UI input and the portrait presentation remain responsive. The selected ×1 or ×2
is retained, restored at animation end, and then the real Ultimate resolves.
Fadyme has moving Veil rings and bell artwork; Mahmut has an angular shield barrier.
Their chibi cast/effect cues follow the actual resolution.

battle_actor.gd implements all eight supplied key-pose states: idle, walk, Basic,
Active, Ultimate, hit, defeat and victory. Motion now differentiates Mahmut's
melee anticipation/guard from Fadyme's restrained ranged motion, with separate
hit feedback so simultaneous attacks do not cancel each other's casts.
Defeat, rotation/scale recovery and ongoing tween speed changes are handled.
These are key-pose plus procedural Godot animations. They are not a newly drawn
frame-by-frame or skeletal animation package.

## Authoritative server verification

The production StoryDirector prepares the server's frozen attempt, shows live
combat and reports its finished result after the player's Continue. It no longer
saves a computed victory before presenting the fight. An offline report retains
the completed result and input transcript for retry.

The protocol adds combat_mode: manual_ultimate_v1 and manual_commands.
Each command contains only after_actions and actor_id; its boundary is the
number of resolved automatic readiness actions at the actual Ultimate impact.
The client sends no target damage/effects or unrestricted skill command.
The server reconstructs the same seeded frozen encounter, enforces eligibility
and re-simulates these inputs before rewards or story writes. Claims such as stars
remain diagnostic. Inputs are bounded, ordered and structurally validated.
Within a readiness interval the transcript identifies a deterministic action
boundary, not an independently saved continuous wall-clock timestamp.

Matching server code is changed locally; it has not been deployed or pushed.

## Light novel reader

The portrait gets the expanding central stage; the scene background opacity is 0.45.
The subtitle panel is directly beneath it with an ink fill alpha 0.70 and native
wrapping. Back, Auto, Log and Next remain in one bottom row with consistent bronze
styling and 144-unit touch targets. There is no Skip button or Skip method.

Text reveals at 34 characters/second without voice. First Next reveals the current
line; the following Next advances, stopping the previous voice if necessary.
Auto waits for text completion, any Japanese performance and a reading hold.
Log pauses reveal and Auto. Back revisits lines and retains normal voice lifecycle.
Text and voice wait until the page reveal has finished, so a short first line is
not consumed behind the transition.

With an actual recording the reveal follows the audio playback clock and duration.
Optional subtitle_cues: [{time, characters}] supports authored timing for final takes.
No Japanese recordings or final timing cues were fabricated; word/phoneme editing
must be done against the new final voice recordings in the audio stage.

## Character artwork and provenance

Existing Fadyme identity references and five narrative expressions were preserved.
New selected workspace PNGs are isolated RGBA assets at 1024 × 1536:

- Fadyme ultimate_cutin_v001.png: mature light novel proportions, existing hood,
  silver hair, bells and Veil motifs, based on her composed portrait and chibi Ultimate.
- Mahmut vn_watchful_v001.png: existing chibi design translated into the documented
  28-year-old weathered knight; messy brown hair, stubble, worn steel, oxblood cloak,
  sword and heater shield. Crown Guard star remains with the crown removed.
- Mahmut vn_dry_humor_v001.png and vn_protective_resolve_v001.png: expression-only
  edits of that same portrait, following his three documented expression briefs.
- Mahmut ultimate_cutin_v001.png: Last Wall at Dusk defensive cut-in with the same
  design, shield and restrained amber Stone barrier accents.

Built-in Imagegen was used with inspected project references and transparent output.
Original generated files remain under the Codex generated_images directory.
Selected copies live under game/assets/characters/fadyme and mahmut; the presentation
manifest selects them and maps authored emotion names to the correct expressions.
No Production source files were modified. New PNG source size totals 16,008,460 bytes.
Presentation assets are local resources; review scripts/tests remain export-excluded.

## Validation and review boundary

The UI suite passed 179 tests. Strict load validation passed 199 assertions.
Legacy Godot battle parity passed 29 tests including the established 525 fixtures.
The server battle/API suite passed 50 tests, including the same legacy fixtures,
18 complete manual encounters and an isolated PostgreSQL reward/attempt test.
Manual Godot replay of the 18 transcripts also passed, comparing complete events,
final units, outcomes, stars and action/cycle counts. TypeScript checking passed.

Native Godot review proves player input opens both cut-ins, 0.1 applies during them,
and the chosen ×2 restores afterwards. All three tutorial fights completed naturally
at locked ×1 with zero final HUD drift; each pre/post cutscene was visited, and the
opening retained its pending background patch at completion. Test proof is under
build/cooldown-ui-20261008, including native-manual-opening-report.json.

The editor was kept open. One inspection call dereferenced a not-yet-available imported
portrait and caused a non-continuable debugger break; only the runtime was recovered.
The replacement live run imports all selected artwork and is left open for review.

Owner review still covers the visual direction, key-pose motion quality and tutorial
draft wording. Final audio, balance, a finalized minimal bootstrap/patch split,
signed Android AAB and device acceptance are not claimed complete by this document.
