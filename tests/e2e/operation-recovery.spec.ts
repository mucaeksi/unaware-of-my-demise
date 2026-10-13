import { expect, test, type Page } from '@playwright/test';
import { SignJWT, importJWK } from 'jose';
import { ADMIN, openGame } from './helpers';
import { GOOGLE_CLIENT } from './stack';

async function signIn(page: Page, subject: string): Promise<{ id: string }> {
  const token = await new SignJWT({ email: `${subject}@example.com`, email_verified: true, name: 'Recovery test', pad: 'x'.repeat(80) })
    .setProtectedHeader({ alg: 'RS256', kid: 'g1' }).setSubject(subject)
    .setIssuer('https://accounts.google.com').setAudience(GOOGLE_CLIENT).setIssuedAt().setExpirationTime('2h')
    .sign(await importJWK(JSON.parse(process.env.E2E_GOOGLE_PRIVATE_JWK!), 'RS256'));
  return page.evaluate(async (identity) => (window as any).__UOMD__.services.api.signInWithIdToken(identity), token);
}

test('lost summon response survives reload and spends exactly once on the real Worker', async ({ page, request }, info) => {
  await openGame(page, '/', { fresh: true });
  const player = await signIn(page, `recovery-${info.project.name}`);
  const adjustment = await request.post(`${ADMIN}/admin/api/players/${player.id}/adjust`, {
    data: { currency: 'eclipse_token', delta: 320, reason: 'isolated recovery fixture', requestId: `recovery_${info.project.name}` },
    headers: { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! }
  });
  expect(adjustment.status()).toBe(200);
  const input = await page.evaluate(async () => {
    const banners = await (window as any).__UOMD__.services.api.banners();
    return { bannerId: banners.find((banner: any) => banner.kind === 'character').id, count: 1 };
  });
  let committed = false; let originalId = '';
  await page.route('**/api/v1/gacha/pull', async (route) => {
    originalId = route.request().postDataJSON().requestId;
    const response = await route.fetch(); expect(response.status()).toBe(200);
    committed = true; await route.abort('failed');
  });
  const lost = await page.evaluate(async (value) => {
    try { await (window as any).__UOMD__.services.api.pull(value.bannerId, value.count); return false; } catch { return true; }
  }, input);
  expect(lost).toBe(true); expect(committed).toBe(true); expect(originalId).not.toBe('');
  await page.unroute('**/api/v1/gacha/pull'); await page.reload();
  await page.waitForFunction(() => (window as any).__UOMD__?.services.api.signedIn);
  let recoveryPosts = 0;
  await page.route('**/api/v1/gacha/pull', async (route) => { recoveryPosts++; await route.abort('failed'); });
  const recovered = await page.evaluate(async (id) => (window as any).__UOMD__.services.api.retryOperation(id), originalId);
  expect(recovered.requestId).toBe(originalId); expect(recovered.replayed).toBe(true);
  expect(recovered.balance).toBe(160);
  expect(recoveryPosts).toBe(0);
  const journal = await page.evaluate(async () => (window as any).__UOMD__.services.api.operations());
  expect(journal).toHaveLength(1); expect(journal[0]).toMatchObject({ id: originalId, state: 'confirmed', attempts: 1 });
  const history = await page.evaluate(async () => (window as any).__UOMD__.services.api.history());
  expect(history).toHaveLength(1);
});

test('a committed mail claim recovers after reload without sending another claim', async ({ page, request }, info) => {
  await openGame(page, '/', { fresh: true }); const player = await signIn(page, `mail-recovery-${info.project.name}`);
  const created = await request.post(`${ADMIN}/admin/api/players/${player.id}/mail`, {
    data: { reason: 'isolated response-loss fixture', mail: { kind: 'reward', title: 'Recovery fixture', attachments: [{ type: 'currency', currency: 'eclipse_token', amount: 10 }] } },
    headers: { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! }
  });
  expect(created.status()).toBe(201); const { id } = await created.json();
  let originalId = ''; let committed = false;
  await page.route(`**/api/v1/mail/${id}/claim`, async (route) => {
    originalId = route.request().postDataJSON().requestId;
    const response = await route.fetch(); expect(response.status()).toBe(200);
    committed = true; await route.abort('failed');
  });
  expect(await page.evaluate(async (mailId) => {
    try { await (window as any).__UOMD__.services.api.claimMail(mailId); return false; } catch { return true; }
  }, id)).toBe(true);
  expect(committed).toBe(true);
  await page.unroute(`**/api/v1/mail/${id}/claim`); await page.reload();
  await page.waitForFunction(() => (window as any).__UOMD__?.services.api.signedIn);
  let recoveryPosts = 0;
  await page.route(`**/api/v1/mail/${id}/claim`, async (route) => { recoveryPosts++; await route.abort('failed'); });
  const recovered = await page.evaluate(async (operationId) => (window as any).__UOMD__.services.api.retryOperation(operationId), originalId);
  expect(recovered).toMatchObject({ requestId: originalId, mailId: id, claimed: [{ amount: 10 }] });
  expect(recoveryPosts).toBe(0);
  const state = await page.evaluate(async () => {
    const api = (window as any).__UOMD__.services.api;
    return { wallet: await api.wallet(), operations: await api.operations(), mail: await api.mail() };
  });
  expect(state.wallet.eclipse_token).toBe(10);
  expect(state.operations).toHaveLength(1); expect(state.operations[0].state).toBe('confirmed');
  expect(state.mail.find((mail: any) => mail.id === id).claimed_at).not.toBeNull();
});

test('cloud-save response loss recovers its original version after a later device write', async ({ page }, info) => {
  await openGame(page, '/', { fresh: true }); await signIn(page, `save-recovery-${info.project.name}`);
  let originalId = ''; let committed = false;
  await page.route('**/api/v1/save', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    originalId = route.request().postDataJSON().requestId;
    const response = await route.fetch(); expect(response.status()).toBe(200);
    committed = true; await route.abort('failed');
  });
  expect(await page.evaluate(async () => {
    try { await (window as any).__UOMD__.services.api.writeSave(0, { device: 'original' }); return false; } catch { return true; }
  })).toBe(true);
  expect(committed).toBe(true);
  await page.unroute('**/api/v1/save');
  // A separate device advances the version while the original device still has an uncertain result.
  expect(await page.evaluate(async () => (window as any).__UOMD__.services.api.call('PUT', '/api/v1/save', { expectedVersion: 1, data: { device: 'newer' } }))).toMatchObject({ version: 2 });
  await page.reload(); await page.waitForFunction(() => (window as any).__UOMD__?.services.api.signedIn);
  let recoveryWrites = 0;
  await page.route('**/api/v1/save', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    recoveryWrites++; await route.abort('failed');
  });
  const result = await page.evaluate(async (id) => (window as any).__UOMD__.services.api.retryOperation(id), originalId);
  expect(result).toMatchObject({ requestId: originalId, version: 1 }); expect(recoveryWrites).toBe(0);
  expect(await page.evaluate(async () => (window as any).__UOMD__.services.api.readSave())).toMatchObject({ version: 2, data: { device: 'newer' } });
});

test('a committed checkpoint survives response loss and reload without another PUT', async ({ page }, info) => {
  await openGame(page, '/', { fresh: true }); await signIn(page, `entry-recovery-${info.project.name}`);
  let originalId = ''; let committed = false;
  await page.route('**/api/v1/entry', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    originalId = route.request().postDataJSON().requestId;
    const response = await route.fetch(); expect(response.status()).toBe(200);
    committed = true; await route.abort('failed');
  });
  expect(await page.evaluate(async () => {
    try { await (window as any).__UOMD__.services.api.putEntry({ prologue: true, tutorials: 1 }); return false; } catch { return true; }
  })).toBe(true);
  expect(committed).toBe(true);
  await page.unroute('**/api/v1/entry'); await page.reload();
  await page.waitForFunction(() => (window as any).__UOMD__?.services.api.signedIn);
  let recoveryWrites = 0;
  await page.route('**/api/v1/entry', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    recoveryWrites++; await route.abort('failed');
  });
  expect(await page.evaluate(async (id) => (window as any).__UOMD__.services.api.retryOperation(id), originalId)).toMatchObject({ requestId: originalId, tutorials: 1, prologue: true });
  expect(recoveryWrites).toBe(0);
  expect(await page.evaluate(async () => (window as any).__UOMD__.services.api.entry())).toMatchObject({ tutorials: 1, phase: 'in_progress' });
});

test('a delayed old-tab unauthorized response preserves the newer shared account', async ({ page, context }, info) => {
  await openGame(page, '/', { fresh: true });
  const first = await signIn(page, `tab-first-${info.project.name}`);
  const nextTab = await context.newPage(); await openGame(nextTab, '/', { fresh: true });
  let release!: () => void; let waiting = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/v1/wallet', async (route) => {
    const response = await route.fetch(); expect(response.status()).toBe(200);
    waiting = true; await gate;
    await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) });
  });
  const older = page.evaluate(async () => {
    try { await (window as any).__UOMD__.services.api.wallet(); return null; }
    catch (error) { return (error as { status: number }).status; }
  });
  await expect.poll(() => waiting).toBe(true);
  const selected = await signIn(nextTab, `tab-selected-${info.project.name}`);
  expect(selected.id).not.toBe(first.id); release(); expect(await older).toBe(401);
  await page.unroute('**/api/v1/wallet');
  expect(await page.evaluate(async () => (window as any).__UOMD__.services.api.me())).toMatchObject({ id: selected.id });
  expect(await nextTab.evaluate(async () => (window as any).__UOMD__.services.api.me())).toMatchObject({ id: selected.id });
  await nextTab.close();
});
