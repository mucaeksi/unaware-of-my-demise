import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { claimMail, sendMail } from '../src/mail/service';
import { game, post, signIn } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;
let n = 0;
const key = (): string => `k_${++n}_${Math.random().toString(36).slice(2, 8)}`;

async function ensureCharacter(id: string, rarity: number): Promise<void> {
  await db()
    .prepare("INSERT OR IGNORE INTO characters (id, name_en, rarity, element, role, age, acquisition, base_hp, base_atk, base_def, base_spd) VALUES (?1,?1,?2,'Stone','tank',20,'gacha',10,2,2,4)")
    .bind(id, rarity)
    .run();
}

describe('mailbox', () => {
  it('a durable claim identity replays one original result for concurrent retries', async () => {
    const { auth, playerId } = await signIn(`sub-mail-operation-${key()}`); const requestId = key();
    const { id } = await sendMail(db(), playerId, { kind: 'reward', title: 'Recovery fixture', attachments: [{ type: 'currency', currency: 'eclipse_token', amount: 10 }] }, 'test');
    const responses = await Promise.all(Array.from({ length: 8 }, () => game(`/api/v1/mail/${id}/claim`, post({ requestId }, auth))));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    const results = await Promise.all(responses.map((r) => r.json()));
    expect(results.every((r) => (r as { requestId: string }).requestId === requestId)).toBe(true);
    expect(await (await game('/api/v1/wallet', { headers: auth })).json()).toEqual({ wallets: { eclipse_token: 10 } });
    const status = await game(`/api/v1/operations/${requestId}?path=${encodeURIComponent(`/api/v1/mail/${id}/claim`)}`, { headers: auth });
    expect(status.status).toBe(200); expect(await status.json()).toMatchObject({ state: 'confirmed', binding: 'exact', result: { requestId, mailId: id } });
  });

  it('a claim journal failure rolls back the marker and reward; an identity cannot claim a different mail', async () => {
    const { auth, playerId } = await signIn(`sub-mail-journal-${key()}`); const requestId = key();
    const { id } = await sendMail(db(), playerId, { kind: 'reward', title: 'Atomic fixture', attachments: [{ type: 'currency', currency: 'eclipse_token', amount: 10 }] }, 'test');
    await db().prepare("CREATE TRIGGER reject_claim_journal BEFORE INSERT ON progression_requests WHEN NEW.kind LIKE 'mail_claim:%' BEGIN SELECT RAISE(ABORT, 'isolated claim journal failure'); END").run();
    try {
      expect((await game(`/api/v1/mail/${id}/claim`, post({ requestId }, auth))).status).toBe(500);
      expect((await db().prepare('SELECT claimed_at FROM mail WHERE id = ?1').bind(id).first<{ claimed_at: string | null }>())?.claimed_at).toBeNull();
      expect(await db().prepare('SELECT COUNT(*) AS n FROM ledger WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
    } finally { await db().prepare('DROP TRIGGER reject_claim_journal').run(); }
    expect((await game(`/api/v1/mail/${id}/claim`, post({ requestId }, auth))).status).toBe(200);
    const second = await sendMail(db(), playerId, { kind: 'reward', title: 'Different fixture', attachments: [{ type: 'currency', currency: 'eclipse_token', amount: 20 }] }, 'test');
    expect((await game(`/api/v1/mail/${second.id}/claim`, post({ requestId }, auth))).status).toBe(409);
    expect((await db().prepare('SELECT claimed_at FROM mail WHERE id = ?1').bind(second.id).first<{ claimed_at: string | null }>())?.claimed_at).toBeNull();
  });

  it('lists, reads and claims a reward mail atomically; a second claim is refused', async () => {
    const { auth, playerId } = await signIn(`sub-mail-${key()}`);
    const { id } = await sendMail(db(), playerId, { kind: 'compensation', title: 'Sorry for the downtime', body: 'Thanks', attachments: [{ type: 'currency', currency: 'eclipse_token', amount: 320 }, { type: 'currency', currency: 'eclipse_token', amount: 5000 }], expiresInDays: 7 }, 'ops');
    const list = (await (await game('/api/v1/mail', { headers: auth })).json()) as { mail: { id: number; claimed_at: string | null }[] };
    expect(list.mail.map((m) => m.id)).toEqual([id]);
    expect((await game(`/api/v1/mail/${id}/read`, post({}, auth))).status).toBe(200);
    const claim = await game(`/api/v1/mail/${id}/claim`, post({}, auth));
    expect(claim.status).toBe(200);
    expect(await (await game('/api/v1/wallet', { headers: auth })).json()).toEqual({ wallets: { eclipse_token: 5320 } });
    const again = await game(`/api/v1/mail/${id}/claim`, post({}, auth));
    expect(again.status).toBe(409);
    expect(await (await game('/api/v1/wallet', { headers: auth })).json()).toEqual({ wallets: { eclipse_token: 5320 } });
  });

  it('30 simultaneous claims of the same mail grant it exactly once', async () => {
    const { auth, playerId } = await signIn(`sub-mailrace-${key()}`);
    const { id } = await sendMail(db(), playerId, { kind: 'reward', title: 'Race', attachments: [{ type: 'currency', currency: 'eclipse_token', amount: 10 }] }, 'ops');
    const rs = await Promise.all(Array.from({ length: 30 }, () => game(`/api/v1/mail/${id}/claim`, post({}, auth))));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409 || r.status === 429)).toHaveLength(29);
    const w = await db().prepare("SELECT balance FROM wallets WHERE player_id = ?1 AND currency = 'eclipse_token'").bind(playerId).first<{ balance: number }>();
    expect(w?.balance).toBe(10);
  });

  it("nobody can claim or read another player's mail; expired mail cannot be claimed", async () => {
    const a = await signIn(`sub-a-${key()}`);
    const b = await signIn(`sub-b-${key()}`);
    const { id } = await sendMail(db(), a.playerId, { kind: 'reward', title: 'Private', attachments: [{ type: 'currency', currency: 'eclipse_token', amount: 1 }] }, 'ops');
    expect((await game(`/api/v1/mail/${id}/claim`, post({}, b.auth))).status).toBe(404);
    expect(((await (await game('/api/v1/mail', { headers: b.auth })).json()) as { mail: unknown[] }).mail).toHaveLength(0);
    const old = new Date(Date.now() - 20 * 86_400_000);
    const exp = await sendMail(db(), a.playerId, { kind: 'reward', title: 'Old', attachments: [{ type: 'currency', currency: 'eclipse_token', amount: 1 }], expiresInDays: 7 }, 'ops', old);
    expect((await game(`/api/v1/mail/${exp.id}/claim`, post({}, a.auth))).status).toBe(409);
    expect((await game('/api/v1/mail/abc/claim', post({}, a.auth))).status).toBe(400);
  });

  it('a sourceKey makes creation idempotent; attachments and recipient are immutable; mail is never deleted', async () => {
    const { playerId } = await signIn(`sub-idem-${key()}`);
    await db().prepare("INSERT INTO purchases (order_id, player_id, product_id, kind, token_hash, period_start, period_end) VALUES ('ORDER1', ?1, 'eclipse_blessing_30d', 'subscription', ?2, ?3, ?4)")
      .bind(playerId, 'f'.repeat(64), new Date(Date.now() - 3_600_000).toISOString(), new Date(Date.now() + 30 * 86_400_000).toISOString()).run();
    const m = { kind: 'subscription' as const, title: 'Half-day blessing', attachments: [{ type: 'currency' as const, currency: 'eclipse_token' as const, amount: 187 }], sourceKey: 'sub:ORDER1:halfday:1' };
    const first = await sendMail(db(), playerId, m, 'system');
    const second = await sendMail(db(), playerId, m, 'system');
    expect(first.created).toBe(true);
    expect(second).toEqual({ id: first.id, created: false });
    await expect(db().prepare("UPDATE mail SET attachments = '[]' WHERE id = ?1").bind(first.id).run()).rejects.toThrow(/immutable/);
    await expect(db().prepare("UPDATE mail SET player_id = 'x' WHERE id = ?1").bind(first.id).run()).rejects.toThrow();
    await expect(db().prepare('DELETE FROM mail WHERE id = ?1').bind(first.id).run()).rejects.toThrow(/retained/);
  });

  it('cannot create subscription mail without a matching paid period', async () => {
    const { playerId } = await signIn(`sub-unbound-mail-${key()}`);
    await expect(sendMail(db(), playerId, { kind: 'subscription', title: 'Unverified', sourceKey: 'sub:unknown:hd:1', attachments: [{ type: 'currency', currency: 'eclipse_token', amount: 187 }] }, 'system')).rejects.toMatchObject({ code: 'entitlement_unavailable' });
    expect(await db().prepare('SELECT COUNT(*) AS n FROM mail WHERE player_id = ?1').bind(playerId).first()).toEqual({ n: 0 });
  });

  it('character attachments grant a new character, or Memory Shards when the character is already owned', async () => {
    await ensureCharacter('mail_hero', 4);
    const { auth, playerId } = await signIn(`sub-char-${key()}`);
    const att = [{ type: 'character' as const, itemId: 'mail_hero' }];
    const m1 = await sendMail(db(), playerId, { kind: 'event', title: 'Hero', attachments: att }, 'ops');
    const m2 = await sendMail(db(), playerId, { kind: 'event', title: 'Hero again', attachments: att }, 'ops');
    await claimMail(db(), playerId, m1.id);
    await claimMail(db(), playerId, m2.id);
    const inv = (await (await game('/api/v1/inventory', { headers: auth })).json()) as { items: { item_id: string; copies: number; shards: number }[] };
    expect(inv.items.find((i) => i.item_id === 'mail_hero')).toMatchObject({ copies: 2, shards: 5 });
    const bad = await sendMail(db(), playerId, { kind: 'event', title: 'Ghost', attachments: [{ type: 'character', itemId: 'no_such_hero' }] }, 'ops');
    await expect(claimMail(db(), playerId, bad.id)).rejects.toMatchObject({ code: 'unknown_item' });
    // the failed claim left the mail claimable and granted nothing
    expect((await db().prepare('SELECT claimed_at FROM mail WHERE id = ?1').bind(bad.id).first<{ claimed_at: string | null }>())?.claimed_at).toBeNull();
  });

  it('rejects malformed mail definitions', async () => {
    const { playerId } = await signIn(`sub-bad-${key()}`);
    await expect(sendMail(db(), playerId, { kind: 'reward', title: '', attachments: [] } as never, 'ops')).rejects.toThrow();
    await expect(sendMail(db(), playerId, { kind: 'reward', title: 'x', attachments: [{ type: 'currency', currency: 'gems', amount: 5 }] } as never, 'ops')).rejects.toThrow();
    await expect(sendMail(db(), playerId, { kind: 'reward', title: 'x', attachments: [{ type: 'currency', currency: 'eclipse_token', amount: -5 }] } as never, 'ops')).rejects.toThrow();
  });
});
