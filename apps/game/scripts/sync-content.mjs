/* global URL, console */
// Copies the embedded base release into public/ so Vite serves/ships it at /content/base/.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dest = fileURLToPath(new URL('../public/content/base', import.meta.url));
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(`${root}content/base`, dest, { recursive: true });
console.log('content/base synced to apps/game/public/content/base');
