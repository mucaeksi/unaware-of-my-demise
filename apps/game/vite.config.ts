import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { assertTrustedKeys } from '../../packages/shared/src/signing';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

const trustedKeys = process.env.UOMD_TRUSTED_KEYS ?? fileURLToPath(new URL('../../content/keys/trusted_public_keys.json', import.meta.url));

assertTrustedKeys((JSON.parse(readFileSync(trustedKeys, 'utf8')) as { keys?: unknown }).keys);

export default defineConfig({
  resolve: { alias: { '@uomd-trusted-keys': trustedKeys } },
  define: { __CLIENT_VERSION__: JSON.stringify(pkg.version) },
  build: {
    target: 'es2022',
    sourcemap: process.env.UOMD_SOURCEMAP === "1",
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } }
    }
  },
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': 'http://127.0.0.1:8787' } }
});
