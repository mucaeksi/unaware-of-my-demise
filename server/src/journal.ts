// The economic journal's request context (INF-015, migration 0005): the triggers on balances and owned things read it
// to record which request made each change. Transaction-local, so it never leaks to another request on a pooled connection.
import type { Db } from "./db";
import { serverRulesHash } from "./release";

export async function setJournalContext(tx: Db, operationKey: string | null, endpoint: string): Promise<void> {
  await tx.query("SELECT set_config('uomd.operation_key', $1, true), set_config('uomd.endpoint', $2, true), set_config('uomd.rules_hash', $3, true)", [
    operationKey ?? "",
    endpoint,
    await serverRulesHash(),
  ]);
}
