/// <reference types="vitest/config" />
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { assertTrustedKeys } from '../../packages/shared/src/signing';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

const trustedKeys = process.env.UOMD_TRUSTED_KEYS ?? fileURLToPath(new URL('../../content/keys/trusted_public_keys.json', import.meta.url));

assertTrustedKeys((JSON.parse(readFileSync(trustedKeys, 'utf8')) as { keys?: unknown }).keys);

// owner-only audition pages (music candidates, voice casting) are served by `npm run dev` from public/ but must never
// ship inside the web bundle or the AAB (tens of MB of unapproved media)
const DEV_ONLY_PUBLIC = ['audition', 'content/audition'];

export default defineConfig({
  plugins: [
    {
      name: 'uomd-drop-dev-only-public',
      apply: 'build',
      closeBundle() {
        for (const dir of DEV_ONLY_PUBLIC) rmSync(fileURLToPath(new URL(`./dist/${dir}`, import.meta.url)), { recursive: true, force: true });
      }
    }
  ],
  resolve: { alias: { '@uomd-trusted-keys': trustedKeys } },
  define: { __CLIENT_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2022',
    sourcemap: process.env.UOMD_SOURCEMAP === "1",
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: { manualChunks: { pixi: ['pixi.js'] } }
    }
  },
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': 'http://127.0.0.1:8787' } },
  // node_modules/@uomd/* are re-export stubs on Google Drive (no symlinks, see tools/link_workspaces.mjs); vitest must
  // transform them like source instead of handing them to Node, which cannot load the extensionless .ts imports
  test: { server: { deps: { inline: [/@uomd\//] } } }
});
