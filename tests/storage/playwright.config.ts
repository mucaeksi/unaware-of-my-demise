import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  outputDir: '../../.cache/storage-results',
  use: {
    baseURL: 'http://127.0.0.1:19003',
    launchOptions: { ...(process.env.UOMD_CHROMIUM_PATH ? { executablePath: process.env.UOMD_CHROMIUM_PATH } : {}) },
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm exec -w @uomd/game -- vite --host 127.0.0.1 --port 19003 --strictPort',
    url: 'http://127.0.0.1:19003',
    reuseExistingServer: false
  }
});
