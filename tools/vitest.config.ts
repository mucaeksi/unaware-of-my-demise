import { defineConfig } from 'vitest/config';

// node_modules/@uomd/* are re-export stubs on Google Drive (no symlinks, see tools/link_workspaces.mjs); vitest must
// transform them like source instead of handing them to Node, which cannot load the extensionless .ts imports
export default defineConfig({ test: { include: ['lib/**/*.test.ts'], environment: 'node', server: { deps: { inline: [/@uomd\//] } } } });
