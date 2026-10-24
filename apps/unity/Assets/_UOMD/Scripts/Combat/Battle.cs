#nullable enable
// Deterministic 5v5 turn-based battle core: C# port of packages/combat/src/engine.ts (construction, queries, turn queue,
// flow and choosing). Effects live in Battle.Effects.cs, damage/bosses/hooks in Battle.Damage.cs.
// Keep this a line-by-line port: the server re-simulates every battle and compares the SHA-256 of the canonical event log,
// so evaluation order, RNG draws and floating-point expression order must match the TypeScript source exactly.
using System;
using System.Collections.Generic;
using System.Linq;
using Uomd.Core;

namespace Uomd.Combat
{
    public sealed partial class Battle
    {
        /// <summary>Safety net: a battle that is still undecided after this many turns is lost by the player.</summary>
        public const int MaxTurns = 300;

        private static readonly string[] AttackKinds = { "basic", "active", "ultimate", "signature" };

        /// <summary>The canonical event log; its canonical JSON SHA-256 is what the server verifies.</summary>
        public readonly List<Dictionary<string, object?>> Log = new List<Dictionary<string, object?>>();
        public readonly List<Combatant> Combatants = new List<Combatant>();

        private readonly RulesDef _rules;
        private readonly Dictionary<string, StatusDef> _statusDefs = new Dictionary<string, StatusDef>();
        private readonly Mulberry32Rng _rng;
        private double _statusSeq;
        private double _actionSeq;
        private readonly Dictionary<string, UnitDef> _defs = new Dictionary<string, UnitDef>();
        private double _round = 1;
        private readonly HashSet<string> _actedThisRound = new HashSet<string>();
        private readonly Dictionary<string, double> _actionMarks = new Dictionary<string, double>();
        private readonly Dictionary<Combatant, UnitRules> _hookCache = new Dictionary<Combatant, UnitRules>();
        private double _turnCounter;
        private Combatant? _current;
        private BattleResult? _outcome;
        private readonly int _startingPlayers;
        private readonly List<List<PartyMemberDef>> _followUpWaves;
        private readonly EnemyStatMultiplierDef? _enemyStatMultiplier;
        private int _waveIndex;

        private sealed class HookEntry
        {
            public string Key = "";
            public SkillDef Skill = new SkillDef();
            public EventHookDef Hook = new EventHookDef();
        }

        private sealed class UnitRules
        {
            public List<HookEntry> Hooks = new List<HookEntry>();
            public List<ContinuousModifierDef> Mods = new List<ContinuousModifierDef>();
        }

        private Battle(UnitPackDef pack, EncounterDef encounter, IReadOnlyList<PartyMemberDef>? party)
        {
            _rules = pack.Rules;
            foreach (var s in pack.Rules.Statuses) _statusDefs[s.StatusId] = s;
            _rng = new Mulberry32Rng((long)encounter.Seed);
            foreach (var u in pack.Units) _defs[u.UnitId] = u;
            _followUpWaves = encounter.Waves ?? new List<List<PartyMemberDef>>();
            _enemyStatMultiplier = encounter.EnemyStatMultiplier;
            var slotsSeen = new HashSet<string>();
            void Add(string side, PartyMemberDef e)
            {
                if (!_defs.TryGetValue(e.UnitId, out var def)) throw new InvalidOperationException($"encounter references unknown unit {e.UnitId}");
                string key = $"{side}:{Fmt(e.Slot)}";
                if (slotsSeen.Contains(key)) throw new InvalidOperationException($"duplicate slot {key}");
                slotsSeen.Add(key);
                var c = MakeCombatant(def, side, e.Slot, e.Row, e.Level);
                if (side == "player") ApplyPartyOverrides(c, e);
                else ApplyEnemyTuning(c, encounter.EnemyStatMultiplier);
                Combatants.Add(c);
            }
            IReadOnlyList<PartyMemberDef> members = party ?? encounter.Party;
            if (members.Count == 0) throw new InvalidOperationException("a battle needs at least one player-side unit");
            foreach (var p in members) Add("player", p);
            foreach (var e in encounter.Enemies) Add("enemy", e);
            _startingPlayers = members.Count;
            Emit(Ev("battle_start", ("seed", encounter.Seed)));
            foreach (var c in Combatants.ToList()) if (c.Def.Boss != null) InitBoss(c);
        }

        /// <summary>`party` (owned-hero battles) replaces the encounter's player side; the server builds it from the player's team.</summary>
        public static Battle Create(UnitPackDef pack, EncounterDef encounter, IReadOnlyList<PartyMemberDef>? party = null) => new Battle(pack, encounter, party);

        private static string Fmt(double n) => CanonicalJson.FormatJsNumber(n);

        private void ApplyPartyOverrides(Combatant c, PartyMemberDef m)
        {
            if (m.Stats != null)
            {
                c.MaxHp = c.Hp = Math.Max(1, m.Stats.Hp);
                c.Base.Atk = m.Stats.Atk;
                c.Base.Def = m.Stats.Def;
                c.Base.Spd = Math.Max(1, m.Stats.Spd);
                if (m.Stats.Res.HasValue) c.Base.Res = m.Stats.Res;
                if (m.Stats.CritRate.HasValue) c.Base.Crit = m.Stats.CritRate;
                if (m.Stats.CritDamage.HasValue) c.Base.CritDamage = m.Stats.CritDamage;
                if (m.Stats.EffectHit.HasValue) c.Base.EffectHit = m.Stats.EffectHit;
            }
            if (m.SkillRanks != null) c.SkillRanks = new Dictionary<string, double>(m.SkillRanks);
            if (m.EquipmentEffects != null) c.EquipmentEffects = m.EquipmentEffects;
            if (m.StartFocus.HasValue && m.StartFocus.Value != 0) c.Focus = Math.Min(_rules.FocusMaximum, m.StartFocus.Value);
        }

        private static void ApplyEnemyTuning(Combatant c, EnemyStatMultiplierDef? tuning)
        {
            if (tuning == null) return;
            double k = tuning.Value;
            if (tuning.AppliesTo.Contains("hp")) c.MaxHp = c.Hp = Math.Max(1, JsMath.RoundHalfUp(c.MaxHp * k));
            if (tuning.AppliesTo.Contains("atk")) c.Base.Atk = JsMath.RoundHalfUp(c.Base.Atk * k);
            if (tuning.AppliesTo.Contains("def")) c.Base.Def = JsMath.RoundHalfUp(c.Base.Def * k);
            if (tuning.AppliesTo.Contains("spd")) c.Base.Spd = Math.Max(1, JsMath.RoundHalfUp(c.Base.Spd * k));
        }

        /// <summary>x(1 + bonus per rank above 1) for the damage / heal / shield amounts of the skill being executed.</summary>
        private double RankFactor(Combatant c, string skillId)
        {
            double rank = c.SkillRanks.TryGetValue(skillId, out var r) ? r : 1;
            return 1 + (_rules.SkillRankBonus ?? 0) * (rank - 1);
        }

        // ---------------------------------------------------------------- construction

        /// <summary>unitStatsAt (content-schema units.ts): attribute units derive their stats, legacy units grow half up.</summary>
        public static CombatBase StatsAt(UnitDef u, double level, out double hp)
        {
            if (u.Attributes != null)
            {
                var b = u.Attributes;
                var a = UomdStatMath.AttributesAt(b.Power, b.BaseStr, b.BaseInt, b.BaseVit, b.BaseAgi, b.GrowthStr, b.GrowthInt, b.GrowthVit, b.GrowthAgi, (int)level, 0, 0, 0, 0, 0);
                var d = UomdStatMath.DeriveStats(b.Power, a, (int)(b.Armor ?? 0), 0);
                hp = d.Hp;
                return new CombatBase { Atk = d.Atk, Def = d.Def, Res = null, Spd = d.Spd, Crit = d.CritRate, CritDamage = d.CritDamage, EffectHit = d.EffectHit };
            }
            var s = u.BaseStats!;
            double Grow(string k, double v)
            {
                double g = u.GrowthPerLevel != null && u.GrowthPerLevel.TryGetValue(k, out var x) ? x : 0;
                return Math.Floor(v + g * (level - 1) + 0.5 + 1e-9);
            }
            hp = Math.Max(1, Grow("hp", s.Hp));
            return new CombatBase
            {
                Atk = Grow("atk", s.Atk),
                Def = Math.Max(0, Grow("def", s.Def)),
                Spd = Math.Max(1, Grow("spd", s.Spd)),
                Res = s.Res.HasValue ? Math.Max(0, Grow("res", s.Res.Value)) : (double?)null
            };
        }

        private Combatant MakeCombatant(UnitDef def, string side, double slot, string row, double level)
        {
            var b = StatsAt(def, level, out double maxHp);
            return new Combatant { Id = $"{side}:{Fmt(slot)}:{def.UnitId}", Def = def, Side = side, Slot = slot, Row = row, Level = level, MaxHp = maxHp, Hp = maxHp, Base = b };
        }

        // ---------------------------------------------------------------- queries

        public BattleResult? Result => _outcome;
        public int Wave => _waveIndex + 1;
        public int TotalWaves => 1 + _followUpWaves.Count;
        public double Round => _round;
        public double TurnCounter => _turnCounter;
        public Combatant? Current => _current;

        public Combatant Unit(string id) => Combatants.FirstOrDefault(x => x.Id == id) ?? throw new InvalidOperationException($"unknown combatant {id}");

        public List<Combatant> Living(string side) => JsMath.Sorted(Combatants.Where(c => c.Side == side && c.Alive && c.Objective == null), (a, b) => a.Slot - b.Slot);

        private List<Combatant> Opponents(Combatant c) => Living(c.Side == "player" ? "enemy" : "player");
        private List<Combatant> Allies(Combatant c) => Living(c.Side);

        private StatusDef? StatusOf(string id) => _statusDefs.TryGetValue(id, out var d) ? d : null;

        public double EffStat(Combatant c, string stat)
        {
            double baseVal = stat == "res" ? (c.Base.Res ?? c.Base.Def) : stat == "atk" ? c.Base.Atk : stat == "def" ? c.Base.Def : c.Base.Spd;
            double flat = 0, pct = 0;
            foreach (var m in c.Mods)
            {
                if (m.Stat != stat) continue;
                if (m.Mode == "add_flat") flat += m.Amount;
                else pct += m.Amount;
            }
            pct += SnapshotPct(c, stat);
            double value = (baseVal + flat) * (1 + pct);
            if (stat == "def" || (stat == "res" && c.Base.Res == null))
            {
                foreach (var s in c.Statuses) value *= StatusOf(s.StatusId)?.DefMultiplier ?? 1;
            }
            if (stat == "res")
            {
                foreach (var s in c.Statuses) value *= StatusOf(s.StatusId)?.ResMultiplier ?? 1;
            }
            double min = stat == "spd" ? 1 : 0;
            return Math.Max(min, JsMath.RoundHalfUp(value));
        }

        /// <summary>Effective hostile status resistance fraction in [0, 1].</summary>
        public double EffEffectRes(Combatant c)
        {
            double pct = (c.Def.EffectRes ?? 0) + (c.EquipmentEffects.EffectResPct ?? 0);
            foreach (var m in c.Mods) if (m.Stat == "effect_res" && m.Mode == "add_pct") pct += m.Amount;
            return Math.Max(0, Math.Min(1, pct));
        }

        /// <summary>Effective per-element incoming damage multiplier (1 - resistance).</summary>
        public double EffElementResMult(Combatant target, string element)
        {
            double own = target.Def.ElementRes != null && target.Def.ElementRes.TryGetValue(element, out var r) ? r : 0;
            double gear = target.EquipmentEffects.ElementResPct != null && target.EquipmentEffects.ElementResPct.TryGetValue(element, out var g) ? g : 0;
            double pct = own + gear;
            if (element == "Veil") foreach (var m in target.Mods) if (m.Stat == "veil_res" && m.Mode == "add_pct") pct += m.Amount;
            return Math.Max(0, 1 - pct);
        }

        private double StatusProduct(Combatant c, string key)
        {
            double p = 1;
            foreach (var s in c.Statuses)
            {
                var d = StatusOf(s.StatusId);
                double? v = d == null ? null : key switch
                {
                    "outgoing_damage_multiplier" => d.OutgoingDamageMultiplier,
                    "damage_taken_multiplier" => d.DamageTakenMultiplier,
                    "healing_received_multiplier" => d.HealingReceivedMultiplier,
                    _ => d.FocusGainMultiplier
                };
                p *= v ?? 1;
            }
            return p;
        }

        private static double ShieldTotal(Combatant c)
        {
            double n = 0;
            foreach (var s in c.Shields) n += s.Amount;
            return n;
        }

        private static bool HasStatus(Combatant c, string id) => c.Statuses.Any(s => s.StatusId == id);
        private bool HasTag(Combatant c, string tag) => c.Statuses.Any(s => StatusOf(s.StatusId)?.Tags?.Contains(tag) == true);

        private int BuffCount(Combatant c) =>
            c.Statuses.Count(s => StatusOf(s.StatusId)?.Category == "buff") + c.Mods.Count(m => m.Amount > 0) + c.Shields.Count(s => s.Amount > 0);

        // ---------------------------------------------------------------- hooks and modifiers of a unit

        private UnitRules RulesOf(Combatant u)
        {
            if (_hookCache.TryGetValue(u, out var r)) return r;
            r = new UnitRules();
            foreach (var skill in u.Def.Skills)
            {
                var hooks = skill.EventHooks ?? new List<EventHookDef>();
                for (int i = 0; i < hooks.Count; i++) r.Hooks.Add(new HookEntry { Key = $"{skill.SkillId}:{i}", Skill = skill, Hook = hooks[i] });
                if (skill.ContinuousModifiers != null) r.Mods.AddRange(skill.ContinuousModifiers);
            }
            var first = u.Def.Skills.Count > 0 ? u.Def.Skills[0] : null;
            if (first != null)
            {
                var ph = u.Def.PassiveHooks ?? new List<EventHookDef>();
                for (int i = 0; i < ph.Count; i++) r.Hooks.Add(new HookEntry { Key = $"unit:{i}", Skill = first, Hook = ph[i] });
                var eh = u.EquipmentEffects.Hooks ?? new List<EventHookDef>();
                for (int i = 0; i < eh.Count; i++) r.Hooks.Add(new HookEntry { Key = $"equip:{i}", Skill = first, Hook = eh[i] });
            }
            if (u.Def.ContinuousModifiers != null) r.Mods.AddRange(u.Def.ContinuousModifiers);
            _hookCache[u] = r;
            return r;
        }

        /// <summary>Percent stat bonuses granted by living allies' always-on rules.</summary>
        private double SnapshotPct(Combatant c, string stat)
        {
            double pct = 0;
            foreach (var u in Combatants)
            {
                if (!u.Alive || u.Side != c.Side) continue;
                foreach (var m in RulesOf(u).Mods)
                {
                    if (m.Event != "stat_snapshot" || m.StatId != stat) continue;
                    bool hit = m.Target == "self" ? u == c : m.Target == "all_allies" || c.Row == "front";
                    if (hit && Holds(m.Condition, BareCtx(u), u)) pct += m.Amount;
                }
            }
            return pct;
        }

        /// <summary>Single-target attacks must pick a living front-row unit while one exists.</summary>
        public List<Combatant> LegalEnemyTargets(Combatant actor)
        {
            var guard = GuardOwner(actor);
            if (guard != null) return new List<Combatant> { guard };
            var opp = Opponents(actor);
            var front = opp.Where(o => o.Row == "front").ToList();
            var pool = front.Count > 0 ? front : opp;
            var taunter = TauntSource(actor);
            if (taunter != null) return new List<Combatant> { taunter };
            var objectives = Combatants.Where(c => c.Alive && c.Objective != null && c.Objective.Targetable && c.Side != actor.Side);
            return pool.Concat(objectives).ToList();
        }

        private Combatant? GuardOwner(Combatant actor) =>
            Opponents(actor).FirstOrDefault(c => c.OpeningGuard != null && c.OpeningGuard.RoundsLeft > 0 && !c.OpeningGuard.Used.Contains(actor.Id));

        private Combatant? TauntSource(Combatant actor)
        {
            foreach (var s in actor.Statuses)
            {
                if (StatusOf(s.StatusId)?.RedirectsSingleTargetAttacks == true)
                {
                    var src = Combatants.FirstOrDefault(c => c.Id == s.SourceId && c.Alive && c.Side != actor.Side);
                    if (src != null) return src;
                }
            }
            return null;
        }

        private static double ByHpRatio(Combatant a, Combatant b)
        {
            double c = a.Hp / a.MaxHp - b.Hp / b.MaxHp;
            if (JsMath.Decides(c)) return c;
            c = a.Slot - b.Slot;
            if (JsMath.Decides(c)) return c;
            return JsMath.Less(a.Id, b.Id) ? -1 : 1;
        }

        private Combatant? PickDefaultTarget(Combatant actor) =>
            JsMath.Sorted(LegalEnemyTargets(actor).Where(c => c.Objective == null), ByHpRatio).FirstOrDefault();

        // ---------------------------------------------------------------- element math

        public double ElementMultiplier(string attackerElement, Combatant target)
        {
            var el = _rules;
            var t = target.Def;
            if (target.Objective != null) return el.ElementNeutral;
            var weak = target.WeaknessOverride ?? t.Weaknesses;
            if (weak != null && weak.Contains(attackerElement)) return el.ElementWeakness;
            if (t.Resistances != null && t.Resistances.Contains(attackerElement)) return el.ElementResistance;
            foreach (var (a, b) in el.MutualPairs)
            {
                if ((attackerElement == a && t.Element == b) || (attackerElement == b && t.Element == a)) return el.ElementAdvantage;
            }
            int i = el.ElementCycle.IndexOf(attackerElement);
            int j = el.ElementCycle.IndexOf(t.Element);
            if (i >= 0 && j >= 0)
            {
                if (j == (i + 1) % el.ElementCycle.Count) return el.ElementAdvantage;
                if (i == (j + 1) % el.ElementCycle.Count) return el.ElementDisadvantage;
            }
            return el.ElementNeutral;
        }

        // ---------------------------------------------------------------- turn queue

        private double Threshold(Combatant c) => _rules.GaugeMax + c.PendingDelay;

        private Combatant PickNextActor()
        {
            var live = Combatants.Where(c => c.Alive && c.Objective == null).ToList();
            double minTicks = double.PositiveInfinity;
            foreach (var c in live)
            {
                double need = Threshold(c) - c.Gauge;
                double ticks = need <= 0 ? 0 : Math.Ceiling(need / EffStat(c, "spd"));
                if (ticks < minTicks) minTicks = ticks;
            }
            foreach (var c in live) c.Gauge += minTicks * EffStat(c, "spd");
            var ready = JsMath.Sorted(live.Where(c => c.Gauge >= Threshold(c)), (a, b) =>
            {
                double oa = a.Gauge - Threshold(a);
                double ob = b.Gauge - Threshold(b);
                if (oa != ob) return ob - oa;
                if (a.Side != b.Side) return a.Side == "player" ? -1 : 1;
                if (a.Slot != b.Slot) return a.Slot - b.Slot;
                return JsMath.Less(a.Id, b.Id) ? -1 : 1;
            });
            return ready.FirstOrDefault() ?? throw new InvalidOperationException("turn queue produced no ready actor");
        }

        /// <summary>Previews the order of the next N actions without mutating state (for the turn-order bar).</summary>
        public List<string> PreviewOrder(int count)
        {
            var live = Combatants.Where(c => c.Alive && c.Objective == null).ToList();
            var g = live.ToDictionary(c => c.Id, c => c.Gauge);
            var pending = live.ToDictionary(c => c.Id, c => c.PendingDelay);
            var outIds = new List<string>();
            for (int n = 0; n < count; n++)
            {
                double minTicks = double.PositiveInfinity;
                foreach (var c in live)
                {
                    double need = _rules.GaugeMax + pending[c.Id] - g[c.Id];
                    double t = need <= 0 ? 0 : Math.Ceiling(need / EffStat(c, "spd"));
                    if (t < minTicks) minTicks = t;
                }
                foreach (var c in live) g[c.Id] = g[c.Id] + minTicks * EffStat(c, "spd");
                var ready = JsMath.Sorted(live.Where(c => g[c.Id] >= _rules.GaugeMax + pending[c.Id]), (a, b) =>
                {
                    double oa = g[a.Id] - (_rules.GaugeMax + pending[a.Id]);
                    double ob = g[b.Id] - (_rules.GaugeMax + pending[b.Id]);
                    if (oa != ob) return ob - oa;
                    if (a.Side != b.Side) return a.Side == "player" ? -1 : 1;
                    if (a.Slot != b.Slot) return a.Slot - b.Slot;
                    return JsMath.Less(a.Id, b.Id) ? -1 : 1;
                });
                var next = ready.FirstOrDefault();
                if (next == null) break;
                outIds.Add(next.Id);
                g[next.Id] = g[next.Id] - (_rules.GaugeMax + pending[next.Id]);
                pending[next.Id] = 0;
            }
            return outIds;
        }

        // ---------------------------------------------------------------- flow

        /// <summary>Runs automatic (enemy) turns until a player decision is required or the battle ends.</summary>
        public StepResult Advance() => RunUntilInput(Log.Count);

        /// <summary>Executes a player decision, then continues until the next decision or the end.</summary>
        public StepResult Act(PlayerAction action)
        {
            int start = Log.Count;
            var actor = _current ?? throw new IllegalActionException("no player turn is pending");
            var skill = Validate(actor, action);
            foreach (var c in Combatants) if (c.Alive && c.Boss?.Telegraph != null) c.Boss.Telegraph.ActionsSeen++;
            ExecuteSkill(actor, skill, skill.PlayerTarget != "none" ? Unit(action.TargetId!) : null);
            FinishTurn(actor);
            _current = null;
            return RunUntilInput(start);
        }

        /// <summary>Picks the action the Auto Battle policy would take for the pending player turn.</summary>
        public PlayerAction AutoAction() => ChooseAuto(_current ?? throw new IllegalActionException("no player turn is pending"));

        /// <summary>Enemy intent preview: the skill (and target when single-target) the enemy will use next.</summary>
        public (string SkillId, string SkillName, string? TargetId, bool Announced)? IntentFor(string enemyId)
        {
            var c = Unit(enemyId);
            if (!c.Alive || c.Side != "enemy" || c.Objective != null) return null;
            var pending = c.Boss?.Telegraph != null ? c.Def.Skills.FirstOrDefault(k => k.SkillId == c.Boss.Telegraph.SkillId) : null;
            var skill = pending ?? ChooseEnemySkill(c);
            if (skill == null) return null;
            string? sel = skill.EffectOps.Count > 0 ? skill.EffectOps[0].TargetSelectorId : null;
            var target = sel == "single_enemy" || sel == "single_enemy_default" ? PickDefaultTarget(c) : null;
            return (skill.SkillId, skill.NameEn, target?.Id, pending != null);
        }

        public TurnPrompt? Prompt() => _current != null ? BuildPrompt(_current) : null;

        private StepResult RunUntilInput(int start)
        {
            while (_outcome == null)
            {
                if (_current != null) return Step(start, BuildPrompt(_current));
                var actor = PickNextActor();
                _turnCounter++;
                Emit(Ev("turn_start", ("actor", actor.Id), ("turn", _turnCounter)));
                string? expiredControl = BeginTurn(actor);
                if (!actor.Alive)
                {
                    FinishTurn(actor);
                    continue;
                }
                string? skipReason = ConsumeSkip(actor) ?? expiredControl;
                if (skipReason != null)
                {
                    Emit(Ev("turn_skipped", ("actor", actor.Id), ("reason", skipReason)));
                    var pending = actor.Boss?.Telegraph;
                    if (pending != null && actor.Boss != null)
                    {
                        var sk = actor.Def.Skills.FirstOrDefault(k => k.SkillId == pending.SkillId);
                        if (sk?.Telegraph?.InterruptibleByControl != false) CancelTelegraph(actor, "control");
                    }
                    FinishTurn(actor);
                    continue;
                }
                if (actor.Side == "player")
                {
                    _current = actor;
                    continue;
                }
                if (actor.Boss != null) BossAct(actor);
                else
                {
                    var skill = ChooseEnemySkill(actor);
                    if (skill == null) Emit(Ev("turn_skipped", ("actor", actor.Id), ("reason", "no_usable_skill")));
                    else
                    {
                        var target = skill.PlayerTarget == "enemy" ? PickDefaultTarget(actor) : skill.PlayerTarget == "ally" ? ByLowestHp(Allies(actor)).FirstOrDefault() : null;
                        ExecuteSkill(actor, skill, target);
                    }
                }
                FinishTurn(actor);
            }
            return Step(start, null);
        }

        private StepResult Step(int start, TurnPrompt? prompt) =>
            new StepResult { Events = Log.GetRange(start, Log.Count - start), Prompt = prompt, Result = _outcome };

        private void FinishTurn(Combatant actor)
        {
            actor.Gauge -= Threshold(actor);
            actor.PendingDelay = 0;
            ProcessTransitions();
            CheckEnd();
            if (_outcome == null) TrackRound(actor);
        }

        /// <summary>A round ends once every living unit has taken a turn since the last one ended.</summary>
        private void TrackRound(Combatant actor)
        {
            _actedThisRound.Add(actor.Id);
            if (!Combatants.All(c => !c.Alive || c.Objective != null || _actedThisRound.Contains(c.Id))) return;
            Fire("after_round_end", new HookInfo());
            Emit(Ev("round_end", ("round", _round)));
            _round++;
            _actedThisRound.Clear();
            foreach (var c in Combatants)
            {
                c.TookDamageThisRound = false;
                c.HookRoundCount = new Dictionary<string, double>();
                if (c.OpeningGuard != null && --c.OpeningGuard.RoundsLeft <= 0) c.OpeningGuard = null;
            }
        }

        private void CheckEnd()
        {
            if (_outcome != null) return;
            var players = Living("player");
            var enemies = Living("enemy");
            if (enemies.Count > 0 && players.Count > 0 && _turnCounter >= MaxTurns)
            {
                _outcome = new BattleResult { Winner = "enemy", Stars = 0, Turns = _turnCounter };
                Emit(Ev("battle_end", ("winner", "enemy"), ("stars", 0.0)));
                return;
            }
            if (enemies.Count == 0 && players.Count > 0 && _waveIndex < _followUpWaves.Count)
            {
                SpawnNextWave();
                return;
            }
            if (enemies.Count == 0 || players.Count == 0)
            {
                string winner = enemies.Count == 0 ? "player" : "enemy";
                int stars = 0;
                if (winner == "player") stars = UomdStatMath.ComputeVictoryStars(_startingPlayers, _startingPlayers - players.Count);
                _outcome = new BattleResult { Winner = winner, Stars = stars, Turns = _turnCounter };
                Emit(Ev("battle_end", ("winner", winner), ("stars", (double)stars)));
            }
        }

        private void SpawnNextWave()
        {
            if (_waveIndex >= _followUpWaves.Count) return;
            var nextEnemies = _followUpWaves[_waveIndex];
            _waveIndex++;
            Combatants.RemoveAll(c => c.Side == "enemy");
            var spawned = new List<Combatant>();
            foreach (var e in nextEnemies)
            {
                if (!_defs.TryGetValue(e.UnitId, out var def)) throw new InvalidOperationException($"encounter wave references unknown unit {e.UnitId}");
                var c = MakeCombatant(def, "enemy", e.Slot, e.Row, e.Level);
                ApplyEnemyTuning(c, _enemyStatMultiplier);
                Combatants.Add(c);
                spawned.Add(c);
            }
            Emit(Ev("wave_start", ("wave", (double)(_waveIndex + 1))));
            foreach (var c in spawned) if (c.Def.Boss != null) InitBoss(c);
        }

        private void Emit(Dictionary<string, object?> e) => Log.Add(e);

        private static Dictionary<string, object?> Ev(string type, params (string Key, object? Value)[] fields)
        {
            var e = new Dictionary<string, object?> { ["type"] = type };
            foreach (var (k, v) in fields) e[k] = v;
            return e;
        }

        // ---------------------------------------------------------------- turn start

        private string? BeginTurn(Combatant actor)
        {
            string? expiredControl = null;
            foreach (var k in actor.Cooldowns.Keys.ToList())
            {
                double v = actor.Cooldowns[k];
                if (v > 0) actor.Cooldowns[k] = v - 1;
            }
            // a damage-over-time status ticks once per turn it was alive for, including the turn it expires on
            var dots = actor.Statuses.Where(s => StatusOf(s.StatusId)?.DotAtkMultiplier != null)
                .Select(s => new StatusInstance { StatusId = s.StatusId, TurnsLeft = s.TurnsLeft, SourceId = s.SourceId, Seq = s.Seq, Value = s.Value, Power = s.Power, Copied = s.Copied }).ToList();
            foreach (var s in actor.Statuses.ToList())
            {
                s.TurnsLeft -= 1;
                if (s.TurnsLeft <= 0)
                {
                    // A one-turn control still owes its next-action skip when its duration expires.
                    if (StatusOf(s.StatusId)?.SkipNextAction == true) expiredControl = s.StatusId;
                    actor.Statuses.Remove(s);
                    Emit(Ev("status_removed", ("target", actor.Id), ("status", s.StatusId), ("reason", "expired")));
                }
            }
            actor.Mods = actor.Mods.Where(m => --m.TurnsLeft > 0).ToList();
            actor.Shields = actor.Shields.Where(s => --s.TurnsLeft > 0).ToList();
            actor.Reductions = actor.Reductions.Where(r => --r.TurnsLeft > 0).ToList();
            foreach (var c in Combatants)
            {
                c.Redirects = c.Redirects.Where(r => r.ProtectorId == actor.Id ? --r.TurnsLeft > 0 : true).ToList();
                // a counter armed by this unit lapses when its next turn begins
                c.Counters = c.Counters.Where(k => k.OwnerId != actor.Id).ToList();
            }
            actor.HookTurnCount = new Dictionary<string, double>();
            actor.FocusGainedThisTurn = 0;
            foreach (var s in dots)
            {
                if (!actor.Alive) break;
                var d = StatusOf(s.StatusId);
                if (d == null || d.DotAtkMultiplier == null) continue;
                var src = Combatants.FirstOrDefault(c => c.Id == s.SourceId) ?? actor;
                Receive(null, src, actor, Math.Max(1, Math.Floor((s.Power ?? 0) * d.DotAtkMultiplier.Value + 1e-9)), new HitOptions { Dot = s.StatusId });
            }
            foreach (var r in actor.Regens.ToList())
            {
                if (!actor.Alive) break;
                r.TurnsLeft -= 1;
                if (r.TicksLeft > 0)
                {
                    r.TicksLeft -= 1;
                    var src = Combatants.FirstOrDefault(c => c.Id == r.SourceId) ?? actor;
                    HealUnit(src, actor, Math.Floor(r.Amount * StatusProduct(actor, "healing_received_multiplier")), null);
                }
                if (r.TicksLeft <= 0 || r.TurnsLeft <= 0) actor.Regens.Remove(r);
            }
            if (actor.Alive) Fire("owner_turn_start", new HookInfo { Actor = actor });
            return expiredControl;
        }

        private string? ConsumeSkip(Combatant actor)
        {
            int idx = actor.Statuses.FindIndex(s => StatusOf(s.StatusId)?.SkipNextAction == true);
            if (idx < 0) return null;
            var removed = actor.Statuses[idx];
            actor.Statuses.RemoveAt(idx);
            Emit(Ev("status_removed", ("target", actor.Id), ("status", removed.StatusId), ("reason", "expired")));
            return removed.StatusId;
        }

        // ---------------------------------------------------------------- choosing

        private static string? Unusable(Combatant actor, SkillDef skill)
        {
            if ((actor.Cooldowns.TryGetValue(skill.SkillId, out var cd) ? cd : 0) > 0) return "cooldown";
            if (actor.Focus < skill.FocusCost) return "focus";
            return null;
        }

        private SkillDef? ChooseEnemySkill(Combatant actor)
        {
            string? phaseId = null;
            if (actor.Boss != null && actor.Def.Boss != null && actor.Boss.Phase >= 0 && actor.Boss.Phase < actor.Def.Boss.Phases.Count) phaseId = actor.Def.Boss.Phases[actor.Boss.Phase].PhaseId;
            var candidates = actor.Def.Skills.Where(s => s.Type != "passive" && Unusable(actor, s) == null && (s.PhaseIds == null || (phaseId != null && s.PhaseIds.Contains(phaseId))));
            return JsMath.Sorted(candidates, (a, b) => b.AiPriority - a.AiPriority).FirstOrDefault();
        }

        private TurnPrompt BuildPrompt(Combatant actor)
        {
            var options = new List<SkillOption>();
            foreach (var s in actor.Def.Skills)
            {
                if (s.Type == "passive") continue;
                string? reason = Unusable(actor, s);
                options.Add(new SkillOption
                {
                    SkillId = s.SkillId,
                    Name = s.NameEn,
                    Type = s.Type,
                    Available = reason == null,
                    Reason = reason,
                    CooldownLeft = actor.Cooldowns.TryGetValue(s.SkillId, out var cd) ? cd : 0,
                    NeedsTarget = s.PlayerTarget != "none",
                    LegalTargets = s.PlayerTarget == "enemy" ? LegalEnemyTargets(actor).Select(t => t.Id).ToList() : s.PlayerTarget == "ally" ? Allies(actor).Select(t => t.Id).ToList() : new List<string>(),
                    Def = s
                });
            }
            return new TurnPrompt { Actor = actor.Id, Options = options };
        }

        private SkillDef Validate(Combatant actor, PlayerAction action)
        {
            var skill = actor.Def.Skills.FirstOrDefault(s => s.SkillId == action.SkillId);
            if (skill == null || skill.Type == "passive") throw new IllegalActionException($"unit {actor.Id} cannot use {action.SkillId}");
            string? reason = Unusable(actor, skill);
            if (reason != null) throw new IllegalActionException($"skill {skill.SkillId} unavailable: {reason}");
            if (skill.PlayerTarget != "none")
            {
                var legal = (skill.PlayerTarget == "enemy" ? LegalEnemyTargets(actor) : Allies(actor)).Select(t => t.Id).ToList();
                if (string.IsNullOrEmpty(action.TargetId) || !legal.Contains(action.TargetId!)) throw new IllegalActionException($"illegal target {action.TargetId ?? "(none)"} for {skill.SkillId}");
            }
            else if (action.TargetId != null)
            {
                throw new IllegalActionException($"skill {skill.SkillId} takes no target");
            }
            return skill;
        }

        private PlayerAction ChooseAuto(Combatant actor)
        {
            var ok = BuildPrompt(actor).Options.Where(o => o.Available).ToList();
            PlayerAction Target(SkillOption o)
            {
                if (!o.NeedsTarget) return new PlayerAction(o.SkillId);
                var t = JsMath.Sorted(AutoPool(o.LegalTargets.Select(Unit).ToList()), ByHpRatio).FirstOrDefault() ?? throw new IllegalActionException("no legal target");
                return new PlayerAction(o.SkillId, t.Id);
            }
            var healer = ok.FirstOrDefault(o => o.Type == "active" && o.Def.EffectOps.Any(op => op.Op == "heal"));
            bool lowAlly = Allies(actor).Any(a => a.Hp / a.MaxHp < _rules.AutoHealPriorityHpPercent / 100);
            if (healer != null && lowAlly) return Target(healer);
            var ult = ok.FirstOrDefault(o => o.Type == "ultimate");
            if (ult != null && (!_rules.AutoSaveUltimateUntilBoss || Opponents(actor).Any(e => e.Boss != null))) return Target(ult);
            var active = JsMath.Sorted(ok.Where(o => o.Type == "active"), (a, b) => b.Def.AiPriority - a.Def.AiPriority).FirstOrDefault();
            if (active != null) return Target(active);
            var basic = ok.FirstOrDefault(o => o.Type == "basic") ?? throw new IllegalActionException("no usable skill");
            return Target(basic);
        }
    }
}
