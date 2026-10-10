import { defineConfig } from '@playwright/test';

// Smoke test against a DEPLOYED environment (no local stack):
//   UOMD_REMOTE_GAME_URL=https://uomd-game-staging.<account>.workers.dev npm run e2e:remote
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: '.',
  testMatch: 'remote.spec.ts',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [['list']],
  outputDir: '../../.cache/e2e-remote-results',
  use: { launchOptions: { args: GL }, trace: 'retain-on-failure' },
  projects: [
    { name: 'remote-desktop', use: { viewport: { width: 1280, height: 720 } } },
    { name: 'remote-phone', use: { viewport: { width: 1200, height: 540 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } }
  ]
});
