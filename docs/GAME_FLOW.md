# Game flow — first install to "the game proper"

Status: **entry foundations built; complete flow acceptance remains open (R09/R18).** Source reconciled 2026-10-12 at `0499a6cb109cee3f7de4c9ad951e4e22e25d3983`; [DEV_TRACKER](DEV_TRACKER.json) records evidence. The earlier F7 report/screenshots are historical. The 2026-10-12 audit found invisible prologue text, Continue/save/resume gaps and an entry/API harness timeout. No current full-flow or device PASS is asserted. The screen sequence below is the intended behavior, not a checklist of passed tests. Sources: the owner's brief of 2026-10-11, `narrative/02_Main_Story/Opening_Tutorial/OPENING_TUTORIAL_REVISION_v006_2026-10-08.md`
(the approved script and timing rules), `narrative/09_VN_Scripts/Runtime_Snapshot/game/data/entry/{prologue,tutorial}_v001.json`.
Initial embedded content covers the opening through the first restart. **All required executable full-menu, gameplay and interpreter foundations ship in the first AAB.** Later chapters/events/roster media and supported configuration can arrive through signed data patches; missing code cannot.

## 1. Rules fixed by the owner

- Tutorial battle is **turn based, the player chooses** the skill and target. **No speed or battle Auto button in T-1/T-2/T-3.** General battle Auto/speed capabilities must already be compiled into the first binary; supported configuration may expose them later.
- The tutorial has only **Mahmut and Fadyme** (no owned-hero composition, no loans, no Ration, no drops, no clears — presentation checkpoints only).
- The patch downloads **in the background from the moment the player signs in**; it never blocks the story, and a progress bar stays visible at the bottom of every screen until it is done.
- Full-menu, summon, roster, shop and mode runtime code ships in the app; patches supply validated content/unlock data within its capabilities.
- Follow the script word for word (`prologue_v001.json`, `tutorial_v001.json`; changes only through the narrative sources, never silently).

## 2. First install — screen by screen

| # | Screen | What the player sees | Behind the scenes | Leaves when |
|---|---|---|---|---|
| 1 | **Engine splash** | The Unity engine credit (or custom engine splash card) on black with a synth chime, fade in/out (~2.5 s). *(Handed-over legacy `apps/game` reference drew a web engine credit under historical D-25; superseded by D-31 Unity 6 LTS migration.)* | Fonts, textures, base content load behind it. | Timer, and loading finished. |
| 2 | **Studio card** | *"SovTaym Studios Presents"* — one calm card, ink-on-black with the studio mark, slow fade (~4 s). Tap does not skip. | Preload of the menu art. | Timer. |
| 3 | **Main menu (first run)** | Key art + logo, **Sign in with Google**, Settings/privacy, version. Preference coverage remains R10/R11. | Android Credential Manager; genuine configured Google identity for normal web staging. Preview identities are isolated automation only. UMP where applicable. | Signed in. |
| 4 | **Patch gate** (a few seconds) | "Preparing the road" + progress bar. | Account is created/loaded; **the patch download starts** (manifest → signature → files → verify) in the background manager; the entry checkpoint is read (`not_started`). | Immediately continues; it does not wait for the download. |
| 5 | **Interlude: "Before the Road"** | Target ~120 s, nine scenes, visible English text/captions → **Continue**. Actual timing and text visibility require R09. | Download continues; voice production remains deferred; music cue per scene (`audio_cue`). | Last scene + Continue. |
| 6 | **T-1 The First Step** | Cutscene (14 lines) → battle → cutscene (14 lines). | Battle is local; no server claim, no rewards. | After the "after" scene. |
| 7 | **T-2 A Road Forgotten** | Cutscene (13) → battle (Hollow Pilgrim) → cutscene (18, with the *roadside rest* illustration). | same | same |
| 8 | **T-3 A Roof Before Dawn** | Cutscene (14) → battle (2 Bellbound Dead + 1 Hollow Pilgrim) → extended cutscene (34, with the *shelter* illustration). | same | same |
| 9 | **Patch page** | If the download is still running: the last tableau dissolves into the download page (progress, size, retry). If it finished: straight to the confirmation. | Download continues independently of narrative pacing. | Download verified. |
| 10 | **Confirmation** | Verified patch ready; **Restart & Enter Game**, with clear local/pending/confirmed save state. | Required: durable account checkpoint/retry and exactly one restart. Current short cloud-save wait is an R09 gap. | Safe saved/recoverable state and restart. |
| 11 | **Restart** | The app closes and starts again (Android: native process relaunch; browser build: page reload). A failed restart shows **Retry** without downloading again. | New content is active at boot. | — |
| 12 | **Main menu (full)** | Compiled hub with activated content: Chapters (1-1 still unstarted), Company, Summon ... | Normal boot: Splash → Studio card → Menu; restored valid session. R09 must route Continue to campaign, not T-1. | — |

Required returning flow (checkpoint `completed`): 1 → 2 → 12. Entry checkpoints remember prologue/T-n completion, but full account/content-scoped mid-scene/choice/post-battle resume remains R09. Do not equate the story VM save format with integrated lifecycle recovery.
Offline first install: screen 3 explains that the first start needs a connection (the patch cannot download); nothing is lost, the button retries.

## 3. The patch bar

A small parallel scene (`PatchBar`) sits above all other scenes at the bottom edge from screen 4 until the patch is verified: *"Downloading the road · 48 % · 12.4 / 26 MB"* (thin bar, no interaction). States: downloading, verifying, **ready** (hidden), **failed** (tap to retry; the story keeps going). It is driven by progress events from the patch manager (new: file/byte counters and phases).

## 4. Cutscene rules (v006, binding)

- Auto is **on at the start** of every cutscene; the button is a single normal-speed **on/off** toggle. There are no ×1/×2/×3 modes and **no Skip**.
- Text reveals at **26 characters per second** (no recording yet). A short line stays at least **5.5 s**; after the reveal (or the voice) Auto waits at least **3.2 s**; narration 4 s; the final scene holds its closing line 5 s.
- Speaker change: 1 s pause + 0.8 s portrait dissolve; same speaker consecutive lines: 0.65 s. Shared illustrations stay on screen across speaker changes. Manual **Next** first completes the current text, the next press advances.
- Final reviewed Japanese voice production is pending. Voice-bus timing, decoder/subtitle/cue hooks and device lifecycle must be completed under R08/R16 before treating voice files as a drop-in content change.

## 5. Tutorial battle rules

- Two heroes (Mahmut front, Fadyme rear), enemies from the encounter file; the player picks the skill and the target every turn (the existing manual flow).
- Hidden in the tutorial: **speed button, Auto button**. Kept: pause/menu (retreat → back to the cutscene before the fight), turn-order bar, skill panel, Focus/Ultimate.
- A lost battle offers **Retry** (nothing is lost, no cost). Victory continues the story.
- Encounter files get a `ui` block (`speed`, `auto`) so a later patch can switch the buttons on without a new build.

## 6. Content split

| Ships inside the app (base release) | Arrives by patch |
|---|---|
| Boot/splash/studio/full-menu scenes, identity/billing/ads/privacy, patch manager, prologue/story/battle/mode interpreters and required UI/runtime code | Supported chapters, characters, events, roster/summon/shop configuration, balance and unlock flags |
| Prologue JSON, T-1..T-3 story + encounters, Mahmut/Fadyme/Bellbound Dead/Hollow Pilgrim units and art, opening music cues | Voice, further art, all other units |

`tools/build_content.ts` already builds prologue JSON, all T-1/T-2/T-3 encounters and all six dialogue scenes into the base. The initial content is small; promised runtime capabilities are not postponed to downloadable executable patches.

## 7. Foundation status and acceptance

| Step | Source status | Remaining evidence / package |
| --- | --- | --- |
| F1 splash/studio/menu | BUILT in legacy reference (`SplashScene`, `StudioScene`, `TitleScene`); porting to Unity (`Uomd.Game`) under D-31 | Approved studio presentation, settings/privacy reachability and R18 device evidence. |
| F2 entry/checkpoints | BUILT: entry/state.ts, entry/sync.ts and GET/PUT /api/v1/entry | R05/R09 durable save, scene/line/choice resume and correct campaign Continue. |
| F3 staged patch/PatchBar | BUILT: PatchManager, PatchService, PatchBarScene | R03 generation and R08 storage/fault acceptance; R09 complete entry integration. |
| F4 prologue | BUILT: PrologueScene and provisional plates | R09 outgoing-tween/text visibility and measured full timeline; R15 approved art, R16 VO. Authored holds total 120 s; 112.8 s is a code-derived estimate, not a measured run. |
| F5 tutorials/cutscenes | BUILT: all three tutorials, six scenes, entry/cutscene.ts and manual battle flags | Preserve 107 canonical entry lines and normal-speed reading Auto/no Skip. Full flow/device and reviewed media remain open. |
| F6 Finish/restart | BUILT: FinishScene, restartGame and Java UomdApp.restart | R09 pending/confirmed save and relaunch-failure recovery; native bridge presence does not prove device success. |
| F7 whole-chain tests | Test source exists: tests/e2e/zzz-entry-flow.spec.ts | Earlier reported PASS is historical; latest audit harness timed out. R09/R18 need new exact-revision browser/device evidence. |
| F8 first store AAB | Shell/build/plugin sources exist; not store accepted | R11–R18 gates, explicit signing/environment/versionCode and physical Play sandbox; not just an art pass/version bump. |

Downloaded content is staged during entry and activated at restart so tutorials do not change under the player. Development-only preview identity and `?fastintro` timing shortcuts do not count as real Google login or authored-duration acceptance. Preserve engine credits/licences.

## 8. Remaining decisions and proofs

Studio mark and character/layout approval remain owner decisions. Android Google-only login, English UI, Japanese target voice, pre-login settings/privacy, background download and all three manual tutorials are already decided in README. R10/R11 must implement missing preference/privacy behavior; R09/R18 must prove checkpoint, offline, Finish/restart and campaign continuation. Do not reopen settled choices or mark placeholder assets as approved.
