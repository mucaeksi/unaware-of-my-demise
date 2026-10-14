import { existsSync } from 'node:fs';
import { validateAndroidReleaseEnv } from '../apps/game/src/platform/releaseGate';

const result = validateAndroidReleaseEnv(process.env, existsSync);
if (!result.ok) {
  console.error('Android release gate failed:\n' + result.errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log('Android release gate passed.');
