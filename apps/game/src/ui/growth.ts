import type { CharacterView, SkillView } from '../net/api';

export interface CatalogProgressionConfig {
  character: {
    levelCap: number;
    xp: { a: number; b: number; c: number };
    fee: { base: number; increment: number };
    ascension: { cap: number; accountLevel: number; items: { itemId: string; quantity: number }[]; fee: number; requiresNode?: string }[];
  };
}

const DEFAULT_PROGRESSION: CatalogProgressionConfig = {
  character: {
    levelCap: 20,
    xp: { a: 60, b: 35, c: 5 },
    fee: { base: 1, increment: 1 },
    ascension: [
      { cap: 5, accountLevel: 1, items: [], fee: 0 },
      { cap: 10, accountLevel: 5, items: [], fee: 20 },
      { cap: 15, accountLevel: 10, items: [], fee: 55 },
      { cap: 20, accountLevel: 15, items: [], fee: 120 }
    ]
  }
};

export function xpForNextLevel(cfg: CatalogProgressionConfig | null | undefined, level: number): number {
  const xp = (cfg ?? DEFAULT_PROGRESSION).character.xp;
  return Math.round(xp.a + xp.b * level + xp.c * level * level);
}

export function feeForSingleLevel(cfg: CatalogProgressionConfig | null | undefined, level: number): number {
  const fee = (cfg ?? DEFAULT_PROGRESSION).character.fee;
  return Math.max(1, Math.ceil(fee.base + level * fee.increment));
}

export interface LevelUpPlan {
  canExecute: boolean;
  gate: 'ready' | 'account_level' | 'ascension_cap' | 'max_level' | 'missing_xp_item' | 'xp_overflow' | 'insufficient_funds';
  xpItem: { itemId: string; xp: number; have: number; name: string } | null;
  fee: number;
  balanceAfter: number;
  fromLevel: number;
  toLevel: number;
  levelsGained: number;
  fromXp: number;
  toXp: number;
  toXpNext: number | null;
  wastedXp: number;
  costSummary: string;
  resultSummary: string;
  reason: string;
}

export function planLevelUp(opts: {
  character: CharacterView;
  accountLevel: number;
  balance: number;
  have: ReadonlyMap<string, number>;
  xpItems: readonly { itemId: string; xp: number }[];
  cfg?: CatalogProgressionConfig | null;
  currencyName: string;
  itemName: (id: string) => string;
}): LevelUpPlan {
  const { character: c, accountLevel, balance, have, xpItems, cfg, currencyName, itemName } = opts;
  const chosen = xpItems.find((i) => (have.get(i.itemId) ?? 0) > 0) ?? xpItems[0] ?? null;
  const xpItem = chosen ? { itemId: chosen.itemId, xp: chosen.xp, have: have.get(chosen.itemId) ?? 0, name: itemName(chosen.itemId) } : null;

  // Simulate applying 1 XP item
  let level = c.level;
  let xp = c.xp + (xpItem?.xp ?? 0);
  let fee = 0;
  while (level < c.cap && xp >= xpForNextLevel(cfg, level)) {
    xp -= xpForNextLevel(cfg, level);
    fee += feeForSingleLevel(cfg, level);
    level++;
  }
  let wastedXp = 0;
  if (level >= c.cap) {
    wastedXp = Math.max(0, xp);
    xp = 0;
  }
  const maxCap = (cfg ?? DEFAULT_PROGRESSION).character.levelCap;
  const toXpNext = level >= maxCap ? null : xpForNextLevel(cfg, level);
  const balanceAfter = balance - fee;

  let neededToCap = -c.xp;
  for (let l = c.level; l < c.cap; l++) neededToCap += xpForNextLevel(cfg, l);
  neededToCap = Math.max(0, neededToCap);

  if (c.level >= c.cap) {
    const ascSteps = (cfg ?? DEFAULT_PROGRESSION).character.ascension;
    const rawStepCap = c.ascension <= 0 ? (ascSteps[0]?.cap ?? maxCap) : (ascSteps[Math.min(c.ascension, ascSteps.length - 1)]?.cap ?? maxCap);
    const gate = c.level < rawStepCap && accountLevel <= c.level
      ? 'account_level'
      : c.nextAscension !== null
        ? 'ascension_cap'
        : 'max_level';
    const reason = gate === 'account_level'
      ? `Blocked: requires Account Lv ${c.level + 1} (now Lv ${accountLevel})`
      : gate === 'ascension_cap'
        ? `Blocked: at Lv ${c.cap} cap — ascend first`
        : `Max level (${c.cap}) reached`;
    return {
      canExecute: false,
      gate,
      xpItem,
      fee: 0,
      balanceAfter: balance,
      fromLevel: c.level,
      toLevel: c.level,
      levelsGained: 0,
      fromXp: c.xp,
      toXp: c.xp,
      toXpNext: c.xpToNext,
      wastedXp: 0,
      costSummary: xpItem ? `${xpItem.name} (${xpItem.have} owned)` : 'No XP items',
      resultSummary: `Lv ${c.level}/${c.cap}`,
      reason
    };
  }

  if (!xpItem || xpItem.have < 1) {
    const label = xpItem ? `Need 1 ${xpItem.name} (0 owned)` : 'No XP items owned';
    return {
      canExecute: false,
      gate: 'missing_xp_item',
      xpItem,
      fee,
      balanceAfter,
      fromLevel: c.level,
      toLevel: level,
      levelsGained: level - c.level,
      fromXp: c.xp,
      toXp: xp,
      toXpNext,
      wastedXp,
      costSummary: label,
      resultSummary: `Lv ${c.level} → ${level} · Waste ${wastedXp} XP`,
      reason: `Blocked: ${label}`
    };
  }

  if (xpItem.xp - neededToCap >= xpItem.xp) {
    return {
      canExecute: false,
      gate: 'xp_overflow',
      xpItem,
      fee,
      balanceAfter,
      fromLevel: c.level,
      toLevel: level,
      levelsGained: level - c.level,
      fromXp: c.xp,
      toXp: xp,
      toXpNext,
      wastedXp,
      costSummary: `1 ${xpItem.name} (${xpItem.have}/1) · ${fee} ${currencyName}`,
      resultSummary: `Lv ${c.level} → ${level} · Waste ${wastedXp} XP`,
      reason: `Blocked: ${xpItem.xp} XP overflows remaining ${neededToCap} XP to cap`
    };
  }

  if (balance < fee) {
    return {
      canExecute: false,
      gate: 'insufficient_funds',
      xpItem,
      fee,
      balanceAfter,
      fromLevel: c.level,
      toLevel: level,
      levelsGained: level - c.level,
      fromXp: c.xp,
      toXp: xp,
      toXpNext,
      wastedXp,
      costSummary: `1 ${xpItem.name} (${xpItem.have}/1) · Fee ${fee} ${currencyName}`,
      resultSummary: `Lv ${c.level} → ${level} · Waste ${wastedXp} XP`,
      reason: `Blocked: need ${fee} ${currencyName} (wallet ${balance})`
    };
  }

  return {
    canExecute: true,
    gate: 'ready',
    xpItem,
    fee,
    balanceAfter,
    fromLevel: c.level,
    toLevel: level,
    levelsGained: level - c.level,
    fromXp: c.xp,
    toXp: xp,
    toXpNext,
    wastedXp,
    costSummary: `1 ${xpItem.name} (${xpItem.have}/1) · Fee ${fee} ${currencyName}`,
    resultSummary: `Lv ${c.level} → ${level} (XP ${xp}/${toXpNext ?? 'MAX'}) · Wallet → ${balanceAfter} · Waste ${wastedXp} XP`,
    reason: 'Ready'
  };
}

export interface AscensionPlan {
  canExecute: boolean;
  gate: 'ready' | 'max_ascension' | 'not_at_cap' | 'account_level_too_low' | 'story_gate' | 'insufficient_items' | 'insufficient_funds';
  fee: number;
  balanceAfter: number;
  fromAscension: number;
  toAscension: number;
  fromCap: number;
  toCap: number;
  costSummary: string;
  resultSummary: string;
  reason: string;
}

export function planAscension(opts: {
  character: CharacterView;
  accountLevel: number;
  balance: number;
  have: ReadonlyMap<string, number>;
  clearedNodes?: ReadonlySet<string>;
  currencyName: string;
  itemName: (id: string) => string;
}): AscensionPlan {
  const { character: c, accountLevel, balance, have, clearedNodes, currencyName, itemName } = opts;
  const asc = c.nextAscension;
  if (!asc) {
    return {
      canExecute: false,
      gate: 'max_ascension',
      fee: 0,
      balanceAfter: balance,
      fromAscension: c.ascension,
      toAscension: c.ascension,
      fromCap: c.cap,
      toCap: c.cap,
      costSummary: 'No further ascension cost',
      resultSummary: `Ascension ${c.ascension} (Max) · Cap Lv ${c.cap}`,
      reason: 'Maximum ascension reached'
    };
  }

  const fee = Math.ceil(asc.fee);
  const balanceAfter = balance - fee;
  const itemsText = asc.items.map((i) => `${itemName(i.itemId)} ${have.get(i.itemId) ?? 0}/${i.quantity}`).join(' · ');
  const costSummary = `${itemsText ? `${itemsText} · ` : ''}Fee ${fee} ${currencyName}`;
  const resultSummary = `Asc ${c.ascension} → ${c.ascension + 1} · Cap Lv ${c.cap} → ${asc.cap} · Wallet → ${balanceAfter}`;

  if (c.level < c.cap) {
    return {
      canExecute: false,
      gate: 'not_at_cap',
      fee,
      balanceAfter,
      fromAscension: c.ascension,
      toAscension: c.ascension + 1,
      fromCap: c.cap,
      toCap: asc.cap,
      costSummary,
      resultSummary,
      reason: `Blocked: reach Lv ${c.cap} first (now Lv ${c.level})`
    };
  }

  if (accountLevel < asc.accountLevel) {
    return {
      canExecute: false,
      gate: 'account_level_too_low',
      fee,
      balanceAfter,
      fromAscension: c.ascension,
      toAscension: c.ascension + 1,
      fromCap: c.cap,
      toCap: asc.cap,
      costSummary,
      resultSummary,
      reason: `Blocked: requires Account Lv ${asc.accountLevel} (now Lv ${accountLevel})`
    };
  }

  if (asc.requiresNode && clearedNodes && !clearedNodes.has(asc.requiresNode)) {
    return {
      canExecute: false,
      gate: 'story_gate',
      fee,
      balanceAfter,
      fromAscension: c.ascension,
      toAscension: c.ascension + 1,
      fromCap: c.cap,
      toCap: asc.cap,
      costSummary,
      resultSummary,
      reason: `Blocked: clear stage ${asc.requiresNode} first`
    };
  }

  const missing = asc.items.filter((i) => (have.get(i.itemId) ?? 0) < i.quantity);
  if (missing.length > 0) {
    return {
      canExecute: false,
      gate: 'insufficient_items',
      fee,
      balanceAfter,
      fromAscension: c.ascension,
      toAscension: c.ascension + 1,
      fromCap: c.cap,
      toCap: asc.cap,
      costSummary,
      resultSummary,
      reason: `Blocked: missing ${missing.map((i) => `${itemName(i.itemId)} (${have.get(i.itemId) ?? 0}/${i.quantity})`).join(', ')}`
    };
  }

  if (balance < fee) {
    return {
      canExecute: false,
      gate: 'insufficient_funds',
      fee,
      balanceAfter,
      fromAscension: c.ascension,
      toAscension: c.ascension + 1,
      fromCap: c.cap,
      toCap: asc.cap,
      costSummary,
      resultSummary,
      reason: `Blocked: need ${fee} ${currencyName} (wallet ${balance})`
    };
  }

  return {
    canExecute: true,
    gate: 'ready',
    fee,
    balanceAfter,
    fromAscension: c.ascension,
    toAscension: c.ascension + 1,
    fromCap: c.cap,
    toCap: asc.cap,
    costSummary,
    resultSummary,
    reason: 'Ready'
  };
}

export interface SkillUpgradePlan {
  canExecute: boolean;
  gate: 'ready' | 'max_rank' | 'level_too_low' | 'insufficient_items' | 'insufficient_funds';
  fee: number;
  balanceAfter: number;
  fromRank: number;
  toRank: number;
  costSummary: string;
  resultSummary: string;
  reason: string;
}

export function planSkillUpgrade(opts: {
  skill: SkillView;
  characterLevel: number;
  balance: number;
  have: ReadonlyMap<string, number>;
  currencyName: string;
  itemName: (id: string) => string;
}): SkillUpgradePlan {
  const { skill, characterLevel, balance, have, currencyName, itemName } = opts;
  const n = skill.next;
  if (!n) {
    return {
      canExecute: false,
      gate: 'max_rank',
      fee: 0,
      balanceAfter: balance,
      fromRank: skill.rank,
      toRank: skill.rank,
      costSummary: 'Max rank reached',
      resultSummary: `Rank ${skill.rank}/${skill.maxRank}`,
      reason: 'Max rank'
    };
  }

  const haveQty = have.get(n.itemId) ?? 0;
  const fee = Math.ceil(n.fee);
  const balanceAfter = balance - fee;
  const matName = itemName(n.itemId);
  const costSummary = `${matName} ${haveQty}/${n.quantity} · Fee ${fee} ${currencyName}`;
  const resultSummary = `Rank ${skill.rank} → ${n.rank}/${skill.maxRank} · Wallet → ${balanceAfter}`;

  if (characterLevel < n.unlockLevel) {
    return {
      canExecute: false,
      gate: 'level_too_low',
      fee,
      balanceAfter,
      fromRank: skill.rank,
      toRank: n.rank,
      costSummary,
      resultSummary,
      reason: `Requires Lv ${n.unlockLevel} (now Lv ${characterLevel})`
    };
  }

  if (haveQty < n.quantity) {
    return {
      canExecute: false,
      gate: 'insufficient_items',
      fee,
      balanceAfter,
      fromRank: skill.rank,
      toRank: n.rank,
      costSummary,
      resultSummary,
      reason: `Need ${matName} ${haveQty}/${n.quantity}`
    };
  }

  if (balance < fee) {
    return {
      canExecute: false,
      gate: 'insufficient_funds',
      fee,
      balanceAfter,
      fromRank: skill.rank,
      toRank: n.rank,
      costSummary,
      resultSummary,
      reason: `Need ${fee} ${currencyName} (wallet ${balance})`
    };
  }

  return {
    canExecute: true,
    gate: 'ready',
    fee,
    balanceAfter,
    fromRank: skill.rank,
    toRank: n.rank,
    costSummary,
    resultSummary,
    reason: 'Ready'
  };
}
