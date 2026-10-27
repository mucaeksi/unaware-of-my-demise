/** Deterministic fixtures/schema from the provider boundary and existing authoritative combat vectors. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { canonicalJson, sha256Hex } from '../packages/shared/src/index.ts';
import { BattleStartRequest, BattleSubmission, BattleStartResult, BattleResult, BattleOperationStatus } from '../apps/api/src/progress/battle-contract.ts';

export const output = 'apps/unity/Assets/_UOMD/Tests/EditMode/battle_contract_vectors.json';
export async function buildBattleContract() {
  const cases = JSON.parse(readFileSync('apps/unity/Assets/_UOMD/Tests/EditMode/combat_vectors.json', 'utf8')).cases;
  const combat = cases.find((c: { name: string }) => c.name === 'stage_1_2.json/auto');
  const startRequest = BattleStartRequest.parse({ releaseId: 'rel_0003_part1_campaign', nodeId: 'stage_1_2' });
  const start = BattleStartResult.parse({ sessionId: 'a'.repeat(32), party: combat.party, expiresAt: '2099-01-01T00:00:00.000Z' });
  const submit = BattleSubmission.parse({ ...startRequest, requestId: 'b'.repeat(32), sessionId: start.sessionId, actions: combat.actions });
  const result = BattleResult.parse({ requestId: submit.requestId, nodeId: submit.nodeId, stars: combat.result.stars, turns: combat.result.turns,
    bestStars: combat.result.stars, firstClear: true, newThreeStar: combat.result.stars === 3, rewards: [], ration: { spent: 6, value: 114, cap: 120, nextMs: 0 }, replayed: false });
  // winner belongs to the combat result, not the progress response.
  const payload = canonicalJson(submit), inputHash = await sha256Hex(payload);
  const status = BattleOperationStatus.parse({ requestId: submit.requestId, path: '/api/v1/progress/battle', state: 'confirmed', binding: 'exact', inputHash, result });
  const unknown = BattleOperationStatus.parse({ requestId: submit.requestId, path: '/api/v1/progress/battle', state: 'unknown', binding: null, inputHash: null, result: null });
  return { generator: 'tools/export_unity_battle_contract.ts', source: 'apps/api/src/progress/battle-contract.ts',
    schemas: Object.fromEntries(Object.entries({ startRequest: BattleStartRequest, submit: BattleSubmission, start: BattleStartResult, result: BattleResult, status: BattleOperationStatus }).map(([key, schema]) => [key, z.toJSONSchema(schema)])),
    startRequest, startCanonical: canonicalJson(startRequest), start, nullableStart: BattleStartResult.parse({ sessionId: null, party: null, expiresAt: null }),
    submit, payload, inputHash, result, status, unknown, combat };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(output, JSON.stringify(await buildBattleContract(), null, 2) + '\n');
  console.log(`wrote ${output}`);
}
