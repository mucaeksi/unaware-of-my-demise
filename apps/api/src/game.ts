import { createGameApp } from './gameApp';

const app = createGameApp();
export default { fetch: app.fetch } satisfies ExportedHandler<import('./env').GameEnv>;
