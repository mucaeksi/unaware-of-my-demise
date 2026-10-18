import type { LibraryCard, LibraryEntry } from '@uomd/content-schema';
import { REF_W } from '../config';
import { Services } from '../services';
import { storySaveFailed, type StoryInit } from './StoryScene';
import { HubScreen } from '../ui/hubScreen';
import { T } from '../ui/theme';
import type { PixiScene } from '../core/PixiScene';

export class LibraryScene extends HubScreen {
  protected readonly heading = 'THE ARCHIVE';
  protected override readonly usesWallet = false;
  private category: LibraryCard['kind'] = 'codex';
  private page = 0;
  private cards: LibraryCard[] = [];
  private releaseId = '';
  private busy = false;
  private generation = 0;
  override create(): void {
    this.generation++; this.busy = false; this.cards = [];
    super.create();
    this.onClose(() => this.generation++);
  }
  protected async build(): Promise<void> {
    const generation = this.generation;
    this.cards = []; this.busy = false;
    this.text(REF_W / 2, 420, 'Loading your unlocked readings…', { fontSize: '36px', color: T.dim }).setOrigin(0.5);
    try {
      const releaseId = await Services.ready().content.activeReleaseId();
      const result = await Services.api.library(releaseId);
      if (!this.isCurrentView() || generation !== this.generation) return;
      this.releaseId = releaseId; this.cards = result.entries; this.draw();
    } catch (error) {
      if (!this.isCurrentView() || generation !== this.generation) return;
      this.body.removeAll();
      this.text(REF_W / 2, 420, 'The archive is unavailable. Your progress is kept.', { fontSize: '36px', color: T.dim }).setOrigin(0.5);
      this.button(REF_W / 2, 600, { label: 'RETRY', w: 520, onClick: () => void this.refresh() });
      this.say(error instanceof Error ? error.message : String(error));
    }
  }
  private draw(): void {
    if (!this.isCurrentView()) return;
    this.body.removeAll();
    (['companion', 'codex', 'event'] as const).forEach((kind, i) => this.button(480 + i * 480, 210,
      { label: kind === 'companion' ? 'COMPANIONS' : kind === 'event' ? 'EVENTS' : 'CODEX', w: 440, h: 110, variant: this.category === kind ? 'hot' : 'normal', onClick: () => { this.category = kind; this.page = 0; this.draw(); } }).setEnabled(!this.busy));
    const cards = this.cards.filter((entry) => entry.kind === this.category);
    const pages = Math.max(1, Math.ceil(cards.length / 4)); this.page = Math.min(this.page, pages - 1);
    if (!cards.length) {
      this.text(REF_W / 2, 460, 'No readings are unlocked here yet. Continue the main story.\nCompanion parts also require the companion and the earlier part.', { fontSize: '34px', color: T.dim, align: 'center', wordWrap: { width: 1450 } }).setOrigin(0.5);
      this.button(REF_W / 2, 670, { label: 'CHAPTERS', w: 600, onClick: () => this.nav.start('Chapters') });
    }
    cards.slice(this.page * 4, this.page * 4 + 4).forEach((card, i) => this.button(560 + i % 2 * 800, 435 + Math.floor(i / 2) * 235,
      { label: card.title_en, sub: `${card.kind === 'companion' ? `Part ${card.part} · ` : ''}${card.completed ? 'READ · REPLAY' : 'READ'}`, w: 750, h: 190, fontSize: 38, onClick: () => void this.open(card) }).setEnabled(!this.busy));
    if (pages > 1) {
      this.button(760, 875, { label: 'PREVIOUS', w: 350, onClick: () => { this.page = (this.page + pages - 1) % pages; this.draw(); } }).setEnabled(!this.busy);
      this.button(1160, 875, { label: 'NEXT', w: 350, onClick: () => { this.page = (this.page + 1) % pages; this.draw(); } }).setEnabled(!this.busy);
    }
  }
  private async open(card: LibraryCard): Promise<void> {
    if (this.busy || !this.isCurrentView()) return;
    const generation = this.generation; const revision = Services.api.authRevision; const releaseId = this.releaseId;
    this.busy = true; this.draw(); this.say('Opening your reading…');
    try {
      const entry = await Services.api.libraryEntry(releaseId, card.entry_id, revision);
      if (!this.isCurrentView() || generation !== this.generation) return;
      this.nav.start('Story', this.reading(entry, 0, releaseId, revision));
    } catch (error) {
      if (!this.isCurrentView() || generation !== this.generation) return;
      this.say(error instanceof Error ? error.message : String(error)); this.busy = false; await this.refresh();
    }
  }
  private reading(entry: LibraryEntry, i: number, releaseId: string, revision: number): StoryInit {
    let saving = false; let closed = false;
    const leave = (scene: PixiScene<unknown>): void => { scene.nav.start('Library'); };
    const finish = async (scene: PixiScene<unknown>): Promise<void> => {
      if (saving || closed || !scene.live || Services.api.authRevision !== revision) return;
      if (i + 1 < entry.scenes.length) { scene.nav.restart(this.reading(entry, i + 1, releaseId, revision)); return; }
      saving = true;
      scene.onClose(() => { closed = true; });
      try {
        await Services.api.completeStory(releaseId, entry.entry_id, revision);
        if (!closed && scene.live && Services.api.authRevision === revision) leave(scene);
      } catch (error) {
        if (closed || !scene.live || Services.api.authRevision !== revision) return;
        storySaveFailed(scene, `Reading progress is not confirmed. ${error instanceof Error ? error.message : String(error)}`, () => void finish(scene), () => leave(scene));
      } finally { saving = false; }
    };
    return { path: entry.entry_id, data: entry.scenes[i]!, authRevision: revision, onBack: leave, onDone: (scene) => void finish(scene) };
  }
}

