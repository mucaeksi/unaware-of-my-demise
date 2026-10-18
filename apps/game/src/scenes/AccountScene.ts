import { API_BASE, REF_W } from '../config';
import { hosted } from '../core/host';
import { prefs } from '../platform/prefs';
import { errText, HubScreen } from '../ui/hubScreen';
import { Progress, Services } from '../services';
import { T } from '../ui/theme';
import { ApiError } from '../net/api';
import { consentState, showPrivacyOptions, subscribeConsent } from '../net/store';

export class AccountScene extends HubScreen {
  protected readonly heading = 'ACCOUNT';
  protected override readonly needsSignIn = false;

  private confirmDeleteFor: string | null = null;
  private confirmDeleteRevision = -1;

  override create(): void {
    this.confirmDeleteFor = null;
    this.confirmDeleteRevision = -1;
    const unsub = subscribeConsent(() => {
      if (this.live) void this.refresh();
    });
    this.onClose(unsub);
    super.create();
  }

  protected async build(): Promise<void> {
    const api = Services.api;
    const identity = Services.identity;
    const currentConsent = consentState();
    const consentTag =
      currentConsent?.status === 'withdrawn' || currentConsent?.status === 'denied'
        ? 'PRIVACY: WITHDRAWN'
        : currentConsent?.status === 'OBTAINED'
          ? 'PRIVACY: CONSENTED'
          : 'PRIVACY OPTIONS (ADS)';
    const openPrivacy = (): void => {
      void showPrivacyOptions()
        .then((next) => this.say(`Privacy choice updated (${next?.status ?? 'saved'})`))
        .catch((e) => this.say(errText(e)));
    };
    const openPrivacyPolicy = (): void => {
      const url = `${API_BASE || ''}/privacy`;
      if (typeof window !== 'undefined' && typeof window.open === 'function') window.open(url, '_blank', 'noopener,noreferrer');
      this.say('Privacy notice & web deletion portal opened');
    };
    if (!api.signedIn) {
      this.text(REF_W / 2, 330, 'Your account is a Google account. Progress, rolls and purchases are bound to it and survive a reinstall.', { fontSize: '36px', wordWrap: { width: 1400 }, align: 'center' }).setOrigin(0.5);
      const canSignIn = identity?.kind === 'native' || identity?.kind === 'web';
      this.button(REF_W / 2, 520, { label: 'SIGN IN WITH GOOGLE', w: 760, h: 140, variant: canSignIn ? 'hot' : 'dim', onClick: () => void this.signIn() }).setEnabled(canSignIn);
      if (!canSignIn) this.text(REF_W / 2, 650, 'Google sign-in requires the Android app or configured Google Web Client ID.', { fontSize: '32px', color: T.dim }).setOrigin(0.5);
      this.button(REF_W / 2 - 480, 790, { label: consentTag, w: 460, h: 110, fontSize: 24, onClick: openPrivacy });
      this.button(REF_W / 2, 790, { label: 'PRIVACY & DELETE URL', w: 460, h: 110, fontSize: 24, onClick: openPrivacyPolicy });
      this.button(REF_W / 2 + 480, 790, { label: 'SETTINGS', w: 460, h: 110, fontSize: 28, onClick: () => this.nav.start('Title', { openSettings: true }) });
      return;
    }
    const me = await api.me();
    this.button(300, 195, { label: 'PURCHASES', w: 460, h: 100, onClick: () => this.nav.start('Purchases') });
    this.button(REF_W - 300, 195, { label: 'SAVED ACTIONS', w: 460, h: 100, onClick: () => this.nav.start('Operations') });
    this.text(REF_W / 2, 280, me.displayName ?? 'Wayfarer', { fontSize: '52px', color: T.gold }).setOrigin(0.5);
    this.text(REF_W / 2, 350, `Player ${me.id}`, { fontSize: '26px', color: T.dim }).setOrigin(0.5);
    const save = await api.readSave();
    this.text(REF_W / 2, 470, save.version === 0 ? 'No cloud save yet.' : `Cloud save v${save.version} · ${save.updatedAt ?? ''}`, { fontSize: '34px' }).setOrigin(0.5);
    this.button(REF_W / 2 - 330, 590, { label: 'UPLOAD SAVE', w: 600, onClick: () => void this.upload(save.version, save.data) });
    this.button(REF_W / 2 + 330, 590, { label: 'DOWNLOAD SAVE', w: 600, onClick: () => void this.download() }).setEnabled(save.version > 0);
    this.button(REF_W / 2 - 330, 730, { label: 'EXPORT MY DATA', w: 600, onClick: () => void this.exportData() });
    this.button(REF_W / 2 + 330, 730, { label: 'SIGN OUT', w: 600, onClick: () => void this.signOut() });
    this.button(REF_W / 2 - 460, 1010, { label: consentTag, w: 430, h: 96, fontSize: 22, onClick: openPrivacy });
    this.button(REF_W / 2, 1010, { label: 'PRIVACY NOTICE', w: 430, h: 96, fontSize: 22, onClick: openPrivacyPolicy });
    this.button(REF_W / 2 + 460, 1010, { label: 'SETTINGS', w: 430, h: 96, fontSize: 24, onClick: () => this.nav.start('Title', { openSettings: true }) });
    const confirming = this.confirmDeleteFor === me.id && this.confirmDeleteRevision === api.authRevision;
    this.button(REF_W / 2, 880, { label: confirming ? 'TAP AGAIN TO DELETE FOREVER' : 'DELETE ACCOUNT', sub: confirming ? 'progress, wallet and roster cannot be restored' : undefined, w: 900, h: 130, variant: 'danger', onClick: () => void this.deleteAccount(me.id) });
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

  private async deleteAccount(expectedPlayer: string): Promise<void> {
    try {
      const api = Services.api; const revision = api.authRevision;
      const current = await api.me();
      if (revision !== api.authRevision || current.id !== expectedPlayer) throw new ApiError(409, 'auth_changed', 'The selected account changed');
      if (this.confirmDeleteFor !== expectedPlayer || this.confirmDeleteRevision !== revision) {
        this.confirmDeleteFor = expectedPlayer;
        this.confirmDeleteRevision = revision;
        this.anim.after(6000, () => { if (this.confirmDeleteFor === expectedPlayer && this.confirmDeleteRevision === revision) { this.confirmDeleteFor = null; void this.refresh(); } });
        await this.refresh(); return;
      }
      await api.deleteAccount(revision);
      if (Services.api.signedIn) throw new ApiError(409, 'auth_changed', 'The selected account changed');
      await Services.identity?.forget();
      this.confirmDeleteFor = null;
      this.say('Your account was deleted');
      await this.refresh();
    } catch (e) {
      this.say(errText(e));
    }
  }

  private async signOut(): Promise<void> {
    try {
      await Services.api.signOut(Services.api.authRevision);
      if (Services.api.signedIn) throw new ApiError(409, 'auth_changed', 'The selected account changed');
      await Services.identity?.forget();
      this.say('Signed out');
      await this.refresh();
    } catch (error) { this.say(errText(error)); }
  }

  private async upload(version: number, cloud: Record<string, unknown>): Promise<void> {
    try {
      // other keys of the cloud save (story continuity) belong to other features and are kept
      await Services.api.writeSave(version, { ...cloud, progress: Progress.load(), prefs: prefs() });
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

export const AccountHost = hosted('Account', () => new AccountScene());
