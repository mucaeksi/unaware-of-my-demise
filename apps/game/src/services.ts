import type Phaser from 'phaser';
import { ArtLibrary } from './content/ArtLibrary';
import { type ContentService } from './content/ContentService';
import { GameApi } from './net/api';
import { type IdentityProvider } from './net/identity';
import { PatchService } from './patch/PatchService';

/** Process-wide singletons the scenes share (there is exactly one content stack per page). */
export const Services = {
  content: null as ContentService | null,
  art: null as ArtLibrary | null,
  api: new GameApi(),
  identity: null as IdentityProvider | null,
  /** first-install background download (stages the release; the restart switches it on) */
  patches: null as unknown as PatchService,

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

Services.patches = new PatchService(() => Services.content);

export type NodeRef = { chapterId: string; nodeId: string };

const KEY = 'uomd.progress.v1';
const progressKey = (): string => (Services.api.accountKey === 'guest' ? KEY : `${KEY}:${Services.api.accountKey}`);

/** Account-scoped local progress record (reconciled with server progression when signed in). */
export const Progress = {
  load(): Record<string, { stars: number }> {
    try {
      return JSON.parse(localStorage.getItem(progressKey()) ?? '{}') as Record<string, { stars: number }>;
    } catch {
      return {};
    }
  },
  complete(nodeId: string, stars: number): void {
    const p = this.load();
    p[nodeId] = { stars: Math.max(p[nodeId]?.stars ?? 0, stars) };
    try {
      localStorage.setItem(progressKey(), JSON.stringify(p));
    } catch {
      /* ignore */
    }
  },
  reset(): void {
    try {
      localStorage.removeItem(progressKey());
    } catch {
      /* ignore */
    }
  }
};

