# Cooldown combat and opening — v003

Date: 2026-10-08. Status: implemented locally; owner visual/story review pending. Engine: Godot 4.7.2.

This record supersedes the fixed-event playback timing and shared nameplate treatment in `BATTLE_UI_AND_AAB_VISUAL_v002_2026-10-08.md`. Its no-Skip policy, Chapter 3 speed gate, chibi sizing, formation geometry and deferred final audio remain current. Existing project work and creative references are preserved.

## Owner direction

- Combat should feel slower, with all companions and enemies fighting concurrently on independent cooldowns rather than taking visible turns.
- Numbers, powers and combat balance can be revised later. This pass changes presentation timing without changing damage, skill selection, rewards or deterministic outcomes.
- A skill panel belongs beneath each playable companion. Health/name/level styling should express character identity.
- New accounts see the prologue fade to black, Continue, a cutscene before the first tutorial, and three tutorial encounters while the main content patch proceeds. Returning accounts patch on entry and continue their saved game.
- English is the game text language. Japanese voice and the new voice model, music and final audio production are deferred.

## Independent combat clock

The existing ActionGauge engine already advances every living unit's gauge by the same exact time delta before selecting an actor. Actor readiness remains speed-driven. The previous renderer made this look sequential by showing each event at a fixed interval, including every damage/heal/log entry as a separate wait.

`BattleState.elapsed_gauge_time` now accumulates the existing gauge deltas as `Frac`. `record_event` captures a parallel `replay_frames` array with the shared timestamp and each unit's Focus, cooldown ticks and effective speed. GDScript and the TypeScript server mirror this metadata. Canonical battle-event dictionaries retain their original keys; no timing fields are injected into the canonical event log or parity fixtures.

`BattlePlayback.advance(seconds)` consumes all events whose shared timestamp is due, in the engine's original resolution order. Actors ready at the same time receive animation cues together. The engine still resolves effects deterministically; simultaneous presentation does not introduce random race conditions or alter target selection. A missing legacy timestamp array groups each action with its associated effects and spaces actions conservatively, retaining compatibility with existing replay/tool records.

The current presentation baseline is **3.4 seconds at x1 for a speed-5 unit to fill one gauge**, with a 0.8-second opening lead. Actual readiness uses effective speed and the rules' gauge maximum. These are presentation constants rather than committed balance values. Altering health/ATK/DEF/growth, skill multipliers, Focus costs and cooldown ticks remains a content/rules change; the current values remain draft balance.

`BattleScreen` samples elapsed monotonic wall time every 0.05 seconds and advances one shared playback clock. Sampling frequency does not add a wait per event. x2 multiplies that clock; it does not skip actions or change battle results. Each battle starts x1. The existing saved completion of all authored Chapter 3 stages, including 3-5, unlocks x2 for subsequent battles. No x4 or combat Skip exists.

Basic/Active/Ultimate motions last approximately 1.0/1.15/1.5 seconds at x1. Hit feedback uses a separate reaction tween so receiving a simultaneous hit does not cancel a cast. A 1.6-second completion settle permits final casts to finish before Victory/Defeat and Continue. The log is reduced to two lines; elapsed MM:SS replaces the visible round counter. The same stable footer hosts speed during battle and Continue after the result.

## Fadyme skills and animation status

The current character definition contains exactly **one Active skill** and four skills in total:

| Type | Authored English name | Current behavior |
| --- | --- | --- |
| Basic | Veilglass Thorn | Single-target Veil damage; extra Focus against a Dreaded target |
| Active | Borrowed Hour | Veil damage and Dread; heals the lowest-HP ally; two owner-action cooldown ticks |
| Passive | A Smile Kept | Conditional team Veil resistance when below half health; bounded triggers |
| Ultimate | The Bell That Forgets | Group Veil damage/Dread, ally cleanse and conditional healing; 100 Focus |

The animation package is **not final**. Existing selected artwork provides eight key-pose states: idle, walk, basic, active, ultimate, hit, defeat and victory. The Godot actor supplies procedural breathing, movement, casting, impact and defeat/victory motion around those poses. This is a playable visual baseline, not a completed frame-by-frame or skeletal animation production pass. No new bitmap poses, rigging, voice or music were produced in this revision.

## Companion skills and identity HUD

The bottom tray distributes two broad companion tiles during the tutorial and five compact tiles in a full-party layout. Each tile shows a miniature chibi, name, Focus rail and B/A/U readouts. Passive descriptions are included in the character tooltip rather than represented as a cast button. The current combat is automatic; the tray is informational.

The Basic readout represents the next recorded owner action's readiness, which may be an Active/Ultimate depending on engine priority. Active readouts use captured remaining cooldown ticks converted through effective speed; unchanged ticks do not continually extend the timer. Ultimate shows current Focus or READY when its cost is reached. Dead companions are dimmed, and finished encounters stop showing actionable readiness. Capacity samples use explicitly labelled local Focus/timing fixtures; production tutorial fights use the real engine snapshots.

`BattleHudStyle` supplies accent colours and native StyleBoxes without adding UI textures. Fadyme's Veil identity uses muted lavender with rounded framing and a small arc detail; Mahmut's Stone identity uses old gold with firmer corners. Enemies use wine/ruby or a subdued Hollow accent. The separate level badge shares its unit's accent. Names use bone text and ellipsis when necessary; full enemy names can exceed the compact arena nameplate. Jade allied and ruby enemy health rails, metallic caps and separate status information remain.

The arena still places allies on the left facing right and enemies on the right facing left. Normal chibis retain the prior 176-pixel nominal height, two-companion scenes 210, and the boss capacity fixture 330 with width constraints. Full-party sample appearances are repeated only to check geometry; this does not add playable characters or a tutorial boss.

## Three-stage local opening

`game/data/entry/tutorial_v001.json` contains the existing English scenario from `TUTORIAL_SIDE_BY_SIDE_v001_2026-10-08.md`, copied into runtime data. Its status is `runtime_candidate_owner_review`: this does not approve the draft as story canon or change the canon ledger. No additional story history, speaker lines or new character identity is inferred.

| Opening stage | Title | Opponents |
| --- | --- | --- |
| T-1 | The First Step | Two Bellbound Dead |
| T-2 | A Road Forgotten | One Hollow Pilgrim |
| T-3 | A Roof Before Dawn | Two Bellbound Dead and one Hollow Pilgrim |

Only Mahmut and Fadyme are playable. `TutorialBattle` creates an isolated local registry view and a fixed two-hero training roster, then uses the existing BattleService and interpreter. Current local baseline is hero level 5, enemy level 1, with fixed review seeds. All three fights resolve as victory with the current rules; victory is not forced. Main registry stages are not modified. The encounters cost no Ration, grant no drops and do not clear main-story stages or submit server battle results.

Each stage runs before-cutscene → actual battle → Continue → after-cutscene. A defeat retries the encounter. All tutorial readers disable audio; English script, existing Fadyme/Mahmut portraits and the current forest plate are reused. Road/temple-specific final backgrounds remain artwork work. After T-3 the existing main-story opening and its 1-1 chain resume; the tutorial does not mark 1-1 cleared or replace the original story order.

The Local UI Preview's Entry tab exposes this whole chain with a **simulated** 180-second content download. It issues no account request, patch download, reward grant or player-state mutation. Its Arena/5v5/Boss/Chapter 3 controls remain local sample controls. Real entry integration uses Game's existing verified installer and server bootstrap.

## New and returning account patch routing

`Online.is_new_account` retains the server authentication fact. `OnboardingPreferences` registers a tutorial marker only when that fact is true. A returning account on a new device does not become a new player merely because its local install has no preferences. Existing tutorial markers are retained on subsequent authentication rather than reset.

The viewing checkpoint is keyed by a hash of the account ID in `user://onboarding.cfg`. It contains eligibility, stage index, before/battle/after phase, intro completion and tutorial completion. Interrupted fights resume from their pre-battle scene and restart that reward-free encounter. An after-scene resumes that scene. This checkpoint is **local to the device**, not server-synchronized; cross-device tutorial completion/resume is not implemented. Server game progress and economy are still authoritative and separate.

During a verified content update, StoryDirector starts the eligible prologue/tutorial path before awaiting the patch. Prologue finishes black and waits for Continue; Continue opens the first cutscene. Download progress appears quietly beneath the current tutorial screen. Early patch completion waits for all tutorial chapters. Slow completion leaves a waiting screen after T-3. A download failure preserves viewing progress and allows the local tutorial to finish before showing the entry retry/error. A retry does not repeat completed tutorial content on the same device.

Returning accounts proceed from authenticated entry directly into bootstrap/content checks and automatically download a required verified patch. They receive no onboarding prologue/tutorial or second download approval popup. Manifest signature, app compatibility, replay floor, byte sizing and space checks remain in the existing preflight. When no update is needed, server state determines the resumed attempt, main story or hub.

The existing content installer requires a fresh client process after installing a verified pack. This requirement remains: a completed patch is never followed by adopting an old-process player snapshot. New players reach that restart only after their local tutorial has finished. The existing one-use restart hint retains entry continuity. Android restart/lifecycle and real background HTTP behaviour still require device acceptance.

## Resource packaging and remaining work

The existing Android and Android AAB presets already include `data/entry/*.json`; no broad export policy was changed here. A resource-only export using the Android AAB preset contains the tutorial JSON, all four new onboarding/skill-tray scripts and their compiled targets. Development art-review code/scenes, GUT, Godot AI and tests are excluded.

This check exported **510 entries / 63,075,010 bytes** with the current project-wide resource scope. It is not a signed AAB, native-library/ABI measurement, store upload or Android installation. The final minimal three-tutorial bootstrap versus patch-only main-content packaging remains open. Full Fadyme animation production, final tutorial-specific backgrounds, final Japanese voice/music and device/store acceptance are also unfinished. These limitations are distinct from the locally working entry and battle UI.

## Validation and evidence

Evidence directory: `build/cooldown-ui-20261008/` (local ignored review output).

- Full Godot UI suite: **174/174 tests**, 105,389 assertions, 18 suites; no failing test or script error. Existing unrelated GUT orphan warnings remain in broad UI output.
- Strict Godot script-loading check: **1/1**, 193 assertions, with project typing settings preserved.
- Server TypeScript check passed. Focused battle/service/simulation suite: **20/20**, including all 525 canonical recorded battles and every authored stage. Canonical events/outcomes remain unchanged.
- Added contracts exercise equal gauge timestamps, all ten sample actor starts within the same short window, x1/x2 final HP/Focus equivalence, three real-engine tutorial victories, account eligibility/isolation/resume, one Fadyme Active, bottom skill tiles, non-cancelling hit feedback and visible cutscene completion.
- Entry tests cover early/late/failed patch, mandatory fresh-process installation, first-player Continue/cutscene/three-stage ordering, no-patch new accounts, authentication-driven returning checks and automatic returning patch installation.
- Native Godot screenshots verify the actual tutorial battles, English light-novel portrait/background, ten-actor/five-tile formation and responsive nameplate/footer geometry. The existing Editor stays open and Local UI Preview is reused; control-script parse/debugger errors required runtime recovery during evidence collection and are not counted as successful validations.

The owner should review the slower pacing, visual bars and the imported scenario before final assets and balance are locked.
