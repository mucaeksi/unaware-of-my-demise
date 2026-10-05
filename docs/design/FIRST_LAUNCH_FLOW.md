# First launch → entering the game

Status: **DESIGN v1 (2026-10-05)**. Owner decision D-08 (DEC-0036): the narrative team assigns music, voice and SFX
cues, but first this whole stretch is designed so that every cue point exists for them to fill. This document is that
design: what the player sees from tapping the app icon until they are in the game, for a brand-new player and for a
returning one, with every audio slot named.

**Startup extension (2026-10-05):** the current implementation adds game-controlled Godot → provisional studio →
existing title after the native black splash. The owner main theme is not ready; a future `bgm_main_theme.ogg` path
is reserved and absence is silent. See [current scenes, audio and verification](../../narrative/design/STARTUP_AUDIO_V01.md).
The v1 facts/diagram below retain their original design context. Content loads behind the presentation; actual
release/session/patch requests still start after the title tap. Final title artwork and the entry-page redesign remain open.

Markers used below: **[built]** works in the current build; **[build]** engineering work this design asks for (no
decision needed); **[slot]** a cue or asset the narrative/art team fills; **[owner]** needs an owner decision (listed
at the end).

> Türkçe özet: Uygulama ikonuna dokunmaktan oyuna girişe kadar her adım, yeni ve geri dönen oyuncu için ayrı ayrı
> tanımlandı. Her adımda hangi müzik/ses/efekt alanının (slot) olduğu yazılı; narrative ekibi bu alanlara cue kimliği
> atayacak. Hukuki metinler (kullanım koşulları, gizlilik politikası) ve yaş politikası sahibin kararıdır.

## Facts this design starts from (verified in the repository, 2026-10-05)

- Today the app opens on a plain message screen ("Loading..." while the content loads on a worker, then
  "Connecting..."), checks the server's release gate (`/v1/bootstrap`: update required / maintenance / content
  update), opens Google's account chooser when there is no session, downloads a signed content patch if the server
  runs newer content, fetches the player's state, and shows the hub (or offers to resume an unfinished battle). The
  Godot boot splash in front of it is the engine default.
- LEGACY (Drive, `client/app.py` of the Kivy client) had no title screen either: it opened straight on the hub.
- The story begins with `opening_sad_scene` ("A Letter the Rain Could Not Keep", ~210 s target, 16 lines, Japanese
  voice, music described in prose: *"Felt piano and low cello; leave two seconds of silence after the first bell."*),
  then stage 1-1: a free, guided two-hero tutorial battle (Mahmut and Fadyme, tutorial cards, no Ration), 1-2, and the
  First Oath Invitation (`story_script_ch01.json`). A narrative entry presents the next entry when it ends; a cleared
  stage returns to the hub (after its post-battle lines), so the player can level up and re-gear before going on.
- The locked reference set (UOMD_REFERENCE_LOCK.md) has a key art with the logo marked "title screen / store
  composite" (R02+R01). Art for the app icon, adaptive icon and store graphic is at status `brief`
  (`brand_assets_part1.json`).
- Profiles get a placeholder nickname (`Player` + 6 characters of the account id) and a friend code on first use.
- The VN reader has Back, Next, Auto and Log; it has no Skip.
- Music, voice and SFX play through `Audio` (`res://assets/audio/music|voice|sfx/<id>.ogg`); a missing file is
  silent, never an error.

## The flow

```
 tap icon
   │
 [1] Android splash (system) ──► [2] engine splash (black) ──► [3] TITLE  ◄─────────────────────────┐
                                                                 │  content loads + release gate     │
                                                                 │  run behind it                    │
                                                         tap to start                                │
                                                                 │                                   │
                       update required / maintenance ◄── [4] RELEASE GATE                            │
                                                                 │                                   │
                                     first install only ──► [5] NOTICES (terms, privacy, ads consent)│
                                                                 │                                   │
                                     no session ────────────► [6] SIGN-IN (Google)                   │
                                                                 │                                   │
                                     newer content ─────────► [7] GAME DATA UPDATE ── restart? ──────┘
                                                                 │
                                                          [8] PLAYER STATE
                                                                 │
                 ┌───────────────────────────────┬───────────────┴──────────────┐
           new player                    unfinished battle                 anyone else
  [9] OPENING → 1-1 tutorial             resume prompt                       HUB
      (pre lines, cards, battle,          (exists)
       post lines)
      → HUB after the 1-1 victory
```

### [1] Android system splash — every cold start

- What: Android 12+ shows the app icon on a solid colour until the engine draws.
- Needs: the adaptive app icon **[slot]** (brand asset `mark_game_adaptive_icon`, status `brief`) and a black
  background. Until the icon exists, the engine default icon shows.
- Audio: none (the OS shows it before the game can play anything).

### [2] Engine splash — every cold start

- What: a black screen while the engine loads, no Godot logo. **[build]** (`application/boot_splash`: black, no image)
- Audio: none.

### [3] Title — every launch

- What: full-screen key art with the logo (R02+R01 composite **[slot]** promoted from the locked reference set into
  runtime art, ref `ui/title_key_art`), "Tap to start", and a small build line ("build 12") at the bottom. A
  Support button opens a mail to the support address (D-01). Placeholder art until the asset is promoted. **[build]**
- Behind it, without waiting for the tap: the content loads on a worker and the release gate is asked. The tap is
  accepted at once; if the work is not finished, "Tap to start" turns into a short "Preparing…" until it is.
- Back button: closes the app.
- Audio:
  - `flow.title` music **[slot]** — the title theme. *The main theme is the owner's own (CLAUDE.md); if the title uses
    it, the owner supplies the file and the slot names it.* Starts when the title appears; keeps playing through
    [4]–[8] so the player never sits in silence; fades out when [9] or the hub starts their own music.
  - `sfx.ui_start` **[slot]** — the tap.
  - Optional title call `voice.title_call` **[slot]** (a character saying the game's name in Japanese) — the
    narrative team decides whether it exists.

### [4] Release gate — every launch, behind the title

- Update required (`426 UPDATE_REQUIRED`): a message with "Update" (opens the store page) and nothing else. **[build]**
  (the store button; the gate itself is **[built]**)
- Maintenance (`503 MAINTENANCE`): the server's message and "Try again". **[built]**
- Content update needed: goes to [7] after sign-in. **[built]**
- Unreachable: "Server unreachable — Try again". **[built]**
- Audio: stays on `flow.title`; `sfx.ui_error` **[slot]** on a refusal.

### [5] First-install notices — once per install, before the first sign-in

- What: one screen with the Terms of Service and the Privacy Policy (links to web pages served by the Worker, like
  `/account/delete`) and "Accept and continue". Accepting is stored on the device (and with the account at the next
  sign-in, so a changed version can be asked again). **[owner]** for the texts; **[build]** for the screen once the
  texts exist. Until then this step is skipped.
- Rewarded ads (D-10): Google's consent form (UMP SDK) for players in regions that require it. **[built]** — not in this
  step: it is asked right before the first ad a player chooses to watch (once per run; DEC-0038), so a player who never
  watches an ad never sees it, and nothing is requested from AdMob before it.
- Audio: stays on `flow.title`.

### [6] Sign-in — when there is no session

- First time: one line before the chooser — "Your progress is saved to your Google account." — then Google's account
  chooser. **[build]** (the line; the sign-in is **[built]**)
- Returning players with a session skip this step (the session is restored silently). **[built]**
- Cancelled or failed: "Sign-in required — Try again". **[built]**
- Audio: stays on `flow.title`.

### [7] Game data update — when the server runs newer content

- What: "Downloading game data" with a progress bar and the size; the pack is verified before it is used; when another
  release is already mounted in this process the game asks for a restart. **[built]** except the progress bar and size
  **[build]**.
- Audio: stays on `flow.title`.

### [8] Player state — every launch

- What: "Loading your progress…" for as long as the state request takes. **[built]**
- A save problem offers "Try again" (never applies anything twice). **[built]**

### [9] Routing into the game

- **New player** (story cursor on the first entry, `opening_sad_scene`): no hub first. The opening scene starts
  straight away and runs on into 1-1 (pre-battle lines, tutorial cards, the guided battle, post-battle lines); the
  first sight of the hub is after the tutorial victory, where "Continue Story" leads on to 1-2 and the First Oath.
  **[build]** (before, a new player landed on the hub and had to press "Continue Story")
- **Unfinished battle**: the resume prompt. **[built]**
- **Everyone else**: the hub. **[built]**
- Skip: every story scene gets a Skip button with a confirmation ("Skip the rest of this scene?"); a skipped scene
  counts as seen and the story moves on exactly as at its end. **[build]** A story archive to re-read past scenes is
  not part of this stretch (no such screen exists yet).
- Player name: no name entry in the opening (the story's protagonists are Mahmut and Fadyme, not the player). The
  placeholder nickname stays until the player changes it in the profile (social features, INF-037). **[build]**

## Audio slots

Two kinds of cue ids, both filled by the narrative team (D-08), both resolved by `Audio` to
`res://assets/audio/music|sfx|voice/<id>.ogg` (missing file = silence, reported once in the asset report):

1. **Flow slots** — screens outside the story. One content pack, `audio_cues_part1.json`, maps each slot to a cue id
   (or null = silent). Engineering owns the slot list; the narrative team owns the values.

   | Slot | Where | Notes |
   |---|---|---|
   | `flow.title` | game-controlled Godot/studio, [3]–[8] | owner main theme confirmed; recording pending. Entry helper reserves `bgm_main_theme` when this slot is null; other null flow slots remain silent |
   | `flow.hub` | hub and menus | |
   | `flow.summon` | summon screen | |
   | `flow.battle_default` | battles without their own cue | stages may name their own later |
   | `flow.victory` / `flow.defeat` | battle result | short stingers |
   | `sfx.ui_start` | title tap | |
   | `sfx.ui_confirm` / `sfx.ui_back` / `sfx.ui_error` | buttons, refusals | |
   | `voice.title_call` | title | optional |

2. **Story cues** — inside story scenes, next to the existing prose (`music_cue` stays as the brief):
   - scene `music_cue_id` (and optional `ambience_cue_id`): starts when the scene opens;
   - line `audio`: `{"music": "<cue>" | "stop", "ambience": "<cue>" | "stop", "sfx": "<cue>", "fade_seconds": n}`
     for changes at a line (e.g. the opening's "two seconds of silence after the first bell": a `sfx` bell on the
     line, then `"music": "stop"` with `fade_seconds`);
   - voice stays as it is (`line_id` + speaker → `voice/<speaker>/<line_id>.ogg`).

   For the opening this means: `opening_sad_scene.music_cue_id` (felt piano + low cello), `ambience_cue_id` (rain on
   the shrine), and line-level `sfx` for the bell. Cue ids are `^[a-z][a-z0-9_]{2,63}$` (e.g. `bgm_opening_letter`,
   `amb_rain_shrine`, `sfx_bell_distant`); the validator checks the format, not that the file exists yet.

## Owner decisions this design needs

- **D-15 Legal texts** for [5]: the Terms of Service and the Privacy Policy (Play requires a privacy policy for an
  app with accounts, purchases and ads). Engineering can draft the privacy policy from what the system actually stores
  for the owner to approve; the terms are the owner's.
- **Main theme delivery** (`flow.title` / reserved `bgm_main_theme`): usage is confirmed; the owner will supply the recording later. The opening is prepared and currently silent.

Everything else above is engineering or narrative-team work and proceeds without a decision.

## Implementation status (2026-10-05)

Built with this design: the black engine splash [2]; the title [3] with the content loading behind it, an early tap
kept, Support, `flow.title`; the Update button for an outdated build [4]; the sign-in line [6]; new players straight
into the opening [9]; Skip with confirmation; the flow slot pack `audio_cues_part1.json` (all null, validated), scene
`music_cue_id`/`ambience_cue_id` and line `audio` played by the VN reader (validated), `flow.hub`, `flow.summon`,
`flow.battle_default` (battle start), `flow.victory` and `flow.defeat`.
Tests: GUT `tests/ui/test_first_launch.gd` (title → new player into the opening, returning player to the hub, retries
skip the title), title and Skip screen tests, audio cue tests; `tools/test_validate_audio.py`.

Still to build: the notices screen [5] (waits on D-15), the download progress bar and
size [7], the title art promotion
(`ui/title_key_art`, asset pipeline) and the adaptive icon [1] (art).
