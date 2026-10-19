import * as PIXI from 'pixi.js';
import type { PixiScene } from '../core/PixiScene';
import { prefs } from '../platform/prefs';
import { C } from '../ui/theme';
import { vfxTextures } from './textures';

export interface SwingingBellHandle {
  container: PIXI.Container;
  pulseRing: (color?: number) => void;
}

/**
 * Animated Black-Sun Eclipse Corona & Counter-Rotating Astronomical Rune Ring (#1 Approved UI Animation).
 * Used in SplashScene, StudioScene, TitleScene (behind logo), and HomeScene (Company Hub header).
 */
export function createEclipseCorona(
  scene: PixiScene<unknown>,
  x: number,
  y: number,
  radius = 190,
  depth = 2,
  includeDisc = false
): PIXI.Container {
  const root = scene.add(new PIXI.Container(), depth);
  root.position.set(x, y);
  const calm = prefs().reducedMotion;
  const spark = vfxTextures().spark;

  // 1. Soft breathing corona aura
  const aura = new PIXI.Sprite(spark);
  aura.anchor.set(0.5);
  aura.scale.set((radius / 26) * 1.35);
  aura.tint = C.gold;
  aura.blendMode = 'add';
  aura.alpha = 0.36;
  root.addChild(aura);

  // 2. Rotating solar corona ray wheel (clockwise)
  const rayWheel = new PIXI.Graphics();
  const rayCount = 24;
  for (let i = 0; i < rayCount; i++) {
    const a = (i * Math.PI * 2) / rayCount;
    const isMajor = i % 2 === 0;
    const rInner = radius * 0.88;
    const rOuter = radius * (isMajor ? 1.34 : 1.16);
    const spread = isMajor ? 0.055 : 0.032;
    rayWheel
      .poly([
        Math.cos(a - spread) * rInner,
        Math.sin(a - spread) * rInner,
        Math.cos(a) * rOuter,
        Math.sin(a) * rOuter,
        Math.cos(a + spread) * rInner,
        Math.sin(a + spread) * rInner
      ])
      .fill({ color: isMajor ? C.goldHi : C.gold, alpha: isMajor ? 0.34 : 0.18 });
  }
  rayWheel.circle(0, 0, radius * 0.96).stroke({ width: 2.5, color: C.goldHi, alpha: 0.68 });
  root.addChild(rayWheel);

  // 3. Counter-rotating outer astronomical rune ring
  const runeRing = new PIXI.Graphics();
  const outerR = radius * 1.18;
  runeRing.circle(0, 0, outerR).stroke({ width: 1.5, color: C.silver, alpha: 0.38 });
  runeRing.circle(0, 0, outerR + 10).stroke({ width: 1, color: C.gold, alpha: 0.25 });
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI * 2) / 16;
    const cardinal = i % 4 === 0;
    const r0 = outerR - (cardinal ? 12 : 5);
    const r1 = outerR + (cardinal ? 12 : 5);
    runeRing
      .moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
      .lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
      .stroke({ width: cardinal ? 2.2 : 1.2, color: cardinal ? C.goldHi : C.silver, alpha: cardinal ? 0.85 : 0.42 });
    if (cardinal) {
      const cx = Math.cos(a) * (outerR + 18);
      const cy = Math.sin(a) * (outerR + 18);
      runeRing.poly([cx, cy - 5, cx + 5, cy, cx, cy + 5, cx - 5, cy]).fill({ color: C.goldHi, alpha: 0.9 });
    }
  }
  root.addChild(runeRing);

  // 4. Optional central black-sun eclipse disc
  if (includeDisc) {
    const disc = new PIXI.Graphics()
      .circle(0, 0, radius * 0.86)
      .fill({ color: 0x06030b, alpha: 0.94 })
      .circle(0, 0, radius * 0.87)
      .stroke({ width: 3, color: C.goldHi, alpha: 0.88 });
    root.addChild(disc);
  }

  if (!calm) {
    scene.anim.to(aura, { scaleX: aura.scale.x * 1.16, scaleY: aura.scale.y * 1.16, alpha: 0.54 }, { duration: 2800, yoyo: true, repeat: -1, ease: 'sine.inout' });
    scene.onTick((dt) => {
      if (root.destroyed) return;
      rayWheel.rotation += dt * 0.00018;
      runeRing.rotation -= dt * 0.00012;
    });
  }

  return root;
}

/**
 * Animated Fractured Sanctuary Bell Pendulum & Acoustic Shockwave Rings (#2 Approved UI Animation).
 * Used in TitleScene, PrologueScene caption rule, and StoryScene reader box.
 */
export function createSwingingBellEmblem(
  scene: PixiScene<unknown>,
  x: number,
  y: number,
  scale = 1,
  depth = 4,
  autoPulseEveryMs = 3400
): SwingingBellHandle {
  const root = scene.add(new PIXI.Container(), depth);
  root.position.set(x, y);
  root.scale.set(scale);
  const calm = prefs().reducedMotion;

  const ringLayer = new PIXI.Container();
  root.addChild(ringLayer);

  // Top suspension chain & bracket
  const chain = new PIXI.Graphics()
    .moveTo(-18, 0)
    .lineTo(18, 0)
    .stroke({ width: 2.5, color: C.gold, alpha: 0.8 })
    .circle(0, -10, 5)
    .stroke({ width: 2, color: C.goldHi, alpha: 0.85 })
    .moveTo(0, -5)
    .lineTo(0, 6)
    .stroke({ width: 2.5, color: C.goldHi, alpha: 0.9 });
  root.addChild(chain);

  // Swinging bell body pivoted at top crown (0, 0)
  const pendulum = new PIXI.Container();
  root.addChild(pendulum);

  const bellBody = new PIXI.Graphics()
    // Bell silhouette
    .poly([-14, 4, 14, 4, 20, 26, 28, 38, -28, 38, -20, 26])
    .fill({ color: 0x261914, alpha: 0.96 })
    .stroke({ width: 2.2, color: C.goldHi, alpha: 0.92 })
    // Decorative upper & lower bronze bands
    .moveTo(-15, 11)
    .lineTo(15, 11)
    .moveTo(-23, 32)
    .lineTo(23, 32)
    .stroke({ width: 1.4, color: C.gold, alpha: 0.72 })
    // Clapper at bottom
    .circle(0, 42, 5.5)
    .fill({ color: C.goldHi, alpha: 0.95 });

  // Glowing amber crack fissure inside the bell
  const crackGlow = new PIXI.Graphics()
    .moveTo(4, 10)
    .lineTo(-3, 21)
    .lineTo(5, 28)
    .lineTo(-1, 37)
    .stroke({ width: 2.4, color: 0xff9d42, alpha: 0.95 });

  pendulum.addChild(bellBody, crackGlow);

  const pulseRing = (color: number = C.goldHi): void => {
    if (calm || root.destroyed) return;
    const wave = new PIXI.Graphics()
      .circle(0, 24, 18)
      .stroke({ width: 2.4, color, alpha: 0.88 })
      .circle(0, 24, 11)
      .stroke({ width: 1.2, color: 0xffffff, alpha: 0.55 });
    ringLayer.addChild(wave);
    scene.anim.to(wave, { scaleX: 4.2, scaleY: 2.6, alpha: 0 }, {
      duration: 1350,
      ease: 'cubic.out',
      onComplete: () => wave.destroy()
    });
  };

  if (!calm) {
    pendulum.angle = -6.5;
    scene.anim.to(pendulum, { angle: 6.5 }, { duration: 1550, yoyo: true, repeat: -1, ease: 'sine.inout' });
    scene.anim.to(crackGlow, { alpha: 0.35 }, { duration: 780, yoyo: true, repeat: -1, ease: 'sine.inout' });
    if (autoPulseEveryMs > 0) {
      let acc = autoPulseEveryMs * 0.65;
      scene.onTick((dt) => {
        if (root.destroyed) return;
        acc += dt;
        if (acc >= autoPulseEveryMs) {
          acc = 0;
          pulseRing();
        }
      });
    }
  }

  return { container: root, pulseRing };
}

/**
 * Animated Cracked Pocket Watch & Sanctuary Bell Pendulum Loading Spinner (#4 Approved UI Animation).
 * Used in FinishScene (Patch Wait screen) and TitleScene patch-staging box.
 */
export function createCrackedWatchSpinner(
  scene: PixiScene<unknown>,
  x: number,
  y: number,
  scale = 1,
  depth = 10
): PIXI.Container {
  const root = scene.add(new PIXI.Container(), depth);
  root.position.set(x, y);
  root.scale.set(scale);
  const calm = prefs().reducedMotion;
  const spark = vfxTextures().spark;

  // Ambient golden-violet chronometer glow
  const glow = new PIXI.Sprite(spark);
  glow.anchor.set(0.5);
  glow.scale.set(3.8);
  glow.tint = C.gold;
  glow.blendMode = 'add';
  glow.alpha = 0.32;
  root.addChild(glow);

  // Outer counter-rotating rune ring
  const outerRing = new PIXI.Graphics()
    .circle(0, 0, 68)
    .stroke({ width: 1.5, color: C.gold, alpha: 0.45 });
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12;
    const major = i % 3 === 0;
    outerRing
      .moveTo(Math.cos(a) * (major ? 58 : 62), Math.sin(a) * (major ? 58 : 62))
      .lineTo(Math.cos(a) * (major ? 74 : 70), Math.sin(a) * (major ? 74 : 70))
      .stroke({ width: major ? 2.4 : 1.3, color: major ? C.goldHi : C.silver, alpha: major ? 0.9 : 0.5 });
  }
  root.addChild(outerRing);

  // Watch case & cracked obsidian dial
  const dial = new PIXI.Graphics()
    // Top pocket-watch crown bow
    .circle(0, -64, 9)
    .stroke({ width: 2.5, color: C.goldHi, alpha: 0.9 })
    .rect(-6, -56, 12, 7)
    .fill({ color: C.gold, alpha: 0.95 })
    // Main watch bezel
    .circle(0, 0, 50)
    .fill({ color: 0x0c0714, alpha: 0.95 })
    .stroke({ width: 4, color: C.goldHi, alpha: 0.92 })
    .circle(0, 0, 44)
    .stroke({ width: 1.2, color: C.silver, alpha: 0.45 })
    // Glowing amber fracture lines across the watch glass
    .moveTo(-18, -36)
    .lineTo(4, -8)
    .lineTo(28, -22)
    .moveTo(4, -8)
    .lineTo(-12, 26)
    .lineTo(16, 38)
    .stroke({ width: 1.8, color: 0xffa447, alpha: 0.82 });
  root.addChild(dial);

  // Watch hands
  const hourHand = new PIXI.Graphics()
    .poly([-3, 6, 0, -26, 3, 6])
    .fill({ color: C.gold, alpha: 0.95 });
  const minuteHand = new PIXI.Graphics()
    .poly([-2.2, 8, 0, -39, 2.2, 8])
    .fill({ color: 0xfff0c4, alpha: 0.98 });
  const centerPin = new PIXI.Graphics().circle(0, 0, 4.5).fill({ color: C.goldHi, alpha: 1 });
  root.addChild(hourHand, minuteHand, centerPin);

  // Miniature swinging bell pendulum suspended below the watch at (0, 52)
  const miniBell = new PIXI.Container();
  miniBell.position.set(0, 52);
  const bellGraphic = new PIXI.Graphics()
    .moveTo(0, 0)
    .lineTo(0, 8)
    .stroke({ width: 2, color: C.gold, alpha: 0.85 })
    .poly([-8, 8, 8, 8, 13, 24, -13, 24])
    .fill({ color: 0x2a1b15, alpha: 0.96 })
    .stroke({ width: 1.8, color: C.goldHi, alpha: 0.92 })
    .circle(0, 27, 3.5)
    .fill({ color: C.goldHi, alpha: 0.95 });
  miniBell.addChild(bellGraphic);
  root.addChild(miniBell);

  if (!calm) {
    miniBell.angle = -11;
    scene.anim.to(miniBell, { angle: 11 }, { duration: 920, yoyo: true, repeat: -1, ease: 'sine.inout' });
    scene.anim.to(glow, { scaleX: 4.5, scaleY: 4.5, alpha: 0.5 }, { duration: 1400, yoyo: true, repeat: -1, ease: 'sine.inout' });
    scene.onTick((dt) => {
      if (root.destroyed) return;
      minuteHand.rotation += dt * 0.0028;
      hourHand.rotation += dt * 0.00045;
      outerRing.rotation -= dt * 0.00035;
    });
  }

  return root;
}

/**
 * Cracks a Crimson & Gold Wax Seal and bursts embers outward (#3 Approved UI Animation).
 * Triggered when tapping "TAP TO START" or primary CTA actions.
 */
export function triggerWaxSealBurst(scene: PixiScene<unknown>, x: number, y: number, depth = 60): void {
  if (prefs().reducedMotion) return;
  const root = scene.add(new PIXI.Container(), depth);
  root.position.set(x, y);

  // Expanding golden/crimson ignition ring
  const ring = new PIXI.Graphics()
    .circle(0, 0, 26)
    .stroke({ width: 4, color: C.goldHi, alpha: 0.95 })
    .circle(0, 0, 18)
    .stroke({ width: 2.5, color: C.crimsonHi, alpha: 0.85 });
  root.addChild(ring);
  scene.anim.to(ring, { scaleX: 6.5, scaleY: 3.2, alpha: 0 }, { duration: 680, ease: 'cubic.out' });

  // Two halves of the cracked crimson wax seal splitting apart
  for (const dir of [-1, 1] as const) {
    const half = new PIXI.Graphics()
      .arc(0, 0, 24, dir < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, dir < 0 ? Math.PI * 1.5 : Math.PI * 0.5)
      .fill({ color: 0x9e1b34, alpha: 0.96 })
      .stroke({ width: 2.2, color: C.goldHi, alpha: 0.95 });
    root.addChild(half);
    scene.anim.to(half, { x: dir * 56, y: -18, angle: dir * 28, alpha: 0 }, { duration: 620, ease: 'cubic.out' });
  }

  // Radial ember sparks
  const sparkTex = vfxTextures().spark;
  for (let i = 0; i < 14; i++) {
    const a = (i * Math.PI * 2) / 14 + (Math.random() - 0.5) * 0.25;
    const dist = 70 + Math.random() * 90;
    const sp = new PIXI.Sprite(sparkTex);
    sp.anchor.set(0.5);
    sp.scale.set(0.28 + Math.random() * 0.22);
    sp.tint = i % 2 === 0 ? C.goldHi : C.crimsonHi;
    sp.blendMode = 'add';
    root.addChild(sp);
    scene.anim.to(sp, { x: Math.cos(a) * dist, y: Math.sin(a) * dist - 16, alpha: 0, scaleX: 0.04, scaleY: 0.04 }, { duration: 540 + Math.random() * 220, ease: 'cubic.out' });
  }

  scene.anim.after(800, () => {
    if (!root.destroyed) root.destroy({ children: true });
  });
}
