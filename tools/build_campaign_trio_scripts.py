#!/usr/bin/env python3
"""
Builds the canonical Emotional Japanese Voice Acting Scripts for Part I Campaign
(Fadyme, Mahmut, and Narrator — 236 story lines across 88 scenes + 22 battle/menu VO lines = 258 lines).

Locked Cast (Owner Direction):
- Narrator (`narrator` / `narration`): Algieba (`ja-JP-Chirp3-HD-Algieba` / `gemini-3.8-flash-tts` voice `Algieba`, 96.0 Hz)
- Fadyme (`fadyme` / `fadyme_thought`): Sulafat (`ja-JP-Chirp3-HD-Sulafat` / `gemini-3.8-flash-tts` voice `Sulafat`, 252.6 Hz)
- Mahmut (`mahmut` / `mahmut_thought`): Iapetus (`ja-JP-Chirp3-HD-Iapetus` / `gemini-3.8-flash-tts` voice `Iapetus`, 144.6 Hz)

Every line has:
- Idiomatic, emotionally grounded Japanese dub script (`ja`)
- Turn-level acting direction (`speech_metadata.style`) tailored to the exact emotion, relationship, and scene subtext
- Point-in-time inline vocal tags (`<breath>`, `<sigh>`, `<exhales>`, `<chuckle>`, `<whispers>`)
- Clause-level `ssml_chirp3` prosody and break envelopes
"""

from __future__ import annotations

import glob
import json
import os
import sys
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
LINE_MAPS_DIR = ROOT / "narrative" / "10_VO" / "Line_Maps"
CAMPAIGN_STORY_DIR = ROOT / "content" / "patches" / "rel_0003_part1_campaign" / "story"

# ==============================================================================
# 1. NARRATOR CAMPAIGN LINES (12 LINES — Voice: Algieba, 96.0 Hz Spiritual Bass-Baritone)
# ==============================================================================
NARRATOR_CAMPAIGN_JA: dict[str, dict[str, Any]] = {
    "opening_007": {
        "ja": "彼女は袖口の下に赤い染みを隠す。彼は無言で外套を差し出した。彼女はそれを受け取り、ぬくもりが効いたのだと彼に思わせておいた。",
        "tts_text_gemini38": "<breath> 彼女は袖口の下に赤い染みを隠す。彼は無言で外套を差し出した。彼女はそれを受け取り、ぬくもりが効いたのだと彼に思わせておいた。",
        "style": "Deep, sorrowful, intimate chronicle narrator; hushed and tender, conveying unspoken heartbreak as she hides her coughed blood beneath her cuff.",
        "subtext_tr": "Fadyme'nin kan lekesini kol yeninin altına gizleyişini ve Mahmut'un pelerinini alırken onu üzmemek için ısındığına inandırışını derin, içli bir hüzünle anlatır.",
        "rate": 0.89,
        "pitch_st": -1.2,
    },
    "opening_016": {
        "ja": "イゼルドラはマフムトの盾に、七つの刻み目がある灰色の封印を残して去った。ファディメは、涙を彼に見られぬよう顔を背けた。",
        "tts_text_gemini38": "<breath> イゼルドラはマフムトの盾に、七つの刻み目がある灰色の封印を残して去った。<sigh> ファディメは、涙を彼に見られぬよう顔を背けた。",
        "style": "Solemn, grave gothic chronicle narrator; resonant low bass on the seven-notched seal, softening into quiet grief as Fadyme hides her tears.",
        "subtext_tr": "Yseldra'nın kalkan üzerinde bıraktığı yedi çentikli mührü ve Fadyme'nin gözyaşlarını Mahmut'tan saklamak için başını çevirişini ağırbaşlı bir kederle anlatır.",
        "rate": 0.88,
        "pitch_st": -1.4,
    },
    "ch1_camp_003": {
        "ja": "焚き火の明かりの向こうで、ひび割れた鐘が一度だけ鳴り、そして静まった。",
        "tts_text_gemini38": "<breath> 焚き火の明かりの向こうで、ひび割れた鐘が一度だけ鳴り、そして静まった。",
        "style": "Hushed, eerie nocturnal chronicle narrator; taut stillness in the dark forest beyond the campfire.",
        "subtext_tr": "Kamp ateşinin ötesindeki karanlıkta çatlak bir çanın tek bir kez çalıp susmasını ürpertici bir dinginlikle anlatır.",
        "rate": 0.90,
        "pitch_st": -1.3,
    },
    "node_1_2_post_006": {
        "ja": "ブリンが正式に一行へと加わった。ニクシーとケラは次の道のりまで同行し、祠の守り手は一行に『最初の誓いの招待状』を託した。",
        "tts_text_gemini38": "ブリンが正式に一行へと加わった。ニクシーとケラは次の道のりまで同行し、祠の守り手は一行に『最初の誓いの招待状』を託した。",
        "style": "Serene, dignified chronicle narrator recording a fellowship milestone along the ash road.",
        "subtext_tr": "Brin'in kalıcı olarak gruba katılışını ve tapınak bekçisinin İlk Yemin Davetiyesi'ni verişini vakur bir kronik diliyle aktarır.",
        "rate": 0.92,
        "pitch_st": -1.0,
    },
    "node_1_4_post_004": {
        "ja": "ニクシーが正式に仲間となった。マフムト、ファディメ、ブリン、ニクシー、そして誓いに応えた旅人——一行は五人の絆となった。",
        "tts_text_gemini38": "ニクシーが正式に仲間となった。マフムト、ファディメ、ブリン、ニクシー、そして誓いに応えた旅人——一行は五人の絆となった。",
        "style": "Warm, resonant chronicle narrator marking the formation of the five-hero company.",
        "subtext_tr": "Nixie'nin kalıcı katılımıyla beş kişilik çekirdek birliğin tamamlanışını sıcak ve vakur bir tonla anlatır.",
        "rate": 0.92,
        "pitch_st": -0.9,
    },
    "ch3_road_006": {
        "ja": "彼女は笑い、それから咳き込み、彼に見られる前に襟巻きへと顔を埋めた。",
        "tts_text_gemini38": "<breath> 彼女は笑い、それから咳き込み、<sigh> 彼に見られる前に襟巻きへと顔を埋めた。",
        "style": "Quietly heartbreaking, intimate chronicle narration; gentle warmth on 'she laughed', darkening into hushed sorrow as she hides her cough in her scarf.",
        "subtext_tr": "Fadyme'nin gülerken aniden öksürmeye başlayıp Mahmut görmeden yüzünü atkısına gömüşünü iç burkan bir incelikle anlatır.",
        "rate": 0.88,
        "pitch_st": -1.3,
    },
    "node_3_4_post_004": {
        "ja": "ジョリが正式に一行へと加わった。",
        "tts_text_gemini38": "ジョリが正式に一行へと加わった。",
        "style": "Calm, steady chronicle narrator noting a new companion joining the road.",
        "subtext_tr": "Jori'nin kalıcı olarak birliğe katılışını dingin bir kronik tonuyla bildirir.",
        "rate": 0.92,
        "pitch_st": -1.0,
    },
    "ch5_camp_006": {
        "ja": "この夜ばかりは、彼女が見張りに立ち、彼が眠りについた。",
        "tts_text_gemini38": "<breath> この夜ばかりは、彼女が見張りに立ち、彼が眠りについた。",
        "style": "Deeply tender, peaceful nocturnal narration; soft warmth as Fadyme finally keeps watch while the exhausted knight sleeps.",
        "subtext_tr": "İlk kez Fadyme'nin nöbet tutup yorgun düşen Mahmut'un uyuduğu o nadir ve şefkatli geceyi yumuşak bir huzurla anlatır.",
        "rate": 0.88,
        "pitch_st": -0.8,
    },
    "node_5_4_post_006": {
        "ja": "彼女は答えない。初めて彼はその問いを手放さず、そして初めて、彼女には返す言葉が用意されていなかった。",
        "tts_text_gemini38": "<breath> 彼女は答えない。初めて彼はその問いを手放さず、そして初めて、彼女には返す言葉が用意されていなかった。",
        "style": "Hushed, tense, emotionally heavy chronicle narration; the quiet turning point where her mask begins to crack.",
        "subtext_tr": "Mahmut'un ilk kez sorunun peşini bırakmadığı ve Fadyme'nin ilk kez hazır bir bahanesinin olmadığı o sessiz kırılma anını anlatır.",
        "rate": 0.87,
        "pitch_st": -1.4,
    },
    "ch7_road_006": {
        "ja": "眼下の階段の麓で、小さな角灯の明かりが揺れていた。仲間たちは、すでにそこで待っていた。",
        "tts_text_gemini38": "<breath> 眼下の階段の麓で、小さな角灯の明かりが揺れていた。仲間たちは、すでにそこで待っていた。",
        "style": "Warm, quietly hopeful chronicle narration; a gentle lift in the voice as lantern light reveals their loyal companions waiting below.",
        "subtext_tr": "Merdivenlerin dibinde titreyen fener ışığını ve onları bekleyen dostlarını umut dolu, sıcak bir sesle anlatır.",
        "rate": 0.90,
        "pitch_st": -0.7,
    },
    "confession_013": {
        "ja": "ひと息の間だけ、頭上の蝕が薄れた。ファディメの指がマフムトの指を見つけ、彼女の肌の下にある闇は、それでも退かなかった。",
        "tts_text_gemini38": "<breath> ひと息の間だけ、頭上の蝕が薄れた。ファディメの指がマフムトの指を見つけ、<sigh> 彼女の肌の下にある闇は、それでも退かなかった。",
        "style": "Deeply moving, tragic yet tender chronicle narration; intimate reverence as their fingers intertwine beneath the thinning eclipse.",
        "subtext_tr": "Tutulmanın bir nefeslik aralanışını, Fadyme'nin parmaklarının Mahmut'un elini buluşunu ama derisinin altındaki karanlığın çekilmeyişini trajik bir zarafetle anlatır.",
        "rate": 0.86,
        "pitch_st": -1.5,
    },
    "ending_narration_001": {
        "ja": "針のない懐中時計が、一度だけ時を刻んだ。祭壇の遥か下で、ひとつの鐘がそれに応えた。",
        "tts_text_gemini38": "<breath> 針のない懐中時計が、一度だけ時を刻んだ。祭壇の遥か下で、ひとつの鐘がそれに応えた。",
        "style": "Ominous, haunting final chronicle narration; low, lingering bass resonance as the handless watch ticks and a deep bell answers from the abyss.",
        "subtext_tr": "Akrepsiz saatin tek bir kez tıkırdamasını ve sunağın derinliklerinden bir çanın ona karşılık verişini ürpertici bir final tonuyla anlatır.",
        "rate": 0.86,
        "pitch_st": -1.8,
    },
}

# ==============================================================================
# 2. MAHMUT CAMPAIGN LINES (92 STORY LINES + 11 BATTLE/MENU VO LINES = 103 LINES)
#    Voice: Iapetus (`ja-JP-Chirp3-HD-Iapetus`, 144.6 Hz Grounded Knight Baritone)
# ==============================================================================
MAHMUT_CAMPAIGN_JA: dict[str, dict[str, Any]] = {
    # --- Opening Sad Scene ---
    "opening_003": {
        "ja": "夕餉を抜いただろう。焦げなかった分を、取っておいた。",
        "tts_text_gemini38": "<breath> 夕餉を抜いただろう。焦げなかった分を、取っておいた。",
        "style": "Gentle, understated, caring low baritone; a quiet knight offering saved bread by the fire without making a fuss.",
        "subtext_tr": "Akşam yemeğini kaçıran Fadyme'ye yanmamış kısmı ayırdığını gösterişsiz, şefkatli bir sesle söyler.",
        "rate": 0.92,
        "pitch_st": -0.8,
    },
    "opening_005": {
        "ja": "……手が、震えているぞ。",
        "tts_text_gemini38": "<breath> ……手が、震えているぞ。",
        "style": "Quiet, attentive concern in a low baritone; noticing her trembling fingers in the cold.",
        "subtext_tr": "Fadyme'nin elinin titrediğini fark edip alçak, endişeli bir sesle uyarır.",
        "rate": 0.90,
        "pitch_st": -1.0,
    },
    "opening_009": {
        "ja": "お前には、指一本触れさせん。どこへも連れて行かせはしない。",
        "tts_text_gemini38": "お前には、指一本触れさせん。どこへも連れて行かせはしない。",
        "style": "Low, dangerous, unyielding protective baritone; stepping between Fadyme and the Bell-Widow with shield raised.",
        "subtext_tr": "Kalkanını kaldırıp Fadyme ile Çan Dulunun arasına girer; tavizsiz ve tehditkâr bir kararlılıkla konuşur.",
        "rate": 0.94,
        "pitch_st": -1.3,
    },
    "opening_011": {
        "ja": "なら、俺の盾の後ろにいない者を勝手に選ぶがいい。",
        "tts_text_gemini38": "なら、俺の盾の後ろにいない者を、勝手に選ぶがいい。",
        "style": "Defiant, iron-willed knight baritone; challenging fate itself without raising his voice into a shout.",
        "subtext_tr": "'Öyleyse kalkanımın arkasında olmayan birini seçsin' diyerek kadere meydan okur.",
        "rate": 0.94,
        "pitch_st": -1.2,
    },
    "opening_013": {
        "ja": "……いや。知らん。",
        "tts_text_gemini38": "<breath> ……いや。知らん。",
        "style": "Slightly too-quick, guarded baritone; a protective lie spoken hurriedly in the rain to spare Fadyme fear.",
        "subtext_tr": "Fadyme korkmasın diye Yseldra'yı tanımadığını gereğinden biraz fazla hızlı söyleyerek yalan söyler.",
        "rate": 0.98,
        "pitch_st": -0.9,
    },
    # --- Chapter 1 ---
    "node_1_1_pre_001": {
        "ja": "狼が三頭だ。俺の盾の後ろにいろ。",
        "tts_text_gemini38": "狼が三頭だ。俺の盾の後ろにいろ。",
        "style": "Alert, commanding combat baritone; calm tactical authority as ash wolves emerge.",
        "subtext_tr": "Üç kurdu tespit eder etmez Fadyme'yi kalkanının arkasına alır.",
        "rate": 0.96,
        "pitch_st": -1.1,
    },
    "node_1_1_post_001": {
        "ja": "鐘が止んだ途端、最後の一頭は逃げていったな。",
        "tts_text_gemini38": "<exhales> 鐘が止んだ途端、最後の一頭は逃げていったな。",
        "style": "Watchful, post-battle low baritone; lowering his weapon slightly while scanning the mist.",
        "subtext_tr": "Çan sesi kesilince son kurdun kaçtığını dikkatle gözlemler.",
        "rate": 0.93,
        "pitch_st": -0.9,
    },
    "node_1_2_pre_002": {
        "ja": "ひとりで支えなくていい。俺たちも手を貸す。",
        "tts_text_gemini38": "ひとりで支えなくていい。俺たちも手を貸す。",
        "style": "Steady, reassuring baritone; stepping in to shoulder the collapsing shrine beam beside Brin.",
        "subtext_tr": "Çöken kirişi tek başına tutmaya çalışan Brin'e güven veren bir sesle yardıma gelir.",
        "rate": 0.94,
        "pitch_st": -0.8,
    },
    "node_1_2_post_002": {
        "ja": "次の祠よりも、ずいぶん遠い場所だな。",
        "tts_text_gemini38": "<exhales> 次の祠よりも、ずいぶん遠い場所だな。",
        "style": "Wry, dryly observant baritone; understated veteran humor.",
        "subtext_tr": "Bir sonraki tapınaktan çok daha uzak bir hedef olduğunu kuru bir mizahla belirtir.",
        "rate": 0.93,
        "pitch_st": -0.7,
    },
    "node_1_3_pre_002": {
        "ja": "死者どもを片づけたあとで、一緒に集めるのを手伝おう。",
        "tts_text_gemini38": "死者どもを片づけたあとで、一緒に集めるのを手伝おう。",
        "style": "Calm, practical, grounded baritone; offering help once the immediate danger is cleared.",
        "subtext_tr": "Önce ölüleri temizleyip ardından eşyaları toplamaya yardım edeceklerini sakin bir dille söyler.",
        "rate": 0.94,
        "pitch_st": -0.8,
    },
    "node_1_4_pre_002": {
        "ja": "木に登って、それを知ったというのか？",
        "tts_text_gemini38": "木に登って、それを知ったというのか？",
        "style": "Dryly skeptical, amused low baritone; raising an eyebrow at Nixie up in the branches.",
        "subtext_tr": "Ağaca tırmanarak mı bunu öğrendiğini sorarken hafif şüpheci ama tatlı bir şaşkınlık taşır.",
        "rate": 0.94,
        "pitch_st": -0.6,
    },
    "node_1_5_pre_002": {
        "ja": "前衛は踏みとどまれ！　後衛は、顎が開く瞬間を待て！",
        "tts_text_gemini38": "前衛は踏みとどまれ！ 後衛は、顎が開く瞬間を待て！",
        "style": "Urgent, commanding battlefield baritone; leading the formation against the cursed beast.",
        "subtext_tr": "Ön hattı sabit tutarken arka hatta canavarın çenesinin açılmasını beklemeleri için net bir savaş emri verir.",
        "rate": 0.98,
        "pitch_st": -1.1,
    },
    "node_1_5_post_003": {
        "ja": "……お前の手、氷のように冷たいぞ。",
        "tts_text_gemini38": "<breath> ……お前の手、氷のように冷たいぞ。",
        "style": "Deep, hushed concern; holding her freezing hand in the rain after the boss fight.",
        "subtext_tr": "Savaş sonrası Fadyme'nin buz kesmiş elini tuttuğunda sesindeki sertlik yerini derin bir endişeye bırakır.",
        "rate": 0.89,
        "pitch_st": -1.0,
    },
    "ch1_first_oath_002": {
        "ja": "礼なら要らん。報酬を求めてやったことじゃない。",
        "tts_text_gemini38": "礼なら要らん。報酬を求めてやったことじゃない。",
        "style": "Modest, wary knight baritone; declining payment out of quiet honor.",
        "subtext_tr": "Karşılık beklemediklerini ağırbaşlı bir şövalye tevazusuyla söyler.",
        "rate": 0.93,
        "pitch_st": -0.9,
    },
    "ch1_camp_004": {
        "ja": "……あいつだ。",
        "tts_text_gemini38": "<breath> ……あいつだ。",
        "style": "Low, hard, grim baritone; recognizing the Bell-Widow's bell in the dark.",
        "subtext_tr": "Karanlıkta çalan çanın Yseldra'ya ait olduğunu sert ve karanlık bir sesle mırıldanır.",
        "rate": 0.88,
        "pitch_st": -1.4,
    },
    "ch1_camp_007": {
        "ja": "眠れ。見張りは俺が立つ。",
        "tts_text_gemini38": "<breath> 眠れ。見張りは俺が立つ。",
        "style": "Warm, protective nocturnal baritone; quiet and steady beside the campfire.",
        "subtext_tr": "Fadyme'ye uyumasını, nöbeti kendisinin tutacağını güven veren yumuşak bir sesle söyler.",
        "rate": 0.90,
        "pitch_st": -0.9,
    },
    # --- Chapter 2 ---
    "node_2_1_pre_002": {
        "ja": "俺たちで開ける。下がっていろ。",
        "tts_text_gemini38": "俺たちで開ける。下がっていろ。",
        "style": "Steady, resolute baritone before the sunken cathedral doors.",
        "subtext_tr": "Katedral kapısını açacaklarını kararlı ve sakin bir sesle söyler.",
        "rate": 0.94,
        "pitch_st": -0.9,
    },
    "node_2_2_pre_002": {
        "ja": "巡礼者たちを、無事に通せるか？",
        "tts_text_gemini38": "巡礼者たちを、無事に通せるか？",
        "style": "Focused, concerned baritone prioritizing civilian safety.",
        "subtext_tr": "Hacıları güvenle geçirip geçiremeyeceklerini endişeyle sorar.",
        "rate": 0.94,
        "pitch_st": -0.9,
    },
    "node_2_3_post_002": {
        "ja": "そこに誰の名があるべきか、お前には分かっているんだな。",
        "tts_text_gemini38": "<breath> そこに誰の名があるべきか、お前には分かっているんだな。",
        "style": "Measured, perceptive low baritone; quietly realizing Fadyme recognizes the erased name.",
        "subtext_tr": "Silinen ismin kime ait olduğunu Fadyme'nin bildiğini dikkatli ve ölçülü bir sesle fark eder.",
        "rate": 0.90,
        "pitch_st": -1.0,
    },
    "node_2_4_pre_003": {
        "ja": "その誓約を書いたのは、誰だ？",
        "tts_text_gemini38": "その誓約を書いたのは、誰だ？",
        "style": "Direct, firm, probing baritone demanding the truth.",
        "subtext_tr": "O vaadi kimin yazdığını doğrudan ve net bir şekilde sorar.",
        "rate": 0.93,
        "pitch_st": -1.1,
    },
    "node_2_4_post_002": {
        "ja": "慈悲なら、ページを破り取る必要などないはずだ。",
        "tts_text_gemini38": "慈悲なら、ページを破り取る必要などないはずだ。",
        "style": "Grim, skeptical baritone; seeing through the excuse of a torn ledger page.",
        "subtext_tr": "Merhametin yırtılmış bir sayfaya ihtiyaç duymayacağını sert bir gerçekçilikle söyler.",
        "rate": 0.92,
        "pitch_st": -1.1,
    },
    "node_2_5_pre_002": {
        "ja": "なら、今すぐここで話せ！",
        "tts_text_gemini38": "なら、今すぐここで話せ！",
        "style": "Angry, confrontational baritone confronting the Bell-Widow inside the cathedral.",
        "subtext_tr": "Çan Duluna öfkeyle gerçeği hemen orada söylemesini emreder.",
        "rate": 0.96,
        "pitch_st": -1.2,
    },
    "node_2_5_pre_008": {
        "ja": "……今はいい。あとで話す。",
        "tts_text_gemini38": "<breath> ……今はいい。あとで話す。",
        "style": "Tight, strained baritone; caught in his earlier lie as battle begins.",
        "subtext_tr": "Fadyme'nin sorusu karşısında sıkışmış, gergin bir sesle 'Şimdi değil' der.",
        "rate": 0.92,
        "pitch_st": -1.1,
    },
    "node_2_5_post_001": {
        "ja": "……逃げられたか。",
        "tts_text_gemini38": "<exhales> ……逃げられたか。",
        "style": "Frustrated, low baritone exhale as the Bell-Widow vanishes into the mist.",
        "subtext_tr": "Yseldra'nın kaçışına öfke ve hayal kırıklığıyla iç geçirir.",
        "rate": 0.91,
        "pitch_st": -1.1,
    },
    "ch2_road_003": {
        "ja": "……そんな話は、一度も聞かなかったな。",
        "tts_text_gemini38": "<breath> ……そんな話は、一度も聞かなかったな。",
        "style": "Gentle, wistful low baritone; realizing how much of Fadyme's childhood she kept hidden.",
        "subtext_tr": "Fadyme'nin çocukluğuna dair bunu kendisine hiç anlatmadığını yumuşak, buruk bir sesle söyler.",
        "rate": 0.90,
        "pitch_st": -0.8,
    },
    "ch2_camp_002": {
        "ja": "……ああ。知っていた。",
        "tts_text_gemini38": "<sigh> ……ああ。知っていた。",
        "style": "Low, quiet admission in the dark; dropping his guard with honest regret.",
        "subtext_tr": "Gece kampında başını eğip Yseldra'yı tanıdığını alçak sesle itiraf eder.",
        "rate": 0.87,
        "pitch_st": -1.2,
    },
    "ch2_camp_004": {
        "ja": "お前があいつのことを知らなければ……怯えずに済むと思ったんだ。",
        "tts_text_gemini38": "<breath> お前があいつのことを知らなければ…… <sigh> 怯えずに済むと思ったんだ。",
        "style": "Ashamed, vulnerable baritone; a clumsy, heartfelt confession of a knight who only wanted to shield her from fear.",
        "subtext_tr": "Utanç ve mahcubiyetle, 'Onu tanımazsan senden korkmazsın sandım' diyerek içini döker.",
        "rate": 0.88,
        "pitch_st": -1.1,
    },
    "ch2_camp_008": {
        "ja": "……俺には、もったいないほど優しい取引だな。",
        "tts_text_gemini38": "<exhales> ……俺には、もったいないほど優しい取引だな。",
        "style": "Tired, deeply grateful, warm low baritone; touched by Fadyme's forgiveness.",
        "subtext_tr": "Fadyme'nin anlayışı karşısında yorgun ama derin bir minnetle gülümser.",
        "rate": 0.89,
        "pitch_st": -0.9,
    },
    # --- Chapter 3 ---
    "node_3_1_pre_002": {
        "ja": "誰が、その名を奪った？",
        "tts_text_gemini38": "誰が、その名を奪った？",
        "style": "Watchful, serious baritone investigating the stolen village names.",
        "subtext_tr": "İsimleri kimin aldığını dikkatli ve ciddi bir tonla sorar.",
        "rate": 0.93,
        "pitch_st": -1.0,
    },
    "node_3_1_post_003": {
        "ja": "なら、奪われた名前をひとつ残らず取り戻すまでだ。",
        "tts_text_gemini38": "なら、奪われた名前をひとつ残らず取り戻すまでだ。",
        "style": "Resolved, steady knight baritone; making a quiet vow to the villagers.",
        "subtext_tr": "Çalınan isimleri geri vereceklerini sarsılmaz bir kararlılıkla söyler.",
        "rate": 0.93,
        "pitch_st": -1.0,
    },
    "node_3_2_post_001": {
        "ja": "住民が全員逃げるまで、ひとりで門を守り抜いたんだな。見事だった。",
        "tts_text_gemini38": "住民が全員逃げるまで、ひとりで門を守り抜いたんだな。見事だった。",
        "style": "Respectful, warm veteran baritone honoring a fellow defender's stand.",
        "subtext_tr": "Herkes kaçana kadar kapıyı tutan savaşçıyı samimi bir asker saygısıyla takdir eder.",
        "rate": 0.93,
        "pitch_st": -0.8,
    },
    "node_3_3_pre_001": {
        "ja": "ファディメ、左翼を頼む！　井戸の周りは俺が抑える！",
        "tts_text_gemini38": "ファディメ、左翼を頼む！ 井戸の周りは俺が抑える！",
        "style": "Crisp, commanding battle baritone amidst the burning village.",
        "subtext_tr": "Yangın ortasında Fadyme'yi sol kanada yönlendirip kuyunun savunmasını üstlenir.",
        "rate": 0.97,
        "pitch_st": -1.0,
    },
    "node_3_3_post_001": {
        "ja": "……籠手に、赤い血がついている。俺の血じゃない。",
        "tts_text_gemini38": "<breath> ……籠手に、赤い血がついている。俺の血じゃない。",
        "style": "Sudden, quiet alarm and concern; staring at the bloodstain on his gauntlet.",
        "subtext_tr": "Zırh eldivenindeki kanı fark edip endişeyle Fadyme'ye bakar.",
        "rate": 0.90,
        "pitch_st": -1.1,
    },
    "node_3_4_post_003": {
        "ja": "ああ。この道には、もうひとり分の余地くらいあるさ。",
        "tts_text_gemini38": "<chuckle> ああ。この道には、もうひとり分の余地くらいあるさ。",
        "style": "Warm, welcoming low baritone; inviting Jori into the company.",
        "subtext_tr": "Yolda bir kişilik daha yer olduğunu sıcak ve dostane bir sesle söyler.",
        "rate": 0.93,
        "pitch_st": -0.7,
    },
    "node_3_5_pre_002": {
        "ja": "貴様らの命令書とやらは、臆病者が書いたものだ。",
        "tts_text_gemini38": "貴様らの命令書とやらは、臆病者が書いたものだ。",
        "style": "Cold, angry, contemptuous knight baritone condemning the mercenary captain's orders.",
        "subtext_tr": "Emirlerinin korkaklar tarafından yazıldığını sert bir öfkeyle yüzlerine vurur.",
        "rate": 0.94,
        "pitch_st": -1.3,
    },
    "node_3_5_post_002": {
        "ja": "その頭文字に、何か心当たりがあるのか？",
        "tts_text_gemini38": "<breath> その頭文字に、何か心当たりがあるのか？",
        "style": "Attentive, questioning baritone watching Fadyme's reaction to the initials 'C.V.'",
        "subtext_tr": "C.V. baş harflerinin Fadyme'ye bir şey ifade edip etmediğini dikkatle sorar.",
        "rate": 0.92,
        "pitch_st": -0.9,
    },
    "node_3_5_post_006": {
        "ja": "分かった。治療師が見つかるまで、封を切らずに俺が預かろう。",
        "tts_text_gemini38": "分かった。治療師が見つかるまで、封を切らずに俺が預かろう。",
        "style": "Steady, reassuring baritone respecting Fadyme's wish to find a healer first.",
        "subtext_tr": "Şifacı bulunana kadar emri mührünü açmadan taşıyacağına söz verir.",
        "rate": 0.92,
        "pitch_st": -0.8,
    },
    "ch3_road_001": {
        "ja": "次の石垣のところで、少し休もう。",
        "tts_text_gemini38": "次の石垣のところで、少し休もう。",
        "style": "Casual, unforced baritone; pretending he wants to stop so Fadyme can catch her breath without pride being hurt.",
        "subtext_tr": "Fadyme'nin yorulduğunu fark edip sanki normal bir mola veriyormuş gibi doğal bir sesle bir sonraki duvarda durmayı önerir.",
        "rate": 0.93,
        "pitch_st": -0.7,
    },
    "ch3_road_003": {
        "ja": "……どれも、いい石垣だったからな。",
        "tts_text_gemini38": "<exhales> ……どれも、いい石垣だったからな。",
        "style": "Deadpan, affectionate dry humor; keeping up the gentle excuse for stopping at every wall.",
        "subtext_tr": "Önceki duvarlarda da durduklarını hatırlatan Fadyme'ye 'Hepsi güzel duvarlardı' diyerek kuru bir şefkatle karşılık verir.",
        "rate": 0.92,
        "pitch_st": -0.7,
    },
    "ch3_road_005": {
        "ja": "石垣のために、歩調を合わせているだけだ。",
        "tts_text_gemini38": "<chuckle> 石垣のために、歩調を合わせているだけだ。",
        "style": "Warm, deadpan fondness; a quiet smile in his voice as he matches her slower steps.",
        "subtext_tr": "Adımlarını ona göre yavaşlattığını fark eden Fadyme'ye tatlı bir inatla 'Duvarlar için tempomu ayarlıyorum' der.",
        "rate": 0.92,
        "pitch_st": -0.6,
    },
    "ch3_camp_006": {
        "ja": "なら、地下へ降りよう。",
        "tts_text_gemini38": "なら、地下へ降りよう。",
        "style": "Decisive, grounded baritone setting the course for the Undercity.",
        "subtext_tr": "Kararlı bir şekilde yeraltı şehrine inme kararını verir.",
        "rate": 0.94,
        "pitch_st": -1.0,
    },
    # --- Chapter 4 ---
    "node_4_1_pre_002": {
        "ja": "どうやって、この地下道を見つけたんだ？",
        "tts_text_gemini38": "どうやって、この地下道を見つけたんだ？",
        "style": "Curious, low baritone echoing softly in the damp undercity.",
        "subtext_tr": "Tüneli nasıl bulduklarını merakla sorar.",
        "rate": 0.93,
        "pitch_st": -0.9,
    },
    "node_4_4_pre_001": {
        "ja": "……錬金術師は、何と言っていた？",
        "tts_text_gemini38": "<breath> ……錬金術師は、何と言っていた？",
        "style": "Careful, anxiously hopeful baritone; afraid of the answer yet desperate for good news.",
        "subtext_tr": "Simyacının ne dediğini hem umutla hem de kötü bir şey duymaktan korkarak dikkatle sorar.",
        "rate": 0.90,
        "pitch_st": -0.9,
    },
    "node_4_4_post_002": {
        "ja": "……今夜は、もう十分だ。休め。",
        "tts_text_gemini38": "<exhales> ……今夜は、もう十分だ。休め。",
        "style": "Tired, gentle baritone letting the day's weight settle.",
        "subtext_tr": "Bu gecelik bu kadarının yettiğini, artık dinlenmeleri gerektiğini yorgun ve şefkatli bir sesle söyler.",
        "rate": 0.89,
        "pitch_st": -1.0,
    },
    "node_4_5_post_003": {
        "ja": "必ず戻ってくる。約束する。",
        "tts_text_gemini38": "必ず戻ってくる。約束する。",
        "style": "Earnest, unwavering baritone making a knight's promise.",
        "subtext_tr": "Geri döneceklerine dair sarsılmaz bir şövalye sözü verir.",
        "rate": 0.92,
        "pitch_st": -0.9,
    },
    "ch4_road_004": {
        "ja": "下では俺のそばを離れるな。あの暗がりは、森の闇とは違う。",
        "tts_text_gemini38": "下では俺のそばを離れるな。あの暗がりは、森の闇とは違う。",
        "style": "Protective, hushed baritone warning her as they descend.",
        "subtext_tr": "Aşağıdaki karanlığın ormanınkine benzemediğini söyleyerek Fadyme'yi yakınına çağırır.",
        "rate": 0.92,
        "pitch_st": -1.0,
    },
    "ch4_camp_001": {
        "ja": "……笑っているな。",
        "tts_text_gemini38": "<breath> ……笑っているな。",
        "style": "Softly surprised, warm baritone; relieved to see Fadyme smiling in the sunlight.",
        "subtext_tr": "Güneşin altında gülümseyen Fadyme'ye tatlı bir şaşkınlık ve huzurla bakar.",
        "rate": 0.90,
        "pitch_st": -0.6,
    },
    "ch4_camp_003": {
        "ja": "例の霊薬か。……ケラは、いつ頃になると？",
        "tts_text_gemini38": "<breath> 例の霊薬か。……ケラは、いつ頃になると？",
        "style": "Quietly hopeful baritone; clinging to the small lie that Kera's elixir might cure her.",
        "subtext_tr": "İksirin işe yarayabileceği umuduna tutunarak Kera'nın ne zaman biteceğini söylediğini sorar.",
        "rate": 0.92,
        "pitch_st": -0.7,
    },
    "ch4_camp_006": {
        "ja": "なら、東へ向かおう。祭壇への道は、渓谷を越える。",
        "tts_text_gemini38": "なら、東へ向かおう。祭壇への道は、渓谷を越える。",
        "style": "Resolved, steady baritone with renewed purpose.",
        "subtext_tr": "Umutla güç bularak doğuya, vadiyi aşan sunak yoluna doğru yönü belirler.",
        "rate": 0.94,
        "pitch_st": -0.9,
    },
    # --- Chapter 5 ---
    "node_5_1_pre_002": {
        "ja": "この街道が覚えているのは……もうどこにもいない、昔の俺だ。",
        "tts_text_gemini38": "<sigh> この街道が覚えているのは……もうどこにもいない、昔の俺だ。",
        "style": "Guarded, somber baritone carrying old military scars at the Shattered Bridge.",
        "subtext_tr": "Yolun artık var olmayan eski halini hatırladığını buruk ve mesafeli bir sesle söyler.",
        "rate": 0.89,
        "pitch_st": -1.2,
    },
    "node_5_2_pre_002": {
        "ja": "民間人を守っていてくれ。巻き上げ機は俺たちが奪う。",
        "tts_text_gemini38": "民間人を守っていてくれ。巻き上げ機は俺たちが奪う。",
        "style": "Certain, tactical baritone coordinating the bridge defense.",
        "subtext_tr": "Sivillerin korunmasını isteyip vinçleri kendilerinin alacağını net bir dille bildirir.",
        "rate": 0.95,
        "pitch_st": -1.0,
    },
    "node_5_3_post_002": {
        "ja": "……俺の上官が、これに署名を？",
        "tts_text_gemini38": "<breath> ……俺の上官が、これに署名を？",
        "style": "Stunned, disbelieving low baritone; staring at his former commander's signature on the betrayal order.",
        "subtext_tr": "Eski komutanının imzasını gördüğünde sarsılmış, inanmakta güçlük çeken bir sesle konuşur.",
        "rate": 0.88,
        "pitch_st": -1.1,
    },
    "node_5_4_pre_003": {
        "ja": "……声が変わったぞ。どこか痛むのか？",
        "tts_text_gemini38": "<breath> ……声が変わったぞ。どこか痛むのか？",
        "style": "Immediate, sharp concern; hearing the slightest tremor in Fadyme's voice.",
        "subtext_tr": "Fadyme'nin sesindeki en ufak değişimi bile anında fark edip endişeyle yaralı olup olmadığını sorar.",
        "rate": 0.91,
        "pitch_st": -1.0,
    },
    "node_5_4_post_002": {
        "ja": "……あの森を出てからずっと、お前は疲れている。",
        "tts_text_gemini38": "<breath> ……あの森を出てからずっと、お前は疲れている。",
        "style": "Quiet, serious, unyielding baritone; no longer accepting her polite deflections.",
        "subtext_tr": "Ormandan beri yorgun olduğunu söyleyerek artık Fadyme'nin kaçamak cevaplarını kabul etmez.",
        "rate": 0.88,
        "pitch_st": -1.1,
    },
    "node_5_4_post_005": {
        "ja": "『一貫している』ことと、『無事である』ことは同じじゃない。",
        "tts_text_gemini38": "『一貫している』ことと、『無事である』ことは、同じじゃない。",
        "style": "Quiet, piercing honesty in a low baritone; gently stripping away her witty mask.",
        "subtext_tr": "'Tutarlı olmakla iyi olmak aynı şey değil' diyerek Fadyme'nin şaka maskesini sessizce indirir.",
        "rate": 0.88,
        "pitch_st": -1.1,
    },
    "node_5_5_pre_002": {
        "ja": "それでも、彼女を追わせるだけのことは知っていたはずだ。",
        "tts_text_gemini38": "それでも、彼女を追わせるだけのことは知っていたはずだ。",
        "style": "Low, controlled anger confronting Commander Oren on the bridge.",
        "subtext_tr": "Yine de peşine adam takacak kadarını bildiğini bastırılmış bir öfkeyle yüzüne vurur.",
        "rate": 0.93,
        "pitch_st": -1.3,
    },
    "node_5_5_post_002": {
        "ja": "あんたも、俺たちと一緒に来てもらう。",
        "tts_text_gemini38": "あんたも、俺たちと一緒に来てもらう。",
        "style": "Hard, uncompromising baritone taking his former commander into custody.",
        "subtext_tr": "Sert ve tavizsiz bir sesle bizimle geleceğini söyler.",
        "rate": 0.93,
        "pitch_st": -1.2,
    },
    "ch5_road_002": {
        "ja": "どこの兵だ？",
        "tts_text_gemini38": "どこの兵だ？",
        "style": "Hard, alert baritone spotting armed figures in the fog.",
        "subtext_tr": "Sisin içindeki askerlerin kime ait olduğunu sertçe sorar.",
        "rate": 0.95,
        "pitch_st": -1.2,
    },
    "ch5_road_005": {
        "ja": "逆さに掲げられた王冠の旗……。オレンは昔から、だらしない軍旗を嫌っていたな。",
        "tts_text_gemini38": "<breath> 逆さに掲げられた王冠の旗……。オレンは昔から、だらしない軍旗を嫌っていたな。",
        "style": "Internal monologue in a grim, hushed baritone; recognizing his old commander's signal.",
        "subtext_tr": "İç sesiyle ters asılmış kraliyet sancağını ve Oren'in eski alışkanlığını karanlık bir düşünceli tonla tartar.",
        "rate": 0.89,
        "pitch_st": -1.1,
    },
    "ch5_camp_002": {
        "ja": "あの人が、俺に盾の構え方を教えた。……そして、俺にその盾を捨てさせた命令書に署名した。",
        "tts_text_gemini38": "<sigh> あの人が、俺に盾の構え方を教えた。……そして、俺にその盾を捨てさせた命令書に署名した。",
        "style": "Hollow, quietly devastated baritone by the campfire; speaking of the mentor who betrayed everything he taught.",
        "subtext_tr": "Kalkan tutmayı öğreten komutanının aynı zamanda o kalkanı bıraktıran emri imzaladığını içi boşalmış, kırgın bir sesle anlatır.",
        "rate": 0.87,
        "pitch_st": -1.3,
    },
    "ch5_camp_004": {
        "ja": "……それで、あの人はマシになったのか？　それとも、もっとタチが悪いのか？",
        "tts_text_gemini38": "<breath> ……それで、あの人はマシになったのか？ それとも、もっとタチが悪いのか？",
        "style": "Raw, conflicted, unguarded baritone; asking Fadyme a question he cannot answer himself.",
        "subtext_tr": "Oren'in bu gece köprüyü korumasının onu daha mı iyi yoksa daha mı kötü yaptığını çiğ ve savunmasız bir sesle sorar.",
        "rate": 0.88,
        "pitch_st": -1.1,
    },
    # --- Chapter 6 ---
    "node_6_1_pre_003": {
        "ja": "裏通路から行け。番兵は俺たちが引きつける。",
        "tts_text_gemini38": "裏通路から行け。番兵は俺たちが引きつける。",
        "style": "Steady, low tactical baritone infiltrating the Vale Estate.",
        "subtext_tr": "Arka geçitten gitmelerini, nöbetçiyi kendilerinin oyalayacağını sakin bir kararlılıkla söyler.",
        "rate": 0.94,
        "pitch_st": -1.0,
    },
    "node_6_2_post_002": {
        "ja": "……お母上の肖像画がここにあるとは、言わなかったな。",
        "tts_text_gemini38": "<breath> ……お母上の肖像画がここにあるとは、言わなかったな。",
        "style": "Gentle, hushed baritone standing beside Fadyme before her late mother's portrait.",
        "subtext_tr": "Annesinin portresinin burada olduğunu hiç söylemediğini çok yumuşak ve saygılı bir sesle dile getirir.",
        "rate": 0.89,
        "pitch_st": -0.9,
    },
    "node_6_4_pre_001": {
        "ja": "アーチから手を離せ！　子どもは俺が抱えている！",
        "tts_text_gemini38": "アーチから手を離せ！ 子どもは俺が抱えている！",
        "style": "Urgent, commanding baritone rescuing the child under the collapsing archway.",
        "subtext_tr": "Çocuğu tuttuğunu söyleyerek Fadyme'ye çöken kemeri bırakması için acil çağrı yapar.",
        "rate": 0.98,
        "pitch_st": -1.0,
    },
    "node_6_4_post_002": {
        "ja": "あの肖像画にも……針のない懐中時計が描かれていたな。",
        "tts_text_gemini38": "<breath> あの肖像画にも……針のない懐中時計が描かれていたな。",
        "style": "Grim, observant low baritone connecting the clue in the family portrait.",
        "subtext_tr": "Portrede de akrepsiz saatin yer aldığını karanlık bir dikkatle birleştirir.",
        "rate": 0.90,
        "pitch_st": -1.2,
    },
    "node_6_5_pre_003": {
        "ja": "なら、その記憶をここで終わらせよう。",
        "tts_text_gemini38": "なら、その記憶をここで終わらせよう。",
        "style": "Solemn, commanding baritone facing the noble's wraith.",
        "subtext_tr": "O hatırayı burada sonlandıracaklarını vakur ve kararlı bir sesle söyler.",
        "rate": 0.93,
        "pitch_st": -1.1,
    },
    "node_6_5_post_004": {
        "ja": "なら、次の行が書かれる前に祭壇を見つけ出す。",
        "tts_text_gemini38": "なら、次の行が書かれる前に、祭壇を見つけ出す。",
        "style": "Resolved, urgent baritone after discovering the succession ledger.",
        "subtext_tr": "Bir sonraki satır yazılmadan önce sunağı bulacaklarını kesin bir dille söyler.",
        "rate": 0.94,
        "pitch_st": -1.1,
    },
    "ch6_road_001": {
        "ja": "……合図だ。",
        "tts_text_gemini38": "<breath> ……合図だ。",
        "style": "Alert, hushed baritone spotting the lantern signal ahead.",
        "subtext_tr": "İlerideki işareti fark edip alçak ve tetikte bir sesle uyarır.",
        "rate": 0.93,
        "pitch_st": -1.0,
    },
    "ch6_road_003": {
        "ja": "……あいつを信じるのか。",
        "tts_text_gemini38": "<breath> ……あいつを信じるのか。",
        "style": "Searching, quiet baritone asking if Fadyme truly trusts Sable.",
        "subtext_tr": "Sable'a güvenip güvenmediğini Fadyme'nin gözlerinin içine bakarak sorar.",
        "rate": 0.90,
        "pitch_st": -0.9,
    },
    "ch6_road_006": {
        "ja": "なら、あいつは俺たちより先に祭壇へ着く。",
        "tts_text_gemini38": "なら、あいつは俺たちより先に祭壇へ着く。",
        "style": "Grim, urgent baritone realizing the enemy is half a day ahead on the altar road.",
        "subtext_tr": "Düşmanın sunağa kendilerinden önce varacağını ciddiyetle saptar.",
        "rate": 0.94,
        "pitch_st": -1.2,
    },
    "ch6_camp_006": {
        "ja": "祭壇で落ち合おう。全員でだ。",
        "tts_text_gemini38": "祭壇で落ち合おう。全員でだ。",
        "style": "Resolved, steady leadership baritone uniting the company before the final ascent.",
        "subtext_tr": "Son tırmanış öncesi herkesle sunakta buluşacaklarını kararlılıkla söyler.",
        "rate": 0.93,
        "pitch_st": -1.0,
    },
    # --- Chapter 7 ---
    "node_7_1_pre_004": {
        "ja": "答えは一緒に見つける。誰ひとり、先へは行かせない。",
        "tts_text_gemini38": "答えは一緒に見つける。誰ひとり、先へは行かせない。",
        "style": "Protective, deeply devoted baritone looking directly at Fadyme.",
        "subtext_tr": "Cevabı birlikte bulacaklarını ve kimsenin tek başına önden gitmeyeceğini koruyucu bir bağlılıkla söyler.",
        "rate": 0.92,
        "pitch_st": -1.0,
    },
    "node_7_2_pre_005": {
        "ja": "あんたはもう十分すぎるほどやってくれた。皆を連れて帰れ。",
        "tts_text_gemini38": "あんたはもう十分すぎるほどやってくれた。皆を連れて帰れ。",
        "style": "Grateful, warm veteran baritone thanking an ally holding the rear.",
        "subtext_tr": "Yeterince şey yaptığını söyleyerek herkesi sağ salim eve götürmesini minnetle ister.",
        "rate": 0.93,
        "pitch_st": -0.8,
    },
    "node_7_3_post_002": {
        "ja": "……ヴェア、だと？",
        "tts_text_gemini38": "<breath> ……ヴェア、だと？",
        "style": "Surprised, hushed baritone realizing the royal house name inscribed on the altar.",
        "subtext_tr": "'Veyr mi?' diyerek Fadyme'nin gerçek soyadını duyduğundaki şaşkınlığını dile getirir.",
        "rate": 0.89,
        "pitch_st": -0.9,
    },
    "node_7_4_pre_008": {
        "ja": "ひとりで約束しなくていい。俺もここにいる。",
        "tts_text_gemini38": "<breath> ひとりで約束しなくていい。俺もここにいる。",
        "style": "Tender, unwavering baritone; sharing the weight of her promise.",
        "subtext_tr": "Tek başına söz vermek zorunda olmadığını, yanında olduğunu şefkatle söyler.",
        "rate": 0.90,
        "pitch_st": -0.8,
    },
    "node_7_4_post_003": {
        "ja": "ああ。お前が望む限り、いつまでも傍にいる。",
        "tts_text_gemini38": "<breath> ああ。お前が望む限り、いつまでも傍にいる。",
        "style": "Deeply gentle, devoted low baritone; an unconditional vow spoken quietly.",
        "subtext_tr": "Fadyme'nin 'Biraz yanımda kal' ricasına 'Sen istediğin sürece' diyerek sonsuz bir bağlılıkla karşılık verir.",
        "rate": 0.88,
        "pitch_st": -0.8,
    },
    "node_7_5_pre_001": {
        "ja": "俺たち五人だ。これより酷い戦線も、共に打ち破ってきた。",
        "tts_text_gemini38": "俺たち五人だ。これより酷い戦線も、共に打ち破ってきた。",
        "style": "Steady, inspiring knight baritone before the final altar construct.",
        "subtext_tr": "Beş kişi olduklarını ve bundan daha kötü hatları da birliktedeliklerini güvenle hatırlatır.",
        "rate": 0.94,
        "pitch_st": -1.0,
    },
    "node_7_5_pre_003": {
        "ja": "名前を求めるなら、まず俺の名前からくれてやる。",
        "tts_text_gemini38": "名前を求めるなら、まず俺の名前からくれてやる。",
        "style": "Certain, fierce, unhesitating baritone; ready to give his own name before hers.",
        "subtext_tr": "Sunak bir isim isterse önce kendi ismini alabileceğini tereddütsüz bir kararlılıkla söyler.",
        "rate": 0.94,
        "pitch_st": -1.2,
    },
    "node_7_5_phase2_002": {
        "ja": "ファディメ、俺の後ろに下がれ！",
        "tts_text_gemini38": "ファディメ、俺の後ろに下がれ！",
        "style": "Alarmed, urgent combat cry as the Eclipse Construct unleashes its phase-2 ward.",
        "subtext_tr": "İkinci aşama patlamasında telaş ve koruma içgüdüsüyle Fadyme'ye arkasına geçmesini haykırır.",
        "rate": 0.99,
        "pitch_st": -0.8,
    },
    "node_7_5_post_003": {
        "ja": "ファディメ……！？　お前の手、それは——",
        "tts_text_gemini38": "<breath> ファディメ……！？ お前の手、それは——",
        "style": "Sudden, breathless fear and shock as he sees the black curse veins spreading across her hand.",
        "subtext_tr": "Savaş bittiğinde Fadyme'nin elindeki kararmayı ilk kez görüp korku ve şokla donakalır.",
        "rate": 0.92,
        "pitch_st": -0.7,
    },
    "ch7_road_002": {
        "ja": "これが全部終わったら……どこか無骨で、安全な場所を見つけよう。",
        "tts_text_gemini38": "<exhales> これが全部終わったら……どこか無骨で、安全な場所を見つけよう。",
        "style": "Dry, warm, wistful baritone dreaming of an ordinary life after the altar.",
        "subtext_tr": "Her şey bittiğinde çirkin ama güvenli bir yer bulacaklarını kuru bir sıcaklıkla söyler.",
        "rate": 0.90,
        "pitch_st": -0.8,
    },
    "ch7_road_004": {
        "ja": "……ああ。チーズ付きでな。",
        "tts_text_gemini38": "<chuckle> ……ああ。チーズ付きでな。",
        "style": "Gentle, fond baritone with a quiet smile, echoing their shared joke.",
        "subtext_tr": "Fadyme'nin 'Peynirli olsun' sözüne çok yumuşak, sevgi dolu bir tebessümle 'Evet, peynirli' diye karşılık verir.",
        "rate": 0.89,
        "pitch_st": -0.6,
    },
    # --- Part 1 Emotional Confession (Under the Eclipse) ---
    "confession_001": {
        "ja": "……ずっと、お前はひとりでそれを背負っていたのか。",
        "tts_text_gemini38": "<breath> ……ずっと、お前はひとりでそれを背負っていたのか。",
        "style": "Shaken, hushed, heartbroken baritone; the truth of her curse finally crashing over him.",
        "subtext_tr": "Bütün bu zaman boyunca Fadyme'nin bu yükü tek başına taşıdığını anladığında sesi titreyerek konuşur.",
        "rate": 0.86,
        "pitch_st": -1.1,
    },
    "confession_003": {
        "ja": "……言ってくれるべきだった。俺にだけでも。",
        "tts_text_gemini38": "<sigh> ……言ってくれるべきだった。俺にだけでも。",
        "style": "Hurt, vulnerable, aching baritone; not angry at her, but grieving that she suffered alone.",
        "subtext_tr": "Kızgınlıktan değil, onun acıyı yalnız çekmiş olmasının verdiği derin sızıyla 'Bana söylemeliydin' der.",
        "rate": 0.86,
        "pitch_st": -1.1,
    },
    "confession_005": {
        "ja": "違う。……お前は、どんな道も『どこかへ続いている』と思わせてくれた人だ。",
        "tts_text_gemini38": "<breath> 違う。……お前は、どんな道も『どこかへ続いている』と思わせてくれた人だ。",
        "style": "Deeply tender, emotional, heartfelt baritone; telling her what she truly means to him.",
        "subtext_tr": "'Hayır, sen her yolun bir yere vardığını hissettiren kişisin' derken sesi en derin şefkat ve sevgiyle dolar.",
        "rate": 0.87,
        "pitch_st": -0.8,
    },
    "confession_007": {
        "ja": "目が覚めたときも、俺は傍にいる。",
        "tts_text_gemini38": "<breath> 目が覚めたときも、俺は傍にいる。",
        "style": "Resolved, steady, loving baritone holding her hand.",
        "subtext_tr": "'Uyandığında da yanında olacağım' diyerek sarsılmaz bir sevgiyle elini tutar.",
        "rate": 0.88,
        "pitch_st": -0.9,
    },
    "confession_009": {
        "ja": "なら、この呪いを書いた手を見つけ出す。最後の一行など、決して書かせはしない！",
        "tts_text_gemini38": "<breath> なら、この呪いを書いた手を見つけ出す。最後の一行など、決して書かせはしない！",
        "style": "Grief surging into fierce, unbreakable resolve; a knight swearing war against the author of her death.",
        "subtext_tr": "Kederi sarsılmaz bir öfkeye ve yemine dönüşür: 'Bu laneti yazan eli bulacağım, son satırı yazmasına izin vermeyeceğim!'",
        "rate": 0.93,
        "pitch_st": -1.1,
    },
    "confession_011": {
        "ja": "俺が見ているのは、お前だ。……もっと早く、気づいてやるべきだった。",
        "tts_text_gemini38": "<sigh> 俺が見ているのは、お前だ。……もっと早く、気づいてやるべきだった。",
        "style": "Remorseful, tender baritone; pulling her close with quiet sorrow and devotion.",
        "subtext_tr": "'Seni görüyorum... Daha erken görmeliydim' derken derin bir pişmanlık ve şefkatle konuşur.",
        "rate": 0.86,
        "pitch_st": -1.0,
    },
    "confession_014": {
        "ja": "なら、俺にもひとつ告白することがある。……俺はイゼルドラを知っていた。あの夜、あいつがお前を祭壇へ呼ぶのを見ていながら、知らぬと嘘をついた。",
        "tts_text_gemini38": "<breath> なら、俺にもひとつ告白することがある。<sigh> ……俺はイゼルドラを知っていた。あの夜、あいつがお前を祭壇へ呼ぶのを見ていながら、知らぬと嘘をついた。",
        "style": "Ashamed, completely honest baritone laying down his last secret before her.",
        "subtext_tr": "Son sırrını da bırakarak Yseldra'yı o gece sunağa çağırırken gördüğünü ve yalan söylediğini dürüstçe itiraf eder.",
        "rate": 0.87,
        "pitch_st": -1.1,
    },
    # --- Part 1 Clockless Reveal (Ending) ---
    "ending_mahmut_001": {
        "ja": "姿を現せ！",
        "tts_text_gemini38": "姿を現せ！",
        "style": "Low, dangerous warning baritone drawing his blade as footsteps echo on the altar stairs.",
        "subtext_tr": "Kılıcını çekip gölgelerin içindeki kişiye 'Göster kendini!' diye gürler.",
        "rate": 0.96,
        "pitch_st": -1.3,
    },
    "ending_mahmut_002": {
        "ja": "貴様が……彼女の呪いを作ったのか。",
        "tts_text_gemini38": "<breath> 貴様が……彼女の呪いを作ったのか。",
        "style": "Trembling with cold, lethal fury in a low baritone; facing the Clockless Chancellor.",
        "subtext_tr": "Fadyme'nin lanetini yazan kişinin karşısında olduğunu anladığında buz gibi, ölümcül bir öfkeyle konuşur.",
        "rate": 0.88,
        "pitch_st": -1.4,
    },
    "ending_mahmut_003": {
        "ja": "……断ると言ったら、どうする？",
        "tts_text_gemini38": "……断ると言ったら、どうする？",
        "style": "Guarded, defiant, iron-steady baritone standing between Fadyme and her uncle.",
        "subtext_tr": "Fadyme ile amcasının arasına dikilip 'Ya reddedersem?' diye meydan okur.",
        "rate": 0.90,
        "pitch_st": -1.3,
    },
    # --- Mahmut Battle & Menu VO Lines (11 Lines) ---
    "vo_mahmut_first_meeting": {
        "ja": "マフムトだ。肩書きはない。紋章なら何年も前に剥がれたが、この盾だけは残っている。",
        "tts_text_gemini38": "<breath> マフムトだ。肩書きはない。紋章なら何年も前に剥がれたが、この盾だけは残っている。",
        "style": "Grounded, weathered knight baritone introducing himself without pretension.",
        "subtext_tr": "Unvanının kalmadığını, armasının yıllar önce söküldüğünü ama kalkanının hâlâ durduğunu vakur bir sadelikle söyler.",
        "rate": 0.92,
        "pitch_st": -1.0,
    },
    "vo_mahmut_team_join": {
        "ja": "前衛は、俺が引き受ける。",
        "tts_text_gemini38": "前衛は、俺が引き受ける。",
        "style": "Steady, reliable low baritone stepping into the front line.",
        "subtext_tr": "Ön hattı devraldığını güven veren tok bir sesle bildirir.",
        "rate": 0.94,
        "pitch_st": -1.0,
    },
    "vo_mahmut_idle": {
        "ja": "俺が休むのを待っているなら、ずいぶん長い待ち時間になるぞ。",
        "tts_text_gemini38": "<exhales> 俺が休むのを待っているなら、ずいぶん長い待ち時間になるぞ。",
        "style": "Dry, quietly amused veteran baritone.",
        "subtext_tr": "Dinlenmesini bekliyorlarsa çok bekleyeceklerini kuru bir asker mizahıyla söyler.",
        "rate": 0.92,
        "pitch_st": -0.8,
    },
    "vo_mahmut_basic_attack": {
        "ja": "踏みとどまれ！",
        "tts_text_gemini38": "踏みとどまれ！",
        "style": "Firm, heavy shield-bash combat baritone.",
        "subtext_tr": "Temel saldırıda hattı tutan tok savaş komutu.",
        "rate": 0.98,
        "pitch_st": -1.1,
    },
    "vo_mahmut_active_skill": {
        "ja": "俺の後ろへ！",
        "tts_text_gemini38": "俺の後ろへ！",
        "style": "Urgent, protective vanguard baritone raising his shield wall.",
        "subtext_tr": "Aktif yetenekte müttefiklerini kalkanının arkasına alır.",
        "rate": 0.98,
        "pitch_st": -1.0,
    },
    "vo_mahmut_ultimate": {
        "ja": "ここが最後の壁だ——一歩も退くな！",
        "tts_text_gemini38": "ここが最後の壁だ——一歩も退くな！",
        "style": "Heroic, roaring yet controlled veteran commander baritone; unbreakable bastion ultimate.",
        "subtext_tr": "Ultimate yeteneğinde 'Son duvar burası, sakın geri adım atmayın!' diye kükreyen sarsılmaz komutan sesi.",
        "rate": 0.97,
        "pitch_st": -1.2,
    },
    "vo_mahmut_victory": {
        "ja": "全員、立っているか？　……なら上出来だ。",
        "tts_text_gemini38": "<exhales> 全員、立っているか？ ……なら上出来だ。",
        "style": "Relieved, grounded post-battle baritone checking on his companions first.",
        "subtext_tr": "Zafer sonrası önce herkesin ayakta olup olmadığını kontrol eder.",
        "rate": 0.92,
        "pitch_st": -0.9,
    },
    "vo_mahmut_defeat": {
        "ja": "……俺が、遅すぎたか……。",
        "tts_text_gemini38": "<sigh> ……俺が、遅すぎたか……。",
        "style": "Breathless, devastated low baritone falling to one knee.",
        "subtext_tr": "Yenilgi anında geç kaldığı için duyduğu derin pişmanlık.",
        "rate": 0.85,
        "pitch_st": -1.4,
    },
    "vo_mahmut_low_hp": {
        "ja": "……まだだ。まだ倒れん。",
        "tts_text_gemini38": "<breath> ……まだだ。まだ倒れん。",
        "style": "Gritty, strained, unyielding baritone bracing behind his cracked shield.",
        "subtext_tr": "Ağır yaralıyken bile yıkılmayı reddeden inatçı şövalye sesi.",
        "rate": 0.90,
        "pitch_st": -1.2,
    },
    "vo_mahmut_relationship_1": {
        "ja": "あいつはいつも『平気だ』と言う。……俺はもう、その回数を数えるようになった。",
        "tts_text_gemini38": "<sigh> あいつはいつも『平気だ』と言う。……俺はもう、その回数を数えるようになった。",
        "style": "Quietly worried, tender low baritone speaking of Fadyme's habit of hiding her pain.",
        "subtext_tr": "Fadyme'nin her 'İyiyim' deyişini artık endişeyle saydığını içli bir sesle anlatır.",
        "rate": 0.89,
        "pitch_st": -0.9,
    },
    "vo_mahmut_relationship_2": {
        "ja": "盾の扱いはあの人に教わった。……だが、それ以外のことで礼を言うつもりはない。",
        "tts_text_gemini38": "盾の扱いはあの人に教わった。……だが、それ以外のことで礼を言うつもりはない。",
        "style": "Somber, guarded baritone reflecting on Commander Oren.",
        "subtext_tr": "Kalkanı Oren'den öğrendiğini ama geri kalan hiçbir şey için ona teşekkür etmeyeceğini buruk bir ciddiyetle söyler.",
        "rate": 0.90,
        "pitch_st": -1.1,
    },
}

# ==============================================================================
# 3. FADYME EMOTION-SPECIFIC ACTING STYLE MAP (Sulafat, 252.6 Hz Gothic Alto)
# ==============================================================================
FADYME_EMOTION_STYLES: dict[str, tuple[str, float, float, str]] = {
    # emotion: (style_prompt, rate, pitch_st, leading_tag)
    "frightened": (
        "Hushed, trembling, vulnerable inner alto; speaking quietly to herself at night with genuine fear beneath her poise.",
        0.88, -0.3, "<breath> "
    ),
    "terrified": (
        "Breathless, shaken inner alto; fighting back terror in a near-whisper.",
        0.87, -0.2, "<breath> "
    ),
    "fear": (
        "Soft, fearful, unguarded alto; quiet dread as the curse nears her heart.",
        0.88, -0.3, "<breath> "
    ),
    "breaking": (
        "Fragile, emotionally breaking alto; voice trembling slightly at the edges while trying to hold her composure together.",
        0.86, -0.3, "<sigh> "
    ),
    "tearful": (
        "Tearful, deeply moving alto; speaking softly through unshed tears with heartbreaking sincerity.",
        0.86, -0.2, "<breath> "
    ),
    "pleading": (
        "Urgent, vulnerable, pleading alto; dropping her aristocratic mask to beg quietly from the heart.",
        0.89, 0.1, "<breath> "
    ),
    "vulnerable": (
        "Soft, unguarded, intimate alto; speaking with fragile honesty and quiet trust.",
        0.88, -0.1, "<breath> "
    ),
    "fragile": (
        "Delicate, exhausted alto; soft and slightly breathless, carrying hidden physical weakness.",
        0.87, -0.2, "<breath> "
    ),
    "strained": (
        "Strained, breathless alto; masking physical pain behind a tight, controlled cadence.",
        0.89, -0.2, "<exhales> "
    ),
    "breathless": (
        "Slightly breathless, tired alto; pausing to catch her breath in the cold wind.",
        0.88, -0.1, "<breath> "
    ),
    "false_calm": (
        "Deliberately light, overly composed alto masking deep pain; the classic 'I am perfectly fine' smile hiding a tremor.",
        0.92, 0.2, "<breath> "
    ),
    "false_reassurance": (
        "Gentle, reassuring alto hiding her own illness behind a brave, soothing smile.",
        0.91, 0.2, ""
    ),
    "deflecting": (
        "Poised, graceful alto deflecting concern with dry, effortless elegance.",
        0.93, 0.2, ""
    ),
    "pained_smile": (
        "Bittersweet, softly smiling alto tinged with quiet ache; tender and wistful.",
        0.88, 0.0, "<sigh> "
    ),
    "weak_smile": (
        "Faint, exhausted yet affectionate alto; a tired smile after surviving the ordeal.",
        0.87, 0.0, "<exhales> "
    ),
    "weak_laugh": (
        "Soft, breathless chuckle melting into tender vulnerability; trying to laugh so the curse will wait.",
        0.88, 0.1, "<chuckle> "
    ),
    "soft_smile": (
        "Warm, tender, softly smiling alto; unhurried and deeply affectionate toward Mahmut.",
        0.91, 0.2, ""
    ),
    "small_smile": (
        "Gentle, understated alto with a faint, warm smile.",
        0.92, 0.2, ""
    ),
    "smile": (
        "Warm, luminous alto with genuine fondness.",
        0.92, 0.3, ""
    ),
    "smiling": (
        "Bright, sunlit, peacefully smiling alto; savoring a rare moment of warmth.",
        0.92, 0.3, "<breath> "
    ),
    "warm": (
        "Tender, heartfelt alto radiating quiet gratitude and companionship.",
        0.91, 0.2, ""
    ),
    "gentle": (
        "Soft, soothing, compassionate alto; unhurried and kind.",
        0.90, 0.1, ""
    ),
    "kind": (
        "Gracious, warm alto speaking with sincere kindness.",
        0.91, 0.1, ""
    ),
    "encouraging": (
        "Clear, warm, encouraging alto lifting a companion's spirits.",
        0.93, 0.2, ""
    ),
    "hopeful": (
        "Softly hopeful, wistful alto; daring to wish for a promise of her own.",
        0.90, 0.2, "<breath> "
    ),
    "relieved": (
        "Soft, relieved alto exhale; letting go of tension beside the people she trusts.",
        0.90, 0.1, "<exhales> "
    ),
    "dry_amusement": (
        "Poised, witty alto with dry aristocratic amusement and a playful lilt.",
        0.94, 0.3, "<chuckle> "
    ),
    "wry": (
        "Dry, perceptive alto with a subtle ironic smile.",
        0.93, 0.2, ""
    ),
    "dry": (
        "Understated, dryly observant alto; crisp and unhurried.",
        0.93, 0.1, ""
    ),
    "light": (
        "Light, conversational alto with effortless charm.",
        0.94, 0.3, ""
    ),
    "knowing": (
        "Perceptive, quietly knowing alto; seeing through Mahmut's gentle excuses with fond understanding.",
        0.91, 0.2, ""
    ),
    "perceptive": (
        "Observant, insightful alto; calm and attentive.",
        0.92, 0.0, ""
    ),
    "curious": (
        "Gentle, inquisitive alto asking a thoughtful question.",
        0.93, 0.2, ""
    ),
    "honest": (
        "Clear, unguarded, deeply sincere alto speaking the plain truth.",
        0.89, 0.0, "<breath> "
    ),
    "sad": (
        "Hushed, melancholic alto carrying quiet sorrow without melodrama.",
        0.88, -0.3, "<sigh> "
    ),
    "melancholy": (
        "Wistful, reflective inner alto; mournful and unhurried.",
        0.88, -0.3, "<sigh> "
    ),
    "wistful": (
        "Nostalgic, softly aching alto remembering what was lost.",
        0.89, -0.2, "<breath> "
    ),
    "bittersweet": (
        "Bittersweet, tender inner alto; caught between love for her companions and the shortness of her remaining days.",
        0.88, -0.2, "<breath> "
    ),
    "guilt": (
        "Hushed, remorseful inner alto weighed down by the hope she asked him to carry.",
        0.88, -0.3, "<sigh> "
    ),
    "guilty": (
        "Soft, apologetic alto carrying quiet guilt.",
        0.88, -0.3, "<sigh> "
    ),
    "hurt": (
        "Quietly wounded, sensitive inner alto.",
        0.88, -0.3, "<breath> "
    ),
    "shaken": (
        "Shaken, hushed alto after a chilling revelation.",
        0.89, -0.2, "<breath> "
    ),
    "stunned": (
        "Breathless, stunned alto whisper; recognizing someone who should have been dead.",
        0.87, -0.2, "<breath> "
    ),
    "disbelief": (
        "Hushed, disbelieving alto; staring at her uncle on the altar steps.",
        0.88, -0.1, "<breath> "
    ),
    "uneasy": (
        "Guarded, uneasy alto sensing the bell's resonance in the mist.",
        0.91, -0.1, ""
    ),
    "guarded": (
        "Measured, guarded alto keeping her composure tight.",
        0.91, -0.1, ""
    ),
    "controlled": (
        "Cool, tightly controlled aristocratic alto.",
        0.92, -0.1, ""
    ),
    "cold": (
        "Cold, dignified, piercing aristocratic alto addressing an enemy.",
        0.92, -0.3, ""
    ),
    "low": (
        "Low, hushed, serious alto spoken in confidence.",
        0.89, -0.3, ""
    ),
    "quiet": (
        "Quiet, intimate, unhurried alto.",
        0.89, -0.2, ""
    ),
    "soft": (
        "Soft, gentle alto near a whisper.",
        0.89, -0.1, "<breath> "
    ),
    "steady": (
        "Steady, grounded, unwavering alto.",
        0.93, -0.1, ""
    ),
    "focused": (
        "Sharp, tactical, focused combat alto calling out the enemy's weakness.",
        0.96, -0.1, ""
    ),
    "firm": (
        "Firm, decisive, noble alto refusing to yield a single companion's name.",
        0.95, -0.2, ""
    ),
    "defiant": (
        "Fierce, resonant, defiant alto standing against the Eclipse Construct.",
        0.97, -0.1, ""
    ),
    "determined": (
        "Resolute, unwavering inner alto making a quiet vow.",
        0.93, -0.1, ""
    ),
    "composed": (
        "Poised, luminous gothic alto; unhurried cadence with quiet dignity and natural breath.",
        0.92, 0.0, ""
    ),
}


def make_ssml(ja: str, rate_float: float, pitch_st: float) -> str:
    rate_pct = int(round(rate_float * 100))
    pitch_str = f"{pitch_st:+.1f}st"
    body = (
        ja.replace("……", '<break time="460ms"/>')
        .replace("——", '<break time="380ms"/>')
        .replace("。", '。<break time="340ms"/>')
        .replace("！", '！<break time="300ms"/>')
        .replace("？", '？<break time="320ms"/>')
        .replace("、", '、<break time="200ms"/>')
    )
    return f'<speak><prosody rate="{rate_pct}%" pitch="{pitch_str}">{body}</prosody></speak>'


def enrich_fadyme_campaign_line(entry: dict[str, Any], scene_emotion: str | None = None) -> dict[str, Any]:
    lid = entry["line_id"]
    ja = entry["ja"]
    en = entry.get("en", "")
    is_inner = bool(entry.get("inner") or entry.get("speaker_id") == "fadyme_thought")
    emo = scene_emotion or entry.get("emotion") or "composed"

    base_style, rate, pitch_st, lead_tag = FADYME_EMOTION_STYLES.get(
        emo, FADYME_EMOTION_STYLES["composed"]
    )
    if is_inner and "inner" not in base_style.lower():
        style = (
            f"Internal monologue (close-mic inner thought): {base_style} "
            "Delivered in an intimate, hushed self-reflective cadence."
        )
        rate = min(rate, 0.90)
        pitch_st -= 0.1
        if not lead_tag:
            lead_tag = "<breath> "
    else:
        style = base_style

    # Special bespoke acting overrides for iconic Part I moments
    if lid in ("opening_004", "node_1_5_post_004", "vo_fadyme_low_hp"):
        style = (
            "Poised young woman putting on a brave, gentle smile ('I am perfectly fine') "
            "while subtly hiding exhaustion and chill beneath her warm, composed alto."
        )
    elif lid.startswith("confession_"):
        style = (
            f"Climax emotional confession under the eclipse ({emo}): deeply vulnerable, raw, "
            "and heartfelt alto speaking to Mahmut with trembling honesty and tender devotion."
        )
        if not lead_tag:
            lead_tag = "<breath> "

    tts_base = entry.get("tts_text") or ja
    tts_text = (lead_tag + tts_base).strip()

    updated = dict(entry)
    updated["emotion"] = emo
    updated["voice_id"] = "ja-JP-Chirp3-HD-Sulafat"
    updated["gemini_voice"] = "Sulafat"
    updated["chirp3_voice_id"] = "ja-JP-Chirp3-HD-Sulafat"
    updated["direction"] = style
    updated["speech_metadata"] = {
        "type": "speech_metadata",
        "speaker": "Fadyme",
        "style": style,
    }
    updated["tts_text_gemini38"] = tts_text
    updated["ssml_chirp3"] = make_ssml(ja, rate, pitch_st)
    updated["acoustic_profile"] = {
        "speaking_rate": round(rate, 2),
        "pitch_semitones": round(pitch_st, 2),
        "duration_seconds": updated.get("recorded_duration_s", 4.2),
        "duck_ratio": 0.25,
        "target_lufs": -18.5,
        "inner_thought": is_inner,
    }
    updated["output_ogg"] = f"voices/{lid}.ogg"
    return updated


def main() -> None:
    # 1. Scan all 88 campaign story scenes in content/patches/rel_0003_part1_campaign/story/*.json
    story_files = sorted(CAMPAIGN_STORY_DIR.glob("*.json"))
    fadyme_doc = json.loads((LINE_MAPS_DIR / "jp_script_fadyme.json").read_text(encoding="utf-8"))
    fadyme_by_id = {ln["line_id"]: ln for ln in fadyme_doc["lines"]}

    campaign_trio_lines: list[dict[str, Any]] = []
    mahmut_campaign_list: list[dict[str, Any]] = []
    narrator_campaign_list: list[dict[str, Any]] = []
    fadyme_campaign_list: list[dict[str, Any]] = []

    order_idx = 0
    for sf in story_files:
        sc = json.loads(sf.read_text(encoding="utf-8"))
        scene_id = sc.get("scene_id", sf.stem)
        chapter_id = sc.get("chapter_id", "")
        for cmd in sc.get("commands", []):
            op = cmd.get("op")
            if op not in ("say", "thought", "narrate"):
                continue
            lid = cmd.get("line_id", "")
            spk = "narrator" if op == "narrate" else cmd.get("speaker", "narrator")
            emo = cmd.get("emotion", "composed")
            en = cmd.get("text", "")

            if spk in ("fadyme", "fadyme_thought"):
                assert lid in fadyme_by_id, f"Missing Fadyme line {lid} in jp_script_fadyme.json"
                base_entry = dict(fadyme_by_id[lid])
                base_entry["scene_id"] = scene_id
                base_entry["chapter_id"] = chapter_id
                base_entry["speaker_id"] = spk
                base_entry["en"] = en
                enriched = enrich_fadyme_campaign_line(base_entry, scene_emotion=emo)
                order_idx += 1
                enriched["order_index"] = order_idx
                fadyme_campaign_list.append(enriched)
                campaign_trio_lines.append(enriched)
                fadyme_by_id[lid] = enriched

            elif spk in ("mahmut", "mahmut_thought"):
                assert lid in MAHMUT_CAMPAIGN_JA, f"Missing Mahmut line {lid} in MAHMUT_CAMPAIGN_JA"
                m_spec = MAHMUT_CAMPAIGN_JA[lid]
                is_inner = spk == "mahmut_thought" or op == "thought"
                order_idx += 1
                item = {
                    "order_index": order_idx,
                    "line_id": lid,
                    "scene_id": scene_id,
                    "chapter_id": chapter_id,
                    "speaker_id": spk,
                    "speaker_name": "Mahmut",
                    "gemini_voice": "Iapetus",
                    "chirp3_voice_id": "ja-JP-Chirp3-HD-Iapetus",
                    "emotion": emo,
                    "subtext_tr": m_spec["subtext_tr"],
                    "en": en,
                    "ja": m_spec["ja"],
                    "inner": is_inner,
                    "speech_metadata": {
                        "type": "speech_metadata",
                        "speaker": "Mahmut",
                        "style": m_spec["style"],
                    },
                    "tts_text_gemini38": m_spec["tts_text_gemini38"],
                    "ssml_chirp3": make_ssml(m_spec["ja"], m_spec["rate"], m_spec["pitch_st"]),
                    "acoustic_profile": {
                        "speaking_rate": m_spec["rate"],
                        "pitch_semitones": m_spec["pitch_st"],
                        "duration_seconds": 3.8,
                        "duck_ratio": 0.25,
                        "target_lufs": -18.5,
                        "inner_thought": is_inner,
                    },
                    "output_ogg": f"voices/{lid}.ogg",
                }
                mahmut_campaign_list.append(item)
                campaign_trio_lines.append(item)

            elif spk in ("narrator", "narration"):
                assert lid in NARRATOR_CAMPAIGN_JA, f"Missing Narrator line {lid} in NARRATOR_CAMPAIGN_JA"
                n_spec = NARRATOR_CAMPAIGN_JA[lid]
                order_idx += 1
                item = {
                    "order_index": order_idx,
                    "line_id": lid,
                    "scene_id": scene_id,
                    "chapter_id": chapter_id,
                    "speaker_id": "narrator",
                    "speaker_name": "Narrator",
                    "gemini_voice": "Algieba",
                    "chirp3_voice_id": "ja-JP-Chirp3-HD-Algieba",
                    "emotion": emo if emo != "none" else "spiritual_chronicle",
                    "subtext_tr": n_spec["subtext_tr"],
                    "en": en,
                    "ja": n_spec["ja"],
                    "inner": False,
                    "speech_metadata": {
                        "type": "speech_metadata",
                        "speaker": "Narrator",
                        "style": n_spec["style"],
                    },
                    "tts_text_gemini38": n_spec["tts_text_gemini38"],
                    "ssml_chirp3": make_ssml(n_spec["ja"], n_spec["rate"], n_spec["pitch_st"]),
                    "acoustic_profile": {
                        "speaking_rate": n_spec["rate"],
                        "pitch_semitones": n_spec["pitch_st"],
                        "duration_seconds": 6.5,
                        "duck_ratio": 0.25,
                        "target_lufs": -18.5,
                        "inner_thought": False,
                    },
                    "output_ogg": f"voices/{lid}.ogg",
                }
                narrator_campaign_list.append(item)
                campaign_trio_lines.append(item)

    # 2. Add the 11 Fadyme Battle/Menu VO lines & 11 Mahmut Battle/Menu VO lines (22 lines)
    vo_raw = json.loads(
        (ROOT / "narrative" / "09_VN_Scripts" / "Voice_Lines" / "character_voice_lines_part1.json").read_text(
            encoding="utf-8"
        )
    )["characters"]

    f_vo = vo_raw["fadyme"] if isinstance(vo_raw, dict) else next(c for c in vo_raw if c.get("character_id") == "fadyme")
    for l in f_vo["lines"]:
        lid = l["line_id"]
        base_entry = dict(fadyme_by_id[lid])
        base_entry["scene_id"] = "battle_and_menu_vo"
        base_entry["chapter_id"] = "vo"
        enriched = enrich_fadyme_campaign_line(base_entry, scene_emotion=l.get("trigger", "composed"))
        order_idx += 1
        enriched["order_index"] = order_idx
        fadyme_campaign_list.append(enriched)
        campaign_trio_lines.append(enriched)
        fadyme_by_id[lid] = enriched

    m_vo = vo_raw["mahmut"] if isinstance(vo_raw, dict) else next(c for c in vo_raw if c.get("character_id") == "mahmut")
    for l in m_vo["lines"]:
        lid = l["line_id"]
        m_spec = MAHMUT_CAMPAIGN_JA[lid]
        order_idx += 1
        item = {
            "order_index": order_idx,
            "line_id": lid,
            "scene_id": "battle_and_menu_vo",
            "chapter_id": "vo",
            "speaker_id": "mahmut",
            "speaker_name": "Mahmut",
            "gemini_voice": "Iapetus",
            "chirp3_voice_id": "ja-JP-Chirp3-HD-Iapetus",
            "emotion": l.get("trigger", "composed"),
            "subtext_tr": m_spec["subtext_tr"],
            "en": l["text_en"],
            "ja": m_spec["ja"],
            "inner": False,
            "speech_metadata": {
                "type": "speech_metadata",
                "speaker": "Mahmut",
                "style": m_spec["style"],
            },
            "tts_text_gemini38": m_spec["tts_text_gemini38"],
            "ssml_chirp3": make_ssml(m_spec["ja"], m_spec["rate"], m_spec["pitch_st"]),
            "acoustic_profile": {
                "speaking_rate": m_spec["rate"],
                "pitch_semitones": m_spec["pitch_st"],
                "duration_seconds": 3.5,
                "duck_ratio": 0.25,
                "target_lufs": -18.5,
                "inner_thought": False,
            },
            "output_ogg": f"voices/{lid}.ogg",
        }
        mahmut_campaign_list.append(item)
        campaign_trio_lines.append(item)

    # 3. Also enrich the remaining Fadyme companion-story / event lines in jp_script_fadyme.json
    fadyme_doc["lines"] = [
        fadyme_by_id[ln["line_id"]] if ln["line_id"] in fadyme_by_id and "speech_metadata" in fadyme_by_id[ln["line_id"]]
        else enrich_fadyme_campaign_line(ln)
        for ln in fadyme_doc["lines"]
    ]
    (LINE_MAPS_DIR / "jp_script_fadyme.json").write_text(
        json.dumps(fadyme_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # 4. Update jp_script_mahmut.json & jp_script_narrator.json with campaign_lines
    mahmut_path = LINE_MAPS_DIR / "jp_script_mahmut.json"
    if mahmut_path.exists():
        mahmut_doc = json.loads(mahmut_path.read_text(encoding="utf-8"))
    else:
        mahmut_doc = {"schema_version": 2, "speaker_id": "mahmut", "gemini_voice": "Iapetus", "lines": []}
    mahmut_doc["campaign_and_vo_lines"] = mahmut_campaign_list
    mahmut_doc["total_campaign_and_vo_lines"] = len(mahmut_campaign_list)
    mahmut_path.write_text(json.dumps(mahmut_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    narrator_path = LINE_MAPS_DIR / "jp_script_narrator.json"
    if narrator_path.exists():
        narrator_doc = json.loads(narrator_path.read_text(encoding="utf-8"))
    else:
        narrator_doc = {"schema_version": 2, "speaker_id": "narrator", "gemini_voice": "Algieba", "lines": []}
    narrator_doc["campaign_lines"] = narrator_campaign_list
    narrator_doc["total_campaign_lines"] = len(narrator_campaign_list)
    narrator_path.write_text(json.dumps(narrator_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 5. Write unified master script jp_script_part1_campaign_trio.json
    trio_master = {
        "schema_version": 2,
        "title": "Unaware of My Demise — Part I Campaign & Battle Trio Directed Japanese Voice Script (258 Lines)",
        "cast_locked": {
            "fadyme": "Sulafat (ja-JP-Chirp3-HD-Sulafat, 252.6 Hz warm gothic alto)",
            "mahmut": "Iapetus (ja-JP-Chirp3-HD-Iapetus, 144.6 Hz grounded knight baritone)",
            "narrator": "Algieba (ja-JP-Chirp3-HD-Algieba, 96.0 Hz spiritual bass-baritone)",
        },
        "total_lines": len(campaign_trio_lines),
        "counts_by_speaker": {
            "fadyme_story_and_vo": len(fadyme_campaign_list),
            "mahmut_story_and_vo": len(mahmut_campaign_list),
            "narrator_story": len(narrator_campaign_list),
        },
        "lines": campaign_trio_lines,
    }
    trio_path = LINE_MAPS_DIR / "jp_script_part1_campaign_trio.json"
    trio_path.write_text(json.dumps(trio_master, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        f"Built {trio_path.relative_to(ROOT)} with {len(campaign_trio_lines)} emotional Japanese lines:\n"
        f"  - Fadyme (Sulafat):   {len(fadyme_campaign_list)} lines (132 campaign story + 11 battle/menu VO)\n"
        f"  - Mahmut (Iapetus):   {len(mahmut_campaign_list)} lines (92 campaign story + 11 battle/menu VO)\n"
        f"  - Narrator (Algieba): {len(narrator_campaign_list)} lines (12 campaign story)"
    )


if __name__ == "__main__":
    main()
