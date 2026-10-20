import * as PIXI from 'pixi.js';
import { Battle, type BattleEvent, type PlayerAction, type SkillOption, type TurnPrompt } from '@uomd/combat';
import type { BattleParty, Encounter, SkillDef, UnitPack } from '@uomd/content-schema';
import { canonicalJson, sha256Hex } from '@uomd/shared';
import { API_BASE, REF_H, REF_W } from '../config';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { activeBattleLayout, battleLayoutSpec, spotFor, type BattleLayoutPreset } from '../battle/formation';
import { BattleVfx } from '../battle/BattleVfx';
import { UnitView } from '../battle/UnitView';
import { PixiScene } from '../core/PixiScene';
import { announce } from '../platform/a11y';
import { qualityProfile } from '../platform/graphics';
import { prefs, setPref, type Prefs } from '../platform/prefs';
import { safeInsets } from '../platform/safeArea';
import { describeAttachment } from '../ui/format';
import { Services } from '../services';
import { blocker, Button, panel, sceneFadeIn, title, toast, txt, verticalShade, vignette, type UiText } from '../ui/pixiKit';
import { C, DEPTH, F, SIZE, T } from '../ui/theme';
import { attachLivingBackdrop } from '../vfx/livingBackdrop';
import { Sparks } from '../vfx/sparks';
import { vfxTextures } from '../vfx/textures';
import { app } from '../core/app';

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
  onDone: (scene: PixiScene<unknown>, outcome: BattleOutcome) => void;
  onBack: (scene: PixiScene<unknown>) => void;
  /** Owned stages use the frozen party; all signed-in stages use a frozen release session. */
  party?: BattleParty;
  sessionId?: string;
  /** Financial submission stays bound to the release used when the battle started. */
  releaseId?: string;
  /** a lost owned-hero battle needs a fresh server session, so retrying goes back through the flow */
  onRetry?: (scene: PixiScene<unknown>) => void;
  /** opening tutorial: no stars, no server verification line, retreat goes back to the story before the fight */
  tutorial?: boolean;
  /** optional layout preset override (A: current, B: arena_lite, C: afk_faithful) */
  layout?: BattleLayoutPreset;
}

const ELEMENT_COLOR: Record<string, number> = { Veil: C.veil, Stone: 0xe0d2b0, Ember: 0xff8a4c, Tide: 0x6cc4ff, Gale: 0x9be8c3, Dawn: 0xffe9a8 };

/** circular turn-order medallions, cached per art texture (its key carries the content hash) and side */
const avatars = new Map<string, PIXI.Texture>();

type Combatant = Battle['combatants'][number];

/** Turn-based battle, drawn with PIXI (D-25). Combat rules, RNG and the server replay live in @uomd/combat. */
export class BattleScene extends PixiScene<BattleInit> {
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
  private lunged: { view: UnitView; dim: PIXI.Graphics | null } | null = null;
  private sparks: Sparks | null = null;
  private chipLayer = new PIXI.Container();
  private skillLayer: PIXI.Container | null = null;
  private hintBg = new PIXI.Graphics();
  private descBg = new PIXI.Graphics();
  private descText!: UiText;
  private hintText!: UiText;
  private telegraphText!: UiText;
  private autoBtn: Button | null = null;
  private speedBtn: Button | null = null;
  private pendingResolve: ((a: PlayerAction) => void) | null = null;
  private bannerBox: PIXI.Container | null = null;
  private menuLayer: PIXI.Container | null = null;
  private optionsLayer: PIXI.Container | null = null;
  private skillButtons = new Map<string, { btn: Button; baseY: number; defaultVariant: 'normal' | 'hot' }>();
  private claimPromise: Promise<boolean> | null = null;
  private claimConfirmed = false;
  private primaryBtn: Button | null = null;
  private verifyLabel: UiText | null = null;
  private selected: SkillOption | null = null;
  private submit: ((a: PlayerAction) => void) | null = null;
  private activeSkillType: 'basic' | 'active' | 'ultimate' | 'passive' | 'signature' = 'basic';

  async create(data: BattleInit): Promise<void> {
    this.cfg = data;
    const { content, art } = Services.ready();
    this.onClose(() => (this.dead = true));
    try {
      this.encounter = await content.encounter(this.cfg.encounterPath);
      this.pack = await content.unitPack();
      this.battle = Battle.create(this.pack, this.encounter, this.cfg.party);
      const defs = new Map(this.pack.units.map((u) => [u.unit_id, u]));
      // breakable objectives are combatants too: their art keys come from the battle itself
      const artKeys = this.battle.combatants.map((c) => defs.get(c.def.unit_id)?.art_key ?? c.def.art_key);
      const playerUnitIds = this.battle.combatants.filter((c) => c.side === 'player').map((c) => c.def.unit_id);
      const cutInEmotions = new Map(playerUnitIds.map((id) => [id, new Set(['neutral', 'composed', 'determined', 'protective'])]));
      const musicCue = this.encounter.music_cue ?? 'bgm_battle_field';
      await Promise.all([
        art.loadBackground(this, this.encounter.location_id),
        art.loadUnits(this, artKeys),
        art.loadPortraits(this, playerUnitIds, cutInEmotions).catch(() => undefined),
        art.loadMusic(this, musicCue).catch(() => undefined)
      ]);
    } catch (e) {
      if (!this.live) return;
      this.add(title(REF_W / 2, REF_H / 2 - 40, 'This battle could not be loaded', SIZE.h2, T.crimson));
      this.add(txt(REF_W / 2, REF_H / 2 + 30, String(e instanceof Error ? e.message : e), { fontSize: 30, color: T.dim, wordWrap: { width: 1400 }, align: 'center' }, 0.5));
      this.add(new Button(this, REF_W / 2, REF_H / 2 + 200, { label: 'BACK', w: 360, onClick: () => this.cfg.onBack(this) }));
      return;
    }
    if (!this.live) return;
    for (const s of this.pack.rules.statuses) this.statusNames.set(s.status_id, { name: s.name_en, category: s.category });
    this.buildWorld();
    this.buildHud();
    sceneFadeIn(this, 1200);
    const playBattleMusic = (fade = 1.2): void => {
      const m = art.music(this.encounter.music_cue ?? 'bgm_battle_field');
      if (m) Music.play(m.key, m.loopStart, m.duration, fade);
    };
    playBattleMusic(1.2);
    // a WebView may start with audio suspended until the first touch
    const resumeAudio = (): void => {
      Sfx.resume();
      playBattleMusic(0.8);
    };
    const canvas = app().canvas;
    canvas.addEventListener('pointerdown', resumeAudio);
    this.onClose(() => canvas.removeEventListener('pointerdown', resumeAudio));
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
    const reduced = prefs().reducedMotion;
    const insets = safeInsets();
    const insetX = Math.max(insets.left, insets.right);
    const bg = this.add(new PIXI.Sprite(this.tex(art.background(this.encounter.location_id))), DEPTH.bg);
    bg.anchor.set(0.5);
    bg.position.set(REF_W / 2, REF_H / 2);
    const cover = Math.max(REF_W / (bg.texture.width || REF_W), REF_H / (bg.texture.height || REF_H)) * 1.07;
    bg.scale.set(cover);
    attachLivingBackdrop(this, bg, { baseScale: cover, fxDepth: DEPTH.bg + 1, mood: 'battle', intensity: 1.05 });
    this.add(verticalShade(0, 0, REF_W, 240, 0x0a0610, 0.28, 0.04), DEPTH.bg + 2);
    this.add(verticalShade(0, REF_H - 320, REF_W, 320, 0x0a0610, 0.04, 0.62), DEPTH.bg + 2);
    if (q.vignette) this.add(vignette(0.85, 0.24), DEPTH.hud - 100);
    this.sparks = this.add(new Sparks(vfxTextures().spark), DEPTH.fx);
    this.onTick((dt) => this.sparks?.update(dt));
    if (!reduced && q.particles && q.particleDensity > 0) {
      const dust = this.add(new Sparks(vfxTextures().spark), DEPTH.fx - 50);
      dust.ambient({ every: Math.round(220 / q.particleDensity), area: { x: [0, REF_W], y: [200, 900] }, vx: [-8, 10], vy: [-14, -4], look: { lifespan: 7000, scale: [0.12, 0], alpha: [0.35, 0], tint: 0xcbb8e8 } });
      this.onTick((dt) => dust.update(dt));
    }

    const defs = new Map(this.pack.units.map((u) => [u.unit_id, u]));
    for (const side of ['player', 'enemy'] as const) {
      for (const { c, visualRow, indexInRow, countInRow } of this.visualFormationForSide(side)) {
        const spot = spotFor(side, visualRow, indexInRow, countInRow, this.layoutPreset, insetX);
        this.addView(c, defs.get(c.def.unit_id)?.art_key ?? c.def.unit_id, spot);
      }
    }
  }

  private addView(c: Combatant, artKey: string, spot: ReturnType<typeof spotFor>): UnitView {
    const { art } = Services.ready();
    const v = new UnitView(this, art, { id: c.id, name: c.def.name_en, side: c.side, artKey, element: c.def.element, maxHp: c.maxHp, hp: c.hp, spot }, prefs().reducedMotion, (tapped) => this.onUnitTapped(tapped));
    this.views.set(c.id, v);
    return v;
  }

  /**
   * Distributes a side's combatants into the canonical 2-Front + 3-Rear visual formation.
   * When an encounter defines >2 units in `front` and <3 in `rear` (e.g. 3 enemies all tagged `front`),
   * excess units overflow into the `rear` visual column so every battle displays a true 3-back / 2-front formation.
   */
  private visualFormationForSide(side: 'player' | 'enemy'): { c: Combatant; visualRow: 'front' | 'rear'; indexInRow: number; countInRow: number }[] {
    const list = this.battle.combatants.filter((c) => c.side === side).sort((a, b) => a.slot - b.slot);
    const rawFront = list.filter((c) => c.row === 'front');
    const rawRear = list.filter((c) => c.row === 'rear');
    const tanksFirst = (cs: Combatant[]): Combatant[] =>
      [...cs].sort((a, b) => {
        const aTank = /pilgrim|knight|tank|guard|bulwark/i.test(a.def.unit_id + ' ' + a.def.role) ? 0 : 1;
        const bTank = /pilgrim|knight|tank|guard|bulwark/i.test(b.def.unit_id + ' ' + b.def.role) ? 0 : 1;
        return aTank - bTank || a.slot - b.slot;
      });
    let front: Combatant[];
    let rear: Combatant[];
    if (rawFront.length >= 2 && rawRear.length === 0) {
      // 2-unit or 3+-unit all-front waves: front (up to 2, or 1 when <=3 total) + rear (up to 3)
      const sorted = tanksFirst(rawFront);
      const frontCap = rawFront.length <= 3 ? 1 : 2;
      front = sorted.slice(0, frontCap);
      rear = sorted.slice(frontCap);
    } else if (rawFront.length > 2 && rawRear.length < 3) {
      const sorted = tanksFirst(rawFront);
      front = sorted.slice(0, 2);
      rear = [...sorted.slice(2), ...rawRear];
    } else {
      front = rawFront;
      rear = rawRear;
    }
    return [
      ...front.map((c, i) => ({ c, visualRow: 'front' as const, indexInRow: i, countInRow: front.length })),
      ...rear.map((c, i) => ({ c, visualRow: 'rear' as const, indexInRow: i, countInRow: rear.length }))
    ];
  }

  /** 96x96 circular mini-portrait medallion for the turn-order bar */
  private unitAvatar(artKey: string, side: 'player' | 'enemy'): PIXI.Texture {
    const { art } = Services.ready();
    const u = art.unit(artKey);
    const idle = art.frameFor(artKey, 'idle');
    const key = `${idle.key}|${idle.frame}|${side}`;
    const hit = avatars.get(key);
    if (hit && !hit.destroyed) return hit;
    const frame = this.tex(idle.key, idle.frame);
    const src = frame.source.resource as CanvasImageSource | undefined;
    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return frame;
    const cx = size / 2;
    const cy = size / 2;
    const r = 42;

    // 1. dark gothic circular backdrop
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    const bgGrad = ctx.createRadialGradient(cx, cy - 10, 6, cx, cy, r);
    bgGrad.addColorStop(0, side === 'player' ? '#2a1f3d' : '#3a1728');
    bgGrad.addColorStop(1, side === 'player' ? '#0e0816' : '#12070e');
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // 2. head/bust crop clipped to the circle: SD chibis are two heads tall, the top ~60% of idle is head and shoulders
    ctx.clip();
    if (src && frame !== PIXI.Texture.EMPTY) {
      const { x: fx, y: fy, width: fw, height: fh } = frame.frame;
      const cropH = Math.max(1, Math.round(fh * 0.6));
      const cropW = Math.min(fw, Math.round(cropH * 1.05));
      const cropX = fx + Math.max(0, Math.round((fw - cropW) * 0.5));
      ctx.save();
      ctx.translate(cx, cy + 4);
      if ((u.facing === 'right') !== (side === 'player')) ctx.scale(-1, 1);
      const drawSize = r * 2.08;
      ctx.drawImage(src, cropX, fy, cropW, cropH, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      ctx.restore();
    }
    const vig = ctx.createRadialGradient(cx, cy, r * 0.62, cx, cy, r);
    vig.addColorStop(0, 'rgba(10,6,16,0)');
    vig.addColorStop(1, 'rgba(10,6,16,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    // 3. dual metallic bezel
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

    const tex = PIXI.Texture.from(canvas);
    avatars.set(key, tex);
    return tex;
  }

  // ------------------------------------------------------------------ HUD

  private buildHud(): void {
    const insets = safeInsets();
    const spec = battleLayoutSpec(this.layoutPreset);
    // top-left: stage title; the circular portrait turn order sits right below it
    const head = this.add(title(60 + insets.left, 54 + insets.top, `${this.encounter.stage_id}  ·  ${this.encounter.title_en}`, 32, T.gold), DEPTH.hud);
    head.anchor.set(0, 0.5);
    this.add(this.chipLayer, DEPTH.hud);

    // the encounter's ui block can hide the speed and Auto buttons (the opening tutorials are manual, one turn at a time)
    const ui = this.encounter.ui ?? { speed: true, auto: true };
    let edge = REF_W - 140 - insets.right;
    const btnY = 66 + insets.top;
    if (ui.speed) {
      this.speedBtn = this.add(new Button(this, edge, btnY, { label: '×1', w: 156, h: 72, fontSize: 28, onClick: () => this.toggleSpeed() }), DEPTH.hud);
      edge -= 176;
    }
    if (ui.auto) {
      this.autoBtn = this.add(new Button(this, edge, btnY, { label: 'AUTO', w: 176, h: 72, fontSize: 24, onClick: () => this.toggleAuto() }), DEPTH.hud);
      edge -= 192;
    }
    this.add(new Button(this, edge, btnY, { label: 'MENU', w: 176, h: 72, fontSize: 24, onClick: () => this.openMenu() }), DEPTH.hud);

    // the turn hint lives in the free room between the title block and the speed/auto/menu buttons
    this.add(this.hintBg, DEPTH.hud - 1);
    this.add(this.descBg, DEPTH.hud - 1);
    this.descText = this.add(txt(REF_W / 2, spec.descY - 6 - insets.bottom, '', { fontSize: 20, color: T.text, align: 'center', lineSpacing: 3, wordWrap: { width: Math.min(1360, 1560 - insets.left - insets.right) }, stroke: '#0a0610', strokeThickness: 3 }, 0.5), DEPTH.hud);
    this.hintText = this.add(txt(REF_W / 2, 54 + insets.top, '', { fontFamily: F.display, fontSize: 24, fontStyle: '600', color: T.gold, stroke: '#0a0610', strokeThickness: 4 }, 0.5), DEPTH.hud);
    this.telegraphText = this.add(txt(REF_W - 60 - insets.right, 136 + insets.top, '', { fontFamily: F.display, fontSize: 26, fontStyle: '700', color: T.crimson, stroke: '#0a0610', strokeThickness: 5 }, [1, 0.5]), DEPTH.hud);
    this.refreshHud();
  }

  private updateHudPills(): void {
    this.hintBg.clear();
    if (this.hintText.text.trim()) {
      const w = Math.max(280, Math.min(720, this.hintText.width + 56));
      const h = 42;
      this.hintBg.chamferRect(this.hintText.x - w / 2, this.hintText.y - h / 2, w, h, 10).fill({ color: 0x0c0714, alpha: 0.86 }).stroke({ width: 1.5, color: C.gold, alpha: 0.62 });
    }
    this.descBg.clear();
    if (this.descText.text.trim()) {
      const w = Math.max(420, Math.min(1440, this.descText.width + 52));
      const h = Math.max(36, this.descText.height + 14);
      this.descBg.chamferRect(this.descText.x - w / 2, this.descText.y - h / 2, w, h, 10).fill({ color: 0x0c0714, alpha: 0.84 }).stroke({ width: 1.2, color: C.gold, alpha: 0.45 });
    }
  }

  private refreshHud(): void {
    if (this.dead) return;
    const insets = safeInsets();
    const spec = battleLayoutSpec(this.layoutPreset);
    const order = this.battle.result ? [] : this.battle.previewOrder(8);
    for (const c of this.chipLayer.removeChildren()) c.destroy({ children: true });
    if (order.length > 0) {
      const barY = spec.turnOrderY + insets.top;
      const barX = 60 + insets.left;
      const stepX = 54;
      const barW = 92 + order.length * stepX;
      const barH = 54;
      const track = new PIXI.Graphics().chamferRect(barX, barY - barH / 2, barW, barH, 12).fill({ color: 0x0c0714, alpha: 0.82 }).stroke({ width: 1.5, color: C.gold, alpha: 0.52 });
      this.chipLayer.addChild(track, txt(barX + 42, barY, 'TURN', { fontFamily: F.display, fontSize: 14, fontStyle: '700', color: T.gold }, 0.5));
      const defs = new Map(this.pack.units.map((u) => [u.unit_id, u]));
      order.forEach((id, i) => {
        const c = this.battle.unit(id);
        const current = i === 0;
        const chip = new PIXI.Container();
        chip.position.set(barX + 98 + i * stepX, barY);
        if (current) chip.addChild(new PIXI.Graphics().circle(0, 0, 26).fill({ color: C.goldHi, alpha: 0.22 }).stroke({ width: 2.5, color: C.goldHi, alpha: 0.95 }));
        const avatar = new PIXI.Sprite(this.unitAvatar(defs.get(c.def.unit_id)?.art_key ?? c.def.unit_id, c.side));
        avatar.anchor.set(0.5);
        avatar.scale.set(current ? 0.52 : 0.42);
        chip.addChild(avatar);
        if (current) chip.addChild(txt(0, -25, '▼', { fontSize: 13, color: T.gold, stroke: '#0a0610', strokeThickness: 3 }, 0.5));
        this.chipLayer.addChild(chip);
      });
    }
    // enemy intents and status badges (with shape cues ▲/▼/◆/⛨)
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
    this.anim.timeScale = this.speed;
    this.speedBtn?.setLabel(`×${this.speed}`).setVariant(this.speed > 1 ? 'active' : 'normal');
  }

  private toggleAuto(): void {
    this.auto = !this.auto;
    this.autoBtn?.setLabel('AUTO').setVariant(this.auto ? 'active' : 'normal');
    if (this.auto && this.pendingResolve) this.pendingResolve(this.battle.autoAction());
  }

  private openMenu(): void {
    if (this.menuLayer) return;
    const layer = new PIXI.Container();
    layer.addChild(
      blocker(0x000000, 0.72),
      panel(REF_W / 2, REF_H / 2, 740, 640, 'normal'),
      title(REF_W / 2, 305, 'PAUSED', 48, T.gold),
      new Button(this, REF_W / 2, 435, { label: 'RESUME', w: 520, h: 92, fontSize: 28, onClick: () => this.closeMenu() }),
      new Button(this, REF_W / 2, 565, {
        label: 'OPTIONS',
        sub: 'Audio, Graphics & Gameplay Settings',
        w: 520,
        h: 92,
        fontSize: 28,
        onClick: () => this.openOptionsModal()
      }),
      new Button(this, REF_W / 2, 695, {
        label: 'RETREAT',
        sub: 'Leave the battle',
        w: 520,
        h: 92,
        fontSize: 28,
        variant: 'danger',
        onClick: () => {
          this.closeMenu();
          this.dead = true;
          this.cfg.onBack(this);
        }
      })
    );
    this.menuLayer = this.add(layer, DEPTH.modal);
    // the whole battle (timers, tweens, VFX) holds still under the pause menu
    this.anim.timeScale = 0.0001;
  }

  private closeMenu(): void {
    this.closeOptionsModal();
    this.menuLayer?.destroy({ children: true });
    this.menuLayer = null;
    this.anim.timeScale = this.speed;
  }

  private openOptionsModal(): void {
    this.closeOptionsModal();
    const layer = new PIXI.Container();
    const cx = REF_W / 2;
    const cy = REF_H / 2;
    layer.addChild(
      blocker(0x05020a, 0.85),
      panel(cx, cy, 1540, 880, 'normal'),
      title(cx, cy - 365, 'OPTIONS', 46, T.gold)
    );

    const stepVol = (key: 'musicVolume' | 'sfxVolume' | 'voiceVolume', d: number): void => {
      const next = Math.min(1, Math.max(0, +(prefs()[key] + d).toFixed(1)));
      setPref(key, next);
      if (key === 'musicVolume') Music.setVolume(next);
      if (key === 'sfxVolume') Sfx.setVolume(next);
    };

    const sliders: { label: string; get: () => string; dec: () => void; inc: () => void }[] = [
      { label: 'MUSIC VOLUME', get: () => `${Math.round(prefs().musicVolume * 100)}%`, dec: () => stepVol('musicVolume', -0.1), inc: () => stepVol('musicVolume', 0.1) },
      { label: 'SFX VOLUME', get: () => `${Math.round(prefs().sfxVolume * 100)}%`, dec: () => stepVol('sfxVolume', -0.1), inc: () => stepVol('sfxVolume', 0.1) },
      { label: 'VOICE VOLUME', get: () => `${Math.round(prefs().voiceVolume * 100)}%`, dec: () => stepVol('voiceVolume', -0.1), inc: () => stepVol('voiceVolume', 0.1) },
      {
        label: 'TEXT SPEED',
        get: () => prefs().textSpeed.toUpperCase(),
        dec: () => setPref('textSpeed', ({ slow: 'fast', normal: 'slow', fast: 'normal' } as const)[prefs().textSpeed]),
        inc: () => setPref('textSpeed', ({ slow: 'normal', normal: 'fast', fast: 'slow' } as const)[prefs().textSpeed])
      },
      {
        label: 'REDUCED MOTION',
        get: () => (prefs().reducedMotion ? 'ON' : 'OFF'),
        dec: () => setPref('reducedMotion', !prefs().reducedMotion),
        inc: () => setPref('reducedMotion', !prefs().reducedMotion)
      }
    ];

    sliders.forEach((s, i) => {
      const y = cy - 230 + i * 104;
      const lbl = txt(cx - 670, y, s.label, { fontFamily: F.display, fontSize: 24, fontStyle: '600', color: T.text });
      lbl.anchor.set(0, 0.5);
      const val = txt(cx - 120, y, s.get(), { fontFamily: F.display, fontSize: 28, fontStyle: '700', color: T.gold }, 0.5);
      const decBtn = new Button(this, cx - 260, y, {
        label: '−',
        w: 96,
        h: 72,
        fontSize: 34,
        onClick: () => {
          s.dec();
          val.text = s.get();
        }
      });
      const incBtn = new Button(this, cx + 20, y, {
        label: '+',
        w: 96,
        h: 72,
        fontSize: 34,
        onClick: () => {
          s.inc();
          val.text = s.get();
        }
      });
      layer.addChild(lbl, val, decBtn, incBtn);
    });

    const tiers: Prefs['qualityTier'][] = ['auto', 'low', 'medium', 'high'];
    const layouts: Prefs['battleLayout'][] = ['afk_faithful', 'current', 'arena_lite'];
    const layoutTag = (l: Prefs['battleLayout']): string => (l === 'afk_faithful' ? 'AFK' : l === 'arena_lite' ? 'ARENA' : 'CURRENT');

    const toggles: { label: () => string; sub: string; active: () => boolean; onClick: (btn: Button) => void }[] = [
      {
        label: () => `QUALITY: ${prefs().qualityTier.toUpperCase()}`,
        sub: 'Graphics Quality Tier',
        active: () => prefs().qualityTier === 'high',
        onClick: (btn) => {
          const next = tiers[(tiers.indexOf(prefs().qualityTier) + 1) % tiers.length]!;
          setPref('qualityTier', next);
          btn.setLabel(`QUALITY: ${next.toUpperCase()}`).setVariant(next === 'high' ? 'active' : 'normal');
        }
      },
      {
        label: () => `LAYOUT: ${layoutTag(prefs().battleLayout)}`,
        sub: 'Battle Formation Layout',
        active: () => prefs().battleLayout === 'afk_faithful',
        onClick: (btn) => {
          const next = layouts[(layouts.indexOf(prefs().battleLayout) + 1) % layouts.length]!;
          setPref('battleLayout', next);
          btn.setLabel(`LAYOUT: ${layoutTag(next)}`).setVariant(next === 'afk_faithful' ? 'active' : 'normal');
          this.relayout('player');
          this.relayout('enemy');
          this.refreshHud();
        }
      },
      {
        label: () => `TEXT SIZE: ${prefs().textSize.toUpperCase()}`,
        sub: 'Dialogue & HUD Readability',
        active: () => prefs().textSize === 'large',
        onClick: (btn) => {
          const next = prefs().textSize === 'normal' ? 'large' : 'normal';
          setPref('textSize', next);
          btn.setLabel(`TEXT SIZE: ${next.toUpperCase()}`).setVariant(next === 'large' ? 'active' : 'normal');
        }
      },
      {
        label: () => `FLASH: ${prefs().reduceFlash ? 'REDUCED' : 'NORMAL'}`,
        sub: 'Screen Flash Intensity',
        active: () => prefs().reduceFlash,
        onClick: (btn) => {
          setPref('reduceFlash', !prefs().reduceFlash);
          btn.setLabel(`FLASH: ${prefs().reduceFlash ? 'REDUCED' : 'NORMAL'}`).setVariant(prefs().reduceFlash ? 'active' : 'normal');
        }
      },
      {
        label: () => `CONTRAST: ${prefs().highContrast ? 'HIGH' : 'STANDARD'}`,
        sub: 'High Contrast Borders',
        active: () => prefs().highContrast,
        onClick: (btn) => {
          setPref('highContrast', !prefs().highContrast);
          btn.setLabel(`CONTRAST: ${prefs().highContrast ? 'HIGH' : 'STANDARD'}`).setVariant(prefs().highContrast ? 'active' : 'normal');
        }
      }
    ];

    toggles.forEach((t, i) => {
      const y = cy - 230 + i * 104;
      const btn = new Button(this, cx + 410, y, {
        label: t.label(),
        sub: t.sub,
        w: 480,
        h: 82,
        fontSize: 22,
        variant: t.active() ? 'active' : 'normal',
        onClick: () => t.onClick(btn)
      });
      layer.addChild(btn);
    });

    layer.addChild(
      new Button(this, cx, cy + 345, {
        label: 'BACK TO MENU',
        w: 440,
        h: 86,
        fontSize: 26,
        variant: 'hot',
        onClick: () => this.closeOptionsModal()
      })
    );

    this.optionsLayer = this.add(layer, DEPTH.modal + 5);
  }

  private closeOptionsModal(): void {
    this.optionsLayer?.destroy({ children: true });
    this.optionsLayer = null;
  }

  // ------------------------------------------------------------------ main loop

  private wait(ms: number): Promise<void> {
    if (this.dead) return Promise.resolve();
    return this.anim.wait(ms);
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
        let settled = false;
        this.onClose(() => {
          if (settled) return;
          settled = true;
          this.nav.stop('Story');
          resolve();
        });
        const done = (back = false): void => {
          if (settled) return;
          settled = true;
          this.nav.stop('Story');
          this.nav.resume();
          if (back) this.cfg.onBack(this);
          else {
            const { art } = Services.ready();
            const music = this.encounter.music_cue ? art.music(this.encounter.music_cue) : null;
            if (music) Music.play(music.key, music.loopStart, music.duration);
          }
          resolve();
        };
        this.nav.launch('Story', { path, onDone: () => done(), onBack: () => done(true) });
        this.nav.bringToTop('Story');
        this.nav.pause();
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

  private buildSkillPanel(prompt: TurnPrompt, submit: (a: PlayerAction) => void): void {
    this.clearSkillPanel();
    this.submit = submit;
    this.selected = null;
    const insets = safeInsets();
    const spec = battleLayoutSpec(this.layoutPreset);
    const actor = this.battle.unit(prompt.actor);
    const layer = new PIXI.Container();
    const n = prompt.options.length;
    const w = 286;
    const h = 88;
    const gap = 36;
    const x0 = REF_W / 2 - ((n - 1) * (w + gap)) / 2;
    const barY = spec.skillBarY - insets.bottom;
    const passive = actor.def.skills.find((s) => s.type === 'passive');
    const turnBanner = `${actor.def.name_en.toUpperCase()}'S TURN`;
    this.hintText.text = turnBanner;
    announce(turnBanner);
    this.descText.text = passive ? `Passive — ${passive.name_en}: ${passive.description_en}` : '';
    this.descText.style.fill = '#dfd6ec';
    this.updateHudPills();

    // Subtle Gothic skill dock rail behind the compact tactical skill cards
    const dockW = n * w + (n - 1) * gap + 48;
    const dock = new PIXI.Graphics()
      .chamferRect(REF_W / 2 - dockW / 2, barY - h / 2 - 8, dockW, h + 16, 14)
      .fill({ color: 0x08040e, alpha: 0.62 })
      .stroke({ width: 1.5, color: C.gold, alpha: 0.35 });
    layer.addChild(dock);

    const reduced = prefs().reducedMotion;
    prompt.options.forEach((o, i) => {
      const isUlt = o.type === 'ultimate';
      const label = isUlt ? '★ ULTIMATE' : o.type === 'basic' ? 'BASIC' : 'SKILL';
      const sub = !o.available ? (o.reason === 'cooldown' ? `CD ${o.cooldownLeft}T` : `FOCUS ${actor.focus}/${o.def.focus_cost}`) : label;
      const defaultVariant: 'normal' | 'hot' = isUlt ? 'hot' : 'normal';
      const bx = x0 + i * (w + gap);

      // Glowing golden-crimson astrolabe aura behind a ready Ultimate button
      if (isUlt && o.available && !reduced) {
        const halo = new PIXI.Graphics();
        halo.chamferRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10, 14).stroke({ width: 2.5, color: C.goldHi, alpha: 0.85 });
        halo.position.set(bx, barY);
        layer.addChild(halo);
        this.anim.to(halo, { alpha: { from: 0.35, to: 0.95 }, scaleX: { from: 0.99, to: 1.03 }, scaleY: { from: 0.99, to: 1.05 } }, { duration: 760, yoyo: true, repeat: -1, ease: 'sine.inout' });
      }

      const b = new Button(this, bx, barY, {
        label: o.name.toUpperCase(),
        sub,
        w,
        h,
        fontSize: 22,
        variant: defaultVariant,
        onClick: () => this.onSkillTapped(o)
      });
      b.setEnabled(o.available);
      if (!reduced) {
        b.y = barY + 18;
        b.alpha = 0;
        this.anim.to(b, { y: barY, alpha: o.available ? 1 : 0.44 }, { duration: 210, delay: i * 45, ease: 'back.out' });
      }
      this.skillButtons.set(o.skillId, { btn: b, baseY: barY, defaultVariant });
      layer.addChild(b);
    });
    this.skillLayer = this.add(layer, DEPTH.hud);
  }

  private clearSkillPanel(): void {
    this.skillButtons.clear();
    this.skillLayer?.destroy({ children: true });
    this.skillLayer = null;
    this.selected = null;
    for (const v of this.views.values()) v.setSelectable(false);
    this.hintText.text = '';
    this.descText.text = '';
    this.updateHudPills();
  }

  private onSkillTapped(o: SkillOption): void {
    if (!o.available) return;
    if (this.selected?.skillId === o.skillId) {
      // second tap on the same skill confirms it when it needs no explicit target (or has one legal target)
      if (!o.needsTarget) return this.confirm({ skillId: o.skillId });
      if (o.legalTargets.length === 1) return this.confirm({ skillId: o.skillId, targetId: o.legalTargets[0] as string });
      return;
    }
    this.selected = o;
    Sfx.confirm();
    // Highlight the selected skill card with the 'active' variant and a subtle upward lift
    for (const [id, entry] of this.skillButtons) {
      const isSel = id === o.skillId;
      entry.btn.setVariant(isSel ? 'active' : entry.defaultVariant);
      if (!prefs().reducedMotion) {
        this.anim.to(entry.btn, { y: isSel ? entry.baseY - 8 : entry.baseY }, { duration: 150, ease: 'back.out' });
      }
    }
    for (const v of this.views.values()) v.setSelectable(false);
    this.descText.style.fill = T.text;
    this.descText.text = o.def.description_en;
    if (o.needsTarget) {
      this.hintText.text = o.legalTargets.length === 1 ? 'TAP THE SKILL AGAIN OR THE TARGET' : 'CHOOSE A TARGET';
      for (const id of o.legalTargets) this.views.get(id)?.setSelectable(true);
    } else {
      this.hintText.text = 'TAP AGAIN TO CAST';
    }
    this.updateHudPills();
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
    const insets = safeInsets();
    const c = this.battle.unit(id);
    const defs = new Map(this.pack.units.map((u) => [u.unit_id, u]));
    const artKey = defs.get(c.def.unit_id)?.art_key ?? c.def.art_key;
    await art.loadUnits(this, [artKey]);
    if (this.dead) return;
    const v = this.addView(c, artKey, spotFor(c.side, c.row, 0, 1, this.layoutPreset, Math.max(insets.left, insets.right)));
    this.relayout(c.side);
    BattleVfx.castSigil(this, v.x, v.y - 12, c.def.element, 1.2);
    this.float(v, 'REINFORCEMENTS', T.crimson, 34);
    await this.wait(420);
  }

  private relayout(side: 'player' | 'enemy'): void {
    const insets = safeInsets();
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

  private unit(id: string): UnitView {
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
    const t = this.add(txt(v.x + dx, v.headY + 70, text, { fontFamily: F.display, fontSize: size, fontStyle: '700', color, stroke: '#0a0610', strokeThickness: 6 }, 0.5), DEPTH.fx + 100);
    if (!prefs().reducedMotion) {
      t.scale.set(1.55);
      this.anim.to(t, { scale: 1 }, { duration: 220, ease: 'back.out' });
    }
    this.anim.to(t, { y: t.y - 115 }, { duration: 1100, ease: 'cubic.out' });
    this.anim.to(t, { alpha: 0 }, { delay: 520, duration: 580, ease: 'quad.in', onComplete: () => t.destroy() });
  }

  private burst(x: number, y: number, color: number, count = 14): void {
    const q = qualityProfile();
    if (prefs().reducedMotion || prefs().reduceFlash || !q.particles || q.particleDensity <= 0) return;
    this.sparks?.burst(x, y, Math.max(4, Math.round(count * q.particleDensity)), [90, 340], { lifespan: 520, scale: [0.55, 0], alpha: [1, 0], tint: color });
  }

  private ringPulse(x: number, y: number, color: number, radius = 150): void {
    if (prefs().reducedMotion || prefs().reduceFlash) return;
    const g = this.add(new PIXI.Graphics(), DEPTH.fx);
    const st = { r: 20 };
    this.anim.to(st, { r: radius }, {
      duration: 650,
      ease: 'cubic.out',
      onUpdate: () => {
        g.clear().circle(x, y, st.r).stroke({ width: 6, color, alpha: 0.9 });
        g.alpha = 1 - (st.r - 20) / (radius - 20);
      },
      onComplete: () => g.destroy()
    });
  }

  private banner(text: string, ultimate: boolean, activeSkill = false): void {
    this.bannerBox?.destroy({ children: true });
    const box = new PIXI.Container();
    const isHot = ultimate || activeSkill;
    box.addChild(
      panel(0, 0, Math.min(1100, 260 + text.length * 30), ultimate ? 120 : activeSkill ? 96 : 84, isHot ? 'hot' : 'normal'),
      title(0, 0, text.toUpperCase(), ultimate ? 52 : activeSkill ? 40 : 34, isHot ? T.gold : T.text)
    );
    box.position.set(REF_W / 2, 265);
    box.alpha = 0;
    box.scale.set(isHot ? 1.16 : 1.04);
    this.bannerBox = this.add(box, DEPTH.modal - 20);
    this.anim.to(box, { alpha: 1, y: 282, scaleX: 1, scaleY: 1 }, { duration: 190, ease: 'back.out' });
    this.anim.to(box, { alpha: 0 }, {
      delay: ultimate ? 900 : activeSkill ? 640 : 520,
      duration: 240,
      onComplete: () => {
        if (this.bannerBox === box) this.bannerBox = null;
        box.destroy({ children: true });
      }
    });
  }

  private async settleAction(): Promise<void> {
    const l = this.lunged;
    if (!l) return;
    this.lunged = null;
    const v = l.view;
    const moved = Math.hypot(v.x - v.spot.x, v.y - v.spot.y) > 4;
    if (v.alive && moved) v.applyState('walk');
    this.anim.to(v, { x: v.spot.x, y: v.spot.y }, { duration: 220, ease: 'quad.inout' });
    const dim = l.dim;
    if (dim) this.anim.to(dim, { alpha: 0 }, { duration: 260, onComplete: () => dim.destroy() });
    if (!prefs().reducedMotion) this.zoomTo(1, 260);
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
        const v = this.unit(e.actor);
        v.setHighlight(true);
        this.anim.after(450, () => v.setHighlight(false));
        if (v.side === 'enemy') await this.wait(220);
        break;
      }
      case 'turn_skipped': {
        this.float(this.unit(e.actor), '◆ STAGGERED', T.crimson, 34);
        await this.wait(400);
        break;
      }
      case 'skill_used': {
        await this.settleAction();
        if (this.telegraphText.text) this.telegraphText.text = '';
        this.activeSkillType = e.skillType;
        const v = this.unit(e.actor);
        const actorUnit = this.battle.unit(e.actor);
        const def = this.skillDef(e.actor, e.skill);
        const ult = e.skillType === 'ultimate';
        const element = def?.element ?? actorUnit.def.element;
        v.applyState(e.skillType === 'ultimate' ? 'ultimate' : e.skillType === 'active' ? 'active' : 'basic');
        let dim: PIXI.Graphics | null = null;
        const roleLower = actorUnit.def.role.toLowerCase();
        const isCaster = def?.player_target === 'ally' || actorUnit.def.formation_affinity === 'rear' || /support|healer|mage|caster|arcan|bell|alchem|ranged|seer|choir/.test(roleLower);
        const opp = e.targets.map((t) => this.views.get(t)).find((t) => t && t.side !== v.side);

        if (ult) {
          Sfx.ultimate();
          if (!noFlash) {
            dim = this.add(new PIXI.Graphics().rect(0, 0, REF_W, REF_H).fill(0x07040c), DEPTH.units + 1100);
            dim.alpha = 0;
            this.anim.to(dim, { alpha: 0.68 }, { duration: 240 });
            v.setDepth(DEPTH.units + 1150);
            this.zoomTo(1.075, 280);
          }
          v.playCast(true);
          let portraitKey: string | null = null;
          try {
            const artLib = Services.ready().art;
            const preferredEmotion = actorUnit.def.unit_id === 'fadyme' ? 'determined' : actorUnit.def.unit_id === 'mahmut' ? 'protective' : 'neutral';
            portraitKey = artLib.portrait(actorUnit.def.unit_id, preferredEmotion) ?? artLib.portrait(actorUnit.def.unit_id, 'composed');
          } catch {
            /* the cut-in falls back to the chibi pose */
          }
          await BattleVfx.ultimateCutIn(this, {
            unitId: actorUnit.def.unit_id,
            unitName: actorUnit.def.name_en,
            skillName: def?.name_en ?? e.skill,
            element,
            side: v.side,
            portraitKey,
            flipPortrait: v.side === 'player' ? actorUnit.def.unit_id === 'fadyme' : actorUnit.def.unit_id !== 'fadyme',
            poseTexture: v.poseTexture,
            casterPos: { x: v.x, y: v.y }
          });
          v.playCast(true);
          // Multi-wave cataclysmic Ultimate impact across all targets
          const elColor = ELEMENT_COLOR[element] ?? C.goldHi;
          this.ringPulse(v.x, v.hitPoint.y, elColor, 260);
          this.burst(v.x, v.hitPoint.y, elColor, 22);
          if (!noFlash) this.shake(260, 0.0085);
          const customUlt = BattleVfx.skillPreset(this, e.skill);
          if (customUlt) {
            for (const tid of e.targets) {
              const tv = this.views.get(tid);
              if (tv) {
                this.ringPulse(tv.x, tv.hitPoint.y, elColor, 220);
                this.burst(tv.hitPoint.x, tv.hitPoint.y, elColor, 18);
                void BattleVfx.playPreset(this, customUlt, { x: tv.x, y: tv.y, element, dir: v.side === 'player' ? 1 : -1 });
              }
            }
          } else {
            if (actorUnit.def.unit_id === 'fadyme') BattleVfx.silverBellRipple(this, v.x, v.hitPoint.y, 1.55);
            else if (actorUnit.def.unit_id === 'mahmut') BattleVfx.ironBulwarkWave(this, v.x, v.hitPoint.y, 1.5);
            for (const tid of e.targets) {
              const tv = this.views.get(tid);
              if (!tv) continue;
              this.ringPulse(tv.x, tv.hitPoint.y, elColor, 210);
              this.burst(tv.hitPoint.x, tv.hitPoint.y, elColor, 16);
              if (tv.side !== v.side) BattleVfx.pillarEruption(this, tv.x, tv.y, element, 1.25);
              else BattleVfx.castSigil(this, tv.x, tv.y - 12, element, 1.4);
            }
          }
          this.lunged = { view: v, dim };
          await this.wait(360);
        } else {
          const isActive = e.skillType === 'active';
          const elColor = ELEMENT_COLOR[element] ?? C.silver;
          this.banner(def?.name_en ?? e.skill, false, isActive);
          if (isActive) {
            if (!noFlash) this.zoomTo(1.035, 190);
            BattleVfx.castSigil(this, v.x, v.y - 8, element, 1.18, 560);
            this.ringPulse(v.x, v.hitPoint.y, elColor, 195);
            this.burst(v.x, v.hitPoint.y, elColor, 16);
          }
          const customSkill = BattleVfx.skillPreset(this, e.skill);
          if (customSkill) {
            if (opp && !isCaster) await v.playDashTo(opp.x + (v.side === 'player' ? -135 : 135), opp.y);
            else v.playCast(false);
            this.lunged = { view: v, dim: null };
            await BattleVfx.playPreset(this, customSkill, { x: v.x, y: v.hitPoint.y, element, dir: v.side === 'player' ? 1 : -1, ...(opp ? { target: { x: opp.hitPoint.x, y: opp.hitPoint.y } } : {}) });
            break;
          }
          if (v.side === 'player' && actorUnit.def.unit_id === 'fadyme') {
            Sfx.cast();
            BattleVfx.silverBellRipple(this, v.x, v.hitPoint.y, isActive ? 1.3 : 0.95);
          } else if (v.side === 'player' && actorUnit.def.unit_id === 'mahmut') {
            if (isActive) Sfx.shieldBash();
            BattleVfx.ironBulwarkWave(this, v.x, v.hitPoint.y, isActive ? 1.3 : 0.9);
          } else if (isActive) {
            Sfx.cast();
          }
          this.lunged = { view: v, dim: null };
          if (opp && !isCaster) {
            await v.playDashTo(opp.x + (v.side === 'player' ? -135 : 135), opp.y);
            if (isActive) {
              BattleVfx.pillarEruption(this, opp.x, opp.y, element, 0.95);
              this.ringPulse(opp.hitPoint.x, opp.hitPoint.y, elColor, 180);
            }
          } else if (opp && isCaster) {
            v.playCast(false);
            await BattleVfx.projectile(this, v.x + (v.side === 'player' ? 40 : -40), v.hitPoint.y, opp.hitPoint.x, opp.hitPoint.y, element, isActive);
            if (isActive) {
              BattleVfx.pillarEruption(this, opp.x, opp.y, element, 0.95);
              this.ringPulse(opp.hitPoint.x, opp.hitPoint.y, elColor, 180);
            }
          } else {
            v.playCast(false);
            this.ringPulse(v.x, v.y - 120, elColor, isActive ? 220 : 175);
            await this.wait(280);
          }
        }
        break;
      }
      case 'damage': {
        const t = this.unit(e.target);
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
        if (heavy && e.amount > 0) BattleVfx.hitStop(this, e.crit ? 65 : 48);
        Sfx.hit(heavy);
        if (e.counter) this.float(t, 'COUNTER', T.gold, 30, -60);
        if (e.redirectedFrom) this.float(t, 'INTERCEPT', T.gold, 28, 70);
        if (e.amount > 0) this.float(t, e.crit ? `-${e.amount}!` : `-${e.amount}`, e.crit ? T.crit : e.counter ? T.gold : '#ffffff', e.crit ? 64 : 46);
        if (e.absorbed > 0) this.float(t, e.amount === 0 ? '⛨ BLOCKED' : `(${e.absorbed} absorbed)`, T.shield, 30, e.amount === 0 ? 0 : 80);
        t.setHp(e.hpAfter, this.battle.unit(e.target).maxHp);
        if ((e.crit || this.activeSkillType === 'ultimate') && !noFlash) this.shake(200, e.crit ? 0.008 : 0.006);
        await this.wait(e.crit ? 360 : 270);
        if (t.alive && t.animState === 'hit') t.applyState('idle');
        break;
      }
      case 'heal': {
        const t = this.unit(e.target);
        this.float(t, `+${e.amount}`, T.heal, 44);
        BattleVfx.castSigil(this, t.x, t.y - 10, 'Gale', 1.0);
        this.burst(t.hitPoint.x, t.hitPoint.y, 0x8fe3a0, 12);
        Sfx.heal();
        t.setHp(e.hpAfter, this.battle.unit(e.target).maxHp);
        await this.wait(260);
        break;
      }
      case 'shield': {
        const t = this.unit(e.target);
        this.float(t, `⛨ +${e.amount} SHIELD`, T.shield, 34);
        BattleVfx.castSigil(this, t.x, t.y - 10, 'Dawn', 1.0);
        this.ringPulse(t.hitPoint.x, t.hitPoint.y, C.shield, 130);
        Sfx.guard();
        await this.wait(200);
        break;
      }
      case 'status_applied': {
        const t = this.unit(e.target);
        const s = this.statusNames.get(e.status);
        const cue = s?.category === 'buff' ? '▲ ' : s?.category === 'control' ? '◆ ' : '▼ ';
        BattleVfx.castSigil(this, t.x, t.y - 10, s?.category === 'buff' ? 'Dawn' : 'Veil', 0.9);
        this.float(t, `${cue}${(s?.name ?? e.status).toUpperCase()}`, s?.category === 'buff' ? T.shield : T.crimson, 32, 0);
        await this.wait(190);
        break;
      }
      case 'status_removed': {
        if (e.reason === 'cleansed') this.float(this.unit(e.target), 'CLEANSED', T.heal, 30);
        break;
      }
      case 'stat_mod': {
        this.float(this.unit(e.target), `${e.stat.replace('_', ' ').toUpperCase()} ${e.amount >= 0 ? '▲' : '▼'}`, T.shield, 26, 0);
        break;
      }
      case 'focus': {
        const v = this.unit(e.unit);
        v.setFocus(e.total);
        if (e.total >= 100 && e.delta > 0 && v.side === 'player') {
          this.float(v, 'ULTIMATE READY', T.gold, 30);
          Sfx.bell(880, 0.12, 0.9);
        }
        break;
      }
      case 'redirect_granted': {
        this.float(this.unit(e.protector), 'GUARDING', T.gold, 30);
        break;
      }
      case 'hook_triggered': {
        const def = this.skillDef(e.unit, e.skill);
        if (def) this.float(this.unit(e.unit), def.name_en.toUpperCase(), T.gold, 26, 0);
        await this.wait(160);
        break;
      }
      case 'defeat': {
        const v = this.unit(e.unit);
        v.markDead();
        v.applyState('defeat');
        Sfx.defeat();
        if (v.side === 'enemy') {
          this.anim.to(v, { alpha: 0, y: v.y + 24 }, { duration: 700, delay: 350, ease: 'sine.in' });
          v.fadePlate(900);
        }
        await this.wait(560);
        break;
      }
      case 'hp_cost': {
        const v = this.unit(e.unit);
        this.float(v, `-${e.amount} HP`, T.crimson, 30);
        v.setHp(e.hpAfter, this.battle.unit(e.unit).maxHp);
        await this.wait(200);
        break;
      }
      case 'blocked': {
        this.float(this.unit(e.unit), 'BLOCKED', T.shield, 40);
        Sfx.guard();
        await this.wait(240);
        break;
      }
      case 'delay': {
        this.float(this.unit(e.unit), 'DELAYED', T.crimson, 30);
        await this.wait(160);
        break;
      }
      case 'shield_removed': {
        this.float(this.unit(e.unit), 'SHIELD BROKEN', T.crimson, 28);
        await this.wait(160);
        break;
      }
      case 'buff_copied': {
        this.float(this.unit(e.target), 'COPIED', T.gold, 28);
        await this.wait(160);
        break;
      }
      case 'reaction': {
        this.float(this.unit(e.unit), e.name.toUpperCase(), T.gold, 32);
        await this.wait(200);
        break;
      }
      case 'phase_change': {
        const v = this.unit(e.unit);
        v.setHp(e.hp, e.maxHp);
        const name = this.battle.unit(e.unit).def.boss?.phases.find((p) => p.phase_id === e.phase)?.name_en ?? e.phase;
        if (this.battle.log.filter((x) => x.type === 'phase_change').length > 1) {
          this.banner(`Phase: ${name}`, true);
          if (!reduced) this.shake(260, 0.008);
          await this.wait(700);
        }
        await this.phaseStory(e.unit, e.phase);
        break;
      }
      case 'telegraph': {
        const v = this.unit(e.unit);
        this.float(v, `⚠ ${e.skillName.toUpperCase()}`, T.crimson, 34);
        this.telegraphText.text = `⚠ ${v.unitName.toUpperCase()} PREPARES ${e.skillName.toUpperCase()}`;
        Sfx.guard();
        await this.wait(420);
        break;
      }
      case 'telegraph_cancelled': {
        this.float(this.unit(e.unit), 'INTERRUPTED', T.gold, 42);
        this.telegraphText.text = '';
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

  private star(x: number, y: number, filled: boolean): PIXI.Graphics {
    const pts: number[] = [];
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? 42 : 18;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      pts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new PIXI.Graphics().poly(pts).fill({ color: filled ? C.goldHi : 0x1e1326, alpha: filled ? 1 : 0.65 }).stroke({ width: 3, color: filled ? 0xfff3b8 : C.gold, alpha: filled ? 1 : 0.35 });
    g.position.set(x, y);
    return g;
  }

  private async finish(): Promise<void> {
    const result = this.battle.result;
    if (!result) return;
    this.refreshHud();
    this.clearSkillPanel();
    const won = result.winner === 'player';
    if (won) {
      for (const v of this.views.values()) {
        if (v.side !== 'player' || !v.alive) continue;
        v.applyState('victory');
        BattleVfx.castSigil(this, v.x, v.y - 10, 'Dawn', 1.15);
        this.burst(v.x, v.y - 80, 0xffe680, 14);
      }
      Sfx.victory();
    } else {
      Sfx.lose();
    }
    await this.wait(650);
    if (this.dead) return;

    // the battlefield and the celebrating heroes on the left stay visible
    const dim = this.add(blocker(0x07040c, 0), DEPTH.modal);
    this.anim.to(dim, { alpha: won ? 0.14 : 0.42 }, { duration: 360 });

    const cardX = won ? 1170 : REF_W / 2;
    const cardY = 536;
    const card = new PIXI.Container();
    card.addChild(
      panel(cardX, cardY, won ? 920 : 980, 560, won ? 'hot' : 'danger'),
      title(cardX, cardY - 196, won ? 'VICTORY' : 'DEFEAT', 66, won ? T.gold : T.crimson),
      txt(cardX, cardY - 142, `${this.encounter.stage_id}  ·  ${this.encounter.title_en}`, { fontFamily: F.display, fontSize: 22, fontStyle: '600', color: '#dfd6ec' }, 0.5)
    );
    this.add(card, DEPTH.modal + 2);

    // 1-3 stars in every battle (tutorial and campaign) from unit casualties
    const starY = cardY - 64;
    for (let i = 0; i < 3; i++) {
      const filled = won && i < result.stars;
      const sx = cardX + (i - 1) * 116;
      const s = card.addChild(this.star(sx, starY, filled));
      if (filled && !prefs().reducedMotion) {
        s.scale.set(0.1);
        this.anim.to(s, { scale: 1 }, {
          duration: 380,
          delay: 130 * i,
          ease: 'back.out',
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
    const fallen = Math.max(0, totalPlayers - alivePlayers);
    const survival = won ? `${alivePlayers}/${totalPlayers} HEROES STANDING  ·  ${fallen === 0 ? 'NO CASUALTIES (3★)' : `${fallen} FALLEN (${result.stars}★)`}` : `0/${totalPlayers} HEROES STANDING  ·  PARTY DEFEATED`;
    card.addChild(
      txt(cardX, cardY + 12, survival, { fontFamily: F.display, fontSize: 23, fontStyle: '700', color: won ? T.gold : T.crimson }, 0.5),
      txt(cardX, cardY + 48, `${result.turns} turns  ·  ${this.recorded.length} actions  ·  5-Unit Rule: 0-2 Fallen 3★ | 3 Fallen 2★ | 4 Fallen 1★`, { fontSize: 20, color: T.dim }, 0.5),
      // chapter star milestone reward pill
      new PIXI.Graphics().roundRect(cardX - 380, cardY + 76, 760, 48, 24).fill({ color: 0x12091c, alpha: 0.46 }).stroke({ width: 1.5, color: C.gold, alpha: 0.45 }),
      txt(cardX, cardY + 100, 'CHAPTER STAR CHESTS:  ★ 3 SILVER CACHE  ·  ★ 6 RELIC CHEST  ·  ★ 9 CALLING EMBER', { fontFamily: F.display, fontSize: 15, fontStyle: '600', color: '#e3c37d' }, 0.5)
    );

    const tutorial = this.cfg.tutorial === true;
    if (!tutorial) {
      const verify = card.addChild(txt(cardX, cardY + 142, 'Server verification: checking…', { fontSize: 21, color: T.dim }, 0.5));
      this.verifyLabel = verify;
      if (this.cfg.sessionId || this.encounter.party_mode === 'owned') verify.text = 'Server verification: at the progress claim';
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

    const btnY = 760;
    this.primaryBtn = card.addChild(
      new Button(this, tutorial && won ? cardX : cardX - 230, btnY, {
        label: won ? 'CONTINUE' : 'RETRY',
        w: 410,
        h: 96,
        fontSize: 30,
        variant: won ? 'hot' : 'normal',
        onClick: () => {
          if (won) return void this.onContinue(result.stars);
          if (this.cfg.onRetry) this.cfg.onRetry(this);
          else this.nav.restart(this.cfg);
        }
      })
    );
    if (!(tutorial && won)) {
      card.addChild(new Button(this, cardX + 230, btnY, { label: tutorial ? 'BACK TO STORY' : 'LEAVE', w: 410, h: 96, fontSize: 30, onClick: () => this.cfg.onBack(this) }));
    }
  }

  private async onContinue(stars: number): Promise<void> {
    if (this.claimPromise) {
      this.primaryBtn?.setLabel('SAVING…').setEnabled(false);
      await this.claimPromise;
    }
    if (!this.claimConfirmed) {
      this.primaryBtn?.setLabel('SAVING…').setEnabled(false);
      this.claimPromise = this.claimProgress(stars);
      if (!(await this.claimPromise)) return;
    }
    if (!this.dead) this.cfg.onDone(this, { won: true, stars });
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
      const r = await api.submitBattle(this.cfg.releaseId ?? (await content.activeReleaseId()), this.cfg.nodeId, this.recorded, this.cfg.sessionId);
      if (this.dead) return false;
      this.claimConfirmed = true;
      this.cfg.onClaimed?.(stars);
      if (this.primaryBtn && !this.primaryBtn.destroyed) this.primaryBtn.setLabel('CONTINUE').setEnabled(true);
      if (this.verifyLabel && !this.verifyLabel.destroyed && (this.cfg.sessionId || this.encounter.party_mode === 'owned')) {
        this.verifyLabel.text = 'Server verification: ✓ progress saved to your account';
        this.verifyLabel.style.fill = T.heal;
      }
      const names = r.rewards.length ? await api.catalogNames(this.cfg.releaseId ?? (await content.activeReleaseId())).catch(() => new Map<string, string>()) : new Map<string, string>();
      const gained = r.rewards.length ? ` · rewards: ${r.rewards.map((a) => describeAttachment(a, names)).join(', ')}` : '';
      const saved = r.repeatRewardsAllowed === false ? 'Free practice recorded · one-time rewards only' : 'Progress saved to your account';
      if (this.live) toast(this, `${saved}${gained}`);
      return true;
    } catch (e) {
      this.claimConfirmed = false;
      if (!this.dead) {
        if (this.primaryBtn && !this.primaryBtn.destroyed) this.primaryBtn.setLabel('RETRY SAVE').setEnabled(true);
        if (this.verifyLabel && !this.verifyLabel.destroyed) {
          this.verifyLabel.text = 'Server verification: ✗ progress not saved — retry';
          this.verifyLabel.style.fill = T.crimson;
        }
        toast(this, e instanceof Error ? `Progress not saved: ${e.message}` : 'Progress not saved');
      }
      return false;
    } finally {
      this.claimPromise = null;
    }
  }

  /** Asks the Worker to re-simulate the battle; the client result is only accepted if hashes agree. */
  private async verifyOnServer(label: UiText): Promise<void> {
    const show = (text: string, color: string): void => {
      if (this.dead || label.destroyed) return;
      label.text = text;
      label.style.fill = color;
    };
    try {
      const { content } = Services.ready();
      const logHash = await sha256Hex(canonicalJson(this.battle.log));
      const res = await fetch(`${API_BASE}/api/v1/battles/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ releaseId: await content.activeReleaseId(), encounterPath: this.cfg.encounterPath, actions: this.recorded, clientLogHash: logHash })
      });
      // the server is reachable but this content release is not published there (e.g. a fresh environment)
      if (res.status === 404) return show('Server verification: this release is not published on the server', T.dim);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = (await res.json()) as { valid: boolean; match: boolean; logHash: string };
      if (out.valid && out.match) show(`Server verification: ✓ replay matches (${out.logHash.slice(0, 10)})`, T.heal);
      else show('Server verification: ✗ replay rejected', T.crimson);
    } catch {
      show('Server verification: unavailable offline', T.dim);
    }
  }
}

