import type { SkillDef, SkillType, UnitDef } from '@uomd/content-schema';

export type Side = 'player' | 'enemy';
export type Row = 'front' | 'rear';
export type StatKey = 'atk' | 'def' | 'spd' | 'res' | 'veil_res';

export interface StatusInstance {
  statusId: string;
  turnsLeft: number;
  sourceId: string;
  seq: number;
  /** soul_link: shared fraction. */
  value?: number;
  /** damage over time: source ATK snapshot taken when applied. */
  power?: number;
  /** copied from another unit (Portrait Borrowing, Mirror Frame) */
  copied?: boolean;
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
  /** named shields (e.g. a formation) can be stripped as a group */
  sourceId?: string;
  copied?: boolean;
}
export interface RedirectInstance {
  protectorId: string;
  fraction: number;
  turnsLeft: number;
  eligible: readonly string[];
  /** grant_intercept: remaining interceptions. */
  hitsLeft?: number;
}
export interface RegenInstance {
  sourceId: string;
  amount: number;
  ticksLeft: number;
  turnsLeft: number;
}
export interface DamageReduction {
  mult: number;
  turnsLeft: number;
  /** first-hit guards disappear after this many hits. */
  hitsLeft?: number;
}
export interface OpeningGuard {
  mult: number;
  roundsLeft: number;
  /** enemies whose first single-target attack was already redirected. */
  used: string[];
}
export interface CounterInstance {
  ownerId: string;
  /** the skill that armed it (its rank scales the counter) */
  skillId: string;
  scaleStat: 'atk' | 'def' | 'hp';
  multiplier: number;
  damageType: 'physical' | 'magic' | 'elemental';
  consume: boolean;
}

/** A boss-side damage-taken multiplier tied to objectives (wax seal, glass racks, aether ward). */
export interface BossModifier {
  id: string;
  mult: number;
  untilObjective?: string;
  whileAny?: string[];
}
export interface PendingTelegraph {
  skillId: string;
  /** player actions that must happen between the announcement and the resolution */
  actionsNeeded: number;
  actionsSeen: number;
}
export interface BossState {
  phase: number;
  /** level-scaled base values; phase multipliers apply on top */
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  modifiers: BossModifier[];
  telegraph: PendingTelegraph | null;
  transitionPending: boolean;
}
export interface ObjectiveState {
  objectiveId: string;
  bossId: string;
  targetable: boolean;
  persists: boolean;
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
  regens: RegenInstance[];
  reductions: DamageReduction[];
  openingGuard: OpeningGuard | null;
  counters: CounterInstance[];
  nextAttackBonus: number | null;
  acted: boolean;
  tookDamageThisRound: boolean;
  lastHealTarget: string | null;
  hookBattleCount: Record<string, number>;
  hookTurnCount: Record<string, number>;
  hookRoundCount: Record<string, number>;
  hookTargetCount: Record<string, number>;
  /** skill_id -> rank (absent = 1) */
  skillRanks: Record<string, number>;
  alive: boolean;
  boss: BossState | null;
  /** set for breakable objectives: they are targets, never actors, and never count for victory */
  objective: ObjectiveState | null;
  /** the current boss phase's weaknesses replace the unit's own */
  weaknessOverride: readonly string[] | null;
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
      /** damage over time / soul-link share: the status that caused it. */
      dot?: string;
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
  | { type: 'hp_cost'; unit: string; amount: number; hpAfter: number }
  | { type: 'blocked'; unit: string; source: string }
  | { type: 'delay'; unit: string; fraction: number }
  | { type: 'shield_removed'; unit: string; amount: number }
  | { type: 'buff_copied'; source: string; target: string; what: string }
  | { type: 'reaction'; unit: string; name: string; bonus: number }
  | { type: 'round_end'; round: number }
  | { type: 'phase_change'; unit: string; phase: string; hp: number; maxHp: number }
  | { type: 'telegraph'; unit: string; skill: string; skillName: string; targets: string[]; actionsNeeded: number }
  | { type: 'telegraph_cancelled'; unit: string; skill: string; reason: string }
  | { type: 'objective_destroyed'; objective: string; boss: string }
  | { type: 'summon'; source: string; unit: string }
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
