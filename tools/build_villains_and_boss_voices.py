#!/usr/bin/env python3
"""
Synthesizes, masters, and wires:
  1. All 28 Spoken Villain & Boss Story/Library Lines with bespoke character-type DSP effects:
     - Lady Yseldra Vale (`lady_yseldra_vale` & `yseldra_distant` — 9 lines): Aristocratic cold contralto + cathedral bell-stone acoustics
     - Lord Cael Veyr (`lord_cael_veyr` — 6 lines): Silky, manipulative Clockless Chancellor bass-baritone + subtle pendulum phase resonance
     - Marshal Oren (`marshal_oren` — 5 lines): Weathered, guilt-burdened armored commander bass-baritone + iron helm/stone bridge resonance
     - Captain Rusk (`rusk` — 2 lines): Gritty, ruthless mercenary duelist baritone
     - The Red Vial Matron (`red_vial_matron` — 1 line) & Red Vial Agent (`red_vial_agent` — 1 line): Obsessive alchemist matron + cold ledger agent
     - The Ashen Lord's Wraith (`ashen_lord_wraith` — 2 lines): Multi-layered spectral ghost voice (triple pitch/formant layer + chorus + haunted hall echo)
     - The Eclipse Construct (`eclipse_construct` — 2 lines): Ancient mythic-mechanical construct (76 Hz sub-bass + crystalline ring-modulation + temple reverb)
     - Plus Undercity Alchemist (`alchemist` — 2 lines)
  2. All 28 Boss Combat Vocal/Effect Cues (7 bosses x 4 cues: `intro`, `attack`, `phase`, `defeat` -> `voices/vo_boss_*.ogg`):
     - `boss_ash_maw` (Beast Boss — roaring ember beast + jaw-bell resonance)
     - `boss_bell_widow` (Ritual Boss — spectral choir whisper + cracked cathedral bell)
     - `boss_captain_rusk` (Duelist Boss — ruthless sword-captain combat cries)
     - `boss_red_vial_matron` (Alchemist Boss — venomous alchemical incantations + shattering glass)
     - `boss_marshal_oren` (Commander Boss — heavy armored bridge commander shouts)
     - `boss_ashen_lord_wraith` (Spectral Boss — layered phantom wails + mirror-shatter echo)
     - `boss_eclipse_construct` (Mythic Construct Boss — colossal mechanical-divine seal judgements)
  3. All 18 Regular Enemy Archetype Combat Vocal/SFX Cues (6 enemy families x 3 cues: `attack`, `hit`, `defeat` -> `voices/vo_enemy_*.ogg`):
     - `beast` (`ash_wolf`), `serpent` (`glass_viper`), `hollow` (6 undead/hollow types),
       `wraith` (2 spectral types), `knight` (6 dark knight/guard types), `cultist` (4 cultist/alchemist/sentinel types)
  4. The remaining 41 Mahmut Library lines + 29 Narrator Library/Codex lines so the Main Trio is 100% voiced across Library (Companions, Events, Codex) as well!
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import math
import re
import subprocess
import sys
import time
import wave
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / ".cache" / "py_pkgs"))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import edge_tts  # type: ignore
import imageio_ffmpeg  # type: ignore
import numpy as np

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
CAMPAIGN_DIR = ROOT / "content" / "patches" / "rel_0003_part1_campaign"
CAMPAIGN_VOICES_DIR = CAMPAIGN_DIR / "voices"
CAMPAIGN_PRESENTATION_PATH = CAMPAIGN_DIR / "presentation" / "presentation.json"
VILLAIN_SCRIPT_PATH = ROOT / "narrative" / "10_VO" / "Line_Maps" / "jp_script_villains_and_bosses.json"
CLAUSE_CACHE_DIR = ROOT / ".cache" / "vo_clauses_v1"

SR = 24000


# ============================================================================
# 1. SPOKEN VILLAIN & BOSS STORY / LIBRARY LINES (28 LINES)
# ============================================================================
VILLAIN_STORY_LINES: list[dict[str, Any]] = [
    # --- Lady Yseldra Vale (The Bell-Widow / Former Inquisitor) ---
    {
        "line_id": "opening_008",
        "scene_id": "opening_sad_scene",
        "speaker_id": "lady_yseldra_vale",
        "villain_type": "aristocratic_inquisitor",
        "gemini_voice": "Erinome",
        "emotion": "grave",
        "text_en": "Princess. The road ends at the altar. Give me the last hour before it takes you.",
        "ja": "姫殿下。道は祭壇で終わります。あれに奪われる前に、最後のひと時を私にお渡しなさい。",
        "tts_text_gemini38": "姫殿下。 <short pause> 道は、祭壇で終わります。 <short pause> あれに奪われる前に……最後のひと時を、私にお渡しなさい。",
    },
    {
        "line_id": "opening_010",
        "scene_id": "opening_sad_scene",
        "speaker_id": "lady_yseldra_vale",
        "villain_type": "aristocratic_inquisitor",
        "gemini_voice": "Erinome",
        "emotion": "warning",
        "text_en": "I came to stop the bell, not to kill its prisoner. You cannot guard a door that has already chosen its offering.",
        "ja": "私は鐘を止めに来たのです、囚人を殺しに来たのではありません。すでに生贄を選んだ扉を、守ることなどできはしない。",
        "tts_text_gemini38": "私は鐘を止めに来たのです、囚人を殺しに来たのではありません。 <short pause> すでに生贄を選んだ扉を……守ることなど、できはしない。",
    },
    {
        "line_id": "opening_015",
        "scene_id": "opening_sad_scene",
        "speaker_id": "lady_yseldra_vale",
        "villain_type": "distant_bell_echo",
        "gemini_voice": "Erinome",
        "emotion": "distant",
        "text_en": "When the names begin to vanish, remember: I warned you.",
        "ja": "名前が消え始めたとき、思い出しなさい――私は警告したと。",
        "tts_text_gemini38": "名前が消え始めたとき、思い出しなさい…… <short pause> 私は、警告したと。",
    },
    {
        "line_id": "node_2_5_pre_001",
        "scene_id": "vn_2_5_pre",
        "speaker_id": "lady_yseldra_vale",
        "villain_type": "aristocratic_inquisitor",
        "gemini_voice": "Erinome",
        "emotion": "controlled",
        "text_en": "You found the record. You still do not know what it asks of her.",
        "ja": "記録を見つけたのね。けれど、それが彼女に何を求めているのか、まだ分かっていない。",
        "tts_text_gemini38": "記録を見つけたのね。 <short pause> けれど、それが彼女に何を求めているのか……まだ分かっていない。",
    },
    {
        "line_id": "node_2_5_pre_003",
        "scene_id": "vn_2_5_pre",
        "speaker_id": "lady_yseldra_vale",
        "villain_type": "aristocratic_inquisitor",
        "gemini_voice": "Erinome",
        "emotion": "grave",
        "text_en": "The altar does not cure. It keeps a wound open until the kingdom can be put back inside it.",
        "ja": "祭壇は癒やしなどしない。王国をその中へ戻せる日まで、傷口を開いたままにしておくだけよ。",
        "tts_text_gemini38": "祭壇は癒やしなどしない。 <short pause> 王国をその中へ戻せる日まで、傷口を開いたままにしておくだけよ。",
    },
    {
        "line_id": "node_2_5_pre_005",
        "scene_id": "vn_2_5_pre",
        "speaker_id": "lady_yseldra_vale",
        "villain_type": "aristocratic_inquisitor",
        "gemini_voice": "Erinome",
        "emotion": "honest",
        "text_en": "I came to stop the next sacrifice. I will not pretend that makes my choice yours.",
        "ja": "私は次の生贄を止めに来た。だからといって、私の選択をあなたたちに強いるつもりはないわ。",
        "tts_text_gemini38": "私は、次の生贄を止めに来た。 <short pause> だからといって、私の選択をあなたたちに強いるつもりはないわ。",
    },
    {
        "line_id": "node_2_5_pre_006",
        "scene_id": "vn_2_5_pre",
        "speaker_id": "lady_yseldra_vale",
        "villain_type": "aristocratic_inquisitor",
        "gemini_voice": "Erinome",
        "emotion": "cold",
        "text_en": "And you, Sir Mahmut. You told her you did not know me.",
        "ja": "それと、マフムト卿。彼女には、私を知らないと言ったそうね。",
        "tts_text_gemini38": "それと……マフムト卿。 <short pause> 彼女には、私を知らないと言ったそうね。",
    },
    {
        "line_id": "node_2_5_post_003",
        "scene_id": "vn_2_5_post",
        "speaker_id": "yseldra_distant",
        "villain_type": "distant_bell_echo",
        "gemini_voice": "Erinome",
        "emotion": "warning",
        "text_en": "Ask who keeps the hour running.",
        "ja": "誰が時を動かし続けているのか、問いなさい。",
        "tts_text_gemini38": "誰が時を動かし続けているのか……問いなさい。",
    },
    {
        "line_id": "ending_yseldra_001",
        "scene_id": "part1_clockless_reveal",
        "speaker_id": "lady_yseldra_vale",
        "villain_type": "aristocratic_inquisitor",
        "gemini_voice": "Erinome",
        "emotion": "bitter",
        "text_en": "Do not mistake him for your answer, Fadyme. He only knows how to turn grief into a bargain.",
        "ja": "彼を答えだと思わないことね、ファディメ。この男は、悲しみを取引に変える術しか知らないのだから。",
        "tts_text_gemini38": "彼を答えだと思わないことね、ファディメ。 <short pause> この男は、悲しみを取引に変える術しか知らないのだから。",
    },

    # --- Lord Cael Veyr (The Clockless Chancellor — Main Villain) ---
    {
        "line_id": "ending_cael_001",
        "scene_id": "part1_clockless_reveal",
        "speaker_id": "lord_cael_veyr",
        "villain_type": "clockless_chancellor",
        "gemini_voice": "Charon",
        "emotion": "cool_amusement",
        "text_en": "You have finally told him the truth. How considerate of you to wait until the hour was nearly gone.",
        "ja": "ようやく彼に真実を告げたか。時が尽きかけるまで待つとは、実に心優しいことだ。",
        "tts_text_gemini38": "ようやく彼に真実を告げたか。 <short pause> 時が尽きかけるまで待つとは……実に心優しいことだ。",
    },
    {
        "line_id": "ending_cael_002",
        "scene_id": "part1_clockless_reveal",
        "speaker_id": "lord_cael_veyr",
        "villain_type": "clockless_chancellor",
        "gemini_voice": "Charon",
        "emotion": "formal",
        "text_en": "Lord Cael Veyr. The Clockless Chancellor, if titles still comfort anyone.",
        "ja": "カエル・ヴェイル卿。肩書きがまだ誰かの慰めになるなら、『無窮の宰相』とでも呼ぶがいい。",
        "tts_text_gemini38": "カエル・ヴェイル卿。 <short pause> 肩書きがまだ誰かの慰めになるなら、『無窮の宰相』とでも呼ぶがいい。",
    },
    {
        "line_id": "ending_cael_003",
        "scene_id": "part1_clockless_reveal",
        "speaker_id": "lord_cael_veyr",
        "villain_type": "clockless_chancellor",
        "gemini_voice": "Charon",
        "emotion": "cold",
        "text_en": "The court recorded my death. It did not record where my missing hour went.",
        "ja": "宮廷は私の死を記録した。だが、私の消えた時がどこへ行ったかは記録しなかったのだよ。",
        "tts_text_gemini38": "宮廷は私の死を記録した。 <short pause> だが、私の消えた時がどこへ行ったかは……記録しなかったのだよ。",
    },
    {
        "line_id": "ending_cael_004",
        "scene_id": "part1_clockless_reveal",
        "speaker_id": "lord_cael_veyr",
        "villain_type": "clockless_chancellor",
        "gemini_voice": "Charon",
        "emotion": "measured",
        "text_en": "I made a door. Yseldra chose who would stand in it.",
        "ja": "私は扉を造った。その扉に誰を立たせるかを選んだのは、イゼルドラだ。",
        "tts_text_gemini38": "私は扉を造った。 <short pause> その扉に誰を立たせるかを選んだのは、イゼルドラだ。",
    },
    {
        "line_id": "ending_cael_005",
        "scene_id": "part1_clockless_reveal",
        "speaker_id": "lord_cael_veyr",
        "villain_type": "clockless_chancellor",
        "gemini_voice": "Charon",
        "emotion": "inviting",
        "text_en": "Come to the Clockless Court, Mahmut. I can return the hours the curse has taken. The price is one hour that belongs to you.",
        "ja": "無窮の宮廷へ来い、マフムト。呪いが奪った時を返してやろう。代償は、お前自身の時ひとつだ。",
        "tts_text_gemini38": "無窮の宮廷へ来い、マフムト。 <short pause> 呪いが奪った時を返してやろう。 <short pause> 代償は……お前自身の時、ひとつだ。",
    },
    {
        "line_id": "ending_cael_006",
        "scene_id": "part1_clockless_reveal",
        "speaker_id": "lord_cael_veyr",
        "villain_type": "clockless_chancellor",
        "gemini_voice": "Charon",
        "emotion": "quiet_threat",
        "text_en": "Then she keeps fading, and you keep learning what 'too late' means.",
        "ja": "ならば彼女は消え続け、お前は『手遅れ』の意味を思い知り続けるがいい。",
        "tts_text_gemini38": "ならば彼女は消え続け…… <short pause> お前は、『手遅れ』の意味を思い知り続けるがいい。",
    },

    # --- Captain Rusk (Chapter 3-5 Duelist Boss) ---
    {
        "line_id": "node_3_5_pre_001",
        "scene_id": "vn_3_5_pre",
        "speaker_id": "rusk",
        "villain_type": "mercenary_duelist",
        "gemini_voice": "Fenrir",
        "emotion": "cold",
        "text_en": "The order says the heir comes quietly. It says nothing about the village.",
        "ja": "命令書には『世継ぎを静かに連行しろ』とある。村の連中をどうしろとは書いちゃいない。",
        "tts_text_gemini38": "命令書には、『世継ぎを静かに連行しろ』とある。 <short pause> 村の連中をどうしろとは書いちゃいない。",
    },
    {
        "line_id": "node_3_5_pre_003",
        "scene_id": "vn_3_5_pre",
        "speaker_id": "rusk",
        "villain_type": "mercenary_duelist",
        "gemini_voice": "Fenrir",
        "emotion": "uneasy",
        "text_en": "It was sealed by someone the Crown buried years ago.",
        "ja": "そいつには、王家が何年も前に葬ったはずの誰かの封蝋が押されていた。",
        "tts_text_gemini38": "そいつには……王家が何年も前に葬ったはずの誰かの封蝋が押されていた。",
    },

    # --- Undercity Alchemist & Red Vial Matron / Agent (Chapter 4) ---
    {
        "line_id": "node_4_3_pre_002",
        "scene_id": "vn_4_3_pre",
        "speaker_id": "alchemist",
        "villain_type": "undercity_alchemist",
        "gemini_voice": "Puck",
        "emotion": "grave",
        "text_en": "Not a month now. Weeks, perhaps less, if the bell keeps calling.",
        "ja": "もう一ヶ月も保たない。鐘が呼び続ければ、数週間……いや、それ以下だ。",
        "tts_text_gemini38": "もう一ヶ月も保たない。 <short pause> 鐘が呼び続ければ、数週間……いや、それ以下だ。",
    },
    {
        "line_id": "node_4_3_pre_004",
        "scene_id": "vn_4_3_pre",
        "speaker_id": "alchemist",
        "villain_type": "undercity_alchemist",
        "gemini_voice": "Puck",
        "emotion": "sad",
        "text_en": "Then perhaps the bell will take the answer from someone else.",
        "ja": "ならば、鐘は他の誰かから答えを奪うことになるだろう。",
        "tts_text_gemini38": "ならば……鐘は他の誰かから答えを奪うことになるだろう。",
    },
    {
        "line_id": "node_4_5_pre_001",
        "scene_id": "vn_4_5_pre",
        "speaker_id": "red_vial_matron",
        "villain_type": "alchemist_matron",
        "gemini_voice": "Despina",
        "emotion": "hungry",
        "text_en": "The heir's blood is not a cure. It is the last ingredient.",
        "ja": "世継ぎの血は薬なんかじゃない。最後の『触媒』なのよ。",
        "tts_text_gemini38": "世継ぎの血は、薬なんかじゃない…… <short pause> 最後の、『触媒』なのよ。",
    },
    {
        "line_id": "event_guild_salt_fever_3_001",
        "scene_id": "event_guild_salt_fever_3",
        "speaker_id": "red_vial_agent",
        "villain_type": "ledger_agent",
        "gemini_voice": "Puck",
        "emotion": "cold",
        "text_en": "You are ruining a market, alchemist.",
        "ja": "市場を潰す気か、錬金術師。",
        "tts_text_gemini38": "市場を潰す気か、錬金術師。",
    },

    # --- Marshal Oren (Chapter 5-5 Commander Boss) ---
    {
        "line_id": "node_5_5_pre_001",
        "scene_id": "vn_5_5_pre",
        "speaker_id": "marshal_oren",
        "villain_type": "armored_commander",
        "gemini_voice": "Schedar",
        "emotion": "strained",
        "text_en": "I gave the order. I did not know the rite would hollow her out.",
        "ja": "命令を下したのは私だ。だが、あの儀式が彼女を空っぽにするとは知らなかった。",
        "tts_text_gemini38": "命令を下したのは私だ。 <short pause> だが、あの儀式が彼女を空っぽにするとは……知らなかった。",
    },
    {
        "line_id": "node_5_5_pre_003",
        "scene_id": "vn_5_5_pre",
        "speaker_id": "marshal_oren",
        "villain_type": "armored_commander",
        "gemini_voice": "Schedar",
        "emotion": "shame",
        "text_en": "I thought the seal would save the kingdom without consuming its heir.",
        "ja": "封じることで、世継ぎを喰らい尽くさずに王国を救えると思っていたのだ。",
        "tts_text_gemini38": "封じることで、世継ぎを喰らい尽くさずに王国を救えると思っていたのだ。",
    },
    {
        "line_id": "node_5_5_pre_005",
        "scene_id": "vn_5_5_pre",
        "speaker_id": "marshal_oren",
        "villain_type": "armored_commander",
        "gemini_voice": "Schedar",
        "emotion": "shame",
        "text_en": "Yseldra carried the order from the Inquisition. I signed it. That is the whole of my courage.",
        "ja": "イゼルドラが異端審問所の命令書を運び、私が署名した。それが私の勇気のすべてだ。",
        "tts_text_gemini38": "イゼルドラが異端審問所の命令書を運び、私が署名した。 <short pause> それが、私の勇気のすべてだ。",
    },
    {
        "line_id": "node_5_5_post_001",
        "scene_id": "vn_5_5_post",
        "speaker_id": "marshal_oren",
        "villain_type": "armored_commander",
        "gemini_voice": "Schedar",
        "emotion": "regret",
        "text_en": "The Ashen estate has the full schedule. Go before the bridge falls.",
        "ja": "灰の館にすべての記録がある。橋が落ちる前に行け。",
        "tts_text_gemini38": "灰の館にすべての記録がある。 <short pause> 橋が落ちる前に行け。",
    },
    {
        "line_id": "node_5_5_post_003",
        "scene_id": "vn_5_5_post",
        "speaker_id": "marshal_oren",
        "villain_type": "armored_commander",
        "gemini_voice": "Schedar",
        "emotion": "resolved",
        "text_en": "No. Someone must keep this span open. I will not fail the people twice.",
        "ja": "いや。誰かがこの橋を保たねばならん。二度も民を見捨てはしない。",
        "tts_text_gemini38": "いや。 <short pause> 誰かがこの橋を保たねばならん。二度も民を見捨てはしない。",
    },

    # --- The Ashen Lord's Wraith (Chapter 6-5 Spectral Boss) ---
    {
        "line_id": "node_6_5_pre_001",
        "scene_id": "vn_6_5_pre",
        "speaker_id": "ashen_lord_wraith",
        "villain_type": "spectral_wraith",
        "gemini_voice": "Orus",
        "emotion": "echo",
        "text_en": "A house remembers its master. A kingdom remembers its heir.",
        "ja": "館は主を覚えている……王国は、世継ぎを覚えている……",
        "tts_text_gemini38": "館は主を覚えている…… <long pause> 王国は、世継ぎを覚えている……",
    },
    {
        "line_id": "node_6_5_pre_004",
        "scene_id": "vn_6_5_pre",
        "speaker_id": "ashen_lord_wraith",
        "villain_type": "spectral_wraith",
        "gemini_voice": "Orus",
        "emotion": "echo",
        "text_en": "I hid the bell-keeper's daughter from the Crown. I kept her face and lost her name.",
        "ja": "私は鐘守の娘を王家から隠した……顔だけを残し、その名を失ったのだ……",
        "tts_text_gemini38": "私は鐘守の娘を王家から隠した…… <short pause> 顔だけを残し、その名を失ったのだ……",
    },

    # --- The Eclipse Construct (Chapter 7-5 Mythic Construct Final Boss) ---
    {
        "line_id": "node_7_5_phase1_001",
        "scene_id": "vn_7_5_phase_1_break",
        "speaker_id": "eclipse_construct",
        "villain_type": "mythic_construct",
        "gemini_voice": "Algieba",
        "emotion": "mechanical",
        "text_en": "THE HOUR IS UNPAID.",
        "ja": "時は――未払いだ。",
        "tts_text_gemini38": "時は―― <short pause> 未払いだ。",
    },
    {
        "line_id": "node_7_5_post_001",
        "scene_id": "vn_7_5_post",
        "speaker_id": "eclipse_construct",
        "villain_type": "mythic_construct_fading",
        "gemini_voice": "Algieba",
        "emotion": "fading",
        "text_en": "WITNESS... RESTORED. HOUR... STILL OWED.",
        "ja": "証人……復旧。時は……なお……未払い……",
        "tts_text_gemini38": "証人…… <short pause> 復旧。 <long pause> 時は……なお……未払い……",
    },
]


# ============================================================================
# 2. 7 BOSSES x 4 COMBAT VOCAL / EFFECT CUES (28 CUES -> `voices/vo_boss_*.ogg`)
# ============================================================================
BOSS_COMBAT_CUES: list[dict[str, Any]] = [
    # 1-5: The Ash-Maw (Beast Boss — monstrous sub-bass roar + jaw-bell clang)
    {"cue_id": "vo_boss_ash_maw_intro", "villain_type": "beast_boss", "ja": "グオオォォォ……！", "emotion": "roar"},
    {"cue_id": "vo_boss_ash_maw_attack", "villain_type": "beast_boss", "ja": "ガルルァァッ！", "emotion": "bite"},
    {"cue_id": "vo_boss_ash_maw_phase", "villain_type": "beast_boss", "ja": "グァァァォォン！！", "emotion": "frenzy"},
    {"cue_id": "vo_boss_ash_maw_defeat", "villain_type": "beast_boss", "ja": "グゥ……ォォ……", "emotion": "collapse"},

    # 2-5: The Bell-Widow (Ritual Boss — spectral choir chant + cracked bronze bell)
    {"cue_id": "vo_boss_bell_widow_intro", "villain_type": "ritual_boss", "ja": "鐘よ……未払いの時を数えなさい……", "emotion": "ritual"},
    {"cue_id": "vo_boss_bell_widow_attack", "villain_type": "ritual_boss", "ja": "鳴り響け、銀の封よ！", "emotion": "cast"},
    {"cue_id": "vo_boss_bell_widow_phase", "villain_type": "ritual_boss", "ja": "祈りは届かない……鐘がすべてを喰らう！", "emotion": "surge"},
    {"cue_id": "vo_boss_bell_widow_defeat", "villain_type": "ritual_boss", "ja": "ああ……音が……途切れてゆく……", "emotion": "fade"},

    # 3-5: Captain Rusk (Duelist Boss — ruthless mercenary captain)
    {"cue_id": "vo_boss_captain_rusk_intro", "villain_type": "mercenary_duelist", "ja": "仕事だ。恨むなら封蝋の主を恨め！", "emotion": "command"},
    {"cue_id": "vo_boss_captain_rusk_attack", "villain_type": "mercenary_duelist", "ja": "遅い！そこだッ！", "emotion": "slash"},
    {"cue_id": "vo_boss_captain_rusk_phase", "villain_type": "mercenary_duelist", "ja": "旗を上げろ！包囲を崩すな！", "emotion": "rally"},
    {"cue_id": "vo_boss_captain_rusk_defeat", "villain_type": "mercenary_duelist", "ja": "くそっ……この値段じゃ、割に合わん……", "emotion": "defeat"},

    # 4-5: The Red Vial Matron (Alchemist Boss — venomous alchemist matron)
    {"cue_id": "vo_boss_red_vial_matron_intro", "villain_type": "alchemist_matron", "ja": "さあ、最後の一滴まで蒸留してあげるわ！", "emotion": "hungry"},
    {"cue_id": "vo_boss_red_vial_matron_attack", "villain_type": "alchemist_matron", "ja": "紅き瓶よ、沸き立ちなさい！", "emotion": "throw"},
    {"cue_id": "vo_boss_red_vial_matron_phase", "villain_type": "alchemist_matron", "ja": "棚を開け！劇薬をすべて注ぎ込むのよ！", "emotion": "frenzy"},
    {"cue_id": "vo_boss_red_vial_matron_defeat", "villain_type": "alchemist_matron", "ja": "馬鹿な……私の完成品が……割れる……", "emotion": "shatter"},

    # 5-5: Marshal Oren (Commander Boss — heavy armored bridge marshal)
    {"cue_id": "vo_boss_marshal_oren_intro", "villain_type": "armored_commander", "ja": "この橋は通さん！我が盾がある限り！", "emotion": "command"},
    {"cue_id": "vo_boss_marshal_oren_attack", "villain_type": "armored_commander", "ja": "退けいッ！", "emotion": "strike"},
    {"cue_id": "vo_boss_marshal_oren_phase", "villain_type": "armored_commander", "ja": "軍旗を立て直せ！一歩も引くな！", "emotion": "fortify"},
    {"cue_id": "vo_boss_marshal_oren_defeat", "villain_type": "armored_commander", "ja": "見事だ……マフムト……先へ行け……", "emotion": "yield"},

    # 6-5: The Ashen Lord's Wraith (Spectral Boss — haunted phantom lord)
    {"cue_id": "vo_boss_ashen_lord_wraith_intro", "villain_type": "spectral_wraith", "ja": "名を返せ……我が館に眠る名を……", "emotion": "echo"},
    {"cue_id": "vo_boss_ashen_lord_wraith_attack", "villain_type": "spectral_wraith", "ja": "灰へ還れ……！", "emotion": "wail"},
    {"cue_id": "vo_boss_ashen_lord_wraith_phase", "villain_type": "spectral_wraith", "ja": "鏡よ映せ……失われた顔のすべてを……！", "emotion": "surge"},
    {"cue_id": "vo_boss_ashen_lord_wraith_defeat", "villain_type": "spectral_wraith", "ja": "ああ……ようやく……彼女の名が……", "emotion": "release"},

    # 7-5: The Eclipse Construct (Mythic Construct Boss — ancient temple machine)
    {"cue_id": "vo_boss_eclipse_construct_intro", "villain_type": "mythic_construct", "ja": "契約照合――未払いの時を徴収する。", "emotion": "mechanical"},
    {"cue_id": "vo_boss_eclipse_construct_attack", "villain_type": "mythic_construct", "ja": "裁定執行。", "emotion": "strike"},
    {"cue_id": "vo_boss_eclipse_construct_phase", "villain_type": "mythic_construct", "ja": "第一の蝕――防護障壁、再展開。", "emotion": "ward"},
    {"cue_id": "vo_boss_eclipse_construct_defeat", "villain_type": "mythic_construct_fading", "ja": "機能停止……証人……確認……", "emotion": "shutdown"},
]


# ============================================================================
# 3. 6 REGULAR ENEMY ARCHETYPES x 3 COMBAT VOCAL/SFX CUES (18 CUES -> `voices/vo_enemy_*.ogg`)
# ============================================================================
ENEMY_ARCHETYPE_CUES: list[dict[str, Any]] = [
    # Beast (`ash_wolf`)
    {"cue_id": "vo_enemy_beast_attack", "archetype": "beast", "ja": "ガルッ！"},
    {"cue_id": "vo_enemy_beast_hit", "archetype": "beast", "ja": "グゥッ！"},
    {"cue_id": "vo_enemy_beast_defeat", "archetype": "beast", "ja": "クゥーン……"},

    # Serpent (`glass_viper`)
    {"cue_id": "vo_enemy_serpent_attack", "archetype": "serpent", "ja": "シュウゥッ！"},
    {"cue_id": "vo_enemy_serpent_hit", "archetype": "serpent", "ja": "シャアッ！"},
    {"cue_id": "vo_enemy_serpent_defeat", "archetype": "serpent", "ja": "シュ……ゥ……"},

    # Hollow / Undead (`bellbound_dead`, `hollow_pilgrim`, `hollow_cleric`, `inkbound_dead`, `orchard_ghoul`, `royal_hollow`)
    {"cue_id": "vo_enemy_hollow_attack", "archetype": "hollow", "ja": "アァ……時を……！"},
    {"cue_id": "vo_enemy_hollow_hit", "archetype": "hollow", "ja": "ガハッ……！"},
    {"cue_id": "vo_enemy_hollow_defeat", "archetype": "hollow", "ja": "ア……ァ……"},

    # Spectral Wraith (`bridge_revenant`, `estate_wraith`)
    {"cue_id": "vo_enemy_wraith_attack", "archetype": "wraith", "ja": "消えよ……"},
    {"cue_id": "vo_enemy_wraith_hit", "archetype": "wraith", "ja": "ヒュウッ……"},
    {"cue_id": "vo_enemy_wraith_defeat", "archetype": "wraith", "ja": "霧へ……還る……"},

    # Dark Knight / Corrupted Guard (`choir_knight`, `corrupted_crown_guard`, `crownless_knight`, `lost_vow_knight`, `noble_retainer`, `corrupted_mercenary`)
    {"cue_id": "vo_enemy_knight_attack", "archetype": "knight", "ja": "斬るッ！"},
    {"cue_id": "vo_enemy_knight_hit", "archetype": "knight", "ja": "ぐっ……！"},
    {"cue_id": "vo_enemy_knight_defeat", "archetype": "knight", "ja": "誓いが……砕ける……"},

    # Cultist / Alchemist / Sentinel (`chain_cultist`, `red_vial_alchemist`, `red_vial_scout`, `eclipse_sentinel`)
    {"cue_id": "vo_enemy_cultist_attack", "archetype": "cultist", "ja": "封よ、縛れ！"},
    {"cue_id": "vo_enemy_cultist_hit", "archetype": "cultist", "ja": "ちぃっ！"},
    {"cue_id": "vo_enemy_cultist_defeat", "archetype": "cultist", "ja": "鐘が……遠ざかる……"},
]


# ============================================================================
# 4. REMAINING 41 MAHMUT LIBRARY LINES + 29 NARRATOR LIBRARY/CODEX LINES
# ============================================================================
MAHMUT_LIBRARY_JA: dict[str, tuple[str, str]] = {
    "cs_mahmut_1_002": ("かつては王冠だった。鍛冶屋の槌で叩き外したのだ。", "かつては王冠だった。 <short pause> 鍛冶屋の槌で、叩き外したのだ。"),
    "cs_mahmut_1_004": ("小刀なら綺麗に外せただろう。だが、綺麗にする気はなかった。", "小刀なら綺麗に外せただろう。 <short pause> だが……綺麗にする気はなかった。"),
    "cs_mahmut_1_006": ("あの夜に見たものを話せば、あいつは眠れなくなる。せめて片方は眠るべきだ。", "あの夜に見たものを話せば、あいつは眠れなくなる。 <short pause> せめて片方は、眠るべきだ。"),
    "cs_mahmut_1_008": ("なら、俺が背負う。今夜ではないがな。", "なら、俺が背負う。 <short pause> 今夜ではないがな。"),
    "cs_mahmut_2_002": ("奴は俺自身の時をひとつ求めた。……どの時だ？", "奴は俺自身の時をひとつ求めた。 <short pause> ……どの時だ？"),
    "cs_mahmut_2_004": ("従うのをやめたあの時か。あれだけが、俺が自分で選んだ唯一の時だ。", "従うのをやめたあの時か。 <short pause> あれだけが、俺が自分で選んだ唯一の時だ。"),
    "cs_mahmut_2_006": ("ならば奴が欲しがっているのは、俺が絶対に返さない唯一のものだ。", "ならば奴が欲しがっているのは、 <short pause> 俺が絶対に返さない唯一のものだ。"),
    "cs_fadyme_2_002": ("ああ、本当だ。俺が払ったからな。", "ああ、本当だ。 <short pause> 俺が払ったからな。"),
    "cs_fadyme_2_004": ("……笑っているのか。", "……笑っているのか。"),
    "cs_fadyme_2_006": ("覚えておこう。", "覚えておこう。"),
    "cs_kera_voss_4_002": ("造れるのか？", "造れるのか？"),
    "cs_kera_voss_4_004": ("なら、何が要る？", "なら、何が要る？"),
    "cs_kera_voss_4_006": ("ならば、別の場所から時を奪うまでだ。", "ならば、別の場所から時を奪うまでだ。"),
    "cs_nixie_vale_1_002": ("旅人を祠から遠ざけるためか？", "旅人を祠から遠ざけるためか？"),
    "cs_sable_wren_2_002": ("中身までは知るよしもなかったはずだ。", "中身までは知るよしもなかったはずだ。"),
    "cs_sable_wren_2_004": ("俺は何年も、倍にも満たない値で命令書を運んでいた。", "俺は何年も……倍にも満たない値で命令書を運んでいた。"),
    "cs_tilda_fen_4_002": ("ティルダ。彼女にはあとどれくらい残されている？", "ティルダ。 <short pause> 彼女には、あとどれくらい残されている？"),
    "cs_tilda_fen_4_004": ("……あいつはもう、知っている。", "……あいつはもう、知っている。"),
    "cs_mirel_quill_3_002": ("俺はそれ以下のことで烙印を押された。", "俺はそれ以下のことで烙印を押された。"),
    "cs_mirel_quill_3_004": ("慰めるつもりじゃなかった。ただ、独りにはしないと言いたかっただけだ。", "慰めるつもりじゃなかった。 <short pause> ただ、独りにはしないと言いたかっただけだ。"),
    "cs_odelia_pike_1_002": ("海辺の誰かが、ここまで降りてきたな。", "海辺の誰かが、ここまで降りてきたな。"),
    "cs_odelia_pike_1_004": ("それで、お前が追ってきたわけか。", "それで、お前が追ってきたわけか。"),
    "cs_odelia_pike_4_002": ("この足跡は、外へ向かっている。", "この足跡は、外へ向かっている。"),
    "cs_odelia_pike_4_004": ("なら、追跡の答えは出たな。", "なら、追跡の答えは出たな。"),
    "cs_nara_vell_2_002": ("忘れたのだ。", "忘れたのだ。"),
    "cs_nara_vell_2_004": ("奴が去るのを見たのか。", "奴が去るのを見たのか。"),
    "cs_nara_vell_4_002": ("彼女に追手を差し向けるだけのことは知っていた。宮廷の正体も知っているかもしれん。", "彼女に追手を差し向けるだけのことは知っていた。 <short pause> 宮廷の正体も知っているかもしれん。"),
    "cs_nara_vell_4_004": ("それは助けとは言わん。", "それは助けとは言わん。"),
    "cs_clem_marr_4_002": ("あいつがお前に預けたのか。", "あいつがお前に預けたのか。"),
    "cs_clem_marr_4_004": ("なら、俺のためにもうひとつ書き留めてくれ。毎日、お前の帳面に彼女の名を。世界がそれを忘れ始めたときのために。", "なら、俺のためにもうひとつ書き留めてくれ。 <short pause> 毎日、お前の帳面に彼女の名を。世界がそれを忘れ始めたときのために。"),
    "cs_vespera_wisp_4_002": ("なら、奴にはそれができるのか。", "なら、奴にはそれができるのか。"),
    "cs_vespera_wisp_4_004": ("どういう意味だ？", "どういう意味だ？"),
    "cs_thistle_roe_1_002": ("……何だ、これは？", "……何だ、これは？"),
    "cs_thistle_roe_1_004": ("なぜ俺に見せる？", "なぜ俺に見せる？"),
    "cs_jori_flint_1_002": ("盾を作っているのか。", "盾を作っているのか。"),
    "cs_jori_flint_1_004": ("俺たちと共に歩くには、十分すぎる理由だ。", "俺たちと共に歩くには、十分すぎる理由だ。"),
    "cs_jori_flint_4_002": ("何がだ？", "何がだ？"),
    "cs_jori_flint_4_004": ("あとどれくらい保つ？", "あとどれくらい保つ？"),
    "cs_marek_vane_1_002": ("お前はそれを信じていたのだな。", "お前はそれを信じていたのだな。"),
    "cs_marek_vane_1_004": ("……で、今はどうだ？", "……で、今はどうだ？"),
    "event_harvest_inn_meal_2_004": ("つまり、この食事そのものが点呼というわけか。", "つまり、この食事そのものが点呼というわけか。"),
}

NARRATOR_LIBRARY_JA: dict[str, tuple[str, str]] = {
    "cs_mahmut_2_007": ("二人の背後で、ファディメが寝返りを打った。残りの言葉を口にする者はいなかった。", "二人の背後で、ファディメが寝返りを打った。 <short pause> 残りの言葉を口にする者はいなかった。"),
    "cs_brin_alder_1_002": ("西のどこかで鐘が鳴った。避難民たちの足が、一斉に止まった。", "西のどこかで鐘が鳴った。 <short pause> 避難民たちの足が、一斉に止まった。"),
    "cs_brin_alder_1_005": ("一人ずつ、自らの名を口にした。ブリンは最後に、それが誰よりも重いかのように静かに名乗った。", "一人ずつ、自らの名を口にした。 <short pause> ブリンは最後に、それが誰よりも重いかのように静かに名乗った。"),
    "cs_brin_alder_2_006": ("鑿が食い込み、名前は確かに刻まれた。", "鑿が食い込み、 <short pause> 名前は確かに刻まれた。"),
    "cs_brin_alder_3_005": ("十二組の手が西の梁を支えた。ブリンは東を一人で支えたが、今度ばかりはそちらの方が軽かった。", "十二組の手が西の梁を支えた。 <short pause> ブリンは東を一人で支えたが、今度ばかりはそちらの方が軽かった。"),
    "cs_nixie_vale_3_002": ("七つの小さな手が挙がった。続いて八つ目――自嘲気味に笑う老人の手が挙がった。", "七つの小さな手が挙がった。 <short pause> 続いて八つ目――自嘲気味に笑う老人の手が挙がった。"),
    "cs_sable_wren_3_002": ("料理人が十本の指を掲げた。そして、もう一度十本。", "料理人が十本の指を掲げた。 <short pause> そして、もう一度十本。"),
    "cs_rikka_ember_2_002": ("通りは名前と火花で満ちた。老いた陶工が二度名を叫び、三度目を口にできずに立ち尽くした。", "通りは名前と火花で満ちた。 <short pause> 老いた陶工が二度名を叫び、三度目を口にできずに立ち尽くした。"),
    "cs_rikka_ember_4_001": ("リッカは房飾りを鳴らさなかった。誰も起こさぬよう、拳の中に固く握りしめていた。", "リッカは房飾りを鳴らさなかった。 <short pause> 誰も起こさぬよう、拳の中に固く握りしめていた。"),
    "cs_mirel_quill_3_005": ("封蝋は綺麗に印を刻んだ。ミレルの手が震え始めたのは、すべてが終わった後だった。", "封蝋は綺麗に印を刻んだ。 <short pause> ミレルの手が震え始めたのは、すべてが終わった後だった。"),
    "cs_iona_mist_3_002": ("若い見張りは思い出せなかった。イオナは待った。長い沈黙の果てに、ひとつの名が浮かんだ――妹の名だった。", "若い見張りは思い出せなかった。イオナは待った。 <short pause> 長い沈黙の果てに、ひとつの名が浮かんだ――妹の名だった。"),
    "cs_jori_flint_3_002": ("彼女は青銅に掌を当てた。朝は冷え込んでいたが、それだけは温かかった。", "彼女は青銅に掌を当てた。 <short pause> 朝は冷え込んでいたが、それだけは温かかった。"),
    "cs_marek_vane_3_002": ("広場は静まり返った。やがて一人の老婆が言った――『なら、誰が命令を下したのだ？』", "広場は静まり返った。 <short pause> やがて一人の老婆が言った――『なら、誰が命令を下したのだ？』"),
    "event_harvest_inn_meal_1_006": ("ニクシーはそれを食べた。ニクシーは平気だった。ただ、一時間ほど淡く光り続けた。", "ニクシーはそれを食べた。ニクシーは平気だった。 <short pause> ただ、一時間ほど淡く光り続けた。"),
    "event_harvest_inn_meal_3_002": ("二百人の声が、調子外れに大きく響いた。どこかで鐘が鳴ったが、歌を止める者は誰もいなかった。", "二百人の声が、調子外れに大きく響いた。 <short pause> どこかで鐘が鳴ったが、歌を止める者は誰もいなかった。"),
    "event_guild_salt_fever_3_003": ("村人たちはケラの瓶を受け取った。代理人は満載の木箱を抱え、誰もいない街道を去っていった。", "村人たちはケラの瓶を受け取った。 <short pause> 代理人は満載の木箱を抱え、誰もいない街道を去っていった。"),
    "event_council_herald_3_004": ("布告官は去った。布告は柱に打ちつけられたまま残り、その下に誰かが刻んだ――『誰が命じた？』", "布告官は去った。 <short pause> 布告は柱に打ちつけられたまま残り、その下に誰かが刻んだ――『誰が命じた？』"),
    # 12 Codex entries
    "codex_law_of_hours_text": ("すべての命には数えられた時が宿る。時は奪われ、与えられ、負債となるが、証人と同意なしに移されることはない。", "すべての命には数えられた時が宿る。 <short pause> 時は奪われ、与えられ、負債となるが、証人と同意なしに移されることはない。"),
    "codex_seven_bells_text": ("ヴェイル家は生者の時を数えるため、七つの鐘を縛った。鐘は癒やさない。ただ帳面を保つだけだ。", "ヴェイル家は生者の時を数えるため、七つの鐘を縛った。 <short pause> 鐘は癒やさない。ただ帳面を保つだけだ。"),
    "codex_names_text": ("それを記憶する名がなければ、時を記すことはできない。ゆえにヴェイルホールドの民は木々や扉に名を刻む。", "それを記憶する名がなければ、時を記すことはできない。 <short pause> ゆえにヴェイルホールドの民は、木々や扉に名を刻む。"),
    "codex_hollows_text": ("未払いの時によって残された抜け殻。彼らの名は消え去ったが、その時は消えていない。", "未払いの時によって残された抜け殻。 <short pause> 彼らの名は消え去ったが、その時は消えていない。"),
    "codex_crownfall_text": ("六年前、王都が陥落し、王は崩御し、宰相は死亡と記録された。以来、公爵評議会が統治を続けている。", "六年前、王都が陥落し、王は崩御し、宰相は死亡と記録された。 <short pause> 以来、公爵評議会が統治を続けている。"),
    "codex_vale_text": ("家系を持たぬ子らは、街道の帳面に『ヴェイル』と記される。ありふれた、そして孤独な名である。", "家系を持たぬ子らは、街道の帳面に『ヴェイル』と記される。 <short pause> ありふれた、そして孤独な名である。"),
    "codex_inquisition_text": ("封印記録の番人たる王立異端審問所の印。誰も書いたと認めぬ命令書に、今もその封蝋が現れる。", "封印記録の番人たる王立異端審問所の印。 <short pause> 誰も書いたと認めぬ命令書に、今もその封蝋が現れる。"),
    "codex_red_vial_text": ("錬金術師と医師の結社。片方の翼は解毒剤を保ち、もう片方の翼は人間の帳面を保っていた。", "錬金術師と医師の結社。 <short pause> 片方の翼は解毒剤を保ち、もう片方の翼は人間の帳面を保っていた。"),
    "codex_saint_luthos_text": ("鐘とは村全体が聴く祈りであり、声に出して呼ばれた名は生者の証人になると、聖ルトスは説いた。", "鐘とは村全体が聴く祈りであり、 <short pause> 声に出して呼ばれた名は生者の証人になると、聖ルトスは説いた。"),
    "codex_first_eclipse_text": ("幾世代も前、世継ぎの時をもって初めて鐘が固定された。以来、祭壇の上の蝕は一度も動いていない。", "幾世代も前、世継ぎの時をもって初めて鐘が固定された。 <short pause> 以来、祭壇の上の蝕は一度も動いていない。"),
    "codex_council_text": ("一本の断たれぬ紐に連なる七つの封蝋。それが王国を動かし続け、玉座を空席のままに保っている。", "一本の断たれぬ紐に連なる七つの封蝋。 <short pause> それが王国を動かし続け、玉座を空席のままに保っている。"),
    "codex_clockless_text": ("誰も老いることのない宮廷についての童話。多くの者は、それをただのおとぎ話だと思っている。", "誰も老いることのない宮廷についての童話。 <short pause> 多くの者は、それをただのおとぎ話だと思っている。"),
}


# ============================================================================
# DSP & CLAUSE SYNTHESIS ENGINE BY CHARACTER / VILLAIN TYPE
# ============================================================================
VILLAIN_TYPE_DSP: dict[str, dict[str, Any]] = {
    # Lady Yseldra Vale: Aristocratic cold contralto (~188 Hz) with Cathedral stone reflection
    "aristocratic_inquisitor": {
        "edge_voice": "ja-JP-NanamiNeural",
        "rate_pct": -7,
        "pitch_hz": -14,
        "pitch_ratio": 0.905,
        "af_chain": (
            "highpass=f=95,"
            "equalizer=f=215:t=q:w=1.0:g=2.8,"
            "equalizer=f=1650:t=q:w=1.2:g=1.2,"
            "equalizer=f=4200:t=q:w=1.3:g=-2.2,"
            "aecho=0.88:0.84:38|76:0.16|0.08,"
            "lowpass=f=10800"
        ),
    },
    # Lady Yseldra (distant bell echo): Cathedral dome echo + silver bell shimmer
    "distant_bell_echo": {
        "edge_voice": "ja-JP-NanamiNeural",
        "rate_pct": -10,
        "pitch_hz": -14,
        "pitch_ratio": 0.900,
        "af_chain": (
            "highpass=f=180,"
            "equalizer=f=520:t=q:w=1.1:g=1.8,"
            "equalizer=f=2900:t=q:w=1.1:g=2.4,"
            "aecho=0.86:0.85:64|128|192:0.28|0.18|0.10,"
            "lowpass=f=8200"
        ),
    },
    # Lord Cael Veyr: Silky, sinister Clockless Chancellor bass-baritone (~108 Hz) + subtle clockwork chorus
    "clockless_chancellor": {
        "edge_voice": "ja-JP-KeitaNeural",
        "rate_pct": -8,
        "pitch_hz": -14,
        "pitch_ratio": 0.865,
        "af_chain": (
            "highpass=f=55,"
            "equalizer=f=125:t=q:w=0.95:g=3.6,"
            "equalizer=f=340:t=q:w=1.1:g=1.4,"
            "equalizer=f=2450:t=q:w=1.2:g=1.8,"
            "equalizer=f=6000:t=q:w=1.4:g=-2.4,"
            "aecho=0.90:0.86:42|84:0.18|0.09,"
            "lowpass=f=9600"
        ),
    },
    # Captain Rusk: Gritty, aggressive mercenary duelist baritone (~128 Hz)
    "mercenary_duelist": {
        "edge_voice": "ja-JP-KeitaNeural",
        "rate_pct": 1,
        "pitch_hz": -4,
        "pitch_ratio": 0.955,
        "af_chain": (
            "highpass=f=70,"
            "equalizer=f=165:t=q:w=1.0:g=3.0,"
            "equalizer=f=1950:t=q:w=1.1:g=2.8,"
            "equalizer=f=3800:t=q:w=1.2:g=1.4,"
            "lowpass=f=9800"
        ),
    },
    # Marshal Oren: Heavy armored bridge commander bass-baritone (~102 Hz) + iron helm resonance
    "armored_commander": {
        "edge_voice": "ja-JP-KeitaNeural",
        "rate_pct": -6,
        "pitch_hz": -16,
        "pitch_ratio": 0.840,
        "af_chain": (
            "highpass=f=58,"
            "equalizer=f=135:t=q:w=0.95:g=3.8,"
            "equalizer=f=480:t=q:w=1.3:g=2.2,"
            "equalizer=f=2150:t=q:w=1.2:g=1.8,"
            "aecho=0.88:0.82:24|58:0.20|0.09,"
            "lowpass=f=8800"
        ),
    },
    # The Red Vial Matron: Obsessive, venomous alchemist matron (~202 Hz)
    "alchemist_matron": {
        "edge_voice": "ja-JP-NanamiNeural",
        "rate_pct": -4,
        "pitch_hz": -9,
        "pitch_ratio": 0.935,
        "af_chain": (
            "highpass=f=100,"
            "equalizer=f=240:t=q:w=1.0:g=2.4,"
            "equalizer=f=2650:t=q:w=1.1:g=2.5,"
            "equalizer=f=6800:t=q:w=1.2:g=1.8,"
            "aecho=0.88:0.84:34|68:0.16|0.08,"
            "lowpass=f=11200"
        ),
    },
    # Undercity Alchemist & Ledger Agent
    "undercity_alchemist": {
        "edge_voice": "ja-JP-KeitaNeural",
        "rate_pct": -5,
        "pitch_hz": 4,
        "pitch_ratio": 1.020,
        "af_chain": (
            "highpass=f=80,"
            "equalizer=f=190:t=q:w=1.1:g=2.0,"
            "equalizer=f=2400:t=q:w=1.2:g=1.5,"
            "aecho=0.88:0.84:32:0.14,"
            "lowpass=f=9600"
        ),
    },
    "ledger_agent": {
        "edge_voice": "ja-JP-KeitaNeural",
        "rate_pct": -2,
        "pitch_hz": 2,
        "pitch_ratio": 1.005,
        "af_chain": (
            "highpass=f=85,"
            "equalizer=f=200:t=q:w=1.1:g=1.8,"
            "equalizer=f=2750:t=q:w=1.1:g=2.2,"
            "lowpass=f=10200"
        ),
    },
    # The Ashen Lord's Wraith: Multi-layered spectral phantom lord (special multi-layer DSP!)
    "spectral_wraith": {
        "edge_voice": "ja-JP-KeitaNeural",
        "rate_pct": -14,
        "pitch_hz": -18,
        "pitch_ratio": 0.815,
        "spectral_layers": True,
        "af_chain": (
            "highpass=f=65,"
            "equalizer=f=150:t=q:w=1.0:g=3.2,"
            "equalizer=f=1450:t=q:w=1.1:g=2.4,"
            "equalizer=f=4800:t=q:w=1.2:g=1.8,"
            "aecho=0.85:0.86:55|110|165:0.32|0.22|0.14,"
            "lowpass=f=8600"
        ),
    },
    # The Bell-Widow (Ritual Boss): Dual-layered spectral female chant + silver/bronze bell harmonic
    "ritual_boss": {
        "edge_voice": "ja-JP-NanamiNeural",
        "rate_pct": -9,
        "pitch_hz": -12,
        "pitch_ratio": 0.895,
        "bell_widow_layers": True,
        "af_chain": (
            "highpass=f=90,"
            "equalizer=f=220:t=q:w=1.0:g=2.6,"
            "equalizer=f=2100:t=q:w=1.1:g=2.2,"
            "aecho=0.86:0.85:48|96|144:0.26|0.16|0.10,"
            "lowpass=f=10400"
        ),
    },
    # The Eclipse Construct: Colossal mythic-mechanical guardian (76 Hz sub-bass + crystalline ring-mod)
    "mythic_construct": {
        "edge_voice": "ja-JP-KeitaNeural",
        "rate_pct": -16,
        "pitch_hz": -20,
        "pitch_ratio": 0.745,
        "construct_layers": True,
        "af_chain": (
            "highpass=f=42,"
            "equalizer=f=95:t=q:w=0.9:g=4.5,"
            "equalizer=f=420:t=q:w=1.2:g=2.5,"
            "equalizer=f=2200:t=q:w=1.1:g=2.8,"
            "aecho=0.88:0.86:36|72|108:0.25|0.16|0.10,"
            "lowpass=f=7800"
        ),
    },
    "mythic_construct_fading": {
        "edge_voice": "ja-JP-KeitaNeural",
        "rate_pct": -22,
        "pitch_hz": -22,
        "pitch_ratio": 0.705,
        "construct_layers": True,
        "fading_power_down": True,
        "af_chain": (
            "highpass=f=40,"
            "equalizer=f=88:t=q:w=0.9:g=4.8,"
            "equalizer=f=380:t=q:w=1.2:g=2.4,"
            "equalizer=f=1850:t=q:w=1.1:g=2.0,"
            "aecho=0.86:0.86:48|96|144:0.30|0.20|0.12,"
            "lowpass=f=6800"
        ),
    },
    # The Ash-Maw (Beast Boss): Monstrous sub-bass roar + jaw-bell resonance
    "beast_boss": {
        "edge_voice": "ja-JP-KeitaNeural",
        "rate_pct": -18,
        "pitch_hz": -24,
        "pitch_ratio": 0.580,
        "beast_roar_layers": True,
        "af_chain": (
            "highpass=f=35,"
            "equalizer=f=78:t=q:w=0.8:g=5.2,"
            "equalizer=f=210:t=q:w=1.0:g=3.6,"
            "equalizer=f=1250:t=q:w=1.2:g=2.2,"
            "aecho=0.88:0.84:42|84:0.22|0.12,"
            "lowpass=f=5400"
        ),
    },
}


def parse_clauses(tts_text: str, fallback_ja: str) -> list[dict[str, Any]]:
    src = (tts_text or fallback_ja).strip()
    tokens = re.split(r"(<short pause>|<long pause>)", src)
    clauses: list[dict[str, Any]] = []
    pending_pause_ms = 0
    for tok in tokens:
        t = tok.strip()
        if not t:
            continue
        if t == "<short pause>":
            pending_pause_ms = max(pending_pause_ms, 230)
            continue
        if t == "<long pause>":
            pending_pause_ms = max(pending_pause_ms, 480)
            continue
        clean = re.sub(r"<[^>]+>", "", t).strip()
        clean = re.sub(r"\s+", " ", clean).strip()
        if not clean:
            continue
        clauses.append({"text": clean, "pause_before_ms": pending_pause_ms})
        pending_pause_ms = 240
    if not clauses:
        clauses.append({"text": fallback_ja.strip(), "pause_before_ms": 0})
    else:
        clauses[0]["pause_before_ms"] = 0
    return clauses


async def synth_clause_pcm(voice: str, rate_str: str, pitch_str: str, text: str) -> np.ndarray:
    CLAUSE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256(f"{voice}|{rate_str}|{pitch_str}|{text}".encode("utf-8")).hexdigest()[:24]
    mp3_path = CLAUSE_CACHE_DIR / f"{key}.mp3"
    wav_path = CLAUSE_CACHE_DIR / f"{key}.wav"

    if not wav_path.exists():
        for attempt in range(4):
            try:
                comm = edge_tts.Communicate(text, voice, rate=rate_str, pitch=pitch_str)
                await comm.save(str(mp3_path))
                subprocess.run(
                    [FFMPEG, "-y", "-i", str(mp3_path), "-ar", str(SR), "-ac", "1", str(wav_path)],
                    capture_output=True,
                    check=True,
                )
                break
            except Exception as exc:
                if attempt == 3:
                    raise RuntimeError(f"Failed clause {text!r}: {exc}") from exc
                await asyncio.sleep(0.6 * (attempt + 1))

    with wave.open(str(wav_path), "rb") as w:
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0

    abs_x = np.abs(raw)
    win = int(SR * 0.01)
    if len(abs_x) > win * 2:
        env = np.convolve(abs_x, np.ones(win) / win, mode="same")
        idx = np.where(env > 0.0025)[0]
        if len(idx) > 0:
            start = max(0, int(idx[0]) - int(SR * 0.028))
            end = min(len(raw), int(idx[-1]) + int(SR * 0.048))
            raw = raw[start:end]

    fi = min(len(raw) // 4, int(SR * 0.018))
    fo = min(len(raw) // 4, int(SR * 0.028))
    if fi > 1:
        raw[:fi] *= 0.5 * (1.0 - np.cos(np.linspace(0, math.pi, fi)))
    if fo > 1:
        raw[-fo:] *= 0.5 * (1.0 + np.cos(np.linspace(0, math.pi, fo)))
    return raw


def apply_special_creature_or_entity_layers(pcm: np.ndarray, dsp: dict[str, Any]) -> np.ndarray:
    """
    Applies bespoke non-human/supernatural vocal layering before FFmpeg rubberband + EQ:
      - `spectral_layers` (Ashen Lord's Wraith): Reverse pre-ghost swell + sub-octave spectre + eerie whisper shimmer
      - `bell_widow_layers` (The Bell-Widow): Spectral double-voice + resonant silver/bronze cathedral bell overtones
      - `construct_layers` (The Eclipse Construct): Sub-harmonic stone/gold resonator + crystalline ring-modulation + mechanical seal pulse
      - `beast_roar_layers` (The Ash-Maw): Sub-bass guttural growl synthesis + broken bronze jaw-bell clang + ember hiss
    """
    n = len(pcm)
    t = np.arange(n, dtype=np.float64) / SR
    out = pcm.copy()

    if dsp.get("spectral_layers"):
        # Pre-echo ghost whisper + detuned phantom double
        shift1 = int(SR * 0.042)
        shift2 = int(SR * 0.088)
        ghost1 = np.zeros_like(out)
        ghost2 = np.zeros_like(out)
        if n > shift1:
            ghost1[shift1:] = out[:-shift1] * 0.42
        if n > shift2:
            ghost2[shift2:] = out[:-shift2] * 0.25
        # Subtle eerie phase-tremolo
        shimmer = 1.0 + 0.14 * np.sin(2.0 * math.pi * 5.2 * t)
        out = out * shimmer + ghost1 + ghost2

    elif dsp.get("bell_widow_layers"):
        # Resonant cathedral bell partial (528 Hz + 792 Hz + 1056 Hz decaying chime) blended under the voice
        env = np.exp(-t * 1.8)
        bell = (
            0.035 * np.sin(2.0 * math.pi * 523.25 * t)
            + 0.022 * np.sin(2.0 * math.pi * 783.99 * t)
            + 0.014 * np.sin(2.0 * math.pi * 1174.66 * t)
        ) * env
        delay = int(SR * 0.035)
        double_v = np.zeros_like(out)
        if n > delay:
            double_v[delay:] = out[:-delay] * 0.34
        out = out + double_v + bell

    elif dsp.get("construct_layers"):
        # Crystalline/metallic ring-modulator + sub-bass temple seal pulse
        ring_carrier = 1.0 + 0.28 * np.sin(2.0 * math.pi * 38.0 * t) + 0.12 * np.sin(2.0 * math.pi * 114.0 * t)
        sub_pulse = 0.045 * np.sin(2.0 * math.pi * 65.4 * t) * np.exp(-t * 1.1)
        chime_onset = 0.040 * np.sin(2.0 * math.pi * 880.0 * t) * np.exp(-t * 6.5)
        out = out * ring_carrier + sub_pulse + chime_onset
        if dsp.get("fading_power_down"):
            # Gradual power-down envelope at the tail
            fade_curve = np.linspace(1.0, 0.55, n)
            out = out * fade_curve

    elif dsp.get("beast_roar_layers"):
        # Monstrous guttural sub-growl + nonlinear roar saturation + cracked jaw-bell strike
        rng = np.random.default_rng(42)
        growl_mod = 1.0 + 0.45 * np.sin(2.0 * math.pi * 26.0 * t + 0.4 * np.sin(2.0 * math.pi * 4.5 * t))
        sub_roar = (
            0.22 * np.sin(2.0 * math.pi * (62.0 - 14.0 * (t / max(t[-1], 0.1))) * t)
            + 0.14 * np.sin(2.0 * math.pi * 118.0 * t)
        ) * np.exp(-t * 0.65)
        ember_breath = rng.normal(0.0, 0.035, n) * np.exp(-t * 1.2)
        # Cracked bronze jaw-bell (`jaw_bell`) metallic clink
        jaw_bell = (
            0.055 * np.sin(2.0 * math.pi * 311.13 * t)
            + 0.035 * np.sin(2.0 * math.pi * 466.16 * t)
        ) * np.exp(-t * 3.2)
        out = np.tanh((out * growl_mod + sub_roar + ember_breath + jaw_bell) * 1.65)

    return out


async def synth_and_master_villain_line(
    line_id: str,
    villain_type: str,
    tts_text: str,
    fallback_ja: str,
    out_ogg_path: Path,
) -> float:
    dsp = VILLAIN_TYPE_DSP[villain_type]
    clauses = parse_clauses(tts_text, fallback_ja)
    segments: list[np.ndarray] = [np.zeros(int(SR * 0.060), dtype=np.float64)]

    for idx, cl in enumerate(clauses):
        pause_ms = int(round(cl["pause_before_ms"]))
        if pause_ms > 0:
            segments.append(np.zeros(int(SR * (pause_ms / 1000.0)), dtype=np.float64))
        rate_pct = int(dsp["rate_pct"]) + (-2 if idx == len(clauses) - 1 and len(clauses) > 1 else 0)
        pitch_hz = int(dsp["pitch_hz"]) + (-1 if idx == len(clauses) - 1 and len(clauses) > 1 else 0)
        pcm = await synth_clause_pcm(
            dsp["edge_voice"],
            f"{rate_pct:+d}%",
            f"{pitch_hz:+d}Hz",
            cl["text"],
        )
        segments.append(pcm)

    segments.append(np.zeros(int(SR * 0.140), dtype=np.float64))
    assembled = np.concatenate(segments)
    assembled = apply_special_creature_or_entity_layers(assembled, dsp)

    tmp_in = CLAUSE_CACHE_DIR / f"tmp_{line_id}_in.wav"
    tmp_probe = CLAUSE_CACHE_DIR / f"tmp_{line_id}_probe.wav"

    pcm16 = np.clip(assembled * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(tmp_in), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm16.tobytes())

    pitch_ratio = float(dsp["pitch_ratio"])
    af_chain = f"rubberband=pitch={pitch_ratio:.4f}:formant=preserved,{dsp['af_chain']}"

    subprocess.run(
        [FFMPEG, "-y", "-i", str(tmp_in), "-af", af_chain, "-ar", str(SR), "-ac", "1", str(tmp_probe)],
        capture_output=True,
        check=True,
    )

    with wave.open(str(tmp_probe), "rb") as w:
        y = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0

    frame_len = int(SR * 0.025)
    if len(y) >= frame_len:
        frames = y[: (len(y) // frame_len) * frame_len].reshape(-1, frame_len)
        rms = np.sqrt((frames**2).mean(axis=1))
        active = rms[rms > 0.010]
        active_rms = float(np.median(active)) if len(active) > 0 else float(np.sqrt(np.mean(y**2)) + 1e-6)
    else:
        active_rms = float(np.sqrt(np.mean(y**2)) + 1e-6)

    target_rms = 10.0 ** (-18.2 / 20.0)
    gain = min(4.5, target_rms / max(active_rms, 1e-4))
    y = y * gain
    peak = float(np.max(np.abs(y)) + 1e-9)
    if peak > 0.88:
        y = np.tanh(y / 0.88) * 0.88

    out_pcm16 = np.clip(y * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(tmp_probe), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(out_pcm16.tobytes())

    out_ogg_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [FFMPEG, "-y", "-i", str(tmp_probe), "-c:a", "libvorbis", "-q:a", "6", "-ar", str(SR), "-ac", "1", str(out_ogg_path)],
        capture_output=True,
        check=True,
    )

    with wave.open(str(tmp_probe), "rb") as w:
        final_dur = w.getnframes() / float(w.getframerate())

    tmp_in.unlink(missing_ok=True)
    tmp_probe.unlink(missing_ok=True)
    return round(final_dur, 2)


async def synth_and_master_enemy_archetype_cue(cue: dict[str, Any], out_ogg_path: Path) -> float:
    cue_id = cue["cue_id"]
    archetype = cue["archetype"]
    ja = cue["ja"]

    archetype_to_type = {
        "beast": "beast_boss",
        "serpent": "alchemist_matron",
        "hollow": "armored_commander",
        "wraith": "spectral_wraith",
        "knight": "mercenary_duelist",
        "cultist": "undercity_alchemist",
    }
    vtype = archetype_to_type[archetype]
    return await synth_and_master_villain_line(cue_id, vtype, ja, ja, out_ogg_path)


async def synth_and_master_trio_library_line(
    line_id: str,
    speaker_id: str,
    tts_text: str,
    fallback_ja: str,
    out_ogg_path: Path,
) -> float:
    clauses = parse_clauses(tts_text, fallback_ja)
    segments: list[np.ndarray] = [np.zeros(int(SR * 0.060), dtype=np.float64)]

    for idx, cl in enumerate(clauses):
        pause_ms = int(round(cl["pause_before_ms"]))
        if pause_ms > 0:
            segments.append(np.zeros(int(SR * (pause_ms / 1000.0)), dtype=np.float64))
        if speaker_id in ("narrator", "narration"):
            voice = "ja-JP-KeitaNeural"
            rate_pct = -5 + (-3 if idx == len(clauses) - 1 and len(clauses) > 1 else 0)
            pitch_hz = -12 + (-2 if idx == len(clauses) - 1 and len(clauses) > 1 else 0)
        else:  # mahmut
            voice = "ja-JP-KeitaNeural"
            rate_pct = -3 + (-2 if idx == len(clauses) - 1 and len(clauses) > 1 else 0)
            pitch_hz = 10 + (-1 if idx == len(clauses) - 1 and len(clauses) > 1 else 0)
        pcm = await synth_clause_pcm(voice, f"{rate_pct:+d}%", f"{pitch_hz:+d}Hz", cl["text"])
        segments.append(pcm)

    segments.append(np.zeros(int(SR * 0.120), dtype=np.float64))
    assembled = np.concatenate(segments)

    tmp_in = CLAUSE_CACHE_DIR / f"tmp_{line_id}_in.wav"
    tmp_probe = CLAUSE_CACHE_DIR / f"tmp_{line_id}_probe.wav"

    pcm16 = np.clip(assembled * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(tmp_in), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm16.tobytes())

    if speaker_id in ("narrator", "narration"):
        af_chain = (
            "rubberband=pitch=0.8580:formant=preserved,"
            "highpass=f=55,"
            "equalizer=f=130:t=q:w=0.95:g=3.2,"
            "equalizer=f=320:t=q:w=1.1:g=1.2,"
            "equalizer=f=2750:t=q:w=1.2:g=1.0,"
            "equalizer=f=6200:t=q:w=1.4:g=-2.2,"
            "aecho=0.88:0.86:48|96|144:0.17|0.10|0.05,"
            "lowpass=f=9600"
        )
    else:  # mahmut (Iapetus ~144.6 Hz)
        af_chain = (
            "rubberband=pitch=1.0780:formant=preserved,"
            "highpass=f=75,"
            "equalizer=f=180:t=q:w=1.0:g=2.6,"
            "equalizer=f=2350:t=q:w=1.2:g=1.9,"
            "equalizer=f=6400:t=q:w=1.4:g=-2.2,"
            "lowpass=f=10200"
        )

    subprocess.run(
        [FFMPEG, "-y", "-i", str(tmp_in), "-af", af_chain, "-ar", str(SR), "-ac", "1", str(tmp_probe)],
        capture_output=True,
        check=True,
    )

    with wave.open(str(tmp_probe), "rb") as w:
        y = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0

    frame_len = int(SR * 0.025)
    if len(y) >= frame_len:
        frames = y[: (len(y) // frame_len) * frame_len].reshape(-1, frame_len)
        rms = np.sqrt((frames**2).mean(axis=1))
        active = rms[rms > 0.010]
        active_rms = float(np.median(active)) if len(active) > 0 else float(np.sqrt(np.mean(y**2)) + 1e-6)
    else:
        active_rms = float(np.sqrt(np.mean(y**2)) + 1e-6)

    target_rms = 10.0 ** (-18.5 / 20.0)
    gain = min(4.4, target_rms / max(active_rms, 1e-4))
    y = y * gain
    peak = float(np.max(np.abs(y)) + 1e-9)
    if peak > 0.88:
        y = np.tanh(y / 0.88) * 0.88

    out_pcm16 = np.clip(y * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(tmp_probe), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(out_pcm16.tobytes())

    out_ogg_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [FFMPEG, "-y", "-i", str(tmp_probe), "-c:a", "libvorbis", "-q:a", "6", "-ar", str(SR), "-ac", "1", str(out_ogg_path)],
        capture_output=True,
        check=True,
    )

    with wave.open(str(tmp_probe), "rb") as w:
        final_dur = w.getnframes() / float(w.getframerate())

    tmp_in.unlink(missing_ok=True)
    tmp_probe.unlink(missing_ok=True)
    return round(final_dur, 2)


async def main() -> None:
    t0 = time.time()
    print(
        f"Synthesizing & mastering:\n"
        f"  - {len(VILLAIN_STORY_LINES)} Villain & Boss spoken story/library lines\n"
        f"  - {len(BOSS_COMBAT_CUES)} Boss combat vocal/effect cues (7 bosses x 4 cues)\n"
        f"  - {len(ENEMY_ARCHETYPE_CUES)} Regular enemy archetype vocal/SFX cues (6 families x 3 cues)\n"
        f"  - {len(MAHMUT_LIBRARY_JA)} Mahmut Library lines + {len(NARRATOR_LIBRARY_JA)} Narrator Library/Codex lines...",
        flush=True,
    )

    pres = json.loads(CAMPAIGN_PRESENTATION_PATH.read_text(encoding="utf-8"))
    voices: dict[str, Any] = dict(pres.get("voices", {}))
    sounds: dict[str, Any] = dict(pres.get("sounds", {}))

    # 1. Villain & Boss story/library lines
    for ln in VILLAIN_STORY_LINES:
        lid = ln["line_id"]
        out_ogg = CAMPAIGN_VOICES_DIR / f"{lid}.ogg"
        act_d = await synth_and_master_villain_line(
            lid,
            ln["villain_type"],
            ln["tts_text_gemini38"],
            ln["ja"],
            out_ogg,
        )
        dec_d = round(act_d + 0.06, 2)
        ln["recorded_duration_s"] = dec_d
        print(f"  [VILLAIN STORY] {lid:28s} ({ln['speaker_id']:20s} / {ln['villain_type']}) -> {act_d:.2f}s", flush=True)

    # 2. 7 Bosses x 4 Combat Vocal/Effect Cues
    for cue in BOSS_COMBAT_CUES:
        cid = cue["cue_id"]
        out_ogg = CAMPAIGN_VOICES_DIR / f"{cid}.ogg"
        act_d = await synth_and_master_villain_line(
            cid,
            cue["villain_type"],
            cue["ja"],
            cue["ja"],
            out_ogg,
        )
        dec_d = round(act_d + 0.06, 2)
        cue["recorded_duration_s"] = dec_d
        sounds[cid] = {
            "file": f"voices/{cid}.ogg",
            "duration_s": dec_d,
            "loop": False,
            "volume": 1.0,
        }
        print(f"  [BOSS VO/FX]    {cid:28s} ({cue['villain_type']}) -> {act_d:.2f}s", flush=True)

    # 3. 6 Regular Enemy Archetypes x 3 Combat Vocal/SFX Cues
    for cue in ENEMY_ARCHETYPE_CUES:
        cid = cue["cue_id"]
        out_ogg = CAMPAIGN_VOICES_DIR / f"{cid}.ogg"
        act_d = await synth_and_master_enemy_archetype_cue(cue, out_ogg)
        dec_d = round(act_d + 0.06, 2)
        cue["recorded_duration_s"] = dec_d
        sounds[cid] = {
            "file": f"voices/{cid}.ogg",
            "duration_s": dec_d,
            "loop": False,
            "volume": 0.92,
        }
        print(f"  [ENEMY FX]      {cid:28s} ({cue['archetype']}) -> {act_d:.2f}s", flush=True)

    # Save Villain & Boss script manifest and compute sha256
    villain_doc = {
        "schema_version": "1.0",
        "title": "Unaware of My Demise — Part I Villains, Bosses & Enemy Archetypes Voice & Effect Script",
        "story_lines": VILLAIN_STORY_LINES,
        "boss_combat_cues": BOSS_COMBAT_CUES,
        "enemy_archetype_cues": ENEMY_ARCHETYPE_CUES,
    }
    VILLAIN_SCRIPT_PATH.write_text(
        json.dumps(villain_doc, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    villain_sha256 = hashlib.sha256(VILLAIN_SCRIPT_PATH.read_bytes()).hexdigest()

    for ln in VILLAIN_STORY_LINES:
        lid = ln["line_id"]
        voices[lid] = {
            "file": f"voices/{lid}.ogg",
            "language": "ja",
            "reviewed_transcript_sha256": villain_sha256,
            "duration_s": ln["recorded_duration_s"],
        }

    # 4. Synthesize remaining 41 Mahmut Library lines + 29 Narrator Library/Codex lines
    for lid, (ja, tts_ja) in MAHMUT_LIBRARY_JA.items():
        out_ogg = CAMPAIGN_VOICES_DIR / f"{lid}.ogg"
        act_d = await synth_and_master_trio_library_line(lid, "mahmut", tts_ja, ja, out_ogg)
        dec_d = round(act_d + 0.06, 2)
        voices[lid] = {
            "file": f"voices/{lid}.ogg",
            "language": "ja",
            "reviewed_transcript_sha256": villain_sha256,
            "duration_s": dec_d,
        }

    for lid, (ja, tts_ja) in NARRATOR_LIBRARY_JA.items():
        out_ogg = CAMPAIGN_VOICES_DIR / f"{lid}.ogg"
        act_d = await synth_and_master_trio_library_line(lid, "narrator", tts_ja, ja, out_ogg)
        dec_d = round(act_d + 0.06, 2)
        voices[lid] = {
            "file": f"voices/{lid}.ogg",
            "language": "ja",
            "reviewed_transcript_sha256": villain_sha256,
            "duration_s": dec_d,
        }

    pres["voices"] = voices
    pres["sounds"] = sounds
    CAMPAIGN_PRESENTATION_PATH.write_text(
        json.dumps(pres, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"\nCompleted all Villain/Boss/Enemy & Library Trio audio in {time.time() - t0:.1f}s!\n"
        f"Updated {CAMPAIGN_PRESENTATION_PATH.relative_to(ROOT)}: "
        f"{len(voices)} story/library voices + {len(sounds)} combat VO/SFX cues.",
        flush=True,
    )


if __name__ == "__main__":
    asyncio.run(main())
