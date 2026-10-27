# Native manual tutorial battles — 2026-10-27

The three embedded tutorial encounters now use native UI Toolkit `Rebuild/Battle.uxml` and `Battle.uss`, the three original
Sol stage paintings and the four original Sol unit atlases. This is the normal `BattleScreenController` route, with an
isolated `battle/tutorial_t1`, `battle/tutorial_t2` and `battle/tutorial_t3` route in Production Review. Campaign battles and
other units retain their existing presentation until their own rebuild.

The player chooses an available skill, chooses a legal target when required, then presses a separate Confirm button.
Selection alone does not submit an action. The dock exposes the real skill description, passive, cooldown and Focus
requirements; unit plates show numeric HP/Focus, the next turns and enemy intent. Tutorial Auto and speed controls are
absent. Engine events drive poses, strikes, damage/healing, Focus and defeats through the existing presenter. Combat
rules, encounter seeds, canonical IDs and the `PlayerAction`/replay contract are unchanged.

Pause stops unit animation/movement, event progression, input submission and audio. Native movement advances from the
presenter's own tick, so it cannot continue through a CSS movement transition while paused. Reduced Motion holds looping
idle poses and retains the event sequence. Short cosmetic UI/VFX transitions are not claimed as a complete mid-action
freeze. The selected skill and target survive a pause. Missing rebuilt art stops before combat begins and offers Retry;
the tutorial never silently substitutes historical artwork or advances progress after that failure.

Production Review results restart the local encounter only. Normal results continue through `UomdEntryFlow`; only its
post-story completion records the tutorial stage. Leaving a pending decision cancels the owned await and destroys the
owned sprites. The review uses embedded content, memory-only patch state and API isolation, restoring the original scene,
viewport and typed preferences on close. Captures bind the actual background and related unit source identities, action
count and combat-log hash. They are Editor evidence, not physical touch/device acceptance or human art approval.

The retained atlas limitations still apply: sixteen source poses per unit, eight short sequences, no rig and no claim of
sixteen unique frames per state. Fadyme's source is an exact no-resize assembly of two native OpenAI pages. See
[atlas provenance](SOL_BATTLE_ATLASES.md) and [tutorial stage provenance](SOL_TUTORIAL_NARRATIVE.md). This slice generates
no new media, changes no budget and grants no visual approval.

Executed checks and source/capture hashes are recorded in
[the scoped evidence](../evidence/sol-manual-battles-2026-10-27.json). Full signed-in entry, durable Finish/Continue/restart,
account isolation, native lifecycle and Android/provider acceptance remain subsequent work.
