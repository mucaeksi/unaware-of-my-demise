/** Cutscene rules (opening tutorial revision v006, binding): fixed reveal pace, minimum holds, speaker-change pauses. */
export const CUTSCENE = { cps: 26, minShortLineSeconds: 5.5, minAfterRevealSeconds: 3.2, sameSpeakerPauseSeconds: 0.65, dissolveSeconds: 0.8 } as const;

/** Seconds Auto waits after a line is fully shown. Pure so the rule table is unit tested. */
export function cutsceneHoldSeconds(opts: { chars: number; holdSeconds?: number; last: boolean; closingHoldSeconds?: number }): number {
  const reveal = opts.chars / CUTSCENE.cps;
  const hold = Math.max(CUTSCENE.minAfterRevealSeconds, opts.holdSeconds ?? 0, CUTSCENE.minShortLineSeconds - reveal);
  return opts.last ? Math.max(hold, opts.closingHoldSeconds ?? 0) : hold;
}

/** Pause before a line starts: 1 s (the scene's speaker pause) when the speaker changes, 0.65 s when the same speaker continues. */
export function cutscenePauseSeconds(prev: string | null, next: string, speakerPause: number): number {
  if (prev === null) return 0;
  return prev === next ? CUTSCENE.sameSpeakerPauseSeconds : speakerPause;
}
