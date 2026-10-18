import Phaser from '../engine';
import { REF_H, REF_W } from '../config';

/**
 * Painted stand-ins for the prologue plates (village / crownfall / road): gradients and silhouettes only, no characters, no signs, nothing
 * that could contradict canon. They keep the whole interlude playable and timed until the generated plates replace them
 * (the art manifest `ui` entries `prologue_<scene id>` / `prologue_<visual>` stills take precedence automatically).
 */
type Painter = (g: Phaser.GameObjects.Graphics) => void;

const V = (x: number, y: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(x, y);
const SIL = 0x0d0812;

const sky = (g: Phaser.GameObjects.Graphics, top: number, bottom: number, horizon: number): void => {
  g.fillGradientStyle(top, top, bottom, bottom, 1, 1, 1, 1);
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
    g.fillPoints([V(1110, 262), V(1205, 130), V(1300, 262)], true);
    g.fillStyle(0xe3b25d, 0.9);
    g.fillCircle(1205, 330, 34);
    g.fillRect(1176, 360, 58, 8);
    // houses with lit windows
    const houses: [number, number, number, number][] = [[120, 600, 220, 170], [380, 650, 180, 120], [640, 610, 240, 160], [1420, 640, 230, 130], [1700, 590, 200, 180]];
    for (const [x, y, w, h] of houses) {
      g.fillStyle(SIL, 1);
      g.fillRect(x, y, w, h);
      g.fillPoints([V(x - 14, y), V(x + w / 2, y - 70), V(x + w + 14, y)], true);
      g.fillStyle(0xf0b85a, 0.85);
      g.fillRect(x + w * 0.2, y + h * 0.35, 26, 34);
      g.fillRect(x + w * 0.6, y + h * 0.35, 26, 34);
    }
    g.fillGradientStyle(0x24142e, 0x24142e, 0x24142e, 0x24142e, 0, 0, 0.5, 0.5);
    g.fillRect(0, 690, REF_W, 120);
  },
  /** The capital after Crownfall: broken gate towers against smoke, a dim red-grey sky. */
  crownfall: (g) => {
    sky(g, 0x120e1a, 0x4a3a4c, 800);
    g.fillStyle(SIL, 1);
    g.fillRect(0, 800, REF_W, REF_H - 800);
    // broken gate towers
    g.fillPoints([V(520, 800), V(520, 360), V(580, 330), V(610, 400), V(690, 300), V(740, 420), V(740, 800)], true);
    g.fillPoints([V(1180, 800), V(1180, 420), V(1240, 350), V(1290, 460), V(1360, 380), V(1400, 800)], true);
    g.fillRect(740, 560, 440, 240); // wall above the gap
    g.fillStyle(0x07040b, 1);
    g.fillRect(830, 640, 260, 160); // the dark opening
    // smoke columns
    for (const [x, w, a] of [[640, 160, 0.26], [900, 220, 0.2], [1300, 190, 0.28], [1580, 150, 0.18]] as [number, number, number][]) {
      g.fillStyle(0x6c6072, a);
      g.fillPoints([V(x - w / 4, 780), V(x - w / 2, 430), V(x - w, 90), V(x + w, 70), V(x + w / 2, 440), V(x + w / 4, 780)], true);
    }
    g.fillGradientStyle(0x8f1d3a, 0x8f1d3a, 0x8f1d3a, 0x8f1d3a, 0, 0, 0.16, 0.16);
    g.fillRect(0, 690, REF_W, 120);
  },
  /** The road after the walls: dusk, a track to the vanishing point, tree lines, two small silhouettes walking together. */
  road: (g) => {
    sky(g, 0x2b2038, 0xb4745a, 590);
    g.fillStyle(0x1b1220, 1);
    g.fillRect(0, 590, REF_W, REF_H - 590);
    g.fillStyle(0x4b3a3a, 1);
    g.fillPoints([V(940, 590), V(980, 590), V(1500, REF_H), V(420, REF_H)], true);
    g.fillStyle(0x6a5348, 0.5);
    g.fillPoints([V(955, 590), V(965, 590), V(1000, REF_H), V(900, REF_H)], true);
    g.fillStyle(SIL, 1);
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 110;
      const h = 220 + ((i * 53) % 130);
      g.fillPoints([V(x - 70, 640 + i * 6), V(x, 640 - h + i * 6), V(x + 70, 640 + i * 6)], true);
      g.fillPoints([V(REF_W - x - 70, 640 + i * 6), V(REF_W - x, 640 - h + i * 6), V(REF_W - x + 70, 640 + i * 6)], true);
    }
    // two travellers
    for (const [x, s] of [[900, 1], [1010, 0.92]] as [number, number][]) {
      g.fillStyle(SIL, 1);
      g.fillCircle(x, 690 - 66 * s, 15 * s);
      g.fillPoints([V(x - 22 * s, 760), V(x - 12 * s, 690 - 48 * s), V(x + 12 * s, 690 - 48 * s), V(x + 22 * s, 760)], true);
    }
    g.fillGradientStyle(0xcfa3a0, 0xcfa3a0, 0xcfa3a0, 0xcfa3a0, 0, 0, 0.16, 0.16);
    g.fillRect(0, 540, REF_W, 100);
  }
};

const FALLBACK: Painter = (g) => {
  sky(g, 0x1a1226, 0x3a2c48, 760);
  g.fillStyle(SIL, 1);
  g.fillRect(0, 760, REF_W, REF_H - 760);
};

/** Texture key of the plate for a prologue `visual`: the generated art when the content ships it, else a painted stand-in. */
export function plateKey(scene: Phaser.Scene, visual: string, artKey: string | null | undefined): string {
  if (artKey && scene.textures.exists(artKey)) return artKey;
  const key = `plate_stub_${visual}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  (PAINT[visual] ?? FALLBACK)(g);
  g.generateTexture(key, REF_W, REF_H);
  g.destroy();
  return key;
}
