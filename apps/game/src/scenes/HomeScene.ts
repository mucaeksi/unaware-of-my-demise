import { REF_W } from '../config';
import { Services } from '../services';
import { Button, txt } from '../ui/kit';
import { HubScene } from '../ui/hub';
import { T } from '../ui/theme';

/** Hub of the account-backed features. */
export class HomeScene extends HubScene {
  protected readonly heading = 'THE COMPANY';
  protected override readonly needsSignIn = false;
  protected override readonly backTo = 'Title';

  constructor() {
    super('Home');
  }

  protected async build(): Promise<void> {
    const api = Services.api;
    const tiles: { label: string; sub: string; scene: string }[] = [
      { label: 'SUMMON', sub: 'Banners, rates, pity', scene: 'Summon' },
      { label: 'ROSTER', sub: 'Your company', scene: 'Roster' },
      { label: 'TEAM', sub: 'Formation and presets', scene: 'Team' },
      { label: 'ERRANDS', sub: 'Daily and weekly', scene: 'Tasks' },
      { label: 'ARMORY', sub: 'Weapons and relics', scene: 'Gear' },
      { label: 'MAIL', sub: 'Rewards and notices', scene: 'Mail' },
      { label: 'SHOP', sub: 'Offers and ads', scene: 'Shop' },
      { label: 'ACCOUNT', sub: api.signedIn ? 'Signed in' : 'Sign in', scene: 'Account' },
      { label: 'ACTIONS', sub: 'Pending results and history', scene: 'Operations' }
    ];
    tiles.forEach((t, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      this.add_(new Button(this, REF_W / 2 - 520 + col * 520, 290 + row * 215, { label: t.label, sub: t.sub, w: 480, h: 190, fontSize: 46, variant: i === 0 ? 'hot' : 'normal', onClick: () => this.scene.start(t.scene) }));
    });
    this.add_(new Button(this, REF_W - 330, 1000, { label: 'ARCHIVE', w: 440, h: 110, onClick: () => this.scene.start('Library') }));
    this.add_(txt(this, REF_W / 2, 830, api.signedIn ? 'Your progress, wallet and rolls are kept on the server.' : 'Sign in to keep your progress, wallet and rolls on the server.', { fontSize: '34px', color: T.dim }).setOrigin(0.5));
    try {
      const flags = await api.flags();
      if (flags['maintenance.read_only']?.enabled) this.add_(txt(this, REF_W / 2, 920, 'The servers are in maintenance: some actions may be refused.', { fontSize: '34px', color: T.crimson }).setOrigin(0.5));
    } catch {
      this.add_(txt(this, REF_W / 2, 920, 'Offline: server features are unavailable.', { fontSize: '34px', color: T.dim }).setOrigin(0.5));
    }
  }
}
