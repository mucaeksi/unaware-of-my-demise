import { defineConfig } from 'vitest/config';

// These suites validate the real content trees (base ~23 MB with voice/music + the Part I campaign). On the Google Drive
// working copy a cold read under load exceeds vitest's 5 s default even though every case passes in isolation.
// node_modules/@uomd/* are re-export stubs on Google Drive (no symlinks, see tools/link_workspaces.mjs); vitest must
// transform them like source instead of handing them to Node, which cannot load the extensionless .ts imports
export default defineConfig({ test: { testTimeout: 30_000, server: { deps: { inline: [/@uomd\//] } } } });
