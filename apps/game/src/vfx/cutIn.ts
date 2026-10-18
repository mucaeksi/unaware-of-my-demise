import * as PIXI from 'pixi.js';
import { type Animator, EASES } from './tween';

export interface CutInOptions {
  unitName: string;
  skillName: string;
  side: 'player' | 'enemy';
  palette: { primary: number; core: number; hex: string };
  /** knee-up portrait (cropped to the bust) or, without one, the chibi sprite frame */
  art: PIXI.Texture;
  isPortrait: boolean;
  flip: boolean;
  stageWidth: number;
  fonts: { display: string };
  gold: string;
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/**
 * Pure PixiJS ultimate cut-in: slanted band with action lines, sliding art with an additive echo, sigil and the
 * skill name slam. Mounted on the VFX overlay layer; resolves after it fades out (~1 s).
 */
export function playCutIn(layer: PIXI.Container, anim: Animator, o: CutInOptions): Promise<void> {
  const { palette: pal } = o;
  const isPlayer = o.side === 'player';
  const W = o.stageWidth;
  const bandY = 440;
  const bandH = 260;
  const halfW = W / 2 + 160;
  const root = new PIXI.Container({ zIndex: 100 });

  const strip = new PIXI.Graphics();
  strip.rect(-halfW, -bandH / 2, halfW * 2, bandH).fill({ color: 0x0b0612, alpha: 0.94 });
  strip.rect(-halfW, -bandH / 2 + 12, halfW * 2, bandH - 24).fill({ color: pal.primary, alpha: 0.24 });
  strip.moveTo(-halfW, -bandH / 2).lineTo(halfW, -bandH / 2).stroke({ width: 5, color: pal.core, alpha: 0.95 });
  strip.moveTo(-halfW, -bandH / 2 + 10).lineTo(halfW, -bandH / 2 + 10).stroke({ width: 2, color: pal.primary, alpha: 0.85 });
  for (let i = 0; i < 22; i++) {
    const ly = -bandH / 2 + 18 + ((i * 23) % (bandH - 36));
    const lx = ((i * 173) % (W + 200)) - halfW;
    strip.rect(lx, ly, 220 + (i % 4) * 140, i % 3 === 0 ? 4 : 2).fill({ color: i % 2 === 0 ? pal.core : pal.primary, alpha: 0.28 + (i % 3) * 0.14 });
  }

  const startX = isPlayer ? -W / 2 - 320 : W / 2 + 320;
  const targetX = isPlayer ? -W / 2 + 430 : W / 2 - 430;
  const bottomY = bandH / 2 - 2;
  const art = (): PIXI.Sprite => {
    const s = new PIXI.Sprite(o.art);
    s.anchor.set(0.5, 1);
    s.position.set(startX, bottomY);
    return s;
  };
  const scale = (o.isPortrait ? 450 : 340) / Math.max(1, o.art.height);
  const echo = art();
  echo.scale.set(scale * 1.08 * (o.flip ? -1 : 1), scale * 1.08);
  // solid elemental silhouette (tint only multiplies), drawn additively
  const fill = new PIXI.ColorMatrixFilter();
  fill.matrix = [0, 0, 0, 0, ((pal.primary >> 16) & 255) / 255, 0, 0, 0, 0, ((pal.primary >> 8) & 255) / 255, 0, 0, 0, 0, (pal.primary & 255) / 255, 0, 0, 0, 1, 0];
  echo.filters = [fill];
  echo.blendMode = 'add';
  echo.alpha = 0.55;
  const main = art();
  main.scale.set(scale * (o.flip ? -1 : 1), scale);

  const rule = new PIXI.Graphics();
  rule.moveTo(-halfW, bandH / 2 - 10).lineTo(halfW, bandH / 2 - 10).stroke({ width: 2, color: pal.primary, alpha: 0.85 });
  rule.moveTo(-halfW, bandH / 2).lineTo(halfW, bandH / 2).stroke({ width: 5, color: pal.core, alpha: 0.95 });

  const band = new PIXI.Container();
  band.addChild(strip, echo, main, rule);
  band.position.set(W / 2, bandY);
  band.angle = isPlayer ? -3.5 : 3.5;
  band.scale.set(1, 0.05);
  root.addChild(band);

  const textX = isPlayer ? 1140 : 780;
  const sigil = new PIXI.Graphics();
  sigil.circle(0, 0, 92).stroke({ width: 3, color: pal.primary, alpha: 0.65 });
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    sigil.moveTo(Math.cos(a) * 32, Math.sin(a) * 32).lineTo(Math.cos(a) * 112, Math.sin(a) * 112);
  }
  sigil.stroke({ width: 2, color: pal.core, alpha: 0.8 });
  sigil.position.set(textX, bandY + 4);
  sigil.scale.set(0.3);

  const label = (text: string, size: number, color: string, stroke: number): PIXI.Text => {
    const t = new PIXI.Text({ text: text.toUpperCase(), style: { fontFamily: o.fonts.display, fontSize: size, fontWeight: '700', fill: color, stroke: { color: '#07040c', width: stroke, join: 'round' } } });
    t.anchor.set(0.5);
    t.alpha = 0;
    return t;
  };
  const name = label(o.unitName, 34, pal.hex, 6);
  name.position.set(textX, bandY - 56);
  const skill = label(o.skillName, 64, o.gold, 8);
  skill.position.set(textX, bandY + 18);
  skill.scale.set(1.8);
  root.addChild(sigil, name, skill);
  layer.addChild(root);

  anim.tween({ duration: 140, ease: EASES['back.out'], onUpdate: (k) => band.scale.set(1, lerp(0.05, 1, k)) });
  anim.tween({ duration: 210, ease: EASES['cubic.out'], onUpdate: (k) => (main.x = lerp(startX, targetX, k)) });
  const echoTo = targetX + (isPlayer ? -28 : 28);
  anim.tween({ duration: 380, ease: EASES['cubic.out'], onUpdate: (k) => { echo.x = lerp(startX, echoTo, k); echo.alpha = lerp(0.55, 0, k); } });
  anim.tween({ delay: 70, duration: 460, ease: EASES['back.out'], onUpdate: (k) => { sigil.scale.set(lerp(0.3, 1.15, k)); sigil.angle = lerp(0, 60, k); } });
  anim.tween({ delay: 70, duration: 180, ease: EASES['quad.out'], onUpdate: (k) => { name.alpha = k; name.y = lerp(bandY - 56, bandY - 46, k); } });
  anim.tween({ delay: 90, duration: 210, ease: EASES['back.out'], onUpdate: (k) => { skill.alpha = Math.min(1, k); skill.scale.set(lerp(1.8, 1, k)); } });
  return new Promise((resolve) => {
    anim.tween({
      delay: 620,
      duration: 180,
      ease: EASES['quad.in'],
      onUpdate: (k) => (root.alpha = 1 - k),
      onComplete: () => {
        root.destroy({ children: true });
        resolve();
      }
    });
  });
}
