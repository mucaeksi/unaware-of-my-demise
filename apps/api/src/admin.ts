import { createAdminApp } from './adminApp';

const app = createAdminApp();
export default { fetch: app.fetch } satisfies ExportedHandler<import('./env').AdminEnv>;
