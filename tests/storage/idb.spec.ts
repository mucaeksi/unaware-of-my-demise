import { expect, test } from '@playwright/test';
import type { ContentStorage, PatchState } from '@uomd/patch';

test.beforeEach(async ({ page }) => {
  // Serve a blank same-origin page; import the real storage module without starting the game/API.
  await page.route('**/storage-fixture.html', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Content storage fixture</title>' }));
  await page.goto('/storage-fixture.html');
});

test('commits concurrent updates and retains per-channel authority after overlay loss and reopen', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/src/platform/idbStorage.ts';
    const { openContentStorage } = await import(modulePath) as { openContentStorage(): Promise<{ storage: ContentStorage; persistent: boolean }> };
    const first = await openContentStorage(); const second = await openContentStorage();
    const state: PatchState = { schema: 1, active: null, previous: null, staged: null, denied: [] };
    await first.storage.setState(state);
    await Promise.all(Array.from({ length: 12 }, (_, index) => (index % 2 ? first : second).storage.updateState('staging', (current) => ({
      state: { ...state, denied: [...(current.state?.denied ?? []), String(index)] },
      highWater: { generation: (current.highWater?.generation ?? 0) + 1, releaseId: 'concurrent', killed: false }
    }))));
    const committed = await second.storage.getState();
    await first.storage.updateState('dev', (current) => ({ ...current, highWater: { generation: 2, releaseId: 'dev', killed: true } }));
    await first.storage.updateState('staging', (current) => ({ ...current, state: null }));
    const reopened = await openContentStorage();
    return { persistent: first.persistent && reopened.persistent, deniedCount: committed?.denied.length,
      state: await reopened.storage.getState(), staging: await reopened.storage.getHighWater('staging'), dev: await reopened.storage.getHighWater('dev') };
  });
  expect(result).toMatchObject({ persistent: true, deniedCount: 12, state: null, staging: { generation: 12 }, dev: { generation: 2, killed: true } });
});

test('rejects writes aborted after request success and preserves both previous metadata records', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/src/platform/idbStorage.ts';
    const { openContentStorage } = await import(modulePath) as { openContentStorage(): Promise<{ storage: ContentStorage }> };
    const { storage } = await openContentStorage();
    const state: PatchState = { schema: 1, active: null, previous: null, staged: null, denied: [] };
    await storage.updateState('staging', () => ({ state, highWater: { generation: 2, releaseId: 'old', killed: false } }));
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = original.apply(this, args);
      request.addEventListener('success', () => request.transaction!.abort());
      return request;
    };
    const failures: boolean[] = [];
    try {
      for (const write of [
        () => storage.updateState('staging', () => ({ state: { ...state, denied: ['new'] }, highWater: { generation: 3, releaseId: 'new', killed: true } })),
        () => storage.setState({ ...state, denied: ['new'] }),
        () => storage.putObject('object', new Uint8Array([1, 2, 3]))
      ]) {
        try { await write(); failures.push(false); } catch { failures.push(true); }
      }
    } finally { IDBObjectStore.prototype.put = original; }
    return { failures, state: await storage.getState(), highWater: await storage.getHighWater('staging'), object: await storage.getObject('object') };
  });
  expect(result).toMatchObject({ failures: [true, true, true], state: { denied: [] }, highWater: { generation: 2, releaseId: 'old', killed: false }, object: null });
});
