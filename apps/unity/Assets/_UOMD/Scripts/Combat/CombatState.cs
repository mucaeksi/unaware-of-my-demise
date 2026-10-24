#nullable enable
// Runtime battle state (C# port of packages/combat/src/types.ts). Numbers are doubles, exactly as in TypeScript, so the
// arithmetic and the canonical event log stay bit-identical with the server's replay (POST /api/v1/battles/verify).
using System;
using System.Collections.Generic;

namespace Uomd.Combat
{
    public sealed class StatusInstance
    {
        public string StatusId = "";
        public double TurnsLeft;
        public string SourceId = "";
        public double Seq;
        public double? Value;
        public double? Power;
        public bool Copied;
    }

    public sealed class StatMod
    {
        public string Stat = "";
        public string Mode = "";
        public double Amount;
        public double TurnsLeft;
    }

    public sealed class ShieldInstance
    {
        public double Amount;
        public double TurnsLeft;
        public string? SourceId;
        public bool Copied;
    }

    public sealed class RedirectInstance
    {
        public string ProtectorId = "";
        public double Fraction;
        public double TurnsLeft;
        public IReadOnlyList<string> Eligible = Array.Empty<string>();
        public double? HitsLeft;
    }

    public sealed class RegenInstance
    {
        public string SourceId = "";
        public double Amount;
        public double TicksLeft;
        public double TurnsLeft;
    }

    public sealed class DamageReduction
    {
        public double Mult;
        public double TurnsLeft;
        public double? HitsLeft;
    }

    public sealed class OpeningGuard
    {
        public double Mult;
        public double RoundsLeft;
        public List<string> Used = new List<string>();
    }

    public sealed class CounterInstance
    {
        public string OwnerId = "";
        public string SkillId = "";
        public string ScaleStat = "";
        public double Multiplier;
        public string DamageType = "";
    }

    public sealed class BossModifier
    {
        public string Id = "";
        public double Mult;
        public string? UntilObjective;
        public List<string>? WhileAny;
    }

    public sealed class PendingTelegraph
    {
        public string SkillId = "";
        public double ActionsNeeded;
        public double ActionsSeen;
    }

    public sealed class BossState
    {
        public int Phase;
        public double BaseHp, BaseAtk, BaseDef;
        public List<BossModifier> Modifiers = new List<BossModifier>();
        public PendingTelegraph? Telegraph;
        public bool TransitionPending;
    }

    public sealed class ObjectiveState
    {
        public string ObjectiveId = "";
        public string BossId = "";
        public bool Targetable;
        public bool Persists;
    }

    public sealed class CombatBase
    {
        public double Atk, Def, Spd;
        public double? Res;
        public double? Crit, CritDamage, EffectHit;
    }

    public sealed class Combatant
    {
        public string Id = "";
        public UnitDef Def = new UnitDef();
        /// <summary>"player" | "enemy"</summary>
        public string Side = "";
        public double Slot;
        /// <summary>"front" | "rear"</summary>
        public string Row = "";
        public double Level;
        public double MaxHp, Hp;
        public CombatBase Base = new CombatBase();
        public double Gauge, PendingDelay, Focus, FocusGainedThisTurn;
        public Dictionary<string, double> Cooldowns = new Dictionary<string, double>();
        public List<StatusInstance> Statuses = new List<StatusInstance>();
        public List<StatMod> Mods = new List<StatMod>();
        public List<ShieldInstance> Shields = new List<ShieldInstance>();
        public List<RedirectInstance> Redirects = new List<RedirectInstance>();
        public List<RegenInstance> Regens = new List<RegenInstance>();
        public List<DamageReduction> Reductions = new List<DamageReduction>();
        public OpeningGuard? OpeningGuard;
        public List<CounterInstance> Counters = new List<CounterInstance>();
        public double? NextAttackBonus;
        public bool Acted, TookDamageThisRound;
        public string? LastHealTarget;
        public Dictionary<string, double> HookBattleCount = new Dictionary<string, double>();
        public Dictionary<string, double> HookTurnCount = new Dictionary<string, double>();
        public Dictionary<string, double> HookRoundCount = new Dictionary<string, double>();
        public Dictionary<string, double> HookTargetCount = new Dictionary<string, double>();
        public Dictionary<string, double> SkillRanks = new Dictionary<string, double>();
        public EquipmentEffectsDef EquipmentEffects = new EquipmentEffectsDef();
        public bool Alive = true;
        public BossState? Boss;
        public ObjectiveState? Objective;
        public List<string>? WeaknessOverride;
    }

    public sealed class SkillOption
    {
        public string SkillId = "";
        public string Name = "";
        public string Type = "";
        public bool Available;
        /// <summary>"cooldown" | "focus" | null</summary>
        public string? Reason;
        public double CooldownLeft;
        public bool NeedsTarget;
        public List<string> LegalTargets = new List<string>();
        public SkillDef Def = new SkillDef();
    }

    public sealed class TurnPrompt
    {
        public string Actor = "";
        public List<SkillOption> Options = new List<SkillOption>();
    }

    public sealed class PlayerAction
    {
        public string SkillId = "";
        public string? TargetId;

        public PlayerAction(string skillId, string? targetId = null)
        {
            SkillId = skillId;
            TargetId = targetId;
        }
    }

    public sealed class BattleResult
    {
        /// <summary>"player" | "enemy"</summary>
        public string Winner = "";
        public int Stars;
        public double Turns;
    }

    public sealed class StepResult
    {
        /// <summary>Events emitted by this step; each is the canonical log entry (see <see cref="Battle.Log"/>).</summary>
        public List<Dictionary<string, object?>> Events = new List<Dictionary<string, object?>>();
        public TurnPrompt? Prompt;
        public BattleResult? Result;
    }

    public sealed class IllegalActionException : Exception
    {
        public IllegalActionException(string message) : base(message) { }
    }
}
