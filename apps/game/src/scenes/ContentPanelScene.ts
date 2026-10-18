import type { PresentationPack } from '@uomd/content-schema';
import { REF_W } from '../config';
import { hosted } from '../core/host';
import { prefs } from '../platform/prefs';
import { Services } from '../services';
import { HubScreen } from '../ui/hubScreen';
import { txt } from '../ui/pixiKit';
import { T } from '../ui/theme';

interface PanelInit {
  panelId?: string;
  owner?: object;
  onClose?: () => void;
}

/** A fixed notice reader; downloaded data can only select compiled screens and other admitted notices. */
export class ContentPanelScene extends HubScreen<PanelInit> {
  protected readonly heading = 'NOTICES';
  protected override readonly usesWallet = false;
  /** the narrative stage that opened this panel over a paused story (it closes the panel when it goes away) */
  owner?: object;
  private selected?: string;
  private page = 0;
  private listPage = 0;
  private closeHandler?: () => void;

  override create(data?: PanelInit): void {
    this.selected = data?.panelId;
    this.owner = data?.owner;
    this.closeHandler = data?.onClose;
    this.page = this.listPage = 0;
    this.nav.bringToTop();
    super.create(data);
  }

  protected override goBack(): void {
    const close = this.closeHandler;
    this.closeHandler = undefined;
    if (close) {
      this.nav.stop();
      close();
    } else this.nav.start('Home');
  }

  protected async build(): Promise<void> {
    const { content, art } = Services.ready();
    const releaseId = await content.activeReleaseId();
    const [pack, locale, admission] = await Promise.all([content.presentation(), content.locale(prefs().locale), Services.api.panels(releaseId)]);
    if (!this.isCurrentView() || (await content.activeReleaseId()) !== releaseId) return;
    const label = (l: { text_en: string; text_id?: string }): string => (l.text_id && locale && Object.hasOwn(locale.strings, l.text_id) ? locale.strings[l.text_id]! : l.text_en);
    const allowed = new Set(admission.panelIds);
    if (!this.selected) {
      const rows = Object.entries(pack.panels).filter(([id]) => allowed.has(id));
      if (!rows.length) this.text(REF_W / 2, 420, 'No notices are available.', { fontSize: 44, color: T.dim }).setOrigin(0.5);
      rows.slice(this.listPage * 4, this.listPage * 4 + 4).forEach(([id, p], i) =>
        this.button(REF_W / 2, 270 + i * 165, { label: label(p.title), w: 1400, h: 140, fontSize: 36, onClick: () => { this.selected = id; this.page = 0; void this.refresh(); } })
      );
      this.pager(this.listPage, Math.ceil(rows.length / 4), (n) => { this.listPage = n; void this.refresh(); });
      return;
    }
    const panel = Object.hasOwn(pack.panels, this.selected) ? pack.panels[this.selected] : undefined;
    if (!panel || !allowed.has(this.selected)) {
      this.text(REF_W / 2, 420, 'This notice is not available.', { fontSize: 44 }).setOrigin(0.5);
      return;
    }
    this.text(REF_W / 2, 195, label(panel.title), { fontSize: 44, color: T.gold, align: 'center', wordWrap: { width: 1600 } }).setOrigin(0.5);
    if (panel.image_id) {
      await art.loadStills(this.host, [panel.image_id]);
      if (!this.isCurrentView()) return;
      const key = art.still(panel.image_id);
      const tex = key ? this.tex(key) : null;
      const src = tex?.source.resource as CanvasImageSource | undefined;
      if (tex && src) {
        const k = Math.min(540 / tex.width, 480 / tex.height);
        this.ui.image(420, 510, src, tex.frame, tex.width * k, tex.height * k, this.body);
      }
    }
    const width = panel.image_id ? 950 : 1500;
    const x = panel.image_id ? 760 : 210;
    // paginate by wrapped lines (8 per page) with the same metrics the text is drawn with
    const measure = txt(0, 0, '', { fontSize: 32, wordWrap: { width }, lineSpacing: 8 });
    const pages = panel.body.flatMap((paragraph) => {
      const lines = measure.wrap(label(paragraph));
      const chunks: string[] = [];
      for (let at = 0; at < lines.length; at += 8) chunks.push(lines.slice(at, at + 8).join('\n'));
      return chunks;
    });
    measure.destroy();
    this.page = Math.min(this.page, Math.max(0, pages.length - 1));
    this.text(x, 320, pages[this.page] ?? '', { fontSize: 32, color: T.text, lineSpacing: 8 });
    panel.buttons.forEach((b, i) =>
      this.button(REF_W / 2 + (i - (panel.buttons.length - 1) / 2) * 420, 820, { label: label(b.label), w: 400, h: 110, fontSize: 28, onClick: () => this.action(b.action) })
    );
    this.pager(this.page, pages.length, (n) => { this.page = n; void this.refresh(); });
  }

  private pager(page: number, count: number, change: (n: number) => void): void {
    if (count <= 1) return;
    this.button(650, 990, { label: 'PREVIOUS', w: 330, h: 110, onClick: () => change(page - 1) }).setEnabled(page > 0);
    this.text(REF_W / 2, 990, `${page + 1} / ${count}`, { fontSize: 32 }).setOrigin(0.5);
    this.button(1270, 990, { label: 'NEXT', w: 330, h: 110, onClick: () => change(page + 1) }).setEnabled(page + 1 < count);
  }

  private action(action: PresentationPack['panels'][string]['buttons'][number]['action']): void {
    if (action.type === 'close') this.goBack();
    else if (action.type === 'panel') {
      this.selected = action.panel_id;
      this.page = 0;
      void this.refresh();
    }
    // a panel over a paused story cannot abandon it through a navigation button
    else if (this.closeHandler) this.goBack();
    else this.nav.start(action.screen);
  }
}

export const ContentPanelHost = hosted<PanelInit>('ContentPanel', () => new ContentPanelScene());
