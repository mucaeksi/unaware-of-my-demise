import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  build: { target: 'es2022', sourcemap: false },
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: { '/admin/api': 'http://127.0.0.1:8788' },
    watch: { ignored: ['**/public/dev/**'] }
  }
});

