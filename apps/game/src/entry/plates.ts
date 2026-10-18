import * as PIXI from 'pixi.js';
import { REF_H, REF_W } from '../config';

/**
 * Painted stand-ins for the prologue plates (village / crownfall / road): gradients and silhouettes only, no characters, no signs, nothing
 * that could contradict canon. They keep the whole interlude playable and timed until the generated plates replace them
 * (the art manifest `ui` entries `prologue_<scene id>` / `prologue_<visual>` stills take precedence automatically).
 */

interface Pt {
  x: number;
  y: number;
}

/** the few fill calls the painters use, on a 2D canvas */
class Brush {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  private rgba(c: number, a: number): string {
    return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
  }

  fillStyle(color: number, alpha = 1): void {
    this.ctx.fillStyle = this.rgba(color, alpha);
  }

  /** a vertical ramp for the next fillRect (top colour/alpha → bottom colour/alpha) */
  fillGradientStyle(top: number, bottom: number, alphaTop: number, alphaBottom: number, y0: number, y1: number): void {
    const g = this.ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, this.rgba(top, alphaTop));
    g.addColorStop(1, this.rgba(bottom, alphaBottom));
    this.ctx.fillStyle = g;
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.ctx.fillRect(x, y, w, h);
  }

  fillCircle(x: number, y: number, r: number): void {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.fill();
  }

  fillPoints(pts: readonly Pt[]): void {
    this.ctx.beginPath();
    pts.forEach((p, i) => (i ? this.ctx.lineTo(p.x, p.y) : this.ctx.moveTo(p.x, p.y)));
    this.ctx.closePath();
    this.ctx.fill();
  }

  /** a vertical band fading from transparent to `color` at `alpha` */
  band(color: number, alphaTop: number, alphaBottom: number, y: number, h: number): void {
    this.fillGradientStyle(color, color, alphaTop, alphaBottom, y, y + h);
    this.fillRect(0, y, REF_W, h);
  }
}

type Painter = (g: Brush) => void;

const V = (x: number, y: number): Pt => ({ x, y });
const SIL = 0x0d0812;

const sky = (g: Brush, top: number, bottom: number, horizon: number): void => {
  g.fillGradientStyle(top, bottom, 1, 1, 0, horizon);
  g.fillRect(0, 0, REF_W, horizon);
};

const PAINT: Record<string, Painter> = {
  /** Veyrhold before the ashes: warm dusk, a bell tower, lit windows. */
  village: (g) => {
    sky(g, 0x20162e, 0x9a6045, 760);
    g.fillStyle(0xf0c78a, 0.16);
    g.fillCircle(1500, 700, 260);
    g.fillStyle(SIL, 1);
    g.fillRect(0, 760, REF_W, REF_H - 760);
    // tower
    g.fillRect(1130, 250, 150, 520);
    g.fillPoints([V(1110, 262), V(1205, 130), V(1300, 262)]);
    g.fillStyle(0xe3b25d, 0.9);
    g.fillCircle(1205, 330, 34);
    g.fillRect(1176, 360, 58, 8);
    // houses with lit windows
    const houses: [number, number, number, number][] = [[120, 600, 220, 170], [380, 650, 180, 120], [640, 610, 240, 160], [1420, 640, 230, 130], [1700, 590, 200, 180]];
    for (const [x, y, w, h] of houses) {
      g.fillStyle(SIL, 1);
      g.fillRect(x, y, w, h);
      g.fillPoints([V(x - 14, y), V(x + w / 2, y - 70), V(x + w + 14, y)]);
      g.fillStyle(0xf0b85a, 0.85);
      g.fillRect(x + w * 0.2, y + h * 0.35, 26, 34);
      g.fillRect(x + w * 0.6, y + h * 0.35, 26, 34);
    }
    g.band(0x24142e, 0, 0.5, 690, 120);
  },
  /** The capital after Crownfall: broken gate towers against smoke, a dim red-grey sky. */
  crownfall: (g) => {
    sky(g, 0x120e1a, 0x4a3a4c, 800);
    g.fillStyle(SIL, 1);
    g.fillRect(0, 800, REF_W, REF_H - 800);
    // broken gate towers
    g.fillPoints([V(520, 800), V(520, 360), V(580, 330), V(610, 400), V(690, 300), V(740, 420), V(740, 800)]);
    g.fillPoints([V(1180, 800), V(1180, 420), V(1240, 350), V(1290, 460), V(1360, 380), V(1400, 800)]);
    g.fillRect(740, 560, 440, 240); // wall above the gap
    g.fillStyle(0x07040b, 1);
    g.fillRect(830, 640, 260, 160); // the dark opening
    // smoke columns
    for (const [x, w, a] of [[640, 160, 0.26], [900, 220, 0.2], [1300, 190, 0.28], [1580, 150, 0.18]] as [number, number, number][]) {
      g.fillStyle(0x6c6072, a);
      g.fillPoints([V(x - w / 4, 780), V(x - w / 2, 430), V(x - w, 90), V(x + w, 70), V(x + w / 2, 440), V(x + w / 4, 780)]);
    }
    g.band(0x8f1d3a, 0, 0.16, 690, 120);
  },
  /** The road after the walls: dusk, a track to the vanishing point, tree lines, two small silhouettes walking together. */
  road: (g) => {
    sky(g, 0x2b2038, 0xb4745a, 590);
    g.fillStyle(0x1b1220, 1);
    g.fillRect(0, 590, REF_W, REF_H - 590);
    g.fillStyle(0x4b3a3a, 1);
    g.fillPoints([V(940, 590), V(980, 590), V(1500, REF_H), V(420, REF_H)]);
    g.fillStyle(0x6a5348, 0.5);
    g.fillPoints([V(955, 590), V(965, 590), V(1000, REF_H), V(900, REF_H)]);
    g.fillStyle(SIL, 1);
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 110;
      const h = 220 + ((i * 53) % 130);
      g.fillPoints([V(x - 70, 640 + i * 6), V(x, 640 - h + i * 6), V(x + 70, 640 + i * 6)]);
      g.fillPoints([V(REF_W - x - 70, 640 + i * 6), V(REF_W - x, 640 - h + i * 6), V(REF_W - x + 70, 640 + i * 6)]);
    }
    // two travellers
    for (const [x, s] of [[900, 1], [1010, 0.92]] as [number, number][]) {
      g.fillStyle(SIL, 1);
      g.fillCircle(x, 690 - 66 * s, 15 * s);
      g.fillPoints([V(x - 22 * s, 760), V(x - 12 * s, 690 - 48 * s), V(x + 12 * s, 690 - 48 * s), V(x + 22 * s, 760)]);
    }
    g.band(0xcfa3a0, 0, 0.16, 540, 100);
  }
};

const FALLBACK: Painter = (g) => {
  sky(g, 0x1a1226, 0x3a2c48, 760);
  g.fillStyle(SIL, 1);
  g.fillRect(0, 760, REF_W, REF_H - 760);
};

const stubs = new Map<string, PIXI.Texture>();

/** The plate for a prologue `visual`: the generated art when the content ships it, else a painted stand-in (cached). */
export function plateTexture(visual: string, art: PIXI.Texture | null): PIXI.Texture {
  if (art && art !== PIXI.Texture.EMPTY) return art;
  const hit = stubs.get(visual);
  if (hit && !hit.destroyed) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = REF_W;
  canvas.height = REF_H;
  const ctx = canvas.getContext('2d');
  if (ctx) (PAINT[visual] ?? FALLBACK)(new Brush(ctx));
  const tex = PIXI.Texture.from(canvas);
  stubs.set(visual, tex);
  return tex;
}
