/** Design tokens for the gothic-anime UI. All sizes are 1920x1080 reference pixels. */
export const C = {
  void: 0x0a0610,
  ink: 0x120a18,
  plum: 0x2a1530,
  plumHi: 0x4a2548,
  silver: 0xc9b6e4,
  bone: 0xe9e2d4,
  gold: 0xb8975a,
  goldHi: 0xe3c37d,
  crimson: 0x8f1d3a,
  crimsonHi: 0xd4325c,
  veil: 0xb48cff,
  hpGood: 0x6fbf73,
  hpMid: 0xd9a441,
  hpLow: 0xc8324a,
  focus: 0x8fb8ff,
  shield: 0x9fd0ff,
  player: 0x7fb2ff,
  enemy: 0xd4325c
} as const;

export const T = {
  text: '#efe8f5',
  dim: '#a99bb8',
  gold: '#e3c37d',
  crimson: '#ff7a96',
  heal: '#8fe3a0',
  shield: '#9fd0ff',
  crit: '#ffd86b'
} as const;

export const F = {
  display: 'Cinzel, "Times New Roman", serif',
  body: '"Cormorant Garamond", Georgia, serif'
} as const;

export const SIZE = {
  title: 96,
  h1: 56,
  h2: 40,
  body: 38,
  small: 30,
  /** minimum comfortable touch target in reference px (~48dp on a 1080p phone) */
  touch: 120
} as const;

/** Units sort by DEPTH.units + y (200..1280); everything else sits in its own band above/below that. */
export const DEPTH = {
  bg: 0,
  world: 100,
  units: 200,
  fx: 1400,
  hud: 1600,
  modal: 2000,
  toast: 2200
} as const;

export const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
