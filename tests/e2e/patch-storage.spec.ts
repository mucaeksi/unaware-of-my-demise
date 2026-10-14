import { expect, test } from '@playwright/test';
import { GAME, openGame } from './helpers';

test('upgrades v1 storage sizes, preserves bytes and generation, and rejects writes aborted after request success', async ({ page }) => {
  await page.goto(`${GAME}/api/v1/health`);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('uomd-content', 1); r.onupgradeneeded = () => { r.result.createObjectStore('objects'); r.result.createObjectStore('meta'); }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(['objects', 'meta'], 'readwrite'); tx.objectStore('objects').put(new Uint8Array([1, 2, 3, 4, 5, 6, 7]).buffer, 'upgrade_probe'); tx.objectStore('meta').put({ generation: 1, releaseId: 'rel_0001', killed: false }, 'generation:dev'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close();
  });
  await page.route('**/api/v1/content/channels/dev/manifest', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  const problems = await openGame(page);
  const result = await page.evaluate(async () => {
    const storage = (window as any).__UOMD__.services.content.patch.storage; const db: IDBDatabase = storage.db;
    let inventory: Record<string, number> = {};
    await storage.updateState('dev', (current: any) => { inventory = current.inventory; return null; });
    const before = await storage.getState(); const highWater = await storage.getHighWater('dev');
    const transaction = db.transaction.bind(db);
    // Abort deliberately AFTER the native object-store request succeeds, before transaction completion.
    Object.defineProperty(db, 'transaction', { configurable: true, value: (...args: Parameters<IDBDatabase['transaction']>) => {
      const tx = transaction(...args); if (args[1] !== 'readwrite') return tx;
      const objectStore = tx.objectStore.bind(tx);
      Object.defineProperty(tx, 'objectStore', { configurable: true, value: (name: string) => {
        const store = objectStore(name); return new Proxy(store, { get(target, key) { if (key === 'put') return (...a: Parameters<IDBObjectStore['put']>) => { const r = target.put(...a); r.addEventListener('success', () => { try { tx.abort(); } catch { /* already aborted */ } }, { once: true }); return r; }; const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value; } });
      } }); return tx;
    } });
    let objectRejected = false; let stateRejected = false;
    try { await storage.putObject('abort_probe', new Uint8Array([8, 9])); } catch { objectRejected = true; }
    try { await storage.updateState('dev', (current: any) => ({ ...current, state: { schema: 1, active: null, previous: null, denied: ['aborted_probe'] } })); } catch { stateRejected = true; }
    delete (db as any).transaction;
    return { version: db.version, inventory, objectRejected, stateRejected, absent: await storage.getObject('abort_probe') === null, stateUnchanged: JSON.stringify(before) === JSON.stringify(await storage.getState()), markUnchanged: JSON.stringify(highWater) === JSON.stringify(await storage.getHighWater('dev')), original: [...await storage.getObject('upgrade_probe')] };
  });
  expect(result).toMatchObject({ version: 2, inventory: { upgrade_probe: 7 }, objectRejected: true, stateRejected: true, absent: true, stateUnchanged: true, markUnchanged: true, original: [1, 2, 3, 4, 5, 6, 7] });
  await page.reload(); await page.waitForFunction(() => (window as any).__UOMD__?.game.scene.isActive('Title'));
  expect(await page.evaluate(async () => [...await (window as any).__UOMD__.services.content.patch.storage.getObject('upgrade_probe')])).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(problems.filter((p) => !p.includes('favicon'))).toEqual([]);
});

test('reports blocked persistent storage and closes a late upgrade connection after memory fallback', async ({ page, context }) => {
  await page.goto(`${GAME}/api/v1/health`);
  await page.evaluate(async () => { (window as any).__STORAGE_BLOCKER__ = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('uomd-content', 1); r.onupgradeneeded = () => { r.result.createObjectStore('objects'); r.result.createObjectStore('meta'); }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); });
  const game = await context.newPage(); await game.route('**/api/v1/content/channels/dev/manifest', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })); await openGame(game);
  expect(await game.evaluate(() => ({ persistent: (window as any).__UOMD__.services.content.persistent, notice: (window as any).__UOMD__.services.content.storageNotice }))).toMatchObject({ persistent: false, notice: expect.stringContaining('Local storage is unavailable') });
  await page.evaluate(() => (window as any).__STORAGE_BLOCKER__.close());
  // If the refused open leaks its eventual success connection, this next version upgrade stays blocked.
  expect(await page.evaluate(async () => new Promise<number>((resolve, reject) => { const r = indexedDB.open('uomd-content', 3); const timer = setTimeout(() => reject(new Error('late content connection leaked')), 5000); r.onsuccess = () => { clearTimeout(timer); const version = r.result.version; r.result.close(); resolve(version); }; r.onerror = () => { clearTimeout(timer); reject(r.error); }; }))).toBe(3);
  await game.close();
});
