import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import { GOOGLE_CLIENT, game, googleIdToken, post, signIn } from './helpers';

const db = (): D1Database => (env as unknown as { DB: D1Database }).DB;

async function seedFreeStart(): Promise<void> {
  await db().batch([
    db().prepare("INSERT OR IGNORE INTO characters (id, name_en, rarity, element, role, age, acquisition, base_vit, base_str, base_int, base_agi) VALUES ('mahmut','Mahmut',5,'Stone','tank',28,'free_start',14,2,2,4)"),
    db().prepare("INSERT OR IGNORE INTO characters (id, name_en, rarity, element, role, age, acquisition, base_vit, base_str, base_int, base_agi) VALUES ('fadyme','Fadyme',5,'Veil','support',22,'free_start',11,3,1,5)")
  ]);
}

describe('Google sign-in and sessions', () => {
  it('still enforces the shared-IP sign-in cap with independent actor fixtures', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-12T12:00:10Z'));
    try {
      const token = await googleIdToken('sub-shared-ip-cap');
      const request = () => game('/api/v1/auth/google', post({ idToken: token }, { 'CF-Connecting-IP': '198.19.0.1' }));
      for (let i = 0; i < 20; i++) expect((await request()).status).toBe(200);
      expect((await request()).status).toBe(429);
    } finally {
      vi.useRealTimers();
    }
  });

  it('creates a player with the free-start roster and a revocable bearer session', async () => {
    await seedFreeStart();
    const idToken = await googleIdToken('sub-signin-1');
    const res = await game('/api/v1/auth/google', post({ idToken }));
    expect(res.status).toBe(200);
    const j = (await res.json()) as { token: string; expiresAt: string; player: { id: string; isNew: boolean; displayName: string } };
    expect(j.token).toMatch(/^uomd1\./);
    expect(j.player).toMatchObject({ isNew: true, displayName: 'Test Player' });
    // only the hash of the token is stored
    const stored = await db().prepare('SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ?1').bind(j.token).first<{ n: number }>();
    expect(stored?.n).toBe(0);
    const auth = { Authorization: `Bearer ${j.token}` };
    const inv = (await (await game('/api/v1/inventory', { headers: auth })).json()) as { items: { item_id: string; copies: number }[] };
    expect(inv.items.map((i) => i.item_id).sort()).toEqual(['fadyme', 'mahmut']);

    // signing in again resolves the same player, creates no second roster
    const again = (await (await game('/api/v1/auth/google', post({ idToken: await googleIdToken('sub-signin-1') }))).json()) as { player: { id: string; isNew: boolean } };
    expect(again.player).toMatchObject({ id: j.player.id, isNew: false });

    expect((await game('/api/v1/me', { headers: auth })).status).toBe(200);
    expect((await game('/api/v1/auth/logout', post({}, auth))).status).toBe(200);
    expect((await game('/api/v1/me', { headers: auth })).status).toBe(401);
  });

  it('rejects wrong audience, issuer, signature, expiry and garbage; fails closed without configured client ids', async () => {
    for (const over of [{ aud: 'someone-else' }, { iss: 'https://evil.example' }, { wrongKey: true }, { expired: true }] as const) {
      const res = await game('/api/v1/auth/google', post({ idToken: await googleIdToken('sub-bad', over) }));
      expect(res.status, JSON.stringify(over)).toBe(401);
    }
    expect((await game('/api/v1/auth/google', post({ idToken: 'x'.repeat(150) }))).status).toBe(401);
    expect((await game('/api/v1/auth/google', post({ nope: 1 }))).status).toBe(400);
    const closed = await game('/api/v1/auth/google', post({ idToken: await googleIdToken('sub-closed') }), { GOOGLE_CLIENT_IDS: '' });
    expect(closed.status).toBe(503);
    expect(GOOGLE_CLIENT).toBeTruthy();
  });

  it('protected routes need a valid session; malformed, unknown and expired tokens are all 401', async () => {
    for (const path of ['/api/v1/me', '/api/v1/wallet', '/api/v1/inventory', '/api/v1/gacha/state', '/api/v1/gacha/history']) {
      expect((await game(path)).status, path).toBe(401);
      expect((await game(path, { headers: { Authorization: 'Bearer uomd1.' + 'a'.repeat(43) } })).status, path).toBe(401);
      expect((await game(path, { headers: { Authorization: 'Bearer nonsense' } })).status, path).toBe(401);
    }
    expect((await game('/api/v1/gacha/pull', post({ bannerId: 'x', count: 1, requestId: 'abcdefgh' }))).status).toBe(401);
    const { auth, token } = await signIn('sub-expire');
    await db().prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    expect((await game('/api/v1/me', { headers: auth })).status).toBe(401);
    expect(token).toBeTruthy();
  });

  it('a banned player can neither use an existing session nor sign in', async () => {
    const { auth, playerId } = await signIn('sub-banned');
    await db().prepare("UPDATE players SET status = 'banned' WHERE id = ?1").bind(playerId).run();
    expect((await game('/api/v1/me', { headers: auth })).status).toBe(401);
    expect((await game('/api/v1/auth/google', post({ idToken: await googleIdToken('sub-banned') }))).status).toBe(403);
  });
});

describe('CORS for the Android shell', () => {
  it('answers the preflight of the Capacitor WebView origin and no other origin', async () => {
    const ok = await game('/api/v1/wallet', { method: 'OPTIONS', headers: { Origin: 'https://localhost', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
    expect(ok.status).toBeLessThan(300);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
    expect(ok.headers.get('Access-Control-Allow-Headers')?.toLowerCase()).toContain('authorization');
    expect(ok.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    const evil = await game('/api/v1/wallet', { method: 'OPTIONS', headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' } });
    expect(evil.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const plain = await game('/api/v1/health', { headers: { Origin: 'https://localhost' } });
    expect(plain.headers.get('Access-Control-Allow-Origin')).toBe('https://localhost');
  });
});
