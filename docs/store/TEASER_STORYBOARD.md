# Google Play Store Preview Video — ~1:30 Teaser Storyboard (`ART-4`)

**Target:** Google Play Store listing preview video (YouTube URL; plays over `docs/store/assets/feature_graphic_1024x500.png` before the screenshots).  
**Runtime:** `1:30` (`90.0 seconds`)  
**Format (YouTube Store Trailer):** `1920 × 1080` (16:9 landscape), 60 fps, H.264/AAC stereo (`-14 LUFS` integrated loudness).  
**Voice & Text Policy:** Japanese voice-over (`ja-JP` Chirp 3 HD approved lines) with burned-in or synced English subtitles (`en`) and gothic title cards (`Cinzel` / `Cormorant Garamond`).  
**Spoiler Boundary (`D-29` / `RELEASE_ROADMAP §2 B4`):** Drawn strictly from the Part I opening (`entry/prologue.json`), Tutorial `T-1..T-3`, and Chapter 1 (`The Whispering Ash Forest`) + the Bell Road world map. **Never** depict or name the cause of the king's death at Crownfall, the Clockless reveal, or Part II / Part III regions.

---

## 1. Production Tracks & Budget Options (`RELEASE_ROADMAP §2 & §6.1`)

Per `docs/RELEASE_ROADMAP.md` §2 (`B4`), the standard monthly media budget (`$20/month`, `$3/batch`) does not cover a full 90-second trailer of generated video. Two production tracks are specified below for owner selection:

| Track | Source Mix | Incremental Video Cost | Status |
|---|---|---|---|
| **Track A — In-Game Capture + Motion-Comic Plates (Recommended Default)** | 100% real `1920×1080` in-game captures from `PrologueScene` (layered parallax + procedural motion), `StoryScene` (knee-up portraits), `BattleScene` (5v5 animated chibi combat + VFX), `HomeScene` (painted Bell Road world map), and `TitleScene` (Eclipse Corona + Swinging Bell + Logo). | **`$0.00`** (uses existing approved art, BGM, and JP voice files) | Ready to capture and assemble immediately |
| **Track B — Hybrid Capture + 4 Keyframe-Anchored Veo 3.1 Lite Shots** | 74s of real in-game capture (`82%`) + 4 × 4s (`16s`) image-to-video cinematic shots (`Shots 01, 04, 06, 12`) anchored to approved `content/approved_art/art/still_prologue_*.webp` plates. | Requires separate owner one-off video budget approval | Optional upgrade if owner approves separate budget |

---

## 2. Audio & Musical Arc (`0:00 – 1:30`)

| Timeframe | Act | Music Cue (`content/base/audio/`) | Mood & Pacing |
|---|---|---|---|
| `0:00 – 0:24` | **Act I — The Bells & Crownfall** | `bgm_prologue_before_the_road.ogg` (`0:00–0:24`) + `Sfx.bell(330)` | Solemn, elegiac bronze bell resonance; quiet memory turning to ash and departure. |
| `0:24 – 0:44` | **Act II — One Name on the Road** | `bgm_fadyme_theme.ogg` (`0:00–0:20`) | Intimate, wistful piano/strings; Mahmut's winter search and reunion with Fadyme. |
| `0:44 – 1:14` | **Act III — The Company & Tactical Battle** | `bgm_ch1_ash_forest_chaotic.ogg` (`0:00–0:30`) | Driving tactical urgency; world map reveal, companion recruitment, 5v5 turn-based combat. |
| `1:14 – 1:30` | **Act IV — Unaware of My Demise** | `bgm_main_theme.ogg` (cresting chorus + final bell chime) | Grand gothic crescendo; Eclipse Corona & Swinging Sanctuary Bell over the title logo. |

---

## 3. Shot-by-Shot Storyboard (`12 Shots · 90.0s Total`)

### Act I — The Broken Oath & The Bells (`0:00 – 0:24` · `24s`)

| Shot | Time (`mm:ss`) | Dur. | Visual Source (Track A / Track B) | Camera & On-Screen Action | Dialogue / Caption (`line_id`) | Audio / SFX |
|---|---|---|---|---|---|---|
| **01** | `0:00 – 0:06` | `6s` | **Track A:** `PrologueScene` shot `hours` (`art/still_prologue_hours.webp` + swinging bronze bell axle + dust motes) after 1.2s `StudioScene` (`art/ui_studio_mark.webp`) flash.<br>**Track B:** Veo 3.1 Lite 4s first-frame transition from `still_prologue_hours.webp`. | Cold open on black; a single bronze bell strike illuminates the `ŞovTaym Studios` chronometer mark (`0:00–0:01.5`), dissolving into the bell tower of Veyrhold as the bronze bell swings across warm dust-lit stone. | **VO (`entry_past_001`, JP):**<br>*“Before the roads filled with ash, Veyrhold measured its days in bells.”* | Deep sanctuary bell toll (`330 Hz`); `bgm_prologue_before_the_road.ogg` enters softly. |
| **02** | `0:06 – 0:12` | `6s` | **Track A & B:** `PrologueScene` shot `names` (`art/still_prologue_names.webp` + quill hand layer) cross-fading to `ordinary_days` (`art/still_prologue_ordinary_days.webp`). | Close-up on the roadside register as a quill traces an indistinct stroke of ink (no invented legible name); slow push-in, then dissolve to the quiet village street before the war. | **VO (`entry_past_002`, JP):**<br>*“People carved their names on doors and trees, and wrote them in roadside registers… So someone would remember that they had been here.”* | Quill scratch Foley; distant market murmur fading into wind. |
| **03** | `0:12 – 0:18` | `6s` | **Track A & B:** `PrologueScene` shot `throne_wars` (`art/still_prologue_throne_wars.webp` + departing refugee walk layer). | Wide pan across abandoned harvest fields toward the distant capital silhouette as travelers depart along the road. **Card overlay (`0:15`):** `A BROKEN OATH. A KINGDOM IN ASH.` | **VO (`entry_past_004`, JP):**<br>*“The great houses fought over a throne. Fields emptied. Families took to the roads…”* | Low timpani swell; wind rising through dry ash. |
| **04** | `0:18 – 0:24` | `6s` | **Track A:** `PrologueScene` shot `crownfall` (`art/still_prologue_crownfall.webp` + independent smoke & drifting ash layers).<br>**Track B:** Veo 3.1 Lite 4s smoke/ember drift anchored to `still_prologue_crownfall.webp`. | Tight composition on the ruined capital gates at dawn under drifting smoke and pale ash. *(Strict canon rule: never depict the king's death or its cause.)* | **VO (`entry_past_005`, JP):**<br>*“Then came Crownfall. By dawn, survivors were leaving behind streets they had once known by heart.”* | Dissonant brass chord; crackling ember ambience. |

---

### Act II — Mahmut, Fadyme & The Road Ahead (`0:24 – 0:44` · `20s`)

| Shot | Time (`mm:ss`) | Dur. | Visual Source (Track A / Track B) | Camera & On-Screen Action | Dialogue / Caption (`line_id`) | Audio / SFX |
|---|---|---|---|---|---|---|
| **05** | `0:24 – 0:31` | `7s` | **Track A & B:** `PrologueScene` shot `search` (`art/still_prologue_search.webp` + younger Mahmut studying the inn ledger). | Slow Ken Burns drift toward Mahmut at the winter inn counter, lantern light catching his weathered coat as he searches the register page by page. | **VO (`entry_past_007`, JP):**<br>*“Among the travelers was a knight who searched the village registers for one name. Village after village, winter after winter…”* | Cross-fade to `bgm_fadyme_theme.ogg`; quiet hearth crackle. |
| **06** | `0:31 – 0:38` | `7s` | **Track A:** `PrologueScene` shot `reunion` (`art/still_prologue_reunion.webp`) + `beginning` (`art/still_prologue_beginning.webp`).<br>**Track B:** Veo 3.1 Lite 4s subtle hair/cloak wind motion on `still_prologue_reunion.webp`. | Fadyme (aged 20) and Mahmut (aged 26) face one another in the hill village; her extended hand and his raised gaze transition into the two walking side by side down the ash-lined forest road. | **VO (`entry_past_008` / `009`, JP):**<br>*“In a hill village, he found her. She asked him to stay. He did. Now Fadyme and Mahmut walk together.”* | Solo cello & piano phrase from `bgm_fadyme_theme.ogg`. |
| **07** | `0:38 – 0:44` | `6s` | **Track A & B:** Real in-game capture of `StoryScene` (`story/tutorial_t1_before.json` & `story/ch1_s1_before.json`) over `art/bg_forest_whispering_ash.webp`. | Knee-up (boydan) Light Novel portraits of **Fadyme** (`portrait_fadyme_composed` → `portrait_fadyme_wry`) and **Mahmut** (`portrait_mahmut_watchful` → `portrait_mahmut_protective_resolve`) conversing in the Whispering Ash Forest with the gothic dialogue frame and typewriter subtitles. | **On-screen Dialogue (`StoryScene`):**<br>Mahmut & Fadyme exchange dry, protective banter as the first Bellbound silhouettes stir in the ash mist. | Dialogue text tick SFX; transition riser into battle percussion. |

---

### Act III — The Bell Road, Companions & 5v5 Tactical Combat (`0:44 – 1:14` · `30s`)

| Shot | Time (`mm:ss`) | Dur. | Visual Source (Track A / Track B) | Camera & On-Screen Action | Dialogue / Caption (`line_id`) | Audio / SFX |
|---|---|---|---|---|---|---|
| **08** | `0:44 – 0:51` | `7s` | **Track A & B:** Real in-game capture of `HomeScene` (`WorldMap` mode) showing `art/bg_world_map_part1.webp` (`The Bell Road of Veyrhold`) + `ChaptersScene` (`Chapter 1: Whispering Ash Forest`). | Wax-seal ignition burst transitions into the **World Map Hub**: the hand-painted relief map of Veyrhold with golden road lines, **CHAPTER 1 (Open)** glowing in the west, Chapters 2–7 along the Bell Road, and the Company Sanctum controls around the perimeter. Tap on Chapter 1 opens the stage chain. | **Title Card Overlay (`Cinzel`):**<br>`FOLLOW THE BELL ROAD ACROSS VEYRHOLD` | Wax-seal confirm chime; `bgm_ch1_ash_forest_chaotic.ogg` kicks in. |
| **09** | `0:51 – 0:58` | `7s` | **Track A & B:** Real in-game capture of `RosterScene`, `CharacterScene` (hero attributes, skills, signature weapon), and `TeamScene` (frontline/backline 5-unit formation). | Quick rhythmic cuts (`2.3s` each):<br>1) **Company Roster** showing recruited companions (Kaelen, Sister Aveline, Nyx, Sera, Orin);<br>2) **Character Sheet** highlighting `STR/INT/VIT/AGI` attributes & Signature Weapon;<br>3) **Team Formation** placing frontline vanguard and backline support. | **Title Card Overlay (`Cinzel`):**<br>`FORGE UNLIKELY COMPANIONS · BUILD YOUR FORMATION` | Crisp UI metallic page-turn and formation lock SFX. |
| **10** | `0:58 – 1:06` | `8s` | **Track A & B:** Real in-game capture of `BattleScene` (`encounters/tutorial_t3.json` and Chapter 1 `stage_1_3.json`) over `art/bg_forgotten_stone_crossing.webp`. | Full 5v5 tactical turn-based battle on the PixiJS v8 stage: 2-head SD animated chibi sprites breathing/stepping in 4-frame loops, turn-order ribbon at top, enemy intention badges, player selecting a skill (`two-step confirm`) and targeting the frontline. | **Title Card Overlay (`Cinzel`):**<br>`READ ENEMY INTENTIONS · COMMAND EVERY TURN` | Sword slash, guard clang, and arcane charge SFX synced to the beat. |
| **11** | `1:06 – 1:14` | `8s` | **Track A & B:** Real in-game capture of `BattleScene` ultimate skill execution + `DeedsScene` / `TrialsScene` (`Arena` & `Endless Corridor` preview) + `BattleScene` 3-star `VICTORY` banner. | Mahmut and Fadyme unleash coordinated skills with `vfx_v1` particle bursts and floating damage numbers (`CRIT!`), cutting to a 2-second glimpse of the **Trials (Arena & Endless Corridor)** hub and landing on the golden 3-star **VICTORY** crest. | **VO (`entry_past_009`, JP):**<br>*“The bells still ring. Neither has told the other everything.”* | Impact shockwave SFX + 3-star victory fanfare chime. |

---

### Act IV — Title Reveal & Call to Action (`1:14 – 1:30` · `16s`)

| Shot | Time (`mm:ss`) | Dur. | Visual Source (Track A / Track B) | Camera & On-Screen Action | Dialogue / Caption (`line_id`) | Audio / SFX |
|---|---|---|---|---|---|---|
| **12** | `1:14 – 1:30` | `16s` | **Track A:** Real in-game capture of `TitleScene` (`art/ui_title_bg.webp` + `art/ui_logo.webp` + rotating Black-Sun Eclipse Corona + swinging Fractured Sanctuary Bell + rising ash embers + `TAP TO START` wax seal burst).<br>**Track B:** 4s Veo 3.1 Lite key-art intro dissolving into live `TitleScene`. | Slow dramatic reveal of the `TitleScene`: Mahmut and Fadyme beneath the Black-Sun Eclipse as the fractured Sanctuary Bell swings above the `UNAWARE OF MY DEMISE` emblem (`ui_logo.webp`).<br>At `1:24`, the crimson-and-gold Wax Seal ignites (`triggerWaxSealBurst`).<br>**End-slate subline (`1:25–1:30`):**<br>`UNAWARE OF MY DEMISE` · `Available on Google Play · Sign in with Google Play Games` | **VO (`entry_past_009`, JP):**<br>*“This is where their story begins.”*<br>**On-screen Tagline:**<br>`A Broken Oath. A Distant Bell. An Unlikely Company.` | `bgm_main_theme.ogg` reaches full orchestral/choral peak, resolving on a single lingering bronze bell toll (`330 Hz`) that fades to black at `1:30.0`. |

---

## 4. Compliance & Submission Verification Checklist (`Play Console`)

- [x] **No Spoilers:** Only Prologue (`entry_past_001..009`), Tutorial (`T-1..T-3`), Chapter 1 (`Whispering Ash Forest`), and the Part I Bell Road map appear. No Crownfall regicide cause, no Clockless reveal, no Part II/III region names.
- [x] **Honest Scope (`docs/store/PLAY_LISTING_EN.md`):** Represents actual in-game UI, actual 5v5 chibi battles, actual knee-up VN portraits, and actual Chapter 1 / World Map content delivered in Patch 1 (`D-29`).
- [x] **Audio/Language Disclosure:** Japanese dialogue audio with English UI and English subtitles, matching `PLAY_LISTING_EN.md`.
- [x] **Feature Graphic Compatibility:** Designed to sit behind Google Play's centered video play button overlay on `docs/store/assets/feature_graphic_1024x500.png`.
