import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { SignJWT, importJWK } from 'jose';
import { ADMIN, SHOTS, openGame, tap, waitScene } from './helpers';
import { GOOGLE_CLIENT } from './stack';

const adminJwt = (): string => process.env.E2E_ADMIN_JWT as string;
const REF_W = 1920;

async function googleToken(sub: string): Promise<string> {
  const jwk = JSON.parse(process.env.E2E_GOOGLE_PRIVATE_JWK as string);
  return new SignJWT({ email: `${sub}@example.com`, email_verified: true, name: 'E2E Wayfarer', pad: 'x'.repeat(80) })
    .setProtectedHeader({ alg: 'RS256', kid: 'g1' })
    .setSubject(sub)
    .setIssuer('https://accounts.google.com')
    .setAudience(GOOGLE_CLIENT)
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(await importJWK(jwk, 'RS256'));
}

const call = (page: Page, path: string, init?: { method?: string; body?: unknown }) =>
  page.evaluate(
    async ([p, i]) => {
      const r = await (window as any).__UOMD__.services.api.call(i?.method ?? 'GET', p, i?.body);
      return r;
    },
    [path, init] as const
  );

async function admin(request: APIRequestContext, path: string, body: unknown): Promise<any> {
  const res = await request.post(`${ADMIN}${path}`, { data: body, headers: { 'Cf-Access-Jwt-Assertion': adminJwt() } });
  expect(res.status(), `${path}: ${await res.text()}`).toBeLessThan(300);
  return res.json();
}

/** Switches scenes the way the game itself does (ScenePlugin.start stops the caller); the bare manager would stack scenes. */
const goto = (page: Page, key: string) =>
  page.evaluate((k) => {
    const g = (window as any).__UOMD__.game;
    g.scene.getScenes(true).forEach((s: any) => g.scene.stop(s.sys.settings.key));
    g.scene.start(k);
  }, key);

test.describe.configure({ mode: 'serial' });

test('account: sign in, summon with server-side pity, claim mail, see roster; the browser build cannot fake Google sign-in', async ({ page, request }, info) => {
  const problems = await openGame(page);
  const sub = `e2e-${info.project.name}`;

  // the browser has no native identity provider: the Account screen says so and does not offer a fake login
  await tap(page, info, REF_W - 200, 80); // COMPANY
  await waitScene(page, 'Home');
  await tap(page, info, 960, 720); // ACCOUNT (third row, second tile since TEAM joined the hub)
  await waitScene(page, 'Account');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => (window as any).__UOMD__.services.identity.kind)).toBe('none');
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-10-account-signed-out.png` });

  // sign in the way the Android shell will: hand an ID token to the API client (the Worker verifies it like Google's)
  const token = await googleToken(sub);
  const player = await page.evaluate(async (t) => (window as any).__UOMD__.services.api.signInWithIdToken(t), token);
  expect(player.isNew || player.id).toBeTruthy();
  const pid: string = player.id;

  // an operator funds the account through the Control Center API (owner-only, audited)
  const adj = await admin(request, `/admin/api/players/${pid}/adjust`, { currency: 'eclipse_token', delta: 1920, reason: 'e2e funding', requestId: `e2e_${info.project.name}_fund` });
  expect(adj.balance).toBeGreaterThanOrEqual(1920);

  // Home -> Summon: pull a 10-pull through the real UI
  await goto(page, 'Home');
  await waitScene(page, 'Home');
  await page.waitForTimeout(800);
  await tap(page, info, 440, 290); // SUMMON
  await waitScene(page, 'Summon');
  await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Summon').banners?.length ?? 0), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(2500); // software GL stretches the scene fade; the evidence shot must be fully faded in
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-11-summon.png` });
  await tap(page, info, 1180, 860); // PULL x10
  await expect.poll(async () => (await call(page, '/api/v1/gacha/history?limit=40')).pulls.length, { timeout: 30_000 }).toBeGreaterThanOrEqual(10);
  await page.waitForTimeout(2200); // the reveal animation
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-12-summon-result.png` });
  const hist = await call(page, '/api/v1/gacha/history?limit=40');
  expect(hist.pulls.some((p: any) => p.rarity >= 4)).toBe(true); // every ten-pull has a 4-star or better
  const wallet = await call(page, '/api/v1/wallet');
  expect(wallet.wallets.eclipse_token).toBe((adj.balance as number) - 1600); // a ten-pull costs 10 x 160 of the single main currency

  // Mail: an operator sends a compensation, the player claims it in the UI
  await admin(request, `/admin/api/players/${pid}/mail`, { reason: 'e2e compensation', mail: { kind: 'compensation', title: 'Thank you for testing', attachments: [{ type: 'currency', currency: 'eclipse_token', amount: 320 }] } });
  await goto(page, 'Mail');
  await waitScene(page, 'Mail');
  await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Mail').mail?.length ?? 0), { timeout: 20_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-13-mail.png` });
  await tap(page, info, REF_W - 250, 290); // CLAIM (first row)
  await expect.poll(async () => (await call(page, '/api/v1/wallet')).wallets.eclipse_token ?? 0, { timeout: 20_000 }).toBe((adj.balance as number) - 1600 + 320);

  // Roster lists the free-start company plus whatever the pulls brought
  await goto(page, 'Roster');
  await waitScene(page, 'Roster');
  await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Roster').list?.length ?? 0), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-14-roster.png` });
  const items = await call(page, '/api/v1/inventory');
  expect(items.items.map((i: any) => i.item_id)).toEqual(expect.arrayContaining(['mahmut', 'fadyme']));

  // companion detail: tap a roster card, see level / skills / stats / gear slots; level up with an XP item the server grants as mail
  await tap(page, info, 340, 330); // first card
  await waitScene(page, 'Character');
  await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Character').body?.length ?? 0), { timeout: 20_000 }).toBeGreaterThan(5);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-15-character.png` });
  const mine = await call(page, '/api/v1/characters/mine');
  expect(mine.characters.length).toBeGreaterThanOrEqual(2);
  expect(mine.characters[0].skills.length).toBeGreaterThan(0);

  // errands: the server-side 12-hour window is visible
  await goto(page, 'Tasks');
  await waitScene(page, 'Tasks');
  await expect.poll(() => page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Tasks').body?.length ?? 0), { timeout: 20_000 }).toBeGreaterThan(5);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-16-errands.png` });
  const tasks = await call(page, '/api/v1/tasks');
  expect(tasks.daily.tasks.length).toBeGreaterThan(0);

  // armory
  await goto(page, 'Gear');
  await waitScene(page, 'Gear');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-17-armory.png` });

  // sign out revokes the session on the server
  await page.evaluate(() => (window as any).__UOMD__.services.api.signOut());
  expect(await page.evaluate(() => (window as any).__UOMD__.services.api.signedIn)).toBe(false);
  expect(problems.filter((p) => !p.includes('favicon') && !p.includes('HTTP 401') && !p.includes('HTTP 402'))).toEqual([]);
});
