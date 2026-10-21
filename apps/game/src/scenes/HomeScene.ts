import * as PIXI from 'pixi.js';
import type { WorldMap } from '@uomd/content-schema';
import { REF_W } from '../config';
import { Progress, Services } from '../services';
import { HubScreen } from '../ui/hubScreen';
import { backdrop } from '../ui/pixiKit';
import { C, F, T } from '../ui/theme';
import { regionStates, type RegionState } from '../ui/worldMap';
import { createEclipseCorona, createSwingingBellEmblem, triggerWaxSealBurst } from '../vfx/gothicUiVfx';

interface Tile { label: string; sub: string; scene: string }

const STATE_LABEL: Record<Exclude<RegionState, 'landmark'>, string> = { cleared: 'Cleared ★', open: 'Open', locked: 'Locked', coming_soon: 'Coming soon' };

/**
 * Hub of the account-backed features. With the world map of a chapter patch (D-29) the map is the main menu and the
 * features sit around it; before that patch (base content only) the hub is a grid of tiles.
 */
export class HomeScene extends HubScreen {
  protected readonly heading = 'THE COMPANY';
  protected override readonly needsSignIn = false;
  protected override readonly backTo = 'Title';
  private vfxMounted = false;
  private roads: PIXI.Graphics | null = null;
  private mapBg: PIXI.Sprite | null = null;

  protected async build(): Promise<void> {
    if (!this.vfxMounted) {
      this.vfxMounted = true;
      createEclipseCorona(this, REF_W / 2, 70, 88, -2, false).alpha = 0.65;
      createSwingingBellEmblem(this, REF_W / 2 - 280, 52, 0.56, 2, 3400);
      createSwingingBellEmblem(this, REF_W / 2 + 280, 52, 0.56, 2, 3900);
    }
    const api = Services.api;
    const tiles: Tile[] = [
      { label: 'SUMMON', sub: 'Banners, rates, pity', scene: 'Summon' },
      { label: 'ROSTER', sub: 'Your company', scene: 'Roster' },
      { label: 'TEAM', sub: 'Formation and presets', scene: 'Team' },
      { label: 'ERRANDS', sub: 'Daily and weekly', scene: 'Tasks' },
      { label: 'DEEDS', sub: 'Achievements and events', scene: 'Deeds' },
      { label: 'TRIALS', sub: 'Arena and endless corridor', scene: 'Trials' },
      { label: 'ARMORY', sub: 'Weapons and relics', scene: 'Gear' },
      { label: 'MAIL', sub: 'Rewards and notices', scene: 'Mail' },
      { label: 'SHOP', sub: 'Offers and ads', scene: 'Shop' },
      { label: 'PROFILE', sub: 'Title and leaderboards', scene: 'Profile' },
      { label: 'ACCOUNT', sub: api.signedIn ? 'Signed in' : 'Sign in', scene: 'Account' },
      { label: 'ACTIONS', sub: 'Pending results and history', scene: 'Operations' }
    ];
    const map = await Services.ready().content.worldMap().catch(() => null);
    if (!this.isCurrentView()) return;
    if (map) await this.mapHub(map, tiles);
    else this.grid(tiles);
    try {
      const flags = await api.flags();
      if (flags['maintenance.read_only']?.enabled) this.notice('The servers are in maintenance: some actions may be refused.', T.crimson, map !== null);
    } catch {
      this.notice('Offline: server features are unavailable.', T.dim, map !== null);
    }
  }

  private open(scene: string, x: number, y: number, data?: object): void {
    triggerWaxSealBurst(this, x, y, 30);
    this.nav.start(scene, data);
  }

  private notice(text: string, color: string, onMap: boolean): void {
    this.text(REF_W / 2, onMap ? 935 : 914, text, { fontSize: onMap ? 22 : 34, color }).setOrigin(0.5);
  }

  /** before the first chapter patch: the feature tiles as a 4x3 grid */
  private grid(tiles: Tile[]): void {
    tiles.forEach((t, i) => {
      const tx = REF_W / 2 - 690 + (i % 4) * 460;
      const ty = 290 + Math.floor(i / 4) * 215;
      this.button(tx, ty, { label: t.label, sub: t.sub, w: 430, h: 190, fontSize: 40, variant: i === 0 ? 'hot' : 'normal', onClick: () => this.open(t.scene, tx, ty) });
    });
    this.button(REF_W / 2, 1000, { label: 'NOTICES', w: 440, h: 110, onClick: () => this.nav.start('ContentPanel') });
    this.button(REF_W - 330, 1000, { label: 'ARCHIVE', w: 440, h: 110, onClick: () => this.nav.start('Library') });
    this.text(REF_W / 2, 866, Services.api.signedIn ? 'Your progress, wallet and rolls are kept on the server.' : 'Sign in to keep your progress, wallet and rolls on the server.', { fontSize: 34, color: T.dim }).setOrigin(0.5);
  }

  /** the world map as the main menu: roads and regions in the middle, the features in two columns and a bottom row */
  private async mapHub(map: WorldMap, tiles: Tile[]): Promise<void> {
    const byScene = new Map(tiles.map((t) => [t.scene, t]));
    const column = (x: number, scenes: string[]): void => scenes.forEach((scene, i) => {
      const t = byScene.get(scene)!;
      const y = 230 + i * 115;
      this.button(x, y, { label: t.label, sub: t.sub, w: 230, h: 100, fontSize: 26, variant: scene === 'Summon' ? 'hot' : 'normal', onClick: () => this.open(t.scene, x, y) });
    });
    column(135, ['Summon', 'Roster', 'Team', 'Gear', 'Account']);
    column(REF_W - 135, ['Tasks', 'Deeds', 'Trials', 'Mail', 'Operations']);
    // ARCHIVE keeps the grid's spot so muscle memory (and the e2e taps) carry over
    for (const [label, scene, x] of [['SHOP', 'Shop', 700], ['PROFILE', 'Profile', 990], ['NOTICES', 'ContentPanel', 1280], ['ARCHIVE', 'Library', 1590]] as const) {
      this.button(x, 1000, { label, w: 270, h: 96, fontSize: 26, onClick: () => this.open(scene, x, 1000) });
    }

    const { content } = Services.ready();
    const index = await content.chapters();
    const cleared = new Set<string>();
    if (Services.api.signedIn) {
      try {
        for (const n of (await Services.api.progress()).nodes) if (n.clears > 0) cleared.add(n.node_id);
      } catch { /* offline: the map shows what the device knows */ }
    } else {
      for (const id of Object.keys(Progress.load())) cleared.add(id);
    }
    if (!this.isCurrentView()) return;
    const states = regionStates(map, index, cleared);
    const at = new Map(map.regions.map((r) => [r.region_id, r]));

    this.mapBg?.destroy();
    this.mapBg = map.background_id ? await backdrop(this, map.background_id, -9) : null;
    if (!this.isCurrentView()) return;

    this.roads?.destroy();
    const g = new PIXI.Graphics();
    for (const road of map.roads) {
      const a = at.get(road.from)!;
      const b = at.get(road.to)!;
      const shipped = states.get(a.region_id) !== 'coming_soon' && states.get(b.region_id) !== 'coming_soon';
      // a side road leaves its chapter above the node or below the title, so it never crosses the chapter's name
      const fromY = road.kind === 'side' ? (b.y > a.y ? a.y + 78 : a.y - 44) : a.y;
      g.moveTo(a.x, fromY).lineTo(b.x, b.y).stroke(road.kind === 'main' ? { width: 7, color: C.gold, alpha: shipped ? 0.8 : 0.28 } : { width: 3, color: C.silver, alpha: 0.32 });
    }
    this.roads = g;
    this.add(g, -5);

    for (const r of map.regions) {
      const state = states.get(r.region_id)!;
      if (state === 'landmark') {
        this.text(r.x, r.y, `◆ ${r.title_en}`, { fontFamily: F.body, fontSize: 20, color: T.dim }).setOrigin(0.5);
        continue;
      }
      const playable = state === 'open' || state === 'cleared';
      this.button(r.x, r.y, {
        label: `CHAPTER ${r.chapter_number}`,
        sub: STATE_LABEL[state],
        ariaLabel: `Chapter ${r.chapter_number}${state === 'coming_soon' ? '' : `, ${r.title_en}`}: ${STATE_LABEL[state]}`,
        w: 190,
        h: 84,
        fontSize: 22,
        variant: state === 'open' ? 'hot' : playable ? 'normal' : 'dim',
        onClick: () => (playable ? this.open('Chapters', r.x, r.y, { chapterId: r.chapter_id }) : this.say(state === 'locked' ? 'Finish the previous chapter first.' : 'This chapter arrives in a later update.'))
      });
      if (state !== 'coming_soon') this.text(r.x, r.y + 60, r.title_en, { fontFamily: F.display, fontSize: 18, color: playable ? T.gold : T.dim }).setOrigin(0.5).fit(260);
    }
    this.text(REF_W / 2, 905, Services.api.signedIn ? 'Your progress, wallet and rolls are kept on the server.' : 'Sign in to keep your progress on the server.', { fontSize: 22, color: T.dim }).setOrigin(0.5);
  }
}
