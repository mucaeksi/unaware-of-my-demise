"""Build audio/voice/jp_script_fadyme.json: every Fadyme line in Part I (story, companion stories,
events, battle/menu VO) with the Japanese recording text. Draft by the Narrative & Visual Director;
a native Japanese editor reviews before final. Run from narrative/: python3 tools/build_jp_script_fadyme.py"""
import json, os, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---- Japanese text (adapted to emotion and timing, not literal) ----
JA = {
# opening / ch1
"opening_001": "明日、鐘より先に目が覚めたなら……運が良かったと思うことにする。もし覚めなかったら……マフムトには、このページを決して読ませない。",
"opening_002": "一か月。もっと短いかもしれない。老医師は、お母様の祈祷書にそう書いた。インクは震えていない。震えているのは、私。",
"opening_004": "なら、ごちそうね。私は、まったく平気よ。",
"opening_006": "寒さが、指先を見つけただけ。ほかのところまでは、見つけられていないわ。",
"opening_012": "あの人を、知っているの？",
"opening_014": "あの人が持つ鐘なら知っている。それが私のために鳴るとき、何を意味するのかも。",
"node_1_1_pre_002": "私が一度でも言うことを聞いたみたいな言い方ね。",
"node_1_1_pre_003": "あの鐘には舌がない。なのに、どうしてまだ聞こえるの？",
"node_1_1_post_002": "止まってなんかいない。ささやき方を覚えただけよ。",
"node_1_1_post_003": "一歩。それから、もう一歩。何歩ぶんの代償か、道に知らせる必要はない。",
"node_1_2_pre_003": "梁を支える手が三つ、死者に向ける剣が三振り。両方こなせるわ。",
"node_1_3_post_002": "一緒に来てくれるの？",
"node_1_4_post_002": "無理に、私たちと来なくてもいいのよ。",
"node_1_5_pre_003": "顎が開いたら、鐘の舌を狙って。好機は一度きりよ。",
"node_1_5_post_002": "朝になれば、あの音も忘れるわ。",
"node_1_5_post_004": "雨のせいよ。私は、まったく平気。",
"node_1_5_post_005": "指先が白くなってきた。次の町を過ぎたら、彼に話そう。",
"ch1_first_oath_004": "それで、本当に来てくれるの？ そんなに簡単に？",
"ch1_first_oath_006": "忘れてしまう人を、覚えていてくれる約束。……私にも、ひとつ欲しい。",
"ch1_camp_005": "近づいては来ない。そこにいると、私たちに知らせたいだけ。",
"ch1_camp_006": "鐘の未亡人。お母様の肖像画が外された夜も、あんなふうに鳴った。",
"ch1_camp_008": "いつもそう言うのね。いつか私が見張って、あなたが眠る日が来るわ。",
# ch2
"node_2_1_pre_003": "あの鐘、綱がないわ。",
"node_2_1_post_002": "なら、石は、私たちが忘れたことを覚えているのね。",
"node_2_1_post_003": "私の名前を、覚えている。",
"node_2_2_post_002": "人と真実のどちらかを、あなたが選ばなければならないなんて……そんなはず、ありません。",
"node_2_3_pre_002": "インクが傷んでいただけかもしれません。",
"node_2_3_post_003": "世界に忘れさせたかった誰かなら、知っているわ。",
"node_2_3_post_004": "そして世界は、もう忘れ始めている。",
"node_2_4_post_001": "それを書いた人は、慈悲のつもりだったのかもしれない。",
"node_2_4_post_003": "そうね。でも、人には必要なのよ。",
"node_2_5_pre_004": "私を、連れて行きに来たのね。",
"node_2_5_pre_007": "マフムト……？",
"node_2_5_post_005": "あの人は、私が死にかけていると知っている。だからといって、マフムトに知られていいわけじゃない。",
"node_2_5_post_006": "彼は私に嘘をついた。優しく。……私たち、どちらも何かを隠しているのね。",
"ch2_road_002": "昔、あそこで祈ったことがあるの。長椅子の下に隠れられるくらい、小さかった頃。",
"ch2_road_004": "今、話しているでしょう？ ほら。ちゃんと話すのよ、私。",
"ch2_road_005": "小さなことだけ。小さなことだけを。",
"ch2_camp_001": "あの人を、知っていたのね。",
"ch2_camp_003": "知らないって言った。雨の中で。とても早口で。",
"ch2_camp_005": "ずいぶん、愚かな理由ね。",
"ch2_camp_006": "そしてそれは、私の理由でもある。彼を叱れば、自分を叱ることになる。",
"ch2_camp_007": "話せるときに、残りを聞かせて。今夜は聞かないから。",
# ch3
"node_3_1_post_001": "名前をひとつ失っても、村は生きていけるわ。",
"node_3_1_post_004": "私が隠れていた一年ごとに、誰かが私の時間を払っていた。",
"node_3_2_post_003": "なら、私たちと行きましょう。盾は、人が必要とする場所にあるべきよ。",
"node_3_3_pre_002": "両方、届くわ。",
"node_3_3_pre_004": "傭兵の血よ。バケツを止めないで。",
"node_3_3_post_002": "なら、やっと敵があなたに一太刀浴びせたのね。",
"node_3_3_post_003": "自分の血を、彼の籠手で拭ってしまった。滴の数を、数えさせてはいけない。",
"node_3_4_pre_003": "大切なものが、全部書き残せるとは限らないわ。",
"node_3_5_post_004": "C.V.……お父様の最後のページで、あの文字を見た。",
"node_3_5_post_005": "命令書を開くのは、治療師を見つけてからにしましょう。",
"ch3_road_002": "前の塀でも止まったわ。その前の塀でも。",
"ch3_road_004": "私に合わせて歩いてくれているのね。",
"ch3_camp_002": "まず、治療師を。お願い。",
"ch3_camp_004": "何が書いてあっても、そのあと、この席の誰かに治療師が要るかもしれないから。",
# ch4
"node_4_1_post_002": "私たちのために、こんな地下まで来てくださらなくても、よかったのに。",
"node_4_2_post_003": "この街に、息のできる場所をくださったんですね。",
"node_4_3_pre_003": "では……私が応えるのをやめたら？",
"node_4_3_post_002": "霊薬が効くかもしれない、と伝えて。",
"node_4_3_post_004": "小さな嘘よ。持たせておいて。",
"node_4_3_post_005": "マフムトはもう、私の名前のために、十分すぎる年月をくれた。",
"node_4_4_pre_002": "霊薬が効くかもしれない、って。",
"node_4_4_pre_004": "なら、完成させて。ひどい調合を役に立つものに変えるのは、あなたの得意でしょう？",
"node_4_4_post_003": "私が頼んだから、彼は希望を受け取った。私はそれを抱えて生きていくしかない。",
"node_4_5_pre_003": "フラスコを割って。あの人に、最後まで言わせないで。",
"node_4_5_post_005": "数週間。もっと短いかもしれない。繰り返しても、優しい言葉にはならない。",
"ch4_road_003": "それに、治療師も。",
"ch4_road_005": "わかってる。森は少なくとも、ささやいてくれたものね。",
"ch4_camp_002": "お日様が温かいの。温かくていいんだって、忘れていたわ。",
"ch4_camp_004": "もうすぐよ。ケラは『もうすぐ』がとても得意なの。",
"ch4_camp_005": "数週間。そのいくらかは、日なたに立って過ごそう。それくらいは、私が選べる。",
# ch5
"node_5_1_post_002": "まるで、橋がまだ架かっているみたいに歌うんですね。",
"node_5_2_post_002": "あなたはいつも、人と崩れ落ちるものの間に立つんですね。",
"node_5_3_post_003": "なら、本人に理由を聞きましょう。",
"node_5_4_pre_002": "逃げるつもりなんて、なかったわ。",
"node_5_4_post_001": "……少し疲れただけ。ここは、風が冷たいのね。",
"node_5_4_post_003": "なら、私はずっと一貫しているのね。",
"node_5_4_post_004": "白いひと筋。彼より先に、鏡が覚えてしまうものが、またひとつ。",
"node_5_5_pre_004": "約束を、計画と同じものだと思われたのですね。",
"node_5_5_post_004": "白いひと筋は小さい。小さなものなら、まだ隠せる。",
"ch5_road_004": "なら、その人はフードを下ろさないほうがいいわね。",
"ch5_camp_001": "橋を渡ってから、ひと言も話していないわね。",
"ch5_camp_003": "そして今夜、あの人は橋を守った。",
"ch5_camp_005": "遅れてきた人、ということよ。その気持ちは、あなたも知っているでしょう？",
# ch6
"node_6_1_post_003": "勇気って、たいていそういう形をしているのよ。",
"node_6_2_post_001": "……私の、お母様よ。",
"node_6_2_post_003": "ちゃんと覚えているのか、自信がなかったの。",
"node_6_2_post_006": "なら、それがどれほど簡単に起きるか、あなたは知っている。それは、自分で選ぶこととは違います。",
"node_6_3_post_002": "部屋も、誰かを恋しく思うことがあるんでしょうか。",
"node_6_4_pre_002": "支えてる。行って。",
"node_6_4_pre_004": "埃よ。ただの埃。",
"node_6_4_pre_005": "ハナ。お願い、彼には言わないで。",
"node_6_4_post_003": "台帳にその名前はない。先を急ぎましょう。",
"node_6_4_post_004": "あの文字が、また私たちを見つけた。誰の手で書かれたのか、私は知っている。",
"node_6_5_post_003": "世継ぎのための日程よ。インクは、それ以上何も言っていない。",
"ch6_road_002": "セーブルよ。中から扉を開けるって言っていたわ。",
"ch6_road_004": "あの人は誰かのために扉を開けて、自分が先に通ることはしない。そういう人は、約束を守るわ。",
"ch6_road_005": "里程標に灰色の蝋。まだ柔らかい。今朝ここを通ったのね。あの人は、私たちより先にいる。",
"ch6_camp_005": "どの階段でも、いちばん慎重な人になるわ。",
# ch7
"node_7_1_pre_005": "まるで、いつも消えようとしているのが私みたいな言い方ね。",
"node_7_1_post_002": "なら、あなたの家族は、自分たちがつけたわけじゃない傷を繕おうとしたのね。",
"node_7_2_post_003": "全部終わったら、そのバリケードの話、ひとつ残らず聞かせて。",
"node_7_2_post_004": "全部終わったら。……その言葉を、尽きるまで借り続けよう。",
"node_7_3_pre_007": "私は、捧げられるためにここへ来た。なのに皆は、私を見届けたいと言ってくれる。",
"node_7_3_pre_006": "なら、書き戻して。何を意味するかを恐れられたからといって、名前が消えていいはずがないわ。",
"node_7_3_post_003": "お母様の名前よ。私のものになる前は、お母様のものだった。",
"node_7_3_post_004": "ごめんなさい。これだけのことでも、あなたが知る前に、もう一日だけ、静かな日が欲しかった。",
"node_7_4_pre_007": "やってみるって、約束する。",
"node_7_4_post_002": "マフムト。これが終わったら、そばにいて。少しの間だけでいいから。",
"node_7_4_post_004": "『ずっと』の頼み方なんて、わからない。だから、あと一歩だけを頼もう。",
"node_7_5_pre_002": "もし祭壇が、名前を求めてきたら？",
"node_7_5_pre_004": "だめ。五人とも、自分の名前を持って帰るの。それ以外の答えは、受け入れないわ。",
"node_7_5_phase1_002": "なら、生きている人に払わせるのはやめなさい！",
"node_7_5_phase2_003": "ここにいるわ。一緒に、終わらせて。",
"node_7_5_post_002": "……終わったのね。",
"node_7_5_post_004": "少し疲れただけ。お願い、マフムト。ここでは、やめて。",
"node_7_5_post_005": "闇が、心臓まで届いた。もう、長くは待たせられない。",
"ch7_road_001": "きれいね。それが、いちばん残酷なところ。",
"ch7_road_003": "チーズ付きでね。",
"ch7_road_005": "彼は、あの機械が呪いだと思っている。明日、それはペンを握る手にすぎないと知ることになる。",
"confession_002": "笑っていれば……呪いのほうが、順番を待ってくれると思ったの。",
"confession_004": "わかってる。……あなたが救おうとしているだけの人で、いたくなかったの。",
"confession_006": "なら、ひとつだけ、わがままを言わせて。私が眠るまで、そばにいて。",
"confession_008": "まだ分かってないのね。私は死ぬの、マフムト。呪いが、私の時間をひとつずつ奪っていくの。",
"confession_010": "あなたが私を見て、残りわずかな時間を見てしまうのが……怖かったの。",
"confession_012": "あなたは知らなかった。だから私は、ふりを続けられたの。",
"confession_015": "知ってる。大聖堂で、聞こえていたの。私たち、二人ともふりをしていたのね、マフムト。……一緒に、やめましょう。",
"ending_fadyme_003": "……叔父様。",
"ending_fadyme_001": "死んだはずじゃ……。",
"ending_fadyme_002": "マフムト。今夜は、答えないで。",
# companion stories
"cs_fadyme_1_002": "見ているじゃない。",
"cs_fadyme_1_004": "『そのあと』のためのもの。それより前に、彼が読むことは許されないの。",
"cs_fadyme_1_006": "お母様は、祈りを余白に書いた。私は謝罪を書く。散らかすところまで、私たちはそっくり。",
"cs_fadyme_1_007": "クレム。私がどこに置いたか忘れたら、教えて。もし、あなたのことを忘れたら……許して。",
"cs_fadyme_2_001": "王冠に借金でもあるみたいに、チーズを切るのね。",
"cs_fadyme_2_003": "要らないバックルと、要らないチーズを交換したのね。この六年で、いちばんいい買い物よ。",
"cs_fadyme_2_005": "笑ってもいいのよ。どこかに書いておいて。今日の私は、封印でも世継ぎでもなかった。チーズを持った、ただの女だった。",
"cs_fadyme_2_007": "彼は本気で言っている。だから、言わなかった——私の代わりに覚えていて、とは。",
"cs_nixie_vale_1_004": "なら、それを描いた人は、人が静かに消えることを望んでいたのね。",
"cs_nixie_vale_3_004": "大聖堂のお説教より、ずっといいお説教ね。",
"cs_sister_aveline_1_002": "二度、数えましたね。",
"cs_sister_aveline_1_004": "もし、数が足りなかったら？",
"cs_sister_aveline_4_001": "寝ずの番ですか。まだ死んでいませんよ、シスター。",
"cs_sister_aveline_4_003": "あなたの教会は、私のような女性七人に……感謝を捧げたのですね。",
"cs_sister_aveline_4_005": "もし、ずっと言わなかったら？",
"cs_tilda_fen_1_004": "小さな切り傷です。",
"cs_tilda_fen_1_006": "どうか、書き留めないでください。",
"cs_tilda_fen_3_003": "……伝えたんですね。",
"cs_tilda_fen_3_005": "そして私は、自分の日々を、扉を守ることに使ってしまった。",
"cs_rikka_ember_4_002": "静かね。私、死ぬのが早まってる？",
"cs_rikka_ember_4_004": "それは、なに？",
"cs_mirel_quill_1_002": "練習、ですか？",
"cs_mirel_quill_1_004": "その書き方に、見覚えがあるんですね。",
"cs_odelia_pike_3_002": "あの人が歩いた道を、あなたは歩き続けているんですね。",
"cs_odelia_pike_3_004": "あるいは、どうして自分が歩き続けたのかが、わかるかもしれません。",
"cs_pippa_bell_2_002": "止まった鐘？",
"cs_pippa_bell_2_004": "沈黙した鐘。最初に止まったのはあれだと、お母様は言っていた。",
"cs_pippa_bell_2_005": "大事に持っていて。いつか、返してほしいと言う人が現れるかもしれないから。",
"cs_pippa_bell_3_004": "それとも、誰かに気づいたみたいに。",
"cs_pippa_bell_4_002": "韻を踏ませたのね。",
"cs_pippa_bell_4_004": "もう一度歌って。紙よりも大きな声で。",
"cs_nara_vell_1_002": "門と、ご自分を比べるんですか？",
"cs_nara_vell_1_004": "私の尺度は、どうですか？",
"cs_clem_marr_1_002": "楽しんでいるのね。",
"cs_clem_marr_1_004": "なら、今日はひとつ親切にして。あの部屋で聞くことは、忘れて。",
"cs_clem_marr_2_002": "ありがとう。",
"cs_clem_marr_2_004": "いつ話すかを、私に選ばせてほしいの。",
"cs_vespera_wisp_2_002": "ご自分の時間を、差し出したんですか。",
"cs_vespera_wisp_2_004": "後悔していますか？",
"cs_vespera_wisp_3_002": "……あれは、私のものでした。",
"cs_vespera_wisp_3_004": "止めることは、できますか？",
"cs_vespera_wisp_3_006": "……今は、まだ。",
"cs_hana_birch_2_001": "私の腕、ずいぶん丁寧に見ないようにしているのね。",
"cs_hana_birch_2_003": "重い約束よね。あなたに背負わせてしまって、ごめんなさい。",
"cs_hana_birch_4_002": "ええ、もういいのよ。",
"cs_hana_birch_4_004": "どちらも、本当ね。",
"cs_thistle_roe_2_002": "お願い。それが何を意味するのか、彼には言わないで。",
"cs_thistle_roe_2_004": "それなら、公平ね。",
"cs_thistle_roe_4_002": "私は、春を見られないかもしれないのよ、シスル。",
"cs_thistle_roe_4_004": "なら、彼が毎日通る場所に植えるわ。",
"cs_iona_mist_1_002": "死者も、来るんですか？",
"cs_iona_mist_1_004": "もしそうなったら、私の名前も読んでくれますか？",
"cs_iona_mist_4_002": "毎晩だなんて、長い約束ですね。",
"cs_iona_mist_4_004": "では、お受けします。きれいに発音してくださいね。",
"cs_marek_vane_4_001": "旗を掲げないんですね。",
"cs_marek_vane_4_003": "では、次はどこへ向かうんですか？",
# events
"event_harvest_inn_meal_2_002": "気前がいいんですね。",
"event_harvest_inn_meal_3_003": "こんなに騒がしい広場じゃ、鐘も数えきれない。今夜だけは、鐘の負けね。",
# battle / menu VO
"vo_fadyme_first_meeting": "ファディメ。今は、ただのファディメよ。残りの名前は、見た目よりずっと重いの。",
"vo_fadyme_team_join": "私は、彼のすぐ後ろにいるわ。誰かが、そうしなくちゃ。",
"vo_fadyme_idle": "じっとしていると、この国じゅうの鐘が聞こえてしまうの。……ねえ、話しかけて。",
"vo_fadyme_basic_attack": "棘よ。",
"vo_fadyme_active_skill": "この刻を、借りるわ。",
"vo_fadyme_ultimate": "聴いて——鐘は、忘れる！",
"vo_fadyme_victory": "みんなで帰れる。私が数える勝利は、それだけよ。",
"vo_fadyme_defeat": "私は……平気……",
"vo_fadyme_low_hp": "……私は、まったく平気よ。",
"vo_fadyme_relationship_1": "あの人、王冠に借金でもあるみたいにチーズを切るの。",
"vo_fadyme_relationship_2": "クレムは、名簿に私の名前を残してくれている。いいインクだといいけれど。",
}
# Reading hints fed to TTS only (the script keeps the kanji)
TTS = {
"vo_fadyme_active_skill": "このときを、借りるわ。",
"vo_fadyme_basic_attack": "とげよ。",
"node_3_5_post_004": "シー、ヴィー……お父様の最後のページで、あの文字を見た。",
"node_3_3_post_003": "自分の血を、彼のこてで拭ってしまった。しずくの数を、数えさせてはいけない。",
"node_1_2_pre_003": "はりを支える手が三つ、死者に向ける剣がみふり。両方こなせるわ。",
"node_3_3_post_002": "なら、やっと敵があなたにひとたち浴びせたのね。",
"node_1_1_pre_003": "あの鐘には、ぜつがない。なのに、どうしてまだ聞こえるの？",
"node_1_5_pre_003": "あごが開いたら、鐘のぜつを狙って。好機は一度きりよ。",
}
NOTES = {
"node_3_1_post_004": "Data: speaker fadyme_thought but voice_track 'jp'; recorded as inner voice. Content fixed to jp_inner (2026-09-30).",
"node_7_3_pre_007": "Data: speaker fadyme_thought but voice_track 'jp'; recorded as inner voice. Content fixed to jp_inner (2026-09-30). 'Be witnessed' = be seen and recorded, not act as a witness.",
"cs_pippa_bell_4_002": "Depends on Pippa's JP rewrite of 'Veyr rhymes with stayed here' (AUDIO_VO_PLAN §2.5 rule 2): her line must rhyme ヴェア in Japanese.",
"cs_pippa_bell_4_004": "Echoes Pippa's 3-4 line 'I will sing louder than the paper'; keep the same JP words (紙より大きな声) in her line.",
"node_1_1_pre_003": "鐘の舌 = bell clapper (ぜつ). TTS reads it from the hint.",
"vo_fadyme_active_skill": "刻 read とき (glossary: 借りた刻).",
"vo_fadyme_relationship_2": "名簿, not 帳面: keeps 帳 free for the Veil element (glossary).",
"ch1_camp_006": "The Bell-Widow = 鐘の未亡人 (new glossary entry).",
"opening_004": "'I am perfectly fine' mask line: same JP words every time (まったく平気), delivery changes.",
"node_1_5_post_004": "'I am perfectly fine' mask line.",
"vo_fadyme_low_hp": "'I am perfectly fine' mask line.",
}
POLITE = "Fadyme speaks politely (です/ます) to new or older acquaintances and NPCs; soft casual (〜わ/〜の/〜ね) with Mahmut and party companions."

def walk(o, f, ctx, out):
    if isinstance(o, dict):
        c = dict(ctx)
        for k in ("scene_id", "story_id", "event_id"):
            if isinstance(o.get(k), str): c["group"] = o[k]; c["location_id"] = o.get("location_id", c.get("location_id"))
        sp = o.get("speaker_id")
        if isinstance(sp, str) and sp.startswith("fadyme") and "text_en" in o:
            out.append(dict(line_id=o["line_id"], source=f"content/{f}", group=c.get("group"), location_id=c.get("location_id"),
                            speaker_id=sp, voice_track=o.get("voice_track"), emotion=o.get("emotion"), en=o["text_en"]))
        for v in o.values(): walk(v, f, c, out)
    elif isinstance(o, list):
        for v in o: walk(v, f, ctx, out)

lines = []
files = sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "content", "story_script_ch0*.json")))
files += ["character_stories_part1.json", "events_part1.json"]
for f in files:
    walk(json.load(open(os.path.join(ROOT, "content", f), encoding="utf-8")), f, {}, lines)
vo = json.load(open(os.path.join(ROOT, "content", "character_voice_lines_part1.json"), encoding="utf-8"))["characters"]
fv = vo["fadyme"] if isinstance(vo, dict) else next(c for c in vo if c.get("character_id") == "fadyme")
for l in fv["lines"]:
    g = "vo_battle" if l["trigger"] in ("basic_attack", "active_skill", "ultimate", "victory", "defeat", "low_hp") else "vo_menu"
    lines.append(dict(line_id=l["line_id"], source="content/character_voice_lines_part1.json", group=g, location_id=None,
                      speaker_id="fadyme", voice_track=l.get("voice_track", "jp"), emotion=l["trigger"], en=l["text_en"]))
missing = [l["line_id"] for l in lines if l["line_id"] not in JA]
extra = sorted(set(JA) - {l["line_id"] for l in lines})
assert not missing and not extra, (missing, extra)
for l in lines:
    l["ja"] = JA[l["line_id"]]
    l["inner"] = l["speaker_id"] == "fadyme_thought"
    if l["line_id"] in TTS: l["tts_text"] = TTS[l["line_id"]]
    if l["line_id"] in NOTES: l["notes"] = NOTES[l["line_id"]]
    l["audio_file"] = f"audio/voice/fadyme/{l['speaker_id']}/{l['line_id']}.ogg"
doc = dict(schema="jp_script v1", character_id="fadyme", voice="Sulafat (gemini-3.8-flash-tts), casting.json",
           status="DRAFT — Narrative & Visual Director; native JP editor review pending",
           register=POLITE, engine_path_rule="core/localization.py resolves voice/{speaker_id}/{line_id}.ogg",
           count=len(lines), lines=lines)
p = os.path.join(ROOT, "audio", "voice", "jp_script_fadyme.json")
json.dump(doc, open(p, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("lines", len(lines), "inner", sum(l["inner"] for l in lines), "groups", len({l["group"] for l in lines}))
