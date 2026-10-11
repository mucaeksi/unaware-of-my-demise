import Phaser from 'phaser';
import { Battle, type BattleEvent, type PlayerAction, type SkillOption, type TurnPrompt } from '@uomd/combat';
import type { Encounter, SkillDef, UnitPack } from '@uomd/content-schema';
import { canonicalJson, sha256Hex } from '@uomd/shared';
import { API_BASE, REF_H, REF_W } from '../config';
import { Music } from '../audio/Music';
import { Sfx } from '../audio/Sfx';
import { spotFor } from '../battle/formation';
import { UnitView } from '../battle/UnitView';
import { prefs } from '../platform/prefs';
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
  onDone: (scene: Phaser.Scene, outcome: BattleOutcome) => void;
  onBack: (scene: Phaser.Scene) => void;
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
  private autoBtn!: Button;
  private speedBtn!: Button;
  private pendingResolve: ((a: PlayerAction) => void) | null = null;
  private bannerBox: Phaser.GameObjects.Container | null = null;
  private menuLayer: Phaser.GameObjects.Container | null = null;

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
      const defs = new Map(this.pack.units.map((u) => [u.unit_id, u]));
      const artKeys = [...this.encounter.party, ...this.encounter.enemies].map((e) => defs.get(e.unit_id)?.art_key ?? e.unit_id);
      await Promise.all([
        art.loadBackground(this, this.encounter.location_id),
        art.loadUnits(this, artKeys),
        this.encounter.music_cue ? art.loadMusic(this, this.encounter.music_cue) : Promise.resolve()
      ]);
    } catch (e) {
      title(this, REF_W / 2, REF_H / 2 - 40, 'This battle could not be loaded', SIZE.h2, T.crimson);
      txt(this, REF_W / 2, REF_H / 2 + 30, String(e instanceof Error ? e.message : e), { fontSize: '30px', color: T.dim, wordWrap: { width: 1400 }, align: 'center' }).setOrigin(0.5);
      new Button(this, REF_W / 2, REF_H / 2 + 200, { label: 'BACK', w: 360, onClick: () => this.cfg.onBack(this) });
      return;
    }
    for (const s of this.pack.rules.statuses) this.statusNames.set(s.status_id, { name: s.name_en, category: s.category });
    this.battle = Battle.create(this.pack, this.encounter);
    this.buildWorld();
    this.buildHud();
    sceneFadeIn(this, 600);
    const m = this.encounter.music_cue ? art.music(this.encounter.music_cue) : null;
    if (m) Music.play(this.cache.audio, m.key, m.loopStart, m.duration, 1.6);
    await this.wait(500);
    await this.loop();
  }

  // ------------------------------------------------------------------ world

  private buildWorld(): void {
    const { art } = Services.ready();
    const bg = this.add.image(REF_W / 2, 0, art.background(this.encounter.location_id)).setOrigin(0.5, 0).setDepth(DEPTH.bg);
    bg.setScale(Math.max(REF_W / bg.width, REF_H / bg.height));
    const grade = this.add.graphics().setDepth(DEPTH.bg + 2);
    grade.fillGradientStyle(0x0a0610, 0x0a0610, 0x0a0610, 0x0a0610, 0.35, 0.35, 0.65, 0.65);
    grade.fillRect(0, 0, REF_W, REF_H);
    try {
      this.cameras.main.filters.external.addVignette(0.5, 0.5, 0.82, 0.3);
    } catch {
      /* cosmetic */
    }
    if (!prefs().reducedMotion) {
      this.add.particles(0, 0, 'fx_spark', {
        x: { min: 0, max: REF_W },
        y: { min: 200, max: 900 },
        lifespan: 7000,
        speedY: { min: -14, max: -4 },
        speedX: { min: -8, max: 10 },
        scale: { start: 0.12, end: 0 },
        alpha: { start: 0.35, end: 0 },
        frequency: 220,
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
          const spot = spotFor(side, row, i, inRow.length);
          const v = new UnitView(this, art, { id: c.id, name: c.def.name_en, side, artKey: defs.get(c.def.unit_id)?.art_key ?? c.def.unit_id, maxHp: c.maxHp, hp: c.hp, spot }, prefs().reducedMotion);
          v.setDepth(DEPTH.units + spot.y);
          v.on('pointerup', () => this.onUnitTapped(v));
          this.views.set(c.id, v);
        });
      }
    }
  }

  // ------------------------------------------------------------------ HUD

  private buildHud(): void {
    // top-left: stage title; centre-left: turn order
    title(this, 60, 62, `${this.encounter.stage_id}  ·  ${this.encounter.title_en}`, 36, T.gold).setOrigin(0, 0.5).setDepth(DEPTH.hud);
    this.chipLayer = this.add.container(0, 0).setDepth(DEPTH.hud);
    txt(this, 60, 122, 'TURN ORDER', { fontFamily: F.display, fontSize: '20px', color: T.dim }).setDepth(DEPTH.hud);

    this.speedBtn = new Button(this, REF_W - 150, 70, { label: '×1', w: 190, h: 100, fontSize: 36, onClick: () => this.toggleSpeed() }).setDepth(DEPTH.hud);
    this.autoBtn = new Button(this, REF_W - 365, 70, { label: 'AUTO', w: 210, h: 100, fontSize: 30, onClick: () => this.toggleAuto() }).setDepth(DEPTH.hud);
    new Button(this, REF_W - 585, 70, { label: 'MENU', w: 210, h: 100, fontSize: 30, onClick: () => this.openMenu() }).setDepth(DEPTH.hud);

    // between the title block and the speed/auto/menu buttons there is free room at the top: the turn hint lives there
    this.descText = txt(this, REF_W / 2, 860, '', { fontSize: '28px', color: T.text, align: 'center', wordWrap: { width: 1640 } }).setOrigin(0.5).setDepth(DEPTH.hud);
    this.hintText = txt(this, 830, 62, '', { fontFamily: F.display, fontSize: '28px', fontStyle: '600', color: T.gold, stroke: '#0a0610', strokeThickness: 4 }).setOrigin(0.5).setDepth(DEPTH.hud);
    this.refreshHud();
  }

  private refreshHud(): void {
    if (this.dead) return;
    const order = this.battle.result ? [] : this.battle.previewOrder(8);
    this.chipLayer.removeAll(true);
    this.chips = [];
    order.forEach((id, i) => {
      const c = this.battle.unit(id);
      const x = 120 + i * 108;
      const ring = this.add.circle(0, 0, 40, 0x120a18, 0.95).setStrokeStyle(4, c.side === 'player' ? C.player : C.enemy, i === 0 ? 1 : 0.7);
      const letter = txt(this, 0, -2, c.def.name_en.charAt(0).toUpperCase(), { fontFamily: F.display, fontSize: '36px', fontStyle: '700', color: c.side === 'player' ? '#cfe0ff' : '#ffb3c4' }).setOrigin(0.5);
      const chip = this.add.container(x, 192, [ring, letter]);
      if (i === 0) chip.setScale(1.15);
      this.chipLayer.add(chip);
      this.chips.push(chip);
    });
    // enemy intents + status badges
    for (const [id, v] of this.views) {
      const c = this.battle.unit(id);
      v.setBadges(c, new Map([...this.statusNames].map(([k, s]) => [k, s.name])));
      if (c.side === 'enemy') {
        const intent = c.alive ? this.battle.intentFor(id) : null;
        const tgt = intent?.targetId ? this.battle.unit(intent.targetId).def.name_en.toUpperCase() : undefined;
        v.setIntent(intent ? intent.skillName.toUpperCase() : null, tgt);
      }
    }
  }

  private toggleSpeed(): void {
    this.speed = this.speed >= 3 ? 1 : this.speed + 1; // ×1 → ×2 → ×3 → ×1
    this.time.timeScale = this.speed;
    this.tweens.timeScale = this.speed;
    this.speedBtn.setLabel(`×${this.speed}`);
  }

  private toggleAuto(): void {
    this.auto = !this.auto;
    this.autoBtn.setLabel(this.auto ? 'AUTO ✓' : 'AUTO');
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
    const actor = this.battle.unit(prompt.actor);
    const items: Phaser.GameObjects.GameObject[] = [];
    const n = prompt.options.length;
    const w = 380;
    const gap = 24;
    const x0 = REF_W / 2 - ((n - 1) * (w + gap)) / 2;
    const passive = actor.def.skills.find((s) => s.type === 'passive');
    this.hintText.setText(`${actor.def.name_en.toUpperCase()}'S TURN`);
    this.descText.setText(passive ? `Passive — ${passive.name_en}: ${passive.description_en}` : '');
    this.descText.setColor(T.dim);
    prompt.options.forEach((o, i) => {
      const label = o.type === 'ultimate' ? 'ULTIMATE' : o.type === 'basic' ? 'BASIC' : 'SKILL';
      const sub = !o.available ? (o.reason === 'cooldown' ? `Cooldown ${o.cooldownLeft}` : `Focus ${actor.focus}/${o.def.focus_cost}`) : label;
      const b = new Button(this, x0 + i * (w + gap), 960, { label: o.name.toUpperCase(), sub, w, h: 128, fontSize: 28, variant: o.type === 'ultimate' ? 'hot' : 'normal', onClick: () => this.onSkillTapped(o, b) });
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

  // ------------------------------------------------------------------ presentation

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
    this.tweens.add({ targets: t, y: t.y - 110, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private burst(x: number, y: number, color: number, count = 14): void {
    if (prefs().reducedMotion) return;
    const em = this.add.particles(x, y, 'fx_spark', { speed: { min: 90, max: 340 }, angle: { min: 0, max: 360 }, scale: { start: 0.55, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 520, tint: color, blendMode: 'ADD', emitting: false }).setDepth(DEPTH.fx);
    em.explode(count);
    this.time.delayedCall(800, () => em.destroy());
  }

  private ringPulse(x: number, y: number, color: number, radius = 150): void {
    if (prefs().reducedMotion) return;
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
    if (v.alive) v.applyState('idle');
  }

  private async present(e: BattleEvent): Promise<void> {
    const reduced = prefs().reducedMotion;
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
        this.float(this.view(e.actor), 'STAGGERED', T.crimson, 34);
        await this.wait(400);
        break;
      }
      case 'skill_used': {
        await this.settleAction();
        const v = this.view(e.actor);
        const def = this.skillDef(e.actor, e.skill);
        const ult = e.skillType === 'ultimate';
        void this.banner(def?.name_en ?? e.skill, ult);
        const state = e.skillType === 'ultimate' ? 'ultimate' : e.skillType === 'active' ? 'active' : 'basic';
        v.applyState(state);
        let dim: Phaser.GameObjects.Rectangle | null = null;
        if (ult) {
          Sfx.ultimate();
          if (!reduced) {
            dim = this.add.rectangle(REF_W / 2, REF_H / 2, REF_W, REF_H, 0x07040c, 0).setDepth(DEPTH.units + 1100);
            this.tweens.add({ targets: dim, alpha: 0.55, duration: 260 });
            v.setDepth(DEPTH.units + 1150);
            this.cameras.main.zoomTo(1.05, 300);
          }
        } else if (v.side === 'player' && this.battle.unit(e.actor).def.unit_id === 'fadyme') {
          Sfx.cast();
        }
        const opp = e.targets.map((t) => this.views.get(t)).find((t) => t && t.side !== v.side);
        if (opp && !ult && !reduced) {
          const dx = Phaser.Math.Clamp((opp.x - v.x) * 0.55, -420, 420);
          this.tweens.add({ targets: v, x: v.x + dx, y: v.y + (opp.y - v.y) * 0.4, duration: 230, ease: 'Quad.easeOut' });
        }
        this.lunged = { view: v, dim };
        this.ringPulse(v.x, v.y - 120, ELEMENT_COLOR[def?.element ?? this.battle.unit(e.actor).def.element] ?? C.silver, ult ? 280 : 160);
        await this.wait(ult ? 650 : 300);
        break;
      }
      case 'damage': {
        const t = this.view(e.target);
        const src = this.views.get(e.source);
        const element = src ? this.battle.unit(src.id).def.element : 'Veil';
        const col = ELEMENT_COLOR[element] ?? 0xffffff;
        if (e.amount > 0 && t.animState !== 'defeat') t.applyState('hit');
        if (e.amount > 0) t.flash(0xffffff, 110);
        this.burst(t.hitPoint.x, t.hitPoint.y, col, e.crit ? 26 : 14);
        Sfx.hit(e.crit || e.amount >= 4);
        if (e.counter) this.float(t, 'COUNTER', T.gold, 30, -60);
        if (e.redirectedFrom) this.float(t, 'INTERCEPT', T.gold, 28, 70);
        if (e.amount > 0) this.float(t, e.crit ? `-${e.amount}!` : `-${e.amount}`, e.crit ? T.crit : e.counter ? T.gold : '#ffffff', e.crit ? 60 : 44);
        if (e.absorbed > 0) this.float(t, e.amount === 0 ? 'BLOCKED' : `(${e.absorbed} absorbed)`, T.shield, 30, e.amount === 0 ? 0 : 80);
        t.setHp(e.hpAfter, this.battle.unit(e.target).maxHp);
        if (!reduced) {
          const spr = t.pose();
          this.tweens.add({ targets: spr, x: { from: -10, to: 10 }, duration: 55, yoyo: true, repeat: 2, onComplete: () => spr.setX(0) });
          if (e.crit) this.cameras.main.shake(180, 0.006);
        }
        await this.wait(e.crit ? 360 : 270);
        if (t.alive && t.animState === 'hit') t.applyState('idle');
        break;
      }
      case 'heal': {
        const t = this.view(e.target);
        this.float(t, `+${e.amount}`, T.heal, 44);
        this.burst(t.hitPoint.x, t.hitPoint.y, 0x8fe3a0, 10);
        Sfx.heal();
        t.setHp(e.hpAfter, this.battle.unit(e.target).maxHp);
        await this.wait(260);
        break;
      }
      case 'shield': {
        const t = this.view(e.target);
        this.float(t, `+${e.amount} SHIELD`, T.shield, 34);
        this.ringPulse(t.hitPoint.x, t.hitPoint.y, C.shield, 120);
        Sfx.guard();
        await this.wait(200);
        break;
      }
      case 'status_applied': {
        const t = this.view(e.target);
        const s = this.statusNames.get(e.status);
        this.float(t, (s?.name ?? e.status).toUpperCase(), s?.category === 'buff' ? T.shield : T.crimson, 32, 0);
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
      case 'battle_start':
      case 'battle_end':
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
    txt(this, REF_W / 2, 560, `${result.turns} turns  ·  ${this.recorded.length} actions`, { fontSize: '34px', color: T.dim }).setOrigin(0.5).setDepth(DEPTH.modal + 2);
    const verify = txt(this, REF_W / 2, 618, 'Server verification: checking…', { fontSize: '30px', color: T.dim }).setOrigin(0.5).setDepth(DEPTH.modal + 2);
    void this.verifyOnServer(verify);
    if (won) void this.claimProgress();

    const primary = new Button(this, REF_W / 2 - 250, 760, { label: won ? 'CONTINUE' : 'RETRY', w: 440, onClick: () => (won ? this.cfg.onDone(this, { won, stars: result.stars }) : this.scene.restart(this.cfg)) }).setDepth(DEPTH.modal + 2);
    new Button(this, REF_W / 2 + 250, 760, { label: 'LEAVE', w: 440, onClick: () => this.cfg.onBack(this) }).setDepth(DEPTH.modal + 2);
    void box;
    void primary;
  }

  /** Signed-in players: the server re-simulates the win again, pays Ration and grants the stage rewards. */
  private async claimProgress(): Promise<void> {
    const api = Services.api;
    if (!api.signedIn || !this.cfg.nodeId) return;
    try {
      const { content } = Services.ready();
      const r = await api.submitBattle(await content.activeReleaseId(), this.cfg.nodeId, this.recorded);
      if (this.dead) return;
      const gained = r.rewards.length ? ` · rewards: ${r.rewards.map((a) => (a.type === 'currency' ? `${a.amount} ${a.currency.replaceAll('_', ' ')}` : a.itemId)).join(', ')}` : '';
      toast(this, `Progress saved to your account${gained}`);
    } catch (e) {
      if (!this.dead) toast(this, e instanceof Error ? `Progress not saved: ${e.message}` : 'Progress not saved');
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
