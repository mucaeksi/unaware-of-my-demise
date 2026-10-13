import type { BattleParty } from '@uomd/content-schema';
import { API_BASE } from '../config';
import { OperationJournal, type OperationRecord } from './operations';
import { canonicalJson, sha256Hex } from '@uomd/shared';

export interface TeamMember {
  characterId: string;
  slot: number;
  row: 'front' | 'rear';
}
export interface TeamPreset {
  slot: number;
  name: string;
  active: boolean;
  members: TeamMember[];
}

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

export interface EntryCheckpoint {
  phase: 'not_started' | 'in_progress' | 'completed';
  prologue: boolean;
  tutorials: number;
  updatedAt: string | null;
  playerId: string;
}

export const newRequestId = (): string => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID().replaceAll('-', '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);

/** Typed client for the game API. The session token is an opaque bearer kept in localStorage (never logged). */
export class GameApi extends EventTarget {
  private session: Session | null = null;
  private authVersion = 0;
  private verifiedAccount: { version: number; id: string } | null = null;
  private signingIn = 0;
  private activeOperations = new Map<string, Promise<unknown>>();

  constructor(private readonly base = API_BASE, private readonly journal = new OperationJournal()) {
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
    this.authVersion++;
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
    const requestSession = this.session;
    const requestAuthVersion = this.authVersion;
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(auth && requestSession ? { Authorization: `Bearer ${requestSession.token}` } : {}) },
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
      if (res.status === 401 && auth && requestSession && this.session === requestSession && this.authVersion === requestAuthVersion) this.store(null);
      throw new ApiError(res.status, e.error ?? 'http_error', e.message ?? `HTTP ${res.status}`, e.detail);
    }
    return json as T;
  }

  async signInWithIdToken(idToken: string): Promise<{ id: string; displayName: string | null; isNew: boolean }> {
    const attempt = ++this.authVersion;
    this.signingIn = attempt;
    try {
      const r = await this.call<{ token: string; expiresAt: string; player: { id: string; displayName: string | null; isNew: boolean } }>('POST', '/api/v1/auth/google', { idToken }, false);
      if (this.authVersion !== attempt) throw new ApiError(409, 'auth_changed', 'The selected account changed before sign-in completed');
      this.store({ token: r.token, expiresAt: r.expiresAt });
      this.verifiedAccount = { version: this.authVersion, id: r.player.id };
      return r.player;
    } finally { if (this.signingIn === attempt) this.signingIn = 0; }
  }

  async signOut(): Promise<void> {
    this.signingIn = 0;
    const request = this.call('POST', '/api/v1/auth/logout', {});
    this.store(null); // End local authority immediately; the request already captured the old bearer.
    try {
      await request;
    } catch {
      /* the server may already have dropped the session */
    }
  }

  private async accountScope(): Promise<{ scope: string; version: number }> {
    const version = this.authVersion;
    if (!this.session) throw new ApiError(401, 'signed_out', 'Sign in to continue');
    if (this.signingIn) throw new ApiError(409, 'auth_changed', 'Finish selecting your account before starting an action');
    if (this.verifiedAccount?.version !== version) {
      const profile = await this.me();
      if (version !== this.authVersion || !this.session) throw new ApiError(409, 'auth_changed', 'The account changed');
      if (!profile || typeof profile.id !== 'string' || !profile.id) throw new ApiError(503, 'invalid_response', 'Account confirmation is unavailable');
      this.verifiedAccount = { version, id: profile.id };
    }
    const origin = typeof location === 'undefined' ? 'https://local.invalid' : location.origin;
    return { scope: JSON.stringify([new URL(this.base || '/', origin).href, this.verifiedAccount.id]), version };
  }

  private async executeOperation<T>(operation: OperationRecord, version: number): Promise<T> {
    const checked = await this.journal.get(operation.scope, operation.id);
    if (!checked) throw new ApiError(409, 'operation_missing', 'This saved action is unavailable');
    if (version !== this.authVersion) throw new ApiError(409, 'auth_changed', 'The account changed');
    if (checked.state === 'confirmed') return structuredClone(checked.result) as T;
    if (checked.state === 'rejected') throw new ApiError(409, checked.code ?? 'operation_rejected', 'The saved action was rejected');
    const active = this.activeOperations.get(checked.id);
    if (active) return active as Promise<T>;
    const request = (async () => {
      const attempts = await this.journal.attempt(checked.scope, checked.id);
      if (version !== this.authVersion) throw new ApiError(409, 'auth_changed', 'The account changed');
      let result: unknown;
      try {
        result = await this.call('POST', checked.path, checked.body);
        this.validateOperationResult(checked, result);
      } catch (error) {
        const definite = attempts === 1 && error instanceof ApiError && ([400, 402, 403, 404, 413, 422].includes(error.status)
          || error.status === 409 && ['already_claimed', 'expired', 'revoked', 'period_closed', 'not_done', 'at_cap', 'not_at_cap', 'max_rank', 'max_ascension',
            'account_level_too_low', 'level_too_low', 'story_gate', 'equipped', 'locked', 'request_id_reused', 'entitlement_unavailable', 'release_not_economic'].includes(error.code));
        await this.journal.finish(checked.scope, checked.id, definite ? 'rejected' : 'pending', undefined, error instanceof ApiError ? error.code : 'confirmation_pending');
        this.dispatchEvent(new Event('operations'));
        throw error;
      }
      await this.journal.finish(checked.scope, checked.id, 'confirmed', result);
      this.dispatchEvent(new Event('operations'));
      if (version !== this.authVersion) throw new ApiError(409, 'auth_changed', 'The action was recorded for the previous account');
      return result as T;
    })();
    this.activeOperations.set(checked.id, request);
    try { return await request as T; } finally { if (this.activeOperations.get(checked.id) === request) this.activeOperations.delete(checked.id); }
  }

  private async mutate<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const snapshot = structuredClone(body);
    const { scope, version } = await this.accountScope();
    let operation: OperationRecord;
    try { operation = await this.journal.begin(scope, 'POST', path, snapshot); }
    catch (error) { throw new ApiError(409, 'operation_not_saved', error instanceof Error ? error.message : 'The action could not be saved; no request was sent'); }
    this.dispatchEvent(new Event('operations'));
    return this.executeOperation<T>(operation, version);
  }
  async operations(): Promise<OperationRecord[]> {
    return this.journal.list((await this.accountScope()).scope);
  }
  private validateOperationResult(operation: OperationRecord, result: unknown): void {
    const value = result as { requestId?: string; pulls?: unknown[]; nodeId?: string; character?: string; level?: number; id?: number;
      ascension?: number; skillId?: string; rank?: number; stats?: { subs?: unknown[] }; gained?: unknown[];
      mailId?: number; claimed?: unknown[]; periodKey?: string; taskId?: string; rewards?: unknown[] } | null;
    if (!value || typeof value !== 'object'
      || operation.path === '/api/v1/gacha/pull' && (value.requestId !== operation.id || !Array.isArray(value.pulls) || value.pulls.length !== operation.body.count)
      || operation.path === '/api/v1/progress/battle' && (value.requestId !== operation.id || value.nodeId !== operation.body.nodeId)
      || operation.path.startsWith('/api/v1/characters/') && (value.character !== operation.path.split('/')[4] || !Number.isSafeInteger(value.level)
        || operation.path.endsWith('/ascend') && !Number.isSafeInteger(value.ascension)
        || operation.path.endsWith('/upgrade') && (value.skillId !== operation.path.split('/')[6] || !Number.isSafeInteger(value.rank)))
      || operation.path.startsWith('/api/v1/gear/') && (value.id !== Number(operation.path.split('/')[4])
        || operation.path.endsWith('/level-up') && !Number.isSafeInteger(value.level)
        || operation.path.endsWith('/ascend') && !Number.isSafeInteger(value.ascension)
        || operation.path.endsWith('/reroll') && !Array.isArray(value.stats?.subs)
        || operation.path.endsWith('/dismantle') && !Array.isArray(value.gained))
      || operation.path.startsWith('/api/v1/mail/') && (value.requestId !== operation.id || value.mailId !== Number(operation.path.split('/')[4]) || !Array.isArray(value.claimed))
      || operation.path === '/api/v1/tasks/claim' && (value.requestId !== operation.id || value.taskId !== operation.body.taskId || value.periodKey !== operation.body.periodKey || !Array.isArray(value.rewards)))
      throw new ApiError(503, 'invalid_response', 'The action has not been confirmed');
  }
  async retryOperation<T>(id: string): Promise<T> {
    const { scope, version } = await this.accountScope();
    const operation = await this.journal.get(scope, id);
    if (!operation) throw new ApiError(409, 'operation_missing', 'This action does not belong to the selected account');
    if (operation.state !== 'rejected' && operation.attempts > 0) {
      const status = await this.call<{ requestId: string; path: string; state: string; binding: string | null; inputHash: string | null; result: unknown }>('GET', `/api/v1/operations/${id}?path=${encodeURIComponent(operation.path)}`);
      if (version !== this.authVersion) throw new ApiError(409, 'auth_changed', 'The account changed');
      if (!status || status.requestId !== id || status.path !== operation.path || !['confirmed', 'unknown'].includes(status.state))
        throw new ApiError(503, 'invalid_response', 'The saved action has not been confirmed');
      if (status.state === 'confirmed') {
        if (status.binding !== 'exact' || status.inputHash !== await sha256Hex(canonicalJson(operation.body)))
          throw new ApiError(409, 'operation_unverified', 'The original action details could not be verified');
        this.validateOperationResult(operation, status.result);
        await this.journal.finish(scope, id, 'confirmed', status.result);
        this.dispatchEvent(new Event('operations'));
        if (version !== this.authVersion) throw new ApiError(409, 'auth_changed', 'The account changed');
        return status.result as T;
      }
      if (operation.state === 'confirmed') throw new ApiError(503, 'operation_unverified', 'The recorded action is unavailable on the server');
    }
    return this.executeOperation<T>(operation, version);
  }

  entry = (): Promise<EntryCheckpoint> => this.call('GET', '/api/v1/entry');
  putEntry = (b: { prologue: boolean; tutorials: number; completed?: boolean }): Promise<EntryCheckpoint> => this.call('PUT', '/api/v1/entry', b);

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
    return this.mutate('/api/v1/gacha/pull', { bannerId, count, ...(target ? { target } : {}) });
  }
  async history(): Promise<{ id: number; banner_id: string; pull_number: number; rarity: number; item_id: string; outcome: string; duplicate: number; at: string }[]> {
    return (await this.call<{ pulls: { id: number; banner_id: string; pull_number: number; rarity: number; item_id: string; outcome: string; duplicate: number; at: string }[] }>('GET', '/api/v1/gacha/history?limit=40')).pulls;
  }
  async mail(): Promise<MailItem[]> {
    return (await this.call<{ mail: MailItem[] }>('GET', '/api/v1/mail')).mail;
  }
  claimMail(id: number): Promise<{ claimed: MailItem['attachments'] }> {
    return this.mutate(`/api/v1/mail/${id}/claim`, {});
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
  submitBattle(releaseId: string, nodeId: string, actions: { skillId: string; targetId?: string }[], sessionId?: string): Promise<{ stars: number; firstClear: boolean; rewards: MailItem['attachments']; repeatRewardsAllowed?: boolean; ration: { spent: number; value: number } }> {
    return this.mutate('/api/v1/progress/battle', { releaseId, nodeId, actions, ...(sessionId ? { sessionId } : {}) });
  }
  /** Owned-hero stages: the server freezes the party (team, gear stats, ranks, story loans) the battle must be fought with. */
  startBattle(releaseId: string, nodeId: string): Promise<{ sessionId: string | null; party: BattleParty | null; expiresAt: string | null }> {
    return this.call('POST', '/api/v1/progress/battle/start', { releaseId, nodeId });
  }
  teams(): Promise<{ teams: TeamPreset[] }> {
    return this.call('GET', '/api/v1/teams');
  }
  saveTeam(slot: number, name: string, members: TeamMember[]): Promise<unknown> {
    return this.call('PUT', `/api/v1/teams/${slot}`, { name, members });
  }
  activateTeam(slot: number): Promise<unknown> {
    return this.call('POST', `/api/v1/teams/${slot}/activate`, {});
  }
  deleteTeam(slot: number): Promise<unknown> {
    return this.call('DELETE', `/api/v1/teams/${slot}`);
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
    return this.mutate(`/api/v1/characters/${id}/level-up`, { items });
  }
  ascend(id: string): Promise<{ ascension: number }> {
    return this.mutate(`/api/v1/characters/${id}/ascend`, {});
  }
  upgradeSkill(id: string, skillId: string): Promise<{ rank: number }> {
    return this.mutate(`/api/v1/characters/${id}/skills/${skillId}/upgrade`, {});
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
  levelGear(id: number, xp: number): Promise<{ id: number; level: number }> {
    return this.mutate(`/api/v1/gear/${id}/level-up`, { xp });
  }
  ascendGear(id: number): Promise<{ id: number; ascension: number }> {
    return this.mutate(`/api/v1/gear/${id}/ascend`, {});
  }
  rerollGear(id: number): Promise<{ id: number; stats: GearView['stats'] }> {
    return this.mutate(`/api/v1/gear/${id}/reroll`, {});
  }
  dismantleGear(id: number): Promise<{ id: number; gained: { itemId: string; quantity: number }[] }> {
    return this.mutate(`/api/v1/gear/${id}/dismantle`, {});
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
    return this.mutate('/api/v1/tasks/claim', { periodKey, taskId });
  }
  exportAccount(): Promise<Record<string, unknown>> {
    return this.call('GET', '/api/v1/account/export');
  }
  async deleteAccount(): Promise<void> {
    const version = this.authVersion;
    await this.call('POST', '/api/v1/account/delete', { confirm: 'DELETE' });
    if (this.authVersion === version) this.store(null);
  }
  async catalogNames(): Promise<Map<string, string>> {
    const c = await this.call<{ items: { item_id: string; name_en: string; xp_value: number | null; kind: string }[]; gear: { gear_id: string; name_en: string }[] }>('GET', '/api/v1/catalog', undefined, false);
    this.xpItems = c.items.filter((i) => i.kind === 'character_xp' && i.xp_value).map((i) => ({ itemId: i.item_id, xp: i.xp_value as number })).sort((a, b) => a.xp - b.xp);
    return new Map([...c.items.map((i): [string, string] => [i.item_id, i.name_en]), ...c.gear.map((g): [string, string] => [g.gear_id, g.name_en])]);
  }
  /** character-XP items by ascending xp value (filled by catalogNames) */
  xpItems: { itemId: string; xp: number }[] = [];
  verifyPurchase(productId: string, purchaseToken: string): Promise<{ status: string; orderId?: string }> {
    return this.call('POST', '/api/v1/shop/verify', { productId, purchaseToken });
  }
  adBegin(): Promise<{ nonce: string }> {
    return this.call('POST', '/api/v1/ads/begin', {});
  }
  async flags(): Promise<Record<string, { enabled: boolean; value: unknown }>> {
    return (await this.call<{ flags: Record<string, { enabled: boolean; value: unknown }> }>('GET', '/api/v1/flags', undefined, false)).flags;
  }
}
