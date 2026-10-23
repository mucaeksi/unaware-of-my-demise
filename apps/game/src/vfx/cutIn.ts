import * as PIXI from 'pixi.js';
import { Sfx } from '../audio/Sfx';
import { getUltimateChant, speakUltimatePhrase, type UltimateChantSpec } from '../battle/ultimateChants';
import { type Animator, EASES } from '../core/anim';

export interface CutInOptions {
  unitId?: string;
  unitName: string;
  skillName: string;
  element?: string;
  side: 'player' | 'enemy';
  palette: { primary: number; core: number; hex: string };
  /** knee-up portrait (cropped to the bust) or, without one, the chibi sprite frame */
  art: PIXI.Texture;
  isPortrait: boolean;
  flip: boolean;
  stageWidth: number;
  stageHeight?: number;
  casterPos?: { x: number; y: number };
  chant?: UltimateChantSpec;
  fonts: { display: string; body?: string };
  gold: string;
}

const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/**
 * 3-Beat Gothic Anime RPG Ultimate Sequence (pure PixiJS v8):
 *  - Beat 1 (Cast Invocation ~520ms): Expanding sacred astrolabe ritual circle + vertical aura pillars + Japanese Phrase 1.
 *  - Beat 2 (Diagonal Cut-In ~640ms): Slanted portrait banner + high-speed action lines + elemental echo + Japanese Phrase 2.
 *  - Beat 3 (Final Release ~560ms): Cross-stage katana/bell flash + Japanese Phrase 3 + Ultimate Skill Name slam.
 */
export function playCutIn(layer: PIXI.Container, anim: Animator, o: CutInOptions): Promise<void> {
  const { palette: pal } = o;
  const isPlayer = o.side === 'player';
  const W = o.stageWidth;
  const H = o.stageHeight ?? 1080;
  const unitId = o.unitId ?? o.unitName.toLowerCase().replace(/\s+/g, '_');
  const chant = o.chant ?? getUltimateChant(unitId, o.element, o.skillName);
  const [p1, p2, p3] = chant.phrases;
  const jpFont = `"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", ${o.fonts.display}, serif`;
  const bodyFont = o.fonts.body ?? '"Crimson Pro", Georgia, serif';

  const root = new PIXI.Container({ zIndex: 100 });
  layer.addChild(root);

  // =========================================================================
  // BEAT 1: CAST INVOCATION (0ms -> 520ms)
  // =========================================================================
  const castGroup = new PIXI.Container();
  const cx = o.casterPos?.x ?? (isPlayer ? 480 : W - 480);
  const cy = o.casterPos?.y ?? 620;
  castGroup.position.set(cx, cy - 90);
  root.addChild(castGroup);

  // Sacred double astrolabe magic circle around caster
  const castRing = new PIXI.Graphics();
  castRing.circle(0, 0, 145).stroke({ width: 3.5, color: pal.core, alpha: 0.9 });
  castRing.circle(0, 0, 118).stroke({ width: 2, color: pal.primary, alpha: 0.75 });
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    castRing.moveTo(Math.cos(a) * 88, Math.sin(a) * 88).lineTo(Math.cos(a) * 145, Math.sin(a) * 145);
  }
  castRing.stroke({ width: 2, color: pal.core, alpha: 0.75 });
  castRing.scale.set(0.2);
  castGroup.addChild(castRing);

  // Rising elemental light pillars during cast
  const pillars = new PIXI.Graphics();
  for (let i = -3; i <= 3; i++) {
    const px = i * 38;
    const ph = 180 + (Math.abs(i) % 2) * 70;
    pillars.rect(px - 3, -ph / 2, 6, ph).fill({ color: i % 2 === 0 ? pal.core : pal.primary, alpha: 0.48 });
  }
  pillars.alpha = 0;
  castGroup.addChild(pillars);

  // Phrase 1 Callout Plaque
  const p1Box = new PIXI.Container();
  p1Box.position.set(W / 2, 230);
  p1Box.alpha = 0;
  const p1Bg = new PIXI.Graphics()
    .chamferRect(-440, -54, 880, 108, 18)
    .fill({ color: 0x090510, alpha: 0.92 })
    .stroke({ width: 2.5, color: pal.primary, alpha: 0.9 });
  const p1Jp = new PIXI.Text({
    text: p1.jp,
    style: {
      fontFamily: jpFont,
      fontSize: 40,
      fontWeight: '700',
      fill: '#fff6e0',
      stroke: { color: '#07040c', width: 6, join: 'round' },
      dropShadow: { color: pal.hex, blur: 10, distance: 0, angle: 0, alpha: 0.85 }
    }
  });
  p1Jp.anchor.set(0.5);
  p1Jp.position.set(0, -14);
  const p1Sub = new PIXI.Text({
    text: `${p1.romaji}   ·   "${p1.en}"`,
    style: {
      fontFamily: bodyFont,
      fontSize: 21,
      fontStyle: 'italic',
      fill: pal.hex,
      stroke: { color: '#07040c', width: 4, join: 'round' }
    }
  });
  p1Sub.anchor.set(0.5);
  p1Sub.position.set(0, 26);
  p1Box.addChild(p1Bg, p1Jp, p1Sub);
  root.addChild(p1Box);

  Sfx.ultimateBeat(1);
  speakUltimatePhrase(unitId, p1, 0);

  anim.tween({
    duration: 480,
    ease: EASES['back.out'],
    onUpdate: (k) => {
      castRing.scale.set(lerp(0.2, 1.25, k));
      castRing.rotation = k * 1.1;
      castRing.alpha = k < 0.8 ? 1 : (1 - k) * 5;
      pillars.alpha = Math.sin(k * Math.PI) * 0.85;
      pillars.y = lerp(30, -55, k);
    }
  });
  anim.tween({
    duration: 180,
    ease: EASES['cubic.out'],
    onUpdate: (k) => {
      p1Box.alpha = k;
      p1Box.scale.set(lerp(1.22, 1, k));
    }
  });
  anim.tween({
    delay: 390,
    duration: 130,
    ease: EASES['quad.in'],
    onUpdate: (k) => {
      p1Box.alpha = 1 - k;
      castGroup.alpha = 1 - k;
    }
  });

  // =========================================================================
  // BEAT 2: DIAGONAL CUT-IN TRANSITION & PHRASE 2 (500ms -> 1160ms)
  // =========================================================================
  const bandY = H * 0.44;
  const bandH = 304;
  const halfW = W / 2 + 180;

  const strip = new PIXI.Graphics();
  strip.rect(-halfW, -bandH / 2, halfW * 2, bandH).fill({ color: 0x090512, alpha: 0.96 });
  strip.rect(-halfW, -bandH / 2 + 12, halfW * 2, bandH - 24).fill({ color: pal.primary, alpha: 0.26 });
  strip.moveTo(-halfW, -bandH / 2).lineTo(halfW, -bandH / 2).stroke({ width: 5, color: pal.core, alpha: 0.98 });
  strip.moveTo(-halfW, -bandH / 2 + 10).lineTo(halfW, -bandH / 2 + 10).stroke({ width: 2, color: pal.primary, alpha: 0.88 });
  for (let i = 0; i < 28; i++) {
    const ly = -bandH / 2 + 18 + ((i * 23) % (bandH - 36));
    const lx = ((i * 173) % (W + 240)) - halfW;
    strip.rect(lx, ly, 240 + (i % 4) * 160, i % 3 === 0 ? 4 : 2).fill({
      color: i % 2 === 0 ? pal.core : pal.primary,
      alpha: 0.32 + (i % 3) * 0.15
    });
  }

  const startX = isPlayer ? -W / 2 - 340 : W / 2 + 340;
  const targetX = isPlayer ? -W / 2 + 430 : W / 2 - 430;
  const bottomY = bandH / 2 - 10;
  const makeArt = (): PIXI.Sprite => {
    const s = new PIXI.Sprite(o.art);
    s.anchor.set(0.5, 1);
    s.position.set(startX, bottomY);
    return s;
  };
  const scale = (o.isPortrait ? bandH - 20 : bandH - 34) / Math.max(1, o.art.height);
  const echo = makeArt();
  echo.scale.set(scale * 1.03 * (o.flip ? -1 : 1), scale * 1.03);
  echo.tint = pal.primary;
  echo.blendMode = 'add';
  echo.alpha = 0.62;
  const main = makeArt();
  main.scale.set(scale * (o.flip ? -1 : 1), scale);

  const rule = new PIXI.Graphics();
  rule.moveTo(-halfW, bandH / 2 - 10).lineTo(halfW, bandH / 2 - 10).stroke({ width: 2, color: pal.primary, alpha: 0.88 });
  rule.moveTo(-halfW, bandH / 2).lineTo(halfW, bandH / 2).stroke({ width: 5, color: pal.core, alpha: 0.98 });

  const band = new PIXI.Container();
  band.addChild(strip, echo, main, rule);
  band.position.set(W / 2, bandY);
  band.angle = isPlayer ? -3.8 : 3.8;
  band.scale.set(1, 0.02);
  band.alpha = 0;
  root.addChild(band);

  const textX = isPlayer ? 1160 : 760;
  const sigil = new PIXI.Graphics();
  sigil.circle(0, 0, 112).stroke({ width: 3, color: pal.primary, alpha: 0.72 });
  sigil.circle(0, 0, 82).stroke({ width: 1.8, color: pal.core, alpha: 0.55 });
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    sigil.moveTo(Math.cos(a) * 34, Math.sin(a) * 34).lineTo(Math.cos(a) * 128, Math.sin(a) * 128);
  }
  sigil.stroke({ width: 2, color: pal.core, alpha: 0.85 });
  sigil.position.set(textX, bandY + 4);
  sigil.scale.set(0.25);
  sigil.alpha = 0;

  const makeLabel = (text: string, size: number, color: string, stroke: number, font = o.fonts.display): PIXI.Text => {
    const t = new PIXI.Text({
      text,
      style: {
        fontFamily: font,
        fontSize: size,
        fontWeight: '700',
        fill: color,
        stroke: { color: '#07040c', width: stroke, join: 'round' },
        dropShadow: { color: pal.hex, blur: 8, distance: 0, angle: 0, alpha: 0.7 }
      }
    });
    t.anchor.set(0.5);
    t.alpha = 0;
    return t;
  };

  const name = makeLabel(o.unitName.toUpperCase(), 30, pal.hex, 6);
  name.position.set(textX, bandY - 96);

  // Beat 2 Japanese Vow (Phrase 2)
  const p2Jp = makeLabel(p2.jp, 46, '#ffffff', 7, jpFont);
  p2Jp.position.set(textX, bandY - 22);
  const p2Sub = makeLabel(`${p2.romaji}  ·  "${p2.en}"`, 22, '#e3c37d', 4, bodyFont);
  p2Sub.position.set(textX, bandY + 32);

  // =========================================================================
  // BEAT 3: FINAL INCANTATION & SKILL NAME SLAM (1140ms -> 1780ms)
  // =========================================================================
  const p3Jp = makeLabel(p3.jp, 44, pal.hex, 7, jpFont);
  p3Jp.position.set(textX, bandY - 34);
  const skill = makeLabel(o.skillName.toUpperCase(), 58, o.gold, 8);
  skill.position.set(textX, bandY + 32);
  skill.scale.set(1.85);
  const p3Sub = makeLabel(`${p3.romaji}  ·  "${p3.en}"`, 21, '#f4eee1', 4, bodyFont);
  p3Sub.position.set(textX, bandY + 90);

  // Diagonal katana/bell flash slash for Beat 3 transition
  const slashBeam = new PIXI.Graphics();
  slashBeam.moveTo(-halfW, -6).lineTo(halfW, -6).lineTo(halfW, 6).lineTo(-halfW, 6).closePath().fill({ color: 0xffffff, alpha: 0.95 });
  slashBeam.position.set(W / 2, bandY);
  slashBeam.angle = isPlayer ? -3.8 : 3.8;
  slashBeam.scale.set(1, 0.1);
  slashBeam.alpha = 0;

  root.addChild(sigil, name, p2Jp, p2Sub, p3Jp, skill, p3Sub, slashBeam);

  // Schedule Beat 2 (at 480ms)
  anim.tween({
    delay: 480,
    duration: 150,
    ease: EASES['back.out'],
    onUpdate: (k) => {
      if (band.alpha === 0) {
        band.alpha = 1;
        Sfx.ultimateBeat(2);
        speakUltimatePhrase(unitId, p2, 1);
      }
      band.scale.set(1, lerp(0.04, 1, k));
    }
  });
  anim.tween({
    delay: 490,
    duration: 220,
    ease: EASES['cubic.out'],
    onUpdate: (k) => (main.x = lerp(startX, targetX, k))
  });
  const echoTo = targetX + (isPlayer ? -34 : 34);
  anim.tween({
    delay: 490,
    duration: 420,
    ease: EASES['cubic.out'],
    onUpdate: (k) => {
      echo.x = lerp(startX, echoTo, k);
      echo.alpha = lerp(0.65, 0, k);
    }
  });
  anim.tween({
    delay: 520,
    duration: 900,
    ease: EASES['cubic.out'],
    onUpdate: (k) => {
      sigil.alpha = 0.92;
      sigil.scale.set(lerp(0.3, 1.25, k));
      sigil.angle = lerp(0, 110, k);
    }
  });
  anim.tween({
    delay: 520,
    duration: 160,
    ease: EASES['quad.out'],
    onUpdate: (k) => {
      name.alpha = k;
      name.y = lerp(bandY - 106, bandY - 94, k);
    }
  });
  anim.tween({
    delay: 540,
    duration: 190,
    ease: EASES['back.out'],
    onUpdate: (k) => {
      p2Jp.alpha = Math.min(1, k);
      p2Jp.scale.set(lerp(1.45, 1, k));
      p2Sub.alpha = Math.min(1, k);
    }
  });
  // Fade out Phrase 2 just before Beat 3 slams in
  anim.tween({
    delay: 1020,
    duration: 110,
    ease: EASES['quad.in'],
    onUpdate: (k) => {
      p2Jp.alpha = 1 - k;
      p2Sub.alpha = 1 - k;
    }
  });

  // Schedule Beat 3 (at 1120ms): Final Japanese Release + Skill Name Slam
  anim.tween({
    delay: 1120,
    duration: 220,
    ease: EASES['back.out'],
    onUpdate: (k) => {
      if (p3Jp.alpha === 0) {
        Sfx.ultimateBeat(3);
        speakUltimatePhrase(unitId, p3, 2);
      }
      slashBeam.alpha = Math.sin(k * Math.PI);
      slashBeam.scale.set(1, lerp(0.2, 4.5, Math.sin(k * Math.PI)));
      p3Jp.alpha = Math.min(1, k * 1.2);
      p3Jp.scale.set(lerp(1.5, 1, k));
      skill.alpha = Math.min(1, k * 1.2);
      skill.scale.set(lerp(1.85, 1, k));
      p3Sub.alpha = Math.min(1, k);
    }
  });

  return new Promise((resolve) => {
    anim.tween({
      delay: 1640,
      duration: 200,
      ease: EASES['quad.in'],
      onUpdate: (k) => (root.alpha = 1 - k),
      onComplete: () => {
        root.destroy({ children: true });
        resolve();
      }
    });
  });
}
