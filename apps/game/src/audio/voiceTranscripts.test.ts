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

  it('resolves subtitle, Japanese transcript, cast profile, and duck ratio by stable lineId', () => {
    const cue = resolveVoiceCueAndSubtitle('pro_02');
    expect(cue.cast?.nameJa).toBe(CANON_JA_CAST.fadyme?.nameJa);
    expect(cue.transcriptJa).toContain('マフムト');
    expect(cue.subtitleEn).toContain('Mahmut');
    expect(cue.duckRatio).toBe(0.25);
  });
});
