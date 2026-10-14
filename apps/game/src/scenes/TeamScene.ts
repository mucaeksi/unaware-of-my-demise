import { REF_W } from '../config';
import type { TeamMember, TeamPreset } from '../net/api';
import { Services } from '../services';
import { HubScene } from '../ui/hub';
import { Button, txt } from '../ui/kit';
import { F, T } from '../ui/theme';

interface Hero {
  id: string;
  name: string;
  level: number;
  role: string;
}

const POSITIONS = [
  { label: 'FRONT', x: 520, y: 400 },
  { label: 'FRONT', x: 520, y: 600 },
  { label: 'REAR', x: 1000, y: 330 },
  { label: 'REAR', x: 1000, y: 500 },
  { label: 'REAR', x: 1000, y: 670 }
] as const;
const PER_PAGE = 8;

/**
 * Team builder (functional skeleton, panel design is done together): five presets, a two-front / three-rear formation, owned heroes only.
 * The active preset is what the server uses to compose the party of every owned-hero stage.
 */
export class TeamScene extends HubScene {
  protected readonly heading = 'TEAM';
  protected override readonly backTo = 'Home';
  private heroes: Hero[] = [];
  private presets = new Map<number, TeamPreset>();
  private slot = 1;
  private cells: (string | null)[] = [null, null, null, null, null];
  private picking: number | null = null;
  private page = 0;
  private dirty = false;
  private releaseId: string | undefined;

  constructor() {
    super('Team');
  }

  protected async build(): Promise<void> {
    const api = Services.api;
    this.releaseId = await Services.ready().content.activeReleaseId();
    const [mine, roster, teams] = await Promise.all([api.characters(this.releaseId), api.roster(this.releaseId), api.teams()]);
    const names = new Map(roster.map((c) => [c.id, c]));
    this.heroes = mine.characters.map((c) => ({ id: c.id, name: names.get(c.id)?.name_en ?? c.id, level: c.level, role: (names.get(c.id)?.role ?? '').replaceAll('_', ' ') })).sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
    this.presets = new Map(teams.teams.map((t) => [t.slot, t]));
    const active = teams.teams.find((t) => t.active);
    if (!this.dirty) this.slot = active?.slot ?? 1;
    this.loadPreset();
    this.draw();
  }

  private loadPreset(): void {
    this.cells = [null, null, null, null, null];
    for (const m of this.presets.get(this.slot)?.members ?? []) if (m.slot >= 0 && m.slot < 5) this.cells[m.slot] = m.characterId;
    this.dirty = false;
    this.picking = null;
  }

  private draw(): void {
    this.body.removeAll(true);
    for (let s = 1; s <= 5; s++) {
      const p = this.presets.get(s);
      this.add_(new Button(this, 330 + (s - 1) * 300, 175, { label: `${p?.active ? '★ ' : ''}TEAM ${s}`, sub: p ? `${p.members.length} heroes` : 'empty', w: 270, h: 96, fontSize: 30, variant: s === this.slot ? 'hot' : 'normal', onClick: () => { this.slot = s; this.loadPreset(); this.draw(); } }));
    }
    POSITIONS.forEach((pos, i) => {
      const id = this.cells[i];
      const hero = this.heroes.find((h) => h.id === id);
      this.card(pos.x, pos.y, 400, 150, hero ? 'normal' : 'dim').setInteractive({ useHandCursor: true }).on('pointerup', () => { this.picking = i; this.page = 0; this.draw(); });
      this.add_(txt(this, pos.x, pos.y - 46, pos.label, { fontFamily: F.display, fontSize: '22px', color: T.dim }).setOrigin(0.5));
      this.add_(txt(this, pos.x, pos.y - 6, hero ? hero.name : 'Empty — tap to choose', { fontFamily: F.display, fontSize: '34px', fontStyle: '600', color: hero ? T.text : T.dim }).setOrigin(0.5));
      if (hero) this.add_(txt(this, pos.x, pos.y + 40, `Lv ${hero.level} · ${hero.role}`, { fontSize: '26px', color: T.dim }).setOrigin(0.5));
    });
    const count = this.cells.filter(Boolean).length;
    this.add_(txt(this, REF_W / 2, 790, count === 0 ? 'Without a saved team the server picks your strongest heroes.' : `${count} of 5 slots filled${this.dirty ? ' · unsaved changes' : ''}`, { fontSize: '30px', color: T.dim }).setOrigin(0.5));
    this.add_(new Button(this, 640, 900, { label: 'SAVE', w: 340, h: 110, variant: 'hot', onClick: () => void this.save() }));
    this.add_(new Button(this, 1010, 900, { label: 'SET ACTIVE', w: 380, h: 110, onClick: () => void this.activate() }));
    this.add_(new Button(this, 1380, 900, { label: 'CLEAR', w: 340, h: 110, variant: 'danger', onClick: () => void this.clear() }));
    if (this.picking !== null) this.drawPicker();
  }

  private drawPicker(): void {
    const at = this.picking as number;
    const used = new Set(this.cells.filter((c, i): c is string => Boolean(c) && i !== at));
    const free = this.heroes.filter((h) => !used.has(h.id));
    this.add_(this.add.rectangle(REF_W / 2, 540, REF_W, 1080, 0x07040c, 0.86).setInteractive().setDepth(10));
    const pageItems = free.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);
    this.add_(txt(this, REF_W / 2, 150, `${POSITIONS[at]?.label ?? ''} SLOT — CHOOSE A HERO`, { fontFamily: F.display, fontSize: '44px', fontStyle: '600', color: T.gold }).setOrigin(0.5).setDepth(11));
    pageItems.forEach((h, i) => {
      const x = 400 + (i % 4) * 370;
      const y = 330 + Math.floor(i / 4) * 210;
      const c = this.card(x, y, 340, 180, 'normal').setDepth(11).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => { this.cells[at] = h.id; this.dirty = true; this.picking = null; this.draw(); });
      this.add_(txt(this, x, y - 30, h.name, { fontFamily: F.display, fontSize: '30px', fontStyle: '600', color: T.text }).setOrigin(0.5).setDepth(12));
      this.add_(txt(this, x, y + 20, `Lv ${h.level} · ${h.role}`, { fontSize: '24px', color: T.dim }).setOrigin(0.5).setDepth(12));
    });
    const pages = Math.max(1, Math.ceil(free.length / PER_PAGE));
    if (pages > 1) {
      this.add_(new Button(this, REF_W / 2 - 220, 800, { label: '‹', w: 150, h: 96, fontSize: 52, onClick: () => { this.page = (this.page + pages - 1) % pages; this.draw(); } }).setDepth(12));
      this.add_(new Button(this, REF_W / 2 + 220, 800, { label: '›', w: 150, h: 96, fontSize: 52, onClick: () => { this.page = (this.page + 1) % pages; this.draw(); } }).setDepth(12));
    }
    this.add_(new Button(this, REF_W / 2 - 280, 930, { label: 'EMPTY SLOT', w: 420, h: 100, onClick: () => { this.cells[at] = null; this.dirty = true; this.picking = null; this.draw(); } }).setDepth(12));
    this.add_(new Button(this, REF_W / 2 + 280, 930, { label: 'CANCEL', w: 420, h: 100, onClick: () => { this.picking = null; this.draw(); } }).setDepth(12));
  }

  private members(): TeamMember[] {
    return this.cells.flatMap((id, i) => (id ? [{ characterId: id, slot: i, row: (i < 2 ? 'front' : 'rear') as 'front' | 'rear' }] : []));
  }

  private async save(): Promise<void> {
    const members = this.members();
    if (members.length === 0) return this.say('Choose at least one hero first.');
    try {
      await Services.api.saveTeam(this.slot, `Team ${this.slot}`, members, this.releaseId);
      this.say('Team saved.');
      this.dirty = false;
      await this.refresh();
    } catch (e) {
      this.say(e instanceof Error ? e.message : 'Could not save the team.');
    }
  }

  private async activate(): Promise<void> {
    if (this.dirty) await this.save();
    try {
      await Services.api.activateTeam(this.slot, this.releaseId);
      this.say(`Team ${this.slot} is now the one that goes into battle.`);
      await this.refresh();
    } catch (e) {
      this.say(e instanceof Error ? e.message : 'Save this team first.');
    }
  }

  private async clear(): Promise<void> {
    try {
      if (this.presets.has(this.slot)) await Services.api.deleteTeam(this.slot, this.releaseId);
      this.cells = [null, null, null, null, null];
      this.dirty = false;
      await this.refresh();
    } catch (e) {
      this.say(e instanceof Error ? e.message : 'Could not clear the team.');
    }
  }
}
