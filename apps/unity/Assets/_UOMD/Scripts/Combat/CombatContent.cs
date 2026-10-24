#nullable enable
// Typed combat content (C# port of the combat slice of @uomd/content-schema: units.ts, effects.ts, story.ts).
// The combat schemas have no Zod defaults, so raw content JSON is exactly what the TypeScript engine sees.
// Optional fields stay nullable: the engine distinguishes "absent" from a value the same way TypeScript does.
using System;
using System.Collections.Generic;
using System.Globalization;
using Uomd.Core;

namespace Uomd.Combat
{
    public sealed class UnitPackDef
    {
        public string PackId = "";
        public List<UnitDef> Units = new List<UnitDef>();
        public RulesDef Rules = new RulesDef();

        public static UnitPackDef FromJson(string json) => CombatJson.Pack(UomdJson.ParseObject(json));
    }

    public sealed class RulesDef
    {
        public double GaugeMax;
        public double MaxPendingDelayFraction;
        public double DefenseScale;
        public double FocusMaximum, FocusBasicGain, FocusActiveGain, FocusHitGain, FocusHitGainCapPerTurn, FocusUltimateCost;
        public double CritChance, CritMultiplier;
        public List<string> ElementCycle = new List<string>();
        public double ElementAdvantage, ElementDisadvantage, ElementNeutral, ElementWeakness, ElementResistance;
        public List<(string A, string B)> MutualPairs = new List<(string, string)>();
        public double AutoHealPriorityHpPercent;
        public bool AutoSaveUltimateUntilBoss;
        public double? SkillRankBonus;
        public List<StatusDef> Statuses = new List<StatusDef>();
    }

    public sealed class StatusReaction
    {
        public string Element = "";
        public string NameEn = "";
        public double BonusDamageMultiplier;
        public bool ConsumeStatus;
    }

    public sealed class StatusDef
    {
        public string StatusId = "";
        public string Category = "";
        public double? OutgoingDamageMultiplier, DamageTakenMultiplier, HealingReceivedMultiplier, DefMultiplier, FocusGainMultiplier, ResMultiplier;
        public bool? SkipNextAction, RedirectsSingleTargetAttacks;
        public List<string>? Tags;
        public double? DotAtkMultiplier;
        public Dictionary<string, double>? ElementDamageTakenMultiplier;
        public List<StatusReaction>? Reactions;
        public double? NextActionGaugeDelayFraction;
        public List<string>? ImmuneStatusIds;
        public double? SharedDamageCapFraction;
    }

    public sealed class StatsDef
    {
        public double Hp, Atk, Def, Spd;
        public double? Res;
    }

    public sealed class AttributeBlockDef
    {
        public string Power = "str";
        public double BaseStr, BaseInt, BaseVit, BaseAgi;
        public double GrowthStr, GrowthInt, GrowthVit, GrowthAgi;
        public double? Armor;
    }

    public sealed class UnitDef
    {
        public string UnitId = "";
        public string Kind = "";
        public string NameEn = "";
        public string Element = "";
        public StatsDef? BaseStats;
        public Dictionary<string, double>? GrowthPerLevel;
        public AttributeBlockDef? Attributes;
        public List<string>? Weaknesses, Resistances;
        public double? EffectRes;
        public Dictionary<string, double>? ElementRes;
        public List<SkillDef> Skills = new List<SkillDef>();
        public List<EventHookDef>? PassiveHooks;
        public List<ContinuousModifierDef>? ContinuousModifiers;
        public string? FactionId;
        public BossDef? Boss;
        public List<string>? StatusImmunities;
    }

    public sealed class TelegraphDef
    {
        public double PlayerActionsBeforeResolution;
        public bool? InterruptibleByControl;
        public string? InterruptIfObjectiveDestroyed;
        public List<string>? InterruptIfAllObjectivesDestroyed;
    }

    public sealed class SkillDef
    {
        public string SkillId = "";
        public string NameEn = "";
        /// <summary>basic | active | passive | ultimate | signature</summary>
        public string Type = "";
        public string? Element;
        /// <summary>enemy | ally | none</summary>
        public string PlayerTarget = "none";
        public double CooldownTurns, FocusCost, AiPriority;
        public List<EffectOpDef> EffectOps = new List<EffectOpDef>();
        public List<EventHookDef>? EventHooks;
        public List<ContinuousModifierDef>? ContinuousModifiers;
        public List<string>? PhaseIds;
        public TelegraphDef? Telegraph;
    }

    public sealed class PredicateDef
    {
        /// <summary>Leaf predicate name; null for all/any groups.</summary>
        public string? Name;
        public string? StringValue;
        public double NumberValue;
        public List<PredicateDef>? All, Any;
    }

    public sealed class DamageModifierDef
    {
        public PredicateDef Condition = new PredicateDef();
        /// <summary>Present on multiplier modifiers ('multiplier' in m).</summary>
        public double? Multiplier;
        public double AddMultiplierPerCount, MaximumCount;
    }

    /// <summary>One closed-grammar effect op; only the fields of its kind are set.</summary>
    public sealed class EffectOpDef
    {
        public string Op = "";
        public string TargetSelectorId = "";
        public PredicateDef? When;
        public string DamageType = "", ScaleStat = "", StatusId = "", Category = "", Selection = "", StatId = "", Mode = "";
        public double Multiplier, DurationTurns, Count, Amount, MaximumTargets, MaximumTotalStacks, DamageTakenMultiplier, HitsPerTarget;
        public double DurationRounds, MaximumIntercepts, Ticks, AmountTurns, MinimumRemainingTurns, GaugeFraction, MaxHpFraction;
        public double CannotReduceBelow, DamageMultiplier, MaximumCount, RedirectedFraction;
        public bool? NoFocusGain, CanTriggerPassives;
        public bool RequiresSuccessfulCleanse;
        public double? HitCount, ShieldDamageMultiplier, Chance, SharedDamageFraction, AmountFraction;
        public List<DamageModifierDef>? Modifiers;
        public string? MultiplierIfObjectiveAliveId;
        public double MultiplierIfObjectiveAliveValue;
        public double? MultiplierIfAllObjectivesAlive;
        public string? ShieldSourceId;
        public string ProtectedAllySelectorId = "", SourceSelectorId = "";
        public List<string> EligibleActionTypes = new List<string>();
        public string ActionId = "", ModifierId = "", EnemyId = "";
        public string? UntilObjectiveDestroyed, OnlyIfObjectiveAlive;
        public List<string>? WhileAnyObjectiveAlive;
        public List<string> ObjectiveIds = new List<string>();
    }

    public sealed class HookLimitDef
    {
        public double? PerBattle, PerOwnerTurn, PerRound, PerDamageAction, PerTargetPerBattle, Chance;
        public bool? OnePendingBonus;
    }

    public sealed class EventFilterDef
    {
        public string? IncomingActionType, DamageActionType, OwnerActionType, Team, AllyActionType, EventTargetFactionIs;
        public bool? SourceIsOwner, ExcludeOwner;
    }

    public sealed class EventHookDef
    {
        public string Event = "";
        public List<EffectOpDef> EffectOps = new List<EffectOpDef>();
        public PredicateDef? Condition;
        public HookLimitDef? Limit;
        public EventFilterDef? EventFilter;
    }

    public sealed class ContinuousModifierDef
    {
        public string Event = "";
        public PredicateDef? Condition;
        public string Target = "";
        public double DamageMultiplier;
        public string? AppliesTo;
        public string StatId = "";
        public double Amount;
    }

    public sealed class BossObjectiveDef
    {
        public string ObjectiveId = "";
        public string NameEn = "";
        public double MaxHp;
        public bool TargetableByPlayer;
        public bool? PersistsAcrossPhases;
        public List<EffectOpDef>? OnDestroyed;
    }

    public sealed class BossPhaseDef
    {
        public string PhaseId = "";
        public double? TransitionHpPercent;
        public double HpMultiplier, AtkMultiplier, DefMultiplier;
        public List<string> Weaknesses = new List<string>();
        public List<BossObjectiveDef> Objectives = new List<BossObjectiveDef>();
        public List<EffectOpDef> EnterOps = new List<EffectOpDef>();
        public List<EffectOpDef> PassiveOps = new List<EffectOpDef>();
    }

    public sealed class BossDef
    {
        public List<BossPhaseDef> Phases = new List<BossPhaseDef>();
        public List<string> PreserveStatusIds = new List<string>();
        public string ClearStatusCategory = "debuff";
        public double ControlDurationMultiplier = 1;
    }

    public sealed class EquipmentEffectsDef
    {
        public double? HealBonusPct, FocusGainPct, EffectResPct;
        public Dictionary<string, double>? ElementResPct;
        public List<EventHookDef>? Hooks;
    }

    public sealed class PartyStatsDef
    {
        public double Hp, Atk, Def, Spd;
        public double? Res, CritRate, CritDamage, EffectHit;
    }

    /// <summary>An encounter placement or a server-built party member (stats/ranks/equipment only on the latter).</summary>
    public sealed class PartyMemberDef
    {
        public string UnitId = "";
        public double Level, Slot;
        public string Row = "front";
        public PartyStatsDef? Stats;
        public Dictionary<string, double>? SkillRanks;
        public double? StartFocus;
        public EquipmentEffectsDef? EquipmentEffects;
    }

    public sealed class EnemyStatMultiplierDef
    {
        public double Value;
        public List<string> AppliesTo = new List<string>();
    }

    public sealed class EncounterDef
    {
        public string EncounterId = "";
        public double Seed;
        public List<PartyMemberDef> Party = new List<PartyMemberDef>();
        public List<PartyMemberDef> Enemies = new List<PartyMemberDef>();
        public List<List<PartyMemberDef>>? Waves;
        public EnemyStatMultiplierDef? EnemyStatMultiplier;

        public static EncounterDef FromJson(string json) => CombatJson.Encounter(UomdJson.ParseObject(json));
    }

    /// <summary>Maps UomdJson trees (Dictionary/List/string/bool/long/double) onto the typed combat model.</summary>
    public static class CombatJson
    {
        private static object? Get(IDictionary<string, object?> d, string k) => d.TryGetValue(k, out var v) ? v : null;
        private static string Str(IDictionary<string, object?> d, string k) => Get(d, k) as string ?? "";
        private static string? OptStr(IDictionary<string, object?> d, string k) => Get(d, k) as string;
        private static double Num(IDictionary<string, object?> d, string k) => OptNum(d, k) ?? 0;
        private static double? OptNum(IDictionary<string, object?> d, string k)
        {
            object? v = Get(d, k);
            return v == null || v is string || v is bool ? (double?)null : Convert.ToDouble(v, CultureInfo.InvariantCulture);
        }
        private static bool? OptBool(IDictionary<string, object?> d, string k) => Get(d, k) is bool b ? b : (bool?)null;
        private static IDictionary<string, object?>? OptObj(IDictionary<string, object?> d, string k) => Get(d, k) as IDictionary<string, object?>;
        private static List<object?>? OptArr(IDictionary<string, object?> d, string k) => Get(d, k) as List<object?>;
        private static IEnumerable<IDictionary<string, object?>> Objs(IDictionary<string, object?> d, string k)
        {
            foreach (object? o in OptArr(d, k) ?? new List<object?>()) if (o is IDictionary<string, object?> x) yield return x;
        }
        private static List<string>? OptStrings(IDictionary<string, object?> d, string k)
        {
            var arr = OptArr(d, k);
            if (arr == null) return null;
            var list = new List<string>();
            foreach (object? o in arr) list.Add((string)o!);
            return list;
        }
        private static Dictionary<string, double>? OptNumMap(IDictionary<string, object?> d, string k)
        {
            var o = OptObj(d, k);
            if (o == null) return null;
            var m = new Dictionary<string, double>();
            foreach (var kv in o) m[kv.Key] = Convert.ToDouble(kv.Value, CultureInfo.InvariantCulture);
            return m;
        }
        private static List<T> Map<T>(IDictionary<string, object?> d, string k, Func<IDictionary<string, object?>, T> f)
        {
            var list = new List<T>();
            foreach (var o in Objs(d, k)) list.Add(f(o));
            return list;
        }
        private static List<T>? OptMap<T>(IDictionary<string, object?> d, string k, Func<IDictionary<string, object?>, T> f) => OptArr(d, k) == null ? null : Map(d, k, f);

        public static UnitPackDef Pack(IDictionary<string, object?> d) => new UnitPackDef { PackId = Str(d, "pack_id"), Units = Map(d, "units", Unit), Rules = Rules(OptObj(d, "rules")!) };

        public static RulesDef Rules(IDictionary<string, object?> d)
        {
            var focus = OptObj(d, "focus")!;
            var crit = OptObj(d, "crit")!;
            var el = OptObj(d, "element")!;
            var auto = OptObj(d, "auto_battle")!;
            var r = new RulesDef
            {
                GaugeMax = Num(d, "gauge_max"),
                MaxPendingDelayFraction = Num(d, "max_pending_delay_fraction"),
                DefenseScale = Num(d, "defense_scale"),
                FocusMaximum = Num(focus, "maximum"),
                FocusBasicGain = Num(focus, "basic_gain"),
                FocusActiveGain = Num(focus, "active_gain"),
                FocusHitGain = Num(focus, "hit_gain"),
                FocusHitGainCapPerTurn = Num(focus, "hit_gain_cap_per_turn"),
                FocusUltimateCost = Num(focus, "ultimate_cost"),
                CritChance = Num(crit, "chance"),
                CritMultiplier = Num(crit, "multiplier"),
                ElementCycle = OptStrings(el, "cycle") ?? new List<string>(),
                ElementAdvantage = Num(el, "advantage"),
                ElementDisadvantage = Num(el, "disadvantage"),
                ElementNeutral = Num(el, "neutral"),
                ElementWeakness = Num(el, "weakness"),
                ElementResistance = Num(el, "resistance"),
                AutoHealPriorityHpPercent = Num(auto, "heal_priority_hp_percent"),
                AutoSaveUltimateUntilBoss = OptBool(auto, "save_ultimate_until_boss") ?? false,
                SkillRankBonus = OptNum(d, "skill_rank_bonus"),
                Statuses = Map(d, "statuses", Status)
            };
            foreach (object? pair in OptArr(el, "mutual_pairs") ?? new List<object?>())
            {
                var p = (List<object?>)pair!;
                r.MutualPairs.Add(((string)p[0]!, (string)p[1]!));
            }
            return r;
        }

        public static StatusDef Status(IDictionary<string, object?> d) => new StatusDef
        {
            StatusId = Str(d, "status_id"),
            Category = Str(d, "category"),
            OutgoingDamageMultiplier = OptNum(d, "outgoing_damage_multiplier"),
            DamageTakenMultiplier = OptNum(d, "damage_taken_multiplier"),
            HealingReceivedMultiplier = OptNum(d, "healing_received_multiplier"),
            DefMultiplier = OptNum(d, "def_multiplier"),
            FocusGainMultiplier = OptNum(d, "focus_gain_multiplier"),
            ResMultiplier = OptNum(d, "res_multiplier"),
            SkipNextAction = OptBool(d, "skip_next_action"),
            RedirectsSingleTargetAttacks = OptBool(d, "redirects_single_target_attacks"),
            Tags = OptStrings(d, "tags"),
            DotAtkMultiplier = OptNum(d, "dot_atk_multiplier"),
            ElementDamageTakenMultiplier = OptNumMap(d, "element_damage_taken_multiplier"),
            Reactions = OptMap(d, "reactions", x => new StatusReaction
            {
                Element = Str(x, "element"),
                NameEn = Str(x, "name_en"),
                BonusDamageMultiplier = Num(x, "bonus_damage_multiplier"),
                ConsumeStatus = OptBool(x, "consume_status") ?? false
            }),
            NextActionGaugeDelayFraction = OptNum(d, "next_action_gauge_delay_fraction"),
            ImmuneStatusIds = OptStrings(d, "immune_status_ids"),
            SharedDamageCapFraction = OptNum(d, "shared_damage_cap_fraction")
        };

        public static UnitDef Unit(IDictionary<string, object?> d)
        {
            var u = new UnitDef
            {
                UnitId = Str(d, "unit_id"),
                Kind = Str(d, "kind"),
                NameEn = Str(d, "name_en"),
                Element = Str(d, "element"),
                GrowthPerLevel = OptNumMap(d, "growth_per_level"),
                Weaknesses = OptStrings(d, "weaknesses"),
                Resistances = OptStrings(d, "resistances"),
                EffectRes = OptNum(d, "effect_res"),
                ElementRes = OptNumMap(d, "element_res"),
                Skills = Map(d, "skills", Skill),
                PassiveHooks = OptMap(d, "passive_hooks", Hook),
                ContinuousModifiers = OptMap(d, "continuous_modifiers", Modifier),
                FactionId = OptStr(d, "faction_id"),
                StatusImmunities = OptStrings(d, "status_immunities")
            };
            var bs = OptObj(d, "base_stats");
            if (bs != null) u.BaseStats = new StatsDef { Hp = Num(bs, "hp"), Atk = Num(bs, "atk"), Def = Num(bs, "def"), Spd = Num(bs, "spd"), Res = OptNum(bs, "res") };
            var at = OptObj(d, "attributes");
            if (at != null)
            {
                var b = OptObj(at, "base")!;
                var g = OptObj(at, "growth") ?? new Dictionary<string, object?>();
                u.Attributes = new AttributeBlockDef
                {
                    Power = Str(at, "power"),
                    BaseStr = Num(b, "str"), BaseInt = Num(b, "int"), BaseVit = Num(b, "vit"), BaseAgi = Num(b, "agi"),
                    GrowthStr = Num(g, "str"), GrowthInt = Num(g, "int"), GrowthVit = Num(g, "vit"), GrowthAgi = Num(g, "agi"),
                    Armor = OptNum(at, "armor")
                };
            }
            var boss = OptObj(d, "boss");
            if (boss != null)
            {
                u.Boss = new BossDef
                {
                    Phases = Map(boss, "phases", Phase),
                    PreserveStatusIds = OptStrings(boss, "preserve_status_ids") ?? new List<string>(),
                    ClearStatusCategory = Str(boss, "clear_status_category"),
                    ControlDurationMultiplier = Num(boss, "control_duration_multiplier")
                };
            }
            return u;
        }

        private static BossPhaseDef Phase(IDictionary<string, object?> d) => new BossPhaseDef
        {
            PhaseId = Str(d, "phase_id"),
            TransitionHpPercent = OptNum(d, "transition_hp_percent"),
            HpMultiplier = Num(d, "hp_multiplier"),
            AtkMultiplier = Num(d, "atk_multiplier"),
            DefMultiplier = Num(d, "def_multiplier"),
            Weaknesses = OptStrings(d, "weaknesses") ?? new List<string>(),
            Objectives = Map(d, "objectives", o => new BossObjectiveDef
            {
                ObjectiveId = Str(o, "objective_id"),
                NameEn = Str(o, "name_en"),
                MaxHp = Num(o, "max_hp"),
                TargetableByPlayer = OptBool(o, "targetable_by_player") ?? false,
                PersistsAcrossPhases = OptBool(o, "persists_across_phases"),
                OnDestroyed = OptMap(o, "on_destroyed", Op)
            }),
            EnterOps = Map(d, "enter_ops", Op),
            PassiveOps = Map(d, "passive_ops", Op)
        };

        public static SkillDef Skill(IDictionary<string, object?> d)
        {
            var s = new SkillDef
            {
                SkillId = Str(d, "skill_id"),
                NameEn = Str(d, "name_en"),
                Type = Str(d, "type"),
                Element = OptStr(d, "element"),
                PlayerTarget = Str(d, "player_target"),
                CooldownTurns = Num(d, "cooldown_turns"),
                FocusCost = Num(d, "focus_cost"),
                AiPriority = Num(d, "ai_priority"),
                EffectOps = Map(d, "effect_ops", Op),
                EventHooks = OptMap(d, "event_hooks", Hook),
                ContinuousModifiers = OptMap(d, "continuous_modifiers", Modifier),
                PhaseIds = OptStrings(d, "phase_ids")
            };
            var t = OptObj(d, "telegraph");
            if (t != null)
            {
                s.Telegraph = new TelegraphDef
                {
                    PlayerActionsBeforeResolution = Num(t, "player_actions_before_resolution"),
                    InterruptibleByControl = OptBool(t, "interruptible_by_control"),
                    InterruptIfObjectiveDestroyed = OptStr(t, "interrupt_if_objective_destroyed"),
                    InterruptIfAllObjectivesDestroyed = OptStrings(t, "interrupt_if_all_objectives_destroyed")
                };
            }
            return s;
        }

        public static PredicateDef? Pred(object? o)
        {
            if (!(o is IDictionary<string, object?> d)) return null;
            if (d.ContainsKey("all")) return new PredicateDef { All = Map(d, "all", x => Pred(x)!) };
            if (d.ContainsKey("any")) return new PredicateDef { Any = Map(d, "any", x => Pred(x)!) };
            var p = new PredicateDef { Name = Str(d, "predicate") };
            object? v = Get(d, "value");
            if (v is string sv) p.StringValue = sv;
            else if (v != null) p.NumberValue = Convert.ToDouble(v, CultureInfo.InvariantCulture);
            return p;
        }

        public static EffectOpDef Op(IDictionary<string, object?> d)
        {
            var op = new EffectOpDef
            {
                Op = Str(d, "op"),
                TargetSelectorId = Str(d, "target_selector_id"),
                When = Pred(Get(d, "when")),
                DamageType = Str(d, "damage_type"),
                ScaleStat = Str(d, "scale_stat"),
                StatusId = Str(d, "status_id"),
                Category = Str(d, "category"),
                Selection = Str(d, "selection"),
                StatId = Str(d, "stat_id"),
                Mode = Str(d, "mode"),
                Multiplier = Num(d, "multiplier"),
                DurationTurns = Num(d, "duration_turns"),
                Count = Num(d, "count"),
                Amount = Num(d, "amount"),
                MaximumTargets = Num(d, "maximum_targets"),
                MaximumTotalStacks = Num(d, "maximum_total_stacks"),
                DamageTakenMultiplier = Num(d, "damage_taken_multiplier"),
                HitsPerTarget = Num(d, "hits_per_target"),
                DurationRounds = Num(d, "duration_rounds"),
                MaximumIntercepts = Num(d, "maximum_intercepts"),
                Ticks = Num(d, "ticks"),
                AmountTurns = Num(d, "amount_turns"),
                MinimumRemainingTurns = Num(d, "minimum_remaining_turns"),
                GaugeFraction = Num(d, "gauge_fraction"),
                MaxHpFraction = Num(d, "max_hp_fraction"),
                CannotReduceBelow = Num(d, "cannot_reduce_below"),
                DamageMultiplier = Num(d, "damage_multiplier"),
                MaximumCount = Num(d, "maximum_count"),
                RedirectedFraction = Num(d, "redirected_fraction"),
                NoFocusGain = OptBool(d, "no_focus_gain"),
                CanTriggerPassives = OptBool(d, "can_trigger_passives"),
                RequiresSuccessfulCleanse = OptBool(d, "requires_successful_cleanse") ?? false,
                HitCount = OptNum(d, "hit_count"),
                ShieldDamageMultiplier = OptNum(d, "shield_damage_multiplier"),
                Chance = OptNum(d, "chance"),
                SharedDamageFraction = OptNum(d, "shared_damage_fraction"),
                AmountFraction = OptNum(d, "amount_fraction"),
                ShieldSourceId = OptStr(d, "shield_source_id"),
                ProtectedAllySelectorId = Str(d, "protected_ally_selector_id"),
                SourceSelectorId = Str(d, "source_selector_id"),
                EligibleActionTypes = OptStrings(d, "eligible_action_types") ?? new List<string>(),
                ActionId = Str(d, "action_id"),
                ModifierId = Str(d, "modifier_id"),
                EnemyId = Str(d, "enemy_id"),
                UntilObjectiveDestroyed = OptStr(d, "until_objective_destroyed"),
                OnlyIfObjectiveAlive = OptStr(d, "only_if_objective_alive"),
                WhileAnyObjectiveAlive = OptStrings(d, "while_any_objective_alive"),
                ObjectiveIds = OptStrings(d, "objective_ids") ?? new List<string>(),
                Modifiers = OptMap(d, "modifiers", m => new DamageModifierDef
                {
                    Condition = Pred(Get(m, "condition"))!,
                    Multiplier = OptNum(m, "multiplier"),
                    AddMultiplierPerCount = Num(m, "add_multiplier_per_count"),
                    MaximumCount = Num(m, "maximum_count")
                })
            };
            var ifAlive = OptObj(d, "multiplier_if_objective_alive");
            if (ifAlive != null)
            {
                op.MultiplierIfObjectiveAliveId = Str(ifAlive, "objective_id");
                op.MultiplierIfObjectiveAliveValue = Num(ifAlive, "multiplier");
            }
            var ifAll = OptObj(d, "multiplier_if_all_objectives_alive");
            if (ifAll != null) op.MultiplierIfAllObjectivesAlive = Num(ifAll, "multiplier");
            return op;
        }

        public static EventHookDef Hook(IDictionary<string, object?> d)
        {
            var h = new EventHookDef { Event = Str(d, "event"), EffectOps = Map(d, "effect_ops", Op), Condition = Pred(Get(d, "condition")) };
            var lim = OptObj(d, "limit");
            if (lim != null)
            {
                h.Limit = new HookLimitDef
                {
                    PerBattle = OptNum(lim, "per_battle"),
                    PerOwnerTurn = OptNum(lim, "per_owner_turn"),
                    PerRound = OptNum(lim, "per_round"),
                    PerDamageAction = OptNum(lim, "per_damage_action"),
                    PerTargetPerBattle = OptNum(lim, "per_target_per_battle"),
                    Chance = OptNum(lim, "chance"),
                    OnePendingBonus = OptBool(lim, "one_pending_bonus")
                };
            }
            var f = OptObj(d, "event_filter");
            if (f != null)
            {
                h.EventFilter = new EventFilterDef
                {
                    IncomingActionType = OptStr(f, "incoming_action_type"),
                    DamageActionType = OptStr(f, "damage_action_type"),
                    OwnerActionType = OptStr(f, "owner_action_type"),
                    Team = OptStr(f, "team"),
                    AllyActionType = OptStr(f, "ally_action_type"),
                    EventTargetFactionIs = OptStr(f, "event_target_faction_is"),
                    SourceIsOwner = OptBool(f, "source_is_owner"),
                    ExcludeOwner = OptBool(f, "exclude_owner")
                };
            }
            return h;
        }

        public static ContinuousModifierDef Modifier(IDictionary<string, object?> d) => new ContinuousModifierDef
        {
            Event = Str(d, "event"),
            Condition = Pred(Get(d, "condition")),
            Target = Str(d, "target"),
            DamageMultiplier = Num(d, "damage_multiplier"),
            AppliesTo = OptStr(d, "applies_to"),
            StatId = Str(d, "stat_id"),
            Amount = Num(d, "amount")
        };

        public static EncounterDef Encounter(IDictionary<string, object?> d)
        {
            var e = new EncounterDef
            {
                EncounterId = Str(d, "encounter_id"),
                Seed = Num(d, "seed"),
                Party = Map(d, "party", Member),
                Enemies = Map(d, "enemies", Member)
            };
            var waves = OptArr(d, "waves");
            if (waves != null)
            {
                e.Waves = new List<List<PartyMemberDef>>();
                foreach (object? w in waves)
                {
                    var wave = new List<PartyMemberDef>();
                    foreach (object? m in (List<object?>)w!) wave.Add(Member((IDictionary<string, object?>)m!));
                    e.Waves.Add(wave);
                }
            }
            var mult = OptObj(d, "enemy_stat_multiplier");
            if (mult != null) e.EnemyStatMultiplier = new EnemyStatMultiplierDef { Value = Num(mult, "value"), AppliesTo = OptStrings(mult, "applies_to") ?? new List<string>() };
            return e;
        }

        public static List<PartyMemberDef> Party(string json)
        {
            var list = new List<PartyMemberDef>();
            foreach (object? m in (List<object?>)UomdJson.Parse(json)!) list.Add(Member((IDictionary<string, object?>)m!));
            return list;
        }

        public static PartyMemberDef Member(IDictionary<string, object?> d)
        {
            var m = new PartyMemberDef
            {
                UnitId = Str(d, "unit_id"),
                Level = Num(d, "level"),
                Slot = Num(d, "slot"),
                Row = Str(d, "row"),
                SkillRanks = OptNumMap(d, "skill_ranks"),
                StartFocus = OptNum(d, "start_focus")
            };
            var st = OptObj(d, "stats");
            if (st != null)
            {
                m.Stats = new PartyStatsDef
                {
                    Hp = Num(st, "hp"), Atk = Num(st, "atk"), Def = Num(st, "def"), Spd = Num(st, "spd"),
                    Res = OptNum(st, "res"), CritRate = OptNum(st, "crit_rate"), CritDamage = OptNum(st, "crit_damage"), EffectHit = OptNum(st, "effect_hit")
                };
            }
            var eq = OptObj(d, "equipment_effects");
            if (eq != null)
            {
                m.EquipmentEffects = new EquipmentEffectsDef
                {
                    HealBonusPct = OptNum(eq, "heal_bonus_pct"),
                    FocusGainPct = OptNum(eq, "focus_gain_pct"),
                    EffectResPct = OptNum(eq, "effect_res_pct"),
                    ElementResPct = OptNumMap(eq, "element_res_pct"),
                    Hooks = OptMap(eq, "hooks", Hook)
                };
            }
            return m;
        }
    }
}
