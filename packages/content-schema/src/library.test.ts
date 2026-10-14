import { describe, expect, it } from 'vitest';
import { NarrativeGate, narrativeGateAllows } from './library';

describe('shared narrative gates', () => {
  const empty = () => ({ completedNodes: new Set<string>(), ownedCharacters: new Set<string>(), completedEntries: new Set<string>() });
  it('requires every declared stable-ID fact, without inferring later stages or similar IDs', () => {
    const state = empty(); const gate = NarrativeGate.parse({ after_node: 'stage_4_5', owned_character: 'kera_voss', after_entry: 'cs_kera_2' });
    expect(narrativeGateAllows({}, state)).toBe(true);
    state.completedNodes.add('stage_7_5'); state.ownedCharacters.add('kera'); state.completedEntries.add('cs_kera_1');
    expect(narrativeGateAllows(gate, state)).toBe(false);
    state.completedNodes.add('stage_4_5'); expect(narrativeGateAllows(gate, state)).toBe(false);
    state.ownedCharacters.add('kera_voss'); expect(narrativeGateAllows(gate, state)).toBe(false);
    state.completedEntries.add('cs_kera_2'); expect(narrativeGateAllows(gate, state)).toBe(true);
  });
  it.each([{ after_stage: '4-5' }, { after_node: '' }, { owned_character: true }, { after_entry: '../other' }])('rejects unsupported or malformed gates: %j', (gate) => {
    expect(NarrativeGate.safeParse(gate).success).toBe(false);
  });
});
