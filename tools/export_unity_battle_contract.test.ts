import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { BattleStartRequest, BattleSubmission } from '../apps/api/src/progress/battle-contract';
import { buildBattleContract, output } from './export_unity_battle_contract';

it('keeps Unity fixtures and JSON schemas reproducible from the provider', async () => {
  expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(await buildBattleContract());
});
it('rejects client result authority and preserves omitted optional targets', () => {
  expect(BattleStartRequest.safeParse({ releaseId: 'rel_0001', nodeId: 't1', requestId: 'not_allowed' }).success).toBe(false);
  const base = { releaseId: 'rel_0001', nodeId: 't1', requestId: 'battle_001', actions: [{ skillId: 'skill_one' }] };
  expect(BattleSubmission.parse(base)).toEqual(base);
  for (const extra of [{ logHash: 'x' }, { stars: 3 }, { sessionId: null }, { actions: [{ skillId: 'skill_one', targetId: null }] }])
    expect(BattleSubmission.safeParse({ ...base, ...extra }).success).toBe(false);
});
