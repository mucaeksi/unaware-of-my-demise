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
        art.loadPortraits(this, playerUnitIds, neutralEmotions).catch(() => undefined),
        this.encounter.music_cue ? art.loadMusic(this, this.encounter.music_cue) : Promise.resolve()
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
    sceneFadeIn(this, 600);
    const m = this.encounter.music_cue ? art.music(this.encounter.music_cue) : null;
    if (m) Music.play(this.cache.audio, m.key, m.loopStart, m.duration, 1.6);
    await this.wait(500);
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
    const bg = this.add.image(REF_W / 2, 0, art.background(this.encounter.location_id)).setOrigin(0.5, 0).setDepth(DEPTH.bg);
    bg.setScale(Math.max(REF_W / bg.width, REF_H / bg.height));
    const grade = this.add.graphics().setDepth(DEPTH.bg + 2);
    grade.fillGradientStyle(0x0a0610, 0x0a0610, 0x0a0610, 0x0a0610, 0.35, 0.35, 0.65, 0.65);
    grade.fillRect(0, 0, REF_W, REF_H);
    if (q.vignette) {
      try {
        this.cameras.main.filters.external.addVignette(0.5, 0.5, 0.82, 0.3);
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
      const list = this.battle.combatants.filter((c) => c.side === side);
      for (const row of ['front', 'rear'] as const) {
        const inRow = list.filter((c) => c.row === row).sort((a, b) => a.slot - b.slot);
        inRow.forEach((c, i) => {
          const spot = spotFor(side, row, i, inRow.length, this.layoutPreset, insetX);
          const v = new UnitView(this, art, { id: c.id, name: c.def.name_en, side, artKey: defs.get(c.def.unit_id)?.art_key ?? c.def.unit_id, element: c.def.element, maxHp: c.maxHp, hp: c.hp, spot }, prefs().reducedMotion);
          v.setDepth(DEPTH.units + spot.y);
          v.on('pointerup', () => this.onUnitTapped(v));
          this.views.set(c.id, v);
        });
      }
    }
  }

  // ------------------------------------------------------------------ HUD

  private buildHud(): void {
    const insets = safeInsets(this);
    const spec = battleLayoutSpec(this.layoutPreset);
    // top-left: stage title; centre-left: turn order
    title(this, 60 + insets.left, 62 + insets.top, `${this.encounter.stage_id}  ·  ${this.encounter.title_en}`, 36, T.gold).setOrigin(0, 0.5).setDepth(DEPTH.hud);
    this.chipLayer = this.add.container(0, 0).setDepth(DEPTH.hud);
    txt(this, 60 + insets.left, 122 + insets.top, 'TURN ORDER', { fontFamily: F.display, fontSize: '20px', color: T.dim }).setDepth(DEPTH.hud);

    // the encounter's ui block can hide the speed and Auto buttons (the opening tutorials are manual, one turn at a time)
    const ui = this.encounter.ui ?? { speed: true, auto: true };
    let edge = REF_W - 150 - insets.right;
    const btnY = 70 + insets.top;
    if (ui.speed) {
      this.speedBtn = new Button(this, edge, btnY, { label: '×1', w: 190, h: 100, fontSize: 36, onClick: () => this.toggleSpeed() }).setDepth(DEPTH.hud);
      edge -= 215;
    }
    if (ui.auto) {
      this.autoBtn = new Button(this, edge, btnY, { label: 'AUTO', w: 210, h: 100, fontSize: 30, onClick: () => this.toggleAuto() }).setDepth(DEPTH.hud);
      edge -= 220;
    }
    new Button(this, edge, btnY, { label: 'MENU', w: 210, h: 100, fontSize: 30, onClick: () => this.openMenu() }).setDepth(DEPTH.hud);

    // between the title block and the speed/auto/menu buttons there is free room at the top: the turn hint lives there
    this.descText = txt(this, REF_W / 2, spec.descY - insets.bottom, '', { fontSize: '28px', color: T.text, align: 'center', wordWrap: { width: 1640 - insets.left - insets.right } }).setOrigin(0.5).setDepth(DEPTH.hud);
    this.hintText = txt(this, 830, 62 + insets.top, '', { fontFamily: F.display, fontSize: '28px', fontStyle: '600', color: T.gold, stroke: '#0a0610', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.hud);
    this.telegraphText = txt(this, REF_W - 60 - insets.right, 150 + insets.top, '', { fontFamily: F.display, fontSize: '30px', fontStyle: '700', color: T.crimson, stroke: '#0a0610', strokeThickness: 5 }).setOrigin(1, 0.5).setDepth(DEPTH.hud);
    this.refreshHud();
  }

  private refreshHud(): void {
    if (this.dead) return;
    const insets = safeInsets(this);
    const spec = battleLayoutSpec(this.layoutPreset);
    const order = this.battle.result ? [] : this.battle.previewOrder(8);
    this.chipLayer.removeAll(true);
    this.chips = [];
    order.forEach((id, i) => {
      const c = this.battle.unit(id);
      const x = 120 + insets.left + i * 108;
      const ring = this.add.circle(0, 0, 40, 0x120a18, 0.95).setStrokeStyle(4, c.side === 'player' ? C.player : C.enemy, i === 0 ? 1 : 0.7);
      const letter = txt(this, 0, -2, c.def.name_en.charAt(0).toUpperCase(), { fontFamily: F.display, fontSize: '36px', fontStyle: '700', color: c.side === 'player' ? '#cfe0ff' : '#ffb3c4' }).setOrigin(0.5);
      const chip = this.add.container(x, spec.turnOrderY + insets.top, [ring, letter]);
      if (i === 0) chip.setScale(1.15);
      this.chipLayer.add(chip);
      this.chips.push(chip);
    });
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
    const list = this.battle.combatants.filter((c) => c.side === side);
    for (const row of ['front', 'rear'] as const) {
      const inRow = list.filter((c) => c.row === row).sort((a, b) => a.slot - b.slot);
      inRow.forEach((c, i) => {
        const v = this.views.get(c.id);
        if (!v) return;
        const spot = spotFor(side, row, i, inRow.length, this.layoutPreset, insetX);
        v.glideTo(spot);
        v.setDepth(DEPTH.units + spot.y);
      });
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
      for (const v of this.views.values()) if (v.side === 'player' && v.alive) v.applyState('victory');
      Sfx.victory();
    } else {
      Sfx.lose();
    }
    await this.wait(700);
    if (this.dead) return;

    const dim = this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x07040c, 0).setDepth(DEPTH.modal).setInteractive();
    this.tweens.add({ targets: dim, alpha: 0.72, duration: 400 });
    const box = panel(this, REF_W / 2, REF_H / 2, 1180, 700, won ? 'hot' : 'danger').setDepth(DEPTH.modal + 1);
    title(this, REF_W / 2, 310, won ? 'VICTORY' : 'DEFEAT', 96, won ? T.gold : T.crimson).setDepth(DEPTH.modal + 2);
    const tutorial = this.cfg.tutorial === true;
    if (!tutorial) {
      const stars = this.add.graphics().setDepth(DEPTH.modal + 2);
      for (let i = 0; i < 3; i++) {
        const filled = i < result.stars;
        stars.fillStyle(filled ? C.goldHi : 0x2a1e32, 1);
        stars.lineStyle(3, C.gold, filled ? 1 : 0.4);
        const cx = REF_W / 2 + (i - 1) * 130;
        const cy = 460;
        const pts: Phaser.Math.Vector2[] = [];
        for (let k = 0; k < 10; k++) {
          const r = k % 2 === 0 ? 52 : 22;
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
        }
        stars.fillPoints(pts, true);
        stars.strokePoints(pts, true);
      }
    }
    txt(this, REF_W / 2, tutorial ? 500 : 560, `${result.turns} turns  ·  ${this.recorded.length} actions`, { fontSize: '34px', color: T.dim }).setOrigin(0.5).setDepth(DEPTH.modal + 2);
    if (!tutorial) {
      const verify = txt(this, REF_W / 2, 618, 'Server verification: checking…', { fontSize: '30px', color: T.dim }).setOrigin(0.5).setDepth(DEPTH.modal + 2);
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

    const primary = new Button(this, tutorial && won ? REF_W / 2 : REF_W / 2 - 250, 760, {
      label: won ? 'CONTINUE' : 'RETRY',
      w: 440,
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
    if (!(tutorial && won)) new Button(this, REF_W / 2 + 250, 760, { label: tutorial ? 'BACK TO STORY' : 'LEAVE', w: 440, onClick: () => this.cfg.onBack(this) }).setDepth(DEPTH.modal + 2);
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
