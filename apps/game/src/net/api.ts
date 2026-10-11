import { API_BASE } from '../config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detail?: unknown
  ) {
    super(message);
  }
}

const KEY = 'uomd.session.v1';
interface Session {
  token: string;
  expiresAt: string;
}

/** D-17: one main currency. */
export interface Wallets {
  eclipse_token?: number;
}
export interface BannerInfo {
  id: string;
  title: string;
  kind: 'character' | 'weapon';
  pityGroup: string;
  startsAt: string | null;
  endsAt: string | null;
  hardPity: number;
  baseFiveStarRate: number;
  softPity: { startPull: number; increment: number } | null;
  featured: { chance: number; lossesToGuarantee: number; targetMode: 'fixed' | 'selectable' } | null;
  cost: { currency: 'eclipse_token'; perPull: number };
  minFourStarEvery: number;
  pools: { fiveFeatured: string[]; fiveOther: string[]; four: string[]; three: string[] };
  duplicateShards: Record<string, number>;
  analysis: { consolidatedFiveStarRate: number; expectedPullsPerFiveStar: number; expectedPullsPerTarget: number | null; worstCasePullsForTarget: number | null };
}
export interface PullRecord {
  seq: number;
  pullNumber: number;
  rarity: 3 | 4 | 5;
  itemId: string;
  outcome: string;
  duplicate: boolean;
  shards: number;
  upgraded: boolean;
}
export interface PullResponse {
  pulls: PullRecord[];
  balance: number;
  pity: { pity5: number; pity4: number; lost: number; hardPity: number };
  cost: { currency: 'eclipse_token'; perPull: number; amount: number };
  replayed: boolean;
}
/** What a reward can contain (mirrors the server's closed grammar). */
export type Attachment =
  | { type: 'currency'; currency: string; amount: number }
  | { type: 'character'; itemId: string }
  | { type: 'item'; itemId: string; quantity: number }
  | { type: 'gear'; gearId: string }
  | { type: 'account_xp'; amount: number };

export interface SkillView {
  skillId: string;
  type: string;
  name: string;
  rank: number;
  maxRank: number;
  next: { rank: number; unlockLevel: number; itemId: string; quantity: number; fee: number } | null;
}
export interface CharacterView {
  id: string;
  level: number;
  xp: number;
  xpToNext: number | null;
  ascension: number;
  cap: number;
  nextAscension: { cap: number; accountLevel: number; items: { itemId: string; quantity: number }[]; fee: number; requiresNode?: string } | null;
  skills: SkillView[];
}
export interface GearView {
  id: number;
  gearId: string;
  slot: 'weapon' | 'armor' | 'necklace' | 'ring';
  name: string;
  rarity: number;
  level: number;
  levelCap: number;
  equippedBy: string | null;
  locked: boolean;
  stats: { main: { stat: string; value: number }; subs: { stat: string; value: number }[] } | null;
  passive: { name: string; text?: string } | null;
}
export interface TaskView {
  id: string;
  title: string;
  objective: { type: string; count: number };
  progress: number;
  done: boolean;
  claimed: boolean;
  rewards: Attachment[];
}
export interface TasksResponse {
  serverTimeMs: number;
  daily: null | { periodKey: string; endsAtMs: number; tasks: TaskView[]; completion: { ready: boolean; claimed: boolean; rewards: Attachment[] } };
  weekly: (TaskView & { periodKey: string; endsAtMs: number; running: boolean })[];
}

export interface MailItem {
  id: number;
  kind: string;
  title: string;
  body: string;
  attachments: Attachment[];
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
}
export interface Product {
  productId: string;
  kind: 'consumable' | 'subscription';
  title: string;
  grants: { type: string; currency?: string; amount?: number; itemId?: string }[];
  subscription: { duration_days: number } | null;
}

export const newRequestId = (): string => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID().replaceAll('-', '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);

/** Typed client for the game API. The session token is an opaque bearer kept in localStorage (never logged). */
export class GameApi extends EventTarget {
  private session: Session | null = null;

  constructor(private readonly base = API_BASE) {
    super();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as Session;
        if (typeof s.token === 'string' && Date.parse(s.expiresAt) > Date.now()) this.session = s;
      }
    } catch {
      /* private mode: stay signed out */
    }
  }

  get signedIn(): boolean {
    return this.session !== null;
  }

  private store(s: Session | null): void {
    this.session = s;
    try {
      if (s) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    this.dispatchEvent(new Event('auth'));
  }

  /** Raw typed call. Public so the browser test harness can reach endpoints the UI does not wrap yet. */
  async call<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(auth && this.session ? { Authorization: `Bearer ${this.session.token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON error page */
    }
    if (!res.ok) {
      const e = (json ?? {}) as { error?: string; message?: string; detail?: unknown };
      if (res.status === 401 && auth && this.session) this.store(null); // expired or revoked: back to signed out
      throw new ApiError(res.status, e.error ?? 'http_error', e.message ?? `HTTP ${res.status}`, e.detail);
    }
    return json as T;
  }

  async signInWithIdToken(idToken: string): Promise<{ id: string; displayName: string | null; isNew: boolean }> {
    const r = await this.call<{ token: string; expiresAt: string; player: { id: string; displayName: string | null; isNew: boolean } }>('POST', '/api/v1/auth/google', { idToken }, false);
    this.store({ token: r.token, expiresAt: r.expiresAt });
    return r.player;
  }

  async signOut(): Promise<void> {
    try {
      await this.call('POST', '/api/v1/auth/logout', {});
    } catch {
      /* the server may already have dropped the session */
    }
    this.store(null);
  }

  me = (): Promise<{ id: string; displayName: string | null; createdAt: string; billingTag: string }> => this.call('GET', '/api/v1/me');
  async wallet(): Promise<Wallets> {
    return (await this.call<{ wallets: Wallets }>('GET', '/api/v1/wallet')).wallets;
  }
  async inventory(): Promise<{ item_type: string; item_id: string; copies: number; shards: number }[]> {
    return (await this.call<{ items: { item_type: string; item_id: string; copies: number; shards: number }[] }>('GET', '/api/v1/inventory')).items;
  }
  async roster(): Promise<{ id: string; name_en: string; rarity: number; element: string; role: string }[]> {
    return (await this.call<{ characters: { id: string; name_en: string; rarity: number; element: string; role: string }[] }>('GET', '/api/v1/characters', undefined, false)).characters;
  }
  async banners(): Promise<BannerInfo[]> {
    return (await this.call<{ banners: BannerInfo[] }>('GET', '/api/v1/banners', undefined, false)).banners;
  }
  async gachaState(): Promise<{ pity_group: string; pity5: number; pity4: number; lost: number }[]> {
    return (await this.call<{ pity: { pity_group: string; pity5: number; pity4: number; lost: number }[] }>('GET', '/api/v1/gacha/state')).pity;
  }
  pull(bannerId: string, count: 1 | 10, target?: string): Promise<PullResponse> {
    return this.call('POST', '/api/v1/gacha/pull', { bannerId, count, requestId: newRequestId(), ...(target ? { target } : {}) });
  }
  async history(): Promise<{ id: number; banner_id: string; pull_number: number; rarity: number; item_id: string; outcome: string; duplicate: number; at: string }[]> {
    return (await this.call<{ pulls: { id: number; banner_id: string; pull_number: number; rarity: number; item_id: string; outcome: string; duplicate: number; at: string }[] }>('GET', '/api/v1/gacha/history?limit=40')).pulls;
  }
  async mail(): Promise<MailItem[]> {
    return (await this.call<{ mail: MailItem[] }>('GET', '/api/v1/mail')).mail;
  }
  claimMail(id: number): Promise<{ claimed: MailItem['attachments'] }> {
    return this.call('POST', `/api/v1/mail/${id}/claim`, {});
  }
  async products(): Promise<Product[]> {
    return (await this.call<{ products: Product[] }>('GET', '/api/v1/shop/products', undefined, false)).products;
  }
  adStatus(): Promise<{ windowViews: number; perWindow: number; reward: number; nextSlotAt: string | null }> {
    return this.call('GET', '/api/v1/ads/status');
  }
  progress(): Promise<{ nodes: { node_id: string; stars: number; clears: number }[]; ration: { value: number; cap: number; nextMs: number } }> {
    return this.call('GET', '/api/v1/progress');
  }
  submitBattle(releaseId: string, nodeId: string, actions: { skillId: string; targetId?: string }[]): Promise<{ stars: number; firstClear: boolean; rewards: MailItem['attachments']; ration: { spent: number; value: number } }> {
    return this.call('POST', '/api/v1/progress/battle', { releaseId, nodeId, requestId: newRequestId(), actions });
  }
  readSave(): Promise<{ version: number; data: Record<string, unknown>; updatedAt: string | null }> {
    return this.call('GET', '/api/v1/save');
  }
  writeSave(expectedVersion: number, data: Record<string, unknown>): Promise<{ version: number }> {
    return this.call('PUT', '/api/v1/save', { expectedVersion, data });
  }
  characters(): Promise<{ account: { level: number; xp: number }; characters: CharacterView[] }> {
    return this.call('GET', '/api/v1/characters/mine');
  }
  levelUp(id: string, items: { itemId: string; quantity: number }[]): Promise<{ level: number }> {
    return this.call('POST', `/api/v1/characters/${id}/level-up`, { requestId: newRequestId(), items });
  }
  ascend(id: string): Promise<{ ascension: number }> {
    return this.call('POST', `/api/v1/characters/${id}/ascend`, { requestId: newRequestId() });
  }
  upgradeSkill(id: string, skillId: string): Promise<{ rank: number }> {
    return this.call('POST', `/api/v1/characters/${id}/skills/${skillId}/upgrade`, { requestId: newRequestId() });
  }
  characterStats(id: string): Promise<{ level: number; stats: Record<string, number> }> {
    return this.call('GET', `/api/v1/characters/${id}/stats`);
  }
  async stacks(): Promise<{ item_id: string; qty: number }[]> {
    return (await this.call<{ stacks: { item_id: string; qty: number }[] }>('GET', '/api/v1/stacks')).stacks;
  }
  async gear(): Promise<GearView[]> {
    return (await this.call<{ gear: GearView[] }>('GET', '/api/v1/gear')).gear;
  }
  equip(gearId: number, characterId: string): Promise<unknown> {
    return this.call('POST', `/api/v1/gear/${gearId}/equip`, { characterId });
  }
  unequip(gearId: number): Promise<unknown> {
    return this.call('POST', `/api/v1/gear/${gearId}/unequip`, {});
  }
  tasks(): Promise<TasksResponse> {
    return this.call('GET', '/api/v1/tasks');
  }
  claimTask(periodKey: string, taskId: string): Promise<unknown> {
    return this.call('POST', '/api/v1/tasks/claim', { periodKey, taskId });
  }
  exportAccount(): Promise<Record<string, unknown>> {
    return this.call('GET', '/api/v1/account/export');
  }
  async deleteAccount(): Promise<void> {
    await this.call('POST', '/api/v1/account/delete', { confirm: 'DELETE' });
    this.store(null);
  }
  async catalogNames(): Promise<Map<string, string>> {
    const c = await this.call<{ items: { item_id: string; name_en: string; xp_value: number | null; kind: string }[]; gear: { gear_id: string; name_en: string }[] }>('GET', '/api/v1/catalog', undefined, false);
    this.xpItems = c.items.filter((i) => i.kind === 'character_xp' && i.xp_value).map((i) => ({ itemId: i.item_id, xp: i.xp_value as number })).sort((a, b) => a.xp - b.xp);
    return new Map([...c.items.map((i): [string, string] => [i.item_id, i.name_en]), ...c.gear.map((g): [string, string] => [g.gear_id, g.name_en])]);
  }
  /** character-XP items by ascending xp value (filled by catalogNames) */
  xpItems: { itemId: string; xp: number }[] = [];
  async flags(): Promise<Record<string, { enabled: boolean; value: unknown }>> {
    return (await this.call<{ flags: Record<string, { enabled: boolean; value: unknown }> }>('GET', '/api/v1/flags', undefined, false)).flags;
  }
}
