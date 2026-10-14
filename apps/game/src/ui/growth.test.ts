import { describe, expect, it } from 'vitest';
import type { CharacterView } from '../net/api';
import { planAscension, planLevelUp, planSkillUpgrade } from './growth';

const baseChar: CharacterView = {
  id: 'mira',
  level: 1,
  xp: 0,
  xpToNext: 100,
  ascension: 0,
  cap: 5,
  nextAscension: {
    cap: 10,
    accountLevel: 5,
    items: [{ itemId: 'ember_sigil', quantity: 2 }],
    fee: 20,
    requiresNode: 'ch1_node_5'
  },
  skills: [
    {
      skillId: 'mira_basic',
      type: 'basic',
      name: 'Ash Strike',
      rank: 1,
      maxRank: 3,
      next: { rank: 2, unlockLevel: 3, itemId: 'tome_basic', quantity: 2, fee: 15 }
    }
  ]
};

describe('growth pre-action planner (R10)', () => {
  it('computes level-up fee, resulting level, wallet remainder, and wasted XP at cap', () => {
    const plan = planLevelUp({
      character: baseChar,
      accountLevel: 5,
      balance: 50,
      have: new Map([['xp_codex', 3]]),
      xpItems: [{ itemId: 'xp_codex', xp: 250 }],
      currencyName: "Bell's Remains",
      itemName: () => 'Tactical Field Manual'
    });
    expect(plan.canExecute).toBe(true);
    expect(plan.gate).toBe('ready');
    // Lv1->2 needs 100 XP (fee 2), Lv2->3 needs 150 XP (fee 3) => 250 XP reaches Lv 3 with 0 XP left, fee = 5
    expect(plan.toLevel).toBe(3);
    expect(plan.toXp).toBe(0);
    expect(plan.fee).toBe(5);
    expect(plan.balanceAfter).toBe(45);
    expect(plan.wastedXp).toBe(0);
  });

  it('detects insufficient currency and ascension/account gates for level-up and ascension', () => {
    const noFunds = planLevelUp({
      character: baseChar,
      accountLevel: 5,
      balance: 1,
      have: new Map([['xp_codex', 3]]),
      xpItems: [{ itemId: 'xp_codex', xp: 250 }],
      currencyName: "Bell's Remains",
      itemName: () => 'Tactical Field Manual'
    });
    expect(noFunds.canExecute).toBe(false);
    expect(noFunds.gate).toBe('insufficient_funds');
    expect(noFunds.reason).toContain("need 5 Bell's Remains");

    const ascNotAtCap = planAscension({
      character: baseChar,
      accountLevel: 5,
      balance: 100,
      have: new Map([['ember_sigil', 2]]),
      currencyName: "Bell's Remains",
      itemName: () => 'Ember Sigil'
    });
    expect(ascNotAtCap.canExecute).toBe(false);
    expect(ascNotAtCap.gate).toBe('not_at_cap');

    const ascStoryGate = planAscension({
      character: { ...baseChar, level: 5 },
      accountLevel: 5,
      balance: 100,
      have: new Map([['ember_sigil', 2]]),
      clearedNodes: new Set(['ch1_node_1']),
      currencyName: "Bell's Remains",
      itemName: () => 'Ember Sigil'
    });
    expect(ascStoryGate.canExecute).toBe(false);
    expect(ascStoryGate.gate).toBe('story_gate');
    expect(ascStoryGate.reason).toContain('ch1_node_5');
  });

  it('computes skill upgrade pre-action costs, rank transition, and unlock gates', () => {
    const locked = planSkillUpgrade({
      skill: baseChar.skills[0]!,
      characterLevel: 1,
      balance: 100,
      have: new Map([['tome_basic', 5]]),
      currencyName: "Bell's Remains",
      itemName: () => 'Basic Tome'
    });
    expect(locked.canExecute).toBe(false);
    expect(locked.gate).toBe('level_too_low');

    const ready = planSkillUpgrade({
      skill: baseChar.skills[0]!,
      characterLevel: 3,
      balance: 100,
      have: new Map([['tome_basic', 5]]),
      currencyName: "Bell's Remains",
      itemName: () => 'Basic Tome'
    });
    expect(ready.canExecute).toBe(true);
    expect(ready.gate).toBe('ready');
    expect(ready.fromRank).toBe(1);
    expect(ready.toRank).toBe(2);
    expect(ready.fee).toBe(15);
    expect(ready.balanceAfter).toBe(85);
  });
});
