import type { PresentationPack } from '@uomd/content-schema';
import { HubScene } from '../ui/hub';
import { Button, txt } from '../ui/kit';
import { T } from '../ui/theme';
import { REF_W } from '../config';
import { Services } from '../services';
import { prefs } from '../platform/prefs';

/** A fixed notice reader; downloaded data can only select compiled screens and other admitted notices. */
export class ContentPanelScene extends HubScene {
  protected readonly heading = 'NOTICES';
  protected override readonly usesWallet = false;
  owner?: object;
  private selected?: string;
  private page = 0;
  private listPage = 0;
  private onClose?: () => void;
  constructor() { super('ContentPanel'); }
  init(data?: { panelId?: string; owner?: object; onClose?: () => void }): void {
    this.selected = data?.panelId; this.owner = data?.owner; this.onClose = data?.onClose; this.page = this.listPage = 0;
  }
  override create(): void { this.scene.bringToTop(); super.create(); }
  protected override goBack(): void {
    const close = this.onClose; this.onClose = undefined;
    if (close) { this.scene.stop(); close(); } else this.scene.start('Home');
  }
  protected async build(): Promise<void> {
    const { content, art } = Services.ready(); const releaseId = await content.activeReleaseId();
    const [pack, locale, admission] = await Promise.all([content.presentation(), content.locale(prefs().locale), Services.api.panels(releaseId)]);
    if (!this.isCurrentView() || await content.activeReleaseId() !== releaseId) return;
    const label = (l: { text_en: string; text_id?: string }): string => l.text_id && locale && Object.hasOwn(locale.strings, l.text_id) ? locale.strings[l.text_id]! : l.text_en;
    const allowed = new Set(admission.panelIds);
    if (!this.selected) {
      const rows = Object.entries(pack.panels).filter(([id]) => allowed.has(id));
      if (!rows.length) this.add_(txt(this, REF_W / 2, 420, 'No notices are available.', { fontSize: '44px', color: T.dim }).setOrigin(0.5));
      rows.slice(this.listPage * 4, this.listPage * 4 + 4).forEach(([id, p], i) => this.add_(new Button(this, REF_W / 2, 270 + i * 165, { label: label(p.title), w: 1400, h: 140, fontSize: 36, onClick: () => { this.selected = id; this.page = 0; void this.refresh(); } })));
      this.pager(this.listPage, Math.ceil(rows.length / 4), (n) => { this.listPage = n; void this.refresh(); }); return;
    }
    const panel = Object.hasOwn(pack.panels, this.selected) ? pack.panels[this.selected] : undefined;
    if (!panel || !allowed.has(this.selected)) { this.add_(txt(this, REF_W / 2, 420, 'This notice is not available.', { fontSize: '44px' }).setOrigin(0.5)); return; }
    this.add_(txt(this, REF_W / 2, 195, label(panel.title), { fontSize: '44px', color: T.gold, align: 'center', wordWrap: { width: 1600 } }).setOrigin(0.5));
    if (panel.image_id) {
      await art.loadStills(this, [panel.image_id]); if (!this.isCurrentView()) return;
      const key = art.still(panel.image_id);
      if (key) { const image = this.add.image(420, 510, key); image.setScale(Math.min(540 / image.width, 480 / image.height)); this.add_(image); }
    }
    const width = panel.image_id ? 950 : 1500; const x = panel.image_id ? 760 : 210;
    const measure = txt(this, 0, 0, '', { fontSize: '32px', wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 8 }).setVisible(false);
    const pages = panel.body.flatMap((paragraph) => { const lines = measure.getWrappedText(label(paragraph)); const chunks: string[] = []; for (let at = 0; at < lines.length; at += 8) chunks.push(lines.slice(at, at + 8).join('\n')); return chunks; }); measure.destroy();
    this.page = Math.min(this.page, Math.max(0, pages.length - 1));
    this.add_(txt(this, x, 320, pages[this.page] ?? '', { fontSize: '32px', color: T.text, wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 8 }));
    panel.buttons.forEach((b, i) => this.add_(new Button(this, REF_W / 2 + (i - (panel.buttons.length - 1) / 2) * 420, 820, { label: label(b.label), w: 400, h: 110, fontSize: 28, onClick: () => this.action(b.action) })));
    this.pager(this.page, pages.length, (n) => { this.page = n; void this.refresh(); });
  }
  private pager(page: number, count: number, change: (n: number) => void): void {
    if (count <= 1) return;
    this.add_(new Button(this, 650, 990, { label: 'PREVIOUS', w: 330, h: 110, onClick: () => change(page - 1) }).setEnabled(page > 0));
    this.add_(txt(this, REF_W / 2, 990, `${page + 1} / ${count}`, { fontSize: '32px' }).setOrigin(0.5));
    this.add_(new Button(this, 1270, 990, { label: 'NEXT', w: 330, h: 110, onClick: () => change(page + 1) }).setEnabled(page + 1 < count));
  }
  private action(action: PresentationPack['panels'][string]['buttons'][number]['action']): void {
    if (action.type === 'close') this.goBack();
    else if (action.type === 'panel') { this.selected = action.panel_id; this.page = 0; void this.refresh(); }
    else {
      // A modal cannot abandon a paused story through a navigation button.
      if (this.onClose) this.goBack(); else this.scene.start(action.screen);
    }
  }
}
