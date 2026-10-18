import { expect, test } from '@playwright/test';
import { ADMIN, SHOTS, openGame, signInDev, tap, waitScene } from './helpers';

test('R10: notched safe areas, accessibility DOM bridge, settings controls, signed-out privacy/settings reachability, and WebGL recovery', async ({ page }, info) => {
  await openGame(page, '/?safeInsets=20,120,36,120');

  // Verify safe-area inset shifted the Title status chip and menu buttons inward
  const chipPos = await page.evaluate(() => {
    const sc: any = (window as any).__UOMD__.game.scene.getScene('Title');
    return { x: sc.chipText.x, y: sc.chipText.y };
  });
  expect(chipPos.x).toBeGreaterThanOrEqual(180);
  expect(chipPos.y).toBeLessThanOrEqual(1080 - 36 - 36);

  // Verify TalkBack / keyboard DOM accessibility layer has focusable buttons and live region
  const a11yCount = await page.locator('#a11y-layer button:not([disabled])').count();
  expect(a11yCount).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#a11y-live')).toHaveCount(1);

  // Navigate to Account while signed out and verify PRIVACY OPTIONS (ADS) and SETTINGS are reachable without sign-in
  await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Title').scene.start('Account'));
  await waitScene(page, 'Account');
  const accountLabels = await page.evaluate(() => {
    const sc: any = (window as any).__UOMD__.game.scene.getScene('Account');
    return sc.body.list.filter((o: any) => o.list).flatMap((c: any) => c.list.map((x: any) => x.text).filter(Boolean));
  });
  expect(accountLabels).toContain('PRIVACY OPTIONS (ADS)');
  expect(accountLabels).toContain('SETTINGS');

  // Tap SETTINGS in signed-out AccountScene -> returns to Title and opens Settings modal automatically
  await tap(page, info, 960 + 280, 790);
  await waitScene(page, 'Title');
  await expect.poll(() => page.evaluate(() => Boolean((window as any).__UOMD__.game.scene.getScene('Title').overlay))).toBe(true);

  // Toggle Text Size -> LARGE and High Contrast -> HIGH at right column (x = 1600, y = 240 and y = 350)
  await tap(page, info, 1600, 240);
  await tap(page, info, 1600, 350);
  const prefsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('uomd.prefs.v1') ?? '{}'));
  expect(prefsAfter.textSize).toBe('large');
  expect(prefsAfter.highContrast).toBe(true);

  await page.screenshot({ path: `${SHOTS}/${info.project.name}-r10-settings-a11y.png` });

  // Test checkpoint-safe WebGL context loss & recovery
  await page.evaluate(() => (window as any).__UOMD__.contextRecovery.simulateLoss());
  await expect(page.locator('#context-recovery')).toBeVisible();
  await expect(page.locator('#context-recovery')).toContainText('Graphics context interrupted');
  await page.evaluate(() => (window as any).__UOMD__.contextRecovery.simulateRestore());
  await expect(page.locator('#context-recovery')).toBeHidden();
  await waitScene(page, 'Title');
});

test('R10: companion growth screen shows pre-action costs, resulting level/cap/rank, wallet remainder, XP waste, and post-action outcome', async ({ page, request }, info) => {
  await openGame(page);
  await page.evaluate(async () => (window as any).__UOMD__.services.content.checkForUpdates());
  const player = await signInDev(page, `r10-growth-${info.project.name}`);
  const headers = { 'Cf-Access-Jwt-Assertion': process.env.E2E_ADMIN_JWT! };
  const mail = await request.post(`${ADMIN}/admin/api/players/${player.id}/mail`, {
    headers,
    data: {
      reason: 'r10 companion growth legibility fixture',
      mail: {
        kind: 'reward',
        title: 'R10 Growth Fixture',
        attachments: [
          { type: 'item', itemId: 'bound_chronicle', quantity: 1 },
          { type: 'currency', currency: 'eclipse_token', amount: 320 },
          { type: 'account_xp', amount: 2000 }
        ]
      }
    }
  });
  expect(mail.ok()).toBe(true);
  const sent = await mail.json();
  await page.evaluate(async (id) => (window as any).__UOMD__.services.api.claimMail(id), sent.id);

  await page.evaluate(() => (window as any).__UOMD__.game.scene.getScene('Title').scene.start('Character', { id: 'mahmut' }));
  await waitScene(page, 'Character');
  await expect.poll(() =>
    page.evaluate(() => {
      const sc: any = (window as any).__UOMD__.game.scene.getScene('Character');
      return sc.body.list.map((o: any) => o.text).filter(Boolean);
    })
  ).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^Level 1 \/ 5/),
      expect.stringMatching(/^Level-Up Plan:.*Wallet → .*Waste 0 XP/),
      expect.stringMatching(/^Ascend Plan:.*Blocked: reach Lv 5 first/)
    ])
  );

  // Execute Level Up and verify persistent post-action outcome banner
  await page.waitForTimeout(300);
  await tap(page, info, 340, 600);
  await expect.poll(() =>
    page.evaluate(() => {
      const sc: any = (window as any).__UOMD__.game.scene.getScene('Character');
      return sc.body.list.map((o: any) => o.text).filter(Boolean);
    })
  ).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^Level 3 \/ 5/),
      expect.stringMatching(/^Last Action: Level 1 → 3 .*Wallet /)
    ])
  );
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-r10-companion-growth.png` });
});
