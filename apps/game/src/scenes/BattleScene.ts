import Phaser from 'phaser';
import { Battle, type BattleEvent, type PlayerAction, type SkillOption, type TurnPrompt } from '@uomd/combat';
import type { BattleParty, Encounter, SkillDef, UnitPack } from '@uomd/content-schema';
import { canonicalJson, sha256Hex } from '@uomd/shared';
import { API_BASE, REF_H, REF_W } from '../config';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { activeBattleLayout, battleLayoutSpec, spotFor, type BattleLayoutPreset } from '../battle/formation';
import { BattleVfx } from '../battle/BattleVfx';
import { UnitView } from '../battle/UnitView';
import { announce } from '../platform/a11y';
import { qualityProfile } from '../platform/graphics';
import { prefs } from '../platform/prefs';
import { safeInsets } from '../platform/safeArea';
import { describeAttachment } from '../ui/format';
import { Services } from '../services';
import { Button, panel, sceneFadeIn, title, toast, txt } from '../ui/kit';
import { C, DEPTH, F, SIZE, T, hex } from '../ui/theme';

export interface BattleOutcome {
  won: boolean;
  stars: number;
}
export interface BattleInit {
  encounterPath: string;
  /** chapter node being played: lets a signed-in player's win be claimed on the server */
  nodeId?: string;
  /** Invoked as soon as a battle win is confirmed (after server claim when signed in, or immediately in preview/tutorial). */
  onClaimed?: (stars: number) => void;
  onDone: (scene: Phaser.Scene, outcome: BattleOutcome) => void;
  onBack: (scene: Phaser.Scene) => void;
  /** Owned stages use the frozen party; all signed-in stages use a frozen release session. */
  party?: BattleParty;
  sessionId?: string;
  /** Financial submission stays bound to the release used when the battle started. */
  releaseId?: string;
  /** a lost owned-hero battle needs a fresh server session, so retrying goes back through the flow */
  onRetry?: (scene: Phaser.Scene) => void;
  /** opening tutorial: no stars, no server verification line, retreat goes back to the story before the fight */
  tutorial?: boolean;
  /** optional layout preset override (A: current, B: arena_lite, C: afk_faithful) */
  layout?: BattleLayoutPreset;
}


const ELEMENT_COLOR: Record<string, number> = { Veil: C.veil, Stone: 0xe0d2b0, Ember: 0xff8a4c, Tide: 0x6cc4ff, Gale: 0x9be8c3, Dawn: 0xffe9a8 };

export class BattleScene extends Phaser.Scene {
  private cfg!: BattleInit;
  private encounter!: Encounter;
  private pack!: UnitPack;
  private battle!: Battle;
  private views = new Map<string, UnitView>();
  private statusNames = new Map<string, { name: string; category: string }>();
  private recorded: PlayerAction[] = [];
  private speed = 1;
  private auto = false;
  private dead = false;
  private lunged: { view: UnitView; dim: Phaser.GameObjects.Rectangle | null } | null = null;
  private chips: Phaser.GameObjects.Container[] = [];
  private chipLayer!: Phaser.GameObjects.Container;
  private skillLayer: Phaser.GameObjects.Container | null = null;
  private descText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private telegraphText!: Phaser.GameObjects.Text;
  private autoBtn: Button | null = null;
  private speedBtn: Button | null = null;
  private pendingResolve: ((a: PlayerAction) => void) | null = null;
  private bannerBox: Phaser.GameObjects.Container | null = null;
  private menuLayer: Phaser.GameObjects.Container | null = null;
  private claimPromise: Promise<boolean> | null = null;
  private claimConfirmed = false;
  private primaryBtn: Button | null = null;
  private verifyLabel: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('Battle');
  }

  init(data: BattleInit): void {
    this.cfg = data;
    this.views = new Map();
    this.recorded = [];
    this.speed = 1;
    this.auto = false;
    this.dead = false;
    this.lunged = null;
    this.chips = [];
    this.skillLayer = null;
    this.pendingResolve = null;
    this.bannerBox = null;
    this.menuLayer = null;
    this.claimPromise = null;
    this.claimConfirmed = false;
    this.primaryBtn = null;
    this.verifyLabel = null;
  }


  async create(): Promise<void> {
    const { content, art } = Services.ready();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.dead = true;
      this.time.timeScale = 1;
      this.tweens.timeScale = 1;
    });
    this.cameras.main.setBackgroundColor(0x0a0610);
    try {
      this.encounter = await content.encounter(this.cfg.encounterPath);
      this.pack = await content.unitPack();
      this.battle = Battle.create(this.pack, this.encounter, this.cfg.party);
      const defs = new Map(this.pack.units.map((u) => [u.unit_id, u]));
      // breakable objectives are combatants too: their art keys come from the battle itself
      const artKeys = this.battle.combatants.map((c) => defs.get(c.def.unit_id)?.art_key ?? c.def.art_key);
      const playerUnitIds = this.battle.combatants.filter((c) => c.side === 'player').map((c) => c.def.unit_id);
      const neutralEmotions = new Map(playerUnitIds.map((id) => [id, new Set(['neutral'])]));
      await Promise.all([
        art.loadBackground(this, this.encounter.location_id),
        art.loadUnits(this, artKeys),
        art.loadPortraits(this, playerUnitIds, neutralEmotions).catch(() => undefined)
      ]);
    } catch (e) {
      title(this, REF_W / 2, REF_H / 2 - 40, 'This battle could not be loaded', SIZE.h2, T.crimson);
      txt(this, REF_W / 2, REF_H / 2 + 30, String(e instanceof Error ? e.message : e), { fontSize: '30px', color: T.dim, wordWrap: { width: 1400 }, align: 'center' }).setOrigin(0.5);
      new Button(this, REF_W / 2, REF_H / 2 + 200, { label: 'BACK', w: 360, onClick: () => this.cfg.onBack(this) });
      return;
    }
    for (const s of this.pack.rules.statuses) this.statusNames.set(s.status_id, { name: s.name_en, category: s.category });
    this.buildWorld();
    this.buildHud();
    sceneFadeIn(this, 1200);
    Music.stop(0.1);
    await this.wait(650);
    for (const event of this.battle.log) if (event.type === 'phase_change') await this.phaseStory(event.unit, event.phase);
    if (this.dead) return;
    await this.loop();
  }

  private get layoutPreset(): BattleLayoutPreset {
    return this.cfg.layout ?? activeBattleLayout();
  }

  // ------------------------------------------------------------------ world

  private buildWorld(): void {
    const { art } = Services.ready();
    BattleVfx.ensureTextures(this);
    const q = qualityProfile();
    const insets = safeInsets(this);
    const insetX = Math.max(insets.left, insets.right);
    const bg = this.add.image(REF_W / 2, REF_H / 2, art.background(this.encounter.location_id)).setOrigin(0.5, 0.5).setDepth(DEPTH.bg);
    const baseCover = Math.max(REF_W / bg.width, REF_H / bg.height) * 1.1;
    bg.setScale(baseCover);
    if (!prefs().reducedMotion) {
      this.tweens.add({
        targets: bg,
        x: { from: REF_W / 2 - 26, to: REF_W / 2 + 26 },
        scale: baseCover * 1.035,
        duration: 26000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
    const grade = this.add.graphics().setDepth(DEPTH.bg + 2);
    grade.fillGradientStyle(0x0a0610, 0x0a0610, 0x0a0610, 0x0a0610, 0.28, 0.28, 0.04, 0.04);
    grade.fillRect(0, 0, REF_W, 240);
    grade.fillGradientStyle(0x0a0610, 0x0a0610, 0x0a0610, 0x0a0610, 0.04, 0.04, 0.62, 0.62);
    grade.fillRect(0, REF_H - 320, REF_W, 320);
    if (q.vignette) {
      try {
        this.cameras.main.filters.external.addVignette(0.5, 0.5, 0.85, 0.24);
      } catch {
        /* cosmetic */
      }
    }
    if (!prefs().reducedMotion && q.particles && q.particleDensity > 0) {
      this.add.particles(0, 0, 'fx_spark', {
        x: { min: 0, max: REF_W },
        y: { min: 200, max: 900 },
        lifespan: 7000,
        speedY: { min: -14, max: -4 },
        speedX: { min: -8, max: 10 },
        scale: { start: 0.12, end: 0 },
        alpha: { start: 0.35, end: 0 },
        frequency: Math.round(220 / q.particleDensity),
        tint: 0xcbb8e8,
        blendMode: 'ADD'
      }).setDepth(DEPTH.fx - 50);
    }

    const defs = new Map(this.pack.units.map((u) => [u.unit_id, u]));
    for (const side of ['player', 'enemy'] as const) {
      for (const { c, visualRow, indexInRow, countInRow } of this.visualFormationForSide(side)) {
        const spot = spotFor(side, visualRow, indexInRow, countInRow, this.layoutPreset, insetX);
        const v = new UnitView(
          this,
          art,
          {
            id: c.id,
            name: c.def.name_en,
            side,
            artKey: defs.get(c.def.unit_id)?.art_key ?? c.def.unit_id,
            element: c.def.element,
            maxHp: c.maxHp,
            hp: c.hp,
            spot,
          },
          prefs().reducedMotion,
        );
        v.setDepth(DEPTH.units + spot.y);
        v.on('pointerup', () => this.onUnitTapped(v));
        this.views.set(c.id, v);
      }
    }
  }

  /**
   * Distributes a side's combatants into the canonical 2-Front + 3-Rear visual formation.
   * When an encounter defines >2 units in `front` and <3 in `rear` (e.g. 3 enemies all tagged `front`),
   * excess units overflow into the `rear` visual column so every battle displays a true 3-back / 2-front formation.
   */
  private visualFormationForSide(side: 'player' | 'enemy'): {
    c: BattleScene['battle']['combatants'][number];
    visualRow: 'front' | 'rear';
    indexInRow: number;
    countInRow: number;
  }[] {
    const list = this.battle.combatants.filter((c) => c.side === side).sort((a, b) => a.slot - b.slot);
    const rawFront = list.filter((c) => c.row === 'front');
    const rawRear = list.filter((c) => c.row === 'rear');
    let front: typeof list;
    let rear: typeof list;
    if (rawFront.length >= 2 && rawRear.length === 0) {
      // Distribute 2-unit or 3+-unit all-front waves into front (up to 2, or 1 when <=3 total) + rear (up to 3)
      const sortedFront = [...rawFront].sort((a, b) => {
        const aTank = /pilgrim|knight|tank|guard|bulwark/i.test(a.def.unit_id + ' ' + a.def.role) ? 0 : 1;
        const bTank = /pilgrim|knight|tank|guard|bulwark/i.test(b.def.unit_id + ' ' + b.def.role) ? 0 : 1;
        return aTank - bTank || a.slot - b.slot;
      });
      const frontCap = rawFront.length <= 3 ? 1 : 2;
      front = sortedFront.slice(0, frontCap);
      rear = sortedFront.slice(frontCap);
    } else if (rawFront.length > 2 && rawRear.length < 3) {
      const sortedFront = [...rawFront].sort((a, b) => {
        const aTank = /pilgrim|knight|tank|guard|bulwark/i.test(a.def.unit_id + ' ' + a.def.role) ? 0 : 1;
        const bTank = /pilgrim|knight|tank|guard|bulwark/i.test(b.def.unit_id + ' ' + b.def.role) ? 0 : 1;
        return aTank - bTank || a.slot - b.slot;
      });
      front = sortedFront.slice(0, 2);
      rear = [...sortedFront.slice(2), ...rawRear];
    } else {
      front = rawFront;
      rear = rawRear;
    }
    const out: {
      c: BattleScene['battle']['combatants'][number];
      visualRow: 'front' | 'rear';
      indexInRow: number;
      countInRow: number;
    }[] = [];
    front.forEach((c, i) => out.push({ c, visualRow: 'front', indexInRow: i, countInRow: front.length }));
    rear.forEach((c, i) => out.push({ c, visualRow: 'rear', indexInRow: i, countInRow: rear.length }));
    return out;
  }

  /** Renders and caches a 96x96 circular mini-portrait medallion texture for the Turn Order bar. */
  private ensureUnitAvatarTexture(artKey: string, side: 'player' | 'enemy'): string {
    const texKey = `turn_avatar_${artKey}_${side}`;
    if (this.textures.exists(texKey)) return texKey;
    const { art } = Services.ready();
    const u = art.unit(artKey);
    const idle = art.frameFor(artKey, 'idle');
    const frameObj = this.textures.getFrame(idle.key, idle.frame);
    const srcImg = frameObj?.source?.image as HTMLImageElement | HTMLCanvasElement | undefined;

    const size = 96;
    const canvasTex = this.textures.createCanvas(texKey, size, size);
    if (!canvasTex) return idle.key;
    const ctx = canvasTex.getContext();
    const cx = size / 2;
    const cy = size / 2;
    const r = 42;

    ctx.clearRect(0, 0, size, size);

    // 1. Dark gothic circular backdrop
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    const bgGrad = ctx.createRadialGradient(cx, cy - 10, 6, cx, cy, r);
    if (side === 'player') {
      bgGrad.addColorStop(0, '#2a1f3d');
      bgGrad.addColorStop(1, '#0e0816');
    } else {
      bgGrad.addColorStop(0, '#3a1728');
      bgGrad.addColorStop(1, '#12070e');
    }
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // 2. Clip and draw character head/bust crop
    ctx.clip();
    if (srcImg && frameObj) {
      const fx = frameObj.cutX;
      const fy = frameObj.cutY;
      const fw = frameObj.cutWidth;
      const fh = frameObj.cutHeight;
      // SD Chibis have oversized 2-head proportions: top 58% of idle frame is the head & shoulders
      const cropH = Math.max(1, Math.round(fh * 0.6));
      const cropW = Math.min(fw, Math.round(cropH * 1.05));
      const cropX = fx + Math.max(0, Math.round((fw - cropW) * 0.5));
      const cropY = fy;
      const wantRight = side === 'player';
      const flipX = (u.facing === 'right') !== wantRight;

      ctx.save();
      ctx.translate(cx, cy + 4);
      if (flipX) ctx.scale(-1, 1);
      const drawSize = r * 2.08;
      ctx.drawImage(srcImg, cropX, cropY, cropW, cropH, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      ctx.restore();
    }

    // Subtle inner edge vignette inside circle
    const vig = ctx.createRadialGradient(cx, cy, r * 0.62, cx, cy, r);
    vig.addColorStop(0, 'rgba(10,6,16,0)');
    vig.addColorStop(1, 'rgba(10,6,16,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    // 3. Ornate dual metallic bezel ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = side === 'player' ? '#7ea8ff' : '#e56b86';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = side === 'player' ? '#e3c37d' : '#ffb3c4';
    ctx.stroke();
    ctx.restore();

    canvasTex.refresh();
    return texKey;
  }

  // ------------------------------------------------------------------ HUD

  private buildHud(): void {
    const insets = safeInsets(this);
    const spec = battleLayoutSpec(this.layoutPreset);
    // top-left: stage title; compact circular portrait turn order bar right below
    title(this, 60 + insets.left, 54 + insets.top, `${this.encounter.stage_id}  ·  ${this.encounter.title_en}`, 32, T.gold).setOrigin(0, 0.5).setDepth(DEPTH.hud);
    this.chipLayer = this.add.container(0, 0).setDepth(DEPTH.hud);

    // the encounter's ui block can hide the speed and Auto buttons (the opening tutorials are manual, one turn at a time)
    const ui = this.encounter.ui ?? { speed: true, auto: true };
    let edge = REF_W - 104 - insets.right;
    const btnY = 56 + insets.top;
    const btnW = 148;
    const btnH = 62;
    const btnStep = btnW + 14;
    if (ui.speed) {
      this.speedBtn = new Button(this, edge, btnY, { label: '×1', w: btnW, h: btnH, fontSize: 22, onClick: () => this.toggleSpeed() }).setDepth(DEPTH.hud);
      edge -= btnStep;
    }
    if (ui.auto) {
      this.autoBtn = new Button(this, edge, btnY, { label: 'AUTO', w: btnW, h: btnH, fontSize: 21, onClick: () => this.toggleAuto() }).setDepth(DEPTH.hud);
      edge -= btnStep;
    }
    new Button(this, edge, btnY, { label: 'MENU', w: btnW, h: btnH, fontSize: 21, onClick: () => this.openMenu() }).setDepth(DEPTH.hud);

    // between the title block and the speed/auto/menu buttons there is free room at the top: the turn hint lives there
    this.descText = txt(this, REF_W / 2, spec.descY - insets.bottom, '', { fontSize: '26px', color: T.text, align: 'center', wordWrap: { width: 1640 - insets.left - insets.right } }).setOrigin(0.5).setDepth(DEPTH.hud);
    this.hintText = txt(this, 830, 54 + insets.top, '', { fontFamily: F.display, fontSize: '26px', fontStyle: '600', color: T.gold, stroke: '#0a0610', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.hud);
    this.telegraphText = txt(this, REF_W - 60 - insets.right, 136 + insets.top, '', { fontFamily: F.display, fontSize: '26px', fontStyle: '700', color: T.crimson, stroke: '#0a0610', strokeThickness: 5 }).setOrigin(1, 0.5).setDepth(DEPTH.hud);
    this.refreshHud();
  }

  private refreshHud(): void {
    if (this.dead) return;
    const insets = safeInsets(this);
    const spec = battleLayoutSpec(this.layoutPreset);
    const order = this.battle.result ? [] : this.battle.previewOrder(8);
    this.chipLayer.removeAll(true);
    this.chips = [];
    if (order.length > 0) {
      const barY = spec.turnOrderY + insets.top;
      const barX = 60 + insets.left;
      const stepX = 54;
      const barW = 92 + order.length * stepX;
      const barH = 54;
      const track = this.add.graphics();
      track.fillStyle(0x0c0714, 0.78);
      track.lineStyle(1.5, C.gold, 0.42);
      track.fillRoundedRect(barX, barY - barH / 2, barW, barH, 27);
      track.strokeRoundedRect(barX, barY - barH / 2, barW, barH, 27);
      const lbl = txt(this, barX + 42, barY, 'TURN', {
        fontFamily: F.display,
        fontSize: '14px',
        fontStyle: '700',
        color: T.gold,
      }).setOrigin(0.5);
      this.chipLayer.add([track, lbl]);

      const defs = new Map(this.pack.units.map((u) => [u.unit_id, u]));
      order.forEach((id, i) => {
        const c = this.battle.unit(id);
        const artKey = defs.get(c.def.unit_id)?.art_key ?? c.def.unit_id;
        const avatarTex = this.ensureUnitAvatarTexture(artKey, c.side);
        const x = barX + 98 + i * stepX;
        const isCurrent = i === 0;
        const items: Phaser.GameObjects.GameObject[] = [];
        if (isCurrent) {
          const glow = this.add.circle(0, 0, 26, C.goldHi, 0.22).setStrokeStyle(2.5, C.goldHi, 0.95);
          items.push(glow);
        }
        const avatar = this.add.image(0, 0, avatarTex).setScale(isCurrent ? 0.52 : 0.42);
        items.push(avatar);
        if (isCurrent) {
          const crown = txt(this, 0, -25, '▼', { fontSize: '13px', color: T.gold, stroke: '#0a0610', strokeThickness: 3 }).setOrigin(0.5);
          items.push(crown);
        }
        const chip = this.add.container(x, barY, items);
        this.chipLayer.add(chip);
        this.chips.push(chip);
      });
    }
    // enemy intents + status badges (with shape cues ▲/▼/◆/⛨)
    for (const [id, v] of this.views) {
      const c = this.battle.unit(id);
      v.setBadges(c, this.statusNames);
      if (c.side === 'enemy' && !c.objective) {
        const intent = c.alive ? this.battle.intentFor(id) : null;
        const tgt = intent?.targetId ? this.battle.unit(intent.targetId).def.name_en.toUpperCase() : undefined;
        v.setIntent(intent ? `${intent.announced ? '⚠ ' : ''}${intent.skillName.toUpperCase()}` : null, tgt);
      }
    }
  }


  private toggleSpeed(): void {
    this.speed = this.speed >= 3 ? 1 : this.speed + 1; // ×1 → ×2 → ×3 → ×1
    this.time.timeScale = this.speed;
    this.tweens.timeScale = this.speed;
    this.speedBtn?.setLabel(`×${this.speed}`);
  }

  private toggleAuto(): void {
    this.auto = !this.auto;
    this.autoBtn?.setLabel(this.auto ? 'AUTO ✓' : 'AUTO');
    if (this.auto && this.pendingResolve) this.pendingResolve(this.battle.autoAction());
  }

  private openMenu(): void {
    if (this.menuLayer) return;
    const dim = this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x000000, 0.7).setInteractive();
    const box = panel(this, REF_W / 2, REF_H / 2, 700, 520, 'normal');
    const items: Phaser.GameObjects.GameObject[] = [
      dim,
      box,
      title(this, REF_W / 2, 360, 'PAUSED', 48, T.gold),
      new Button(this, REF_W / 2, 500, { label: 'RESUME', w: 520, onClick: () => this.closeMenu() }),
      new Button(this, REF_W / 2, 650, { label: 'RETREAT', sub: 'Leave the battle', w: 520, variant: 'danger', onClick: () => { this.closeMenu(); this.dead = true; this.cfg.onBack(this); } })
    ];
    this.menuLayer = this.add.container(0, 0, items).setDepth(DEPTH.modal);
    this.time.timeScale = 0.0001;
  }

  private closeMenu(): void {
    this.menuLayer?.destroy();
    this.menuLayer = null;
    this.time.timeScale = this.speed;
  }

  // ------------------------------------------------------------------ main loop

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.dead) return resolve();
      this.time.delayedCall(ms, () => resolve());
    });
  }

  private async loop(): Promise<void> {
    let step = this.battle.advance();
    await this.playEvents(step.events);
    while (!this.battle.result && !this.dead) {
      let action: PlayerAction;
      if (this.auto) {
        await this.wait(380);
        if (this.dead) return;
        action = this.battle.autoAction();
      } else {
        action = await this.awaitPlayerAction(this.battle.prompt() as TurnPrompt);
        if (this.dead) return;
      }
      this.recorded.push(action);
      step = this.battle.act(action);
      await this.playEvents(step.events);
    }
    if (!this.dead) await this.finish();
  }

  /** Await presentation only; combat actions, RNG and the server replay remain unchanged. */
  private async phaseStory(unit: string, phase: string): Promise<void> {
    const unitId = this.battle.unit(unit).def.unit_id;
    const paths = this.encounter.phase_stories?.find((binding) => binding.unit_id === unitId && binding.phase_id === phase)?.stories ?? [];
    for (const path of paths) {
      if (this.dead) return;
      await new Promise<void>((resolve) => {
        const shutdown = (): void => { this.scene.stop('Story'); resolve(); };
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, shutdown);
        const done = (back = false): void => {
          this.events.off(Phaser.Scenes.Events.SHUTDOWN, shutdown);
          this.scene.stop('Story');
          this.scene.resume();
          if (back) this.cfg.onBack(this);
          else {
            const { art } = Services.ready();
            const music = this.encounter.music_cue ? art.music(this.encounter.music_cue) : null;
            if (music) Music.play(this.cache.audio, music.key, music.loopStart, music.duration);
          }
          resolve();
        };
        this.scene.launch('Story', { path, onDone: () => done(), onBack: () => done(true) });
        this.scene.bringToTop('Story');
        this.scene.pause();
      });
    }
  }

  // ------------------------------------------------------------------ player input

  private awaitPlayerAction(prompt: TurnPrompt): Promise<PlayerAction> {
    return new Promise((resolve) => {
      const actorView = this.views.get(prompt.actor);
      actorView?.setHighlight(true);
      const done = (a: PlayerAction): void => {
        actorView?.setHighlight(false);
        this.clearSkillPanel();
        this.pendingResolve = null;
        this.submit = null;
        resolve(a);
      };
      this.pendingResolve = done;
      this.refreshHud();
      this.buildSkillPanel(prompt, done);
    });
  }

  private selected: SkillOption | null = null;
  private submit: ((a: PlayerAction) => void) | null = null;

  private buildSkillPanel(prompt: TurnPrompt, submit: (a: PlayerAction) => void): void {
    this.clearSkillPanel();
    this.submit = submit;
    this.selected = null;
    const insets = safeInsets(this);
    const spec = battleLayoutSpec(this.layoutPreset);
    const actor = this.battle.unit(prompt.actor);
    const items: Phaser.GameObjects.GameObject[] = [];
    const n = prompt.options.length;
    const w = 380;
    const gap = 24;
    const x0 = REF_W / 2 - ((n - 1) * (w + gap)) / 2;
    const passive = actor.def.skills.find((s) => s.type === 'passive');
    const turnBanner = `${actor.def.name_en.toUpperCase()}'S TURN`;
    this.hintText.setText(turnBanner);
    announce(turnBanner);
    this.descText.setText(passive ? `Passive — ${passive.name_en}: ${passive.description_en}` : '');
    this.descText.setColor(T.dim);
    prompt.options.forEach((o, i) => {
      const label = o.type === 'ultimate' ? 'ULTIMATE' : o.type === 'basic' ? 'BASIC' : 'SKILL';
      const sub = !o.available ? (o.reason === 'cooldown' ? `Cooldown ${o.cooldownLeft}` : `Focus ${actor.focus}/${o.def.focus_cost}`) : label;
      const b = new Button(this, x0 + i * (w + gap), spec.skillBarY - insets.bottom, { label: o.name.toUpperCase(), sub, w, h: 128, fontSize: 28, variant: o.type === 'ultimate' ? 'hot' : 'normal', onClick: () => this.onSkillTapped(o, b) });
      b.setEnabled(o.available);
      items.push(b);
    });
    this.skillLayer = this.add.container(0, 0, items).setDepth(DEPTH.hud);
  }

  private clearSkillPanel(): void {
    this.skillLayer?.destroy();
    this.skillLayer = null;
    this.selected = null;
    for (const v of this.views.values()) v.setSelectable(false);
    this.hintText.setText('');
    this.descText.setText('');
  }

  private onSkillTapped(o: SkillOption, _b: Button): void {
    if (!o.available) return;
    if (this.selected?.skillId === o.skillId) {
      // second tap on the same skill confirms it when it needs no explicit target (or has one legal target)
      if (!o.needsTarget) return this.confirm({ skillId: o.skillId });
      if (o.legalTargets.length === 1) return this.confirm({ skillId: o.skillId, targetId: o.legalTargets[0] as string });
      return;
    }
    this.selected = o;
    Sfx.confirm();
    for (const v of this.views.values()) v.setSelectable(false);
    this.descText.setColor(T.text);
    this.descText.setText(o.def.description_en);
    if (o.needsTarget) {
      this.hintText.setText(o.legalTargets.length === 1 ? 'TAP THE SKILL AGAIN OR THE TARGET' : 'CHOOSE A TARGET');
      for (const id of o.legalTargets) this.views.get(id)?.setSelectable(true);
    } else {
      this.hintText.setText('TAP AGAIN TO CAST');
    }
  }

  private onUnitTapped(v: UnitView): void {
    const o = this.selected;
    if (!o || !o.needsTarget || !o.legalTargets.includes(v.id)) return;
    this.confirm({ skillId: o.skillId, targetId: v.id });
  }

  private confirm(a: PlayerAction): void {
    Sfx.confirm();
    this.submit?.(a);
    this.submit = null;
  }

  /** Reinforcements called mid-battle: load their art, add a view and spread the enemy side again. */
  private async addSummoned(id: string): Promise<void> {
    const { art } = Services.ready();
    const insets = safeInsets(this);
    const c = this.battle.unit(id);
    const defs = new Map(this.pack.units.map((u) => [u.unit_id, u]));
    const artKey = defs.get(c.def.unit_id)?.art_key ?? c.def.art_key;
    await art.loadUnits(this, [artKey]);
    if (this.dead) return;
    const spot = spotFor(c.side, c.row, 0, 1, this.layoutPreset, Math.max(insets.left, insets.right));
    const v = new UnitView(this, art, { id: c.id, name: c.def.name_en, side: c.side, artKey, element: c.def.element, maxHp: c.maxHp, hp: c.hp, spot }, prefs().reducedMotion);
    v.setDepth(DEPTH.units + spot.y);
    v.on('pointerup', () => this.onUnitTapped(v));
    this.views.set(c.id, v);
    this.relayout(c.side);
    BattleVfx.castSigil(this, v.x, v.y - 12, c.def.element, 1.2);
    this.float(v, 'REINFORCEMENTS', T.crimson, 34);
    await this.wait(420);
  }

  private relayout(side: 'player' | 'enemy'): void {
    const insets = safeInsets(this);
    const insetX = Math.max(insets.left, insets.right);
    for (const { c, visualRow, indexInRow, countInRow } of this.visualFormationForSide(side)) {
      const v = this.views.get(c.id);
      if (!v) continue;
      const spot = spotFor(side, visualRow, indexInRow, countInRow, this.layoutPreset, insetX);
      v.glideTo(spot);
      v.setDepth(DEPTH.units + spot.y);
    }
  }

  // ------------------------------------------------------------------ presentation

  private activeSkillType: 'basic' | 'active' | 'ultimate' | 'passive' | 'signature' = 'basic';

  private view(id: string): UnitView {
    const v = this.views.get(id);
    if (!v) throw new Error(`no view for ${id}`);
    return v;
  }

  private skillDef(unitInstance: string, skillId: string): SkillDef | undefined {
    return this.battle.unit(unitInstance).def.skills.find((s) => s.skill_id === skillId);
  }

  private async playEvents(events: BattleEvent[]): Promise<void> {
    for (const e of events) {
      if (this.dead) return;
      await this.present(e);
    }
    await this.settleAction();
    this.refreshHud();
  }

  private float(v: UnitView, text: string, color: string, size = 40, dx = 0): void {
    const t = txt(this, v.x + dx, v.headY + 70, text, { fontFamily: F.display, fontSize: `${size}px`, fontStyle: '700', color, stroke: '#0a0610', strokeThickness: 6 }).setOrigin(0.5).setDepth(DEPTH.fx + 100);
    if (!prefs().reducedMotion) {
      t.setScale(1.55);
      this.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    }
    this.tweens.add({ targets: t, y: t.y - 115, duration: 1100, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 520, duration: 580, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
  }

  private burst(x: number, y: number, color: number, count = 14): void {
    const q = qualityProfile();
    if (prefs().reducedMotion || prefs().reduceFlash || !q.particles || q.particleDensity <= 0) return;
    const em = this.add.particles(x, y, 'fx_spark', { speed: { min: 90, max: 340 }, angle: { min: 0, max: 360 }, scale: { start: 0.55, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 520, tint: color, blendMode: 'ADD', emitting: false }).setDepth(DEPTH.fx);
    em.explode(Math.max(4, Math.round(count * q.particleDensity)));
    this.time.delayedCall(800, () => em.destroy());
  }

  private ringPulse(x: number, y: number, color: number, radius = 150): void {
    if (prefs().reducedMotion || prefs().reduceFlash) return;
    const r = this.add.circle(x, y, 20, color, 0).setStrokeStyle(6, color, 0.9).setDepth(DEPTH.fx);
    this.tweens.add({ targets: r, radius, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  private async banner(text: string, ultimate: boolean): Promise<void> {
    this.bannerBox?.destroy();
    const w = Math.min(1100, 260 + text.length * 30);
    const bg = panel(this, 0, 0, w, ultimate ? 120 : 88, ultimate ? 'hot' : 'normal');
    const t = title(this, 0, 0, text.toUpperCase(), ultimate ? 52 : 38, ultimate ? T.gold : T.text);
    const box = this.add.container(REF_W / 2, 275, [bg, t]).setDepth(DEPTH.modal - 20).setAlpha(0);
    this.bannerBox = box;
    this.tweens.add({ targets: box, alpha: 1, y: 290, duration: 180 });
    this.tweens.add({ targets: box, alpha: 0, delay: ultimate ? 900 : 560, duration: 240, onComplete: () => box.destroy() });
    await Promise.resolve();
  }

  private async settleAction(): Promise<void> {
    const l = this.lunged;
    if (!l) return;
    this.lunged = null;
    const v = l.view;
    this.tweens.add({ targets: v, x: v.spot.x, y: v.spot.y, duration: 220, ease: 'Quad.easeInOut' });
    if (l.dim) this.tweens.add({ targets: l.dim, alpha: 0, duration: 260, onComplete: () => l.dim?.destroy() });
    if (!prefs().reducedMotion) this.cameras.main.zoomTo(1, 260);
    await this.wait(240);
    if (v.alive) {
      v.setDepth(DEPTH.units + v.spot.y);
      v.applyState('idle');
    }
  }

  private async present(e: BattleEvent): Promise<void> {
    const reduced = prefs().reducedMotion;
    const noFlash = reduced || prefs().reduceFlash;
    switch (e.type) {
      case 'turn_start': {
        await this.settleAction();
        const v = this.view(e.actor);
        v.setHighlight(true);
        this.time.delayedCall(450, () => v.setHighlight(false));
        if (v.side === 'enemy') await this.wait(220);
        break;
      }
      case 'turn_skipped': {
        this.float(this.view(e.actor), '◆ STAGGERED', T.crimson, 34);
        await this.wait(400);
        break;
      }
      case 'skill_used': {
        await this.settleAction();
        if (this.telegraphText.text) this.telegraphText.setText('');
        this.activeSkillType = e.skillType;
        const v = this.view(e.actor);
        const actorUnit = this.battle.unit(e.actor);
        const def = this.skillDef(e.actor, e.skill);
        const ult = e.skillType === 'ultimate';
        const element = def?.element ?? actorUnit.def.element;
        const state = e.skillType === 'ultimate' ? 'ultimate' : e.skillType === 'active' ? 'active' : 'basic';
        v.applyState(state);
        let dim: Phaser.GameObjects.Rectangle | null = null;
        const roleLower = actorUnit.def.role.toLowerCase();
        const isCaster =
          def?.player_target === 'ally' ||
          actorUnit.def.formation_affinity === 'rear' ||
          /support|healer|mage|caster|arcan|bell|alchem|ranged|seer|choir/.test(roleLower);
        const opp = e.targets.map((t) => this.views.get(t)).find((t) => t && t.side !== v.side);

        if (ult) {
          Sfx.ultimate();
          if (!noFlash) {
            dim = this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x07040c, 0).setDepth(DEPTH.units + 1100);
            this.tweens.add({ targets: dim, alpha: 0.58, duration: 240 });
            v.setDepth(DEPTH.units + 1150);
            this.cameras.main.zoomTo(1.06, 280);
          }
          let portraitKey: string | null = null;
          try {
            const pk = Services.ready().art.portrait(actorUnit.def.unit_id, 'neutral');
            if (pk && this.textures.exists(pk)) portraitKey = pk;
          } catch {
            /* fallback to chibi sprite frame */
          }
          const poseSpr = v.pose();
          await BattleVfx.ultimateCutIn(this, {
            unitName: actorUnit.def.name_en,
            skillName: def?.name_en ?? e.skill,
            element,
            side: v.side,
            portraitKey,
            spriteKey: poseSpr.texture.key,
            spriteFrame: String(poseSpr.frame.name),
          });
          v.playCast(true);
          for (const tid of e.targets) {
            const tv = this.views.get(tid);
            if (!tv) continue;
            if (tv.side !== v.side) BattleVfx.pillarEruption(this, tv.x, tv.y, element);
            else BattleVfx.castSigil(this, tv.x, tv.y - 12, element, 1.3);
          }
          this.lunged = { view: v, dim };
          await this.wait(320);
        } else {
          void this.banner(def?.name_en ?? e.skill, false);
          if (v.side === 'player' && actorUnit.def.unit_id === 'fadyme') Sfx.cast();
          this.lunged = { view: v, dim: null };
          if (opp && !isCaster) {
            const strikeX = opp.x + (v.side === 'player' ? -135 : 135);
            const strikeY = opp.y;
            await v.playDashTo(strikeX, strikeY);
          } else if (opp && isCaster) {
            v.playCast(false);
            await BattleVfx.projectile(this, v.x + (v.side === 'player' ? 40 : -40), v.hitPoint.y, opp.hitPoint.x, opp.hitPoint.y, element, e.skillType === 'active');
          } else {
            v.playCast(false);
            this.ringPulse(v.x, v.y - 120, ELEMENT_COLOR[element] ?? C.silver, 175);
            await this.wait(280);
          }
        }
        break;
      }
      case 'damage': {
        const t = this.view(e.target);
        const src = this.views.get(e.source);
        const element = src ? this.battle.unit(src.id).def.element : 'Veil';
        const heavy = e.crit || this.activeSkillType === 'ultimate' || e.amount >= 4;
        if (e.amount > 0 && t.animState !== 'defeat') t.applyState('hit');
        if (e.amount > 0) {
          t.flash(0xffffff, 110);
          t.playHitReaction(heavy);
        }
        const slashStyle = e.crit || this.activeSkillType === 'ultimate' ? 'heavy' : this.activeSkillType === 'active' ? 'cross' : 'single';
        BattleVfx.slashImpact(this, t.hitPoint.x, t.hitPoint.y, element, slashStyle, (src?.x ?? 0) <= t.x);
        BattleVfx.hitImpact(this, t.hitPoint.x, t.hitPoint.y, element, e.crit, heavy);
        Sfx.hit(heavy);
        if (e.counter) this.float(t, 'COUNTER', T.gold, 30, -60);
        if (e.redirectedFrom) this.float(t, 'INTERCEPT', T.gold, 28, 70);
        if (e.amount > 0) this.float(t, e.crit ? `-${e.amount}!` : `-${e.amount}`, e.crit ? T.crit : e.counter ? T.gold : '#ffffff', e.crit ? 64 : 46);
        if (e.absorbed > 0) this.float(t, e.amount === 0 ? '⛨ BLOCKED' : `(${e.absorbed} absorbed)`, T.shield, 30, e.amount === 0 ? 0 : 80);
        t.setHp(e.hpAfter, this.battle.unit(e.target).maxHp);
        if (!reduced && (e.crit || this.activeSkillType === 'ultimate') && !noFlash) {
          this.cameras.main.shake(200, e.crit ? 0.008 : 0.006);
        }
        await this.wait(e.crit ? 360 : 270);
        if (t.alive && t.animState === 'hit') t.applyState('idle');
        break;
      }
      case 'heal': {
        const t = this.view(e.target);
        this.float(t, `+${e.amount}`, T.heal, 44);
        BattleVfx.castSigil(this, t.x, t.y - 10, 'Gale', 1.0);
        this.burst(t.hitPoint.x, t.hitPoint.y, 0x8fe3a0, 12);
        Sfx.heal();
        t.setHp(e.hpAfter, this.battle.unit(e.target).maxHp);
        await this.wait(260);
        break;
      }
      case 'shield': {
        const t = this.view(e.target);
        this.float(t, `⛨ +${e.amount} SHIELD`, T.shield, 34);
        BattleVfx.castSigil(this, t.x, t.y - 10, 'Dawn', 1.0);
        this.ringPulse(t.hitPoint.x, t.hitPoint.y, C.shield, 130);
        Sfx.guard();
        await this.wait(200);
        break;
      }
      case 'status_applied': {
        const t = this.view(e.target);
        const s = this.statusNames.get(e.status);
        const cue = s?.category === 'buff' ? '▲ ' : s?.category === 'control' ? '◆ ' : '▼ ';
        BattleVfx.castSigil(this, t.x, t.y - 10, s?.category === 'buff' ? 'Dawn' : 'Veil', 0.9);
        this.float(t, `${cue}${(s?.name ?? e.status).toUpperCase()}`, s?.category === 'buff' ? T.shield : T.crimson, 32, 0);
        await this.wait(190);
        break;
      }
      case 'status_removed': {

        if (e.reason === 'cleansed') this.float(this.view(e.target), 'CLEANSED', T.heal, 30);
        break;
      }
      case 'stat_mod': {
        this.float(this.view(e.target), `${e.stat.replace('_', ' ').toUpperCase()} ${e.amount >= 0 ? '▲' : '▼'}`, T.shield, 26, 0);
        break;
      }
      case 'focus': {
        const v = this.view(e.unit);
        v.setFocus(e.total);
        if (e.total >= 100 && e.delta > 0 && v.side === 'player') {
          this.float(v, 'ULTIMATE READY', T.gold, 30);
          Sfx.bell(880, 0.12, 0.9);
        }
        break;
      }
      case 'redirect_granted': {
        this.float(this.view(e.protector), 'GUARDING', T.gold, 30);
        break;
      }
      case 'hook_triggered': {
        const def = this.skillDef(e.unit, e.skill);
        if (def) this.float(this.view(e.unit), def.name_en.toUpperCase(), T.gold, 26, 0);
        await this.wait(160);
        break;
      }
      case 'defeat': {
        const v = this.view(e.unit);
        v.markDead();
        v.applyState('defeat');
        Sfx.defeat();
        if (v.side === 'enemy') {
          this.tweens.add({ targets: v, alpha: 0, y: v.y + 24, duration: 700, delay: 350, ease: 'Sine.easeIn' });
          v.fadePlate(900);
        }
        await this.wait(560);
        break;
      }
      case 'hp_cost': {
        const v = this.view(e.unit);
        this.float(v, `-${e.amount} HP`, T.crimson, 30);
        v.setHp(e.hpAfter, this.battle.unit(e.unit).maxHp);
        await this.wait(200);
        break;
      }
      case 'blocked': {
        this.float(this.view(e.unit), 'BLOCKED', T.shield, 40);
        Sfx.guard();
        await this.wait(240);
        break;
      }
      case 'delay': {
        this.float(this.view(e.unit), 'DELAYED', T.crimson, 30);
        await this.wait(160);
        break;
      }
      case 'shield_removed': {
        this.float(this.view(e.unit), 'SHIELD BROKEN', T.crimson, 28);
        await this.wait(160);
        break;
      }
      case 'buff_copied': {
        this.float(this.view(e.target), 'COPIED', T.gold, 28);
        await this.wait(160);
        break;
      }
      case 'reaction': {
        this.float(this.view(e.unit), e.name.toUpperCase(), T.gold, 32);
        await this.wait(200);
        break;
      }
      case 'phase_change': {
        const v = this.view(e.unit);
        v.setHp(e.hp, e.maxHp);
        const name = this.battle.unit(e.unit).def.boss?.phases.find((p) => p.phase_id === e.phase)?.name_en ?? e.phase;
        if (this.battle.log.filter((x) => x.type === 'phase_change').length > 1) {
          void this.banner(`Phase: ${name}`, true);
          if (!reduced) this.cameras.main.shake(260, 0.008);
          await this.wait(700);
        }
        await this.phaseStory(e.unit, e.phase);
        break;
      }
      case 'telegraph': {
        const v = this.view(e.unit);
        this.float(v, `⚠ ${e.skillName.toUpperCase()}`, T.crimson, 34);
        this.telegraphText.setText(`⚠ ${v.unitName.toUpperCase()} PREPARES ${e.skillName.toUpperCase()}`);
        Sfx.guard();
        await this.wait(420);
        break;
      }
      case 'telegraph_cancelled': {
        this.float(this.view(e.unit), 'INTERRUPTED', T.gold, 42);
        this.telegraphText.setText('');
        await this.wait(380);
        break;
      }
      case 'objective_destroyed': {
        const o = [...this.views.values()].find((x) => x.artKey === e.objective);
        if (o) this.float(o, 'DESTROYED', T.gold, 38);
        break;
      }
      case 'summon': {
        await this.addSummoned(e.unit);
        break;
      }
      case 'battle_start':
      case 'battle_end':
      case 'round_end':
        break;
    }
  }

  // ------------------------------------------------------------------ result

  private async finish(): Promise<void> {
    const result = this.battle.result;
    if (!result) return;
    this.refreshHud();
    this.clearSkillPanel();
    const won = result.winner === 'player';
    if (won) {
      for (const v of this.views.values()) {
        if (v.side === 'player' && v.alive) {
          v.applyState('victory');
          BattleVfx.castSigil(this, v.x, v.y - 10, 'Dawn', 1.15);
          this.burst(v.x, v.y - 80, 0xffe680, 14);
          if (!prefs().reducedMotion) {
            this.tweens.add({
              targets: v,
              y: v.y - 16,
              duration: 380,
              yoyo: true,
              repeat: 2,
              ease: 'Sine.easeOut'
            });
          }
        }
      }
      Sfx.victory();
    } else {
      Sfx.lose();
    }
    await this.wait(650);
    if (this.dead) return;

    // Keep the battlefield & celebrating heroes on the left (x = 220..680) completely visible!
    const dim = this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x07040c, 0).setDepth(DEPTH.modal).setInteractive();
    this.tweens.add({ targets: dim, alpha: won ? 0.14 : 0.42, duration: 360 });

    const cardX = won ? 1330 : REF_W / 2;
    const cardY = 536;
    const cardW = 840;
    const cardH = 520;
    const box = panel(this, cardX, cardY, cardW, cardH, won ? 'hot' : 'danger').setDepth(DEPTH.modal + 1);

    title(this, cardX, cardY - 196, won ? 'VICTORY' : 'DEFEAT', 66, won ? T.gold : T.crimson).setDepth(DEPTH.modal + 2);
    txt(this, cardX, cardY - 142, `${this.encounter.stage_id}  ·  ${this.encounter.title_en}`, {
      fontFamily: F.display,
      fontSize: '22px',
      fontStyle: '600',
      color: '#dfd6ec'
    })
      .setOrigin(0.5)
      .setDepth(DEPTH.modal + 2);

    // Animated 1-3 Stars shown in ALL battles (tutorial & campaign) based on unit casualties
    const starY = cardY - 64;
    for (let i = 0; i < 3; i++) {
      const filled = won && i < result.stars;
      const sx = cardX + (i - 1) * 116;
      const starG = this.add.graphics({ x: sx, y: starY }).setDepth(DEPTH.modal + 2);
      starG.fillStyle(filled ? C.goldHi : 0x1e1326, filled ? 1 : 0.65);
      starG.lineStyle(3, filled ? 0xfff3b8 : C.gold, filled ? 1 : 0.35);
      const pts: Phaser.Math.Vector2[] = [];
      for (let k = 0; k < 10; k++) {
        const r = k % 2 === 0 ? 42 : 18;
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        pts.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r));
      }
      starG.fillPoints(pts, true);
      starG.strokePoints(pts, true);
      if (filled && !prefs().reducedMotion) {
        starG.setScale(0.1);
        this.tweens.add({
          targets: starG,
          scale: 1,
          duration: 380,
          delay: 130 * i,
          ease: 'Back.easeOut',
          onStart: () => {
            this.burst(sx, starY, 0xffe680, 8);
            Sfx.bell(660 + i * 110, 0.08, 0.5);
          }
        });
      }
    }

    const playerUnits = this.battle.combatants.filter((c) => c.side === 'player');
    const totalPlayers = playerUnits.length;
    const alivePlayers = playerUnits.filter((c) => c.alive).length;
    const fallenPlayers = Math.max(0, totalPlayers - alivePlayers);
    const survivalSummary = won
      ? `${alivePlayers}/${totalPlayers} HEROES STANDING  ·  ${fallenPlayers === 0 ? 'NO CASUALTIES (3★)' : `${fallenPlayers} FALLEN (${result.stars}★)`}`
      : `0/${totalPlayers} HEROES STANDING  ·  PARTY DEFEATED`;

    txt(this, cardX, cardY + 12, survivalSummary, {
      fontFamily: F.display,
      fontSize: '23px',
      fontStyle: '700',
      color: won ? T.gold : T.crimson
    })
      .setOrigin(0.5)
      .setDepth(DEPTH.modal + 2);

    txt(this, cardX, cardY + 48, `${result.turns} turns  ·  ${this.recorded.length} actions  ·  5-Unit Rule: 0-2 Fallen 3★ | 3 Fallen 2★ | 4 Fallen 1★`, {
      fontSize: '20px',
      color: T.dim
    })
      .setOrigin(0.5)
      .setDepth(DEPTH.modal + 2);

    // Chapter Star Milestone Reward Pill
    const rewardTrack = this.add.graphics().setDepth(DEPTH.modal + 2);
    rewardTrack.fillStyle(0x12091c, 0.46);
    rewardTrack.lineStyle(1.5, C.gold, 0.45);
    rewardTrack.fillRoundedRect(cardX - 380, cardY + 76, 760, 48, 24);
    rewardTrack.strokeRoundedRect(cardX - 380, cardY + 76, 760, 48, 24);
    txt(this, cardX, cardY + 100, `CHAPTER STAR CHESTS:  ★ 3 SILVER CACHE  ·  ★ 6 RELIC CHEST  ·  ★ 9 CALLING EMBER`, {
      fontFamily: F.display,
      fontSize: '15px',
      fontStyle: '600',
      color: '#e3c37d'
    })
      .setOrigin(0.5)
      .setDepth(DEPTH.modal + 3);

    const tutorial = this.cfg.tutorial === true;
    if (!tutorial) {
      const verify = txt(this, cardX, cardY + 142, 'Server verification: checking…', { fontSize: '21px', color: T.dim }).setOrigin(0.5).setDepth(DEPTH.modal + 2);
      this.verifyLabel = verify;
      if (this.cfg.sessionId || this.encounter.party_mode === 'owned') verify.setText('Server verification: at the progress claim');
      else void this.verifyOnServer(verify);
      if (won) {
        if (Services.api.signedIn && this.cfg.nodeId) {
          this.claimPromise = this.claimProgress(result.stars);
        } else {
          this.claimConfirmed = true;
          this.cfg.onClaimed?.(result.stars);
        }
      }
    } else if (won) {
      this.claimConfirmed = true;
      this.cfg.onClaimed?.(result.stars);
    }

    const btnY = cardY + 198;
    const primary = new Button(this, tutorial && won ? cardX : cardX - 185, btnY, {
      label: won ? 'CONTINUE' : 'RETRY',
      w: 340,
      h: 76,
      fontSize: 26,
      variant: won ? 'hot' : 'normal',
      onClick: () => {
        if (!won) {
          if (this.cfg.onRetry) this.cfg.onRetry(this);
          else this.scene.restart(this.cfg);
          return;
        }
        void this.onContinue(result.stars);
      }
    }).setDepth(DEPTH.modal + 2);
    this.primaryBtn = primary;
    if (!(tutorial && won)) {
      new Button(this, cardX + 185, btnY, {
        label: tutorial ? 'BACK TO STORY' : 'LEAVE',
        w: 340,
        h: 76,
        fontSize: 26,
        onClick: () => this.cfg.onBack(this)
      }).setDepth(DEPTH.modal + 2);
    }
    void box;
    void primary;
  }

  private async onContinue(stars: number): Promise<void> {
    if (this.claimPromise) {
      this.primaryBtn?.setLabel('SAVING…').setEnabled(false);
      await this.claimPromise;
    }
    if (!this.claimConfirmed) {
      this.primaryBtn?.setLabel('SAVING…').setEnabled(false);
      this.claimPromise = this.claimProgress(stars);
      const ok = await this.claimPromise;
      if (!ok) return;
    }
    if (!this.dead) {
      this.cfg.onDone(this, { won: true, stars });
    }
  }

  /** Signed-in players: the server re-simulates the win again, pays Ration and grants the stage rewards. */
  private async claimProgress(stars: number): Promise<boolean> {
    const api = Services.api;
    if (!api.signedIn || !this.cfg.nodeId) {
      this.claimConfirmed = true;
      this.cfg.onClaimed?.(stars);
      return true;
    }
    try {
      const { content } = Services.ready();
      const r = await api.submitBattle(this.cfg.releaseId ?? await content.activeReleaseId(), this.cfg.nodeId, this.recorded, this.cfg.sessionId);
      if (this.dead) return false;
      this.claimConfirmed = true;
      this.cfg.onClaimed?.(stars);
      if (this.primaryBtn?.active) this.primaryBtn.setLabel('CONTINUE').setEnabled(true);
      if (this.verifyLabel?.active && (this.cfg.sessionId || this.encounter.party_mode === 'owned')) {
        this.verifyLabel.setText('Server verification: ✓ progress saved to your account').setColor(T.heal);
      }
      const names = r.rewards.length ? await api.catalogNames(this.cfg.releaseId ?? await content.activeReleaseId()).catch(() => new Map<string, string>()) : new Map<string, string>();
      const gained = r.rewards.length ? ` · rewards: ${r.rewards.map((a) => describeAttachment(a, names)).join(', ')}` : '';
      const saved = r.repeatRewardsAllowed === false ? 'Free practice recorded · one-time rewards only' : 'Progress saved to your account';
      toast(this, `${saved}${gained}`);
      return true;
    } catch (e) {
      this.claimConfirmed = false;
      if (!this.dead) {
        if (this.primaryBtn?.active) this.primaryBtn.setLabel('RETRY SAVE').setEnabled(true);
        if (this.verifyLabel?.active) this.verifyLabel.setText('Server verification: ✗ progress not saved — retry').setColor(T.crimson);
        toast(this, e instanceof Error ? `Progress not saved: ${e.message}` : 'Progress not saved');
      }
      return false;
    } finally {
      this.claimPromise = null;
    }
  }


  /** Asks the Worker to re-simulate the battle; the client result is only accepted if hashes agree. */
  private async verifyOnServer(label: Phaser.GameObjects.Text): Promise<void> {
    try {
      const { content } = Services.ready();
      const logHash = await sha256Hex(canonicalJson(this.battle.log));
      const res = await fetch(`${API_BASE}/api/v1/battles/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ releaseId: await content.activeReleaseId(), encounterPath: this.cfg.encounterPath, actions: this.recorded, clientLogHash: logHash })
      });
      if (res.status === 404) {
        // the server is reachable but this content release is not published there (e.g. a fresh environment)
        if (label.active) label.setText('Server verification: this release is not published on the server').setColor(T.dim);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = (await res.json()) as { valid: boolean; match: boolean; logHash: string };
      if (this.dead || !label.active) return;
      if (out.valid && out.match) label.setText(`Server verification: ✓ replay matches (${out.logHash.slice(0, 10)})`).setColor(T.heal);
      else label.setText('Server verification: ✗ replay rejected').setColor(T.crimson);
    } catch {
      if (label.active) label.setText('Server verification: unavailable offline').setColor(T.dim);
    }
  }
}
void hex;
