import { describe, expect, it } from 'vitest';
import { buildSubtitleSchedule, resolveSubtitleProgress } from './subtitles';

describe('subtitle voice-sync scheduler', () => {
  it('calibrates subtitle reveal duration to voiceover duration and weights punctuation pauses', () => {
    const text = '“If I slip here, it will be a poor beginning.”';
    const schedule = buildSubtitleSchedule(text, 4.2, 26);

    expect(schedule.charTimesMs).toHaveLength(text.length);
    expect(schedule.voiceDurationMs).toBe(4200);
    // Total reveal spans roughly 88% of the voice duration
    expect(schedule.totalRevealMs).toBeGreaterThan(3400);
    expect(schedule.totalRevealMs).toBeLessThan(4000);

    // Comma at index 15 should introduce a noticeably longer pause than an ordinary letter
    const commaIdx = text.indexOf(',');
    const commaPauseMs = schedule.charTimesMs[commaIdx]! - schedule.charTimesMs[commaIdx - 1]!;
    const letterPauseMs = schedule.charTimesMs[5]! - schedule.charTimesMs[4]!;
    expect(commaPauseMs).toBeGreaterThan(letterPauseMs * 3);
  });

  it('resolves progressive character counts and blends live audio progress', () => {
    const text = '— Every town kept its own hours.';
    const schedule = buildSubtitleSchedule(text, 3.6, 26);

    const start = resolveSubtitleProgress(schedule, 0);
    expect(start.count).toBe(0);
    expect(start.done).toBe(false);

    const mid = resolveSubtitleProgress(schedule, 1600, 1.65);
    expect(mid.count).toBeGreaterThan(8);
    expect(mid.count).toBeLessThan(text.length);
    expect(mid.done).toBe(false);

    const end = resolveSubtitleProgress(schedule, schedule.totalRevealMs + 50, 3.6);
    expect(end.count).toBe(text.length);
    expect(end.revealRatio).toBe(1);
    expect(end.done).toBe(true);
  });
});
