import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  testMatch: '*.spec.ts',
  testIgnore: 'remote.spec.ts', // runs only through playwright.remote.config.ts against a deployed URL
  timeout: 360_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  outputDir: process.platform === 'win32' ? join(tmpdir(), 'uomd-e2e-results') : '../../.cache/e2e-results',
  use: { launchOptions: { args: GL, ...(process.env.UOMD_CHROMIUM_PATH ? { executablePath: process.env.UOMD_CHROMIUM_PATH } : {}) }, trace: 'retain-on-failure' },
  projects: [
    { name: 'landscape-desktop', use: { viewport: { width: 1280, height: 720 } } },
    // 20:9 phone in landscape with touch (letterboxing / safe-area path)
    { name: 'phone-landscape', use: { viewport: { width: 1200, height: 540 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } }
  ]
});
