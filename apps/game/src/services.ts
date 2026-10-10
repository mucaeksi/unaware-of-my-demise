import type Phaser from 'phaser';
import { ArtLibrary } from './content/ArtLibrary';
import { type ContentService } from './content/ContentService';

/** Process-wide singletons the scenes share (there is exactly one content stack per page). */
export const Services = {
  content: null as ContentService | null,
  art: null as ArtLibrary | null,

  ready(): { content: ContentService; art: ArtLibrary } {
    if (!this.content || !this.art) throw new Error('services not initialised');
    return { content: this.content, art: this.art };
  },

  /** Rebuilds the art library from the active art manifest (after boot and after every patch). */
  async refreshArt(): Promise<ArtLibrary> {
    if (!this.content) throw new Error('content service missing');
    this.art = new ArtLibrary(this.content, await this.content.art());
    return this.art;
  },

  emit(game: Phaser.Game, event: string): void {
    game.events.emit(event);
  }
};

export type NodeRef = { chapterId: string; nodeId: string };

const KEY = 'uomd.progress.v1';

/** Tiny local progress record for the preview (server-side progression comes with accounts). */
export const Progress = {
  load(): Record<string, { stars: number }> {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, { stars: number }>;
    } catch {
      return {};
    }
  },
  complete(nodeId: string, stars: number): void {
    const p = this.load();
    p[nodeId] = { stars: Math.max(p[nodeId]?.stars ?? 0, stars) };
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  },
  reset(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
};
