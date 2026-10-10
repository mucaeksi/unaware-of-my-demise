import { createAdminApp } from './adminApp';
import type { AdminEnv } from './env';

const app = createAdminApp();
export default { fetch: app.fetch } satisfies ExportedHandler<AdminEnv>;
