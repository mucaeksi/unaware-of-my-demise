# Game flow — first install to "the game proper"

Status: **design for owner review (2026-10-11)**. Sources: the owner's brief of 2026-10-11, `narrative/02_Main_Story/Opening_Tutorial/OPENING_TUTORIAL_REVISION_v006_2026-10-08.md`
(the approved script and timing rules), `narrative/09_VN_Scripts/Runtime_Snapshot/game/data/entry/{prologue,tutorial}_v001.json`.
Scope of the app build: **everything up to the first restart**. Whatever comes after (chapters 1-1 ..., events, gacha content) arrives only through patches.

## 1. Rules fixed by the owner

- Battle is **turn based, the player chooses** the skill and the target. **No speed button; Auto is not available** in the first release (it is switched on by a later patch).
- The tutorial has only **Mahmut and Fadyme** (no owned-hero composition, no loans, no Ration, no drops, no clears — presentation checkpoints only).
- The patch downloads **in the background from the moment the player signs in**; it never blocks the story, and a progress bar stays visible at the bottom of every screen until it is done.
- Nothing after the tutorial is shipped in the app: the menu, chapters, summon, roster, shop ... all come from the patch.
- Follow the script word for word (`prologue_v001.json`, `tutorial_v001.json`; changes only through the narrative sources, never silently).

## 2. First install — screen by screen

| # | Screen | What the player sees | Behind the scenes | Leaves when |
|---|---|---|---|---|
| 1 | **Engine splash** | "Made with Phaser" on black, fade in/out (~2.5 s). Wordmark only until the official logo file is supplied. | Fonts, textures, base content load behind it. | Timer, and loading finished. |
| 2 | **Studio card** | *"SovTaym Studios Presents"* — one calm card, ink-on-black with the studio mark, slow fade (~4 s). Tap does not skip. | Preload of the menu art. | Timer. |
| 3 | **Main menu (first run)** | Key art + logo, **Sign in with Google**, Settings (language / text / audio / reduced motion), version. Nothing else is offered yet. | Identity provider ready (Android Credential Manager; browser build: preview identity). Consent form (UMP) where the region needs it. | Signed in. |
| 4 | **Patch gate** (a few seconds) | "Preparing the road" + progress bar. | Account is created/loaded; **the patch download starts** (manifest → signature → files → verify) in the background manager; the entry checkpoint is read (`not_started`). | Immediately continues; it does not wait for the download. |
| 5 | **Interlude: "Before the Road"** | The ~120 s motion-comic opening (9 scenes, 120 s total, English text, caption titles), then fade to black → **Continue**. | Download keeps running; bottom bar shows progress. Voice is deferred ("unrecorded"); music cue per scene (`audio_cue`). | Last scene + Continue. |
| 6 | **T-1 The First Step** | Cutscene (14 lines) → battle → cutscene (14 lines). | Battle is local; no server claim, no rewards. | After the "after" scene. |
| 7 | **T-2 A Road Forgotten** | Cutscene (13) → battle (Hollow Pilgrim) → cutscene (18, with the *roadside rest* illustration). | same | same |
| 8 | **T-3 A Roof Before Dawn** | Cutscene (14) → battle (2 Bellbound Dead + 1 Hollow Pilgrim) → extended cutscene (34, with the *shelter* illustration). | same | same |
| 9 | **Patch page** | If the download is still running: the last tableau dissolves into the download page (progress, size, retry). If it finished: straight to the confirmation. | Download continues independently of narrative pacing. | Download verified. |
| 10 | **Confirmation** | "Everything is installed." **Restart & Enter Game**. Pressing once or many times requests exactly one restart. | Entry checkpoint `completed` is written to the account (cloud save). | Restart. |
| 11 | **Restart** | The app closes and starts again (Android: native process relaunch; browser build: page reload). A failed restart shows **Retry** without downloading again. | New content is active at boot. | — |
| 12 | **Main menu (full)** | The hub menu supplied by the patch: Chapters (1-1 still unstarted), Company, Summon ... | Normal boot: Splash → Studio card → Menu (no sign-in prompt, session restored). | — |

Returning player (checkpoint `completed`): 1 → 2 → 12. A player who quit mid-way (checkpoint `in_progress`) resumes at the first unfinished step (prologue seen / T-n done are remembered per account, and per device when offline).
Offline first install: screen 3 explains that the first start needs a connection (the patch cannot download); nothing is lost, the button retries.

## 3. The patch bar

A small parallel scene (`PatchBar`) sits above all other scenes at the bottom edge from screen 4 until the patch is verified: *"Downloading the road · 48 % · 12.4 / 26 MB"* (thin bar, no interaction). States: downloading, verifying, **ready** (hidden), **failed** (tap to retry; the story keeps going). It is driven by progress events from the patch manager (new: file/byte counters and phases).

## 4. Cutscene rules (v006, binding)

- Auto is **on at the start** of every cutscene; the button is a single normal-speed **on/off** toggle. There are no ×1/×2/×3 modes and **no Skip**.
- Text reveals at **26 characters per second** (no recording yet). A short line stays at least **5.5 s**; after the reveal (or the voice) Auto waits at least **3.2 s**; narration 4 s; the final scene holds its closing line 5 s.
- Speaker change: 1 s pause + 0.8 s portrait dissolve; same speaker consecutive lines: 0.65 s. Shared illustrations stay on screen across speaker changes. Manual **Next** first completes the current text, the next press advances.
- Voice (Japanese) is not recorded; the Voice-bus clock and subtitle hooks stay so recordings can be dropped in later.

## 5. Tutorial battle rules

- Two heroes (Mahmut front, Fadyme rear), enemies from the encounter file; the player picks the skill and the target every turn (the existing manual flow).
- Hidden in the tutorial: **speed button, Auto button**. Kept: pause/menu (retreat → back to the cutscene before the fight), turn-order bar, skill panel, Focus/Ultimate.
- A lost battle offers **Retry** (nothing is lost, no cost). Victory continues the story.
- Encounter files get a `ui` block (`speed`, `auto`) so a later patch can switch the buttons on without a new build.

## 6. Content split

| Ships inside the app (base release) | Arrives by patch |
|---|---|
| Boot/splash/studio/menu scenes, sign-in, patch manager, prologue player, story + battle engines | Everything the full menu needs: chapters (Part I campaign), roster/summon/shop data, balance, Auto battle switch |
| Prologue JSON, T-1..T-3 story + encounters, Mahmut/Fadyme/Bellbound Dead/Hollow Pilgrim units and art, opening music cues | Voice, further art, all other units |

The base is built from the narrative sources by `tools/build_content.ts` (currently T-1 only; T-2 is a patch, T-3 does not exist yet — both move into the base).

## 7. Build order (each step: code + tests + screenshots for your review)

1. **F1** Splash → studio card → first-run menu skeleton (real fonts, fades, strings from one file).
2. **F2** Entry state machine + checkpoint + Google sign-in step.
3. **F3** Background patch manager with progress events + the bottom bar.
4. **F4** Prologue player (9 scenes, placeholder painted gradients per `visual`: village / crownfall / road; the art arrives in the art phase).
5. **F5** Cutscene rules, T-3 content, tutorial battle flags.
6. **F6** Patch page, confirmation, restart (web reload now; Android native relaunch is a plugin change → part of the next AAB), returning-player routing.
7. **F7** End-to-end test of the whole chain with a fake slow patch + review screenshots; then **F8** a new AAB.

## 8. Open points (defaults in brackets; tell me where you disagree)

1. Exact studio name/spelling on the card: **"SovTaym Studios"** [as written], and do you have a logo/mark file? [text-only mark until supplied]
2. "Made with Phaser": official logo file needed? [wordmark only until you supply one]
3. Is **Google sign-in mandatory** on Android before the prologue? [yes; browser preview build uses a preview identity]
4. First-run menu shows **only** Sign in / Settings (no Chapters/Company) [yes]
5. Interlude plays **immediately** after sign-in, the patch runs underneath [yes]
6. Settings available before sign-in: text size/speed, music/SFX volume, reduced motion, language [English only now]
