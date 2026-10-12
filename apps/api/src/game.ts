import type { GameEnv } from './env';
import { createGameApp } from './gameApp';
import { reconcileBilling } from './billing/recovery';

const app = createGameApp();
export default {
  fetch: app.fetch,
  scheduled(_event, env, ctx) {
    ctx.waitUntil(reconcileBilling(env).then((result) => { console.log('billing_reconcile', result); }).catch(() => { console.warn('billing_reconcile_unavailable'); }));
  }
} satisfies ExportedHandler<GameEnv>;
