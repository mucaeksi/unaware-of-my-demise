import { prefs } from '../platform/prefs';

export interface UltimatePhrase {
  /** Japanese Kanji/Kana callout displayed in dramatic anime typography */
  jp: string;
  /** Romaji pronunciation */
  romaji: string;
  /** English poetic translation subtitle */
  en: string;
}

export interface UltimateChantSpec {
  /** 3 sequential incantation beats: [0] Cast Charge, [1] Cut-In Transition, [2] Final Impact Release */
  phrases: readonly [UltimatePhrase, UltimatePhrase, UltimatePhrase];
  /** Optional dedicated Japanese voiceover audio path relative to content root */
  voiceFile?: string;
}

/**
 * Canonical 3-Phrase Japanese Ultimate Incantations for all 25 playable characters and bosses across the game.
 * Every Ultimate executes in 3 dramatic beats:
 *  Beat 1 (Cast Charge): Sacred sigil & aura gather around the caster with Phrase 1.
 *  Beat 2 (Cut-In Transition): Diagonal portrait cut-in & speedlines slash across the stage with Phrase 2.
 *  Beat 3 (Final Release): Full-stage elemental eruption & impact with Phrase 3.
 */
const CHANTS: Readonly<Record<string, UltimateChantSpec>> = {
  mahmut: {
    voiceFile: 'audio/voices/ult_mahmut.ogg',
    phrases: [
      { jp: '「灰の誓いよ…」', romaji: 'Hai no chikai yo…', en: 'By the vow of ash…' },
      { jp: '「砕けぬ盾となれ！」', romaji: 'Kudakenu tate to nare!', en: 'Become an unbreakable shield!' },
      { jp: '「宵の最終防壁！」', romaji: 'Yoi no Saishū Bōheki!', en: 'Last Wall at Dusk!' }
    ]
  },
  fadyme: {
    voiceFile: 'audio/voices/ult_fadyme.ogg',
    phrases: [
      { jp: '「名もなき鐘よ…」', romaji: 'Na mo naki kane yo…', en: 'O nameless sanctuary bell…' },
      { jp: '「静寂の帳を裂け！」', romaji: 'Seijaku no tobari wo sake!', en: 'Rend the veil of silence!' },
      { jp: '「届かぬ鐘声！」', romaji: 'Todokanu Shōsei!', en: 'Unheard Peal!' }
    ]
  },
  kera_voss: {
    voiceFile: 'audio/voices/ult_kera_voss.ogg',
    phrases: [
      { jp: '「紅蓮の焔よ…」', romaji: 'Guren no homura yo…', en: 'O crimson alchemical flame…' },
      { jp: '「灰燼へと還れ！」', romaji: 'Kaijin e to kaere!', en: 'Return all to cinders!' },
      { jp: '「緋色の坩堝！」', romaji: 'Hiiro no Rutsubo!', en: 'Crimson Crucible!' }
    ]
  },
  brin_alder: {
    phrases: [
      { jp: '「古き岩盤よ…」', romaji: 'Furuki ganban yo…', en: 'O ancient bedrock…' },
      { jp: '「一歩も通さぬ！」', romaji: 'Ippo mo tōsanu!', en: 'None shall pass this line!' },
      { jp: '「不落の石塁！」', romaji: 'Furaku no Sekirui!', en: 'Unconquered Rampart!' }
    ]
  },
  nixie_vale: {
    phrases: [
      { jp: '「疾風の羽根よ…」', romaji: 'Shippū no hane yo…', en: 'O feathers of the gale…' },
      { jp: '「霧の彼方を射抜け！」', romaji: 'Kiri no kanata wo inuke!', en: 'Pierce beyond the mist!' },
      { jp: '「翠嵐の絶矢！」', romaji: 'Suiran no Zesshi!', en: 'Tempest Arrow!' }
    ]
  },
  sister_aveline: {
    phrases: [
      { jp: '「暁の聖堂よ…」', romaji: 'Akatsuki no seidō yo…', en: 'O cathedral of dawn…' },
      { jp: '「迷える魂を照らせ！」', romaji: 'Mayoeru tamashii wo terase!', en: 'Illumine the wandering souls!' },
      { jp: '「黎明の聖唱！」', romaji: 'Reimei no Seishō!', en: 'Sanctus of Dawn!' }
    ]
  },
  sable_wren: {
    phrases: [
      { jp: '「宵闇の影よ…」', romaji: 'Yoiyami no kage yo…', en: 'O shadow of twilight…' },
      { jp: '「音もなく断ち切れ！」', romaji: 'Oto mo naku tachikire!', en: 'Sever without a sound!' },
      { jp: '「無音の黒刃！」', romaji: 'Muon no Kokujin!', en: 'Silent Nightblade!' }
    ]
  },
  tilda_fen: {
    phrases: [
      { jp: '「深淵の潮よ…」', romaji: 'Shin’en no ushio yo…', en: 'O tide of the abyss…' },
      { jp: '「傷跡を洗い流せ！」', romaji: 'Kizuato wo arainagase!', en: 'Wash away every wound!' },
      { jp: '「蒼海の祈り！」', romaji: 'Sōkai no Inori!', en: 'Benediction of the Deep!' }
    ]
  },
  rikka_ember: {
    phrases: [
      { jp: '「燃え盛る拳よ…」', romaji: 'Moesakaru kobushi yo…', en: 'O blazing iron fist…' },
      { jp: '「闇を撃ち砕け！」', romaji: 'Yami wo uchikudake!', en: 'Shatter the darkness!' },
      { jp: '「業火の烈撃！」', romaji: 'Gōka no Retsugeki!', en: 'Hellfire Impact!' }
    ]
  },
  mirel_quill: {
    phrases: [
      { jp: '「黄金の碑文よ…」', romaji: 'Ōgon no hibun yo…', en: 'O golden inscription…' },
      { jp: '「真実の名を刻め！」', romaji: 'Shinjitsu no na wo kizame!', en: 'Carve the true name!' },
      { jp: '「不滅の聖典！」', romaji: 'Fumetsu no Seiten!', en: 'Immortal Chronicle!' }
    ]
  },
  odelia_pike: {
    phrases: [
      { jp: '「凍てつく波濤よ…」', romaji: 'Itetsuku hatō yo…', en: 'O freezing surge…' },
      { jp: '「獲物の足を縫い止めよ！」', romaji: 'Emono no ashi wo nuitomeyo!', en: 'Pin the quarry in place!' },
      { jp: '「氷海の穿槍！」', romaji: 'Hyōkai no Sensō!', en: 'Abyssal Lance!' }
    ]
  },
  pippa_bell: {
    phrases: [
      { jp: '「風鳴りの鈴よ…」', romaji: 'Kazanari no suzu yo…', en: 'O wind-chime bell…' },
      { jp: '「旅路の歌を響かせよ！」', romaji: 'Tabiji no uta wo hibikaseyo!', en: 'Resound the song of the road!' },
      { jp: '「春風の輪舞曲！」', romaji: 'Harukaze no Rondo!', en: 'Gale Rondo!' }
    ]
  },
  nara_vell: {
    phrases: [
      { jp: '「大地の礎よ…」', romaji: 'Daichi no ishizue yo…', en: 'O foundation of the earth…' },
      { jp: '「我らが盟約を守れ！」', romaji: 'Warera ga meiyaku wo mamore!', en: 'Guard our sacred covenant!' },
      { jp: '「金剛の守護陣！」', romaji: 'Kongō no Shugojin!', en: 'Adamant Bastion!' }
    ]
  },
  clem_marr: {
    phrases: [
      { jp: '「忘却の霧よ…」', romaji: 'Bōkyaku no kiri yo…', en: 'O mist of oblivion…' },
      { jp: '「その力を蝕め！」', romaji: 'Sono chikara wo mushibame!', en: 'Wither their strength!' },
      { jp: '「虚ろなる呪印！」', romaji: 'Utsuro naru Juin!', en: 'Hollow Curse!' }
    ]
  },
  vespera_wisp: {
    phrases: [
      { jp: '「星なき夜の帳よ…」', romaji: 'Hoshi naki yoru no tobari yo…', en: 'O starless night veil…' },
      { jp: '「虚空の光を解き放て！」', romaji: 'Kokū no hikari wo tokihanate!', en: 'Unleash the void light!' },
      { jp: '「冥夜の星墜ち！」', romaji: 'Meiya no Hoshiochi!', en: 'Astral Eclipse!' }
    ]
  },
  hana_birch: {
    phrases: [
      { jp: '「白樺の刃よ…」', romaji: 'Shirakaba no yaiba yo…', en: 'O blade of white birch…' },
      { jp: '「受けし痛みを倍にして返す！」', romaji: 'Ukeshi itami wo bai ni shite kaesu!', en: 'Return every strike twofold!' },
      { jp: '「報復の閃光！」', romaji: 'Hōfuku no Senkō!', en: 'Retribution Flash!' }
    ]
  },
  thistle_roe: {
    phrases: [
      { jp: '「荊棘の息吹よ…」', romaji: 'Keikyoku no ibuki yo…', en: 'O breath of wild briar…' },
      { jp: '「命の芽吹きを護れ！」', romaji: 'Inochi no mebuki wo mamore!', en: 'Shelter the nascent life!' },
      { jp: '「翠緑の聖域！」', romaji: 'Suiryoku no Seiiki!', en: 'Verdant Sanctuary!' }
    ]
  },
  iona_mist: {
    phrases: [
      { jp: '「朝霧の雫よ…」', romaji: 'Asagiri no shizuku yo…', en: 'O dewdrop of morning mist…' },
      { jp: '「凍える心を癒やせ！」', romaji: 'Kogoeru kokoro wo iyase!', en: 'Mend the frozen heart!' },
      { jp: '「静謐なる慈雨！」', romaji: 'Seihitsu naru Jiu!', en: 'Merciful Rain!' }
    ]
  },
  iona: {
    phrases: [
      { jp: '「朝霧の雫よ…」', romaji: 'Asagiri no shizuku yo…', en: 'O dewdrop of morning mist…' },
      { jp: '「凍える心を癒やせ！」', romaji: 'Kogoeru kokoro wo iyase!', en: 'Mend the frozen heart!' },
      { jp: '「静謐なる慈雨！」', romaji: 'Seihitsu naru Jiu!', en: 'Merciful Rain!' }
    ]
  },
  jori_flint: {
    phrases: [
      { jp: '「燧石の火花よ…」', romaji: 'Hiuchiishi no hibana yo…', en: 'O spark of flint…' },
      { jp: '「我が盾に宿れ！」', romaji: 'Waga tate ni yadore!', en: 'Kindle upon my shield!' },
      { jp: '「焔の防塁！」', romaji: 'Homura no Bōrui!', en: 'Ember Bulwark!' }
    ]
  },
  marek_vane: {
    phrases: [
      { jp: '「暴風の羅針よ…」', romaji: 'Bōfū no rashin yo…', en: 'O compass of the storm…' },
      { jp: '「戦場の理を統べよ！」', romaji: 'Senjō no kotowari wo subeyo!', en: 'Command the winds of war!' },
      { jp: '「蒼穹の覇風！」', romaji: 'Sōkyū no Hafū!', en: 'Sovereign Gale!' }
    ]
  },
  garrick_cinder: {
    phrases: [
      { jp: '「灰燼の巨槌よ…」', romaji: 'Kaijin no kyotsuchi yo…', en: 'O great hammer of cinders…' },
      { jp: '「城壁ごと粉砕せよ！」', romaji: 'Jōheki goto funsai seyo!', en: 'Crush rampart and bone alike!' },
      { jp: '「焦土の破城撃！」', romaji: 'Shōdo no Hajōgeki!', en: 'Scorched Earth Siege!' }
    ]
  },
  corbin_locke: {
    phrases: [
      { jp: '「荒海の黒銛よ…」', romaji: 'Araumi no kuromori yo…', en: 'O black harpoon of the tempest…' },
      { jp: '「深淵へと引きずり込め！」', romaji: 'Shin’en e to hikizurikome!', en: 'Drag them into the deep!' },
      { jp: '「渦潮の断罪！」', romaji: 'Uzushio no Danzai!', en: 'Maelstrom Judgment!' }
    ]
  },
  cassian_thorne: {
    phrases: [
      { jp: '「聖遺物の荊よ…」', romaji: 'Seiibutsu no ibara yo…', en: 'O thorns of the reliquary…' },
      { jp: '「背教の闇を貫け！」', romaji: 'Haikyō no yami wo tsuranuke!', en: 'Pierce the heretical dark!' },
      { jp: '「黄金の聖槍！」', romaji: 'Ōgon no Seisō!', en: 'Reliquary Lance!' }
    ]
  },
  dorian_kesk: {
    phrases: [
      { jp: '「暗号の鎖よ…」', romaji: 'Angō no kusari yo…', en: 'O chains of the cipher…' },
      { jp: '「運命の糸を絡め取れ！」', romaji: 'Unmei no ito wo karametore!', en: 'Bind the threads of fate!' },
      { jp: '「深淵の解読！」', romaji: 'Shin’en no Kaidoku!', en: 'Abyssal Cipher!' }
    ]
  },
  rowan_reed: {
    phrases: [
      { jp: '「灯火の祠よ…」', romaji: 'Tomoshibi no hokora yo…', en: 'O wayside shrine of light…' },
      { jp: '「旅人の歩みを護れ！」', romaji: 'Tabibito no ayumi wo mamore!', en: 'Bless the traveler’s step!' },
      { jp: '「暁光の祝詞！」', romaji: 'Gyōkō no Norito!', en: 'Dawn Benediction!' }
    ]
  }
};

export function getUltimateChant(unitId: string, element?: string, skillName?: string): UltimateChantSpec {
  const key = unitId.trim().toLowerCase();
  const known = CHANTS[key];
  if (known) return known;
  const elJp =
    element === 'Stone'
      ? '「大地の轟きよ…」'
      : element === 'Ember'
        ? '「紅蓮の劫火よ…」'
        : element === 'Tide'
          ? '「深淵の潮流よ…」'
          : element === 'Gale'
            ? '「蒼天の疾風よ…」'
            : element === 'Dawn'
              ? '「暁の聖光よ…」'
              : '「宵闇の鐘声よ…」';
  return {
    phrases: [
      { jp: elJp, romaji: 'Inishie no chikai yo…', en: 'By the ancient covenant…' },
      { jp: '「我が真名を刻め！」', romaji: 'Waga mana wo kizame!', en: 'Inscribe my true name!' },
      { jp: `「${(skillName ?? '極光の奥義').toUpperCase()}！」`, romaji: 'Kyokukō no Ōgi!', en: `${skillName ?? 'Final Reckoning'}!` }
    ]
  };
}

const MALE_UNITS = new Set([
  'mahmut',
  'brin_alder',
  'jori_flint',
  'marek_vane',
  'garrick_cinder',
  'corbin_locke',
  'cassian_thorne',
  'dorian_kesk',
  'clem_marr',
  'rowan_reed'
]);

/**
 * Speaks one of the 3 Japanese Ultimate chant phrases aloud using Japanese voice synthesis (`ja-JP`),
 * tuned to the character's vocal register (baritone vs. soprano/mezzo) and incantation beat intensity.
 */
export function speakUltimatePhrase(unitId: string, phrase: UltimatePhrase, beatIndex: 0 | 1 | 2): void {
  const vol = prefs().voiceVolume;
  if (vol <= 0 || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    const cleanText = phrase.jp.replace(/[「」『』…]/g, ' ').trim();
    if (!cleanText) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(cleanText);
    u.lang = 'ja-JP';
    u.volume = Math.min(1, Math.max(0.1, vol));
    const isMale = MALE_UNITS.has(unitId.trim().toLowerCase());
    u.pitch = isMale ? (beatIndex === 2 ? 0.85 : 0.76) : beatIndex === 2 ? 1.18 : 1.08;
    u.rate = beatIndex === 2 ? 1.15 : beatIndex === 1 ? 1.08 : 1.0;
    const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ja'));
    if (voices.length > 0) {
      const preferred = voices.find((v) =>
        isMale ? /ichiro|keita|otoya|male|takumi|daichi/i.test(v.name) : /haruka|ayumi|nanami|kyoko|female|sayaka|hikari/i.test(v.name)
      );
      u.voice = preferred ?? voices[0]!;
    }
    synth.speak(u);
  } catch {
    /* ignore speech synthesis errors on restricted WebViews */
  }
}
