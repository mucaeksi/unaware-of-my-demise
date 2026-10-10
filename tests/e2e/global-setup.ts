import { publishPatch, startStack, type Stack } from './stack';

let stack: Stack | null = null;

export default async function globalSetup(): Promise<() => Promise<void>> {
  stack = await startStack();
  process.env.E2E_ADMIN_JWT = stack.adminJwt;
  void publishPatch;
  return async () => {
    await stack?.stop();
  };
}
