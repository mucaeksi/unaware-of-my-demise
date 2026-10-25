import { defineConfig } from 'vitest/config';

// node_modules/@uomd/* are re-export stubs on Google Drive (no symlinks, see tools/link_workspaces.mjs); vitest must
// transform them like source instead of handing them to Node, which cannot load the extensionless .ts imports
export default defineConfig({ test: { include: ['lib/**/*.test.ts', 'export_unity_bundle.test.ts', 'export_unity_combat_vectors.test.ts', 'export_unity_patch_vectors.test.ts', 'record_unity_build.test.ts'], environment: 'node', maxWorkers: 2, testTimeout: 30000, server: { deps: { inline: [/@uomd\//] } } } });
