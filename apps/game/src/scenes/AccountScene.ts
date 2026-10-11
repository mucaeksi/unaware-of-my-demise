import { REF_W } from '../config';
import { prefs } from '../platform/prefs';
import { errText, HubScene } from '../ui/hub';
import { Progress, Services } from '../services';
import { Button, txt } from '../ui/kit';
import { T } from '../ui/theme';
import { ApiError } from '../net/api';

export class AccountScene extends HubScene {
  protected readonly heading = 'ACCOUNT';
  protected override readonly needsSignIn = false;

  private confirmDelete = false;

  constructor() {
    super('Account');
  }

  protected async build(): Promise<void> {
    const api = Services.api;
    const identity = Services.identity;
    if (!api.signedIn) {
      this.add_(txt(this, REF_W / 2, 330, 'Your account is a Google account. Progress, rolls and purchases are bound to it and survive a reinstall.', { fontSize: '36px', wordWrap: { width: 1400 }, align: 'center' }).setOrigin(0.5));
      const native = identity?.kind === 'native';
      this.add_(new Button(this, REF_W / 2, 520, { label: 'SIGN IN WITH GOOGLE', w: 760, h: 140, variant: native ? 'hot' : 'dim', onClick: () => void this.signIn() }).setEnabled(native));
      if (!native) this.add_(txt(this, REF_W / 2, 650, 'Google sign-in runs inside the Android app. This browser build cannot sign in.', { fontSize: '32px', color: T.dim }).setOrigin(0.5));
      return;
    }
    const me = await api.me();
    this.add_(txt(this, REF_W / 2, 280, me.displayName ?? 'Wayfarer', { fontSize: '52px', color: T.gold }).setOrigin(0.5));
    this.add_(txt(this, REF_W / 2, 350, `Player ${me.id}`, { fontSize: '26px', color: T.dim }).setOrigin(0.5));
    const save = await api.readSave();
    this.add_(txt(this, REF_W / 2, 470, save.version === 0 ? 'No cloud save yet.' : `Cloud save v${save.version} · ${save.updatedAt ?? ''}`, { fontSize: '34px' }).setOrigin(0.5));
    this.add_(new Button(this, REF_W / 2 - 330, 590, { label: 'UPLOAD SAVE', w: 600, onClick: () => void this.upload(save.version) }));
    this.add_(new Button(this, REF_W / 2 + 330, 590, { label: 'DOWNLOAD SAVE', w: 600, onClick: () => void this.download() }).setEnabled(save.version > 0));
    this.add_(new Button(this, REF_W / 2 - 330, 730, { label: 'EXPORT MY DATA', w: 600, onClick: () => void this.exportData() }));
    this.add_(new Button(this, REF_W / 2 + 330, 730, { label: 'SIGN OUT', w: 600, onClick: () => void this.signOut() }));
    this.add_(new Button(this, REF_W / 2, 880, { label: this.confirmDelete ? 'TAP AGAIN TO DELETE FOREVER' : 'DELETE ACCOUNT', sub: this.confirmDelete ? 'progress, wallet and roster cannot be restored' : undefined, w: 900, h: 130, variant: 'danger', onClick: () => void this.deleteAccount() }));
  }

  private async signIn(): Promise<void> {
    try {
      const token = await Services.identity?.getIdToken();
      if (!token) return;
      const p = await Services.api.signInWithIdToken(token);
      this.say(p.isNew ? 'Welcome, wayfarer. Your company awaits.' : 'Welcome back.');
      await this.refresh();
    } catch (e) {
      this.say(errText(e));
    }
  }

  private async exportData(): Promise<void> {
    try {
      const data = await Services.api.exportAccount();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'unaware-of-my-demise-data.json';
      a.click();
      URL.revokeObjectURL(url);
      this.say('Your data was saved as a file');
    } catch (e) {
      this.say(errText(e));
    }
  }

  private async deleteAccount(): Promise<void> {
    if (!this.confirmDelete) {
      this.confirmDelete = true;
      this.time.delayedCall(6000, () => { this.confirmDelete = false; void this.refresh(); });
      await this.refresh();
      return;
    }
    try {
      await Services.api.deleteAccount();
      this.confirmDelete = false;
      this.say('Your account was deleted');
      await this.refresh();
    } catch (e) {
      this.say(errText(e));
    }
  }

  private async signOut(): Promise<void> {
    await Services.api.signOut();
    this.say('Signed out');
    await this.refresh();
  }

  private async upload(version: number): Promise<void> {
    try {
      await Services.api.writeSave(version, { progress: Progress.load(), prefs: prefs() });
      this.say('Saved to the cloud');
    } catch (e) {
      this.say(e instanceof ApiError && e.code === 'save_conflict' ? 'The cloud save changed on another device. Download it first.' : errText(e));
    }
    await this.refresh();
  }

  private async download(): Promise<void> {
    try {
      const s = await Services.api.readSave();
      const prog = (s.data as { progress?: Record<string, { stars: number }> }).progress ?? {};
      for (const [node, v] of Object.entries(prog)) Progress.complete(node, v.stars); // merge: stars only go up
      this.say('Cloud progress merged into this device');
    } catch (e) {
      this.say(errText(e));
    }
  }
}
