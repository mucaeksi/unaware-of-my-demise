import { REF_W } from '../config';
import type { RecruitSelectionResult, RecruitSelectorView } from '../net/api';
import { Services } from '../services';
import { HubScreen } from '../ui/hubScreen';
import { F, T } from '../ui/theme';

export class RecruitScene extends HubScreen {
  protected readonly heading = 'INVITATIONS';
  protected override readonly usesWallet = false;
  private returnTo = 'Roster';
  private generation = 0;
  private releaseId = '';
  private selectors: RecruitSelectorView[] = [];
  private selected: { selector: RecruitSelectorView; choice: RecruitSelectorView['choices'][number] } | null = null;
  private page = 0;
  private busy = false;
  private pendingId: string | null = null;
  private viewRevision = -1;

  override create(data?: { returnTo?: string }): void {
    this.generation++; this.returnTo = data?.returnTo === 'Chapters' ? 'Chapters' : 'Roster';
    this.selected = null; this.selectors = []; this.page = 0; this.busy = false; this.pendingId = null;
    super.create(data);
    this.onClose(() => this.generation++);
  }
  protected override goBack(): void { this.nav.start(this.returnTo); }
  protected async build(): Promise<void> {
    const generation = this.generation;
    this.viewRevision = Services.api.authRevision;
    this.selected = null; this.selectors = []; this.pendingId = null; this.busy = false;
    const operations = await Services.api.operations();
    if (!this.isCurrentView() || generation !== this.generation) return;
    this.pendingId = operations.find((record) => record.state === 'pending' && record.path.startsWith('/api/v1/recruitment/'))?.id ?? null;
    if (this.pendingId) { this.draw(); return; }
    this.releaseId = await Services.ready().content.activeReleaseId();
    const result = await Services.api.recruitSelectors(this.releaseId);
    if (!this.isCurrentView() || generation !== this.generation) return;
    this.selectors = result.selectors; this.draw();
  }
  private line(y: number, value: string, size = 34, color: string = T.text): void {
    this.text(REF_W / 2, y, value, { fontSize: `${size}px`, color, align: 'center', wordWrap: { width: 1450 } }).setOrigin(0.5);
  }
  private draw(): void {
    if (!this.isCurrentView()) return;
    this.body.removeAll();
    if (this.pendingId) {
      this.line(350, 'Your original invitation choice is saved. Confirm it before choosing again.');
      this.button(REF_W / 2, 570, { label: this.busy ? 'CONFIRMING…' : 'CONFIRM SAVE', w: 620, onClick: () => void this.confirm() }).setEnabled(!this.busy);
      return;
    }
    if (this.selected) {
      const { selector, choice } = this.selected;
      this.line(255, selector.title, 44, T.gold);
      this.line(390, `Choose ${choice.name_en}?`, 48);
      this.line(495, `Uses 1 invitation. If already owned, this grants ${selector.duplicateShards} character-bound Memory Shards.`, 32, T.dim);
      this.button(REF_W / 2, 680, { label: this.busy ? 'CONFIRMING…' : 'USE 1 INVITATION', w: 700, onClick: () => void this.confirm() }).setEnabled(!this.busy);
      this.button(REF_W / 2, 830, { label: 'CHANGE CHOICE', w: 620, onClick: () => { this.selected = null; this.draw(); } }).setEnabled(!this.busy);
      return;
    }
    const choices = this.selectors.flatMap((selector) => selector.choices.map((choice) => ({ selector, choice })));
    if (!choices.length) { this.line(430, 'No invitation is ready. Continue the main story.'); return; }
    this.line(170, 'Choose one companion. Review your choice before using an invitation.', 32, T.dim);
    const pages = Math.ceil(choices.length / 8); this.page = Math.min(this.page, pages - 1);
    choices.slice(this.page * 8, this.page * 8 + 8).forEach((selection, i) => {
      const { selector, choice } = selection; const x = 340 + i % 4 * 415; const y = 340 + Math.floor(i / 4) * 235;
      this.button(x, y, { label: choice.name_en, w: 390, h: 165, fontSize: 31, onClick: () => { this.selected = selection; this.draw(); } });
      this.text(x, y + 115, choice.copies > 0 ? `Owned · +${selector.duplicateShards} Memory Shards` : `${choice.element} · ${choice.role.replaceAll('_', ' ')}`, { fontSize: '25px', fontFamily: F.body, color: T.dim }).setOrigin(0.5);
    });
    if (pages > 1) {
      this.button(REF_W / 2 - 250, 875, { label: 'PREVIOUS', w: 380, onClick: () => { this.page = (this.page + pages - 1) % pages; this.draw(); } });
      this.button(REF_W / 2 + 250, 875, { label: 'NEXT', w: 380, onClick: () => { this.page = (this.page + 1) % pages; this.draw(); } });
    }
  }
  private async confirm(): Promise<void> {
    if (this.busy || !this.selected && !this.pendingId) return;
    const generation = this.generation; const openingRevision = this.viewRevision;
    const selected = this.selected; const pendingId = this.pendingId;
    const revision = Services.api.authRevision;
    if (openingRevision !== revision || !this.isCurrentView()) return;
    this.busy = true; this.draw();
    try {
      const result = pendingId ? await Services.api.retryOperation<RecruitSelectionResult>(pendingId)
        : await Services.api.selectRecruit(this.releaseId, selected!.selector.itemId, selected!.choice.id, openingRevision);
      if (!this.isCurrentView() || generation !== this.generation || revision !== Services.api.authRevision) return;
      this.body.removeAll();
      this.line(350, result.grant.shardsAdded ? `${result.characterName} · +${result.grant.shardsAdded} Memory Shards` : `${result.characterName} joined your company.`, 44, T.gold);
      this.line(470, '1 invitation used. Your company is saved.', 34);
      this.button(REF_W / 2, 660, { label: 'CONTINUE', w: 600, onClick: () => this.goBack() });
    } catch (error) {
      if (!this.isCurrentView() || generation !== this.generation || revision !== Services.api.authRevision) return;
      this.busy = false; this.say(`The choice is not confirmed. ${error instanceof Error ? error.message : String(error)}`); await this.refresh();
    } finally {
      if (generation === this.generation && revision === Services.api.authRevision) this.busy = false;
    }
  }
}

