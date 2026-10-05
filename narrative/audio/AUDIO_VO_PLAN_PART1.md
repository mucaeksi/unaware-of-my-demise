# Audio & Voice Plan — Part I (2026-09-30, decision C42)

The game ships with **Japanese voice acting** (English text on screen) and a **scored soundtrack**. From now on every scene is written and staged for dubbing and scoring. This file is the narrative side of both; the technical team owns playback, mixing and file packaging.

## 1. Music

### 1.1 Track list (Part I, 33 tracks)

| Track id | Role | Sound | Used for |
|---|---|---|---|
| `bgm_main_theme` | Title, ending card | full orchestra; the bell motif resolved only once, at the very end | title screen, part end |
| `bgm_fadyme_theme` | Leitmotif | felt piano and low cello, one small bell | her quiet scenes; minor at 4-3, major at ch4_camp, with choir at 7-3 |
| `bgm_mahmut_theme` | Leitmotif | low strings, steady walking tempo, no percussion | Marek's recognition, Oren, the road |
| `bgm_ledger_motif` | Leitmotif | seven bell notes; the eighth never plays | the register, seals, schedules, 7-1 |
| `bgm_bell_widow` | Villain motif | dry handbell, low female choir, drone | Yseldra's scenes and seals |
| `bgm_clockless` | Villain motif | pizzicato like a clock that never resolves | C.V. hints, the final reveal |
| `bgm_held_the_road` | Ensemble theme | warm full ensemble, marching strings | ch6_camp (quiet), 7-2, 7-4 |
| `bgm_ch1_ash_forest` … `bgm_ch7_altar` (7) | Location | each with calm / uneasy / chaotic layers matching ORDER_LEVEL | chapter hubs and stages |
| `bgm_road` | Travel | light strings and guitar; tempo varies by scene | road interludes |
| `bgm_camp` | Rest | acoustic, fire crackle; inn, night and dawn versions | camp scenes |
| `bgm_warmth` | Emotion | small ensemble, hopeful | recruits, safe moments |
| `bgm_comic` | Emotion | pizzicato and woodwinds | light scenes |
| `bgm_tension` | Emotion | low strings, pulse | before fights, discoveries |
| `bgm_quiet_sorrow` | Emotion | solo instrument, sparse | loss, aftermath |
| `bgm_revelation` | Emotion | swelling strings, short | discoveries |
| `bgm_battle_field`, `bgm_battle_elite` | Battle | driving; element-free | normal and elite fights |
| `bgm_boss_beast`, `bgm_boss_bell_widow`, `bgm_boss_human`, `bgm_boss_wraith`, `bgm_boss_eclipse_construct` | Boss | boss_human has alchemist and commander variations; the construct has two phases | boss stages |
| `sting_bell_toll`, `sting_victory`, `sting_defeat`, `sting_recruit`, `sting_reveal` | Stingers | 2–6 s | transitions |
| `silence` | Cue | no music, ambience only | written explicitly where silence is the point |

### 1.1b Production (owner decision 2026-09-30)
- **All music is made with Lyria** (`lyria-3.5` for every track and stinger, WAV; C44) by the Narrative & Visual Director with `tools/gen_audio.py`, **except `bgm_main_theme`, which the owner handles.**
- **Leitmotifs are composed, not generated:** Lyria cannot take a melody as input, so Fadyme's theme and the Ledger motif are written as MIDI (`audio/music/motifs/`) and placed over or before Lyria beds that share their key, tempo and metre. Theme tracks are identified by a fixed instrument signature as well (Fadyme: felt piano + solo cello + one small bell; Yseldra: dry handbell + low female choir; Cael: clockwork pizzicato).
- **Location layers** (calm / uneasy / chaotic) are three separate Lyria tracks with the same key, tempo and instruments, cross-faded by ORDER_LEVEL.
- **Prompts:** `prompts/music/music_part1.md` (51 tracks: the list in 1.1 expanded with the layers, camp versions and boss variations).
- **Reference set (owner approves, with Fadyme's art and voice):** Fadyme's theme (motif + bed, minor and major-resolved versions), the Ledger motif, ch1 forest in three layers, the standard battle. Everything else follows in one run and is approved by the Director.
- Open before release: Lyria price and commercial-use terms (not on the pricing or music pages as of 2026-09-30); SynthID watermark is present and inaudible.

### 1.2 Scene cues
- Every main-story scene now has a `music_cue` (the field already used by the opening scene; no new schema). Format: `pre: <track> — note | battle: <track> | post: <track> — note` for stage scenes, a single cue for other scenes.
- Silence is a cue, not an absence: the Ash-Maw's entrance, the white strand (5-4), the start of the confession.
- Companion stories and events get their cues next (same format).

### 1.3 Diegetic music (sung on screen; recorded with the character's voice actor)
Pippa's name-songs (3-4, `cs_pippa_bell_1`, `cs_pippa_bell_4`, `event_harvest_inn_meal_3`), Marek's counting song (`cs_marek_vane_2`). They need Japanese lyrics written to the melody, not translated line by line.

## 2. Voice

### 2.1 Casting sheet
Voice types from the GDD roster (archetypes, not real actors), in English. Lines = story + companion + event lines (inner voice included); battle = `character_voice_lines_part1.json`.

| Character | Age | JP voice type | Story lines | Battle/menu lines |
|---|---|---|---|---|
| Mahmut | 28 | low, calm baritone; short sentences, dry humour; anger shown as silence | 133 | 11 |
| Fadyme | 22 | light, controlled alto; dark humour and sharp observation under the courtesy; "I am fine" is a mask that changes each time | 190 | 11 |
| Kera Voss | 20 | fast, cocky but sincere tsundere; hard sentence endings, short bursts | 48 | 11 |
| Brin Alder | 23 | low, serious kuudere; warmth in few words | 24 | 11 |
| Nixie Vale | 19 | genki, breathless and fast; turns suddenly serious in danger | 34 | 11 |
| Sister Aveline | 26 | warm, gentle onee-san; precise and clear in prayers | 31 | 11 |
| Sable Wren | 21 | near-whisper kuudere; a small breath at the end of words | 23 | 11 |
| Tilda Fen | 24 | dry, lightly sarcastic, relaxed; never the old-sage voice | 24 | 11 |
| Rikka Ember | 18 | exuberant, defiant genki; determined breath in battle, not laughter | 22 | 11 |
| Mirel Quill | 25 | gentle, quick-reasoning onee-san; chooses words carefully | 31 | 11 |
| Odelia Pike | 22 | shy but observant; confident, clear calls when she has a target | 21 | 11 |
| Pippa Bell | 20 | bright stage voice that slides between speech and song; the jokes stop when she is hurt | 18 | 11 |
| Nara Vell | 27 | steady, calm kuudere; the protective instinct comes before the words | 20 | 11 |
| Clem Marr | 19 | curious, slightly eerie; tells grave stories like a cheerful researcher (not yandere) | 25 | 11 |
| Vespera Wisp | 23 | grave, poetic kuudere; an ancient timbre when casting, young and tired otherwise | 21 | 11 |
| Hana Birch | 18 | quiet, shy kuudere; firm and solid on counterattacks | 20 | 11 |
| Thistle Roe | 21 | soft, slight stammer; no hesitation when talking about plants | 15 | 11 |
| Iona Mist | 24 | calm, analytical kuudere; comfort lines soft but direct | 24 | 11 |
| Jori Flint | 20 | blunt, quick-tempered tsundere; hides fear as orders | 27 | 11 |
| Marek Vane | 30 | calm, slightly rough tenor; counts breath and rhythm before singing | 23 | 11 |
| Lady Yseldra Vale | 34 | cold, controlled mezzo; ritual cadence; never raises her voice (villain) | 9 | 0 |
| Lord Cael Veyr | — | warm, cultured baritone that sounds reasonable; pauses where a clock would tick (villain) | 6 | 0 |
| Marshal Oren | — | weathered commander bass; the voice that taught Mahmut | 5 | 0 |
| Narrator | — | neutral, low, unhurried; separate actor from the cast (jp_narration) | 24 | 0 |
| Shrine Keeper | old | kind, dry, rural | 6 | 0 |
| Captain Rusk | — | mercenary, clipped | 2 | 0 |
| Red Vial Matron | — | silken, clinical | 1 | 0 |
| Ashen Lord (wraith) | — | layered whisper, repeats "hide them from the Crown" | 2 | 0 |
| Eclipse Construct | — | processed, mechanical choir | 2 | 0 |
| Minor NPCs (priest, innkeeper, alchemist, refugee, servant, herald, potter, agent) | — | can share 3–4 utility actors | 16 | 0 |

Total voiced story/companion/event lines ≈ 847; battle and menu lines: 220. Five lines are silent cards (`voice_track: none`).

### 2.2 Tracks
- `jp`: spoken line. `jp_inner`: inner voice (Fadyme, Mahmut once): same actor, close mic, processed. `jp_narration`: a separate narrator actor. `none`: silent card.

### 2.3 Japanese script
- The recording script is written in Japanese from the English lines, adapted, not translated literally ("JP dub cut to the English line's emotion and timing", GDD).
- It lives outside the game data so no schema changes: `narrative/audio/voice/jp_script_<chapter>.json` (line_id, speaker, English, Japanese draft, direction, notes). The Narrative & Visual Director drafts it chapter by chapter; **a native Japanese editor reviews it before recording.**
- Order: ch1 → ch7, then companion stories, events, battle and menu lines.

### 2.4 Name and term glossary (proposal for the JP editor)
Katakana must keep names that sound alike in English apart:

| Term | Proposal | Why |
|---|---|---|
| Veyr / Veyrhold | ヴェア / ヴェアホルド | must not sound like Vale; "Veyr?" at 7-3 is a reveal |
| Vale (surname) | ヴェール | Nixie Vale, Lady Yseldra Vale |
| Veil (element) | 帳（とばり） | a word, not katakana, so it never collides with Vale |
| Fadyme / Mahmut | ファディメ / マフムト | |
| the Ledger | 台帳 | |
| the Last Bell | 終（つい）の鐘 | |
| the Unwritten Hour | 記されざる刻 | |
| Borrowed Hour (skill) | 借りた刻 | |
| Crownfall | 王冠落ち（クラウンフォール） | |
| the Bell-Widow | 鐘の未亡人 | Yseldra's epithet (Fadyme, ch1_camp) |
| bell clapper | 鐘の舌（ぜつ） | TTS needs the reading hint |
| Brin / Nixie / Kera / Jori / Pippa / Clem / Hana / Thistle / Sable | ブリン / ニクシー / ケラ / ジョリ / ピッパ / クレム / ハナ / シスル / セーブル | names Fadyme speaks |
| Sister Aveline / Mirel / Tilda / Iona / Odelia / Marek / Nara / Vespera / Rikka / Oren / Yseldra / Cael | シスター・アヴリーヌ / ミレル / ティルダ / イオナ / オデリア / マレク / ナラ / ヴェスペラ / リッカ / オーレン / イゼルドラ / ケイル | proposal |
The rest of the roster and places: katakana from the English spelling, listed in the first JP script file.

### 2.5 Writing for the dub (rule for every new line)
1. One breath per line; English lines stay under ~150 characters (current maximum: under 150).
2. No plot point may depend on English-only wordplay. Where a line plays on English (Pippa's "Veyr rhymes with stayed here"), the Japanese line is rewritten to do the same job in Japanese; the note goes in the JP script.
3. Names are spoken the same way every time (glossary).
4. Thought lines stay short and do not repeat what is on screen.
5. Non-verbal reactions ("...", a laugh, a breath) are written as lines with a direction, not left out; the actor records them.

### 2.6 Option: Gemini text-to-speech (checked 2026-09-30)
- Model (C44): `gemini-3.8-flash-tts` for every voice (a cheaper `flash-lite-tts` exists; not used). Japanese is supported. 30 prebuilt voices plus a larger voice library; the docs also list project custom voices (up to 200). Style, pace and tone are steered in natural language and with inline tags; up to 2 speakers per request. Output: 24 kHz 16-bit WAV.
- Cost (3.8 Flash TTS, 25 audio tokens per second): audio output $9 per 1M tokens standard, $4.50 batch, through 31 Dec 2026 (doubles from 1 Jan 2027). Part I is about 1,070 lines × ~4 s ≈ 4,300 s ≈ 107k tokens ≈ $1 per full pass; with three takes per line, a few dollars.
- Recommended use: **scratch voice now** (timing, VN auto-advance, battle bark length, in-game testing), then decide on final voices after hearing chapter 1. Before shipping AI voices: confirm commercial-use terms, store disclosure rules and player expectations for a JP-dub gacha. Never clone a real person's voice; designed voices only.
- Each character gets one fixed voice + a fixed style sentence (from §2.1) so takes stay consistent.
- **Decision (owner, 2026-09-30):** voices are produced this way by the Narrative & Visual Director. Each character is finished as one package: sheet, busts, poses, cut-in and voice. **Fadyme's voice belongs to the reference set** (owner approval): voice choice and style sentence, then all her story, inner-voice and battle lines (≈ 230 lines), after her JP script is drafted.
- **Fadyme done as reference (owner, 2026-09-30):** voice **Sulafat** (exclusive; Sadachbia auditioned and dropped). Per-line calls with per-line emotion directions drifted in pitch and level (≈6 semitones, 11 dB); the approved method is one call per scene or chapter with one fixed style sentence, then a Whisper-aligned split into lines, a text check against the script, the take closest to the reference pitch (≈197 Hz), and level matching to −20 dB. Inner voice is delivered dry (processing is a playback decision). Script: `narrative/audio/voice/jp_script_fadyme.json` (201 lines: 190 story/companion/event + 11 battle/menu; one file per character for the recording pass instead of per chapter). Register: polite (です/ます) to new or older acquaintances, soft casual with Mahmut and party companions.
- **Quota:** Gemini TTS on Tier 1 allows **100 requests per day** per model; the grouped method needs ≈ 1 request per scene/chapter track per take, so a character fits in one day.
