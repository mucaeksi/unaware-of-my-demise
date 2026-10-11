import { describe, expect, it } from 'vitest';
import { segmentsAt, weekStart, windowOf } from './periods';

const t = (s: string): number => Date.parse(s);
describe('UTC periods', () => {
  it('12-hour windows start at 00:00 and 12:00 UTC', () => {
    expect(windowOf(t('2026-10-11T08:33:00Z'), 12)).toEqual({ key: 'd:2026-10-11T00', startMs: t('2026-10-11T00:00:00Z'), endMs: t('2026-10-11T12:00:00Z') });
    expect(windowOf(t('2026-10-11T12:00:00Z'), 12).key).toBe('d:2026-10-11T12');
    expect(windowOf(t('2026-10-11T11:59:59.999Z'), 12).key).toBe('d:2026-10-11T00');
  });
  it('weeks start Monday 00:00 UTC', () => {
    expect(new Date(weekStart(t('2026-10-11T08:33:00Z'))).toISOString()).toBe('2026-10-05T00:00:00.000Z'); // Sunday -> previous Monday
    expect(new Date(weekStart(t('2026-10-12T00:00:00Z'))).toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(new Date(weekStart(t('2026-10-11T23:59:59Z'))).toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });
  it('weekly segments: running ones and finished ones inside the claim grace', () => {
    const segs = [{ id: 'a', startDay: 0, durationDays: 3 }, { id: 'b', startDay: 3, durationDays: 3 }, { id: 'sun', startDay: 6, durationDays: 1 }];
    const at = (s: string) => segmentsAt(t(s), segs, 7).map((x) => `${x.period.key}${x.running ? '*' : ''}`);
    expect(at('2026-10-11T08:00:00Z')).toContain('w:2026-10-05:sun*'); // Sunday: the Sun Eclipse is running
    expect(at('2026-10-11T08:00:00Z')).toContain('w:2026-10-05:a'); // finished, claimable
    expect(at('2026-10-11T08:00:00Z')).not.toContain('w:2026-10-05:a*');
    expect(at('2026-10-20T08:00:00Z')).not.toContain('w:2026-10-05:a'); // grace over (ended 10-08 + 7d = 10-15)
  });
});
