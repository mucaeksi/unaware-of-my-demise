/**
 * Voice-synchronized, punctuation-aware subtitle reveal scheduler.
 *
 * Balances subtitle text appearance with the actual recorded Japanese voiceover duration
 * (`Algieba`, `Sulafat`, `Iapetus`), pausing naturally at commas, em-dashes, ellipses,
 * and sentence boundaries so the text breathes in lockstep with the voice performance.
 */

export interface SubtitleSchedule {
  readonly fullText: string;
  readonly charTimesMs: readonly number[];
  readonly totalRevealMs: number;
  readonly voiceDurationMs: number;
}

function charPauseWeight(text: string, index: number): number {
  const ch = text[index] ?? '';
  const next = text[index + 1] ?? '';

  // Closing quote or bracket at the very end needs minimal weight
  if (index >= text.length - 2 && (ch === '”' || ch === '"' || ch === "'")) {
    return 0.4;
  }

  // ASCII ellipsis dots "..."
  if (ch === '.' && (next === '.' || text[index - 1] === '.')) {
    return 2.4;
  }

  // Sentence-ending punctuation followed by whitespace or quote
  if ((ch === '.' || ch === '!' || ch === '?') && (next === ' ' || next === '\n' || next === '”' || next === '')) {
    return 7.8;
  }

  // Em-dash or unicode ellipsis pause
  if (ch === '—' || ch === '…') {
    // Opening narrator dash "— " should not stall before the first word
    if (index <= 1) return 1.2;
    return 6.2;
  }

  // Clause-level comma / semicolon / colon pause
  if ((ch === ',' || ch === ';' || ch === ':') && (next === ' ' || next === '\n')) {
    return 4.4;
  }

  if (ch === '\n') {
    return 1.8;
  }

  if (ch === ' ') {
    return 1.1;
  }

  return 1.0;
}

export function buildSubtitleSchedule(
  fullText: string,
  voiceDurationSeconds: number,
  fallbackCps = 28,
): SubtitleSchedule {
  const len = fullText.length;
  if (len === 0) {
    return { fullText: '', charTimesMs: [], totalRevealMs: 0, voiceDurationMs: 0 };
  }

  const weights = new Array<number>(len);
  let totalWeight = 0;
  for (let i = 0; i < len; i++) {
    const w = charPauseWeight(fullText, i);
    weights[i] = w;
    totalWeight += w;
  }

  const voiceMs = Math.max(0, voiceDurationSeconds * 1000);
  let totalRevealMs: number;
  let leadInMs = 0;

  if (voiceMs > 300) {
    leadInMs = Math.min(110, voiceMs * 0.06);
    // Finish revealing ~88% through the voice clip so the last words land right as the actor speaks them
    const targetSpanMs = Math.max(580, voiceMs * 0.88 - leadInMs);
    const minSpanMs = (len / 46) * 1000;
    const maxSpanMs = Math.max((len / 7.5) * 1000, voiceMs * 0.86);
    totalRevealMs = Math.max(minSpanMs, Math.min(maxSpanMs, targetSpanMs));
  } else {
    totalRevealMs = Math.max(450, (len / Math.max(12, fallbackCps)) * 1000);
  }

  const charTimesMs = new Array<number>(len);
  let accWeight = 0;
  for (let i = 0; i < len; i++) {
    accWeight += weights[i]!;
    charTimesMs[i] = Math.round(leadInMs + (accWeight / Math.max(1, totalWeight)) * totalRevealMs);
  }

  return {
    fullText,
    charTimesMs,
    totalRevealMs: Math.round(leadInMs + totalRevealMs),
    voiceDurationMs: Math.round(voiceMs),
  };
}

export function resolveSubtitleProgress(
  schedule: SubtitleSchedule,
  elapsedMs: number,
  liveAudioSeconds?: number,
): { count: number; revealRatio: number; voiceRatio: number; done: boolean } {
  const len = schedule.fullText.length;
  if (len === 0 || schedule.totalRevealMs <= 0) {
    return { count: len, revealRatio: 1, voiceRatio: 1, done: true };
  }

  // If the live HTMLAudioElement clock is actively running, synchronize directly with it
  const effectiveMs =
    liveAudioSeconds !== undefined && liveAudioSeconds > 0.04
      ? liveAudioSeconds * 1000 * 0.55 + elapsedMs * 0.45
      : elapsedMs;

  // Binary search in charTimesMs for the number of characters revealed at effectiveMs
  let lo = 0;
  let hi = len - 1;
  let count = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((schedule.charTimesMs[mid] ?? 0) <= effectiveMs) {
      count = mid + 1;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // Avoid splitting in the middle of a multi-byte surrogate pair
  if (count < len && count > 0) {
    const code = schedule.fullText.charCodeAt(count - 1);
    if (code >= 0xd800 && code <= 0xdbff) {
      count = Math.min(len, count + 1);
    }
  }

  const revealRatio = Math.min(1, Math.max(0, effectiveMs / Math.max(1, schedule.totalRevealMs)));
  const voiceDenom = schedule.voiceDurationMs > 0 ? schedule.voiceDurationMs : schedule.totalRevealMs;
  const voiceRatio = Math.min(1, Math.max(0, effectiveMs / Math.max(1, voiceDenom)));

  return {
    count,
    revealRatio,
    voiceRatio,
    done: count >= len,
  };
}
