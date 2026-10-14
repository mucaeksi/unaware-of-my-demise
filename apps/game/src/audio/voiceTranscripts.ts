/**
 * R16 Reviewed Japanese Voice Transcript, Canonical Name-Reading, Casting & Subtitle Cue Registry.
 * Prevents feeding untranslated English prose into a Japanese voice model and binds stable `line_id`s
 * to reviewed Japanese scripts, kana readings, English subtitles, and BGM ducking envelopes.
 */

export interface VoiceCastProfile {
  speakerId: string;
  nameEn: string;
  nameJa: string;
  readingKana: string;
  voiceArchetype: string;
  recommendedVoiceId: string;
  pitchSemitones: number;
  speakingRate: number;
}

export interface ReviewedJaVoiceLine {
  lineId: string;
  speakerId: string;
  transcriptJa: string;
  readingKana: string;
  subtitleEn: string;
  durationSeconds: number;
  duckRatio: number;
}

export const CANON_JA_CAST: Record<string, VoiceCastProfile> = {
  narrator: {
    speakerId: 'narrator',
    nameEn: 'Narrator',
    nameJa: '語り手',
    readingKana: 'カタリテ',
    voiceArchetype: 'measured, solemn chronicle narrator',
    recommendedVoiceId: 'ja-JP-Chirp3-HD-Charon',
    pitchSemitones: -1.5,
    speakingRate: 0.94
  },
  mahmut: {
    speakerId: 'mahmut',
    nameEn: 'Mahmut',
    nameJa: 'マフムト',
    readingKana: 'マフムト',
    voiceArchetype: 'weary, grounded vanguard captain, dry warmth',
    recommendedVoiceId: 'ja-JP-Chirp3-HD-Orus',
    pitchSemitones: -1.0,
    speakingRate: 0.96
  },
  fadyme: {
    speakerId: 'fadyme',
    nameEn: 'Fadyme',
    nameJa: 'ファディメ',
    readingKana: 'ファディメ',
    voiceArchetype: 'composed lantern-keeper, quiet resolve',
    recommendedVoiceId: 'ja-JP-Chirp3-HD-Aoede',
    pitchSemitones: 0.0,
    speakingRate: 0.95
  },
  aveline: {
    speakerId: 'aveline',
    nameEn: 'Aveline',
    nameJa: 'アヴェリン',
    readingKana: 'アヴェリン',
    voiceArchetype: 'steadfast oath-bound sentinel',
    recommendedVoiceId: 'ja-JP-Chirp3-HD-Kore',
    pitchSemitones: -0.5,
    speakingRate: 0.95
  },
  ywain: {
    speakerId: 'ywain',
    nameEn: 'Ywain',
    nameJa: 'イウェイン',
    readingKana: 'イウェイン',
    voiceArchetype: 'Austere scholar-tactician',
    recommendedVoiceId: 'ja-JP-Chirp3-HD-Fenrir',
    pitchSemitones: -0.8,
    speakingRate: 0.97
  },
  isolde: {
    speakerId: 'isolde',
    nameEn: 'Isolde',
    nameJa: 'イゾルデ',
    readingKana: 'イゾルデ',
    voiceArchetype: 'melancholic reliquary cantor',
    recommendedVoiceId: 'ja-JP-Chirp3-HD-Leda',
    pitchSemitones: 0.5,
    speakingRate: 0.92
  }
};

export const CANON_JA_TERM_READINGS: Record<string, { ja: string; readingKana: string }> = {
  "Bell's Remains": { ja: '鐘の遺響', readingKana: 'カネノイキョウ' },
  'Whispering Ash': { ja: '囁く灰の森', readingKana: 'ササヤクハイノモリ' },
  'Bound Chronicle': { ja: '綴じられた年代記', readingKana: 'トジラレタネンダイキ' },
  'Memory Shard': { ja: '記憶の欠片', readingKana: 'キオクノカケラ' }
};

export const REVIEWED_JA_VOICE_LINES: Record<string, ReviewedJaVoiceLine> = {
  pro_01: {
    lineId: 'pro_01',
    speakerId: 'narrator',
    transcriptJa: '鐘が一度鳴ったとき、誰も自分がすでに死んでいるとは知らなかった。',
    readingKana: 'カネガイチドナッタトキ、ダレモジブンガスデニシンデイルトハシラナカッタ。',
    subtitleEn: 'When the bell struck once, none of us knew we were already dead.',
    durationSeconds: 5.2,
    duckRatio: 0.25
  },
  pro_02: {
    lineId: 'pro_02',
    speakerId: 'fadyme',
    transcriptJa: 'マフムト、灯りを下げないで。灰の霧が足元まで満ちているわ。',
    readingKana: 'マフムト、アカリヲサゲナイデ。ハイノキリガアシモトマデミチテイルワ。',
    subtitleEn: 'Mahmut, do not lower the lantern. The ash fog has risen to our boots.',
    durationSeconds: 4.8,
    duckRatio: 0.25
  },
  pro_03: {
    lineId: 'pro_03',
    speakerId: 'mahmut',
    transcriptJa: 'ファディメ、まだ息はできる。道が消える前に先へ進もう。',
    readingKana: 'ファディメ、マダイキハデキル。ミチガキエルマエニサキヘススモウ。',
    subtitleEn: 'Fadyme, we can still breathe. Let us press on before the road vanishes.',
    durationSeconds: 4.5,
    duckRatio: 0.25
  },
  t1_intro_01: {
    lineId: 't1_intro_01',
    speakerId: 'mahmut',
    transcriptJa: '前衛は俺が受け持つ。ファディメ、後ろから合図してくれ。',
    readingKana: 'ゼンエイハオレガウケモツ。ファディメ、ウシロカラアイズシテクレ。',
    subtitleEn: 'I will hold the vanguard. Fadyme, call the opening from the rear.',
    durationSeconds: 4.2,
    duckRatio: 0.25
  },
  t2_intro_01: {
    lineId: 't2_intro_01',
    speakerId: 'fadyme',
    transcriptJa: '鐘の遺響が共鳴している……集中すれば、一撃で崩せるはずよ。',
    readingKana: 'カネノイキョウガキョウメイシテイル……シュウチュウスレバ、イチゲキデクズセルハズヨ。',
    subtitleEn: "The Bell's Remains are resonating... Focus our strike to break their line.",
    durationSeconds: 4.9,
    duckRatio: 0.25
  },
  t3_intro_01: {
    lineId: 't3_intro_01',
    speakerId: 'mahmut',
    transcriptJa: 'これが最後の関門だ。全員、陣形を崩すな！',
    readingKana: 'コレガサイゴノカンモンダ。ゼンイン、ジンケイヲクズスナ！',
    subtitleEn: 'This is the final barrier. Hold formation, everyone!',
    durationSeconds: 3.9,
    duckRatio: 0.25
  }
};

const JA_SCRIPT_REGEX = /[\u3040-\u309f\u30a0-\u30ff\u3400-\u9fff]/;
const LATIN_WORD_REGEX = /\b[A-Za-z]{3,}\b/;

/**
 * Validates a Japanese voice line before synthesis or runtime packaging:
 * - Rejects untranslated English dialogue (`LATIN_WORD_REGEX` in `transcriptJa` or missing Japanese script).
 * - Verifies that known speaker IDs exist in `CANON_JA_CAST`.
 * - Verifies that any canonical character name mentioned in `subtitleEn` uses its canonical katakana reading in `transcriptJa`.
 */
export function validateJaVoiceLine(line: ReviewedJaVoiceLine): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(line.lineId)) {
    errors.push(`invalid lineId "${line.lineId}"`);
  }
  if (!CANON_JA_CAST[line.speakerId]) {
    errors.push(`unknown speakerId "${line.speakerId}" (not in CANON_JA_CAST)`);
  }
  if (!JA_SCRIPT_REGEX.test(line.transcriptJa)) {
    errors.push('transcriptJa must contain Japanese script (Hiragana, Katakana, or Kanji)');
  }
  if (LATIN_WORD_REGEX.test(line.transcriptJa)) {
    errors.push('transcriptJa contains Latin/English words; never feed English dialogue into a Japanese voice');
  }
  if (!line.subtitleEn.trim()) {
    errors.push('subtitleEn must not be empty');
  }
  if (!(line.durationSeconds > 0.2 && line.durationSeconds <= 30)) {
    errors.push(`durationSeconds (${line.durationSeconds}) must be in (0.2, 30]`);
  }

  for (const profile of Object.values(CANON_JA_CAST)) {
    if (profile.speakerId === 'narrator') continue;
    if (line.subtitleEn.includes(profile.nameEn) && !line.transcriptJa.includes(profile.nameJa)) {
      errors.push(`subtitle mentions "${profile.nameEn}" but transcriptJa is missing canonical reading "${profile.nameJa}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function resolveVoiceCueAndSubtitle(
  lineId: string,
  localeStrings?: Record<string, string>
): {
  lineId: string;
  subtitleEn: string;
  transcriptJa: string | null;
  cast: VoiceCastProfile | null;
  duckRatio: number;
} {
  const reviewed = REVIEWED_JA_VOICE_LINES[lineId];
  const localized = localeStrings && Object.hasOwn(localeStrings, lineId) ? localeStrings[lineId]! : undefined;
  if (!reviewed) {
    return {
      lineId,
      subtitleEn: localized ?? '',
      transcriptJa: null,
      cast: null,
      duckRatio: 0.25
    };
  }
  return {
    lineId,
    subtitleEn: localized ?? reviewed.subtitleEn,
    transcriptJa: reviewed.transcriptJa,
    cast: CANON_JA_CAST[reviewed.speakerId] ?? null,
    duckRatio: reviewed.duckRatio
  };
}
