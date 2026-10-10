import type { SkillDef, SkillType, UnitDef } from '@uomd/content-schema';

export type Side = 'player' | 'enemy';
export type Row = 'front' | 'rear';
export type StatKey = 'atk' | 'def' | 'spd' | 'res' | 'veil_res';

export interface StatusInstance {
  statusId: string;
  turnsLeft: number;
  sourceId: string;
  seq: number;
}
export interface StatMod {
  stat: StatKey;
  mode: 'add_pct' | 'add_flat';
  amount: number;
  turnsLeft: number;
}
export interface ShieldInstance {
  amount: number;
  turnsLeft: number;
}
export interface RedirectInstance {
  protectorId: string;
  fraction: number;
  turnsLeft: number;
  eligible: readonly string[];
}

export interface Combatant {
  id: string;
  def: UnitDef;
  side: Side;
  slot: number;
  row: Row;
  level: number;
  maxHp: number;
  hp: number;
  base: { atk: number; def: number; res: number | null; spd: number };
  gauge: number;
  pendingDelay: number;
  focus: number;
  focusGainedThisTurn: number;
  cooldowns: Record<string, number>;
  statuses: StatusInstance[];
  mods: StatMod[];
  shields: ShieldInstance[];
  redirects: RedirectInstance[];
  hookBattleCount: Record<string, number>;
  hookTurnCount: Record<string, number>;
  alive: boolean;
}

export type BattleEvent =
  | { type: 'battle_start'; seed: number }
  | { type: 'turn_start'; actor: string; turn: number }
  | { type: 'turn_skipped'; actor: string; reason: string }
  | { type: 'skill_used'; actor: string; skill: string; skillType: SkillType; targets: string[] }
  | {
      type: 'damage';
      source: string;
      target: string;
      amount: number;
      absorbed: number;
      hpAfter: number;
      crit: boolean;
      elementMultiplier: number;
      redirectedFrom?: string;
      counter?: boolean;
    }
  | { type: 'heal'; source: string; target: string; amount: number; hpAfter: number }
  | { type: 'shield'; source: string; target: string; amount: number }
  | { type: 'status_applied'; source: string; target: string; status: string; turns: number }
  | { type: 'status_removed'; target: string; status: string; reason: 'expired' | 'cleansed' }
  | { type: 'stat_mod'; target: string; stat: StatKey; mode: 'add_pct' | 'add_flat'; amount: number; turns: number }
  | { type: 'focus'; unit: string; delta: number; total: number }
  | { type: 'redirect_granted'; protector: string; protected: string; fraction: number; turns: number }
  | { type: 'hook_triggered'; unit: string; skill: string; event: string }
  | { type: 'defeat'; unit: string }
  | { type: 'battle_end'; winner: Side; stars: 0 | 1 | 2 | 3 };

export interface SkillOption {
  skillId: string;
  name: string;
  type: SkillType;
  available: boolean;
  reason?: 'cooldown' | 'focus';
  cooldownLeft: number;
  needsTarget: boolean;
  legalTargets: string[];
  def: SkillDef;
}

export interface TurnPrompt {
  actor: string;
  options: SkillOption[];
}

export interface PlayerAction {
  skillId: string;
  targetId?: string;
}

export interface BattleResult {
  winner: Side;
  stars: 0 | 1 | 2 | 3;
  turns: number;
}

export interface StepResult {
  events: BattleEvent[];
  prompt: TurnPrompt | null;
  result: BattleResult | null;
}

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}
