import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
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
