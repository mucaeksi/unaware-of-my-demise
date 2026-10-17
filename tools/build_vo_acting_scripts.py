#!/usr/bin/env python3
"""
Builds the canonical Japanese Voice Acting Scripts, Emotional Prompts, Inline Vocal Tags,
and Chirp3-HD SSML for the entire Unaware of My Demise vertical slice (116 lines)
plus upgrades the Part I Fadyme line maps and recording queues.

Locked Cast (Owner Direction):
- Narrator (`narrator`): Algieba (`ja-JP-Chirp3-HD-Algieba` / `gemini-3.8-flash-tts` voice `Algieba`)
- Fadyme (`fadyme`): Sulafat (`ja-JP-Chirp3-HD-Sulafat` / `gemini-3.8-flash-tts` voice `Sulafat`)
- Mahmut (`mahmut`): Iapetus (`ja-JP-Chirp3-HD-Iapetus` / `gemini-3.8-flash-tts` voice `Iapetus`)
"""

from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CASTING_BIBLE = {
    "schema_version": 2,
    "project": "Unaware of My Demise",
    "locked_at": "2026-10-16",
    "tts_engines": {
        "primary_expressive": {
            "model": "gemini-3.8-flash-tts",
            "capabilities": [
                "turn-level speech_metadata.style acting prompts",
                "point-in-time inline vocal tags (<short pause>, <long pause>, <breath>, <exhales>, <sigh>, <chuckle>, <whispers>)",
                "2-speaker conversational dialogue mode for Mahmut + Fadyme scenes"
            ],
            "anti_robotic_rules": [
                "NEVER pass stage directions inside plain transcript text; keep sustained emotional acting direction in speech_metadata.style.",
                "NEVER batch an entire chapter of isolated lines into one flat prompt. Generate either in 2-speaker conversational exchanges or per-line with scene-specific speech_metadata.style.",
                "Insert inline vocal tags (<short pause>, <long pause>, <breath>, <sigh>, <chuckle>, <exhales>) at natural Japanese clause boundaries so actors breathe and hesitate like living people.",
                "Shift speaking rate, pitch contour, and warmth dynamically on every single line according to its narrative subtext."
            ]
        },
        "secondary_deterministic_ssml": {
            "model": "Chirp3-HD (Google Cloud Text-to-Speech v1)",
            "capabilities": [
                "clause-level <prosody rate pitch> envelopes",
                "exact millisecond <break time/> pauses between clauses"
            ]
        }
    },
    "cast": {
        "narrator": {
            "speaker_id": "narrator",
            "name_en": "Narrator",
            "name_ja": "語り手",
            "reading_kana": "カタリテ",
            "gemini_voice": "Algieba",
            "chirp3_voice_id": "ja-JP-Chirp3-HD-Algieba",
            "fundamental_hz": 93.4,
            "vocal_archetype": "Deep, resonant bass-baritone chronicle storyteller (93 Hz); weathered, intimate, unhurried, carrying the weight of memory without theatrical melodrama.",
            "base_rate": 0.92,
            "base_pitch_semitones": -1.0,
            "default_style_prompt": "Deep, weathered Japanese chronicle narrator; unhurried, intimate, and resonant, letting quiet pauses settle like falling ash."
        },
        "fadyme": {
            "speaker_id": "fadyme",
            "name_en": "Fadyme",
            "name_ja": "ファディメ",
            "reading_kana": "ファディメ",
            "gemini_voice": "Sulafat",
            "chirp3_voice_id": "ja-JP-Chirp3-HD-Sulafat",
            "fundamental_hz": 252.6,
            "vocal_archetype": "Adult woman (22), light controlled alto (253 Hz); poised gothic elegance, dry aristocratic wit, quiet underlying exhaustion, and tender warmth reserved only for Mahmut.",
            "base_rate": 0.94,
            "base_pitch_semitones": 0.0,
            "default_style_prompt": "Poised young woman with a calm, luminous alto voice; unhurried cadence, subtle dry wit, and gentle warmth beneath composed restraint."
        },
        "mahmut": {
            "speaker_id": "mahmut",
            "name_en": "Mahmut",
            "name_ja": "マフムト",
            "reading_kana": "マフムト",
            "gemini_voice": "Iapetus",
            "chirp3_voice_id": "ja-JP-Chirp3-HD-Iapetus",
            "fundamental_hz": 144.6,
            "vocal_archetype": "Adult weathered knight (28), grounded low-mid baritone (145 Hz); economical with words, practical, tiredly fond dry humor, and unyielding protective resolve when danger nears.",
            "base_rate": 0.95,
            "base_pitch_semitones": -0.8,
            "default_style_prompt": "Grounded, travel-worn knight with a calm low baritone; economical phrasing, steady protective warmth, and understated dry humor."
        }
    }
}

# Tuple format per line:
# (
#   line_id, scene_id, speaker_id, emotion,
#   when_cue,
#   subtext_tr,
#   en,
#   ja,
#   reading_kana,
#   style_prompt_en,
#   tts_text_gemini38,
#   ssml_chirp3,
#   rate, pitch_st, est_dur_s
# )

VERTICAL_SLICE_LINES: list[tuple] = [
    # ==================== PROLOGUE: BEFORE THE ROAD (9 LINES) ====================
    (
        "entry_past_001", "prologue_hours", "narrator", "chronicle_nostalgia",
        "00:00–00:12 | Çan kulesi görseli (`prologue_village_hours`) belirdikten 320ms sonra, solo piyano ve çan tınısı üzerine.",
        "Savaş öncesi Veyrhold'un huzurlu günlerini özlemle ama ağırbaşlı bir vakur tonla anlatır; '測っていた' sonrasında çan sesi yankılanırken hafifçe duraksar.",
        "Before the roads filled with ash, Veyrhold measured its days in bells. A sound from the tower meant another hour had passed.",
        "道という道が灰に埋もれる前、ヴェアホルドの人々は鐘の音で日々を測っていた。塔から響くひと打ちは、またひとつの刻が過ぎたことを告げていた。",
        "ミチトイウミチガハイニウモレルマエ、ヴェアホルドノヒトビトハカネノオトデヒビヲハカッテイタ。トウカラヒビクヒトウチハ、マタヒトツノトキガスギタコトヲツゲテイタ。",
        "Deep, nostalgic, measured chronicle narrator; warm yet wistful tone, pausing gently between sentences as if listening to a distant bell.",
        "<breath> 道という道が灰に埋もれる前、<short pause> ヴェアホルドの人々は鐘の音で日々を測っていた。<long pause> 塔から響くひと打ちは、<short pause> またひとつの刻が過ぎたことを告げていた。",
        "<speak><prosody rate=\"91%\" pitch=\"-1.0st\">道という道が灰に埋もれる前、<break time=\"320ms\"/>ヴェアホルドの人々は鐘の音で日々を測っていた。<break time=\"680ms\"/>塔から響くひと打ちは、<break time=\"280ms\"/>またひとつの刻が過ぎたことを告げていた。</prosody></speak>",
        0.91, -1.0, 9.8
    ),
    (
        "entry_past_002", "prologue_names", "narrator", "intimate_dignity",
        "00:12–00:26 | Yol kenarı kayıt defteri (`prologue_village_names`) sahnesine geçişte, tüy kalem defterden kalkarken.",
        "İnsanların unutulmamak için bıraktığı küçük izleri derin bir saygı ve mahremiyetle anlatır; '名声のためではない' cümlesini yumuşak ama net vurgular.",
        "People carved their names on doors and trees, and wrote them in roadside registers. Not for fame. So someone would remember that they had been here.",
        "人々は扉や樹々に自らの名を刻み、道端の台帳にその名を書き残した。名声のためではない。確かにここに生きていたと、誰かが覚えていてくれるように。",
        "ヒトビトハトビラヤキギニミズカラノナヲキザミ、ミチバタノダイチョウニソノナヲカキノコシタ。メイセイノタメデハナイ。タシカニココニイキテイタト、ダレカガオボエテイテクレルヨウニ。",
        "Intimate, hushed dignity; gentle emphasis on 'not for fame', softening into tender reverence on the final clause.",
        "人々は扉や樹々に自らの名を刻み、<short pause> 道端の台帳にその名を書き残した。<long pause> 名声のためではない。<short pause> 確かにここに生きていたと、<short pause> 誰かが覚えていてくれるように。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.8st\">人々は扉や樹々に自らの名を刻み、<break time=\"300ms\"/>道端の台帳にその名を書き残した。<break time=\"620ms\"/></prosody><prosody rate=\"88%\" pitch=\"-1.2st\">名声のためではない。<break time=\"480ms\"/>確かにここに生きていたと、<break time=\"260ms\"/>誰かが覚えていてくれるように。</prosody></speak>",
        0.90, -1.0, 10.4
    ),
    (
        "entry_past_003", "prologue_ordinary_days", "narrator", "warm_to_foreboding",
        "00:26–00:38 | Kasaba sokağında ekmek paylaşan insanlar (`prologue_village_ordinary_days`) görselinde.",
        "İlk cümlede sıradan günlerin sıcaklığını hissettirir; 'それを失い始める日が来るまでは' kısmında ise sesi koyulaşır ve yaklaşan yıkımın gölgesini taşır.",
        "There were markets, journeys, and doors that opened to strangers. Small things, easily forgotten. Until the day people began to lose them.",
        "市が立ち、旅人が行き交い、見知らぬ者にも扉は開かれていた。すぐに忘れ去られるような、ささやかな日常。……それを失い始める日が来るまでは。",
        "イチガタチ、タビビトガイキカイ、ミシラヌモノニモトビラハヒラカレテイタ。スグニワスレサラレルヨウナ、ササヤカナニチジョウ。ソレヲウシナイハジメルヒガクルマデハ。",
        "Warm and reflective at first, then slowing down and darkening with quiet foreboding on the final clause.",
        "市が立ち、旅人が行き交い、<short pause> 見知らぬ者にも扉は開かれていた。<short pause> すぐに忘れ去られるような、ささやかな日常。<long pause> <exhales> それを失い始める日が来るまでは。",
        "<speak><prosody rate=\"93%\" pitch=\"-0.5st\">市が立ち、旅人が行き交い、<break time=\"260ms\"/>見知らぬ者にも扉は開かれていた。<break time=\"450ms\"/>すぐに忘れ去られるような、ささやかな日常。</prosody><break time=\"750ms\"/><prosody rate=\"85%\" pitch=\"-1.8st\">それを失い始める日が来るまでは。</prosody></speak>",
        0.90, -1.1, 9.6
    ),
    (
        "entry_past_004", "prologue_throne_wars", "narrator", "grave_chronicle",
        "00:38–00:50 | Terk edilmiş tarlalar ve göç eden aileler (`prologue_crownfall_throne_wars`) sahnesinde, yaylılar gerilirken.",
        "Taht Savaşları'nın ağırlığını kısa, keskin ve ciddi cümlelerle aktarır; panik yapmadan, tarihin kaçınılmaz akışı gibi tok bir sesle konuşur.",
        "The great houses fought over a throne. Fields emptied. Families took to the roads, carrying what they could. The war drew closer to the capital.",
        "諸侯はひとつの玉座を巡って争った。畑からは人が消え、家族は持てるものだけを抱えて街道へと出た。戦火は、やがて王都へと迫っていった。",
        "ショコウハヒトツノギョクザヲメグッテアラソッタ。ハタケカラハヒトガキエ、カゾクハモテルモノダケヲカカエテカイドウヘトデタ。センカハ、ヤガテオウトヘトセマッテイッタ。",
        "Low, grave, steady chronicle pace; crisp pauses between short sentences, conveying the gathering weight of war.",
        "諸侯はひとつの玉座を巡って争った。<short pause> 畑からは人が消え、<short pause> 家族は持てるものだけを抱えて街道へと出た。<long pause> 戦火は、<short pause> やがて王都へと迫っていった。",
        "<speak><prosody rate=\"91%\" pitch=\"-1.4st\">諸侯はひとつの玉座を巡って争った。<break time=\"420ms\"/>畑からは人が消え、<break time=\"280ms\"/>家族は持てるものだけを抱えて街道へと出た。<break time=\"580ms\"/>戦火は、<break time=\"260ms\"/>やがて王都へと迫っていった。</prosody></speak>",
        0.91, -1.4, 9.8
    ),
    (
        "entry_past_005", "prologue_crownfall", "narrator", "solemn_tragedy",
        "00:50–01:06 | Yıkık başkent kapısı ve dumanlar (`prologue_crownfall_crownfall`) sahnesinde, ağır cenaze çanı vuruşunun hemen ardından.",
        "Prologue'un en ağır kırılma noktası (Crownfall). Melodram yapmadan, bastırılmış derin bir keder ve tarihi ağırlıkla konuşur.",
        "Then came Crownfall. The capital fell. The king died. By dawn, survivors were leaving behind streets they had once known by heart.",
        "そして、『王冠落ち』の日が訪れた。王都は陥ち、王は斃れた。夜が明ける頃、生き残った者たちは、かつて知り尽くしていたはずの街路を後にした。",
        "ソシテ、オウカンオチノヒガオトズレタ。オウトハオチ、オウハタオレタ。ヨルガアケルコロ、イキノコッタモノタチハ、カツテシリツクシテイタハズノガイロヲアトニシタ。",
        "Solemn, heavy bass resonance after a funeral bell; short, devastating clauses delivered with restrained grief and zero melodrama.",
        "<breath> そして、<short pause> 『王冠落ち』の日が訪れた。<long pause> 王都は陥ち、<short pause> 王は斃れた。<long pause> 夜が明ける頃、<short pause> 生き残った者たちは、かつて知り尽くしていたはずの街路を後にした。",
        "<speak><prosody rate=\"86%\" pitch=\"-2.0st\">そして、<break time=\"340ms\"/>『王冠落ち』の日が訪れた。<break time=\"680ms\"/>王都は陥ち、<break time=\"380ms\"/>王は斃れた。<break time=\"720ms\"/>夜が明ける頃、<break time=\"300ms\"/>生き残った者たちは、かつて知り尽くしていたはずの街路を後にした。</prosody></speak>",
        0.86, -2.0, 11.5
    ),
    (
        "entry_past_006", "prologue_roads", "narrator", "hushed_sorrow",
        "01:06–01:22 | Sisli yolda sırtlarında battaniyelerle yürüyen sağ kalanlar (`prologue_crownfall_roads`) görselinde.",
        "Kayıpların ardından kalan boşluğu fısıltıya yakın, duru bir hüzünle anlatır; '帰るべき家はもうなかった' cümlesi sessizliğe karışır.",
        "They carried blankets, tools, and the names of those who had not come with them. Beyond the walls, the roads were still there. Home was not.",
        "彼らが背負ったのは、毛布と道具、そして共に来られなかった者たちの名だった。城壁の向こうに道はまだ続いていた。だが、帰るべき家はもうなかった。",
        "カレラガセオッタノハ、モウフトドウグ、ソシテトモニコラレナカッタモノタチノナダッタ。ジョウヘキノムコウニミチハマダツヅイテイタ。ダガ、カエルベキイエハモウナカッタ。",
        "Hushed, sparse sorrow; unhurried delivery that drops to a near-whisper on the final sentence 'Home was not'.",
        "彼らが背負ったのは、<short pause> 毛布と道具、<short pause> そして共に来られなかった者たちの名だった。<long pause> 城壁の向こうに道はまだ続いていた。<long pause> <sigh> だが、<short pause> 帰るべき家はもうなかった。",
        "<speak><prosody rate=\"88%\" pitch=\"-1.5st\">彼らが背負ったのは、<break time=\"260ms\"/>毛布と道具、<break time=\"300ms\"/>そして共に来られなかった者たちの名だった。<break time=\"640ms\"/>城壁の向こうに道はまだ続いていた。<break time=\"680ms\"/></prosody><prosody rate=\"83%\" pitch=\"-2.2st\">だが、<break time=\"320ms\"/>帰るべき家はもうなかった。</prosody></speak>",
        0.87, -1.6, 11.2
    ),
    (
        "entry_past_007", "prologue_search", "narrator", "resolute_warmth",
        "01:22–01:36 | Kış hanında mum ışığında kayıt defterine bakan Mahmut (`prologue_village_search`) sahnesinde, yürüyen çello motifi başlarken.",
        "Yıkımın içinden doğan sadakat ve arayış. Mahmut'un kışlar boyu süren sabırlı arayışını anlatırken sese dingin bir sıcaklık ve kararlılık gelir.",
        "Among the travelers was a knight who searched the village registers for one name. Village after village, winter after winter, he kept looking.",
        "旅人たちのなかに、ただひとつの名を求めて村々の台帳を辿る騎士がいた。村から村へ、冬から冬へと、彼は探し続けた。",
        "タビビトタチノナカニ、タダヒトツノナヲモトメテムラムラノダイチョウヲタドルキシガイタ。ムラカラムラヘ、フユカラフユヘト、カレハサガシツヅケタ。",
        "Steady, resolute baritone with quiet warmth entering the voice, matching the rhythm of a solitary knight walking through winter.",
        "旅人たちのなかに、<short pause> ただひとつの名を求めて村々の台帳を辿る騎士がいた。<long pause> 村から村へ、<short pause> 冬から冬へと、<short pause> 彼は探し続けた。",
        "<speak><prosody rate=\"91%\" pitch=\"-1.0st\">旅人たちのなかに、<break time=\"300ms\"/>ただひとつの名を求めて村々の台帳を辿る騎士がいた。<break time=\"620ms\"/>村から村へ、<break time=\"320ms\"/>冬から冬へと、<break time=\"280ms\"/>彼は探し続けた。</prosody></speak>",
        0.91, -1.0, 9.6
    ),
    (
        "entry_past_008", "prologue_reunion", "narrator", "tender_relief",
        "01:36–01:48 | Yamaç köyünde Fadyme ve Mahmut'un yeniden karşılaşması (`prologue_road_reunion`), gümüş çan ve piyano tınısı.",
        "Uzun arayışın sonundaki sessiz kavuşma. Ses yumuşar, '彼は頷いた' kısmında derin bir huzur ve şefkat hissedilir.",
        "In a hill village, he found her. She asked him to stay. He did. The road ahead would no longer be hers alone.",
        "ある丘の村で、彼はついに彼女を見つけた。傍にいてほしいと彼女は願い、彼は頷いた。その先の道は、もはや彼女ひとりのものではなくなった。",
        "アルオカノムラデ、カレハツイニカノジョヲミツケタ。ソバニイテホシイトカノジョハネガイ、カレハウナズイタ。ソノサキノミチハ、モハヤカノジョヒトリノモノデハナクナッタ。",
        "Gentle relief and understated tenderness; soft, warm pacing as the two companions reunite.",
        "<breath> ある丘の村で、<short pause> 彼はついに彼女を見つけた。<long pause> 傍にいてほしいと彼女は願い、<short pause> 彼は頷いた。<long pause> その先の道は、<short pause> もはや彼女ひとりのものではなくなった。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.6st\">ある丘の村で、<break time=\"280ms\"/>彼はついに彼女を見つけた。<break time=\"580ms\"/>傍にいてほしいと彼女は願い、<break time=\"360ms\"/>彼は頷いた。<break time=\"620ms\"/>その先の道は、<break time=\"280ms\"/>もはや彼女ひとりのものではなくなった。</prosody></speak>",
        0.90, -0.6, 9.8
    ),
    (
        "entry_past_009", "prologue_beginning", "narrator", "poised_threshold",
        "01:48–02:00 | Fadyme ve Mahmut'un Fısıldayan Kül Ormanı'na birlikte yürüyüşü (`prologue_road_beginning`), müzik son akora doğru çözülürken.",
        "Prologue'u oyunun ilk sahnesine bağlayan eşik. İkisinin birbirine henüz söylemediği sırları ima ederken gizemli, ağırbaşlı ve davetkâr bir kapanış yapar.",
        "Now Fadyme and Mahmut walk together. The bells still ring. Neither has told the other everything. This is where their story begins.",
        "いま、ファディメとマフムトは共に歩いている。鐘はいまも鳴り響き、ふたりはまだ互いのすべてを語ってはいない。……ここから、ふたりの物語が始まる。",
        "イマ、ファディメトマフムトハトモニアルイテイル。カネハイマモナリヒビキ、フタリハマダタガイノスベテヲカタッテハイナイ。ココカラ、フタリノモノガタリガハジマル。",
        "Poised, lingering closing cadence; measured mystery on 'neither has told the other everything', then a resonant pause before the final line.",
        "いま、<short pause> ファディメとマフムトは共に歩いている。<short pause> 鐘はいまも鳴り響き、<short pause> ふたりはまだ互いのすべてを語ってはいない。<long pause> <breath> ここから、<short pause> ふたりの物語が始まる。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.8st\">いま、<break time=\"240ms\"/>ファディメとマフムトは共に歩いている。<break time=\"480ms\"/>鐘はいまも鳴り響き、<break time=\"300ms\"/>ふたりはまだ互いのすべてを語ってはいない。<break time=\"820ms\"/></prosody><prosody rate=\"86%\" pitch=\"-1.2st\">ここから、<break time=\"320ms\"/>ふたりの物語が始まる。</prosody></speak>",
        0.89, -1.0, 10.2
    ),

    # ==================== TUTORIAL T-1 BEFORE: THE FIRST STEP (14 LINES) ====================
    (
        "tutorial_t1_before_001", "tutorial_t1_before", "narrator", "watchful_atmosphere",
        "Sahne T-1 Açılışı | Fısıldayan Kül Ormanı (`forest_whispering_ash`) ekrana gelir; Mahmut solda, Fadyme sağda.",
        "Akşamüstü ağaçların arasındaki son ışığı ve ikilinin birbirine uyum sağlamaya başlayan ayak seslerini dingin bir kronik tonuyla anlatır.",
        "The last light lay between the trees. Their footsteps had almost found the same rhythm.",
        "最後の光が木々のあいだに落ちていた。ふたりの足音は、ほとんど同じ歩調を見出しつつあった。",
        "サイゴノヒカリガキギノアイダニオチテイタ。フタリノアシオトハ、ホトンドオナジホチョウヲミイダシツツアッタ。",
        "Calm, atmospheric chronicle narration; hushed dusk stillness as two companions find a shared walking rhythm.",
        "最後の光が木々のあいだに落ちていた。<long pause> ふたりの足音は、<short pause> ほとんど同じ歩調を見出しつつあった。",
        "<speak><prosody rate=\"91%\" pitch=\"-1.0st\">最後の光が木々のあいだに落ちていた。<break time=\"520ms\"/>ふたりの足音は、<break time=\"260ms\"/>ほとんど同じ歩調を見出しつつあった。</prosody></speak>",
        0.91, -1.0, 6.2
    ),
    (
        "tutorial_t1_before_002", "tutorial_t1_before", "mahmut", "watchful",
        "Mahmut'un oyundaki ilk repliği | Yolu kontrol ederek Fadyme'yi uyarır (`watchful` portresi).",
        "Pratik ve dikkatli bir şövalye; çamurun derinleştiğini söyleyerek Fadyme'yi taşların üzerinden yürümeye yönlendirir.",
        "Keep to the stones. The mud gets deeper ahead.",
        "敷石の上を歩け。この先は泥が深くなる。",
        "シキイシノウエヲアルケ。コノサキハドロガフカクナル。",
        "Low, watchful baritone; grounded, practical guidance spoken quietly while scanning the road ahead.",
        "敷石の上を歩け。<short pause> この先は泥が深くなる。",
        "<speak><prosody rate=\"94%\" pitch=\"-0.9st\">敷石の上を歩け。<break time=\"340ms\"/>この先は泥が深くなる。</prosody></speak>",
        0.94, -0.9, 3.6
    ),
    (
        "tutorial_t1_before_003", "tutorial_t1_before", "fadyme", "dry_amusement",
        "Fadyme'nin oyundaki ilk repliği | Taşların da pek güvenli olmadığını ince bir espriyle söyler (`dry_amusement`).",
        "Yorgunluğunu belli etmeden, taşların zaten çizmesinin tekini çamura batırdığını zarif bir alayla dile getirir.",
        "The stones have already claimed one boot.",
        "その石にも、もう靴を片方取られたわ。",
        "ソノイシニモ、モウクツヲカタホウトラレタワ。",
        "Light, poised alto with dry, aristocratic amusement; gently teasing her companion without complaining.",
        "<chuckle> その石にも、<short pause> もう靴を片方取られたわ。",
        "<speak><prosody rate=\"94%\" pitch=\"+0.3st\">その石にも、<break time=\"240ms\"/>もう靴を片方取られたわ。</prosody></speak>",
        0.94, 0.3, 3.4
    ),
    (
        "tutorial_t1_before_004", "tutorial_t1_before", "mahmut", "dry_humor",
        "Mahmut Fadyme'nin çizmelerine kısa bir bakış atıp yarım ağız gülümser (`dry_humor`).",
        "Fadyme'nin abartılı esprisine tam bir asker gerçekçiliğiyle karşılık verir: 'İki çizmen de hâlâ ayağında.'",
        "Both boots are still with us.",
        "まだ両方とも、ちゃんと履いているだろう。",
        "マダリョウホウトモ、チャントハイテイルダロウ。",
        "Deadpan, fond dry humor in a low baritone; a faint wry smile in the voice.",
        "<exhales> まだ両方とも、<short pause> ちゃんと履いているだろう。",
        "<speak><prosody rate=\"95%\" pitch=\"-0.6st\">まだ両方とも、<break time=\"240ms\"/>ちゃんと履いているだろう。</prosody></speak>",
        0.95, -0.6, 3.2
    ),
    (
        "tutorial_t1_before_005", "tutorial_t1_before", "fadyme", "soft_smile",
        "Fadyme yumuşak bir tebessümle karşılık verir (`soft_smile`).",
        "Mahmut'un felaketleri sayarkenki sakin ve güven veren tavrını takdir eder.",
        "You have a comforting way of counting disasters.",
        "災難を数えるのが、お上手ね。安心できる数え方だわ。",
        "サイナンヲカゾエルノガ、オジョウズネ。アンシンデキルカゾエカタダワ。",
        "Warm, wryly affectionate alto; unhurried pause between sentences with a soft smile.",
        "災難を数えるのが、お上手ね。<short pause> 安心できる数え方だわ。",
        "<speak><prosody rate=\"93%\" pitch=\"+0.3st\">災難を数えるのが、お上手ね。<break time=\"360ms\"/>安心できる数え方だわ。</prosody></speak>",
        0.93, 0.3, 4.4
    ),
    (
        "tutorial_t1_before_006", "tutorial_t1_before", "mahmut", "watchful",
        "Sahne Aksiyonu | Mahmut gevşek bir taşı fark edip elini Fadyme'ye uzatır (`MAHMUT EXTENDS HIS HAND ACROSS THE WET STONES`).",
        "Gösterişsiz bir koruyuculukla gevşek taşı işaret eder ve elini uzatır.",
        "That one is loose. Give me your hand.",
        "その石は緩んでいる。手を貸せ。",
        "ソノイシハユルンデイル。テヲカセ。",
        "Quiet, steady, protective baritone; simple and direct as he reaches out his hand.",
        "その石は緩んでいる。<short pause> 手を貸せ。",
        "<speak><prosody rate=\"94%\" pitch=\"-0.8st\">その石は緩んでいる。<break time=\"300ms\"/>手を貸せ。</prosody></speak>",
        0.94, -0.8, 2.9
    ),
    (
        "tutorial_t1_before_007", "tutorial_t1_before", "fadyme", "dry_amusement",
        "Fadyme elini uzatmadan önce başını hafifçe yana eğer (`dry_amusement`).",
        "Sadece bu taşı geçmek için mi yoksa bütün yolculuk boyunca mı elini tutmak istediğini sorarak tatlı bir imada bulunur.",
        "For the stone, or for the whole road?",
        "その石を渡る間だけ？　それとも、この道の終わりまで？",
        "ソノイシヲワタルアイダダケ？　ソレトモ、コノミチノオワリマデ？",
        "Playful, teasing alto with quiet intimacy; pausing between the two questions.",
        "その石を渡る間だけ？ <short pause> それとも、<short pause> この道の終わりまで？",
        "<speak><prosody rate=\"93%\" pitch=\"+0.4st\">その石を渡る間だけ？<break time=\"380ms\"/>それとも、<break time=\"220ms\"/>この道の終わりまで？</prosody></speak>",
        0.93, 0.4, 4.2
    ),
    (
        "tutorial_t1_before_008", "tutorial_t1_before", "mahmut", "dry_humor",
        "Mahmut elini indirmeden sakin ama anlamlı bir cevap verir (`dry_humor`).",
        "'Önce bir taşı geçelim de' derken aslında yolun sonuna kadar yanında olacağını ima eder.",
        "The stone first.",
        "まずは、その石からだ。",
        "マズハ、ソノイシカラダ。",
        "Low, warm baritone with understated dry humor; unhurried and quietly fond.",
        "まずは、<short pause> その石からだ。",
        "<speak><prosody rate=\"92%\" pitch=\"-0.7st\">まずは、<break time=\"240ms\"/>その石からだ。</prosody></speak>",
        0.92, -0.7, 2.4
    ),
    (
        "tutorial_t1_before_009", "tutorial_t1_before", "narrator", "intimate_lingering",
        "Sahne Aksiyonu | Fadyme onun elini tutar (`HAND IN HAND ACROSS THE SLIPPERY CROSSING`).",
        "Karşıya geçtiklerinde ikisinin de ellerini hemen bırakmadığını zarif ve sıcak bir gözlemle anlatır.",
        "She took his hand. On the other side, neither let go quite as promptly as the crossing required.",
        "彼女は彼の手を取った。渡り終えた向こう側でも、ふたりとも、その場に必要なほどすぐには手を離さなかった。",
        "カノジョハカレノテヲトッタ。ワタリオエタムコウガワデモ、フタリトモ、ソノバニヒツヨウナホドスグニハテヲハナサナカッタ。",
        "Gentle, observant chronicle narration; warm and unhurried, letting the quiet closeness linger.",
        "彼女は彼の手を取った。<long pause> 渡り終えた向こう側でも、<short pause> ふたりとも、その場に必要なほどすぐには手を離さなかった。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.8st\">彼女は彼の手を取った。<break time=\"520ms\"/>渡り終えた向こう側でも、<break time=\"260ms\"/>ふたりとも、その場に必要なほどすぐには手を離さなかった。</prosody></speak>",
        0.90, -0.8, 6.8
    ),
    (
        "tutorial_t1_before_010", "tutorial_t1_before", "fadyme", "dry_amusement",
        "Fadyme elini yavaşça çekerken gülümser (`dry_amusement`).",
        "Aradaki duygusal yakınlığı zarif bir şakayla örter.",
        "There. An excellent rescue. Very little applause, unfortunately.",
        "ほら、見事な救出だったわ。残念ながら、拍手はほとんどないけれど。",
        "ホラ、ミゴトナキュウシュツダッタワ。ザンネンナガラ、ハクシュハホトンドナイケレド。",
        "Light, witty alto; covering a tender moment with charming dry humor.",
        "ほら、見事な救出だったわ。<short pause> 残念ながら、<short pause> 拍手はほとんどないけれど。",
        "<speak><prosody rate=\"94%\" pitch=\"+0.3st\">ほら、見事な救出だったわ。<break time=\"360ms\"/>残念ながら、<break time=\"220ms\"/>拍手はほとんどないけれど。</prosody></speak>",
        0.94, 0.3, 4.8
    ),
    (
        "tutorial_t1_before_011", "tutorial_t1_before", "mahmut", "dry_humor",
        "Mahmut hafifçe gülümser (`dry_humor`).",
        "Alkışa ihtiyacı olmadığını sakin ve tok bir sesle söyler.",
        "We can live with that.",
        "それくらいは、我慢できるさ。",
        "ソレクライハ、ガマンデキルサ。",
        "Relaxed, warm low baritone; dryly content.",
        "それくらいは、<short pause> 我慢できるさ。",
        "<speak><prosody rate=\"94%\" pitch=\"-0.6st\">それくらいは、<break time=\"240ms\"/>我慢できるさ。</prosody></speak>",
        0.94, -0.6, 2.8
    ),
    (
        "tutorial_t1_before_012", "tutorial_t1_before", "narrator", "sudden_tension",
        "Sahne Aksiyonu | İlerideki taşlardan sürtünme sesi gelir (`BELLBOUND DEAD APPROACH IN THE MIST`).",
        "Sıcak sohbeti aniden kesen tehlike; Mahmut'un Fadyme daha cümlesini bitirmeden tehdide doğru dönüşünü anlatır.",
        "Something scraped across the stones ahead. Mahmut turned before she could make another remark.",
        "前方の敷石の上で、何かが擦れる音がした。彼女が次の軽口を叩くより早く、マフムトは身を翻した。",
        "ゼンポウノシキイシノウエデ、ナニカガコスレルオトガシタ。カノジョガツギノカルグチヲタタクヨリハヤク、マフムトハミヲヒルガエシタ。",
        "Sudden shift to taut, alert chronicle narration; slightly faster pace on the second sentence as Mahmut turns.",
        "前方の敷石の上で、<short pause> 何かが擦れる音がした。<long pause> 彼女が次の軽口を叩くより早く、<short pause> マフムトは身を翻した。",
        "<speak><prosody rate=\"92%\" pitch=\"-1.3st\">前方の敷石の上で、<break time=\"260ms\"/>何かが擦れる音がした。<break time=\"480ms\"/>彼女が次の軽口を叩くより早く、<break time=\"240ms\"/>マフムトは身を翻した。</prosody></speak>",
        0.92, -1.3, 6.6
    ),
    (
        "tutorial_t1_before_013", "tutorial_t1_before", "mahmut", "protective",
        "Mahmut kalkanını kaldırıp öne çıkar (`protective`).",
        "Sesi anında savaş ciddiyetine bürünür; iki düşmanı saptar ve Fadyme'yi duvar kenarına yönlendirir.",
        "Two of them. Stay beside the wall.",
        "二体いる。壁のそばを離れるな。",
        "ニタイイル。カベノソバヲハナレルナ。",
        "Firm, protective combat baritone; low, urgent, and commanding without shouting.",
        "二体いる。<short pause> 壁のそばを離れるな。",
        "<speak><prosody rate=\"96%\" pitch=\"-1.1st\">二体いる。<break time=\"300ms\"/>壁のそばを離れるな。</prosody></speak>",
        0.96, -1.1, 3.1
    ),
    (
        "tutorial_t1_before_014", "tutorial_t1_before", "fadyme", "determined",
        "T-1 Savaşı Öncesi Son Replik | Fadyme Mahmut'un yanına yerleşir (`determined`, `STANDING SIDE BY SIDE`).",
        "Mahmut'un 'arkamda saklan' demeyip 'duvarın yanında dur' demesini takdir eder; sırtının arkasında değil, omuz omuza savaşacağını vurgular.",
        "Beside it. Not behind you. I know the difference.",
        "壁の横ね。あなたの後ろじゃなくて。その違いは分かっているわ。",
        "カベノヨコネ。アナタノウシロジャナクテ。ソノチガイハワカッテイルワ。",
        "Clear, resolute alto with poised pride; crisp pauses between short sentences as she steps into battle beside him.",
        "壁の横ね。<short pause> あなたの後ろじゃなくて。<short pause> その違いは分かっているわ。",
        "<speak><prosody rate=\"95%\" pitch=\"-0.2st\">壁の横ね。<break time=\"280ms\"/>あなたの後ろじゃなくて。<break time=\"320ms\"/>その違いは分かっているわ。</prosody></speak>",
        0.95, -0.2, 4.5
    ),

    # ==================== TUTORIAL T-1 AFTER: THE FIRST STEP (14 LINES) ====================
    (
        "tutorial_t1_after_001", "tutorial_t1_after", "narrator", "calm_aftermath",
        "T-1 Savaşı Sonrası Açılış | Yol tekrar sessizleşir.",
        "İlk çarpışmanın ardından çöken sessizliği ve ikilinin hareket etmeden önce etrafı dinleyişini anlatır.",
        "The road grew quiet again. This time they listened to the silence before moving.",
        "街道に再び静けさが戻った。今度はふたりとも、動き出す前にその沈黙に耳を澄ませた。",
        "カイドウニフタタビシズケサガモドッタ。コンドハフタリトモ、ウゴキダスマエニソノチンモクニミミヲスマセタ。",
        "Hushed, unhurried post-battle narration; letting the silence settle.",
        "<breath> 街道に再び静けさが戻った。<long pause> 今度はふたりとも、<short pause> 動き出す前にその沈黙に耳を澄ませた。",
        "<speak><prosody rate=\"90%\" pitch=\"-1.0st\">街道に再び静けさが戻った。<break time=\"520ms\"/>今度はふたりとも、<break time=\"260ms\"/>動き出す前にその沈黙に耳を澄ませた。</prosody></speak>",
        0.90, -1.0, 6.2
    ),
    (
        "tutorial_t1_after_002", "tutorial_t1_after", "mahmut", "watchful",
        "Mahmut hemen Fadyme'ye döner (`watchful`).",
        "Savaş biter bitmez ilk düşüncesi Fadyme'nin yaralanıp yaralanmadığıdır.",
        "Are you hurt?",
        "怪我はないか？",
        "ケガハナイカ？",
        "Immediate, quiet concern; low baritone asking simply and directly.",
        "<breath> 怪我はないか？",
        "<speak><prosody rate=\"94%\" pitch=\"-0.7st\">怪我はないか？</prosody></speak>",
        0.94, -0.7, 1.8
    ),
    (
        "tutorial_t1_after_003", "tutorial_t1_after", "fadyme", "dry_amusement",
        "Fadyme sakin bir tebessümle karşılık verir (`dry_amusement`).",
        "Yaralanmadığını, sadece bu berbat yola dair fikrinin yara aldığını söyleyerek Mahmut'u rahatlatır.",
        "Only my opinion of this road.",
        "この道への評価だけ、傷ついたわ。",
        "コノミチヘノヒョウカダケ、キズツイタワ。",
        "Light, dryly amused alto; reassuring him with effortless wit.",
        "この道への評価だけ、<short pause> 傷ついたわ。",
        "<speak><prosody rate=\"94%\" pitch=\"+0.3st\">この道への評価だけ、<break time=\"260ms\"/>傷ついたわ。</prosody></speak>",
        0.94, 0.3, 3.2
    ),
    (
        "tutorial_t1_after_004", "tutorial_t1_after", "mahmut", "watchful",
        "Mahmut dikkatle Fadyme'nin koluna bakar (`watchful`).",
        "Fadyme'nin elbisesinin kolundaki izi fark eder; gözünden hiçbir şey kaçmaz.",
        "Your sleeve.",
        "……袖が。",
        "ソデガ。",
        "Observant, low baritone; brief and attentive as he notices a tear or leaf on her sleeve.",
        "<short pause> 袖が。",
        "<speak><prosody rate=\"92%\" pitch=\"-0.9st\"><break time=\"200ms\"/>袖が。</prosody></speak>",
        0.92, -0.9, 1.6
    ),
    (
        "tutorial_t1_after_005", "tutorial_t1_after", "fadyme", "dry_amusement",
        "Fadyme koluna bakıp zarifçe geçiştirir (`dry_amusement`).",
        "Sadece bir dalın takıldığını, ağacın çok 'kaba' olduğunu söyleyerek konuyu hafifletir.",
        "A branch. It has dreadful manners.",
        "枝よ。ひどく行儀の悪い枝だったわ。",
        "エダヨ。ヒドクギョウギノワルイエダダッタワ。",
        "Poised, dryly humorous alto; speaking of a forest branch as if it were an impolite guest.",
        "枝よ。<short pause> ひどく行儀の悪い枝だったわ。",
        "<speak><prosody rate=\"94%\" pitch=\"+0.3st\">枝よ。<break time=\"300ms\"/>ひどく行儀の悪い枝だったわ。</prosody></speak>",
        0.94, 0.3, 3.4
    ),
    (
        "tutorial_t1_after_006", "tutorial_t1_after", "narrator", "tender_gesture",
        "Sahne Aksiyonu | Mahmut uzanıp onun omzundaki yırtık yaprağı alır (`HE BRUSHES A TORN ASH LEAF FROM HER SHOULDER`).",
        "Mahmut'un şefkatli hareketini ve hemen ardından utangaçlığını gizlemek için kalkanını kontrol edişini anlatır.",
        "He brushed a torn leaf from her shoulder, then found a reason to check his shield.",
        "彼は彼女の肩からちぎれた葉を払い、それから盾を確かめる口実を見つけた。",
        "カレハカノジョノカタカラチギレタハヲハライ、ソレカラタテヲタシカメルコウジツヲミツケタ。",
        "Warm, subtly perceptive chronicle narration; gentle and unhurried.",
        "彼は彼女の肩からちぎれた葉を払い、<short pause> それから盾を確かめる口実を見つけた。",
        "<speak><prosody rate=\"91%\" pitch=\"-0.8st\">彼は彼女の肩からちぎれた葉を払い、<break time=\"340ms\"/>それから盾を確かめる口実を見つけた。</prosody></speak>",
        0.91, -0.8, 5.4
    ),
    (
        "tutorial_t1_after_007", "tutorial_t1_after", "mahmut", "composed",
        "Mahmut kalkanına bakarken sakin bir sesle teklif eder (`composed`).",
        "Fadyme'nin yorulmuş olabileceğini düşünerek hemen orada mola vermeyi önerir.",
        "We can rest here.",
        "ここで休んでいってもいい。",
        "ココデヤスンデイッテモイイ。",
        "Quiet, considerate low baritone; offering rest without pressing.",
        "ここで休んでいってもいい。",
        "<speak><prosody rate=\"93%\" pitch=\"-0.8st\">ここで休んでいってもいい。</prosody></speak>",
        0.93, -0.8, 2.5
    ),
    (
        "tutorial_t1_after_008", "tutorial_t1_after", "fadyme", "dry_amusement",
        "Fadyme çamurlu yola bakıp gülümser (`dry_amusement`).",
        "Çamurun ortasında dinlenme teklifini tatlı bir alayla geri çevirir.",
        "In the mud? I was hoping your invitation would improve.",
        "泥の中で？　もう少し素敵なお誘いを期待していたのに。",
        "ドロノナカデ？　モウスコシステキナオサソイヲキタイシテイタノニ。",
        "Playful, teasing alto; gentle lift on 'In the mud?', followed by warm dry wit.",
        "泥の中で？ <short pause> <chuckle> もう少し素敵なお誘いを期待していたのに。",
        "<speak><prosody rate=\"94%\" pitch=\"+0.4st\">泥の中で？<break time=\"340ms\"/>もう少し素敵なお誘いを期待していたのに。</prosody></speak>",
        0.94, 0.4, 4.4
    ),
    (
        "tutorial_t1_after_009", "tutorial_t1_after", "mahmut", "dry_humor",
        "Mahmut hafifçe gülümseyerek teklifini günceller (`dry_humor`).",
        "Fadyme'nin şakasına ayak uydurur: 'Öyleyse kuru bir taş buluruz.'",
        "A dry stone, then.",
        "なら、乾いた石の上だ。",
        "ナラ、カワイタイシノウエダ。",
        "Dry, warm baritone comeback; brief and fond.",
        "なら、<short pause> 乾いた石の上だ。",
        "<speak><prosody rate=\"94%\" pitch=\"-0.6st\">なら、<break time=\"220ms\"/>乾いた石の上だ。</prosody></speak>",
        0.94, -0.6, 2.4
    ),
    (
        "tutorial_t1_after_010", "tutorial_t1_after", "fadyme", "soft_smile",
        "Fadyme'nin gülümsemesi yumuşar (`soft_smile`).",
        "Kuru bir taşın cazip olduğunu, üstüne bir de çatı olursa karşı konulmaz olacağını söyler.",
        "Tempting. A roof would make it irresistible.",
        "魅力的ね。屋根まであれば、断れなくなりそう。",
        "ミリョクテキネ。ヤネマデアレバ、コトワレナクナリソウ。",
        "Warm, charming alto with a soft smile; light and unhurried.",
        "魅力的ね。<short pause> 屋根まであれば、<short pause> 断れなくなりそう。",
        "<speak><prosody rate=\"93%\" pitch=\"+0.3st\">魅力的ね。<break time=\"320ms\"/>屋根まであれば、<break time=\"220ms\"/>断れなくなりそう。</prosody></speak>",
        0.93, 0.3, 4.0
    ),
    (
        "tutorial_t1_after_011", "tutorial_t1_after", "mahmut", "watchful",
        "Mahmut ilerideki yolu süzer (`watchful`).",
        "İleride bir sığınak olacağını söyler ama Fadyme ihtiyaç duyarsa hemen duracaklarını vurgular.",
        "There should be shelter farther along. We stop if you need to.",
        "もう少し進めば、雨風を凌げる場所があるはずだ。……だが、お前が休みたいならいつでも止まる。",
        "モウスコシススメバ、アマカゼヲシノゲルバショガアルハズダ。ダガ、オマエガヤスミタイナライツデモトマル。",
        "Steady, protective baritone; practical planning softened by attentive care for her stamina.",
        "もう少し進めば、雨風を凌げる場所があるはずだ。<long pause> だが、<short pause> お前が休みたいならいつでも止まる。",
        "<speak><prosody rate=\"93%\" pitch=\"-0.8st\">もう少し進めば、雨風を凌げる場所があるはずだ。<break time=\"480ms\"/>だが、<break time=\"240ms\"/>お前が休みたいならいつでも止まる。</prosody></speak>",
        0.93, -0.8, 6.2
    ),
    (
        "tutorial_t1_after_012", "tutorial_t1_after", "fadyme", "composed",
        "Fadyme sakin ama kararlı bir tonla düzeltir (`composed`).",
        "Sadece kendisi için değil, ikisinden biri yorulursa duracaklarını hatırlatır; eşit yoldaşlık anlaşmaları budur.",
        "If either of us needs to. That is the arrangement.",
        "どちらかが必要としたら、よ。そういう約束でしょう。",
        "ドチラカガヒツヨウトシタラ、ヨ。ソウイウヤクソクデショウ。",
        "Poised, earnest alto; gentle firmness reminding him that they look after each other equally.",
        "どちらかが必要としたら、よ。<short pause> そういう約束でしょう。",
        "<speak><prosody rate=\"93%\" pitch=\"0.0st\">どちらかが必要としたら、よ。<break time=\"340ms\"/>そういう約束でしょう。</prosody></speak>",
        0.93, 0.0, 4.0
    ),
    (
        "tutorial_t1_after_013", "tutorial_t1_after", "mahmut", "composed",
        "Mahmut başıyla onaylar (`composed`).",
        "Tek kelimelik, samimi ve ağırbaşlı bir kabul.",
        "Agreed.",
        "……ああ、そうだな。",
        "アア、ソウダナ。",
        "Soft, grounded baritone; quiet acceptance.",
        "<short pause> ああ、そうだな。",
        "<speak><prosody rate=\"91%\" pitch=\"-0.9st\"><break time=\"220ms\"/>ああ、そうだな。</prosody></speak>",
        0.91, -0.9, 2.0
    ),
    (
        "tutorial_t1_after_014", "tutorial_t1_after", "narrator", "warm_companionship",
        "T-1 Sonu | Mahmut adımlarını kısaltır (`MATCHING STRIDES ALONG THE ASH ROAD`).",
        "Mahmut'un Fadyme yorulmasın diye adımlarını kısalttığını ve Fadyme'nin bunu fark edip gururunu kırmamak için yüksek sesle teşekkür etmediğini anlatır.",
        "He shortened his stride. She noticed, and chose not to thank him for it aloud.",
        "彼は歩幅を詰めた。彼女はそれに気づいたが、あえて口に出して礼を言わないでおいた。",
        "カレハホハバヲツメタ。カノジョハソレニキヅイタガ、アエテクチニダシテレイヲイワナイデオイタ。",
        "Warm, intimate chronicle cadence; lingering tenderly on their unspoken understanding.",
        "彼は歩幅を詰めた。<long pause> 彼女はそれに気づいたが、<short pause> あえて口に出して礼を言わないでおいた。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.8st\">彼は歩幅を詰めた。<break time=\"480ms\"/>彼女はそれに気づいたが、<break time=\"260ms\"/>あえて口に出して礼を言わないでおいた。</prosody></speak>",
        0.90, -0.8, 6.0
    ),

    # ==================== TUTORIAL T-2 BEFORE: A ROAD FORGOTTEN (13 LINES) ====================
    (
        "tutorial_t2_before_001", "tutorial_t2_before", "narrator", "somber_discovery",
        "Sahne T-2 Açılışı | Unutulmuş Taş Kavşak (`forgotten_stone_crossing`); yalnız bir Hollow Pilgrim aşınmış taşların etrafında döner.",
        "Yolun daraldığı yerde aynı taşların etrafında ayağını sürüyerek dönüp duran yalnız hacıyı hüzünlü ve tekinsiz bir dille betimler.",
        "Where the path narrowed, a lone pilgrim dragged one foot around the same worn stones.",
        "道が細まる場所で、ひとりの巡礼者が同じ擦り減った石のまわりを、片足を引きずりながら巡っていた。",
        "ミチガホソマルバショデ、ヒトリノジュンレイシャガオナジスリヘッタイシノマワリヲ、カタアシヲヒキズリナガラメグッテイタ。",
        "Hushed, somber chronicle narration; slow and eerie rhythm matching a dragging footstep.",
        "道が細まる場所で、<short pause> ひとりの巡礼者が同じ擦り減った石のまわりを、<short pause> 片足を引きずりながら巡っていた。",
        "<speak><prosody rate=\"90%\" pitch=\"-1.1st\">道が細まる場所で、<break time=\"280ms\"/>ひとりの巡礼者が同じ擦り減った石のまわりを、<break time=\"260ms\"/>片足を引きずりながら巡っていた。</prosody></speak>",
        0.90, -1.1, 6.4
    ),
    (
        "tutorial_t2_before_002", "tutorial_t2_before", "mahmut", "watchful",
        "Mahmut hacının hareketlerini izler (`watchful`).",
        "Yaratığın aynı noktayı üç kez geçtiğini gözlemler; tehdit analizi yapar.",
        "It has crossed this patch three times.",
        "同じ場所を、もう三度も横切っている。",
        "オナジバショヲ、モウサンドモヨコギッテイル。",
        "Low, observant baritone; quiet, analytical soldier's tone.",
        "同じ場所を、<short pause> もう三度も横切っている。",
        "<speak><prosody rate=\"93%\" pitch=\"-1.0st\">同じ場所を、<break time=\"260ms\"/>もう三度も横切っている。</prosody></speak>",
        0.93, -1.0, 3.4
    ),
    (
        "tutorial_t2_before_003", "tutorial_t2_before", "fadyme", "composed",
        "Fadyme hacıyı sessizce izler (`composed`).",
        "Belki de eskiden yolun burada bittiğini söyleyerek hacının takılıp kalmışlığına hüzünlü bir anlam verir.",
        "Perhaps the road used to end here.",
        "昔は、ここが道の終わりだったのかもしれないわ。",
        "ムカシハ、ココガミチノオワリダッタノカモシレナイワ。",
        "Soft, contemplative alto; wistful and gently empathetic.",
        "昔は、<short pause> ここが道の終わりだったのかもしれないわ。",
        "<speak><prosody rate=\"92%\" pitch=\"-0.1st\">昔は、<break time=\"260ms\"/>ここが道の終わりだったのかもしれないわ。</prosody></speak>",
        0.92, -0.1, 3.8
    ),
    (
        "tutorial_t2_before_004", "tutorial_t2_before", "mahmut", "composed",
        "Mahmut ileriye, devam eden yola bakar (`composed`).",
        "Şimdi yolun burada bitmediğini ve geçmeleri gerektiğini sakin bir gerçekçilikle söyler.",
        "It does not end here now.",
        "いまは、ここが終わりじゃない。",
        "イマハ、ココガオワリジャナイ。",
        "Steady, grounded low baritone; calm certainty.",
        "いまは、<short pause> ここが終わりじゃない。",
        "<speak><prosody rate=\"93%\" pitch=\"-0.9st\">いまは、<break time=\"240ms\"/>ここが終わりじゃない。</prosody></speak>",
        0.93, -0.9, 2.7
    ),
    (
        "tutorial_t2_before_005", "tutorial_t2_before", "fadyme", "composed",
        "Fadyme hafif, buruk bir gülümsemeyle karşılık verir (`composed`).",
        "'Birinin bunu ona söylemesi lazım' derken hem ince bir mizah hem de merhamet taşır.",
        "No. Someone ought to tell it.",
        "ええ。誰かが教えてあげないと。",
        "エエ。ダレカガオシエテアゲナイト。",
        "Quiet, wryly compassionate alto; understated and gentle.",
        "ええ。<short pause> 誰かが教えてあげないと。",
        "<speak><prosody rate=\"92%\" pitch=\"0.0st\">ええ。<break time=\"300ms\"/>誰かが教えてあげないと。</prosody></speak>",
        0.92, 0.0, 2.9
    ),
    (
        "tutorial_t2_before_006", "tutorial_t2_before", "narrator", "patient_silence",
        "Sahne Aksiyonu | Fadyme sessizce hacıyı izler (`WATCHING THE LONE HOLLOW PILGRIM`).",
        "Fadyme'nin boşluğa hapsolmuş hacıyı izleyişini ve Mahmut'un onu hiç acele ettirmeyişini anlatır.",
        "For a moment she watched the empty movement without speaking. Mahmut did not hurry her.",
        "しばらくのあいだ、彼女は言葉もなくその虚ろな足取りを見つめていた。マフムトは彼女を急かさなかった。",
        "シバラクノアイダ、カノジョハコトバモナクソノウツロナアシドリヲミツメテイタ。マフムトハカノジョヲセカサナカッタ。",
        "Unhurried, compassionate chronicle narration; respectful silence between clauses.",
        "しばらくのあいだ、<short pause> 彼女は言葉もなくその虚ろな足取りを見つめていた。<long pause> マフムトは彼女を急かさなかった。",
        "<speak><prosody rate=\"90%\" pitch=\"-1.0st\">しばらくのあいだ、<break time=\"260ms\"/>彼女は言葉もなくその虚ろな足取りを見つめていた。<break time=\"540ms\"/>マフムトは彼女を急かさなかった。</prosody></speak>",
        0.90, -1.0, 6.8
    ),
    (
        "tutorial_t2_before_007", "tutorial_t2_before", "fadyme", "composed",
        "Fadyme alçak sesle Mahmut'a sorar (`composed`).",
        "Bu kayıp ruhların hayattayken nereye gitmeye çalıştıklarını düşünüp düşünmediğini sorar.",
        "Do you ever wonder where they meant to go?",
        "あの人たちは、どこへ行くつもりだったのかしら。あなたも考えることはある？",
        "アノヒトタチハ、ドコヘイクツモリダッタノカシラ。アナタモカンガエルコトハアル？",
        "Hushed, wistful alto; genuine curiosity tinged with quiet sorrow.",
        "<sigh> あの人たちは、どこへ行くつもりだったのかしら。<long pause> あなたも考えることはある？",
        "<speak><prosody rate=\"91%\" pitch=\"-0.2st\">あの人たちは、どこへ行くつもりだったのかしら。<break time=\"480ms\"/>あなたも考えることはある？</prosody></speak>",
        0.91, -0.2, 5.2
    ),
    (
        "tutorial_t2_before_008", "tutorial_t2_before", "mahmut", "watchful",
        "Mahmut dürüstçe cevap verir (`watchful`).",
        "Sert bir asker gibi görünse de onun da bazen bunu düşündüğünü tek kelimeyle itiraf eder.",
        "Sometimes.",
        "……ときどきな。",
        "トキドキナ。",
        "Quiet, reflective low baritone after a brief pause; honest and unguarded.",
        "<short pause> ときどきな。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.9st\"><break time=\"260ms\"/>ときどきな。</prosody></speak>",
        0.90, -0.9, 1.9
    ),
    (
        "tutorial_t2_before_009", "tutorial_t2_before", "fadyme", "soft_smile",
        "Fadyme Mahmut'a dönüp yumuşakça gülümser (`soft_smile`).",
        "Trajediden sıyrılıp çok insani bir dilekte bulunur: Sıradan bir yere varmak ve sıradan bir akşam yemeği yemek.",
        "I would rather we reached somewhere ordinary. With an especially ordinary supper.",
        "私たちは、ありふれた場所に着ければいいわ。夕食も、とびきりありふれたもので。",
        "ワタシタチハ、アリフレタバショニツケレバイイワ。ユウショクモ、トビキリアリフレタモノデ。",
        "Warm, wistfully smiling alto; gentle yearning for ordinary peace and supper.",
        "私たちは、ありふれた場所に着ければいいわ。<short pause> 夕食も、<short pause> とびきりありふれたもので。",
        "<speak><prosody rate=\"93%\" pitch=\"+0.3st\">私たちは、ありふれた場所に着ければいいわ。<break time=\"380ms\"/>夕食も、<break time=\"220ms\"/>とびきりありふれたもので。</prosody></speak>",
        0.93, 0.3, 5.4
    ),
    (
        "tutorial_t2_before_010", "tutorial_t2_before", "mahmut", "dry_humor",
        "Mahmut sıcak bir tebessümle söz verir (`dry_humor`).",
        "Bu sade dileği gerçekleştirebileceğini sakin bir güvenle söyler.",
        "That can be arranged.",
        "それなら、手配できるさ。",
        "ソレナラ、テハイデキルサ。",
        "Warm, dryly reassuring low baritone.",
        "それなら、<short pause> 手配できるさ。",
        "<speak><prosody rate=\"94%\" pitch=\"-0.6st\">それなら、<break time=\"240ms\"/>手配できるさ。</prosody></speak>",
        0.94, -0.6, 2.7
    ),
    (
        "tutorial_t2_before_011", "tutorial_t2_before", "narrator", "tense_awakening",
        "Sahne Aksiyonu | Hacı aniden durur ve başını onlara çevirir (`COMBAT STANCE AT THE FORGOTTEN STONE CROSSING`).",
        "Sohbetin ortasında hacının durup onlara dönüşüyle gerilim bir anda yükselir.",
        "The pilgrim stopped. Its head turned toward them.",
        "巡礼者が足を止めた。その首が、ふたりへと向けられる。",
        "ジュンレイシャガアシヲトメタ。ソノクビガ、フタリヘトムケラレル。",
        "Taut, ominous chronicle narration; crisp pause between the two short sentences.",
        "巡礼者が足を止めた。<long pause> その首が、<short pause> ふたりへと向けられる。",
        "<speak><prosody rate=\"89%\" pitch=\"-1.4st\">巡礼者が足を止めた。<break time=\"480ms\"/>その首が、<break time=\"240ms\"/>ふたりへと向けられる。</prosody></speak>",
        0.89, -1.4, 4.4
    ),
    (
        "tutorial_t2_before_012", "tutorial_t2_before", "mahmut", "protective",
        "Mahmut kalkanını kaldırıp öne çıkar (`protective`).",
        "Fadyme'ye hareket alanı bırakmasını söyler.",
        "It has seen us. Keep room to move.",
        "気づかれたな。動ける間合いを保て。",
        "キヅカレタナ。ウゴケルマアイヲタモテ。",
        "Sharp, focused vanguard baritone; immediate tactical readiness.",
        "気づかれたな。<short pause> 動ける間合いを保て。",
        "<speak><prosody rate=\"96%\" pitch=\"-1.1st\">気づかれたな。<break time=\"300ms\"/>動ける間合いを保て。</prosody></speak>",
        0.96, -1.1, 3.3
    ),
    (
        "tutorial_t2_before_013", "tutorial_t2_before", "fadyme", "determined",
        "T-2 Savaşı Öncesi Son Replik | Fadyme gümüş çanını kaldırır (`determined`).",
        "Mahmut'a kendisi için de yanında yer bırakmasını söyleyerek omuz omuza savaşa girer.",
        "And you keep room for me.",
        "あなたも、私の分は空けておいて。",
        "アナタモ、ワタシノブンハアケテオイテ。",
        "Poised, resolute alto; confident partner stepping into battle.",
        "あなたも、<short pause> 私の分は空けておいて。",
        "<speak><prosody rate=\"95%\" pitch=\"-0.1st\">あなたも、<break time=\"240ms\"/>私の分は空けておいて。</prosody></speak>",
        0.95, -0.1, 3.1
    ),

    # ==================== TUTORIAL T-2 AFTER: A ROAD FORGOTTEN / ROADSIDE REST (18 LINES) ====================
    (
        "tutorial_t2_after_001", "tutorial_t2_after", "narrator", "quiet_respite",
        "T-2 Savaşı Sonrası Açılış | `roadside_rest` CG sahnesi; devrilmiş taş oturacak yer sunar.",
        "Savaş bittikten sonra bile Mahmut'un oturmadan önce ağaçları kontrol etme alışkanlığını anlatır.",
        "Beyond the narrow path, a fallen stone offered a seat. Mahmut checked the trees before he sat.",
        "細い道の先に、腰を下ろせそうな倒れ石があった。マフムトは木立を確かめてから、ようやく腰を下ろした。",
        "ホソイミチノサキニ、コシヲオロセソウナタオレイシガアッタ。マフムトハコダチヲタシカメテカラ、ヨウヤクコシヲオロシタ。",
        "Calm, restful chronicle narration; unhurried dusk pacing.",
        "細い道の先に、<short pause> 腰を下ろせそうな倒れ石があった。<long pause> マフムトは木立を確かめてから、<short pause> ようやく腰を下ろした。",
        "<speak><prosody rate=\"91%\" pitch=\"-0.9st\">細い道の先に、<break time=\"260ms\"/>腰を下ろせそうな倒れ石があった。<break time=\"520ms\"/>マフムトは木立を確かめてから、<break time=\"260ms\"/>ようやく腰を下ろした。</prosody></speak>",
        0.91, -0.9, 6.8
    ),
    (
        "tutorial_t2_after_002", "tutorial_t2_after", "fadyme", "dry_amusement",
        "Fadyme taşın üzerinde otururken Mahmut'a takılır (`dry_amusement`).",
        "Ağaçların onun teftişinden sağ çıktığını söyleyerek artık rahatça oturmasını ister.",
        "Sit. The trees have survived your inspection.",
        "座って。木々も、あなたの見回りを無事に切り抜けたことだし。",
        "スワッテ。キギモ、アナタノミマワリヲブジニキリヌケタコトダシ。",
        "Warm, dryly amused alto; gently teasing his relentless vigilance.",
        "<chuckle> 座って。<short pause> 木々も、あなたの見回りを無事に切り抜けたことだし。",
        "<speak><prosody rate=\"94%\" pitch=\"+0.3st\">座って。<break time=\"340ms\"/>木々も、あなたの見回りを無事に切り抜けたことだし。</prosody></speak>",
        0.94, 0.3, 4.4
    ),
    (
        "tutorial_t2_after_003", "tutorial_t2_after", "mahmut", "composed",
        "Mahmut otururken kol zırhındaki gevşemiş kayışa bakar (`composed`).",
        "Dövüşte gevşeyen kayışı sıkmaya çalışır.",
        "This strap needs tightening.",
        "この革帯を締め直さないとな。",
        "コノカワオビヲシメナオサナイトナ。",
        "Matter-of-fact low baritone; practical soldier checking his gear.",
        "この革帯を締め直さないとな。",
        "<speak><prosody rate=\"94%\" pitch=\"-0.8st\">この革帯を締め直さないとな。</prosody></speak>",
        0.94, -0.8, 2.7
    ),
    (
        "tutorial_t2_after_004", "tutorial_t2_after", "fadyme", "dry_amusement",
        "Fadyme elini uzatır (`dry_amusement`).",
        "Zırhının bile dinlenmek istediğini söyleyerek kıpırdamamasını ister.",
        "Then hold still. Even your armour is asking for a rest.",
        "それなら、じっとしていて。鎧まで休みたがっているわ。",
        "ソレナラ、ジットシテイテ。ヨロイマデヤスミタガッテイルワ。",
        "Affectionate, lightly scolding alto; gentle warmth beneath dry wit.",
        "それなら、じっとしていて。<short pause> 鎧まで休みたがっているわ。",
        "<speak><prosody rate=\"93%\" pitch=\"+0.2st\">それなら、じっとしていて。<break time=\"340ms\"/>鎧まで休みたがっているわ。</prosody></speak>",
        0.93, 0.2, 4.2
    ),
    (
        "tutorial_t2_after_005", "tutorial_t2_after", "narrator", "intimate_care",
        "Sahne Aksiyonu | Fadyme Mahmut'un bileğini kendine çekip gevşek deri kayışı tokadan geçirir (`FADYME TIGHTENS THE LOOSE LEATHER STRAP ON HIS GAUNTLET`).",
        "`roadside_rest` illüstrasyonunun tam karşılığı; Fadyme'nin özenli hareketini anlatır.",
        "She drew his wrist toward her and threaded the loose leather through its buckle.",
        "彼女は彼の手首を引き寄せ、緩んだ革帯を留め金へと通した。",
        "カノジョハカレノテクビヲヒキヨセ、ユルンダカワオビヲトメガネヘトトオシタ。",
        "Intimate, hushed chronicle narration; gentle and unhurried.",
        "彼女は彼の手首を引き寄せ、<short pause> 緩んだ革帯を留め金へと通した。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.8st\">彼女は彼の手首を引き寄せ、<break time=\"300ms\"/>緩んだ革帯を留め金へと通した。</prosody></speak>",
        0.90, -0.8, 4.8
    ),
    (
        "tutorial_t2_after_006", "tutorial_t2_after", "mahmut", "composed",
        "Mahmut biraz mahcup bir sesle konuşur (`composed`).",
        "Fadyme'ye zahmet vermemek için kendisinin de yapabileceğini mırıldanır ama kolunu çekmez.",
        "I can do that.",
        "自分でできる。",
        "ジブンデデキル。",
        "Soft, slightly sheepish low baritone; quiet protest without pulling his arm away.",
        "自分でできる。",
        "<speak><prosody rate=\"92%\" pitch=\"-0.7st\">自分でできる。</prosody></speak>",
        0.92, -0.7, 1.9
    ),
    (
        "tutorial_t2_after_007", "tutorial_t2_after", "fadyme", "composed",
        "Fadyme başını kaldırmadan sakin ve şefkatli bir sesle cevap verir (`composed`).",
        "'Biliyorum. Bana bırakmayı da seçebilirsin' diyerek onun da bakılmayı hak ettiğini hatırlatır.",
        "I know. You can also let me.",
        "知っているわ。私に任せることだって、できるでしょう。",
        "シッテイルワ。ワタシニマカセルコトダッテ、デキルデショウ。",
        "Calm, tender alto; quiet intimacy that disarms his stoic habit.",
        "知っているわ。<short pause> 私に任せることだって、<short pause> できるでしょう。",
        "<speak><prosody rate=\"92%\" pitch=\"+0.1st\">知っているわ。<break time=\"320ms\"/>私に任せることだって、<break time=\"220ms\"/>できるでしょう。</prosody></speak>",
        0.92, 0.1, 4.1
    ),
    (
        "tutorial_t2_after_008", "tutorial_t2_after", "narrator", "unspoken_tenderness",
        "Sahne Aksiyonu | Mahmut ağaçlar yerine Fadyme'nin parmaklarını izler.",
        "İkisinin de bu yakınlığın biraz daha sürmesini istediğini anlatan çok ince ve duygusal bir anlatıcı cümlesi.",
        "He watched her fingers instead of the trees. She kept her eyes on the strap a little longer than necessary.",
        "彼は木々ではなく、彼女の指先を見つめていた。彼女もまた、必要な時間より少しだけ長く、革帯に視線を落としていた。",
        "カレハキギデハナク、カノジョノユビサキヲミツメテイタ。カノジョモマタ、ヒツヨウナジカンヨリスコシダケナガク、カワオビニシセンヲオトシテイタ。",
        "Hushed, deeply intimate chronicle narration; slow and delicate pacing.",
        "彼は木々ではなく、<short pause> 彼女の指先を見つめていた。<long pause> 彼女もまた、<short pause> 必要な時間より少しだけ長く、<short pause> 革帯に視線を落としていた。",
        "<speak><prosody rate=\"89%\" pitch=\"-0.8st\">彼は木々ではなく、<break time=\"260ms\"/>彼女の指先を見つめていた。<break time=\"540ms\"/>彼女もまた、<break time=\"240ms\"/>必要な時間より少しだけ長く、<break time=\"260ms\"/>革帯に視線を落としていた。</prosody></speak>",
        0.89, -0.8, 8.2
    ),
    (
        "tutorial_t2_after_009", "tutorial_t2_after", "mahmut", "watchful",
        "Mahmut sessizliği bozmak için alçak sesle sorar (`watchful`).",
        "Normalde Fadyme'nin sorması gereken soruyu dalgınlıkla kendisi sorar.",
        "Too tight?",
        "きつすぎないか？",
        "キツスギナイカ？",
        "Hushed, slightly distracted low baritone spoken at close distance.",
        "きつすぎないか？",
        "<speak><prosody rate=\"91%\" pitch=\"-0.7st\">きつすぎないか？</prosody></speak>",
        0.91, -0.7, 2.0
    ),
    (
        "tutorial_t2_after_010", "tutorial_t2_after", "fadyme", "dry_amusement",
        "Fadyme gülümseyerek başını kaldırır (`dry_amusement`).",
        "Kayışın onun kolunda olduğunu, dolayısıyla cevabı onun vermesi gerektiğini söyleyerek takılır.",
        "You are supposed to answer that.",
        "それは、あなたが答えるところでしょう。",
        "ソレハ、アナタガコタエルトコロデショウ。",
        "Soft, wryly amused alto; gentle teasing.",
        "<chuckle> それは、<short pause> あなたが答えるところでしょう。",
        "<speak><prosody rate=\"94%\" pitch=\"+0.3st\">それは、<break time=\"240ms\"/>あなたが答えるところでしょう。</prosody></speak>",
        0.94, 0.3, 3.2
    ),
    (
        "tutorial_t2_after_011", "tutorial_t2_after", "mahmut", "dry_humor",
        "Mahmut kısa ve net cevap verir (`dry_humor`).",
        "Tam Mahmut usulü tek kelimelik rapor: 'Hayır (sıkı değil).'",
        "No.",
        "……いや。",
        "イヤ。",
        "Deadpan, warm single-word reply in a low baritone.",
        "<short pause> いや。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.8st\"><break time=\"200ms\"/>いや。</prosody></speak>",
        0.90, -0.8, 1.5
    ),
    (
        "tutorial_t2_after_012", "tutorial_t2_after", "fadyme", "soft_smile",
        "Fadyme tatlı bir tebessümle iç çeker (`soft_smile`).",
        "Mahmut'un tek kelimelik cevabına 'Ne kadar da ayrıntılı bir rapor' diyerek gülümser.",
        "A wonderfully detailed report.",
        "なんて詳しい報告かしら。",
        "ナンテクワシイホウコクカシラ。",
        "Affectionate, lightly ironic alto with a soft smile.",
        "なんて詳しい報告かしら。",
        "<speak><prosody rate=\"93%\" pitch=\"+0.4st\">なんて詳しい報告かしら。</prosody></speak>",
        0.93, 0.4, 2.6
    ),
    (
        "tutorial_t2_after_013", "tutorial_t2_after", "mahmut", "dry_humor",
        "Mahmut Fadyme'yi memnun etmek için raporunu uzatır (`dry_humor`).",
        "Ciddi bir zanaatkâr gibi tokayı ve işçiliği över.",
        "The buckle is sound. The work is good.",
        "留め金はしっかりしている。手際もいい。",
        "トメガネハシッカリシテイル。テギワモイイ。",
        "Earnest yet dryly humorous low baritone; offering a genuine compliment in soldierly terms.",
        "留め金はしっかりしている。<short pause> 手際もいい。",
        "<speak><prosody rate=\"93%\" pitch=\"-0.7st\">留め金はしっかりしている。<break time=\"320ms\"/>手際もいい。</prosody></speak>",
        0.93, -0.7, 3.4
    ),
    (
        "tutorial_t2_after_014", "tutorial_t2_after", "fadyme", "dry_amusement",
        "Fadyme gözlerini kısarak gülümser (`dry_amusement`).",
        "'Dikkat et, bir cümle daha kurarsan iltifat sanacağım' diyerek şakalaşır.",
        "Careful. Another sentence and I might mistake that for a compliment.",
        "気をつけて。もう一言続けたら、褒め言葉だと勘違いしてしまいそう。",
        "キヲツケテ。モウヒトコトツヅケタラ、ホメコトバダトカンチガイシテシマイソウ。",
        "Playful, witty alto; unhurried and charming.",
        "気をつけて。<short pause> もう一言続けたら、<short pause> 褒め言葉だと勘違いしてしまいそう。",
        "<speak><prosody rate=\"94%\" pitch=\"+0.3st\">気をつけて。<break time=\"300ms\"/>もう一言続けたら、<break time=\"240ms\"/>褒め言葉だと勘違いしてしまいそう。</prosody></speak>",
        0.94, 0.3, 4.9
    ),
    (
        "tutorial_t2_after_015", "tutorial_t2_after", "mahmut", "composed",
        "Mahmut şakayı bırakıp çok dürüst ve sakin bir sesle söyler (`composed`).",
        "'Zaten iltifattı' diyerek Fadyme'yi hazırlıksız yakalar.",
        "It was one.",
        "褒め言葉だ。",
        "ホメコトバダ。",
        "Simple, disarming sincerity in a warm low baritone.",
        "褒め言葉だ。",
        "<speak><prosody rate=\"91%\" pitch=\"-0.8st\">褒め言葉だ。</prosody></speak>",
        0.91, -0.8, 1.9
    ),
    (
        "tutorial_t2_after_016", "tutorial_t2_after", "narrator", "quiet_smile",
        "Sahne Aksiyonu | Fadyme bitirdiği düğüme bakarak gülümser (`A QUIET SMILE OVER THE FINISHED BUCKLE`).",
        "Fadyme'nin sessiz gülümseyişini ve Mahmut'un bakışlarını yavaşça kaçırışını anlatır.",
        "She smiled down at the finished knot. He looked away first, but not quickly.",
        "彼女は締め終えた結び目に目を落として微笑んだ。先に視線を逸らしたのは彼だったが、すぐには逸らさなかった。",
        "カノジョハシメオエタムスビメニメヲオトシテホホエンダ。サキニシセンヲソラシタノハカレダッタガ、スグニハソラサナカッタ。",
        "Tender, lingering chronicle narration; warm and unhurried.",
        "彼女は締め終えた結び目に目を落として微笑んだ。<long pause> 先に視線を逸らしたのは彼だったが、<short pause> すぐには逸らさなかった。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.8st\">彼女は締め終えた結び目に目を落として微笑んだ。<break time=\"520ms\"/>先に視線を逸らしたのは彼だったが、<break time=\"260ms\"/>すぐには逸らさなかった。</prosody></speak>",
        0.90, -0.8, 7.0
    ),
    (
        "tutorial_t2_after_017", "tutorial_t2_after", "fadyme", "soft_smile",
        "Fadyme Mahmut'un kolunu hafifçe bırakır (`soft_smile`).",
        "Hep koruyan taraf olan Mahmut'a, 'Şimdi sıra sende' diyerek şefkat gösterir.",
        "There. Your turn to be looked after.",
        "ほら。今度は、あなたが気遣ってもらう番よ。",
        "ホラ。コンドハ、アナタガキヅカッテモラウバンヨ。",
        "Gentle, heartfelt alto; warm and satisfied.",
        "<breath> ほら。<short pause> 今度は、あなたが気遣ってもらう番よ。",
        "<speak><prosody rate=\"92%\" pitch=\"+0.3st\">ほら。<break time=\"300ms\"/>今度は、あなたが気遣ってもらう番よ。</prosody></speak>",
        0.92, 0.3, 3.8
    ),
    (
        "tutorial_t2_after_018", "tutorial_t2_after", "mahmut", "composed",
        "T-2 Sonu | Mahmut başını sallar (`composed`).",
        "Birbirlerine göz kulak olma işini daha eşit paylaşmaları gerektiğini kabul eder.",
        "We should do that more evenly.",
        "お互い、もう少し対等にやるべきだな。",
        "オタガイ、モウスコシタイトウニヤルベキダナ。",
        "Warm, grounded low baritone; closing the scene on quiet mutual care.",
        "お互い、<short pause> もう少し対等にやるべきだな。",
        "<speak><prosody rate=\"92%\" pitch=\"-0.7st\">お互い、<break time=\"260ms\"/>もう少し対等にやるべきだな。</prosody></speak>",
        0.92, -0.7, 3.4
    ),

    # ==================== TUTORIAL T-3 BEFORE: A ROOF BEFORE DAWN (14 LINES) ====================
    (
        "tutorial_t3_before_001", "tutorial_t3_before", "narrator", "dusk_arrival",
        "Sahne T-3 Açılışı | Dalların arasından kırık bir çatı görünür (`shelter_courtyard_dusk`).",
        "Alacakaranlıkta görünen kırık çatının yine de kuru bir köşe vaat ettiğini dingin bir dille anlatır.",
        "A broken roof appeared through the branches. There was still enough of it to promise a dry corner.",
        "枝々の向こうに、崩れかけた屋根が見えてきた。それでも、乾いた片隅を約束するには十分なだけ残っていた。",
        "エダエダノムコウニ、クズレカケタヤネガミエテキタ。ソレデモ、カワイタカタスミヲヤクソクスルニハジュウブンナダケノコッテイタ。",
        "Calm, relieved chronicle narration as shelter appears at dusk.",
        "枝々の向こうに、<short pause> 崩れかけた屋根が見えてきた。<long pause> それでも、<short pause> 乾いた片隅を約束するには十分なだけ残っていた。",
        "<speak><prosody rate=\"91%\" pitch=\"-0.9st\">枝々の向こうに、<break time=\"260ms\"/>崩れかけた屋根が見えてきた。<break time=\"520ms\"/>それでも、<break time=\"240ms\"/>乾いた片隅を約束するには十分なだけ残っていた。</prosody></speak>",
        0.91, -0.9, 6.8
    ),
    (
        "tutorial_t3_before_002", "tutorial_t3_before", "mahmut", "watchful",
        "Mahmut çatıyı işaret eder (`watchful`).",
        "Fadyme'nin istediği çatıyı bulmanın memnuniyetiyle orada duracaklarını söyler.",
        "A roof. We stop there.",
        "屋根があるな。あそこで足を止めよう。",
        "ヤネガアルナ。アソコデアシヲトメヨウ。",
        "Steady, quietly pleased low baritone.",
        "屋根があるな。<short pause> あそこで足を止めよう。",
        "<speak><prosody rate=\"94%\" pitch=\"-0.8st\">屋根があるな。<break time=\"300ms\"/>あそこで足を止めよう。</prosody></speak>",
        0.94, -0.8, 3.2
    ),
    (
        "tutorial_t3_before_003", "tutorial_t3_before", "fadyme", "dry_amusement",
        "Fadyme gülümseyerek Mahmut'a bakar (`dry_amusement`).",
        "'Sanki önceden özel sipariş vermişsin gibi konuşuyorsun' diyerek takılır.",
        "You make it sound as though you ordered it specially.",
        "わざわざ注文しておいたみたいな言い方ね。",
        "ワザワザチュウモンシテオイタミタイナイイカタネ。",
        "Light, teasing alto with dry aristocratic wit.",
        "<chuckle> わざわざ注文しておいたみたいな言い方ね。",
        "<speak><prosody rate=\"95%\" pitch=\"+0.4st\">わざわざ注文しておいたみたいな言い方ね。</prosody></speak>",
        0.95, 0.4, 3.4
    ),
    (
        "tutorial_t3_before_004", "tutorial_t3_before", "mahmut", "dry_humor",
        "Mahmut çatının deliklerine bakıp cevap verir (`dry_humor`).",
        "'Ben sipariş etsem daha az delikli isterdim' diyerek espriye karşılık verir.",
        "I would have asked for fewer holes.",
        "俺が注文したなら、もう少し穴を減らしてもらうさ。",
        "オレガチュウモンシタナラ、モウスコシアナヲヘラシテモラウサ。",
        "Dry, deadpan knightly humor in a warm low baritone.",
        "俺が注文したなら、<short pause> もう少し穴を減らしてもらうさ。",
        "<speak><prosody rate=\"94%\" pitch=\"-0.6st\">俺が注文したなら、<break time=\"260ms\"/>もう少し穴を減らしてもらうさ。</prosody></speak>",
        0.94, -0.6, 4.1
    ),
    (
        "tutorial_t3_before_005", "tutorial_t3_before", "fadyme", "soft_smile",
        "Fadyme başını kaldırıp gökyüzüne bakar (`soft_smile`).",
        "'Yıldız manzarası yok mu? Büyük bir ihmal' diyerek şakalaşmayı sürdürür.",
        "No view of the stars? A severe oversight.",
        "星の見えない屋根を？　それは重大な見落としね。",
        "ホシノミエナイヤネヲ？　ソレハジュウダイナミオトシネ。",
        "Playful, warm alto with a soft smile; gentle pause between clauses.",
        "星の見えない屋根を？ <short pause> それは重大な見落としね。",
        "<speak><prosody rate=\"94%\" pitch=\"+0.4st\">星の見えない屋根を？<break time=\"340ms\"/>それは重大な見落としね。</prosody></speak>",
        0.94, 0.4, 3.8
    ),
    (
        "tutorial_t3_before_006", "tutorial_t3_before", "mahmut", "dry_humor",
        "Mahmut yarım bir gülümsemeyle karşılık verir (`dry_humor`).",
        "Yıldızları dışarıda da görebileceğini, yağmurun da dışarıda kalmasını tercih ettiğini söyler.",
        "I can see the stars outside. I would rather keep the rain there too.",
        "星なら外で見られる。雨も一緒に外に置いておきたいからな。",
        "ホシナラソトデミラレル。アメモイッショニソトニオイテオキタイカラナ。",
        "Warm, practical dry humor in a low baritone.",
        "星なら外で見られる。<short pause> 雨も一緒に外に置いておきたいからな。",
        "<speak><prosody rate=\"94%\" pitch=\"-0.6st\">星なら外で見られる。<break time=\"320ms\"/>雨も一緒に外に置いておきたいからな。</prosody></speak>",
        0.94, -0.6, 4.6
    ),
    (
        "tutorial_t3_before_007", "tutorial_t3_before", "narrator", "interrupted_warmth",
        "Sahne Aksiyonu | Fadyme sessizce güler; tam o sırada saçakların altında bir gölge kıpırdar (`SHADOWS STIR BENEATH THE SHELTER EAVES`).",
        "Fadyme'nin içten gülüşünü ve Mahmut'un saçak altındaki hareketi fark edişini anlatır.",
        "She laughed softly. He was still listening when a shape moved beneath the eaves.",
        "彼女は小さく笑った。軒下で影が蠢いたときも、彼はまだ周囲に耳を澄ませていた。",
        "カノジョハチイサクワラッタ。ノキシタデカゲガウゴメイタトキモ、カレハマダシュウイニミミヲスマセテイタ。",
        "Starts warm and soft, then tightens into quiet vigilance on the second sentence.",
        "彼女は小さく笑った。<long pause> 軒下で影が蠢いたときも、<short pause> 彼はまだ周囲に耳を澄ませていた。",
        "<speak><prosody rate=\"92%\" pitch=\"-0.7st\">彼女は小さく笑った。</prosody><break time=\"520ms\"/><prosody rate=\"90%\" pitch=\"-1.3st\">軒下で影が蠢いたときも、<break time=\"260ms\"/>彼はまだ周囲に耳を澄ませていた。</prosody></speak>",
        0.91, -1.0, 5.8
    ),
    (
        "tutorial_t3_before_008", "tutorial_t3_before", "mahmut", "watchful",
        "Mahmut hızla kapıyı ve basamakları işaret eder (`watchful`).",
        "Sesi bir anda ciddileşir; kapıda ve basamaklarda bekleyen düşmanları bildirir.",
        "The doorway. Two more by the steps.",
        "戸口だ。階段の脇にもあと二体いる。",
        "トグチダ。カイダンノワキニモアトニタイイル。",
        "Taut, low combat callout; immediate shift from banter to soldierly focus.",
        "戸口だ。<short pause> 階段の脇にもあと二体いる。",
        "<speak><prosody rate=\"96%\" pitch=\"-1.1st\">戸口だ。<break time=\"280ms\"/>階段の脇にもあと二体いる。</prosody></speak>",
        0.96, -1.1, 3.2
    ),
    (
        "tutorial_t3_before_009", "tutorial_t3_before", "fadyme", "composed",
        "Fadyme gümüş çanını kaldırır (`composed`).",
        "'Önceki kiracılar pek çıkmaya niyetli görünmüyor' diyerek soğukkanlılığını korur.",
        "The previous tenants seem reluctant to leave.",
        "前の住人たちは、出ていく気がないようね。",
        "マエノジュウニンタチハ、デテイクキガナイヨウネ。",
        "Cool, poised alto with dry composure in the face of danger.",
        "前の住人たちは、<short pause> 出ていく気がないようね。",
        "<speak><prosody rate=\"94%\" pitch=\"0.0st\">前の住人たちは、<break time=\"260ms\"/>出ていく気がないようね。</prosody></speak>",
        0.94, 0.0, 3.4
    ),
    (
        "tutorial_t3_before_010", "tutorial_t3_before", "mahmut", "protective",
        "Mahmut kalkanını kaldırır (`protective`).",
        "Düşmanların aralarına girmesine izin vermemelerini söyler.",
        "Wait for my shield. Do not let them separate us.",
        "俺の盾に合わせろ。連中にふたりを分断させるな。",
        "オレノタテニアワセロ。レンチュウニフタリヲブンダンサセルナ。",
        "Firm, protective vanguard baritone; commanding and resolute.",
        "俺の盾に合わせろ。<short pause> 連中にふたりを分断させるな。",
        "<speak><prosody rate=\"96%\" pitch=\"-1.1st\">俺の盾に合わせろ。<break time=\"320ms\"/>連中にふたりを分断させるな。</prosody></speak>",
        0.96, -1.1, 3.8
    ),
    (
        "tutorial_t3_before_011", "tutorial_t3_before", "fadyme", "dry_amusement",
        "Fadyme hafifçe gülümser (`dry_amusement`).",
        "Mahmut'un 'bizi ayırmalarına izin verme' sözüne 'İkili olduğumuza ne çabuk karar verdin' diye takılır ama bundan memnundur.",
        "You were very quick to decide we are a pair.",
        "私たちが二人組だと決めるの、ずいぶん早かったのね。",
        "ワタシタチガフタリグミダトキメルノ、ズイブンハヤカッタノネ。",
        "Wry, warmly amused alto even while readying for combat.",
        "私たちが二人組だと決めるの、<short pause> ずいぶん早かったのね。",
        "<speak><prosody rate=\"94%\" pitch=\"+0.3st\">私たちが二人組だと決めるの、<break time=\"260ms\"/>ずいぶん早かったのね。</prosody></speak>",
        0.94, 0.3, 4.0
    ),
    (
        "tutorial_t3_before_012", "tutorial_t3_before", "mahmut", "composed",
        "Mahmut sakin ve sarsılmaz bir sesle cevap verir (`composed`).",
        "'Aynı yolu yürüyoruz' diyerek tartışmaya yer bırakmayan bir bağlılık gösterir.",
        "We have been walking the same road.",
        "ずっと同じ道を歩いてきただろう。",
        "ズットオナジミチヲアルイテキタダロウ。",
        "Steady, grounded low baritone; simple, undeniable truth.",
        "ずっと同じ道を歩いてきただろう。",
        "<speak><prosody rate=\"93%\" pitch=\"-0.8st\">ずっと同じ道を歩いてきただろう。</prosody></speak>",
        0.93, -0.8, 2.8
    ),
    (
        "tutorial_t3_before_013", "tutorial_t3_before", "fadyme", "determined",
        "Fadyme'nin bakışları keskinleşir (`determined`).",
        "'Öyleyse sen yerini koru, ben de kendi yerimi koruyacağım' diyerek savaşa hazır olduğunu ilan eder.",
        "Then keep your place. I intend to keep mine.",
        "それなら、自分の場所を守って。私は、私の場所を守るつもりよ。",
        "ソレナラ、ジブンノバショヲマモッテ。ワタシハ、ワタシノバショヲマモルツモリヨ。",
        "Clear, determined alto; proud and unyielding partner.",
        "それなら、自分の場所を守って。<short pause> 私は、<short pause> 私の場所を守るつもりよ。",
        "<speak><prosody rate=\"95%\" pitch=\"-0.2st\">それなら、自分の場所を守って。<break time=\"340ms\"/>私は、<break time=\"220ms\"/>私の場所を守るつもりよ。</prosody></speak>",
        0.95, -0.2, 4.8
    ),
    (
        "tutorial_t3_before_014", "tutorial_t3_before", "narrator", "battle_threshold",
        "T-3 Savaşı Öncesi Son Replik | İkisi aynı anda ileri adım atar (`STEPPING FORWARD TOGETHER AS ONE`).",
        "İlk savaştaki tereddüdün aksine, bu kez tam bir uyumla birlikte ileri adım atışlarını anlatır.",
        "This time they stepped forward together.",
        "今度は、ふたり同時に前へと踏み出した。",
        "コンドハ、フタリドウジニマエヘトフミダシタ。",
        "Resolute, poised chronicle narration; a strong closing beat into battle.",
        "今度は、<short pause> ふたり同時に前へと踏み出した。",
        "<speak><prosody rate=\"91%\" pitch=\"-1.0st\">今度は、<break time=\"260ms\"/>ふたり同時に前へと踏み出した。</prosody></speak>",
        0.91, -1.0, 3.6
    ),

    # ==================== TUTORIAL T-3 AFTER: A ROOF BEFORE DAWN / SHELTER EVENING (34 LINES) ====================
    (
        "tutorial_t3_after_001", "tutorial_t3_after", "narrator", "evening_hush",
        "T-3 Savaşı Sonrası Açılış | `shelter_evening` CG sahnesi; içeride rüzgar kirişlerde hafif bir sese dönüşür.",
        "O akşam ilk kez ikisinin de yürümek zorunda olmadığı huzurlu sığınak atmosferini kurar.",
        "Inside, the wind softened to a sound in the rafters. For the first time that evening, neither of them had to walk.",
        "屋内では、風は梁を撫でるかすかな音へと和らいでいた。その夜初めて、ふたりとも歩かなくてよくなった。",
        "オクナイデハ、カゼハハリヲナデルカスカナオトヘトヤワライデイタ。ソノヨルハジメテ、フタリトモアルカナクテヨクナッタ。",
        "Deep, tranquil chronicle narration; a soothing exhale after a long day on the road.",
        "<breath> 屋内では、風は梁を撫でるかすかな音へと和らいでいた。<long pause> その夜初めて、<short pause> ふたりとも歩かなくてよくなった。",
        "<speak><prosody rate=\"90%\" pitch=\"-1.0st\">屋内では、風は梁を撫でるかすかな音へと和らいでいた。<break time=\"540ms\"/>その夜初めて、<break time=\"260ms\"/>ふたりとも歩かなくてよくなった。</prosody></speak>",
        0.90, -1.0, 6.8
    ),
    (
        "tutorial_t3_after_002", "tutorial_t3_after", "mahmut", "watchful",
        "Mahmut içeriyi hızla gözden geçirir (`watchful`).",
        "En kuru ve korunaklı köşeyi Fadyme için seçer.",
        "Dry enough here. The far corner is better.",
        "ここなら十分乾いている。奥の隅の方がいい。",
        "ココナラジュウブンカワイテイル。オクノスミノホウガイイ。",
        "Calm, attentive low baritone checking the shelter for her comfort.",
        "ここなら十分乾いている。<short pause> 奥の隅の方がいい。",
        "<speak><prosody rate=\"93%\" pitch=\"-0.8st\">ここなら十分乾いている。<break time=\"320ms\"/>奥の隅の方がいい。</prosody></speak>",
        0.93, -0.8, 3.6
    ),
    (
        "tutorial_t3_after_003", "tutorial_t3_after", "fadyme", "dry_amusement",
        "Fadyme hafifçe gülümser (`dry_amusement`).",
        "Mahmut'un tek nefeste bütün binayı teftiş etmesine takılır.",
        "You have inspected the entire house in one breath.",
        "一息で、家じゅうを調べ終えたのね。",
        "ヒトイキデ、イエジュウヲシラベオエタノネ。",
        "Light, dryly amused alto; fond and relaxed.",
        "<chuckle> 一息で、<short pause> 家じゅうを調べ終えたのね。",
        "<speak><prosody rate=\"94%\" pitch=\"+0.3st\">一息で、<break time=\"240ms\"/>家じゅうを調べ終えたのね。</prosody></speak>",
        0.94, 0.3, 3.2
    ),
    (
        "tutorial_t3_after_004", "tutorial_t3_after", "mahmut", "dry_humor",
        "Mahmut etrafa bakıp omuz silker (`dry_humor`).",
        "'Pek büyük bir ev değil zaten' diyerek kuru bir espri yapar.",
        "It is not a large house.",
        "それほど大きな家じゃないからな。",
        "ソレホドオオキナイエジャナイカラナ。",
        "Deadpan, warm low baritone.",
        "それほど大きな家じゃないからな。",
        "<speak><prosody rate=\"94%\" pitch=\"-0.6st\">それほど大きな家じゃないからな。</prosody></speak>",
        0.94, -0.6, 2.7
    ),
    (
        "tutorial_t3_after_005", "tutorial_t3_after", "narrator", "chivalrous_warmth",
        "Sahne Aksiyonu | Mahmut pelerinini soğuk taşın üzerine serer (`HIS OXBLOOD CLOAK SPREAD OVER THE COLD STONE BENCH`).",
        "Mahmut'un pelerinini sermesini ve Fadyme'nin bir kenara oturup diğer yanı açıkça onun için boş bırakmasını anlatır.",
        "He laid his cloak over the cold stone. She sat on one edge and left the other unmistakably free.",
        "彼は冷たい石の上に自身の外套を敷いた。彼女は片端に腰を下ろし、もう片方を誰の目にも明らかなほど空けておいた。",
        "カレハツメタイイシノウエニジシンノガイトウヲシイタ。カノジョハカタハシニコシヲオロシ、モウカタホウヲダレノメニモアキラカナホドアケテオイタ。",
        "Warm, gently perceptive chronicle narration; unhurried and intimate.",
        "彼は冷たい石の上に自身の外套を敷いた。<long pause> 彼女は片端に腰を下ろし、<short pause> もう片方を誰の目にも明らかなほど空けておいた。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.8st\">彼は冷たい石の上に自身の外套を敷いた。<break time=\"520ms\"/>彼女は片端に腰を下ろし、<break time=\"260ms\"/>もう片方を誰の目にも明らかなほど空けておいた。</prosody></speak>",
        0.90, -0.8, 7.2
    ),
    (
        "tutorial_t3_after_006", "tutorial_t3_after", "fadyme", "soft_smile",
        "Fadyme yanındaki boş yeri işaret eder (`soft_smile`).",
        "Zarif ve dolaylı bir dille Mahmut'u yanına oturmaya davet eder.",
        "This seat appears to be available.",
        "こちらの席は、空いているようだけれど。",
        "コチラノセキハ、アイテイルヨウダケレド。",
        "Warm, inviting alto disguised as polite formality; a soft smile in the voice.",
        "こちらの席は、<short pause> 空いているようだけれど。",
        "<speak><prosody rate=\"93%\" pitch=\"+0.3st\">こちらの席は、<break time=\"260ms\"/>空いているようだけれど。</prosody></speak>",
        0.93, 0.3, 3.2
    ),
    (
        "tutorial_t3_after_007", "tutorial_t3_after", "mahmut", "watchful",
        "Mahmut kapıya doğru bakar (`watchful`).",
        "Oturmadan önce alışkanlıkla kapıyı bir kez daha kontrol etmek ister.",
        "I will check the doorway.",
        "戸口を確かめてくる。",
        "トグチヲタシカメテクル。",
        "Dutiful, slightly hesitant low baritone.",
        "戸口を確かめてくる。",
        "<speak><prosody rate=\"94%\" pitch=\"-0.8st\">戸口を確かめてくる。</prosody></speak>",
        0.94, -0.8, 2.2
    ),
    (
        "tutorial_t3_after_008", "tutorial_t3_after", "fadyme", "composed",
        "Fadyme sakin bir sesle hatırlatır (`composed`).",
        "İçeri girerken zaten kontrol ettiğini söyler.",
        "You checked it on the way in.",
        "入るときに、もう調べたでしょう。",
        "ハイルトキニ、モウシラベタデショウ。",
        "Calm, knowing alto; gently calling out his excuse.",
        "入るときに、<short pause> もう調べたでしょう。",
        "<speak><prosody rate=\"93%\" pitch=\"+0.1st\">入るときに、<break time=\"240ms\"/>もう調べたでしょう。</prosody></speak>",
        0.93, 0.1, 2.9
    ),
    (
        "tutorial_t3_after_009", "tutorial_t3_after", "mahmut", "dry_humor",
        "Mahmut ciddi bir yüzle bahane üretir (`dry_humor`).",
        "'O dış taraftandı' diyerek kendini savunur.",
        "From the other side.",
        "あれは外側からだ。",
        "アレハソトガワカラダ。",
        "Deadpan, slightly sheepish low baritone.",
        "あれは外側からだ。",
        "<speak><prosody rate=\"94%\" pitch=\"-0.6st\">あれは外側からだ。</prosody></speak>",
        0.94, -0.6, 2.1
    ),
    (
        "tutorial_t3_after_010", "tutorial_t3_after", "fadyme", "dry_amusement",
        "Fadyme gülümseyerek ısrar eder (`dry_amusement`).",
        "'Önemli bir fark tabii. Üçüncü bir taraf keşfetmeden önce otur' diyerek onu yanına çeker.",
        "An important distinction. Sit before you discover a third side.",
        "大切な違いね。三つ目の面を発見する前に、座って。",
        "タイセツナチガイネ。ミッツメノメンヲハッケンスルマエニ、スワッテ。",
        "Warm, playful dry amusement in her alto voice; affectionate insistence on 'Sit'.",
        "<chuckle> 大切な違いね。<short pause> 三つ目の面を発見する前に、<short pause> 座って。",
        "<speak><prosody rate=\"94%\" pitch=\"+0.3st\">大切な違いね。<break time=\"340ms\"/>三つ目の面を発見する前に、<break time=\"240ms\"/>座って。</prosody></speak>",
        0.94, 0.3, 4.5
    ),
    (
        "tutorial_t3_after_011", "tutorial_t3_after", "narrator", "seated_side_by_side",
        "Sahne Aksiyonu | Mahmut oturur (`SEATED SIDE BY SIDE WITHIN THE WAYSIDE SHELTER`).",
        "Kalkanının elinin altında, Fadyme'nin omzunun ise neredeyse omzuna değecek kadar yakın olduğunu anlatır.",
        "He sat. His shield rested within reach; her shoulder rested almost within reach of his.",
        "彼は腰を下ろした。盾は手の届くところに置かれ、彼女の肩もまた、彼の肩にほとんど触れそうなほど近くにあった。",
        "カレハコシヲオロシタ。タテハテノトドクトコロニオカレ、カノジョノカタモマタ、カレノカタニホトンドフレソウナホドチカクニアッタ。",
        "Tender, intimate chronicle narration; warm and unhurried.",
        "彼は腰を下ろした。<long pause> 盾は手の届くところに置かれ、<short pause> 彼女の肩もまた、彼の肩にほとんど触れそうなほど近くにあった。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.8st\">彼は腰を下ろした。<break time=\"480ms\"/>盾は手の届くところに置かれ、<break time=\"280ms\"/>彼女の肩もまた、彼の肩にほとんど触れそうなほど近くにあった。</prosody></speak>",
        0.90, -0.8, 7.0
    ),
    (
        "tutorial_t3_after_012", "tutorial_t3_after", "mahmut", "composed",
        "Mahmut çantasına uzanır (`composed`).",
        "Bu gece için yeterince ekmekleri olduğunu söyler.",
        "We have enough bread for tonight.",
        "今夜の分のパンは足りる。",
        "コンヤノブンノパンハタリル。",
        "Calm, grounded low baritone; quiet domestic comfort.",
        "今夜の分のパンは足りる。",
        "<speak><prosody rate=\"93%\" pitch=\"-0.8st\">今夜の分のパンは足りる。</prosody></speak>",
        0.93, -0.8, 2.5
    ),
    (
        "tutorial_t3_after_013", "tutorial_t3_after", "fadyme", "dry_amusement",
        "Fadyme merakla bakar (`dry_amusement`).",
        "'Gerçek ekmek mi, yoksa senin şu ihtimallerinden biri mi?' diye takılır.",
        "Actual bread, or another of your possibilities?",
        "ちゃんとしたパン？　それとも、また「あるかもしれない」という話？",
        "チャントシタパン？　ソレトモ、マタアルカモシレナイトイウハナシ？",
        "Light, teasing alto; playful inflection on the first question.",
        "ちゃんとしたパン？ <short pause> それとも、<short pause> また「あるかもしれない」という話？",
        "<speak><prosody rate=\"94%\" pitch=\"+0.3st\">ちゃんとしたパン？<break time=\"340ms\"/>それとも、<break time=\"220ms\"/>また「あるかもしれない」という話？</prosody></speak>",
        0.94, 0.3, 4.6
    ),
    (
        "tutorial_t3_after_014", "tutorial_t3_after", "mahmut", "dry_humor",
        "Mahmut somunu çıkarır (`dry_humor`).",
        "'Gerçek ekmek' diyerek somunu gösterir.",
        "Actual bread.",
        "ちゃんとしたパンだ。",
        "チャントシタパンダ。",
        "Warm, deadpan low baritone with a quiet smile.",
        "ちゃんとしたパンだ。",
        "<speak><prosody rate=\"93%\" pitch=\"-0.6st\">ちゃんとしたパンだ。</prosody></speak>",
        0.93, -0.6, 2.1
    ),
    (
        "tutorial_t3_after_015", "tutorial_t3_after", "fadyme", "soft_smile",
        "Fadyme içtenlikle gülümser (`soft_smile`).",
        "T-2'de dilediği 'çatı ve sıradan akşam yemeği' gerçekleşmiştir; Mahmut'u tatlı bir dille över.",
        "A roof and a supper. You should announce your successes more often.",
        "屋根と夕食。もっと頻繁に、成果を発表するべきだわ。",
        "ヤネトユウショク。モットヒンパンニ、セイカヲハッピョウスルベキダワ。",
        "Warm, genuinely delighted alto; soft gratitude wrapped in gentle wit.",
        "屋根と夕食。<short pause> もっと頻繁に、<short pause> 成果を発表するべきだわ。",
        "<speak><prosody rate=\"93%\" pitch=\"+0.3st\">屋根と夕食。<break time=\"320ms\"/>もっと頻繁に、<break time=\"220ms\"/>成果を発表するべきだわ。</prosody></speak>",
        0.93, 0.3, 4.4
    ),
    (
        "tutorial_t3_after_016", "tutorial_t3_after", "narrator", "sharing_bread",
        "Sahne Aksiyonu | Fadyme ekmeği ikiye böler, parçaları tartıp büyük olanı Mahmut'un eline verir (`SHARING A LOAF OF BREAD AT DUSK`).",
        "`shelter_evening` illüstrasyonundaki ekmek paylaşımı: Fadyme'nin büyük parçayı Mahmut'a verişini anlatır.",
        "She broke the loaf in two, considered the pieces, and put the larger one in his hand.",
        "彼女はパンを二つに割り、それぞれの大きさを見比べてから、大きい方を彼の手に握らせた。",
        "カノジョハパンヲフタツニワリ、ソレゾレノオオキサヲミクラベテカラ、オオキイホウヲカレノテニニギラセタ。",
        "Warm, observant chronicle narration; gentle and unhurried.",
        "彼女はパンを二つに割り、<short pause> それぞれの大きさを見比べてから、<short pause> 大きい方を彼の手に握らせた。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.8st\">彼女はパンを二つに割り、<break time=\"280ms\"/>それぞれの大きさを見比べてから、<break time=\"280ms\"/>大きい方を彼の手に握らせた。</prosody></speak>",
        0.90, -0.8, 6.4
    ),
    (
        "tutorial_t3_after_017", "tutorial_t3_after", "mahmut", "watchful",
        "Mahmut elindeki büyük parçaya bakar (`watchful`).",
        "Kendisine daha büyük parça verildiğini hemen fark eder.",
        "You gave me more.",
        "俺の方が大きいぞ。",
        "オレノホウガオオキイゾ。",
        "Gentle, observant low baritone; mild protest.",
        "俺の方が大きいぞ。",
        "<speak><prosody rate=\"93%\" pitch=\"-0.7st\">俺の方が大きいぞ。</prosody></speak>",
        0.93, -0.7, 2.2
    ),
    (
        "tutorial_t3_after_018", "tutorial_t3_after", "fadyme", "dry_amusement",
        "Fadyme masum bir ifadeyle omuz silker (`dry_amusement`).",
        "'Ekmeğin mimarisindeki bir kusur, benim elimde olan bir şey değil' diyerek zarif bir bahaneyle Mahmut'un daha çok yemesini sağlar.",
        "A flaw in the architecture of the loaf. Quite beyond my control.",
        "パンの構造上の欠陥ね。私の手には負えなかったわ。",
        "パンノコウゾウジョウノケッカンネ。ワタシノテニハオエナカッタワ。",
        "Charming, deadpan aristocratic wit in a warm alto; pretending innocence.",
        "<chuckle> パンの構造上の欠陥ね。<short pause> 私の手には負えなかったわ。",
        "<speak><prosody rate=\"94%\" pitch=\"+0.3st\">パンの構造上の欠陥ね。<break time=\"340ms\"/>私の手には負えなかったわ。</prosody></speak>",
        0.94, 0.3, 4.2
    ),
    (
        "tutorial_t3_after_019", "tutorial_t3_after", "mahmut", "composed",
        "Mahmut ekmeğe bakıp hafifçe gülümser (`composed`).",
        "İtiraz etmeyi bırakıp 'Yarın daha iyisini buluruz' der.",
        "Tomorrow we find a better one.",
        "明日は、もう少し出来のいいパンを見つけよう。",
        "アシタハ、モウスコシデキノイイパンヲミツケヨウ。",
        "Warm, quiet low baritone; accepting her kindness.",
        "明日は、<short pause> もう少し出来のいいパンを見つけよう。",
        "<speak><prosody rate=\"92%\" pitch=\"-0.7st\">明日は、<break time=\"260ms\"/>もう少し出来のいいパンを見つけよう。</prosody></speak>",
        0.92, -0.7, 3.6
    ),
    (
        "tutorial_t3_after_020", "tutorial_t3_after", "narrator", "wistful_pause",
        "Sahne Aksiyonu | Fadyme kapıya doğru bakar (`GAZING OUT TOWARD THE DARKENING ROAD`).",
        "'Yarın' kelimesi üzerine Fadyme'nin karanlık yola bakıp bir an sessizleşmesini anlatır.",
        "She looked toward the doorway. For a moment her answer did not come.",
        "彼女は戸口の方へと視線を向けた。しばらくのあいだ、彼女の返事はなかった。",
        "カノジョハトグチノホウヘトシセンヲムケタ。シバラクノアイダ、カノジョノヘンジハナカッタ。",
        "Hushed, contemplative chronicle narration; slowing down as quiet weight enters the room.",
        "彼女は戸口の方へと視線を向けた。<long pause> しばらくのあいだ、<short pause> 彼女の返事はなかった。",
        "<speak><prosody rate=\"89%\" pitch=\"-1.1st\">彼女は戸口の方へと視線を向けた。<break time=\"560ms\"/>しばらくのあいだ、<break time=\"260ms\"/>彼女の返事はなかった。</prosody></speak>",
        0.89, -1.1, 5.6
    ),
    (
        "tutorial_t3_after_021", "tutorial_t3_after", "fadyme", "composed",
        "Fadyme dalgınlığından sıyrılıp alçak sesle cevap verir (`composed`).",
        "'Yarın... Evet' derken sesinde sakladığı ağır sırrın gölgesi vardır.",
        "Tomorrow. Yes.",
        "明日。……ええ。",
        "アシタ。エエ。",
        "Hushed, wistful alto; a quiet pause between 'Tomorrow' and 'Yes'.",
        "明日。<long pause> <breath> ええ。",
        "<speak><prosody rate=\"87%\" pitch=\"-0.2st\">明日。<break time=\"540ms\"/>ええ。</prosody></speak>",
        0.87, -0.2, 2.6
    ),
    (
        "tutorial_t3_after_022", "tutorial_t3_after", "mahmut", "watchful",
        "Mahmut Fadyme'deki durgunluğu anında fark eder (`watchful`).",
        "Zorlamadan, yumuşak ve dikkatli bir sesle ne olduğunu sorar.",
        "What is it?",
        "どうした？",
        "ドウシタ？",
        "Gentle, attentive low baritone; quiet concern.",
        "どうした？",
        "<speak><prosody rate=\"91%\" pitch=\"-0.8st\">どうした？</prosody></speak>",
        0.91, -0.8, 1.7
    ),
    (
        "tutorial_t3_after_023", "tutorial_t3_after", "fadyme", "composed",
        "Fadyme sakin bir ifadeyle geçiştirmeye çalışır (`composed`).",
        "'Bu gece çözülmesi gereken bir şey değil' diyerek yükünü paylaşmaktan çekinir.",
        "Nothing that needs solving tonight.",
        "今夜、解決しなくてもいいことよ。",
        "コンヤ、カイケツシナクテモイイコトヨ。",
        "Guarded, gentle alto; trying to set her burden aside for the night.",
        "今夜、<short pause> 解決しなくてもいいことよ。",
        "<speak><prosody rate=\"91%\" pitch=\"-0.1st\">今夜、<break time=\"280ms\"/>解決しなくてもいいことよ。</prosody></speak>",
        0.91, -0.1, 3.2
    ),
    (
        "tutorial_t3_after_024", "tutorial_t3_after", "mahmut", "composed",
        "Mahmut çok sakin ama derin bir cümle kurar (`composed`).",
        "'İlla çözülmesi gereken bir şey olması şart değil' diyerek sadece dinlemeye ve yanında olmaya hazır olduğunu belli eder.",
        "It does not have to need solving.",
        "解決しなければならないことじゃなくてもいい。",
        "カイケツシナケレバナラナイコトジャナクテモイイ。",
        "Deeply patient, unhurried low baritone; offering unconditional presence without demanding answers.",
        "解決しなければならないことじゃなくてもいい。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.9st\">解決しなければならないことじゃなくてもいい。</prosody></speak>",
        0.90, -0.9, 3.6
    ),
    (
        "tutorial_t3_after_025", "tutorial_t3_after", "narrator", "unguarded_turn",
        "Sahne Aksiyonu | Fadyme bu söz üzerine Mahmut'a döner.",
        "Konuyu değiştirmek için hazırladığı küçük şakayı kullanmaktan vazgeçtiğini anlatır; aralarındaki duvarın indiği an.",
        "That made her turn back to him. The small joke she had prepared went unused.",
        "その言葉に、彼女は彼の方へと向き直った。用意していた小さな冗談は、使われないままになった。",
        "ソノコトバニ、カノジョハカレノホウヘトムキナオッタ。ヨウイシテイタチイサナジョウダンハ、ツカワレナイママニナッタ。",
        "Intimate, deeply resonant chronicle narration; slow and emotionally grounded.",
        "その言葉に、<short pause> 彼女は彼の方へと向き直った。<long pause> 用意していた小さな冗談は、<short pause> 使われないままになった。",
        "<speak><prosody rate=\"89%\" pitch=\"-0.9st\">その言葉に、<break time=\"260ms\"/>彼女は彼の方へと向き直った。<break time=\"520ms\"/>用意していた小さな冗談は、<break time=\"260ms\"/>使われないままになった。</prosody></speak>",
        0.89, -0.9, 6.8
    ),
    (
        "tutorial_t3_after_026", "tutorial_t3_after", "fadyme", "composed",
        "Fadyme zırhını ve şakalarını bırakıp içtenlikle rica eder (`composed`).",
        "Nöbete kalkmadan önce biraz daha yanında oturmasını ister.",
        "Stay a little while. Before you stand watch.",
        "少しだけ、ここにいて。見張りに立つ前に。",
        "スコシダケ、ココニイテ。ミハリニタツマエニ。",
        "Soft, unguarded, vulnerable alto; a quiet, earnest request.",
        "<breath> 少しだけ、ここにいて。<long pause> 見張りに立つ前に。",
        "<speak><prosody rate=\"89%\" pitch=\"0.0st\">少しだけ、ここにいて。<break time=\"480ms\"/>見張りに立つ前に。</prosody></speak>",
        0.89, 0.0, 3.8
    ),
    (
        "tutorial_t3_after_027", "tutorial_t3_after", "mahmut", "composed",
        "Mahmut hiç kıpırdamadan, sarsılmaz bir huzurla cevap verir (`composed`).",
        "'Buradayım.'",
        "I am here.",
        "ここにいるさ。",
        "ココニイルサ。",
        "Warm, steady low baritone; quiet anchor.",
        "ここにいるさ。",
        "<speak><prosody rate=\"89%\" pitch=\"-0.9st\">ここにいるさ。</prosody></speak>",
        0.89, -0.9, 2.0
    ),
    (
        "tutorial_t3_after_028", "tutorial_t3_after", "fadyme", "soft_smile",
        "Fadyme'nin yüzünde çok yumuşak, içten bir gülümseme belirir (`soft_smile`).",
        "'Biliyorum. O yüzden istedim ya' diyerek ona olan güvenini dile getirir.",
        "I know. That was why I asked.",
        "知っているわ。だから、お願いしたの。",
        "シッテイルワ。ダカラ、オネガイシタノ。",
        "Tender, heartfelt alto; soft warmth and quiet trust.",
        "知っているわ。<short pause> だから、<short pause> お願いしたの。",
        "<speak><prosody rate=\"89%\" pitch=\"+0.2st\">知っているわ。<break time=\"340ms\"/>だから、<break time=\"220ms\"/>お願いしたの。</prosody></speak>",
        0.89, 0.2, 3.4
    ),
    (
        "tutorial_t3_after_029", "tutorial_t3_after", "narrator", "warm_silence",
        "Sahne Aksiyonu | Dışarıda son ışık çekilirken içerideki sessizlik artık boş gelmez.",
        "Yan yana oturdukları o sessizliğin içini dolduran huzuru anlatır.",
        "He stayed. Outside, the last light left the road; inside, the silence no longer felt empty.",
        "彼はそこに留まった。外では街道から最後の光が消えていったが、屋内の沈黙は、もはや空虚には感じられなかった。",
        "カレハソコニトドマッタ。ソトデハカイドウカラサイゴノヒカリガキエテイッタガ、オクナイノチンモクハ、モハヤクウキョニハカンジラレナカッタ。",
        "Deep, warm chronicle narration; unhurried and peaceful.",
        "彼はそこに留まった。<long pause> 外では街道から最後の光が消えていったが、<short pause> 屋内の沈黙は、もはや空虚には感じられなかった。",
        "<speak><prosody rate=\"89%\" pitch=\"-0.9st\">彼はそこに留まった。<break time=\"520ms\"/>外では街道から最後の光が消えていったが、<break time=\"300ms\"/>屋内の沈黙は、もはや空虚には感じられなかった。</prosody></speak>",
        0.89, -0.9, 7.6
    ),
    (
        "tutorial_t3_after_030", "tutorial_t3_after", "mahmut", "composed",
        "Mahmut alçak, dingin bir sesle konuşur (`composed`).",
        "Sabah gün ışıyınca acele etmeden yola çıkacaklarını söyler.",
        "We leave when there is light. No hurry.",
        "明るくなってから発とう。急ぐ旅じゃない。",
        "アカルクナッテカラタトウ。イソグタビジャナイ。",
        "Gentle, unhurried low baritone; reassuring and calm.",
        "明るくなってから発とう。<short pause> 急ぐ旅じゃない。",
        "<speak><prosody rate=\"91%\" pitch=\"-0.8st\">明るくなってから発とう。<break time=\"340ms\"/>急ぐ旅じゃない。</prosody></speak>",
        0.91, -0.8, 3.6
    ),
    (
        "tutorial_t3_after_031", "tutorial_t3_after", "fadyme", "soft_smile",
        "Fadyme yumuşak bir tebessümle şart koşar (`soft_smile`).",
        "'Ve iki adım önden yürümek de yok.'",
        "And no walking two steps ahead.",
        "二歩先を歩くのも、なしね。",
        "ニホサキヲアルクノモ、ナシネ。",
        "Affectionate, softly smiling alto; gentle reminder to walk side by side.",
        "二歩先を歩くのも、<short pause> なしね。",
        "<speak><prosody rate=\"92%\" pitch=\"+0.3st\">二歩先を歩くのも、<break time=\"260ms\"/>なしね。</prosody></speak>",
        0.92, 0.3, 2.9
    ),
    (
        "tutorial_t3_after_032", "tutorial_t3_after", "mahmut", "composed",
        "Mahmut söz verir (`composed`).",
        "'Öyleyse yanında.'",
        "Beside you, then.",
        "なら、お前の隣だ。",
        "ナラ、オマエノトナリダ。",
        "Warm, devoted low baritone; quiet promise.",
        "なら、<short pause> お前の隣だ。",
        "<speak><prosody rate=\"90%\" pitch=\"-0.8st\">なら、<break time=\"240ms\"/>お前の隣だ。</prosody></speak>",
        0.90, -0.8, 2.4
    ),
    (
        "tutorial_t3_after_033", "tutorial_t3_after", "fadyme", "soft_smile",
        "Fadyme'nin Tutorial'daki son sözü (`soft_smile`).",
        "Mahmut'un 'yanında' sözünü huzurla kabul eder: '……ええ、そうして。'",
        "Then.",
        "……ええ、そうして。",
        "エエ、ソウシテ。",
        "Soft, lingering alto whisper filled with quiet peace and acceptance.",
        "<breath> ええ、<short pause> そうして。",
        "<speak><prosody rate=\"87%\" pitch=\"+0.2st\"><break time=\"240ms\"/>ええ、<break time=\"260ms\"/>そうして。</prosody></speak>",
        0.87, 0.2, 2.4
    ),
    (
        "tutorial_t3_after_034", "tutorial_t3_after", "narrator", "closing_peace",
        "Tutorial T-3 Kapanış Cümlesi | `A DRY CORNER, HALF A LOAF, AND A PLACE BESIDE EACH OTHER`.",
        "Tutorial üçlemesini kapatan son anlatıcı cümlesi: Bu gecelik kuru bir köşe, yarım somun ekmek ve birbirlerinin yanındaki yer yeterlidir.",
        "For tonight, a dry corner, half a loaf, and a place beside each other were enough.",
        "今夜はただ、乾いた片隅と、半分ずつのパン、そして互いの隣にある居場所だけで十分だった。",
        "コンヤハタダ、カワイタカタスミト、ハンブンズツノパン、ソシテタガイノトナリニアルイバショダケデジュウブンダッタ。",
        "Poised, deeply comforting closing chronicle cadence; slowing gently at the end as the screen fades to black.",
        "<breath> 今夜はただ、<short pause> 乾いた片隅と、<short pause> 半分ずつのパン、<long pause> そして互いの隣にある居場所だけで十分だった。",
        "<speak><prosody rate=\"88%\" pitch=\"-1.0st\">今夜はただ、<break time=\"260ms\"/>乾いた片隅と、<break time=\"280ms\"/>半分ずつのパン、<break time=\"520ms\"/>そして互いの隣にある居場所だけで十分だった。</prosody></speak>",
        0.88, -1.0, 7.8
    ),
]


def enrich_part1_fadyme_line(entry: dict) -> dict:
    """Upgrades a Part I Fadyme line map entry with Sulafat casting, dynamic style prompt, inline tags, and SSML."""
    ja = entry["ja"]
    en = entry.get("en", "")
    op = entry.get("op", "say")

    if op == "thought" or entry.get("voice_track") == "fadyme_thought":
        style = (
            "Internal monologue in a hushed, intimate alto; reflective, slightly slower pace, "
            "speaking quietly to herself with subtle emotional vulnerability."
        )
        rate = "90%"
        pitch = "-0.3st"
    elif "？" in ja or "?" in en:
        if any(w in en.lower() for w in ["really", "always", "mahmut", "suppose", "surely"]):
            style = (
                "Poised young woman with a light, dryly amused alto; subtle teasing inflection "
                "and unhurried aristocratic courtesy."
            )
            rate = "94%"
            pitch = "+0.3st"
        else:
            style = (
                "Calm, observant alto asking a quiet, measured question; attentive and composed."
            )
            rate = "93%"
            pitch = "+0.1st"
    elif "……" in ja or "..." in en:
        style = (
            "Soft, guarded alto carrying unspoken weight; gentle hesitation at ellipses, "
            "hiding fatigue and sorrow behind quiet composure."
        )
        rate = "89%"
        pitch = "-0.2st"
    elif any(w in en.lower() for w in ["thank", "glad", "warm", "stay", "together", "good night"]):
        style = (
            "Tender, heartfelt alto; softened tone with genuine warmth and quiet gratitude."
        )
        rate = "90%"
        pitch = "+0.2st"
    elif any(w in en.lower() for w in ["bell", "hollow", "stand", "hold", "walk", "must", "clear"]):
        style = (
            "Clear, resolute alto; steady and unyielding determination without raising her voice."
        )
        rate = "95%"
        pitch = "-0.2st"
    else:
        style = (
            "Composed, luminous alto; measured light-novel cadence with quiet dignity and natural breath."
        )
        rate = "93%"
        pitch = "0.0st"

    tts_text = ja
    if "……" in tts_text:
        tts_text = tts_text.replace("……", " <long pause> ", 1).replace("……", " <short pause> ")
    tts_text = tts_text.replace("。", "。<short pause> ").replace("、", "、<short pause> ").strip()
    if tts_text.endswith("<short pause>"):
        tts_text = tts_text[: -len("<short pause>")].strip()
    if op == "thought":
        tts_text = "<breath> " + tts_text

    ssml_body = (
        ja.replace("……", '<break time="480ms"/>')
        .replace("。", '。<break time="360ms"/>')
        .replace("、", '、<break time="220ms"/>')
    )
    ssml = f'<speak><prosody rate="{rate}" pitch="{pitch}">{ssml_body}</prosody></speak>'

    updated = dict(entry)
    updated["voice_id"] = "ja-JP-Chirp3-HD-Sulafat"
    updated["gemini_voice"] = "Sulafat"
    updated["direction"] = style
    updated["speech_metadata"] = {
        "type": "speech_metadata",
        "speaker": "Fadyme",
        "style": style,
    }
    updated["tts_text_gemini38"] = tts_text
    updated["ssml_chirp3"] = ssml
    return updated


def main() -> None:
    assert len(VERTICAL_SLICE_LINES) == 116, f"Expected 116 lines, got {len(VERTICAL_SLICE_LINES)}"

    # Verify all 7 vertical slice files match line_ids, speaker_ids, and English text 1-to-1
    expected_rows: list[tuple[str, str, str]] = []
    pro = json.loads((ROOT / "content/base/entry/prologue.json").read_text(encoding="utf-8"))
    for sc in pro["scenes"]:
        expected_rows.append((sc["line_id"], "narrator", sc["text_en"]))
    for fname in [
        "tutorial_t1_before.json",
        "tutorial_t1_after.json",
        "tutorial_t2_before.json",
        "tutorial_t2_after.json",
        "tutorial_t3_before.json",
        "tutorial_t3_after.json",
    ]:
        st = json.loads((ROOT / "content/base/story" / fname).read_text(encoding="utf-8"))
        for cmd in st["commands"]:
            if cmd.get("op") in ("say", "narrate"):
                spk = "narrator" if cmd["op"] == "narrate" else cmd["speaker"]
                expected_rows.append((cmd["line_id"], spk, cmd["text"]))

    for idx, ((exp_id, exp_spk, exp_en), row) in enumerate(zip(expected_rows, VERTICAL_SLICE_LINES)):
        lid, _, spk, _, _, _, en, ja, *_ = row
        assert lid == exp_id, f"Index {idx}: expected line_id {exp_id}, got {lid}"
        assert spk == exp_spk, f"{lid}: expected speaker {exp_spk}, got {spk}"
        assert en == exp_en, f"{lid}: expected EN '{exp_en}', got '{en}'"
        if "Fadyme" in en:
            assert "ファディメ" in ja, f"{lid} mentions Fadyme in EN but missing ファディメ in JA"
        if "Mahmut" in en:
            assert "マフムト" in ja, f"{lid} mentions Mahmut in EN but missing マフムト in JA"

    line_maps_dir = ROOT / "narrative/10_VO/Line_Maps"
    line_maps_dir.mkdir(parents=True, exist_ok=True)

    # 1. Write casting.json
    (line_maps_dir / "casting.json").write_text(
        json.dumps(CASTING_BIBLE, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # Build rich master line objects
    master_lines: list[dict] = []
    by_id: dict[str, dict] = {}
    for idx, row in enumerate(VERTICAL_SLICE_LINES, start=1):
        (
            line_id,
            scene_id,
            speaker_id,
            emotion,
            when_cue,
            subtext_tr,
            en,
            ja,
            reading_kana,
            style_prompt_en,
            tts_text_gemini38,
            ssml_chirp3,
            rate,
            pitch_st,
            est_dur_s,
        ) = row
        cast_info = CASTING_BIBLE["cast"][speaker_id]
        speaker_label = cast_info["name_en"]
        if speaker_id == "narrator":
            style_prompt_en = (
                "Speak in a serene, spiritual, otherworldly, and timeless mystical narrator voice. "
                "Maintain a single, unwavering, deeply calm, ethereal, and reverent tone from beginning to end—"
                "like an ancient spirit speaking quietly from beyond time, with steady, unhurried pacing and "
                "completely uniform pitch, warmth, and timbre across every paragraph."
            )
            emotion = "spiritual_chronicle"
            rate = 0.90
            pitch_st = -1.0
            tts_text_gemini38 = (
                tts_text_gemini38.replace("<exhales>", "")
                .replace("<sigh>", "")
                .replace("<breath>", "")
                .strip()
            )
        item = {
            "order_index": idx,
            "line_id": line_id,
            "scene_id": scene_id,
            "speaker_id": speaker_id,
            "speaker_name": speaker_label,
            "gemini_voice": cast_info["gemini_voice"],
            "chirp3_voice_id": cast_info["chirp3_voice_id"],
            "emotion": emotion,
            "when_cue": when_cue,
            "subtext_tr": subtext_tr,
            "en": en,
            "ja": ja,
            "reading_kana": reading_kana,
            "speech_metadata": {
                "type": "speech_metadata",
                "speaker": speaker_label,
                "style": style_prompt_en,
            },
            "tts_text_gemini38": tts_text_gemini38,
            "ssml_chirp3": ssml_chirp3,
            "acoustic_profile": {
                "speaking_rate": rate,
                "pitch_semitones": pitch_st,
                "duration_seconds": est_dur_s,
                "duck_ratio": 0.25,
                "target_lufs": -20.0,
            },
            "output_ogg": f"voices/{line_id}.ogg",
        }
        master_lines.append(item)
        by_id[line_id] = item

    # 2. Write jp_script_vertical_slice_master.json
    master_doc = {
        "schema_version": 2,
        "title": "Unaware of My Demise — Complete Vertical Slice Directed Japanese Voice Script (116 Lines)",
        "cast_locked": {
            "narrator": "Algieba (ja-JP-Chirp3-HD-Algieba)",
            "fadyme": "Sulafat (ja-JP-Chirp3-HD-Sulafat)",
            "mahmut": "Iapetus (ja-JP-Chirp3-HD-Iapetus)",
        },
        "total_lines": len(master_lines),
        "counts_by_speaker": {
            "narrator": sum(1 for x in master_lines if x["speaker_id"] == "narrator"),
            "fadyme": sum(1 for x in master_lines if x["speaker_id"] == "fadyme"),
            "mahmut": sum(1 for x in master_lines if x["speaker_id"] == "mahmut"),
        },
        "lines": master_lines,
    }
    (line_maps_dir / "jp_script_vertical_slice_master.json").write_text(
        json.dumps(master_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # 3. Update jp_script_prologue.json
    pro_script_path = line_maps_dir / "jp_script_prologue.json"
    pro_script = json.loads(pro_script_path.read_text(encoding="utf-8"))
    pro_script["schema_version"] = 2
    pro_script["voice_id"] = "ja-JP-Chirp3-HD-Algieba"
    pro_script["gemini_voice"] = "Algieba"
    for p_line in pro_script["lines"]:
        m = by_id[p_line["line_id"]]
        p_line["voice_id"] = m["chirp3_voice_id"]
        p_line["gemini_voice"] = m["gemini_voice"]
        p_line["emotion"] = m["emotion"]
        p_line["when_cue"] = m["when_cue"]
        p_line["subtext_tr"] = m["subtext_tr"]
        p_line["reading_kana"] = m["reading_kana"]
        p_line["direction"] = m["speech_metadata"]["style"]
        p_line["speech_metadata"] = m["speech_metadata"]
        p_line["tts_text_gemini38"] = m["tts_text_gemini38"]
        p_line["ssml_chirp3"] = m["ssml_chirp3"]
    pro_script_path.write_text(
        json.dumps(pro_script, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # 4. Write jp_script_narrator.json & jp_script_mahmut.json
    narrator_doc = {
        "schema_version": 2,
        "speaker_id": "narrator",
        "gemini_voice": "Algieba",
        "chirp3_voice_id": "ja-JP-Chirp3-HD-Algieba",
        "direction_global": CASTING_BIBLE["cast"]["narrator"]["default_style_prompt"],
        "lines": [x for x in master_lines if x["speaker_id"] == "narrator"],
    }
    (line_maps_dir / "jp_script_narrator.json").write_text(
        json.dumps(narrator_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    mahmut_doc = {
        "schema_version": 2,
        "speaker_id": "mahmut",
        "gemini_voice": "Iapetus",
        "chirp3_voice_id": "ja-JP-Chirp3-HD-Iapetus",
        "direction_global": CASTING_BIBLE["cast"]["mahmut"]["default_style_prompt"],
        "lines": [x for x in master_lines if x["speaker_id"] == "mahmut"],
    }
    (line_maps_dir / "jp_script_mahmut.json").write_text(
        json.dumps(mahmut_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # 5. Upgrade jp_script_fadyme.json (201 Part I lines + 40 tutorial lines)
    fadyme_script_path = line_maps_dir / "jp_script_fadyme.json"
    if fadyme_script_path.exists():
        fadyme_script = json.loads(fadyme_script_path.read_text(encoding="utf-8"))
        fadyme_script["schema_version"] = 2
        fadyme_script["voice_id"] = "ja-JP-Chirp3-HD-Sulafat"
        fadyme_script["gemini_voice"] = "Sulafat"
        fadyme_script["direction_global"] = CASTING_BIBLE["cast"]["fadyme"]["default_style_prompt"]
        fadyme_script["lines"] = [enrich_part1_fadyme_line(ln) for ln in fadyme_script["lines"]]
        fadyme_script["tutorial_vertical_slice_lines"] = [
            x for x in master_lines if x["speaker_id"] == "fadyme"
        ]
        fadyme_script_path.write_text(
            json.dumps(fadyme_script, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    # 6. Upgrade Fadyme production_v002 tutorial draft & recording queue
    fadyme_audio_dir = ROOT / "narrative/15_Art_Workbench/characters/fadyme/production_v002/audio"
    tut_draft_path = fadyme_audio_dir / "tutorial_ja_JP_draft_v002.json"
    if tut_draft_path.exists():
        tut_draft = json.loads(tut_draft_path.read_text(encoding="utf-8"))
        tut_draft["voice_id"] = "ja-JP-Chirp3-HD-Sulafat"
        tut_draft["gemini_voice"] = "Sulafat"
        tut_draft["status"] = "locked_cast_and_acting_prompts_v003"
        for ln in tut_draft.get("lines", []):
            m = by_id.get(ln["line_id"])
            if m:
                assert ln["text_ja_JP"] == m["ja"], f"Mismatch on {ln['line_id']}: {ln['text_ja_JP']} != {m['ja']}"
                ln["voice_id"] = "ja-JP-Chirp3-HD-Sulafat"
                ln["gemini_voice"] = "Sulafat"
                ln["reading_kana"] = m["reading_kana"]
                ln["emotion"] = m["emotion"]
                ln["when_cue"] = m["when_cue"]
                ln["subtext_tr"] = m["subtext_tr"]
                ln["delivery"] = m["speech_metadata"]["style"]
                ln["speech_metadata"] = m["speech_metadata"]
                ln["tts_text_gemini38"] = m["tts_text_gemini38"]
                ln["ssml_chirp3"] = m["ssml_chirp3"]
        tut_draft_path.write_text(
            json.dumps(tut_draft, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    rec_queue_path = fadyme_audio_dir / "recording_queue_v002.json"
    if rec_queue_path.exists():
        rec_queue = json.loads(rec_queue_path.read_text(encoding="utf-8"))
        rec_queue["voice_id"] = "ja-JP-Chirp3-HD-Sulafat"
        rec_queue["gemini_voice"] = "Sulafat"
        rec_queue["status"] = "locked_cast_Sulafat_v003"
        for q in rec_queue.get("queue", []):
            lid = q["line_id"]
            if lid in by_id:
                m = by_id[lid]
                q["voice_id"] = "ja-JP-Chirp3-HD-Sulafat"
                q["gemini_voice"] = "Sulafat"
                q["text_ja_JP"] = m["ja"]
                q["delivery"] = m["speech_metadata"]["style"]
                q["speech_metadata"] = m["speech_metadata"]
                q["tts_text_gemini38"] = m["tts_text_gemini38"]
                q["ssml_chirp3"] = m["ssml_chirp3"]
                q["status"] = "ready_for_synthesis"
            else:
                enriched = enrich_part1_fadyme_line(
                    {
                        "line_id": lid,
                        "ja": q.get("text_ja_JP", ""),
                        "en": q.get("text_en", ""),
                        "op": "thought" if q.get("voice_track") == "fadyme_thought" else "say",
                    }
                )
                q["voice_id"] = "ja-JP-Chirp3-HD-Sulafat"
                q["gemini_voice"] = "Sulafat"
                q["delivery"] = enriched["direction"]
                q["speech_metadata"] = enriched["speech_metadata"]
                q["tts_text_gemini38"] = enriched["tts_text_gemini38"]
                q["ssml_chirp3"] = enriched["ssml_chirp3"]
                q["status"] = "ready_for_synthesis"
        rec_queue_path.write_text(
            json.dumps(rec_queue, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    # 7. Generate apps/game/src/audio/voiceTranscripts.ts
    ts_lines: list[str] = [
        "/**",
        " * R16 Reviewed Japanese Voice Transcript, Canonical Name-Reading, Casting & Acting Direction Registry.",
        " * Prevents feeding untranslated English prose into a Japanese voice model and binds stable `line_id`s",
        " * to reviewed Japanese scripts, kana readings, English subtitles, emotional acting prompts, inline vocal tags,",
        " * Chirp3-HD SSML envelopes, and BGM ducking envelopes.",
        " *",
        " * Canonical Locked Voice Cast:",
        " * - Narrator (`narrator`): Algieba (`ja-JP-Chirp3-HD-Algieba`)",
        " * - Fadyme (`fadyme`): Sulafat (`ja-JP-Chirp3-HD-Sulafat`)",
        " * - Mahmut (`mahmut`): Iapetus (`ja-JP-Chirp3-HD-Iapetus`)",
        " */",
        "",
        "export interface VoiceCastProfile {",
        "  speakerId: string;",
        "  nameEn: string;",
        "  nameJa: string;",
        "  readingKana: string;",
        "  voiceArchetype: string;",
        "  recommendedVoiceId: string;",
        "  geminiVoiceName: string;",
        "  pitchSemitones: number;",
        "  speakingRate: number;",
        "}",
        "",
        "export interface ReviewedJaVoiceLine {",
        "  lineId: string;",
        "  speakerId: string;",
        "  transcriptJa: string;",
        "  readingKana: string;",
        "  subtitleEn: string;",
        "  durationSeconds: number;",
        "  duckRatio: number;",
        "  emotion?: string;",
        "  whenCue?: string;",
        "  actingStyle?: string;",
        "  ttsTextGemini38?: string;",
        "  ssmlChirp3?: string;",
        "}",
        "",
        "export const CANON_JA_CAST: Record<string, VoiceCastProfile> = {",
        "  narrator: {",
        "    speakerId: 'narrator',",
        "    nameEn: 'Narrator',",
        "    nameJa: '語り手',",
        "    readingKana: 'カタリテ',",
        "    voiceArchetype: 'deep, weathered bass-baritone chronicle storyteller (93 Hz)',",
        "    recommendedVoiceId: 'ja-JP-Chirp3-HD-Algieba',",
        "    geminiVoiceName: 'Algieba',",
        "    pitchSemitones: -1.0,",
        "    speakingRate: 0.92",
        "  },",
        "  fadyme: {",
        "    speakerId: 'fadyme',",
        "    nameEn: 'Fadyme',",
        "    nameJa: 'ファディメ',",
        "    readingKana: 'ファディメ',",
        "    voiceArchetype: 'poised gothic alto, dry aristocratic wit, quiet resolve & tender warmth (253 Hz)',",
        "    recommendedVoiceId: 'ja-JP-Chirp3-HD-Sulafat',",
        "    geminiVoiceName: 'Sulafat',",
        "    pitchSemitones: 0.0,",
        "    speakingRate: 0.94",
        "  },",
        "  mahmut: {",
        "    speakerId: 'mahmut',",
        "    nameEn: 'Mahmut',",
        "    nameJa: 'マフムト',",
        "    readingKana: 'マフムト',",
        "    voiceArchetype: 'grounded travel-worn knight baritone, dry warmth & protective resolve (145 Hz)',",
        "    recommendedVoiceId: 'ja-JP-Chirp3-HD-Iapetus',",
        "    geminiVoiceName: 'Iapetus',",
        "    pitchSemitones: -0.8,",
        "    speakingRate: 0.95",
        "  },",
        "  aveline: {",
        "    speakerId: 'aveline',",
        "    nameEn: 'Aveline',",
        "    nameJa: 'アヴェリン',",
        "    readingKana: 'アヴェリン',",
        "    voiceArchetype: 'steadfast oath-bound sentinel',",
        "    recommendedVoiceId: 'ja-JP-Chirp3-HD-Kore',",
        "    geminiVoiceName: 'Kore',",
        "    pitchSemitones: -0.5,",
        "    speakingRate: 0.95",
        "  },",
        "  ywain: {",
        "    speakerId: 'ywain',",
        "    nameEn: 'Ywain',",
        "    nameJa: 'イウェイン',",
        "    readingKana: 'イウェイン',",
        "    voiceArchetype: 'austere scholar-tactician',",
        "    recommendedVoiceId: 'ja-JP-Chirp3-HD-Fenrir',",
        "    geminiVoiceName: 'Fenrir',",
        "    pitchSemitones: -0.8,",
        "    speakingRate: 0.97",
        "  },",
        "  isolde: {",
        "    speakerId: 'isolde',",
        "    nameEn: 'Isolde',",
        "    nameJa: 'イゾルデ',",
        "    readingKana: 'イゾルデ',",
        "    voiceArchetype: 'melancholic reliquary cantor',",
        "    recommendedVoiceId: 'ja-JP-Chirp3-HD-Leda',",
        "    geminiVoiceName: 'Leda',",
        "    pitchSemitones: 0.5,",
        "    speakingRate: 0.92",
        "  }",
        "};",
        "",
        "export const CANON_JA_TERM_READINGS: Record<string, { ja: string; readingKana: string }> = {",
        "  \"Bell's Remains\": { ja: '鐘の遺響', readingKana: 'カネノイキョウ' },",
        "  'Whispering Ash': { ja: '囁く灰の森', readingKana: 'ササヤクハイノモリ' },",
        "  'Bound Chronicle': { ja: '綴じられた年代記', readingKana: 'トジラレタネンダイキ' },",
        "  'Memory Shard': { ja: '記憶の欠片', readingKana: 'キオクノカケラ' },",
        "  Veyrhold: { ja: 'ヴェアホルド', readingKana: 'ヴェアホルド' },",
        "  Crownfall: { ja: '王冠落ち', readingKana: 'オウカンオチ' },",
        "  'Saint Luthos': { ja: '聖ルトス', readingKana: 'セイルトス' }",
        "};",
        "",
        "export const REVIEWED_JA_VOICE_LINES: Record<string, ReviewedJaVoiceLine> = {",
    ]

    for m in master_lines:
        lid = m["line_id"]
        ts_lines.extend(
            [
                f"  {lid}: {{",
                f"    lineId: {json.dumps(lid)},",
                f"    speakerId: {json.dumps(m['speaker_id'])},",
                f"    transcriptJa: {json.dumps(m['ja'], ensure_ascii=False)},",
                f"    readingKana: {json.dumps(m['reading_kana'], ensure_ascii=False)},",
                f"    subtitleEn: {json.dumps(m['en'], ensure_ascii=False)},",
                f"    durationSeconds: {m['acoustic_profile']['duration_seconds']},",
                f"    duckRatio: {m['acoustic_profile']['duck_ratio']},",
                f"    emotion: {json.dumps(m['emotion'])},",
                f"    whenCue: {json.dumps(m['when_cue'], ensure_ascii=False)},",
                f"    actingStyle: {json.dumps(m['speech_metadata']['style'], ensure_ascii=False)},",
                f"    ttsTextGemini38: {json.dumps(m['tts_text_gemini38'], ensure_ascii=False)},",
                f"    ssmlChirp3: {json.dumps(m['ssml_chirp3'], ensure_ascii=False)}",
                "  },",
            ]
        )

    # Keep the 6 legacy cue keys for backward-compatible unit tests
    ts_lines.extend(
        [
            "  pro_01: {",
            "    lineId: 'pro_01',",
            "    speakerId: 'narrator',",
            "    transcriptJa: '鐘が一度鳴ったとき、誰も自分がすでに死んでいるとは知らなかった。',",
            "    readingKana: 'カネガイチドナッタトキ、ダレモジブンガスデニシンデイルトハシラナカッタ。',",
            "    subtitleEn: 'When the bell struck once, none of us knew we were already dead.',",
            "    durationSeconds: 5.2,",
            "    duckRatio: 0.25",
            "  },",
            "  pro_02: {",
            "    lineId: 'pro_02',",
            "    speakerId: 'fadyme',",
            "    transcriptJa: 'マフムト、灯りを下げないで。灰の霧が足元まで満ちているわ。',",
            "    readingKana: 'マフムト、アカリヲサゲナイデ。ハイノキリガアシモトマデミチテイルワ。',",
            "    subtitleEn: 'Mahmut, do not lower the lantern. The ash fog has risen to our boots.',",
            "    durationSeconds: 4.8,",
            "    duckRatio: 0.25",
            "  },",
            "  pro_03: {",
            "    lineId: 'pro_03',",
            "    speakerId: 'mahmut',",
            "    transcriptJa: 'ファディメ、まだ息はできる。道が消える前に先へ進もう。',",
            "    readingKana: 'ファディメ、マダイキハデキル。ミチガキエルマエニサキヘススモウ。',",
            "    subtitleEn: 'Fadyme, we can still breathe. Let us press on before the road vanishes.',",
            "    durationSeconds: 4.5,",
            "    duckRatio: 0.25",
            "  },",
            "  t1_intro_01: {",
            "    lineId: 't1_intro_01',",
            "    speakerId: 'mahmut',",
            "    transcriptJa: '前衛は俺が受け持つ。ファディメ、後ろから合図してくれ。',",
            "    readingKana: 'ゼンエイハオレガウケモツ。ファディメ、ウシロカラアイズシテクレ。',",
            "    subtitleEn: 'I will hold the vanguard. Fadyme, call the opening from the rear.',",
            "    durationSeconds: 4.2,",
            "    duckRatio: 0.25",
            "  },",
            "  t2_intro_01: {",
            "    lineId: 't2_intro_01',",
            "    speakerId: 'fadyme',",
            "    transcriptJa: '鐘の遺響が共鳴している……集中すれば、一撃で崩せるはずよ。',",
            "    readingKana: 'カネノイキョウガキョウメイシテイル……シュウチュウスレバ、イチゲキデクズセルハズヨ。',",
            "    subtitleEn: \"The Bell's Remains are resonating... Focus our strike to break their line.\",",
            "    durationSeconds: 4.9,",
            "    duckRatio: 0.25",
            "  },",
            "  t3_intro_01: {",
            "    lineId: 't3_intro_01',",
            "    speakerId: 'mahmut',",
            "    transcriptJa: 'これが最後の関門だ。全員、陣形を崩すな！',",
            "    readingKana: 'コレガサイゴノカンモンダ。ゼンイン、ジンケイヲクズスナ！',",
            "    subtitleEn: 'This is the final barrier. Hold formation, everyone!',",
            "    durationSeconds: 3.9,",
            "    duckRatio: 0.25",
            "  }",
            "};",
            "",
            "const JA_SCRIPT_REGEX = /[\\u3040-\\u309f\\u30a0-\\u30ff\\u3400-\\u9fff]/;",
            "const LATIN_WORD_REGEX = /\\b[A-Za-z]{3,}\\b/;",
            "",
            "/**",
            " * Validates a Japanese voice line before synthesis or runtime packaging:",
            " * - Rejects untranslated English dialogue (`LATIN_WORD_REGEX` in `transcriptJa` or missing Japanese script).",
            " * - Verifies that known speaker IDs exist in `CANON_JA_CAST`.",
            " * - Verifies that any canonical character name mentioned in `subtitleEn` uses its canonical katakana reading in `transcriptJa`.",
            " */",
            "export function validateJaVoiceLine(line: ReviewedJaVoiceLine): {",
            "  valid: boolean;",
            "  errors: string[];",
            "} {",
            "  const errors: string[] = [];",
            "  if (!/^[a-z][a-z0-9_]{1,63}$/.test(line.lineId)) {",
            "    errors.push(`invalid lineId \"${line.lineId}\"`);",
            "  }",
            "  if (!CANON_JA_CAST[line.speakerId]) {",
            "    errors.push(`unknown speakerId \"${line.speakerId}\" (not in CANON_JA_CAST)`);",
            "  }",
            "  if (!JA_SCRIPT_REGEX.test(line.transcriptJa)) {",
            "    errors.push('transcriptJa must contain Japanese script (Hiragana, Katakana, or Kanji)');",
            "  }",
            "  if (LATIN_WORD_REGEX.test(line.transcriptJa)) {",
            "    errors.push('transcriptJa contains Latin/English words; never feed English dialogue into a Japanese voice');",
            "  }",
            "  if (!line.subtitleEn.trim()) {",
            "    errors.push('subtitleEn must not be empty');",
            "  }",
            "  if (!(line.durationSeconds > 0.2 && line.durationSeconds <= 30)) {",
            "    errors.push(`durationSeconds (${line.durationSeconds}) must be in (0.2, 30]`);",
            "  }",
            "",
            "  for (const profile of Object.values(CANON_JA_CAST)) {",
            "    if (profile.speakerId === 'narrator') continue;",
            "    if (line.subtitleEn.includes(profile.nameEn) && !line.transcriptJa.includes(profile.nameJa)) {",
            "      errors.push(`subtitle mentions \"${profile.nameEn}\" but transcriptJa is missing canonical reading \"${profile.nameJa}\"`);",
            "    }",
            "  }",
            "",
            "  return { valid: errors.length === 0, errors };",
            "}",
            "",
            "export function resolveVoiceCueAndSubtitle(",
            "  lineId: string,",
            "  localeStrings?: Record<string, string>",
            "): {",
            "  lineId: string;",
            "  subtitleEn: string;",
            "  transcriptJa: string | null;",
            "  cast: VoiceCastProfile | null;",
            "  duckRatio: number;",
            "  actingStyle: string | null;",
            "  ttsTextGemini38: string | null;",
            "  ssmlChirp3: string | null;",
            "  durationSeconds: number;",
            "} {",
            "  const reviewed = REVIEWED_JA_VOICE_LINES[lineId];",
            "  const localized = localeStrings && Object.hasOwn(localeStrings, lineId) ? localeStrings[lineId]! : undefined;",
            "  if (!reviewed) {",
            "    return {",
            "      lineId,",
            "      subtitleEn: localized ?? '',",
            "      transcriptJa: null,",
            "      cast: null,",
            "      duckRatio: 0.25,",
            "      actingStyle: null,",
            "      ttsTextGemini38: null,",
            "      ssmlChirp3: null,",
            "      durationSeconds: 0",
            "    };",
            "  }",
            "  return {",
            "    lineId,",
            "    subtitleEn: localized ?? reviewed.subtitleEn,",
            "    transcriptJa: reviewed.transcriptJa,",
            "    cast: CANON_JA_CAST[reviewed.speakerId] ?? null,",
            "    duckRatio: reviewed.duckRatio,",
            "    actingStyle: reviewed.actingStyle ?? null,",
            "    ttsTextGemini38: reviewed.ttsTextGemini38 ?? null,",
            "    ssmlChirp3: reviewed.ssmlChirp3 ?? null,",
            "    durationSeconds: reviewed.durationSeconds",
            "  };",
            "}",
            "",
        ]
    )

    ts_path = ROOT / "apps/game/src/audio/voiceTranscripts.ts"
    ts_path.write_text("\n".join(ts_lines), encoding="utf-8")

    print(
        f"Verified & Built 116 vertical-slice acting lines -> "
        f"Narrator(Algieba)={master_doc['counts_by_speaker']['narrator']}, "
        f"Fadyme(Sulafat)={master_doc['counts_by_speaker']['fadyme']}, "
        f"Mahmut(Iapetus)={master_doc['counts_by_speaker']['mahmut']}"
    )


if __name__ == "__main__":
    main()

