#nullable enable
// Effect execution: C# port of the execution section of packages/combat/src/engine.ts
// (contexts, executeSkill, counters, target selectors, predicates, applyOp and the status/heal/focus helpers).
using System;
using System.Collections.Generic;
using System.Linq;

namespace Uomd.Combat
{
    public sealed partial class Battle
    {
        /// <summary>One damage packet while it is being resolved; hooks and continuous modifiers scale it before it lands.</summary>
        private sealed class Packet
        {
            public Combatant Source = null!;
            public Combatant Target = null!;
            public double OutMult = 1, InMult = 1;
            public bool Blocked;
            /// <summary>null for counters, damage over time and shared damage.</summary>
            public string? ActionKind;
        }

        private sealed class Ctx
        {
            public Combatant Actor = null!;
            public SkillDef Skill = null!;
            public Combatant? Chosen;
            public List<Combatant> Prev = new List<Combatant>();
            public List<Combatant> LastTargets = new List<Combatant>();
            public double RemovedStacks;
            public Combatant? EventSource, EventTarget, EventActor;
            public bool InHook, SuppressHooks;
            public string? ActionKind;
            public double ActionId;
            public Combatant? Primary;
            public Packet? Packet;
            public double LastDamage;
            public Combatant? LastDamageTarget;
            public List<Combatant> Healed = new List<Combatant>();
            /// <summary>opening guards that redirected this action's single-target hit: guard owner id -> damage multiplier</summary>
            public Dictionary<string, double> Guarded = new Dictionary<string, double>();
            public double? AttackBonus;
            public List<string> TargetStatuses = new List<string>();
        }

        private sealed class HookInfo
        {
            public Combatant? Actor, Target;
            public string? ActionKind;
            public double ActionId;
            public Packet? Packet;
            public List<string>? TargetStatuses;
        }

        private static Ctx NewCtx(Combatant actor, SkillDef skill) => new Ctx { Actor = actor, Skill = skill };

        /// <summary>A context with no action behind it, for evaluating always-on rules.</summary>
        private static Ctx BareCtx(Combatant owner) => NewCtx(owner, owner.Def.Skills[0]);

        private void ExecuteSkill(Combatant actor, SkillDef skill, Combatant? chosen)
        {
            string? kind = skill.Type == "passive" ? null : skill.Type;
            if (!TriggerCounters(actor)) return;
            actor.Acted = true;
            var ctx = NewCtx(actor, skill);
            ctx.Chosen = chosen;
            ctx.ActionKind = kind;
            ctx.ActionId = ++_actionSeq;
            bool attacks = skill.EffectOps.Any(o => o.Op == "damage");
            if (attacks && actor.NextAttackBonus != null)
            {
                ctx.AttackBonus = actor.NextAttackBonus;
                actor.NextAttackBonus = null;
            }
            var shown = skill.EffectOps.Count > 0 ? Resolve(skill.EffectOps[0].TargetSelectorId, ctx, true) : new List<Combatant>();
            Emit(Ev("skill_used", ("actor", actor.Id), ("skill", skill.SkillId), ("skillType", skill.Type), ("targets", shown.Select(t => t.Id).ToList())));
            if (skill.Type == "ultimate") actor.Focus = Math.Max(0, actor.Focus - skill.FocusCost);
            foreach (var op in skill.EffectOps) ApplyOp(op, ctx);
            if (skill.Type == "basic") AddFocus(actor, _rules.FocusBasicGain, true);
            else if (skill.Type == "active") AddFocus(actor, _rules.FocusActiveGain, true);
            if (skill.CooldownTurns > 0) actor.Cooldowns[skill.SkillId] = skill.CooldownTurns;
            if (kind != null && actor.Alive)
            {
                var info = new HookInfo { Actor = actor, ActionKind = kind, ActionId = ctx.ActionId };
                Fire("after_ally_action", info);
                if (kind == "ultimate") Fire("after_ally_ultimate", info);
            }
        }

        /// <summary>Counters armed on the acting unit fire before its action; false = it died to the counter.</summary>
        private bool TriggerCounters(Combatant actor)
        {
            foreach (var c in actor.Counters.ToList())
            {
                actor.Counters.Remove(c);
                var owner = Combatants.FirstOrDefault(u => u.Id == c.OwnerId);
                if (owner == null || !owner.Alive) continue;
                var armedBy = owner.Def.Skills.FirstOrDefault(k => k.SkillId == c.SkillId) ?? owner.Def.Skills[0];
                var cctx = NewCtx(owner, armedBy);
                cctx.InHook = true;
                cctx.SuppressHooks = true;
                cctx.EventSource = actor;
                cctx.EventTarget = actor;
                ApplyOp(new EffectOpDef { Op = "damage", TargetSelectorId = "event_source", DamageType = c.DamageType, ScaleStat = c.ScaleStat, Multiplier = c.Multiplier, NoFocusGain = true }, cctx);
                if (!actor.Alive) return false;
            }
            return true;
        }

        private static double ById(Combatant x, Combatant y) => JsMath.Less(x.Id, y.Id) ? -1 : 1;

        private List<Combatant> Resolve(string sel, Ctx ctx, bool peek = false)
        {
            var a = ctx.Actor;
            List<Combatant> One(Combatant? c) => c != null ? new List<Combatant> { c } : new List<Combatant>();
            switch (sel)
            {
                case "single_enemy":
                {
                    var chosen = ctx.Chosen;
                    if (chosen == null) return new List<Combatant>();
                    var t = TauntSource(a) ?? chosen;
                    return t.Alive ? One(Guarded(ctx, a, t, peek)) : new List<Combatant>();
                }
                case "single_enemy_default":
                {
                    var t = PickDefaultTarget(a);
                    return t != null ? One(Guarded(ctx, a, t, peek)) : new List<Combatant>();
                }
                case "all_enemies": return Opponents(a);
                case "front_row_enemies": return Opponents(a).Where(c => c.Row == "front").ToList();
                case "rear_row_enemies": return Opponents(a).Where(c => c.Row == "rear").ToList();
                case "self": return a.Alive ? One(a) : new List<Combatant>();
                case "lowest_hp_ally": return ByLowestHp(Allies(a)).Take(1).ToList();
                case "lowest_hp_allies": return ByLowestHp(Allies(a));
                case "self_and_lowest_hp_ally":
                {
                    var other = ByLowestHp(Allies(a).Where(c => c != a)).FirstOrDefault();
                    var list = a.Alive ? One(a) : new List<Combatant>();
                    if (other != null) list.Add(other);
                    return list;
                }
                case "all_allies": return Allies(a);
                case "previous_op_targets": return ctx.Prev.Where(c => c.Alive).ToList();
                case "event_source": return ctx.EventSource != null && ctx.EventSource.Alive ? One(ctx.EventSource) : new List<Combatant>();
                case "event_target": return ctx.EventTarget != null && ctx.EventTarget.Alive ? One(ctx.EventTarget) : new List<Combatant>();
                case "selected_ally": return ctx.Chosen != null && ctx.Chosen.Alive ? One(ctx.Chosen) : new List<Combatant>();
                case "last_heal_target":
                {
                    var fromAction = ctx.Healed.Where(c => c.Alive).ToList();
                    if (fromAction.Count > 0) return fromAction;
                    return One(Combatants.FirstOrDefault(c => c.Id == a.LastHealTarget && c.Alive));
                }
                case "ally_with_lowest_focus":
                    return JsMath.Sorted(Allies(a), (x, y) =>
                    {
                        double c = x.Focus - y.Focus;
                        if (JsMath.Decides(c)) return c;
                        c = x.Slot - y.Slot;
                        return JsMath.Decides(c) ? c : ById(x, y);
                    }).Take(1).ToList();
                case "front_row_allies": return Allies(a).Where(c => c.Row == "front").ToList();
                case "random_other_enemy":
                {
                    if (peek) return new List<Combatant>();
                    var skip = ctx.Primary ?? ctx.EventTarget;
                    var pool = Opponents(a).Where(c => c != skip).ToList();
                    if (pool.Count == 0) return new List<Combatant>();
                    int i = (int)Math.Min(pool.Count - 1, Math.Floor(_rng.Next() * pool.Count));
                    return One(pool[i]);
                }
                case "enemy_with_lowest_def":
                    return JsMath.Sorted(Opponents(a), (x, y) =>
                    {
                        double c = EffStat(x, "def") - EffStat(y, "def");
                        if (JsMath.Decides(c)) return c;
                        c = x.Slot - y.Slot;
                        return JsMath.Decides(c) ? c : ById(x, y);
                    }).Take(1).ToList();
                case "enemy_with_highest_atk":
                    return JsMath.Sorted(Opponents(a), (x, y) =>
                    {
                        double c = EffStat(y, "atk") - EffStat(x, "atk");
                        if (JsMath.Decides(c)) return c;
                        c = x.Slot - y.Slot;
                        return JsMath.Decides(c) ? c : ById(x, y);
                    }).Take(1).ToList();
                case "enemy_with_most_buffs":
                {
                    var best = JsMath.Sorted(Opponents(a), (x, y) =>
                    {
                        double c = BuffCount(y) - BuffCount(x);
                        if (JsMath.Decides(c)) return c;
                        c = x.Slot - y.Slot;
                        return JsMath.Decides(c) ? c : ById(x, y);
                    }).FirstOrDefault();
                    return best != null && BuffCount(best) > 0 ? One(best) : new List<Combatant>();
                }
                case "lowest_hp_enemy": return ByLowestHp(Opponents(a)).Take(1).ToList();
                // a row-bound pick falls back to the whole opposing side when that row is empty, so a skill is never wasted
                case "lowest_hp_front_enemy":
                {
                    var row = Opponents(a).Where(c => c.Row == "front").ToList();
                    return ByLowestHp(row.Count > 0 ? row : Opponents(a)).Take(1).ToList();
                }
                case "lowest_hp_rear_enemy":
                {
                    var row = Opponents(a).Where(c => c.Row == "rear").ToList();
                    return ByLowestHp(row.Count > 0 ? row : Opponents(a)).Take(1).ToList();
                }
                case "all_enemy_allies": return Allies(a);
                case "lowest_hp_enemy_ally": return ByLowestHp(Allies(a).Where(c => c != a)).Take(1).ToList();
                case "boss": return One(Allies(a).FirstOrDefault(c => c.Def.Boss != null));
                case "duel_marked_enemy":
                {
                    var marked = Opponents(a).Where(c => HasStatus(c, "duel_mark")).ToList();
                    return One(marked.FirstOrDefault() ?? PickDefaultTarget(a));
                }
                case "self_and_enemy_guards":
                case "boss_and_enemy_guards":
                    return Allies(a);
                case "most_injured_enemy_ally": return JsMath.Sorted(Allies(a).Where(c => c != a), ByHpRatio).Take(1).ToList();
                default: throw new InvalidOperationException($"unknown target selector {sel}");
            }
        }

        /// <summary>Opening guards take over each enemy's first single-target attack and soften it.</summary>
        private static Combatant Guarded(Ctx ctx, Combatant attacker, Combatant target, bool peek)
        {
            var g = target.OpeningGuard;
            if (peek || target.Side == attacker.Side || g == null || g.RoundsLeft <= 0 || g.Used.Contains(attacker.Id)) return target;
            g.Used.Add(attacker.Id);
            ctx.Guarded[target.Id] = g.Mult;
            return target;
        }

        private static List<Combatant> ByLowestHp(IEnumerable<Combatant> list) => JsMath.Sorted(list, (a, b) =>
        {
            double c = a.Hp - b.Hp;
            if (JsMath.Decides(c)) return c;
            c = a.Slot - b.Slot;
            return JsMath.Decides(c) ? c : ById(a, b);
        });

        private bool Holds(PredicateDef? pred, Ctx ctx, Combatant owner)
        {
            if (pred == null) return true;
            if (pred.All != null) return pred.All.All(p => Holds(p, ctx, owner));
            if (pred.Any != null) return pred.Any.Any(p => Holds(p, ctx, owner));
            var target = ctx.EventTarget;
            double Hp(Combatant c) => c.Hp / c.MaxHp * 100;
            string sv = pred.StringValue ?? "";
            double nv = pred.NumberValue;
            switch (pred.Name)
            {
                case "last_target_has_status": return ctx.LastTargets.Any(t => HasStatus(t, sv));
                case "owner_in_row": return owner.Row == sv;
                case "owner_hp_below_pct": return Hp(owner) < nv;
                case "owner_hp_above_pct": return Hp(owner) > nv;
                case "owner_has_shield": return ShieldTotal(owner) > 0;
                case "owner_has_status": return HasStatus(owner, sv);
                case "owner_action_type": return (ctx.Packet?.ActionKind ?? ctx.ActionKind) == sv;
                case "owner_took_no_damage_this_round": return !owner.TookDamageThisRound;
                case "target_has_status": return target != null && HasStatus(target, sv);
                case "target_has_status_tag": return target != null && HasTag(target, sv);
                case "target_has_any_status_tag": return target != null && sv.Split(new[] { "_or_" }, StringSplitOptions.None).Any(tag => HasTag(target, tag));
                case "target_in_row": return target != null && target.Row == sv;
                case "target_has_acted_this_battle": return target != null && target.Acted;
                case "round_number_at_most": return _round <= nv;
                case "last_target_defeated": return ctx.LastTargets.Any(t => !t.Alive);
                case "last_primary_target_defeated": return ctx.Primary != null && !ctx.Primary.Alive;
                case "event_target_hp_at_or_below_pct": return target != null && Hp(target) <= nv;
                case "event_target_had_status": return ctx.TargetStatuses.Contains(sv);
                case "event_actor_has_any_buff": return ctx.EventActor != null && BuffCount(ctx.EventActor) > 0;
                case "enemy_ally_hp_below_pct": return Allies(owner).Any(c => c != owner && Hp(c) < nv);
                case "no_enemy_ally_below_pct": return !Allies(owner).Any(c => c != owner && Hp(c) < nv);
                case "damage_dealt_at_least_pct_of_target_hp": return ctx.LastDamageTarget != null && ctx.LastDamage >= ctx.LastDamageTarget.MaxHp * nv / 100;
                case "count_enemies_with_status": return PredicateCount(pred, ctx, owner) > 0;
                default: throw new InvalidOperationException($"unknown predicate {pred.Name}");
            }
        }

        /// <summary>How many units a counting predicate matches (any other predicate: 1 when it holds).</summary>
        private double PredicateCount(PredicateDef pred, Ctx ctx, Combatant owner)
        {
            if (pred.Name == "count_enemies_with_status") return Opponents(owner).Count(c => HasStatus(c, pred.StringValue ?? ""));
            return Holds(pred, ctx, owner) ? 1 : 0;
        }

        private double Scale(Combatant c, string stat) => stat == "hp" ? c.MaxHp : EffStat(c, stat);

        private void ApplyOp(EffectOpDef op, Ctx ctx)
        {
            if (!Holds(op.When, ctx, ctx.Actor)) return;
            var targets = Resolve(op.TargetSelectorId, ctx);
            switch (op.Op)
            {
                case "damage":
                {
                    string element = ctx.Skill.Element ?? ctx.Actor.Def.Element;
                    bool single = op.TargetSelectorId == "single_enemy" || op.TargetSelectorId == "single_enemy_default";
                    if (ctx.Primary == null && targets.Count > 0) ctx.Primary = targets[0];
                    double hits = op.HitCount ?? 1;
                    foreach (var t in targets) for (int h = 0; h < hits; h++) DealDamage(ctx, t, op, element, single);
                    ctx.LastTargets = targets;
                    break;
                }
                case "heal":
                    foreach (var t in targets)
                    {
                        double raw = Math.Floor(Scale(ctx.Actor, op.ScaleStat) * op.Multiplier * RankFactor(ctx.Actor, ctx.Skill.SkillId));
                        HealUnit(ctx.Actor, t, Math.Max(1, Math.Floor(raw * StatusProduct(t, "healing_received_multiplier"))), ctx);
                    }
                    break;
                case "apply_status":
                {
                    var statusDef = StatusOf(op.StatusId);
                    bool isHostile = statusDef != null && statusDef.Category != "buff";
                    foreach (var t in targets)
                    {
                        double effRes = isHostile ? Math.Max(0, EffEffectRes(t) - (ctx.Actor.Base.EffectHit ?? 0)) : 0;
                        if (op.Chance.HasValue)
                        {
                            double effectiveChance = op.Chance.Value * (1 - effRes);
                            if (_rng.Next() >= effectiveChance)
                            {
                                if (effRes > 0) Emit(Ev("status_resisted", ("source", ctx.Actor.Id), ("target", t.Id), ("status", op.StatusId)));
                                continue;
                            }
                        }
                        else if (effRes > 0)
                        {
                            if (_rng.Next() < effRes)
                            {
                                Emit(Ev("status_resisted", ("source", ctx.Actor.Id), ("target", t.Id), ("status", op.StatusId)));
                                continue;
                            }
                        }
                        ApplyStatus(ctx.Actor, t, op.StatusId, op.DurationTurns, op.SharedDamageFraction);
                    }
                    break;
                }
                case "remove_status":
                    foreach (var t in targets)
                    {
                        for (int n = 0; n < op.Count; n++)
                        {
                            var cands = JsMath.Sorted(t.Statuses.Where(s => StatusOf(s.StatusId)?.Category == op.Category), (a, b) => a.Seq - b.Seq);
                            StatusInstance? victim;
                            if (op.Selection == "random_applied_buff")
                            {
                                // the draw happens even with no candidate, exactly like the TypeScript expression
                                double idx = Math.Min(cands.Count - 1, Math.Floor(_rng.Next() * cands.Count));
                                victim = idx >= 0 ? cands[(int)idx] : null;
                            }
                            else victim = cands.FirstOrDefault();
                            if (victim == null) break;
                            t.Statuses.Remove(victim);
                            ctx.RemovedStacks++;
                            Emit(Ev("status_removed", ("target", t.Id), ("status", victim.StatusId), ("reason", "cleansed")));
                        }
                    }
                    break;
                case "grant_shield":
                    foreach (var t in targets)
                    {
                        double amount = Math.Max(1, Math.Floor(Scale(ctx.Actor, op.ScaleStat) * op.Multiplier * RankFactor(ctx.Actor, ctx.Skill.SkillId)));
                        t.Shields.Add(new ShieldInstance { Amount = amount, TurnsLeft = op.DurationTurns, SourceId = string.IsNullOrEmpty(op.ShieldSourceId) ? null : op.ShieldSourceId });
                        Emit(Ev("shield", ("source", ctx.Actor.Id), ("target", t.Id), ("amount", amount)));
                    }
                    break;
                case "grant_redirect":
                    foreach (var p in Resolve(op.ProtectedAllySelectorId, ctx))
                    {
                        if (p == ctx.Actor) continue;
                        p.Redirects = p.Redirects.Where(r => r.ProtectorId != ctx.Actor.Id).ToList();
                        p.Redirects.Add(new RedirectInstance { ProtectorId = ctx.Actor.Id, Fraction = op.RedirectedFraction, TurnsLeft = op.DurationTurns, Eligible = op.EligibleActionTypes });
                        Emit(Ev("redirect_granted", ("protector", ctx.Actor.Id), ("protected", p.Id), ("fraction", op.RedirectedFraction), ("turns", op.DurationTurns)));
                    }
                    break;
                case "grant_intercept":
                    foreach (var p in Resolve(op.ProtectedAllySelectorId, ctx))
                    {
                        if (p == ctx.Actor) continue;
                        p.Redirects = p.Redirects.Where(r => r.ProtectorId != ctx.Actor.Id).ToList();
                        p.Redirects.Add(new RedirectInstance { ProtectorId = ctx.Actor.Id, Fraction = op.RedirectedFraction, TurnsLeft = op.DurationTurns, Eligible = AttackKinds, HitsLeft = op.MaximumIntercepts });
                        Emit(Ev("redirect_granted", ("protector", ctx.Actor.Id), ("protected", p.Id), ("fraction", op.RedirectedFraction), ("turns", op.DurationTurns)));
                    }
                    break;
                case "gain_focus":
                    foreach (var t in targets) AddFocus(t, op.Amount, false);
                    break;
                case "modify_stat":
                    foreach (var t in targets)
                    {
                        t.Mods.Add(new StatMod { Stat = op.StatId, Mode = op.Mode, Amount = op.Amount, TurnsLeft = op.DurationTurns });
                        Emit(Ev("stat_mod", ("target", t.Id), ("stat", op.StatId), ("mode", op.Mode), ("amount", op.Amount), ("turns", op.DurationTurns)));
                    }
                    break;
                case "heal_per_removed_status":
                {
                    if (op.RequiresSuccessfulCleanse && ctx.RemovedStacks == 0) break;
                    double stacks = Math.Min(ctx.RemovedStacks, op.MaximumTotalStacks);
                    double per = Math.Max(1, Math.Floor(Scale(ctx.Actor, op.ScaleStat) * op.Multiplier * stacks * RankFactor(ctx.Actor, ctx.Skill.SkillId)));
                    foreach (var t in targets.Take((int)op.MaximumTargets)) HealUnit(ctx.Actor, t, Math.Floor(per * StatusProduct(t, "healing_received_multiplier")), ctx);
                    break;
                }
                // packet modifiers act on the damage packet the surrounding hook was fired for
                case "modify_incoming_damage":
                    if (ctx.Packet != null) ctx.Packet.InMult *= op.Multiplier;
                    break;
                case "modify_outgoing_damage":
                    if (ctx.Packet != null) ctx.Packet.OutMult *= op.Multiplier;
                    break;
                case "block_attack":
                    if (ctx.Packet != null) ctx.Packet.Blocked = true;
                    break;
                case "grant_damage_reduction":
                    foreach (var t in targets) t.Reductions.Add(new DamageReduction { Mult = op.DamageTakenMultiplier, TurnsLeft = op.DurationTurns });
                    break;
                case "grant_first_hit_guard":
                    foreach (var t in targets) t.Reductions.Add(new DamageReduction { Mult = op.DamageTakenMultiplier, TurnsLeft = op.DurationTurns, HitsLeft = op.HitsPerTarget });
                    break;
                case "grant_opening_guard":
                    foreach (var t in targets) t.OpeningGuard = new OpeningGuard { Mult = op.DamageTakenMultiplier, RoundsLeft = op.DurationRounds };
                    break;
                case "apply_regeneration":
                    foreach (var t in targets)
                    {
                        t.Regens = t.Regens.Where(r => r.SourceId != ctx.Actor.Id).ToList();
                        double amount = Math.Max(1, Math.Floor(Scale(ctx.Actor, op.ScaleStat) * op.Multiplier * RankFactor(ctx.Actor, ctx.Skill.SkillId)));
                        t.Regens.Add(new RegenInstance { SourceId = ctx.Actor.Id, Amount = amount, TicksLeft = op.Ticks, TurnsLeft = op.DurationTurns });
                    }
                    break;
                case "reduce_status_durations":
                    foreach (var t in targets)
                    {
                        foreach (var s in t.Statuses.ToList())
                        {
                            if (StatusOf(s.StatusId)?.Category != op.Category || s.TurnsLeft <= op.MinimumRemainingTurns) continue;
                            s.TurnsLeft = Math.Max(op.MinimumRemainingTurns, s.TurnsLeft - op.AmountTurns);
                            if (s.TurnsLeft <= 0)
                            {
                                t.Statuses.Remove(s);
                                Emit(Ev("status_removed", ("target", t.Id), ("status", s.StatusId), ("reason", "cleansed")));
                            }
                        }
                    }
                    break;
                case "reduce_cooldowns":
                    foreach (var t in targets)
                    {
                        foreach (var k in t.Cooldowns.Keys.ToList())
                        {
                            double v = t.Cooldowns[k];
                            if (v > op.MinimumRemainingTurns) t.Cooldowns[k] = Math.Max(op.MinimumRemainingTurns, v - op.AmountTurns);
                        }
                    }
                    break;
                case "delay_next_action":
                    foreach (var t in targets) Delay(t, op.GaugeFraction);
                    break;
                case "pay_hp_cost":
                    foreach (var t in targets)
                    {
                        double cost = Math.Max(1, Math.Floor(t.MaxHp * op.MaxHpFraction + 1e-9));
                        double next = Math.Max(op.CannotReduceBelow, t.Hp - cost);
                        double paid = t.Hp - next;
                        if (paid <= 0) continue;
                        t.Hp = next;
                        Emit(Ev("hp_cost", ("unit", t.Id), ("amount", paid), ("hpAfter", t.Hp)));
                    }
                    break;
                case "arm_counter":
                    foreach (var t in targets)
                    {
                        t.Counters = t.Counters.Where(c => c.OwnerId != ctx.Actor.Id).ToList();
                        t.Counters.Add(new CounterInstance { OwnerId = ctx.Actor.Id, SkillId = ctx.Skill.SkillId, ScaleStat = op.ScaleStat, Multiplier = op.Multiplier, DamageType = op.DamageType });
                    }
                    break;
                case "arm_next_attack_bonus":
                    foreach (var t in targets) if (t.NextAttackBonus == null) t.NextAttackBonus = op.DamageMultiplier;
                    break;
                case "copy_buff":
                {
                    var source = Resolve(op.SourceSelectorId, ctx).FirstOrDefault();
                    if (source == null) break;
                    foreach (var t in targets) CopyBuffs(source, t, op.Category, op.MaximumCount, op.DurationTurns);
                    break;
                }
                case "remove_shield":
                    foreach (var t in targets)
                    {
                        double removed = 0;
                        if (op.ShieldSourceId != null)
                        {
                            foreach (var sh in t.Shields) if (sh.SourceId == op.ShieldSourceId) removed += sh.Amount;
                            t.Shields = t.Shields.Where(sh => sh.SourceId != op.ShieldSourceId).ToList();
                        }
                        else
                        {
                            double fraction = op.AmountFraction ?? 0;
                            foreach (var sh in t.Shields)
                            {
                                double cut = Math.Min(sh.Amount, Math.Max(1, Math.Ceiling(sh.Amount * fraction - 1e-9)));
                                sh.Amount -= cut;
                                removed += cut;
                            }
                            t.Shields = t.Shields.Where(sh => sh.Amount > 0).ToList();
                        }
                        if (removed > 0) Emit(Ev("shield_removed", ("unit", t.Id), ("amount", removed)));
                    }
                    break;
                case "cancel_boss_telegraph":
                    foreach (var t in targets) if (t.Boss?.Telegraph?.SkillId == op.ActionId) CancelTelegraph(t, "objective");
                    break;
                case "remove_boss_modifier":
                    foreach (var t in targets) if (t.Boss != null) t.Boss.Modifiers = t.Boss.Modifiers.Where(m => m.Id != op.ModifierId).ToList();
                    break;
                case "boss_damage_taken_modifier":
                    foreach (var t in targets)
                    {
                        if (t.Boss == null) continue;
                        t.Boss.Modifiers = t.Boss.Modifiers.Where(m => m.Id != op.ModifierId).ToList();
                        t.Boss.Modifiers.Add(new BossModifier { Id = op.ModifierId, Mult = op.Multiplier, UntilObjective = op.UntilObjectiveDestroyed, WhileAny = op.WhileAnyObjectiveAlive });
                    }
                    break;
                case "summon_enemies":
                    if (op.OnlyIfObjectiveAlive != null && !ObjectiveAlive(op.OnlyIfObjectiveAlive)) break;
                    foreach (var t in targets) Summon(t, op.EnemyId, op.Count);
                    break;
                case "remove_copied_statuses":
                    foreach (var t in targets)
                    {
                        if (op.Category == "shield")
                        {
                            int before = t.Shields.Count;
                            t.Shields = t.Shields.Where(sh => !sh.Copied).ToList();
                            if (t.Shields.Count < before) Emit(Ev("shield_removed", ("unit", t.Id), ("amount", 0.0)));
                        }
                        else
                        {
                            foreach (var st in t.Statuses.Where(x => x.Copied).ToList())
                            {
                                t.Statuses.Remove(st);
                                Emit(Ev("status_removed", ("target", t.Id), ("status", st.StatusId), ("reason", "cleansed")));
                            }
                        }
                    }
                    break;
                case "clear_status_if_all_objectives_destroyed":
                    if (!op.ObjectiveIds.All(id => !ObjectiveAlive(id))) break;
                    foreach (var t in targets)
                    {
                        var st = t.Statuses.FirstOrDefault(x => x.StatusId == op.StatusId);
                        if (st == null) continue;
                        t.Statuses.Remove(st);
                        Emit(Ev("status_removed", ("target", t.Id), ("status", op.StatusId), ("reason", "cleansed")));
                    }
                    break;
                default:
                    throw new InvalidOperationException($"unknown effect op {op.Op}");
            }
            ctx.Prev = targets;
        }

        private void CopyBuffs(Combatant source, Combatant target, string category, double max, double duration)
        {
            double left = max;
            if (category == "shield")
            {
                foreach (var s in JsMath.Sorted(source.Shields, (a, b) => b.Amount - a.Amount))
                {
                    if (left-- <= 0) break;
                    target.Shields.Add(new ShieldInstance { Amount = s.Amount, TurnsLeft = duration, Copied = true });
                    Emit(Ev("buff_copied", ("source", source.Id), ("target", target.Id), ("what", "shield")));
                }
                return;
            }
            foreach (var s in JsMath.Sorted(source.Statuses.Where(x => StatusOf(x.StatusId)?.Category == "buff"), (a, b) => a.Seq - b.Seq))
            {
                if (left-- <= 0) return;
                ApplyStatus(target, target, s.StatusId, duration, null);
                var copy = target.Statuses.FirstOrDefault(x => x.StatusId == s.StatusId);
                if (copy != null) copy.Copied = true;
                Emit(Ev("buff_copied", ("source", source.Id), ("target", target.Id), ("what", s.StatusId)));
            }
            foreach (var m in source.Mods.Where(x => x.Amount > 0).ToList())
            {
                if (left-- <= 0) return;
                target.Mods.Add(new StatMod { Stat = m.Stat, Mode = m.Mode, Amount = m.Amount, TurnsLeft = duration });
                Emit(Ev("buff_copied", ("source", source.Id), ("target", target.Id), ("what", $"{m.Stat}_{m.Mode}")));
            }
        }

        private void Delay(Combatant target, double fraction)
        {
            if (!target.Alive || fraction <= 0) return;
            double cap = Math.Floor(_rules.MaxPendingDelayFraction * _rules.GaugeMax);
            target.PendingDelay = Math.Min(cap, target.PendingDelay + JsMath.Round(fraction * _rules.GaugeMax));
            Emit(Ev("delay", ("unit", target.Id), ("fraction", fraction)));
        }

        private void ApplyStatus(Combatant source, Combatant target, string statusId, double turns, double? value)
        {
            if (!target.Alive) return;
            var def = StatusOf(statusId) ?? throw new InvalidOperationException($"unknown status {statusId}");
            if (target.Def.StatusImmunities != null && target.Def.StatusImmunities.Contains(statusId)) return;
            if (target.Statuses.Any(s => StatusOf(s.StatusId)?.ImmuneStatusIds?.Contains(statusId) == true)) return;
            if (target.Def.Boss != null && def.Category == "control") turns = Math.Max(1, Math.Floor(turns * target.Def.Boss.ControlDurationMultiplier + 1e-9));
            double? power = def.DotAtkMultiplier != null ? EffStat(source, "atk") : (double?)null;
            var existing = target.Statuses.FirstOrDefault(s => s.StatusId == statusId);
            if (existing != null)
            {
                existing.TurnsLeft = Math.Max(existing.TurnsLeft, turns);
                existing.SourceId = source.Id;
                if (value.HasValue) existing.Value = value;
                if (power.HasValue) existing.Power = power;
            }
            else
            {
                target.Statuses.Add(new StatusInstance { StatusId = statusId, TurnsLeft = turns, SourceId = source.Id, Seq = ++_statusSeq, Value = value, Power = power });
            }
            Emit(Ev("status_applied", ("source", source.Id), ("target", target.Id), ("status", statusId), ("turns", turns)));
            if (def.NextActionGaugeDelayFraction.HasValue) Delay(target, def.NextActionGaugeDelayFraction.Value);
        }

        private void HealUnit(Combatant source, Combatant target, double amount, Ctx? ctx)
        {
            if (!target.Alive || amount <= 0) return;
            amount = Math.Floor(amount * (1 + (source.EquipmentEffects.HealBonusPct ?? 0)));
            double applied = Math.Min(amount, target.MaxHp - target.Hp);
            target.Hp += applied;
            source.LastHealTarget = target.Id;
            Emit(Ev("heal", ("source", source.Id), ("target", target.Id), ("amount", applied), ("hpAfter", target.Hp)));
            if (ctx != null)
            {
                ctx.Healed.Add(target);
                if (!ctx.SuppressHooks) Fire("after_ally_healed", new HookInfo { Actor = source, Target = target, ActionKind = ctx.ActionKind, ActionId = ctx.ActionId });
            }
        }

        private void AddFocus(Combatant unit, double amount, bool scaled)
        {
            if (!unit.Alive) return;
            double gain = scaled ? Math.Floor(amount * StatusProduct(unit, "focus_gain_multiplier") * (1 + (unit.EquipmentEffects.FocusGainPct ?? 0))) : amount;
            double next = Math.Min(_rules.FocusMaximum, unit.Focus + gain);
            double delta = next - unit.Focus;
            if (delta == 0) return;
            unit.Focus = next;
            Emit(Ev("focus", ("unit", unit.Id), ("delta", delta), ("total", unit.Focus)));
        }
    }
}
