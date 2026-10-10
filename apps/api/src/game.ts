import type { GameEnv } from './env';
import { createGameApp } from './gameApp';

const app = createGameApp();
export default { fetch: app.fetch } satisfies ExportedHandler<GameEnv>;
