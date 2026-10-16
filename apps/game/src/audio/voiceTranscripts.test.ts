import { describe, expect, it } from 'vitest';
import {
  CANON_JA_CAST,
  REVIEWED_JA_VOICE_LINES,
  resolveVoiceCueAndSubtitle,
  validateJaVoiceLine
} from './voiceTranscripts';

describe('R16 Japanese voice transcript, name reading, and subtitle cue binding', () => {
  it('validates all reviewed Japanese voice lines and canonical character readings', () => {
    const entries = Object.values(REVIEWED_JA_VOICE_LINES);
    expect(entries.length).toBeGreaterThanOrEqual(6);
    for (const line of entries) {
      const res = validateJaVoiceLine(line);
      expect(res).toEqual({ valid: true, errors: [] });
    }
  });

  it('rejects feeding English dialogue into a Japanese voice or omitting canonical katakana name readings', () => {
    const englishFed = validateJaVoiceLine({
      lineId: 'bad_en_01',
      speakerId: 'mahmut',
      transcriptJa: 'Hold the line Fadyme!',
      readingKana: '',
      subtitleEn: 'Hold the line, Fadyme!',
      durationSeconds: 3.0,
      duckRatio: 0.25
    });
    expect(englishFed.valid).toBe(false);
    expect(englishFed.errors.some((e) => e.includes('never feed English dialogue'))).toBe(true);

    const wrongNameReading = validateJaVoiceLine({
      lineId: 'bad_name_01',
      speakerId: 'mahmut',
      transcriptJa: 'ファディマ、前へ出ろ。',
      readingKana: 'ファディマ、マエヘデロ。',
      subtitleEn: 'Fadyme, step forward.',
      durationSeconds: 2.5,
      duckRatio: 0.25
    });
    expect(wrongNameReading.valid).toBe(false);
    expect(wrongNameReading.errors.some((e) => e.includes('ファディメ'))).toBe(true);
  });

  it('locks canonical Japanese voice casting to Algieba (Narrator), Sulafat (Fadyme), and Iapetus (Mahmut)', () => {
    expect(CANON_JA_CAST.narrator?.geminiVoiceName).toBe('Algieba');
    expect(CANON_JA_CAST.narrator?.recommendedVoiceId).toBe('ja-JP-Chirp3-HD-Algieba');
    expect(CANON_JA_CAST.fadyme?.geminiVoiceName).toBe('Sulafat');
    expect(CANON_JA_CAST.fadyme?.recommendedVoiceId).toBe('ja-JP-Chirp3-HD-Sulafat');
    expect(CANON_JA_CAST.mahmut?.geminiVoiceName).toBe('Iapetus');
    expect(CANON_JA_CAST.mahmut?.recommendedVoiceId).toBe('ja-JP-Chirp3-HD-Iapetus');
  });

  it('validates all 116 vertical-slice lines have non-robotic acting prompts, timing cues, and SSML/Gemini-3.8 tags', () => {
    const entries = Object.values(REVIEWED_JA_VOICE_LINES);
    expect(entries.length).toBe(122);
    const sliceLines = entries.filter((e) => e.lineId.startsWith('entry_past_') || e.lineId.startsWith('tutorial_t'));
    expect(sliceLines.length).toBe(116);
    for (const line of sliceLines) {
      expect(CANON_JA_CAST[line.speakerId]?.geminiVoiceName).toBeDefined();
      expect(line.whenCue?.length).toBeGreaterThan(10);
      expect(line.emotion?.length).toBeGreaterThan(2);
      expect(line.actingStyle?.length).toBeGreaterThan(20);
      expect(line.ttsTextGemini38?.length).toBeGreaterThan(4);
      expect(line.ssmlChirp3).toContain('<speak>');
      expect(line.ssmlChirp3).toContain('<prosody');
    }
  });

  it('resolves subtitle, Japanese transcript, cast profile, and duck ratio by stable lineId', () => {
    const cue = resolveVoiceCueAndSubtitle('pro_02');
    expect(cue.cast?.nameJa).toBe(CANON_JA_CAST.fadyme?.nameJa);
    expect(cue.transcriptJa).toContain('マフムト');
    expect(cue.subtitleEn).toContain('Mahmut');
    expect(cue.duckRatio).toBe(0.25);

    const sliceCue = resolveVoiceCueAndSubtitle('tutorial_t1_before_007');
    expect(sliceCue.cast?.geminiVoiceName).toBe('Sulafat');
    expect(sliceCue.actingStyle?.length).toBeGreaterThan(20);
    expect(sliceCue.ssmlChirp3).toContain('<speak>');
  });
});

