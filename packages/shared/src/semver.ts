/** Minimal numeric semver (major.minor.patch) used for client/content compatibility checks. */
export type Semver = readonly [number, number, number];

export function parseSemver(text: string): Semver {
  const m = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/.exec(text);
  if (!m) throw new Error(`invalid semver: ${text}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] as number) - (pb[i] as number);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}
