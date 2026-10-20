import { fileURLToPath } from 'node:url';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: './wrangler.test.jsonc' },
      miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations(fileURLToPath(new URL('./migrations', import.meta.url))) } }
    }))
  ],
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
    include: ['test/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    maxWorkers: 2,
    // node_modules/@uomd/* are re-export stubs on Google Drive (no symlinks, see tools/link_workspaces.mjs); vitest must
    // transform them like source instead of handing them to Node, which cannot load the extensionless .ts imports
    server: { deps: { inline: [/@uomd\//] } }
  }
});
